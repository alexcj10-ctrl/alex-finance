/* oxlint-disable next/no-img-element -- Vite serve lo stemma locale. */
import { useEffect, useRef } from 'react';
import { ArrowRight, CheckCircle2, LoaderCircle } from 'lucide-react';

import type { PlayerCreatedCredentials } from './auth-types';

export function PlayerProfileCreatedPage({
  connecting,
  credentials,
  message,
  onContinue,
}: {
  connecting: boolean;
  credentials: PlayerCreatedCredentials;
  message?: string;
  onContinue: () => Promise<void>;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <main className="auth-screen">
      <section
        className="auth-card auth-created-card"
        aria-labelledby="profile-created-title"
        aria-live="polite"
      >
        <header className="auth-brand">
          <img src="/images/poggio-mirteto-logo.png" alt="Stemma del Poggio Mirteto Calcio" />
          <div>
            <span>Poggio Mirteto Calcio</span>
            <strong>ESORDIENTI ANALYST</strong>
          </div>
        </header>

        <div className="auth-created-heading">
          <span className="auth-created-icon" aria-hidden="true">
            <CheckCircle2 className="size-7" />
          </span>
          <div>
            <p>Benvenuto in squadra</p>
            <h1 id="profile-created-title" ref={titleRef} tabIndex={-1}>Profilo creato!</h1>
            <strong>{credentials.displayName}</strong>
          </div>
        </div>

        <dl className="auth-credentials" aria-label="Credenziali giocatore">
          <div>
            <dt>Codice</dt>
            <dd>{credentials.playerCode}</dd>
          </div>
          <div>
            <dt>PIN</dt>
            <dd>{credentials.pin}</dd>
          </div>
        </dl>

        <p className="auth-created-note">
          Conservali per entrare da un altro dispositivo.
        </p>

        {message ? <output className="auth-error">{message}</output> : null}

        <button
          type="button"
          className="auth-submit"
          disabled={connecting}
          onClick={() => void onContinue()}
        >
          {connecting ? (
            <><LoaderCircle className="size-5 auth-spinner" aria-hidden="true" /> Prepariamo l’accesso…</>
          ) : (
            <>Continua <ArrowRight className="size-5" aria-hidden="true" /></>
          )}
        </button>
      </section>
    </main>
  );
}
