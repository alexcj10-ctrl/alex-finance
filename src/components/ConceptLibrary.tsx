import { CheckCircle2, Lock, Sparkles } from 'lucide-react';

const concepts = [
  {
    name: 'Ampiezza',
    phase: 'Costruzione',
    description: 'Usare tutta la larghezza del campo per creare spazio e linee di passaggio.',
    unlocked: true,
  },
  {
    name: 'Linea di passaggio',
    phase: 'Costruzione',
    description: 'Farsi vedere dal compagno lasciando libero il percorso tra palla e ricevente.',
    unlocked: true,
  },
  {
    name: 'Sostegno diagonale',
    phase: 'Costruzione',
    description: 'Aiutare il portatore da una posizione utile per continuare l’azione.',
    unlocked: false,
  },
  {
    name: 'Terzo uomo',
    phase: 'Progressione',
    description: 'Usare un compagno per liberarne un altro già orientato in avanti.',
    unlocked: false,
  },
  {
    name: 'Cambio corridoio',
    phase: 'Progressione',
    description: 'Spostare il gioco verso una zona con più spazio.',
    unlocked: false,
  },
  {
    name: 'Attacco dell’area',
    phase: 'Finalizzazione',
    description: 'Entrare in zone diverse davanti alla porta con tempi coordinati.',
    unlocked: false,
  },
] as const;

export function ConceptLibrary() {
  return (
    <div className="library-view view-shell">
      <header className="view-heading">
        <div>
          <p className="section-kicker text-primary">Conoscere per scegliere</p>
          <h1>Biblioteca</h1>
          <p>
            I concetti che incontri nelle lezioni. Questa prima versione usa sblocchi dimostrativi,
            senza account o salvataggio.
          </p>
        </div>
        <span className="demo-data-label">Dati demo</span>
      </header>

      <section className="library-summary" aria-label="Stato della biblioteca">
        <span className="library-summary-icon" aria-hidden="true">
          <Sparkles className="size-5" />
        </span>
        <div>
          <strong>2 concetti sbloccati</strong>
          <p>Completa le prossime lezioni per esplorare il resto della mappa.</p>
        </div>
      </section>

      <section className="library-grid" aria-label="Concetti didattici">
        {concepts.map((concept) => (
          <article
            key={concept.name}
            className={concept.unlocked ? 'library-card library-card-unlocked' : 'library-card'}
          >
            <div className="library-card-topline">
              <span>{concept.phase}</span>
              {concept.unlocked ? (
                <CheckCircle2 className="size-5" aria-label="Sbloccato" />
              ) : (
                <Lock className="size-4" aria-label="Bloccato" />
              )}
            </div>
            <h2>{concept.name}</h2>
            <p>{concept.description}</p>
            <span className="library-status">
              {concept.unlocked ? 'Concetto sbloccato' : 'Da scoprire'}
            </span>
          </article>
        ))}
      </section>
    </div>
  );
}
