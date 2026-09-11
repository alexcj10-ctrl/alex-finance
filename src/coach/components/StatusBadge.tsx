import { CheckCircle2, Clock3, CircleDot } from 'lucide-react';

import type { LessonProgressStatus } from '../../data/lessons';
import { progressStatusLabels } from '../lib/format';

const icons = {
  da_fare: CircleDot,
  in_corso: Clock3,
  completata: CheckCircle2,
} as const;

export function StatusBadge({ status }: { status: LessonProgressStatus }) {
  const Icon = icons[status];
  return (
    <span className={`coach-status coach-status-${status}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {progressStatusLabels[status]}
    </span>
  );
}
