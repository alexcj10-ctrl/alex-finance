import {
  ArrowLeftRight,
  CheckCircle2,
  Lock,
  Maximize2,
  MoveUpRight,
  Route,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

const concepts = [
  {
    name: 'Ampiezza',
    phase: 'Costruzione',
    description: 'Usare tutta la larghezza del campo per creare spazio e linee di passaggio.',
    unlocked: true,
    icon: Maximize2,
    tone: 'lime',
  },
  {
    name: 'Linea di passaggio',
    phase: 'Costruzione',
    description: 'Farsi vedere dal compagno lasciando libero il percorso tra palla e ricevente.',
    unlocked: true,
    icon: Route,
    tone: 'blue',
  },
  {
    name: 'Sostegno diagonale',
    phase: 'Costruzione',
    description: 'Aiutare il portatore da una posizione utile per continuare l’azione.',
    unlocked: false,
    icon: MoveUpRight,
    tone: 'green',
  },
  {
    name: 'Terzo uomo',
    phase: 'Progressione',
    description: 'Usare un compagno per liberarne un altro già orientato in avanti.',
    unlocked: false,
    icon: Users,
    tone: 'orange',
  },
  {
    name: 'Cambio corridoio',
    phase: 'Progressione',
    description: 'Spostare il gioco verso una zona con più spazio.',
    unlocked: false,
    icon: ArrowLeftRight,
    tone: 'blue',
  },
  {
    name: 'Attacco dell’area',
    phase: 'Finalizzazione',
    description: 'Entrare in zone diverse davanti alla porta con tempi coordinati.',
    unlocked: false,
    icon: Target,
    tone: 'orange',
  },
] as const;

export function ConceptLibrary() {
  return (
    <div className="library-view view-shell">
      <header className="view-heading">
        <div>
          <p className="section-kicker">La tua collezione</p>
          <h1>Biblioteca</h1>
          <p>I concetti che hai incontrato in campo.</p>
        </div>
        <span className="demo-data-label">Demo</span>
      </header>

      <section className="library-summary" aria-label="Stato della biblioteca">
        <span className="library-summary-icon" aria-hidden="true">
          <Sparkles className="size-5" />
        </span>
        <div>
          <strong>2 concetti sbloccati</strong>
          <p>Continua ad allenarti per scoprirne altri.</p>
        </div>
      </section>

      <section className="library-grid" aria-label="Concetti didattici">
        {concepts.map((concept) => (
          <article
            key={concept.name}
            className={
              concept.unlocked
                ? `library-card library-card-unlocked library-card-${concept.tone}`
                : `library-card library-card-${concept.tone}`
            }
          >
            <div className="library-card-topline">
              <span>{concept.phase}</span>
              {concept.unlocked ? (
                <CheckCircle2 className="size-5" aria-label="Sbloccato" />
              ) : (
                <Lock className="size-4" aria-label="Bloccato" />
              )}
            </div>
            <span className="library-card-icon" aria-hidden="true">
              <concept.icon className="size-6" />
            </span>
            <h2>{concept.name}</h2>
            {concept.unlocked ? <p>{concept.description}</p> : null}
            <span className="library-status">
              {concept.unlocked ? 'Sbloccato' : 'Da scoprire'}
            </span>
          </article>
        ))}
      </section>
    </div>
  );
}
