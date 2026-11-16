import type { Movie, Series } from '../types';

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
 * Bir düelloyu çözer: kazananın kalibre puanı sabit +0.1 artar,
 * kaybedenininkı sabit -0.1 azar. Sonuç { winnerNew, loserNew } (round2 + clamp [1,10]).
 * Alt puan 1, üst puan 10 — 1 puanlı bir film kaybedince 0.9'a inmez, 1'de kalır.
 */
export function calculateEloDelta(
  winnerCalibrated: number,
  loserCalibrated: number
): { winnerNew: number; loserNew: number; delta: number } {
  const delta = 0.1;
  const winnerNew = round2(clampRating(winnerCalibrated + delta));
  const loserNew = round2(clampRating(loserCalibrated - delta));
  return { winnerNew, loserNew, delta };
}

/**
 * Beraberlik: iki taraf da "kazanan" sayılır, ancak hareket yönü kendi
 * puanına göre belirlenir — 5 üstü +0.1, 5 altı -0.1, tam 5 sabit.
 * (Kötü bir film berabere kaldığında puan kazanmaz.)
 */
export function calculateEloTie(
  firstCalibrated: number,
  secondCalibrated: number
): { aNew: number; bNew: number; deltaA: number; deltaB: number } {
  const step = (v: number): number => (v > 5 ? 0.1 : v < 5 ? -0.1 : 0);
  const deltaA = step(firstCalibrated);
  const deltaB = step(secondCalibrated);
  return {
    aNew: round2(clampRating(firstCalibrated + deltaA)),
    bNew: round2(clampRating(secondCalibrated + deltaB)),
    deltaA,
    deltaB,
  };
}

/**
 * DÜELLO ADAYI — film veya dizi ortak modeli.
 * DuelSide / eşleşme motoru bu arayüz üzerinden çalışır; mediaType sayesinde
 * film-dizi karışımı asla olmaz.
 */
export interface DuelCandidate {
  id: string;
  title: string;
  year?: number;
  genres: string[];
  posterUrl: string | null;
  rating: number;
  calibratedScore?: number;
  duelCount?: number;
  duelWins?: number;
  duelLosses?: number;
  duelOpponents?: string[]; // legacy fallback (eski kayıtlar için)
  mediaType: 'movie' | 'series';
}

/** Eşleşme sonucu. */
export interface DuelPair {
  a: DuelCandidate;
  b: DuelCandidate;
  mode: 'target' | 'closest';
}

/** Eşleşme anahtarı: mediaType + sıralı id çifti. Aynı film/dizi çifti
 *  film ile dizi arasında çakışmaz; id sırası değiştirilse de aynı anahtar olur. */
export function duelPairKey(
  mediaType: 'movie' | 'series',
  aId: string,
  bId: string
): string {
  const [x, y] = [aId, bId].sort();
  return `${mediaType}:${x}::${y}`;
}

/** İki yapım daha önce düelloda karşılaştı mı?
 *  - `seenPairs` kayıtlı çiftleri kontrol eder (kanonik, kalıcı).
 *  - Eski `duelOpponents` alanına düşer (geriye uyumluluk). */
export interface DuelRecord {
  id: string;
  mediaType?: 'movie' | 'series';
  duelOpponents?: string[];
}

export function haveDueled(
  a: DuelRecord,
  b: DuelRecord,
  seenPairs?: Set<string>
): boolean {
  const typeA = a.mediaType ?? 'movie';
  const typeB = b.mediaType ?? 'movie';
  if (typeA !== typeB) return false;
  const key = duelPairKey(typeA, a.id, b.id);
  if (seenPairs?.has(key)) return true;
  return Boolean(
    (a.duelOpponents?.includes(b.id) ?? false) ||
    (b.duelOpponents?.includes(a.id) ?? false)
  );
}

/** Film → DuelCandidate dönüştürücü. */
export function movieToDuelCandidate(m: Movie): DuelCandidate {
  return {
    id: m.id,
    title: m.title,
    year: m.year ? Number(m.year) : undefined,
    genres: m.genres || [],
    posterUrl: m.posterUrl ?? null,
    rating: typeof m.rating === 'number' ? m.rating : 0,
    calibratedScore: m.calibratedScore,
    duelCount: m.duelCount,
    duelWins: m.duelWins,
    duelLosses: m.duelLosses,
    duelOpponents: m.duelOpponents,
    mediaType: 'movie',
  };
}

/** Dizi → DuelCandidate dönüştürücü. Etkin puan:
 *  overallRating → seasonRatings ortalaması → puanlı bölümlerin ortalaması. */
export function seriesToDuelCandidate(s: Series): DuelCandidate | null {
  const rating = effectiveSeriesRating(s);
  if (rating == null) return null; // puanız dizi aday değildir
  return {
    id: s.id,
    title: s.title,
    year: s.year ? Number(s.year) : undefined,
    genres: s.genres || [],
    posterUrl: s.posterUrl ?? null,
    rating,
    calibratedScore: s.calibratedScore,
    duelCount: s.duelCount,
    duelWins: s.duelWins,
    duelLosses: s.duelLosses,
    duelOpponents: s.duelOpponents,
    mediaType: 'series',
  };
}

/**
 * Dizi için etkin puanı döndürür.
 * Öncelik: overallRating → seasonRatings içindeki geçerli puanların ortalaması →
 * puanlı bölümlerin ortalaması. Hiçbiri yoksa null.
 */
export function effectiveSeriesRating(s: Series): number | null {
  if (typeof s.overallRating === 'number') return round2(s.overallRating);

  const seasonRatings = Object.values(s.seasonRatings || {}).filter(
    (sr) => typeof sr?.rating === 'number'
  );
  if (seasonRatings.length > 0) {
    const avg =
      seasonRatings.reduce((sum, sr) => sum + sr.rating, 0) / seasonRatings.length;
    return round2(avg);
  }

  const episodeRatings = s.episodes.filter((ep) => typeof ep.rating === 'number');
  if (episodeRatings.length > 0) {
    const avg =
      episodeRatings.reduce((sum, ep) => sum + (ep.rating as number), 0) /
      episodeRatings.length;
    return round2(avg);
  }

  return null;
}

/** İki adayın ortak tür sayısı. */
function commonGenreCount(a: DuelCandidate, b: DuelCandidate): number {
  const setB = new Set(b.genres || []);
  return (a.genres || []).filter((g) => setB.has(g)).length;
}

/**
 * Sıradaki düello eşleşmesini seçer.
 * - `targetId` verilirse: hedef adayın puanına en yakın (±0.5 penceresi),
 *   ortak tür avantajlı eşlikçi.
 * - Verilmezse: puan farkı <= 0.5 olan, en az düelloya girmiş ikili.
 * - `opts.genres` verilirse sadece o tür(lere) sahip adaylar havuza girer.
 * - `opts.random` ise eşleşmeler arasından rastgele seçilir.
 * - `opts.seenPairs` verilirse bu çiftler devre dışı bırakılır.
 * - Film ve dizi asla aynı havuzda eşleşmez (çağıran ayrı havuz oluşturur).
 * Düello YALNIZCA aynı puanlı veya ±0.5 farkla mümkündür; fallback yoktur.
 * Karmaşıklık: O(n · k), k = ortalama ±0.5 bandındaki aday sayısı (n² değil).
 */
export function pickDuelCandidatePair(
  candidates: DuelCandidate[],
  targetId?: string,
  opts?: { genres?: string[]; random?: boolean; seenPairs?: Set<string> }
): DuelPair | null {
  const seen = opts?.seenPairs;

  let pool = candidates.filter((c) => c.rating != null && c.rating > 0);
  if (opts?.genres && opts.genres.length > 0) {
    const gs = new Set(opts.genres);
    pool = pool.filter((c) => (c.genres || []).some((g) => gs.has(g)));
  }
  if (pool.length < 2) return null;

  if (targetId) {
    const target = pool.find((c) => c.id === targetId);
    if (!target) return null;
    const targetRating = target.rating;
    const others = pool.filter(
      (c) => c.id !== target.id && c.mediaType === target.mediaType && !haveDueled(target, c, seen)
    );
    const sorted = [...others].sort((x, y) => {
      const dx = Math.abs(x.rating - targetRating);
      const dy = Math.abs(y.rating - targetRating);
      if (dx !== dy) return dx - dy;
      return commonGenreCount(target, y) - commonGenreCount(target, x);
    });
    const best = sorted[0];
    if (!best) return null;
    if (Math.abs(best.rating - targetRating) > 0.5) return null;
    return { a: target, b: best, mode: 'target' };
  }

  // Mod 2: puanlara göre sırala, sonra ±0.5 bandındaki komşuları tara (O(n·k)).
  const sorted = [...pool].sort((a, b) => a.rating - b.rating);

  let bestPair: DuelPair | null = null;
  let bestKey: { gap: number; duels: number; genre: number } | null = null;
  const candidatePairs: DuelPair[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      const gap = b.rating - a.rating; // sıralı olduğu için gap >= 0
      if (gap > 0.5) break; // daha ileri gap'ler de büyük olacak, dur
      // Film-dizi asla eşleşmez (havuz karışık gelse bile).
      if (a.mediaType !== b.mediaType) continue;
      if (haveDueled(a, b, seen)) continue;
      const pair: DuelPair = { a, b, mode: 'closest' };
      candidatePairs.push(pair);
      const duels = (a.duelCount || 0) + (b.duelCount || 0);
      const genre = commonGenreCount(a, b);
      const key = { gap: round2(gap), duels, genre };
      const better =
        !bestKey ||
        key.gap < bestKey.gap ||                       // aynı/en yakın puan önce
        (key.gap === bestKey.gap &&
          (key.duels < bestKey.duels ||                 // en az düelloya girmiş
            (key.duels === bestKey.duels &&
              key.genre > bestKey.genre))); // ortak tür
      if (better) {
        bestKey = key;
        bestPair = pair;
      }
    }
  }

  // ±0.5 dışı eşleşme YOK (kural: aynı puan veya en fazla 0.5 fark).
  if (opts?.random && candidatePairs.length > 0) {
    return candidatePairs[Math.floor(Math.random() * candidatePairs.length)];
  }
  return bestPair;
}

/**
 * Geriye uyumlu sarmalayıcı: Movie[] alır, Movie[] üzerinde çalışır.
 * RatingModal tarafından kullanılır; imza aynı kalır.
 */
export interface MovieDuelPair {
  a: Movie;
  b: Movie;
  mode: 'target' | 'closest';
}

export function pickDuelPair(
  movies: Movie[],
  targetMovieId?: string,
  opts?: { genres?: string[]; random?: boolean }
): MovieDuelPair | null {
  // Eski davranış korunur: izlenmemiş, puansız ve yarım bırakılmış filmler havuza girmez.
  const eligible = movies.filter(
    (m) => m.watched && typeof m.rating === 'number' && !m.abandoned
  );
  const candidates = eligible.map(movieToDuelCandidate);
  const result = pickDuelCandidatePair(candidates, targetMovieId, opts);
  if (!result) return null;
  const byId = new Map(eligible.map((m) => [m.id, m]));
  const a = byId.get(result.a.id);
  const b = byId.get(result.b.id);
  if (!a || !b) return null;
  return { a, b, mode: result.mode };
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
