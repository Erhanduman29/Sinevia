import type { Movie, Series, Episode } from '../types';

export type PickedItem =
  | { kind: 'movie'; movie: Movie }
  | { kind: 'series'; series: Series; episode: Episode };

export type ModeFilter = 'all' | 'movie' | 'series';
export type DurationFilter = 'any' | 'short' | 'medium' | 'long';

export function filterPickerCandidates(
  cleanUnwatchedMovies: Movie[],
  nextEpisodes: { series: Series; episode: Episode }[],
  mode: ModeFilter,
  selectedGenre: string | null,
  durationFilter: DurationFilter
): PickedItem[] {
  const pool: PickedItem[] = [];

  if (mode === 'all' || mode === 'movie') {
    cleanUnwatchedMovies.forEach((m) => {
      if (m.inPastQueue) return; // Eskiden izlenenler kuralı
      if (selectedGenre && !m.genres.includes(selectedGenre)) return;
      if (durationFilter !== 'any') {
        const rt = m.runtime || 115;
        if (durationFilter === 'short' && rt >= 100) return;
        if (durationFilter === 'medium' && (rt < 100 || rt > 140)) return;
        if (durationFilter === 'long' && rt <= 140) return;
      }
      pool.push({ kind: 'movie', movie: m });
    });
  }

  if (mode === 'all' || mode === 'series') {
    nextEpisodes.forEach((item) => {
      if (selectedGenre && !item.series.genres.includes(selectedGenre)) return;
      pool.push({ kind: 'series', series: item.series, episode: item.episode });
    });
  }

  return pool;
}