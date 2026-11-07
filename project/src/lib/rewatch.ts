import type { WatchHistoryItem } from '../types';

/** Aynı filmi tekrar izlemek için gereken bekleme süresi (1 ay). */
export const REWATCH_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export interface RewatchCooldown {
  canRewatch: boolean;
  remainingMs: number;
  lastWatchedAt: string | null;
}

function isMovieHistory(item: WatchHistoryItem): boolean {
  return item.kind === 'movie' || item.type === 'movie';
}

/**
 * Filmin son NORMAL izleme kaydına göre tekrar izleme beklemesini hesaplar.
 * - Yalnızca "önceden izlenenler" kaydı varsa bekleme yoktur.
 * - "Önceden izlenenler" sekmesinden başlatılan tekrar izlemelerde çağıran taraf
 *   bekleme kontrolünü atlar.
 */
export function getRewatchCooldown(
  history: WatchHistoryItem[],
  movieId: string,
  nowMs = Date.now()
): RewatchCooldown {
  let lastMs = 0;
  let lastWatchedAt: string | null = null;

  for (const item of history) {
    if (!isMovieHistory(item) || item.itemId !== movieId || item.isPastWatch) continue;
    const ms = new Date(item.watchedAt).getTime();
    if (Number.isFinite(ms) && ms > lastMs) {
      lastMs = ms;
      lastWatchedAt = item.watchedAt;
    }
  }

  if (!lastMs) return { canRewatch: true, remainingMs: 0, lastWatchedAt: null };

  const remainingMs = Math.max(0, lastMs + REWATCH_COOLDOWN_MS - nowMs);
  return { canRewatch: remainingMs === 0, remainingMs, lastWatchedAt };
}

/** Kalan bekleme süresini "X gün" olarak döndürür (0 ise boş metin). */
export function formatRewatchRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return '';
  return `${Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))} gün`;
}
