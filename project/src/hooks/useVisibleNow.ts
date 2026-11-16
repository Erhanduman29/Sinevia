import { useEffect, useRef, useState } from 'react';

/**
 * `document` benzeri, yalnızca ihtiyaç duyulan yüzey.
 * Testlerde sahte bir kaynak geçilebilsin diye dar tutuldu.
 */
export interface VisibilitySource {
  visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export interface VisibleIntervalOptions {
  /** Interval kurulsun mu? (ör. aktif sayaç yoksa false) */
  active: boolean;
  /** Saniye/ms aralığı. Varsayılan 1000 ms. */
  intervalMs?: number;
  /** Her tetiklemede çağrılır. */
  onTick: () => void;
  /** Varsayılan: `document`. Testte sahte bir kaynak verilebilir. */
  source?: DOMDocumentLike | null;
  /** Test enjeksiyonu için; varsayılan global fonksiyonlar. */
  setIntervalFn?: (handler: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearIntervalFn?: (id: ReturnType<typeof setInterval>) => void;
}

type DOMDocumentLike = VisibilitySource;

/**
 * Görünürlük duyarlı interval.
 *
 * - `active` false ise hiç zamanlayıcı kurulmaz.
 * - Sekme görünürken `setInterval` çalışır.
 * - Sekme gizlenince interval durdurulur (CPU/tarayıcı zamanlayıcı tasarrufu).
 * - Sekmeye dönüldüğünde tekrar başlar ve anında bir kez tetikler.
 *
 * Döndürülen fonksiyon temizlik yapar.
 */
export function startVisibilityAwareInterval({
  active,
  intervalMs = 1000,
  onTick,
  source,
  setIntervalFn,
  clearIntervalFn,
}: VisibleIntervalOptions): () => void {
  const doc = source === undefined ? (typeof document === 'undefined' ? null : document) : source;
  if (!active || !doc) return () => {};

  const setInt = setIntervalFn || ((handler: () => void, ms: number) => setInterval(handler, ms));
  const clearInt = clearIntervalFn || ((id: ReturnType<typeof setInterval>) => clearInterval(id));

  let intervalId: ReturnType<typeof setInterval> | undefined;

  const stop = () => {
    if (intervalId !== undefined) {
      clearInt(intervalId);
      intervalId = undefined;
    }
  };

  const start = () => {
    if (intervalId !== undefined) return;
    // Sekmeye geri dönüşte anında güncelle, ardından normal aralıkta devam et.
    onTick();
    intervalId = setInterval(onTick, intervalMs);
  };

  const onVisibilityChange = () => {
    if (doc.visibilityState === 'visible') start();
    else stop();
  };

  onVisibilityChange();
  doc.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    stop();
    doc.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

/**
 * Görünürlük duyarlı "şimdi" tiki.
 *
 * Sayaç/geri sayım ekranları saniyede bir render üretir. Sekme arka plandayken
 * (veya pencere küçültülmüşken) bu tiklerin hiçbir faydası yoktur; yalnızca CPU
 * ve pil tüketir. Bu hook yalnızca:
 *   - `active` true ise,
 *   - sekme görünürken (`document.visibilityState === 'visible'`)
 * `intervalMs` aralığıyla `Date.now()` döndürür. Sekmeye geri dönüldüğünde
 * beklemeden anında tazelenir, böylece süre atlaması görünmez.
 *
 * `active` false iken hiç interval kurulmaz; dönen değer sabit kalır.
 */
export function useVisibleNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  const tickRef = useRef<() => void>(() => setNow(Date.now()));
  tickRef.current = () => setNow(Date.now());

  useEffect(() => {
    return startVisibilityAwareInterval({
      active,
      intervalMs,
      onTick: () => tickRef.current(),
    });
  }, [active, intervalMs]);

  return now;
}
