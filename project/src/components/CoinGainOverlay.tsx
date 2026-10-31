import { useEffect, useState, type CSSProperties } from 'react';
import { SineCoinIcon } from './CoinPill';
import { formatCoins } from '../lib/coins';

interface Props {
  amount: number;
  label: string;
}

// Merkezden dışarı patlayan 6 adet hazine sikkesi
const BURST_COINS = [
  { delay: 0.1, tx: -110, ty: -40, rot: -180, scale: 0.8 },
  { delay: 0.15, tx: 110, ty: -30, rot: 180, scale: 0.8 },
  { delay: 0.2, tx: -70, ty: 60, rot: -90, scale: 0.7 },
  { delay: 0.25, tx: 70, ty: 70, rot: 90, scale: 0.7 },
  { delay: 0.3, tx: -130, ty: 10, rot: -220, scale: 0.9 },
  { delay: 0.35, tx: 130, ty: 20, rot: 220, scale: 0.9 },
];

const SPARKS = Array.from({ length: 12 }, (_, i) => i);

export default function CoinGainOverlay({ amount, label }: Props) {
  const [displayAmount, setDisplayAmount] = useState(0);

  // Sayaç: 100ms'de başlar, 700ms'de jet hızıyla hedefe ulaşır
  useEffect(() => {
    let rafId = 0;
    const startDelay = 100;
    const duration = 700;
    const startTime = performance.now() + startDelay;

    const tick = (now: number) => {
      if (now < startTime) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 4); // Hızlı başlangıç, yavaş bitiş
      setDisplayAmount(Math.round(amount * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [amount]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[245] flex items-center justify-center overflow-hidden px-4 select-none">
      <style>{`
        /* 2.4s Ana Sahne Yaşam Döngüsü */
        @keyframes scb-stage-short {
          0% { opacity: 0; }
          4% { opacity: 1; }
          85% { opacity: 1; transform: scale(1); filter: blur(0px); }
          100% { opacity: 0; transform: scale(1.05); filter: blur(6px); }
        }

        /* 3D Ana Para Taklası ve Zemin Oturuşu */
        @keyframes scb-hero-pop {
          0% {
            opacity: 0;
            transform: perspective(800px) translate3d(0, -60px, -150px) rotateY(-180deg) scale(0.6);
          }
          15% {
            opacity: 1;
            transform: perspective(800px) translate3d(0, 0px, 0px) rotateY(0deg) scale(1.15);
          }
          25% { transform: perspective(800px) translate3d(0, -10px, 0px) scale(0.98); }
          35%, 85% { transform: perspective(800px) translate3d(0, 0px, 0px) scale(1); }
          100% { opacity: 0; transform: perspective(800px) translate3d(0, -20px, 0px) scale(0.9); }
        }

        /* Hızlı Şelale Saçılımı (Jackpot Burst) */
        @keyframes scb-burst-coin {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.2);
          }
          20% {
            opacity: 1;
            transform: translate(calc(var(--tx) * 0.8), calc(var(--ty) * 0.8 - 30px)) rotate(calc(var(--rot) * 0.5)) scale(var(--sc));
          }
          60% {
            opacity: 0.8;
            transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(var(--sc));
          }
          100% {
            opacity: 0;
            transform: translate(calc(var(--tx) * 1.2), calc(var(--ty) * 1.2 + 20px)) rotate(calc(var(--rot) * 1.5)) scale(0.5);
          }
        }

        /* Arka Plan Işıması */
        @keyframes scb-glow-short {
          0% { opacity: 0; transform: scale(0.5); }
          15% { opacity: 0.8; transform: scale(1.1); }
          35% { opacity: 0.5; transform: scale(0.95); }
          85% { opacity: 0.5; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.2); }
        }

        /* Kıvılcım Patlaması */
        @keyframes scb-spark-fast {
          0% { opacity: 0; transform: translate(0, 0) scale(0); }
          20% { opacity: 1; transform: translate(var(--sx), calc(var(--sy) - 10px)) scale(1.2); }
          100% { opacity: 0; transform: translate(calc(var(--sx) * 1.5), calc(var(--sy) * 1.5)) scale(0); }
        }

        /* Sayaç Animasyonu */
        @keyframes scb-hud-fast {
          0% { opacity: 0; transform: translateY(20px) scale(0.85); }
          15% { opacity: 1; transform: translateY(-3px) scale(1.05); filter: drop-shadow(0 0 15px rgba(253,224,71,0.5)); }
          30%, 85% { opacity: 1; transform: translateY(0) scale(1); filter: drop-shadow(0 0 0px transparent); }
          100% { opacity: 0; transform: translateY(10px) scale(0.95); }
        }
      `}</style>

      <div
        className="relative flex h-[380px] w-full max-w-[500px] flex-col items-center justify-center"
        style={{ animation: 'scb-stage-short 2.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
      >
        {/* Hazine Işığı */}
        <span
          className="absolute h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(253,224,71,0.45)_0%,rgba(245,158,11,0.2)_45%,transparent_75%)] blur-2xl"
          style={{ animation: 'scb-glow-short 2.4s ease-out forwards' }}
        />

        <div className="relative flex h-48 w-full items-center justify-center">
          {/* Fırlayan Altınlar */}
          {BURST_COINS.map((c, idx) => (
            <span
              key={`cas-${idx}`}
              className="absolute z-0"
              style={
                {
                  opacity: 0,
                  '--tx': `${c.tx}px`,
                  '--ty': `${c.ty}px`,
                  '--rot': `${c.rot}deg`,
                  '--sc': c.scale,
                  animation: `scb-burst-coin 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${c.delay}s forwards`,
                } as CSSProperties
              }
            >
              <SineCoinIcon className="h-10 w-10 drop-shadow-[0_4px_10px_rgba(245,158,11,0.6)]" />
            </span>
          ))}

          {/* Kıvılcımlar */}
          {SPARKS.map((i) => {
            const angle = (i / SPARKS.length) * Math.PI * 2;
            const radius = 80 + (i % 2) * 20;
            return (
              <span
                key={`sp-${i}`}
                className="absolute h-1.5 w-1.5 rounded-full bg-yellow-100 shadow-[0_0_8px_#FDE047]"
                style={
                  {
                    opacity: 0,
                    '--sx': `${Math.cos(angle) * radius}px`,
                    '--sy': `${Math.sin(angle) * radius}px`,
                    animation: `scb-spark-fast 0.8s ease-out ${0.05 + (i % 3) * 0.05}s forwards`,
                  } as CSSProperties
                }
              />
            );
          })}

          {/* Ana 3D Coin */}
          <div
            className="relative z-10 flex h-32 w-32 items-center justify-center origin-center"
            style={{ animation: 'scb-hero-pop 2.4s cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
          >
            <span className="absolute inset-2 rounded-full bg-gold-400/40 blur-xl" />
            <SineCoinIcon className="relative h-32 w-32 drop-shadow-[0_12px_24px_rgba(245,158,11,0.8)]" />
          </div>
        </div>

        {/* Kazanç Sayacı */}
        <div
          className="relative z-20 mt-1 text-center"
          style={{ animation: 'scb-hud-fast 2.2s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both' }}
        >
          <div className="inline-flex items-baseline justify-center gap-2 rounded-full border border-gold-300/50 bg-ink-950/85 px-6 py-2 shadow-[0_8px_25px_rgba(0,0,0,0.7),0_0_15px_rgba(245,158,11,0.4)] backdrop-blur-md">
            <span className="bg-gradient-to-b from-white via-yellow-100 to-gold-400 bg-clip-text text-5xl font-black leading-none tracking-tight text-transparent tabular-nums drop-shadow-[0_2px_12px_rgba(245,158,11,0.6)] sm:text-6xl">
              +{formatCoins(displayAmount)}
            </span>
            <span className="text-lg font-black uppercase tracking-[0.2em] text-gold-300">
              SC
            </span>
          </div>

          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-gold-400/70" />
            <p className="max-w-[320px] truncate text-[12px] font-black uppercase tracking-[0.25em] text-gold-100 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
              {label}
            </p>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-gold-400/70" />
          </div>
        </div>
      </div>
    </div>
  );
}