/**
 * Geliştirme ortamı render sayacı.
 *
 * Amaç: gereksiz render'ları tahmin etmek yerine ölçmek. Üretimde tamamen
 * etkisizdir (no-op). Kullanımı:
 *
 *   import { probeRender } from '../lib/renderProbe';
 *   probeRender('StatsPage');
 *
 * Tarayıcı konsolunda:
 *   window.__sineviaRenderCounts()
 *   window.__sineviaResetRenderCounts()
 */

type RenderCounts = Record<string, number>;

const counts = new Map<string, number>();

const isDev = (): boolean => {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
};

/** Bileşen render'ını sayar; her 50 render'da konsola özet yazar. */
export function probeRender(name: string): void {
  if (!isDev()) return;
  const next = (counts.get(name) || 0) + 1;
  counts.set(name, next);
  if (next % 50 === 0) {
    // eslint-disable-next-line no-console
    console.debug(`[render] ${name}: ${next}`);
  }
}

export function getRenderCounts(): RenderCounts {
  return Object.fromEntries(counts.entries());
}

export function resetRenderCounts(): void {
  counts.clear();
}

/** Konsoldan erişim için (yalnızca geliştirme ortamı). */
export function installRenderProbeGlobals(): void {
  if (!isDev() || typeof window === 'undefined') return;
  const w = window as unknown as {
    __sineviaRenderCounts?: () => RenderCounts;
    __sineviaResetRenderCounts?: () => void;
  };
  w.__sineviaRenderCounts = () => getRenderCounts();
  w.__sineviaResetRenderCounts = () => resetRenderCounts();
}
