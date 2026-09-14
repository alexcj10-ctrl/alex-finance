import { ApiError } from './http.js';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const MAX_BUCKETS = 2_000;

type AttemptBucket = {
  attempts: number;
  resetAt: number;
};

const attemptsByKey = new Map<string, AttemptBucket>();

function clientAddress(request: Request) {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) {
    return realIp;
  }

  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',').at(-1)?.trim() || 'unknown';
}

function clearExpiredBuckets(now: number) {
  if (attemptsByKey.size < MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of attemptsByKey) {
    if (bucket.resetAt <= now) {
      attemptsByKey.delete(key);
    }
  }
}

export function consumeLoginAttempt(request: Request, anonymizedCode: string) {
  const now = Date.now();
  clearExpiredBuckets(now);

  const key = `${clientAddress(request)}:${anonymizedCode}`;
  const current = attemptsByKey.get(key);
  const bucket =
    !current || current.resetAt <= now
      ? { attempts: 0, resetAt: now + WINDOW_MS }
      : current;

  bucket.attempts += 1;
  attemptsByKey.set(key, bucket);

  if (bucket.attempts > MAX_ATTEMPTS) {
    throw new ApiError(
      429,
      'TOO_MANY_ATTEMPTS',
      'Troppi tentativi. Attendi qualche minuto e riprova.',
    );
  }
}

export function clearLoginAttempts(request: Request, anonymizedCode: string) {
  attemptsByKey.delete(`${clientAddress(request)}:${anonymizedCode}`);
}
