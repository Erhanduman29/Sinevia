import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles, Clock, Film, Tv, Star, Award, Flame, Crown, Download, Play, Pause, Tag, SlidersHorizontal, User, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ACHIEVEMENT_DEFS } from '../lib/achievements';

interface WrappedModalProps {
  onClose: () => void;
}

type Period = 'all' | 'year' | 'month';
const SLIDE_DURATION_MS = 7000;

export default function WrappedModal({ onClose }: WrappedModalProps) {
  const { data, showToast } = useApp();
  const [period, setPeriod] = useState<Period>('all');
  const [slide, setSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const TOTAL_SLIDES = 7;

  const currentYear = new Date().getFullYear();
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stats = useMemo(() => {
    const now = Date.now();
    const filteredHistory = data.history.filter((h) => {
      if (!h.watchedAt) return false;
      const d = new Date(h.watchedAt);
      if (isNaN(d.getTime())) return false;
      if (period === 'year') return d.getFullYear() === currentYear;
      if (period === 'month') return now - d.getTime() <= 30 * 86400000;
      return true;
    });

    const movieHist = filteredHistory.filter((h) => h.kind === 'movie' || h.type === 'movie');
    const seriesHist = filteredHistory.filter((h) => h.kind === 'series' || h.type === 'series');

    let movieMins = 0;
    movieHist.forEach((h) => {
      const m = data.movies.find((x) => x.id === (h.itemId || h.id));
      movieMins += m?.runtime || 115;
    });
    const seriesMins = seriesHist.length * 42;
    const totalMins = movieMins + seriesMins;
    const totalHours = Math.round(totalMins / 60);
    const totalDays = (totalMins / 1440).toFixed(1);

    const uniqueSeriesCount = new Set(seriesHist.map((h) => h.seriesId || h.itemId || h.id)).size;

    const genreMap = new Map<string, number>();
    filteredHistory.forEach((h) => (h.genres || []).forEach((g) => genreMap.set(g, (genreMap.get(g) || 0) + 1)));
    const topGenres = Array.from(genreMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const maxGenre = Math.max(...topGenres.map((g) => g[1]), 1);

    const dirMap = new Map<string, number>();
    const castMap = new Map<string, number>();
    const kwMap = new Map<string, number>();

    movieHist.forEach((h) => {
      const m = data.movies.find((x) => x.id === (h.itemId || h.id));
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
      const s = data.series.find((x) => x.id === sid);
      if (!s) return;
      (s.creators || []).forEach((d) => dirMap.set(d, (dirMap.get(d) || 0) + 1));
      (s.cast || []).forEach((c) => castMap.set(c, (castMap.get(c) || 0) + 1));
      (s.keywords || []).forEach((k) => kwMap.set(k, (kwMap.get(k) || 0) + 1));
    });

    const favDirector = Array.from(dirMap.entries()).sort((a, b) => b[1] - a[1])[0] || null;
    const favActor = Array.from(castMap.entries()).sort((a, b) => b[1] - a[1])[0] || null;
    const topKeywords = Array.from(kwMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map((x) => x[0]);

    const rated = filteredHistory.filter((h) => h.rating !== null);
    const avgRating = rated.length > 0 ? rated.reduce((s, h) => s + (h.rating || 0), 0) / rated.length : 0;

    const uniqueRated: { title: string; rating: number; kind: string; posterUrl?: string }[] = [];
    const seenKeys = new Set<string>();
    [...rated].sort((a, b) => (b.rating || 0) - (a.rating || 0)).forEach((h) => {
      const isM = h.kind === 'movie' || h.type === 'movie';
      const key = isM ? `m_${h.itemId || h.id}` : `s_${h.seriesId || h.itemId || h.id}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      const posterUrl = isM
        ? data.movies.find((m) => m.id === (h.itemId || h.id))?.posterUrl
        : data.series.find((s) => s.id === (h.seriesId || h.itemId || h.id))?.posterUrl;
      uniqueRated.push({ title: h.title, rating: h.rating || 0, kind: isM ? 'Film' : 'Dizi', posterUrl });
    });

    const topPicks = uniqueRated.slice(0, 3);
    const worstPick = uniqueRated.length > 1 && uniqueRated[uniqueRated.length - 1].rating <= 5 ? uniqueRated[uniqueRated.length - 1] : null;

    const tagMap = new Map<string, number>();
    const critMap = new Map<string, { sum: number; count: number }>();
    filteredHistory.forEach((h) => {
      (h.reviewTags || []).forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1));
      if (h.detailedRating) {
        Object.entries(h.detailedRating).forEach(([cid, val]) => {
          const cur = critMap.get(cid) || { sum: 0, count: 0 };
          cur.sum += Number(val); cur.count++;
          critMap.set(cid, cur);
        });
      }
    });
    const topTag = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1])[0] || null;
    const critList = (data.criteria || [])
      .map((c) => { const st = critMap.get(c.id); return { name: c.name, avg: st && st.count > 0 ? st.sum / st.count : 0, count: st?.count || 0 }; })
      .filter((c) => c.count > 0)
      .sort((a, b) => b.avg - a.avg);

    let criticTitle = 'Dengeli Jüri ⚖️';
    if (avgRating >= 8.5) criticTitle = 'Bonkör Kalpli 💖';
    else if (avgRating >= 7.2) criticTitle = 'Pozitif Sinefil 🍿';
    else if (avgRating > 0 && avgRating < 5.5) criticTitle = 'Acımasız Eleştirmen 💀';

    let nightCount = 0, weekendCount = 0;
    const dayCounts: Record<string, number> = {};
    filteredHistory.forEach((h) => {
      const d = new Date(h.watchedAt);
      const hr = d.getHours(), day = d.getDay();
      if (hr >= 0 && hr < 5) nightCount++;
      if (day === 0 || day === 6) weekendCount++;
      const ds = h.watchedAt.slice(0, 10);
      dayCounts[ds] = (dayCounts[ds] || 0) + 1;
    });
    const maxDaily = Math.max(0, ...Object.values(dayCounts));

    const sortedDates = Object.keys(dayCounts).sort();
    let maxStreak = 0, curStreak = 0;
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) { curStreak = 1; maxStreak = 1; continue; }
      const diff = Math.round((new Date(sortedDates[i]).getTime() - new Date(sortedDates[i - 1]).getTime()) / 86400000);
      curStreak = diff === 1 ? curStreak + 1 : 1;
      if (curStreak > maxStreak) maxStreak = curStreak;
    }

    let persona = { icon: '🎬', title: 'Kültür Muhafızı', desc: 'Günün her saatinde kaliteli yapımların peşinde koşan gerçek bir sinema tutkunu.' };
    if (nightCount >= Math.max(3, filteredHistory.length * 0.25)) {
      persona = { icon: '🦉', title: 'Gece Baykuşu', desc: `Herkes uyurken ekran başındaydın! Gece yarısından sonra tam ${nightCount} yapım devirdin.` };
    } else if (maxDaily >= 4) {
      persona = { icon: '👾', title: 'Maraton Canavarı', desc: `Tek bir günde tam ${maxDaily} yapım/bölüm izleyerek kırılması güç bir rekora imza attın!` };
    } else if (weekendCount >= filteredHistory.length * 0.55 && filteredHistory.length >= 4) {
      persona = { icon: '🍿', title: 'Hafta Sonu Savaşçısı', desc: 'Tüm haftanın yorgunluğunu cumartesi ve pazar günleri dev ekran maratonlarıyla atıyorsun.' };
    } else if (seriesHist.length > movieHist.length * 3 && seriesHist.length >= 10) {
      persona = { icon: '📺', title: 'Sezon Yutucu', desc: '"Bir bölüm daha" diyerek sezonları peş peşe eriten sıkı bir dizi takipçisisin.' };
    }

    const totalUnlockedTiers = data.achievements.reduce((s, a) => s + a.unlockedTiers.length, 0);
    const rareBadges = data.achievements
      .filter((a) => a.unlockedTiers.length > 0)
      .map((a) => {
        const def = ACHIEVEMENT_DEFS.find((d) => d.id === a.achievementId);
        const highestTier = a.unlockedTiers[a.unlockedTiers.length - 1];
        return { name: def?.name || a.achievementId, icon: def?.icon || '🏆', tier: highestTier };
      })
      .slice(-4);

    return {
      totalCount: filteredHistory.length, movieCount: movieHist.length, episodeCount: seriesHist.length,
      uniqueSeriesCount, totalMins, totalHours, totalDays, maxStreak, maxDaily,
      topGenres, maxGenre, favDirector, favActor, topKeywords,
      avgRating, criticTitle, topPicks, worstPick, topTag, critList,
      persona, totalUnlockedTiers, rareBadges,
    };
  }, [data, period, currentYear]);

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

  // İlerleme Çubuğu Zamanlayıcısı
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

  // Slayt değiştiğinde progress'i sıfırla
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
    grad.addColorStop(0, '#090a10');
    grad.addColorStop(0.5, '#131124');
    grad.addColorStop(1, '#090a10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    const rad1 = ctx.createRadialGradient(900, 250, 20, 900, 250, 450);
    rad1.addColorStop(0, 'rgba(245, 158, 11, 0.28)');
    rad1.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = rad1;
    ctx.fillRect(0, 0, 1080, 1920);

    const rad2 = ctx.createRadialGradient(180, 1650, 20, 180, 1650, 500);
    rad2.addColorStop(0, 'rgba(14, 165, 233, 0.25)');
    rad2.addColorStop(1, 'rgba(14, 165, 233, 0)');
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

    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 54px sans-serif';
    ctx.fillText('🎬 SINEVIA WRAPPED', 80, 130);

    const periodLabel = period === 'all' ? 'TÜM ZAMANLARIN ÖZETİ' : period === 'year' ? `${currentYear} YILI ÖZETİ` : 'SON 30 GÜNÜN ÖZETİ';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`${periodLabel}  •  SEVİYE ${data.level} (${(data.totalXp || 0).toLocaleString()} XP)`, 80, 185);

    drawBox(80, 230, 920, 210, 32, 'rgba(24, 24, 36, 0.85)', 'rgba(245, 158, 11, 0.4)');
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('SİNEFİL KARAKTERİN & JÜRİ KİMLİĞİN', 120, 285);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 46px sans-serif';
    ctx.fillText(`${stats.persona.icon} ${stats.persona.title}`, 120, 350);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`${stats.criticTitle} (Ort. Puan: ${stats.avgRating.toFixed(1)} / 10)`, 120, 405);

    const cards = [
      { label: 'TOPLAM SÜRE', val: `${stats.totalHours} Saat`, sub: `${stats.totalMins.toLocaleString()} Dakika (${stats.totalDays} Gün)`, color: '#f59e0b' },
      { label: 'İZLENEN FİLM', val: `${stats.movieCount} Film`, sub: `Rekor Seri: ${stats.maxStreak} Gün`, color: '#38bdf8' },
      { label: 'İZLENEN DİZİ', val: `${stats.episodeCount} Bölüm`, sub: `${stats.uniqueSeriesCount} Farklı Dizi`, color: '#a855f7' },
      { label: 'KAZANILAN ROZET', val: `${stats.totalUnlockedTiers} Kupa`, sub: `Seviye ${data.level} Sinefil`, color: '#10b981' },
    ];
    cards.forEach((c, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 80 + col * 475, y = 475 + row * 235;
      drawBox(x, y, 445, 210, 28, 'rgba(20, 20, 30, 0.85)', 'rgba(255, 255, 255, 0.12)');
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(c.label, x + 35, y + 55);
      ctx.fillStyle = c.color;
      ctx.font = '900 52px sans-serif';
      ctx.fillText(c.val, x + 35, y + 125);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(c.sub, x + 35, y + 175);
    });

    drawBox(80, 970, 920, 340, 32, 'rgba(20, 20, 30, 0.85)', 'rgba(56, 189, 248, 0.35)');
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('🧬 SİNEMA DNA’N & FAVORİLERİN', 120, 1025);

    const topGenreText = stats.topGenres.length > 0 ? stats.topGenres.map(([g, cnt]) => `${g} (${cnt})`).join('  •  ') : 'Veri Yok';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(`Favori Türler: ${topGenreText.slice(0, 48)}`, 120, 1090);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`🎥 Favori Yönetmen: ${stats.favDirector ? `${stats.favDirector[0]} (${stats.favDirector[1]} yapım)` : 'Belirlenmedi'}`, 120, 1155);
    ctx.fillText(`🌟 Favori Oyuncu: ${stats.favActor ? `${stats.favActor[0]} (${stats.favActor[1]} yapım)` : 'Belirlenmedi'}`, 120, 1215);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`🏷️ Favori Damgan: ${stats.topTag ? `${stats.topTag[0]} (${stats.topTag[1]} kez)` : 'Henüz seçilmedi'}`, 120, 1275);

    drawBox(80, 1345, 920, 420, 32, 'rgba(20, 20, 30, 0.85)', 'rgba(245, 158, 11, 0.35)');
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('👑 ŞEREF KÜRSÜSÜ (EN YÜKSEK PUANLI YAPIMLARIN)', 120, 1405);

    if (stats.topPicks.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('Henüz puanlanmış yapım bulunmuyor.', 120, 1500);
    } else {
      stats.topPicks.slice(0, 3).forEach((item, idx) => {
        const y = 1485 + idx * 90;
        ctx.fillStyle = '#f59e0b';
        ctx.font = '900 36px sans-serif';
        ctx.fillText(`#${idx + 1}`, 120, y);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 34px sans-serif';
        ctx.fillText(item.title.slice(0, 32), 195, y);
        ctx.fillStyle = '#10b981';
        ctx.font = '900 34px sans-serif';
        ctx.fillText(`★ ${item.rating}/10`, 810, y);
      });
    }

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('SINEVIA  •  Kişisel Film & Dizi Takip Asistanı', 285, 1855);

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `sinevia-wrapped-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    showToast('Wrapped posterin PNG olarak indirildi! Arkadaşlarınla paylaşabilirsin.', 'success');
  };

  const bgThemes = [
    'from-amber-950/90 via-ink-950 to-ink-950',
    'from-cyan-950/90 via-ink-950 to-ink-950',
    'from-purple-950/90 via-ink-950 to-ink-950',
    'from-emerald-950/90 via-ink-950 to-ink-950',
    'from-indigo-950/90 via-ink-950 to-ink-950',
    'from-rose-950/90 via-ink-950 to-ink-950',
    'from-amber-900/80 via-indigo-950 to-ink-950',
  ];

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/90 backdrop-blur-xl p-2 sm:p-4 animate-fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-md h-[92dvh] max-h-[820px] bg-gradient-to-br ${bgThemes[slide]} border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between transition-colors duration-700 select-none`}
      >
        {/* ÜST STORY İLERLEME ÇUBUKLARI */}
        <div className="relative z-30 pt-3.5 px-3.5 space-y-2.5 bg-gradient-to-b from-black/70 to-transparent pb-3">
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => { setSlide(idx); setProgress(0); }}
                className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden cursor-pointer"
              >
                <div
                  className="h-full bg-gold-400 rounded-full transition-all duration-75"
                  style={{
                    width: idx < slide ? '100%' : idx === slide ? `${progress}%` : '0%',
                  }}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            {/* FİLTRE BUTONLARI ARTIK SADECE 1. SLAYTTA GÖZÜKÜR */}
            {slide === 0 ? (
              <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md p-1 rounded-xl border border-white/10 animate-fade-in">
                {([
                  { id: 'all', label: 'Tüm Zamanlar' },
                  { id: 'year', label: `${currentYear}` },
                  { id: 'month', label: 'Son 30 Gün' },
                ] as const).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setPeriod(p.id); setSlide(0); setProgress(0); }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                      period === p.id ? 'bg-gold-500 text-ink-950 shadow-sm' : 'text-ink-300 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xs font-bold text-ink-400 uppercase tracking-widest pl-1">
                Sinevia Wrapped
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/15 flex items-center justify-center transition-colors"
                title={isPaused ? 'Devam Et' : 'Duraklat'}
              >
                {isPaused ? <Play size={14} /> : <Pause size={14} />}
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/15 flex items-center justify-center transition-colors"
                title="Kapat"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* SLAYT İÇERİKLERİ */}
        <div className="relative z-20 flex-1 overflow-y-auto px-6 py-2 flex flex-col justify-center custom-scrollbar">
          {/* SLAYT 0: EKRAN BAŞINDAKİ MESAİN */}
          {slide === 0 && (
            <div className="space-y-6 text-center animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold-500/20 border border-gold-500/40 text-gold-300 text-xs font-black uppercase tracking-widest">
                <Clock size={14} /> Sinevia Zaman Kapsülü
              </div>
              <h2 className="text-3xl font-black text-white leading-tight">
                Ekran Başındaki <span className="text-gold-400">Sinema Mesain</span>
              </h2>

              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 space-y-2 shadow-xl">
                <div className="text-5xl font-black text-gold-400 tracking-tight">
                  {stats.totalMins.toLocaleString('tr-TR')}
                </div>
                <div className="text-xs font-black uppercase tracking-widest text-ink-300">Dakika Kesintisiz İzleme</div>
                <p className="text-xs text-ink-400 pt-2 border-t border-white/10">
                  Hiç uyumadan arka arkaya izleseydin tam <strong className="text-white">{stats.totalHours} saat</strong> ({stats.totalDays} gün) sürerdi!
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
                  <Film size={20} className="text-gold-400 mx-auto mb-1" />
                  <div className="text-2xl font-black text-white">{stats.movieCount}</div>
                  <div className="text-[11px] text-ink-400 font-bold">Film Bitirdin</div>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
                  <Tv size={20} className="text-azure-400 mx-auto mb-1" />
                  <div className="text-2xl font-black text-white">{stats.episodeCount}</div>
                  <div className="text-[11px] text-ink-400 font-bold">Dizi Bölümü ({stats.uniqueSeriesCount} Dizi)</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs font-bold text-orange-300 bg-orange-500/15 border border-orange-500/30 py-2.5 px-4 rounded-2xl">
                <Flame size={16} /> En Uzun Günlük Serin: {stats.maxStreak} Gün Aralıksız!
              </div>
            </div>
          )}

          {/* SLAYT 1: SİNEMA DNA'N */}
          {slide === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-azure-500/20 border border-azure-500/40 text-azure-300 text-xs font-black uppercase tracking-widest">
                  <Sparkles size={13} /> Sinema DNA'n
                </div>
                <h2 className="text-2xl font-black text-white">Seni Sen Yapan Türler & İsimler</h2>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="text-[11px] font-black uppercase tracking-wider text-azure-400">En Çok Tükettiğin Türler</div>
                {stats.topGenres.length === 0 ? (
                  <p className="text-xs text-ink-400">Henüz tür verisi yok.</p>
                ) : (
                  stats.topGenres.map(([g, cnt], i) => (
                    <div key={g} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-white">#{i + 1} {g}</span>
                        <span className="text-azure-300">{cnt} Yapım</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-azure-500 to-teal-400 rounded-full" style={{ width: `${(cnt / stats.maxGenre) * 100}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/40 border border-white/10 rounded-2xl p-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-gold-400 mb-1">
                    <User size={12} /> Favori Yönetmen
                  </div>
                  <div className="text-sm font-black text-white truncate">{stats.favDirector ? stats.favDirector[0] : 'Belirlenmedi'}</div>
                  <div className="text-[11px] text-ink-400">{stats.favDirector ? `${stats.favDirector[1]} yapım izlendi` : '-'}</div>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-2xl p-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-gold-400 mb-1">
                    <Users size={12} /> Favori Oyuncu
                  </div>
                  <div className="text-sm font-black text-white truncate">{stats.favActor ? stats.favActor[0] : 'Belirlenmedi'}</div>
                  <div className="text-[11px] text-ink-400">{stats.favActor ? `${stats.favActor[1]} yapımda rol aldı` : '-'}</div>
                </div>
              </div>

              {stats.topKeywords.length > 0 && (
                <div className="bg-black/40 border border-white/10 rounded-2xl p-3.5">
                  <div className="text-[10px] font-black uppercase text-emerald-400 mb-2">Ruhunu Yansıtan Temalar</div>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.topKeywords.map((kw) => (
                      <span key={kw} className="text-xs font-bold bg-white/10 text-white px-2.5 py-1 rounded-lg">#{kw}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SLAYT 2: ZİRVEDEKİLER */}
          {slide === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-black uppercase tracking-widest">
                  <Crown size={13} /> Başyapıtlar Vitrini
                </div>
                <h2 className="text-2xl font-black text-white">Unutamadığın Zirve Yapımlar</h2>
              </div>

              {stats.topPicks.length === 0 ? (
                <div className="text-center py-12 bg-black/30 rounded-2xl border border-white/10 text-xs text-ink-400">
                  Bu dönemde henüz puanlanmış bir yapım yok.
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.topPicks.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3.5 bg-black/40 border border-white/15 rounded-2xl p-3 shadow-lg">
                      <div className="w-12 h-18 rounded-xl bg-ink-900 overflow-hidden flex-shrink-0 border border-white/10 flex items-center justify-center">
                        {item.posterUrl ? (
                          <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <Film size={20} className="text-ink-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black uppercase text-gold-400">#{idx + 1} En Yüksek Puanlı {item.kind}</div>
                        <div className="text-sm font-black text-white truncate mt-0.5">{item.title}</div>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-gold-500 text-ink-950 font-black text-sm flex items-center gap-1 flex-shrink-0">
                        <Star size={14} className="fill-current" /> {item.rating}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {stats.worstPick && (
                <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <div className="text-[10px] font-black uppercase text-red-400">En Büyük Hayal Kırıklığın 💀</div>
                    <div className="text-xs font-bold text-white truncate mt-0.5">{stats.worstPick.title}</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 font-black text-xs flex-shrink-0">
                    {stats.worstPick.rating} / 10
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SLAYT 3: NASIL BİR ELEŞTİRMENSİN? */}
          {slide === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black uppercase tracking-widest">
                  <SlidersHorizontal size={13} /> Jüri Koltuğu
                </div>
                <h2 className="text-2xl font-black text-white">Nasıl Bir Eleştirmensin?</h2>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-3xl p-5 text-center space-y-2">
                <div className="text-xs font-bold text-ink-400 uppercase">Genel Puan Ortalaman</div>
                <div className="text-4xl font-black text-emerald-400">{stats.avgRating.toFixed(1)} <span className="text-lg text-ink-400">/ 10</span></div>
                <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-white text-xs font-black">{stats.criticTitle}</div>
              </div>

              {stats.topTag && (
                <div className="bg-black/40 border border-gold-500/30 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase text-gold-400 flex items-center gap-1">
                      <Tag size={12} /> En Çok Vurduğun Damga
                    </div>
                    <div className="text-sm font-black text-white mt-1">{stats.topTag[0]}</div>
                  </div>
                  <div className="text-xs font-black bg-gold-500/20 text-gold-300 px-3 py-1.5 rounded-xl">
                    {stats.topTag[1]} Kez
                  </div>
                </div>
              )}

              {stats.critList.length > 0 && (
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-2.5">
                  <div className="text-[10px] font-black uppercase text-azure-400">Detaylı Kriter Karnen</div>
                  {stats.critList.map((c) => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <span className="text-ink-200 font-bold">{c.name}</span>
                      <span className="text-gold-400 font-black">{c.avg.toFixed(1)} / 10</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SLAYT 4: İZLEME KARAKTERİN (PERSONA) */}
          {slide === 4 && (
            <div className="space-y-6 text-center animate-fade-in">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-black uppercase tracking-widest">
                ✨ Sinefil Ruhu
              </div>
              <h2 className="text-2xl font-black text-white">Senin İzleme Karakterin</h2>

              <div className="bg-black/40 border border-white/15 rounded-3xl p-7 space-y-4 shadow-2xl">
                <div className="text-7xl animate-bounce">{stats.persona.icon}</div>
                <div className="text-2xl font-black text-gold-400">{stats.persona.title}</div>
                <p className="text-xs sm:text-sm text-ink-200 leading-relaxed">{stats.persona.desc}</p>
              </div>

              <div className="bg-black/30 border border-white/10 rounded-2xl p-3.5 text-xs text-ink-300">
                Bir günde kırdığın izleme rekoru: <strong className="text-white">{stats.maxDaily} Yapım / Bölüm</strong>
              </div>
            </div>
          )}

          {/* SLAYT 5: ŞÖHRETLER MÜZESİ */}
          {slide === 5 && (
            <div className="space-y-5 text-center animate-fade-in">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black uppercase tracking-widest">
                <Award size={14} /> Şöhretler Müzesi
              </div>
              <h2 className="text-2xl font-black text-white">Seviyen & Koleksiyon Kupaların</h2>

              <div className="bg-black/40 border border-gold-500/40 rounded-3xl p-6 space-y-2 shadow-xl">
                <div className="text-xs font-black uppercase tracking-widest text-gold-400">Ulaştığın Sinevia Seviyesi</div>
                <div className="text-5xl font-black text-white">SEVİYE {data.level}</div>
                <div className="text-xs font-bold text-emerald-400">Toplam {(data.totalXp || 0).toLocaleString('tr-TR')} XP Kazanıldı</div>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-ink-300">Açılan Kupa Kademesi</span>
                  <span className="text-sm font-black text-gold-400">{stats.totalUnlockedTiers} Kupa</span>
                </div>
                {stats.rareBadges.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                    {stats.rareBadges.map((b, i) => (
                      <div key={i} className="bg-white/5 rounded-xl p-2.5 flex items-center gap-2">
                        <span className="text-xl">{b.icon}</span>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-white truncate">{b.name}</div>
                          <div className="text-[9px] font-black uppercase text-gold-400">{b.tier}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SLAYT 6: FİNAL PAYLAŞIM KARTI */}
          {slide === 6 && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-black/55 border-2 border-gold-500/50 rounded-3xl p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-gold-400">🎬 SINEVIA WRAPPED</div>
                    <div className="text-lg font-black text-white mt-0.5">{stats.persona.icon} {stats.persona.title}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black bg-gold-500 text-ink-950 px-2.5 py-1 rounded-lg">LVL {data.level}</div>
                    <div className="text-[10px] text-ink-400 mt-0.5">{(data.totalXp || 0).toLocaleString()} XP</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-left">
                  <div className="bg-white/5 rounded-xl p-2.5">
                    <div className="text-[10px] text-ink-400 font-bold">TOPLAM SÜRE</div>
                    <div className="text-base font-black text-gold-400">{stats.totalHours} Saat <span className="text-[10px] text-ink-300">({stats.totalDays} Gün)</span></div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5">
                    <div className="text-[10px] text-ink-400 font-bold">İZLENEN YAPIM</div>
                    <div className="text-base font-black text-azure-400">{stats.movieCount} Film • {stats.episodeCount} Böl.</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5">
                    <div className="text-[10px] text-ink-400 font-bold">FAVORİ TÜRÜN</div>
                    <div className="text-sm font-black text-white truncate">{stats.topGenres[0]?.[0] || 'Belirlenmedi'}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5">
                    <div className="text-[10px] text-ink-400 font-bold">JÜRİ ORTALAMAN</div>
                    <div className="text-sm font-black text-emerald-400">★ {stats.avgRating.toFixed(1)} / 10</div>
                  </div>
                </div>

                {stats.topPicks.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-gold-400">👑 Zirvedeki Yapımların</div>
                    {stats.topPicks.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-white/5 px-3 py-1.5 rounded-lg">
                        <span className="font-bold text-white truncate pr-2">#{i + 1} {item.title}</span>
                        <span className="font-black text-gold-400 flex-shrink-0">★ {item.rating}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleDownloadImage}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 text-ink-950 font-black py-3.5 rounded-2xl shadow-xl shadow-gold-500/25 transition-all hover:scale-[1.02] text-sm"
              >
                <Download size={18} />
                📸 Story Olarak İndir (PNG) & Paylaş
              </button>
            </div>
          )}
        </div>

        {/* ALT GEZİNME BUTONLARI */}
        <div className="relative z-30 p-4 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent">
          <button
            onClick={() => { prevSlide(); setProgress(0); }}
            disabled={slide === 0}
            className="flex items-center gap-1 text-xs font-bold text-ink-300 hover:text-white disabled:opacity-30 px-3 py-2 rounded-xl bg-white/10"
          >
            <ChevronLeft size={16} /> Önceki
          </button>
          <span className="text-xs font-black text-ink-400">{slide + 1} / {TOTAL_SLIDES}</span>
          <button
            onClick={() => { nextSlide(); setProgress(0); }}
            disabled={slide === TOTAL_SLIDES - 1}
            className="flex items-center gap-1 text-xs font-bold text-ink-950 bg-gold-500 hover:bg-gold-400 disabled:opacity-30 px-3.5 py-2 rounded-xl"
          >
            Sonraki <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}