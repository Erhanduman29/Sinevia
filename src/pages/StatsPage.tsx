import { useState, useMemo } from 'react';
import {
  BarChart3, Film, Tv, Star, TrendingUp, Calendar, Award, Clock, Flame, Layers,
  Hourglass, Activity, User, Users, Building2, Crown, Sparkles,
  Compass, Sun, Sunset, Moon, Coffee, Globe, Trophy, StickyNote, Zap, Tag, Gauge, FastForward, History, Hexagon, Skull,
  Swords, Scale, ArrowUp, ArrowDown
} from 'lucide-react';
import { useLibrary, useGamification, useSettings } from '../context/slices';
import { useComputedStats } from '../lib/selectorHooks';
import { ratingBgClass } from '../lib/utils';
import { countWatchedCurrentMovies, countPastMovies, handleImgFallback } from '../lib/selectors';
import MediaDetailModal from '../components/MediaDetailModal';
import WrappedModal from '../components/WrappedModal';
import CalibrationDuelModal from '../components/CalibrationDuelModal';
import { detectRatingAnomalies } from '../lib/calibrationEngine';
import type { DetailModalTarget } from '../components/MediaDetailModal';
import type { WatchHistoryItem } from '../types';

// YENİ: ZEKİ MOTORUMUZU ÇAĞIRIYORUZ
import type { StatsScopeMode } from '../lib/statsLogic';

/* ══════════════════════════════════════════════════════════════
   PREMIUM TASARIM JETONLARI (sinevia-premium.html ile uyumlu)
   Cam paneller / ince çizgili kutular tema CSS değişkenlerine bağlı:
   premium tokenlar önce gelir (--red/--red-hi/--red-deep, --glass,
   --surface, --line-2, --r-lg, --shadow, --glow); plain-dark gibi token
   tanımsız temalar için zincirleme fallback: --color-1/2/3 → sabit değer.
   plain-dark fallback ZORUNLU kalıplar: var(--r, 16px),
   var(--red, var(--color-1, #e8384f)), var(--glass, var(--bg-card)).
   Grafik/heatmap VERİSİ değişmez (kütüphanesiz el SVG + eşik haritası);
   yalnızca görsel jetonlar sertleştirildi.
   ══════════════════════════════════════════════════════════════ */
const PREMIUM_PANEL =
  'bg-ink-900/60 bg-[image:var(--glass,var(--bg-card))] backdrop-blur-xl border border-ink-700/50 rounded-[var(--r-lg,22px)] p-4 sm:p-5 shadow-[var(--shadow,0_24px_60px_-24px_rgba(0,0,0,0.85))] transition-colors duration-300';
const PREMIUM_CELL =
  'bg-white/[0.03] border border-ink-800/70 rounded-[var(--r,16px)] transition-all duration-300 hover:bg-white/[0.06] hover:shadow-[var(--glow,0_0_0_1px_rgba(232,56,79,0.35),0_10px_30px_-10px_rgba(232,56,79,0.5))]';
const PREMIUM_GLOW =
  'transition-all duration-300 hover:shadow-[var(--glow,0_0_0_1px_rgba(232,56,79,0.35),0_14px_38px_-14px_rgba(232,56,79,0.6))]';
/* Büyük sayılar: mono, sıkı, tabular tipografi */
const PREMIUM_NUM = 'font-black tracking-tight tabular-nums';
/* İkon karo — premium cam + kırmızı ışık */
const RED_TILE =
  'stats-tile bg-gradient-to-br from-red-500 to-red-700 border border-rose-400/40 flex items-center justify-center shadow-[0_6px_18px_-6px_rgba(232,56,79,0.85),inset_0_1px_0_rgba(255,255,255,0.35)]';
/* Aktif sekme — premium kırmızı hap */
const RED_PILL_ACTIVE =
  'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-[0_6px_18px_-6px_rgba(232,56,79,0.85),inset_0_1px_0_rgba(255,255,255,0.3)]';
/* Önizleme ince ayraç + kırmızı ışık yardımcısı (boşluklu zincir fallback) */
const STATS_PREMIUM_CSS = `
.stats-glass{background:var(--glass, var(--bg-card));border-radius:var(--r, 16px);}
.stats-tile{box-shadow:0 6px 18px -6px var(--red, var(--color-1, #e8384f)), inset 0 1px 0 rgba(255,255,255,.35);}
.stats-red{color:var(--red, var(--color-1, #e8384f));}
.stats-hr{border-color:var(--line-2, var(--border-dim, rgba(244,244,242,.13)));}
`;

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

        <path d={polygonPath} fill="currentColor" className="text-red-500/25 transition-all duration-1000 ease-out" />
        <path d={polygonPath} fill="none" stroke="currentColor" className="text-rose-400 drop-shadow-[0_0_10px_rgba(232,56,79,0.85)]" strokeWidth="2" strokeLinejoin="round" />

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

/* ══════════════════════════════════════════════════════════════
   MODERN İZLEME HARİTASI (Yıllık Nabız Şeritleri & Kapsül Sütunlar)
   ══════════════════════════════════════════════════════════════ */
type MapMode = 'year' | 'month' | 'week' | 'day';

const MAP_MODES: { id: MapMode; label: string }[] = [
  { id: 'year', label: 'Yıllık' },
  { id: 'month', label: 'Aylık' },
  { id: 'week', label: 'Haftalık' },
  { id: 'day', label: 'Günlük' },
];

const MAP_MODE_META: Record<MapMode, { badge: string; desc: string; unitLabel: string }> = {
  year: {
    badge: 'Son 12 Ay Zaman Çizelgesi',
    desc: 'Her satır bir ayı, satır içindeki her dikey çubuk ise o ayın 1’inden son gününe kadar olan izleme nabzını gösterir.',
    unitLabel: 'Aktif Gün',
  },
  month: {
    badge: 'Son 12 Ay',
    desc: 'Aylık izleme ritmin — hangi aylarda sinema maratonu yaptığını ve zirve dönemini karşılaştır.',
    unitLabel: 'Aktif Ay',
  },
  week: {
    badge: 'Son 12 Hafta',
    desc: 'Haftalık tempo analizi — son 3 aydaki haftalık izleme istikrarını ve yoğunluk dalgalarını takip et.',
    unitLabel: 'Aktif Hafta',
  },
  day: {
    badge: 'Son 14 Gün',
    desc: 'Yakın plan nabız — bugün dahil son iki haftadaki günlük ekran ritmin.',
    unitLabel: 'Aktif Gün',
  },
};

const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const TR_MONTHS_FULL = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const TR_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface BarItem {
  label: string;
  sub?: string;
  count: number;
  title: string;
  isCurrent?: boolean;
}

function WatchBars({
  items,
  mode,
  onHoverItem,
}: {
  items: BarItem[];
  mode: MapMode;
  onHoverItem: (item: BarItem | null) => void;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  const total = items.reduce((s, i) => s + i.count, 0);
  const avg = items.length > 0 ? total / items.length : 0;

  return (
    <div className="relative bg-ink-950/55 border border-ink-800/70 rounded-2xl p-3.5 sm:p-5 overflow-hidden">
      {/* Arka Plan Kılavuz Çizgileri (Grid Lines) */}
      <div className="absolute inset-x-4 top-5 bottom-12 flex flex-col justify-between pointer-events-none z-0">
        {[1, 0.75, 0.5, 0.25, 0].map((ratio, idx) => {
          const val = Math.round(max * ratio);
          return (
            <div key={idx} className="flex items-center gap-2 w-full">
              <span className={`${PREMIUM_NUM} text-[9px] text-ink-600 w-5 text-right select-none`}>
                {ratio === 0 ? '0' : val > 0 ? val : ''}
              </span>
              <div className="flex-1 border-b border-dashed border-ink-800/60" />
            </div>
          );
        })}
      </div>

      {/* Kapsül Sütunlar */}
      <div className="relative z-10 flex items-end gap-1.5 sm:gap-2.5 h-44 sm:h-52 pl-6 pt-3">
        {items.map((it, i) => {
          const isPeak = it.count > 0 && it.count === max;
          const heightPct = it.count === 0 ? 4 : Math.max(12, Math.round((it.count / max) * 100));

          let barGradient = 'bg-ink-800/50 border-ink-700/40';
          if (it.count > 0) {
            if (isPeak) {
              barGradient =
                'bg-gradient-to-t from-red-600 via-rose-500 to-amber-300 border-amber-300/70 shadow-[0_0_20px_-2px_rgba(251,191,36,0.55)]';
            } else if (mode === 'month') {
              barGradient =
                'bg-gradient-to-t from-red-800 via-red-500 to-rose-400 border-rose-400/50 shadow-[0_0_14px_-3px_rgba(232,56,79,0.5)]';
            } else if (mode === 'week') {
              barGradient =
                'bg-gradient-to-t from-rose-800 via-rose-500 to-red-400 border-rose-300/50 shadow-[0_0_14px_-3px_rgba(255,107,122,0.5)]';
            } else {
              barGradient =
                'bg-gradient-to-t from-red-700 via-rose-500 to-rose-300 border-rose-300/60 shadow-[0_0_12px_-3px_rgba(232,56,79,0.45)]';
            }
          }

          return (
            <div
              key={i}
              onMouseEnter={() => onHoverItem(it)}
              onMouseLeave={() => onHoverItem(null)}
              className="flex-1 min-w-0 flex flex-col items-center gap-1.5 h-full group cursor-pointer"
            >
              {/* Üst Değer Rozeti */}
              <div className="h-5 flex items-center justify-center">
                {it.count > 0 ? (
                  <span
                    className={`${PREMIUM_NUM} text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md transition-all duration-200 flex items-center gap-0.5 ${
                      isPeak
                        ? 'bg-amber-400/15 text-amber-300 border border-amber-400/40 scale-105'
                        : 'text-ink-200 group-hover:text-white group-hover:bg-white/[0.07]'
                    }`}
                  >
                    {isPeak && <Crown size={9} className="text-amber-300 fill-current hidden sm:inline" />}
                    {it.count}
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-ink-700 opacity-0 group-hover:opacity-100 transition-opacity">
                    0
                  </span>
                )}
              </div>

              {/* Dikey Kapsül Yuvası (Track) */}
              <div className="w-full max-w-[38px] flex-1 bg-white/[0.02] border border-white/[0.04] group-hover:border-white/[0.12] group-hover:bg-white/[0.04] rounded-xl p-0.5 flex items-end overflow-hidden transition-all duration-300">
                <div
                  title={it.title}
                  className={`w-full rounded-[9px] border-t transition-all duration-500 ease-out group-hover:brightness-125 relative overflow-hidden ${barGradient}`}
                  style={{ height: `${heightPct}%` }}
                >
                  {it.count > 0 && (
                    <div className="absolute inset-x-0 top-0 h-2 bg-white/25 blur-[1px]" />
                  )}
                </div>
              </div>

              {/* Alt Etiketler */}
              <div className="flex flex-col items-center leading-none pt-0.5 w-full">
                <span
                  className={`text-[9px] sm:text-[10px] font-extrabold truncate w-full text-center transition-colors ${
                    it.isCurrent
                      ? 'text-gold-400'
                      : isPeak
                      ? 'text-rose-300'
                      : 'text-ink-400 group-hover:text-ink-100'
                  }`}
                >
                  {it.label}
                </span>
                {it.sub && (
                  <span
                    className={`text-[8px] font-bold mt-0.5 w-full text-center truncate ${
                      it.isCurrent ? 'text-gold-400/80' : 'text-ink-600'
                    }`}
                  >
                    {it.sub}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Alt Dönem Özeti */}
      <div className="mt-3 pt-2.5 border-t border-ink-800/60 flex items-center justify-between text-[10px] sm:text-[11px] text-ink-400 font-semibold flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(232,56,79,0.8)]" />
            Birim Ortalaması: <strong className={`${PREMIUM_NUM} text-ink-100`}>{avg.toFixed(1)} yapım</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-amber-300/90">
          <Crown size={12} className="fill-current" />
          <span>Taç işaretli sütun bu görünümün zirvesini temsil eder</span>
        </div>
      </div>
    </div>
  );
}

function WatchMap({ history }: { history: WatchHistoryItem[] }) {
  const [mode, setMode] = useState<MapMode>('year');
  const [hoveredDetail, setHoveredDetail] = useState<{ label: string; count: number; badge?: string } | null>(null);

  const watchMap = useMemo(() => {
    const m = new Map<string, number>();
    history.forEach((h) => {
      if (!h.watchedAt) return;
      const k = dayKey(new Date(h.watchedAt));
      m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  }, [history]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = dayKey(today);
  const keyCount = (d: Date) => watchMap.get(dayKey(d)) || 0;

  const meta = MAP_MODE_META[mode];

  /* ---------- YILLIK: 12 Aylık Yatay Nabız Şeritleri (Okunaklı & Net) ---------- */
  const yearMonthStrips = useMemo(() => {
    if (mode !== 'year') return [];
    const result: {
      key: string;
      monthShort: string;
      monthName: string;
      yearNum: number;
      daysInMonth: number;
      totalCount: number;
      activeDays: number;
      isCurrentMonth: boolean;
      days: { date: Date; dayNum: number; count: number; isToday: boolean; isFuture: boolean }[];
    }[] = [];

    for (let i = 11; i >= 0; i--) {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const y = firstOfMonth.getFullYear();
      const m = firstOfMonth.getMonth();
      const daysInMonth = new Date(y, m + 1, 0).getDate();

      let totalCount = 0;
      let activeDays = 0;
      const days: { date: Date; dayNum: number; count: number; isToday: boolean; isFuture: boolean }[] = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(y, m, d);
        const k = dayKey(dateObj);
        const c = watchMap.get(k) || 0;
        const isFuture = dateObj > today;
        if (!isFuture) {
          totalCount += c;
          if (c > 0) activeDays++;
        }
        days.push({
          date: dateObj,
          dayNum: d,
          count: c,
          isToday: k === todayKey,
          isFuture,
        });
      }

      result.push({
        key: `${y}-${m}`,
        monthShort: TR_MONTHS[m],
        monthName: TR_MONTHS_FULL[m],
        yearNum: y,
        daysInMonth,
        totalCount,
        activeDays,
        isCurrentMonth: i === 0,
        days,
      });
    }
    return result;
  }, [mode, watchMap]);

  const maxMonthTotalInYear = useMemo(
    () => Math.max(...yearMonthStrips.map((m) => m.totalCount), 1),
    [yearMonthStrips]
  );

  /* ---------- AYLIK: son 12 ay ---------- */
  const monthBars: BarItem[] = [];
  if (mode === 'month') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      let c = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        c += keyCount(new Date(d.getFullYear(), d.getMonth(), day));
      }
      monthBars.push({
        label: TR_MONTHS[d.getMonth()],
        sub: `'${String(d.getFullYear()).slice(2)}`,
        count: c,
        title: `${TR_MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}: ${c} yapım`,
        isCurrent: i === 0,
      });
    }
  }

  /* ---------- HAFTALIK: son 12 hafta (Pazartesi başlangıç) ---------- */
  const weekBars: BarItem[] = [];
  if (mode === 'week') {
    for (let i = 11; i >= 0; i--) {
      const anchor = new Date(today);
      anchor.setDate(today.getDate() - i * 7);
      const dow = (anchor.getDay() + 6) % 7;
      const startW = new Date(anchor);
      startW.setDate(anchor.getDate() - dow);
      const endW = new Date(startW);
      endW.setDate(startW.getDate() + 6);
      let c = 0;
      for (let j = 0; j < 7; j++) {
        const d = new Date(startW);
        d.setDate(startW.getDate() + j);
        c += keyCount(d);
      }
      weekBars.push({
        label: `${startW.getDate()} ${TR_MONTHS[startW.getMonth()]}`,
        sub: i === 0 ? 'Bu Hf.' : `${endW.getDate()} ${TR_MONTHS[endW.getMonth()]}`,
        count: c,
        title: `${startW.getDate()} ${TR_MONTHS_FULL[startW.getMonth()]} – ${endW.getDate()} ${TR_MONTHS_FULL[endW.getMonth()]} haftası: ${c} yapım`,
        isCurrent: i === 0,
      });
    }
  }

  /* ---------- GÜNLÜK: son 14 gün ---------- */
  const dayBars: BarItem[] = [];
  if (mode === 'day') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const c = keyCount(d);
      dayBars.push({
        label: i === 0 ? 'Bugün' : TR_DAYS[d.getDay()],
        sub: `${String(d.getDate()).padStart(2, '0')} ${TR_MONTHS[d.getMonth()]}`,
        count: c,
        title: `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}: ${c} yapım`,
        isCurrent: i === 0,
      });
    }
  }

  /* ---------- ÖZET SAYILAR ---------- */
  const statsOf = (counts: number[]) => {
    const total = counts.reduce((a, b) => a + b, 0);
    const active = counts.filter((c) => c > 0).length;
    const max = Math.max(...counts, 0);
    return { total, active, max };
  };

  let summary = { total: 0, active: 0, denominator: 365, max: 0, peak: '—' };
  if (mode === 'year') {
    const counts: number[] = [];
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      counts.push(keyCount(d));
    }
    const s = statsOf(counts);
    const bestMonth = yearMonthStrips.reduce(
      (a, b) => (b.totalCount > a.totalCount ? b : a),
      yearMonthStrips[0] || { monthName: '—', totalCount: 0 }
    );
    summary = {
      ...s,
      denominator: 365,
      peak: bestMonth.totalCount > 0 ? `${bestMonth.monthName} (${bestMonth.totalCount})` : `Rekor: ${s.max}`,
    };
  } else if (mode === 'month') {
    const s = statsOf(monthBars.map((b) => b.count));
    const peakBar = monthBars.reduce((a, b) => (b.count > a.count ? b : a), monthBars[0]);
    summary = { ...s, denominator: 12, peak: peakBar.count > 0 ? `${peakBar.label} (${peakBar.count} yapım)` : '—' };
  } else if (mode === 'week') {
    const s = statsOf(weekBars.map((b) => b.count));
    const peakBar = weekBars.reduce((a, b) => (b.count > a.count ? b : a), weekBars[0]);
    summary = { ...s, denominator: 12, peak: peakBar.count > 0 ? `${peakBar.label} (${peakBar.count} yapım)` : '—' };
  } else {
    const s = statsOf(dayBars.map((b) => b.count));
    const peakBar = dayBars.reduce((a, b) => (b.count > a.count ? b : a), dayBars[0]);
    summary = { ...s, denominator: 14, peak: peakBar.count > 0 ? `${peakBar.label} (${peakBar.count} yapım)` : '—' };
  }

  const hasData = watchMap.size > 0;
  const activePct = Math.round((summary.active / summary.denominator) * 100);

  return (
    <div className="space-y-3.5">
      {/* Başlık + Sekme Seçici */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className={`w-8 h-8 rounded-xl ${RED_TILE}`}>
            <Calendar size={16} className="text-white" />
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100">
                İzleme Haritası
              </h2>
              <span className="text-[9.5px] font-black uppercase tracking-widest text-rose-300 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded-md">
                {meta.badge}
              </span>
            </div>
            <p className="text-[11px] text-ink-400 mt-0.5 leading-snug">{meta.desc}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 self-start sm:self-auto bg-ink-950/80 border border-ink-800 rounded-xl p-1 shrink-0">
          {MAP_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                setHoveredDetail(null);
              }}
              className={`px-2.5 sm:px-3.5 py-1.5 min-h-9 sm:min-h-0 rounded-lg text-[10px] sm:text-xs font-black transition-all ${
                mode === m.id ? RED_PILL_ACTIVE : 'text-ink-400 hover:text-ink-100 hover:bg-white/[0.06]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-8 bg-ink-950/40 rounded-2xl border border-ink-800/60">
          <p className="text-xs text-ink-500">Bu kapsamda henüz izleme verin bulunmuyor.</p>
        </div>
      ) : (
        <>
          {/* Kompakt Özet Şeritleri */}
          <div className="grid grid-cols-3 gap-2">
            <div className={`${PREMIUM_CELL} px-3 py-2 flex items-center justify-between`}>
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-ink-500">Bu Dönem</div>
                <div className={`${PREMIUM_NUM} text-sm sm:text-lg text-white leading-tight`}>
                  {summary.total} <span className="text-[10px] font-bold text-ink-400">yapım</span>
                </div>
              </div>
              <Film size={14} className="text-rose-400/70 hidden sm:block" />
            </div>

            <div className={`${PREMIUM_CELL} px-3 py-2 flex items-center justify-between`}>
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-ink-500">{meta.unitLabel}</div>
                <div className={`${PREMIUM_NUM} text-sm sm:text-lg text-rose-300 leading-tight`}>
                  {summary.active} <span className="text-[10px] font-bold text-ink-500">/ {summary.denominator}</span>
                </div>
              </div>
              <span className={`${PREMIUM_NUM} text-[10px] text-ink-400 hidden sm:inline`}>%{activePct}</span>
            </div>

            <div className={`${PREMIUM_CELL} px-3 py-2 flex items-center justify-between min-w-0`}>
              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-widest text-ink-500">Zirve</div>
                <div className="text-[11px] sm:text-xs font-black text-gold-300 leading-tight mt-0.5 truncate">
                  {summary.peak}
                </div>
              </div>
              <Crown size={14} className="text-gold-400/80 shrink-0 hidden sm:block" />
            </div>
          </div>

          {/* YILLIK GÖRÜNÜM: 12 Aylık Yatay Nabız & Zaman Şeritleri */}
          {mode === 'year' && (
            <div className="bg-ink-950/55 border border-ink-800/70 rounded-2xl p-3 sm:p-4 space-y-3">
              {/* Üst Canlı Bilgi Barı */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-ink-800/60 text-xs">
                <div className="flex items-center gap-2 min-h-[18px] min-w-0">
                  <Sparkles size={13} className="text-gold-400 shrink-0" />
                  {hoveredDetail ? (
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-bold text-white truncate">{hoveredDetail.label}</span>
                      <span className="text-ink-600">•</span>
                      <span
                        className={`${PREMIUM_NUM} px-2 py-0.5 rounded text-[11px] font-black ${
                          hoveredDetail.count > 0
                            ? 'bg-red-500/20 text-rose-300 border border-red-500/30'
                            : 'bg-ink-900 text-ink-400'
                        }`}
                      >
                        {hoveredDetail.count > 0 ? `${hoveredDetail.count} yapım izlendi` : 'İzleme yok'}
                      </span>
                      {hoveredDetail.badge && (
                        <span className="text-[10px] font-bold text-gold-400">({hoveredDetail.badge})</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-ink-400 text-[11px] truncate">
                      Her satır bir ayı, dikey çubuklar ise o ayın günlerini (1–31) gösterir. Detay için çubukların üzerine gel.
                    </span>
                  )}
                </div>

                {/* Renk Anlamları */}
                <div className="flex items-center gap-2 text-[10px] text-ink-400 font-semibold self-end sm:self-auto shrink-0">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-ink-800" /> Boş
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500/70" /> 1–2
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> 3–4
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-300" /> 5+ Rekor
                  </span>
                </div>
              </div>

              {/* 12 Ay Satır Listesi (Masaüstünde 2 Sütun, Mobilde 1 Sütun) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2.5">
                {yearMonthStrips.map((mItem) => {
                  const hasActivity = mItem.totalCount > 0;
                  const isPeak = hasActivity && mItem.totalCount === maxMonthTotalInYear;

                  return (
                    <div
                      key={mItem.key}
                      className={`flex items-center gap-2.5 sm:gap-3 px-3 py-2 rounded-xl border transition-all ${
                        isPeak
                          ? 'bg-gradient-to-r from-red-950/35 via-ink-900/70 to-ink-900/50 border-rose-500/45 shadow-[0_6px_20px_-10px_rgba(232,56,79,0.5)]'
                          : hasActivity
                          ? 'bg-ink-900/50 border-ink-800/80 hover:border-ink-700'
                          : 'bg-ink-950/35 border-ink-800/40 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {/* Sol: Ay Adı & Yıl */}
                      <div className="w-20 sm:w-24 shrink-0">
                        <div className="flex items-center gap-1">
                          {isPeak && <Crown size={11} className="text-amber-300 fill-current shrink-0" />}
                          <span
                            className={`text-xs font-black uppercase tracking-tight truncate ${
                              mItem.isCurrentMonth ? 'text-gold-400' : 'text-ink-100'
                            }`}
                          >
                            {mItem.monthName}
                          </span>
                        </div>
                        <div className="text-[10px] font-semibold text-ink-500 flex items-center gap-1">
                          <span>{mItem.yearNum}</span>
                          <span>•</span>
                          <span className={mItem.activeDays > 0 ? 'text-ink-400' : 'text-ink-600'}>
                            {mItem.activeDays}g aktif
                          </span>
                        </div>
                      </div>

                      {/* Orta: 1'den 31'e Günlük Nabız Çubukları (Equalizer) */}
                      <div className="flex-1 flex items-end gap-[2px] sm:gap-[3px] h-7 bg-ink-950/70 border border-ink-800/60 rounded-lg px-2 py-1">
                        {mItem.days.map((d) => {
                          if (d.isFuture) {
                            return (
                              <div
                                key={d.dayNum}
                                className="flex-1 h-1 rounded-full bg-white/[0.02]"
                              />
                            );
                          }

                          const formatted = d.date.toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            weekday: 'short',
                          });

                          let barHeight = '22%';
                          let barColor = 'bg-white/[0.08] hover:bg-white/30';

                          if (d.count === 1) {
                            barHeight = '52%';
                            barColor = 'bg-rose-500/75 hover:bg-rose-400';
                          } else if (d.count === 2) {
                            barHeight = '70%';
                            barColor = 'bg-red-500 hover:bg-rose-400 shadow-[0_0_6px_rgba(232,56,79,0.5)]';
                          } else if (d.count === 3 || d.count === 4) {
                            barHeight = '86%';
                            barColor = 'bg-gradient-to-t from-red-600 to-rose-400 shadow-[0_0_8px_rgba(232,56,79,0.7)]';
                          } else if (d.count >= 5) {
                            barHeight = '100%';
                            barColor = 'bg-gradient-to-t from-rose-500 to-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.85)]';
                          }

                          return (
                            <div
                              key={d.dayNum}
                              onMouseEnter={() =>
                                setHoveredDetail({
                                  label: formatted,
                                  count: d.count,
                                  badge: d.isToday ? 'Bugün' : undefined,
                                })
                              }
                              onMouseLeave={() => setHoveredDetail(null)}
                              title={`${formatted}: ${d.count} yapım`}
                              className="flex-1 h-full flex items-end cursor-pointer group/day"
                            >
                              <div
                                style={{ height: barHeight }}
                                className={`w-full rounded-[2px] transition-all duration-150 group-hover/day:scale-y-110 ${barColor} ${
                                  d.isToday ? 'ring-1 ring-amber-300' : ''
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Sağ: Ay Toplam Sayısı */}
                      <div className="w-12 sm:w-14 text-right shrink-0">
                        <span
                          className={`${PREMIUM_NUM} inline-block text-xs sm:text-sm px-2 py-0.5 rounded-lg font-black ${
                            isPeak
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                              : hasActivity
                              ? 'bg-red-500/15 text-rose-300 border border-red-500/30'
                              : 'bg-ink-900/70 text-ink-600'
                          }`}
                        >
                          {mItem.totalCount}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AYLIK / HAFTALIK / GÜNLÜK GÖRÜNÜM (Korundu) */}
          {mode === 'month' && (
            <WatchBars
              items={monthBars}
              mode="month"
              onHoverItem={(it) =>
                setHoveredDetail(it ? { label: it.title.split(':')[0], count: it.count, badge: it.isCurrent ? 'Bu Ay' : undefined } : null)
              }
            />
          )}
          {mode === 'week' && (
            <WatchBars
              items={weekBars}
              mode="week"
              onHoverItem={(it) =>
                setHoveredDetail(it ? { label: it.title.split(':')[0], count: it.count, badge: it.isCurrent ? 'Bu Hafta' : undefined } : null)
              }
            />
          )}
          {mode === 'day' && (
            <WatchBars
              items={dayBars}
              mode="day"
              onHoverItem={(it) =>
                setHoveredDetail(it ? { label: it.title.split(':')[0], count: it.count, badge: it.isCurrent ? 'Bugün' : undefined } : null)
              }
            />
          )}
        </>
      )}
    </div>
  );
}

export default function StatsPage() {
  const { movies, series, collections, history } = useLibrary();
  const { achievements, totalXp, dailyStreak } = useGamification();
  const { criteria } = useSettings();
  const [detailTarget, setDetailTarget] = useState<DetailModalTarget | null>(null);
  const [peopleTab, setPeopleTab] = useState<'directors' | 'cast' | 'studios'>('directors');
  const [showWrapped, setShowWrapped] = useState(false);
  const [statsMode, setStatsMode] = useState<StatsScopeMode>('current');
  const [showCalibration, setShowCalibration] = useState(false);

  const currentMoviesCount = useMemo(
    () => countWatchedCurrentMovies(movies),
    [movies]
  );
  const pastMoviesCount = useMemo(
    () => countPastMovies(movies),
    [movies]
  );

  // YENİ: TASARIMI KORUYUP, YÜZLERCE SATIRI TEK FONKSİYONA ÇAĞIRIYORUZ!
  const { ratingChangeCount, lastRatingChange } = useMemo(() => {
    const changed = history.filter((h) => h.previousRating != null);
    const latest = changed.length > 0
      ? [...changed].sort((a, b) => new Date(b.ratingChangedAt || b.watchedAt).getTime() - new Date(a.ratingChangedAt || a.watchedAt).getTime())[0]
      : null;
    return { ratingChangeCount: changed.length, lastRatingChange: latest };
  }, [history]);

  const stats = useComputedStats(movies, series, criteria, history, collections, statsMode);

  // GELİŞMİŞ PUAN DAĞILIMI & SPEKTRUM ANALİZİ
  const ratingAnalytics = useMemo(() => {
    const entries = stats.ratings; // [rating, count][]
    const totalRated = entries.reduce((acc, [, c]) => acc + c, 0);
    if (totalRated === 0) {
      return {
        totalRated: 0,
        maxCount: 1,
        modeRating: 0,
        modeCount: 0,
        stdDev: 0,
        masterpieceRate: 0,
        tiers: [
          { id: 'masterpiece', label: 'Başyapıt Bandı', range: '9.0 – 10', count: 0, pct: 0, color: 'text-amber-300', bar: 'from-amber-400 to-yellow-500', border: 'border-amber-500/30' },
          { id: 'great', label: 'Güçlü Yapımlar', range: '7.0 – 8.9', count: 0, pct: 0, color: 'text-emerald-300', bar: 'from-emerald-500 to-teal-400', border: 'border-emerald-500/30' },
          { id: 'decent', label: 'Ortalama / Çerezlik', range: '5.0 – 6.9', count: 0, pct: 0, color: 'text-sky-300', bar: 'from-sky-500 to-blue-400', border: 'border-sky-500/30' },
          { id: 'poor', label: 'Hayal Kırıklığı', range: '1.0 – 4.9', count: 0, pct: 0, color: 'text-rose-400', bar: 'from-red-600 to-rose-500', border: 'border-red-500/30' },
        ],
        sortedDesc: [] as [number, number][],
      };
    }

    const maxCount = Math.max(...entries.map(([, c]) => c), 1);
    const bestEntry = entries.reduce((a, b) => (b[1] > a[1] ? b : a), entries[0]);

    const weightedSum = entries.reduce((acc, [r, c]) => acc + Number(r) * c, 0);
    const mean = weightedSum / totalRated;
    const variance =
      entries.reduce((acc, [r, c]) => acc + c * Math.pow(Number(r) - mean, 2), 0) / totalRated;
    const stdDev = Math.sqrt(variance);

    let masterpiece = 0;
    let great = 0;
    let decent = 0;
    let poor = 0;

    entries.forEach(([r, c]) => {
      const num = Number(r);
      if (num >= 9) masterpiece += c;
      else if (num >= 7) great += c;
      else if (num >= 5) decent += c;
      else poor += c;
    });

    const pctOf = (n: number) => Math.round((n / totalRated) * 100);

    return {
      totalRated,
      maxCount,
      modeRating: Number(bestEntry[0]),
      modeCount: bestEntry[1],
      stdDev,
      masterpieceRate: pctOf(masterpiece),
      tiers: [
        { id: 'masterpiece', label: 'Başyapıt Bandı', range: '9.0 – 10', count: masterpiece, pct: pctOf(masterpiece), color: 'text-amber-300', bar: 'from-amber-400 to-yellow-500', border: 'border-amber-500/30' },
        { id: 'great', label: 'Güçlü Yapımlar', range: '7.0 – 8.9', count: great, pct: pctOf(great), color: 'text-emerald-300', bar: 'from-emerald-500 to-teal-400', border: 'border-emerald-500/30' },
        { id: 'decent', label: 'Ortalama / Çerezlik', range: '5.0 – 6.9', count: decent, pct: pctOf(decent), color: 'text-sky-300', bar: 'from-sky-500 to-blue-400', border: 'border-sky-500/30' },
        { id: 'poor', label: 'Hayal Kırıklığı', range: '1.0 – 4.9', count: poor, pct: pctOf(poor), color: 'text-rose-400', bar: 'from-red-600 to-rose-500', border: 'border-red-500/30' },
      ],
      sortedDesc: [...entries].sort((a, b) => Number(b[0]) - Number(a[0])),
    };
  }, [stats.ratings]);

  // SİNEMATİK OTOPSİ & TAHAMMÜL ANALİZİ — izleme kapsamından bağımsız, kütüphanenin tamamı.
  const autopsy = useMemo(() => {
    const abMovies = movies.filter((m) => Boolean(m.abandoned));
    const abSeries = series.filter((s) => Boolean(s.abandoned));
    const totalAbandoned = abMovies.length + abSeries.length;
    if (totalAbandoned === 0) return null;

    const movieRuntimeMins = abMovies.reduce((sum, m) => sum + (m.actualRuntime || m.runtime || 0), 0);

    // Kurtarılan zaman: film → abandonedProgress.value dk; dizi → bölüm × ~45 dk (yaklaşık).
    const filmSavedMins = abMovies.reduce(
      (sum, m) => (m.abandonedProgress?.unit === 'minute' ? sum + m.abandonedProgress.value : sum),
      0
    );
    const seriesEpisodes = abSeries.reduce((sum, s) => {
      const p = s.abandonedProgress;
      if (p?.unit === 'episode') return sum + p.value;
      return sum + s.episodes.filter((e) => e.watched).length;
    }, 0);
    const seriesSavedMins = seriesEpisodes * 45;
    const savedMins = filmSavedMins + seriesSavedMins;

    // Tahammül oranı: izlenen / (izlenen + terk).
    const seriesCompleted = series.filter(
      (s) => s.episodes.length > 0 && s.episodes.every((e) => e.watched)
    ).length;
    const watchedTotal = currentMoviesCount + seriesCompleted;
    const toleranceRate =
      watchedTotal + totalAbandoned > 0
        ? Math.round((watchedTotal / (watchedTotal + totalAbandoned)) * 100)
        : null;

    // Ortalama dayanma: terk edilen filmlerde ilerleme / süre.
    const holdable = abMovies.filter((m) => (m.runtime || 0) > 0 && m.abandonedProgress?.unit === 'minute');
    const holdRuntimeSum = holdable.reduce((sum, m) => sum + (m.runtime || 0), 0);
    const holdValueSum = holdable.reduce(
      (sum, m) => sum + Math.min(m.abandonedProgress?.value ?? 0, m.runtime || 0),
      0
    );
    const avgHoldPct =
      holdRuntimeSum > 0 ? Math.round((holdValueSum / holdRuntimeSum) * 100) : null;

    // Ölüm nedeni dağılımı.
    const reasonMap = new Map<string, number>();
    [...abMovies, ...abSeries].forEach((it) =>
      (it.autopsyReasons || []).forEach((r) => reasonMap.set(r, (reasonMap.get(r) || 0) + 1))
    );
    const reasons = [...reasonMap.entries()].sort((a, b) => b[1] - a[1]);

    // Tür dağılımı (ilk 5).
    const genreMap = new Map<string, number>();
    [...abMovies, ...abSeries].forEach((it) =>
      (it.genres || []).forEach((g) => genreMap.set(g, (genreMap.get(g) || 0) + 1))
    );
    const genres = [...genreMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      abMovies: abMovies.length,
      abSeries: abSeries.length,
      totalAbandoned,
      movieRuntimeMins,
      filmSavedMins,
      seriesSavedMins,
      savedMins,
      watchedTotal,
      toleranceRate,
      avgHoldPct,
      reasons,
      genres,
    };
  }, [movies, series, currentMoviesCount]);

  // =========================================================================
  // KÖR KALİBRASYON & ELO — kütüphanenin tamamı (izleme kapsamından bağımsız)
  // (a) GERÇEK TOP 10: calibratedScore (yoksa puan) ile dürüst sıralama;
  //     detectRatingAnomalies işaretli filmlerde sapma rozeti gösterilir.
  // (b) PUAN ENFLASYONU: ortalama |calibrated − rating| sapması + en çok
  //     şişirilen (direction 'lower') / düşürülen (direction 'raise') filmler.
  // =========================================================================
  const anomalies = useMemo(() => detectRatingAnomalies(movies), [movies]);
  const anomalyById = useMemo(
    () => new Map(anomalies.map((a) => [a.movie.id, a])),
    [anomalies]
  );
  const realTop10 = useMemo(
    () =>
      movies
        .filter((m) => m.watched && typeof m.rating === 'number' && !m.abandoned)
        .sort((a, b) => {
          const diff =
            (b.calibratedScore ?? b.rating ?? 0) - (a.calibratedScore ?? a.rating ?? 0);
          if (diff !== 0) return diff;
          // 10 puanlı filmlerde: düello kazancı fazla olan üst sıralansın.
          const wd = (b.duelWins || 0) - (a.duelWins || 0);
          return wd !== 0 ? wd : (a.title || '').localeCompare(b.title || '', 'tr');
        })
        .slice(0, 10),
    [movies]
  );
  const duelWinners = useMemo(
    () =>
      movies
        .filter((m) => (m.duelWins || 0) > 0)
        .sort((a, b) => {
          const wd = (b.duelWins || 0) - (a.duelWins || 0);
          if (wd !== 0) return wd;
          return (a.title || '').localeCompare(b.title || '', 'tr');
        })
        .slice(0, 10),
    [movies]
  );
  const inflation = useMemo(() => {
    const both = movies.filter(
      (m) => typeof m.rating === 'number' && typeof m.calibratedScore === 'number'
    );
    if (both.length === 0) return null;
    const sumAbs = both.reduce(
      (s, m) => s + Math.abs((m.calibratedScore as number) - (m.rating as number)),
      0
    );
    return {
      count: both.length,
      avgAbs: Math.round((sumAbs / both.length) * 100) / 100,
      // direction 'lower' → puan kalibreden YÜKSEK (şişirilen),
      // direction 'raise' → puan kalibreden DÜŞÜK (düşürülen).
      inflated: anomalies.filter((a) => a.direction === 'lower').slice(0, 5),
      deflated: anomalies.filter((a) => a.direction === 'raise').slice(0, 5),
    };
  }, [movies, anomalies]);

  const genreAllSorted = Array.from(stats.genreAllMap.entries()).sort((a, b) => b[1].count - a[1].count);
  const maxGenreCount = Math.max(...genreAllSorted.map(([, v]) => v.count), 1);
  const genreColors = [
    'from-red-500 to-rose-400', 'from-rose-500 to-red-400', 'from-red-600 to-red-400', 'from-rose-600 to-rose-400',
    'from-red-500 to-orange-400', 'from-rose-500 to-pink-400', 'from-red-700 to-red-500', 'from-rose-400 to-red-300',
  ];

  const openHistoryItemDetail = (h: WatchHistoryItem) => {
    if (h.kind === 'movie' || h.type === 'movie') {
      const found = movies.find((m) => m.id === (h.itemId || h.id));
      const fallback = found || {
        id: h.itemId || h.id, title: h.title, year: h.year || '', genres: h.genres || [], collectionId: null,
        watched: true, isPastWatch: h.isPastWatch, rating: h.rating, detailedRating: h.detailedRating, reviewTags: h.reviewTags, note: h.note, watchedAt: h.watchedAt, addedAt: h.watchedAt,
      } as any;
      setDetailTarget({ type: 'movie', data: fallback, historyItem: h });
    } else {
      const sid = h.seriesId || h.itemId || h.id;
      const found = series.find((s) => s.id === sid);
      const fallback = found || { id: sid, title: h.title, year: h.year, genres: h.genres || [], episodes: [], addedAt: h.watchedAt } as any;
      setDetailTarget({ type: 'series', data: fallback, historyItem: h });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in pb-10">
      <style>{STATS_PREMIUM_CSS}</style>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-ink-100 flex items-center gap-2.5">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${RED_TILE}`}>
              <BarChart3 size={20} className="text-white" />
            </div>
            <span>İstatistik Stüdyosu</span>
          </h1>

          <div data-tutorial="stats-header" className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowWrapped(true)}
              className="relative overflow-hidden flex items-center gap-1.5 bg-gradient-to-r from-red-500 via-red-600 to-red-700 hover:from-rose-400 hover:to-red-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 min-h-11 sm:min-h-0 rounded-full text-[11px] sm:text-xs font-black tracking-wider uppercase shadow-[0_10px_28px_-10px_rgba(232,56,79,0.8),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all hover:scale-105"
            >
              <Sparkles size={13} /> <span>Wrapped Özeti</span>
            </button>

            <div className="inline-flex items-center gap-1.5 bg-ink-900/80 border border-ink-700/60 px-3 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold text-ink-300">
              <Sparkles size={12} className="text-gold-400" />
              <span className="hidden xs:inline">Kimlik:</span>
              <span className={`${stats.ratingPersona.color} font-black`}>{stats.ratingPersona.label}</span>
            </div>
          </div>
        </div>

        <div data-tutorial="stats-modes" className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-ink-900/70 border border-ink-700/60 p-1.5 sm:p-2 rounded-2xl">
          <div className="grid grid-cols-3 sm:flex items-center gap-1">
            <button
              type="button"
              onClick={() => setStatsMode('current')}
              className={`flex items-center justify-center gap-1 px-2 sm:px-3.5 py-2 min-h-11 sm:min-h-0 rounded-xl text-[11px] sm:text-xs font-black transition-all truncate ${
                statsMode === 'current'
                  ? RED_PILL_ACTIVE
                  : 'text-ink-400 hover:text-ink-100 hover:bg-white/[0.06]'
              }`}
            >
              <Activity size={13} className="flex-shrink-0 hidden xs:inline" />
              <span className="truncate">Güncel ({currentMoviesCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatsMode('past')}
              className={`flex items-center justify-center gap-1 px-2 sm:px-3.5 py-2 min-h-11 sm:min-h-0 rounded-xl text-[11px] sm:text-xs font-black transition-all truncate ${
                statsMode === 'past'
                  ? RED_PILL_ACTIVE
                  : 'text-ink-400 hover:text-ink-100 hover:bg-white/[0.06]'
              }`}
            >
              <History size={13} className="flex-shrink-0 hidden xs:inline" />
              <span className="truncate">Önceden ({pastMoviesCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatsMode('all')}
              className={`flex items-center justify-center gap-1 px-2 sm:px-3.5 py-2 min-h-11 sm:min-h-0 rounded-xl text-[11px] sm:text-xs font-black transition-all truncate ${
                statsMode === 'all'
                  ? RED_PILL_ACTIVE
                  : 'text-ink-400 hover:text-ink-100 hover:bg-white/[0.06]'
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

      <div data-tutorial="stats-heatmap" className={`${PREMIUM_PANEL} relative overflow-hidden`}>
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <WatchMap history={stats.scopedHistory} />
        </div>
      </div>

      <div className="bg-gradient-to-br from-ink-950 via-ink-900 to-ink-950 border border-ink-700/70 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-[0_30px_70px_-28px_rgba(0,0,0,0.9)] relative overflow-hidden">
        <div className="absolute -right-6 -top-10 text-red-500/10 transform rotate-12 pointer-events-none">
          <Hourglass size={180} />
        </div>
        <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

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
                  <span className={`${PREMIUM_NUM} text-3xl sm:text-5xl text-ink-50`}>{stats.runtimeDays}</span>
                  <span className="text-xs sm:text-base font-bold text-gold-400 uppercase tracking-widest">Gün</span>
                </div>
              )}
              <div className="flex items-baseline gap-1">
                <span className={`${PREMIUM_NUM} text-3xl sm:text-5xl text-ink-50`}>{stats.runtimeHours}</span>
                <span className="text-xs sm:text-base font-bold text-rose-400 uppercase tracking-widest">Saat</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`${PREMIUM_NUM} text-3xl sm:text-5xl text-ink-50`}>{stats.runtimeMins}</span>
                <span className="text-xs sm:text-base font-bold text-ink-400 uppercase tracking-widest">Dk</span>
              </div>
            </div>

            <div className="mt-2.5 sm:mt-3 space-y-1">
              <p className="text-[11px] sm:text-xs text-ink-300 flex items-center gap-1.5 font-medium">
                <Activity size={13} className="text-gold-400 flex-shrink-0" />
                <span>Toplam <strong className={`${PREMIUM_NUM} text-white`}>{stats.totalActualMinutes.toLocaleString('tr-TR')} dk</strong> izleme süresi.</span>
              </p>
              <p className="text-[11px] text-ink-400 flex items-center gap-1.5 flex-wrap">
                <Film size={12} className="text-gold-400 flex-shrink-0" />
                <span>Katalog Süresi:</span>
                <strong className={`${PREMIUM_NUM} text-gold-300`}>
                  {stats.catalogDays > 0 ? `${stats.catalogDays}G ` : ''}{stats.catalogHours}Sa {stats.catalogMins}Dk
                </strong>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:w-auto w-full flex-shrink-0">
            <div className={`${PREMIUM_CELL} p-3 sm:p-3.5 min-w-[130px]`}>
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-gold-400 mb-1"><Film size={13} /> Film Süresi</div>
              <div className={`${PREMIUM_NUM} text-lg sm:text-xl text-ink-50`}>{Math.round(stats.actualMovieRuntimeMinutes / 60)} <span className="text-xs font-semibold text-ink-400">Saat</span></div>
              <div className="text-[10px] text-ink-500 mt-0.5">{stats.movieCount} Film</div>
            </div>

            <div className={`${PREMIUM_CELL} p-3 sm:p-3.5 min-w-[130px]`}>
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-rose-400 mb-1"><Tv size={13} /> Dizi Süresi</div>
              <div className={`${PREMIUM_NUM} text-lg sm:text-xl text-ink-50`}>{Math.round(stats.seriesRuntimeMinutes / 60)} <span className="text-xs font-semibold text-ink-400">Saat</span></div>
              <div className="text-[10px] text-ink-500 mt-0.5">{stats.seriesCount} Bölüm</div>
            </div>
          </div>
        </div>
      </div>

      {statsMode !== 'past' && (
        <div className="bg-ink-900/65 border border-red-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-2 mb-3.5">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100 flex items-center gap-2">
                <span className={`w-7 h-7 rounded-lg ${RED_TILE}`}>
                  <Zap size={14} className="text-white" />
                </span>
                Zaman Bükücü & Hız Analizi
              </h2>
              <p className="text-[11px] sm:text-xs text-ink-400 mt-0.5">
                Canlı sayaçla izlenen filmlerdeki hız ve zaman tasarrufu verilerin
              </p>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            <div className={`${PREMIUM_CELL} p-3 sm:p-4 flex flex-col justify-between`}>
              <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-gold-400 uppercase">
                <span>Erken Biten</span>
                <FastForward size={14} />
              </div>
              <div className={`${PREMIUM_NUM} text-xl sm:text-3xl text-white mt-1.5`}>
                {stats.earlyFinishedCount} <span className="text-xs font-bold text-ink-400">Film</span>
              </div>
              <div className="text-[10px] text-ink-400 mt-1">
                Süresinden kısa bitti
              </div>
            </div>

            <div className={`${PREMIUM_CELL} p-3 sm:p-4 flex flex-col justify-between`}>
              <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-rose-400 uppercase">
                <span>Kazanılan</span>
                <Clock size={14} />
              </div>
              <div className={`${PREMIUM_NUM} text-xl sm:text-3xl text-white mt-1.5`}>
                {stats.savedHours > 0 ? `${stats.savedHours}Sa ` : ''}{stats.savedMins} <span className="text-xs font-bold text-ink-400">Dk</span>
              </div>
              <div className="text-[10px] text-ink-400 mt-1">
                Toplam <strong className="text-gold-400">{stats.totalSavedMinutes} dk</strong> kâr
              </div>
            </div>

            <div className={`${PREMIUM_CELL} p-3 sm:p-4 flex flex-col justify-between`}>
              <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-gold-400 uppercase">
                <span>Ort. Hızın</span>
                <Gauge size={14} />
              </div>
              <div className={`${PREMIUM_NUM} text-xl sm:text-3xl text-white mt-1.5`}>
                {stats.avgSpeedMultiplier.toFixed(2)}x
              </div>
              <div className="text-[10px] text-ink-400 mt-1 truncate">
                {stats.avgSpeedMultiplier > 1.05 ? 'Hızlı İzleyici ⚡' : 'Standart Tempo 🎬'}
              </div>
            </div>

            <div className={`${PREMIUM_CELL} p-3 sm:p-4 flex flex-col justify-between`}>
              <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-rose-400 uppercase">
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
        <div className={`${PREMIUM_PANEL} ${PREMIUM_GLOW} !p-3.5 sm:!p-4 flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-ink-400 uppercase tracking-wider">
              {statsMode === 'past' ? 'Önceden Film' : 'İzlenen Film'}
            </span>
            <Film size={16} className="text-gold-400" />
          </div>
          <div className={`${PREMIUM_NUM} text-2xl sm:text-3xl text-ink-50 mt-1.5`}>{stats.movieCount}</div>
          <div className="text-[11px] text-ink-400 mt-1">Ort: <strong className="text-gold-400">{stats.avgMovie.toFixed(1)}</strong></div>
        </div>

        <div className={`${PREMIUM_PANEL} ${PREMIUM_GLOW} !p-3.5 sm:!p-4 flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-ink-400 uppercase tracking-wider">İzlenen Bölüm</span>
            <Tv size={16} className="text-rose-400" />
          </div>
          <div className={`${PREMIUM_NUM} text-2xl sm:text-3xl text-ink-50 mt-1.5`}>{stats.seriesCount}</div>
          <div className="text-[11px] text-ink-400 mt-1">Ort: <strong className="text-rose-400">{stats.avgSeries.toFixed(1)}</strong> ({stats.uniqueSeriesCount} Dizi)</div>
        </div>

        <div className={`${PREMIUM_PANEL} ${PREMIUM_GLOW} !p-3.5 sm:!p-4 flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-ink-400 uppercase tracking-wider">Genel Ort.</span>
            <Star size={16} className="text-gold-400 fill-current" />
          </div>
          <div className={`${PREMIUM_NUM} text-2xl sm:text-3xl text-ink-50 mt-1.5`}>{stats.avgTotal.toFixed(1)}</div>
          <div className={`text-[11px] font-bold mt-1 truncate ${stats.ratingPersona.color}`}>{stats.ratingPersona.label}</div>
        </div>

        <div className={`${PREMIUM_PANEL} ${PREMIUM_GLOW} !p-3.5 sm:!p-4 flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-ink-400 uppercase tracking-wider">Kazanılan Kupa</span>
            <Award size={16} className="text-gold-400" />
          </div>
          <div className={`${PREMIUM_NUM} text-2xl sm:text-3xl text-ink-50 mt-1.5`}>{achievements.reduce((s, a) => s + a.unlockedTiers.length, 0)}</div>
          <div className="text-[11px] text-ink-400 mt-1"><strong className="text-gold-400">{(totalXp || 0).toLocaleString()} XP</strong></div>
        </div>
      </div>

      {statsMode !== 'past' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          <div className="bg-ink-900/70 border border-gold-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] flex flex-col justify-between gap-3.5 transition-colors duration-300">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl ${RED_TILE} flex-shrink-0`}>
                  <Film size={20} className="text-white" />
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-gold-400">Sırada Bekleyen Filmler</div>
                  <div className={`${PREMIUM_NUM} text-xl sm:text-3xl text-ink-50 mt-0.5`}>{stats.remainingMovies} <span className="text-xs sm:text-sm font-bold text-ink-400">Film</span></div>
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
                <div className="h-full bg-gradient-to-r from-red-600 to-rose-400 rounded-full shadow-[0_0_12px_rgba(232,56,79,0.6)] transition-all duration-700" style={{ width: `${stats.movieCompletionPct}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-ink-900/70 border border-rose-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] flex flex-col justify-between gap-3.5 transition-colors duration-300">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl ${RED_TILE} flex-shrink-0`}>
                  <Tv size={20} className="text-white" />
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-rose-400">Sırada Bekleyen Diziler</div>
                  <div className={`${PREMIUM_NUM} text-xl sm:text-3xl text-ink-50 mt-0.5`}>
                    {stats.ongoingSeriesCount} <span className="text-xs font-bold text-ink-400">Dizi</span> · {stats.remainingEpisodes} <span className="text-xs font-bold text-ink-400">Böl.</span>
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-black bg-ink-950 border border-ink-800 text-rose-400 px-2 py-1 rounded-lg flex-shrink-0">~{stats.remainingEpisodesHours} Saat</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-ink-400">
                <span>Tamamlanma Oranı</span>
                <span className="text-rose-400">%{stats.seriesCompletionPct}</span>
              </div>
              <div className="h-2 w-full bg-ink-950 rounded-full overflow-hidden border border-ink-800">
                <div className="h-full bg-gradient-to-r from-rose-500 to-red-400 rounded-full shadow-[0_0_12px_rgba(255,107,122,0.6)] transition-all duration-700" style={{ width: `${stats.seriesCompletionPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {statsMode !== 'past' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className={`${PREMIUM_PANEL} lg:col-span-7 flex flex-col justify-between`}>
            <div className="mb-3.5">
              <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100 flex items-center gap-2"><Clock size={18} className="text-gold-400" /> İzleme Biyoritmi (Günün Saatleri)</h2>
              <p className="text-xs text-ink-400 mt-0.5">Günün hangi zaman diliminde izlemeyi seviyorsun?</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { key: 'morning', label: 'Sabah', hours: '06:00 - 11:59', count: stats.timeBuckets.morning, icon: Coffee, color: 'text-gold-400', bar: 'bg-gradient-to-r from-red-600 to-rose-400' },
                { key: 'afternoon', label: 'Gündüz', hours: '12:00 - 17:59', count: stats.timeBuckets.afternoon, icon: Sun, color: 'text-rose-400', bar: 'bg-gradient-to-r from-rose-500 to-red-400' },
                { key: 'evening', label: 'Prime Time', hours: '18:00 - 23:59', count: stats.timeBuckets.evening, icon: Sunset, color: 'text-gold-400', bar: 'bg-gradient-to-r from-red-500 to-rose-400' },
                { key: 'night', label: 'Gece Kuşu', hours: '00:00 - 05:59', count: stats.timeBuckets.night, icon: Moon, color: 'text-rose-300', bar: 'bg-gradient-to-r from-red-700 to-red-500' },
              ].map((slot) => {
                const Icon = slot.icon;
                const pct = Math.round((slot.count / stats.totalTimeTracked) * 100);
                return (
                  <div key={slot.key} className={`${PREMIUM_CELL} p-3 flex flex-col justify-between`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <Icon size={16} className={slot.color} />
                      <span className={`${PREMIUM_NUM} text-xs text-ink-100`}>%{pct}</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-ink-200">{slot.label}</div>
                      <div className="text-[10px] text-ink-500">{slot.hours}</div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 w-full bg-ink-900 rounded-full overflow-hidden">
                        <div className={`h-full ${slot.bar} rounded-full shadow-[0_0_10px_rgba(232,56,79,0.45)]`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] font-semibold text-ink-400 text-right">{slot.count} İzleme</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`${PREMIUM_PANEL} lg:col-span-5 flex flex-col justify-between`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100 flex items-center gap-2"><Activity size={18} className="text-rose-400" /> Son 14 Günlük Tempo</h2>
                <p className="text-xs text-ink-400 mt-0.5">Son 2 haftadaki günlük aktivite nabzın</p>
              </div>
              <span className="text-xs font-bold bg-ink-950 border border-ink-800 text-rose-400 px-2.5 py-1 rounded-lg">Bu Ay: {stats.thisMonthCount}</span>
            </div>
            <div className="flex items-end justify-between gap-1.5 h-28 pt-4 px-1">
              {stats.last14Days.map((d) => {
                const hPct = d.count > 0 ? Math.max(18, (d.count / stats.max14DayCount) * 100) : 6;
                return (
                  <div key={d.date} title={`${d.label}: ${d.count} izleme`} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className={`${PREMIUM_NUM} text-[10px] text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity`}>{d.count}</span>
                    <div className={`w-full rounded-t-md transition-all duration-500 ${d.count > 0 ? 'bg-gradient-to-t from-red-700 to-rose-400 group-hover:brightness-125 shadow-[0_0_8px_rgba(232,56,79,0.35)]' : 'bg-ink-800/70'}`} style={{ height: `${hPct}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] font-semibold text-ink-500 border-t stats-hr border-ink-800/60 pt-2 mt-2">
              <span>{stats.last14Days[0]?.label}</span>
              <span>Bugün ({stats.last14Days[stats.last14Days.length - 1]?.count || 0} izleme)</span>
            </div>
          </div>
        </div>
      )}

      <div className={PREMIUM_PANEL}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3.5">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100 flex items-center gap-2"><Tag size={18} className="text-gold-400" /> Değerlendirme Başlıkları</h2>
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
                <div key={item.tag} className={`${PREMIUM_CELL} p-3 flex flex-col justify-between gap-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-black text-ink-100 truncate">{item.tag}</span>
                    {item.avg > 0 && <span className={`text-xs px-2 py-0.5 rounded-md font-black flex-shrink-0 ${ratingBgClass(item.avg)}`}>Ort: {item.avg.toFixed(1)}</span>}
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-ink-900 rounded-full overflow-hidden border border-ink-800">
                      <div className="h-full bg-gradient-to-r from-red-600 to-rose-400 rounded-full shadow-[0_0_10px_rgba(232,56,79,0.5)] transition-all duration-700" style={{ width: `${widthPct}%` }} />
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
        <div className={`${PREMIUM_PANEL} space-y-3`}>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100 flex items-center gap-2"><Trophy size={18} className="text-gold-400" /> Sinevia Rekorlar Kitabı</h2>
            <p className="text-xs text-ink-400 mt-0.5">Kütüphanendeki en dikkat çekici kişisel rekorların</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className={`${PREMIUM_CELL} p-3`}>
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-gold-400 uppercase"><Flame size={12} /> Yoğun Gün</div>
              <div className={`${PREMIUM_NUM} text-sm sm:text-lg text-ink-50 mt-1`}>{stats.busiestDay.count > 0 ? `${stats.busiestDay.count} Yapım` : 'Yok'}</div>
              <div className="text-[10px] text-ink-400 mt-0.5 truncate">{stats.busiestDay.date}</div>
            </div>
            <div className={`${PREMIUM_CELL} p-3`}>
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-rose-400 uppercase"><Zap size={12} /> Seri Rekoru</div>
              <div className={`${PREMIUM_NUM} text-sm sm:text-lg text-ink-50 mt-1`}>{stats.maxStreakEver} Gün</div>
              <div className="text-[10px] text-ink-400 mt-0.5">Aktif: {dailyStreak} gün</div>
            </div>
            <div className={`${PREMIUM_CELL} p-3`}>
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-gold-400 uppercase"><Clock size={12} /> En Uzun Film</div>
              <div className="text-xs sm:text-sm font-black text-ink-50 mt-1 truncate">{stats.longestMovie ? stats.longestMovie.title : 'Yok'}</div>
              <div className="text-[10px] text-ink-400 mt-0.5">{stats.longestMovie ? `${stats.longestMovie.runtime} Dk` : '-'}</div>
            </div>
            <div className={`${PREMIUM_CELL} p-3`}>
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-rose-400 uppercase"><Tv size={12} /> Favori Dizi</div>
              <div className="text-xs sm:text-sm font-black text-ink-50 mt-1 truncate">{stats.mostWatchedSeries ? stats.mostWatchedSeries.title : 'Yok'}</div>
              <div className="text-[10px] text-ink-400 mt-0.5">{stats.mostWatchedSeries ? `${stats.mostWatchedSeries.count} Bölüm` : '-'}</div>
            </div>
          </div>
          <div className="bg-ink-950/50 border border-ink-800/60 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2"><StickyNote size={15} className="text-rose-400" /><span className="text-xs font-bold text-ink-200">Eleştirmen Notların</span></div>
            <span className="text-xs font-black text-rose-400">{stats.notesCount} Not ({stats.totalNoteWords} Kelime)</span>
          </div>
        </div>

        <div className={PREMIUM_PANEL}>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100 flex items-center gap-2"><Globe size={18} className="text-rose-400" /> Dünya Sineması Pasaportu</h2>
            <p className="text-xs text-ink-400 mt-0.5 mb-3.5">İzlediğin yapımların ülke sinemalarına göre dağılımı</p>
            {stats.topLanguages.length === 0 ? (
              <div className="text-center py-8 bg-ink-950/40 rounded-xl border border-ink-800/60">
                <p className="text-xs text-ink-400 px-4">Dil/Ülke verisi bulunamadı. <strong>"Eksik Bul"</strong> butonuna tıklayarak TMDB verilerini senkronize edebilirsin.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {stats.topLanguages.map((lang) => (
                  <div key={lang.code} className={`${PREMIUM_CELL} p-3 flex items-center justify-between gap-2`}>
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

      <div className={PREMIUM_PANEL}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100 flex items-center gap-2"><Crown size={18} className="text-gold-400" /> Yıldızlar Geçidi</h2>
            <p className="text-xs text-ink-400 mt-0.5">En çok tercih ettiğin yönetmenler, oyuncular ve stüdyolar</p>
          </div>
          <div className="grid grid-cols-3 sm:flex bg-ink-950 rounded-xl p-1 border border-ink-800 w-full sm:w-fit gap-1">
            <button type="button" onClick={() => setPeopleTab('directors')} className={`flex items-center justify-center gap-1 px-2.5 py-1.5 min-h-11 sm:min-h-0 rounded-lg text-xs font-bold transition-all ${peopleTab === 'directors' ? RED_PILL_ACTIVE : 'text-ink-400 hover:text-ink-100 hover:bg-white/[0.06]'}`}><User size={12} /> Yönetmen</button>
            <button type="button" onClick={() => setPeopleTab('cast')} className={`flex items-center justify-center gap-1 px-2.5 py-1.5 min-h-11 sm:min-h-0 rounded-lg text-xs font-bold transition-all ${peopleTab === 'cast' ? RED_PILL_ACTIVE : 'text-ink-400 hover:text-ink-100 hover:bg-white/[0.06]'}`}><Users size={12} /> Oyuncu</button>
            <button type="button" onClick={() => setPeopleTab('studios')} className={`flex items-center justify-center gap-1 px-2.5 py-1.5 min-h-11 sm:min-h-0 rounded-lg text-xs font-bold transition-all ${peopleTab === 'studios' ? RED_PILL_ACTIVE : 'text-ink-400 hover:text-ink-100 hover:bg-white/[0.06]'}`}><Building2 size={12} /> Stüdyo</button>
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
                <div key={item.name} className={`${PREMIUM_CELL} p-3 flex items-center justify-between gap-3`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0 ${idx === 0 ? 'bg-gradient-to-br from-red-500 to-red-700 text-white shadow-[0_6px_16px_-6px_rgba(232,56,79,0.85)]' : idx === 1 ? 'bg-slate-300 text-slate-900' : idx === 2 ? 'bg-red-900 text-white border border-red-700' : 'bg-ink-800 text-ink-300 border border-ink-700'}`}>#{idx + 1}</div>
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
        <div className={PREMIUM_PANEL}>
          <div className="mb-3.5">
            <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100 flex items-center gap-2"><Star size={18} className="text-gold-400 fill-current" /> Şeref Kürsüsü</h2>
            <p className="text-xs text-ink-400 mt-0.5">En yüksek puan verdiğin yapımlar</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3.5">
            {stats.topRated.map((h, i) => {
              const isMovie = h.kind === 'movie' || h.type === 'movie';
              const poster = isMovie ? movies.find((m) => m.id === (h.itemId || h.id))?.posterUrl : series.find((s) => s.id === (h.seriesId || h.itemId || h.id))?.posterUrl;
              return (
                <button key={h.id} type="button" onClick={() => openHistoryItemDetail(h)} className="group relative flex flex-col text-left bg-ink-950/70 border border-ink-800 hover:border-red-500/50 hover:shadow-[0_0_0_1px_rgba(232,56,79,0.35),0_16px_38px_-16px_rgba(232,56,79,0.6)] rounded-xl sm:rounded-2xl overflow-hidden shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
                  <div className="aspect-[2/3] w-full bg-ink-900 relative overflow-hidden">
                    {poster ? <img loading="lazy" decoding="async" src={poster} alt={h.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" onError={handleImgFallback}/> : <div className="w-full h-full flex items-center justify-center text-ink-600">{isMovie ? <Film size={24} /> : <Tv size={24} />}</div>}
                    <div className="absolute top-1.5 left-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-gradient-to-br from-red-500 to-red-700 backdrop-blur-md border border-rose-300/30 flex items-center justify-center text-[10px] font-black text-white">#{i + 1}</div>
                    {h.rating !== null && <div className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-lg text-[10px] sm:text-xs font-black shadow-md ${ratingBgClass(h.rating)}`}>{h.rating}</div>}
                  </div>
                  <div className="p-2">
                    <div className="text-[11px] sm:text-xs font-bold text-ink-100 truncate group-hover:text-rose-300 transition-colors">{h.title}</div>
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
          <div className={`${PREMIUM_PANEL} flex flex-col`}>
            <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100 flex items-center gap-2 mb-1">
              <Hexagon size={18} className="text-rose-400" /> Sinefil Karakter Radarı
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
                        <div className="h-full bg-gradient-to-r from-red-600 to-rose-400 rounded-full shadow-[0_0_10px_rgba(232,56,79,0.5)] transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={PREMIUM_PANEL}>
            <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100 mb-1 flex items-center gap-2"><Compass size={18} className="text-gold-400" /> Dönemlere Göre Tercihlerin</h2>
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
                        <div className="h-full bg-gradient-to-r from-red-700 to-rose-400 rounded-lg flex items-center justify-end pr-2 text-[11px] font-black text-white shadow-[0_0_12px_rgba(232,56,79,0.45)] transition-all duration-700" style={{ width: `${pct}%` }}>{d.count}</div>
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

      <div className={PREMIUM_PANEL}>
        <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100 mb-3.5 flex items-center gap-2"><Layers size={18} className="text-rose-400" /> En Sevdiğin Türler</h2>
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
                    <div className={`h-full bg-gradient-to-r ${colorClass} rounded-lg flex items-center justify-end pr-2 transition-all duration-700 ease-out group-hover:brightness-110 group-hover:shadow-[0_0_14px_rgba(232,56,79,0.5)]`} style={{ width: `${Math.max(8, (val.count / maxGenreCount) * 100)}%` }}>
                      <span className="text-[11px] sm:text-xs font-bold text-white drop-shadow">{val.count}</span>
                    </div>
                  </div>
                  {avg > 0 && <span className={`text-xs px-2 py-0.5 rounded font-bold flex-shrink-0 w-10 text-center ${ratingBgClass(avg)}`}>{avg.toFixed(1)}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SİNEMATİK OTOPSİ & TAHAMMÜL ANALİZİ */}
      <div className={PREMIUM_PANEL}>
        <div className="mb-3.5">
          <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100 flex items-center gap-2">
            <Skull size={18} className="text-red-400" /> Sinematik Otopsi &amp; Tahammül Analizi
          </h2>
          <p className="text-xs text-ink-400 mt-0.5">
            Yarım bırakılan yapımlar, kurtarılan zaman ve ölüm nedenleri
          </p>
        </div>

        {autopsy === null ? (
          <div className="text-center py-10 px-4">
            <Skull size={36} className="mx-auto text-ink-700 mb-3" />
            <p className="text-sm font-black uppercase tracking-widest text-ink-400">Henüz otopsi yok</p>
            <p className="text-xs text-ink-500 mt-1.5">
              Bir filmi ya da diziyi yarım bıraktığında burada otopsi raporu oluşur.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
              <div className={`${PREMIUM_CELL} p-3`}>
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-red-400 uppercase">
                  <Skull size={12} /> Terk Edilen
                </div>
                <div className={`${PREMIUM_NUM} text-lg sm:text-2xl text-ink-50 mt-1`}>
                  {autopsy.totalAbandoned} Yapım
                </div>
                <div className="text-[10px] text-ink-400 mt-0.5">
                  {autopsy.abMovies} film{autopsy.movieRuntimeMins > 0 ? ` (≈${Math.round(autopsy.movieRuntimeMins / 60)} sa)` : ''} · {autopsy.abSeries} dizi
                </div>
              </div>
              <div className={`${PREMIUM_CELL} p-3`}>
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-red-400 uppercase">
                  <FastForward size={12} /> Kurtarılan Zaman
                </div>
                <div className={`${PREMIUM_NUM} text-lg sm:text-2xl text-ink-50 mt-1`}>
                  {autopsy.savedMins} dk
                </div>
                <div className="text-[10px] text-ink-400 mt-0.5">
                  film {autopsy.filmSavedMins} dk + dizi ~{autopsy.seriesSavedMins} dk (yaklaşık)
                </div>
              </div>
              <div className={`${PREMIUM_CELL} p-3`}>
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-red-400 uppercase">
                  <Gauge size={12} /> Tahammül Oranı
                </div>
                <div className={`${PREMIUM_NUM} text-lg sm:text-2xl text-ink-50 mt-1`}>
                  {autopsy.toleranceRate !== null ? `%${autopsy.toleranceRate}` : '—'}
                </div>
                <div className="text-[10px] text-ink-400 mt-0.5">
                  İzlenen {autopsy.watchedTotal} · Terk {autopsy.totalAbandoned}
                </div>
              </div>
              <div className={`${PREMIUM_CELL} p-3`}>
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-red-400 uppercase">
                  <Hourglass size={12} /> Ortalama Dayanma
                </div>
                <div className={`${PREMIUM_NUM} text-lg sm:text-2xl text-ink-50 mt-1`}>
                  {autopsy.avgHoldPct !== null ? `%${autopsy.avgHoldPct}` : '—'}
                </div>
                <div className="text-[10px] text-ink-400 mt-0.5">terk edilen filmlerde ilerleme</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-widest text-ink-300 flex items-center gap-1.5">
                  <Tag size={13} className="text-red-400" /> Ölüm Nedeni Dağılımı
                </h3>
                {autopsy.reasons.length === 0 ? (
                  <p className="text-xs text-ink-500">Neden kaydı girilmemiş.</p>
                ) : (
                  <div className="space-y-2">
                    {autopsy.reasons.map(([reason, count]) => {
                      const maxCount = autopsy.reasons[0][1];
                      const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      return (
                        <div key={reason} className="flex items-center gap-2.5">
                          <div className="w-28 sm:w-32 text-xs font-medium text-ink-300 flex-shrink-0 truncate" title={reason}>
                            {reason}
                          </div>
                          <div className="flex-1 h-5 sm:h-6 bg-ink-800/60 rounded-lg overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-red-600 to-rose-500 rounded-lg transition-all duration-500"
                              style={{ width: `${Math.max(pct, 6)}%` }}
                            />
                          </div>
                          <span className={`${PREMIUM_NUM} text-[11px] text-ink-400 w-6 text-right flex-shrink-0`}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-widest text-ink-300 flex items-center gap-1.5">
                  <Layers size={13} className="text-rose-400" /> Terk Edilenlerde Türler (İlk 5)
                </h3>
                {autopsy.genres.length === 0 ? (
                  <p className="text-xs text-ink-500">Tür bilgisi yok.</p>
                ) : (
                  <div className="space-y-2">
                    {autopsy.genres.map(([genre, count], i) => {
                      const maxCount = autopsy.genres[0][1];
                      const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      return (
                        <div key={genre} className="flex items-center gap-2.5">
                          <div className="w-28 sm:w-32 text-xs font-medium text-ink-300 flex-shrink-0 truncate">{genre}</div>
                          <div className="flex-1 h-5 sm:h-6 bg-ink-800/60 rounded-lg overflow-hidden">
                            <div
                              className={`h-full ${genreColors[i % genreColors.length]} rounded-lg transition-all duration-500`}
                              style={{ width: `${Math.max(pct, 6)}%` }}
                            />
                          </div>
                          <span className={`${PREMIUM_NUM} text-[11px] text-ink-400 w-6 text-right flex-shrink-0`}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KÖR KALİBRASYON & ELO — Gerçek Top 10 + Puan Enflasyonu + Başlat */}
      <div className={PREMIUM_PANEL}>
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100 flex items-center gap-2">
              <Scale size={18} className="text-gold-400" /> Kör Kalibrasyon &amp; Elo
            </h2>
            <p className="text-xs text-ink-400 mt-0.5 leading-relaxed">
              Puan ile düello tabanlı kalibre puan arasındaki fark — dürüst sıralama ve enflasyon analizi
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCalibration(true)}
            style={{
              background: 'var(--red, var(--color-1, #e8384f))',
              color: 'var(--on-color-1, #0a0a0e)',
              borderColor: 'var(--red, var(--color-1, #e8384f))',
            }}
            className="px-4 py-2.5 min-h-11 rounded-xl border font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-transform active:scale-[0.98] shadow-[0_12px_30px_-12px_rgba(232,56,79,0.9)] shrink-0"
            title="5'li tur halinde kör düello — eşleşmeler ±0.5 puan aralığından seçilir"
          >
            <Swords size={14} /> Düelloya Başla
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* (a) GERÇEK TOP 10 */}
          <div className="bg-ink-950/50 border border-ink-800/70 rounded-2xl p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-ink-300 flex items-center gap-1.5">
                <Trophy size={13} className="text-gold-400" /> Gerçek Top 10
              </h3>
              <span className="text-[10px] font-bold bg-ink-950 border border-ink-800 text-ink-400 px-2 py-0.5 rounded-full shrink-0">
                calibratedScore
              </span>
            </div>
            {realTop10.length === 0 ? (
              <p className="text-xs text-ink-500 py-6 text-center">Henüz puanlı film yok.</p>
            ) : (
              <div className="space-y-1.5">
                {realTop10.map((m, idx) => {
                  const honest = m.calibratedScore ?? m.rating ?? 0;
                  const anomaly = anomalyById.get(m.id);
                  return (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <span className={`${PREMIUM_NUM} text-[11px] text-ink-500 w-5 text-right flex-shrink-0`}>
                        {idx + 1}
                      </span>
                      <span
                        className="text-xs font-bold text-ink-100 truncate flex-1 min-w-0"
                        title={m.title}
                      >
                        {m.title}
                      </span>
                      {anomaly && (
                        <span
                          title={
                            anomaly.direction === 'raise'
                              ? 'Puanı kalibre puanın altında'
                              : 'Puanı kalibre puanın üzerinde'
                          }
                          className="text-[10px] font-black flex-shrink-0 text-ink-400 tabular-nums"
                        >
                          {anomaly.direction === 'raise' ? '↑' : '↓'} {Math.abs(anomaly.gap).toFixed(2)}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-ink-500 tabular-nums flex-shrink-0 hidden sm:block">
                        {m.duelCount || 0} düello
                      </span>
                      <span
                        className={`${PREMIUM_NUM} text-xs text-ink-300 flex-shrink-0 w-9 text-right`}
                        title="Kalibre puan"
                      >
                        {honest.toFixed(2)}
                      </span>
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 w-9 text-center ${ratingBgClass(m.rating ?? 0)}`}
                      >
                        {m.rating}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* (a2) EN ÇOK DÜELLO KAZANMA */}
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-ink-300 flex items-center gap-1.5">
                  <Swords size={13} className="text-gold-400" /> En Çok Düello Kazananlar
                </h3>
                <span className="text-[10px] font-bold bg-ink-950 border border-ink-800 text-ink-400 px-2 py-0.5 rounded-full shrink-0">
                  duelWins
                </span>
              </div>
              {duelWinners.length === 0 ? (
                <p className="text-xs text-ink-500 py-5 text-center">Henüz düello kazanmadın.</p>
              ) : (
                <div className="space-y-1.5">
                  {duelWinners.map((m, idx) => (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <span className={`${PREMIUM_NUM} text-[11px] text-ink-500 w-5 text-right flex-shrink-0`}>
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-ink-100 truncate flex-1 min-w-0" title={m.title}>
                        {m.title}
                      </span>
                      <span className="text-[11px] font-black text-gold-400 flex-shrink-0 tabular-nums">
                        {m.duelWins} 🏆
                      </span>
                      <span className="text-[10px] font-bold text-ink-500 tabular-nums flex-shrink-0 hidden sm:block">
                        {m.duelCount || 0} düello
                      </span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 w-9 text-center ${ratingBgClass(m.rating ?? 0)}`}>
                        {m.rating}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* (b) PUAN ENFLASYONU ANALİZİ */}
          <div className="bg-ink-950/50 border border-ink-800/70 rounded-2xl p-3.5 sm:p-4 flex flex-col gap-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-ink-300 flex items-center gap-1.5">
              <TrendingUp size={13} className="text-gold-400" /> Puan Enflasyonu Analizi
            </h3>

            {inflation === null ? (
              <p className="text-xs text-ink-500 py-6 text-center leading-relaxed">
                Henüz kalibre puan yok — düello yaptıkça analiz burada oluşur.
              </p>
            ) : (
              <>
                <div className="flex items-end justify-between gap-3 bg-ink-950/60 border border-ink-800/70 rounded-xl px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                      Ortalama |kalibre − puan|
                    </div>
                    <div className={`${PREMIUM_NUM} text-xl text-ink-50`}>{inflation.avgAbs.toFixed(2)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                      Sapmalı / Ölçülen
                    </div>
                    <div className={`${PREMIUM_NUM} text-xl text-ink-50`}>
                      {anomalies.length}
                      <span className="text-xs font-bold text-ink-400"> / {inflation.count}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-ink-400 mb-1.5 flex items-center gap-1">
                      <ArrowUp size={11} className="text-red-400" /> En Çok Şişirilen
                    </div>
                    {inflation.inflated.length === 0 ? (
                      <p className="text-[11px] text-ink-500">—</p>
                    ) : (
                      <div className="space-y-1">
                        {inflation.inflated.map((a) => (
                          <div key={a.movie.id} className="flex items-center justify-between gap-2 py-0.5">
                            <span
                              className="text-[11px] font-bold text-ink-200 truncate min-w-0"
                              title={a.movie.title}
                            >
                              {a.movie.title}
                            </span>
                            <span className="flex items-center gap-1.5 shrink-0 tabular-nums text-[10px]">
                              <span className="text-ink-500 font-bold">{a.rating.toFixed(1)}</span>
                              <span className="text-ink-600">→</span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-black ${ratingBgClass(a.suggestion)}`}
                              >
                                {a.suggestion.toFixed(1)}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-ink-400 mb-1.5 flex items-center gap-1">
                      <ArrowDown size={11} className="text-gold-400" /> En Çok Düşürülen
                    </div>
                    {inflation.deflated.length === 0 ? (
                      <p className="text-[11px] text-ink-500">—</p>
                    ) : (
                      <div className="space-y-1">
                        {inflation.deflated.map((a) => (
                          <div key={a.movie.id} className="flex items-center justify-between gap-2 py-0.5">
                            <span
                              className="text-[11px] font-bold text-ink-200 truncate min-w-0"
                              title={a.movie.title}
                            >
                              {a.movie.title}
                            </span>
                            <span className="flex items-center gap-1.5 shrink-0 tabular-nums text-[10px]">
                              <span className="text-ink-500 font-bold">{a.rating.toFixed(1)}</span>
                              <span className="text-ink-600">→</span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-black ${ratingBgClass(a.suggestion)}`}
                              >
                                {a.suggestion.toFixed(1)}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* YENİLENMİŞ TAM GENİŞLİKLİ PUAN DAĞILIMI & SPEKTRUM ANALİZİ */}
      <div className={`${PREMIUM_PANEL} relative overflow-hidden`}>
        <div className="absolute -left-16 -bottom-16 w-52 h-52 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100 flex items-center gap-2.5">
                <span className={`w-8 h-8 rounded-xl ${RED_TILE}`}>
                  <TrendingUp size={16} className="text-white" />
                </span>
                Puan Dağılımı &amp; Kalite Spektrumu
              </h2>
              <p className="text-xs text-ink-400 mt-0.5">
                Verdiğin puanların kademe dağılımı, en sık kullandığın notlar ve puan değişim geçmişin
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-ink-950/80 border border-ink-800 text-ink-300 px-3 py-1.5 rounded-xl">
                <History size={13} className="text-rose-400" /> {ratingChangeCount} puan değişimi
              </span>
              {ratingAnalytics.totalRated > 0 && (
                <span className="text-[11px] font-black bg-ink-950 border border-ink-800 text-gold-400 px-3 py-1.5 rounded-xl">
                  Toplam {ratingAnalytics.totalRated} Puanlama
                </span>
              )}
            </div>
          </div>

          {ratingAnalytics.totalRated === 0 ? (
            <div className="text-center py-8 bg-ink-950/40 rounded-xl border border-ink-800/60">
              <p className="text-sm text-ink-500">Henüz puan verilmemiş.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 4'lü Özet Metrik Kartları */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className={`${PREMIUM_CELL} p-3`}>
                  <div className="text-[10px] font-black uppercase tracking-wider text-ink-500">Genel Ortalama</div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className={`${PREMIUM_NUM} text-xl sm:text-2xl text-white`}>{stats.avgTotal.toFixed(2)}</span>
                    <span className="text-[10px] font-bold text-gold-400">/ 10</span>
                  </div>
                  <div className={`text-[10px] font-bold mt-0.5 truncate ${stats.ratingPersona.color}`}>
                    {stats.ratingPersona.label}
                  </div>
                </div>

                <div className={`${PREMIUM_CELL} p-3`}>
                  <div className="text-[10px] font-black uppercase tracking-wider text-ink-500">Favori Notun (Mod)</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-lg text-sm sm:text-base font-black ${ratingBgClass(ratingAnalytics.modeRating)}`}>
                      {ratingAnalytics.modeRating}
                    </span>
                    <span className={`${PREMIUM_NUM} text-xs text-ink-300`}>{ratingAnalytics.modeCount} kez</span>
                  </div>
                  <div className="text-[10px] text-ink-500 mt-1">En sık verdiğin puan</div>
                </div>

                <div className={`${PREMIUM_CELL} p-3`}>
                  <div className="text-[10px] font-black uppercase tracking-wider text-ink-500">Başyapıt Oranı</div>
                  <div className={`${PREMIUM_NUM} text-xl sm:text-2xl text-amber-300 mt-1`}>
                    %{ratingAnalytics.masterpieceRate}
                  </div>
                  <div className="text-[10px] text-ink-500 mt-0.5">9.0 ve üzeri puanlananlar</div>
                </div>

                <div className={`${PREMIUM_CELL} p-3`}>
                  <div className="text-[10px] font-black uppercase tracking-wider text-ink-500">Kanaat Sapması</div>
                  <div className={`${PREMIUM_NUM} text-xl sm:text-2xl text-rose-300 mt-1`}>
                    ±{ratingAnalytics.stdDev.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-ink-500 mt-0.5">
                    {ratingAnalytics.stdDev < 1.2 ? 'Belirli bir bantta sabit' : 'Geniş skalada değişken'}
                  </div>
                </div>
              </div>

              {/* 4 Kademeli Kalite Segmentasyonu + Yığılmış Spektrum Barı */}
              <div className="bg-ink-950/55 border border-ink-800/70 rounded-2xl p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-ink-300">
                  <span>Kalite Kademeleri Dağılımı</span>
                  <span className="text-[10px] text-ink-500">10 üzerinden puan dilimleri</span>
                </div>

                <div className="h-3 w-full bg-ink-900 rounded-full overflow-hidden flex border border-ink-800 p-0.5 gap-0.5">
                  {ratingAnalytics.tiers.map((t) =>
                    t.count > 0 ? (
                      <div
                        key={t.id}
                        title={`${t.label} (${t.range}): ${t.count} yapım (%${t.pct})`}
                        className={`h-full bg-gradient-to-r ${t.bar} first:rounded-l-full last:rounded-r-full transition-all duration-700`}
                        style={{ width: `${Math.max(4, t.pct)}%` }}
                      />
                    ) : null
                  )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {ratingAnalytics.tiers.map((t) => (
                    <div
                      key={t.id}
                      className={`bg-ink-900/60 border ${t.border} rounded-xl p-2.5 flex items-center justify-between gap-2`}
                    >
                      <div className="min-w-0">
                        <div className={`text-xs font-black truncate ${t.color}`}>{t.label}</div>
                        <div className="text-[10px] text-ink-500 font-semibold">{t.range} Puan</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`${PREMIUM_NUM} text-sm text-white`}>{t.count}</div>
                        <div className={`${PREMIUM_NUM} text-[10px] text-ink-400`}>%{t.pct}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2 Sütunlu Detaylı Puan Çubukları */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 bg-ink-950/40 border border-ink-800/60 rounded-2xl p-3.5 sm:p-4 max-h-72 overflow-y-auto custom-scrollbar">
                {ratingAnalytics.sortedDesc.map(([rating, count]) => {
                  const widthPct = Math.max(6, (count / ratingAnalytics.maxCount) * 100);
                  const sharePct = Math.round((count / ratingAnalytics.totalRated) * 100);
                  const isMode = Number(rating) === ratingAnalytics.modeRating;
                  return (
                    <div
                      key={rating}
                      className={`flex items-center gap-2.5 py-1 px-1.5 rounded-lg transition-colors ${
                        isMode ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md font-black flex-shrink-0 w-11 text-center shadow-sm ${ratingBgClass(
                          Number(rating)
                        )}`}
                      >
                        {rating}
                      </span>
                      <div className="flex-1 h-4 bg-ink-900 rounded-md overflow-hidden border border-ink-800/80">
                        <div
                          className={`h-full rounded-md transition-all duration-700 ${
                            Number(rating) >= 9
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_10px_rgba(251,191,36,0.45)]'
                              : Number(rating) >= 7
                              ? 'bg-gradient-to-r from-red-600 to-rose-400 shadow-[0_0_10px_rgba(232,56,79,0.4)]'
                              : 'bg-gradient-to-r from-ink-600 to-ink-400'
                          }`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <div className="w-16 text-right flex items-baseline justify-end gap-1 flex-shrink-0">
                        <span className={`${PREMIUM_NUM} text-xs text-ink-100`}>{count}</span>
                        <span className={`${PREMIUM_NUM} text-[10px] text-ink-500`}>(%{sharePct})</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Son Puan Değişikliği Bandı */}
              {lastRatingChange && (
                <div className="bg-ink-950/60 border border-ink-800/70 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                  <span className="text-ink-400 truncate flex items-center gap-1.5">
                    <History size={13} className="text-rose-400 shrink-0" />
                    <span>Son puan değişikliği:</span>
                    <strong className="font-bold text-ink-100 truncate">{lastRatingChange.title}</strong>
                  </span>
                  <span className="flex items-center gap-1.5 font-black tabular-nums flex-shrink-0">
                    <s className="text-ink-500 text-[11px]">{lastRatingChange.previousRating}</s>
                    <span className="text-ink-500 text-[10px]">→</span>
                    <span className={`px-1.5 py-0.5 rounded ${ratingBgClass(lastRatingChange.rating ?? 0)}`}>
                      {lastRatingChange.rating}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {stats.collectionStats.length > 0 && (
        <div className={PREMIUM_PANEL}>
          <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-ink-100 mb-3.5 flex items-center gap-2"><Layers size={18} className="text-gold-400" /> Koleksiyon İlerlemesi</h2>
          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
            {stats.collectionStats.map((c) => (
              <div key={c.name} className="bg-ink-800/40 border border-ink-700/30 p-3.5 rounded-xl transition-colors duration-300">
                <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                  <span className="text-ink-200 font-bold truncate pr-2">{c.name}</span>
                  <span className="text-ink-400 font-semibold flex-shrink-0">{c.watched} / {c.total} (%{Math.round(c.progress)})</span>
                </div>
                <div className="h-2 bg-ink-950 rounded-full overflow-hidden shadow-inner border border-ink-800">
                  <div className="h-full bg-gradient-to-r from-red-600 to-rose-400 rounded-full shadow-[0_0_12px_rgba(232,56,79,0.55)] transition-all duration-700 relative" style={{ width: `${c.progress}%` }}>
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
      {showCalibration && <CalibrationDuelModal onClose={() => setShowCalibration(false)} />}
    </div>
  );
}