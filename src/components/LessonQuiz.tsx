import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleHelp, LoaderCircle, RotateCcw, XCircle } from 'lucide-react';

import type { Json } from '../types/database';
import type {
  QuizAnswerResult,
  QuizAttemptResult,
  QuizChoice,
  QuizQuestion,
} from '../types/quiz';
import { requireSupabaseClient } from '../services/supabase/client';

type LessonQuizProps = {
  lessonId: string;
  teamId: string;
  onSubmitted: () => Promise<void>;
};

function parseChoices(value: Json): readonly [QuizChoice, QuizChoice, ...QuizChoice[]] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const choices: QuizChoice[] = [];

  for (const item of value) {
    if (
      !item ||
      Array.isArray(item) ||
      typeof item !== 'object' ||
      typeof item.id !== 'string' ||
      typeof item.label !== 'string'
    ) {
      return null;
    }
    choices.push({ id: item.id, label: item.label });
  }

  return choices as [QuizChoice, QuizChoice, ...QuizChoice[]];
}

function parseAttemptResult(value: Json): QuizAttemptResult | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const answersValue = value.answers;
  if (!Array.isArray(answersValue)) return null;

  const answers: QuizAnswerResult[] = [];
  for (const answer of answersValue) {
    if (
      !answer ||
      Array.isArray(answer) ||
      typeof answer !== 'object' ||
      typeof answer.questionId !== 'string' ||
      typeof answer.selectedChoiceId !== 'string' ||
      typeof answer.isCorrect !== 'boolean' ||
      typeof answer.feedback !== 'string'
    ) {
      return null;
    }
    answers.push({
      questionId: answer.questionId,
      selectedChoiceId: answer.selectedChoiceId,
      isCorrect: answer.isCorrect,
      feedback: answer.feedback,
    });
  }

  if (
    typeof value.attemptId !== 'string' ||
    typeof value.attemptNumber !== 'number' ||
    typeof value.totalQuestions !== 'number' ||
    typeof value.correctAnswers !== 'number' ||
    typeof value.percentage !== 'number' ||
    typeof value.pointsEarned !== 'number' ||
    typeof value.completedAt !== 'string'
  ) {
    return null;
  }

  return {
    attemptId: value.attemptId,
    attemptNumber: value.attemptNumber,
    totalQuestions: value.totalQuestions,
    correctAnswers: value.correctAnswers,
    percentage: value.percentage,
    pointsEarned: value.pointsEarned,
    completedAt: value.completedAt,
    answers,
  };
}

export function LessonQuiz({ lessonId, teamId, onSubmitted }: LessonQuizProps) {
  const [questions, setQuestions] = useState<readonly QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizAttemptResult>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'submitting' | 'error'>('loading');
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    void requireSupabaseClient()
      .from('quiz_questions')
      .select('id, prompt, choices, position')
      .eq('lesson_id', lessonId)
      .eq('active', true)
      .order('position')
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError('Non siamo riusciti a caricare il quiz.');
          setStatus('error');
          return;
        }

        const parsed = (data ?? []).flatMap((row) => {
          const choices = parseChoices(row.choices);
          return choices
            ? [{ id: row.id, domanda: row.prompt, risposte: choices }]
            : [];
        });
        setQuestions(parsed);
        setStatus('ready');
      });

    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const canSubmit = useMemo(
    () => questions.length >= 2 && questions.every((question) => answers[question.id]),
    [answers, questions],
  );

  if (status === 'loading') {
    return (
      <output className="lesson-quiz lesson-quiz-loading" aria-live="polite">
        <LoaderCircle className="size-5 auth-spinner" aria-hidden="true" /> Prepariamo il quiz…
      </output>
    );
  }

  if (questions.length === 0 && status !== 'error') return null;

  const submit = async () => {
    if (!canSubmit || status === 'submitting') return;
    setStatus('submitting');
    setError(undefined);

    const { data, error: submitError } = await requireSupabaseClient().rpc('submit_quiz', {
      p_team_id: teamId,
      p_lesson_id: lessonId,
      p_answers: answers,
      p_client_attempt_id: crypto.randomUUID(),
    });
    const parsed = data ? parseAttemptResult(data) : null;
    if (submitError || !parsed) {
      setError('Non siamo riusciti a inviare il quiz. Riprova.');
      setStatus('error');
      return;
    }

    setResult(parsed);
    setStatus('ready');
    await onSubmitted();
  };

  const reset = () => {
    setAnswers({});
    setResult(undefined);
    setError(undefined);
    setStatus('ready');
  };

  return (
    <section className="lesson-quiz" aria-labelledby={`quiz-title-${lessonId}`}>
      <header className="lesson-quiz-heading">
        <span aria-hidden="true"><CircleHelp className="size-5" /></span>
        <div>
          <small>Mettiamoci alla prova</small>
          <h2 id={`quiz-title-${lessonId}`}>Quiz della lezione</h2>
        </div>
      </header>

      {result ? (
        <output className="lesson-quiz-result">
          <strong>{Math.round(result.percentage)}%</strong>
          <span>{result.correctAnswers} risposte corrette su {result.totalQuestions}</span>
        </output>
      ) : null}

      <div className="lesson-quiz-questions">
        {questions.map((question, index) => {
          const answerResult = result?.answers.find(
            (answer) => answer.questionId === question.id,
          );
          return (
            <fieldset key={question.id} disabled={Boolean(result)}>
              <legend><span>{index + 1}</span>{question.domanda}</legend>
              <div className="lesson-quiz-choices">
                {question.risposte.map((choice) => (
                  <label key={choice.id}>
                    <input
                      type="radio"
                      name={`quiz-${question.id}`}
                      value={choice.id}
                      checked={answers[question.id] === choice.id}
                      onChange={() => setAnswers((current) => ({
                        ...current,
                        [question.id]: choice.id,
                      }))}
                    />
                    <span>{choice.label}</span>
                  </label>
                ))}
              </div>
              {answerResult ? (
                <p className={answerResult.isCorrect ? 'quiz-feedback-correct' : 'quiz-feedback-wrong'}>
                  {answerResult.isCorrect
                    ? <CheckCircle2 className="size-4" aria-hidden="true" />
                    : <XCircle className="size-4" aria-hidden="true" />}
                  {answerResult.feedback}
                </p>
              ) : null}
            </fieldset>
          );
        })}
      </div>

      {error ? <p className="lesson-action-error" role="alert">{error}</p> : null}

      {result ? (
        <button type="button" className="quiz-submit-button quiz-retry-button" onClick={reset}>
          <RotateCcw className="size-4" aria-hidden="true" /> Riprova il quiz
        </button>
      ) : (
        <button
          type="button"
          className="quiz-submit-button"
          disabled={!canSubmit || status === 'submitting'}
          onClick={() => void submit()}
        >
          {status === 'submitting'
            ? <><LoaderCircle className="size-4 auth-spinner" aria-hidden="true" /> Invio…</>
            : 'Controlla le risposte'}
        </button>
      )}
    </section>
  );
}
