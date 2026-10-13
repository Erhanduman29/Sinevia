import { useState, useRef, useEffect } from 'react';
import {
  Settings, Plus, Trash2, Tag, Boxes, Download, Upload, Edit2, Check, X,
  AlertTriangle, Wrench, SlidersHorizontal, PlayCircle, Palette,
  Sparkles, Moon, Sun, Award, ChevronDown, ThumbsUp, ThumbsDown,
  BellRing, BellOff, UserCircle, Key, Copy, MessageSquare, Gift, UserPlus, ShieldCheck,
  LogOut, Ghost, Snowflake, Coffee, Code, FileText, Terminal, Flame
} from 'lucide-react';
import { BookOpen, Keyboard, Gamepad2, Volume2, VolumeX } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApp, DEFAULT_REVIEW_TAGS, isPositiveTag } from '../context/AppContext';
import { useTutorial } from '../context/TutorialContext';
import type { RatingCriterion } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import ShareImportModal from '../components/ShareImportModal';
import ShortcutsPanel from '../components/ShortcutsPanel';
import { uid } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { isSoundEnabled, setSoundEnabled } from '../lib/sound';

// ---------------------------------------------------------------------------
// PREMIUM YÜZEY & BUTON DİLİ — sinevia-premium.html ile aynı tokenlar.
// Tüm değerler tema CSS değişkenlerine bağlıdır; premium tokenı olmayan
// temalarda (plain-dark vb.) zincir fallback → tüm temalarda tanımlı
// --color-*/--bg-* değişkenleri → literal değer sırasıyla devreye girer.
// ---------------------------------------------------------------------------
const PREMIUM_CARD_BG = 'var(--glass, var(--bg-card, rgba(255, 255, 255, .04)))';
const PREMIUM_ROW_BG = 'var(--glass, var(--bg-surface, rgba(255, 255, 255, .03)))';
const PREMIUM_LINE = 'var(--line-2, var(--border-dim, rgba(244, 244, 242, .13)))';
const PREMIUM_LINE_SOFT = 'var(--line, var(--border-dim, rgba(244, 244, 242, .07)))';
const PREMIUM_RADIUS = 'var(--r, 16px)';
const PREMIUM_RADIUS_LG = 'var(--r-lg, 22px)';
const PREMIUM_RADIUS_SM = 'var(--r-sm, 10px)';
const PREMIUM_RED_GRAD =
  'linear-gradient(150deg, var(--red-hi, var(--color-2, #ff6b7a)) 0%, var(--red, var(--color-1, #e8384f)) 45%, var(--red-deep, var(--color-3, #8e1220)) 130%)';
const PREMIUM_RED_GLOW =
  '0 10px 28px -10px rgba(232, 56, 79, .75), inset 0 1px 0 rgba(255, 255, 255, .35), inset 0 -2px 6px rgba(0, 0, 0, .25)';

/** Cam yüzey kart stili (bölüm panelleri). */
const premiumCardStyle: React.CSSProperties = {
  background: PREMIUM_CARD_BG,
  border: `1px solid ${PREMIUM_LINE}`,
  borderRadius: PREMIUM_RADIUS_LG,
  boxShadow: 'var(--shadow, 0 18px 40px -22px rgba(0, 0, 0, .5)), inset 0 1px 0 rgba(255, 255, 255, .07)',
};

/** Cam satır / iç panel stili (kart içi ayar satırları). */
const premiumRowStyle: React.CSSProperties = {
  background: PREMIUM_ROW_BG,
  border: `1px solid ${PREMIUM_LINE_SOFT}`,
  borderRadius: PREMIUM_RADIUS,
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, .06)',
};

/** Premium birincil buton (btn-p): kırmızı gradyan + iç parlaklık + derinlik. */
const BTN_P =
  'inline-flex items-center justify-center gap-2 font-extrabold uppercase tracking-wider transition-all duration-300 hover:-translate-y-0.5 active:translate-y-px disabled:opacity-40 disabled:pointer-events-none';
const BTN_P_STYLE: React.CSSProperties = {
  background: PREMIUM_RED_GRAD,
  borderRadius: PREMIUM_RADIUS_SM,
  color: '#fff',
  boxShadow: PREMIUM_RED_GLOW,
};

/** Premium ikincil buton (btn-s): cam yüzey + ince ayraç + blur. */
const BTN_S =
  'inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wider transition-all duration-300 hover:-translate-y-0.5 active:translate-y-px disabled:opacity-40 disabled:pointer-events-none';
const BTN_S_STYLE: React.CSSProperties = {
  background: 'linear-gradient(150deg, rgba(255, 255, 255, .14), rgba(255, 255, 255, .05))',
  border: `1px solid ${PREMIUM_LINE}`,
  borderRadius: PREMIUM_RADIUS_SM,
  boxShadow: '0 8px 22px -12px rgba(0, 0, 0, .9), inset 0 1px 0 rgba(255, 255, 255, .16)',
  backdropFilter: 'blur(8px)',
};

/** Anahtar (switch) izi: açıkken kırmızı gradyan + parlama, kapalıyken cam. */
function switchTrackStyle(on: boolean): React.CSSProperties {
  return {
    background: on
      ? 'linear-gradient(90deg, var(--red-deep, var(--color-3, #8e1220)), var(--red, var(--color-1, #e8384f)) 60%, var(--red-hi, var(--color-2, #ff6b7a)))'
      : 'var(--surface2, rgba(127, 127, 140, .35))',
    boxShadow: on
      ? 'inset 0 2px 5px rgba(0, 0, 0, .4), 0 0 16px -4px rgba(232, 56, 79, .8)'
      : 'inset 0 2px 5px rgba(0, 0, 0, .35)',
  };
}

/** Switch tutamağı: fildişi gradyan + yumuşak gölge (premium parıltı). */
const SWITCH_KNOB_STYLE: React.CSSProperties = {
  background: 'linear-gradient(150deg, #fff, #d9d9dc)',
  boxShadow: '0 2px 6px rgba(0, 0, 0, .5)',
};

// ---------------------------------------------------------------------------
// AYAR SEKMELERİ — içerik aynıdır, yalnızca görsel gruplama yapılır.
// ---------------------------------------------------------------------------
type SettingsTabId = 'general' | 'visual' | 'notifications' | 'shortcuts' | 'game';

const SETTINGS_TAB_STORAGE_KEY = 'sinevia_settings_tab';

const SETTINGS_TABS: { id: SettingsTabId; label: string; icon: LucideIcon }[] = [
  { id: 'general', label: 'Genel', icon: Settings },
  { id: 'visual', label: 'Görsel', icon: Palette },
  { id: 'notifications', label: 'Ses & Bildirim', icon: BellRing },
  { id: 'shortcuts', label: 'Kısayollar', icon: Keyboard },
  { id: 'game', label: 'Oyun / Ekonomi', icon: Gamepad2 },
];

function getInitialSettingsTab(): SettingsTabId {
  try {
    const stored = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
    if (stored && SETTINGS_TABS.some((tab) => tab.id === stored)) return stored as SettingsTabId;
  } catch {}
  return 'general';
}

function CollapsibleSection({
  title, icon, desc, badge, defaultOpen = false, children,
}: {
  title: string;
  icon: React.ReactNode;
  desc?: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const storageKey = `sinevia_settings_section_${title}`;
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) return stored === 'true';
    } catch {}
    return defaultOpen;
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(storageKey, String(next)); } catch {}
  };
  return (
    <div className="overflow-hidden backdrop-blur-sm" style={premiumCardStyle}>
      <button
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 p-4 sm:p-5 hover:bg-white/[.04] transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-semibold text-ink-100 flex items-center gap-2 truncate">
            {icon}
            <span className="truncate">{title}</span>
          </h2>
          {badge}
        </div>
        <ChevronDown
          size={20}
          className={`text-ink-400 flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          className="px-4 sm:px-5 pb-4 sm:pb-5 animate-fade-in"
          style={{ borderTop: `1px solid ${PREMIUM_LINE_SOFT}` }}
        >
          {desc && <p className="text-xs sm:text-sm text-ink-400 mb-3.5 mt-3.5">{desc}</p>}
          {children}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const {
    data, addGenre, renameGenre, addReviewTag, deleteReviewTag, renameReviewTag, setTagSentiment,
    addCollection, deleteCollection, renameCollection, exportData, importData,
    toggleLockedNames, addCriterion, editCriterion,
    deleteCriterion, updateAltWatchTemplate, updateTheme, toggleNotifications, toggleSpecificNotification, showToast,
    setNickname, recoverIdentity
  } = useApp();
  const { setCenterOpen, progress, notifyEvent } = useTutorial();

  // Sekme durumu (localStorage'da saklanır); içerik blokları yalnızca bu
  // anahtara göre gruplanır, hiçbir state/handler değişmez.
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabId>(getInitialSettingsTab);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, activeSettingsTab); } catch {}
  }, [activeSettingsTab]);

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  const [editingNickname, setEditingNickname] = useState(false);
  const [tempNickname, setTempNickname] = useState(data.nickname || '');
  const [isRecoverMode, setIsRecoverMode] = useState(false);
  const [recAgentId, setRecAgentId] = useState('');
  const [recKey, setRecKey] = useState('');
  const [recNickname, setRecNickname] = useState('');
  const [recSecretToken, setRecSecretToken] = useState('');
  const [transferBundleInput, setTransferBundleInput] = useState('');
  const [isCheckingName, setIsCheckingName] = useState(false);

  const currentSecretToken = typeof window !== 'undefined' ? (localStorage.getItem('sinevia_secret_token') || '') : '';

  const [newGenre, setNewGenre] = useState('');
  const [newCollection, setNewCollection] = useState('');
  const [editingColl, setEditingColl] = useState<string | null>(null);
  const [editCollName, setEditCollName] = useState('');
  const [confirmDeleteColl, setConfirmDeleteColl] = useState<string | null>(null);
  
  const [confirmResetStage, setConfirmResetStage] = useState<0 | 1>(0);
  const [showResetModal, setShowResetModal] = useState(false);
  
  // YENİ: Çıkış Yapma Modalı için State
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [editingGenre, setEditingGenre] = useState<string | null>(null);
  const [editGenreName, setEditGenreName] = useState('');
  const [, setDeleteGenreTarget] = useState<string | null>(null);

  const [newReviewTag, setNewReviewTag] = useState('');
  const [newTagSentiment, setNewTagSentiment] = useState<'positive' | 'negative'>('positive');
  const [editingReviewTag, setEditingReviewTag] = useState<string | null>(null);
  const [editReviewTagName, setEditReviewTagName] = useState('');
  const [editTagSentiment, setEditTagSentiment] = useState<'positive' | 'negative'>('positive');
  const [deleteReviewTagTarget, setDeleteReviewTagTarget] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [shareImportJson, setShareImportJson] = useState<string | null>(null);

  const [critName, setCritName] = useState('');
  const [critWeight, setCritWeight] = useState(5);
  const [critAppliesTo, setCritAppliesTo] = useState<'movie' | 'series' | 'both'>('both');
  const [critGenres, setCritGenres] = useState<string[]>([]);
  const [isAddingCrit, setIsAddingCrit] = useState(false);
  const [editingCritId, setEditingCritId] = useState<string | null>(null);
  const [deleteCritTarget, setDeleteCritTarget] = useState<string | null>(null);

  const [altTemplate, setAltTemplate] = useState(data.altWatchTemplate || '');
  const reviewTagsList = data.reviewTags && data.reviewTags.length > 0 ? data.reviewTags : DEFAULT_REVIEW_TAGS;
  const positiveTags = reviewTagsList.filter((t) => isPositiveTag(t, data.tagSentiments));
  const negativeTags = reviewTagsList.filter((t) => !isPositiveTag(t, data.tagSentiments));

  const THEMES = [
    { id: 'default', name: 'Karanlık (Orijinal)', desc: 'Kehribar, Safir & Mor', icon: Moon, previewBg: '#0a0a0e', textMode: 'dark', colors: ['#f59e0b', '#0ea5e9', '#8b5cf6'] },
    { id: 'light', name: 'Aydınlık (Ferah)', desc: 'Amber, Mavi & Pembe', icon: Sun, previewBg: '#f8fafc', textMode: 'light', colors: ['#f59e0b', '#3b82f6', '#ec4899'] },
    { id: 'cyberpunk', name: 'Cyberpunk', desc: 'Neon Pembe, Mavi & Sarı', icon: Sparkles, previewBg: '#070312', textMode: 'dark', colors: ['#ec4899', '#06b6d4', '#eab308'] },
    { id: 'blood', name: 'Dracula', desc: 'Kızıl, Mor & Turuncu', icon: Moon, previewBg: '#0a0204', textMode: 'dark', colors: ['#e11d48', '#a855f7', '#f97316'] },
    { id: 'matrix', name: 'Matrix Terminal', desc: 'Zümrüt & Camgöbeği', icon: Sparkles, previewBg: '#020804', textMode: 'dark', colors: ['#10b981', '#84cc16', '#14b8a6'] },
    { id: 'ocean', name: 'Aurora', desc: 'Buz Mavisi & İndigo', icon: Sparkles, previewBg: '#020617', textMode: 'dark', colors: ['#38bdf8', '#6366f1', '#2dd4bf'] },
    { id: 'dracula', name: 'Dracula Klasik', desc: 'Mor, Pembe & Camgöbeği', icon: Ghost, previewBg: '#242030', textMode: 'dark', colors: ['#bd93f9', '#ff79c6', '#8be9fd'] },
    { id: 'nord', name: 'Nord Buzul', desc: 'Buz Mavisi, Mor & Auroral', icon: Snowflake, previewBg: '#2a303c', textMode: 'dark', colors: ['#88c0d0', '#b48ead', '#bf616a'] },
    { id: 'solarized-dark', name: 'Solarized Koyu', desc: 'Hardal, Mazı & Turuncu', icon: Coffee, previewBg: '#002b36', textMode: 'dark', colors: ['#b58900', '#268bd2', '#cb4b16'] },
    { id: 'monokai', name: 'Monokai Neon', desc: 'Sıcak Yeşil, Pembe & Mavi', icon: Code, previewBg: '#272822', textMode: 'dark', colors: ['#f92672', '#a6e22e', '#66d9ef'] },
    { id: 'paper-light', name: 'Kâğıt Sepya', desc: 'Sepya, Mürekkep Mavi & Bordo', icon: FileText, previewBg: '#f5f0e6', textMode: 'light', colors: ['#b45309', '#1d4ed8', '#be123c'] },
    { id: 'retro-amber', name: 'Retro Amber CRT', desc: 'Amber, Turuncu & Soluk Sarı', icon: Terminal, previewBg: '#140c02', textMode: 'dark', colors: ['#ffab00', '#ff7a00', '#ffe082'] },
    { id: 'premium-dark', name: 'Premium Koyu', desc: 'Cam Yüzeyler & Kırmızı Vurgu', icon: Flame, previewBg: '#0a0a0d', textMode: 'dark', colors: ['#e8384f', '#ff6b7a', '#8e1220'] },
    { id: 'plain-dark', name: 'Sade Koyu', desc: 'Minimal, Sakin Gri Vurgu', icon: Moon, previewBg: '#111113', textMode: 'dark', colors: ['#7c7c85', '#8e8e97', '#6b6b73'] },
  ];

  const handleSaveNickname = async () => {
    const newName = tempNickname.trim();
    if (!newName) {
      showToast('İsim boş bırakılamaz.', 'error');
      return;
    }
    
    if (newName.toLowerCase() === (data.nickname || '').toLowerCase()) {
      setEditingNickname(false);
      return;
    }

    setIsCheckingName(true);
    try {
      const { data: existingUser, error } = await supabase
        .from('profiles')
        .select('nickname')
        .ilike('nickname', newName)
        .neq('agent_id', data.agentId)
        .maybeSingle();

      if (error) throw error;

      if (existingUser) {
        showToast('Bu isim daha önce alınmış! Başka bir isim seçmelisin.', 'warning');
      } else {
        setNickname(newName);
        setEditingNickname(false);
      }
    } catch (err) {
      console.error(err);
      showToast('İsim kontrolü sırasında bir ağ hatası oluştu.', 'error');
    } finally {
      setIsCheckingName(false);
    }
  };

  const handleCopyTransferCode = () => {
    try {
      const payload = {
        a: data.agentId || '',
        n: data.nickname || '',
        r: data.recoveryKey || '',
        s: localStorage.getItem('sinevia_secret_token') || ''
      };
      const encoded = 'SNV-TRANSFER-' + btoa(encodeURIComponent(JSON.stringify(payload)));
      navigator.clipboard.writeText(encoded);
      showToast('Cihaz Taşıma Kodu kopyalandı! Yeni cihazına yapıştırabilirsin.', 'success');
    } catch {
      showToast('Taşıma kodu oluşturulurken hata oluştu.', 'error');
    }
  };

  const handleParseTransferCode = (val: string) => {
    setTransferBundleInput(val);
    const trimmed = val.trim();
    if (trimmed.startsWith('SNV-TRANSFER-')) {
      try {
        const base64Part = trimmed.replace('SNV-TRANSFER-', '');
        const decoded = JSON.parse(decodeURIComponent(atob(base64Part)));
        if (decoded.a) setRecAgentId(decoded.a);
        if (decoded.n) setRecNickname(decoded.n);
        if (decoded.r) setRecKey(decoded.r);
        if (decoded.s) setRecSecretToken(decoded.s);
        showToast('Taşıma kodu çözüldü! Bilgiler otomatik dolduruldu.', 'success');
      } catch {}
    }
  };

  const handleRecoverIdentity = () => {
    if (!recAgentId.trim() || !recKey.trim() || !recNickname.trim()) {
      showToast('Lütfen Ağ Kodu, İsim ve Kurtarma Anahtarı alanlarını doldurun!', 'error');
      return;
    }

    const tokenToSave = recSecretToken.trim();
    if (tokenToSave) {
      localStorage.setItem('sinevia_secret_token', tokenToSave);
    }

    recoverIdentity(recAgentId.trim().toUpperCase(), recKey.trim(), recNickname.trim());
    setIsRecoverMode(false);
    setRecAgentId('');
    setRecKey('');
    setRecNickname('');
    setRecSecretToken('');
    setTransferBundleInput('');

    if (tokenToSave) {
      setTimeout(() => {
        window.location.reload();
      }, 600);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} kopyalandı!`, 'success');
  };

  const handleAddGenre = () => { if (!newGenre.trim()) return; addGenre(newGenre); setNewGenre(''); };
  const handleAddReviewTag = () => {
    if (!newReviewTag.trim()) return;
    addReviewTag(newReviewTag.trim(), newTagSentiment);
    setNewReviewTag('');
  };
  const handleAddCollection = () => { if (!newCollection.trim()) return; addCollection(newCollection); setNewCollection(''); };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importData(reader.result as string);
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveCriterion = () => {
    if (!critName.trim()) return;
    const payload: RatingCriterion = { id: editingCritId || uid(), name: critName.trim(), weight: critWeight, appliesTo: critAppliesTo, genres: critGenres };
    if (editingCritId) editCriterion(editingCritId, payload);
    else addCriterion(payload);
    resetCritForm();
  };

  const handleEditCrit = (c: RatingCriterion) => {
    setCritName(c.name); setCritWeight(c.weight); setCritAppliesTo(c.appliesTo);
    setCritGenres(c.genres || []); setEditingCritId(c.id); setIsAddingCrit(true);
  };

  const resetCritForm = () => {
    setCritName(''); setCritWeight(5); setCritAppliesTo('both');
    setCritGenres([]); setIsAddingCrit(false); setEditingCritId(null);
  };

  const toggleCritGenre = (g: string) => {
    setCritGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const applyReviewTagEdit = (oldTag: string) => {
    const newName = editReviewTagName.trim();
    if (!newName) return;
    renameReviewTag(oldTag, newName, editTagSentiment);
    setEditingReviewTag(null);
  };

  const handleDisconnectDevice = () => {
    localStorage.removeItem('sinevia-v1');
    localStorage.removeItem('sinevia-quests-v1');
    localStorage.removeItem('sinevia_secret_token');
    // Tutorial ilerlemesi ve akademi yoldaşının durumu da cihaza özel veridir;
    // sıfırlama ile birlikte onlar da baştan başlar.
    localStorage.removeItem('sinevia-tutorial-v1');
    localStorage.removeItem('sinevia-academy-ui-v1');
    window.location.reload(); 
  };

  const handleExecuteFullReset = async () => {
    try {
      if (data.agentId) {
        await supabase.from('profiles').delete().eq('agent_id', data.agentId);
      }
    } catch (e) {
      console.error("Buluttan silme hatası", e);
    }
    
    localStorage.removeItem('sinevia-v1');
    localStorage.removeItem('sinevia-quests-v1');
    localStorage.removeItem('sinevia_secret_token');
    // Tutorial ilerlemesi ve akademi yoldaşının durumu da sıfırlanmalı
    localStorage.removeItem('sinevia-tutorial-v1');
    localStorage.removeItem('sinevia-academy-ui-v1');

    setShowResetModal(false);
    setConfirmResetStage(0);
    window.location.reload(); 
  };

  const renderTagChip = (tag: string) => (
    <div key={tag} className="flex items-center gap-1.5 px-2.5 pr-2 py-1.5 transition-colors rounded-xl" style={{
      background: PREMIUM_ROW_BG,
      border: `1px solid ${isPositiveTag(tag, data.tagSentiments) ? 'rgba(16, 185, 129, .4)' : 'rgba(232, 56, 79, .4)'}`,
    }}>
      {editingReviewTag === tag ? (
        <>
          <input
            type="text"
            value={editReviewTagName}
            onChange={(e) => setEditReviewTagName(e.target.value)}
            className="px-2 py-0.5 text-xs sm:text-sm text-ink-100 focus:outline-none w-28 sm:w-36"
            style={{ background: 'var(--bg-base, #0a0a0d)', border: '1px solid var(--color-1, #f59e0b)', borderRadius: PREMIUM_RADIUS_SM }}
            onKeyDown={(e) => { if (e.key === 'Enter' && editReviewTagName.trim()) { applyReviewTagEdit(tag); } }}
          />
          <button
            onClick={() => setEditTagSentiment(editTagSentiment === 'positive' ? 'negative' : 'positive')}
            className={`p-1 rounded-lg transition-colors ${editTagSentiment === 'positive' ? 'text-emerald-400 hover:bg-emerald-500/20' : 'text-red-400 hover:bg-red-500/20'}`}
            title={editTagSentiment === 'positive' ? 'Övgü' : 'Eleştiri'}
          >
            {editTagSentiment === 'positive' ? <ThumbsUp size={13} /> : <ThumbsDown size={13} />}
          </button>
          <button onClick={() => { if (editReviewTagName.trim()) { applyReviewTagEdit(tag); } }} className="text-green-400 hover:text-green-300 transition-colors p-0.5"><Check size={14} /></button>
          <button onClick={() => setEditingReviewTag(null)} className="text-ink-400 hover:text-ink-200 transition-colors p-0.5"><X size={14} /></button>
        </>
      ) : (
        <>
          <span className="text-xs sm:text-sm font-medium text-ink-100">{tag}</span>
          <button
            onClick={() => { const newSent = isPositiveTag(tag, data.tagSentiments) ? 'negative' : 'positive'; setTagSentiment(tag, newSent); }}
            className={`p-0.5 rounded transition-colors ${isPositiveTag(tag, data.tagSentiments) ? 'text-emerald-500 hover:text-emerald-400' : 'text-red-500 hover:text-red-400'}`}
            title={isPositiveTag(tag, data.tagSentiments) ? 'Övgü (değiştirmek için tıkla)' : 'Eleştiri (değiştirmek için tıkla)'}
          >
            {isPositiveTag(tag, data.tagSentiments) ? <ThumbsUp size={12} /> : <ThumbsDown size={12} />}
          </button>
          <button onClick={() => { setEditingReviewTag(tag); setEditReviewTagName(tag); setEditTagSentiment(isPositiveTag(tag, data.tagSentiments) ? 'positive' : 'negative'); }} className="text-ink-400 hover:text-gold-400 transition-colors p-0.5"><Edit2 size={12} /></button>
          <button onClick={() => setDeleteReviewTagTarget(tag)} className="text-ink-400 hover:text-red-400 transition-colors p-0.5"><X size={13} /></button>
        </>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 animate-fade-in pb-10">
      <h1 className="text-xl sm:text-2xl font-bold text-ink-100 flex items-center gap-2.5">
        <div
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center"
          style={{ borderRadius: 'var(--r-sm, 10px)', background: PREMIUM_RED_GRAD, color: '#fff', boxShadow: '0 8px 22px -8px rgba(232, 56, 79, .7), inset 0 1px 0 rgba(255, 255, 255, .35)' }}
        >
          <Settings size={20} />
        </div>
        Ayarlar
      </h1>

      {/* TUTORIAL MERKEZİ GİRİŞİ */}
      <button
        onClick={() => setCenterOpen(true)}
        className="w-full flex items-center gap-4 p-5 rounded-[var(--r-lg,22px)] border text-left transition-all group backdrop-blur-sm hover:-translate-y-0.5"
        style={{ ...premiumCardStyle, borderRadius: 'var(--r-lg, 22px)' }}
      >
        <div
          className="w-12 h-12 flex items-center justify-center flex-shrink-0 text-white group-hover:scale-110 transition-transform"
          style={{ borderRadius: 'var(--r, 16px)', background: PREMIUM_RED_GRAD, boxShadow: '0 8px 22px -8px rgba(232, 56, 79, .75), inset 0 1px 0 rgba(255, 255, 255, .35)' }}
        >
          <BookOpen size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-white">Tutorial Merkezi</div>
          <div className="text-xs text-ink-400">Uygulamayı adım adım öğren, istediğin turu tekrar izle.</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div
            className="text-lg font-black font-mono leading-none"
            style={{ background: 'linear-gradient(100deg, var(--red-hi, #ff6b7a), #fff 70%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
          >
            {progress.completed.length + progress.academyDone.length}
          </div>
          <div className="text-[9px] font-black uppercase tracking-widest text-ink-500">Tamamlanan</div>
        </div>
      </button>

      {/* AYAR SEKMELERİ — içerik ve koruma mantığı aynıdır, yalnızca görsel gruplama. */}
      <div
        className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1 hide-scrollbar p-1.5"
        style={{ background: PREMIUM_ROW_BG, borderRadius: PREMIUM_RADIUS, border: `1px solid ${PREMIUM_LINE_SOFT}` }}
        role="tablist"
        aria-label="Ayar sekmeleri"
      >
        {SETTINGS_TABS.map((tab) => {
          const isActive = activeSettingsTab === tab.id;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSettingsTab(tab.id)}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              className={
                isActive
                  ? 'flex items-center gap-1.5 px-3 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm font-bold transition-all duration-300'
                  : 'flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-[var(--r-sm,10px)] whitespace-nowrap text-xs sm:text-sm font-bold text-ink-400 hover:text-ink-200 hover:bg-white/[.05] border border-transparent hover:border-[color:var(--line-2,rgba(244,244,242,.13))] transition-all duration-300'
              }
              style={
                isActive
                  ? {
                      background: PREMIUM_RED_GRAD,
                      borderRadius: 'var(--r-sm, 10px)',
                      color: '#fff',
                      border: '1px solid transparent',
                      boxShadow:
                        '0 6px 22px -8px rgba(232, 56, 79, .55), inset 0 1px 0 rgba(255, 255, 255, .25)',
                    }
                  : undefined
              }
            >
              <TabIcon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeSettingsTab === 'general' && (
        <>
          <CollapsibleSection
            title="Kişisel Kimlik ve Ağ Yönetimi"
            icon={<UserCircle size={18} className="text-emerald-400 flex-shrink-0" />}
            badge={
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Key size={10} /> Sinevia Ağı
              </span>
            }
            defaultOpen={true}
            desc="Ağ üzerinde görünen ismini değiştir veya başka bir cihaza geçtiğinde kimliğini kurtar."
          >
            <div className="space-y-4">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={premiumRowStyle}>
                <div>
                  <label className="block text-xs font-bold text-ink-400 mb-1 uppercase tracking-wider">Ağ İsminiz</label>
                  {editingNickname ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={tempNickname} 
                        onChange={(e) => setTempNickname(e.target.value)}
                        className="bg-ink-900 border border-emerald-500/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none w-48"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveNickname()}
                        disabled={isCheckingName}
                      />
                      <button onClick={handleSaveNickname} disabled={isCheckingName} className={`text-emerald-400 hover:text-emerald-300 p-1 ${isCheckingName ? 'opacity-50' : ''}`}>
                        {isCheckingName ? <span className="animate-spin inline-block w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full" /> : <Check size={18} />}
                      </button>
                      <button onClick={() => { setEditingNickname(false); setTempNickname(data.nickname || ''); }} disabled={isCheckingName} className="text-ink-400 hover:text-ink-200 p-1"><X size={18} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-white">{data.nickname}</span>
                      <button onClick={() => setEditingNickname(true)} className="text-ink-500 hover:text-emerald-400 transition-colors p-1" title="İsmini Değiştir"><Edit2 size={16} /></button>
                    </div>
                  )}
                </div>
            
                <div className="flex flex-col gap-2">
                  <button onClick={() => copyToClipboard(data.agentId || '', 'Ağ Kodun')} className="flex items-center justify-between gap-3 px-3 py-1.5 transition-colors group" style={{ background: PREMIUM_ROW_BG, border: `1px solid ${PREMIUM_LINE}`, borderRadius: PREMIUM_RADIUS_SM }}>
                    <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider">Ağ Kodun:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-emerald-400 text-xs sm:text-sm font-bold">{data.agentId}</span>
                      <Copy size={12} className="text-ink-500 group-hover:text-emerald-400" />
                    </div>
                  </button>
                  <button onClick={() => copyToClipboard(data.recoveryKey || '', 'Kurtarma Anahtarın')} className="flex items-center justify-between gap-3 px-3 py-1.5 transition-colors group" style={{ background: PREMIUM_ROW_BG, border: `1px solid ${PREMIUM_LINE}`, borderRadius: PREMIUM_RADIUS_SM }}>
                    <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider">Kurtarma Anahtarın:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-red-400 text-[10px] sm:text-xs font-bold truncate max-w-[120px] sm:max-w-[150px]">{data.recoveryKey}</span>
                      <Copy size={12} className="text-ink-500 group-hover:text-red-400" />
                    </div>
                  </button>
                  {currentSecretToken && (
                    <button onClick={() => copyToClipboard(currentSecretToken, 'Güvenlik İmzan')} className="flex items-center justify-between gap-3 px-3 py-1.5 transition-colors group" style={{ background: PREMIUM_ROW_BG, border: `1px solid ${PREMIUM_LINE}`, borderRadius: PREMIUM_RADIUS_SM }}>
                      <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider">Güvenlik İmzan:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-amber-400 text-[10px] sm:text-xs font-bold truncate max-w-[120px] sm:max-w-[150px]">{currentSecretToken}</span>
                        <Copy size={12} className="text-ink-500 group-hover:text-amber-400" />
                      </div>
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-[var(--r,16px)] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-white/[.09]" style={{ background: 'linear-gradient(120deg, rgba(232, 56, 79, .12), transparent 80%)' }}>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">Tek Tıkla Cihaz Taşıma Kodu</h4>
                    <p className="text-[11px] text-ink-300 mt-0.5 leading-relaxed">
                      Farklı bir tarayıcıya (ör. Opera) veya cihaza geçerken tüm kimlik ve güvenlik imzanı tek seferde taşımak için bu kodu kopyala.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCopyTransferCode}
                  className={`${BTN_P} flex-shrink-0 px-4 py-2.5 text-xs`}
                  style={BTN_P_STYLE}
                >
                  <Copy size={14} /> Taşıma Kodunu Kopyala
                </button>
              </div>

              <p className="text-xs text-ink-500 italic bg-ink-900/30 p-2 rounded-lg border border-ink-800/50">
                <strong>ÖNEMLİ:</strong> Cihaz değiştirirsen veya verilerini silersen, sosyal ağdaki seviyeni, mesajlarını ve arkadaşlarını geri getirmek için <strong>Cihaz Taşıma Kodun</strong> (veya Ağ Kodun + Kurtarma Anahtarın + Güvenlik İmzan) gerekir. Lütfen güvenli bir yere kaydet!
              </p>

              <div className="mt-2 pt-4 border-t border-ink-800">
                {!isRecoverMode ? (
                  <button onClick={() => setIsRecoverMode(true)} className="flex items-center gap-2 text-xs font-bold text-azure-400 hover:text-azure-300 transition-colors">
                    <Key size={14} /> Başka bir hesabı (Kimliği) bu cihaza kurtar / taşı
                  </button>
                ) : (
                  <div className="bg-azure-950/20 border border-azure-500/30 rounded-xl p-4 space-y-3 animate-fade-in">
                    <h3 className="text-sm font-bold text-azure-400 flex items-center gap-2 mb-2"><Key size={16} /> Kimlik & Cihaz Taşıma Aracı</h3>
                
                    <div className="bg-ink-950/80 border border-emerald-500/30 rounded-lg p-3 mb-3">
                      <label className="block text-[10px] font-black text-emerald-400 mb-1 uppercase tracking-wider">
                        Hızlı Yöntem: Cihaz Taşıma Kodunu Yapıştır (Otomatik Doldurur)
                      </label>
                      <input
                        type="text"
                        value={transferBundleInput}
                        onChange={(e) => handleParseTransferCode(e.target.value)}
                        placeholder="SNV-TRANSFER-... ile başlayan kodu buraya yapıştır"
                        className="w-full px-3 py-2 text-xs font-mono text-emerald-300 outline-none" style={{ background: 'var(--bg-base, #0a0a0d)', border: `1px solid ${PREMIUM_LINE}`, borderRadius: PREMIUM_RADIUS_SM }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-ink-400 mb-1 uppercase tracking-wider">Kayıtlı Ağ Kodu (SNV-..)</label>
                        <input type="text" value={recAgentId} onChange={(e) => setRecAgentId(e.target.value)} placeholder="SNV-XXXX-XXXX" className="w-full px-3 py-2 text-xs font-mono uppercase text-white outline-none" style={{ background: 'var(--bg-base, #0a0a0d)', border: `1px solid ${PREMIUM_LINE}`, borderRadius: PREMIUM_RADIUS_SM }} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-ink-400 mb-1 uppercase tracking-wider">Kayıtlı Ağ İsmin</label>
                        <input type="text" value={recNickname} onChange={(e) => setRecNickname(e.target.value)} placeholder="Eski ismin..." className="w-full px-3 py-2 text-xs text-white outline-none" style={{ background: 'var(--bg-base, #0a0a0d)', border: `1px solid ${PREMIUM_LINE}`, borderRadius: PREMIUM_RADIUS_SM }} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-ink-400 mb-1 uppercase tracking-wider">Gizli Kurtarma Anahtarı</label>
                        <input type="password" value={recKey} onChange={(e) => setRecKey(e.target.value)} placeholder="Kurtarma anahtarın..." className="w-full px-3 py-2 text-xs font-mono text-white outline-none" style={{ background: 'var(--bg-base, #0a0a0d)', border: `1px solid ${PREMIUM_LINE}`, borderRadius: PREMIUM_RADIUS_SM }} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-amber-400/90 mb-1 uppercase tracking-wider">Güvenlik İmzan (sec_...)</label>
                        <input type="password" value={recSecretToken} onChange={(e) => setRecSecretToken(e.target.value)} placeholder="Mesaj/Profil yetkisi için (sec_...)" className="w-full px-3 py-2 text-xs font-mono text-white outline-none" style={{ background: 'var(--bg-base, #0a0a0d)', border: `1px solid ${PREMIUM_LINE}`, borderRadius: PREMIUM_RADIUS_SM }} />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={handleRecoverIdentity} className={`${BTN_P} flex-1 py-2 text-xs`} style={BTN_P_STYLE}>Kimliği Kurtar & Eşitle</button>
                      <button onClick={() => setIsRecoverMode(false)} className={`${BTN_S} flex-1 py-2 text-xs text-ink-200`} style={BTN_S_STYLE}>İptal</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Tür Yönetimi"
            icon={<Tag size={18} className="text-gold-400 flex-shrink-0" />}
            defaultOpen={false}
            desc="Film ve dizi eklerken seçilecek türleri ekle veya sil."
          >
            <div className="flex gap-2 mb-3.5">
              <input
                type="text"
                value={newGenre}
                onChange={(e) => setNewGenre(e.target.value)}
                placeholder="Yeni tür adı..."
                className="flex-1 bg-ink-800/80 border border-ink-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleAddGenre()}
              />
              <button onClick={handleAddGenre} disabled={!newGenre.trim()} className={`${BTN_P} px-3.5 py-2 text-xs sm:text-sm`} style={BTN_P_STYLE}>
                <Plus size={16} /> Ekle
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {data.genres.map((g) => (
                <div key={g} className="flex items-center gap-1.5 bg-ink-800 border border-ink-700 rounded-full pl-3 pr-2 py-1 hover:border-gold-500/50 transition-colors">
                  {editingGenre === g ? (
                    <>
                      <input
                        type="text"
                        value={editGenreName}
                        onChange={(e) => setEditGenreName(e.target.value)}
                        className="bg-ink-950 border border-gold-500 rounded px-1.5 py-0.5 text-xs sm:text-sm text-ink-100 focus:outline-none w-24"
                        onKeyDown={(e) => { if (e.key === 'Enter' && editGenreName.trim()) { renameGenre(g, editGenreName); setEditingGenre(null); } }}
                      />
                      <button onClick={() => { if (editGenreName.trim()) { renameGenre(g, editGenreName); setEditingGenre(null); } }} className="text-green-400 hover:text-green-300 transition-colors"><Check size={13} /></button>
                      <button onClick={() => setEditingGenre(null)} className="text-ink-400 hover:text-ink-200 transition-colors"><X size={13} /></button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs sm:text-sm text-ink-200">{g}</span>
                      <button onClick={() => { setEditingGenre(g); setEditGenreName(g); }} className="text-ink-400 hover:text-gold-400 transition-colors"><Edit2 size={12} /></button>
                      <button onClick={() => setDeleteGenreTarget(g)} className="text-ink-400 hover:text-red-400 transition-colors"><X size={13} /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Koleksiyon Yönetimi"
            icon={<Boxes size={18} className="text-azure-400 flex-shrink-0" />}
            defaultOpen={false}
            desc="Koleksiyonların (evren/seri) adını düzenle veya sil."
          >
            <div className="flex gap-2 mb-3.5">
              <input
                type="text"
                value={newCollection}
                onChange={(e) => setNewCollection(e.target.value)}
                placeholder="Yeni koleksiyon adı..."
                className="flex-1 bg-ink-800/80 border border-ink-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-azure-500/50 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCollection()}
              />
              <button onClick={handleAddCollection} disabled={!newCollection.trim()} className={`${BTN_P} px-3.5 py-2 text-xs sm:text-sm`} style={BTN_P_STYLE}>
                <Plus size={16} /> Ekle
              </button>
            </div>

            {data.collections.length === 0 ? (
              <p className="text-sm text-ink-500">Henüz koleksiyon yok.</p>
            ) : (
              <div className="space-y-2">
                {data.collections.map((c) => {
                  const movieCount = data.movies.filter((m) => m.collectionId === c.id).length;
                  return (
                    <div key={c.id} className="flex items-center gap-2 bg-ink-800/80 border border-ink-700 rounded-xl px-3 py-2.5 hover:border-azure-500/50 transition-colors">
                      {editingColl === c.id ? (
                        <>
                          <input
                            type="text"
                            value={editCollName}
                            onChange={(e) => setEditCollName(e.target.value)}
                            className="flex-1 bg-ink-950 border border-ink-600 rounded-lg px-2.5 py-1 text-xs sm:text-sm text-ink-100 focus:outline-none"
                            onKeyDown={(e) => { if (e.key === 'Enter') { renameCollection(c.id, editCollName); setEditingColl(null); } }}
                          />
                          <button onClick={() => { renameCollection(c.id, editCollName); setEditingColl(null); }} className="text-green-400 hover:text-green-300 transition-colors"><Check size={16} /></button>
                          <button onClick={() => setEditingColl(null)} className="text-ink-400 hover:text-ink-200 transition-colors"><X size={16} /></button>
                        </>
                      ) : (
                        <>
                          <Boxes size={15} className="text-azure-400 flex-shrink-0" />
                          <span className="flex-1 text-xs sm:text-sm font-medium text-ink-200 truncate">{c.name}</span>
                          <span className="text-[11px] text-ink-400 flex-shrink-0">{movieCount} film</span>
                          <button onClick={() => { setEditingColl(c.id); setEditCollName(c.name); }} className="text-ink-400 hover:text-ink-200 transition-colors p-1"><Edit2 size={14} /></button>
                          <button
                            onClick={() => {
                              if (confirmDeleteColl === c.id) { deleteCollection(c.id); setConfirmDeleteColl(null); }
                              else { setConfirmDeleteColl(c.id); setTimeout(() => setConfirmDeleteColl(null), 2000); }
                            }}
                            className="text-ink-400 hover:text-red-400 transition-colors p-1"
                          >
                            {confirmDeleteColl === c.id ? <span className="text-[11px] font-bold text-red-400">Sil?</span> : <Trash2 size={14} />}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Alternatif İzleme Kaynağı"
            icon={<PlayCircle size={18} className="text-azure-400 flex-shrink-0" />}
            defaultOpen={false}
            desc="Uygulama içinde filmleri alternatif sunuculardan izlemek istiyorsan bir şablon belirle."
          >
            <div className="text-xs p-3 bg-ink-950 rounded-xl border border-ink-800 space-y-2 mb-3.5">
              <div className="leading-relaxed">
                <span className="font-bold text-ink-300 block mb-1">Parametreler:</span>
                <span className="text-gold-400 font-mono">{'{imdb}'}</span> : IMDB Kodu |{' '}
                <span className="text-gold-400 font-mono">{'{title}'}</span> : Film Adı |{' '}
                <span className="text-gold-400 font-mono">{'{year}'}</span> : Yıl
              </div>
              <div className="pt-2 border-t border-ink-800">
                <span className="text-emerald-400 font-bold block mb-1">Otomatik İlk Sonuca Gitme Örneği:</span>
                <code className="text-[11px] text-azure-300 bg-ink-900 px-2.5 py-1.5 rounded-lg block select-all border border-ink-800 overflow-x-auto whitespace-nowrap">
                  https://duckduckgo.com/?q=\site:hdfilmcehennemi.nl+{'{title}'}+{'{year}'}
                </code>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={altTemplate}
                onChange={(e) => setAltTemplate(e.target.value)}
                placeholder="Örn: https://duckduckgo.com/?q=\site:hdfilmcehennemi.nl+{title}+{year}"
                className="flex-1 bg-ink-800/80 border border-ink-700 rounded-xl px-3.5 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 transition-all text-xs sm:text-sm font-mono"
              />
              <button
                onClick={() => updateAltWatchTemplate(altTemplate)}
                className={`${BTN_P} px-4 py-2.5 text-xs sm:text-sm`}
                style={BTN_P_STYLE}
              >
                <Check size={16} /> Kaydet
              </button>
            </div>
          </CollapsibleSection>

          {/* --- KRTİK İŞLEMLER BÖLÜMÜ (EN ALTA ALINDI) --- */}
          <CollapsibleSection
            title="Tam Yedekle / Geri Yükle"
            icon={<Download size={18} className="text-emerald-400 flex-shrink-0" />}
            defaultOpen={false}
            desc="Tüm kişisel verilerini (geçmiş, puanlar ve başarımlar dahil) çevrimdışı JSON dosyası olarak bilgisayarına indir."
          >
            <div className="grid grid-cols-2 sm:flex gap-2.5">
              <button
                onClick={() => {
                  exportData();
                  // Akademi dersi: "Verini Yedekle"
                  notifyEvent('backup_created');
                }}
                className={`${BTN_P} px-4 py-2.5 text-xs sm:text-sm`}
                style={BTN_P_STYLE}
              >
                <Download size={16} /> Yedek Al
              </button>
              <button onClick={() => fileRef.current?.click()} className={`${BTN_S} px-4 py-2.5 text-xs sm:text-sm text-ink-200`} style={BTN_S_STYLE}>
                <Upload size={16} /> Geri Yükle
              </button>
              <input ref={fileRef} type="file" accept="application/json" onChange={handleFileImport} className="hidden" />
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Hesap ve Cihaz Yönetimi"
            icon={<AlertTriangle size={18} className="text-red-400 flex-shrink-0" />}
            defaultOpen={false}
            desc="Bu cihazdaki bağlantıyı kesebilir veya hesabını buluttan tamamen silebilirsin."
          >
            <div className="space-y-4">
              {/* Çıkış Yap (Sadece Yerel Silme) */}
              <div className="bg-ink-950/50 border border-ink-800 hover:border-amber-500/50 transition-colors rounded-2xl p-4 sm:p-5">
                <h3 className="text-sm sm:text-base font-bold text-amber-400 mb-1.5 flex items-center gap-2">
                  <LogOut size={18} /> Bu Cihazdan Çıkış Yap
                </h3>
                <p className="text-xs sm:text-sm text-ink-400 mb-4 leading-relaxed">
                  Sadece bu tarayıcıdaki verileri temizler ve seni yeni bir "Sıfır" hesaba geçirir. 
                  Buluttaki asıl hesabın (veya Chrome'daki verilerin) <strong>asla zarar görmez.</strong> İstediğin zaman Taşıma Kodu ile geri dönebilirsin.
                </p>
                <button 
                  onClick={() => setShowLogoutModal(true)} 
                  className={`${BTN_S} w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm tracking-wider`}
                  style={{ ...BTN_S_STYLE, color: '#fbbf24', border: '1px solid rgba(251, 191, 36, .45)' }}
                >
                  Cihazdan Çıkış Yap
                </button>
              </div>

              {/* Tamamen Sıfırla (Buluttan Silme) */}
              <div className="bg-red-950/20 border border-red-800/40 rounded-2xl p-4 sm:p-5 transition-all">
                <h3 className="text-sm sm:text-base font-bold text-red-400 mb-1.5 flex items-center gap-2">
                  <Trash2 size={18} /> Hesabı Kalıcı Olarak Yok Et
                </h3>
                <p className="text-xs sm:text-sm text-red-400/70 mb-4 leading-relaxed">
                  Tüm kütüphanen, başarımların ve Ağ Kimliğin buluttan <strong>tamamen</strong> silinir. 
                  Bu işlemi diğer cihazlarından (Örn: Chrome) da geri alamazsın. Sinevia tamamen sıfırlanır.
                </p>

                {confirmResetStage === 0 ? (
                  <button 
                    onClick={() => setConfirmResetStage(1)} 
                    className={`${BTN_S} w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm tracking-wider`}
                    style={{ ...BTN_S_STYLE, color: '#f87171', border: '1px solid rgba(248, 113, 113, .45)', background: 'rgba(248, 113, 113, .08)' }}
                  >
                    <Trash2 size={16} /> Hesabı Tamamen Yok Et
                  </button>
                ) : (
                  <div className="flex items-center gap-2.5 flex-wrap p-3 rounded-[var(--r,16px)] bg-red-950/40 border border-red-800/60 animate-fade-in">
                    <span className="text-xs sm:text-sm text-red-400 font-bold w-full sm:w-auto mb-1 sm:mb-0">Emin misin? Bu işlemin geri dönüşü yok!</span>
                    <button onClick={() => setShowResetModal(true)} className={`${BTN_P} flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm`} style={BTN_P_STYLE}>
                      <AlertTriangle size={14} /> Evet, Eminim (Buluttan Sil)
                    </button>
                    <button onClick={() => setConfirmResetStage(0)} className={`${BTN_S} flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm text-ink-200`} style={BTN_S_STYLE}>
                      <X size={14} /> İptal Et
                    </button>
                  </div>
                )}
              </div>
            </div>
          </CollapsibleSection>

        </>
      )}

      {activeSettingsTab === 'visual' && (
        <>
          <CollapsibleSection
            title="Görsel Atmosfer & Tema"
            icon={<Palette size={18} className="text-gold-400 flex-shrink-0" />}
            badge={
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-gold-500/20 text-gold-400 border border-gold-500/30 flex items-center gap-1 flex-shrink-0">
                <Sparkles size={10} /> Tam Dönüşüm
              </span>
            }
            desc="Seçtiğin tema arka planları, kartları, tüm buton renklerini ve ışık efektlerini anında dönüştürür."
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
              {THEMES.map((theme) => {
                const isSelected = (data.theme || 'default') === theme.id;
                const ThemeIcon = theme.icon;
                return (
                  <button
                    key={theme.id}
                    onClick={() => updateTheme(theme.id)}
                    className={`relative flex flex-col justify-between p-3 sm:p-4 rounded-2xl border text-left transition-all duration-300 overflow-hidden group ${
                      isSelected ? 'border-gold-500 ring-2 ring-gold-500/30 scale-[1.02] shadow-2xl' : 'border-ink-700/60 hover:border-ink-500'
                    }`}
                    style={{ backgroundColor: theme.previewBg }}
                  >
                    <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity" style={{ backgroundColor: theme.colors[0] }} />
                    <div className="absolute top-1/2 -left-8 w-20 h-20 rounded-full blur-2xl opacity-30 group-hover:opacity-60 transition-opacity" style={{ backgroundColor: theme.colors[1] }} />
                    <div className="absolute -bottom-8 right-10 w-24 h-24 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity" style={{ backgroundColor: theme.colors[2] }} />

                    <div className="relative z-10 flex items-center justify-between w-full mb-4 sm:mb-6">
                      <div className="flex items-center -space-x-1.5 sm:-space-x-2">
                        {theme.colors.map((color, i) => (
                          <span key={i} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-black/40 shadow-sm" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                      <ThemeIcon size={16} color={theme.colors[0]} className="opacity-80" />
                    </div>

                    <div className="relative z-10">
                      <div className={`font-black text-xs sm:text-sm tracking-wide truncate ${theme.textMode === 'light' ? 'text-slate-900' : 'text-white'}`}>{theme.name}</div>
                      <div className={`text-[10px] sm:text-[11px] font-medium mt-0.5 truncate ${theme.textMode === 'light' ? 'text-slate-600' : 'text-zinc-400'}`}>{theme.desc}</div>
                    </div>

                    {isSelected && <div className="absolute inset-0 border-2 border-gold-500 rounded-2xl pointer-events-none" />}
                  </button>
                );
              })}
            </div>
          </CollapsibleSection>

        </>
      )}

      {activeSettingsTab === 'notifications' && (
        <>
          <CollapsibleSection
            title="Akıllı Cihaz Bildirimleri"
            icon={data.notificationsEnabled ? <BellRing size={18} className="text-emerald-400 flex-shrink-0 animate-pulse" /> : <BellOff size={18} className="text-ink-500 flex-shrink-0" />}
            badge={
              data.notificationsEnabled && (
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 flex-shrink-0">
                  Aktif
                </span>
              )
            }
            desc="Film saatleri, canlı izleme sayaçları ve Sinevia Ağı'ndaki tüm mesaj ve arkadaşlık bildirimleri."
          >
            <div className="p-4 sm:p-5" style={premiumRowStyle}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Cihaz Bildirimleri (Push API)</h3>
                  <p className="text-xs text-ink-400">Tarayıcının sana bilgisayarında/telefonunda bildirim göndermesine izin ver.</p>
                </div>
                <button
                  onClick={async () => {
                    if (data.notificationsEnabled) {
                      toggleNotifications(false);
                      showToast('Ana bildirim sistemi kapatıldı.', 'info');
                    } else {
                      if (!('Notification' in window)) {
                        showToast('Kullandığınız tarayıcı bildirimleri desteklemiyor.', 'error');
                        return;
                      }
                      const perm = await Notification.requestPermission();
                      if (perm === 'granted') {
                        toggleNotifications(true);
                        showToast('Harika! Bildirim izni alındı.', 'success');
                      } else {
                        showToast('Bildirim izni reddedildi. Tarayıcı ayarlarından izin vermelisin.', 'warning');
                      }
                    }
                  }}
                  role="switch"
                  aria-checked={data.notificationsEnabled}
                  aria-label="Cihaz bildirimleri"
                  className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--red-hi,#ff6b7a)] focus-visible:ring-offset-2"
                  style={switchTrackStyle(!!data.notificationsEnabled)}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full transition duration-300 ease-in-out ${data.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                    style={SWITCH_KNOB_STYLE}
                  />
                </button>
              </div>

              {data.notificationsEnabled && (
                <div className="mt-4 pt-4 border-t border-ink-800 space-y-3">
                  <h4 className="text-[10px] font-black text-ink-500 uppercase tracking-widest mb-3">Sosyal Ağ Bildirim Tercihleri</h4>
              
                  <div className="flex items-center justify-between p-2.5 bg-white/[.03] rounded-[var(--r-sm,10px)] border border-white/[.07]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-azure-500/10 text-azure-400 flex items-center justify-center"><MessageSquare size={13} /></div>
                      <div>
                        <span className="text-xs font-bold text-white block">Sohbet Mesajları</span>
                        <span className="text-[9px] text-ink-500 font-medium">Biri sana mesaj attığında</span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleSpecificNotification('notifyMessages', data.notifyMessages === false ? true : false)}
                      role="switch"
                      aria-checked={data.notifyMessages !== false}
                      aria-label="Sohbet mesajı bildirimleri"
                      className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-all duration-300 ease-in-out"
                      style={switchTrackStyle(data.notifyMessages !== false)}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full transition duration-300 ease-in-out ${data.notifyMessages !== false ? 'translate-x-4' : 'translate-x-0'}`}
                        style={SWITCH_KNOB_STYLE}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white/[.03] rounded-[var(--r-sm,10px)] border border-white/[.07]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center"><UserPlus size={13} /></div>
                      <div>
                        <span className="text-xs font-bold text-white block">Arkadaşlık İstekleri</span>
                        <span className="text-[9px] text-ink-500 font-medium">Ağına katılmak istediklerinde</span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleSpecificNotification('notifyFriendRequests', data.notifyFriendRequests === false ? true : false)}
                      role="switch"
                      aria-checked={data.notifyFriendRequests !== false}
                      aria-label="Arkadaşlık isteği bildirimleri"
                      className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-all duration-300 ease-in-out"
                      style={switchTrackStyle(data.notifyFriendRequests !== false)}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full transition duration-300 ease-in-out ${data.notifyFriendRequests !== false ? 'translate-x-4' : 'translate-x-0'}`}
                        style={SWITCH_KNOB_STYLE}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white/[.03] rounded-[var(--r-sm,10px)] border border-white/[.07]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center"><Gift size={13} /></div>
                      <div>
                        <span className="text-xs font-bold text-white block">Gelen Listeler</span>
                        <span className="text-[9px] text-ink-500 font-medium">Sana tavsiye gönderildiğinde</span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleSpecificNotification('notifyLists', data.notifyLists === false ? true : false)}
                      role="switch"
                      aria-checked={data.notifyLists !== false}
                      aria-label="Gelen liste bildirimleri"
                      className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-all duration-300 ease-in-out"
                      style={switchTrackStyle(data.notifyLists !== false)}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full transition duration-300 ease-in-out ${data.notifyLists !== false ? 'translate-x-4' : 'translate-x-0'}`}
                        style={SWITCH_KNOB_STYLE}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Ses Efektleri"
            icon={soundOn ? <Volume2 size={18} className="text-azure-400 flex-shrink-0" /> : <VolumeX size={18} className="text-ink-500 flex-shrink-0" />}
            badge={
              soundOn && (
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-azure-500/20 text-azure-400 border border-azure-500/30 flex items-center gap-1 flex-shrink-0">
                  Açık
                </span>
              )
            }
            desc="Seviye atlama, başarım ve görev tamamlama seslerini açıp kapat."
          >
            <div className="p-4 sm:p-5 flex items-center justify-between gap-4" style={premiumRowStyle}>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Ses Efektleri</h3>
                <p className="text-xs text-ink-400">Başarım, seviye atlama ve görev müziği gibi kısa efektler.</p>
              </div>
              <button
                onClick={handleToggleSound}
                aria-pressed={soundOn}
                role="switch"
                aria-label="Ses efektleri"
                className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--red-hi,#ff6b7a)] focus-visible:ring-offset-2"
                style={switchTrackStyle(soundOn)}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full transition duration-300 ease-in-out ${soundOn ? 'translate-x-5' : 'translate-x-0'}`}
                  style={SWITCH_KNOB_STYLE}
                />
              </button>
            </div>
          </CollapsibleSection>

        </>
      )}

      {activeSettingsTab === 'shortcuts' && (
        <ShortcutsPanel />
      )}

      {activeSettingsTab === 'game' && (
        <>
          <CollapsibleSection
            title="Puanlama Kriterleri"
            icon={<SlidersHorizontal size={18} className="text-gold-400 flex-shrink-0" />}
            defaultOpen={false}
            desc="Detaylı puanlama sisteminde kullanılacak alt kırılımları ve ağırlıklarını (1-10) belirle."
          >
            <div className="flex items-start sm:items-center justify-between gap-2 mb-4">
              <div className="hidden sm:block" />
              <button
                onClick={() => (isAddingCrit ? resetCritForm() : setIsAddingCrit(true))}
                className={`${isAddingCrit ? BTN_S : BTN_P} flex-shrink-0 px-3 py-2 text-xs`}
                style={isAddingCrit ? { ...BTN_S_STYLE, color: 'var(--text-main, #f4f4f2)' } : BTN_P_STYLE}
              >
                {isAddingCrit ? <X size={15} /> : <Plus size={15} />}
                <span>{isAddingCrit ? 'İptal' : 'Yeni Kriter'}</span>
              </button>
            </div>

            {isAddingCrit && (
              <div className="mb-5 p-3.5 sm:p-4 space-y-4 animate-fade-in" style={premiumRowStyle}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-ink-400 mb-1.5 uppercase tracking-wider">Kriter Adı</label>
                    <input
                      type="text"
                      value={critName}
                      onChange={(e) => setCritName(e.target.value)}
                      placeholder="Örn: Senaryo, Müzik, Atmosfer..."
                      className="w-full px-3 py-2 text-xs sm:text-sm text-white focus:border-gold-500/50 outline-none"
                      style={{ background: 'var(--bg-base, #0a0a0d)', border: `1px solid ${PREMIUM_LINE}`, borderRadius: PREMIUM_RADIUS }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-400 mb-1.5 uppercase tracking-wider flex justify-between">
                      <span>Etki Ağırlığı</span>
                      <span className="text-gold-400">{critWeight} / 10</span>
                    </label>
                    <input type="range" min="1" max="10" value={critWeight} onChange={(e) => setCritWeight(Number(e.target.value))} className="w-full mt-2 accent-gold-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-400 mb-1.5 uppercase tracking-wider">Geçerli Olduğu Tip</label>
                    <div className="flex p-1" style={{ background: 'var(--bg-base, #0a0a0d)', border: `1px solid ${PREMIUM_LINE}`, borderRadius: PREMIUM_RADIUS }}>
                      <button onClick={() => setCritAppliesTo('both')} className={`flex-1 text-xs py-1.5 rounded-[var(--r-sm,10px)] font-bold transition-all ${critAppliesTo === 'both' ? 'bg-white/10 text-white' : 'text-ink-500 hover:text-ink-300'}`}>Tümü</button>
                      <button onClick={() => setCritAppliesTo('movie')} className={`flex-1 text-xs py-1.5 rounded-[var(--r-sm,10px)] font-bold transition-all ${critAppliesTo === 'movie' ? 'bg-white/10 text-white' : 'text-ink-500 hover:text-ink-300'}`}>Film</button>
                      <button onClick={() => setCritAppliesTo('series')} className={`flex-1 text-xs py-1.5 rounded-[var(--r-sm,10px)] font-bold transition-all ${critAppliesTo === 'series' ? 'bg-white/10 text-white' : 'text-ink-500 hover:text-ink-300'}`}>Dizi</button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink-400 mb-1.5 uppercase tracking-wider">
                    Özel Tür Filtresi <span className="text-[10px] text-ink-500 font-normal lowercase">(Boş bırakırsan her türde çıkar)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {data.genres.map((g) => (
                      <button
                        key={g}
                        onClick={() => toggleCritGenre(g)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                          critGenres.includes(g) ? 'bg-gold-500/20 text-gold-300 border-gold-500/40' : 'text-ink-500 border-ink-800 hover:border-ink-600'
                        }`}
                        style={{ background: critGenres.includes(g) ? 'var(--blob-1, rgba(245, 158, 11, 0.15))' : 'var(--bg-base, #0a0a0d)' }}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleSaveCriterion} disabled={!critName.trim()} className={`${BTN_P} w-full py-2.5 text-xs sm:text-sm`} style={BTN_P_STYLE}>
                  {editingCritId ? 'Kriteri Güncelle' : 'Kriteri Kaydet'}
                </button>
              </div>
            )}

            {!data.criteria || data.criteria.length === 0 ? (
              <p className="text-sm text-ink-500">Henüz hiçbir kriter eklenmedi.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {data.criteria.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-[var(--r-sm,10px)] p-3 flex flex-col gap-2 transition-all"
                    style={{
                      background: editingCritId === c.id ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.03)',
                      border: `1px solid ${editingCritId === c.id ? 'rgba(255,255,255,.22)' : PREMIUM_LINE_SOFT}`,
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-white">{c.name}</h4>
                        <div className="text-[10px] text-ink-400 mt-1 flex gap-1.5">
                          <span className="px-1.5 py-0.5 rounded border font-bold text-gold-400" style={{ background: 'var(--bg-base, #0a0a0d)', borderColor: PREMIUM_LINE }}>Ağırlık: {c.weight}</span>
                          <span className="px-1.5 py-0.5 rounded border" style={{ background: 'var(--bg-base, #0a0a0d)', borderColor: PREMIUM_LINE }}>{c.appliesTo === 'both' ? 'Film + Dizi' : c.appliesTo === 'movie' ? 'Sadece Film' : 'Sadece Dizi'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEditCrit(c)} className="p-1.5 text-ink-400 hover:text-gold-400 transition-all" style={{ background: 'var(--bg-base, #0a0a0d)', border: `1px solid ${PREMIUM_LINE}`, borderRadius: PREMIUM_RADIUS }}><Edit2 size={13} /></button>
                        <button onClick={() => setDeleteCritTarget(c.id)} className="p-1.5 text-ink-400 hover:text-red-400 transition-all" style={{ background: 'var(--bg-base, #0a0a0d)', border: `1px solid ${PREMIUM_LINE}`, borderRadius: PREMIUM_RADIUS }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {c.genres.length > 0 && <div className="text-[10px] text-ink-400 truncate mt-0.5">Sadece: {c.genres.join(', ')}</div>}
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Değerlendirme Başlıkları"
            icon={<Award size={18} className="text-gold-400 flex-shrink-0" />}
            desc="Puanlama sırasında seçebileceğin hızlı değerlendirme rozetlerini ekle, düzenle veya sil."
          >
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="flex p-1 flex-shrink-0" style={{ background: 'var(--bg-base, #0a0a0d)', border: `1px solid ${PREMIUM_LINE}`, borderRadius: PREMIUM_RADIUS }}>
                <button onClick={() => setNewTagSentiment('positive')} className={`flex items-center gap-1 text-xs py-1.5 px-3 rounded-[var(--r-sm,10px)] font-bold transition-all ${newTagSentiment === 'positive' ? 'bg-emerald-500/20 text-emerald-400' : 'text-ink-500 hover:text-ink-300'}`}>
                  <ThumbsUp size={13} /> Övgü
                </button>
                <button onClick={() => setNewTagSentiment('negative')} className={`flex items-center gap-1 text-xs py-1.5 px-3 rounded-[var(--r-sm,10px)] font-bold transition-all ${newTagSentiment === 'negative' ? 'bg-red-500/20 text-red-400' : 'text-ink-500 hover:text-ink-300'}`}>
                  <ThumbsDown size={13} /> Eleştiri
                </button>
              </div>
              <input
                type="text"
                value={newReviewTag}
                onChange={(e) => setNewReviewTag(e.target.value)}
                placeholder="Yeni başlık adı..."
                className="flex-1 px-3.5 py-2 text-xs sm:text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 transition-all"
                style={{ background: 'var(--bg-base, #0a0a0d)', border: `1px solid ${PREMIUM_LINE}`, borderRadius: PREMIUM_RADIUS }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddReviewTag()}
              />
              <button onClick={handleAddReviewTag} disabled={!newReviewTag.trim()} className={`${BTN_P} px-3.5 py-2 text-xs sm:text-sm`} style={BTN_P_STYLE}>
                <Plus size={16} /> Ekle
              </button>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <ThumbsUp size={14} className="text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Övgü Yorumları</span>
                <span className="text-[10px] text-ink-500 font-mono">{positiveTags.length}</span>
              </div>
              {positiveTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {positiveTags.map(renderTagChip)}
                </div>
              ) : (
                <p className="text-xs text-ink-500 italic">Henüz övgü başlığı yok.</p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <ThumbsDown size={14} className="text-red-400" />
                <span className="text-xs font-black uppercase tracking-wider text-red-400">Eleştiriler</span>
                <span className="text-[10px] text-ink-500 font-mono">{negativeTags.length}</span>
              </div>
              {negativeTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {negativeTags.map(renderTagChip)}
                </div>
              ) : (
                <p className="text-xs text-ink-500 italic">Henüz eleştiri başlığı yok.</p>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Geliştirici / Test Ayarları"
            icon={<Wrench size={18} className="text-gold-400 flex-shrink-0" />}
            defaultOpen={false}
            desc="Henüz kazanılmamış (kilitli) başarımların isimlerini '???' yerine açıkça gösterir."
          >
            <button
              onClick={toggleLockedNames}
              className={`${data.showLockedNames ? BTN_P : BTN_S} w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm`}
              style={data.showLockedNames ? BTN_P_STYLE : { ...BTN_S_STYLE, color: 'var(--text-main, #f4f4f2)' }}
            >
              {data.showLockedNames ? 'Görünürlüğü Kapat (Normal Mod)' : 'Kilitli İsimleri Göster (Test Modu)'}
            </button>
          </CollapsibleSection>

        </>
      )}

      {/* MODALLAR */}

      {deleteCritTarget && (
        <ConfirmDialog
          title="Kriteri Sil"
          message="Bu kriteri silmek istediğine emin misin? Önceki yapıtlara verdiğin detaylı puanlar geçmişte kalır ancak yeni puanlamalarda bu kriteri kullanamazsın."
          onConfirm={() => { deleteCriterion(deleteCritTarget); setDeleteCritTarget(null); }}
          onCancel={() => setDeleteCritTarget(null)}
        />
      )}

      {deleteReviewTagTarget && (
        <ConfirmDialog
          title="Değerlendirme Başlığını Sil"
          message={`"${deleteReviewTagTarget}" başlığı seçim listesinden kaldırılacak. Emin misin?`}
          onConfirm={() => { deleteReviewTag(deleteReviewTagTarget); setDeleteReviewTagTarget(null); }}
          onCancel={() => setDeleteReviewTagTarget(null)}
        />
      )}

      {showLogoutModal && (
        <ConfirmDialog
          title="Cihazdan Çıkış Yap"
          message="Bu cihazdaki hesabın (kimliğin) kapatılacak ve Sinevia sıfırlanacaktır. Taşıma Kodunu bir yere kaydettiğinden emin misin? Buluttaki verilerin silinmeyecek."
          onConfirm={handleDisconnectDevice}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}

      {showResetModal && (
        <ConfirmDialog
          title="SON UYARI! HER ŞEY SİLİNECEK!"
          message="Kullanıcı kimliğin, ağ ismin, kurtarma anahtarın dahil tüm verilerin tamamen silinecek. Sinevia sanki cihaza yeni kurulmuş gibi sıfırdan başlayacak. Onaylıyor musun?"
          onConfirm={handleExecuteFullReset}
          onCancel={() => { setShowResetModal(false); setConfirmResetStage(0); }}
        />
      )}

      {shareImportJson && (
        <ShareImportModal rawJson={shareImportJson} onClose={() => setShareImportJson(null)} />
      )}

    </div>
  );
}