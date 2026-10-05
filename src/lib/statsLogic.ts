import { ExtendedAppData, PAST_WATCH_COLLECTION_NAME } from '../context/AppContext';
import { WatchHistoryItem, Movie, Series } from '../types';
import { normalize } from './utils';

export type StatsScopeMode = 'current' | 'past' | 'all';

export const LANGUAGE_LABELS: Record<string, { name: string; flag: string }> = {
  en: { name: 'İngilizce (ABD / UK)', flag: '🇺🇸' },
  tr: { name: 'Türkçe (Yerli Sinema)', flag: '🇹🇷' },
  ko: { name: 'Korece (K-Drama / Sinema)', flag: '🇰🇷' },
  ja: { name: 'Japonca (Anime / Sinema)', flag: '🇯🇵' },
  es: { name: 'İspanyolca', flag: '🇪🇸' },
  fr: { name: 'Fransızca', flag: '🇫🇷' },
  de: { name: 'Almanca', flag: '🇩🇪' },
  it: { name: 'İtalyanca', flag: '🇮🇹' },
  ru: { name: 'Rusça', flag: '🇷🇺' },
  hi: { name: 'Hintçe (Bollywood)', flag: '🇮🇳' },
  zh: { name: 'Çince', flag: '🇨🇳' },
  pt: { name: 'Portekizce', flag: '🇧🇷' },
  da: { name: 'Danca', flag: '🇩🇰' },
  sv: { name: 'İsveççe', flag: '🇸🇪' },
  no: { name: 'Norveççe', flag: '🇳🇴' },
};

// Ana hesaplama motoru (Önceden UI içindeydi, artık burada test edilebilir halde)
export function calculateStats(data: ExtendedAppData, statsMode: StatsScopeMode) {
  const isHistoryItemPast = (h: WatchHistoryItem): boolean => {
    if (h.isPastWatch) return true;
    if (h.kind === 'movie' || h.type === 'movie') {
      const m = data.movies.find((x) => x.id === (h.itemId || h.id));
      if (m?.isPastWatch) return true;
    }
    return false;
  };

  const scopedHistory = data.history.filter((h) => {
    const isPast = isHistoryItemPast(h);
    if (statsMode === 'current') return !isPast;
    if (statsMode === 'past') return isPast;
    return true;
  });

  const scopedWatchedMovies = data.movies.filter((m) => {
    if (!m.watched) return false;
    if (statsMode === 'current') return !m.isPastWatch;
    if (statsMode === 'past') return Boolean(m.isPastWatch);
    return true;
  });

  const includeSeries = statsMode !== 'past';

  const movieHistory = scopedHistory.filter((h) => h.kind === 'movie' || h.type === 'movie');
  const seriesHistory = includeSeries
    ? scopedHistory.filter((h) => h.kind === 'series' || h.type === 'series')
    : [];

  const genreMovieMap = new Map<string, { count: number; totalRating: number; ratedCount: number }>();
  const genreSeriesMap = new Map<string, { count: number; totalRating: number; ratedCount: number }>();
  const genreAllMap = new Map<string, { count: number; totalRating: number; ratedCount: number }>();

  movieHistory.forEach((h) => {
    (h.genres || []).forEach((g) => {
      const m = genreMovieMap.get(g) || { count: 0, totalRating: 0, ratedCount: 0 };
      m.count++;
      if (h.rating !== null) { m.totalRating += h.rating; m.ratedCount++; }
      genreMovieMap.set(g, m);
    });
  });

  const seenSeries = new Set<string>();
  seriesHistory.forEach((h) => {
    const sid = h.seriesId || h.itemId || h.id;
    if (sid && seenSeries.has(sid)) return;
    if (sid) seenSeries.add(sid);
    (h.genres || []).forEach((g) => {
      const m = genreSeriesMap.get(g) || { count: 0, totalRating: 0, ratedCount: 0 };
      m.count++;
      if (h.rating !== null) { m.totalRating += h.rating; m.ratedCount++; }
      genreSeriesMap.set(g, m);
    });
  });

  const allGenres = new Set([...genreMovieMap.keys(), ...genreSeriesMap.keys()]);
  allGenres.forEach((g) => {
    const movie = genreMovieMap.get(g) || { count: 0, totalRating: 0, ratedCount: 0 };
    const series = genreSeriesMap.get(g) || { count: 0, totalRating: 0, ratedCount: 0 };
    genreAllMap.set(g, { count: movie.count + series.count, totalRating: movie.totalRating + series.totalRating, ratedCount: movie.ratedCount + series.ratedCount });
  });

  const monthlyMap = new Map<string, { movies: number; series: number; total: number }>();
  scopedHistory.forEach((h) => {
    if (!h.watchedAt) return;
    const d = new Date(h.watchedAt);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = monthlyMap.get(key) || { movies: 0, series: 0, total: 0 };
    entry.total++;
    if (h.kind === 'movie' || h.type === 'movie') entry.movies++;
    else entry.series++;
    monthlyMap.set(key, entry);
  });
  const monthly = Array.from(monthlyMap.entries()).sort().slice(-6);
  const maxMonthly = Math.max(...monthly.map(([, v]) => v.total), 1);

  const ratingDist = new Map<number, number>();
  scopedHistory.forEach((h) => {
    if (h.rating !== null) ratingDist.set(h.rating, (ratingDist.get(h.rating) || 0) + 1);
  });
  const ratings = Array.from(ratingDist.entries()).sort((a, b) => b[0] - a[0]);

  const ratedMovies = movieHistory.filter((h) => h.rating !== null);
  const ratedSeries = seriesHistory.filter((h) => h.rating !== null);
  const avgMovie = ratedMovies.length > 0 ? ratedMovies.reduce((s, h) => s + (h.rating || 0), 0) / ratedMovies.length : 0;
  const avgSeries = ratedSeries.length > 0 ? ratedSeries.reduce((s, h) => s + (h.rating || 0), 0) / ratedSeries.length : 0;
  const avgAll = scopedHistory.filter((h) => h.rating !== null);
  const avgTotal = avgAll.length > 0 ? avgAll.reduce((s, h) => s + (h.rating || 0), 0) / avgAll.length : 0;

  let ratingPersona = { label: 'Yeni Başlayan', color: 'text-ink-400' };
  if (avgAll.length > 0) {
    if (avgTotal >= 8.5) ratingPersona = { label: 'Çok Cömert 💖', color: 'text-emerald-400' };
    else if (avgTotal >= 7.0) ratingPersona = { label: 'Pozitif Sinefil 😊', color: 'text-teal-400' };
    else if (avgTotal >= 5.0) ratingPersona = { label: 'Dengeli Eleştirmen ⚖', color: 'text-amber-400' };
    else ratingPersona = { label: 'Acımasız Yargıç 💀', color: 'text-red-400' };
  }

  const uniqueTopItems: WatchHistoryItem[] = [];
  const seenTopKeys = new Set<string>();
  const sortedByRating = [...scopedHistory].filter((h) => h.rating !== null).sort((a, b) => (b.rating || 0) - (a.rating || 0));

  for (const item of sortedByRating) {
    const key = item.kind === 'series' || item.type === 'series' ? `series_${item.seriesId || item.title}` : `movie_${item.itemId || item.id}`;
    if (!seenTopKeys.has(key)) { seenTopKeys.add(key); uniqueTopItems.push(item); }
    if (uniqueTopItems.length >= 6) break;
  }

  const collectionStats = data.collections
    .filter((c) => normalize(c.name) !== normalize(PAST_WATCH_COLLECTION_NAME))
    .map((c) => {
      const movies = data.movies.filter((m) => m.collectionId === c.id);
      const watched = movies.filter((m) => m.watched).length;
      return { name: c.name, total: movies.length, watched, progress: movies.length > 0 ? (watched / movies.length) * 100 : 0 };
    });

  const dayOfWeekMap = new Array(7).fill(0);
  scopedHistory.forEach((h) => {
    if (!h.watchedAt) return;
    const d = new Date(h.watchedAt).getDay();
    if (!isNaN(d)) dayOfWeekMap[d]++;
  });
  const maxDayOfWeek = Math.max(...dayOfWeekMap, 1);

  const uniqueSeries = new Set(seriesHistory.map((h) => h.seriesId || h.itemId || h.id).filter(Boolean)).size;

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthCount = scopedHistory.filter((h) => {
    if (!h.watchedAt) return false;
    const d = new Date(h.watchedAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === thisMonthKey;
  }).length;

  const unwatchedMoviesList = data.movies.filter((m) => !m.watched);
  const remainingMovies = unwatchedMoviesList.length;
  const remainingMoviesHours = Math.round(unwatchedMoviesList.reduce((sum, m) => sum + (m.runtime || 115), 0) / 60);
  const movieCompletionPct = data.movies.length > 0 ? Math.round(((data.movies.length - remainingMovies) / data.movies.length) * 100) : 0;

  const ongoingSeriesCount = data.series.filter((s) => s.episodes.length === 0 || s.episodes.some((e) => !e.watched)).length;
  const totalAllEpisodes = data.series.reduce((sum, s) => sum + s.episodes.length, 0);
  const remainingEpisodes = data.series.reduce((sum, s) => sum + s.episodes.filter((e) => !e.watched).length, 0);
  const remainingEpisodesHours = Math.round((remainingEpisodes * 42) / 60);
  const seriesCompletionPct = totalAllEpisodes > 0 ? Math.round(((totalAllEpisodes - remainingEpisodes) / totalAllEpisodes) * 100) : 0;

  const watchedMoviesList = scopedWatchedMovies;
  const catalogMovieRuntimeMinutes = watchedMoviesList.reduce((sum, m) => sum + (m.runtime || 110), 0);
  const actualMovieRuntimeMinutes = watchedMoviesList.reduce((sum, m) => {
    const orig = m.runtime || 110;
    const real = m.actualRuntime && m.actualRuntime > 0 ? Math.min(m.actualRuntime, orig) : orig;
    return sum + real;
  }, 0);

  const watchedEpisodesCount = includeSeries
    ? data.series.reduce((sum, s) => sum + s.episodes.filter((e) => e.watched).length, 0)
    : 0;
  const seriesRuntimeMinutes = watchedEpisodesCount * 42;

  const totalActualMinutes = actualMovieRuntimeMinutes + seriesRuntimeMinutes;
  const totalCatalogMinutes = catalogMovieRuntimeMinutes + seriesRuntimeMinutes;

  const runtimeDays = Math.floor(totalActualMinutes / (24 * 60));
  const runtimeHours = Math.floor((totalActualMinutes % (24 * 60)) / 60);
  const runtimeMins = totalActualMinutes % 60;

  const catalogDays = Math.floor(totalCatalogMinutes / (24 * 60));
  const catalogHours = Math.floor((totalCatalogMinutes % (24 * 60)) / 60);
  const catalogMins = totalCatalogMinutes % 60;

  const earlyMovies = watchedMoviesList.filter((m) => !m.isPastWatch && m.actualRuntime && m.runtime && m.actualRuntime < m.runtime);
  const earlyFinishedCount = earlyMovies.length;
  const totalSavedMinutes = earlyMovies.reduce((sum, m) => sum + ((m.runtime || 0) - (m.actualRuntime || 0)), 0);
  const savedHours = Math.floor(totalSavedMinutes / 60);
  const savedMins = totalSavedMinutes % 60;

  const trackedSpeedMovies = watchedMoviesList.filter((m) => !m.isPastWatch && m.actualRuntime && m.actualRuntime > 0 && m.runtime && m.runtime > 0);
  const avgSpeedMultiplier = trackedSpeedMovies.length > 0
    ? trackedSpeedMovies.reduce((s, m) => s + (m.runtime || 0), 0) / trackedSpeedMovies.reduce((s, m) => s + (m.actualRuntime || 1), 0)
    : 1.0;

  const fastestMovieRecord = [...earlyMovies].sort((a, b) => ((b.runtime || 0) - (b.actualRuntime || 0)) - ((a.runtime || 0) - (a.actualRuntime || 0)))[0] || null;

  const timeBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  scopedHistory.forEach((h) => {
    if (!h.watchedAt) return;
    const hr = new Date(h.watchedAt).getHours();
    if (isNaN(hr)) return;
    if (hr >= 6 && hr < 12) timeBuckets.morning++;
    else if (hr >= 12 && hr < 18) timeBuckets.afternoon++;
    else if (hr >= 18 && hr <= 23) timeBuckets.evening++;
    else timeBuckets.night++;
  });
  const totalTimeTracked = timeBuckets.morning + timeBuckets.afternoon + timeBuckets.evening + timeBuckets.night || 1;

  const dailyCountMap = new Map<string, number>();
  scopedHistory.forEach((h) => {
    if (!h.watchedAt) return;
    const dateStr = h.watchedAt.slice(0, 10);
    dailyCountMap.set(dateStr, (dailyCountMap.get(dateStr) || 0) + 1);
  });

  const last14Days: { date: string; label: string; count: number }[] = [];
  const todayObj = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    last14Days.push({ date: iso, label, count: dailyCountMap.get(iso) || 0 });
  }
  const max14DayCount = Math.max(...last14Days.map((d) => d.count), 1);

  let busiestDay: { date: string; count: number } = { date: '-', count: 0 };
  dailyCountMap.forEach((count, dateStr) => {
    if (count > busiestDay.count) {
      const formatted = new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      busiestDay = { date: formatted, count };
    }
  });

  const sortedUniqueDates = Array.from(dailyCountMap.keys()).sort();
  let maxStreakEver = 0, currentRun = 0;
  for (let i = 0; i < sortedUniqueDates.length; i++) {
    if (i === 0) { currentRun = 1; maxStreakEver = 1; continue; }
    const diff = Math.round((new Date(sortedUniqueDates[i]).getTime() - new Date(sortedUniqueDates[i - 1]).getTime()) / 86400000);
    currentRun = diff === 1 ? currentRun + 1 : 1;
    if (currentRun > maxStreakEver) maxStreakEver = currentRun;
  }

  const longestMovie: Movie | null = [...watchedMoviesList].filter((m) => m.runtime && m.runtime > 0).sort((a, b) => (b.runtime || 0) - (a.runtime || 0))[0] || null;
  const mostWatchedSeries: { title: string; count: number } | null = includeSeries
    ? data.series.map((s) => ({ title: s.title, count: s.episodes.filter((e) => e.watched).length })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count)[0] || null
    : null;

  const notesWritten = scopedHistory.filter((h) => h.note && h.note.trim().length > 0);
  const totalNoteWords = notesWritten.reduce((sum, h) => sum + h.note.trim().split(/\s+/).filter(Boolean).length, 0);

  const reviewTagMap = new Map<string, { count: number; ratingSum: number; ratedCount: number }>();
  let totalTaggedItems = 0;
  scopedHistory.forEach((h) => {
    if (!h.reviewTags || h.reviewTags.length === 0) return;
    totalTaggedItems++;
    h.reviewTags.forEach((tag) => {
      const cur = reviewTagMap.get(tag) || { count: 0, ratingSum: 0, ratedCount: 0 };
      cur.count++;
      if (h.rating !== null) { cur.ratingSum += h.rating; cur.ratedCount++; }
      reviewTagMap.set(tag, cur);
    });
  });

  const reviewTagStats = Array.from(reviewTagMap.entries())
    .map(([tag, val]) => ({ tag, count: val.count, avg: val.ratedCount > 0 ? val.ratingSum / val.ratedCount : 0 }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : b.avg - a.avg));
  const maxReviewTagCount = Math.max(...reviewTagStats.map((t) => t.count), 1);

  const langMap = new Map<string, { count: number; ratingSum: number; ratedCount: number }>();
  watchedMoviesList.forEach((m) => {
    if (!m.originalLanguage) return;
    const code = m.originalLanguage.toLowerCase();
    const cur = langMap.get(code) || { count: 0, ratingSum: 0, ratedCount: 0 };
    cur.count++;
    if (m.rating !== null) { cur.ratingSum += m.rating; cur.ratedCount++; }
    langMap.set(code, cur);
  });
  if (includeSeries) {
    data.series.forEach((s) => {
      if (!s.originalLanguage) return;
      const watchedEps = s.episodes.filter((e) => e.watched);
      if (watchedEps.length === 0) return;
      const code = s.originalLanguage.toLowerCase();
      const cur = langMap.get(code) || { count: 0, ratingSum: 0, ratedCount: 0 };
      cur.count++;
      const ratedEps = watchedEps.filter((e) => e.rating !== null);
      if (ratedEps.length > 0) {
        const sAvg = ratedEps.reduce((sum, e) => sum + (e.rating || 0), 0) / ratedEps.length;
        cur.ratingSum += sAvg; cur.ratedCount++;
      }
      langMap.set(code, cur);
    });
  }

  const topLanguages = Array.from(langMap.entries())
    .map(([code, val]) => {
      const info = LANGUAGE_LABELS[code] || { name: `Diğer (${code.toUpperCase()})`, flag: '🌐' };
      return { code, name: info.name, flag: info.flag, count: val.count, avg: val.ratedCount > 0 ? val.ratingSum / val.ratedCount : 0 };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const directorMap = new Map<string, { count: number; ratingSum: number; ratedCount: number }>();
  const castMap = new Map<string, { count: number; ratingSum: number; ratedCount: number }>();
  const studioMap = new Map<string, { count: number; ratingSum: number; ratedCount: number }>();

  const addPersonStat = (map: Map<string, { count: number; ratingSum: number; ratedCount: number }>, name: string, rating: number | null) => {
    if (!name) return;
    const entry = map.get(name) || { count: 0, ratingSum: 0, ratedCount: 0 };
    entry.count++;
    if (rating !== null && rating !== undefined) { entry.ratingSum += rating; entry.ratedCount++; }
    map.set(name, entry);
  };

  watchedMoviesList.forEach((m) => {
    (m.directors || []).forEach((d) => addPersonStat(directorMap, d, m.rating));
    (m.cast || []).forEach((a) => addPersonStat(castMap, a, m.rating));
    (m.studios || []).forEach((st) => addPersonStat(studioMap, st, m.rating));
  });

  if (includeSeries) {
    data.series.forEach((s) => {
      const watchedEps = s.episodes.filter((e) => e.watched);
      if (watchedEps.length === 0) return;
      const ratedEps = watchedEps.filter((e) => e.rating !== null);
      const sAvg = ratedEps.length > 0 ? ratedEps.reduce((sum, e) => sum + (e.rating || 0), 0) / ratedEps.length : null;
      (s.creators || []).forEach((cr) => addPersonStat(directorMap, cr, sAvg));
      (s.cast || []).forEach((a) => addPersonStat(castMap, a, sAvg));
      (s.studios || []).forEach((st) => addPersonStat(studioMap, st, sAvg));
    });
  }

  const formatTopPeople = (map: Map<string, { count: number; ratingSum: number; ratedCount: number }>) =>
    Array.from(map.entries())
      .map(([name, val]) => ({ name, count: val.count, avg: val.ratedCount > 0 ? val.ratingSum / val.ratedCount : 0 }))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : b.avg - a.avg))
      .slice(0, 6);

  const topDirectors = formatTopPeople(directorMap);
  const topCast = formatTopPeople(castMap);
  const topStudios = formatTopPeople(studioMap);

  const criteriaStatsMap = new Map<string, { sum: number; count: number }>();
  scopedHistory.forEach((h) => {
    if (!h.detailedRating) return;
    Object.entries(h.detailedRating).forEach(([critId, score]) => {
      const num = Number(score);
      if (!isNaN(num)) {
        const cur = criteriaStatsMap.get(critId) || { sum: 0, count: 0 };
        cur.sum += num; cur.count++;
        criteriaStatsMap.set(critId, cur);
      }
    });
  });

  const criteriaAverages = (data.criteria || [])
    .map((c) => {
      const st = criteriaStatsMap.get(c.id);
      return { id: c.id, name: c.name, weight: c.weight, count: st ? st.count : 0, avg: st && st.count > 0 ? st.sum / st.count : 0 };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.avg - a.avg);

  const radarData = criteriaAverages.map(c => ({ name: c.name, score: c.avg }));

  const decadeMap = new Map<string, { count: number; ratingSum: number; ratedCount: number }>();
  watchedMoviesList.forEach((m) => {
    const y = parseInt(m.year || '', 10);
    if (!isNaN(y) && y >= 1920 && y <= 2035) {
      const decade = `${Math.floor(y / 10) * 10}'ler`;
      const cur = decadeMap.get(decade) || { count: 0, ratingSum: 0, ratedCount: 0 };
      cur.count++;
      if (m.rating !== null) { cur.ratingSum += m.rating; cur.ratedCount++; }
      decadeMap.set(decade, cur);
    }
  });
  const decades = Array.from(decadeMap.entries())
    .map(([decade, val]) => ({ decade, count: val.count, avg: val.ratedCount > 0 ? val.ratingSum / val.ratedCount : 0 }))
    .sort((a, b) => a.decade.localeCompare(b.decade));
  const maxDecadeCount = Math.max(...decades.map((d) => d.count), 1);

  return {
    genreMovieMap, genreSeriesMap, genreAllMap, monthly, maxMonthly, ratings, avgMovie, avgSeries, avgTotal,
    ratingPersona, topRated: uniqueTopItems, movieCount: watchedMoviesList.length, seriesCount: seriesHistory.length,
    uniqueSeriesCount: uniqueSeries, collectionStats, dayOfWeekMap, maxDayOfWeek, thisMonthCount,
    remainingMovies, remainingMoviesHours, movieCompletionPct, ongoingSeriesCount, remainingEpisodes,
    remainingEpisodesHours, seriesCompletionPct,
    totalActualMinutes, totalCatalogMinutes, actualMovieRuntimeMinutes, catalogMovieRuntimeMinutes, seriesRuntimeMinutes,
    runtimeDays, runtimeHours, runtimeMins, catalogDays, catalogHours, catalogMins,
    earlyFinishedCount, totalSavedMinutes, savedHours, savedMins, avgSpeedMultiplier, fastestMovieRecord,
    timeBuckets, totalTimeTracked, last14Days, max14DayCount,
    busiestDay, maxStreakEver, longestMovie, mostWatchedSeries, notesCount: notesWritten.length, totalNoteWords,
    reviewTagStats, maxReviewTagCount, totalTaggedItems, topLanguages, topDirectors, topCast, topStudios,
    criteriaAverages, radarData, decades, maxDecadeCount,
    scopedHistory 
  };
}