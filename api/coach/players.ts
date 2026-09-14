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
  buildPlayerAliasEmail,
  derivePlayerPassword,
  parsePlayerCode,
  parsePlayerPin,
} from '../_lib/player-credentials.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseDisplayName(value: unknown) {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'INVALID_DISPLAY_NAME', 'Nome non valido.');
  }

  const displayName = value.trim();
  if (displayName.length < 1 || displayName.length > 50) {
    throw new ApiError(400, 'INVALID_DISPLAY_NAME', 'Nome non valido.');
  }

  return displayName;
}

function parseTeamId(value: unknown) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ApiError(400, 'INVALID_TEAM_ID', 'Squadra non valida.');
  }

  return value;
}

function parseActive(value: unknown) {
  if (value === undefined) {
    return true;
  }

  if (typeof value !== 'boolean') {
    throw new ApiError(400, 'INVALID_ACCOUNT_STATUS', 'Stato account non valido.');
  }

  return value;
}

function isConflictCode(code: string | undefined) {
  return code === '23505' || code === 'email_exists' || code === 'user_already_exists';
}

async function handlePost(request: Request) {
  assertSameOrigin(request);
  const body = await readJsonObject(request);
  const displayName = parseDisplayName(body.displayName);
  const playerCode = parsePlayerCode(body.playerCode);
  const pin = parsePlayerPin(body.pin);
  const teamId = parseTeamId(body.teamId);
  const active = parseActive(body.active);

  const { admin, coachId } = await requireCoach(request);
  await requireCoachTeamAccess(coachId, teamId);

  const { data: existingProfile, error: existingProfileError } = await admin
    .from('profiles')
    .select('id')
    .eq('player_code', playerCode)
    .maybeSingle();

  if (existingProfileError) {
    throw new ApiError(500, 'PLAYER_LOOKUP_FAILED', 'Impossibile verificare il codice.');
  }

  if (existingProfile) {
    throw new ApiError(409, 'PLAYER_CODE_IN_USE', 'Codice giocatore già in uso.');
  }

  const { data: authData, error: createAuthError } = await admin.auth.admin.createUser({
    email: buildPlayerAliasEmail(playerCode),
    email_confirm: true,
    password: derivePlayerPassword(playerCode, pin),
    user_metadata: { display_name: displayName },
  });

  if (createAuthError || !authData.user) {
    if (isConflictCode(createAuthError?.code)) {
      throw new ApiError(409, 'PLAYER_CODE_IN_USE', 'Codice giocatore già in uso.');
    }

    throw new ApiError(
      502,
      'AUTH_USER_CREATION_FAILED',
      'Impossibile creare il giocatore. Riprova.',
    );
  }

  const userId = authData.user.id;
  const { error: provisioningError } = await admin.rpc('provision_player_profile', {
    p_active: active,
    p_coach_id: coachId,
    p_display_name: displayName,
    p_player_code: playerCode,
    p_team_id: teamId,
    p_user_id: userId,
  });

  if (provisioningError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(userId);

    if (cleanupError) {
      throw new ApiError(
        500,
        'PLAYER_PROVISIONING_RECOVERY_REQUIRED',
        'Creazione non completata. Contatta il supporto prima di riprovare.',
      );
    }

    if (isConflictCode(provisioningError.code)) {
      throw new ApiError(409, 'PLAYER_CODE_IN_USE', 'Codice giocatore già in uso.');
    }

    throw new ApiError(
      500,
      'PLAYER_PROVISIONING_FAILED',
      'Impossibile completare la creazione del giocatore.',
    );
  }

  return jsonResponse(
    {
      player: {
        active,
        displayName,
        id: userId,
        playerCode,
        teamId,
      },
    },
    201,
  );
}

export async function POST(request: Request) {
  try {
    assertPost(request);
    return await handlePost(request);
  } catch (error) {
    return errorResponse(error);
  }
}
