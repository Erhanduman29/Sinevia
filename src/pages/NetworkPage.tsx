import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Users, UserPlus, Trophy, Activity, Check, X, Clock, Star, Plus, Copy, RefreshCw, Trash2, Medal, Film, Tv, ShieldAlert, Zap, Sparkles, Inbox, Send, Gift, ListVideo, Search, Filter, Eye, Info, MessageSquare, BarChart2, CheckSquare, Square } from 'lucide-react';
import { useApp, isPositiveTag } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { uid } from '../lib/utils';

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

type TabType = 'feed' | 'friends' | 'lists' | 'leaderboard';
type LeaderboardCategory = 'xp' | 'level' | 'movies' | 'episodes' | 'achievements' | 'quests';
type ProfileTabType = 'stats' | 'chat';

export default function NetworkPage() {
  const { data, showToast, addMovie, addSeries } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [leaderboardCategory, setLeaderboardCategory] = useState<LeaderboardCategory>('xp');
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});

  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<any[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileTabType>('stats');
  const [friendLogs, setFriendLogs] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendTargetId, setSendTargetId] = useState('');
  const [sendListTitle, setSendListTitle] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [viewingList, setViewingList] = useState<any>(null);

  const fetchChatMessages = useCallback(async (targetId: string) => {
    const { data: msgData } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${data.agentId},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${data.agentId})`)
      .order('created_at', { ascending: true });
    setChatMessages(msgData || []);
  }, [data.agentId]);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!data.agentId) return;
    if (!isSilent) setRefreshing(true);

    try {
      const { data: friendshipsData } = await supabase.from('friendships').select('*').or(`requester_id.eq.${data.agentId},receiver_id.eq.${data.agentId}`);
      const fList = friendshipsData || [];
      const acceptedIds = new Set<string>();
      const incoming: any[] = [];
      const outgoing: any[] = [];

      fList.forEach(f => {
        if (f.status === 'accepted') { acceptedIds.add(f.requester_id === data.agentId ? f.receiver_id : f.requester_id); } 
        else if (f.status === 'pending') { if (f.receiver_id === data.agentId) incoming.push(f); else outgoing.push(f); }
      });

      const allRelevantIds = Array.from(new Set([...Array.from(acceptedIds), ...incoming.map(i => i.requester_id), ...outgoing.map(o => o.receiver_id)]));
      
      const { data: recData } = await supabase.from('recommendations').select('*').or(`receiver_id.eq.${data.agentId},sender_id.eq.${data.agentId}`).order('created_at', { ascending: false });
      const recList = recData || [];
      recList.forEach(r => {
        if (!allRelevantIds.includes(r.sender_id)) allRelevantIds.push(r.sender_id);
        if (!allRelevantIds.includes(r.receiver_id)) allRelevantIds.push(r.receiver_id);
      });
      setRecommendations(recList);

      const { data: unreadData } = await supabase.from('messages').select('sender_id').eq('receiver_id', data.agentId).eq('is_read', false);
      const unreads: Record<string, number> = {};
      (unreadData || []).forEach(msg => { unreads[msg.sender_id] = (unreads[msg.sender_id] || 0) + 1; });
      setUnreadMessages(unreads);

      let pMap: Record<string, any> = {};
      if (allRelevantIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('*').in('agent_id', allRelevantIds);
        (profilesData || []).forEach(p => { pMap[p.agent_id] = p; });
      }
      setProfilesMap(pMap);

      const acceptedFriends = Array.from(acceptedIds).map(id => {
        const profile = pMap[id] || { nickname: 'Bilinmeyen Kullanıcı', agent_id: id };
        const friendship = fList.find(f => f.status === 'accepted' && (f.requester_id === id || f.receiver_id === id));
        return { ...profile, friendship_id: friendship?.id };
      }).filter(f => f.friendship_id);

      setFriends(acceptedFriends); setPendingIncoming(incoming); setPendingOutgoing(outgoing);

      if (acceptedIds.size > 0) {
        const { data: logsData } = await supabase.from('network_logs').select('*').in('agent_id', Array.from(acceptedIds)).order('created_at', { ascending: false }).limit(50);
        setFeed(logsData || []);
      } else { setFeed([]); }

      const { data: leadersData } = await supabase.from('profiles').select('*').order('total_xp', { ascending: false }).limit(100);
      setLeaderboard(leadersData || []);

      if (viewingProfileId && profileTab === 'chat') {
        fetchChatMessages(viewingProfileId);
      }

    } catch (error: any) { console.error('Ağ hatası:', error); } 
    finally { if (!isSilent) setLoading(false); setRefreshing(false); }
  }, [data.agentId, viewingProfileId, profileTab, fetchChatMessages]);

  useEffect(() => {
    fetchData(); 
    if (!data.agentId) return;
    
    const channel = supabase.channel('network_page_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${data.agentId}` }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'network_logs' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recommendations', filter: `receiver_id=eq.${data.agentId}` }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `receiver_id=eq.${data.agentId}` }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData(true)) // YENİ EKLENDİ!
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData, data.agentId]);

  useEffect(() => {
    if (chatScrollRef.current && profileTab === 'chat') {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, profileTab]);

  const handleSendRequest = async () => {
    const code = friendCode.trim().toUpperCase();
    if (!code) return;
    if (code === data.agentId) { showToast('Kendini ekleyemezsin!', 'warning'); return; }
    if (friends.some(f => f.agent_id === code) || pendingOutgoing.some(p => p.receiver_id === code) || pendingIncoming.some(p => p.requester_id === code)) { showToast('Zaten bir bağınız var.', 'warning'); return; }

    try {
      const { data: targetProfile } = await supabase.from('profiles').select('agent_id').eq('agent_id', code).maybeSingle();
      if (!targetProfile) { showToast('Bu kimlik koduna sahip bir kullanıcı bulunamadı!', 'error'); return; }
      await supabase.from('friendships').insert([{ id: uid(), requester_id: data.agentId, receiver_id: code, status: 'pending' }]);
      showToast('Arkadaşlık isteği gönderildi!', 'success'); setFriendCode(''); fetchData(true);
    } catch (err) { showToast('İstek gönderilirken hata oluştu.', 'error'); }
  };

  const handleAccept = async (friendshipId: string) => {
    try { await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId); showToast('Kabul edildi!', 'success'); fetchData(true); } 
    catch (err) { showToast('Hata oluştu.', 'error'); }
  };

  const handleRemove = async (friendshipId: string, isReject = false) => {
    try { await supabase.from('friendships').delete().eq('id', friendshipId); showToast(isReject ? 'İstek reddedildi.' : 'Arkadaşlıktan çıkarıldı.', 'info'); fetchData(true); } 
    catch (err) { showToast('Hata oluştu.', 'error'); }
  };

  const handleAddToLibrary = (item: any, isFromList = false) => {
    const title = isFromList ? item.title : item.item_title;
    const type = isFromList ? item.type : item.item_type;
    const poster = isFromList ? item.poster : item.item_poster;
    const genres = item.genres || [];
    const year = item.year || '';
    const cleanTitle = title.replace(/\s\(S\d+\sB\d+\)$/i, '').trim();
    const success = type === 'series' ? addSeries(cleanTitle, genres, [1], poster) : addMovie(cleanTitle, year, genres, null, undefined, poster);
    if (success) showToast(`"${cleanTitle}" kütüphanene eklendi!`, 'success');
  };

  const handleSendList = async () => {
    if (!sendTargetId) { showToast('Lütfen arkadaş seç!', 'error'); return; }
    if (!sendListTitle.trim()) { showToast('Listene bir isim ver!', 'error'); return; }
    if (selectedItemIds.length === 0) { showToast('En az bir yapım seçmelisin!', 'error'); return; }

    const combinedItems = [...data.movies.map(m => ({ ...m, type: 'movie' })), ...data.series.map(s => ({ ...s, type: 'series' }))];
    const itemsToSend = combinedItems.filter(x => selectedItemIds.includes(x.id)).map(x => ({ id: x.id, title: x.title, type: x.type, poster: x.posterUrl || null, genres: x.genres, year: x.year || '' }));

    try {
      await supabase.from('recommendations').insert([{ id: uid(), sender_id: data.agentId, receiver_id: sendTargetId, list_title: sendListTitle.trim(), items: itemsToSend, status: 'pending' }]);
      showToast('Liste gönderildi!', 'success'); setShowSendModal(false); setSendListTitle(''); setSelectedItemIds([]); setSendTargetId(''); fetchData(true);
    } catch (err) { showToast('Hata oluştu!', 'error'); }
  };

  const handleViewList = async (list: any) => {
    setViewingList(list);
    if (list.status === 'pending' && list.receiver_id === data.agentId) {
      await supabase.from('recommendations').update({ status: 'viewed' }).eq('id', list.id);
      setRecommendations(prev => prev.map(r => r.id === list.id ? { ...r, status: 'viewed' } : r));
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !viewingProfileId) return;
    const newMsg = {
      id: uid(),
      sender_id: data.agentId,
      receiver_id: viewingProfileId,
      content: chatInput.trim(),
      created_at: new Date().toISOString(),
      is_read: false
    };
    
    setChatMessages(prev => [...prev, newMsg]);
    setChatInput('');
    try { await supabase.from('messages').insert([newMsg]); } 
    catch (err) { showToast('Mesaj gönderilemedi', 'error'); }
  };

  const openProfileModal = async (targetId: string, initialTab: ProfileTabType = 'stats') => {
    if (targetId === data.agentId) return; 
    setViewingProfileId(targetId);
    setProfileTab(initialTab);
    
    const { data: logsData } = await supabase.from('network_logs').select('*').eq('agent_id', targetId).order('created_at', { ascending: false }).limit(30);
    setFriendLogs(logsData || []);
    
    fetchChatMessages(targetId);

    if (unreadMessages[targetId]) {
      await supabase.from('messages').update({ is_read: true }).eq('receiver_id', data.agentId).eq('sender_id', targetId);
      setUnreadMessages(prev => ({ ...prev, [targetId]: 0 }));
    }
  };

  const filteredLibraryItems = useMemo(() => {
    const combined = [...data.movies.map(m => ({ ...m, type: 'movie' })), ...data.series.map(s => ({ ...s, type: 'series' }))];
    return combined.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGenre = filterGenre ? item.genres.includes(filterGenre) : true;
      return matchesSearch && matchesGenre;
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [data.movies, data.series, searchQuery, filterGenre]);

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    if (leaderboardCategory === 'xp') return b.total_xp - a.total_xp;
    if (leaderboardCategory === 'level') return b.level - a.level;
    if (leaderboardCategory === 'movies') return (b.movies_watched || 0) - (a.movies_watched || 0);
    if (leaderboardCategory === 'episodes') return (b.episodes_watched || 0) - (a.episodes_watched || 0);
    if (leaderboardCategory === 'achievements') return (b.achievements_unlocked || 0) - (a.achievements_unlocked || 0);
    if (leaderboardCategory === 'quests') return (b.quests_completed || 0) - (a.quests_completed || 0);
    return 0;
  });

  const incomingLists = recommendations.filter(r => r.receiver_id === data.agentId);
  const unreadListsCount = incomingLists.filter(r => r.status === 'pending').length;
  const outgoingLists = recommendations.filter(r => r.sender_id === data.agentId);
  const totalUnread = Object.values(unreadMessages).reduce((a, b) => a + b, 0);

  if (loading) { return <div className="flex items-center justify-center h-64 text-emerald-400 animate-pulse font-bold tracking-widest uppercase text-sm">Ağ Bağlantısı Kuruluyor...</div>; }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-10 animate-fade-in font-sans px-2 sm:px-0">
      
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-ink-950 border border-ink-800/60 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-2xl sm:text-3xl">
            {data.nickname?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">{data.nickname}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg">Lvl {data.level}</span>
              <span className="text-xs font-mono text-ink-300 px-2 py-0.5 bg-ink-900 rounded-lg border border-ink-800">{data.totalXp} XP</span>
            </div>
          </div>
        </div>
        
        <button onClick={() => { navigator.clipboard.writeText(data.agentId || ''); showToast('Kod kopyalandı!', 'success'); }} className="flex items-center gap-3 bg-ink-900/50 hover:bg-ink-800 border border-ink-800 hover:border-emerald-500/40 px-4 py-3 rounded-xl transition-all group w-full sm:w-auto justify-center">
          <span className="text-xs text-ink-500 font-bold uppercase tracking-wider">Ağ Kodun:</span>
          <span className="font-mono text-emerald-400 text-base sm:text-lg font-black tracking-widest">{data.agentId}</span>
          <Copy size={16} className="text-ink-500 group-hover:text-emerald-400 transition-colors" />
        </button>
      </div>

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
        {activeTab === 'feed' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center px-2 mb-3">
              <h2 className="text-xs sm:text-sm font-black text-ink-500 uppercase tracking-widest">Ağında Neler Oluyor?</h2>
              <button onClick={() => fetchData(false)} className="text-ink-400 hover:text-emerald-400 transition-colors bg-ink-900/50 p-2 rounded-lg border border-ink-800"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /></button>
            </div>

            {feed.length === 0 ? (
              <div className="text-center py-20 bg-ink-950 border border-ink-800 border-dashed rounded-3xl">
                <Activity size={40} className="mx-auto text-ink-800 mb-4" />
                <p className="text-sm text-ink-500 font-bold uppercase tracking-widest">Akış Bomboş</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                {feed.map((log) => {
                  const profile = profilesMap[log.agent_id];
                  if (!profile) return null;
                  
                  return (
                    <div key={log.id} className="bg-ink-950 hover:bg-ink-900 border border-ink-800 rounded-2xl overflow-hidden transition-all group flex flex-col relative shadow-md hover:shadow-lg">
                      <button onClick={() => openProfileModal(log.agent_id)} className="p-3 border-b border-ink-800/60 bg-ink-900/40 flex items-start gap-3 hover:bg-ink-800/60 transition-colors text-left w-full">
                        <div className="w-8 h-8 rounded-lg bg-ink-800 flex items-center justify-center text-xs font-black text-emerald-400 flex-shrink-0 border border-ink-700">{profile.nickname[0].toUpperCase()}</div>
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

        {activeTab === 'lists' && (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="bg-gradient-to-r from-violet-950/40 to-ink-950 border border-violet-500/20 rounded-3xl p-6 sm:p-10 text-center shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-72 h-72 bg-violet-500/10 blur-[100px] rounded-full pointer-events-none" />
              <div className="relative z-10">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-violet-500/10 text-violet-400 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-violet-500/20 rotate-3 shadow-lg">
                  <Gift size={32} />
                </div>
                <h2 className="text-lg sm:text-2xl font-black text-white mb-2">Arkadaşlarına Özel Liste Gönder</h2>
                <p className="text-xs sm:text-sm text-ink-400 mb-6 max-w-md mx-auto leading-relaxed">En sevdiğin yapımları devasa kütüphanenden seçerek özel bir koleksiyon (Örn: Bu Yılın En İyileri) olarak arkadaşına yolla.</p>
                <button onClick={() => setShowSendModal(true)} className="bg-violet-600 hover:bg-violet-500 text-white px-8 py-3.5 rounded-2xl font-black text-xs sm:text-sm shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all flex items-center gap-2.5 mx-auto uppercase tracking-wider">
                  <ListVideo size={18} /> Liste Oluştur & Gönder
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-[11px] sm:text-xs font-black text-ink-500 uppercase tracking-widest mb-4 pl-2 flex items-center gap-2">
                <Inbox size={16} className="text-violet-400" /> Sana Gelen Listeler
              </h3>
              {incomingLists.length === 0 ? (
                <div className="text-center py-10 bg-ink-950 border border-ink-800 border-dashed rounded-2xl">
                  <p className="text-xs sm:text-sm text-ink-500 font-medium">Henüz gelen bir liste yok.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {incomingLists.map(list => {
                    const p = profilesMap[list.sender_id] || { nickname: 'Bilinmeyen' };
                    const isNew = list.status === 'pending';
                    return (
                      <div key={list.id} className="bg-ink-950 border border-ink-800 hover:border-violet-500/40 p-5 rounded-2xl transition-colors flex items-center justify-between group shadow-sm relative">
                        {isNew && <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-500 rounded-full border-2 border-ink-950" title="Yeni Liste" />}
                        <div className="min-w-0 pr-4">
                          <h4 className="text-base font-bold text-white truncate mb-1">{list.list_title}</h4>
                          <div className="text-[11px] text-ink-400 flex items-center gap-1.5 flex-wrap">
                            <span className="text-violet-400 font-bold">{p.nickname}</span> gönderdi
                            <span className="text-ink-600">•</span>
                            <span className="bg-ink-900 px-2 py-0.5 rounded text-ink-300 font-mono">{list.items?.length || 0} İçerik</span>
                          </div>
                        </div>
                        <button onClick={() => handleViewList(list)} className="bg-ink-900 hover:bg-violet-500/20 text-violet-400 border border-ink-800 hover:border-violet-500/50 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm">
                          İncele
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {outgoingLists.length > 0 && (
              <div className="pt-6 border-t border-ink-800/60">
                <h3 className="text-[11px] sm:text-xs font-black text-ink-500 uppercase tracking-widest mb-4 pl-2 flex items-center gap-2">
                  <Send size={16} className="text-ink-400" /> Senin Gönderdiklerin
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {outgoingLists.map(list => {
                    const p = profilesMap[list.receiver_id] || { nickname: 'Bilinmeyen' };
                    return (
                      <div key={list.id} className="bg-ink-950/50 border border-ink-800/50 p-4 rounded-2xl flex items-center justify-between opacity-70">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-ink-300 truncate mb-1">{list.list_title}</h4>
                          <div className="text-[11px] text-ink-500">Kime: {p.nickname} • {list.items?.length || 0} içerik</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="space-y-5 animate-fade-in">
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { id: 'xp', label: 'XP', icon: Sparkles }, { id: 'level', label: 'Seviye', icon: Zap },
                { id: 'movies', label: 'Film', icon: Film }, { id: 'episodes', label: 'Bölüm', icon: Tv },
                { id: 'achievements', label: 'Başarım', icon: Medal }, { id: 'quests', label: 'Görev', icon: Activity },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setLeaderboardCategory(cat.id as LeaderboardCategory)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all uppercase tracking-wider ${
                    leaderboardCategory === cat.id ? 'bg-ink-800 text-gold-400 border border-ink-700 shadow-md scale-[1.02]' : 'bg-ink-950 text-ink-500 border border-ink-800/50 hover:text-ink-300'
                  }`}
                >
                  <cat.icon size={14} className={leaderboardCategory === cat.id ? "text-gold-400" : "opacity-70"} /> {cat.label}
                </button>
              ))}
            </div>

            <div className="bg-ink-950 border border-ink-800/60 rounded-3xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-ink-900/40 border-b border-ink-800 text-[10px] sm:text-xs font-black text-ink-500 uppercase tracking-widest">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-8 sm:col-span-8 pl-2">Ajan Adı</div>
                <div className="col-span-3 sm:col-span-3 text-right pr-2">İstatistik</div>
              </div>

              <div className="divide-y divide-ink-800/30">
                {sortedLeaderboard.map((user, index) => {
                  const isMe = user.agent_id === data.agentId;
                  const rank = index + 1;
                  let rankColor = 'text-ink-500';
                  if (rank === 1) rankColor = 'text-yellow-400 text-lg';
                  else if (rank === 2) rankColor = 'text-slate-300 text-lg';
                  else if (rank === 3) rankColor = 'text-amber-600 text-lg';

                  let scoreText = '';
                  if (leaderboardCategory === 'xp') scoreText = `${user.total_xp} XP`;
                  if (leaderboardCategory === 'level') scoreText = `Lvl ${user.level}`;
                  if (leaderboardCategory === 'movies') scoreText = `${user.movies_watched || 0}`;
                  if (leaderboardCategory === 'episodes') scoreText = `${user.episodes_watched || 0}`;
                  if (leaderboardCategory === 'achievements') scoreText = `${user.achievements_unlocked || 0}`;
                  if (leaderboardCategory === 'quests') scoreText = `${user.quests_completed || 0}`;

                  return (
                    <button 
                      key={user.agent_id} 
                      onClick={() => openProfileModal(user.agent_id)}
                      className={`w-full text-left grid grid-cols-12 gap-3 p-3.5 items-center transition-colors ${isMe ? 'bg-ink-900/50' : 'hover:bg-ink-900/30'} cursor-pointer`}
                    >
                      <div className={`col-span-1 text-center font-mono text-sm sm:text-base font-black ${rankColor}`}>{rank}</div>
                      <div className="col-span-8 sm:col-span-8 flex items-center gap-3 min-w-0 pl-2">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-xs sm:text-sm ${isMe ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-ink-800 text-ink-300 border border-ink-700'}`}>
                          {user.nickname[0].toUpperCase()}
                        </div>
                        <div className="truncate flex items-center gap-2">
                          <span className={`text-sm sm:text-base font-bold truncate ${isMe ? 'text-emerald-400' : 'text-ink-100'}`}>{user.nickname}</span>
                          {isMe && <span className="hidden sm:inline-block text-[9px] bg-ink-800 text-ink-400 px-1.5 py-0.5 rounded uppercase font-bold border border-ink-700">Sen</span>}
                        </div>
                      </div>
                      <div className="col-span-3 sm:col-span-3 text-right pr-2">
                        <span className="text-sm sm:text-base font-black text-white font-mono bg-ink-900 px-3 py-1.5 rounded-lg border border-ink-800 shadow-inner">{scoreText}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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
                      {pendingIncoming.map(req => {
                        const p = profilesMap[req.requester_id] || { nickname: 'Bilinmeyen', agent_id: req.requester_id };
                        return (
                          <div key={req.id} className="flex items-center justify-between bg-ink-950 border border-ink-800 p-3 sm:p-4 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-ink-800 flex items-center justify-center font-black text-white text-sm">{p.nickname[0]}</div>
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
                      {pendingOutgoing.map(req => {
                        const p = profilesMap[req.receiver_id] || { nickname: 'Bekleniyor...', agent_id: req.receiver_id };
                        return (
                          <div key={req.id} className="flex items-center justify-between bg-ink-950 border border-ink-800/50 p-3 sm:p-4 rounded-2xl opacity-70">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-ink-900 flex items-center justify-center font-bold text-ink-500 text-sm">{p.nickname[0]}</div>
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
                  {friends.map(f => {
                    const unread = unreadMessages[f.agent_id] || 0;
                    return (
                      <div key={f.agent_id} className="flex items-center justify-between bg-ink-950 border border-ink-800 p-4 rounded-2xl hover:border-azure-500/50 transition-colors group shadow-sm">
                        <button onClick={() => openProfileModal(f.agent_id)} className="flex items-center gap-4 text-left flex-1 min-w-0">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-xl bg-azure-500/10 border border-azure-500/20 flex items-center justify-center font-black text-azure-400 text-lg">{f.nickname[0].toUpperCase()}</div>
                            {unread > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-ink-950" />}
                          </div>
                          <div className="leading-tight truncate">
                            <div className="text-base font-bold text-white truncate mb-1">{f.nickname}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-ink-900 px-2 py-0.5 rounded border border-ink-800 text-gold-400 font-bold">Lvl {f.level}</span>
                              <span className="text-[10px] text-ink-500 font-mono hidden sm:inline-block">Son: {timeAgo(f.last_seen)}</span>
                            </div>
                          </div>
                        </button>
                        
                        <div className="flex items-center gap-2 pl-3">
                          <button onClick={() => openProfileModal(f.agent_id, 'chat')} className="p-3 text-ink-400 hover:text-azure-400 bg-ink-900 hover:bg-azure-500/10 rounded-xl transition-colors border border-transparent hover:border-azure-500/30 relative">
                            <MessageSquare size={18} />
                            {unread > 0 && <span className="absolute -top-2 -right-2 text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full shadow-md">{unread}</span>}
                          </button>
                          <button onClick={() => { if(window.confirm(`Arkadaşlıktan çıkarmak istiyor musun?`)) handleRemove(f.friendship_id); }} className="text-ink-600 hover:text-red-400 p-3 bg-ink-900 hover:bg-red-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-500/30" title="Sil"><Trash2 size={18} /></button>
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
      {/* MODALS */}
      {/* ============================== */}
      
      {/* 1. AKIŞ DETAY MODALI */}
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
                  <div className="w-6 h-6 rounded-md bg-ink-800 text-emerald-400 flex items-center justify-center text-[11px] font-black">{profilesMap[selectedLog.agent_id]?.nickname[0]}</div>
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
                      const cleanNote = rawNote.replace(/\[spoiler\]/gi, '').replace(/#spoiler/gi, '').trim();
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

              <button 
                onClick={() => { handleAddToLibrary(selectedLog); setSelectedLog(null); }}
                className="w-full mt-auto py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 uppercase tracking-wider shrink-0"
              >
                <Plus size={18} strokeWidth={3} /> Kütüphaneme Ekle
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 2. LİSTE GÖNDERME MODALI */}
      {showSendModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowSendModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl h-[85vh] bg-ink-950 border border-violet-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 sm:p-5 border-b border-ink-800 bg-ink-900/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center border border-violet-500/30"><Send size={18} /></div>
                <h2 className="text-base sm:text-lg font-black text-white">Arkadaşına Tavsiye Gönder</h2>
              </div>
              <button onClick={() => setShowSendModal(false)} className="text-ink-500 hover:text-white p-1.5 rounded-lg bg-ink-900"><X size={18} /></button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              <div className="w-full md:w-72 p-5 border-b md:border-b-0 md:border-r border-ink-800 bg-ink-900/20 flex flex-col gap-5 overflow-y-auto custom-scrollbar flex-shrink-0">
                <div>
                  <label className="block text-[11px] font-bold text-ink-400 uppercase tracking-widest mb-2">1. Kime Gidecek?</label>
                  <select 
                    value={sendTargetId} 
                    onChange={(e) => setSendTargetId(e.target.value)}
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-violet-500 outline-none"
                  >
                    <option value="">-- Arkadaş Seç --</option>
                    {friends.map(f => (
                      <option key={f.agent_id} value={f.agent_id}>{f.nickname}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-400 uppercase tracking-widest mb-2">2. Listenin Adı</label>
                  <input 
                    type="text" 
                    value={sendListTitle}
                    onChange={(e) => setSendListTitle(e.target.value)}
                    placeholder="Örn: Bilim Kurgu Şaheserleri"
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-violet-500 outline-none"
                  />
                </div>
                <div className="pt-3 border-t border-ink-800">
                  <label className="block text-[11px] font-bold text-ink-400 uppercase tracking-widest mb-3">3. Kütüphaneni Filtrele</label>
                  <div className="relative mb-3">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
                    <input 
                      type="text" 
                      placeholder="İsimle Ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-ink-950 border border-ink-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-violet-500 outline-none"
                    />
                  </div>
                  <div className="relative">
                    <Filter size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
                    <select 
                      value={filterGenre} 
                      onChange={(e) => setFilterGenre(e.target.value)}
                      className="w-full bg-ink-950 border border-ink-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-violet-500 outline-none appearance-none"
                    >
                      <option value="">Tüm Türler</option>
                      {data.genres.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden bg-ink-950 relative">
                <div className="p-4 border-b border-ink-800 flex items-center justify-between bg-ink-900/40">
                  <span className="text-[11px] font-bold text-ink-400 uppercase tracking-widest">Kütüphanen</span>
                  <span className="text-xs text-violet-400 font-bold bg-violet-500/10 px-3 py-1 rounded-lg border border-violet-500/20">{selectedItemIds.length} Yapım Seçildi</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
                  {filteredLibraryItems.length === 0 ? (
                    <div className="text-center py-12 text-ink-600 text-sm italic border border-ink-800 border-dashed rounded-2xl">Sonuç bulunamadı.</div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
                      {filteredLibraryItems.map(item => {
                        const isSelected = selectedItemIds.includes(item.id);
                        return (
                          <div 
                            key={item.id} 
                            onClick={() => setSelectedItemIds(prev => isSelected ? prev.filter(id => id !== item.id) : [...prev, item.id])}
                            className={`relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer group border-2 transition-all ${isSelected ? 'border-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.4)] scale-95' : 'border-transparent hover:border-ink-600 bg-ink-900'}`}
                          >
                            {item.posterUrl ? (
                              <img src={item.posterUrl} alt="poster" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-ink-700">
                                {item.type === 'series' ? <Tv size={32} /> : <Film size={32} />}
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent p-2.5 pt-8">
                              <h3 className="text-[10px] sm:text-[11px] font-bold text-white line-clamp-2 leading-tight drop-shadow-md">{item.title}</h3>
                            </div>
                            <div className={`absolute inset-0 bg-violet-500/20 backdrop-blur-[1px] flex items-center justify-center transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
                              <div className="w-10 h-10 rounded-full bg-violet-500 text-white flex items-center justify-center shadow-xl">
                                <Check size={20} strokeWidth={4} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-ink-800 bg-ink-950 flex gap-3 flex-shrink-0">
              <button onClick={() => setShowSendModal(false)} className="px-6 py-3.5 bg-ink-900 text-ink-300 rounded-xl text-sm font-bold hover:bg-ink-800 transition-colors">İptal</button>
              <button onClick={handleSendList} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-black transition-colors flex items-center justify-center gap-2 uppercase tracking-wider shadow-lg shadow-violet-500/20">
                <Send size={18} /> Listeyi Gönder ({selectedItemIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. LİSTE İNCELEME MODALI */}
      {viewingList && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setViewingList(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl bg-ink-950 border border-ink-700 rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
            <div className="p-5 sm:p-6 border-b border-ink-800 bg-ink-900/40 relative shrink-0">
              <button onClick={() => setViewingList(null)} className="absolute top-5 right-5 text-ink-500 hover:text-white bg-ink-900 p-2 rounded-full transition-colors"><X size={18} /></button>
              <div className="pr-12">
                <div className="text-[11px] font-bold text-violet-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Gift size={14}/> Tavsiye Listesi</div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 leading-tight">{viewingList.list_title}</h2>
                <div className="text-sm text-ink-400">Gönderen: <span className="text-white font-bold">{profilesMap[viewingList.sender_id]?.nickname || 'Bilinmeyen'}</span></div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar bg-ink-950">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {viewingList.items?.map((item: any, idx: number) => {
                  const alreadyHas = data.movies.some(m => m.title.toLowerCase() === item.title.toLowerCase()) || data.series.some(s => s.title.toLowerCase() === item.title.toLowerCase());
                  return (
                    <div key={idx} className="relative aspect-[2/3] rounded-xl overflow-hidden group border border-ink-800 bg-ink-900 shadow-md">
                      {item.poster ? (
                        <img src={item.poster} alt="poster" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink-700">
                          {item.type === 'series' ? <Tv size={32} /> : <Film size={32} />}
                        </div>
                      )}
                      
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent p-3 pt-10">
                        <h4 className="text-[11px] sm:text-xs font-bold text-white line-clamp-2 leading-tight mb-1 drop-shadow-md">{item.title}</h4>
                        <div className="text-[9px] text-ink-400 uppercase tracking-widest">{item.type === 'series' ? 'Dizi' : 'Film'} {item.year ? `• ${item.year}` : ''}</div>
                      </div>

                      <div className="absolute top-2.5 right-2.5">
                        {alreadyHas ? (
                          <div className="bg-emerald-500/90 text-white p-2 rounded-lg shadow-md backdrop-blur-sm" title="Zaten Kütüphanende">
                            <Check size={16} strokeWidth={3} />
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleAddToLibrary(item, true)}
                            className="bg-violet-600 hover:bg-violet-500 text-white p-2 rounded-lg shadow-xl backdrop-blur-sm transition-all hover:scale-110"
                            title="Kütüphaneme Ekle"
                          >
                            <Plus size={16} strokeWidth={3} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-ink-800 bg-ink-950 shrink-0">
              <button onClick={() => setViewingList(null)} className="w-full py-3.5 bg-ink-900 hover:bg-ink-800 text-white rounded-xl text-sm font-bold transition-colors tracking-widest uppercase">
                Pencereyi Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. PROFİL İNCELEME (STALK) VE CANLI SOHBET MODALI */}
      {viewingProfileId && (() => {
        const p = profilesMap[viewingProfileId] || { nickname: 'Bilinmeyen Ajan', level: 0, total_xp: 0 };
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setViewingProfileId(null)}>
            <div onClick={e => e.stopPropagation()} className="w-full max-w-3xl bg-ink-950 border border-azure-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh]">
              
              <div className="p-6 sm:p-8 border-b border-ink-800 bg-ink-900/80 flex flex-col relative shrink-0 overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-azure-900/20 to-transparent pointer-events-none" />
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-azure-500/10 blur-[80px] rounded-full pointer-events-none" />
                
                <button onClick={() => setViewingProfileId(null)} className="absolute top-4 right-4 text-ink-400 hover:text-white p-2 rounded-full hover:bg-ink-800/80 relative z-20 transition-colors"><X size={18} /></button>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 relative z-10 text-center sm:text-left mt-2">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-azure-500 to-indigo-600 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.3)] border-2 border-azure-400/50 rotate-3 transform hover:rotate-0 transition-transform duration-300">
                    <span className="text-4xl sm:text-5xl font-black text-white drop-shadow-md">{p.nickname[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 mt-2 sm:mt-0">
                    <div className="text-[10px] text-azure-400 font-bold uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-start gap-1.5"><ShieldAlert size={12}/> Sinevia Ajanı</div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-2">{p.nickname}</h2>
                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-azure-950 bg-azure-400 px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-md">Lvl {p.level}</span>
                      <span className="text-[10px] font-bold text-gold-400 bg-gold-500/10 border border-gold-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1"><Sparkles size={10}/> {p.total_xp} XP</span>
                      <span className="text-[10px] text-ink-400 font-mono bg-ink-950/80 px-2 py-1 rounded border border-ink-800">Kod: {viewingProfileId}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex border-b border-ink-800 bg-ink-950 shrink-0">
                <button 
                  onClick={() => setProfileTab('stats')}
                  className={`flex-1 py-3.5 text-xs sm:text-sm font-bold transition-colors border-b-2 flex items-center justify-center gap-2 ${profileTab === 'stats' ? 'border-azure-500 text-azure-400 bg-azure-500/5' : 'border-transparent text-ink-400 hover:text-ink-200 hover:bg-ink-900/50'}`}
                >
                  <BarChart2 size={16} /> Profil & Kıyaslama
                </button>
                <button 
                  onClick={() => setProfileTab('chat')}
                  className={`flex-1 py-3.5 text-xs sm:text-sm font-bold transition-colors border-b-2 flex items-center justify-center gap-2 ${profileTab === 'chat' ? 'border-azure-500 text-azure-400 bg-azure-500/5' : 'border-transparent text-ink-400 hover:text-ink-200 hover:bg-ink-900/50'}`}
                >
                  <MessageSquare size={16} /> Canlı Sohbet
                </button>
              </div>

              {profileTab === 'stats' && (
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-6">
                    <div className="bg-ink-900/60 border border-ink-800 p-4 rounded-2xl flex flex-col items-center justify-center shadow-sm relative overflow-hidden group">
                      <Film size={20} className="text-ink-700 absolute -right-2 -bottom-2 opacity-20 group-hover:scale-125 transition-transform" />
                      <div className="text-2xl font-black text-white mb-0.5">{p.movies_watched || 0}</div>
                      <div className="text-[9px] font-bold text-ink-500 uppercase tracking-widest text-center">Film<br/>İzledi</div>
                    </div>
                    <div className="bg-ink-900/60 border border-ink-800 p-4 rounded-2xl flex flex-col items-center justify-center shadow-sm relative overflow-hidden group">
                      <Tv size={20} className="text-ink-700 absolute -right-2 -bottom-2 opacity-20 group-hover:scale-125 transition-transform" />
                      <div className="text-2xl font-black text-white mb-0.5">{p.series_watched || 0}</div>
                      <div className="text-[9px] font-bold text-ink-500 uppercase tracking-widest text-center">Dizi<br/>Bitirdi</div>
                    </div>
                    <div className="bg-ink-900/60 border border-ink-800 p-4 rounded-2xl flex flex-col items-center justify-center shadow-sm relative overflow-hidden group">
                      <Activity size={20} className="text-ink-700 absolute -right-2 -bottom-2 opacity-20 group-hover:scale-125 transition-transform" />
                      <div className="text-2xl font-black text-white mb-0.5">{p.episodes_watched || 0}</div>
                      <div className="text-[9px] font-bold text-ink-500 uppercase tracking-widest text-center">Bölüm<br/>İzledi</div>
                    </div>
                    <div className="bg-ink-900/60 border border-ink-800 p-4 rounded-2xl flex flex-col items-center justify-center shadow-sm relative overflow-hidden group">
                      <Medal size={20} className="text-gold-700 absolute -right-2 -bottom-2 opacity-20 group-hover:scale-125 transition-transform" />
                      <div className="text-2xl font-black text-gold-400 mb-0.5">{p.achievements_unlocked || 0}</div>
                      <div className="text-[9px] font-bold text-gold-500/50 uppercase tracking-widest text-center">Başarım<br/>Açtı</div>
                    </div>
                    <div className="bg-ink-900/60 border border-ink-800 p-4 rounded-2xl flex flex-col items-center justify-center shadow-sm relative overflow-hidden group col-span-2 sm:col-span-1">
                      <CheckSquare size={20} className="text-orange-700 absolute -right-2 -bottom-2 opacity-20 group-hover:scale-125 transition-transform" />
                      <div className="text-2xl font-black text-orange-400 mb-0.5">{p.quests_completed || 0}</div>
                      <div className="text-[9px] font-bold text-orange-500/50 uppercase tracking-widest text-center">Görev<br/>Bitti</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[11px] font-black text-ink-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Activity size={14} className="text-azure-400" /> Son İzledikleri & Ortak Zevkleriniz
                    </h3>
                    
                    {friendLogs.length === 0 ? (
                      <div className="text-center py-10 border border-ink-800 border-dashed rounded-2xl text-sm text-ink-500">
                        Henüz bir aktivitesi yok.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {friendLogs.map(log => {
                          const myMovieMatch = data.movies.find(m => m.title.toLowerCase() === log.item_title.toLowerCase());
                          const mySeriesMatch = data.series.find(s => s.title.toLowerCase() === log.item_title.toLowerCase());
                          const myMatch = log.item_type === 'movie' ? myMovieMatch : mySeriesMatch;
                          const iWatched = myMovieMatch?.watched || (mySeriesMatch && mySeriesMatch.episodes.some(e => e.watched));
                          
                          const hisRating = log.rating;
                          let myRating = myMovieMatch?.rating;
                          if (log.item_type === 'series' && mySeriesMatch) {
                            const ratedEps = mySeriesMatch.episodes.filter(e => e.rating !== null);
                            if (ratedEps.length > 0) myRating = ratedEps.reduce((a,b) => a + (b.rating||0), 0) / ratedEps.length;
                          }

                          return (
                            <div key={log.id} className="bg-ink-900/30 border border-ink-800 rounded-2xl p-3 sm:p-4 flex gap-4 items-start sm:items-center group">
                              <div className="w-14 sm:w-16 aspect-[2/3] bg-ink-900 rounded-lg overflow-hidden flex-shrink-0 border border-ink-700 shadow-sm">
                                {log.item_poster ? <img src={log.item_poster} className="w-full h-full object-cover" /> : <Film size={20} className="text-ink-600 m-auto mt-6" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm sm:text-base font-bold text-white truncate leading-tight">{log.item_title}</h4>
                                <div className="text-[10px] text-ink-500 mb-2 mt-0.5">{timeAgo(log.created_at)}</div>
                                
                                {iWatched ? (
                                  <div className="flex items-center gap-4 bg-ink-950/80 rounded-xl border border-ink-800/80 p-2 inline-flex shadow-inner">
                                    <div className="flex flex-col items-center px-2 sm:px-3">
                                      <span className="text-[9px] font-bold text-ink-500 uppercase tracking-widest mb-0.5">Puanı</span>
                                      <span className={`text-[11px] sm:text-xs font-black ${hisRating ? 'text-azure-400' : 'text-ink-600'}`}>{hisRating || '-'}</span>
                                    </div>
                                    <div className="w-px h-8 bg-ink-800"></div>
                                    <div className="flex flex-col items-center px-2 sm:px-3">
                                      <span className="text-[9px] font-bold text-ink-500 uppercase tracking-widest mb-0.5">Senin</span>
                                      <span className={`text-[11px] sm:text-xs font-black ${myRating ? 'text-emerald-400' : 'text-ink-600'}`}>{myRating ? (myRating % 1 === 0 ? myRating : myRating.toFixed(1)) : '-'}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[10px] sm:text-[11px] font-bold text-ink-600 bg-ink-950 border border-ink-800/50 px-2.5 py-1.5 rounded-lg inline-block">Sen henüz izlemedin</div>
                                )}
                              </div>
                              {!myMatch && (
                                <button onClick={() => handleAddToLibrary(log)} className="mt-2 sm:mt-0 mr-1 w-10 h-10 rounded-full bg-ink-800 hover:bg-emerald-500/20 text-ink-400 hover:text-emerald-400 flex items-center justify-center transition-all border border-transparent hover:border-emerald-500/30 flex-shrink-0" title="Kütüphaneme Ekle">
                                  <Plus size={18} />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {profileTab === 'chat' && (
                <div className="flex flex-col flex-1 overflow-hidden bg-ink-950 relative">
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar" ref={chatScrollRef}>
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-ink-500 opacity-60">
                        <MessageSquare size={40} className="mb-3" />
                        <p className="text-sm font-bold uppercase tracking-widest">Sohbeti Başlat</p>
                      </div>
                    ) : (
                      chatMessages.map(msg => {
                        const isMe = msg.sender_id === data.agentId;
                        return (
                          <div key={msg.id} className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isMe ? 'self-end items-end ml-auto' : 'self-start items-start'}`}>
                            <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${isMe ? 'bg-azure-600 text-white rounded-tr-sm' : 'bg-ink-800 text-ink-100 rounded-tl-sm border border-ink-700/50'}`}>
                              {msg.content}
                            </div>
                            <span className="text-[9px] sm:text-[10px] text-ink-500 font-bold mt-1 px-1.5">{new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  
                  <div className="p-3 sm:p-4 bg-ink-900 border-t border-ink-800 shrink-0">
                    <div className="flex gap-2 sm:gap-3">
                      <input 
                        type="text" 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Bir mesaj yaz..."
                        className="flex-1 bg-ink-950 border border-ink-700 rounded-full px-5 py-3 text-sm text-white focus:border-azure-500 outline-none"
                      />
                      <button 
                        onClick={handleSendMessage}
                        disabled={!chatInput.trim()}
                        className="w-12 h-12 rounded-full bg-azure-600 hover:bg-azure-500 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-colors shadow-lg shadow-azure-500/20"
                      >
                        <Send size={18} className="ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}