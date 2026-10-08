import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Users, UserPlus, Check, X, Star, Plus, Trash2, Film, Tv, Send,
  Search, BarChart2, MessageCircle, CheckCircle2, LogOut, Settings,
  UserMinus, Crown, Lock, Unlock, Edit2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uid } from '../lib/utils';

// ÖZEL MESAJ VE ANKET KONTROL ÖNEKLERİ
export const MEDIA_PREFIX = '__SNV_MEDIA__:';
export const POLL_PREFIX = '__SNV_POLL__:';
export const VOTE_PREFIX = '__SNV_VOTE__:';
export const POLL_CTL_PREFIX = '__SNV_POLL_CTL__:';

export function parseSpecialContent(content: string) {
  if (!content) return { kind: 'text' as const, text: '' };
  if (content.startsWith(MEDIA_PREFIX)) {
    try { return { kind: 'media' as const, data: JSON.parse(content.slice(MEDIA_PREFIX.length)) }; } catch {}
  }
  if (content.startsWith(POLL_PREFIX)) {
    try { return { kind: 'poll' as const, data: JSON.parse(content.slice(POLL_PREFIX.length)) }; } catch {}
  }
  if (content.startsWith(VOTE_PREFIX)) {
    try { return { kind: 'vote' as const, data: JSON.parse(content.slice(VOTE_PREFIX.length)) }; } catch {}
  }
  if (content.startsWith(POLL_CTL_PREFIX)) {
    try { return { kind: 'poll_ctl' as const, data: JSON.parse(content.slice(POLL_CTL_PREFIX.length)) }; } catch {}
  }
  return { kind: 'text' as const, text: content };
}

export function formatInboxPreview(content: string) {
  const parsed = parseSpecialContent(content);
  if (parsed.kind === 'media') return `🎬 ${parsed.data?.title || 'Yapım Paylaşıldı'}`;
  if (parsed.kind === 'poll') return `📊 Anket: ${parsed.data?.question || 'Film Oylaması'}`;
  if (parsed.kind === 'vote' || parsed.kind === 'poll_ctl') return '';
  return content;
}

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

// HEM CHAT HUB HEM PROFİL SOHBETİ İÇİN ORTAK MESAJ / KART / ANKET RENDER FONKSİYONU
export function renderChatMessageBubble({
  msg,
  allMsgList,
  isGroupChat,
  myAgentId,
  profilesMap,
  myMovies,
  mySeries,
  onAddToLibrary,
  groupCreatedBy,
  onEditPoll,
  onControlPoll,
  onVotePoll,
  showToast,
}: {
  msg: any;
  allMsgList: any[];
  isGroupChat: boolean;
  myAgentId: string | null;
  profilesMap: Record<string, any>;
  myMovies: any[];
  mySeries: any[];
  onAddToLibrary: (item: any, isFromList?: boolean) => void;
  groupCreatedBy?: string;
  onEditPoll?: (pollData: any) => void;
  onControlPoll?: (pollId: string, action: 'close' | 'reopen' | 'delete', msgId?: string) => void;
  onVotePoll?: (pollId: string, optionId: string) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}) {
  const parsed = parseSpecialContent(msg.content);
  if (parsed.kind === 'vote' || parsed.kind === 'poll_ctl') return null;

  const isMe = msg.sender_id === myAgentId;
  const showName = isGroupChat && !isMe;

  if (parsed.kind === 'media') {
    const item = parsed.data;
    const alreadyHas =
      myMovies.some(m => m.title.toLowerCase() === (item.title || '').toLowerCase()) ||
      mySeries.some(s => s.title.toLowerCase() === (item.title || '').toLowerCase());

    return (
      <div
        key={msg.id}
        className={`flex flex-col max-w-[88%] sm:max-w-[340px] ${
          isMe ? 'self-end items-end ml-auto' : 'self-start items-start'
        }`}
      >
        {showName && (
          <span className="text-[10px] font-bold text-ink-500 mb-1 ml-1">
            {profilesMap[msg.sender_id]?.nickname || 'Ajan'} bir yapım paylaştı
          </span>
        )}
        <div className="bg-ink-900 border border-violet-500/40 rounded-2xl p-3 shadow-lg flex gap-3.5 w-full">
          <div className="w-16 h-24 rounded-xl bg-ink-950 overflow-hidden shrink-0 border border-ink-800">
            {item.poster ? (
              <img src={item.poster} alt={item.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-ink-600">
                {item.type === 'series' ? <Tv size={22} /> : <Film size={22} />}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {item.type === 'series' ? 'Dizi Kartı' : 'Film Kartı'}
                </span>
                {item.rating && (
                  <span className="text-[10px] font-black text-gold-400 bg-gold-500/10 px-1.5 py-0.5 rounded border border-gold-500/20 flex items-center gap-0.5">
                    <Star size={9} className="fill-gold-400" /> {item.rating}
                  </span>
                )}
              </div>
              <h4 className="text-xs sm:text-sm font-black text-white leading-tight line-clamp-2">{item.title}</h4>
              {item.year && <div className="text-[10px] text-ink-400 mt-0.5">{item.year}</div>}
            </div>

            <div className="mt-2">
              {alreadyHas ? (
                <div className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center justify-center gap-1">
                  <Check size={12} /> Kütüphanende Var
                </div>
              ) : (
                <button
                  onClick={() => onAddToLibrary(item, true)}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                >
                  <Plus size={12} strokeWidth={3} /> Kütüphaneme Ekle
                </button>
              )}
            </div>
          </div>
        </div>
        <span className="text-[9px] text-ink-600 font-medium mt-1 px-1">
          {new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    );
  }

  if (parsed.kind === 'poll') {
    let poll = { ...parsed.data };
    let isClosed = false;
    let isDeleted = false;

    const votesByUser: Record<string, string> = {};
    allMsgList.forEach(m => {
      const p = parseSpecialContent(m.content);
      if (p.kind === 'vote' && p.data?.pollId === poll.pollId) {
        votesByUser[m.sender_id] = p.data.optionId;
      } else if (p.kind === 'poll_ctl' && p.data?.pollId === poll.pollId) {
        if (p.data.action === 'close') isClosed = true;
        if (p.data.action === 'reopen') isClosed = false;
        if (p.data.action === 'delete') isDeleted = true;
        if (p.data.action === 'edit') {
          if (p.data.question) poll.question = p.data.question;
          if (Array.isArray(p.data.options)) poll.options = p.data.options;
        }
      }
    });

    if (isDeleted) return null;

    const totalVotes = Object.keys(votesByUser).length;
    const myVote = votesByUser[myAgentId || ''];
    const canManagePoll = msg.sender_id === myAgentId || groupCreatedBy === myAgentId;

    let maxVoteCount = 0;
    (poll.options || []).forEach((opt: any) => {
      const c = Object.values(votesByUser).filter(oid => oid === opt.id).length;
      if (c > maxVoteCount) maxVoteCount = c;
    });

    return (
      <div
        key={msg.id}
        className={`flex flex-col w-full max-w-[94%] sm:max-w-[420px] ${
          isMe ? 'self-end items-end ml-auto' : 'self-start items-start'
        }`}
      >
        {showName && (
          <span className="text-[10px] font-bold text-ink-500 mb-1 ml-1">
            {profilesMap[msg.sender_id]?.nickname || 'Ajan'} bir anket başlattı
          </span>
        )}
        <div
          className={`w-full bg-gradient-to-b from-ink-900 to-ink-950 border rounded-2xl p-4 shadow-xl ${
            isClosed ? 'border-red-500/30' : 'border-gold-500/40'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg flex items-center gap-1 border ${
                  isClosed
                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : 'bg-gold-500/10 text-gold-400 border-gold-500/20'
                }`}
              >
                {isClosed ? <Lock size={11} /> : <BarChart2 size={11} />}
                {isClosed ? 'Anket Kapandı' : 'Canlı Anket'}
              </span>
              <span className="text-[10px] font-mono text-ink-400">{totalVotes} Oy</span>
            </div>

            {canManagePoll && onControlPoll && (
              <div className="flex items-center gap-1">
                {!isClosed && onEditPoll && (
                  <button
                    onClick={() => onEditPoll(poll)}
                    className="p-1.5 rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-300 hover:text-gold-400 transition-colors"
                    title="Anketi Düzenle"
                  >
                    <Edit2 size={12} />
                  </button>
                )}
                <button
                  onClick={() => onControlPoll(poll.pollId, isClosed ? 'reopen' : 'close')}
                  className={`p-1.5 rounded-lg bg-ink-800 hover:bg-ink-700 transition-colors ${
                    isClosed ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                  title={isClosed ? 'Anketi Tekrar Aç' : 'Oylamayı Bitir / Kapat'}
                >
                  {isClosed ? <Unlock size={12} /> : <Lock size={12} />}
                </button>
                <button
                  onClick={() => onControlPoll(poll.pollId, 'delete', msg.id)}
                  className="p-1.5 rounded-lg bg-ink-800 hover:bg-red-500/20 text-ink-400 hover:text-red-400 transition-colors"
                  title="Anketi Sil"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>

          <h4 className="text-sm sm:text-base font-black text-white mb-3">{poll.question}</h4>

          <div className="space-y-2.5">
            {(poll.options || []).map((opt: any) => {
              const voters = Object.entries(votesByUser)
                .filter(([_, oid]) => oid === opt.id)
                .map(([u]) => u);
              const count = voters.length;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const isSelected = myVote === opt.id;
              const isWinner = isClosed && maxVoteCount > 0 && count === maxVoteCount;

              return (
                <div
                  key={opt.id}
                  onClick={() => {
                    if (isClosed) {
                      showToast?.('Bu anket oylamaya kapatılmıştır.', 'info');
                      return;
                    }
                    onVotePoll?.(poll.pollId, opt.id);
                  }}
                  className={`relative rounded-xl border p-2.5 overflow-hidden transition-all ${
                    isClosed ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    isWinner
                      ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : isSelected
                      ? 'border-gold-400 bg-gold-500/10'
                      : 'border-ink-800 bg-ink-900/60 hover:border-ink-700'
                  }`}
                >
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-500 pointer-events-none ${
                      isWinner ? 'bg-emerald-500/20' : 'bg-gold-500/15'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="w-9 h-12 rounded-lg bg-ink-950 overflow-hidden shrink-0 border border-ink-800">
                      {opt.poster ? (
                        <img src={opt.poster} alt={opt.title} className="w-full h-full object-cover" />
                      ) : (
                        <Film size={16} className="text-ink-600 m-auto mt-3" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          {isWinner && <span className="text-emerald-400 font-black">🏆</span>}
                          {opt.title}
                        </span>
                        <span className={`text-xs font-black font-mono ${isWinner ? 'text-emerald-400' : 'text-gold-400'}`}>
                          %{pct}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-ink-400 truncate">
                          {voters.length === 0
                            ? 'Henüz oy yok'
                            : voters
                                .map(v => (v === myAgentId ? 'Sen' : profilesMap[v]?.nickname?.split(' ')[0] || 'Ajan'))
                                .join(', ')}
                        </span>
                        <span className="text-[10px] font-bold text-ink-500">{count} oy</span>
                      </div>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onAddToLibrary(opt, true);
                      }}
                      className="p-1.5 rounded-lg bg-ink-950/80 hover:bg-emerald-500/20 text-ink-400 hover:text-emerald-400 border border-ink-800 transition-colors"
                      title="Kütüphaneme Ekle"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <span className="text-[9px] text-ink-600 font-medium mt-1 px-1">
          {new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    );
  }

  return (
    <div
      key={msg.id}
      className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${
        isMe ? 'self-end items-end ml-auto' : 'self-start items-start'
      }`}
    >
      {showName && (
        <span className="text-[10px] font-bold text-ink-500 mb-1 ml-1">
          {profilesMap[msg.sender_id]?.nickname || 'Ajan'}
        </span>
      )}
      <div
        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
          isMe
            ? 'bg-azure-600 text-white rounded-tr-sm'
            : 'bg-ink-800 text-ink-100 rounded-tl-sm border border-ink-700/50'
        }`}
      >
        {msg.content}
      </div>
      <span className="text-[9px] text-ink-600 font-medium mt-1.5 px-1">
        {new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

interface ChatHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  myAgentId: string | null;
  myNickname: string;
  friends: any[];
  profilesMap: Record<string, any>;
  setProfilesMap: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  movies: any[];
  series: any[];
  onAddToLibrary: (item: any, isFromList?: boolean) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  syncTick: number;
  onTriggerSync: () => void;
  initialDirectChatId: string | null;
  onClearInitialDirectChat: () => void;
  // Profil modalından film kartı paylaşmak için harici tetikleyici
  externalMediaShareOpen: boolean;
  onCloseExternalMediaShare: () => void;
  onSendProfileMediaCard: (encodedContent: string) => Promise<void>;
}

export default function ChatHubModal({
  isOpen,
  onClose,
  myAgentId,
  myNickname,
  friends,
  profilesMap,
  setProfilesMap,
  movies,
  series,
  onAddToLibrary,
  showToast,
  syncTick,
  onTriggerSync,
  initialDirectChatId,
  onClearInitialDirectChat,
  externalMediaShareOpen,
  onCloseExternalMediaShare,
  onSendProfileMediaCard,
}: ChatHubModalProps) {
  const [hubTab, setHubTab] = useState<'direct' | 'group'>('direct');
  const [hubActiveChat, setHubActiveChat] = useState<{
    id: string;
    type: 'direct' | 'group';
    name?: string;
    members?: any[];
    created_by?: string;
  } | null>(null);
  const [hubInboxDirect, setHubInboxDirect] = useState<any[]>([]);
  const [hubInboxGroup, setHubInboxGroup] = useState<any[]>([]);
  const [hubMessages, setHubMessages] = useState<any[]>([]);
  const [hubInput, setHubInput] = useState('');

  const [groupActionConf, setGroupActionConf] = useState<{
    id: string;
    name: string;
    action: 'leave' | 'delete';
  } | null>(null);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [memberToKick, setMemberToKick] = useState<{ id: string; name: string } | null>(null);

  const [hubCreateMode, setHubCreateMode] = useState<'direct' | 'group' | null>(null);
  const [newDirectCode, setNewDirectCode] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);

  // FİLM KARTI VE ANKET MODALLARI
  const [showInternalMediaShare, setShowInternalMediaShare] = useState(false);
  const [mediaShareSearch, setMediaShareSearch] = useState('');

  const [showPollCreatorModal, setShowPollCreatorModal] = useState(false);
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [pollQuestion, setPollQuestion] = useState('Bu akşam hangisini izleyelim?');
  const [pollSelectedIds, setPollSelectedIds] = useState<string[]>([]);
  const [pollSearch, setPollSearch] = useState('');

  const hubScrollRef = useRef<HTMLDivElement>(null);
  const profilesMapRef = useRef(profilesMap);
  useEffect(() => {
    profilesMapRef.current = profilesMap;
  }, [profilesMap]);

  // Arkadaşlar listesinden "Mesaj Gönder"e basıldığında doğrudan o sohbeti aç
  useEffect(() => {
    if (isOpen && initialDirectChatId) {
      setHubTab('direct');
      setHubCreateMode(null);
      setHubMessages([]);
      setHubActiveChat({ id: initialDirectChatId, type: 'direct' });
      onClearInitialDirectChat();
    }
  }, [isOpen, initialDirectChatId, onClearInitialDirectChat]);

  const loadHubInbox = useCallback(async () => {
    if (!myAgentId) return;
    try {
      const { data: rawDirectMsgs } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${myAgentId},receiver_id.eq.${myAgentId}`)
        .order('created_at', { ascending: false });

      const directMsgs = (rawDirectMsgs || []).filter(
        (m: any) =>
          !m.group_id &&
          !String(m.content || '').startsWith(VOTE_PREFIX) &&
          !String(m.content || '').startsWith(POLL_CTL_PREFIX)
      );

      const dMap = new Map();
      directMsgs.forEach((msg: any) => {
        const otherId = msg.sender_id === myAgentId ? msg.receiver_id : msg.sender_id;
        if (!otherId) return;
        if (!dMap.has(otherId)) {
          dMap.set(otherId, {
            id: otherId,
            type: 'direct',
            lastMessage: formatInboxPreview(msg.content),
            created_at: msg.created_at,
            unread: msg.receiver_id === myAgentId && !msg.is_read ? 1 : 0,
          });
        } else if (msg.receiver_id === myAgentId && !msg.is_read) {
          dMap.get(otherId).unread += 1;
        }
      });

      const { data: memberOf } = await supabase
        .from('chat_group_members')
        .select('group_id')
        .eq('agent_id', myAgentId);

      const gMap = new Map();
      if (memberOf && memberOf.length > 0) {
        const gIds = memberOf.map((m: any) => m.group_id);
        const { data: groupsData } = await supabase.from('chat_groups').select('*').in('id', gIds);

        if (groupsData) {
          const { data: gMsgs } = await supabase
            .from('messages')
            .select('*')
            .in('group_id', gIds)
            .order('created_at', { ascending: false });

          groupsData.forEach((g: any) => {
            const lastMsg = gMsgs?.find(
              (m: any) =>
                m.group_id === g.id &&
                !String(m.content || '').startsWith(VOTE_PREFIX) &&
                !String(m.content || '').startsWith(POLL_CTL_PREFIX)
            );
            gMap.set(g.id, {
              id: g.id,
              type: 'group',
              name: g.name,
              created_by: g.created_by,
              lastMessage: lastMsg
                ? `${lastMsg.sender_id === myAgentId ? 'Sen' : 'Biri'}: ${formatInboxPreview(lastMsg.content)}`
                : 'Grup oluşturuldu',
              created_at: lastMsg ? lastMsg.created_at : g.created_at,
              unread: 0,
            });
          });
        }
      }

      setHubInboxDirect(
        Array.from(dMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      );
      setHubInboxGroup(
        Array.from(gMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      );

      const unknownIds = Array.from(dMap.values())
        .filter(i => !profilesMapRef.current[i.id])
        .map(i => i.id);
      if (unknownIds.length > 0) {
        const { data: newProfs } = await supabase.from('profiles').select('*').in('agent_id', unknownIds);
        if (newProfs) {
          setProfilesMap(prev => {
            const updated = { ...prev };
            newProfs.forEach((p: any) => (updated[p.agent_id] = p));
            return updated;
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [myAgentId, setProfilesMap]);

  const loadHubMessages = useCallback(async () => {
    if (!hubActiveChat || !myAgentId) return;
    try {
      if (hubActiveChat.type === 'direct') {
        const { data: rawMsgs } = await supabase
          .from('messages')
          .select('*')
          .or(
            `and(sender_id.eq.${myAgentId},receiver_id.eq.${hubActiveChat.id}),and(sender_id.eq.${hubActiveChat.id},receiver_id.eq.${myAgentId})`
          )
          .order('created_at', { ascending: true });

        setHubMessages((prev: any[]) => {
          const newMsgs = (rawMsgs || []).filter((m: any) => !m.group_id);
          const fetchedIds = new Set(newMsgs.map((m: any) => m.id));
          const localOnly = prev.filter(
            (m: any) =>
              !fetchedIds.has(m.id) &&
              m.sender_id === myAgentId &&
              m.receiver_id === hubActiveChat.id &&
              !m.group_id
          );
          return [...newMsgs, ...localOnly].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });

        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('receiver_id', myAgentId)
          .eq('sender_id', hubActiveChat.id)
          .eq('is_read', false);
      } else {
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('group_id', hubActiveChat.id)
          .order('created_at', { ascending: true });

        setHubMessages((prev: any[]) => {
          const newMsgs = msgs || [];
          const fetchedIds = new Set(newMsgs.map((m: any) => m.id));
          const localOnly = prev.filter(
            (m: any) => !fetchedIds.has(m.id) && m.sender_id === myAgentId && m.group_id === hubActiveChat.id
          );
          return [...newMsgs, ...localOnly].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });

        try {
          const { data: members } = await supabase
            .from('chat_group_members')
            .select('agent_id')
            .eq('group_id', hubActiveChat.id);
          if (members) {
            const allIds = members.map((m: any) => m.agent_id);
            if (!allIds.includes(myAgentId)) {
              setHubActiveChat(null);
              setShowGroupManager(false);
              showToast('Bu gruptan çıkarıldınız.', 'warning');
              return;
            }

            const mIds = allIds.filter((id: string) => id !== myAgentId);
            if (JSON.stringify(hubActiveChat.members) !== JSON.stringify(mIds)) {
              setHubActiveChat(prev => (prev ? { ...prev, members: mIds } : null));
            }
            const unknownIds = mIds.filter((id: string) => !profilesMapRef.current[id]);
            if (unknownIds.length > 0) {
              const { data: newProfs } = await supabase.from('profiles').select('*').in('agent_id', unknownIds);
              if (newProfs) {
                setProfilesMap(prev => {
                  const updated = { ...prev };
                  newProfs.forEach((p: any) => (updated[p.agent_id] = p));
                  return updated;
                });
              }
            }
          }
        } catch {}
      }
    } catch (err) {
      console.error(err);
    }
  }, [hubActiveChat?.id, hubActiveChat?.type, myAgentId, setProfilesMap, showToast]);

  useEffect(() => {
    if (isOpen) {
      loadHubInbox();
      if (hubActiveChat?.id) loadHubMessages();
    }
  }, [isOpen, syncTick, hubActiveChat?.id, loadHubInbox, loadHubMessages]);

  useEffect(() => {
    if (hubScrollRef.current) {
      hubScrollRef.current.scrollTop = hubScrollRef.current.scrollHeight;
    }
  }, [hubMessages]);

  const handleHubSendMessage = async (customContent?: string) => {
    const content = (customContent !== undefined ? customContent : hubInput).trim();
    if (!content || !hubActiveChat || !myAgentId) return;
    if (customContent === undefined) setHubInput('');

    try {
      if (hubActiveChat.type === 'direct') {
        const newMsg = {
          id: uid(),
          sender_id: myAgentId,
          receiver_id: hubActiveChat.id,
          group_id: null,
          content,
          created_at: new Date().toISOString(),
          is_read: false,
        };
        setHubMessages((prev: any[]) => [...prev, newMsg]);
        await supabase.from('messages').insert([newMsg]);
      } else {
        const newMsg = {
          id: uid(),
          group_id: hubActiveChat.id,
          sender_id: myAgentId,
          receiver_id: null,
          content,
          created_at: new Date().toISOString(),
          is_read: true,
        };
        setHubMessages((prev: any[]) => [...prev, newMsg]);
        await supabase.from('messages').insert([newMsg]);
      }
      onTriggerSync();
    } catch {
      showToast('Mesaj gönderilemedi', 'error');
    }
  };

  const handleSendMediaCard = async (item: any) => {
    let itemRating = item.rating;
    if (item.type === 'series' && Array.isArray(item.episodes)) {
      const ratedEps = item.episodes.filter((e: any) => e.rating !== null);
      if (ratedEps.length > 0) {
        itemRating = Number(
          (ratedEps.reduce((a: number, b: any) => a + (b.rating || 0), 0) / ratedEps.length).toFixed(1)
        );
      }
    }
    const payload = {
      id: item.id,
      title: item.title,
      type: item.type,
      year: item.year || '',
      poster: item.posterUrl || null,
      rating: itemRating || null,
      genres: (item.genres || []).slice(0, 3),
    };
    const encoded = MEDIA_PREFIX + JSON.stringify(payload);
    setMediaShareSearch('');

    if (externalMediaShareOpen) {
      onCloseExternalMediaShare();
      await onSendProfileMediaCard(encoded);
    } else {
      setShowInternalMediaShare(false);
      await handleHubSendMessage(encoded);
    }
    showToast(`"${item.title}" kartı sohbete gönderildi!`, 'success');
  };

  const handleSavePoll = async () => {
    if (!hubActiveChat || hubActiveChat.type !== 'group') return;
    if (!pollQuestion.trim()) {
      showToast('Lütfen anket sorusu yazın!', 'warning');
      return;
    }
    if (pollSelectedIds.length < 2) {
      showToast('Anket için en az 2 yapım seçmelisin!', 'warning');
      return;
    }

    const combined = [
      ...movies.map(m => ({ ...m, type: 'movie' })),
      ...series.map(s => ({ ...s, type: 'series' })),
    ];
    const options = combined
      .filter(x => pollSelectedIds.includes(x.id))
      .map(x => ({
        id: x.id,
        title: x.title,
        type: x.type,
        year: x.year || '',
        poster: x.posterUrl || null,
        genres: (x.genres || []).slice(0, 2),
      }));

    if (editingPollId) {
      const ctlPayload = {
        pollId: editingPollId,
        action: 'edit',
        question: pollQuestion.trim(),
        options,
      };
      await handleHubSendMessage(POLL_CTL_PREFIX + JSON.stringify(ctlPayload));
      showToast('Anket güncellendi!', 'success');
    } else {
      const pollPayload = {
        pollId: `POLL-${uid().slice(0, 8)}`,
        question: pollQuestion.trim(),
        createdBy: myAgentId,
        options,
      };
      await handleHubSendMessage(POLL_PREFIX + JSON.stringify(pollPayload));
      showToast('Grup anketi başlatıldı!', 'success');
    }

    setShowPollCreatorModal(false);
    setEditingPollId(null);
    setPollSelectedIds([]);
  };

  const handleControlPoll = async (pollId: string, action: 'close' | 'reopen' | 'delete', msgId?: string) => {
    if (!hubActiveChat || hubActiveChat.type !== 'group') return;
    if (action === 'delete' && msgId) {
      try {
        await supabase.from('messages').delete().eq('id', msgId);
        setHubMessages(prev => prev.filter(m => m.id !== msgId));
      } catch {}
    }
    const ctlPayload = { pollId, action };
    await handleHubSendMessage(POLL_CTL_PREFIX + JSON.stringify(ctlPayload));
    if (action === 'close') showToast('Anket oylamaya kapatıldı!', 'info');
    if (action === 'reopen') showToast('Anket tekrar oylamaya açıldı!', 'success');
    if (action === 'delete') showToast('Anket silindi.', 'info');
  };

  const openEditPollModal = (pollData: any) => {
    setEditingPollId(pollData.pollId);
    setPollQuestion(pollData.question || '');
    setPollSelectedIds((pollData.options || []).map((o: any) => o.id));
    setPollSearch('');
    setShowPollCreatorModal(true);
  };

  const handleVotePoll = async (pollId: string, optionId: string) => {
    if (!hubActiveChat || hubActiveChat.type !== 'group') return;
    const votePayload = { pollId, optionId };
    await handleHubSendMessage(VOTE_PREFIX + JSON.stringify(votePayload));
  };

  const executeGroupAction = async () => {
    if (!groupActionConf) return;
    try {
      if (groupActionConf.action === 'delete') {
        await supabase.from('chat_groups').delete().eq('id', groupActionConf.id);
        await supabase.from('chat_group_members').delete().eq('group_id', groupActionConf.id);
        await supabase.from('messages').delete().eq('group_id', groupActionConf.id);
        showToast('Grup başarıyla silindi.', 'success');
      } else {
        await supabase
          .from('chat_group_members')
          .delete()
          .eq('group_id', groupActionConf.id)
          .eq('agent_id', myAgentId);
        showToast('Gruptan ayrıldınız.', 'info');
      }
      setHubActiveChat(null);
      setGroupActionConf(null);
      onTriggerSync();
    } catch {
      showToast('İşlem sırasında hata oluştu.', 'error');
    }
  };

  const handleAddMemberToGroup = async (agentId: string) => {
    if (!hubActiveChat || hubActiveChat.type !== 'group') return;
    try {
      await supabase.from('chat_group_members').insert([{ group_id: hubActiveChat.id, agent_id: agentId }]);
      const updatedMembers = [...(hubActiveChat.members || []), agentId];
      setHubActiveChat(prev => (prev ? { ...prev, members: updatedMembers } : null));
      showToast('Ajan gruba eklendi!', 'success');
      onTriggerSync();
    } catch {
      showToast('Ekleme başarısız!', 'error');
    }
  };

  const handleKickMemberFromGroup = async (agentId: string) => {
    if (!hubActiveChat || hubActiveChat.type !== 'group') return;
    try {
      await supabase
        .from('chat_group_members')
        .delete()
        .eq('group_id', hubActiveChat.id)
        .eq('agent_id', agentId);
      const updatedMembers = (hubActiveChat.members || []).filter(id => id !== agentId);
      setHubActiveChat(prev => (prev ? { ...prev, members: updatedMembers } : null));
      showToast('Ajan gruptan atıldı.', 'info');
      setMemberToKick(null);
      onTriggerSync();
    } catch {
      showToast('Atma işlemi başarısız!', 'error');
    }
  };

  const handleStartNewDirectChat = async () => {
    const code = newDirectCode.trim().toUpperCase();
    if (!code) return;
    if (code === myAgentId) {
      showToast('Kendinle konuşamazsın!', 'warning');
      return;
    }

    try {
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('agent_id', code)
        .maybeSingle();
      if (!targetProfile) {
        showToast('Kullanıcı bulunamadı!', 'error');
        return;
      }

      setProfilesMap(prev => ({ ...prev, [code]: targetProfile }));
      setHubCreateMode(null);
      setNewDirectCode('');
      setHubTab('direct');
      setHubMessages([]);
      setHubActiveChat({ id: code, type: 'direct' });
    } catch {
      showToast('Hata oluştu', 'error');
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      showToast('Gruba bir isim ver!', 'warning');
      return;
    }
    if (newGroupMembers.length === 0) {
      showToast('En az bir kişi seç!', 'warning');
      return;
    }

    try {
      const groupId = `GRP-${uid().slice(0, 8)}`;
      await supabase
        .from('chat_groups')
        .insert([{ id: groupId, name: newGroupName.trim(), created_by: myAgentId }]);

      const members = [...newGroupMembers, myAgentId].map(id => ({ group_id: groupId, agent_id: id }));
      await supabase.from('chat_group_members').insert(members);

      const newG = {
        id: groupId,
        type: 'group',
        name: newGroupName.trim(),
        created_by: myAgentId,
        lastMessage: 'Grup oluşturuldu',
        created_at: new Date().toISOString(),
        unread: 0,
      };
      setHubInboxGroup((prev: any[]) => [newG, ...prev]);

      showToast('Grup kuruldu!', 'success');
      setHubCreateMode(null);
      setNewGroupName('');
      setNewGroupMembers([]);
      setHubTab('group');
      setHubMessages([]);
      setHubActiveChat({
        id: groupId,
        type: 'group',
        name: newGroupName.trim(),
        members: newGroupMembers,
        created_by: myAgentId || undefined,
      });
      onTriggerSync();
    } catch {
      showToast('Sistem hatası!', 'error');
    }
  };

  const mediaShareItems = useMemo(() => {
    const combined = [
      ...movies.map(m => ({ ...m, type: 'movie' as const })),
      ...series.map(s => ({ ...s, type: 'series' as const })),
    ];
    return combined
      .filter(item => item.title.toLowerCase().includes(mediaShareSearch.toLowerCase()))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [movies, series, mediaShareSearch]);

  const pollLibraryItems = useMemo(() => {
    const combined = [
      ...movies.map(m => ({ ...m, type: 'movie' as const })),
      ...series.map(s => ({ ...s, type: 'series' as const })),
    ];
    return combined
      .filter(item => item.title.toLowerCase().includes(pollSearch.toLowerCase()))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [movies, series, pollSearch]);

  const isAnyMediaShareOpen = showInternalMediaShare || externalMediaShareOpen;

  return (
    <>
      {/* SOHBET İÇİ FİLM/DİZİ KARTI PAYLAŞMA MODALI */}
      {isAnyMediaShareOpen && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in"
          onClick={() => {
            setShowInternalMediaShare(false);
            onCloseExternalMediaShare();
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-3xl h-[80vh] bg-ink-950 border border-violet-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-4 sm:p-5 border-b border-ink-800 bg-ink-900/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center border border-violet-500/30">
                  <Film size={18} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white">Sohbette Film / Dizi Kartı Paylaş</h2>
                  <p className="text-[11px] text-ink-400">
                    Tıkladığın yapım afişi ve puanıyla birlikte sohbete şık bir kart olarak düşer.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowInternalMediaShare(false);
                  onCloseExternalMediaShare();
                }}
                className="text-ink-500 hover:text-white p-1.5 rounded-lg bg-ink-900"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 sm:p-4 border-b border-ink-800 bg-ink-950 shrink-0">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="text"
                  placeholder="Kütüphanende film veya dizi ara..."
                  value={mediaShareSearch}
                  onChange={e => setMediaShareSearch(e.target.value)}
                  className="w-full bg-ink-900 border border-ink-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-violet-500 outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
              {mediaShareItems.length === 0 ? (
                <div className="text-center py-12 text-ink-500 text-sm">Kütüphanende yapım bulunamadı.</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {mediaShareItems.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleSendMediaCard(item)}
                      className="relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer border border-ink-800 hover:border-violet-400 bg-ink-900 group transition-all hover:scale-[1.03]"
                    >
                      {item.posterUrl ? (
                        <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink-700">
                          {item.type === 'series' ? <Tv size={28} /> : <Film size={28} />}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-violet-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                        <Send size={22} className="text-violet-300 mb-1" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-white">Kartı Gönder</span>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/85 to-transparent p-2 pt-6">
                        <h4 className="text-[10px] font-bold text-white line-clamp-2 leading-tight">{item.title}</h4>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GRUP İÇİ FİLM ANKETİ OLUŞTURMA & DÜZENLEME MODALI */}
      {showPollCreatorModal && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in"
          onClick={() => setShowPollCreatorModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-3xl h-[85vh] bg-ink-950 border border-gold-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-4 sm:p-5 border-b border-ink-800 bg-ink-900/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold-500/20 text-gold-400 flex items-center justify-center border border-gold-500/30">
                  <BarChart2 size={18} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white">
                    {editingPollId ? 'Grup Anketini Düzenle' : 'Grup İçi Film Anketi Başlat'}
                  </h2>
                  <p className="text-[11px] text-ink-400">
                    Kütüphanenden 2 ila 5 yapım seç, grup üyeleri canlı oylasın!
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPollCreatorModal(false);
                  setEditingPollId(null);
                }}
                className="text-ink-500 hover:text-white p-1.5 rounded-lg bg-ink-900"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-ink-900/30 border-b border-ink-800 space-y-3 shrink-0">
              <div>
                <label className="block text-[10px] font-black text-gold-400 uppercase tracking-widest mb-1">
                  Anket Sorusu
                </label>
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={e => setPollQuestion(e.target.value)}
                  placeholder="Örn: Cuma akşamı hangisini izliyoruz?"
                  className="w-full bg-ink-900 border border-ink-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-gold-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input
                    type="text"
                    placeholder="Seçenek eklemek için ara..."
                    value={pollSearch}
                    onChange={e => setPollSearch(e.target.value)}
                    className="w-full bg-ink-900 border border-ink-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:border-gold-500 outline-none"
                  />
                </div>
                <span className="text-xs font-bold text-gold-400 bg-gold-500/10 border border-gold-500/20 px-3 py-2 rounded-xl">
                  {pollSelectedIds.length} / 5 Seçildi
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {pollLibraryItems.map(item => {
                  const isSelected = pollSelectedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setPollSelectedIds(prev => {
                          if (prev.includes(item.id)) return prev.filter(id => id !== item.id);
                          if (prev.length >= 5) {
                            showToast('En fazla 5 seçenek ekleyebilirsin!', 'warning');
                            return prev;
                          }
                          return [...prev, item.id];
                        });
                      }}
                      className={`relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        isSelected
                          ? 'border-gold-400 scale-95 shadow-lg'
                          : 'border-transparent hover:border-ink-700 bg-ink-900'
                      }`}
                    >
                      {item.posterUrl ? (
                        <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink-700">
                          {item.type === 'series' ? <Tv size={28} /> : <Film size={28} />}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/85 to-transparent p-2 pt-6">
                        <h4 className="text-[10px] font-bold text-white line-clamp-2 leading-tight">{item.title}</h4>
                      </div>
                      {isSelected && (
                        <div className="absolute inset-0 bg-gold-500/25 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-gold-500 text-ink-950 flex items-center justify-center font-black shadow-lg">
                            <Check size={16} strokeWidth={3} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-ink-800 bg-ink-950 flex gap-3 shrink-0">
              <button
                onClick={() => {
                  setShowPollCreatorModal(false);
                  setEditingPollId(null);
                }}
                className="px-6 py-3 bg-ink-900 hover:bg-ink-800 text-ink-300 rounded-xl text-sm font-bold"
              >
                İptal
              </button>
              <button
                onClick={handleSavePoll}
                disabled={pollSelectedIds.length < 2}
                className="flex-1 bg-gold-500 hover:bg-gold-400 disabled:opacity-40 text-ink-950 rounded-xl text-sm font-black uppercase tracking-wider transition-colors"
              >
                {editingPollId
                  ? `Değişiklikleri Kaydet (${pollSelectedIds.length} Seçenek)`
                  : `Anketi Gruba Gönder (${pollSelectedIds.length} Seçenek)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ANA MESAJLAŞMA MERKEZİ (CHAT HUB) MODALI */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={onClose}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-5xl h-[85vh] bg-ink-950 border border-azure-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 text-ink-400 hover:text-white p-2 rounded-full hover:bg-ink-800 transition-colors"
            >
              <X size={18} />
            </button>

            {/* SOL SOHBET LİSTESİ */}
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-ink-800 bg-ink-900/30 flex flex-col shrink-0">
              <div className="p-4 border-b border-ink-800">
                <h2 className="text-lg font-black text-white flex items-center gap-2 mb-4">
                  <MessageCircle className="text-azure-400" /> Mesajlar
                </h2>

                <div className="flex gap-1 bg-ink-900/50 p-1 rounded-xl mb-4">
                  <button
                    onClick={() => setHubTab('direct')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      hubTab === 'direct' ? 'bg-ink-800 text-white shadow' : 'text-ink-500 hover:text-ink-300'
                    }`}
                  >
                    Birebir
                  </button>
                  <button
                    onClick={() => setHubTab('group')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      hubTab === 'group'
                        ? 'bg-indigo-600/30 text-indigo-300 shadow'
                        : 'text-ink-500 hover:text-ink-300'
                    }`}
                  >
                    Gruplar
                  </button>
                </div>

                {hubTab === 'direct' ? (
                  <button
                    onClick={() => setHubCreateMode('direct')}
                    className="w-full bg-ink-900 hover:bg-ink-800 border border-ink-700 text-ink-100 text-xs font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <UserPlus size={14} /> Yeni Sohbet
                  </button>
                ) : (
                  <button
                    onClick={() => setHubCreateMode('group')}
                    className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 text-xs font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Users size={14} /> Yeni Grup Kur
                  </button>
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
                          onClick={() => {
                            if (hubActiveChat?.id !== chat.id) {
                              setHubMessages([]);
                              setHubActiveChat({ id: chat.id, type: 'direct' });
                              setHubCreateMode(null);
                            }
                          }}
                          className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-all ${
                            isActive
                              ? 'bg-azure-500/10 border border-azure-500/30'
                              : 'bg-transparent hover:bg-ink-900/50 border border-transparent'
                          }`}
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-black text-lg bg-ink-800 text-ink-300">
                            {prof?.nickname?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`text-sm font-bold truncate pr-2 ${
                                  isActive ? 'text-azure-400' : 'text-white'
                                }`}
                              >
                                {prof?.nickname || 'Bilinmeyen'}
                              </span>
                              <span className="text-[9px] text-ink-500">{timeAgo(chat.created_at)}</span>
                            </div>
                            <div className="text-[11px] text-ink-400 truncate pr-4">{chat.lastMessage}</div>
                          </div>
                          {chat.unread > 0 && (
                            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[9px] font-black text-white shrink-0">
                              {chat.unread}
                            </div>
                          )}
                        </button>
                      );
                    })
                  )
                ) : hubInboxGroup.length === 0 ? (
                  <div className="text-center text-xs text-ink-500 py-10 italic">Henüz bir gruba dahil değilsin.</div>
                ) : (
                  hubInboxGroup.map(chat => {
                    const isActive = hubActiveChat?.id === chat.id;
                    return (
                      <button
                        key={chat.id}
                        onClick={() => {
                          if (hubActiveChat?.id !== chat.id) {
                            setHubMessages([]);
                            setHubActiveChat({
                              id: chat.id,
                              type: 'group',
                              name: chat.name,
                              created_by: chat.created_by,
                            });
                            setHubCreateMode(null);
                          }
                        }}
                        className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-all ${
                          isActive
                            ? 'bg-indigo-500/10 border border-indigo-500/30'
                            : 'bg-transparent hover:bg-ink-900/50 border border-transparent'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-black text-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                          <Users size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-sm font-bold truncate pr-2 ${
                                isActive ? 'text-indigo-400' : 'text-white'
                              }`}
                            >
                              {chat.name}
                            </span>
                            <span className="text-[9px] text-ink-500">{timeAgo(chat.created_at)}</span>
                          </div>
                          <div className="text-[11px] text-ink-400 truncate pr-4">{chat.lastMessage}</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* SAĞ SOHBET EKRANI */}
            <div className="flex-1 flex flex-col bg-ink-950 relative overflow-hidden">
              {hubCreateMode === 'direct' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                  <div className="w-16 h-16 bg-azure-500/10 rounded-full flex items-center justify-center border border-azure-500/30 mb-4">
                    <UserPlus size={24} className="text-azure-400" />
                  </div>
                  <h3 className="text-xl font-black text-white mb-2">Yeni Birebir Sohbet</h3>
                  <p className="text-sm text-ink-400 mb-6 max-w-sm">
                    Arkadaşının 12 haneli ajan kodunu girerek hemen özel bir konuşma başlat.
                  </p>
                  <input
                    type="text"
                    placeholder="SNV-XXXX-XXXX"
                    value={newDirectCode}
                    onChange={e => setNewDirectCode(e.target.value)}
                    className="w-full max-w-xs bg-ink-900 border border-ink-800 text-center rounded-xl px-4 py-3 text-white font-mono uppercase tracking-widest focus:border-azure-500 outline-none mb-4"
                  />
                  <button
                    onClick={handleStartNewDirectChat}
                    disabled={!newDirectCode.trim()}
                    className="w-full max-w-xs bg-azure-600 hover:bg-azure-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
                  >
                    Sohbete Başla
                  </button>
                </div>
              ) : hubCreateMode === 'group' ? (
                <div className="flex-1 flex flex-col p-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-ink-800">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/30">
                      <Users size={20} className="text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white">Yeni Grup Kur</h3>
                      <p className="text-[11px] text-ink-400">Sinevia Ağı üzerinde kendi özel topluluğunu oluştur.</p>
                    </div>
                  </div>

                  <div className="space-y-5 overflow-y-auto custom-scrollbar pr-2 pb-20">
                    <div>
                      <label className="block text-[11px] font-bold text-ink-500 uppercase tracking-widest mb-2">
                        Grup Adı
                      </label>
                      <input
                        type="text"
                        placeholder="Örn: Hafta Sonu Maratoncuları"
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        className="w-full bg-ink-900 border border-ink-800 rounded-xl px-4 py-3 text-white text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-ink-500 uppercase tracking-widest mb-3">
                        Üyeleri Seç ({friends.length} Arkadaş)
                      </label>
                      {friends.length === 0 ? (
                        <div className="text-xs text-ink-500 italic p-4 bg-ink-900/50 rounded-xl border border-ink-800">
                          Henüz ağında kimse yok.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {friends.map(f => {
                            const isSelected = newGroupMembers.includes(f.agent_id);
                            return (
                              <div
                                key={f.agent_id}
                                onClick={() =>
                                  setNewGroupMembers(prev =>
                                    isSelected ? prev.filter(id => id !== f.agent_id) : [...prev, f.agent_id]
                                  )
                                }
                                className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-colors ${
                                  isSelected
                                    ? 'bg-indigo-500/10 border-indigo-500/40'
                                    : 'bg-ink-900/40 border-ink-800 hover:border-ink-700'
                                }`}
                              >
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                                    isSelected ? 'bg-indigo-500 text-white' : 'bg-ink-800 text-ink-300'
                                  }`}
                                >
                                  {f.nickname?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold text-white truncate">{f.nickname}</div>
                                  <div className="text-[9px] text-ink-500 font-mono">{f.agent_id}</div>
                                </div>
                                {isSelected && <Check size={16} className="text-indigo-400" />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full p-5 bg-ink-950 border-t border-ink-800">
                    <button
                      onClick={handleCreateGroup}
                      disabled={!newGroupName.trim() || newGroupMembers.length === 0}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Users size={18} /> Grubu Oluştur ({newGroupMembers.length + 1} Kişi)
                    </button>
                  </div>
                </div>
              ) : !hubActiveChat ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center opacity-60">
                  <MessageCircle size={48} className="text-ink-700 mb-4" />
                  <h3 className="text-lg font-black text-ink-400 mb-1">Mesajlaşma Merkezi</h3>
                  <p className="text-sm text-ink-600">Yandan bir sohbet seçin veya yeni bir konuşma başlatın.</p>
                </div>
              ) : (
                <>
                  <div className="h-16 border-b border-ink-800 bg-ink-900/40 flex items-center justify-between pl-5 pr-14 sm:pr-16 shrink-0 relative">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                          hubActiveChat.type === 'group'
                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                            : 'bg-ink-800 text-emerald-400'
                        }`}
                      >
                        {hubActiveChat.type === 'group' ? (
                          <Users size={16} />
                        ) : (
                          profilesMap[hubActiveChat.id]?.nickname?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">
                          {hubActiveChat.type === 'group'
                            ? hubActiveChat.name
                            : profilesMap[hubActiveChat.id]?.nickname || 'Ajan'}
                        </h3>
                        {hubActiveChat.type === 'group' ? (
                          <div className="text-[10px] text-ink-400 font-medium truncate max-w-[200px] sm:max-w-[300px]">
                            Siz,{' '}
                            {hubActiveChat.members
                              ?.map(id => profilesMap[id]?.nickname?.split(' ')[0] || 'Ajan')
                              .join(', ')}
                          </div>
                        ) : (
                          <div className="text-[10px] text-ink-500 font-mono flex items-center gap-1">
                            <CheckCircle2 size={10} /> Aktif Bağlantı
                          </div>
                        )}
                      </div>
                    </div>
                    {hubActiveChat.type === 'group' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowGroupManager(true)}
                          className="p-2 text-ink-400 hover:text-indigo-400 bg-ink-900 hover:bg-indigo-500/10 rounded-xl transition-colors"
                          title="Grubu Yönet"
                        >
                          <Settings size={18} />
                        </button>
                        <button
                          onClick={() =>
                            setGroupActionConf({
                              id: hubActiveChat.id,
                              name: hubActiveChat.name || 'Grup',
                              action: hubActiveChat.created_by === myAgentId ? 'delete' : 'leave',
                            })
                          }
                          className="p-2 text-ink-500 hover:text-red-400 bg-ink-900 hover:bg-red-500/10 rounded-xl transition-colors"
                          title={hubActiveChat.created_by === myAgentId ? 'Grubu Sil' : 'Gruptan Ayrıl'}
                        >
                          {hubActiveChat.created_by === myAgentId ? <Trash2 size={18} /> : <LogOut size={18} />}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar" ref={hubScrollRef}>
                    {hubMessages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs font-bold text-ink-600 uppercase tracking-widest">
                        İlk mesajı sen gönder
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {hubMessages.map(msg =>
                          renderChatMessageBubble({
                            msg,
                            allMsgList: hubMessages,
                            isGroupChat: hubActiveChat.type === 'group',
                            myAgentId,
                            profilesMap,
                            myMovies: movies,
                            mySeries: series,
                            onAddToLibrary,
                            groupCreatedBy: hubActiveChat.created_by,
                            onEditPoll: openEditPollModal,
                            onControlPoll: handleControlPoll,
                            onVotePoll: handleVotePoll,
                            showToast,
                          })
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-3 sm:p-4 bg-ink-900 border-t border-ink-800 shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowInternalMediaShare(true)}
                        className="p-3 bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 border border-violet-500/30 rounded-2xl transition-colors shrink-0"
                        title="Film / Dizi Kartı Paylaş"
                      >
                        <Film size={18} />
                      </button>
                      {hubActiveChat.type === 'group' && (
                        <button
                          onClick={() => {
                            setEditingPollId(null);
                            setPollQuestion('Bu akşam hangisini izleyelim?');
                            setPollSelectedIds([]);
                            setShowPollCreatorModal(true);
                          }}
                          className="p-3 bg-gold-500/15 hover:bg-gold-500/25 text-gold-400 border border-gold-500/30 rounded-2xl transition-colors shrink-0"
                          title="Grup Film Anketi Başlat"
                        >
                          <BarChart2 size={18} />
                        </button>
                      )}
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={hubInput}
                          onChange={e => setHubInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleHubSendMessage()}
                          placeholder={hubActiveChat.type === 'group' ? 'Gruba yaz...' : 'Mesaj gönder...'}
                          className="w-full bg-ink-950 border border-ink-700 rounded-2xl px-4 py-3 text-sm text-white focus:border-azure-500 outline-none pr-12"
                        />
                        <button
                          onClick={() => handleHubSendMessage()}
                          disabled={!hubInput.trim()}
                          className="absolute right-1.5 top-1.5 bottom-1.5 w-9 bg-azure-600 hover:bg-azure-500 rounded-xl flex items-center justify-center text-white disabled:opacity-50 transition-colors"
                        >
                          <Send size={15} className="ml-0.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* GRUP YÖNETİMİ MODALI */}
            {showGroupManager && hubActiveChat?.type === 'group' && (
              <div
                className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
                onClick={() => setShowGroupManager(false)}
              >
                <div
                  onClick={e => e.stopPropagation()}
                  className="w-full max-w-md bg-ink-950 border border-indigo-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
                >
                  <div className="p-5 border-b border-ink-800 flex items-center justify-between bg-ink-900/50 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                        <Settings size={18} />
                      </div>
                      <h2 className="text-lg font-black text-white">Grup Yönetimi</h2>
                    </div>
                    <button
                      onClick={() => setShowGroupManager(false)}
                      className="text-ink-500 hover:text-white p-2 rounded-xl bg-ink-900 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                    <div>
                      <h3 className="text-[11px] font-black uppercase text-ink-500 tracking-widest mb-3">
                        Mevcut Üyeler ({hubActiveChat.members?.length ? hubActiveChat.members.length + 1 : 1})
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center bg-ink-900/30 p-3 rounded-xl border border-ink-800">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-ink-800 text-ink-300 flex items-center justify-center font-bold text-sm">
                              {hubActiveChat.created_by === myAgentId
                                ? myNickname?.[0]?.toUpperCase()
                                : profilesMap[hubActiveChat.created_by!]?.nickname?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                                {hubActiveChat.created_by === myAgentId
                                  ? 'Sen (Kurucu)'
                                  : profilesMap[hubActiveChat.created_by!]?.nickname}
                                <Crown size={12} className="text-gold-400" />
                              </div>
                              <div className="text-[10px] text-ink-500 font-mono">{hubActiveChat.created_by}</div>
                            </div>
                          </div>
                        </div>

                        {hubActiveChat.members?.map(id => {
                          if (id === hubActiveChat.created_by) return null;
                          return (
                            <div
                              key={id}
                              className="flex justify-between items-center bg-ink-900/30 p-3 rounded-xl border border-ink-800"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-ink-800 text-ink-300 flex items-center justify-center font-bold text-sm">
                                  {profilesMap[id]?.nickname?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-white">
                                    {profilesMap[id]?.nickname || 'Bilinmeyen'}
                                  </div>
                                  <div className="text-[10px] text-ink-500 font-mono">{id}</div>
                                </div>
                              </div>
                              {hubActiveChat.created_by === myAgentId && (
                                <button
                                  onClick={() =>
                                    setMemberToKick({ id, name: profilesMap[id]?.nickname || 'Ajan' })
                                  }
                                  className="p-2 text-ink-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                  title="Gruptan At"
                                >
                                  <UserMinus size={16} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[11px] font-black uppercase text-ink-500 tracking-widest mb-3">
                        Ajan Ekle
                      </h3>
                      <div className="space-y-2">
                        {(() => {
                          const availableFriends = friends.filter(
                            f =>
                              !hubActiveChat.members?.includes(f.agent_id) &&
                              f.agent_id !== hubActiveChat.created_by
                          );
                          if (availableFriends.length === 0) {
                            return (
                              <div className="text-xs text-ink-600 italic p-3 border border-ink-800 border-dashed rounded-xl text-center">
                                Eklenebilecek başka arkadaşın yok.
                              </div>
                            );
                          }
                          return availableFriends.map(f => (
                            <div
                              key={f.agent_id}
                              className="flex justify-between items-center bg-ink-900/30 p-3 rounded-xl border border-ink-800"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-ink-800 text-ink-300 flex items-center justify-center font-bold text-sm">
                                  {f.nickname?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-white">{f.nickname}</div>
                                  <div className="text-[10px] text-ink-500 font-mono">{f.agent_id}</div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleAddMemberToGroup(f.agent_id)}
                                className="p-2 text-ink-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                title="Gruba Ekle"
                              >
                                <UserPlus size={16} />
                              </button>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* GRUPTAN ÜYE ATMA ONAYI */}
            {memberToKick && (
              <div
                className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
                onClick={() => setMemberToKick(null)}
              >
                <div
                  onClick={e => e.stopPropagation()}
                  className="bg-ink-950 border border-ink-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                    <UserMinus size={24} />
                  </div>
                  <h3 className="text-lg font-black text-white mb-2">Ajanı At</h3>
                  <p className="text-sm text-ink-300 mb-6">
                    "{memberToKick.name}" adlı ajanı gruptan atmak istediğinize emin misiniz?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setMemberToKick(null)}
                      className="flex-1 py-3 rounded-xl bg-ink-900 hover:bg-ink-800 text-white font-bold transition-colors"
                    >
                      İptal
                    </button>
                    <button
                      onClick={() => handleKickMemberFromGroup(memberToKick.id)}
                      className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-lg shadow-red-500/20"
                    >
                      Evet, At
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GRUP SİLME / AYRILMA ONAYI */}
      {groupActionConf && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setGroupActionConf(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-ink-950 border border-ink-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              {groupActionConf.action === 'delete' ? (
                <Trash2 size={24} />
              ) : (
                <LogOut size={24} className="ml-1" />
              )}
            </div>
            <h3 className="text-lg font-black text-white mb-2">
              {groupActionConf.action === 'delete' ? 'Grubu Sil' : 'Gruptan Ayrıl'}
            </h3>
            <p className="text-sm text-ink-300 mb-6">
              {groupActionConf.action === 'delete'
                ? `"${groupActionConf.name}" grubunu tamamen silmek istediğinize emin misiniz? Tüm mesajlar ve grup silinecektir.`
                : `"${groupActionConf.name}" grubundan ayrılmak istediğinize emin misiniz?`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setGroupActionConf(null)}
                className="flex-1 py-3 rounded-xl bg-ink-900 hover:bg-ink-800 text-white font-bold transition-colors"
              >
                İptal
              </button>
              <button
                onClick={executeGroupAction}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-lg shadow-red-500/20"
              >
                {groupActionConf.action === 'delete' ? 'Evet, Sil' : 'Evet, Ayrıl'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}