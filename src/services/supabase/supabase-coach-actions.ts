import { requireSupabaseClient } from './client';

type CreatePlayerInput = {
  displayName: string;
  playerCode: string;
  pin: string;
  teamId: string;
};

async function readError(response: Response) {
  const payload = await response.json().catch(() => null) as {
    error?: { message?: string };
  } | null;
  return payload?.error?.message ?? 'Operazione non riuscita.';
}

export async function createPlayerAccount(input: CreatePlayerInput) {
  const client = requireSupabaseClient();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessione coach non valida.');

  const response = await fetch('/api/coach/players', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
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
