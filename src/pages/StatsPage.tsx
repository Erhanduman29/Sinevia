import { useMemo } from 'react';
import { BarChart3, Film, Tv, Star, TrendingUp, Calendar, Award, Clock, Flame, Target, Clapperboard, Layers, Hourglass, Activity } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass } from '../lib/utils';

export default function StatsPage() {
  const { data } = useApp();

  const stats = useMemo(() => {
    const movieHistory = data.history.filter((h) => h.kind === 'movie');
    const seriesHistory = data.history.filter((h) => h.kind === 'series');

    const genreMovieMap = new Map<string, { count: number; totalRating: number; ratedCount: number }>();
    const genreSeriesMap = new Map<string, { count: number; totalRating: number; ratedCount: number }>();
    const genreAllMap = new Map<string, { count: number; totalRating: number; ratedCount: number }>();

    movieHistory.forEach((h) => {
      h.genres.forEach((g) => {
        const m = genreMovieMap.get(g) || { count: 0, totalRating: 0, ratedCount: 0 };
        m.count++;
        if (h.rating !== null) { m.totalRating += h.rating; m.ratedCount++; }
        genreMovieMap.set(g, m);
      });
    });

    const seenSeries = new Set<string>();
    seriesHistory.forEach((h) => {
      if (h.seriesId && seenSeries.has(h.seriesId)) return;
      if (h.seriesId) seenSeries.add(h.seriesId);
      h.genres.forEach((g) => {
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
      genreAllMap.set(g, {
        count: movie.count + series.count,
        totalRating: movie.totalRating + series.totalRating,
        ratedCount: movie.ratedCount + series.ratedCount,
      });
    });

    // Monthly chart
    const monthlyMap = new Map<string, { movies: number; series: number; total: number }>();
    data.history.forEach((h) => {
      const d = new Date(h.watchedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthlyMap.get(key) || { movies: 0, series: 0, total: 0 };
      entry.total++;
      if (h.kind === 'movie') entry.movies++;
      else entry.series++;
      monthlyMap.set(key, entry);
    });
    const monthly = Array.from(monthlyMap.entries()).sort().slice(-6);
    const maxMonthly = Math.max(...monthly.map(([, v]) => v.total), 1);

    // Rating distribution
    const ratingDist = new Map<number, number>();
    data.history.forEach((h) => {
      if (h.rating !== null) ratingDist.set(h.rating, (ratingDist.get(h.rating) || 0) + 1);
    });
    const ratings = Array.from(ratingDist.entries()).sort((a, b) => a[0] - b[0]);

    // Averages
    const ratedMovies = movieHistory.filter((h) => h.rating !== null);
    const ratedSeries = seriesHistory.filter((h) => h.rating !== null);
    const avgMovie = ratedMovies.length > 0 ? ratedMovies.reduce((s, h) => s + (h.rating || 0), 0) / ratedMovies.length : 0;
    const avgSeries = ratedSeries.length > 0 ? ratedSeries.reduce((s, h) => s + (h.rating || 0), 0) / ratedSeries.length : 0;
    const avgAll = data.history.filter((h) => h.rating !== null);
    const avgTotal = avgAll.length > 0 ? avgAll.reduce((s, h) => s + (h.rating || 0), 0) / avgAll.length : 0;

    // YENİ: İzleyici Kimliği (Puanlama Karnesi)
    let ratingPersona = { label: "Yeni Başlayan", color: "text-ink-400" };
    if (avgAll.length > 0) {
      if (avgTotal >= 8.5) ratingPersona = { label: "Çok Cömert 💖", color: "text-emerald-400" };
      else if (avgTotal >= 7.0) ratingPersona = { label: "Pozitif İzleyici 😊", color: "text-teal-400" };
      else if (avgTotal >= 5.0) ratingPersona = { label: "Dengeli Eleştirmen ⚖️", color: "text-amber-400" };
      else ratingPersona = { label: "Acımasız Yargıç 💀", color: "text-red-400" };
    }

    // Top rated
    const topRated = [...data.history].filter((h) => h.rating !== null).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);

    // Collection stats
    const collectionStats = data.collections.map((c) => {
      const movies = data.movies.filter((m) => m.collectionId === c.id);
      const watched = movies.filter((m) => m.watched).length;
      return { name: c.name, total: movies.length, watched, progress: movies.length > 0 ? (watched / movies.length) * 100 : 0 };
    });

    // Day of week stats
    const dayOfWeekMap = new Array(7).fill(0);
    data.history.forEach((h) => {
      const d = new Date(h.watchedAt).getDay();
      dayOfWeekMap[d]++;
    });
    const maxDayOfWeek = Math.max(...dayOfWeekMap, 1);

    // Unique series count
    const uniqueSeries = new Set(seriesHistory.map((h) => h.seriesId).filter(Boolean)).size;

    // This month count
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthCount = data.history.filter((h) => {
      const d = new Date(h.watchedAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === thisMonthKey;
    }).length;

    // Watchlist remaining
    const remainingMovies = data.movies.filter((m) => !m.watched).length;
    const remainingEpisodes = data.series.flatMap((s) => s.episodes.filter((e) => !e.watched)).length;

    // YENİ: Toplam İzleme Süresi (Sadece Filmler)
    const watchedMoviesWithRuntime = data.movies.filter(m => m.watched && m.runtime);
    const totalRuntimeMinutes = watchedMoviesWithRuntime.reduce((sum, m) => sum + (m.runtime || 0), 0);
    const runtimeDays = Math.floor(totalRuntimeMinutes / (24 * 60));
    const runtimeHours = Math.floor((totalRuntimeMinutes % (24 * 60)) / 60);
    const runtimeMins = totalRuntimeMinutes % 60;

    return {
      genreMovieMap, genreSeriesMap, genreAllMap,
      monthly, maxMonthly,
      ratings,
      avgMovie, avgSeries, avgTotal, ratingPersona,
      topRated,
      movieCount: movieHistory.length,
      seriesCount: seriesHistory.length,
      uniqueSeriesCount: uniqueSeries,
      collectionStats,
      dayOfWeekMap, maxDayOfWeek,
      thisMonthCount,
      remainingMovies, remainingEpisodes,
      totalRuntimeMinutes, runtimeDays, runtimeHours, runtimeMins
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink-100 flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-500/30 flex items-center justify-center">
          <BarChart3 size={22} className="text-teal-300" />
        </div>
        İstatistikler
      </h1>

      {/* YENİ: Toplam Zaman Çizelgesi Banner'ı */}
      {stats.totalRuntimeMinutes > 0 && (
        <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border border-indigo-700/50 rounded-2xl p-6 shadow-xl relative overflow-hidden animate-fade-in">
          <div className="absolute -right-6 -top-10 text-indigo-500/10 transform rotate-12">
            <Hourglass size={200} />
          </div>
          <div className="relative z-10">
            <h2 className="text-sm font-semibold text-indigo-300 mb-3 flex items-center gap-2">
              <Clock size={18} /> Sinemaya Adanan Zaman
            </h2>
            <div className="flex items-baseline gap-3 flex-wrap">
              {stats.runtimeDays > 0 && (
                <span className="text-4xl md:text-5xl font-extrabold text-white drop-shadow-md">
                  {stats.runtimeDays} <span className="text-lg md:text-xl font-medium text-indigo-200">Gün</span>
                </span>
              )}
              {(stats.runtimeDays > 0 || stats.runtimeHours > 0) && (
                <span className="text-4xl md:text-5xl font-extrabold text-white drop-shadow-md">
                  {stats.runtimeHours} <span className="text-lg md:text-xl font-medium text-indigo-200">Saat</span>
                </span>
              )}
              <span className="text-4xl md:text-5xl font-extrabold text-white drop-shadow-md">
                {stats.runtimeMins} <span className="text-lg md:text-xl font-medium text-indigo-200">Dk</span>
              </span>
            </div>
            <p className="text-xs text-indigo-300/80 mt-3 flex items-center gap-1.5">
              <Activity size={12} /> Toplam {stats.totalRuntimeMinutes.toLocaleString('tr-TR')} dakika film izleme süresi kayıt altına alındı.
            </p>
          </div>
        </div>
      )}

      {/* Summary cards - colorful */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-teal-900/30 to-ink-900 border border-teal-700/30 rounded-2xl p-4 shadow-lg shadow-teal-950/20">
          <Film size={20} className="text-teal-400 mb-2" />
          <div className="text-3xl font-bold text-ink-100">{stats.movieCount}</div>
          <div className="text-xs text-ink-400">İzlenen Film</div>
        </div>
        <div className="bg-gradient-to-br from-cyan-900/30 to-ink-900 border border-cyan-700/30 rounded-2xl p-4 shadow-lg shadow-cyan-950/20">
          <Tv size={20} className="text-cyan-400 mb-2" />
          <div className="text-3xl font-bold text-ink-100">{stats.seriesCount}</div>
          <div className="text-xs text-ink-400">İzlenen Bölüm</div>
        </div>
        <div className="bg-gradient-to-br from-amber-900/30 to-ink-900 border border-amber-700/30 rounded-2xl p-4 shadow-lg shadow-amber-950/20 relative overflow-hidden">
          <Star size={20} className="text-amber-400 mb-2 relative z-10" />
          <div className="text-3xl font-bold text-ink-100 relative z-10">{stats.avgTotal.toFixed(1)}</div>
          <div className="text-xs text-ink-400 relative z-10">Ortalama Puan</div>
          {/* YENİ: Puanlama Karnesi Etiketi */}
          <div className="mt-2 text-[10px] font-bold tracking-wide uppercase">
            Kimlik: <span className={stats.ratingPersona.color}>{stats.ratingPersona.label}</span>
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-900/30 to-ink-900 border border-emerald-700/30 rounded-2xl p-4 shadow-lg shadow-emerald-950/20">
          <Award size={20} className="text-emerald-400 mb-2" />
          <div className="text-3xl font-bold text-ink-100">
            {data.achievements.reduce((s, a) => s + a.unlockedTiers.length, 0)}
          </div>
          <div className="text-xs text-ink-400">Rozet & Başarım</div>
        </div>
      </div>

      {/* Extra stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-ink-900/60 border border-ink-700/50 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold-500/15 flex items-center justify-center flex-shrink-0">
            <Flame size={18} className="text-gold-400" />
          </div>
          <div>
            <div className="text-lg font-bold text-ink-100">{data.dailyStreak}</div>
            <div className="text-xs text-ink-500">Günlük Seri</div>
          </div>
        </div>
        <div className="bg-ink-900/60 border border-ink-700/50 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <Clock size={18} className="text-blue-400" />
          </div>
          <div>
            <div className="text-lg font-bold text-ink-100">{stats.thisMonthCount}</div>
            <div className="text-xs text-ink-500">Bu Ay Yapım</div>
          </div>
        </div>
        <div className="bg-ink-900/60 border border-ink-700/50 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0">
            <Clapperboard size={18} className="text-violet-400" />
          </div>
          <div>
            <div className="text-lg font-bold text-ink-100">{stats.uniqueSeriesCount}</div>
            <div className="text-xs text-ink-500">Farklı Dizi</div>
          </div>
        </div>
        <div className="bg-ink-900/60 border border-ink-700/50 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0">
            <Target size={18} className="text-orange-400" />
          </div>
          <div>
            <div className="text-lg font-bold text-ink-100">{stats.remainingMovies + stats.remainingEpisodes}</div>
            <div className="text-xs text-ink-500">Sırada Bekleyen</div>
          </div>
        </div>
      </div>

      {/* Genre stats - combined with colorful bars */}
      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl shadow-ink-950/30">
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
                  <div className="w-24 text-sm font-medium text-ink-300 flex-shrink-0 truncate">{genre}</div>
                  <div className="flex-1 h-7 bg-ink-800/60 rounded-lg overflow-hidden relative group">
                    <div
                      className={`h-full bg-gradient-to-r ${colorClass} rounded-lg flex items-center justify-end pr-2.5 transition-all duration-700 ease-out`}
                      style={{ width: `${Math.max(8, (val.count / maxGenreCount) * 100)}%` }}
                    >
                      <span className="text-xs text-white font-bold drop-shadow">{val.count}</span>
                    </div>
                  </div>
                  {avg > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded font-bold flex-shrink-0 w-10 text-center ${ratingBgClass(avg)}`}>
                      {avg.toFixed(1)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Genre stats - movies vs series */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl shadow-ink-950/30">
          <h3 className="text-sm font-semibold text-ink-300 mb-3 flex items-center gap-2">
            <Film size={16} className="text-teal-400" /> Film Türleri
          </h3>
          {Array.from(stats.genreMovieMap.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([genre, val]) => {
            const avg = val.ratedCount > 0 ? val.totalRating / val.ratedCount : 0;
            return (
              <div key={genre} className="flex items-center justify-between py-2 text-sm border-b border-ink-800/50 last:border-0">
                <span className="text-ink-300 font-medium">{genre}</span>
                <div className="flex items-center gap-3">
                  <span className="text-ink-500 text-xs font-semibold">{val.count} Adet</span>
                  {avg > 0 && (
                    <span className={`text-xs w-8 text-center py-0.5 rounded font-bold ${ratingBgClass(avg)}`}>
                      {avg.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {stats.genreMovieMap.size === 0 && <p className="text-sm text-ink-500">Henüz veri yok.</p>}
        </div>
        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl shadow-ink-950/30">
          <h3 className="text-sm font-semibold text-ink-300 mb-3 flex items-center gap-2">
            <Tv size={16} className="text-cyan-400" /> Dizi Türleri
          </h3>
          {Array.from(stats.genreSeriesMap.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([genre, val]) => {
            const avg = val.ratedCount > 0 ? val.totalRating / val.ratedCount : 0;
            return (
              <div key={genre} className="flex items-center justify-between py-2 text-sm border-b border-ink-800/50 last:border-0">
                <span className="text-ink-300 font-medium">{genre}</span>
                <div className="flex items-center gap-3">
                  <span className="text-ink-500 text-xs font-semibold">{val.count} Bölüm</span>
                  {avg > 0 && (
                    <span className={`text-xs w-8 text-center py-0.5 rounded font-bold ${ratingBgClass(avg)}`}>
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

      <div className="grid md:grid-cols-2 gap-4">
        {/* Monthly chart with stacked bars */}
        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl shadow-ink-950/30">
          <h2 className="text-lg font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-cyan-400" />
            Aylık İzleme
          </h2>
          {stats.monthly.length === 0 ? (
            <p className="text-sm text-ink-500">Henüz veri yok.</p>
          ) : (
            <>
              <div className="flex items-end justify-between gap-3 h-44 mb-3">
                {stats.monthly.map(([month, val]) => {
                  const [y, m] = month.split('-');
                  const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('tr-TR', { month: 'short' });
                  const heightPct = (val.total / stats.maxMonthly) * 100;
                  const moviePct = val.total > 0 ? (val.movies / val.total) * 100 : 0;
                  return (
                    <div key={month} className="flex flex-col items-center gap-2 flex-1 group">
                      <div className="text-xs text-ink-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">{val.total}</div>
                      <div className="w-full max-w-[2rem] flex flex-col-reverse rounded-t-lg overflow-hidden transition-all duration-700 hover:brightness-110" style={{ height: `${Math.max(heightPct, 3)}%` }}>
                        <div className="bg-gradient-to-t from-teal-600 to-teal-400 transition-all duration-700" style={{ height: `${moviePct}%` }} />
                        <div className="bg-gradient-to-t from-cyan-600 to-cyan-400 transition-all duration-700" style={{ height: `${100 - moviePct}%` }} />
                      </div>
                      <div className="text-xs text-ink-500 font-medium">{monthName}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-5 text-xs text-ink-400 border-t border-ink-800/50 pt-3">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-teal-500" /> Film</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-cyan-500" /> Dizi</span>
              </div>
            </>
          )}
        </div>

        {/* Day of week */}
        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl shadow-ink-950/30 flex flex-col">
          <h2 className="text-lg font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-violet-400" />
            Hangi Gün Çok İzliyorsun?
          </h2>
          {data.history.length === 0 ? (
            <p className="text-sm text-ink-500">Henüz veri yok.</p>
          ) : (
            <div className="flex flex-1 items-end justify-between gap-2">
              {stats.dayOfWeekMap.map((count, i) => (
                <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
                  <div className="text-xs text-ink-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">{count}</div>
                  <div
                    className="w-full max-w-[2rem] bg-gradient-to-t from-violet-600 to-fuchsia-400 rounded-t-md transition-all duration-700 hover:brightness-110"
                    style={{ height: `${(count / stats.maxDayOfWeek) * 100}%`, minHeight: count > 0 ? '6px' : '0' }}
                  />
                  <div className="text-xs text-ink-500 font-medium">{dayNames[i]}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Rating distribution */}
        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl shadow-ink-950/30">
          <h2 className="text-lg font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-amber-400" />
            Puan Dağılımı
          </h2>
          {stats.ratings.length === 0 ? (
            <p className="text-sm text-ink-500">Henüz puan verilmemiş.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.ratings.map(([rating, count]) => {
                const maxCount = Math.max(...stats.ratings.map(([, c]) => c));
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold flex-shrink-0 w-10 text-center ${ratingBgClass(rating)}`}>
                      {rating}
                    </span>
                    <div className="flex-1 h-5 bg-ink-800/60 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded transition-all duration-700"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-ink-400 w-8 text-right font-medium">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top rated */}
        {stats.topRated.length > 0 && (
          <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl shadow-ink-950/30">
            <h2 className="text-lg font-semibold text-ink-100 mb-4 flex items-center gap-2">
              <Star size={20} className="text-amber-400" />
              En Yüksek Puanlı Yapımlar
            </h2>
            <div className="space-y-3">
              {stats.topRated.map((h, i) => (
                <div key={h.id} className="flex items-center gap-3 bg-ink-800/40 border border-ink-700/30 rounded-xl px-3 py-2.5 transition-colors hover:bg-ink-800/60">
                  <div className="w-6 h-6 rounded-full bg-ink-900 flex items-center justify-center flex-shrink-0 border border-ink-700">
                    <span className="text-xs font-bold text-ink-400">{i + 1}</span>
                  </div>
                  <span className={`text-sm px-2 py-1 rounded-lg font-bold flex-shrink-0 ${ratingBgClass(h.rating!)}`}>
                    {h.rating}
                  </span>
                  <span className="text-sm font-medium text-ink-100 flex-1 truncate">{h.title}</span>
                  <span className="text-xs text-ink-500 bg-ink-900/50 px-2 py-1 rounded-md flex-shrink-0">
                    {h.kind === 'series' ? `${h.season}x${h.episode}` : h.year || 'Film'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Collection progress */}
      {stats.collectionStats.length > 0 && (
        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-5 shadow-xl shadow-ink-950/30">
          <h2 className="text-lg font-semibold text-ink-100 mb-4 flex items-center gap-2">
            <Layers size={20} className="text-cyan-400" />
            Koleksiyon İlerlemesi
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {stats.collectionStats.map((c) => (
              <div key={c.name} className="bg-ink-800/40 border border-ink-700/30 p-4 rounded-xl">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-ink-200 font-medium truncate pr-2">{c.name}</span>
                  <span className="text-ink-400 font-semibold flex-shrink-0">{c.watched} / {c.total}</span>
                </div>
                <div className="h-2.5 bg-ink-900 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full transition-all duration-700 relative"
                    style={{ width: `${c.progress}%` }}
                  >
                    {c.progress === 100 && (
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}