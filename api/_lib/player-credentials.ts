import { createHash, createHmac } from 'node:crypto';

import { ApiError } from './http.js';
import { getServerConfig } from './supabase-admin.js';

const PLAYER_CODE_PATTERN = /^[A-Z0-9]{4,20}$/;
const PLAYER_PIN_PATTERN = /^\d{4,8}$/;
const PLAYER_EMAIL_DOMAIN = 'players.esordienti.invalid';

export function parsePlayerCode(value: unknown) {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'INVALID_PLAYER_CODE', 'Codice giocatore non valido.');
  }

  const playerCode = value.trim().toUpperCase();
  if (!PLAYER_CODE_PATTERN.test(playerCode)) {
    throw new ApiError(400, 'INVALID_PLAYER_CODE', 'Codice giocatore non valido.');
  }

  return playerCode;
}

export function parsePlayerPin(value: unknown) {
  if (typeof value !== 'string' || !PLAYER_PIN_PATTERN.test(value)) {
    throw new ApiError(400, 'INVALID_PLAYER_PIN', 'Il PIN deve avere da 4 a 8 cifre.');
  }

  return value;
}

export function buildPlayerAliasEmail(playerCode: string) {
  return `${playerCode.toLowerCase()}@${PLAYER_EMAIL_DOMAIN}`;
}

export function derivePlayerPassword(playerCode: string, pin: string) {
  const { supabaseSecretKey } = getServerConfig();
  const digest = createHmac('sha256', supabaseSecretKey)
    .update('esordienti-player-pin:v1\0')
    .update(playerCode)
    .update('\0')
    .update(pin)
    .digest('base64url');

  return `Ea1!${digest}`;
}

export function anonymousLoginBucket(playerCode: string) {
  return createHash('sha256').update(playerCode).digest('hex').slice(0, 24);
}
