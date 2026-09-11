import type { CoachReadModel } from '../../types/coach';
import { CoachPageHeader, DemoDataBadge } from '../components/CoachPageHeader';
import { LessonAggregateList } from '../components/LessonAggregateList';

export function CoachLessonsPage({ model }: { model: CoachReadModel }) {
  return (
    <div className="coach-page">
      <CoachPageHeader
        eyebrow="Monitoraggio didattico"
        title="Lezioni"
        description="Lo stesso catalogo della Player App, letto a livello di squadra."
        action={model.source === 'mock' ? <DemoDataBadge /> : undefined}
      />

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
