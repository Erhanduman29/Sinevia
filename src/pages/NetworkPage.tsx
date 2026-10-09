import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Users, UserPlus, Trophy, Activity, Check, X, Star, Plus, Copy, RefreshCw,
  Trash2, Medal, Film, Tv, ShieldAlert, Zap, Sparkles, Inbox, Send, Gift,
  ListVideo, Eye, Info, MessageSquare, MessageCircle, Crown, Radio, Flame,
  ExternalLink, FileText, Award, History
} from 'lucide-react';
import { useApp, isPositiveTag, getMovieTimerInfo } from '../context/AppContext';
import type { ShowcaseItem } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { uid } from '../lib/utils';
import AgentProfileModal from '../components/AgentProfileModal';
import ShowcaseEditorModal from '../components/ShowcaseEditorModal';
import ChatHubModal, { renderChatMessageBubble } from '../components/ChatHubModal';
import RecommendationModals from '../components/RecommendationModals';
import type { Movie } from '../types';

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

function getLiveRadarStatus(cw: any, nowMs = Date.now()) {
  if (!cw) return null;
  let parsedCw = cw;
  if (typeof cw === 'string') {
    try { parsedCw = JSON.parse(cw); } catch { return null; }
  }
  if (!parsedCw || !parsedCw.title) return null;

  if (parsedCw.updatedAt) {
    const diffHours = (nowMs - new Date(parsedCw.updatedAt).getTime()) / 3600000;
    if (diffHours > 6) return null;
  }

  const maxMins = parsedCw.runtime && parsedCw.runtime > 0 ? Number(parsedCw.runtime) : 115;
  let elapsedMins = Number(parsedCw.elapsedMins) || 0;
  let isPaused = Boolean(parsedCw.isPaused);

  if (parsedCw.startedAt && typeof parsedCw.startedAt === 'string') {
    if (parsedCw.startedAt.startsWith('PAUSED:')) {
      isPaused = true;
      const sec = parseInt(parsedCw.startedAt.slice(7), 10) || 0;
      elapsedMins = Math.floor(sec / 60);
    } else {
      const startMs = new Date(parsedCw.startedAt).getTime();
      if (!isNaN(startMs)) {
        elapsedMins = Math.min(maxMins, Math.max(0, Math.floor((nowMs - startMs) / 60000)));
      }
    }
  }
  const progress = Math.min(100, Math.max(3, Math.round((elapsedMins / maxMins) * 100)));
  return {
    id: parsedCw.id || '',
    title: parsedCw.title,
    posterUrl: parsedCw.posterUrl || null,
    year: parsedCw.year || '',
    elapsedMins,
    maxMins,
    isPaused,
    progress
  };
}

type TabType = 'feed' | 'friends' | 'lists' | 'leaderboard';
type FeedFilterType = 'all' | 'masterpieces' | 'notes' | 'movies' | 'series';
type LeaderboardCategory = 'xp' | 'level' | 'movies' | 'past_movies' | 'episodes' | 'achievements' | 'quests';
type LeaderboardScope = 'global' | 'friends';
type ProfileTabType = 'stats' | 'chat';

export default function NetworkPage() {
  const { data, showToast, addMovie, addSeries, updateShowcase } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [feedFilter, setFeedFilter] = useState<FeedFilterType>('all');
  const [leaderboardCategory, setLeaderboardCategory] = useState<LeaderboardCategory>('xp');
  const [leaderboardScope, setLeaderboardScope] = useState<LeaderboardScope>('global');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});

  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
  const profilesMapRef = useRef<Record<string, any>>({});

  const [friends, setFriends] = useState<any[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<any[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});

  // PROFİL MODALI STATELERİ
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileTabType>('stats');
  const [friendLogs, setFriendLogs] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [profileMediaShareOpen, setProfileMediaShareOpen] = useState(false);

  // AKIŞ VE TAVSİYE LİSTESİ MODALLARI
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [viewingList, setViewingList] = useState<any | null>(null);
  const [listToDelete, setListToDelete] = useState<string | null>(null);

  const [showShowcaseModal, setShowShowcaseModal] = useState(false);
  const [isChatHubOpen, setIsChatHubOpen] = useState(false);
  const [initialDirectChatId, setInitialDirectChatId] = useState<string | null>(null);
  const [friendToRemove, setFriendToRemove] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const viewingProfileIdRef = useRef<string | null>(null);

  const [syncTick, setSyncTick] = useState(0);
  const [radarTick, setRadarTick] = useState(Date.now());

  useEffect(() => { profilesMapRef.current = profilesMap; }, [profilesMap]);
  useEffect(() => { viewingProfileIdRef.current = viewingProfileId; }, [viewingProfileId]);

  useEffect(() => {
    const t = setInterval(() => setRadarTick(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // YEREL KULLANICININ İSTATİSTİKLERİ: VERİTABANINI BEKLEMEDEN ANINDA HESAPLAR
  const localMoviesWatched = useMemo(() => data.movies.filter((m: Movie) => m.watched && !m.isPastWatch).length, [data.movies]);
  const localPastMoviesWatched = useMemo(() => data.movies.filter((m: Movie) => m.watched && m.isPastWatch).length, [data.movies]);

  const myStatsSummary = useMemo(() => ({
    xp: data.totalXp || 0,
    level: data.level || 1,
    moviesWatched: localMoviesWatched,
    pastMoviesWatched: localPastMoviesWatched,
    episodesWatched: data.series.reduce((sum: number, s: any) => sum + (s.episodes?.filter((e: any) => e.watched).length || 0), 0),
    achievementsUnlocked: data.achievements.reduce((acc: number, curr: any) => acc + (curr.unlockedTiers?.length || 0), 0),
  }), [data.totalXp, data.level, localMoviesWatched, localPastMoviesWatched, data.series, data.achievements]);

  const openProfileModal = async (targetId: string, initialTab: ProfileTabType = 'stats') => {
    if (!targetId) return;
    setViewingProfileId(targetId);
    setProfileTab(initialTab);
    setChatMessages([]);

    const [{ data: logsData }, { data: freshProfile }] = await Promise.all([
      supabase.from('network_logs').select('*').eq('agent_id', targetId).order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('*').eq('agent_id', targetId).maybeSingle()
    ]);
    if (freshProfile) {
      setProfilesMap(prev => ({ ...prev, [targetId]: freshProfile }));
    }
    setFriendLogs(logsData || []);
  };

  useEffect(() => {
    const loadProfileChat = async () => {
      if (viewingProfileId && viewingProfileId !== data.agentId && profileTab === 'chat' && data.agentId) {
        const { data: rawMsgs } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${data.agentId},receiver_id.eq.${viewingProfileId}),and(sender_id.eq.${viewingProfileId},receiver_id.eq.${data.agentId})`)
          .order('created_at', { ascending: true });

        setChatMessages((prev: any[]) => {
          const newMsgs = (rawMsgs || []).filter((m: any) => !m.group_id);
          const fetchedIds = new Set(newMsgs.map((m: any) => m.id));
          const localOnly = prev.filter((m: any) => !fetchedIds.has(m.id) && m.sender_id === data.agentId && m.receiver_id === viewingProfileId && !m.group_id);
          return [...newMsgs, ...localOnly].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });

        await supabase.from('messages').update({ is_read: true }).eq('receiver_id', data.agentId).eq('sender_id', viewingProfileId).eq('is_read', false);
      }
    };
    loadProfileChat();
  }, [viewingProfileId, profileTab, data.agentId, syncTick]);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!data.agentId) return;
    if (!isSilent) setRefreshing(true);

    try {
      const { data: friendshipsData } = await supabase.from('friendships').select('*').or(`requester_id.eq.${data.agentId},receiver_id.eq.${data.agentId}`);
      const fList = friendshipsData || [];
      const acceptedIds = new Set<string>();
      const incoming: any[] = [];
      const outgoing: any[] = [];

      fList.forEach((f: any) => {
        if (f.status === 'accepted') { acceptedIds.add(f.requester_id === data.agentId ? f.receiver_id : f.requester_id); }
        else if (f.status === 'pending') { if (f.receiver_id === data.agentId) incoming.push(f); else outgoing.push(f); }
      });

      const allRelevantIds = Array.from(new Set([data.agentId, ...Array.from(acceptedIds), ...incoming.map((i: any) => i.requester_id), ...outgoing.map((o: any) => o.receiver_id)]));

      const { data: recData } = await supabase.from('recommendations').select('*').or(`receiver_id.eq.${data.agentId},sender_id.eq.${data.agentId}`).order('created_at', { ascending: false });
      const recList = recData || [];
      recList.forEach((r: any) => {
        if (!allRelevantIds.includes(r.sender_id)) allRelevantIds.push(r.sender_id);
        if (!allRelevantIds.includes(r.receiver_id)) allRelevantIds.push(r.receiver_id);
      });
      setRecommendations(recList);

      const { data: unreadDataRaw } = await supabase.from('messages').select('sender_id, group_id').eq('receiver_id', data.agentId).eq('is_read', false);
      const unreadData = (unreadDataRaw || []).filter((m: any) => !m.group_id);

      const unreads: Record<string, number> = {};
      unreadData.forEach((msg: any) => { unreads[msg.sender_id] = (unreads[msg.sender_id] || 0) + 1; });
      setUnreadMessages(unreads);

      let pMap = { ...profilesMapRef.current };
      if (allRelevantIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('*').in('agent_id', allRelevantIds);
        (profilesData || []).forEach((p: any) => { 
          // KENDİ VERİMİZİ ZORLA DÜZELTİYORUZ (YAMA)
          if (p.agent_id === data.agentId) {
            p.movies_watched = localMoviesWatched;
            p.past_movies_watched = localPastMoviesWatched;
          }
          pMap[p.agent_id] = p; 
        });
      }

      const { data: leadersData } = await supabase.from('profiles').select('*').order('total_xp', { ascending: false }).limit(100);
      if (leadersData) {
        leadersData.forEach((p: any) => { 
          // KENDİ VERİMİZİ ZORLA DÜZELTİYORUZ (YAMA)
          if (p.agent_id === data.agentId) {
            p.movies_watched = localMoviesWatched;
            p.past_movies_watched = localPastMoviesWatched;
          }
          pMap[p.agent_id] = p; 
        });
      }
      setProfilesMap({ ...pMap });
      setLeaderboard(leadersData || []);

      const acceptedFriends = Array.from(acceptedIds).map((id: string) => {
        const profile = pMap[id] || { nickname: 'Ajan Aranıyor...', agent_id: id };
        const friendship = fList.find((f: any) => f.status === 'accepted' && (f.requester_id === id || f.receiver_id === id));
        return { ...profile, friendship_id: friendship?.id };
      }).filter((f: any) => f.friendship_id);

      setFriends(acceptedFriends); setPendingIncoming(incoming); setPendingOutgoing(outgoing);

      if (acceptedIds.size > 0) {
        const { data: logsData } = await supabase.from('network_logs').select('*').in('agent_id', Array.from(acceptedIds)).order('created_at', { ascending: false }).limit(60);
        setFeed(logsData || []);
      } else { setFeed([]); }

    } catch (error: any) { console.error('Ağ hatası:', error); }
    finally { if (!isSilent) setLoading(false); setRefreshing(false); }
  }, [data.agentId, localMoviesWatched, localPastMoviesWatched]);

  useEffect(() => {
    fetchData();
    if (!data.agentId) return;

    const channel = supabase.channel('sinevia_global_socket')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        const newMsg = payload.new;
        const vTarget = viewingProfileIdRef.current;
        if (vTarget && !newMsg.group_id) {
          if ((newMsg.sender_id === data.agentId && newMsg.receiver_id === vTarget) ||
              (newMsg.sender_id === vTarget && newMsg.receiver_id === data.agentId)) {
            setChatMessages((prev: any[]) => prev.some((m: any) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
          }
        }
        setSyncTick(t => t + 1);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload: any) => {
        if (payload.new && payload.new.agent_id) {
          setProfilesMap(prev => {
            const updated = { ...payload.new };
            // GELEN SOKET VERİSİNDE DE KENDİ VERİMİZİ DÜZELTİYORUZ
            if (updated.agent_id === data.agentId) {
              updated.movies_watched = localMoviesWatched;
              updated.past_movies_watched = localPastMoviesWatched;
            }
            return { ...prev, [updated.agent_id]: updated };
          });
        }
        setSyncTick(t => t + 1);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_group_members' }, () => setSyncTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'network_logs' }, () => setSyncTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recommendations' }, () => setSyncTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => setSyncTick(t => t + 1))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [data.agentId, fetchData, localMoviesWatched, localPastMoviesWatched]);

  useEffect(() => {
    if (syncTick > 0) fetchData(true);
  }, [syncTick, fetchData]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages]);

  const handleProfileSendMessage = async (customContent?: string) => {
    const content = (customContent !== undefined ? customContent : chatInput).trim();
    if (!content || !viewingProfileId) return;
    if (customContent === undefined) setChatInput('');
    try {
      const newMsg = { id: uid(), sender_id: data.agentId, receiver_id: viewingProfileId, group_id: null, content, created_at: new Date().toISOString(), is_read: false };
      setChatMessages((prev: any[]) => [...prev, newMsg]);
      await supabase.from('messages').insert([newMsg]);
      setSyncTick(t => t + 1);
    } catch { showToast('Mesaj gönderilemedi', 'error'); }
  };

  const handleSendRequest = async () => {
    const code = friendCode.trim().toUpperCase();
    if (!code) return;
    if (code === data.agentId) { showToast('Kendini ekleyemezsin!', 'warning'); return; }
    if (friends.some((f: any) => f.agent_id === code) || pendingOutgoing.some((p: any) => p.receiver_id === code) || pendingIncoming.some((p: any) => p.requester_id === code)) { showToast('Zaten bir bağınız var.', 'warning'); return; }

    try {
      const { data: targetProfile } = await supabase.from('profiles').select('agent_id').eq('agent_id', code).maybeSingle();
      if (!targetProfile) { showToast('Bu kimlik koduna sahip bir kullanıcı bulunamadı!', 'error'); return; }
      await supabase.from('friendships').insert([{ id: uid(), requester_id: data.agentId, receiver_id: code, status: 'pending' }]);
      showToast('Arkadaşlık isteği gönderildi!', 'success'); setFriendCode(''); setSyncTick(t => t + 1);
    } catch { showToast('İstek gönderilirken hata oluştu.', 'error'); }
  };

  const handleAccept = async (friendshipId: string) => {
    try { await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId); showToast('Kabul edildi!', 'success'); setSyncTick(t => t + 1); }
    catch { showToast('Hata oluştu.', 'error'); }
  };

  const handleRemove = async (friendshipId: string, isReject = false) => {
    try { await supabase.from('friendships').delete().eq('id', friendshipId); showToast(isReject ? 'İstek reddedildi.' : 'Arkadaşlıktan çıkarıldı.', 'info'); setSyncTick(t => t + 1); }
    catch { showToast('Hata oluştu.', 'error'); }
  };

  const handleAddToLibrary = (item: any, isFromList = false) => {
    const title = isFromList ? item.title : item.item_title;
    const type = isFromList ? item.type : item.item_type;
    const poster = isFromList ? (item.poster || item.posterUrl) : item.item_poster;
    const genres = item.genres || [];
    const year = item.year || '';
    const cleanTitle = (title || '').replace(/\s\(S\d+\sB\d+\)$/i, '').trim();
    const success = type === 'series' ? addSeries(cleanTitle, genres, [1], poster) : addMovie(cleanTitle, year, genres, null, undefined, poster);
    if (success) showToast(`"${cleanTitle}" kütüphanene eklendi!`, 'success');
  };

  // AKIŞ DETAY MODALINDAN DOĞRUDAN FİLM / DİZİ LİSTESİNE YÖNLENDİRME
  const handleNavigateFromLog = (logItem: any, addIfMissing = false) => {
    const cleanTitle = (logItem.item_title || '').replace(/\s\(S\d+\sB\d+\)$/i, '').trim();
    const alreadyInLib =
      data.movies.some((m: Movie) => m.title.toLowerCase() === cleanTitle.toLowerCase()) ||
      data.series.some((s: any) => s.title.toLowerCase() === cleanTitle.toLowerCase());

    if (!alreadyInLib && addIfMissing) {
      handleAddToLibrary(logItem, false);
    }

    try {
      sessionStorage.setItem('sinevia_focus_media_title', cleanTitle);
    } catch {}

    const targetTab = logItem.item_type === 'series' ? 'series' : 'movies';
    setSelectedLog(null);
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: targetTab }));
  };

  const handleViewList = async (list: any) => {
    setViewingList(list);
    if (list.status === 'pending' && list.receiver_id === data.agentId) {
      await supabase.from('recommendations').update({ status: 'viewed' }).eq('id', list.id);
      setSyncTick(t => t + 1);
    }
  };

  const handleSaveShowcase = async (newShowcase: ShowcaseItem[]) => {
    updateShowcase(newShowcase);
    setShowShowcaseModal(false);
    if (data.agentId) {
      await supabase.from('profiles').update({ showcase: newShowcase }).eq('agent_id', data.agentId);
      setProfilesMap(prev => ({
        ...prev,
        [data.agentId!]: { ...(prev[data.agentId!] || {}), showcase: newShowcase }
      }));
    }
  };

  const liveWatchingList = useMemo(() => {
    const list: { friend: any; radar: NonNullable<ReturnType<typeof getLiveRadarStatus>>; isMe?: boolean }[] = [];

    const myActiveMovie = data.movies.find((m: Movie) => !m.watched && m.startedAt);
    if (myActiveMovie && myActiveMovie.startedAt) {
      const tInfo = getMovieTimerInfo(myActiveMovie, radarTick);
      const progress = Math.min(100, Math.max(3, Math.round((tInfo.elapsedMins / tInfo.maxMins) * 100)));
      list.push({
        friend: { agent_id: data.agentId, nickname: `${data.nickname || 'Sen'} (Sen)` },
        radar: {
          id: myActiveMovie.id,
          title: myActiveMovie.title,
          posterUrl: myActiveMovie.posterUrl || null,
          year: myActiveMovie.year || '',
          elapsedMins: tInfo.elapsedMins,
          maxMins: tInfo.maxMins,
          isPaused: tInfo.isPaused,
          progress
        },
        isMe: true
      });
    }

    friends.forEach((f: any) => {
      if (f.agent_id === data.agentId) return;
      const prof = profilesMap[f.agent_id] || f;
      const radar = getLiveRadarStatus(prof?.currently_watching, radarTick);
      if (radar) {
        list.push({ friend: prof, radar, isMe: false });
      }
    });

    return list;
  }, [data.movies, data.agentId, data.nickname, friends, profilesMap, radarTick]);

  // AKIŞ AKILLI FİLTRELEME VE AĞIN GÜNDEMİ (TRENDING) HESAPLAMASI
  const filteredFeed = useMemo(() => {
    return feed.filter((log: any) => {
      if (feedFilter === 'masterpieces') return Number(log.rating || 0) >= 8;
      if (feedFilter === 'notes') return Boolean(log.note && String(log.note).trim().length > 0);
      if (feedFilter === 'movies') return log.item_type === 'movie';
      if (feedFilter === 'series') return log.item_type === 'series';
      return true;
    });
  }, [feed, feedFilter]);

  const trendingFeedItem = useMemo(() => {
    if (feed.length === 0) return null;
    const counts: Record<string, { count: number; totalRating: number; ratedCount: number; sampleLog: any; cleanTitle: string }> = {};
    feed.forEach((log: any) => {
      const cleanTitle = (log.item_title || '').replace(/\s\(S\d+\sB\d+\)$/i, '').trim();
      const key = cleanTitle.toLowerCase();
      if (!key) return;
      if (!counts[key]) {
        counts[key] = { count: 0, totalRating: 0, ratedCount: 0, sampleLog: log, cleanTitle };
      }
      counts[key].count += 1;
      if (log.rating) {
        counts[key].totalRating += Number(log.rating);
        counts[key].ratedCount += 1;
      }
    });
    const sorted = Object.values(counts).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const avgB = b.ratedCount > 0 ? b.totalRating / b.ratedCount : 0;
      const avgA = a.ratedCount > 0 ? a.totalRating / a.ratedCount : 0;
      return avgB - avgA;
    });
    const top = sorted[0];
    if (!top) return null;
    return {
      ...top,
      avgRating: top.ratedCount > 0 ? Number((top.totalRating / top.ratedCount).toFixed(1)) : null,
    };
  }, [feed]);

  // LİDERLİK TABLOSU SIRALAMASI VE KAPSAM FİLTRESİ
  const sortedLeaderboard = useMemo(() => {
    const friendIdSet = new Set([data.agentId, ...friends.map((f: any) => f.agent_id)]);
    const baseList = leaderboardScope === 'friends'
      ? leaderboard.filter((u: any) => friendIdSet.has(u.agent_id))
      : leaderboard;

    return [...baseList].sort((a: any, b: any) => {
      if (leaderboardCategory === 'xp') return (b.total_xp || 0) - (a.total_xp || 0);
      if (leaderboardCategory === 'level') return (b.level || 0) - (a.level || 0);
      if (leaderboardCategory === 'movies') return (b.movies_watched || 0) - (a.movies_watched || 0);
      if (leaderboardCategory === 'past_movies') return (b.past_movies_watched || 0) - (a.past_movies_watched || 0);
      if (leaderboardCategory === 'episodes') return (b.episodes_watched || 0) - (a.episodes_watched || 0);
      if (leaderboardCategory === 'achievements') return (b.achievements_unlocked || 0) - (a.achievements_unlocked || 0);
      if (leaderboardCategory === 'quests') return (b.quests_completed || 0) - (a.quests_completed || 0);
      return 0;
    });
  }, [leaderboard, leaderboardScope, leaderboardCategory, friends, data.agentId]);

  const getLeaderboardScoreText = (user: any) => {
    if (leaderboardCategory === 'xp') return `${user.total_xp || 0} XP`;
    if (leaderboardCategory === 'level') return `Lvl ${user.level || 1}`;
    if (leaderboardCategory === 'movies') return `${user.movies_watched || 0} Güncel Film`;
    if (leaderboardCategory === 'past_movies') return `${user.past_movies_watched || 0} Önc. Film`;
    if (leaderboardCategory === 'episodes') return `${user.episodes_watched || 0} Bölüm`;
    if (leaderboardCategory === 'achievements') return `${user.achievements_unlocked || 0} Başarım`;
    if (leaderboardCategory === 'quests') return `${user.quests_completed || 0} Görev`;
    return '';
  };

  const incomingLists = recommendations.filter((r: any) => r.receiver_id === data.agentId);
  const unreadListsCount = incomingLists.filter((r: any) => r.status === 'pending').length;
  const outgoingLists = recommendations.filter((r: any) => r.sender_id === data.agentId);
  const totalUnread = Object.values(unreadMessages).reduce((a: number, b: number) => a + b, 0);
  const myValidShowcase = (data.showcase || []).filter((s: any) => s && s.title);

  const topThreeLeaderboard = sortedLeaderboard.slice(0, 3);
  const remainingLeaderboard = sortedLeaderboard.slice(3);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-emerald-400 animate-pulse font-bold tracking-widest uppercase text-sm">
        Ağ Bağlantısı Kuruluyor...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-10 animate-fade-in font-sans px-2 sm:px-0">

      {/* KENDİ ÜST PROFİL VE VİTRİN BARIN */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-ink-950 border border-ink-800/60 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-start">
          <button
            onClick={() => data.agentId && openProfileModal(data.agentId)}
            className="flex items-center gap-4 text-left group"
            title="Profilimi Önizle"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-azure-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-2xl sm:text-3xl group-hover:scale-105 transition-transform">
              {data.nickname?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white leading-tight group-hover:text-emerald-300 transition-colors">{data.nickname}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg">Lvl {data.level}</span>
                <span className="text-xs font-mono text-ink-300 px-2 py-0.5 bg-ink-900 rounded-lg border border-ink-800">{data.totalXp} XP</span>
              </div>
            </div>
          </button>

          {/* KENDİ VİTRİN ÖNİZLEMESİ */}
          <div
            onClick={() => setShowShowcaseModal(true)}
            className="hidden sm:flex items-center gap-2 bg-ink-900/70 hover:bg-ink-900 border border-gold-500/30 px-3.5 py-2 rounded-2xl cursor-pointer transition-all"
            title="Vitrinimi Düzenle"
          >
            <div className="mr-1 text-left">
              <div className="text-[9px] font-black uppercase tracking-widest text-gold-400 flex items-center gap-1">
                <Crown size={11} /> Vitrinim
              </div>
              <div className="text-[10px] text-ink-400">
                {myValidShowcase.length > 0 ? `${myValidShowcase.length} Başyapıt` : 'Afiş Seç'}
              </div>
            </div>
            {myValidShowcase.length > 0 ? (
              <div className="flex items-center gap-1.5">
                {myValidShowcase.map((sc: any, i: number) => {
                  const poster = sc?.posterUrl || sc?.poster;
                  return (
                    <div key={i} className="w-8 h-11 rounded-lg bg-ink-950 border border-gold-500/40 overflow-hidden flex items-center justify-center shrink-0 shadow">
                      {poster ? (
                        <img src={poster} alt={sc.title} className="w-full h-full object-cover" />
                      ) : (
                        <Film size={12} className="text-gold-400" />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="w-8 h-11 rounded-lg bg-gold-500/10 border border-dashed border-gold-500/40 flex items-center justify-center text-gold-400">
                <Plus size={14} />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-row items-center gap-2 w-full lg:w-auto">
          <button onClick={() => setShowShowcaseModal(true)} className="sm:hidden w-full flex items-center justify-center gap-2 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/30 text-gold-400 px-4 py-2.5 rounded-xl transition-all">
            <Crown size={15} />
            <span className="text-xs font-black uppercase tracking-wider">Vitrinim ({myValidShowcase.length}/4)</span>
          </button>
          <button onClick={() => data.agentId && openProfileModal(data.agentId)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-ink-900 hover:bg-ink-800 border border-ink-700 text-ink-200 px-4 py-3 rounded-xl text-xs font-bold transition-all">
            <Eye size={15} className="text-emerald-400" /> Profilim
          </button>
          <button onClick={() => { navigator.clipboard.writeText(data.agentId || ''); showToast('Kod kopyalandı!', 'success'); }} className="flex-1 sm:flex-none flex items-center gap-2.5 bg-ink-900/50 hover:bg-ink-800 border border-ink-800 hover:border-emerald-500/40 px-4 py-3 rounded-xl transition-all group justify-center">
            <span className="font-mono text-emerald-400 text-sm font-black tracking-widest">{data.agentId}</span>
            <Copy size={15} className="text-ink-500 group-hover:text-emerald-400 transition-colors" />
          </button>
          <button onClick={() => setIsChatHubOpen(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-azure-600/20 hover:bg-azure-600/30 border border-azure-500/30 text-azure-400 px-5 py-3 rounded-xl transition-all shadow-sm">
            <MessageCircle size={18} />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Mesaj Merkezi</span>
            {totalUnread > 0 && <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full ml-1">{totalUnread}</span>}
          </button>
        </div>
      </div>

      {/* ANA SEKMELER */}
      <div className="flex flex-wrap bg-ink-900/40 p-1.5 rounded-2xl border border-ink-800 overflow-hidden">
        {[
          { id: 'feed', label: 'Akış', icon: Activity },
          { id: 'friends', label: `Arkadaşlar`, icon: Users, badge: pendingIncoming.length + totalUnread },
          { id: 'lists', label: 'Listeler', icon: Inbox, badge: unreadListsCount },
          { id: 'leaderboard', label: 'Sıralama', icon: Trophy }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex-1 min-w-[90px] sm:min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all relative ${activeTab === tab.id ? 'bg-ink-800 text-white shadow-md border border-ink-700/50 scale-[1.02]' : 'text-ink-500 hover:text-ink-300'}`}
          >
            <tab.icon size={16} className={activeTab === tab.id && tab.id === 'feed' ? 'text-emerald-400' : activeTab === tab.id && tab.id === 'friends' ? 'text-azure-400' : activeTab === tab.id && tab.id === 'lists' ? 'text-violet-400' : activeTab === tab.id ? 'text-gold-400' : ''} />
            {tab.label}
            {tab.badge ? <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border border-ink-950" /> : null}
          </button>
        ))}
      </div>

      <div className="min-h-[600px]">
        {/* ============================== */}
        {/* 1. SEKME: AKIŞ (FEED) */}
        {/* ============================== */}
        {activeTab === 'feed' && (
          <div className="space-y-5 animate-fade-in">
            {/* CANLI RADAR PANELİ */}
            <div className={`border rounded-3xl p-4 sm:p-5 shadow-lg relative overflow-hidden transition-all ${liveWatchingList.length > 0 ? 'bg-gradient-to-r from-red-950/30 via-ink-950 to-ink-950 border-red-500/30' : 'bg-ink-950/80 border-ink-800/70'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    {liveWatchingList.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${liveWatchingList.length > 0 ? 'bg-red-500' : 'bg-ink-600'}`}></span>
                  </span>
                  <h3 className={`text-xs sm:text-sm font-black uppercase tracking-widest flex items-center gap-1.5 ${liveWatchingList.length > 0 ? 'text-red-400' : 'text-ink-400'}`}>
                    <Radio size={15} /> Canlı Radar — Şu An İzleyenler ({liveWatchingList.length})
                  </h3>
                </div>
              </div>

              {liveWatchingList.length === 0 ? (
                <div className="text-xs text-ink-500 py-1">
                  Şu an senin veya arkadaşlarının açık bir film sayacı yok. Bir filmin izleme sayacını başlattığında burada canlı yayınlanır!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {liveWatchingList.map(({ friend, radar }) => (
                    <div
                      key={friend.agent_id}
                      onClick={() => openProfileModal(friend.agent_id)}
                      className="bg-ink-900/70 hover:bg-ink-900 border border-red-500/20 hover:border-red-500/50 rounded-2xl p-3 flex items-center gap-3.5 transition-all group cursor-pointer"
                    >
                      <div className="w-12 h-16 rounded-xl bg-ink-950 overflow-hidden shrink-0 border border-ink-800 relative">
                        {radar.posterUrl ? (
                          <img src={radar.posterUrl} alt={radar.title} className="w-full h-full object-cover" />
                        ) : (
                          <Film size={20} className="text-ink-600 m-auto mt-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-black text-white truncate group-hover:text-red-300 transition-colors">{friend.nickname}</span>
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            {radar.isPaused ? '⏸️ Duraklattı' : '🔴 Canlı'}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-ink-100 truncate">{radar.title}</div>
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] font-mono text-ink-400 mb-1">
                            <span>{radar.elapsedMins}. dk</span>
                            <span>{radar.maxMins} dk</span>
                          </div>
                          <div className="w-full h-1.5 bg-ink-950 rounded-full overflow-hidden border border-ink-800">
                            <div className="h-full bg-gradient-to-r from-red-500 to-amber-500 rounded-full transition-all duration-500" style={{ width: `${radar.progress}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AĞIN GÜNDEMİ */}
            {trendingFeedItem && (
              <div
                onClick={() => setSelectedLog(trendingFeedItem.sampleLog)}
                className="bg-gradient-to-r from-amber-500/10 via-ink-900/80 to-ink-950 border border-gold-500/30 hover:border-gold-400/60 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-4 cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-14 rounded-lg bg-ink-950 overflow-hidden shrink-0 border border-gold-500/30">
                    {trendingFeedItem.sampleLog.item_poster ? (
                      <img src={trendingFeedItem.sampleLog.item_poster} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Flame size={18} className="text-gold-400 m-auto mt-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gold-400 flex items-center gap-1">
                        <Flame size={12} /> Ağın Gündemi
                      </span>
                      {trendingFeedItem.avgRating && (
                        <span className="text-[10px] font-black bg-gold-500/20 text-gold-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Star size={9} className="fill-gold-300" /> Ort. {trendingFeedItem.avgRating}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm sm:text-base font-black text-white truncate group-hover:text-gold-300 transition-colors">
                      {trendingFeedItem.cleanTitle}
                    </h4>
                    <p className="text-[11px] text-ink-400">
                      Son aktivitelerde arkadaşların arasında <span className="text-white font-bold">{trendingFeedItem.count} kez</span> izlendi.
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-black text-gold-400 bg-gold-500/10 border border-gold-500/25 px-3 py-2 rounded-xl group-hover:bg-gold-500 group-hover:text-ink-950 transition-all shrink-0">
                  <Eye size={14} /> İncele
                </span>
              </div>
            )}

            {/* AKILLI AKIŞ FİLTRELERİ */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 bg-ink-950 p-1.5 rounded-2xl border border-ink-800">
                {[
                  { id: 'all', label: 'Tümü', icon: Activity },
                  { id: 'masterpieces', label: '★ 8+ Başyapıtlar', icon: Crown },
                  { id: 'notes', label: 'Eleştirmen Notlular', icon: FileText },
                  { id: 'movies', label: 'Sadece Filmler', icon: Film },
                  { id: 'series', label: 'Sadece Diziler', icon: Tv },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFeedFilter(f.id as FeedFilterType)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      feedFilter === f.id
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'text-ink-400 hover:text-white hover:bg-ink-900'
                    }`}
                  >
                    <f.icon size={13} className={feedFilter === f.id ? 'text-emerald-400' : 'opacity-70'} />
                    {f.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => fetchData(false)}
                className="text-ink-400 hover:text-emerald-400 transition-colors bg-ink-950 px-3 py-2 rounded-xl border border-ink-800 flex items-center gap-1.5 text-xs font-bold"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin text-emerald-400' : ''} /> Yenile
              </button>
            </div>

            {filteredFeed.length === 0 ? (
              <div className="text-center py-20 bg-ink-950 border border-ink-800 border-dashed rounded-3xl">
                <Activity size={40} className="mx-auto text-ink-800 mb-4" />
                <p className="text-sm text-ink-500 font-bold uppercase tracking-widest">
                  {feed.length === 0 ? 'Akış Bomboş' : 'Bu Filtreye Uygun Aktivite Yok'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                {filteredFeed.map((log: any) => {
                  const profile = profilesMap[log.agent_id];
                  if (!profile) return null;
                  const liveStatus = getLiveRadarStatus(profile.currently_watching, radarTick);
                  const hasNote = Boolean(log.note && String(log.note).trim().length > 0);

                  return (
                    <div key={log.id} className="bg-ink-950 hover:bg-ink-900 border border-ink-800 rounded-2xl overflow-hidden transition-all group flex flex-col relative shadow-md hover:shadow-lg">
                      <button onClick={() => openProfileModal(log.agent_id)} className="p-3 border-b border-ink-800/60 bg-ink-900/40 flex items-start gap-3 hover:bg-ink-800/60 transition-colors text-left w-full">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-lg bg-ink-800 flex items-center justify-center text-xs font-black text-emerald-400 border border-ink-700">{profile.nickname?.[0]?.toUpperCase() || '?'}</div>
                          {liveStatus && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-ink-950 animate-pulse" />}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm font-bold text-white leading-snug group-hover:text-emerald-300 break-words pr-1 line-clamp-2">{profile.nickname}</span>
                          <span className="text-[9px] sm:text-[10px] text-ink-500 font-mono mt-1">{timeAgo(log.created_at)}</span>
                        </div>
                      </button>

                      <button onClick={() => setSelectedLog(log)} className="relative w-full aspect-[2/3] bg-ink-900 flex items-center justify-center overflow-hidden">
                        {log.item_poster ? (
                          <img src={log.item_poster} alt="poster" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
                        ) : (
                          <Film size={32} className="text-ink-700" />
                        )}

                        <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-[2px] flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <Eye size={24} className="text-emerald-400 mb-2" />
                          <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-white">İncelemeyi Gör</span>
                        </div>

                        {hasNote && (
                          <div className="absolute top-2 left-2 bg-ink-950/85 text-azure-400 p-1.5 rounded-lg border border-azure-500/30 shadow" title="Eleştirmen Notu İçeriyor">
                            <FileText size={12} />
                          </div>
                        )}

                        {log.rating && (
                          <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 bg-ink-950/90 text-gold-400 text-xs sm:text-sm font-black px-2 py-1 rounded-lg border border-gold-500/30 backdrop-blur-sm flex items-center gap-1 shadow-lg">
                            <Star size={12} className="fill-gold-400" /> {log.rating}
                          </div>
                        )}
                      </button>

                      <div className="p-3 sm:p-4">
                        <h3 className="text-sm sm:text-base font-bold text-ink-100 line-clamp-2 leading-tight mb-1">{log.item_title}</h3>
                        <div className="text-[10px] sm:text-[11px] text-ink-500 uppercase tracking-widest font-medium">{log.item_type === 'series' ? 'Dizi' : 'Film'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================== */}
        {/* 2. SEKME: LİSTELER */}
        {/* ============================== */}
        {activeTab === 'lists' && (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="bg-gradient-to-r from-violet-950/40 to-ink-950 border border-violet-500/20 rounded-3xl p-6 sm:p-10 text-center shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-72 h-72 bg-violet-500/10 blur-[100px] rounded-full pointer-events-none" />
              <div className="relative z-10">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-violet-500/10 text-violet-400 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-violet-500/20 rotate-3 shadow-lg">
                  <Gift size={32} />
                </div>
                <h2 className="text-lg sm:text-2xl font-black text-white mb-2">Arkadaşlarına Özel Koleksiyon Gönder</h2>
                <p className="text-xs sm:text-sm text-ink-400 mb-6 max-w-md mx-auto leading-relaxed">
                  En sevdiğin yapımları kendi puanların ve özel notunla birlikte seçerek arkadaşına tavsiye listesi olarak yolla.
                </p>
                <button
                  onClick={() => setShowSendModal(true)}
                  className="bg-violet-600 hover:bg-violet-500 text-white px-8 py-3.5 rounded-2xl font-black text-xs sm:text-sm shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all flex items-center gap-2.5 mx-auto uppercase tracking-wider"
                >
                  <ListVideo size={18} /> Liste Oluştur & Gönder
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-[11px] sm:text-xs font-black text-ink-500 uppercase tracking-widest mb-4 pl-2 flex items-center gap-2">
                <Inbox size={16} className="text-violet-400" /> Sana Gelen Listeler ({incomingLists.length})
              </h3>
              {incomingLists.length === 0 ? (
                <div className="text-center py-10 bg-ink-950 border border-ink-800 border-dashed rounded-2xl">
                  <p className="text-xs sm:text-sm text-ink-500 font-medium">Henüz gelen bir liste yok.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {incomingLists.map((list: any) => {
                    const p = profilesMap[list.sender_id] || { nickname: 'Bilinmeyen' };
                    const isNew = list.status === 'pending';
                    const itemsArr: any[] = Array.isArray(list.items) ? list.items : [];
                    const listNote = itemsArr[0]?.listNote || null;

                    return (
                      <div key={list.id} className="bg-ink-950 border border-ink-800 hover:border-violet-500/40 p-5 rounded-2xl transition-colors flex flex-col justify-between gap-4 group shadow-sm relative">
                        {isNew && <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-ink-950 animate-pulse" title="Yeni Liste" />}
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="text-base font-bold text-white truncate mb-1">{list.list_title}</h4>
                              <div className="text-[11px] text-ink-400 flex items-center gap-1.5 flex-wrap">
                                <span className="text-violet-400 font-bold">{p.nickname}</span> gönderdi
                                <span className="text-ink-600">•</span>
                                <span className="bg-ink-900 px-2 py-0.5 rounded text-ink-300 font-mono">{itemsArr.length} İçerik</span>
                              </div>
                            </div>

                            {itemsArr.length > 0 && (
                              <div className="flex items-center -space-x-2 shrink-0">
                                {itemsArr.slice(0, 3).map((it: any, idx: number) =>
                                  it.poster ? (
                                    <img key={idx} src={it.poster} alt="" className="w-7 h-10 rounded-md object-cover border border-ink-950 shadow" />
                                  ) : null
                                )}
                              </div>
                            )}
                          </div>

                          {listNote && (
                            <p className="text-[11px] text-ink-300 italic mt-2.5 line-clamp-2 bg-ink-900/60 px-2.5 py-1.5 rounded-xl border border-ink-800/80">
                              "{listNote}"
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-ink-800/60">
                          <button
                            onClick={() => handleViewList(list)}
                            className="flex-1 bg-ink-900 hover:bg-violet-500/20 text-violet-300 border border-ink-800 hover:border-violet-500/50 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm"
                          >
                            Listeyi Aç & İncele
                          </button>
                          <button
                            onClick={() => setListToDelete(list.id)}
                            className="p-2.5 bg-ink-900 hover:bg-red-500/20 text-red-400/70 hover:text-red-400 border border-ink-800 hover:border-red-500/50 rounded-xl transition-all shadow-sm"
                            title="Listeyi Sil"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {outgoingLists.length > 0 && (
              <div className="pt-6 border-t border-ink-800/60">
                <h3 className="text-[11px] sm:text-xs font-black text-ink-500 uppercase tracking-widest mb-4 pl-2 flex items-center gap-2">
                  <Send size={16} className="text-ink-400" /> Senin Gönderdiklerin ({outgoingLists.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {outgoingLists.map((list: any) => {
                    const p = profilesMap[list.receiver_id] || { nickname: 'Bilinmeyen' };
                    return (
                      <div key={list.id} className="bg-ink-950/60 border border-ink-800/60 p-4 rounded-2xl flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-ink-200 truncate mb-1">{list.list_title}</h4>
                          <div className="text-[11px] text-ink-500">
                            Kime: <span className="text-ink-300 font-bold">{p.nickname}</span> • {list.items?.length || 0} içerik
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleViewList(list)}
                            className="px-3 py-2 bg-ink-900 hover:bg-ink-800 text-ink-300 border border-ink-800 rounded-xl text-xs font-bold transition-all"
                          >
                            Gör
                          </button>
                          <button
                            onClick={() => setListToDelete(list.id)}
                            className="p-2 bg-ink-900/50 hover:bg-red-500/20 text-red-400/70 hover:text-red-400 border border-transparent hover:border-red-500/30 rounded-xl transition-all"
                            title="Listeyi Sil"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================== */}
        {/* 3. SEKME: LİDERLİK TABLOSU & YENİ ŞAMPİYONLAR PODYUMU */}
        {/* ============================== */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-7 animate-fade-in">
            {/* FİLTRE VE KATEGORİ SEÇİM BARI */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex bg-ink-950 p-1.5 rounded-2xl border border-ink-800 self-start">
                <button
                  onClick={() => setLeaderboardScope('global')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    leaderboardScope === 'global'
                      ? 'bg-gradient-to-r from-gold-500 to-amber-500 text-ink-950 shadow-md'
                      : 'text-ink-400 hover:text-white'
                  }`}
                >
                  <Trophy size={13} /> Tüm Sinevia Ağı
                </button>
                <button
                  onClick={() => setLeaderboardScope('friends')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    leaderboardScope === 'friends'
                      ? 'bg-azure-500 text-white shadow-md'
                      : 'text-ink-400 hover:text-white'
                  }`}
                >
                  <Users size={13} /> Sadece Arkadaşlarım ({friends.length + 1})
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 flex-1 max-w-3xl">
                {[
                  { id: 'xp', label: 'XP', icon: Sparkles },
                  { id: 'level', label: 'Seviye', icon: Zap },
                  { id: 'movies', label: 'Güncel Film', icon: Film },
                  { id: 'past_movies', label: 'Önc. Film', icon: History },
                  { id: 'episodes', label: 'Bölüm', icon: Tv },
                  { id: 'achievements', label: 'Başarım', icon: Medal },
                  { id: 'quests', label: 'Görev', icon: Activity },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setLeaderboardCategory(cat.id as LeaderboardCategory)}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${
                      leaderboardCategory === cat.id
                        ? 'bg-ink-800 text-gold-400 border border-gold-500/40 shadow-md'
                        : 'bg-ink-950 text-ink-500 border border-ink-800/50 hover:text-ink-300'
                    }`}
                  >
                    <cat.icon size={13} className={leaderboardCategory === cat.id ? 'text-gold-400' : 'opacity-70'} />
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* YENİ TASARIM: ŞAMPİYONLAR PODYUMU (İLK 3) */}
            {topThreeLeaderboard.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end pt-3">
                {[1, 0, 2].map((podiumIdx: number) => {
                  const user = topThreeLeaderboard[podiumIdx];
                  if (!user) return <div key={podiumIdx} className="hidden md:block" />;

                  const rank = podiumIdx + 1;
                  const isMe = user.agent_id === data.agentId;
                  const liveStatus = getLiveRadarStatus(user.currently_watching, radarTick);
                  const uShowcase: any[] = Array.isArray(user.showcase)
                    ? user.showcase.filter((x: any) => x && x.title)
                    : [];

                  const theme =
                    rank === 1
                      ? {
                          order: 'order-1 md:order-2 md:-translate-y-3',
                          cardBorder: 'border-gold-400/60 hover:border-gold-300',
                          cardGlow: 'shadow-[0_15px_50px_-12px_rgba(250,204,21,0.3)]',
                          bannerFallback: 'from-amber-500/30 via-yellow-600/15 to-ink-950',
                          avatarRing: 'from-yellow-300 via-amber-400 to-orange-500 shadow-[0_0_25px_rgba(250,204,21,0.45)]',
                          badgeBg: 'from-yellow-300 via-amber-400 to-amber-500 text-ink-950 border-yellow-200',
                          rankTitle: '1. ŞAMPİYON',
                          scoreColor: 'text-gold-300 border-gold-500/40 bg-gold-500/10',
                          icon: Crown,
                        }
                      : rank === 2
                      ? {
                          order: 'order-2 md:order-1',
                          cardBorder: 'border-slate-300/40 hover:border-slate-200/70',
                          cardGlow: 'shadow-[0_10px_35px_-12px_rgba(203,213,225,0.2)]',
                          bannerFallback: 'from-slate-400/25 via-indigo-950/30 to-ink-950',
                          avatarRing: 'from-slate-200 via-slate-300 to-slate-500 shadow-[0_0_20px_rgba(203,213,225,0.3)]',
                          badgeBg: 'from-slate-200 via-slate-300 to-slate-400 text-ink-950 border-white/60',
                          rankTitle: '2. GÜMÜŞ AJAN',
                          scoreColor: 'text-slate-200 border-slate-400/30 bg-slate-400/10',
                          icon: Award,
                        }
                      : {
                          order: 'order-3 md:order-3',
                          cardBorder: 'border-amber-600/45 hover:border-amber-500/70',
                          cardGlow: 'shadow-[0_10px_35px_-12px_rgba(217,119,6,0.22)]',
                          bannerFallback: 'from-amber-700/30 via-orange-950/25 to-ink-950',
                          avatarRing: 'from-amber-400 via-amber-600 to-orange-700 shadow-[0_0_20px_rgba(217,119,6,0.3)]',
                          badgeBg: 'from-amber-500 via-amber-600 to-orange-700 text-white border-amber-400/50',
                          rankTitle: '3. BRONZ AJAN',
                          scoreColor: 'text-amber-300 border-amber-500/35 bg-amber-500/10',
                          icon: Medal,
                        };

                  const RankIcon = theme.icon;

                  return (
                    <div
                      key={user.agent_id}
                      onClick={() => openProfileModal(user.agent_id)}
                      className={`relative rounded-[28px] bg-ink-950 border ${theme.cardBorder} ${theme.cardGlow} ${theme.order} overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-2 flex flex-col`}
                    >
                      {/* SİNEMATİK ÜST BANNER (VİTRİN AFİŞ KOLAJI VEYA NEON IŞIK) */}
                      <div className={`relative ${rank === 1 ? 'h-28' : 'h-24'} w-full overflow-hidden bg-ink-900`}>
                        {uShowcase.some((x: any) => x.posterUrl || x.poster) ? (
                          <div className="absolute inset-0 grid grid-cols-4 gap-0.5 opacity-45 group-hover:scale-105 transition-transform duration-700">
                            {[0, 1, 2, 3].map((i: number) => {
                              const sc = uShowcase[i] || uShowcase[0];
                              const pUrl = sc?.posterUrl || sc?.poster;
                              return (
                                <div key={i} className="w-full h-full bg-ink-950 overflow-hidden">
                                  {pUrl && (
                                    <img src={pUrl} alt="" className="w-full h-full object-cover filter blur-[1px] scale-110" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className={`absolute inset-0 bg-gradient-to-br ${theme.bannerFallback}`} />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent" />

                        <div className="absolute top-3 left-3 z-10">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${theme.badgeBg} border text-[10px] font-black uppercase tracking-widest shadow-lg`}>
                            <RankIcon size={12} /> {theme.rankTitle}
                          </div>
                        </div>

                        <div className="absolute top-3 right-3 z-10">
                          {liveStatus ? (
                            <span className="inline-flex items-center gap-1 bg-red-500/90 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow animate-pulse">
                              🔴 Canlı İzliyor
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-black/70 backdrop-blur-md text-ink-200 border border-white/10 text-[10px] font-black px-2.5 py-1 rounded-full">
                              LVL {user.level || 1}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="px-5 pb-5 -mt-10 relative z-10 flex flex-col items-center text-center flex-1">
                        <div className="relative mb-3">
                          <div className={`${rank === 1 ? 'w-20 h-20' : 'w-16 h-16'} rounded-2xl bg-gradient-to-br ${theme.avatarRing} p-[2px] transition-transform duration-300 group-hover:scale-105`}>
                            <div className="w-full h-full bg-ink-950 rounded-[14px] flex items-center justify-center">
                              <span className={`${rank === 1 ? 'text-3xl' : 'text-2xl'} font-black text-white`}>
                                {user.nickname?.[0]?.toUpperCase() || '?'}
                              </span>
                            </div>
                          </div>
                          <div className={`absolute -bottom-2 -right-2 w-7 h-7 rounded-xl bg-gradient-to-br ${theme.badgeBg} border border-ink-950 flex items-center justify-center font-mono font-black text-xs shadow-lg`}>
                            #{rank}
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 max-w-full">
                          <h3 className={`${rank === 1 ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'} font-black text-white group-hover:text-gold-300 transition-colors truncate`}>
                            {user.nickname}
                          </h3>
                          {isMe && (
                            <span className="text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-md shrink-0">
                              Sen
                            </span>
                          )}
                        </div>

                        <div className={`mt-2.5 px-4 py-1.5 rounded-xl border font-mono text-sm sm:text-base font-black ${theme.scoreColor} shadow-inner`}>
                          {getLeaderboardScoreText(user)}
                        </div>

                        {/* MİNİ İSTATİSTİK ŞERİDİ (GÜNCEL VE ÖNCEDEN FİLM EKLENDİ) */}
                        <div className="grid grid-cols-4 gap-1.5 w-full mt-4 pt-3 border-t border-ink-800/80 text-center">
                          <div className="bg-ink-900/50 rounded-xl py-1.5 px-1 sm:px-2 border border-ink-800/60">
                            <div className="text-[11px] sm:text-xs font-black text-emerald-400 font-mono">{user.movies_watched || 0}</div>
                            <div className="text-[8px] sm:text-[9px] text-ink-500 font-bold uppercase">Güncel</div>
                          </div>
                          <div className="bg-ink-900/50 rounded-xl py-1.5 px-1 sm:px-2 border border-ink-800/60">
                            <div className="text-[11px] sm:text-xs font-black text-violet-400 font-mono">{user.past_movies_watched || 0}</div>
                            <div className="text-[8px] sm:text-[9px] text-ink-500 font-bold uppercase">Önceden</div>
                          </div>
                          <div className="bg-ink-900/50 rounded-xl py-1.5 px-1 sm:px-2 border border-ink-800/60">
                            <div className="text-[11px] sm:text-xs font-black text-azure-400 font-mono">{user.episodes_watched || 0}</div>
                            <div className="text-[8px] sm:text-[9px] text-ink-500 font-bold uppercase">Bölüm</div>
                          </div>
                          <div className="bg-ink-900/50 rounded-xl py-1.5 px-1 sm:px-2 border border-ink-800/60">
                            <div className="text-[11px] sm:text-xs font-black text-gold-400 font-mono">{user.achievements_unlocked || 0}</div>
                            <div className="text-[8px] sm:text-[9px] text-ink-500 font-bold uppercase">Başarım</div>
                          </div>
                        </div>

                        {uShowcase.length > 0 && (
                          <div className="flex items-center justify-center gap-1.5 mt-3.5 w-full">
                            {uShowcase.slice(0, 4).map((sc: any, i: number) => {
                              const pUrl = sc.posterUrl || sc.poster;
                              return pUrl ? (
                                <img
                                  key={i}
                                  src={pUrl}
                                  alt={sc.title}
                                  className="w-8 h-11 rounded-lg object-cover border border-ink-700 shadow-md group-hover:border-gold-500/40 transition-colors"
                                  title={sc.title}
                                />
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {remainingLeaderboard.length > 0 && (
              <div className="bg-ink-950 border border-ink-800/60 rounded-3xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-ink-900/40 border-b border-ink-800 text-[10px] sm:text-xs font-black text-ink-500 uppercase tracking-widest">
                  <div className="col-span-1 text-center">Sıra</div>
                  <div className="col-span-8 sm:col-span-8 pl-2">Ajan Adı</div>
                  <div className="col-span-3 sm:col-span-3 text-right pr-2">İstatistik</div>
                </div>

                <div className="divide-y divide-ink-800/30">
                  {remainingLeaderboard.map((user: any, index: number) => {
                    const isMe = user.agent_id === data.agentId;
                    const rank = index + 4;
                    const liveStatus = getLiveRadarStatus(user.currently_watching, radarTick);

                    return (
                      <button
                        key={user.agent_id}
                        onClick={() => openProfileModal(user.agent_id)}
                        className={`w-full text-left grid grid-cols-12 gap-3 p-3.5 items-center transition-colors ${
                          isMe ? 'bg-emerald-950/20 hover:bg-emerald-950/30' : 'hover:bg-ink-900/40'
                        } cursor-pointer group`}
                      >
                        <div className="col-span-1 text-center font-mono text-sm sm:text-base font-black text-ink-400 group-hover:text-white">
                          #{rank}
                        </div>
                        <div className="col-span-8 sm:col-span-8 flex items-center gap-3 min-w-0 pl-2">
                          <div
                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl shrink-0 flex items-center justify-center font-black text-xs sm:text-sm relative ${
                              isMe
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-ink-800 text-ink-300 border border-ink-700'
                            }`}
                          >
                            {user.nickname?.[0]?.toUpperCase() || '?'}
                            {liveStatus && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-ink-950 animate-pulse" />
                            )}
                          </div>
                          <div className="truncate flex items-center gap-2">
                            <span
                              className={`text-sm sm:text-base font-bold truncate ${
                                isMe ? 'text-emerald-400' : 'text-ink-100 group-hover:text-white'
                              }`}
                            >
                              {user.nickname}
                            </span>
                            <span className="text-[10px] font-bold text-ink-500 bg-ink-900 px-2 py-0.5 rounded border border-ink-800 hidden sm:inline-block">
                              Lvl {user.level || 1}
                            </span>
                            {isMe && (
                              <span className="hidden sm:inline-block text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-black border border-emerald-500/30">
                                Sen
                              </span>
                            )}
                            {liveStatus && (
                              <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full truncate max-w-[180px]">
                                🔴 {liveStatus.title}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="col-span-3 sm:col-span-3 text-right pr-2">
                          <span className="text-xs sm:text-sm font-black text-white font-mono bg-ink-900 px-3 py-1.5 rounded-xl border border-ink-800 shadow-inner">
                            {getLeaderboardScoreText(user)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================== */}
        {/* 4. SEKME: ARKADAŞLAR */}
        {/* ============================== */}
        {activeTab === 'friends' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-ink-950 border border-azure-500/20 rounded-3xl p-5 sm:p-6 shadow-sm">
              <h2 className="text-xs sm:text-sm font-black text-azure-400 mb-4 flex items-center gap-2 uppercase tracking-widest"><UserPlus size={16} /> Yeni Ajan Ekle</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text" placeholder="SNV-XXXX-XXXX" value={friendCode} onChange={(e) => setFriendCode(e.target.value)}
                  className="flex-1 bg-ink-900 border border-ink-800 rounded-xl px-4 py-3 text-sm sm:text-base text-white font-mono uppercase tracking-widest focus:border-azure-500 outline-none transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendRequest()}
                />
                <button onClick={handleSendRequest} className="bg-azure-600 hover:bg-azure-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-azure-500/20">İstek Gönder</button>
              </div>
            </div>

            {(pendingIncoming.length > 0 || pendingOutgoing.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {pendingIncoming.length > 0 && (
                  <div>
                    <h3 className="text-[11px] sm:text-xs font-black text-ink-500 uppercase tracking-widest mb-3 pl-2">Gelen İstekler</h3>
                    <div className="space-y-2">
                      {pendingIncoming.map((req: any) => {
                        const p = profilesMap[req.requester_id] || { nickname: 'Bilinmeyen', agent_id: req.requester_id };
                        return (
                          <div key={req.id} className="flex items-center justify-between bg-ink-950 border border-ink-800 p-3 sm:p-4 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-ink-800 flex items-center justify-center font-black text-white text-sm">{p.nickname?.[0]?.toUpperCase() || '?'}</div>
                              <div className="leading-tight">
                                <div className="text-sm font-bold text-white mb-0.5">{p.nickname}</div>
                                <div className="text-[10px] text-ink-500 font-mono">{p.agent_id}</div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleAccept(req.id)} className="w-9 h-9 flex items-center justify-center bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl transition-colors"><Check size={16} /></button>
                              <button onClick={() => handleRemove(req.id, true)} className="w-9 h-9 flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors"><X size={16} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {pendingOutgoing.length > 0 && (
                  <div>
                    <h3 className="text-[11px] sm:text-xs font-black text-ink-500 uppercase tracking-widest mb-3 pl-2">Giden İstekler</h3>
                    <div className="space-y-2">
                      {pendingOutgoing.map((req: any) => {
                        const p = profilesMap[req.receiver_id] || { nickname: 'Bekleniyor...', agent_id: req.receiver_id };
                        return (
                          <div key={req.id} className="flex items-center justify-between bg-ink-950 border border-ink-800/50 p-3 sm:p-4 rounded-2xl opacity-70">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-ink-900 flex items-center justify-center font-bold text-ink-500 text-sm">{p.nickname?.[0]?.toUpperCase() || '?'}</div>
                              <div className="leading-tight">
                                <div className="text-sm font-bold text-ink-300 mb-0.5">{p.nickname}</div>
                                <div className="text-[10px] text-ink-600 font-mono">{p.agent_id}</div>
                              </div>
                            </div>
                            <button onClick={() => handleRemove(req.id, true)} className="p-2 text-red-400/70 hover:text-red-400 transition-colors bg-red-500/5 rounded-xl" title="İptal Et"><X size={16} /></button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className="text-[11px] sm:text-xs font-black text-ink-500 uppercase tracking-widest mb-3 pl-2">Dost Meclisi ({friends.length})</h3>
              {friends.length === 0 ? (
                <div className="text-center py-10 bg-ink-950 border border-ink-800 border-dashed rounded-3xl">
                  <Users size={32} className="mx-auto mb-3 text-ink-700" />
                  <p className="text-sm text-ink-500 font-medium">Kimse yok. Yalnız bir kurtsun.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {friends.map((f: any) => {
                    const unread = unreadMessages[f.agent_id] || 0;
                    const prof = profilesMap[f.agent_id] || f;
                    const liveStatus = getLiveRadarStatus(prof?.currently_watching, radarTick);
                    const fShowcase: any[] = Array.isArray(prof?.showcase) ? prof.showcase.filter((x: any) => x && x.title) : [];

                    return (
                      <div key={f.agent_id} className="flex items-center justify-between bg-ink-950 border border-ink-800 p-4 rounded-2xl hover:border-azure-500/50 transition-colors group shadow-sm">
                        <button onClick={() => openProfileModal(f.agent_id)} className="flex items-center gap-4 text-left flex-1 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-xl bg-azure-500/10 border border-azure-500/20 flex items-center justify-center font-black text-azure-400 text-lg">{f.nickname?.[0]?.toUpperCase() || '?'}</div>
                            {unread > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-ink-950" />}
                            {liveStatus && !unread && <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-ink-950 animate-pulse" />}
                          </div>
                          <div className="leading-tight truncate flex-1">
                            <div className="text-base font-bold text-white truncate mb-1">{f.nickname}</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] bg-ink-900 px-2 py-0.5 rounded border border-ink-800 text-gold-400 font-bold">Lvl {f.level}</span>
                              {liveStatus ? (
                                <span className="text-[10px] bg-red-500/15 border border-red-500/30 text-red-400 px-2 py-0.5 rounded font-bold truncate max-w-[180px]">
                                  🔴 {liveStatus.title} ({liveStatus.elapsedMins}. dk)
                                </span>
                              ) : (
                                <span className="text-[10px] text-ink-500 font-mono hidden sm:inline-block">Son: {timeAgo(f.last_seen)}</span>
                              )}
                            </div>
                          </div>

                          {fShowcase.length > 0 && (
                            <div className="hidden sm:flex items-center -space-x-2 mr-2">
                              {fShowcase.slice(0, 4).map((sc: any, idx: number) => {
                                const pUrl = sc.posterUrl || sc.poster;
                                return pUrl ? (
                                  <img key={idx} src={pUrl} alt={sc.title} className="w-7 h-10 rounded-md object-cover border border-ink-950 shadow-md" title={sc.title} />
                                ) : null;
                              })}
                            </div>
                          )}
                        </button>

                        <div className="flex items-center gap-2 pl-2">
                          <button
                            onClick={() => {
                              setInitialDirectChatId(f.agent_id);
                              setIsChatHubOpen(true);
                            }}
                            className="p-3 text-ink-400 hover:text-azure-400 bg-ink-900 hover:bg-azure-500/10 rounded-xl transition-colors border border-transparent hover:border-azure-500/30 relative"
                          >
                            <MessageSquare size={18} />
                            {unread > 0 && <span className="absolute -top-2 -right-2 text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full shadow-md">{unread}</span>}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setFriendToRemove(f.friendship_id); }} className="text-ink-600 hover:text-red-400 p-3 bg-ink-900 hover:bg-red-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-500/30" title="Ağdan Çıkar"><Trash2 size={18} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================== */}
      {/* BAĞIMSIZ MODALLAR */}
      {/* ============================== */}

      {/* 1. PROFİL MODALI */}
      {viewingProfileId && (
        <AgentProfileModal
          viewingProfileId={viewingProfileId}
          profile={
            viewingProfileId === data.agentId
              ? {
                  agent_id: data.agentId,
                  nickname: data.nickname,
                  level: data.level,
                  total_xp: data.totalXp,
                  movies_watched: myStatsSummary.moviesWatched,
                  past_movies_watched: myStatsSummary.pastMoviesWatched,
                  series_watched: data.series.filter((s: any) => s.episodes?.every((e: any) => e.watched)).length,
                  episodes_watched: myStatsSummary.episodesWatched,
                  achievements_unlocked: myStatsSummary.achievementsUnlocked,
                  showcase: data.showcase || []
                }
              : (profilesMap[viewingProfileId] || { nickname: 'Bilinmeyen Ajan', level: 1, total_xp: 0 })
          }
          isOwnProfile={viewingProfileId === data.agentId}
          liveStatus={
            viewingProfileId === data.agentId
              ? (liveWatchingList.find(x => x.isMe)?.radar || null)
              : getLiveRadarStatus(profilesMap[viewingProfileId]?.currently_watching, radarTick)
          }
          friendLogs={friendLogs}
          myMovies={data.movies}
          mySeries={data.series}
          myShowcase={data.showcase || []}
          myStats={myStatsSummary}
          profileTab={profileTab}
          setProfileTab={setProfileTab}
          chatMessages={chatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          onSendMessage={() => handleProfileSendMessage()}
          onOpenMediaShare={() => setProfileMediaShareOpen(true)}
          renderChatMessageItem={(msg: any, allMsgList: any[], isGroupChat: boolean) =>
            renderChatMessageBubble({
              msg,
              allMsgList,
              isGroupChat,
              myAgentId: data.agentId ?? null,
              profilesMap,
              myMovies: data.movies,
              mySeries: data.series,
              onAddToLibrary: handleAddToLibrary,
              showToast,
            })
          }
          onAddToLibrary={handleAddToLibrary}
          onOpenShowcaseEditor={() => { setViewingProfileId(null); setShowShowcaseModal(true); }}
          onClose={() => setViewingProfileId(null)}
          chatScrollRef={chatScrollRef}
        />
      )}

      {/* 2. VİTRİN DÜZENLEME MODALI */}
      <ShowcaseEditorModal
        isOpen={showShowcaseModal}
        initialShowcase={data.showcase || []}
        movies={data.movies}
        series={data.series}
        onSave={handleSaveShowcase}
        onClose={() => setShowShowcaseModal(false)}
        showToast={showToast}
      />

      {/* 3. MESAJLAŞMA MERKEZİ (CHAT HUB) MODALI */}
      <ChatHubModal
        isOpen={isChatHubOpen}
        onClose={() => setIsChatHubOpen(false)}
        myAgentId={data.agentId ?? null}
        myNickname={data.nickname || 'Ajan'}
        friends={friends}
        profilesMap={profilesMap}
        setProfilesMap={setProfilesMap}
        movies={data.movies}
        series={data.series}
        onAddToLibrary={handleAddToLibrary}
        showToast={showToast}
        syncTick={syncTick}
        onTriggerSync={() => setSyncTick(t => t + 1)}
        initialDirectChatId={initialDirectChatId}
        onClearInitialDirectChat={() => setInitialDirectChatId(null)}
        externalMediaShareOpen={profileMediaShareOpen}
        onCloseExternalMediaShare={() => setProfileMediaShareOpen(false)}
        onSendProfileMediaCard={(encoded: string) => handleProfileSendMessage(encoded)}
      />

      {/* 4. TAVSİYE KOLEKSİYONU GÖNDERME & İNCELEME MODALLARI */}
      <RecommendationModals
        myAgentId={data.agentId ?? null}
        friends={friends}
        profilesMap={profilesMap}
        showSendModal={showSendModal}
        setShowSendModal={setShowSendModal}
        viewingList={viewingList}
        setViewingList={setViewingList}
        listToDelete={listToDelete}
        setListToDelete={setListToDelete}
        onTriggerSync={() => setSyncTick(t => t + 1)}
      />

      {/* 5. AKIŞ DETAY MODALI */}
      {selectedLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedLog(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-xl bg-ink-950 border border-ink-800 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col md:flex-row max-h-[90vh]">
            <button onClick={() => setSelectedLog(null)} className="absolute top-4 right-4 z-20 w-8 h-8 bg-ink-900/80 hover:bg-ink-800 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"><X size={16} /></button>

            <div className="w-full md:w-2/5 h-64 md:h-auto bg-ink-900 relative shrink-0">
              {selectedLog.item_poster ? (
                <img src={selectedLog.item_poster} alt="poster" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-ink-700">
                  {selectedLog.item_type === 'series' ? <Tv size={48} /> : <Film size={48} />}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink-950 to-transparent md:hidden" />
            </div>

            <div className="p-5 md:p-6 md:w-3/5 flex flex-col -mt-8 md:mt-0 relative z-10">
              <div className="mb-4">
                <button onClick={() => { setSelectedLog(null); openProfileModal(selectedLog.agent_id); }} className="flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity text-left bg-ink-900/60 p-2 rounded-xl border border-ink-800/50">
                  <div className="w-6 h-6 rounded-md bg-ink-800 text-emerald-400 flex items-center justify-center text-[11px] font-black">{profilesMap[selectedLog.agent_id]?.nickname?.[0]?.toUpperCase() || '?'}</div>
                  <span className="text-sm text-ink-300 font-bold">{profilesMap[selectedLog.agent_id]?.nickname} <span className="font-normal text-ink-500">inceliyor</span></span>
                </button>
                <h2 className="text-2xl font-black text-white leading-tight mb-1.5">{selectedLog.item_title}</h2>
                <div className="text-[11px] text-ink-500 uppercase tracking-widest font-bold">{selectedLog.item_type === 'series' ? 'Dizi' : 'Film'} • {timeAgo(selectedLog.created_at)}</div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar mb-5">
                {(selectedLog.rating || (selectedLog.review_tags && selectedLog.review_tags.length > 0)) && (
                  <div className="flex flex-wrap items-center gap-2 mb-5">
                    {selectedLog.rating && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-500/10 text-gold-400 rounded-lg border border-gold-500/20 font-black text-sm">
                        <Star size={16} className="fill-gold-400" /> {selectedLog.rating}/10
                      </div>
                    )}
                    {selectedLog.review_tags?.map((tag: string) => (
                      <span key={tag} className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${isPositiveTag(tag, data.tagSentiments) ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {selectedLog.note ? (
                  <div className="bg-ink-900/50 p-4 rounded-2xl border border-ink-800/50 relative">
                    <div className="text-[10px] font-black uppercase tracking-widest text-ink-500 mb-2 flex items-center gap-1.5"><Info size={12} /> Eleştirmen Notu</div>
                    {(() => {
                      const rawNote = selectedLog.note;
                      const hasSpoiler = selectedLog.is_spoiler || rawNote.toLowerCase().includes('[spoiler]') || rawNote.toLowerCase().includes('#spoiler');
                      const cleanNote = rawNote.replace(/[spoiler]/gi, '').replace(/#spoiler/gi, '').trim();
                      const isRevealed = revealedSpoilers[selectedLog.id];

                      if (hasSpoiler && !isRevealed) {
                        return (
                          <div onClick={() => setRevealedSpoilers(prev => ({ ...prev, [selectedLog.id]: true }))} className="cursor-pointer bg-red-500/10 border border-red-500/20 rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-red-400 hover:bg-red-500/20 transition-all text-center">
                            <ShieldAlert size={24} className="animate-pulse" />
                            <span className="text-xs font-black uppercase tracking-widest">Spoiler İçeriyor</span>
                            <span className="text-[10px] opacity-70">Okumak için tıklayın</span>
                          </div>
                        );
                      }
                      return <p className="text-sm sm:text-base text-ink-200 italic leading-relaxed">"{cleanNote}"</p>;
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-ink-600 italic">Kullanıcı yazılı bir değerlendirme bırakmamış.</p>
                )}
              </div>

              {(() => {
                const cleanTitle = (selectedLog.item_title || '').replace(/\s\(S\d+\sB\d+\)$/i, '').trim().toLowerCase();
                const alreadyInMyLib =
                  data.movies.some((m: Movie) => m.title.toLowerCase() === cleanTitle) ||
                  data.series.some((s: any) => s.title.toLowerCase() === cleanTitle);

                return (
                  <div className="space-y-2 mt-auto shrink-0">
                    {alreadyInMyLib ? (
                      <button
                        onClick={() => handleNavigateFromLog(selectedLog, false)}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 uppercase tracking-wider"
                      >
                        <ExternalLink size={16} />
                        {selectedLog.item_type === 'series' ? 'Dizi Listemde Bu Yapıma Git' : 'Film Listemde Bu Filme Git'}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleNavigateFromLog(selectedLog, true)}
                          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 uppercase tracking-wider"
                        >
                          <ExternalLink size={16} />
                          Kütüphaneme Ekle & {selectedLog.item_type === 'series' ? 'Dizilere' : 'Filmlere'} Git
                        </button>
                        <button
                          onClick={() => { handleAddToLibrary(selectedLog); setSelectedLog(null); }}
                          className="w-full py-2.5 bg-ink-900 hover:bg-ink-800 border border-ink-700 text-ink-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
                        >
                          <Plus size={15} /> Sadece Kütüphaneme Ekle
                        </button>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 6. ARKADAŞLIKTAN ÇIKARMA ONAY MODALI */}
      {friendToRemove && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setFriendToRemove(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-ink-950 border border-ink-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <UserPlus size={24} className="rotate-45" />
            </div>
            <h3 className="text-lg font-black text-white mb-2">Ajanı Ağdan Çıkar</h3>
            <p className="text-sm text-ink-300 mb-6">Bu ajanı ağından çıkarmak istediğine emin misin? İrtibatınız tamamen kesilecek.</p>
            <div className="flex gap-3">
              <button onClick={() => setFriendToRemove(null)} className="flex-1 py-3 rounded-xl bg-ink-900 hover:bg-ink-800 text-white font-bold transition-colors">İptal</button>
              <button onClick={() => { handleRemove(friendToRemove); setFriendToRemove(null); }} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-lg shadow-red-500/20">Evet, Çıkar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}