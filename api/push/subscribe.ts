import {
  ApiError,
  assertDelete,
  assertPost,
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  readJsonObject,
} from '../_lib/http.js';
import { requirePlayer } from '../_lib/player-auth.js';

const PUSH_KEY_PATTERN = /^[A-Za-z0-9_-]+={0,2}$/;

function parseEndpoint(value: unknown) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 4096) {
    throw new ApiError(400, 'INVALID_PUSH_ENDPOINT', 'Subscription non valida.');
  }

  try {
    const endpoint = new URL(value);
    if (endpoint.protocol !== 'https:') throw new Error('invalid protocol');
  } catch {
    throw new ApiError(400, 'INVALID_PUSH_ENDPOINT', 'Subscription non valida.');
  }

  return value;
}

function parsePushKey(value: unknown, name: 'auth' | 'p256dh') {
  const limits = name === 'p256dh' ? [32, 256] : [16, 128];
  if (
    typeof value !== 'string'
    || value.length < limits[0]
    || value.length > limits[1]
    || !PUSH_KEY_PATTERN.test(value)
  ) {
    throw new ApiError(400, 'INVALID_PUSH_KEYS', 'Subscription non valida.');
  }
  return value;
}

function parseSubscription(body: Record<string, unknown>) {
  const bodyKeys = Object.keys(body).sort();
  const validBodyKeys =
    (bodyKeys.length === 2 && bodyKeys[0] === 'endpoint' && bodyKeys[1] === 'keys')
    || (
      bodyKeys.length === 3
      && bodyKeys[0] === 'endpoint'
      && bodyKeys[1] === 'expirationTime'
      && bodyKeys[2] === 'keys'
    );
  if (!validBodyKeys || !body.keys || typeof body.keys !== 'object' || Array.isArray(body.keys)) {
    throw new ApiError(400, 'INVALID_PUSH_SUBSCRIPTION', 'Subscription non valida.');
  }

  const keys = body.keys as Record<string, unknown>;
  const keyNames = Object.keys(keys).sort();
  if (keyNames.length !== 2 || keyNames[0] !== 'auth' || keyNames[1] !== 'p256dh') {
    throw new ApiError(400, 'INVALID_PUSH_SUBSCRIPTION', 'Subscription non valida.');
  }

  if (
    'expirationTime' in body
    && body.expirationTime !== null
    && typeof body.expirationTime !== 'number'
  ) {
    throw new ApiError(400, 'INVALID_PUSH_SUBSCRIPTION', 'Subscription non valida.');
  }

  return {
    authKey: parsePushKey(keys.auth, 'auth'),
    endpoint: parseEndpoint(body.endpoint),
    p256dh: parsePushKey(keys.p256dh, 'p256dh'),
  };
}

async function handlePost(request: Request) {
  assertPost(request);
  assertSameOrigin(request);
  const subscription = parseSubscription(await readJsonObject(request));
  const { admin, playerId, teamId } = await requirePlayer(request);

  const { data, error } = await admin.rpc('upsert_push_subscription', {
    p_auth_key: subscription.authKey,
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.p256dh,
    p_player_id: playerId,
    p_team_id: teamId,
  });

  if (error || typeof data !== 'string') {
    throw new ApiError(500, 'PUSH_SUBSCRIBE_FAILED', 'Attivazione notifiche non riuscita.');
  }

  return jsonResponse({ subscribed: true }, 201);
}

async function handleDelete(request: Request) {
  assertDelete(request);
  assertSameOrigin(request);
  const body = await readJsonObject(request);
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== 'endpoint') {
    throw new ApiError(400, 'INVALID_PUSH_UNSUBSCRIBE', 'Richiesta non valida.');
  }

  const endpoint = parseEndpoint(body.endpoint);
  const { admin, playerId, teamId } = await requirePlayer(request);
  const { error } = await admin.rpc('deactivate_push_subscription', {
    p_endpoint: endpoint,
    p_player_id: playerId,
    p_team_id: teamId,
  });

  if (error) {
    throw new ApiError(500, 'PUSH_UNSUBSCRIBE_FAILED', 'Disattivazione notifiche non riuscita.');
  }

  return jsonResponse({ subscribed: false });
}

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    return await handleDelete(request);
  } catch (error) {
    return errorResponse(error);
  }
}
