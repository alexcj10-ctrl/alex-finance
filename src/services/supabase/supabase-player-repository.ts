import type { AuthIdentity } from '../../auth/auth-types';
import { createInitialLearningProgress, type StoredLearningProgress } from '../../lib/learning-progress';
import type { Database } from '../../types/database';
import type {
  StoredVideoProgress,
  VideoProgressCheckpointInput,
} from '../../types/video-progress';
import { requireSupabaseClient } from './client';

type Tables = Database['public']['Tables'];
type LessonProgressRow = Tables['lesson_progress']['Row'];
type VideoProgressRow = Tables['video_progress']['Row'];

export type PlayerLearningSnapshot = {
  progress: StoredLearningProgress;
  assignedLessonIds: readonly string[];
  videos: readonly StoredVideoProgress[];
};

function mapVideoProgress(row: VideoProgressRow): StoredVideoProgress {
  const reached = [
    ...(row.last_checkpoint >= 0 ? (['started'] as const) : []),
    ...([25, 50, 75, 100] as const).filter((checkpoint) => row.last_checkpoint >= checkpoint),
  ];

  return {
    lessonId: row.lesson_id,
    variantId: row.variant_id,
    watchedPercent: row.watched_percent,
    lastPositionSeconds: Number(row.last_position_seconds),
    completed: row.completed,
    reachedCheckpoints: reached,
    updatedAt: row.updated_at,
  };
}

function mapLearningProgress(
  identity: AuthIdentity,
  lessonRows: readonly LessonProgressRow[],
  trophies: readonly Tables['player_trophies']['Row'][],
): StoredLearningProgress {
  const progress = createInitialLearningProgress();
  progress.ownerId = identity.userId;
  progress.updatedAt = lessonRows.reduce(
    (latest, row) => Date.parse(row.updated_at) > Date.parse(latest) ? row.updated_at : latest,
    progress.updatedAt,
  );

  for (const row of lessonRows) {
    if (row.status === 'da_fare') continue;
    progress.lessonProgress[row.lesson_id] = {
      startedAt: row.started_at ?? row.updated_at,
      ...(row.completed_at ? { completedAt: row.completed_at } : {}),
      ...(row.status === 'completata' ? { pointsAwarded: row.points_earned } : {}),
    };
  }

  for (const trophy of trophies) {
    progress.trophyUnlocks[trophy.trophy_id] = { unlockedAt: trophy.unlocked_at };
  }

  return progress;
}

function assertPlayer(identity: AuthIdentity) {
  if (identity.role !== 'player') {
    throw new Error('Questa operazione è riservata ai giocatori.');
  }
}

function friendlyMutationError(message: string) {
  if (message.includes('required video progress')) {
    return new Error('Guarda il video fino alla fine prima di completare la lezione.');
  }
  if (message.includes('required quiz score')) {
    return new Error('Completa il quiz con almeno il 50% di risposte corrette.');
  }
  if (message.includes('assignment')) {
    return new Error('Questa lezione non è ancora stata assegnata dal coach.');
  }
  return new Error('Non siamo riusciti a sincronizzare il progresso. Riprova.');
}

export async function loadPlayerLearningSnapshot(
  identity: AuthIdentity,
): Promise<PlayerLearningSnapshot> {
  assertPlayer(identity);
  const client = requireSupabaseClient();
  const [progressResult, videosResult, trophiesResult] = await Promise.all([
    client
      .from('lesson_progress')
      .select('*')
      .eq('team_id', identity.teamId)
      .eq('player_id', identity.userId)
      .order('assigned_at'),
    client
      .from('video_progress')
      .select('*')
      .eq('team_id', identity.teamId)
      .eq('player_id', identity.userId),
    client
      .from('player_trophies')
      .select('*')
      .eq('team_id', identity.teamId)
      .eq('player_id', identity.userId),
  ]);

  const error = progressResult.error ?? videosResult.error ?? trophiesResult.error;
  if (error) throw new Error(`Lettura progressi non riuscita: ${error.message}`);

  const lessonRows = progressResult.data ?? [];
  return {
    progress: mapLearningProgress(identity, lessonRows, trophiesResult.data ?? []),
    assignedLessonIds: lessonRows.map((row) => row.lesson_id),
    videos: (videosResult.data ?? []).map(mapVideoProgress),
  };
}

export async function recordPlayerLogin(identity: AuthIdentity) {
  assertPlayer(identity);
  const { error } = await requireSupabaseClient().rpc('record_login', {
    p_team_id: identity.teamId,
  });
  if (error) throw friendlyMutationError(error.message);
}

export async function startPlayerLesson(identity: AuthIdentity, lessonId: string) {
  assertPlayer(identity);
  const { error } = await requireSupabaseClient().rpc('start_lesson', {
    p_team_id: identity.teamId,
    p_lesson_id: lessonId,
  });
  if (error) throw friendlyMutationError(error.message);
}

export async function completePlayerLesson(identity: AuthIdentity, lessonId: string) {
  assertPlayer(identity);
  const { error } = await requireSupabaseClient().rpc('complete_lesson', {
    p_team_id: identity.teamId,
    p_lesson_id: lessonId,
  });
  if (error) throw friendlyMutationError(error.message);
}

export async function recordPlayerVideoCheckpoint(
  identity: AuthIdentity,
  input: VideoProgressCheckpointInput,
) {
  assertPlayer(identity);
  const checkpoint = input.checkpoint === 'started' ? 0 : input.checkpoint;
  const { data, error } = await requireSupabaseClient().rpc('record_video_checkpoint', {
    p_team_id: identity.teamId,
    p_lesson_id: input.lessonId,
    p_variant_id: input.variantId,
    p_checkpoint: checkpoint,
    p_watched_percent: Math.max(checkpoint, Math.round(input.watchedPercent)),
    p_last_position_seconds: input.lastPositionSeconds,
  });
  if (error) throw friendlyMutationError(error.message);
  return mapVideoProgress(data);
}
