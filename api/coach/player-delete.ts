import { requireCoach, requireCoachTeamAdminAccess } from '../_lib/coach-auth.js';
import {
  ApiError,
  assertDelete,
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  readJsonObject,
} from '../_lib/http.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseUuid(value: unknown, code: string, message: string) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ApiError(400, code, message);
  }

  return value;
}

function parseDeleteRequest(body: Record<string, unknown>) {
  const keys = Object.keys(body).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== 'confirmation' ||
    keys[1] !== 'playerId' ||
    keys[2] !== 'teamId'
  ) {
    throw new ApiError(400, 'INVALID_DELETE_BODY', 'Richiesta non valida.');
  }

  if (typeof body.confirmation !== 'string') {
    throw new ApiError(400, 'INVALID_CONFIRMATION', 'Conferma non valida.');
  }

  const confirmation = body.confirmation.trim();
  if (!confirmation || confirmation.length > 50) {
    throw new ApiError(400, 'INVALID_CONFIRMATION', 'Conferma non valida.');
  }

  return {
    confirmation,
    playerId: parseUuid(body.playerId, 'INVALID_PLAYER_ID', 'Giocatore non valido.'),
    teamId: parseUuid(body.teamId, 'INVALID_TEAM_ID', 'Squadra non valida.'),
  };
}

async function handleDelete(request: Request) {
  assertSameOrigin(request);
  const body = await readJsonObject(request);
  const { confirmation, playerId, teamId } = parseDeleteRequest(body);
  const { admin, coachId } = await requireCoach(request);

  await requireCoachTeamAdminAccess(coachId, teamId);

  const [profileResult, membershipResult] = await Promise.all([
    admin
      .from('profiles')
      .select('id, display_name, role, account_active')
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
  ]);

  if (profileResult.error || membershipResult.error) {
    throw new ApiError(500, 'PLAYER_LOOKUP_FAILED', 'Profilo giocatore non disponibile.');
  }

  const profile = profileResult.data;
  if (
    !profile ||
    profile.role !== 'player' ||
    profile.account_active !== true ||
    !membershipResult.data
  ) {
    throw new ApiError(404, 'PLAYER_NOT_FOUND', 'Giocatore non trovato nella squadra.');
  }

  if (confirmation !== 'ELIMINA' && confirmation !== profile.display_name) {
    throw new ApiError(400, 'DELETE_CONFIRMATION_MISMATCH', 'Conferma non valida.');
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(playerId);
  if (deleteError) {
    console.error('Player deletion failed.', {
      code: deleteError.code,
      message: deleteError.message,
      playerId,
      teamId,
    });
    throw new ApiError(
      502,
      'PLAYER_DELETE_FAILED',
      'Non è stato possibile eliminare il giocatore. Riprova.',
    );
  }

  const relatedRows = [
    ['profiles', 'id'],
    ['team_members', 'profile_id'],
    ['lesson_assignments', 'player_id'],
    ['lesson_progress', 'player_id'],
    ['video_progress', 'player_id'],
    ['quiz_attempts', 'player_id'],
    ['quiz_answers', 'player_id'],
    ['player_trophies', 'player_id'],
    ['activity_events', 'player_id'],
  ] as const;

  const verificationResults = await Promise.all(
    relatedRows.map(([table, column]) =>
      admin.from(table).select(column, { count: 'exact', head: true }).eq(column, playerId),
    ),
  );

  if (verificationResults.some(({ count, error }) => error || (count ?? 0) > 0)) {
    console.error('Player deletion verification failed.', {
      playerId,
      teamId,
      verification: relatedRows.map(([table], index) => ({
        count: verificationResults[index].count,
        error: verificationResults[index].error?.message,
        table,
      })),
    });
    throw new ApiError(
      500,
      'PLAYER_DELETE_INCOMPLETE',
      'Eliminazione non verificata. Contatta il supporto.',
    );
  }

  return jsonResponse({ deletedPlayerId: playerId });
}

export async function DELETE(request: Request) {
  try {
    assertDelete(request);
    return await handleDelete(request);
  } catch (error) {
    return errorResponse(error);
  }
}
