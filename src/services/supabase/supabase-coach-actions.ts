import { requireSupabaseClient } from './client';

type CreatePlayerInput = {
  displayName: string;
  playerCode: string;
  pin: string;
  teamId: string;
};

export type PlayerSignupWindow = {
  closesAt: string | null;
  isOpen: boolean;
  remainingSignups: number;
  teamId: string;
};

export type PlayerPinReceipt = {
  pin: string;
  playerCode: string;
};

async function readError(response: Response) {
  const payload = await response.json().catch(() => null) as {
    error?: { message?: string };
  } | null;
  return payload?.error?.message ?? 'Operazione non riuscita.';
}

async function coachAuthorizationHeader() {
  const client = requireSupabaseClient();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessione coach non valida.');
  return { Authorization: `Bearer ${token}` };
}

export async function createPlayerAccount(input: CreatePlayerInput) {
  const response = await fetch('/api/coach/players', {
    method: 'POST',
    headers: {
      ...await coachAuthorizationHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...input, active: true }),
  });

  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<{
    player: {
      id: string;
      displayName: string;
      playerCode: string;
      teamId: string;
      active: boolean;
    };
  }>;
}

export async function getPlayerSignupWindow(teamId: string) {
  const query = new URLSearchParams({ teamId });
  const response = await fetch(`/api/coach/player-signup-window?${query}`, {
    headers: await coachAuthorizationHeader(),
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = await response.json() as { signupWindow: PlayerSignupWindow };
  return payload.signupWindow;
}

export async function setPlayerSignupWindow(teamId: string, open: boolean) {
  const response = await fetch('/api/coach/player-signup-window', {
    method: 'POST',
    headers: {
      ...await coachAuthorizationHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(open ? { teamId, open, durationMinutes: 30 } : { teamId, open }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = await response.json() as { signupWindow: PlayerSignupWindow };
  return payload.signupWindow;
}

export async function regeneratePlayerPin(teamId: string, playerId: string) {
  const response = await fetch('/api/coach/player-pin-reset', {
    method: 'POST',
    headers: {
      ...await coachAuthorizationHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ playerId, teamId }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = await response.json() as { credentials: PlayerPinReceipt };
  return payload.credentials;
}

export async function assignLessonToTeam(teamId: string, lessonId: string) {
  const { data, error } = await requireSupabaseClient().rpc('assign_lesson', {
    p_team_id: teamId,
    p_lesson_id: lessonId,
    p_player_id: null,
    p_due_at: null,
  });
  if (error) throw new Error(`Assegnazione non riuscita: ${error.message}`);
  return data;
}
