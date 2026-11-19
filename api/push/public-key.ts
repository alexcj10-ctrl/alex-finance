import { ApiError, errorResponse, jsonResponse } from '../_lib/http.js';
import { getVapidPublicKey } from '../_lib/web-push.js';

async function handleGet(request: Request) {
  if (request.method !== 'GET') {
    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Metodo non consentito.');
  }

  return jsonResponse({ publicKey: getVapidPublicKey() });
}

export async function GET(request: Request) {
  try {
    return await handleGet(request);
  } catch (error) {
    return errorResponse(error);
  }
}
