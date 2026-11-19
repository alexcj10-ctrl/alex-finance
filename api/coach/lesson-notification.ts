import { lessons } from '../../src/data/lessons.js';
import { requireCoach, requireCoachTeamAdminAccess } from '../_lib/coach-auth.js';
import {
  ApiError,
  assertPost,
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  readJsonObject,
} from '../_lib/http.js';
import { sendLessonPush } from '../_lib/web-push.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LESSON_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/;

function parseRequest(body: Record<string, unknown>) {
  const keys = Object.keys(body).sort();
  if (keys.length !== 2 || keys[0] !== 'lessonId' || keys[1] !== 'teamId') {
    throw new ApiError(400, 'INVALID_NOTIFICATION_BODY', 'Richiesta non valida.');
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
  const { admin, coachId } = await requireCoach(request);
  await requireCoachTeamAdminAccess(coachId, teamId);
  const lessonTitle = getLessonTitle(lessonId);

  const { data: assignment, error: assignmentError } = await admin
    .from('lesson_assignments')
    .select('id')
    .eq('team_id', teamId)
    .eq('lesson_id', lessonId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (assignmentError) {
    throw new ApiError(500, 'ASSIGNMENT_LOOKUP_FAILED', 'Assegnazione non disponibile.');
  }
  if (!assignment) {
    throw new ApiError(409, 'LESSON_NOT_ASSIGNED', 'La lezione non è assegnata.');
  }

  const notification = await sendLessonPush({
    admin,
    body: `${lessonTitle}: entra nell'app e continua il tuo percorso.`,
    coachId,
    lessonId,
    teamId,
    title: '⚽ ESORDIENTI ANALYST',
  });

  return jsonResponse({ notification });
}

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
    return errorResponse(error);
  }
}
