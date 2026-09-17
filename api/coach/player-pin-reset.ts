import { randomInt } from 'node:crypto';

import { requireCoach, requireCoachTeamAccess } from '../_lib/coach-auth.js';
import {
  ApiError,
  assertPost,
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  readJsonObject,
} from '../_lib/http.js';
import {
  derivePlayerPassword,
  PLAYER_CREDENTIAL_VERSION,
} from '../_lib/player-credentials.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseUuid(value: unknown, code: string, message: string) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ApiError(400, code, message);
  }

  return value;
}

function parseResetRequest(body: Record<string, unknown>) {
  const keys = Object.keys(body).sort();
  if (keys.length !== 2 || keys[0] !== 'playerId' || keys[1] !== 'teamId') {
    throw new ApiError(400, 'INVALID_RESET_BODY', 'Richiesta non valida.');
  }

  return {
    playerId: parseUuid(body.playerId, 'INVALID_PLAYER_ID', 'Giocatore non valido.'),
    teamId: parseUuid(body.teamId, 'INVALID_TEAM_ID', 'Squadra non valida.'),
  };
}

function generatePlayerPin() {
  return randomInt(100_000, 1_000_000).toString();
}

async function handlePost(request: Request) {
  assertSameOrigin(request);
  const body = await readJsonObject(request);
  const { playerId, teamId } = parseResetRequest(body);
  const { admin, coachId } = await requireCoach(request);

  await requireCoachTeamAccess(coachId, teamId);

  const [profileResult, membershipResult, authResult] = await Promise.all([
    admin
      .from('profiles')
      .select('id, player_code, role, account_active')
      .eq('id', playerId)
      .maybeSingle(),
    admin
      .from('team_members')
      .select('profile_id')
      .eq('team_id', teamId)
      .eq('profile_id', playerId)
      .eq('role', 'player')
      .eq('active', true)
      .maybeSingle(),
    admin.auth.admin.getUserById(playerId),
  ]);

  if (profileResult.error || membershipResult.error) {
    throw new ApiError(500, 'PLAYER_LOOKUP_FAILED', 'Profilo giocatore non disponibile.');
  }

  const profile = profileResult.data;
  if (
    !profile ||
    profile.role !== 'player' ||
    profile.account_active !== true ||
    !profile.player_code ||
    !membershipResult.data ||
    authResult.error ||
    !authResult.data.user
  ) {
    throw new ApiError(404, 'PLAYER_NOT_FOUND', 'Giocatore non trovato nella squadra.');
  }

  const pin = generatePlayerPin();
  const password = derivePlayerPassword(profile.player_code, pin);
  const currentAppMetadata = authResult.data.user.app_metadata ?? {};
  const { data: updatedAuth, error: updateError } =
    await admin.auth.admin.updateUserById(playerId, {
      app_metadata: {
        ...currentAppMetadata,
        player_credential_version: PLAYER_CREDENTIAL_VERSION,
        role: 'player',
      },
      password,
    });

  if (updateError || !updatedAuth.user || updatedAuth.user.id !== playerId) {
    throw new ApiError(
      502,
      'PLAYER_PIN_RESET_FAILED',
      'Non è stato possibile rigenerare il PIN. Riprova.',
    );
  }

  return jsonResponse({
    credentials: {
      pin,
      playerCode: profile.player_code,
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
