import type { MouseEvent } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

import type { AttentionItem } from '../../types/coach';
import { formatRelativeDate } from '../lib/format';
import { navigateCoach } from '../routes';

function openPlayer(event: MouseEvent<HTMLAnchorElement>, playerId: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateCoach(`/coach/giocatori/${encodeURIComponent(playerId)}`);
}

export function AttentionList({
  items,
  referenceDate,
  compact = false,
  showLinks = true,
}: {
  items: readonly AttentionItem[];
  referenceDate: string;
  compact?: boolean;
  showLinks?: boolean;
}) {
  const visibleItems = compact
    ? items.filter((item, index) => items.findIndex((candidate) => candidate.playerId === item.playerId) === index).slice(0, 5)
    : items;

  if (visibleItems.length === 0) {
    return (
      <div className="coach-empty-state">
        <strong>Nessuna situazione urgente</strong>
        <span>Il percorso della squadra è regolare.</span>
      </div>
    );
  }

  return (
    <div className="coach-attention-list">
      {visibleItems.map((item) => (
        <article key={item.id} className={`coach-attention-item coach-attention-${item.severity}`}>
          <span className="coach-attention-icon" aria-hidden="true">
            <AlertTriangle className="size-5" />
          </span>
          <div className="coach-attention-copy">
            <div className="coach-attention-topline">
              <strong>{item.title}</strong>
              <span>{formatRelativeDate(item.occurredAt, referenceDate)}</span>
            </div>
            <p>{item.detail}</p>
          </div>
          {showLinks ? (
            <a
              className="coach-inline-link"
              href={`/coach/giocatori/${encodeURIComponent(item.playerId)}`}
              onClick={(event) => openPlayer(event, item.playerId)}
            >
              Apri scheda <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}
