/* oxlint-disable jsx-a11y/media-has-caption, next/no-img-element */
/* Le anteprime sono decorative; il player completo con controlli è nella lezione. */
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  CircleDot,
  Play,
  ShieldCheck,
  Star,
  Target,
  Trophy,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import {
  macroPhaseLabels,
  phaseLabels,
  type Lesson,
  type LessonProgressStatus,
} from '../data/lessons';
import type { LearningSummary } from '../lib/learning-progress';

const statusLabels: Record<LessonProgressStatus, string> = {
  da_fare: 'Da fare',
  in_corso: 'In corso',
  completata: 'Completata',
};

type DashboardHomeProps = {
  lessons: readonly Lesson[];
  missionLesson?: Lesson;
  summary: LearningSummary;
  getLessonStatus: (lessonId: string) => LessonProgressStatus;
  onOpenLesson: (lessonId: string) => void;
  onOpenLessons: () => void;
  onOpenTrophies: () => void;
};

export function DashboardHome({
  lessons,
  missionLesson,
  summary,
  getLessonStatus,
  onOpenLesson,
  onOpenLessons,
  onOpenTrophies,
}: DashboardHomeProps) {
  const recentLessons = lessons
    .filter((lesson) => lesson.disponibilita === 'disponibile')
    .slice(0, 3);
  const missionVideo = missionLesson?.variantiVideo[0];

  const stats = [
    {
      label: 'Lezioni fatte',
      value: summary.completedLessonCount,
      icon: BookOpenCheck,
      tone: 'green',
      action: onOpenLessons,
    },
    {
      label: 'Da fare',
      value: summary.todoLessonCount,
      icon: Target,
      tone: 'neutral',
      action: onOpenLessons,
    },
    {
      label: 'Punti',
      value: summary.totalPoints,
      icon: Star,
      tone: 'red',
      action: onOpenTrophies,
    },
    {
      label: 'Trofei',
      value: summary.unlockedTrophyCount,
      icon: Trophy,
      tone: 'gold',
      action: onOpenTrophies,
    },
  ] as const;

  return (
    <div className="dashboard-view view-shell">
      <section className="journey-hero" aria-labelledby="journey-title">
        <div className="journey-identity">
          <img
            className="journey-crest"
            src="/images/poggio-mirteto-logo.png"
            alt="Stemma ufficiale del Poggio Mirteto Calcio"
          />
          <div>
            <p className="section-kicker section-kicker-light">Il tuo percorso</p>
            <h1 id="journey-title">Si gioca insieme.</h1>
          </div>
        </div>

        <Progress value={summary.overallProgress} className="journey-progress">
          <ProgressLabel>Completato</ProgressLabel>
          <ProgressValue>{() => `${summary.overallProgress}%`}</ProgressValue>
        </Progress>
      </section>

      <section className="home-stats" aria-label="Il tuo riepilogo">
        {stats.map((stat) => (
          <button
            key={stat.label}
            type="button"
            className={`home-stat home-stat-${stat.tone}`}
            aria-label={`${stat.label}: ${stat.value}`}
            onClick={stat.action}
          >
            <span className="home-stat-icon" aria-hidden="true">
              <stat.icon className="size-5" />
            </span>
            <span>
              <strong>{stat.value}</strong>
              <small>{stat.label}</small>
            </span>
          </button>
        ))}
      </section>

      <section className="dashboard-section" aria-labelledby="focus-title">
        <header className="section-heading">
          <div>
            <p className="section-kicker">Adesso</p>
            <h2 id="focus-title">Stiamo lavorando su</h2>
          </div>
        </header>

        <div className="focus-grid">
          <article className="focus-card focus-card-ball">
            <span className="focus-icon" aria-hidden="true">
              <CircleDot className="size-6" />
            </span>
            <span>
              <small>Fase</small>
              <strong>{missionLesson ? macroPhaseLabels[missionLesson.macroFase] : 'In attesa'}</strong>
            </span>
          </article>
          <article className="focus-card focus-card-build">
            <span className="focus-icon" aria-hidden="true">
              <ShieldCheck className="size-6" />
            </span>
            <span>
              <small>Concetto</small>
              <strong>{missionLesson?.concetti[0] ?? 'Da assegnare'}</strong>
            </span>
          </article>
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="recent-title">
        <header className="section-heading section-heading-action">
          <div>
            <p className="section-kicker">Il tuo cammino</p>
            <h2 id="recent-title">Ultime lezioni</h2>
          </div>
          <button type="button" className="text-link" onClick={onOpenLessons}>
            Vedi tutte <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="recent-lessons">
          {recentLessons.length === 0 ? (
            <div className="lessons-empty-state">
              <BookOpenCheck className="size-5" aria-hidden="true" />
              <strong>Nessuna lezione assegnata</strong>
              <span>Il coach sta preparando il tuo prossimo allenamento.</span>
            </div>
          ) : null}
          {recentLessons.map((lesson) => {
            const status = getLessonStatus(lesson.id);
            const isCompleted = status === 'completata';

            return (
              <button
                key={lesson.id}
                type="button"
                className="recent-lesson"
                onClick={() => onOpenLesson(lesson.id)}
              >
                <span
                  className={isCompleted ? 'recent-check recent-check-done' : 'recent-check'}
                  aria-hidden="true"
                >
                  {isCompleted ? <Check className="size-4" /> : null}
                </span>
                <span className="recent-lesson-copy">
                  <small>{phaseLabels[lesson.fase]}</small>
                  <strong>{lesson.titolo}</strong>
                </span>
                <span className={`lesson-progress-label lesson-progress-${status}`}>
                  {statusLabels[status]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {missionLesson ? (
        <section className="next-mission" aria-labelledby="next-mission-title">
          <button
            type="button"
            className="next-mission-media"
            aria-label={`Apri la lezione ${missionLesson.titolo}`}
            onClick={() => onOpenLesson(missionLesson.id)}
          >
            {missionVideo ? (
              <video muted playsInline preload="metadata" tabIndex={-1} aria-hidden="true">
                <source src={`${missionVideo.percorsoVideo}#t=0.1`} type="video/mp4" />
              </video>
            ) : null}
            <span className="mission-play" aria-hidden="true">
              <Play className="size-6 fill-current" />
            </span>
          </button>

          <div className="next-mission-copy">
            <p className="section-kicker section-kicker-light">Prossima missione</p>
            <span className="mission-phase">{phaseLabels[missionLesson.fase]}</span>
            <h2 id="next-mission-title">{missionLesson.titolo}</h2>
            <div className="mission-reward">
              <Star className="size-4 fill-current" aria-hidden="true" />
              +{missionLesson.punti} punti
            </div>
            <Button
              type="button"
              size="lg"
              className="primary-cta"
              onClick={() => onOpenLesson(missionLesson.id)}
            >
              Continua <ArrowRight className="ml-auto size-5" aria-hidden="true" />
            </Button>
          </div>
        </section>
      ) : summary.availableLessonCount > 0 ? (
        <section className="next-mission next-mission-complete" aria-labelledby="next-mission-title">
          <span className="mission-finish-icon" aria-hidden="true">
            <Trophy className="size-8" />
          </span>
          <div className="next-mission-copy">
            <p className="section-kicker section-kicker-light">Prossima missione</p>
            <span className="mission-phase">Percorso completato</span>
            <h2 id="next-mission-title">Ottimo lavoro!</h2>
            <Button
              type="button"
              size="lg"
              className="primary-cta"
              onClick={onOpenLessons}
            >
              Rivedi le lezioni <ArrowRight className="ml-auto size-5" aria-hidden="true" />
            </Button>
          </div>
        </section>
      ) : (
        <section className="next-mission next-mission-complete" aria-labelledby="next-mission-title">
          <span className="mission-finish-icon" aria-hidden="true">
            <Target className="size-8" />
          </span>
          <div className="next-mission-copy">
            <p className="section-kicker section-kicker-light">Prossima missione</p>
            <span className="mission-phase">In preparazione</span>
            <h2 id="next-mission-title">Aspetta l’assegnazione del coach</h2>
          </div>
        </section>
      )}
    </div>
  );
}
