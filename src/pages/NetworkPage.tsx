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

  // Veri Stateleri
  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<any[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  
  // YENİ: Mesajlaşma ve Bildirim Stateleri
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  
  // PROFİL (STALK) & SOHBET MODAL STATELERİ
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileTabType>('stats');
  const [friendLogs, setFriendLogs] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Gönderme Modalları
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

      // Okunmamış mesajları çek
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

      // Eger modal aciksa arka planda chat'i guncelle
      if (viewingProfileId && profileTab === 'chat') {
        fetchChatMessages(viewingProfileId);
      }

    } catch (error: any) { console.error('Ağ hatası:', error); } 
    finally { if (!isSilent) setLoading(false); setRefreshing(false); }
  }, [data.agentId, viewingProfileId, profileTab, fetchChatMessages]);

  useEffect(() => {
    fetchData(); 
    const intervalId = setInterval(() => { fetchData(true); }, 5000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  // Chat scroll'u hep asagida tut
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
    if (targetId === data.agentId) return; // Kendi profilini açamaz
    setViewingProfileId(targetId);
    setProfileTab(initialTab);
    
    // Geçmiş aktivitelerini çek (Stalk verileri)
    const { data: logsData } = await supabase.from('network_logs').select('*').eq('agent_id', targetId).order('created_at', { ascending: false }).limit(30);
    setFriendLogs(logsData || []);
    
    // Mesajları çek
    fetchChatMessages(targetId);

    // Eğer okunmamış mesaj varsa görüldü işaretle
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
  const outgoingLists = recommendations.filter(r => r.sender_id === data.agentId);

  // Toplam okunmamış mesaj sayısı
  const totalUnread = Object.values(unreadMessages).reduce((a, b) => a + b, 0);

  if (loading) { return <div className="flex items-center justify-center h-64 text-emerald-400 animate-pulse font-bold tracking-widest uppercase text-xs">Ağ Bağlantısı Kuruluyor...</div>; }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10 animate-fade-in font-sans">
      
      {/* SADE VE ŞIK PROFİL KARTI */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-ink-950 border border-ink-800/60 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-xl">
            {data.nickname?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h1 className="text-lg font-black text-white leading-tight">{data.nickname}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Lvl {data.level}</span>
              <span className="text-[10px] font-mono text-ink-500 px-1.5 py-0.5 bg-ink-900 rounded">{data.totalXp} XP</span>
            </div>
          </div>
        </div>
        
        <button onClick={() => { navigator.clipboard.writeText(data.agentId || ''); showToast('Kod kopyalandı!', 'success'); }} className="flex items-center gap-2.5 bg-ink-900/50 hover:bg-ink-800 border border-ink-800 hover:border-emerald-500/40 px-3 py-2 rounded-xl transition-all group w-full sm:w-auto justify-center">
          <span className="text-[10px] text-ink-500 font-bold uppercase tracking-wider">Ağ Kodun:</span>
          <span className="font-mono text-emerald-400 text-sm font-black tracking-widest">{data.agentId}</span>
          <Copy size={14} className="text-ink-500 group-hover:text-emerald-400 transition-colors" />
        </button>
      </div>

      {/* SEKME MENÜSÜ */}
      <div className="flex flex-wrap bg-ink-900/40 p-1 rounded-xl border border-ink-800 overflow-hidden">
        {[
          { id: 'feed', label: 'Akış', icon: Activity },
          { id: 'friends', label: `Arkadaşlar`, icon: Users, badge: pendingIncoming.length + totalUnread },
          { id: 'lists', label: 'Listeler', icon: Inbox, badge: incomingLists.length },
          { id: 'leaderboard', label: 'Sıralama', icon: Trophy }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)} 
            className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all relative ${activeTab === tab.id ? 'bg-ink-800 text-white shadow-sm border border-ink-700/50' : 'text-ink-500 hover:text-ink-300'}`}
          >
            <tab.icon size={14} className={activeTab === tab.id && tab.id === 'feed' ? 'text-emerald-400' : activeTab === tab.id && tab.id === 'friends' ? 'text-azure-400' : activeTab === tab.id && tab.id === 'lists' ? 'text-violet-400' : activeTab === tab.id ? 'text-gold-400' : ''} />
            {tab.label}
            {tab.badge ? <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" /> : null}
          </button>
        ))}
      </div>

      <div className="min-h-[500px]">
        
        {/* ============================== */}
        {/* AĞ AKIŞI */}
        {/* ============================== */}
        {activeTab === 'feed' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center px-1 mb-2">
              <h2 className="text-[10px] font-black text-ink-500 uppercase tracking-widest">Ağında Neler Oluyor?</h2>
              <button onClick={() => fetchData(false)} className="text-ink-500 hover:text-emerald-400 transition-colors"><RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /></button>
            </div>

            {feed.length === 0 ? (
              <div className="text-center py-16 bg-ink-950 border border-ink-800 border-dashed rounded-2xl">
                <Activity size={32} className="mx-auto text-ink-800 mb-3" />
                <p className="text-xs text-ink-500 font-medium uppercase tracking-widest">Akış Bomboş</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {feed.map((log) => {
                  const profile = profilesMap[log.agent_id];
                  if (!profile) return null;
                  
                  return (
                    <div key={log.id} className="bg-ink-950 hover:bg-ink-900 border border-ink-800 rounded-xl overflow-hidden transition-all group flex flex-col relative shadow-sm">
                      <button onClick={() => openProfileModal(log.agent_id)} className="p-2 border-b border-ink-800/60 bg-ink-900/30 flex items-center justify-between hover:bg-ink-800/50 transition-colors text-left">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-4 h-4 rounded bg-ink-800 flex items-center justify-center text-[9px] font-black text-emerald-400 flex-shrink-0">{profile.nickname[0]}</div>
                          <span className="text-[10px] font-bold text-white truncate group-hover:text-emerald-300">{profile.nickname}</span>
                        </div>
                        <span className="text-[8px] text-ink-500 font-mono whitespace-nowrap pl-1">{timeAgo(log.created_at)}</span>
                      </button>

                      <button onClick={() => setSelectedLog(log)} className="relative w-full aspect-[2/3] bg-ink-900 flex items-center justify-center overflow-hidden">
                        {log.item_poster ? (
                          <img src={log.item_poster} alt="poster" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                        ) : (
                          <Film size={24} className="text-ink-700" />
                        )}

                        <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-[2px] flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <Eye size={20} className="text-emerald-400 mb-1" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-white">İncelemeyi Gör</span>
                        </div>
                        
                        {log.rating && (
                          <div className="absolute bottom-2 right-2 bg-ink-950/90 text-gold-400 text-[10px] font-black px-1.5 py-0.5 rounded border border-gold-500/30 backdrop-blur-sm flex items-center gap-0.5">
                            <Star size={8} className="fill-gold-400" /> {log.rating}
                          </div>
                        )}
                      </button>

                      <div className="p-2.5">
                        <h3 className="text-xs font-bold text-ink-200 truncate leading-tight">{log.item_title}</h3>
                        <div className="text-[9px] text-ink-500 uppercase tracking-widest mt-0.5">{log.item_type === 'series' ? 'Dizi' : 'Film'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================== */}
        {/* LİSTELER TAB'I */}
        {/* ============================== */}
        {activeTab === 'lists' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-gradient-to-r from-violet-950/40 to-ink-950 border border-violet-500/20 rounded-3xl p-5 sm:p-6 text-center shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 blur-[80px] rounded-full pointer-events-none" />
              <div className="relative z-10">
                <div className="w-14 h-14 bg-violet-500/10 text-violet-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-violet-500/20 rotate-3"><Gift size={26} /></div>
                <h2 className="text-base sm:text-lg font-black text-white mb-1.5">Arkadaşlarına Özel Liste Gönder</h2>
                <p className="text-xs text-ink-400 mb-5 max-w-sm mx-auto">En sevdiğin yapımları seçerek özel bir koleksiyon olarak arkadaşına yolla.</p>
                <button onClick={() => setShowSendModal(true)} className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl font-black text-xs sm:text-sm shadow-[0_0_15px_rgba(124,58,237,0.3)] transition-all flex items-center gap-2 mx-auto uppercase tracking-wider">
                  <ListVideo size={16} /> Liste Oluştur & Gönder
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-black text-ink-500 uppercase tracking-widest mb-3 pl-1 flex items-center gap-1.5">
                <Inbox size={14} className="text-violet-400" /> Sana Gelen Listeler
              </h3>
              {incomingLists.length === 0 ? (
                <div className="text-center py-6 bg-ink-950 border border-ink-800 border-dashed rounded-xl">
                  <p className="text-xs text-ink-500">Henüz gelen bir liste yok.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {incomingLists.map(list => {
                    const p = profilesMap[list.sender_id] || { nickname: 'Bilinmeyen' };
                    return (
                      <div key={list.id} className="bg-ink-950 border border-ink-800 hover:border-violet-500/40 p-4 rounded-xl transition-colors flex items-center justify-between group">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{list.list_title}</h4>
                          <div className="text-[10px] text-ink-400 mt-1 flex items-center gap-1.5">
                            <span className="text-violet-400 font-bold">{p.nickname}</span> gönderdi
                            <span className="text-ink-600">•</span>
                            <span className="bg-ink-900 px-1.5 py-0.5 rounded text-ink-300 font-mono">{list.items?.length || 0} İçerik</span>
                          </div>
                        </div>
                        <button onClick={() => setViewingList(list)} className="bg-ink-900 hover:bg-violet-500/20 text-violet-400 border border-ink-800 hover:border-violet-500/50 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm">
                          İncele
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {outgoingLists.length > 0 && (
              <div className="pt-4 border-t border-ink-800/60">
                <h3 className="text-[10px] font-black text-ink-500 uppercase tracking-widest mb-3 pl-1 flex items-center gap-1.5">
                  <Send size={14} className="text-ink-400" /> Senin Gönderdiklerin
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {outgoingLists.map(list => {
                    const p = profilesMap[list.receiver_id] || { nickname: 'Bilinmeyen' };
                    return (
                      <div key={list.id} className="bg-ink-950/50 border border-ink-800/50 p-3 rounded-xl flex items-center justify-between opacity-70">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-ink-300 truncate">{list.list_title}</h4>
                          <div className="text-[10px] text-ink-500 mt-0.5">Kime: {p.nickname} • {list.items?.length || 0} içerik</div>
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
        {/* LİDERLİK TABLOSU */}
        {/* ============================== */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-3 sm:flex flex-wrap gap-1.5">
              {[
                { id: 'xp', label: 'XP', icon: Sparkles }, { id: 'level', label: 'Seviye', icon: Zap },
                { id: 'movies', label: 'Film', icon: Film }, { id: 'episodes', label: 'Bölüm', icon: Tv },
                { id: 'achievements', label: 'Rozet', icon: Medal }, { id: 'quests', label: 'Görev', icon: Activity },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setLeaderboardCategory(cat.id as LeaderboardCategory)}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wider ${
                    leaderboardCategory === cat.id ? 'bg-ink-800 text-gold-400 border border-ink-700 shadow-sm' : 'bg-ink-950 text-ink-500 border border-ink-800/50 hover:text-ink-300'
                  }`}
                >
                  <cat.icon size={12} className={leaderboardCategory === cat.id ? "text-gold-400" : "opacity-70"} /> {cat.label}
                </button>
              ))}
            </div>

            <div className="bg-ink-950 border border-ink-800/60 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-ink-900/40 border-b border-ink-800 text-[9px] font-black text-ink-500 uppercase tracking-widest">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-8 sm:col-span-7 pl-1">Kullanıcı Adı</div>
                <div className="col-span-3 sm:col-span-4 text-right pr-1">Skor</div>
              </div>

              <div className="divide-y divide-ink-800/30">
                {sortedLeaderboard.map((user, index) => {
                  const isMe = user.agent_id === data.agentId;
                  const rank = index + 1;
                  let rankColor = 'text-ink-500';
                  if (rank === 1) rankColor = 'text-yellow-400';
                  else if (rank === 2) rankColor = 'text-slate-300';
                  else if (rank === 3) rankColor = 'text-amber-600';

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
                      className={`w-full text-left grid grid-cols-12 gap-2 p-2.5 items-center transition-colors ${isMe ? 'bg-ink-900/50' : 'hover:bg-ink-900/30'} cursor-pointer`}
                    >
                      <div className={`col-span-1 text-center font-mono text-[11px] font-black ${rankColor}`}>{rank}</div>
                      <div className="col-span-8 sm:col-span-7 flex items-center gap-2 min-w-0 pl-1">
                        <div className={`w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center font-black text-[10px] ${isMe ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-ink-800 text-ink-300'}`}>
                          {user.nickname[0].toUpperCase()}
                        </div>
                        <div className="truncate flex items-center gap-1.5">
                          <span className={`text-xs sm:text-sm font-bold truncate ${isMe ? 'text-emerald-400' : 'text-ink-100'}`}>{user.nickname}</span>
                          {isMe && <span className="hidden sm:inline-block text-[8px] bg-ink-800 text-ink-400 px-1 py-0.5 rounded uppercase font-bold">Sen</span>}
                        </div>
                      </div>
                      <div className="col-span-3 sm:col-span-4 text-right pr-1">
                        <span className="text-xs font-black text-white font-mono bg-ink-900 px-2 py-1 rounded border border-ink-800">{scoreText}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================== */}
        {/* ARKADAŞ YÖNETİMİ */}
        {/* ============================== */}
        {activeTab === 'friends' && (
          <div className="space-y-5 animate-fade-in">
            <div className="bg-ink-950 border border-azure-500/20 rounded-2xl p-4 sm:p-5">
              <h2 className="text-[11px] font-black text-azure-400 mb-3 flex items-center gap-1.5 uppercase tracking-widest"><UserPlus size={14} /> Yeni Arkadaş Ekle</h2>
              <div className="flex gap-2">
                <input
                  type="text" placeholder="SNV-XXXX-XXXX" value={friendCode} onChange={(e) => setFriendCode(e.target.value)}
                  className="flex-1 bg-ink-900 border border-ink-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono uppercase tracking-widest focus:border-azure-500 outline-none transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendRequest()}
                />
                <button onClick={handleSendRequest} className="bg-azure-600 hover:bg-azure-500 text-white px-4 rounded-xl font-bold text-xs transition-colors">İstek At</button>
              </div>
            </div>

            {(pendingIncoming.length > 0 || pendingOutgoing.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pendingIncoming.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black text-ink-500 uppercase tracking-widest mb-2 pl-1">Gelen İstekler</h3>
                    <div className="space-y-1.5">
                      {pendingIncoming.map(req => {
                        const p = profilesMap[req.requester_id] || { nickname: 'Bilinmeyen', agent_id: req.requester_id };
                        return (
                          <div key={req.id} className="flex items-center justify-between bg-ink-950 border border-ink-800 p-2.5 rounded-xl">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-ink-800 flex items-center justify-center font-black text-white text-xs">{p.nickname[0]}</div>
                              <div className="leading-tight">
                                <div className="text-xs font-bold text-white">{p.nickname}</div>
                                <div className="text-[9px] text-ink-500 font-mono">{p.agent_id}</div>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => handleAccept(req.id)} className="w-7 h-7 flex items-center justify-center bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"><Check size={14} /></button>
                              <button onClick={() => handleRemove(req.id, true)} className="w-7 h-7 flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"><X size={14} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {pendingOutgoing.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black text-ink-500 uppercase tracking-widest mb-2 pl-1">Giden İstekler</h3>
                    <div className="space-y-1.5">
                      {pendingOutgoing.map(req => {
                        const p = profilesMap[req.receiver_id] || { nickname: 'Bekleniyor...', agent_id: req.receiver_id };
                        return (
                          <div key={req.id} className="flex items-center justify-between bg-ink-950 border border-ink-800/50 p-2.5 rounded-xl opacity-70">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-ink-900 flex items-center justify-center font-bold text-ink-500 text-xs">{p.nickname[0]}</div>
                              <div className="leading-tight">
                                <div className="text-xs font-bold text-ink-300">{p.nickname}</div>
                                <div className="text-[9px] text-ink-600 font-mono">{p.agent_id}</div>
                              </div>
                            </div>
                            <button onClick={() => handleRemove(req.id, true)} className="p-1 text-red-400/70 hover:text-red-400 transition-colors" title="İptal Et"><X size={14} /></button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className="text-[10px] font-black text-ink-500 uppercase tracking-widest mb-2 pl-1">Dost Meclisi</h3>
              {friends.length === 0 ? (
                <div className="text-center py-6 bg-ink-950 border border-ink-800 border-dashed rounded-xl">
                  <p className="text-xs text-ink-500 font-medium">Kimse yok.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {friends.map(f => {
                    const unread = unreadMessages[f.agent_id] || 0;
                    return (
                      <div key={f.agent_id} className="flex items-center justify-between bg-ink-950 border border-ink-800 p-2.5 rounded-xl hover:border-azure-500/50 transition-colors group">
                        <button onClick={() => openProfileModal(f.agent_id)} className="flex items-center gap-3 text-left flex-1 min-w-0">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-xl bg-azure-500/10 border border-azure-500/20 flex items-center justify-center font-black text-azure-400 text-sm">{f.nickname[0].toUpperCase()}</div>
                            {unread > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-ink-950" />}
                          </div>
                          <div className="leading-tight truncate">
                            <div className="text-sm font-bold text-white truncate">{f.nickname}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] bg-ink-900 px-1.5 py-0.5 rounded text-gold-400 font-bold border border-ink-800">Lvl {f.level}</span>
                              <span className="text-[9px] text-ink-500 font-mono hidden sm:inline-block">Son: {timeAgo(f.last_seen)}</span>
                            </div>
                          </div>
                        </button>
                        
                        <div className="flex items-center gap-1">
                          <button onClick={() => openProfileModal(f.agent_id, 'chat')} className="p-2 text-ink-400 hover:text-azure-400 bg-ink-900 hover:bg-azure-500/10 rounded-lg transition-colors border border-transparent hover:border-azure-500/30 relative">
                            <MessageSquare size={14} />
                            {unread > 0 && <span className="absolute -top-1.5 -right-1.5 text-[9px] font-black bg-red-500 text-white px-1.5 rounded-full">{unread}</span>}
                          </button>
                          <button onClick={() => { if(window.confirm(`Çıkarmak istiyor musun?`)) handleRemove(f.friendship_id); }} className="text-ink-600 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all" title="Sil"><Trash2 size={14} /></button>
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
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-ink-950 border border-ink-800 rounded-3xl overflow-hidden shadow-2xl relative">
            <button onClick={() => setSelectedLog(null)} className="absolute top-4 right-4 z-20 w-8 h-8 bg-ink-900/80 hover:bg-ink-800 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"><X size={16} /></button>
            
            <div className="flex flex-col sm:flex-row h-full">
              <div className="w-full sm:w-2/5 h-64 sm:h-auto bg-ink-900 relative">
                {selectedLog.item_poster ? (
                  <img src={selectedLog.item_poster} alt="poster" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-700">
                    {selectedLog.item_type === 'series' ? <Tv size={48} /> : <Film size={48} />}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink-950 to-transparent sm:hidden" />
              </div>

              <div className="p-5 sm:p-6 sm:w-3/5 flex flex-col -mt-8 sm:mt-0 relative z-10">
                <div className="mb-4">
                  <button onClick={() => { setSelectedLog(null); openProfileModal(selectedLog.agent_id); }} className="flex items-center gap-1.5 mb-2 hover:opacity-80 transition-opacity text-left">
                    <div className="w-5 h-5 rounded-md bg-ink-800 text-emerald-400 flex items-center justify-center text-[10px] font-black">{profilesMap[selectedLog.agent_id]?.nickname[0]}</div>
                    <span className="text-xs text-ink-400 font-bold">{profilesMap[selectedLog.agent_id]?.nickname} <span className="font-normal opacity-70">inceliyor</span></span>
                  </button>
                  <h2 className="text-xl font-black text-white leading-tight mb-1">{selectedLog.item_title}</h2>
                  <div className="text-[10px] text-ink-500 uppercase tracking-widest font-bold">{selectedLog.item_type === 'series' ? 'Dizi' : 'Film'} • {timeAgo(selectedLog.created_at)}</div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar mb-4">
                  {(selectedLog.rating || (selectedLog.review_tags && selectedLog.review_tags.length > 0)) && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {selectedLog.rating && (
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-gold-500/10 text-gold-400 rounded-lg border border-gold-500/20 font-black text-sm">
                          <Star size={14} className="fill-gold-400" /> {selectedLog.rating}/10
                        </div>
                      )}
                      {selectedLog.review_tags?.map((tag: string) => (
                        <span key={tag} className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${isPositiveTag(tag, data.tagSentiments) ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedLog.note ? (
                    <div className="bg-ink-900/50 p-3 rounded-xl border border-ink-800/50">
                      <div className="text-[9px] font-black uppercase tracking-widest text-ink-500 mb-1.5 flex items-center gap-1"><Info size={10} /> Eleştirmen Notu</div>
                      {(() => {
                        const rawNote = selectedLog.note;
                        const hasSpoiler = selectedLog.is_spoiler || rawNote.toLowerCase().includes('[spoiler]') || rawNote.toLowerCase().includes('#spoiler');
                        const cleanNote = rawNote.replace(/\[spoiler\]/gi, '').replace(/#spoiler/gi, '').trim();
                        const isRevealed = revealedSpoilers[selectedLog.id];

                        if (hasSpoiler && !isRevealed) {
                          return (
                            <div onClick={() => setRevealedSpoilers(prev => ({ ...prev, [selectedLog.id]: true }))} className="cursor-pointer bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex flex-col items-center justify-center gap-1.5 text-red-400 hover:bg-red-500/20 transition-all">
                              <ShieldAlert size={20} className="animate-pulse" />
                              <span className="text-[11px] font-black uppercase tracking-widest">Spoiler İçeriyor</span>
                              <span className="text-[9px] opacity-70">Okumak için tıklayın</span>
                            </div>
                          );
                        }
                        return <p className="text-sm text-ink-200 italic leading-relaxed">"{cleanNote}"</p>;
                      })()}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-600 italic">Kullanıcı yazılı bir değerlendirme bırakmamış.</p>
                  )}
                </div>

                <button 
                  onClick={() => { handleAddToLibrary(selectedLog); setSelectedLog(null); }}
                  className="w-full mt-auto py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 uppercase tracking-wider"
                >
                  <Plus size={18} strokeWidth={3} /> Kütüphaneme Ekle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 2. YENİ LİSTE GÖNDERME MODALI (Filtreli Zengin Grid) */}
      {showSendModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowSendModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl h-[85vh] bg-ink-950 border border-violet-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-ink-800 bg-ink-900/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center border border-violet-500/30"><Send size={15} /></div>
                <h2 className="text-sm font-black text-white">Arkadaşına Tavsiye Gönder</h2>
              </div>
              <button onClick={() => setShowSendModal(false)} className="text-ink-500 hover:text-white p-1 rounded-lg"><X size={17} /></button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              <div className="w-full md:w-64 p-4 border-b md:border-b-0 md:border-r border-ink-800 bg-ink-900/20 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-shrink-0">
                <div>
                  <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-1.5">1. Kime Gidecek?</label>
                  <select 
                    value={sendTargetId} 
                    onChange={(e) => setSendTargetId(e.target.value)}
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl px-3 py-2 text-xs text-white focus:border-violet-500 outline-none"
                  >
                    <option value="">-- Arkadaş Seç --</option>
                    {friends.map(f => (
                      <option key={f.agent_id} value={f.agent_id}>{f.nickname}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-1.5">2. Listenin Adı</label>
                  <input 
                    type="text" 
                    value={sendListTitle}
                    onChange={(e) => setSendListTitle(e.target.value)}
                    placeholder="Örn: Bilim Kurgu Şaheserleri"
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl px-3 py-2 text-xs text-white focus:border-violet-500 outline-none"
                  />
                </div>
                <div className="pt-2 border-t border-ink-800">
                  <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-2">3. Kütüphaneni Filtrele</label>
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                    <input 
                      type="text" 
                      placeholder="İsimle Ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-ink-950 border border-ink-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:border-violet-500 outline-none"
                    />
                  </div>
                  <div className="relative">
                    <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                    <select 
                      value={filterGenre} 
                      onChange={(e) => setFilterGenre(e.target.value)}
                      className="w-full bg-ink-950 border border-ink-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:border-violet-500 outline-none appearance-none"
                    >
                      <option value="">Tüm Türler</option>
                      {data.genres.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden bg-ink-950 relative">
                <div className="p-3 border-b border-ink-800 flex items-center justify-between bg-ink-900/40">
                  <span className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Kütüphanen</span>
                  <span className="text-[10px] text-violet-400 font-bold bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">{selectedItemIds.length} Yapım Seçildi</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
                  {filteredLibraryItems.length === 0 ? (
                    <div className="text-center py-10 text-ink-600 text-xs italic">Sonuç bulunamadı.</div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {filteredLibraryItems.map(item => {
                        const isSelected = selectedItemIds.includes(item.id);
                        return (
                          <div 
                            key={item.id} 
                            onClick={() => setSelectedItemIds(prev => isSelected ? prev.filter(id => id !== item.id) : [...prev, item.id])}
                            className={`relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer group border-2 transition-all ${isSelected ? 'border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.5)] scale-95' : 'border-transparent hover:border-ink-700 bg-ink-900'}`}
                          >
                            {item.posterUrl ? (
                              <img src={item.posterUrl} alt="poster" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-ink-700">
                                {item.type === 'series' ? <Tv size={24} /> : <Film size={24} />}
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 to-transparent p-2 pt-6">
                              <h3 className="text-[9px] font-bold text-white line-clamp-2 leading-tight">{item.title}</h3>
                            </div>
                            <div className={`absolute inset-0 bg-violet-500/20 backdrop-blur-[1px] flex items-center justify-center transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
                              <div className="w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center shadow-lg">
                                <Check size={18} strokeWidth={4} />
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

            <div className="p-4 border-t border-ink-800 bg-ink-950 flex gap-3 flex-shrink-0">
              <button onClick={() => setShowSendModal(false)} className="px-5 py-3 bg-ink-900 text-ink-300 rounded-xl text-xs font-bold hover:bg-ink-800 transition-colors">İptal</button>
              <button onClick={handleSendList} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 uppercase tracking-wider shadow-lg shadow-violet-500/20">
                <Send size={16} /> Listeyi Gönder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. LİSTE İNCELEME MODALI */}
      {viewingList && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setViewingList(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl bg-ink-950 border border-ink-700 rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-ink-800 bg-ink-900/40 relative shrink-0">
              <button onClick={() => setViewingList(null)} className="absolute top-4 right-4 text-ink-500 hover:text-white bg-ink-900 p-1.5 rounded-full transition-colors"><X size={16} /></button>
              <div className="pr-8">
                <div className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Gift size={12}/> Tavsiye Listesi</div>
                <h2 className="text-xl font-black text-white mb-1 leading-tight">{viewingList.list_title}</h2>
                <div className="text-xs text-ink-400">Gönderen: <span className="text-white font-bold">{profilesMap[viewingList.sender_id]?.nickname || 'Bilinmeyen'}</span></div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar bg-ink-950">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {viewingList.items?.map((item: any, idx: number) => {
                  const alreadyHas = data.movies.some(m => m.title.toLowerCase() === item.title.toLowerCase()) || data.series.some(s => s.title.toLowerCase() === item.title.toLowerCase());
                  return (
                    <div key={idx} className="relative aspect-[2/3] rounded-xl overflow-hidden group border border-ink-800 bg-ink-900">
                      {item.poster ? (
                        <img src={item.poster} alt="poster" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink-700">
                          {item.type === 'series' ? <Tv size={24} /> : <Film size={24} />}
                        </div>
                      )}
                      
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent p-2.5 pt-8">
                        <h4 className="text-[10px] font-bold text-white line-clamp-2 leading-tight mb-1">{item.title}</h4>
                        <div className="text-[8px] text-ink-400 uppercase tracking-widest">{item.type === 'series' ? 'Dizi' : 'Film'} {item.year ? `• ${item.year}` : ''}</div>
                      </div>

                      <div className="absolute top-2 right-2">
                        {alreadyHas ? (
                          <div className="bg-emerald-500/90 text-white p-1.5 rounded-lg shadow-md backdrop-blur-sm" title="Zaten Kütüphanende">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleAddToLibrary(item, true)}
                            className="bg-violet-600 hover:bg-violet-500 text-white p-1.5 rounded-lg shadow-lg backdrop-blur-sm transition-all hover:scale-110"
                            title="Kütüphaneme Ekle"
                          >
                            <Plus size={14} strokeWidth={3} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-4 border-t border-ink-800 bg-ink-950 shrink-0">
              <button onClick={() => setViewingList(null)} className="w-full py-3 bg-ink-900 hover:bg-ink-800 text-white rounded-xl text-xs font-bold transition-colors tracking-widest uppercase">
                Pencereyi Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. YENİ: PROFİL İNCELEME (STALK) VE CANLI SOHBET MODALI */}
      {viewingProfileId && (() => {
        const p = profilesMap[viewingProfileId] || { nickname: 'Bilinmeyen Ajan', level: 0, total_xp: 0 };
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setViewingProfileId(null)}>
            <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl bg-ink-950 border border-azure-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh]">
              
              {/* Profil Header */}
              <div className="p-4 sm:p-5 border-b border-ink-800 bg-ink-900/50 flex items-center justify-between relative shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-azure-500/5 blur-[80px] rounded-full pointer-events-none" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-azure-500 to-azure-700 flex items-center justify-center shadow-lg border border-azure-400/30 rotate-3">
                    <span className="text-2xl font-black text-white">{p.nickname[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white leading-tight">{p.nickname}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-azure-400 bg-azure-500/10 px-2 py-0.5 rounded border border-azure-500/20 uppercase tracking-widest">Ajan Lvl {p.level}</span>
                      <span className="text-[10px] text-ink-500 font-mono hidden sm:inline-block">{viewingProfileId}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setViewingProfileId(null)} className="text-ink-400 hover:text-white p-1.5 rounded-full hover:bg-ink-800 relative z-10"><X size={18} /></button>
              </div>

              {/* Sekmeler */}
              <div className="flex border-b border-ink-800 bg-ink-950 shrink-0">
                <button 
                  onClick={() => setProfileTab('stats')}
                  className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${profileTab === 'stats' ? 'border-azure-500 text-azure-400 bg-azure-500/5' : 'border-transparent text-ink-400 hover:text-ink-200 hover:bg-ink-900/50'}`}
                >
                  <BarChart2 size={14} /> Profil & Kıyaslama
                </button>
                <button 
                  onClick={() => setProfileTab('chat')}
                  className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${profileTab === 'chat' ? 'border-azure-500 text-azure-400 bg-azure-500/5' : 'border-transparent text-ink-400 hover:text-ink-200 hover:bg-ink-900/50'}`}
                >
                  <MessageSquare size={14} /> Canlı Sohbet
                </button>
              </div>

              {/* İÇERİK - İSTATİSTİKLER */}
              {profileTab === 'stats' && (
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar space-y-6">
                  {/* Sayısal İstolar */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-ink-900/50 border border-ink-800 p-3 rounded-2xl text-center">
                      <div className="text-xl font-black text-white">{p.movies_watched || 0}</div>
                      <div className="text-[9px] font-bold text-ink-500 uppercase tracking-widest mt-0.5">Film İzledi</div>
                    </div>
                    <div className="bg-ink-900/50 border border-ink-800 p-3 rounded-2xl text-center">
                      <div className="text-xl font-black text-white">{p.episodes_watched || 0}</div>
                      <div className="text-[9px] font-bold text-ink-500 uppercase tracking-widest mt-0.5">Dizi Bölümü</div>
                    </div>
                    <div className="bg-ink-900/50 border border-ink-800 p-3 rounded-2xl text-center">
                      <div className="text-xl font-black text-gold-400">{p.total_xp || 0}</div>
                      <div className="text-[9px] font-bold text-ink-500 uppercase tracking-widest mt-0.5">Toplam XP</div>
                    </div>
                  </div>

                  {/* Son Aktiviteler & Ortak Zevk Kıyaslaması */}
                  <div>
                    <h3 className="text-[10px] font-black text-ink-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Activity size={12} className="text-azure-400" /> Son İzledikleri & Ortak Zevkleriniz
                    </h3>
                    
                    {friendLogs.length === 0 ? (
                      <div className="text-center py-6 border border-ink-800 border-dashed rounded-xl text-xs text-ink-500">
                        Henüz bir aktivitesi yok.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {friendLogs.map(log => {
                          // Benim kütüphanemde bu film var mı ve izlemiş miyim?
                          const myMovieMatch = data.movies.find(m => m.title.toLowerCase() === log.item_title.toLowerCase());
                          const mySeriesMatch = data.series.find(s => s.title.toLowerCase() === log.item_title.toLowerCase());
                          const myMatch = log.item_type === 'movie' ? myMovieMatch : mySeriesMatch;
                          const iWatched = myMovieMatch?.watched || (mySeriesMatch && mySeriesMatch.episodes.some(e => e.watched));
                          
                          // Onun Puanı / Benim Puanım Kıyaslaması
                          const hisRating = log.rating;
                          let myRating = myMovieMatch?.rating;
                          if (log.item_type === 'series' && mySeriesMatch) {
                            const ratedEps = mySeriesMatch.episodes.filter(e => e.rating !== null);
                            if (ratedEps.length > 0) myRating = ratedEps.reduce((a,b) => a + (b.rating||0), 0) / ratedEps.length;
                          }

                          return (
                            <div key={log.id} className="bg-ink-900/30 border border-ink-800 rounded-xl p-3 flex gap-3 items-start group">
                              <div className="w-12 h-16 bg-ink-900 rounded-lg overflow-hidden flex-shrink-0 border border-ink-700">
                                {log.item_poster ? <img src={log.item_poster} className="w-full h-full object-cover" /> : <Film size={16} className="text-ink-600 m-auto mt-5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-white truncate">{log.item_title}</h4>
                                <div className="text-[9px] text-ink-500 mb-1.5">{timeAgo(log.created_at)}</div>
                                
                                {/* Kıyaslama Alanı */}
                                {iWatched ? (
                                  <div className="flex items-center gap-3 bg-ink-950/80 rounded-lg border border-ink-800/80 p-1.5 inline-flex">
                                    <div className="flex flex-col items-center px-2">
                                      <span className="text-[8px] font-bold text-ink-500 uppercase tracking-widest mb-0.5">Puanı</span>
                                      <span className={`text-[10px] font-black ${hisRating ? 'text-azure-400' : 'text-ink-600'}`}>{hisRating || '-'}</span>
                                    </div>
                                    <div className="w-px h-6 bg-ink-800"></div>
                                    <div className="flex flex-col items-center px-2">
                                      <span className="text-[8px] font-bold text-ink-500 uppercase tracking-widest mb-0.5">Senin</span>
                                      <span className={`text-[10px] font-black ${myRating ? 'text-emerald-400' : 'text-ink-600'}`}>{myRating ? (myRating % 1 === 0 ? myRating : myRating.toFixed(1)) : '-'}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[10px] font-bold text-ink-600 bg-ink-950 border border-ink-800/50 px-2 py-1 rounded inline-block">Sen henüz izlemedin</div>
                                )}
                              </div>
                              {!myMatch && (
                                <button onClick={() => handleAddToLibrary(log)} className="mt-2 mr-1 w-8 h-8 rounded-full bg-ink-800 hover:bg-emerald-500/20 text-ink-400 hover:text-emerald-400 flex items-center justify-center transition-colors border border-transparent hover:border-emerald-500/30" title="Kütüphaneme Ekle">
                                  <Plus size={14} />
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

              {/* İÇERİK - CANLI SOHBET */}
              {profileTab === 'chat' && (
                <div className="flex flex-col flex-1 overflow-hidden bg-ink-950 relative">
                  {/* Mesaj Listesi */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" ref={chatScrollRef}>
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-ink-500 opacity-60">
                        <MessageSquare size={32} className="mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">Sohbeti Başlat</p>
                      </div>
                    ) : (
                      chatMessages.map(msg => {
                        const isMe = msg.sender_id === data.agentId;
                        return (
                          <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end ml-auto' : 'self-start items-start'}`}>
                            <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-azure-600 text-white rounded-tr-sm shadow-md' : 'bg-ink-800 text-ink-100 rounded-tl-sm border border-ink-700/50 shadow-sm'}`}>
                              {msg.content}
                            </div>
                            <span className="text-[8px] text-ink-600 font-bold mt-1 px-1">{new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  
                  {/* Mesaj Yazma Alanı */}
                  <div className="p-3 bg-ink-900 border-t border-ink-800 shrink-0">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Bir mesaj yaz..."
                        className="flex-1 bg-ink-950 border border-ink-700 rounded-full px-4 py-2.5 text-sm text-white focus:border-azure-500 outline-none"
                      />
                      <button 
                        onClick={handleSendMessage}
                        disabled={!chatInput.trim()}
                        className="w-11 h-11 rounded-full bg-azure-600 hover:bg-azure-500 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-colors shadow-lg shadow-azure-500/20"
                      >
                        <Send size={16} className="ml-1" />
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