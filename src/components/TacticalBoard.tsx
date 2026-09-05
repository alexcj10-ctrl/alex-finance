import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleDot,
  Crosshair,
  Gauge,
  Layers3,
  ShieldCheck,
  Sparkles,
  TimerReset,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { FormationId, PhaseId } from '../data/lessons';

type Player = {
  number: number;
  role: string;
  x: number;
  y: number;
};

const phases: Record<
  PhaseId,
  {
    step: string;
    label: string;
    eyebrow: string;
    title: string;
    description: string;
    objective: string;
    principles: string[];
    actions: string[];
    tempo: string;
    risk: string;
    zone: string;
    exercise: string;
    duration: string;
  }
> = {
  costruzione: {
    step: '01',
    label: 'Costruzione',
    eyebrow: 'Inizio azione',
    title: 'Creare l’uomo libero fin dal portiere',
    description:
      'Attirare la prima pressione, dare ampiezza alla linea e trovare il sostegno che può ricevere fronte alla porta avversaria.',
    objective:
      'Superare la prima linea di pressione mantenendo superiorità e distanze utili per proteggere la perdita.',
    principles: ['Portiere come +1', 'Ampiezza immediata', 'Sostegni diagonali'],
    actions: [
      'Aprire il campo prima della prima ricezione.',
      'Fissare un avversario prima di liberare il compagno.',
      'Orientare il controllo verso la giocata successiva.',
    ],
    tempo: 'Paziente → rapido',
    risk: 'Medio',
    zone: 'Primo terzo',
    exercise: '4 + portiere contro 3, uscita oltre la linea meta con un passaggio rasoterra.',
    duration: '18 min',
  },
  progressione: {
    step: '02',
    label: 'Progressione',
    eyebrow: 'Sviluppo',
    title: 'Entrare nello spazio che si apre',
    description:
      'Muovere il blocco avversario da un lato, riconoscere il corridoio libero e avanzare con tempi diversi tra palla e compagni.',
    objective:
      'Portare almeno tre giocatori oltre la linea della palla senza perdere equilibrio alle spalle dell’azione.',
    principles: ['Terzo uomo', 'Cambio corridoio', 'Smarcamento in avanti'],
    actions: [
      'Alternare appoggio corto e movimento alle spalle.',
      'Occupare ampiezza e corridoio interno su altezze diverse.',
      'Accelerare solo quando il ricevente è orientato in avanti.',
    ],
    tempo: 'Variabile',
    risk: 'Medio–alto',
    zone: 'Terzo centrale',
    exercise: '6 contro 5 in tre corridoi: punto doppio dopo un cambio lato e ingresso in conduzione.',
    duration: '20 min',
  },
  finalizzazione: {
    step: '03',
    label: 'Finalizzazione',
    eyebrow: 'Ultimo terzo',
    title: 'Riempire l’area con arrivi coordinati',
    description:
      'Attaccare porta, primo palo, secondo palo e zona di rifinitura senza portare tutti i giocatori sulla stessa linea.',
    objective:
      'Produrre una conclusione pulita e conservare una struttura pronta sulla seconda palla.',
    principles: ['Attacco della profondità', 'Altezze diverse', 'Presidio seconda palla'],
    actions: [
      'Il riferimento centrale libera o attacca lo spazio.',
      'L’esterno opposto chiude sul secondo palo.',
      'Un centrocampista resta a sostegno della respinta.',
    ],
    tempo: 'Rapido',
    risk: 'Controllato',
    zone: 'Ultimo terzo',
    exercise: '3 contro 2 + portiere: azione da corsia laterale e tre zone di arrivo obbligatorie.',
    duration: '16 min',
  },
};

const formations: Record<FormationId, { label: string; note: string; players: Player[] }> = {
  '1-3-2-3': {
    label: '1-3-2-3',
    note: 'Ampiezza alta e due riferimenti interni',
    players: [
      { number: 1, role: 'P', x: 50, y: 89 },
      { number: 2, role: 'DC', x: 24, y: 72 },
      { number: 5, role: 'DC', x: 50, y: 76 },
      { number: 3, role: 'DC', x: 76, y: 72 },
      { number: 4, role: 'C', x: 36, y: 51 },
      { number: 8, role: 'C', x: 64, y: 51 },
      { number: 7, role: 'A', x: 20, y: 25 },
      { number: 9, role: 'A', x: 50, y: 19 },
      { number: 11, role: 'A', x: 80, y: 25 },
    ],
  },
  '1-4-1-3': {
    label: '1-4-1-3',
    note: 'Prima linea larga e vertice basso',
    players: [
      { number: 1, role: 'P', x: 50, y: 89 },
      { number: 2, role: 'D', x: 17, y: 72 },
      { number: 5, role: 'D', x: 39, y: 76 },
      { number: 6, role: 'D', x: 61, y: 76 },
      { number: 3, role: 'D', x: 83, y: 72 },
      { number: 4, role: 'C', x: 50, y: 53 },
      { number: 7, role: 'A', x: 20, y: 25 },
      { number: 9, role: 'A', x: 50, y: 19 },
      { number: 11, role: 'A', x: 80, y: 25 },
    ],
  },
  '1-4-1-2-1': {
    label: '1-4-1-2-1',
    note: 'Densità centrale e punta di riferimento',
    players: [
      { number: 1, role: 'P', x: 50, y: 89 },
      { number: 2, role: 'D', x: 17, y: 72 },
      { number: 5, role: 'D', x: 39, y: 76 },
      { number: 6, role: 'D', x: 61, y: 76 },
      { number: 3, role: 'D', x: 83, y: 72 },
      { number: 4, role: 'C', x: 50, y: 56 },
      { number: 8, role: 'T', x: 34, y: 37 },
      { number: 10, role: 'T', x: 66, y: 37 },
      { number: 9, role: 'A', x: 50, y: 16 },
    ],
  },
};

export const phaseOrder = Object.keys(phases) as PhaseId[];
export const formationOrder = Object.keys(formations) as FormationId[];

function TacticalPitch({ formation, phase }: { formation: FormationId; phase: PhaseId }) {
  const players = formations[formation].players;
  const activeBand =
    phase === 'costruzione'
      ? { y: 66, height: 31 }
      : phase === 'progressione'
        ? { y: 34, height: 34 }
        : { y: 3, height: 32 };

  return (
    <div className="pitch-shell">
      <svg
        viewBox="0 0 100 118"
        className="pitch"
        aria-label={`Disposizione ${formation}, fase di ${phases[phase].label.toLowerCase()}`}
      >
        <title>{`Disposizione ${formation}, fase di ${phases[phase].label.toLowerCase()}`}</title>
        <defs>
          <marker id="arrow" markerWidth="5" markerHeight="5" refX="3.2" refY="2.5" orient="auto">
            <path d="M0,0 L5,2.5 L0,5 Z" fill="currentColor" />
          </marker>
          <pattern id="grass" width="100" height="12" patternUnits="userSpaceOnUse">
            <rect width="100" height="12" fill="#0d4b35" />
            <rect width="100" height="6" fill="#104f39" />
          </pattern>
        </defs>

        <rect x="2" y="2" width="96" height="114" rx="2" fill="url(#grass)" />
        <rect
          x="2"
          y={activeBand.y}
          width="96"
          height={activeBand.height}
          fill="#d9ff43"
          opacity="0.11"
          className="phase-band"
        />
        <g className="pitch-lines">
          <rect x="5" y="5" width="90" height="108" />
          <line x1="5" y1="59" x2="95" y2="59" />
          <circle cx="50" cy="59" r="10" />
          <circle cx="50" cy="59" r="0.7" fill="currentColor" />
          <rect x="27" y="5" width="46" height="18" />
          <rect x="39" y="5" width="22" height="7" />
          <path d="M41 23 A10 10 0 0 0 59 23" />
          <circle cx="50" cy="17" r="0.7" fill="currentColor" />
          <rect x="27" y="95" width="46" height="18" />
          <rect x="39" y="106" width="22" height="7" />
          <path d="M41 95 A10 10 0 0 1 59 95" />
          <circle cx="50" cy="101" r="0.7" fill="currentColor" />
        </g>

        <g className={cn('movement movement-' + phase)}>
          {phase === 'costruzione' ? (
            <>
              <path d="M50 89 C44 83, 38 79, 25 73" />
              <path d="M50 89 C58 83, 66 79, 75 73" />
              <path d="M50 75 C51 67, 53 60, 61 53" />
            </>
          ) : null}
          {phase === 'progressione' ? (
            <>
              <path d="M36 52 C28 45, 25 37, 21 28" />
              <path d="M63 52 C58 44, 54 35, 51 23" />
              <path d="M50 72 C51 64, 55 58, 63 52" />
            </>
          ) : null}
          {phase === 'finalizzazione' ? (
            <>
              <path d="M20 26 C27 20, 35 15, 44 11" />
              <path d="M80 26 C72 19, 66 14, 57 10" />
              <path d="M50 38 C50 29, 50 21, 50 11" />
            </>
          ) : null}
        </g>

        {players.map((player) => (
          <g
            key={`${formation}-${player.number}`}
            transform={`translate(${player.x} ${player.y})`}
            className="player-marker"
          >
            <circle r="4.65" />
            <text y="0.55" textAnchor="middle">
              {player.number}
            </text>
            <text y="7.8" textAnchor="middle" className="player-role">
              {player.role}
            </text>
          </g>
        ))}
      </svg>

      <div className="pitch-caption">
        <span className="inline-flex items-center gap-2">
          <span className="status-dot" /> Squadra in possesso
        </span>
        <span>{phases[phase].zone}</span>
      </div>
    </div>
  );
}

type TacticalBoardProps = {
  activePhase: PhaseId;
  activeFormation: FormationId;
  onPhaseChange: (phase: PhaseId) => void;
  onFormationChange: (formation: FormationId) => void;
};

export function TacticalBoard({
  activePhase,
  activeFormation,
  onPhaseChange,
  onFormationChange,
}: TacticalBoardProps) {
  const active = phases[activePhase];
  const nextPhase = phaseOrder[(phaseOrder.indexOf(activePhase) + 1) % phaseOrder.length];

  return (
    <div className="tactical-view view-shell">
      <section className="board-view-heading">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-foreground/70">
            <Sparkles className="size-3.5 text-primary" /> Area tecnica
          </div>
          <h1>
            Leggi il gioco. <span className="text-primary">Allena la scelta.</span>
          </h1>
        </div>
        <p>
          Scegli il sistema, osserva le relazioni e porta in campo un focus chiaro.
        </p>
      </section>

      <nav aria-label="Fasi di gioco" className="phase-nav mb-6">
        {phaseOrder.map((phaseId) => {
          const phase = phases[phaseId];
          const isActive = phaseId === activePhase;

          return (
            <button
              key={phaseId}
              type="button"
              aria-current={isActive ? 'step' : undefined}
              className={cn('phase-tab', isActive && 'phase-tab-active')}
              onClick={() => onPhaseChange(phaseId)}
            >
              <span className="phase-number">{phase.step}</span>
              <span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.13em] opacity-60">
                  {phase.eyebrow}
                </span>
                <span className="block text-sm font-bold">{phase.label}</span>
              </span>
              <ChevronRight className="ml-auto size-4 opacity-40" />
            </button>
          );
        })}
      </nav>

      <div className="workspace-grid">
        <Card className="board-card gap-0 py-0 ring-0">
          <CardHeader className="border-b border-white/10 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Lavagna tattica</p>
                <CardTitle className="mt-1 text-lg text-white">Sistema di gioco</CardTitle>
              </div>
              <span className="board-chip">
                <Layers3 className="size-3.5" /> 9 giocatori
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <fieldset className="formation-picker" aria-label="Scegli il sistema di gioco">
              {formationOrder.map((formationId) => (
                <button
                  key={formationId}
                  type="button"
                  className={cn(
                    'formation-option',
                    activeFormation === formationId && 'formation-option-active',
                  )}
                  aria-pressed={activeFormation === formationId}
                  onClick={() => onFormationChange(formationId)}
                >
                  <span className="font-mono text-sm font-bold">{formationId}</span>
                  <span className="hidden text-left text-[11px] leading-4 text-white/50 xl:block">
                    {formations[formationId].note}
                  </span>
                </button>
              ))}
            </fieldset>
            <TacticalPitch formation={activeFormation} phase={activePhase} />
          </CardContent>
        </Card>

        <section className="analysis-panel" aria-labelledby="phase-title">
          <div className="flex items-center justify-between gap-4">
            <span className="analysis-step">Fase {active.step} / 03</span>
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Crosshair className="size-3.5 text-primary" /> {active.zone}
            </span>
          </div>

          <div className="mt-5">
            <p className="section-kicker text-primary">{active.label}</p>
            <h2 id="phase-title" className="mt-2 text-3xl font-black leading-[1.02] tracking-[-0.045em]">
              {active.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{active.description}</p>
          </div>

          <div className="objective-box mt-5">
            <span className="objective-icon">
              <CircleDot className="size-4" />
            </span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">
                Obiettivo
              </p>
              <p className="mt-1 text-sm font-semibold leading-5">{active.objective}</p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="detail-heading">Principi guida</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {active.principles.map((principle) => (
                <span key={principle} className="principle-pill">
                  {principle}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="detail-heading">Comportamenti osservabili</h3>
            <ol className="mt-3 space-y-3">
              {active.actions.map((action, index) => (
                <li key={action} className="action-row">
                  <span className="action-check">
                    <Check className="size-3.5" />
                  </span>
                  <span className="text-sm leading-5">{action}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    0{index + 1}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="metric-grid mt-6">
            <div>
              <Gauge className="size-4 text-primary" />
              <span>Ritmo</span>
              <strong>{active.tempo}</strong>
            </div>
            <div>
              <ShieldCheck className="size-4 text-primary" />
              <span>Rischio</span>
              <strong>{active.risk}</strong>
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            className="mt-6 h-11 w-full justify-between rounded-xl px-4 text-sm font-bold shadow-none"
            onClick={() => onPhaseChange(nextPhase)}
          >
            Vai a {phases[nextPhase].label}
            <ArrowUpRight className="size-4" />
          </Button>
        </section>
      </div>

      <section className="training-focus mt-6" aria-labelledby="training-title">
        <div className="training-index">{active.step}</div>
        <div className="min-w-0">
          <p className="section-kicker text-primary">Focus allenamento</p>
          <h2 id="training-title" className="mt-1 text-lg font-extrabold tracking-[-0.025em]">
            Porta il principio sul campo
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{active.exercise}</p>
        </div>
        <div className="training-meta">
          <TimerReset className="size-4 text-primary" />
          <span>
            Durata <strong>{active.duration}</strong>
          </span>
        </div>
      </section>
    </div>
  );
}
