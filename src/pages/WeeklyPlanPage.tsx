import { useState, useMemo, useEffect } from 'react';
import {
  CalendarClock, Plus, X, Search, Clock, Star, Trash2, Image as ImageIcon,
  Film, Sparkles, Play, Pause, Timer, Lock, Edit2,
  CheckCircle2, Hourglass, ArrowRight, CalendarDays,
  LayoutList, Activity, AlertCircle, GripVertical, CalendarPlus,
  Target, Zap, Flame
} from 'lucide-react';
import { useApp, getMovieTimerInfo } from '../context/AppContext';
import { ratingBgClass } from '../lib/utils';
import RatingModal from '../components/RatingModal';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Movie, WeeklyPlanItem } from '../types';

// Matematiksel beyni içeri aktarıyoruz
import { formatDuration, checkOverlap, computeEndTime } from '../lib/plannerLogic';
import { handleImgFallback } from '../lib/selectors';

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const WINDOW_SIZE = 8;

/* ══════════════════════════════════════════════════════════════
   PREMIUM GÖRSEL JETONLAR (sinevia-premium.html önizlemesiyle hizalı)
   Hafta ızgarası / sürükle-bırak / plan mantığı DEĞİŞMEZ — yalnızca
   görsel yüzeyler token fallback'li hale getirildi:
   · cam gün kartları (var(--glass, var(--bg-card)))
   · bugün / aktif gün: kırmızı kenarlık + glow (var(--red, var(--color-1, #e8384f)))
   · mono gün etiketleri (Archivo caps) + Archivo başlıklar
   · ince ayraçlar (var(--line) / var(--line-2))
   plain-dark fallback ZORUNLU kalıplar: var(--r, 16px),
   var(--red, var(--color-1, #e8384f)), var(--glass, var(--bg-card)).
   ══════════════════════════════════════════════════════════════ */
const WEEKLY_PREMIUM_CSS = `
.wp-root{
  --wp-a1:var(--red,var(--color-1,#e8384f));
  --wp-a2:var(--red-hi,var(--color-2,#ff6b7a));
  --wp-a3:var(--red-deep,var(--color-3,#8e1220));
  --wp-glass:var(--glass,var(--bg-card,rgba(255,255,255,.05)));
  --wp-surf:var(--surface,var(--bg-surface,rgba(255,255,255,.04)));
  --wp-line:var(--line,var(--border-dim,rgba(244,244,242,.07)));
  --wp-line2:var(--line-2,var(--border-dim,rgba(244,244,242,.13)));
  --wp-r:var(--r,16px);
  --wp-r-lg:var(--r-lg,22px);
  --wp-shadow:var(--shadow,0 24px 60px -24px rgba(0,0,0,.8));
  --wp-glow:var(--glow,0 0 0 1px rgba(232,56,79,.35),0 8px 32px -8px rgba(232,56,79,.45));
  --wp-inset:inset 0 1px 0 rgba(255,255,255,.07);
  --wp-mono:'Archivo',ui-sans-serif,sans-serif;
  --wp-font:'Archivo',system-ui,-apple-system,sans-serif;
}
/* Archivo başlıklar */
.wp-title{font-family:var(--wp-font);}
/* Archivo mono-etiketler (eski JetBrains Mono yerine) */
.wp-mono{font-family:var(--wp-mono);}
/* İnce ayraçlar */
.wp-hr{border-color:var(--wp-line);}
.wp-hr2{border-color:var(--wp-line2);}
/* Cam yüzeyler */
.wp-glass{background:var(--wp-glass);border:1px solid var(--wp-line2);border-radius:var(--wp-r-lg);box-shadow:var(--wp-shadow),var(--wp-inset);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);transition:border-color .3s,box-shadow .3s,transform .3s;}
.wp-glass-soft{background:color-mix(in srgb,var(--wp-surf) 70%,transparent);border:1px solid var(--wp-line);border-radius:var(--wp-r-lg);box-shadow:var(--wp-inset);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);}
/* İstatistik kartı — cam + kırmızı ışık hover */
.wp-stat{background:var(--wp-glass);border:1px solid var(--wp-line2);border-radius:var(--wp-r-lg);box-shadow:var(--wp-shadow),var(--wp-inset);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);transition:border-color .3s,box-shadow .3s,transform .3s;}
.wp-stat:hover{border-color:color-mix(in srgb,var(--wp-a1) 34%,transparent);box-shadow:var(--wp-shadow),var(--wp-glow),var(--wp-inset);}
/* Film çipi — cam */
.wp-card{position:relative;background:var(--wp-glass);border:1px solid var(--wp-line2);border-radius:var(--wp-r);box-shadow:var(--wp-inset);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);}
.wp-card:hover{border-color:color-mix(in srgb,var(--wp-a1) 50%,transparent);box-shadow:0 18px 40px -24px var(--wp-a1),var(--wp-inset);}
/* Gün kartı — cam yüzey */
.wp-day{position:relative;overflow:hidden;background:var(--wp-glass);border:1px solid var(--wp-line);border-radius:var(--wp-r-lg);box-shadow:var(--wp-shadow),var(--wp-inset);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);transition:border-color .3s,box-shadow .3s,transform .3s,background .3s;}
.wp-day::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;z-index:1;background:transparent;transition:background .3s,box-shadow .3s;}
.wp-day:hover{border-color:color-mix(in srgb,var(--wp-a1) 30%,transparent);box-shadow:0 0 36px -18px var(--wp-a1),var(--wp-inset);}
.wp-day__head{border-bottom:1px solid var(--wp-line);background:color-mix(in srgb,var(--wp-surf) 40%,transparent);}
/* Bugün / aktif gün — kırmızı kenarlık + glow */
.wp-day--today{border-color:var(--wp-a1);background:var(--wp-glass);box-shadow:0 0 0 1px var(--wp-a1),0 22px 50px -26px var(--wp-a1),var(--wp-inset);}
.wp-day--today::before{background:var(--wp-a1);box-shadow:0 0 12px var(--wp-a1);}
.wp-day--today .wp-day__head{border-color:var(--wp-a1);background:color-mix(in srgb,var(--wp-a1) 10%,transparent);}
.wp-day--over{border-color:var(--wp-a1);transform:scale(1.01);box-shadow:0 0 0 3px color-mix(in srgb,var(--wp-a1) 20%,transparent),0 24px 54px -24px var(--wp-a1),var(--wp-inset);}
.wp-day--over::before{background:var(--wp-a1);box-shadow:0 0 12px var(--wp-a1);}
/* BUGÜN hapı — kırmızı gradyan */
.wp-pill{background:linear-gradient(140deg,var(--wp-a2),var(--wp-a3));color:#fff;box-shadow:0 4px 14px -4px var(--wp-a1),inset 0 1px 0 rgba(255,255,255,.35);}
`;

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

export default function WeeklyPlanPage() {
  const { data, deletePlanItem, startWatchingMovie, togglePauseWatchingMovie, cancelWatchingMovie, canRateMovieWithTimer, watchMovie } = useApp();
  
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [showAdd, setShowAdd] = useState<{ presetDate?: string } | null>(null);
  
  const [editPlanTarget, setEditPlanTarget] = useState<{ item: WeeklyPlanItem; presetDate?: string } | null>(null);
  const [ratingTarget, setRatingTarget] = useState<{ item: WeeklyPlanItem; movie: Movie } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WeeklyPlanItem | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [draggedItem, setDraggedItem] = useState<WeeklyPlanItem | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const plan = data.weeklyPlan || [];
  const today = useMemo(() => startOfToday(), []);
  const todayStrVal = toDateStr(today);

  const currentTimeStr = useMemo(() => {
    const d = new Date(nowMs);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, [nowMs]);

  const activeTimerMovie = useMemo(() => data.movies.find((m) => !m.watched && m.startedAt) || null, [data.movies]);

  // Sayaç tick'i: yalnız aktif geri sayım varken 1sn'de bir (timer barı birebir aynı).
  // Boşta: yalnız dakika sınırında tazele — geçmiş-saat vurgusu (currentTimeStr) doğru kalsın,
  // ama 60 render/dakika yerine 1 render/dakika.
  useEffect(() => {
    if (activeTimerMovie) {
      setNowMs(Date.now());
      const interval = setInterval(() => setNowMs(Date.now()), 1000);
      return () => clearInterval(interval);
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timeout = setTimeout(() => {
        setNowMs(Date.now());
        schedule();
      }, 60000 - (Date.now() % 60000));
    };
    schedule();
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [activeTimerMovie]);

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
    setEditPlanTarget({ item, presetDate: tomorrowStr });
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
      setEditPlanTarget({ item: draggedItem, presetDate: dateStr });
    }
  };

  const renderListCard = (item: WeeklyPlanItem, movie: Movie) => {
    const timerInfo = !movie.watched && movie.startedAt ? getMovieTimerInfo(movie, nowMs) : null;
    // TYPESCRIPT DÜZELTMESİ: runtime tanımsızsa varsayılan 115 kullan
    const endTime = computeEndTime(item.time, movie.runtime || item.runtime || 115);
    const anotherTimerActive = Boolean(activeTimerMovie && activeTimerMovie.id !== movie.id);

    const isPastDate = item.date < todayStrVal;
    const isPastTimeToday = item.date === todayStrVal && item.time < currentTimeStr;
    const isMissed = !movie.watched && (isPastDate || isPastTimeToday);

    return (
      <div
        draggable onDragStart={(e) => handleDragStart(e, item)} onDragEnd={handleDragEnd} key={item.id}
        className={`group relative flex-shrink-0 flex gap-2.5 sm:gap-3 transition-all duration-300 animate-fade-in border rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing backdrop-blur-xl w-[250px] sm:w-[280px] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
          movie.watched ? 'bg-emerald-950/20 border-emerald-500/20 opacity-80 hover:opacity-100' : isMissed ? 'bg-red-950/20 border-red-500/40 shadow-[0_0_18px_-8px_rgba(239,68,68,0.6)] hover:shadow-[0_0_24px_-8px_rgba(239,68,68,0.8)] hover:border-red-500/60' : 'wp-card hover:-translate-y-0.5'
        }`}
      >
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={14} className="text-ink-600 hover:text-white" />
        </div>

        <div className={`w-12 sm:w-14 aspect-[2/3] flex-shrink-0 rounded-xl overflow-hidden bg-ink-900 border relative ${isMissed ? 'border-red-500/30' : 'border-ink-800'}`}>
          {movie.posterUrl ? <img loading="lazy" decoding="async" src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover"  onError={handleImgFallback}/> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-ink-600" /></div>}
          {movie.watched && <div className="absolute inset-0 bg-emerald-950/70 flex items-center justify-center backdrop-blur-[2px]"><CheckCircle2 size={16} className="text-emerald-400 drop-shadow-md" /></div>}
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-between pt-0.5">
          <div>
            <div className={`flex items-center gap-1 text-[9px] sm:text-[10px] font-black tracking-wider mb-1 ${isMissed ? 'text-red-400' : 'text-gold-400'}`}>
              <Clock size={10} /> {item.time} <ArrowRight size={10} className="text-ink-600 mx-0.5" /> {endTime}
            </div>
            <div className={`text-[11px] sm:text-xs font-black truncate leading-tight uppercase tracking-tight ${movie.watched ? 'text-ink-400 line-through' : 'text-white'}`}>{movie.title}</div>
            <div className="flex items-center gap-2 mt-1">
              {movie.year && <span className="text-[9px] font-bold text-ink-400 bg-ink-950 px-1.5 py-0.5 rounded-md border border-ink-800/60">{movie.year}</span>}
            </div>
          </div>

          <div className="mt-2.5">
            {movie.watched ? (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-emerald-400 bg-emerald-500/10 w-fit px-2 py-1 rounded-lg border border-emerald-500/20">
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
                <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-red-400 bg-red-500/10 px-2 py-1 rounded-lg"><AlertCircle size={10} /> Kaçırıldı</div>
                <button onClick={() => handleSnooze(item)} className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-ink-950 bg-gold-500 hover:brightness-110 hover:shadow-[0_0_16px_-6px_var(--color-1)] px-2 py-1 min-h-11 md:min-h-0 rounded-lg transition-all"><CalendarPlus size={10} /> Ertele / Taşı</button>
              </div>
            ) : timerInfo ? (
              <div className="flex items-center gap-1 flex-wrap">
                <div className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-1.5 py-1 rounded-md text-[9px] sm:text-[10px] font-bold"><Timer size={10} className={timerInfo.isPaused ? 'text-amber-400' : 'animate-pulse text-emerald-400'} /><span className="tabular-nums">{timerInfo.formattedRemaining}</span></div>
                <button onClick={() => togglePauseWatchingMovie(movie.id)} className="text-amber-300 hover:text-white p-1 min-h-11 min-w-11 md:min-h-0 md:min-w-0 flex items-center justify-center bg-ink-800 hover:bg-ink-700 rounded-md">{timerInfo.isPaused ? <Play size={10} className="fill-current" /> : <Pause size={10} />}</button>
                <button onClick={() => cancelWatchingMovie(movie.id)} className="text-red-400 hover:text-white p-1 min-h-11 min-w-11 md:min-h-0 md:min-w-0 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 rounded-md"><X size={10} /></button>
                <button onClick={() => handleRequestRate(item, movie)} disabled={!timerInfo.canRateWithTimer} className={`flex items-center gap-1 text-[9px] sm:text-[10px] font-black px-2 py-1 min-h-11 md:min-h-0 rounded-md transition-all ${timerInfo.canRateWithTimer ? 'bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:brightness-110 hover:shadow-[0_8px_20px_-10px_var(--color-1)] text-ink-950' : 'bg-ink-800/60 text-ink-600 cursor-not-allowed'}`}>{timerInfo.canRateWithTimer ? <><Star size={10} className="fill-current" /> Puanla</> : <Lock size={10} />}</button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={() => startWatchingMovie(movie.id)} disabled={anotherTimerActive} title={anotherTimerActive ? 'Başka bir filmin sayacı açık!' : 'Geri Sayımı Başlat'} className={`flex items-center justify-center gap-1 text-[9px] sm:text-[10px] font-black px-2 py-1.5 min-h-11 min-w-11 md:min-h-0 md:min-w-0 rounded-lg border transition-all ${anotherTimerActive ? 'bg-ink-900/50 text-ink-600 border-ink-800 cursor-not-allowed' : 'bg-ink-800 hover:bg-emerald-900/30 text-emerald-400 border-emerald-500/30'}`}>{anotherTimerActive ? <Lock size={10} /> : <Play size={10} className="fill-current" />}</button>
                <button onClick={() => handleRequestRate(item, movie)} className="flex-1 flex items-center justify-center gap-1 bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:brightness-110 hover:shadow-[0_8px_20px_-10px_var(--color-1)] text-ink-950 text-[9px] sm:text-[10px] font-black px-2 py-1.5 min-h-11 md:min-h-0 rounded-lg transition-all shadow-sm"><Star size={10} className="fill-current" /> Puanla</button>
                <button onClick={() => setEditPlanTarget({ item })} className="p-1.5 min-h-11 min-w-11 md:min-h-0 md:min-w-0 flex items-center justify-center rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-300 transition-colors shadow-sm"><Edit2 size={12} /></button>
                <button onClick={() => setDeleteTarget(item)} className="p-1.5 min-h-11 min-w-11 md:min-h-0 md:min-w-0 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"><Trash2 size={12} /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTimelineCard = (item: WeeklyPlanItem, movie: Movie) => {
    const timerInfo = !movie.watched && movie.startedAt ? getMovieTimerInfo(movie, nowMs) : null;
    // TYPESCRIPT DÜZELTMESİ: runtime tanımsızsa varsayılan 115 kullan
    const endTime = computeEndTime(item.time, movie.runtime || item.runtime || 115);
    const anotherTimerActive = Boolean(activeTimerMovie && activeTimerMovie.id !== movie.id);

    const isPastDate = item.date < todayStrVal;
    const isPastTimeToday = item.date === todayStrVal && item.time < currentTimeStr;
    const isMissed = !movie.watched && (isPastDate || isPastTimeToday);

    return (
      <div className={`relative w-full max-w-2xl rounded-xl sm:rounded-2xl overflow-hidden border transition-all animate-fade-in flex flex-row shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_46px_-28px_rgba(0,0,0,0.9)] ${
        movie.watched ? 'bg-emerald-950/10 border-emerald-500/30 opacity-80' : isMissed ? 'bg-red-950/20 border-red-500/40 shadow-[0_0_18px_-8px_rgba(239,68,68,0.6)]' : 'wp-card hover:border-gold-500/50'
      }`}>
        <div className="w-20 sm:w-24 h-auto flex-shrink-0 bg-ink-950 relative">
          {movie.posterUrl ? <img loading="lazy" decoding="async" src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover opacity-90"  onError={handleImgFallback}/> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={20} className="text-ink-600" /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-transparent sm:bg-gradient-to-r" />
          {movie.watched && <div className="absolute inset-0 bg-emerald-950/60 flex items-center justify-center backdrop-blur-[2px]"><CheckCircle2 size={24} className="text-emerald-400 drop-shadow-md" /></div>}
        </div>

        <div className="p-3 sm:p-4 flex-1 flex flex-col justify-center min-w-0">
          <div className="flex items-start justify-between gap-2 sm:gap-3 mb-1.5">
            <div className="min-w-0">
              <h4 className={`text-xs sm:text-base font-black leading-tight truncate uppercase tracking-tight ${movie.watched ? 'text-ink-400 line-through' : 'text-white'}`}>{movie.title}</h4>
              <div className="flex items-center gap-2 mt-1 text-[9px] sm:text-[11px]">
                {movie.year && <span className="font-bold text-ink-300 bg-ink-950 px-1.5 py-0.5 rounded border border-ink-800">{movie.year}</span>}
                <span className="font-medium text-ink-400 flex items-center gap-1"><Clock size={10} className="text-gold-400" /> {endTime}</span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-ink-800/50 flex flex-wrap items-center gap-2 sm:gap-2.5">
            {movie.watched ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-[11px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
                  <CheckCircle2 size={12} sm-size={14} /> İzlendi
                </span>
                {movie.rating !== null && (
                  <span className={`text-xs sm:text-sm font-black text-white px-2.5 py-1 sm:px-3 rounded-lg border shadow-md flex items-center gap-1.5 border-white/20 ${ratingBgClass(movie.rating)}`}>
                    <Star size={12} sm-size={14} className="fill-current" /> {movie.rating}
                  </span>
                )}
              </div>
            ) : isMissed ? (
              <>
                <span className="text-[10px] sm:text-[11px] font-black text-red-400 bg-red-500/10 px-2 py-1 sm:px-2.5 sm:py-1.5 min-h-9 md:min-h-0 flex items-center w-fit rounded-lg border border-red-500/20 gap-1.5"><AlertCircle size={10} sm-size={12} /> Kaçırıldı</span>
                <button onClick={() => handleSnooze(item)} className="text-[10px] sm:text-[11px] font-black text-ink-950 bg-gold-500 hover:brightness-110 hover:shadow-[0_0_16px_-6px_var(--color-1)] px-2.5 py-1 sm:px-3 sm:py-1.5 min-h-11 md:min-h-0 rounded-lg transition-all shadow-sm flex items-center">Ertele / Taşı</button>
              </>
            ) : timerInfo ? (
              <>
                <div className="flex items-center gap-1 sm:gap-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold shadow-inner">
                  <Timer size={10} sm-size={12} className={timerInfo.isPaused ? 'text-amber-400' : 'animate-pulse text-emerald-400'} />
                  <span className="tabular-nums">{timerInfo.formattedRemaining}</span>
                </div>
                <button onClick={() => togglePauseWatchingMovie(movie.id)} className="text-amber-300 hover:text-white p-1 sm:p-1.5 min-h-11 min-w-11 md:min-h-0 md:min-w-0 flex items-center justify-center bg-ink-800 hover:bg-ink-700 rounded-lg transition-colors border border-amber-500/20">
                  {timerInfo.isPaused ? <Play size={10} sm-size={12} className="fill-current" /> : <Pause size={10} sm-size={12} />}
                </button>
                <button onClick={() => cancelWatchingMovie(movie.id)} className="text-red-400 hover:text-white p-1 sm:p-1.5 min-h-11 min-w-11 md:min-h-0 md:min-w-0 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
                  <X size={10} sm-size={12} />
                </button>
                <button onClick={() => handleRequestRate(item, movie)} disabled={!timerInfo.canRateWithTimer} className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-black px-2 py-1 sm:px-3 sm:py-1.5 min-h-11 md:min-h-0 rounded-lg transition-all shadow-md ${timerInfo.canRateWithTimer ? 'bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 hover:brightness-110 hover:shadow-[0_8px_20px_-10px_var(--color-1)] text-ink-950' : 'bg-ink-800/60 text-ink-600 cursor-not-allowed'}`}>
                  {timerInfo.canRateWithTimer ? <><Star size={10} sm-size={11} className="fill-current" /> Puanla</> : <Lock size={10} sm-size={11} />}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => startWatchingMovie(movie.id)} disabled={anotherTimerActive} className={`flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[11px] font-black px-2.5 py-1.5 sm:px-3 min-h-11 md:min-h-0 rounded-lg transition-all border shadow-sm ${anotherTimerActive ? 'bg-ink-900/50 text-ink-600 border-ink-800 cursor-not-allowed' : 'bg-ink-800 hover:bg-emerald-900/40 text-emerald-400 border-emerald-500/40'}`}>
                  {anotherTimerActive ? <Lock size={10} sm-size={12} /> : <Play size={10} sm-size={12} className="fill-current" />} Başlat
                </button>
                <button onClick={() => handleRequestRate(item, movie)} className="flex items-center gap-1 sm:gap-1.5 bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 hover:brightness-110 hover:shadow-[0_8px_20px_-10px_var(--color-1)] text-ink-950 text-[9px] sm:text-[11px] font-black px-2.5 py-1.5 sm:px-3 min-h-11 md:min-h-0 rounded-lg transition-all shadow-sm">
                  <Star size={10} sm-size={12} className="fill-current" /> Puanla
                </button>
                <button onClick={() => setEditPlanTarget({ item })} className="p-1.5 sm:p-2 min-h-11 min-w-11 md:min-h-0 md:min-w-0 flex items-center justify-center rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-300 transition-colors ml-auto">
                  <Edit2 size={12} sm-size={14} />
                </button>
                <button onClick={() => setDeleteTarget(item)} className="p-1.5 sm:p-2 min-h-11 min-w-11 md:min-h-0 md:min-w-0 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors ml-1.5">
                  <Trash2 size={12} sm-size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="wp-root space-y-4 sm:space-y-6 pb-8 animate-fade-in">
      <style>{WEEKLY_PREMIUM_CSS}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <h1 className="wp-title text-2xl sm:text-3xl font-black uppercase tracking-tight text-white flex items-center gap-3 drop-shadow-md">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-gold-600 to-gold-700 border border-white/20 flex items-center justify-center shadow-[0_10px_28px_-10px_var(--color-1),inset_0_1px_0_rgba(255,255,255,0.35)]">
            <CalendarClock size={18} sm-size={20} className="text-white" />
          </div>
          <div>
            <div className="leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-ink-200">Haftalık Planlayıcı</div>
            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.26em] text-ink-500 mt-1">maraton · haftalık ızgara</div>
          </div>
        </h1>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          <div data-tutorial="plan-view" className="flex bg-ink-950/80 p-1 rounded-xl border border-ink-800/80 shadow-inner w-full sm:w-auto backdrop-blur-xl">
            <button onClick={() => setViewMode('list')} className={`flex-1 sm:w-28 flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-11 sm:min-h-0 rounded-lg text-[11px] font-black uppercase tracking-[0.14em] transition-all ${viewMode === 'list' ? 'bg-gradient-to-r from-gold-600 to-gold-700 text-white shadow-[0_8px_20px_-8px_var(--color-1)]' : 'text-ink-500 hover:text-ink-200'}`}>
              <LayoutList size={13} /> PANO
            </button>
            <button onClick={() => setViewMode('timeline')} className={`flex-1 sm:w-28 flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-11 sm:min-h-0 rounded-lg text-[11px] font-black uppercase tracking-[0.14em] transition-all ${viewMode === 'timeline' ? 'bg-gradient-to-r from-gold-600 to-gold-700 text-white shadow-[0_8px_20px_-8px_var(--color-1)]' : 'text-ink-500 hover:text-ink-200'}`}>
              <Activity size={13} /> ÇİZELGE
            </button>
          </div>
          <button onClick={() => setShowAdd({})} data-tutorial="plan-add" className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-gradient-to-r from-gold-600 to-gold-700 text-white px-5 py-2.5 sm:py-2.5 min-h-11 sm:min-h-0 rounded-xl font-black text-xs uppercase tracking-[0.1em] shadow-[0_10px_28px_-10px_var(--color-1),inset_0_1px_0_rgba(255,255,255,0.3)] hover:shadow-[0_16px_36px_-10px_var(--color-1)] hover:-translate-y-0.5 transition-all">
            <Plus size={16} strokeWidth={3} /> Maraton Planla
          </button>
        </div>
      </div>

      <div className="wp-hr2 border-t" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="wp-stat relative overflow-hidden group p-4 flex items-center gap-3 sm:gap-4">
          <div className="absolute -right-4 -bottom-4 text-ink-800/20 transition-opacity group-hover:opacity-60"><Target size={80} /></div>
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" className="stroke-ink-800" strokeWidth="3" />
              <circle cx="18" cy="18" r="16" fill="none" className="stroke-[var(--color-1)] transition-all duration-1000 drop-shadow-[0_0_6px_var(--color-1)]" strokeWidth="3" strokeDasharray="100" strokeDashoffset={100 - stats.completionPct} strokeLinecap="round" />
            </svg>
            <div className="absolute text-sm sm:text-lg font-black text-white">{stats.completionPct}<span className="text-[9px] sm:text-[10px] text-ink-500">%</span></div>
          </div>
          <div className="relative z-10">
            <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] text-gold-400 flex items-center gap-1 mb-0.5"><Target size={12} /> Maraton İlerlemesi</div>
            <div className="text-[11px] sm:text-xs font-medium text-ink-300">Bu haftaki planın <strong className="text-white">{stats.watchedCount}</strong> / {stats.total} görevini tamamladın.</div>
          </div>
        </div>

        <div className="wp-stat p-4 flex flex-col justify-center relative overflow-hidden">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] text-azure-400 flex items-center gap-1 mb-1.5"><Zap size={12} /> Toplam Maraton Hacmi</div>
          <div className="text-xl sm:text-2xl font-black text-white leading-none tracking-tight mb-2">
            {formatDuration(stats.totalMinutes)}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-auto">
            <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 size={10} /> {formatDuration(stats.watchedMinutes)} izlendi</span>
            <span className="text-ink-600">•</span>
            <span className="text-gold-400 flex items-center gap-1"><Hourglass size={10} /> {formatDuration(stats.pendingMinutes)} kaldı</span>
          </div>
        </div>

        <div className="wp-stat p-4 flex items-center justify-between relative overflow-hidden">
           <div>
            <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] text-gold-400 flex items-center gap-1 mb-1"><Flame size={12} /> Kalan Seyir Yükü</div>
            <div className="text-lg sm:text-xl font-black text-white">
              {stats.pendingCount} <span className="text-[11px] sm:text-xs text-ink-500 font-medium font-sans">Film</span>
            </div>
            {stats.pendingCount === 0 && stats.total > 0 ? (
              <div className="text-[9px] sm:text-[10px] text-emerald-400 mt-1 font-bold">🎉 Tüm plan tamamlandı!</div>
            ) : (
              <div className="text-[9px] sm:text-[10px] text-ink-400 mt-1">Vaktini iyi değerlendir.</div>
            )}
           </div>
           <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gold-500/10 rounded-full flex items-center justify-center border border-gold-500/30 shadow-[0_0_18px_-6px_var(--color-1)] flex-shrink-0">
             <Film size={18} className="text-gold-400" />
           </div>
        </div>
      </div>

      {activeTimerMovie && plan.some((p) => p.movieId === activeTimerMovie.id) && (() => {
        const info = getMovieTimerInfo(activeTimerMovie, nowMs);
        const planItem = plan.find((p) => p.movieId === activeTimerMovie.id)!;
        return (
          <div className="bg-gradient-to-r from-emerald-950/70 via-ink-900 to-ink-950 border border-emerald-500/40 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_30px_-14px_rgba(16,185,129,0.8)] backdrop-blur-xl animate-fade-in-up relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_0_14px_rgba(16,185,129,0.8)]"></div>
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 w-full sm:w-auto">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 shadow-inner">
                <Timer size={16} sm-size={20} className={info.isPaused ? 'text-amber-400' : 'text-emerald-400 animate-pulse'} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 truncate mb-0.5">
                  <span>{info.isPaused ? '⏸ DURAKLATILDI' : '⏳ CANLI MARATON'}</span>
                </div>
                <div className="text-xs sm:text-sm font-black text-white truncate drop-shadow-sm">{activeTimerMovie.title}</div>
                <div className="text-[9px] sm:text-[10px] font-bold text-ink-300 mt-1 flex items-center gap-1.5 sm:gap-2">
                  <span className="bg-emerald-950 px-1.5 py-0.5 rounded text-emerald-300 border border-emerald-500/30">Kalan: {info.formattedRemaining}</span>
                  {/* TYPESCRIPT DÜZELTMESİ: runtime tanımsızsa varsayılan 115 kullan */}
                  <span className="opacity-60 flex items-center gap-1"><Clock size={10}/> {planItem.time} - {computeEndTime(planItem.time, activeTimerMovie.runtime || 115)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto justify-end">
              <button onClick={() => togglePauseWatchingMovie(activeTimerMovie.id)} className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 sm:px-4 sm:py-2 min-h-11 md:min-h-0 rounded-xl bg-ink-950 hover:bg-ink-800 text-amber-400 border border-amber-500/30 text-[10px] sm:text-[11px] font-black transition-colors shadow-sm whitespace-nowrap">
                {info.isPaused ? <><Play size={10} sm-size={12} className="fill-current" /> Devam</> : <><Pause size={10} sm-size={12} /> Duraklat</>}
              </button>
              <button onClick={() => handleRequestRate(planItem, activeTimerMovie)} className={`flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 sm:px-4 sm:py-2 min-h-11 md:min-h-0 rounded-xl text-[10px] sm:text-[11px] font-black transition-all shadow-md whitespace-nowrap ${info.canRateWithTimer ? 'bg-gold-500 hover:brightness-110 hover:shadow-[0_0_18px_-6px_var(--color-1)] text-ink-950' : 'bg-ink-900/60 text-ink-500 border border-ink-800 cursor-not-allowed'}`}>
                {info.canRateWithTimer ? <><Star size={10} sm-size={12} className="fill-current" /> Bitir & Puanla</> : <><Lock size={10} /> {info.minRequiredMins - info.elapsedMins} dk</>}
              </button>
              <button onClick={() => cancelWatchingMovie(activeTimerMovie.id)} title="Sayacı İptal Et" className="p-2 min-h-11 min-w-11 md:min-h-0 md:min-w-0 flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex-shrink-0 transition-colors">
                <X size={12} sm-size={14} />
              </button>
            </div>
          </div>
        );
      })()}

      {viewMode === 'list' && (
        <div className="space-y-3 sm:space-y-4 animate-fade-in" data-tutorial="plan-timeline">
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
                className={`group/day wp-day ${isDragOver ? 'wp-day--over' : isToday ? 'wp-day--today' : ''}`}
              >
                {isDragOver && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink-950/60 backdrop-blur-sm rounded-2xl pointer-events-none">
                    <div className="bg-gold-500 text-white font-black px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-[0_0_24px_var(--color-1)] border border-white/20 text-[11px] uppercase tracking-[0.14em]">
                      <CalendarPlus size={16} /> Buraya Planla
                    </div>
                  </div>
                )}

                <div className="wp-day__head flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`wp-mono text-[9px] font-black uppercase tracking-[0.14em] px-1.5 py-0.5 rounded flex-shrink-0 leading-none ${isToday ? 'text-white bg-gradient-to-br from-gold-500 to-gold-700 shadow-[0_4px_14px_-4px_var(--color-1)]' : 'text-ink-500 bg-ink-800/60 border border-ink-800'}`}>
                      {String(dayDate.getDate()).padStart(2, '0')}
                    </span>
                    <span className={`wp-mono text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] truncate ${isToday ? 'text-gold-400' : 'text-white'}`}>{DAY_NAMES[dayDate.getDay()]}</span>
                    <span className="wp-mono text-[10px] sm:text-xs font-bold text-ink-500 flex-shrink-0">{formatDayDate(dayDate)}</span>
                    {isToday && <span className="wp-mono wp-pill text-[9px] font-black uppercase tracking-[0.16em] px-2 py-0.5 rounded flex-shrink-0">BUGÜN</span>}
                  </div>
                  <button onClick={() => setShowAdd({ presetDate: dateStr })} title="Bu güne film ekle" className="w-11 h-11 md:w-7 md:h-7 flex items-center justify-center rounded-lg bg-gold-500/10 hover:!bg-[var(--blob-2)] text-gold-400 border border-gold-500/30 hover:!border-[var(--color-2)] hover:shadow-[0_0_16px_-4px_var(--color-1)] transition-all">
                    <Plus size={14} strokeWidth={2.5} />
                  </button>
                </div>

                <div className="p-3 sm:p-4">
                  {items.length === 0 ? (
                    <div className="wp-mono font-semibold text-[10px] uppercase tracking-[0.2em] text-ink-600 text-center py-4 border border-dashed border-ink-800/60 rounded-xl">
                      Bu gün için planlanmış film yok.
                    </div>
                  ) : (
                    <div className="flex gap-2.5 sm:gap-3 overflow-x-auto custom-scrollbar pb-2 -mx-1 px-1">
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
        <div data-tutorial="plan-timeline" className="relative pl-6 sm:pl-16 mt-4 sm:mt-6 pb-8 animate-fade-in">
          <div className="absolute top-2 bottom-0 left-[19px] sm:left-[31px] w-0.5 opacity-50 rounded-full" style={{ background: 'linear-gradient(to bottom, transparent, var(--color-1) 18%, var(--color-1) 82%, transparent)' }}></div>

          <div className="space-y-8 sm:space-y-10">
            {windowDays.map((dayDate) => {
              const dateStr = toDateStr(dayDate);
              const items = groupedByDate.get(dateStr) || [];
              if (items.length === 0) return null;
              
              const isToday = dateStr === todayStrVal;

              return (
                <div key={dateStr} className="relative">
                  <div className="flex items-center gap-3 sm:gap-5 mb-4 sm:mb-5">
                    <div className="w-14 sm:w-20 text-right flex-shrink-0">
                      <div className={`wp-mono text-[11px] sm:text-xs font-black uppercase tracking-[0.16em] ${isToday ? 'text-gold-400' : 'text-white'}`}>{DAY_NAMES[dayDate.getDay()]}</div>
                      <div className="wp-mono text-[9px] sm:text-[10px] font-bold text-ink-500">{formatDayDate(dayDate)}</div>
                    </div>
                    <div className="relative flex items-center justify-center w-5">
                      <div className={`w-2.5 h-2.5 rounded-full relative z-10 transition-all ${isToday ? 'bg-gold-500 ring-4 ring-[var(--blob-1)] shadow-[0_0_14px_var(--color-1)]' : 'bg-gold-500/10 border border-gold-500/30 ring-4 ring-[var(--blob-1)]'}`}></div>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-ink-800 to-transparent"></div>
                    {isToday && <span className="wp-mono wp-pill text-[9px] font-black uppercase tracking-[0.16em] px-2 py-0.5 rounded flex-shrink-0">BUGÜN</span>}
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {items.map((item, idx) => {
                      const movie = movieMap.get(item.movieId);
                      if (!movie) return null;
                      
                      const isLast = idx === items.length - 1;

                      return (
                        <div key={item.id} className="flex gap-3 sm:gap-5 group">
                          <div className="w-14 sm:w-20 text-right flex-shrink-0 pt-3">
                            <div className={`wp-mono text-base sm:text-lg font-black ${!movie.watched && (item.date < todayStrVal || (item.date === todayStrVal && item.time < currentTimeStr)) ? 'text-red-400' : movie.watched ? 'text-emerald-500/50' : 'text-gold-400'}`}>{item.time}</div>
                            {/* TYPESCRIPT DÜZELTMESİ: runtime tanımsızsa varsayılan 115 kullan */}
                            <div className="wp-mono text-[9px] sm:text-[10px] font-bold text-ink-600 mt-0.5">{computeEndTime(item.time, movie.runtime || item.runtime || 115)}</div>
                          </div>

                          <div className="relative flex justify-center w-5">
                            <div className={`absolute top-0 w-px -z-10 ${isLast ? 'bottom-0' : '-bottom-3 sm:-bottom-4'} ${movie.watched ? 'bg-emerald-900/30' : 'bg-ink-800 group-hover:bg-[var(--color-1)]'} transition-colors`}></div>
                            <div className={`w-1.5 h-1.5 rounded-full mt-4.5 relative z-10 transition-all duration-300 ${
                              movie.watched ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                              !movie.watched && (item.date < todayStrVal || (item.date === todayStrVal && item.time < currentTimeStr)) ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' :
                              'bg-ink-900 border-2 border-gold-500 group-hover:bg-gold-500 group-hover:shadow-[0_0_12px_var(--color-1)]'
                            }`}></div>
                          </div>

                          <div className="flex-1 pb-1">
                             {renderTimelineCard(item, movie)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {plan.length === 0 && (
              <div className="wp-glass-soft wp-mono text-center py-10 text-ink-500 text-[11px] uppercase tracking-[0.2em] font-bold mr-4">
                <TimelineIcon size={32} className="mx-auto mb-3 opacity-20 text-gold-400" />
                Zaman çizelgen bomboş.
              </div>
            )}
          </div>
        </div>
      )}

      {showAdd && <AddPlanModal presetDate={showAdd.presetDate} onClose={() => setShowAdd(null)} />}
      
      {editPlanTarget && (
        <EditPlanModal 
          item={editPlanTarget.item} 
          presetDate={editPlanTarget.presetDate} 
          onClose={() => setEditPlanTarget(null)} 
        />
      )}

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
          message={`"${deleteTarget.title || 'Bu yapım'}" haftalık plandan kaldırılacak. Emin misin?`}
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

  const endTimePreview = selectedMovie ? computeEndTime(time, selectedMovie.runtime || 115) : null;

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
      <div onClick={(e) => e.stopPropagation()} className="wp-glass w-full max-w-lg overflow-hidden flex flex-col max-h-[90svh] animate-fade-in-up">
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-ink-800/80 bg-gradient-to-r from-gold-500/10 to-transparent relative">
          <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-gold-500 via-gold-500/40 to-transparent"></div>
          <h3 className="wp-title text-[13px] sm:text-sm font-bold text-white flex items-center gap-2 drop-shadow-md uppercase tracking-wide">
            <div className="w-6 h-6 rounded border border-gold-500/30 bg-gold-500/10 text-gold-400 flex items-center justify-center"><Sparkles size={12} /></div>
            Maraton Kurulumu
          </h3>
          <button onClick={onClose} className="text-ink-400 hover:text-white p-1.5 min-h-11 min-w-11 md:min-h-0 md:min-w-0 flex items-center justify-center rounded-full hover:bg-ink-800 transition-colors"><X size={16} /></button>
        </div>

        <div className="p-3.5 sm:p-4 space-y-3 sm:space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {!selectedMovie ? (
            <>
              <div className="relative group">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted,#9a9a96)] group-focus-within:text-[color:var(--red,var(--color-1,#e8384f))] transition-colors" />
                <input type="text" autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="İzlenecek filmlerinde ara..." className="w-full h-11 bg-[color:var(--bg-surface,#12121a)] border border-[color:var(--line,var(--border-dim))] rounded-xl pl-9 pr-3 text-xs sm:text-sm text-[color:var(--text-main,#f4f4f2)] placeholder:text-[color:var(--muted,#9a9a96)] focus:outline-none focus:border-[color:var(--red,var(--color-1,#e8384f))] focus:ring-1 focus:ring-[color:var(--red,var(--color-1,#e8384f))] transition-all" />
              </div>

              <div className="flex gap-2">
                <select value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)} className="flex-1 bg-ink-950 border border-ink-800 rounded-xl px-2.5 py-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-ink-300 focus:outline-none focus:border-gold-500/50 transition-colors">
                  <option value="">Koleksiyon: Tümü</option>
                  {data.collections.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
                <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} className="flex-1 bg-ink-950 border border-ink-800 rounded-xl px-2.5 py-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-ink-300 focus:outline-none focus:border-gold-500/50 transition-colors">
                  <option value="">Tür: Tümü</option>
                  {data.genres.map((g) => (<option key={g} value={g}>{g}</option>))}
                </select>
              </div>

              <div className="space-y-1.5 max-h-[35dvh] overflow-y-auto custom-scrollbar pr-1.5">
                {candidates.length === 0 ? (
                  <div className="wp-mono text-center py-6 sm:py-8 text-[11px] sm:text-xs uppercase tracking-[0.16em] text-ink-500 bg-ink-950/40 rounded-xl border border-dashed border-ink-800/60 mt-2">
                    <Film size={20} sm-size={24} className="mx-auto mb-2 opacity-30 text-gold-400" />
                    Kriterlerine uygun izlenmemiş film bulunamadı.
                  </div>
                ) : (
                  candidates.map((m) => (
                    <button key={m.id} onClick={() => setSelectedMovie(m)} className="wp-card w-full flex items-center gap-2.5 sm:gap-3 p-2 hover:border-gold-500/50 transition-all text-left group">
                      <div className="w-8 h-11 rounded-lg bg-ink-900 overflow-hidden flex-shrink-0 shadow-sm group-hover:shadow-[0_0_16px_-6px_var(--color-1)] border border-ink-800/50">
                        {m.posterUrl ? <img loading="lazy" decoding="async" src={m.posterUrl} alt={m.title} className="w-full h-full object-cover"  onError={handleImgFallback}/> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={12} className="text-ink-600" /></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] sm:text-xs font-black text-ink-100 truncate group-hover:text-white transition-colors">{m.title}</div>
                        <div className="wp-mono text-[9px] font-bold text-ink-500 mt-0.5">{m.year || 'Yıl yok'}{m.runtime ? ` • ${m.runtime} dk` : ''}</div>
                      </div>
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-gold-500/10 border border-gold-500/30 text-gold-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:scale-105">
                        <Plus size={10} sm-size={12} strokeWidth={3} />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 bg-gradient-to-r from-gold-500/10 to-transparent border border-gold-500/30 rounded-xl p-2.5 sm:p-3 shadow-inner mb-4">
                <div className="w-10 h-14 rounded-lg bg-ink-900 overflow-hidden flex-shrink-0 shadow-sm border border-ink-700/50">
                  {selectedMovie.posterUrl ? <img loading="lazy" decoding="async" src={selectedMovie.posterUrl} alt={selectedMovie.title} className="w-full h-full object-cover"  onError={handleImgFallback}/> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={12} className="text-ink-600" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] sm:text-sm font-black text-white truncate drop-shadow-sm mb-1">{selectedMovie.title}</div>
                  <div className="wp-mono text-[9px] sm:text-[10px] font-bold text-gold-400 bg-gold-500/10 w-fit px-1.5 py-0.5 rounded border border-gold-500/30">{selectedMovie.year}{selectedMovie.runtime ? ` • ${selectedMovie.runtime} dk` : ''}</div>
                </div>
                <button onClick={() => setSelectedMovie(null)} className="wp-mono text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white bg-gold-500 hover:brightness-110 px-2 sm:px-2.5 py-1.5 rounded-lg flex-shrink-0 transition-all shadow-sm">
                  Değiştir
                </button>
              </div>

              <div className="flex gap-2.5 sm:gap-3 mb-4">
                <div className="space-y-1.5 flex-1">
                  <label className="h-4 flex items-center wp-mono text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] text-ink-400 ml-1">Tarih</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-ink-950 border border-ink-800 rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-[var(--color-1)] shadow-inner transition-all" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <label className="h-4 flex items-center wp-mono text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] text-ink-400 ml-1 gap-1"><Clock size={10} /> Saat</label>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-ink-950 border border-ink-800 rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-[var(--color-1)] shadow-inner transition-all" />
                </div>
              </div>

              <div className="bg-ink-950/60 border border-ink-800 rounded-xl p-2.5 sm:p-3 shadow-inner">
                <div className="wp-mono text-[8px] sm:text-[9px] font-black uppercase tracking-[0.18em] text-ink-400 mb-2 flex items-center gap-1.5">
                  <CalendarDays size={10} sm-size={12} className="text-gold-400" /> 
                  {date === toDateStr(startOfToday()) ? 'Bugünün Dolu Saatleri' : 'Seçili Günün Dolu Saatleri'}
                </div>
                
                {dayPlans.length === 0 ? (
                  <div className="text-[10px] sm:text-[11px] text-emerald-400/80 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-2 rounded-lg flex items-center gap-1.5">
                    <CheckCircle2 size={12} sm-size={14}/> Bu gün tamamen boş!
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-24 sm:max-h-32 overflow-y-auto custom-scrollbar pr-1">
                    {dayPlans.map(p => {
                      const m = data.movies.find(x => x.id === p.movieId);
                      const pDur = p.runtime || m?.runtime || 115;
                      const pEnd = computeEndTime(p.time, pDur);
                      const isOverlapping = checkOverlap(time, selectedMovie.runtime || 115, p.time, pDur);
                      
                      return (
                        <div key={p.id} className={`flex items-center justify-between px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-lg border transition-colors ${isOverlapping ? 'bg-red-500/10 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.15)]' : 'bg-ink-900 border-ink-800/50'}`}>
                           <div className="flex items-center gap-1.5 min-w-0 pr-2">
                             {isOverlapping ? <AlertCircle size={10} sm-size={12} className="text-red-400 flex-shrink-0 animate-pulse"/> : <Film size={10} sm-size={12} className="text-ink-500 flex-shrink-0"/>}
                             <span className={`text-[10px] sm:text-[11px] font-bold truncate ${isOverlapping ? 'text-red-300' : 'text-ink-200'}`}>{p.title}</span>
                           </div>
                           <span className={`text-[8px] sm:text-[9px] font-black flex-shrink-0 px-1.5 py-0.5 rounded border ${isOverlapping ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-gold-500/10 text-gold-400 border-gold-500/30'}`}>
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
                   <div className="text-[9px] sm:text-[10px] text-ink-500 font-bold bg-ink-950 px-1.5 py-0.5 rounded border border-ink-800">Süre: {selectedMovie.runtime || 115} dk</div>
                   <div className="text-[10px] sm:text-[11px] font-bold text-ink-300 flex items-center gap-1">
                     Tahmini Bitiş: <strong className="text-emerald-400 text-[11px] sm:text-xs">{endTimePreview}</strong>
                   </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-ink-800/80 bg-ink-950/90 flex flex-col sm:flex-row items-center gap-2 backdrop-blur-md">
          <button onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 sm:py-2.5 min-h-11 md:min-h-0 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-300 font-bold text-[11px] uppercase tracking-wider transition-colors">
            Vazgeç
          </button>
          
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:flex-1">
            <button disabled={!selectedMovie || !date || !time} onClick={() => handleConfirm(false)} className="w-full sm:flex-1 py-2.5 min-h-11 md:min-h-0 rounded-xl bg-ink-900 hover:bg-ink-800 text-gold-400 border border-gold-500/30 font-black text-[10px] sm:text-[11px] uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center shadow-sm hover:shadow-[0_0_18px_-8px_var(--color-1)]">
              <Plus size={10} className="mr-1" /> Ekle & Devam
            </button>
            <button disabled={!selectedMovie || !date || !time} onClick={() => handleConfirm(true)} className="w-full sm:flex-1 py-2.5 min-h-11 md:min-h-0 rounded-xl bg-gradient-to-r from-gold-600 to-gold-700 text-white font-black text-[10px] sm:text-[11px] uppercase tracking-wider transition-all disabled:opacity-40 shadow-[0_10px_28px_-10px_var(--color-1),inset_0_1px_0_rgba(255,255,255,0.3)] hover:shadow-[0_16px_36px_-10px_var(--color-1)] hover:-translate-y-0.5">
              Kaydet & Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditPlanModal({ item, presetDate, onClose }: { item: WeeklyPlanItem; presetDate?: string; onClose: () => void }) {
  const { data, updatePlanItem, showToast } = useApp();
  const movie = data.movies.find(m => m.id === item.movieId);

  const [date, setDate] = useState(presetDate || item.date);
  const [time, setTime] = useState(item.time);

  if (!movie) return null;

  const dayPlans = useMemo(() => {
    return (data.weeklyPlan || [])
      .filter((p) => p.date === date && p.id !== item.id)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [data.weeklyPlan, date, item.id]);

  const endTimePreview = computeEndTime(time, movie.runtime || 115);

  const handleConfirm = () => {
    const hasOverlap = dayPlans.some((p) => {
      const m = data.movies.find(x => x.id === p.movieId);
      const pDur = p.runtime || m?.runtime || 115;
      return checkOverlap(time, movie.runtime || 115, p.time, pDur);
    });

    if (hasOverlap) {
      showToast('Seçtiğiniz saatte başka bir film var! Lütfen kırmızı işaretli saatleri kontrol edin.', 'warning');
      return;
    }

    updatePlanItem(item.id, date as any, time);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="wp-glass w-full max-w-lg overflow-hidden flex flex-col max-h-[90svh] animate-fade-in-up">
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-ink-800/80 bg-gradient-to-r from-gold-500/10 to-transparent relative">
          <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-gold-500 via-gold-500/40 to-transparent"></div>
          <h3 className="wp-title text-[13px] sm:text-sm font-bold text-white flex items-center gap-2 drop-shadow-md uppercase tracking-wide">
            <div className="w-6 h-6 rounded border border-gold-500/30 bg-gold-500/10 text-gold-400 flex items-center justify-center"><Edit2 size={12} /></div>
            Maratonu Düzenle / Taşı
          </h3>
          <button onClick={onClose} className="text-ink-400 hover:text-white p-1.5 min-h-11 min-w-11 md:min-h-0 md:min-w-0 flex items-center justify-center rounded-full hover:bg-ink-800 transition-colors"><X size={16} /></button>
        </div>

        <div className="p-3.5 sm:p-4 space-y-3 sm:space-y-4 overflow-y-auto custom-scrollbar flex-1">
          <div className="flex items-center gap-3 bg-gradient-to-r from-gold-500/10 to-transparent border border-gold-500/30 rounded-xl p-2.5 sm:p-3 shadow-inner mb-4">
            <div className="w-10 h-14 rounded-lg bg-ink-900 overflow-hidden flex-shrink-0 shadow-sm border border-ink-700/50">
              {movie.posterUrl ? <img loading="lazy" decoding="async" src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover"  onError={handleImgFallback}/> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={12} className="text-ink-600" /></div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] sm:text-sm font-black text-white truncate drop-shadow-sm mb-1">{movie.title}</div>
              <div className="wp-mono text-[9px] sm:text-[10px] font-bold text-gold-400 bg-gold-500/10 w-fit px-1.5 py-0.5 rounded border border-gold-500/30">{movie.year}{movie.runtime ? ` • ${movie.runtime} dk` : ''}</div>
            </div>
          </div>

          <div className="flex gap-2.5 sm:gap-3 mb-4">
            <div className="space-y-1.5 flex-1">
              <label className="h-4 flex items-center wp-mono text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] text-ink-400 ml-1">Tarih</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-ink-950 border border-ink-800 rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-[var(--color-1)] shadow-inner transition-all" />
            </div>
            <div className="space-y-1.5 flex-1">
              <label className="h-4 flex items-center wp-mono text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] text-ink-400 ml-1 gap-1"><Clock size={10} /> Saat</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-ink-950 border border-ink-800 rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-[var(--color-1)] shadow-inner transition-all" />
            </div>
          </div>

          <div className="bg-ink-950/60 border border-ink-800 rounded-xl p-2.5 sm:p-3 shadow-inner">
            <div className="wp-mono text-[8px] sm:text-[9px] font-black uppercase tracking-[0.18em] text-ink-400 mb-2 flex items-center gap-1.5">
              <CalendarDays size={10} className="text-gold-400" /> 
              Seçili Günün Dolu Saatleri
            </div>
            
            {dayPlans.length === 0 ? (
              <div className="text-[10px] sm:text-[11px] text-emerald-400/80 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-2 rounded-lg flex items-center gap-1.5">
                <CheckCircle2 size={12}/> Başka plan yok!
              </div>
            ) : (
              <div className="space-y-1.5 max-h-24 sm:max-h-32 overflow-y-auto custom-scrollbar pr-1">
                {dayPlans.map(p => {
                  const m = data.movies.find(x => x.id === p.movieId);
                  const pDur = p.runtime || m?.runtime || 115;
                  const pEnd = computeEndTime(p.time, pDur);
                  const isOverlapping = checkOverlap(time, movie.runtime || 115, p.time, pDur);
                  
                  return (
                    <div key={p.id} className={`flex items-center justify-between px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-lg border transition-colors ${isOverlapping ? 'bg-red-500/10 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.15)]' : 'bg-ink-900 border-ink-800/50'}`}>
                       <div className="flex items-center gap-1.5 min-w-0 pr-2">
                         {isOverlapping ? <AlertCircle size={10} className="text-red-400 flex-shrink-0 animate-pulse"/> : <Film size={10} className="text-ink-500 flex-shrink-0"/>}
                         <span className={`text-[10px] sm:text-[11px] font-bold truncate ${isOverlapping ? 'text-red-300' : 'text-ink-200'}`}>{p.title}</span>
                       </div>
                       <span className={`text-[8px] sm:text-[9px] font-black flex-shrink-0 px-1.5 py-0.5 rounded border ${isOverlapping ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-gold-500/10 text-gold-400 border-gold-500/30'}`}>
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
               <div className="text-[9px] sm:text-[10px] text-ink-500 font-bold bg-ink-950 px-1.5 py-0.5 rounded border border-ink-800">Süre: {movie.runtime || 115} dk</div>
               <div className="text-[10px] sm:text-[11px] font-bold text-ink-300 flex items-center gap-1">
                 Tahmini Bitiş: <strong className="text-emerald-400 text-[11px] sm:text-xs">{endTimePreview}</strong>
               </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-ink-800/80 bg-ink-950/90 flex items-center gap-2 backdrop-blur-md">
          <button onClick={onClose} className="px-4 py-2.5 min-h-11 md:min-h-0 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-300 font-bold text-[11px] uppercase tracking-wider transition-colors">
            İptal
          </button>
          <button disabled={!date || !time} onClick={handleConfirm} className="flex-1 py-2.5 min-h-11 md:min-h-0 rounded-xl bg-gradient-to-r from-gold-600 to-gold-700 text-white font-black text-[11px] uppercase tracking-wider transition-all disabled:opacity-40 shadow-[0_10px_28px_-10px_var(--color-1),inset_0_1px_0_rgba(255,255,255,0.3)] hover:shadow-[0_16px_36px_-10px_var(--color-1)] hover:-translate-y-0.5">
            Değişiklikleri Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}