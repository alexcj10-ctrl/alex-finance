/* oxlint-disable jsx-a11y/media-has-caption */
/* Le tracce sottotitoli sono opzionali e vengono renderizzate solo quando configurate. */
import { useState } from 'react';
import { BookOpen, Check, ChevronRight, Play, Video } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Lesson, LessonLevel, PhaseId } from '../data/lessons';

const phaseLabels: Record<PhaseId, string> = {
  costruzione: 'Costruzione',
  progressione: 'Progressione',
  finalizzazione: 'Finalizzazione',
};

const phaseOrder: readonly PhaseId[] = ['costruzione', 'progressione', 'finalizzazione'];

const levelLabels: Record<LessonLevel, string> = {
  base: 'Livello base',
  avanzato: 'Livello avanzato',
  entrambi: 'Base + avanzato',
};

function LessonVideo({ lesson }: { lesson: Lesson }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoIsReady = lesson.stato === 'disponibile' && !videoFailed;

  if (!videoIsReady) {
    return (
      <output className="lesson-video-placeholder" aria-live="polite">
        <span className="lesson-video-icon" aria-hidden="true">
          <Video className="size-6" />
        </span>
        <p className="lesson-video-title">Video in preparazione</p>
        <p className="lesson-video-copy">
          Il contributo realizzato con FM Stadio verrà mostrato qui appena disponibile.
        </p>
      </output>
    );
  }

  return (
    <video
      className="lesson-video"
      controls
      playsInline
      preload="metadata"
      aria-label={`Video della lezione ${lesson.titolo}`}
      onError={() => setVideoFailed(true)}
    >
      <source src={lesson.percorsoVideo} type="video/mp4" />
      {lesson.percorsoSottotitoli ? (
        <track
          kind="captions"
          src={lesson.percorsoSottotitoli}
          srcLang="it"
          label="Italiano"
        />
      ) : null}
      Il tuo browser non supporta la riproduzione video HTML5.
    </video>
  );
}

type LessonsSectionProps = {
  lessons: readonly Lesson[];
  initialLessonId?: string;
};

export function LessonsSection({ lessons, initialLessonId }: LessonsSectionProps) {
  const initialLesson =
    lessons.find((lesson) => lesson.id === initialLessonId) ??
    lessons.find((lesson) => lesson.stato === 'disponibile') ??
    lessons[0];
  const [activePhase, setActivePhase] = useState<PhaseId>(
    initialLesson?.fase ?? 'costruzione',
  );
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    initialLesson?.id ?? null,
  );

  const phaseLessons = lessons.filter((lesson) => lesson.fase === activePhase);
  const selectedLesson =
    phaseLessons.find((lesson) => lesson.id === selectedLessonId) ?? phaseLessons[0];

  const selectPhase = (phase: PhaseId) => {
    const firstLesson = lessons.find((lesson) => lesson.fase === phase);
    setActivePhase(phase);
    setSelectedLessonId(firstLesson?.id ?? null);
  };

  return (
    <div className="lessons-view view-shell">
      <header className="view-heading lessons-page-heading">
        <div>
          <p className="section-kicker text-primary">Guarda, capisci, prova</p>
          <h1>Lezioni</h1>
          <p>
            Parti dal video, osserva i dettagli e porta in campo un’idea alla volta.
          </p>
        </div>
        <span className="lesson-count">{lessons.length} moduli</span>
      </header>

      <nav className="lesson-phase-switcher" aria-label="Fasi delle lezioni">
        {phaseOrder.map((phase) => (
          <button
            key={phase}
            type="button"
            className={cn(
              'lesson-phase-filter',
              activePhase === phase && 'lesson-phase-filter-active',
            )}
            aria-current={activePhase === phase ? 'page' : undefined}
            onClick={() => selectPhase(phase)}
          >
            {phaseLabels[phase]}
            <span>{lessons.filter((lesson) => lesson.fase === phase).length}</span>
          </button>
        ))}
      </nav>

      <section className="lessons-section" aria-labelledby="lessons-title">
        <header className="lessons-header">
          <div>
            <p className="section-kicker text-primary">Percorso didattico</p>
            <h2 id="lessons-title" className="mt-1 text-2xl font-black tracking-[-0.035em]">
              {phaseLabels[activePhase]}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Scegli una lezione e concentrati sui tre punti da ricordare.
            </p>
          </div>
          <span className="lesson-phase-badge">{phaseLabels[activePhase]}</span>
        </header>

        {selectedLesson ? (
          <div className="lessons-workspace">
            <div className="lesson-catalog" aria-label={`Lezioni di ${phaseLabels[activePhase]}`}>
              {phaseLessons.map((lesson) => {
                const isSelected = lesson.id === selectedLesson.id;

                return (
                  <button
                    key={lesson.id}
                    type="button"
                    className={cn('lesson-card', isSelected && 'lesson-card-active')}
                    aria-pressed={isSelected}
                    aria-controls="lesson-detail"
                    onClick={() => setSelectedLessonId(lesson.id)}
                  >
                    <span className="lesson-card-topline">
                      {lesson.demo ? <span className="demo-badge">Contenuto demo</span> : null}
                      <span className={cn('lesson-status', `lesson-status-${lesson.stato}`)}>
                        {lesson.stato === 'disponibile' ? 'Disponibile' : 'Prossimamente'}
                      </span>
                    </span>
                    <strong className="lesson-card-title">{lesson.titolo}</strong>
                    <span className="lesson-card-description">{lesson.descrizione}</span>
                    <span className="lesson-card-meta">
                      <span>{lesson.sistema}</span>
                      <span>{levelLabels[lesson.livello]}</span>
                      <span className="lesson-open-label">
                        Apri <ChevronRight className="size-3.5" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <article id="lesson-detail" className="lesson-detail" aria-labelledby="lesson-detail-title">
              <div className="lesson-detail-heading">
                <div>
                  <div className="lesson-detail-badges">
                    <span>{phaseLabels[selectedLesson.fase]}</span>
                    <span>{selectedLesson.sistema}</span>
                    <span>{levelLabels[selectedLesson.livello]}</span>
                  </div>
                  <h3 id="lesson-detail-title">{selectedLesson.titolo}</h3>
                  <p>{selectedLesson.descrizione}</p>
                </div>
                <span className="lesson-play-mark" aria-hidden="true">
                  <Play className="size-5 fill-current" />
                </span>
              </div>

              <LessonVideo key={selectedLesson.id} lesson={selectedLesson} />

              <div className="lesson-learning-grid">
                <section aria-labelledby="lesson-objective-title">
                  <span className="lesson-learning-icon" aria-hidden="true">
                    <BookOpen className="size-4" />
                  </span>
                  <div>
                    <h4 id="lesson-objective-title">Cosa impariamo</h4>
                    <p>{selectedLesson.obiettivo}</p>
                  </div>
                </section>

                <section aria-labelledby="lesson-key-points-title">
                  <span className="lesson-learning-icon" aria-hidden="true">
                    <Check className="size-4" />
                  </span>
                  <div>
                    <h4 id="lesson-key-points-title">Ricordati</h4>
                    <ol className="lesson-key-points">
                      {selectedLesson.puntiChiave.map((point, index) => (
                        <li key={point}>
                          <span>{index + 1}</span>
                          {point}
                        </li>
                      ))}
                    </ol>
                  </div>
                </section>
              </div>
            </article>
          </div>
        ) : (
          <div className="lesson-empty">Le lezioni di questa fase arriveranno presto.</div>
        )}
      </section>
    </div>
  );
}
