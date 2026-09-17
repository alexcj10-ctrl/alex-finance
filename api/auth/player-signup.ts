import { randomInt } from 'node:crypto';

import {
  ApiError,
  assertPost,
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  readJsonObject,
} from '../_lib/http.js';
import {
  PLAYER_CREDENTIAL_VERSION,
  buildPlayerAliasEmail,
  derivePlayerPassword,
} from '../_lib/player-credentials.js';
import {
  consumePlayerSignupSlot,
  getPlayerSignupEnvironment,
  playerDisplayNameForEnvironment,
  releasePlayerSignupSlot,
  type PlayerSignupEnvironment,
} from '../_lib/player-signup-window.js';
import { consumeSignupAttempt } from '../_lib/signup-rate-limit.js';
import {
  createSupabasePasswordClient,
  getSupabaseAdmin,
} from '../_lib/supabase-admin.js';

const DEFAULT_TEAM_NAME = 'Esordienti Poggio Mirteto';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HUMAN_NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;
const MAX_NAME_PART_LENGTH = 40;
const MAX_DISPLAY_NAME_LENGTH = 50;
const MAX_CODE_ATTEMPTS = 12;

function parseNamePart(value: unknown, field: 'Nome' | 'Cognome') {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'INVALID_PLAYER_NAME', `${field} non valido.`);
  }

  const normalized = value.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (
    normalized.length < 1 ||
    normalized.length > MAX_NAME_PART_LENGTH ||
    !HUMAN_NAME_PATTERN.test(normalized)
  ) {
    throw new ApiError(400, 'INVALID_PLAYER_NAME', `${field} non valido.`);
  }

  return normalized;
}

function parseSignupNames(body: Record<string, unknown>) {
  const keys = Object.keys(body).sort();
  if (keys.length !== 2 || keys[0] !== 'firstName' || keys[1] !== 'lastName') {
    throw new ApiError(
      400,
      'INVALID_SIGNUP_BODY',
      'Inserisci soltanto nome e cognome.',
    );
  }

  const firstName = parseNamePart(body.firstName, 'Nome');
  const lastName = parseNamePart(body.lastName, 'Cognome');
  const displayName = `${firstName} ${lastName}`;
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new ApiError(400, 'INVALID_PLAYER_NAME', 'Nome e cognome sono troppo lunghi.');
  }

  return { displayName, firstName, lastName };
}

function playerCodeStem(firstName: string, lastName: string) {
  const ascii = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

  const first = ascii(firstName).slice(0, 3);
  const last = ascii(lastName).slice(0, 7);
  return `${first}${last}`.slice(0, 16) || 'ESOR';
}

function generatePlayerCode(firstName: string, lastName: string) {
  const suffix = randomInt(0, 10_000).toString().padStart(4, '0');
  return `${playerCodeStem(firstName, lastName)}${suffix}`;
}

function generatePlayerPin() {
  return randomInt(100_000, 1_000_000).toString();
}

function isConflictCode(code: string | undefined) {
  return code === '23505' || code === 'email_exists' || code === 'user_already_exists';
}

async function resolveSignupTeam() {
  const admin = getSupabaseAdmin();
  const configuredTeamId = process.env.PLAYER_SIGNUP_TEAM_ID?.trim();

  if (!configuredTeamId || !UUID_PATTERN.test(configuredTeamId)) {
    throw new ApiError(
      503,
      'PLAYER_SIGNUP_NOT_CONFIGURED',
      'Registrazione temporaneamente non configurata.',
    );
  }

  const result = await admin
    .from('teams')
    .select('id, name, season')
    .eq('id', configuredTeamId)
    .eq('name', DEFAULT_TEAM_NAME)
    .limit(1);
  const teamRows = result.data as { id: string; name: string; season: string }[] | null;
  const teamError = result.error;

  if (teamError || !teamRows || teamRows.length !== 1) {
    throw new ApiError(
      503,
      'PLAYER_SIGNUP_TEAM_UNAVAILABLE',
      'La squadra non è disponibile per la registrazione.',
    );
  }

  return teamRows[0];
}

async function resolveActiveCoach(teamId: string) {
  const admin = getSupabaseAdmin();
  const { data: memberships, error: membershipError } = await admin
    .from('team_members')
    .select('profile_id')
    .eq('team_id', teamId)
    .eq('role', 'coach')
    .eq('active', true)
    .limit(20);

  if (membershipError || !memberships?.length) {
    throw new ApiError(
      503,
      'PLAYER_SIGNUP_COACH_UNAVAILABLE',
      'Registrazione temporaneamente non disponibile.',
    );
  }

  const { data: coach, error: coachError } = await admin
    .from('profiles')
    .select('id')
    .in('id', memberships.map((membership) => membership.profile_id))
    .eq('role', 'coach')
    .eq('account_active', true)
    .limit(1)
    .maybeSingle();

  if (coachError || !coach) {
    throw new ApiError(
      503,
      'PLAYER_SIGNUP_COACH_UNAVAILABLE',
      'Registrazione temporaneamente non disponibile.',
    );
  }

  return coach.id;
}

async function deleteIncompleteUser(userId: string) {
  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(userId);
  if (error) {
    throw new ApiError(
      500,
      'PLAYER_SIGNUP_RECOVERY_REQUIRED',
      'Creazione non completata. Contatta il supporto prima di riprovare.',
    );
  }
}

async function createPlayer(
  displayName: string,
  firstName: string,
  lastName: string,
  teamId: string,
  coachId: string,
  signupEnvironment: PlayerSignupEnvironment,
) {
  const admin = getSupabaseAdmin();

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const playerCode = generatePlayerCode(firstName, lastName);
    const pin = generatePlayerPin();
    const password = derivePlayerPassword(playerCode, pin);

    const { data: existingProfile, error: lookupError } = await admin
      .from('profiles')
      .select('id')
      .eq('player_code', playerCode)
      .maybeSingle();

    if (lookupError) {
      throw new ApiError(
        500,
        'PLAYER_CODE_LOOKUP_FAILED',
        'Registrazione temporaneamente non disponibile.',
      );
    }
    if (existingProfile) continue;

    const { data: authData, error: createAuthError } = await admin.auth.admin.createUser({
      app_metadata: {
        origin_environment: signupEnvironment,
        player_credential_version: PLAYER_CREDENTIAL_VERSION,
        role: 'player',
      },
      email: buildPlayerAliasEmail(playerCode),
      email_confirm: true,
      password,
      user_metadata: { display_name: displayName },
    });

    if (createAuthError || !authData.user) {
      if (isConflictCode(createAuthError?.code)) continue;
      throw new ApiError(
        502,
        'AUTH_USER_CREATION_FAILED',
        'Non è stato possibile creare il profilo. Riprova.',
      );
    }

    const userId = authData.user.id;
    const { error: provisioningError } = await admin.rpc('provision_player_profile', {
      p_active: true,
      p_coach_id: coachId,
      p_display_name: displayName,
      p_player_code: playerCode,
      p_team_id: teamId,
      p_user_id: userId,
    });

    if (provisioningError) {
      await deleteIncompleteUser(userId);
      if (isConflictCode(provisioningError.code)) continue;
      throw new ApiError(
        500,
        'PLAYER_PROVISIONING_FAILED',
        'Non è stato possibile completare la creazione del profilo.',
      );
    }

    const passwordClient = createSupabasePasswordClient();
    const { data: signInData, error: signInError } =
      await passwordClient.auth.signInWithPassword({
        email: buildPlayerAliasEmail(playerCode),
        password,
      });

    if (signInError || !signInData.session || signInData.user.id !== userId) {
      await deleteIncompleteUser(userId);
      throw new ApiError(
        502,
        'PLAYER_AUTO_LOGIN_FAILED',
        'Profilo non completato. Riprova tra poco.',
      );
    }

    return {
      pin,
      playerCode,
      session: signInData.session,
      userId,
    };
  }

  throw new ApiError(
    503,
    'PLAYER_CODE_GENERATION_FAILED',
    'Non è stato possibile generare un codice. Riprova.',
  );
}

async function handlePost(request: Request) {
  assertSameOrigin(request);
  consumeSignupAttempt(request);
  const body = await readJsonObject(request);
  const { displayName: requestedDisplayName, firstName, lastName } = parseSignupNames(body);
  const signupEnvironment = getPlayerSignupEnvironment();
  const displayName = playerDisplayNameForEnvironment(
    requestedDisplayName,
    signupEnvironment,
  );
  const team = await resolveSignupTeam();
  const coachId = await resolveActiveCoach(team.id);
  await consumePlayerSignupSlot(team.id, signupEnvironment);
  let result: Awaited<ReturnType<typeof createPlayer>>;

  try {
    result = await createPlayer(
      displayName,
      firstName,
      lastName,
      team.id,
      coachId,
      signupEnvironment,
    );
  } catch (error) {
    await releasePlayerSignupSlot(team.id, signupEnvironment);
    throw error;
  }

  return jsonResponse(
    {
      player: {
        displayName,
        id: result.userId,
        pin: result.pin,
        playerCode: result.playerCode,
        teamId: team.id,
        teamName: team.name,
        season: team.season,
      },
      session: {
        accessToken: result.session.access_token,
        expiresAt: result.session.expires_at ?? null,
        expiresIn: result.session.expires_in,
        refreshToken: result.session.refresh_token,
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
