/* oxlint-disable jsx-a11y/media-has-caption */
/* L'anteprima è decorativa; il player completo con controlli è nella lezione. */
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Flame,
  Lock,
  Play,
  Sparkles,
  Star,
  Target,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import type { Lesson } from '../data/lessons';

const demoStats = [
  { label: 'Da fare', value: '1', icon: BookOpen, tone: 'blue' },
  { label: 'Completate', value: '2', icon: CheckCircle2, tone: 'green' },
  { label: 'Punti', value: '180', icon: Star, tone: 'orange' },
  { label: 'Concetti', value: '2', icon: Sparkles, tone: 'lime' },
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
  const missionVideo = missionLesson?.variantiVideo[0];

  return (
    <div className="dashboard-view view-shell">
      <section className="home-intro" aria-labelledby="dashboard-title">
        <div>
          <p className="section-kicker">Questa settimana</p>
          <h1 id="dashboard-title">La tua missione</h1>
        </div>
        <span className="home-streak">
          <Flame className="size-4" aria-hidden="true" />
          2 completate
        </span>
      </section>

      {missionLesson ? (
        <section className="weekly-mission" aria-labelledby="mission-title">
          <div className="mission-copy">
            <div className="mission-eyebrow">
              <Target className="size-4" aria-hidden="true" />
              Missione della settimana
            </div>

            <div className="mission-meta">
              <span>{missionLesson.fase}</span>
              <span>{missionLesson.sistema}</span>
            </div>

            <h2 id="mission-title">{missionLesson.titolo}</h2>
            <p className="mission-prompt">{missionLesson.puntiChiave[0]}</p>

            <Progress value={42} className="mission-progress">
              <ProgressLabel>La tua settimana</ProgressLabel>
              <ProgressValue>{() => '42%'}</ProgressValue>
            </Progress>

            <Button
              type="button"
              size="lg"
              className="mission-button"
              onClick={() => onOpenLesson(missionLesson.id)}
            >
              <Play className="size-5 fill-current" aria-hidden="true" />
              Guarda la lezione
              <ArrowRight className="ml-auto size-5" aria-hidden="true" />
            </Button>
          </div>

          <button
            type="button"
            className="mission-media"
            aria-label={`Apri la lezione ${missionLesson.titolo}`}
            onClick={() => onOpenLesson(missionLesson.id)}
          >
            {missionVideo ? (
              <video muted playsInline preload="metadata" tabIndex={-1} aria-hidden="true">
                <source src={`${missionVideo.percorsoVideo}#t=0.1`} type="video/mp4" />
              </video>
            ) : null}
            <span className="mission-media-label" aria-hidden="true">
              <Play className="size-4 fill-current" />
              {missionLesson.variantiVideo.length} varianti video
            </span>
            <span className="mission-play-orb" aria-hidden="true">
              <Play className="size-7 fill-current" />
            </span>
          </button>
        </section>
      ) : null}

      <section className="journey-overview" aria-labelledby="journey-title">
        <header className="compact-section-heading">
          <div>
            <p className="section-kicker">Il tuo percorso</p>
            <h2 id="journey-title">Pronto per il campo?</h2>
          </div>
          <span className="demo-data-label">Demo</span>
        </header>

        <div className="stats-grid">
          {demoStats.map((stat) => (
            <article key={stat.label} className={`stat-card stat-card-${stat.tone}`}>
              <span className="stat-icon" aria-hidden="true">
                <stat.icon className="size-5" />
              </span>
              <span className="stat-copy">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="continue-title">
        <header className="dashboard-section-heading">
          <div>
            <p className="section-kicker">Allenati ancora</p>
            <h2 id="continue-title">Continua</h2>
          </div>
          <button type="button" className="text-link" onClick={onOpenLessons}>
            Tutte <ArrowRight className="size-4" aria-hidden="true" />
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
                <Play className="size-5 fill-current" />
              </span>
              <span className="continue-card-copy">
                <span>
                  {lesson.fase} · {lesson.sistema}
                </span>
                <strong>{lesson.titolo}</strong>
              </span>
              <span className="continue-action">
                Continua <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="dashboard-section concept-preview" aria-labelledby="concepts-title">
        <header className="dashboard-section-heading">
          <div>
            <p className="section-kicker">La tua collezione</p>
            <h2 id="concepts-title">Concetti</h2>
          </div>
          <button type="button" className="text-link" onClick={onOpenLibrary}>
            Biblioteca <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="concept-preview-grid">
          {demoConcepts.map((concept) => (
            <article
              key={concept.name}
              className={concept.unlocked ? 'concept-chip concept-chip-unlocked' : 'concept-chip'}
            >
              <span className="concept-chip-icon" aria-hidden="true">
                {concept.unlocked ? <Sparkles className="size-5" /> : <Lock className="size-4" />}
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
