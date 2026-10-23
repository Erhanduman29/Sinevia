import type { Movie, WeeklyPlanItem } from '../types';

/** "YYYY-MM-DD" tarihini yerel takvim günü olarak ayrıştırır. Geçersizse null. */
function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Planlanan gün + 2 takvim günü. Bugün bu tarihten SONRA ise (yani planlanan
 * günün üzerinden 2 tam gün geçmişse) ve film hâlâ izlenmemişse plandan düşer.
 * Örnek: 20 Ekim planı → 21 ve 22 kalır, 23 Ekim'de silinir.
 */
export function planItemExpiryDate(item: Pick<WeeklyPlanItem, 'date'>): string | null {
  const scheduled = parseLocalDate(item.date);
  if (!scheduled) return null;
  scheduled.setDate(scheduled.getDate() + 2);
  return toDateKey(scheduled);
}

export function isPlanItemExpired(
  item: WeeklyPlanItem,
  movies: Movie[],
  today: string,
): boolean {
  const expiry = planItemExpiryDate(item);
  if (!expiry) return false; // geçersiz tarihi temkinli şekilde koru
  if (today <= expiry) return false;

  const movie = movies.find((entry) => entry.id === item.movieId);
  // Film bulunamıyorsa (silinmiş) plan kaydı sahipsizdir; süresi dolunca temizlenir.
  return !movie?.watched;
}

/** Süresi dolmuş, izlenmemiş plan kayıtlarını döndürür. Değişiklik yoksa aynı diziyi verir. */
export function pruneExpiredPlanItems(
  plan: WeeklyPlanItem[],
  movies: Movie[],
  today: string,
): WeeklyPlanItem[] {
  const kept = plan.filter((item) => !isPlanItemExpired(item, movies, today));
  return kept.length === plan.length ? plan : kept;
}

export function hasExpiredPlanItems(
  plan: WeeklyPlanItem[],
  movies: Movie[],
  today: string,
): boolean {
  return plan.some((item) => isPlanItemExpired(item, movies, today));
}
