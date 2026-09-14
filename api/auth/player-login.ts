import {
  ApiError,
  assertPost,
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  readJsonObject,
} from '../_lib/http.js';
import { clearLoginAttempts, consumeLoginAttempt } from '../_lib/login-rate-limit.js';
import {
  anonymousLoginBucket,
  derivePlayerPassword,
  parsePlayerCode,
  parsePlayerPin,
} from '../_lib/player-credentials.js';
import {
  createSupabasePasswordClient,
  getSupabaseAdmin,
} from '../_lib/supabase-admin.js';

const UNKNOWN_USER_ID = '00000000-0000-0000-0000-000000000000';
const UNKNOWN_PLAYER_EMAIL = 'unknown@players.esordienti.invalid';

function invalidCredentials() {
  return new ApiError(401, 'INVALID_PLAYER_CREDENTIALS', 'Codice o PIN non validi.');
}

async function handlePost(request: Request) {
  assertSameOrigin(request);
  const body = await readJsonObject(request);
  const playerCode = parsePlayerCode(body.code);
  const pin = parsePlayerPin(body.pin);
  const loginBucket = anonymousLoginBucket(playerCode);
  consumeLoginAttempt(request, loginBucket);

  const admin = getSupabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, account_active')
    .eq('player_code', playerCode)
    .maybeSingle();

  if (profileError) {
    throw new ApiError(500, 'PLAYER_LOOKUP_FAILED', 'Accesso temporaneamente non disponibile.');
  }

  const eligible = profile?.role === 'player' && profile.account_active === true;
  const { data: userData } = await admin.auth.admin.getUserById(
    eligible ? profile.id : UNKNOWN_USER_ID,
  );
  const email = userData.user?.email || UNKNOWN_PLAYER_EMAIL;

  const passwordClient = createSupabasePasswordClient();
  const { data: signInData, error: signInError } =
    await passwordClient.auth.signInWithPassword({
      email,
      password: derivePlayerPassword(playerCode, pin),
    });

  if (
    signInError ||
    !eligible ||
    !profile ||
    !signInData.session ||
    signInData.user.id !== profile.id
  ) {
    throw invalidCredentials();
  }

  clearLoginAttempts(request, loginBucket);

  return jsonResponse({
    session: {
      accessToken: signInData.session.access_token,
      expiresAt: signInData.session.expires_at ?? null,
      expiresIn: signInData.session.expires_in,
      refreshToken: signInData.session.refresh_token,
    },
  });
}

export default async function handler(request: Request) {
  try {
    assertPost(request);
    return await handlePost(request);
  } catch (error) {
    return errorResponse(error);
  }
}
