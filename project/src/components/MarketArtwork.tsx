import { useId, type ReactNode } from 'react';
import type { ContractDef, ContractMetric } from '../lib/contracts';
import type { MarketItemDef } from '../lib/marketItems';

type IdFn = (name: string) => string;

interface Palette {
  light: string;
  mid: string;
  dark: string;
  glow: string;
}

type Glyph = (g: IdFn, p: Palette) => ReactNode;

const PALETTES = {
  silver: { light: '#FFFFFF', mid: '#CBD5E1', dark: '#5B6B84', glow: '#E2E8F0' },
  gold: { light: '#FFF6C9', mid: '#FBBF24', dark: '#A45B06', glow: '#FCD34D' },
  violet: { light: '#E9D5FF', mid: '#8B5CF6', dark: '#4C1D95', glow: '#C084FC' },
  rose: { light: '#FFE4E6', mid: '#F43F5E', dark: '#881337', glow: '#FB7185' },
  cyan: { light: '#CFFAFE', mid: '#22D3EE', dark: '#0E7490', glow: '#67E8F9' },
  azure: { light: '#DBEAFE', mid: '#3B82F6', dark: '#1E3A8A', glow: '#60A5FA' },
  amber: { light: '#FEF3C7', mid: '#F59E0B', dark: '#92400E', glow: '#FBBF24' },
  emerald: { light: '#D1FAE5', mid: '#10B981', dark: '#065F46', glow: '#34D399' },
  orange: { light: '#FFEDD5', mid: '#F97316', dark: '#9A3412', glow: '#FB923C' },
  ruby: { light: '#FFE4E6', mid: '#E11D48', dark: '#7F1D1D', glow: '#FB7185' },
  teal: { light: '#CCFBF1', mid: '#14B8A6', dark: '#115E59', glow: '#2DD4BF' },
  slate: { light: '#F8FAFC', mid: '#94A3B8', dark: '#334155', glow: '#CBD5E1' },
} satisfies Record<string, Palette>;

const face = (g: IdFn) => `url(#${g('face')})`;
const sheen = (g: IdFn) => `url(#${g('sheen')})`;

/** 4 uçlu yıldız / pırıltı. */
function Star4({
  cx,
  cy,
  r,
  fill,
  opacity = 1,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  opacity?: number;
}) {
  return (
    <path
      d={`M${cx} ${cy - r} Q${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r}Z`}
      fill={fill}
      opacity={opacity}
    />
  );
}

/**
 * Yumuşak stüdyo ışığı, zemin gölgesi ve metalik gradyanlarla
 * derinlik hissi veren ortak SVG sahnesi.
 */
function Art3D({
  palette,
  className,
  children,
}: {
  palette: Palette;
  className?: string;
  children: Glyph;
}) {
  const raw = useId().replace(/:/g, '');
  const g: IdFn = (name) => `mkt-${name}-${raw}`;

  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none overflow-visible ${className || ''}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={g('face')} x1="16" y1="9" x2="48" y2="57" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="42%" stopColor={palette.mid} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
        <linearGradient id={g('sheen')} x1="19" y1="7" x2="35" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.92" />
          <stop offset="52%" stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={g('halo')} cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor={palette.glow} stopOpacity="0.5" />
          <stop offset="52%" stopColor={palette.glow} stopOpacity="0.16" />
          <stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
        </radialGradient>
        <filter id={g('shadow')} x="-40%" y="-40%" width="180%" height="190%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.4" floodColor="#000000" floodOpacity="0.5" />
        </filter>
        <filter id={g('soft')} x="-40%" y="-40%" width="180%" height="190%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
      </defs>

      <circle cx="32" cy="32" r="31" fill={`url(#${g('halo')})`} />
      <ellipse cx="32" cy="57" rx="15" ry="3.4" fill={palette.dark} opacity="0.48" filter={`url(#${g('soft')})`} />
      {children(g, palette)}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Eşya ikonları                                                       */
/* ------------------------------------------------------------------ */

function frameGlyph(variant: 'star' | 'reel' | 'play' | 'drop' | 'orbit'): Glyph {
  return (g, p) => (
    <>
      <circle cx="32" cy="33.5" r="21.5" fill="none" stroke={p.dark} strokeWidth="7" opacity="0.5" />
      <circle cx="32" cy="32" r="21.5" fill="none" stroke={face(g)} strokeWidth="6.4" />
      <circle cx="32" cy="32" r="18.2" fill="#07070C" fillOpacity="0.62" />
      <circle cx="32" cy="32" r="18.2" fill="none" stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="1.2" />
      <path
        d="M14.8 25A19 19 0 0 1 43 13"
        fill="none"
        stroke={sheen(g)}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M46.2 45.6A21 21 0 0 1 20 51"
        fill="none"
        stroke={p.dark}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.85"
      />
      {variant === 'star' && <Star4 cx={32} cy={32} r={7.5} fill={p.light} />}
      {variant === 'reel' && (
        <g>
          <circle cx="32" cy="32" r="7.6" fill={face(g)} />
          <circle cx="32" cy="32" r="2" fill={p.dark} />
          <circle cx="29" cy="28.6" r="1.7" fill={p.dark} opacity="0.8" />
          <circle cx="35" cy="28.6" r="1.7" fill={p.dark} opacity="0.8" />
          <circle cx="34.4" cy="35.4" r="1.7" fill={p.dark} opacity="0.8" />
          <circle cx="29.6" cy="35.4" r="1.7" fill={p.dark} opacity="0.8" />
        </g>
      )}
      {variant === 'play' && <path d="M28.5 25.4 40.5 32 28.5 38.6Z" fill={p.light} />}
      {variant === 'drop' && (
        <path
          d="M32 23.6c4.2 5 6.2 7.7 6.2 10.6a6.2 6.2 0 0 1-12.4 0c0-2.9 2-5.6 6.2-10.6Z"
          fill={face(g)}
          stroke={p.light}
          strokeWidth="1"
        />
      )}
      {variant === 'orbit' && (
        <g transform="rotate(-18 32 32)">
          <ellipse cx="32" cy="32" rx="11.4" ry="4.8" fill="none" stroke={p.light} strokeWidth="1.4" opacity="0.9" />
          <circle cx="32" cy="32" r="4.4" fill={face(g)} />
          <circle cx="42.4" cy="29.4" r="1.5" fill={p.light} />
        </g>
      )}
    </>
  );
}

const moonGlyph: Glyph = (g, p) => (
  <>
    <defs>
      <mask id={g('moon-cut')}>
        <rect width="64" height="64" fill="white" />
        <circle cx="41.5" cy="24" r="16.5" fill="black" />
      </mask>
    </defs>
    <circle cx="31" cy="33" r="18.5" fill={face(g)} mask={`url(#${g('moon-cut')})`} />
    <path d="M19 21a18 18 0 0 1 14-7" stroke={sheen(g)} strokeWidth="2.4" strokeLinecap="round" fill="none" />
    <Star4 cx={48} cy={18} r={2.6} fill={p.light} />
    <Star4 cx={52} cy={29} r={1.6} fill={p.light} opacity={0.8} />
    <Star4 cx={44} cy={11} r={1.4} fill={p.light} opacity={0.7} />
  </>
);

const crownGlyph: Glyph = (g, p) => (
  <>
    <path
      d="M12 24.5 20.5 31 32 12l11.5 19 8.5-6.5-4.6 22.6c-.2 1.2-1.2 2-2.4 2H19c-1.2 0-2.2-.8-2.4-2Z"
      fill={face(g)}
      stroke={p.dark}
      strokeWidth="1"
      strokeLinejoin="round"
    />
    <rect x="16.4" y="47" width="31.2" height="4.4" rx="2.2" fill={p.dark} />
    <circle cx="21" cy="34.5" r="2.4" fill={p.light} />
    <circle cx="32" cy="34.5" r="2.8" fill="#FFF7ED" />
    <circle cx="43" cy="34.5" r="2.4" fill={p.light} />
    <path d="M18 22.5 25 28" stroke={sheen(g)} strokeWidth="2.4" strokeLinecap="round" />
    <Star4 cx={50} cy={15} r={2} fill={p.light} opacity={0.9} />
  </>
);

const templeGlyph: Glyph = (g, p) => (
  <>
    <path d="M8 24 32 10l24 14Z" fill={face(g)} stroke={p.dark} strokeWidth="1" strokeLinejoin="round" />
    <path d="M17 20 32 8l15 12" stroke={sheen(g)} strokeWidth="2" strokeLinecap="round" fill="none" />
    <rect x="11.5" y="25" width="41" height="4" rx="1.6" fill={p.dark} />
    <rect x="15" y="30.5" width="6.4" height="19" rx="1.6" fill={face(g)} />
    <rect x="25.2" y="30.5" width="6.4" height="19" rx="1.6" fill={face(g)} />
    <rect x="35.4" y="30.5" width="6.4" height="19" rx="1.6" fill={face(g)} />
    <rect x="45.6" y="30.5" width="6.4" height="19" rx="1.6" fill={face(g)} />
    <rect x="11.5" y="50.5" width="41" height="4.4" rx="1.8" fill={p.dark} />
  </>
);

const compassGlyph: Glyph = (g, p) => (
  <>
    <circle cx="32" cy="32" r="21.5" fill={face(g)} stroke={p.dark} strokeWidth="1.4" />
    <circle cx="32" cy="32" r="16.8" fill="#0B0B12" fillOpacity="0.58" stroke={p.light} strokeOpacity="0.35" strokeWidth="1.2" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
      <path
        key={angle}
        d="M32 16.8v3"
        stroke={p.light}
        strokeWidth={angle % 90 === 0 ? 1.8 : 1}
        strokeLinecap="round"
        opacity={angle % 90 === 0 ? 1 : 0.55}
        transform={`rotate(${angle} 32 32)`}
      />
    ))}
    <path d="M32 17.5 38 35.5 32 32 26 35.5Z" fill={p.light} />
    <path d="M32 46.5 26 28.5 32 32 38 28.5Z" fill={p.dark} />
    <circle cx="32" cy="32" r="2.6" fill="#FFFFFF" />
  </>
);

const popcornGlyph: Glyph = (g, p) => (
  <>
    <ellipse cx="32" cy="27" rx="12.5" ry="3.4" fill="#FDE68A" stroke="#B45309" strokeWidth="1" />
    <path
      d="M20.5 27h23l-2.8 22.7a3.6 3.6 0 0 1-3.6 3.3H26.9a3.6 3.6 0 0 1-3.6-3.3Z"
      fill={p.mid}
      stroke={p.dark}
      strokeWidth="1.2"
    />
    <path d="M26.5 28.5 25 50.5h4.6l1.2-22Z" fill="#FFF7ED" opacity="0.88" />
    <path d="M35 28.5 36.4 50.5h4.6l-1.5-22Z" fill="#FFF7ED" opacity="0.88" />
    <path d="M31.3 28.5 31 50.5h2l-.3-22Z" fill="#FFF7ED" opacity="0.55" />
    <g>
      <circle cx="24.5" cy="22.5" r="5" fill="#FFF7ED" stroke="#E7C77E" strokeWidth="1" />
      <circle cx="32" cy="19.5" r="5.6" fill="#FFFDF6" stroke="#E7C77E" strokeWidth="1" />
      <circle cx="39.5" cy="22.5" r="5" fill="#FFF7ED" stroke="#E7C77E" strokeWidth="1" />
      <circle cx="28" cy="15.5" r="4" fill="#FFFDF6" stroke="#E7C77E" strokeWidth="1" />
      <circle cx="36.5" cy="15.2" r="3.8" fill="#FFF7ED" stroke="#E7C77E" strokeWidth="1" />
      <circle cx="24" cy="21" r="1.5" fill="#FCD34D" />
      <circle cx="32.5" cy="18" r="1.6" fill="#FBBF24" />
      <circle cx="39" cy="21.5" r="1.4" fill="#FCD34D" />
    </g>
    <path d="M24 31c.4 5 .9 10 1.4 15" stroke={sheen(g)} strokeWidth="2" strokeLinecap="round" fill="none" />
  </>
);

const clapperGlyph: Glyph = (g, p) => (
  <g transform="rotate(-8 32 32)">
    <rect x="11.5" y="29" width="41" height="20.5" rx="3" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <rect x="11.5" y="18" width="41" height="11.5" rx="2.6" fill={p.dark} />
    {[0, 1, 2, 3].map((i) => (
      <path key={i} d={`M${16 + i * 9.4} 18h5.2l-4 11.5h-5.2Z`} fill="#F8FAFC" opacity="0.9" />
    ))}
    <circle cx="14" cy="23.5" r="2.1" fill={p.light} />
    <path d="M17 40.5h15" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M17 45h9" stroke="#FFFFFF" strokeOpacity="0.32" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M13 33h23" stroke={sheen(g)} strokeWidth="2" strokeLinecap="round" />
  </g>
);

const ticketGlyph: Glyph = (g, p) => (
  <g transform="rotate(-10 32 32)">
    <path
      d="M15 22.5h32a3 3 0 0 1 3 3v4.3a5 5 0 0 0 0 10v4.7a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V40a5 5 0 0 0 0-10v-4.5a3 3 0 0 1 3-3Z"
      fill={face(g)}
      stroke={p.dark}
      strokeWidth="1.2"
    />
    <path d="M39.5 24v2.2M39.5 29.2v2.2M39.5 34.4v2.2M39.5 39.6v2.2" stroke={p.dark} strokeWidth="1.5" strokeDasharray="2 2.4" opacity="0.75" />
    <Star4 cx={26} cy={36} r={7.4} fill={p.light} />
    <circle cx="17" cy="36" r="1.7" fill={p.dark} opacity="0.55" />
    <path d="M14 27c2-1.5 4-2.3 6-2.5" stroke={sheen(g)} strokeWidth="1.8" strokeLinecap="round" fill="none" />
  </g>
);

const projectorGlyph: Glyph = (g, p) => (
  <>
    <path d="M15 33 3 24.5v19L15 41Z" fill={p.light} opacity="0.22" />
    <rect x="14" y="29" width="31" height="17" rx="3" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <circle cx="24" cy="22" r="6.6" fill="none" stroke={p.mid} strokeWidth="3" />
    <circle cx="38.5" cy="23" r="5" fill="none" stroke={p.mid} strokeWidth="2.8" />
    <circle cx="24" cy="22" r="1.7" fill={p.dark} />
    <circle cx="38.5" cy="23" r="1.3" fill={p.dark} />
    <rect x="10.5" y="33" width="5.5" height="8.5" rx="1.6" fill={p.dark} />
    <circle cx="37" cy="37.5" r="2.6" fill={p.dark} opacity="0.55" />
    <rect x="19" y="46" width="5.5" height="3" rx="1.2" fill={p.dark} />
    <rect x="36" y="46" width="5.5" height="3" rx="1.2" fill={p.dark} />
    <path d="M17 33h12" stroke={sheen(g)} strokeWidth="1.8" strokeLinecap="round" />
  </>
);

const masksGlyph: Glyph = (g, p) => (
  <>
    <g transform="rotate(10 39 35)">
      <path
        d="M39 20.5c5.2 0 9.4 3.2 9.4 8v8.2c0 6.4-4.2 11.3-9.4 11.3s-9.4-4.9-9.4-11.3v-8.2c0-4.8 4.2-8 9.4-8Z"
        fill={p.dark}
        stroke={p.mid}
        strokeWidth="1"
      />
      <ellipse cx="35.7" cy="30.5" rx="2" ry="2.7" fill="#0B0B12" />
      <ellipse cx="42.3" cy="30.5" rx="2" ry="2.7" fill="#0B0B12" />
      <path d="M35.8 41c1.9-1.9 4.5-1.9 6.4 0" stroke={p.light} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </g>
    <g transform="rotate(-8 25 36)">
      <path
        d="M25 20.5c5.2 0 9.4 3.2 9.4 8v8.2c0 6.4-4.2 11.3-9.4 11.3s-9.4-4.9-9.4-11.3v-8.2c0-4.8 4.2-8 9.4-8Z"
        fill={face(g)}
        stroke={p.light}
        strokeWidth="1.2"
      />
      <ellipse cx="22" cy="30.5" rx="2" ry="2.7" fill="#0B0B12" opacity="0.8" />
      <ellipse cx="28" cy="30.5" rx="2" ry="2.7" fill="#0B0B12" opacity="0.8" />
      <path d="M21 39c2 3 6 3 8 0" stroke={p.light} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M20 24c2-2 5-3 8-2.5" stroke={sheen(g)} strokeWidth="2" strokeLinecap="round" fill="none" />
    </g>
  </>
);

const waveGlyph: Glyph = (g, p) => (
  <>
    <circle cx="46" cy="15.5" r="5.4" fill={p.light} opacity="0.9" />
    <path d="M6 42c6 0 8-7 14-7s8 7 14 7 8-7 14-7 6 5 8 7v10H6Z" fill={p.dark} opacity="0.75" />
    <path
      d="M6 34c6 0 8-7 14-7s8 7 14 7 8-7 14-7 6 5 8 7v9c-2-2-4-5-8-5-6 0-8 7-14 7s-8-7-14-7-8 7-14 7Z"
      fill={face(g)}
    />
    <path d="M14 31c4-4 8-6 13-6" stroke={sheen(g)} strokeWidth="2.4" strokeLinecap="round" fill="none" />
    <circle cx="20" cy="27" r="1.3" fill="#FFFFFF" opacity="0.7" />
    <circle cx="28" cy="24.5" r="1" fill="#FFFFFF" opacity="0.55" />
  </>
);

const cometGlyph: Glyph = (g, p) => (
  <>
    <path d="M55 8c-10 1-20 7-26 15l7 7c8-6 15-13 19-22Z" fill={p.light} opacity="0.3" />
    <path d="M51 10c-8 3-14 8-19 14l5 5c6-5 11-11 14-19Z" fill={p.light} opacity="0.52" />
    <circle cx="27" cy="38" r="10.2" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <path d="M20 34a9.4 9.4 0 0 1 6.4-5.2" stroke={sheen(g)} strokeWidth="2.6" strokeLinecap="round" fill="none" />
    <Star4 cx={48} cy={25} r={2.1} fill={p.light} />
    <Star4 cx={41} cy={14.5} r={1.4} fill={p.light} opacity={0.75} />
    <Star4 cx={18} cy={20} r={1.2} fill={p.light} opacity={0.55} />
  </>
);

const gemGlyph: Glyph = (g, p) => (
  <>
    <path d="M32 9 50 22 32 55 14 22Z" fill={face(g)} stroke={p.dark} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M32 9 25 22h14Z" fill={p.light} opacity="0.92" />
    <path d="M14 22h36L32 55Z" fill={p.light} opacity="0.12" />
    <path d="M25 22 32 55l7-33" stroke={p.light} strokeOpacity="0.55" strokeWidth="1" />
    <path d="M20.5 16.5 28 19.5" stroke="#FFFFFF" strokeOpacity="0.65" strokeWidth="1.6" strokeLinecap="round" />
    <Star4 cx={47} cy={13} r={2.4} fill={p.light} />
  </>
);

const shieldGlyph: Glyph = (g, p) => (
  <>
    <path d="M32 7.5 51 14v13.5C51 41 42.5 50 32 57 21.5 50 13 41 13 27.5V14Z" fill={face(g)} stroke={p.dark} strokeWidth="1.3" />
    <path
      d="M32 13.5 45 18v9.5c0 9.6-5.8 16.6-13 21.4-7.2-4.8-13-11.8-13-21.4V18Z"
      fill="none"
      stroke={p.light}
      strokeOpacity="0.5"
      strokeWidth="1.3"
    />
    <path d="M32 20.5c3.8 5 6 8.2 6 11.4a6 6 0 0 1-12 0c0-3.2 2.2-6.4 6-11.4Z" fill={p.light} />
    <path d="M32 26.5c1.6 2 2.4 3.4 2.4 4.8a2.4 2.4 0 1 1-4.8 0c0-1.4.8-2.8 2.4-4.8Z" fill={p.mid} />
  </>
);

const diceGlyph: Glyph = (g, p) => (
  <g transform="rotate(-8 32 32)">
    <rect x="27" y="18.5" width="20" height="20" rx="4.5" fill={p.dark} transform="rotate(10 37 28.5)" />
    <circle cx="34" cy="24" r="1.5" fill={p.light} opacity="0.7" />
    <circle cx="41" cy="30" r="1.5" fill={p.light} opacity="0.7" />
    <rect x="14.5" y="27" width="23" height="23" rx="5" fill={face(g)} stroke={p.light} strokeOpacity="0.45" strokeWidth="1" />
    <circle cx="21" cy="33.5" r="1.7" fill="#0B0B12" opacity="0.75" />
    <circle cx="31" cy="33.5" r="1.7" fill="#0B0B12" opacity="0.75" />
    <circle cx="21" cy="43.5" r="1.7" fill="#0B0B12" opacity="0.75" />
    <circle cx="26" cy="38.5" r="1.7" fill="#0B0B12" opacity="0.75" />
    <circle cx="31" cy="43.5" r="1.7" fill="#0B0B12" opacity="0.75" />
    <path d="M18.5 31h9" stroke={sheen(g)} strokeWidth="1.8" strokeLinecap="round" />
  </g>
);

const boltGlyph: Glyph = (g, p) => (
  <>
    <path
      d="M37 7 15 35h12l-4 22 22-30H33Z"
      fill={face(g)}
      stroke={p.dark}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M36 11.5 21.5 31h8.5" stroke={sheen(g)} strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <Star4 cx={50} cy={14} r={2.2} fill={p.light} opacity={0.9} />
    <Star4 cx={14} cy={50} r={1.6} fill={p.light} opacity={0.7} />
  </>
);

const couponGlyph: Glyph = (g, p) => (
  <g transform="rotate(-8 32 32)">
    <path
      d="M12 23.5h32l8 8.5-8 8.5H12a3 3 0 0 1-3-3V26.5a3 3 0 0 1 3-3Z"
      fill={face(g)}
      stroke={p.dark}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <circle cx="16.5" cy="32" r="2.2" fill="#0B0B12" opacity="0.72" />
    <path d="M36.5 25.5v13" stroke={p.light} strokeWidth="1.3" strokeDasharray="2 2.6" opacity="0.7" />
    <circle cx="25.5" cy="29" r="2.4" fill="none" stroke={p.light} strokeWidth="1.6" />
    <circle cx="30.5" cy="35" r="2.4" fill="none" stroke={p.light} strokeWidth="1.6" />
    <path d="M30.8 27 25.2 37" stroke={p.light} strokeWidth="1.6" strokeLinecap="round" />
    <path d="M14 26.5c1.6-1.2 3.2-1.8 5-2" stroke={sheen(g)} strokeWidth="1.8" strokeLinecap="round" fill="none" />
  </g>
);

const tvGlyph: Glyph = (g, p) => (
  <>
    <path d="M22.5 16 32 21.5M41.5 16 32 21.5" stroke={p.dark} strokeWidth="2.4" strokeLinecap="round" />
    <rect x="10" y="21" width="44" height="30" rx="5" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <rect x="14.5" y="25.5" width="27" height="21" rx="3" fill="#0B0B12" fillOpacity="0.8" />
    <path d="M18 42c2-5 5-7 8-7s4 2 5 4" stroke={p.light} strokeWidth="1.6" opacity="0.6" fill="none" />
    <circle cx="47.5" cy="30" r="2.4" fill={p.dark} />
    <circle cx="47.5" cy="38" r="2.4" fill={p.dark} />
    <path d="M24 51h16" stroke={p.dark} strokeWidth="3" strokeLinecap="round" />
    <path d="M27 51 24 56M37 51l3 5" stroke={p.dark} strokeWidth="2" strokeLinecap="round" />
  </>
);

const hourglassGlyph: Glyph = (g, p) => (
  <>
    <rect x="18" y="8.5" width="28" height="5" rx="2.2" fill={p.dark} />
    <rect x="18" y="50.5" width="28" height="5" rx="2.2" fill={p.dark} />
    <path
      d="M22 14h20c0 7-8 11-10 18 2 7 10 11 10 18H22c0-7 8-11 10-18-2-7-10-11-10-18Z"
      fill={p.light}
      opacity="0.16"
      stroke={p.light}
      strokeOpacity="0.5"
      strokeWidth="1.4"
    />
    <path d="M25.5 17.5h13c0 5-5.4 8-6.5 12.5-1.1-4.5-6.5-7.5-6.5-12.5Z" fill={face(g)} />
    <path d="M25.5 46.5h13c0-5-5.4-8-6.5-12.5-1.1 4.5-6.5 7.5-6.5 12.5Z" fill={face(g)} opacity="0.9" />
    <path d="M32 34.5v-2" stroke={p.light} strokeWidth="1.4" strokeLinecap="round" />
  </>
);

const paletteGlyph: Glyph = (g, p) => (
  <>
    <path
      d="M32 9c13 0 23 9 23 20 0 6-4.6 9-10 9h-4c-3 0-5 2-5 5 0 4-3 7-7 7-11 0-20-9-20-20.5C9 17.5 19 9 32 9Z"
      fill={face(g)}
      stroke={p.dark}
      strokeWidth="1.2"
    />
    <circle cx="22.5" cy="22" r="3.4" fill="#F87171" />
    <circle cx="32.5" cy="17.5" r="3.4" fill="#FBBF24" />
    <circle cx="42.5" cy="24" r="3.4" fill="#34D399" />
    <circle cx="20.5" cy="33" r="3.4" fill="#60A5FA" />
    <circle cx="31" cy="29" r="3.4" fill="#A78BFA" />
    <circle cx="40.5" cy="44.5" r="4.4" fill="#0B0B12" opacity="0.72" />
    <path d="M18 17c4-4 9-6 14-6" stroke={sheen(g)} strokeWidth="2.4" strokeLinecap="round" fill="none" />
  </>
);

const starGlyph: Glyph = (g, p) => (
  <>
    <path
      d="M32 8.5 39.4 23.7 56 26l-12 11.7 2.9 16.6L32 46.4 17.1 54.3 20 37.7 8 26l16.6-2.3Z"
      fill={face(g)}
      stroke={p.dark}
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
    <path d="M32 15.5 36.4 25 46 26.4l-7 6.8 1.7 9.6L32 38.2 23.3 42.8 25 33.2l-7-6.8L27.6 25Z" fill={p.light} opacity="0.28" />
    <path d="M32 15.5V38" stroke={p.light} strokeOpacity="0.45" strokeWidth="0.9" />
    <Star4 cx={49} cy={13} r={2.2} fill={p.light} opacity={0.85} />
  </>
);

const penGlyph: Glyph = (g, p) => (
  <>
    <path d="M50.5 9.5C36 12 22 22 16 38l-4.5 12.5L24 46c16-6 26-20 26.5-36.5Z" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <path d="M46 14C35 24 27 33 20.5 44" stroke={p.light} strokeWidth="1.4" opacity="0.65" fill="none" />
    <path d="M12 51.5 20 44" stroke={p.dark} strokeWidth="3" strokeLinecap="round" />
    <path d="M44 13.5 47 10" stroke={sheen(g)} strokeWidth="2" strokeLinecap="round" />
    <Star4 cx={17} cy={20} r={1.8} fill={p.light} opacity={0.7} />
  </>
);

const bookGlyph: Glyph = (g, p) => (
  <>
    <path d="M8 16c6-3 13-3 20 1v34c-7-4-14-4-20-1Z" fill={face(g)} stroke={p.dark} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M56 16c-6-3-13-3-20 1v34c7-4 14-4 20-1Z" fill={p.mid} stroke={p.dark} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M32 17v34" stroke={p.dark} strokeWidth="1.6" />
    <path d="M13 22c4-1 7-1 10 0M13 28c4-1 7-1 10 0M41 22c3-1 6-1 10 0M41 28c3-1 6-1 10 0" stroke={p.light} strokeOpacity="0.6" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M11 18c4-1.5 8-1.8 12-0.5" stroke={sheen(g)} strokeWidth="1.8" strokeLinecap="round" fill="none" />
  </>
);

const radioGlyph: Glyph = (g, p) => (
  <>
    <circle cx="32" cy="13" r="3" fill={p.light} />
    <path d="M32 17v33M32 25 23 50M32 25l9 25M20 50h24" stroke={p.mid} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M23 20c-4 4-4 10 0 14M41 20c4 4 4 10 0 14" stroke={p.light} strokeWidth="2" fill="none" opacity="0.75" strokeLinecap="round" />
    <path d="M17 13c-6 6-6 14 0 20M47 13c6 6 6 14 0 20" stroke={p.light} strokeWidth="2" fill="none" opacity="0.42" strokeLinecap="round" />
    <rect x="25" y="39" width="14" height="11" rx="2" fill={face(g)} stroke={p.dark} strokeWidth="1" />
    <circle cx="32" cy="44.5" r="2" fill={p.dark} opacity="0.65" />
  </>
);

const calendarGlyph: Glyph = (g, p) => (
  <>
    <rect x="9" y="14" width="46" height="40" rx="6" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <path d="M9 20a6 6 0 0 1 6-6h34a6 6 0 0 1 6 6v5.5H9Z" fill={p.dark} />
    <rect x="17.5" y="8.5" width="5" height="10" rx="2.5" fill={p.light} />
    <rect x="41.5" y="8.5" width="5" height="10" rx="2.5" fill={p.light} />
    {[
      [19, 32],
      [27.5, 32],
      [36, 32],
      [44.5, 32],
      [19, 41],
      [27.5, 41],
      [36, 41],
      [44.5, 41],
    ].map(([cx, cy], index) => (
      <circle key={index} cx={cx} cy={cy} r={index === 3 ? 2.6 : 2} fill={index === 3 ? p.light : '#0B0B12'} opacity={index === 3 ? 1 : 0.4} />
    ))}
    <path d="M14 27c2-1 4-1.5 6-1.5" stroke={sheen(g)} strokeWidth="1.6" strokeLinecap="round" fill="none" />
  </>
);

const flameGlyph: Glyph = (g, p) => (
  <>
    <path
      d="M32 7c2.4 10 10 13.5 12.5 22.5C46.8 39 41.5 48 32 48s-14.8-8.5-12.5-18c1.3-5.8 5-9.2 7.2-14.2 1.9 4 2.1 7.2 4.8 9.2C33.8 18 33 12.5 32 7Z"
      fill={face(g)}
      stroke={p.dark}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M32 29.5c3.2 4 5 7 5 10a5 5 0 0 1-10 0c0-3 1.8-6 5-10Z" fill={p.light} />
    <path d="M22 20c1.5 3 2.5 6 2.8 9" stroke={sheen(g)} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    <path d="M32 49v3" stroke={p.light} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
  </>
);

const layersGlyph: Glyph = (g, p) => (
  <>
    {[0, 1, 2].map((i) => {
      const top = i === 2;
      return (
        <path
          key={i}
          d={`M32 ${13 + i * 9} 51 ${24 + i * 9} 32 ${35 + i * 9} 13 ${24 + i * 9}Z`}
          fill={top ? face(g) : p.mid}
          fillOpacity={top ? 1 : 0.55 - i * 0.12}
          stroke={p.dark}
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      );
    })}
    <path d="M32 31 41 36.5 32 42 23 36.5Z" fill={p.light} opacity="0.22" />
    <path d="M43 19 51 24" stroke={sheen(g)} strokeWidth="1.8" strokeLinecap="round" />
  </>
);

const filmReelGlyph: Glyph = (g, p) => (
  <>
    <circle cx="32" cy="32" r="21" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <circle cx="32" cy="32" r="3.6" fill={p.dark} />
    {[0, 90, 180, 270].map((angle) => (
      <circle
        key={angle}
        cx="32"
        cy="22.5"
        r="3.2"
        fill="#0B0B12"
        opacity="0.7"
        transform={`rotate(${angle} 32 32)`}
      />
    ))}
    <circle cx="32" cy="32" r="17" fill="none" stroke={p.light} strokeOpacity="0.35" strokeWidth="1" />
    <path d="M17 20a19 19 0 0 1 15-7" stroke={sheen(g)} strokeWidth="2.4" strokeLinecap="round" fill="none" />
  </>
);

const clockGlyph: Glyph = (g, p) => (
  <>
    <rect x="27" y="7" width="10" height="4.5" rx="2.2" fill={p.dark} />
    <path d="M32 11.5v3" stroke={p.dark} strokeWidth="2" />
    <circle cx="32" cy="34" r="19" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <circle cx="32" cy="34" r="14.5" fill="#0B0B12" fillOpacity="0.55" stroke={p.light} strokeOpacity="0.35" strokeWidth="1" />
    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
      <path
        key={angle}
        d="M32 21.5v3"
        stroke={p.light}
        strokeWidth={angle % 90 === 0 ? 1.6 : 0.9}
        strokeLinecap="round"
        opacity={angle % 90 === 0 ? 1 : 0.55}
        transform={`rotate(${angle} 32 34)`}
      />
    ))}
    <path d="M32 34V24M32 34l7 5" stroke={p.light} strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="32" cy="34" r="2.2" fill={p.light} />
  </>
);

const stopwatchGlyph: Glyph = (g, p) => (
  <>
    <rect x="28" y="5.5" width="8" height="5" rx="2" fill={p.dark} />
    <path d="M32 10.5v3.5" stroke={p.dark} strokeWidth="2" />
    <path d="M41 14.5l3 3" stroke={p.dark} strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="32" cy="35" r="18" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <circle cx="32" cy="35" r="13.5" fill="#0B0B12" fillOpacity="0.55" stroke={p.light} strokeOpacity="0.3" />
    <path d="M32 35V26M32 35l6 4" stroke={p.light} strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="32" cy="35" r="2" fill={p.light} />
    <path d="M23 22a13 13 0 0 1 18 0" stroke={sheen(g)} strokeWidth="2" strokeLinecap="round" fill="none" />
  </>
);

const filmStripGlyph: Glyph = (g, p) => (
  <g transform="rotate(-18 32 32)">
    <rect x="10" y="20" width="44" height="24" rx="3" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    {[0, 1, 2, 3, 4].map((index) => (
      <rect key={index} x={14 + index * 8} y="24.5" width="5" height="15" rx="1" fill="#0B0B12" fillOpacity="0.65" />
    ))}
    {[0, 1, 2, 3, 4, 5].map((index) => (
      <g key={index}>
        <rect x={13 + index * 6.8} y="21" width="3" height="2" rx="0.6" fill={p.light} opacity="0.85" />
        <rect x={13 + index * 6.8} y="41" width="3" height="2" rx="0.6" fill={p.light} opacity="0.85" />
      </g>
    ))}
  </g>
);

const ticketStackGlyph: Glyph = (g, p) => (
  <g transform="rotate(-8 32 32)">
    <path
      d="M18 18h30a3 3 0 0 1 3 3v4a5 5 0 0 0 0 10v4a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3v-4a5 5 0 0 0 0-10v-4a3 3 0 0 1 3-3Z"
      fill={p.dark}
      opacity="0.75"
      transform="rotate(9 32 32)"
    />
    <path
      d="M15 25h30a3 3 0 0 1 3 3v4a5 5 0 0 0 0 10v4a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3v-4a5 5 0 0 0 0-10v-4a3 3 0 0 1 3-3Z"
      fill={face(g)}
      stroke={p.dark}
      strokeWidth="1"
    />
    <path d="M36 27v2M36 32v2M36 37v2" stroke={p.dark} strokeWidth="1.4" strokeDasharray="2 2.4" opacity="0.75" />
    <Star4 cx={24} cy={37} r={6} fill={p.light} />
    <circle cx="16" cy="37" r="1.4" fill={p.dark} opacity="0.6" />
  </g>
);

const playCircleGlyph: Glyph = (g, p) => (
  <>
    <circle cx="32" cy="32" r="20" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <circle cx="32" cy="32" r="15.5" fill="#0B0B12" fillOpacity="0.55" stroke={p.light} strokeOpacity="0.35" />
    <path d="M27 23.5 42 32 27 40.5Z" fill={p.light} />
    <path d="M17.5 21a19 19 0 0 1 13-8" stroke={sheen(g)} strokeWidth="2.2" strokeLinecap="round" fill="none" />
  </>
);

const stackGlyph: Glyph = (g, p) => (
  <>
    <rect x="13" y="30" width="38" height="20" rx="3.5" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <rect x="17" y="23" width="30" height="8" rx="2.5" fill={p.mid} opacity="0.85" />
    <rect x="21" y="17" width="22" height="6" rx="2" fill={p.light} opacity="0.55" />
    <path d="M18 37h12M18 42h8" stroke={p.light} strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
    <path d="M15.5 33h20" stroke={sheen(g)} strokeWidth="1.8" strokeLinecap="round" />
  </>
);

const archiveGlyph: Glyph = (g, p) => (
  <>
    <rect x="9" y="14" width="46" height="11" rx="2.5" fill={p.dark} />
    <rect x="12.5" y="25" width="39" height="27" rx="3.5" fill={face(g)} stroke={p.dark} strokeWidth="1.1" />
    <rect x="25" y="32" width="14" height="4" rx="2" fill={p.dark} />
    <circle cx="32" cy="34" r="1.4" fill={p.light} />
    <path d="M16 29h12" stroke={sheen(g)} strokeWidth="1.6" strokeLinecap="round" />
  </>
);

const documentGlyph: Glyph = (g, p) => (
  <>
    <path d="M18 7h19l11 11v37H18Z" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <path d="M37 7v11h11" fill={p.light} opacity="0.35" stroke={p.dark} strokeWidth="1" />
    <path
      d="M24 26h16M24 33h16M24 40h10"
      stroke={p.light}
      strokeWidth="2.2"
      strokeLinecap="round"
      opacity="0.8"
    />
    <path d="M22 20h6" stroke={sheen(g)} strokeWidth="1.6" strokeLinecap="round" />
  </>
);

const medalGlyph: Glyph = (g, p) => (
  <>
    <path d="M21 6l8 18 4-4M43 6l-8 18-4-4" stroke={p.mid} strokeWidth="5" strokeLinecap="round" fill="none" />
    <circle cx="32" cy="36" r="15" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <circle cx="32" cy="36" r="11" fill="none" stroke={p.light} strokeOpacity="0.55" strokeWidth="1" />
    <Star4 cx={32} cy={36} r={6.5} fill={p.light} />
  </>
);

const sunGlyph: Glyph = (g, p) => (
  <>
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
      <path
        key={angle}
        d="M32 9v6"
        stroke={p.light}
        strokeWidth="2.6"
        strokeLinecap="round"
        transform={`rotate(${angle} 32 32)`}
        opacity="0.85"
      />
    ))}
    <circle cx="32" cy="32" r="13" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <path d="M22 25a12 12 0 0 1 11-5" stroke={sheen(g)} strokeWidth="2.2" strokeLinecap="round" fill="none" />
  </>
);

const trophyGlyph: Glyph = (g, p) => (
  <>
    <path d="M20 10h24v10c0 8.5-5.4 14-12 14s-12-5.5-12-14Z" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <path
      d="M20 14h-6.5v4c0 5 4 8.5 9 8.5M44 14h6.5v4c0 5-4 8.5-9 8.5"
      fill="none"
      stroke={p.mid}
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    <path d="M32 34v7" stroke={p.dark} strokeWidth="3" />
    <rect x="22" y="41" width="20" height="5" rx="2" fill={p.dark} />
    <rect x="25" y="47" width="14" height="4" rx="2" fill={p.dark} opacity="0.8" />
    <Star4 cx={32} cy={16} r={4.5} fill={p.light} />
  </>
);

const chartGlyph: Glyph = (g, p) => (
  <>
    <rect x="11" y="36" width="9" height="17" rx="2" fill={p.mid} />
    <rect x="23.5" y="28" width="9" height="25" rx="2" fill={face(g)} />
    <rect x="36" y="19" width="9" height="34" rx="2" fill={p.light} />
    <path d="M10 24l10-6 8 4 12-11" stroke={p.light} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M40 11h6v6" stroke={p.light} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M13 40h5" stroke={sheen(g)} strokeWidth="1.6" strokeLinecap="round" />
  </>
);

const targetGlyph: Glyph = (g, p) => (
  <>
    <circle cx="32" cy="32" r="20" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <circle cx="32" cy="32" r="13" fill="#0B0B12" fillOpacity="0.5" />
    <circle cx="32" cy="32" r="6" fill={p.light} />
    <path d="M32 32 46 18M42 17h5v5" stroke={p.light} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M36 27l5-5" stroke={p.dark} strokeWidth="1.2" />
  </>
);

const satelliteGlyph: Glyph = (g, p) => (
  <>
    <path d="M14 26a20 20 0 0 1 28-6L28 34Z" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <path d="M38 22l8-8" stroke={p.mid} strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="42" cy="24" r="3" fill={p.light} />
    <path d="M44 30c3 2 4 5 4 8M48 26c4 3 6 7 6 12" stroke={p.light} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
    <path d="M16 28 28 34" stroke={sheen(g)} strokeWidth="1.8" strokeLinecap="round" />
  </>
);

const comboGlyph: Glyph = (g, p) => (
  <>
    <rect x="8" y="17" width="27" height="23" rx="4" fill={face(g)} stroke={p.dark} strokeWidth="1.2" />
    <path d="M19 23.5 29 28.5 19 33.5Z" fill={p.light} />
    <rect x="28" y="27" width="27" height="23" rx="4" fill={p.dark} stroke={p.mid} strokeWidth="1.2" />
    <path d="M34 33h14M34 39h14M34 45h9" stroke={p.light} strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
    <path d="M11 21h10" stroke={sheen(g)} strokeWidth="1.8" strokeLinecap="round" />
  </>
);

/* ------------------------------------------------------------------ */
/* Eşya kimliği -> ikon                                                */
/* ------------------------------------------------------------------ */

function glyphForItem(item: MarketItemDef): Glyph {
  switch (item.id) {
    case 'frame_silver':
      return frameGlyph('star');
    case 'frame_gold':
      return frameGlyph('reel');
    case 'frame_neon':
      return frameGlyph('play');
    case 'frame_crimson':
      return frameGlyph('drop');
    case 'frame_cosmic':
      return frameGlyph('orbit');
    case 'title_nightowl':
      return moonGlyph;
    case 'title_salon':
      return templeGlyph;
    case 'title_culture':
      return compassGlyph;
    case 'title_sovereign':
      return crownGlyph;
    case 'badge_popcorn':
      return popcornGlyph;
    case 'badge_director':
      return clapperGlyph;
    case 'badge_goldenticket':
      return ticketGlyph;
    case 'card_first_screening':
      return projectorGlyph;
    case 'card_silent_era':
      return masksGlyph;
    case 'card_new_wave':
      return waveGlyph;
    case 'card_blockbuster':
      return cometGlyph;
    case 'card_cult':
      return gemGlyph;
    case 'util_streak_shield':
      return shieldGlyph;
    case 'util_contract_reroll':
      return diceGlyph;
    case 'util_double_reward':
      return boltGlyph;
    case 'util_market_coupon':
      return couponGlyph;
    case 'util_contract_extension':
      return hourglassGlyph;
    case 'util_penalty_waiver':
      return shieldGlyph;
    case 'util_single_reroll':
      return diceGlyph;
    case 'util_selective_reroll':
      return layersGlyph;
    case 'util_contract_pin':
      return targetGlyph;
    case 'util_xp_boost':
      return boltGlyph;
    case 'util_contract_insurance':
      return archiveGlyph;
    case 'util_streak_freeze':
      return moonGlyph;
    case 'util_collectible_unlock':
      return gemGlyph;
    case 'util_discovery_ticket':
      return compassGlyph;
    case 'util_daily_ink':
      return penGlyph;
    case 'perk_showcase_slot_a':
    case 'perk_showcase_slot_b':
      return trophyGlyph;
    case 'perk_badge_slot':
      return medalGlyph;
    case 'perk_contract_slot':
      return layersGlyph;
    case 'bg_cinema_red':
      return filmReelGlyph;
    case 'bg_neon_city':
      return waveGlyph;
    case 'bg_starfield':
      return cometGlyph;
    case 'name_gold':
      return starGlyph;
    case 'name_aurora':
      return waveGlyph;
    default:
      return filmReelGlyph;
  }
}

function paletteForItem(item: MarketItemDef): Palette {
  switch (item.id) {
    case 'frame_silver':
    case 'card_silent_era':
      return PALETTES.silver;
    case 'frame_gold':
    case 'title_salon':
    case 'title_sovereign':
    case 'badge_goldenticket':
      return PALETTES.gold;
    case 'frame_neon':
    case 'card_cult':
      return PALETTES.violet;
    case 'frame_crimson':
      return PALETTES.rose;
    case 'frame_cosmic':
    case 'card_new_wave':
      return PALETTES.cyan;
    case 'title_nightowl':
      return PALETTES.amber;
    case 'title_culture':
      return PALETTES.emerald;
    case 'badge_popcorn':
      return PALETTES.ruby;
    case 'badge_director':
      return PALETTES.azure;
    case 'card_first_screening':
      return PALETTES.orange;
    case 'card_blockbuster':
      return PALETTES.orange;
    case 'util_streak_shield':
      return PALETTES.azure;
    case 'util_contract_reroll':
      return PALETTES.teal;
    case 'util_double_reward':
      return PALETTES.amber;
    case 'util_market_coupon':
      return PALETTES.emerald;
    case 'util_contract_extension':
      return PALETTES.amber;
    case 'util_penalty_waiver':
      return PALETTES.emerald;
    case 'util_single_reroll':
      return PALETTES.teal;
    case 'util_selective_reroll':
      return PALETTES.violet;
    case 'util_contract_pin':
      return PALETTES.gold;
    case 'util_xp_boost':
      return PALETTES.azure;
    case 'util_contract_insurance':
      return PALETTES.silver;
    case 'util_streak_freeze':
      return PALETTES.cyan;
    case 'util_collectible_unlock':
      return PALETTES.rose;
    case 'util_discovery_ticket':
      return PALETTES.emerald;
    case 'util_daily_ink':
      return PALETTES.teal;
    case 'perk_showcase_slot_a':
      return PALETTES.gold;
    case 'perk_showcase_slot_b':
      return PALETTES.amber;
    case 'perk_badge_slot':
      return PALETTES.gold;
    case 'perk_contract_slot':
      return PALETTES.violet;
    case 'bg_cinema_red':
      return PALETTES.ruby;
    case 'bg_neon_city':
      return PALETTES.violet;
    case 'bg_starfield':
      return PALETTES.cyan;
    case 'name_gold':
      return PALETTES.gold;
    case 'name_aurora':
      return PALETTES.teal;
    default:
      return PALETTES.slate;
  }
}

/* ------------------------------------------------------------------ */
/* Kontrat metrikleri -> ikon                                          */
/* ------------------------------------------------------------------ */

const CONTRACT_PALETTES: Record<ContractDef['rarity'], Palette> = {
  common: PALETTES.slate,
  rare: PALETTES.cyan,
  epic: PALETTES.violet,
  legendary: PALETTES.gold,
  mythic: PALETTES.rose,
};

/**
 * Her görev kimliği için ayrı bir ikon. Aynı nadirlikte iki görevin aynı
 * silueti paylaşmamasına dikkat edildi; renk zaten nadirliğe göre geliyor.
 */
const CONTRACT_GLYPHS: Record<string, Glyph> = {
  // Günlük
  d_one_movie: clapperGlyph,
  d_two_movies: popcornGlyph,
  d_one_episode: tvGlyph,
  d_two_episodes: filmStripGlyph,
  d_three_episodes: cometGlyph,
  d_one_item: ticketGlyph,
  d_two_items: ticketStackGlyph,
  d_three_items: clapperGlyph,
  d_sixty_minutes: hourglassGlyph,
  d_120_minutes: clockGlyph,
  d_two_genres: paletteGlyph,
  d_three_genres: masksGlyph,
  d_one_rating: starGlyph,
  d_two_ratings: medalGlyph,
  d_one_note: penGlyph,
  d_two_notes: documentGlyph,
  d_one_add: bookGlyph,
  d_two_adds: archiveGlyph,
  d_weekend_movie: sunGlyph,
  d_weekend_movies: popcornGlyph,
  d_weekend_episode: moonGlyph,
  d_weekend_episodes: calendarGlyph,
  d_one_series: radioGlyph,
  d_two_series: compassGlyph,
  d_one_day: calendarGlyph,
  d_two_same_day: targetGlyph,
  d_three_same_day: flameGlyph,
  d_streak_one: boltGlyph,
  d_streak_two: shieldGlyph,
  d_film_plus_episode: layersGlyph,
  d_hour_and_rate: stopwatchGlyph,
  d_triple_mix: gemGlyph,
  // Haftalık
  w_five_movies: projectorGlyph,
  w_ten_movies: filmReelGlyph,
  w_twenty_movies: templeGlyph,
  w_ten_episodes: playCircleGlyph,
  w_twentyfive_episodes: playCircleGlyph,
  w_fifty_episodes: crownGlyph,
  w_five_items: stackGlyph,
  w_fifteen_items: filmStripGlyph,
  w_thirty_items: archiveGlyph,
  w_300_minutes: stopwatchGlyph,
  w_600_minutes: hourglassGlyph,
  w_1000_minutes: clockGlyph,
  w_1500_minutes: hourglassGlyph,
  w_1000_hours: gemGlyph,
  w_five_genres: waveGlyph,
  w_eight_genres: compassGlyph,
  w_five_ratings: trophyGlyph,
  w_ten_ratings: chartGlyph,
  w_three_notes: bookGlyph,
  w_five_notes: documentGlyph,
  w_three_adds: archiveGlyph,
  w_five_adds: stackGlyph,
  w_weekend_combo: comboGlyph,
  w_weekend_big: sunGlyph,
  w_three_series: radioGlyph,
  w_five_series: satelliteGlyph,
  w_four_days: calendarGlyph,
  w_five_days: targetGlyph,
  w_streak_three: boltGlyph,
  w_streak_five: shieldGlyph,
  w_streak_seven: flameGlyph,
  w_binge_day: moonGlyph,
  w_binge_day_six: cometGlyph,
  w_film_episode_combo: comboGlyph,
  w_thousand_and_ten: crownGlyph,
};

function glyphForMetric(metric: ContractMetric): Glyph {
  switch (metric) {
    case 'movies':
    case 'weekend_movies':
      return clapperGlyph;
    case 'episodes':
    case 'weekend_episodes':
      return tvGlyph;
    case 'items':
      return ticketGlyph;
    case 'minutes':
      return hourglassGlyph;
    case 'genres':
      return paletteGlyph;
    case 'ratings':
      return starGlyph;
    case 'notes':
      return penGlyph;
    case 'adds':
      return bookGlyph;
    case 'distinct_series':
      return radioGlyph;
    case 'watch_days':
      return calendarGlyph;
    case 'max_day_items':
      return flameGlyph;
    case 'streak':
      return boltGlyph;
    default:
      return filmReelGlyph;
  }
}

/* ------------------------------------------------------------------ */
/* Dışa açılan bileşenler                                              */
/* ------------------------------------------------------------------ */

export function MarketArtwork({ item, className }: { item: MarketItemDef; className?: string }) {
  return (
    <Art3D palette={paletteForItem(item)} className={className}>
      {glyphForItem(item)}
    </Art3D>
  );
}

export function ContractArtwork({
  contract,
  className,
}: {
  contract: ContractDef;
  className?: string;
}) {
  const glyph =
    CONTRACT_GLYPHS[contract.id] ??
    (contract.rarity === 'mythic'
      ? gemGlyph
      : contract.requirements.length > 1
        ? layersGlyph
        : glyphForMetric(contract.requirements[0]?.metric || 'movies'));

  return (
    <Art3D palette={CONTRACT_PALETTES[contract.rarity]} className={className}>
      {glyph}
    </Art3D>
  );
}
