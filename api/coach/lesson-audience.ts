import { requireCoach, requireCoachTeamAdminAccess } from '../_lib/coach-auth.js';
import {
  ApiError,
  assertPost,
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  readJsonObject,
} from '../_lib/http.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LESSON_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/;

function parseUuid(value: unknown) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ApiError(400, 'INVALID_TEAM_ID', 'Squadra non valida.');
  }
  return value;
}

function parseLessonId(value: unknown) {
  if (typeof value !== 'string' || !LESSON_ID_PATTERN.test(value)) {
    throw new ApiError(400, 'INVALID_LESSON_ID', 'Lezione non valida.');
  }
  return value;
}

function parseEligibleBirthYears(value: unknown): Array<2014 | 2015> {
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'INVALID_LESSON_AUDIENCE', 'Destinatari non validi.');
  }

  const valid =
    (value.length === 1 && (value[0] === 2014 || value[0] === 2015))
    || (value.length === 2 && value[0] === 2014 && value[1] === 2015);

  if (!valid) {
    throw new ApiError(400, 'INVALID_LESSON_AUDIENCE', 'Destinatari non validi.');
  }

  return value as Array<2014 | 2015>;
}

async function handlePost(request: Request) {
  assertSameOrigin(request);
  const body = await readJsonObject(request);
  const keys = Object.keys(body).sort();
  if (
    keys.length !== 3
    || keys[0] !== 'eligibleBirthYears'
    || keys[1] !== 'lessonId'
    || keys[2] !== 'teamId'
  ) {
    throw new ApiError(400, 'INVALID_LESSON_AUDIENCE_BODY', 'Richiesta non valida.');
  }

  const eligibleBirthYears = parseEligibleBirthYears(body.eligibleBirthYears);
  const lessonId = parseLessonId(body.lessonId);
  const teamId = parseUuid(body.teamId);
  const { admin, coachId } = await requireCoach(request);
  await requireCoachTeamAdminAccess(coachId, teamId);

  const { data, error } = await admin.rpc('set_lesson_audience', {
    p_coach_id: coachId,
    p_eligible_birth_years: eligibleBirthYears,
    p_lesson_id: lessonId,
    p_team_id: teamId,
  });

  const audience = data?.[0];
  if (error || !audience) {
    if (error?.code === '42501') {
      throw new ApiError(403, 'COACH_ADMIN_REQUIRED', 'Operazione non autorizzata.');
    }
    if (error?.code === '22023') {
      throw new ApiError(404, 'LESSON_NOT_FOUND', 'Lezione non trovata.');
    }
    throw new ApiError(500, 'LESSON_AUDIENCE_UPDATE_FAILED', 'Aggiornamento destinatari non riuscito.');
  }

  return jsonResponse({
    audience: {
      eligibleBirthYears: audience.eligible_birth_years,
      lessonId: audience.lesson_id,
    },
  });
}

export async function POST(request: Request) {
  try {
    assertPost(request);
    return await handlePost(request);
  } catch (error) {
    return errorResponse(error);
  }
}
