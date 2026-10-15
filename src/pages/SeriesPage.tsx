import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Tv, Trash2, ChevronDown, ChevronRight, Lock, Check, Filter,
  ArrowDownAZ, Star as StarIcon, Search, Edit2, Shuffle, RefreshCw,
  PlayCircle, ExternalLink, Eye, SlidersHorizontal, X, Send
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass, getNextUnwatchedEpisode, uid } from '../lib/utils';
import { searchTMDBSeries } from '../lib/tmdb';
import { supabase } from '../lib/supabase';
import AddSeriesModal from '../components/AddSeriesModal';
import RatingModal from '../components/RatingModal';
import EditSeriesModal from '../components/EditSeriesModal';
import ConfirmDialog from '../components/ConfirmDialog';
import PickModal from '../components/PickModal';
import MediaDetailModal from '../components/MediaDetailModal';
import type { Series, Episode } from '../types';
import { handleImgFallback } from '../lib/selectors';

type SortMode = 'az' | 'recent' | 'rating';

/* ============================================================
   PREMIUM STILLER (svp- öneki · tema token'larına fallback'li)
   Kaynak: sinevia-premium.html — cam yüzeyler · kırmızı vurgu · shine
   ============================================================ */
const SERIES_PREMIUM_CSS = `
.svp-root {
  /* Vurgu zinciri: premium-dark kırmızı → diğer temalar kendi vurgusu */
  --svp-a1: var(--red, var(--color-1, #e8384f));
  --svp-a2: var(--red-hi, var(--color-2, #ff6b7a));
  --svp-a3: var(--red-deep, var(--color-3, #8e1220));
  --svp-on: #fff;
  --svp-ink: var(--ink, var(--text-main, #f4f4f2));
  --svp-muted: var(--muted, color-mix(in srgb, var(--text-main, #f4f4f2) 62%, transparent));
  --svp-glass: var(--glass, var(--bg-card, rgba(255, 255, 255, .05)));
  --svp-surf: var(--surface, var(--bg-surface, rgba(255, 255, 255, .04)));
  --svp-surf2: var(--surface2, rgba(255, 255, 255, .07));
  --svp-line: var(--line, var(--border-dim, rgba(244, 244, 242, .07)));
  --svp-line2: var(--line-2, var(--border-dim, rgba(244, 244, 242, .13)));
  --svp-r: var(--r, 16px);
  --svp-r-lg: var(--r-lg, 22px);
  --svp-r-sm: var(--r-sm, 10px);
  --svp-shadow: var(--shadow, 0 24px 60px -24px rgba(0, 0, 0, .8));
  --svp-glow: var(--glow, 0 0 0 1px rgba(232, 56, 79, .35), 0 12px 34px -12px rgba(232, 56, 79, .55));
  --svp-inset: inset 0 1px 0 rgba(255, 255, 255, .07);
  --svp-mono: 'Archivo', ui-sans-serif, sans-serif;

  /* vurgu tonları (tekrar yerine geçmesin) */
  --svp-t08: color-mix(in srgb, var(--svp-a1) 8%, transparent);
  --svp-t14: color-mix(in srgb, var(--svp-a1) 14%, transparent);
  --svp-t30: color-mix(in srgb, var(--svp-a1) 30%, transparent);
  --svp-t40: color-mix(in srgb, var(--svp-a1) 40%, transparent);
  --svp-t45: color-mix(in srgb, var(--svp-a1) 45%, transparent);
  --svp-t55: color-mix(in srgb, var(--svp-a1) 55%, transparent);
  --svp-t70: color-mix(in srgb, var(--svp-a1) 70%, transparent);
  --svp-t85: color-mix(in srgb, var(--svp-a1) 85%, transparent);
}

/* ---------- CAM YÜZEYLER ---------- */
.svp-card, .svp-panel {
  position: relative;
  background: var(--svp-glass);
  border: 1px solid var(--svp-line2);
  border-radius: var(--svp-r-lg);
  box-shadow: var(--svp-shadow), var(--svp-inset);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.svp-card {
  transition: transform .28s cubic-bezier(.2, .7, .3, 1), border-color .28s, box-shadow .28s;
}
.svp-card:hover {
  transform: translateY(-4px);
  border-color: var(--svp-t45);
  box-shadow: 0 30px 56px -22px rgba(0, 0, 0, .9), 0 0 36px -14px var(--svp-t45), var(--svp-inset);
}
/* kart üstünde ince kırmızı saç teli */
.svp-card::before {
  content: '';
  position: absolute; inset: 0 0 auto 0; height: 1px; z-index: 3; pointer-events: none;
  background: linear-gradient(90deg, transparent, var(--svp-t55) 28%, color-mix(in srgb, var(--svp-a2) 32%, transparent) 62%, transparent);
}
.svp-card-main { transition: background-color .24s ease; }
.svp-card-main:hover { background: var(--svp-surf); }
.svp-side { border-color: var(--svp-line); }
.svp-divider { border-color: var(--svp-line); }
.svp-seasons { border-color: var(--svp-line); background: color-mix(in srgb, var(--bg-base, #000) 18%, transparent); }
.svp-season-block { border-color: var(--svp-line); }

/* ---------- İKON / METİN RENKLERİ ---------- */
.svp-ic-muted { color: var(--svp-muted); }
.svp-ic-a2 { color: var(--svp-a2); }
.svp-title {
  font-family: 'Archivo', system-ui, -apple-system, sans-serif;
  font-weight: 900; letter-spacing: -.015em; text-transform: uppercase;
  color: var(--svp-ink);
}
.svp-cap-ink { color: var(--svp-ink); }
.svp-rate {
  font-family: var(--svp-mono);
  font-size: 9.5px; font-weight: 700;
  box-shadow: 0 6px 16px -8px rgba(0, 0, 0, .9), var(--svp-inset);
}
/* izleme geri alınınca korunan puan — kesikli çerçeve ile "saklı skor" */
.svp-rate-kept {
  outline: 1px dashed color-mix(in srgb, var(--svp-ink) 55%, transparent);
  outline-offset: 1.5px;
}
/* çipteki düzenleme (kalem) butonu */
.svp-rate-edit {
  display: inline-flex; align-items: center; justify-content: center;
  width: 17px; height: 17px; flex-shrink: 0;
  border-radius: 50%;
  color: var(--svp-ink);
  background: color-mix(in srgb, var(--svp-glass) 92%, transparent);
  border: 1px solid var(--svp-line2);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: 0 4px 10px -6px rgba(0, 0, 0, .9);
  transition: .2s cubic-bezier(.2, .7, .3, 1);
}
.svp-rate-edit:hover {
  color: var(--svp-ink);
  border-color: var(--svp-t55);
  background: var(--svp-t14);
  box-shadow: 0 0 0 3px var(--svp-t14), 0 6px 14px -8px var(--svp-t70);
  transform: scale(1.12);
}
.svp-rate-edit:focus-visible {
  outline: 2px solid var(--svp-a1);
  outline-offset: 1px;
}

/* ---------- MODAL PERDE ---------- */
.svp-overlay {
  background:
    radial-gradient(1000px 600px at 50% 30%, color-mix(in srgb, var(--svp-a1) 16%, transparent), transparent 65%),
    rgba(4, 4, 6, .72);
  backdrop-filter: blur(16px) saturate(130%);
  -webkit-backdrop-filter: blur(16px) saturate(130%);
}
.svp-modal-ov {
  position: absolute; inset: auto 0 0 0;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--bg-base, #000) 82%, transparent) 55%, var(--bg-base, #000));
}

/* ---------- BAŞLIK ---------- */
.svp-h1 {
  font-family: 'Archivo', system-ui, -apple-system, sans-serif;
  font-weight: 900;
  letter-spacing: -.03em;
  text-transform: uppercase;
  line-height: 1;
}
.svp-grad-text {
  background: linear-gradient(100deg, #fff 22%, var(--svp-a2) 140%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.svp-tile {
  width: 40px; height: 40px; flex-shrink: 0;
  border-radius: 14px;
  display: grid; place-items: center;
  color: var(--svp-on);
  background: linear-gradient(140deg, var(--svp-a2), var(--svp-a3));
  box-shadow: 0 8px 22px -8px var(--svp-t85), var(--svp-inset);
}
@media (max-width: 639px) {
  .svp-tile { width: 36px; height: 36px; }
}

/* ---------- PREMIUM BUTON SİSTEMİ ---------- */
.svp-btn-p, .svp-btn-s {
  position: relative; overflow: hidden; isolation: isolate;
  display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
  font-weight: 800; font-size: 11.5px; letter-spacing: .1em; text-transform: uppercase;
  border-radius: 13px; border: 1px solid transparent;
  transition: .25s cubic-bezier(.2, .7, .3, 1);
  white-space: nowrap;
}
.svp-btn-p::after, .svp-btn-s::after {
  content: ''; position: absolute; top: 0; left: -80%; width: 55%; height: 100%; z-index: -1;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, .35), transparent);
  transform: skewX(-20deg); transition: left .5s ease;
}
.svp-btn-p:hover::after, .svp-btn-s:hover::after { left: 130%; }
.svp-btn-p:active, .svp-btn-s:active { transform: translateY(1px) scale(.985); }
.svp-btn-p {
  color: #fff;
  background: linear-gradient(150deg, var(--svp-a2) 0%, var(--svp-a1) 45%, var(--svp-a3) 130%);
  box-shadow: 0 10px 28px -10px var(--svp-t70), inset 0 1px 0 rgba(255, 255, 255, .35), inset 0 -2px 6px rgba(0, 0, 0, .25);
}
.svp-btn-p:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 36px -10px var(--svp-t85), inset 0 1px 0 rgba(255, 255, 255, .4);
}
.svp-btn-s {
  color: var(--svp-ink);
  background: linear-gradient(150deg, rgba(255, 255, 255, .14), rgba(255, 255, 255, .05));
  border-color: rgba(255, 255, 255, .16);
  box-shadow: 0 8px 22px -12px rgba(0, 0, 0, .9), inset 0 1px 0 rgba(255, 255, 255, .16);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.svp-btn-s:hover {
  transform: translateY(-2px);
  background: linear-gradient(150deg, rgba(255, 255, 255, .2), rgba(255, 255, 255, .08));
  border-color: rgba(255, 255, 255, .3);
}
.svp-btn-p:disabled, .svp-btn-s:disabled { opacity: .4; pointer-events: none; }
.svp-btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: .45rem;
  border-radius: 12px; border: 1px solid var(--svp-line2);
  background: var(--svp-surf);
  color: var(--svp-muted);
  font-weight: 800; font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
  transition: .24s cubic-bezier(.2, .7, .3, 1);
}
.svp-btn-ghost:hover {
  transform: translateY(-2px);
  color: var(--svp-ink);
  border-color: var(--svp-t45);
  box-shadow: 0 10px 26px -12px var(--svp-t70);
}

/* ---------- SEKME + ÇİP (aktif = kırmızı gradyan) ---------- */
.svp-chipbar { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; }
.svp-tab {
  display: inline-flex; align-items: center; gap: .35rem;
  padding: .5rem .85rem; border-radius: 99px;
  font-size: 10.5px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase;
  color: var(--svp-muted);
  border: 1px solid var(--svp-line2);
  background: var(--svp-surf);
  transition: .22s cubic-bezier(.2, .7, .3, 1);
}
.svp-tab:hover:not(.svp-tab-on) {
  color: var(--svp-ink);
  border-color: rgba(255, 255, 255, .3);
  transform: translateY(-2px);
}
.svp-tab-on {
  color: #fff;
  background: linear-gradient(140deg, var(--svp-a2), var(--svp-a3));
  border-color: transparent;
  box-shadow: 0 8px 22px -8px var(--svp-t85), inset 0 1px 0 rgba(255, 255, 255, .35);
}
.svp-tab-n { font-family: var(--svp-mono); font-size: 9.5px; opacity: .85; }
.svp-tab-on .svp-tab-n { color: #fff; opacity: 1; }

.svp-chip {
  flex-shrink: 0; display: inline-flex; align-items: center; gap: .3rem;
  padding: .45rem .85rem; border-radius: 99px;
  font-size: 10.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
  border: 1px solid var(--svp-line2);
  background: var(--svp-surf);
  color: var(--svp-muted);
  transition: .22s cubic-bezier(.2, .7, .3, 1);
}
.svp-chip:hover:not(.svp-chip-on) {
  color: var(--svp-ink);
  border-color: rgba(255, 255, 255, .3);
  transform: translateY(-2px);
}
.svp-chip-on {
  color: #fff;
  background: linear-gradient(140deg, var(--svp-a2), var(--svp-a3));
  border-color: transparent;
  box-shadow: 0 8px 22px -8px var(--svp-t85), inset 0 1px 0 rgba(255, 255, 255, .35);
}
.svp-chip-on:hover { color: #fff; }
.svp-count-pill {
  display: inline-flex; align-items: center; gap: .3rem; width: fit-content;
  font-family: var(--svp-mono);
  font-size: 9.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  color: var(--svp-a2);
  background: var(--svp-t14); border: 1px solid var(--svp-t40);
  padding: .3rem .6rem; border-radius: 99px; white-space: nowrap;
}

/* ---------- MONO ETİKETLER ---------- */
.svp-mono {
  font-family: var(--svp-mono);
  font-size: 9.5px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
  color: var(--svp-muted);
}
.svp-pct {
  font-family: var(--svp-mono);
  font-size: 10px; font-weight: 800; letter-spacing: .06em;
  color: var(--svp-a2);
  text-shadow: 0 0 18px var(--svp-t55);
}

/* ---------- ARAMA ALANI ---------- */
.svp-search {
  width: 100%;
  border: 1px solid var(--svp-line2);
  background: var(--svp-surf);
  color: var(--svp-ink);
  border-radius: 13px;
  padding: .7rem 2.2rem .7rem 2.4rem;
  font-size: 13px;
  outline: 0;
  transition: .22s;
  box-shadow: var(--svp-inset);
}
.svp-search::placeholder { color: var(--svp-muted); }
.svp-search:focus {
  border-color: var(--svp-t55);
  box-shadow: 0 0 0 4px var(--svp-t14), var(--svp-inset);
  background: color-mix(in srgb, var(--svp-ink) 7%, transparent);
}

/* ---------- BÖLÜM İLERLEME ALANI (etiket + ince bar + kademe + hover detay) ---------- */
.svp-prog {
  position: relative;
  display: flex; flex-direction: column; gap: .32rem;
  min-width: 90px;
}
.svp-prog-top {
  display: flex; align-items: baseline; justify-content: space-between; gap: .5rem;
}
.svp-prog-cap {
  font-family: var(--svp-mono);
  font-size: 8.5px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase;
  color: var(--svp-muted);
}
.svp-prog .svp-pct { font-size: 12.5px; line-height: 1; }
.svp-prog-track {
  position: relative; height: 6px; width: 100%;
  border-radius: 99px; overflow: hidden;
  background: color-mix(in srgb, var(--svp-ink) 9%, transparent);
  border: 1px solid var(--svp-line2);
  box-shadow: inset 0 1px 2px color-mix(in srgb, var(--bg-base, #0a0a0e) 70%, transparent);
  transition: border-color .24s, box-shadow .24s;
}
.svp-prog:hover .svp-prog-track,
.svp-prog:focus-within .svp-prog-track {
  border-color: var(--svp-t45);
  box-shadow: 0 0 0 3px var(--svp-t14), inset 0 1px 2px color-mix(in srgb, var(--bg-base, #0a0a0e) 70%, transparent);
}
.svp-prog-fill {
  position: absolute; inset: 0 auto 0 0; height: 100%;
  background: linear-gradient(90deg, var(--svp-a3), var(--svp-a1) 55%, var(--svp-a2));
  box-shadow: 0 0 10px var(--svp-t70);
  transition: width .5s cubic-bezier(.2, .7, .3, 1);
}
.svp-prog-fill::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--svp-ink) 55%, transparent), transparent);
  transform: translateX(-100%);
  animation: svp-shine 2.6s cubic-bezier(.4, 0, .2, 1) infinite;
}
@keyframes svp-shine { 60%, 100% { transform: translateX(100%); } }
/* kademe (çeyrek) göstergeleri — aşılan kademeler koyu ışıkla ayrışır */
.svp-prog-ms {
  position: absolute; top: 0; bottom: 0; width: 2px;
  transform: translateX(-1px);
  background: var(--svp-line2);
  z-index: 2; pointer-events: none;
}
.svp-prog-ms-on { background: color-mix(in srgb, var(--bg-base, #0a0a0e) 70%, transparent); }
/* hover'da detay balonu */
.svp-prog-tip {
  position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 40;
  pointer-events: none; white-space: nowrap;
  font-family: var(--svp-mono);
  font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: var(--svp-ink);
  background: var(--svp-glass);
  border: 1px solid var(--svp-line2);
  border-radius: 9px;
  padding: .35rem .6rem;
  box-shadow: 0 12px 26px -14px rgba(0, 0, 0, .95), var(--svp-inset);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  opacity: 0; transform: translateY(4px);
  transition: opacity .2s ease, transform .2s ease;
}
.svp-prog:hover .svp-prog-tip { opacity: 1; transform: translateY(0); }

/* ---------- KART İÇİ İZLEME LİNKLERİ ---------- */
.svp-link {
  display: inline-flex; align-items: center; gap: .3rem;
  padding: .25rem .55rem; border-radius: 8px;
  font-size: 10px; font-weight: 700; letter-spacing: .04em;
  border: 1px solid var(--svp-line2);
  background: var(--svp-surf);
  color: var(--svp-muted);
  transition: .22s cubic-bezier(.2, .7, .3, 1);
}
.svp-link:hover {
  color: var(--svp-ink);
  border-color: var(--svp-t40);
  background: var(--svp-t14);
  box-shadow: 0 0 16px -8px var(--svp-t70);
  transform: translateY(-1px);
}

/* ---------- POSTER ÇERÇEVESİ ---------- */
.svp-poster {
  position: relative; overflow: hidden; border-radius: var(--svp-r-sm);
  border: 1px solid rgba(255, 255, 255, .12);
  background: linear-gradient(160deg, #221D2A, #0D0D11);
  box-shadow: 0 10px 26px -12px rgba(0, 0, 0, .9);
  transition: .26s cubic-bezier(.2, .7, .3, 1);
}
.svp-poster:hover {
  border-color: var(--svp-t40);
  box-shadow: var(--svp-glow), 0 14px 30px -12px rgba(0, 0, 0, .95);
}
.svp-poster::after {
  content: attr(data-ep);
  position: absolute; left: 6px; bottom: 6px; z-index: 2;
  font-family: var(--svp-mono);
  font-size: 8px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: #fff; padding: 3px 7px; border-radius: 7px;
  background: linear-gradient(135deg, var(--svp-a2), var(--svp-a3));
  box-shadow: 0 4px 12px -4px var(--svp-t85);
}

/* ---------- BÖLÜM KUTUCUKLARI ---------- */
.svp-ep {
  position: relative; width: 100%; height: 2.4rem;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--svp-r-sm);
  border: 1px solid var(--svp-line2);
  background: var(--svp-surf);
  color: var(--svp-muted);
  font-family: var(--svp-mono);
  font-size: 11px; font-weight: 700;
  transition: .22s cubic-bezier(.2, .7, .3, 1);
}
.svp-ep-done {
  color: #fff; border-color: transparent;
  background: linear-gradient(150deg, var(--svp-a2), var(--svp-a3));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .35), 0 6px 16px -8px var(--svp-t85);
}
.svp-ep-ready { color: var(--svp-a2); cursor: pointer; }
.svp-ep-ready:hover {
  transform: translateY(-2px);
  border-color: var(--svp-t45);
  background: var(--svp-t14);
  box-shadow: 0 0 0 3px var(--svp-t14), 0 8px 20px -10px var(--svp-t85);
  color: #fff;
}
.svp-ep-lock {
  border-style: dashed; cursor: not-allowed; opacity: .5;
  color: var(--svp-muted);
}
.svp-ep-num {
  display: block; text-align: center; margin-top: .2rem;
  font-family: var(--svp-mono);
  font-size: 9px; letter-spacing: .08em; color: var(--svp-muted);
}
.svp-ep-del {
  position: absolute; top: -6px; right: -6px; z-index: 20;
  width: 18px; height: 18px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: var(--svp-muted);
  border: 1px solid var(--svp-line2);
  background: linear-gradient(150deg, #23232A, #131317);
  transition: .2s;
}
.svp-ep-del:hover {
  color: #fff; border-color: transparent;
  background: linear-gradient(150deg, var(--svp-a2), var(--svp-a3));
  box-shadow: 0 6px 16px -6px var(--svp-t85);
}

/* ---------- SEZON BAŞLIKLARI ---------- */
.svp-season {
  font-family: var(--svp-mono);
  font-size: 10.5px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
  color: var(--svp-ink);
}
.svp-done-tag {
  display: inline-flex; align-items: center; gap: .25rem;
  font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
  color: #67e39b; background: rgba(78, 203, 142, .1); border: 1px solid rgba(78, 203, 142, .45);
  padding: .2rem .55rem; border-radius: 99px;
  box-shadow: 0 0 14px -6px rgba(78, 203, 142, .7);
}

/* ---------- AKSİYON İKON BUTONLARI ---------- */
.svp-act {
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 11px; border: 1px solid transparent;
  color: var(--svp-muted);
  transition: .22s cubic-bezier(.2, .7, .3, 1);
}
.svp-act:hover {
  transform: translateY(-2px);
  color: var(--svp-ink);
  border-color: var(--svp-line2);
  background: var(--svp-surf);
}
.svp-act-send:hover {
  color: var(--svp-a2);
  border-color: var(--svp-t40);
  background: var(--svp-t14);
  box-shadow: 0 8px 20px -10px var(--svp-t70);
}
.svp-act-del:hover {
  color: #f87171;
  border-color: rgba(248, 113, 113, .45);
  box-shadow: 0 8px 20px -10px rgba(248, 113, 113, .6);
}
.svp-x {
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 11px; border: 1px solid var(--svp-line2);
  color: var(--svp-muted);
  background: var(--svp-surf);
  transition: .22s cubic-bezier(.2, .7, .3, 1);
}
.svp-x:hover {
  color: #fff; border-color: transparent;
  background: linear-gradient(150deg, var(--svp-a2), var(--svp-a3));
  box-shadow: 0 8px 20px -10px var(--svp-t85);
  transform: translateY(-1px) rotate(90deg);
}

/* ---------- BOŞ DURUM ---------- */
.svp-empty {
  border: 1px dashed var(--svp-line2);
  border-radius: var(--svp-r-lg);
  background: var(--svp-glass);
  color: var(--svp-muted);
  box-shadow: var(--svp-inset);
}
.svp-empty-tile {
  width: 64px; height: 64px; border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  background: linear-gradient(140deg, var(--svp-a2), var(--svp-a3));
  box-shadow: 0 10px 26px -10px var(--svp-t85), var(--svp-inset);
}

/* ---------- TAVSİYE MODALI (premium cam) ---------- */
.svp-modal {
  background: var(--svp-glass);
  border: 1px solid var(--svp-line2);
  box-shadow: var(--svp-shadow), var(--svp-inset);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.svp-modal-bar {
  background: linear-gradient(120deg, var(--svp-t30), var(--svp-t08) 70%);
  border-bottom: 1px solid var(--svp-line2);
}
.svp-modal-tile {
  width: 32px; height: 32px; flex-shrink: 0;
  border-radius: 12px;
  display: grid; place-items: center;
  color: #fff;
  border: 1px solid var(--svp-t45);
  background: linear-gradient(140deg, var(--svp-a2), var(--svp-a3));
  box-shadow: 0 6px 16px -6px var(--svp-t85), var(--svp-inset);
}
.svp-modal-tag {
  font-family: var(--svp-mono);
  font-size: 10px; font-weight: 800; letter-spacing: .2em; text-transform: uppercase;
  color: color-mix(in srgb, var(--svp-a2) 62%, #fff);
}
.svp-modal-side {
  background: color-mix(in srgb, var(--svp-ink) 3%, transparent);
  border-color: var(--svp-line);
}
.svp-modal-label {
  display: block;
  font-family: var(--svp-mono);
  font-size: 9.5px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
  color: var(--svp-muted);
}
.svp-modal-input, .svp-modal-select {
  width: 100%;
  background: var(--svp-surf);
  border: 1px solid var(--svp-line2);
  color: var(--svp-ink);
  border-radius: 12px;
  padding: .6rem .75rem;
  font-size: 12px;
  outline: 0;
  transition: .22s;
  box-shadow: var(--svp-inset);
}
.svp-modal-input::placeholder { color: var(--svp-muted); }
.svp-modal-input:focus, .svp-modal-select:focus {
  border-color: var(--svp-t55);
  box-shadow: 0 0 0 4px var(--svp-t14), var(--svp-inset);
}
.svp-modal-select option { background: var(--bg-base, #141419); color: var(--ink, var(--text-main, #f4f4f2)); }
.svp-modal-cap {
  font-family: var(--svp-mono);
  font-size: 9.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
  color: var(--svp-muted);
}
.svp-modal-count {
  font-family: var(--svp-mono);
  font-size: 9.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  color: var(--svp-a2);
  background: var(--svp-t14); border: 1px solid var(--svp-t40);
  padding: .3rem .6rem; border-radius: 9px; white-space: nowrap;
}
.svp-modal-card {
  position: relative; aspect-ratio: 2 / 3;
  border-radius: 12px; overflow: hidden; cursor: pointer;
  border: 2px solid transparent;
  background: var(--svp-surf);
  transition: transform .24s cubic-bezier(.2, .7, .3, 1), border-color .24s, box-shadow .24s;
}
.svp-modal-card:hover {
  border-color: var(--svp-t30);
  transform: translateY(-3px);
}
.svp-modal-card-on {
  border-color: var(--svp-a1);
  transform: scale(.95);
  box-shadow: 0 0 18px -4px var(--svp-t70);
}
.svp-modal-veil {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--svp-t14);
  backdrop-filter: blur(1px);
  -webkit-backdrop-filter: blur(1px);
}
.svp-modal-check {
  width: 32px; height: 32px; border-radius: 50%;
  display: grid; place-items: center;
  color: #fff;
  background: linear-gradient(140deg, var(--svp-a2), var(--svp-a3));
  box-shadow: 0 6px 16px -6px var(--svp-t85), var(--svp-inset);
}
.svp-modal-foot {
  border-top: 1px solid var(--svp-line2);
  background: color-mix(in srgb, var(--svp-ink) 2%, transparent);
}
`;

/* ---------- PUANLAMA KORUMA DEPO'SU (localStorage aynası) ----------
   UNWATCH_EPISODE reducer'ı puanı null'a çektiği için, puan görünümünün
   (sv-rate çipi) sayfa yenilmesinde de kaybolmaması adına korunan son puanlar
   burada tutulur. Bozuk/erişilemez veri sessizce yok sayılır. */
const KEPT_RATINGS_KEY = 'sinevia.seriesKeptRatings.v1';

function loadKeptRatings(): Record<string, number> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(KEPT_RATINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, number> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([id, v]) => {
      if (typeof v === 'number' && Number.isFinite(v)) out[id] = v;
    });
    return out;
  } catch {
    return {};
  }
}

function saveKeptRatings(map: Record<string, number>) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KEPT_RATINGS_KEY, JSON.stringify(map));
  } catch {
    /* kota/erişim hatası korumayı bozmasın */
  }
}

export default function SeriesPage() {
  const { data, editSeries, deleteSeries, watchEpisode, canWatchEpisode, unwatchEpisode, deleteEpisode, updateHistoryRating, showToast } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [showPick, setShowPick] = useState(false);
  const [pickedSeriesItem, setPickedSeriesItem] = useState<{ series: Series; episode: Episode } | null>(null);
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());
  const [ratingTarget, setRatingTarget] = useState<{ series: Series; episode: Episode } | null>(null);
  // PUAN DÜZENLEME ONAY Uyarısı: çipteki kalem → 'Değiştirmek istiyor musun?'
  const [ratingEditTarget, setRatingEditTarget] = useState<{ series: Series; episode: Episode } | null>(null);
  const [editTarget, setEditTarget] = useState<Series | null>(null);
  const [detailSeriesId, setDetailSeriesId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Series | null>(null);
  const [deleteEpisodeTarget, setDeleteEpisodeTarget] = useState<{ series: Series; episode: Episode } | null>(null);

  // ARKADAŞA TAVSİYE (TEKLİ & TOPLU) MODAL STATELERİ
  const [showSendModal, setShowSendModal] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [selectedSeriesIdsForSend, setSelectedSeriesIdsForSend] = useState<Set<string>>(new Set());
  const [sendListTitle, setSendListTitle] = useState('');
  const [sendSeriesSearch, setSendSeriesSearch] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);

  const [watchedFilter, setWatchedFilter] = useState<boolean | null>(false);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('az');
  const [search, setSearch] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  /* PUANLAMA KORUMA (SAĞLAM)
     'Bölümü tamamla/geri al' tıklaması UNWATCH_EPISODE tetikler ve reducer
     bölümün puanını null'a çeker + geçmiş kaydını siler (reducerActions.test.ts
     ile sabitlenmiş davranış — AppContext'e dokunulmadı). Koruma katmanları:
       1) keepRating(ep): buton onClick'inde unwatchEpisode'dan ÖNCE çağrılır
          (stopPropagation + preventDefault ile), yani puan reducer'a girmeden
          önce aynaya yazılır.
       2) Aşağıdaki effect: store'daki TÜM puanları (hangi yoldan yazılırsa
          yazılsın) aynalar → korunan kayıt her zaman güncel kalır ve unwatch
          store'u silse bile çip tek kare bile kaybolmaz. Silinen bölümlerin
          kayıtları aynadan düşer.
       3) localStorage kalıcılığı: sayfa yenilense/HMR tetiklense bile puan
          görünümü geri gelir (reducer zaten null'a düşürdüğü için). */
  const [keptRatings, setKeptRatings] = useState<Record<string, number>>(() => loadKeptRatings());

  const keepRating = (ep: Episode) => {
    if (ep.rating === null || ep.rating === undefined) return;
    setKeptRatings((prev) => (prev[ep.id] === ep.rating ? prev : { ...prev, [ep.id]: ep.rating as number }));
  };

  // 2) Store ↔ ayna senkronu (idempotent): puanları aynala, silinenleri temizle
  useEffect(() => {
    setKeptRatings((prev) => {
      const alive = new Set<string>();
      let changed = false;
      const next = { ...prev };
      data.series.forEach((s) =>
        s.episodes.forEach((ep) => {
          alive.add(ep.id);
          if (ep.rating !== null && ep.rating !== undefined && next[ep.id] !== ep.rating) {
            next[ep.id] = ep.rating;
            changed = true;
          }
        })
      );
      Object.keys(next).forEach((id) => {
        if (!alive.has(id)) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [data.series]);

  // 3) Kalıcılık
  useEffect(() => {
    saveKeptRatings(keptRatings);
  }, [keptRatings]);

  const detailSeries = useMemo(
    () => (detailSeriesId ? data.series.find((s) => s.id === detailSeriesId) || null : null),
    [data.series, detailSeriesId]
  );

  const handleSyncTMDBSeries = async () => {
    setIsSyncing(true);
    const seriesToSync = data.series.filter(
      (s) => !s.tmdbId || !s.posterUrl || !s.imdbId || !s.watchProviders || !s.creators || s.creators.length === 0 || !s.cast || s.cast.length === 0
    );
    let syncedCount = 0;

    for (const s of seriesToSync) {
      try {
        const results = await searchTMDBSeries(s.title);
        if (results.length > 0) {
          const match = results[0];
          const newGenres = Array.from(new Set([...s.genres, ...match.genres]));

          editSeries(
            s.id, s.title, newGenres, match.posterUrl || s.posterUrl, match.overview || s.overview, match.id, match.year || s.year, true, s.customUrl, match.imdbId || s.imdbId,
            match.watchProviders && match.watchProviders.length > 0 ? match.watchProviders : s.watchProviders,
            { creators: match.creators, cast: match.cast, studios: match.studios, keywords: match.keywords, originalLanguage: match.originalLanguage }
          );
          syncedCount++;
        }
      } catch (e) {
        console.error(`Hata (${s.title}):`, e);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    setIsSyncing(false);
    if (syncedCount > 0) { showToast(`${syncedCount} diziye Sinema Kartı eklendi!`, 'success'); } 
    else { showToast('Tüm künyeler güncel.', 'info'); }
  };

  const nextEpisodes = useMemo(() => {
    return data.series
      .map((s) => {
        const next = getNextUnwatchedEpisode(s.episodes);
        return next ? { series: s, episode: next } : null;
      })
      .filter((x): x is { series: Series; episode: Episode } => x !== null);
  }, [data.series]);

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    data.series.forEach((s) => s.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [data.series]);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  const clearGenres = () => setSelectedGenres(new Set());

  const activeFilterCount = (search.trim() !== '' ? 1 : 0) + selectedGenres.size + (sortMode !== 'az' ? 1 : 0);

  const resetAllFilters = () => { setSearch(''); setSelectedGenres(new Set()); setSortMode('az'); };

  const sortedSeries = useMemo(() => {
    let list = data.series;

    if (watchedFilter !== null) {
      list = list.filter((s) => {
        const isCompleted = s.episodes.length > 0 && s.episodes.every((e) => e.watched);
        return watchedFilter ? isCompleted : !isCompleted;
      });
    }
    if (selectedGenres.size > 0) { list = list.filter((s) => Array.from(selectedGenres).every((g) => s.genres.includes(g))); }
    if (search.trim()) { const q = search.toLocaleLowerCase('tr-TR'); list = list.filter((s) => s.title.toLocaleLowerCase('tr-TR').includes(q)); }

    return [...list].sort((a, b) => {
      if (sortMode === 'az') return a.title.localeCompare(b.title, 'tr');
      if (sortMode === 'recent') return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      const avgA = a.episodes.filter((e) => e.rating !== null).length > 0 ? a.episodes.reduce((sum, e) => sum + (e.rating || 0), 0) / a.episodes.filter((e) => e.rating !== null).length : -1;
      const avgB = b.episodes.filter((e) => e.rating !== null).length > 0 ? b.episodes.reduce((sum, e) => sum + (e.rating || 0), 0) / b.episodes.filter((e) => e.rating !== null).length : -1;
      return avgB - avgA;
    });
  }, [data.series, watchedFilter, selectedGenres, sortMode, search]);

  const toggleSeries = (id: string) => {
    setExpandedSeries((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  // TAVSİYE MODALINI AÇ (TEKİL VEYA TOPLU)
  const openSendModal = async (singleSeries?: Series) => {
    if (!data.agentId) { showToast('Lütfen önce ayarlardan Sinevia Ağı kimliğinizi oluşturun!', 'error'); return; }
    
    if (singleSeries) {
      setSelectedSeriesIdsForSend(new Set([singleSeries.id]));
      setSendListTitle(`Tavsiye: ${singleSeries.title}`);
    } else {
      setSelectedSeriesIdsForSend(new Set());
      setSendListTitle('Özel Dizi Tavsiyeleri');
    }

    setSendSeriesSearch('');
    setShowSendModal(true);
    setLoadingFriends(true);

    try {
      const { data: fData } = await supabase.from('friendships').select('*').or(`requester_id.eq.${data.agentId},receiver_id.eq.${data.agentId}`).eq('status', 'accepted');
      const friendIds = (fData || []).map(f => f.requester_id === data.agentId ? f.receiver_id : f.requester_id);
      
      if (friendIds.length > 0) {
        const { data: pData } = await supabase.from('profiles').select('*').in('agent_id', friendIds);
        setFriendsList(pData || []);
        if (pData && pData.length > 0) setSelectedFriendId(pData[0].agent_id);
      } else {
        setFriendsList([]);
      }
    } catch (err) {
      console.error(err);
      showToast('Arkadaş listesi alınamadı.', 'error');
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleSendRecommendations = async () => {
    if (!selectedFriendId) { showToast('Lütfen bir arkadaş seç!', 'error'); return; }
    if (selectedSeriesIdsForSend.size === 0) { showToast('En az bir dizi seçmelisin!', 'warning'); return; }

    const selectedSeries = data.series.filter(s => selectedSeriesIdsForSend.has(s.id));
    const items = selectedSeries.map(s => ({
      id: s.id,
      title: s.title,
      type: 'series',
      poster: s.posterUrl || null,
      genres: s.genres,
      year: s.year || ''
    }));

    try {
      await supabase.from('recommendations').insert([{
        id: uid(),
        sender_id: data.agentId,
        receiver_id: selectedFriendId,
        list_title: sendListTitle.trim() || 'Dizi Tavsiyeleri',
        items: items,
        status: 'pending'
      }]);
      showToast(`${items.length} dizi arkadaşına başarıyla gönderildi!`, 'success');
      setShowSendModal(false);
      setSelectedFriendId('');
      setSelectedSeriesIdsForSend(new Set());
    } catch {
      showToast('Gönderilirken hata oluştu!', 'error');
    }
  };

  const toggleSelectSeriesForSend = (id: string) => {
    setSelectedSeriesIdsForSend(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredSeriesForModal = useMemo(() => {
    const q = sendSeriesSearch.trim().toLowerCase();
    if (!q) return data.series;
    return data.series.filter(s => s.title.toLowerCase().includes(q));
  }, [data.series, sendSeriesSearch]);

  const totalCompleted = data.series.filter((s) => s.episodes.length > 0 && s.episodes.every((e) => e.watched)).length;
  const totalOngoing = data.series.length - totalCompleted;

  return (
    <div className="svp-root space-y-3 sm:space-y-5 overflow-x-clip sm:overflow-x-visible">
      <style>{SERIES_PREMIUM_CSS}</style>

      {/* ÜST BAŞLIK & AKSİYON BARI (mobil: sm: sabitlemeleri ≥768'i birebir korur) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-2.5">
        <div className="flex items-center justify-between">
          <h1 className="svp-h1 text-2xl sm:text-3xl flex items-center gap-2 sm:gap-2.5">
            <div className="svp-tile">
              <Tv size={20} />
            </div>
            <span className="svp-grad-text">Diziler</span>
          </h1>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2">
          {/* ARKADAŞA TAVSİYE (TEKLİ & TOPLU) */}
          <button
            onClick={() => openSendModal()}
            className="svp-btn-s flex-1 sm:flex-none min-w-0 px-2.5 sm:px-3.5 py-2 sm:py-2.5 min-h-10 sm:min-h-0 rounded-xl sm:rounded-[13px] text-xs sm:text-sm"
            title="Arkadaşına tekli veya çoklu dizi listesi öner"
          >
            <Send size={15} className="flex-shrink-0 svp-ic-a2" />
            <span className="truncate min-w-0">Tavsiye Et</span>
          </button>

          <button
            onClick={handleSyncTMDBSeries}
            disabled={isSyncing}
            className="svp-btn-s flex-1 sm:flex-none min-w-0 px-3 sm:px-3.5 py-2 sm:py-2.5 min-h-10 sm:min-h-0 rounded-xl sm:rounded-[13px] text-xs sm:text-sm"
          >
            <RefreshCw size={15} className={`flex-shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="truncate min-w-0">{isSyncing ? 'Taranıyor...' : 'Eksikleri Bul'}</span>
          </button>

          <button
            onClick={() => setShowPick(true)}
            className="svp-btn-s flex-1 sm:flex-none min-w-0 px-3 sm:px-3.5 py-2 sm:py-2.5 min-h-10 sm:min-h-0 rounded-xl sm:rounded-[13px] text-xs sm:text-sm"
          >
            <Shuffle size={15} className="flex-shrink-0" />
            <span className="truncate min-w-0">Ne İzlesem</span>
          </button>

          <button
            onClick={() => setShowAdd(true)}
            className="svp-btn-p hidden sm:inline-flex px-4 py-2.5 text-sm"
          >
            <Plus size={18} />
            Dizi Ekle
          </button>
        </div>
      </div>

      {/* SEKMELER & TIKLANINCA AÇILAN ARAMA/FİLTRELEME BARI */}
      {data.series.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
            <div className="svp-chipbar">
              <button
                onClick={() => setWatchedFilter(null)}
                className={`svp-tab px-2.5 sm:px-3 py-1.5 min-h-10 sm:min-h-0 truncate ${watchedFilter === null ? 'svp-tab-on' : ''}`}
              >
                Tümü <span className="svp-tab-n">({data.series.length})</span>
              </button>
              <button
                onClick={() => setWatchedFilter(false)}
                className={`svp-tab px-2.5 sm:px-3 py-1.5 min-h-10 sm:min-h-0 truncate ${watchedFilter === false ? 'svp-tab-on' : ''}`}
              >
                İzlenecek <span className="svp-tab-n">({totalOngoing})</span>
              </button>
              <button
                onClick={() => setWatchedFilter(true)}
                className={`svp-tab px-2.5 sm:px-3 py-1.5 min-h-10 sm:min-h-0 truncate ${watchedFilter === true ? 'svp-tab-on' : ''}`}
              >
                Bitenler <span className="svp-tab-n">({totalCompleted})</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsFilterPanelOpen((prev) => !prev)}
                className={`svp-btn-ghost flex-1 sm:flex-none min-w-0 px-3 sm:px-3.5 py-2 min-h-10 sm:min-h-0 ${
                  isFilterPanelOpen || activeFilterCount > 0 ? 'svp-chip-on' : ''
                }`}
              >
                <SlidersHorizontal size={14} />
                <span className="truncate min-w-0">Ara &amp; Filtrele</span>
                {activeFilterCount > 0 && (
                  <span className="svp-tab-n">
                    {activeFilterCount}
                  </span>
                )}
                {isFilterPanelOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  title="Filtreleri sıfırla"
                  className="svp-x p-2 min-h-10 min-w-10 sm:min-h-0 sm:min-w-0"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {isFilterPanelOpen && (
            <div className="svp-panel p-3 sm:p-4 space-y-3 animate-fade-in-up">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 svp-ic-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Dizi, tür, yıl ara..."
                  className="svp-search"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    title="Aramayı temizle"
                    className="svp-x absolute right-2 top-1/2 -translate-y-1/2 p-1.5 min-h-9 min-w-9 sm:min-h-0 sm:min-w-0"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
                <div className="svp-mono flex items-center gap-1 mr-1 flex-shrink-0">
                  <Filter size={12} /> Sırala:
                </div>
                <button
                  onClick={() => setSortMode('az')}
                  className={`svp-chip ${sortMode === 'az' ? 'svp-chip-on' : ''}`}
                >
                  <ArrowDownAZ size={13} /> A-Z
                </button>
                <button
                  onClick={() => setSortMode('recent')}
                  className={`svp-chip ${sortMode === 'recent' ? 'svp-chip-on' : ''}`}
                >
                  En Yeni
                </button>
                <button
                  onClick={() => setSortMode('rating')}
                  className={`svp-chip ${sortMode === 'rating' ? 'svp-chip-on' : ''}`}
                >
                  <StarIcon size={13} /> Puan
                </button>
              </div>

              {allGenres.length > 0 && (
                <div className="svp-divider flex flex-wrap sm:flex-wrap gap-1.5 items-center overflow-x-auto hide-scrollbar pt-2 border-t">
                  <button
                    onClick={clearGenres}
                    className={`svp-chip ${selectedGenres.size === 0 ? 'svp-chip-on' : ''}`}
                  >
                    Tüm Türler
                  </button>
                  {allGenres.map((g) => {
                    const active = selectedGenres.has(g);
                    return (
                      <button
                        key={g}
                        onClick={() => toggleGenre(g)}
                        className={`svp-chip ${active ? 'svp-chip-on' : ''}`}
                      >
                        {active && <Check size={11} />}
                        {g}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {data.series.length === 0 ? (
        <div className="svp-empty text-center py-10 px-4 sm:py-16 sm:px-6">
          <div className="svp-empty-tile mx-auto mb-4">
            <Tv size={32} />
          </div>
          <p className="svp-h1 text-lg mb-1" style={{ color: 'var(--svp-ink)' }}>Henüz dizi yok.</p>
          <p className="text-sm mt-1">Dizi ekleyerek başla!</p>
        </div>
      ) : sortedSeries.length === 0 ? (
        <div className="svp-empty text-center py-8 px-4 sm:py-12 sm:px-6">
          <Tv size={40} className="mx-auto mb-3 opacity-40" />
          <p className="svp-mono">{watchedFilter === true ? 'Tamamen bitirdiğin bir dizi yok.' : watchedFilter === false ? 'Bölümleri kalan (izlenecek) dizi yok.' : 'Aramaya uygun dizi bulunamadı.'}</p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {sortedSeries.map((s) => {
            const isExpanded = expandedSeries.has(s.id);
            const seasons = Array.from(new Set(s.episodes.map((e) => e.season))).sort((a, b) => a - b);
            const watchedCount = s.episodes.filter((e) => e.watched).length;
            const allWatched = s.episodes.length > 0 && s.episodes.every((e) => e.watched);
            const nextEp = getNextUnwatchedEpisode(s.episodes);
            const progressPct = s.episodes.length > 0 ? Math.round((watchedCount / s.episodes.length) * 100) : 0;

            const watchLinks: { href: string; text: string; logo: string | null; icon: any }[] = [];

            if (s.customUrl) {
              watchLinks.push({ href: s.customUrl, text: 'Özel Kaynak', logo: null, icon: ExternalLink });
            }

            if (s.watchProviders && s.watchProviders.length > 0) {
              s.watchProviders.slice(0, 2).forEach((provider) => {
                let finalHref = provider.link || '';
                const pName = provider.providerName.toLowerCase();

                if (pName.includes('netflix')) finalHref = `https://www.netflix.com/search?q=${encodeURIComponent(s.title)}`;
                else if (pName.includes('amazon') || pName.includes('prime')) finalHref = `https://www.primevideo.com/search?ref=atv_sr_sug_1?phrase=${encodeURIComponent(s.title)}`;
                else if (pName.includes('disney')) finalHref = `https://www.disneyplus.com/search?q=${encodeURIComponent(s.title)}`;
                else if (pName.includes('blutv')) finalHref = `https://www.blutv.com/arama?q=${encodeURIComponent(s.title)}`;
                else if (pName.includes('mubi')) finalHref = `https://mubi.com/tr/search?query=${encodeURIComponent(s.title)}`;
                else if (pName.includes('apple')) finalHref = `https://tv.apple.com/tr/search?q=${encodeURIComponent(s.title)}`;

                watchLinks.push({ href: finalHref, text: provider.providerName, logo: provider.logoUrl, icon: PlayCircle });
              });
            }

            const searchQuery = encodeURIComponent(`${s.title} ${s.year || ''} dizi izle`);
            watchLinks.push({
              href: `https://www.google.com/search?q=${searchQuery}`,
              text: "Google'da Bul",
              logo: null,
              icon: Search,
            });

            if (data.altWatchTemplate && (s.imdbId || data.altWatchTemplate.includes('{slug}') || data.altWatchTemplate.includes('{title}'))) {
              const charMap: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
              const slug = s.title
                .toLocaleLowerCase('tr-TR')
                .replace(/[çğıöşü]/g, (match) => charMap[match])
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');

              const finalAltHref = data.altWatchTemplate
                .replace('{imdb}', s.imdbId || '')
                .replace('{slug}', slug)
                .replace('{title}', encodeURIComponent(s.title))
                .replace('{year}', s.year || '');

              watchLinks.push({ href: finalAltHref, text: 'Alternatif', logo: null, icon: PlayCircle });
            }

            return (
              <div key={s.id} className="svp-card overflow-hidden flex flex-col sm:flex-row flex-wrap">
                <div
                  onClick={() => toggleSeries(s.id)}
                  className="svp-card-main flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between p-2.5 sm:p-4 w-full cursor-pointer"
                >
                  <div className="flex items-center gap-2 sm:gap-3 w-full min-w-0">
                    {isExpanded ? <ChevronDown size={17} className="svp-ic-a2 flex-shrink-0" /> : <ChevronRight size={17} className="svp-ic-muted flex-shrink-0" />}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailSeriesId(s.id);
                      }}
                      title="Dizi Sinema Kartını Gör"
                      data-ep={nextEp ? `S${nextEp.season}B${nextEp.episode}` : ''}
                      className="svp-poster w-14 sm:w-16 aspect-[2/3] flex-shrink-0 flex items-center justify-center group/poster cursor-pointer focus:outline-none"
                    >
                      {s.posterUrl ? (
                        <img loading="lazy" decoding="async" src={s.posterUrl} alt={s.title} className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300"  onError={handleImgFallback}/>
                      ) : (
                        <Tv size={16} className="svp-ic-muted" />
                      )}
                      <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/poster:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5 p-1">
                        <div className="svp-modal-check w-6 h-6">
                          <Eye size={13} />
                        </div>
                      </div>
                    </button>

                    <div className="text-left min-w-0 flex-1 flex flex-col justify-center">
                      <div className={`svp-title text-[13px] sm:text-[15px] truncate mb-0.5 ${allWatched ? 'opacity-55' : ''}`}>
                        {s.title}
                      </div>

                      <div className="svp-mono truncate mb-1.5">
                        {s.genres.join(' · ') || 'Tür yok'} {s.year && `· ${s.year}`}
                      </div>

                      {!allWatched && nextEp && (
                        <div className="mb-1.5">
                          <span className="svp-count-pill">
                            Sıradaki · S{nextEp.season}B{nextEp.episode}
                          </span>
                        </div>
                      )}

                      <div className="flex gap-1.5 flex-wrap">
                        {watchLinks.map((link, idx) => {
                          const Icon = link.icon;
                          return (
                            <a
                              key={idx}
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="svp-link"
                            >
                              {link.logo ? <img loading="lazy" decoding="async" src={link.logo} alt="Platform" className="w-3 h-3 rounded-sm object-cover"  onError={handleImgFallback}/> : <Icon size={11} />}
                              <span>{link.text}</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* mobilde kolon yığın (istatistik → ilerleme → aksiyonlar); sm: masaüstü satır düzenine sabit */}
                <div className="svp-side flex flex-col sm:flex-col items-stretch sm:items-stretch justify-between sm:justify-center gap-2 px-2.5 py-2.5 sm:p-4 border-t sm:border-t-0 sm:border-l w-full sm:w-auto sm:min-w-[210px] shrink-0">
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <span className="svp-mono">
                      <span className="svp-ic-a2">{watchedCount}</span>/{s.episodes.length} bölüm
                    </span>
                    {allWatched && (
                      <span className="svp-done-tag"><Check size={10} /> Tamam</span>
                    )}
                  </div>

                  {/* BÖLÜM İLERLEME ALANI — yüzde etiketi + ince bar + kademe + hover detay */}
                  <div
                    className="svp-prog flex-1 min-w-0 sm:min-w-[90px]"
                    role="progressbar"
                    aria-valuenow={progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuetext={`${watchedCount} / ${s.episodes.length} bölüm, yüzde ${progressPct}`}
                    aria-label={`${s.title} ilerleme`}
                  >
                    <div className="svp-prog-top">
                      <span className="svp-prog-cap">İlerleme</span>
                      <span className="svp-pct">%{progressPct}</span>
                    </div>

                    <div className="svp-prog-track">
                      <div className="svp-prog-fill" style={{ width: `${progressPct}%` }} />
                      {[25, 50, 75].map((m) => (
                        <span
                          key={m}
                          className={`svp-prog-ms ${progressPct >= m ? 'svp-prog-ms-on' : ''}`}
                          style={{ left: `${m}%` }}
                          aria-hidden="true"
                        />
                      ))}
                    </div>

                    <div className="svp-prog-tip">
                      {allWatched
                        ? 'Tüm bölümler tamamlandı'
                        : nextEp
                          ? `Sıradaki · S${nextEp.season}B${nextEp.episode}`
                          : 'Bölüm yok'}
                      {' · '}
                      {watchedCount}/{s.episodes.length} · %{progressPct}
                    </div>
                  </div>

                  <div className="flex items-center justify-center sm:justify-start gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openSendModal(s);
                      }}
                      title="Arkadaşına Tavsiye Et"
                      className="svp-act svp-act-send p-2 min-h-10 min-w-10 sm:p-2 sm:min-h-0 sm:min-w-0"
                    >
                      <Send size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditTarget(s);
                      }}
                      title="Düzenle"
                      className="svp-act p-2 min-h-10 min-w-10 sm:p-2 sm:min-h-0 sm:min-w-0"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(s);
                      }}
                      title="Sil"
                      className="svp-act svp-act-del p-2 min-h-10 min-w-10 sm:p-2 sm:min-h-0 sm:min-w-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="svp-seasons w-full basis-full border-t">
                    {seasons.length === 0 ? (
                      <div className="p-3 sm:p-4 text-center svp-mono">Henüz bölüm eklenmedi.</div>
                    ) : (
                      seasons.map((season) => {
                        const eps = s.episodes.filter((e) => e.season === season).sort((a, b) => a.episode - b.episode);
                        const seasonAllWatched = eps.length > 0 && eps.every((e) => e.watched);
                        return (
                          <div key={season} className="svp-season-block p-2.5 sm:p-4 border-b last:border-0">
                            <div className="svp-season mb-2 sm:mb-2.5 flex items-center gap-2">
                              {season}. Sezon
                              {seasonAllWatched && (
                                <span className="svp-done-tag"><Check size={10} /> Tamamlandı</span>
                              )}
                            </div>
                            <div className="grid grid-cols-4 xs:grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
                              {eps.map((ep) => {
                                const canWatch = canWatchEpisode(s.id, ep.id);
                                return (
                                  <EpisodeBox
                                    key={ep.id}
                                    episode={ep}
                                    canWatch={canWatch}
                                    onRate={() => {
                                      if (canWatch) setRatingTarget({ series: s, episode: ep });
                                      else showToast('Önce önceki bölümleri izlemelisin!', 'warning');
                                    }}
                                    onUnwatch={() => {
                                      // 1) katman: puan reducer'a girmeden aynaya yazılır
                                      keepRating(ep);
                                      unwatchEpisode(s.id, ep.id);
                                    }}
                                    onEditRating={() => setRatingEditTarget({ series: s, episode: ep })}
                                    onDelete={() => setDeleteEpisodeTarget({ series: s, episode: ep })}
                                    displayRating={ep.rating ?? keptRatings[ep.id] ?? null}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ARKADAŞA TAVSİYE MODALI (TEKLİ & ÇOKLU DİZİ DESTEKLİ, GRID TASARIMLI) */}
      {showSendModal && (
        <div className="svp-overlay fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 animate-fade-in-up" onClick={() => setShowSendModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="svp-modal w-full max-w-4xl h-[85dvh] rounded-3xl overflow-hidden flex flex-col">
            <div className="svp-modal-bar p-4 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="svp-modal-tile"><Send size={15} /></div>
                <h2 className="svp-modal-tag truncate">Arkadaşına Dizi Tavsiyesi Gönder</h2>
              </div>
              <button onClick={() => setShowSendModal(false)} title="Kapat" className="svp-x p-2.5 min-h-11 min-w-11 md:min-h-0 md:min-w-0 md:p-1 shrink-0"><X size={17} /></button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              <div className="svp-modal-side w-full md:w-64 p-4 border-b md:border-b-0 md:border-r flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-shrink-0">
                {loadingFriends ? (
                  <div className="svp-mono text-center py-6 animate-pulse">Arkadaşlar yükleniyor...</div>
                ) : friendsList.length === 0 ? (
                  <div className="svp-empty svp-mono text-center py-8 px-3">
                    Ağında ekli arkadaşın bulunamadı.
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="svp-modal-label mb-1.5">1. Kime Gidecek?</label>
                      <select 
                        value={selectedFriendId} 
                        onChange={(e) => setSelectedFriendId(e.target.value)}
                        className="svp-modal-select"
                      >
                        <option value="">-- Arkadaş Seç --</option>
                        {friendsList.map(f => (
                          <option key={f.agent_id} value={f.agent_id}>{f.nickname}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="svp-modal-label mb-1.5">2. Liste Başlığı</label>
                      <input 
                        type="text" 
                        value={sendListTitle}
                        onChange={(e) => setSendListTitle(e.target.value)}
                        placeholder="Örn: Bu Sezon Kaçırılmayacaklar"
                        className="svp-modal-input"
                      />
                    </div>
                  </>
                )}

                <div className="svp-modal-side pt-3 border-t">
                  <label className="svp-modal-label mb-2">3. Listende Ara</label>
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 svp-ic-muted" />
                    <input 
                      type="text" 
                      placeholder="Dizi adı yaz..."
                      value={sendSeriesSearch}
                      onChange={(e) => setSendSeriesSearch(e.target.value)}
                      className="svp-modal-input pl-8"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden relative">
                <div className="svp-modal-bar p-3 flex items-center justify-between">
                  <span className="svp-modal-cap">Kütüphanen</span>
                  <span className="svp-modal-count">
                    {selectedSeriesIdsForSend.size} Dizi Seçildi
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
                  {filteredSeriesForModal.length === 0 ? (
                    <div className="svp-mono text-center py-6">Dizi bulunamadı.</div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 p-1">
                      {filteredSeriesForModal.map(s => {
                        const isChecked = selectedSeriesIdsForSend.has(s.id);
                        return (
                          <div 
                            key={s.id}
                            onClick={() => toggleSelectSeriesForSend(s.id)}
                            className={`svp-modal-card ${isChecked ? 'svp-modal-card-on' : ''}`}
                          >
                            {s.posterUrl ? (
                              <img loading="lazy" decoding="async" src={s.posterUrl} alt="" className="w-full h-full object-cover"  onError={handleImgFallback}/>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center svp-ic-muted">
                                <Tv size={24} />
                              </div>
                            )}
                            <div className="svp-modal-ov p-2 pt-6">
                              <h3 className="text-[9px] font-bold svp-cap-ink line-clamp-2 leading-tight">{s.title}</h3>
                              <div className="svp-mono mt-0.5 truncate">{s.year || 'Yıl yok'} · {s.episodes.length} bölüm</div>
                            </div>
                            <div className={`svp-modal-veil transition-opacity ${isChecked ? 'opacity-100' : 'opacity-0'}`}>
                              <div className="svp-modal-check">
                                <Check size={18} strokeWidth={4} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="svp-modal-foot p-3.5 flex flex-wrap gap-2 shrink-0">
              <button onClick={() => setShowSendModal(false)} className="svp-btn-s px-4 py-2.5 min-h-11 md:min-h-0">Vazgeç</button>
              <button 
                onClick={handleSendRecommendations} 
                disabled={!selectedFriendId || selectedSeriesIdsForSend.size === 0} 
                className="svp-btn-p flex-1 min-w-[200px] py-2.5 min-h-11 md:min-h-0"
              >
                <Send size={14} /> Tavsiye Listesini Gönder ({selectedSeriesIdsForSend.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {showPick && (
        <PickModal
          seriesCount={nextEpisodes.length}
          unwatchedMovies={[]}
          nextEpisodes={nextEpisodes}
          onPick={(item) => {
            if (item.kind === 'series') setPickedSeriesItem({ series: item.series, episode: item.episode });
          }}
          onClose={() => setShowPick(false)}
        />
      )}

      {pickedSeriesItem && (
        <RatingModal
          title={pickedSeriesItem.series.title}
          subtitle={`${pickedSeriesItem.episode.season}. Sezon ${pickedSeriesItem.episode.episode}. Bölüm`}
          allowPastWatch={false}
          onRate={(rating, note, detailedRating, reviewTags) => {
            watchEpisode(pickedSeriesItem.series.id, pickedSeriesItem.episode.id, rating, note, detailedRating, reviewTags);
            setPickedSeriesItem(null);
          }}
          onClose={() => setPickedSeriesItem(null)}
        />
      )}

      {showAdd && <AddSeriesModal onClose={() => setShowAdd(false)} />}

      {ratingTarget && (
        <RatingModal
          title={ratingTarget.series.title}
          subtitle={`${ratingTarget.episode.season}. Sezon ${ratingTarget.episode.episode}. Bölüm${
            ratingTarget.episode.watched ? ' · Puanı Düzenle' : ''
          }`}
          initialRating={ratingTarget.episode.rating}
          initialNote={ratingTarget.episode.note}
          initialDetailedRating={ratingTarget.episode.detailedRating}
          initialReviewTags={ratingTarget.episode.reviewTags}
          allowPastWatch={false}
          onRate={(rating, note, detailedRating, reviewTags) => {
            const targetEp = ratingTarget.episode;
            // Puanlı bölümde duplicate geçmiş kaydı OLMAMALI: var olan kaydı güncelle
            const hist = data.history.find((h) => h.itemId === targetEp.id || h.id === targetEp.id);
            if (hist) updateHistoryRating(hist.id, rating, note, detailedRating, reviewTags);
            else watchEpisode(ratingTarget.series.id, targetEp.id, rating, note, detailedRating, reviewTags);
          }}
          onClose={() => setRatingTarget(null)}
        />
      )}

      {/* PUAN DÜZENLEME ONAY Uyarısı (çipteki kalem butonu) */}
      {ratingEditTarget && (
        <ConfirmDialog
          title="Puanı Düzenle"
          message="Bu bölümün puanını değiştirmek istiyor musun?"
          confirmLabel="Evet"
          cancelLabel="Hayır"
          onConfirm={() => {
            setRatingTarget({ series: ratingEditTarget.series, episode: ratingEditTarget.episode });
            setRatingEditTarget(null);
          }}
          onCancel={() => setRatingEditTarget(null)}
        />
      )}

      {editTarget && <EditSeriesModal series={editTarget} onClose={() => setEditTarget(null)} />}

      {deleteTarget && (
        <ConfirmDialog
          title="Dizi Sil"
          message={`"${deleteTarget.title}" ve tüm bölümleri silinecek. Emin misin?`}
          onConfirm={() => {
            deleteSeries(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {deleteEpisodeTarget && (
        <ConfirmDialog
          title="Bölümü Sil"
          message={`"${deleteEpisodeTarget.series.title}" dizisinin ${deleteEpisodeTarget.episode.season}. Sezon ${deleteEpisodeTarget.episode.episode}. Bölümü tamamen silinecek. Emin misin?`}
          onConfirm={() => {
            deleteEpisode(deleteEpisodeTarget.series.id, deleteEpisodeTarget.episode.id);
            setDeleteEpisodeTarget(null);
          }}
          onCancel={() => setDeleteEpisodeTarget(null)}
        />
      )}

      {detailSeries && (
        <MediaDetailModal
          target={{ type: 'series', data: detailSeries }}
          onClose={() => setDetailSeriesId(null)}
        />
      )}
    </div>
  );
}

function EpisodeBox({
  episode,
  canWatch,
  displayRating,
  onRate,
  onUnwatch,
  onEditRating,
  onDelete,
}: {
  episode: Episode;
  canWatch: boolean;
  /** Store puanı; yoksa korunan (kept) puan — çip asla kaybolmaz */
  displayRating: number | null;
  onRate: () => void;
  onUnwatch: () => void;
  /** Çipteki kalem → onay uyarısı → RatingModal */
  onEditRating: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {displayRating !== null && (
        <div className="absolute -top-1.5 sm:-top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 pointer-events-none">
          <span
            className={`svp-rate font-bold px-1.5 py-0.5 rounded-full ${ratingBgClass(displayRating)} ${
              episode.watched ? '' : 'svp-rate-kept'
            }`}
          >
            {displayRating}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onEditRating();
            }}
            title="Puanı düzenle"
            aria-label="Bölüm puanını düzenle"
            className="svp-rate-edit pointer-events-auto"
          >
            <Edit2 size={9} strokeWidth={3} />
          </button>
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          // PUANLAMA KORUMA: unwatch reducer'a girmeden önce puan aynaya yazılır
          if (episode.watched) onUnwatch();
          else onRate();
        }}
        disabled={episode.watched ? false : !canWatch}
        className={`svp-ep min-h-10 sm:min-h-11 md:min-h-0 ${
          episode.watched ? 'svp-ep-done' : canWatch ? 'svp-ep-ready' : 'svp-ep-lock'
        }`}
      >
        {episode.watched ? (
          <Check size={14} />
        ) : canWatch ? (
          <span>{episode.episode}</span>
        ) : (
          <Lock size={12} />
        )}
      </button>
      <div className={`svp-ep-num ${episode.watched ? 'opacity-60' : ''}`}>
        {episode.episode}
      </div>
      {showActions && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Bölümü sil"
          className="svp-ep-del"
        >
          <Trash2 size={8} />
        </button>
      )}
    </div>
  );
}
