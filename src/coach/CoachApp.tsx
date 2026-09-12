/* oxlint-disable next/no-html-link-for-pages -- App Vite con routing History API. */
import type { MouseEvent } from 'react';
import { ArrowLeft, LoaderCircle } from 'lucide-react';

import type { CoachRepository } from '../services/coach-repository';
import { CoachShell } from './components/CoachShell';
import { useCoachData } from './hooks/useCoachData';
import { CoachLessonsPage } from './pages/CoachLessonsPage';
import { CoachOverviewPage } from './pages/CoachOverviewPage';
import { CoachPlayerDetailPage } from './pages/CoachPlayerDetailPage';
import { CoachPlayersPage } from './pages/CoachPlayersPage';
import { CoachResultsPage } from './pages/CoachResultsPage';
import { navigateCoach, useCoachRoute } from './routes';
import './coach.css';

function handleOverview(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateCoach('/coach');
}

export function CoachApp({
  repository,
  onLogout,
}: {
  repository: CoachRepository;
  onLogout: () => Promise<void>;
}) {
  const route = useCoachRoute();
  const data = useCoachData(repository);

  if (data.status === 'loading') {
    return (
      <output className="coach-app coach-standalone-state" aria-live="polite">
        <LoaderCircle className="size-7 coach-loading-icon" aria-hidden="true" />
        <strong>Prepariamo l’Area Coach</strong>
        <span>Caricamento del percorso squadra…</span>
      </output>
    );
  }

  if (data.status === 'error') {
    return (
      <div className="coach-app coach-standalone-state" role="alert">
        <strong>Area Coach non disponibile</strong>
        <span>{data.message}</span>
      </div>
    );
  }

  const { model } = data;
  let page;

  switch (route.name) {
    case 'overview':
      page = <CoachOverviewPage model={model} />;
      break;
    case 'players':
      page = <CoachPlayersPage model={model} onDataChanged={data.refresh} />;
      break;
    case 'player': {
      const detail = model.getPlayerDetail(route.playerId);
      page = detail ? (
        <CoachPlayerDetailPage
          detail={detail}
          referenceDate={model.generatedAt}
          showDemoBadge={model.source === 'mock'}
        />
      ) : (
        <section className="coach-not-found">
          <span>404</span>
          <h1>Giocatore non trovato</h1>
          <p>Il profilo richiesto non appartiene alla rosa attiva.</p>
          <a href="/coach/giocatori" onClick={(event) => {
            event.preventDefault();
            navigateCoach('/coach/giocatori');
          }}>
            <ArrowLeft className="size-4" aria-hidden="true" /> Torna ai giocatori
          </a>
        </section>
      );
      break;
    }
    case 'lessons':
      page = <CoachLessonsPage model={model} onDataChanged={data.refresh} />;
      break;
    case 'results':
      page = <CoachResultsPage model={model} />;
      break;
    case 'not-found':
      page = (
        <section className="coach-not-found">
          <span>404</span>
          <h1>Pagina non trovata</h1>
          <p>Questa sezione non fa parte dell’Area Coach.</p>
          <a href="/coach" onClick={handleOverview}>
            <ArrowLeft className="size-4" aria-hidden="true" /> Torna alla Panoramica
          </a>
        </section>
      );
      break;
  }

  return (
    <CoachShell
      route={route}
      team={model.team}
      coachName={model.coachName}
      onLogout={onLogout}
    >
      {page}
    </CoachShell>
  );
}
