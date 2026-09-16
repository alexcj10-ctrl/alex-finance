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
import type {
  AuthIdentity,
  AuthState,
  LoginCredentials,
  PlayerSignupInput,
} from './auth-types';

type PlayerLoginResponse = {
  session?: {
    accessToken?: string;
    refreshToken?: string;
  };
};

type PlayerSignupResponse = {
  player?: {
    displayName?: string;
    playerCode?: string;
    pin?: string;
  };
  session?: {
    accessToken?: string;
    refreshToken?: string;
  };
  error?: {
    message?: string;
  };
};

type AuthContextValue = {
  state: AuthState;
  login: (credentials: LoginCredentials) => Promise<void>;
  createPlayerProfile: (input: PlayerSignupInput) => Promise<void>;
  continuePlayerProfile: () => Promise<void>;
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
  const playerCreationPending = useRef(false);
  const passwordSetup = useRef(
    supabaseAuthCallbackType === 'invite' ||
      supabaseAuthCallbackType === 'recovery' ||
      supabaseAuthCallbackType === 'signup',
  );

  const applySession = useCallback(async (session: Session | null) => {
    if (playerCreationPending.current) return;
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
    playerCreationPending.current = false;
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

  const createPlayerProfile = useCallback(async ({
    firstName,
    lastName,
  }: PlayerSignupInput) => {
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    if (!normalizedFirstName || !normalizedLastName) {
      throw new Error('Inserisci nome e cognome.');
    }

    const response = await fetch('/api/auth/player-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
      }),
    });
    const payload = (await response.json().catch(() => null)) as PlayerSignupResponse | null;
    const accessToken = payload?.session?.accessToken;
    const refreshToken = payload?.session?.refreshToken;
    const displayName = payload?.player?.displayName;
    const playerCode = payload?.player?.playerCode;
    const pin = payload?.player?.pin;

    if (!response.ok) {
      throw new Error(payload?.error?.message ?? 'Creazione del profilo non riuscita. Riprova.');
    }
    if (!accessToken || !refreshToken || !displayName || !playerCode || !pin) {
      throw new Error('Profilo creato, ma accesso non completato. Chiedi aiuto al tuo allenatore.');
    }

    const client = requireSupabaseClient();
    playerCreationPending.current = true;
    const credentials = { displayName, playerCode, pin };
    setState({
      status: 'player-created',
      connecting: true,
      credentials,
    });
    try {
      const { data, error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error || !data.session) {
        throw new Error('Accesso automatico non riuscito. Conserva il codice e il PIN.');
      }

      const identity = await readIdentity(data.session);
      if (identity.role !== 'player') {
        throw new Error('Il profilo creato non è un account giocatore valido.');
      }

      setState({
        status: 'player-created',
        connecting: false,
        identity,
        credentials,
      });
    } catch {
      await client.auth.signOut({ scope: 'local' });
      setState({
        status: 'player-created',
        connecting: false,
        credentials,
        message: 'Il profilo è pronto. Premi Continua per completare l’accesso.',
      });
    }
  }, []);

  const continuePlayerProfile = useCallback(async () => {
    if (state.status !== 'player-created' || state.connecting) return;
    if (state.identity) {
      playerCreationPending.current = false;
      setState({ status: 'authenticated', identity: state.identity });
      return;
    }

    const credentials = state.credentials;
    setState({ ...state, connecting: true, message: undefined });
    try {
      await login({
        identifier: credentials.playerCode,
        password: credentials.pin,
      });
    } catch {
      setState({
        status: 'player-created',
        connecting: false,
        credentials,
        message: 'Accesso non riuscito. Conserva codice e PIN e riprova tra poco.',
      });
    }
  }, [login, state]);

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
    playerCreationPending.current = false;
    if (supabaseConfigured) await requireSupabaseClient().auth.signOut();
    setState({ status: 'anonymous' });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      login,
      createPlayerProfile,
      continuePlayerProfile,
      setNewPassword,
      logout,
    }),
    [
      continuePlayerProfile,
      createPlayerProfile,
      login,
      logout,
      setNewPassword,
      state,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth deve essere usato dentro AuthProvider.');
  return value;
}
