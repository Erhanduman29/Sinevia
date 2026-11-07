import { describe, expect, test } from 'vitest';
import { applyAchievements, rootReducer, type ExtendedAppData } from '../context/AppContext';
import { ACHIEVEMENT_DEFS } from '../lib/achievements';
import { roundHalfRating } from '../lib/rating';
import { REWATCH_COOLDOWN_MS, getRewatchCooldown } from '../lib/rewatch';
import type { Movie, WatchHistoryItem } from '../types';

const DAY = 24 * 60 * 60 * 1000;

function baseState(): ExtendedAppData {
  return {
    movies: [], series: [], removedSeriesTitles: [], collections: [],
    genres: [], reviewTags: [], history: [],
    achievements: ACHIEVEMENT_DEFS.map((def) => ({
      achievementId: def.id,
      current: 0,
      unlockedTiers: [],
      tierDates: {},
      lastNotifiedTier: null,
    })),
    criteria: [], xp: 0, level: 1, totalXp: 0, lastWatchDate: null,
    dailyStreak: 0, dailyStreakDate: null, showLockedNames: false,
    theme: 'default', altWatchTemplate: '', weeklyPlan: [], notificationsEnabled: false,
  } as unknown as ExtendedAppData;
}

function watch(id: string, movieId: string, watchedAt: number, isPastWatch = false): WatchHistoryItem {
  return {
    id,
    itemId: movieId,
    kind: 'movie',
    type: 'movie',
    title: `Film ${movieId}`,
    rating: 7,
    note: '',
    watchedAt: new Date(watchedAt).toISOString(),
    isPastWatch,
  } as WatchHistoryItem;
}

describe('Puan yuvarlama (en yakın 0,5)', () => {
  test.each([
    [9.8, 10],
    [9.1, 9],
    [9.4, 9.5],
    [5.56, 5.5],
    [5.75, 6],
    [0.2, 1],
    [12, 10],
  ])('%s → %s', (input, expected) => {
    expect(roundHalfRating(input)).toBe(expected);
  });

  test('tüm sonuçlar tam veya yarım puandır', () => {
    for (let i = 1; i <= 10; i += 0.07) {
      const value = roundHalfRating(i);
      expect(Number.isInteger(value * 2)).toBe(true);
    }
  });
});

describe('Tekrar izleme bekleme süresi', () => {
  const now = Date.UTC(2026, 10, 7, 12, 0, 0);

  test('1 ay dolmadan tekrar izlemeye izin vermez', () => {
    const history = [watch('h1', 'm1', now - 29 * DAY)];
    const c = getRewatchCooldown(history, 'm1', now);
    expect(c.canRewatch).toBe(false);
    expect(c.remainingMs).toBe(REWATCH_COOLDOWN_MS - 29 * DAY);
  });

  test('1 ay dolunca izin verir', () => {
    const history = [watch('h1', 'm1', now - 30 * DAY)];
    expect(getRewatchCooldown(history, 'm1', now).canRewatch).toBe(true);
  });

  test('en son normal izleme belirleyicidir', () => {
    const history = [
      watch('h1', 'm1', now - 90 * DAY),
      watch('h2', 'm1', now - 3 * DAY),
    ];
    expect(getRewatchCooldown(history, 'm1', now).canRewatch).toBe(false);
  });

  test('sadece önceden izlenen (past) kayıt varsa bekleme yoktur', () => {
    const history = [watch('h1', 'm1', now - DAY, true)];
    expect(getRewatchCooldown(history, 'm1', now).canRewatch).toBe(true);
  });

  test('tekrar izleme kayıtları bekleme başlangıcı sayılır', () => {
    const rewatch = { ...watch('h2', 'm1', now - 2 * DAY), isRewatch: true };
    const history = [watch('h1', 'm1', now - 40 * DAY), rewatch];
    expect(getRewatchCooldown(history, 'm1', now).canRewatch).toBe(false);
  });
});

describe('Tekrar izleme reducer davranışı', () => {
  const now = Date.UTC(2026, 10, 7, 12, 0, 0);
  const first = watch('h1', 'm1', now - 60 * DAY);

  function stateWithFirstWatch(): ExtendedAppData {
    const state = baseState();
    state.movies = [{
      id: 'm1', title: 'Film m1', watched: true, rating: 7,
      rewatchStartedAt: new Date(now - 90 * 60 * 1000).toISOString(),
      rewatchCount: 0,
    } as unknown as Movie];
    state.history = [first];
    return state;
  }

  test('yeni kayıt ekler, ilk izlemeyi korur, film puanını son izlemeye çeker', () => {
    const state = stateWithFirstWatch();
    const entry = {
      ...watch('h2', 'm1', now),
      isRewatch: true,
      rewatchOfId: 'h1',
      watchNumber: 2,
    } as WatchHistoryItem;

    const next = rootReducer(state, {
      type: 'WATCH_MOVIE',
      id: 'm1',
      rating: 9,
      note: 'ikinci izleme',
      watchedAt: new Date(now).toISOString(),
      actualRuntime: 100,
      isPastWatch: false,
      isRewatch: true,
      rewatchedFromPast: false,
      historyItem: entry,
    } as never);

    expect(next.history).toHaveLength(2);
    expect(next.history[0].isRewatch).toBe(true);
    expect(next.history[1]).toEqual(first);
    expect(next.history[1].rating).toBe(7);

    const movie = next.movies.find((m) => m.id === 'm1')!;
    expect(movie.rating).toBe(9);
    expect(movie.rewatchStartedAt).toBeNull();
    expect(movie.rewatchCount).toBe(1);
    expect(next.movies.find((m) => m.id === 'm1')!.originalRating).toBeUndefined();
  });

  test('START/CANCEL rewatch sayaç alanını yönetir', () => {
    const state = stateWithFirstWatch();
    const startedAt = new Date(now).toISOString();
    const started = rootReducer(state, { type: 'START_REWATCH_MOVIE', id: 'm1', startedAt } as never);
    expect(started.movies[0].rewatchStartedAt).toBe(startedAt);

    const cancelled = rootReducer(started, { type: 'CANCEL_REWATCH_MOVIE', id: 'm1' } as never);
    expect(cancelled.movies[0].rewatchStartedAt).toBeNull();
  });
});

describe('Tekrar İzleme Ustası başarımı', () => {
  test('tekrar izleme kayıtlarını sayar ve kademe açar', () => {
    const state = baseState();
    state.history = Array.from({ length: 3 }, (_, i) => ({
      ...watch(`h${i}`, 'm1', Date.now()),
      isRewatch: true,
    }));

    const next = applyAchievements(state);
    const prog = next.achievements.find((a) => a.achievementId === 'rewatch_master')!;
    expect(prog.current).toBe(3);
    expect(prog.unlockedTiers).toEqual(expect.arrayContaining(['bronze', 'silver']));
    expect(prog.unlockedTiers).not.toContain('gold');
  });
});
