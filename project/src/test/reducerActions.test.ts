import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { rootReducer, resolveTMDBGenres, PAST_WATCH_COLLECTION_NAME } from '../context/AppContext';
import { migrateLegacyToV3, toLegacyCoreView } from '../lib/localStateV3';
import { ACHIEVEMENT_DEFS } from '../lib/achievements';
import { levelFromXp } from '../lib/xp';
import { makeXpEvent, sumXpEvents } from '../lib/xpLedger';
import { todayStr } from '../lib/utils';
import type { ExtendedAppData } from '../context/AppContext';

// ============================================================================
// CONTEXT REDUCER — Dizi, koleksiyon, kriter, toast, kimlik ve senkron aksiyonları
// ============================================================================

const QUEST_STORAGE_KEY = 'sinevia-quests-v1';
const storageMap = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => storageMap.get(k) ?? null,
  setItem: (k: string, v: string) => void storageMap.set(k, v),
  removeItem: (k: string) => void storageMap.delete(k),
  clear: () => storageMap.clear(),
  key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
  get length() {
    return storageMap.size;
  },
};

function getInitialState(): ExtendedAppData {
  return {
    movies: [], series: [], removedSeriesTitles: [], collections: [],
    genres: ['Aksiyon', 'Komedi', 'Dram'], reviewTags: [], history: [], achievements: [],
    criteria: [], xp: 0, level: 1, totalXp: 0, lastWatchDate: null, tagSentiments: {},
    dailyStreak: 0, dailyStreakDate: null, showLockedNames: false,
    theme: 'default', altWatchTemplate: '', weeklyPlan: [], notificationsEnabled: false,
  };
}

// Test boyunca senkron/XP aksiyonları localStorage'a dokunabiliyor (quest XP hesabı):
// node ortamında localStorage olmadığı için sahte bir depo takıyoruz.
beforeEach(() => {
  storageMap.clear();
  vi.stubGlobal('localStorage', fakeStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** V2 biçimli bulut çekirdeğini kanonik V3 üzerinden redüktör görünümüne çevirir. */
function buildCloudCore(core: any, quests: any, cloudTime: number): ExtendedAppData {
  const state = migrateLegacyToV3({
    core,
    quests,
    updatedAt: new Date(cloudTime).toISOString(),
    cloudTotalXp: Number(core?.totalXp ?? 0),
  });
  const view = toLegacyCoreView(state) as unknown as ExtendedAppData & { pendingToasts?: unknown };
  // Kanonik görünüm defteri (`xpEvents`) aynen taşır; redüktör XP'yi ondan türetir.
  view.pendingToasts = [];
  return view as unknown as ExtendedAppData;
}

describe('REDUCER — DİZİ (SERIES) EYLEMLERİ', () => {
  test('ADD_SERIES: bilinmeyen türleri kütüphaneye ekler, mevcut türü kopyalamaz', () => {
    let state = getInitialState();
    state = rootReducer(state, {
      type: 'ADD_SERIES',
      series: { id: 's1', title: 'Deneme Dizi', genres: ['Aksiyon', 'Bilim Kurgu'], episodes: [] } as any,
    } as any);

    expect(state.series).toHaveLength(1);
    expect(state.genres).toContain('Bilim Kurgu');
    expect(state.genres.filter((g) => g === 'Aksiyon')).toHaveLength(1); // kopya yok
    expect(state.genres.filter((g) => g === 'Bilim Kurgu')).toHaveLength(1);
  });

  test('ADD_EPISODES + DELETE_EPISODE: bölüm ekleme ve silme', () => {
    let state = getInitialState();
    state = rootReducer(state, {
      type: 'ADD_SERIES',
      series: { id: 's1', title: 'Dizi', genres: ['Dram'], episodes: [] } as any,
    } as any);

    state = rootReducer(state, {
      type: 'ADD_EPISODES',
      seriesId: 's1',
      episodes: [
        { id: 'e1', season: 1, episode: 1, watched: false } as any,
        { id: 'e2', season: 1, episode: 2, watched: false } as any,
      ],
    } as any);
    expect(state.series[0].episodes).toHaveLength(2);

    state = rootReducer(state, { type: 'DELETE_EPISODE', seriesId: 's1', episodeId: 'e1' } as any);
    expect(state.series[0].episodes).toHaveLength(1);
    expect(state.series[0].episodes[0].id).toBe('e2');
  });

  test('WATCH_EPISODE: bölüm izlenir, geçmişe kaydedilir ve tarih damgaları bugüne çekilir', () => {
    let state = getInitialState();
    state = rootReducer(state, {
      type: 'ADD_SERIES',
      series: { id: 's1', title: 'Dizi', genres: ['Dram'], episodes: [{ id: 'e1', season: 1, episode: 1, watched: false }] } as any,
    } as any);

    state = rootReducer(state, {
      type: 'WATCH_EPISODE',
      seriesId: 's1',
      episodeId: 'e1',
      rating: 9,
      note: 'Harikaydi',
      watchedAt: '2026-10-04T21:00:00',
      historyItem: { id: 'h1', itemId: 'e1', kind: 'series', rating: 9 } as any,
    } as any);

    expect(state.series[0].episodes[0].watched).toBe(true);
    expect(state.series[0].episodes[0].rating).toBe(9);
    expect(state.history).toHaveLength(1);
    expect(state.history[0].id).toBe('h1');
    expect(state.dailyStreakDate).toBe(todayStr());
    expect(state.lastWatchDate).toBe(todayStr());
  });

  test('UNWATCH_EPISODE: izleme geri alınca bölüm sıfırlanır ve geçmişteki kaydı silinir', () => {
    let state = getInitialState();
    state = rootReducer(state, {
      type: 'ADD_SERIES',
      series: { id: 's1', title: 'Dizi', genres: ['Dram'], episodes: [{ id: 'e1', season: 1, episode: 1, watched: true, rating: 9, note: 'x' }] } as any,
    } as any);
    state.history = [{ id: 'h1', itemId: 'e1', kind: 'series' } as any];

    state = rootReducer(state, { type: 'UNWATCH_EPISODE', seriesId: 's1', episodeId: 'e1' } as any);

    const ep = state.series[0].episodes[0];
    expect(ep.watched).toBe(false);
    expect(ep.rating).toBeNull();
    expect(ep.note).toBe('');
    expect(ep.watchedAt).toBeNull();
    expect(state.history).toHaveLength(0);
  });

  test('DELETE_SERIES: dizi tamamen listeden kalkmalı', () => {
    let state = getInitialState();
    state.series = [{ id: 's1', title: 'Dizi', genres: [], episodes: [] } as any];

    state = rootReducer(state, { type: 'DELETE_SERIES', id: 's1' } as any);
    expect(state.series).toHaveLength(0);
  });
});

describe('REDUCER — DİZİ TOPLU PUANLAMA', () => {
  function bulkHistory(overrides: Record<string, unknown> = {}) {
    return {
      id: 'bh1',
      itemId: 's1',
      seriesId: 's1',
      kind: 'series',
      type: 'series',
      title: 'Dizi',
      rating: 8,
      note: '',
      watchedAt: '2026-10-04T21:00:00',
      genres: ['Dram'],
      ratingScope: 'season',
      season: 1,
      bulkRating: true,
      bulkRuntimeMinutes: 42,
      ...overrides,
    } as any;
  }

  function baseSeries() {
    return {
      id: 's1',
      title: 'Dizi',
      genres: ['Dram'],
      episodes: [
        { id: 'e1', season: 1, episode: 1, watched: false, rating: null },
        { id: 'e2', season: 1, episode: 2, watched: false, rating: null },
        { id: 'e3', season: 2, episode: 1, watched: false, rating: null },
      ],
    } as any;
  }

  test('sezon puanı not, detay puanı ve inceleme etiketleriyle kaydedilir', () => {
    let state = getInitialState();
    state.series = [baseSeries()];

    state = rootReducer(state, {
      type: 'RATE_SERIES_BULK',
      seriesId: 's1',
      scope: 'season',
      season: 1,
      rating: 9,
      note: 'Harika sezon',
      detailedRating: { Oyunculuk: 9 },
      reviewTags: ['Sürükleyici'],
      watchedAt: '2026-10-04T21:00:00',
      historyItems: [bulkHistory({ rating: 9, note: 'Harika sezon', detailedRating: { Oyunculuk: 9 }, reviewTags: ['Sürükleyici'] })],
      bulkRuntimeMinutes: 42,
    } as any);

    const season = state.series[0].seasonRatings?.[1];
    expect(season?.rating).toBe(9);
    expect(season?.note).toBe('Harika sezon');
    expect(season?.detailedRating).toEqual({ Oyunculuk: 9 });
    expect(season?.reviewTags).toEqual(['Sürükleyici']);
    expect(state.history).toHaveLength(1);
    expect(state.history[0].bulkRating).toBe(true);
  });

  test('sezon varken genel puan verilemez; sezon kaldırılınca genel puan verilebilir', () => {
    let state = getInitialState();
    state.series = [baseSeries()];

    state = rootReducer(state, {
      type: 'RATE_SERIES_BULK',
      seriesId: 's1',
      scope: 'season',
      season: 1,
      rating: 8,
      note: '',
      watchedAt: '2026-10-04T21:00:00',
      historyItems: [bulkHistory()],
      bulkRuntimeMinutes: 42,
    } as any);
    expect(state.series[0].seasonRatings?.[1]?.rating).toBe(8);

    state = rootReducer(state, {
      type: 'RATE_SERIES_BULK',
      seriesId: 's1',
      scope: 'series',
      rating: 7,
      note: '',
      watchedAt: '2026-10-04T21:00:00',
      historyItems: [bulkHistory({ id: 'bh2', ratingScope: 'series', season: undefined })],
      bulkRuntimeMinutes: 42,
    } as any);
    expect(state.series[0].overallRating).toBeUndefined();
    expect(state.history).toHaveLength(1);

    state = rootReducer(state, { type: 'CLEAR_SERIES_RATINGS', seriesId: 's1', scope: 'season', season: 1 } as any);
    state = rootReducer(state, {
      type: 'RATE_SERIES_BULK',
      seriesId: 's1',
      scope: 'series',
      rating: 7,
      note: 'Genel',
      detailedRating: { Hikaye: 7 },
      reviewTags: ['Dengeli'],
      watchedAt: '2026-10-04T21:00:00',
      historyItems: [bulkHistory({ id: 'bh2', ratingScope: 'series', season: undefined, rating: 7, note: 'Genel', detailedRating: { Hikaye: 7 }, reviewTags: ['Dengeli'] })],
      bulkRuntimeMinutes: 42,
    } as any);

    expect(state.series[0].overallRating).toBe(7);
    expect(state.series[0].overallNote).toBe('Genel');
    expect(state.series[0].overallDetailedRating).toEqual({ Hikaye: 7 });
    expect(state.series[0].overallReviewTags).toEqual(['Dengeli']);
    expect(state.history).toHaveLength(1);
  });

  test('genel puan varken sezon puanı verilemez', () => {
    let state = getInitialState();
    state.series = [baseSeries()];

    state = rootReducer(state, {
      type: 'RATE_SERIES_BULK',
      seriesId: 's1',
      scope: 'series',
      rating: 8,
      note: '',
      watchedAt: '2026-10-04T21:00:00',
      historyItems: [bulkHistory({ ratingScope: 'series', season: undefined })],
      bulkRuntimeMinutes: 42,
    } as any);
    expect(state.series[0].overallRating).toBe(8);

    state = rootReducer(state, {
      type: 'RATE_SERIES_BULK',
      seriesId: 's1',
      scope: 'season',
      season: 1,
      rating: 9,
      note: '',
      watchedAt: '2026-10-04T21:00:00',
      historyItems: [bulkHistory({ id: 'bh2', rating: 9 })],
      bulkRuntimeMinutes: 42,
    } as any);

    expect(state.series[0].seasonRatings?.[1]).toBeUndefined();
    expect(state.history).toHaveLength(1);
  });

  test('bölüm puanı varken genel puan verilemez', () => {
    let state = getInitialState();
    const series = baseSeries();
    series.episodes[0].rating = 9;
    state.series = [series];

    state = rootReducer(state, {
      type: 'RATE_SERIES_BULK',
      seriesId: 's1',
      scope: 'series',
      rating: 8,
      note: '',
      watchedAt: '2026-10-04T21:00:00',
      historyItems: [bulkHistory({ ratingScope: 'series', season: undefined })],
      bulkRuntimeMinutes: 42,
    } as any);

    expect(state.series[0].overallRating).toBeUndefined();
    expect(state.history).toHaveLength(0);
  });

  test('aynı kapsam yeniden puanlanınca eski toptan geçmiş kaydı çoğalmaz', () => {
    let state = getInitialState();
    state.series = [baseSeries()];

    state = rootReducer(state, {
      type: 'RATE_SERIES_BULK',
      seriesId: 's1',
      scope: 'season',
      season: 1,
      rating: 8,
      note: 'İlk',
      watchedAt: '2026-10-04T21:00:00',
      historyItems: [bulkHistory({ id: 'bh1', rating: 8, note: 'İlk' })],
      bulkRuntimeMinutes: 42,
    } as any);
    state = rootReducer(state, {
      type: 'RATE_SERIES_BULK',
      seriesId: 's1',
      scope: 'season',
      season: 1,
      rating: 9,
      note: 'İkinci',
      watchedAt: '2026-10-04T22:00:00',
      historyItems: [bulkHistory({ id: 'bh2', rating: 9, note: 'İkinci', watchedAt: '2026-10-04T22:00:00' })],
      bulkRuntimeMinutes: 42,
    } as any);

    expect(state.series[0].seasonRatings?.[1]?.rating).toBe(9);
    expect(state.history).toHaveLength(1);
    expect(state.history[0].id).toBe('bh2');
  });

  test('bölüm puanları temizlenirken izlenme durumu ve geçmiş kaydı korunur', () => {
    let state = getInitialState();
    const series = baseSeries();
    series.episodes[0] = {
      ...series.episodes[0],
      watched: true,
      watchedAt: '2026-10-01T20:00:00',
      rating: 9,
      note: 'Bölüm notu',
      detailedRating: { Hikaye: 9 },
      reviewTags: ['Etkileyici'],
    };
    state.series = [series];
    state.history = [{
      id: 'eh1',
      itemId: 'e1',
      seriesId: 's1',
      kind: 'series',
      type: 'series',
      title: 'Dizi',
      rating: 9,
      note: 'Bölüm notu',
      detailedRating: { Hikaye: 9 },
      reviewTags: ['Etkileyici'],
      watchedAt: '2026-10-01T20:00:00',
      genres: ['Dram'],
      season: 1,
      episode: 1,
    } as any];

    state = rootReducer(state, { type: 'CLEAR_SERIES_EPISODE_RATINGS', seriesId: 's1' } as any);

    const episode = state.series[0].episodes[0];
    expect(episode.watched).toBe(true);
    expect(episode.watchedAt).toBe('2026-10-01T20:00:00');
    expect(episode.rating).toBeNull();
    expect(episode.note).toBe('');
    expect(state.history).toHaveLength(1);
    expect(state.history[0].rating).toBeNull();
    expect(state.history[0].watchedAt).toBe('2026-10-01T20:00:00');
  });

  test('geçmişten genel toptan puan düzenlenince dizi alanları da güncellenir', () => {
    let state = getInitialState();
    state.series = [baseSeries()];
    state = rootReducer(state, {
      type: 'RATE_SERIES_BULK',
      seriesId: 's1',
      scope: 'series',
      rating: 8,
      note: 'İlk',
      watchedAt: '2026-10-04T21:00:00',
      historyItems: [bulkHistory({ id: 'bh1', ratingScope: 'series', season: undefined, rating: 8, note: 'İlk' })],
      bulkRuntimeMinutes: 42,
    } as any);

    state = rootReducer(state, {
      type: 'UPDATE_HISTORY_RATING',
      historyId: 'bh1',
      rating: 9,
      note: 'Güncel',
      detailedRating: { Hikaye: 10 },
      reviewTags: ['Efsane'],
    } as any);

    expect(state.series[0].overallRating).toBe(9);
    expect(state.series[0].overallNote).toBe('Güncel');
    expect(state.series[0].overallDetailedRating).toEqual({ Hikaye: 10 });
    expect(state.series[0].overallReviewTags).toEqual(['Efsane']);
  });
});

describe('REDUCER — KOLEKSİYON EYLEMLERİ', () => {
  test('ADD_COLLECTION + RENAME_COLLECTION', () => {
    let state = getInitialState();
    state = rootReducer(state, { type: 'ADD_COLLECTION', collection: { id: 'c1', name: 'Bilim Kurgu' } as any } as any);
    expect(state.collections).toHaveLength(1);

    state = rootReducer(state, { type: 'RENAME_COLLECTION', id: 'c1', name: 'Klasikler' } as any);
    expect(state.collections[0].name).toBe('Klasikler');
    expect(state.collections.map((c) => c.name)).not.toContain('Bilim Kurgu');
  });

  test('DELETE_COLLECTION: koleksiyon silinince içindeki filmlerin bağı kopmalı', () => {
    let state = getInitialState();
    state.collections = [{ id: 'c1', name: 'Koleksiyon' } as any];
    state.movies = [
      { id: 'm1', title: 'Film 1', collectionId: 'c1' } as any,
      { id: 'm2', title: 'Film 2', collectionId: null } as any,
    ];

    state = rootReducer(state, { type: 'DELETE_COLLECTION', id: 'c1' } as any);
    expect(state.collections).toHaveLength(0);
    expect(state.movies[0].collectionId).toBeNull();
    expect(state.movies[1].collectionId).toBeNull();
  });

  test('SET_MOVIE_COLLECTION: filmi koleksiyona atamak ve çıkarmak', () => {
    let state = getInitialState();
    state.collections = [{ id: 'c1', name: 'Koleksiyon' } as any];
    state.movies = [{ id: 'm1', title: 'Film', collectionId: null } as any];

    state = rootReducer(state, { type: 'SET_MOVIE_COLLECTION', id: 'm1', collectionId: 'c1' } as any);
    expect(state.movies[0].collectionId).toBe('c1');

    state = rootReducer(state, { type: 'SET_MOVIE_COLLECTION', id: 'm1', collectionId: null } as any);
    expect(state.movies[0].collectionId).toBeNull();
  });

  test('SET_MOVIE_PAST_QUEUE: film "eski izleme sırası" kuyruğuna alınabilmeli', () => {
    let state = getInitialState();
    state.movies = [{ id: 'm1', title: 'Film', inPastQueue: false } as any];

    state = rootReducer(state, { type: 'SET_MOVIE_PAST_QUEUE', id: 'm1', inPastQueue: true } as any);
    expect(state.movies[0].inPastQueue).toBe(true);

    state = rootReducer(state, { type: 'SET_MOVIE_PAST_QUEUE', id: 'm1', inPastQueue: false } as any);
    expect(state.movies[0].inPastQueue).toBe(false);
  });
});

describe('REDUCER — KRİTER & İNCELEME ETİKETİ EYLEMLERİ', () => {
  test('EDIT_CRITERION: kriter adı ve ağırlığı güncellenmeli', () => {
    let state = getInitialState();
    state.criteria = [{ id: 'c1', name: 'Oyunculuk', weight: 8, appliesTo: 'both', genres: [] } as any];

    state = rootReducer(state, {
      type: 'EDIT_CRITERION',
      id: 'c1',
      criterion: { id: 'c1', name: 'Müzik', weight: 5, appliesTo: 'both', genres: [] } as any,
    } as any);

    expect(state.criteria![0].name).toBe('Müzik');
    expect(state.criteria![0].weight).toBe(5);
    expect(state.criteria).toHaveLength(1);
  });

  test('ADD_REVIEW_TAG: aynı etiket farklı harfle tekrar eklenemez, duygu atanır', () => {
    let state = getInitialState();

    state = rootReducer(state, { type: 'ADD_REVIEW_TAG', tag: 'Efsane', sentiment: 'positive' } as any);
    expect(state.reviewTags).toContain('Efsane');
    expect(state.tagSentiments!['Efsane']).toBe('positive');

    // Büyük/küçük harf farkı ile tekrar eklenmeye çalışılıyor
    state = rootReducer(state, { type: 'ADD_REVIEW_TAG', tag: 'EFSA' + 'ANE' } as any);
    expect(state.reviewTags!.filter((t) => t.toLowerCase() === 'efsane')).toHaveLength(1);

    state = rootReducer(state, { type: 'DELETE_REVIEW_TAG', tag: 'Efsane' } as any);
    expect(state.reviewTags).not.toContain('Efsane');
  });
});

describe('REDUCER — FİLM DÜZENLEME & TÜR ÇÖZÜMLEME', () => {
  test('EDIT_MOVIE: başlık/yıl/süre güncellenir, yeni tür kütüphaneye eklenir', () => {
    let state = getInitialState();
    state.movies = [{ id: 'm1', title: 'Eski Ad', year: '1999', genres: ['Aksiyon'], runtime: 100 } as any];

    state = rootReducer(state, {
      type: 'EDIT_MOVIE',
      id: 'm1',
      title: 'Yeni Ad',
      year: '2024',
      genres: ['aksiyon', 'Bilim Kurgu'], // 'aksiyon' → mevcut 'Aksiyon' ile eşleşmeli
      runtime: 130,
    } as any);

    const movie = state.movies[0];
    expect(movie.title).toBe('Yeni Ad');
    expect(movie.year).toBe('2024');
    expect(movie.runtime).toBe(130);
    expect(movie.genres).toContain('Aksiyon');
    expect(movie.genres).toContain('Bilim Kurgu');
    expect(state.genres.filter((g) => g === 'Aksiyon')).toHaveLength(1);
    expect(state.genres).toContain('Bilim Kurgu');
  });

  test('resolveTMDBGenres: tam eşleşme, prefix eşleşme, bilinmeyen tür ve tekilleştirme', () => {
    const existing = ['Aksiyon', 'Bilim Kurgu'];

    expect(resolveTMDBGenres(['aksiyon'], existing)).toEqual(['Aksiyon']);
    expect(resolveTMDBGenres(['Bilim'], existing)).toEqual(['Bilim Kurgu']); // prefix
    expect(resolveTMDBGenres(['Korku'], existing)).toEqual(['Korku']); // bilinmeyen korunur
    expect(resolveTMDBGenres(['Aksiyon', 'aksiyon'], existing)).toEqual(['Aksiyon']); // tekilleştirme
  });
});

describe('REDUCER — PAYLAŞIM LİSTESİ BİRLEŞTİRME (MERGE_SHARED_LIST)', () => {
  test('yeni türler eklenir, mevcut türler kopyalanmaz, içerikler birleşir', () => {
    let state = getInitialState(); // genres: Aksiyon, Komedi, Dram

    state = rootReducer(state, {
      type: 'MERGE_SHARED_LIST',
      genres: ['Aksiyon', 'Komedi', 'Bilim Kurgu'],
      collections: [{ id: 'c1', name: 'Paylaşım' } as any],
      movies: [{ id: 'm1', title: 'Paylaşılan Film' } as any],
      series: [{ id: 's1', title: 'Paylaşılan Dizi' } as any],
    } as any);

    expect(state.genres).toEqual(['Aksiyon', 'Komedi', 'Dram', 'Bilim Kurgu']);
    expect(state.collections).toHaveLength(1);
    expect(state.movies).toHaveLength(1);
    expect(state.series).toHaveLength(1);
  });
});

describe('REDUCER — TOAST / XP / KİMLİK EYLEMLERİ', () => {
  test('CONSUME_NEXT_TOAST: kuyruğun ilkini tüketir ve XP kazancını pendingXpGain’e yazar', () => {
    const state = getInitialState();
    state.totalXp = 300;
    state.pendingToasts = [
      { achievementId: 'a1', tier: 'bronze', xp: 100, name: 'X', icon: 'Y', description: 'Z' } as any,
      { achievementId: 'a2', tier: 'silver', xp: 50, name: 'X', icon: 'Y', description: 'Z' } as any,
    ];

    const next = rootReducer(state, { type: 'CONSUME_NEXT_TOAST' } as any);
    expect(next.pendingToasts).toHaveLength(1);
    expect(next.pendingToasts![0].achievementId).toBe('a2');
    // Toplam 300 = 150 taban + kuyruktaki 100+50. İlk toast: 150 → 250
    // (eski beklenti 200→300 idi; 2. toast'ta 250→300 GİDEREK geriye sarkan
    //  hatalı adımlama üretiyordu).
    expect(next.pendingXpGain).toEqual({ gained: 100, oldTotal: 150, newTotal: 250, source: 'achievement', label: 'X' });
  });

  test('CONSUME_NEXT_TOAST: toplu başarım XP adımlaması 5 → 55 → 70 olmalı', () => {
    const state = getInitialState();
    state.totalXp = 70; // unlock anında 5+50+15 birden totalXp'ye yazıldı
    state.pendingToasts = [
      { achievementId: 'a1', tier: 'bronze', xp: 5, name: 'X', icon: 'Y', description: 'Z' } as any,
      { achievementId: 'a2', tier: 'gold', xp: 50, name: 'X', icon: 'Y', description: 'Z' } as any,
      { achievementId: 'a3', tier: 'silver', xp: 15, name: 'X', icon: 'Y', description: 'Z' } as any,
    ];

    const s1 = rootReducer(state, { type: 'CONSUME_NEXT_TOAST' } as any);
    expect(s1.pendingXpGain).toEqual({ gained: 5, oldTotal: 0, newTotal: 5, source: 'achievement', label: 'X' });
    expect(s1.pendingCoinGain).toEqual({ amount: 10, label: '3 başarım ödülü', final: false });
    const s2 = rootReducer(s1, { type: 'CONSUME_NEXT_TOAST' } as any);
    expect(s2.pendingXpGain).toEqual({ gained: 50, oldTotal: 5, newTotal: 55, source: 'achievement', label: 'X' });
    expect(s2.pendingCoinGain).toEqual({ amount: 60, label: '3 başarım ödülü', final: false });
    const s3 = rootReducer(s2, { type: 'CONSUME_NEXT_TOAST' } as any);
    expect(s3.pendingXpGain).toEqual({ gained: 15, oldTotal: 55, newTotal: 70, source: 'achievement', label: 'X' });
    expect(s3.pendingCoinGain).toEqual({ amount: 80, label: '3 başarım ödülü', final: true });
    expect(s3.pendingToasts).toHaveLength(0);
  });

  test('CONSUME_NEXT_TOAST: kuyruk boşsa state AYNEN geri dönmeli (yeni obje yok)', () => {
    const state = getInitialState();
    state.pendingToasts = [];
    expect(rootReducer(state, { type: 'CONSUME_NEXT_TOAST' } as any)).toBe(state);
  });

  test('CLEAR_LEVELUP + CLEAR_XP_GAIN: bekleyen bildirimler temizlenmeli', () => {
    const state = getInitialState();
    state.pendingLevelUp = { newLevel: 5 };
    state.pendingXpGain = { gained: 10, oldTotal: 0, newTotal: 10 };

    const noLevelUp = rootReducer(state, { type: 'CLEAR_LEVELUP' } as any);
    expect(noLevelUp.pendingLevelUp).toBeUndefined();
    expect(noLevelUp.pendingXpGain).toEqual({ gained: 10, oldTotal: 0, newTotal: 10 });

    const noXpGain = rootReducer(noLevelUp, { type: 'CLEAR_XP_GAIN' } as any);
    expect(noXpGain.pendingXpGain).toBeUndefined();
  });

  test('GRANT_XP: küçük XP toplamı artırır, seviye atlarsa pendingLevelUp dolar', () => {
    let state = getInitialState();

    const small = rootReducer(state, { type: 'GRANT_XP', xp: 100 } as any);
    expect(small.totalXp).toBe(100);
    expect(small.level).toBe(1);
    expect(small.pendingLevelUp).toBeUndefined();
    expect(small.pendingXpGain).toEqual({ gained: 100, oldTotal: 0, newTotal: 100, source: 'system', label: 'Sistem' });

    const big = rootReducer(small, { type: 'GRANT_XP', xp: 100000 } as any);
    expect(big.totalXp).toBe(100100);
    expect(big.level).toBe(levelFromXp(100100).level);
    expect(big.level).toBeGreaterThan(1);
    // Kuyruk semantiği: tetik İLK ara seviye, sonraki seviyeler kuyrukta sırayla.
    expect(big.pendingLevelUp?.newLevel).toBe(small.level + 1);
    const expectedQueue: number[] = [];
    for (let l = small.level + 2; l <= big.level; l++) expectedQueue.push(l);
    expect(big.pendingLevelUpQueue ?? []).toEqual(expectedQueue);
  });

  test('CONSUME_NEXT_TOAST: reveal edilen XP seviye atlattıysa her ara seviye kuyruğa girer', () => {
    const state = getInitialState();
    state.totalXp = 0;
    state.pendingToasts = [{ achievementId: 'a1', tier: 'Bronz', xp: 5000, name: 'n', icon: 'i', description: 'd' } as any];
    const next = rootReducer(state, { type: 'CONSUME_NEXT_TOAST' } as any);
    expect(next.pendingXpGain).toEqual({ gained: 5000, oldTotal: 0, newTotal: 5000, source: 'achievement', label: 'n' });
    // 5000 XP Level 2'yi açar → tetik 2, kalanları kuyrukta (varsa).
    expect(next.pendingLevelUp?.newLevel).toBe(2);
    const expected: number[] = [];
    for (let l = 3; l <= levelFromXp(5000).level; l++) expected.push(l);
    expect(next.pendingLevelUpQueue ?? []).toEqual(expected);
    expect(next.pendingToasts).toEqual([]);
  });

  test('PROMOTE_LEVEL_UP: kuyruktaki sıradaki seviye tetiğe geçer, tükenince noop', () => {
    // Gerçek akış: effect tetiği açılır açılmaz CLEAR_LEVELUP ile temizler →
    // dismiss'te PROMOTE sıradakini öne çıkarır → effect yeni tetiği yine temizler.
    const base = { ...getInitialState(), pendingLevelUpQueue: [3, 4] } as any;
    const p1 = rootReducer(base, { type: 'PROMOTE_LEVEL_UP' } as any);
    expect(p1.pendingLevelUp?.newLevel).toBe(3);
    expect(p1.pendingLevelUpQueue).toEqual([4]);
    const c1 = rootReducer(p1, { type: 'CLEAR_LEVELUP' } as any);
    expect(c1.pendingLevelUp).toBeUndefined();
    const p2 = rootReducer(c1, { type: 'PROMOTE_LEVEL_UP' } as any);
    expect(p2.pendingLevelUp?.newLevel).toBe(4);
    expect(p2.pendingLevelUpQueue).toBeUndefined();
    const p3 = rootReducer(p2, { type: 'PROMOTE_LEVEL_UP' } as any);
    expect(p3).toBe(p2);
    // Tetik hâlâ açıksa PROMOTE geçmez (kutlama atlanmaz).
    const gated = rootReducer(
      { ...getInitialState(), pendingLevelUp: { newLevel: 5 }, pendingLevelUpQueue: [6] } as any,
      { type: 'PROMOTE_LEVEL_UP' } as any
    );
    expect(gated.pendingLevelUp?.newLevel).toBe(5);
    expect(gated.pendingLevelUpQueue).toEqual([6]);
  });

  test('CLEAR_LEVELUP: tetiği temizler ama seviye kuyruğunu korur', () => {
    const base = { ...getInitialState(), pendingLevelUp: { newLevel: 2 }, pendingLevelUpQueue: [3] } as any;
    const cleared = rootReducer(base, { type: 'CLEAR_LEVELUP' } as any);
    expect(cleared.pendingLevelUp).toBeUndefined();
    expect(cleared.pendingLevelUpQueue).toEqual([3]);
  });

  test('FORCE_XP_SYNC: XP yalnız defterden türetilir; başarım/görev listesi kaynak DEĞİLDİR', () => {
    const state = getInitialState();
    state.totalXp = 999999; // defter yok (V2 artığı)
    state.achievements = [
      { achievementId: 'movie_add', current: 0, unlockedTiers: ['bronze', 'silver'], tierDates: {}, lastNotifiedTier: 'silver' } as any,
    ];
    storageMap.set(QUEST_STORAGE_KEY, JSON.stringify({ completedQuests: ['c_short_movie'] }));

    // Defter yoksa eski toplam tek seferlik `legacy` kaydı olur; listeler TARANMAZ.
    const legacyOnly = rootReducer(state, { type: 'FORCE_XP_SYNC' } as any);
    expect(legacyOnly.totalXp).toBe(999999);
    expect(legacyOnly.xpEvents).toHaveLength(1);
    expect(legacyOnly.xpEvents![0].source).toBe('legacy');

    // Defter varsa otorite odur: toplam defterden gelir (5 + 10 + 50).
    const withLedger = {
      ...getInitialState(),
      xpEvents: [
        makeXpEvent({ source: 'achievement', sourceId: 'ach:movie_add:bronze', base: 5 }),
        makeXpEvent({ source: 'achievement', sourceId: 'ach:movie_add:silver', base: 10 }),
        makeXpEvent({ source: 'quest', sourceId: 'quest:c_short_movie', base: 50 }),
      ],
    };
    const next = rootReducer(withLedger, { type: 'FORCE_XP_SYNC' } as any);
    expect(next.totalXp).toBe(15 + 50);
    expect(next.level).toBe(levelFromXp(65).level);
    expect(next.xp).toBe(levelFromXp(65).currentLevelXp);
  });

  test('RECOVER_IDENTITY: kimlik alanları aynen yazılmalı', () => {
    const state = getInitialState();
    const next = rootReducer(state, {
      type: 'RECOVER_IDENTITY', agentId: 'AGT-1', recoveryKey: 'KEY-1', nickname: 'GeriDonen',
    } as any);
    expect(next.agentId).toBe('AGT-1');
    expect(next.recoveryKey).toBe('KEY-1');
    expect(next.nickname).toBe('GeriDonen');
  });

  test('SET_SHOWCASE: vitrin en fazla 4 öğe içermeli', () => {
    const state = getInitialState();
    const items = Array.from({ length: 6 }, (_, i) => ({ id: `v${i}` }));
    const next = rootReducer(state, { type: 'SET_SHOWCASE', showcase: items } as any);
    expect(next.showcase).toHaveLength(4);
    expect(next.showcase![0].id).toBe('v0');
  });

  test('UPDATE_ALT_TEMPLATE / SET_NICKNAME / TOGGLE_SPECIFIC_NOTIFICATION', () => {
    let state = getInitialState();

    state = rootReducer(state, { type: 'UPDATE_ALT_TEMPLATE', template: 'https://ornek.com/{title}' } as any);
    expect(state.altWatchTemplate).toBe('https://ornek.com/{title}');

    state = rootReducer(state, { type: 'SET_NICKNAME', nickname: 'Sinemasever' } as any);
    expect(state.nickname).toBe('Sinemasever');

    state = rootReducer(state, { type: 'TOGGLE_SPECIFIC_NOTIFICATION', key: 'notifyMessages', enabled: false } as any);
    expect(state.notifyMessages).toBe(false);
  });

  test('SET_ACHIEVEMENT_PROGRESS: başarımlar tamamen değiştirilmeli', () => {
    const state = getInitialState();
    const progress = [{ achievementId: 'movie_add', current: 12, unlockedTiers: ['bronze'], tierDates: {}, lastNotifiedTier: 'bronze' } as any];
    const next = rootReducer(state, { type: 'SET_ACHIEVEMENT_PROGRESS', progress } as any);
    expect(next.achievements).toHaveLength(1);
    expect(next.achievements[0].current).toBe(12);
  });
});

describe('REDUCER — BULUT SENKRONU & İÇE AKTARMA', () => {
  test('IMPORT_DATA: yerel kimlik korunur, "Eskiden İzlenenler" koleksiyonu göç ettirilir', () => {
    let state = getInitialState();
    state = rootReducer(state, {
      type: 'RECOVER_IDENTITY', agentId: 'LOCAL-1', recoveryKey: 'LOCAL-KEY', nickname: 'YerelKullanici',
    } as any);

    const imported = {
      movies: [{ id: 'm1', title: 'Eski Film', watched: true, collectionId: 'past_col', inPastQueue: false } as any],
      collections: [{ id: 'past_col', name: PAST_WATCH_COLLECTION_NAME } as any],
      genres: ['Korku'],
    } as any;

    const next = rootReducer(state, { type: 'IMPORT_DATA', data: imported } as any);

    // Kimlik dışarıdan gelen veriyle BOZULMAMALI
    expect(next.agentId).toBe('LOCAL-1');
    expect(next.recoveryKey).toBe('LOCAL-KEY');
    expect(next.nickname).toBe('YerelKullanici');

    // Eski "koleksiyon" yapısı temizlenmeli, filmler geçmiş izlemeye taşınmalı
    expect(next.collections).toHaveLength(0);
    expect(next.movies[0].collectionId).toBeNull();
    expect(next.movies[0].isPastWatch).toBe(true);
    expect(next.genres).toContain('Korku');
    expect(next.achievements).toHaveLength(ACHIEVEMENT_DEFS.length);
  });
});

describe('BULUTTAN BİREBİR İNDİRME', () => {
  test('buildCloudCore buluttaki 1850 XP değerini başarımlardan yeniden hesaplayıp düşürmez', () => {
    const cloud = buildCloudCore({
      ...getInitialState(),
      totalXp: 1850,
      level: 20,
      movies: [{ id: 'm1', title: 'Bulut Filmi' }],
    } as any, {}, 123456);

    expect(cloud.totalXp).toBe(1850);
    expect(cloud.movies).toHaveLength(1);
    expect(cloud.movies[0].id).toBe('m1');
    // Bulut XP'si tek seferlik `legacy` kaydı olarak korunur (xpBaseline yok).
    expect(cloud.xpEvents).toHaveLength(1);
    expect(cloud.xpEvents![0].source).toBe('legacy');
    expect(cloud.xpEvents![0].amount).toBe(1850);
    expect(cloud.level).toBe(levelFromXp(1850).level);
  });

  test('REPLACE_FROM_CLOUD_STORAGE bulut verisini birebir uygular ve bekleyen kuyrukları temizler', () => {
    const local = {
      ...getInitialState(),
      totalXp: 95,
      level: 2,
      pendingToasts: [{ id: 'old-toast' }],
      pendingLevelUp: { level: 2 },
    } as any;
    const cloud = buildCloudCore({
      ...getInitialState(),
      totalXp: 1850,
      level: 20,
      movies: [{ id: 'cloud-movie', title: 'Bulut Filmi' }],
      achievements: [{ achievementId: 'movie_add', current: 1, unlockedTiers: ['bronze'], tierDates: {} }],
    } as any, { completedQuests: [] }, 123456);

    const next = rootReducer(local, { type: 'REPLACE_FROM_CLOUD_STORAGE', data: cloud, questData: { completedQuests: [] } } as any);

    expect(next.totalXp).toBe(1850);
    expect(next.level).toBe(levelFromXp(1850).level);
    expect(next.movies[0].id).toBe('cloud-movie');
    expect(next.pendingToasts).toEqual([]);
    expect(next.pendingLevelUp).toBeUndefined();
    expect(storageMap.get(QUEST_STORAGE_KEY)).toContain('completedQuests');
  });

  test('birebir indirmeden sonra defter korunur, yeni başarım kaydı üzerine eklenir', () => {
    let state = buildCloudCore({
      ...getInitialState(),
      totalXp: 1850,
      level: 20,
      achievements: [{ achievementId: 'movie_add', current: 1, unlockedTiers: ['bronze'], tierDates: {} }],
    } as any, { completedQuests: [] }, 123456);

    state = rootReducer(state, { type: 'FORCE_XP_SYNC' } as any);
    expect(state.totalXp).toBe(1850);

    // Yeni başarım kademesi deftere EKLENİR (liste taranmaz): 1850 + 5 = 1855.
    state = rootReducer(state, {
      type: 'GRANT_XP', xp: 5, source: 'achievement', sourceId: 'ach:series_add:bronze', label: 'Dizi Başlangıcı',
    } as any);
    expect(state.totalXp).toBe(1855);
    expect(sumXpEvents(state.xpEvents)).toBe(1855);
  });
});
