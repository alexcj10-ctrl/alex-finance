/* oxlint-disable next/no-img-element -- Vite serve lo stemma locale. */
/* oxlint-disable jsx-a11y/autocomplete-valid -- given-name e family-name sono token HTML standard. */
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  Mail,
  UserPlus,
  UserRound,
} from 'lucide-react';

import { useAuth } from './AuthProvider';

type LoginMode = 'player' | 'signup' | 'coach';

export function LoginPage({ message }: { message?: string }) {
  const { createPlayerProfile, login } = useAuth();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [mode, setMode] = useState<LoginMode>('player');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(message);

  useEffect(() => {
    titleRef.current?.focus();
  }, [mode]);

  const changeMode = (nextMode: LoginMode) => {
    if (submitting) return;
    setMode(nextMode);
    setIdentifier('');
    setPassword('');
    setShowPassword(false);
    setError(undefined);
  };

  const handleLogin = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      await login({ identifier, password });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Credenziali non valide.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      await createPlayerProfile({ firstName, lastName });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Creazione del profilo non riuscita.',
      );
      setSubmitting(false);
    }
  };

  const isCoach = mode === 'coach';

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="login-title">
        <header className="auth-brand">
          <img src="/images/poggio-mirteto-logo.png" alt="Stemma del Poggio Mirteto Calcio" />
          <div>
            <span>Poggio Mirteto Calcio</span>
            <strong>ESORDIENTI ANALYST</strong>
          </div>
        </header>

        <div className="auth-copy">
          <p>{isCoach ? 'Area Coach' : 'Il tuo percorso tattico'}</p>
          <h1 id="login-title" ref={titleRef} tabIndex={-1}>
            {mode === 'signup' ? 'Crea il tuo profilo' : 'Accedi'}
          </h1>
          <span>
            {mode === 'signup'
              ? 'Inserisci soltanto il tuo nome e cognome.'
              : isCoach
                ? 'Usa l’email e la password del tuo account Coach.'
                : 'Usa il tuo codice giocatore e il PIN.'}
          </span>
        </div>

        {mode === 'signup' ? (
          <form className="auth-form" onSubmit={handleSignup}>
            <label>
              <span>Nome</span>
              <span className="auth-input-wrap">
                <UserRound className="size-5" aria-hidden="true" />
                <input
                  name="given-name"
                  autoComplete="given-name"
                  autoCapitalize="words"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  maxLength={40}
                  required
                />
              </span>
            </label>

            <label>
              <span>Cognome</span>
              <span className="auth-input-wrap">
                <UserRound className="size-5" aria-hidden="true" />
                <input
                  name="family-name"
                  autoComplete="family-name"
                  autoCapitalize="words"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  maxLength={40}
                  required
                />
              </span>
            </label>

            {error ? <p className="auth-error" role="alert">{error}</p> : null}

            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? (
                <><LoaderCircle className="size-5 auth-spinner" aria-hidden="true" /> Creazione…</>
              ) : (
                <><UserPlus className="size-5" aria-hidden="true" /> Entra nella squadra</>
              )}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              <span>{isCoach ? 'Email Coach' : 'Codice giocatore'}</span>
              <span className="auth-input-wrap">
                {isCoach
                  ? <Mail className="size-5" aria-hidden="true" />
                  : <UserRound className="size-5" aria-hidden="true" />}
                <input
                  name="username"
                  type={isCoach ? 'email' : 'text'}
                  inputMode={isCoach ? 'email' : 'text'}
                  autoComplete="username"
                  autoCapitalize={isCoach ? 'none' : 'characters'}
                  spellCheck={false}
                  value={identifier}
                  onChange={(event) => setIdentifier(
                    isCoach
                      ? event.target.value
                      : event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                  )}
                  maxLength={isCoach ? 254 : 20}
                  placeholder={isCoach ? 'coach@email.it' : 'Es. ALECANO47'}
                  required
                />
              </span>
            </label>

            <label>
              <span>{isCoach ? 'Password' : 'PIN'}</span>
              <span className="auth-input-wrap">
                <LockKeyhole className="size-5" aria-hidden="true" />
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  inputMode={isCoach ? 'text' : 'numeric'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(
                    isCoach
                      ? event.target.value
                      : event.target.value.replace(/\D/g, '').slice(0, 8),
                  )}
                  minLength={isCoach ? undefined : 4}
                  maxLength={isCoach ? undefined : 8}
                  pattern={isCoach ? undefined : '[0-9]{4,8}'}
                  required
                />
                <button
                  type="button"
                  className="auth-reveal"
                  aria-label={showPassword
                    ? `Nascondi ${isCoach ? 'password' : 'PIN'}`
                    : `Mostra ${isCoach ? 'password' : 'PIN'}`}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </span>
            </label>

            {error ? <p className="auth-error" role="alert">{error}</p> : null}

            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? (
                <><LoaderCircle className="size-5 auth-spinner" aria-hidden="true" /> Accesso…</>
              ) : (
                <><LogIn className="size-5" aria-hidden="true" /> Entra</>
              )}
            </button>
          </form>
        )}

        {mode === 'player' ? (
          <div className="auth-entry-actions">
            <div className="auth-signup-prompt">
              <span>È la prima volta?</span>
              <button
                type="button"
                className="auth-secondary"
                disabled={submitting}
                onClick={() => changeMode('signup')}
              >
                <UserPlus className="size-5" aria-hidden="true" /> Crea il tuo profilo
              </button>
            </div>
            <button
              type="button"
              className="auth-text-button"
              disabled={submitting}
              onClick={() => changeMode('coach')}
            >
              Sei un Coach? Accedi
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="auth-text-button"
            disabled={submitting}
            onClick={() => changeMode('player')}
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Torna all’accesso giocatore
          </button>
        )}
      </section>
    </main>
  );
}
