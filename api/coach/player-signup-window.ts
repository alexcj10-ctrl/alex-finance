import { requireCoach, requireCoachTeamAccess } from '../_lib/coach-auth.js';
import {
  ApiError,
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  readJsonObject,
} from '../_lib/http.js';
import { getPlayerSignupEnvironment } from '../_lib/player-signup-window.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_WINDOW_MINUTES = 5;
const MAX_WINDOW_MINUTES = 120;
const MAX_SIGNUPS_PER_WINDOW = 25;

function parseTeamId(value: unknown) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ApiError(400, 'INVALID_TEAM_ID', 'Squadra non valida.');
  }

  return value;
}

function signupWindowPayload(
  teamId: string,
  openUntil: string | null,
  maxSignups = MAX_SIGNUPS_PER_WINDOW,
  signupsUsed = 0,
) {
  const isOpen = Boolean(openUntil && new Date(openUntil).getTime() > Date.now());

  return {
    signupWindow: {
      closesAt: isOpen ? openUntil : null,
      isOpen,
      remainingSignups: isOpen ? Math.max(0, maxSignups - signupsUsed) : 0,
      teamId,
    },
  };
}

async function readSignupWindow(request: Request, teamId: string) {
  const { admin, coachId } = await requireCoach(request);
  await requireCoachTeamAccess(coachId, teamId);
  const environment = getPlayerSignupEnvironment();

  const { data, error } = await admin
    .from('player_signup_windows')
    .select('max_signups, open_until, signups_used')
    .eq('environment', environment)
    .eq('team_id', teamId)
    .maybeSingle();

  if (error) {
    throw new ApiError(
      500,
      'SIGNUP_WINDOW_LOOKUP_FAILED',
      'Impossibile verificare le registrazioni.',
    );
  }

  return signupWindowPayload(
    teamId,
    data?.open_until ?? null,
    data?.max_signups,
    data?.signups_used,
  );
}

async function handleGet(request: Request) {
  const teamId = parseTeamId(new URL(request.url).searchParams.get('teamId'));
  return jsonResponse(await readSignupWindow(request, teamId));
}

function parseUpdate(body: Record<string, unknown>) {
  const teamId = parseTeamId(body.teamId);
  if (typeof body.open !== 'boolean') {
    throw new ApiError(400, 'INVALID_SIGNUP_WINDOW', 'Stato registrazioni non valido.');
  }

  if (!body.open) {
    if (Object.keys(body).some((key) => !['open', 'teamId'].includes(key))) {
      throw new ApiError(400, 'INVALID_SIGNUP_WINDOW', 'Dati non validi.');
    }
    return { openUntil: null, teamId };
  }

  if (
    Object.keys(body).some(
      (key) => !['durationMinutes', 'open', 'teamId'].includes(key),
    ) ||
    !Number.isInteger(body.durationMinutes) ||
    (body.durationMinutes as number) < MIN_WINDOW_MINUTES ||
    (body.durationMinutes as number) > MAX_WINDOW_MINUTES
  ) {
    throw new ApiError(
      400,
      'INVALID_SIGNUP_WINDOW_DURATION',
      `La finestra deve durare da ${MIN_WINDOW_MINUTES} a ${MAX_WINDOW_MINUTES} minuti.`,
    );
  }

  return {
    openUntil: new Date(Date.now() + (body.durationMinutes as number) * 60_000).toISOString(),
    teamId,
  };
}

async function handlePost(request: Request) {
  assertSameOrigin(request);
  const body = await readJsonObject(request);
  const update = parseUpdate(body);
  const { admin, coachId } = await requireCoach(request);
  await requireCoachTeamAccess(coachId, update.teamId);
  const environment = getPlayerSignupEnvironment();

  const { data, error } = await admin
    .from('player_signup_windows')
    .upsert(
      {
        environment,
        max_signups: MAX_SIGNUPS_PER_WINDOW,
        open_until: update.openUntil,
        signups_used: 0,
        team_id: update.teamId,
        updated_at: new Date().toISOString(),
        updated_by: coachId,
      },
      { onConflict: 'environment,team_id' },
    )
    .select('max_signups, open_until, signups_used')
    .single();

  if (error) {
    throw new ApiError(
      500,
      'SIGNUP_WINDOW_UPDATE_FAILED',
      'Impossibile aggiornare le registrazioni.',
    );
  }

  return jsonResponse(signupWindowPayload(
    update.teamId,
    data.open_until,
    data.max_signups,
    data.signups_used,
  ));
}

export async function GET(request: Request) {
  try {
    if (request.method !== 'GET') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metodo non consentito.');
    }
    return await handleGet(request);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (request.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metodo non consentito.');
    }
    return await handlePost(request);
  } catch (error) {
    return errorResponse(error);
  }
}
