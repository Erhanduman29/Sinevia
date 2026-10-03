import { useState, useMemo, useEffect } from 'react';
import {
  CalendarClock, Plus, X, Search, Clock, Star, Trash2, Image as ImageIcon,
  Film, Sparkles, Play, Pause, Timer, Lock,
  CheckCircle2, Hourglass, ArrowRight, CalendarDays,
  LayoutList, Activity, AlertCircle, GripVertical, CalendarPlus,
  Target, Zap, Flame
} from 'lucide-react';
import { useApp, getMovieTimerInfo, computeEndTime } from '../context/AppContext';
import { ratingBgClass } from '../lib/utils';
import RatingModal from '../components/RatingModal';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Movie, WeeklyPlanItem } from '../types';

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const WINDOW_SIZE = 8;

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDayDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTH_SHORT[d.getMonth()]}`;
}

function formatDuration(totalMins: number): string {
  if (totalMins <= 0) return '0 dk';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

function checkOverlap(time1: string, dur1: number, time2: string, dur2: number) {
  const t1 = time1.split(':').map(Number);
  const start1 = t1[0] * 60 + t1[1];
  const end1 = start1 + dur1;
  
  const t2 = time2.split(':').map(Number);
  const start2 = t2[0] * 60 + t2[1];
  const end2 = start2 + dur2;
  
  return start1 < end2 && end1 > start2;
}

export default function WeeklyPlanPage() {
  const { data, updatePlanItem, deletePlanItem, startWatchingMovie, togglePauseWatchingMovie, cancelWatchingMovie, canRateMovieWithTimer, watchMovie, showToast } = useApp();
  
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [showAdd, setShowAdd] = useState<{ presetDate?: string } | null>(null);
  const [ratingTarget, setRatingTarget] = useState<{ item: WeeklyPlanItem; movie: Movie } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WeeklyPlanItem | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [draggedItem, setDraggedItem] = useState<WeeklyPlanItem | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const plan = data.weeklyPlan || [];
  const today = useMemo(() => startOfToday(), []);
  const todayStrVal = toDateStr(today);
  const yesterdayStrVal = toDateStr(addDays(today, -1));

  const currentTimeStr = useMemo(() => {
    const d = new Date(nowMs);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, [nowMs]);

  const activeTimerMovie = useMemo(() => data.movies.find((m) => !m.watched && m.startedAt) || null, [data.movies]);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const windowDays = useMemo(() => Array.from({ length: WINDOW_SIZE }, (_, i) => addDays(today, i - 1)), [today]);
  const windowStartStr = toDateStr(windowDays[0]);
  const windowEndStr = toDateStr(windowDays[WINDOW_SIZE - 1]);

  const movieMap = useMemo(() => new Map(data.movies.map((m) => [m.id, m])), [data.movies]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, WeeklyPlanItem[]>();
    windowDays.forEach((d) => map.set(toDateStr(d), []));
    plan.forEach((p) => {
      if (map.has(p.date)) map.get(p.date)!.push(p);
    });
    map.forEach((items) => items.sort((a, b) => a.time.localeCompare(b.time)));
    return map;
  }, [plan, windowDays]);

  const stats = useMemo(() => {
    const visibleItems = plan.filter((p) => p.date >= windowStartStr && p.date <= windowEndStr);
    let watchedCount = 0;
    let totalMinutes = 0;
    let watchedMinutes = 0;
    
    visibleItems.forEach((p) => {
      const m = movieMap.get(p.movieId);
      const runtime = m?.runtime && m.runtime > 0 ? m.runtime : 115;
      totalMinutes += runtime;
      if (m?.watched) {
        watchedCount++;
        watchedMinutes += runtime;
      }
    });

    const pendingCount = visibleItems.length - watchedCount;
    const pendingMinutes = totalMinutes - watchedMinutes;
    const completionPct = visibleItems.length === 0 ? 0 : Math.round((watchedCount / visibleItems.length) * 100);

    return { total: visibleItems.length, watchedCount, pendingCount, totalMinutes, watchedMinutes, pendingMinutes, completionPct };
  }, [plan, windowStartStr, windowEndStr, movieMap]);

  const handleRequestRate = (item: WeeklyPlanItem, movie: Movie) => {
    if (movie.startedAt && !canRateMovieWithTimer(movie.id)) return;
    setRatingTarget({ item, movie });
  };

  const handleSnooze = (item: WeeklyPlanItem) => {
    const tomorrowStr = toDateStr(addDays(today, 1));
    updatePlanItem(item.id, tomorrowStr as any, item.time);
    showToast(`"${item.title}" yarına ertelendi!`, 'info');
  };

  const handleDragStart = (e: React.DragEvent, item: WeeklyPlanItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { (e.target as HTMLElement).style.opacity = '0.5'; }, 0);
  };
  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedItem(null); setDragOverDate(null); (e.target as HTMLElement).style.opacity = '1';
  };
  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    if (draggedItem && draggedItem.date !== dateStr) setDragOverDate(dateStr);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); setDragOverDate(null);
  };
  const handleDrop = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault(); setDragOverDate(null);
    if (draggedItem && draggedItem.date !== dateStr) {
      updatePlanItem(draggedItem.id, dateStr as any, draggedItem.time);
      showToast('Film tarihi güncellendi!', 'success');
    }
  };

  const renderListCard = (item: WeeklyPlanItem, movie: Movie) => {
    const timerInfo = !movie.watched && movie.startedAt ? getMovieTimerInfo(movie, nowMs) : null;
    const endTime = computeEndTime(item.time, movie.runtime || item.runtime);
    const anotherTimerActive = Boolean(activeTimerMovie && activeTimerMovie.id !== movie.id);

    const isPastDate = item.date < todayStrVal;
    const isPastTimeToday = item.date === todayStrVal && item.time < currentTimeStr;
    const isMissed = !movie.watched && (isPastDate || isPastTimeToday);

    return (
      <div
        draggable onDragStart={(e) => handleDragStart(e, item)} onDragEnd={handleDragEnd} key={item.id}
        className={`group relative flex-shrink-0 flex gap-3 transition-all duration-300 animate-fade-in border rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing backdrop-blur-sm w-[280px] p-2.5 ${
          movie.watched ? 'bg-emerald-950/20 border-emerald-500/20 opacity-80 hover:opacity-100' : isMissed ? 'bg-red-950/20 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:border-red-500/60' : 'bg-ink-900/40 border-ink-700/50 hover:border-violet-500/40 hover:bg-ink-900/70 hover:shadow-md hover:-translate-y-0.5'
        }`}
      >
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={14} className="text-ink-600 hover:text-white" />
        </div>

        <div className={`w-14 aspect-[2/3] flex-shrink-0 rounded-xl overflow-hidden bg-ink-900 border relative ${isMissed ? 'border-red-500/30' : 'border-ink-800'}`}>
          {movie.posterUrl ? <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-ink-600" /></div>}
          {movie.watched && <div className="absolute inset-0 bg-emerald-950/70 flex items-center justify-center backdrop-blur-[2px]"><CheckCircle2 size={18} className="text-emerald-400 drop-shadow-md" /></div>}
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-between pt-0.5">
          <div>
            <div className={`flex items-center gap-1 text-[10px] font-black mb-1 ${isMissed ? 'text-red-400' : 'text-violet-300'}`}>
              <Clock size={10} /> {item.time} <ArrowRight size={10} className="text-ink-600 mx-0.5" /> {endTime}
            </div>
            <div className={`text-xs font-black truncate leading-tight ${movie.watched ? 'text-ink-400 line-through' : 'text-ink-50'}`}>{movie.title}</div>
            <div className="flex items-center gap-2 mt-1">
              {movie.year && <span className="text-[9px] font-medium text-ink-400 bg-ink-950 px-1.5 py-0.5 rounded-md">{movie.year}</span>}
            </div>
          </div>

          <div className="mt-2.5">
            {movie.watched ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 w-fit px-2 py-1 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 size={12} /> İzlendi
                </div>
                {movie.rating !== null && (
                  <span className={`text-[10px] flex items-center gap-1 px-1.5 py-1 rounded-md font-bold shadow-sm border border-white/20 text-white ${ratingBgClass(movie.rating)}`}>
                    <Star size={10} className="fill-current" /> {movie.rating}
                  </span>
                )}
              </div>
            ) : isMissed ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-1 text-[10px] font-black text-red-400 bg-red-500/10 px-2 py-1 rounded-lg"><AlertCircle size={10} /> Kaçırıldı</div>
                <button onClick={() => handleSnooze(item)} className="flex items-center gap-1 text-[10px] font-black text-ink-950 bg-gold-500 hover:bg-gold-400 px-2 py-1 rounded-lg transition-colors"><CalendarPlus size={10} /> Ertele</button>
              </div>
            ) : timerInfo ? (
              <div className="flex items-center gap-1 flex-wrap">
                <div className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-1.5 py-1 rounded-md text-[10px] font-bold"><Timer size={10} className={timerInfo.isPaused ? 'text-amber-400' : 'animate-pulse text-emerald-400'} /><span className="font-mono">{timerInfo.formattedRemaining}</span></div>
                <button onClick={() => togglePauseWatchingMovie(movie.id)} className="text-amber-300 hover:text-white p-1 bg-ink-800 hover:bg-ink-700 rounded-md">{timerInfo.isPaused ? <Play size={10} className="fill-current" /> : <Pause size={10} />}</button>
                <button onClick={() => cancelWatchingMovie(movie.id)} className="text-red-400 hover:text-white p-1 bg-red-500/10 hover:bg-red-500/20 rounded-md"><X size={10} /></button>
                <button onClick={() => handleRequestRate(item, movie)} disabled={!timerInfo.canRateWithTimer} className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-md transition-all ${timerInfo.canRateWithTimer ? 'bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 text-ink-950' : 'bg-ink-800/60 text-ink-600 cursor-not-allowed'}`}>{timerInfo.canRateWithTimer ? <><Star size={10} className="fill-current" /> Puanla</> : <Lock size={10} />}</button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button onClick={() => startWatchingMovie(movie.id)} disabled={anotherTimerActive} title={anotherTimerActive ? 'Başka bir filmin sayacı açık!' : 'Geri Sayımı Başlat'} className={`flex items-center justify-center gap-1 text-[10px] font-black px-2 py-1.5 rounded-lg border transition-all ${anotherTimerActive ? 'bg-ink-900/50 text-ink-600 border-ink-800 cursor-not-allowed' : 'bg-ink-800 hover:bg-emerald-900/30 text-emerald-400 border-emerald-500/30'}`}>{anotherTimerActive ? <Lock size={10} /> : <Play size={10} className="fill-current" />}</button>
                <button onClick={() => handleRequestRate(item, movie)} className="flex-1 flex items-center justify-center gap-1 bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 text-ink-950 text-[10px] font-black px-2 py-1.5 rounded-lg transition-all shadow-sm"><Star size={10} className="fill-current" /> Puanla</button>
                <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"><Trash2 size={12} /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTimelineCard = (item: WeeklyPlanItem, movie: Movie) => {
    const timerInfo = !movie.watched && movie.startedAt ? getMovieTimerInfo(movie, nowMs) : null;
    const endTime = computeEndTime(item.time, movie.runtime || item.runtime);
    const anotherTimerActive = Boolean(activeTimerMovie && activeTimerMovie.id !== movie.id);

    const isPastDate = item.date < todayStrVal;
    const isPastTimeToday = item.date === todayStrVal && item.time < currentTimeStr;
    const isMissed = !movie.watched && (isPastDate || isPastTimeToday);

    return (
      <div className={`relative w-full max-w-2xl rounded-2xl overflow-hidden border transition-all animate-fade-in flex flex-col sm:flex-row shadow-lg ${
        movie.watched ? 'bg-emerald-950/10 border-emerald-500/30 opacity-80' : isMissed ? 'bg-red-950/20 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'bg-ink-900/60 border-ink-700/60 hover:border-violet-500/40 hover:bg-ink-900/80 backdrop-blur-md'
      }`}>
        <div className="sm:w-24 h-28 sm:h-auto flex-shrink-0 bg-ink-950 relative">
          {movie.posterUrl ? <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover opacity-90" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={20} className="text-ink-600" /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-transparent sm:bg-gradient-to-r" />
          {movie.watched && <div className="absolute inset-0 bg-emerald-950/60 flex items-center justify-center backdrop-blur-sm"><CheckCircle2 size={28} className="text-emerald-400 drop-shadow-md" /></div>}
        </div>

        <div className="p-3 sm:p-4 flex-1 flex flex-col justify-center">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div>
              <h4 className={`text-sm sm:text-base font-black leading-tight ${movie.watched ? 'text-ink-400 line-through' : 'text-white'}`}>{movie.title}</h4>
              <div className="flex items-center gap-2 mt-1 text-[11px] sm:text-xs">
                {movie.year && <span className="font-bold text-ink-300 bg-ink-950 px-1.5 py-0.5 rounded border border-ink-800">{movie.year}</span>}
                <span className="font-medium text-ink-400 flex items-center gap-1"><Clock size={11} className="text-violet-400" /> Bitiş: {endTime}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-ink-800/50 flex flex-wrap items-center gap-2.5">
            {movie.watched ? (
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> İzlendi
                </span>
                {movie.rating !== null && (
                  <span className={`text-sm font-black text-white px-3 py-1 rounded-lg border shadow-md flex items-center gap-1.5 border-white/20 ${ratingBgClass(movie.rating)}`}>
                    <Star size={14} className="fill-current" /> {movie.rating}
                  </span>
                )}
              </div>
            ) : isMissed ? (
              <>
                <span className="text-[11px] font-black text-red-400 bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/20 flex items-center gap-1.5"><AlertCircle size={12} /> Saat Kaçırıldı</span>
                <button onClick={() => handleSnooze(item)} className="text-[11px] font-black text-ink-950 bg-gold-500 hover:bg-gold-400 px-3 py-1.5 rounded-lg transition-colors shadow-sm">Yarına Ertele</button>
              </>
            ) : timerInfo ? (
              <>
                <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-2.5 py-1.5 rounded-lg text-[11px] font-bold shadow-inner">
                  <Timer size={12} className={timerInfo.isPaused ? 'text-amber-400' : 'animate-pulse text-emerald-400'} />
                  <span className="font-mono">{timerInfo.formattedRemaining}</span>
                </div>
                <button onClick={() => togglePauseWatchingMovie(movie.id)} className="text-amber-300 hover:text-white p-1.5 bg-ink-800 hover:bg-ink-700 rounded-lg transition-colors border border-amber-500/20">
                  {timerInfo.isPaused ? <Play size={12} className="fill-current" /> : <Pause size={12} />}
                </button>
                <button onClick={() => cancelWatchingMovie(movie.id)} className="text-red-400 hover:text-white p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
                  <X size={12} />
                </button>
                <button onClick={() => handleRequestRate(item, movie)} disabled={!timerInfo.canRateWithTimer} className={`flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-lg transition-all shadow-md ${timerInfo.canRateWithTimer ? 'bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-ink-950' : 'bg-ink-800/60 text-ink-600 cursor-not-allowed'}`}>
                  {timerInfo.canRateWithTimer ? <><Star size={11} className="fill-current" /> Puanla</> : <Lock size={11} />}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => startWatchingMovie(movie.id)} disabled={anotherTimerActive} className={`flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-lg transition-all border shadow-sm ${anotherTimerActive ? 'bg-ink-900/50 text-ink-600 border-ink-800 cursor-not-allowed' : 'bg-ink-800 hover:bg-emerald-900/40 text-emerald-400 border-emerald-500/40'}`}>
                  {anotherTimerActive ? <Lock size={12} /> : <Play size={12} className="fill-current" />} Başlat
                </button>
                <button onClick={() => handleRequestRate(item, movie)} className="flex items-center gap-1.5 bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-ink-950 text-[11px] font-black px-3 py-1.5 rounded-lg transition-all shadow-sm">
                  <Star size={12} className="fill-current" /> Direkt Puanla
                </button>
                <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors ml-auto">
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-8 animate-fade-in">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2.5 drop-shadow-md">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-azure-500/20 border border-violet-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.2)]">
            <CalendarClock size={20} className="text-violet-400" />
          </div>
          <div>
            <div className="leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-ink-200">Haftalık Planlayıcı</div>
          </div>
        </h1>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <div className="flex bg-ink-950/80 p-1 rounded-xl border border-ink-800/80 shadow-inner w-full sm:w-auto">
            <button onClick={() => setViewMode('list')} className={`flex-1 sm:w-28 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wider transition-all ${viewMode === 'list' ? 'bg-ink-800 text-white shadow-sm' : 'text-ink-500 hover:text-ink-200'}`}>
              <LayoutList size={13} /> PANO
            </button>
            <button onClick={() => setViewMode('timeline')} className={`flex-1 sm:w-28 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wider transition-all ${viewMode === 'timeline' ? 'bg-ink-800 text-violet-300 shadow-sm ring-1 ring-violet-500/20' : 'text-ink-500 hover:text-ink-200'}`}>
              <Activity size={13} /> ÇİZELGE
            </button>
          </div>
          <button onClick={() => setShowAdd({})} className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-azure-600 text-white px-4 py-2 rounded-xl font-black text-xs shadow-md shadow-violet-500/20 hover:shadow-violet-500/40 hover:scale-105 transition-all">
            <Plus size={16} strokeWidth={3} /> Maraton Planla
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-ink-900/80 to-ink-950/80 border border-ink-800 rounded-2xl p-4 flex items-center gap-4 shadow-lg backdrop-blur-sm relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 text-ink-800/20"><Target size={90} /></div>
          <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" className="stroke-ink-800" strokeWidth="3" />
              <circle cx="18" cy="18" r="16" fill="none" className="stroke-violet-500 transition-all duration-1000" strokeWidth="3" strokeDasharray="100" strokeDashoffset={100 - stats.completionPct} strokeLinecap="round" />
            </svg>
            <div className="absolute text-lg font-black text-white">{stats.completionPct}<span className="text-[10px] text-ink-500">%</span></div>
          </div>
          <div className="relative z-10">
            <div className="text-[10px] font-black uppercase tracking-widest text-violet-400 flex items-center gap-1 mb-1"><Target size={12} /> Maraton İlerlemesi</div>
            <div className="text-xs font-medium text-ink-300">Bu haftaki planın <strong className="text-white">{stats.watchedCount}</strong> / {stats.total} görevini tamamladın.</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-ink-900/80 to-ink-950/80 border border-ink-800 rounded-2xl p-4 flex flex-col justify-center shadow-lg backdrop-blur-sm relative overflow-hidden">
          <div className="text-[10px] font-black uppercase tracking-widest text-azure-400 flex items-center gap-1 mb-2"><Zap size={12} /> Toplam Maraton Hacmi</div>
          <div className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tight mb-2">
            {formatDuration(stats.totalMinutes)}
          </div>
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold mt-auto">
            <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 size={10} /> {formatDuration(stats.watchedMinutes)} izlendi</span>
            <span className="text-ink-600">•</span>
            <span className="text-gold-400 flex items-center gap-1"><Hourglass size={10} /> {formatDuration(stats.pendingMinutes)} kaldı</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-ink-900/80 to-ink-950/80 border border-ink-800 rounded-2xl p-4 flex items-center justify-between shadow-lg backdrop-blur-sm relative overflow-hidden">
           <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gold-400 flex items-center gap-1 mb-1.5"><Flame size={12} /> Kalan Seyir Yükü</div>
            <div className="text-xl sm:text-2xl font-black text-white">
              {stats.pendingCount} <span className="text-sm text-ink-500 font-medium">Film</span>
            </div>
            {stats.pendingCount === 0 && stats.total > 0 ? (
              <div className="text-[10px] text-emerald-400 mt-1.5 font-bold">🎉 Tüm plan tamamlandı!</div>
            ) : (
              <div className="text-[10px] text-ink-400 mt-1.5">Vaktini iyi değerlendir.</div>
            )}
           </div>
           <div className="w-12 h-12 bg-gold-500/10 rounded-full flex items-center justify-center border border-gold-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)] flex-shrink-0">
             <Film size={20} className="text-gold-400" />
           </div>
        </div>
      </div>

      {activeTimerMovie && plan.some((p) => p.movieId === activeTimerMovie.id) && (() => {
        const info = getMovieTimerInfo(activeTimerMovie, nowMs);
        const planItem = plan.find((p) => p.movieId === activeTimerMovie.id)!;
        return (
          <div className="bg-gradient-to-r from-emerald-950/90 via-ink-900 to-ink-950 border-2 border-emerald-500/40 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(16,185,129,0.1)] animate-fade-in-up">
            <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 shadow-inner">
                <Timer size={20} className={info.isPaused ? 'text-amber-400' : 'text-emerald-400 animate-pulse'} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 truncate mb-0.5">
                  <span>{info.isPaused ? '⏸ DURAKLATILDI' : '⏳ CANLI MARATON'}</span>
                </div>
                <div className="text-sm sm:text-base font-black text-white truncate drop-shadow-sm">{activeTimerMovie.title}</div>
                <div className="text-[10px] sm:text-xs font-bold text-ink-300 mt-1 flex items-center gap-2">
                  <span className="bg-emerald-950 px-1.5 py-0.5 rounded text-emerald-300 border border-emerald-500/30 font-mono">Kalan: {info.formattedRemaining}</span>
                  <span className="opacity-60 flex items-center gap-1"><Clock size={10}/> {planItem.time} - {computeEndTime(planItem.time, activeTimerMovie.runtime)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button onClick={() => togglePauseWatchingMovie(activeTimerMovie.id)} className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-4 py-2 rounded-xl bg-ink-950 hover:bg-ink-800 text-amber-400 border border-amber-500/30 text-[11px] sm:text-xs font-black transition-colors shadow-sm">
                {info.isPaused ? <><Play size={12} className="fill-current" /> Devam</> : <><Pause size={12} /> Duraklat</>}
              </button>
              <button onClick={() => handleRequestRate(planItem, activeTimerMovie)} className={`flex-1 sm:flex-none flex items-center justify-center gap-1 px-4 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all shadow-md ${info.canRateWithTimer ? 'bg-gold-500 hover:bg-gold-400 text-ink-950' : 'bg-ink-900/60 text-ink-500 border border-ink-800 cursor-not-allowed'}`}>
                {info.canRateWithTimer ? <><Star size={12} className="fill-current" /> Bitir & Puanla</> : <><Lock size={10} /> {info.minRequiredMins - info.elapsedMins} dk</>}
              </button>
              <button onClick={() => cancelWatchingMovie(activeTimerMovie.id)} title="Sayacı İptal Et" className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex-shrink-0 transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })()}

      {viewMode === 'list' && (
        <div className="space-y-3 animate-fade-in">
          {windowDays.map((dayDate) => {
            const dateStr = toDateStr(dayDate);
            const items = groupedByDate.get(dateStr) || [];
            const isToday = dateStr === todayStrVal;
            const isDragOver = dragOverDate === dateStr;

            return (
              <div
                key={dateStr}
                onDragOver={(e) => handleDragOver(e, dateStr)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dateStr)}
                className={`rounded-2xl border transition-all duration-300 relative overflow-hidden backdrop-blur-sm ${
                  isDragOver ? 'border-violet-500 ring-2 ring-violet-500/20 bg-violet-500/5 scale-[1.01]' : isToday ? 'border-gold-500/30 bg-gradient-to-r from-gold-500/10 via-ink-900/60 to-ink-950/80 shadow-md' : 'border-ink-800/50 bg-ink-900/30'
                }`}
              >
                {isDragOver && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink-950/60 backdrop-blur-sm rounded-2xl pointer-events-none">
                    <div className="bg-violet-500 text-white font-black px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-[0_0_20px_rgba(139,92,246,0.4)] border border-violet-400">
                      <CalendarPlus size={16} /> Buraya Planla
                    </div>
                  </div>
                )}

                <div className={`flex items-center justify-between px-4 sm:px-5 py-3 border-b gap-3 ${isToday ? 'border-gold-500/20 bg-gold-500/5' : 'border-ink-800/40 bg-ink-950/30'}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`text-sm sm:text-base font-black truncate ${isToday ? 'text-gold-400' : 'text-white'}`}>{DAY_NAMES[dayDate.getDay()]}</span>
                    <span className="text-[10px] sm:text-xs font-bold text-ink-500 flex-shrink-0">{formatDayDate(dayDate)}</span>
                    {isToday && <span className="text-[9px] font-black bg-gold-500 text-ink-950 px-1.5 py-0.5 rounded flex-shrink-0 shadow-sm">BUGÜN</span>}
                  </div>
                  <button onClick={() => setShowAdd({ presetDate: dateStr })} title="Bu güne film ekle" className="w-7 h-7 flex items-center justify-center rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 transition-all shadow-sm">
                    <Plus size={14} strokeWidth={2.5} />
                  </button>
                </div>

                <div className="p-3 sm:p-4">
                  {items.length === 0 ? (
                    <div className="text-[11px] font-medium text-ink-600 text-center py-4">
                      Bu gün için planlanmış film yok.
                    </div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 -mx-1 px-1">
                      {items.map((item) => {
                        const movie = movieMap.get(item.movieId);
                        return movie ? renderListCard(item, movie) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'timeline' && (
        <div className="relative pl-6 sm:pl-16 mt-4 sm:mt-6 pb-8 animate-fade-in">
          <div className="absolute top-2 bottom-0 left-[19px] sm:left-[31px] w-0.5 bg-gradient-to-b from-transparent via-violet-500/40 to-transparent shadow-[0_0_10px_rgba(139,92,246,0.2)]"></div>

          <div className="space-y-10">
            {windowDays.map((dayDate) => {
              const dateStr = toDateStr(dayDate);
              const items = groupedByDate.get(dateStr) || [];
              if (items.length === 0) return null;
              
              const isToday = dateStr === todayStrVal;

              return (
                <div key={dateStr} className="relative">
                  <div className="flex items-center gap-3 sm:gap-5 mb-5">
                    <div className="w-14 sm:w-20 text-right flex-shrink-0">
                      <div className={`text-xs sm:text-sm font-black ${isToday ? 'text-gold-400' : 'text-white'}`}>{DAY_NAMES[dayDate.getDay()]}</div>
                      <div className="text-[9px] sm:text-[10px] font-bold text-ink-500">{formatDayDate(dayDate)}</div>
                    </div>
                    <div className="relative flex items-center justify-center w-5">
                      <div className={`w-2.5 h-2.5 rounded-full relative z-10 ${isToday ? 'bg-gold-400 ring-4 ring-gold-500/10 shadow-[0_0_10px_rgba(250,204,21,0.4)]' : 'bg-violet-500 ring-4 ring-violet-500/10'}`}></div>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-ink-800 to-transparent"></div>
                  </div>

                  <div className="space-y-3">
                    {items.map((item, idx) => {
                      const movie = movieMap.get(item.movieId);
                      if (!movie) return null;
                      
                      const timerInfo = !movie.watched && movie.startedAt ? getMovieTimerInfo(movie, nowMs) : null;
                      const endTime = computeEndTime(item.time, movie.runtime || item.runtime);
                      const anotherTimerActive = Boolean(activeTimerMovie && activeTimerMovie.id !== movie.id);
                      
                      const isPastDate = item.date < todayStrVal;
                      const isPastTimeToday = item.date === todayStrVal && item.time < currentTimeStr;
                      const isMissed = !movie.watched && (isPastDate || isPastTimeToday);
                      const isLast = idx === items.length - 1;

                      return (
                        <div key={item.id} className="flex gap-3 sm:gap-5 group">
                          <div className="w-14 sm:w-20 text-right flex-shrink-0 pt-3">
                            <div className={`text-base sm:text-lg font-black ${isMissed ? 'text-red-400' : movie.watched ? 'text-emerald-500/50' : 'text-violet-400'}`}>{item.time}</div>
                            <div className="text-[9px] sm:text-[10px] font-bold text-ink-600 mt-0.5">{endTime}</div>
                          </div>

                          <div className="relative flex justify-center w-5">
                            <div className={`absolute top-0 w-px -z-10 ${isLast ? 'bottom-0' : '-bottom-3'} ${movie.watched ? 'bg-emerald-900/30' : 'bg-ink-800 group-hover:bg-violet-500/40'} transition-colors`}></div>
                            <div className={`w-1.5 h-1.5 rounded-full mt-4.5 relative z-10 transition-all duration-300 ${
                              movie.watched ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                              isMissed ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' :
                              'bg-ink-900 border-2 border-violet-500 group-hover:bg-violet-400 group-hover:shadow-[0_0_10px_rgba(139,92,246,0.5)]'
                            }`}></div>
                          </div>

                          <div className="flex-1 pb-1">
                             <div className={`flex flex-col sm:flex-row gap-2.5 sm:gap-3 p-2.5 rounded-xl border transition-all duration-300 backdrop-blur-sm ${
                               movie.watched ? 'bg-emerald-950/10 border-emerald-900/30 opacity-70' :
                               isMissed ? 'bg-red-950/10 border-red-900/30 hover:border-red-500/40 hover:bg-red-950/20 hover:shadow-sm' :
                               'bg-ink-950/40 border-ink-800/40 hover:bg-ink-900/70 hover:border-violet-500/30 hover:shadow-md group-hover:-translate-y-0.5'
                             }`}>
                                <div className={`w-14 sm:w-16 flex-shrink-0 rounded-lg overflow-hidden aspect-[2/3] bg-ink-900 border relative ${isMissed ? 'border-red-500/30' : 'border-ink-800'}`}>
                                  {movie.posterUrl ? <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-ink-600" /></div>}
                                  {movie.watched && <div className="absolute inset-0 bg-emerald-950/60 flex items-center justify-center"><CheckCircle2 size={20} className="text-emerald-400 drop-shadow-md" /></div>}
                                </div>

                                <div className="flex-1 flex flex-col justify-center min-w-0">
                                   <div className="flex items-start justify-between gap-2">
                                      <h4 className={`text-xs sm:text-sm font-black truncate leading-tight ${movie.watched ? 'text-ink-400 line-through' : 'text-white'}`}>{movie.title}</h4>
                                   </div>
                                   
                                   <div className="flex items-center gap-1.5 mt-1 text-[10px] text-ink-400 font-medium">
                                      {movie.year && <span className="bg-ink-900 px-1 py-0.5 rounded text-ink-300 border border-ink-800">{movie.year}</span>}
                                      {movie.runtime && <span>{movie.runtime} dk</span>}
                                   </div>

                                   <div className="mt-2 flex flex-wrap items-center gap-2">
                                      {movie.watched ? (
                                         <div className="flex items-center gap-2.5">
                                           <span className="text-[11px] font-black text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                                             <CheckCircle2 size={14} /> İzlendi
                                           </span>
                                           {movie.rating !== null && (
                                             <span className={`text-sm font-black flex items-center gap-1.5 px-3 py-1 rounded-lg border shadow-md text-white border-white/20 ${ratingBgClass(movie.rating)}`}>
                                               <Star size={14} className="fill-current" /> {movie.rating}
                                             </span>
                                           )}
                                         </div>
                                      ) : isMissed ? (
                                         <>
                                           <span className="text-[10px] font-black text-red-400 flex items-center gap-1 bg-red-500/10 px-1.5 py-1 rounded"><AlertCircle size={10} /> Kaçırıldı</span>
                                           <button onClick={() => handleSnooze(item)} className="text-[10px] font-black text-ink-950 bg-gold-500 hover:bg-gold-400 px-2 py-1 rounded transition-colors ml-1 shadow-sm">Yarına Ertele</button>
                                         </>
                                      ) : timerInfo ? (
                                         <>
                                          <div className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-1.5 py-1 rounded-md text-[10px] font-bold"><Timer size={10} className={timerInfo.isPaused ? 'text-amber-400' : 'animate-pulse text-emerald-400'} /><span className="font-mono">{timerInfo.formattedRemaining}</span></div>
                                          <button onClick={() => togglePauseWatchingMovie(movie.id)} className="text-amber-300 hover:text-white p-1 bg-ink-800 hover:bg-ink-700 rounded-md">{timerInfo.isPaused ? <Play size={10} className="fill-current" /> : <Pause size={10} />}</button>
                                          <button onClick={() => cancelWatchingMovie(movie.id)} className="text-red-400 hover:text-white p-1 bg-red-500/10 hover:bg-red-500/20 rounded-md"><X size={10} /></button>
                                          <button onClick={() => handleRequestRate(item, movie)} disabled={!timerInfo.canRateWithTimer} className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-md transition-all ${timerInfo.canRateWithTimer ? 'bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 text-ink-950' : 'bg-ink-800/60 text-ink-600 cursor-not-allowed'}`}>{timerInfo.canRateWithTimer ? <><Star size={10} className="fill-current" /> Puanla</> : <Lock size={10} />}</button>
                                         </>
                                      ) : (
                                         <>
                                           <button onClick={() => startWatchingMovie(movie.id)} disabled={anotherTimerActive} className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-md transition-all ${anotherTimerActive ? 'bg-ink-900/50 text-ink-600 border border-ink-800 cursor-not-allowed' : 'bg-ink-800 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 shadow-sm'}`}>{anotherTimerActive ? <Lock size={10} /> : <Play size={10} className="fill-current" />} Başlat</button>
                                           <button onClick={() => handleRequestRate(item, movie)} className="flex items-center gap-1 bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 text-ink-950 text-[10px] font-black px-2 py-1 rounded-md transition-all shadow-sm"><Star size={10} className="fill-current" /> Puanla</button>
                                           <button onClick={() => setDeleteTarget(item)} className="p-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors ml-auto"><Trash2 size={12} /></button>
                                         </>
                                      )}
                                   </div>
                                </div>
                             </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {plan.length === 0 && (
              <div className="text-center py-10 text-ink-500 text-xs font-bold bg-ink-900/20 rounded-2xl border border-ink-800/40 mr-4 backdrop-blur-sm">
                <TimelineIcon size={32} className="mx-auto mb-3 opacity-20 text-violet-500" />
                Zaman çizelgen bomboş.
              </div>
            )}
          </div>
        </div>
      )}

      {showAdd && <AddPlanModal presetDate={showAdd.presetDate} onClose={() => setShowAdd(null)} />}

      {ratingTarget && (
        <RatingModal
          title={ratingTarget.movie.title}
          subtitle={ratingTarget.movie.year ? `Çıkış Yılı: ${ratingTarget.movie.year}` : 'Film'}
          initialIsPastWatch={false}
          onRate={(rating, note, detailedRating, reviewTags) => {
            watchMovie(ratingTarget.movie.id, rating, note, detailedRating, reviewTags, false);
            setRatingTarget(null);
          }}
          onClose={() => setRatingTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Plandan Kaldır"
          message={`"${deleteTarget.title}" haftalık plandan kaldırılacak. Emin misin?`}
          onConfirm={() => { deletePlanItem(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function TimelineIcon({ className, size }: { className?: string; size?: number }) {
  return <Activity size={size} className={className} />;
}

function AddPlanModal({ presetDate, onClose }: { presetDate?: string; onClose: () => void }) {
  const { data, addPlanItem, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [date, setDate] = useState(presetDate || toDateStr(startOfToday()));
  const [time, setTime] = useState('20:00');

  const plannedMovieIds = useMemo(() => new Set((data.weeklyPlan || []).filter((p) => !data.movies.find((m) => m.id === p.movieId)?.watched).map((p) => p.movieId)), [data.weeklyPlan, data.movies]);

  const candidates = useMemo(() => {
    return data.movies
      .filter((m) => !m.watched && !plannedMovieIds.has(m.id) && !m.inPastQueue)
      .filter((m) => !search.trim() || m.title.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')))
      .filter((m) => !collectionFilter || m.collectionId === collectionFilter)
      .filter((m) => !genreFilter || m.genres?.includes(genreFilter));
  }, [data.movies, plannedMovieIds, search, collectionFilter, genreFilter]);

  const endTimePreview = selectedMovie ? computeEndTime(time, selectedMovie.runtime) : null;

  const dayPlans = useMemo(() => {
    return (data.weeklyPlan || [])
      .filter((p) => p.date === date)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [data.weeklyPlan, date]);

  const handleConfirm = (closeAfter: boolean) => {
    if (!selectedMovie || !date || !time) return;

    const hasOverlap = dayPlans.some((p) => {
      const m = data.movies.find(x => x.id === p.movieId);
      const pDur = p.runtime || m?.runtime || 115;
      return checkOverlap(time, selectedMovie.runtime || 115, p.time, pDur);
    });

    if (hasOverlap) {
      showToast('Seçtiğiniz saatte başka bir film var! Lütfen aşağıdan kırmızı işaretli saatleri kontrol edin.', 'warning');
      return; 
    }

    addPlanItem(selectedMovie, date as any, time); 
    
    if (closeAfter) {
      onClose();
    } else {
      const duration = selectedMovie.runtime || 115;
      const [hh, mm] = time.split(':').map(Number);
      const totalMins = hh * 60 + mm + duration + 10;
      
      let nextH = Math.floor(totalMins / 60);
      const nextM = totalMins % 60;
      let nextDate = date;
      
      if (nextH >= 24) {
        nextH = nextH % 24;
        const d = new Date(date);
        d.setDate(d.getDate() + 1);
        nextDate = toDateStr(d);
        showToast('Gece yarısı geçildi, takvim yarına kaydırıldı!', 'info');
      }
      
      setTime(`${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`);
      setDate(nextDate);
      setSelectedMovie(null);
      setSearch('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-ink-900 border border-ink-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_0_30px_rgba(139,92,246,0.1)] flex flex-col max-h-[90svh] animate-fade-in-up">
        <div className="flex items-center justify-between p-4 border-b border-ink-800/80 bg-gradient-to-r from-violet-500/10 to-transparent">
          <h3 className="text-sm font-black text-white flex items-center gap-2 drop-shadow-md">
            <div className="w-6 h-6 rounded border border-violet-500/30 bg-violet-500/20 text-violet-400 flex items-center justify-center"><Sparkles size={12} /></div>
            Maraton Kurulumu
          </h3>
          <button onClick={onClose} className="text-ink-400 hover:text-white p-1.5 rounded-full hover:bg-ink-800 transition-colors"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {!selectedMovie ? (
            <>
              <div className="relative group">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-violet-400 transition-colors" />
                <input type="text" autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="İzlenecek filmlerinde ara..." className="w-full bg-ink-950 border border-ink-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-ink-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all shadow-inner" />
              </div>

              <div className="flex gap-2">
                <select value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)} className="flex-1 bg-ink-950 border border-ink-800 rounded-xl px-2.5 py-2 text-[11px] font-bold text-ink-300 focus:outline-none focus:border-violet-500 transition-colors">
                  <option value="">Koleksiyon: Tümü</option>
                  {data.collections.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
                <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} className="flex-1 bg-ink-950 border border-ink-800 rounded-xl px-2.5 py-2 text-[11px] font-bold text-ink-300 focus:outline-none focus:border-violet-500 transition-colors">
                  <option value="">Tür: Tümü</option>
                  {data.genres.map((g) => (<option key={g} value={g}>{g}</option>))}
                </select>
              </div>

              <div className="space-y-1.5 max-h-[35vh] overflow-y-auto custom-scrollbar pr-1.5">
                {candidates.length === 0 ? (
                  <div className="text-center py-8 text-xs text-ink-500 bg-ink-950/40 rounded-xl border border-ink-800/50 border-dashed mt-2">
                    <Film size={24} className="mx-auto mb-2 opacity-30 text-violet-400" />
                    Kriterlerine uygun izlenmemiş film bulunamadı.
                  </div>
                ) : (
                  candidates.map((m) => (
                    <button key={m.id} onClick={() => setSelectedMovie(m)} className="w-full flex items-center gap-3 p-2 rounded-xl bg-ink-950/40 hover:bg-ink-800 border border-ink-800/80 hover:border-violet-500/50 transition-all text-left group shadow-sm">
                      <div className="w-8 h-11 rounded-lg bg-ink-900 overflow-hidden flex-shrink-0 shadow-sm group-hover:shadow-violet-500/20 border border-ink-800/50">
                        {m.posterUrl ? <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={12} className="text-ink-600" /></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-ink-100 truncate group-hover:text-white transition-colors">{m.title}</div>
                        <div className="text-[9px] font-bold text-ink-500 mt-0.5">{m.year || 'Yıl yok'}{m.runtime ? ` • ${m.runtime} dk` : ''}</div>
                      </div>
                      <div className="w-6 h-6 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:scale-105">
                        <Plus size={12} strokeWidth={3} />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 bg-gradient-to-r from-violet-500/10 to-transparent border border-violet-500/30 rounded-xl p-3 shadow-inner mb-4">
                <div className="w-10 h-14 rounded-lg bg-ink-900 overflow-hidden flex-shrink-0 shadow-sm border border-ink-700/50">
                  {selectedMovie.posterUrl ? <img src={selectedMovie.posterUrl} alt={selectedMovie.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={12} className="text-ink-600" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-white truncate drop-shadow-sm mb-1">{selectedMovie.title}</div>
                  <div className="text-[10px] font-bold text-violet-300 bg-violet-500/10 w-fit px-1.5 py-0.5 rounded border border-violet-500/20">{selectedMovie.year}{selectedMovie.runtime ? ` • ${selectedMovie.runtime} dk` : ''}</div>
                </div>
                <button onClick={() => setSelectedMovie(null)} className="text-[10px] font-black text-ink-950 bg-violet-400 hover:bg-violet-300 px-2.5 py-1.5 rounded-lg flex-shrink-0 transition-colors shadow-sm">
                  Değiştir
                </button>
              </div>

              <div className="flex gap-3 mb-4">
                <div className="space-y-1.5 flex-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-ink-400 ml-1">Tarih</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-ink-950 border border-ink-800 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 shadow-inner transition-all" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-ink-400 ml-1 flex items-center gap-1"><Clock size={10} /> Saat</label>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-ink-950 border border-ink-800 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 shadow-inner transition-all" />
                </div>
              </div>

              <div className="bg-ink-950/60 border border-ink-800 rounded-xl p-3 shadow-inner">
                <div className="text-[9px] font-black uppercase tracking-widest text-ink-400 mb-2 flex items-center gap-1.5">
                  <CalendarDays size={12} className="text-violet-400" /> 
                  {date === toDateStr(startOfToday()) ? 'Bugünün Dolu Saatleri' : 'Seçili Günün Dolu Saatleri'}
                </div>
                
                {dayPlans.length === 0 ? (
                  <div className="text-[11px] text-emerald-400/80 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-2 rounded-lg flex items-center gap-1.5">
                    <CheckCircle2 size={14}/> Bu gün tamamen boş, maraton için harika!
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                    {dayPlans.map(p => {
                      const m = data.movies.find(x => x.id === p.movieId);
                      const pDur = p.runtime || m?.runtime || 115;
                      const pEnd = computeEndTime(p.time, pDur);
                      const isOverlapping = checkOverlap(time, selectedMovie.runtime || 115, p.time, pDur);
                      
                      return (
                        <div key={p.id} className={`flex items-center justify-between px-2.5 py-2 rounded-lg border transition-colors ${isOverlapping ? 'bg-red-500/10 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.15)]' : 'bg-ink-900 border-ink-800/50'}`}>
                           <div className="flex items-center gap-1.5 min-w-0 pr-2">
                             {isOverlapping ? <AlertCircle size={12} className="text-red-400 flex-shrink-0 animate-pulse"/> : <Film size={12} className="text-ink-500 flex-shrink-0"/>}
                             <span className={`text-[11px] font-bold truncate ${isOverlapping ? 'text-red-300' : 'text-ink-200'}`}>{p.title}</span>
                           </div>
                           <span className={`text-[9px] font-black flex-shrink-0 px-1.5 py-0.5 rounded border ${isOverlapping ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-violet-500/10 text-violet-400 border-violet-500/20'}`}>
                             {p.time} - {pEnd}
                           </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {endTimePreview && (
                <div className="mt-3 flex items-center justify-between">
                   <div className="text-[10px] text-ink-500 font-bold bg-ink-950 px-1.5 py-0.5 rounded border border-ink-800">Süre: {selectedMovie.runtime || 115} dk</div>
                   <div className="text-[11px] font-bold text-ink-300 flex items-center gap-1">
                     Tahmini Bitiş: <strong className="text-emerald-400 text-xs">{endTimePreview}</strong>
                   </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-3 sm:p-4 border-t border-ink-800/80 bg-ink-950/90 flex flex-col sm:flex-row items-center gap-2 backdrop-blur-md">
          <button onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-300 font-bold text-[11px] transition-colors">
            Vazgeç
          </button>
          
          <div className="flex items-center gap-2 w-full sm:flex-1">
            <button disabled={!selectedMovie || !date || !time} onClick={() => handleConfirm(false)} title="Kaydet ve 10 dk mola payı ile sıradaki filmi seçmeye devam et" className="flex-1 py-2.5 rounded-xl bg-ink-900 hover:bg-ink-800 text-violet-400 border border-violet-500/30 font-black text-[11px] transition-all disabled:opacity-40 disabled:hover:bg-ink-900 flex items-center justify-center gap-1 shadow-sm">
              <Plus size={12} /> Ekle & Devam Et
            </button>
            <button disabled={!selectedMovie || !date || !time} onClick={() => handleConfirm(true)} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-azure-600 hover:from-violet-500 hover:to-azure-500 text-white font-black text-[11px] transition-all disabled:opacity-40 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] border border-violet-400/50">
              Kaydet & Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}