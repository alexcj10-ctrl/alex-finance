import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  requireSupabaseClient,
  supabaseAuthCallbackType,
  supabaseConfigured,
} from '../services/supabase/client';
import type { AuthIdentity, AuthState, LoginCredentials } from './auth-types';

type PlayerLoginResponse = {
  session?: {
    accessToken?: string;
    refreshToken?: string;
  };
};

type AuthContextValue = {
  state: AuthState;
  login: (credentials: LoginCredentials) => Promise<void>;
  setNewPassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readIdentity(session: Session): Promise<AuthIdentity> {
  const client = requireSupabaseClient();
  const { data: userData, error: userError } = await client.auth.getUser(session.access_token);

  if (userError || !userData.user || userData.user.id !== session.user.id) {
    throw new Error('Sessione non valida.');
  }

  const [profileResult, membershipResult] = await Promise.all([
    client
      .from('profiles')
      .select('id, display_name, role, account_active')
      .eq('id', session.user.id)
      .maybeSingle(),
    client
      .from('team_members')
      .select('team_id, profile_id, role, active')
      .eq('profile_id', session.user.id)
      .eq('active', true)
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileResult.data;
  const membership = membershipResult.data;
  if (
    profileResult.error ||
    membershipResult.error ||
    !profile ||
    !membership ||
    !profile.account_active ||
    profile.role !== membership.role
  ) {
    throw new Error('Profilo non autorizzato.');
  }

  const teamResult = await client
    .from('teams')
    .select('id, name, season')
    .eq('id', membership.team_id)
    .maybeSingle();

  if (teamResult.error || !teamResult.data) {
    throw new Error('Squadra non disponibile.');
  }

  return {
    userId: profile.id,
    displayName: profile.display_name,
    role: profile.role,
    teamId: teamResult.data.id,
    teamName: teamResult.data.name,
    season: teamResult.data.season,
  };
}

function genericLoginError() {
  return new Error('Credenziali non valide. Controlla i dati e riprova.');
}

function validateNewPassword(password: string) {
  if (
    password.length < 8 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new Error('Usa almeno 8 caratteri, con maiuscola, minuscola e numero.');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    supabaseConfigured
      ? { status: 'loading' }
      : {
          status: 'configuration-error',
          message: 'Supabase non è configurato in questo ambiente.',
        },
  );
  const hydrationId = useRef(0);
  const passwordSetup = useRef(
    supabaseAuthCallbackType === 'invite' ||
      supabaseAuthCallbackType === 'recovery' ||
      supabaseAuthCallbackType === 'signup',
  );

  const applySession = useCallback(async (session: Session | null) => {
    const requestId = ++hydrationId.current;
    if (!session) {
      setState({ status: 'anonymous' });
      return;
    }

    if (passwordSetup.current) {
      setState({ status: 'password-setup' });
      return;
    }

    setState({ status: 'loading' });
    try {
      const identity = await readIdentity(session);
      if (requestId === hydrationId.current) {
        setState({ status: 'authenticated', identity });
      }
    } catch {
      if (requestId !== hydrationId.current) return;
      await requireSupabaseClient().auth.signOut({ scope: 'local' });
      setState({ status: 'anonymous', message: 'Questo account non è abilitato.' });
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const client = requireSupabaseClient();
    let cancelled = false;

    void client.auth.getSession().then(({ data }) => {
      if (!cancelled) void applySession(data.session);
    });

    const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') passwordSetup.current = true;
      window.setTimeout(() => {
        if (!cancelled) void applySession(session);
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [applySession]);

  const login = useCallback(async ({ identifier, password }: LoginCredentials) => {
    const client = requireSupabaseClient();
    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier || !password) throw genericLoginError();

    if (normalizedIdentifier.includes('@')) {
      const { data, error } = await client.auth.signInWithPassword({
        email: normalizedIdentifier.toLowerCase(),
        password,
      });
      if (error || !data.session) throw genericLoginError();
      await applySession(data.session);
      return;
    }

    const response = await fetch('/api/auth/player-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: normalizedIdentifier, pin: password }),
    });
    const payload = (await response.json().catch(() => null)) as PlayerLoginResponse | null;
    const accessToken = payload?.session?.accessToken;
    const refreshToken = payload?.session?.refreshToken;
    if (!response.ok || !accessToken || !refreshToken) throw genericLoginError();

    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error || !data.session) throw genericLoginError();
    await applySession(data.session);
  }, [applySession]);

  const setNewPassword = useCallback(async (password: string) => {
    validateNewPassword(password);
    const client = requireSupabaseClient();
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      throw new Error('Non è stato possibile impostare la password. Richiedi un nuovo link e riprova.');
    }

    passwordSetup.current = false;
    window.history.replaceState({}, '', window.location.pathname || '/');
    const { data } = await client.auth.getSession();
    if (!data.session) {
      setState({ status: 'anonymous', message: 'Password impostata. Ora puoi accedere.' });
      return;
    }
    await applySession(data.session);
  }, [applySession]);

  const logout = useCallback(async () => {
    hydrationId.current += 1;
    if (supabaseConfigured) await requireSupabaseClient().auth.signOut();
    setState({ status: 'anonymous' });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, login, setNewPassword, logout }),
    [login, logout, setNewPassword, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth deve essere usato dentro AuthProvider.');
  return value;
}
