import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ACHIEVEMENT_DEFS, TIER_ORDER, AchievementIcon } from '../lib/achievements';
import type { AchievementDef, AchievementTierDef } from '../lib/achievements';
import { levelFromXp } from '../lib/xp';
import { TIER_COIN_REWARDS } from '../lib/coins';
import { SineCoinIcon } from '../components/CoinPill';
import { RANK_TIERS } from '../lib/rankTiers';
import QuestBoard from '../components/QuestBoard';
import TitleGallery from '../components/TitleGallery';
import XpLedgerTab from '../components/XpLedgerTab';
import type { XpEvent } from '../types/appState';

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

/** Detay penceresinde gösterilen, birleştirilmiş başarım kaydı */
interface AchievementDisplayItem {
  id: string;
  def: AchievementDef;
  tier: AchievementTierDef;
  isUnlocked: boolean;
  unlockedAt: string | null;
  current: number;
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
/* Mobil XP rozeti: Tailwind sm:hidden yerine bu sınıf kullanılır.
   Bu dosyadaki <style> bloğu Tailwind stil sayfasından SONRA geldiği için
   .achv-xp-pill'in display:inline-flex kuralı sm:hidden'ı eziyor ve masaüstünde
   aynı XP rozeti iki kez görünüyordu. */
.achv-xp-pill-sm{
  display:none;
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
.achv-coin-chip{
  display:inline-flex;
  align-items:center;
  gap:4px;
  padding:2.5px 8px;
  border-radius:999px;
  font-family:'JetBrains Mono',monospace;
  font-size:10px;
  font-weight:900;
  color:#FDE68A;
  background:linear-gradient(135deg, rgba(245,158,11,.18), rgba(120,53,15,.28));
  border:1px solid rgba(245,158,11,.38);
  box-shadow:inset 0 1px 1px rgba(255,255,255,.12);
  flex-shrink:0;
}
.achv-card{height:100%;min-height:200px;}

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

/* ---------- MOBİL: tek sütun, yüksek yoğunluklu başarım satırları ---------- */
@media (max-width: 767px){
  .achv-card{
    min-height:0;
    contain-intrinsic-size:auto 44px;
    border-left-width:3px;
    border-radius:10px;
  }
  .achv-medal-wrap{
    width:30px;
    height:30px;
  }
  /* AchievementIcon inline width/height veriyor → !important gerekli */
  .achv-emblem-stage{
    width:28px !important;
    height:28px !important;
  }
  .achv-status-pip{
    width:12px;
    height:12px;
    bottom:-2px;
    right:-2px;
    border-radius:4px;
    border-width:1px;
  }
  .achv-status-pip svg{ width:7px; height:7px; }
  .achv-tier-tag{
    gap:4px;
    padding:1.5px 5px;
    border-radius:5px;
    font-size:7.5px;
    letter-spacing:.08em;
  }
  .achv-tier-dot{ width:4px; height:4px; }
  .achv-xp-pill{
    gap:2px;
    padding:1.5px 5px;
    border-radius:5px;
    font-size:8px;
  }
  /* Mobilde XP rozeti başlık yanında görünür (masaüstünde alt barın sağ altında) */
  .achv-xp-pill-sm{
    display:inline-flex;
    gap:2px;
    padding:1.5px 5px;
    border-radius:5px;
    font-size:8px;
  }
  .achv-coin-chip{
    display:none;
  }
  .achv-track{ height:4px; }
  /* Mobilde emniyet: kart içi boşluklar taşmasın */
  .achv-card > div{ min-width:0; }

  /* Mobil: kademe filtresi chip'leri minimize */
  .achv-tier-chip{
    padding:2px 6px;
    font-size:9px;
    gap:4px;
    border-radius:6px;
    letter-spacing:.06em;
  }
  .achv-tier-chip-dot{ width:5px; height:5px; }
  .achv-tier-chip-count{ font-size:8px; padding:0 3px; border-radius:4px; }

  /* Mobil: kupa kartına tıklama ipucu */
  .achv-card{ cursor:pointer; }

  /* Görev Panosu: mobilde dev arma ikonları küçültülür */
  .qb-art-offer{ width:52px !important; height:52px !important; }
  .qb-art-active{ width:48px !important; height:48px !important; }
  .qb-art-badge{ width:34px !important; height:34px !important; }
}

/* ---------- MODAL: BAŞARIM DETAY PENCERESİ ---------- */
.achv-modal-card{
  position:relative;
  overflow:hidden;
  background:#0F0F16;
  border:1px solid #232332;
  border-left:4px solid var(--tier-solid);
  border-radius:18px;
  display:flex;
  flex-direction:column;
}
.achv-modal-medal-wrap{
  position:relative;
  width:86px;
  height:86px;
  flex-shrink:0;
  display:flex;
  align-items:center;
  justify-content:center;
}
.achv-modal-emblem-stage{
  transition:transform .25s ease, opacity .25s ease, filter .25s ease;
}
.achv-modal-card.is-locked .achv-modal-emblem-stage{
  opacity:.7;
  filter:saturate(.65);
}
.achv-modal-track{
  position:relative;
  overflow:hidden;
  height:9px;
  background:#191924;
  border-radius:99px;
}
.achv-modal-fill{
  position:absolute;
  top:0; bottom:0; left:0;
  border-radius:99px;
  background:var(--tier-bar-gradient);
  transition:width .6s ease;
}
/* Modal içi ölçüler masaüstü kartıyla aynı kalsın (mobil media query muaf) */
.achv-modal-card .achv-tier-tag{
  gap:5px;
  padding:3.5px 10px;
  border-radius:7px;
  font-size:10.5px;
  letter-spacing:.12em;
}
.achv-modal-card .achv-tier-dot{ width:6px; height:6px; }
.achv-modal-card .achv-xp-pill{
  gap:4px;
  padding:3.5px 10px;
  border-radius:7px;
  font-size:11px;
}
.achv-modal-card .achv-coin-chip{
  display:inline-flex;
  gap:4px;
  padding:2.5px 8px;
  font-size:10px;
}
.achv-modal-card .achv-status-pip{
  width:20px;
  height:20px;
  bottom:-2px;
  right:-2px;
  border-radius:6px;
  border-width:1.5px;
}
.achv-modal-card .achv-status-pip svg{ width:12px; height:12px; }
`;

type SortMode = 'newest' | 'oldest' | 'az' | 'za';
type FilterMode = 'all' | 'unlocked' | 'locked';
type ViewTab = 'trophies' | 'quests' | 'titles' | 'xp';

/** Kazanım tarihini tam biçimde gösterir: gün + ay + yıl + saat + dakika */
function formatDateTime(dateString: string) {
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
}

/** Dar mobil alan için kısa tarih: gün + ay + saat + dakika */
function formatDateTimeShort(dateString: string) {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  } catch {
    return '';
  }
}

const MOBILE_SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'newest', label: 'Yeni' },
  { id: 'oldest', label: 'Eski' },
  { id: 'az', label: 'A-Z' },
];

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

/**
 * BAŞARIM DETAY PENCERESİ (MODAL)
 * Mobilde küçültülmüş başarım kartına tıklandığında, masaüstü sürümdeki
 * kart tasarımının TAM HALİ (kademe, kategori, XP, SC, açıklama, ilerleme
 * çubuğu ve tarih/saat bilgisi) pencerede açılır.
 */
function AchievementDetailModal({
  ach,
  showLockedNames,
  onClose,
}: {
  ach: AchievementDisplayItem;
  showLockedNames: boolean;
  onClose: () => void;
}) {
  const tierKey = String(ach.tier.tier);
  const vis = TIER_VISUALS[tierKey] || TIER_VISUALS.bronze;
  const isLocked = !ach.isUnlocked;
  const isSecret = !!ach.def.secret;
  const isTestMode = !!showLockedNames;

  const displayName = isLocked && !isTestMode ? '???' : ach.tier.name || ach.def.name;
  const parsedDesc = String(ach.def.description || '').replace(
    '{threshold}',
    String(ach.tier.threshold)
  );

  const current = Math.min(Number(ach.current || 0), Number(ach.tier.threshold));
  const target = Number(ach.tier.threshold);
  const percentage = Math.min(100, Math.floor((current / Math.max(1, target)) * 100));

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/90 backdrop-blur-xl p-3 sm:p-6 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Başarım detayı"
    >
      <div
        className="relative w-full max-w-md sm:max-w-lg max-h-[88svh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          title="Kapat"
          aria-label="Kapat"
          className="absolute -top-1 -right-1 sm:top-3 sm:right-3 z-20 w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/15 flex items-center justify-center transition-colors"
        >
          <Icons.X size={16} />
        </button>

        <div
          className={`achv-modal-card ${isLocked ? 'is-locked' : 'is-open'}`}
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
          <div className="p-5 sm:p-6 space-y-4">
            {/* ÜST: Büyük arma + rozetler */}
            <div className="flex items-start gap-4">
              <div className="achv-modal-medal-wrap">
                <AchievementIcon
                  achievementId={ach.def.id}
                  tier={tierKey}
                  size={70}
                  className="achv-modal-emblem-stage"
                />
                {isLocked ? (
                  <span className="achv-status-pip locked" title="Kilitli">
                    <Icons.Lock size={12} />
                  </span>
                ) : (
                  <span className="achv-status-pip unlocked" title="Kazanıldı">
                    <Icons.Check size={13} strokeWidth={3} />
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="achv-tier-tag">
                    <span className="achv-tier-dot" />
                    {vis.label}
                  </span>

                  {ach.def.category && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 bg-[#181824] border border-[#2B2B3D] px-2 py-0.5 rounded">
                      {ach.def.category}
                    </span>
                  )}

                  {isSecret && isTestMode && (
                    <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-[#2C0B16] text-rose-300 border-rose-700">
                      Gizli
                    </span>
                  )}
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight mt-2">
                  {displayName}
                </h3>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="achv-xp-pill">+{ach.tier.xp} XP</span>
                  <span className="achv-coin-chip" title="Kazanılan SineCoin">
                    <SineCoinIcon className="h-3.5 w-3.5" />
                    +{TIER_COIN_REWARDS[ach.tier.tier] || 0} SC
                  </span>
                </div>
              </div>
            </div>

            {/* AÇIKLAMA */}
            <p className="text-sm leading-relaxed text-zinc-300 border-t border-[#1E1E2A] pt-3">
              {isLocked && !isTestMode
                ? 'Bu kupanın sırrını çözmek için keşfetmeye devam et.'
                : parsedDesc}
            </p>

            {/* ALT: İlerleme çubuğu veya kazanılma tarihi */}
            {isLocked ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-zinc-400 font-mono">
                    İlerleme: <strong className="text-white">{current}</strong> / {target}
                  </span>
                  <span className="font-mono font-black text-xs" style={{ color: vis.solid }}>
                    %{percentage}
                  </span>
                </div>
                <div className="achv-modal-track">
                  <div className="achv-modal-fill" style={{ width: `${percentage}%` }} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-500">
                  {target} hedefine ulaşıldığında kupa açılacak
                </p>
              </div>
            ) : (
              <div className="pt-3 border-t border-[#1E1E2A] flex items-center justify-between gap-2 text-xs">
                <span
                  className="font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-[11px] whitespace-nowrap"
                  style={{ color: vis.solid }}
                >
                  <Icons.CheckCircle2 size={13} className="shrink-0" /> Kupa Açıldı
                </span>
                {ach.unlockedAt && (
                  <span className="text-[11px] font-mono font-semibold text-zinc-400 whitespace-nowrap">
                    {formatDateTime(ach.unlockedAt)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AchievementsPage() {
  const { data } = useApp();
  const [activeTab, setActiveTab] = useState<ViewTab>('trophies');
  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  // Detay penceresi (modal) — seçili başarım
  const [selectedAch, setSelectedAch] = useState<AchievementDisplayItem | null>(null);

  // MODAL: Escape ile kapatma + arka plan kaydırmasını kilitle
  useEffect(() => {
    if (!selectedAch) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedAch(null);
    };
    window.addEventListener('keydown', handleKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedAch]);

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
        else if (action === 'xp') setActiveTab('xp');
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

  const displayAchievements: AchievementDisplayItem[] = [];
  const tierStats: Record<string, { total: number; unlocked: number }> = {};

  TIER_ORDER.forEach((t: string) => {
    tierStats[t] = { total: 0, unlocked: 0 };
  });

  ACHIEVEMENT_DEFS.forEach((def) => {
    const prog = progressMap.get(def.id);
    const unlockedTiers = prog?.unlockedTiers || [];

    def.tiers.forEach((tier) => {
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
      const dA = new Date(a.unlockedAt || 0).getTime();
      const dB = new Date(b.unlockedAt || 0).getTime();
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <h1 className="text-base sm:text-3xl font-black uppercase tracking-tight text-ink-100 flex items-center gap-2">
          <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#FFC800] text-[#09090D] flex items-center justify-center shrink-0">
            <Icons.Trophy size={16} />
          </div>
          <span>Ödüller &amp; Kariyer</span>
        </h1>

        <div
          data-tutorial="ach-tabs"
          className="grid grid-cols-4 sm:flex p-0.5 sm:p-1 rounded-lg sm:rounded-xl w-full sm:w-auto bg-[#0D0D12] border border-[#22222C]"
        >
          <button
            onClick={() => setActiveTab('trophies')}
            className={`sm:w-32 flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 sm:py-2.5 rounded-md sm:rounded-lg text-[9px] sm:text-xs font-black whitespace-nowrap transition-all ${
              activeTab === 'trophies'
                ? 'bg-[#FFC800] text-[#09090D]'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <Icons.Medal size={14} className="hidden sm:block" /> KUPA KASASI
          </button>
          <button
            onClick={() => setActiveTab('quests')}
            className={`sm:w-32 flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 sm:py-2.5 rounded-md sm:rounded-lg text-[9px] sm:text-xs font-black whitespace-nowrap transition-all ${
              activeTab === 'quests'
                ? 'bg-violet-600 text-white'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <Icons.Target size={14} className="hidden sm:block" /> GÖREV PANOSU
          </button>
          <button
            onClick={() => setActiveTab('titles')}
            className={`sm:w-32 flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 sm:py-2.5 rounded-md sm:rounded-lg text-[9px] sm:text-xs font-black whitespace-nowrap transition-all ${
              activeTab === 'titles'
                ? 'bg-rose-600 text-white'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <Icons.Crown size={14} className="hidden sm:block" /> SOY KÜTÜĞÜ
          </button>
          <button
            onClick={() => setActiveTab('xp')}
            className={`sm:w-32 flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 sm:py-2.5 rounded-md sm:rounded-lg text-[9px] sm:text-xs font-black whitespace-nowrap transition-all ${
              activeTab === 'xp'
                ? 'bg-emerald-600 text-white'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <Icons.ScrollText size={14} className="hidden sm:block" /> XP DEFTERİ
          </button>
        </div>
      </div>

      {/* SOY KÜTÜĞÜ (UNVANLAR) SEKME İÇERİĞİ */}
      {activeTab === 'titles' && <TitleGallery />}

      {/* GÖREV PANOSU SEKME İÇERİĞİ */}
      {activeTab === 'quests' && <QuestBoard />}

      {/* XP DEFTERİ SEKME İÇERİĞİ — veri AppContext'ten; bileşen saf/prop tabanlı */}
      {activeTab === 'xp' && (
        <XpLedgerTab
          events={(data as unknown as { xpEvents?: XpEvent[] }).xpEvents ?? []}
          totalXp={Number(data.totalXp || 0)}
          level={Number(data.level || 1)}
        />
      )}

      {/* KUPA KASASI SEKME İÇERİĞİ */}
      {activeTab === 'trophies' && (
        <div className="space-y-2 sm:space-y-6 animate-fade-in-up">
          {/* MOBİL: Seviye / XP / Kupa özeti — okunaklı ve büyütülmüş panel */}
          <div className="sm:hidden rounded-2xl border border-[#22222C] bg-[#0D0D12] p-3 shadow-xl space-y-2.5">
            {/* Üst satır: Rütbe arması + Seviye + XP */}
            <div className="flex items-center gap-2.5">
              <div
                className={`relative w-14 h-14 rounded-xl grid place-items-center shrink-0 border ${userPersona.border} ${userPersona.bgGlow}`}
              >
                <PersonaIcon className={userPersona.color} size={34} />
              </div>

              <div className="min-w-0 flex-1">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-widest border ${userPersona.badgeBg} ${userPersona.color} ${userPersona.border}`}
                >
                  <Icons.Sparkles size={9} /> {userPersona.title}
                </span>
                <div className="text-2xl font-black text-white tracking-tight leading-none mt-1">
                  Seviye {lvl.level}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[8.5px] font-black uppercase tracking-widest text-ink-400">Toplam XP</div>
                <div className="text-lg font-black text-white font-mono leading-none mt-0.5">
                  {animatedTotalXp.toLocaleString('tr-TR')}
                </div>
                <div className="text-[9px] font-bold text-ink-500 font-mono mt-0.5">%{Math.floor(lvl.progress)}</div>
              </div>
            </div>

            {/* XP ilerleme çubuğu */}
            <div>
              <div className="h-2 w-full bg-[#09090D] rounded-full overflow-hidden border border-[#22222E]">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${userPersona.barGradient} transition-all duration-1000`}
                  style={{ width: `${Math.max(3, lvl.progress)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[9.5px] font-bold text-ink-400 mt-1 gap-2">
                <span className="truncate">Sv. {lvl.level + 1} hedefi</span>
                <span className="shrink-0">
                  {Math.max(0, lvl.nextLevelXp - lvl.currentLevelXp).toLocaleString('tr-TR')} XP kaldı
                </span>
              </div>
            </div>

            {/* Kupa Kasası özeti */}
            <div className="rounded-xl border border-[#3A3012] bg-[#12121A] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#FFD026] flex items-center gap-1">
                  <Icons.Trophy size={11} /> Kupalar
                </span>
                <span className="text-sm font-black text-white font-mono leading-none">
                  {unlockedTiersCount}
                  <span className="text-[10px] text-ink-400">/{totalPossibleTiers}</span>
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black font-mono bg-[#2B2205] border border-[#9A7B1C] text-[#FFE047] shrink-0">
                  %{trophyCompletionPct}
                </span>
              </div>

              <div className="h-1.5 w-full bg-[#09090D] rounded-full overflow-hidden border border-[#22222E] mt-1.5">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(2, trophyCompletionPct)}%`,
                    background: 'linear-gradient(90deg, #EAB308 0%, #FFC800 50%, #FFF066 100%)',
                  }}
                />
              </div>

              {closestTrophy !== null ? (
                <div className="flex items-center justify-between text-[9.5px] mt-1.5 gap-2">
                  <span className="text-ink-400 truncate">
                    Sıradaki: <strong className="text-white">{closestTrophy.name}</strong>
                  </span>
                  <span className="font-mono font-black text-[#FFD026] shrink-0">
                    {closestTrophy.current}/{closestTrophy.target} (%{closestTrophy.pct})
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[9.5px] mt-1.5 text-ink-400">
                  <span>
                    Açık: <strong className="text-[#00E676]">{unlockedTiersCount}</strong>
                  </span>
                  <span>
                    Kilitli: <strong className="text-ink-200">{lockedTiersCount}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* SEVİYE, XP & GELİŞTİRİLMİŞ KUPA KASASI */}
          <div className="hidden sm:block bg-[#0D0D12] border border-[#22222C] rounded-2xl p-4 sm:p-6 shadow-2xl">
            <div className="flex flex-col xl:flex-row items-stretch gap-4 sm:gap-6">
              {/* Sol: Avatar + Rütbe */}
              <div className="flex items-center gap-4 sm:gap-5 flex-shrink-0 min-w-0">
                <div className="flex flex-col items-center flex-shrink-0 gap-1">
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

                    <div className="absolute inset-2.5 sm:inset-3.5 rounded-full bg-[#14141D] border border-[#282836] flex items-center justify-center">
                      <PersonaIcon className={userPersona.color} size={44} />
                    </div>
                  </div>
                  {/* Yüzde göstergesi ikonun altına alındı — ikon çerçevede daha büyük durur. */}
                  <span className="text-[9px] sm:text-[10px] font-black text-ink-400 uppercase tabular-nums leading-none">
                    %{Math.floor(lvl.progress)}
                  </span>
                </div>

                <div className="text-left min-w-0 max-w-[240px]">
                  <span className={`inline-flex max-w-full items-center gap-1 px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-widest border mb-1 ${userPersona.badgeBg} ${userPersona.color} ${userPersona.border}`}>
                    <Icons.Sparkles size={10} className="flex-shrink-0" />
                    <span className="truncate min-w-0">{userPersona.title}</span>
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
          <div className="space-y-2 sm:space-y-3">
            <div className="flex flex-col lg:flex-row gap-2 sm:gap-2.5">
              {/* Arama Çubuğu */}
              <div className="relative flex-1">
                <Icons.Search size={14} className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Başarım adı, açıklama veya kategori ara..."
                  className="achv-search w-full pl-8 sm:pl-10 pr-8 sm:pr-9 py-1.5 sm:py-2.5 text-xs sm:text-sm text-ink-100 placeholder-ink-500 focus:outline-none"
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
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="grid flex-1 min-w-0 grid-cols-3 bg-[#0D0D12] rounded-lg sm:rounded-xl p-0.5 sm:p-1 border border-[#22222C]">
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`achv-chip py-1 sm:py-2 px-2 sm:px-2.5 text-[10px] sm:text-xs font-bold ${
                      filterMode === 'all' ? 'on' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Tümü
                  </button>
                  <button
                    onClick={() => setFilterMode('unlocked')}
                    className={`achv-chip py-1 sm:py-2 px-2 sm:px-2.5 text-[10px] sm:text-xs font-bold ${
                      filterMode === 'unlocked' ? 'on' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Açıklar
                  </button>
                  <button
                    onClick={() => setFilterMode('locked')}
                    className={`achv-chip py-1 sm:py-2 px-2 sm:px-2.5 text-[10px] sm:text-xs font-bold ${
                      filterMode === 'locked' ? 'on' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Kilitli
                  </button>
                </div>

                <div className="relative md:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileSortOpen((open) => !open)}
                    title="Sıralama"
                    aria-label="Sıralama"
                    className="achv-chip flex h-full min-h-[28px] sm:min-h-[38px] items-center justify-center gap-1 border border-[#22222C] bg-[#0D0D12] px-2.5 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-[11px] font-bold text-ink-200"
                  >
                    <Icons.ArrowUpDown size={14} />
                    <span className="hidden min-[380px]:inline">
                      {MOBILE_SORT_OPTIONS.find((option) => option.id === sortMode)?.label || 'Sırala'}
                    </span>
                  </button>
                  {mobileSortOpen && (
                    <div className="absolute right-0 top-full z-30 mt-2 w-36 overflow-hidden rounded-xl border border-[#22222C] bg-[#0D0D12] p-1 shadow-2xl">
                      {MOBILE_SORT_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => { setSortMode(option.id); setMobileSortOpen(false); }}
                          className={`w-full rounded-lg px-3 py-2.5 text-left text-xs font-bold transition ${
                            sortMode === option.id ? 'bg-[#FFC800] text-[#09090D]' : 'text-ink-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="hidden grid-cols-3 rounded-xl border border-[#22222C] bg-[#0D0D12] p-1 md:grid">
                  <button
                    onClick={() => setSortMode('newest')}
                    className={`achv-chip py-1 sm:py-2 px-2 sm:px-2.5 text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 ${
                      sortMode === 'newest' ? 'on' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Yeni
                  </button>
                  <button
                    onClick={() => setSortMode('oldest')}
                    className={`achv-chip py-1 sm:py-2 px-2 sm:px-2.5 text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 ${
                      sortMode === 'oldest' ? 'on' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Eski
                  </button>
                  <button
                    onClick={() => setSortMode('az')}
                    className={`achv-chip py-1 sm:py-2 px-2 sm:px-2.5 text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 ${
                      sortMode === 'az' ? 'on' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    A-Z
                  </button>
                </div>
              </div>
            </div>

            {/* Kademe Filtre Şeridi (Canlı Metal & Mücevher Renkleri) — MOBİL: minimize */}
            <div className="sm:hidden -mx-1 px-1">
              <div className="flex overflow-x-auto gap-1.5 py-0.5 hide-scrollbar snap-x">
                <button
                  onClick={() => setActiveTier(null)}
                  className={`achv-tier-chip snap-start flex-shrink-0 flex items-center gap-1 rounded-md font-black uppercase tracking-wider transition-all border ${
                    activeTier === null
                      ? 'bg-white text-[#09090D] border-white'
                      : 'bg-[#0D0D12] border-[#22222C] text-ink-400'
                  }`}
                >
                  <Icons.Layers size={11} className="shrink-0" />
                  Tümü
                  <span className="achv-tier-chip-count font-mono font-extrabold bg-black/30 text-white rounded">
                    {unlockedTiersCount}/{totalPossibleTiers}
                  </span>
                </button>

                {TIER_ORDER.map((tier: string) => {
                  const vis = TIER_VISUALS[tier] || TIER_VISUALS.bronze;
                  const isActive = activeTier === tier;
                  const stats = tierStats[tier];

                  return (
                    <button
                      key={tier}
                      onClick={() => setActiveTier(isActive ? null : tier)}
                      className="achv-tier-chip snap-start flex-shrink-0 flex items-center rounded-md font-black uppercase tracking-wider transition-all"
                      style={{
                        background: isActive ? vis.barGradient : vis.badgeBg,
                        border: `1px solid ${isActive ? vis.solid : vis.badgeBorder}`,
                        color: isActive ? vis.activeText : vis.badgeText,
                      }}
                    >
                      <span
                        className="achv-tier-chip-dot rounded-full shrink-0"
                        style={{ background: isActive ? vis.activeText : vis.solid }}
                      />
                      <span>{vis.label}</span>
                      {isActive && (
                        <span className="achv-tier-chip-count font-mono font-extrabold bg-black/30 text-white rounded">
                          {tier !== 'secret' || isTestMode ? `${stats.unlocked}/${stats.total}` : stats.unlocked}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kademe Filtre Şeridi (Canlı Metal & Mücevher Renkleri) — MASAÜSTÜ */}
            <div className="hidden sm:flex flex-wrap gap-2 py-1">
              <button
                onClick={() => setActiveTier(null)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${
                  activeTier === null
                    ? 'bg-white text-[#09090D] border-white'
                    : 'bg-[#0D0D12] border-[#22222C] text-ink-400 hover:text-white'
                }`}
              >
                <Icons.Layers size={13} />
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
                    className="flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
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
                      className="px-1.5 rounded text-[10px] font-mono font-extrabold"
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
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 auto-rows-auto sm:auto-rows-fr gap-1.5 sm:gap-4 pb-8"
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
                  onClick={() => setSelectedAch(a)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedAch(a);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${displayName} — başarım detaylarını aç`}
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
                  <div className="p-1.5 sm:p-5 flex items-center sm:items-stretch flex-row sm:flex-col gap-2 sm:gap-3.5 h-full justify-between">
                    <div className="flex items-center sm:items-start gap-2 sm:gap-4 flex-1 min-w-0">
                      {/* Sol: 3 Katmanlı Özel Vektörel Başarım Arması */}
                      <div className="achv-medal-wrap">
                        <AchievementIcon
                          achievementId={a.def.id}
                          tier={tierKey}
                          size={36}
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
                        <div className="hidden sm:flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="achv-tier-tag">
                              <span className="achv-tier-dot" />
                              {vis.label}
                            </span>

                            {a.def.category && (
                              <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider text-zinc-300 bg-[#181824] border border-[#2B2B3D] px-2 py-0.5 rounded">
                                {a.def.category}
                              </span>
                            )}

                            <span className="achv-coin-chip" title="Kazanılan SineCoin">
                              <SineCoinIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              +{TIER_COIN_REWARDS[a.tier.tier] || 0} SC
                            </span>

                            {isSecret && isTestMode && (
                              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-[#2C0B16] text-rose-300 border-rose-700">
                                Gizli
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-1.5 sm:block">
                          <h3
                            className={`min-w-0 flex-1 sm:mt-1.5 text-[12px] sm:text-[16.5px] font-black tracking-tight leading-tight sm:leading-snug line-clamp-1 sm:line-clamp-2 min-h-0 sm:min-h-[2.6rem] ${
                              isLocked ? 'text-zinc-100' : 'text-white'
                            }`}
                          >
                            {displayName}
                          </h3>
                          <span className="achv-xp-pill-sm shrink-0">+{a.tier.xp} XP</span>
                        </div>

                        <p
                          className={`hidden sm:block text-[13px] leading-relaxed mt-1 line-clamp-2 min-h-[2.5rem] ${
                            isLocked ? 'text-zinc-400' : 'text-zinc-300'
                          }`}
                        >
                          {isLocked && !isTestMode
                            ? 'Bu kupanın sırrını çözmek için keşfetmeye devam et.'
                            : parsedDesc}
                        </p>

                        {/* MOBİL: tek satır ilerleme özeti */}
                        <div className="sm:hidden mt-0.5 flex items-center gap-1 text-[8.5px] font-mono font-bold text-zinc-400">
                          {isLocked ? (
                            <>
                              <span className="truncate">
                                İlerleme: <strong className="text-white">{current}</strong> / {target}
                              </span>
                              <span className="ml-auto shrink-0" style={{ color: vis.solid }}>
                                %{percentage}
                              </span>
                            </>
                          ) : (
                            <span
                              className="flex items-center gap-1 font-extrabold uppercase tracking-wider whitespace-nowrap"
                              style={{ color: vis.solid }}
                            >
                              <Icons.CheckCircle2 size={9} className="shrink-0" /> Kupa Açıldı
                              {a.unlockedAt && (
                                <span className="font-mono font-semibold text-zinc-400 normal-case tracking-normal">
                                  · {formatDateTimeShort(a.unlockedAt)}
                                </span>
                              )}
                            </span>
                          )}
                        </div>

                        {/* MOBİL: açılmamış başarımlar için ilerleme çubuğu */}
                        {isLocked && (
                          <div className="achv-track sm:hidden mt-1">
                            <div className="achv-fill" style={{ width: `${percentage}%` }} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Alt Bar: İlerleme Çubuğu veya Kazanılma Tarihi */}
                    {isLocked ? (
                      <div className="hidden sm:block pt-2.5 border-t border-[#1E1E2A] space-y-1.5">
                        <div className="flex items-center justify-between gap-1 text-[10px] sm:text-xs">
                          <span className="font-bold text-zinc-400 font-mono truncate">
                            İlerleme: <strong className="text-white">{current}</strong> / {target}
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="achv-xp-pill">+{a.tier.xp} XP</span>
                            <span className="font-mono font-black text-[10px] sm:text-xs" style={{ color: vis.solid }}>
                              %{percentage}
                            </span>
                          </span>
                        </div>
                        <div className="achv-track">
                          <div className="achv-fill" style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="hidden sm:flex pt-2.5 border-t border-[#1E1E2A] items-end justify-between gap-2 text-xs">
                        <span
                          className="font-extrabold uppercase tracking-wider flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] whitespace-nowrap"
                          style={{ color: vis.solid }}
                        >
                          <Icons.CheckCircle2 size={12} className="shrink-0" /> Kupa Açıldı
                        </span>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="achv-xp-pill">+{a.tier.xp} XP</span>
                          {a.unlockedAt && (
                            <span className="text-[10px] sm:text-[11px] font-mono font-semibold text-zinc-400 whitespace-nowrap">
                              {formatDateTime(a.unlockedAt)}
                            </span>
                          )}
                        </div>
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

      {/* BAŞARIM DETAY PENCERESİ (MODAL) */}
      {selectedAch && (
        <AchievementDetailModal
          ach={selectedAch}
          showLockedNames={!!data.showLockedNames}
          onClose={() => setSelectedAch(null)}
        />
      )}
    </div>
  );
}
