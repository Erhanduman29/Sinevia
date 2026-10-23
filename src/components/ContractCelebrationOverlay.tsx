import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { CheckCircle2, Zap } from 'lucide-react';
import { CONTRACT_MAP } from '../lib/contracts';
import { formatCoins } from '../lib/coins';
import { SineCoinIcon } from './CoinPill';

interface Props {
  contractId: string;
  xp: number;
  coins: number;
  onClose: () => void;
}

interface TierVisual {
  accent: string;
  accentSoft: string;
  label: string;
  rays: number;
  rings: number;
  particles: number;
}

const TIER_VISUALS: Record<string, TierVisual> = {
  common: { accent: '#cbd5e1', accentSoft: '#94a3b8', label: 'Yaygın', rays: 12, rings: 2, particles: 16 },
  rare: { accent: '#7dd3fc', accentSoft: '#38bdf8', label: 'Nadir', rays: 16, rings: 3, particles: 22 },
  epic: { accent: '#c4b5fd', accentSoft: '#e879f9', label: 'Destansı', rays: 20, rings: 3, particles: 30 },
  legendary: { accent: '#fde68a', accentSoft: '#f59e0b', label: 'Efsanevi', rays: 24, rings: 4, particles: 40 },
  mythic: { accent: '#fda4af', accentSoft: '#fb923c', label: 'Mitik', rays: 28, rings: 5, particles: 52 },
};

const RAY_ANGLES = Array.from({ length: 28 }, (_, i) => i);
const PARTICLE_SEEDS = Array.from({ length: 52 }, (_, i) => i);

export function ContractCelebrationOverlay({ contractId, xp, coins, onClose }: Props) {
  const def = CONTRACT_MAP.get(contractId);
  const visual = TIER_VISUALS[def?.rarity || 'common'] || TIER_VISUALS.common;
  const rays = RAY_ANGLES.slice(0, visual.rays);
  const particles = PARTICLE_SEEDS.slice(0, visual.particles);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // 4200ms'den 3000ms'ye düşürüldü.
    const timer = window.setTimeout(() => onCloseRef.current(), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center overflow-hidden px-4"
      role="status"
      aria-live="polite"
    >
      <style>{`
        /* 2.8s Genel Yaşam Döngüsü */
        @keyframes cco-bg {
          0% { opacity: 0; }
          12% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes cco-stage {
          0% { opacity: 0; transform: translateY(15px) scale(.92); }
          10% { opacity: 1; transform: translateY(0) scale(1); }
          80% { opacity: 1; transform: translateY(0) scale(1.015); }
          100% { opacity: 0; transform: translateY(-8px) scale(1.04); }
        }
        @keyframes cco-glow {
          0% { opacity: 0; transform: scale(.4); }
          15% { opacity: 1; transform: scale(1); }
          65% { opacity: .8; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(1.2); }
        }
        @keyframes cco-ray {
          0% { opacity: 0; transform: rotate(var(--a)) scaleY(.05); }
          15% { opacity: .9; }
          55% { opacity: .4; }
          100% { opacity: 0; transform: rotate(var(--a)) scaleY(1.6); }
        }
        @keyframes cco-ring {
          0% { opacity: .9; transform: scale(.2); }
          55% { opacity: .4; }
          100% { opacity: 0; transform: scale(2.6); }
        }
        @keyframes cco-particle {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(.2); }
          15% { opacity: 1; }
          75% { opacity: .8; }
          100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.25); }
        }
        /* Arma ve Yazı Animasyonları Daha Seri */
        @keyframes cco-emblem {
          0% { opacity: 0; transform: scale(.4) rotate(-12deg); }
          60% { opacity: 1; transform: scale(1.08) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes cco-icon {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-5px) rotate(2deg); }
        }
        @keyframes cco-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes cco-text {
          0% { opacity: 0; transform: translateY(12px); filter: blur(4px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes cco-chip {
          0% { opacity: 0; transform: translateY(10px) scale(.92); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 46%, ${visual.accent}2e 0%, ${visual.accentSoft}18 28%, rgba(2,6,23,.62) 58%, rgba(2,6,23,.9) 100%)`,
          animation: 'cco-bg 2.8s ease-in-out forwards',
        }}
      />

      <div
        className="cco-stage relative flex h-[430px] w-full max-w-3xl items-center justify-center"
        style={{ animation: 'cco-stage 2.8s cubic-bezier(.2,.8,.25,1) forwards' }}
      >
        <span
          className="absolute h-[27rem] w-[27rem] rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle, ${visual.accent}4d 0%, ${visual.accentSoft}24 42%, transparent 70%)`,
            animation: 'cco-glow 2.7s ease-out forwards',
          }}
        />

        {rays.map((i) => (
          <span
            key={`ray-${i}`}
            className="cco-ray absolute h-52 w-px origin-bottom"
            style={{
              '--a': `${(i / visual.rays) * 360 + (i % 2) * 4}deg`,
              background: `linear-gradient(to top, transparent, ${visual.accent}dd, transparent)`,
              animation: `cco-ray ${1.4 + (i % 4) * 0.1}s cubic-bezier(.16,.7,.25,1) ${0.05 + (i % 5) * 0.02}s forwards`,
            } as CSSProperties}
          />
        ))}

        {Array.from({ length: visual.rings }, (_, i) => (
          <span
            key={`ring-${i}`}
            className="cco-ring absolute h-44 w-44 rounded-full border"
            style={{
              borderColor: i % 2 === 0 ? `${visual.accent}b3` : `${visual.accentSoft}80`,
              boxShadow: `0 0 34px ${visual.accent}38`,
              animation: `cco-ring ${1.6 + i * 0.2}s cubic-bezier(.16,.7,.25,1) ${i * 0.12}s forwards`,
            }}
          />
        ))}

        {particles.map((i) => {
          const angle = (i / visual.particles) * Math.PI * 2 + (i % 5) * 0.27;
          const distance = 112 + (i % 8) * 24;
          const size = 2 + (i % 4);
          return (
            <span
              key={`particle-${i}`}
              className="cco-particle absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: size,
                height: size,
                background: i % 3 === 0 ? visual.accent : visual.accentSoft,
                boxShadow: `0 0 ${8 + size * 2}px ${visual.accent}`,
                '--dx': `${Math.cos(angle) * distance}px`,
                '--dy': `${Math.sin(angle) * distance}px`,
                animation: `cco-particle ${1.1 + (i % 6) * 0.12}s ease-out ${0.05 + (i % 9) * 0.04}s forwards`,
              } as CSSProperties}
            />
          );
        })}

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="relative" style={{ animation: 'cco-emblem .6s cubic-bezier(.2,.85,.25,1.08) both' }}>
            <span
              className="absolute -inset-6 rounded-full border border-dashed opacity-50"
              style={{ borderColor: visual.accent, animation: 'cco-spin 9s linear infinite' }}
            />
            <span
              className="absolute -inset-2 rounded-full border opacity-70"
              style={{ borderColor: `${visual.accent}99`, boxShadow: `0 0 42px ${visual.accent}55 inset` }}
            />
            <div
              className="relative flex h-40 w-40 items-center justify-center rounded-full border-2 bg-ink-950/85 shadow-2xl"
              style={{
                borderColor: `${visual.accent}cc`,
                boxShadow: `0 0 60px ${visual.accent}45, 0 18px 50px rgba(0,0,0,.55)`,
              }}
            >
              <span
                className="cco-icon text-7xl"
                style={{
                  animation: 'cco-icon 2.8s ease-in-out 0.5s infinite',
                  filter: `drop-shadow(0 0 22px ${visual.accent}80)`,
                }}
              >
                {def?.icon || '🎯'}
              </span>
              <CheckCircle2 className="absolute -bottom-1 -right-1 h-11 w-11 rounded-full bg-ink-950 p-1.5 text-emerald-400" />
            </div>
          </div>

          <div className="mt-6" style={{ animation: 'cco-text .5s cubic-bezier(.2,.9,.25,1) .2s both' }}>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.28em]"
              style={{ borderColor: `${visual.accent}66`, color: visual.accent, background: `${visual.accent}12` }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: visual.accent }} />
              Pazar görevi tamamlandı
            </div>

            <h2
              className="mx-auto mt-3 max-w-xl text-3xl font-black leading-tight text-white sm:text-5xl"
              style={{ textShadow: `0 0 34px ${visual.accent}55` }}
            >
              {def?.title || 'Görev tamamlandı'}
            </h2>

            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: visual.accent }}>
              {visual.label}
            </p>
          </div>

          <div
            className="mt-5 flex flex-wrap items-center justify-center gap-2.5"
            style={{ animation: 'cco-chip .5s cubic-bezier(.2,.9,.25,1) .35s both' }}
          >
            <div className="flex items-center gap-2 rounded-full border border-azure-500/35 bg-azure-500/12 px-4 py-2 backdrop-blur-sm">
              <Zap className="h-4 w-4 text-azure-300" />
              <span className="text-sm font-black text-white">+{xp.toLocaleString('tr-TR')} XP</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-gold-500/40 bg-gold-500/12 px-4 py-2 backdrop-blur-sm">
              <SineCoinIcon className="h-5 w-5" />
              <span className="text-sm font-black text-gold-200">+{formatCoins(coins)} SC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}