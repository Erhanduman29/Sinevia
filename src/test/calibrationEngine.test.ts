import { describe, test, expect } from 'vitest';
import {
  calculateEloDelta,
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

describe('calculateEloDelta (Kör Kalibrasyon Elo Motoru)', () => {
  test('eşit puanlarda simetrik delta: 8.00 vs 8.00 → 8.08 / 7.92', () => {
    const { winnerNew, loserNew, delta } = calculateEloDelta(8.00, 8.00);
    expect(delta).toBe(0.08); // K=0.16 * (1 - 0.5)
    expect(winnerNew).toBe(8.08);
    expect(loserNew).toBe(7.92);
  });

  test('Elo beklenti formülü doğru: E(8,8)=0.5, E(9,8)≈0.76', () => {
    expect(expectedWinProbability(8, 8)).toBeCloseTo(0.5, 10);
    expect(expectedWinProbability(9, 8)).toBeCloseTo(1 / (1 + Math.pow(10, -0.5)), 10);
    expect(ELO_K).toBe(0.16);
  });

  test('kazanan puanı yüksekse delta küçülür (adil sermaye)', () => {
    const fav = calculateEloDelta(9, 8);
    const even = calculateEloDelta(8, 8);
    expect(fav.delta).toBeLessThan(even.delta);
    expect(fav.delta).toBe(0.04); // 0.16 * (1 - 0.760...)
  });

  test('clamp: sonuçlar asla 1 ve 10 sınırlarını aşmaz', () => {
    const top = calculateEloDelta(9.95, 9.95);
    expect(top.winnerNew).toBeLessThanOrEqual(10);
    expect(top.winnerNew).toBe(10); // 9.95 + 0.08 → 10.03 → 10
    const bottom = calculateEloDelta(1.05, 1.05);
    expect(bottom.loserNew).toBeGreaterThanOrEqual(1);
    expect(bottom.loserNew).toBe(1); // 1.05 - 0.08 → 0.97 → 1
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

  test('Mod 2 (closest): puan farkı ≤0.6 olan ve en az düelloya girmiş ikili seçilir', () => {
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
