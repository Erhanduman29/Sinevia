import { useMemo } from 'react';
import type { Movie, Series, WatchHistoryItem } from '../types';
import type { ExtendedAppData } from '../context/AppContext';
import { calculateStats } from './statsLogic';
import type { StatsScopeMode } from './statsLogic';
import { filterAndSortMovies, filterAndSortSeries, filterAndSortHistory } from './selectors';
import type { WatchedFilterMode, SortMode, SeriesSortMode, SeriesWatchedFilter, HistorySortMode, HistoryFilterType, HistoryViewMode } from './selectors';

// ============================================================================
// MEMOIZE EDİLMİŞ SELECTOR HOOK'LARI (Madde 4)
// Saf selector mantığı selectors.ts'te; burada sadece useMemo sarmalayıcısı var.
// Deps kararlı (context slice referansları) olduğu için gereksiz yeniden hesaplama olmaz.
// ============================================================================

/**
 * Film listesi için filtre + sıralama sonucunu memoize eder.
 * filterAndSortMovies saf fonksiyonunu useMemo ile sarar.
 */
export function useFilteredMovies(
  movies: Movie[],
  watchedFilter: WatchedFilterMode,
  selectedGenres: Set<string> | ReadonlySet<string>,
  search: string,
  sortMode: SortMode
): Movie[] {
  return useMemo(
    () => filterAndSortMovies(movies, watchedFilter, selectedGenres, search, sortMode),
    [movies, watchedFilter, selectedGenres, search, sortMode]
  );
}

/**
 * calculateStats'in ihtiyaç duyduğu 5 alan (diğer ExtendedAppData alanlarına dokunmaz).
 * Adapter nesnesi yerine tek tek alır → nesne kimliği her render'da değişmez,
 * böylece useMemo gerçekten önbellek tutar.
 */
export function useComputedStats(
  movies: ExtendedAppData['movies'],
  series: ExtendedAppData['series'],
  criteria: ExtendedAppData['criteria'],
  history: ExtendedAppData['history'],
  collections: ExtendedAppData['collections'],
  statsMode: StatsScopeMode
) {
  return useMemo(
    () =>
      calculateStats(
        { movies, series, criteria, history, collections } as unknown as ExtendedAppData,
        statsMode
      ),
    [movies, series, criteria, history, collections, statsMode]
  );
}

/** Dizi listesi filtre + sıralamasını memoize eder (SeriesPage). */
export function useFilteredSeries(
  series: Series[],
  watchedFilter: SeriesWatchedFilter,
  selectedGenres: Set<string> | ReadonlySet<string>,
  search: string,
  sortMode: SeriesSortMode
): Series[] {
  return useMemo(
    () => filterAndSortSeries(series, watchedFilter, selectedGenres, search, sortMode),
    [series, watchedFilter, selectedGenres, search, sortMode]
  );
}

/** Geçmiş kalemleri filtre + sıralamasını memoize eder (HistoryPage). */
export function useFilteredHistory(
  base: WatchHistoryItem[],
  viewMode: HistoryViewMode,
  filterType: HistoryFilterType,
  onlyWithNotes: boolean,
  onlyHighRated: boolean,
  selectedTagFilter: string | null,
  search: string,
  sortMode: HistorySortMode
): WatchHistoryItem[] {
  return useMemo(
    () => filterAndSortHistory(base, viewMode, filterType, onlyWithNotes, onlyHighRated, selectedTagFilter, search, sortMode),
    [base, viewMode, filterType, onlyWithNotes, onlyHighRated, selectedTagFilter, search, sortMode]
  );
}
