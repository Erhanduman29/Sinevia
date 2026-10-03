import React, { useState, useEffect, useRef } from 'react';
import {
  Film, Tv, History, Trophy, Settings, BarChart3, Bot,
  Menu, X, LayoutDashboard, Sparkles, CalendarClock,
} from 'lucide-react';
import WrappedModal from './WrappedModal';

export type TabId = 'home' | 'movies' | 'series' | 'plan' | 'history' | 'achievements' | 'stats' | 'ai' | 'settings';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
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
    { id: 'plan', icon: CalendarClock, label: 'Haftalık Plan', shortLabel: 'Plan' },
    { id: 'history', icon: History, label: 'Geçmiş', shortLabel: 'Geçmiş' },
    { id: 'achievements', icon: Trophy, label: 'Başarımlar', shortLabel: 'Kupalar' },
    { id: 'stats', icon: BarChart3, label: 'İstatistik', shortLabel: 'İstatistik' },
    { id: 'ai', icon: Bot, label: 'AI Asistan', shortLabel: 'AI' },
  ] as const;

  const mobileBottomTabs = [
    { id: 'movies', icon: Film, label: 'Filmler' },
    { id: 'series', icon: Tv, label: 'Diziler' },
    { id: 'history', icon: History, label: 'Geçmiş' },
    { id: 'stats', icon: BarChart3, label: 'İstatistik' },
    { id: 'achievements', icon: Trophy, label: 'Başarımlar' },
  ] as const;

  // 1. KUSURSUZ MODAL ALGILAYICI
  // Ekranda açılan herhangi bir tam ekran pencereyi (Rating, Detay vb.) yakalar
  useEffect(() => {
    const checkModals = () => {
      const hasModals = Array.from(document.querySelectorAll('.fixed.inset-0')).some(el => {
        const zIndexMatch = el.className.match(/z-\[?(\d+)\]?/);
        if (zIndexMatch) {
          // Sistemdeki ana bileşenler z-60 ve altındadır.
          // Açılır pencereler ise genelde z-100, z-120 kullanır.
          return parseInt(zIndexMatch[1], 10) > 60; 
        }
        return false;
      });
      setIsModalOpen(hasModals);
    };

    const observer = new MutationObserver(checkModals);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    
    // İlk render kontrolü
    checkModals();

    return () => observer.disconnect();
  }, []);

  // 2. YAVAŞ KAYDIRMAYA DUYARLI AKILLI SCROLL MOTORU
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isModalOpen) return; // Açılır pencere varken bar görünmez kalmaya devam eder!

    const currentY = e.currentTarget.scrollTop;
    
    // Ekranın en tepesine gelindiyse barı zorla göster
    if (currentY <= 20) {
      setIsNavVisible(true);
      lastScrollY.current = currentY;
      return;
    }

    const diff = currentY - lastScrollY.current;

    // Sadece net bir yön değişimi (15px) olduğunda referansı güncelle
    if (diff > 15) {
      // Aşağı kaydırılıyor
      setIsNavVisible(false);
      lastScrollY.current = currentY;
    } else if (diff < -15) {
      // Yukarı kaydırılıyor
      setIsNavVisible(true);
      lastScrollY.current = currentY;
    }
  };

  useEffect(() => {
    const scrollEl = document.getElementById('main-scroll');
    if (scrollEl) {
      scrollEl.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      setIsNavVisible(true); // Sekme değiştiğinde menü her zaman görünür olsun
    }
  }, [activeTab]);

  const handleMobileMenuClick = (id: TabId) => {
    onTabChange(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-ink-950 font-sans text-ink-50 selection:bg-azure-500/30 selection:text-azure-200 overflow-hidden relative transition-colors duration-500">
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full blur-[130px] pointer-events-none ambient-glow-1 z-0 transition-all duration-700" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full blur-[130px] pointer-events-none ambient-glow-2 z-0 transition-all duration-700" />
      <div className="fixed top-[40%] left-[30%] w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none ambient-glow-3 z-0 transition-all duration-700" />

      {/* MOBİL: SABİT ÜST BAR */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-ink-950/90 backdrop-blur-xl border-b border-ink-800 z-[60] flex items-center justify-between px-3 shadow-md shrink-0 transition-transform duration-300">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-white bg-ink-900 border border-ink-800 hover:bg-ink-800 transition-colors"
            title="Menü"
          >
            {isMobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>

          <button onClick={() => handleMobileMenuClick('home')} className="flex items-center gap-2 transition-transform active:scale-95">
            <div className="w-7 h-7 bg-gradient-to-br from-gold-500 to-gold-600 rounded-lg flex items-center justify-center shadow-md">
              <Film size={15} className="text-white" />
            </div>
            <span className="text-sm font-black text-white tracking-widest uppercase">SINEVIA</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleMobileMenuClick('ai')}
            className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${
              activeTab === 'ai'
                ? 'bg-azure-500/25 text-azure-300 border-azure-500/40'
                : 'bg-ink-900/80 text-azure-400 border-ink-800 hover:text-azure-300'
            }`}
            title="AI Asistan"
          >
            <Bot size={17} />
          </button>

          <button
            onClick={() => setShowWrapped(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 text-ink-950 text-[11px] font-black shadow-md"
          >
            <Sparkles size={13} /> Wrapped
          </button>

          <button
            onClick={() => handleMobileMenuClick('settings')}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
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
        <div className="md:hidden fixed top-14 inset-0 bg-ink-950/95 backdrop-blur-3xl z-[55] animate-fade-in flex flex-col p-4 pb-20 overflow-y-auto">
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
      <aside className="hidden md:flex flex-col w-56 bg-ink-900/80 backdrop-blur-2xl border-r border-ink-800/60 shrink-0 shadow-2xl z-20 transition-colors duration-500">
        <button onClick={() => onTabChange('home')} className="p-5 border-b border-ink-800/50 hover:bg-ink-800/40 transition-colors text-left cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-gold-500 to-gold-600 rounded-xl flex items-center justify-center shadow-lg">
              <Film size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-white tracking-widest uppercase">SINEVIA</h1>
          </div>
        </button>

        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto hide-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const isAI = item.id === 'ai';
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id as TabId)}
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
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent relative pt-14 pb-0 md:pt-0 md:pb-0 z-10">
        <div id="main-scroll" onScroll={handleScroll} className="flex-1 overflow-y-auto p-3.5 sm:p-4 md:p-8 relative z-10 custom-scrollbar pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>
      </main>

      {/* MOBİL: AKILLI (GİZLENEN) SABİT ALT NAVİGASYON BARI */}
      <nav
        className={`md:hidden fixed bottom-0 inset-x-0 h-[68px] bg-ink-950/95 backdrop-blur-2xl border-t border-ink-800/90 z-[58] grid grid-cols-5 px-1.5 shadow-[0_-8px_25px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-in-out ${
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