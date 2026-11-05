import { describe, test, expect } from 'vitest';
import {
  calculateEloDelta,
  calculateEloTie,
  haveDueled,
  pickDuelPair,
  detectRatingAnomalies,
  expectedWinProbability,
  ELO_K,
  ANOMALY_DELTA,
  ANOMALY_MIN_DUELS,
} from '../lib/calibrationEngine';
import type { Movie } from '../types';

function makeMovie(over: Partial<Movie>): Movie {
  return {
    id: over.id ?? 'm1',
    title: over.title ?? 'Film',
    year: '2020',
    genres: [],
    collectionId: null,
    watched: true,
    rating: null,
    note: '',
    watchedAt: '2024-01-01T10:00:00.000Z',
    addedAt: '2024-01-01T10:00:00.000Z',
    ...over,
  };
}

describe('calculateEloDelta (Düello Puan Motoru)', () => {
  test('kazanana sabit +0.1, kaybedene -0.1: 8.00 vs 8.00 → 8.10 / 7.90', () => {
    const { winnerNew, loserNew, delta } = calculateEloDelta(8.00, 8.00);
    expect(delta).toBe(0.1);
    expect(winnerNew).toBe(8.1);
    expect(loserNew).toBe(7.9);
  });

  test('delta her zaman 0.1 (puan farkına bağımsız)', () => {
    const fav = calculateEloDelta(9, 1);
    const even = calculateEloDelta(8, 8);
    expect(fav.delta).toBe(0.1);
    expect(even.delta).toBe(0.1);
  });

  test('clamp üst: 9.95 kazandıysa 10.05 → 10 (aşmaz)', () => {
    const top = calculateEloDelta(9.95, 9.95);
    expect(top.winnerNew).toBe(10);
  });

  test('clamp alt: 1.05 kaybettiyse 0.95 → 1 (0.9\'a inmez)', () => {
    const bottom = calculateEloDelta(1.05, 1.05);
    expect(bottom.loserNew).toBe(1);
  });

  test('1 puanlı film kaybettiyse 1\'de kalır (alt sınır 1)', () => {
    const bottom = calculateEloDelta(2, 1);
    expect(bottom.loserNew).toBe(1);
  });

  test('10 puanlı film kazandıysa 10\'da kalır (üst sınır 10)', () => {
    const top = calculateEloDelta(10, 9);
    expect(top.winnerNew).toBe(10);
  });

  test('round2: tüm sonuçlar en fazla 2 ondalık basamağa sahiptir', () => {
    const cases: Array<[number, number]> = [[7.333, 7.111], [6.49, 6.51], [3.7, 3.7], [9.2, 4.4]];
    for (const [w, l] of cases) {
      const r = calculateEloDelta(w, l);
      expect(Number.isInteger(Math.round(r.winnerNew * 100))).toBe(true);
      expect(Number.isInteger(Math.round(r.loserNew * 100))).toBe(true);
      expect(Math.abs(r.winnerNew - Math.round(r.winnerNew * 100) / 100)).toBeLessThan(1e-9);
    }
  });
});

describe('pickDuelPair', () => {
  test('uygun film yoksa veya havuz 1 filmse null döner', () => {
    expect(pickDuelPair([])).toBeNull();
    expect(pickDuelPair([makeMovie({ id: 'only', rating: 8 })])).toBeNull();
    // İzlenmemiş / puanlanmamış filmler havuza girmez
    expect(
      pickDuelPair([
        makeMovie({ id: 'a', watched: false, rating: 8 }),
        makeMovie({ id: 'b', rating: null }),
      ])
    ).toBeNull();
  });

  test('Mod 1 (target): hedefe en yakın puanlı film seçilir (±0.5 penceresi)', () => {
    const movies = [
      makeMovie({ id: 'target', rating: 9.0 }),
      makeMovie({ id: 'near', rating: 8.6 }),
      makeMovie({ id: 'far', rating: 7.9 }),
    ];
    const pair = pickDuelPair(movies, 'target');
    expect(pair).not.toBeNull();
    expect(pair!.mode).toBe('target');
    expect(pair!.a.id).toBe('target');
    expect(pair!.b.id).toBe('near'); // |9.0-8.6|=0.4 < |9.0-7.9|=1.1
  });

  test('Mod 1: hedef listede yoksa null döner', () => {
    const movies = [makeMovie({ id: 'a', rating: 8 }), makeMovie({ id: 'b', rating: 8.2 })];
    expect(pickDuelPair(movies, 'missing')).toBeNull();
  });

  test('Mod 2 (closest): puan farkı ≤0.5 olan ve en az düelloya girmiş ikili seçilir', () => {
    const movies = [
      makeMovie({ id: 'a', rating: 7.0, duelCount: 5 }),
      makeMovie({ id: 'b', rating: 7.3, duelCount: 5 }),
      makeMovie({ id: 'c', rating: 9.8, duelCount: 0 }),
      makeMovie({ id: 'd', rating: 9.9, duelCount: 0 }),
    ];
    const pair = pickDuelPair(movies);
    expect(pair).not.toBeNull();
    expect(pair!.mode).toBe('closest');
    // duelCount toplamı düşük olan (c,d) kazanmalı
    expect([pair!.a.id, pair!.b.id].sort()).toEqual(['c', 'd']);
  });

  test('Mod 2: ±0.5 fark aşılan ikili seçilmez (fallback yok → null)', () => {
    const movies = [
      makeMovie({ id: 'a', rating: 7.0 }),
      makeMovie({ id: 'b', rating: 8.0 }), // fark 1.0 > 0.5
    ];
    expect(pickDuelPair(movies)).toBeNull();
  });

  test('opts.genres: sadece seçilen tür(lere) uyan filmler havuza girer', () => {
    const movies = [
      makeMovie({ id: 'sci', rating: 8.0, genres: ['Bilim Kurgu'] }),
      makeMovie({ id: 'sci2', rating: 8.2, genres: ['Bilim Kurgu'] }),
      makeMovie({ id: 'com', rating: 8.1, genres: ['Komedi'] }),
    ];
    const pair = pickDuelPair(movies, undefined, { genres: ['Bilim Kurgu'] });
    expect(pair).not.toBeNull();
    const ids = [pair!.a.id, pair!.b.id].sort();
    expect(ids).toEqual(['sci', 'sci2']);
  });

  test('terk edilmiş (abandoned) filmler havuza girmez', () => {
    const movies = [
      makeMovie({ id: 'dead', rating: 8, abandoned: true }),
      makeMovie({ id: 'a', rating: 8 }),
      makeMovie({ id: 'b', rating: 8.1 }),
    ];
    const pair = pickDuelPair(movies, 'dead');
    expect(pair).toBeNull(); // hedef havuzda değil
  });
});

describe('detectRatingAnomalies', () => {
  test('eşik: |rating - calibratedScore| >= 0.45 ve duelCount >= 4 ise anomali', () => {
    expect(ANOMALY_DELTA).toBe(0.45);
    expect(ANOMALY_MIN_DUELS).toBe(4);
    const movies = [
      makeMovie({ id: 'anomaly', rating: 7.0, calibratedScore: 8.0, duelCount: 4 }),
    ];
    const out = detectRatingAnomalies(movies);
    expect(out).toHaveLength(1);
    expect(out[0].movie.id).toBe('anomaly');
    expect(out[0].direction).toBe('raise'); // kalibre (8.0) > rating (7.0) → puanı yükselt
    expect(out[0].suggestion).toBe(8.0);
    expect(out[0].gap).toBe(1.0);
  });

  test('düşük duelCount (<4) anomali sayılmaz', () => {
    const movies = [makeMovie({ id: 'few', rating: 8.0, calibratedScore: 6.0, duelCount: 3 })];
    expect(detectRatingAnomalies(movies)).toHaveLength(0);
  });

  test('küçük sapma (0.30 < 0.45) anomali sayılmaz', () => {
    const movies = [makeMovie({ id: 'small', rating: 8.0, calibratedScore: 7.7, duelCount: 10 })];
    expect(detectRatingAnomalies(movies)).toHaveLength(0);
  });

  test('rating veya calibratedScore yoksa anomali yok; lower yönü çalışır', () => {
    const movies = [
      makeMovie({ id: 'no-rating', rating: null, calibratedScore: 8.0, duelCount: 9 }),
      makeMovie({ id: 'no-cal', rating: 8.0, duelCount: 9 }),
      makeMovie({ id: 'lower', rating: 7.0, calibratedScore: 6.0, duelCount: 5 }),
    ];
    const out = detectRatingAnomalies(movies);
    expect(out).toHaveLength(1);
    expect(out[0].movie.id).toBe('lower');
    expect(out[0].direction).toBe('lower'); // kalibre (6.0) < rating (7.0) → puanı düşür
    expect(out[0].suggestion).toBe(6.0);
  });
});

describe('beraberlik ve tekrar eşleşme koruması', () => {
  test('calculateEloTie: iki film de 5 ten büyükse her ikisine +0.1', () => {
    const { aNew, bNew, deltaA, deltaB } = calculateEloTie(8, 8);
    expect(deltaA).toBe(0.1);
    expect(deltaB).toBe(0.1);
    expect(aNew).toBe(8.1);
    expect(bNew).toBe(8.1);
  });

  test('calculateEloTie: iki film de 5 ten küçükse her ikisine -0.1 (kötü film puan kaybeder)', () => {
    const { aNew, bNew, deltaA, deltaB } = calculateEloTie(3, 3);
    expect(deltaA).toBe(-0.1);
    expect(deltaB).toBe(-0.1);
    expect(aNew).toBe(2.9);
    expect(bNew).toBe(2.9);
  });

  test('calculateEloTie: biri 5 ten büyük diğeri 5 ten küçük — her biri kendi puanına göre hareket eder', () => {
    const { aNew, bNew, deltaA, deltaB } = calculateEloTie(8, 3);
    expect(deltaA).toBe(0.1);
    expect(deltaB).toBe(-0.1);
    expect(aNew).toBe(8.1);
    expect(bNew).toBe(2.9);
  });

  test('calculateEloTie: puan tam 5 ise değişmez (delta 0)', () => {
    const { aNew, bNew, deltaA, deltaB } = calculateEloTie(5, 5);
    expect(deltaA).toBe(0);
    expect(deltaB).toBe(0);
    expect(aNew).toBe(5);
    expect(bNew).toBe(5);
  });

  test('calculateEloTie clamp alt: 1 puanlı iki kötü film eşleşirse her ikisi 1\'de kalır (0.9\'a inmez)', () => {
    const { aNew, bNew } = calculateEloTie(1, 1);
    expect(aNew).toBe(1);
    expect(bNew).toBe(1);
  });

  test('calculateEloTie clamp üst: 10 puanlı iki iyi film eşleşirse her ikisi 10\'da kalır', () => {
    const { aNew, bNew } = calculateEloTie(10, 10);
    expect(aNew).toBe(10);
    expect(bNew).toBe(10);
  });

  test('haveDueled iki yönlü kaydı da tanır', () => {
    const a = makeMovie({ id: 'a', duelOpponents: ['b'] });
    const b = makeMovie({ id: 'b' });
    const c = makeMovie({ id: 'c', duelOpponents: ['a'] });
    expect(haveDueled(a, b)).toBe(true);
    expect(haveDueled(c, a)).toBe(true);
    expect(haveDueled(b, c)).toBe(false);
  });

  test('pickDuelPair daha önce karşılaşmış çifti aday göstermez', () => {
    const movies = [
      makeMovie({ id: 'a', rating: 8.0, duelOpponents: ['b'] }),
      makeMovie({ id: 'b', rating: 8.1 }),
      makeMovie({ id: 'c', rating: 8.2 }),
    ];
    const pair = pickDuelPair(movies, undefined, { random: true });
    expect(pair).not.toBeNull();
    expect([pair!.a.id, pair!.b.id]).not.toEqual(['a', 'b']);
  });
});
