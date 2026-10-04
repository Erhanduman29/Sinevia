import { useState, useMemo, useEffect } from 'react';
import * as Icons from 'lucide-react';
import {
  Shuffle, Projector, Tv, Sparkles, Trophy, Star, Crown, Search, TrendingUp, Zap,
  Clock, Bot, Dna, PlayCircle, ExternalLink, Youtube, Eye, Calendar, Flame,
  ChevronRight, Target, Film, RefreshCw, User, Users, Shield, Award, Gem, Lock,
  CheckCircle2, Timer, Play, Pause, X, Compass, Layers, Crosshair, ShieldAlert
} from 'lucide-react';
import { useApp, getMovieTimerInfo, PAST_WATCH_COLLECTION_NAME } from '../context/AppContext';
import { useQuests } from '../context/QuestContext';
import { QUEST_DEFS, RARITY_STYLES } from '../lib/quests';
import { levelFromXp } from '../lib/xp';
import { ACHIEVEMENT_DEFS, TIER_COLORS } from '../lib/achievements';
import { getNextUnwatchedEpisode, ratingBgClass, formatDateShort, todayStr, normalize } from '../lib/utils';
import PickModal from '../components/PickModal';
import RatingModal from '../components/RatingModal';
import BulkAddModal from '../components/BulkAddModal';
import DnaSynthesizerModal from '../components/DnaSynthesizerModal';
import MediaDetailModal from '../components/MediaDetailModal';
import type { DetailModalTarget } from '../components/MediaDetailModal';
import type { Movie, Series, Episode, WatchHistoryItem } from '../types';

const RANK_TIERS = [
  {
    minLevel: 1, maxLevel: 4, title: 'Çaylak İzleyici', subtitle: 'Sinema yolculuğunun ilk adımları',
    color: 'text-slate-300', border: 'border-slate-500/40', badgeBg: 'bg-slate-500/15', bgGlow: 'bg-slate-500/15',
    gradient: 'from-slate-500 via-slate-400 to-zinc-300', barGradient: 'from-slate-600 via-slate-400 to-white',
    strokeColor: '#94a3b8', icon: Icons.Film,
  },
  {
    minLevel: 5, maxLevel: 9, title: 'Film Meraklısı', subtitle: 'Kült yapımların ve seçkin hikayelerin kaşifi',
    color: 'text-sky-400', border: 'border-sky-500/40', badgeBg: 'bg-sky-500/15', bgGlow: 'bg-sky-500/20',
    gradient: 'from-blue-600 via-sky-500 to-cyan-300', barGradient: 'from-blue-700 via-sky-500 to-cyan-300',
    strokeColor: '#38bdf8', icon: Icons.Popcorn,
  },
  {
    minLevel: 10, maxLevel: 14, title: 'Düzenli Seyirci', subtitle: 'Sinema artık hayatının ayrılmaz bir parçası',
    color: 'text-emerald-400', border: 'border-emerald-500/40', badgeBg: 'bg-emerald-500/15', bgGlow: 'bg-emerald-500/20',
    gradient: 'from-emerald-600 via-green-500 to-teal-300', barGradient: 'from-emerald-700 via-green-500 to-teal-300',
    strokeColor: '#34d399', icon: Icons.Eye,
  },
  {
    minLevel: 15, maxLevel: 19, title: 'Tutkulu Sinefil', subtitle: 'Yönetmen imzalarını ve alt metinleri okuyan göz',
    color: 'text-violet-400', border: 'border-violet-500/40', badgeBg: 'bg-violet-500/15', bgGlow: 'bg-violet-500/20',
    gradient: 'from-violet-600 via-purple-500 to-fuchsia-400', barGradient: 'from-violet-700 via-purple-500 to-fuchsia-300',
    strokeColor: '#a78bfa', icon: Icons.Heart,
  },
  {
    minLevel: 20, maxLevel: 29, title: 'Sinema Otoritesi', subtitle: 'Eleştirileri ve arşiviyle referans noktası',
    color: 'text-gold-400', border: 'border-gold-500/50', badgeBg: 'bg-gold-500/15', bgGlow: 'bg-gold-500/25',
    gradient: 'from-amber-600 via-gold-500 to-yellow-300', barGradient: 'from-amber-600 via-gold-500 to-yellow-200',
    strokeColor: '#f59e0b', icon: Icons.Award,
  },
  {
    minLevel: 30, maxLevel: 39, title: 'Eleştirmenler Birliği', subtitle: 'Puanları kanun sayılan acımasız vizyoner',
    color: 'text-rose-400', border: 'border-rose-500/50', badgeBg: 'bg-rose-500/15', bgGlow: 'bg-rose-500/30',
    gradient: 'from-red-600 via-rose-500 to-pink-400', barGradient: 'from-red-700 via-rose-500 to-pink-400',
    strokeColor: '#fb7185', icon: Icons.PenTool,
  },
  {
    minLevel: 40, maxLevel: 49, title: 'Sinevia Efsanesi', subtitle: 'Yedinci sanatın zirvesine ulaşmış saygın usta',
    color: 'text-cyan-300', border: 'border-cyan-400/50', badgeBg: 'bg-cyan-500/15', bgGlow: 'bg-cyan-500/25',
    gradient: 'from-cyan-500 via-teal-400 to-emerald-300', barGradient: 'from-cyan-600 via-teal-400 to-emerald-200',
    strokeColor: '#22d3ee', icon: Icons.Crown,
  },
  {
    minLevel: 50, maxLevel: 59, title: 'Evren Fatihi', subtitle: 'Tüm kurgusal evrenlere hükmeden mitik koleksiyoner',
    color: 'text-fuchsia-300', border: 'border-fuchsia-400/60', badgeBg: 'bg-fuchsia-500/20', bgGlow: 'bg-fuchsia-500/35',
    gradient: 'from-fuchsia-600 via-pink-500 to-purple-400', barGradient: 'from-fuchsia-700 via-pink-500 to-purple-300',
    strokeColor: '#f0abfc', icon: Icons.Globe2,
  },
  {
    minLevel: 60, maxLevel: 74, title: 'Kozmik Yönetmen', subtitle: 'Sinema tarihini yeniden yazan yıldızlarüstü irade',
    color: 'text-indigo-300', border: 'border-indigo-400/60', badgeBg: 'bg-indigo-500/20', bgGlow: 'bg-indigo-500/40',
    gradient: 'from-indigo-600 via-blue-500 to-violet-400', barGradient: 'from-indigo-700 via-blue-500 to-violet-300',
    strokeColor: '#818cf8', icon: Icons.Sparkles,
  },
  {
    minLevel: 75, maxLevel: 999, title: 'Sinema Tanrısı', subtitle: 'Ölümsüzlüğe ulaşmış, evrenin nihai ekran yüzü',
    color: 'text-zinc-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]', border: 'border-zinc-200/70', badgeBg: 'bg-zinc-100/20', bgGlow: 'bg-zinc-300/40',
    gradient: 'from-zinc-400 via-zinc-100 to-white', barGradient: 'from-zinc-500 via-zinc-200 to-white',
    strokeColor: '#ffffff', icon: Icons.Gem,
  },
] as const;

export default function HomePage() {
  const {
    data, startWatchingMovie, togglePauseWatchingMovie,
    cancelWatchingMovie, canRateMovieWithTimer, watchMovie, watchEpisode,
  } = useApp();

  const { questState } = useQuests(); 

  const [showBulkAdd, setShowBulkAdd] = useState<'movie' | 'tv' | false>(false);
  const [showPick, setShowPick] = useState(false);
  const [showDnaModal, setShowDnaModal] = useState(false);
  const [spotlightOffset, setSpotlightOffset] = useState(0);
  const [detailTarget, setDetailTarget] = useState<DetailModalTarget | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [pickedItem, setPickedItem] = useState<
    | { kind: 'movie'; movie: Movie }
    | { kind: 'series'; series: Series; episode: Episode }
    | null
  >(null);

  const activeTimerMovie = useMemo(() => data.movies.find((m) => !m.watched && m.startedAt) || null, [data.movies]);

  useEffect(() => {
    if (!activeTimerMovie) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimerMovie]);

  const handleRequestRateMovie = (movie: Movie) => {
    if (!canRateMovieWithTimer(movie.id)) return;
    setPickedItem({ kind: 'movie', movie });
  };

  const pastColIds = useMemo(
    () =>
      new Set(
        data.collections
          .filter((c) => normalize(c.name) === normalize(PAST_WATCH_COLLECTION_NAME))
          .map((c) => c.id)
      ),
    [data.collections]
  );

  const plannedMovieIds = useMemo(() => {
    const ids = new Set<string>();
    (data.weeklyPlan || []).forEach(p => ids.add(p.movieId));
    return ids;
  }, [data.weeklyPlan]);

  const eligibleMovies = useMemo(() => {
    const unwatched = data.movies.filter(
      (m) => !m.watched && (!m.collectionId || !pastColIds.has(m.collectionId)) && !plannedMovieIds.has(m.id)
    );
    const standalone = unwatched.filter((m) => !m.collectionId);
    const collectionGroups = new Map<string, Movie[]>();
    unwatched.filter((m) => m.collectionId).forEach((m) => {
      const arr = collectionGroups.get(m.collectionId!) || [];
      arr.push(m);
      collectionGroups.set(m.collectionId!, arr);
    });
    const sequentialCollectionMovies: Movie[] = [];
    collectionGroups.forEach((movies) => {
      const sorted = [...movies].sort((a, b) => (a.year || '9999').localeCompare(b.year || '9999'));
      if (sorted.length > 0) sequentialCollectionMovies.push(sorted[0]);
    });
    return [...standalone, ...sequentialCollectionMovies];
  }, [data.movies, pastColIds, plannedMovieIds]);

  const allNextEpisodes = useMemo(() => {
    return data.series
      .map((s) => {
        const next = getNextUnwatchedEpisode(s.episodes);
        if (!next) return null;
        const watchedCount = s.episodes.filter((e) => e.watched).length;
        const totalCount = s.episodes.length;
        const pct = totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0;
        return { series: s, episode: next, watchedCount, totalCount, pct };
      })
      .filter((x): x is { series: Series; episode: Episode; watchedCount: number; totalCount: number; pct: number } => x !== null);
  }, [data.series]);

  const ongoingSeries = useMemo(() => {
    return allNextEpisodes.filter((x) => x.watchedCount > 0);
  }, [allNextEpisodes]);

  const spotlightMovie = useMemo(() => {
    if (eligibleMovies.length === 0) return null;
    const dateSeed = todayStr().split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const idx = (dateSeed + spotlightOffset) % eligibleMovies.length;
    return eligibleMovies[idx];
  }, [eligibleMovies, spotlightOffset]);

  const isSpotlightPlanned = useMemo(() => {
    if (!spotlightMovie) return false;
    return (data.weeklyPlan || []).some(p => p.movieId === spotlightMovie.id);
  }, [spotlightMovie, data.weeklyPlan]);

  const quickMetrics = useMemo(() => {
    const watchedMovies = data.movies.filter((m) => m.watched && !m.isPastWatch);
    const movieMinutes = watchedMovies.reduce((sum, m) => {
      const orig = m.runtime || 110;
      const real = m.actualRuntime && m.actualRuntime > 0 ? Math.min(m.actualRuntime, orig) : orig;
      return sum + real;
    }, 0);
    const watchedEpsCount = data.series.reduce((sum, s) => sum + s.episodes.filter((e) => e.watched).length, 0);
    const totalHours = Math.round((movieMinutes + watchedEpsCount * 42) / 60);

    const regularHistory = data.history.filter((h) => !h.isPastWatch);
    const ratedHistory = regularHistory.filter((h) => h.rating !== null);
    const avgRating = ratedHistory.length > 0
      ? (ratedHistory.reduce((sum, h) => sum + (h.rating || 0), 0) / ratedHistory.length).toFixed(1)
      : '-';

    const tierCounts = { bronze: 0, silver: 0, gold: 0, platinum: 0, emerald: 0, diamond: 0, secret: 0, total: 0 };
    (data.achievements || []).forEach((a) => {
      (a.unlockedTiers || []).forEach((t) => {
        if (t in tierCounts) (tierCounts as any)[t]++;
        tierCounts.total++;
      });
    });

    return { totalHours, avgRating, watchedEpsCount, tierCounts, regularHistoryCount: regularHistory.length };
  }, [data.movies, data.series, data.history, data.achievements]);

  const closestAchievements = useMemo(() => {
    const progMap = new Map((data.achievements || []).map((a) => [a.achievementId, a]));
    const candidates: { id: string; name: string; desc: string; icon: string; tier: string; current: number; target: number; pct: number; xp: number }[] = [];

    ACHIEVEMENT_DEFS.forEach((def: any) => {
      if (def.secret && !data.showLockedNames) return;
      const prog = progMap.get(def.id);
      const unlocked = prog?.unlockedTiers || [];
      const current = prog?.current || 0;
      const nextTier = def.tiers.find((t: any) => !unlocked.includes(t.tier));
      if (!nextTier || nextTier.threshold <= 0) return;

      const pct = Math.min(99, Math.floor((current / nextTier.threshold) * 100));
      if (current > 0 && pct >= 15) {
        candidates.push({
          id: `${def.id}_${nextTier.tier}`,
          name: nextTier.name || def.name,
          desc: def.description.replace('{threshold}', String(nextTier.threshold)),
          icon: def.icon, tier: nextTier.tier, current, target: nextTier.threshold, pct, xp: nextTier.xp,
        });
      }
    });

    return candidates.sort((a, b) => b.pct - a.pct).slice(0, 3);
  }, [data.achievements, data.showLockedNames]);

  const recentWatched = useMemo(() => {
    return [...(data.history || [])]
      .filter((h) => !h.isPastWatch)
      .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
      .slice(0, 4);
  }, [data.history]);

  const lvl = levelFromXp(data.totalXp);
  const currentRankIndex = useMemo(() => {
    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
      if (lvl.level >= RANK_TIERS[i].minLevel) return i;
    }
    return 0;
  }, [lvl.level]);

  const userPersona = RANK_TIERS[currentRankIndex];
  const nextRank = RANK_TIERS[currentRankIndex + 1] || null;
  const PersonaIcon = userPersona.icon;

  const circleRadius = 46;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleOffset = circleCircumference - (Math.min(100, Math.max(0, lvl.progress)) / 100) * circleCircumference;

  const navigateTo = (tabId: string) => {
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: tabId }));
  };

  const getMovieWatchLinks = (movie: Movie) => {
    const links: { href: string; text: string; logo: string | null; icon: any; isTrailer?: boolean }[] = [];
    const trailerQuery = encodeURIComponent(`${movie.title} ${movie.year || ''} official trailer fragman`);
    links.push({ href: `https://www.youtube.com/results?search_query=${trailerQuery}`, text: 'Fragman', logo: null, icon: Youtube, isTrailer: true });

    if (movie.customUrl) links.push({ href: movie.customUrl, text: 'Özel Kaynak', logo: null, icon: ExternalLink });

    if (movie.watchProviders && movie.watchProviders.length > 0) {
      movie.watchProviders.slice(0, 2).forEach((provider) => {
        let finalHref = provider.link || '';
        const pName = provider.providerName.toLowerCase();
        if (pName.includes('netflix')) finalHref = `https://www.netflix.com/search?q=${encodeURIComponent(movie.title)}`;
        else if (pName.includes('amazon') || pName.includes('prime')) finalHref = `https://www.primevideo.com/search/ref=atv_sr_sug_1?phrase=${encodeURIComponent(movie.title)}`;
        else if (pName.includes('disney')) finalHref = `https://www.disneyplus.com/search?q=${encodeURIComponent(movie.title)}`;
        else if (pName.includes('blutv')) finalHref = `https://www.blutv.com/arama?q=${encodeURIComponent(movie.title)}`;
        else if (pName.includes('mubi')) finalHref = `https://mubi.com/tr/search?query=${encodeURIComponent(movie.title)}`;
        else if (pName.includes('apple')) finalHref = `https://tv.apple.com/tr/search?q=${encodeURIComponent(movie.title)}`;
        links.push({ href: finalHref, text: provider.providerName, logo: provider.logoUrl, icon: PlayCircle });
      });
    }

    const searchQuery = encodeURIComponent(`${movie.title} ${movie.year || ''} izle`);
    links.push({ href: `https://www.google.com/search?q=${searchQuery}`, text: "Google'da Bul", logo: null, icon: Search });

    if (data.altWatchTemplate && (movie.imdbId || data.altWatchTemplate.includes('{slug}') || data.altWatchTemplate.includes('{title}'))) {
      const charMap: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
      const slug = movie.title.toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, (match) => charMap[match]).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const finalAltHref = data.altWatchTemplate.replace('{imdb}', movie.imdbId || '').replace('{slug}', slug).replace('{title}', encodeURIComponent(movie.title)).replace('{year}', movie.year || '');
      links.push({ href: finalAltHref, text: 'Alternatif', logo: null, icon: PlayCircle });
    }
    return links;
  };

  const openHistoryItemDetail = (h: WatchHistoryItem) => {
    if (h.kind === 'movie' || h.type === 'movie') {
      const found = data.movies.find((m) => m.id === (h.itemId || h.id));
      const fallback: Movie = found || {
        id: h.itemId || h.id, title: h.title, year: h.year || '', genres: h.genres || [], collectionId: null,
        watched: true, isPastWatch: h.isPastWatch, rating: h.rating, detailedRating: h.detailedRating, reviewTags: h.reviewTags, note: h.note, watchedAt: h.watchedAt, addedAt: h.watchedAt,
      };
      setDetailTarget({ type: 'movie', data: fallback, historyItem: h });
    } else {
      const sid = h.seriesId || h.itemId || h.id;
      const found = data.series.find((s) => s.id === sid);
      const fallback: Series = found || { id: sid, title: h.title, year: h.year, genres: h.genres || [], episodes: [], addedAt: h.watchedAt };
      setDetailTarget({ type: 'series', data: fallback, historyItem: h });
    }
  };

  const activeBadgeDef = questState.activeBadgeId ? QUEST_DEFS.find(q => q.id === questState.activeBadgeId) : null;
  const activeQuestDef = questState.activeQuestId ? QUEST_DEFS.find(q => q.id === questState.activeQuestId) : null;

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* =========================================================
          1. SİNEMA PRESTİJ & RÜTBE ARENASI
          ========================================================= */}
      <div className={`relative bg-gradient-to-br from-ink-950 via-ink-900/95 to-ink-950 border ${userPersona.border} rounded-3xl sm:rounded-[2.2rem] p-4 sm:p-8 shadow-2xl overflow-hidden`}>
        <div className={`absolute -top-24 -right-20 w-72 sm:w-96 h-72 sm:h-96 ${userPersona.bgGlow} rounded-full blur-[100px] pointer-events-none transition-all duration-1000`} />
        <div className={`hidden sm:block absolute -bottom-28 -left-20 w-80 h-80 ${userPersona.bgGlow} rounded-full blur-[100px] pointer-events-none transition-all duration-1000`} />
        <div
          className="hidden sm:block absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.8) 1px, transparent 0)', backgroundSize: '24px 24px' }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 sm:pb-5 mb-4 sm:mb-6 border-b border-ink-800/80">
          <div className="flex items-center gap-3 bg-gradient-to-r from-orange-500/20 via-red-500/15 to-amber-500/10 border border-orange-500/40 px-4 py-2 rounded-2xl shadow-[0_0_25px_rgba(249,115,22,0.18)] w-fit">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30 flex-shrink-0">
              <Flame size={20} className="text-white fill-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-black text-white tracking-tight leading-none">
                  {data.dailyStreak || 0} Günlük
                </span>
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-orange-400">
                  İzleme Serisi
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-orange-200/80 mt-0.5">
                {data.dailyStreak > 0 ? '🔥 Alev aldın! Seriyi bozmadan devam et' : 'Bugün bir yapım izleyerek seriyi başlat!'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigateTo('achievements')}
            className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 bg-ink-950/90 hover:bg-ink-900 border border-ink-800 hover:border-gold-500/40 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl transition-all group overflow-x-auto hide-scrollbar"
            title="Başarımlar ve Kupa Kasasına Git"
          >
            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-black whitespace-nowrap">
              <span className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm">
                Bronz: {quickMetrics.tierCounts.bronze}
              </span>
              <span className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-slate-400/15 text-slate-200 border border-slate-400/30 shadow-sm">
                Gümüş: {quickMetrics.tierCounts.silver}
              </span>
              <span className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 shadow-sm">
                Altın: {quickMetrics.tierCounts.gold}
              </span>
              <span className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-cyan-400/15 text-cyan-200 border border-cyan-400/30 shadow-sm">
                Platin: {quickMetrics.tierCounts.platinum}
              </span>
              <span className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
                Zümrüt: {quickMetrics.tierCounts.emerald}
              </span>
              <span className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm">
                Elmas: {quickMetrics.tierCounts.diamond}
              </span>
            </div>
            <ChevronRight size={16} className="text-ink-500 group-hover:text-gold-400 flex-shrink-0 ml-1" />
          </button>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-6 lg:gap-8">
          <div className="flex flex-row items-center gap-4 sm:gap-6 flex-shrink-0 w-full lg:w-auto justify-start">
            <div className="relative w-20 h-20 sm:w-32 sm:h-32 flex items-center justify-center flex-shrink-0">
              <div className={`absolute inset-1 sm:inset-2 rounded-full bg-gradient-to-br ${userPersona.gradient} opacity-25 blur-lg sm:blur-xl animate-pulse`} />
              <svg className="w-20 h-20 sm:w-32 sm:h-32 -rotate-90 transform" viewBox="0 0 108 108">
                <circle cx="54" cy="54" r={circleRadius} stroke="currentColor" strokeWidth="7" fill="transparent" className="text-ink-950" />
                <circle
                  cx="54" cy="54" r={circleRadius} stroke={userPersona.strokeColor} strokeWidth="7"
                  strokeDasharray={circleCircumference} strokeDashoffset={circleOffset} strokeLinecap="round"
                  fill="transparent" className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className={`absolute inset-2.5 sm:inset-4 rounded-full bg-gradient-to-br ${userPersona.gradient} p-0.5 shadow-2xl`}>
                <div className="w-full h-full bg-ink-950 rounded-full flex flex-col items-center justify-center">
                  <PersonaIcon className={`${userPersona.color} w-6 h-6 sm:w-9 sm:h-9`} />
                  <span className="hidden sm:block text-[10px] font-black text-ink-400 uppercase mt-1">
                    %{Math.floor(lvl.progress)}
                  </span>
                </div>
              </div>
              <div className={`hidden sm:block absolute -bottom-2 px-3 py-1 rounded-full bg-gradient-to-r ${userPersona.gradient} text-ink-950 font-black text-sm shadow-lg border border-white/30`}>
                SV. {lvl.level}
              </div>
            </div>

            <div className="text-left flex-1 min-w-0 flex flex-col items-start">
              <div className={`text-xs sm:text-sm font-black uppercase tracking-widest mb-1 truncate ${userPersona.color}`}>
                {userPersona.title}
              </div>
              <div className="text-3xl sm:text-5xl font-black text-ink-50 tracking-tight leading-none mb-4">
                Seviye {lvl.level}
              </div>

              {activeBadgeDef ? (
                <div onClick={() => navigateTo('achievements')} className="inline-flex items-center gap-3 sm:gap-4 bg-ink-900 border border-ink-700/80 px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl shadow-lg group relative transition-transform hover:scale-105 cursor-pointer" title={`${activeBadgeDef.title} (${activeBadgeDef.rarity})`}>
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl border shadow-sm flex-shrink-0 ${RARITY_STYLES[activeBadgeDef.rarity].bg} ${RARITY_STYLES[activeBadgeDef.rarity].border}`}>
                    {activeBadgeDef.icon}
                  </div>
                  <div className="flex flex-col pr-2">
                    <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${RARITY_STYLES[activeBadgeDef.rarity].color} leading-none mb-1`}>
                      {activeBadgeDef.rarity} Rozet
                    </span>
                    <span className="text-sm sm:text-base font-black text-white truncate max-w-[160px] sm:max-w-[200px] leading-tight">
                      {activeBadgeDef.title}
                    </span>
                  </div>
                </div>
              ) : (
                <button onClick={() => navigateTo('achievements')} className="inline-flex items-center gap-3 sm:gap-4 bg-ink-900/50 border border-dashed border-ink-700/50 px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl hover:bg-ink-800 transition-colors">
                  <ShieldAlert size={20} className="text-ink-500" />
                  <span className="text-xs sm:text-sm font-bold text-ink-400">Rozet Yuvası Boş</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 w-full bg-ink-950/70 border border-ink-800/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-inner space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="hidden sm:block text-[10px] sm:text-xs font-black uppercase tracking-widest text-ink-400">Deneyim Puanı (XP) Havuzu</span>
                <div className="text-base sm:text-2xl font-black text-ink-50 flex items-baseline gap-1.5">
                  <span>{(data.totalXp || 0).toLocaleString('tr-TR')} XP</span>
                  <span className="text-xs font-bold text-ink-400">(%{Math.floor(lvl.progress)})</span>
                </div>
              </div>
              <div className="text-right">
                <span className="hidden sm:block text-[10px] sm:text-xs font-black uppercase tracking-widest text-ink-400">Seviye {lvl.level + 1} Hedefi</span>
                <span className={`text-sm sm:text-base font-black ${userPersona.color}`}>
                  {Math.max(0, lvl.nextLevelXp - lvl.currentLevelXp).toLocaleString('tr-TR')} XP Kaldı
                </span>
              </div>
            </div>

            <div className="relative h-4 sm:h-6 w-full bg-ink-900 rounded-lg sm:rounded-xl overflow-hidden border border-ink-700/80 p-0.5 shadow-inner">
              <div className={`h-full rounded-md sm:rounded-lg bg-gradient-to-r ${userPersona.barGradient} transition-all duration-1000 relative overflow-hidden`} style={{ width: `${Math.max(3, lvl.progress)}%` }}>
                <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.35)_50%,transparent_75%)] bg-[length:200%_100%] animate-pulse" />
                <div className="absolute right-0 top-0 bottom-0 w-1 sm:w-1.5 bg-white shadow-[0_0_10px_#fff]" />
              </div>
              <div className="hidden sm:grid absolute inset-0 grid-cols-20 pointer-events-none">
                {Array.from({ length: 20 }).map((_, idx) => (
                  <div key={idx} className="border-r border-ink-950/40 last:border-0" />
                ))}
              </div>
            </div>

            <div className="pt-1 sm:pt-3">
              <div className="flex items-center justify-between text-[10px] sm:text-xs font-black uppercase tracking-wider text-ink-400 sm:mb-2.5">
                <span className="hidden sm:inline">Unvan Evrim Haritası</span>
                {nextRank ? (
                  <span className={userPersona.color}>Sonraki Unvan: {nextRank.title} ({nextRank.minLevel - lvl.level} Seviye Kaldı)</span>
                ) : (
                  <span className="text-cyan-300">Maksimum Unvana Ulaşıldı! 👑</span>
                )}
              </div>
              
              {/* YENİ: KAYAN PENCERE FİLTRESİ (1 Önceki, Şuanki, 2 Sonraki) */}
              <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1">
                {RANK_TIERS.map((tier, idx) => {
                  if (idx < currentRankIndex - 1 || idx > currentRankIndex + 2) return null;

                  const isUnlocked = lvl.level >= tier.minLevel;
                  const isCurrent = idx === currentRankIndex;
                  const TierIcon = tier.icon;
                  
                  return (
                    <div
                      key={tier.title}
                      className={`relative rounded-xl p-2.5 border transition-all flex items-center justify-center gap-2.5 flex-1 min-w-max ${
                        isCurrent ? `${tier.badgeBg} ${tier.border} shadow-md scale-[1.02]` : isUnlocked ? 'bg-ink-900/70 border-ink-800/90 opacity-90' : 'bg-ink-950/40 border-ink-800/40 opacity-45'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isUnlocked ? tier.badgeBg : 'bg-ink-900'}`}>
                        {isUnlocked ? <TierIcon size={16} className={tier.color} /> : <Lock size={14} className="text-ink-500" />}
                      </div>
                      
                      <div className="flex flex-col items-start justify-center">
                        <div className={`text-[11px] sm:text-xs font-black whitespace-nowrap ${isCurrent ? tier.color : isUnlocked ? 'text-ink-100' : 'text-ink-500'}`}>
                          {tier.title}
                        </div>
                        <div className="text-[10px] font-bold text-ink-500 flex items-center gap-1 mt-0.5">
                          <span>Sv. {tier.minLevel}+</span>
                          {isUnlocked && <CheckCircle2 size={10} className="text-emerald-400" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {activeQuestDef && (
          <div className="relative z-10 mt-6 pt-4 border-t border-ink-800/80 animate-fade-in-up">
            <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 bg-ink-950 border-2 rounded-2xl p-3 sm:px-6 sm:py-4 shadow-xl ${RARITY_STYLES[activeQuestDef.rarity].border} ${RARITY_STYLES[activeQuestDef.rarity].bg}`}>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="w-12 h-12 rounded-xl bg-ink-900 border flex items-center justify-center text-2xl flex-shrink-0 shadow-md border-ink-700">
                  {activeQuestDef.icon}
                </div>
                <div className="flex-1">
                  <div className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-0.5 ${RARITY_STYLES[activeQuestDef.rarity].color}`}>
                    <Crosshair size={14} /> AKTİF KONTRAT DEVAM EDİYOR
                  </div>
                  <div className="text-base sm:text-lg font-black text-white drop-shadow-md">{activeQuestDef.title}</div>
                  <div className="text-xs sm:text-sm font-medium text-ink-300 mt-1 max-w-lg leading-relaxed">{activeQuestDef.description}</div>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-ink-300 font-bold bg-ink-900 px-4 py-2 rounded-xl border border-ink-800 w-full sm:w-auto text-center shadow-inner">
                Şartı sağla, <strong className="text-emerald-400 text-sm sm:text-base">+{activeQuestDef.xpReward} XP</strong> kazan.
              </div>
            </div>
          </div>
        )}

        <div className="relative z-10 mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-ink-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <button onClick={() => setShowPick(true)} className="flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-ink-950 px-4 py-3 sm:py-4 rounded-xl font-black text-xs sm:text-sm hover:from-gold-400 hover:to-gold-500 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-gold-500/20 group">
            <Shuffle size={18} className="group-hover:rotate-180 transition-transform duration-500" />
            <span>Ne İzlesem?</span>
          </button>
          <button onClick={() => setShowDnaModal(true)} className="flex items-center justify-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 px-4 py-3 sm:py-4 rounded-xl font-bold text-xs sm:text-sm transition-all hover:scale-[1.02] group">
            <Dna size={18} className="text-emerald-400 group-hover:rotate-45 transition-transform" />
            <span>DNA Sentezle</span>
          </button>
          <button onClick={() => setShowBulkAdd('movie')} className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600/25 via-fuchsia-600/20 to-purple-600/25 hover:from-violet-500/35 hover:to-fuchsia-500/35 text-violet-200 border border-violet-500/40 px-4 py-3 sm:py-4 rounded-xl font-bold text-xs sm:text-sm transition-all hover:scale-[1.02] shadow-lg shadow-violet-500/10 group">
            <Compass size={18} className="text-fuchsia-400 group-hover:rotate-90 transition-transform duration-500" />
            <span>Katalogdan Keşfet</span>
          </button>
          <button onClick={() => navigateTo('ai')} className="flex items-center justify-center gap-2 bg-azure-500/15 hover:bg-azure-500/25 text-azure-300 border border-azure-500/30 px-4 py-3 sm:py-4 rounded-xl font-bold text-xs sm:text-sm transition-all hover:scale-[1.02] group">
            <Bot size={18} className="text-azure-400 group-hover:scale-110 transition-transform" />
            <span>AI Asistan</span>
          </button>
        </div>
      </div>

      {activeTimerMovie && (() => {
        const info = getMovieTimerInfo(activeTimerMovie, nowMs);
        return (
          <div className="bg-gradient-to-r from-emerald-950/85 via-ink-900 to-ink-950 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3.5 shadow-xl animate-fade-in-up">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                <Timer size={22} className={info.isPaused ? 'text-amber-400' : 'text-emerald-400 animate-pulse'} />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2 flex-wrap">
                  <span>{info.isPaused ? '⏸️ Sayaç Duraklatıldı' : '⏳ Canlı Geri Sayım Aktif'}</span>
                  <span className="text-white">• {activeTimerMovie.title}</span>
                </div>
                <div className="text-xs text-ink-300 mt-0.5">
                  Kalan Süre: <strong className="text-emerald-300 font-mono text-sm">{info.formattedRemaining}</strong> • Geçen: <strong>{info.elapsedMins} dk</strong> / {info.maxMins} dk
                  {!info.canRateWithTimer && (
                    <span className="text-amber-400 ml-2">(En az {info.minRequiredMins} dk geçmeden puanlanamaz)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button onClick={() => togglePauseWatchingMovie(activeTimerMovie.id)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-ink-800 hover:bg-ink-700 text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors">
                {info.isPaused ? <><Play size={13} className="fill-current" /> Devam Et</> : <><Pause size={13} /> Duraklat</>}
              </button>
              <button onClick={() => handleRequestRateMovie(activeTimerMovie)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${info.canRateWithTimer ? 'bg-gold-500 hover:bg-gold-400 text-ink-950 shadow-md' : 'bg-ink-800 text-ink-500 border border-ink-700 cursor-not-allowed'}`}>
                {info.canRateWithTimer ? <><Star size={13} className="fill-current" /> Bitir & Puanla</> : <><Lock size={12} /> Kilitli ({info.minRequiredMins - info.elapsedMins} dk)</>}
              </button>
              <button onClick={() => cancelWatchingMovie(activeTimerMovie.id)} title="Sayacı İptal Et" className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })()}

      {spotlightMovie && (() => {
        const isSpotlightTimerActive = activeTimerMovie?.id === spotlightMovie.id;
        const spotlightColName = spotlightMovie.collectionId ? data.collections.find((c) => c.id === spotlightMovie.collectionId)?.name : null;

        return (
          <div className="relative bg-gradient-to-br from-ink-950 via-ink-900/95 to-ink-950 border border-gold-500/35 rounded-[2rem] p-5 sm:p-8 shadow-2xl overflow-hidden animate-fade-in-up">
            {spotlightMovie.posterUrl && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
                <img src={spotlightMovie.posterUrl} alt="" className="w-full h-full object-cover blur-3xl scale-125 saturate-150" />
                <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-ink-950/60" />
              </div>
            )}

            <div className="relative z-10 flex items-center justify-between flex-wrap gap-2 mb-5 pb-3.5 border-b border-ink-800/70">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-gold-500/20 to-amber-500/10 border border-gold-500/40 text-gold-300 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm">
                  <Sparkles size={14} className="text-gold-400" /> Bu Akşamın Vitrin Önerisi
                </div>
                {spotlightColName && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-azure-300 bg-azure-500/15 border border-azure-500/30 px-3 py-1 rounded-full">
                    <Layers size={12} /> {spotlightColName}
                  </span>
                )}
              </div>

              {eligibleMovies.length > 1 && (
                <button onClick={() => setSpotlightOffset((prev) => prev + 1)} className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-200 hover:text-gold-300 bg-ink-900/90 hover:bg-ink-800 px-3.5 py-1.5 rounded-xl border border-ink-700/80 hover:border-gold-500/40 transition-all group">
                  <RefreshCw size={13} className="group-hover:rotate-180 transition-transform duration-500 text-gold-400" /> Başka Film Öner
                </button>
              )}
            </div>

            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center md:items-stretch">
              <button onClick={() => setDetailTarget({ type: 'movie', data: spotlightMovie })} title="Sinema Kartını Gör" className="w-40 sm:w-48 aspect-[2/3] flex-shrink-0 rounded-2xl overflow-hidden bg-ink-950 border-2 border-gold-500/40 shadow-2xl relative group/poster cursor-pointer self-center md:self-start">
                {spotlightMovie.posterUrl ? (
                  <img src={spotlightMovie.posterUrl} alt={spotlightMovie.title} className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-600"><Projector size={40} /></div>
                )}
                <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/poster:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                  <div className="w-10 h-10 rounded-full bg-gold-500 text-ink-950 flex items-center justify-center shadow-lg"><Eye size={19} /></div>
                  <span className="text-[10px] font-black text-white uppercase tracking-wider">Sinema Kartı</span>
                </div>
              </button>

              <div className="flex-1 min-w-0 text-center md:text-left flex flex-col justify-between w-full">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black text-ink-50 tracking-tight leading-tight">{spotlightMovie.title}</h3>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2.5 text-xs text-ink-200 font-semibold">
                      {spotlightMovie.year && <span className="flex items-center gap-1.5 bg-ink-950/80 px-2.5 py-1 rounded-lg border border-ink-800"><Calendar size={13} className="text-gold-400" /> {spotlightMovie.year}</span>}
                      {spotlightMovie.runtime && <span className="flex items-center gap-1.5 bg-ink-950/80 px-2.5 py-1 rounded-lg border border-ink-800"><Clock size={13} className="text-gold-400" /> {spotlightMovie.runtime} dk</span>}
                      {spotlightMovie.directors && spotlightMovie.directors.length > 0 && <span className="flex items-center gap-1.5 bg-ink-950/80 px-2.5 py-1 rounded-lg border border-ink-800"><User size={13} className="text-gold-400" /> {spotlightMovie.directors[0]}</span>}
                      {spotlightMovie.cast && spotlightMovie.cast.length > 0 && <span className="flex items-center gap-1.5 bg-ink-950/80 px-2.5 py-1 rounded-lg border border-ink-800"><Users size={13} className="text-azure-400" /> {spotlightMovie.cast.slice(0, 2).join(', ')}</span>}
                    </div>
                  </div>

                  {spotlightMovie.genres.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5">
                      {spotlightMovie.genres.map((g) => <span key={g} className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-gold-500/15 text-gold-300 border border-gold-500/30">{g}</span>)}
                    </div>
                  )}

                  <div className="bg-ink-950/70 border border-ink-800/90 rounded-2xl p-3.5 text-left shadow-inner">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gold-400/90 mb-1">Film Konusu & Özet</div>
                    {spotlightMovie.overview ? (
                      <div className="max-h-24 sm:max-h-28 overflow-y-auto pr-2 custom-scrollbar text-xs sm:text-sm text-ink-200 leading-relaxed">{spotlightMovie.overview}</div>
                    ) : (
                      <p className="text-xs text-ink-500 italic">Bu film için henüz özet bilgisi çekilmemiş. Filmler sekmesindeki "Eksikleri Bul" butonuyla özeti indirebilirsin.</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-ink-800/70 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5">
                    {getMovieWatchLinks(spotlightMovie).map((link, idx) => {
                      const Icon = link.icon;
                      if (link.isTrailer) return <a key={idx} href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md hover:scale-105"><Icon size={14} /> {link.text}</a>;
                      return <a key={idx} href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-ink-800 hover:bg-ink-700 text-gold-400 border border-gold-500/30 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105">{link.logo ? <img src={link.logo} alt={link.text} className="w-3.5 h-3.5 rounded-sm object-cover" /> : <Icon size={13} />} {link.text}</a>;
                    })}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {isSpotlightPlanned ? (
                      <div 
                        title="Bu film haftalık planda. Puanlamak veya izlemek için Planlayıcı sekmesine gidin."
                        className="flex items-center justify-center gap-1 text-[11px] px-4 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 font-bold w-full md:w-auto whitespace-nowrap cursor-not-allowed"
                      >
                        <Lock size={13} /> Takvime Planlandı
                      </div>
                    ) : (
                      <>
                        {!isSpotlightTimerActive && (
                          <button onClick={() => startWatchingMovie(spotlightMovie.id, false)} disabled={Boolean(activeTimerMovie)} className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all ${activeTimerMovie ? 'bg-ink-900 text-ink-500 border-ink-800 cursor-not-allowed' : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/35'}`} title="Canlı geri sayımı başlat">
                            <Play size={13} className="fill-current" /> Başlat
                          </button>
                        )}
                        <button onClick={() => setDetailTarget({ type: 'movie', data: spotlightMovie })} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-ink-800 hover:bg-ink-700 text-ink-100 border border-ink-700 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all">
                          <Eye size={15} /> Künye
                        </button>
                        <button onClick={() => handleRequestRateMovie(spotlightMovie)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-ink-950 px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-gold-500/20 transition-all hover:scale-105">
                          <Star size={15} className="fill-current" /> Puanla
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {ongoingSeries.length > 0 && (
        <div className="space-y-3 animate-fade-in-up">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base sm:text-lg font-black text-ink-100 flex items-center gap-2">
              <Tv size={20} className="text-azure-400" /> İzlemeye Devam Et
              <span className="text-xs font-bold bg-azure-500/20 text-azure-300 px-2.5 py-0.5 rounded-full border border-azure-500/30">{ongoingSeries.length} Devam Eden Dizi</span>
            </h2>
            <button onClick={() => navigateTo('series')} className="text-xs font-bold text-azure-400 hover:underline flex items-center gap-1">Tüm Diziler <ChevronRight size={14} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {ongoingSeries.slice(0, 6).map(({ series, episode, watchedCount, totalCount, pct }) => (
              <div key={series.id} className="bg-ink-900/70 backdrop-blur-sm border border-ink-700/60 hover:border-azure-500/40 rounded-2xl p-3.5 flex gap-3.5 items-center shadow-lg transition-all group">
                <button onClick={() => setDetailTarget({ type: 'series', data: series })} title="Sinema Kartını Gör" className="w-16 aspect-[2/3] flex-shrink-0 rounded-xl overflow-hidden bg-ink-950 border border-ink-700/60 relative group/poster cursor-pointer">
                  {series.posterUrl ? <img src={series.posterUrl} alt={series.title} className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center text-ink-600"><Tv size={20} /></div>}
                  <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/poster:opacity-100 transition-opacity flex items-center justify-center"><Eye size={16} className="text-azure-400" /></div>
                </button>

                <div className="flex-1 min-w-0">
                  <button onClick={() => setDetailTarget({ type: 'series', data: series })} className="font-black text-sm text-ink-100 hover:text-azure-400 truncate block text-left w-full transition-colors">{series.title}</button>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-azure-300 bg-azure-500/15 border border-azure-500/30 px-2 py-0.5 rounded-md mt-1"><span>Sıradaki: {episode.season}. Sezon {episode.episode}. Bölüm</span></div>
                  <div className="mt-2.5 space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-ink-400"><span>{watchedCount} / {totalCount} Bölüm</span><span className="text-azure-400">%{pct}</span></div>
                    <div className="h-1.5 w-full bg-ink-950 rounded-full overflow-hidden border border-ink-800"><div className="h-full bg-gradient-to-r from-azure-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${Math.max(4, pct)}%` }} /></div>
                  </div>
                  <button onClick={() => setPickedItem({ kind: 'series', series, episode })} className="mt-2.5 w-full py-1.5 px-3 rounded-lg bg-azure-500/20 hover:bg-azure-500 text-azure-300 hover:text-white border border-azure-500/30 text-xs font-black transition-all flex items-center justify-center gap-1.5"><Star size={12} className="fill-current" /> Bölümü Puanla</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={() => navigateTo('movies')} className="group relative overflow-hidden flex flex-col items-center justify-center bg-ink-900/60 border border-ink-700/50 rounded-2xl p-5 text-center shadow-lg hover:border-gold-500/40 transition-all hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Projector size={26} className="text-gold-400 mb-2 group-hover:scale-110 transition-transform duration-300" />
          <div className="text-3xl font-black text-ink-100">{data.movies.length}</div>
          <div className="text-xs font-semibold text-ink-500 tracking-wider uppercase mt-1 group-hover:text-gold-400/80 transition-colors">Film Arşivi</div>
        </button>

        <button onClick={() => navigateTo('series')} className="group relative overflow-hidden flex flex-col items-center justify-center bg-ink-900/60 border border-ink-700/50 rounded-2xl p-5 text-center shadow-lg hover:border-azure-500/40 transition-all hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-azure-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Tv size={26} className="text-azure-400 mb-2 group-hover:scale-110 transition-transform duration-300" />
          <div className="text-3xl font-black text-ink-100">{data.series.length}</div>
          <div className="text-xs font-semibold text-ink-500 tracking-wider uppercase mt-1 group-hover:text-azure-400/80 transition-colors">Dizi Arşivi</div>
        </button>

        <button onClick={() => navigateTo('history')} className="group relative overflow-hidden flex flex-col items-center justify-center bg-ink-900/60 border border-ink-700/50 rounded-2xl p-5 text-center shadow-lg hover:border-violet-500/40 transition-all hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Clock size={26} className="text-violet-400 mb-2 group-hover:scale-110 transition-transform duration-300" />
          <div className="text-3xl font-black text-ink-100">{quickMetrics.regularHistoryCount}</div>
          <div className="text-xs font-semibold text-ink-500 tracking-wider uppercase mt-1 group-hover:text-violet-400/80 transition-colors">Geçmiş</div>
        </button>

        <button onClick={() => navigateTo('achievements')} className="group relative overflow-hidden flex flex-col items-center justify-center bg-ink-900/60 border border-ink-700/50 rounded-2xl p-5 text-center shadow-lg hover:border-emerald-500/40 transition-all hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Trophy size={26} className="text-emerald-400 mb-2 group-hover:scale-110 transition-transform duration-300" />
          <div className="text-3xl font-black text-ink-100">{quickMetrics.tierCounts.total}</div>
          <div className="text-xs font-semibold text-ink-500 tracking-wider uppercase mt-1 group-hover:text-emerald-400/80 transition-colors">Başarımlar</div>
        </button>
      </div>

      {(closestAchievements.length > 0 || recentWatched.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {closestAchievements.length > 0 && (
            <div className="bg-ink-900/60 border border-ink-700/60 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-ink-100 flex items-center gap-2"><Target size={18} className="text-gold-400" /> Kazanmaya En Yakın Kupalar</h3>
                <button onClick={() => navigateTo('achievements')} className="text-xs font-bold text-gold-400 hover:underline flex items-center gap-1">Tümü <ChevronRight size={14} /></button>
              </div>
              <div className="space-y-3">
                {closestAchievements.map((ach) => {
                  const tierInfo = (TIER_COLORS as any)[ach.tier];
                  const AchIcon = (Icons as any)[ach.icon] || Trophy;
                  return (
                    <div key={ach.id} className="bg-ink-950/70 border border-ink-800/80 rounded-2xl p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tierInfo?.bg || 'bg-ink-800'}`}>
                            <AchIcon size={17} className={tierInfo?.text || 'text-gold-400'} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-ink-100 truncate">{ach.name}</div>
                            <div className="text-[11px] text-ink-400 truncate">{ach.desc}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-gold-400 bg-gold-500/10 border border-gold-500/20 px-2 py-0.5 rounded-md flex-shrink-0">+{ach.xp} XP</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-ink-400"><span>İlerleme: {ach.current} / {ach.target}</span><span className="text-gold-400">%{ach.pct}</span></div>
                        <div className="h-1.5 w-full bg-ink-900 rounded-full overflow-hidden border border-ink-800"><div className={`h-full rounded-full ${tierInfo?.bg || 'bg-gold-500'}`} style={{ width: `${ach.pct}%` }} /></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {recentWatched.length > 0 && (
            <div className="bg-ink-900/60 border border-ink-700/60 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-ink-100 flex items-center gap-2"><Clock size={18} className="text-azure-400" /> Son İzlenenler & Günlük</h3>
                <button onClick={() => navigateTo('history')} className="text-xs font-bold text-azure-400 hover:underline flex items-center gap-1">Tüm Geçmiş <ChevronRight size={14} /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentWatched.map((h) => {
                  const isMovie = h.kind === 'movie' || h.type === 'movie';
                  const poster = isMovie ? data.movies.find((m) => m.id === (h.itemId || h.id))?.posterUrl : data.series.find((s) => s.id === (h.seriesId || h.itemId || h.id))?.posterUrl;
                  return (
                    <button key={h.id} type="button" onClick={() => openHistoryItemDetail(h)} className="bg-ink-950/70 hover:bg-ink-800/60 border border-ink-800/80 hover:border-gold-500/30 rounded-2xl p-3 flex items-center gap-3 text-left transition-all group">
                      <div className="w-11 aspect-[2/3] rounded-lg overflow-hidden bg-ink-900 border border-ink-700/60 flex-shrink-0 relative">
                        {poster ? <img src={poster} alt={h.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-ink-600">{isMovie ? <Film size={15} /> : <Tv size={15} />}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black text-ink-100 truncate group-hover:text-gold-400 transition-colors">{h.title}</div>
                        <div className="text-[10px] text-ink-400 mt-0.5 truncate">{h.season != null ? `${h.season}. Sezon ${h.episode}. Bölüm` : h.year || 'Film'}</div>
                        <div className="text-[10px] text-ink-500 mt-1">{formatDateShort(h.watchedAt)}</div>
                      </div>
                      {h.rating !== null && <span className={`text-xs px-2 py-1 rounded-lg font-black flex-shrink-0 ${ratingBgClass(h.rating)}`}>{h.rating}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-r from-azure-900/30 via-indigo-900/30 to-ink-900/40 border border-azure-700/40 rounded-[2rem] p-6 flex flex-col justify-between gap-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-azure-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-azure-500 to-indigo-600 p-0.5 shadow-lg shadow-azure-500/30 shrink-0">
              <div className="w-full h-full bg-ink-950 rounded-[14px] flex items-center justify-center"><Bot className="text-azure-400" size={28} /></div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-azure-400 mb-1 flex items-center gap-1.5"><Sparkles size={12} /> Yeni Nesil Özellik</div>
              <h3 className="text-xl font-black text-ink-50 mb-1 tracking-tight">Sinevia AI ile Tanış</h3>
              <p className="text-xs sm:text-sm text-ink-300 leading-relaxed">Ne izleyeceğini bulamıyor musun? Asistanına nasıl bir şey aradığını söyle, sana özel yapımları anında kütüphanene eklesin.</p>
            </div>
          </div>
          <button onClick={() => navigateTo('ai')} className="w-full bg-gradient-to-r from-azure-600 to-indigo-600 hover:from-azure-500 hover:to-indigo-500 text-white font-black py-3.5 px-6 rounded-xl shadow-lg shadow-azure-500/25 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 relative z-10 text-sm">
            <Bot size={18} /> Asistanla Sohbet Et
          </button>
        </div>

        <div className="bg-gradient-to-r from-emerald-900/30 via-teal-900/30 to-ink-900/40 border border-emerald-700/40 rounded-[2rem] p-6 flex flex-col justify-between gap-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-0.5 shadow-lg shadow-emerald-500/30 shrink-0">
              <div className="w-full h-full bg-ink-950 rounded-[14px] flex items-center justify-center"><Dna className="text-emerald-400" size={28} /></div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1 flex items-center gap-1.5"><Sparkles size={12} /> Çapraz Tavsiye Motoru</div>
              <h3 className="text-xl font-black text-ink-50 mb-1 tracking-tight">Film DNA Laboratuvarı</h3>
              <p className="text-xs sm:text-sm text-ink-300 leading-relaxed">İki favori filmini seç, DNA'larını çaprazla ve genetik olarak sana en uygun yapımı kütüphanenden sentezle.</p>
            </div>
          </div>
          <button onClick={() => setShowDnaModal(true)} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 relative z-10 text-sm">
            <Dna size={18} /> DNA Sentezle
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-5 pl-2"><Sparkles className="text-gold-400" size={22} /><h3 className="text-lg sm:text-xl font-bold text-ink-50">Sistem Nasıl Çalışır?</h3></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-ink-900/40 backdrop-blur-sm border border-ink-700/40 rounded-2xl p-5 hover:bg-ink-800/40 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 border border-blue-500/20 group-hover:scale-110 transition-transform"><Search size={20} className="text-blue-400" /></div>
            <h4 className="font-bold text-ink-50 mb-2">1. Ara ve Seç</h4>
            <p className="text-sm text-ink-400 leading-relaxed">Katalogdan veya yapay zeka asistanıyla filmleri bul, sepetine at ve arşivle.</p>
          </div>
          <div className="bg-ink-900/40 backdrop-blur-sm border border-ink-700/40 rounded-2xl p-5 hover:bg-ink-800/40 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center mb-4 border border-gold-500/20 group-hover:scale-110 transition-transform"><Shuffle size={20} className="text-gold-400" /></div>
            <h4 className="font-bold text-ink-50 mb-2">2. Karar Veremiyor Musun?</h4>
            <p className="text-sm text-ink-400 leading-relaxed">Kütüphanenden seçtiğin türlere ve süreye göre çarkı çevir, izleyeceğin yapımı belirle.</p>
          </div>
          <div className="bg-ink-900/40 backdrop-blur-sm border border-ink-700/40 rounded-2xl p-5 hover:bg-ink-800/40 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/20 group-hover:scale-110 transition-transform"><Star size={20} className="text-emerald-400" /></div>
            <h4 className="font-bold text-ink-50 mb-2">3. Puanla ve Arşivle</h4>
            <p className="text-sm text-ink-400 leading-relaxed">İzlediğin yapımlara 10 üzerinden puan ver, değerlendirme başlıklarını ve notlarını kaydet.</p>
          </div>
          <div className="bg-ink-900/40 backdrop-blur-sm border border-ink-700/40 rounded-2xl p-5 hover:bg-ink-800/40 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4 border border-violet-500/20 group-hover:scale-110 transition-transform"><TrendingUp size={20} className="text-violet-400" /></div>
            <h4 className="font-bold text-ink-50 mb-2">4. Seviye Atla</h4>
            <p className="text-sm text-ink-400 leading-relaxed">İzledikçe XP kazan, gizli başarımları aç ve profilini bir Sinevia Efsanesine dönüştür.</p>
          </div>
        </div>
      </div>

      {showBulkAdd && <BulkAddModal initialTab={showBulkAdd} onClose={() => setShowBulkAdd(false)} />}
      {showPick && <PickModal movieCount={eligibleMovies.length} seriesCount={allNextEpisodes.length} unwatchedMovies={eligibleMovies} nextEpisodes={allNextEpisodes} onPick={(item) => setPickedItem(item)} onClose={() => setShowPick(false)} />}
      {showDnaModal && <DnaSynthesizerModal onClose={() => setShowDnaModal(false)} />}
      {pickedItem && (
        <RatingModal title={pickedItem.kind === 'movie' ? pickedItem.movie.title : pickedItem.series.title} subtitle={pickedItem.kind === 'movie' ? pickedItem.movie.year ? `Çıkış Yılı: ${pickedItem.movie.year}` : 'Film' : `${pickedItem.episode.season}. Sezon ${pickedItem.episode.episode}. Bölüm`} initialIsPastWatch={pickedItem.kind === 'movie' ? Boolean(pickedItem.movie.isPastWatch) : false} allowPastWatch={pickedItem.kind === 'movie'} onRate={(rating, note, detailedRating, reviewTags, isPastWatch) => { if (pickedItem.kind === 'movie') { watchMovie(pickedItem.movie.id, rating, note, detailedRating, reviewTags, isPastWatch); } else { watchEpisode(pickedItem.series.id, pickedItem.episode.id, rating, note, detailedRating, reviewTags); } setPickedItem(null); }} onClose={() => setPickedItem(null)} />
      )}
      {detailTarget && <MediaDetailModal target={detailTarget} onClose={() => setDetailTarget(null)} />}
    </div>
  );
}