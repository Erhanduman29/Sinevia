import { useState, useMemo, useEffect, useCallback } from 'react';
import * as Icons from 'lucide-react';
import {
  Shuffle, Projector, Tv, Sparkles, Trophy, Star, Crown, Search, TrendingUp, Zap,
  Clock, Bot, Dna, PlayCircle, ExternalLink, Youtube, Eye, Calendar, Flame,
  ChevronRight, Target, Film, RefreshCw, User, Users, Shield, Award, Gem, Lock,
  CheckCircle2, Timer, Play, Pause, X, Compass, Layers, Crosshair, ShieldAlert,
  Activity, CheckSquare, ListVideo, Medal, LayoutGrid, Copy
} from 'lucide-react';
import { useApp, getMovieTimerInfo, PAST_WATCH_COLLECTION_NAME } from '../context/AppContext';
import { useQuests } from '../context/QuestContext';
import { QUEST_DEFS, RARITY_STYLES } from '../lib/quests';
import { levelFromXp } from '../lib/xp';
import { ACHIEVEMENT_DEFS, TIER_COLORS } from '../lib/achievements';
import { getNextUnwatchedEpisode, ratingBgClass, formatDateShort, todayStr, normalize } from '../lib/utils';
import { supabase } from '../lib/supabase';
import PickModal from '../components/PickModal';
import RatingModal from '../components/RatingModal';
import BulkAddModal from '../components/BulkAddModal';
import DnaSynthesizerModal from '../components/DnaSynthesizerModal';
import MediaDetailModal from '../components/MediaDetailModal';
import type { DetailModalTarget } from '../components/MediaDetailModal';
import type { Movie, Series, Episode, WatchHistoryItem } from '../types';

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'Az önce';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} dk önce`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} saat önce`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} gün önce`;
  return date.toLocaleDateString('tr-TR');
}

const RANK_TIERS = [
  { minLevel: 1, maxLevel: 4, title: 'Çaylak İzleyici', subtitle: 'Sinema yolculuğunun ilk adımları', color: 'text-slate-300', border: 'border-slate-500/40', badgeBg: 'bg-slate-500/15', bgGlow: 'bg-slate-500/15', gradient: 'from-slate-500 via-slate-400 to-zinc-300', barGradient: 'from-slate-600 via-slate-400 to-white', strokeColor: '#94a3b8', icon: Icons.Film },
  { minLevel: 5, maxLevel: 9, title: 'Film Meraklısı', subtitle: 'Kült yapımların ve seçkin hikayelerin kaşifi', color: 'text-sky-400', border: 'border-sky-500/40', badgeBg: 'bg-sky-500/15', bgGlow: 'bg-sky-500/20', gradient: 'from-blue-600 via-sky-500 to-cyan-300', barGradient: 'from-blue-700 via-sky-500 to-cyan-300', strokeColor: '#38bdf8', icon: Icons.Popcorn },
  { minLevel: 10, maxLevel: 14, title: 'Düzenli Seyirci', subtitle: 'Sinema artık hayatının ayrılmaz bir parçası', color: 'text-emerald-400', border: 'border-emerald-500/40', badgeBg: 'bg-emerald-500/15', bgGlow: 'bg-emerald-500/20', gradient: 'from-emerald-600 via-green-500 to-teal-300', barGradient: 'from-emerald-700 via-green-500 to-teal-300', strokeColor: '#34d399', icon: Icons.Eye },
  { minLevel: 15, maxLevel: 19, title: 'Tutkulu Sinefil', subtitle: 'Yönetmen imzalarını ve alt metinleri okuyan göz', color: 'text-violet-400', border: 'border-violet-500/40', badgeBg: 'bg-violet-500/15', bgGlow: 'bg-violet-500/20', gradient: 'from-violet-600 via-purple-500 to-fuchsia-400', barGradient: 'from-violet-700 via-purple-500 to-fuchsia-300', strokeColor: '#a78bfa', icon: Icons.Heart },
  { minLevel: 20, maxLevel: 29, title: 'Sinema Otoritesi', subtitle: 'Eleştirileri ve arşiviyle referans noktası', color: 'text-gold-400', border: 'border-gold-500/50', badgeBg: 'bg-gold-500/15', bgGlow: 'bg-gold-500/25', gradient: 'from-amber-600 via-gold-500 to-yellow-300', barGradient: 'from-amber-600 via-gold-500 to-yellow-200', strokeColor: '#f59e0b', icon: Icons.Award },
  { minLevel: 30, maxLevel: 39, title: 'Eleştirmenler Birliği', subtitle: 'Puanları kanun sayılan acımasız vizyoner', color: 'text-rose-400', border: 'border-rose-500/50', badgeBg: 'bg-rose-500/15', bgGlow: 'bg-rose-500/30', gradient: 'from-red-600 via-rose-500 to-pink-400', barGradient: 'from-red-700 via-rose-500 to-pink-400', strokeColor: '#fb7185', icon: Icons.PenTool },
  { minLevel: 40, maxLevel: 49, title: 'Sinevia Efsanesi', subtitle: 'Yedinci sanatın zirvesine ulaşmış saygın usta', color: 'text-cyan-300', border: 'border-cyan-400/50', badgeBg: 'bg-cyan-500/15', bgGlow: 'bg-cyan-500/25', gradient: 'from-cyan-500 via-teal-400 to-emerald-300', barGradient: 'from-cyan-600 via-teal-400 to-emerald-200', strokeColor: '#22d3ee', icon: Icons.Crown },
  { minLevel: 50, maxLevel: 59, title: 'Evren Fatihi', subtitle: 'Tüm kurgusal evrenlere hükmeden mitik koleksiyoner', color: 'text-fuchsia-300', border: 'border-fuchsia-400/60', badgeBg: 'bg-fuchsia-500/20', bgGlow: 'bg-fuchsia-500/35', gradient: 'from-fuchsia-600 via-pink-500 to-purple-400', barGradient: 'from-fuchsia-700 via-pink-500 to-purple-300', strokeColor: '#f0abfc', icon: Icons.Globe2 },
  { minLevel: 60, maxLevel: 74, title: 'Kozmik Yönetmen', subtitle: 'Sinema tarihini yeniden yazan yıldızlarüstü irade', color: 'text-indigo-300', border: 'border-indigo-400/60', badgeBg: 'bg-indigo-500/20', bgGlow: 'bg-indigo-500/40', gradient: 'from-indigo-600 via-blue-500 to-violet-400', barGradient: 'from-indigo-700 via-blue-500 to-violet-300', strokeColor: '#818cf8', icon: Icons.Sparkles },
  { minLevel: 75, maxLevel: 999, title: 'Sinema Tanrısı', subtitle: 'Ölümsüzlüğe ulaşmış, evrenin nihai ekran yüzü', color: 'text-zinc-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]', border: 'border-zinc-200/70', badgeBg: 'bg-zinc-100/20', bgGlow: 'bg-zinc-300/40', gradient: 'from-zinc-400 via-zinc-100 to-white', barGradient: 'from-zinc-500 via-zinc-200 to-white', strokeColor: '#ffffff', icon: Icons.Gem },
] as const;

export default function HomePage() {
  const {
    data, startWatchingMovie, togglePauseWatchingMovie,
    cancelWatchingMovie, canRateMovieWithTimer, watchMovie, watchEpisode, showToast
  } = useApp();

  const { questState } = useQuests(); 

  const [showBulkAdd, setShowBulkAdd] = useState<'movie' | 'tv' | false>(false);
  const [showPick, setShowPick] = useState(false);
  const [showDnaModal, setShowDnaModal] = useState(false);
  const [spotlightOffset, setSpotlightOffset] = useState(0);
  const [detailTarget, setDetailTarget] = useState<DetailModalTarget | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [networkFeed, setNetworkFeed] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
  const [networkLoading, setNetworkLoading] = useState(true);

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

  const fetchNetworkFeed = useCallback(async () => {
    if (!data.agentId) { setNetworkLoading(false); return; }
    try {
      const { data: fData } = await supabase.from('friendships').select('*').or(`requester_id.eq.${data.agentId},receiver_id.eq.${data.agentId}`).eq('status', 'accepted');
      if (!fData || fData.length === 0) { setNetworkFeed([]); setNetworkLoading(false); return; }
      
      const friendIds = fData.map(f => f.requester_id === data.agentId ? f.receiver_id : f.requester_id);
      
      const { data: pData } = await supabase.from('profiles').select('*').in('agent_id', friendIds);
      const pMap: Record<string, any> = {};
      (pData || []).forEach(p => pMap[p.agent_id] = p);
      setProfilesMap(pMap);

      const { data: logsData } = await supabase.from('network_logs').select('*').in('agent_id', friendIds).order('created_at', { ascending: false }).limit(6);
      setNetworkFeed(logsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setNetworkLoading(false);
    }
  }, [data.agentId]);

  useEffect(() => {
    fetchNetworkFeed();
  }, [fetchNetworkFeed]);

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
    const watchedMoviesCount = data.movies.filter((m) => m.watched && !m.isPastWatch).length;
    const watchedEpsCount = data.series.reduce((sum, s) => sum + s.episodes.filter((e) => e.watched).length, 0);
    const unlockedAchievementsCount = data.achievements.reduce((acc, curr) => acc + (curr.unlockedTiers?.length || 0), 0);

    let questsCompleted = 0;
    try { 
      const qsRaw = localStorage.getItem('sinevia-quests-v1');
      if (qsRaw) {
         const qs = JSON.parse(qsRaw);
         questsCompleted = (qs.completedQuests && Array.isArray(qs.completedQuests)) ? qs.completedQuests.length : 0; 
      }
    } catch (e) { console.warn(e); }

    const tierCounts = { bronze: 0, silver: 0, gold: 0, platinum: 0, emerald: 0, diamond: 0, secret: 0, total: 0 };
    (data.achievements || []).forEach((a) => {
      (a.unlockedTiers || []).forEach((t) => {
        if (t in tierCounts) (tierCounts as any)[t]++;
        tierCounts.total++;
      });
    });

    const regularHistoryCount = data.history.filter((h) => !h.isPastWatch).length;

    return { tierCounts, watchedMoviesCount, watchedEpsCount, unlockedAchievementsCount, questsCompleted, regularHistoryCount };
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
      .slice(0, 5); // Maksimum 5 tane alıyoruz ki tek satıra sığsın
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
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-10 max-w-[1400px] mx-auto">
      
      {/* =========================================================
          1. EFSANEVİ BİRLEŞİK KAHRAMAN (HERO) KARTI (PROFIL + BAR)
          ========================================================= */}
      <div className={`relative bg-gradient-to-br from-ink-950 via-ink-900/95 to-ink-950 border ${userPersona.border} rounded-[2rem] p-5 sm:p-8 shadow-2xl overflow-hidden`}>
        {/* Arka plan ışıkları */}
        <div className={`absolute -top-24 -right-20 w-72 h-72 sm:w-96 sm:h-96 ${userPersona.bgGlow} rounded-full blur-[100px] pointer-events-none opacity-60 transition-all duration-1000`} />
        <div className={`hidden sm:block absolute -bottom-28 -left-20 w-80 h-80 ${userPersona.bgGlow} rounded-full blur-[100px] pointer-events-none transition-all duration-1000`} />
        <div className="hidden sm:block absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.8) 1px, transparent 0)', backgroundSize: '24px 24px' }} />

        {/* ÜST: Streak ve Başarımlar */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 sm:pb-5 mb-4 sm:mb-6 border-b border-ink-800/80">
          <div className="flex items-center gap-3 bg-gradient-to-r from-orange-500/20 via-red-500/15 to-amber-500/10 border border-orange-500/40 px-4 py-2 rounded-2xl shadow-[0_0_25px_rgba(249,115,22,0.18)] w-fit">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30 flex-shrink-0">
              <Flame size={20} className="text-white fill-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-black text-white tracking-tight leading-none">{data.dailyStreak || 0} Günlük</span>
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-orange-400">İzleme Serisi</span>
              </div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-orange-200/80 mt-0.5">{data.dailyStreak > 0 ? '🔥 Alev aldın! Seriyi bozmadan devam et' : 'Bugün bir yapım izleyerek seriyi başlat!'}</div>
            </div>
          </div>

          <button onClick={() => navigateTo('achievements')} className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 bg-ink-950/90 hover:bg-ink-900 border border-ink-800 hover:border-gold-500/40 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl transition-all group overflow-x-auto hide-scrollbar">
            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-black whitespace-nowrap">
              <span className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm">Bronz: {quickMetrics.tierCounts.bronze}</span>
              <span className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-slate-400/15 text-slate-200 border border-slate-400/30 shadow-sm">Gümüş: {quickMetrics.tierCounts.silver}</span>
              <span className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 shadow-sm">Altın: {quickMetrics.tierCounts.gold}</span>
              <span className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-cyan-400/15 text-cyan-200 border border-cyan-400/30 shadow-sm">Platin: {quickMetrics.tierCounts.platinum}</span>
              <span className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">Zümrüt: {quickMetrics.tierCounts.emerald}</span>
              <span className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm">Elmas: {quickMetrics.tierCounts.diamond}</span>
            </div>
            <ChevronRight size={16} className="text-ink-500 group-hover:text-gold-400 flex-shrink-0 ml-1" />
          </button>
        </div>

        {/* ORTA: Avatar, SVG Çember, İsim, Stats */}
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-6 lg:gap-8">
          <div className="flex flex-row items-center gap-4 sm:gap-6 flex-shrink-0 w-full lg:w-auto justify-start">
            
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 flex items-center justify-center flex-shrink-0">
              <div className={`absolute inset-1 sm:inset-2 rounded-full bg-gradient-to-br ${userPersona.gradient} opacity-25 blur-lg sm:blur-xl animate-pulse`} />
              <svg className="w-24 h-24 sm:w-32 sm:h-32 -rotate-90 transform" viewBox="0 0 108 108">
                <circle cx="54" cy="54" r={circleRadius} stroke="currentColor" strokeWidth="7" fill="transparent" className="text-ink-950" />
                <circle cx="54" cy="54" r={circleRadius} stroke={userPersona.strokeColor} strokeWidth="7" strokeDasharray={circleCircumference} strokeDashoffset={circleOffset} strokeLinecap="round" fill="transparent" className="transition-all duration-1000 ease-out" />
              </svg>
              <div className={`absolute inset-2.5 sm:inset-4 rounded-full bg-gradient-to-br ${userPersona.gradient} p-0.5 shadow-2xl`}>
                <div className="w-full h-full bg-ink-950 rounded-full flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="text-3xl sm:text-5xl font-black text-white drop-shadow-md z-10">{data.nickname?.[0]?.toUpperCase() || 'U'}</span>
                  <PersonaIcon className={`absolute opacity-20 ${userPersona.color} w-16 h-16 sm:w-24 sm:h-24`} />
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
              <div className="text-2xl sm:text-4xl font-black text-ink-50 tracking-tight leading-none mb-3 truncate max-w-full">
                {data.nickname}
              </div>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="text-[10px] text-ink-400 font-mono bg-ink-950/80 px-2 py-1 rounded border border-ink-800" title="Ağ Kodun">Ağ Kodu: {data.agentId}</span>
                <button onClick={() => { navigator.clipboard.writeText(data.agentId || ''); showToast('Kod kopyalandı!', 'success'); }} className="p-1.5 text-ink-500 hover:text-emerald-400 bg-ink-900 rounded-md transition-colors"><Copy size={12} /></button>
              </div>

              {/* Rozet */}
              {activeBadgeDef ? (
                <div onClick={() => navigateTo('achievements')} className="inline-flex items-center gap-3 sm:gap-4 bg-ink-900 border border-ink-700/80 px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl shadow-lg group relative transition-transform hover:scale-105 cursor-pointer" title={`${activeBadgeDef.title} (${activeBadgeDef.rarity})`}>
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl border shadow-sm flex-shrink-0 ${RARITY_STYLES[activeBadgeDef.rarity].bg} ${RARITY_STYLES[activeBadgeDef.rarity].border}`}>
                    {activeBadgeDef.icon}
                  </div>
                  <div className="flex flex-col pr-2">
                    <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${RARITY_STYLES[activeBadgeDef.rarity].color} leading-none mb-1`}>Aktif Rozet</span>
                    <span className="text-sm sm:text-base font-black text-white truncate max-w-[160px] sm:max-w-[200px] leading-tight">{activeBadgeDef.title}</span>
                  </div>
                </div>
              ) : (
                <button onClick={() => navigateTo('achievements')} className="inline-flex items-center gap-3 sm:gap-4 bg-ink-900/50 border border-dashed border-ink-700/50 px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl hover:bg-ink-800 transition-colors">
                  <ShieldAlert size={20} className="text-ink-500" />
                  <div className="flex flex-col items-start justify-center">
                    <span className="text-sm sm:text-base font-bold text-ink-400">Rozet Yuvası Boş</span>
                    <span className="text-[10px] text-ink-500">Koleksiyonundan bir rozet kuşan</span>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Sağdaki 5'li Stats Grid (Kişisel Profil Bilgileri) */}
          <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 bg-ink-950/70 border border-ink-800/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-inner">
              <div className="bg-ink-900/50 border border-ink-800/80 p-3 rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
                 <Film size={20} className="absolute -right-2 -bottom-2 opacity-10" />
                 <div className="text-lg sm:text-2xl font-black text-white leading-none mb-1">{quickMetrics.watchedMoviesCount}</div>
                 <div className="text-[9px] sm:text-[10px] font-bold text-ink-500 uppercase tracking-widest text-center">Film İzledi</div>
              </div>
              <div className="bg-ink-900/50 border border-ink-800/80 p-3 rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
                 <Tv size={20} className="absolute -right-2 -bottom-2 opacity-10" />
                 <div className="text-lg sm:text-2xl font-black text-white leading-none mb-1">{data.series.filter(s => s.episodes?.every(e => e.watched)).length}</div>
                 <div className="text-[9px] sm:text-[10px] font-bold text-ink-500 uppercase tracking-widest text-center">Dizi Bitirdi</div>
              </div>
              <div className="bg-ink-900/50 border border-ink-800/80 p-3 rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
                 <Activity size={20} className="absolute -right-2 -bottom-2 opacity-10" />
                 <div className="text-lg sm:text-2xl font-black text-white leading-none mb-1">{quickMetrics.watchedEpsCount}</div>
                 <div className="text-[9px] sm:text-[10px] font-bold text-ink-500 uppercase tracking-widest text-center">Bölüm İzledi</div>
              </div>
              <div className="bg-ink-900/50 border border-ink-800/80 p-3 rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
                 <Medal size={20} className="absolute -right-2 -bottom-2 opacity-10 text-gold-500" />
                 <div className="text-lg sm:text-2xl font-black text-gold-400 leading-none mb-1">{quickMetrics.unlockedAchievementsCount}</div>
                 <div className="text-[9px] sm:text-[10px] font-bold text-gold-500/50 uppercase tracking-widest text-center">Rozet Açtı</div>
              </div>
              <div className="bg-ink-900/50 border border-ink-800/80 p-3 rounded-xl flex flex-col items-center justify-center relative overflow-hidden col-span-2 sm:col-span-1">
                 <CheckSquare size={20} className="absolute -right-2 -bottom-2 opacity-10 text-orange-500" />
                 <div className="text-lg sm:text-2xl font-black text-orange-400 leading-none mb-1">{quickMetrics.questsCompleted}</div>
                 <div className="text-[9px] sm:text-[10px] font-bold text-orange-500/50 uppercase tracking-widest text-center">Görev Bitti</div>
              </div>
          </div>
        </div>

        {/* ALT BÖLÜM: Orijinal Yatay Seviye Barı ve Slider */}
        <div className="relative z-10 w-full bg-ink-950/70 border border-ink-800/90 rounded-2xl p-4 sm:p-5 shadow-inner space-y-3 sm:space-y-4 mt-5 border-t border-ink-800/60">
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

      {/* ============================== */}
      {/* 2. HIZLI ERİŞİM BUTONLARI */}
      {/* ============================== */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button onClick={() => setShowPick(true)} className="flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-ink-950 px-4 py-3 sm:py-4 rounded-2xl font-black text-xs sm:text-sm hover:from-gold-400 hover:to-gold-500 transition-all hover:scale-[1.02] shadow-lg shadow-gold-500/20 group">
          <Shuffle size={18} className="group-hover:rotate-180 transition-transform duration-500" />
          <span>Ne İzlesem?</span>
        </button>
        <button onClick={() => setShowDnaModal(true)} className="flex items-center justify-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 px-4 py-3 sm:py-4 rounded-2xl font-bold text-xs sm:text-sm transition-all hover:scale-[1.02] group">
          <Dna size={18} className="text-emerald-400 group-hover:rotate-45 transition-transform" />
          <span>DNA Sentezle</span>
        </button>
        <button onClick={() => setShowBulkAdd('movie')} className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600/25 via-fuchsia-600/20 to-purple-600/25 hover:from-violet-500/35 hover:to-fuchsia-500/35 text-violet-200 border border-violet-500/40 px-4 py-3 sm:py-4 rounded-2xl font-bold text-xs sm:text-sm transition-all hover:scale-[1.02] shadow-lg shadow-violet-500/10 group">
          <Compass size={18} className="text-fuchsia-400 group-hover:rotate-90 transition-transform duration-500" />
          <span>Katalog Ekle</span>
        </button>
        <button onClick={() => navigateTo('planner')} className="flex items-center justify-center gap-2 bg-azure-500/15 hover:bg-azure-500/25 text-azure-300 border border-azure-500/30 px-4 py-3 sm:py-4 rounded-2xl font-bold text-xs sm:text-sm transition-all hover:scale-[1.02] group">
          <Calendar size={18} className="text-azure-400 group-hover:scale-110 transition-transform" />
          <span>Planlayıcı</span>
        </button>
      </div>

      {activeTimerMovie && (() => {
        const info = getMovieTimerInfo(activeTimerMovie, nowMs);
        return (
          <div className="bg-gradient-to-r from-emerald-950/85 via-ink-900 to-ink-950 border border-emerald-500/40 rounded-[2rem] p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl animate-fade-in-up">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                <Timer size={24} className={info.isPaused ? 'text-amber-400' : 'text-emerald-400 animate-pulse'} />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2 flex-wrap">
                  <span>{info.isPaused ? '⏸️ Sayaç Duraklatıldı' : '⏳ Canlı Geri Sayım Aktif'}</span>
                  <span className="text-white">• {activeTimerMovie.title}</span>
                </div>
                <div className="text-xs text-ink-300 mt-1">
                  Kalan Süre: <strong className="text-emerald-300 font-mono text-sm">{info.formattedRemaining}</strong> • Geçen: <strong>{info.elapsedMins} dk</strong> / {info.maxMins} dk
                  {!info.canRateWithTimer && (
                    <span className="text-amber-400 ml-2 block sm:inline mt-1 sm:mt-0">(En az {info.minRequiredMins} dk geçmeden puanlanamaz)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button onClick={() => togglePauseWatchingMovie(activeTimerMovie.id)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors">
                {info.isPaused ? <><Play size={14} className="fill-current" /> Devam Et</> : <><Pause size={14} /> Duraklat</>}
              </button>
              <button onClick={() => handleRequestRateMovie(activeTimerMovie)} className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${info.canRateWithTimer ? 'bg-gold-500 hover:bg-gold-400 text-ink-950 shadow-md' : 'bg-ink-800 text-ink-500 border border-ink-700 cursor-not-allowed'}`}>
                {info.canRateWithTimer ? <><Star size={14} className="fill-current" /> Bitir & Puanla</> : <><Lock size={13} /> Kilitli</>}
              </button>
              <button onClick={() => cancelWatchingMovie(activeTimerMovie.id)} title="Sayacı İptal Et" className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* ============================== */}
      {/* 3. VİTRİN FİLMİ */}
      {/* ============================== */}
      {spotlightMovie && (() => {
        const isSpotlightTimerActive = activeTimerMovie?.id === spotlightMovie.id;
        const spotlightColName = spotlightMovie.collectionId ? data.collections.find((c) => c.id === spotlightMovie.collectionId)?.name : null;

        return (
          <div className="relative bg-gradient-to-br from-ink-950 via-ink-900/95 to-ink-950 border border-gold-500/35 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl overflow-hidden animate-fade-in-up">
            {spotlightMovie.posterUrl && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
                <img src={spotlightMovie.posterUrl} alt="" className="w-full h-full object-cover blur-3xl scale-125 saturate-150" />
                <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-ink-950/60" />
              </div>
            )}

            <div className="relative z-10 flex items-center justify-between flex-wrap gap-2 mb-6 pb-4 border-b border-ink-800/70">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-gold-500/20 to-amber-500/10 border border-gold-500/40 text-gold-300 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-sm">
                  <Sparkles size={16} className="text-gold-400" /> Bu Akşamın Vitrin Önerisi
                </div>
                {spotlightColName && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-azure-300 bg-azure-500/15 border border-azure-500/30 px-3.5 py-2 rounded-full">
                    <Layers size={14} /> {spotlightColName}
                  </span>
                )}
              </div>

              {eligibleMovies.length > 1 && (
                <button onClick={() => setSpotlightOffset((prev) => prev + 1)} className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-200 hover:text-gold-300 bg-ink-900/90 hover:bg-ink-800 px-4 py-2 rounded-xl border border-ink-700/80 hover:border-gold-500/40 transition-all group">
                  <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500 text-gold-400" /> Başka Film Öner
                </button>
              )}
            </div>

            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-stretch">
              <button onClick={() => setDetailTarget({ type: 'movie', data: spotlightMovie })} title="Sinema Kartını Gör" className="w-48 sm:w-56 aspect-[2/3] flex-shrink-0 rounded-2xl overflow-hidden bg-ink-950 border-2 border-gold-500/40 shadow-2xl relative group/poster cursor-pointer self-center md:self-start">
                {spotlightMovie.posterUrl ? (
                  <img src={spotlightMovie.posterUrl} alt={spotlightMovie.title} className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-600"><Projector size={48} /></div>
                )}
                <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/poster:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-gold-500 text-ink-950 flex items-center justify-center shadow-lg"><Eye size={22} /></div>
                  <span className="text-[11px] font-black text-white uppercase tracking-wider">Sinema Kartı</span>
                </div>
              </button>

              <div className="flex-1 min-w-0 text-center md:text-left flex flex-col justify-between w-full">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-3xl sm:text-4xl font-black text-ink-50 tracking-tight leading-tight">{spotlightMovie.title}</h3>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mt-3 text-xs sm:text-sm text-ink-200 font-semibold">
                      {spotlightMovie.year && <span className="flex items-center gap-1.5 bg-ink-950/80 px-3 py-1.5 rounded-lg border border-ink-800"><Calendar size={14} className="text-gold-400" /> {spotlightMovie.year}</span>}
                      {spotlightMovie.runtime && <span className="flex items-center gap-1.5 bg-ink-950/80 px-3 py-1.5 rounded-lg border border-ink-800"><Clock size={14} className="text-gold-400" /> {spotlightMovie.runtime} dk</span>}
                      {spotlightMovie.directors && spotlightMovie.directors.length > 0 && <span className="flex items-center gap-1.5 bg-ink-950/80 px-3 py-1.5 rounded-lg border border-ink-800"><User size={14} className="text-gold-400" /> {spotlightMovie.directors[0]}</span>}
                      {spotlightMovie.cast && spotlightMovie.cast.length > 0 && <span className="flex items-center gap-1.5 bg-ink-950/80 px-3 py-1.5 rounded-lg border border-ink-800"><Users size={14} className="text-azure-400" /> {spotlightMovie.cast.slice(0, 2).join(', ')}</span>}
                    </div>
                  </div>

                  {spotlightMovie.genres.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                      {spotlightMovie.genres.map((g) => <span key={g} className="text-[11px] font-bold px-3.5 py-1 rounded-full bg-gold-500/15 text-gold-300 border border-gold-500/30">{g}</span>)}
                    </div>
                  )}

                  <div className="bg-ink-950/70 border border-ink-800/90 rounded-2xl p-4 sm:p-5 text-left shadow-inner">
                    <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-gold-400/90 mb-1.5">Film Konusu & Özet</div>
                    {spotlightMovie.overview ? (
                      <div className="max-h-24 sm:max-h-32 overflow-y-auto pr-3 custom-scrollbar text-xs sm:text-sm text-ink-200 leading-relaxed">{spotlightMovie.overview}</div>
                    ) : (
                      <p className="text-xs sm:text-sm text-ink-500 italic">Bu film için henüz özet bilgisi çekilmemiş. Filmler sekmesindeki "Eksikleri Bul" butonuyla özeti indirebilirsin.</p>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-ink-800/70 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    {getMovieWatchLinks(spotlightMovie).map((link, idx) => {
                      const Icon = link.icon;
                      if (link.isTrailer) return <a key={idx} href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md hover:scale-105"><Icon size={16} /> {link.text}</a>;
                      return <a key={idx} href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-ink-800 hover:bg-ink-700 text-gold-400 border border-gold-500/30 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105">{link.logo ? <img src={link.logo} alt={link.text} className="w-4 h-4 rounded-sm object-cover" /> : <Icon size={15} />} {link.text}</a>;
                    })}
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {isSpotlightPlanned ? (
                      <div 
                        title="Bu film haftalık planda. Puanlamak veya izlemek için Planlayıcı sekmesine gidin."
                        className="flex items-center justify-center gap-1.5 text-xs px-5 py-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 font-bold w-full md:w-auto whitespace-nowrap cursor-not-allowed"
                      >
                        <Lock size={15} /> Takvime Planlandı
                      </div>
                    ) : (
                      <>
                        {!isSpotlightTimerActive && (
                          <button onClick={() => startWatchingMovie(spotlightMovie.id, false)} disabled={Boolean(activeTimerMovie)} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border transition-all ${activeTimerMovie ? 'bg-ink-900 text-ink-500 border-ink-800 cursor-not-allowed' : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/35'}`} title="Canlı geri sayımı başlat">
                            <Play size={15} className="fill-current" /> Başlat
                          </button>
                        )}
                        <button onClick={() => setDetailTarget({ type: 'movie', data: spotlightMovie })} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-ink-800 hover:bg-ink-700 text-ink-100 border border-ink-700 px-4 py-3 rounded-xl text-xs font-bold transition-all">
                          <Eye size={16} /> Künye
                        </button>
                        <button onClick={() => handleRequestRateMovie(spotlightMovie)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-ink-950 px-6 py-3 rounded-xl text-sm font-black shadow-lg shadow-gold-500/20 transition-all hover:scale-105">
                          <Star size={16} className="fill-current" /> Puanla
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
        <div className="space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg sm:text-xl font-black text-ink-100 flex items-center gap-2">
              <Tv size={22} className="text-azure-400" /> İzlemeye Devam Et
              <span className="text-xs font-bold bg-azure-500/20 text-azure-300 px-3 py-1 rounded-full border border-azure-500/30">{ongoingSeries.length} Dizi</span>
            </h2>
            <button onClick={() => navigateTo('series')} className="text-xs sm:text-sm font-bold text-azure-400 hover:underline flex items-center gap-1">Tüm Diziler <ChevronRight size={16} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {ongoingSeries.slice(0, 6).map(({ series, episode, watchedCount, totalCount, pct }) => (
              <div key={series.id} className="bg-ink-900/70 backdrop-blur-sm border border-ink-700/60 hover:border-azure-500/40 rounded-[1.5rem] p-4 flex gap-4 items-center shadow-lg transition-all group">
                <button onClick={() => setDetailTarget({ type: 'series', data: series })} title="Sinema Kartını Gör" className="w-20 aspect-[2/3] flex-shrink-0 rounded-xl overflow-hidden bg-ink-950 border border-ink-700/60 relative group/poster cursor-pointer">
                  {series.posterUrl ? <img src={series.posterUrl} alt={series.title} className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center text-ink-600"><Tv size={24} /></div>}
                  <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/poster:opacity-100 transition-opacity flex items-center justify-center"><Eye size={20} className="text-azure-400" /></div>
                </button>

                <div className="flex-1 min-w-0">
                  <button onClick={() => setDetailTarget({ type: 'series', data: series })} className="font-black text-base text-ink-100 hover:text-azure-400 truncate block text-left w-full transition-colors">{series.title}</button>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-azure-300 bg-azure-500/15 border border-azure-500/30 px-2.5 py-1 rounded-md mt-1.5"><span>Sıradaki: S{episode.season} B{episode.episode}</span></div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold text-ink-400"><span>{watchedCount} / {totalCount} Bölüm</span><span className="text-azure-400">%{pct}</span></div>
                    <div className="h-2 w-full bg-ink-950 rounded-full overflow-hidden border border-ink-800"><div className="h-full bg-gradient-to-r from-azure-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${Math.max(4, pct)}%` }} /></div>
                  </div>
                  <button onClick={() => setPickedItem({ kind: 'series', series, episode })} className="mt-3 w-full py-2 px-3 rounded-xl bg-azure-500/20 hover:bg-azure-500 text-azure-300 hover:text-white border border-azure-500/30 text-xs font-black transition-all flex items-center justify-center gap-1.5"><Star size={14} className="fill-current" /> Bölümü Puanla</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* 4. ARŞİV KISAYOLLARI */}
      {/* ============================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <button onClick={() => navigateTo('movies')} className="group relative overflow-hidden flex flex-col items-center justify-center bg-ink-900/60 border border-ink-700/50 rounded-[2rem] p-6 text-center shadow-lg hover:border-gold-500/40 transition-all hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Projector size={32} className="text-gold-400 mb-3 group-hover:scale-110 transition-transform duration-300" />
          <div className="text-4xl font-black text-ink-100">{data.movies.length}</div>
          <div className="text-xs sm:text-sm font-bold text-ink-500 tracking-wider uppercase mt-1 group-hover:text-gold-400/80 transition-colors">Film Arşivi</div>
        </button>

        <button onClick={() => navigateTo('series')} className="group relative overflow-hidden flex flex-col items-center justify-center bg-ink-900/60 border border-ink-700/50 rounded-[2rem] p-6 text-center shadow-lg hover:border-azure-500/40 transition-all hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-azure-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Tv size={32} className="text-azure-400 mb-3 group-hover:scale-110 transition-transform duration-300" />
          <div className="text-4xl font-black text-ink-100">{data.series.length}</div>
          <div className="text-xs sm:text-sm font-bold text-ink-500 tracking-wider uppercase mt-1 group-hover:text-azure-400/80 transition-colors">Dizi Arşivi</div>
        </button>

        <button onClick={() => navigateTo('history')} className="group relative overflow-hidden flex flex-col items-center justify-center bg-ink-900/60 border border-ink-700/50 rounded-[2rem] p-6 text-center shadow-lg hover:border-violet-500/40 transition-all hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Clock size={32} className="text-violet-400 mb-3 group-hover:scale-110 transition-transform duration-300" />
          <div className="text-4xl font-black text-ink-100">{quickMetrics.regularHistoryCount}</div>
          <div className="text-xs sm:text-sm font-bold text-ink-500 tracking-wider uppercase mt-1 group-hover:text-violet-400/80 transition-colors">Geçmiş</div>
        </button>

        <button onClick={() => navigateTo('achievements')} className="group relative overflow-hidden flex flex-col items-center justify-center bg-ink-900/60 border border-ink-700/50 rounded-[2rem] p-6 text-center shadow-lg hover:border-emerald-500/40 transition-all hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Trophy size={32} className="text-emerald-400 mb-3 group-hover:scale-110 transition-transform duration-300" />
          <div className="text-4xl font-black text-ink-100">{quickMetrics.tierCounts.total}</div>
          <div className="text-xs sm:text-sm font-bold text-ink-500 tracking-wider uppercase mt-1 group-hover:text-emerald-400/80 transition-colors">Başarımlar</div>
        </button>
      </div>

      {/* ============================== */}
      {/* 5. BAŞARIMLAR VE SİNEVİA AĞI (YAN YANA YENİ GRID - UZAMAZ!) */}
      {/* ============================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-start">
        
        {/* EN YAKIN ROZETLER */}
        {closestAchievements.length > 0 && (
          <div className="bg-ink-900/60 border border-ink-700/60 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-black text-ink-100 flex items-center gap-2"><Target size={20} className="text-gold-400" /> En Yakın Rozetler</h3>
              <button onClick={() => navigateTo('achievements')} className="text-xs font-bold text-gold-400 hover:underline flex items-center gap-1">Tümü <ChevronRight size={14} /></button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {closestAchievements.map((ach) => {
                const tierInfo = (TIER_COLORS as any)[ach.tier];
                const AchIcon = (Icons as any)[ach.icon] || Trophy;
                return (
                  <div key={ach.id} className="bg-ink-950/70 border border-ink-800/80 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${tierInfo?.bg || 'bg-ink-800'}`}>
                          <AchIcon size={20} className={tierInfo?.text || 'text-gold-400'} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-black text-ink-100 truncate">{ach.name}</div>
                          <div className="text-xs text-ink-400 truncate">{ach.desc}</div>
                        </div>
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-black text-gold-400 bg-gold-500/10 border border-gold-500/20 px-2.5 py-1 rounded-md flex-shrink-0">+{ach.xp} XP</span>
                    </div>
                    <div className="space-y-1.5 mt-1">
                      <div className="flex justify-between text-[10px] sm:text-[11px] font-bold text-ink-400"><span>İlerleme: {ach.current} / {ach.target}</span><span className="text-gold-400">%{ach.pct}</span></div>
                      <div className="h-2 w-full bg-ink-900 rounded-full overflow-hidden border border-ink-800"><div className={`h-full rounded-full ${tierInfo?.bg || 'bg-gold-500'}`} style={{ width: `${ach.pct}%` }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SİNEVİA AĞI */}
        <div className="bg-ink-900/60 border border-ink-700/60 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col relative overflow-hidden w-full">
          <div className="absolute top-0 right-0 w-40 h-40 bg-azure-500/10 blur-[60px] rounded-full pointer-events-none" />
          
          <div className="flex items-center justify-between mb-5 relative z-10">
            <h3 className="text-base sm:text-lg font-black text-ink-100 flex items-center gap-2"><Users size={20} className="text-azure-400" /> Sinevia Ağı</h3>
          </div>

          <div className="flex flex-col space-y-3 relative z-10">
            {networkLoading ? (
              <div className="text-center py-10 text-xs text-ink-500 animate-pulse">Ağ verileri çekiliyor...</div>
            ) : networkFeed.length === 0 ? (
              <div className="text-center py-10 text-sm text-ink-500 italic bg-ink-900/30 rounded-2xl border border-ink-800/50">
                Ağında henüz bir hareket yok veya arkadaşın yok.
              </div>
            ) : (
              <>
                {networkFeed.slice(0, 3).map(log => {
                  const profile = profilesMap[log.agent_id];
                  if (!profile) return null;
                  return (
                    <div key={log.id} className="flex gap-3 sm:gap-4 items-center p-2.5 sm:p-3 rounded-2xl bg-ink-950/50 border border-ink-800/50">
                      <div className="w-12 sm:w-14 aspect-[2/3] bg-ink-900 rounded-lg overflow-hidden flex-shrink-0 border border-ink-700 shadow-sm">
                        {log.item_poster ? <img src={log.item_poster} className="w-full h-full object-cover" /> : <Film size={18} className="text-ink-600 m-auto mt-6" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] sm:text-[11px] font-black text-emerald-400 truncate max-w-[100px] sm:max-w-[120px]">{profile.nickname}</span>
                          <span className="text-[10px] text-ink-500 font-medium">izledi</span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate leading-tight">{log.item_title}</h4>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {log.rating && <span className="text-[9px] font-black text-gold-400 flex items-center gap-1 bg-gold-500/10 px-2 py-0.5 rounded border border-gold-500/20"><Star size={10} className="fill-gold-400"/> {log.rating}</span>}
                          <span className="text-[9px] text-ink-500 font-mono pl-1">{timeAgo(log.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <button onClick={() => navigateTo('network')} className="w-full mt-2 bg-azure-500/10 hover:bg-azure-500/20 text-azure-400 border border-azure-500/30 py-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                  Tüm Ağ Akışını Gör <ChevronRight size={14} />
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* ============================== */}
      {/* 6. SON İZLENENLER (TAM GENİŞLİK - TEK SATIR YENİ TASARIM) */}
      {/* ============================== */}
      {recentWatched.length > 0 && (
        <div className="bg-ink-900/60 border border-ink-700/60 rounded-3xl p-5 sm:p-6 shadow-xl w-full mt-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base sm:text-lg font-black text-ink-100 flex items-center gap-2"><Clock size={20} className="text-violet-400" /> Son İzlenenler</h3>
            <button onClick={() => navigateTo('history')} className="text-xs font-bold text-violet-400 hover:text-white bg-violet-500/10 hover:bg-violet-500/20 px-4 py-2 rounded-xl border border-violet-500/20 transition-colors flex items-center gap-1">
              Tüm Geçmişi Gör <ChevronRight size={14} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {recentWatched.map((h) => {
              const isMovie = h.kind === 'movie' || h.type === 'movie';
              const poster = isMovie ? data.movies.find((m) => m.id === (h.itemId || h.id))?.posterUrl : data.series.find((s) => s.id === (h.seriesId || h.itemId || h.id))?.posterUrl;
              return (
                <button key={h.id} type="button" onClick={() => openHistoryItemDetail(h)} className="bg-ink-950/70 hover:bg-ink-800 border border-ink-800/80 hover:border-gold-500/40 rounded-2xl overflow-hidden transition-all group flex flex-col text-left h-full relative shadow-md">
                  <div className="w-full aspect-[2/3] bg-ink-900 border-b border-ink-800/60 relative">
                    {poster ? <img src={poster} alt={h.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center text-ink-600">{isMovie ? <Film size={32} /> : <Tv size={32} />}</div>}
                    
                    {h.rating !== null && (
                      <div className="absolute top-2 right-2 bg-ink-950/90 backdrop-blur-sm border border-gold-500/30 text-gold-400 px-2 py-1 rounded-lg text-xs font-black shadow-lg flex items-center gap-1 z-10">
                        <Star size={10} className="fill-current" /> {h.rating}
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-950 to-transparent opacity-80" />
                  </div>
                  
                  <div className="p-3 sm:p-4 flex flex-col flex-1 z-10 -mt-10">
                    <div className="text-xs sm:text-sm font-black text-white line-clamp-2 drop-shadow-md group-hover:text-gold-400 transition-colors leading-tight mb-1">{h.title}</div>
                    <div className="text-[10px] text-ink-400 mb-1">{h.season != null ? `S${h.season} B${h.episode}` : h.year || 'Film'}</div>
                    <div className="mt-auto text-[9px] font-mono text-ink-500 pt-1.5">{formatDateShort(h.watchedAt)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* 7. "SİSTEM NASIL ÇALIŞIR?" BENTO GRID TASARIMI (YAPAY ZEKA YOK!) */}
      {/* ============================== */}
      <div className="pt-10 pb-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400 text-xs font-black uppercase tracking-widest mb-4 shadow-sm">
            <Sparkles size={14} /> Yeni Nesil Sinema Deneyimi
          </div>
          <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Sinevia Nasıl Çalışır?</h3>
        </div>
        
        {/* 8 KUTULU BENTO GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 relative">
          
          <div className="bg-ink-950/80 backdrop-blur-md border border-ink-800 rounded-[2rem] p-6 hover:border-blue-500/50 transition-all group relative z-10 shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-blue-500/20 transition-all" />
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]"><Search size={22} className="text-blue-400" /></div>
            <h4 className="font-black text-white mb-2 text-lg tracking-tight">Katalog & Keşif</h4>
            <p className="text-xs text-ink-400 leading-relaxed font-medium">Binlerce yapım arasından filtreleme yap, türlere göre ayır ve kişisel izleme kütüphaneni oluştur.</p>
          </div>
          
          <div className="bg-ink-950/80 backdrop-blur-md border border-ink-800 rounded-[2rem] p-6 hover:border-emerald-500/50 transition-all group relative z-10 shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]"><Dna size={22} className="text-emerald-400" /></div>
            <h4 className="font-black text-white mb-2 text-lg tracking-tight">DNA Laboratuvarı</h4>
            <p className="text-xs text-ink-400 leading-relaxed font-medium">İki favori filminin DNA'sını sentezle. Algoritma bu karışımın genetiğine en uygun yapımı bulup önersin.</p>
          </div>

          <div className="bg-ink-950/80 backdrop-blur-md border border-ink-800 rounded-[2rem] p-6 hover:border-gold-500/50 transition-all group relative z-10 shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-gold-500/20 transition-all" />
            <div className="w-12 h-12 rounded-xl bg-gold-500/10 flex items-center justify-center mb-4 border border-gold-500/30 shadow-[0_0_15px_rgba(234,179,8,0.15)]"><Shuffle size={22} className="text-gold-400" /></div>
            <h4 className="font-black text-white mb-2 text-lg tracking-tight">Kararsızlık Çarkı</h4>
            <p className="text-xs text-ink-400 leading-relaxed font-medium">Ne izleyeceğine karar veremiyor musun? Türü ve süreyi belirle, sistem senin için kütüphanenden rastgele seçsin.</p>
          </div>

          <div className="bg-ink-950/80 backdrop-blur-md border border-ink-800 rounded-[2rem] p-6 hover:border-purple-500/50 transition-all group relative z-10 shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-purple-500/20 transition-all" />
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]"><Calendar size={22} className="text-purple-400" /></div>
            <h4 className="font-black text-white mb-2 text-lg tracking-tight">Haftalık Planlayıcı</h4>
            <p className="text-xs text-ink-400 leading-relaxed font-medium">Hangi gün ne izleyeceğini takvime ekle. Çakışmaları engelle ve izleme maratonunu düzenli hale getir.</p>
          </div>

          <div className="bg-ink-950/80 backdrop-blur-md border border-ink-800 rounded-[2rem] p-6 hover:border-rose-500/50 transition-all group relative z-10 shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-rose-500/20 transition-all" />
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center mb-4 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.15)]"><Timer size={22} className="text-rose-400" /></div>
            <h4 className="font-black text-white mb-2 text-lg tracking-tight">Canlı İzleme Sayacı</h4>
            <p className="text-xs text-ink-400 leading-relaxed font-medium">Yapıma başladığında sayacı çalıştır, mola verince duraklat. Filmi yeteri kadar izlemeden sahte puan veremezsin.</p>
          </div>

          <div className="bg-ink-950/80 backdrop-blur-md border border-ink-800 rounded-[2rem] p-6 hover:border-amber-500/50 transition-all group relative z-10 shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-amber-500/20 transition-all" />
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]"><Star size={22} className="text-amber-400" /></div>
            <h4 className="font-black text-white mb-2 text-lg tracking-tight">Detaylı Puanlama</h4>
            <p className="text-xs text-ink-400 leading-relaxed font-medium">Senaryo, oyunculuk ve görsellik gibi kendi belirlediğin alt kırılımlarla yapıma ince ayarlı bir puan ver.</p>
          </div>

          <div className="bg-ink-950/80 backdrop-blur-md border border-ink-800 rounded-[2rem] p-6 hover:border-cyan-500/50 transition-all group relative z-10 shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-cyan-500/20 transition-all" />
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]"><Target size={22} className="text-cyan-400" /></div>
            <h4 className="font-black text-white mb-2 text-lg tracking-tight">Görev & Rozetler</h4>
            <p className="text-xs text-ink-400 leading-relaxed font-medium">Ajan kontratlarını yerine getir. Gizli başarımları açarak XP topla, rütbeni yükselt ve vitrinine rozet kuşan.</p>
          </div>

          <div className="bg-ink-950/80 backdrop-blur-md border border-ink-800 rounded-[2rem] p-6 hover:border-indigo-500/50 transition-all group relative z-10 shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-indigo-500/20 transition-all" />
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]"><Users size={22} className="text-indigo-400" /></div>
            <h4 className="font-black text-white mb-2 text-lg tracking-tight">Sinevia Sosyal Ağı</h4>
            <p className="text-xs text-ink-400 leading-relaxed font-medium">Arkadaşlarını ekle, profillerini stalkla, özel film listeleri gönder, canlı mesajlaş ve Liderlik Tablosunda yarış.</p>
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