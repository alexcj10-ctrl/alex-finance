import { randomBytes } from 'node:crypto';

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
const COACH_EMAIL_SUFFIX = '.coach@coaches.esordienti.invalid';

function parseUuid(value: unknown, code: string, message: string) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ApiError(400, code, message);
  }

  return value;
}

function parseResetRequest(body: Record<string, unknown>) {
  const keys = Object.keys(body).sort();
  if (keys.length !== 2 || keys[0] !== 'coachId' || keys[1] !== 'teamId') {
    throw new ApiError(400, 'INVALID_RESET_BODY', 'Richiesta non valida.');
  }

  return {
    coachId: parseUuid(body.coachId, 'INVALID_COACH_ID', 'Coach non valido.'),
    teamId: parseUuid(body.teamId, 'INVALID_TEAM_ID', 'Squadra non valida.'),
  };
}

function generateTemporaryPassword() {
  return `Ea!7${randomBytes(12).toString('base64url')}`;
}

async function handlePost(request: Request) {
  assertSameOrigin(request);
  const body = await readJsonObject(request);
  const { coachId: targetCoachId, teamId } = parseResetRequest(body);
  const { admin, coachId } = await requireCoach(request);

  await requireCoachTeamAdminAccess(coachId, teamId);

  const [profileResult, membershipResult, authResult] = await Promise.all([
    admin
      .from('profiles')
      .select('id, role, account_active')
      .eq('id', targetCoachId)
      .maybeSingle(),
    admin
      .from('team_members')
      .select('profile_id')
      .eq('team_id', teamId)
      .eq('profile_id', targetCoachId)
      .eq('role', 'coach')
      .eq('active', true)
      .eq('coach_access_level', 'viewer')
      .maybeSingle(),
    admin.auth.admin.getUserById(targetCoachId),
  ]);

  if (profileResult.error || membershipResult.error) {
    throw new ApiError(500, 'COACH_LOOKUP_FAILED', 'Profilo Coach non disponibile.');
  }

  const profile = profileResult.data;
  const authUser = authResult.data.user;
  const email = authUser?.email?.toLowerCase();
  if (
    !profile ||
    profile.role !== 'coach' ||
    profile.account_active !== true ||
    !membershipResult.data ||
    authResult.error ||
    !authUser ||
    !email?.endsWith(COACH_EMAIL_SUFFIX)
  ) {
    throw new ApiError(404, 'COACH_NOT_FOUND', 'Coach osservatore non trovato nella squadra.');
  }

  const password = generateTemporaryPassword();
  const { data: updatedAuth, error: updateError } =
    await admin.auth.admin.updateUserById(targetCoachId, { password });

  if (updateError || !updatedAuth.user || updatedAuth.user.id !== targetCoachId) {
    throw new ApiError(
      502,
      'COACH_PASSWORD_RESET_FAILED',
      'Non è stato possibile rigenerare la password. Riprova.',
    );
  }

  const username = email.slice(0, -COACH_EMAIL_SUFFIX.length);
  return jsonResponse({
    credentials: {
      password,
      username: `${username.charAt(0).toUpperCase()}${username.slice(1)}`,
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
