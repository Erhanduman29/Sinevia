/* ============================================================
   SINEVIA — WEB PUSH SERVICE WORKER EKLENTİSİ
   ============================================================
   Bu dosya public/ altındadır ve vite.config.ts içindeki
   `workbox.importScripts` ile üretilen service worker'a dahil edilir.
   Workbox'un önbellek mantığına dokunmaz; yalnızca push olaylarını
   dinler. Böylece uygulama kapalıyken bile bildirim gösterilebilir.

   NOT: `new Notification()` mobil tarayıcılarda (Android Chrome,
   iOS Safari/PWA) çalışmaz. Tek güvenilir yol buradaki
   `registration.showNotification()` çağrısıdır.
   ============================================================ */

const DEFAULT_ICON = '/icon-192.png';
const DEFAULT_URL = '/#network';

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    try {
      payload = { body: event.data ? event.data.text() : '' };
    } catch {
      payload = {};
    }
  }

  const title = typeof payload.title === 'string' && payload.title ? payload.title : 'Sinevia';
  const body = typeof payload.body === 'string' ? payload.body : 'Yeni bir bildirimin var.';
  const url = typeof payload.url === 'string' && payload.url ? payload.url : DEFAULT_URL;

  const options = {
    body,
    icon: typeof payload.icon === 'string' && payload.icon ? payload.icon : DEFAULT_ICON,
    badge: DEFAULT_ICON,
    tag: typeof payload.tag === 'string' && payload.tag ? payload.tag : undefined,
    renotify: typeof payload.tag === 'string' && payload.tag ? true : undefined,
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target =
    (event.notification && event.notification.data && event.notification.data.url) || DEFAULT_URL;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const client of windows) {
        if (!('focus' in client)) continue;
        try {
          await client.focus();
          if (target && 'navigate' in client) {
            try {
              await client.navigate(target);
            } catch {
              /* bazı tarayıcılarda navigate kapalı olabilir; odaklanmak yeterli */
            }
          }
          return;
        } catch {
          /* sıradaki pencereyi dene */
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});

/* Abonelik tarayıcı tarafından yenilenirse açık sekmeye haber ver;
   istemci (src/lib/notifications.ts) yeni aboneliği sunucuya yazar. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      windows.forEach((client) => {
        try {
          client.postMessage({ type: 'sinevia:resubscribe-push' });
        } catch {
          /* yoksay */
        }
      });
    })(),
  );
});
