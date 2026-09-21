/* oxlint-disable next/no-html-link-for-pages -- App Vite con routing History API. */
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import {
  ArrowLeft,
  BookOpen,
  KeyRound,
  LoaderCircle,
  PlayCircle,
  ShieldCheck,
  Star,
  Trash2,
  Trophy,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  macroPhaseLabels,
  phaseLabels,
  phaseOrderByMacro,
} from '../../data/lessons';
import {
  deletePlayerAccount,
  regeneratePlayerPin,
  type PlayerPinReceipt,
} from '../../services/supabase/supabase-coach-actions';
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
  teamId,
}: {
  detail: CoachPlayerDetail;
  referenceDate: string;
  showDemoBadge: boolean;
  teamId: string;
}) {
  const { summary } = detail;
  const [confirmPinReset, setConfirmPinReset] = useState(false);
  const [pinResetStatus, setPinResetStatus] = useState<'idle' | 'submitting'>('idle');
  const [pinResetError, setPinResetError] = useState<string>();
  const [pinReceipt, setPinReceipt] = useState<PlayerPinReceipt>();
  const [confirmPlayerDelete, setConfirmPlayerDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'submitting'>('idle');
  const [deleteError, setDeleteError] = useState<string>();
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pinReceipt) receiptRef.current?.focus();
  }, [pinReceipt]);

  const resetPlayerPin = async () => {
    setPinResetStatus('submitting');
    setPinResetError(undefined);

    try {
      const receipt = await regeneratePlayerPin(teamId, summary.playerId);
      setPinReceipt(receipt);
      setConfirmPinReset(false);
    } catch (error) {
      setPinResetError(
        error instanceof Error ? error.message : 'Rigenerazione del PIN non riuscita.',
      );
      setConfirmPinReset(false);
    } finally {
      setPinResetStatus('idle');
    }
  };

  const deletePlayer = async () => {
    setDeleteStatus('submitting');
    setDeleteError(undefined);

    try {
      await deletePlayerAccount(teamId, summary.playerId, deleteConfirmation);
      window.location.replace('/coach/giocatori');
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Eliminazione del giocatore non riuscita.',
      );
      setDeleteStatus('idle');
    }
  };

  const deleteConfirmationMatches =
    deleteConfirmation.trim() === summary.displayName ||
    deleteConfirmation.trim() === 'ELIMINA';

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

      <section className="coach-pin-management" aria-labelledby="player-access-title">
        <div className="coach-pin-management-copy">
          <span className="coach-pin-management-icon" aria-hidden="true">
            <KeyRound className="size-5" />
          </span>
          <div>
            <p className="coach-eyebrow">Accesso giocatore</p>
            <h2 id="player-access-title">Codice e PIN</h2>
            <p>
              Se il giocatore perde il PIN, puoi generarne uno nuovo. Il PIN precedente
              smetterà subito di funzionare.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="coach-pin-reset-button"
          disabled={pinResetStatus === 'submitting'}
          onClick={() => {
            setPinResetError(undefined);
            setConfirmPinReset(true);
          }}
        >
          {pinResetStatus === 'submitting' ? (
            <LoaderCircle className="size-4 coach-loading-icon" aria-hidden="true" />
          ) : (
            <KeyRound className="size-4" aria-hidden="true" />
          )}
          Rigenera PIN
        </button>

        {pinResetError ? (
          <p className="coach-create-error coach-pin-management-message" role="alert">
            {pinResetError}
          </p>
        ) : null}

        {pinReceipt ? (
          <div
            ref={receiptRef}
            className="coach-pin-receipt"
            tabIndex={-1}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="coach-pin-receipt-heading">
              <ShieldCheck className="size-5" aria-hidden="true" />
              <div>
                <strong>Nuovo PIN creato</strong>
                <span>Consegnalo direttamente al giocatore.</span>
              </div>
            </div>
            <dl>
              <div><dt>Codice</dt><dd>{pinReceipt.playerCode}</dd></div>
              <div><dt>PIN</dt><dd>{pinReceipt.pin}</dd></div>
            </dl>
            <p>Queste credenziali vengono mostrate solo in questa schermata.</p>
            <button type="button" onClick={() => setPinReceipt(undefined)}>
              Ho consegnato le credenziali
            </button>
          </div>
        ) : null}
      </section>

      <AlertDialog
        open={confirmPinReset}
        onOpenChange={(open) => setConfirmPinReset(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia><KeyRound aria-hidden="true" /></AlertDialogMedia>
            <AlertDialogTitle>Rigenerare il PIN?</AlertDialogTitle>
            <AlertDialogDescription>
              Il PIN attuale di {summary.displayName} non funzionerà più. Il nuovo PIN
              comparirà una sola volta nella scheda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pinResetStatus === 'submitting'}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pinResetStatus === 'submitting'}
              onClick={() => void resetPlayerPin()}
            >
              {pinResetStatus === 'submitting' ? 'Rigenerazione…' : 'Rigenera PIN'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <section
        className="coach-pin-management coach-account-management"
        aria-labelledby="player-account-management-title"
      >
        <div className="coach-pin-management-copy">
          <span className="coach-pin-management-icon" aria-hidden="true">
            <Trash2 className="size-5" />
          </span>
          <div>
            <p className="coach-eyebrow">Gestione account</p>
            <h2 id="player-account-management-title">Elimina giocatore</h2>
            <p>
              Rimuove definitivamente account, accesso e tutti i progressi del giocatore.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="coach-delete-player-button"
          onClick={() => {
            setDeleteConfirmation('');
            setDeleteError(undefined);
            setConfirmPlayerDelete(true);
          }}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Elimina giocatore
        </button>
      </section>

      <AlertDialog
        open={confirmPlayerDelete}
        onOpenChange={(open) => {
          if (deleteStatus !== 'submitting') setConfirmPlayerDelete(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="coach-delete-dialog-media">
              <Trash2 aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>Eliminare definitivamente {summary.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              L’operazione è irreversibile: account, accesso, lezioni, video, quiz, punti
              e trofei verranno cancellati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="coach-delete-dialog-field">
            <label htmlFor="player-delete-confirmation">
              Digita <strong>{summary.displayName}</strong> oppure <strong>ELIMINA</strong>
            </label>
            <Input
              id="player-delete-confirmation"
              value={deleteConfirmation}
              disabled={deleteStatus === 'submitting'}
              autoComplete="off"
              aria-invalid={Boolean(deleteError)}
              onChange={(event) => {
                setDeleteConfirmation(event.target.value);
                setDeleteError(undefined);
              }}
            />
            {deleteError ? (
              <p className="coach-delete-dialog-error" role="alert">{deleteError}</p>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteStatus === 'submitting'}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!deleteConfirmationMatches || deleteStatus === 'submitting'}
              onClick={() => void deletePlayer()}
            >
              {deleteStatus === 'submitting' ? 'Eliminazione…' : 'Elimina definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
