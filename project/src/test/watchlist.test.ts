import { describe, test, expect } from 'vitest';
import { rootReducer } from '../context/AppContext';
import { filterAndSortMovies, searchMatches } from '../lib/catalogLogic';
import { filterPickerCandidates } from '../lib/pickerLogic';
import type { ExtendedAppData } from '../context/AppContext';

// ============================================================================
// İZLEME LİSTESİ (WATCHLIST) AKIŞI
// Not: projede ayrı bir "watchlist" modülü yok; izleme listesi davranışları
// katalog filtresi (izlenmemişler) + kuyruk (inPastQueue) + haftalık plan
// aksiyonlarının birleşimiyle oluşur. Bu dosya o birleşimi doğrular.
// ============================================================================

function getInitialState(): ExtendedAppData {
  return {
    movies: [], series: [], removedSeriesTitles: [], collections: [],
    genres: [], reviewTags: [], history: [], achievements: [], criteria: [],
    xp: 0, level: 1, totalXp: 0, lastWatchDate: null, tagSentiments: {},
    dailyStreak: 0, dailyStreakDate: null, showLockedNames: false,
    theme: 'default', altWatchTemplate: '', weeklyPlan: [], notificationsEnabled: false,
  };
}

const BASE_MOVIES = [
  { id: 'm1', title: 'Dune', watched: true, rating: 9, genres: ['Bilim Kurgu'], addedAt: '2026-01-01', inPastQueue: false } as any,
  { id: 'm2', title: 'Interstellar', watched: false, rating: null, genres: ['Bilim Kurgu'], addedAt: '2026-01-02', inPastQueue: false } as any,
  { id: 'm3', title: 'Parasite', watched: false, rating: null, genres: ['Dram'], addedAt: '2026-01-03', inPastQueue: false } as any,
];

describe('İZLEME LİSTESİ — KATALOG FİLTRE DAVRANIŞI', () => {
  test('"izlenmemişler" filtresi izleme listesini oluşturmalı (izlenmişler hariç)', () => {
    const watchlist = filterAndSortMovies(BASE_MOVIES, 'unwatched', new Set(), '', 'az');
    expect(watchlist.map((m) => m.id)).toEqual(['m2', 'm3']); // A→Z sıralı
  });

  test('izleme listesi içinde arama ve tür filtresi birlikte çalışmalı', () => {
    const result = filterAndSortMovies(BASE_MOVIES, 'unwatched', new Set(['Bilim Kurgu']), 'dune', 'az');
    expect(result).toHaveLength(0); // Dune izlenmiş + arama başka film

    const sciFiQueue = filterAndSortMovies(BASE_MOVIES, 'unwatched', new Set(['Bilim Kurgu']), '', 'az');
    expect(sciFiQueue.map((m) => m.id)).toEqual(['m2']);
  });

  test('searchMatches: büyük/küçük harf duyarsız olmalı, ama normalize işlemi (TR karakter) YAPMAMALI', () => {
    expect(searchMatches('Yüzüklerin Efendisi', 'yüzüklerin')).toBe(true);
    expect(searchMatches('Yüzüklerin Efendisi', 'EFENDİSİ')).toBe(true); // İ → i
    expect(searchMatches('Dune', 'DUNE')).toBe(true);

    // Türkçe büyük "I" → noktalı "ı"’ya düşer; bu eşleşmez (normalize utils’in işi, bkz. utils.test.ts)
    expect(searchMatches('Yüzüklerin Efendisi', 'YÜZÜKLERIN')).toBe(false);

    expect(searchMatches('Dune', 'Interstellar')).toBe(false);
  });
});

describe('İZLEME LİSTESİ — REDUCER GEÇİŞLERİ (liste ↔ izlendi ↔ geçmiş)', () => {
  test('WATCH_MOVIE: film izlenince izleme listesinden çıkar, "izlendi" filtresine girer', () => {
    let state = getInitialState();
    state.movies = BASE_MOVIES.map((m) => ({ ...m }));

    state = rootReducer(state, {
      type: 'WATCH_MOVIE',
      id: 'm2',
      rating: 8,
      note: 'Guzeldi',
      watchedAt: '2026-10-04T20:00:00',
      historyItem: { id: 'h1', itemId: 'm2', kind: 'movie', rating: 8 } as any,
    } as any);

    expect(filterAndSortMovies(state.movies, 'unwatched', new Set(), '', 'az').map((m) => m.id)).toEqual(['m3']);
    expect(filterAndSortMovies(state.movies, 'watched', new Set(), '', 'az').map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  test('UNWATCH_MOVIE: vazgeçilen film izleme listesine (izlenmemişlere) GERİ döner', () => {
    let state = getInitialState();
    state.movies = BASE_MOVIES.map((m) => ({ ...m }));
    state.history = [{ id: 'h1', itemId: 'm1', kind: 'movie' } as any];

    state = rootReducer(state, { type: 'UNWATCH_MOVIE', id: 'm1' } as any);

    const watchlistIds = filterAndSortMovies(state.movies, 'unwatched', new Set(), '', 'az').map((m) => m.id);
    expect(watchlistIds).toContain('m1');
    expect(filterAndSortMovies(state.movies, 'watched', new Set(), '', 'az')).toHaveLength(0);
  });

  test('WATCH_MOVIE (geçmiş izleme): film "eski izlenenler" kuyruğuna düşer, güncel listeden çıkar', () => {
    let state = getInitialState();
    state.movies = BASE_MOVIES.map((m) => ({ ...m }));

    state = rootReducer(state, {
      type: 'WATCH_MOVIE',
      id: 'm3',
      rating: 7,
      note: '',
      watchedAt: '2010-01-01T20:00:00',
      isPastWatch: true,
      historyItem: { id: 'h9', itemId: 'm3', kind: 'movie', rating: 7, isPastWatch: true } as any,
    } as any);

    const currentQueue = filterAndSortMovies(state.movies, 'unwatched', new Set(), '', 'az').map((m) => m.id);
    expect(currentQueue).not.toContain('m3');
    expect(filterAndSortMovies(state.movies, 'past', new Set(), '', 'az').map((m) => m.id)).toEqual(['m3']);
  });

  test('izleme listesindeki filmler picker havuzuna girmeli; kuyruğa (inPastQueue) alınanlar elenmeli', () => {
    // 1) İzleme listesi = izlenmemişler
    const watchlist = filterAndSortMovies(BASE_MOVIES, 'unwatched', new Set(), '', 'az');
    const pool = filterPickerCandidates(watchlist, [], 'all', null, 'any');
    expect(pool.map((p) => (p.kind === 'movie' ? p.movie.id : ''))).toEqual(['m2', 'm3']);

    // 2) "Eskiden izlenenler" kuyruğuna alınan film picker'a ASLA giremez
    const withPastQueue = watchlist.map((m) => ({ ...m, inPastQueue: m.id === 'm3' }));
    const pool2 = filterPickerCandidates(withPastQueue, [], 'all', null, 'any');
    expect(pool2.map((p) => (p.kind === 'movie' ? p.movie.id : ''))).toEqual(['m2']);
  });
});

describe('İZLEME LİSTESİ — HAFTALIK PLAN KUYRUĞU', () => {
  test('ADD_PLAN_ITEM + DELETE_PLAN_ITEM: planlanan film kuyruğa eklenip çıkarılabilmeli', () => {
    let state = getInitialState();

    state = rootReducer(state, {
      type: 'ADD_PLAN_ITEM',
      item: { id: 'p1', movieId: 'm2', date: '2026-10-10', time: '21:00' } as any,
    } as any);
    expect(state.weeklyPlan).toHaveLength(1);
    expect(state.weeklyPlan![0].movieId).toBe('m2');

    state = rootReducer(state, { type: 'DELETE_PLAN_ITEM', id: 'p1' } as any);
    expect(state.weeklyPlan).toHaveLength(0);
  });

  test('planlanan film listeden silinince plan kuyruğundaki bağı da kopmalı', () => {
    let state = getInitialState();
    state.weeklyPlan = [{ id: 'p1', movieId: 'm2', date: '2026-10-10', time: '21:00' } as any];

    state = rootReducer(state, { type: 'DELETE_MOVIE', id: 'm2' } as any);
    expect(state.weeklyPlan).toHaveLength(0);
  });
});
