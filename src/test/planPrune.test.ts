import { describe, expect, test } from 'vitest';
import type { Movie, WeeklyPlanItem } from '../types';
import {
  hasExpiredPlanItems,
  isPlanItemExpired,
  planItemExpiryDate,
  pruneExpiredPlanItems,
} from '../lib/planPrune';

function makePlan(overrides: Partial<WeeklyPlanItem> = {}): WeeklyPlanItem {
  return {
    id: 'plan-1',
    movieId: 'movie-1',
    title: 'Test Filmi',
    genres: ['Dram'],
    date: '2026-10-20',
    time: '20:00',
    createdAt: '2026-10-18T10:00:00.000Z',
    ...overrides,
  };
}

function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'movie-1',
    title: 'Test Filmi',
    watched: false,
    genres: ['Dram'],
    addedAt: '2026-10-18',
    rating: null,
    ...overrides,
  } as Movie;
}

describe('Haftalık plan otomatik temizliği', () => {
  test('planlanan tarih + 2 gün hesaplanır', () => {
    expect(planItemExpiryDate(makePlan())).toBe('2026-10-22');
  });

  test('planlanan gün ve sonraki 2 gün planda kalır', () => {
    const item = makePlan();
    const movies = [makeMovie()];
    expect(isPlanItemExpired(item, movies, '2026-10-20')).toBe(false);
    expect(isPlanItemExpired(item, movies, '2026-10-21')).toBe(false);
    expect(isPlanItemExpired(item, movies, '2026-10-22')).toBe(false);
  });

  test('2 gün dolduktan sonra izlenmemiş film plandan silinir', () => {
    const movies = [makeMovie()];
    expect(isPlanItemExpired(makePlan(), movies, '2026-10-23')).toBe(true);
    expect(pruneExpiredPlanItems([makePlan()], movies, '2026-10-23')).toHaveLength(0);
  });

  test('izlenmiş film süresi dolsa bile planda kalır', () => {
    const movies = [makeMovie({ watched: true })];
    expect(isPlanItemExpired(makePlan(), movies, '2026-12-31')).toBe(false);
    expect(pruneExpiredPlanItems([makePlan()], movies, '2026-12-31')).toHaveLength(1);
  });

  test('film kaydı yoksa süresi dolunca sahipsiz plan temizlenir', () => {
    expect(isPlanItemExpired(makePlan(), [], '2026-10-22')).toBe(false);
    expect(isPlanItemExpired(makePlan(), [], '2026-10-23')).toBe(true);
  });

  test('yeniden planlanan tarih sayacı sıfırlar', () => {
    // 20 Ekim'den 22 Ekim'e taşındı → yeni bitiş 24 Ekim.
    const rescheduled = makePlan({ date: '2026-10-22' });
    const movies = [makeMovie()];
    expect(isPlanItemExpired(rescheduled, movies, '2026-10-23')).toBe(false);
    expect(pruneExpiredPlanItems([rescheduled], movies, '2026-10-23')).toHaveLength(1);
  });

  test('geçersiz tarih temkinli şekilde korunur', () => {
    const invalid = makePlan({ date: 'bozuk-tarih' });
    const movies = [makeMovie()];
    expect(planItemExpiryDate(invalid)).toBeNull();
    expect(isPlanItemExpired(invalid, movies, '2030-01-01')).toBe(false);
    expect(pruneExpiredPlanItems([invalid], movies, '2030-01-01')).toHaveLength(1);
  });

  test('değişiklik yoksa aynı dizi referansı korunur', () => {
    const plan = [makePlan()];
    const movies = [makeMovie()];
    expect(pruneExpiredPlanItems(plan, movies, '2026-10-22')).toBe(plan);
    expect(pruneExpiredPlanItems(plan, movies, '2026-10-23')).not.toBe(plan);
  });

  test('hasExpiredPlanItems doğru raporlar', () => {
    const plan = [makePlan()];
    const movies = [makeMovie()];
    expect(hasExpiredPlanItems(plan, movies, '2026-10-22')).toBe(false);
    expect(hasExpiredPlanItems(plan, movies, '2026-10-23')).toBe(true);
  });
});
