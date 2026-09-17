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
  PLAYER_CREDENTIAL_VERSION,
  anonymousLoginBucket,
  deriveLegacyPlayerPassword,
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
  const usesCurrentCredentials =
    userData.user?.app_metadata?.player_credential_version ===
    PLAYER_CREDENTIAL_VERSION;
  const currentPassword = derivePlayerPassword(playerCode, pin);
  const attemptedPassword = usesCurrentCredentials
    ? currentPassword
    : deriveLegacyPlayerPassword(playerCode, pin);

  const passwordClient = createSupabasePasswordClient();
  let { data: signInData, error: signInError } =
    await passwordClient.auth.signInWithPassword({
      email,
      password: attemptedPassword,
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

  if (!usesCurrentCredentials) {
    const { error: migrationError } = await admin.auth.admin.updateUserById(profile.id, {
      app_metadata: {
        ...userData.user?.app_metadata,
        player_credential_version: PLAYER_CREDENTIAL_VERSION,
        role: 'player',
      },
      password: currentPassword,
    });

    if (migrationError) {
      throw new ApiError(
        503,
        'PLAYER_CREDENTIAL_MIGRATION_FAILED',
        'Accesso temporaneamente non disponibile. Riprova tra poco.',
      );
    }

    const migratedSignIn = await passwordClient.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (
      migratedSignIn.error ||
      !migratedSignIn.data.session ||
      migratedSignIn.data.user.id !== profile.id
    ) {
      throw new ApiError(
        503,
        'PLAYER_CREDENTIAL_MIGRATION_FAILED',
        'Accesso temporaneamente non disponibile. Riprova tra poco.',
      );
    }

    signInData = migratedSignIn.data;
    signInError = null;
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

export async function POST(request: Request) {
  try {
    assertPost(request);
    return await handlePost(request);
  } catch (error) {
    return errorResponse(error);
  }
}
