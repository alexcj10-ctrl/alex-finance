import { useMemo, useState } from 'react';

import type { CoachReadModel } from '../../types/coach';
import { CoachPageHeader, DemoDataBadge } from '../components/CoachPageHeader';
import { PlayerList } from '../components/PlayerList';

type PlayerFilter = 'all' | 'attention';

export function CoachPlayersPage({ model }: { model: CoachReadModel }) {
  const [filter, setFilter] = useState<PlayerFilter>('all');
  const players = useMemo(() => {
    const filtered = filter === 'attention'
      ? model.players.filter((player) => player.attention.length > 0)
      : model.players;

    return [...filtered].sort(
      (left, right) =>
        Number(right.attention.length > 0) - Number(left.attention.length > 0) ||
        left.displayName.localeCompare(right.displayName, 'it'),
    );
  }, [filter, model.players]);

  return (
    <div className="coach-page">
      <CoachPageHeader
        eyebrow="Squadra"
        title="Giocatori"
        description="Progressi, attività e lezioni completate in un’unica vista."
        action={model.source === 'mock' ? <DemoDataBadge /> : undefined}
      />

      <section className="coach-list-panel" aria-labelledby="players-list-title">
        <header className="coach-list-toolbar">
          <div>
            <h2 id="players-list-title">Rosa attiva</h2>
            <p>{model.players.length} nickname, nessun dato personale superfluo.</p>
          </div>
          <fieldset className="coach-filter">
            <legend className="sr-only">Filtra giocatori</legend>
            <button
              type="button"
              className={filter === 'all' ? 'coach-filter-active' : undefined}
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              Tutti
            </button>
            <button
              type="button"
              className={filter === 'attention' ? 'coach-filter-active' : undefined}
              aria-pressed={filter === 'attention'}
              onClick={() => setFilter('attention')}
            >
              Da controllare
            </button>
          </fieldset>
        </header>
        <PlayerList players={players} referenceDate={model.generatedAt} />
      </section>
    </div>
  );
}
