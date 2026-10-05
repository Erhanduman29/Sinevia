import { useState, useMemo } from 'react';
import {
  BarChart3, Film, Tv, Star, TrendingUp, Calendar, Award, Clock, Flame, Layers,
  Hourglass, Activity, User, Users, Building2, Crown, Sparkles,
  Eye, Compass, Sun, Sunset, Moon, Coffee, Globe, Trophy, StickyNote, Zap, Tag, Gauge, FastForward, History, Hexagon
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass } from '../lib/utils';
import MediaDetailModal from '../components/MediaDetailModal';
import WrappedModal from '../components/WrappedModal';
import type { DetailModalTarget } from '../components/MediaDetailModal';
import type { WatchHistoryItem } from '../types';

// YENİ: ZEKİ MOTORUMUZU ÇAĞIRIYORUZ
import { calculateStats, StatsScopeMode } from '../lib/statsLogic';

function RadarChart({ data, maxScore = 10 }: { data: { name: string; score: number }[]; maxScore?: number }) {
  if (data.length < 3) {
    return <div className="text-center text-xs text-ink-500 py-8">Radar analizi için en az 3 farklı kritere detaylı puan vermiş olmalısın.</div>;
  }

  const size = 200;
  const center = size / 2;
  const radius = size / 2 - 30; 
  
  const angleSlice = (Math.PI * 2) / data.length;

  const getPoint = (value: number, index: number) => {
    const r = (value / maxScore) * radius;
    const theta = index * angleSlice - Math.PI / 2;
    return {
      x: center + r * Math.cos(theta),
      y: center + r * Math.sin(theta)
    };
  };

  const dataPoints = data.map((d, i) => getPoint(d.score, i));
  const polygonPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ') + ' Z';

  return (
    <div className="relative w-full max-w-[280px] mx-auto aspect-square flex items-center justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full overflow-visible drop-shadow-lg">
        {[0.2, 0.4, 0.6, 0.8, 1].map((level) => {
          const points = data.map((_, i) => getPoint(maxScore * level, i));
          const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ') + ' Z';
          return <path key={level} d={path} fill="none" stroke="currentColor" className="text-ink-700/50" strokeWidth="1" />;
        })}

        {data.map((_, i) => {
          const p = getPoint(maxScore, i);
          return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="currentColor" className="text-ink-700/50" strokeWidth="1" />;
        })}

        <path d={polygonPath} fill="currentColor" className="text-azure-500/30 transition-all duration-1000 ease-out" />
        <path d={polygonPath} fill="none" stroke="currentColor" className="text-azure-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]" strokeWidth="2" strokeLinejoin="round" />

        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="currentColor" className="text-white" />
        ))}

        {data.map((d, i) => {
          const p = getPoint(maxScore + 1.8, i);
          let anchor = 'middle';
          if (p.x < center - 10) anchor = 'end';
          if (p.x > center + 10) anchor = 'start';
          return (
            <text key={i} x={p.x} y={p.y} textAnchor={anchor} dominantBaseline="middle" className="text-[9px] font-black fill-ink-200">
              {d.name.substring(0, 12)}{d.name.length > 12 ? '..' : ''} <tspan className="fill-gold-400">({d.score.toFixed(1)})</tspan>
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function ActivityHeatmap({ history }: { history: WatchHistoryItem[] }) {
  const daysInYear = 364;
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - daysInYear);

  const daysArray = Array.from({ length: daysInYear + 1 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return d;
  });

  const watchMap = new Map<string, number>();
  history.forEach(h => {
    if(!h.watchedAt) return;
    const d = new Date(h.watchedAt).toISOString().split('T')[0];
    watchMap.set(d, (watchMap.get(d) || 0) + 1);
  });

  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-ink-900 border-ink-800';
    if (count === 1) return 'bg-emerald-900/60 border-emerald-800/50';
    if (count <= 3) return 'bg-emerald-600/80 border-emerald-500';
    if (count <= 5) return 'bg-emerald-400 border-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]';
    return 'bg-gold-400 border-gold-300 shadow-[0_0_15px_rgba(250,204,21,0.8)]';
  };

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];
  
  const firstDayOfWeek = daysArray[0].getDay();
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push(null);
  }

  daysArray.forEach((date) => {
    currentWeek.push(date);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return (
    <div className="overflow-x-auto custom-scrollbar pb-2 pt-1">
      <div className="flex gap-1 min-w-max">
        {weeks.map((week, wIndex) => (
          <div key={wIndex} className="flex flex-col gap-1">
            {week.map((date, dIndex) => {
              if (!date) return <div key={`empty-${dIndex}`} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />;
              const dateStr = date.toISOString().split('T')[0];
              const count = watchMap.get(dateStr) || 0;
              const title = `${date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}: ${count} Yapım İzlendi`;

              return (
                <div
                  key={dateStr}
                  title={title}
                  className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[3px] border transition-colors cursor-help hover:scale-125 hover:z-10 ${getHeatmapColor(count)}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-3 text-[9px] sm:text-[10px] text-ink-500 font-medium">
        <span>Az</span>
        <div className="w-2.5 h-2.5 rounded-[2px] bg-ink-900 border border-ink-800" />
        <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-900/60 border border-emerald-800/50" />
        <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-600/80 border border-emerald-500" />
        <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-400 border border-emerald-300" />
        <div className="w-2.5 h-2.5 rounded-[2px] bg-gold-400 border border-gold-300" />
        <span>Çok</span>
      </div>
    </div>
  );
}

export default function StatsPage() {
  const { data } = useApp();
  const [detailTarget, setDetailTarget] = useState<DetailModalTarget | null>(null);
  const [peopleTab, setPeopleTab] = useState<'directors' | 'cast' | 'studios'>('directors');
  const [showWrapped, setShowWrapped] = useState(false);
  const [statsMode, setStatsMode] = useState<StatsScopeMode>('current');

  const currentMoviesCount = useMemo(
    () => data.movies.filter((m) => m.watched && !m.isPastWatch).length,
    [data.movies]
  );
  const pastMoviesCount = useMemo(
    () => data.movies.filter((m) => m.watched && m.isPastWatch).length,
    [data.movies]
  );

  // YENİ: TASARIMI KORUYUP, YÜZLERCE SATIRI TEK FONKSİYONA ÇAĞIRIYORUZ!
  const stats = useMemo(() => calculateStats(data, statsMode), [data, statsMode]);

  const genreAllSorted = Array.from(stats.genreAllMap.entries()).sort((a, b) => b[1].count - a[1].count);
  const maxGenreCount = Math.max(...genreAllSorted.map(([, v]) => v.count), 1);
  const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const genreColors = [
    'from-teal-500 to-cyan-400', 'from-cyan-500 to-blue-400', 'from-blue-500 to-indigo-400', 'from-emerald-500 to-green-400',
    'from-amber-500 to-orange-400', 'from-gold-500 to-pink-400', 'from-fuchsia-500 to-purple-400', 'from-violet-500 to-indigo-400',
  ];

  const openHistoryItemDetail = (h: WatchHistoryItem) => {
    if (h.kind === 'movie' || h.type === 'movie') {
      const found = data.movies.find((m) => m.id === (h.itemId || h.id));
      const fallback = found || {
        id: h.itemId || h.id, title: h.title, year: h.year || '', genres: h.genres || [], collectionId: null,
        watched: true, isPastWatch: h.isPastWatch, rating: h.rating, detailedRating: h.detailedRating, reviewTags: h.reviewTags, note: h.note, watchedAt: h.watchedAt, addedAt: h.watchedAt,
      } as any;
      setDetailTarget({ type: 'movie', data: fallback, historyItem: h });
    } else {
      const sid = h.seriesId || h.itemId || h.id;
      const found = data.series.find((s) => s.id === sid);
      const fallback = found || { id: sid, title: h.title, year: h.year, genres: h.genres || [], episodes: [], addedAt: h.watchedAt } as any;
      setDetailTarget({ type: 'series', data: fallback, historyItem: h });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-ink-100 flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-gold-500/20 to-azure-500/20 border border-gold-500/30 flex items-center justify-center">
              <BarChart3 size={20} className="text-gold-400" />
            </div>
            <span>İstatistik Stüdyosu</span>
          </h1>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowWrapped(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-gold-500 via-amber-500 to-orange-500 hover:from-gold-400 hover:to-amber-400 text-ink-950 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-black shadow-lg shadow-gold-500/20 transition-all hover:scale-105"
            >
              <Sparkles size={13} /> <span>Wrapped Özeti</span>
            </button>

            <div className="inline-flex items-center gap-1.5 bg-ink-900/80 border border-ink-700/60 px-3 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold text-ink-300">
              <Sparkles size={12} className="text-gold-400" />
              <span className="hidden xs:inline">Kimlik:</span>
              <span className={stats.ratingPersona.color}>{stats.ratingPersona.label}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-ink-900/70 border border-ink-700/60 p-1.5 sm:p-2 rounded-2xl">
          <div className="grid grid-cols-3 sm:flex items-center gap-1">
            <button
              type="button"
              onClick={() => setStatsMode('current')}
              className={`flex items-center justify-center gap-1 px-2 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all truncate ${
                statsMode === 'current'
                  ? 'bg-gold-500 text-ink-950 shadow-md'
                  : 'text-ink-400 hover:text-ink-200 hover:bg-ink-800/60'
              }`}
            >
              <Activity size={13} className="flex-shrink-0 hidden xs:inline" />
              <span className="truncate">Güncel ({currentMoviesCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatsMode('past')}
              className={`flex items-center justify-center gap-1 px-2 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all truncate ${
                statsMode === 'past'
                  ? 'bg-violet-500 text-white shadow-md shadow-violet-500/25'
                  : 'text-ink-400 hover:text-violet-300 hover:bg-ink-800/60'
              }`}
            >
              <History size={13} className="flex-shrink-0 hidden xs:inline" />
              <span className="truncate">Önceden ({pastMoviesCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatsMode('all')}
              className={`flex items-center justify-center gap-1 px-2 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all truncate ${
                statsMode === 'all'
                  ? 'bg-azure-500 text-white shadow-md'
                  : 'text-ink-400 hover:text-azure-300 hover:bg-ink-800/60'
              }`}
            >
              <Globe size={13} className="flex-shrink-0 hidden xs:inline" />
              <span className="truncate">Tümü ({currentMoviesCount + pastMoviesCount})</span>
            </button>
          </div>

          <span className="text-[11px] font-semibold text-ink-400 px-2 hidden lg:inline">
            {statsMode === 'current'
              ? 'Önceden izlediğin filmler güncel istatistiklerine dahil edilmez.'
              : statsMode === 'past'
              ? 'Yalnızca daha önce izleyip puanladığın filmlerin istatistikleri.'
              : 'Güncel ve daha önce izlediğin tüm yapımların birleşik istatistikleri.'}
          </span>
        </div>
      </div>

      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm sm:text-lg font-bold text-ink-100 flex items-center gap-2">
            <Calendar size={18} className="text-emerald-400" />
            Yıllık İzleme Haritası
          </h2>
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg shadow-inner">
            Son 365 Gün
          </span>
        </div>
        <p className="text-[11px] sm:text-xs text-ink-400 mb-4">Bu yıl hangi günlerde daha çok film izledin? Kutucukların parlaklığı o günkü sinefil gücünü temsil eder.</p>
        
        {stats.scopedHistory.length === 0 ? (
          <p className="text-xs text-ink-500 py-6 text-center">Bu kapsamda henüz izleme verin bulunmuyor.</p>
        ) : (
          <ActivityHeatmap history={stats.scopedHistory} />
        )}
      </div>

      <div className="bg-gradient-to-br from-ink-950 via-ink-900 to-ink-950 border border-ink-700/70 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-6 -top-10 text-gold-500/10 transform rotate-12 pointer-events-none">
          <Hourglass size={180} />
        </div>
        <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-black uppercase tracking-widest text-gold-400 mb-2 sm:mb-3">
              <Clock size={14} />
              {statsMode === 'past'
                ? 'Daha Önce İzlenen Filmlerin Toplam Süresi'
                : 'Ekran Başında Geçen Toplam Süre'}
            </div>
            <div className="flex items-baseline gap-3 sm:gap-4 flex-wrap">
              {stats.runtimeDays > 0 && (
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-5xl font-black text-ink-50 tracking-tight">{stats.runtimeDays}</span>
                  <span className="text-xs sm:text-base font-bold text-gold-400 uppercase">Gün</span>
                </div>
              )}
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-5xl font-black text-ink-50 tracking-tight">{stats.runtimeHours}</span>
                <span className="text-xs sm:text-base font-bold text-azure-400 uppercase">Saat</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-5xl font-black text-ink-50 tracking-tight">{stats.runtimeMins}</span>
                <span className="text-xs sm:text-base font-bold text-ink-400 uppercase">Dk</span>
              </div>
            </div>

            <div className="mt-2.5 sm:mt-3 space-y-1">
              <p className="text-[11px] sm:text-xs text-ink-300 flex items-center gap-1.5 font-medium">
                <Activity size={13} className="text-emerald-400 flex-shrink-0" />
                <span>Toplam <strong className="text-white">{stats.totalActualMinutes.toLocaleString('tr-TR')} dk</strong> izleme süresi.</span>
              </p>
              <p className="text-[11px] text-ink-400 flex items-center gap-1.5 flex-wrap">
                <Film size={12} className="text-gold-400 flex-shrink-0" />
                <span>Katalog Süresi:</span>
                <strong className="text-gold-300">
                  {stats.catalogDays > 0 ? `${stats.catalogDays}G ` : ''}{stats.catalogHours}Sa {stats.catalogMins}Dk
                </strong>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:w-auto w-full flex-shrink-0">
            <div className="bg-ink-950/80 border border-ink-800 rounded-2xl p-3 sm:p-3.5 min-w-[130px]">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-gold-400 mb-1"><Film size={13} /> Film Süresi</div>
              <div className="text-lg sm:text-xl font-black text-ink-50">{Math.round(stats.actualMovieRuntimeMinutes / 60)} <span className="text-xs font-semibold text-ink-400">Saat</span></div>
              <div className="text-[10px] text-ink-500 mt-0.5">{stats.movieCount} Film</div>
            </div>

            <div className="bg-ink-950/80 border border-ink-800 rounded-2xl p-3 sm:p-3.5 min-w-[130px]">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-azure-400 mb-1"><Tv size={13} /> Dizi Süresi</div>
              <div className="text-lg sm:text-xl font-black text-ink-50">{Math.round(stats.seriesRuntimeMinutes / 60)} <span className="text-xs font-semibold text-ink-400">Saat</span></div>
              <div className="text-[10px] text-ink-500 mt-0.5">{stats.seriesCount} Bölüm</div>
            </div>
          </div>
        </div>
      </div>

      {statsMode !== 'past' && (
        <div className="bg-ink-900/65 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3.5">
            <div>
              <h2 className="text-sm sm:text-lg font-bold text-ink-100 flex items-center gap-2">
                <Zap size={18} className="text-emerald-400" />
                Zaman Bükücü & Hız Analizi
              </h2>
              <p className="text-[11px] sm:text-xs text-ink-400 mt-0.5">
                Canlı sayaçla izlenen filmlerdeki hız ve zaman tasarrufu verilerin
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            <div className="bg-ink-950/80 border border-ink-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-emerald-400 uppercase">
                <span>Erken Biten</span>
                <FastForward size={14} />
              </div>
              <div className="text-xl sm:text-3xl font-black text-white mt-1.5">
                {stats.earlyFinishedCount} <span className="text-xs font-bold text-ink-400">Film</span>
              </div>
              <div className="text-[10px] text-ink-400 mt-1">
                Süresinden kısa bitti
              </div>
            </div>

            <div className="bg-ink-950/80 border border-ink-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-gold-400 uppercase">
                <span>Kazanılan</span>
                <Clock size={14} />
              </div>
              <div className="text-xl sm:text-3xl font-black text-white mt-1.5">
                {stats.savedHours > 0 ? `${stats.savedHours}Sa ` : ''}{stats.savedMins} <span className="text-xs font-bold text-ink-400">Dk</span>
              </div>
              <div className="text-[10px] text-ink-400 mt-1">
                Toplam <strong className="text-gold-400">{stats.totalSavedMinutes} dk</strong> kâr
              </div>
            </div>

            <div className="bg-ink-950/80 border border-ink-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-azure-400 uppercase">
                <span>Ort. Hızın</span>
                <Gauge size={14} />
              </div>
              <div className="text-xl sm:text-3xl font-black text-white mt-1.5">
                {stats.avgSpeedMultiplier.toFixed(2)}x
              </div>
              <div className="text-[10px] text-ink-400 mt-1 truncate">
                {stats.avgSpeedMultiplier > 1.05 ? 'Hızlı İzleyici ⚡' : 'Standart Tempo 🎬'}
              </div>
            </div>

            <div className="bg-ink-950/80 border border-ink-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-purple-400 uppercase">
                <span>Hız Rekoru</span>
                <Zap size={14} />
              </div>
              <div className="text-xs sm:text-sm font-black text-white mt-1.5 truncate">
                {stats.fastestMovieRecord ? stats.fastestMovieRecord.title : 'Henüz Yok'}
              </div>
              <div className="text-[10px] text-ink-400 mt-1 truncate">
                {stats.fastestMovieRecord
                  ? `${stats.fastestMovieRecord.runtime}➔${stats.fastestMovieRecord.actualRuntime} dk`
                  : 'Sayacı başlat!'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-ink-400 uppercase tracking-wider">
              {statsMode === 'past' ? 'Önceden Film' : 'İzlenen Film'}
            </span>
            <Film size={16} className="text-gold-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-ink-50 mt-1.5">{stats.movieCount}</div>
          <div className="text-[11px] text-ink-400 mt-1">Ort: <strong className="text-gold-400">{stats.avgMovie.toFixed(1)}</strong></div>
        </div>

        <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-ink-400 uppercase tracking-wider">İzlenen Bölüm</span>
            <Tv size={16} className="text-azure-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-ink-50 mt-1.5">{stats.seriesCount}</div>
          <div className="text-[11px] text-ink-400 mt-1">Ort: <strong className="text-azure-400">{stats.avgSeries.toFixed(1)}</strong> ({stats.uniqueSeriesCount} Dizi)</div>
        </div>

        <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-ink-400 uppercase tracking-wider">Genel Ort.</span>
            <Star size={16} className="text-amber-400 fill-current" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-ink-50 mt-1.5">{stats.avgTotal.toFixed(1)}</div>
          <div className={`text-[11px] font-bold mt-1 truncate ${stats.ratingPersona.color}`}>{stats.ratingPersona.label}</div>
        </div>

        <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-ink-400 uppercase tracking-wider">Kazanılan Kupa</span>
            <Award size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-ink-50 mt-1.5">{data.achievements.reduce((s, a) => s + a.unlockedTiers.length, 0)}</div>
          <div className="text-[11px] text-ink-400 mt-1"><strong className="text-emerald-400">{(data.totalXp || 0).toLocaleString()} XP</strong></div>
        </div>
      </div>

      {statsMode !== 'past' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          <div className="bg-ink-900/70 border border-gold-500/30 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between gap-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                  <Film size={20} className="text-gold-400" />
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-gold-400">Sırada Bekleyen Filmler</div>
                  <div className="text-xl sm:text-3xl font-black text-ink-50 mt-0.5">{stats.remainingMovies} <span className="text-xs sm:text-sm font-bold text-ink-400">Film</span></div>
                </div>
              </div>
              <span className="text-[11px] font-black bg-ink-950 border border-ink-800 text-gold-400 px-2 py-1 rounded-lg flex-shrink-0">~{stats.remainingMoviesHours} Saat</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-ink-400">
                <span>Tamamlanma Oranı</span>
                <span className="text-gold-400">%{stats.movieCompletionPct}</span>
              </div>
              <div className="h-2 w-full bg-ink-950 rounded-full overflow-hidden border border-ink-800">
                <div className="h-full bg-gradient-to-r from-gold-600 to-amber-400 rounded-full transition-all duration-700" style={{ width: `${stats.movieCompletionPct}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-ink-900/70 border border-azure-500/30 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between gap-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-azure-500/15 border border-azure-500/30 flex items-center justify-center flex-shrink-0">
                  <Tv size={20} className="text-azure-400" />
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-azure-400">Sırada Bekleyen Diziler</div>
                  <div className="text-xl sm:text-3xl font-black text-ink-50 mt-0.5">
                    {stats.ongoingSeriesCount} <span className="text-xs font-bold text-ink-400">Dizi</span> · {stats.remainingEpisodes} <span className="text-xs font-bold text-ink-400">Böl.</span>
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-black bg-ink-950 border border-ink-800 text-azure-400 px-2 py-1 rounded-lg flex-shrink-0">~{stats.remainingEpisodesHours} Saat</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-ink-400">
                <span>Tamamlanma Oranı</span>
                <span className="text-azure-400">%{stats.seriesCompletionPct}</span>
              </div>
              <div className="h-2 w-full bg-ink-950 rounded-full overflow-hidden border border-ink-800">
                <div className="h-full bg-gradient-to-r from-azure-600 to-cyan-400 rounded-full transition-all duration-700" style={{ width: `${stats.seriesCompletionPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {statsMode !== 'past' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
            <div className="mb-3.5">
              <h2 className="text-sm sm:text-lg font-bold text-ink-100 flex items-center gap-2"><Clock size={18} className="text-gold-400" /> İzleme Biyoritmi (Günün Saatleri)</h2>
              <p className="text-xs text-ink-400 mt-0.5">Günün hangi zaman diliminde izlemeyi seviyorsun?</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { key: 'morning', label: 'Sabah', hours: '06:00 - 11:59', count: stats.timeBuckets.morning, icon: Coffee, color: 'text-amber-400', bar: 'bg-amber-400' },
                { key: 'afternoon', label: 'Gündüz', hours: '12:00 - 17:59', count: stats.timeBuckets.afternoon, icon: Sun, color: 'text-orange-400', bar: 'bg-orange-400' },
                { key: 'evening', label: 'Prime Time', hours: '18:00 - 23:59', count: stats.timeBuckets.evening, icon: Sunset, color: 'text-gold-400', bar: 'bg-gold-500' },
                { key: 'night', label: 'Gece Kuşu', hours: '00:00 - 05:59', count: stats.timeBuckets.night, icon: Moon, color: 'text-indigo-400', bar: 'bg-indigo-500' },
              ].map((slot) => {
                const Icon = slot.icon;
                const pct = Math.round((slot.count / stats.totalTimeTracked) * 100);
                return (
                  <div key={slot.key} className="bg-ink-950/70 border border-ink-800/80 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1.5">
                      <Icon size={16} className={slot.color} />
                      <span className="text-xs font-black text-ink-100">%{pct}</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-ink-200">{slot.label}</div>
                      <div className="text-[10px] text-ink-500">{slot.hours}</div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 w-full bg-ink-900 rounded-full overflow-hidden">
                        <div className={`h-full ${slot.bar} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] font-semibold text-ink-400 text-right">{slot.count} İzleme</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-ink-100 flex items-center gap-2"><Activity size={18} className="text-azure-400" /> Son 14 Günlük Tempo</h2>
                <p className="text-xs text-ink-400 mt-0.5">Son 2 haftadaki günlük aktivite nabzın</p>
              </div>
              <span className="text-xs font-bold bg-ink-950 border border-ink-800 text-azure-400 px-2.5 py-1 rounded-lg">Bu Ay: {stats.thisMonthCount}</span>
            </div>
            <div className="flex items-end justify-between gap-1.5 h-28 pt-4 px-1">
              {stats.last14Days.map((d) => {
                const hPct = d.count > 0 ? Math.max(18, (d.count / stats.max14DayCount) * 100) : 6;
                return (
                  <div key={d.date} title={`${d.label}: ${d.count} izleme`} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[10px] font-black text-gold-400 opacity-0 group-hover:opacity-100 transition-opacity">{d.count}</span>
                    <div className={`w-full rounded-t-md transition-all duration-500 ${d.count > 0 ? 'bg-gradient-to-t from-gold-600 to-gold-400 group-hover:brightness-125 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'bg-ink-800/70'}`} style={{ height: `${hPct}%` }} />
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
      )}

      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3.5">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-ink-100 flex items-center gap-2"><Tag size={18} className="text-gold-400" /> Değerlendirme Başlıkları</h2>
            <p className="text-xs text-ink-400 mt-0.5">Puanlama sırasında seçtiğin başlıkların sıklığı ve ortalamaları</p>
          </div>
          {stats.totalTaggedItems > 0 && (
            <span className="text-[11px] font-bold bg-gold-500/15 text-gold-300 border border-gold-500/30 px-2.5 py-1 rounded-full">{stats.totalTaggedItems} Yapım</span>
          )}
        </div>
        {stats.reviewTagStats.length === 0 ? (
          <div className="text-center py-8 bg-ink-950/40 rounded-xl border border-ink-800/60">
            <p className="text-xs text-ink-400 px-4">Bu görünümde henüz değerlendirme başlığı seçilmiş bir yapım bulunmuyor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {stats.reviewTagStats.map((item) => {
              const widthPct = Math.max(10, (item.count / stats.maxReviewTagCount) * 100);
              return (
                <div key={item.tag} className="bg-ink-950/75 border border-ink-800/80 hover:border-gold-500/40 rounded-xl p-3 flex flex-col justify-between gap-2 transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-black text-ink-100 truncate">{item.tag}</span>
                    {item.avg > 0 && <span className={`text-xs px-2 py-0.5 rounded-md font-black flex-shrink-0 ${ratingBgClass(item.avg)}`}>Ort: {item.avg.toFixed(1)}</span>}
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-ink-900 rounded-full overflow-hidden border border-ink-800">
                      <div className="h-full bg-gradient-to-r from-gold-500 to-amber-400 rounded-full transition-all duration-700" style={{ width: `${widthPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-ink-400">
                      <span>Kullanım</span>
                      <span className="text-gold-400">{item.count} Kez</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-ink-100 flex items-center gap-2"><Trophy size={18} className="text-gold-400" /> Sinevia Rekorlar Kitabı</h2>
            <p className="text-xs text-ink-400 mt-0.5">Kütüphanendeki en dikkat çekici kişisel rekorların</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-ink-950/70 border border-ink-800/80 rounded-xl p-3">
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-gold-400 uppercase"><Flame size={12} /> Yoğun Gün</div>
              <div className="text-sm sm:text-lg font-black text-ink-50 mt-1">{stats.busiestDay.count > 0 ? `${stats.busiestDay.count} Yapım` : 'Yok'}</div>
              <div className="text-[10px] text-ink-400 mt-0.5 truncate">{stats.busiestDay.date}</div>
            </div>
            <div className="bg-ink-950/70 border border-ink-800/80 rounded-xl p-3">
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-orange-400 uppercase"><Zap size={12} /> Seri Rekoru</div>
              <div className="text-sm sm:text-lg font-black text-ink-50 mt-1">{stats.maxStreakEver} Gün</div>
              <div className="text-[10px] text-ink-400 mt-0.5">Aktif: {data.dailyStreak} gün</div>
            </div>
            <div className="bg-ink-950/70 border border-ink-800/80 rounded-xl p-3">
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-azure-400 uppercase"><Clock size={12} /> En Uzun Film</div>
              <div className="text-xs sm:text-sm font-black text-ink-50 mt-1 truncate">{stats.longestMovie ? stats.longestMovie.title : 'Yok'}</div>
              <div className="text-[10px] text-ink-400 mt-0.5">{stats.longestMovie ? `${stats.longestMovie.runtime} Dk` : '-'}</div>
            </div>
            <div className="bg-ink-950/70 border border-ink-800/80 rounded-xl p-3">
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-violet-400 uppercase"><Tv size={12} /> Favori Dizi</div>
              <div className="text-xs sm:text-sm font-black text-ink-50 mt-1 truncate">{stats.mostWatchedSeries ? stats.mostWatchedSeries.title : 'Yok'}</div>
              <div className="text-[10px] text-ink-400 mt-0.5">{stats.mostWatchedSeries ? `${stats.mostWatchedSeries.count} Bölüm` : '-'}</div>
            </div>
          </div>
          <div className="bg-ink-950/50 border border-ink-800/60 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2"><StickyNote size={15} className="text-emerald-400" /><span className="text-xs font-bold text-ink-200">Eleştirmen Notların</span></div>
            <span className="text-xs font-black text-emerald-400">{stats.notesCount} Not ({stats.totalNoteWords} Kelime)</span>
          </div>
        </div>

        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-ink-100 flex items-center gap-2"><Globe size={18} className="text-azure-400" /> Dünya Sineması Pasaportu</h2>
            <p className="text-xs text-ink-400 mt-0.5 mb-3.5">İzlediğin yapımların ülke sinemalarına göre dağılımı</p>
            {stats.topLanguages.length === 0 ? (
              <div className="text-center py-8 bg-ink-950/40 rounded-xl border border-ink-800/60">
                <p className="text-xs text-ink-400 px-4">Dil/Ülke verisi bulunamadı. <strong>"Eksik Bul"</strong> butonuna tıklayarak TMDB verilerini senkronize edebilirsin.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {stats.topLanguages.map((lang) => (
                  <div key={lang.code} className="bg-ink-950/70 border border-ink-800/80 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg flex-shrink-0">{lang.flag}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-ink-100 truncate">{lang.name}</div>
                        <div className="text-[10px] text-ink-400 font-semibold">{lang.count} Yapım</div>
                      </div>
                    </div>
                    {lang.avg > 0 && <span className={`text-xs px-2 py-0.5 rounded-md font-black flex-shrink-0 ${ratingBgClass(lang.avg)}`}>{lang.avg.toFixed(1)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-ink-100 flex items-center gap-2"><Crown size={18} className="text-gold-400" /> Yıldızlar Geçidi</h2>
            <p className="text-xs text-ink-400 mt-0.5">En çok tercih ettiğin yönetmenler, oyuncular ve stüdyolar</p>
          </div>
          <div className="grid grid-cols-3 sm:flex bg-ink-950 rounded-xl p-1 border border-ink-800 w-full sm:w-fit gap-1">
            <button type="button" onClick={() => setPeopleTab('directors')} className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${peopleTab === 'directors' ? 'bg-gold-500 text-ink-950 shadow-sm' : 'text-ink-400 hover:text-ink-200'}`}><User size={12} /> Yönetmen</button>
            <button type="button" onClick={() => setPeopleTab('cast')} className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${peopleTab === 'cast' ? 'bg-gold-500 text-ink-950 shadow-sm' : 'text-ink-400 hover:text-ink-200'}`}><Users size={12} /> Oyuncu</button>
            <button type="button" onClick={() => setPeopleTab('studios')} className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${peopleTab === 'studios' ? 'bg-gold-500 text-ink-950 shadow-sm' : 'text-ink-400 hover:text-ink-200'}`}><Building2 size={12} /> Stüdyo</button>
          </div>
        </div>

        {(() => {
          const activeList = peopleTab === 'directors' ? stats.topDirectors : peopleTab === 'cast' ? stats.topCast : stats.topStudios;
          if (activeList.length === 0) {
            return (
              <div className="text-center py-8 bg-ink-950/40 rounded-xl border border-ink-800/60">
                <p className="text-xs text-ink-400">Henüz künye verisi bulunamadı.</p>
              </div>
            );
          }
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {activeList.map((item, idx) => (
                <div key={item.name} className="bg-ink-950/70 border border-ink-800/80 hover:border-gold-500/40 rounded-xl p-3 flex items-center justify-between gap-3 transition-all">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0 ${idx === 0 ? 'bg-gold-500 text-ink-950 shadow-md' : idx === 1 ? 'bg-slate-300 text-slate-900' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-ink-800 text-ink-300 border border-ink-700'}`}>#{idx + 1}</div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-ink-100 truncate">{item.name}</div>
                      <div className="text-[10px] sm:text-[11px] text-ink-400 font-medium">{item.count} Yapım</div>
                    </div>
                  </div>
                  {item.avg > 0 && <span className={`text-xs px-2 py-0.5 rounded-lg font-black flex-shrink-0 ${ratingBgClass(item.avg)}`}>{item.avg.toFixed(1)}</span>}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {stats.topRated.length > 0 && (
        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="mb-3.5">
            <h2 className="text-base sm:text-lg font-bold text-ink-100 flex items-center gap-2"><Star size={18} className="text-gold-400 fill-current" /> Şeref Kürsüsü</h2>
            <p className="text-xs text-ink-400 mt-0.5">En yüksek puan verdiğin yapımlar</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3.5">
            {stats.topRated.map((h, i) => {
              const isMovie = h.kind === 'movie' || h.type === 'movie';
              const poster = isMovie ? data.movies.find((m) => m.id === (h.itemId || h.id))?.posterUrl : data.series.find((s) => s.id === (h.seriesId || h.itemId || h.id))?.posterUrl;
              return (
                <button key={h.id} type="button" onClick={() => openHistoryItemDetail(h)} className="group relative flex flex-col text-left bg-ink-950/70 border border-ink-800 hover:border-gold-500/50 rounded-xl sm:rounded-2xl overflow-hidden shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
                  <div className="aspect-[2/3] w-full bg-ink-900 relative overflow-hidden">
                    {poster ? <img src={poster} alt={h.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center text-ink-600">{isMovie ? <Film size={24} /> : <Tv size={24} />}</div>}
                    <div className="absolute top-1.5 left-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center text-[10px] font-black text-gold-400">#{i + 1}</div>
                    {h.rating !== null && <div className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-lg text-[10px] sm:text-xs font-black shadow-md ${ratingBgClass(h.rating)}`}>{h.rating}</div>}
                  </div>
                  <div className="p-2">
                    <div className="text-[11px] sm:text-xs font-bold text-ink-100 truncate group-hover:text-gold-400 transition-colors">{h.title}</div>
                    <div className="text-[9px] sm:text-[10px] text-ink-400 mt-0.5 truncate">{h.season != null ? `S${h.season} B${h.episode}` : h.year || 'Film'}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(stats.criteriaAverages.length > 0 || stats.decades.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col">
            <h2 className="text-base sm:text-lg font-bold text-ink-100 flex items-center gap-2 mb-1">
              <Hexagon size={18} className="text-azure-400" /> Sinefil Karakter Radarı
            </h2>
            <p className="text-xs text-ink-400 mb-6">Puanladığın kriterlerin karakteristik analiz ağı</p>
            
            <div className="flex-1 flex flex-col justify-center bg-ink-950/40 rounded-2xl border border-ink-800/60 py-6 mb-4">
              <RadarChart data={stats.radarData} />
            </div>

            {stats.criteriaAverages.length > 0 && (
              <div className="space-y-3 mt-auto">
                {stats.criteriaAverages.map((crit) => {
                  const pct = Math.min(100, Math.max(5, (crit.avg / 10) * 100));
                  return (
                    <div key={crit.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-ink-100 flex items-center gap-1.5">{crit.name} <span className="text-[10px] text-ink-500 font-normal">({crit.count})</span></span>
                        <span className={`px-2 py-0.5 rounded font-black text-[11px] ${ratingBgClass(crit.avg)}`}>{crit.avg.toFixed(1)}</span>
                      </div>
                      <div className="h-2 w-full bg-ink-950 rounded-full overflow-hidden border border-ink-800">
                        <div className="h-full bg-gradient-to-r from-gold-500 to-azure-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 sm:p-5 shadow-xl">
            <h2 className="text-base sm:text-lg font-bold text-ink-100 mb-1 flex items-center gap-2"><Compass size={18} className="text-gold-400" /> Dönemlere Göre Tercihlerin</h2>
            <p className="text-xs text-ink-400 mb-4">İzlediğin filmlerin çıkış yaptıkları on yıllara göre dağılımı</p>
            {stats.decades.length === 0 ? (
              <p className="text-xs text-ink-500 py-6 text-center">Henüz yeterli yıl verisi yok.</p>
            ) : (
              <div className="space-y-2.5">
                {stats.decades.map((d) => {
                  const pct = Math.max(10, (d.count / stats.maxDecadeCount) * 100);
                  return (
                    <div key={d.decade} className="flex items-center gap-2.5">
                      <div className="w-14 text-xs font-black text-ink-200 flex-shrink-0">{d.decade}</div>
                      <div className="flex-1 h-6 bg-ink-950 rounded-lg overflow-hidden border border-ink-800/80">
                        <div className="h-full bg-gradient-to-r from-gold-500 to-amber-500 rounded-lg flex items-center justify-end pr-2 text-[11px] font-black text-ink-950 transition-all duration-700" style={{ width: `${pct}%` }}>{d.count}</div>
                      </div>
                      {d.avg > 0 && <span className={`text-xs px-2 py-0.5 rounded font-bold w-10 text-center flex-shrink-0 ${ratingBgClass(d.avg)}`}>{d.avg.toFixed(1)}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 sm:p-5 shadow-xl">
        <h2 className="text-base sm:text-lg font-semibold text-ink-100 mb-3.5 flex items-center gap-2"><Layers size={18} className="text-teal-400" /> En Sevdiğin Türler</h2>
        {genreAllSorted.length === 0 ? (
          <p className="text-sm text-ink-500">Henüz veri yok.</p>
        ) : (
          <div className="space-y-2.5">
            {genreAllSorted.slice(0, 10).map(([genre, val], i) => {
              const avg = val.ratedCount > 0 ? val.totalRating / val.ratedCount : 0;
              const colorClass = genreColors[i % genreColors.length];
              return (
                <div key={genre} className="flex items-center gap-2.5">
                  <div className="w-20 sm:w-24 text-xs sm:text-sm font-medium text-ink-300 flex-shrink-0 truncate">{genre}</div>
                  <div className="flex-1 h-6 sm:h-7 bg-ink-800/60 rounded-lg overflow-hidden relative group">
                    <div className={`h-full bg-gradient-to-r ${colorClass} rounded-lg flex items-center justify-end pr-2 transition-all duration-700 ease-out`} style={{ width: `${Math.max(8, (val.count / maxGenreCount) * 100)}%` }}>
                      <span className="text-[11px] sm:text-xs text-white font-bold drop-shadow">{val.count}</span>
                    </div>
                  </div>
                  {avg > 0 && <span className={`text-xs px-2 py-0.5 rounded font-bold flex-shrink-0 w-10 text-center ${ratingBgClass(avg)}`}>{avg.toFixed(1)}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <h2 className="text-sm sm:text-base font-semibold text-ink-100 mb-4 flex items-center gap-2"><Calendar size={16} className="text-cyan-400" /> Aylık İzleme</h2>
          {stats.monthly.length === 0 ? (
            <p className="text-sm text-ink-500">Henüz veri yok.</p>
          ) : (
            <>
              <div className="flex items-end justify-between gap-2.5 h-36 sm:h-40 mb-3">
                {stats.monthly.map(([month, val]) => {
                  const [y, m] = month.split('-');
                  const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('tr-TR', { month: 'short' });
                  const heightPct = (val.total / stats.maxMonthly) * 100;
                  const moviePct = val.total > 0 ? (val.movies / val.total) * 100 : 0;
                  return (
                    <div key={month} className="flex flex-col items-center gap-1.5 flex-1 group">
                      <div className="text-xs text-ink-300 font-bold">{val.total}</div>
                      <div className="w-full max-w-[2rem] flex flex-col-reverse rounded-t-lg overflow-hidden transition-all duration-700 hover:brightness-110" style={{ height: `${Math.max(heightPct, 6)}%` }}>
                        <div className="bg-gradient-to-t from-teal-600 to-teal-400 transition-all duration-700" style={{ height: `${moviePct}%` }} />
                        <div className="bg-gradient-to-t from-cyan-600 to-cyan-400 transition-all duration-700" style={{ height: `${100 - moviePct}%` }} />
                      </div>
                      <div className="text-[11px] text-ink-500 font-medium">{monthName}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-5 text-xs text-ink-400 border-t border-ink-800/50 pt-2.5">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-teal-500" /> Film</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-cyan-500" /> Dizi</span>
              </div>
            </>
          )}
        </div>

        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <h2 className="text-sm sm:text-base font-semibold text-ink-100 mb-4 flex items-center gap-2"><Calendar size={16} className="text-violet-400" /> Haftalık Yoğunluk</h2>
          {data.history.length === 0 ? (
            <p className="text-sm text-ink-500">Henüz veri yok.</p>
          ) : (
            <div className="flex flex-1 items-end justify-between gap-2 h-40 pt-4">
              {stats.dayOfWeekMap.map((count, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 flex-1 group h-full justify-end">
                  <div className="text-xs text-ink-300 font-bold">{count}</div>
                  <div className="w-full max-w-[2rem] bg-gradient-to-t from-violet-600 to-fuchsia-400 rounded-t-md transition-all duration-700 hover:brightness-110" style={{ height: `${(count / stats.maxDayOfWeek) * 80}%`, minHeight: count > 0 ? '6px' : '2px' }} />
                  <div className="text-[11px] text-ink-500 font-medium">{dayNames[i]}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 sm:p-5 shadow-xl">
          <h2 className="text-sm sm:text-base font-semibold text-ink-100 mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-amber-400" /> Puan Dağılımı</h2>
          {stats.ratings.length === 0 ? (
            <p className="text-sm text-ink-500">Henüz puan verilmemiş.</p>
          ) : (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
              {stats.ratings.map(([rating, count]) => {
                const maxCount = Math.max(...stats.ratings.map(([, c]) => c));
                return (
                  <div key={rating} className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold flex-shrink-0 w-10 text-center ${ratingBgClass(rating)}`}>{rating}</span>
                    <div className="flex-1 h-4 bg-ink-800/60 rounded overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded transition-all duration-700" style={{ width: `${(count / maxCount) * 100}%` }} />
                    </div>
                    <span className="text-xs text-ink-300 w-7 text-right font-bold">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {stats.collectionStats.length > 0 && (
        <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 sm:p-5 shadow-xl">
          <h2 className="text-base sm:text-lg font-semibold text-ink-100 mb-3.5 flex items-center gap-2"><Layers size={18} className="text-cyan-400" /> Koleksiyon İlerlemesi</h2>
          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
            {stats.collectionStats.map((c) => (
              <div key={c.name} className="bg-ink-800/40 border border-ink-700/30 p-3.5 rounded-xl">
                <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                  <span className="text-ink-200 font-bold truncate pr-2">{c.name}</span>
                  <span className="text-ink-400 font-semibold flex-shrink-0">{c.watched} / {c.total} (%{Math.round(c.progress)})</span>
                </div>
                <div className="h-2 bg-ink-950 rounded-full overflow-hidden shadow-inner border border-ink-800">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full transition-all duration-700 relative" style={{ width: `${c.progress}%` }}>
                    {c.progress === 100 && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {detailTarget && <MediaDetailModal target={detailTarget} onClose={() => setDetailTarget(null)} />}
      {showWrapped && <WrappedModal onClose={() => setShowWrapped(false)} />}
    </div>
  );
}