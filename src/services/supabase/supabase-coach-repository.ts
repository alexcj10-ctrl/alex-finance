import type { PostgrestError } from '@supabase/supabase-js';

import { buildCoachReadModel } from '../../coach/lib/coach-selectors';
import { lessons } from '../../data/lessons';
import type { CoachDataset } from '../../types/coach';
import type { Database } from '../../types/database';
import type { CoachRepository } from '../coach-repository';
import { requireSupabaseClient, supabaseConfigured } from './client';

type Tables = Database['public']['Tables'];
type ProfileRow = Tables['profiles']['Row'];
type TeamRow = Tables['teams']['Row'];
type MembershipRow = Tables['team_members']['Row'];
type LessonProgressRow = Tables['lesson_progress']['Row'];
type VideoProgressRow = Tables['video_progress']['Row'];
type QuizAttemptRow = Tables['quiz_attempts']['Row'];
type TrophyRow = Tables['player_trophies']['Row'];
type ActivityRow = Tables['activity_events']['Row'];

export type SupabaseCoachRepositoryErrorCode =
  | 'not_configured'
  | 'not_authenticated'
  | 'forbidden'
  | 'query_failed';

export class SupabaseCoachRepositoryError extends Error {
  constructor(
    public readonly code: SupabaseCoachRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SupabaseCoachRepositoryError';
  }
}

function failQuery(context: string, error: PostgrestError | null) {
  if (!error) return;
  throw new SupabaseCoachRepositoryError('query_failed', `${context}: ${error.message}`);
}

function mapProfile(row: ProfileRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    ...(row.player_code ? { playerCode: row.player_code } : {}),
    ...(row.avatar_path ? { avatarPath: row.avatar_path } : {}),
    createdAt: row.created_at,
  };
}

function mapMembership(row: MembershipRow) {
  return {
    teamId: row.team_id,
    profileId: row.profile_id,
    role: row.role,
    active: row.active,
  };
}

function mapLessonProgress(row: LessonProgressRow) {
  return {
    teamId: row.team_id,
    playerId: row.player_id,
    lessonId: row.lesson_id,
    status: row.status,
    progressPercent: row.progress_percent,
    assignedAt: row.assigned_at,
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    pointsEarned: row.points_earned,
    updatedAt: row.updated_at,
  };
}

function mapVideoProgress(row: VideoProgressRow) {
  return {
    teamId: row.team_id,
    playerId: row.player_id,
    lessonId: row.lesson_id,
    variantId: row.variant_id,
    watchedPercent: row.watched_percent,
    lastPositionSeconds: row.last_position_seconds,
    lastCheckpoint: row.last_checkpoint,
    completed: row.completed,
    updatedAt: row.updated_at,
  };
}

function mapQuizAttempt(row: QuizAttemptRow) {
  return {
    id: row.id,
    teamId: row.team_id,
    playerId: row.player_id,
    lessonId: row.lesson_id,
    score: row.score,
    totalQuestions: row.total_questions,
    correctAnswers: row.correct_answers,
    completedAt: row.completed_at,
  };
}

function mapTrophy(row: TrophyRow) {
  return {
    teamId: row.team_id,
    playerId: row.player_id,
    trophyId: row.trophy_id,
    unlockedAt: row.unlocked_at,
  };
}

function mapActivity(row: ActivityRow) {
  return {
    id: row.id,
    teamId: row.team_id,
    playerId: row.player_id,
    ...(row.lesson_id ? { lessonId: row.lesson_id } : {}),
    eventType: row.event_type,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export function isSupabaseCoachRepositoryConfigured() {
  return supabaseConfigured;
}

export async function loadSupabaseCoachDataset(teamId: string): Promise<CoachDataset> {
  if (!supabaseConfigured) {
    throw new SupabaseCoachRepositoryError(
      'not_configured',
      'Supabase non è configurato in questo ambiente.',
    );
  }

  const client = requireSupabaseClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    throw new SupabaseCoachRepositoryError(
      'not_authenticated',
      'Serve una sessione Supabase valida per leggere l’Area Coach.',
    );
  }

  const coachId = userData.user.id;
  const [coachResult, teamResult, coachMembershipResult] = await Promise.all([
    client
      .from('profiles')
      .select('*')
      .eq('id', coachId)
      .maybeSingle(),
    client
      .from('teams')
      .select('id, name, season, created_at')
      .eq('id', teamId)
      .maybeSingle(),
    client
      .from('team_members')
      .select('team_id, profile_id, role, active')
      .eq('team_id', teamId)
      .eq('profile_id', coachId)
      .eq('role', 'coach')
      .eq('active', true)
      .maybeSingle(),
  ]);

  failQuery('Lettura profilo coach non riuscita', coachResult.error);
  failQuery('Lettura squadra non riuscita', teamResult.error);
  failQuery('Lettura membership coach non riuscita', coachMembershipResult.error);

  if (coachResult.data?.role !== 'coach' || !teamResult.data || !coachMembershipResult.data) {
    throw new SupabaseCoachRepositoryError(
      'forbidden',
      'Il coach non è autorizzato a leggere questa squadra.',
    );
  }

  const playersResult = await client
    .from('team_members')
    .select('team_id, profile_id, role, active')
    .eq('team_id', teamId)
    .eq('role', 'player')
    .eq('active', true);
  failQuery('Lettura giocatori non riuscita', playersResult.error);

  const playerMemberships = playersResult.data ?? [];
  const profileIds = [coachId, ...playerMemberships.map((row) => row.profile_id)];

  const [profilesResult, progressResult, videosResult, quizzesResult, trophiesResult, activitiesResult] = await Promise.all([
    client
      .from('profiles')
      .select('*')
      .in('id', profileIds),
    client
      .from('lesson_progress')
      .select('team_id, player_id, lesson_id, status, progress_percent, assigned_at, started_at, completed_at, points_earned, updated_at')
      .eq('team_id', teamId),
    client
      .from('video_progress')
      .select('team_id, player_id, lesson_id, variant_id, watched_percent, last_position_seconds, last_checkpoint, completed, updated_at')
      .eq('team_id', teamId),
    client
      .from('quiz_attempts')
      .select('*')
      .eq('team_id', teamId),
    client
      .from('player_trophies')
      .select('team_id, player_id, trophy_id, unlocked_at')
      .eq('team_id', teamId),
    client
      .from('activity_events')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false }),
  ]);

  failQuery('Lettura profili non riuscita', profilesResult.error);
  failQuery('Lettura progresso lezioni non riuscita', progressResult.error);
  failQuery('Lettura progresso video non riuscita', videosResult.error);
  failQuery('Lettura risultati quiz non riuscita', quizzesResult.error);
  failQuery('Lettura trofei non riuscita', trophiesResult.error);
  failQuery('Lettura attività non riuscita', activitiesResult.error);

  const team = teamResult.data as TeamRow;
  const coachMembership = coachMembershipResult.data as MembershipRow;

  return {
    source: 'supabase',
    generatedAt: new Date().toISOString(),
    team: { id: team.id, name: team.name, season: team.season },
    coachProfileId: coachId,
    profiles: (profilesResult.data ?? []).map(mapProfile),
    memberships: [coachMembership, ...playerMemberships].map(mapMembership),
    lessonProgress: (progressResult.data ?? []).map(mapLessonProgress),
    videoProgress: (videosResult.data ?? []).map(mapVideoProgress),
    quizAttempts: (quizzesResult.data ?? []).map(mapQuizAttempt),
    playerTrophies: (trophiesResult.data ?? []).map(mapTrophy),
    activityEvents: (activitiesResult.data ?? []).map(mapActivity),
  };
}

export function createSupabaseCoachRepository(teamId: string): CoachRepository {
  return {
    async getReadModel() {
      const dataset = await loadSupabaseCoachDataset(teamId);
      return buildCoachReadModel(dataset, lessons);
    },
  };
}
