import { requireSupabaseClient } from './supabase/client';

export type PushNotificationState = {
  needsHomeScreen: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
  supported: boolean;
};

let serviceWorkerRegistration: Promise<ServiceWorkerRegistration> | undefined;

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandaloneApp() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function hasPushSupport() {
  return typeof window !== 'undefined'
    && typeof Notification !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const binary = window.atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function authorizationHeader() {
  const client = requireSupabaseClient();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessione Player non valida. Accedi di nuovo.');
  return { Authorization: `Bearer ${token}` };
}

async function readApiError(response: Response) {
  const payload = await response.json().catch(() => null) as {
    error?: string | { message?: string };
  } | null;
  if (typeof payload?.error === 'string') return payload.error;
  return payload?.error?.message ?? 'Operazione non riuscita.';
}

export function registerPushServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.reject(new Error('Service worker non supportato.'));
  }

  serviceWorkerRegistration ??= navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .catch((error: unknown) => {
      serviceWorkerRegistration = undefined;
      throw error;
    });
  return serviceWorkerRegistration;
}

export async function getPushNotificationState(): Promise<PushNotificationState> {
  const needsHomeScreen = isIosDevice() && !isStandaloneApp();
  if (!hasPushSupport()) {
    return {
      needsHomeScreen,
      permission: 'unsupported',
      subscribed: false,
      supported: false,
    };
  }

  const permission = Notification.permission;
  if (permission !== 'granted') {
    return { needsHomeScreen, permission, subscribed: false, supported: true };
  }

  const registration = await registerPushServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  return {
    needsHomeScreen,
    permission,
    subscribed: subscription !== null,
    supported: true,
  };
}

export async function activatePushNotifications() {
  const state = await getPushNotificationState();
  if (!state.supported || state.needsHomeScreen) return state;

  let permission = state.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') return getPushNotificationState();

  const [registration, keyResponse] = await Promise.all([
    registerPushServiceWorker(),
    fetch('/api/push/public-key'),
  ]);
  if (!keyResponse.ok) throw new Error(await readApiError(keyResponse));

  const keyPayload = await keyResponse.json() as {
    publicKey?: string;
    vapidPublicKey?: string;
  };
  const publicKey = keyPayload.publicKey ?? keyPayload.vapidPublicKey;
  if (!publicKey) throw new Error('Chiave notifiche non disponibile.');

  const subscription = await registration.pushManager.getSubscription()
    ?? await registration.pushManager.subscribe({
      applicationServerKey: urlBase64ToUint8Array(publicKey),
      userVisibleOnly: true,
    });

  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      ...await authorizationHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error(await readApiError(response));

  return getPushNotificationState();
}

export async function deactivatePushNotifications() {
  if (!hasPushSupport()) return getPushNotificationState();

  const registration = await registerPushServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return getPushNotificationState();

  const response = await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: {
      ...await authorizationHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  if (!response.ok) throw new Error(await readApiError(response));

  await subscription.unsubscribe();
  return getPushNotificationState();
}
