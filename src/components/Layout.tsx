import React, { useState } from 'react';
import { Film, Tv, History, Trophy, Settings, BarChart3, Bot, Menu, X, LayoutDashboard } from 'lucide-react';

export type TabId = 'home' | 'movies' | 'series' | 'history' | 'achievements' | 'stats' | 'ai' | 'settings';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Menü elemanlarına Ana Sayfa eklendi ve ikon LayoutDashboard yapıldı
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
    <div className="flex flex-col md:flex-row h-[100dvh] bg-ink-950 font-sans text-ink-50 selection:bg-azure-500/30 selection:text-azure-200 overflow-hidden relative">
      
      {/* MOBİL: SABİT ÜST BAR (KALIP) */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-ink-950 border-b border-ink-800 z-[60] flex items-center justify-between px-3 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className="w-10 h-10 flex items-center justify-center rounded-xl text-white bg-ink-900 border border-ink-800 hover:bg-ink-800 transition-colors"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <button onClick={() => handleMobileMenuClick('home')} className="flex items-center gap-2 transition-transform active:scale-95">
            <div className="w-8 h-8 bg-gradient-to-br from-azure-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <Film size={16} className="text-white" />
            </div>
            <span className="text-base font-black text-white tracking-widest uppercase">SINEVIA</span>
          </button>
        </div>
        
        <button
          onClick={() => handleMobileMenuClick('settings')}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
            activeTab === 'settings' ? 'bg-ink-800 text-white border border-ink-700' : 'text-ink-400 hover:bg-ink-900 hover:text-white'
          }`}
        >
          <Settings size={20} />
        </button>
      </header>

      {/* MOBİL: AÇILIR MENÜ EKRANI */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed top-14 inset-0 bg-ink-950/95 backdrop-blur-3xl z-[55] animate-fade-in flex flex-col p-4 overflow-y-auto">
          <div className="flex flex-col gap-2">
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
                          : 'text-white bg-ink-800 border border-ink-700 shadow-sm'
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
      <aside className="hidden md:flex flex-col w-56 bg-ink-950/80 backdrop-blur-2xl border-r border-ink-800/60 shrink-0 shadow-2xl z-20">
        <button onClick={() => onTabChange('home')} className="p-5 border-b border-ink-800/50 bg-ink-900/30 hover:bg-ink-900/50 transition-colors text-left cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-azure-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-azure-500/20">
              <Film size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-white tracking-widest uppercase">
              SINEVIA
            </h1>
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
                        ? 'bg-gradient-to-r from-azure-600 to-indigo-600 text-white shadow-md shadow-azure-500/20 border border-azure-500/30'
                        : 'bg-ink-800/80 text-white shadow-sm border border-ink-700/80'
                    : isAI
                        ? 'text-azure-400 hover:bg-ink-800/50 hover:text-azure-300 border border-transparent hover:border-azure-900/50'
                        : 'text-ink-400 hover:bg-ink-800/50 hover:text-white'
                }`}
              >
                <item.icon size={18} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
        
        <div className="p-3 border-t border-ink-800/60 bg-ink-900/20">
          <button
            onClick={() => onTabChange('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold text-sm group ${
              activeTab === 'settings'
                ? 'bg-ink-800/80 text-white shadow-sm border border-ink-700/80'
                : 'text-ink-500 hover:bg-ink-800/50 hover:text-white'
            }`}
          >
            <Settings size={18} className={`transition-transform duration-300 ${activeTab === 'settings' ? 'rotate-90' : 'group-hover:rotate-90'}`} />
            Ayarlar
          </button>
        </div>
      </aside>

      {/* ANA İÇERİK ALANI */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-ink-950 relative pt-14 md:pt-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gold-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-azure-500/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div id="main-scroll" className="flex-1 overflow-y-auto p-4 md:p-8 hide-scrollbar relative z-10">
          <div className="max-w-7xl mx-auto pb-6 md:pb-0">
            {children}
          </div>
        </div>
      </main>

    </div>
  );
}