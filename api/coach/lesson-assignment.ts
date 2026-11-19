import { createClient } from '@supabase/supabase-js';

import { lessons } from '../../src/data/lessons.js';
import { requireCoach, requireCoachTeamAdminAccess } from '../_lib/coach-auth.js';
import {
  ApiError,
  assertPost,
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  readBearerToken,
  readJsonObject,
} from '../_lib/http.js';
import { getServerConfig } from '../_lib/supabase-admin.js';
import { sendLessonPush } from '../_lib/web-push.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LESSON_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/;

function parseRequest(body: Record<string, unknown>) {
  const keys = Object.keys(body).sort();
  if (keys.length !== 2 || keys[0] !== 'lessonId' || keys[1] !== 'teamId') {
    throw new ApiError(400, 'INVALID_ASSIGNMENT_BODY', 'Richiesta non valida.');
  }
  if (typeof body.teamId !== 'string' || !UUID_PATTERN.test(body.teamId)) {
    throw new ApiError(400, 'INVALID_TEAM_ID', 'Squadra non valida.');
  }
  if (typeof body.lessonId !== 'string' || !LESSON_ID_PATTERN.test(body.lessonId)) {
    throw new ApiError(400, 'INVALID_LESSON_ID', 'Lezione non valida.');
  }
  return { lessonId: body.lessonId, teamId: body.teamId };
}

function getLessonTitle(lessonId: string) {
  const lesson = lessons.find((candidate) => candidate.id === lessonId);
  if (!lesson || lesson.demo || lesson.disponibilita !== 'disponibile') {
    throw new ApiError(404, 'LESSON_NOT_FOUND', 'Lezione non trovata.');
  }
  return lesson.titolo;
}

async function handlePost(request: Request) {
  assertPost(request);
  assertSameOrigin(request);
  const { lessonId, teamId } = parseRequest(await readJsonObject(request));
  const lessonTitle = getLessonTitle(lessonId);
  const accessToken = readBearerToken(request);
  const { admin, coachId } = await requireCoach(request);
  await requireCoachTeamAdminAccess(coachId, teamId);

  const { data: existingAssignment, error: existingError } = await admin
    .from('lesson_assignments')
    .select('id')
    .eq('team_id', teamId)
    .eq('lesson_id', lessonId)
    .eq('active', true)
    .is('player_id', null)
    .maybeSingle();

  if (existingError) {
    throw new ApiError(500, 'ASSIGNMENT_LOOKUP_FAILED', 'Assegnazione non disponibile.');
  }

  const { supabasePublishableKey, supabaseUrl } = getServerConfig();
  const coachClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await coachClient.rpc('assign_lesson', {
    p_due_at: null,
    p_lesson_id: lessonId,
    p_player_id: null,
    p_team_id: teamId,
  });

  if (error || !data || typeof data !== 'object' || !('id' in data)) {
    if (error?.code === '42501') {
      throw new ApiError(403, 'COACH_ADMIN_REQUIRED', 'Operazione non autorizzata.');
    }
    if (error?.code === '22023') {
      throw new ApiError(404, 'LESSON_NOT_FOUND', 'Lezione non trovata.');
    }
    throw new ApiError(500, 'LESSON_ASSIGNMENT_FAILED', 'Assegnazione non riuscita.');
  }

  const assignment = data as { id: string; [key: string]: unknown };
  let notification: unknown = { attempted: 0, deactivated: 0, failed: 0, sent: 0 };

  const { data: claimed, error: claimError } = await admin.rpc(
    'claim_push_notification_event',
    {
      p_assignment_id: assignment.id,
      p_coach_id: coachId,
      p_event_kind: 'lesson_assigned',
      p_team_id: teamId,
    },
  );

  if (!claimError && claimed === true && !existingAssignment) {
    try {
      notification = await sendLessonPush({
        admin,
        body: `${lessonTitle} è disponibile su ESORDIENTI ANALYST.`,
        coachId,
        lessonId,
        teamId,
        title: '⚽ Nuova lezione disponibile',
      });
    } catch {
      notification = { attempted: 0, deactivated: 0, failed: 1, sent: 0 };
    }
  }

  return jsonResponse({ assignment, notification }, existingAssignment ? 200 : 201);
}

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
    return errorResponse(error);
  }
}
