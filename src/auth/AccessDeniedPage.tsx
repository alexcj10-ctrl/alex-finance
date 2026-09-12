import { ArrowLeft, ShieldX } from 'lucide-react';

export function AccessDeniedPage({ onReturn }: { onReturn: () => void }) {
  return (
    <main className="auth-screen">
      <section className="auth-card auth-state-card" role="alert">
        <span className="auth-state-icon" aria-hidden="true"><ShieldX className="size-8" /></span>
        <p>Area riservata</p>
        <h1>Accesso Coach non consentito</h1>
        <span>Il tuo account giocatore può usare soltanto il percorso didattico personale.</span>
        <button type="button" className="auth-submit" onClick={onReturn}>
          <ArrowLeft className="size-5" aria-hidden="true" /> Torna alla tua Home
        </button>
      </section>
    </main>
  );
}
