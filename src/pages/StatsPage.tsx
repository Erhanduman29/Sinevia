import { useState, useMemo } from 'react';
import {
  BarChart3,
  Film,
  Tv,
  Star,
  TrendingUp,
  Calendar,
  Award,
  Clock,
  Flame,
  Clapperboard,
  Layers,
  Hourglass,
  Activity,
  User,
  Users,
  Building2,
  SlidersHorizontal,
  Crown,
  Sparkles,
  Eye,
  Compass,
  Sun,
  Sunset,
  Moon,
  Coffee,
  Globe,
  Trophy,
  StickyNote,
  Zap,
  Tag,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass } from '../lib/utils';
import MediaDetailModal from '../components/MediaDetailModal';
import type { DetailModalTarget } from '../components/MediaDetailModal';
import type { Movie, Series, WatchHistoryItem } from '../types';

const LANGUAGE_LABELS: Record<string, { name: string; flag: string }> = {
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

export default function StatsPage() {
  const { data } = useApp();
  const [detailTarget, setDetailTarget] = useState<DetailModalTarget | null>(null);
  const [peopleTab, setPeopleTab] = useState<'directors' | 'cast' | 'studios'>('directors');

  const stats = useMemo(() => {
    const movieHistory = data.history.filter((h) => h.kind === 'movie' || h.type === 'movie');
    const seriesHistory = data.history.filter((h) => h.kind === 'series' || h.type === 'series');

    const genreMovieMap = new Map<string, { count: number; totalRating: number; ratedCount: number }>();
    const genreSeriesMap = new Map<string, { count: number; totalRating: number; ratedCount: number }>();
    const genreAllMap = new Map<string, { count: number; totalRating: number; ratedCount: number }>();

    movieHistory.forEach((h) => {
      (h.genres || []).forEach((g) => {
        const m = genreMovieMap.get(g) || { count: 0, totalRating: 0, ratedCount: 0 };
        m.count++;
        if (h.rating !== null) {
          m.totalRating += h.rating;
          m.ratedCount++;
        }
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
        if (h.rating !== null) {
          m.totalRating += h.rating;
          m.ratedCount++;
        }
        genreSeriesMap.set(g, m);
      });
    });

    const allGenres = new Set([...genreMovieMap.keys(), ...genreSeriesMap.keys()]);
    allGenres.forEach((g) => {
      const movie = genreMovieMap.get(g) || { count: 0, totalRating: 0, ratedCount: 0 };
      const series = genreSeriesMap.get(g) || { count: 0, totalRating: 0, ratedCount: 0 };
      genreAllMap.set(g, {
        count: movie.count + series.count,
        totalRating: movie.totalRating + series.totalRating,
        ratedCount: movie.ratedCount + series.ratedCount,
      });
    });

    // Aylık Grafik (Son 6 Ay)
    const monthlyMap = new Map<string, { movies: number; series: number; total: number }>();
    data.history.forEach((h) => {
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

    // Puan Dağılımı
    const ratingDist = new Map<number, number>();
    data.history.forEach((h) => {
      if (h.rating !== null) ratingDist.set(h.rating, (ratingDist.get(h.rating) || 0) + 1);
    });
    const ratings = Array.from(ratingDist.entries()).sort((a, b) => b[0] - a[0]);

    // Ortalamalar
    const ratedMovies = movieHistory.filter((h) => h.rating !== null);
    const ratedSeries = seriesHistory.filter((h) => h.rating !== null);
    const avgMovie =
      ratedMovies.length > 0 ? ratedMovies.reduce((s, h) => s + (h.rating || 0), 0) / ratedMovies.length : 0;
    const avgSeries =
      ratedSeries.length > 0 ? ratedSeries.reduce((s, h) => s + (h.rating || 0), 0) / ratedSeries.length : 0;
    const avgAll = data.history.filter((h) => h.rating !== null);
    const avgTotal = avgAll.length > 0 ? avgAll.reduce((s, h) => s + (h.rating || 0), 0) / avgAll.length : 0;

    // İzleyici Kimliği
    let ratingPersona = { label: 'Yeni Başlayan', color: 'text-ink-400' };
    if (avgAll.length > 0) {
      if (avgTotal >= 8.5) ratingPersona = { label: 'Çok Cömert 💖', color: 'text-emerald-400' };
      else if (avgTotal >= 7.0) ratingPersona = { label: 'Pozitif Sinefil 😊', color: 'text-teal-400' };
      else if (avgTotal >= 5.0) ratingPersona = { label: 'Dengeli Eleştirmen ⚖️', color: 'text-amber-400' };
      else ratingPersona = { label: 'Acımasız Yargıç 💀', color: 'text-red-400' };
    }

    // Şeref Kürsüsü (Top 6 Yapım)
    const uniqueTopItems: WatchHistoryItem[] = [];
    const seenTopKeys = new Set<string>();
    const sortedByRating = [...data.history]
      .filter((h) => h.rating !== null)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));

    for (const item of sortedByRating) {
      const key =
        item.kind === 'series' || item.type === 'series'
          ? `series_${item.seriesId || item.title}`
          : `movie_${item.itemId || item.id}`;
      if (!seenTopKeys.has(key)) {
        seenTopKeys.add(key);
        uniqueTopItems.push(item);
      }
      if (uniqueTopItems.length >= 6) break;
    }

    // Koleksiyon İlerlemesi
    const collectionStats = data.collections.map((c) => {
      const movies = data.movies.filter((m) => m.collectionId === c.id);
      const watched = movies.filter((m) => m.watched).length;
      return {
        name: c.name,
        total: movies.length,
        watched,
        progress: movies.length > 0 ? (watched / movies.length) * 100 : 0,
      };
    });

    // Haftanın Günleri
    const dayOfWeekMap = new Array(7).fill(0);
    data.history.forEach((h) => {
      if (!h.watchedAt) return;
      const d = new Date(h.watchedAt).getDay();
      if (!isNaN(d)) dayOfWeekMap[d]++;
    });
    const maxDayOfWeek = Math.max(...dayOfWeekMap, 1);

    // Farklı Dizi Sayısı
    const uniqueSeries = new Set(seriesHistory.map((h) => h.seriesId || h.itemId || h.id).filter(Boolean)).size;

    // Bu Ay İzlenen
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthCount = data.history.filter((h) => {
      if (!h.watchedAt) return false;
      const d = new Date(h.watchedAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === thisMonthKey;
    }).length;

    // Sırada Bekleyenler (Film ve Dizi Ayrı Ayrı)
    const unwatchedMoviesList = data.movies.filter((m) => !m.watched);
    const remainingMovies = unwatchedMoviesList.length;
    const remainingMoviesHours = Math.round(
      unwatchedMoviesList.reduce((sum, m) => sum + (m.runtime || 115), 0) / 60
    );
    const movieCompletionPct =
      data.movies.length > 0
        ? Math.round(((data.movies.length - remainingMovies) / data.movies.length) * 100)
        : 0;

    const ongoingSeriesCount = data.series.filter(
      (s) => s.episodes.length === 0 || s.episodes.some((e) => !e.watched)
    ).length;
    const totalAllEpisodes = data.series.reduce((sum, s) => sum + s.episodes.length, 0);
    const remainingEpisodes = data.series.reduce(
      (sum, s) => sum + s.episodes.filter((e) => !e.watched).length,
      0
    );
    const remainingEpisodesHours = Math.round((remainingEpisodes * 42) / 60);
    const seriesCompletionPct =
      totalAllEpisodes > 0
        ? Math.round(((totalAllEpisodes - remainingEpisodes) / totalAllEpisodes) * 100)
        : 0;

    // Süre Hesaplamaları
    const watchedMoviesList = data.movies.filter((m) => m.watched);
    const movieRuntimeMinutes = watchedMoviesList.reduce((sum, m) => sum + (m.runtime || 110), 0);
    const watchedEpisodesCount = data.series.reduce(
      (sum, s) => sum + s.episodes.filter((e) => e.watched).length,
      0
    );
    const seriesRuntimeMinutes = watchedEpisodesCount * 42;
    const totalRuntimeMinutes = movieRuntimeMinutes + seriesRuntimeMinutes;

    const runtimeDays = Math.floor(totalRuntimeMinutes / (24 * 60));
    const runtimeHours = Math.floor((totalRuntimeMinutes % (24 * 60)) / 60);
    const runtimeMins = totalRuntimeMinutes % 60;

    // İzleme Biyoritmi
    const timeBuckets = {
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0,
    };
    data.history.forEach((h) => {
      if (!h.watchedAt) return;
      const hr = new Date(h.watchedAt).getHours();
      if (isNaN(hr)) return;
      if (hr >= 6 && hr < 12) timeBuckets.morning++;
      else if (hr >= 12 && hr < 18) timeBuckets.afternoon++;
      else if (hr >= 18 && hr <= 23) timeBuckets.evening++;
      else timeBuckets.night++;
    });
    const totalTimeTracked =
      timeBuckets.morning + timeBuckets.afternoon + timeBuckets.evening + timeBuckets.night || 1;

    // Son 14 Günün Kompakt Nabız Çubukları
    const dailyCountMap = new Map<string, number>();
    data.history.forEach((h) => {
      if (!h.watchedAt) return;
      const dateStr = h.watchedAt.slice(0, 10);
      dailyCountMap.set(dateStr, (dailyCountMap.get(dateStr) || 0) + 1);
    });

    const last14Days: { date: string; label: string; count: number }[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      last14Days.push({ date: iso, label, count: dailyCountMap.get(iso) || 0 });
    }
    const max14DayCount = Math.max(...last14Days.map((d) => d.count), 1);

    // Rekorlar Kitabı
    let busiestDay: { date: string; count: number } = { date: '-', count: 0 };
    dailyCountMap.forEach((count, dateStr) => {
      if (count > busiestDay.count) {
        const formatted = new Date(dateStr).toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        busiestDay = { date: formatted, count };
      }
    });

    const sortedUniqueDates = Array.from(dailyCountMap.keys()).sort();
    let maxStreakEver = 0;
    let currentRun = 0;
    for (let i = 0; i < sortedUniqueDates.length; i++) {
      if (i === 0) {
        currentRun = 1;
        maxStreakEver = 1;
        continue;
      }
      const diff = Math.round(
        (new Date(sortedUniqueDates[i]).getTime() - new Date(sortedUniqueDates[i - 1]).getTime()) /
          86400000
      );
      if (diff === 1) currentRun++;
      else currentRun = 1;
      if (currentRun > maxStreakEver) maxStreakEver = currentRun;
    }

    const longestMovie: Movie | null =
      [...watchedMoviesList]
        .filter((m) => m.runtime && m.runtime > 0)
        .sort((a, b) => (b.runtime || 0) - (a.runtime || 0))[0] || null;

    const mostWatchedSeries: { title: string; count: number } | null =
      data.series
        .map((s) => ({
          title: s.title,
          count: s.episodes.filter((e) => e.watched).length,
        }))
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count)[0] || null;

    const notesWritten = data.history.filter((h) => h.note && h.note.trim().length > 0);
    const totalNoteWords = notesWritten.reduce(
      (sum, h) => sum + h.note.trim().split(/\s+/).filter(Boolean).length,
      0
    );

    // =========================================================
    // YENİ: DEĞERLENDİRME BAŞLIKLARI İSTATİSTİKLERİ (reviewTags)
    // =========================================================
    const reviewTagMap = new Map<string, { count: number; ratingSum: number; ratedCount: number }>();
    let totalTaggedItems = 0;
    data.history.forEach((h) => {
      if (!h.reviewTags || h.reviewTags.length === 0) return;
      totalTaggedItems++;
      h.reviewTags.forEach((tag) => {
        const cur = reviewTagMap.get(tag) || { count: 0, ratingSum: 0, ratedCount: 0 };
        cur.count++;
        if (h.rating !== null) {
          cur.ratingSum += h.rating;
          cur.ratedCount++;
        }
        reviewTagMap.set(tag, cur);
      });
    });

    const reviewTagStats = Array.from(reviewTagMap.entries())
      .map(([tag, val]) => ({
        tag,
        count: val.count,
        avg: val.ratedCount > 0 ? val.ratingSum / val.ratedCount : 0,
      }))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : b.avg - a.avg));
    const maxReviewTagCount = Math.max(...reviewTagStats.map((t) => t.count), 1);

    // Dünya Sineması Pasaportu
    const langMap = new Map<string, { count: number; ratingSum: number; ratedCount: number }>();
    watchedMoviesList.forEach((m) => {
      if (!m.originalLanguage) return;
      const code = m.originalLanguage.toLowerCase();
      const cur = langMap.get(code) || { count: 0, ratingSum: 0, ratedCount: 0 };
      cur.count++;
      if (m.rating !== null) {
        cur.ratingSum += m.rating;
        cur.ratedCount++;
      }
      langMap.set(code, cur);
    });
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
        cur.ratingSum += sAvg;
        cur.ratedCount++;
      }
      langMap.set(code, cur);
    });

    const topLanguages = Array.from(langMap.entries())
      .map(([code, val]) => {
        const info = LANGUAGE_LABELS[code] || { name: `Diğer (${code.toUpperCase()})`, flag: '🌐' };
        return {
          code,
          name: info.name,
          flag: info.flag,
          count: val.count,
          avg: val.ratedCount > 0 ? val.ratingSum / val.ratedCount : 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Yıldızlar Geçidi (Yönetmen, Oyuncu, Stüdyo)
    const directorMap = new Map<string, { count: number; ratingSum: number; ratedCount: number }>();
    const castMap = new Map<string, { count: number; ratingSum: number; ratedCount: number }>();
    const studioMap = new Map<string, { count: number; ratingSum: number; ratedCount: number }>();

    const addPersonStat = (
      map: Map<string, { count: number; ratingSum: number; ratedCount: number }>,
      name: string,
      rating: number | null
    ) => {
      if (!name) return;
      const entry = map.get(name) || { count: 0, ratingSum: 0, ratedCount: 0 };
      entry.count++;
      if (rating !== null && rating !== undefined) {
        entry.ratingSum += rating;
        entry.ratedCount++;
      }
      map.set(name, entry);
    };

    watchedMoviesList.forEach((m) => {
      (m.directors || []).forEach((d) => addPersonStat(directorMap, d, m.rating));
      (m.cast || []).forEach((a) => addPersonStat(castMap, a, m.rating));
      (m.studios || []).forEach((st) => addPersonStat(studioMap, st, m.rating));
    });

    data.series.forEach((s) => {
      const watchedEps = s.episodes.filter((e) => e.watched);
      if (watchedEps.length === 0) return;
      const ratedEps = watchedEps.filter((e) => e.rating !== null);
      const sAvg =
        ratedEps.length > 0 ? ratedEps.reduce((sum, e) => sum + (e.rating || 0), 0) / ratedEps.length : null;

      (s.creators || []).forEach((cr) => addPersonStat(directorMap, cr, sAvg));
      (s.cast || []).forEach((a) => addPersonStat(castMap, a, sAvg));
      (s.studios || []).forEach((st) => addPersonStat(studioMap, st, sAvg));
    });

    const formatTopPeople = (map: Map<string, { count: number; ratingSum: number; ratedCount: number }>) =>
      Array.from(map.entries())
        .map(([name, val]) => ({
          name,
          count: val.count,
          avg: val.ratedCount > 0 ? val.ratingSum / val.ratedCount : 0,
        }))
        .sort((a, b) => (b.count !== a.count ? b.count - a.count : b.avg - a.avg))
        .slice(0, 6);

    const topDirectors = formatTopPeople(directorMap);
    const topCast = formatTopPeople(castMap);
    const topStudios = formatTopPeople(studioMap);

    // Detaylı Kriter Karnesi
    const criteriaStatsMap = new Map<string, { sum: number; count: number }>();
    data.history.forEach((h) => {
      if (!h.detailedRating) return;
      Object.entries(h.detailedRating).forEach(([critId, score]) => {
        const num = Number(score);
        if (!isNaN(num)) {
          const cur = criteriaStatsMap.get(critId) || { sum: 0, count: 0 };
          cur.sum += num;
          cur.count++;
          criteriaStatsMap.set(critId, cur);
        }
      });
    });

    const criteriaAverages = (data.criteria || [])
      .map((c) => {
        const st = criteriaStatsMap.get(c.id);
        return {
          id: c.id,
          name: c.name,
          weight: c.weight,
          count: st ? st.count : 0,
          avg: st && st.count > 0 ? st.sum / st.count : 0,
        };
      })
      .filter((c) => c.count > 0)
      .sort((a, b) => b.avg - a.avg);

    // Dönem (On Yıl) Analizi
    const decadeMap = new Map<string, { count: number; ratingSum: number; ratedCount: number }>();
    watchedMoviesList.forEach((m) => {
      const y = parseInt(m.year || '', 10);
      if (!isNaN(y) && y >= 1920 && y <= 2035) {
        const decade = `${Math.floor(y / 10) * 10}'ler`;
        const cur = decadeMap.get(decade) || { count: 0, ratingSum: 0, ratedCount: 0 };
        cur.count++;
        if (m.rating !== null) {
          cur.ratingSum += m.rating;
          cur.ratedCount++;
        }
        decadeMap.set(decade, cur);
      }
    });
    const decades = Array.from(decadeMap.entries())
      .map(([decade, val]) => ({
        decade,
        count: val.count,
        avg: val.ratedCount > 0 ? val.ratingSum / val.ratedCount : 0,
      }))
      .sort((a, b) => a.decade.localeCompare(b.decade));
    const maxDecadeCount = Math.max(...decades.map((d) => d.count), 1);

    return {
      genreMovieMap,
      genreSeriesMap,
      genreAllMap,
      monthly,
      maxMonthly,
      ratings,
      avgMovie,
      avgSeries,
      avgTotal,
      ratingPersona,
      topRated: uniqueTopItems,
      movieCount: movieHistory.length,
      seriesCount: seriesHistory.length,
      uniqueSeriesCount: uniqueSeries,
      collectionStats,
      dayOfWeekMap,
      maxDayOfWeek,
      thisMonthCount,
      remainingMovies,
      remainingMoviesHours,
      movieCompletionPct,
      ongoingSeriesCount,
      remainingEpisodes,
      remainingEpisodesHours,
      seriesCompletionPct,
      totalRuntimeMinutes,
      movieRuntimeMinutes,
      seriesRuntimeMinutes,
      runtimeDays,
      runtimeHours,
      runtimeMins,
      timeBuckets,
      totalTimeTracked,
      last14Days,
      max14DayCount,
      busiestDay,
      maxStreakEver,
      longestMovie,
      mostWatchedSeries,
      notesCount: notesWritten.length,
      totalNoteWords,
      reviewTagStats,
      maxReviewTagCount,
      totalTaggedItems,
      topLanguages,
      topDirectors,
      topCast,
      topStudios,
      criteriaAverages,
      decades,
      maxDecadeCount,
    };
  }, [data]);

  const genreAllSorted = Array.from(stats.genreAllMap.entries()).sort((a, b) => b[1].count - a[1].count);
  const maxGenreCount = Math.max(...genreAllSorted.map(([, v]) => v.count), 1);
  const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  const genreColors = [
    'from-teal-500 to-cyan-400',
    'from-cyan-500 to-blue-400',
    'from-blue-500 to-indigo-400',
    'from-emerald-500 to-green-400',
    'from-amber-500 to-orange-400',
    'from-gold-500 to-pink-400',
    'from-fuchsia-500 to-purple-400',
    'from-violet-500 to-indigo-400',
  ];

  const openHistoryItemDetail = (h: WatchHistoryItem) => {
    if (h.kind === 'movie' || h.type === 'movie') {
      const found = data.movies.find((m) => m.id === (h.itemId || h.id));
      const fallback: Movie = found || {
        id: h.itemId || h.id,
        title: h.title,
        year: h.year || '',
        genres: h.genres || [],
        collectionId: null,
        watched: true,
        rating: h.rating,
        detailedRating: h.detailedRating,
        reviewTags: h.reviewTags,
        note: h.note,
        watchedAt: h.watchedAt,
        addedAt: h.watchedAt,
      };
      setDetailTarget({ type: 'movie', data: fallback, historyItem: h });
    } else {
      const sid = h.seriesId || h.itemId || h.id;
      const found = data.series.find((s) => s.id === sid);
      const fallback: Series = found || {
        id: sid,
        title: h.title,
        year: h.year,
        genres: h.genres || [],
        episodes: [],
        addedAt: h.watchedAt,
      };
      setDetailTarget({ type: 'series', data: fallback, historyItem: h });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* SAYFA BAŞLIĞI */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-ink-100 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500/20 to-azure-500/20 border border-gold-500/30 flex items-center justify-center">
            <BarChart3 size={22} className="text-gold-400" />
          </div>
          Sinema Analiz & İstatistik Stüdyosu
        </h1>
        <div className="inline-flex items-center gap-2 bg-ink-900/80 border border-ink-700/60 px-3.5 py-1.5 rounded-full text-xs font-bold text-ink-300">
          <Sparkles size={13} className="text-gold-400" />
          Eleştirmen Kimliği: <span className={stats.ratingPersona.color}>{stats.ratingPersona.label}</span>
        </div>
      </div>

      {/* =========================================================
          1. SİNEMAYA ADANAN ZAMAN (DEV HERO BANNER)
          ========================================================= */}
      <div className="bg-gradient-to-br from-ink-950 via-ink-900 to-ink-950 border border-ink-700/70 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-6 -top-10 text-gold-500/10 transform rotate-12 pointer-events-none">
          <Hourglass size={220} />
        </div>
        <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gold-400 mb-3">
              <Clock size={15} /> Ekran Başında Geçen Toplam Ömür
            </div>
            <div className="flex items-baseline gap-4 flex-wrap">
              {stats.runtimeDays > 0 && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl sm:text-5xl font-black text-ink-50 tracking-tight">
                    {stats.runtimeDays}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-gold-400 uppercase">Gün</span>
                </div>
              )}
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl sm:text-5xl font-black text-ink-50 tracking-tight">
                  {stats.runtimeHours}
                </span>
                <span className="text-sm sm:text-base font-bold text-azure-400 uppercase">Saat</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl sm:text-5xl font-black text-ink-50 tracking-tight">
                  {stats.runtimeMins}
                </span>
                <span className="text-sm sm:text-base font-bold text-ink-400 uppercase">Dakika</span>
              </div>
            </div>
            <p className="text-xs text-ink-400 mt-3 flex items-center gap-1.5 font-medium">
              <Activity size={13} className="text-gold-400" />
              Toplam <strong className="text-ink-200">{stats.totalRuntimeMinutes.toLocaleString('tr-TR')} dakika</strong> kesintisiz sinema ve dizi deneyimi kayıt altına alındı.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:w-auto w-full flex-shrink-0">
            <div className="bg-ink-950/80 border border-ink-800 rounded-2xl p-3.5 min-w-[135px]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gold-400 mb-1">
                <Film size={14} /> Film Süresi
              </div>
              <div className="text-xl font-black text-ink-50">
                {Math.round(stats.movieRuntimeMinutes / 60)}{' '}
                <span className="text-xs font-semibold text-ink-400">Saat</span>
              </div>
              <div className="text-[10px] text-ink-500 mt-0.5">{stats.movieCount} Film İzlendi</div>
            </div>

            <div className="bg-ink-950/80 border border-ink-800 rounded-2xl p-3.5 min-w-[135px]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-azure-400 mb-1">
                <Tv size={14} /> Dizi Süresi
              </div>
              <div className="text-xl font-black text-ink-50">
                {Math.round(stats.seriesRuntimeMinutes / 60)}{' '}
                <span className="text-xs font-semibold text-ink-400">Saat</span>
              </div>
              <div className="text-[10px] text-ink-500 mt-0.5">{stats.seriesCount} Bölüm İzlendi</div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          2. ANA METRİKLER & AYRI AYRI SIRADA BEKLEYENLER (FİLM / DİZİ)
          ========================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-400 uppercase tracking-wider">İzlenen Film</span>
            <Film size={18} className="text-gold-400" />
          </div>
          <div className="text-3xl font-black text-ink-50 mt-2">{stats.movieCount}</div>
          <div className="text-[11px] text-ink-400 mt-1">
            Film Ort: <strong className="text-gold-400">{stats.avgMovie.toFixed(1)}</strong>
          </div>
        </div>

        <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-400 uppercase tracking-wider">İzlenen Bölüm</span>
            <Tv size={18} className="text-azure-400" />
          </div>
          <div className="text-3xl font-black text-ink-50 mt-2">{stats.seriesCount}</div>
          <div className="text-[11px] text-ink-400 mt-1">
            Dizi Ort: <strong className="text-azure-400">{stats.avgSeries.toFixed(1)}</strong> ({stats.uniqueSeriesCount} Dizi)
          </div>
        </div>

        <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-400 uppercase tracking-wider">Genel Ortalama</span>
            <Star size={18} className="text-amber-400 fill-current" />
          </div>
          <div className="text-3xl font-black text-ink-50 mt-2">{stats.avgTotal.toFixed(1)}</div>
          <div className={`text-[11px] font-bold mt-1 truncate ${stats.ratingPersona.color}`}>
            {stats.ratingPersona.label}
          </div>
        </div>

        <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-400 uppercase tracking-wider">Kazanılan Kupa</span>
            <Award size={18} className="text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-ink-50 mt-2">
            {data.achievements.reduce((s, a) => s + a.unlockedTiers.length, 0)}
          </div>
          <div className="text-[11px] text-ink-400 mt-1">
            Toplam: <strong className="text-emerald-400">{(data.totalXp || 0).toLocaleString()} XP</strong>
          </div>
        </div>
      </div>

      {/* SIRADA BEKLEYENLER: FİLM VE DİZİ İÇİN AYRI DETAYLI KARTLAR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-ink-900/70 border border-gold-500/30 rounded-2xl p-5 shadow-lg flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                <Film size={22} className="text-gold-400" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-gold-400">
                  Sırada Bekleyen Filmler
                </div>
                <div className="text-2xl sm:text-3xl font-black text-ink-50 mt-0.5">
                  {stats.remainingMovies} <span className="text-sm font-bold text-ink-400">Film</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black bg-ink-950 border border-ink-800 text-gold-400 px-2.5 py-1 rounded-lg">
                ~{stats.remainingMoviesHours} Saatlik Maraton
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-ink-400">
              <span>Film Arşivi Tamamlanma Oranı</span>
              <span className="text-gold-400">%{stats.movieCompletionPct} Bitti</span>
            </div>
            <div className="h-2 w-full bg-ink-950 rounded-full overflow-hidden border border-ink-800">
              <div
                className="h-full bg-gradient-to-r from-gold-600 to-amber-400 rounded-full transition-all duration-700"
                style={{ width: `${stats.movieCompletionPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-ink-900/70 border border-azure-500/30 rounded-2xl p-5 shadow-lg flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-azure-500/15 border border-azure-500/30 flex items-center justify-center flex-shrink-0">
                <Tv size={22} className="text-azure-400" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-azure-400">
                  Sırada Bekleyen Diziler & Bölümler
                </div>
                <div className="text-2xl sm:text-3xl font-black text-ink-50 mt-0.5">
                  {stats.ongoingSeriesCount}{' '}
                  <span className="text-sm font-bold text-ink-400">Dizide</span> {stats.remainingEpisodes}{' '}
                  <span className="text-sm font-bold text-ink-400">Bölüm</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black bg-ink-950 border border-ink-800 text-azure-400 px-2.5 py-1 rounded-lg">
                ~{stats.remainingEpisodesHours} Saatlik Maraton
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-ink-400">
              <span>Dizi Bölümleri Tamamlanma Oranı</span>
              <span className="text-azure-400">%{stats.seriesCompletionPct} Bitti</span>
            </div>
            <div className="h-2 w-full bg-ink-950 rounded-full overflow-hidden border border-ink-800">
              <div
                className="h-full bg-gradient-to-r from-azure-600 to-cyan-400 rounded-full transition-all duration-700"
                style={{ width: `${stats.seriesCompletionPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          3. KOMPAKT İZLEME BİYORİTMİ & SON 14 GÜN NABZI
          ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink-100 flex items-center gap-2">
                <Clock size={19} className="text-gold-400" />
                İzleme Biyoritmi (Günün Saatleri)
              </h2>
              <p className="text-xs text-ink-400 mt-0.5">
                Film ve dizileri günün hangi zaman diliminde izlemeyi seviyorsun?
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              {
                key: 'morning',
                label: 'Sabah Kuşağı',
                hours: '06:00 - 11:59',
                count: stats.timeBuckets.morning,
                icon: Coffee,
                color: 'text-amber-400',
                bar: 'bg-amber-400',
              },
              {
                key: 'afternoon',
                label: 'Gündüz',
                hours: '12:00 - 17:59',
                count: stats.timeBuckets.afternoon,
                icon: Sun,
                color: 'text-orange-400',
                bar: 'bg-orange-400',
              },
              {
                key: 'evening',
                label: 'Prime Time',
                hours: '18:00 - 23:59',
                count: stats.timeBuckets.evening,
                icon: Sunset,
                color: 'text-gold-400',
                bar: 'bg-gold-500',
              },
              {
                key: 'night',
                label: 'Gece Baykuşu',
                hours: '00:00 - 05:59',
                count: stats.timeBuckets.night,
                icon: Moon,
                color: 'text-indigo-400',
                bar: 'bg-indigo-500',
              },
            ].map((slot) => {
              const Icon = slot.icon;
              const pct = Math.round((slot.count / stats.totalTimeTracked) * 100);
              return (
                <div
                  key={slot.key}
                  className="bg-ink-950/70 border border-ink-800/80 rounded-xl p-3 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon size={17} className={slot.color} />
                    <span className="text-xs font-black text-ink-100">%{pct}</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-ink-200">{slot.label}</div>
                    <div className="text-[10px] text-ink-500">{slot.hours}</div>
                  </div>
                  <div className="mt-2.5 space-y-1">
                    <div className="h-1.5 w-full bg-ink-900 rounded-full overflow-hidden">
                      <div className={`h-full ${slot.bar} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[10px] font-semibold text-ink-400 text-right">
                      {slot.count} İzleme
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-ink-100 flex items-center gap-2">
                <Activity size={18} className="text-azure-400" />
                Son 14 Günlük Tempo
              </h2>
              <p className="text-xs text-ink-400 mt-0.5">Son 2 haftadaki günlük aktivite nabzın</p>
            </div>
            <span className="text-xs font-bold bg-ink-950 border border-ink-800 text-azure-400 px-2.5 py-1 rounded-lg">
              Bu Ay: {stats.thisMonthCount}
            </span>
          </div>

          <div className="flex items-end justify-between gap-1.5 h-28 pt-4 px-1">
            {stats.last14Days.map((d) => {
              const hPct = d.count > 0 ? Math.max(18, (d.count / stats.max14DayCount) * 100) : 6;
              return (
                <div
                  key={d.date}
                  title={`${d.label}: ${d.count} izleme`}
                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group"
                >
                  <span className="text-[10px] font-black text-gold-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {d.count}
                  </span>
                  <div
                    className={`w-full rounded-t-md transition-all duration-500 ${
                      d.count > 0
                        ? 'bg-gradient-to-t from-gold-600 to-gold-400 group-hover:brightness-125 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                        : 'bg-ink-800/70'
                    }`}
                    style={{ height: `${hPct}%` }}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex justify-between text-[10px] font-semibold text-ink-500 border-t border-ink-800/60 pt-2 mt-2">
            <span>{stats.last14Days[0]?.label}</span>
            <span>Bugün ({stats.last14Days[stats.last14Days.length - 1]?.count || 0} izleme)</span>
          </div>
        </div>
      </div>

      {/* =========================================================
          4. DEĞERLENDİRME BAŞLIKLARI ANALİZİ (🔥 Başyapıt, 🎭 Oyunculuk Muazzam vb.)
          ========================================================= */}
      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h2 className="text-lg font-bold text-ink-100 flex items-center gap-2">
              <Tag size={20} className="text-gold-400" />
              Değerlendirme Başlıkları İstatistikleri
            </h2>
            <p className="text-xs text-ink-400 mt-0.5">
              Puanlama sırasında seçtiğin başlıkların kullanım sıklığı ve o başlıklara verdiğin ortalama puanlar
            </p>
          </div>
          {stats.totalTaggedItems > 0 && (
            <span className="text-xs font-bold bg-gold-500/15 text-gold-300 border border-gold-500/30 px-3 py-1 rounded-full">
              {stats.totalTaggedItems} Yapımda Başlık Seçildi
            </span>
          )}
        </div>

        {stats.reviewTagStats.length === 0 ? (
          <div className="text-center py-8 bg-ink-950/40 rounded-xl border border-ink-800/60">
            <p className="text-xs text-ink-400 px-4">
              Henüz hiçbir yapımda değerlendirme başlığı seçilmemiş. Film veya dizi puanlarken <strong>"🔥 Başyapıt, 🎭 Oyunculuk Muazzam"</strong> gibi başlıkları seçtiğinde istatistikleri burada oluşacak!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.reviewTagStats.map((item) => {
              const widthPct = Math.max(10, (item.count / stats.maxReviewTagCount) * 100);
              return (
                <div
                  key={item.tag}
                  className="bg-ink-950/75 border border-ink-800/80 hover:border-gold-500/40 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-black text-ink-100 truncate">
                      {item.tag}
                    </span>
                    {item.avg > 0 && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md font-black flex-shrink-0 ${ratingBgClass(
                          item.avg
                        )}`}
                        title="Bu başlığı verdiğin yapımların ortalama puanı"
                      >
                        Ort: {item.avg.toFixed(1)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="h-2 w-full bg-ink-900 rounded-full overflow-hidden border border-ink-800">
                      <div
                        className="h-full bg-gradient-to-r from-gold-500 to-amber-400 rounded-full transition-all duration-700"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-ink-400">
                      <span>Kullanım Sayısı</span>
                      <span className="text-gold-400">{item.count} Kez Seçildi</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================
          5. SINEVIA REKORLAR KİTABI & DÜNYA SİNEMASI PASAPORTU
          ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl space-y-3.5">
          <div>
            <h2 className="text-lg font-bold text-ink-100 flex items-center gap-2">
              <Trophy size={20} className="text-gold-400" />
              Sinevia Rekorlar Kitabı
            </h2>
            <p className="text-xs text-ink-400 mt-0.5">Kütüphanendeki en dikkat çekici kişisel rekorların</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-ink-950/70 border border-ink-800/80 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-gold-400 uppercase">
                <Flame size={13} /> En Yoğun Maraton Günü
              </div>
              <div className="text-lg font-black text-ink-50 mt-1">
                {stats.busiestDay.count > 0 ? `${stats.busiestDay.count} Yapım / Gün` : 'Henüz Yok'}
              </div>
              <div className="text-[11px] text-ink-400 mt-0.5 truncate">{stats.busiestDay.date}</div>
            </div>

            <div className="bg-ink-950/70 border border-ink-800/80 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-orange-400 uppercase">
                <Zap size={13} /> En Uzun Seri Rekoru
              </div>
              <div className="text-lg font-black text-ink-50 mt-1">{stats.maxStreakEver} Gün Aralıksız</div>
              <div className="text-[11px] text-ink-400 mt-0.5">
                Şu anki aktif seri: {data.dailyStreak} gün
              </div>
            </div>

            <div className="bg-ink-950/70 border border-ink-800/80 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-azure-400 uppercase">
                <Clock size={13} /> İzlenen En Uzun Film
              </div>
              <div className="text-sm font-black text-ink-50 mt-1 truncate">
                {stats.longestMovie ? stats.longestMovie.title : 'Veri Yok'}
              </div>
              <div className="text-[11px] text-ink-400 mt-0.5">
                {stats.longestMovie ? `${stats.longestMovie.runtime} Dakika` : '-'}
              </div>
            </div>

            <div className="bg-ink-950/70 border border-ink-800/80 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-violet-400 uppercase">
                <Tv size={13} /> En Çok Bölüm İzlenen Dizi
              </div>
              <div className="text-sm font-black text-ink-50 mt-1 truncate">
                {stats.mostWatchedSeries ? stats.mostWatchedSeries.title : 'Veri Yok'}
              </div>
              <div className="text-[11px] text-ink-400 mt-0.5">
                {stats.mostWatchedSeries ? `Tam ${stats.mostWatchedSeries.count} Bölüm İzlendi` : '-'}
              </div>
            </div>
          </div>

          <div className="bg-ink-950/50 border border-ink-800/60 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <StickyNote size={16} className="text-emerald-400" />
              <span className="text-xs font-bold text-ink-200">Eleştirmen Kalemi & Günlük Notların</span>
            </div>
            <span className="text-xs font-black text-emerald-400">
              {stats.notesCount} İnceleme ({stats.totalNoteWords} Kelime)
            </span>
          </div>
        </div>

        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink-100 flex items-center gap-2">
              <Globe size={20} className="text-azure-400" />
              Dünya Sineması Pasaportu
            </h2>
            <p className="text-xs text-ink-400 mt-0.5 mb-4">
              İzlediğin yapımların orijinal dillerine ve ülke sinemalarına göre dağılımı
            </p>

            {stats.topLanguages.length === 0 ? (
              <div className="text-center py-8 bg-ink-950/40 rounded-xl border border-ink-800/60">
                <p className="text-xs text-ink-400 px-4">
                  Dil/Ülke verisi bulunamadı. Filmler veya Diziler sayfasındaki <strong>"Eksikleri Bul"</strong> butonuna tıklayarak TMDB verilerini senkronize edebilirsin.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {stats.topLanguages.map((lang) => (
                  <div
                    key={lang.code}
                    className="bg-ink-950/70 border border-ink-800/80 rounded-xl p-3 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl flex-shrink-0">{lang.flag}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-ink-100 truncate">{lang.name}</div>
                        <div className="text-[10px] text-ink-400 font-semibold">
                          {lang.count} Yapım İzlendi
                        </div>
                      </div>
                    </div>
                    {lang.avg > 0 && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md font-black flex-shrink-0 ${ratingBgClass(
                          lang.avg
                        )}`}
                      >
                        {lang.avg.toFixed(1)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================
          6. YILDIZLAR GEÇİDİ: FAVORİ YÖNETMENLER, OYUNCULAR & STÜDYOLAR
          ========================================================= */}
      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-ink-100 flex items-center gap-2">
              <Crown size={20} className="text-gold-400" />
              Yıldızlar Geçidi (Kişiler & Stüdyolar)
            </h2>
            <p className="text-xs text-ink-400 mt-0.5">
              İzlediğin yapımların künyelerine göre en çok tercih ettiğin isimler ve ortalama puanların
            </p>
          </div>

          <div className="flex bg-ink-950 rounded-xl p-1 border border-ink-800 w-fit">
            <button
              type="button"
              onClick={() => setPeopleTab('directors')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                peopleTab === 'directors'
                  ? 'bg-gold-500 text-ink-950 shadow-sm'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              <User size={13} /> Yönetmenler
            </button>
            <button
              type="button"
              onClick={() => setPeopleTab('cast')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                peopleTab === 'cast'
                  ? 'bg-gold-500 text-ink-950 shadow-sm'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              <Users size={13} /> Oyuncular
            </button>
            <button
              type="button"
              onClick={() => setPeopleTab('studios')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                peopleTab === 'studios'
                  ? 'bg-gold-500 text-ink-950 shadow-sm'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              <Building2 size={13} /> Stüdyolar
            </button>
          </div>
        </div>

        {(() => {
          const activeList =
            peopleTab === 'directors'
              ? stats.topDirectors
              : peopleTab === 'cast'
              ? stats.topCast
              : stats.topStudios;

          if (activeList.length === 0) {
            return (
              <div className="text-center py-8 bg-ink-950/40 rounded-xl border border-ink-800/60">
                <p className="text-xs text-ink-400">
                  Henüz künye verisi bulunamadı. Filmler veya Diziler sayfasındaki <strong>"Eksikleri Bul"</strong> butonuna basarak TMDB yönetmen/oyuncu verilerini çekebilirsin.
                </p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeList.map((item, idx) => (
                <div
                  key={item.name}
                  className="bg-ink-950/70 border border-ink-800/80 hover:border-gold-500/40 rounded-xl p-3.5 flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0 ${
                        idx === 0
                          ? 'bg-gold-500 text-ink-950 shadow-md'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-900'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-ink-800 text-ink-300 border border-ink-700'
                      }`}
                    >
                      #{idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-ink-100 truncate">{item.name}</div>
                      <div className="text-[11px] text-ink-400 font-medium">
                        {item.count} Yapım İzlendi
                      </div>
                    </div>
                  </div>

                  {item.avg > 0 && (
                    <span
                      className={`text-xs px-2.5 py-1 rounded-lg font-black flex-shrink-0 ${ratingBgClass(
                        item.avg
                      )}`}
                    >
                      {item.avg.toFixed(1)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* =========================================================
          7. ŞEREF KÜRSÜSÜ (POSTERLİ EN YÜKSEK PUANLI YAPIMLAR)
          ========================================================= */}
      {stats.topRated.length > 0 && (
        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-ink-100 flex items-center gap-2">
                <Star size={20} className="text-gold-400 fill-current" />
                Şeref Kürsüsü (En Yüksek Puanlı Yapımların)
              </h2>
              <p className="text-xs text-ink-400 mt-0.5">
                Detaylarını ve inceleme notlarını görmek için posterlere tıklayabilirsin
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
            {stats.topRated.map((h, i) => {
              const isMovie = h.kind === 'movie' || h.type === 'movie';
              const poster = isMovie
                ? data.movies.find((m) => m.id === (h.itemId || h.id))?.posterUrl
                : data.series.find((s) => s.id === (h.seriesId || h.itemId || h.id))?.posterUrl;

              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => openHistoryItemDetail(h)}
                  className="group relative flex flex-col text-left bg-ink-950/70 border border-ink-800 hover:border-gold-500/50 rounded-2xl overflow-hidden shadow-lg transition-all hover:-translate-y-1 cursor-pointer"
                >
                  <div className="aspect-[2/3] w-full bg-ink-900 relative overflow-hidden">
                    {poster ? (
                      <img
                        src={poster}
                        alt={h.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ink-600">
                        {isMovie ? <Film size={28} /> : <Tv size={28} />}
                      </div>
                    )}

                    <div className="absolute top-2 left-2 w-6 h-6 rounded-lg bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center text-[11px] font-black text-gold-400">
                      #{i + 1}
                    </div>

                    {h.rating !== null && (
                      <div
                        className={`absolute top-2 right-2 px-2 py-0.5 rounded-lg text-xs font-black shadow-md ${ratingBgClass(
                          h.rating
                        )}`}
                      >
                        {h.rating}
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                      <Eye size={18} className="text-gold-400" />
                      <span className="text-[10px] font-black text-white uppercase">Sinema Kartı</span>
                    </div>
                  </div>

                  <div className="p-2.5">
                    <div className="text-xs font-bold text-ink-100 truncate group-hover:text-gold-400 transition-colors">
                      {h.title}
                    </div>
                    <div className="text-[10px] text-ink-400 mt-0.5 truncate">
                      {h.season != null ? `${h.season}. Sezon ${h.episode}. Bölüm` : h.year || 'Film'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================
          8. DETAYLI KRİTER KARNESİ & DÖNEM (ON YIL) ANALİZİ
          ========================================================= */}
      {(stats.criteriaAverages.length > 0 || stats.decades.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
            <h2 className="text-lg font-bold text-ink-100 mb-1 flex items-center gap-2">
              <SlidersHorizontal size={20} className="text-azure-400" />
              Detaylı Kriter Karnesi
            </h2>
            <p className="text-xs text-ink-400 mb-4">
              Alt kriterlerde verdiğin ortalama puanların dağılımı
            </p>

            {stats.criteriaAverages.length === 0 ? (
              <p className="text-xs text-ink-500 py-6 text-center">
                Henüz detaylı kriter puanlaması yapılmamış.
              </p>
            ) : (
              <div className="space-y-3.5">
                {stats.criteriaAverages.map((crit) => {
                  const pct = Math.min(100, Math.max(5, (crit.avg / 10) * 100));
                  return (
                    <div key={crit.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-ink-100 flex items-center gap-1.5">
                          {crit.name}
                          <span className="text-[10px] text-ink-500 font-normal">
                            ({crit.count} yapım)
                          </span>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-black text-[11px] ${ratingBgClass(
                            crit.avg
                          )}`}
                        >
                          {crit.avg.toFixed(1)} / 10
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-ink-950 rounded-full overflow-hidden border border-ink-800">
                        <div
                          className="h-full bg-gradient-to-r from-gold-500 to-azure-500 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
            <h2 className="text-lg font-bold text-ink-100 mb-1 flex items-center gap-2">
              <Compass size={20} className="text-gold-400" />
              Dönemlere Göre Tercihlerin
            </h2>
            <p className="text-xs text-ink-400 mb-4">
              İzlediğin filmlerin çıkış yaptıkları on yıllara göre dağılımı
            </p>

            {stats.decades.length === 0 ? (
              <p className="text-xs text-ink-500 py-6 text-center">Henüz yeterli yıl verisi yok.</p>
            ) : (
              <div className="space-y-3">
                {stats.decades.map((d) => {
                  const pct = Math.max(10, (d.count / stats.maxDecadeCount) * 100);
                  return (
                    <div key={d.decade} className="flex items-center gap-3">
                      <div className="w-16 text-xs font-black text-ink-200 flex-shrink-0">
                        {d.decade}
                      </div>
                      <div className="flex-1 h-6 bg-ink-950 rounded-lg overflow-hidden border border-ink-800/80">
                        <div
                          className="h-full bg-gradient-to-r from-gold-500 to-amber-500 rounded-lg flex items-center justify-end pr-2 text-[11px] font-black text-ink-950 transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        >
                          {d.count}
                        </div>
                      </div>
                      {d.avg > 0 && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-bold w-10 text-center flex-shrink-0 ${ratingBgClass(
                            d.avg
                          )}`}
                        >
                          {d.avg.toFixed(1)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          9. EN SEVDİĞİN TÜRLER
          ========================================================= */}
      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-ink-100 mb-4 flex items-center gap-2">
          <Layers size={20} className="text-teal-400" />
          En Sevdiğin Türler
        </h2>
        {genreAllSorted.length === 0 ? (
          <p className="text-sm text-ink-500">Henüz veri yok.</p>
        ) : (
          <div className="space-y-3">
            {genreAllSorted.slice(0, 10).map(([genre, val], i) => {
              const avg = val.ratedCount > 0 ? val.totalRating / val.ratedCount : 0;
              const colorClass = genreColors[i % genreColors.length];
              return (
                <div key={genre} className="flex items-center gap-3">
                  <div className="w-24 text-sm font-medium text-ink-300 flex-shrink-0 truncate">
                    {genre}
                  </div>
                  <div className="flex-1 h-7 bg-ink-800/60 rounded-lg overflow-hidden relative group">
                    <div
                      className={`h-full bg-gradient-to-r ${colorClass} rounded-lg flex items-center justify-end pr-2.5 transition-all duration-700 ease-out`}
                      style={{ width: `${Math.max(8, (val.count / maxGenreCount) * 100)}%` }}
                    >
                      <span className="text-xs text-white font-bold drop-shadow">{val.count}</span>
                    </div>
                  </div>
                  {avg > 0 && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold flex-shrink-0 w-10 text-center ${ratingBgClass(
                        avg
                      )}`}
                    >
                      {avg.toFixed(1)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-semibold text-ink-300 mb-3 flex items-center gap-2">
            <Film size={16} className="text-teal-400" /> Film Türleri
          </h3>
          {Array.from(stats.genreMovieMap.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([genre, val]) => {
              const avg = val.ratedCount > 0 ? val.totalRating / val.ratedCount : 0;
              return (
                <div
                  key={genre}
                  className="flex items-center justify-between py-2 text-sm border-b border-ink-800/50 last:border-0"
                >
                  <span className="text-ink-300 font-medium">{genre}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-ink-500 text-xs font-semibold">{val.count} Adet</span>
                    {avg > 0 && (
                      <span
                        className={`text-xs w-8 text-center py-0.5 rounded font-bold ${ratingBgClass(
                          avg
                        )}`}
                      >
                        {avg.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          {stats.genreMovieMap.size === 0 && <p className="text-sm text-ink-500">Henüz veri yok.</p>}
        </div>

        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-semibold text-ink-300 mb-3 flex items-center gap-2">
            <Tv size={16} className="text-cyan-400" /> Dizi Türleri
          </h3>
          {Array.from(stats.genreSeriesMap.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([genre, val]) => {
              const avg = val.ratedCount > 0 ? val.totalRating / val.ratedCount : 0;
              return (
                <div
                  key={genre}
                  className="flex items-center justify-between py-2 text-sm border-b border-ink-800/50 last:border-0"
                >
                  <span className="text-ink-300 font-medium">{genre}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-ink-500 text-xs font-semibold">{val.count} Dizi</span>
                    {avg > 0 && (
                      <span
                        className={`text-xs w-8 text-center py-0.5 rounded font-bold ${ratingBgClass(
                          avg
                        )}`}
                      >
                        {avg.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          {stats.genreSeriesMap.size === 0 && <p className="text-sm text-ink-500">Henüz veri yok.</p>}
        </div>
      </div>

      {/* =========================================================
          10. AYLIK İZLEME, HAFTANIN GÜNLERİ & PUAN DAĞILIMI
          ========================================================= */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <h2 className="text-base font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-cyan-400" />
            Aylık İzleme
          </h2>
          {stats.monthly.length === 0 ? (
            <p className="text-sm text-ink-500">Henüz veri yok.</p>
          ) : (
            <>
              <div className="flex items-end justify-between gap-3 h-40 mb-3">
                {stats.monthly.map(([month, val]) => {
                  const [y, m] = month.split('-');
                  const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString(
                    'tr-TR',
                    { month: 'short' }
                  );
                  const heightPct = (val.total / stats.maxMonthly) * 100;
                  const moviePct = val.total > 0 ? (val.movies / val.total) * 100 : 0;
                  return (
                    <div key={month} className="flex flex-col items-center gap-2 flex-1 group">
                      <div className="text-xs text-ink-300 font-bold">{val.total}</div>
                      <div
                        className="w-full max-w-[2rem] flex flex-col-reverse rounded-t-lg overflow-hidden transition-all duration-700 hover:brightness-110"
                        style={{ height: `${Math.max(heightPct, 6)}%` }}
                      >
                        <div
                          className="bg-gradient-to-t from-teal-600 to-teal-400 transition-all duration-700"
                          style={{ height: `${moviePct}%` }}
                        />
                        <div
                          className="bg-gradient-to-t from-cyan-600 to-cyan-400 transition-all duration-700"
                          style={{ height: `${100 - moviePct}%` }}
                        />
                      </div>
                      <div className="text-xs text-ink-500 font-medium">{monthName}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-5 text-xs text-ink-400 border-t border-ink-800/50 pt-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-teal-500" /> Film
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-cyan-500" /> Dizi
                </span>
              </div>
            </>
          )}
        </div>

        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <h2 className="text-base font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-violet-400" />
            Haftalık Yoğunluk
          </h2>
          {data.history.length === 0 ? (
            <p className="text-sm text-ink-500">Henüz veri yok.</p>
          ) : (
            <div className="flex flex-1 items-end justify-between gap-2 h-44 pt-4">
              {stats.dayOfWeekMap.map((count, i) => (
                <div key={i} className="flex flex-col items-center gap-2 flex-1 group h-full justify-end">
                  <div className="text-xs text-ink-300 font-bold">{count}</div>
                  <div
                    className="w-full max-w-[2rem] bg-gradient-to-t from-violet-600 to-fuchsia-400 rounded-t-md transition-all duration-700 hover:brightness-110"
                    style={{
                      height: `${(count / stats.maxDayOfWeek) * 80}%`,
                      minHeight: count > 0 ? '6px' : '2px',
                    }}
                  />
                  <div className="text-xs text-ink-500 font-medium">{dayNames[i]}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
          <h2 className="text-base font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-amber-400" />
            Puan Dağılımı
          </h2>
          {stats.ratings.length === 0 ? (
            <p className="text-sm text-ink-500">Henüz puan verilmemiş.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {stats.ratings.map(([rating, count]) => {
                const maxCount = Math.max(...stats.ratings.map(([, c]) => c));
                return (
                  <div key={rating} className="flex items-center gap-2.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold flex-shrink-0 w-10 text-center ${ratingBgClass(
                        rating
                      )}`}
                    >
                      {rating}
                    </span>
                    <div className="flex-1 h-4 bg-ink-800/60 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded transition-all duration-700"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-ink-300 w-7 text-right font-bold">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================
          11. KOLEKSİYON İLERLEMESİ
          ========================================================= */}
      {stats.collectionStats.length > 0 && (
        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl">
          <h2 className="text-lg font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <Layers size={20} className="text-cyan-400" />
            Koleksiyon İlerlemesi
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {stats.collectionStats.map((c) => (
              <div key={c.name} className="bg-ink-800/40 border border-ink-700/30 p-4 rounded-xl">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-ink-200 font-bold truncate pr-2">{c.name}</span>
                  <span className="text-ink-400 font-semibold flex-shrink-0">
                    {c.watched} / {c.total} (%{Math.round(c.progress)})
                  </span>
                </div>
                <div className="h-2.5 bg-ink-950 rounded-full overflow-hidden shadow-inner border border-ink-800">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full transition-all duration-700 relative"
                    style={{ width: `${c.progress}%` }}
                  >
                    {c.progress === 100 && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SİNEMA KARTI MODALI */}
      {detailTarget && (
        <MediaDetailModal target={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  );
}