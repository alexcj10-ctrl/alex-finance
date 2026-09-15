import { lazy, Suspense, useEffect, useState } from 'react';

import App from './App';
import { AccessDeniedPage } from './auth/AccessDeniedPage';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { LoginPage } from './auth/LoginPage';
import { PasswordSetupPage } from './auth/PasswordSetupPage';
import { createSupabaseCoachRepository } from './services/supabase/supabase-coach-repository';

const CoachApp = lazy(() =>
  import('./coach/CoachApp').then((module) => ({ default: module.CoachApp })),
);

function AuthenticatedApp() {
  const { state, logout } = useAuth();
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const updatePathname = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', updatePathname);
    return () => window.removeEventListener('popstate', updatePathname);
  }, []);

  const isCoachPath = pathname === '/coach' || pathname.startsWith('/coach/');

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    if (state.identity.role === 'coach' && !isCoachPath) {
      window.location.replace('/coach');
    } else if (state.identity.role === 'player' && pathname === '/login') {
      window.location.replace('/');
    }
  }, [isCoachPath, pathname, state]);

  if (state.status === 'loading') {
    return <output className="auth-loading">Caricamento del tuo percorso…</output>;
  }

  if (state.status === 'configuration-error') {
    return <div className="auth-loading" role="alert">{state.message}</div>;
  }

  if (state.status === 'password-setup') {
    return <PasswordSetupPage />;
  }

  if (state.status === 'anonymous') {
    return <LoginPage message={state.message} />;
  }

  const { identity } = state;
  if (identity.role === 'player' && isCoachPath) {
    return (
      <AccessDeniedPage
        onReturn={() => {
          window.history.replaceState({}, '', '/');
          setPathname('/');
        }}
      />
    );
  }

  if (identity.role === 'coach' && !isCoachPath) {
    return <output className="auth-loading">Apertura Area Coach…</output>;
  }

  return isCoachPath ? (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-background text-foreground">
          Caricamento Area Coach…
        </div>
      }
    >
      <CoachApp
        repository={createSupabaseCoachRepository(identity.teamId)}
        onLogout={logout}
      />
    </Suspense>
  ) : (
    <App identity={identity} onLogout={logout} />
  );
}

export function RootApp() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
