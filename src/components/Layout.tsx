import React, { useState, useEffect, useRef } from 'react';
import {
  Film, Tv, History, Trophy, Settings, BarChart3, Bot,
  Menu, X, LayoutDashboard, Sparkles, CalendarClock, Users,
  Cloud, CloudOff, RefreshCw // YENİ EKLENEN İKONLAR
} from 'lucide-react';
import WrappedModal from './WrappedModal';
import { useApp } from '../context/AppContext';
import { useTutorial } from '../context/TutorialContext';
import Sini from '../tutorial/Sini';

export type TabId = 'home' | 'movies' | 'series' | 'network' | 'plan' | 'history' | 'achievements' | 'stats' | 'ai' | 'settings';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  // AppContext'ten (veya ilgili yerden) syncStatus durumunu çekiyoruz. 
  // Sen Context'e ekleyene kadar hata vermemesi için fallback atadık.
  const appCtx = useApp() as any;
  const syncStatus: 'syncing' | 'synced' | 'error' = appCtx.syncStatus || 'synced';

  // Tutorial sürerken alt nav'ı kaydırma ile gizleme: hedef adımlar (örn.
  // karşılama turundaki nav-movies) menü görünürken tamamlanmalı.
  const { activeTutorial } = useTutorial();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showWrapped, setShowWrapped] = useState(false);

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

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-ink-950 font-sans text-ink-50 selection:bg-azure-500/30 selection:text-azure-200 overflow-hidden relative isolate transition-colors duration-500">
      {/* Ortam ışıkları: negatif z ile her zaman içeriknin ARKASINDA kalır */}
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full blur-[130px] pointer-events-none ambient-glow-1 -z-10 transition-all duration-700" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full blur-[130px] pointer-events-none ambient-glow-2 -z-10 transition-all duration-700" />
      <div className="fixed top-[40%] left-[30%] w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none ambient-glow-3 -z-10 transition-all duration-700" />

      {/* MOBİL: SABİT ÜST BAR */}
      {/* iOS çentik/safe-area: başlık calc ile büyür, içerik satırı 56px'te kalır */}
      <header className="md:hidden fixed top-0 inset-x-0 h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-ink-950/90 backdrop-blur-xl border-b border-ink-800 z-[60] flex items-center justify-between pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] shadow-md shrink-0 transition-transform duration-300">
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
                ? 'bg-azure-500/25 text-azure-300 border-azure-500/40'
                : 'bg-ink-900/80 text-azure-400 border-ink-800 hover:text-azure-300'
            }`}
            title="AI Asistan"
          >
            <Bot size={17} />
          </button>

          {/* Küçük ekranda başlık taşmasın: Wrapped aynı işlevi menüde de var */}
          <button
            onClick={() => setShowWrapped(true)}
            className="hidden sm:flex items-center gap-1 min-h-11 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 text-ink-950 text-[11px] font-black shadow-md whitespace-nowrap"
          >
            <Sparkles size={13} /> Wrapped
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
        <div className="md:hidden fixed top-[calc(3.5rem+env(safe-area-inset-top))] inset-x-0 bottom-0 bg-ink-950/95 backdrop-blur-3xl z-[55] animate-fade-in flex flex-col p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] overflow-y-auto">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { setIsMobileMenuOpen(false); setShowWrapped(true); }}
              className="flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-black bg-gradient-to-r from-gold-500 via-amber-500 to-orange-500 text-ink-950 shadow-lg mb-1"
            >
              <span className="flex items-center gap-3">
                <Sparkles size={19} /> SINEVIA WRAPPED ÖZETİN
              </span>
              <span className="text-[10px] bg-black/20 text-white px-2 py-0.5 rounded-full">Story</span>
            </button>

            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const isAI = item.id === 'ai';
              return (
                <button
                  key={item.id}
                  onClick={() => handleMobileMenuClick(item.id as TabId)}
                  data-tutorial={`nav-${item.id}`}
                  className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                    isActive
                      ? isAI
                        ? 'text-azure-300 bg-azure-500/20 border border-azure-500/30 shadow-sm'
                        : 'text-gold-400 bg-ink-800 border border-gold-500/30 shadow-sm'
                      : isAI
                      ? 'text-azure-400 bg-azure-500/5 hover:bg-azure-500/10'
                      : 'text-ink-300 bg-ink-900/50 hover:bg-ink-800/50 hover:text-ink-100'
                  }`}
                >
                  <item.icon size={19} className={isActive ? 'scale-110' : ''} />
                  <span className="tracking-wide">{item.label}</span>
                </button>
              );
            })}

            <button
              onClick={() => handleMobileMenuClick('settings')}
              className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                activeTab === 'settings'
                  ? 'text-gold-400 bg-ink-800 border border-gold-500/30 shadow-sm'
                  : 'text-ink-300 bg-ink-900/50 hover:bg-ink-800/50 hover:text-ink-100'
              }`}
            >
              <Settings size={19} />
              <span className="tracking-wide">Ayarlar</span>
            </button>
          </div>
        </div>
      )}

      {/* MASAÜSTÜ SOL SIDEBAR */}
      <aside className="hidden md:flex flex-col w-52 bg-ink-900/80 backdrop-blur-2xl border-r border-ink-800/60 shrink-0 shadow-2xl z-20 transition-colors duration-500">
        <button onClick={() => onTabChange('home')} className="p-5 border-b border-ink-800/50 hover:bg-ink-800/40 transition-colors text-left cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <Sini size={40} mood="idle" showGlow={false} />
            </div>
            <h1 className="text-xl font-black text-white tracking-widest uppercase">SINEVIA</h1>
          </div>
        </button>

        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto hide-scrollbar" data-tutorial="nav-tabs">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const isAI = item.id === 'ai';
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id as TabId)}
                data-tutorial={`nav-${item.id}`}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold text-sm group ${
                  isActive
                    ? isAI
                      ? 'bg-gradient-to-r from-azure-500 to-indigo-600 text-white shadow-md border border-azure-500/30'
                      : 'bg-gold-500/20 text-gold-400 shadow-sm border border-gold-500/30'
                    : isAI
                    ? 'text-azure-400 hover:bg-ink-800/50 hover:text-azure-300 border border-transparent'
                    : 'text-ink-400 hover:bg-ink-800/50 hover:text-white border border-transparent'
                }`}
              >
                <item.icon size={18} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-ink-800/60 space-y-2">
          
          {/* YENİ: MASAÜSTÜ BULUT EŞİTLEME PANELİ */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-ink-950/50 border border-ink-800/50 mb-3 select-none">
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

          <button
            onClick={() => setShowWrapped(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-gold-500 via-amber-500 to-orange-500 hover:from-gold-400 hover:to-amber-400 text-ink-950 font-black text-xs shadow-lg shadow-gold-500/20 transition-all hover:scale-[1.02]"
          >
            <Sparkles size={16} /> Wrapped Özetin
          </button>

          <button
            onClick={() => onTabChange('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold text-sm group ${
              activeTab === 'settings'
                ? 'bg-gold-500/20 text-gold-400 shadow-sm border border-gold-500/30'
                : 'text-ink-400 hover:bg-ink-800/50 hover:text-white border border-transparent'
            }`}
          >
            <Settings size={18} className={`transition-transform duration-300 ${activeTab === 'settings' ? 'rotate-90' : 'group-hover:rotate-90'}`} />
            Ayarlar
          </button>
        </div>
      </aside>

      {/* ANA İÇERİK ALANI */}
      {/* main'de z-index YOK: modal/tutorial katmanları (z-90…z-300) kök
          stacking context'te sidebar (z-20) ve alt nav (z-58) ile yarışsın,
          aksi halde hepsi içerik alanının altında sıkışıp kalıyor. */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent relative pt-[calc(3.5rem+env(safe-area-inset-top))] pb-0 md:pt-0 md:pb-0">
        <div id="main-scroll" onScroll={handleScroll} className="flex-1 overflow-y-auto p-3.5 sm:p-4 md:p-8 relative custom-scrollbar pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
          {/* Başarımlar sayfası masaüstünde daha geniş bir vitrin ister */}
        <div className={activeTab === 'achievements' ? 'w-full max-w-[100rem] mx-auto' : 'max-w-7xl mx-auto'}>{children}</div>
        </div>
      </main>

      {/* MOBİL: AKILLI (GİZLENEN) SABİT ALT NAVİGASYON BARI */}
      <nav
        className={`md:hidden fixed bottom-0 inset-x-0 min-h-[68px] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] bg-ink-950/95 backdrop-blur-2xl border-t border-ink-800/90 z-[58] grid grid-cols-5 px-1.5 shadow-[0_-8px_25px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-in-out ${
          isNavVisible && !isModalOpen ? 'translate-y-0' : 'translate-y-[120%]'
        }`}
      >
        {mobileBottomTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleMobileMenuClick(tab.id as TabId)}
              data-tutorial={`nav-${tab.id}`}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl my-1.5 transition-all ${
                isActive ? 'text-gold-400 bg-gold-500/10' : 'text-ink-400 hover:text-ink-200'
              }`}
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
    </div>
  );
}