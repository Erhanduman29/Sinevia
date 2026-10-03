import { useState, useMemo, useEffect } from 'react';
import {
  CalendarClock, Plus, X, Search, Clock, Star, Trash2, Image as ImageIcon,
  Film, Sparkles, Play, Pause, Timer, Lock,
  CheckCircle2, Hourglass, ListChecks, ArrowRight, CalendarDays,
} from 'lucide-react';
import { useApp, getMovieTimerInfo, computeEndTime } from '../context/AppContext';
import { ratingBgClass } from '../lib/utils';
import RatingModal from '../components/RatingModal';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Movie, WeeklyPlanItem } from '../types';

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const WINDOW_SIZE = 8; // Dün + bugün + 6 gün ileri = toplam 8 gün

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

export default function WeeklyPlanPage() {
  const { data, deletePlanItem, startWatchingMovie, togglePauseWatchingMovie, cancelWatchingMovie, canRateMovieWithTimer, watchMovie } = useApp();
  const [showAdd, setShowAdd] = useState<{ presetDate?: string } | null>(null);
  const [ratingTarget, setRatingTarget] = useState<{ item: WeeklyPlanItem; movie: Movie } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WeeklyPlanItem | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const plan = data.weeklyPlan || [];
  const today = useMemo(() => startOfToday(), []);
  const todayStrVal = toDateStr(today);
  const yesterdayStrVal = toDateStr(addDays(today, -1));

  const activeTimerMovie = useMemo(() => data.movies.find((m) => !m.watched && m.startedAt) || null, [data.movies]);

  useEffect(() => {
    if (!activeTimerMovie) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimerMovie]);

  // Kayan 8 günlük pencere: dünden başlar, 6 gün ileriye kadar gider.
  // Zaman ilerledikçe bu pencere otomatik kayar; eski günler kendiliğinden görünümden düşer.
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

  // Görünen pencere içindeki küçük istatistikler
  const windowStats = useMemo(() => {
    const visibleItems = plan.filter((p) => p.date >= windowStartStr && p.date <= windowEndStr);
    let watchedCount = 0;
    let pendingCount = 0;
    let pendingMinutes = 0;
    visibleItems.forEach((p) => {
      const movie = movieMap.get(p.movieId);
      if (movie?.watched) watchedCount++;
      else {
        pendingCount++;
        pendingMinutes += p.runtime && p.runtime > 0 ? p.runtime : 115;
      }
    });
    return { total: visibleItems.length, watchedCount, pendingCount, pendingMinutes };
  }, [plan, windowStartStr, windowEndStr, movieMap]);

  const handleRequestRate = (item: WeeklyPlanItem, movie: Movie) => {
    if (movie.startedAt && !canRateMovieWithTimer(movie.id)) return;
    setRatingTarget({ item, movie });
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* BAŞLIK */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <h1 className="text-xl sm:text-2xl font-bold text-ink-100 flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-azure-500/20 border border-violet-500/30 flex items-center justify-center">
            <CalendarClock size={20} className="text-violet-300" />
          </div>
          <div>
            <div>Haftalık İzleme Planı</div>
            <div className="text-[10.5px] font-semibold text-ink-500 mt-0.5">Dün ile önümüzdeki 6 gün</div>
          </div>
        </h1>
        <button
          onClick={() => setShowAdd({})}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-azure-500 text-white px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] transition-all"
        >
          <Plus size={16} strokeWidth={2.5} /> Film Planla
        </button>
      </div>

      {/* ŞU AN İZLENEN FİLM BANNER'I */}
      {activeTimerMovie && plan.some((p) => p.movieId === activeTimerMovie.id) && (() => {
        const info = getMovieTimerInfo(activeTimerMovie, nowMs);
        const planItem = plan.find((p) => p.movieId === activeTimerMovie.id)!;
        return (
          <div className="bg-gradient-to-r from-emerald-950/80 via-ink-900 to-ink-950 border border-emerald-500/40 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                <Timer size={18} className={info.isPaused ? 'text-amber-400' : 'text-emerald-400 animate-pulse'} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 truncate">
                  <span>{info.isPaused ? '⏸️ Duraklatıldı' : '⏳ Planlanan Film İzleniyor'}</span>
                  <span className="text-white truncate">• {activeTimerMovie.title}</span>
                </div>
                <div className="text-[11px] text-ink-300 mt-0.5 flex flex-wrap items-center gap-x-2">
                  <span>Kalan: <strong className="text-emerald-300 font-mono">{info.formattedRemaining}</strong></span>
                  <span>• Planlanan: {planItem.time} - {computeEndTime(planItem.time, activeTimerMovie.runtime)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => togglePauseWatchingMovie(activeTimerMovie.id)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-amber-300 border border-amber-500/30 text-xs font-bold"
              >
                {info.isPaused ? <><Play size={12} className="fill-current" /> Devam</> : <><Pause size={12} /> Duraklat</>}
              </button>
              <button
                type="button"
                onClick={() => handleRequestRate(planItem, activeTimerMovie)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  info.canRateWithTimer ? 'bg-gold-500 hover:bg-gold-400 text-ink-950 shadow-md' : 'bg-ink-800 text-ink-500 border border-ink-700 cursor-not-allowed'
                }`}
              >
                {info.canRateWithTimer ? <><Star size={12} className="fill-current" /> Bitir & Puanla</> : <><Lock size={11} /> {info.minRequiredMins - info.elapsedMins} dk</>}
              </button>
              <button type="button" onClick={() => cancelWatchingMovie(activeTimerMovie.id)} title="Sayacı İptal Et" className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex-shrink-0">
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* İSTATİSTİK ÇİPLERİ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatChip icon={CalendarDays} label="Görünen Planlar" value={String(windowStats.total)} color="violet" />
        <StatChip icon={CheckCircle2} label="İzlenen" value={String(windowStats.watchedCount)} color="emerald" />
        <StatChip icon={Hourglass} label="Bekleyen" value={String(windowStats.pendingCount)} color="gold" />
        <StatChip icon={ListChecks} label="Bekleyen Süre" value={formatDuration(windowStats.pendingMinutes)} color="azure" />
      </div>

      {/* GÜNLER: ALT ALTA, TAM GENİŞLİKTE */}
      <div className="space-y-3">
        {windowDays.map((dayDate) => {
          const dateStr = toDateStr(dayDate);
          const items = groupedByDate.get(dateStr) || [];
          const isToday = dateStr === todayStrVal;
          const isYesterday = dateStr === yesterdayStrVal;

          return (
            <div
              key={dateStr}
              className={`rounded-2xl border overflow-hidden transition-all ${
                isToday
                  ? 'border-gold-500/50 bg-gradient-to-r from-gold-500/10 via-ink-900/70 to-ink-900/50 shadow-lg shadow-gold-500/10 ring-1 ring-gold-500/20'
                  : isYesterday
                  ? 'border-ink-800/50 bg-ink-900/25 opacity-80'
                  : 'border-ink-800/60 bg-ink-900/40'
              }`}
            >
              {/* GÜN BAŞLIĞI */}
              <div className={`flex items-center justify-between px-4 py-2.5 border-b gap-2 ${isToday ? 'border-gold-500/25' : 'border-ink-800/50'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-sm font-black truncate ${isToday ? 'text-gold-300' : 'text-ink-200'}`}>
                    {DAY_NAMES[dayDate.getDay()]}
                  </span>
                  <span className="text-xs font-bold text-ink-500 flex-shrink-0">{formatDayDate(dayDate)}</span>
                  {isToday && <span className="text-[9px] font-black bg-gold-500 text-ink-950 px-1.5 py-0.5 rounded-full flex-shrink-0">BUGÜN</span>}
                  {isYesterday && <span className="text-[9px] font-black bg-ink-700 text-ink-300 px-1.5 py-0.5 rounded-full flex-shrink-0">DÜN</span>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {items.length > 0 && (
                    <span className="text-[10px] font-bold text-ink-500 bg-ink-800/60 px-2 py-0.5 rounded-full">{items.length} film</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAdd({ presetDate: dateStr })}
                    title="Bu güne film ekle"
                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 transition-colors"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* GÜNÜN FİLMLERİ: YATAY KARTLAR */}
              <div className="p-3">
                {items.length === 0 ? (
                  <div className="text-xs text-ink-600 text-center py-4">Bu güne planlanmış film yok.</div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-3 -mx-1 px-1">
                    {items.map((item) => {
                      const movie = movieMap.get(item.movieId);

                      if (!movie) {
                        return (
                          <div key={item.id} className="flex-shrink-0 w-48 bg-ink-950/50 border border-ink-800/60 rounded-xl p-2.5 opacity-60">
                            <div className="text-[11px] text-ink-500 italic mb-2">Film silinmiş</div>
                            <button
                              onClick={() => setDeleteTarget(item)}
                              className="w-full flex items-center justify-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[11px] font-bold px-2 py-1.5 rounded-lg transition-colors"
                            >
                              <Trash2 size={11} /> Kaldır
                            </button>
                          </div>
                        );
                      }

                      const timerInfo = !movie.watched && movie.startedAt ? getMovieTimerInfo(movie, nowMs) : null;
                      const endTime = computeEndTime(item.time, movie.runtime || item.runtime);
                      const anotherTimerActive = Boolean(activeTimerMovie && activeTimerMovie.id !== movie.id);

                      return (
                        <div
                          key={item.id}
                          className={`group flex-shrink-0 w-64 sm:w-72 rounded-xl p-2.5 flex gap-2.5 transition-all animate-fade-in border ${
                            movie.watched
                              ? 'bg-emerald-950/20 border-emerald-500/25'
                              : 'bg-ink-950/60 border-ink-800/70 hover:border-violet-500/40'
                          }`}
                        >
                          <div className="w-14 aspect-[2/3] flex-shrink-0 rounded-lg overflow-hidden bg-ink-900 border border-ink-800 relative">
                            {movie.posterUrl ? (
                              <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon size={15} className="text-ink-600" />
                              </div>
                            )}
                            {movie.watched && (
                              <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                                <CheckCircle2 size={18} className="text-emerald-400 drop-shadow" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-1 text-[11px] font-bold text-violet-300 mb-1">
                                <Clock size={11} /> {item.time} <ArrowRight size={10} className="text-ink-600" /> {endTime}
                              </div>
                              <div className={`text-xs font-bold truncate leading-tight ${movie.watched ? 'text-ink-400 line-through' : 'text-ink-100'}`}>
                                {movie.title}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                {movie.year && <span className="text-[10px] text-ink-500">{movie.year}</span>}
                                {movie.watched && movie.rating !== null && (
                                  <span className={`text-[9.5px] px-1.5 py-0.5 rounded-full font-bold ${ratingBgClass(movie.rating)}`}>
                                    {movie.rating}
                                  </span>
                                )}
                              </div>
                            </div>

                            {movie.watched ? (
                              <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-emerald-400">
                                <CheckCircle2 size={11} /> İzlendi
                              </div>
                            ) : timerInfo ? (
                              <div className="flex items-center gap-1 mt-2 flex-wrap">
                                <div className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-1.5 py-0.5 rounded-lg text-[10px] font-bold">
                                  <Timer size={10} className={timerInfo.isPaused ? 'text-amber-400' : 'animate-pulse text-emerald-400'} />
                                  <span className="font-mono">{timerInfo.formattedRemaining}</span>
                                </div>
                                <button onClick={() => togglePauseWatchingMovie(movie.id)} className="text-amber-300 hover:text-white p-0.5">
                                  {timerInfo.isPaused ? <Play size={11} className="fill-current" /> : <Pause size={11} />}
                                </button>
                                <button onClick={() => cancelWatchingMovie(movie.id)} className="text-ink-400 hover:text-red-400 p-0.5">
                                  <X size={11} />
                                </button>
                                <button
                                  onClick={() => handleRequestRate(item, movie)}
                                  disabled={!timerInfo.canRateWithTimer}
                                  className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg transition-all ${
                                    timerInfo.canRateWithTimer
                                      ? 'bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-ink-950'
                                      : 'bg-ink-800/60 text-ink-600 cursor-not-allowed'
                                  }`}
                                >
                                  {timerInfo.canRateWithTimer ? <><Star size={10} className="fill-current" /> Puanla</> : <Lock size={10} />}
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 mt-2">
                                <button
                                  onClick={() => startWatchingMovie(movie.id)}
                                  disabled={anotherTimerActive}
                                  title={anotherTimerActive ? 'Başka bir filmin sayacı açık!' : 'Geri Sayımı Başlat'}
                                  className={`flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg border transition-all ${
                                    anotherTimerActive
                                      ? 'bg-ink-900/50 text-ink-600 border-ink-800 cursor-not-allowed'
                                      : 'bg-ink-800 hover:bg-emerald-900/30 text-emerald-400 border-emerald-500/30'
                                  }`}
                                >
                                  {anotherTimerActive ? <Lock size={10} /> : <Play size={10} className="fill-current" />}
                                </button>
                                <button
                                  onClick={() => handleRequestRate(item, movie)}
                                  className="flex-1 flex items-center justify-center gap-1 bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-ink-950 text-[10px] font-black px-2 py-1.5 rounded-lg transition-all"
                                >
                                  <Star size={10} className="fill-current" /> Puanla
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(item)}
                                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
          message={`"${deleteTarget.title}" haftalık plandan kaldırılacak (film listende kalmaya devam eder). Emin misin?`}
          onConfirm={() => { deletePlanItem(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function StatChip({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: 'violet' | 'emerald' | 'gold' | 'azure' }) {
  const colorClasses: Record<string, string> = {
    violet: 'from-violet-500/15 to-violet-500/5 border-violet-500/30 text-violet-300',
    emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 text-emerald-300',
    gold: 'from-gold-500/15 to-gold-500/5 border-gold-500/30 text-gold-300',
    azure: 'from-azure-500/15 to-azure-500/5 border-azure-500/30 text-azure-300',
  };
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-2xl p-3 flex items-center gap-2.5`}>
      <div className="w-8 h-8 rounded-xl bg-ink-950/40 flex items-center justify-center flex-shrink-0">
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-black text-white leading-none">{value}</div>
        <div className="text-[9.5px] font-bold text-ink-400 mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function AddPlanModal({ presetDate, onClose }: { presetDate?: string; onClose: () => void }) {
  const { data, addPlanItem } = useApp();
  const [search, setSearch] = useState('');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [date, setDate] = useState(presetDate || toDateStr(startOfToday()));
  const [time, setTime] = useState('20:00');

  const plannedMovieIds = useMemo(
    () => new Set((data.weeklyPlan || []).filter((p) => !data.movies.find((m) => m.id === p.movieId)?.watched).map((p) => p.movieId)),
    [data.weeklyPlan, data.movies]
  );

  const candidates = useMemo(() => {
    return data.movies
      .filter((m) => !m.watched && !plannedMovieIds.has(m.id))
      .filter((m) => !search.trim() || m.title.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')));
  }, [data.movies, plannedMovieIds, search]);

  const endTimePreview = selectedMovie ? computeEndTime(time, selectedMovie.runtime) : null;

  const handleConfirm = () => {
    if (!selectedMovie || !date || !time) return;
    const ok = addPlanItem(selectedMovie, date, time);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[88svh] animate-fade-in-up">
        <div className="flex items-center justify-between p-4 border-b border-ink-800 bg-gradient-to-r from-violet-500/10 to-azure-500/10">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Sparkles size={16} className="text-violet-400" /> Haftalık Plana Film Ekle
          </h3>
          <button onClick={onClose} className="text-ink-400 hover:text-white p-1.5 rounded-full hover:bg-ink-800">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {!selectedMovie ? (
            <>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="İzlenecek filmlerinde ara..."
                  className="w-full bg-ink-950 border border-ink-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-ink-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                {candidates.length === 0 ? (
                  <div className="text-center py-8 text-xs text-ink-500">
                    <Film size={28} className="mx-auto mb-2 opacity-40" />
                    Uygun film bulunamadı. (İzlenmemiş ve henüz plana eklenmemiş filmler burada listelenir.)
                  </div>
                ) : (
                  candidates.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMovie(m)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-ink-950/60 hover:bg-ink-800 border border-ink-800 hover:border-violet-500/40 transition-all text-left"
                    >
                      <div className="w-8 h-11 rounded bg-ink-900 overflow-hidden flex-shrink-0 border border-ink-700">
                        {m.posterUrl ? <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={12} className="text-ink-600" /></div>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-ink-100 truncate">{m.title}</div>
                        <div className="text-[10px] text-ink-400">{m.year || 'Yıl yok'}{m.runtime ? ` • ${m.runtime} dk` : ''}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 bg-violet-500/10 border border-violet-500/30 rounded-xl p-3">
                <div className="w-10 h-14 rounded-lg bg-ink-900 overflow-hidden flex-shrink-0 border border-ink-700">
                  {selectedMovie.posterUrl ? <img src={selectedMovie.posterUrl} alt={selectedMovie.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-ink-600" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-white truncate">{selectedMovie.title}</div>
                  <div className="text-[11px] text-ink-400">{selectedMovie.year}{selectedMovie.runtime ? ` • ${selectedMovie.runtime} dk` : ''}</div>
                </div>
                <button onClick={() => setSelectedMovie(null)} className="text-[10px] font-bold text-violet-300 hover:text-white bg-violet-500/15 hover:bg-violet-500/25 px-2 py-1 rounded-lg flex-shrink-0">
                  Değiştir
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-ink-400">Tarih</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-ink-950 border border-ink-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-ink-400 flex items-center gap-1.5">
                  <Clock size={12} /> Başlangıç Saati
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-ink-950 border border-ink-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                />
                {endTimePreview && (
                  <p className="text-[11px] text-ink-400 flex items-center gap-1.5">
                    <ArrowRight size={11} className="text-violet-400" />
                    Tahmini bitiş: <strong className="text-violet-300">{endTimePreview}</strong>
                    <span className="text-ink-600">({selectedMovie.runtime || 115} dk)</span>
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-3 border-t border-ink-800 bg-ink-950/70 flex items-center gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-300 font-bold text-xs transition-colors">
            Vazgeç
          </button>
          <button
            disabled={!selectedMovie || !date || !time}
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-azure-500 hover:from-violet-400 hover:to-azure-400 text-white font-black text-xs transition-all disabled:opacity-40"
          >
            Plana Ekle
          </button>
        </div>
      </div>
    </div>
  );
}