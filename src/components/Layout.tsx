import React, { useState } from 'react';
import { Film, Tv, History, Trophy, Settings, BarChart3, Bot, Menu, X, LayoutDashboard, Sparkles } from 'lucide-react';
import WrappedModal from './WrappedModal';

export type TabId = 'home' | 'movies' | 'series' | 'history' | 'achievements' | 'stats' | 'ai' | 'settings';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showWrapped, setShowWrapped] = useState(false);

  const navItems = [
    { id: 'home', icon: LayoutDashboard, label: 'Ana Sayfa' },
    { id: 'movies', icon: Film, label: 'Filmler' },
    { id: 'series', icon: Tv, label: 'Diziler' },
    { id: 'history', icon: History, label: 'Geçmiş' },
    { id: 'achievements', icon: Trophy, label: 'Başarımlar' },
    { id: 'stats', icon: BarChart3, label: 'İstatistik' },
    { id: 'ai', icon: Bot, label: 'AI Asistan' },
  ] as const;

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
      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-ink-950/90 backdrop-blur-xl border-b border-ink-800 z-[60] flex items-center justify-between px-3 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-white bg-ink-900 border border-ink-800 hover:bg-ink-800 transition-colors"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <button onClick={() => handleMobileMenuClick('home')} className="flex items-center gap-2 transition-transform active:scale-95">
            <div className="w-8 h-8 bg-gradient-to-br from-gold-500 to-gold-600 rounded-lg flex items-center justify-center shadow-md">
              <Film size={16} className="text-white" />
            </div>
            <span className="text-base font-black text-white tracking-widest uppercase">SINEVIA</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowWrapped(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 text-ink-950 text-xs font-black shadow-md"
          >
            <Sparkles size={14} /> Wrapped
          </button>
          <button
            onClick={() => handleMobileMenuClick('settings')}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
              activeTab === 'settings' ? 'bg-ink-800 text-gold-400 border border-gold-500/30' : 'text-ink-400 hover:bg-ink-900 hover:text-white'
            }`}
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* MOBİL: AÇILIR MENÜ EKRANI */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed top-14 inset-0 bg-ink-950/95 backdrop-blur-3xl z-[55] animate-fade-in flex flex-col p-4 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { setIsMobileMenuOpen(false); setShowWrapped(true); }}
              className="flex items-center justify-between px-4 py-4 rounded-2xl text-sm font-black bg-gradient-to-r from-gold-500 via-amber-500 to-orange-500 text-ink-950 shadow-lg mb-1"
            >
              <span className="flex items-center gap-3">
                <Sparkles size={20} /> SINEVIA WRAPPED ÖZETİN
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
                  className={`flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${
                    isActive
                      ? isAI
                        ? 'text-azure-300 bg-azure-500/20 border border-azure-500/30 shadow-sm'
                        : 'text-gold-400 bg-ink-800 border border-gold-500/30 shadow-sm'
                      : isAI
                      ? 'text-azure-400 bg-azure-500/5 hover:bg-azure-500/10'
                      : 'text-ink-400 bg-ink-900/50 hover:bg-ink-800/50 hover:text-ink-200'
                  }`}
                >
                  <item.icon size={20} className={isActive ? 'scale-110' : ''} />
                  <span className="tracking-wide">{item.label}</span>
                </button>
              );
            })}
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
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent relative pt-14 md:pt-0 z-10">
        <div id="main-scroll" className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto pb-6 md:pb-0">{children}</div>
        </div>
      </main>

      {showWrapped && <WrappedModal onClose={() => setShowWrapped(false)} />}
    </div>
  );
}