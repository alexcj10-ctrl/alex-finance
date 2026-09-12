import { useState } from 'react';
import { CheckCircle2, LoaderCircle, Send } from 'lucide-react';

import { assignLessonToTeam } from '../../services/supabase/supabase-coach-actions';
import type { CoachReadModel } from '../../types/coach';
import { CoachPageHeader } from '../components/CoachPageHeader';
import { LessonAggregateList } from '../components/LessonAggregateList';

export function CoachLessonsPage({
  model,
  onDataChanged,
}: {
  model: CoachReadModel;
  onDataChanged: () => void;
}) {
  const [assigningId, setAssigningId] = useState<string>();
  const [assignedId, setAssignedId] = useState<string>();
  const [error, setError] = useState<string>();

  const assign = async (lessonId: string) => {
    setAssigningId(lessonId);
    setAssignedId(undefined);
    setError(undefined);
    try {
      await assignLessonToTeam(model.team.id, lessonId);
      setAssignedId(lessonId);
      onDataChanged();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Assegnazione non riuscita.');
    } finally {
      setAssigningId(undefined);
    }
  };

  return (
    <div className="coach-page">
      <CoachPageHeader
        eyebrow="Monitoraggio didattico"
        title="Lezioni"
        description="Lo stesso catalogo della Player App, letto a livello di squadra."
      />

      <section className="coach-assignment-panel" aria-labelledby="assignment-title">
        <header>
          <div>
            <p className="coach-create-kicker">Programmazione</p>
            <h2 id="assignment-title">Assegna alla squadra</h2>
            <p>L’assegnazione rende la lezione disponibile a tutti i player attivi.</p>
          </div>
        </header>
        <div className="coach-assignment-actions">
          {model.lessonAggregates.map((item) => (
            <button
              key={item.lesson.id}
              type="button"
              disabled={assigningId === item.lesson.id}
              onClick={() => void assign(item.lesson.id)}
            >
              {assigningId === item.lesson.id
                ? <LoaderCircle className="size-4 coach-loading-icon" aria-hidden="true" />
                : assignedId === item.lesson.id
                  ? <CheckCircle2 className="size-4" aria-hidden="true" />
                  : <Send className="size-4" aria-hidden="true" />}
              <span>{item.lesson.titolo}</span>
              <strong>{assignedId === item.lesson.id ? 'Assegnata' : 'Assegna'}</strong>
            </button>
          ))}
        </div>
        {error ? <p className="coach-create-error" role="alert">{error}</p> : null}
      </section>

      <section className="coach-list-panel" aria-labelledby="lessons-list-title">
        <header className="coach-list-toolbar">
          <div>
            <h2 id="lessons-list-title">Lezioni reali disponibili</h2>
            <p>Le varianti video restano unite allo stesso principio didattico.</p>
          </div>
          <span className="coach-count-badge">{model.lessonAggregates.length}</span>
        </header>
        <LessonAggregateList lessons={model.lessonAggregates} />
      </section>
    </div>
  );
}
