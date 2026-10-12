import { Movie, Series } from '../types';

export type SortMode = 'az' | 'year' | 'rating' | 'added' | 'recent';
export type WatchedFilterMode = 'all' | 'unwatched' | 'watched' | 'past';

// Arama eşleşmesi yardmcı fonksiyonu
export function searchMatches(title: string, searchPhrase: string): boolean {
  if (!searchPhrase.trim()) return true;
  return title.toLocaleLowerCase('tr-TR').includes(searchPhrase.toLocaleLowerCase('tr-TR'));
}

export function filterAndSortMovies(
  movies: Movie[],
  watchedFilter: WatchedFilterMode,
  selectedGenres: Set<string>,
  search: string,
  sortMode: SortMode
): Movie[] {
  let filtered = [...movies];

  if (watchedFilter === 'unwatched') filtered = filtered.filter((m) => !m.watched);
  else if (watchedFilter === 'watched') filtered = filtered.filter((m) => m.watched && !m.isPastWatch);
  else if (watchedFilter === 'past') filtered = filtered.filter((m) => m.watched && m.isPastWatch);

  if (selectedGenres.size > 0) {
    filtered = filtered.filter((m) => Array.from(selectedGenres).every((g) => m.genres.includes(g)));
  }

  if (search.trim()) {
    filtered = filtered.filter((m) => searchMatches(m.title, search));
  }

  return filtered.sort((a, b) => {
    if (sortMode === 'az') return a.title.localeCompare(b.title, 'tr');
    if (sortMode === 'year') return (b.year || '0').localeCompare(a.year || '0');
    if (sortMode === 'added' || sortMode === 'recent') return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    
    // Rating
    const ra = a.watched && a.rating !== null ? a.rating : -1;
    const rb = b.watched && b.rating !== null ? b.rating : -1;
    return rb - ra;
  });
}

export function filterAndSortSeries(
  seriesList: Series[],
  watchedFilter: boolean | null,
  selectedGenres: Set<string>,
  search: string,
  sortMode: SortMode
): Series[] {
  let filtered = [...seriesList];

  if (watchedFilter !== null) {
    filtered = filtered.filter((s) => {
      const isCompleted = s.episodes.length > 0 && s.episodes.every((e) => e.watched);
      return watchedFilter ? isCompleted : !isCompleted;
    });
  }

  if (selectedGenres.size > 0) {
    filtered = filtered.filter((s) => Array.from(selectedGenres).every((g) => s.genres.includes(g)));
  }

  if (search.trim()) {
    filtered = filtered.filter((s) => searchMatches(s.title, search));
  }

  return filtered.sort((a, b) => {
    if (sortMode === 'az') return a.title.localeCompare(b.title, 'tr');
    if (sortMode === 'added' || sortMode === 'recent') return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    
    // Rating hesabı (Bölümlerin ortalaması)
    const avgA = a.episodes.filter((e) => e.rating !== null).length > 0
      ? a.episodes.reduce((sum, e) => sum + (e.rating || 0), 0) / a.episodes.filter((e) => e.rating !== null).length
      : -1;
    const avgB = b.episodes.filter((e) => e.rating !== null).length > 0
      ? b.episodes.reduce((sum, e) => sum + (e.rating || 0), 0) / b.episodes.filter((e) => e.rating !== null).length
      : -1;
    return avgB - avgA;
  });
}