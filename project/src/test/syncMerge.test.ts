import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import type { AppStateV3 } from '../types/appState';
import type { Collection, Movie, WatchHistoryItem } from '../types';
import { mergeForks } from '../lib/syncEngine';
import {
  applyTombstones,
  createTombstone,
  isTombstoned,
  itemTimestamp,
  mergeTombstones,
  pruneTombstones,
  MAX_TOMBSTONES,
  type DeletedItem,
} from '../lib/syncMerge';
import { setFeatureFlag } from '../lib/featureFlags';

// ============================================================================
// SYNC MERGE V2 — zaman damgası + mezar taşı (tombstone)
// ============================================================================

/** Node ortamında localStorage taklidi (featureFlags buradan okur). */
function installFakeStorage(): Map<string, string> {
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  };
  return store;
}

function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'm1',
    title: 'Film 1',
    genres: [],
    watched: true,
    rating: 7,
    note: '',
    watchedAt: '2026-01-01T00:00:00.000Z',
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Movie;
}

function makeHistory(overrides: Partial<WatchHistoryItem> = {}): WatchHistoryItem {
  return {
    id: 'h1',
    itemId: 'm1',
    kind: 'movie',
    title: 'Film 1',
    rating: 7,
    note: '',
    watchedAt: '2026-01-01T00:00:00.000Z',
    genres: [],
    ...overrides,
  } as WatchHistoryItem;
}

function makeState(overrides: Partial<AppStateV3> = {}): AppStateV3 {
  return {
    schemaVersion: 3,
    ownerAgentId: 'SNV-AAAA-BBBB',
    revision: 4,
    updatedAt: '2026-01-02T00:00:00.000Z',
    deviceId: 'dev-1',
    xpEvents: [],
    movies: [],
    series: [],
    collections: [],
    history: [],
    genres: [],
    removedSeriesTitles: [],
    criteria: [],
    showcase: [],
    achievements: [],
    quests: {
      activeQuestId: null,
      questAcceptedAt: null,
      questRejects: 0,
      questCooldownUntil: null,
      completedQuests: [],
      activeBadgeId: null,
      isPenaltyEnabled: false,
    },
    coins: 0,
    coinLedger: [],
    inventory: [],
    equipped: {},
    activeEffects: [],
    perks: [],
    dailyStreak: 0,
    dailyStreakDate: null,
    lastWatchDate: null,
    weeklyPlan: [],
    externalActions: [],
    tutorial: {
      welcomeDone: true,
      welcomeStep: 0,
      completed: [],
      pageVisited: [],
      modalSeen: [],
      academyStarted: false,
      academyStep: 0,
      academyDone: [],
      events: [],
      eventCounts: {},
    },
    academy: { started: false, step: 0, done: [] },
    settings: { theme: 'dark' },
    ...overrides,
  };
}

let store: Map<string, string>;

beforeEach(() => {
  store = installFakeStorage();
});

afterEach(() => {
  store.clear();
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe('itemTimestamp — son değişiklik zamanı', () => {
  test('updatedAt varsa en yüksek zaman kazanır', () => {
    const stamp = itemTimestamp({
      updatedAt: '2026-03-01T00:00:00.000Z',
      watchedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(stamp).toBe(Date.parse('2026-03-01T00:00:00.000Z'));
  });

  test('updatedAt yoksa editedAt / ratingChangedAt / watchedAt fallback çalışır', () => {
    expect(itemTimestamp({ editedAt: '2026-02-01T00:00:00.000Z' })).toBe(
      Date.parse('2026-02-01T00:00:00.000Z')
    );
    expect(itemTimestamp({ watchedAt: '2026-01-15T00:00:00.000Z' })).toBe(
      Date.parse('2026-01-15T00:00:00.000Z')
    );
  });

  test('zaman alanı yoksa 0 döner', () => {
    expect(itemTimestamp({ id: 'x' })).toBe(0);
    expect(itemTimestamp(null)).toBe(0);
  });
});

describe('mezar taşları (tombstone) — yardımcılar', () => {
  test('mergeTombstones aynı kayıtta en yeni silmeyi tutar', () => {
    const cloud: DeletedItem[] = [
      { id: 'm1', type: 'movie', deletedAt: '2026-01-01T00:00:00.000Z' },
    ];
    const local: DeletedItem[] = [
      { id: 'm1', type: 'movie', deletedAt: '2026-02-01T00:00:00.000Z' },
      { id: 's1', type: 'series', deletedAt: '2026-01-05T00:00:00.000Z' },
    ];
    const merged = mergeTombstones(cloud, local);
    expect(merged).toHaveLength(2);
    expect(merged.find((t) => t.id === 'm1')?.deletedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  test('pruneTombstones en yeni MAX_TOMBSTONES kaydı tutar', () => {
    const list: DeletedItem[] = Array.from({ length: MAX_TOMBSTONES + 5 }, (_, i) => ({
      id: `m${i}`,
      type: 'movie',
      deletedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    }));
    const pruned = pruneTombstones(list);
    expect(pruned).toHaveLength(MAX_TOMBSTONES);
    expect(pruned.some((t) => t.id === 'm0')).toBe(false);
    expect(pruned.some((t) => t.id === `m${MAX_TOMBSTONES + 4}`)).toBe(true);
  });

  test('createTombstone aynı kaydı çiftlemez, zamanı günceller', () => {
    const first = createTombstone(undefined, 'movie', 'm1', '2026-01-01T00:00:00.000Z');
    const second = createTombstone(first, 'movie', 'm1', '2026-02-01T00:00:00.000Z');
    expect(second).toHaveLength(1);
    expect(second[0].deletedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  test('isTombstoned: silme sonrası yeniden oluşturulan kayıt silinmiş sayılmaz', () => {
    const tombstones = createTombstone(undefined, 'movie', 'm1', '2026-01-10T00:00:00.000Z');
    // Silme anından önceki kayıt → silinmiş
    expect(isTombstoned('movie', 'm1', tombstones, Date.parse('2026-01-01T00:00:00.000Z'))).toBe(true);
    // Silme anından sonra yeniden eklendi → yaşıyor
    expect(isTombstoned('movie', 'm1', tombstones, Date.parse('2026-02-01T00:00:00.000Z'))).toBe(false);
    // Farklı tip eşleşmez
    expect(isTombstoned('series', 'm1', tombstones, 0)).toBe(false);
  });

  test('applyTombstones listeyi süzer', () => {
    const tombstones = createTombstone(undefined, 'movie', 'm2', '2026-01-10T00:00:00.000Z');
    const list = [makeMovie({ id: 'm1' }), makeMovie({ id: 'm2' })];
    expect(applyTombstones(list, 'movie', tombstones).map((m) => m.id)).toEqual(['m1']);
  });
});

describe('mergeForks — bayrak KAPALI (eski davranış korunur)', () => {
  test('mezar taşı uygulanmaz: silinen kayıt diğer taraftan geri gelir', () => {
    const local = makeState({
      movies: [],
      deletedItems: createTombstone(undefined, 'movie', 'm1', '2026-01-10T00:00:00.000Z'),
    });
    const cloud = makeState({ movies: [makeMovie({ id: 'm1' })] });

    const merged = mergeForks(local, cloud, '2026-01-11T00:00:00.000Z');
    expect(merged.movies.map((m) => m.id)).toEqual(['m1']);
  });

  test('aynı id\'de daha zengin kayıt kazanır (updatedAt yok sayılır)', () => {
    const local = makeState({
      movies: [
        makeMovie({
          id: 'm1',
          watched: false,
          rating: null,
          note: '',
          updatedAt: '2026-05-01T00:00:00.000Z',
        } as Partial<Movie>),
      ],
    });
    const cloud = makeState({
      movies: [makeMovie({ id: 'm1', watched: true, rating: 8 })],
    });

    const merged = mergeForks(local, cloud, '2026-05-02T00:00:00.000Z');
    // Bayrak kapalı: zenginlik (cloud: watched + rating) kazanır, updatedAt değil.
    expect(merged.movies[0].rating).toBe(8);
    expect(merged.movies[0].watched).toBe(true);
  });
});

describe('mergeForks — bayrak AÇIK (Merge V2)', () => {
  beforeEach(() => {
    setFeatureFlag('syncMergeV2', true);
  });

  test('daha yeni updatedAt kazanır (zenginlik değil)', () => {
    const local = makeState({
      movies: [
        makeMovie({
          id: 'm1',
          watched: true,
          rating: 9,
          updatedAt: '2026-05-01T00:00:00.000Z',
        }),
      ],
    });
    const cloud = makeState({
      movies: [
        makeMovie({
          id: 'm1',
          watched: true,
          rating: 6,
          updatedAt: '2026-04-01T00:00:00.000Z',
        }),
      ],
    });

    const merged = mergeForks(local, cloud, '2026-05-02T00:00:00.000Z');
    expect(merged.movies[0].rating).toBe(9);
  });

  test('bulut daha yeniyse bulut kazanır', () => {
    const local = makeState({
      movies: [makeMovie({ id: 'm1', rating: 9, updatedAt: '2026-03-01T00:00:00.000Z' })],
    });
    const cloud = makeState({
      movies: [makeMovie({ id: 'm1', rating: 6, updatedAt: '2026-04-01T00:00:00.000Z' })],
    });

    const merged = mergeForks(local, cloud, '2026-05-02T00:00:00.000Z');
    expect(merged.movies[0].rating).toBe(6);
  });

  test('zaman damgası yoksa zenginlik kuralına düşer', () => {
    const local = makeState({
      movies: [makeMovie({ id: 'm1', watched: false, rating: null } as Partial<Movie>)],
    });
    const cloud = makeState({
      movies: [makeMovie({ id: 'm1', watched: true, rating: 8 })],
    });

    const merged = mergeForks(local, cloud, '2026-05-02T00:00:00.000Z');
    expect(merged.movies[0].rating).toBe(8);
  });

  test('silinen film diğer cihazın eski kopyasından geri gelmez', () => {
    const local = makeState({
      movies: [],
      deletedItems: createTombstone(undefined, 'movie', 'm1', '2026-01-10T00:00:00.000Z'),
    });
    const cloud = makeState({ movies: [makeMovie({ id: 'm1' })] });

    const merged = mergeForks(local, cloud, '2026-01-11T00:00:00.000Z');
    expect(merged.movies).toHaveLength(0);
    expect(merged.deletedItems?.some((t) => t.id === 'm1')).toBe(true);
  });

  test('silindikten sonra yeniden eklenen film yaşar', () => {
    const local = makeState({
      movies: [makeMovie({ id: 'm1', updatedAt: '2026-02-01T00:00:00.000Z' })],
      deletedItems: createTombstone(undefined, 'movie', 'm1', '2026-01-10T00:00:00.000Z'),
    });
    const cloud = makeState({ movies: [] });

    const merged = mergeForks(local, cloud, '2026-02-02T00:00:00.000Z');
    expect(merged.movies.map((m) => m.id)).toEqual(['m1']);
  });

  test('silinen dizi geri gelmez', () => {
    const local = makeState({
      series: [],
      deletedItems: createTombstone(undefined, 'series', 's1', '2026-01-10T00:00:00.000Z'),
    });
    const cloud = makeState({
      series: [{ id: 's1', title: 'Dizi', genres: [], episodes: [] } as never],
    });

    const merged = mergeForks(local, cloud, '2026-01-11T00:00:00.000Z');
    expect(merged.series).toHaveLength(0);
  });

  test('silinen koleksiyon geri gelmez', () => {
    const local = makeState({
      collections: [],
      deletedItems: createTombstone(undefined, 'collection', 'c1', '2026-01-10T00:00:00.000Z'),
    });
    const cloud = makeState({
      collections: [{ id: 'c1', name: 'Koleksiyon' } as Collection],
    });

    const merged = mergeForks(local, cloud, '2026-01-11T00:00:00.000Z');
    expect(merged.collections).toHaveLength(0);
  });

  test('geçmiş kayıtları birleşir; silinen kayıt geri gelmez', () => {
    const local = makeState({
      history: [makeHistory({ id: 'h2', watchedAt: '2026-01-02T00:00:00.000Z' })],
      deletedItems: createTombstone(undefined, 'history', 'h1', '2026-01-10T00:00:00.000Z'),
    });
    const cloud = makeState({
      history: [
        makeHistory({ id: 'h1', watchedAt: '2026-01-01T00:00:00.000Z' }),
        makeHistory({ id: 'h3', watchedAt: '2026-01-03T00:00:00.000Z' }),
      ],
    });

    const merged = mergeForks(local, cloud, '2026-01-11T00:00:00.000Z');
    expect(merged.history.map((h) => h.id).sort()).toEqual(['h2', 'h3']);
  });

  test('iki tarafın mezar taşları birleşir ve budanır', () => {
    const local = makeState({
      deletedItems: createTombstone(undefined, 'movie', 'm1', '2026-01-10T00:00:00.000Z'),
    });
    const cloud = makeState({
      deletedItems: createTombstone(undefined, 'series', 's1', '2026-01-05T00:00:00.000Z'),
    });

    const merged = mergeForks(local, cloud, '2026-01-11T00:00:00.000Z');
    expect(merged.deletedItems).toHaveLength(2);
    expect(merged.deletedItems?.map((t) => `${t.type}:${t.id}`).sort()).toEqual([
      'movie:m1',
      'series:s1',
    ]);
  });

  test('bayrak açıkken eklemeli veriler korunur (XP defteri birleşir)', () => {
    const local = makeState({
      xpEvents: [
        {
          id: 'e1',
          source: 'achievement',
          sourceId: 'ach:first_watch:bronze',
          label: 'x',
          base: 10,
          multiplier: 1,
          amount: 10,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const cloud = makeState({
      xpEvents: [
        {
          id: 'e2',
          source: 'quest',
          sourceId: 'quest:daily',
          label: 'y',
          base: 20,
          multiplier: 1,
          amount: 20,
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    });

    const merged = mergeForks(local, cloud, '2026-01-11T00:00:00.000Z');
    expect(merged.xpEvents.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
  });
});
