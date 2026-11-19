const DEFAULT_NOTIFICATION = {
  body: 'Il Coach ha assegnato una nuova lezione.',
  title: 'ESORDIENTI ANALYST',
  url: '/',
};

function readPushPayload(event) {
  if (!event.data) return DEFAULT_NOTIFICATION;

  try {
    const payload = event.data.json();
    return {
      body: typeof payload.body === 'string' ? payload.body : DEFAULT_NOTIFICATION.body,
      lessonId: typeof payload.lessonId === 'string' ? payload.lessonId : undefined,
      title: typeof payload.title === 'string' ? payload.title : DEFAULT_NOTIFICATION.title,
      url: typeof payload.url === 'string' ? payload.url : DEFAULT_NOTIFICATION.url,
    };
  } catch {
    return {
      ...DEFAULT_NOTIFICATION,
      body: event.data.text() || DEFAULT_NOTIFICATION.body,
    };
  }
}

function safeAppUrl(value) {
  try {
    const url = new URL(value || '/', self.location.origin);
    return url.origin === self.location.origin ? url.href : self.location.origin;
  } catch {
    return self.location.origin;
  }
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { lessonId: payload.lessonId, url: safeAppUrl(payload.url) },
      icon: '/images/poggio-mirteto-logo.png',
      badge: '/images/icons/esordienti-analyst-192.png',
      tag: payload.lessonId ? `lesson-${payload.lessonId}` : 'esordienti-analyst',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = safeAppUrl(event.notification.data?.url);

  event.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then(async (windows) => {
        const appWindow = windows.find((client) => {
          try {
            return new URL(client.url).origin === self.location.origin;
          } catch {
            return false;
          }
        });

        if (appWindow) {
          if ('navigate' in appWindow && appWindow.url !== targetUrl) {
            await appWindow.navigate(targetUrl);
          }
          return appWindow.focus();
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});
