/* oxlint-disable next/no-img-element -- Vite serve lo stemma locale. */
import { useState, type SyntheticEvent } from 'react';
import { Check, Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react';

import { useAuth } from './AuthProvider';

export function PasswordSetupPage() {
  const { setNewPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmation) {
      setError('Le due password non coincidono.');
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      await setNewPassword(password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossibile impostare la password.');
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="password-setup-title">
        <header className="auth-brand">
          <img src="/images/poggio-mirteto-logo.png" alt="Stemma del Poggio Mirteto Calcio" />
          <div>
            <span>Poggio Mirteto Calcio</span>
            <strong>ESORDIENTI ANALYST</strong>
          </div>
        </header>

        <div className="auth-copy">
          <p>Area Coach</p>
          <h1 id="password-setup-title">Crea la tua password</h1>
          <span>Completa l’attivazione dell’account scegliendo una password personale.</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Nuova password</span>
            <span className="auth-input-wrap">
              <LockKeyhole className="size-5" aria-hidden="true" />
              <input
                name="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="password-requirements"
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

          <label>
            <span>Conferma password</span>
            <span className="auth-input-wrap">
              <Check className="size-5" aria-hidden="true" />
              <input
                name="confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </span>
          </label>

          <p id="password-requirements" className="auth-help auth-password-requirements">
            Almeno 8 caratteri, con maiuscola, minuscola e numero.
          </p>

          {error ? <p className="auth-error" role="alert">{error}</p> : null}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? (
              <><LoaderCircle className="size-5 auth-spinner" aria-hidden="true" /> Salvataggio…</>
            ) : (
              <><Check className="size-5" aria-hidden="true" /> Imposta password</>
            )}
          </button>
        </form>
      </section>
    </main>
  );
}
