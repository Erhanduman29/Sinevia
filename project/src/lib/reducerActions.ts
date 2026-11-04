/**
 * Harici kaynak (Letterboxd / Trakt / IMDb) aktarımları için toplu state mantığı.
 *
 * Buradaki fonksiyonlar saf (pure) çalışır: mevcut state'i mutasyona uğratmaz,
 * yeni bir state döndürür. İzlenmiş kayıtlar `isPastWatch: true` + `importedAt`
 * taşır; izleme listesi kayıtları ise izlenmemiş katalog kaydı olarak eklenir.
 * Günlük/haftalık görevler ve sözleşmeler `isPastWatch` filtresiyle korunur.
 */
import type { AppData, Episode, Movie, Series, WatchHistoryItem } from '../types';
import { normalize } from './utils';

export type LegacyImportSource = 'letterboxd' | 'trakt' | 'imdb' | 'mixed';

/** Migration Engine'in reducer'a tek seferde gönderdiği paket. */
export interface LegacyImportPayload {
  source: LegacyImportSource;
  importedAt: string;
  /** İzlenmiş filmler (Eskiden İzlenenler). */
  movies: Movie[];
  /** İzlenmiş diziler. */
  series: Series[];
  /** İzleme listesinden gelen, henüz izlenmemiş filmler (Filmler listesi). */
  watchlistMovies?: Movie[];
  /** İzleme listesinden gelen, henüz izlenmemiş diziler (Diziler listesi). */
  watchlistSeries?: Series[];
  history: WatchHistoryItem[];
  /** Kaynak dosyalardan gelen yeni etiketler (opsiyonel). */
  reviewTags?: string[];
}

type ImportableState = Pick<AppData, 'movies' | 'series' | 'history' | 'genres'> & {
  reviewTags?: string[];
};

function titleYearKey(title: string, year?: string | number | null): string {
  return `${normalize(title)}|${String(year ?? '').slice(0, 4)}`;
}

function parsedYear(value?: string | number | null): number | null {
  const match = String(value ?? '').match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

/** Aynı başlıkta yıl farkı 1 ise (festival/vizyon tarihi farkı) aynı yapım say. */
function yearsCompatible(a?: string | number | null, b?: string | number | null): boolean {
  const ya = parsedYear(a);
  const yb = parsedYear(b);
  if (ya == null || yb == null) return true;
  return Math.abs(ya - yb) <= 1;
}

function sameGenres(current: string[], incoming: string[]): string[] {
  if (!incoming.length) return current;
  const out = [...current];
  for (const genre of incoming) {
    const clean = normalize(genre);
    if (!clean) continue;
    if (!out.some((g) => normalize(g) === clean)) out.push(genre);
  }
  return out;
}

function mergeTags(current: string[] | undefined, incoming: string[] | undefined): string[] | undefined {
  if (!incoming?.length) return current;
  const out = [...(current || [])];
  for (const tag of incoming) {
    const clean = normalize(tag);
    if (clean && !out.some((t) => normalize(t) === clean)) out.push(tag);
  }
  return out;
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

/** Var olan bir filmi aktarılan kayıtla birleştirir; kullanıcı verisini ezmez. */
function mergeMovie(existing: Movie, incoming: Movie, watchlist: boolean): Movie {
  const wasWatched = existing.watched;
  const next: Movie = {
    ...existing,
    genres: sameGenres(existing.genres || [], incoming.genres || []),
    posterUrl: existing.posterUrl || incoming.posterUrl,
    overview: existing.overview || incoming.overview,
    tmdbId: existing.tmdbId ?? incoming.tmdbId,
    imdbId: existing.imdbId || incoming.imdbId,
    runtime: existing.runtime ?? incoming.runtime,
    originalLanguage: existing.originalLanguage || incoming.originalLanguage,
    keywords: existing.keywords?.length ? existing.keywords : incoming.keywords,
    directors: existing.directors?.length ? existing.directors : incoming.directors,
    cast: existing.cast?.length ? existing.cast : incoming.cast,
    studios: existing.studios?.length ? existing.studios : incoming.studios,
    watchProviders: existing.watchProviders?.length ? existing.watchProviders : incoming.watchProviders,
  };

  // İzleme listesi kaydı yalnızca eksik katalog bilgilerini tamamlar; mevcut
  // izlenmiş/izlenmemiş durumunu ve kullanıcı puanını değiştirmez.
  if (watchlist) return { ...next, importedAt: existing.importedAt || incoming.importedAt };

  if (!wasWatched && incoming.watched) {
    // Kütüphanede izlenmemiş olarak duran film, aktarımda izlenmiş görünüyorsa
    // geçmiş izleme olarak işaretlenir. Ekonomi tetiklenmez.
    return {
      ...next,
      watched: true,
      isPastWatch: true,
      inPastQueue: false,
      importedAt: incoming.importedAt,
      rating: incoming.rating ?? existing.rating,
      note: incoming.note || existing.note,
      reviewTags: mergeTags(existing.reviewTags, incoming.reviewTags),
      watchedAt: incoming.watchedAt ?? existing.watchedAt,
      actualRuntime: existing.actualRuntime ?? incoming.actualRuntime ?? incoming.runtime,
    };
  }

  // Zaten izlenmişse puan/not kullanıcıya aittir; yalnızca eksik teknik alanlar doldurulur.
  if (incoming.watched) {
    return { ...next, importedAt: existing.importedAt || incoming.importedAt };
  }
  if (existing.importedAt && !existing.rating && incoming.rating != null) {
    return { ...next, rating: incoming.rating };
  }
  return next;
}

/** İzleme listesi dizisine sonradan gelen izlenmiş bölümleri mevcut listeyle birleştirir. */
function mergeEpisodeLists(current: Episode[], incoming: Episode[]): Episode[] {
  const map = new Map<string, Episode>();
  current.forEach((episode) => map.set(`${episode.season}:${episode.episode}`, episode));
  incoming.forEach((episode) => {
    const key = `${episode.season}:${episode.episode}`;
    const existing = map.get(key);
    map.set(key, existing ? { ...existing, ...episode } : episode);
  });
  return Array.from(map.values()).sort((a, b) => a.season - b.season || a.episode - b.episode);
}

/** Var olan bir diziyi aktarılan kayıtla birleştirir. */
function mergeSeries(existing: Series, incoming: Series, watchlist: boolean): Series {
  const next: Series = {
    ...existing,
    genres: sameGenres(existing.genres || [], incoming.genres || []),
    posterUrl: existing.posterUrl || incoming.posterUrl,
    overview: existing.overview || incoming.overview,
    tmdbId: existing.tmdbId ?? incoming.tmdbId,
    imdbId: existing.imdbId || incoming.imdbId,
    originalLanguage: existing.originalLanguage || incoming.originalLanguage,
    episodeRuntime: existing.episodeRuntime ?? incoming.episodeRuntime,
    keywords: existing.keywords?.length ? existing.keywords : incoming.keywords,
    creators: existing.creators?.length ? existing.creators : incoming.creators,
    cast: existing.cast?.length ? existing.cast : incoming.cast,
    studios: existing.studios?.length ? existing.studios : incoming.studios,
    watchProviders: existing.watchProviders?.length ? existing.watchProviders : incoming.watchProviders,
    episodes: existing.episodes?.length ? existing.episodes : (incoming.episodes || []),
  };

  // İzleme listesi kaydı diziyi "geçmiş izleme"ye çevirmez.
  if (watchlist) return { ...next, importedAt: existing.importedAt || incoming.importedAt };

  const hasWatchedEpisodes = (existing.episodes || []).some((episode) => episode.watched);
  if (!existing.isPastWatch && !hasWatchedEpisodes) {
    return {
      ...next,
      isPastWatch: true,
      inPastQueue: false,
      importedAt: existing.importedAt || incoming.importedAt,
      overallRating: existing.overallRating ?? incoming.overallRating ?? null,
      overallNote: existing.overallNote || incoming.overallNote || '',
      overallRatedAt: existing.overallRatedAt || incoming.overallRatedAt,
      overallReviewTags: mergeTags(existing.overallReviewTags, incoming.overallReviewTags),
      episodes: existing.episodes?.length
        ? mergeEpisodeLists(existing.episodes, incoming.episodes || [])
        : (incoming.episodes || []),
    };
  }

  if (incoming.isPastWatch) {
    return {
      ...next,
      importedAt: existing.importedAt || incoming.importedAt,
      episodes: existing.episodes?.length
        ? mergeEpisodeLists(existing.episodes, incoming.episodes || [])
        : (incoming.episodes || []),
    };
  }
  if (existing.importedAt && existing.overallRating == null && incoming.overallRating != null) {
    return { ...next, overallRating: incoming.overallRating };
  }
  return next;
}

/**
 * Aktarım paketini mevcut kütüphaneyle birleştirir.
 * Aynı film/dizi tekrar oluşturulmaz; aynı güne ait izleme geçmişi tekrar eklenmez.
 */
export function applyLegacyImport<T extends ImportableState>(
  state: T,
  payload: LegacyImportPayload,
): T {
  const moviesIn = Array.isArray(payload.movies) ? payload.movies : [];
  const seriesIn = Array.isArray(payload.series) ? payload.series : [];
  const watchlistMoviesIn = Array.isArray(payload.watchlistMovies) ? payload.watchlistMovies : [];
  const watchlistSeriesIn = Array.isArray(payload.watchlistSeries) ? payload.watchlistSeries : [];
  const historyIn = Array.isArray(payload.history) ? payload.history : [];
  if (
    moviesIn.length === 0 && seriesIn.length === 0
    && watchlistMoviesIn.length === 0 && watchlistSeriesIn.length === 0
    && historyIn.length === 0
  ) return state;

  const movies = [...(state.movies || [])];
  const series = [...(state.series || [])];
  const history = [...(state.history || [])];

  const usedMovieIds = new Set(movies.map((m) => m.id));
  const usedSeriesIds = new Set(series.map((s) => s.id));
  const usedHistoryIds = new Set(history.map((h) => h.id));

  const movieByTmdb = new Map<number, number>();
  const movieByImdb = new Map<string, number>();
  const movieByTitleYear = new Map<string, number>();
  const movieByTitle = new Map<string, number>();
  movies.forEach((m, index) => {
    if (m.tmdbId) movieByTmdb.set(m.tmdbId, index);
    if (m.imdbId) movieByImdb.set(m.imdbId, index);
    movieByTitleYear.set(titleYearKey(m.title, m.year), index);
    const titleKey = normalize(m.title);
    movieByTitle.set(titleKey, movieByTitle.has(titleKey) ? -1 : index);
  });

  const seriesByTmdb = new Map<number, number>();
  const seriesByImdb = new Map<string, number>();
  const seriesByTitleYear = new Map<string, number>();
  const seriesByTitle = new Map<string, number>();
  series.forEach((s, index) => {
    if (s.tmdbId) seriesByTmdb.set(s.tmdbId, index);
    if (s.imdbId) seriesByImdb.set(s.imdbId, index);
    seriesByTitleYear.set(titleYearKey(s.title, s.year), index);
    const titleKey = normalize(s.title);
    seriesByTitle.set(titleKey, seriesByTitle.has(titleKey) ? -1 : index);
  });

  const movieIdMap = new Map<string, string>();
  const historyEligibleMovieIds = new Set<string>();

  const findMovieIndex = (item: Movie): number | undefined => {
    if (item.tmdbId) {
      const hit = movieByTmdb.get(item.tmdbId);
      if (hit !== undefined) return hit;
    }
    if (item.imdbId) {
      const hit = movieByImdb.get(item.imdbId);
      if (hit !== undefined) return hit;
    }
    const yearHit = movieByTitleYear.get(titleYearKey(item.title, item.year));
    if (yearHit !== undefined) return yearHit;
    // Yıl alanı boş/farklı olsa bile başlık kütüphanede tek bir filmi
    // gösteriyorsa aynı yapım kabul edilir; böylece çift kayıt oluşmaz.
    const titleHit = movieByTitle.get(normalize(item.title));
    if (titleHit !== undefined && titleHit >= 0 && yearsCompatible(item.year, movies[titleHit].year)) {
      return titleHit;
    }
    return undefined;
  };

  const upsertMovie = (incoming: Movie, watchlist: boolean): void => {
    if (!incoming?.title) return;
    const existingIndex = findMovieIndex(incoming);
    if (existingIndex !== undefined) {
      const existing = movies[existingIndex];
      const merged = mergeMovie(existing, incoming, watchlist);
      movies[existingIndex] = merged;
      movieIdMap.set(incoming.id, existing.id);
      if (!watchlist && merged.watched && (merged.isPastWatch || existing.importedAt)) {
        historyEligibleMovieIds.add(existing.id);
      }
      return;
    }

    const id = uniqueId(incoming.id, usedMovieIds);
    const created: Movie = {
      ...incoming,
      id,
      watched: watchlist ? false : true,
      isPastWatch: watchlist ? false : true,
      importedAt: incoming.importedAt || payload.importedAt,
      rating: watchlist ? null : incoming.rating,
      note: watchlist ? '' : incoming.note,
      reviewTags: watchlist ? undefined : incoming.reviewTags,
      watchedAt: watchlist ? null : incoming.watchedAt,
      actualRuntime: watchlist ? undefined : incoming.actualRuntime,
      addedAt: incoming.addedAt || payload.importedAt,
    };
    movieIdMap.set(incoming.id, id);
    if (!watchlist) historyEligibleMovieIds.add(id);
    const index = movies.length;
    movies.push(created);
    if (created.tmdbId) movieByTmdb.set(created.tmdbId, index);
    if (created.imdbId) movieByImdb.set(created.imdbId, index);
    movieByTitleYear.set(titleYearKey(created.title, created.year), index);
    const titleKey = normalize(created.title);
    movieByTitle.set(titleKey, movieByTitle.has(titleKey) ? -1 : index);
  };

  for (const incoming of moviesIn) upsertMovie(incoming, false);
  for (const incoming of watchlistMoviesIn) upsertMovie(incoming, true);

  const seriesIdMap = new Map<string, string>();
  const historyEligibleSeriesIds = new Set<string>();

  const findSeriesIndex = (item: Series): number | undefined => {
    if (item.tmdbId) {
      const hit = seriesByTmdb.get(item.tmdbId);
      if (hit !== undefined) return hit;
    }
    if (item.imdbId) {
      const hit = seriesByImdb.get(item.imdbId);
      if (hit !== undefined) return hit;
    }
    const yearHit = seriesByTitleYear.get(titleYearKey(item.title, item.year));
    if (yearHit !== undefined) return yearHit;
    const titleHit = seriesByTitle.get(normalize(item.title));
    if (titleHit !== undefined && titleHit >= 0 && yearsCompatible(item.year, series[titleHit].year)) {
      return titleHit;
    }
    return undefined;
  };

  const upsertSeries = (incoming: Series, watchlist: boolean): void => {
    if (!incoming?.title) return;
    const existingIndex = findSeriesIndex(incoming);
    if (existingIndex !== undefined) {
      const existing = series[existingIndex];
      const merged = mergeSeries(existing, incoming, watchlist);
      series[existingIndex] = merged;
      seriesIdMap.set(incoming.id, existing.id);
      const hasWatchedEpisodes = (merged.episodes || []).some((episode) => episode.watched);
      if (!watchlist && merged.isPastWatch && (hasWatchedEpisodes || merged.overallRating != null || existing.importedAt)) {
        historyEligibleSeriesIds.add(existing.id);
      }
      return;
    }

    const id = uniqueId(incoming.id, usedSeriesIds);
    const created: Series = {
      ...incoming,
      id,
      isPastWatch: watchlist ? false : true,
      importedAt: incoming.importedAt || payload.importedAt,
      episodes: incoming.episodes || [],
      overallRating: watchlist ? null : incoming.overallRating,
      overallNote: watchlist ? '' : incoming.overallNote,
      overallRatedAt: watchlist ? null : incoming.overallRatedAt,
      overallReviewTags: watchlist ? undefined : incoming.overallReviewTags,
      addedAt: incoming.addedAt || payload.importedAt,
    };
    seriesIdMap.set(incoming.id, id);
    if (!watchlist) historyEligibleSeriesIds.add(id);
    const index = series.length;
    series.push(created);
    if (created.tmdbId) seriesByTmdb.set(created.tmdbId, index);
    if (created.imdbId) seriesByImdb.set(created.imdbId, index);
    seriesByTitleYear.set(titleYearKey(created.title, created.year), index);
    const titleKey = normalize(created.title);
    seriesByTitle.set(titleKey, seriesByTitle.has(titleKey) ? -1 : index);
  };

  for (const incoming of seriesIn) upsertSeries(incoming, false);
  for (const incoming of watchlistSeriesIn) upsertSeries(incoming, true);

  const historyKeyOf = (h: WatchHistoryItem): string => {
    const id = h.kind === 'series' ? (h.seriesId || h.itemId || '') : (h.itemId || '');
    const episodePart = h.kind === 'series' ? `${h.season ?? ''}:${h.episode ?? ''}` : '';
    return `${h.kind}:${id}:${String(h.watchedAt).slice(0, 10)}:${episodePart}`;
  };

  const historyKeys = new Set(history.map(historyKeyOf));

  for (const incoming of historyIn) {
    if (!incoming?.watchedAt) continue;
    const kind = incoming.kind === 'series' ? 'series' : 'movie';
    const originalId = kind === 'series' ? (incoming.seriesId || incoming.itemId) : incoming.itemId;
    if (!originalId) continue;

    const mappedId = kind === 'series' ? seriesIdMap.get(originalId) : movieIdMap.get(originalId);
    if (!mappedId) continue;
    // Mevcut kullanıcı kaydı zaten izlenmişse geçmişi çoğaltma.
    if (kind === 'movie' && !historyEligibleMovieIds.has(mappedId)) continue;
    if (kind === 'series' && !historyEligibleSeriesIds.has(mappedId)) continue;

    const dayKey = historyKeyOf({ ...incoming, kind, itemId: mappedId, seriesId: kind === 'series' ? mappedId : incoming.seriesId });
    if (historyKeys.has(dayKey)) continue;
    historyKeys.add(dayKey);

    const item: WatchHistoryItem = {
      ...incoming,
      id: uniqueId(incoming.id || `imp-history-${mappedId}`, usedHistoryIds),
      kind,
      type: kind,
      itemId: mappedId,
      seriesId: kind === 'series' ? mappedId : incoming.seriesId,
      isPastWatch: true,
      importedAt: incoming.importedAt || payload.importedAt,
    };
    history.unshift(item);
  }

  const incomingGenres = [
    ...moviesIn.flatMap((m) => m.genres || []),
    ...seriesIn.flatMap((s) => s.genres || []),
  ];
  const reviewTags = mergeTags(state.reviewTags, payload.reviewTags);

  return {
    ...state,
    movies,
    series,
    history,
    genres: sameGenres(state.genres || [], incomingGenres),
    reviewTags,
  } as T;
}
