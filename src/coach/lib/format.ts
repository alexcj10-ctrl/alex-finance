import type { LessonProgressStatus } from '../../data/lessons';

export const progressStatusLabels: Record<LessonProgressStatus, string> = {
  da_fare: 'Da fare',
  in_corso: 'In corso',
  completata: 'Completata',
};

export function formatNumber(value: number) {
  return new Intl.NumberFormat('it-IT').format(value);
}

export function formatRelativeDate(value: string | undefined, reference: string) {
  if (!value) return 'Mai';
  const date = Date.parse(value);
  const referenceDate = Date.parse(reference);
  if (!Number.isFinite(date) || !Number.isFinite(referenceDate)) return '—';
  const days = Math.max(Math.floor((referenceDate - date) / 86_400_000), 0);
  if (days === 0) return 'Oggi';
  if (days === 1) return 'Ieri';
  if (days < 14) return `${days} giorni fa`;
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(date);
}

export function formatDateTime(value: string) {
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return '—';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
