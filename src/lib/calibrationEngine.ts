import type { Movie } from '../types';

/* =========================================================================
   KÖR KALİBRASYON VE ELO MOTORU
   Kullanıcı puanı (rating) ile düello tabanlı kalibre puan (calibratedScore)
   arasındaki farkı Elo benzeri bir modelle kapatır.
   - K = 0.16 (yumuşak güncellemeler; 8.00 vs 8.00 → 8.08 / 7.92)
   - delta = K * (1 - E), E = 1 / (1 + 10^((B - A) / 2))
   - Sonuç her zaman [1, 10] aralığında ve 2 ondalık yuvarlanır.
   Saf fonksiyonlar — reducer içinden güvenle çağrılır.
   ========================================================================= */

export const ELO_K = 0.16;
export const RATING_MIN = 1;
export const RATING_MAX = 10;
/** Anomali eşiği: |rating - calibratedScore| >= 0.45 ve en az 4 düello. */
export const ANOMALY_DELTA = 0.45;
export const ANOMALY_MIN_DUELS = 4;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clampRating(n: number): number {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, n));
}

/** İki puan arasındaki beklenen kazanma olasılığı (Elo E-değeri). */
export function expectedWinProbability(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 2));
}

/**
 * Bir düelloyu çözer: kazananın kalibre puanı yükselir, kaybedeninkı aynı
 * miktarda düşer. Sonuç { winnerNew, loserNew } (round2 + clamp [1,10]).
 * Örnek: 8.00 vs 8.00 → 8.08 / 7.92 (delta = 0.16 * (1 - 0.5) = 0.08).
 */
export function calculateEloDelta(
  winnerCalibrated: number,
  loserCalibrated: number
): { winnerNew: number; loserNew: number; delta: number } {
  const eWinner = expectedWinProbability(winnerCalibrated, loserCalibrated);
  const delta = round2(ELO_K * (1 - eWinner));
  const winnerNew = round2(clampRating(winnerCalibrated + delta));
  const loserNew = round2(clampRating(loserCalibrated - delta));
  return { winnerNew, loserNew, delta };
}

export interface DuelPair {
  a: Movie;
  b: Movie;
  mode: 'target' | 'closest';
}

function commonGenreCount(a: Movie, b: Movie): number {
  const setB = new Set(b.genres || []);
  return (a.genres || []).filter((g) => setB.has(g)).length;
}

/**
 * Sıradaki düello eşleşmesini seçer.
 * - `targetMovieId` verilirse (Mod 1 — Anlık Kalibrasyon): hedef filmin puanına
 *   en yakın (±0.5 penceresi), ortak tür avantajlı film.
 * - Verilmezse (Mod 2 — Filmleri Karşılaştır): puan farkı <= 0.5 olan (aynı puanlı
 *   ikiliye öncelik), en az düelloya girmiş (duelCount en düşük) ikili.
 * - `opts.genres` verilirse sadece o tür(lere) sahip filmler havuza girer.
 * - `opts.random` ise eşleşmeler arasından rastgele seçilir.
 * Düello YALNIZCA aynı puanlı veya ±0.5 farkla mümkündür; fallback yoktur.
 */
export function pickDuelPair(
  movies: Movie[],
  targetMovieId?: string,
  opts?: { genres?: string[]; random?: boolean }
): DuelPair | null {
  let pool = movies.filter(
    (m) => m.watched && m.rating != null && !m.abandoned
  );
  if (opts?.genres && opts.genres.length > 0) {
    const gs = new Set(opts.genres);
    pool = pool.filter((m) => (m.genres || []).some((g) => gs.has(g)));
  }
  if (pool.length < 2) return null;

  if (targetMovieId) {
    const target = pool.find((m) => m.id === targetMovieId);
    if (!target) return null;
    const targetRating = target.rating as number;
    const others = pool.filter((m) => m.id !== target.id);
    // En yakın puan; ±0.5 penceresi varsa öncelik; ortak tür beraberlik kırar.
    const sorted = [...others].sort((x, y) => {
      const dx = Math.abs((x.rating as number) - targetRating);
      const dy = Math.abs((y.rating as number) - targetRating);
      if (dx !== dy) return dx - dy;
      return commonGenreCount(target, y) - commonGenreCount(target, x);
    });
    const best = sorted[0];
    if (!best) return null;
    // Kural: düello yalnızca aynı puanlı veya ±0.5 farkla mümkün.
    if (Math.abs((best.rating as number) - targetRating) > 0.5) return null;
    return { a: target, b: best, mode: 'target' };
  }

  // Mod 2: ±0.5 penceresindeki aday ikililer — aynı puan önce, sonra en az duelCount.
  let bestPair: DuelPair | null = null;
  let bestKey: { gap: number; duels: number; genre: number } | null = null;
  const candidates: DuelPair[] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i], b = pool[j];
      const gap = Math.abs((a.rating as number) - (b.rating as number));
      if (gap > 0.5) continue;
      const pair: DuelPair = { a, b, mode: 'closest' };
      candidates.push(pair);
      const duels = (a.duelCount || 0) + (b.duelCount || 0);
      const genre = commonGenreCount(a, b);
      const key = { gap: round2(gap), duels, genre };
      const better =
        !bestKey ||
        key.gap < bestKey.gap ||                       // aynı/en yakın puan önce
        (key.gap === bestKey.gap &&
          (key.duels < bestKey.duels ||                 // en az düelloya girmiş
            (key.duels === bestKey.duels && key.genre > bestKey.genre))); // ortak tür
      if (better) {
        bestKey = key;
        bestPair = pair;
      }
    }
  }
  // ±0.5 dışı eşleşme YOK (kural: aynı puan veya en fazla 0.5 fark). Aday yoksa null.
  if (opts?.random && candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  return bestPair;
}

export interface RatingAnomaly {
  movie: Movie;
  rating: number;
  calibratedScore: number;
  gap: number;
  direction: 'raise' | 'lower';
  suggestion: number;
}

/**
 * Anomali taraması: en az ANOMALY_MIN_DUELS düellosu olan ve
 * |rating - calibratedScore| eşiği aşan filmler için öneri üretir.
 * Öneri, kalibre puanın kendisidir (rating ile eşitleme).
 */
export function detectRatingAnomalies(movies: Movie[]): RatingAnomaly[] {
  const out: RatingAnomaly[] = [];
  for (const m of movies) {
    if (m.rating == null || m.calibratedScore == null) continue;
    if ((m.duelCount || 0) < ANOMALY_MIN_DUELS) continue;
    const gap = round2(m.calibratedScore - m.rating);
    if (Math.abs(gap) < ANOMALY_DELTA) continue;
    out.push({
      movie: m,
      rating: m.rating,
      calibratedScore: m.calibratedScore,
      gap,
      direction: gap > 0 ? 'raise' : 'lower',
      suggestion: round2(clampRating(m.calibratedScore)),
    });
  }
  return out.sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap));
}
