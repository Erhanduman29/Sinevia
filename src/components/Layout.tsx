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
    <div className="flex flex-col md:flex-row h-[100dvh] bg-ink-950 font-sans text-ink-50 selection:bg-azure-500/30 selection:text-azure-200 overflow-hidden">
      
      {/* MOBİL ÜST MENÜ BARİ (Mobilde en üste alındı) */}
      <nav className="md:hidden flex items-center justify-between px-3 py-2.5 bg-ink-900/90 backdrop-blur-xl border-b border-ink-800 z-50 shrink-0 shadow-md">
        <div className="flex items-center gap-2 pl-1">
          <div className="w-7 h-7 bg-gradient-to-br from-azure-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
            <Film size={14} className="text-white" />
          </div>
          <span className="text-sm font-black text-white tracking-widest uppercase">SINEVIA</span>
        </div>
        
        <button
          onClick={() => onTabChange('settings')}
          className={`p-2 rounded-xl transition-all ${
            activeTab === 'settings' ? 'bg-ink-800 text-white border border-ink-700' : 'text-ink-400 hover:text-white'
          }`}
        >
          <Settings size={18} />
        </button>
      </nav>

      {/* MOBİL YATAY KAYDIRILABİLİR İKİNCİ SEKME ÇUBUĞU (Üst Kısım) */}
      <div className="md:hidden flex items-center gap-1.5 px-3 py-2 bg-ink-950/90 border-b border-ink-800/80 overflow-x-auto hide-scrollbar z-40 shrink-0">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const isAI = item.id === 'ai';
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                isActive 
                  ? isAI
                      ? 'text-azure-300 bg-azure-500/20 border border-azure-500/30 shadow-sm'
                      : 'text-white bg-ink-800 border border-ink-700 shadow-sm'
                  : isAI
                      ? 'text-azure-400/80 bg-azure-500/5 hover:bg-azure-500/1ny'
                      : 'text-ink-400 bg-ink-900/50 hover:bg-ink-800/50 hover:text-ink-200'
              }`}
            >
              <item.icon size={15} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* MASÜSTÜ SOL SIDEBAR (Büyük ekranlar için) */}
      <aside className="hidden md:flex flex-col w-56 bg-ink-950/80 backdrop-blur-2xl border-r border-ink-800/60 shrink-0 shadow-2xl z-20">
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

      {/* ANA İÇERİK ALANI */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-ink-950 relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gold-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-azure-500/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 hide-scrollbar relative z-10">
          <div className="max-w-7xl mx-auto pb-12 md:pb-0">
            {children}
          </div>
        </div>
      </main>

    </div>
  );
}