import { ApiError, readBearerToken } from './http';
import { getSupabaseAdmin } from './supabase-admin';

export async function requireCoach(request: Request) {
  const accessToken = readBearerToken(request);
  if (accessToken.length > 4096) {
    throw new ApiError(401, 'INVALID_SESSION', 'Sessione non valida.');
  }

  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);

  if (authError || !authData.user) {
    throw new ApiError(401, 'INVALID_SESSION', 'Sessione non valida.');
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, account_active')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) {
    throw new ApiError(500, 'PROFILE_LOOKUP_FAILED', 'Profilo non disponibile.');
  }

  if (!profile || profile.role !== 'coach' || profile.account_active !== true) {
    throw new ApiError(403, 'COACH_ACCESS_REQUIRED', 'Accesso coach richiesto.');
  }

  return { admin, coachId: authData.user.id };
}

export async function requireCoachTeamAccess(coachId: string, teamId: string) {
  const admin = getSupabaseAdmin();
  const { data: membership, error } = await admin
    .from('team_members')
    .select('team_id')
    .eq('team_id', teamId)
    .eq('profile_id', coachId)
    .eq('role', 'coach')
    .eq('active', true)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, 'TEAM_LOOKUP_FAILED', 'Squadra non disponibile.');
  }

  if (!membership) {
    throw new ApiError(403, 'TEAM_ACCESS_DENIED', 'Accesso alla squadra negato.');
  }
}
