import { useId } from 'react';
import { formatCoins } from '../lib/coins';

interface Props {
  amount: number;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'gap-1.5 pl-1.5 pr-2.5 py-1 text-xs',
  md: 'gap-2 pl-2 pr-3.5 py-1.5 text-sm',
  lg: 'gap-2.5 pl-2.5 pr-5 py-2 text-base',
};

const coinSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

export function SineCoinIcon({ className = 'h-5 w-5' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none overflow-visible ${className}`}
    >
      <defs>
        <linearGradient id={`sc-rim-${uid}`} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="25%" stopColor="#FDE047" />
          <stop offset="55%" stopColor="#F59E0B" />
          <stop offset="85%" stopColor="#B45309" />
          <stop offset="100%" stopColor="#FEF08A" />
        </linearGradient>

        <linearGradient id={`sc-recess-${uid}`} x1="6" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#78350F" />
          <stop offset="50%" stopColor="#92400E" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>

        <radialGradient id={`sc-core-${uid}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="45%" stopColor="#F59E0B" />
          <stop offset="85%" stopColor="#B45309" />
          <stop offset="100%" stopColor="#78350F" />
        </radialGradient>

        <linearGradient id={`sc-emblem-${uid}`} x1="12" y1="10" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#FEF9C3" />
          <stop offset="100%" stopColor="#FDE047" />
        </linearGradient>

        <linearGradient id={`sc-sheen-${uid}`} x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Dış Altın Gövde */}
      <circle
        cx="20"
        cy="20"
        r="18.5"
        fill={`url(#sc-rim-${uid})`}
        stroke="#FEF08A"
        strokeWidth="0.75"
        strokeOpacity="0.6"
      />

      {/* Madeni Para Tırtıklı Kenar Halkası */}
      <circle
        cx="20"
        cy="20"
        r="16.4"
        stroke="#78350F"
        strokeWidth="1.1"
        strokeDasharray="1.8 1.8"
        strokeOpacity="0.55"
      />

      {/* İç Derinlik Çemberi */}
      <circle cx="20" cy="20" r="14.6" fill={`url(#sc-recess-${uid})`} />

      {/* Merkez Altın Yüzey */}
      <circle cx="20" cy="20" r="13.2" fill={`url(#sc-core-${uid})`} />

      {/* Sinema Makarası / Perfore Film Detayları */}
      <circle
        cx="20"
        cy="20"
        r="11.3"
        stroke="#FEF9C3"
        strokeWidth="0.75"
        strokeDasharray="2.5 3.5"
        strokeOpacity="0.45"
      />

      {/* Sol & Sağ Sinematik Yıldız Noktaları */}
      <circle cx="10.2" cy="20" r="1" fill="#FFFBEB" fillOpacity="0.9" />
      <circle cx="29.8" cy="20" r="1" fill="#FFFBEB" fillOpacity="0.9" />

      {/* Merkez Sinema Klaketi & Yıldız Amblemi */}
      <path
        d="M20 10.5L22.2 15.6L27.7 16.1L23.5 19.7L24.8 25.1L20 22.2L15.2 25.1L16.5 19.7L12.3 16.1L17.8 15.6L20 10.5Z"
        fill={`url(#sc-emblem-${uid})`}
        stroke="#92400E"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />

      {/* Üst Parlama (Glass/Metallic Sheen) */}
      <path
        d="M8.5 14.5C11 9.5 16 6.8 22 7.2C25.5 7.5 28.5 9.2 30.2 11.8C26.5 9.8 21.5 9.5 16.8 11.5C12.8 13.2 9.8 16.5 8.2 20.5C7.8 18.4 8 16.3 8.5 14.5Z"
        fill={`url(#sc-sheen-${uid})`}
      />
    </svg>
  );
}

export default function CoinPill({ amount, onClick, size = 'md', className = '' }: Props) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`group relative inline-flex items-center overflow-hidden rounded-full border border-gold-400/35 bg-gradient-to-r from-ink-950/90 via-gold-950/40 to-ink-900/90 font-black text-gold-100 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.28),inset_0_1px_1px_rgba(255,255,255,0.18)] backdrop-blur-md transition-all duration-300 ${
        onClick
          ? 'cursor-pointer hover:-translate-y-0.5 hover:border-gold-400/70 hover:shadow-[0_8px_25px_-4px_rgba(245,158,11,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)] active:translate-y-0'
          : ''
      } ${sizes[size]} ${className}`}
      title="SineCoin bakiyesi"
    >
      {/* Arka Plan Altın Işıltısı */}
      <span className="pointer-events-none absolute -left-3 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-gold-400/20 blur-md transition-opacity group-hover:bg-gold-400/35" />

      {/* Çerçevesiz Yüzen 3D SineCoin */}
      <span className="relative flex items-center justify-center drop-shadow-[0_2px_6px_rgba(245,158,11,0.55)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
        <SineCoinIcon className={coinSizes[size]} />
      </span>

      {/* Miktar */}
      <span className="relative bg-gradient-to-b from-white via-gold-100 to-gold-300 bg-clip-text font-black tabular-nums tracking-tight text-transparent drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        {formatCoins(amount)}
      </span>

      {/* SC Birim Etiketi */}
      <span className="relative rounded bg-gold-500/15 px-1 py-0.5 text-[9px] font-black uppercase leading-none tracking-widest text-gold-300/90 ring-1 ring-inset ring-gold-400/25">
        SC
      </span>
    </Tag>
  );
}