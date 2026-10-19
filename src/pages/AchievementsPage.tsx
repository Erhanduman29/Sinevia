import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ACHIEVEMENT_DEFS, TIER_ORDER, AchievementIcon } from '../lib/achievements';
import { levelFromXp } from '../lib/xp';
import { RANK_TIERS } from '../lib/rankTiers';
import QuestBoard from '../components/QuestBoard';
import TitleGallery from '../components/TitleGallery';

// ============================================================
// CANLI GERÇEK METAL & MÜCEVHER KADEME PALETİ
// ============================================================
interface TierVisualTheme {
  label: string;
  solid: string;        // Ana canlı renk (sol şerit, bar, vurgu)
  barGradient: string;  // İlerleme çubuğu ve aktif buton canlı gradyanı
  badgeBg: string;      // Kademe etiketi arka planı
  badgeBorder: string;  // Kademe etiketi çerçevesi
  badgeText: string;    // Kademe etiketi parlak yazı rengi
  medalBg: string;      // İkon kutusu canlı metalik/mücevher gradyanı
  medalBorder: string;  // İkon kutusu parlak çerçevesi
  iconColor: string;    // İkonun kendi parlak rengi
  activeText: string;   // Filtre butonu seçiliyse yazı rengi
}

const TIER_VISUALS: Record<string, TierVisualTheme> = {
  bronze: {
    label: 'Bronz',
    solid: '#FF7A2F',
    barGradient: 'linear-gradient(90deg, #D9531E 0%, #FF7A2F 55%, #FFAA6E 100%)',
    badgeBg: 'rgba(255, 122, 47, 0.16)',
    badgeBorder: 'rgba(255, 145, 77, 0.45)',
    badgeText: '#FFB085',
    medalBg: 'linear-gradient(135deg, rgba(255, 122, 47, 0.28) 0%, rgba(163, 62, 18, 0.18) 100%)',
    medalBorder: '#FF8542',
    iconColor: '#FF9E66',
    activeText: '#09090D',
  },
  silver: {
    label: 'Gümüş',
    solid: '#E2E8F0',
    barGradient: 'linear-gradient(90deg, #94A3B8 0%, #E2E8F0 55%, #FFFFFF 100%)',
    badgeBg: 'rgba(226, 232, 240, 0.15)',
    badgeBorder: 'rgba(226, 232, 240, 0.48)',
    badgeText: '#F8FAFC',
    medalBg: 'linear-gradient(135deg, rgba(241, 245, 249, 0.28) 0%, rgba(148, 163, 184, 0.16) 100%)',
    medalBorder: '#CBD5E1',
    iconColor: '#FFFFFF',
    activeText: '#09090D',
  },
  gold: {
    label: 'Altın',
    solid: '#FFC800',
    barGradient: 'linear-gradient(90deg, #EAB308 0%, #FFC800 50%, #FFF066 100%)',
    badgeBg: 'rgba(255, 200, 0, 0.16)',
    badgeBorder: 'rgba(255, 215, 0, 0.50)',
    badgeText: '#FFE46B',
    medalBg: 'linear-gradient(135deg, rgba(255, 204, 0, 0.30) 0%, rgba(180, 120, 0, 0.18) 100%)',
    medalBorder: '#FFD026',
    iconColor: '#FFE047',
    activeText: '#09090D',
  },
  platinum: {
    label: 'Platin',
    solid: '#A5F3FC',
    barGradient: 'linear-gradient(90deg, #38BDF8 0%, #A5F3FC 55%, #ECFEFF 100%)',
    badgeBg: 'rgba(165, 243, 252, 0.15)',
    badgeBorder: 'rgba(165, 243, 252, 0.48)',
    badgeText: '#CFFAFE',
    medalBg: 'linear-gradient(135deg, rgba(165, 243, 252, 0.28) 0%, rgba(56, 189, 248, 0.16) 100%)',
    medalBorder: '#67E8F9',
    iconColor: '#E0F2FE',
    activeText: '#09090D',
  },
  emerald: {
    label: 'Zümrüt',
    solid: '#00E676',
    barGradient: 'linear-gradient(90deg, #059669 0%, #00E676 55%, #69F0AE 100%)',
    badgeBg: 'rgba(0, 230, 118, 0.15)',
    badgeBorder: 'rgba(0, 230, 118, 0.45)',
    badgeText: '#69F0AE',
    medalBg: 'linear-gradient(135deg, rgba(0, 230, 118, 0.28) 0%, rgba(5, 150, 105, 0.16) 100%)',
    medalBorder: '#10B981',
    iconColor: '#34D399',
    activeText: '#09090D',
  },
  diamond: {
    label: 'Elmas',
    solid: '#00D2FF',
    barGradient: 'linear-gradient(90deg, #0284C7 0%, #00D2FF 55%, #80EAFF 100%)',
    badgeBg: 'rgba(0, 210, 255, 0.16)',
    badgeBorder: 'rgba(56, 189, 248, 0.52)',
    badgeText: '#7DD3FC',
    medalBg: 'linear-gradient(135deg, rgba(0, 210, 255, 0.30) 0%, rgba(2, 132, 199, 0.18) 100%)',
    medalBorder: '#38BDF8',
    iconColor: '#7DD3FC',
    activeText: '#09090D',
  },
  secret: {
    label: 'Gizli',
    solid: '#FF2E63',
    barGradient: 'linear-gradient(90deg, #BE123C 0%, #FF2E63 55%, #FF85A1 100%)',
    badgeBg: 'rgba(255, 46, 99, 0.16)',
    badgeBorder: 'rgba(255, 46, 99, 0.48)',
    badgeText: '#FDA4AF',
    medalBg: 'linear-gradient(135deg, rgba(255, 46, 99, 0.28) 0%, rgba(159, 18, 57, 0.18) 100%)',
    medalBorder: '#F43F5E',
    iconColor: '#FB7185',
    activeText: '#FFFFFF',
  },
};

interface ClosestLockedTrophy {
  name: string;
  pct: number;
  current: number;
  target: number;
  tier: string;
}

const ACHV_SOLID_CSS = `
/* ---------- CANLI RENKLİ BAŞARIM KARTI ---------- */
.achv-card{
  position:relative;
  overflow:hidden;
  background:#0F0F16;
  border:1px solid #232332;
  border-left:4px solid var(--tier-solid);
  border-radius:15px;
  transition:transform .22s ease, border-color .22s ease, background-color .22s ease, box-shadow .22s ease;
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  /* MOBİL PERFORMANS: 200+ kartta yerleşim/çizim bütçesini düşür — ekranda
     olmayan kartlar atlanır (kaydırma kasma düzeltmesi). auto yüksekliği
     son çizilen değerden hatırlar → scrollbar zıplamaz. */
  content-visibility:auto;
  contain-intrinsic-size:auto 210px;
}
/* Dokunmatikte kaydırma sırasında parmak değen karta :hover yapışır; transform
   + box-shadow + background repaint'i mobilde kasma üretiyordu → hover efektleri
   yalnızca fare/trackpad olan cihazlarda. */
@media (hover:hover) and (pointer:fine){
  .achv-card:hover{
    transform:translateY(-3px);
    background:#14141E;
    border-color:var(--tier-medal-border);
    border-left-color:var(--tier-solid);
    box-shadow:0 16px 36px -18px rgba(0,0,0,.95);
  }
  .achv-card.is-locked:hover{
    background:#0F0F17;
    border-color:#2D2D3F;
    border-left-color:var(--tier-solid);
  }
  .achv-card:hover .achv-emblem-stage{
    transform:scale(1.08);
  }
  .achv-card.is-locked:hover .achv-emblem-stage{
    opacity:1;
    filter:saturate(1);
  }
  /* PREMIUM: kazanılan kupada tek seferlik altın ışık süpürmesi */
  .achv-card.is-open:hover::after{
    animation:achv-shine .9s ease;
  }
}
/* PREMIUM: kazanılan kupanın altın ışık süpürmesi katmanı */
.achv-card.is-open::after{
  content:'';
  position:absolute;
  top:0;
  left:-80%;
  width:55%;
  height:100%;
  background:linear-gradient(105deg, transparent 0%, rgba(255,255,255,.06) 45%, rgba(255,255,255,.13) 50%, transparent 100%);
  transform:skewX(-18deg);
  pointer-events:none;
  opacity:0;
  z-index:5;
}
@keyframes achv-shine{
  0%{ left:-80%; opacity:0; }
  15%{ opacity:1; }
  85%{ opacity:1; }
  100%{ left:130%; opacity:0; }
}
.achv-card.is-locked{
  background:#0A0A0F;
  border-color:#1B1B26;
  border-left-color:var(--tier-solid);
}

/* 3 Katmanlı Özel Vektörel Arma Yuvası */
.achv-medal-wrap{
  position:relative;
  width:62px;
  height:62px;
  flex-shrink:0;
  display:flex;
  align-items:center;
  justify-content:center;
}
.achv-emblem-stage{
  transition:transform .25s ease, opacity .25s ease, filter .25s ease;
}
.achv-card.is-locked .achv-emblem-stage{
  opacity:.68;
  filter:saturate(.65);
}
.achv-status-pip{
  position:absolute;
  bottom:-2px;
  right:-2px;
  width:20px;
  height:20px;
  border-radius:6px;
  display:grid;
  place-items:center;
  border:1.5px solid #0F0F16;
  z-index:10;
}
.achv-status-pip.locked{
  background:#1E1E2A;
  color:#A1A1AA;
}
.achv-status-pip.unlocked{
  background:var(--tier-solid);
  color:#09090D;
}

/* Kademe Etiketi & XP */
.achv-tier-tag{
  display:inline-flex;
  align-items:center;
  gap:5px;
  padding:3.5px 10px;
  border-radius:7px;
  font-size:10.5px;
  font-weight:800;
  letter-spacing:.12em;
  text-transform:uppercase;
  background:var(--tier-badge-bg);
  border:1px solid var(--tier-badge-border);
  color:var(--tier-badge-text);
}
.achv-tier-dot{
  width:6px;
  height:6px;
  border-radius:50%;
  background:var(--tier-solid);
}
.achv-xp-pill{
  display:inline-flex;
  align-items:center;
  gap:4px;
  padding:3.5px 10px;
  border-radius:7px;
  font-family:'JetBrains Mono',monospace;
  font-size:11px;
  font-weight:800;
  background:var(--tier-badge-bg);
  border:1px solid var(--tier-badge-border);
  color:var(--tier-badge-text);
  flex-shrink:0;
}

/* İlerleme Çubuğu (Canlı Gradyan) */
.achv-track{
  position:relative;
  overflow:hidden;
  height:7px;
  background:#191924;
  border-radius:99px;
}
.achv-fill{
  position:absolute;
  top:0; bottom:0; left:0;
  border-radius:99px;
  background:var(--tier-bar-gradient);
  transition:width .6s ease;
}

/* Arama ve Filtre Kontrolleri */
.achv-search{
  background:#0D0D12;
  border:1px solid #242430;
  border-radius:12px;
  transition:border-color .2s;
}
.achv-search:focus{
  border-color:var(--red, var(--color-1, #e8384f));
  background:#111118;
}
.achv-chip{
  background:transparent;
  border:1px solid transparent;
  border-radius:8px;
  transition:all .18s ease;
}
.achv-chip.on{
  background:#22222E;
  border-color:#3A3A4E;
  color:#fff;
}

@media (max-width: 640px){
  .achv-medal-wrap{
    width:54px;
    height:54px;
  }
}
`;

type SortMode = 'newest' | 'oldest' | 'az' | 'za';
type FilterMode = 'all' | 'unlocked' | 'locked';
type ViewTab = 'trophies' | 'quests' | 'titles';

/**
 * PREMIUM MİKRO-ETKİLEŞİM: istatistik sayılarını yumuşakça saydırır.
 * prefers-reduced-motion açıkken anında hedefe oturur.
 */
function useCountUp(target: number, duration = 700): number {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = fromRef.current;
    if (reduce || from === target) {
      fromRef.current = target;
      setVal(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return val;
}

export default function AchievementsPage() {
  const { data } = useApp();
  const [activeTab, setActiveTab] = useState<ViewTab>('trophies');
  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');

  // GLOBAL ARAMA DEEP-LINK
  useEffect(() => {
    const applySearchAction = () => {
      try {
        const action = sessionStorage.getItem('sinevia_search_action');
        if (!action) return;
        sessionStorage.removeItem('sinevia_search_action');
        if (action === 'quests') setActiveTab('quests');
        else if (action === 'trophies') setActiveTab('trophies');
        else if (action === 'titles') setActiveTab('titles');
      } catch {
        /* sessionStorage kapalıysa normal açılış */
      }
    };
    applySearchAction();
    window.addEventListener('sinevia-search-action', applySearchAction);
    return () => window.removeEventListener('sinevia-search-action', applySearchAction);
  }, []);

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
          def,
          tier,
          isUnlocked: true,
          unlockedAt,
          current: prog?.current || 0,
        });
      } else {
        displayAchievements.push({
          id: `${def.id}_${tier.tier}_locked`,
          def,
          tier,
          isUnlocked: false,
          unlockedAt: null,
          current: prog?.current || 0,
        });
      }
    });
  });

  // Kupa Kasası İstatistikleri
  const trophyVaultInsights = useMemo((): {
    earnedTrophyXp: number;
    closestLocked: ClosestLockedTrophy | null;
  } => {
    let earnedTrophyXp = 0;
    let closestLocked: ClosestLockedTrophy | null = null;

    for (const a of displayAchievements) {
      if (a.isUnlocked) {
        earnedTrophyXp += Number(a.tier.xp || 0);
      } else if (!a.def.secret || data.showLockedNames) {
        const target = Math.max(1, Number(a.tier.threshold || 1));
        const current = Math.min(target, Number(a.current || 0));
        const pct = Math.min(99, Math.floor((current / target) * 100));
        if (pct > 0 && (closestLocked === null || pct > closestLocked.pct)) {
          closestLocked = {
            name: data.showLockedNames ? String(a.tier.name || a.def.name || '') : '???',
            pct,
            current,
            target,
            tier: String(a.tier.tier || 'bronze'),
          };
        }
      }
    }

    return { earnedTrophyXp, closestLocked };
  }, [displayAchievements, data.showLockedNames]);

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
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateString));
    } catch {
      return '';
    }
  };

  const totalPossibleTiers = ACHIEVEMENT_DEFS.reduce(
    (sum: number, def: any) => sum + def.tiers.length,
    0
  );
  const unlockedTiersCount = displayAchievements.filter((a) => a.isUnlocked).length;
  const lockedTiersCount = Math.max(0, totalPossibleTiers - unlockedTiersCount);
  const trophyCompletionPct = totalPossibleTiers > 0 ? Math.round((unlockedTiersCount / totalPossibleTiers) * 100) : 0;
  // PREMIUM: sayaç animasyonları (veri değişince yeni değere yumuşak geçiş)
  const animatedTrophyCount = useCountUp(unlockedTiersCount);
  const animatedCompletionPct = useCountUp(trophyCompletionPct);
  const animatedTotalXp = useCountUp(data.totalXp || 0, 900);
  const isTestMode = data.showLockedNames;
  const closestTrophy = trophyVaultInsights.closestLocked;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in pb-10">
      <style>{ACHV_SOLID_CSS}</style>

      {/* ÜST BAŞLIK VE SEKME (TAB) SEÇİCİ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
        <h1 className="text-xl sm:text-3xl font-black uppercase tracking-tight text-ink-100 flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FFC800] text-[#09090D] flex items-center justify-center shrink-0">
            <Icons.Trophy size={19} />
          </div>
          <span>Ödüller &amp; Kariyer</span>
        </h1>

        <div
          data-tutorial="ach-tabs"
          className="grid grid-cols-3 sm:flex p-1 rounded-xl w-full sm:w-auto bg-[#0D0D12] border border-[#22222C]"
        >
          <button
            onClick={() => setActiveTab('trophies')}
            className={`sm:w-36 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-black transition-all ${
              activeTab === 'trophies'
                ? 'bg-[#FFC800] text-[#09090D]'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <Icons.Medal size={14} /> KUPA KASASI
          </button>
          <button
            onClick={() => setActiveTab('quests')}
            className={`sm:w-36 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-black transition-all ${
              activeTab === 'quests'
                ? 'bg-violet-600 text-white'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <Icons.Target size={14} /> GÖREV PANOSU
          </button>
          <button
            onClick={() => setActiveTab('titles')}
            className={`sm:w-36 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-black transition-all ${
              activeTab === 'titles'
                ? 'bg-rose-600 text-white'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <Icons.Crown size={14} /> SOY KÜTÜĞÜ
          </button>
        </div>
      </div>

      {/* SOY KÜTÜĞÜ (UNVANLAR) SEKME İÇERİĞİ */}
      {activeTab === 'titles' && <TitleGallery />}

      {/* GÖREV PANOSU SEKME İÇERİĞİ */}
      {activeTab === 'quests' && <QuestBoard />}

      {/* KUPA KASASI SEKME İÇERİĞİ */}
      {activeTab === 'trophies' && (
        <div className="space-y-4 sm:space-y-6 animate-fade-in-up">
          {/* SEVİYE, XP & GELİŞTİRİLMİŞ KUPA KASASI */}
          <div className="bg-[#0D0D12] border border-[#22222C] rounded-2xl p-4 sm:p-6 shadow-2xl">
            <div className="flex flex-col xl:flex-row items-stretch gap-4 sm:gap-6">
              {/* Sol: Avatar + Rütbe */}
              <div className="flex items-center gap-4 sm:gap-5 flex-shrink-0">
                <div className="relative w-16 h-16 sm:w-24 sm:h-24 flex items-center justify-center flex-shrink-0">
                  <svg className="w-16 h-16 sm:w-24 sm:h-24 -rotate-90 transform" viewBox="0 0 108 108">
                    <circle cx="54" cy="54" r={circleRadius} stroke="#1C1C26" strokeWidth="7" fill="transparent" />
                    <circle
                      cx="54"
                      cy="54"
                      r={circleRadius}
                      stroke={userPersona.strokeColor}
                      strokeWidth="7"
                      strokeDasharray={circleCircumference}
                      strokeDashoffset={circleOffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>

                  <div className="absolute inset-2.5 sm:inset-3.5 rounded-full bg-[#14141D] border border-[#282836] flex flex-col items-center justify-center">
                    <PersonaIcon className={`${userPersona.color} w-5 h-5 sm:w-7 sm:h-7`} />
                    <span className="hidden sm:block text-[9px] font-black text-ink-400 uppercase mt-0.5">
                      %{Math.floor(lvl.progress)}
                    </span>
                  </div>
                </div>

                <div className="text-left min-w-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-widest border mb-1 ${userPersona.badgeBg} ${userPersona.color} ${userPersona.border}`}>
                    <Icons.Sparkles size={10} /> {userPersona.title}
                  </span>
                  <div className="text-xl sm:text-3xl font-black text-white tracking-tight leading-none">
                    Seviye {lvl.level}
                  </div>
                  <p className="hidden sm:block text-xs text-ink-400 mt-1 max-w-[220px] leading-relaxed">
                    {userPersona.subtitle}
                  </p>
                </div>
              </div>

              {/* Orta: XP İlerleme Kutusu */}
              <div className="flex-1 w-full bg-[#12121A] border border-[#22222E] rounded-xl p-3.5 sm:p-5 flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-ink-400 block">Toplam Deneyim Puanı</span>
                    <div className="text-base sm:text-2xl font-black text-white flex items-baseline gap-1.5 mt-0.5">
                      <span>{animatedTotalXp.toLocaleString('tr-TR')} XP</span>
                      <span className="text-[10px] sm:text-xs font-bold text-ink-400">(%{Math.floor(lvl.progress)})</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase tracking-widest text-ink-400 block">Seviye {lvl.level + 1} Hedefi</span>
                    <span className={`text-xs sm:text-sm font-black ${userPersona.color}`}>
                      {Math.max(0, lvl.nextLevelXp - lvl.currentLevelXp).toLocaleString('tr-TR')} XP Kaldı
                    </span>
                  </div>
                </div>

                <div className="relative h-3 w-full bg-[#09090D] rounded-full overflow-hidden border border-[#22222E]">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${userPersona.barGradient} transition-all duration-1000`}
                    style={{ width: `${Math.max(3, lvl.progress)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-ink-400">
                  <span>Seviye İlerlemesi: %{Math.floor(lvl.progress)}</span>
                  {nextRank ? (
                    <span className={`${userPersona.color} truncate`}>Sonraki Unvan: {nextRank.title} (Sv.{nextRank.minLevel})</span>
                  ) : (
                    <span className="text-zinc-100">Maksimum Unvan 👑</span>
                  )}
                </div>
              </div>

              {/* Sağ: Geliştirilmiş Kupa Kasası Özeti */}
              <div className="w-full xl:w-[24rem] bg-[#12121A] border border-[#3A3012] rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#FFD026] flex items-center gap-1.5">
                      <Icons.Trophy size={12} /> Toplanan Kupalar
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl sm:text-3xl font-black text-white leading-none font-mono">
                        {animatedTrophyCount}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-ink-400 font-mono">
                        / {totalPossibleTiers} Kupa
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div className="px-2.5 py-1 rounded-md bg-[#2B2205] border border-[#9A7B1C] text-[#FFE047] text-xs font-black font-mono">
                      %{animatedCompletionPct} Tamamlandı
                    </div>
                    <span className="text-[10px] font-bold text-ink-400 font-mono">
                      +{trophyVaultInsights.earnedTrophyXp.toLocaleString('tr-TR')} XP Kazanıldı
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="h-2.5 w-full bg-[#09090D] rounded-full overflow-hidden border border-[#22222E]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max(2, trophyCompletionPct)}%`,
                        background: 'linear-gradient(90deg, #EAB308 0%, #FFC800 50%, #FFF066 100%)',
                      }}
                    />
                  </div>

                  {closestTrophy !== null ? (
                    <div className="flex items-center justify-between text-[11px] pt-0.5 gap-2">
                      <span className="text-ink-400 truncate">
                        Sıradaki: <strong className="text-white">{closestTrophy.name}</strong>
                      </span>
                      <span className="font-mono font-black text-[#FFD026] shrink-0">
                        {closestTrophy.current}/{closestTrophy.target} (%{closestTrophy.pct})
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] pt-0.5 text-ink-400">
                      <span>Açık: <strong className="text-[#00E676]">{unlockedTiersCount}</strong></span>
                      <span>Kilitli: <strong className="text-ink-200">{lockedTiersCount}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ARAMA, FİLTRE VE SIRALAMA BARLARI */}
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex flex-col lg:flex-row gap-2.5">
              {/* Arama Çubuğu */}
              <div className="relative flex-1">
                <Icons.Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Başarım adı, açıklama veya kategori ara..."
                  className="achv-search w-full pl-10 pr-9 py-2.5 text-sm text-ink-100 placeholder-ink-500 focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    title="Aramayı Temizle"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white p-1 flex items-center justify-center rounded-full hover:bg-ink-700 transition-colors"
                  >
                    <Icons.X size={15} />
                  </button>
                )}
              </div>

              {/* Durum ve Sıralama Seçiciler */}
              <div className="grid grid-cols-2 sm:flex items-center gap-2">
                <div className="grid grid-cols-3 bg-[#0D0D12] rounded-xl p-1 border border-[#22222C]">
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`achv-chip py-2 px-2.5 text-[11px] sm:text-xs font-bold ${
                      filterMode === 'all' ? 'on' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Tümü
                  </button>
                  <button
                    onClick={() => setFilterMode('unlocked')}
                    className={`achv-chip py-2 px-2.5 text-[11px] sm:text-xs font-bold ${
                      filterMode === 'unlocked' ? 'on' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Açıklar
                  </button>
                  <button
                    onClick={() => setFilterMode('locked')}
                    className={`achv-chip py-2 px-2.5 text-[11px] sm:text-xs font-bold ${
                      filterMode === 'locked' ? 'on' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Kilitli
                  </button>
                </div>

                <div className="grid grid-cols-3 bg-[#0D0D12] rounded-xl p-1 border border-[#22222C]">
                  <button
                    onClick={() => setSortMode('newest')}
                    className={`achv-chip py-2 px-2.5 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 ${
                      sortMode === 'newest' ? 'on' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Yeni
                  </button>
                  <button
                    onClick={() => setSortMode('oldest')}
                    className={`achv-chip py-2 px-2.5 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 ${
                      sortMode === 'oldest' ? 'on' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Eski
                  </button>
                  <button
                    onClick={() => setSortMode('az')}
                    className={`achv-chip py-2 px-2.5 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 ${
                      sortMode === 'az' ? 'on' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    A-Z
                  </button>
                </div>
              </div>
            </div>

            {/* Kademe Filtre Şeridi (Canlı Metal & Mücevher Renkleri) */}
            <div className="flex overflow-x-auto sm:flex-wrap gap-2 py-1 hide-scrollbar snap-x">
              <button
                onClick={() => setActiveTier(null)}
                className={`snap-start flex-shrink-0 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${
                  activeTier === null
                    ? 'bg-white text-[#09090D] border-white'
                    : 'bg-[#0D0D12] border-[#22222C] text-ink-400 hover:text-white'
                }`}
              >
                Tüm Kademeler ({unlockedTiersCount}/{totalPossibleTiers})
              </button>

              {TIER_ORDER.map((tier: string) => {
                const vis = TIER_VISUALS[tier] || TIER_VISUALS.bronze;
                const isActive = activeTier === tier;
                const stats = tierStats[tier];

                return (
                  <button
                    key={tier}
                    onClick={() => setActiveTier(isActive ? null : tier)}
                    className="snap-start flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                    style={{
                      background: isActive ? vis.barGradient : vis.badgeBg,
                      border: `1px solid ${isActive ? vis.solid : vis.badgeBorder}`,
                      color: isActive ? vis.activeText : vis.badgeText,
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: isActive ? vis.activeText : vis.solid }}
                    />
                    <span>{vis.label}</span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold"
                      style={{
                        background: isActive ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.45)',
                        color: '#fff',
                      }}
                    >
                      {tier !== 'secret' || isTestMode ? `${stats.unlocked}/${stats.total}` : stats.unlocked}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* BAŞARIM KARTLARI LİSTESİ */}
          <div
            data-tutorial="ach-grid"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4 pb-8"
          >
            {filteredAchievements.map((a) => {
              const tierKey = a.tier.tier as string;
              const vis = TIER_VISUALS[tierKey] || TIER_VISUALS.bronze;
              const isLocked = !a.isUnlocked;
              const isSecret = !!a.def.secret;
              const displayName = isLocked && !isTestMode ? '???' : (a.tier.name || a.def.name);
              const parsedDesc = a.def.description.replace('{threshold}', String(a.tier.threshold));

              const current = Math.min(a.current, a.tier.threshold);
              const target = a.tier.threshold;
              const percentage = Math.min(100, Math.floor((current / Math.max(1, target)) * 100));

              return (
                <div
                  key={a.id}
                  className={`achv-card ${isLocked ? 'is-locked' : 'is-open'}`}
                  style={
                    {
                      '--tier-solid': vis.solid,
                      '--tier-bar-gradient': vis.barGradient,
                      '--tier-badge-bg': vis.badgeBg,
                      '--tier-badge-border': vis.badgeBorder,
                      '--tier-badge-text': vis.badgeText,
                      '--tier-medal-bg': vis.medalBg,
                      '--tier-medal-border': vis.medalBorder,
                      '--tier-icon': vis.iconColor,
                    } as React.CSSProperties
                  }
                >
                  <div className="p-4 sm:p-5 flex flex-col gap-3.5 h-full justify-between">
                    <div className="flex items-start gap-3.5 sm:gap-4">
                      {/* Sol: 3 Katmanlı Özel Vektörel Başarım Arması */}
                      <div className="achv-medal-wrap">
                        <AchievementIcon
                          achievementId={a.def.id}
                          tier={tierKey}
                          size={44}
                          className="achv-emblem-stage"
                        />
                        {isLocked ? (
                          <span className="achv-status-pip locked" title="Kilitli">
                            <Icons.Lock size={11} />
                          </span>
                        ) : (
                          <span className="achv-status-pip unlocked" title="Kazanıldı">
                            <Icons.Check size={12} strokeWidth={3} />
                          </span>
                        )}
                      </div>

                      {/* Sağ: Kademe Etiketi + XP + Başlık + Açıklama */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="achv-tier-tag">
                              <span className="achv-tier-dot" />
                              {vis.label}
                            </span>

                            {a.def.category && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 bg-[#181824] border border-[#2B2B3D] px-2 py-0.5 rounded">
                                {a.def.category}
                              </span>
                            )}

                            {isSecret && isTestMode && (
                              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-[#2C0B16] text-rose-300 border-rose-700">
                                Gizli
                              </span>
                            )}
                          </div>

                          <span className="achv-xp-pill">
                            +{a.tier.xp} XP
                          </span>
                        </div>

                        <h3
                          className={`mt-2 text-base sm:text-[16.5px] font-black tracking-tight leading-snug ${
                            isLocked ? 'text-zinc-100' : 'text-white'
                          }`}
                        >
                          {displayName}
                        </h3>

                        <p
                          className={`text-xs sm:text-[13px] leading-relaxed mt-1 ${
                            isLocked ? 'text-zinc-400' : 'text-zinc-300'
                          }`}
                        >
                          {isLocked && !isTestMode
                            ? 'Bu kupanın sırrını çözmek için keşfetmeye devam et.'
                            : parsedDesc}
                        </p>
                      </div>
                    </div>

                    {/* Alt Bar: İlerleme Çubuğu veya Kazanılma Tarihi */}
                    {isLocked ? (
                      <div className="pt-2.5 border-t border-[#1E1E2A] space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-zinc-400 font-mono">
                            İlerleme: <strong className="text-white">{current}</strong> / {target}
                          </span>
                          <span className="font-mono font-black text-xs" style={{ color: vis.solid }}>
                            %{percentage}
                          </span>
                        </div>
                        <div className="achv-track">
                          <div className="achv-fill" style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2.5 border-t border-[#1E1E2A] flex items-center justify-between text-xs">
                        <span
                          className="font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-[11px]"
                          style={{ color: vis.solid }}
                        >
                          <Icons.CheckCircle2 size={13} /> Kupa Açıldı
                        </span>
                        {a.unlockedAt && (
                          <span className="text-[11px] font-mono font-semibold text-zinc-400">
                            {formatDateTime(a.unlockedAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredAchievements.length === 0 && (
              <div className="col-span-full text-center py-12 text-ink-400 text-sm font-medium bg-[#0D0D12] rounded-2xl border border-[#22222C]">
                <Icons.SearchX size={32} className="mx-auto mb-3 text-ink-600" />
                Arama ve filtreleme kriterlerine uygun başarım bulunamadı.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}