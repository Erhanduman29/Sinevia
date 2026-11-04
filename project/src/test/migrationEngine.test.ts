import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { parseImportFiles, buildLegacyImportPayload, countDraftStatuses, type ImportDraft } from '../lib/parsers';
import { applyLegacyImport, type LegacyImportPayload } from '../lib/reducerActions';
import { rootReducer, type ExtendedAppData } from '../context/AppContext';
import type { Movie } from '../types';

const storageMap = new Map<string, string>();
const fakeStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => void storageMap.set(key, value),
  removeItem: (key: string) => void storageMap.delete(key),
  clear: () => storageMap.clear(),
  key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
  get length() { return storageMap.size; },
};

beforeEach(() => {
  storageMap.clear();
  vi.stubGlobal('localStorage', fakeStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function csvFile(name: string, text: string): File {
  return {
    name,
    size: text.length,
    text: async () => text,
  } as unknown as File;
}

function baseState(): ExtendedAppData {
  return {
    movies: [], series: [], removedSeriesTitles: [], collections: [],
    genres: [], reviewTags: [], history: [], achievements: [], criteria: [],
    xp: 0, level: 1, totalXp: 0, lastWatchDate: null, tagSentiments: {},
    dailyStreak: 0, dailyStreakDate: null, showLockedNames: false,
    theme: 'default', altWatchTemplate: '', weeklyPlan: [], notificationsEnabled: false,
    xpEvents: [], pendingToasts: [],
  } as unknown as ExtendedAppData;
}

const letterboxdDiary = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2024-03-07,Inception,2010,https://boxd.it/abc,4.5,No,"mind-bender, favorite",2024-03-07
2024-04-01,Inception,2010,https://boxd.it/abc,4.5,Yes,"mind-bender, favorite",2024-04-01
2024-05-02,Parasite,2019,https://boxd.it/def,5,No,,2024-05-02`;

const imdbRatings = `Const,Title,Title Type,Year,Your Rating,Date Rated,Genres,Runtime (mins)
tt0111161,The Shawshank Redemption,movie,1994,10,2024-02-01,Drama,142
tt0944947,Game of Thrones,tvSeries,2011,9,2024-02-02,"Drama, Fantasy",57`;

const traktHistory = `watched_at,type,title,year,tmdb_id,imdb_id,rating,season,episode
2024-01-02T20:00:00Z,movie,Dune: Part Two,2024,693134,,8,,
2024-01-03T21:00:00Z,episode,Shogun,2024,126308,tt2788316,9,1,2`;

describe('migration parsers', () => {
  test('Letterboxd diary + ratings: rating x2, rewatch dates preserved, tags split', async () => {
    const result = await parseImportFiles([
      csvFile('diary.csv', letterboxdDiary),
      csvFile('ratings.csv', `Date,Name,Year,Letterboxd URI,Rating
2024-03-07,Inception,2010,https://boxd.it/abc,4.5`),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.drafts).toHaveLength(2);
    const inception = result.drafts.find((draft) => draft.title === 'Inception');
    expect(inception).toBeDefined();
    expect(inception?.rating).toBe(9);
    expect(inception?.watches).toHaveLength(2);
    expect(inception?.reviewTags).toEqual(['mind-bender', 'favorite']);
    expect(inception?.status).toBe('review');
  });

  test('puansız diary ile puanlı ratings birleşince izleme tarihi korunur', async () => {
    const result = await parseImportFiles([
      csvFile('diary.csv', `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2024-03-07,Inception,2010,https://boxd.it/abc,,No,,2024-03-07`),
      csvFile('ratings.csv', `Date,Name,Year,Letterboxd URI,Rating
2024-03-08,Inception,2010,https://boxd.it/abc,4.5`),
    ]);

    expect(result.drafts).toHaveLength(1);
    const inception = result.drafts[0];
    expect(inception.intent).toBe('watched');
    expect(inception.rating).toBe(9);
    expect(inception.watches).toHaveLength(1);
    expect(inception.watches[0].watchedAt.startsWith('2024-03-07')).toBe(true);
  });

  test('IMDb ratings: Const -> imdbId, title type -> movie/series, rating unchanged', async () => {
    const result = await parseImportFiles([csvFile('ratings.csv', imdbRatings)]);
    expect(result.drafts).toHaveLength(2);

    const movie = result.drafts.find((draft) => draft.title.includes('Shawshank'));
    expect(movie?.imdbId).toBe('tt0111161');
    expect(movie?.mediaType).toBe('movie');
    expect(movie?.rating).toBe(10);
    expect(movie?.runtime).toBe(142);

    const series = result.drafts.find((draft) => draft.title === 'Game of Thrones');
    expect(series?.imdbId).toBe('tt0944947');
    expect(series?.mediaType).toBe('series');
    expect(series?.episodeRuntime).toBe(57);
  });

  test('Trakt history: tmdbId direct, episode watch metadata, rating unchanged', async () => {
    const result = await parseImportFiles([csvFile('history.csv', traktHistory)]);
    expect(result.drafts).toHaveLength(2);

    const movie = result.drafts.find((draft) => draft.title === 'Dune: Part Two');
    expect(movie?.tmdbId).toBe(693134);
    expect(movie?.rating).toBe(8);
    expect(movie?.watches[0].watchedAt).toContain('2024-01-02');

    const series = result.drafts.find((draft) => draft.title === 'Shogun');
    expect(series?.mediaType).toBe('series');
    expect(series?.watches[0]).toMatchObject({ season: 1, episode: 2 });
  });

  test('aynı gün izlenen farklı bölümler birleştirilmez', async () => {
    const csv = `watched_at,type,title,year,tmdb_id,rating,season,episode
2024-01-03T21:00:00Z,episode,Shogun,2024,126308,9,1,1
2024-01-03T22:00:00Z,episode,Shogun,2024,126308,9,1,2`;
    const parsed = await parseImportFiles([csvFile('history.csv', csv)]);
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].watches).toHaveLength(2);

    const payload = buildLegacyImportPayload(parsed.drafts);
    expect(payload.history).toHaveLength(2);
    expect(payload.history.map((entry) => entry.episode).sort()).toEqual([1, 2]);

    const imported = applyLegacyImport(baseState(), payload);
    expect(imported.history).toHaveLength(2);
  });

  test('başlıksız satır önizlemede hata kaydı olarak görünür', async () => {
    const csv = `Date,Name,Year,Letterboxd URI,Rating
2024-01-01,,2010,https://boxd.it/bos,4`;
    const parsed = await parseImportFiles([csvFile('ratings.csv', csv)]);
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].status).toBe('error');
    expect(countDraftStatuses(parsed.drafts).error).toBe(1);
  });

  test('Letterboxd watchlist katalog kaydı olarak ayrıştırılır', async () => {
    const csv = `Date,Name,Year,Letterboxd URI
2024-01-01,The Batman,2022,https://boxd.it/watch1`;
    const parsed = await parseImportFiles([csvFile('watchlist.csv', csv)]);
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].intent).toBe('watchlist');
    expect(parsed.drafts[0].watches).toHaveLength(0);

    const payload = buildLegacyImportPayload(parsed.drafts);
    expect(payload.movies).toHaveLength(0);
    expect(payload.history).toHaveLength(0);
    expect(payload.watchlistMovies).toHaveLength(1);
    expect(payload.watchlistMovies?.[0].watched).toBe(false);
    expect(payload.watchlistMovies?.[0].isPastWatch).toBe(false);
  });

  test('izleme listesi dizisi sezon/bölüm yapısıyla kataloğa eklenir', () => {
    const draft: ImportDraft = {
      id: 'wl-series-1',
      source: 'trakt',
      mediaType: 'series',
      intent: 'watchlist',
      title: 'Shogun',
      year: 2024,
      rating: null,
      watchedAt: null,
      watches: [],
      note: '',
      reviewTags: [],
      tmdbId: 126308,
      imdbId: 'tt2788316',
      posterUrl: 'https://image.tmdb.org/t/p/w500/shogun.jpg',
      genres: ['Dram'],
      episodeRuntime: 60,
      seasonCounts: [10, 2],
      status: 'matched',
      reason: 'TMDB ID doğrudan eşleşti',
    };

    const payload = buildLegacyImportPayload([draft]);
    const series = payload.watchlistSeries?.[0];
    expect(payload.series).toHaveLength(0);
    expect(series?.isPastWatch).toBe(false);
    expect(series?.episodes).toHaveLength(12);
    expect(series?.episodes.every((episode) => !episode.watched)).toBe(true);
    expect(series?.episodes[10]).toMatchObject({ season: 2, episode: 1 });
  });

  test('izleme listesi filmi Filmler listesinde izlenmemiş olarak kalır', () => {
    const payload: LegacyImportPayload = {
      source: 'letterboxd',
      importedAt: '2024-06-01T10:00:00.000Z',
      movies: [],
      series: [],
      watchlistMovies: [{
        id: 'wl-1', title: 'The Batman', year: '2022', genres: ['Suç'], collectionId: null,
        runtime: 176, posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        tmdbId: 414906, watched: false, isPastWatch: false, rating: null,
        note: '', watchedAt: null, importedAt: '2024-06-01T10:00:00.000Z',
        addedAt: '2024-06-01T10:00:00.000Z',
      }],
      history: [],
    };

    const next = applyLegacyImport(baseState(), payload);
    expect(next.movies).toHaveLength(1);
    expect(next.movies[0].watched).toBe(false);
    expect(next.movies[0].isPastWatch).toBe(false);
    expect(next.movies[0].rating).toBeNull();
    expect(next.movies[0].posterUrl).toContain('poster.jpg');
    expect(next.history).toHaveLength(0);
  });

  test('aynı film hem izleme listesinde hem geçmişte varsa izlenmiş kayıt kazanır', () => {
    const payload: LegacyImportPayload = {
      source: 'letterboxd',
      importedAt: '2024-06-01T10:00:00.000Z',
      movies: [{
        id: 'w-1', title: 'The Batman', year: '2022', genres: [], collectionId: null,
        watched: true, isPastWatch: true, importedAt: '2024-06-01T10:00:00.000Z',
        rating: 8, note: '', watchedAt: '2024-03-01T12:00:00.000',
        addedAt: '2024-06-01T10:00:00.000Z',
      }],
      series: [],
      watchlistMovies: [{
        id: 'wl-1', title: 'The Batman', year: '2022', genres: [], collectionId: null,
        watched: false, isPastWatch: false, rating: null, note: '', watchedAt: null,
        importedAt: '2024-06-01T10:00:00.000Z', addedAt: '2024-06-01T10:00:00.000Z',
      }],
      history: [{
        id: 'h-1', itemId: 'w-1', kind: 'movie', type: 'movie', title: 'The Batman',
        rating: 8, note: '', watchedAt: '2024-03-01T12:00:00.000', isPastWatch: true,
        importedAt: '2024-06-01T10:00:00.000Z', genres: [], year: '2022',
      }],
    };

    const next = applyLegacyImport(baseState(), payload);
    expect(next.movies).toHaveLength(1);
    expect(next.movies[0].watched).toBe(true);
    expect(next.movies[0].isPastWatch).toBe(true);
    expect(next.history).toHaveLength(1);
  });

  test('puanı olmayan diary kaydı nerede olursa olsun izlenmemiş sayılır', async () => {
    const csv = `Date,Name,Year,Letterboxd URI,Rating,Watched Date
2024-03-07,Unrated Film,2021,https://boxd.it/unrated, ,2024-03-07`;
    const parsed = await parseImportFiles([csvFile('diary.csv', csv)]);
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].intent).toBe('watchlist');
    expect(parsed.drafts[0].rating).toBeNull();
    expect(parsed.drafts[0].watches).toHaveLength(0);

    const payload = buildLegacyImportPayload(parsed.drafts);
    expect(payload.movies).toHaveLength(0);
    expect(payload.history).toHaveLength(0);
    expect(payload.watchlistMovies).toHaveLength(1);
    expect(payload.watchlistMovies?.[0].watched).toBe(false);
  });

  test('puanı olmayan Trakt geçmiş kaydı izlenmemiş kataloğa gider', async () => {
    const csv = `watched_at,type,title,year,tmdb_id,rating
2024-01-02T20:00:00Z,movie,Ratedsiz Film,2022,999999,`;
    const parsed = await parseImportFiles([csvFile('history.csv', csv)]);
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0].intent).toBe('watchlist');
    const payload = buildLegacyImportPayload(parsed.drafts);
    expect(payload.movies).toHaveLength(0);
    expect(payload.history).toHaveLength(0);
    expect(payload.watchlistMovies).toHaveLength(1);
  });

  test('payload marks every record as past watch with importedAt', async () => {
    const parsed = await parseImportFiles([csvFile('ratings.csv', imdbRatings)]);
    const payload = buildLegacyImportPayload(parsed.drafts);

    expect(payload.movies.length).toBe(1);
    expect(payload.series.length).toBe(1);
    expect(payload.history.length).toBe(2);
    expect(payload.movies.every((movie) => movie.isPastWatch && movie.importedAt)).toBe(true);
    expect(payload.series.every((serie) => serie.isPastWatch && serie.importedAt)).toBe(true);
    expect(payload.history.every((entry) => entry.isPastWatch && entry.importedAt)).toBe(true);
  });

  test('applyLegacyImport dedupes by tmdbId/title and does not duplicate history', () => {
    const payload: LegacyImportPayload = {
      source: 'mixed',
      importedAt: '2024-06-01T10:00:00.000Z',
      movies: [{
        id: 'imp-1', title: 'Inception', year: '2010', genres: ['Bilim Kurgu'], collectionId: null,
        watched: true, isPastWatch: true, importedAt: '2024-06-01T10:00:00.000Z', rating: 9,
        note: 'Harika', watchedAt: '2024-03-07T12:00:00.000', addedAt: '2024-06-01T10:00:00.000Z',
      }],
      series: [],
      history: [{
        id: 'imp-h-1', itemId: 'imp-1', kind: 'movie', type: 'movie', title: 'Inception',
        rating: 9, note: 'Harika', watchedAt: '2024-03-07T12:00:00.000', isPastWatch: true,
        importedAt: '2024-06-01T10:00:00.000Z', genres: ['Bilim Kurgu'], year: '2010',
      }],
    };

    const once = applyLegacyImport(baseState(), payload);
    const twice = applyLegacyImport(once, payload);
    expect(once.movies).toHaveLength(1);
    expect(once.history).toHaveLength(1);
    expect(twice.movies).toHaveLength(1);
    expect(twice.history).toHaveLength(1);
  });

  test('existing unwatched library item moves out of the list into past watch', () => {
    const existing = {
      id: 'existing-1', title: 'Inception', year: '2009', genres: [], collectionId: null,
      watched: false, inPastQueue: true, rating: null, note: '', watchedAt: null, addedAt: '2024-01-01T00:00:00.000Z',
    } as Movie;
    const state = { ...baseState(), movies: [existing] };
    const payload: LegacyImportPayload = {
      source: 'letterboxd',
      importedAt: '2024-06-01T10:00:00.000Z',
      movies: [{
        ...existing, id: 'imp-1', year: '2010', watched: true, isPastWatch: true, importedAt: '2024-06-01T10:00:00.000Z',
        rating: 9, watchedAt: '2024-03-07T12:00:00.000',
      }],
      series: [],
      history: [{
        id: 'imp-h-1', itemId: 'imp-1', kind: 'movie', type: 'movie', title: 'Inception',
        rating: 9, note: '', watchedAt: '2024-03-07T12:00:00.000', isPastWatch: true,
        importedAt: '2024-06-01T10:00:00.000Z', genres: [], year: '2010',
      }],
    };
    const next = applyLegacyImport(state, payload);
    expect(next.movies).toHaveLength(1);
    expect(next.movies[0].id).toBe('existing-1');
    expect(next.movies[0].watched).toBe(true);
    expect(next.movies[0].isPastWatch).toBe(true);
    expect(next.movies[0].inPastQueue).toBe(false);
    expect(next.history).toHaveLength(1);
  });
});

describe('IMPORT_LEGACY_DATA reducer', () => {
  test('imports data, unlocks past-watch achievements and big_migration', async () => {
    const parsed = await parseImportFiles([csvFile('ratings.csv', imdbRatings)]);
    expect(countDraftStatuses(parsed.drafts).total).toBe(2);
    const payload = buildLegacyImportPayload(parsed.drafts);

    const next = rootReducer(baseState(), { type: 'IMPORT_LEGACY_DATA', payload });

    expect(next.movies).toHaveLength(1);
    expect(next.series).toHaveLength(1);
    expect(next.history).toHaveLength(2);
    expect(next.history.every((entry) => entry.isPastWatch)).toBe(true);

    const bigMigration = next.achievements.find((achievement) => achievement.achievementId === 'big_migration');
    expect(bigMigration?.unlockedTiers).toContain('bronze');
    expect(next.totalXp).toBeGreaterThanOrEqual(100);

    // Geçmiş izleme başarımları aktarımdan kazanılır; katalog ekleme başarımı
    // yalnızca izleme listesi (izlenmemiş) kayıtlarından gelir.
    const movieAdd = next.achievements.find((achievement) => achievement.achievementId === 'movie_add');
    const seriesAdd = next.achievements.find((achievement) => achievement.achievementId === 'series_add');
    const pastWatcher = next.achievements.find((achievement) => achievement.achievementId === 'past_watcher');
    expect(movieAdd?.unlockedTiers ?? []).toEqual([]);
    expect(seriesAdd?.unlockedTiers ?? []).toEqual([]);
    expect(pastWatcher?.unlockedTiers ?? []).toContain('bronze');
  });

  test('watchlist import unlocks catalog add and big_migration but not past-watch achievements', () => {
    const payload: LegacyImportPayload = {
      source: 'letterboxd',
      importedAt: '2024-06-01T10:00:00.000Z',
      movies: [],
      series: [],
      watchlistMovies: [{
        id: 'wl-2', title: 'Dune: Part Two', year: '2024', genres: ['Bilim Kurgu'], collectionId: null,
        tmdbId: 693134, watched: false, isPastWatch: false, rating: null, note: '',
        watchedAt: null, importedAt: '2024-06-01T10:00:00.000Z',
        addedAt: '2024-06-01T10:00:00.000Z',
      }],
      history: [],
    };

    const next = rootReducer(baseState(), { type: 'IMPORT_LEGACY_DATA', payload });
    expect(next.movies).toHaveLength(1);
    expect(next.movies[0].watched).toBe(false);
    expect(next.history).toHaveLength(0);

    const movieAdd = next.achievements.find((achievement) => achievement.achievementId === 'movie_add');
    const pastWatcher = next.achievements.find((achievement) => achievement.achievementId === 'past_watcher');
    const bigMigration = next.achievements.find((achievement) => achievement.achievementId === 'big_migration');
    expect(movieAdd?.unlockedTiers?.length ?? 0).toBeGreaterThan(0);
    expect(pastWatcher?.unlockedTiers ?? []).toEqual([]);
    expect(bigMigration?.unlockedTiers ?? []).toContain('bronze');
  });
});
