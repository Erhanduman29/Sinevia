import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Shuffle, Sparkles, Star, Search,
  Dna, PlayCircle, ExternalLink, Youtube, Eye, Calendar, Flame,
  ChevronRight, Target, Film, RefreshCw, Users, Lock,
  Timer, Play, Pause, X, ShieldAlert, Copy, Crown, Swords, Clapperboard, MoreHorizontal
} from 'lucide-react';
import { useApp, getMovieTimerInfo, PAST_WATCH_COLLECTION_NAME } from '../context/AppContext';
import { useQuests } from '../context/QuestContext';
import { QUEST_DEFS, QuestIcon } from '../lib/quests';
import { CONTRACT_MAP, CONTRACT_FAILURE_PENALTY, METRIC_LABELS } from '../lib/contracts';
import { MARKET_ITEM_MAP } from '../lib/marketItems';
import CoinPill, { SineCoinIcon } from '../components/CoinPill';
import { levelFromXp } from '../lib/xp';
import { ACHIEVEMENT_DEFS, AchievementIcon } from '../lib/achievements';
import { getNextUnwatchedEpisode, formatDateShort, todayStr, normalize, ratingBgClass } from '../lib/utils';
import {
  supabase,
  PROFILE_PUBLIC_COLUMNS, FRIENDSHIP_COLUMNS, NETWORK_LOG_COLUMNS,
} from '../lib/supabase';
import PickModal from '../components/PickModal';
import RatingModal from '../components/RatingModal';
import BulkAddModal from '../components/BulkAddModal';
import CalibrationDuelModal from '../components/CalibrationDuelModal';
import MediaDetailModal from '../components/MediaDetailModal';
import type { DetailModalTarget } from '../components/MediaDetailModal';
import type { Movie, Series, Episode, WatchHistoryItem } from '../types';
import { RANK_TIERS } from '../lib/rankTiers';

// Nadiren açılan ağır modal: yalnızca ilk kez açıldığında indirilir.
const DnaSynthesizerModal = lazy(() => import('../components/DnaSynthesizerModal'));

// ============================================================
// PREMIUM HOME STILLERİ (Ferah & Büyük Sinevia Kartı + Mobil Tam Görünüm)
// ============================================================
const HOME_PREMIUM_CSS = `
.hn-sec{display:flex;flex-direction:column;gap:16px}
.hn-sec-t{display:flex;align-items:center;gap:14px}
.hn-sec-t h2{font-family:inherit;font-size:17px;font-weight:900;text-transform:uppercase;letter-spacing:-.01em;color:var(--text-main,#f4f4f2);margin:0}
.hn-sec-t .ln{flex:1;height:1px;background:linear-gradient(90deg,var(--line-2,var(--border-dim,rgba(244,244,242,.13))),transparent)}
.hn-idx{font-family:inherit;font-variant-numeric:tabular-nums;font-size:10px;font-weight:900;letter-spacing:.18em;color:#fff;background:linear-gradient(135deg,var(--red,var(--color-1,#e8384f)),var(--red-deep,var(--color-3,#8e1220)));padding:5px 10px;border-radius:8px;box-shadow:0 4px 14px -4px var(--red,var(--color-1,#e8384f)),inset 0 1px 0 rgba(255,255,255,.3)}
.hn-more{font-family:inherit;font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--muted,#9a9a96);background:none;border:0;cursor:pointer;transition:.2s;display:inline-flex;align-items:center;gap:4px;padding:4px 0}
.hn-more:hover{color:var(--red-hi,var(--color-2,#ff6b7a));transform:translateX(3px)}
.hp-rec{
  background:var(--glass,var(--bg-card,#1a1a24));
  border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));
  border-radius:var(--r-lg,22px);
  box-shadow:var(--shadow,0 24px 60px -24px rgba(0,0,0,.8));
}
.hn-spotlight,.hn-duo,.hn-scard,.hn-timer,.hn-bento-card{
  background:var(--glass,var(--bg-card,rgba(255,255,255,.05)));
  border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));
  border-radius:var(--r-lg,22px);
  box-shadow:var(--shadow,0 24px 60px -24px rgba(0,0,0,.8)),inset 0 1px 0 rgba(255,255,255,.07);
}

/* ============================================================
   01 · SİNEVİA KARTI (GENİŞLETİLMİŞ GRAND COMMAND DECK MİMARİSİ)
   Tüm veriler tam, kesintisiz ve sayfa fontuyla %100 uyumlu
   ============================================================ */
.snv-id-card{
  position:relative;
  font-family:inherit;
  border-radius:26px;
  background:var(--bg-card,#09090f);
  border:1px solid var(--border-dim,rgba(255,255,255,.13));
  box-shadow:0 36px 96px -28px rgba(0,0,0,.96), inset 0 1px 0 color-mix(in srgb, var(--text-main,#f4f4f2) 12%, transparent);
  overflow:hidden;
  isolation:isolate;
}
.snv-id-card::before{
  content:'';
  position:absolute;
  top:0;left:6%;right:6%;height:2px;
  background:linear-gradient(90deg,transparent,var(--red,var(--color-1,#e8384f)),#fbbf24,var(--red,var(--color-1,#e8384f)),transparent);
  opacity:.75;
  pointer-events:none;
  z-index:3;
}
.snv-id-overlay{
  position:absolute;
  inset:0;
  z-index:-1;
  background:
    radial-gradient(800px 360px at 0% 0%, var(--blob-1,rgba(232,56,79,.18)), transparent 70%),
    radial-gradient(650px 320px at 100% 0%, color-mix(in srgb, #fbbf24 9%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-base,#09090f) 55%, transparent) 0%, color-mix(in srgb, var(--bg-base,#09090f) 92%, transparent) 60%, var(--bg-card,#09090f) 100%);
  pointer-events:none;
}

/* 1. KATMAN: ÜST KİMLİK & BÜYÜK SEVİYE / SERİ / XP GÖSTERGELERİ */
.snv-hero-top{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:28px;
  padding:30px 34px 26px;
  flex-wrap:wrap;
}
.snv-hero-identity{
  display:flex;
  align-items:center;
  gap:24px;
  min-width:0;
  flex:1 1 420px;
}
.snv-crest-orb{
  position:relative;
  width:112px;
  height:112px;
  flex-shrink:0;
  display:grid;
  place-items:center;
}
.snv-crest-ring{
  position:absolute;
  inset:0;
  width:112px;
  height:112px;
  transform:rotate(-90deg);
  pointer-events:none;
}
.snv-crest-core{
  width:92px;
  height:92px;
  border-radius:50%;
  background:radial-gradient(circle at 30% 25%, rgba(255,255,255,.12), rgba(10,10,16,.96) 75%);
  border:1.5px solid rgba(255,255,255,.16);
  display:grid;
  place-items:center;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.22), 0 14px 32px -10px rgba(0,0,0,.9);
}
.snv-crest-lv{
  position:absolute;
  bottom:-6px;
  background:linear-gradient(135deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));
  border:1.5px solid rgba(255,255,255,.38);
  color:#fff;
  font-family:inherit;
  font-size:11px;
  font-variant-numeric:tabular-nums;
  font-weight:900;
  letter-spacing:.14em;
  text-transform:uppercase;
  padding:3.5px 13px;
  border-radius:99px;
  box-shadow:0 8px 18px rgba(0,0,0,.85);
}

.snv-hero-titles{
  display:flex;
  flex-direction:column;
  gap:6px;
  min-width:0;
  flex:1;
}
.snv-hero-badges{
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
}
.snv-title-pill{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:5px 12px;
  border-radius:9px;
  font-family:inherit;
  font-size:11px;
  font-weight:900;
  letter-spacing:.12em;
  text-transform:uppercase;
  background:linear-gradient(135deg,color-mix(in srgb, var(--red,var(--color-1,#e8384f)) 22%, transparent),color-mix(in srgb, var(--red,var(--color-1,#e8384f)) 8%, transparent));
  border:1px solid color-mix(in srgb, var(--red,var(--color-1,#e8384f)) 50%, transparent);
  color:var(--text-main,#f4f4f2);
  box-shadow:0 6px 18px -8px color-mix(in srgb, var(--red,var(--color-1,#e8384f)) 60%, transparent);
  cursor:pointer;
  transition:.2s cubic-bezier(.2,.7,.3,1);
}
.snv-title-pill:hover{
  transform:translateY(-1px);
  border-color:color-mix(in srgb, var(--red,var(--color-1,#e8384f)) 85%, transparent);
  background:linear-gradient(135deg,color-mix(in srgb, var(--red,var(--color-1,#e8384f)) 34%, transparent),color-mix(in srgb, var(--red,var(--color-1,#e8384f)) 14%, transparent));
}
.snv-title-pill svg{
  color:#fbbf24;
}
.snv-code-btn{
  display:inline-flex;
  align-items:center;
  gap:6px;
  background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.13);
  padding:5px 11px;
  border-radius:9px;
  font-family:inherit;
  font-variant-numeric:tabular-nums;
  font-size:11px;
  font-weight:800;
  letter-spacing:.08em;
  color:var(--muted,#9a9a96);
  cursor:pointer;
  transition:.2s;
}
.snv-code-btn:hover{
  color:#fff;
  border-color:rgba(255,255,255,.32);
  background:rgba(255,255,255,.1);
}
.snv-hero-name{
  font-family:inherit;
  font-size:38px;
  font-weight:900;
  letter-spacing:-.03em;
  line-height:1.06;
  background:linear-gradient(100deg,var(--text-main,#f4f4f2) 65%,color-mix(in srgb, var(--text-main,#f4f4f2) 65%, #7c7c85) 100%);
  -webkit-background-clip:text;
  background-clip:text;
  color:transparent;
  margin:2px 0;
  word-break:break-word;
}
.snv-hero-sub{
  font-family:inherit;
  font-size:13.5px;
  color:var(--muted,#9a9a96);
  font-weight:600;
  line-height:1.45;
}

/* Sağ Üst: Günlük Seri ve Deneyim Puanı Kutuları */
.snv-hero-readouts{
  display:flex;
  align-items:stretch;
  gap:14px;
  flex-shrink:0;
}
.snv-readout-box{
  min-width:186px;
  padding:14px 20px;
  border-radius:18px;
  background:linear-gradient(145deg,color-mix(in srgb, var(--text-main,#f4f4f2) 4.5%, transparent),color-mix(in srgb, var(--text-main,#f4f4f2) 1.5%, transparent));
  border:1px solid color-mix(in srgb, var(--text-main,#f4f4f2) 12%, transparent);
  box-shadow:inset 0 1px 0 color-mix(in srgb, var(--text-main,#f4f4f2) 8%, transparent);
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  gap:4px;
}
.snv-readout-top{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  font-family:inherit;
  font-size:10px;
  font-weight:900;
  letter-spacing:.14em;
  text-transform:uppercase;
  color:var(--muted,#9a9a96);
}
.snv-readout-top .flame{color:#fb923c}
.snv-readout-top .xp-pct{
  color:var(--red-hi,var(--color-2,#ff6b7a));
  font-variant-numeric:tabular-nums;
}
.snv-readout-num{
  display:flex;
  align-items:baseline;
  gap:6px;
  margin:2px 0;
}
.snv-readout-num b{
  font-family:inherit;
  font-variant-numeric:tabular-nums;
  font-size:32px;
  font-weight:900;
  letter-spacing:-.035em;
  line-height:1;
  color:var(--text-main,#f4f4f2);
}
.snv-readout-num em{
  font-style:normal;
  font-family:inherit;
  font-size:11px;
  font-weight:900;
  letter-spacing:.12em;
  text-transform:uppercase;
  color:var(--red-hi,var(--color-2,#ff6b7a));
}
.snv-readout-num em.warm{color:#fb923c}
.snv-readout-foot{
  font-family:inherit;
  font-variant-numeric:tabular-nums;
  font-size:11px;
  font-weight:700;
  color:var(--muted,#9a9a96);
}
button.snv-readout-box{
  text-align:left;
  font:inherit;
  cursor:pointer;
  transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease,background .22s ease;
}
button.snv-readout-box:hover{
  transform:translateY(-2px);
  border-color:rgba(245,158,11,.55);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 10px 28px -12px rgba(245,158,11,.55);
}
.snv-readout-box.is-coin{
  border-color:rgba(245,158,11,.28);
  background:linear-gradient(145deg,rgba(245,158,11,.13),rgba(120,53,15,.08));
}
.snv-readout-box.is-coin .snv-readout-top{color:#fcd34d}
.snv-readout-box.is-coin .snv-readout-num em{color:#fbbf24}
.snv-readout-box.is-streak{
  border-color:rgba(251,146,60,.26);
  background:linear-gradient(145deg,rgba(251,146,60,.12),rgba(120,53,15,.06));
}
.snv-readout-box.is-streak .snv-readout-top{color:#fdba74}
.snv-readout-box.is-streak .snv-readout-num em{color:#fb923c}
.snv-coin-arrow{color:#fbbf24;font-size:12px;transition:transform .2s ease}
button.snv-readout-box.is-coin:hover .snv-coin-arrow{transform:translateX(3px)}

/* 2. KATMAN: İKİ BÜYÜK PRESTİJ VİTRİNİ (UNVAN YOLU & AKTİF ROZET) */
.snv-showcase-deck{
  display:grid;
  grid-template-columns:1.18fr 1fr;
  gap:18px;
  padding:0 34px 26px;
}
.snv-deck-panel{
  position:relative;
  border-radius:20px;
  padding:20px 24px;
  background:linear-gradient(155deg, color-mix(in srgb, var(--text-main,#f4f4f2) 5%, transparent) 0%, color-mix(in srgb, var(--text-main,#f4f4f2) 1.5%, transparent) 100%);
  border:1px solid color-mix(in srgb, var(--text-main,#f4f4f2) 12%, transparent);
  box-shadow:inset 0 1px 0 color-mix(in srgb, var(--text-main,#f4f4f2) 10%, transparent), 0 16px 36px -20px rgba(0,0,0,.85);
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  gap:16px;
  cursor:pointer;
  transition:.25s cubic-bezier(.2,.7,.3,1);
  text-align:left;
  font-family:inherit;
  color:inherit;
}
.snv-deck-panel:hover{
  transform:translateY(-2px);
  border-color:color-mix(in srgb, var(--red,var(--color-1,#e8384f)) 50%, transparent);
  background:linear-gradient(155deg, color-mix(in srgb, var(--red,var(--color-1,#e8384f)) 10%, transparent) 0%, color-mix(in srgb, var(--text-main,#f4f4f2) 2.5%, transparent) 100%);
  box-shadow:inset 0 1px 0 color-mix(in srgb, var(--text-main,#f4f4f2) 15%, transparent), 0 20px 42px -18px color-mix(in srgb, var(--red,var(--color-1,#e8384f)) 35%, transparent);
}
.snv-deck-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  flex-wrap:wrap;
}
.snv-deck-title{
  display:inline-flex;
  align-items:center;
  gap:7px;
  font-family:inherit;
  font-size:11px;
  font-weight:900;
  letter-spacing:.15em;
  text-transform:uppercase;
  color:#fbbf24;
}
.snv-deck-title.rose{
  color:var(--red-hi,var(--color-2,#ff6b7a));
}
.snv-deck-pill{
  font-family:inherit;
  font-variant-numeric:tabular-nums;
  font-size:10.5px;
  font-weight:800;
  letter-spacing:.06em;
  color:var(--text-main,#f4f4f5);
  background:color-mix(in srgb, var(--bg-base,#09090f) 45%, transparent);
  border:1px solid color-mix(in srgb, var(--text-main,#f4f4f2) 14%, transparent);
  padding:4px 11px;
  border-radius:99px;
}

/* Sol Vitrin İçeriği: Karşılıklı Büyük Unvan Armaları */
.snv-rank-road{
  display:grid;
  grid-template-columns:1fr auto 1fr;
  align-items:center;
  gap:14px;
}
.snv-rank-Endpoint{
  display:flex;
  align-items:center;
  gap:13px;
  min-width:0;
}
.snv-rank-Endpoint.target{
  justify-content:flex-end;
  text-align:right;
}
.snv-rank-pedestal{
  width:64px;
  height:64px;
  border-radius:16px;
  background:radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--text-main,#f4f4f2) 10%, transparent), color-mix(in srgb, var(--bg-base,#09090f) 55%, transparent));
  border:1px solid color-mix(in srgb, var(--text-main,#f4f4f2) 14%, transparent);
  display:grid;
  place-items:center;
  flex-shrink:0;
  box-shadow:inset 0 1px 0 color-mix(in srgb, var(--text-main,#f4f4f2) 15%, transparent);
}
.snv-rank-Endpoint.target .snv-rank-pedestal{
  background:radial-gradient(circle at 50% 30%, rgba(251,191,36,.2), color-mix(in srgb, var(--bg-base,#09090f) 55%, transparent));
  border-color:rgba(251,191,36,.45);
}
.snv-rank-info{
  display:flex;
  flex-direction:column;
  gap:2px;
  min-width:0;
}
.snv-rank-info small{
  font-family:inherit;
  font-size:9.5px;
  font-weight:800;
  letter-spacing:.12em;
  text-transform:uppercase;
  color:var(--muted,#9a9a96);
}
.snv-rank-info b{
  font-family:inherit;
  font-size:15.5px;
  font-weight:900;
  letter-spacing:-.015em;
  color:var(--text-main,#f4f4f2);
  line-height:1.2;
}
.snv-rank-Endpoint.target .snv-rank-info b{
  color:#fde047;
}
.snv-rank-info span{
  font-family:inherit;
  font-variant-numeric:tabular-nums;
  font-size:11px;
  font-weight:700;
  color:var(--muted,#9a9a96);
}
.snv-rank-arrow{
  width:34px;
  height:34px;
  border-radius:50%;
  background:color-mix(in srgb, var(--red,var(--color-1,#e8384f)) 16%, transparent);
  border:1px solid color-mix(in srgb, var(--red,var(--color-1,#e8384f)) 40%, transparent);
  color:var(--red-hi,var(--color-2,#ff6b7a));
  display:grid;
  place-items:center;
  flex-shrink:0;
}

.snv-rank-progress-wrap{
  display:flex;
  flex-direction:column;
  gap:6px;
}
.snv-rank-progress-labels{
  display:flex;
  justify-content:space-between;
  font-family:inherit;
  font-variant-numeric:tabular-nums;
  font-size:11px;
  font-weight:800;
  color:color-mix(in srgb, var(--text-main,#f4f4f2) 82%, transparent);
}
.snv-rank-progress-labels b{
  color:#fde047;
}
.snv-rank-bar{
  height:8px;
  border-radius:99px;
  background:color-mix(in srgb, var(--bg-base,#09090f) 60%, transparent);
  border:1px solid color-mix(in srgb, var(--text-main,#f4f4f2) 8%, transparent);
  overflow:hidden;
  position:relative;
}
.snv-rank-bar i{
  position:absolute;
  inset:0 auto 0 0;
  border-radius:99px;
  background:linear-gradient(90deg,var(--red,var(--color-1,#e8384f)),#fbbf24);
  box-shadow:0 0 14px rgba(251,191,36,.6);
  transition:width .8s ease;
}

/* Sağ Vitrin İçeriği: Kuşanılan Özel Görev Arması Detaylı Kart */
.snv-badge-body{
  display:flex;
  align-items:center;
  gap:16px;
  min-width:0;
}
.snv-badge-pedestal{
  width:72px;
  height:72px;
  border-radius:18px;
  background:radial-gradient(circle at 35% 25%, color-mix(in srgb, var(--red,var(--color-1,#e8384f)) 24%, transparent), color-mix(in srgb, var(--bg-base,#09090f) 60%, transparent));
  border:1px solid color-mix(in srgb, var(--red,var(--color-1,#e8384f)) 45%, transparent);
  display:grid;
  place-items:center;
  flex-shrink:0;
  color:var(--red-hi,var(--color-2,#ff6b7a));
  box-shadow:inset 0 1px 0 color-mix(in srgb, var(--text-main,#f4f4f2) 18%, transparent);
}
.snv-badge-pedestal.empty{
  background:color-mix(in srgb, var(--text-main,#f4f4f2) 3%, transparent);
  border:1px dashed color-mix(in srgb, var(--text-main,#f4f4f2) 20%, transparent);
  color:var(--muted,#9a9a96);
}
.snv-badge-info{
  display:flex;
  flex-direction:column;
  gap:4px;
  min-width:0;
  flex:1;
}
.snv-badge-info b{
  font-family:inherit;
  font-size:17px;
  font-weight:900;
  letter-spacing:-.015em;
  color:var(--text-main,#f4f4f2);
  line-height:1.2;
}
.snv-badge-info p{
  font-family:inherit;
  font-size:12px;
  font-weight:500;
  color:var(--muted,#9a9a96);
  line-height:1.45;
  margin:0;
}
.snv-badge-foot{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding-top:10px;
  border-top:1px solid color-mix(in srgb, var(--text-main,#f4f4f2) 8%, transparent);
  font-family:inherit;
  font-variant-numeric:tabular-nums;
  font-size:11px;
  font-weight:800;
  color:var(--muted,#9a9a96);
}
.snv-badge-foot strong{
  color:#34d399;
}

/* LAZER XP İLERLEME ÇİZGİSİ */
.snv-id-laser-wrap{
  position:relative;
  height:3px;
  background:color-mix(in srgb, var(--text-main,#f4f4f2) 7%, transparent);
  width:100%;
  overflow:hidden;
}
.snv-id-laser-fill{
  position:absolute;
  top:0;bottom:0;left:0;
  background:linear-gradient(90deg,color-mix(in srgb, var(--red,var(--color-1,#e8384f)) 35%, transparent),var(--red,var(--color-1,#e8384f)) 45%,var(--red-hi,var(--color-2,#ff6b7a)) 92%,#ffffff 100%);
  box-shadow:0 0 18px var(--red,var(--color-1,#e8384f));
  transition:width 1s cubic-bezier(.2,.8,.2,1);
}

/* 3. KATMAN: ALT KONSOL (5'Lİ KARİYER METRİĞİ + 6'LI KUPA KADEMESİ) */
.snv-id-footer{
  display:grid;
  grid-template-columns:1fr 1.25fr;
  align-items:stretch;
  background:linear-gradient(180deg, color-mix(in srgb, var(--text-main,#f4f4f2) 2.5%, transparent) 0%, color-mix(in srgb, var(--bg-base,#09090f) 40%, transparent) 100%);
}
.snv-id-metrics{
  display:grid;
  grid-template-columns:repeat(5, 1fr);
  align-items:center;
  gap:8px;
  padding:16px 26px;
  border-right:1px solid color-mix(in srgb, var(--text-main,#f4f4f2) 8%, transparent);
}
.snv-id-mitem{
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  text-align:center;
  gap:3px;
  padding:10px 6px;
  border-radius:12px;
  background:color-mix(in srgb, var(--text-main,#f4f4f2) 2.5%, transparent);
  border:1px solid color-mix(in srgb, var(--text-main,#f4f4f2) 6%, transparent);
}
.snv-id-mitem b{
  font-family:inherit;
  font-size:22px;
  font-variant-numeric:tabular-nums;
  font-weight:900;
  letter-spacing:-.03em;
  line-height:1.05;
  color:var(--text-main,#f4f4f2);
}
.snv-id-mitem span{
  font-family:inherit;
  font-size:10px;
  font-weight:800;
  letter-spacing:.12em;
  text-transform:uppercase;
  color:var(--muted,#9a9a96);
}

.snv-id-tiers{
  display:grid;
  grid-template-columns:repeat(6, 1fr);
  align-items:center;
  gap:8px;
  padding:16px 26px;
}
.snv-id-tier{
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:5px;
  padding:10px 6px;
  border-radius:12px;
  background:color-mix(in srgb, var(--text-main,#f4f4f2) 2.8%, transparent);
  border:1px solid color-mix(in srgb, var(--text-main,#f4f4f2) 8%, transparent);
  color:inherit;
  font-family:inherit;
  cursor:pointer;
  transition:.22s cubic-bezier(.2,.7,.3,1);
}
.snv-id-tier:hover{
  background:color-mix(in srgb, var(--text-main,#f4f4f2) 7%, transparent);
  border-color:color-mix(in srgb, var(--text-main,#f4f4f2) 24%, transparent);
  transform:translateY(-2px);
}
.snv-id-tier-top{
  display:flex;
  align-items:center;
  gap:6px;
}
.snv-id-tier i{
  width:8px;
  height:8px;
  border-radius:50%;
  flex-shrink:0;
}
.snv-id-tier b{
  font-family:inherit;
  font-size:18px;
  font-variant-numeric:tabular-nums;
  font-weight:900;
  color:var(--text-main,#f4f4f2);
  line-height:1;
}
.snv-id-tier span{
  font-family:inherit;
  font-size:10px;
  font-weight:800;
  letter-spacing:.1em;
  text-transform:uppercase;
  color:color-mix(in srgb, var(--text-main,#f4f4f2) 80%, transparent);
}

/* Tema kontrast override: açık temalarda altın metinleri koyulaştır */
body[data-theme="light"] .snv-deck-title,
body[data-theme="sepia"] .snv-deck-title,
body[data-theme="light"] .snv-rank-Endpoint.target .snv-rank-info b,
body[data-theme="sepia"] .snv-rank-Endpoint.target .snv-rank-info b,
body[data-theme="light"] .snv-rank-progress-labels b,
body[data-theme="sepia"] .snv-rank-progress-labels b,
body[data-theme="light"] .snv-title-pill svg,
body[data-theme="sepia"] .snv-title-pill svg{
  color:#a16207;
}

/* ---------- HIZLI ERİŞİM + ZAMANLAYICI ---------- */
.hn-action{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%}
.hn-timer{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:16px 20px}
.hn-timer-ic{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;color:#fff;flex-shrink:0;background:linear-gradient(140deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));box-shadow:0 8px 22px -8px var(--red,var(--color-1,#e8384f)),inset 0 1px 0 rgba(255,255,255,.4)}
.hn-timer-tx{flex:1;min-width:220px}
.hn-timer-status{font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--red-hi,var(--color-2,#ff6b7a));display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.hn-timer-status span{color:var(--text-main,#f4f4f2)}
.hn-timer-sub{font-size:12px;color:var(--muted,#9a9a96);margin-top:5px}
.hn-timer-sub b{color:var(--text-main,#f4f4f2)}
.hn-timer-sub .hn-mono{font-variant-numeric:tabular-nums}
.hn-timer-warn{color:#EFC94C;margin-left:8px}
.hn-timer-btns{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}
.hn-timer-x{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.04);border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));color:var(--muted,#9a9a96);cursor:pointer;transition:.22s}
.hn-timer-x:hover{color:#fff;border-color:var(--red,var(--color-1,#e8384f));background:rgba(232,56,79,.12)}

/* ---------- BUTON SİSTEMİ ---------- */
.hn-btn{position:relative;overflow:hidden;isolation:isolate;font-family:inherit;font-size:11.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;padding:13px 22px;border-radius:13px;border:1px solid transparent;cursor:pointer;transition:.25s cubic-bezier(.2,.7,.3,1);display:inline-flex;align-items:center;gap:6px;color:inherit}
.hn-btn::after{content:'';position:absolute;top:0;left:-80%;width:55%;height:100%;z-index:-1;background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg);transition:left .5s ease}
.hn-btn:hover::after{left:130%}
.hn-btn:active{transform:translateY(1px) scale(.985)}
.hn-btn-p{color:#fff;background:linear-gradient(150deg,var(--red-hi,var(--color-2,#ff6b7a)) 0%,var(--red,var(--color-1,#e8384f)) 45%,var(--red-deep,var(--color-3,#8e1220)) 130%);box-shadow:0 10px 28px -10px var(--red,var(--color-1,#e8384f)),inset 0 1px 0 rgba(255,255,255,.35),inset 0 -2px 6px rgba(0,0,0,.25)}
.hn-btn-p:hover{transform:translateY(-2px);box-shadow:0 16px 36px -10px var(--red,var(--color-1,#e8384f)),inset 0 1px 0 rgba(255,255,255,.4)}
.hn-btn-s{color:var(--text-main,#f4f4f2);background:linear-gradient(150deg,rgba(255,255,255,.14),rgba(255,255,255,.05));border-color:rgba(255,255,255,.16);box-shadow:0 8px 22px -12px rgba(0,0,0,.9),inset 0 1px 0 rgba(255,255,255,.16)}
.hn-btn-s:hover{transform:translateY(-2px);background:linear-gradient(150deg,rgba(255,255,255,.2),rgba(255,255,255,.08));border-color:rgba(255,255,255,.3)}
.hn-btn-g{color:var(--muted,#9a9a96);background:rgba(255,255,255,.03);border-color:var(--line-2,var(--border-dim,rgba(244,244,242,.13)))}
.hn-btn-g:hover{color:var(--text-main,#f4f4f2);border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.07);transform:translateY(-2px)}
.hn-btn:disabled{opacity:.4;pointer-events:none}
.hn-btn-ic{vertical-align:-2px}
.hn-planned{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;padding:13px 22px;border-radius:13px;color:var(--muted,#9a9a96);background:rgba(255,255,255,.03);border:1px dashed var(--line-2,var(--border-dim,rgba(244,244,242,.13)))}

/* ---------- 02 · GÜNÜN SİNEMA KARTI ---------- */
.hn-spotlight{
  display:grid;
  grid-template-columns:340px minmax(0,1fr);
  align-items:stretch;
  overflow:hidden;
}
.hn-sp-poster{
  border-right:1px solid var(--line,rgba(244,244,242,.08));
  width:340px;
  aspect-ratio:2/3;
  position:relative;
  overflow:hidden;
  background:#09090d;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  padding:0;
  font-family:inherit;
  color:inherit;
}
.hn-sp-poster:focus-visible{outline:2px solid var(--red,var(--color-1,#e8384f));outline-offset:-2px}
.hn-sp-poster img{
  width:100%;
  height:100%;
  object-fit:cover;
  object-position:center;
  display:block;
  opacity:1;
  transition:transform .45s cubic-bezier(.2,.7,.3,1);
}
.hn-sp-poster:hover img{transform:scale(1.03)}
.hn-big-letter{font-size:150px;font-weight:900;color:rgba(255,255,255,.12);letter-spacing:-.06em;user-select:none;pointer-events:none}
.hn-filmbadge{position:absolute;top:0;left:0;z-index:2;color:#fff;font-size:9.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;padding:8px 14px;background:linear-gradient(135deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));border-radius:0 0 14px 0;box-shadow:0 6px 18px -6px var(--red,var(--color-1,#e8384f))}
.hn-rate{position:absolute;top:14px;right:14px;z-index:2;font-weight:900;font-variant-numeric:tabular-nums;font-size:15px;background:rgba(10,10,13,.85);border:1px solid rgba(255,255,255,.22);padding:6px 12px;border-radius:11px;color:#fff;backdrop-filter:blur(10px);box-shadow:0 8px 22px -10px rgba(0,0,0,.9)}
.hn-sp-body{padding:34px 38px;display:flex;flex-direction:column;gap:18px;min-width:0;overflow:hidden}
.hn-sp-head{display:flex;flex-direction:column;gap:14px;min-width:0}
.hn-sp-kick{font-family:inherit;font-size:10px;font-weight:800;letter-spacing:.26em;color:var(--red-hi,var(--color-2,#ff6b7a));text-transform:uppercase}
.hn-sp-body h2{font-family:inherit;font-size:40px;font-weight:900;text-transform:uppercase;letter-spacing:-.035em;line-height:.98;margin:0;background:linear-gradient(100deg,#fff 35%,#9C9CA1);-webkit-background-clip:text;background-clip:text;color:transparent;overflow-wrap:anywhere;min-width:0}
.hn-meta-chips{display:flex;gap:8px;flex-wrap:wrap;width:fit-content;max-width:100%;min-width:0}
.hn-meta-chips span{font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:8px 14px;color:var(--muted,#9a9a96);background:rgba(255,255,255,.05);border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));border-radius:99px;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hn-meta-chips span b{color:var(--text-main,#f4f4f2)}
.hn-genre-row{display:flex;gap:8px;flex-wrap:wrap;min-width:0}
.hn-genre{font-family:inherit;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));padding:7px 14px;color:var(--muted,#9a9a96);border-radius:99px;transition:.2s;background:none;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hn-genre:first-child{color:var(--red-hi,var(--color-2,#ff6b7a));border-color:rgba(232,56,79,.5);background:rgba(232,56,79,.12)}
.hn-gdesc{font-family:inherit;font-size:14px;line-height:1.75;color:var(--muted,#9a9a96);max-width:680px;margin:0;overflow-wrap:anywhere}
.hn-gdesc b{color:var(--text-main,#f4f4f2);font-weight:700}
.hn-gdesc-empty{font-style:italic}
.hn-btnrow{display:flex;flex-wrap:wrap;gap:11px;margin-top:auto;padding-top:6px;min-width:0}
.hn-btnrow .hn-btn{max-width:100%}
.hn-links{display:flex;gap:8px;flex-wrap:wrap}
.hn-sp-more{display:none}
.hn-link-chip{display:inline-flex;align-items:center;gap:7px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted,#9a9a96);background:rgba(255,255,255,.04);border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));padding:8px 13px;border-radius:99px;transition:.2s;text-decoration:none}
.hn-link-chip:hover{color:var(--text-main,#f4f4f2);border-color:rgba(255,255,255,.3);transform:translateY(-2px)}
.hn-link-logo{width:13px;height:13px;border-radius:3px;object-fit:cover}

/* ---------- İZLEMEYE DEVAM ET ---------- */
.hn-series-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.hn-scard{padding:20px;display:flex;gap:16px;transition:.28s cubic-bezier(.2,.7,.3,1)}
.hn-scard:hover{transform:translateY(-6px);border-color:var(--red,var(--color-1,#e8384f));box-shadow:0 30px 56px -22px rgba(0,0,0,.9),0 0 36px -14px var(--red,var(--color-1,#e8384f)),inset 0 1px 0 rgba(255,255,255,.1)}
.hn-sposter{width:86px;flex-shrink:0;aspect-ratio:2/3;border-radius:12px;position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.12);background:linear-gradient(160deg,#221D2A,#0D0D11);display:flex;align-items:flex-end;box-shadow:0 10px 26px -12px rgba(0,0,0,.9);cursor:pointer;font-family:inherit;padding:0}
.hn-sposter img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hn-sl{position:absolute;inset:0;display:grid;place-items:center;font-size:56px;font-weight:900;color:rgba(255,255,255,.07);pointer-events:none}
.hn-ep{position:relative;z-index:1;margin:8px;color:#fff;font-size:8.5px;font-weight:800;letter-spacing:.1em;padding:4px 8px;text-transform:uppercase;background:linear-gradient(135deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));border-radius:7px;box-shadow:0 4px 12px -4px var(--red,var(--color-1,#e8384f))}
.hn-sinfo{flex:1;min-width:0;display:flex;flex-direction:column}
.hn-sinfo h4{font-family:inherit;font-size:15.5px;font-weight:900;text-transform:uppercase;letter-spacing:-.015em;margin:0;color:var(--text-main,#f4f4f2)}
.hn-next-ep{display:inline-block;width:fit-content;margin-top:8px;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;background:rgba(255,255,255,.05);border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));color:var(--muted,#9a9a96);padding:5px 10px;border-radius:99px}
.hn-next-ep b{color:var(--red-hi,var(--color-2,#ff6b7a))}
.hn-prog-lab{display:flex;justify-content:space-between;font-family:inherit;font-variant-numeric:tabular-nums;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#9a9a96);margin-top:15px}
.hn-prog-lab i{font-style:normal;color:var(--red-hi,var(--color-2,#ff6b7a))}
.hn-prog{height:8px;background:rgba(0,0,0,.5);border-radius:99px;margin-top:6px;position:relative;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.7)}
.hn-prog i{position:absolute;top:0;bottom:0;left:0;border-radius:99px;background:linear-gradient(90deg,var(--red-deep,var(--color-3,#8e1220)),var(--red-hi,var(--color-2,#ff6b7a)));box-shadow:0 0 12px var(--red,var(--color-1,#e8384f))}
.hn-rate-btn{margin-top:15px;width:100%;padding:11px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));color:var(--muted,#9a9a96);font-family:inherit;font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;transition:.24s;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
.hn-rate-btn:hover{background:linear-gradient(150deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));border-color:transparent;color:#fff;box-shadow:0 10px 26px -8px var(--red,var(--color-1,#e8384f));transform:translateY(-2px)}

/* ---------- ROZETLER + SİNEVİA AĞI ---------- */
.hn-duo{display:grid;grid-template-columns:1fr 1fr;overflow:hidden}
.hn-panel{padding:26px 28px}
.hn-panel + .hn-panel{border-left:1px solid var(--line,rgba(244,244,242,.07))}
.hn-panel h3{font-family:inherit;font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:-.01em;margin:0 0 18px;display:flex;align-items:center;gap:10px;color:var(--text-main,#f4f4f2);flex-wrap:wrap}
.hn-di{width:9px;height:9px;border-radius:3px;background:linear-gradient(135deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));box-shadow:0 0 12px var(--red,var(--color-1,#e8384f));flex-shrink:0}
.hn-panel h3 .hn-more{margin-left:auto}
.hn-empty{font-family:inherit;font-size:12px;color:var(--muted,#9a9a96);line-height:1.7;padding:13px 16px;background:rgba(255,255,255,.03);border:1px dashed var(--line-2,var(--border-dim,rgba(244,244,242,.13)));border-radius:14px;margin:0}
.hn-ach{border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));background:rgba(255,255,255,.035);padding:16px 17px;margin-bottom:13px;border-radius:16px;transition:.24s;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.hn-ach:last-child{margin-bottom:0}
.hn-ach:hover{border-color:var(--red,var(--color-1,#e8384f));background:rgba(255,255,255,.06);transform:translateX(4px);box-shadow:0 10px 28px -14px rgba(0,0,0,.9),-4px 0 24px -14px var(--red,var(--color-1,#e8384f))}
.hn-ach .top{display:flex;align-items:center;gap:13px}
.hn-ai{width:44px;height:44px;border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));display:grid;place-items:center;font-size:17px;flex-shrink:0;background:rgba(255,255,255,.05);border-radius:13px}
.hn-an{flex:1;min-width:0}
.hn-an b{display:block;font-family:inherit;font-size:13px;font-weight:900;text-transform:uppercase;color:var(--text-main,#f4f4f2)}
.hn-an span{font-size:11px;color:var(--muted,#9a9a96);font-weight:500}
.hn-axp{font-size:10px;font-variant-numeric:tabular-nums;font-weight:900;letter-spacing:.08em;color:var(--red-hi,var(--color-2,#ff6b7a));background:rgba(232,56,79,.14);border:1px solid rgba(232,56,79,.45);padding:5px 10px;white-space:nowrap;border-radius:99px}
.hn-pl{display:flex;justify-content:space-between;font-family:inherit;font-variant-numeric:tabular-nums;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#9a9a96);margin-top:13px}
.hn-pl i{font-style:normal;color:var(--text-main,#f4f4f2)}
.hn-pt{height:8px;background:rgba(0,0,0,.5);border-radius:99px;margin-top:6px;position:relative;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.7)}
.hn-pt i{position:absolute;top:0;bottom:0;left:0;border-radius:99px;background:linear-gradient(90deg,var(--red-deep,var(--color-3,#8e1220)),var(--red-hi,var(--color-2,#ff6b7a)));box-shadow:0 0 12px var(--red,var(--color-1,#e8384f))}
.hn-net-note{font-family:inherit;font-size:12.5px;line-height:1.7;color:var(--muted,#9a9a96);padding:13px 16px;margin:0 0 16px;background:linear-gradient(120deg,var(--blob-1,rgba(232,56,79,.12)),transparent 80%);border:1px solid rgba(232,56,79,.3);border-radius:14px}
.hn-agents{display:flex;flex-direction:column;gap:10px}
.hn-agent{display:flex;align-items:center;gap:14px;padding:11px 14px;border:1px solid var(--line,rgba(244,244,242,.08));border-radius:16px;background:rgba(255,255,255,.03);transition:.22s}
.hn-agent:hover{background:rgba(255,255,255,.065);border-color:var(--line-2,var(--border-dim,rgba(244,244,242,.16)));transform:translateX(4px)}
.hn-agent-poster{
  width:46px;
  aspect-ratio:2/3;
  border-radius:9px;
  overflow:hidden;
  flex-shrink:0;
  background:linear-gradient(160deg,#23232A,#111116);
  border:1px solid rgba(255,255,255,.14);
  display:grid;
  place-items:center;
  color:var(--muted,#9a9a96);
  box-shadow:0 8px 18px -8px rgba(0,0,0,.85);
}
.hn-agent-poster img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}
.hn-agent-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.hn-agent-who{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.hn-agent-avatar-mini{
  width:18px;
  height:18px;
  border-radius:50%;
  background:rgba(232,56,79,.18);
  border:1px solid rgba(232,56,79,.4);
  color:var(--red-hi,var(--color-2,#ff6b7a));
  font-size:9.5px;
  font-weight:900;
  display:inline-grid;
  place-items:center;
  flex-shrink:0;
}
.hn-agent-who b{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--red-hi,var(--color-2,#ff6b7a));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px}
.hn-agent-who span{font-size:10px;color:var(--muted,#9a9a96);font-weight:600}
.hn-agent-title{font-family:inherit;font-size:13.5px;font-weight:900;color:var(--text-main,#f4f4f2);line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hn-agent-time{font-family:inherit;font-variant-numeric:tabular-nums;font-size:9.5px;font-weight:600;color:var(--muted,#9a9a96);letter-spacing:.06em;text-transform:uppercase}
.hn-st{margin-left:auto;font-size:9.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));padding:5px 10px;color:var(--muted,#9a9a96);border-radius:99px;white-space:nowrap;flex-shrink:0}
.hn-st.on{color:#67E39B;border-color:rgba(78,203,142,.5);background:rgba(78,203,142,.1);box-shadow:0 0 14px -5px rgba(78,203,142,.7)}
.hn-agents-loading{text-align:center;padding:26px 10px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted,#9a9a96);animation:hnPulse 1.6s ease-in-out infinite}
.hn-agents-empty{text-align:center;padding:26px 10px;font-family:inherit;font-size:12.5px;line-height:1.7;color:var(--muted,#9a9a96);background:rgba(255,255,255,.03);border:1px dashed var(--line-2,var(--border-dim,rgba(244,244,242,.13)));border-radius:14px;font-style:italic}
@keyframes hnPulse{50%{opacity:.4}}
.hn-net-more{margin-top:4px;width:100%;padding:12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));color:var(--red-hi,var(--color-2,#ff6b7a));font-family:inherit;font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transition:.24s;display:flex;align-items:center;justify-content:center;gap:6px}
.hn-net-more:hover{background:linear-gradient(150deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));border-color:transparent;color:#fff;box-shadow:0 10px 26px -8px var(--red,var(--color-1,#e8384f));transform:translateY(-2px)}

/* ---------- SON İZLENENLER ---------- */
.hp-recent{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
.hp-rec{display:flex;flex-direction:column;padding:0;overflow:hidden;cursor:pointer;font-family:inherit;color:inherit;text-align:left;transition:.26s cubic-bezier(.2,.7,.3,1)}
.hp-rec:hover{transform:translateY(-6px);border-color:var(--red,var(--color-1,#e8384f));box-shadow:0 28px 52px -22px rgba(0,0,0,.9),0 0 30px -14px var(--red,var(--color-1,#e8384f))}
.hp-rec-art{display:block;position:relative;aspect-ratio:2/3;overflow:hidden;background:var(--bg-surface,#12121a);border-bottom:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)))}
.hp-rec-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .45s cubic-bezier(.2,.7,.3,1)}
.hp-rec:hover .hp-rec-art img{transform:scale(1.05)}
.hp-rec-ph{position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(165deg,var(--blob-1,rgba(232,56,79,.26)),transparent 72%)}
.hp-rec-ph b{font-size:52px;font-weight:900;letter-spacing:-.04em;color:var(--red-hi,var(--color-2,#ff6b7a));text-shadow:0 6px 24px var(--red,rgba(232,56,79,.5))}
.hp-rec-kind{position:absolute;top:10px;left:10px;z-index:2;font-size:8px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;padding:4px 9px;border-radius:99px;color:var(--on-color-1,#0a0a0e);background:linear-gradient(135deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));box-shadow:0 4px 14px -6px var(--red,var(--color-1,#e8384f))}
.hp-rec-rate{position:absolute;top:10px;right:10px;z-index:2;font-size:11px;font-weight:900;padding:4px 9px;border-radius:99px;font-variant-numeric:tabular-nums;box-shadow:0 6px 16px -6px rgba(0,0,0,.7)}
.hp-rec-tx{display:block;padding:13px 15px 15px;min-width:0}
.hp-rec-tx b{display:block;font-family:inherit;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:-.01em;color:var(--text-main,#f4f4f2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hp-rec-tx span{display:block;font-family:inherit;font-variant-numeric:tabular-nums;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#9a9a96);margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hp-rec-tx span i{font-style:normal;color:var(--red-hi,var(--color-2,#ff6b7a))}

/* ---------- BENTO (Nasıl Çalışır) ---------- */
.hn-bento-badge{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:7px 16px;border-radius:99px;font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--red-hi,var(--color-2,#ff6b7a));background:rgba(232,56,79,.1);border:1px solid rgba(232,56,79,.3)}
.hn-bento-title{font-family:inherit;font-size:30px;font-weight:900;letter-spacing:-.03em;text-transform:uppercase;margin:14px 0 0;background:linear-gradient(100deg,#fff 30%,#A9A9AE);-webkit-background-clip:text;background-clip:text;color:transparent}
.hn-bento-card{padding:26px;transition:.28s cubic-bezier(.2,.7,.3,1)}
.hn-bento-card:hover{transform:translateY(-6px);border-color:var(--red,var(--color-1,#e8384f));box-shadow:0 28px 54px -20px rgba(0,0,0,.9),0 0 34px -12px var(--red,var(--color-1,#e8384f)),inset 0 1px 0 rgba(255,255,255,.1)}
.hn-bento-ic{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;margin-bottom:16px;border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));background:rgba(255,255,255,.04);color:var(--red-hi,var(--color-2,#ff6b7a));transition:.28s}
.hn-bento-card:hover .hn-bento-ic{border-color:var(--red,var(--color-1,#e8384f));box-shadow:0 0 22px -6px var(--red,var(--color-1,#e8384f));transform:scale(1.06)}
.hn-bento-card h4{font-family:inherit;font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:-.015em;margin:0 0 8px;color:var(--text-main,#f4f4f2)}
.hn-bento-card p{font-family:inherit;font-size:12.5px;line-height:1.7;color:var(--muted,#9a9a96);margin:0}

/* ============================================================
   RESPONSIVE & MOBİL TAM GÖRÜNÜM OPTİMİZASYONU
   ============================================================ */
@media (max-width:1180px) and (min-width:768px){
  .snv-showcase-deck{grid-template-columns:1fr}
  .snv-id-footer{grid-template-columns:1fr}
  .snv-id-metrics{border-right:0;border-bottom:1px solid color-mix(in srgb, var(--text-main,#f4f4f2) 8%, transparent)}
}
@media (max-width:1080px){
  .hp-recent{grid-template-columns:repeat(3,1fr)}
  .hn-spotlight{grid-template-columns:300px minmax(0,1fr)}
  .hn-sp-poster{width:300px}
  .hn-series-grid{grid-template-columns:1fr}
  .hn-duo{grid-template-columns:1fr}
  .hn-panel + .hn-panel{border-left:0;border-top:1px solid var(--line,rgba(244,244,242,.07))}
}
        .snv-hero-side{display:flex;flex-direction:column;align-items:flex-end;gap:10px;flex:0 0 auto;min-width:0}
        .snv-hero-side .snv-id-laser-wrap{margin-top:2px}

.hn-quick{gap:8px}
.hn-quick .hn-btn{min-height:36px;padding:7px 10px;font-size:11.5px;border-radius:10px;justify-content:center}
@media (max-width:767px){
  .hn-quick .hn-btn{min-height:32px;padding:6px 7px;font-size:9px}
          .snv-hero-side{width:100%;align-items:stretch;gap:8px}
  /* Bölüm Başlıkları */
  .hn-sec{gap:8px}
  .hn-sec-t{gap:7px;flex-wrap:wrap}
  .hn-sec-t h2{font-size:12.5px;letter-spacing:0}
  .hn-sec-t .ln{min-width:14px}
  .hn-idx{padding:2.5px 6px;font-size:8px;border-radius:5px;letter-spacing:.14em}
  .hn-more{padding:2px 0;font-size:8.5px;letter-spacing:.1em}

  /* Genel Mobil Butonlar */
  .hn-btn{padding:7px 10px;font-size:9px;letter-spacing:.05em;gap:4px;min-height:34px;border-radius:9px;justify-content:center}
  .hn-planned{padding:7px 10px;font-size:9px;letter-spacing:.05em;min-height:34px;border-radius:9px}
  .hn-action{min-height:32px;padding:6px 7px;font-size:8.5px;gap:4px}

  /* 01 · SİNEVİA KARTI — MOBİLDE TÜM VERİLER TAM VE OKUNAKLI */
  .snv-id-card{border-radius:18px}
  .snv-hero-top{
    padding:16px 14px 14px;
    gap:14px;
  }
  .snv-hero-identity{
    gap:14px;
    flex:1 1 100%;
  }
  .snv-crest-orb{width:76px;height:76px}
  .snv-crest-ring{width:76px;height:76px}
  .snv-crest-core{width:62px;height:62px}
  .snv-crest-lv{font-size:9px;padding:2px 9px;bottom:-4px}

  .snv-hero-titles{gap:4px}
  .snv-hero-badges{gap:6px}
  .snv-title-pill{font-size:9.5px;padding:3.5px 8px;border-radius:7px}
  .snv-code-btn{font-size:9.5px;padding:3.5px 8px;border-radius:7px}
  .snv-hero-name{font-size:24px;line-height:1.1}
  .snv-hero-sub{font-size:11.5px;line-height:1.35}

  .snv-hero-readouts{
    width:100%;
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:8px;
  }
  .snv-readout-box.is-streak{grid-column:1 / -1}
  .snv-readout-box{
    min-width:0;
    padding:9px 10px;
    border-radius:12px;
  }
  .snv-readout-box.is-coin{grid-column:auto}
  .snv-readout-top{font-size:8px;letter-spacing:.08em}
  .snv-readout-num b{font-size:20px}
  .snv-readout-num em{font-size:9px}
  .snv-readout-foot{font-size:8.5px}

  /* Mobil Orta Vitrin: Unvan Yolu & Aktif Rozet Alt Alta Kompakt */
  .snv-showcase-deck{
    grid-template-columns:1fr;
    gap:8px;
    padding:0 12px 12px;
  }
  .snv-deck-panel{
    padding:10px 12px;
    border-radius:13px;
    gap:8px;
    overflow:hidden;
  }
  .snv-deck-head{gap:6px;min-width:0}
  .snv-deck-title{font-size:9px;letter-spacing:.1em;min-width:0}
  .snv-deck-title svg{flex-shrink:0}
  .snv-deck-pill{font-size:8.5px;padding:2.5px 7px;max-width:100%;white-space:normal;line-height:1.25;text-align:center;overflow-wrap:anywhere}

  .snv-rank-road{gap:6px}
  .snv-rank-Endpoint{gap:6px}
  .snv-rank-pedestal{width:40px;height:40px;border-radius:11px;grid-template-columns:minmax(0,1fr);overflow:hidden}
  .snv-rank-pedestal > span{width:28px!important;height:28px!important}
  .snv-rank-pedestal svg{width:28px;height:28px;display:block}
  .snv-rank-info small{font-size:7.5px;letter-spacing:.06em}
  .snv-rank-info b{font-size:11.5px;line-height:1.15;overflow-wrap:anywhere}
  .snv-rank-info span{font-size:9px;overflow-wrap:anywhere}
  .snv-rank-arrow{width:22px;height:22px}
  .snv-rank-progress-labels{font-size:9px}
  .snv-rank-bar{height:5px}

  .snv-badge-body{gap:10px;min-width:0}
  .snv-badge-pedestal{width:46px;height:46px;border-radius:12px;grid-template-columns:minmax(0,1fr);overflow:hidden}
  .snv-badge-pedestal > span{width:34px!important;height:34px!important}
  .snv-badge-pedestal svg{width:34px;height:34px;display:block}
  .snv-badge-info b{font-size:13px;line-height:1.15;overflow-wrap:anywhere}
  .snv-badge-info p{font-size:10px;line-height:1.3;overflow-wrap:anywhere}
  .snv-badge-foot{font-size:9px;padding-top:6px;flex-wrap:wrap}

  /* Mobilde alt istatistik/kupa konsolu gizlenir */
  .snv-id-footer{display:none}

  /* Canlı Sayaç */
  .hn-timer{padding:10px 12px;gap:8px;border-radius:14px}
  .hn-timer-ic{width:32px;height:32px;border-radius:9px}
  .hn-timer-status{font-size:9.5px;letter-spacing:.1em}
  .hn-timer-sub{font-size:10.5px;margin-top:3px}
  .hn-timer-tx{flex:1 1 100%;min-width:0}
  .hn-timer-btns{margin-left:0;width:100%;gap:6px}
  .hn-timer-btns .hn-btn{flex:1;min-height:31px;padding:6px 8px;font-size:8.5px}
  .hn-timer-x{width:31px;height:31px;border-radius:8px;flex-shrink:0}

  /* 02 · GÜNÜN SİNEMA KARTI */
  .hn-spotlight{
    grid-template-columns:84px minmax(0,1fr);
    gap:10px;
    padding:11px;
    border-radius:14px;
    align-items:start;
    overflow:visible;
    position:relative;
    z-index:6;
  }
  .hn-sp-poster{
    width:84px;
    aspect-ratio:2/3;
    border-radius:9px;
    border:1px solid rgba(255,255,255,.14);
    margin:0;
  }
  .hn-filmbadge{display:none}
  .hn-rate{top:5px;right:5px;font-size:9px;padding:1.5px 5px;border-radius:5px}
  .hn-big-letter{font-size:40px}
  .hn-sp-body{display:contents}
  .hn-sp-head{grid-column:2;gap:4.5px;min-width:0}
  .hn-sp-kick{font-size:7.5px;letter-spacing:.12em}
  .hn-sp-body h2{font-size:15px;line-height:1.12;letter-spacing:-.02em}
  .hn-meta-chips{gap:3.5px}
  .hn-meta-chips span{font-size:7.5px;padding:2.5px 6px;letter-spacing:.03em}
  .hn-genre-row{gap:3.5px}
  .hn-genre{font-size:7px;padding:2.5px 6px;letter-spacing:.06em}
  .hn-gdesc{
    grid-column:1 / -1;
    font-size:11px;
    line-height:1.45;
    display:-webkit-box;
    -webkit-line-clamp:2;
    -webkit-box-orient:vertical;
    overflow:hidden;
  }
  .hn-btnrow{
    grid-column:1 / -1;
    position:relative;
    display:flex;
    gap:5px;
    padding-top:2px;
    margin-top:0;
  }
  .hn-btnrow .hn-btn,
  .hn-btnrow .hn-planned{
    flex:1 1 0%;
    padding:6px 8px;
    font-size:8.5px;
    min-height:30px;
    border-radius:8px;
    letter-spacing:.04em;
    justify-content:center;
    width:auto;
  }
  .hn-sp-extra{display:none !important}
  .hn-sp-more{display:inline-flex !important}
  .hn-sp-more-menu{
    position:absolute;
    right:0;
    top:calc(100% + 6px);
    z-index:30;
    display:flex;
    flex-direction:column;
    gap:3px;
    min-width:190px;
    max-width:74vw;
    padding:6px;
    border-radius:12px;
    border:1px solid rgba(255,255,255,.12);
    background:rgba(9,9,12,.97);
    box-shadow:0 18px 40px rgba(0,0,0,.6);
    backdrop-filter:blur(10px);
  }
  .hn-sp-more-menu .hn-btn,
  .hn-sp-more-menu .hn-sp-more-item{
    justify-content:flex-start;
    width:100%;
    flex:none;
    font-size:8.5px;
    min-height:32px;
    padding:6px 9px;
    border-radius:8px;
    letter-spacing:.04em;
  }
  .hn-sp-more-menu .hn-sp-more-item{display:inline-flex;align-items:center;gap:7px;color:var(--muted,#9a9a96);background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.12)}
  .hn-links{display:none !important}
  .hn-link-chip{font-size:7.5px;padding:3.5px 7px;letter-spacing:.04em;gap:4px}
  .hn-link-logo{width:10px;height:10px}

  /* 03 · Diziler */
  .hn-scard{padding:10px;gap:10px;border-radius:14px}
  .hn-sposter{width:62px;border-radius:9px}
  .hn-ep{font-size:7.5px;padding:2.5px 6px;margin:5px;border-radius:5px}
  .hn-sinfo h4{font-size:12px}
  .hn-next-ep{font-size:8px;padding:3px 7px;margin-top:4px}
  .hn-prog-lab{font-size:8px;margin-top:8px}
  .hn-prog{height:6px;margin-top:4px}
  .hn-rate-btn{margin-top:8px;padding:6.5px;font-size:8.5px;border-radius:8px;letter-spacing:.08em}

  /* 04 · Rozetler + Ağ */
  .hn-duo{border-radius:14px}
  .hn-panel{padding:13px 12px}
  .hn-panel h3{font-size:12px;margin-bottom:10px;gap:6px}
  .hn-di{width:7px;height:7px}
  .hn-ach{padding:10px;margin-bottom:8px;border-radius:11px}
  .hn-ach .top{gap:9px}
  .hn-ai{width:32px;height:32px;border-radius:9px}
  .hn-an b{font-size:11px}
  .hn-an span{font-size:9.5px}
  .hn-axp{font-size:8.5px;padding:3px 7px}
  .hn-pl{font-size:8px;margin-top:8px}
  .hn-pt{height:6px;margin-top:4px}
  .hn-net-note{font-size:10.5px;line-height:1.5;padding:8px 10px;margin-bottom:10px;border-radius:10px}
  .hn-agents{gap:7px}
  .hn-agent{padding:8px 9px;gap:9px;border-radius:11px}
  .hn-agent-poster{width:36px;border-radius:6px}
  .hn-agent-avatar-mini{width:15px;height:15px;font-size:8px}
  .hn-agent-who b{font-size:9.5px}
  .hn-agent-who span{font-size:8.5px}
  .hn-agent-title{font-size:11px}
  .hn-agent-time{font-size:8px}
  .hn-st{font-size:8px;padding:3.5px 7px}
  .hn-net-more{padding:8.5px;font-size:8.5px;border-radius:9px;letter-spacing:.08em}

  /* 05 · Son İzlenenler */
  .hp-recent{grid-template-columns:repeat(2,1fr);gap:8px}
  .hp-rec{border-radius:13px}
  .hp-rec-tx{padding:8px 9px 9px}
  .hp-rec-tx b{font-size:10.5px}
  .hp-rec-tx span{font-size:8px;margin-top:2px}
  .hp-rec-ph b{font-size:32px}
  .hp-rec-kind{top:6px;left:6px;font-size:6.5px;padding:2.5px 6px}
  .hp-rec-rate{top:6px;right:6px;font-size:8.5px;padding:2.5px 6px}

  /* Bento */
  .hn-bento-card{padding:13px 12px;border-radius:14px}
  .hn-bento-title{font-size:17px;margin-top:7px}
  .hn-bento-ic{width:32px;height:32px;border-radius:9px;margin-bottom:8px}
  .hn-bento-card h4{font-size:12px;margin-bottom:4px}
  .hn-bento-card p{font-size:10.5px;line-height:1.5}
  .hn-bento-badge{font-size:7.5px;padding:4px 9px;letter-spacing:.1em}
}
@media (prefers-reduced-motion:reduce){
  .hn-agents-loading{animation:none}
}
`;

// Canlı Kademe Renkleri
const TIER_INK: Record<string, string> = {
  bronze: '#FF7A2F', silver: '#E2E8F0', gold: '#FFC800', platinum: '#A5F3FC', emerald: '#00E676', diamond: '#00D2FF',
};

const RARITY_TR: Record<string, string> = {
  common: 'Yaygın',
  rare: 'Nadir',
  epic: 'Destansı',
  legendary: 'Efsanevi',
  mythic: 'Gizli Boss',
};

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'Az önce';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} dk önce`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} saat önce`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} gün önce`;
  return date.toLocaleDateString('tr-TR');
}

export default function HomePage() {
  const {
    data, startWatchingMovie, togglePauseWatchingMovie,
    cancelWatchingMovie, canRateMovieWithTimer, watchMovie, watchEpisode, showToast
  } = useApp();

  const { questState, activeContract, activeContractProgress, activeContractRemaining } = useQuests();

  const [showBulkAdd, setShowBulkAdd] = useState<'movie' | 'tv' | false>(false);
  const [showPick, setShowPick] = useState(false);
  const [showDnaModal, setShowDnaModal] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [spotlightOffset, setSpotlightOffset] = useState(0);
  const [spotlightMoreOpen, setSpotlightMoreOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<DetailModalTarget | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [networkFeed, setNetworkFeed] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
  const [networkLoading, setNetworkLoading] = useState(true);

  const [pickedItem, setPickedItem] = useState<
    | { kind: 'movie'; movie: Movie }
    | { kind: 'series'; series: Series; episode: Episode }
    | null
  >(null);

  const activeTimerMovie = useMemo(() => data.movies.find((m) => !m.watched && m.startedAt) || null, [data.movies]);

  useEffect(() => {
    if (!activeTimerMovie) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimerMovie]);

  const fetchNetworkFeed = useCallback(async () => {
    if (!data.agentId) { setNetworkLoading(false); return; }
    try {
      const { data: fData } = await supabase.from('friendships').select(FRIENDSHIP_COLUMNS).or(`requester_id.eq.${data.agentId},receiver_id.eq.${data.agentId}`).eq('status', 'accepted');
      if (!fData || fData.length === 0) { setNetworkFeed([]); setNetworkLoading(false); return; }
      
      const friendIds = fData.map(f => f.requester_id === data.agentId ? f.receiver_id : f.requester_id);
      
      const { data: pData } = await supabase.from('profiles').select(PROFILE_PUBLIC_COLUMNS).in('agent_id', friendIds).returns<any[]>();
      const pMap: Record<string, any> = {};
      (pData || []).forEach(p => pMap[p.agent_id] = p);
      setProfilesMap(pMap);

      const { data: logsData } = await supabase.from('network_logs').select(NETWORK_LOG_COLUMNS).in('agent_id', friendIds).order('created_at', { ascending: false }).limit(12);
      setNetworkFeed((logsData || []).filter((l: any) => l.action_type !== 'watched_hidden').slice(0, 6));
    } catch (err) {
      console.error(err);
    } finally {
      setNetworkLoading(false);
    }
  }, [data.agentId]);

  useEffect(() => {
    fetchNetworkFeed();
  }, [fetchNetworkFeed]);

  const handleRequestRateMovie = (movie: Movie) => {
    if (!canRateMovieWithTimer(movie.id)) return;
    setPickedItem({ kind: 'movie', movie });
  };

  const pastColIds = useMemo(
    () =>
      new Set(
        data.collections
          .filter((c) => normalize(c.name) === normalize(PAST_WATCH_COLLECTION_NAME))
          .map((c) => c.id)
      ),
    [data.collections]
  );

  const plannedMovieIds = useMemo(() => {
    const ids = new Set<string>();
    (data.weeklyPlan || []).forEach(p => ids.add(p.movieId));
    return ids;
  }, [data.weeklyPlan]);

  const eligibleMovies = useMemo(() => {
    const unwatched = data.movies.filter(
      (m) => !m.watched && (!m.collectionId || !pastColIds.has(m.collectionId)) && !plannedMovieIds.has(m.id)
    );
    const standalone = unwatched.filter((m) => !m.collectionId);
    const collectionGroups = new Map<string, Movie[]>();
    unwatched.filter((m) => m.collectionId).forEach((m) => {
      const arr = collectionGroups.get(m.collectionId!) || [];
      arr.push(m);
      collectionGroups.set(m.collectionId!, arr);
    });
    const sequentialCollectionMovies: Movie[] = [];
    collectionGroups.forEach((movies) => {
      const sorted = [...movies].sort((a, b) => (a.year || '9999').localeCompare(b.year || '9999'));
      if (sorted.length > 0) sequentialCollectionMovies.push(sorted[0]);
    });
    return [...standalone, ...sequentialCollectionMovies];
  }, [data.movies, pastColIds, plannedMovieIds]);

  const allNextEpisodes = useMemo(() => {
    return data.series
      .map((s) => {
        const next = getNextUnwatchedEpisode(s.episodes);
        if (!next) return null;
        const watchedCount = s.episodes.filter((e) => e.watched).length;
        const totalCount = s.episodes.length;
        const pct = totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0;
        return { series: s, episode: next, watchedCount, totalCount, pct };
      })
      .filter((x): x is { series: Series; episode: Episode; watchedCount: number; totalCount: number; pct: number } => x !== null);
  }, [data.series]);

  const ongoingSeries = useMemo(() => {
    return allNextEpisodes.filter((x) => x.watchedCount > 0);
  }, [allNextEpisodes]);

  const spotlightMovie = useMemo(() => {
    if (eligibleMovies.length === 0) return null;
    const dateSeed = todayStr().split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const idx = (dateSeed + spotlightOffset) % eligibleMovies.length;
    return eligibleMovies[idx];
  }, [eligibleMovies, spotlightOffset]);

  const isSpotlightPlanned = useMemo(() => {
    if (!spotlightMovie) return false;
    return (data.weeklyPlan || []).some(p => p.movieId === spotlightMovie.id);
  }, [spotlightMovie, data.weeklyPlan]);

  const quickMetrics = useMemo(() => {
    const watchedMoviesCount = data.movies.filter((m) => m.watched && !m.isPastWatch).length;
    const watchedEpsCount = data.series.reduce((sum, s) => sum + s.episodes.filter((e) => e.watched).length, 0);
    const unlockedAchievementsCount = data.achievements.reduce((acc, curr) => acc + (curr.unlockedTiers?.length || 0), 0);

    let questsCompleted = 0;
    try { 
      const qsRaw = localStorage.getItem('sinevia-quests-v1');
      if (qsRaw) {
         const qs = JSON.parse(qsRaw);
         questsCompleted = (qs.completedQuests && Array.isArray(qs.completedQuests)) ? qs.completedQuests.length : 0; 
      }
    } catch (e) { console.warn(e); }

    const tierCounts = { bronze: 0, silver: 0, gold: 0, platinum: 0, emerald: 0, diamond: 0, secret: 0, total: 0 };
    (data.achievements || []).forEach((a) => {
      (a.unlockedTiers || []).forEach((t) => {
        if (t in tierCounts) (tierCounts as any)[t]++;
        tierCounts.total++;
      });
    });

    const regularHistoryCount = data.history.filter((h) => !h.isPastWatch).length;

    return { tierCounts, watchedMoviesCount, watchedEpsCount, unlockedAchievementsCount, questsCompleted, regularHistoryCount };
  }, [data.movies, data.series, data.history, data.achievements]);

  const closestAchievements = useMemo(() => {
    const progMap = new Map((data.achievements || []).map((a) => [a.achievementId, a]));
    const candidates: { id: string; name: string; desc: string; achievementId: string; tier: string; current: number; target: number; pct: number; xp: number }[] = [];

    ACHIEVEMENT_DEFS.forEach((def: any) => {
      if (def.secret && !data.showLockedNames) return;
      const prog = progMap.get(def.id);
      const unlocked = prog?.unlockedTiers || [];
      const current = prog?.current || 0;
      const nextTier = def.tiers.find((t: any) => !unlocked.includes(t.tier));
      if (!nextTier || nextTier.threshold <= 0) return;

      const pct = Math.min(99, Math.floor((current / nextTier.threshold) * 100));
      if (current > 0 && pct >= 15) {
        candidates.push({
          id: `${def.id}_${nextTier.tier}`,
          name: nextTier.name || def.name,
          desc: def.description.replace('{threshold}', String(nextTier.threshold)),
          achievementId: def.id, tier: nextTier.tier, current, target: nextTier.threshold, pct, xp: nextTier.xp,
        });
      }
    });

    return candidates.sort((a, b) => b.pct - a.pct).slice(0, 3);
  }, [data.achievements, data.showLockedNames]);

  const recentWatched = useMemo(() => {
    return [...(data.history || [])]
      .filter((h) => !h.isPastWatch)
      .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
      .slice(0, 5)
      .map((h) => {
        const isMovie = h.kind === 'movie' || h.type === 'movie';
        const posterUrl = isMovie
          ? data.movies.find((m) => m.id === (h.itemId || h.id))?.posterUrl
          : data.series.find((s) => s.id === (h.seriesId || h.itemId || h.id))?.posterUrl;
        return { h, isMovie, posterUrl: posterUrl || null };
      });
  }, [data.history, data.movies, data.series]);

  const [posterErrors, setPosterErrors] = useState<Record<string, boolean>>({});

  // Sinevia Ağı için poster çözücü
  const resolveNetworkPoster = useCallback((log: any): string | null => {
    if (log?.item_poster) return log.item_poster;
    if (log?.poster_url) return log.poster_url;
    const normTitle = normalize(log?.item_title || '');
    if (!normTitle) return null;
    const matchedMovie = data.movies.find((m) => normalize(m.title) === normTitle && m.posterUrl);
    if (matchedMovie?.posterUrl) return matchedMovie.posterUrl;
    const matchedSeries = data.series.find((s) => normalize(s.title) === normTitle && s.posterUrl);
    return matchedSeries?.posterUrl || null;
  }, [data.movies, data.series]);

  const lvl = levelFromXp(data.totalXp);
  const currentRankIndex = useMemo(() => {
    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
      if (lvl.level >= RANK_TIERS[i].minLevel) return i;
    }
    return 0;
  }, [lvl.level]);

  const userPersona = RANK_TIERS[currentRankIndex];
  const equippedFrame = data.equipped?.frameId ? MARKET_ITEM_MAP.get(data.equipped.frameId) : null;
  const equippedTitle = data.equipped?.titleId ? MARKET_ITEM_MAP.get(data.equipped.titleId) : null;
  const equippedBadge = data.equipped?.badgeId ? MARKET_ITEM_MAP.get(data.equipped.badgeId) : null;
  const equippedBadge2 = data.equipped?.badgeId2 ? MARKET_ITEM_MAP.get(data.equipped.badgeId2) : null;
  const equippedBackground = data.equipped?.backgroundId
    ? MARKET_ITEM_MAP.get(data.equipped.backgroundId)
    : null;
  const equippedNameEffect = data.equipped?.nameEffectId
    ? MARKET_ITEM_MAP.get(data.equipped.nameEffectId)
    : null;
  const nextRank = RANK_TIERS[currentRankIndex + 1] || null;
  const CurrentRankIcon = userPersona.icon;
  const NextRankIcon = nextRank ? nextRank.icon : Crown;

  const xpToNext = Math.max(0, lvl.nextLevelXp - lvl.currentLevelXp);

  const rankProgressPct = useMemo(() => {
    if (!nextRank) return 100;
    const span = Math.max(1, nextRank.minLevel - userPersona.minLevel);
    const done = lvl.level - userPersona.minLevel + (lvl.progress / 100);
    return Math.min(100, Math.max(6, Math.round((done / span) * 100)));
  }, [nextRank, userPersona.minLevel, lvl.level, lvl.progress]);

  const circleRadius = 51;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleOffset = circleCircumference - (Math.min(100, Math.max(0, lvl.progress)) / 100) * circleCircumference;

  const navigateTo = (tabId: string) => {
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: tabId }));
  };

  const openMarketInventory = () => {
    window.dispatchEvent(new CustomEvent('sinevia-open-market-tab', { detail: 'inventory' }));
    navigateTo('market');
  };

  const goToAchievements = (action: 'trophies' | 'quests' | 'titles') => {
    try { sessionStorage.setItem('sinevia_search_action', action); } catch { /* depolama kapalıysa yok say */ }
    window.dispatchEvent(new Event('sinevia-search-action'));
    navigateTo('achievements');
  };

  const getMovieWatchLinks = (movie: Movie) => {
    const links: { href: string; text: string; logo: string | null; icon: any; isTrailer?: boolean }[] = [];
    const trailerQuery = encodeURIComponent(`${movie.title} ${movie.year || ''} official trailer fragman`);
    links.push({ href: `https://www.youtube.com/results?search_query=${trailerQuery}`, text: 'Fragman', logo: null, icon: Youtube, isTrailer: true });

    if (movie.customUrl) links.push({ href: movie.customUrl, text: 'Özel Kaynak', logo: null, icon: ExternalLink });

    if (movie.watchProviders && movie.watchProviders.length > 0) {
      movie.watchProviders.slice(0, 2).forEach((provider) => {
        let finalHref = provider.link || '';
        const pName = provider.providerName.toLowerCase();
        if (pName.includes('netflix')) finalHref = `https://www.netflix.com/search?q=${encodeURIComponent(movie.title)}`;
        else if (pName.includes('amazon') || pName.includes('prime')) finalHref = `https://www.primevideo.com/search/ref=atv_sr_sug_1?phrase=${encodeURIComponent(movie.title)}`;
        else if (pName.includes('disney')) finalHref = `https://www.disneyplus.com/search?q=${encodeURIComponent(movie.title)}`;
        else if (pName.includes('blutv')) finalHref = `https://www.blutv.com/arama?q=${encodeURIComponent(movie.title)}`;
        else if (pName.includes('mubi')) finalHref = `https://mubi.com/tr/search?query=${encodeURIComponent(movie.title)}`;
        else if (pName.includes('apple')) finalHref = `https://tv.apple.com/tr/search?q=${encodeURIComponent(movie.title)}`;
        links.push({ href: finalHref, text: provider.providerName, logo: provider.logoUrl, icon: PlayCircle });
      });
    }

    const searchQuery = encodeURIComponent(`${movie.title} ${movie.year || ''} İzle`);
    links.push({ href: `https://www.google.com/search?q=${searchQuery}`, text: "Google'da Bul", logo: null, icon: Search });

    if (data.altWatchTemplate && (movie.imdbId || data.altWatchTemplate.includes('{slug}') || data.altWatchTemplate.includes('{title}'))) {
      const charMap: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
      const slug = movie.title.toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, (match) => charMap[match]).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const finalAltHref = data.altWatchTemplate.replace('{imdb}', movie.imdbId || '').replace('{slug}', slug).replace('{title}', encodeURIComponent(movie.title)).replace('{year}', movie.year || '');
      links.push({ href: finalAltHref, text: 'İzle', logo: null, icon: PlayCircle });
    }
    return links;
  };

  const openHistoryItemDetail = (h: WatchHistoryItem) => {
    if (h.kind === 'movie' || h.type === 'movie') {
      const found = data.movies.find((m) => m.id === (h.itemId || h.id));
      const fallback: Movie = found || {
        id: h.itemId || h.id, title: h.title, year: h.year || '', genres: h.genres || [], collectionId: null,
        watched: true, isPastWatch: h.isPastWatch, rating: h.rating, detailedRating: h.detailedRating, reviewTags: h.reviewTags, note: h.note, watchedAt: h.watchedAt, addedAt: h.watchedAt,
      };
      setDetailTarget({ type: 'movie', data: fallback, historyItem: h });
    } else {
      const sid = h.seriesId || h.itemId || h.id;
      const found = data.series.find((s) => s.id === sid);
      const fallback: Series = found || { id: sid, title: h.title, year: h.year, genres: h.genres || [], episodes: [], addedAt: h.watchedAt };
      setDetailTarget({ type: 'series', data: fallback, historyItem: h });
    }
  };

  const activeBadgeDef = questState.activeBadgeId ? QUEST_DEFS.find(q => q.id === questState.activeBadgeId) : null;

  let sectionCounter = 0;
  const nextSectionIdx = () => String(++sectionCounter).padStart(2, '0');

  return (
    <div className="space-y-3.5 sm:space-y-8 animate-fade-in pb-6 sm:pb-10 max-w-[1400px] mx-auto">
      <style>{HOME_PREMIUM_CSS}</style>

      {/* =========================================================
          01 · SİNEVİA KARTI (GENİŞLETİLMİŞ GRAND COMMAND DECK)
          ========================================================= */}
      <section className="hn-sec">
        <div className="hn-sec-t">
          <span className="hn-idx">{nextSectionIdx()}</span>
          <h2>Sinevia Kartı</h2>
          <span className="ln" />
          <button type="button" className="hn-more" onClick={() => navigateTo('achievements')}>
            Başarımlar <ChevronRight size={13} />
          </button>
        </div>

        <div className="snv-id-card" data-tutorial="home-hero">
          {equippedBackground && (
            <div
              className={`pointer-events-none absolute inset-0 rounded-[inherit] opacity-70 ${equippedBackground.backgroundClass || ''}`}
              aria-hidden="true"
            />
          )}
          <div className="snv-id-overlay" aria-hidden="true" />

          {/* 1. ÜST KİMLİK & BÜYÜK DENEYİM / SERİ GÖSTERGELERİ */}
          <div className="snv-hero-top">
            <div className="snv-hero-identity">
              <div className={`snv-crest-orb ${equippedFrame?.frameClass || ''}`}>
                <svg className="snv-crest-ring" viewBox="0 0 112 112" aria-hidden="true">
                  <circle cx="56" cy="56" r={circleRadius} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3.5" />
                  <circle
                    cx="56"
                    cy="56"
                    r={circleRadius}
                    fill="none"
                    stroke={userPersona.strokeColor}
                    strokeWidth="3.5"
                    strokeDasharray={circleCircumference}
                    strokeDashoffset={circleOffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="snv-crest-core">
                  <CurrentRankIcon size={62} />
                </div>
                <span className="snv-crest-lv">SV.{lvl.level}</span>
              </div>

              <div className="snv-hero-titles">
                <div className="snv-hero-badges">
                  <button
                    type="button"
                    className="snv-title-pill"
                    title="Unvan Kütüğünü Aç"
                    onClick={() => goToAchievements('titles')}
                  >
                    <Crown size={12} /> {equippedTitle?.titleText || userPersona.title}
                  </button>
                  {equippedBadge?.badgeText && (
                    <span className="snv-title-pill" title={equippedBadge.name}>
                      <Sparkles size={12} /> {equippedBadge.badgeText}
                    </span>
                  )}
                  {equippedBadge2?.badgeText && (
                    <span className="snv-title-pill" title={equippedBadge2.name}>
                      <Sparkles size={12} /> {equippedBadge2.badgeText}
                    </span>
                  )}
                  <button
                    type="button"
                    className="snv-code-btn"
                    title="Ajan kodunu kopyala"
                    onClick={() => {
                      navigator.clipboard.writeText(data.agentId || '');
                      showToast('Kod kopyalandı!', 'success');
                    }}
                  >
                    {data.agentId} <Copy size={11} />
                  </button>
                </div>

                <h1 className={`snv-hero-name ${equippedNameEffect?.nameEffectClass || ''}`}>
                  {data.nickname}
                </h1>
                <div className="snv-hero-sub">{userPersona.subtitle}</div>
              </div>
            </div>

            <div className="snv-hero-side">
              <div className="snv-hero-readouts">
                {/* Günlük Seri Kutusu */}
                <div className="snv-readout-box is-streak" data-tutorial="home-streak">
                  <div className="snv-readout-top">
                    <span className="inline-flex items-center gap-1.5">
                      <Flame size={12} className="flame" /> Günlük Seri
                    </span>
                  </div>
                  <div className="snv-readout-num">
                    <b>{data.dailyStreak || 0}</b>
                    <em className="warm">Gün</em>
                  </div>
                  <div className="snv-readout-foot">
                    {data.dailyStreak > 0 ? 'Seri aktif devam ediyor' : 'Bugün izle, seri başlat'}
                  </div>
                </div>

                {/* Toplam Deneyim Kutusu */}
                <div className="snv-readout-box">
                  <div className="snv-readout-top">
                    <span>Deneyim Puanı</span>
                    <span className="xp-pct">%{Math.floor(lvl.progress)}</span>
                  </div>
                  <div className="snv-readout-num">
                    <b>{(data.totalXp || 0).toLocaleString('tr-TR')}</b>
                    <em>XP</em>
                  </div>
                  <div className="snv-readout-foot">
                    Sv.{lvl.level + 1} için {xpToNext.toLocaleString('tr-TR')} XP kaldı
                  </div>
                </div>

                {/* SineCoin Bakiyesi — tıklayınca envanter */}
                <button type="button" className="snv-readout-box is-coin" onClick={openMarketInventory}>
                  <div className="snv-readout-top">
                    <span className="inline-flex items-center gap-1.5">
                      <SineCoinIcon className="h-3.5 w-3.5" /> SineCoin
                    </span>
                    <span className="snv-coin-arrow">→</span>
                  </div>
                  <div className="snv-readout-num">
                    <b>{(data.coins || 0).toLocaleString('tr-TR')}</b>
                    <em>SC</em>
                  </div>
                  <div className="snv-readout-foot">Envanteri Aç</div>
                </button>
              </div>

              <div className="snv-id-laser-wrap" title={`Seviye İlerlemesi: %${Math.floor(lvl.progress)}`}>
                <div className="snv-id-laser-fill" style={{ width: `${Math.max(2, lvl.progress)}%` }} />
              </div>
            </div>
          </div>

          {/* 2. ORTA PRESTİJ VİTRİNİ: UNVAN EVRİM SAHNESİ & AKTİF GÖREV ARMASI */}
          <div className="snv-showcase-deck">
            {/* Sol Vitrin: Unvan Yolu & Rütbe Evrimi */}
            <button
              type="button"
              className="snv-deck-panel"
              onClick={() => goToAchievements('titles')}
              title="Unvan Yolu ve Rütbe İlerlemesini Gör"
            >
              <div className="snv-deck-head">
                <span className="snv-deck-title">
                  <Crown size={13} /> Unvan Evrim Yolu
                </span>
                <span className="snv-deck-pill">
                  {nextRank
                    ? `Hedef: Seviye ${nextRank.minLevel} (${nextRank.minLevel - lvl.level} Seviye Kaldı)`
                    : 'Maksimum Unvan Kademesi'}
                </span>
              </div>

              {nextRank ? (
                <div className="snv-rank-road">
                  <div className="snv-rank-Endpoint">
                    <div className="snv-rank-pedestal">
                      <CurrentRankIcon size={44} />
                    </div>
                    <div className="snv-rank-info">
                      <small>Mevcut Unvan</small>
                      <b>{userPersona.title}</b>
                      <span>Sv. {userPersona.minLevel}–{userPersona.maxLevel}</span>
                    </div>
                  </div>

                  <div className="snv-rank-arrow">
                    <ChevronRight size={16} />
                  </div>

                  <div className="snv-rank-Endpoint target">
                    <div className="snv-rank-info">
                      <small>Sıradaki Unvan</small>
                      <b>{nextRank.title}</b>
                      <span>Sv. {nextRank.minLevel}+</span>
                    </div>
                    <div className="snv-rank-pedestal">
                      <NextRankIcon size={44} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="snv-rank-road">
                  <div className="snv-rank-Endpoint">
                    <div className="snv-rank-pedestal">
                      <CurrentRankIcon size={48} />
                    </div>
                    <div className="snv-rank-info">
                      <small>Ebedi Zirve Unvanı</small>
                      <b>{userPersona.title}</b>
                      <span>{userPersona.subtitle}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="snv-rank-progress-wrap">
                <div className="snv-rank-progress-labels">
                  <span>Unvan Tamamlanma Oranı</span>
                  <b>%{rankProgressPct}</b>
                </div>
                <div className="snv-rank-bar">
                  <i style={{ width: `${rankProgressPct}%` }} />
                </div>
              </div>
            </button>

            {/* Sağ Vitrin: Kuşanılan Özel Görev Arması */}
            <button
              type="button"
              className="snv-deck-panel"
              onClick={() => goToAchievements('quests')}
              title={
                activeBadgeDef
                  ? `${activeBadgeDef.title} armasını değiştirmek için tıkla`
                  : 'Koleksiyonundan özel bir görev arması kuşan'
              }
            >
              <div className="snv-deck-head">
                <span className="snv-deck-title rose">
                  <ShieldAlert size={13} /> Kuşanılan Görev Arması
                </span>
                <span className="snv-deck-pill">
                  {activeBadgeDef
                    ? `${RARITY_TR[activeBadgeDef.rarity] || activeBadgeDef.rarity} Kademe`
                    : `${quickMetrics.questsCompleted} / ${QUEST_DEFS.length} Açıldı`}
                </span>
              </div>

              <div className="snv-badge-body">
                <div className={`snv-badge-pedestal${activeBadgeDef ? '' : ' empty'}`}>
                  {activeBadgeDef ? (
                    <QuestIcon questId={activeBadgeDef.id} size={46} />
                  ) : (
                    <ShieldAlert size={28} />
                  )}
                </div>

                <div className="snv-badge-info">
                  <b>{activeBadgeDef ? activeBadgeDef.title : 'Henüz Bir Arma Kuşanmadın'}</b>
                  <p>
                    {activeBadgeDef
                      ? activeBadgeDef.description
                      : 'Görev Panosundaki kontratları tamamlayarak özel tasarım armalar kazanabilir ve burada sergileyebilirsin.'}
                  </p>
                </div>
              </div>

              <div className="snv-badge-foot">
                <span>
                  {activeBadgeDef ? 'Değiştirmek için vitrine git' : 'Arma seçmek için tıkla'}
                </span>
                <strong>
                  {activeBadgeDef
                    ? `+${activeBadgeDef.xpReward} XP Kontrat Ödülü`
                    : `${quickMetrics.questsCompleted} Kontrat Tamamlandı`}
                </strong>
              </div>
            </button>
          </div>

          {/* 4. ALT KONSOL: 5'Lİ KARİYER METRİĞİ & 6'LI KUPA KADEMELERİ */}
          <div className="snv-id-footer">
            <div className="snv-id-metrics">
              <div className="snv-id-mitem"><b>{quickMetrics.watchedMoviesCount}</b><span>Film</span></div>
              <div className="snv-id-mitem"><b>{data.series.filter(s => s.episodes?.every(e => e.watched)).length}</b><span>Dizi</span></div>
              <div className="snv-id-mitem"><b>{quickMetrics.watchedEpsCount}</b><span>Bölüm</span></div>
              <div className="snv-id-mitem"><b>{quickMetrics.unlockedAchievementsCount}</b><span>Kupa</span></div>
              <div className="snv-id-mitem"><b>{quickMetrics.questsCompleted}</b><span>Kontrat</span></div>
            </div>

            <div className="snv-id-tiers">
              {([
                ['bronze', 'Bronz', quickMetrics.tierCounts.bronze],
                ['silver', 'Gümüş', quickMetrics.tierCounts.silver],
                ['gold', 'Altın', quickMetrics.tierCounts.gold],
                ['platinum', 'Platin', quickMetrics.tierCounts.platinum],
                ['emerald', 'Zümrüt', quickMetrics.tierCounts.emerald],
                ['diamond', 'Elmas', quickMetrics.tierCounts.diamond],
              ] as const).map(([tier, label, count]) => (
                <button
                  key={tier}
                  type="button"
                  className="snv-id-tier"
                  onClick={() => navigateTo('achievements')}
                  title={`${label} kademesi kupalar`}
                >
                  <div className="snv-id-tier-top">
                    <i style={{ background: TIER_INK[tier], boxShadow: `0 0 8px ${TIER_INK[tier]}` }} />
                    <b>{count}</b>
                  </div>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HIZLI AKSİYONLAR */}
      <div data-tutorial="home-actions" className="hn-quick grid grid-cols-2 sm:grid-cols-4">
        <button type="button" className="hn-btn hn-btn-p hn-action" onClick={() => setShowPick(true)}>
          <Shuffle size={13} /> Ne İzlesem
        </button>
        <button type="button" className="hn-btn hn-btn-s hn-action" onClick={() => setShowDnaModal(true)}>
          <Dna size={13} /> DNA Sentezle
        </button>
        <button type="button" className="hn-btn hn-btn-s hn-action" onClick={() => setShowBulkAdd('movie')}>
          <Clapperboard size={13} /> Katalog
        </button>
        <button type="button" className="hn-btn hn-btn-s hn-action" onClick={() => setShowCalibration(true)}>
          <Swords size={13} /> Düelloya Başla
        </button>
      </div>

      {/* ==============================
          PAZAR GÖREVLERİ
          ============================== */}
      <section className="hn-sec">
        <div className="hn-sec-t">
          <span className="hn-idx">{nextSectionIdx()}</span>
          <h2>Pazar Görevleri</h2>
          <span className="ln" />
          <button type="button" className="hn-more" onClick={() => navigateTo('market')}>
            Pazara Git <ChevronRight size={13} />
          </button>
        </div>

        <div className="pazar-card relative overflow-hidden rounded-xl border border-gold-500/25 bg-gradient-to-br from-[#191307] via-ink-900 to-[#0b0b12] p-2.5 shadow-[0_14px_38px_-26px_rgba(245,158,11,0.5)] sm:rounded-3xl sm:p-4">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gold-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" />

          <div className="relative grid gap-2 sm:gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <div className="mb-1.5 sm:mb-2 flex flex-wrap items-center gap-1 sm:gap-1.5">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[8.5px] font-black uppercase tracking-[0.16em] ${
                  activeContract
                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-gold-400/30 bg-gold-500/10 text-gold-300'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${activeContract ? 'animate-pulse bg-emerald-400' : 'bg-gold-400'}`} />
                  {activeContract ? 'Aktif Görev' : 'Yeni Fırsatlar'}
                </span>
                {activeContract && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold text-ink-200">
                    <Timer size={10} /> {activeContractRemaining}
                  </span>
                )}
              </div>

              {activeContract ? (() => {
                const def = CONTRACT_MAP.get(activeContract.contractId);
                const percent = activeContractProgress?.percent || 0;
                return (
                  <div>
                    <div className="flex items-start gap-2 sm:gap-2.5">
                      <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border border-gold-400/25 bg-gold-500/10 text-sm sm:text-base shadow-inner">
                        {def?.icon || '🎯'}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-[12px] sm:text-[13px] font-black text-white">{def?.title || 'Aktif Pazar Görevi'}</h3>
                        <p className="mt-0.5 line-clamp-1 text-[9.5px] sm:text-[10px] text-ink-400">{def?.description}</p>
                      </div>
                    </div>

                    {def && (
                      <div className="mt-2 flex flex-wrap items-center gap-1 sm:mt-3 sm:gap-1.5">
                        <span className="rounded-md sm:rounded-lg border border-azure-400/25 bg-azure-500/10 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[9px] sm:text-[10px] font-black text-azure-300">
                          +{def.xpReward} XP
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md sm:rounded-lg border border-gold-400/30 bg-gold-500/10 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[9px] sm:text-[10px] font-black text-gold-200">
                          <SineCoinIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> +{def.coinReward} SC
                        </span>
                        <span className="rounded-md sm:rounded-lg border border-rose-400/20 bg-rose-500/10 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[9px] sm:text-[10px] font-bold text-rose-300">
                          −{CONTRACT_FAILURE_PENALTY[def.rarity]} SC ceza
                        </span>
                      </div>
                    )}

                    <div className="mt-2 sm:mt-3.5">
                      <div className="mb-1 sm:mb-1.5 flex items-center justify-between text-[8px] sm:text-[9px] font-black uppercase tracking-[0.16em] text-ink-400">
                        <span>İlerleme</span>
                        <span className="text-gold-300">%{percent}</span>
                      </div>
                      <div className="h-1.5 sm:h-2.5 overflow-hidden rounded-full border border-white/5 bg-black/40">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 via-gold-400 to-yellow-200 shadow-[0_0_12px_rgba(245,158,11,0.65)] transition-all duration-500"
                          style={{ width: `${Math.max(percent, 2)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[9px] sm:mt-2.5 sm:gap-x-3 sm:gap-y-1.5 sm:text-[10px] text-ink-300">
                      {(activeContractProgress?.requirements || []).map((req) => (
                        <span key={req.metric} className={`rounded-md border px-1.5 py-0.5 ${req.met ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300' : 'border-white/5 bg-white/[0.03]'}`}>
                          {METRIC_LABELS[req.metric]}: {Math.min(req.current, req.target)}/{req.target}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })() : (
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg sm:rounded-2xl border border-gold-400/30 bg-gradient-to-br from-gold-500/25 to-amber-600/10 shadow-[0_0_22px_-6px_rgba(245,158,11,0.6)]">
                    <SineCoinIcon className="h-5 w-5 sm:h-7 sm:w-7" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[12.5px] sm:text-sm font-black text-white">Pazardan görev al, XP ve SineCoin kazan</h3>
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] leading-snug sm:leading-relaxed text-ink-400">
                      Günlük ve haftalık görevler haftada bir yenilenir. Aynı anda yalnızca 1 görev aktif olabilir.
                    </p>
                    <div className="mt-1.5 sm:mt-2 flex flex-wrap gap-1 sm:gap-1.5">
                      <span className="rounded-md border border-azure-400/20 bg-azure-500/10 px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-black text-azure-300">Günlük görevler</span>
                      <span className="rounded-md border border-gold-400/25 bg-gold-500/10 px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-black text-gold-200">Haftalık sözleşmeler</span>
                      <span className="rounded-md border border-white/10 bg-white/5 px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-black text-ink-200">1 aktif görev</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-row items-center justify-between gap-2 border-t border-white/5 pt-2 sm:min-w-[184px] sm:flex-col sm:items-end sm:border-0 sm:pt-0 sm:gap-2.5">
              <CoinPill amount={data.coins || 0} onClick={() => navigateTo('market')} />
              <button
                type="button"
                onClick={() => navigateTo('market')}
                className="group inline-flex items-center gap-1 rounded-lg sm:rounded-xl bg-gradient-to-r from-gold-400 to-amber-500 px-3 py-1.5 sm:px-4 sm:py-2.5 text-[10.5px] sm:text-xs font-black text-ink-950 shadow-[0_8px_24px_-8px_rgba(245,158,11,0.8)] transition hover:brightness-110 active:scale-[0.98]"
              >
                {activeContract ? 'Görevi Gör' : 'Görev Seç'}
                <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <span className="hidden text-[9px] font-bold uppercase tracking-[0.14em] text-ink-500 sm:block">
                Haftalık yenilenen vitrin
              </span>
            </div>
          </div>
        </div>
      </section>

      {activeTimerMovie && (() => {
        const info = getMovieTimerInfo(activeTimerMovie, nowMs);
        return (
          <div className="hn-timer">
            <div className="hn-timer-ic"><Timer size={18} /></div>
            <div className="hn-timer-tx">
              <div className="hn-timer-status">
                <span>{info.isPaused ? 'Sayaç Duraklatıldı' : 'Canlı Geri Sayım Aktif'}</span>
                <span>• {activeTimerMovie.title}</span>
              </div>
              <div className="hn-timer-sub">
                Kalan Süre: <strong className="hn-mono">{info.formattedRemaining}</strong> · Geçen: <strong>{info.elapsedMins} dk</strong> / {info.maxMins} dk
                {!info.canRateWithTimer && (
                  <span className="hn-timer-warn">(En az {info.minRequiredMins} dk geçmeden puanlanamaz)</span>
                )}
              </div>
            </div>
            <div className="hn-timer-btns">
              <button type="button" className="hn-btn hn-btn-g" onClick={() => togglePauseWatchingMovie(activeTimerMovie.id)}>
                {info.isPaused ? <><Play size={12} className="hn-btn-ic" /> Devam</> : <><Pause size={12} className="hn-btn-ic" /> Duraklat</>}
              </button>
              <button
                type="button"
                className="hn-btn hn-btn-p"
                onClick={() => handleRequestRateMovie(activeTimerMovie)}
                disabled={!info.canRateWithTimer}
              >
                {info.canRateWithTimer ? <><Star size={12} className="hn-btn-ic" /> Bitir &amp; Puanla</> : <><Lock size={12} className="hn-btn-ic" /> Kilitli</>}
              </button>
              <button type="button" className="hn-timer-x" onClick={() => cancelWatchingMovie(activeTimerMovie.id)} title="Sayacı İptal Et">
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* =========================================================
          02 · GÜNÜN SİNEMA KARTI
          ========================================================= */}
      {spotlightMovie && (() => {
        const isSpotlightTimerActive = activeTimerMovie?.id === spotlightMovie.id;
        const spotlightColName = spotlightMovie.collectionId ? data.collections.find((c) => c.id === spotlightMovie.collectionId)?.name : null;
        const spotlightNo = String(data.movies.findIndex((m) => m.id === spotlightMovie.id) + 1).padStart(3, '0');

        return (
          <section className="hn-sec">
            <div className="hn-sec-t">
              <span className="hn-idx">{nextSectionIdx()}</span>
              <h2>Günün Sinema Kartı</h2>
              {eligibleMovies.length > 1 && (
                <button type="button" className="hn-more" onClick={() => setSpotlightOffset((prev) => prev + 1)}>
                  <RefreshCw size={12} /> Kartı Değiştir
                </button>
              )}
              <span className="ln" />
              <button type="button" className="hn-more ml-auto" onClick={() => navigateTo('movies')}>
                Tüm Filmler <ChevronRight size={13} />
              </button>
            </div>

            <div className="hn-spotlight">
              <div
                className="hn-sp-poster"
                onClick={() => setDetailTarget({ type: 'movie', data: spotlightMovie })}
                role="button"
                tabIndex={0}
                title="Sinema Kartını Gör"
              >
                {spotlightMovie.posterUrl ? (
                  <img src={spotlightMovie.posterUrl} alt={spotlightMovie.title} />
                ) : (
                  <span className="hn-big-letter" aria-hidden="true">{(spotlightMovie.title || 'S').charAt(0).toUpperCase()}</span>
                )}
                <span className="hn-filmbadge">Sinema Kartı</span>
                {spotlightMovie.rating != null && <span className="hn-rate">{spotlightMovie.rating}</span>}
              </div>

              <div className="hn-sp-body">
                <div className="hn-sp-head">
                  <div className="hn-sp-kick">Kayıt No. {spotlightNo} · Vitrin Önerisi</div>
                  <h2>{spotlightMovie.title}</h2>
                  <div className="hn-meta-chips">
                    {spotlightMovie.year && <span><b>{spotlightMovie.year}</b></span>}
                    {spotlightMovie.runtime && <span><b>{spotlightMovie.runtime}</b> dk</span>}
                    {spotlightMovie.directors && spotlightMovie.directors.length > 0 && <span>Yönetmen <b>{spotlightMovie.directors[0]}</b></span>}
                    {spotlightMovie.cast && spotlightMovie.cast.length > 0 && <span>Oyuncu <b>{spotlightMovie.cast.slice(0, 2).join(', ')}</b></span>}
                    {spotlightColName && <span>Koleksiyon <b>{spotlightColName}</b></span>}
                  </div>

                  {spotlightMovie.genres.length > 0 && (
                    <div className="hn-genre-row">
                      {spotlightMovie.genres.map((g) => <span key={g} className="hn-genre">{g}</span>)}
                    </div>
                  )}
                </div>

                {spotlightMovie.overview ? (
                  <p className="hn-gdesc">{spotlightMovie.overview}</p>
                ) : (
                  <p className="hn-gdesc hn-gdesc-empty">Bu film için henüz özet bilgisi çekilmemiş. Filmler sekmesindeki "Eksikleri Bul" butonuyla özeti indirebilirsin.</p>
                )}

                <div className="hn-btnrow">
                  <button type="button" className="hn-btn hn-btn-p" onClick={() => handleRequestRateMovie(spotlightMovie)}>
                    <Star size={12} className="hn-btn-ic" /> Puanla
                  </button>
                  <button type="button" className="hn-btn hn-btn-s hn-sp-extra" onClick={() => setDetailTarget({ type: 'movie', data: spotlightMovie })}>
                    <Eye size={12} className="hn-btn-ic" /> Künye
                  </button>
                  {!isSpotlightTimerActive && (
                    <button
                      type="button"
                      className="hn-btn hn-btn-g"
                      onClick={() => startWatchingMovie(spotlightMovie.id, false)}
                      disabled={Boolean(activeTimerMovie)}
                    >
                      <Play size={12} className="hn-btn-ic" /> Başlat
                    </button>
                  )}
                  {isSpotlightPlanned ? (
                    <span className="hn-planned hn-sp-extra"><Lock size={11} className="hn-btn-ic" /> Takvime Planlandı</span>
                  ) : (
                    <button type="button" className="hn-btn hn-btn-g hn-sp-extra" onClick={() => navigateTo('plan')}>
                      <Calendar size={12} className="hn-btn-ic" /> Planlayıcıya Git
                    </button>
                  )}
                  <button
                    type="button"
                    className="hn-btn hn-btn-s hn-sp-more"
                    onClick={() => setSpotlightMoreOpen((prev) => !prev)}
                    aria-expanded={spotlightMoreOpen}
                    aria-label="Diğer aksiyonlar"
                  >
                    <MoreHorizontal size={14} className="hn-btn-ic" /> Diğer
                  </button>
                  {spotlightMoreOpen && (
                    <div className="hn-sp-more-menu">
                      <button
                        type="button"
                        className="hn-btn hn-btn-s"
                        onClick={() => { setSpotlightMoreOpen(false); setDetailTarget({ type: 'movie', data: spotlightMovie }); }}
                      >
                        <Eye size={12} className="hn-btn-ic" /> Künye
                      </button>
                      {isSpotlightPlanned ? (
                        <span className="hn-sp-more-item"><Lock size={11} className="hn-btn-ic" /> Takvime Planlandı</span>
                      ) : (
                        <button
                          type="button"
                          className="hn-btn hn-btn-g"
                          onClick={() => { setSpotlightMoreOpen(false); navigateTo('plan'); }}
                        >
                          <Calendar size={12} className="hn-btn-ic" /> Planlayıcıya Git
                        </button>
                      )}
                      {getMovieWatchLinks(spotlightMovie).map((link, idx) => {
                        const LinkIcon = link.icon;
                        return (
                          <a
                            key={idx}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hn-link-chip"
                            onClick={() => setSpotlightMoreOpen(false)}
                          >
                            {link.logo ? <img src={link.logo} alt={link.text} className="hn-link-logo" /> : <LinkIcon size={11} />}
                            {link.text}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="hn-links">
                  {getMovieWatchLinks(spotlightMovie).map((link, idx) => {
                    const LinkIcon = link.icon;
                    return (
                      <a key={idx} href={link.href} target="_blank" rel="noopener noreferrer" className="hn-link-chip">
                        {link.logo ? <img src={link.logo} alt={link.text} className="hn-link-logo" /> : <LinkIcon size={11} />}
                        {link.text}
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* =========================================================
          03 · İZLEMEYE DEVAM ET
          ========================================================= */}
      {ongoingSeries.length > 0 && (
        <section className="hn-sec">
          <div className="hn-sec-t">
            <span className="hn-idx">{nextSectionIdx()}</span>
            <h2>İzlemeye Devam Et — {Math.min(ongoingSeries.length, 5)} Dizi</h2>
            <span className="ln" />
            <button type="button" className="hn-more" onClick={() => navigateTo('series')}>Tüm Diziler <ChevronRight size={13} /></button>
          </div>

          <div className="hn-series-grid">
            {ongoingSeries.slice(0, 5).map(({ series, episode, watchedCount, totalCount, pct }) => (
              <div key={series.id} className="hn-scard">
                <button
                  type="button"
                  className="hn-sposter"
                  onClick={() => setDetailTarget({ type: 'series', data: series })}
                  title="Sinema Kartını Gör"
                >
                  {series.posterUrl && <img src={series.posterUrl} alt={series.title} />}
                  <span className="hn-sl" aria-hidden="true">{(series.title || 'S').charAt(0).toUpperCase()}</span>
                  <span className="hn-ep">S{episode.season} B{episode.episode}</span>
                </button>

                <div className="hn-sinfo">
                  <h4>{series.title}</h4>
                  <span className="hn-next-ep">Sıradaki: <b>S{episode.season} B{episode.episode}</b></span>
                  <div className="hn-prog-lab"><span>{watchedCount} / {totalCount} Bölüm</span><i>%{pct}</i></div>
                  <div className="hn-prog"><i style={{ width: `${Math.max(4, pct)}%` }} /></div>
                  <button type="button" className="hn-rate-btn" onClick={() => setPickedItem({ kind: 'series', series, episode })}>
                    <Star size={11} className="hn-btn-ic" /> Bölümü Puanla
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================
          ROZETLER + SİNEVİA AĞI
          ========================================================= */}
      <section className="hn-sec">
        <div className="hn-sec-t">
          <span className="hn-idx">{nextSectionIdx()}</span>
          <h2>Başarımlar &amp; Sinevia Ağı</h2>
          <span className="ln" />
        </div>

        <div className="hn-duo">
          <div className="hn-panel">
            <h3>
              <span className="hn-di" /> En Yakın Başarımlar
              <button type="button" className="hn-more" onClick={() => navigateTo('achievements')}>Tümü <ChevronRight size={13} /></button>
            </h3>

            {closestAchievements.length === 0 ? (
              <p className="hn-empty">Rozet eşiğine yakın bir izleme yok. Koleksiyonunu büyüt, ilk kademeni aç.</p>
            ) : (
              closestAchievements.map((ach) => {
                return (
                  <div key={ach.id} className="hn-ach">
                    <div className="top">
                      <AchievementIcon achievementId={ach.achievementId} tier={ach.tier} size={22} />
                      <div className="hn-an"><b>{ach.name}</b><span>{ach.desc}</span></div>
                      <span className="hn-axp">+{ach.xp} XP</span>
                    </div>
                    <div className="hn-pl"><span>İlerleme: {ach.current} / {ach.target}</span><i>%{ach.pct}</i></div>
                    <div className="hn-pt"><i style={{ width: `${ach.pct}%` }} /></div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hn-panel">
            <h3>
              <span className="hn-di" /> Sinevia Ağı
              <button type="button" className="hn-more" onClick={() => navigateTo('network')}>Katıl <ChevronRight size={13} /></button>
            </h3>
            <p className="hn-net-note">Ajan kontratlarını yerine getir. Gizli başarımları açarak XP topla, rütbeni yükselt ve vitrinine rozet kuşan.</p>
            <div className="hn-agents">
              {networkLoading ? (
                <div className="hn-agents-loading">Ağ verileri çekiliyor...</div>
              ) : networkFeed.length === 0 ? (
                <div className="hn-agents-empty">Ağında henüz bir hareket yok veya arkadaşın yok.</div>
              ) : (
                <>
                  {networkFeed.slice(0, 3).map((log) => {
                    const profile = profilesMap[log.agent_id];
                    if (!profile) return null;
                    const posterUrl = resolveNetworkPoster(log);
                    return (
                      <div key={log.id} className="hn-agent">
                        <div className="hn-agent-poster">
                          {posterUrl ? (
                            <img src={posterUrl} alt={log.item_title || ''} loading="lazy" />
                          ) : (
                            <Film size={16} />
                          )}
                        </div>
                        <div className="hn-agent-tx">
                          <div className="hn-agent-who">
                            <span className="hn-agent-avatar-mini">
                              {(profile.nickname || profile.agent_id || '?').charAt(0).toUpperCase()}
                            </span>
                            <b>{profile.nickname || 'Ajan'}</b>
                            <span>izledi</span>
                          </div>
                          <div className="hn-agent-title">{log.item_title}</div>
                          <span className="hn-agent-time">{timeAgo(log.created_at)}</span>
                        </div>
                        <span className={`hn-st ${log.rating ? 'on' : ''}`}>
                          {log.rating ? `★ ${log.rating}` : 'İzledi'}
                        </span>
                      </div>
                    );
                  })}
                  <button type="button" className="hn-net-more" onClick={() => navigateTo('network')}>
                    Tüm Ağ Akışını Gör <ChevronRight size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SON İZLENENLER
          ========================================================= */}
      {recentWatched.length > 0 && (
        <section className="hn-sec">
          <div className="hn-sec-t">
            <span className="hn-idx">{nextSectionIdx()}</span>
            <h2>Son İzlenenler</h2>
            <span className="ln" />
            <button type="button" className="hn-more" onClick={() => navigateTo('history')}>Geçmiş <ChevronRight size={13} /></button>
          </div>

          <div className="hp-recent">
            {recentWatched.map(({ h, isMovie, posterUrl }) => {
              const showPoster = Boolean(posterUrl) && !posterErrors[h.id];
              return (
                <button key={h.id} type="button" className="hp-rec" onClick={() => openHistoryItemDetail(h)} title={h.title}>
                  <span className="hp-rec-art">
                    {showPoster ? (
                      <img
                        src={posterUrl!}
                        alt={h.title}
                        loading="lazy"
                        onError={() => setPosterErrors((prev) => ({ ...prev, [h.id]: true }))}
                      />
                    ) : (
                      <span className="hp-rec-ph" aria-hidden="true"><b>{(h.title || 'S').charAt(0).toUpperCase()}</b></span>
                    )}
                    <span className="hp-rec-kind">{isMovie ? 'Film' : 'Dizi'}</span>
                    {h.rating != null && <span className={`hp-rec-rate ${ratingBgClass(h.rating)}`}>{h.rating}</span>}
                  </span>
                  <span className="hp-rec-tx">
                    <b>{h.title}</b>
                    <span>
                      {isMovie ? 'Film' : `S${h.season} B${h.episode}`} · <i>{formatDateShort(h.watchedAt)}</i>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* =========================================================
          BENTO — SİNEVİA NASIL ÇALIŞIR?
          ========================================================= */}
      <div className="pt-4 sm:pt-10 pb-6 sm:pb-12">
        <div className="text-center mb-4 sm:mb-10">
          <div className="hn-bento-badge"><Sparkles size={12} /> Yeni Nesil Sinema Deneyimi</div>
          <h3 className="hn-bento-title">Sinevia Nasıl Çalışır?</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-5">
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Search size={18} /></div>
            <h4>Katalog &amp; Keşif</h4>
            <p>Binlerce yapım arasından filtreleme yap, türlere göre ayır ve kişisel izleme kütüphaneni oluştur.</p>
          </div>
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Dna size={18} /></div>
            <h4>DNA Laboratuvarı</h4>
            <p>İki favori filminin DNA'sını sentezle. Algoritma bu karışımın genetiğine en uygun yapımı bulup önersin.</p>
          </div>
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Shuffle size={18} /></div>
            <h4>Kararsızlık Çarkı</h4>
            <p>Ne izleyeceğine karar veremiyor musun? Türü ve süreyi belirle, sistem senin için kütüphaneden rastgele seçsin.</p>
          </div>
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Calendar size={18} /></div>
            <h4>Haftalık Planlayıcı</h4>
            <p>Hangi gün ne izleyeceğini takvime ekle. Çakışmaları engelle ve izleme maratonunu düzenli hale getir.</p>
          </div>
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Timer size={18} /></div>
            <h4>Canlı İzleme Sayacı</h4>
            <p>Yapıma başladığında sayacı çalıştır, mola verince duraklat. Filmi yeteri kadar izlemeden sahte puan veremezsin.</p>
          </div>
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Star size={18} /></div>
            <h4>Detaylı Puanlama</h4>
            <p>Senaryo, oyunculuk ve görsellik gibi kendi belirlediğin alt kırılımlarla yapıma ince ayarlı bir puan ver.</p>
          </div>
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Target size={18} /></div>
            <h4>Görev &amp; Rozetler</h4>
            <p>Ajan kontratlarını yerine getir. Gizli başarımları açarak XP topla, rütbeni yükselt ve vitrinine rozet kuşan.</p>
          </div>
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Users size={18} /></div>
            <h4>Sinevia Sosyal Ağı</h4>
            <p>Arkadaşlarını ekle, profillerini gözle, özel film listeleri gönder, canlı mesajlaş ve Liderlik Tablosunda yarış.</p>
          </div>
        </div>
      </div>

      {showBulkAdd && <BulkAddModal initialTab={showBulkAdd} onClose={() => setShowBulkAdd(false)} />}
      {showPick && <PickModal seriesCount={allNextEpisodes.length} unwatchedMovies={eligibleMovies} nextEpisodes={allNextEpisodes} onPick={(item) => setPickedItem(item)} onClose={() => setShowPick(false)} />}
      {showDnaModal && (
        <Suspense fallback={null}>
          <DnaSynthesizerModal onClose={() => setShowDnaModal(false)} />
        </Suspense>
      )}
      {showCalibration && <CalibrationDuelModal onClose={() => setShowCalibration(false)} />}
      {pickedItem && (
        <RatingModal
          title={pickedItem.kind === 'movie' ? pickedItem.movie.title : pickedItem.series.title}
          subtitle={pickedItem.kind === 'movie' ? pickedItem.movie.year ? `Çıkış Yılı: ${pickedItem.movie.year}` : 'Film' : `${pickedItem.episode.season}. Sezon ${pickedItem.episode.episode}. Bölüm`}
          initialIsPastWatch={pickedItem.kind === 'movie' ? Boolean(pickedItem.movie.isPastWatch) : false}
          allowPastWatch={pickedItem.kind === 'movie'}
          onRate={(rating, note, detailedRating, reviewTags, isPastWatch) => {
            if (pickedItem.kind === 'movie') {
              watchMovie(pickedItem.movie.id, rating, note, detailedRating, reviewTags, isPastWatch);
            } else {
              watchEpisode(pickedItem.series.id, pickedItem.episode.id, rating, note, detailedRating, reviewTags);
            }
            setPickedItem(null);
          }}
          onClose={() => setPickedItem(null)}
        />
      )}
      {detailTarget && <MediaDetailModal target={detailTarget} onClose={() => setDetailTarget(null)} />}
    </div>
  );
}