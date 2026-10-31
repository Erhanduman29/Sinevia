import { useEffect, useId, useRef, useState } from 'react';

/**
 * Sini — Sinevia'nın altın klaket maskotu.
 *
 * - Gövde: koyu (ink) yuvarlatılmış klaket kartı, altın gradient şerit.
 * - Kol (klaket kolu): altın, menteşeli; klap yapar ve İŞARET EDER.
 * - Yüz: iki yuvarlak göz (azure iris + ışık noktası), gülümseme, hafif allık.
 * - Aksesuar: küçük altın papyon.
 * - Hale: çok hafif altın parıltı.
 *
 * `mood` prop'u ile farklı durumlar canlandırılır.
 */
export type SiniMood = 'idle' | 'talk' | 'point' | 'happy' | 'think' | 'sad' | 'clap';

interface SiniProps {
  size?: number;
  mood?: SiniMood;
  /** 'left' | 'right' — point mood'unda hangi tarafa işaret ettiği */
  pointDir?: 'left' | 'right' | 'up' | 'down';
  className?: string;
  showGlow?: boolean;
  /** false → durağan "fotoğraf" hali: yüzen/klap/göz kırpma animasyonları yok. */
  animate?: boolean;
}

export default function Sini({
  size = 120,
  mood = 'idle',
  pointDir = 'right',
  className = '',
  showGlow = true,
  animate = true,
}: SiniProps) {
  const [blink, setBlink] = useState(false);
  const [clap, setClap] = useState(false);
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkOffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clapOffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rastgele göz kırpma (her instance kendi zamanlayıcısına sahip)
  useEffect(() => {
    if (!animate) return;
    let cancelled = false;
    const schedule = () => {
      const delay = 2600 + Math.random() * 3600;
      blinkTimer.current = setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        blinkOffTimer.current = setTimeout(() => {
          if (cancelled) return;
          setBlink(false);
          schedule();
        }, 130);
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      if (blinkTimer.current) clearTimeout(blinkTimer.current);
      if (blinkOffTimer.current) clearTimeout(blinkOffTimer.current);
    };
  }, [animate]);

  // happy / clap mood'unda periyodik klaket
  useEffect(() => {
    if (!animate) return;
    if (mood !== 'happy' && mood !== 'clap') return;
    let cancelled = false;
    const cycle = () => {
      if (cancelled) return;
      setClap(true);
      clapOffTimer.current = setTimeout(() => {
        if (!cancelled) setClap(false);
      }, 160);
      clapTimer.current = setTimeout(cycle, 1100);
    };
    cycle();
    return () => {
      cancelled = true;
      if (clapTimer.current) clearTimeout(clapTimer.current);
      if (clapOffTimer.current) clearTimeout(clapOffTimer.current);
    };
  }, [mood, animate]);

  const isHappy = mood === 'happy';
  const isSad = mood === 'sad';
  const isThink = mood === 'think';

  // Benzersiz gradyan kimlikleri: aynı DOM'da birden çok Sini render edildiğinde
  // (logo + kart + yoldaş) tarayıcı url(#siniGold) yazan HER instance için DOM'da
  // ilk bulduğu kimliği çözer. İlk instance gizli bir kapta (mobil başlık) ise
  // renkler bozulabilir — bu yüzden her instance kendi kimliğini kullanır.
  const uid = useId().replace(/:/g, '');
  const idGold = `siniGold-${uid}`;
  const idBody = `siniBody-${uid}`;
  const idEye = `siniEye-${uid}`;
  const idShine = `siniShine-${uid}`;

  // İşaret yönüne göre tahta ve kol dönüşü
  const pointTilt =
    mood === 'point'
      ? pointDir === 'left'
        ? 6
        : pointDir === 'up'
        ? -4
        : pointDir === 'down'
        ? 5
        : -6
      : 0;

  // Klap: kol kapanır (açık → kapalı)
  const armAngle = clap ? -2 : mood === 'point' ? -26 : -14;

  // İşaret kolu (sadece point mood'unda görünür)
  const pointerAngle =
    pointDir === 'left'
      ? 200
      : pointDir === 'up'
      ? -90
      : pointDir === 'down'
      ? 90
      : 0;

  return (
    <div
      className={`relative inline-block select-none ${className}`}
      style={{ width: size, height: size * (130 / 120) }}
      aria-hidden="true"
    >
      {showGlow && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none sini-glow"
          style={{
            background:
              'radial-gradient(circle at 50% 55%, rgba(245,158,11,0.22), rgba(245,158,11,0.05) 55%, transparent 72%)',
            filter: 'blur(6px)',
          }}
        />
      )}

      <svg
        viewBox="0 0 120 130"
        width={size}
        height={size * (130 / 120)}
        className={`relative ${animate && (mood === 'idle' || mood === 'talk') ? 'sini-float' : ''}`}
        style={{ transform: `rotate(${pointTilt}deg)`, transformOrigin: '50% 70%' }}
      >
        <defs>
          <linearGradient id={idGold} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id={idBody} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#26262e" />
            <stop offset="100%" stopColor="#0f0f14" />
          </linearGradient>
          <radialGradient id={idEye} cx="0.4" cy="0.35" r="0.75">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="55%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </radialGradient>
          <linearGradient id={idShine} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.30)" />
            <stop offset="45%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* --- KLAKET KOLU (menteşe) --- */}
        <g
          style={{
            transformOrigin: '26px 42px',
            transform: `rotate(${armAngle}deg)`,
            transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <rect x="22" y="30" width="82" height="15" rx="4" fill={`url(#${idGold})`} />
          {/* çapraz şeritler */}
          <g opacity="0.55">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line
                key={i}
                x1={30 + i * 14}
                y1="45"
                x2={39 + i * 14}
                y2="30"
                stroke="#0a0a0e"
                strokeWidth="4"
                strokeLinecap="round"
              />
            ))}
          </g>
          <rect x="22" y="30" width="82" height="15" rx="4" fill={`url(#${idShine})`} />
        </g>

        {/* --- GÖVDE (klaket kartı) --- */}
        <rect x="18" y="42" width="84" height="76" rx="14" fill={`url(#${idBody})`} />
        <rect
          x="18.5"
          y="42.5"
          width="83"
          height="75"
          rx="13.5"
          fill="none"
          stroke="rgba(245,158,11,0.35)"
          strokeWidth="1.5"
        />
        <rect x="18" y="42" width="84" height="76" rx="14" fill={`url(#${idShine})`} />
        {/* ince altın alt şerit */}
        <rect x="30" y="108" width="60" height="3" rx="1.5" fill={`url(#${idGold})`} opacity="0.7" />

        {/* --- YÜZ --- */}
        {/* Gözler */}
        {isHappy ? (
          // ^^ mutlu gözler
          <g stroke="#38bdf8" strokeWidth="3.2" strokeLinecap="round" fill="none">
            <path d="M38 78 q7 -9 14 0" />
            <path d="M68 78 q7 -9 14 0" />
          </g>
        ) : (
          <g>
            <ellipse cx="45" cy="76" rx="9" ry={blink ? 1.4 : 10} fill={`url(#${idEye})`} style={{ transition: 'ry 0.1s' }} />
            <ellipse cx="75" cy="76" rx="9" ry={blink ? 1.4 : 10} fill={`url(#${idEye})`} style={{ transition: 'ry 0.1s' }} />
            {!blink && (
              <>
                <circle cx="42" cy="72" r="3" fill="#fff" opacity="0.9" />
                <circle cx="72" cy="72" r="3" fill="#fff" opacity="0.9" />
                <circle cx="47.5" cy="80" r="1.4" fill="#fff" opacity="0.6" />
                <circle cx="77.5" cy="80" r="1.4" fill="#fff" opacity="0.6" />
              </>
            )}
          </g>
        )}

        {/* Gülümseme */}
        {isSad ? (
          <path d="M50 95 q10 -7 20 0" stroke="#e4e4e7" strokeWidth="2.6" strokeLinecap="round" fill="none" transform="rotate(180 60 93)" />
        ) : (
          <path
            d={isHappy ? 'M46 90 q14 16 28 0' : 'M50 91 q10 8 20 0'}
            stroke="#e4e4e7"
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
            className={mood === 'talk' ? 'sini-mouth' : ''}
          />
        )}

        {/* Allık */}
        <ellipse cx="33" cy="86" rx="6" ry="3.5" fill="#f472b6" opacity={isSad ? 0.2 : 0.32} />
        <ellipse cx="87" cy="86" rx="6" ry="3.5" fill="#f472b6" opacity={isSad ? 0.2 : 0.32} />

        {/* Düşünce: çeneye değen minik el */}
        {isThink && (
          <g>
            <circle cx="72" cy="97" r="6" fill={`url(#${idGold})`} />
            <rect x="69" y="88" width="6" height="10" rx="3" fill={`url(#${idGold})`} />
          </g>
        )}

        {/* --- PAPYON --- */}
        <g transform="translate(60 115)">
          <path d="M0 0 L-11 -5 L-11 5 Z" fill={`url(#${idGold})`} />
          <path d="M0 0 L11 -5 L11 5 Z" fill={`url(#${idGold})`} />
          <circle cx="0" cy="0" r="2.6" fill="#b45309" />
        </g>

        {/* --- İŞARET KOLU (sadece point) --- */}
        {mood === 'point' && (
          <g
            style={{
              transformOrigin: '96px 66px',
              transform: `rotate(${pointerAngle}deg)`,
              transition: 'transform 0.2s ease-out',
            }}
          >
            <line x1="96" y1="66" x2="118" y2="66" stroke={`url(#${idGold})`} strokeWidth="6" strokeLinecap="round" />
            <circle cx="119" cy="66" r="4" fill={`url(#${idGold})`} />
          </g>
        )}
      </svg>
    </div>
  );
}
