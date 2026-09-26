/* oxlint-disable jsx-a11y/media-has-caption, next/no-html-link-for-pages -- I sottotitoli del catalogo sono opzionali; app Vite con routing History API. */
import { useEffect, useState, type MouseEvent } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  CircleHelp,
  Eye,
  PlayCircle,
} from 'lucide-react';

import { phaseLabels } from '../../data/lessons';
import { requireSupabaseClient } from '../../services/supabase/client';
import type { CoachLessonAggregate } from '../../types/coach';
import type { Json } from '../../types/database';
import { CoachPageHeader } from '../components/CoachPageHeader';
import { navigateCoach } from '../routes';

type QuizPreviewQuestion = {
  id: string;
  prompt: string;
  choices: readonly string[];
};

function handleBack(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  navigateCoach('/coach/lezioni');
}

function parseChoiceLabels(value: Json): readonly string[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((choice) => {
    if (
      !choice ||
      Array.isArray(choice) ||
      typeof choice !== 'object' ||
      typeof choice.label !== 'string'
    ) {
      return [];
    }
    return [choice.label];
  });
}

function CoachLessonQuizPreview({ lessonId }: { lessonId: string }) {
  const [questions, setQuestions] = useState<readonly QuizPreviewQuestion[]>(
    [],
  );
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

  useEffect(() => {
    let cancelled = false;

    void requireSupabaseClient()
      .from('quiz_questions')
      .select('id, prompt, choices, position')
      .eq('lesson_id', lessonId)
      .eq('active', true)
      .order('position')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setStatus('error');
          return;
        }

        setQuestions(
          (data ?? []).map((question) => ({
            id: question.id,
            prompt: question.prompt,
            choices: parseChoiceLabels(question.choices),
          })),
        );
        setStatus('ready');
      });

    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  return (
    <section
      className="coach-detail-section coach-lesson-quiz-preview"
      aria-labelledby="coach-lesson-quiz-title"
    >
      <header className="coach-section-header">
        <div>
          <p className="coach-eyebrow">Consultazione</p>
          <h2 id="coach-lesson-quiz-title">Quiz della lezione</h2>
        </div>
        <CircleHelp className="size-5" aria-hidden="true" />
      </header>

      {status === 'loading' ? (
        <p className="coach-lesson-loading" aria-live="polite">
          Caricamento del quiz…
        </p>
      ) : status === 'error' ? (
        <p className="coach-lesson-loading" role="alert">
          Informazioni del quiz non disponibili.
        </p>
      ) : questions.length === 0 ? (
        <p className="coach-lesson-loading">
          Quiz in preparazione per questa lezione.
        </p>
      ) : (
        <ol className="coach-quiz-preview-list">
          {questions.map((question) => (
            <li key={question.id}>
              <strong>{question.prompt}</strong>
              {question.choices.length > 0 ? (
                <ul>
                  {question.choices.map((choice) => (
                    <li key={choice}>{choice}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function CoachLessonDetailPage({
  aggregate,
}: {
  aggregate: CoachLessonAggregate;
}) {
  const { lesson } = aggregate;
  const [selectedVariantId, setSelectedVariantId] = useState(
    lesson.variantiVideo[0].id,
  );
  const selectedVariant =
    lesson.variantiVideo.find((variant) => variant.id === selectedVariantId) ??
    lesson.variantiVideo[0];

  return (
    <div className="coach-page coach-lesson-detail-page">
      <a className="coach-back-link" href="/coach/lezioni" onClick={handleBack}>
        <ArrowLeft className="size-4" aria-hidden="true" /> Torna alle lezioni
      </a>

      <CoachPageHeader
        eyebrow={`${phaseLabels[lesson.fase]} · ${lesson.sistema}`}
        title={lesson.titolo}
        description={lesson.descrizioneBreve}
      />

      <aside
        className="coach-read-only-banner"
        aria-label="Modalità consultazione"
      >
        <Eye className="size-5" aria-hidden="true" />
        <div>
          <strong>Modalità consultazione Coach</strong>
          <span>
            La riproduzione non modifica progressi, punti, quiz o trofei dei
            giocatori.
          </span>
        </div>
      </aside>

      <section
        className="coach-lesson-video-panel"
        aria-labelledby="coach-video-title"
      >
        <header>
          <div>
            <p className="coach-eyebrow">Materiale didattico</p>
            <h2 id="coach-video-title">Video della lezione</h2>
          </div>
          <PlayCircle className="size-5" aria-hidden="true" />
        </header>

        {lesson.variantiVideo.length > 1 ? (
          <fieldset className="coach-video-variant-tabs">
            <legend className="sr-only">Scegli variante video</legend>
            {lesson.variantiVideo.map((variant) => (
              <button
                key={variant.id}
                type="button"
                className={
                  variant.id === selectedVariant.id
                    ? 'coach-video-variant-active'
                    : undefined
                }
                aria-pressed={variant.id === selectedVariant.id}
                onClick={() => setSelectedVariantId(variant.id)}
              >
                {variant.etichetta}
              </button>
            ))}
          </fieldset>
        ) : null}

        <div className="coach-video-frame">
          <video
            key={selectedVariant.id}
            controls
            playsInline
            preload="metadata"
            aria-label={`${lesson.titolo}, ${selectedVariant.etichetta}`}
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
            Il browser non supporta la riproduzione video.
          </video>
        </div>
        <p className="coach-video-caption">{selectedVariant.etichetta}</p>
      </section>

      <div className="coach-lesson-material-grid">
        <section
          className="coach-detail-section"
          aria-labelledby="coach-key-points-title"
        >
          <header className="coach-section-header">
            <div>
              <p className="coach-eyebrow">Principio didattico</p>
              <h2 id="coach-key-points-title">Punti chiave</h2>
            </div>
            <BookOpenCheck className="size-5" aria-hidden="true" />
          </header>
          <ol className="coach-key-points-list">
            {lesson.puntiChiave.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ol>
        </section>

        <section
          className="coach-detail-section"
          aria-labelledby="coach-concepts-title"
        >
          <header className="coach-section-header">
            <div>
              <p className="coach-eyebrow">Vocabolario</p>
              <h2 id="coach-concepts-title">Concetti</h2>
            </div>
          </header>
          <div className="coach-concept-list">
            {lesson.concetti.map((concept) => (
              <span key={concept}>{concept}</span>
            ))}
          </div>
        </section>
      </div>

      <CoachLessonQuizPreview lessonId={lesson.id} />

      <section
        className="coach-detail-section coach-lesson-team-summary"
        aria-labelledby="coach-lesson-summary-title"
      >
        <header className="coach-section-header">
          <div>
            <p className="coach-eyebrow">Squadra</p>
            <h2 id="coach-lesson-summary-title">Risultati osservati</h2>
          </div>
        </header>
        <dl>
          <div>
            <dt>Completata da</dt>
            <dd>
              {aggregate.completedPlayers}/{aggregate.assignedPlayers}
            </dd>
          </div>
          <div>
            <dt>Progresso medio</dt>
            <dd>{aggregate.averageProgressPercent}%</dd>
          </div>
          <div>
            <dt>Tentativi quiz</dt>
            <dd>{aggregate.quizAttempts}</dd>
          </div>
          <div>
            <dt>Media quiz</dt>
            <dd>
              {aggregate.averageQuizPercent === undefined
                ? '—'
                : `${aggregate.averageQuizPercent}%`}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
