import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Clock,
  Film,
  Tv,
  Star,
  Award,
  Flame,
  Crown,
  Download,
  Play,
  Pause,
  Tag,
  SlidersHorizontal,
  User,
  Users,
  CalendarDays,
  Activity,
  ShieldAlert,
  Skull,
  Swords,
  Coins,
  TrendingUp,
  Target,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLibrary, useGamification, useSettings } from '../context/slices';
import { ACHIEVEMENT_DEFS, AchievementIcon } from '../lib/achievements';
import { useComputedStats } from '../lib/selectorHooks';
import { formatDateShort, localDayKey, ratingBgClass } from '../lib/utils';
import type { WatchHistoryItem } from '../types';
import { handleImgFallback } from '../lib/selectors';

interface WrappedModalProps {
  onClose: () => void;
}

type Period = 'all' | 'year' | 'month' | 'past';
const SLIDE_DURATION_MS = 7000;
const TOTAL_SLIDES = 10;

export default function WrappedModal({ onClose }: WrappedModalProps) {
  const { data, showToast } = useApp();
  const { movies, series, history, collections } = useLibrary();
  const { achievements, totalXp } = useGamification();
  const { criteria } = useSettings();
  const coinLedger = data.coinLedger || [];

  // StatsPage ile aynı kaynaktan veri çek: useComputedStats ile tutarlı istatistikler
  const stats = useComputedStats(movies, series, criteria, history, collections, 'all');

  const currentYear = new Date().getFullYear();
  const now = Date.now();
  const [period, setPeriod] = useState<Period>('all');
  const [slide, setSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hoveredBadge, setHoveredBadge] = useState<number | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isHistoryItemPast = (h: WatchHistoryItem): boolean => {
    if (h.isPastWatch) return true;
    if (h.kind === 'movie' || h.type === 'movie') {
      const m = movies.find((x) => x.id === (h.itemId || h.id));
      if (m?.isPastWatch) return true;
    }
    return false;
  };

  // Periyoda göre filtrelenmiş geçmiş (time-based: all/year/month/past)
  const filteredHistory = useMemo(() => {
    return history.filter((h) => {
      if (period === 'past') {
        return isHistoryItemPast(h);
      }
      if (!h.watchedAt) return false;
      const d = new Date(h.watchedAt);
      if (isNaN(d.getTime())) return false;
      if (period === 'year') return d.getFullYear() === currentYear;
      if (period === 'month') return now - d.getTime() <= 30 * 86400000;
      return true;
    });
  }, [history, period, now, currentYear]);

  const movieHist = filteredHistory.filter((h) => h.kind === 'movie' || h.type === 'movie');
  const seriesHist = filteredHistory.filter((h) => h.kind === 'series' || h.type === 'series');

  // ── SÜRE HESAPLAMASI ──
  let movieMins = 0;
  movieHist.forEach((h) => {
    const m = movies.find((x) => x.id === (h.itemId || h.id));
    if (!m) return;
    movieMins += m.runtime || 115;
  });
  const seriesMins = seriesHist.length * 42;
  const totalMins = movieMins + seriesMins;
  const totalHours = Math.round(totalMins / 60);
  const totalDays = (totalMins / 1440).toFixed(1);

  // İzlenen bölüm sayısı (dizi history kayıtlarından)
  const episodeCount = seriesHist.length;

  // ── OTOPSİ (Yarım Bırakılanlar) ──
  let dnfCount = 0;
  const dnfReasonsMap = new Map<string, number>();
  const abandonedMovies = movies.filter((m) => Boolean(m.abandoned));
  const abandonedSeries = series.filter((s) => Boolean(s.abandoned));
  abandonedMovies.forEach((m) => {
    dnfCount++;
    (m.autopsyReasons || []).forEach((r) => dnfReasonsMap.set(r, (dnfReasonsMap.get(r) || 0) + 1));
  });
  abandonedSeries.forEach((s) => {
    dnfCount++;
    (s.autopsyReasons || []).forEach((r) => dnfReasonsMap.set(r, (dnfReasonsMap.get(r) || 0) + 1));
  });
  const topDnfReason = Array.from(dnfReasonsMap.entries()).sort((a, b) => b[1] - a[1])[0] || null;

  // ── DÜELLO / KALİBRASYON ──
  // Sadece gerçekleşmiş düelloları say: calibratedScore farklıysa veya duelCount varsa
  let maxShift = 0;
  let mostShiftedItemRaw: { title: string; original: number; calibrated: number } | null = null;
  let totalDuelsInPeriod = 0;
  movieHist.forEach((h) => {
    const m = movies.find((x) => x.id === (h.itemId || h.id));
    if (!m) return;
    const hasDuel =
      Boolean(m.calibratedScore != null && m.calibratedScore !== m.rating) ||
      Boolean((m as any).duelCount > 0);
    if (hasDuel && m.calibratedScore != null && m.rating != null) {
      totalDuelsInPeriod++;
      const shift = Math.abs(m.rating - m.calibratedScore);
      if (shift > maxShift) {
        maxShift = shift;
        mostShiftedItemRaw = { title: m.title, original: m.rating, calibrated: m.calibratedScore };
      }
    }
  });
  const mostShifted = mostShiftedItemRaw as { title: string; original: number; calibrated: number } | null;

  // ── MARATON ──
  const dayCounts: Record<string, number> = {};
  const dayItems: Record<string, string[]> = {};
  let nightCount = 0;
  let weekendCount = 0;
  filteredHistory.forEach((h) => {
    if (!h.watchedAt) return;
    const d = new Date(h.watchedAt);
    const hr = d.getHours();
    const day = d.getDay();
    if (hr >= 0 && hr < 5) nightCount++;
    if (day === 0 || day === 6) weekendCount++;
    const ds = localDayKey(h.watchedAt);
    dayCounts[ds] = (dayCounts[ds] || 0) + 1;
    if (!dayItems[ds]) dayItems[ds] = [];
    dayItems[ds].push(h.title);
  });

  const maxDaily = Math.max(0, ...Object.values(dayCounts));
  let marathonDate = '';
  let marathonItems: string[] = [];
  Object.entries(dayCounts).forEach(([date, count]) => {
    if (count === maxDaily && maxDaily > 0) {
      marathonDate = date;
      marathonItems = dayItems[date] || [];
    }
  });

  const sortedDates = Object.keys(dayCounts).sort();
  let maxStreak = 0;
  let curStreak = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      curStreak = 1;
      maxStreak = 1;
      continue;
    }
    const diff = Math.round(
      (new Date(sortedDates[i]).getTime() - new Date(sortedDates[i - 1]).getTime()) / 86400000
    );
    curStreak = diff === 1 ? curStreak + 1 : 1;
    if (curStreak > maxStreak) maxStreak = curStreak;
  }

  // ── PUAN DAĞILIMI ──
  const rated = filteredHistory.filter((h) => h.rating !== null);
  const avgRating =
    rated.length > 0 ? rated.reduce((s, h) => s + (h.rating || 0), 0) / rated.length : 0;

  let criticTitle = 'Dengeli Jüri ⚖';
  if (avgRating >= 8.5) criticTitle = 'Bonkör Kalpli 💖';
  else if (avgRating >= 7.2) criticTitle = 'Pozitif Sinefil 🍿';
  else if (avgRating > 0 && avgRating < 5.5) criticTitle = 'Acımasız Eleştirmen 💀';

  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
  let maxRatingCount = 0;
  rated.forEach((h) => {
    if (h.rating) {
      const rounded = Math.round(h.rating);
      if (rounded >= 1 && rounded <= 10) {
        ratingDistribution[rounded]++;
        if (ratingDistribution[rounded] > maxRatingCount) maxRatingCount = ratingDistribution[rounded];
      }
    }
  });

  const uniqueRated: { title: string; rating: number; kind: string; posterUrl?: string }[] = [];
  const seenKeys = new Set<string>();
  [...rated]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .forEach((h) => {
      const isM = h.kind === 'movie' || h.type === 'movie';
      const key = isM ? `m_${h.itemId || h.id}` : `s_${h.seriesId || h.itemId || h.id}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      const posterUrl = isM
        ? movies.find((m) => m.id === (h.itemId || h.id))?.posterUrl
        : series.find((s) => s.id === (h.seriesId || h.itemId || h.id))?.posterUrl;
      uniqueRated.push({ title: h.title, rating: h.rating || 0, kind: isM ? 'Film' : 'Dizi', posterUrl });
    });

  const topPicks = uniqueRated.slice(0, 3);
  const worstPick =
    uniqueRated.length > 1 && uniqueRated[uniqueRated.length - 1].rating <= 5
      ? uniqueRated[uniqueRated.length - 1]
      : null;

  // ── TÜRLER / YÖNETMEN / OYUNCU / DAMGA ──
  const genreMap = new Map<string, number>();
  filteredHistory.forEach((h) => (h.genres || []).forEach((g) => genreMap.set(g, (genreMap.get(g) || 0) + 1)));
  const topGenres = Array.from(genreMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxGenre = Math.max(...topGenres.map((g) => g[1]), 1);

  const dirMap = new Map<string, number>();
  const castMap = new Map<string, number>();
  const kwMap = new Map<string, number>();

  movieHist.forEach((h) => {
    const m = movies.find((x) => x.id === (h.itemId || h.id));
    if (!m) return;
    (m.directors || []).forEach((d) => dirMap.set(d, (dirMap.get(d) || 0) + 1));
    (m.cast || []).forEach((c) => castMap.set(c, (castMap.get(c) || 0) + 1));
    (m.keywords || []).forEach((k) => kwMap.set(k, (kwMap.get(k) || 0) + 1));
  });

  const seenS = new Set<string>();
  seriesHist.forEach((h) => {
    const sid = h.seriesId || h.itemId || h.id;
    if (seenS.has(sid)) return;
    seenS.add(sid);
    const s = series.find((x) => x.id === sid);
    if (!s) return;
    (s.creators || []).forEach((d) => dirMap.set(d, (dirMap.get(d) || 0) + 1));
    (s.cast || []).forEach((c) => castMap.set(c, (castMap.get(c) || 0) + 1));
    (s.keywords || []).forEach((k) => kwMap.set(k, (kwMap.get(k) || 0) + 1));
  });

  const favDirector = Array.from(dirMap.entries()).sort((a, b) => b[1] - a[1])[0] || null;
  const favActor = Array.from(castMap.entries()).sort((a, b) => b[1] - a[1])[0] || null;
  const topKeywords = Array.from(kwMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map((x) => x[0]);

  const tagMap = new Map<string, number>();
  filteredHistory.forEach((h) => (h.reviewTags || []).forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1)));
  const topTag = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1])[0] || null;

  // ── ROZETLER ──
  const totalUnlockedTiers = achievements.reduce((s, a) => s + a.unlockedTiers.length, 0);
  const rareBadges = achievements
    .filter((a) => a.unlockedTiers.length > 0)
    .map((a) => {
      const def = ACHIEVEMENT_DEFS.find((d) => d.id === a.achievementId);
      return {
        name: def?.name || a.achievementId,
        achievementId: a.achievementId,
        tier: a.unlockedTiers[a.unlockedTiers.length - 1] as string,
        isHidden: def?.hidden,
      };
    })
    .sort((a, b) => (a.isHidden === b.isHidden ? 0 : a.isHidden ? -1 : 1))
    .slice(0, 4);

  // ── EKONOMI ──
  const totalCoinsSpent = coinLedger
    .filter((entry: any) => entry.amount < 0)
    .reduce((sum: number, entry: any) => sum + Math.abs(entry.amount), 0);
  const totalEpicQuests = (stats as any)?.completedEpicContracts || 0;

  // ── KİŞİLİK ──
  let persona = {
    icon: '🎬',
    title: 'Kültür Muhafızı',
    desc: 'Günün her saatinde kaliteli yapımların peşinde koşan gerçek bir sinema tutkunu.',
  };
  if (period === 'past') {
    persona = {
      icon: '🕰️',
      title: 'Nostalji Koleksiyoncusu',
      desc: 'Geçmişte izlediği kült filmleri ve başyapıtları unutmayıp arşivinde yaşatan hafıza ustası.',
    };
  } else if (nightCount >= Math.max(3, filteredHistory.length * 0.25)) {
    persona = {
      icon: '🦉',
      title: 'Gece Baykuşu',
      desc: `Herkes uyurken ekran başındaydın! Gece yarısından sonra tam ${nightCount} yapım devirdin.`,
    };
  } else if (maxDaily >= 4) {
    persona = {
      icon: '👾',
      title: 'Maraton Canavarı',
      desc: `Tek bir günde tam ${maxDaily} yapım/bölüm izleyerek kırılması güç bir rekora imza attın!`,
    };
  } else if (weekendCount >= filteredHistory.length * 0.55 && filteredHistory.length >= 4) {
    persona = {
      icon: '🍿',
      title: 'Hafta Sonu Savaşçısı',
      desc: 'Tüm haftanın yorgunluğunu cumartesi ve pazar günleri dev ekran maratonlarıyla atıyorsun.',
    };
  } else if (seriesHist.length > movieHist.length * 3 && seriesHist.length >= 10) {
    persona = {
      icon: '📺',
      title: 'Sezon Yutucu',
      desc: '"Bir bölüm daha" diyerek sezonları peş peşe eriten sıkı bir dizi takipçisisin.',
    };
  }

  // ── PUAN RENKLERİ (StatsPage ile aynı mantık) ──
  const ratingColor = (r: number) => (r >= 9 ? 'text-gold-400' : r >= 7 ? 'text-emerald-400' : r >= 5 ? 'text-amber-400' : 'text-rose-400');
  const ratingBg = (r: number) => (r >= 9 ? 'bg-gold-500/90 text-ink-950' : r >= 7 ? 'bg-emerald-500/90 text-white' : r >= 5 ? 'bg-amber-500/90 text-ink-950' : 'bg-rose-500/90 text-white');

  const nextSlide = useCallback(() => {
    setSlide((s) => {
      if (s < TOTAL_SLIDES - 1) {
        setProgress(0);
        return s + 1;
      }
      return s;
    });
  }, []);

  const prevSlide = useCallback(() => {
    setSlide((s) => {
      if (s > 0) {
        setProgress(0);
        return s - 1;
      }
      return s;
    });
  }, []);

  useEffect(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    if (isPaused || slide === TOTAL_SLIDES - 1) return;

    const intervalTime = 50;
    const step = (intervalTime / SLIDE_DURATION_MS) * 100;

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          nextSlide();
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [slide, isPaused, nextSlide]);

  useEffect(() => {
    setProgress(0);
  }, [slide]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextSlide();
      else if (e.key === 'ArrowLeft') prevSlide();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [nextSlide, prevSlide, onClose]);

  const handleDownloadImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#050508');
    grad.addColorStop(0.5, '#131124');
    grad.addColorStop(1, '#050508');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    const rad1 = ctx.createRadialGradient(900, 250, 20, 900, 250, 600);
    rad1.addColorStop(0, 'rgba(245,158,11,0.20)');
    rad1.addColorStop(1, 'rgba(245,158,11,0)');
    ctx.fillStyle = rad1;
    ctx.fillRect(0, 0, 1080, 1920);

    const rad2 = ctx.createRadialGradient(180, 1650, 20, 180, 1650, 700);
    rad2.addColorStop(0, 'rgba(14,165,233,0.15)');
    rad2.addColorStop(1, 'rgba(14,165,233,0)');
    ctx.fillStyle = rad2;
    ctx.fillRect(0, 0, 1080, 1920);

    const drawBox = (x: number, y: number, w: number, h: number, r: number, fill: string, stroke: string) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    };

    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 54px sans-serif';
    ctx.fillText('🎬 SINEVIA WRAPPED', 80, 130);
    ctx.shadowColor = 'transparent';

    drawBox(660, 75, 340, 90, 24, 'rgba(14,165,233,0.05)', 'rgba(14,165,233,0.3)');

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${data.nickname || 'Ajan'}`, 970, 115);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 18px sans-serif';
    ctx.fillText(`${data.agentId || 'SNV-0000'}`, 970, 145);
    ctx.textAlign = 'left';

    const periodLabel =
      period === 'all'
        ? 'GÜNCEL TÜM ZAMANLAR'
        : period === 'year'
          ? `${currentYear} YILI ÖZETİ`
          : period === 'month'
            ? 'SON 30 GÜNÜN ÖZETİ'
            : 'DAHA ÖNCE İZLENENLER ARŞİVİ';

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(
      `${periodLabel}  •  SEVİYE ${data.level} (${(data.totalXp || 0).toLocaleString()} XP)`,
      80,
      205
    );

    drawBox(80, 250, 920, 210, 32, 'rgba(24,24,36,0.7)', 'rgba(245,158,11,0.3)');
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('SİNEFİL KARAKTERİN & JÜRİ KİMLİĞİN', 120, 305);

    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px sans-serif';
    ctx.fillText(`${persona.icon} ${persona.title}`, 120, 370);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`${criticTitle} (Ort. Puan: ${avgRating.toFixed(1)} / 10)`, 120, 425);
    ctx.shadowColor = 'transparent';

    const cards = [
      { label: 'TOPLAM SÜRE', val: `${totalHours} Saat`, sub: `${totalMins.toLocaleString()} Dakika (${totalDays} Gün)`, color: '#f59e0b' },
      { label: 'İZLENEN FİLM', val: `${stats.movieCount} Film`, sub: period === 'past' ? 'Nostalji Arşivi' : `Rekor Seri: ${maxStreak} Gün`, color: '#38bdf8' },
      { label: 'İZLENEN DİZİ', val: `${episodeCount} Bölüm`, sub: `${stats.uniqueSeriesCount} Farklı Dizi`, color: '#a855f7' },
      { label: 'KAZANILAN ROZET', val: `${totalUnlockedTiers} Kupa`, sub: `Seviye ${data.level} Sinefil`, color: '#10b981' },
    ];

    cards.forEach((c, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 80 + col * 475;
      const y = 495 + row * 210;
      drawBox(x, y, 445, 185, 28, 'rgba(20,20,30,0.6)', 'rgba(255,255,255,0.08)');
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(c.label, x + 35, y + 45);
      ctx.fillStyle = c.color;
      ctx.font = '900 44px sans-serif';
      ctx.fillText(c.val, x + 35, y + 105);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 20px sans-serif';
      ctx.fillText(c.sub, x + 35, y + 150);
    });

    drawBox(80, 940, 920, 310, 32, 'rgba(20,20,30,0.6)', 'rgba(56,189,248,0.25)');
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('🧬 SİNEMA DNA’N & FAVORİLERİN', 120, 995);

    const topGenreText = topGenres.length > 0 ? topGenres.map(([g, cnt]) => `${g} (${cnt})`).join('  •  ') : 'Veri Yok';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`Favori Türler: ${topGenreText.slice(0, 50)}`, 120, 1060);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 26px sans-serif';
    ctx.fillText(`🎥 Favori Yönetmen: ${favDirector ? `${favDirector[0]} (${favDirector[1]} yapım)` : 'Belirlenmedi'}`, 120, 1125);
    ctx.fillText(`🌟 Favori Oyuncu: ${favActor ? `${favActor[0]} (${favActor[1]} yapım)` : 'Belirlenmedi'}`, 120, 1180);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`🏷 Favori Damga: ${topTag ? `${topTag[0]} (${topTag[1]} kez)` : 'Henüz seçilmedi'}`, 120, 1235);

    drawBox(80, 1280, 920, 140, 32, 'rgba(40,20,30,0.6)', 'rgba(244,63,94,0.3)');
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('🔥 SINEVIA AJAN RAPORU', 120, 1330);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 26px sans-serif';
    ctx.fillText(`Yarım Bırakılan (DNF): ${dnfCount} Yapım`, 120, 1385);
    ctx.fillStyle = '#34d399';
    ctx.fillText(`Düello Sapması: Maksimum ${maxShift.toFixed(1)} P.`, 540, 1385);

    drawBox(80, 1450, 920, 350, 32, 'rgba(20,20,30,0.6)', 'rgba(245,158,11,0.25)');
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('👑 ŞEREF KÜRSÜSÜ (EN YÜKSEK PUANLI YAPIMLARIN)', 120, 1505);

    if (topPicks.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('Henüz puanlanmış yapım bulunmuyor.', 120, 1590);
    } else {
      topPicks.slice(0, 3).forEach((item, idx) => {
        const y = 1580 + idx * 75;
        ctx.fillStyle = '#f59e0b';
        ctx.font = '900 34px sans-serif';
        ctx.fillText(`#${idx + 1}`, 120, y);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText(item.title.slice(0, 35), 195, y);
        const ratingColorCanvas = item.rating >= 9 ? '#f59e0b' : item.rating >= 7 ? '#22c55e' : item.rating >= 5 ? '#f59e0b' : '#ef4444';
        ctx.fillStyle = ratingColorCanvas;
        ctx.font = '900 32px sans-serif';
        ctx.fillText(`★ ${item.rating}/10`, 820, y);
      });
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '600 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SINEVIA  •  Kişisel Film & Dizi Takip Asistanı', 540, 1860);
    ctx.textAlign = 'left';

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `sinevia-wrapped-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    showToast('Wrapped posterin PNG olarak indirildi! Arkadaşlarınla paylaşabilirsin.', 'success');
  };

  const bgThemes = [
    'from-amber-950/80 via-ink-950 to-black',
    'from-cyan-950/80 via-ink-950 to-black',
    'from-purple-950/80 via-ink-950 to-black',
    'from-orange-950/80 via-ink-950 to-black',
    'from-emerald-950/80 via-ink-950 to-black',
    'from-rose-950/80 via-ink-950 to-black',
    'from-indigo-950/80 via-blue-950/40 to-black',
    'from-emerald-900/70 via-teal-950 to-black',
    'from-amber-900/70 via-indigo-950 to-black',
    'from-ink-900/80 via-ink-950 to-black',
  ];

  const badgeConfig = [
    { label: 'Zaman Kapsülü', icon: <Clock size={13} />, color: 'amber' },
    { label: 'Sinema DNA', icon: <Sparkles size={13} />, color: 'sky' },
    { label: 'Şeref Kürsüsü', icon: <Crown size={13} />, color: 'amber' },
    { label: 'Maraton', icon: <CalendarDays size={13} />, color: 'orange' },
    { label: 'Jüri Koltuğu', icon: <SlidersHorizontal size={13} />, color: 'emerald' },
    { label: 'Otopsi', icon: <Skull size={13} />, color: 'rose' },
    { label: 'Düello', icon: <Swords size={13} />, color: 'indigo' },
    { label: 'Pazar', icon: <Coins size={13} />, color: 'teal' },
    { label: 'Müze', icon: <ShieldAlert size={13} />, color: 'amber' },
    { label: 'Final', icon: <Download size={13} />, color: 'sky' },
  ];

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 backdrop-blur-2xl p-3 sm:p-5 animate-fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-md h-[92svh] sm:h-[94dvh] max-h-[860px] bg-gradient-to-br ${bgThemes[slide]} border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col select-none`}
      >
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[80%] h-[40%] bg-white/4 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-30 pt-3 px-4 space-y-2 bg-gradient-to-b from-black/60 to-transparent pb-2 shrink-0">
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => { setSlide(idx); setProgress(0); }}
                className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden cursor-pointer hover:bg-white/20 transition-colors"
              >
                <div
                  className="h-full bg-gold-400 rounded-full transition-all duration-300 ease-out"
                  style={{ width: idx < slide ? '100%' : idx === slide ? `${progress}%` : '0%' }}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-1.5">
            {slide === 0 ? (
              <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-lg p-1 rounded-2xl border border-white/5 overflow-x-auto hide-scrollbar">
                {(['all', 'year', 'month', 'past'] as const).map((p) => {
                  const labels = { all: 'Güncel', year: `${currentYear}`, month: '30 Gün', past: 'Önceden' };
                  return (
                    <button
                      key={p}
                      onClick={() => { setPeriod(p); setSlide(0); setProgress(0); }}
                      className={`px-3 py-1 min-h-[32px] rounded-xl text-[11px] font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                        period === p
                          ? p === 'past'
                            ? 'bg-violet-500/90 text-white shadow-lg'
                            : 'bg-gold-500/90 text-ink-950 shadow-lg'
                          : 'text-ink-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {labels[p]}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-widest pl-2">Sinevia Rewind</div>
            )}

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white border border-white/10 flex items-center justify-center transition-all hover:scale-105"
                title={isPaused ? 'Devam Et' : 'Duraklat'}
              >
                {isPaused ? <Play size={14} className="ml-0.5" /> : <Pause size={14} />}
              </button>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white border border-white/10 flex items-center justify-center transition-all hover:scale-105"
                title="Kapat"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="relative z-20 flex-1 min-h-0 overflow-hidden px-5 sm:px-6 py-2 flex flex-col justify-center">
          {/* SLIDE 0: Zaman Kapsülü */}
          {slide === 0 && (
            <div className="space-y-3 text-center animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400 text-[10px] font-bold uppercase tracking-widest">
                <Clock size={13} /> Zaman Kapsülü
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                {period === 'past' ? (
                  <>Geçmişteki <span className="text-violet-400">Sinema Arşivin</span></>
                ) : (
                  <>Ekran Başındaki <span className="text-gold-400">Sinema Mesain</span></>
                )}
              </h2>
              <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col items-center">
                <div className="text-4xl sm:text-5xl font-black text-gold-400 tracking-tighter">
                  {totalMins.toLocaleString('tr-TR')}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Dakika İzleme Süresi</div>
                <p className="text-[11px] font-medium text-ink-300 mt-2 pt-2 border-t border-white/5 w-full">
                  Hiç uyumadan İzlersen tam <strong className="text-white">{totalHours} saat</strong> ({totalDays} gün) sürerdi!
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-black/20 backdrop-blur-md border border-white/5 rounded-xl p-3 flex flex-col items-center">
                  <Film size={18} className="text-gold-400 mb-1" />
                  <div className="text-xl font-black text-white">{stats.movieCount}</div>
                  <div className="text-[9px] font-semibold text-ink-400">Film Bitirdin</div>
                </div>
                <div className="bg-black/20 backdrop-blur-md border border-white/5 rounded-xl p-3 flex flex-col items-center">
                  <Tv size={18} className="text-azure-400 mb-1" />
                  <div className="text-xl font-black text-white">{episodeCount}</div>
                  <div className="text-[9px] font-semibold text-ink-400">Bölüm ({stats.uniqueSeriesCount} Dizi)</div>
                </div>
              </div>
              {period !== 'past' && (
                <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-orange-300 bg-orange-500/10 border border-orange-500/20 py-2 px-3 rounded-xl">
                  <Flame size={14} /> En Uzun Günlük Serin: {maxStreak} Gün!
                </div>
              )}
            </div>
          )}

          {/* SLIDE 1: Sinema DNA */}
          {slide === 1 && (
            <div className="space-y-3 animate-fade-in">
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-azure-500/10 border border-azure-500/20 text-azure-400 text-[10px] font-bold uppercase tracking-widest">
                  <Sparkles size={13} /> Sinema DNA'n
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">Seni Sen Yapan Türler</h2>
              </div>
              <div className="bg-black/20 backdrop-blur-xl border border-white/5 rounded-2xl p-4 space-y-2.5">
                <div className="text-[9px] font-bold uppercase tracking-widest text-azure-400/80">En Çok Tükettiğin Türler</div>
                {topGenres.length === 0 ? (
                  <p className="text-xs text-ink-400 font-medium">Henüz tür verisi yok.</p>
                ) : (
                  topGenres.map(([g, cnt], i) => (
                    <div key={g} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span className="text-white/90">#{i + 1} {g}</span>
                        <span className="text-azure-300/80">{cnt} Yapım</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-azure-500 to-teal-400 rounded-full" style={{ width: `${(cnt / maxGenre) * 100}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-black/20 border border-white/5 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-gold-400/80 mb-1">
                    <User size={11} /> Favori Yönetmen
                  </div>
                  <div className="text-sm font-black text-white truncate">{favDirector ? favDirector[0] : 'Belirlenmedi'}</div>
                  <div className="text-[10px] text-ink-400 mt-0.5">{favDirector ? `${favDirector[1]} yapım` : '-'}</div>
                </div>
                <div className="bg-black/20 border border-white/5 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-gold-400/80 mb-1">
                    <Users size={11} /> Favori Oyuncu
                  </div>
                  <div className="text-sm font-black text-white truncate">{favActor ? favActor[0] : 'Belirlenmedi'}</div>
                  <div className="text-[10px] text-ink-400 mt-0.5">{favActor ? `${favActor[1]} yapım` : '-'}</div>
                </div>
              </div>
              {topKeywords.length > 0 && (
                <div className="bg-black/20 border border-white/5 rounded-xl p-3">
                  <div className="text-[9px] font-bold uppercase text-emerald-400/80 mb-2">Ruhunu Yansıtan Temalar</div>
                  <div className="flex flex-wrap gap-1.5">
                    {topKeywords.map((kw) => (
                      <span key={kw} className="text-[10px] font-medium bg-white/5 text-white/90 border border-white/5 px-2 py-0.5 rounded-lg">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SLIDE 2: Şeref Kürsüsü */}
          {slide === 2 && (
            <div className="space-y-3 animate-fade-in">
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold uppercase tracking-widest">
                  <Crown size={13} /> Başyapıtlar Vitrini
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">Unutamadığın Zirve Yapımlar</h2>
              </div>
              {topPicks.length === 0 ? (
                <div className="text-center py-8 bg-black/20 rounded-2xl border border-white/5 text-xs text-ink-400 font-medium">
                  Bu dönemde henüz puanlanmış bir yapım yok.
                </div>
              ) : (
                <div className="space-y-2">
                  {topPicks.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-black/20 border border-white/10 rounded-xl p-2.5 group">
                      <div className="w-10 h-14 rounded-lg bg-ink-900 overflow-hidden flex-shrink-0 border border-white/5 flex items-center justify-center">
                        {item.posterUrl ? (
                          <img loading="lazy" decoding="async" src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" onError={handleImgFallback} />
                        ) : (
                          <Film size={16} className="text-ink-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[8px] font-bold uppercase tracking-wider text-gold-400/80">#{idx + 1} En Yüksek Puanlı {item.kind}</div>
                        <div className="text-sm font-black text-white truncate">{item.title}</div>
                      </div>
                      <div className={`px-2.5 py-1 rounded-lg font-black text-xs flex items-center gap-1 flex-shrink-0 ${ratingBg(item.rating)}`}>
                        <Star size={12} className="fill-current" /> {item.rating}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {worstPick && (
                <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-3 flex items-center justify-between">
                  <div className="min-w-0 pr-3">
                    <div className="text-[8px] font-bold uppercase tracking-wider text-red-400/80">En Büyük Hayal Kırıklığın 💀</div>
                    <div className="text-sm font-bold text-white/90 truncate">{worstPick.title}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg font-black text-xs border border-red-500/20 flex-shrink-0 ${ratingColor(worstPick.rating)}`}>
                    {worstPick.rating} / 10
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SLIDE 3: Maraton */}
          {slide === 3 && (
            <div className="space-y-3 text-center animate-fade-in">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-widest">
                <CalendarDays size={13} /> Zaman Bükücü
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                Ekrandan Hiç Kopamadığın<br /><span className="text-orange-400">O Maraton Günü</span>
              </h2>
              {maxDaily < 2 ? (
                <div className="bg-black/20 border border-white/5 rounded-2xl p-5 text-ink-400 text-sm font-medium">
                  Sen oldukça dengeli bir izleyicisin. Henüz çılgın bir maraton günün olmamış.
                </div>
              ) : (
                <>
                  <div className="bg-black/30 border border-orange-500/20 rounded-2xl p-5 flex flex-col items-center">
                    <div className="text-[10px] font-semibold text-ink-300 uppercase tracking-widest mb-1">{formatDateShort(marathonDate)}</div>
                    <div className="text-5xl font-black text-orange-400 tracking-tighter">{maxDaily}</div>
                    <div className="text-[9px] font-bold text-orange-300/60 uppercase tracking-widest">Yapım / Bölüm İzledin</div>
                  </div>
                  <div className="bg-black/20 border border-white/5 rounded-xl p-3 text-left">
                    <div className="text-[9px] font-bold text-ink-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Activity size={12} /> O Gün Neler İzledin?
                    </div>
                    <div className="space-y-1.5">
                      {marathonItems.slice(0, 5).map((title, idx) => (
                        <div key={idx} className="text-[11px] font-semibold text-white/90 bg-white/5 px-2.5 py-1.5 rounded-lg truncate border border-white/5">
                          <span className="text-ink-500 mr-1.5">{idx + 1}.</span>{title}
                        </div>
                      ))}
                      {marathonItems.length > 5 && (
                        <div className="text-[10px] text-ink-400 font-semibold pl-1">+ {marathonItems.length - 5} yapım daha…</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SLIDE 4: Jüri Koltuğu */}
          {slide === 4 && (
            <div className="space-y-3 animate-fade-in">
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                  <SlidersHorizontal size={13} /> Jüri Koltuğu
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">Nasıl Bir Eleştirmensin?</h2>
              </div>
              <div className="bg-black/20 border border-white/10 rounded-2xl p-4 text-center space-y-1.5">
                <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-widest">Genel Puan Ortalaman</div>
                <div className="text-4xl font-black text-emerald-400 tracking-tighter">
                  {avgRating.toFixed(1)} <span className="text-lg font-bold text-ink-500">/ 10</span>
                </div>
                <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold">
                  {criticTitle}
                </div>
              </div>
              {maxRatingCount > 0 && (
                <div className="bg-black/20 border border-white/5 rounded-xl p-4">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-azure-400/80 mb-3 text-center">Puanlama Dağılımın</div>
                  <div className="flex items-end justify-between h-20 gap-1.5 px-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                      const count = ratingDistribution[score] || 0;
                      const heightPct = count > 0 ? Math.max(15, (count / maxRatingCount) * 100) : 0;
                      return (
                        <div key={score} className="flex flex-col items-center flex-1 h-full justify-end group">
                          {count > 0 && (
                            <span className="text-[9px] font-black text-emerald-300 mb-1.5 leading-none opacity-80 group-hover:opacity-100 transition-opacity">
                              {count}
                            </span>
                          )}
                          <div
                            className={`w-full rounded-t-md transition-all duration-1000 ease-out ${
                              count > 0 ? 'bg-gradient-to-t from-emerald-600/40 to-emerald-400/80 group-hover:to-emerald-400' : 'bg-white/5 h-1.5'
                            }`}
                            style={count > 0 ? { height: `${heightPct}%` } : {}}
                          />
                          <span className={`text-[9px] mt-1.5 font-semibold ${count > 0 ? 'text-white/90' : 'text-ink-600'}`}>{score}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {topTag && (
                <div className="bg-black/20 border border-gold-500/20 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-gold-400/80 flex items-center gap-1.5 mb-0.5">
                      <Tag size={11} /> En Çok Vurduğun Damga
                    </div>
                    <div className="text-sm font-black text-white/90">{topTag[0]}</div>
                  </div>
                  <div className="text-xs font-bold bg-gold-500/10 text-gold-400 border border-gold-500/20 px-2.5 py-1 rounded-lg">{topTag[1]} Kez</div>
                </div>
              )}
            </div>
          )}

          {/* SLIDE 5: Otopsi */}
          {slide === 5 && (
            <div className="space-y-3 text-center animate-fade-in">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-widest">
                <Skull size={13} /> Sinematik Otopsi
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                Tahammül Edemeyip <span className="text-rose-500">Yarım Bıraktıkların</span>
              </h2>
              <div className="bg-black/30 border border-rose-500/20 rounded-2xl p-5 flex flex-col items-center">
                <div className="text-5xl font-black text-rose-500 tracking-tighter">{dnfCount}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-ink-300">Yapım Terk Edildi</div>
                <p className="text-[11px] text-ink-400 font-medium mt-2 pt-2 border-t border-white/5 w-full">
                  {dnfCount === 0 ? 'Çelik gibi sinirlerin var! Başladığın hiçbir yapımı yarım bırakmamışsın.' : 'Bazen hayat kötü yapımlara katlanmak için çok kısadır, değil mi?'}
                </p>
              </div>
              {topDnfReason && (
                <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-4 flex flex-col items-center">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-red-400/80 mb-1">En Çok Kaçış Nedenin</div>
                  <div className="text-lg font-black text-white mb-2">"{topDnfReason[0]}"</div>
                  <div className="text-[11px] font-semibold bg-red-500/10 text-red-300 border border-red-500/20 px-3 py-1 rounded-lg">
                    Bu nedenle {topDnfReason[1]} yapımı bıraktın.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SLIDE 6: Düello */}
          {slide === 6 && (
            <div className="space-y-3 text-center animate-fade-in">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-widest">
                <Swords size={13} /> Terazi Ustası
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                Kör Kalibrasyon <span className="text-indigo-400">Düelloları</span>
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/20 border border-indigo-500/20 rounded-xl p-4 flex flex-col items-center">
                  <div className="text-3xl font-black text-indigo-400">{totalDuelsInPeriod}</div>
                  <div className="text-[9px] font-bold text-ink-400 uppercase tracking-widest">Düello Yaptın</div>
                </div>
                <div className="bg-black/20 border border-indigo-500/20 rounded-xl p-4 flex flex-col items-center">
                  <div className="text-3xl font-black text-emerald-400">{maxShift.toFixed(1)}</div>
                  <div className="text-[9px] font-bold text-ink-400 uppercase tracking-widest">En Yüksek Sapma</div>
                </div>
              </div>
              {mostShifted ? (
                <div className="bg-black/30 border border-white/5 rounded-xl p-4 text-left">
                  <div className="text-[9px] font-bold text-ink-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Target size={12} /> Fikrinin En Çok Değiştiği Yapım
                  </div>
                  <div className="text-sm font-black text-white truncate mb-3">{mostShifted.title}</div>
                  <div className="flex items-center justify-between">
                    <div className="bg-white/5 rounded-lg px-3 py-2 text-center border border-white/5 w-[42%]">
                      <div className="text-[8px] font-semibold text-ink-500 uppercase tracking-widest mb-0.5">Eski Puan</div>
                      <div className="text-base font-black text-ink-300">{mostShifted.original.toFixed(1)}</div>
                    </div>
                    <ChevronRight size={16} className="text-indigo-500/50" />
                    <div className="bg-indigo-500/10 rounded-lg px-3 py-2 text-center border border-indigo-500/20 w-[42%]">
                      <div className="text-[8px] font-semibold text-indigo-300/80 uppercase tracking-widest mb-0.5">Düello Sonucu</div>
                      <div className="text-base font-black text-indigo-400">{mostShifted.calibrated.toFixed(1)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-black/20 border border-white/5 rounded-xl p-4 text-sm text-ink-400 font-medium italic">
                  Bu dönemde hiç kör kalibrasyon düellosuna katılmamışsın.
                </div>
              )}
            </div>
          )}

          {/* SLIDE 7: Pazar */}
          {slide === 7 && (
            <div className="space-y-3 animate-fade-in text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                <Coins size={13} /> Pazarın Kurdu
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Sözleşmeler & Ekonomi</h2>
              <div className="bg-black/30 border border-emerald-500/20 rounded-2xl p-5 flex flex-col items-center">
                <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/80 mb-2">Markette Harcanan Toplam</div>
                <div className="text-4xl sm:text-5xl font-black text-white flex items-center gap-2 tracking-tighter">
                  {totalCoinsSpent.toLocaleString()} <span className="text-xl font-bold text-emerald-500">SC</span>
                </div>
                <div className="text-[10px] text-ink-300 mt-2">Mevcut bakiye: {(data.coins ?? 0).toLocaleString()} SC</div>
              </div>
              <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
                    <Award size={18} />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-ink-400">Tamamlanan Epik Görev</div>
                    <div className="text-base font-black text-white">{totalEpicQuests} Adet</div>
                  </div>
                </div>
                <TrendingUp size={24} className="text-emerald-500/20" />
              </div>
            </div>
          )}

          {/* SLIDE 8: Müze */}
          {slide === 8 && (
            <div className="space-y-3 text-center animate-fade-in">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest">
                ✨ Sinefil Ruhu & Müzen
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">İzleme Karakterin</h2>
              <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex flex-col items-center">
                <div className="text-5xl animate-bounce mb-1">{persona.icon}</div>
                <div className="text-lg font-black text-gold-400">{persona.title}</div>
                <p className="text-[11px] text-ink-200/90 font-medium leading-relaxed max-w-[92%] mx-auto">{persona.desc}</p>
              </div>
              <div className="bg-black/20 border border-gold-500/20 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <div className="text-left">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-gold-400/80">Mevcut Seviyen</div>
                    <div className="text-2xl font-black text-white">LVL {data.level}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-ink-400">Açılan Kupa</div>
                    <div className="text-lg font-black text-emerald-400">{totalUnlockedTiers} Kupa</div>
                  </div>
                </div>
                {rareBadges.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 text-left">
                    {rareBadges.map((b, i) => (
                      <div key={i} className="bg-white/5 border border-white/5 rounded-lg p-2 flex items-center gap-2">
                        <AchievementIcon achievementId={b.achievementId} tier={b.tier} size={20} className="flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-white/90 truncate">{b.name}</div>
                          <div className={`text-[8px] font-black uppercase ${b.isHidden ? 'text-purple-400' : 'text-gold-400'}`}>
                            {b.tier} {b.isHidden && '(Gizli)'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3 text-zinc-500 text-xs font-medium">Henüz rozetin yok. İzlemeye devam et!</div>
                )}
              </div>
            </div>
          )}

          {/* SLIDE 9: Final VIP Kart */}
          {slide === 9 && (
            <div className="space-y-3 animate-fade-in flex flex-col items-center justify-center h-full">
              <div className="w-full bg-black/40 border border-gold-500/30 rounded-2xl p-4 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-bold uppercase text-azure-400/80 tracking-widest flex items-center gap-1">
                      <ShieldAlert size={9} /> Sinevia Ajanı
                    </span>
                    <span className="text-sm font-black text-white">{data.nickname}</span>
                  </div>
                  <div className="text-[9px] font-semibold text-ink-400 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                    {data.agentId}
                  </div>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div>
                    <div className="text-[8px] font-bold uppercase tracking-widest text-gold-400/80">🎬 SINEVIA WRAPPED</div>
                    <div className="text-base font-black text-white">{persona.icon} {persona.title}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black bg-gold-500 text-ink-950 px-2 py-0.5 rounded-lg inline-block">
                      LVL {data.level}
                    </div>
                    <div className="text-[8px] font-semibold text-ink-400 mt-1">
                      {(data.totalXp || 0).toLocaleString()} XP
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-left">
                  <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                    <div className="text-[8px] text-ink-400 font-bold uppercase tracking-widest">Toplam Süre</div>
                    <div className="text-sm font-black text-gold-400">
                      {totalHours} Saat <span className="text-[9px] text-ink-500">({totalDays}G)</span>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                    <div className="text-[8px] text-ink-400 font-bold uppercase tracking-widest">İzlenen Yapım</div>
                    <div className="text-sm font-black text-azure-400">
                      {stats.movieCount} Film • {episodeCount} Böl.
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                    <div className="text-[8px] text-ink-400 font-bold uppercase tracking-widest">Otopsi & Sapma</div>
                    <div className="text-[11px] font-black text-rose-400">
                      {dnfCount} DNF • Max {maxShift.toFixed(1)} P.
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                    <div className="text-[8px] text-ink-400 font-bold uppercase tracking-widest">Jüri Ortalaman</div>
                    <div className="text-xs font-black text-emerald-400">
                      ★ {avgRating.toFixed(1)} / 10
                    </div>
                  </div>
                </div>
                {topPicks.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[8px] font-bold uppercase tracking-widest text-gold-400/80">👑 Zirvedeki Yapımların</div>
                    {topPicks.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-white/5 border border-white/5 px-2.5 py-1.5 rounded-lg">
                        <span className="font-bold text-white/90 truncate pr-2">#{i + 1} {item.title}</span>
                        <span className={`font-black flex-shrink-0 ${ratingColor(item.rating)}`}>★ {item.rating}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleDownloadImage}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 text-ink-950 font-black py-2.5 rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 text-sm"
              >
                <Download size={16} /> 📸 Story Olarak İndir (PNG)
              </button>
            </div>
          )}
        </div>

        <div className="relative z-30 p-3 sm:p-4 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent shrink-0">
          <button
            onClick={() => { prevSlide(); setProgress(0); }}
            disabled={slide === 0}
            className="flex items-center gap-1.5 min-h-[40px] text-xs font-bold text-ink-300 hover:text-white disabled:opacity-30 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all"
          >
            <ChevronLeft size={15} /> Önceki
          </button>
          <span className="text-[11px] font-bold text-ink-400/80 tracking-widest">{slide + 1} / {TOTAL_SLIDES}</span>
          <button
            onClick={() => { nextSlide(); setProgress(0); }}
            disabled={slide === TOTAL_SLIDES - 1}
            className="flex items-center gap-1.5 min-h-[40px] text-xs font-black uppercase tracking-wider text-ink-950 bg-gold-500 hover:bg-gold-400 disabled:opacity-30 px-3 py-2 rounded-xl shadow-lg transition-all hover:scale-105"
          >
            Sonraki <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
