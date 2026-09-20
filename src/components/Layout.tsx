import React from 'react';
import { Home, Film, Tv, History, Trophy, Settings, BarChart3, Bot } from 'lucide-react';

export type TabId = 'home' | 'movies' | 'series' | 'history' | 'achievements' | 'stats' | 'ai' | 'settings';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const navItems = [
    { id: 'home', icon: Home, label: 'Ana Sayfa' },
    { id: 'movies', icon: Film, label: 'Filmler' },
    { id: 'series', icon: Tv, label: 'Diziler' },
    { id: 'history', icon: History, label: 'Geçmiş' },
    { id: 'achievements', icon: Trophy, label: 'Başarımlar' },
    { id: 'stats', icon: BarChart3, label: 'İstatistik' },
    { id: 'ai', icon: Bot, label: 'AI Asistan' },
  ] as const;

  return (
    <div className="flex h-screen bg-ink-950 font-sans text-ink-50 selection:bg-azure-500/30 selection:text-azure-200">
      {/* YENİ: Daraltılmış ve Temaya Uygun Sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-ink-950/80 backdrop-blur-2xl border-r border-ink-800/60 shrink-0 shadow-2xl z-20">
        
        {/* LOGO KISMI */}
        <div className="p-5 border-b border-ink-800/50 bg-ink-900/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-azure-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-azure-500/20">
              <Film size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-white tracking-widest uppercase">
              SINEVIA
            </h1>
          </div>
        </div>
        
        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto hide-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const isAI = item.id === 'ai';
            
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-ink-950 relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gold-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-azure-500/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 hide-scrollbar relative z-10">
          <div className="max-w-7xl mx-auto pb-20 md:pb-0">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-ink-900/90 backdrop-blur-xl border-t border-ink-800 pb-safe z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-around p-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const isAI = item.id === 'ai';
            
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 ${
                  isActive 
                    ? isAI
                        ? 'text-azure-400 bg-azure-500/10 shadow-inner -translate-y-2 border border-azure-500/20'
                        : 'text-white bg-ink-800 shadow-inner -translate-y-2 border border-ink-700'
                    : isAI
                        ? 'text-azure-500/70 hover:text-azure-400'
                        : 'text-ink-500 hover:text-ink-300'
                }`}
              >
                <item.icon size={isActive ? 22 : 20} className={`mb-1 transition-all ${isActive ? 'drop-shadow-md' : ''}`} />
                <span className={`text-[10px] font-bold ${isActive ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}