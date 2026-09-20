import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ACHIEVEMENT_DEFS, TIER_COLORS, TIER_ORDER } from '../lib/achievements';
import { levelFromXp } from '../lib/xp';

type SortMode = 'newest' | 'oldest' | 'az' | 'za';
type FilterMode = 'all' | 'unlocked' | 'locked';

export default function AchievementsPage() {
  const { data } = useApp();
  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');

  const lvl = levelFromXp(data.totalXp || 0);
  const progressMap = new Map((data.achievements || []).map((a) => [a.achievementId, a]));

  const displayAchievements: any[] = [];
  const tierStats: Record<string, { total: number; unlocked: number }> = {};
  
  TIER_ORDER.forEach((t) => {
    tierStats[t] = { total: 0, unlocked: 0 };
  });

  ACHIEVEMENT_DEFS.forEach((def) => {
    const prog = progressMap.get(def.id);
    const unlockedTiers = prog?.unlockedTiers || [];

    def.tiers.forEach((tier) => {
      if (tierStats[tier.tier]) {
        tierStats[tier.tier].total += 1;
        if (unlockedTiers.includes(tier.tier)) {
          tierStats[tier.tier].unlocked += 1;
        }
      }

      if (unlockedTiers.includes(tier.tier)) {
        const unlockedAt = prog?.tierDates?.[tier.tier] || prog?.unlockedAt || '2000-01-01T00:00:00.000Z';
        displayAchievements.push({
          id: `${def.id}_${tier.tier}`,
          def,
          tier,
          isUnlocked: true,
          unlockedAt,
          current: prog?.current || 0
        });
      } else {
        if (!def.secret || data.showLockedNames) {
          displayAchievements.push({
            id: `${def.id}_${tier.tier}_locked`,
            def,
            tier,
            isUnlocked: false,
            unlockedAt: null,
            current: prog?.current || 0
          });
        }
      }
    });
  });

  let filteredAchievements = displayAchievements.filter((a) => {
    if (activeTier && a.tier.tier !== activeTier) return false;
    if (filterMode === 'unlocked' && !a.isUnlocked) return false;
    if (filterMode === 'locked' && a.isUnlocked) return false;
    if (search.trim()) {
      const q = search.toLocaleLowerCase('tr-TR');
      const name = (a.tier.name || a.def.name).toLocaleLowerCase('tr-TR');
      return name.includes(q);
    }
    return true;
  });

  filteredAchievements.sort((a, b) => {
    const aIsUnlockedSecret = a.isUnlocked && a.def.secret;
    const bIsUnlockedSecret = b.isUnlocked && b.def.secret;
    if (aIsUnlockedSecret && !bIsUnlockedSecret) return -1;
    if (!aIsUnlockedSecret && bIsUnlockedSecret) return 1;

    if (a.isUnlocked && !b.isUnlocked) return -1;
    if (!a.isUnlocked && b.isUnlocked) return 1;

    const nameA = a.tier.name || a.def.name;
    const nameB = b.tier.name || b.def.name;

    if (a.isUnlocked && b.isUnlocked) {
      if (sortMode === 'az') return nameA.localeCompare(nameB, 'tr-TR');
      if (sortMode === 'za') return nameB.localeCompare(nameA, 'tr-TR');
      const dA = new Date(a.unlockedAt).getTime();
      const dB = new Date(b.unlockedAt).getTime();
      if (dA !== dB) return sortMode === 'newest' ? dB - dA : dA - dB;
    }

    if (!a.isUnlocked && !b.isUnlocked) {
      if (a.def.secret && !b.def.secret) return 1;
      if (!a.def.secret && b.def.secret) return -1;
      if (sortMode === 'az' || sortMode === 'newest') return nameA.localeCompare(nameB, 'tr-TR');
      if (sortMode === 'za' || sortMode === 'oldest') return nameB.localeCompare(nameA, 'tr-TR');
    }
    return 0;
  });

  const formatDateTime = (dateString: string) => {
    try {
      return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));
    } catch { return ''; }
  };

  const totalPossibleTiers = ACHIEVEMENT_DEFS.reduce((sum, def) => sum + (!def.secret || data.showLockedNames ? def.tiers.length : 0), 0);
  const unlockedTiersCount = displayAchievements.filter((a) => a.isUnlocked).length;
  const isTestMode = data.showLockedNames;

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-ink-100 flex items-center gap-2 md:gap-2.5">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-br from-gold-500/20 to-gold-500/20 border border-gold-500/30 flex items-center justify-center">
            <Icons.Trophy size={18} className="text-gold-300 md:w-[22px] md:h-[22px]" />
          </div>
          Başarımlar
        </h1>
      </div>

      <div className="relative bg-gradient-to-br from-ink-950 to-ink-900 border border-ink-800 rounded-2xl md:rounded-[2rem] p-4 md:p-6 shadow-xl md:shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-gold-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-4 md:gap-10">
          <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br from-gold-600 to-gold-400 p-0.5 shadow-lg shadow-gold-500/30 rotate-3">
              <div className="w-full h-full bg-ink-950 rounded-[10px] md:rounded-[14px] flex items-center justify-center -rotate-3">
                <Icons.Crown className="text-gold-400 w-6 h-6 md:w-7 md:h-7" />
              </div>
            </div>
            <div>
              <div className="text-[10px] md:text-xs font-black text-gold-500 tracking-widest uppercase mb-0.5">Mevcut Seviyen</div>
              <div className="text-2xl md:text-3xl font-black text-white leading-none">Lvl. {lvl.level}</div>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col md:flex-row items-center gap-4 md:gap-6">
            <div className="flex-1 w-full">
              <div className="flex justify-between text-xs md:text-sm font-black text-ink-200 mb-1.5 md:mb-2 uppercase tracking-widest">
                <span>Mevcut: {(data.totalXp || 0).toLocaleString()} XP</span>
              </div>
              <div className="h-3 md:h-4 w-full bg-ink-950 rounded-full overflow-hidden border border-ink-800/80 shadow-inner relative">
                <div 
                  className="h-full bg-gradient-to-r from-gold-700 via-gold-500 to-yellow-300 transition-all duration-1000 relative" 
                  style={{ width: `${Math.max(2, lvl.progress)}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
              <div className="text-center text-[10px] md:text-sm text-ink-400 mt-2 md:mt-3 font-bold uppercase tracking-widest">
                Sonraki Seviyeye <span className="text-gold-400">{Math.max(0, lvl.nextLevelXp - lvl.currentLevelXp).toLocaleString()} XP</span> Kaldı
              </div>
            </div>

            <div className="flex flex-row md:flex-col items-center justify-between md:justify-center border-t md:border-t-0 md:border-l border-ink-800/80 pt-3 md:pt-0 md:pl-6 w-full md:w-auto mt-1 md:mt-0">
              <span className="text-[10px] md:text-xs font-black text-gold-500 uppercase tracking-widest mb-0 md:mb-1">Toplanan Kupalar</span>
              <span className="text-xl md:text-3xl font-black text-white whitespace-nowrap">
                {unlockedTiersCount} <span className="text-sm md:text-lg text-ink-500">/ {totalPossibleTiers}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 md:space-y-4">
        <div className="flex flex-col md:flex-row gap-2 md:gap-3">
          <div className="relative flex-1">
            <Icons.Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500 md:w-[18px] md:h-[18px]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Başarım ara..."
              className="w-full bg-ink-800/80 border border-ink-700 rounded-xl pl-10 pr-4 py-2 md:py-2.5 text-xs md:text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/30 transition-all shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
            <div className="flex flex-shrink-0 bg-ink-800/50 rounded-xl p-1 md:p-1.5 border border-ink-700/50">
              <button onClick={() => setFilterMode('all')} className={`px-2.5 py-1.5 md:px-3 md:py-1.5 text-[11px] md:text-xs font-bold rounded-lg transition-all ${filterMode === 'all' ? 'bg-ink-700 text-white shadow-sm' : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/50'}`}>Tümü</button>
              <button onClick={() => setFilterMode('unlocked')} className={`px-2.5 py-1.5 md:px-3 md:py-1.5 text-[11px] md:text-xs font-bold rounded-lg transition-all ${filterMode === 'unlocked' ? 'bg-gold-500/20 text-gold-400 shadow-sm' : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/50'}`}>Açıklar</button>
              <button onClick={() => setFilterMode('locked')} className={`px-2.5 py-1.5 md:px-3 md:py-1.5 text-[11px] md:text-xs font-bold rounded-lg transition-all ${filterMode === 'locked' ? 'bg-ink-700 text-white shadow-sm' : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/50'}`}>Kilitliler</button>
            </div>
            <div className="flex flex-shrink-0 bg-ink-800/50 rounded-xl p-1 md:p-1.5 border border-ink-700/50">
              <button onClick={() => setSortMode('newest')} className={`px-2.5 py-1.5 md:px-3 md:py-1.5 text-[11px] md:text-xs font-bold rounded-lg transition-all flex items-center gap-1 md:gap-1.5 ${sortMode === 'newest' ? 'bg-ink-700 text-white shadow-sm' : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/50'}`}><Icons.Clock size={12} className="md:w-3.5 md:h-3.5"/> Yeni</button>
              <button onClick={() => setSortMode('oldest')} className={`px-2.5 py-1.5 md:px-3 md:py-1.5 text-[11px] md:text-xs font-bold rounded-lg transition-all flex items-center gap-1 md:gap-1.5 ${sortMode === 'oldest' ? 'bg-ink-700 text-white shadow-sm' : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/50'}`}>Eski</button>
              <button onClick={() => setSortMode('az')} className={`px-2.5 py-1.5 md:px-3 md:py-1.5 text-[11px] md:text-xs font-bold rounded-lg transition-all flex items-center gap-1 md:gap-1.5 ${sortMode === 'az' ? 'bg-ink-700 text-white shadow-sm' : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/50'}`}><Icons.ArrowDownAZ size={12} className="md:w-3.5 md:h-3.5" /> A-Z</button>
            </div>
          </div>
        </div>

        <div className="flex overflow-x-auto md:flex-wrap gap-2 md:gap-2.5 pt-1 md:pt-2 pb-2 md:pb-0 hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          <button 
            onClick={() => setActiveTier(null)} 
            className={`flex-shrink-0 px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all duration-300 border ${
              activeTier === null 
                ? 'bg-ink-700 border-ink-500 text-white shadow-md' 
                : 'bg-ink-800/60 border-ink-700/50 text-ink-400 hover:bg-ink-700 hover:text-ink-200'
            }`}
          >
            Tüm Kademeler
          </button>
          
          {TIER_ORDER.map((tier) => {
            const tierInfo = TIER_COLORS[tier];
            const LegendIcon = (Icons as any)[tierInfo?.icon] || Icons.Award;
            const isActive = activeTier === tier;
            const stats = tierStats[tier];
            
            return (
              <button 
                key={tier} 
                onClick={() => setActiveTier(isActive ? null : tier)} 
                className={`group flex-shrink-0 relative flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all duration-300 border overflow-hidden ${tierInfo?.bg} ${
                  isActive 
                    ? `border-white/30 text-white shadow-[0_0_15px_rgba(0,0,0,0.3)] md:scale-105` 
                    : `border-transparent ${tierInfo?.text} md:hover:scale-105 opacity-80 hover:opacity-100`
                }`}
              >
                {isActive && <div className="absolute inset-0 bg-white/15" />}
                <LegendIcon size={14} className={isActive ? 'text-white md:w-4 md:h-4' : 'md:w-4 md:h-4'} />
                <span className="relative z-10">{tierInfo?.label}</span>
                
                <span className={`relative z-10 ml-0.5 md:ml-1 px-1.5 py-0.5 rounded-md shadow-inner text-[9px] md:text-[10px] tracking-widest ${
                  isActive ? 'bg-black/30 text-white' : 'bg-black/20 text-white/90'
                }`}>
                  {stats.unlocked}/{stats.total}
                </span>
              </button>
            );
          })}
        </div>
        
        {activeTier && (
          <div className={`mt-2 md:mt-4 border border-ink-700/50 rounded-xl p-4 md:p-5 flex flex-col gap-2 md:gap-3 animate-fade-in-up shadow-lg relative overflow-hidden bg-ink-900/40`}>
            <div className={`absolute inset-0 opacity-10 ${TIER_COLORS[activeTier].bg}`} />
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-2.5">
                {React.createElement((Icons as any)[TIER_COLORS[activeTier].icon] || Icons.Award, { size: 18, className: `${TIER_COLORS[activeTier].text} md:w-5 md:h-5` })}
                <span className={`text-sm md:text-base font-bold uppercase tracking-widest ${TIER_COLORS[activeTier].text}`}>{TIER_COLORS[activeTier].label} SERÜVENİ</span>
              </div>
              <div className="text-base md:text-lg font-black text-ink-100">
                {tierStats[activeTier].unlocked} <span className="text-ink-500 font-bold">/ {tierStats[activeTier].total}</span>
              </div>
            </div>
            <div className="relative z-10 h-2 md:h-2.5 w-full bg-ink-950 rounded-full overflow-hidden shadow-inner border border-ink-800/80">
              <div 
                className={`h-full rounded-full transition-all duration-1000 relative ${TIER_COLORS[activeTier].bg}`}
                style={{ width: `${Math.floor((tierStats[activeTier].unlocked / Math.max(tierStats[activeTier].total, 1)) * 100)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 pb-8 pt-2 md:pt-4">
        {filteredAchievements.map((a) => {
          const tierInfo = TIER_COLORS[a.tier.tier];
          const Icon = a.isUnlocked && tierInfo ? ((Icons as any)[tierInfo.icon] || Icons.Award) : ((Icons as any)[a.def.icon] || Icons.HelpCircle);
          
          const displayName = a.tier.name || a.def.name;
          const parsedDesc = a.def.description.replace('{threshold}', String(a.tier.threshold));

          const isLocked = !a.isUnlocked;
          const isSecretUnlocked = a.isUnlocked && a.def.secret;

          let containerClass = "relative rounded-xl md:rounded-2xl p-3 md:p-4 flex gap-3 md:gap-4 items-start transition-all duration-300 shadow-lg border flex-row ";
          if (isLocked) {
            containerClass += "bg-ink-900/60 border-ink-800/50 hover:bg-ink-800/60 ";
          } else if (isSecretUnlocked) {
            containerClass += "bg-gradient-to-br from-fuchsia-900/40 to-purple-900/20 border-fuchsia-500/50 shadow-[0_0_20px_rgba(217,70,239,0.15)] overflow-hidden";
          } else {
            containerClass += `bg-gradient-to-br from-ink-800/90 to-ink-900 hover:shadow-xl ${tierInfo?.border || 'border-ink-700'}`;
          }

          let iconWrapperClass = `w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner `;
          if (isLocked) iconWrapperClass += 'bg-ink-950 border border-ink-800/50';
          else iconWrapperClass += tierInfo?.bg;

          const iconColorClass = isLocked && !isTestMode ? 'text-ink-600' : (isSecretUnlocked ? tierInfo?.text : tierInfo?.text);

          const current = Math.min(a.current, a.tier.threshold);
          const target = a.tier.threshold;
          const percentage = Math.floor((current / target) * 100);

          return (
            <div key={a.id} className={containerClass}>
              {isSecretUnlocked && (
                <div className="absolute -top-4 -right-4 p-4 opacity-20 pointer-events-none">
                  <Icons.Sparkles size={48} className="text-fuchsia-400 md:w-16 md:h-16" />
                </div>
              )}

              <div className={iconWrapperClass}>
                <Icon size={20} className={`${iconColorClass} md:w-[26px] md:h-[26px]`} />
              </div>

              <div className="flex-1 min-w-0 w-full relative z-10 flex flex-col justify-between h-full">
                <div className="flex-1">
                  
                  <div className="flex items-start justify-between mb-1.5 md:mb-2">
                    <div className="flex items-center gap-1.5 md:gap-2 flex-wrap pr-2">
                      <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 md:px-2 md:py-0.5 rounded shadow-sm ${tierInfo?.bg} ${tierInfo?.text}`}>
                        {tierInfo?.label}
                      </span>
                      
                      <span className={`text-[9px] md:text-[10px] font-black px-1.5 py-0.5 md:px-2 md:py-0.5 rounded flex items-center gap-1 bg-ink-950/50 border border-ink-800 ${isLocked ? 'text-gold-500/70' : 'text-gold-400'}`}>
                        <Icons.Star size={8} className={`md:w-2.5 md:h-2.5 ${isLocked ? 'text-gold-500/50' : 'text-gold-500'}`} />
                        +{a.tier.xp} XP
                      </span>

                      {a.def.secret && (
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 md:px-2 md:py-0.5 rounded border bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30">
                          Gizli
                        </span>
                      )}

                      {!isLocked && (
                        <span className={`text-[9px] md:text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${isSecretUnlocked ? 'text-fuchsia-300' : 'text-green-500'}`}>
                          <Icons.CheckCircle2 size={10} className="md:w-3 md:h-3" /> Tamamlandı
                        </span>
                      )}
                    </div>

                    {!isLocked && a.unlockedAt && (
                      <div className={`text-[10px] md:text-xs font-semibold mt-0.5 flex-shrink-0 ${isSecretUnlocked ? 'text-fuchsia-400/70' : 'text-ink-400'}`}>
                        {formatDateTime(a.unlockedAt)}
                      </div>
                    )}
                  </div>

                  <h3 className={`text-sm md:text-base font-black truncate tracking-tight mb-0.5 md:mb-1 ${isSecretUnlocked ? 'text-fuchsia-100' : 'text-white'}`}>
                    {displayName}
                  </h3>
                  <p className={`text-xs md:text-sm leading-relaxed ${isSecretUnlocked ? 'text-fuchsia-200/80' : 'text-ink-300'}`}>
                    {isLocked && !isTestMode ? 'Bu kupanın sırrını çözmek için izlemeye devam et.' : parsedDesc}
                  </p>
                </div>

                {isLocked && (
                  <div className="mt-3 md:mt-4 pt-1">
                    <div className="flex justify-between items-end mb-1 md:mb-1.5">
                      <span className="text-[10px] md:text-xs font-bold text-ink-400">{current} / {target}</span>
                      <span className="text-sm md:text-lg font-black text-white drop-shadow-md tracking-tight">
                        % {percentage}
                      </span>
                    </div>
                    <div className="h-1.5 md:h-2 w-full bg-ink-950 rounded-full overflow-hidden shadow-inner border border-ink-800">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${tierInfo?.bg}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        {filteredAchievements.length === 0 && (
          <div className="col-span-full text-center py-10 md:py-12 text-ink-500 text-xs md:text-sm font-medium bg-ink-900/30 rounded-2xl border border-ink-800/50">
            <Icons.SearchX size={28} className="mx-auto mb-2 md:mb-3 text-ink-600 md:w-8 md:h-8" />
            Arama ve filtreleme kriterlerine uygun başarım bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}