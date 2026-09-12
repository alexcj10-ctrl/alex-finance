/* oxlint-disable next/no-img-element -- Vite serve lo stemma locale. */
import { useState, type SyntheticEvent } from 'react';
import { Eye, EyeOff, LoaderCircle, LockKeyhole, LogIn, UserRound } from 'lucide-react';

import { useAuth } from './AuthProvider';

export function LoginPage({ message }: { message?: string }) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(message);

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
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
          <p>Il tuo percorso tattico</p>
          <h1 id="login-title">Accedi</h1>
          <span>Usa il codice della squadra oppure l’email Coach.</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Codice giocatore o email Coach</span>
            <span className="auth-input-wrap">
              <UserRound className="size-5" aria-hidden="true" />
              <input
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="ESOROSSI01 oppure coach@email.it"
                required
              />
            </span>
          </label>

          <label>
            <span>PIN o password</span>
            <span className="auth-input-wrap">
              <LockKeyhole className="size-5" aria-hidden="true" />
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                inputMode={identifier.includes('@') ? 'text' : 'numeric'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="auth-reveal"
                aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
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

        <p className="auth-help">Il codice e il PIN vengono consegnati dal tuo allenatore.</p>
      </section>
    </main>
  );
}
