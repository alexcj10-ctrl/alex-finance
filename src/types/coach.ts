import type { Lesson, LessonProgressStatus, PhaseId } from '../data/lessons';
import type { AppRole, Json, VideoCheckpoint } from './database';

export type CoachDataSource = 'mock' | 'supabase';
export type AttentionKind =
  | 'inattivo'
  | 'lezione_non_iniziata'
  | 'lezione_bloccata'
  | 'quiz_basso';
export type AttentionSeverity = 'media' | 'alta';

export type CoachTeamRecord = {
  id: string;
  name: string;
  season: string;
};

export type CoachProfileRecord = {
  id: string;
  displayName: string;
  role: AppRole;
  playerCode?: string;
  avatarPath?: string;
  createdAt: string;
};

export type CoachMembershipRecord = {
  teamId: string;
  profileId: string;
  role: AppRole;
  active: boolean;
};

export type CoachLessonProgressRecord = {
  teamId: string;
  playerId: string;
  lessonId: string;
  status: LessonProgressStatus;
  progressPercent: number;
  assignedAt: string;
  startedAt?: string;
  completedAt?: string;
  pointsEarned: number;
  updatedAt: string;
};

export type CoachVideoProgressRecord = {
  teamId: string;
  playerId: string;
  lessonId: string;
  variantId: string;
  watchedPercent: number;
  lastPositionSeconds: number;
  lastCheckpoint: VideoCheckpoint;
  completed: boolean;
  updatedAt: string;
};

export type CoachQuizAttemptRecord = {
  id: string;
  teamId: string;
  playerId: string;
  lessonId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  completedAt: string;
};

export type CoachPlayerTrophyRecord = {
  teamId: string;
  playerId: string;
  trophyId: string;
  unlockedAt: string;
};

export type CoachActivityEventRecord = {
  id: string;
  teamId: string;
  playerId: string;
  lessonId?: string;
  eventType: string;
  metadata: Json;
  createdAt: string;
};

export type CoachDataset = {
  source: CoachDataSource;
  generatedAt: string;
  team: CoachTeamRecord;
  coachProfileId: string;
  profiles: readonly CoachProfileRecord[];
  memberships: readonly CoachMembershipRecord[];
  lessonProgress: readonly CoachLessonProgressRecord[];
  videoProgress: readonly CoachVideoProgressRecord[];
  quizAttempts: readonly CoachQuizAttemptRecord[];
  playerTrophies: readonly CoachPlayerTrophyRecord[];
  activityEvents: readonly CoachActivityEventRecord[];
};

export type AttentionItem = {
  id: string;
  playerId: string;
  lessonId?: string;
  kind: AttentionKind;
  severity: AttentionSeverity;
  title: string;
  detail: string;
  occurredAt: string;
};

export type CoachPlayerSummary = {
  playerId: string;
  displayName: string;
  playerCode?: string;
  initials: string;
  progressPercent: number;
  points: number;
  completedLessons: number;
  assignedLessons: number;
  trophyCount: number;
  lastActivityAt?: string;
  attention: readonly AttentionItem[];
};

export type CoachLessonAggregate = {
  lesson: Lesson;
  assignedPlayers: number;
  completedPlayers: number;
  inProgressPlayers: number;
  todoPlayers: number;
  averageProgressPercent: number;
  averageQuizPercent?: number;
  quizAttempts: number;
};

export type CoachKpis = {
  activePlayers: number;
  averageProgressPercent: number;
  completedLessons: number;
  averageQuizPercent?: number;
  distributedPoints: number;
};

export type CoachQuizAttemptView = CoachQuizAttemptRecord & {
  playerName: string;
  lessonTitle: string;
};

export type CoachPhaseProgress = {
  phase: PhaseId;
  availableLessons: number;
  averageProgressPercent?: number;
};

export type CoachPlayerLessonView = {
  lesson: Lesson;
  progress: CoachLessonProgressRecord;
  videos: readonly CoachVideoProgressRecord[];
  maxWatchedPercent: number;
  latestQuizAttempt?: CoachQuizAttemptRecord;
  quizAttempts: number;
};

export type CoachPlayerDetail = {
  summary: CoachPlayerSummary;
  phaseProgress: readonly CoachPhaseProgress[];
  lessons: readonly CoachPlayerLessonView[];
};

export type CoachReadModel = {
  source: CoachDataSource;
  generatedAt: string;
  team: CoachTeamRecord;
  coachName: string;
  kpis: CoachKpis;
  attention: readonly AttentionItem[];
  players: readonly CoachPlayerSummary[];
  lessonAggregates: readonly CoachLessonAggregate[];
  quizAttempts: readonly CoachQuizAttemptView[];
  getPlayerDetail: (playerId: string) => CoachPlayerDetail | undefined;
};
