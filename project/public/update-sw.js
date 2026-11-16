/* ============================================================
   SINEVIA — ESKİ SÜRÜMÜ ÇALIŞTIRAN SAYFALARI ZORLA YENİLE
   ============================================================
   Bu dosya public/ altındadır ve vite.config.ts içindeki
   `workbox.importScripts` ile üretilen service worker'a dahil edilir.

   Sorun: 5.0 gibi eski bir sürümdeki sayfa, yeni service worker
   devreye girse bile kendi JS paketiyle çalışmaya devam ediyordu.
   Özellikle ana ekran PWA'ları hiç tam sayfa yenilemediği için
   cihaz eski sürümde kilitleniyordu.

   Çözüm: Yeni service worker bir GÜNCELLEME olarak aktif olduğunda
   (activate), açık pencereleri kendisi yeniden yükler. Böylece eski
   sayfada güncelleme kodu olmasa bile cihaz bir sonraki açılışta
   yeni sürüme geçer.

   - İlk kurulumda (registration.active yokken) yenileme yapılmaz;
     yeni ziyaretçi gereksiz bir sayfa yenilemesi görmez.
   - `_guncelleme` parametreli adresler atlanır; uygulamanın kendi
     zorla-güncelleme akışında gereksiz ikinci bir yenileme olmaz.
   - `client.navigate()` sözü BEKLENMEZ: activate olayı bitmeden
     yapılan gezinme isteği, yeni SW'nin fetch'i devralmasını
     beklediği için kilitlenebilir. İsteği başlatıp bırakıyoruz.
   ============================================================ */

/** Bu service worker bir güncelleme mi, yoksa ilk kurulum mu? */
let isUpdate = false;

self.addEventListener('install', () => {
  try {
    // Güncellemede eski service worker hâlâ `active` durumundadır.
    isUpdate = Boolean(self.registration.active);
  } catch {
    isUpdate = false;
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
      } catch {
        /* yoksay */
      }

      if (!isUpdate) return;

      let clients = [];
      try {
        clients = await self.clients.matchAll({ type: 'window' });
      } catch {
        return;
      }

      for (const client of clients) {
        try {
          const url = new URL(client.url);
          if (url.searchParams.has('_guncelleme')) continue;
          // Sözü await etmiyoruz; aksi halde aktivasyon kilitlenebilir.
          void client.navigate(client.url).catch(() => undefined);
        } catch {
          /* Bazı tarayıcılar navigate() desteklemez; yoksay. */
        }
      }
    })()
  );
});
