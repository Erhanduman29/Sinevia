import { Movie, WatchHistoryItem } from '../types';

export function evaluateQuestCompletion(
  questId: string,
  questAcceptedAt: number,
  history: WatchHistoryItem[],
  movies: Movie[],
  dailyStreak: number
): boolean {
  
  // Sadece görevi KABUL ETTİKTEN SONRA izlenenler
  const historySince = history.filter(h => {
    const watchedTime = new Date(h.watchedAt).getTime();
    return !isNaN(watchedTime) && watchedTime >= questAcceptedAt;
  });
  
  const watchedMovies = movies.filter(m => 
    m.watched && historySince.some(h => h.kind === 'movie' && h.itemId === m.id)
  );
  
  const ratedMovies = movies.filter(m => 
    m.rating !== null && historySince.some(h => h.kind === 'movie' && h.itemId === m.id)
  );

  const watchedEpisodes = historySince.filter(h => h.kind === 'series');

  switch (questId) {
    case 'c_picky_taste': 
      return ratedMovies.some(m => m.rating === 7.5 || m.rating === 8.5);
    case 'c_short_movie': 
      return watchedMovies.some(m => m.runtime && m.runtime < 90);
    case 'c_action_fan': 
      return watchedMovies.some(m => m.genres?.includes('Aksiyon') && m.rating !== null);
    case 'c_comedy_fan': 
      return watchedMovies.some(m => m.genres?.includes('Komedi'));
    case 'c_drama_fan': 
      return watchedMovies.some(m => m.genres?.includes('Dram'));
    case 'c_sci_fi_fan': 
      return watchedMovies.some(m => m.genres?.includes('Bilim Kurgu'));
    case 'c_documentary': 
      return watchedMovies.some(m => m.genres?.includes('Belgesel'));
    case 'c_animation': 
      return watchedMovies.some(m => m.genres?.includes('Animasyon'));
    case 'c_masterpiece': 
      return ratedMovies.some(m => m.rating === 10);
    case 'c_trash': 
      return ratedMovies.some(m => m.rating !== null && m.rating <= 3);
    case 'c_mediocre': 
      return ratedMovies.some(m => m.rating !== null && m.rating >= 5 && m.rating <= 6);
    case 'c_detailer': 
      return watchedMovies.some(m => m.reviewTags && m.reviewTags.length >= 3);
    case 'c_writer': 
      return watchedMovies.some(m => m.note && m.note.length >= 50);
    case 'c_old_movie': 
      return watchedMovies.some(m => m.year && parseInt(m.year) < 2000);
    case 'c_new_movie': 
      const currentYear = new Date().getFullYear().toString();
      return watchedMovies.some(m => m.year === currentYear);
    case 'c_weekend': 
      return watchedMovies.some(m => {
        if (!m.watchedAt) return false;
        const day = new Date(m.watchedAt).getDay();
        return day === 0 || day === 6; 
      });
    case 'c_weekday': 
      return watchedMovies.some(m => {
        if (!m.watchedAt) return false;
        return new Date(m.watchedAt).getDay() === 1; 
      });
    case 'c_short_series': 
      return watchedEpisodes.some(e => e.actualRuntime && e.actualRuntime < 30);
    case 'c_series_pilot': 
      return watchedEpisodes.some(e => e.season === 1 && e.episode === 1);
    case 'c_series_double': 
      return watchedEpisodes.length >= 2;

    case 'r_night_watch': 
      return watchedMovies.some(m => {
        if (!m.watchedAt) return false;
        const hr = new Date(m.watchedAt).getHours();
        return hr >= 1 && hr < 5;
      });
    case 'r_two_hours': 
      return watchedMovies.some(m => m.runtime && m.runtime >= 120 && m.runtime <= 130);
    case 'r_tarantino': 
      return watchedMovies.some(m => (m.genres?.includes('Suç') || m.genres?.includes('Gerilim')) && m.rating !== null && m.rating >= 8);
    case 'r_classic':
      return watchedMovies.some(m => m.year && parseInt(m.year) >= 1970 && parseInt(m.year) <= 1980);
    case 'r_mystery_solver':
      return watchedMovies.some(m => m.genres?.includes('Gizem') && m.note && m.note.length >= 100);
    case 'r_consistent': 
      return dailyStreak >= 3; 
    case 'r_variety': 
      return watchedMovies.length >= 2; 
    case 'r_series_wolf': 
      return watchedEpisodes.length >= 3;
    case 'r_friday_joy': 
      return watchedMovies.some(m => {
        if (!m.watchedAt) return false;
        const d = new Date(m.watchedAt);
        return d.getDay() === 5 && d.getHours() >= 20; 
      });
    case 'r_double_action': 
      return watchedMovies.filter(m => m.genres?.includes('Aksiyon')).length >= 2;
    case 'r_double_horror': 
      return watchedMovies.filter(m => m.genres?.includes('Korku')).length >= 2;
    case 'r_long_movie': 
      return watchedMovies.some(m => m.runtime && m.runtime >= 150);
    case 'r_perfect_pair': 
      const perfectMovies = ratedMovies.filter(m => m.rating === 9 || m.rating === 10);
      return perfectMovies.length >= 2;
    case 'r_indecisive': 
      return ratedMovies.length > 0;
    case 'r_second_chance':
      return watchedMovies.length > 0;

    case 'e_series_killer': 
      return watchedEpisodes.length >= 5;
    case 'e_old_school': 
      return watchedMovies.some(m => m.year && parseInt(m.year) <= 1960);
    case 'e_heavy_novel': 
      return watchedMovies.some(m => m.note && m.note.length >= 1000);
    case 'e_marathon_3': 
      return watchedMovies.length >= 3;
    case 'e_perfect_3': 
      return ratedMovies.filter(m => m.rating !== null && m.rating >= 8).length >= 3;

    case 'l_directors_cut': 
      return watchedMovies.some(m => m.runtime && m.runtime >= 180);
    case 'l_weekend_massacre': 
      return watchedMovies.length >= 4;
    case 'l_flawless_selection': 
      return ratedMovies.filter(m => m.rating !== null && m.rating >= 9).length >= 4;
    case 'l_sinevia_god': 
      return dailyStreak >= 7;
    case 'l_marathon_5': 
      return watchedMovies.length >= 5;

    case 'm_hater': 
      return ratedMovies.filter(m => m.rating !== null && m.rating <= 3).length >= 3;

    default:
      return watchedMovies.length > 0 || watchedEpisodes.length > 0; 
  }
}