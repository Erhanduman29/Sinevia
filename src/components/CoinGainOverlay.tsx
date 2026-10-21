import type { CSSProperties } from 'react';
import { SineCoinIcon } from './CoinPill';
import { formatCoins } from '../lib/coins';

interface Props {
  amount: number;
  label: string;
}

const ORBIT = Array.from({ length: 10 }, (_, i) => i);
const RAYS = Array.from({ length: 14 }, (_, i) => i);

/**
 * Başarım coin kazanımı — pencere değil, doğrudan coin üzerinde dönen
 * ışık/gölge ve yörünge animasyonu. XP barından tamamen bağımsızdır.
 */
export default function CoinGainOverlay({ amount, label }: Props) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[245] flex items-center justify-center overflow-hidden px-4">
      <style>{`
        @keyframes scg-glow {
          0% { opacity: 0; transform: scale(.3); }
          12% { opacity: .95; transform: scale(1); }
          66% { opacity: .88; transform: scale(1.07); }
          100% { opacity: 0; transform: scale(1.24); }
        }
        @keyframes scg-ray {
          0% { opacity: 0; transform: rotate(var(--a)) scaleY(.06); }
          14% { opacity: .82; }
          62% { opacity: .45; }
          100% { opacity: 0; transform: rotate(var(--a)) scaleY(1.85); }
        }
        @keyframes scg-wave {
          0% { opacity: .9; transform: scale(.18); }
          62% { opacity: .42; }
          100% { opacity: 0; transform: scale(2.75); }
        }
        @keyframes scg-spin {
          0% { opacity: 0; transform: perspective(700px) rotateY(-240deg) scale(.24); }
          38% { opacity: 1; transform: perspective(700px) rotateY(18deg) scale(1.16); }
          58% { transform: perspective(700px) rotateY(-5deg) scale(1.05); }
          72%, 100% { opacity: 1; transform: perspective(700px) rotateY(0deg) scale(1); }
        }
        @keyframes scg-bob {
          0%, 100% { transform: translateY(0) rotate(-1.5deg); }
          50% { transform: translateY(-10px) rotate(1.5deg); }
        }
        @keyframes scg-spec {
          0% { opacity: 0; transform: translateX(-150%) rotate(18deg); }
          14% { opacity: .9; }
          58% { opacity: .55; }
          100% { opacity: 0; transform: translateX(175%) rotate(18deg); }
        }
        @keyframes scg-orbit {
          0% { opacity: 0; transform: rotate(var(--a)) translateX(168px) scale(.16); }
          16% { opacity: 1; }
          58% { opacity: .95; transform: rotate(var(--a)) translateX(92px) scale(.9); }
          84% { opacity: .7; transform: rotate(var(--a)) translateX(76px) scale(.75); }
          100% { opacity: 0; transform: rotate(var(--a)) translateX(68px) scale(.3); }
        }
        @keyframes scg-text {
          0% { opacity: 0; transform: translateY(20px) scale(.84); filter: blur(7px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes scg-fade {
          0% { opacity: 0; transform: scale(.95); }
          6%, 82% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.035); }
        }
        @media (prefers-reduced-motion: reduce) {
          .scg-anim {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <div className="scg-anim relative flex h-[360px] w-full max-w-[520px] items-center justify-center" style={{ animation: 'scg-fade 6.2s ease forwards' }}>
        {/* Merkez ışıması */}
        <span
          className="absolute h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(253,224,71,.5)_0%,rgba(245,158,11,.24)_38%,transparent_70%)] blur-2xl"
          style={{ animation: 'scg-glow 6.2s ease-out forwards' }}
        />

        {/* Işın patlaması */}
        {RAYS.map((i) => (
          <span
            key={`r${i}`}
            className="absolute h-44 w-[2px] origin-bottom rounded-full bg-gradient-to-t from-transparent via-gold-300/70 to-transparent"
            style={{
              '--a': `${(i / RAYS.length) * 360}deg`,
              animation: `scg-ray ${2.4 + (i % 3) * 0.22}s ease-out ${0.12 + (i % 4) * 0.035}s forwards`,
            } as CSSProperties}
          />
        ))}

        {/* Şok halkaları */}
        <span className="absolute h-44 w-44 rounded-full border border-gold-300/70" style={{ animation: 'scg-wave 3.5s ease-out forwards' }} />
        <span className="absolute h-44 w-44 rounded-full border border-gold-500/40" style={{ animation: 'scg-wave 4.2s ease-out .28s forwards' }} />

        {/* Yörüngedeki mini coinler */}
        {ORBIT.map((i) => (
          <span
            key={`o${i}`}
            className="absolute"
            style={{
              '--a': `${(i / ORBIT.length) * 360}deg`,
              animation: `scg-orbit ${4.4 + (i % 4) * 0.16}s ease-out ${0.1 + i * 0.035}s forwards`,
            } as CSSProperties}
          >
            <SineCoinIcon className="h-5 w-5 opacity-80 drop-shadow-[0_0_8px_rgba(251,191,36,.65)]" />
          </span>
        ))}

        {/* Ana coin + metin */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative" style={{ perspective: '700px' }}>
            <div
              className="relative flex h-36 w-36 items-center justify-center"
              style={{ animation: 'scg-spin 1.45s cubic-bezier(.2,.85,.25,1.05) forwards, scg-bob 3.4s ease-in-out 1.45s infinite' }}
            >
              <span className="absolute inset-2 rounded-full bg-gold-400/30 blur-2xl" />
              <SineCoinIcon className="relative h-32 w-32 drop-shadow-[0_10px_26px_rgba(245,158,11,.65)]" />
              {/* Coin üzerinde gezinen spekuler ışık — iki kez süpürür */}
              <span className="absolute inset-2 overflow-hidden rounded-full" style={{ clipPath: 'circle(50%)' }}>
                <span
                  className="absolute -inset-y-6 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/90 to-transparent mix-blend-screen"
                  style={{ animation: 'scg-spec 2.15s ease-in-out .28s forwards' }}
                />
                <span
                  className="absolute -inset-y-6 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/80 to-transparent mix-blend-screen"
                  style={{ animation: 'scg-spec 2.15s ease-in-out 3.35s forwards' }}
                />
              </span>
            </div>
          </div>

          <div className="mt-2 text-center" style={{ animation: 'scg-text .85s cubic-bezier(.2,.9,.25,1) .55s both' }}>
            <div className="flex items-end justify-center gap-2">
              <span className="bg-gradient-to-b from-white via-gold-100 to-gold-400 bg-clip-text text-5xl font-black leading-none tracking-tight text-transparent drop-shadow-[0_0_22px_rgba(245,158,11,.35)] sm:text-6xl">
                +{formatCoins(amount)}
              </span>
              <span className="pb-1 text-base font-black uppercase tracking-[0.25em] text-gold-300">SC</span>
            </div>
            <p className="mx-auto mt-3 max-w-[340px] truncate text-[11px] font-bold uppercase tracking-[0.22em] text-gold-200/75">
              {label}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
