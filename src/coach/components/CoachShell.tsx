/* oxlint-disable next/no-img-element, next/no-html-link-for-pages -- App Vite con routing History API. */
import type { MouseEvent, ReactNode } from 'react';
import { BarChart3, BookOpen, LayoutDashboard, Users } from 'lucide-react';

import type { CoachTeamRecord } from '../../types/coach';
import { navigateCoach, type CoachRoute } from '../routes';

const navigation = [
  { id: 'overview', label: 'Panoramica', path: '/coach', icon: LayoutDashboard },
  { id: 'players', label: 'Giocatori', path: '/coach/giocatori', icon: Users },
  { id: 'lessons', label: 'Lezioni', path: '/coach/lezioni', icon: BookOpen },
  { id: 'results', label: 'Risultati', path: '/coach/risultati', icon: BarChart3 },
] as const;

function activeNavigationId(route: CoachRoute) {
  if (route.name === 'player') return 'players';
  if (route.name === 'not-found') return undefined;
  return route.name;
}

function handleNavigation(event: MouseEvent<HTMLAnchorElement>, path: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateCoach(path);
}

export function CoachShell({
  route,
  team,
  coachName,
  children,
}: {
  route: CoachRoute;
  team: CoachTeamRecord;
  coachName: string;
  children: ReactNode;
}) {
  const activeId = activeNavigationId(route);

  return (
    <div className="coach-app">
      <a className="coach-skip-link" href="#coach-main">
        Vai al contenuto
      </a>

      <div className="coach-layout">
        <aside className="coach-sidebar">
          <a
            className="coach-brand"
            href="/coach"
            onClick={(event) => handleNavigation(event, '/coach')}
            aria-label="Area Coach, vai alla Panoramica"
          >
            <span className="coach-brand-mark" aria-hidden="true">
              <img src="/images/poggio-mirteto-logo.png" alt="" />
            </span>
            <span>
              <strong>ESORDIENTI ANALYST</strong>
              <small>Area Coach</small>
            </span>
          </a>

          <nav className="coach-desktop-navigation" aria-label="Navigazione area coach">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activeId === item.id;
              return (
                <a
                  key={item.id}
                  className={`coach-navigation-link${isActive ? ' coach-navigation-link-active' : ''}`}
                  href={item.path}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={(event) => handleNavigation(event, item.path)}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>

          <div className="coach-sidebar-context">
            <span>Squadra monitorata</span>
            <strong>{team.name}</strong>
            <small>Stagione {team.season}</small>
          </div>

          <div className="coach-profile-summary">
            <span className="coach-profile-avatar" aria-hidden="true">
              {coachName
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')}
            </span>
            <span>
              <strong>{coachName}</strong>
              <small>Allenatore</small>
            </span>
          </div>
        </aside>

        <div className="coach-content-shell">
          <header className="coach-mobile-header">
            <span className="coach-brand-mark" aria-hidden="true">
              <img src="/images/poggio-mirteto-logo.png" alt="" />
            </span>
            <span>
              <strong>ESORDIENTI ANALYST</strong>
              <small>Area Coach</small>
            </span>
          </header>

          <main id="coach-main" className="coach-main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>

      <nav className="coach-mobile-navigation" aria-label="Navigazione area coach mobile">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;
          return (
            <a
              key={item.id}
              className={`coach-mobile-link${isActive ? ' coach-mobile-link-active' : ''}`}
              href={item.path}
              aria-current={isActive ? 'page' : undefined}
              onClick={(event) => handleNavigation(event, item.path)}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
