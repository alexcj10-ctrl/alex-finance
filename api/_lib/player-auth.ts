import { ApiError, readBearerToken } from './http.js';
import { getSupabaseAdmin } from './supabase-admin.js';

export async function requirePlayer(request: Request) {
  const accessToken = readBearerToken(request);
  if (accessToken.length > 4096) {
    throw new ApiError(401, 'INVALID_SESSION', 'Sessione non valida.');
  }

  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);

  if (authError || !authData.user) {
    throw new ApiError(401, 'INVALID_SESSION', 'Sessione non valida.');
  }

  const playerId = authData.user.id;
  const [profileResult, membershipsResult] = await Promise.all([
    admin
      .from('profiles')
      .select('id, role, account_active')
      .eq('id', playerId)
      .maybeSingle(),
    admin
      .from('team_members')
      .select('team_id')
      .eq('profile_id', playerId)
      .eq('role', 'player')
      .eq('active', true)
      .limit(2),
  ]);

  if (profileResult.error || membershipsResult.error) {
    throw new ApiError(500, 'PLAYER_LOOKUP_FAILED', 'Profilo giocatore non disponibile.');
  }

  const profile = profileResult.data;
  const memberships = membershipsResult.data ?? [];
  if (
    !profile
    || profile.role !== 'player'
    || profile.account_active !== true
    || memberships.length !== 1
  ) {
    throw new ApiError(403, 'PLAYER_ACCESS_REQUIRED', 'Accesso giocatore richiesto.');
  }

  return { admin, playerId, teamId: memberships[0].team_id };
}
