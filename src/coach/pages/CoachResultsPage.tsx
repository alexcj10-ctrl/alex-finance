import { AlertTriangle, BarChart3, CheckCircle2 } from 'lucide-react';

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
import { formatDateTime } from '../lib/format';

function ResultBadge({ score }: { score: number }) {
  return (
    <span className={`coach-result-badge${score < 60 ? ' coach-result-low' : ''}`}>
      {score < 60 ? <AlertTriangle className="size-3.5" aria-hidden="true" /> : <CheckCircle2 className="size-3.5" aria-hidden="true" />}
      {Math.round(score)}%
    </span>
  );
}

function ResultRows({ attempts }: { attempts: readonly CoachQuizAttemptView[] }) {
  if (attempts.length === 0) {
    return (
      <div className="coach-empty-state">
        <strong>Nessun tentativo registrato</strong>
        <span>I risultati compariranno qui quando i quiz saranno attivi.</span>
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
              <TableHead scope="col">Risposte</TableHead>
              <TableHead scope="col">Risultato</TableHead>
              <TableHead scope="col">Completato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attempts.map((attempt) => (
              <TableRow key={attempt.id}>
                <TableCell><strong>{attempt.playerName}</strong></TableCell>
                <TableCell className="coach-wrap-cell">{attempt.lessonTitle}</TableCell>
                <TableCell>{attempt.correctAnswers} / {attempt.totalQuestions}</TableCell>
                <TableCell><ResultBadge score={attempt.score} /></TableCell>
                <TableCell><time dateTime={attempt.completedAt}>{formatDateTime(attempt.completedAt)}</time></TableCell>
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
              <span>{attempt.correctAnswers} su {attempt.totalQuestions} corrette</span>
              <time dateTime={attempt.completedAt}>{formatDateTime(attempt.completedAt)}</time>
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}

export function CoachResultsPage({ model }: { model: CoachReadModel }) {
  const lowResults = model.quizAttempts.filter((attempt) => attempt.score < 60).length;

  return (
    <div className="coach-page">
      <CoachPageHeader
        eyebrow="Fondazione quiz"
        title="Risultati"
        description="Una base pronta per leggere punteggi e tentativi, senza introdurre ancora questionari reali."
        action={model.source === 'mock' ? <DemoDataBadge /> : undefined}
      />

      <div className="coach-results-summary">
        <Card className="coach-result-summary-card">
          <CardContent><span>Media quiz</span><strong>{model.kpis.averageQuizPercent ?? '—'}{model.kpis.averageQuizPercent === undefined ? '' : '%'}</strong></CardContent>
        </Card>
        <Card className="coach-result-summary-card">
          <CardContent><span>Tentativi registrati</span><strong>{model.quizAttempts.length}</strong></CardContent>
        </Card>
        <Card className="coach-result-summary-card coach-result-summary-alert">
          <CardContent><span>Risultati sotto 60%</span><strong>{lowResults}</strong></CardContent>
        </Card>
      </div>

      <aside className="coach-foundation-note">
        <BarChart3 className="size-5" aria-hidden="true" />
        <div>
          <strong>Struttura pronta, quiz reali non ancora attivi</strong>
          <span>I valori mostrati servono esclusivamente a validare la lettura Coach.</span>
        </div>
      </aside>

      <section className="coach-list-panel" aria-labelledby="results-list-title">
        <header className="coach-list-toolbar">
          <div><h2 id="results-list-title">Tentativi recenti</h2><p>Risposte corrette, percentuale e data di completamento.</p></div>
        </header>
        <ResultRows attempts={model.quizAttempts} />
      </section>
    </div>
  );
}
