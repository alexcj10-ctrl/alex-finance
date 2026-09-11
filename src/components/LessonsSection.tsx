/* oxlint-disable jsx-a11y/media-has-caption */
/* Le tracce sottotitoli sono opzionali e appaiono solo quando configurate. */
import { useState, type ComponentType } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDot,
  Clock3,
  Lock,
  MoveRight,
  Play,
  Shield,
  Star,
  Target,
  Video,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  macroPhaseLabels,
  phaseLabels,
  phaseOrderByMacro,
  type Lesson,
  type LessonProgressStatus,
  type MacroPhaseId,
  type PhaseId,
} from '../data/lessons';
import { useVideoProgressTracking } from '../hooks/useVideoProgressTracking';

const statusLabels: Record<LessonProgressStatus, string> = {
  da_fare: 'Da fare',
  in_corso: 'In corso',
  completata: 'Completata',
};

const macroOptions: readonly {
  id: MacroPhaseId;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: 'possesso', subtitle: 'Fase di possesso', icon: CircleDot },
  { id: 'non_possesso', subtitle: 'Fase di non possesso', icon: Shield },
];

const phaseIcons: Record<PhaseId, ComponentType<{ className?: string }>> = {
  costruzione: Play,
  progressione: MoveRight,
  finalizzazione: Target,
  pressione_alta: Zap,
  pressione_bassa: Shield,
};

function LessonVideo({
  lesson,
  onStarted,
}: {
  lesson: Lesson;
  onStarted: () => void;
}) {
  const [selectedVariantId, setSelectedVariantId] = useState(
    lesson.variantiVideo[0].id,
  );
  const [failedVariantIds, setFailedVariantIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const selectedVariant =
    lesson.variantiVideo.find((variant) => variant.id === selectedVariantId) ??
    lesson.variantiVideo[0];
  const videoIsReady =
    lesson.disponibilita === 'disponibile' &&
    !failedVariantIds.has(selectedVariant.id);
  const videoTracking = useVideoProgressTracking(lesson.id, selectedVariant.id);

  return (
    <div className="lesson-video-area">
      {videoIsReady ? (
        <video
          key={selectedVariant.id}
          className="lesson-video"
          controls
          playsInline
          preload="metadata"
          aria-label={`Video ${selectedVariant.etichetta} della lezione ${lesson.titolo}`}
          onPlay={(event) => {
            onStarted();
            videoTracking.onPlay(event.currentTarget);
          }}
          onTimeUpdate={(event) => videoTracking.onTimeUpdate(event.currentTarget)}
          onEnded={(event) => videoTracking.onEnded(event.currentTarget)}
          onSeeking={videoTracking.onSeeking}
          onError={() =>
            setFailedVariantIds((current) =>
              new Set(current).add(selectedVariant.id),
            )
          }
        >
          <source src={selectedVariant.percorsoVideo} type="video/mp4" />
          {selectedVariant.percorsoSottotitoli ? (
            <track
              kind="captions"
              src={selectedVariant.percorsoSottotitoli}
              srcLang="it"
              label="Italiano"
            />
          ) : null}
          Il tuo browser non supporta la riproduzione video HTML5.
        </video>
      ) : (
        <output className="lesson-video-placeholder" aria-live="polite">
          <span className="lesson-video-icon" aria-hidden="true">
            <Video className="size-7" />
          </span>
          <strong>Video in preparazione</strong>
          <span>Torna presto!</span>
        </output>
      )}

      {lesson.variantiVideo.length > 1 ? (
        <fieldset className="variant-picker">
          <legend>Due modi, stessa idea</legend>
          <div className="variant-buttons">
            {lesson.variantiVideo.map((variant) => (
              <button
                key={variant.id}
                type="button"
                className={cn(
                  'variant-button',
                  selectedVariant.id === variant.id && 'variant-button-active',
                )}
                aria-pressed={selectedVariant.id === variant.id}
                onClick={() => setSelectedVariantId(variant.id)}
              >
                <Play className="size-4 fill-current" aria-hidden="true" />
                {variant.etichetta}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

type LessonsSectionProps = {
  lessons: readonly Lesson[];
  initialLessonId?: string;
  getLessonStatus: (lessonId: string) => LessonProgressStatus;
  onLessonStarted: (lessonId: string) => void;
  onCompleteLesson: (lessonId: string) => void;
};

export function LessonsSection({
  lessons,
  initialLessonId,
  getLessonStatus,
  onLessonStarted,
  onCompleteLesson,
}: LessonsSectionProps) {
  const initialLesson = lessons.find((lesson) => lesson.id === initialLessonId);
  const [activeMacro, setActiveMacro] = useState<MacroPhaseId>(
    initialLesson?.macroFase ?? 'possesso',
  );
  const [activePhase, setActivePhase] = useState<PhaseId>(
    initialLesson?.fase ?? 'costruzione',
  );
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    initialLesson?.id ?? null,
  );
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId);
  const phaseLessons = lessons.filter((lesson) => lesson.fase === activePhase);

  const selectMacro = (macro: MacroPhaseId) => {
    setActiveMacro(macro);
    setActivePhase(phaseOrderByMacro[macro][0]);
    setSelectedLessonId(null);
  };

  const selectPhase = (phase: PhaseId) => {
    setActivePhase(phase);
    setSelectedLessonId(null);
  };

  if (selectedLesson) {
    const status = getLessonStatus(selectedLesson.id);
    const isCompleted = status === 'completata';
    const isAvailable = selectedLesson.disponibilita === 'disponibile';
    const visibleStatus = isAvailable ? statusLabels[status] : 'In arrivo';

    return (
      <div className="lesson-detail-view view-shell">
        <button
          type="button"
          className="back-button"
          onClick={() => setSelectedLessonId(null)}
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Lezioni
        </button>

        <article className="lesson-detail" aria-labelledby="lesson-title">
          <header className="lesson-title-block">
            <div className="lesson-title-meta">
              <span>{macroPhaseLabels[selectedLesson.macroFase]}</span>
              <span>{phaseLabels[selectedLesson.fase]}</span>
              <span>1-3-2-3</span>
            </div>
            <h1 id="lesson-title">{selectedLesson.titolo}</h1>
            <span
              className={cn(
                'lesson-progress-label',
                isAvailable
                  ? `lesson-progress-${status}`
                  : 'lesson-progress-prossimamente',
              )}
            >
              {status === 'completata' ? (
                <Check className="size-4" aria-hidden="true" />
              ) : null}
              {!isAvailable ? <Lock className="size-4" aria-hidden="true" /> : null}
              {visibleStatus}
            </span>
          </header>

          <LessonVideo
            key={selectedLesson.id}
            lesson={selectedLesson}
            onStarted={() => onLessonStarted(selectedLesson.id)}
          />

          <section className="remember-card" aria-labelledby="remember-title">
            <div className="remember-heading">
              <span aria-hidden="true">
                <CheckCircle2 className="size-5" />
              </span>
              <h2 id="remember-title">Ricordati</h2>
            </div>
            <ol>
              {selectedLesson.puntiChiave.map((point, index) => (
                <li key={point}>
                  <span>{index + 1}</span>
                  {point}
                </li>
              ))}
            </ol>
          </section>

          <footer className="lesson-completion">
            <div className="lesson-points">
              <span aria-hidden="true">
                <Star className="size-5 fill-current" />
              </span>
              <div>
                <small>Punti lezione</small>
                <strong>+{selectedLesson.punti}</strong>
              </div>
            </div>

            <Button
              type="button"
              size="lg"
              className={cn('complete-button', isCompleted && 'complete-button-done')}
              disabled={!isAvailable || isCompleted}
              onClick={() => onCompleteLesson(selectedLesson.id)}
            >
              {isCompleted ? (
                <>
                  <CheckCircle2 className="size-5" aria-hidden="true" /> Completata
                </>
              ) : isAvailable ? (
                <>
                  Completa lezione <ArrowRight className="ml-auto size-5" aria-hidden="true" />
                </>
              ) : (
                <>
                  <Clock3 className="size-5" aria-hidden="true" /> In preparazione
                </>
              )}
            </Button>
          </footer>
        </article>
      </div>
    );
  }

  return (
    <div className="lessons-view view-shell">
      <header className="view-heading lessons-heading">
        <div>
          <p className="section-kicker">Il tuo allenamento</p>
          <h1>Lezioni</h1>
        </div>
        <span className="system-badge">1-3-2-3</span>
      </header>

      <section className="macro-picker" aria-labelledby="macro-title">
        <h2 id="macro-title" className="sr-only">Scegli la fase</h2>
        {macroOptions.map((macro) => (
          <button
            key={macro.id}
            type="button"
            className={cn(
              'macro-card',
              `macro-card-${macro.id}`,
              activeMacro === macro.id && 'macro-card-active',
            )}
            aria-label={`${macroPhaseLabels[macro.id]}, ${macro.subtitle}`}
            aria-pressed={activeMacro === macro.id}
            onClick={() => selectMacro(macro.id)}
          >
            <span className="macro-icon" aria-hidden="true">
              <macro.icon className="size-7" />
            </span>
            <span>
              <strong>{macroPhaseLabels[macro.id]}</strong>
              <small>{macro.subtitle}</small>
            </span>
          </button>
        ))}
      </section>

      <section className="phase-picker" aria-label={`Categorie ${macroPhaseLabels[activeMacro]}`}>
        {phaseOrderByMacro[activeMacro].map((phase) => {
          const PhaseIcon = phaseIcons[phase];

          return (
            <button
              key={phase}
              type="button"
              className={cn('phase-card', activePhase === phase && 'phase-card-active')}
              aria-pressed={activePhase === phase}
              onClick={() => selectPhase(phase)}
            >
              <PhaseIcon className="size-5" aria-hidden="true" />
              <span>{phaseLabels[phase]}</span>
            </button>
          );
        })}
      </section>

      <section className="lesson-list-section" aria-labelledby="lesson-list-title">
        <header className="section-heading">
          <div>
            <p className="section-kicker">{macroPhaseLabels[activeMacro]}</p>
            <h2 id="lesson-list-title">{phaseLabels[activePhase]}</h2>
          </div>
        </header>

        <div className="lesson-list">
          {phaseLessons.map((lesson) => {
            const status = getLessonStatus(lesson.id);
            const isCompleted = status === 'completata';
            const hasVideo = lesson.disponibilita === 'disponibile';
            const visibleStatus = hasVideo ? statusLabels[status] : 'In arrivo';

            return (
              <button
                key={lesson.id}
                type="button"
                className={cn('lesson-card', isCompleted && 'lesson-card-completed')}
                aria-label={`Apri ${lesson.titolo}, ${visibleStatus}, ${lesson.punti} punti`}
                onClick={() => setSelectedLessonId(lesson.id)}
              >
                <span className="lesson-thumb" aria-hidden="true">
                  {hasVideo ? (
                    <video muted playsInline preload="metadata" tabIndex={-1}>
                      <source
                        src={`${lesson.variantiVideo[0].percorsoVideo}#t=0.1`}
                        type="video/mp4"
                      />
                    </video>
                  ) : (
                    <Lock className="size-5" />
                  )}
                  {hasVideo ? <Play className="lesson-thumb-play size-5 fill-current" /> : null}
                </span>

                <span className="lesson-card-copy">
                  <span className="lesson-card-topline">
                    {lesson.demo ? <span className="demo-badge">Demo</span> : null}
                    <span
                      className={cn(
                        'lesson-progress-label',
                        hasVideo
                          ? `lesson-progress-${status}`
                          : 'lesson-progress-prossimamente',
                      )}
                    >
                      {isCompleted ? <Check className="size-3.5" aria-hidden="true" /> : null}
                      {!hasVideo ? <Lock className="size-3.5" aria-hidden="true" /> : null}
                      {visibleStatus}
                    </span>
                  </span>
                  <strong>{lesson.titolo}</strong>
                  <small>
                    <Star className="size-3.5 fill-current" aria-hidden="true" /> {lesson.punti} punti
                  </small>
                </span>

                <ArrowRight className="lesson-card-arrow size-5" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
