import React, { useState, useEffect, useRef } from 'react';
import {
  Film, Tv, History, Trophy, Settings, BarChart3, Bot,
  Menu, X, LayoutDashboard, Sparkles, CalendarClock, Users,
  Cloud, CloudOff, RefreshCw, Search, Plus
} from 'lucide-react';
import WrappedModal from './WrappedModal';
import AddMovieModal from './AddMovieModal';
import AddSeriesModal from './AddSeriesModal';
import { useApp } from '../context/AppContext';
import { useTutorial } from '../context/TutorialContext';
import Sini from '../tutorial/Sini';
import { levelFromXp } from '../lib/xp';
import { describeCombo, focusPageSearch, loadBindings } from '../lib/shortcuts';

export type TabId = 'home' | 'movies' | 'series' | 'network' | 'plan' | 'history' | 'achievements' | 'stats' | 'ai' | 'settings';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

// ---------------------------------------------------------------------------
// PREMIUM KABUK STİLLERİ (kaynak: sinevia-premium.html)
// Tüm vurgular tema değişkenleri (var(--color-1/2), var(--bg-*), var(--border-dim))
// üzerinden çalışır; 12 mevcut tema + premium-dark/plain-dark bozulmaz.
// Burada SADECE stil tanımlanır — nav yapısı ve işlevsellik aynıdır.
// ---------------------------------------------------------------------------
const GLASS_SHEEN =
  'linear-gradient(155deg, rgba(255,255,255,.055), rgba(255,255,255,.018) 55%, rgba(255,255,255,.03))';

/** Cam yüzey: tema zemin rengi + premium ışık süpürmesi. */
const glassSurface: React.CSSProperties = { backgroundImage: GLASS_SHEEN };

/** Aktif nav pill: vurgu renginin yumuşak gradyanı + kenar + ışıklı gölge. */
const activePillStyle: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(120deg, color-mix(in srgb, var(--color-1) 28%, transparent), color-mix(in srgb, var(--color-1) 8%, transparent))',
  borderColor: 'color-mix(in srgb, var(--color-1) 45%, transparent)',
  boxShadow:
    '0 6px 22px -8px color-mix(in srgb, var(--color-1) 55%, transparent), inset 0 1px 0 rgba(255,255,255,.14)',
};

/** Logodaki "VIA" gibi aksiyon metni: tema vurgu gradyanı + clip-text. */
const accentTextStyle: React.CSSProperties = {
  backgroundImage: 'linear-gradient(135deg, var(--color-2), var(--color-1))',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

/** Premium btn-p: açık vurgu → vurgu → koyu vurgu (red-hi/red/red-deep düzeni). */
const btnPrimaryStyle: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(150deg, color-mix(in srgb, var(--color-2) 80%, white), var(--color-1) 45%, color-mix(in srgb, var(--color-1) 55%, black))',
  boxShadow:
    '0 10px 28px -10px color-mix(in srgb, var(--color-1) 75%, transparent), inset 0 1px 0 rgba(255,255,255,.35), inset 0 -2px 6px rgba(0,0,0,.25)',
};

/** Premium btn-s: cam ikincil buton. */
const btnSecondaryStyle: React.CSSProperties = {
  backgroundImage: 'linear-gradient(150deg, rgba(255,255,255,.14), rgba(255,255,255,.05))',
  borderColor: 'rgba(255,255,255,.16)',
  boxShadow: '0 8px 22px -12px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.16)',
};

/** Topbar: blur(20px) yarı saydam zemin. */
const topbarStyle: React.CSSProperties = {
  backgroundColor: 'color-mix(in srgb, var(--bg-base) 72%, transparent)',
  boxShadow: '0 18px 44px -26px rgba(0,0,0,.9)',
};

/** Topbar altındaki kırmızı (tema vurgulu) gradyan saç teli. */
const TOPBAR_HAIRLINE =
  'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-1) 55%, transparent) 30%, color-mix(in srgb, var(--color-2) 35%, transparent) 60%, transparent)';

/** Buton üzerinde hover'da geçen parlak süpürme (premium shine). */
function ButtonShimmer() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 -left-[80%] w-[55%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/35 to-transparent transition-all duration-500 group-hover:left-[130%]"
    />
  );
}

/** Aktif nav öğesinin solundaki ince ışıklı çizgi. */
function ActiveRail() {
  return (
    <span
      aria-hidden
      className="absolute -left-3 top-[22%] bottom-[22%] w-[3px] rounded-full"
      style={{ background: 'var(--color-1)', boxShadow: '0 0 12px var(--color-1)' }}
    />
  );
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  // AppContext'ten (veya ilgili yerden) syncStatus durumunu çekiyoruz. 
  // Sen Context'e ekleyene kadar hata vermemesi için fallback atadık.
  const appCtx = useApp() as any;
  const syncStatus: 'syncing' | 'synced' | 'error' = appCtx.syncStatus || 'synced';

  // Premium profil kartı / topbar karşılama satırı için gerçek veriler.
  const profileData = appCtx?.data || {};
  const nickname: string = profileData.nickname || 'Sinevia Ajanı';
  const agentCode: string = profileData.agentId || '';
  const level: number = Number(profileData.level) || 1;
  const totalXp: number = Number(profileData.totalXp) || 0;
  const streak: number = Number(profileData.dailyStreak) || 0;
  const levelInfo = levelFromXp(totalXp);

  // Tutorial sürerken alt nav'ı kaydırma ile gizleme: hedef adımlar (örn.
  // karşılama turundaki nav-movies) menü görünürken tamamlanmalı.
  const { activeTutorial } = useTutorial();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showWrapped, setShowWrapped] = useState(false);
  const [showAddMovie, setShowAddMovie] = useState(false);
  const [showAddSeries, setShowAddSeries] = useState(false);

  // Topbar'daki arama kutusunun kısayol rozeti ("/" varsayılan, ayarlardan değişir).
  const [searchCombo, setSearchCombo] = useState('/');
  useEffect(() => {
    setSearchCombo(describeCombo(loadBindings().focusSearch));
  }, []);

  // Akıllı Alt Bar (Auto-Hide) State ve Referansları
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const lastScrollY = useRef(0);

  const navItems = [
    { id: 'home', icon: LayoutDashboard, label: 'Ana Sayfa', shortLabel: 'Ana Sayfa' },
    { id: 'movies', icon: Film, label: 'Filmler', shortLabel: 'Filmler' },
    { id: 'series', icon: Tv, label: 'Diziler', shortLabel: 'Diziler' },
    { id: 'network', icon: Users, label: 'Sinevia Ağı', shortLabel: 'Ağ' },
    { id: 'plan', icon: CalendarClock, label: 'Haftalık Plan', shortLabel: 'Plan' },
    { id: 'history', icon: History, label: 'Geçmiş', shortLabel: 'Geçmiş' },
    { id: 'achievements', icon: Trophy, label: 'Başarımlar', shortLabel: 'Kupalar' },
    { id: 'stats', icon: BarChart3, label: 'İstatistik', shortLabel: 'İstatistik' },
    { id: 'ai', icon: Bot, label: 'AI Asistan', shortLabel: 'AI' },
  ] as const;

  const mobileBottomTabs = [
    { id: 'movies', icon: Film, label: 'Filmler' },
    { id: 'series', icon: Tv, label: 'Diziler' },
    { id: 'network', icon: Users, label: 'Sinevia Ağı' },
    { id: 'history', icon: History, label: 'Geçmiş' },
    { id: 'achievements', icon: Trophy, label: 'Başarımlar' },
  ] as const;

  // 1. KUSURSUZ MODAL ALGILAYICI
  useEffect(() => {
    const checkModals = () => {
      const hasModals = Array.from(document.querySelectorAll('.fixed.inset-0')).some(el => {
        const zIndexMatch = el.className.match(/z-\[?(\d+)\]?/);
        if (zIndexMatch) {
          return parseInt(zIndexMatch[1], 10) > 60; 
        }
        return false;
      });
      setIsModalOpen(hasModals);
    };

    const observer = new MutationObserver(checkModals);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    
    checkModals();

    return () => observer.disconnect();
  }, []);

  // 2. YAVAŞ KAYDIRMAYA DUYARLI AKILLI SCROLL MOTORU
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isModalOpen) return;
    if (activeTutorial) return; // tutorial sırasında nav sabit kalsın

    const currentY = e.currentTarget.scrollTop;
    
    if (currentY <= 20) {
      setIsNavVisible(true);
      lastScrollY.current = currentY;
      return;
    }

    const diff = currentY - lastScrollY.current;

    if (diff > 15) {
      setIsNavVisible(false);
      lastScrollY.current = currentY;
    } else if (diff < -15) {
      setIsNavVisible(true);
      lastScrollY.current = currentY;
    }
  };

  useEffect(() => {
    const scrollEl = document.getElementById('main-scroll');
    if (scrollEl) {
      scrollEl.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      setIsNavVisible(true); 
    }
  }, [activeTab]);

  const handleMobileMenuClick = (id: TabId) => {
    onTabChange(id);
    setIsMobileMenuOpen(false);
  };

  // Topbar araması: sayfadaki arama kutusuna odaklan; yoksa Filmler'e git.
  const handleTopbarSearch = () => {
    if (!focusPageSearch()) onTabChange('movies');
  };

  const topbarTitle = activeTab === 'settings'
    ? 'Ayarlar'
    : navItems.find((item) => item.id === activeTab)?.label || 'Sinevia';

  const xpLabel = levelInfo.nextLevelXp > 0
    ? `${levelInfo.currentLevelXp} / ${levelInfo.nextLevelXp}`
    : 'MAX';

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-ink-950 font-sans text-ink-50 selection:bg-azure-500/30 selection:text-azure-200 overflow-hidden relative isolate transition-colors duration-500">
      {/* Ortam ışıkları: negatif z ile her zaman içeriknin ARKASINDA kalır */}
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full blur-[130px] pointer-events-none ambient-glow-1 -z-10 transition-all duration-700" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full blur-[130px] pointer-events-none ambient-glow-2 -z-10 transition-all duration-700" />
      <div className="fixed top-[40%] left-[30%] w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none ambient-glow-3 -z-10 transition-all duration-700" />

      {/* MOBİL: SABİT ÜST BAR */}
      {/* iOS çentik/safe-area: başlık calc ile büyür, içerik satırı 56px'te kalır */}
      <header className="md:hidden fixed top-0 inset-x-0 h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-ink-900/80 backdrop-blur-xl border-b border-ink-800 z-[60] flex items-center justify-between pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] shadow-md shrink-0 transition-transform duration-300" style={glassSurface}>
        {/* Premium kırmızı (tema vurgulu) alt saç teli */}
        <span aria-hidden className="absolute inset-x-0 bottom-[-1px] h-px pointer-events-none" style={{ background: TOPBAR_HAIRLINE }} />
        <div className="flex items-center gap-2 min-w-0">
          {/* 44px dokunma hedefi (iOS HIG) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            data-tutorial="nav-tabs"
            className="w-11 h-11 flex items-center justify-center rounded-xl text-white bg-ink-900 border border-ink-800 hover:bg-ink-800 transition-colors shrink-0"
            title="Menü"
          >
            {isMobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>

          <button onClick={() => handleMobileMenuClick('home')} className="flex items-center gap-1.5 min-h-11 transition-transform active:scale-95">
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
              <Sini size={30} mood="idle" showGlow={false} />
            </div>
            <span className="text-[13px] font-black text-white tracking-[0.16em] uppercase whitespace-nowrap">SINEVIA</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* YENİ: MOBİL BULUT EŞİTLEME İKONU */}
          <div 
            className={`relative flex items-center justify-center w-9 h-9 rounded-xl border transition-all mr-0.5 ${
              syncStatus === 'syncing' ? 'bg-azure-500/10 border-azure-500/30 text-azure-400' :
              syncStatus === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
              'bg-emerald-500/5 border-emerald-500/20 text-emerald-500/70'
            }`}
            title={syncStatus === 'syncing' ? 'Bulutla eşitleniyor...' : syncStatus === 'error' ? 'Bağlantı hatası' : 'Sistem güncel'}
          >
            {syncStatus === 'syncing' ? <RefreshCw size={14} className="animate-spin" /> :
             syncStatus === 'error' ? <CloudOff size={14} /> :
             <Cloud size={14} />}
             
             {syncStatus === 'syncing' && (
               <span className="absolute inset-0 rounded-xl border border-azure-400 animate-ping opacity-30" />
             )}
          </div>

          <button
            onClick={() => handleMobileMenuClick('ai')}
            className={`w-11 h-11 flex items-center justify-center rounded-xl border transition-all shrink-0 ${
              activeTab === 'ai'
                ? 'text-gold-400 border'
                : 'bg-ink-900/80 text-ink-400 border-ink-800 hover:text-ink-100'
            }`}
            style={activeTab === 'ai' ? activePillStyle : undefined}
            title="AI Asistan"
          >
            <Bot size={17} />
          </button>

          {/* Küçük ekranda başlık taşmasın: Wrapped aynı işlevi menüde de var */}
          <button
            onClick={() => setShowWrapped(true)}
            className="relative overflow-hidden hidden sm:flex items-center gap-1 min-h-11 px-2.5 py-1.5 rounded-xl text-white text-[11px] font-black shadow-md whitespace-nowrap transition-transform hover:-translate-y-[1px]"
            style={btnPrimaryStyle}
          >
            <Sparkles size={13} /> Wrapped
            <ButtonShimmer />
          </button>

          <button
            onClick={() => handleMobileMenuClick('settings')}
            className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all shrink-0 ${
              activeTab === 'settings' ? 'bg-ink-800 text-gold-400 border border-gold-500/30' : 'text-ink-400 hover:bg-ink-900 hover:text-white'
            }`}
            title="Ayarlar"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* MOBİL: AÇILIR TAM MENÜ EKRANI */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed top-[calc(3.5rem+env(safe-area-inset-top))] inset-x-0 bottom-0 bg-ink-900/80 backdrop-blur-3xl z-[55] animate-fade-in flex flex-col p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] overflow-y-auto" style={glassSurface}>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { setIsMobileMenuOpen(false); setShowWrapped(true); }}
              className="relative overflow-hidden flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-black text-white shadow-lg mb-1"
              style={btnPrimaryStyle}
            >
              <span className="flex items-center gap-3">
                <Sparkles size={19} /> SINEVIA WRAPPED ÖZETİN
              </span>
              <span className="text-[10px] bg-black/20 text-white px-2 py-0.5 rounded-full">Story</span>
              <ButtonShimmer />
            </button>

            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleMobileMenuClick(item.id as TabId)}
                  data-tutorial={`nav-${item.id}`}
                  className={`relative flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                    isActive
                      ? 'text-gold-400 bg-ink-800'
                      : 'text-ink-300 bg-ink-900/60 hover:bg-ink-800/50 hover:text-ink-100'
                  }`}
                  style={isActive ? activePillStyle : undefined}
                >
                  <item.icon size={19} className={isActive ? 'scale-110' : ''} />
                  <span className="tracking-wide">{item.label}</span>
                  {isActive && <ActiveRail />}
                </button>
              );
            })}

            <button
              onClick={() => handleMobileMenuClick('settings')}
              className={`relative flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                activeTab === 'settings'
                  ? 'text-gold-400 bg-ink-800'
                  : 'text-ink-300 bg-ink-900/60 hover:bg-ink-800/50 hover:text-ink-100'
              }`}
              style={activeTab === 'settings' ? activePillStyle : undefined}
            >
              <Settings size={19} />
              <span className="tracking-wide">Ayarlar</span>
              {activeTab === 'settings' && <ActiveRail />}
            </button>
          </div>
        </div>
      )}

      {/* MASAÜSTÜ SOL SIDEBAR — premium cam yüzey */}
      <aside
        className="hidden md:flex flex-col w-[248px] shrink-0 z-20 bg-ink-900/80 backdrop-blur-[18px] border-r border-ink-800/60 transition-colors duration-500"
        style={{
          ...glassSurface,
          boxShadow: '12px 0 44px -20px color-mix(in srgb, var(--bg-base) 55%, transparent)',
        }}
      >
        {/* Marka bloğu + alt kırmızı saç teli */}
        <button
          onClick={() => onTabChange('home')}
          className="relative px-5 py-5 border-b border-ink-800/50 hover:bg-ink-800/40 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <Sini size={40} mood="idle" showGlow={false} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black tracking-[0.12em] uppercase leading-none text-white whitespace-nowrap">
                SINE<span style={accentTextStyle}>VIA</span>
              </h1>
              <span className="block mt-1.5 text-[9px] font-bold tracking-[0.28em] uppercase text-ink-500 whitespace-nowrap">
                Kayıt Defteri
              </span>
            </div>
          </div>
          <span
            aria-hidden
            className="absolute left-5 right-5 bottom-[-1px] h-px opacity-70"
            style={{ background: 'linear-gradient(90deg, var(--color-1), transparent)' }}
          />
        </button>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto hide-scrollbar" data-tutorial="nav-tabs">
          <div className="px-3 pb-2 pt-1 text-[9px] font-bold tracking-[0.24em] uppercase text-ink-500 opacity-80">
            Bölümler
          </div>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id as TabId)}
                data-tutorial={`nav-${item.id}`}
                className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-bold text-[12.5px] tracking-[0.06em] uppercase whitespace-nowrap group ${
                  isActive
                    ? 'bg-gold-500/20 text-gold-400 border'
                    : 'text-ink-400 hover:bg-ink-800/50 hover:text-white hover:translate-x-[3px] border border-transparent'
                }`}
                style={isActive ? activePillStyle : undefined}
              >
                <item.icon size={17} className={`transition-transform duration-300 shrink-0 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span>{item.label}</span>
                {isActive && <ActiveRail />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-ink-800/60 space-y-2">
          
          {/* YENİ: MASAÜSTÜ BULUT EŞİTLEME PANELİ (cam) */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-ink-800/40 border border-ink-800/50 mb-3 select-none" style={glassSurface}>
            <div className="relative flex items-center justify-center">
              {syncStatus === 'syncing' ? <RefreshCw size={15} className="text-azure-400 animate-spin" /> :
               syncStatus === 'error' ? <CloudOff size={15} className="text-red-400" /> :
               <Cloud size={15} className="text-emerald-500/80" />}
              {syncStatus === 'syncing' && (
                <span className="absolute inset-0 rounded-full border border-azure-400 animate-ping opacity-40" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-ink-500 uppercase tracking-widest leading-none mb-1">Bulut Ağı</span>
              <span className={`text-[10px] font-bold tracking-wide leading-none ${
                syncStatus === 'syncing' ? 'text-azure-400' : 
                syncStatus === 'error' ? 'text-red-400' : 'text-emerald-500/80'
              }`}>
                {syncStatus === 'syncing' ? 'Eşitleniyor...' : syncStatus === 'error' ? 'Bağlantı Yok' : 'Sistem Güncel'}
              </span>
            </div>
          </div>

          {/* Premium btn-p: Wrapped */}
          <button
            onClick={() => setShowWrapped(true)}
            className="relative overflow-hidden w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-extrabold text-[11px] tracking-[0.12em] uppercase shadow-lg transition-all duration-300 hover:-translate-y-[2px] active:translate-y-px"
            style={btnPrimaryStyle}
          >
            <Sparkles size={15} /> Wrapped Özetin
            <ButtonShimmer />
          </button>

          {/* Ayarlar (nav ile aynı aktif pill mantığı) */}
          <button
            onClick={() => onTabChange('settings')}
            className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-bold text-[12.5px] tracking-[0.06em] uppercase whitespace-nowrap group ${
              activeTab === 'settings'
                ? 'bg-gold-500/20 text-gold-400 border'
                : 'text-ink-400 hover:bg-ink-800/50 hover:text-white hover:translate-x-[3px] border border-transparent'
            }`}
            style={activeTab === 'settings' ? activePillStyle : undefined}
          >
            <Settings size={17} className={`transition-transform duration-300 shrink-0 ${activeTab === 'settings' ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span>Ayarlar</span>
            {activeTab === 'settings' && <ActiveRail />}
          </button>

          {/* Premium cam profil kartı (gerçek seviye/XP verisi) */}
          <div
            className="mt-1 p-3.5 rounded-2xl bg-ink-800/60 border border-ink-800/60 backdrop-blur-xl select-none transition-colors duration-500"
            style={{ ...glassSurface, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-[14px] grid place-items-center shrink-0 border"
                style={{
                  background: 'linear-gradient(140deg, rgba(255,255,255,.10), rgba(255,255,255,.02))',
                  borderColor: 'color-mix(in srgb, var(--color-1) 50%, transparent)',
                  boxShadow: '0 0 18px -6px color-mix(in srgb, var(--color-1) 60%, transparent), inset 0 1px 0 rgba(255,255,255,.12)',
                }}
              >
                <Sini size={30} mood="idle" showGlow={false} />
              </div>
              <div className="min-w-0">
                <b className="block text-[13px] font-black uppercase tracking-tight text-white truncate">{nickname}</b>
                <span className="block text-[9.5px] font-bold uppercase tracking-[0.14em] text-gold-400 truncate">
                  {agentCode ? agentCode : `Seviye ${level}`}
                </span>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-[0.14em] text-ink-500 mb-1.5">
                <span>XP</span>
                <span>{xpLabel}</span>
              </div>
              <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.07)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,.6)' }}>
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, levelInfo.progress))}%`,
                    backgroundImage: 'linear-gradient(90deg, color-mix(in srgb, var(--color-1) 60%, black), var(--color-1), var(--color-2))',
                    boxShadow: '0 0 12px color-mix(in srgb, var(--color-1) 70%, transparent)',
                    transition: 'width .5s ease',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ANA İÇERİK ALANI */}
      {/* main'de z-index YOK: modal/tutorial katmanları (z-90…z-300) kök
          stacking context'te sidebar (z-20) ve alt nav (z-58) ile yarışsın,
          aksi halde hepsi içerik alanının altında sıkışıp kalıyor. */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent relative pt-[calc(3.5rem+env(safe-area-inset-top))] pb-0 md:pt-0 md:pb-0">
        {/* MASAÜSTÜ PREMIUM TOPBAR — blur(20px) + alt kırmızı gradyan saç teli */}
        <header
          className="hidden md:flex items-center gap-4 px-6 py-3.5 shrink-0 relative z-30 border-b border-ink-800/60 backdrop-blur-[20px] transition-colors duration-500"
          style={topbarStyle}
        >
          <div className="min-w-0">
            <h1 className="text-lg font-black uppercase tracking-tight text-ink-50 leading-none whitespace-nowrap">{topbarTitle}</h1>
            <p className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-500 whitespace-nowrap">
              {streak} günlük seri · Seviye {level}
            </p>
          </div>

          {/* Premium arama butonu: sayfa aramasına odaklanır ("/" kısayolu) */}
          <button
            onClick={handleTopbarSearch}
            className="group relative flex items-center gap-2.5 min-w-[240px] ml-auto px-4 py-2.5 rounded-xl bg-ink-900/60 border border-ink-800/60 backdrop-blur-md text-left transition-all duration-300 hover:-translate-y-[1px]"
            style={glassSurface}
          >
            <Search size={15} className="text-ink-400 group-hover:text-gold-400 transition-colors shrink-0" />
            <span className="flex-1 text-[13px] text-ink-400 whitespace-nowrap overflow-hidden text-ellipsis">Film, dizi, oyuncu ara…</span>
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded-md border border-ink-800/60 bg-ink-800/40 text-ink-400 shrink-0">{searchCombo}</kbd>
            {/* Hover'da vurgu halkası */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ boxShadow: '0 0 0 4px color-mix(in srgb, var(--color-1) 16%, transparent)' }}
            />
          </button>

          {/* Aksiyon butonları (premium buton sistemi) */}
          <button
            onClick={() => setShowAddMovie(true)}
            className="relative overflow-hidden group flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-extrabold text-[11.5px] tracking-[0.1em] uppercase whitespace-nowrap transition-all duration-300 hover:-translate-y-[2px] active:translate-y-px"
            style={btnPrimaryStyle}
          >
            <Plus size={15} /> Film Ekle
            <ButtonShimmer />
          </button>

          <button
            onClick={() => setShowAddSeries(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-ink-50 font-extrabold text-[11.5px] tracking-[0.1em] uppercase whitespace-nowrap backdrop-blur-md transition-all duration-300 hover:-translate-y-[2px] active:translate-y-px"
            style={btnSecondaryStyle}
          >
            <Plus size={15} /> Dizi Ekle
          </button>

          <button
            onClick={() => onTabChange('ai')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ink-900/60 border border-ink-800/60 text-ink-400 hover:text-ink-100 hover:border-ink-700 font-extrabold text-[11.5px] tracking-[0.1em] uppercase whitespace-nowrap transition-all duration-300 hover:-translate-y-[2px]"
          >
            <Bot size={15} /> Sinevia AI'a Sor
          </button>

          {/* Premium alt saç teli */}
          <span aria-hidden className="absolute left-0 right-0 bottom-[-1px] h-px pointer-events-none" style={{ background: TOPBAR_HAIRLINE }} />
        </header>

        <div id="main-scroll" onScroll={handleScroll} className="flex-1 overflow-y-auto p-3.5 sm:p-4 md:p-8 relative custom-scrollbar pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
          {/* Başarımlar sayfası masaüstünde daha geniş bir vitrin ister */}
        <div className={activeTab === 'achievements' ? 'w-full max-w-[100rem] mx-auto' : 'max-w-7xl mx-auto'}>{children}</div>
        </div>
      </main>

      {/* MOBİL: AKILLI (GİZLENEN) SABİT ALT NAVİGASYON BARI */}
      <nav
        className={`md:hidden fixed bottom-0 inset-x-0 min-h-[68px] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] bg-ink-900/80 backdrop-blur-2xl border-t border-ink-800/60 z-[58] grid grid-cols-5 px-1.5 shadow-[0_-8px_25px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-in-out ${
          isNavVisible && !isModalOpen ? 'translate-y-0' : 'translate-y-[120%]'
        }`}
        style={glassSurface}
      >
        {/* Premium üst saç teli */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-px pointer-events-none" style={{ background: TOPBAR_HAIRLINE }} />
        {mobileBottomTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleMobileMenuClick(tab.id as TabId)}
              data-tutorial={`nav-${tab.id}`}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-xl my-1.5 transition-all ${
                isActive ? 'text-gold-400 bg-gold-500/10' : 'text-ink-400 hover:text-ink-200'
              }`}
              style={isActive ? { backgroundImage: activePillStyle.backgroundImage } : undefined}
            >
              <Icon size={20} className={isActive ? 'scale-110' : ''} />
              <span className={`text-[10px] tracking-tight ${isActive ? 'font-black' : 'font-semibold'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {showWrapped && <WrappedModal onClose={() => setShowWrapped(false)} />}
      {showAddMovie && <AddMovieModal onClose={() => setShowAddMovie(false)} />}
      {showAddSeries && <AddSeriesModal onClose={() => setShowAddSeries(false)} />}
    </div>
  );
}
