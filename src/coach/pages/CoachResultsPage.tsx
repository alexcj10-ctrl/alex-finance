import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CoachQuizAttemptView, CoachReadModel } from '../../types/coach';
import { CoachPageHeader, DemoDataBadge } from '../components/CoachPageHeader';

function latestAttemptsByPlayerLesson(
  attempts: readonly CoachQuizAttemptView[],
) {
  const latestAttempts = new Map<string, CoachQuizAttemptView>();

  for (const attempt of attempts) {
    const key = `${attempt.playerId}::${attempt.lessonId}`;
    const current = latestAttempts.get(key);

    if (!current || Date.parse(attempt.completedAt) > Date.parse(current.completedAt)) {
      latestAttempts.set(key, attempt);
    }
  }

  return [...latestAttempts.values()];
}

function formatResultDate(value: string) {
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return '—';

  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function errorLabel(attempt: CoachQuizAttemptView) {
  const count = Math.max(attempt.totalQuestions - attempt.correctAnswers, 0);
  return `${count} ${count === 1 ? 'errore' : 'errori'}`;
}

export function deriveResultsOverview(
  attempts: readonly CoachQuizAttemptView[],
) {
  const latestAttempts = latestAttemptsByPlayerLesson(attempts);
  const reviewAttempts = latestAttempts
    .filter((attempt) => attempt.score < 100)
    .sort((left, right) => (
      left.score - right.score ||
      Date.parse(right.completedAt) - Date.parse(left.completedAt)
    ));

  return {
    completedCount: attempts.length,
    perfectCount: latestAttempts.filter((attempt) => attempt.score === 100).length,
    reviewAttempts,
  };
}

function ResultBadge({ score }: { score: number }) {
  const needsReview = score < 100;

  return (
    <span className={`coach-result-badge${needsReview ? ' coach-result-low' : ''}`}>
      {needsReview ? <AlertTriangle className="size-3.5" aria-hidden="true" /> : <CheckCircle2 className="size-3.5" aria-hidden="true" />}
      {Math.round(score)}%
    </span>
  );
}

function ResultRows({ attempts }: { attempts: readonly CoachQuizAttemptView[] }) {
  if (attempts.length === 0) {
    return (
      <div className="coach-empty-state">
        <strong>Nessun quiz da rivedere</strong>
        <span>Tutti gli ultimi tentativi risultano completati senza errori.</span>
      </div>
    );
  }

  return (
    <>
      <div className="coach-results-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Giocatore</TableHead>
              <TableHead scope="col">Lezione</TableHead>
              <TableHead scope="col">Risultato</TableHead>
              <TableHead scope="col">Errori</TableHead>
              <TableHead scope="col">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attempts.map((attempt) => (
              <TableRow key={attempt.id}>
                <TableCell><strong>{attempt.playerName}</strong></TableCell>
                <TableCell className="coach-wrap-cell">{attempt.lessonTitle}</TableCell>
                <TableCell><ResultBadge score={attempt.score} /></TableCell>
                <TableCell>{errorLabel(attempt)}</TableCell>
                <TableCell><time dateTime={attempt.completedAt}>{formatResultDate(attempt.completedAt)}</time></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="coach-results-cards">
        {attempts.map((attempt) => (
          <article key={attempt.id} className="coach-result-card">
            <header><strong>{attempt.playerName}</strong><ResultBadge score={attempt.score} /></header>
            <p>{attempt.lessonTitle}</p>
            <footer>
              <span>{errorLabel(attempt)}</span>
              <time dateTime={attempt.completedAt}>{formatResultDate(attempt.completedAt)}</time>
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}

export function CoachResultsPage({ model }: { model: CoachReadModel }) {
  const results = deriveResultsOverview(model.quizAttempts);

  return (
    <div className="coach-page">
      <CoachPageHeader
        eyebrow="Fondazione quiz"
        title="Risultati"
        description="Una visione generale dei quiz e delle situazioni da rivedere."
        action={model.source === 'mock' ? <DemoDataBadge /> : undefined}
      />

      <div className="coach-results-summary">
        <Card className="coach-result-summary-card">
          <CardContent><span>Media quiz</span><strong>{model.kpis.averageQuizPercent ?? '—'}{model.kpis.averageQuizPercent === undefined ? '' : '%'}</strong></CardContent>
        </Card>
        <Card className="coach-result-summary-card">
          <CardContent><span>Quiz completati</span><strong>{results.completedCount}</strong></CardContent>
        </Card>
        <Card className="coach-result-summary-card coach-result-summary-alert">
          <CardContent><span>Da rivedere</span><strong>{results.reviewAttempts.length}</strong></CardContent>
        </Card>
        <Card className="coach-result-summary-card">
          <CardContent><span>Quiz perfetti</span><strong>{results.perfectCount}</strong></CardContent>
        </Card>
      </div>

      <section className="coach-list-panel" aria-labelledby="results-list-title">
        <header className="coach-list-toolbar">
          <div><h2 id="results-list-title">Da rivedere</h2><p>Quiz in cui c’è stato almeno un errore.</p></div>
        </header>
        <ResultRows attempts={results.reviewAttempts} />
      </section>
    </div>
  );
}
