import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import { CheckCircle2, Clock3, LoaderCircle, LockKeyhole, Plus, UserRoundPlus, X } from 'lucide-react';

import {
  createPlayerAccount,
  getPlayerSignupWindow,
  setPlayerSignupWindow,
  type PlayerSignupWindow,
} from '../../services/supabase/supabase-coach-actions';
import type { CoachReadModel } from '../../types/coach';
import { CoachPageHeader } from '../components/CoachPageHeader';
import { PlayerList } from '../components/PlayerList';

type PlayerFilter = 'all' | 'attention';

export function CoachPlayersPage({
  model,
  onDataChanged,
}: {
  model: CoachReadModel;
  onDataChanged: () => void;
}) {
  const [filter, setFilter] = useState<PlayerFilter>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [playerCode, setPlayerCode] = useState('');
  const [pin, setPin] = useState('');
  const [createStatus, setCreateStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [createError, setCreateError] = useState<string>();
  const [signupWindow, setSignupWindow] = useState<PlayerSignupWindow>();
  const [signupWindowStatus, setSignupWindowStatus] = useState<'loading' | 'idle' | 'updating'>('loading');
  const [signupWindowError, setSignupWindowError] = useState<string>();
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

  useEffect(() => {
    let cancelled = false;
    void getPlayerSignupWindow(model.team.id).then(
      (windowState) => {
        if (cancelled) return;
        setSignupWindow(windowState);
        setSignupWindowError(undefined);
        setSignupWindowStatus('idle');
      },
      (error: unknown) => {
        if (cancelled) return;
        setSignupWindowError(
          error instanceof Error ? error.message : 'Stato registrazioni non disponibile.',
        );
        setSignupWindowStatus('idle');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [model.team.id]);

  useEffect(() => {
    if (!signupWindow?.isOpen || !signupWindow.closesAt) return;
    const closesIn = new Date(signupWindow.closesAt).getTime() - Date.now();
    const timeout = window.setTimeout(() => {
      setSignupWindow((current) => current
        ? { ...current, closesAt: null, isOpen: false, remainingSignups: 0 }
        : current);
    }, Math.max(0, closesIn) + 100);

    return () => window.clearTimeout(timeout);
  }, [signupWindow?.closesAt, signupWindow?.isOpen]);

  const updateSignupWindow = async (open: boolean) => {
    setSignupWindowStatus('updating');
    setSignupWindowError(undefined);
    try {
      setSignupWindow(await setPlayerSignupWindow(model.team.id, open));
    } catch (error) {
      setSignupWindowError(
        error instanceof Error ? error.message : 'Aggiornamento registrazioni non riuscito.',
      );
    } finally {
      setSignupWindowStatus('idle');
    }
  };

  const signupClosesAt = signupWindow?.closesAt
    ? new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' })
      .format(new Date(signupWindow.closesAt))
    : undefined;

  const submitPlayer = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateStatus('submitting');
    setCreateError(undefined);
    try {
      await createPlayerAccount({
        displayName,
        playerCode,
        pin,
        teamId: model.team.id,
      });
      setCreateStatus('success');
      setDisplayName('');
      setPlayerCode('');
      setPin('');
      onDataChanged();
    } catch (error) {
      setCreateStatus('idle');
      setCreateError(
        error instanceof Error ? error.message : 'Creazione giocatore non riuscita.',
      );
    }
  };

  return (
    <div className="coach-page">
      <CoachPageHeader
        eyebrow="Squadra"
        title="Giocatori"
        description="Progressi, attività e lezioni completate in un’unica vista."
        action={(
          <button
            type="button"
            className="coach-primary-action"
            onClick={() => {
              setShowCreate((current) => !current);
              setCreateStatus('idle');
              setCreateError(undefined);
            }}
          >
            {showCreate ? <X className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {showCreate ? 'Chiudi' : 'Nuovo giocatore'}
          </button>
        )}
      />

      <section
        className={signupWindow?.isOpen ? 'coach-signup-window coach-signup-window-open' : 'coach-signup-window'}
        aria-labelledby="signup-window-title"
      >
        <div className="coach-signup-window-copy">
          <span className="coach-signup-window-icon" aria-hidden="true">
            {signupWindow?.isOpen ? <UserRoundPlus className="size-5" /> : <LockKeyhole className="size-5" />}
          </span>
          <div>
            <p className="coach-create-kicker">Registrazione autonoma</p>
            <h2 id="signup-window-title">
              {signupWindow?.isOpen ? 'Registrazioni aperte' : 'Registrazioni chiuse'}
            </h2>
            <p>
              {signupWindow?.isOpen
                ? `I ragazzi possono registrarsi con solo Nome e Cognome${signupClosesAt ? ` fino alle ${signupClosesAt}` : ''}. Restano ${signupWindow.remainingSignups} posti.`
                : 'Apri una finestra di 30 minuti quando la squadra è insieme.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="coach-signup-window-action"
          disabled={signupWindowStatus !== 'idle'}
          onClick={() => void updateSignupWindow(!signupWindow?.isOpen)}
        >
          {signupWindowStatus !== 'idle' ? (
            <LoaderCircle className="size-4 coach-loading-icon" aria-hidden="true" />
          ) : signupWindow?.isOpen ? (
            <LockKeyhole className="size-4" aria-hidden="true" />
          ) : (
            <Clock3 className="size-4" aria-hidden="true" />
          )}
          {signupWindowStatus === 'loading'
            ? 'Controllo…'
            : signupWindowStatus === 'updating'
              ? 'Aggiornamento…'
              : signupWindow?.isOpen
                ? 'Chiudi ora'
                : 'Apri per 30 minuti'}
        </button>
        {signupWindowError ? (
          <p className="coach-create-error coach-signup-window-error" role="alert">
            {signupWindowError}
          </p>
        ) : null}
      </section>

      {showCreate ? (
        <section className="coach-create-panel" aria-labelledby="create-player-title">
          <div>
            <p className="coach-create-kicker">Account Player</p>
            <h2 id="create-player-title">Crea un accesso giocatore</h2>
            <p>Il ragazzo entrerà con codice e PIN. La password tecnica resta gestita dal server.</p>
          </div>
          <form onSubmit={(event) => void submitPlayer(event)}>
            <label>
              <span>Nome visualizzato</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={50}
                placeholder="Es. Leo"
                autoComplete="off"
                required
              />
            </label>
            <label>
              <span>Codice giocatore</span>
              <input
                value={playerCode}
                onChange={(event) => setPlayerCode(
                  event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                )}
                minLength={4}
                maxLength={20}
                placeholder="ESOLEO01"
                autoCapitalize="characters"
                autoComplete="off"
                required
              />
            </label>
            <label>
              <span>PIN (4–8 cifre)</span>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
                pattern="[0-9]{4,8}"
                minLength={4}
                maxLength={8}
                autoComplete="new-password"
                required
              />
            </label>
            <button type="submit" disabled={createStatus === 'submitting'}>
              {createStatus === 'submitting'
                ? <><LoaderCircle className="size-4 coach-loading-icon" aria-hidden="true" /> Creazione…</>
                : 'Crea account'}
            </button>
          </form>
          {createStatus === 'success' ? (
            <output className="coach-create-success">
              <CheckCircle2 className="size-4" aria-hidden="true" /> Account creato e collegato alla squadra.
            </output>
          ) : null}
          {createError ? <p className="coach-create-error" role="alert">{createError}</p> : null}
        </section>
      ) : null}

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
