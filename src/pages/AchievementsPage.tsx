import React, { useState, useMemo } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ACHIEVEMENT_DEFS, TIER_COLORS, TIER_ORDER } from '../lib/achievements';
import { levelFromXp } from '../lib/xp';
import { RANK_TIERS } from '../lib/rankTiers';

// YENİ: Bizim hazırladığımız Görev Panosu Bileşeni
import QuestBoard from '../components/QuestBoard';

// ============================================================
// PREMIUM CAM ROZET STİLLERİ (sinevia-premium.html §06 kriteri)
// Tüm renkler tema CSS değişkenlerine bağlıdır:
// premium tokenlar önce gelir (--red/--red-hi/--red-deep, --glass, --surface,
// --line-2, --r, --r-lg, --shadow), plain-dark gibi token tanımsız
// temalar için zincirleme fallback: --color-1/2/3 → sabit değer.
// ============================================================
const ACHV_PREMIUM_CSS = `
.achv-card{
  position:relative; overflow:hidden;
  background:var(--glass, var(--bg-card, rgba(255,255,255,.05)));
  border:1px solid var(--line-2, var(--border-dim, rgba(244,244,242,.13)));
  border-radius:var(--r, 16px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
  transition:transform .24s cubic-bezier(.2,.7,.3,1), box-shadow .24s, border-color .24s;
}
.achv-card.is-locked{
  background:var(--glass, var(--bg-card, rgba(255,255,255,.05)));
}
.achv-card:hover{
  transform:translateX(4px);
  border-color:rgba(232,56,79,.45);
  box-shadow:0 10px 28px -14px rgba(0,0,0,.9), -4px 0 24px -14px rgba(232,56,79,.7);
}
.achv-card.is-locked:hover{
  transform:none;
}
.achv-topline{
  position:absolute; top:0; left:0; right:0; height:3px; z-index:3;
  background:linear-gradient(90deg, var(--red-deep, var(--color-3, #8e1220)), var(--red, var(--color-1, #e8384f)) 55%, var(--red-hi, var(--color-2, #ff6b7a)));
}
.achv-card.is-locked .achv-topline{
  height:1px;
  background:linear-gradient(90deg, transparent, rgba(255,255,255,.12), transparent);
}
.achv-body{ transition:opacity .3s ease, filter .3s ease; }
.achv-card.is-locked .achv-body{ filter:grayscale(1); opacity:.6; }
.achv-card.is-locked:hover .achv-body{ filter:grayscale(.35); opacity:.86; }
.achv-medal{
  width:44px; height:44px; flex-shrink:0;
  border:1px solid var(--line-2, var(--border-dim, rgba(244,244,242,.13)));
  border-radius:13px;
  background:rgba(255,255,255,.05);
  display:grid; place-items:center;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.10), 0 10px 24px -12px rgba(0,0,0,.9);
}
.achv-medal.gold{ border-color:rgba(229,193,59,.55); color:#EFC94C; background:rgba(229,193,59,.1); box-shadow:0 0 20px -6px rgba(229,193,59,.6), inset 0 1px 0 rgba(255,255,255,.10), 0 10px 24px -12px rgba(0,0,0,.9); }
.achv-medal.silver{ border-color:rgba(201,205,212,.45); color:#D3D7DE; background:rgba(201,205,212,.08); box-shadow:inset 0 1px 0 rgba(255,255,255,.10), 0 10px 24px -12px rgba(0,0,0,.9); }
.achv-card:not(.is-locked) .achv-medal:not(.gold):not(.silver){
  border-color:rgba(255,255,255,.28);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.38), 0 12px 26px -12px rgba(0,0,0,.9), 0 0 26px -8px var(--red, var(--color-1, #e8384f));
}
.achv-xp{
  position:absolute; right:0; bottom:0; z-index:4;
  display:inline-flex; align-items:center; gap:5px;
  padding:5px 12px; font-size:10px; font-weight:900; letter-spacing:.08em; text-transform:uppercase;
  font-family:'JetBrains Mono',monospace;
  color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.4);
  background:linear-gradient(135deg, var(--red-hi, var(--color-2, #ff6b7a)), var(--red, var(--color-1, #e8384f)) 55%, var(--red-deep, var(--color-3, #8e1220)) 130%);
  border-top-left-radius:14px;
  border-bottom-right-radius:var(--r, 16px);
  box-shadow:-6px -6px 22px -8px var(--red, var(--color-1, #e8384f)), inset 0 1px 0 rgba(255,255,255,.35);
}
.achv-card .achv-body span{ font-family:'JetBrains Mono',monospace; }
.achv-track{
  position:relative; overflow:hidden;
  height:8px;
  background:rgba(0,0,0,.5);
  border:1px solid var(--line-2, var(--border-dim, rgba(244,244,242,.13)));
  border-radius:99px;
  box-shadow:inset 0 1px 3px rgba(0,0,0,.7);
}
.achv-fill{
  position:absolute; top:0; bottom:0; left:0; border-radius:99px;
  background:linear-gradient(90deg, var(--red-deep, var(--color-3, #8e1220)), var(--red, var(--color-1, #e8384f)) 55%, var(--red-hi, var(--color-2, #ff6b7a)));
  box-shadow:0 0 12px rgba(232,56,79,.7);
  transition:width 1s ease;
}
.achv-fill::after{
  content:''; position:absolute; inset:0;
  background:linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent);
  transform:translateX(-100%);
}
.achv-card:hover .achv-fill::after{ animation:achvShine 1.4s ease; }
@keyframes achvShine{ from{ transform:translateX(-100%);} to{ transform:translateX(100%);} }
.achv-search{
  background:var(--surface, rgba(255,255,255,.05));
  border:1px solid var(--line-2, var(--border-dim, rgba(244,244,242,.13)));
  border-radius:14px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
  transition:border-color .25s, box-shadow .25s, background .25s;
}
.achv-search:focus{
  border-color:var(--red, var(--color-1, #e8384f));
  background:var(--bg-card, rgba(255,255,255,.07));
  box-shadow:0 0 0 4px var(--blob-1, rgba(232,56,79,.16)), inset 0 1px 0 rgba(255,255,255,.08);
}
.achv-chip{
  position:relative;
  background:var(--surface, rgba(255,255,255,.04));
  border:1px solid var(--line-2, var(--border-dim, rgba(244,244,242,.13)));
  border-radius:11px;
  transition:transform .22s cubic-bezier(.2,.7,.3,1), box-shadow .22s;
}
.achv-chip:hover{ transform:translateY(-2px); box-shadow:0 6px 16px -8px rgba(0,0,0,.55); }
.achv-chip.on{
  background:linear-gradient(140deg, var(--red-hi, var(--color-2, #ff6b7a)), var(--red-deep, var(--color-3, #8e1220)));
  border-color:transparent; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.35);
  box-shadow:0 8px 22px -8px var(--red, var(--color-1, #e8384f)), inset 0 1px 0 rgba(255,255,255,.35);
}
.achv-panel{
  background:var(--glass, var(--bg-card, rgba(255,255,255,.05)));
  border:1px solid var(--line-2, var(--border-dim, rgba(244,244,242,.13)));
  border-radius:var(--r-lg, 22px);
  box-shadow:var(--shadow, 0 24px 60px -24px rgba(0,0,0,.8)), inset 0 1px 0 rgba(255,255,255,.07);
  overflow:hidden;
}
`;

type SortMode = 'newest' | 'oldest' | 'az' | 'za';
type FilterMode = 'all' | 'unlocked' | 'locked';
type ViewTab = 'trophies' | 'quests'; // Yeni Sekme Sistemi

export default function AchievementsPage() {
  const { data } = useApp();
  const [activeTab, setActiveTab] = useState<ViewTab>('trophies');
  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');

  const lvl = levelFromXp(data.totalXp || 0);
  const progressMap = new Map((data.achievements || []).map((a) => [a.achievementId, a]));

  const currentRankIndex = useMemo(() => {
    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
      if (lvl.level >= RANK_TIERS[i].minLevel) return i;
    }
    return 0;
  }, [lvl.level]);

  const userPersona = RANK_TIERS[currentRankIndex];
  const nextRank = RANK_TIERS[currentRankIndex + 1] || null;
  const PersonaIcon = userPersona.icon;

  const circleRadius = 46;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleOffset = circleCircumference - (Math.min(100, Math.max(0, lvl.progress)) / 100) * circleCircumference;

  const displayAchievements: any[] = [];
  const tierStats: Record<string, { total: number; unlocked: number }> = {};

  TIER_ORDER.forEach((t: string) => {
    tierStats[t] = { total: 0, unlocked: 0 };
  });

  ACHIEVEMENT_DEFS.forEach((def: any) => {
    // GİZLİ (secret) başarım listede HİÇ GÖRÜNMEZ — yalnızca test modunda
    if (def.secret && !data.showLockedNames) return;
    const prog = progressMap.get(def.id);
    const unlockedTiers = prog?.unlockedTiers || [];

    def.tiers.forEach((tier: any) => {
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
          def, tier, isUnlocked: true, unlockedAt, current: prog?.current || 0,
        });
      } else {
        displayAchievements.push({
          id: `${def.id}_${tier.tier}_locked`,
          def, tier, isUnlocked: false, unlockedAt: null, current: prog?.current || 0,
        });
      }
    });
  });

  const filteredAchievements = displayAchievements.filter((a) => {
    if (activeTier && a.tier.tier !== activeTier) return false;
    if (filterMode === 'unlocked' && !a.isUnlocked) return false;
    if (filterMode === 'locked' && a.isUnlocked) return false;
    if (search.trim()) {
      const q = search.toLocaleLowerCase('tr-TR');
      const tierName = (a.tier.name || '').toLocaleLowerCase('tr-TR');
      const defName = (a.def.name || '').toLocaleLowerCase('tr-TR');
      const parsedDesc = a.def.description
        .replace('{threshold}', String(a.tier.threshold))
        .toLocaleLowerCase('tr-TR');
      const category = (a.def.category || '').toLocaleLowerCase('tr-TR');

      return (
        tierName.includes(q) ||
        defName.includes(q) ||
        parsedDesc.includes(q) ||
        category.includes(q)
      );
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
      return new Intl.DateTimeFormat('tr-TR', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }).format(new Date(dateString));
    } catch {
      return '';
    }
  };

  const totalPossibleTiers = ACHIEVEMENT_DEFS.reduce(
    (sum: number, def: any) => sum + (!def.secret || data.showLockedNames ? def.tiers.length : 0),
    0
  );
  const unlockedTiersCount = displayAchievements.filter((a) => a.isUnlocked).length;
  const trophyCompletionPct = totalPossibleTiers > 0 ? Math.round((unlockedTiersCount / totalPossibleTiers) * 100) : 0;
  const isTestMode = data.showLockedNames;

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <style>{ACHV_PREMIUM_CSS}</style>

      {/* ÜST BAŞLIK VE SEKME (TAB) SEÇİCİ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl md:text-2xl font-bold text-ink-100 flex items-center gap-2.5">
          <div
            className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--red-hi, var(--color-2, #ff6b7a)), var(--red-deep, var(--color-3, #8e1220)))',
              boxShadow: '0 6px 18px -6px var(--red, var(--color-1, #e8384f)), inset 0 1px 0 rgba(255,255,255,.35)',
            }}
          >
            <Icons.Trophy size={20} style={{ color: '#fff' }} />
          </div>
          <div>
            <span>Ödüller & Kariyer</span>
          </div>
        </h1>

        <div
          data-tutorial="ach-tabs"
          className="flex p-1 rounded-2xl w-full sm:w-auto"
          style={{
            background: 'var(--surface, rgba(255,255,255,.04))',
            border: '1px solid var(--line-2, var(--border-dim, rgba(244,244,242,.13)))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)',
          }}
        >
          <button
            onClick={() => setActiveTab('trophies')}
            className={`flex-1 sm:w-36 flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-11 sm:min-h-0 rounded-xl text-xs font-black transition-all ${
              activeTab === 'trophies' ? 'scale-[1.02]' : 'text-ink-400 hover:text-ink-200'
            }`}
            style={
              activeTab === 'trophies'
                ? {
                    background: 'linear-gradient(140deg, var(--red-hi, var(--color-2, #ff6b7a)), var(--red-deep, var(--color-3, #8e1220)))',
                    color: '#fff',
                    textShadow: '0 1px 2px rgba(0,0,0,.35)',
                    boxShadow: '0 8px 22px -8px var(--red, var(--color-1, #e8384f)), inset 0 1px 0 rgba(255,255,255,.35)',
                  }
                : undefined
            }
          >
            <Icons.Medal size={14} /> KUPA KASASI
          </button>
          <button
            onClick={() => setActiveTab('quests')}
            className={`flex-1 sm:w-36 flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-11 sm:min-h-0 rounded-xl text-xs font-black transition-all ${
              activeTab === 'quests' ? 'scale-[1.02]' : 'text-ink-400 hover:text-ink-200'
            }`}
            style={
              activeTab === 'quests'
                ? {
                    background: 'linear-gradient(140deg, #a78bfa, #6d28d9)',
                    color: '#fff',
                    textShadow: '0 1px 2px rgba(0,0,0,.35)',
                    boxShadow: '0 8px 22px -8px rgba(139,92,246,.7), inset 0 1px 0 rgba(255,255,255,.35)',
                  }
                : undefined
            }
          >
            <Icons.Target size={14} /> GÖREV PANOSU
          </button>
        </div>
      </div>

      {/* YENİ OYUNLAŞTIRMA SEKME İÇERİĞİ: GÖREV PANOSU */}
      {activeTab === 'quests' && (
        <QuestBoard />
      )}

      {/* ESKİ ANA İÇERİK: PASİF BAŞARIMLAR VE RÜTBE ARENASI */}
      {activeTab === 'trophies' && (
        <div className="space-y-4 md:space-y-6 animate-fade-in-up">
          {/* SEVİYE, XP & KUPA ARENASI */}
          <div className={`relative bg-gradient-to-br from-ink-950 via-ink-900/95 to-ink-950 border ${userPersona.border} rounded-3xl sm:rounded-[2.2rem] p-4 sm:p-7 shadow-2xl overflow-hidden`}>
            <div className={`absolute -top-24 -right-20 w-72 sm:w-96 h-72 sm:h-96 ${userPersona.bgGlow} rounded-full blur-[100px] pointer-events-none transition-all duration-1000`} />
            <div className={`hidden sm:block absolute -bottom-28 -left-20 w-80 h-80 ${userPersona.bgGlow} rounded-full blur-[100px] pointer-events-none transition-all duration-1000`} />
            <div
              className="hidden sm:block absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.8) 1px, transparent 0)',
                backgroundSize: '24px 24px',
              }}
            />

            <div className="relative z-10 flex flex-col xl:flex-row items-center gap-4 sm:gap-6 xl:gap-7">
              <div className="flex flex-row items-center justify-between sm:justify-start gap-3.5 sm:gap-5 flex-shrink-0 w-full xl:w-auto">
                <div className="flex items-center gap-3.5 sm:gap-5">
                  <div className="relative w-16 h-16 sm:w-28 sm:h-28 flex items-center justify-center flex-shrink-0">
                    <div className={`absolute inset-1 sm:inset-2 rounded-full bg-gradient-to-br ${userPersona.gradient} opacity-25 blur-lg sm:blur-xl animate-pulse`} />

                    <svg className="w-16 h-16 sm:w-28 sm:h-28 -rotate-90 transform" viewBox="0 0 108 108">
                      <circle cx="54" cy="54" r={circleRadius} stroke="currentColor" strokeWidth="7" fill="transparent" className="text-ink-950" />
                      <circle
                        cx="54" cy="54" r={circleRadius} stroke={userPersona.strokeColor} strokeWidth="7"
                        strokeDasharray={circleCircumference} strokeDashoffset={circleOffset} strokeLinecap="round"
                        fill="transparent" className="transition-all duration-1000 ease-out"
                      />
                    </svg>

                    <div className={`absolute inset-2.5 sm:inset-4 rounded-full bg-gradient-to-br ${userPersona.gradient} p-0.5 shadow-2xl`}>
                      <div className="w-full h-full bg-ink-950 rounded-full flex flex-col items-center justify-center">
                        <PersonaIcon className={`${userPersona.color} w-5 h-5 sm:w-[30px] sm:h-[30px]`} />
                        <span className="hidden sm:block text-[10px] font-black text-ink-400 uppercase mt-0.5">
                          %{Math.floor(lvl.progress)}
                        </span>
                      </div>
                    </div>

                    <div className={`hidden sm:block absolute -bottom-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r ${userPersona.gradient} text-ink-950 font-black text-xs shadow-lg border border-white/30`}>
                      SV. {lvl.level}
                    </div>
                  </div>

                  <div className="text-left">
                    <span className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest border mb-1 ${userPersona.badgeBg} ${userPersona.color} ${userPersona.border}`}>
                      <Icons.Sparkles size={10} /> {userPersona.title}
                    </span>
                    <div className="text-2xl sm:text-4xl font-black text-ink-50 tracking-tight leading-none">
                      Seviye {lvl.level}
                    </div>
                    <p className="hidden sm:block text-xs text-ink-400 mt-1.5 max-w-[230px] leading-relaxed">
                      {userPersona.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex sm:hidden flex-col items-end bg-ink-950/90 border border-gold-500/30 px-3 py-1.5 rounded-2xl">
                  <span className="text-[9px] font-black uppercase tracking-wider text-gold-400">Kupalar</span>
                  <div className="text-base font-black text-white leading-tight">
                    {unlockedTiersCount} <span className="text-xs font-bold text-ink-500">/ {totalPossibleTiers}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full bg-ink-950/75 border border-ink-800/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-inner space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-ink-400">Toplam Deneyim Puanı</span>
                    <div className="text-sm sm:text-xl font-black text-ink-50 flex items-baseline gap-1.5">
                      <span>{(data.totalXp || 0).toLocaleString('tr-TR')} XP</span>
                      <span className="text-[10px] sm:text-xs font-bold text-ink-400">(%{Math.floor(lvl.progress)})</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-ink-400">Seviye {lvl.level + 1} Hedefi</span>
                    <span className={`text-xs sm:text-sm font-black ${userPersona.color}`}>
                      {Math.max(0, lvl.nextLevelXp - lvl.currentLevelXp).toLocaleString('tr-TR')} XP Kaldı
                    </span>
                  </div>
                </div>

                <div className="relative h-3 sm:h-5 w-full bg-ink-900 rounded-lg sm:rounded-xl overflow-hidden border border-ink-700/80 p-0.5 shadow-inner">
                  <div className={`h-full rounded-md sm:rounded-lg bg-gradient-to-r ${userPersona.barGradient} transition-all duration-1000 relative overflow-hidden`} style={{ width: `${Math.max(3, lvl.progress)}%` }}>
                    <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.35)_50%,transparent_75%)] bg-[length:200%_100%] animate-pulse" />
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_#fff]" />
                  </div>

                  <div className="hidden sm:grid absolute inset-0 grid-cols-20 pointer-events-none">
                    {Array.from({ length: 20 }).map((_, idx) => (
                      <div key={idx} className="border-r border-ink-950/40 last:border-0" />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-ink-400 pt-0.5">
                  <span className="hidden sm:inline">Seviye İlerlemesi: %{Math.floor(lvl.progress)}</span>
                  {nextRank ? (
                    <span className={userPersona.color}>Sonraki Unvan: {nextRank.title} (Sv.{nextRank.minLevel})</span>
                  ) : (
                    <span className="text-zinc-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">Maksimum Unvana Ulaşıldı! 👑</span>
                  )}
                </div>
              </div>

              {/* Sağ: Kupa Koleksiyonu Kasası */}
              <div className="w-full xl:w-[22rem] bg-ink-950/80 border border-gold-500/30 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between gap-3 flex-shrink-0 shadow-xl">
                <div className="hidden sm:flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gold-400 block">Toplanan Kupalar</span>
                    <div className="text-2xl sm:text-3xl font-black text-ink-50 mt-0.5 leading-none">
                      {unlockedTiersCount} <span className="text-sm font-bold text-ink-500">/ {totalPossibleTiers}</span>
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-gold-500/15 border border-gold-500/30 flex flex-col items-center justify-center">
                    <Icons.Trophy size={16} className="text-gold-400" />
                    <span className="text-[10px] font-black text-gold-300">%{trophyCompletionPct}</span>
                  </div>
                </div>

                <div className="hidden sm:block h-2 w-full bg-ink-900 rounded-full overflow-hidden border border-ink-800">
                  <div className="h-full bg-gradient-to-r from-amber-600 via-gold-500 to-yellow-300 rounded-full transition-all duration-700" style={{ width: `${Math.max(2, trophyCompletionPct)}%` }} />
                </div>

                <div className="grid grid-cols-6 gap-1 sm:pt-1 sm:border-t border-ink-800/80 text-center">
                  {[
                    { key: 'bronze', label: 'Bronz', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25' },
                    { key: 'silver', label: 'Gümüş', color: 'text-slate-200', bg: 'bg-slate-400/10 border-slate-400/25' },
                    { key: 'gold', label: 'Altın', color: 'text-yellow-300', bg: 'bg-yellow-500/10 border-yellow-500/25' },
                    { key: 'platinum', label: 'Platin', color: 'text-cyan-200', bg: 'bg-cyan-400/10 border-cyan-400/25' },
                    { key: 'emerald', label: 'Zümrüt', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
                    { key: 'diamond', label: 'Elmas', color: 'text-sky-300', bg: 'bg-sky-500/10 border-sky-500/25' },
                  ].map((gem) => (
                    <button
                      key={gem.key}
                      type="button"
                      onClick={() => setActiveTier(activeTier === gem.key ? null : gem.key)}
                      className={`rounded-xl py-1.5 px-0.5 min-h-11 sm:min-h-0 border transition-all ${gem.bg} ${activeTier === gem.key ? 'ring-2 ring-gold-400 scale-105' : 'hover:brightness-125'}`}
                      title={`${gem.label} Kupalarını Filtrele`}
                    >
                      <div className={`text-[10px] sm:text-xs font-black leading-none ${gem.color}`}>{tierStats[gem.key]?.unlocked || 0}</div>
                      <div className="text-[8px] sm:text-[9px] font-bold text-ink-300 mt-1 truncate">{gem.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="hidden sm:block relative z-10 mt-5 pt-4 border-t border-ink-800/80 w-full">
              <div className="flex gap-2 md:gap-3 pb-2 w-full justify-center">
                {RANK_TIERS.map((tier, idx) => {
                  if (idx < currentRankIndex - 1 || idx > currentRankIndex + 2) return null;

                  const isUnlocked = lvl.level >= tier.minLevel;
                  const isCurrent = idx === currentRankIndex;
                  const TierIcon = tier.icon;
                  
                  return (
                    <div
                      key={tier.title}
                      className={`relative rounded-xl px-4 py-3 border transition-all flex items-center justify-center gap-3 flex-1 min-w-max ${
                        isCurrent ? `${tier.badgeBg}${tier.border} shadow-md scale-[1.02]` : isUnlocked ? 'bg-ink-900/70 border-ink-800/90 opacity-90' : 'bg-ink-950/40 border-ink-800/40 opacity-45'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isUnlocked ? tier.badgeBg : 'bg-ink-900'}`}>
                        {isUnlocked ? <TierIcon size={16} className={tier.color} /> : <Icons.Lock size={14} className="text-ink-500" />}
                      </div>
                      
                      <div className="flex flex-col items-start justify-center">
                        <div className={`text-xs font-black whitespace-nowrap ${isCurrent ? tier.color : isUnlocked ? 'text-ink-100' : 'text-ink-500'}`}>
                          {tier.title}
                        </div>
                        <div className="text-[10px] font-bold text-ink-500 flex items-center gap-1 mt-0.5">
                          <span>Sv. {tier.minLevel}+</span>
                          {isUnlocked && <Icons.CheckCircle2 size={10} className="text-emerald-400" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ARAMA, SIRALAMA VE KADEME FİLTRELERİ */}
          <div className="space-y-3 md:space-y-4">
            <div className="flex flex-col md:flex-row gap-2 md:gap-3">
              <div className="relative flex-1">
                <Icons.Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500 md:w-[18px] md:h-[18px]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Başarım adı, açıklama veya kategori ara..."
                  className="achv-search w-full pl-10 pr-9 py-2 md:py-2.5 text-base md:text-sm text-ink-100 placeholder-ink-500 focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    title="Aramayı Temizle"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white p-1 min-h-9 min-w-9 md:min-h-0 md:min-w-0 md:p-0.5 flex items-center justify-center rounded-full hover:bg-ink-700 transition-colors"
                  >
                    <Icons.X size={15} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                <div className="flex flex-shrink-0 bg-ink-800/50 rounded-xl p-1 md:p-1.5 border border-ink-700/50">
                  <button onClick={() => setFilterMode('all')} className={`achv-chip px-2.5 py-1.5 md:px-3 md:py-1.5 min-h-11 md:min-h-0 text-[11px] md:text-xs font-bold transition-all ${filterMode === 'all' ? 'on' : 'text-ink-400 hover:text-ink-200'}`}>Tümü</button>
                  <button onClick={() => setFilterMode('unlocked')} className={`achv-chip px-2.5 py-1.5 md:px-3 md:py-1.5 min-h-11 md:min-h-0 text-[11px] md:text-xs font-bold transition-all ${filterMode === 'unlocked' ? 'on' : 'text-ink-400 hover:text-ink-200'}`}>Açıklar</button>
                  <button onClick={() => setFilterMode('locked')} className={`achv-chip px-2.5 py-1.5 md:px-3 md:py-1.5 min-h-11 md:min-h-0 text-[11px] md:text-xs font-bold transition-all ${filterMode === 'locked' ? 'on' : 'text-ink-400 hover:text-ink-200'}`}>Kilitliler</button>
                </div>
                <div className="flex flex-shrink-0 bg-ink-800/50 rounded-xl p-1 md:p-1.5 border border-ink-700/50">
                  <button onClick={() => setSortMode('newest')} className={`achv-chip px-2.5 py-1.5 md:px-3 md:py-1.5 min-h-11 md:min-h-0 text-[11px] md:text-xs font-bold transition-all flex items-center gap-1 md:gap-1.5 ${sortMode === 'newest' ? 'on' : 'text-ink-400 hover:text-ink-200'}`}>
                    <Icons.Clock size={12} className="md:w-3.5 md:h-3.5" /> Yeni
                  </button>
                  <button onClick={() => setSortMode('oldest')} className={`achv-chip px-2.5 py-1.5 md:px-3 md:py-1.5 min-h-11 md:min-h-0 text-[11px] md:text-xs font-bold transition-all flex items-center gap-1 md:gap-1.5 ${sortMode === 'oldest' ? 'on' : 'text-ink-400 hover:text-ink-200'}`}>Eski</button>
                  <button onClick={() => setSortMode('az')} className={`achv-chip px-2.5 py-1.5 md:px-3 md:py-1.5 min-h-11 md:min-h-0 text-[11px] md:text-xs font-bold transition-all flex items-center gap-1 md:gap-1.5 ${sortMode === 'az' ? 'on' : 'text-ink-400 hover:text-ink-200'}`}>
                    <Icons.ArrowDownAZ size={12} className="md:w-3.5 md:h-3.5" /> A-Z
                  </button>
                </div>
              </div>
            </div>

            <div className="flex overflow-x-auto md:flex-wrap gap-2 md:gap-2.5 pt-1 md:pt-2 pb-2 md:pb-0 hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
              <button
                onClick={() => setActiveTier(null)}
                className={`flex-shrink-0 px-3 py-2 md:px-4 md:py-2.5 min-h-11 md:min-h-0 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all duration-300 border ${
                  activeTier === null ? 'bg-ink-700 border-ink-500 text-white shadow-md' : 'bg-ink-800/60 border-ink-700/50 text-ink-400 hover:bg-ink-700 hover:text-ink-200'
                }`}
              >
                Tüm Kademeler
              </button>

              {TIER_ORDER.map((tier: string) => {
                const tierInfo = (TIER_COLORS as any)[tier];
                const LegendIcon = (Icons as any)[tierInfo?.icon] || Icons.Award;
                const isActive = activeTier === tier;
                const stats = tierStats[tier];

                return (
                  <button
                    key={tier}
                    onClick={() => setActiveTier(isActive ? null : tier)}
                    className={`group flex-shrink-0 relative flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 min-h-11 md:min-h-0 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all duration-300 border overflow-hidden ${tierInfo?.bg} ${
                      isActive ? 'border-white/30 text-white shadow-[0_0_15px_rgba(0,0,0,0.3)] md:scale-105' : `border-transparent ${tierInfo?.text} md:hover:scale-105 opacity-80 hover:opacity-100`
                    }`}
                  >
                    {isActive && <div className="absolute inset-0 bg-white/15" />}
                    <LegendIcon size={14} className={isActive ? 'text-white md:w-4 md:h-4' : 'md:w-4 md:h-4'} />
                    <span className="relative z-10">{tierInfo?.label}</span>
                    <span className={`relative z-10 ml-0.5 md:ml-1 px-1.5 py-0.5 rounded-md shadow-inner text-[9px] md:text-[10px] tracking-widest ${isActive ? 'bg-black/30 text-white' : 'bg-black/20 text-white/90'}`}>
                      {tier !== 'secret' || isTestMode ? `${stats.unlocked}/${stats.total}` : stats.unlocked}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeTier && (
              <div className="achv-panel mt-2 md:mt-4 p-4 md:p-5 flex flex-col gap-2 md:gap-3 animate-fade-in-up relative overflow-hidden">
                <div className={`absolute inset-0 opacity-10 ${(TIER_COLORS as any)[activeTier].bg}`} />
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2 md:gap-2.5">
                    {React.createElement((Icons as any)[(TIER_COLORS as any)[activeTier].icon] || Icons.Award, {
                      size: 18,
                      className: `${(TIER_COLORS as any)[activeTier].text} md:w-5 md:h-5`,
                    })}
                    <span className={`text-sm md:text-base font-bold uppercase tracking-widest ${(TIER_COLORS as any)[activeTier].text}`}>
                      {(TIER_COLORS as any)[activeTier].label} SERÜVENİ
                    </span>
                  </div>
                  <div className="text-base md:text-lg font-black text-ink-100">
                    {tierStats[activeTier].unlocked}
                    {(activeTier !== 'secret' || isTestMode) && <span className="text-ink-500 font-bold"> / {tierStats[activeTier].total}</span>}
                  </div>
                </div>
                {(activeTier !== 'secret' || isTestMode) && (
                  <div className="relative z-10 h-2 md:h-2.5 w-full bg-ink-950 rounded-full overflow-hidden shadow-inner border border-ink-800/80">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 relative ${(TIER_COLORS as any)[activeTier].bg}`}
                      style={{ width: `${Math.floor((tierStats[activeTier].unlocked / Math.max(tierStats[activeTier].total, 1)) * 100)}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BAŞARIM KARTLARI LİSTESİ — geniş ekranda 3 sütun, kartlar girişimde sırayla belirir */}
          <div data-tutorial="ach-grid" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 lg:gap-5 pb-8 pt-2 md:pt-4">
            {filteredAchievements.map((a, index) => {
              const tierInfo = (TIER_COLORS as any)[a.tier.tier];
              const Icon = a.isUnlocked && tierInfo ? (Icons as any)[tierInfo.icon] || Icons.Award : (Icons as any)[a.def.icon] || Icons.HelpCircle;
              const displayName = a.tier.name || a.def.name;
              const parsedDesc = a.def.description.replace('{threshold}', String(a.tier.threshold));
              const isLocked = !a.isUnlocked;
              const isSecret = !!a.def.secret;
              const isGoldTier = a.tier.tier === 'gold';
              const isSilverTier = a.tier.tier === 'silver';

              const current = Math.min(a.current, a.tier.threshold);
              const target = a.tier.threshold;
              const percentage = Math.floor((current / target) * 100);

              return (
                <div
                  key={a.id}
                  className={`achv-card trophy-card group ${isLocked ? 'is-locked' : 'is-open'}`}
                  style={{ animation: 'trophy-rise .5s cubic-bezier(.22,1,.36,1) both', animationDelay: `${Math.min(index, 12) * 45}ms` }}
                >
                  {/* Kademeye/temaya özel premium üst vurgu çizgisi */}
                  <div className="achv-topline" aria-hidden="true" />

                  <div className="relative p-3.5 md:p-4 pb-8 md:pb-9">
                    {/* Kilitli kartlar soluk+gri, açık kartlar tam parlaklıkta */}
                    <div className="achv-body flex gap-3.5 md:gap-4">
                      {/* Cam rozet madalyonu */}
                      <div className="relative shrink-0">
                        <div
                          className={`achv-medal ${isGoldTier ? 'gold' : isSilverTier ? 'silver' : ''} ${!isLocked && !isGoldTier && !isSilverTier ? tierInfo?.bg + ' ' + tierInfo?.text : ''}`}
                          style={isLocked && !isGoldTier && !isSilverTier ? { background: 'var(--bg-card, rgba(255,255,255,.05))' } : undefined}
                        >
                          <Icon size={26} className="md:w-7 md:h-7" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                            <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${tierInfo?.bg} ${tierInfo?.text}`}>
                              {tierInfo?.label}
                            </span>
                            {isSecret && isTestMode && (
                              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30">
                                Gizli
                              </span>
                            )}
                            {!isLocked && (
                              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                                <Icons.CheckCircle2 size={10} className="md:w-3 md:h-3" /> Tamamlandı
                              </span>
                            )}
                          </div>

                          {!isLocked && a.unlockedAt && (
                            <span className="text-[10px] md:text-xs font-semibold text-ink-500 whitespace-nowrap text-right">
                              {formatDateTime(a.unlockedAt)}
                            </span>
                          )}
                        </div>

                        <h3 className={`mt-1.5 text-sm md:text-[15px] font-black tracking-tight leading-snug ${isLocked ? 'text-ink-300' : 'text-white'}`}>
                          {displayName}
                        </h3>
                        <p className={`text-[11px] md:text-xs leading-relaxed mt-0.5 ${isLocked ? 'text-ink-500' : 'text-ink-300'}`}>
                          {isLocked && !isTestMode ? 'Bu kupanın sırrını çözmek için izlemeye devam et.' : parsedDesc}
                        </p>

                        {isLocked && (
                          <div className="mt-2.5">
                            <div className="flex justify-between items-end mb-1">
                              <span className="text-[10px] md:text-xs font-bold text-ink-500">
                                İlerleme: {current} / {target}
                              </span>
                              <span className="text-sm md:text-base font-black text-ink-200 tracking-tight">%{percentage}</span>
                            </div>
                            <div className="achv-track">
                              <div className="achv-fill" style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Alt köşe kırmızı XP rozeti (+150 XP vb.) */}
                  <span className="achv-xp">
                    <Icons.Star size={10} className="md:w-3 md:h-3" /> +{a.tier.xp} XP
                  </span>
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
      )}
    </div>
  );
}