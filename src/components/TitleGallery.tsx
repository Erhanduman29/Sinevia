import React from 'react';
import { Crown, Check, Lock, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { levelFromXp } from '../lib/xp';
import { RANK_TIERS, type RankTier } from '../lib/rankTiers';

// ============================================================
// SOY KÜTÜĞÜ — Unvan Kütüğü Galerisi
// Tüm rütbe/unvan kademeleri, mevcut kademe vurgulu olarak
// ============================================================

type TierState = 'past' | 'active' | 'locked';

function tierStateFor(index: number, currentIndex: number): TierState {
  if (index < currentIndex) return 'past';
  if (index === currentIndex) return 'active';
  return 'locked';
}

function TierCard({ tier, state }: { tier: RankTier; state: TierState }) {
  const Emblem = tier.icon;
  const locked = state === 'locked';
  const active = state === 'active';

  return (
    <div
      className={`relative rounded-2xl p-4 border transition-all ${
        active
          ? `bg-[#0D0D12] ${tier.border} ring-2 ring-offset-0 shadow-2xl`
          : locked
            ? 'bg-[#0A0A0F] border-[#1C1C26] opacity-75'
            : 'bg-[#0D0D12] border-[#22222C] hover:border-[#33333F]'
      }`}
    >
      {active && (
        <span className={`absolute -top-2.5 right-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${tier.badgeBg} ${tier.color} ${tier.border}`}>
          <Sparkles size={9} /> Aktif
        </span>
      )}

      <div className="flex items-center gap-3.5">
        <div className={`w-14 h-14 rounded-xl grid place-items-center shrink-0 border ${active ? `${tier.border} ${tier.bgGlow}` : 'border-[#22222C] bg-[#101018]'} ${locked ? 'grayscale' : ''}`}>
          <Emblem className={`${active ? tier.color : locked ? 'text-ink-500' : tier.color} w-7 h-7`} />
        </div>

        <div className="min-w-0 flex-1">
          <b className={`block text-sm font-black tracking-tight ${locked ? 'text-ink-400' : 'text-white'}`}>
            {tier.title}
          </b>
          <span className="block text-[11px] font-semibold text-ink-400 leading-snug mt-0.5">
            {tier.subtitle}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-3.5 pt-3 border-t border-[#1C1C26]">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black tabular-nums border ${active ? `${tier.badgeBg} ${tier.color} ${tier.border}` : 'bg-[#101018] text-ink-400 border-[#22222C]'}`}>
          Sv. {tier.minLevel}–{tier.maxLevel}
        </span>

        {state === 'past' && (
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-400">
            <Check size={11} /> Açıldı
          </span>
        )}
        {state === 'active' && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider ${tier.color}`}>
            Kuşanıldı
          </span>
        )}
        {state === 'locked' && (
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-ink-500">
            <Lock size={11} /> Sv. {tier.minLevel}
          </span>
        )}
      </div>
    </div>
  );
}

export default function TitleGallery() {
  const { data } = useApp();
  const lvl = levelFromXp(data.totalXp || 0);

  const currentRankIndex = React.useMemo(() => {
    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
      if (lvl.level >= RANK_TIERS[i].minLevel) return i;
    }
    return 0;
  }, [lvl.level]);

  const current = RANK_TIERS[currentRankIndex];
  const next = RANK_TIERS[currentRankIndex + 1] || null;
  const CurrentEmblem = current.icon;

  const rankProgressPct = React.useMemo(() => {
    if (!next) return 100;
    const span = Math.max(1, next.minLevel - current.minLevel);
    const done = Math.max(0, lvl.level - current.minLevel);
    return Math.min(100, Math.max(6, Math.round((done / span) * 100)));
  }, [next, current.minLevel, lvl.level]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in-up">
      {/* MEVCUT UNVAN HERO KONSOLU */}
      <div className="bg-[#0D0D12] border border-[#22222C] rounded-2xl p-4 sm:p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-stretch gap-4 sm:gap-6">
          {/* Sol: Embleme + Unvan Kimliği */}
          <div className="flex items-center gap-4 sm:gap-5 min-w-0 lg:flex-1">
            <div className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl grid place-items-center shrink-0 border ${current.border} ${current.bgGlow}`}>
              <CurrentEmblem className={`${current.color} w-10 h-10 sm:w-12 sm:h-12`} />
            </div>

            <div className="min-w-0">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border mb-1.5 ${current.badgeBg} ${current.color} ${current.border}`}>
                <Crown size={10} /> Kuşanılan Unvan
              </span>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white leading-none">
                {current.title}
              </h2>
              <p className="text-ink-400 text-sm font-semibold mt-1.5">{current.subtitle}</p>
            </div>
          </div>

          {/* Sağ: Kademe İlerlemesi */}
          <div className="lg:w-80 flex flex-col justify-center gap-2.5">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider">
              <span className="text-ink-400">
                Sv. {current.minLevel} → {next ? next.minLevel : current.maxLevel}
              </span>
              <span className={`tabular-nums ${current.color}`}>Seviye {lvl.level}</span>
            </div>

            <div className="h-2.5 rounded-full bg-[#090910] border border-[#22222C] overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${current.barGradient} transition-all duration-1000`}
                style={{ width: `${rankProgressPct}%` }}
              />
            </div>

            {next ? (
              <span className="text-[11px] font-bold text-ink-400">
                Sonraki Unvan:{' '}
                <span className={next.color}>
                  {next.title} (Sv. {next.minLevel})
                </span>{' '}
                — {Math.max(0, next.minLevel - lvl.level)} seviye kaldı
              </span>
            ) : (
              <span className="text-[11px] font-bold text-ink-400">
                Zirvedesin — tüm unvanlar kuşanıldı
              </span>
            )}
          </div>
        </div>
      </div>

      {/* TÜM UNVAN KADEMELERİ */}
      <div className="bg-[#0D0D12] border border-[#22222C] rounded-2xl p-4 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4 sm:mb-5">
          <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
            <Crown size={16} className="text-rose-500" /> Unvan Kademesi
          </h3>
          <span className="text-[11px] font-black uppercase tracking-widest text-ink-400 tabular-nums">
            {RANK_TIERS.filter((_, i) => i <= currentRankIndex).length} / {RANK_TIERS.length} Açıldı
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {RANK_TIERS.map((tier, i) => (
            <TierCard key={tier.title} tier={tier} state={tierStateFor(i, currentRankIndex)} />
          ))}
        </div>
      </div>
    </div>
  );
}
