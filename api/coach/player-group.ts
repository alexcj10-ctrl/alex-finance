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

function parseUuid(value: unknown, code: string, message: string) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ApiError(400, code, message);
  }
  return value;
}

function parseBirthYear(value: unknown) {
  if (value !== 2014 && value !== 2015) {
    throw new ApiError(400, 'INVALID_BIRTH_YEAR', 'Gruppo non valido.');
  }
  return value;
}

async function handlePost(request: Request) {
  assertSameOrigin(request);
  const body = await readJsonObject(request);
  const keys = Object.keys(body).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== 'birthYear' ||
    keys[1] !== 'playerId' ||
    keys[2] !== 'teamId'
  ) {
    throw new ApiError(400, 'INVALID_GROUP_BODY', 'Richiesta non valida.');
  }

  const birthYear = parseBirthYear(body.birthYear);
  const playerId = parseUuid(body.playerId, 'INVALID_PLAYER_ID', 'Giocatore non valido.');
  const teamId = parseUuid(body.teamId, 'INVALID_TEAM_ID', 'Squadra non valida.');
  const { admin, coachId } = await requireCoach(request);
  await requireCoachTeamAdminAccess(coachId, teamId);

  const { data, error } = await admin.rpc('set_player_birth_year', {
    p_birth_year: birthYear,
    p_coach_id: coachId,
    p_player_id: playerId,
    p_team_id: teamId,
  });

  if (error || !data) {
    if (error?.code === '42501') {
      throw new ApiError(403, 'COACH_ADMIN_REQUIRED', 'Operazione non autorizzata.');
    }
    if (error?.code === '22023') {
      throw new ApiError(404, 'PLAYER_NOT_FOUND', 'Giocatore non trovato nella squadra.');
    }
    throw new ApiError(500, 'PLAYER_GROUP_UPDATE_FAILED', 'Aggiornamento gruppo non riuscito.');
  }

  return jsonResponse({ birthYear: data.birth_year, playerId: data.id });
}

export async function POST(request: Request) {
  try {
    assertPost(request);
    return await handlePost(request);
  } catch (error) {
    return errorResponse(error);
  }
}
