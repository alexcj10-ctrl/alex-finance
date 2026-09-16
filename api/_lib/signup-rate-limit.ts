import { createHash } from 'node:crypto';

import { ApiError } from './http.js';

const WINDOW_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_BUCKETS = 2_000;

type AttemptBucket = {
  attempts: number;
  resetAt: number;
};

const attemptsByAddress = new Map<string, AttemptBucket>();

function clientAddress(request: Request) {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function anonymizedAddress(request: Request) {
  return createHash('sha256').update(clientAddress(request)).digest('hex').slice(0, 32);
}

function clearExpiredBuckets(now: number) {
  if (attemptsByAddress.size < MAX_BUCKETS) return;

  for (const [key, bucket] of attemptsByAddress) {
    if (bucket.resetAt <= now) attemptsByAddress.delete(key);
  }
}

export function consumeSignupAttempt(request: Request) {
  const now = Date.now();
  clearExpiredBuckets(now);

  const key = anonymizedAddress(request);
  if (!attemptsByAddress.has(key) && attemptsByAddress.size >= MAX_BUCKETS) {
    throw new ApiError(
      429,
      'SIGNUP_CAPACITY_REACHED',
      'Registrazione temporaneamente occupata. Riprova tra qualche minuto.',
    );
  }

  const current = attemptsByAddress.get(key);
  const bucket =
    !current || current.resetAt <= now
      ? { attempts: 0, resetAt: now + WINDOW_MS }
      : current;

  bucket.attempts += 1;
  attemptsByAddress.set(key, bucket);

  if (bucket.attempts > MAX_ATTEMPTS) {
    throw new ApiError(
      429,
      'TOO_MANY_SIGNUPS',
      'Sono stati creati troppi profili da questo dispositivo. Riprova più tardi.',
    );
  }
}
