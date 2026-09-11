import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CoachReadModel } from '../../types/coach';
import { AttentionList } from '../components/AttentionList';
import { CoachKpiGrid } from '../components/CoachKpiGrid';
import { CoachPageHeader, DemoDataBadge } from '../components/CoachPageHeader';
import { CoachProgress } from '../components/CoachProgress';

export function CoachOverviewPage({ model }: { model: CoachReadModel }) {
  const assigned = model.lessonAggregates.reduce((total, lesson) => total + lesson.assignedPlayers, 0);
  const completed = model.lessonAggregates.reduce((total, lesson) => total + lesson.completedPlayers, 0);
  const completion = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
  const attentionPlayers = new Set(model.attention.map((item) => item.playerId)).size;

  return (
    <div className="coach-page">
      <CoachPageHeader
        eyebrow={`${model.team.name} · ${model.team.season}`}
        title="Panoramica"
        description="Una lettura rapida del percorso della squadra e delle situazioni da seguire."
        action={model.source === 'mock' ? <DemoDataBadge /> : undefined}
      />

      <CoachKpiGrid kpis={model.kpis} />

      <div className="coach-overview-grid">
        <Card className="coach-panel coach-attention-panel">
          <CardHeader className="coach-panel-header">
            <div className="coach-panel-heading">
              <span className="coach-panel-icon coach-panel-icon-alert" aria-hidden="true">
                <AlertTriangle className="size-5" />
              </span>
              <div>
                <CardTitle>Da controllare</CardTitle>
                <p>Segnali concreti che possono richiedere un tuo intervento.</p>
              </div>
            </div>
            <span
              className="coach-count-badge"
              aria-label={`${attentionPlayers} giocatori, ${model.attention.length} segnali`}
            >
              {attentionPlayers} giocatori · {model.attention.length} segnali
            </span>
          </CardHeader>
          <CardContent>
            <AttentionList items={model.attention} referenceDate={model.generatedAt} compact />
          </CardContent>
        </Card>

        <Card className="coach-panel coach-path-panel">
          <CardHeader className="coach-panel-header">
            <div className="coach-panel-heading">
              <span className="coach-panel-icon coach-panel-icon-success" aria-hidden="true">
                <CheckCircle2 className="size-5" />
              </span>
              <div>
                <CardTitle>Percorso squadra</CardTitle>
                <p>Avanzamento sulle lezioni reali assegnate.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="coach-path-content">
            <div className="coach-path-total">
              <strong>{completed}</strong>
              <span>di {assigned} lezioni completate</span>
            </div>
            <CoachProgress value={completion} label="Completamento squadra" />
            <dl className="coach-path-breakdown">
              {model.lessonAggregates.map((item) => (
                <div key={item.lesson.id}>
                  <dt>{item.lesson.titolo}</dt>
                  <dd>{item.completedPlayers} / {item.assignedPlayers}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
