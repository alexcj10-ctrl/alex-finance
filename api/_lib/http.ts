const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const MAX_JSON_BODY_BYTES = 8 * 1024;

type ErrorPayload = {
  error: {
    code: string;
    message: string;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function responseHeaders() {
  return {
    'Cache-Control': 'no-store',
    'Content-Type': JSON_CONTENT_TYPE,
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
}

export function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: responseHeaders(),
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return jsonResponse(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      } satisfies ErrorPayload,
      error.status,
    );
  }

  return jsonResponse(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Si è verificato un errore. Riprova tra poco.',
      },
    } satisfies ErrorPayload,
    500,
  );
}

export function assertPost(request: Request) {
  if (request.method !== 'POST') {
    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metodo non consentito.');
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  let requestOrigin: string;

  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origine non consentita.');
  }

  if (!origin || origin !== requestOrigin) {
    throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origine non consentita.');
  }
}

export async function readJsonObject(request: Request) {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  if (!contentType.startsWith('application/json')) {
    throw new ApiError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Il contenuto deve essere JSON.',
    );
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Richiesta troppo grande.');
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Richiesta troppo grande.');
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'JSON non valido.');
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'INVALID_BODY', 'Dati non validi.');
  }

  return value as Record<string, unknown>;
}

export function readBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);

  if (!match) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Accesso richiesto.');
  }

  return match[1];
}
