import { createHash, timingSafeEqual } from 'node:crypto';

import { ApiError, errorResponse, jsonResponse } from '../_lib/http';
import { getSupabaseAdmin } from '../_lib/supabase-admin';

const BOOTSTRAP_TOKEN_HASH =
  '97738fde789f9358938dbc36928acdbd99dd39c7f81bf36be9a243988a133d4d';
const QA_TEAM_ID = '6d3a09d8-f909-4769-adb7-532dba9f640f';

function readValidToken(request: Request) {
  const token = new URL(request.url).searchParams.get('token')?.trim();
  if (!token) {
    throw new ApiError(404, 'NOT_FOUND', 'Risorsa non disponibile.');
  }

  const actualHash = createHash('sha256').update(token).digest();
  const expectedHash = Buffer.from(BOOTSTRAP_TOKEN_HASH, 'hex');
  if (
    actualHash.byteLength !== expectedHash.byteLength ||
    !timingSafeEqual(actualHash, expectedHash)
  ) {
    throw new ApiError(404, 'NOT_FOUND', 'Risorsa non disponibile.');
  }

  return token;
}

function deriveCredentials(token: string) {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const passwordHash = createHash('sha256')
    .update(`coach-password:${token}`)
    .digest('base64url');

  return {
    email: `coach.qa.${tokenHash.slice(0, 12)}@example.com`,
    password: `Qa1!${passwordHash.slice(0, 28)}`,
  };
}

async function findUserByEmail(
  admin: ReturnType<typeof getSupabaseAdmin>,
  email: string,
) {
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw new ApiError(500, 'QA_USER_LOOKUP_FAILED', 'Bootstrap QA non riuscito.');
  }

  return data.users.find((user) => user.email === email);
}

async function handleBootstrap(request: Request) {
  if (process.env.VERCEL_ENV !== 'preview' || request.method !== 'GET') {
    throw new ApiError(404, 'NOT_FOUND', 'Risorsa non disponibile.');
  }

  const token = readValidToken(request);
  const credentials = deriveCredentials(token);
  const admin = getSupabaseAdmin();
  const displayName = 'Coach QA E2E';

  let createdUser = false;
  let user = await findUserByEmail(admin, credentials.email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      app_metadata: { role: 'coach' },
      email: credentials.email,
      email_confirm: true,
      password: credentials.password,
      user_metadata: { display_name: displayName },
    });

    if (error || !data.user) {
      throw new ApiError(500, 'QA_USER_CREATION_FAILED', 'Bootstrap QA non riuscito.');
    }

    user = data.user;
    createdUser = true;
  }

  const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, {
    password: credentials.password,
    user_metadata: { display_name: displayName },
  });

  if (passwordError) {
    throw new ApiError(500, 'QA_USER_UPDATE_FAILED', 'Bootstrap QA non riuscito.');
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .update({
      account_active: true,
      display_name: displayName,
      player_code: null,
      role: 'coach',
    })
    .eq('id', user.id)
    .select('id')
    .single();

  if (profileError || !profile) {
    if (createdUser) {
      await admin.auth.admin.deleteUser(user.id);
    }
    throw new ApiError(500, 'QA_PROFILE_FAILED', 'Bootstrap QA non riuscito.');
  }

  const { error: teamError } = await admin.from('teams').upsert({
    id: QA_TEAM_ID,
    name: 'Esordienti QA E2E',
    season: '2026/27',
  });
  if (teamError) {
    throw new ApiError(500, 'QA_TEAM_FAILED', 'Bootstrap QA non riuscito.');
  }

  const { error: membershipError } = await admin.from('team_members').upsert(
    {
      active: true,
      profile_id: user.id,
      role: 'coach',
      team_id: QA_TEAM_ID,
    },
    { onConflict: 'team_id,profile_id' },
  );
  if (membershipError) {
    throw new ApiError(500, 'QA_MEMBERSHIP_FAILED', 'Bootstrap QA non riuscito.');
  }

  return jsonResponse({
    coach: {
      displayName,
      email: credentials.email,
      id: user.id,
      password: credentials.password,
    },
    team: {
      id: QA_TEAM_ID,
      name: 'Esordienti QA E2E',
      season: '2026/27',
    },
  });
}

export default async function handler(request: Request) {
  try {
    return await handleBootstrap(request);
  } catch (error) {
    return errorResponse(error);
  }
}
