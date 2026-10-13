import { useState, useMemo, useEffect, useCallback } from 'react';
import * as Icons from 'lucide-react';
import {
  Shuffle, Tv, Sparkles, Trophy, Star, Search,
  Clock, Dna, PlayCircle, ExternalLink, Youtube, Eye, Calendar, Flame,
  ChevronRight, Target, Film, RefreshCw, User, Users, Lock,
  Timer, Play, Pause, X, Compass, ShieldAlert, Copy
} from 'lucide-react';
import { useApp, getMovieTimerInfo, PAST_WATCH_COLLECTION_NAME } from '../context/AppContext';
import { useQuests } from '../context/QuestContext';
import { QUEST_DEFS, RARITY_STYLES } from '../lib/quests';
import { levelFromXp } from '../lib/xp';
import { ACHIEVEMENT_DEFS, TIER_COLORS } from '../lib/achievements';
import { getNextUnwatchedEpisode, formatDateShort, todayStr, normalize } from '../lib/utils';
import { supabase } from '../lib/supabase';
import PickModal from '../components/PickModal';
import RatingModal from '../components/RatingModal';
import BulkAddModal from '../components/BulkAddModal';
import DnaSynthesizerModal from '../components/DnaSynthesizerModal';
import MediaDetailModal from '../components/MediaDetailModal';
import type { DetailModalTarget } from '../components/MediaDetailModal';
import type { Movie, Series, Episode, WatchHistoryItem } from '../types';
import { RANK_TIERS } from '../lib/rankTiers';

// ============================================================
// PREMIUM HOME STILLERİ (sinevia-premium.html kriteri)
// Cam yüzeyler · kırmızı gradyan barlar · mono etiketler ·
// hover kaldırılma + glow · ince ayraçlar · Archivo başlıklar.
// Tüm renkler tema CSS değişkenlerine bağlıdır; premium-dark
// tokenları önce gelir (--red/--red-hi/--red-deep, --glass,
// --line-2, --r, --shadow, --glow), plain-dark gibi token
// tanımsız temalar için zincirleme fallback:
// --color-1/2/3 → sabit değer.
// ============================================================
const HOME_PREMIUM_CSS = `
.hn-sec{display:flex;flex-direction:column;gap:16px}
.hn-sec-t{display:flex;align-items:center;gap:14px}
.hn-sec-t h2{font-family:inherit;font-size:17px;font-weight:900;text-transform:uppercase;letter-spacing:-.01em;color:var(--text-main,#f4f4f2);margin:0}
.hn-sec-t .ln{flex:1;height:1px;background:linear-gradient(90deg,var(--line-2,var(--border-dim,rgba(244,244,242,.13))),transparent)}
.hn-idx{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;letter-spacing:.18em;color:#fff;background:linear-gradient(135deg,var(--red,var(--color-1,#e8384f)),var(--red-deep,var(--color-3,#8e1220)));padding:5px 10px;border-radius:8px;box-shadow:0 4px 14px -4px var(--red,var(--color-1,#e8384f)),inset 0 1px 0 rgba(255,255,255,.3)}
.hn-more{font-family:inherit;font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--muted,#9a9a96);background:none;border:0;cursor:pointer;transition:.2s;display:inline-flex;align-items:center;gap:4px;padding:4px 0}
.hn-more:hover{color:var(--red-hi,var(--color-2,#ff6b7a));transform:translateX(3px)}
.hn-band,.hn-profile,.hn-xp,.hn-spotlight,.hn-duo,.hn-scard,.hn-sc,.hn-rchip,.hn-timer,.hn-bento-card{
  background:var(--glass,var(--bg-card,rgba(255,255,255,.05)));
  border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));
  border-radius:var(--r-lg,22px);
  box-shadow:var(--shadow,0 24px 60px -24px rgba(0,0,0,.8)),inset 0 1px 0 rgba(255,255,255,.07);
}
.hn-rchip{border-radius:var(--r,16px)}

/* ---------- 01 · SERİ + KADEMELER ---------- */
.hn-band{display:flex;flex-wrap:wrap;overflow:hidden}
.hn-streak{display:flex;align-items:center;gap:15px;padding:18px 24px;border-right:1px solid var(--line,rgba(244,244,242,.07));background:linear-gradient(120deg,var(--blob-1,rgba(232,56,79,.14)),transparent 70%)}
.hn-fl{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;color:#fff;flex-shrink:0;background:linear-gradient(140deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));box-shadow:0 8px 22px -8px var(--red,var(--color-1,#e8384f)),inset 0 1px 0 rgba(255,255,255,.4)}
.hn-streak b{font-family:inherit;font-size:19px;font-weight:900;letter-spacing:-.02em;display:block;color:var(--text-main,#f4f4f2)}
.hn-streak b em{font-style:normal;color:var(--red-hi,var(--color-2,#ff6b7a))}
.hn-streak span{font-size:9.5px;font-weight:700;letter-spacing:.16em;color:var(--muted,#9a9a96);text-transform:uppercase}
.hn-tiers{display:flex;flex:1;flex-wrap:wrap}
.hn-tier{flex:1;min-width:104px;padding:15px 16px;border-right:1px solid var(--line,rgba(244,244,242,.07));text-align:center;transition:.22s;cursor:pointer;background:none;color:inherit;font-family:inherit;border:0}
.hn-tier:last-child{border-right:0}
.hn-tier:hover{background:rgba(255,255,255,.05);transform:translateY(-2px)}
.hn-tier b{display:block;font-size:17px;font-weight:900;color:var(--text-main,#f4f4f2)}
.hn-tier span{font-size:9px;font-weight:700;letter-spacing:.14em;color:var(--muted,#9a9a96);text-transform:uppercase}
.hn-tier.br b{color:#C98B4B}.hn-tier.sl b{color:#D3D7DE}.hn-tier.gd b{color:#EFC94C}
.hn-tier.pt b{color:#8BE5EC}.hn-tier.em b{color:#5BDCA3}.hn-tier.di b{color:#7FC1FF}

/* ---------- 02 · PROFİL + XP ---------- */
.hn-profile{display:grid;grid-template-columns:auto 1fr;overflow:hidden}
.hn-avatar-cell{padding:28px 32px;border-right:1px solid var(--line,rgba(244,244,242,.07));display:flex;align-items:center;gap:24px;flex-wrap:wrap}
.hn-ava{position:relative;width:106px;height:106px;flex-shrink:0}
.hn-ava svg{position:absolute;inset:0;width:106px;height:106px;transform:rotate(-90deg);filter:drop-shadow(0 0 10px rgba(232,56,79,.65))}
.hn-core{position:absolute;inset:13px;border-radius:50%;background:linear-gradient(150deg,#23232A,#101014);border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 2px 6px rgba(0,0,0,.7),0 8px 24px -10px rgba(0,0,0,.9);display:grid;place-items:center;font-size:44px;font-weight:900;color:#fff}
.hn-core span{position:relative;z-index:1}
.hn-core-ic{position:absolute;inset:0;margin:auto;width:56px;height:56px;opacity:.18;color:var(--red-hi,var(--color-2,#ff6b7a))}
.hn-lv{position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));color:#fff;font-size:10px;font-weight:900;letter-spacing:.1em;padding:5px 12px;text-transform:uppercase;white-space:nowrap;border-radius:99px;border:3px solid var(--bg-base,#0a0a0d);box-shadow:0 6px 18px -6px var(--red,var(--color-1,#e8384f))}
.hn-persona{font-size:10.5px;font-weight:900;letter-spacing:.24em;color:var(--red-hi,var(--color-2,#ff6b7a));text-transform:uppercase}
.hn-idn h3{font-family:inherit;font-size:34px;font-weight:900;letter-spacing:-.035em;text-transform:uppercase;line-height:1;margin:7px 0 11px;background:linear-gradient(100deg,#fff 30%,#A9A9AE);-webkit-background-clip:text;background-clip:text;color:transparent}
.hn-code-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.hn-code{display:inline-flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-size:11px;background:rgba(255,255,255,.05);border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));padding:6px 12px;color:var(--muted,#9a9a96);border-radius:9px;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.hn-code b{color:var(--text-main,#f4f4f2)}
.hn-copy{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:rgba(255,255,255,.05);border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));color:var(--muted,#9a9a96);cursor:pointer;transition:.2s}
.hn-copy:hover{color:var(--red-hi,var(--color-2,#ff6b7a));border-color:var(--red,var(--color-1,#e8384f))}
.hn-badge-slot{margin-top:13px;display:inline-flex;align-items:center;gap:12px;cursor:pointer;border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));background:var(--glass,var(--bg-card,rgba(255,255,255,.05)));padding:9px 16px 9px 9px;border-radius:15px;transition:.25s cubic-bezier(.2,.7,.3,1);box-shadow:0 8px 24px -14px rgba(0,0,0,.9),inset 0 1px 0 rgba(255,255,255,.08);font-family:inherit;color:inherit}
.hn-badge-slot:hover{border-color:var(--red,var(--color-1,#e8384f));transform:translateY(-2px);box-shadow:var(--glow,0 0 0 1px rgba(232,56,79,.35),0 8px 32px -8px rgba(232,56,79,.45))}
.hn-bi{width:40px;height:40px;border-radius:12px;background:linear-gradient(140deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));color:#fff;display:grid;place-items:center;font-size:17px;box-shadow:0 6px 16px -6px var(--red,var(--color-1,#e8384f)),inset 0 1px 0 rgba(255,255,255,.4);flex-shrink:0}
.hn-badge-empty-ic{color:var(--muted,#9a9a96)}
.hn-bt{text-align:left}
.hn-bt s{display:block;text-decoration:none;font-size:8.5px;font-weight:900;letter-spacing:.2em;color:var(--red-hi,var(--color-2,#ff6b7a));text-transform:uppercase}
.hn-bt b{font-size:13px;font-weight:900;text-transform:uppercase;color:var(--text-main,#f4f4f2)}
.hn-stat-grid{display:grid;grid-template-columns:repeat(5,1fr)}
.hn-stat{padding:22px 14px;border-left:1px solid var(--line,rgba(244,244,242,.07));text-align:center;background:rgba(255,255,255,.02);position:relative;overflow:hidden;transition:.22s}
.hn-stat:first-child{border-left:0}
.hn-stat:hover{background:rgba(255,255,255,.06)}
.hn-stat b{display:block;font-size:27px;font-weight:900;letter-spacing:-.02em;color:var(--text-main,#f4f4f2)}
.hn-stat span.lab{font-size:8.5px;font-weight:700;letter-spacing:.16em;color:var(--muted,#9a9a96);text-transform:uppercase;display:block;margin-top:5px}
.hn-stat.red b{color:var(--red-hi,var(--color-2,#ff6b7a));text-shadow:0 0 22px rgba(232,56,79,.55)}
.hn-stat .ghost{position:absolute;right:-4px;bottom:-6px;opacity:.05;font-size:44px;font-weight:900;color:#fff;pointer-events:none}
.hn-xp{margin-top:-1px;border-radius:0 0 var(--r-lg,22px) var(--r-lg,22px);border-top:0;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));padding:24px 32px}
.hn-xp-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
.hn-xp-head s{display:block;text-decoration:none;font-size:9.5px;font-weight:700;letter-spacing:.2em;color:var(--muted,#9a9a96);text-transform:uppercase}
.hn-xp-bigrow{display:flex;align-items:baseline;gap:10px;margin-top:4px}
.hn-xp-big{font-family:inherit;font-size:28px;font-weight:900;letter-spacing:-.02em;background:linear-gradient(100deg,var(--red-hi,var(--color-2,#ff6b7a)),#fff 70%);-webkit-background-clip:text;background-clip:text;color:transparent}
.hn-xp-pct{font-size:13px;font-weight:700;color:var(--muted,#9a9a96)}
.hn-xp-r{text-align:right}
.hn-xp-left{font-family:inherit;font-size:15px;font-weight:900;color:var(--red-hi,var(--color-2,#ff6b7a))}
.hn-xp-track{margin-top:15px;height:26px;background:rgba(0,0,0,.45);border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));border-radius:99px;position:relative;overflow:hidden;box-shadow:inset 0 2px 6px rgba(0,0,0,.7)}
.hn-xp-fill{position:absolute;top:0;bottom:0;left:0;border-radius:99px;background:linear-gradient(90deg,var(--red-deep,var(--color-3,#8e1220)),var(--red,var(--color-1,#e8384f)) 55%,var(--red-hi,var(--color-2,#ff6b7a)));box-shadow:0 0 22px var(--red,var(--color-1,#e8384f));transition:width 1s ease}
.hn-xp-fill::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);transform:translateX(-100%);animation:hnXpShine 2.6s cubic-bezier(.4,0,.2,1) infinite}
@keyframes hnXpShine{60%,100%{transform:translateX(100%)}}
.hn-xp-cells{position:absolute;inset:0;display:grid;grid-template-columns:repeat(20,1fr);pointer-events:none}
.hn-xp-cells i{border-right:1px solid rgba(0,0,0,.35)}
.hn-xp-cells i:last-child{border:0}
.hn-rank-row{display:flex;justify-content:space-between;align-items:center;margin-top:17px;flex-wrap:wrap;gap:8px}
.hn-rank-row .lab{font-size:9.5px;font-weight:700;letter-spacing:.18em;color:var(--muted,#9a9a96);text-transform:uppercase}
.hn-next-pill{font-size:10.5px;font-weight:900;letter-spacing:.1em;color:var(--red-hi,var(--color-2,#ff6b7a));text-transform:uppercase;background:rgba(232,56,79,.14);border:1px solid rgba(232,56,79,.4);padding:6px 12px;border-radius:99px}
.hn-ranks{display:flex;gap:9px;margin-top:11px;flex-wrap:wrap}
.hn-rank{border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));padding:10px 15px;font-family:inherit;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted,#9a9a96);background:rgba(255,255,255,.03);border-radius:12px;transition:.2s}
.hn-rank:hover{border-color:rgba(255,255,255,.28);color:var(--text-main,#f4f4f2)}
.hn-rank.done{color:var(--text-main,#f4f4f2);background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.16)}
.hn-rank.now{background:linear-gradient(135deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));color:#fff;border-color:transparent;box-shadow:0 8px 22px -8px var(--red,var(--color-1,#e8384f)),inset 0 1px 0 rgba(255,255,255,.35)}
.hn-rank .t{display:block;font-size:9px;letter-spacing:.16em;opacity:.75;font-family:'JetBrains Mono',monospace}

/* ---------- HIZLI ERİŞİM + ZAMANLAYICI ---------- */
.hn-action{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%}
.hn-timer{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:16px 20px}
.hn-timer-ic{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;color:#fff;flex-shrink:0;background:linear-gradient(140deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));box-shadow:0 8px 22px -8px var(--red,var(--color-1,#e8384f)),inset 0 1px 0 rgba(255,255,255,.4)}
.hn-timer-tx{flex:1;min-width:220px}
.hn-timer-status{font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--red-hi,var(--color-2,#ff6b7a));display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.hn-timer-status span{color:var(--text-main,#f4f4f2)}
.hn-timer-sub{font-size:12px;color:var(--muted,#9a9a96);margin-top:5px}
.hn-timer-sub b{color:var(--text-main,#f4f4f2)}
.hn-timer-sub .hn-mono{font-family:'JetBrains Mono',monospace}
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

/* ---------- 03 · GÜNÜN SİNEMA KARTI ---------- */
.hn-spotlight{display:grid;grid-template-columns:280px 1fr;overflow:hidden}
.hn-sp-poster{border-right:1px solid var(--line,rgba(244,244,242,.07));min-height:400px;position:relative;overflow:hidden;background:radial-gradient(420px 320px at 70% 15%,var(--blob-1,rgba(232,56,79,.28)),transparent 60%),linear-gradient(155deg,#2A2118 0%,#161215 55%,#0A0A0D 100%);display:flex;align-items:flex-end;padding:26px;cursor:pointer;font-family:inherit;text-align:left;color:inherit}
.hn-sp-poster:focus-visible{outline:2px solid var(--red,var(--color-1,#e8384f));outline-offset:-2px}
.hn-sp-poster::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(0,0,0,.55));pointer-events:none}
.hn-sp-poster img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35}
.hn-big-letter{position:absolute;inset:0;display:grid;place-items:center;font-size:190px;font-weight:900;color:rgba(255,255,255,.05);letter-spacing:-.06em;user-select:none;pointer-events:none}
.hn-filmbadge{position:absolute;top:0;left:0;z-index:2;color:#fff;font-size:9.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;padding:8px 14px;background:linear-gradient(135deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));border-radius:0 0 14px 0;box-shadow:0 6px 18px -6px var(--red,var(--color-1,#e8384f))}
.hn-rate{position:absolute;top:16px;right:16px;z-index:2;font-weight:900;font-size:16px;background:rgba(10,10,13,.75);border:1px solid rgba(255,255,255,.18);padding:6px 12px;border-radius:12px;color:#fff;backdrop-filter:blur(10px);box-shadow:0 8px 22px -10px rgba(0,0,0,.9)}
.hn-pt{position:relative;z-index:2;font-family:inherit;font-size:26px;font-weight:900;text-transform:uppercase;letter-spacing:-.03em;line-height:1.02;text-shadow:0 4px 24px rgba(0,0,0,.8);color:#fff}
.hn-sp-body{padding:30px 34px;display:flex;flex-direction:column;gap:16px}
.hn-sp-kick{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;letter-spacing:.26em;color:var(--red-hi,var(--color-2,#ff6b7a));text-transform:uppercase}
.hn-sp-body h2{font-family:inherit;font-size:40px;font-weight:900;text-transform:uppercase;letter-spacing:-.035em;line-height:.98;margin:0;background:linear-gradient(100deg,#fff 35%,#9C9CA1);-webkit-background-clip:text;background-clip:text;color:transparent}
.hn-meta-chips{display:flex;gap:8px;flex-wrap:wrap;width:fit-content}
.hn-meta-chips span{font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:8px 14px;color:var(--muted,#9a9a96);background:rgba(255,255,255,.05);border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));border-radius:99px}
.hn-meta-chips span b{color:var(--text-main,#f4f4f2)}
.hn-genre-row{display:flex;gap:8px;flex-wrap:wrap}
.hn-genre{font-family:inherit;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));padding:7px 14px;color:var(--muted,#9a9a96);border-radius:99px;transition:.2s;background:none}
.hn-genre:first-child{color:var(--red-hi,var(--color-2,#ff6b7a));border-color:rgba(232,56,79,.5);background:rgba(232,56,79,.12)}
.hn-gdesc{font-family:inherit;font-size:13.5px;line-height:1.75;color:var(--muted,#9a9a96);max-width:640px;margin:0}
.hn-gdesc b{color:var(--text-main,#f4f4f2);font-weight:700}
.hn-gdesc-empty{font-style:italic}
.hn-btnrow{display:flex;flex-wrap:wrap;gap:11px;margin-top:auto;padding-top:6px}
.hn-links{display:flex;gap:8px;flex-wrap:wrap}
.hn-link-chip{display:inline-flex;align-items:center;gap:7px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted,#9a9a96);background:rgba(255,255,255,.04);border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));padding:8px 13px;border-radius:99px;transition:.2s;text-decoration:none}
.hn-link-chip:hover{color:var(--text-main,#f4f4f2);border-color:rgba(255,255,255,.3);transform:translateY(-2px)}
.hn-link-logo{width:13px;height:13px;border-radius:3px;object-fit:cover}

/* ---------- 04 · ARŞİV KISAYOLLARI ---------- */
.hn-shortcuts{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.hn-sc{padding:26px 20px;text-align:center;position:relative;transition:.28s cubic-bezier(.2,.7,.3,1);cursor:pointer;font-family:inherit;color:inherit}
.hn-sc:hover{transform:translateY(-6px);border-color:var(--red,var(--color-1,#e8384f));box-shadow:0 28px 54px -20px rgba(0,0,0,.9),0 0 34px -12px var(--red,var(--color-1,#e8384f)),inset 0 1px 0 rgba(255,255,255,.1)}
.hn-sc:hover .hn-sci{border-color:var(--red,var(--color-1,#e8384f));color:var(--red-hi,var(--color-2,#ff6b7a));background:rgba(232,56,79,.12);box-shadow:0 0 22px -6px var(--red,var(--color-1,#e8384f));transform:scale(1.06)}
.hn-sci{width:46px;height:46px;margin:0 auto 13px;border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));display:grid;place-items:center;color:var(--muted,#9a9a96);transition:.28s;border-radius:14px;background:rgba(255,255,255,.04)}
.hn-sc b{display:block;font-family:inherit;font-size:34px;font-weight:900;letter-spacing:-.03em;color:var(--text-main,#f4f4f2)}
.hn-sc>span:last-child{font-size:9.5px;font-weight:700;letter-spacing:.18em;color:var(--muted,#9a9a96);text-transform:uppercase}
.hn-sc.red b{color:var(--red-hi,var(--color-2,#ff6b7a));text-shadow:0 0 26px rgba(232,56,79,.6)}

/* ---------- 05 · İZLEMEYE DEVAM ET ---------- */
.hn-series-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.hn-scard{padding:20px;display:flex;gap:16px;transition:.28s cubic-bezier(.2,.7,.3,1)}
.hn-scard:hover{transform:translateY(-6px);border-color:var(--red,var(--color-1,#e8384f));box-shadow:0 30px 56px -22px rgba(0,0,0,.9),0 0 36px -14px var(--red,var(--color-1,#e8384f)),inset 0 1px 0 rgba(255,255,255,.1)}
.hn-sposter{width:86px;flex-shrink:0;aspect-ratio:2/3;border-radius:12px;position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.12);background:linear-gradient(160deg,#221D2A,#0D0D11);display:flex;align-items:flex-end;padding:8px;box-shadow:0 10px 26px -12px rgba(0,0,0,.9);cursor:pointer;font-family:inherit;padding:0}
.hn-sposter img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hn-sl{position:absolute;inset:0;display:grid;place-items:center;font-size:56px;font-weight:900;color:rgba(255,255,255,.07);pointer-events:none}
.hn-ep{position:relative;z-index:1;margin:8px;color:#fff;font-size:8.5px;font-weight:800;letter-spacing:.1em;padding:4px 8px;text-transform:uppercase;background:linear-gradient(135deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));border-radius:7px;box-shadow:0 4px 12px -4px var(--red,var(--color-1,#e8384f))}
.hn-sinfo{flex:1;min-width:0;display:flex;flex-direction:column}
.hn-sinfo h4{font-family:inherit;font-size:15.5px;font-weight:900;text-transform:uppercase;letter-spacing:-.015em;margin:0;color:var(--text-main,#f4f4f2)}
.hn-next-ep{display:inline-block;width:fit-content;margin-top:8px;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;background:rgba(255,255,255,.05);border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));color:var(--muted,#9a9a96);padding:5px 10px;border-radius:99px}
.hn-next-ep b{color:var(--red-hi,var(--color-2,#ff6b7a))}
.hn-prog-lab{display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#9a9a96);margin-top:15px}
.hn-prog-lab i{font-style:normal;color:var(--red-hi,var(--color-2,#ff6b7a))}
.hn-prog{height:8px;background:rgba(0,0,0,.5);border-radius:99px;margin-top:6px;position:relative;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.7)}
.hn-prog i{position:absolute;top:0;bottom:0;left:0;border-radius:99px;background:linear-gradient(90deg,var(--red-deep,var(--color-3,#8e1220)),var(--red-hi,var(--color-2,#ff6b7a)));box-shadow:0 0 12px var(--red,var(--color-1,#e8384f))}
.hn-rate-btn{margin-top:15px;width:100%;padding:11px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));color:var(--muted,#9a9a96);font-family:inherit;font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;transition:.24s;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
.hn-rate-btn:hover{background:linear-gradient(150deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));border-color:transparent;color:#fff;box-shadow:0 10px 26px -8px var(--red,var(--color-1,#e8384f));transform:translateY(-2px)}

/* ---------- 06 · ROZETLER + AĞ ---------- */
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
.hn-axp{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:900;letter-spacing:.08em;color:var(--red-hi,var(--color-2,#ff6b7a));background:rgba(232,56,79,.14);border:1px solid rgba(232,56,79,.45);padding:5px 10px;white-space:nowrap;border-radius:99px}
.hn-pl{display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#9a9a96);margin-top:13px}
.hn-pl i{font-style:normal;color:var(--text-main,#f4f4f2)}
.hn-pt{height:8px;background:rgba(0,0,0,.5);border-radius:99px;margin-top:6px;position:relative;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.7)}
.hn-pt i{position:absolute;top:0;bottom:0;left:0;border-radius:99px;background:linear-gradient(90deg,var(--red-deep,var(--color-3,#8e1220)),var(--red-hi,var(--color-2,#ff6b7a)));box-shadow:0 0 12px var(--red,var(--color-1,#e8384f))}
.hn-net-note{font-family:inherit;font-size:12.5px;line-height:1.7;color:var(--muted,#9a9a96);padding:13px 16px;margin:0 0 18px;background:linear-gradient(120deg,var(--blob-1,rgba(232,56,79,.12)),transparent 80%);border:1px solid rgba(232,56,79,.3);border-radius:14px}
.hn-agents{display:flex;flex-direction:column;gap:9px}
.hn-agent{display:flex;align-items:center;gap:13px;padding:13px 15px;border:1px solid var(--line,rgba(244,244,242,.07));border-radius:14px;background:rgba(255,255,255,.03);transition:.22s}
.hn-agent:hover{background:rgba(255,255,255,.07);border-color:var(--line-2,var(--border-dim,rgba(244,244,242,.13)));transform:translateX(4px)}
.hn-aa{width:38px;height:38px;border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));background:linear-gradient(150deg,#23232A,#131317);display:grid;place-items:center;font-weight:900;font-size:14px;border-radius:12px;color:var(--text-main,#f4f4f2);flex-shrink:0}
.hn-agent-tx{flex:1;min-width:0}
.hn-agent-tx b{font-family:inherit;font-size:13px;font-weight:900;text-transform:uppercase;display:block;color:var(--text-main,#f4f4f2)}
.hn-agent-tx .sub{font-size:9.5px;font-weight:700;letter-spacing:.14em;color:var(--muted,#9a9a96);text-transform:uppercase;display:block;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hn-st{margin-left:auto;font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));padding:5px 10px;color:var(--muted,#9a9a96);border-radius:99px;white-space:nowrap;flex-shrink:0}
.hn-st.on{color:#67E39B;border-color:rgba(78,203,142,.5);background:rgba(78,203,142,.1);box-shadow:0 0 14px -5px rgba(78,203,142,.7)}
.hn-agents-loading{text-align:center;padding:26px 10px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted,#9a9a96);animation:hnPulse 1.6s ease-in-out infinite}
.hn-agents-empty{text-align:center;padding:26px 10px;font-family:inherit;font-size:12.5px;line-height:1.7;color:var(--muted,#9a9a96);background:rgba(255,255,255,.03);border:1px dashed var(--line-2,var(--border-dim,rgba(244,244,242,.13)));border-radius:14px;font-style:italic}
@keyframes hnPulse{50%{opacity:.4}}
.hn-net-more{margin-top:4px;width:100%;padding:12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));color:var(--red-hi,var(--color-2,#ff6b7a));font-family:inherit;font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transition:.24s;display:flex;align-items:center;justify-content:center;gap:6px}
.hn-net-more:hover{background:linear-gradient(150deg,var(--red-hi,var(--color-2,#ff6b7a)),var(--red-deep,var(--color-3,#8e1220)));border-color:transparent;color:#fff;box-shadow:0 10px 26px -8px var(--red,var(--color-1,#e8384f));transform:translateY(-2px)}

/* ---------- 07 · SON İZLENENLER ---------- */
.hn-recent{display:flex;gap:14px;flex-wrap:wrap}
.hn-rchip{display:flex;align-items:center;gap:13px;padding:14px 20px 14px 14px;flex:1;min-width:200px;cursor:pointer;transition:.26s cubic-bezier(.2,.7,.3,1);font-family:inherit;color:inherit;text-align:left}
.hn-rchip:hover{transform:translateY(-5px);border-color:var(--red,var(--color-1,#e8384f));box-shadow:0 24px 46px -18px rgba(0,0,0,.9),0 0 30px -12px var(--red,var(--color-1,#e8384f)),inset 0 1px 0 rgba(255,255,255,.1)}
.hn-th{width:36px;height:50px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:linear-gradient(160deg,#26212F,#0D0D11);display:grid;place-items:center;font-size:16px;font-weight:900;color:rgba(255,255,255,.4);flex-shrink:0;box-shadow:0 8px 20px -10px rgba(0,0,0,.9)}
.hn-rchip-tx{min-width:0}
.hn-rchip-tx b{display:block;font-family:inherit;font-size:12.5px;font-weight:900;text-transform:uppercase;color:var(--text-main,#f4f4f2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hn-rchip-tx>span{display:block;font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;letter-spacing:.12em;color:var(--muted,#9a9a96);text-transform:uppercase;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ---------- BENTO (Nasıl Çalışır) ---------- */
.hn-bento-badge{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:7px 16px;border-radius:99px;font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--red-hi,var(--color-2,#ff6b7a));background:rgba(232,56,79,.1);border:1px solid rgba(232,56,79,.3)}
.hn-bento-title{font-family:inherit;font-size:30px;font-weight:900;letter-spacing:-.03em;text-transform:uppercase;margin:14px 0 0;background:linear-gradient(100deg,#fff 30%,#A9A9AE);-webkit-background-clip:text;background-clip:text;color:transparent}
.hn-bento-card{padding:26px;transition:.28s cubic-bezier(.2,.7,.3,1)}
.hn-bento-card:hover{transform:translateY(-6px);border-color:var(--red,var(--color-1,#e8384f));box-shadow:0 28px 54px -20px rgba(0,0,0,.9),0 0 34px -12px var(--red,var(--color-1,#e8384f)),inset 0 1px 0 rgba(255,255,255,.1)}
.hn-bento-ic{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;margin-bottom:16px;border:1px solid var(--line-2,var(--border-dim,rgba(244,244,242,.13)));background:rgba(255,255,255,.04);color:var(--red-hi,var(--color-2,#ff6b7a));transition:.28s}
.hn-bento-card:hover .hn-bento-ic{border-color:var(--red,var(--color-1,#e8384f));box-shadow:0 0 22px -6px var(--red,var(--color-1,#e8384f));transform:scale(1.06)}
.hn-bento-card h4{font-family:inherit;font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:-.015em;margin:0 0 8px;color:var(--text-main,#f4f4f2)}
.hn-bento-card p{font-family:inherit;font-size:12.5px;line-height:1.7;color:var(--muted,#9a9a96);margin:0}

/* ---------- RESPONSIVE ---------- */
@media (max-width:1080px){
  .hn-profile{grid-template-columns:1fr}
  .hn-avatar-cell{border-right:0;border-bottom:1px solid var(--line,rgba(244,244,242,.07))}
  .hn-stat-grid{grid-template-columns:repeat(3,1fr)}
  .hn-spotlight{grid-template-columns:1fr}
  .hn-sp-poster{min-height:240px;border-right:0;border-bottom:1px solid var(--line,rgba(244,244,242,.07))}
  .hn-series-grid,.hn-shortcuts{grid-template-columns:1fr}
  .hn-duo{grid-template-columns:1fr}
  .hn-panel + .hn-panel{border-left:0;border-top:1px solid var(--line,rgba(244,244,242,.07))}
}
@media (max-width:640px){
  .hn-sec-t h2{font-size:15px}
  .hn-stat-grid{grid-template-columns:repeat(2,1fr)}
  .hn-idn h3{font-size:26px}
  .hn-sp-body h2{font-size:28px}
  .hn-bento-title{font-size:24px}
  .hn-big-letter{font-size:120px}
  .hn-xp{padding:20px 18px}
  .hn-sp-body{padding:22px 18px}
}
@media (prefers-reduced-motion:reduce){
  .hn-xp-fill::before{animation:none}
  .hn-agents-loading{animation:none}
}
`;

// Kademe tintleri — önizleme ile birebir (bronz/gümüş/altın/platin/zümrüt/elmas)
const TIER_TINT: Record<string, string> = {
  bronze: 'rgba(201,139,75,.12)', silver: 'rgba(211,215,222,.10)', gold: 'rgba(239,201,76,.14)',
  platinum: 'rgba(139,229,236,.12)', emerald: 'rgba(91,220,163,.12)', diamond: 'rgba(127,193,255,.12)',
};
const TIER_INK: Record<string, string> = {
  bronze: '#C98B4B', silver: '#D3D7DE', gold: '#EFC94C', platinum: '#8BE5EC', emerald: '#5BDCA3', diamond: '#7FC1FF',
};
const TIER_EDGE: Record<string, string> = {
  bronze: 'rgba(201,139,75,.5)', silver: 'rgba(211,215,222,.45)', gold: 'rgba(239,201,76,.55)',
  platinum: 'rgba(139,229,236,.5)', emerald: 'rgba(91,220,163,.5)', diamond: 'rgba(127,193,255,.5)',
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

  const { questState } = useQuests(); 

  const [showBulkAdd, setShowBulkAdd] = useState<'movie' | 'tv' | false>(false);
  const [showPick, setShowPick] = useState(false);
  const [showDnaModal, setShowDnaModal] = useState(false);
  const [spotlightOffset, setSpotlightOffset] = useState(0);
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
      const { data: fData } = await supabase.from('friendships').select('*').or(`requester_id.eq.${data.agentId},receiver_id.eq.${data.agentId}`).eq('status', 'accepted');
      if (!fData || fData.length === 0) { setNetworkFeed([]); setNetworkLoading(false); return; }
      
      const friendIds = fData.map(f => f.requester_id === data.agentId ? f.receiver_id : f.requester_id);
      
      const { data: pData } = await supabase.from('profiles').select('*').in('agent_id', friendIds);
      const pMap: Record<string, any> = {};
      (pData || []).forEach(p => pMap[p.agent_id] = p);
      setProfilesMap(pMap);

      const { data: logsData } = await supabase.from('network_logs').select('*').in('agent_id', friendIds).order('created_at', { ascending: false }).limit(6);
      setNetworkFeed(logsData || []);
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
    const candidates: { id: string; name: string; desc: string; icon: string; tier: string; current: number; target: number; pct: number; xp: number }[] = [];

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
          icon: def.icon, tier: nextTier.tier, current, target: nextTier.threshold, pct, xp: nextTier.xp,
        });
      }
    });

    return candidates.sort((a, b) => b.pct - a.pct).slice(0, 3);
  }, [data.achievements, data.showLockedNames]);

  const recentWatched = useMemo(() => {
    return [...(data.history || [])]
      .filter((h) => !h.isPastWatch)
      .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
      .slice(0, 5); // Maksimum 5 tane alıyoruz ki tek satıra sığsın
  }, [data.history]);

  const lvl = levelFromXp(data.totalXp);
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

  const navigateTo = (tabId: string) => {
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: tabId }));
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

    const searchQuery = encodeURIComponent(`${movie.title} ${movie.year || ''} izle`);
    links.push({ href: `https://www.google.com/search?q=${searchQuery}`, text: "Google'da Bul", logo: null, icon: Search });

    if (data.altWatchTemplate && (movie.imdbId || data.altWatchTemplate.includes('{slug}') || data.altWatchTemplate.includes('{title}'))) {
      const charMap: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
      const slug = movie.title.toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, (match) => charMap[match]).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const finalAltHref = data.altWatchTemplate.replace('{imdb}', movie.imdbId || '').replace('{slug}', slug).replace('{title}', encodeURIComponent(movie.title)).replace('{year}', movie.year || '');
      links.push({ href: finalAltHref, text: 'Alternatif', logo: null, icon: PlayCircle });
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

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-10 max-w-[1400px] mx-auto">
      <style>{HOME_PREMIUM_CSS}</style>

      {/* =========================================================
          01 · SERİ + KADEMELER
          ========================================================= */}
      <section className="hn-sec">
        <div className="hn-sec-t">
          <span className="hn-idx">01</span>
          <h2>Seri &amp; Kademeler</h2>
          <span className="ln" />
          <button type="button" className="hn-more" onClick={() => navigateTo('achievements')}>Başarımlar <ChevronRight size={13} /></button>
        </div>
        <div className="hn-band">
          <div className="hn-streak">
            <div className="hn-fl"><Flame size={21} /></div>
            <div>
              <b>{data.dailyStreak || 0} <em>Günlük</em> İzleme Serisi</b>
              <span>{data.dailyStreak > 0 ? 'Alev aldın — seriyi bozmadan devam et' : 'Bugün bir yapım izleyerek seriyi başlat'}</span>
            </div>
          </div>
          <div className="hn-tiers">
            {(
              [
                ['br', 'Bronz', quickMetrics.tierCounts.bronze],
                ['sl', 'Gümüş', quickMetrics.tierCounts.silver],
                ['gd', 'Altın', quickMetrics.tierCounts.gold],
                ['pt', 'Platin', quickMetrics.tierCounts.platinum],
                ['em', 'Zümrüt', quickMetrics.tierCounts.emerald],
                ['di', 'Elmas', quickMetrics.tierCounts.diamond],
              ] as const
            ).map(([cls, label, count]) => (
              <button key={cls} type="button" className={`hn-tier ${cls}`} onClick={() => navigateTo('achievements')}>
                <b>{count}</b>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
          02 · PROFİL KARTI + XP
          ========================================================= */}
      <section className="hn-sec">
        <div className="hn-sec-t">
          <span className="hn-idx">02</span>
          <h2>Profil Kartı</h2>
          <span className="ln" />
          <button type="button" className="hn-more" onClick={() => navigateTo('settings')}>Düzenle <ChevronRight size={13} /></button>
        </div>

        <div className="hn-profile" data-tutorial="home-hero">
          <div className="hn-avatar-cell">
            <div className="hn-ava">
              <svg viewBox="0 0 108 108" aria-hidden="true">
                <circle cx="54" cy="54" r={circleRadius} fill="none" stroke="rgba(244,244,242,.09)" strokeWidth="6" />
                <circle cx="54" cy="54" r={circleRadius} fill="none" stroke={userPersona.strokeColor} strokeWidth="6" strokeDasharray={circleCircumference} strokeDashoffset={circleOffset} strokeLinecap="round" />
              </svg>
              <div className="hn-core">
                <span>{data.nickname?.[0]?.toUpperCase() || 'U'}</span>
                <PersonaIcon className="hn-core-ic" />
              </div>
              <div className="hn-lv">Sv. {lvl.level}</div>
            </div>
            <div className="hn-idn">
              <div className="hn-persona">{userPersona.title}</div>
              <h3>{data.nickname}</h3>
              <div className="hn-code-row">
                <span className="hn-code">AĞ KODU <b>{data.agentId}</b></span>
                <button
                  type="button"
                  className="hn-copy"
                  title="Kodu kopyala"
                  onClick={() => { navigator.clipboard.writeText(data.agentId || ''); showToast('Kod kopyalandı!', 'success'); }}
                >
                  <Copy size={13} />
                </button>
              </div>
              {activeBadgeDef ? (
                <button
                  type="button"
                  className="hn-badge-slot"
                  onClick={() => navigateTo('achievements')}
                  title={`${activeBadgeDef.title} (${activeBadgeDef.rarity})`}
                >
                  <span className="hn-bi">{activeBadgeDef.icon}</span>
                  <span className="hn-bt"><s>Aktif Rozet</s><b>{activeBadgeDef.title}</b></span>
                </button>
              ) : (
                <button type="button" className="hn-badge-slot" onClick={() => navigateTo('achievements')}>
                  <ShieldAlert size={18} className="hn-badge-empty-ic" />
                  <span className="hn-bt"><s>Rozet Yuvası Boş</s><b>Koleksiyonundan kuşan</b></span>
                </button>
              )}
            </div>
          </div>

          <div className="hn-stat-grid">
            <div className="hn-stat"><b>{quickMetrics.watchedMoviesCount}</b><span className="lab">Film İzledi</span><span className="ghost">F</span></div>
            <div className="hn-stat"><b>{data.series.filter(s => s.episodes?.every(e => e.watched)).length}</b><span className="lab">Dizi Bitirdi</span><span className="ghost">D</span></div>
            <div className="hn-stat"><b>{quickMetrics.watchedEpsCount}</b><span className="lab">Bölüm İzledi</span><span className="ghost">B</span></div>
            <div className="hn-stat red"><b>{quickMetrics.unlockedAchievementsCount}</b><span className="lab">Rozet Açtı</span><span className="ghost">R</span></div>
            <div className="hn-stat red"><b>{quickMetrics.questsCompleted}</b><span className="lab">Görev Bitti</span><span className="ghost">G</span></div>
          </div>
        </div>

        <div className="hn-xp">
          <div className="hn-xp-head">
            <div>
              <s>Deneyim Puanı (XP) Havuzu</s>
              <div className="hn-xp-bigrow">
                <b className="hn-xp-big">{(data.totalXp || 0).toLocaleString('tr-TR')} XP</b>
                <span className="hn-xp-pct">(%{Math.floor(lvl.progress)})</span>
              </div>
            </div>
            <div className="hn-xp-r">
              <s>Seviye {lvl.level + 1} Hedefi</s>
              <b className="hn-xp-left">{Math.max(0, lvl.nextLevelXp - lvl.currentLevelXp).toLocaleString('tr-TR')} XP Kaldı</b>
            </div>
          </div>

          <div className="hn-xp-track">
            <div className="hn-xp-fill" style={{ width: `${Math.max(3, lvl.progress)}%` }} />
            <div className="hn-xp-cells" aria-hidden="true">
              {Array.from({ length: 20 }).map((_, idx) => <i key={idx} />)}
            </div>
          </div>

          <div className="hn-rank-row">
            <span className="lab">Unvan Evrim Haritası</span>
            {nextRank ? (
              <span className="hn-next-pill">Sonraki Unvan: {nextRank.title} — {nextRank.minLevel - lvl.level} Seviye Kaldı</span>
            ) : (
              <span className="hn-next-pill">Maksimum Unvana Ulaşıldı!</span>
            )}
          </div>

          <div className="hn-ranks">
            {RANK_TIERS.map((tier, idx) => {
              if (idx < currentRankIndex - 1 || idx > currentRankIndex + 2) return null;
              const isUnlocked = lvl.level >= tier.minLevel;
              const isCurrent = idx === currentRankIndex;
              return (
                <div key={tier.title} className={`hn-rank ${isUnlocked ? 'done' : ''} ${isCurrent ? 'now' : ''}`}>
                  <span className="t">Sv. {tier.minLevel}{isCurrent ? ' · Şimdi' : ''}</span>
                  {tier.title}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==============================
          HIZLI ERİŞİM BUTONLARI
          ============================== */}
      <div data-tutorial="home-actions" className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button type="button" className="hn-btn hn-btn-p hn-action" onClick={() => setShowPick(true)}>
          <Shuffle size={16} /> Ne İzlesem?
        </button>
        <button type="button" className="hn-btn hn-btn-s hn-action" onClick={() => setShowDnaModal(true)}>
          <Dna size={16} /> DNA Sentezle
        </button>
        <button type="button" className="hn-btn hn-btn-s hn-action" onClick={() => setShowBulkAdd('movie')}>
          <Compass size={16} /> Katalog Ekle
        </button>
        <button type="button" className="hn-btn hn-btn-g hn-action" onClick={() => navigateTo('plan')}>
          <Calendar size={16} /> Planlayıcı
        </button>
      </div>

      {activeTimerMovie && (() => {
        const info = getMovieTimerInfo(activeTimerMovie, nowMs);
        return (
          <div className="hn-timer">
            <div className="hn-timer-ic"><Timer size={22} /></div>
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
                {info.isPaused ? <><Play size={14} className="hn-btn-ic" /> Devam Et</> : <><Pause size={14} className="hn-btn-ic" /> Duraklat</>}
              </button>
              <button
                type="button"
                className="hn-btn hn-btn-p"
                onClick={() => handleRequestRateMovie(activeTimerMovie)}
                disabled={!info.canRateWithTimer}
              >
                {info.canRateWithTimer ? <><Star size={14} className="hn-btn-ic" /> Bitir &amp; Puanla</> : <><Lock size={13} className="hn-btn-ic" /> Kilitli</>}
              </button>
              <button type="button" className="hn-timer-x" onClick={() => cancelWatchingMovie(activeTimerMovie.id)} title="Sayacı İptal Et">
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* =========================================================
          03 · GÜNÜN SİNEMA KARTI
          ========================================================= */}
      {spotlightMovie && (() => {
        const isSpotlightTimerActive = activeTimerMovie?.id === spotlightMovie.id;
        const spotlightColName = spotlightMovie.collectionId ? data.collections.find((c) => c.id === spotlightMovie.collectionId)?.name : null;
        const spotlightNo = String(data.movies.findIndex((m) => m.id === spotlightMovie.id) + 1).padStart(3, '0');

        return (
          <section className="hn-sec">
            <div className="hn-sec-t">
              <span className="hn-idx">03</span>
              <h2>Günün Sinema Kartı</h2>
              <span className="ln" />
              {eligibleMovies.length > 1 && (
                <button type="button" className="hn-more" onClick={() => setSpotlightOffset((prev) => prev + 1)}>
                  <RefreshCw size={13} /> Kartı Değiştir
                </button>
              )}
            </div>

            <div className="hn-spotlight">
              <div
                className="hn-sp-poster"
                onClick={() => setDetailTarget({ type: 'movie', data: spotlightMovie })}
                role="button"
                tabIndex={0}
                title="Sinema Kartını Gör"
              >
                {spotlightMovie.posterUrl && <img src={spotlightMovie.posterUrl} alt="" />}
                <span className="hn-big-letter" aria-hidden="true">{(spotlightMovie.title || 'S').charAt(0).toUpperCase()}</span>
                <span className="hn-filmbadge">Sinema Kartı</span>
                {spotlightMovie.rating != null && <span className="hn-rate">{spotlightMovie.rating}</span>}
                <div className="hn-pt">{spotlightMovie.title}</div>
              </div>

              <div className="hn-sp-body">
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

                {spotlightMovie.overview ? (
                  <p className="hn-gdesc">{spotlightMovie.overview}</p>
                ) : (
                  <p className="hn-gdesc hn-gdesc-empty">Bu film için henüz özet bilgisi çekilmemiş. Filmler sekmesindeki "Eksikleri Bul" butonuyla özeti indirebilirsin.</p>
                )}

                <div className="hn-btnrow">
                  <button type="button" className="hn-btn hn-btn-p" onClick={() => handleRequestRateMovie(spotlightMovie)}>
                    <Star size={14} className="hn-btn-ic" /> Puanla
                  </button>
                  <button type="button" className="hn-btn hn-btn-s" onClick={() => setDetailTarget({ type: 'movie', data: spotlightMovie })}>
                    <Eye size={14} className="hn-btn-ic" /> Sinema Kartını Gör
                  </button>
                  {!isSpotlightTimerActive && (
                    <button
                      type="button"
                      className="hn-btn hn-btn-g"
                      onClick={() => startWatchingMovie(spotlightMovie.id, false)}
                      disabled={Boolean(activeTimerMovie)}
                    >
                      <Play size={14} className="hn-btn-ic" /> Canlı Geri Sayım
                    </button>
                  )}
                  {isSpotlightPlanned ? (
                    <span className="hn-planned"><Lock size={13} className="hn-btn-ic" /> Takvime Planlandı</span>
                  ) : (
                    <button type="button" className="hn-btn hn-btn-g" onClick={() => navigateTo('plan')}>
                      <Calendar size={14} className="hn-btn-ic" /> Haftalığa Ekle
                    </button>
                  )}
                </div>

                <div className="hn-links">
                  {getMovieWatchLinks(spotlightMovie).map((link, idx) => {
                    const LinkIcon = link.icon;
                    return (
                      <a key={idx} href={link.href} target="_blank" rel="noopener noreferrer" className="hn-link-chip">
                        {link.logo ? <img src={link.logo} alt={link.text} className="hn-link-logo" /> : <LinkIcon size={13} />}
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
          04 · ARŞİV KISAYOLLARI
          ========================================================= */}
      <section className="hn-sec">
        <div className="hn-sec-t">
          <span className="hn-idx">04</span>
          <h2>Arşiv Kısayolları</h2>
          <span className="ln" />
        </div>
        <div className="hn-shortcuts">
          <button type="button" className="hn-sc" onClick={() => navigateTo('movies')}>
            <span className="hn-sci"><Film size={20} /></span>
            <b>{data.movies.length}</b>
            <span>Film Arşivi</span>
          </button>
          <button type="button" className="hn-sc" onClick={() => navigateTo('series')}>
            <span className="hn-sci"><Tv size={20} /></span>
            <b>{data.series.length}</b>
            <span>Dizi Arşivi</span>
          </button>
          <button type="button" className="hn-sc" onClick={() => navigateTo('history')}>
            <span className="hn-sci"><Clock size={20} /></span>
            <b>{quickMetrics.regularHistoryCount}</b>
            <span>Geçmiş Kaydı</span>
          </button>
          <button type="button" className="hn-sc red" onClick={() => navigateTo('achievements')}>
            <span className="hn-sci"><Trophy size={20} /></span>
            <b>{quickMetrics.tierCounts.total}</b>
            <span>Başarım</span>
          </button>
        </div>
      </section>

      {/* =========================================================
          05 · İZLEMEYE DEVAM ET
          ========================================================= */}
      {ongoingSeries.length > 0 && (
        <section className="hn-sec">
          <div className="hn-sec-t">
            <span className="hn-idx">05</span>
            <h2>İzlemeye Devam Et — {ongoingSeries.length} Dizi</h2>
            <span className="ln" />
            <button type="button" className="hn-more" onClick={() => navigateTo('series')}>Tüm Diziler <ChevronRight size={13} /></button>
          </div>

          <div className="hn-series-grid">
            {ongoingSeries.slice(0, 6).map(({ series, episode, watchedCount, totalCount, pct }) => (
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
                    <Star size={12} className="hn-btn-ic" /> Bölümü Puanla
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================
          06 · ROZETLER + SİNEVİA AĞI
          ========================================================= */}
      <section className="hn-sec">
        <div className="hn-sec-t">
          <span className="hn-idx">06</span>
          <h2>Rozetler &amp; Sinevia Ağı</h2>
          <span className="ln" />
        </div>

        <div className="hn-duo">
          <div className="hn-panel">
            <h3>
              <span className="hn-di" /> En Yakın Rozetler
              <button type="button" className="hn-more" onClick={() => navigateTo('achievements')}>Tümü <ChevronRight size={13} /></button>
            </h3>

            {closestAchievements.length === 0 ? (
              <p className="hn-empty">Rozet eşiğine yakın bir izleme yok. Koleksiyonunu büyüt, ilk kademeni aç.</p>
            ) : (
              closestAchievements.map((ach) => {
                const AchIcon = (Icons as any)[ach.icon] || Trophy;
                return (
                  <div key={ach.id} className="hn-ach">
                    <div className="top">
                      <div
                        className="hn-ai"
                        style={{
                          color: TIER_INK[ach.tier] || '#9A9A96',
                          background: TIER_TINT[ach.tier] || 'rgba(255,255,255,.05)',
                          borderColor: TIER_EDGE[ach.tier] || 'var(--line-2, rgba(244,244,242,.13))',
                        }}
                      >
                        <AchIcon size={20} />
                      </div>
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
                  {networkFeed.slice(0, 3).map(log => {
                    const profile = profilesMap[log.agent_id];
                    if (!profile) return null;
                    return (
                      <div key={log.id} className="hn-agent">
                        <div className="hn-aa">{(profile.nickname || profile.agent_id || '?').charAt(0).toUpperCase()}</div>
                        <div className="hn-agent-tx">
                          <b>{profile.nickname || 'Ajan'}</b>
                          <span className="sub">{log.item_title}{log.rating ? ` · ${log.rating} puan` : ''} · {timeAgo(log.created_at)}</span>
                        </div>
                        <span className={`hn-st ${log.rating ? 'on' : ''}`}>{log.rating ? `★ ${log.rating}` : 'İzledi'}</span>
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
          07 · SON İZLENENLER
          ========================================================= */}
      {recentWatched.length > 0 && (
        <section className="hn-sec">
          <div className="hn-sec-t">
            <span className="hn-idx">07</span>
            <h2>Son İzlenenler</h2>
            <span className="ln" />
            <button type="button" className="hn-more" onClick={() => navigateTo('history')}>Geçmiş <ChevronRight size={13} /></button>
          </div>

          <div className="hn-recent">
            {recentWatched.map((h) => {
              const isMovie = h.kind === 'movie' || h.type === 'movie';
              return (
                <button key={h.id} type="button" className="hn-rchip" onClick={() => openHistoryItemDetail(h)}>
                  <span className="hn-th">{(h.title || 'I').charAt(0).toUpperCase()}</span>
                  <span className="hn-rchip-tx">
                    <b>{h.title}</b>
                    <span>{isMovie ? 'Film' : `Dizi S${h.season} B${h.episode}`} · {formatDateShort(h.watchedAt)}{h.rating != null ? ` · ${h.rating}` : ''}</span>
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
      <div className="pt-10 pb-12">
        <div className="text-center mb-10">
          <div className="hn-bento-badge"><Sparkles size={14} /> Yeni Nesil Sinema Deneyimi</div>
          <h3 className="hn-bento-title">Sinevia Nasıl Çalışır?</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Search size={22} /></div>
            <h4>Katalog &amp; Keşif</h4>
            <p>Binlerce yapım arasından filtreleme yap, türlere göre ayır ve kişisel izleme kütüphaneni oluştur.</p>
          </div>
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Dna size={22} /></div>
            <h4>DNA Laboratuvarı</h4>
            <p>İki favori filminin DNA'sını sentezle. Algoritma bu karışımın genetiğine en uygun yapımı bulup önersin.</p>
          </div>
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Shuffle size={22} /></div>
            <h4>Kararsızlık Çarkı</h4>
            <p>Ne izleyeceğine karar veremiyor musun? Türü ve süreyi belirle, sistem senin için kütüphaneden rastgele seçsin.</p>
          </div>
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Calendar size={22} /></div>
            <h4>Haftalık Planlayıcı</h4>
            <p>Hangi gün ne izleyeceğini takvime ekle. Çakışmaları engelle ve izleme maratonunu düzenli hale getir.</p>
          </div>
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Timer size={22} /></div>
            <h4>Canlı İzleme Sayacı</h4>
            <p>Yapıma başladığında sayacı çalıştır, mola verince duraklat. Filmi yeteri kadar izlemeden sahte puan veremezsin.</p>
          </div>
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Star size={22} /></div>
            <h4>Detaylı Puanlama</h4>
            <p>Senaryo, oyunculuk ve görsellik gibi kendi belirlediğin alt kırılımlarla yapıma ince ayarlı bir puan ver.</p>
          </div>
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Target size={22} /></div>
            <h4>Görev &amp; Rozetler</h4>
            <p>Ajan kontratlarını yerine getir. Gizli başarımları açarak XP topla, rütbeni yükselt ve vitrinine rozet kuşan.</p>
          </div>
          <div className="hn-bento-card">
            <div className="hn-bento-ic"><Users size={22} /></div>
            <h4>Sinevia Sosyal Ağı</h4>
            <p>Arkadaşlarını ekle, profillerini gözle, özel film listeleri gönder, canlı mesajlaş ve Liderlik Tablosunda yarış.</p>
          </div>
        </div>
      </div>

      {showBulkAdd && <BulkAddModal initialTab={showBulkAdd} onClose={() => setShowBulkAdd(false)} />}
      {showPick && <PickModal seriesCount={allNextEpisodes.length} unwatchedMovies={eligibleMovies} nextEpisodes={allNextEpisodes} onPick={(item) => setPickedItem(item)} onClose={() => setShowPick(false)} />}
      {showDnaModal && <DnaSynthesizerModal onClose={() => setShowDnaModal(false)} />}
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
