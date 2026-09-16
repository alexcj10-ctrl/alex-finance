import type { MouseEvent } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CoachPlayerSummary } from '../../types/coach';
import { formatNumber, formatRelativeDate } from '../lib/format';
import { navigateCoach } from '../routes';
import { CoachProgress } from './CoachProgress';

function playerPath(playerId: string) {
  return `/coach/giocatori/${encodeURIComponent(playerId)}`;
}

function handlePlayerLink(event: MouseEvent<HTMLAnchorElement>, playerId: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateCoach(playerPath(playerId));
}

function PlayerIdentity({ player }: { player: CoachPlayerSummary }) {
  return (
    <span className="coach-player-identity">
      <Avatar className="coach-player-avatar" size="lg">
        <AvatarFallback>{player.initials}</AvatarFallback>
      </Avatar>
      <span>
        <strong>{player.displayName}</strong>
        <small>
          {player.playerCode
            ? `Codice ${player.playerCode}`
            : `ID ${player.playerId.replace('mock-player-', '#')}`}
        </small>
      </span>
    </span>
  );
}

function AttentionBadge({ count }: { count: number }) {
  return count > 0 ? (
    <span className="coach-attention-badge">
      <AlertTriangle className="size-3.5" aria-hidden="true" /> Da controllare
    </span>
  ) : (
    <span className="coach-regular-badge">Regolare</span>
  );
}

export function PlayerList({
  players,
  referenceDate,
}: {
  players: readonly CoachPlayerSummary[];
  referenceDate: string;
}) {
  if (players.length === 0) {
    return (
      <div className="coach-empty-state">
        <strong>Nessun giocatore in questo filtro</strong>
        <span>Prova a visualizzare tutta la squadra.</span>
      </div>
    );
  }

  return (
    <>
      <div className="coach-player-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Giocatore</TableHead>
              <TableHead scope="col">Progresso</TableHead>
              <TableHead scope="col">Lezioni</TableHead>
              <TableHead scope="col">Punti</TableHead>
              <TableHead scope="col">Ultimo utilizzo</TableHead>
              <TableHead scope="col">Stato</TableHead>
              <TableHead scope="col"><span className="sr-only">Apri</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player) => (
              <TableRow key={player.playerId}>
                <TableCell><PlayerIdentity player={player} /></TableCell>
                <TableCell className="coach-progress-cell">
                  <CoachProgress value={player.progressPercent} />
                </TableCell>
                <TableCell>{player.completedLessons} / {player.assignedLessons}</TableCell>
                <TableCell><strong>{formatNumber(player.points)}</strong></TableCell>
                <TableCell>{formatRelativeDate(player.lastActivityAt, referenceDate)}</TableCell>
                <TableCell><AttentionBadge count={player.attention.length} /></TableCell>
                <TableCell>
                  <a
                    className="coach-icon-link"
                    href={playerPath(player.playerId)}
                    aria-label={`Apri la scheda di ${player.displayName}`}
                    onClick={(event) => handlePlayerLink(event, player.playerId)}
                  >
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="coach-player-cards">
        {players.map((player) => (
          <article key={player.playerId} className="coach-player-card">
            <header>
              <PlayerIdentity player={player} />
              <AttentionBadge count={player.attention.length} />
            </header>
            <CoachProgress value={player.progressPercent} label="Progresso" />
            <dl className="coach-card-stats">
              <div><dt>Lezioni</dt><dd>{player.completedLessons} / {player.assignedLessons}</dd></div>
              <div><dt>Punti</dt><dd>{formatNumber(player.points)}</dd></div>
              <div><dt>Ultimo utilizzo</dt><dd>{formatRelativeDate(player.lastActivityAt, referenceDate)}</dd></div>
            </dl>
            <a
              className="coach-card-link"
              href={playerPath(player.playerId)}
              onClick={(event) => handlePlayerLink(event, player.playerId)}
            >
              Apri scheda <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
    </>
  );
}
