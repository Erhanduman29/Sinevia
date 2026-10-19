import { useEffect } from 'react';

/**
 * TEBEL GÖRSEL AKTİVATÖRÜ (Opera/Chromium türevi tuzaklarına karşı).
 *
 * Neden var: `loading="lazy"`, iç içe kaydırma konteynerlerinde (örn.
 * #main-scroll) bazı motorlarda (Opera) aşağı indikçe TETİKLENMEZ — görsel
 * hiç yüklenmez. Bu hook, konteynere yaklaşan (veya viewport'a giren) tembel
 * görselleri IntersectionObserver ile yakalar, `loading="eager"`'a çevirip
 * fetch'i kendisi başlatır. Sonradan eklenen görseller MutationObserver ile
 * yakalanır; her görsel bir kez aktive edilir (observe kaldırma + dataset
 * bayrağı) — performans maliyeti tek seferliktir.
 *
 * root: null → viewport; intermediate scroll konteynerlerinin kırpması
 * IO spesifikasyonu gereği intersection rect'e uygulanır (lazy-load'ın
 * aksine IO bu hesabı doğru yapar).
 */
export function useLazyImageActivator(): void {
  useEffect(() => {
    // jsdom/test ortamı ve çok eski motorlar: sessizce pasif
    if (typeof IntersectionObserver === 'undefined') return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const img = entry.target as HTMLImageElement;
          if (img.dataset.lazyActivated === '1') continue;
          img.dataset.lazyActivated = '1';

          // 1) Native yol: eager yap → tarayıcı estimator'ü anında çeker
          img.loading = 'eager';

          // 2) Inatçı motorlar için güvence: henüz inmemişse src'yi yeniden yaz
          //    (aynı URL — HTTP cache'ten gelir, çift istek olmaz)
          if (!img.complete) {
            const src = img.getAttribute('src');
            if (src) {
              img.removeAttribute('src');
              void img.offsetWidth; // reflow zorla (senkron yeniden bağlama)
              img.setAttribute('src', src);
            }
          }

          io.unobserve(img);
        }
      },
      { root: null, rootMargin: '300px 0px' } // 300px erken tetikleme payı
    );

    const observe = (root: Element) => {
      if (root.matches('img[loading="lazy"]:not([data-lazy-activated])')) {
        io.observe(root as HTMLImageElement);
      }
      root
        .querySelectorAll<HTMLImageElement>('img[loading="lazy"]:not([data-lazy-activated])')
        .forEach((img) => io.observe(img));
    };

    // Mevcut DOM
    observe(document.body);

    // Sonradan eklenen bölümler/modaller (tek tek eklenen düğümler yeterli,
    // tam sayfa yeniden tarama yapmıyoruz)
    const mo = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          observe(node as Element);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
}
