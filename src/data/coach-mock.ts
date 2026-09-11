import type {
  CoachActivityEventRecord,
  CoachDataset,
  CoachLessonProgressRecord,
  CoachProfileRecord,
  CoachQuizAttemptRecord,
  CoachVideoProgressRecord,
} from '../types/coach';
import type { LessonProgressStatus } from './lessons';

const teamId = 'mock-team-poggio-esordienti-2026';
const generatedAt = '2026-09-11T12:00:00.000Z';

const lessonIds = {
  ampiezza: 'costruzione-creare-ampiezza',
  terzoUomo: 'costruzione-attira-uomo-libero',
  pressione: 'pressione-alta-chiudi-centro-porta-fuori',
} as const;

const playerProfiles = [
  ['mock-player-01', 'Leo'],
  ['mock-player-02', 'Samu'],
  ['mock-player-03', 'Nico'],
  ['mock-player-04', 'Tommi'],
  ['mock-player-05', 'Dado'],
  ['mock-player-06', 'Ale'],
  ['mock-player-07', 'Gio'],
  ['mock-player-08', 'Fede'],
] as const;

const profiles: readonly CoachProfileRecord[] = [
  {
    id: 'mock-coach-01',
    displayName: 'Mister Andrea',
    role: 'coach',
    createdAt: '2026-08-20T09:00:00.000Z',
  },
  ...playerProfiles.map(([id, displayName]) => ({
    id,
    displayName,
    role: 'player' as const,
    createdAt: '2026-08-25T09:00:00.000Z',
  })),
];

type ProgressDates = {
  assignedAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
};

function progress(
  playerId: string,
  lessonId: string,
  status: LessonProgressStatus,
  progressPercent: number,
  pointsEarned: number,
  dates: ProgressDates,
): CoachLessonProgressRecord {
  return {
    teamId,
    playerId,
    lessonId,
    status,
    progressPercent,
    pointsEarned,
    ...dates,
  };
}

const oldAssignment = '2026-09-01T16:00:00.000Z';
const recentAssignment = '2026-09-09T16:00:00.000Z';

const lessonProgress: readonly CoachLessonProgressRecord[] = [
  progress('mock-player-01', lessonIds.ampiezza, 'completata', 100, 60, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-02T16:20:00.000Z',
    completedAt: '2026-09-02T16:27:00.000Z',
    updatedAt: '2026-09-02T16:27:00.000Z',
  }),
  progress('mock-player-01', lessonIds.terzoUomo, 'completata', 100, 60, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-05T17:10:00.000Z',
    completedAt: '2026-09-05T17:18:00.000Z',
    updatedAt: '2026-09-05T17:18:00.000Z',
  }),
  progress('mock-player-01', lessonIds.pressione, 'completata', 100, 50, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-10T18:04:00.000Z',
    completedAt: '2026-09-10T18:11:00.000Z',
    updatedAt: '2026-09-10T18:11:00.000Z',
  }),
  progress('mock-player-02', lessonIds.ampiezza, 'completata', 100, 60, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-03T15:20:00.000Z',
    completedAt: '2026-09-03T15:28:00.000Z',
    updatedAt: '2026-09-03T15:28:00.000Z',
  }),
  progress('mock-player-02', lessonIds.terzoUomo, 'in_corso', 75, 0, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-10T17:00:00.000Z',
    updatedAt: '2026-09-11T08:20:00.000Z',
  }),
  progress('mock-player-02', lessonIds.pressione, 'completata', 100, 50, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-10T17:14:00.000Z',
    completedAt: '2026-09-10T17:22:00.000Z',
    updatedAt: '2026-09-10T17:22:00.000Z',
  }),
  progress('mock-player-03', lessonIds.ampiezza, 'completata', 100, 60, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-04T17:10:00.000Z',
    completedAt: '2026-09-04T17:18:00.000Z',
    updatedAt: '2026-09-04T17:18:00.000Z',
  }),
  progress('mock-player-03', lessonIds.terzoUomo, 'da_fare', 0, 0, {
    assignedAt: recentAssignment,
    updatedAt: recentAssignment,
  }),
  progress('mock-player-03', lessonIds.pressione, 'in_corso', 50, 0, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-06T10:00:00.000Z',
    updatedAt: '2026-09-09T10:00:00.000Z',
  }),
  progress('mock-player-04', lessonIds.ampiezza, 'in_corso', 50, 0, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-04T16:00:00.000Z',
    updatedAt: '2026-09-05T16:20:00.000Z',
  }),
  progress('mock-player-04', lessonIds.terzoUomo, 'da_fare', 0, 0, {
    assignedAt: recentAssignment,
    updatedAt: recentAssignment,
  }),
  progress('mock-player-04', lessonIds.pressione, 'da_fare', 0, 0, {
    assignedAt: recentAssignment,
    updatedAt: recentAssignment,
  }),
  progress('mock-player-05', lessonIds.ampiezza, 'completata', 100, 60, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-03T18:00:00.000Z',
    completedAt: '2026-09-03T18:09:00.000Z',
    updatedAt: '2026-09-03T18:09:00.000Z',
  }),
  progress('mock-player-05', lessonIds.terzoUomo, 'completata', 100, 60, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-08T18:00:00.000Z',
    completedAt: '2026-09-08T18:08:00.000Z',
    updatedAt: '2026-09-08T18:08:00.000Z',
  }),
  progress('mock-player-05', lessonIds.pressione, 'da_fare', 0, 0, {
    assignedAt: recentAssignment,
    updatedAt: recentAssignment,
  }),
  progress('mock-player-06', lessonIds.ampiezza, 'da_fare', 0, 0, {
    assignedAt: oldAssignment,
    updatedAt: oldAssignment,
  }),
  progress('mock-player-06', lessonIds.terzoUomo, 'da_fare', 0, 0, {
    assignedAt: oldAssignment,
    updatedAt: oldAssignment,
  }),
  progress('mock-player-06', lessonIds.pressione, 'da_fare', 0, 0, {
    assignedAt: oldAssignment,
    updatedAt: oldAssignment,
  }),
  progress('mock-player-07', lessonIds.ampiezza, 'completata', 100, 60, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-04T18:00:00.000Z',
    completedAt: '2026-09-04T18:09:00.000Z',
    updatedAt: '2026-09-04T18:09:00.000Z',
  }),
  progress('mock-player-07', lessonIds.terzoUomo, 'in_corso', 25, 0, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-08T16:00:00.000Z',
    updatedAt: '2026-09-08T16:04:00.000Z',
  }),
  progress('mock-player-07', lessonIds.pressione, 'in_corso', 75, 0, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-08T16:10:00.000Z',
    updatedAt: '2026-09-08T16:16:00.000Z',
  }),
  progress('mock-player-08', lessonIds.ampiezza, 'completata', 100, 60, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-02T17:00:00.000Z',
    completedAt: '2026-09-02T17:08:00.000Z',
    updatedAt: '2026-09-02T17:08:00.000Z',
  }),
  progress('mock-player-08', lessonIds.terzoUomo, 'completata', 100, 60, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-06T17:00:00.000Z',
    completedAt: '2026-09-06T17:08:00.000Z',
    updatedAt: '2026-09-06T17:08:00.000Z',
  }),
  progress('mock-player-08', lessonIds.pressione, 'completata', 100, 50, {
    assignedAt: oldAssignment,
    startedAt: '2026-09-10T17:00:00.000Z',
    completedAt: '2026-09-10T17:07:00.000Z',
    updatedAt: '2026-09-10T17:07:00.000Z',
  }),
];

function video(
  playerId: string,
  lessonId: string,
  variantId: string,
  watchedPercent: number,
  updatedAt: string,
): CoachVideoProgressRecord {
  const checkpoint = watchedPercent >= 100 ? 100 : watchedPercent >= 75 ? 75 : watchedPercent >= 50 ? 50 : watchedPercent >= 25 ? 25 : 0;

  return {
    teamId,
    playerId,
    lessonId,
    variantId,
    watchedPercent,
    lastPositionSeconds: Math.round(watchedPercent * 0.12),
    lastCheckpoint: checkpoint,
    completed: watchedPercent === 100,
    updatedAt,
  };
}

const videoProgress: readonly CoachVideoProgressRecord[] = [
  video('mock-player-01', lessonIds.ampiezza, 'variante-a', 100, '2026-09-02T16:27:00.000Z'),
  video('mock-player-01', lessonIds.terzoUomo, 'terzo-uomo-dx', 100, '2026-09-05T17:18:00.000Z'),
  video('mock-player-01', lessonIds.pressione, 'pressione-alta-dx', 100, '2026-09-10T18:11:00.000Z'),
  video('mock-player-02', lessonIds.ampiezza, 'variante-b', 100, '2026-09-03T15:28:00.000Z'),
  video('mock-player-02', lessonIds.terzoUomo, 'terzo-uomo-dx', 75, '2026-09-11T08:20:00.000Z'),
  video('mock-player-02', lessonIds.pressione, 'pressione-alta-sx', 100, '2026-09-10T17:22:00.000Z'),
  video('mock-player-03', lessonIds.ampiezza, 'variante-a', 100, '2026-09-04T17:18:00.000Z'),
  video('mock-player-03', lessonIds.pressione, 'pressione-alta-dx', 50, '2026-09-09T10:00:00.000Z'),
  video('mock-player-04', lessonIds.ampiezza, 'variante-b', 50, '2026-09-05T16:20:00.000Z'),
  video('mock-player-05', lessonIds.ampiezza, 'variante-a', 100, '2026-09-03T18:09:00.000Z'),
  video('mock-player-05', lessonIds.terzoUomo, 'terzo-uomo-dx', 100, '2026-09-08T18:08:00.000Z'),
  video('mock-player-07', lessonIds.ampiezza, 'variante-b', 100, '2026-09-04T18:09:00.000Z'),
  video('mock-player-07', lessonIds.terzoUomo, 'terzo-uomo-dx', 25, '2026-09-08T16:04:00.000Z'),
  video('mock-player-07', lessonIds.pressione, 'pressione-alta-sx', 75, '2026-09-08T16:16:00.000Z'),
  video('mock-player-08', lessonIds.ampiezza, 'variante-a', 100, '2026-09-02T17:08:00.000Z'),
  video('mock-player-08', lessonIds.terzoUomo, 'terzo-uomo-dx', 100, '2026-09-06T17:08:00.000Z'),
  video('mock-player-08', lessonIds.pressione, 'pressione-alta-dx', 100, '2026-09-10T17:07:00.000Z'),
];

function quiz(
  id: string,
  playerId: string,
  lessonId: string,
  correctAnswers: number,
  completedAt: string,
): CoachQuizAttemptRecord {
  return {
    id,
    teamId,
    playerId,
    lessonId,
    score: Math.round((correctAnswers / 3) * 100),
    totalQuestions: 3,
    correctAnswers,
    completedAt,
  };
}

const quizAttempts: readonly CoachQuizAttemptRecord[] = [
  quiz('mock-quiz-01', 'mock-player-01', lessonIds.ampiezza, 3, '2026-09-02T16:30:00.000Z'),
  quiz('mock-quiz-02', 'mock-player-01', lessonIds.terzoUomo, 2, '2026-09-05T17:20:00.000Z'),
  quiz('mock-quiz-03', 'mock-player-02', lessonIds.ampiezza, 2, '2026-09-03T15:31:00.000Z'),
  quiz('mock-quiz-04', 'mock-player-02', lessonIds.pressione, 3, '2026-09-10T17:25:00.000Z'),
  quiz('mock-quiz-05', 'mock-player-03', lessonIds.ampiezza, 1, '2026-09-04T17:21:00.000Z'),
  quiz('mock-quiz-06', 'mock-player-05', lessonIds.terzoUomo, 2, '2026-09-08T18:11:00.000Z'),
  quiz('mock-quiz-07', 'mock-player-07', lessonIds.ampiezza, 1, '2026-09-04T18:12:00.000Z'),
  quiz('mock-quiz-08', 'mock-player-07', lessonIds.ampiezza, 2, '2026-09-08T16:20:00.000Z'),
  quiz('mock-quiz-09', 'mock-player-08', lessonIds.pressione, 3, '2026-09-10T17:10:00.000Z'),
];

const lastActivityByPlayer: Record<string, string> = {
  'mock-player-01': '2026-09-10T18:11:00.000Z',
  'mock-player-02': '2026-09-11T08:20:00.000Z',
  'mock-player-03': '2026-09-06T10:00:00.000Z',
  'mock-player-04': '2026-09-05T16:20:00.000Z',
  'mock-player-05': '2026-09-09T18:08:00.000Z',
  'mock-player-06': '2026-08-30T10:00:00.000Z',
  'mock-player-07': '2026-09-08T16:20:00.000Z',
  'mock-player-08': '2026-09-10T17:10:00.000Z',
};

const activityEvents: readonly CoachActivityEventRecord[] = playerProfiles.map(([playerId]) => ({
  id: `mock-activity-${playerId}`,
  teamId,
  playerId,
  eventType: 'app_opened',
  metadata: { source: 'mock' },
  createdAt: lastActivityByPlayer[playerId],
}));

export const mockCoachDataset = {
  source: 'mock',
  generatedAt,
  team: {
    id: teamId,
    name: 'Poggio Mirteto Esordienti',
    season: '2026/27',
  },
  coachProfileId: 'mock-coach-01',
  profiles,
  memberships: [
    { teamId, profileId: 'mock-coach-01', role: 'coach', active: true },
    ...playerProfiles.map(([profileId]) => ({
      teamId,
      profileId,
      role: 'player' as const,
      active: true,
    })),
  ],
  lessonProgress,
  videoProgress,
  quizAttempts,
  playerTrophies: [
    { teamId, playerId: 'mock-player-01', trophyId: 'prima-lezione', unlockedAt: '2026-09-02T16:27:00.000Z' },
    { teamId, playerId: 'mock-player-01', trophyId: 'costruttore', unlockedAt: '2026-09-05T17:18:00.000Z' },
    { teamId, playerId: 'mock-player-01', trophyId: 'cento-punti', unlockedAt: '2026-09-05T17:18:00.000Z' },
    { teamId, playerId: 'mock-player-02', trophyId: 'prima-lezione', unlockedAt: '2026-09-03T15:28:00.000Z' },
    { teamId, playerId: 'mock-player-02', trophyId: 'cento-punti', unlockedAt: '2026-09-10T17:22:00.000Z' },
    { teamId, playerId: 'mock-player-03', trophyId: 'prima-lezione', unlockedAt: '2026-09-04T17:18:00.000Z' },
    { teamId, playerId: 'mock-player-05', trophyId: 'prima-lezione', unlockedAt: '2026-09-03T18:09:00.000Z' },
    { teamId, playerId: 'mock-player-05', trophyId: 'costruttore', unlockedAt: '2026-09-08T18:08:00.000Z' },
    { teamId, playerId: 'mock-player-05', trophyId: 'cento-punti', unlockedAt: '2026-09-08T18:08:00.000Z' },
    { teamId, playerId: 'mock-player-07', trophyId: 'prima-lezione', unlockedAt: '2026-09-04T18:09:00.000Z' },
    { teamId, playerId: 'mock-player-08', trophyId: 'prima-lezione', unlockedAt: '2026-09-02T17:08:00.000Z' },
    { teamId, playerId: 'mock-player-08', trophyId: 'costruttore', unlockedAt: '2026-09-06T17:08:00.000Z' },
    { teamId, playerId: 'mock-player-08', trophyId: 'cento-punti', unlockedAt: '2026-09-06T17:08:00.000Z' },
  ],
  activityEvents,
} as const satisfies CoachDataset;
