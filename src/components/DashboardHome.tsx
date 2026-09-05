import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleGauge,
  Lock,
  Play,
  Sparkles,
  Star,
  Target,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';
import type { Lesson } from '../data/lessons';

const demoStats = [
  { label: 'Lezioni da fare', value: '4', icon: BookOpen },
  { label: 'Completate', value: '2', icon: CheckCircle2 },
  { label: 'Punti', value: '180', icon: Star },
] as const;

const demoConcepts = [
  { name: 'Ampiezza', status: 'Sbloccato', unlocked: true },
  { name: 'Linea di passaggio', status: 'Sbloccato', unlocked: true },
  { name: 'Terzo uomo', status: 'Da scoprire', unlocked: false },
  { name: 'Attacco dell’area', status: 'Da scoprire', unlocked: false },
] as const;

type DashboardHomeProps = {
  missionLesson?: Lesson;
  availableLessons: readonly Lesson[];
  onOpenLesson: (lessonId: string) => void;
  onOpenLessons: () => void;
  onOpenLibrary: () => void;
};

export function DashboardHome({
  missionLesson,
  availableLessons,
  onOpenLesson,
  onOpenLessons,
  onOpenLibrary,
}: DashboardHomeProps) {
  return (
    <div className="dashboard-view view-shell">
      <section className="dashboard-heading" aria-labelledby="dashboard-title">
        <div>
          <p className="section-kicker text-primary">La tua settimana</p>
          <h1 id="dashboard-title">Il tuo percorso</h1>
          <p>
            Un passo alla volta: guarda la situazione, riconosci la scelta e portala in campo.
          </p>
        </div>
        <span className="demo-data-label">Dati demo</span>
      </section>

      <section className="journey-overview" aria-label="Progresso settimanale">
        <div className="progress-card">
          <div className="progress-card-icon" aria-hidden="true">
            <CircleGauge className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <Progress value={42} className="journey-progress">
              <ProgressLabel>Progresso settimanale</ProgressLabel>
              <ProgressValue>{() => '42%'}</ProgressValue>
            </Progress>
            <p>Hai già completato due attività del percorso di questa settimana.</p>
          </div>
        </div>

        <div className="stats-grid">
          {demoStats.map((stat) => (
            <article key={stat.label} className="stat-card">
              <stat.icon className="size-4" aria-hidden="true" />
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </article>
          ))}
        </div>
      </section>

      {missionLesson ? (
        <section className="weekly-mission" aria-labelledby="mission-title">
          <div className="mission-copy">
            <div className="mission-eyebrow">
              <Target className="size-4" /> Missione della settimana
            </div>
            <span className="mission-phase">{missionLesson.fase}</span>
            <h2 id="mission-title">{missionLesson.titolo}</h2>
            <p>{missionLesson.descrizione}</p>
            <div className="mission-meta">
              <span>{missionLesson.sistema}</span>
              <span>Video disponibile</span>
            </div>
            <Button
              type="button"
              size="lg"
              className="mission-button"
              onClick={() => onOpenLesson(missionLesson.id)}
            >
              <Play className="size-4 fill-current" />
              Inizia la missione
              <ArrowRight className="ml-auto size-4" />
            </Button>
          </div>
          <div className="mission-number" aria-hidden="true">
            01
          </div>
        </section>
      ) : null}

      <section className="dashboard-section" aria-labelledby="continue-title">
        <header className="dashboard-section-heading">
          <div>
            <p className="section-kicker text-primary">Allenamento personale</p>
            <h2 id="continue-title">Continua ad allenarti</h2>
          </div>
          <button type="button" className="text-link" onClick={onOpenLessons}>
            Tutte le lezioni <ArrowRight className="size-4" />
          </button>
        </header>

        <div className="continue-grid">
          {availableLessons.map((lesson) => (
            <button
              key={lesson.id}
              type="button"
              className="continue-card"
              onClick={() => onOpenLesson(lesson.id)}
            >
              <span className="continue-play" aria-hidden="true">
                <Play className="size-4 fill-current" />
              </span>
              <span className="continue-card-copy">
                <span>
                  {lesson.fase} · {lesson.sistema}
                </span>
                <strong>{lesson.titolo}</strong>
                <small>Apri la lezione</small>
              </span>
              <ArrowRight className="continue-arrow size-5" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section className="dashboard-section concept-preview" aria-labelledby="concepts-title">
        <header className="dashboard-section-heading">
          <div>
            <p className="section-kicker text-primary">La tua mappa di gioco</p>
            <h2 id="concepts-title">Concetti</h2>
          </div>
          <button type="button" className="text-link" onClick={onOpenLibrary}>
            Apri la biblioteca <ArrowRight className="size-4" />
          </button>
        </header>

        <div className="concept-preview-grid">
          {demoConcepts.map((concept) => (
            <article
              key={concept.name}
              className={concept.unlocked ? 'concept-chip concept-chip-unlocked' : 'concept-chip'}
            >
              <span className="concept-chip-icon" aria-hidden="true">
                {concept.unlocked ? (
                  <Sparkles className="size-4" />
                ) : (
                  <Lock className="size-4" />
                )}
              </span>
              <span>
                <strong>{concept.name}</strong>
                <small>{concept.status}</small>
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
