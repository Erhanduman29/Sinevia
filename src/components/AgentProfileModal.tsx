import { useState, useMemo, useEffect } from 'react';
import {
  X, ShieldAlert, Sparkles, Film, Tv, Activity, Medal, CheckSquare,
  Crown, Star, Plus, MessageSquare, BarChart2, Send, Check, Compass,
  Flame, Swords, Award, Dna, ExternalLink, Eye, Info, Play, Pause,
  Timer, Lock, Calendar, Clock, Zap, Boxes, History, PlayCircle, Search, Image as ImageIcon
} from 'lucide-react';
import { useApp, getMovieTimerInfo } from '../context/AppContext';
import type { ShowcaseItem } from '../context/AppContext';
import { ratingBgClass, formatDateShort } from '../lib/utils';
import RatingModal from './RatingModal';
import MediaDetailModal from './MediaDetailModal';
import type { Movie } from '../types';

interface AgentProfileModalProps {
  viewingProfileId: string;
  profile: any;
  isOwnProfile: boolean;
  liveStatus: {
    id: string;
    title: string;
    posterUrl: string | null;
    year: string;
    elapsedMins: number;
    maxMins: number;
    isPaused: boolean;
    progress: number;
  } | null;
  friendLogs: any[];
  myMovies: any[];
  mySeries: any[];
  myShowcase: ShowcaseItem[];
  myStats?: {
    xp: number;
    level: number;
    moviesWatched: number;
    pastMoviesWatched: number;
    episodesWatched: number;
    achievementsUnlocked: number;
  };
  profileTab: 'stats' | 'chat';
  setProfileTab: (tab: 'stats' | 'chat') => void;
  chatMessages: any[];
  chatInput: string;
  setChatInput: (val: string) => void;
  onSendMessage: () => void;
  onOpenMediaShare: () => void;
  renderChatMessageItem: (msg: any, allMsgList: any[], isGroupChat: boolean) => React.ReactNode;
  onAddToLibrary: (item: any, isFromList?: boolean) => void;
  onOpenShowcaseEditor?: () => void;
  onClose: () => void;
  chatScrollRef: React.RefObject<HTMLDivElement>;
}

function timeAgo(dateString: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'Az önce';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} dk önce`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} saat önce`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} gün önce`;
  return date.toLocaleDateString('tr-TR');
}

export default function AgentProfileModal({
  viewingProfileId,
  profile,
  isOwnProfile,
  liveStatus,
  friendLogs,
  myMovies,
  mySeries,
  myShowcase,
  myStats,
  profileTab,
  setProfileTab,
  chatMessages,
  chatInput,
  setChatInput,
  onSendMessage,
  onOpenMediaShare,
  renderChatMessageItem,
  onAddToLibrary,
  onOpenShowcaseEditor,
  onClose,
  chatScrollRef,
}: AgentProfileModalProps) {
  const {
    data,
    startWatchingMovie,
    togglePauseWatchingMovie,
    cancelWatchingMovie,
    canRateMovieWithTimer,
    watchMovie,
    unwatchMovie,
  } = useApp();

  const [logFilter, setLogFilter] = useState<'all' | 'shared' | 'top'>('all');
  const [visibleLogsCount, setVisibleLogsCount] = useState(6);

  // AFİŞE TIKLANDIĞINDA AÇILAN FİLM SAYFASI KARTI STATE'LERİ
  const [selectedMediaCard, setSelectedMediaCard] = useState<{
    id?: string;
    title: string;
    cleanTitle: string;
    type: 'movie' | 'series';
    poster: string | null;
    year?: string;
    rating?: number | null;
    note?: string | null;
    reviewTags?: string[];
    isSpoiler?: boolean;
    createdAt?: string;
    genres?: string[];
  } | null>(null);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);

  // DOĞRUDAN KART İÇİNDEN PUANLAMA VE SİNEMA KARTI (DETAY) MODALLARI
  const [ratingTarget, setRatingTarget] = useState<Movie | null>(null);
  const [detailMovie, setDetailMovie] = useState<Movie | null>(null);

  // SAYAÇ İÇİN CANLI SANİYE GÜNCELLEMESİ
  const [nowMs, setNowMs] = useState(() => Date.now());
  const activeTimerMovie = useMemo(
    () => data.movies.find(m => !m.watched && m.startedAt) || null,
    [data.movies]
  );

  useEffect(() => {
    if (!activeTimerMovie) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimerMovie]);

  const plannedMovieIds = useMemo(() => {
    const ids = new Set<string>();
    (data.weeklyPlan || []).forEach(p => ids.add(p.movieId));
    return ids;
  }, [data.weeklyPlan]);

  // VİTRİN VERİSİ (SADECE DOLU OLANLAR ALINIR, BOŞ KUTU GÖSTERİLMEZ)
  const showcaseItems = useMemo(() => {
    const raw: any[] = isOwnProfile
      ? myShowcase || []
      : Array.isArray(profile?.showcase)
      ? profile.showcase
      : [];
    return raw
      .filter(item => item && item.title)
      .map(item => ({
        ...item,
        posterUrl: item.posterUrl || item.poster || item.item_poster || null,
      }));
  }, [isOwnProfile, myShowcase, profile?.showcase]);

  // SİNEMATİK DNA & ELEŞTİRMEN KARAKTERİ ANALİZİ
  const cinemaDna = useMemo(() => {
    const genreCounts: Record<string, number> = {};
    const ratings: number[] = [];

    if (isOwnProfile) {
      myMovies.filter(m => m.watched).forEach(m => {
        (m.genres || []).forEach((g: string) => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
        if (m.rating) ratings.push(Number(m.rating));
      });
      mySeries.forEach(s => {
        const watchedEps = (s.episodes || []).filter((e: any) => e.watched);
        if (watchedEps.length > 0) {
          (s.genres || []).forEach((g: string) => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
          watchedEps.forEach((e: any) => { if (e.rating) ratings.push(Number(e.rating)); });
        }
      });
    } else {
      friendLogs.forEach(log => {
        (log.genres || []).forEach((g: string) => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
        if (log.rating) ratings.push(Number(log.rating));
      });
    }

    const totalGenreHits = Object.values(genreCounts).reduce((a, b) => a + b, 0) || 1;
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.min(100, Math.round((count / totalGenreHits) * 100 * 1.8)),
      }));

    const avgRating =
      ratings.length > 0
        ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
        : null;

    let persona = 'Dengeli İzleyici 🎬';
    let personaDesc = 'Her türe şans veren, adil puanlayan sinema tutkunu.';
    if (avgRating !== null) {
      if (avgRating >= 8.4) {
        persona = 'Cömert Sinefil ✨';
        personaDesc = 'İzlediği yapımlarda güzellik arayan, yüksek puanlarıyla motive eden ajan.';
      } else if (avgRating <= 6.5) {
        persona = 'Acımasız Eleştirmen 🧐';
        personaDesc = 'Kolay kolay beğenmeyen, sadece gerçek başyapıtlara yüksek puan veren seçici göz.';
      } else if ((profile?.episodes_watched || 0) > (profile?.movies_watched || 0) * 6) {
        persona = 'Dizi Maratoncusu 📺';
        personaDesc = 'Uzun soluklu hikayelerin ve sezon finallerinin vazgeçilmez takipçisi.';
      } else if ((profile?.movies_watched || 0) >= 50) {
        persona = 'Kült Koleksiyoncusu 🎞️';
        personaDesc = 'Beyazperdenin büyüsüne kapılmış, geniş film arşivine sahip usta ajan.';
      }
    }

    const totalMoviesCombined = (profile?.movies_watched || 0) + (profile?.past_movies_watched || 0);
    const estHours = Math.round(
      (totalMoviesCombined * 115 + (profile?.episodes_watched || 0) * 42) / 60
    );

    return { topGenres, avgRating, ratingsCount: ratings.length, persona, personaDesc, estHours };
  }, [isOwnProfile, myMovies, mySeries, friendLogs, profile]);

  // RUH İKİZİ (SİNEMA UYUMU) VE KÖR NOKTALAR (O BAYILDI, SEN İZLEMEDİN)
  const { compatibility, blindSpots } = useMemo(() => {
    if (isOwnProfile) return { compatibility: null, blindSpots: [] };
    const ratedMatches: { diff: number }[] = [];
    const sharedTitles = new Set<string>();
    const friendGenreCounts: Record<string, number> = {};
    const recommendationsFromFriend: any[] = [];
    const seenRecTitles = new Set<string>();

    friendLogs.forEach(log => {
      const cleanLogTitle = (log.item_title || '').replace(/\s\(S\d+\sB\d+\)$/i, '').trim();
      const lowerTitle = cleanLogTitle.toLowerCase();

      (log.genres || []).forEach((g: string) => {
        friendGenreCounts[g] = (friendGenreCounts[g] || 0) + 1;
      });

      const myMovie = myMovies.find(m => m.title.toLowerCase() === lowerTitle && m.watched);
      const mySeriesMatch = mySeries.find(
        s => s.title.toLowerCase() === lowerTitle && s.episodes?.some((e: any) => e.watched)
      );

      if (myMovie || mySeriesMatch) {
        sharedTitles.add(lowerTitle);
        let myR = myMovie?.rating ?? null;
        if (!myMovie && mySeriesMatch) {
          const rEps = mySeriesMatch.episodes.filter((e: any) => e.rating !== null);
          if (rEps.length > 0) myR = rEps.reduce((a: number, b: any) => a + (b.rating || 0), 0) / rEps.length;
        }
        if (myR !== null && log.rating !== null && log.rating !== undefined) {
          ratedMatches.push({ diff: Math.abs(myR - Number(log.rating)) });
        }
      } else if (log.rating && Number(log.rating) >= 8 && !seenRecTitles.has(lowerTitle)) {
        seenRecTitles.add(lowerTitle);
        recommendationsFromFriend.push({
          ...log,
          cleanTitle: cleanLogTitle,
        });
      }
    });

    let showcaseOverlap = 0;
    showcaseItems.forEach(sc => {
      const cleanSc = (sc.title || '').trim().toLowerCase();
      const inMyShowcase = (myShowcase || []).some(m => m.title.toLowerCase() === cleanSc);
      const inMyWatched =
        myMovies.some(m => m.title.toLowerCase() === cleanSc && m.watched && (m.rating || 0) >= 8) ||
        mySeries.some(s => s.title.toLowerCase() === cleanSc && s.episodes?.some((e: any) => (e.rating || 0) >= 8));
      if (inMyShowcase) showcaseOverlap += 2;
      else if (inMyWatched) showcaseOverlap += 1;
    });

    const myGenreSet = new Set<string>();
    myMovies.filter(m => m.watched).forEach(m => (m.genres || []).forEach((g: string) => myGenreSet.add(g.toLowerCase())));
    mySeries.forEach(s => (s.genres || []).forEach((g: string) => myGenreSet.add(g.toLowerCase())));
    const sharedGenres = Object.keys(friendGenreCounts).filter(g => myGenreSet.has(g.toLowerCase()));

    let compResult;
    if (sharedTitles.size === 0 && showcaseOverlap === 0 && sharedGenres.length === 0) {
      compResult = {
        score: 50,
        label: 'Keşfedilmeyi Bekliyor',
        color: 'from-slate-500 to-zinc-600',
        textColor: 'text-ink-300',
        sharedCount: 0,
      };
    } else {
      let score = 68;
      if (ratedMatches.length > 0) {
        const avgDiff = ratedMatches.reduce((a, b) => a + b.diff, 0) / ratedMatches.length;
        score = Math.round(Math.max(18, 100 - avgDiff * 10.5));
      }
      score = Math.min(
        99,
        score + Math.min(12, sharedTitles.size * 2) + Math.min(10, showcaseOverlap * 4) + Math.min(8, sharedGenres.length * 2)
      );

      let label = 'Ortak Frekans ✨';
      let color = 'from-azure-500 to-indigo-600';
      let textColor = 'text-azure-400';
      if (score >= 86) {
        label = 'Sinematik Ruh İkizi 🔥';
        color = 'from-emerald-500 to-teal-500';
        textColor = 'text-emerald-400';
      } else if (score >= 74) {
        label = 'Harika İkili 🍿';
        color = 'from-amber-500 to-orange-500';
        textColor = 'text-gold-400';
      } else if (score < 45) {
        label = 'Zıt Kutuplar 🧊';
        color = 'from-rose-500 to-pink-600';
        textColor = 'text-rose-400';
      }
      compResult = { score, label, color, textColor, sharedCount: sharedTitles.size };
    }

    return {
      compatibility: compResult,
      blindSpots: recommendationsFromFriend.sort((a, b) => Number(b.rating) - Number(a.rating)).slice(0, 6),
    };
  }, [isOwnProfile, friendLogs, myMovies, mySeries, showcaseItems, myShowcase]);

  const getAgentRankTitle = (lvl: number) => {
    if (lvl >= 50) return 'Sinema Efsanesi';
    if (lvl >= 30) return 'Baş Eleştirmen';
    if (lvl >= 20) return 'Kurmaca Üstadı';
    if (lvl >= 10) return 'Kıdemli Sinefil';
    if (lvl >= 5) return 'Gece Gözcüsü';
    return 'Çaylak Ajan';
  };

  // FİLM / DİZİ KARTINI AÇMA YARDIMCISI
  const openMediaDetailCard = (rawItem: any, isFromLog = true) => {
    const rawTitle = isFromLog ? rawItem.item_title : rawItem.title;
    const cleanTitle = (rawTitle || '').replace(/\s\(S\d+\sB\d+\)$/i, '').trim();
    const type: 'movie' | 'series' = (isFromLog ? rawItem.item_type : rawItem.type) === 'series' ? 'series' : 'movie';
    const poster = isFromLog ? rawItem.item_poster : (rawItem.posterUrl || rawItem.poster || null);

    const matchingLog = isFromLog
      ? rawItem
      : friendLogs.find(
          l => (l.item_title || '').replace(/\s\(S\d+\sB\d+\)$/i, '').trim().toLowerCase() === cleanTitle.toLowerCase()
        );

    setSpoilerRevealed(false);
    setSelectedMediaCard({
      id: rawItem.id,
      title: rawTitle || cleanTitle,
      cleanTitle,
      type,
      poster,
      year: rawItem.year || matchingLog?.year || '',
      rating: rawItem.rating ?? matchingLog?.rating ?? null,
      note: matchingLog?.note || null,
      reviewTags: matchingLog?.review_tags || [],
      isSpoiler: Boolean(matchingLog?.is_spoiler),
      createdAt: matchingLog?.created_at || '',
      genres: rawItem.genres || matchingLog?.genres || [],
    });
  };

  // FİLM / DİZİ LİSTESİ SAYFASINA NOKTA ATIŞI YÖNLENDİRME
  const handleNavigateToMediaPage = (card: NonNullable<typeof selectedMediaCard>, addIfMissing = false) => {
    const alreadyInLib =
      data.movies.some(m => m.title.toLowerCase() === card.cleanTitle.toLowerCase()) ||
      data.series.some(s => s.title.toLowerCase() === card.cleanTitle.toLowerCase());

    if (!alreadyInLib && addIfMissing) {
      onAddToLibrary(
        {
          title: card.cleanTitle,
          type: card.type,
          poster: card.poster,
          genres: card.genres || [],
          year: card.year || '',
        },
        true
      );
    }

    try {
      sessionStorage.setItem('sinevia_focus_media_title', card.cleanTitle);
    } catch {}

    const targetTab = card.type === 'series' ? 'series' : 'movies';
    setSelectedMediaCard(null);
    onClose();
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: targetTab }));
  };

  const handleRequestRateFromCard = (movie: Movie) => {
    if (!movie.inPastQueue && !canRateMovieWithTimer(movie.id)) return;
    setRatingTarget(movie);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-4xl h-[92vh] bg-ink-950 border border-ink-700/70 rounded-[28px] overflow-hidden shadow-[0_0_70px_rgba(0,0,0,0.9)] flex flex-col relative"
      >
        {/* KAPATMA BUTONU */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/10 flex items-center justify-center backdrop-blur-md transition-all hover:scale-105"
        >
          <X size={18} />
        </button>

        {/* ÜST SİNEMATİK BANNER */}
        <div className="relative h-48 sm:h-56 w-full bg-ink-900 shrink-0 overflow-hidden">
          {showcaseItems.some(x => x.posterUrl) ? (
            <div
              className={`absolute inset-0 grid gap-0.5 opacity-45 scale-105 ${
                showcaseItems.length === 1
                  ? 'grid-cols-1'
                  : showcaseItems.length === 2
                  ? 'grid-cols-2'
                  : showcaseItems.length === 3
                  ? 'grid-cols-3'
                  : 'grid-cols-4'
              }`}
            >
              {showcaseItems.map((item, i) => (
                <div key={i} className="w-full h-full bg-ink-950 overflow-hidden">
                  {item?.posterUrl ? (
                    <img
                      src={item.posterUrl}
                      alt=""
                      className="w-full h-full object-cover object-center filter blur-[1px] scale-110"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-ink-900 to-ink-950" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-azure-950/30 to-ink-950" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/75 to-black/30" />
          <div className="absolute -bottom-12 left-10 w-72 h-32 bg-azure-500/20 blur-[60px] rounded-full pointer-events-none" />

          {/* PROFİL KİMLİK BARI */}
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 flex flex-col sm:flex-row sm:items-end justify-between gap-4 z-10">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="relative shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-azure-400 via-indigo-500 to-violet-600 p-[2px] shadow-[0_10px_35px_rgba(59,130,246,0.4)]">
                  <div className="w-full h-full bg-ink-950 rounded-[22px] flex items-center justify-center">
                    <span className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-white to-ink-300 bg-clip-text text-transparent">
                      {profile?.nickname?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                </div>
                {liveStatus && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-ink-950"></span>
                  </span>
                )}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-400 text-ink-950 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-lg whitespace-nowrap border border-ink-950">
                  LVL {profile?.level || 1}
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-azure-500/15 text-azure-300 border border-azure-500/30 flex items-center gap-1">
                    <ShieldAlert size={11} /> {getAgentRankTitle(profile?.level || 1)}
                  </span>
                  <span className="text-[10px] font-mono text-ink-400 bg-ink-900/90 px-2 py-0.5 rounded-md border border-ink-800">
                    {viewingProfileId}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
                  {profile?.nickname || 'Bilinmeyen Ajan'}
                </h2>
                <div className="flex items-center gap-3 mt-1 text-xs text-ink-300 font-medium flex-wrap">
                  <span className="flex items-center gap-1 text-gold-400 font-bold">
                    <Sparkles size={13} /> {profile?.total_xp || 0} XP
                  </span>
                  <span className="text-ink-600">•</span>
                  <span className="text-emerald-400 font-bold text-[11px]">
                    ~{cinemaDna.estHours} Saat Ekran Süresi
                  </span>
                  {profile?.last_seen && (
                    <>
                      <span className="text-ink-600">•</span>
                      <span className="text-ink-400 text-[11px]">Son: {timeAgo(profile.last_seen)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {isOwnProfile ? (
              onOpenShowcaseEditor && (
                <button
                  onClick={onOpenShowcaseEditor}
                  className="bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 text-ink-950 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-gold-500/20 transition-all self-start sm:self-end"
                >
                  <Crown size={15} /> Vitrinimi Düzenle ({showcaseItems.length}/4)
                </button>
              )
            ) : (
              compatibility && (
                <div className="bg-ink-900/85 backdrop-blur-md border border-ink-700/80 rounded-2xl p-3 flex items-center gap-3.5 shadow-xl self-start sm:self-end">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${compatibility.color} flex flex-col items-center justify-center text-white shadow-md shrink-0`}
                  >
                    <span className="text-sm font-black leading-none">%{compatibility.score}</span>
                    <span className="text-[8px] font-bold uppercase tracking-tighter opacity-90 mt-0.5">Uyum</span>
                  </div>
                  <div className="pr-1">
                    <div className={`text-xs font-black ${compatibility.textColor}`}>{compatibility.label}</div>
                    <div className="text-[10px] text-ink-400 mt-0.5">
                      {compatibility.sharedCount > 0
                        ? `${compatibility.sharedCount} ortak yapım izlediniz`
                        : 'Ortak tür zevki'}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* CANLI RADAR ŞERİDİ */}
        {liveStatus && (
          <div className="bg-gradient-to-r from-red-950/60 via-red-900/20 to-ink-950 border-y border-red-500/30 px-5 py-2.5 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <span className="text-[11px] font-black uppercase tracking-wider text-red-400 shrink-0">
                {liveStatus.isPaused ? '⏸️ Duraklattı:' : '🔴 Şu An İzliyor:'}
              </span>
              <span className="text-xs sm:text-sm font-bold text-white truncate">{liveStatus.title}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-mono text-red-300 font-bold">
                {liveStatus.elapsedMins} / {liveStatus.maxMins} dk
              </span>
              <div className="w-20 sm:w-28 h-1.5 bg-ink-950 rounded-full overflow-hidden border border-red-500/30 hidden sm:block">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-amber-500 rounded-full"
                  style={{ width: `${liveStatus.progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ALT SEKMELER */}
        {!isOwnProfile && (
          <div className="flex border-b border-ink-800/80 bg-ink-950 px-4 pt-2 gap-2 shrink-0">
            <button
              onClick={() => setProfileTab('stats')}
              className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-2 ${
                profileTab === 'stats'
                  ? 'border-azure-400 text-white bg-ink-900/60'
                  : 'border-transparent text-ink-500 hover:text-ink-300'
              }`}
            >
              <BarChart2 size={16} className={profileTab === 'stats' ? 'text-azure-400' : ''} />
              Vitrin, DNA & Kıyaslama
            </button>
            <button
              onClick={() => setProfileTab('chat')}
              className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-t-xl transition-all border-b-2 flex items-center justify-center gap-2 ${
                profileTab === 'chat'
                  ? 'border-azure-400 text-white bg-ink-900/60'
                  : 'border-transparent text-ink-500 hover:text-ink-300'
              }`}
            >
              <MessageSquare size={16} className={profileTab === 'chat' ? 'text-azure-400' : ''} />
              Özel Sohbet
            </button>
          </div>
        )}

        {/* İÇERİK ALANI */}
        {profileTab === 'stats' || isOwnProfile ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-6 bg-gradient-to-b from-ink-950 to-ink-900/30">
            
            {/* 1. BÖLÜM: BAŞYAPIT VİTRİNİ */}
            {(showcaseItems.length > 0 || isOwnProfile) && (
              <div className="bg-gradient-to-b from-gold-500/10 via-ink-900/50 to-ink-950 border border-gold-500/30 rounded-3xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gold-500/20 border border-gold-500/40 flex items-center justify-center text-gold-400 shadow">
                      <Crown size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                        Başyapıt Vitrini
                      </h3>
                      <p className="text-[10px] text-ink-400">
                        Ajanın izlediği ve en yüksek puanlarla taçlandırdığı favorileri
                      </p>
                    </div>
                  </div>
                  {isOwnProfile && onOpenShowcaseEditor && (
                    <button
                      onClick={onOpenShowcaseEditor}
                      className="text-xs font-black text-gold-400 hover:text-gold-300 bg-gold-500/10 border border-gold-500/30 px-3 py-1.5 rounded-xl transition-colors"
                    >
                      Vitrini Düzenle
                    </button>
                  )}
                </div>

                {showcaseItems.length === 0 ? (
                  <div
                    onClick={() => onOpenShowcaseEditor && onOpenShowcaseEditor()}
                    className="border-2 border-dashed border-gold-500/30 hover:border-gold-400/60 bg-ink-950/60 rounded-2xl p-6 text-center cursor-pointer transition-all group"
                  >
                    <Crown size={28} className="mx-auto text-gold-400/70 group-hover:scale-110 transition-transform mb-2" />
                    <div className="text-sm font-black text-white">Henüz Vitrinini Oluşturmadın</div>
                    <p className="text-xs text-ink-400 mt-1">
                      İzlediğin ve puanladığın favori 4 başyapıtını seçip profilinde sergilemek için tıkla!
                    </p>
                  </div>
                ) : (
                  <div
                    className={`grid gap-3 sm:gap-4 ${
                      showcaseItems.length === 1
                        ? 'grid-cols-1 max-w-[200px]'
                        : showcaseItems.length === 2
                        ? 'grid-cols-2 max-w-md'
                        : showcaseItems.length === 3
                        ? 'grid-cols-3 max-w-2xl'
                        : 'grid-cols-2 sm:grid-cols-4'
                    }`}
                  >
                    {showcaseItems.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => openMediaDetailCard(item, false)}
                        className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-gold-500/40 bg-ink-900 group shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer"
                      >
                        {item.posterUrl ? (
                          <img
                            src={item.posterUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-ink-800 to-ink-950 text-ink-500 p-3 text-center">
                            {item.type === 'series' ? (
                              <Tv size={32} className="mb-2 text-gold-400/60" />
                            ) : (
                              <Film size={32} className="mb-2 text-gold-400/60" />
                            )}
                            <span className="text-xs font-bold text-white">{item.title}</span>
                          </div>
                        )}

                        <div className="absolute top-2.5 left-2.5 bg-black/85 backdrop-blur-md text-gold-400 text-[10px] font-black px-2 py-1 rounded-lg border border-gold-500/40 flex items-center gap-1 shadow-md">
                          <span>#{idx + 1}</span>
                        </div>

                        {item.rating && (
                          <div className="absolute top-2.5 right-2.5 bg-gold-500 text-ink-950 text-xs font-black px-2 py-0.5 rounded-lg shadow-lg flex items-center gap-1">
                            <Star size={11} className="fill-ink-950" /> {item.rating}
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="bg-gold-500 text-ink-950 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-lg">
                            <Eye size={13} /> Film Kartını Aç
                          </span>
                        </div>

                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/90 to-transparent p-3 pt-10">
                          <div className="text-xs sm:text-sm font-black text-white line-clamp-2 leading-tight">
                            {item.title}
                          </div>
                          <div className="text-[10px] text-gold-400/90 font-bold uppercase tracking-wider mt-0.5">
                            {item.type === 'series' ? 'Dizi' : 'Film'} {item.year ? `• ${item.year}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. BÖLÜM: KARİYER İSTATİSTİK KARTLARI */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Güncel Film', val: profile?.movies_watched || 0, icon: Film, color: 'text-emerald-400', border: 'border-emerald-500/25', bg: 'from-emerald-500/15' },
                { label: 'Önceden Film', val: profile?.past_movies_watched || 0, icon: History, color: 'text-fuchsia-400', border: 'border-fuchsia-500/25', bg: 'from-fuchsia-500/15' },
                { label: 'Biten Dizi', val: profile?.series_watched || 0, icon: Tv, color: 'text-azure-400', border: 'border-azure-500/25', bg: 'from-azure-500/15' },
                { label: 'İzlenen Bölüm', val: profile?.episodes_watched || 0, icon: Activity, color: 'text-violet-400', border: 'border-violet-500/25', bg: 'from-violet-500/15' },
                { label: 'Açılan Başarım', val: profile?.achievements_unlocked || 0, icon: Medal, color: 'text-gold-400', border: 'border-gold-500/25', bg: 'from-gold-500/15' },
                { label: 'Biten Görev', val: profile?.quests_completed || 0, icon: CheckSquare, color: 'text-orange-400', border: 'border-orange-500/25', bg: 'from-orange-500/15' },
              ].map((stat, i) => (
                <div
                  key={i}
                  className={`bg-gradient-to-br ${stat.bg} to-ink-950 border ${stat.border} p-4 rounded-2xl flex flex-col justify-between relative overflow-hidden group`}
                >
                  <stat.icon
                    size={28}
                    className={`${stat.color} opacity-20 absolute right-2 top-2 group-hover:scale-110 transition-transform`}
                  />
                  <div className={`text-2xl sm:text-3xl font-black ${stat.color} font-mono`}>{stat.val}</div>
                  <div className="text-[10px] font-black text-ink-300 uppercase tracking-wider mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* 3. BÖLÜM: SİNEMATİK DNA & 1v1 AJAN DÜELLOSU */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-ink-900/50 border border-ink-800 rounded-3xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                      <Dna size={15} /> Sinematik DNA & Karakter
                    </h4>
                    {cinemaDna.avgRating && (
                      <span className="text-xs font-black bg-gold-500/15 text-gold-400 border border-gold-500/30 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                        <Star size={11} className="fill-gold-400" /> Ort. Puanı: {cinemaDna.avgRating}
                      </span>
                    )}
                  </div>

                  <div className="bg-ink-950/80 border border-ink-800/80 rounded-2xl p-3.5 mb-4">
                    <div className="text-sm font-black text-white">{cinemaDna.persona}</div>
                    <p className="text-[11px] text-ink-400 mt-0.5 leading-relaxed">{cinemaDna.personaDesc}</p>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-ink-500 mb-2.5">
                    En Çok İzlediği Favori Türler
                  </div>
                  {cinemaDna.topGenres.length === 0 ? (
                    <div className="text-xs text-ink-600 italic py-2">Henüz yeterli tür verisi yok.</div>
                  ) : (
                    <div className="space-y-2">
                      {cinemaDna.topGenres.map(g => (
                        <div key={g.name}>
                          <div className="flex justify-between text-[11px] font-bold mb-1">
                            <span className="text-ink-200">{g.name}</span>
                            <span className="text-violet-400 font-mono">{g.count} yapım</span>
                          </div>
                          <div className="w-full h-1.5 bg-ink-950 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-violet-500 to-azure-400 rounded-full"
                              style={{ width: `${g.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {!isOwnProfile && myStats ? (
                <div className="bg-ink-900/50 border border-ink-800 rounded-3xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-azure-400 flex items-center gap-1.5">
                      <Swords size={15} /> 1v1 Ajan Düellosu
                    </h4>
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase">
                      <span className="text-emerald-400">Sen</span>
                      <span className="text-ink-600">VS</span>
                      <span className="text-azure-400">{profile?.nickname?.split(' ')[0] || 'O'}</span>
                    </div>
                  </div>

                  <div className="space-y-3 my-auto">
                    {[
                      { label: 'Toplam XP', myVal: myStats.xp, hisVal: profile?.total_xp || 0 },
                      { label: 'Güncel Film', myVal: myStats.moviesWatched, hisVal: profile?.movies_watched || 0 },
                      { label: 'Önceden Film', myVal: myStats.pastMoviesWatched, hisVal: profile?.past_movies_watched || 0 },
                      { label: 'İzlenen Bölüm', myVal: myStats.episodesWatched, hisVal: profile?.episodes_watched || 0 },
                      { label: 'Başarım', myVal: myStats.achievementsUnlocked, hisVal: profile?.achievements_unlocked || 0 },
                    ].map(row => {
                      const total = row.myVal + row.hisVal || 1;
                      const myPct = Math.round((row.myVal / total) * 100);
                      return (
                        <div key={row.label}>
                          <div className="flex justify-between text-[11px] font-bold mb-1">
                            <span className={row.myVal >= row.hisVal ? 'text-emerald-400 font-black font-mono' : 'text-ink-400 font-mono'}>
                              {row.myVal}
                            </span>
                            <span className="text-ink-300 text-[10px] uppercase tracking-wider">{row.label}</span>
                            <span className={row.hisVal >= row.myVal ? 'text-azure-400 font-black font-mono' : 'text-ink-400 font-mono'}>
                              {row.hisVal}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-azure-500/30 rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-500"
                              style={{ width: `${myPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-ink-900/50 border border-ink-800 rounded-3xl p-5 flex flex-col justify-center items-center text-center">
                  <Award size={36} className="text-gold-400 mb-2" />
                  <div className="text-sm font-black text-white mb-1">Ajan Rütbesi: {getAgentRankTitle(profile?.level || 1)}</div>
                  <p className="text-xs text-ink-400 max-w-xs">
                    Toplam {cinemaDna.ratingsCount} yapıma puan verdin ve yaklaşık {cinemaDna.estHours} saatini sinema evreninde geçirdin.
                  </p>
                </div>
              )}
            </div>

            {/* 4. BÖLÜM: KÖR NOKTALAR (AFİŞE TIKLAYINCA FİLM SAYFASI KARTI AÇILIR!) */}
            {!isOwnProfile && blindSpots.length > 0 && (
              <div className="bg-gradient-to-r from-emerald-950/30 via-ink-900/50 to-ink-950 border border-emerald-500/25 rounded-3xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Flame size={15} /> Onun Bayıldığı Ama Senin İzlemediklerin
                    </h3>
                    <p className="text-[10px] text-ink-400">
                      Afişe tıklayarak Film Kartını açabilir, sayaç başlatabilir, puanlayabilir veya Film Listendeki yerine gidebilirsin!
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {blindSpots.map(item => {
                    const alreadyInLib =
                      data.movies.some(m => m.title.toLowerCase() === item.cleanTitle.toLowerCase()) ||
                      data.series.some(s => s.title.toLowerCase() === item.cleanTitle.toLowerCase());
                    return (
                      <div
                        key={item.id}
                        onClick={() => openMediaDetailCard(item, true)}
                        className="bg-ink-950 border border-ink-800 hover:border-gold-500/50 rounded-2xl overflow-hidden flex flex-col group transition-all cursor-pointer hover:-translate-y-1 shadow-md"
                      >
                        <div className="relative aspect-[2/3] bg-ink-900 overflow-hidden">
                          {item.item_poster ? (
                            <img src={item.item_poster} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <Film size={20} className="text-ink-700 m-auto mt-8" />
                          )}
                          <div className="absolute top-1.5 right-1.5 bg-black/85 text-gold-400 text-[10px] font-black px-1.5 py-0.5 rounded border border-gold-500/30 flex items-center gap-0.5">
                            <Star size={9} className="fill-gold-400" /> {item.rating}
                          </div>
                          <div className="absolute inset-0 bg-ink-950/65 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                            <Eye size={20} className="text-gold-400 mb-1" />
                            <span className="text-[9px] font-black uppercase tracking-wider text-white">Film Kartını Aç</span>
                          </div>
                        </div>
                        <div className="p-2.5 flex-1 flex flex-col justify-between">
                          <div className="text-[11px] font-bold text-white line-clamp-1 mb-2 group-hover:text-gold-300 transition-colors">
                            {item.cleanTitle}
                          </div>
                          {alreadyInLib ? (
                            <span className="text-[9px] font-bold text-gold-400 bg-gold-500/10 border border-gold-500/25 py-1 rounded-lg text-center flex items-center justify-center gap-1">
                              <Play size={9} className="fill-current" /> Kartı & Sayacı Aç
                            </span>
                          ) : (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                onAddToLibrary(item);
                              }}
                              className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-colors"
                            >
                              <Plus size={11} strokeWidth={3} /> Ekle
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. BÖLÜM: İZLEME GEÇMİŞİ VE ORTAK PUAN KIYASLAMASI */}
            {!isOwnProfile && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Compass size={16} className="text-azure-400" /> İzleme Geçmişi & Puan Kıyaslaması
                  </h3>
                  <div className="flex bg-ink-900 p-1 rounded-xl border border-ink-800 self-start">
                    <button
                      onClick={() => { setLogFilter('all'); setVisibleLogsCount(6); }}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        logFilter === 'all' ? 'bg-ink-800 text-white' : 'text-ink-500 hover:text-ink-300'
                      }`}
                    >
                      Son İzlenenler
                    </button>
                    <button
                      onClick={() => { setLogFilter('shared'); setVisibleLogsCount(6); }}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        logFilter === 'shared' ? 'bg-emerald-500/20 text-emerald-400' : 'text-ink-500 hover:text-ink-300'
                      }`}
                    >
                      Ortak İzlenenler
                    </button>
                    <button
                      onClick={() => { setLogFilter('top'); setVisibleLogsCount(6); }}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        logFilter === 'top' ? 'bg-gold-500/20 text-gold-400' : 'text-ink-500 hover:text-ink-300'
                      }`}
                    >
                      En Yüksek Puanlılar
                    </button>
                  </div>
                </div>

                {friendLogs.length === 0 ? (
                  <div className="text-center py-12 border border-ink-800 border-dashed rounded-2xl text-sm text-ink-500">
                    Henüz kayıtlı bir izleme aktivitesi yok.
                  </div>
                ) : (
                  (() => {
                    const filteredLogs = [...friendLogs]
                      .filter(log => {
                        if (logFilter === 'all') return true;
                        if (logFilter === 'top') return Number(log.rating || 0) >= 8;
                        const cleanTitle = (log.item_title || '').replace(/\s\(S\d+\sB\d+\)$/i, '').trim().toLowerCase();
                        return (
                          data.movies.some(m => m.title.toLowerCase() === cleanTitle && m.watched) ||
                          data.series.some(s => s.title.toLowerCase() === cleanTitle && s.episodes?.some((e: any) => e.watched))
                        );
                      })
                      .sort((a, b) => (logFilter === 'top' ? Number(b.rating || 0) - Number(a.rating || 0) : 0))
                      .slice(0, 18);

                    const displayedLogs = filteredLogs.slice(0, visibleLogsCount);

                    if (filteredLogs.length === 0) {
                      return (
                        <div className="text-center py-10 border border-ink-800 border-dashed rounded-2xl text-xs text-ink-500">
                          Bu filtreye uygun izleme aktivitesi bulunamadı.
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {displayedLogs.map(log => {
                            const cleanLogTitle = (log.item_title || '').replace(/\s\(S\d+\sB\d+\)$/i, '').trim().toLowerCase();
                            const myMovieMatch = data.movies.find(m => m.title.toLowerCase() === cleanLogTitle);
                            const mySeriesMatch = data.series.find(s => s.title.toLowerCase() === cleanLogTitle);
                            const myMatch = log.item_type === 'movie' ? myMovieMatch : mySeriesMatch;
                            const iWatched =
                              myMovieMatch?.watched || (mySeriesMatch && mySeriesMatch.episodes?.some((e: any) => e.watched));

                            const hisRating = log.rating;
                            let myRating = myMovieMatch?.rating;
                            if (log.item_type === 'series' && mySeriesMatch) {
                              const ratedEps = mySeriesMatch.episodes.filter((e: any) => e.rating !== null);
                              if (ratedEps.length > 0)
                                myRating = ratedEps.reduce((a: number, b: any) => a + (b.rating || 0), 0) / ratedEps.length;
                            }

                            return (
                              <div
                                key={log.id}
                                onClick={() => openMediaDetailCard(log, true)}
                                className="bg-ink-900/50 hover:bg-ink-900 border border-ink-800/80 hover:border-gold-500/40 rounded-2xl p-3.5 flex gap-3.5 items-center transition-all cursor-pointer group"
                              >
                                <div className="w-14 aspect-[2/3] bg-ink-950 rounded-xl overflow-hidden shrink-0 border border-ink-800 relative">
                                  {log.item_poster ? (
                                    <img src={log.item_poster} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <Film size={18} className="text-ink-600 m-auto mt-6" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-bold text-white truncate group-hover:text-gold-300 transition-colors">
                                    {log.item_title}
                                  </h4>
                                  <div className="text-[10px] text-ink-500 mb-2">{timeAgo(log.created_at)}</div>

                                  {iWatched ? (
                                    <div className="inline-flex items-center gap-3 bg-ink-950 px-3 py-1 rounded-xl border border-ink-800">
                                      <div className="text-[11px] font-bold text-ink-400">
                                        O: <span className="text-azure-400 font-black">★ {hisRating || '-'}</span>
                                      </div>
                                      <div className="w-px h-3 bg-ink-800" />
                                      <div className="text-[11px] font-bold text-ink-400">
                                        Sen:{' '}
                                        <span className="text-emerald-400 font-black">
                                          ★ {myRating ? (myRating % 1 === 0 ? myRating : myRating.toFixed(1)) : '-'}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      {hisRating && (
                                        <span className="text-[10px] font-black text-gold-400 bg-gold-500/10 px-2 py-0.5 rounded-lg border border-gold-500/20">
                                          O: ★ {hisRating}
                                        </span>
                                      )}
                                      <span className="text-[10px] font-bold text-ink-500 bg-ink-950/80 px-2 py-0.5 rounded-lg border border-ink-800/60">
                                        Sen izlemedin
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {!myMatch ? (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      onAddToLibrary(log);
                                    }}
                                    className="w-9 h-9 rounded-xl bg-ink-800 hover:bg-emerald-500/20 text-ink-300 hover:text-emerald-400 flex items-center justify-center border border-ink-700 hover:border-emerald-500/30 shrink-0 transition-all"
                                    title="Kütüphaneme Ekle"
                                  >
                                    <Plus size={16} />
                                  </button>
                                ) : (
                                  <div
                                    className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0"
                                    title="Kütüphanende Mevcut"
                                  >
                                    <Check size={15} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {filteredLogs.length > 6 && (
                          <div className="mt-4 flex justify-center gap-3">
                            {visibleLogsCount < filteredLogs.length && (
                              <button
                                onClick={() => setVisibleLogsCount(prev => Math.min(filteredLogs.length, prev + 6))}
                                className="px-5 py-2.5 rounded-xl bg-ink-900 hover:bg-ink-800 border border-ink-700 text-xs font-black text-ink-200 uppercase tracking-wider transition-all"
                              >
                                Daha Fazla Göster ({filteredLogs.length - visibleLogsCount} kaldı)
                              </button>
                            )}
                            {visibleLogsCount > 6 && (
                              <button
                                onClick={() => setVisibleLogsCount(6)}
                                className="px-4 py-2.5 rounded-xl bg-ink-950 hover:bg-ink-900 border border-ink-800 text-xs font-bold text-ink-400 transition-all"
                              >
                                Listeyi Daralt
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            )}
          </div>
        ) : (
          /* CANLI SOHBET SEKMESİ */
          <div className="flex flex-col flex-1 overflow-hidden bg-ink-950 relative">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar" ref={chatScrollRef}>
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-ink-500 opacity-60">
                  <MessageSquare size={40} className="mb-3" />
                  <p className="text-sm font-bold uppercase tracking-widest">Sohbeti Başlat</p>
                </div>
              ) : (
                chatMessages.map(msg => renderChatMessageItem(msg, chatMessages, false))
              )}
            </div>

            <div className="p-3 sm:p-4 bg-ink-900 border-t border-ink-800 shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={onOpenMediaShare}
                  className="w-11 h-11 rounded-full bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 border border-violet-500/30 flex items-center justify-center shrink-0 transition-colors"
                  title="Film / Dizi Kartı Paylaş"
                >
                  <Film size={18} />
                </button>
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && onSendMessage()}
                  placeholder="Bir mesaj yaz..."
                  className="flex-1 bg-ink-950 border border-ink-700 rounded-full px-5 py-3 text-sm text-white focus:border-azure-500 outline-none"
                />
                <button
                  onClick={onSendMessage}
                  disabled={!chatInput.trim()}
                  className="w-12 h-12 rounded-full bg-azure-600 hover:bg-azure-500 text-white flex items-center justify-center shrink-0 disabled:opacity-50 transition-colors shadow-lg shadow-azure-500/20"
                >
                  <Send size={18} className="ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* AFİŞE TIKLANDIĞINDA AÇILAN FİLM SAYFASI KARTI (MOVIEROW İLE BİREBİR AYNI) */}
        {/* ========================================================================= */}
        {selectedMediaCard && (() => {
          const myMovie = data.movies.find(
            m => m.title.toLowerCase() === selectedMediaCard.cleanTitle.toLowerCase()
          );
          const mySeriesItem = data.series.find(
            s => s.title.toLowerCase() === selectedMediaCard.cleanTitle.toLowerCase()
          );

          // EĞER FİLM KÜTÜPHANENDE VARSA GERÇEK MOVIEROW VERİLERİNİ KULLAN, YOKSA ÖNİZLEME OLUŞTUR
          const displayTitle = myMovie?.title || selectedMediaCard.cleanTitle;
          const displayPoster = myMovie?.posterUrl || selectedMediaCard.poster;
          const displayYear = myMovie?.year || selectedMediaCard.year || '';
          const displayRuntime = myMovie?.runtime || null;
          const displayGenres = myMovie?.genres?.length ? myMovie.genres : (selectedMediaCard.genres || []);
          const collectionName = myMovie?.collectionId
            ? data.collections.find(c => c.id === myMovie.collectionId)?.name
            : undefined;

          // İZLEME LİNKLERİ (MoviesPage.tsx MovieRow ile birebir aynı)
          const watchLinks: { href: string; text: string; logo: string | null; icon: any }[] = [];
          if (myMovie?.customUrl) {
            watchLinks.push({ href: myMovie.customUrl, text: 'Özel Kaynak', logo: null, icon: ExternalLink });
          }
          if (myMovie?.watchProviders && myMovie.watchProviders.length > 0) {
            myMovie.watchProviders.slice(0, 2).forEach(provider => {
              let finalHref = provider.link || '';
              const pName = provider.providerName.toLowerCase();
              if (pName.includes('netflix')) finalHref = `https://www.netflix.com/search?q=${encodeURIComponent(displayTitle)}`;
              else if (pName.includes('amazon') || pName.includes('prime')) finalHref = `https://www.primevideo.com/search/ref=atv_sr_sug_1?phrase=${encodeURIComponent(displayTitle)}`;
              else if (pName.includes('disney')) finalHref = `https://www.disneyplus.com/search?q=${encodeURIComponent(displayTitle)}`;
              else if (pName.includes('blutv')) finalHref = `https://www.blutv.com/arama?q=${encodeURIComponent(displayTitle)}`;
              else if (pName.includes('mubi')) finalHref = `https://mubi.com/tr/search?query=${encodeURIComponent(displayTitle)}`;
              else if (pName.includes('apple')) finalHref = `https://tv.apple.com/tr/search?q=${encodeURIComponent(displayTitle)}`;
              watchLinks.push({ href: finalHref, text: provider.providerName, logo: provider.logoUrl, icon: PlayCircle });
            });
          }
          const searchQuery = encodeURIComponent(`${displayTitle} ${displayYear} izle`);
          watchLinks.push({ href: `https://www.google.com/search?q=${searchQuery}`, text: "Google'da Bul", logo: null, icon: Search });

          if (data.altWatchTemplate && (myMovie?.imdbId || data.altWatchTemplate.includes('{slug}') || data.altWatchTemplate.includes('{title}'))) {
            const charMap: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
            const slug = displayTitle.toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, match => charMap[match]).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const finalAltHref = data.altWatchTemplate
              .replace('{imdb}', myMovie?.imdbId || '')
              .replace('{slug}', slug)
              .replace('{title}', encodeURIComponent(displayTitle))
              .replace('{year}', displayYear);
            watchLinks.push({ href: finalAltHref, text: 'Alternatif', logo: null, icon: PlayCircle });
          }

          const timerInfo = myMovie && !myMovie.watched && myMovie.startedAt ? getMovieTimerInfo(myMovie, nowMs) : null;
          const anotherTimerActive = Boolean(activeTimerMovie && myMovie && activeTimerMovie.id !== myMovie.id);
          const isPlanned = Boolean(myMovie && plannedMovieIds.has(myMovie.id));

          return (
            <div
              className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
              onClick={() => setSelectedMediaCard(null)}
            >
              <div
                onClick={e => e.stopPropagation()}
                className="w-full max-w-3xl bg-ink-950 border border-gold-500/35 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 relative"
              >
                {/* ÜST BAR: AJAN DEĞERLENDİRMESİ VE KAPAT */}
                <div className="flex items-center justify-between border-b border-ink-800/80 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-gold-500/15 text-gold-300 border border-gold-500/30 flex items-center gap-1.5">
                      <Film size={12} /> Film Sayfası Kartı
                    </span>
                    {selectedMediaCard.rating && (
                      <span className="text-xs font-black text-azure-300 bg-azure-500/15 px-2.5 py-1 rounded-lg border border-azure-500/30 flex items-center gap-1">
                        <Star size={11} className="fill-azure-400 text-azure-400" />
                        {profile?.nickname?.split(' ')[0] || 'Ajan'} Puanı: {selectedMediaCard.rating}/10
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedMediaCard(null)}
                    className="w-8 h-8 rounded-full bg-ink-900 hover:bg-ink-800 text-ink-300 hover:text-white flex items-center justify-center border border-ink-700"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* MOVIESPAGE.TSX MOVIEROW KARTININ BİREBİR AYNISI */}
                <div className="bg-ink-900/60 border border-ink-800/80 rounded-2xl p-3 sm:p-4 hover:border-gold-500/40 transition-all flex flex-col md:flex-row gap-3.5 md:gap-4 md:items-center shadow-lg">
                  <div className="flex gap-3.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (myMovie) setDetailMovie(myMovie);
                      }}
                      title={myMovie ? 'Sinema Kartını & Detayları Gör' : 'Film Görseli'}
                      className="w-16 sm:w-20 flex-shrink-0 aspect-[2/3] bg-ink-900 rounded-xl overflow-hidden flex items-center justify-center border border-ink-700/60 shadow-md relative group/poster cursor-pointer self-start md:self-center"
                    >
                      {displayPoster ? (
                        <img
                          src={displayPoster}
                          alt={displayTitle}
                          className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <ImageIcon size={20} className="text-ink-600" />
                      )}
                      {myMovie && (
                        <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/poster:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                          <div className="w-7 h-7 rounded-full bg-gold-500/90 text-ink-950 flex items-center justify-center shadow-md">
                            <Eye size={14} />
                          </div>
                        </div>
                      )}
                    </button>

                    <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (myMovie) setDetailMovie(myMovie);
                          }}
                          className={`font-bold text-sm sm:text-base truncate text-left hover:text-gold-400 transition-colors ${
                            myMovie?.watched ? 'text-ink-500 line-through' : 'text-ink-100'
                          }`}
                        >
                          {displayTitle}
                        </button>
                        {myMovie?.watched && myMovie.isPastWatch && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                            <History size={9} /> Önceden
                          </span>
                        )}
                        {myMovie && !myMovie.watched && myMovie.inPastQueue && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                            <History size={9} /> Eskiden Sırada
                          </span>
                        )}
                        {collectionName && (
                          <span className="text-[9px] text-gold-400 bg-gold-500/10 border border-gold-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 truncate">
                            <Boxes size={9} className="flex-shrink-0" /> <span className="truncate">{collectionName}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-ink-400 mb-2">
                        {displayYear && (
                          <span className="flex items-center gap-1">
                            <Calendar size={11} /> {displayYear}
                          </span>
                        )}
                        {displayRuntime && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} /> {displayRuntime} dk
                          </span>
                        )}
                        {myMovie?.watched && !myMovie.isPastWatch && myMovie.actualRuntime && myMovie.runtime && myMovie.actualRuntime < myMovie.runtime && (
                          <span className="flex items-center gap-0.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1 rounded font-bold text-[9px]">
                            <Zap size={9} /> {myMovie.actualRuntime} dk
                          </span>
                        )}
                        {displayGenres.length > 0 && <span className="hidden sm:inline px-0.5 opacity-40">•</span>}
                        {displayGenres.length > 0 && <span className="truncate">{displayGenres.join(', ')}</span>}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap mt-auto">
                        {myMovie?.watched && myMovie.rating !== null && (
                          <div className="flex items-center gap-1 mr-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm ${ratingBgClass(myMovie.rating)}`}>
                              Senin Puanın: {myMovie.rating}
                            </span>
                            {!myMovie.isPastWatch && myMovie.watchedAt && (
                              <span className="text-[10px] text-ink-500 hidden sm:inline">
                                {formatDateShort(myMovie.watchedAt)}
                              </span>
                            )}
                          </div>
                        )}

                        {watchLinks.map((link, idx) => {
                          const Icon = link.icon;
                          return (
                            <a
                              key={idx}
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1 bg-ink-800/60 hover:bg-gold-900/40 text-gold-400/90 hover:text-gold-300 border border-gold-500/20 hover:border-gold-500/40 px-2 py-0.5 rounded text-[10px] font-semibold transition-all"
                            >
                              {link.logo ? (
                                <img src={link.logo} alt="Platform" className="w-3 h-3 rounded-[2px] object-cover" />
                              ) : (
                                <Icon size={10} />
                              )}
                              <span>{link.text}</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* SAĞ AKSİYON BUTONLARI (BAŞLAT / SAYAÇ / PUANLA / GERİ AL / EKLE) */}
                  <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto bg-ink-950/50 md:bg-transparent p-2.5 md:p-0 rounded-xl border border-ink-800/50 md:border-0 flex-shrink-0">
                    {selectedMediaCard.type === 'movie' ? (
                      myMovie ? (
                        <div className="flex items-center gap-1.5 w-full md:w-auto">
                          {myMovie.watched ? (
                            <button
                              onClick={() => unwatchMovie(myMovie.id)}
                              className="text-xs text-ink-300 hover:text-white bg-ink-800 hover:bg-ink-700 px-3.5 py-2 rounded-xl transition-colors border border-ink-700 font-bold w-full md:w-auto text-center"
                            >
                              Geri Al
                            </button>
                          ) : myMovie.inPastQueue ? (
                            <button
                              type="button"
                              onClick={() => handleRequestRateFromCard(myMovie)}
                              className="flex items-center justify-center gap-1.5 text-xs px-4 py-2 rounded-xl transition-all font-bold w-full md:w-auto bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white shadow-md"
                            >
                              <Star size={12} className="fill-current" /> Puanla
                            </button>
                          ) : isPlanned ? (
                            <div className="flex items-center justify-center gap-1 text-xs px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 font-bold w-full md:w-auto">
                              <Lock size={12} /> Takvimde Planlı
                            </div>
                          ) : (
                            <>
                              {timerInfo ? (
                                <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold w-full md:w-auto justify-center">
                                  <Timer size={13} className={timerInfo.isPaused ? 'text-amber-400' : 'animate-pulse text-emerald-400'} />
                                  <span className="font-mono">{timerInfo.formattedRemaining}</span>
                                  <button
                                    type="button"
                                    onClick={() => togglePauseWatchingMovie(myMovie.id)}
                                    title={timerInfo.isPaused ? 'Devam Et' : 'Duraklat'}
                                    className="ml-1 text-amber-300 hover:text-white p-0.5"
                                  >
                                    {timerInfo.isPaused ? <Play size={12} className="fill-current" /> : <Pause size={12} />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => cancelWatchingMovie(myMovie.id)}
                                    title="Sayacı İptal Et"
                                    className="ml-0.5 text-ink-400 hover:text-red-400 p-0.5"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startWatchingMovie(myMovie.id, false)}
                                  title={anotherTimerActive ? 'Başka bir filmin sayacı açık!' : 'Geri Sayımı Başlat'}
                                  disabled={anotherTimerActive}
                                  className={`flex items-center justify-center gap-1.5 text-xs px-3.5 py-2 rounded-xl transition-all font-bold border w-full md:w-auto ${
                                    anotherTimerActive
                                      ? 'bg-ink-900/50 text-ink-600 border-ink-800 cursor-not-allowed'
                                      : 'bg-ink-800 hover:bg-emerald-900/40 text-emerald-400 border-emerald-500/40'
                                  }`}
                                >
                                  {anotherTimerActive ? <Lock size={11} /> : <Play size={11} className="fill-current" />} Başlat
                                </button>
                              )}

                              <button
                                onClick={() => handleRequestRateFromCard(myMovie)}
                                title={
                                  timerInfo && !timerInfo.canRateWithTimer
                                    ? `En az ${timerInfo.minRequiredMins} dk geçmeden puanlanamaz!`
                                    : 'Filmi Puanla'
                                }
                                disabled={Boolean(timerInfo && !timerInfo.canRateWithTimer)}
                                className={`flex items-center justify-center gap-1.5 text-xs px-3.5 py-2 rounded-xl transition-all font-bold w-full md:w-auto ${
                                  timerInfo && !timerInfo.canRateWithTimer
                                    ? 'bg-ink-800/50 text-ink-600 border border-ink-800 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-ink-950 shadow-md shadow-gold-500/15'
                                }`}
                              >
                                {timerInfo && !timerInfo.canRateWithTimer ? (
                                  <>
                                    <Lock size={11} /> {timerInfo.minRequiredMins - timerInfo.elapsedMins} dk
                                  </>
                                ) : (
                                  <>
                                    <Star size={12} className="fill-current" /> Puanla
                                  </>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        /* KÜTÜPHANEDE YOKSA TEK TIKLA EKLE (EKLENDİĞİ AN BAŞLAT & PUANLA AKTİF OLUR) */
                        <button
                          onClick={() =>
                            onAddToLibrary(
                              {
                                title: selectedMediaCard.cleanTitle,
                                type: 'movie',
                                poster: selectedMediaCard.poster,
                                genres: selectedMediaCard.genres || [],
                                year: selectedMediaCard.year || '',
                              },
                              true
                            )
                          }
                          className="w-full md:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
                        >
                          <Plus size={14} strokeWidth={3} /> Kütüphaneme Ekle (Sayaç & Puanla)
                        </button>
                      )
                    ) : (
                      /* DİZİ İSE */
                      !mySeriesItem && (
                        <button
                          onClick={() =>
                            onAddToLibrary(
                              {
                                title: selectedMediaCard.cleanTitle,
                                type: 'series',
                                poster: selectedMediaCard.poster,
                                genres: selectedMediaCard.genres || [],
                                year: selectedMediaCard.year || '',
                              },
                              true
                            )
                          }
                          className="w-full md:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg"
                        >
                          <Plus size={14} strokeWidth={3} /> Diziyi Kütüphaneme Ekle
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* ARKADAŞIN ELEŞTİRMEN NOTU VEYA ETİKETLERİ VARSA GÖSTER */}
                {(selectedMediaCard.note || (selectedMediaCard.reviewTags && selectedMediaCard.reviewTags.length > 0)) && (
                  <div className="bg-ink-900/40 border border-ink-800/70 rounded-2xl p-3.5 space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-1.5">
                      <Info size={12} className="text-azure-400" /> {profile?.nickname || 'Ajan'} Değerlendirmesi
                    </div>
                    {selectedMediaCard.reviewTags && selectedMediaCard.reviewTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedMediaCard.reviewTags.map(tag => (
                          <span
                            key={tag}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-ink-950 text-ink-300 border border-ink-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {selectedMediaCard.note && (() => {
                      const rawNote = selectedMediaCard.note || '';
                      const hasSpoiler =
                        selectedMediaCard.isSpoiler ||
                        rawNote.toLowerCase().includes('[spoiler]') ||
                        rawNote.toLowerCase().includes('#spoiler');
                      const cleanNote = rawNote.replace(/[spoiler]/gi, '').replace(/#spoiler/gi, '').trim();

                      if (hasSpoiler && !spoilerRevealed) {
                        return (
                          <div
                            onClick={() => setSpoilerRevealed(true)}
                            className="cursor-pointer bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 text-center text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            <span className="text-[10px] font-black uppercase">
                              ⚠️ Spoiler İçeriyor — Okumak İçin Tıkla
                            </span>
                          </div>
                        );
                      }
                      return <p className="text-xs sm:text-sm text-ink-200 italic">"{cleanNote}"</p>;
                    })()}
                  </div>
                )}

                {/* ALT BÖLÜM: FİLM SAYFASINDAKİ İLGİLİ FİLME GİT BUTONU */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  {myMovie && (
                    <button
                      type="button"
                      onClick={() => setDetailMovie(myMovie)}
                      className="px-4 py-3 rounded-xl bg-ink-900 hover:bg-ink-800 border border-ink-700 text-gold-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Eye size={15} /> Sinema Künyesini Gör
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleNavigateToMediaPage(selectedMediaCard, true)}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 text-ink-950 text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-gold-500/20 transition-all"
                  >
                    <ExternalLink size={16} />
                    {myMovie || mySeriesItem
                      ? selectedMediaCard.type === 'series'
                        ? 'Dizi Sayfasında Bu Diziye Git'
                        : 'Film Sayfasında Bu Filme Git'
                      : `Kütüphaneme Ekle & ${selectedMediaCard.type === 'series' ? 'Dizi' : 'Film'} Sayfasında Git`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* KART İÇİNDEN DOĞRUDAN PUANLAMA MODALI */}
        {ratingTarget && (
          <RatingModal
            title={ratingTarget.title}
            subtitle={ratingTarget.year ? `Çıkış Yılı: ${ratingTarget.year}` : 'Film'}
            initialIsPastWatch={Boolean(ratingTarget.isPastWatch || ratingTarget.inPastQueue)}
            onRate={(rating, note, detailedRating, reviewTags, isPastWatch) => {
              watchMovie(ratingTarget.id, rating, note, detailedRating, reviewTags, isPastWatch);
              setRatingTarget(null);
            }}
            onClose={() => setRatingTarget(null)}
          />
        )}

        {/* KART İÇİNDEN DOĞRUDAN SİNEMA KÜNYESİ (MEDIADETAILMODAL) */}
        {detailMovie && (
          <MediaDetailModal
            target={{ type: 'movie', data: detailMovie }}
            onClose={() => setDetailMovie(null)}
          />
        )}
      </div>
    </div>
  );
}