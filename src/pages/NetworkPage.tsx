import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Users, UserPlus, Trophy, Activity, Check, X, Clock, Star, Plus, Copy, RefreshCw, Trash2, Medal, Film, Tv, ShieldAlert, Zap, Sparkles, Inbox, Send, Gift, ListVideo, Search, Filter, Eye, Info, MessageSquare, BarChart2, CheckSquare, MessageCircle, UserCheck, CheckCircle2 } from 'lucide-react';
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
  const profilesMapRef = useRef<Record<string, any>>({});
  
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

  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendTargetId, setSendTargetId] = useState('');
  const [sendListTitle, setSendListTitle] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [viewingList, setViewingList] = useState<any>(null);

  const [listToDelete, setListToDelete] = useState<string | null>(null);
  const [friendToRemove, setFriendToRemove] = useState<string | null>(null);

  const [isChatHubOpen, setIsChatHubOpen] = useState(false);
  const [hubTab, setHubTab] = useState<'direct' | 'group'>('direct');
  const [hubActiveChat, setHubActiveChat] = useState<{ id: string, type: 'direct' | 'group', name?: string, members?: any[] } | null>(null);
  const [hubInboxDirect, setHubInboxDirect] = useState<any[]>([]);
  const [hubInboxGroup, setHubInboxGroup] = useState<any[]>([]);
  const [hubMessages, setHubMessages] = useState<any[]>([]);
  const [hubInput, setHubInput] = useState('');
  
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const hubScrollRef = useRef<HTMLDivElement>(null);
  const viewingProfileIdRef = useRef<string | null>(null);
  const hubActiveChatRef = useRef<{ id: string, type: 'direct' | 'group', name?: string, members?: any[] } | null>(null);
  
  const [hubCreateMode, setHubCreateMode] = useState<'direct' | 'group' | null>(null);
  const [newDirectCode, setNewDirectCode] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);

  const [syncTick, setSyncTick] = useState(0);

  useEffect(() => { profilesMapRef.current = profilesMap; }, [profilesMap]);
  useEffect(() => { viewingProfileIdRef.current = viewingProfileId; }, [viewingProfileId]);
  useEffect(() => { hubActiveChatRef.current = hubActiveChat; }, [hubActiveChat]);

  const openProfileModal = async (targetId: string, initialTab: ProfileTabType = 'stats') => {
    if (targetId === data.agentId) return; 
    setViewingProfileId(targetId);
    setProfileTab(initialTab);
    const { data: logsData } = await supabase.from('network_logs').select('*').eq('agent_id', targetId).order('created_at', { ascending: false }).limit(30);
    setFriendLogs(logsData || []);
    
    if (initialTab === 'chat') {
      const { data: msgs } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${data.agentId},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${data.agentId})`).order('created_at', { ascending: true });
      setChatMessages(msgs || []);
    }
  };

  const loadHubInbox = useCallback(async () => {
    if (!data.agentId) return;
    try {
      // 1. DİREKT MESAJLARI GÜVENLİ ÇEKME (group_id KONTROLÜ OLMADAN)
      const { data: directMsgs } = await supabase.from('messages').select('*').or(`sender_id.eq.${data.agentId},receiver_id.eq.${data.agentId}`).order('created_at', { ascending: false });
      const dMap = new Map();
      if (directMsgs) {
        directMsgs.forEach((msg: any) => {
          if (!msg.receiver_id || msg.group_id) return; // Sadece birebirleri filtrele
          
          const otherId = msg.sender_id === data.agentId ? msg.receiver_id : msg.sender_id;
          if (!otherId) return;
          if (!dMap.has(otherId)) {
            dMap.set(otherId, {
              id: otherId, type: 'direct',
              lastMessage: msg.content, created_at: msg.created_at,
              unread: msg.receiver_id === data.agentId && !msg.is_read ? 1 : 0
            });
          } else if (msg.receiver_id === data.agentId && !msg.is_read) {
            dMap.get(otherId).unread += 1;
          }
        });
      }
      
      setHubInboxDirect(Array.from(dMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

      // 2. GRUPLARI ÇEKME (Hata korumalı)
      try {
        const { data: memberOf } = await supabase.from('chat_group_members').select('group_id').eq('agent_id', data.agentId);
        const gMap = new Map();
        if (memberOf && memberOf.length > 0) {
          const gIds = memberOf.map((m: any) => m.group_id);
          const { data: groupsData } = await supabase.from('chat_groups').select('*').in('id', gIds);
          
          if (groupsData) {
            const { data: gMsgs } = await supabase.from('messages').select('*').in('group_id', gIds).order('created_at', { ascending: false });
            groupsData.forEach((g: any) => {
              const lastMsg = gMsgs?.find((m: any) => m.group_id === g.id);
              gMap.set(g.id, {
                id: g.id, type: 'group', name: g.name,
                lastMessage: lastMsg ? `${lastMsg.sender_id === data.agentId ? 'Sen' : 'Biri'}: ${lastMsg.content}` : 'Grup oluşturuldu',
                created_at: lastMsg ? lastMsg.created_at : g.created_at,
                unread: 0 
              });
            });
          }
        }
        setHubInboxGroup(Array.from(gMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      } catch (groupErr) {
        // Tablo yoksa sessizce geç, direkt mesajlar çalışmaya devam etsin.
      }

      // Profilleri tamamla
      const unknownIds = Array.from(dMap.values()).filter(i => !profilesMapRef.current[i.id]).map(i => i.id);
      if (unknownIds.length > 0) {
        const { data: newProfs } = await supabase.from('profiles').select('*').in('agent_id', unknownIds);
        if (newProfs) {
          setProfilesMap(prev => {
            const updated = { ...prev };
            newProfs.forEach((p: any) => updated[p.agent_id] = p);
            return updated;
          });
        }
      }
    } catch (err) { console.error("Inbox yüklenirken hata:", err); }
  }, [data.agentId]);

  const loadHubMessages = useCallback(async () => {
    if (!hubActiveChat || !data.agentId) return;
    try {
      if (hubActiveChat.type === 'direct') {
        const { data: msgs } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${data.agentId},receiver_id.eq.${hubActiveChat.id}),and(sender_id.eq.${hubActiveChat.id},receiver_id.eq.${data.agentId})`).order('created_at', { ascending: true });
        
        setHubMessages((prev: any[]) => {
          const newMsgs = msgs || [];
          const fetchedIds = new Set(newMsgs.map((m: any) => m.id));
          const localOnly = prev.filter((m: any) => !fetchedIds.has(m.id) && m.sender_id === data.agentId);
          return [...newMsgs, ...localOnly].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
        
        await supabase.from('messages').update({ is_read: true }).eq('receiver_id', data.agentId).eq('sender_id', hubActiveChat.id).eq('is_read', false);
      } else {
        const { data: msgs } = await supabase.from('messages').select('*').eq('group_id', hubActiveChat.id).order('created_at', { ascending: true });
        
        setHubMessages((prev: any[]) => {
          const newMsgs = msgs || [];
          const fetchedIds = new Set(newMsgs.map((m: any) => m.id));
          const localOnly = prev.filter((m: any) => !fetchedIds.has(m.id) && m.sender_id === data.agentId);
          return [...newMsgs, ...localOnly].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
        
        try {
          const { data: members } = await supabase.from('chat_group_members').select('agent_id').eq('group_id', hubActiveChat.id);
          if (members) {
            const mIds = members.map((m: any) => m.agent_id).filter((id: string) => id !== data.agentId);
            if (JSON.stringify(hubActiveChat.members) !== JSON.stringify(mIds)) {
              setHubActiveChat(prev => prev ? { ...prev, members: mIds } : null);
            }
            const unknownIds = mIds.filter((id: string) => !profilesMapRef.current[id]);
            if (unknownIds.length > 0) {
              const { data: newProfs } = await supabase.from('profiles').select('*').in('agent_id', unknownIds);
              if (newProfs) {
                setProfilesMap(prev => {
                  const updated = { ...prev };
                  newProfs.forEach((p: any) => updated[p.agent_id] = p);
                  return updated;
                });
              }
            }
          }
        } catch(e) {}
      }
    } catch (err) { console.error("Mesajlar çekilirken hata:", err); }
  }, [hubActiveChat?.id, hubActiveChat?.type, data.agentId]);

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

      const allRelevantIds = Array.from(new Set([...Array.from(acceptedIds), ...incoming.map(i => i.requester_id), ...outgoing.map(o => o.receiver_id)]));
      
      const { data: recData } = await supabase.from('recommendations').select('*').or(`receiver_id.eq.${data.agentId},sender_id.eq.${data.agentId}`).order('created_at', { ascending: false });
      const recList = recData || [];
      recList.forEach((r: any) => {
        if (!allRelevantIds.includes(r.sender_id)) allRelevantIds.push(r.sender_id);
        if (!allRelevantIds.includes(r.receiver_id)) allRelevantIds.push(r.receiver_id);
      });
      setRecommendations(recList);

      const { data: unreadData } = await supabase.from('messages').select('sender_id').eq('receiver_id', data.agentId).eq('is_read', false);
      const unreads: Record<string, number> = {};
      (unreadData || []).forEach((msg: any) => { unreads[msg.sender_id] = (unreads[msg.sender_id] || 0) + 1; });
      setUnreadMessages(unreads);

      let pMap = { ...profilesMapRef.current };
      const missingIds = allRelevantIds.filter(id => !pMap[id]);
      
      if (missingIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('*').in('agent_id', missingIds);
        (profilesData || []).forEach((p: any) => { pMap[p.agent_id] = p; });
        setProfilesMap(pMap);
      }

      const acceptedFriends = Array.from(acceptedIds).map(id => {
        const profile = pMap[id] || { nickname: 'Ajan Aranıyor...', agent_id: id };
        const friendship = fList.find((f: any) => f.status === 'accepted' && (f.requester_id === id || f.receiver_id === id));
        return { ...profile, friendship_id: friendship?.id };
      }).filter(f => f.friendship_id);

      setFriends(acceptedFriends); setPendingIncoming(incoming); setPendingOutgoing(outgoing);

      if (acceptedIds.size > 0) {
        const { data: logsData } = await supabase.from('network_logs').select('*').in('agent_id', Array.from(acceptedIds)).order('created_at', { ascending: false }).limit(50);
        setFeed(logsData || []);
      } else { setFeed([]); }

      const { data: leadersData } = await supabase.from('profiles').select('*').order('total_xp', { ascending: false }).limit(100);
      setLeaderboard(leadersData || []);

    } catch (error: any) { console.error('Ağ hatası:', error); } 
    finally { if (!isSilent) setLoading(false); setRefreshing(false); }
  }, [data.agentId]);

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

          const hChat = hubActiveChatRef.current;
          if (hChat) {
              if (hChat.type === 'direct' && !newMsg.group_id) {
                  if ((newMsg.sender_id === data.agentId && newMsg.receiver_id === hChat.id) || 
                      (newMsg.sender_id === hChat.id && newMsg.receiver_id === data.agentId)) {
                      setHubMessages((prev: any[]) => prev.some((m: any) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
                  }
              } else if (hChat.type === 'group' && newMsg.group_id === hChat.id) {
                  setHubMessages((prev: any[]) => prev.some((m: any) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
              }
          }
          
          setSyncTick(t => t + 1);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_group_members' }, () => setSyncTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'network_logs' }, () => setSyncTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recommendations' }, () => setSyncTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => setSyncTick(t => t + 1))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [data.agentId, fetchData]);

  useEffect(() => {
    if (syncTick > 0) {
      fetchData(true);
      if (isChatHubOpen) loadHubInbox();
    }
  }, [syncTick, fetchData, loadHubInbox, isChatHubOpen]);

  useEffect(() => {
    if (isChatHubOpen) {
      loadHubInbox();
    }
  }, [isChatHubOpen, loadHubInbox]);

  useEffect(() => {
    if (isChatHubOpen && hubActiveChat?.id) {
      loadHubMessages();
    }
  }, [hubActiveChat?.id, loadHubMessages, isChatHubOpen]);

  useEffect(() => {
    if (hubScrollRef.current) { hubScrollRef.current.scrollTop = hubScrollRef.current.scrollHeight; }
  }, [hubMessages]);

  useEffect(() => {
    if (chatScrollRef.current) { chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }
  }, [chatMessages]);

  const handleProfileSendMessage = async () => {
    if (!chatInput.trim() || !viewingProfileId) return;
    const content = chatInput.trim();
    setChatInput('');
    try {
      const newMsg = { id: uid(), sender_id: data.agentId, receiver_id: viewingProfileId, content, created_at: new Date().toISOString(), is_read: false };
      setChatMessages((prev: any[]) => [...prev, newMsg]);
      await supabase.from('messages').insert([newMsg]);
    } catch (err) { showToast('Mesaj gönderilemedi', 'error'); }
  };

  const handleHubSendMessage = async () => {
    if (!hubInput.trim() || !hubActiveChat) return;
    const content = hubInput.trim();
    setHubInput('');
    
    try {
      if (hubActiveChat.type === 'direct') {
        const newMsg = { id: uid(), sender_id: data.agentId, receiver_id: hubActiveChat.id, content, created_at: new Date().toISOString(), is_read: false };
        setHubMessages((prev: any[]) => [...prev, newMsg]);
        await supabase.from('messages').insert([newMsg]);
      } else {
        const newMsg = { id: uid(), group_id: hubActiveChat.id, sender_id: data.agentId, receiver_id: null, content, created_at: new Date().toISOString(), is_read: true };
        setHubMessages((prev: any[]) => [...prev, newMsg]);
        await supabase.from('messages').insert([newMsg]);
      }
    } catch (err) { showToast('Mesaj gönderilemedi', 'error'); }
  };

  const handleStartNewDirectChat = async () => {
    const code = newDirectCode.trim().toUpperCase();
    if (!code) return;
    if (code === data.agentId) { showToast('Kendinle konuşamazsın!', 'warning'); return; }
    
    try {
      const { data: targetProfile } = await supabase.from('profiles').select('*').eq('agent_id', code).maybeSingle();
      if (!targetProfile) { showToast('Kullanıcı bulunamadı!', 'error'); return; }
      
      setProfilesMap(prev => ({ ...prev, [code]: targetProfile }));
      setHubCreateMode(null);
      setNewDirectCode('');
      setHubTab('direct');
      setHubActiveChat({ id: code, type: 'direct' });
    } catch (err) { showToast('Hata oluştu', 'error'); }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) { showToast('Gruba bir isim ver!', 'warning'); return; }
    if (newGroupMembers.length === 0) { showToast('En az bir kişi seç!', 'warning'); return; }

    try {
      const groupId = `GRP-${uid().slice(0,8)}`;
      await supabase.from('chat_groups').insert([{ id: groupId, name: newGroupName.trim(), created_by: data.agentId }]);
      
      const members = [...newGroupMembers, data.agentId].map(id => ({ group_id: groupId, agent_id: id }));
      await supabase.from('chat_group_members').insert(members);

      const newG = { id: groupId, type: 'group', name: newGroupName.trim(), lastMessage: 'Grup oluşturuldu', created_at: new Date().toISOString(), unread: 0 };
      setHubInboxGroup((prev: any[]) => [newG, ...prev]);

      showToast('Grup kuruldu!', 'success');
      setHubCreateMode(null);
      setNewGroupName('');
      setNewGroupMembers([]);
      setHubTab('group');
      setHubActiveChat({ id: groupId, type: 'group', name: newGroupName.trim(), members: newGroupMembers });
      setSyncTick(t => t + 1);
    } catch (err) {
      showToast('Sistem hatası!', 'error');
    }
  };

  const handleSendRequest = async () => {
    const code = friendCode.trim().toUpperCase();
    if (!code) return;
    if (code === data.agentId) { showToast('Kendini ekleyemezsin!', 'warning'); return; }
    if (friends.some(f => f.agent_id === code) || pendingOutgoing.some(p => p.receiver_id === code) || pendingIncoming.some(p => p.requester_id === code)) { showToast('Zaten bir bağınız var.', 'warning'); return; }

    try {
      const { data: targetProfile } = await supabase.from('profiles').select('agent_id').eq('agent_id', code).maybeSingle();
      if (!targetProfile) { showToast('Bu kimlik koduna sahip bir kullanıcı bulunamadı!', 'error'); return; }
      await supabase.from('friendships').insert([{ id: uid(), requester_id: data.agentId, receiver_id: code, status: 'pending' }]);
      showToast('Arkadaşlık isteği gönderildi!', 'success'); setFriendCode(''); setSyncTick(t => t + 1);
    } catch (err) { showToast('İstek gönderilirken hata oluştu.', 'error'); }
  };

  const handleAccept = async (friendshipId: string) => {
    try { await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId); showToast('Kabul edildi!', 'success'); setSyncTick(t => t + 1); } 
    catch (err) { showToast('Hata oluştu.', 'error'); }
  };

  const handleRemove = async (friendshipId: string, isReject = false) => {
    try { await supabase.from('friendships').delete().eq('id', friendshipId); showToast(isReject ? 'İstek reddedildi.' : 'Arkadaşlıktan çıkarıldı.', 'info'); setSyncTick(t => t + 1); } 
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
      showToast('Liste gönderildi!', 'success'); setShowSendModal(false); setSendListTitle(''); setSelectedItemIds([]); setSendTargetId(''); setSyncTick(t => t + 1);
    } catch (err) { showToast('Hata oluştu!', 'error'); }
  };

  const handleViewList = async (list: any) => {
    setViewingList(list);
    if (list.status === 'pending' && list.receiver_id === data.agentId) {
      await supabase.from('recommendations').update({ status: 'viewed' }).eq('id', list.id);
      setSyncTick(t => t + 1);
    }
  };

  const executeDeleteList = async () => {
    if (!listToDelete) return;
    try {
      await supabase.from('recommendations').delete().eq('id', listToDelete);
      if (viewingList?.id === listToDelete) setViewingList(null);
      showToast('Liste başarıyla silindi!', 'success');
      setSyncTick(t => t + 1);
    } catch (err) { showToast('Liste silinirken hata oluştu.', 'error'); }
    setListToDelete(null);
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
        
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <button onClick={() => { navigator.clipboard.writeText(data.agentId || ''); showToast('Kod kopyalandı!', 'success'); }} className="flex-1 sm:flex-none flex items-center gap-3 bg-ink-900/50 hover:bg-ink-800 border border-ink-800 hover:border-emerald-500/40 px-4 py-3 rounded-xl transition-all group justify-center">
            <span className="text-xs text-ink-500 font-bold uppercase tracking-wider hidden sm:inline">Ağ Kodun:</span>
            <span className="font-mono text-emerald-400 text-sm sm:text-lg font-black tracking-widest">{data.agentId}</span>
            <Copy size={16} className="text-ink-500 group-hover:text-emerald-400 transition-colors" />
          </button>
          <button onClick={() => setIsChatHubOpen(true)} className="flex-1 sm:flex-none w-full sm:w-auto flex items-center justify-center gap-2 bg-azure-600/20 hover:bg-azure-600/30 border border-azure-500/30 text-azure-400 px-6 py-3 rounded-xl transition-all shadow-sm">
            <MessageCircle size={18} />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Mesaj Merkezi</span>
            {totalUnread > 0 && <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full ml-1">{totalUnread}</span>}
          </button>
        </div>
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
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => handleViewList(list)} className="bg-ink-900 hover:bg-violet-500/20 text-violet-400 border border-ink-800 hover:border-violet-500/50 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm">
                            İncele
                          </button>
                          <button onClick={() => setListToDelete(list.id)} className="p-2.5 bg-ink-900 hover:bg-red-500/20 text-red-400/70 hover:text-red-400 border border-ink-800 hover:border-red-500/50 rounded-xl transition-all shadow-sm" title="Listeyi Sil">
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
                        <button onClick={() => setListToDelete(list.id)} className="p-2.5 bg-ink-900/50 hover:bg-red-500/20 text-red-400/70 hover:text-red-400 border border-transparent hover:border-red-500/30 rounded-xl transition-all" title="Listeyi Sil">
                          <Trash2 size={16} />
                        </button>
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
                          <button onClick={() => { setIsChatHubOpen(true); setHubTab('direct'); setHubActiveChat({ id: f.agent_id, type: 'direct' }); }} className="p-3 text-ink-400 hover:text-azure-400 bg-ink-900 hover:bg-azure-500/10 rounded-xl transition-colors border border-transparent hover:border-azure-500/30 relative">
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
      {/* MODALS */}
      {/* ============================== */}

      {/* MESAJLAŞMA MERKEZİ (CHAT HUB) MODALI */}
      {isChatHubOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-fade-in" onClick={() => setIsChatHubOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-5xl h-[85vh] bg-ink-950 border border-azure-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative">
            <button onClick={() => setIsChatHubOpen(false)} className="absolute top-4 right-4 z-20 text-ink-400 hover:text-white p-2 rounded-full hover:bg-ink-800 transition-colors"><X size={18} /></button>
            
            {/* SOL PANEL: Gelen Kutusu ve Sekmeler */}
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-ink-800 bg-ink-900/30 flex flex-col shrink-0">
              <div className="p-4 border-b border-ink-800">
                <h2 className="text-lg font-black text-white flex items-center gap-2 mb-4"><MessageCircle className="text-azure-400" /> Mesajlar</h2>
                
                <div className="flex gap-1 bg-ink-900/50 p-1 rounded-xl mb-4">
                  <button onClick={() => setHubTab('direct')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${hubTab === 'direct' ? 'bg-ink-800 text-white shadow' : 'text-ink-500 hover:text-ink-300'}`}>Birebir</button>
                  <button onClick={() => setHubTab('group')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${hubTab === 'group' ? 'bg-indigo-600/30 text-indigo-300 shadow' : 'text-ink-500 hover:text-ink-300'}`}>Gruplar</button>
                </div>

                {hubTab === 'direct' ? (
                  <button onClick={() => setHubCreateMode('direct')} className="w-full bg-ink-900 hover:bg-ink-800 border border-ink-700 text-ink-100 text-xs font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"><UserPlus size={14}/> Yeni Sohbet</button>
                ) : (
                  <button onClick={() => setHubCreateMode('group')} className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 text-xs font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"><Users size={14}/> Yeni Grup Kur</button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {hubTab === 'direct' ? (
                  hubInboxDirect.length === 0 ? (
                    <div className="text-center text-xs text-ink-500 py-10 italic">Birebir sohbetin yok.</div>
                  ) : (
                    hubInboxDirect.map(chat => {
                      const prof = profilesMap[chat.id];
                      const isActive = hubActiveChat?.id === chat.id;
                      return (
                        <button 
                          key={chat.id} 
                          onClick={() => { setHubActiveChat({ id: chat.id, type: 'direct' }); setHubCreateMode(null); }}
                          className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-all ${isActive ? 'bg-azure-500/10 border border-azure-500/30' : 'bg-transparent hover:bg-ink-900/50 border border-transparent'}`}
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-lg bg-ink-800 text-ink-300">
                            {prof?.nickname[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm font-bold truncate pr-2 ${isActive ? 'text-azure-400' : 'text-white'}`}>{prof?.nickname || 'Bilinmeyen'}</span>
                              <span className="text-[9px] text-ink-500">{timeAgo(chat.created_at)}</span>
                            </div>
                            <div className="text-[11px] text-ink-400 truncate pr-4">{chat.lastMessage}</div>
                          </div>
                          {chat.unread > 0 && <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[9px] font-black text-white shrink-0">{chat.unread}</div>}
                        </button>
                      )
                    })
                  )
                ) : (
                  hubInboxGroup.length === 0 ? (
                    <div className="text-center text-xs text-ink-500 py-10 italic">Henüz bir gruba dahil değilsin.</div>
                  ) : (
                    hubInboxGroup.map(chat => {
                      const isActive = hubActiveChat?.id === chat.id;
                      return (
                        <button 
                          key={chat.id} 
                          onClick={() => { setHubActiveChat({ id: chat.id, type: 'group', name: chat.name }); setHubCreateMode(null); }}
                          className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-all ${isActive ? 'bg-indigo-500/10 border border-indigo-500/30' : 'bg-transparent hover:bg-ink-900/50 border border-transparent'}`}
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            <Users size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm font-bold truncate pr-2 ${isActive ? 'text-indigo-400' : 'text-white'}`}>{chat.name}</span>
                              <span className="text-[9px] text-ink-500">{timeAgo(chat.created_at)}</span>
                            </div>
                            <div className="text-[11px] text-ink-400 truncate pr-4">{chat.lastMessage}</div>
                          </div>
                        </button>
                      )
                    })
                  )
                )}
              </div>
            </div>

            {/* SAĞ PANEL: Sohbet veya Yeni Oluşturma Ekranı */}
            <div className="flex-1 flex flex-col bg-ink-950 relative overflow-hidden">
              {hubCreateMode === 'direct' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                  <div className="w-16 h-16 bg-azure-500/10 rounded-full flex items-center justify-center border border-azure-500/30 mb-4"><UserPlus size={24} className="text-azure-400" /></div>
                  <h3 className="text-xl font-black text-white mb-2">Yeni Birebir Sohbet</h3>
                  <p className="text-sm text-ink-400 mb-6 max-w-sm">Arkadaşının 12 haneli ajan kodunu girerek hemen özel bir konuşma başlat.</p>
                  <input type="text" placeholder="SNV-XXXX-XXXX" value={newDirectCode} onChange={e => setNewDirectCode(e.target.value)} className="w-full max-w-xs bg-ink-900 border border-ink-800 text-center rounded-xl px-4 py-3 text-white font-mono uppercase tracking-widest focus:border-azure-500 outline-none mb-4" />
                  <button onClick={handleStartNewDirectChat} disabled={!newDirectCode.trim()} className="w-full max-w-xs bg-azure-600 hover:bg-azure-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors">Sohbete Başla</button>
                </div>
              ) : hubCreateMode === 'group' ? (
                <div className="flex-1 flex flex-col p-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-ink-800">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/30"><Users size={20} className="text-indigo-400" /></div>
                    <div>
                      <h3 className="text-lg font-black text-white">Yeni Grup Kur</h3>
                      <p className="text-[11px] text-ink-400">Sinevia Ağı üzerinde kendi özel topluluğunu oluştur.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-5 overflow-y-auto custom-scrollbar pr-2 pb-20">
                    <div>
                      <label className="block text-[11px] font-bold text-ink-500 uppercase tracking-widest mb-2">Grup Adı</label>
                      <input type="text" placeholder="Örn: Hafta Sonu Maratoncuları" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="w-full bg-ink-900 border border-ink-800 rounded-xl px-4 py-3 text-white text-sm focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-ink-500 uppercase tracking-widest mb-3">Üyeleri Seç ({friends.length} Arkadaş)</label>
                      {friends.length === 0 ? (
                        <div className="text-xs text-ink-500 italic p-4 bg-ink-900/50 rounded-xl border border-ink-800">Henüz ağında kimse yok.</div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {friends.map(f => {
                            const isSelected = newGroupMembers.includes(f.agent_id);
                            return (
                              <div key={f.agent_id} onClick={() => setNewGroupMembers(prev => isSelected ? prev.filter(id => id !== f.agent_id) : [...prev, f.agent_id])} className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-colors ${isSelected ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-ink-900/40 border-ink-800 hover:border-ink-700'}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${isSelected ? 'bg-indigo-500 text-white' : 'bg-ink-800 text-ink-300'}`}>{f.nickname[0]}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold text-white truncate">{f.nickname}</div>
                                  <div className="text-[9px] text-ink-500 font-mono">{f.agent_id}</div>
                                </div>
                                {isSelected && <Check size={16} className="text-indigo-400" />}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full p-5 bg-ink-950 border-t border-ink-800">
                    <button onClick={handleCreateGroup} disabled={!newGroupName.trim() || newGroupMembers.length === 0} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                      <Users size={18} /> Grubu Oluştur ({newGroupMembers.length + 1} Kişi)
                    </button>
                  </div>
                </div>
              ) : !hubActiveChat ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center opacity-60">
                  <MessageCircle size={48} className="text-ink-700 mb-4" />
                  <h3 className="text-lg font-black text-ink-400 mb-1">Mesajlaşma Merkezi</h3>
                  <p className="text-sm text-ink-600">Yandan bir sohbet seçin veya yeni bir konuşma başlatın.</p>
                  
                  <div className="bg-ink-900/50 border border-ink-800 p-4 rounded-2xl mt-6 text-left max-w-sm">
                    <div className="flex items-center gap-2 text-amber-400 text-[10px] font-black uppercase tracking-widest mb-2"><Info size={14}/> Geçmiş Mesajlar Görünmüyor Mu?</div>
                    <p className="text-xs text-ink-400 leading-relaxed">Farklı bir tarayıcıdan (örneğin Opera) girdiğinizde mesajlarınızı görmek için "Hesabım" kısmından Ağ Kodunuzu içeri aktarmalısınız.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="h-16 border-b border-ink-800 bg-ink-900/40 flex items-center px-5 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${hubActiveChat.type === 'group' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-ink-800 text-emerald-400'}`}>
                        {hubActiveChat.type === 'group' ? <Users size={16} /> : (profilesMap[hubActiveChat.id]?.nickname[0] || '?')}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">{hubActiveChat.type === 'group' ? hubActiveChat.name : (profilesMap[hubActiveChat.id]?.nickname || 'Ajan')}</h3>
                        {hubActiveChat.type === 'group' ? (
                          <div className="text-[10px] text-ink-400 font-medium truncate max-w-[250px]">Siz, {hubActiveChat.members?.map(id => profilesMap[id]?.nickname.split(' ')[0] || 'Ajan').join(', ')}</div>
                        ) : (
                          <div className="text-[10px] text-ink-500 font-mono flex items-center gap-1"><CheckCircle2 size={10}/> Aktif Bağlantı</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar" ref={hubScrollRef}>
                    {hubMessages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs font-bold text-ink-600 uppercase tracking-widest">İlk mesajı sen gönder</div>
                    ) : (
                      <div className="space-y-4">
                        {hubMessages.map(msg => {
                          const isMe = msg.sender_id === data.agentId;
                          const showName = hubActiveChat.type === 'group' && !isMe;
                          return (
                            <div key={msg.id} className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${isMe ? 'self-end items-end ml-auto' : 'self-start items-start'}`}>
                              {showName && <span className="text-[10px] font-bold text-ink-500 mb-1 ml-1">{profilesMap[msg.sender_id]?.nickname || 'Ajan'}</span>}
                              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${isMe ? 'bg-azure-600 text-white rounded-tr-sm' : 'bg-ink-800 text-ink-100 rounded-tl-sm border border-ink-700/50'}`}>
                                {msg.content}
                              </div>
                              <span className="text-[9px] text-ink-600 font-medium mt-1.5 px-1">{new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-ink-900 border-t border-ink-800 shrink-0">
                    <div className="flex gap-3 relative">
                      <input 
                        type="text" 
                        value={hubInput}
                        onChange={(e) => setHubInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleHubSendMessage()}
                        placeholder={hubActiveChat.type === 'group' ? "Gruba yaz..." : "Mesaj gönder..."}
                        className="flex-1 bg-ink-950 border border-ink-700 rounded-2xl px-5 py-3.5 text-sm text-white focus:border-azure-500 outline-none pr-12"
                      />
                      <button 
                        onClick={handleHubSendMessage}
                        disabled={!hubInput.trim()}
                        className="absolute right-2 top-2 bottom-2 w-10 bg-azure-600 hover:bg-azure-500 rounded-xl flex items-center justify-center text-white disabled:opacity-50 transition-colors"
                      >
                        <Send size={16} className="ml-0.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UYGULAMA İÇİ ONAY MODALLARI */}
      
      {/* 1. Liste Silme Onayı */}
      {listToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setListToDelete(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-ink-950 border border-ink-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-black text-white mb-2">Listeyi Sil</h3>
            <p className="text-sm text-ink-300 mb-6">Bu listeyi kalıcı olarak silmek istediğine emin misin? Bu işlem geri alınamaz.</p>
            <div className="flex gap-3">
              <button onClick={() => setListToDelete(null)} className="flex-1 py-3 rounded-xl bg-ink-900 hover:bg-ink-800 text-white font-bold transition-colors">İptal</button>
              <button onClick={executeDeleteList} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-lg shadow-red-500/20">Evet, Sil</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Arkadaş Silme Onayı */}
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

      {/* 4. PROFİL İNCELEME (STALK) MODALI */}
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
                  onClick={() => { setViewingProfileId(null); setIsChatHubOpen(true); setHubTab('direct'); setHubActiveChat({ id: viewingProfileId, type: 'direct' }); }}
                  className="flex-1 py-3.5 text-xs sm:text-sm font-bold transition-colors border-b-2 border-transparent text-ink-400 hover:text-ink-200 hover:bg-ink-900/50 flex items-center justify-center gap-2"
                >
                  <MessageSquare size={16} /> Birebir Mesaj Gönder
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
                        onKeyDown={(e) => e.key === 'Enter' && handleProfileSendMessage()}
                        placeholder="Bir mesaj yaz..."
                        className="flex-1 bg-ink-950 border border-ink-700 rounded-full px-5 py-3 text-sm text-white focus:border-azure-500 outline-none"
                      />
                      <button 
                        onClick={handleProfileSendMessage}
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