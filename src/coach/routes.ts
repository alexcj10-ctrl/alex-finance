import { useEffect, useState } from 'react';

export type CoachRoute =
  | { name: 'overview' }
  | { name: 'players' }
  | { name: 'player'; playerId: string }
  | { name: 'lessons' }
  | { name: 'results' }
  | { name: 'not-found' };

export function parseCoachPath(pathname: string): CoachRoute {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalized === '/coach') return { name: 'overview' };
  if (normalized === '/coach/giocatori') return { name: 'players' };
  if (normalized === '/coach/lezioni') return { name: 'lessons' };
  if (normalized === '/coach/risultati') return { name: 'results' };

  const playerMatch = normalized.match(/^\/coach\/giocatori\/([^/]+)$/);
  if (playerMatch) {
    try {
      return { name: 'player', playerId: decodeURIComponent(playerMatch[1]) };
    } catch {
      return { name: 'not-found' };
    }
  }

  return { name: 'not-found' };
}

export function navigateCoach(path: string, options: { replace?: boolean } = {}) {
  if (options.replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);

  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useCoachRoute() {
  const [route, setRoute] = useState<CoachRoute>(() => parseCoachPath(window.location.pathname));

  useEffect(() => {
    const updateRoute = () => setRoute(parseCoachPath(window.location.pathname));
    window.addEventListener('popstate', updateRoute);
    return () => window.removeEventListener('popstate', updateRoute);
  }, []);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('#coach-main')?.focus({ preventScroll: true });
      });
    });
  }, [route]);

  return route;
}
