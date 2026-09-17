import { ApiError } from './http.js';
import { getSupabaseAdmin } from './supabase-admin.js';

export type PlayerSignupEnvironment = 'development' | 'preview' | 'production';

const PLAYER_SIGNUP_ENVIRONMENTS = new Set<PlayerSignupEnvironment>([
  'development',
  'preview',
  'production',
]);

export function getPlayerSignupEnvironment(): PlayerSignupEnvironment {
  const environment = process.env.VERCEL_ENV?.trim() as PlayerSignupEnvironment | undefined;
  if (environment && PLAYER_SIGNUP_ENVIRONMENTS.has(environment)) return environment;

  if (process.env.VERCEL) {
    throw new ApiError(
      503,
      'PLAYER_SIGNUP_ENVIRONMENT_NOT_CONFIGURED',
      'Registrazione temporaneamente non configurata.',
    );
  }

  return 'development';
}

export function playerDisplayNameForEnvironment(
  displayName: string,
  environment: PlayerSignupEnvironment,
) {
  if (environment === 'production') return displayName;
  const prefix = environment === 'preview' ? '[QA Preview] ' : '[QA Sviluppo] ';
  return `${prefix}${displayName}`.slice(0, 50);
}

export async function consumePlayerSignupSlot(
  teamId: string,
  environment = getPlayerSignupEnvironment(),
) {
  const { data, error } = await getSupabaseAdmin().rpc('consume_player_signup_slot', {
    p_environment: environment,
    p_team_id: teamId,
  });

  if (error) {
    throw new ApiError(
      503,
      'PLAYER_SIGNUP_WINDOW_UNAVAILABLE',
      'Registrazione temporaneamente non disponibile.',
    );
  }

  const signupWindow = Array.isArray(data) ? data[0] : data;
  if (!signupWindow) {
    throw new ApiError(
      403,
      'PLAYER_SIGNUP_CLOSED',
      'Le registrazioni sono chiuse o complete. Chiedi al tuo allenatore di aprirle.',
    );
  }

  return signupWindow as { open_until: string; remaining_signups: number };
}

export async function releasePlayerSignupSlot(
  teamId: string,
  environment = getPlayerSignupEnvironment(),
) {
  const { error } = await getSupabaseAdmin().rpc('release_player_signup_slot', {
    p_environment: environment,
    p_team_id: teamId,
  });

  if (error) {
    console.error('Player signup slot release failed.', {
      code: error.code,
      message: error.message,
      teamId,
    });
  }
}
