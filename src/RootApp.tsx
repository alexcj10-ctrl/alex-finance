import { lazy, Suspense, useEffect, useState } from 'react';

import App from './App';

const CoachApp = lazy(() =>
  import('./coach/CoachApp').then((module) => ({ default: module.CoachApp })),
);

export function RootApp() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const updatePathname = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', updatePathname);
    return () => window.removeEventListener('popstate', updatePathname);
  }, []);

  const isCoachPath =
    pathname === '/coach' || pathname.startsWith('/coach/');

  return isCoachPath ? (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-background text-foreground">
          Caricamento Area Coach…
        </div>
      }
    >
      <CoachApp />
    </Suspense>
  ) : (
    <App />
  );
}
