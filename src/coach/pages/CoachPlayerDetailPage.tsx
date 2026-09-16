/* oxlint-disable next/no-html-link-for-pages -- App Vite con routing History API. */
import type { MouseEvent } from 'react';
import { ArrowLeft, BookOpen, PlayCircle, Star, Trophy } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import {
  macroPhaseLabels,
  phaseLabels,
  phaseOrderByMacro,
} from '../../data/lessons';
import type { CoachPlayerDetail } from '../../types/coach';
import { AttentionList } from '../components/AttentionList';
import { CoachPageHeader, DemoDataBadge } from '../components/CoachPageHeader';
import { CoachProgress } from '../components/CoachProgress';
import { StatusBadge } from '../components/StatusBadge';
import { formatNumber, formatRelativeDate } from '../lib/format';
import { navigateCoach } from '../routes';

function handleBack(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateCoach('/coach/giocatori');
}

export function CoachPlayerDetailPage({
  detail,
  referenceDate,
  showDemoBadge,
}: {
  detail: CoachPlayerDetail;
  referenceDate: string;
  showDemoBadge: boolean;
}) {
  const { summary } = detail;

  return (
    <div className="coach-page coach-player-detail-page">
      <a className="coach-back-link" href="/coach/giocatori" onClick={handleBack}>
        <ArrowLeft className="size-4" aria-hidden="true" /> Torna ai giocatori
      </a>

      <CoachPageHeader
        eyebrow="Scheda giocatore"
        title={summary.displayName}
        description="Attività, avanzamento didattico e risultati osservabili."
        action={showDemoBadge ? <DemoDataBadge /> : undefined}
      />

      <section className="coach-player-hero" aria-label={`Riepilogo di ${summary.displayName}`}>
        <div className="coach-player-hero-identity">
          <Avatar className="coach-player-hero-avatar">
            <AvatarFallback>{summary.initials}</AvatarFallback>
          </Avatar>
          <div>
            <strong>{summary.displayName}</strong>
            <span>
              {summary.playerCode ? `Codice ${summary.playerCode}` : 'Profilo interno'}
              {' · nessun dato personale aggiuntivo'}
            </span>
          </div>
        </div>
        <div className="coach-player-hero-progress">
          <CoachProgress value={summary.progressPercent} label="Progresso generale" />
        </div>
      </section>

      <div className="coach-player-stats">
        <Card><CardContent><span><BookOpen className="size-4" aria-hidden="true" /> Lezioni</span><strong>{summary.completedLessons} / {summary.assignedLessons}</strong></CardContent></Card>
        <Card><CardContent><span><Star className="size-4" aria-hidden="true" /> Punti</span><strong>{formatNumber(summary.points)}</strong></CardContent></Card>
        <Card><CardContent><span><Trophy className="size-4" aria-hidden="true" /> Trofei</span><strong>{summary.trophyCount}</strong></CardContent></Card>
        <Card><CardContent><span>Ultima attività</span><strong>{formatRelativeDate(summary.lastActivityAt, referenceDate)}</strong></CardContent></Card>
      </div>

      {summary.attention.length > 0 ? (
        <section className="coach-detail-section" aria-labelledby="player-attention-title">
          <header className="coach-section-header">
            <div><p className="coach-eyebrow">Evidenze</p><h2 id="player-attention-title">Da controllare</h2></div>
            <span className="coach-count-badge">{summary.attention.length}</span>
          </header>
          <AttentionList
            items={summary.attention}
            referenceDate={referenceDate}
            showLinks={false}
          />
        </section>
      ) : null}

      <section className="coach-detail-section" aria-labelledby="phase-progress-title">
        <header className="coach-section-header">
          <div><p className="coach-eyebrow">Percorso</p><h2 id="phase-progress-title">Progresso per area</h2></div>
        </header>
        <div className="coach-phase-groups">
          {(['possesso', 'non_possesso'] as const).map((macroPhase) => (
            <article className="coach-phase-group" key={macroPhase}>
              <header><strong>{macroPhaseLabels[macroPhase]}</strong><span>{macroPhase === 'possesso' ? 'Gestione della palla' : 'Organizzazione senza palla'}</span></header>
              <div>
                {phaseOrderByMacro[macroPhase].map((phase) => {
                  const phaseProgress = detail.phaseProgress.find((item) => item.phase === phase);
                  return (
                    <div className="coach-phase-row" key={phase}>
                      <span>{phaseLabels[phase]}</span>
                      {phaseProgress?.availableLessons ? (
                        <CoachProgress value={phaseProgress.averageProgressPercent ?? 0} />
                      ) : (
                        <small>Nessuna lezione disponibile</small>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="coach-detail-section" aria-labelledby="player-lessons-title">
        <header className="coach-section-header">
          <div><p className="coach-eyebrow">Dettaglio</p><h2 id="player-lessons-title">Lezioni assegnate</h2></div>
        </header>
        <div className="coach-player-lessons">
          {detail.lessons.length === 0 ? (
            <div className="coach-empty-state">
              <strong>Nessuna lezione assegnata</strong>
              <span>Il percorso del giocatore non contiene ancora attività.</span>
            </div>
          ) : detail.lessons.map((item) => (
            <article className="coach-player-lesson" key={item.lesson.id}>
              <header>
                <div><span>{phaseLabels[item.lesson.fase]}</span><h3>{item.lesson.titolo}</h3></div>
                <StatusBadge status={item.progress.status} />
              </header>
              <CoachProgress value={item.progress.progressPercent} label="Avanzamento lezione" />
              <div className="coach-lesson-evidence-grid">
                <div>
                  <span className="coach-evidence-label"><PlayCircle className="size-4" aria-hidden="true" /> Video visto</span>
                  <strong>{item.maxWatchedPercent}%</strong>
                  <small>
                    {item.lesson.variantiVideo.map((variant) => {
                      const progress = item.videos.find((video) => video.variantId === variant.id);
                      return `${variant.etichetta.replace('Variante ', '')} ${progress?.watchedPercent ?? 0}%`;
                    }).join(' · ')}
                  </small>
                </div>
                <div>
                  <span className="coach-evidence-label">Quiz</span>
                  {item.latestQuizAttempt ? (
                    <>
                      <strong>{Math.round(item.latestQuizAttempt.score)}%</strong>
                      <small>{item.latestQuizAttempt.correctAnswers} / {item.latestQuizAttempt.totalQuestions} corrette · {item.quizAttempts} {item.quizAttempts === 1 ? 'tentativo' : 'tentativi'}</small>
                    </>
                  ) : (
                    <><strong>—</strong><small>Nessun tentativo</small></>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
