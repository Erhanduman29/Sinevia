import React, { useState, useMemo } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ACHIEVEMENT_DEFS, TIER_COLORS, TIER_ORDER } from '../lib/achievements';
import { levelFromXp } from '../lib/xp';

type SortMode = 'newest' | 'oldest' | 'az' | 'za';
type FilterMode = 'all' | 'unlocked' | 'locked';

const RANK_TIERS = [
  {
    minLevel: 1,
    maxLevel: 4,
    title: 'Çaylak İzleyici',
    subtitle: 'Sinema yolculuğunun ilk adımları',
    color: 'text-slate-300',
    border: 'border-slate-500/40',
    badgeBg: 'bg-slate-500/15',
    bgGlow: 'bg-slate-500/15',
    gradient: 'from-slate-500 via-slate-400 to-zinc-300',
    barGradient: 'from-slate-600 via-slate-400 to-white',
    strokeColor: '#94a3b8',
    icon: Icons.Film,
  },
  {
    minLevel: 5,
    maxLevel: 9,
    title: 'Film Meraklısı',
    subtitle: 'Kült yapımların ve seçkin hikayelerin kaşifi',
    color: 'text-sky-400',
    border: 'border-sky-500/40',
    badgeBg: 'bg-sky-500/15',
    bgGlow: 'bg-sky-500/20',
    gradient: 'from-blue-600 via-sky-500 to-cyan-300',
    barGradient: 'from-blue-700 via-sky-500 to-cyan-300',
    strokeColor: '#38bdf8',
    icon: Icons.Award,
  },
  {
    minLevel: 10,
    maxLevel: 19,
    title: 'Tutkulu Sinefil',
    subtitle: 'Yönetmen imzalarını ve alt metinleri okuyan göz',
    color: 'text-violet-400',
    border: 'border-violet-500/40',
    badgeBg: 'bg-violet-500/15',
    bgGlow: 'bg-violet-500/20',
    gradient: 'from-violet-600 via-purple-500 to-fuchsia-400',
    barGradient: 'from-violet-700 via-purple-500 to-fuchsia-300',
    strokeColor: '#a78bfa',
    icon: Icons.Shield,
  },
  {
    minLevel: 20,
    maxLevel: 39,
    title: 'Sinema Otoritesi',
    subtitle: 'Eleştirileri ve arşiviyle referans noktası',
    color: 'text-gold-400',
    border: 'border-gold-500/50',
    badgeBg: 'bg-gold-500/15',
    bgGlow: 'bg-gold-500/25',
    gradient: 'from-amber-600 via-gold-500 to-yellow-300',
    barGradient: 'from-amber-600 via-gold-500 to-yellow-200',
    strokeColor: '#f59e0b',
    icon: Icons.Crown,
  },
  {
    minLevel: 40,
    maxLevel: 999,
    title: 'Sinevia Efsanesi',
    subtitle: 'Yedinci sanatın zirvesine ulaşmış ölümsüz otorite',
    color: 'text-cyan-300',
    border: 'border-cyan-400/50',
    badgeBg: 'bg-cyan-500/15',
    bgGlow: 'bg-cyan-500/25',
    gradient: 'from-cyan-500 via-teal-400 to-emerald-300',
    barGradient: 'from-cyan-600 via-teal-400 to-emerald-200',
    strokeColor: '#22d3ee',
    icon: Icons.Gem,
  },
];

export default function AchievementsPage() {
  const { data } = useApp();
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
  const circleOffset =
    circleCircumference - (Math.min(100, Math.max(0, lvl.progress)) / 100) * circleCircumference;

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
        const unlockedAt =
          prog?.tierDates?.[tier.tier] || prog?.unlockedAt || '2000-01-01T00:00:00.000Z';
        displayAchievements.push({
          id: `${def.id}_${tier.tier}`,
          def,
          tier,
          isUnlocked: true,
          unlockedAt,
          current: prog?.current || 0,
        });
      } else {
        if (!def.secret || data.showLockedNames) {
          displayAchievements.push({
            id: `${def.id}_${tier.tier}_locked`,
            def,
            tier,
            isUnlocked: false,
            unlockedAt: null,
            current: prog?.current || 0,
          });
        }
      }
    });
  });

  const filteredAchievements = displayAchievements.filter((a) => {
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
      return new Intl.DateTimeFormat('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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
  const trophyCompletionPct =
    totalPossibleTiers > 0 ? Math.round((unlockedTiersCount / totalPossibleTiers) * 100) : 0;
  const isTestMode = data.showLockedNames;

  return (
    <div className="space-y-5 md:space-y-6 animate-fade-in">
      {/* SAYFA BAŞLIĞI */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-ink-100 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500/20 to-amber-500/10 border border-gold-500/30 flex items-center justify-center shadow-lg">
            <Icons.Trophy size={22} className="text-gold-400" />
          </div>
          <div>
            <span>Başarımlar & Kupa Müzesi</span>
            <span className="block text-xs font-medium text-ink-400 mt-0.5">
              Kazandığın kupalar, gizli rozetler ve prestij rütbe ilerlemen
            </span>
          </div>
        </h1>
      </div>

      {/* =========================================================
          GÖSTERİŞLİ SEVİYE, XP & KUPA KOLEKSİYON ARENASI
          ========================================================= */}
      <div
        className={`relative bg-gradient-to-br from-ink-950 via-ink-900/95 to-ink-950 border ${userPersona.border} rounded-[2.2rem] p-5 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.75)] overflow-hidden`}
      >
        <div
          className={`absolute -top-24 -right-20 w-96 h-96 ${userPersona.bgGlow} rounded-full blur-[110px] pointer-events-none transition-all duration-1000`}
        />
        <div
          className={`absolute -bottom-28 -left-20 w-80 h-80 ${userPersona.bgGlow} rounded-full blur-[100px] pointer-events-none transition-all duration-1000`}
        />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.8) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* ÜST BÖLÜM: 3D SVG HALKALI ARMA + XP MOTORU + KUPA KASASI ÖZETİ */}
        <div className="relative z-10 flex flex-col xl:flex-row items-center gap-6 xl:gap-7">
          {/* Sol: Dairesel SVG İlerleme Halkalı Rütbe Arması */}
          <div className="flex flex-col sm:flex-row items-center gap-5 flex-shrink-0 w-full xl:w-auto justify-center sm:justify-start">
            <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">
              <div
                className={`absolute inset-2 rounded-full bg-gradient-to-br ${userPersona.gradient} opacity-25 blur-xl animate-pulse`}
              />

              <svg className="w-28 h-28 -rotate-90 transform" viewBox="0 0 108 108">
                <circle
                  cx="54"
                  cy="54"
                  r={circleRadius}
                  stroke="currentColor"
                  strokeWidth="7"
                  fill="transparent"
                  className="text-ink-950"
                />
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
                  className="transition-all duration-1000 ease-out drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                />
              </svg>

              <div
                className={`absolute inset-4 rounded-full bg-gradient-to-br ${userPersona.gradient} p-0.5 shadow-2xl`}
              >
                <div className="w-full h-full bg-ink-950 rounded-full flex flex-col items-center justify-center">
                  <PersonaIcon className={userPersona.color} size={30} />
                  <span className="text-[10px] font-black text-ink-400 uppercase mt-0.5">
                    %{Math.floor(lvl.progress)}
                  </span>
                </div>
              </div>

              <div
                className={`absolute -bottom-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r ${userPersona.gradient} text-ink-950 font-black text-xs shadow-lg border border-white/30`}
              >
                SV. {lvl.level}
              </div>
            </div>

            <div className="text-center sm:text-left">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border mb-1.5 ${userPersona.badgeBg} ${userPersona.color} ${userPersona.border}`}
              >
                <Icons.Sparkles size={11} /> {userPersona.title}
              </span>
              <div className="text-3xl sm:text-4xl font-black text-ink-50 tracking-tight leading-none">
                Seviye {lvl.level}
              </div>
              <p className="text-xs text-ink-400 mt-1.5 max-w-[230px] leading-relaxed">
                {userPersona.subtitle}
              </p>
            </div>
          </div>

          {/* Orta: 20 Segmentli Lazer XP İlerleme Motoru */}
          <div className="flex-1 w-full bg-ink-950/75 border border-ink-800/90 rounded-3xl p-4 sm:p-5 shadow-inner space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-ink-400 block">
                  Toplam Deneyim Puanı
                </span>
                <div className="text-lg sm:text-xl font-black text-ink-50 mt-0.5 flex items-baseline gap-1.5">
                  <span>{(data.totalXp || 0).toLocaleString('tr-TR')} XP</span>
                  <span className="text-xs font-bold text-ink-400">
                    ({lvl.currentLevelXp.toLocaleString('tr-TR')} / {lvl.nextLevelXp.toLocaleString('tr-TR')} Seviye İçi)
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-ink-400 block">
                  Seviye {lvl.level + 1} Hedefi
                </span>
                <span className={`text-sm font-black ${userPersona.color}`}>
                  {Math.max(0, lvl.nextLevelXp - lvl.currentLevelXp).toLocaleString('tr-TR')} XP Kaldı
                </span>
              </div>
            </div>

            {/* 20 Segmentli Kristal XP Barı */}
            <div className="relative h-5 w-full bg-ink-900 rounded-xl overflow-hidden border border-ink-700/80 p-0.5 shadow-inner">
              <div
                className={`h-full rounded-lg bg-gradient-to-r ${userPersona.barGradient} transition-all duration-1000 relative overflow-hidden`}
                style={{ width: `${Math.max(3, lvl.progress)}%` }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.35)_50%,transparent_75%)] bg-[length:200%_100%] animate-pulse" />
                <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-white shadow-[0_0_12px_#fff]" />
              </div>

              <div className="absolute inset-0 grid grid-cols-10 sm:grid-cols-20 pointer-events-none">
                {Array.from({ length: 20 }).map((_, idx) => (
                  <div key={idx} className="border-r border-ink-950/40 last:border-0" />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-bold text-ink-400 pt-0.5">
              <span>Seviye İlerlemesi: %{Math.floor(lvl.progress)}</span>
              {nextRank ? (
                <span className={userPersona.color}>
                  Sonraki Unvan: {nextRank.title} (Sv.{nextRank.minLevel})
                </span>
              ) : (
                <span className="text-cyan-300">Maksimum Unvana Ulaşıldı! 👑</span>
              )}
            </div>
          </div>

          {/* Sağ: Kupa Koleksiyonu Kasası & Genel Tamamlanma Yüzdesi */}
          <div className="w-full xl:w-64 bg-ink-950/80 border border-gold-500/30 rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-3 flex-shrink-0 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gold-400 block">
                  Toplanan Kupalar
                </span>
                <div className="text-2xl sm:text-3xl font-black text-ink-50 mt-0.5 leading-none">
                  {unlockedTiersCount}{' '}
                  <span className="text-sm font-bold text-ink-500">/ {totalPossibleTiers}</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gold-500/15 border border-gold-500/30 flex flex-col items-center justify-center">
                <Icons.Trophy size={18} className="text-gold-400" />
                <span className="text-[10px] font-black text-gold-300">%{trophyCompletionPct}</span>
              </div>
            </div>

            <div className="h-2 w-full bg-ink-900 rounded-full overflow-hidden border border-ink-800">
              <div
                className="h-full bg-gradient-to-r from-amber-600 via-gold-500 to-yellow-300 rounded-full transition-all duration-700"
                style={{ width: `${Math.max(2, trophyCompletionPct)}%` }}
              />
            </div>

            {/* 5 Kademe Mini Cevher Sayaçları */}
            <div className="grid grid-cols-5 gap-1 pt-1 border-t border-ink-800/80 text-center">
              {[
                { key: 'bronze', label: 'Brz', color: 'text-amber-500' },
                { key: 'silver', label: 'Güm', color: 'text-slate-300' },
                { key: 'gold', label: 'Alt', color: 'text-yellow-400' },
                { key: 'diamond', label: 'Elm', color: 'text-cyan-300' },
                { key: 'secret', label: 'Giz', color: 'text-fuchsia-400' },
              ].map((gem) => (
                <button
                  key={gem.key}
                  type="button"
                  onClick={() => setActiveTier(activeTier === gem.key ? null : gem.key)}
                  className={`rounded-lg py-1 transition-all ${
                    activeTier === gem.key
                      ? 'bg-ink-800 ring-1 ring-gold-400'
                      : 'hover:bg-ink-900'
                  }`}
                  title={`${gem.label} Kupalarını Filtrele`}
                >
                  <div className={`text-xs font-black ${gem.color}`}>
                    {tierStats[gem.key]?.unlocked || 0}
                  </div>
                  <div className="text-[9px] font-bold text-ink-500 uppercase">{gem.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ALT BÖLÜM: 5 KADEMELİ UNVAN EVRİM HARİTASI */}
        <div className="relative z-10 mt-5 pt-4 border-t border-ink-800/80">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {RANK_TIERS.map((tier, idx) => {
              const isUnlocked = lvl.level >= tier.minLevel;
              const isCurrent = idx === currentRankIndex;
              const TierIcon = tier.icon;
              return (
                <div
                  key={tier.title}
                  className={`relative rounded-xl p-2.5 border transition-all flex items-center gap-2.5 ${
                    isCurrent
                      ? `${tier.badgeBg}${tier.border} shadow-md scale-[1.02]`
                      : isUnlocked
                      ? 'bg-ink-900/70 border-ink-800/90 opacity-90'
                      : 'bg-ink-950/40 border-ink-800/40 opacity-45'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isUnlocked ? tier.badgeBg : 'bg-ink-900'
                    }`}
                  >
                    {isUnlocked ? (
                      <TierIcon size={14} className={tier.color} />
                    ) : (
                      <Icons.Lock size={12} className="text-ink-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-[11px] font-black truncate ${
                        isCurrent ? tier.color : isUnlocked ? 'text-ink-100' : 'text-ink-500'
                      }`}
                    >
                      {tier.title}
                    </div>
                    <div className="text-[9px] font-bold text-ink-500 flex items-center gap-1">
                      <span>Seviye {tier.minLevel}+</span>
                      {isUnlocked && <Icons.CheckCircle2 size={10} className="text-emerald-400" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================
          ARAMA, SIRALAMA VE KADEME FİLTRELERİ
          ========================================================= */}
      <div className="space-y-3 md:space-y-4">
        <div className="flex flex-col md:flex-row gap-2 md:gap-3">
          <div className="relative flex-1">
            <Icons.Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500 md:w-[18px] md:h-[18px]"
            />
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
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1.5 md:px-3 md:py-1.5 text-[11px] md:text-xs font-bold rounded-lg transition-all ${
                  filterMode === 'all'
                    ? 'bg-ink-700 text-white shadow-sm'
                    : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/50'
                }`}
              >
                Tümü
              </button>
              <button
                onClick={() => setFilterMode('unlocked')}
                className={`px-2.5 py-1.5 md:px-3 md:py-1.5 text-[11px] md:text-xs font-bold rounded-lg transition-all ${
                  filterMode === 'unlocked'
                    ? 'bg-gold-500/20 text-gold-400 shadow-sm'
                    : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/50'
                }`}
              >
                Açıklar
              </button>
              <button
                onClick={() => setFilterMode('locked')}
                className={`px-2.5 py-1.5 md:px-3 md:py-1.5 text-[11px] md:text-xs font-bold rounded-lg transition-all ${
                  filterMode === 'locked'
                    ? 'bg-ink-700 text-white shadow-sm'
                    : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/50'
                }`}
              >
                Kilitliler
              </button>
            </div>
            <div className="flex flex-shrink-0 bg-ink-800/50 rounded-xl p-1 md:p-1.5 border border-ink-700/50">
              <button
                onClick={() => setSortMode('newest')}
                className={`px-2.5 py-1.5 md:px-3 md:py-1.5 text-[11px] md:text-xs font-bold rounded-lg transition-all flex items-center gap-1 md:gap-1.5 ${
                  sortMode === 'newest'
                    ? 'bg-ink-700 text-white shadow-sm'
                    : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/50'
                }`}
              >
                <Icons.Clock size={12} className="md:w-3.5 md:h-3.5" /> Yeni
              </button>
              <button
                onClick={() => setSortMode('oldest')}
                className={`px-2.5 py-1.5 md:px-3 md:py-1.5 text-[11px] md:text-xs font-bold rounded-lg transition-all flex items-center gap-1 md:gap-1.5 ${
                  sortMode === 'oldest'
                    ? 'bg-ink-700 text-white shadow-sm'
                    : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/50'
                }`}
              >
                Eski
              </button>
              <button
                onClick={() => setSortMode('az')}
                className={`px-2.5 py-1.5 md:px-3 md:py-1.5 text-[11px] md:text-xs font-bold rounded-lg transition-all flex items-center gap-1 md:gap-1.5 ${
                  sortMode === 'az'
                    ? 'bg-ink-700 text-white shadow-sm'
                    : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/50'
                }`}
              >
                <Icons.ArrowDownAZ size={12} className="md:w-3.5 md:h-3.5" /> A-Z
              </button>
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

          {TIER_ORDER.map((tier: string) => {
            const tierInfo = (TIER_COLORS as any)[tier];
            const LegendIcon = (Icons as any)[tierInfo?.icon] || Icons.Award;
            const isActive = activeTier === tier;
            const stats = tierStats[tier];

            return (
              <button
                key={tier}
                onClick={() => setActiveTier(isActive ? null : tier)}
                className={`group flex-shrink-0 relative flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all duration-300 border overflow-hidden ${
                  tierInfo?.bg
                } ${
                  isActive
                    ? `border-white/30 text-white shadow-[0_0_15px_rgba(0,0,0,0.3)] md:scale-105`
                    : `border-transparent ${tierInfo?.text} md:hover:scale-105 opacity-80 hover:opacity-100`
                }`}
              >
                {isActive && <div className="absolute inset-0 bg-white/15" />}
                <LegendIcon
                  size={14}
                  className={isActive ? 'text-white md:w-4 md:h-4' : 'md:w-4 md:h-4'}
                />
                <span className="relative z-10">{tierInfo?.label}</span>

                <span
                  className={`relative z-10 ml-0.5 md:ml-1 px-1.5 py-0.5 rounded-md shadow-inner text-[9px] md:text-[10px] tracking-widest ${
                    isActive ? 'bg-black/30 text-white' : 'bg-black/20 text-white/90'
                  }`}
                >
                  {stats.unlocked}/{stats.total}
                </span>
              </button>
            );
          })}
        </div>

        {activeTier && (
          <div
            className={`mt-2 md:mt-4 border border-ink-700/50 rounded-xl p-4 md:p-5 flex flex-col gap-2 md:gap-3 animate-fade-in-up shadow-lg relative overflow-hidden bg-ink-900/40`}
          >
            <div className={`absolute inset-0 opacity-10 ${(TIER_COLORS as any)[activeTier].bg}`} />
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-2.5">
                {React.createElement(
                  (Icons as any)[(TIER_COLORS as any)[activeTier].icon] || Icons.Award,
                  {
                    size: 18,
                    className: `${(TIER_COLORS as any)[activeTier].text} md:w-5 md:h-5`,
                  }
                )}
                <span
                  className={`text-sm md:text-base font-bold uppercase tracking-widest ${(TIER_COLORS as any)[activeTier].text}`}
                >
                  {(TIER_COLORS as any)[activeTier].label} SERÜVENİ
                </span>
              </div>
              <div className="text-base md:text-lg font-black text-ink-100">
                {tierStats[activeTier].unlocked}{' '}
                <span className="text-ink-500 font-bold">/ {tierStats[activeTier].total}</span>
              </div>
            </div>
            <div className="relative z-10 h-2 md:h-2.5 w-full bg-ink-950 rounded-full overflow-hidden shadow-inner border border-ink-800/80">
              <div
                className={`h-full rounded-full transition-all duration-1000 relative ${(TIER_COLORS as any)[activeTier].bg}`}
                style={{
                  width: `${Math.floor(
                    (tierStats[activeTier].unlocked / Math.max(tierStats[activeTier].total, 1)) *
                      100
                  )}%`,
                }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          BAŞARIM KARTLARI LİSTESİ
          ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 pb-8 pt-2 md:pt-4">
        {filteredAchievements.map((a) => {
          const tierInfo = (TIER_COLORS as any)[a.tier.tier];
          const Icon =
            a.isUnlocked && tierInfo
              ? (Icons as any)[tierInfo.icon] || Icons.Award
              : (Icons as any)[a.def.icon] || Icons.HelpCircle;

          const displayName = a.tier.name || a.def.name;
          const parsedDesc = a.def.description.replace('{threshold}', String(a.tier.threshold));

          const isLocked = !a.isUnlocked;
          const isSecretUnlocked = a.isUnlocked && a.def.secret;

          let containerClass =
            'relative rounded-xl md:rounded-2xl p-3 md:p-4 flex gap-3 md:gap-4 items-start transition-all duration-300 shadow-lg border flex-row ';
          if (isLocked) {
            containerClass += 'bg-ink-900/60 border-ink-800/50 hover:bg-ink-800/60 ';
          } else if (isSecretUnlocked) {
            containerClass +=
              'bg-gradient-to-br from-fuchsia-900/40 to-purple-900/20 border-fuchsia-500/50 shadow-[0_0_20px_rgba(217,70,239,0.15)] overflow-hidden';
          } else {
            containerClass += `bg-gradient-to-br from-ink-800/90 to-ink-900 hover:shadow-xl ${
              tierInfo?.border || 'border-ink-700'
            }`;
          }

          let iconWrapperClass = `w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner `;
          if (isLocked) iconWrapperClass += 'bg-ink-950 border border-ink-800/50';
          else iconWrapperClass += tierInfo?.bg;

          const iconColorClass =
            isLocked && !isTestMode
              ? 'text-ink-600'
              : isSecretUnlocked
              ? tierInfo?.text
              : tierInfo?.text;

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
                      <span
                        className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 md:px-2 md:py-0.5 rounded shadow-sm ${tierInfo?.bg} ${tierInfo?.text}`}
                      >
                        {tierInfo?.label}
                      </span>

                      <span
                        className={`text-[9px] md:text-[10px] font-black px-1.5 py-0.5 md:px-2 md:py-0.5 rounded flex items-center gap-1 bg-ink-950/50 border border-ink-800 ${
                          isLocked ? 'text-gold-500/70' : 'text-gold-400'
                        }`}
                      >
                        <Icons.Star
                          size={8}
                          className={`md:w-2.5 md:h-2.5 ${
                            isLocked ? 'text-gold-500/50' : 'text-gold-500'
                          }`}
                        />
                        +{a.tier.xp} XP
                      </span>

                      {a.def.secret && (
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 md:px-2 md:py-0.5 rounded border bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30">
                          Gizli
                        </span>
                      )}

                      {!isLocked && (
                        <span
                          className={`text-[9px] md:text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                            isSecretUnlocked ? 'text-fuchsia-300' : 'text-green-500'
                          }`}
                        >
                          <Icons.CheckCircle2 size={10} className="md:w-3 md:h-3" /> Tamamlandı
                        </span>
                      )}
                    </div>

                    {!isLocked && a.unlockedAt && (
                      <div
                        className={`text-[10px] md:text-xs font-semibold mt-0.5 flex-shrink-0 ${
                          isSecretUnlocked ? 'text-fuchsia-400/70' : 'text-ink-400'
                        }`}
                      >
                        {formatDateTime(a.unlockedAt)}
                      </div>
                    )}
                  </div>

                  <h3
                    className={`text-sm md:text-base font-black truncate tracking-tight mb-0.5 md:mb-1 ${
                      isSecretUnlocked ? 'text-fuchsia-100' : 'text-white'
                    }`}
                  >
                    {displayName}
                  </h3>
                  <p
                    className={`text-xs md:text-sm leading-relaxed ${
                      isSecretUnlocked ? 'text-fuchsia-200/80' : 'text-ink-300'
                    }`}
                  >
                    {isLocked && !isTestMode
                      ? 'Bu kupanın sırrını çözmek için izlemeye devam et.'
                      : parsedDesc}
                  </p>
                </div>

                {isLocked && (
                  <div className="mt-3 md:mt-4 pt-1">
                    <div className="flex justify-between items-end mb-1 md:mb-1.5">
                      <span className="text-[10px] md:text-xs font-bold text-ink-400">
                        {current} / {target}
                      </span>
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