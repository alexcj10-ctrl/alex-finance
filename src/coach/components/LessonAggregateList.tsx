/* oxlint-disable next/no-html-link-for-pages -- App Vite con routing History API. */
import type { MouseEvent } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Clock3 } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { phaseLabels } from '../../data/lessons';
import type { CoachLessonAggregate } from '../../types/coach';
import { navigateCoach } from '../routes';
import { CoachProgress } from './CoachProgress';

function lessonPath(lessonId: string) {
  return `/coach/lezioni/${encodeURIComponent(lessonId)}`;
}

function handleLessonNavigation(event: MouseEvent<HTMLAnchorElement>, lessonId: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateCoach(lessonPath(lessonId));
}

function QuizValue({ value, attempts }: { value?: number; attempts: number }) {
  return value === undefined ? <span className="coach-muted-value">—</span> : <span>{value}% · {attempts} tent.</span>;
}

export function LessonAggregateList({ lessons }: { lessons: readonly CoachLessonAggregate[] }) {
  return (
    <>
      <div className="coach-lesson-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Lezione</TableHead>
              <TableHead scope="col">Completata da</TableHead>
              <TableHead scope="col">In corso</TableHead>
              <TableHead scope="col">Da iniziare</TableHead>
              <TableHead scope="col">Progresso medio</TableHead>
              <TableHead scope="col">Media quiz</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lessons.map((item) => (
              <TableRow key={item.lesson.id}>
                <TableCell>
                  <span className="coach-lesson-identity">
                    <span aria-hidden="true"><BookOpen className="size-5" /></span>
                    <span>
                      <strong>{item.lesson.titolo}</strong>
                      <small>{phaseLabels[item.lesson.fase]}</small>
                      <a
                        className="coach-lesson-inline-link"
                        href={lessonPath(item.lesson.id)}
                        onClick={(event) => handleLessonNavigation(event, item.lesson.id)}
                      >
                        Apri lezione <ArrowRight className="size-3" aria-hidden="true" />
                      </a>
                    </span>
                  </span>
                </TableCell>
                <TableCell><strong>{item.completedPlayers}</strong> / {item.assignedPlayers}</TableCell>
                <TableCell>{item.inProgressPlayers}</TableCell>
                <TableCell>{item.todoPlayers}</TableCell>
                <TableCell className="coach-progress-cell"><CoachProgress value={item.averageProgressPercent} /></TableCell>
                <TableCell><QuizValue value={item.averageQuizPercent} attempts={item.quizAttempts} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="coach-lesson-cards">
        {lessons.map((item) => (
          <article className="coach-lesson-card" key={item.lesson.id}>
            <header>
              <span className="coach-lesson-icon" aria-hidden="true"><BookOpen className="size-5" /></span>
              <div><strong>{item.lesson.titolo}</strong><span>{phaseLabels[item.lesson.fase]}</span></div>
            </header>
            <CoachProgress value={item.averageProgressPercent} label="Progresso medio" />
            <div className="coach-lesson-counts">
              <span><CheckCircle2 className="size-4" aria-hidden="true" /> Completata da {item.completedPlayers}/{item.assignedPlayers}</span>
              <span><Clock3 className="size-4" aria-hidden="true" /> In corso: {item.inProgressPlayers}</span>
              <span>Da iniziare: {item.todoPlayers}</span>
            </div>
            <div className="coach-quiz-summary"><span>Media quiz</span><strong><QuizValue value={item.averageQuizPercent} attempts={item.quizAttempts} /></strong></div>
            <a
              className="coach-card-link"
              href={lessonPath(item.lesson.id)}
              onClick={(event) => handleLessonNavigation(event, item.lesson.id)}
            >
              Consulta la lezione <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
    </>
  );
}
