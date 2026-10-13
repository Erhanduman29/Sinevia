import { useState, useMemo } from 'react';
import {
  BarChart3, Film, Tv, Star, TrendingUp, Calendar, Award, Clock, Flame, Layers,
  Hourglass, Activity, User, Users, Building2, Crown, Sparkles,
  Compass, Sun, Sunset, Moon, Coffee, Globe, Trophy, StickyNote, Zap, Tag, Gauge, FastForward, History, Hexagon
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass } from '../lib/utils';
import MediaDetailModal from '../components/MediaDetailModal';
import WrappedModal from '../components/WrappedModal';
import type { DetailModalTarget } from '../components/MediaDetailModal';
import type { WatchHistoryItem } from '../types';

// YENİ: ZEKİ MOTORUMUZU ÇAĞIRIYORUZ
import { calculateStats, StatsScopeMode } from '../lib/statsLogic';

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
const PREMIUM_NUM = 'font-mono font-black tracking-tight tabular-nums';
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

/* ------------- İZLEME HARİTASI (Yıllık / Aylık / Haftalık / Günlük) ------------- */
type MapMode = 'year' | 'month' | 'week' | 'day';

const MAP_MODES: { id: MapMode; label: string }[] = [
  { id: 'year', label: 'Yıllık' },
  { id: 'month', label: 'Aylık' },
  { id: 'week', label: 'Haftalık' },
  { id: 'day', label: 'Günlük' },
];

const MAP_MODE_META: Record<MapMode, { badge: string; desc: string }> = {
  year: { badge: 'Son 365 Gün', desc: 'Son 12 ayın ısı haritası — her kutucuk bir gün. Parlaklık o günkü izleme yoğunluğunu gösterir.' },
  month: { badge: 'Son 12 Ay', desc: 'Aylara göre döküm: hangi ay ne kadar dolu, tek bakışta gör.' },
  week: { badge: 'Son 12 Hafta', desc: 'Haftalık ritmin: hangi hafta daha yoğun geçti, hangisi boş kaldı?' },
  day: { badge: 'Son 14 Gün', desc: 'Günlük tempon — bugün dahil son iki haftanın izleme ritmi.' },
};

const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const TR_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function heatClass(count: number) {
  if (count === 0) return 'bg-white/[0.045] border-white/[0.06]';
  if (count === 1) return 'bg-red-500/30 border-red-500/50';
  if (count <= 3) return 'bg-red-500/60 border-red-500/70';
  if (count <= 5)
    return 'bg-gradient-to-br from-rose-400 to-red-500 border-rose-300/70 shadow-[0_0_8px_rgba(232,56,79,0.55)]';
  return 'bg-gradient-to-br from-rose-300 to-red-500 border-rose-200 shadow-[0_0_12px_rgba(255,107,122,0.75)]';
}

interface BarItem {
  label: string;
  sub?: string;
  count: number;
  title: string;
}

function WatchBars({ items, accent }: { items: BarItem[]; accent: string }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="flex items-end gap-1.5 sm:gap-2.5 h-40 sm:h-48">
      {items.map((it, i) => (
        <div key={i} className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full group">
          <span
            className={`${PREMIUM_NUM} text-[10px] leading-none transition-colors ${
              it.count > 0 ? 'text-white' : 'text-ink-600'
            }`}
          >
            {it.count > 0 ? it.count : ''}
          </span>
          <div className="w-full flex-1 flex items-end">
            <div
              title={it.title}
              className={`w-full rounded-t-md transition-all duration-500 group-hover:brightness-125 group-hover:-translate-y-0.5 ${
                it.count > 0 ? accent : 'bg-ink-800/70 border-t border-ink-700'
              }`}
              style={{ height: `${it.count === 0 ? 3 : Math.max(10, (it.count / max) * 100)}%` }}
            />
          </div>
          <span className="text-[9px] sm:text-[10px] font-bold text-ink-400 truncate w-full text-center leading-none">
            {it.label}
          </span>
          {it.sub && (
            <span className="text-[8px] font-bold text-ink-600 -mt-0.5 w-full text-center leading-none">{it.sub}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function WatchMap({ history }: { history: WatchHistoryItem[] }) {
  const [mode, setMode] = useState<MapMode>('year');

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
  const keyCount = (d: Date) => watchMap.get(dayKey(d)) || 0;

  const meta = MAP_MODE_META[mode];

  /* ---------- YILLIK: 365 günlük ızgara ---------- */
  const buildYearWeeks = () => {
    const start = new Date(today);
    start.setDate(today.getDate() - 364);
    const days: Date[] = [];
    for (let i = 0; i < 365; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    const weeks: (Date | null)[][] = [];
    let week: (Date | null)[] = [];
    for (let i = 0; i < days[0].getDay(); i++) week.push(null);
    days.forEach((d) => {
      week.push(d);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    });
    if (week.length) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return weeks;
  };
  const yearWeeks = mode === 'year' ? buildYearWeeks() : [];

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
        sub: String(d.getFullYear()).slice(2),
        count: c,
        title: `${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}: ${c} yapım`,
      });
    }
  }

  /* ---------- HAFTALIK: son 12 hafta (Pazartesi başlangıç) ---------- */
  const weekBars: BarItem[] = [];
  if (mode === 'week') {
    for (let i = 11; i >= 0; i--) {
      const anchor = new Date(today);
      anchor.setDate(today.getDate() - i * 7);
      const dow = (anchor.getDay() + 6) % 7; // 0 = Pazartesi
      const startW = new Date(anchor);
      startW.setDate(anchor.getDate() - dow);
      let c = 0;
      for (let j = 0; j < 7; j++) {
        const d = new Date(startW);
        d.setDate(startW.getDate() + j);
        c += keyCount(d);
      }
      weekBars.push({
        label: `${startW.getDate()} ${TR_MONTHS[startW.getMonth()]}`,
        count: c,
        title: `${startW.getDate()} ${TR_MONTHS[startW.getMonth()]} haftası: ${c} yapım`,
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
        label: TR_DAYS[d.getDay()],
        sub: String(d.getDate()).padStart(2, '0'),
        count: c,
        title: `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}: ${c} yapım`,
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

  let summary = { total: 0, active: 0, max: 0, peak: '—' };
  if (mode === 'year') {
    const counts: number[] = [];
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      counts.push(keyCount(d));
    }
    summary = { ...statsOf(counts), peak: `Tek günde en çok ${statsOf(counts).max}` };
  } else if (mode === 'month') {
    const s = statsOf(monthBars.map((b) => b.count));
    const peakBar = monthBars.reduce((a, b) => (b.count > a.count ? b : a), monthBars[0]);
    summary = { ...s, peak: `En dolu ay: ${peakBar.label}` };
  } else if (mode === 'week') {
    const s = statsOf(weekBars.map((b) => b.count));
    const peakBar = weekBars.reduce((a, b) => (b.count > a.count ? b : a), weekBars[0]);
    summary = { ...s, peak: `En yoğun hafta: ${peakBar.label}` };
  } else {
    const s = statsOf(dayBars.map((b) => b.count));
    const peakBar = dayBars.reduce((a, b) => (b.count > a.count ? b : a), dayBars[0]);
    summary = { ...s, peak: `En yoğun gün: ${peakBar.label}` };
  }

  const hasData = watchMap.size > 0;

  return (
    <div>
      {/* Başlık + görünüm seçici */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <h2 className="text-sm sm:text-lg font-black tracking-tight text-ink-100 flex items-center gap-2.5">
          <span className={`w-8 h-8 rounded-xl ${RED_TILE}`}>
            <Calendar size={16} className="text-white" />
          </span>
          İzleme Haritası
        </h2>
        <div className="flex items-center gap-1 self-start sm:self-auto bg-ink-950/70 border border-ink-800 rounded-xl p-1">
          {MAP_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`px-2.5 sm:px-3.5 py-1.5 min-h-11 sm:min-h-0 rounded-lg text-[10px] sm:text-xs font-black transition-all ${
                mode === m.id ? RED_PILL_ACTIVE : 'text-ink-400 hover:text-ink-100 hover:bg-white/[0.06]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <p className="text-[11px] sm:text-xs text-ink-400 max-w-xl leading-relaxed">{meta.desc}</p>
        <span className="text-[10px] font-mono font-black uppercase tracking-widest text-rose-300 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-lg">
          {meta.badge}
        </span>
      </div>

      {!hasData ? (
        <p className="text-xs text-ink-500 py-8 text-center">Bu kapsamda henüz izleme verin bulunmuyor.</p>
      ) : (
        <>
          {/* Özet şeritleri */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className={`${PREMIUM_CELL} px-3 py-2`}>
              <div className="text-[9px] font-black uppercase tracking-widest text-ink-500">Bu Dönem</div>
              <div className={`${PREMIUM_NUM} text-base sm:text-lg text-white leading-tight`}>
                {summary.total} <span className="text-[10px] font-bold text-ink-400">yapım</span>
              </div>
            </div>
            <div className={`${PREMIUM_CELL} px-3 py-2`}>
              <div className="text-[9px] font-black uppercase tracking-widest text-ink-500">Aktif Gün</div>
              <div className={`${PREMIUM_NUM} text-base sm:text-lg text-rose-300 leading-tight`}>
                {summary.active} <span className="text-[10px] font-bold text-ink-400">/ {mode === 'year' ? 365 : mode === 'day' ? 14 : mode === 'week' ? 84 : 365}</span>
              </div>
            </div>
            <div className={`${PREMIUM_CELL} px-3 py-2`}>
              <div className="text-[9px] font-black uppercase tracking-widest text-ink-500">Zirve</div>
              <div className="text-[11px] sm:text-xs font-mono font-black text-gold-300 leading-tight mt-1 truncate">{summary.peak}</div>
            </div>
          </div>

          {mode === 'year' && (
            <div className="overflow-x-auto custom-scrollbar pb-2 pt-1">
              {/* Ay etiketleri */}
              <div className="flex gap-1 mb-1.5 pl-6 sm:pl-7">
                {yearWeeks.map((week, i) => {
                  const firstDay = week.find(Boolean) as Date | undefined;
                  const show = week.some((d) => d && d.getDate() === 1);
                  return (
                    <div key={i} className="w-3 sm:w-3.5 text-[8px] font-bold text-ink-500 leading-none whitespace-nowrap">
                      {show && firstDay ? TR_MONTHS[firstDay.getMonth()] : ''}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1.5">
                {/* Hafta günleri etiketleri */}
                <div className="flex flex-col gap-1 pr-1">
                  {['Pzt', 'Çar', 'Cum'].map((d) => (
                    <div key={d} className="h-3 sm:h-3.5 flex items-center text-[8px] font-bold text-ink-600 leading-none">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  {yearWeeks.map((week, wIndex) => (
                    <div key={wIndex} className="flex flex-col gap-1">
                      {week.map((date, dIndex) => {
                        if (!date) return <div key={`empty-${dIndex}`} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />;
                        const count = keyCount(date);
                        return (
                          <div
                            key={dayKey(date)}
                            title={`${date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}: ${count} yapım`}
                            className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[4px] border transition-all duration-150 cursor-help hover:scale-150 hover:ring-1 hover:ring-white/70 ${heatClass(count)}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-3 text-[9px] sm:text-[10px] text-ink-500 font-medium">
                <span>Az</span>
                <div className="w-2.5 h-2.5 rounded-[3px] bg-white/[0.045] border border-white/[0.06]" />
                <div className="w-2.5 h-2.5 rounded-[3px] bg-red-500/30 border border-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-[3px] bg-red-500/60 border border-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-[3px] bg-gradient-to-br from-rose-400 to-red-500 border border-rose-300/70" />
                <div className="w-2.5 h-2.5 rounded-[3px] bg-gradient-to-br from-rose-300 to-red-500 border border-rose-200" />
                <span>Çok</span>
              </div>
            </div>
          )}

          {mode === 'month' && (
            <WatchBars
              items={monthBars}
              accent="bg-gradient-to-t from-red-700 to-red-500 shadow-[0_0_14px_rgba(232,56,79,0.4)]"
            />
          )}
          {mode === 'week' && (
            <WatchBars
              items={weekBars}
              accent="bg-gradient-to-t from-red-600 to-rose-500 shadow-[0_0_14px_rgba(255,107,122,0.4)]"
            />
          )}
          {mode === 'day' && (
            <WatchBars
              items={dayBars}
              accent="bg-gradient-to-t from-rose-500 to-red-400 shadow-[0_0_14px_rgba(232,56,79,0.35)]"
            />
          )}
        </>
      )}
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
    'from-red-500 to-rose-400', 'from-rose-500 to-red-400', 'from-red-600 to-red-400', 'from-rose-600 to-rose-400',
    'from-red-500 to-orange-400', 'from-rose-500 to-pink-400', 'from-red-700 to-red-500', 'from-rose-400 to-red-300',
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
      <style>{STATS_PREMIUM_CSS}</style>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-ink-100 flex items-center gap-2.5">
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
              <span className={`${stats.ratingPersona.color} font-mono font-black`}>{stats.ratingPersona.label}</span>
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
              <h2 className="text-sm sm:text-lg font-black tracking-tight text-ink-100 flex items-center gap-2">
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
              <div className="text-xs sm:text-sm font-mono font-black text-white mt-1.5 truncate">
                {stats.fastestMovieRecord ? stats.fastestMovieRecord.title : 'Henüz Yok'}
              </div>
              <div className="text-[10px] font-mono text-ink-400 mt-1 truncate">
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
          <div className="text-[11px] text-ink-400 mt-1">Ort: <strong className="font-mono text-gold-400">{stats.avgMovie.toFixed(1)}</strong></div>
        </div>

        <div className={`${PREMIUM_PANEL} ${PREMIUM_GLOW} !p-3.5 sm:!p-4 flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-ink-400 uppercase tracking-wider">İzlenen Bölüm</span>
            <Tv size={16} className="text-rose-400" />
          </div>
          <div className={`${PREMIUM_NUM} text-2xl sm:text-3xl text-ink-50 mt-1.5`}>{stats.seriesCount}</div>
          <div className="text-[11px] text-ink-400 mt-1">Ort: <strong className="font-mono text-rose-400">{stats.avgSeries.toFixed(1)}</strong> ({stats.uniqueSeriesCount} Dizi)</div>
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
          <div className={`${PREMIUM_NUM} text-2xl sm:text-3xl text-ink-50 mt-1.5`}>{data.achievements.reduce((s, a) => s + a.unlockedTiers.length, 0)}</div>
          <div className="text-[11px] text-ink-400 mt-1"><strong className="font-mono text-gold-400">{(data.totalXp || 0).toLocaleString()} XP</strong></div>
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
              <span className="text-[11px] font-mono font-black bg-ink-950 border border-ink-800 text-gold-400 px-2 py-1 rounded-lg flex-shrink-0">~{stats.remainingMoviesHours} Saat</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-ink-400">
                <span>Tamamlanma Oranı</span>
                <span className="font-mono text-gold-400">%{stats.movieCompletionPct}</span>
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
              <span className="text-[11px] font-mono font-black bg-ink-950 border border-ink-800 text-rose-400 px-2 py-1 rounded-lg flex-shrink-0">~{stats.remainingEpisodesHours} Saat</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-ink-400">
                <span>Tamamlanma Oranı</span>
                <span className="font-mono text-rose-400">%{stats.seriesCompletionPct}</span>
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
              <h2 className="text-sm sm:text-lg font-black tracking-tight text-ink-100 flex items-center gap-2"><Clock size={18} className="text-gold-400" /> İzleme Biyoritmi (Günün Saatleri)</h2>
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
                      <div className="text-[10px] font-mono text-ink-500">{slot.hours}</div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 w-full bg-ink-900 rounded-full overflow-hidden">
                        <div className={`h-full ${slot.bar} rounded-full shadow-[0_0_10px_rgba(232,56,79,0.45)]`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] font-mono font-semibold text-ink-400 text-right">{slot.count} İzleme</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`${PREMIUM_PANEL} lg:col-span-5 flex flex-col justify-between`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm sm:text-base font-black tracking-tight text-ink-100 flex items-center gap-2"><Activity size={18} className="text-rose-400" /> Son 14 Günlük Tempo</h2>
                <p className="text-xs text-ink-400 mt-0.5">Son 2 haftadaki günlük aktivite nabzın</p>
              </div>
              <span className="text-xs font-mono font-bold bg-ink-950 border border-ink-800 text-rose-400 px-2.5 py-1 rounded-lg">Bu Ay: {stats.thisMonthCount}</span>
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
            <div className="flex justify-between text-[10px] font-mono font-semibold text-ink-500 border-t stats-hr border-ink-800/60 pt-2 mt-2">
              <span>{stats.last14Days[0]?.label}</span>
              <span>Bugün ({stats.last14Days[stats.last14Days.length - 1]?.count || 0} izleme)</span>
            </div>
          </div>
        </div>
      )}

      <div className={PREMIUM_PANEL}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3.5">
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-ink-100 flex items-center gap-2"><Tag size={18} className="text-gold-400" /> Değerlendirme Başlıkları</h2>
            <p className="text-xs text-ink-400 mt-0.5">Puanlama sırasında seçtiğin başlıkların sıklığı ve ortalamaları</p>
          </div>
          {stats.totalTaggedItems > 0 && (
            <span className="text-[11px] font-mono font-bold bg-gold-500/15 text-gold-300 border border-gold-500/30 px-2.5 py-1 rounded-full">{stats.totalTaggedItems} Yapım</span>
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
                    {item.avg > 0 && <span className={`text-xs font-mono px-2 py-0.5 rounded-md font-black flex-shrink-0 ${ratingBgClass(item.avg)}`}>Ort: {item.avg.toFixed(1)}</span>}
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-ink-900 rounded-full overflow-hidden border border-ink-800">
                      <div className="h-full bg-gradient-to-r from-red-600 to-rose-400 rounded-full shadow-[0_0_10px_rgba(232,56,79,0.5)] transition-all duration-700" style={{ width: `${widthPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-ink-400">
                      <span>Kullanım</span>
                      <span className="font-mono text-gold-400">{item.count} Kez</span>
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
            <h2 className="text-base sm:text-lg font-black tracking-tight text-ink-100 flex items-center gap-2"><Trophy size={18} className="text-gold-400" /> Sinevia Rekorlar Kitabı</h2>
            <p className="text-xs text-ink-400 mt-0.5">Kütüphanendeki en dikkat çekici kişisel rekorların</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className={`${PREMIUM_CELL} p-3`}>
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-gold-400 uppercase"><Flame size={12} /> Yoğun Gün</div>
              <div className={`${PREMIUM_NUM} text-sm sm:text-lg text-ink-50 mt-1`}>{stats.busiestDay.count > 0 ? `${stats.busiestDay.count} Yapım` : 'Yok'}</div>
              <div className="text-[10px] font-mono text-ink-400 mt-0.5 truncate">{stats.busiestDay.date}</div>
            </div>
            <div className={`${PREMIUM_CELL} p-3`}>
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-rose-400 uppercase"><Zap size={12} /> Seri Rekoru</div>
              <div className={`${PREMIUM_NUM} text-sm sm:text-lg text-ink-50 mt-1`}>{stats.maxStreakEver} Gün</div>
              <div className="text-[10px] font-mono text-ink-400 mt-0.5">Aktif: {data.dailyStreak} gün</div>
            </div>
            <div className={`${PREMIUM_CELL} p-3`}>
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-gold-400 uppercase"><Clock size={12} /> En Uzun Film</div>
              <div className="text-xs sm:text-sm font-mono font-black text-ink-50 mt-1 truncate">{stats.longestMovie ? stats.longestMovie.title : 'Yok'}</div>
              <div className="text-[10px] font-mono text-ink-400 mt-0.5">{stats.longestMovie ? `${stats.longestMovie.runtime} Dk` : '-'}</div>
            </div>
            <div className={`${PREMIUM_CELL} p-3`}>
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-rose-400 uppercase"><Tv size={12} /> Favori Dizi</div>
              <div className="text-xs sm:text-sm font-mono font-black text-ink-50 mt-1 truncate">{stats.mostWatchedSeries ? stats.mostWatchedSeries.title : 'Yok'}</div>
              <div className="text-[10px] font-mono text-ink-400 mt-0.5">{stats.mostWatchedSeries ? `${stats.mostWatchedSeries.count} Bölüm` : '-'}</div>
            </div>
          </div>
          <div className="bg-ink-950/50 border border-ink-800/60 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2"><StickyNote size={15} className="text-rose-400" /><span className="text-xs font-bold text-ink-200">Eleştirmen Notların</span></div>
            <span className="text-xs font-mono font-black text-rose-400">{stats.notesCount} Not ({stats.totalNoteWords} Kelime)</span>
          </div>
        </div>

        <div className={PREMIUM_PANEL}>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-ink-100 flex items-center gap-2"><Globe size={18} className="text-rose-400" /> Dünya Sineması Pasaportu</h2>
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
                        <div className="text-[10px] font-mono text-ink-400 font-semibold">{lang.count} Yapım</div>
                      </div>
                    </div>
                    {lang.avg > 0 && <span className={`text-xs font-mono px-2 py-0.5 rounded-md font-black flex-shrink-0 ${ratingBgClass(lang.avg)}`}>{lang.avg.toFixed(1)}</span>}
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
            <h2 className="text-base sm:text-lg font-black tracking-tight text-ink-100 flex items-center gap-2"><Crown size={18} className="text-gold-400" /> Yıldızlar Geçidi</h2>
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
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-mono font-black text-xs flex-shrink-0 ${idx === 0 ? 'bg-gradient-to-br from-red-500 to-red-700 text-white shadow-[0_6px_16px_-6px_rgba(232,56,79,0.85)]' : idx === 1 ? 'bg-slate-300 text-slate-900' : idx === 2 ? 'bg-red-900 text-white border border-red-700' : 'bg-ink-800 text-ink-300 border border-ink-700'}`}>#{idx + 1}</div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-ink-100 truncate">{item.name}</div>
                      <div className="text-[10px] sm:text-[11px] font-mono text-ink-400 font-medium">{item.count} Yapım</div>
                    </div>
                  </div>
                  {item.avg > 0 && <span className={`text-xs font-mono px-2 py-0.5 rounded-lg font-black flex-shrink-0 ${ratingBgClass(item.avg)}`}>{item.avg.toFixed(1)}</span>}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {stats.topRated.length > 0 && (
        <div className={PREMIUM_PANEL}>
          <div className="mb-3.5">
            <h2 className="text-base sm:text-lg font-black tracking-tight text-ink-100 flex items-center gap-2"><Star size={18} className="text-gold-400 fill-current" /> Şeref Kürsüsü</h2>
            <p className="text-xs text-ink-400 mt-0.5">En yüksek puan verdiğin yapımlar</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3.5">
            {stats.topRated.map((h, i) => {
              const isMovie = h.kind === 'movie' || h.type === 'movie';
              const poster = isMovie ? data.movies.find((m) => m.id === (h.itemId || h.id))?.posterUrl : data.series.find((s) => s.id === (h.seriesId || h.itemId || h.id))?.posterUrl;
              return (
                <button key={h.id} type="button" onClick={() => openHistoryItemDetail(h)} className="group relative flex flex-col text-left bg-ink-950/70 border border-ink-800 hover:border-red-500/50 hover:shadow-[0_0_0_1px_rgba(232,56,79,0.35),0_16px_38px_-16px_rgba(232,56,79,0.6)] rounded-xl sm:rounded-2xl overflow-hidden shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
                  <div className="aspect-[2/3] w-full bg-ink-900 relative overflow-hidden">
                    {poster ? <img src={poster} alt={h.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center text-ink-600">{isMovie ? <Film size={24} /> : <Tv size={24} />}</div>}
                    <div className="absolute top-1.5 left-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-gradient-to-br from-red-500 to-red-700 backdrop-blur-md border border-rose-300/30 flex items-center justify-center text-[10px] font-mono font-black text-white">#{i + 1}</div>
                    {h.rating !== null && <div className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-lg text-[10px] sm:text-xs font-mono font-black shadow-md ${ratingBgClass(h.rating)}`}>{h.rating}</div>}
                  </div>
                  <div className="p-2">
                    <div className="text-[11px] sm:text-xs font-bold text-ink-100 truncate group-hover:text-rose-300 transition-colors">{h.title}</div>
                    <div className="text-[9px] sm:text-[10px] font-mono text-ink-400 mt-0.5 truncate">{h.season != null ? `S${h.season} B${h.episode}` : h.year || 'Film'}</div>
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
            <h2 className="text-base sm:text-lg font-black tracking-tight text-ink-100 flex items-center gap-2 mb-1">
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
                        <span className={`px-2 py-0.5 rounded font-mono font-black text-[11px] ${ratingBgClass(crit.avg)}`}>{crit.avg.toFixed(1)}</span>
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
            <h2 className="text-base sm:text-lg font-black tracking-tight text-ink-100 mb-1 flex items-center gap-2"><Compass size={18} className="text-gold-400" /> Dönemlere Göre Tercihlerin</h2>
            <p className="text-xs text-ink-400 mb-4">İzlediğin filmlerin çıkış yaptıkları on yıllara göre dağılımı</p>
            {stats.decades.length === 0 ? (
              <p className="text-xs text-ink-500 py-6 text-center">Henüz yeterli yıl verisi yok.</p>
            ) : (
              <div className="space-y-2.5">
                {stats.decades.map((d) => {
                  const pct = Math.max(10, (d.count / stats.maxDecadeCount) * 100);
                  return (
                    <div key={d.decade} className="flex items-center gap-2.5">
                      <div className="w-14 text-xs font-mono font-black text-ink-200 flex-shrink-0">{d.decade}</div>
                      <div className="flex-1 h-6 bg-ink-950 rounded-lg overflow-hidden border border-ink-800/80">
                        <div className="h-full bg-gradient-to-r from-red-700 to-rose-400 rounded-lg flex items-center justify-end pr-2 text-[11px] font-mono font-black text-white shadow-[0_0_12px_rgba(232,56,79,0.45)] transition-all duration-700" style={{ width: `${pct}%` }}>{d.count}</div>
                      </div>
                      {d.avg > 0 && <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold w-10 text-center flex-shrink-0 ${ratingBgClass(d.avg)}`}>{d.avg.toFixed(1)}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={PREMIUM_PANEL}>
        <h2 className="text-base sm:text-lg font-black tracking-tight text-ink-100 mb-3.5 flex items-center gap-2"><Layers size={18} className="text-rose-400" /> En Sevdiğin Türler</h2>
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
                      <span className="text-[11px] sm:text-xs font-mono font-bold text-white drop-shadow">{val.count}</span>
                    </div>
                  </div>
                  {avg > 0 && <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold flex-shrink-0 w-10 text-center ${ratingBgClass(avg)}`}>{avg.toFixed(1)}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className={`${PREMIUM_PANEL} flex flex-col justify-between`}>
          <h2 className="text-sm sm:text-base font-black tracking-tight text-ink-100 mb-4 flex items-center gap-2"><Calendar size={16} className="text-gold-400" /> Aylık İzleme</h2>
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
                      <div className={`${PREMIUM_NUM} text-xs text-ink-300`}>{val.total}</div>
                      <div className="w-full max-w-[2rem] flex flex-col-reverse rounded-t-lg overflow-hidden transition-all duration-700 group-hover:brightness-110 group-hover:shadow-[0_0_14px_rgba(232,56,79,0.5)]" style={{ height: `${Math.max(heightPct, 6)}%` }}>
                        <div className="bg-gradient-to-t from-red-700 to-red-500 transition-all duration-700" style={{ height: `${moviePct}%` }} />
                        <div className="bg-gradient-to-t from-rose-600 to-rose-400 transition-all duration-700" style={{ height: `${100 - moviePct}%` }} />
                      </div>
                      <div className="text-[11px] font-mono text-ink-500 font-medium">{monthName}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-5 text-xs text-ink-400 border-t border-ink-800/50 pt-2.5">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-500" /> Film</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-400" /> Dizi</span>
              </div>
            </>
          )}
        </div>

        <div className={`${PREMIUM_PANEL} flex flex-col justify-between`}>
          <h2 className="text-sm sm:text-base font-black tracking-tight text-ink-100 mb-4 flex items-center gap-2"><Calendar size={16} className="text-rose-400" /> Haftalık Yoğunluk</h2>
          {data.history.length === 0 ? (
            <p className="text-sm text-ink-500">Henüz veri yok.</p>
          ) : (
            <div className="flex flex-1 items-end justify-between gap-2 h-40 pt-4">
              {stats.dayOfWeekMap.map((count, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 flex-1 group h-full justify-end">
                  <div className={`${PREMIUM_NUM} text-xs text-ink-300`}>{count}</div>
                  <div className="w-full max-w-[2rem] bg-gradient-to-t from-red-800 to-rose-400 rounded-t-md transition-all duration-700 group-hover:brightness-110 group-hover:shadow-[0_0_12px_rgba(232,56,79,0.5)]" style={{ height: `${(count / stats.maxDayOfWeek) * 80}%`, minHeight: count > 0 ? '6px' : '2px' }} />
                  <div className="text-[11px] font-mono text-ink-500 font-medium">{dayNames[i]}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={PREMIUM_PANEL}>
          <h2 className="text-sm sm:text-base font-black tracking-tight text-ink-100 mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-gold-400" /> Puan Dağılımı</h2>
          {stats.ratings.length === 0 ? (
            <p className="text-sm text-ink-500">Henüz puan verilmemiş.</p>
          ) : (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
              {stats.ratings.map(([rating, count]) => {
                const maxCount = Math.max(...stats.ratings.map(([, c]) => c));
                return (
                  <div key={rating} className="flex items-center gap-2">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold flex-shrink-0 w-10 text-center ${ratingBgClass(rating)}`}>{rating}</span>
                    <div className="flex-1 h-4 bg-ink-800/60 rounded overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-red-700 to-rose-400 rounded shadow-[0_0_8px_rgba(232,56,79,0.4)] transition-all duration-700" style={{ width: `${(count / maxCount) * 100}%` }} />
                    </div>
                    <span className={`${PREMIUM_NUM} text-xs text-ink-300 w-7 text-right`}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {stats.collectionStats.length > 0 && (
        <div className={PREMIUM_PANEL}>
          <h2 className="text-base sm:text-lg font-black tracking-tight text-ink-100 mb-3.5 flex items-center gap-2"><Layers size={18} className="text-gold-400" /> Koleksiyon İlerlemesi</h2>
          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
            {stats.collectionStats.map((c) => (
              <div key={c.name} className="bg-ink-800/40 border border-ink-700/30 p-3.5 rounded-xl transition-colors duration-300">
                <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                  <span className="text-ink-200 font-bold truncate pr-2">{c.name}</span>
                  <span className="font-mono text-ink-400 font-semibold flex-shrink-0">{c.watched} / {c.total} (%{Math.round(c.progress)})</span>
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
    </div>
  );
}