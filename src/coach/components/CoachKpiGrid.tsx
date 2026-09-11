import { Activity, BookOpen, CircleDot, Star, Users } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { CoachKpis } from '../../types/coach';
import { formatNumber } from '../lib/format';

const items = [
  { key: 'activePlayers', label: 'Giocatori attivi', icon: Users, tone: 'green' },
  { key: 'averageProgressPercent', label: 'Progresso medio', icon: Activity, tone: 'green', suffix: '%' },
  { key: 'completedLessons', label: 'Lezioni completate', icon: BookOpen, tone: 'ink' },
  { key: 'averageQuizPercent', label: 'Media quiz', icon: CircleDot, tone: 'amber', suffix: '%' },
  { key: 'distributedPoints', label: 'Punti distribuiti', icon: Star, tone: 'red' },
] as const;

export function CoachKpiGrid({ kpis }: { kpis: CoachKpis }) {
  return (
    <section className="coach-kpi-grid" aria-label="Indicatori principali">
      {items.map((item) => {
        const Icon = item.icon;
        const value = kpis[item.key];
        return (
          <Card key={item.key} className="coach-kpi-card">
            <CardContent>
              <span className={`coach-kpi-icon coach-kpi-icon-${item.tone}`} aria-hidden="true">
                <Icon className="size-5" />
              </span>
              <span className="coach-kpi-label">{item.label}</span>
              <strong className="coach-kpi-value">
                {value === undefined
                  ? '—'
                  : `${formatNumber(value)}${'suffix' in item ? item.suffix : ''}`}
              </strong>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
