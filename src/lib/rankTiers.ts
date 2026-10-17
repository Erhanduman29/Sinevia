import React, { createElement } from 'react';

export interface RankTier {
  minLevel: number;
  maxLevel: number;
  title: string;
  subtitle: string;
  color: string;
  border: string;
  badgeBg: string;
  bgGlow: string;
  gradient: string;
  barGradient: string;
  strokeColor: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}

/* ══════════════════════════════════════════════════════════════════════════
   10 UNVAN KADEMESİ İÇİN 3 KATMANLI ÖZEL RÜTBE İLLÜSTRASYONLARI
   - `base`: Gradyan dolgulu ana rütbe sembolü gövdesi
   - `line`: İnce işçilikli metalik/vektörel konturlar
   - `core`: Parlayan odak mücevheri ve rütbe yıldızları
   ══════════════════════════════════════════════════════════════════════════ */
interface RankArtLayers {
  base: string;
  line: string;
  core: string;
}

const RANK_ILLUSTRATIONS: Record<number, RankArtLayers> = {
  // 0. Çaylak İzleyici (Sv. 1-4): Tekli Çaylak Şeridi (Chevron) + 35mm Sinema Kareleri
  0: {
    base: 'M5 5.5H19V16.5H5V5.5Z',
    line: 'M5 5.5H19V16.5H5V5.5Z M8.5 5.5V16.5 M15.5 5.5V16.5 M5 9H8.5 M5 13H8.5 M15.5 9H19 M15.5 13H19 M6.5 18.5L12 21.5L17.5 18.5',
    core: 'M10.5 9L14.5 11L10.5 13V9Z',
  },
  // 1. Film Meraklısı (Sv. 5-9): Altın Mısır Kovası + Meraklı Keşif Yıldızı
  1: {
    base: 'M5.5 10L7 20.5H17L18.5 10H5.5Z M7 10C5.5 8 7 5.5 9.5 6C10.5 3.5 13.5 3.5 14.5 6C17 5.5 18.5 8 17 10H7Z',
    line: 'M5.5 10L7 20.5H17L18.5 10H5.5Z M9.5 10L10 20.5 M14.5 10L14 20.5 M7 10C5.5 8 7 5.5 9.5 6C10.5 3.5 13.5 3.5 14.5 6C17 5.5 18.5 8 17 10',
    core: 'M12 12.5L13.3 14.8L15.8 15.2L13.9 16.9L14.4 19.3L12 18L9.6 19.3L10.1 16.9L8.2 15.2L10.7 14.8L12 12.5Z',
  },
  // 2. Düzenli Seyirci (Sv. 10-14): Panavision Sinematik Göz & Odak Diyaframı
  2: {
    base: 'M1.8 12C4.5 6.8 8 4.5 12 4.5C16 4.5 19.5 6.8 22.2 12C19.5 17.2 16 19.5 12 19.5C8 19.5 4.5 17.2 1.8 12Z',
    line: 'M1.8 12C4.5 6.8 8 4.5 12 4.5C16 4.5 19.5 6.8 22.2 12C19.5 17.2 16 19.5 12 19.5C8 19.5 4.5 17.2 1.8 12Z M12 7.8A4.2 4.2 0 1 0 12 16.2A4.2 4.2 0 1 0 12 7.8Z M5.5 21L12 19.2L18.5 21',
    core: 'M12 10A2 2 0 1 0 12 14A2 2 0 1 0 12 10Z',
  },
  // 3. Tutkulu Sinefil (Sv. 15-19): Sinema Şeridiyle Sarılmış Kristal Kalp & Alev
  3: {
    base: 'M12 5.8C9.8 3 5.5 3.2 3.5 6C1.5 8.8 2.2 13 5.5 16.2L12 21.5L18.5 16.2C21.8 13 22.5 8.8 20.5 6C18.5 3.2 14.2 3 12 5.8Z',
    line: 'M12 5.8C9.8 3 5.5 3.2 3.5 6C1.5 8.8 2.2 13 5.5 16.2L12 21.5L18.5 16.2C21.8 13 22.5 8.8 20.5 6C18.5 3.2 14.2 3 12 5.8Z M3.2 11.5H20.8',
    core: 'M12 8.5L13.5 11.2L16.5 11.7L14.2 13.8L14.8 16.8L12 15.2L9.2 16.8L9.8 13.8L7.5 11.7L10.5 11.2L12 8.5Z',
  },
  // 4. Sinema Otoritesi (Sv. 20-29): Defne Çelenkli Altın Otorite Madalyonu
  4: {
    base: 'M12 3A6.5 6.5 0 1 0 12 16A6.5 6.5 0 1 0 12 3Z',
    line: 'M12 3A6.5 6.5 0 1 0 12 16A6.5 6.5 0 1 0 12 3Z M8.2 15.2L6 21.5L12 18.8L18 21.5L15.8 15.2 M3 11C2.5 8 4 5 6.5 4 M21 11C21.5 8 20 5 17.5 4',
    core: 'M12 6.2L13.1 8.4L15.5 8.8L13.8 10.4L14.2 12.8L12 11.6L9.8 12.8L10.2 10.4L8.5 8.8L10.9 8.4L12 6.2Z',
  },
  // 5. Eleştirmenler Birliği (Sv. 30-39): Kraliyet Divit Kalem Ucu & Terazi Mührü
  5: {
    base: 'M12 2L18.5 11.2L15.5 19H8.5L5.5 11.2L12 2Z',
    line: 'M12 2L18.5 11.2L15.5 19H8.5L5.5 11.2L12 2Z M12 2V12 M7 19H17V21.5H7V19Z M4 8.5L7 10 M20 8.5L17 10',
    core: 'M12 10.8A2 2 0 1 0 12 14.8A2 2 0 1 0 12 10.8Z',
  },
  // 6. Sinevia Efsanesi (Sv. 40-49): 5 Sütunlu İmparatorluk Tacı & Efsane Mücevheri
  6: {
    base: 'M2.5 7.5L7 12.2L12 4L17 12.2L21.5 7.5L19.5 19.5H4.5L2.5 7.5Z',
    line: 'M2.5 7.5L7 12.2L12 4L17 12.2L21.5 7.5L19.5 19.5H4.5L2.5 7.5Z M4.2 16.5H19.8 M6 21.5H18',
    core: 'M12 10.2L13.8 13L12 15.8L10.2 13L12 10.2Z M7 13.2A1.1 1.1 0 1 0 7 15.4A1.1 1.1 0 1 0 7 13.2Z M17 13.2A1.1 1.1 0 1 0 17 15.4A1.1 1.1 0 1 0 17 13.2Z',
  },
  // 7. Evren Fatihi (Sv. 50-59): Çift Yörüngeli Kuantum Küresi & Fetih Tacı
  7: {
    base: 'M12 5.2A6.8 6.8 0 1 0 12 18.8A6.8 6.8 0 1 0 12 5.2Z',
    line: 'M12 5.2A6.8 6.8 0 1 0 12 18.8A6.8 6.8 0 1 0 12 5.2Z M2 12C5 7.2 19 7.2 22 12C19 16.8 5 16.8 2 12Z M12 2C16.8 5 16.8 19 12 22C7.2 19 7.2 5 12 2Z',
    core: 'M12 9L14.8 12L12 15L9.2 12L12 9Z',
  },
  // 8. Kozmik Yönetmen (Sv. 60-74): 8 Köşeli Kuasar Yıldızı & Kozmik Vizör
  8: {
    base: 'M12 1.5L14.8 9.2L22.5 12L14.8 14.8L12 22.5L9.2 14.8L1.5 12L9.2 9.2L12 1.5Z',
    line: 'M12 1.5L14.8 9.2L22.5 12L14.8 14.8L12 22.5L9.2 14.8L1.5 12L9.2 9.2L12 1.5Z M4.5 4.5L19.5 19.5 M19.5 4.5L4.5 19.5',
    core: 'M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z',
  },
  // 9. Sinema Tanrısı (Sv. 75-999): Kanatlı Kutsal Prizma Elması & İlahi Göz
  9: {
    base: 'M6 3H18L22 9.5L12 22L2 9.5L6 3Z',
    line: 'M6 3H18L22 9.5L12 22L2 9.5L6 3Z M2 9.5H22 M6 3L9 9.5L12 22 M18 3L15 9.5L12 22 M9 9.5L12 3L15 9.5',
    core: 'M12 6.5L14.5 9.5L12 16.5L9.5 9.5L12 6.5Z',
  },
};

interface RankPalette {
  shellOuter: string;
  shellInner: string;
  rimLight: string;
  rimDark: string;
  glow: string;
  artFillStart: string;
  artFillEnd: string;
  artStroke: string;
  artCore: string;
}

const RANK_PALETTES: Record<number, RankPalette> = {
  // 0. Çaylak İzleyici (Slate / Çelik)
  0: {
    shellOuter: '#334155',
    shellInner: '#0f172a',
    rimLight: '#cbd5e1',
    rimDark: '#475569',
    glow: 'rgba(148,163,184,0.45)',
    artFillStart: '#94a3b8',
    artFillEnd: '#334155',
    artStroke: '#f8fafc',
    artCore: '#38bdf8',
  },
  // 1. Film Meraklısı (Sky / Safir)
  1: {
    shellOuter: '#0369a1',
    shellInner: '#082f49',
    rimLight: '#7dd3fc',
    rimDark: '#0284c7',
    glow: 'rgba(56,189,248,0.6)',
    artFillStart: '#38bdf8',
    artFillEnd: '#0369a1',
    artStroke: '#f0f9ff',
    artCore: '#fde047',
  },
  // 2. Düzenli Seyirci (Emerald / Zümrüt)
  2: {
    shellOuter: '#047857',
    shellInner: '#022c22',
    rimLight: '#6ee7b7',
    rimDark: '#059669',
    glow: 'rgba(52,211,153,0.6)',
    artFillStart: '#34d399',
    artFillEnd: '#065f46',
    artStroke: '#ecfdf5',
    artCore: '#fef08a',
  },
  // 3. Tutkulu Sinefil (Violet / Ametist)
  3: {
    shellOuter: '#5b21b6',
    shellInner: '#1e1b4b',
    rimLight: '#ddd6fe',
    rimDark: '#7c3aed',
    glow: 'rgba(167,139,250,0.65)',
    artFillStart: '#c084fc',
    artFillEnd: '#4c1d95',
    artStroke: '#f5f3ff',
    artCore: '#f43f5e',
  },
  // 4. Sinema Otoritesi (Gold / Kraliyet Altını)
  4: {
    shellOuter: '#92400e',
    shellInner: '#271203',
    rimLight: '#fef08a',
    rimDark: '#d97706',
    glow: 'rgba(245,158,11,0.75)',
    artFillStart: '#fbbf24',
    artFillEnd: '#78350f',
    artStroke: '#fffbeb',
    artCore: '#ffffff',
  },
  // 5. Eleştirmenler Birliği (Rose / Kızıl Yakut)
  5: {
    shellOuter: '#9f1239',
    shellInner: '#280510',
    rimLight: '#fecdd3',
    rimDark: '#e11d48',
    glow: 'rgba(251,113,133,0.8)',
    artFillStart: '#fb7185',
    artFillEnd: '#881337',
    artStroke: '#fff1f2',
    artCore: '#fde047',
  },
  // 6. Sinevia Efsanesi (Cyan / Platin Turkuaz)
  6: {
    shellOuter: '#0e7490',
    shellInner: '#041e27',
    rimLight: '#a5f3fc',
    rimDark: '#06b6d4',
    glow: 'rgba(34,211,238,0.85)',
    artFillStart: '#22d3ee',
    artFillEnd: '#155e75',
    artStroke: '#ecfeff',
    artCore: '#fde047',
  },
  // 7. Evren Fatihi (Fuchsia / Nebula Pembe-Mor)
  7: {
    shellOuter: '#86198f',
    shellInner: '#260529',
    rimLight: '#f5d0fe',
    rimDark: '#d946ef',
    glow: 'rgba(240,171,252,0.85)',
    artFillStart: '#e879f9',
    artFillEnd: '#701a75',
    artStroke: '#fdf4ff',
    artCore: '#38bdf8',
  },
  // 8. Kozmik Yönetmen (Indigo / Yıldızlararası Çivit)
  8: {
    shellOuter: '#3730a3',
    shellInner: '#0f0c29',
    rimLight: '#e0e7ff',
    rimDark: '#6366f1',
    glow: 'rgba(129,140,248,0.9)',
    artFillStart: '#818cf8',
    artFillEnd: '#312e81',
    artStroke: '#eef2ff',
    artCore: '#fde047',
  },
  // 9. Sinema Tanrısı (Celestial White / İlahi Elmas)
  9: {
    shellOuter: '#52525b',
    shellInner: '#09090b',
    rimLight: '#ffffff',
    rimDark: '#a1a1aa',
    glow: 'rgba(255,255,255,0.95)',
    artFillStart: '#ffffff',
    artFillEnd: '#71717a',
    artStroke: '#ffffff',
    artCore: '#e8384f',
  },
};

/**
 * 3 Katmanlı Özel Rütbe Arması Bileşeni (`RankEmblem`)
 * Rütbe kademesine (0..9) göre evrimleşen zırhlı kalkan, imparatorluk kanatları
 * ve 3 katmanlı özel vektörel sembol üretir.
 */
export function RankEmblem({
  rankIndex,
  size = 28,
  className = '',
}: {
  rankIndex: number;
  size?: number | string;
  className?: string;
}) {
  const idx = Math.max(0, Math.min(9, rankIndex));
  const art = RANK_ILLUSTRATIONS[idx] || RANK_ILLUSTRATIONS[0];
  const pal = RANK_PALETTES[idx] || RANK_PALETTES[0];
  const uid = `sinevia-rank-emblem-${idx}`;

  const numericSize = typeof size === 'number' ? size : parseInt(String(size), 10) || 28;
  const isMidOrHigh = idx >= 3;
  const isHigh = idx >= 6;
  const isGod = idx === 9;

  return createElement(
    'span',
    {
      className: `relative inline-flex items-center justify-center select-none shrink-0 group/rank ${className}`,
      style: {
        width: size ? numericSize : undefined,
        height: size ? numericSize : undefined,
        filter: `drop-shadow(0 4px 10px ${pal.glow})`,
      },
      'aria-hidden': true,
    },
    createElement(
      'svg',
      {
        viewBox: '0 0 64 64',
        className: 'w-full h-full overflow-visible transition-transform duration-300 group-hover/rank:scale-110',
      },
      // 1. TANIMLAR: Metalik/Kozmik Gradyanlar
      createElement(
        'defs',
        null,
        createElement(
          'radialGradient',
          { id: `${uid}-bg`, cx: '35%', cy: '25%', r: '75%' },
          createElement('stop', { offset: '0%', stopColor: pal.shellOuter }),
          createElement('stop', { offset: '100%', stopColor: pal.shellInner })
        ),
        createElement(
          'linearGradient',
          { id: `${uid}-rim`, x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
          createElement('stop', { offset: '0%', stopColor: pal.rimLight }),
          createElement('stop', { offset: '55%', stopColor: pal.rimDark }),
          createElement('stop', { offset: '100%', stopColor: pal.shellInner })
        ),
        createElement(
          'linearGradient',
          { id: `${uid}-fill`, x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
          createElement('stop', { offset: '0%', stopColor: pal.artFillStart, stopOpacity: '0.65' }),
          createElement('stop', { offset: '100%', stopColor: pal.artFillEnd, stopOpacity: '0.25' })
        )
      ),
      // YÜKSEK RÜTBELER İÇİN YAN İMPARATORLUK KANATLARI (Sv. 40+ / idx >= 6)
      isHigh &&
        createElement('path', {
          d: 'M4 22L0 14L8 17L4 22Z M4 32L-1 26L7 27L4 32Z M60 22L64 14L56 17L60 22Z M60 32L65 26L57 27L60 32Z',
          fill: pal.rimLight,
          fillOpacity: '0.85',
        }),
      // 2. ANA RÜTBE KALKANI / SEKİZGEN ZIRH
      createElement('polygon', {
        points: isHigh
          ? '18,3 46,3 61,18 61,44 32,62 3,44 3,18'
          : '20,4 44,4 60,20 60,44 44,60 20,60 4,44 4,20',
        fill: `url(#${uid}-bg)`,
        stroke: `url(#${uid}-rim)`,
        strokeWidth: isGod ? '3' : isHigh ? '2.5' : '2',
      }),
      // İç Zırh Çizgisi
      createElement('polygon', {
        points: isHigh
          ? '20,7 44,7 57,20 57,42 32,57 7,42 7,20'
          : '22,8 42,8 56,22 56,42 42,56 22,56 8,42 8,22',
        fill: 'none',
        stroke: pal.rimLight,
        strokeOpacity: '0.24',
        strokeWidth: '1',
      }),
      // Taktiksel Yörünge Halkası
      createElement('circle', {
        cx: '32',
        cy: '32',
        r: '20',
        fill: 'none',
        stroke: pal.rimLight,
        strokeOpacity: isGod ? '0.45' : '0.25',
        strokeWidth: '1',
        strokeDasharray: idx < 3 ? '3 3' : '7 3',
      }),
      // Üst ve Alt Prestij Tacı Mücevherleri
      isMidOrHigh &&
        createElement('polygon', {
          points: '32,0 36.5,5.5 32,9.5 27.5,5.5',
          fill: pal.rimLight,
        }),
      isHigh &&
        createElement('polygon', {
          points: '32,64 36.5,58.5 32,54.5 27.5,58.5',
          fill: pal.artCore,
        }),
      // 3. 3 KATMANLI ÖZEL UNVAN İLLÜSTRASYONU
      createElement(
        'g',
        { transform: 'translate(12, 12) scale(1.6667)' },
        // Katman A: Hacimli Gradyan Gövde (`base`)
        art.base &&
          createElement('path', {
            d: art.base,
            fill: `url(#${uid}-fill)`,
          }),
        // Katman B: Keskin Vektör Çizgileri (`line`)
        createElement('path', {
          d: art.line,
          fill: 'none',
          stroke: pal.artStroke,
          strokeWidth: '1.7',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
        // Katman C: Parlak Odak & Enerji Çekirdeği (`core`)
        art.core &&
          createElement('path', {
            d: art.core,
            fill: pal.artCore,
            stroke: pal.artCore,
            strokeWidth: '0.85',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          })
      )
    )
  );
}

function createRankIcon(rankIndex: number): React.ComponentType<{ size?: number | string; className?: string }> {
  const Comp = ({ size = 28, className = '' }: { size?: number | string; className?: string }) =>
    createElement(RankEmblem, { rankIndex, size, className });
  Comp.displayName = `RankEmblem_${rankIndex}`;
  return Comp;
}

export const RANK_TIERS: RankTier[] = [
  {
    minLevel: 1, maxLevel: 4, title: 'Çaylak İzleyici', subtitle: 'Sinema yolculuğunun ilk adımları',
    color: 'text-slate-300', border: 'border-slate-500/40', badgeBg: 'bg-slate-500/15', bgGlow: 'bg-slate-500/15',
    gradient: 'from-slate-500 via-slate-400 to-zinc-300', barGradient: 'from-slate-600 via-slate-400 to-white',
    strokeColor: '#94a3b8', icon: createRankIcon(0),
  },
  {
    minLevel: 5, maxLevel: 9, title: 'Film Meraklısı', subtitle: 'Kült yapımların ve seçkin hikayelerin kaşifi',
    color: 'text-sky-400', border: 'border-sky-500/40', badgeBg: 'bg-sky-500/15', bgGlow: 'bg-sky-500/20',
    gradient: 'from-blue-600 via-sky-500 to-cyan-300', barGradient: 'from-blue-700 via-sky-500 to-cyan-300',
    strokeColor: '#38bdf8', icon: createRankIcon(1),
  },
  {
    minLevel: 10, maxLevel: 14, title: 'Düzenli Seyirci', subtitle: 'Sinema artık hayatının ayrılmaz bir parçası',
    color: 'text-emerald-400', border: 'border-emerald-500/40', badgeBg: 'bg-emerald-500/15', bgGlow: 'bg-emerald-500/20',
    gradient: 'from-emerald-600 via-green-500 to-teal-300', barGradient: 'from-emerald-700 via-green-500 to-teal-300',
    strokeColor: '#34d399', icon: createRankIcon(2),
  },
  {
    minLevel: 15, maxLevel: 19, title: 'Tutkulu Sinefil', subtitle: 'Yönetmen imzalarını ve alt metinleri okuyan göz',
    color: 'text-violet-400', border: 'border-violet-500/40', badgeBg: 'bg-violet-500/15', bgGlow: 'bg-violet-500/20',
    gradient: 'from-violet-600 via-purple-500 to-fuchsia-400', barGradient: 'from-violet-700 via-purple-500 to-fuchsia-300',
    strokeColor: '#a78bfa', icon: createRankIcon(3),
  },
  {
    minLevel: 20, maxLevel: 29, title: 'Sinema Otoritesi', subtitle: 'Eleştirileri ve arşiviyle referans noktası',
    color: 'text-gold-400', border: 'border-gold-500/50', badgeBg: 'bg-gold-500/15', bgGlow: 'bg-gold-500/25',
    gradient: 'from-amber-600 via-gold-500 to-yellow-300', barGradient: 'from-amber-600 via-gold-500 to-yellow-200',
    strokeColor: '#f59e0b', icon: createRankIcon(4),
  },
  {
    minLevel: 30, maxLevel: 39, title: 'Eleştirmenler Birliği', subtitle: 'Puanları kanun sayılan acımasız vizyoner',
    color: 'text-rose-400', border: 'border-rose-500/50', badgeBg: 'bg-rose-500/15', bgGlow: 'bg-rose-500/30',
    gradient: 'from-red-600 via-rose-500 to-pink-400', barGradient: 'from-red-700 via-rose-500 to-pink-400',
    strokeColor: '#fb7185', icon: createRankIcon(5),
  },
  {
    minLevel: 40, maxLevel: 49, title: 'Sinevia Efsanesi', subtitle: 'Yedinci sanatın zirvesine ulaşmış saygın usta',
    color: 'text-cyan-300', border: 'border-cyan-400/50', badgeBg: 'bg-cyan-500/15', bgGlow: 'bg-cyan-500/25',
    gradient: 'from-cyan-500 via-teal-400 to-emerald-300', barGradient: 'from-cyan-600 via-teal-400 to-emerald-200',
    strokeColor: '#22d3ee', icon: createRankIcon(6),
  },
  {
    minLevel: 50, maxLevel: 59, title: 'Evren Fatihi', subtitle: 'Tüm kurgusal evrenlere hükmeden mitik koleksiyoner',
    color: 'text-fuchsia-300', border: 'border-fuchsia-400/60', badgeBg: 'bg-fuchsia-500/20', bgGlow: 'bg-fuchsia-500/35',
    gradient: 'from-fuchsia-600 via-pink-500 to-purple-400', barGradient: 'from-fuchsia-700 via-pink-500 to-purple-300',
    strokeColor: '#f0abfc', icon: createRankIcon(7),
  },
  {
    minLevel: 60, maxLevel: 74, title: 'Kozmik Yönetmen', subtitle: 'Sinema tarihini yeniden yazan yıldızlarüstü irade',
    color: 'text-indigo-300', border: 'border-indigo-400/60', badgeBg: 'bg-indigo-500/20', bgGlow: 'bg-indigo-500/40',
    gradient: 'from-indigo-600 via-blue-500 to-violet-400', barGradient: 'from-indigo-700 via-blue-500 to-violet-300',
    strokeColor: '#818cf8', icon: createRankIcon(8),
  },
  {
    minLevel: 75, maxLevel: 999, title: 'Sinema Tanrısı', subtitle: 'Ölümsüzlüğe ulaşmış, evrenin nihai ekran yüzü',
    color: 'text-zinc-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]', border: 'border-zinc-200/70', badgeBg: 'bg-zinc-100/20', bgGlow: 'bg-zinc-300/40',
    gradient: 'from-zinc-400 via-zinc-100 to-white', barGradient: 'from-zinc-500 via-zinc-200 to-white',
    strokeColor: '#ffffff', icon: createRankIcon(9),
  },
];