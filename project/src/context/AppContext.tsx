import { createContext, useContext, useEffect, useReducer, useCallback, useRef, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { AppData, Movie, Series, Episode, Collection, WatchHistoryItem, AchievementProgress, RatingCriterion, WatchProvider, WeeklyPlanItem, ExternalActionTemplate, AbandonedProgress, CoinTx } from '../types';
import { normalize, uid, todayStr, daysBetween, localDayKey, withRetry, enqueueLogOp, dequeueLogOp, readLogQueue } from '../lib/utils';
import { ACHIEVEMENT_DEFS } from '../lib/achievements';
import {
  appendCoinTx,
  addEffectCharge,
  addInventoryItem,
  awardLevelCoins,
  awardStreakCoins,
  awardWeeklyActivityCoins,
  coinBalance,
  activeEffectCharges,
  consumeEffectCharge,
  grantCoins as grantCoinsToData,
  hasCoinTx,
  inventoryQuantity,
  pendingLevelCoinTotal,
  removeInventoryItem,
  streakDayCoinReward,
  syncCoinLedger,
  syncMilestoneItems,
  TIER_COIN_REWARDS,
  WEEKLY_ACTIVITY_REQUIRED_DAYS,
} from '../lib/coins';
import { getMarketItem, isPermanentItem, showcaseLimit, type MarketItemKind } from '../lib/marketItems';
import type { ContractRarity } from '../lib/contracts';
import { isSoundBusy, getSoundBusyKind, getSoundBusyRemainingMs } from '../lib/sound';
import { weekKey } from '../lib/contractLogic';
import { levelFromXp } from '../lib/xp';
import {
  appendXpEvent,
  hasXpEvent,
  makeXpEvent,
  mergeXpLedgers,
  migrateLegacyXp,
  normalizeXpEvents,
  sumXpEvents,
  XP_SOURCE_LABELS,
} from '../lib/xpLedger';
import type { XpEvent, XpEventSource } from '../types/appState';
import { calculateEloDelta } from '../lib/calibrationEngine';
import { normalizeActionLabel, rewriteLegacyTemplate } from '../lib/actionBridge';
import {
  applyBackupExtras,
  buildBackupPayload,
  parseBackupPayload,
  readBackupExtras,
  readQuestState,
  writeQuestState,
} from '../lib/appBackup';
import { pruneExpiredPlanItems } from '../lib/planPrune';
import { supabase } from '../lib/supabase';
import { networkGetMe } from '../lib/networkAuth';
import { ensurePushSubscription, saveNotificationPrefs, showAppNotification } from '../lib/notifications';
import {
  idbGet,
  idbDel,
  loadStateV3WithSource,
  saveStateV3,
  saveStateV3Immediate,
  readBootSnapshotV3,
  readLegacyExtras,
  migrateToIdbIfNeeded,
  setStorageErrorHandler,
  PREV_ACCOUNT_KEY,
  isFullAppRecord,
  isIdbAvailable,
} from '../lib/storageService';
import {
  fromLegacyCore,
  isAppStateV3,
  migrateLegacyToV3,
  toLegacyCoreView,
} from '../lib/localStateV3';
import {
  createSupabaseSyncClient,
  createSyncEngine,
  needsOwnerUploadConfirmation,
  shouldRunSync,
  type SyncEngine,
  type SyncMetaStore,
  type SyncRpcClient,
} from '../lib/syncEngine';
import { makeSaveHash } from '../lib/syncContract';
import type { AppStateV3 } from '../types/appState';
import type { ConflictChoice, SyncConflict, SyncResult } from '../types/sync';
import { LibraryContext, GamificationContext, SettingsContext, TimerContext, ActionsContext } from './slices';
import type { LibrarySlice, GamificationSlice, SettingsSlice, TimerSlice, ActionsSlice } from './slices';

const STORAGE_KEY = 'sinevia-v1';
const QUEST_STORAGE_KEY = 'sinevia-quests-v1';
/**
 * Bildirim tercihleri ayrı ve SENKRON bir localStorage anahtarında tutulur.
 * IndexedDB yazımı 250ms gecikebildiği / uygulama anında kapatılabildiği için
 * tam veri hidrasyonu eski `false` değerini geri getirebiliyordu. Bu anahtar
 * kullanıcının bu cihazdaki açık tercihini her zaman kazanır.
 */
const NOTIFICATION_PREFS_KEY = 'sinevia_notification_prefs';
type NotificationPrefs = {
  notificationsEnabled?: boolean;
  notifyMessages?: boolean;
  notifyFriendRequests?: boolean;
  notifyLists?: boolean;
};

function readNotificationPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const prefs: NotificationPrefs = {};
    if (typeof parsed.notificationsEnabled === 'boolean') prefs.notificationsEnabled = parsed.notificationsEnabled;
    if (typeof parsed.notifyMessages === 'boolean') prefs.notifyMessages = parsed.notifyMessages;
    if (typeof parsed.notifyFriendRequests === 'boolean') prefs.notifyFriendRequests = parsed.notifyFriendRequests;
    if (typeof parsed.notifyLists === 'boolean') prefs.notifyLists = parsed.notifyLists;
    return prefs;
  } catch {
    return {};
  }
}

function rememberNotificationPrefs(prefs: NotificationPrefs) {
  try {
    const next = { ...readNotificationPrefs(), ...prefs };
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
  } catch { /* kota / gizli mod */ }
}

function applyNotificationPrefs<T extends Record<string, any>>(input: T): T {
  const prefs = readNotificationPrefs();
  return Object.keys(prefs).length > 0 ? { ...input, ...prefs } : input;
}

export const PAST_WATCH_COLLECTION_NAME = 'Eskiden İzlenenler';
const DEFAULT_GENRES = ['Aksiyon', 'Macera', 'Komedi', 'Dram', 'Korku', 'Bilim Kurgu', 'Fantastik', 'Romantik', 'Gerilim', 'Suç', 'Belgesel', 'Animasyon'];
export const DEFAULT_REVIEW_TAGS = ['🔥 Başyapıt', '🎭 Oyunculuk Muazzam', '🤯 Ters Köşe Final', '🎵 Müzikler Efsane', '🎬 Görsellik Şahane', '🍿 Akıcı & Keyifli', '🧠 Beyin Yakan Kurgu', '💪 Tempo Yavaştı', '📉 Beklentimin Altında', '💩 Bok Gibi'];

const POSITIVE_TAG_EMOJIS = ['🔥', '🎭', '🤯', '🎵', '🎬', '🍿', '🧠', '⭐', '💎', '🏆', '✨', '💪', '🌟', '🥇', '👏', '😍', '❤️', '🤩', '👍'];
const NEGATIVE_TAG_EMOJIS = ['💤', '📉', '💩', '😴', '🤮', '👎', '😩', '😤', '🤦', '💔', '⚠', '🗑️', '🤢', '😈', '💀', '😱'];

export function isPositiveTag(tag: string, sentiments?: Record<string, 'positive' | 'negative'>): boolean {
  if (sentiments && sentiments[tag] !== undefined) return sentiments[tag] === 'positive';
  const code = tag.trim().codePointAt(0);
  if (code === undefined) return true;
  const firstChar = String.fromCodePoint(code);
  if (NEGATIVE_TAG_EMOJIS.includes(firstChar)) return false;
  if (POSITIVE_TAG_EMOJIS.includes(firstChar)) return true;
  return true;
}

export const DISPLAY_DURATION_MS = 4000;
/** XP barı kartı ne kadar ekranda KALIR: bileşen 3200ms'de çıkış animasyonunu
 *  başlatır (380ms sürer) → 3200+380+20 tampon. Bu süre context'ten KISA
 *  kesilirse çıkış animasyonu hiç oynamadan kart yok olur (senkron bozukluğu). */
export const XP_OVERLAY_DURATION_MS = 3600;
const QUEUE_STEP_DURATION_MS = 4100; // toast 4000ms görünür + 100ms nefes payı
// Açılış uzlaşma penceresi: hidrate/bulut senkronu yeniden hesaplamalarının seviye
// "kutlaması" üretmesi yasak (her yenilemede sahte seviye atlama animasyonu engeli).
const BOOT_RECONCILE_WINDOW_MS = 5000;

export interface AIMessage { id: string; sender: 'user' | 'ai'; text: string; timestamp: number; actionItems?: any[]; }
interface MovieExtraData { keywords?: string[]; directors?: string[]; cast?: string[]; studios?: string[]; originalLanguage?: string; inPastQueue?: boolean; }
interface SeriesExtraData { keywords?: string[]; creators?: string[]; cast?: string[]; studios?: string[]; originalLanguage?: string; }

export interface ShowcaseItem {
  id: string;
  title: string;
  type: 'movie' | 'series';
  posterUrl?: string | null;
  year?: string;
  rating?: number | null;
}

export interface ExtendedAppData extends AppData {
  aiChatHistory?: AIMessage[];
  theme?: string;
  reviewTags: string[];
  tagSentiments?: Record<string, 'positive' | 'negative'>;
  notificationsEnabled?: boolean;
  shareWatchedInFeed?: boolean;
  sharePastWatchedInFeed?: boolean;
  notifyMessages?: boolean;
  notifyFriendRequests?: boolean;
  notifyLists?: boolean;
  agentId?: string;      
  nickname?: string;     
  recoveryKey?: string;  
  showcase?: ShowcaseItem[];
  lastCloudSync?: number;
  /**
   * XP'nin TEK kaynağı (append-only). `totalXp` bu defterden TÜRETİLİR:
   * `totalXp = sum(xpEvents.amount)`. V2 kayıtlarında yoktur; göç
   * `migrateLegacyXp` ile tek seferlik `legacy`/`legacy-cloud`/`adjustment`
   * kayıtları üretir. (bkz. src/lib/xpLedger.ts)
   */
  xpEvents?: XpEvent[];
}

function generateAgentId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const p1 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const p2 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `SNV-${p1}-${p2}`;
}

function generateRecoveryKey() {
  return `${uid()}-${uid()}`;
}

/**
 * Bu cihazın kalıcı kimliği (zarf `deviceId`). İlk çağrıda üretilir.
 * `localStorage` erişilemezse sabit bir yedek değer döner (senkron bozulmaz).
 */
function readDeviceId(): string {
  try {
    const existing = localStorage.getItem('sinevia_device_id');
    if (existing) return existing;
    const id = `dev-${uid()}`;
    localStorage.setItem('sinevia_device_id', id);
    return id;
  } catch {
    return 'unknown-device';
  }
}

export function getMovieTimerInfo(movie: Movie, nowMs = Date.now()) {
  const maxMins = movie.runtime && movie.runtime > 0 ? movie.runtime : 115;
  const totalSec = maxMins * 60;
  const minRequiredMins = Math.max(5, Math.ceil(maxMins * 0.15));

  if (!movie.startedAt) {
    return { isActive: false, isPaused: false, elapsedSec: 0, remainingSec: totalSec, elapsedMins: 0, maxMins, minRequiredMins, canRateWithTimer: true, formattedRemaining: '' };
  }

  let elapsedSec = 0;
  let isPaused = false;

  if (movie.startedAt.startsWith('PAUSED:')) {
    isPaused = true;
    elapsedSec = Math.min(totalSec, Math.max(0, parseInt(movie.startedAt.slice(7), 10) || 0));
  } else {
    const startMs = new Date(movie.startedAt).getTime();
    if (!isNaN(startMs)) {
      elapsedSec = Math.min(totalSec, Math.max(0, Math.floor((nowMs - startMs) / 1000)));
    }
  }

  const remainingSec = Math.max(0, totalSec - elapsedSec);
  const elapsedMins = Math.floor(elapsedSec / 60);
  const canRateWithTimer = elapsedMins >= minRequiredMins;

  const hrs = Math.floor(remainingSec / 3600);
  const mins = Math.floor((remainingSec % 3600) / 60);
  const secs = remainingSec % 60;
  const formattedRemaining = hrs > 0
    ? `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return { isActive: true, isPaused, elapsedSec, remainingSec, elapsedMins, maxMins, minRequiredMins, canRateWithTimer, formattedRemaining };
}

function planItemMinuteRange(time: string, runtime?: number): { start: number; end: number } {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10) || 0);
  const start = h * 60 + m;
  const end = start + (runtime && runtime > 0 ? runtime : 115);
  return { start, end };
}

function planItemsOverlap(dateA: string, timeA: string, runtimeA: number | undefined, dateB: string, timeB: string, runtimeB: number | undefined): boolean {
  if (dateA !== dateB) return false;
  const A = planItemMinuteRange(timeA, runtimeA);
  const B = planItemMinuteRange(timeB, runtimeB);
  return A.start < B.end && B.start < A.end;
}

export function computeEndTime(time: string, runtime?: number): string {
  const { end } = planItemMinuteRange(time, runtime);
  const normalizedEnd = ((end % 1440) + 1440) % 1440;
  const h = Math.floor(normalizedEnd / 60);
  const m = normalizedEnd % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function createInitialAchievements(existingList?: AchievementProgress[]): AchievementProgress[] {
  const existingMap = new Map((existingList || []).map((a) => [a.achievementId, a]));
  return ACHIEVEMENT_DEFS.map((def) => {
    const ex = existingMap.get(def.id);
    if (ex) return { ...ex, unlockedTiers: Array.isArray(ex.unlockedTiers) ? [...ex.unlockedTiers] : [], tierDates: ex.tierDates ? { ...ex.tierDates } : {} };
    return { achievementId: def.id, current: 0, unlockedTiers: [], tierDates: {}, lastNotifiedTier: null };
  });
}

function migrateLegacyPastCollection(movies: Movie[] = [], collections: Collection[] = []): { movies: Movie[]; collections: Collection[] } {
  const pastColIds = new Set(
    collections
      .filter((c) => normalize(c.name) === normalize(PAST_WATCH_COLLECTION_NAME))
      .map((c) => c.id)
  );
  const cleanedCollections = collections.filter((c) => normalize(c.name) !== normalize(PAST_WATCH_COLLECTION_NAME));

  const cleanedMovies = movies.map((m) => {
    if (m.collectionId && pastColIds.has(m.collectionId)) {
      return {
        ...m,
        collectionId: null,
        inPastQueue: !m.watched,
        isPastWatch: m.watched ? true : m.isPastWatch,
      };
    }
    if (m.watched && m.inPastQueue) {
      return { ...m, inPastQueue: false };
    }
    return m;
  });

  return { movies: cleanedMovies, collections: cleanedCollections };
}

function defaultData(): ExtendedAppData {
  return {
    agentId: generateAgentId(),
    nickname: 'Yeni Üye',
    recoveryKey: generateRecoveryKey(),
    movies: [], series: [], removedSeriesTitles: [], collections: [],
    genres: DEFAULT_GENRES, reviewTags: DEFAULT_REVIEW_TAGS, history: [],
    achievements: createInitialAchievements(),
    criteria: [
      { id: 'crit_1', name: 'Senaryo ve Hikaye', weight: 10, appliesTo: 'both', genres: [] },
      { id: 'crit_2', name: 'Oyunculuk', weight: 8, appliesTo: 'both', genres: [] },
      { id: 'crit_3', name: 'Görsel Yönetim', weight: 7, appliesTo: 'both', genres: [] }
    ],
    xp: 0, level: 1, totalXp: 0, xpEvents: [], lastWatchDate: null, dailyStreak: 0, dailyStreakDate: null,
    showLockedNames: false, showBadgeDetails: false, reducedMotion: false, fastCelebrations: false, aiChatHistory: [], theme: 'premium-dark',
    altWatchTemplate: 'https://duckduckgo.com/?q=\\site:hdfilmcehennemi.nl+{title}+{year}+izle',
    externalActions: [], totalDuelsCompleted: 0, giantSlayerWins: 0,
    weeklyPlan: [], notificationsEnabled: false, shareWatchedInFeed: true, sharePastWatchedInFeed: true,
    notifyMessages: true, notifyFriendRequests: true, notifyLists: true,
    coins: 150, coinLedger: [{ id: 'welcome', amount: 150, kind: 'welcome', label: 'Pazar açılış hediyesi', refId: 'welcome', createdAt: new Date().toISOString() }], inventory: [], equipped: {}, activeEffects: [],
    marketRerollNonce: 0, marketIntroSeen: false,
    marketStats: { purchases: 0, coinsSpent: 0, contractsCompleted: 0, contractsFailed: 0, weeklyContractsFailed: 0, contractsCancelled: 0 },
    showcase: [],
    lastCloudSync: Date.now()
  };
}

/**
 * Kayıttaki XP defterini normalize eder ve türetilmiş alanları YENİDEN yazar.
 * - `xpEvents` varsa aynen korunur (append-only),
 * - yoksa V2 `totalXp` (ve varsa `bonusXp`/`xpBaseline`) tek seferlik göç eder,
 * - `totalXp`, `level`, `xp` her zaman defterden türetilir (otorite defterdir).
 */
function reconcileXpLedger(state: ExtendedAppData): ExtendedAppData {
  const raw = state as ExtendedAppData & { bonusXp?: number; xpBaseline?: number };
  const events = migrateLegacyXp({
    events: raw.xpEvents,
    localTotalXp: raw.totalXp,
    bonusXp: raw.bonusXp,
    xpBaseline: raw.xpBaseline,
  });
  const totalXp = sumXpEvents(events);
  const levelInfo = levelFromXp(totalXp);
  const { bonusXp: _legacyBonus, xpBaseline: _legacyBaseline, ...rest } = raw;
  return {
    ...rest,
    xpEvents: events,
    totalXp,
    level: levelInfo.level,
    xp: levelInfo.currentLevelXp,
  };
}

/** Yalnız toplamları defterden yeniden hesaplar; göç YAPMAZ. */
function applyLedgerTotals(state: ExtendedAppData): ExtendedAppData {
  const events = normalizeXpEvents(state.xpEvents);
  const totalXp = sumXpEvents(events);
  const levelInfo = levelFromXp(totalXp);
  return {
    ...state,
    xpEvents: events,
    totalXp,
    level: levelInfo.level,
    xp: levelInfo.currentLevelXp,
  };
}

/** Verinin kullanıcıya ait gerçek ilerleme taşıyıp taşımadığını anlar. */
function hasMeaningfulProgress(source: any): boolean {
  if (!source || typeof source !== 'object') return false;
  const movies = Array.isArray(source.movies) ? source.movies.length : 0;
  const series = Array.isArray(source.series) ? source.series.length : 0;
  const history = Array.isArray(source.history) ? source.history.length : 0;
  const achievements = Array.isArray(source.achievements)
    ? source.achievements.reduce(
      (sum: number, item: any) => sum + (Array.isArray(item?.unlockedTiers) ? item.unlockedTiers.length : 0),
      0,
    )
    : 0;
  const totalXp = Array.isArray(source.xpEvents)
    ? sumXpEvents(source.xpEvents)
    : Number(source.totalXp || 0);
  return movies > 0 || series > 0 || history > 0 || achievements > 0 || totalXp > 0;
}

export function resolveTMDBGenres(incomingGenres: string[], existingGenres: string[]): string[] {
  const resolved = incomingGenres.map((incoming) => {
    const cleanIn = normalize(incoming).replace(/[\s-]/g, '');
    let match = existingGenres.find((g) => normalize(g).replace(/[\s-]/g, '') === cleanIn);
    if (match) return match;
    match = existingGenres.find((g) => {
      const cleanG = normalize(g).replace(/[\s-]/g, '');
      return cleanG.length >= 3 && cleanIn.length >= 3 && (cleanIn.startsWith(cleanG) || cleanG.startsWith(cleanIn));
    });
    return match || incoming;
  });
  return Array.from(new Set(resolved));
}

function addNewGenres(currentGenres: string[], incomingGenres: string[]): string[] {
  const newItems = incomingGenres.filter((inc) => !currentGenres.some((cur) => normalize(cur) === normalize(inc)));
  return newItems.length > 0 ? [...currentGenres, ...newItems] : currentGenres;
}

/**
 * XP/SEVİYE UZLAŞTIRMASI — otorite XP DEFTERİDİR.
 *
 * Eski sürüm başarım + görev listelerini yeniden topluyordu (çift sayım ve
 * bulut XP'sinin düşmesi). V3'te buradan HİÇBİR liste okunmaz:
 * `totalXp = sum(xpEvents.amount)`, `level = levelFromXp(totalXp).level`.
 * Defterde yoksa V2 toplamı tek seferlik `legacy` kaydına dönüşür.
 */
function synchronizeXPAndLevel(
  state: ExtendedAppData,
  isSilent = false,
  opts?: { deferLevelUp?: boolean }
): ExtendedAppData {
  const oldLevel = state.level || 1;
  const reconciled = reconcileXpLedger(state);
  const correctedLevelInfo = levelFromXp(reconciled.totalXp);

  const newState: ExtendedAppData = syncMilestoneItems(reconciled, correctedLevelInfo.level);

  // Seviye atlama tetiği: her ara seviye ayrı kutlamaya girer (deferLevelUp ile
  // başarım batch'inde ertelenir — seviyeler XP reveal'ından sırayla enqueue edilir).
  if (!isSilent && !opts?.deferLevelUp) {
    const withCoins = awardLevelCoins(newState, oldLevel, correctedLevelInfo.level);
    const ups = applyLevelUps(withCoins, oldLevel, correctedLevelInfo.level);
    withCoins.pendingLevelUp = ups.pendingLevelUp;
    withCoins.pendingLevelUpQueue = ups.pendingLevelUpQueue;
    return withCoins;
  }

  return newState;
}

function countActiveWatchDaysThisWeek(state: Pick<ExtendedAppData, 'history'>, week = weekKey()): number {
  const days = new Set<string>();
  for (const item of state.history || []) {
    if (item.isPastWatch || !item.watchedAt) continue;
    if (weekKey(item.watchedAt) !== week) continue;
    days.add(localDayKey(item.watchedAt));
  }
  return days.size;
}

/** Günlük seri ve haftalık 5 gün aktivite coinlerini uygular. */
function applyWatchEconomyRewards(state: ExtendedAppData, wasNewDay: boolean): ExtendedAppData {
  let next = state;
  if (wasNewDay) {
    next = awardStreakCoins(next, todayStr(), next.dailyStreak || 0);
  }
  return awardWeeklyActivityCoins(
    next,
    weekKey(),
    countActiveWatchDaysThisWeek(next),
  );
}

function withWatchEconomyRewards(state: ExtendedAppData, wasNewDay: boolean): ExtendedAppData {
  const before = coinBalance(state);
  const rewarded = applyWatchEconomyRewards(state, wasNewDay);
  const gained = coinBalance(rewarded) - before;
  if (gained <= 0) return rewarded;
  return {
    ...rewarded,
    pendingCoinGain: mergePendingCoinGain(
      rewarded.pendingCoinGain,
      gained,
      'İzleme ödülü',
      true,
    ),
  };
}

/**
 * Aynı anda/arka arkaya gelen coin kazanımlarını tek animasyonda birleştirir.
 * `final` yalnızca son parça işlendiğinde true olur; AppContext ara parçaları
 * tüketmez, böylece üst üste başarım/seviye ödülleri tek toplam olarak gösterilir.
 */
function mergePendingCoinGain(
  previous: AppData['pendingCoinGain'],
  addition: number,
  label: string,
  final: boolean
): AppData['pendingCoinGain'] {
  const amount = (previous?.amount ?? 0) + Math.max(0, addition);
  if (amount <= 0) return undefined;
  return {
    amount,
    label: previous?.label || label,
    final,
  };
}

/**
 * Seviye atlama kuyruğu: oldLevel+1..newLevel aralığındaki HER ara seviye ayrı
 * kutlama olarak yazılır. trigger (pendingLevelUp) sıradaki ilk kutlamadır;
 * kalanlar pendingLevelUpQueue'da bekler ve modal her dismiss'te PROMOTE_LEVEL_UP
 * ile sıradaki açılır. existingTop sayesinde sync + reveal kesişiminde çift
 * kutlama oluşmaz (zaten kuyrukta/beğenilmiş olan seviyeler eklenmez).
 */
function applyLevelUps(
  state: Pick<ExtendedAppData, 'pendingLevelUp' | 'pendingLevelUpQueue'>,
  oldLevel: number,
  newLevel: number
): { pendingLevelUp?: { newLevel: number }; pendingLevelUpQueue?: number[] } {
  const keep = {
    pendingLevelUp: state.pendingLevelUp,
    pendingLevelUpQueue: state.pendingLevelUpQueue
  };
  if (newLevel <= oldLevel) return keep;

  const existingTop = Math.max(
    state.pendingLevelUp?.newLevel ?? 0,
    ...(state.pendingLevelUpQueue ?? []),
    0
  );
  const fresh: number[] = [];
  for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
    if (lvl > existingTop) fresh.push(lvl);
  }
  if (fresh.length === 0) return keep;

  if (!state.pendingLevelUp) {
    const [first, ...rest] = fresh;
    return {
      pendingLevelUp: { newLevel: first },
      pendingLevelUpQueue: [...(state.pendingLevelUpQueue ?? []), ...rest]
    };
  }
  return {
    pendingLevelUp: state.pendingLevelUp,
    pendingLevelUpQueue: [...(state.pendingLevelUpQueue ?? []), ...fresh]
  };
}

/**
 * Kör kalibrasyon senkronu: yeni rating'e göre calibratedScore türetir.
 * - Daha önce düelloya girmemişse (duelCount=0) kalibre puan = rating.
 * - Girdiyse kullanıcının puanı değişince BİÇİM bozulmaz: eski sapma
 *   (calibrated − rating) korunarak yeni rating'e eklenir.
 */
function syncCalibratedRating(oldRating: number | null, oldCalibrated: number | undefined, duelCount: number, newRating: number): number {
  const clamp = (n: number) => Math.min(10, Math.max(1, n));
  const r2 = (n: number) => Math.round(n * 100) / 100;
  if (!duelCount || oldCalibrated == null) return r2(clamp(newRating));
  const deviation = oldCalibrated - (oldRating ?? oldCalibrated);
  return r2(clamp(newRating + deviation));
}

type Action =
  | { type: 'ADD_MOVIE'; movie: Movie } | { type: 'DELETE_MOVIE'; id: string }
  | { type: 'START_WATCHING_MOVIE'; id: string; startedAt: string } | { type: 'CANCEL_WATCHING_MOVIE'; id: string }
  | { type: 'WATCH_MOVIE'; id: string; rating: number; note: string; detailedRating?: Record<string, number>; reviewTags?: string[]; watchedAt: string; actualRuntime: number; isPastWatch?: boolean; historyItem: WatchHistoryItem }
  | { type: 'UNWATCH_MOVIE'; id: string }
  | { type: 'UPDATE_HISTORY_RATING'; historyId: string; rating: number; note: string; detailedRating?: Record<string, number>; reviewTags?: string[]; isPastWatch?: boolean }
  | { type: 'ADD_SERIES'; series: Series } | { type: 'DELETE_SERIES'; id: string } | { type: 'COMPLETE_SERIES'; id: string; title: string }
  | { type: 'ADD_EPISODES'; seriesId: string; episodes: Episode[] }
  | { type: 'RESTORE_EPISODES'; seriesId: string; episodes: Episode[] }
  | { type: 'WATCH_EPISODE'; seriesId: string; episodeId: string; rating: number; note: string; detailedRating?: Record<string, number>; reviewTags?: string[]; watchedAt: string; historyItem: WatchHistoryItem }
  | { type: 'UNWATCH_EPISODE'; seriesId: string; episodeId: string } | { type: 'DELETE_EPISODE'; seriesId: string; episodeId: string }
  | { type: 'SET_SERIES_PAST_QUEUE'; id: string; inPastQueue: boolean }
  | { type: 'RATE_SERIES_BULK'; seriesId: string; scope: 'series' | 'season'; season?: number; rating: number; note: string; detailedRating?: Record<string, number>; reviewTags?: string[]; watchedAt: string; isPastWatch?: boolean; historyItems: WatchHistoryItem[]; bulkRuntimeMinutes: number }
  | { type: 'CLEAR_SERIES_RATINGS'; seriesId: string; scope: 'all' | 'series' | 'season'; season?: number }
  | { type: 'CLEAR_SERIES_EPISODE_RATINGS'; seriesId: string; seasons?: number[] }
  | { type: 'ADD_GENRE'; genre: string } | { type: 'DELETE_GENRE'; genre: string } | { type: 'RENAME_GENRE'; oldName: string; newName: string }
  | { type: 'ADD_REVIEW_TAG'; tag: string; sentiment?: 'positive' | 'negative' } | { type: 'DELETE_REVIEW_TAG'; tag: string } | { type: 'RENAME_REVIEW_TAG'; oldTag: string; newTag: string; sentiment?: 'positive' | 'negative' } | { type: 'SET_TAG_SENTIMENT'; tag: string; sentiment: 'positive' | 'negative' }
  | { type: 'EDIT_MOVIE'; id: string; title: string; year: string; genres: string[]; runtime?: number; posterUrl?: string; overview?: string; tmdbId?: number; customUrl?: string; imdbId?: string; watchProviders?: WatchProvider[]; extra?: MovieExtraData }
  | { type: 'EDIT_SERIES'; id: string; title: string; genres: string[]; year?: string; posterUrl?: string; overview?: string; tmdbId?: number; customUrl?: string; imdbId?: string; watchProviders?: WatchProvider[]; extra?: SeriesExtraData }
  | { type: 'ADD_COLLECTION'; collection: Collection } | { type: 'DELETE_COLLECTION'; id: string } | { type: 'RENAME_COLLECTION'; id: string; name: string }
  | { type: 'SET_MOVIE_COLLECTION'; id: string; collectionId: string | null }
  | { type: 'SET_MOVIE_PAST_QUEUE'; id: string; inPastQueue: boolean }
  | { type: 'IMPORT_DATA'; data: ExtendedAppData } | { type: 'MERGE_SHARED_LIST'; movies: Movie[]; series: Series[]; collections: Collection[]; genres: string[] }
  | { type: 'HYDRATE_FROM_IDB'; data: ExtendedAppData }
  | { type: 'SET_ACHIEVEMENT_PROGRESS'; progress: AchievementProgress[] }
  | { type: 'TOGGLE_LOCKED_NAMES' } | { type: 'TOGGLE_BADGE_DETAILS' } | { type: 'TOGGLE_REDUCED_MOTION' } | { type: 'TOGGLE_FAST_CELEBRATIONS' } | { type: 'CONSUME_NEXT_TOAST' } | { type: 'CLEAR_LEVELUP' } | { type: 'CLEAR_XP_GAIN' } | { type: 'PROMOTE_LEVEL_UP' } | { type: 'CLEAR_LEVEL_UP_QUEUE' } | { type: 'SYNC_ACHIEVEMENTS' }
  | { type: 'UPDATE_AI_HISTORY'; messages: AIMessage[] }
  | { type: 'ADD_CRITERION'; criterion: RatingCriterion } | { type: 'EDIT_CRITERION'; id: string; criterion: RatingCriterion } | { type: 'DELETE_CRITERION'; id: string }
  | { type: 'UPDATE_ALT_TEMPLATE'; template: string } | { type: 'SET_THEME'; theme: string }
  | {
      type: 'GRANT_XP';
      xp: number;
      /** Defter kaynağı; verilmezse 'system'. */
      source?: XpEventSource;
      /** İdempotency anahtarı. Verilmezse her çağrı tekil sayılır. */
      sourceId?: string;
      label?: string;
      /** Çarpan öncesi taban; verilmezse `xp`. */
      base?: number;
      multiplier?: number;
    }
  | { type: 'ADD_PLAN_ITEM'; item: WeeklyPlanItem }
  | { type: 'DELETE_PLAN_ITEM'; id: string }
  | { type: 'UPDATE_PLAN_ITEM'; id: string; date: string; time: string }
  | { type: 'PRUNE_EXPIRED_PLAN_ITEMS'; today?: string }
  | { type: 'TOGGLE_NOTIFICATIONS'; enabled: boolean }
  | { type: 'TOGGLE_SHARE_WATCHED'; enabled: boolean }
  | { type: 'TOGGLE_SHARE_PAST_WATCHED'; enabled: boolean }
  | { type: 'SET_NICKNAME'; nickname: string }
  | { type: 'RECOVER_IDENTITY'; agentId: string; recoveryKey: string; nickname: string }
  | { type: 'TOGGLE_SPECIFIC_NOTIFICATION'; key: 'notifyMessages' | 'notifyFriendRequests' | 'notifyLists'; enabled: boolean }
  | { type: 'SET_SHOWCASE'; showcase: ShowcaseItem[] }
  | { type: 'FORCE_XP_SYNC' }
  | { type: 'REPLACE_FROM_CLOUD_STORAGE'; data: ExtendedAppData; questData?: any }
  | { type: 'ABANDON_MEDIA'; mediaType: 'movie' | 'series'; id: string; abandonedAt?: string; progress?: AbandonedProgress; reasons?: string[]; note?: string }
  | { type: 'REVIVE_MEDIA'; mediaType: 'movie' | 'series'; id: string }
  | { type: 'RESOLVE_DUEL'; winnerId: string; loserId: string; mediaType?: 'movie' | 'series' }
  | { type: 'APPLY_CALIBRATION_SUGGESTION'; id: string; newRating: number }
  | { type: 'SET_EXTERNAL_ACTIONS'; actions: ExternalActionTemplate[] }
  | { type: 'GRANT_COINS'; amount: number; kind: CoinTx['kind']; label: string; refId: string; itemId?: string }
  | { type: 'GRANT_CONTRACT_REWARD'; xp: number; coins: number; refId: string; label: string; base?: number; multiplier?: number; sourceId?: string }
  | { type: 'PURCHASE_ITEM'; itemId: string; name: string; price: number; kind: string; consumable?: boolean; coupon?: boolean }
  | { type: 'EQUIP_ITEM'; slot: 'frameId' | 'titleId' | 'badgeId' | 'badgeId2' | 'backgroundId' | 'nameEffectId'; itemId: string | null }
  | { type: 'USE_ITEM'; itemId: string; effect: string; label: string }
  | { type: 'PIN_CONTRACT'; contractId: string; week: string }
  | { type: 'CONSUME_EFFECT'; itemId: string }
  | { type: 'SET_SERIES_RUNTIME'; seriesId: string; episodeRuntime?: number; runtimes?: Record<string, number> }
  | { type: 'MARK_MARKET_INTRO_SEEN' }
  | { type: 'REROLL_MARKET' }
  | { type: 'CLEAR_COIN_GAIN' }
  | { type: 'GRANT_ITEM'; itemId: string; label: string; refId: string }
  | { type: 'RECORD_MARKET_OUTCOME'; outcome: 'failed' | 'cancelled'; weekly: boolean; penalty: number; label: string; refId: string };

const FIXED_BUGGED_ACHIEVEMENTS = new Set(['selective_critic', 'weekend_cinema', 'loyalty_test', 'break_taker', 'lost_colony', 'final_phobia', 'ghost_viewer', 'secret_critic']);

// Tutorial ilerlemesini oku (gizli başarım için): adım-tutorial + akademi dersi toplamı
function readTutorialUnitCount(): number {
  try {
    const raw = localStorage.getItem('sinevia-tutorial-v1');
    if (!raw) return 0;
    const p = JSON.parse(raw);
    const stepDone = Array.isArray(p.completed) ? p.completed.length : 0;
    const academyDone = Array.isArray(p.academyDone) ? p.academyDone.length : 0;
    return stepDone + academyDone;
  } catch {
    return 0;
  }
}

/**
 * Puan (rating) değerine BAĞLI başarımlar: bir yapımın puanı değiştirildiğinde
 * (10 → 1 gibi) bu başarımların yeni kilitleri yeniden açılamaz. Örn. filmi 10
 * verip "10 puan verme" başarımını aldıktan sonra 1'e çevirmek "1 puan verme"
 * başarımını kazandırmaz. İlk puan ataması (WATCH_MOVIE) normal yoldan geçer.
 */
const RATING_SCOPED_ACHIEVEMENTS = new Set([
  'perfect_rating', 'high_rating', 'low_rating', 'hater', 'polarization',
  'selective_critic', 'secret_perfectionist', 'past_masterpiece', 'past_series_masterpiece',
]);

export function applyAchievements(state: ExtendedAppData, opts?: { skipRatingUnlocks?: boolean }): ExtendedAppData {
  const unlocked: { achievementId: string; tier: string; xp: number; name: string; icon: string; description: string }[] = [];

  const allValidHistory = [...(state.history || [])].filter((h) => {
    if (!h.watchedAt) return false;
    const t = new Date(h.watchedAt).getTime();
    return !isNaN(t) && t > 1262304000000;
  }).sort((a, b) => new Date(a.watchedAt).getTime() - new Date(b.watchedAt).getTime());

  const validHistory = allValidHistory.filter((h) => !h.isPastWatch);
  const moviesHistory = validHistory.filter((h) => h.type === 'movie' || h.kind === 'movie');
  const seriesHistory = validHistory.filter((h) => h.type === 'series' || h.kind === 'series');

  const maxConsecutiveDays = (dates: Iterable<string>) => {
    const unique = Array.from(new Set(dates)).sort();
    let max = 0, current = 0;
    for (let i = 0; i < unique.length; i++) {
      if (i === 0) { current = 1; max = 1; continue; }
      const diff = Math.round((new Date(unique[i]).getTime() - new Date(unique[i - 1]).getTime()) / 86400000);
      current = diff === 1 ? current + 1 : 1;
      if (current > max) max = current;
    }
    return max;
  };

  const newAchievements = createInitialAchievements(state.achievements);
  const progressMap = new Map(newAchievements.map((a) => [a.achievementId, a]));

  const watchedMovies = state.movies.filter((m) => m.watched && !m.isPastWatch);
  const watchedMoviesWithRuntime = watchedMovies.filter((m) => m.runtime);
  const pastWatchedMovies = state.movies.filter((m) => m.watched && m.isPastWatch);
  const pastWatchedSeries = state.series.filter((s) => s.isPastWatch && s.overallRating !== null);
  const movieById = new Map(state.movies.map((m) => [m.id, m]));
  const seriesById = new Map(state.series.map((s) => [s.id, s]));

  // Tek geçiş: tüm başarımların okuduğu ortak sayaçlar burada bir kez hesaplanır.
  const M = {
    tens: 0, nines: 0, low3: 0, low2: 0, rated: 0, ratedWithNote: 0, noted: 0,
    epicNotes: 0, emptyNotes: 0, trashNotes: 0, capsNotes: 0,
    nightOwl: 0, weekendWatcher: 0, newYearLonely: 0, lightSpeed: 0,
    morningSweet: 0, nostalgia: 0, movieRated: 0, movieHasTen: false,
    seriesBulkCount: 0, timeBender: 0, epicWatcher: 0, shortSweet: 0,
    liveTimer: 0, speedWatcher: 0, timeSaver: 0, patientPurist: 0, secretSpeedrunner: 0,
    marathonDays: 0, maxSeriesDay: 0, maxWeekendMovies: 0, caveman: 0,
    maxLoyalty: 0, maxGap: 0, couchPotatoDays: 0, uniqueRatings: 0,
    seriesTime: 0, seriesCompleteTime: 0, seriesBingeTime: 0,
    collectionComplete: 0, universeConqueror: 0,
    finalPhobia: 0, delayedGoodbye: 0,
  };
  const uniqueRatings = new Set<number>();
  const uniqueGenres = new Set<string>();
  const movieDays = new Set<string>();
  const seriesDays = new Set<string>();
  const allBulkFreeDayCounts: Record<string, number> = {};
  const seriesBulkFreeDayCounts: Record<string, number> = {};
  const movieDayCounts: Record<string, number> = {};
  const movieWeekendCounts: Record<string, number> = {};
  const loyaltyDaysBySeries: Record<string, Set<string>> = {};
  const watchTimesBySeries: Record<string, number[]> = {};
  const couchPotatoDayMinutes: Record<string, number> = {};
  const movieGenreCounts = { action: 0, comedy: 0, drama: 0, horror: 0, scifi: 0 };
  const seriesGenreIds = {
    action: new Set<string>(), comedy: new Set<string>(), drama: new Set<string>(),
    horror: new Set<string>(), scifi: new Set<string>(),
  };

  for (const h of validHistory) {
    const ts = new Date(h.watchedAt);
    const day = localDayKey(h.watchedAt);
    const isMovie = h.type === 'movie' || h.kind === 'movie';
    const isSeries = h.type === 'series' || h.kind === 'series';
    const rating = h.rating;
    const note = h.note;
    const noteLen = note ? note.trim().length : 0;
    const bulk = Boolean(h.bulkRating);
    const hr = ts.getHours();
    const dow = ts.getDay();

    if (h.genres) for (const g of h.genres) uniqueGenres.add(g);

    if (rating !== null && rating !== undefined) {
      M.rated++;
      uniqueRatings.add(rating);
      if (rating === 10) M.tens++;
      if (rating === 9 || rating === 9.5) M.nines++;
      if (rating <= 3) M.low3++;
      if (rating <= 2) M.low2++;
      if (noteLen > 0) M.ratedWithNote++;
    }
    if (noteLen > 0) M.noted++;
    if (noteLen >= 5000) M.epicNotes++;
    if (noteLen === 0) M.emptyNotes++;
    if (rating !== null && rating !== undefined && rating < 3 && noteLen >= 500) M.trashNotes++;
    if (noteLen >= 5) {
      const n = note!.trim();
      if (/[a-zA-ZğüşöçİĞÜŞÖÇ]/.test(n) && n === n.toLocaleUpperCase('tr-TR')) M.capsNotes++;
    }

    if (!bulk) {
      if (hr >= 0 && hr < 5) M.nightOwl++;
      if (dow === 0 || dow === 6) M.weekendWatcher++;
      if ((ts.getMonth() === 11 && ts.getDate() === 31 && hr >= 20) || (ts.getMonth() === 0 && ts.getDate() === 1 && hr <= 4)) M.newYearLonely++;
      allBulkFreeDayCounts[day] = (allBulkFreeDayCounts[day] || 0) + 1;
      if (isSeries) {
        seriesBulkFreeDayCounts[day] = (seriesBulkFreeDayCounts[day] || 0) + 1;
        M.seriesBulkCount++;
      }
    }

    if (h.genres) {
      let gAction = false, gComedy = false, gDrama = false, gHorror = false, gScifi = false;
      for (const g of h.genres) {
        const tr = g.toLocaleLowerCase('tr-TR');
        const en = g.toLowerCase();
        if (!gAction && (tr.includes('aksiyon') || en.includes('action'))) gAction = true;
        if (!gComedy && (tr.includes('komedi') || en.includes('comedy'))) gComedy = true;
        if (!gDrama && (tr.includes('dram') || en.includes('drama'))) gDrama = true;
        if (!gHorror && (tr.includes('korku') || en.includes('horror'))) gHorror = true;
        if (!gScifi && (tr.includes('bilim kurgu') || tr.includes('bilimkurgu') || en.includes('sci-fi') || en.includes('scifi'))) gScifi = true;
      }
      if (isMovie) {
        if (gAction) movieGenreCounts.action++;
        if (gComedy) movieGenreCounts.comedy++;
        if (gDrama) movieGenreCounts.drama++;
        if (gHorror) movieGenreCounts.horror++;
        if (gScifi) movieGenreCounts.scifi++;
      }
      if (isSeries) {
        const sid = h.seriesId || h.itemId || h.id;
        if (gAction) seriesGenreIds.action.add(sid);
        if (gComedy) seriesGenreIds.comedy.add(sid);
        if (gDrama) seriesGenreIds.drama.add(sid);
        if (gHorror) seriesGenreIds.horror.add(sid);
        if (gScifi) seriesGenreIds.scifi.add(sid);
      }
    }

    if (isMovie) {
      movieDays.add(day);
      movieDayCounts[day] = (movieDayCounts[day] || 0) + 1;
      if (rating !== null && rating !== undefined) M.movieRated++;
      if (rating === 10) M.movieHasTen = true;
      if (hr >= 6 && hr < 9) M.morningSweet++;
      if (h.year && parseInt(h.year) <= 1980) M.nostalgia++;
      if (dow === 0 || dow === 6) {
        const sat = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate() - (dow === 0 ? 1 : 0));
        const k = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, '0')}-${String(sat.getDate()).padStart(2, '0')}`;
        movieWeekendCounts[k] = (movieWeekendCounts[k] || 0) + 1;
      }
      const m = movieById.get(h.itemId || h.id);
      const mins = h.actualRuntime || m?.actualRuntime || m?.runtime;
      if (mins) couchPotatoDayMinutes[day] = (couchPotatoDayMinutes[day] || 0) + mins;
      if (rating !== null && rating !== undefined && m?.addedAt) {
        const addTime = new Date(m.addedAt).getTime(), watchTime = ts.getTime();
        if (!isNaN(addTime) && addTime > 1262304000000 && (watchTime - addTime) / 3600000 <= 24 && watchTime - addTime >= 0) M.lightSpeed++;
      }
    }

    if (isSeries) {
      seriesDays.add(day);
      const sid = h.seriesId || h.itemId || h.id;
      if (!loyaltyDaysBySeries[sid]) loyaltyDaysBySeries[sid] = new Set();
      loyaltyDaysBySeries[sid].add(day);
      if (!watchTimesBySeries[sid]) watchTimesBySeries[sid] = [];
      watchTimesBySeries[sid].push(ts.getTime());
      if (rating !== null && rating !== undefined) {
        const s = seriesById.get(sid);
        if (s?.addedAt) {
          const addTime = new Date(s.addedAt).getTime(), watchTime = ts.getTime();
          if (!isNaN(addTime) && addTime > 1262304000000 && (watchTime - addTime) / 3600000 <= 24 && watchTime - addTime >= 0) M.lightSpeed++;
        }
      }
    }
  }

  M.marathonDays = Object.values(allBulkFreeDayCounts).filter((c) => c >= 3).length;
  M.maxSeriesDay = Math.max(0, ...Object.values(seriesBulkFreeDayCounts));
  M.maxWeekendMovies = Math.max(0, ...Object.values(movieWeekendCounts));
  M.uniqueRatings = uniqueRatings.size;
  M.couchPotatoDays = Object.values(couchPotatoDayMinutes).filter((m) => m > 300).length;

  // "Caveman": günde 5+ izleme yapılan günlerin en uzun kesintisiz serisi.
  {
    const qualifying = Object.keys(allBulkFreeDayCounts).filter((d) => allBulkFreeDayCounts[d] >= 5).sort();
    let streak = 0;
    for (let i = 0; i < qualifying.length; i++) {
      if (i === 0) { streak = 1; M.caveman = 1; continue; }
      const diff = Math.round((new Date(qualifying[i]).getTime() - new Date(qualifying[i - 1]).getTime()) / 86400000);
      streak = diff === 1 ? streak + 1 : 1;
      if (streak > M.caveman) M.caveman = streak;
    }
  }

  Object.values(loyaltyDaysBySeries).forEach((daySet) => {
    const maxForSeries = maxConsecutiveDays(daySet);
    if (maxForSeries > M.maxLoyalty) M.maxLoyalty = maxForSeries;
  });
  Object.values(watchTimesBySeries).forEach((times) => {
    const sorted = [...times].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      const gap = Math.max(0, (sorted[i] - sorted[i - 1]) / 86400000);
      if (gap > M.maxGap) M.maxGap = gap;
    }
  });
  M.maxGap = Math.floor(M.maxGap);

  for (const m of watchedMovies) {
    if (m.actualRuntime != null && m.runtime != null && m.actualRuntime < m.runtime) {
      M.speedWatcher++;
      M.timeSaver += m.runtime - m.actualRuntime;
    }
    if (m.startedAt != null && m.actualRuntime != null) M.liveTimer++;
    if (m.startedAt != null && m.actualRuntime != null && m.runtime != null && m.actualRuntime >= m.runtime) M.patientPurist++;
    if (m.actualRuntime != null && m.runtime != null && m.runtime >= 90 && m.actualRuntime <= Math.floor(m.runtime / 2)) M.secretSpeedrunner++;
  }
  for (const m of watchedMoviesWithRuntime) {
    M.timeBender += m.actualRuntime && m.actualRuntime > 0 ? Math.min(m.actualRuntime, m.runtime || 110) : (m.runtime || 0);
    if ((m.runtime || 0) >= 180) M.epicWatcher++;
    if ((m.runtime || 0) > 0 && (m.runtime || 0) < 90) M.shortSweet++;
  }

  // Dizi sezonları: toplam izleme süresi, biten dizi süresi ve günlük binge rekoru.
  {
    const bingeDayMinutes: Record<string, number> = {};
    for (const s of state.series.filter((x) => !x.isPastWatch)) {
      const eps = s.episodes || [];
      let total = 0;
      for (const ep of eps) {
        if (!ep.watched) continue;
        const mins = ep.runtime || s.episodeRuntime || 0;
        total += mins;
        if (mins > 0 && ep.watchedAt) {
          const key = localDayKey(ep.watchedAt);
          bingeDayMinutes[key] = (bingeDayMinutes[key] || 0) + mins;
        }
      }
      M.seriesTime += total;
      if (eps.length > 0 && eps.every((ep) => ep.watched)) M.seriesCompleteTime += total;
    }
    M.seriesBingeTime = Math.max(0, ...Object.values(bingeDayMinutes));
  }

  // Koleksiyonlar: hem "tamamlanan" hem "3+ filmi tamamlanan evren" sayısı tek gezide.
  {
    const moviesByCollection = new Map<string, typeof state.movies>();
    for (const m of state.movies) {
      if (!m.collectionId) continue;
      const list = moviesByCollection.get(m.collectionId) || [];
      list.push(m);
      moviesByCollection.set(m.collectionId, list);
    }
    for (const col of state.collections || []) {
      if (normalize(col.name) === normalize(PAST_WATCH_COLLECTION_NAME)) continue;
      const cm = moviesByCollection.get(col.id) || [];
      if (cm.length > 0 && cm.every((m) => m.watched)) M.collectionComplete++;
      if (cm.length >= 3 && cm.every((m) => m.watched)) M.universeConqueror++;
    }
  }

  // Sezon finali fobisi / geç vedalaşma: her dizi tek kez gezilir.
  for (const s of state.series.filter((x) => !x.isPastWatch)) {
    if (!s.episodes || s.episodes.length < 2) continue;
    const eps = [...s.episodes].sort((a, b) => (a.season === b.season ? a.episode - b.episode : a.season - b.season));
    const finalEp = eps[eps.length - 1], penEp = eps[eps.length - 2];
    if (!(penEp.watched && penEp.watchedAt)) continue;
    const penTime = new Date(penEp.watchedAt).getTime();
    const finalTime = finalEp.watched && finalEp.watchedAt ? new Date(finalEp.watchedAt).getTime() : Date.now();
    if (isNaN(penTime) || penTime < 1262304000000 || isNaN(finalTime) || finalTime < 1262304000000) continue;
    const gap = Math.max(0, (finalTime - penTime) / 86400000);
    if (!finalEp.watched) M.finalPhobia = Math.max(M.finalPhobia, gap);
    if (finalEp.watched && gap >= 90) M.delayedGoodbye++;
  }
  M.finalPhobia = Math.floor(M.finalPhobia);

  const maxMovieDayStreak = maxConsecutiveDays(movieDays);
  const maxSeriesDayStreak = maxConsecutiveDays(seriesDays);

  const ruthlessCritic = state.movies.filter((m) => m.abandoned && (m.runtime || 0) > 0 && m.abandonedProgress?.unit !== 'episode' && (m.abandonedProgress?.value ?? 0) <= (m.runtime || 0) / 2).length;
  const detailMaster = state.movies.filter((m) => m.detailedRating && Object.keys(m.detailedRating).length > 0).length;
  const reviewTagger = state.movies.filter((m) => (m.reviewTags || []).length > 0).length;
  const spiderSense = state.movies.filter((m) => !m.watched && m.year && parseInt(m.year) > new Date().getFullYear()).length;
  const patienceStone = state.series.filter((s) => !s.isPastWatch && s.episodes && s.episodes.length > 0 && Math.max(...s.episodes.map((e) => e.season)) >= 8 && s.episodes.every((e) => e.watched)).length;
  const halfCenturySeries = state.series.filter((s) => !s.isPastWatch && s.episodes && s.episodes.length > 100 && s.episodes.every((e) => e.watched)).length;
  const seasonComplete = (() => {
    let c = 0;
    state.series.filter((s) => !s.isPastWatch).forEach((s) => {
      const eps = s.episodes || [];
      const ratedSeasons = new Set(Object.keys(s.seasonRatings || {}).map(Number));
      const seas = new Set([...eps.map((e) => e.season), ...ratedSeasons]);
      seas.forEach((season) => {
        const sEps = eps.filter((e) => e.season === season);
        const bulkCompleted = s.overallRating != null || ratedSeasons.has(season);
        if (bulkCompleted || (sEps.length > 0 && sEps.every((e) => e.watched))) c++;
      });
    });
    return c;
  })();
  const tutorialUnits = readTutorialUnitCount();

  for (const def of ACHIEVEMENT_DEFS) {
    const prog = progressMap.get(def.id);
    if (!prog) continue;
    let currentVal = 0;

    switch (def.id) {
      case 'movie_add': currentVal = state.movies.length; break;
      case 'series_add': currentVal = state.series.length; break;
      case 'daily_movie': currentVal = maxMovieDayStreak; break;
      case 'daily_series': currentVal = maxSeriesDayStreak; break;
      case 'movie_genre_action': currentVal = movieGenreCounts.action; break;
      case 'series_genre_action': currentVal = seriesGenreIds.action.size; break;
      case 'movie_genre_comedy': currentVal = movieGenreCounts.comedy; break;
      case 'series_genre_comedy': currentVal = seriesGenreIds.comedy.size; break;
      case 'movie_genre_drama': currentVal = movieGenreCounts.drama; break;
      case 'series_genre_drama': currentVal = seriesGenreIds.drama.size; break;
      case 'movie_genre_horror': currentVal = movieGenreCounts.horror; break;
      case 'series_genre_horror': currentVal = seriesGenreIds.horror.size; break;
      case 'movie_genre_scifi': currentVal = movieGenreCounts.scifi; break;
      case 'series_genre_scifi': currentVal = seriesGenreIds.scifi.size; break;
      case 'perfect_rating': case 'secret_perfectionist': currentVal = M.tens; break;
      case 'high_rating': currentVal = M.nines; break;
      case 'low_rating': currentVal = M.low3; break;
      case 'secret_critic': case 'hater': currentVal = M.low2; break;
      case 'first_rating': currentVal = M.rated; break;
      case 'strict_critic': currentVal = M.ratedWithNote; break;
      case 'total_watch': case 'sinevia_legend': currentVal = validHistory.length; break;
      case 'genre_explorer': currentVal = uniqueGenres.size; break;
      case 'note_taker': currentVal = M.noted; break;
      case 'night_owl': currentVal = M.nightOwl; break;
      case 'weekend_watcher': currentVal = M.weekendWatcher; break;
      case 'marathon': currentVal = M.marathonDays; break;
      case 'secret_binge': currentVal = M.maxSeriesDay; break;
      case 'season_complete': currentVal = seasonComplete; break;
      case 'collection_complete': currentVal = M.collectionComplete; break;
      case 'caveman': currentVal = M.caveman; break;
      case 'epic_writer': currentVal = M.epicNotes; break;
      case 'ghost_viewer': currentVal = M.emptyNotes; break;
      case 'trash_lover': currentVal = M.trashNotes; break;
      case 'polarization': currentVal = M.tens >= 20 && M.low2 >= 20 ? 1 : 0; break;
      case 'new_year_lonely': currentVal = M.newYearLonely; break;
      case 'cinephile': currentVal = seriesHistory.length > 0 ? 0 : moviesHistory.length; break;
      case 'short_day_profit': currentVal = Object.values(movieDayCounts).filter((c) => c >= 3).length; break;
      case 'selective_critic': currentVal = M.movieHasTen ? 0 : M.movieRated; break;
      case 'weekend_cinema': currentVal = M.maxWeekendMovies; break;
      case 'episode_monster': currentVal = M.seriesBulkCount; break;
      case 'patience_stone': currentVal = patienceStone; break;
      case 'loyalty_test': currentVal = M.maxLoyalty; break;
      case 'break_taker': case 'lost_colony': currentVal = M.maxGap; break;
      case 'morning_sweet': currentVal = M.morningSweet; break;
      case 'nostalgia_wind': currentVal = M.nostalgia; break;
      case 'universe_conqueror': currentVal = M.universeConqueror; break;
      case 'final_phobia': case 'delayed_goodbye': currentVal = def.id === 'final_phobia' ? M.finalPhobia : M.delayedGoodbye; break;
      case 'half_century_series': currentVal = halfCenturySeries; break;
      case 'series_time': currentVal = M.seriesTime; break;
      case 'series_binge_time': currentVal = M.seriesBingeTime; break;
      case 'series_complete_time': currentVal = M.seriesCompleteTime; break;
      case 'market_buyer': currentVal = state.marketStats?.purchases || 0; break;
      case 'market_spender': currentVal = state.marketStats?.coinsSpent || 0; break;
      case 'contract_finisher': currentVal = state.marketStats?.contractsCompleted || 0; break;
      case 'weekly_contract_fail': currentVal = state.marketStats?.weeklyContractsFailed || 0; break;
      case 'contract_cancelled': currentVal = state.marketStats?.contractsCancelled || 0; break;
      case 'light_speed': currentVal = M.lightSpeed; break;
      case 'color_palette': currentVal = M.uniqueRatings; break;
      case 'caps_lock': currentVal = M.capsNotes; break;
      case 'spider_sense': currentVal = spiderSense; break;
      case 'time_bender': currentVal = M.timeBender; break;
      case 'epic_watcher': currentVal = M.epicWatcher; break;
      case 'short_sweet': currentVal = M.shortSweet; break;
      case 'couch_potato': currentVal = M.couchPotatoDays; break;
      case 'live_timer': currentVal = M.liveTimer; break;
      case 'speed_watcher': currentVal = M.speedWatcher; break;
      case 'time_saver': currentVal = M.timeSaver; break;
      case 'patient_purist': currentVal = M.patientPurist; break;
      case 'secret_speedrunner': currentVal = M.secretSpeedrunner; break;
      case 'past_watcher': currentVal = pastWatchedMovies.length; break;
      case 'past_masterpiece': currentVal = pastWatchedMovies.filter((m) => m.rating === 10).length; break;
      case 'past_critic': currentVal = pastWatchedMovies.filter((m) => m.rating !== null && m.note && m.note.trim().length > 0).length; break;
      case 'past_series_watcher': currentVal = pastWatchedSeries.length; break;
      case 'past_series_masterpiece': currentVal = pastWatchedSeries.filter((s) => s.overallRating === 10).length; break;
      case 'past_series_critic': currentVal = pastWatchedSeries.filter((s) => s.overallNote && s.overallNote.trim().length > 0).length; break;
      case 'ruthless_critic': currentVal = ruthlessCritic; break;
      case 'scale_master': currentVal = state.totalDuelsCompleted || 0; break;
      case 'secret_duelist': currentVal = (state.movies || []).reduce((sum, m) => sum + (m.duelWins || 0), 0); break;
      case 'secret_giant_slayer': currentVal = state.giantSlayerWins || 0; break;
      case 'detail_master': currentVal = detailMaster; break;
      case 'review_tagger': currentVal = reviewTagger; break;
      case 'tutorial_explorer': currentVal = tutorialUnits; break;
    }

    prog.current = currentVal;

    if (FIXED_BUGGED_ACHIEVEMENTS.has(def.id)) {
      prog.unlockedTiers = prog.unlockedTiers.filter((tName) => {
        const tDef = def.tiers.find((x) => x.tier === tName);
        const keep = tDef ? currentVal >= tDef.threshold : false;
        if (!keep && prog.tierDates) delete prog.tierDates[tName];
        return keep;
      });
    }

    for (const tier of def.tiers) {
      if (currentVal >= tier.threshold) {
        if (!prog.unlockedTiers.includes(tier.tier)) {
          // Puan değişim aksiyonlarında puan-bağılı yeni kilit açılmaz (ilerleme `current` güncellenir).
          if (opts?.skipRatingUnlocks && RATING_SCOPED_ACHIEVEMENTS.has(def.id)) continue;
          prog.unlockedTiers.push(tier.tier);
          if (!prog.tierDates) prog.tierDates = {};
          prog.tierDates[tier.tier] = new Date().toISOString();
          prog.unlockedAt = new Date().toISOString();
          prog.lastNotifiedTier = tier.tier;
          unlocked.push({ achievementId: def.id, tier: tier.tier, xp: tier.xp, name: tier.name || def.name, icon: def.icon, description: def.description.replace('{threshold}', String(tier.threshold)) });
        } else {
          if (!prog.tierDates) prog.tierDates = {};
          const d = prog.tierDates[tier.tier];
          if (!d || d.startsWith('2000-') || d.startsWith('1970-')) {
            const fb = allValidHistory.length > 0 ? allValidHistory[allValidHistory.length - 1].watchedAt : new Date().toISOString();
            prog.tierDates[tier.tier] = fb;
            if (!prog.unlockedAt || prog.unlockedAt.startsWith('2000-') || prog.unlockedAt.startsWith('1970-')) prog.unlockedAt = fb;
          }
        }
      }
    }
  }

  let stateWithAchievements = { ...state, achievements: newAchievements };
  // Başarım XP'si XP DEFTERİNE idempotent şekilde yazılır: (achievement, ach:<id>:<tier>).
  // Liste XP toplamı için ASLA yeniden taranmaz — defter tek doğrudur.
  let ledger = normalizeXpEvents(stateWithAchievements.xpEvents);
  const credited = unlocked.filter((entry) => {
    const appended = appendXpEvent(ledger, makeXpEvent({
      source: 'achievement',
      sourceId: `ach:${entry.achievementId}:${entry.tier}`,
      label: `${entry.name} · ${entry.tier}`,
      base: entry.xp,
      multiplier: 1,
      meta: { achievementId: entry.achievementId, tier: entry.tier },
    }));
    ledger = appended.events;
    return appended.added;
  });
  stateWithAchievements = { ...stateWithAchievements, xpEvents: ledger };
  // Başarım batch'inde seviye tetiği ERTELENİR: unlock XP'leri totalXp'ye yazılır ama
  // kutlama tetiklenmez — her toast reveal'ında CONSUME_NEXT_TOAST seviye farkını
  // kuyruğa yazar (causal sıra: başarım XP'si → o XP'nin seviye atlama animasyonu →
  // sıradaki başarım → … → sonraki seviye).
  stateWithAchievements = synchronizeXPAndLevel(
    stateWithAchievements,
    false,
    credited.length > 0 ? { deferLevelUp: true } : undefined
  );
  // Başarımlardan kazanılan SineCoin'ler ledger'a idempotent şekilde yazılır.
  stateWithAchievements = syncCoinLedger(stateWithAchievements);

  if (credited.length > 0) {
    const existingQueue = stateWithAchievements.pendingToasts || [];
    const uniqueUnlocked = credited.filter((u) => !existingQueue.some((eq) => eq.achievementId === u.achievementId && eq.tier === u.tier));
    return { ...stateWithAchievements, pendingToasts: [...existingQueue, ...uniqueUnlocked] };
  }
  return stateWithAchievements;
}

export function rootReducer(state: ExtendedAppData, action: Action): ExtendedAppData {
  if (action.type === 'REPLACE_FROM_CLOUD_STORAGE') {
    // "Bulutu bu cihaza indir" yolu: veri birebir buluttaki halidir. Burada
    // applyAchievements/synchronizeXPAndLevel'in XP listesi taraması ÇALIŞMAZ.
    // Defter kayıttan aynen korunur; yoksa V2 toplamı tek seferlik göç eder;
    // totalXp/level her hâlükârda defterden yeniden hesaplanır.
    if (localStorage.getItem('sinevia_zero_reset') === '1') return state;
    if (action.questData) {
      localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(action.questData));
    }
    return applyLedgerTotals(reconcileXpLedger({ ...defaultData(), ...action.data }));
  }

  if (action.type === 'HYDRATE_FROM_IDB') {
    // IndexedDB'den gelen ana kütüphane verisini uygula. Mevcut state'teki kimlik/ayar
    // tercihleri koru (eğer IDB'de yoksa), achievements'ları yeniden uygula. Saf bir birleşim.
    const merged: ExtendedAppData = {
      ...defaultData(),
      ...(action.data as any),
      agentId: action.data.agentId || state.agentId,
      nickname: action.data.nickname || state.nickname,
      recoveryKey: action.data.recoveryKey || state.recoveryKey,
      theme: action.data.theme || state.theme,
    };
    // Defter korunur: hidrasyondaki kayıt + bu oturumdaki defter birleşir
    // ((source, sourceId) tekilleştirilir). Kayıtta defter yoksa V2 toplamı göç eder.
    const hydratedLedger = mergeXpLedgers(
      reconcileXpLedger(merged).xpEvents,
      normalizeXpEvents(state.xpEvents),
    );
    // Hidrasyon uzlaşması da kutlama üretmemeli (gerçek seviye atlama sadece oyun içindedir).
    const hydrated = applyAchievements({ ...merged, xpEvents: hydratedLedger });
    return applyNotificationPrefs({ ...hydrated, pendingLevelUp: undefined, pendingLevelUpQueue: undefined });
  }

  if (action.type === 'RECOVER_IDENTITY') {
    return { ...state, agentId: action.agentId, recoveryKey: action.recoveryKey, nickname: action.nickname };
  }

  if (action.type === 'IMPORT_DATA') {
    const migrated = migrateLegacyPastCollection(action.data.movies, action.data.collections);
    const preservedIdentity = {
      agentId: state.agentId,
      nickname: state.nickname,
      recoveryKey: state.recoveryKey
    };
    return applyAchievements(
      reconcileXpLedger({
        ...defaultData(),
        ...action.data,
        ...preservedIdentity,
        collections: migrated.collections,
        movies: migrated.movies,
        achievements: createInitialAchievements(action.data.achievements),
      })
    );
  }
  if (action.type === 'FORCE_XP_SYNC') {
    // Bilinçli yeniden hesaplama: yalnız defterden türetilir. Başarım/görev
    // listeleri XP kaynağı DEĞİLDİR; defter yoksa V2 toplamı göç eder.
    return synchronizeXPAndLevel(state, false);
  }
  if (action.type === 'CONSUME_NEXT_TOAST') {
    const queue = state.pendingToasts || [];
    if (queue.length === 0) return state;
    const currentToast = queue[0], remainingQueue = queue.slice(1);
    // Toplu açılmalarda tüm başarım XP'si unlock anında totalXp'ye HEPİSİ birden
    // yazılır. Barın 5 → 55 → 70 diye ADIM ADIM ilerlemesi için: henüz tüketilmemiş
    // kuyruk XP'si "açıklanmamış" sayılır → eski = toplam − kuyruk toplamı,
    // yeni = eski + bu toast'ın xp'si (tek toast'larda eski davranışla aynı).
    const totalXp = state.totalXp || 0;
    const queueTotal = queue.reduce((sum, t) => sum + (t.xp || 0), 0);
    const revealedBefore = Math.max(0, totalXp - queueTotal);
    const revealedAfter = revealedBefore + (currentToast.xp || 0);
    // Reveal sırasında seviye atlandıysa HER ara seviye kutlama kuyruğuna girer
    // (başarım XP reveal'ı ile seviye animasyonu arasında causal bağ).
    const oldLevel = levelFromXp(revealedBefore).level;
    const newLevel = levelFromXp(revealedAfter).level;
    const levelUps = applyLevelUps(state, oldLevel, newLevel);
    // Başarım coinleri + reveal sırasında atlanan seviyelerin coinleri adım adım
    // birikir; animasyon ancak son toast açıklandığında tetiklenir.
    const levelCoinTotal = pendingLevelCoinTotal(state, oldLevel, newLevel);
    const achievementCoin = TIER_COIN_REWARDS[currentToast.tier as keyof typeof TIER_COIN_REWARDS] || 0;
    const next = awardLevelCoins(state, oldLevel, newLevel);
    const pendingCoinGain = mergePendingCoinGain(
      state.pendingCoinGain,
      achievementCoin + levelCoinTotal,
      queue.length === 1 ? queue[0].name : `${queue.length} başarım ödülü`,
      remainingQueue.length === 0,
    );
    return {
      ...next,
      pendingToasts: remainingQueue,
      pendingXpGain: {
        gained: currentToast.xp || 0,
        oldTotal: revealedBefore,
        newTotal: revealedAfter,
        source: 'achievement',
        label: currentToast.name,
      },
      pendingCoinGain,
      ...levelUps
    };
  }
  if (action.type === 'CLEAR_LEVELUP') return { ...state, pendingLevelUp: undefined };
  // Modal dismiss edilince sıradaki seviye kutlaması açılır (tetik CLEAR ile zaten temizlendi).
  if (action.type === 'PROMOTE_LEVEL_UP') {
    if (state.pendingLevelUp || !state.pendingLevelUpQueue?.length) return state;
    const [nextLevel, ...rest] = state.pendingLevelUpQueue;
    return { ...state, pendingLevelUp: { newLevel: nextLevel }, pendingLevelUpQueue: rest.length ? rest : undefined };
  }
  // Boot/hidrasyon tarafında bekleyen seviye kuyruğunu temizler.
  if (action.type === 'CLEAR_LEVEL_UP_QUEUE') {
    if (!state.pendingLevelUpQueue?.length) return state;
    return { ...state, pendingLevelUpQueue: undefined };
  }
  if (action.type === 'CLEAR_XP_GAIN') return { ...state, pendingXpGain: undefined };
  if (action.type === 'CLEAR_COIN_GAIN') return { ...state, pendingCoinGain: undefined };
  if (action.type === 'TOGGLE_LOCKED_NAMES') return { ...state, showLockedNames: !state.showLockedNames };
  if (action.type === 'TOGGLE_BADGE_DETAILS') return { ...state, showBadgeDetails: !state.showBadgeDetails };
  if (action.type === 'TOGGLE_REDUCED_MOTION') return { ...state, reducedMotion: !state.reducedMotion };
  if (action.type === 'TOGGLE_FAST_CELEBRATIONS') return { ...state, fastCelebrations: !state.fastCelebrations };
  if (action.type === 'SET_ACHIEVEMENT_PROGRESS') return { ...state, achievements: action.progress };
  if (action.type === 'UPDATE_AI_HISTORY') return { ...state, aiChatHistory: action.messages };
  if (action.type === 'UPDATE_ALT_TEMPLATE') return { ...state, altWatchTemplate: action.template };
  if (action.type === 'SET_THEME') return { ...state, theme: action.theme };
  if (action.type === 'TOGGLE_NOTIFICATIONS') return { ...state, notificationsEnabled: action.enabled };
  if (action.type === 'TOGGLE_SHARE_WATCHED') return { ...state, shareWatchedInFeed: action.enabled };
  if (action.type === 'TOGGLE_SHARE_PAST_WATCHED') return { ...state, sharePastWatchedInFeed: action.enabled };
  if (action.type === 'TOGGLE_SPECIFIC_NOTIFICATION') return { ...state, [action.key]: action.enabled };
  if (action.type === 'SET_NICKNAME') return { ...state, nickname: action.nickname };
  if (action.type === 'SET_SHOWCASE') return { ...state, showcase: action.showcase.slice(0, showcaseLimit(state.perks)) };
  if (action.type === 'SET_EXTERNAL_ACTIONS') return { ...state, externalActions: action.actions };

  if (action.type === 'GRANT_COINS') {
    const next = grantCoinsToData(state, action.amount, action.kind, action.label, action.refId, action.itemId);
    if (action.amount > 0) {
      const hasToasts = (next.pendingToasts?.length ?? 0) > 0;
      next.pendingCoinGain = mergePendingCoinGain(
        next.pendingCoinGain,
        action.amount,
        action.label,
        !hasToasts,
      );
    }
    return next;
  }
  if (action.type === 'GRANT_CONTRACT_REWARD') {
    if (hasCoinTx(state.coinLedger, action.refId)) return state;
    const oldTotalXp = sumXpEvents(normalizeXpEvents(state.xpEvents));
    const oldLevel = levelFromXp(oldTotalXp).level;
    let next = appendCoinTx(state, {
      id: action.refId,
      refId: action.refId,
      amount: action.coins,
      kind: 'contract',
      label: action.label,
      createdAt: new Date().toISOString(),
    });
    // Kontrat XP'si deftere yazılır: (contract, contract:<instanceId>).
    // Çarpanlı kazançlarda base ve multiplier AYRI saklanır; amount nihaîdir.
    const sourceId = action.sourceId || (action.refId.startsWith('contract:') ? action.refId : `contract:${action.refId}`);
    const base = Number.isFinite(Number(action.base)) ? Number(action.base) : action.xp;
    const multiplier = Number.isFinite(Number(action.multiplier))
      ? Number(action.multiplier)
      : (base !== 0 ? action.xp / base : 1);
    const appended = appendXpEvent(next.xpEvents, makeXpEvent({
      source: 'contract',
      sourceId,
      label: action.label,
      base,
      multiplier,
      meta: { refId: action.refId },
    }));
    next = { ...next, xpEvents: appended.events };
    const levelData = levelFromXp(sumXpEvents(appended.events));
    next = {
      ...next,
      totalXp: sumXpEvents(appended.events),
      xp: levelData.currentLevelXp,
      level: levelData.level,
      marketStats: {
        ...(next.marketStats || { purchases: 0, coinsSpent: 0, contractsCompleted: 0, contractsFailed: 0, weeklyContractsFailed: 0, contractsCancelled: 0 }),
        contractsCompleted: (next.marketStats?.contractsCompleted || 0) + 1,
      },
    };
    // Başarımlar kontrat XP'siyle tetiklenebilir; seviye kutlaması ve seviye
    // coinleri başarım reveal'ına bırakılmadan burada açıkça hesaplanır.
    next = applyAchievements(next);
    const finalLevel = levelFromXp(next.totalXp).level;
    const levelCoinTotal = pendingLevelCoinTotal(next, oldLevel, finalLevel);
    const withLevels = awardLevelCoins(next, oldLevel, finalLevel);
    const hasToasts = (withLevels.pendingToasts?.length ?? 0) > 0;
    const contractCoinTotal = Math.max(0, action.coins || 0);
    const totalCoinGain = contractCoinTotal + levelCoinTotal;
    const pendingCoinGain = (totalCoinGain > 0 || state.pendingCoinGain)
      ? mergePendingCoinGain(
          state.pendingCoinGain,
          totalCoinGain,
          contractCoinTotal > 0 ? action.label : 'Seviye ödülleri',
          !hasToasts,
        )
      : undefined;
    const levelUps = applyLevelUps(withLevels, oldLevel, finalLevel);
    const gained = appended.added ? Math.round(base * multiplier) : 0;
    return {
      ...withLevels,
      ...levelUps,
      pendingXpGain: {
        gained,
        oldTotal: oldTotalXp,
        newTotal: oldTotalXp + gained,
        source: 'contract',
        label: action.label,
      },
      pendingCoinGain,
    };
  }
  if (action.type === 'RECORD_MARKET_OUTCOME') {
    if (state.coinLedger?.some((tx) => tx.refId === action.refId)) return state;
    const stats = state.marketStats || { purchases: 0, coinsSpent: 0, contractsCompleted: 0, contractsFailed: 0, weeklyContractsFailed: 0, contractsCancelled: 0 };
    const penalty = Math.min(Math.max(0, Math.round(action.penalty)), coinBalance(state));
    let next = state;
    if (penalty > 0) {
      next = appendCoinTx(state, {
        id: action.refId,
        refId: action.refId,
        amount: -penalty,
        kind: 'penalty',
        label: action.label,
        createdAt: new Date().toISOString(),
      });
    }
    next = {
      ...next,
      marketStats: {
        ...stats,
        contractsFailed: stats.contractsFailed + 1,
        weeklyContractsFailed: stats.weeklyContractsFailed + (action.weekly ? 1 : 0),
        contractsCancelled: stats.contractsCancelled + (action.outcome === 'cancelled' ? 1 : 0),
      },
    };
    return applyAchievements(next);
  }
  if (action.type === 'GRANT_ITEM') {
    return addInventoryItem(state, action.itemId, 1);
  }
  if (action.type === 'PURCHASE_ITEM') {
    const def = getMarketItem(action.itemId);
    const currentWeek = weekKey();
    const purchaseCountThisWeek = (state.coinLedger || []).filter(
      (tx) =>
        tx.kind === 'purchase' &&
        tx.itemId === action.itemId &&
        weekKey(tx.createdAt) === currentWeek,
    ).length;
    // Bir kez alınan ürünler (kozmetik, koleksiyon, kalıcı gelişim) tekrar alınamaz.
    if (isPermanentItem(action.kind as MarketItemKind) && inventoryQuantity(state, action.itemId) > 0) {
      return state;
    }
    // Görevler haftada yalnızca bir kez satın alınabilir.
    if (action.kind === 'contract' && purchaseCountThisWeek > 0) return state;
    // Tüketilebilir ürünlerin haftalık alım sınırı vardır.
    if (def?.weeklyLimit && purchaseCountThisWeek >= def.weeklyLimit) return state;
    // İkinci vitrin yuvası ilk yuvadan sonra açılabilir.
    if (def?.perk === 'showcase_slot_2' && !(state.perks || []).includes('showcase_slot_1')) {
      return state;
    }
    const basePrice = Math.max(0, Math.round(action.price));
    const finalPrice = action.coupon ? Math.round(basePrice * 0.8) : basePrice;
    if (coinBalance(state) < finalPrice) return state;
    const refId = `buy:${action.itemId}:${Date.now()}:${uid()}`;
    let next = appendCoinTx(state, {
      id: refId,
      refId,
      amount: -finalPrice,
      kind: 'purchase',
      label: action.name,
      itemId: action.itemId,
      createdAt: new Date().toISOString(),
    });
    next = addInventoryItem(next, action.itemId, 1);
    if (def?.perk) {
      next = {
        ...next,
        perks: (next.perks || []).includes(def.perk)
          ? next.perks
          : [...(next.perks || []), def.perk],
      };
    }
    if (action.coupon) next = consumeEffectCharge(next, 'util_market_coupon');
    next = {
      ...next,
      marketStats: {
        ...(next.marketStats || { purchases: 0, coinsSpent: 0, contractsCompleted: 0, contractsFailed: 0, weeklyContractsFailed: 0, contractsCancelled: 0 }),
        purchases: (next.marketStats?.purchases || 0) + 1,
        coinsSpent: (next.marketStats?.coinsSpent || 0) + finalPrice,
      },
    };
    return applyAchievements(next);
  }
  if (action.type === 'EQUIP_ITEM') {
    if (action.itemId && inventoryQuantity(state, action.itemId) <= 0) return state;
    if (action.slot === 'badgeId2' && !(state.perks || []).includes('badge_slot')) return state;
    return { ...state, equipped: { ...(state.equipped || {}), [action.slot]: action.itemId } };
  }
  if (action.type === 'CONSUME_EFFECT') {
    return consumeEffectCharge(state, action.itemId);
  }
  if (action.type === 'USE_ITEM') {
    if (inventoryQuantity(state, action.itemId) <= 0) return state;
    let next = removeInventoryItem(state, action.itemId, 1);
    if (action.effect === 'contract_reroll') {
      next = { ...next, marketRerollNonce: (next.marketRerollNonce || 0) + 1 };
    } else if (action.effect === 'single_reroll') {
      next = { ...next, marketDailyNonce: (next.marketDailyNonce || 0) + 1 };
    } else if (action.effect === 'selective_reroll') {
      next = { ...next, marketWeeklyNonce: (next.marketWeeklyNonce || 0) + 1 };
    } else if (
      action.effect === 'streak_shield' ||
      action.effect === 'double_reward' ||
      action.effect === 'market_coupon' ||
      action.effect === 'penalty_waiver' ||
      action.effect === 'xp_boost' ||
      action.effect === 'contract_insurance'
    ) {
      next = addEffectCharge(next, action.itemId);
    } else if (action.effect === 'streak_freeze') {
      next = addEffectCharge(next, action.itemId);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      next = {
        ...next,
        activeEffects: (next.activeEffects || []).map((effect) =>
          effect.itemId === action.itemId ? { ...effect, expiresAt } : effect,
        ),
      };
    }
    return next;
  }
  if (action.type === 'PIN_CONTRACT') {
    return { ...state, pinnedContract: { week: action.week, contractId: action.contractId } };
  }
  if (action.type === 'SET_SERIES_RUNTIME') {
    const runtimeState = {
      ...state,
      series: state.series.map((series) => {
        if (series.id !== action.seriesId) return series;
        return {
          ...series,
          episodeRuntime: action.episodeRuntime || series.episodeRuntime,
          episodes: series.episodes.map((episode) => {
            const key = `${episode.season}:${episode.episode}`;
            const runtime = action.runtimes?.[key];
            return runtime ? { ...episode, runtime } : episode;
          }),
        };
      }),
    };
    return applyAchievements(runtimeState);
  }
  if (action.type === 'MARK_MARKET_INTRO_SEEN') return { ...state, marketIntroSeen: true };
  if (action.type === 'REROLL_MARKET') return { ...state, marketRerollNonce: (state.marketRerollNonce || 0) + 1 };

  let nextState = { ...state };
  // UPDATE_HISTORY_RATING / APPLY_CALIBRATION_SUGGESTION: puan değişiminde
  // puan-bağılı başarımların yeni kilitleri açılamaz (tail'de bu flag okunur).
  let skipRatingUnlocks = false;
  switch (action.type) {
    case 'GRANT_XP': {
      // Tek XP yolu: deftere idempotent kayıt. Aynı (source, sourceId) ikinci
      // kez gelirse toplam ARTMAZ, kutlama da tekrar üretilmez.
      const events = normalizeXpEvents(state.xpEvents);
      const source: XpEventSource = action.source || 'system';
      const sourceId = action.sourceId || `system:${uid()}`;
      if (hasXpEvent(events, source, sourceId)) return state;
      const base = Number.isFinite(Number(action.base)) ? Number(action.base) : action.xp;
      const multiplier = Number.isFinite(Number(action.multiplier))
        ? Number(action.multiplier)
        : (base !== 0 ? action.xp / base : 1);
      const appended = appendXpEvent(events, makeXpEvent({
        source,
        sourceId,
        label: action.label || 'XP kazancı',
        base,
        multiplier,
      }));
      const oldTotal = sumXpEvents(events);
      const newTotal = oldTotal + (appended.events[appended.events.length - 1]?.amount || 0);
      const levelData = levelFromXp(newTotal);
      const oldLevel = levelFromXp(oldTotal).level;
      // Çoklu seviye atlamasında HER ara seviye ayrı kutlama kuyruğuna girer.
      const withLedger = { ...state, xpEvents: appended.events, totalXp: newTotal, xp: levelData.currentLevelXp, level: levelData.level };
      const levelUps = applyLevelUps(state, oldLevel, levelData.level);
      const levelCoinTotal = pendingLevelCoinTotal(state, oldLevel, levelData.level);
      const withLevels = awardLevelCoins(withLedger, oldLevel, levelData.level);
      const pendingCoinGain = (levelCoinTotal > 0 || state.pendingCoinGain)
        ? mergePendingCoinGain(state.pendingCoinGain, levelCoinTotal, 'Seviye ödülleri', !(withLevels.pendingToasts?.length))
        : undefined;
      return {
        ...withLevels,
        pendingXpGain: {
          gained: newTotal - oldTotal,
          oldTotal,
          newTotal,
          source,
          label: action.label || XP_SOURCE_LABELS[source],
        },
        pendingCoinGain,
        ...levelUps,
      };
    }
    case 'ABANDON_MEDIA': {
      const nowIso = action.abandonedAt || new Date().toISOString();
      if (action.mediaType === 'movie') {
        nextState.movies = state.movies.map((m) => {
          if (m.id !== action.id) return m;
          let progress = action.progress;
          if (!progress) {
            // Otomatik ilerleme: aktif sayaç çalıştıysa geçen dakika, yoksa 0.
            let elapsed = 0;
            if (m.startedAt) {
              const t = new Date(m.startedAt).getTime();
              if (!isNaN(t)) elapsed = Math.max(0, Math.round((Date.now() - t) / 60000));
            }
            const runtime = m.runtime || 0;
            progress = { unit: 'minute', value: runtime > 0 ? Math.min(elapsed, runtime) : elapsed };
          }
          return { ...m, abandoned: true, abandonedAt: nowIso, abandonedProgress: progress, autopsyReasons: action.reasons, autopsyNote: action.note, startedAt: null };
        });
      } else {
        nextState.series = state.series.map((s) => (s.id === action.id
          ? { ...s, abandoned: true, abandonedAt: nowIso, abandonedProgress: action.progress, autopsyReasons: action.reasons, autopsyNote: action.note }
          : s));
      }
      // Mezarlığa ekleme artık XP kazandırmıyor.
      break;
    }
    case 'REVIVE_MEDIA': {
      if (action.mediaType === 'movie') {
        nextState.movies = state.movies.map((m) => {
          if (m.id !== action.id) return m;
          const { abandoned: _a, abandonedAt: _b, abandonedProgress: _c, autopsyReasons: _d, autopsyNote: _e, ...rest } = m;
          return rest;
        });
      } else {
        nextState.series = state.series.map((s) => {
          if (s.id !== action.id) return s;
          const { abandoned: _a, abandonedAt: _b, abandonedProgress: _c, autopsyReasons: _d, autopsyNote: _e, ...rest } = s;
          return rest;
        });
      }
      break;
    }
    case 'RESOLVE_DUEL': {
      if (action.mediaType === 'series') break; // Düello motoru film puanları içindir.
      const winner = state.movies.find((m) => m.id === action.winnerId);
      const loser = state.movies.find((m) => m.id === action.loserId);
      if (!winner || !loser) break;
      const wOld = winner.calibratedScore ?? winner.rating ?? 5;
      const lOld = loser.calibratedScore ?? loser.rating ?? 5;
      const { winnerNew, loserNew } = calculateEloDelta(wOld, lOld);
      nextState.movies = state.movies.map((m) => {
        if (m.id === winner.id) return { ...m, calibratedScore: winnerNew, duelCount: (m.duelCount || 0) + 1, duelWins: (m.duelWins || 0) + 1 };
        if (m.id === loser.id) return { ...m, calibratedScore: loserNew, duelCount: (m.duelCount || 0) + 1 };
        return m;
      });
      // XP YOK: düelloda XP kazanılmaz; ödül yalnızca "Terazi Ustası" başarımlarından gelir.
      nextState.totalDuelsCompleted = (state.totalDuelsCompleted || 0) + 1;
      // GİZLİ BAŞARIM "Taht Deviren": orijinal puanı düşük olan kazandıysa sayaç +1
      if (winner.rating != null && loser.rating != null && winner.rating < loser.rating) {
        nextState.giantSlayerWins = (state.giantSlayerWins || 0) + 1;
      }
      break;
    }
    case 'APPLY_CALIBRATION_SUGGESTION': {
      skipRatingUnlocks = true; // kalibre önerisiyle puan değişir → puan-bağılı kilit açılamaz
      nextState.movies = state.movies.map((m) =>
        m.id === action.id && m.rating != null
          ? { ...m, rating: action.newRating, calibratedScore: action.newRating }
          : m
      );
      break;
    }
    case 'MERGE_SHARED_LIST':
      nextState.genres = addNewGenres(state.genres, action.genres);
      nextState.collections = [...state.collections, ...action.collections];
      nextState.movies = [...state.movies, ...action.movies];
      nextState.series = [...state.series, ...action.series]; break;
    case 'ADD_MOVIE': {
      const resolved = resolveTMDBGenres(action.movie.genres, state.genres);
      action.movie.genres = resolved; nextState.genres = addNewGenres(state.genres, resolved); nextState.movies = [...state.movies, action.movie]; break;
    }
    case 'DELETE_MOVIE':
      nextState.movies = state.movies.filter((m) => m.id !== action.id);
      nextState.weeklyPlan = (state.weeklyPlan || []).filter((p) => p.movieId !== action.id);
      break;
    case 'START_WATCHING_MOVIE': nextState.movies = state.movies.map((m) => (m.id === action.id ? { ...m, startedAt: action.startedAt } : m)); break;
    case 'CANCEL_WATCHING_MOVIE': nextState.movies = state.movies.map((m) => (m.id === action.id ? { ...m, startedAt: null } : m)); break;
    case 'WATCH_MOVIE':
      nextState.movies = state.movies.map((m) =>
        m.id === action.id
          ? { ...m, watched: true, inPastQueue: false, isPastWatch: Boolean(action.isPastWatch), rating: action.rating, calibratedScore: syncCalibratedRating(m.rating, m.calibratedScore, m.duelCount || 0, action.rating), detailedRating: action.detailedRating, reviewTags: action.reviewTags, note: action.note, watchedAt: action.watchedAt, actualRuntime: action.actualRuntime }
          : m
      );
      nextState.history = [action.historyItem, ...state.history];
      if (!action.isPastWatch) {
        const wasNewDay = state.dailyStreakDate !== todayStr();
        const streakUpdate = applyStreakForWatch(state);
        nextState.dailyStreak = streakUpdate.dailyStreak;
        if (streakUpdate.activeEffects) nextState.activeEffects = streakUpdate.activeEffects;
        nextState.dailyStreakDate = todayStr();
        nextState.lastWatchDate = todayStr();
        nextState = withWatchEconomyRewards(nextState, wasNewDay);
      }
      break;
    case 'UNWATCH_MOVIE':
      nextState.movies = state.movies.map((m) => (m.id === action.id ? { ...m, watched: false, isPastWatch: false, rating: null, detailedRating: undefined, reviewTags: undefined, note: '', watchedAt: null, startedAt: null, actualRuntime: null } : m));
      nextState.history = state.history.filter((h) => h.itemId !== action.id && h.id !== action.id); break;
    case 'UPDATE_HISTORY_RATING': {
      skipRatingUnlocks = true; // puan düzenleme → puan-bağılı yeni kilit açılamaz
      const hItem = state.history.find((h) => h.id === action.historyId); if (!hItem) break;
      const updatedIsPast = action.isPastWatch !== undefined ? action.isPastWatch : hItem.isPastWatch;
      const ratingChanged = hItem.rating !== null && hItem.rating !== action.rating;
      nextState.history = state.history.map((h) => (h.id === action.historyId ? { ...h, rating: action.rating, detailedRating: action.detailedRating, reviewTags: action.reviewTags, note: action.note, isPastWatch: (h.kind === 'movie' || h.type === 'movie') ? Boolean(updatedIsPast) : h.isPastWatch, ...(ratingChanged ? { previousRating: hItem.rating ?? undefined, ratingChangedAt: new Date().toISOString() } : {}) } : h));
      const targetId = hItem.itemId || hItem.id;
      if (hItem.kind === 'movie' || hItem.type === 'movie') {
        nextState.movies = state.movies.map((m) => (m.id === targetId ? { ...m, rating: action.rating, calibratedScore: syncCalibratedRating(m.rating, m.calibratedScore, m.duelCount || 0, action.rating), detailedRating: action.detailedRating, reviewTags: action.reviewTags, note: action.note, isPastWatch: Boolean(updatedIsPast) } : m));
      } else if (hItem.bulkRating) {
        nextState.series = state.series.map((s) => {
          if (s.id !== targetId && s.id !== hItem.seriesId) return s;
          if (hItem.ratingScope === 'season' && hItem.season !== undefined) {
            return {
              ...s,
              seasonRatings: {
                ...(s.seasonRatings || {}),
                [hItem.season]: {
                  rating: action.rating,
                  note: action.note,
                  ratedAt: hItem.watchedAt,
                  detailedRating: action.detailedRating,
                  reviewTags: action.reviewTags,
                },
              },
            };
          }
          return {
            ...s,
            overallRating: action.rating,
            overallNote: action.note,
            overallRatedAt: hItem.watchedAt,
            overallDetailedRating: action.detailedRating,
            overallReviewTags: action.reviewTags,
          };
        });
      } else {
        nextState.series = state.series.map((s) => ({ ...s, episodes: s.episodes.map((e) => (e.id === targetId ? { ...e, rating: action.rating, detailedRating: action.detailedRating, reviewTags: action.reviewTags, note: action.note } : e)) }));
      }
      break;
    }
    case 'ADD_SERIES': {
      const resolved = resolveTMDBGenres(action.series.genres, state.genres);
      action.series.genres = resolved; nextState.genres = addNewGenres(state.genres, resolved); nextState.series = [...state.series, action.series]; break;
    }
    case 'DELETE_SERIES': nextState.series = state.series.filter((s) => s.id !== action.id); break;
    case 'COMPLETE_SERIES': break;
    case 'ADD_EPISODES': nextState.series = state.series.map((s) => (s.id === action.seriesId ? { ...s, episodes: [...s.episodes, ...action.episodes] } : s)); break;
    case 'RESTORE_EPISODES': nextState.series = state.series.map((s) => {
      if (s.id !== action.seriesId) return s;
      const existing = new Set(s.episodes.map((e) => `${e.season}:${e.episode}`));
      const toRestore = action.episodes.filter((e) => !existing.has(`${e.season}:${e.episode}`));
      if (toRestore.length === 0) return s;
      const restoredKeys = new Set(toRestore.map((e) => `${e.season}:${e.episode}`));
      return {
        ...s,
        episodes: [...s.episodes, ...toRestore].sort((a, b) => a.season - b.season || a.episode - b.episode),
        deletedEpisodes: (s.deletedEpisodes || []).filter((e) => !restoredKeys.has(`${e.season}:${e.episode}`)),
      };
    }); break;
    case 'WATCH_EPISODE':
      nextState.series = state.series.map((s) => (s.id === action.seriesId ? { ...s, episodes: s.episodes.map((e) => (e.id === action.episodeId ? { ...e, watched: true, rating: action.rating, detailedRating: action.detailedRating, reviewTags: action.reviewTags, note: action.note, watchedAt: action.watchedAt } : e)) } : s));
      nextState.history = [action.historyItem, ...state.history]; {
        const wasNewDay = state.dailyStreakDate !== todayStr();
        const streakUpdate = applyStreakForWatch(state);
        nextState.dailyStreak = streakUpdate.dailyStreak;
        if (streakUpdate.activeEffects) nextState.activeEffects = streakUpdate.activeEffects;
        nextState.dailyStreakDate = todayStr();
        nextState.lastWatchDate = todayStr();
        nextState = withWatchEconomyRewards(nextState, wasNewDay);
      } break;
    case 'UNWATCH_EPISODE':
      nextState.series = state.series.map((s) => (s.id === action.seriesId ? { ...s, episodes: s.episodes.map((e) => (e.id === action.episodeId ? { ...e, watched: false, rating: null, detailedRating: undefined, reviewTags: undefined, note: '', watchedAt: null } : e)) } : s));
      nextState.history = state.history.filter((h) => h.itemId !== action.episodeId && h.id !== action.episodeId); break;
    case 'DELETE_EPISODE': nextState.series = state.series.map((s) => {
      if (s.id !== action.seriesId) return s;
      const removed = s.episodes.find((e) => e.id === action.episodeId);
      if (!removed) return s;
      return {
        ...s,
        episodes: s.episodes.filter((e) => e.id !== action.episodeId),
        deletedEpisodes: [
          ...(s.deletedEpisodes || []).filter((e) => !(e.season === removed.season && e.episode === removed.episode)),
          removed,
        ],
      };
    }); break;
    case 'SET_SERIES_PAST_QUEUE': nextState.series = state.series.map((s) => (s.id === action.id ? { ...s, inPastQueue: action.inPastQueue } : s)); break;
    case 'RATE_SERIES_BULK': {
      const targetSeries = state.series.find((s) => s.id === action.seriesId);
      if (!targetSeries) break;
      const existingSeasonRatings = targetSeries.seasonRatings || {};
      const hasSeasonRating = Object.keys(existingSeasonRatings).length > 0;
      const hasEpisodeRating = targetSeries.episodes.some((e) => e.rating !== null && e.rating !== undefined);
      const targetSeason = action.scope === 'season' ? action.season : undefined;

      // Genel puan ile sezon puanı aynı anda/üst üste kullanılamaz.
      if (action.scope === 'series') {
        if (hasSeasonRating || hasEpisodeRating) break;
      } else if (
        targetSeason === undefined ||
        targetSeries.overallRating != null ||
        targetSeries.isPastWatch ||
        targetSeries.inPastQueue ||
        targetSeries.episodes.some((e) => e.season === targetSeason && e.rating !== null && e.rating !== undefined)
      ) {
        break;
      }

      const isBulkEdit = action.scope === 'series'
        ? targetSeries.overallRating != null
        : existingSeasonRatings[targetSeason!] != null;

      nextState.series = state.series.map((s) => {
        if (s.id !== action.seriesId) return s;
        if (action.scope === 'season' && action.season !== undefined) {
          return {
            ...s,
            ...(action.isPastWatch ? { isPastWatch: true, inPastQueue: false } : {}),
            seasonRatings: {
              ...(s.seasonRatings || {}),
              [action.season]: {
                rating: action.rating,
                note: action.note,
                ratedAt: action.watchedAt,
                detailedRating: action.detailedRating,
                reviewTags: action.reviewTags,
              },
            },
          };
        }
        return {
          ...s,
          ...(action.isPastWatch ? { isPastWatch: true, inPastQueue: false } : {}),
          overallRating: action.rating,
          overallNote: action.note,
          overallRatedAt: action.watchedAt,
          overallDetailedRating: action.detailedRating,
          overallReviewTags: action.reviewTags,
        };
      });

      // Aynı kapsam yeniden puanlanırsa eski toptan geçmiş kaydı çoğaltılmaz.
      nextState.history = [
        ...action.historyItems,
        ...state.history.filter((h) => !(
          h.bulkRating &&
          h.seriesId === action.seriesId &&
          h.ratingScope === action.scope &&
          (action.scope !== 'season' || h.season === action.season)
        )),
      ];

      // Düzenleme yeni bir izleme değildir; seri/günlük ekonomi tekrar tetiklenmez.
      if (!action.isPastWatch && !isBulkEdit) {
        const wasNewDay = state.dailyStreakDate !== todayStr();
        const streakUpdate = applyStreakForWatch(state);
        nextState.dailyStreak = streakUpdate.dailyStreak;
        if (streakUpdate.activeEffects) nextState.activeEffects = streakUpdate.activeEffects;
        nextState.dailyStreakDate = todayStr();
        nextState.lastWatchDate = todayStr();
        nextState = withWatchEconomyRewards(nextState, wasNewDay);
      }
      break;
    }
    case 'CLEAR_SERIES_RATINGS': {
      nextState.series = state.series.map((s) => {
        if (s.id !== action.seriesId) return s;
        if (action.scope === 'all') {
          return {
            ...s,
            overallRating: null,
            overallNote: '',
            overallRatedAt: null,
            overallDetailedRating: undefined,
            overallReviewTags: undefined,
            seasonRatings: {},
          };
        }
        if (action.scope === 'series') {
          return {
            ...s,
            overallRating: null,
            overallNote: '',
            overallRatedAt: null,
            overallDetailedRating: undefined,
            overallReviewTags: undefined,
          };
        }
        const nextSeasonRatings = { ...(s.seasonRatings || {}) };
        if (action.season !== undefined) delete nextSeasonRatings[action.season];
        return { ...s, seasonRatings: nextSeasonRatings };
      });
      nextState.history = state.history.filter((h) => {
        if (!(h.bulkRating && h.seriesId === action.seriesId)) return true;
        if (action.scope === 'all') return false;
        if (action.scope === 'series') return h.ratingScope !== 'series';
        return !(h.ratingScope === 'season' && h.season === action.season);
      });
      break;
    }
    case 'CLEAR_SERIES_EPISODE_RATINGS': {
      const selected = action.seasons ? new Set(action.seasons) : null;
      const clearedIds = new Set<string>();
      const clearedKeys = new Set<string>();
      nextState.series = state.series.map((s) => {
        if (s.id !== action.seriesId) return s;
        return {
          ...s,
          episodes: s.episodes.map((e) => {
            if (selected && !selected.has(e.season)) return e;
            clearedIds.add(e.id);
            clearedKeys.add(`${e.season}:${e.episode}`);
            // Yalnızca puan temizlenir; bölümün izlenme durumu ve tarihi korunur.
            return {
              ...e,
              rating: null,
              detailedRating: undefined,
              reviewTags: undefined,
              note: '',
            };
          }),
        };
      });
      nextState.history = state.history.map((h) => {
        if (!(h.kind === 'series' || h.type === 'series') || h.seriesId !== action.seriesId) return h;
        if (h.bulkRating) return h;
        const matchesEpisode = (h.itemId && clearedIds.has(h.itemId)) ||
          (h.season !== undefined && h.episode !== undefined && clearedKeys.has(`${h.season}:${h.episode}`));
        if (!matchesEpisode) return h;
        return {
          ...h,
          rating: null,
          detailedRating: undefined,
          reviewTags: undefined,
          note: '',
        };
      });
      break;
    }
    case 'ADD_GENRE': if (!state.genres.some((x) => normalize(x) === normalize(action.genre))) nextState.genres = [...state.genres, action.genre]; break;
    case 'DELETE_GENRE': nextState.genres = state.genres.filter((g) => g !== action.genre); break;
    case 'RENAME_GENRE':
      nextState.genres = state.genres.map((g) => (g === action.oldName ? action.newName : g));
      nextState.movies = state.movies.map((m) => ({ ...m, genres: m.genres.map((g) => (g === action.oldName ? action.newName : g)) }));
      nextState.series = state.series.map((s) => ({ ...s, genres: s.genres.map((g) => (g === action.oldName ? action.newName : g)) }));
      nextState.history = state.history.map((h) => ({ ...h, genres: h.genres.map((g) => (g === action.oldName ? action.newName : g)) })); break;
    case 'ADD_REVIEW_TAG': { const cur = state.reviewTags || DEFAULT_REVIEW_TAGS; if (!cur.some((t) => normalize(t) === normalize(action.tag))) nextState.reviewTags = [...cur, action.tag]; if (action.sentiment) { nextState.tagSentiments = { ...(state.tagSentiments || {}), [action.tag]: action.sentiment }; } break; }
    case 'DELETE_REVIEW_TAG': nextState.reviewTags = (state.reviewTags || DEFAULT_REVIEW_TAGS).filter((t) => t !== action.tag); break;
    case 'RENAME_REVIEW_TAG': {
      nextState.reviewTags = (state.reviewTags || DEFAULT_REVIEW_TAGS).map((t) => (t === action.oldTag ? action.newTag : t));
      nextState.movies = state.movies.map((m) => (m.reviewTags ? { ...m, reviewTags: m.reviewTags.map((t) => (t === action.oldTag ? action.newTag : t)) } : m));
      nextState.series = state.series.map((s) => ({ ...s, episodes: s.episodes.map((e) => (e.reviewTags ? { ...e, reviewTags: e.reviewTags.map((t) => (t === action.oldTag ? action.newTag : t)) } : e)) }));
      nextState.history = state.history.map((h) => (h.reviewTags ? { ...h, reviewTags: h.reviewTags.map((t) => (t === action.oldTag ? action.newTag : t)) } : h));
      const sentiments = { ...(state.tagSentiments || {}) };
      if (action.sentiment) sentiments[action.newTag] = action.sentiment;
      else if (sentiments[action.oldTag] !== undefined) { sentiments[action.newTag] = sentiments[action.oldTag]; }
      delete sentiments[action.oldTag];
      nextState.tagSentiments = sentiments;
      break;
    }
    case 'SET_TAG_SENTIMENT': {
      nextState.tagSentiments = { ...(state.tagSentiments || {}), [action.tag]: action.sentiment }; break;
    }
    case 'EDIT_MOVIE': {
      const resolved = resolveTMDBGenres(action.genres, state.genres); nextState.genres = addNewGenres(state.genres, resolved);
      nextState.movies = state.movies.map((m) => (m.id === action.id ? {
        ...m, title: action.title, year: action.year, genres: resolved, runtime: action.runtime,
        ...(action.posterUrl !== undefined && { posterUrl: action.posterUrl }), ...(action.overview !== undefined && { overview: action.overview }),
        ...(action.tmdbId !== undefined && { tmdbId: action.tmdbId }), ...(action.customUrl !== undefined && { customUrl: action.customUrl }),
        ...(action.imdbId !== undefined && { imdbId: action.imdbId }), ...(action.watchProviders !== undefined && { watchProviders: action.watchProviders }),
        ...(action.extra?.directors !== undefined && { directors: action.extra.directors }), ...(action.extra?.cast !== undefined && { cast: action.extra.cast }),
        ...(action.extra?.studios !== undefined && { studios: action.extra.studios }), ...(action.extra?.keywords !== undefined && { keywords: action.extra.keywords }),
        ...(action.extra?.originalLanguage !== undefined && { originalLanguage: action.extra.originalLanguage })
      } : m)); break;
    }
    case 'EDIT_SERIES': {
      const resolved = resolveTMDBGenres(action.genres, state.genres); nextState.genres = addNewGenres(state.genres, resolved);
      nextState.series = state.series.map((s) => (s.id === action.id ? {
        ...s, title: action.title, genres: resolved, ...(action.year !== undefined && { year: action.year }),
        ...(action.posterUrl !== undefined && { posterUrl: action.posterUrl }), ...(action.overview !== undefined && { overview: action.overview }),
        ...(action.tmdbId !== undefined && { tmdbId: action.tmdbId }), ...(action.customUrl !== undefined && { customUrl: action.customUrl }),
        ...(action.imdbId !== undefined && { imdbId: action.imdbId }), ...(action.watchProviders !== undefined && { watchProviders: action.watchProviders }),
        ...(action.extra?.creators !== undefined && { creators: action.extra.creators }), ...(action.extra?.cast !== undefined && { cast: action.extra.cast }),
        ...(action.extra?.studios !== undefined && { studios: action.extra.studios }), ...(action.extra?.keywords !== undefined && { keywords: action.extra.keywords }),
        ...(action.extra?.originalLanguage !== undefined && { originalLanguage: action.extra.originalLanguage })
      } : s)); break;
    }
    case 'ADD_COLLECTION': nextState.collections = [...state.collections, action.collection]; break;
    case 'DELETE_COLLECTION': nextState.collections = state.collections.filter((c) => c.id !== action.id); nextState.movies = state.movies.map((m) => (m.collectionId === action.id ? { ...m, collectionId: null } : m)); break;
    case 'RENAME_COLLECTION': nextState.collections = state.collections.map((c) => (c.id === action.id ? { ...c, name: action.name } : c)); break;
    case 'SET_MOVIE_COLLECTION': nextState.movies = state.movies.map((m) => (m.id === action.id ? { ...m, collectionId: action.collectionId } : m)); break;
    case 'SET_MOVIE_PAST_QUEUE': nextState.movies = state.movies.map((m) => (m.id === action.id ? { ...m, inPastQueue: action.inPastQueue } : m)); break;
    case 'ADD_CRITERION': nextState.criteria = [...(state.criteria || []), action.criterion]; break;
    case 'EDIT_CRITERION': nextState.criteria = (state.criteria || []).map((c) => (c.id === action.id ? action.criterion : c)); break;
    case 'DELETE_CRITERION': nextState.criteria = (state.criteria || []).filter((c) => c.id !== action.id); break;
    case 'ADD_PLAN_ITEM': nextState.weeklyPlan = [...(state.weeklyPlan || []), action.item]; break;
    case 'DELETE_PLAN_ITEM': nextState.weeklyPlan = (state.weeklyPlan || []).filter((p) => p.id !== action.id); break;
    case 'UPDATE_PLAN_ITEM': nextState.weeklyPlan = (state.weeklyPlan || []).map((p) => p.id === action.id ? { ...p, date: action.date, time: action.time } : p); break;
    case 'PRUNE_EXPIRED_PLAN_ITEMS': {
      const currentPlan = state.weeklyPlan || [];
      const pruned = pruneExpiredPlanItems(currentPlan, state.movies || [], action.today || todayStr());
      if (pruned === currentPlan) return state;
      nextState.weeklyPlan = pruned;
      break;
    }
  }
  return applyAchievements(nextState, skipRatingUnlocks ? { skipRatingUnlocks: true } : undefined);
}

export interface ToastItem { id: string; message: string; type: 'success' | 'warning' | 'error' | 'info'; }export interface AchievementToastItem { id: string; achievementId?: string; achievementName: string; tier: string; icon: string; description: string; }
interface LevelUpData { newLevel: number; }
interface SeasonCompleteData { seriesTitle: string; season: number; }
/** XP barı kartının verisi — kaynak etiketi defter kaydından gelir. */
export interface XpGainPayload {
  gained: number;
  oldTotal: number;
  newTotal: number;
  source?: XpEventSource;
  label?: string;
}

export interface AppContextValue {
  data: ExtendedAppData;
  syncStatus: 'syncing' | 'synced' | 'error'; // YENİ: Eşitleme Durum Sinyali
  /** Aynı hesap için yerel ve bulut sürümü çakıştığında kullanıcıya sorulacak bilgi. */
  cloudConflict: SyncConflict | null;
  resolveCloudConflict: (choice: ConflictChoice) => void;
  isQuestCelebrating: boolean; setIsQuestCelebrating: (val: boolean) => void; levelUpQueuedRef: { current: boolean }; // gecikmeli seviye modalı bekliyor (dış flush kapıları için)
  // Kutlama kapıları (ref tabanlı, state gecikmesinden etkilenmez)
  contractCelebratingRef: { current: boolean }; contractQueuedRef: { current: { contractId: string; xp: number; coins: number; rarity: ContractRarity } | null };
  questCelebratingRef: { current: boolean }; questQueuedRef: { current: boolean }; levelUpOpenRef: { current: boolean }; seasonOpenRef: { current: boolean }; seasonQueuedRef: { current: { seriesTitle: string; season: number } | null }; xpGainOpenRef: { current: boolean };
  addMovie: (t: string, y: string, g: string[], c: string | null, r?: number, p?: string | null, o?: string, tmdbId?: number, imdbId?: string, watchProviders?: WatchProvider[], extra?: MovieExtraData) => boolean;
  deleteMovie: (id: string) => void; startWatchingMovie: (id: string, silent?: boolean) => void; togglePauseWatchingMovie: (id: string) => void; cancelWatchingMovie: (id: string) => void; canRateMovieWithTimer: (id: string) => boolean;
  watchMovie: (id: string, r: number, n: string, dr?: Record<string, number>, reviewTags?: string[], isPastWatch?: boolean) => void;
  unwatchMovie: (id: string) => void; updateHistoryRating: (historyId: string, rating: number, note: string, dr?: Record<string, number>, reviewTags?: string[], isPastWatch?: boolean) => void;
  addSeries: (t: string, g: string[], s: number[], p?: string | null, o?: string, tmdbId?: number, y?: string, imdbId?: string, watchProviders?: WatchProvider[], extra?: SeriesExtraData, episodeRuntime?: number) => boolean;
  deleteSeries: (id: string) => void; addEpisodes: (sId: string, s: number, ec: number, silent?: boolean, runtime?: number) => void;
  restoreEpisodes: (sId: string, episodes: Episode[]) => void;
  watchEpisode: (sId: string, eId: string, r: number, n: string, dr?: Record<string, number>, reviewTags?: string[]) => void;
  canWatchEpisode: (sId: string, eId: string) => boolean; unwatchEpisode: (sId: string, eId: string) => void; deleteEpisode: (sId: string, eId: string) => void;
  addGenre: (g: string) => void; deleteGenre: (g: string) => void; renameGenre: (o: string, n: string) => void;
  addReviewTag: (tag: string, sentiment?: 'positive' | 'negative') => void; deleteReviewTag: (tag: string) => void; renameReviewTag: (oldTag: string, newTag: string, sentiment?: 'positive' | 'negative') => void; setTagSentiment: (tag: string, sentiment: 'positive' | 'negative') => void;
  editMovie: (i: string, t: string, y: string, g: string[], r?: number, p?: string | null, o?: string, tmdbId?: number, silent?: boolean, customUrl?: string, imdbId?: string, watchProviders?: WatchProvider[], extra?: MovieExtraData) => void;
  editSeries: (i: string, t: string, g: string[], p?: string | null, o?: string, tmdbId?: number, y?: string, silent?: boolean, customUrl?: string, imdbId?: string, watchProviders?: WatchProvider[], extra?: SeriesExtraData) => void;
  addCollection: (n: string) => string; deleteCollection: (i: string) => void; renameCollection: (i: string, n: string) => void; setMovieCollection: (i: string, c: string | null) => void; setMoviePastQueue: (i: string, inPastQueue: boolean) => void;
  setSeriesPastQueue: (i: string, inPastQueue: boolean) => void;
  rateSeriesBulk: (seriesId: string, scope: 'series' | 'season', rating: number, note: string, season?: number, isPastWatch?: boolean, detailedRating?: Record<string, number>, reviewTags?: string[]) => void;
  clearSeriesRatings: (seriesId: string, scope: 'all' | 'series' | 'season', season?: number) => void;
  clearSeriesEpisodeRatings: (seriesId: string, seasons?: number[]) => void;
  exportData: () => void; importData: (j: string) => boolean; resetData: () => void; exportShareList: () => void; importShareList: (j: string) => boolean;
  toasts: ToastItem[]; showToast: (m: string, t?: ToastItem['type']) => void; achievementToasts: AchievementToastItem[];
  levelUpData: LevelUpData | null; seasonCompleteData: SeasonCompleteData | null; dismissLevelUp: () => void; dismissSeasonComplete: () => void;
  toggleLockedNames: () => void; toggleBadgeDetails: () => void; toggleReducedMotion: () => void; toggleFastCelebrations: () => void; xpGainData: XpGainPayload | null;
  coinGainData: { amount: number; label: string } | null;
  queuedCoinGain: { amount: number; label: string; final?: boolean } | null;
  isContractCelebrating: boolean;
  contractCelebrationData: { contractId: string; xp: number; coins: number; rarity: ContractRarity } | null;
  requestContractCelebration: (payload: { contractId: string; xp: number; coins: number; rarity: ContractRarity }) => void;
  dismissContractCelebration: () => void;
  /** Pazar görevi tamamlandı sinyali (layout effect ile, XP/başarım efektlerinden önce yazılır). */
  setContractCompletionPending: (val: boolean) => void;
  updateAIHistory: (messages: AIMessage[]) => void; addCriterion: (criterion: RatingCriterion) => void; editCriterion: (id: string, criterion: RatingCriterion) => void; deleteCriterion: (id: string) => void;
  updateAltWatchTemplate: (template: string) => void; updateTheme: (theme: string) => void;
  weeklyPlan: WeeklyPlanItem[]; addPlanItem: (movie: Movie, date: string, time: string) => boolean; deletePlanItem: (id: string) => void; updatePlanItem: (id: string, date: string, time: string) => boolean;
  grantXp: (xp: number, source?: XpEventSource, sourceId?: string, label?: string, base?: number, multiplier?: number) => void;
  grantCoins: (amount: number, kind: CoinTx['kind'], label: string, refId: string, itemId?: string) => void;
  grantContractReward: (xp: number, coins: number, refId: string, label: string, opts?: { base?: number; multiplier?: number; sourceId?: string }) => void;
  purchaseItem: (itemId: string, name: string, price: number, kind: string, consumable?: boolean, coupon?: boolean) => void;
  equipItem: (slot: 'frameId' | 'titleId' | 'badgeId' | 'badgeId2' | 'backgroundId' | 'nameEffectId', itemId: string | null) => void;
  activateItem: (itemId: string, effect: string, label: string) => void;
  pinContract: (contractId: string, week: string) => void;
  consumeEffect: (itemId: string) => void;
  setSeriesRuntime: (seriesId: string, episodeRuntime?: number, runtimes?: Record<string, number>) => void;
  markMarketIntroSeen: () => void;
  rerollMarket: () => void;
  grantItem: (itemId: string, label: string, refId: string) => void;
  recordMarketOutcome: (outcome: 'failed' | 'cancelled', weekly: boolean, penalty: number, label: string, refId: string) => void;
  toggleNotifications: (enabled: boolean) => void; toggleShareWatched: (enabled: boolean) => void; toggleSharePastWatched: (enabled: boolean) => void; toggleSpecificNotification: (key: 'notifyMessages' | 'notifyFriendRequests' | 'notifyLists', enabled: boolean) => void;
  setNickname: (nickname: string) => void; recoverIdentity: (agentId: string, recoveryKey: string, nickname: string) => Promise<boolean>;
  /** Ağ girişinden sonra bu cihazı ağ hesabının kimliğine geçirir (bulut yedeğini çeker). */
  adoptNetworkIdentity: (agentId: string, nickname: string) => Promise<boolean>;
  updateShowcase: (items: ShowcaseItem[]) => void;
  forceXpSync: () => void;
  syncAchievements: () => void;
  /** Bu cihazdaki veriyi buluta zorla yükler (çakışma/geri dönüş korumasını atlar). */
  forceCloudUpload: () => void;
  /** Buluttaki kaydı bu cihaza BİREBİR indirir (yerel veri bulutla değiştirilir). */
  forceCloudDownload: () => Promise<void>;
  /** Sinematik Otopsi: film/diziyi yarım bırak (otopi). */
  abandonMedia: (mediaType: 'movie' | 'series', id: string, opts?: { abandonedAt?: string; progress?: AbandonedProgress; reasons?: string[]; note?: string }) => void;
  reviveMedia: (mediaType: 'movie' | 'series', id: string) => void;
  /** Kör kalibrasyon düellosunu çöz (kazanan/kaybeden film kimlikleri). */
  resolveDuel: (winnerId: string, loserId: string, mediaType?: 'movie' | 'series') => void;
  applyCalibrationSuggestion: (id: string, newRating: number) => void;
  setExternalActions: (actions: ExternalActionTemplate[]) => void;
}

const AppContext = createContext<AppContextValue | null>(null);
export function useApp() { const ctx = useContext(AppContext); if (!ctx) throw new Error('useApp must be used within AppProvider'); return ctx; }

export function AppProvider({ children }: { children: ReactNode }) {
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'error'>('synced'); // YENİ EKLENDİ
  // Hidrasyon tamamlanmadan hiçbir yazma/bulut eşitlemesi yapılmaz. Boot anlık
  // görüntüsü kütüphane içermediği için erken yazma gerçek veriyi ezebiliyordu.
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);
  const identityReconciledRef = useRef(false);
  const pushHealRef = useRef(false);
  const hydrationTrustedRef = useRef(false);

  const [data, dispatch] = useReducer(rootReducer, undefined, () => {
    const base = defaultData();
    try {
      // "Cihazdan Çıkış Yap" sonrası: bayrak varsa eski snapshot'ı tamamen atla.
      if (localStorage.getItem('sinevia_zero_reset') === '1') return base;
      // Boot anlık görüntüsü YALNIZ tema/kimlik/özet taşır; kütüphane içermez.
      // Tam V3 kaydı hidrasyonda gelir, o zamana kadar yazma yapılmaz.
      const boot = readBootSnapshotV3();
      if (!boot) return base;
      return applyNotificationPrefs({
        ...base,
        theme: boot.theme || base.theme,
        agentId: boot.agentId ?? base.agentId,
        nickname: boot.nickname ?? base.nickname,
        totalXp: Number(boot.totalXp || 0),
        level: Number(boot.level || 1),
        xp: Number(boot.xp || 0),
        dailyStreak: Number(boot.dailyStreak || 0),
      });
    } catch {
      return base;
    }
  });

  const [isQuestCelebrating, setQuestCelebratingState] = useState(false);
  const toastsRef = useRef<ToastItem[]>([]); const achievementToastsRef = useRef<AchievementToastItem[]>([]); const xpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); const isProcessingToastRef = useRef(false); const [queueTick, setQueueTick] = useState(0);
  // --- SIRALI KUTLAMA MOTORU (animasyonlar asla üst üste binmesin) ---
  const levelUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // ertelenmiş seviye modalı
  const levelUpQueuedRef = useRef(false);   // modal zamanlandı VEYA açık (ref, state'ten önce okunur)
  const seasonQueuedRef = useRef<{ seriesTitle: string; season: number } | null>(null); // bekleyen sezon modalı
  const levelUpOpenRef = useRef(false); const seasonOpenRef = useRef(false); const xpGainOpenRef = useRef(false); const questCelebratingRef = useRef(false); const questQueuedRef = useRef(false); const levelUpSoundStartedRef = useRef(false);
  const contractQueuedRef = useRef<{ contractId: string; xp: number; coins: number; rarity: ContractRarity } | null>(null);
  const contractOpenRef = useRef(false);
  const contractCelebratingRef = useRef(false);
  // QuestProvider, aktif sözleşmenin tamamlandığını useLayoutEffect ile buraya yazar.
  // Böylece aynı commit'te çalışan XP/başarım efektleri kutlamadan önce araya girmez.
  const contractCompletionPendingRef = useRef(false);
  const setContractCompletionPending = useCallback((val: boolean) => {
    contractCompletionPendingRef.current = val;
  }, []);
  const toastRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null); // ertelenen sıradan toast
  // SENKRON AYNA: Görev kutlaması (rozet) ile başarım kuyruğu AYNI commit'te
  // tetiklenebilir; React state'i commit edilmeden parent etkileri eski değeri
  // okurdu → setter ref'i ANINDA yazar, kuyruk etkisi bunu görür ve ikisi
  // asla üst üste başlamaz (sesler de dahil).
  const setIsQuestCelebrating = useCallback((val: boolean) => { questCelebratingRef.current = val; setQuestCelebratingState(val); }, []);
  const setIsContractCelebrating = useCallback((val: boolean) => { contractCelebratingRef.current = val; setContractCelebratingState(val); }, []);
  
  // V3 kanonik kayıt — kalıcılık ve senkron bu nesne üzerinden yürür.
  const lastV3Ref = useRef<AppStateV3 | null>(null);
  // Her zaman en güncel reducer durumu (asenkron senkron/persist için).
  const dataRef = useRef(data);
  dataRef.current = data;
  // Aynı hesap için yerel ve bulut sürümü çakıştığında kullanıcıya sorulur.
  const [cloudConflict, setCloudConflict] = useState<SyncConflict | null>(null);
  const cloudConflictRef = useRef<SyncConflict | null>(null);
  // "Sonra karar ver" seçildiyse bu oturumda otomatik senkron yapılmaz.
  const syncDeferredRef = useRef(false);
  // Ana yerel kayıt bozuk olduğu için yedekten kurtarıldıysa: kullanıcı
  // "bu cihaz / bulut" seçimini yapana kadar OTOMATİK yükleme yapılmaz.
  const syncApprovalPendingRef = useRef(false);
  const syncInFlightRef = useRef(false);
  // Buluttan uygulanan kayıtta updatedAt bump edilmez (yankı yüklemesi olmasın).
  const skipUpdatedAtBumpRef = useRef(false);

  const [toasts, setToasts] = useReducer((state: ToastItem[], a: any) => { toastsRef.current = a.type === 'add' ? [...state, a.toast] : state.filter((t) => t.id !== a.id); return toastsRef.current; }, []);
  const [achievementToasts, setAchievementToasts] = useReducer((state: AchievementToastItem[], a: any) => { achievementToastsRef.current = a.type === 'add' ? [...state, a.toast] : state.filter((t) => t.id !== a.id); return achievementToastsRef.current; }, []);
  const [levelUpData, setLevelUpData] = useReducer((_s: any, a: any) => a, null); const [seasonCompleteData, setSeasonCompleteData] = useReducer((_s: any, a: any) => a, null);
  const bootStartRef = useRef(Date.now()); // boot uzlaşma penceresi başlangıcı
  const [xpGainData, setXpGainData] = useState<XpGainPayload | null>(null);
  const [coinGainData, setCoinGainData] = useState<{ amount: number; label: string } | null>(null);
  const [queuedCoinGain, setQueuedCoinGain] = useState<{ amount: number; label: string; final?: boolean } | null>(null);
  const coinGainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coinShowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contractCelebrationData, setContractCelebrationData] = useState<{ contractId: string; xp: number; coins: number; rarity: ContractRarity } | null>(null);
  const [isContractCelebrating, setContractCelebratingState] = useState(false);
  const [contractTick, setContractTick] = useState(0);
  const [animationTick, setAnimationTick] = useState(0);

  useEffect(() => { document.body.setAttribute('data-theme', !data.theme ? 'premium-dark' : data.theme); }, [data.theme]);

  // KALICILIK — tek kanonik kayıt IndexedDB'deki AppStateV3'tür. localStorage'da
  // yalnız küçük boot anlık görüntüsü (tema/kimlik/özet) tutulur.
  const didHydrateRef = useRef(false);
  useEffect(() => {
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;
    (async () => {
      let trusted = false;
      try {
        // 0) Sıfır hesap zorlaması: bayrak varsa kanonik kaydı da sil.
        if (localStorage.getItem('sinevia_zero_reset') === '1') {
          await idbDel(STORAGE_KEY);
          await idbDel('sinevia-v1-backup');
          try {
            [
              'sinevia_zero_reset', QUEST_STORAGE_KEY, 'sinevia_secret_token',
              'sinevia-tutorial-v1', 'sinevia-academy-ui-v1',
              'sinevia_active_tab', 'sinevia_settings_tab', 'sinevia_shortcuts_v1',
            ].forEach((k) => localStorage.removeItem(k));
          } catch { /* kota */ }
          trusted = true;
          return;
        }

        // IndexedDB açılamıyorsa (başka sekme/geçici kilit) tam veri okunamaz ve
        // yazma gerçek kütüphaneyi ezebilir → güvenme, eşitleme durur.
        const idbOk = await isIdbAvailable();
        if (!idbOk) {
          trusted = !hasMeaningfulProgress(dataRef.current);
          if (!trusted) {
            showToast('Yerel depolama açılamadı. Verileriniz korunuyor; bulut eşitlemesi durduruldu.', 'warning');
          }
          return;
        }

        // 1) V2 kalıntısı varsa tek kez V3'e yükselt.
        await migrateToIdbIfNeeded(STORAGE_KEY);
        // 2) Kanonik V3 kaydını oku. Ana kayıt bozuksa API otomatik olarak
        //    'sinevia-v1-backup'a düşer ve `source` ile bunu bildirir.
        const { state, source } = await loadStateV3WithSource();
        if (state) {
          lastV3Ref.current = state;
          skipUpdatedAtBumpRef.current = true;
          dispatch({
            type: 'HYDRATE_FROM_IDB',
            data: toLegacyCoreView(state) as unknown as ExtendedAppData,
          });
          if (source === 'backup') {
            // Yedekten kurtarılan kayıt sahada güvenilmez sayılır: yerel olarak
            // korunur ama kullanıcı seçim yapana kadar buluta YÜKLENMEZ.
            trusted = true;
            syncApprovalPendingRef.current = true;
            showToast('Ana yerel kayıt okunamadı; veriler tam yedekten kurtarıldı. Bulut eşitlemesi seçim yapana kadar durduruldu.', 'warning');
          } else {
            trusted = true;
          }
        } else {
          // Tam V3 yok: boot anlık görüntüsü yalnız tema/kimlik/özet için
          // init'te uygulandı. Kütüphane içermediği için YAZMA yapılmaz.
          trusted = !hasMeaningfulProgress(dataRef.current);
          if (!trusted) {
            showToast('Yerel kütüphane kaydı bulunamadı; bulut yedeği kontrol edilecek. Verileriniz silinmedi.', 'warning');
          }
        }
      } catch {
        trusted = !hasMeaningfulProgress(dataRef.current);
      } finally {
        hydrationTrustedRef.current = trusted;
        hydratedRef.current = true;
        setHydrated(true);
      }
    })();
  }, []);

  // YAZMA — her durum değişiminde canlı state'i kanonik V3 kaydına çevir.
  // Eski `sinevia-v1` localStorage anahtarına HAM yazım YOKTUR.
  useEffect(() => {
    if (!hydrated || !hydrationTrustedRef.current || !isFullAppRecord(data)) return;
    const previous = lastV3Ref.current;
    const bumpUpdatedAt = !skipUpdatedAtBumpRef.current;
    skipUpdatedAtBumpRef.current = false;
    const quests = readQuestState();
    const extras = readLegacyExtras();

    // İçerik değişmediyse (yalnız geçici UI state'i değişti) updatedAt bump etme
    // ve diske yeniden yazma: hash sabit kalır, gereksiz bulut yüklemesi olmaz.
    const contentCandidate = fromLegacyCore(dataRef.current, previous, {
      quests,
      extras,
      updatedAt: previous?.updatedAt ?? new Date().toISOString(),
    });
    const contentChanged = !previous || makeSaveHash(contentCandidate) !== makeSaveHash(previous);

    const next = contentChanged && bumpUpdatedAt
      ? fromLegacyCore(dataRef.current, previous, {
          quests,
          extras,
          updatedAt: new Date().toISOString(),
        })
      : contentCandidate;
    lastV3Ref.current = next;
    // 600 ms debounce + küçük boot anlık görüntüsü (saveStateV3 içinde).
    if (contentChanged) saveStateV3(next);

    // Sekme gizlenince / kapanınca bekleyen yazımı anında uygula + tam yedek.
    const flushWrites = () => {
      void saveStateV3Immediate(lastV3Ref.current ?? next, { backup: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushWrites();
    };
    window.addEventListener('pagehide', flushWrites);
    window.addEventListener('beforeunload', flushWrites);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flushWrites);
      window.removeEventListener('beforeunload', flushWrites);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [data, hydrated]);

  // TAM YEDEK — ana IDB kaydı bozulursa kütüphaneyi kurtarmak için 10 sn debounce.
  const backupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated || !hydrationTrustedRef.current) return;
    if (!isFullAppRecord(data) || !hasMeaningfulProgress(data)) return;
    if (backupTimerRef.current) clearTimeout(backupTimerRef.current);
    backupTimerRef.current = setTimeout(() => {
      if (lastV3Ref.current) void saveStateV3Immediate(lastV3Ref.current, { backup: true });
    }, 10000);
    const flushBackup = () => {
      if (backupTimerRef.current) { clearTimeout(backupTimerRef.current); backupTimerRef.current = null; }
      if (lastV3Ref.current) void saveStateV3Immediate(lastV3Ref.current, { backup: true });
    };
    window.addEventListener('pagehide', flushBackup);
    window.addEventListener('beforeunload', flushBackup);
    return () => {
      if (backupTimerRef.current) { clearTimeout(backupTimerRef.current); backupTimerRef.current = null; }
      window.removeEventListener('pagehide', flushBackup);
      window.removeEventListener('beforeunload', flushBackup);
    };
  }, [data, hydrated]);

  // HAFTALIK PLAN TEMİZLİĞİ — planlanan günün üzerinden 2 gün geçmiş ve film
  // hâlâ izlenmemişse kaydı otomatik kaldır. Kullanıcı tarihi değiştirirse
  // (UPDATE_PLAN_ITEM) sayaç yeni tarihten başlar.
  useEffect(() => {
    const prune = () => dispatch({ type: 'PRUNE_EXPIRED_PLAN_ITEMS', today: todayStr() });
    prune();
    const timer = window.setInterval(prune, 60 * 60 * 1000);
    const onPlanVisibility = () => {
      if (document.visibilityState === 'visible') prune();
    };
    document.addEventListener('visibilitychange', onPlanVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onPlanVisibility);
    };
  }, [data.weeklyPlan, data.movies]);

  // ÇEVRİMDIŞI KUYRUK — bağlantı geri geldiğinde bekleyen network_logs satırlarını sırayla gönder.
  const logQueueFiredRef = useRef(false);
  useEffect(() => {
    const flushLogQueue = async () => {
      const q = readLogQueue();
      if (!q.length) return;
      for (const op of q) {
        try {
          await withRetry(() => supabase.from('network_logs').insert([op.row]).then(({ error }: { error: any }) => { if (error) throw error; }), 2, 300);
          dequeueLogOp(op.id);
        } catch { break; /* hâlâ çevrimdışı — kuyrukta kal, sonraki denemede tekrar */ }
      }
    };
    // Mount'ta bir kez dene.
    if (!logQueueFiredRef.current) { logQueueFiredRef.current = true; flushLogQueue(); }
    // Ağ durumu çevrimiçi olunca tekrar dene.
    const onOnline = () => flushLogQueue();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [data.agentId]);

  // Bildirim tercihleri sunucuya da yazılır: Edge Function push gönderirken
  // bunları okur, böylece kapatılan tür için bildirim gitmez.
  useEffect(() => {
    if (!data.notificationsEnabled || !data.agentId) return;
    void saveNotificationPrefs(data.agentId, {
      messages: data.notifyMessages !== false,
      friendRequests: data.notifyFriendRequests !== false,
      lists: data.notifyLists !== false,
    });
  }, [data.notificationsEnabled, data.agentId, data.notifyMessages, data.notifyFriendRequests, data.notifyLists]);

  // Push aboneliğini kendi kendine onarır. Abonelik eski/yanlış VAPID
  // anahtarıyla kurulmuşsa (`push_config` ile uyuşmuyorsa) sessizce yenilenir;
  // böylece ortam değişkeni hatası yüzünden bildirimler ölü kalmaz.
  useEffect(() => {
    if (pushHealRef.current || !data.notificationsEnabled || !data.agentId) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    pushHealRef.current = true;
    void ensurePushSubscription(data.agentId).catch(() => undefined);
  }, [data.notificationsEnabled, data.agentId]);

  // Uygulama AÇIKKEN bildirim: realtime kanalı bu projede x-agent-token
  // başlığını websocket üzerinden taşımadığı için RLS olayları iletmiyor.
  // Bu yüzden görünür sekmede 45 saniyede bir REST ile yoklanır.
  // Uygulama kapalı/arka plandayken devreye Web Push girer
  // (bkz. supabase/functions/send-push).
  useEffect(() => {
    if (!data.notificationsEnabled || !data.agentId) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const agentId = data.agentId;

    // Cihazın push aboneliğini tazele (anahtar veya cihaz değişmiş olabilir).
    void ensurePushSubscription(agentId);

    // İlk kurulumda eski bildirimlerin topluca gösterilmemesi için
    // başlangıç zamanı "şimdi" kabul edilir.
    const seenKey = `sinevia_notify_seen_${agentId}`;
    let lastSeen = 0;
    try {
      lastSeen = Number(localStorage.getItem(seenKey) || 0) || 0;
    } catch {
      lastSeen = 0;
    }
    if (!lastSeen) {
      lastSeen = Date.now();
      try {
        localStorage.setItem(seenKey, String(lastSeen));
      } catch {
        /* yoksay */
      }
    }

    const notifyMessages = data.notifyMessages !== false;
    const notifyFriendRequests = data.notifyFriendRequests !== false;
    const notifyLists = data.notifyLists !== false;

    let cancelled = false;

    const check = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      const sinceIso = new Date(lastSeen).toISOString();
      let newest = lastSeen;

      try {
        const [msgRes, friendRes, listRes] = await Promise.all([
          notifyMessages
            ? supabase
                .from('messages')
                .select('id,created_at')
                .eq('receiver_id', agentId)
                .eq('is_read', false)
                .gt('created_at', sinceIso)
                .order('created_at', { ascending: false })
                .limit(25)
            : Promise.resolve({ data: [] as Array<{ created_at?: string }> }),
          notifyFriendRequests
            ? supabase
                .from('friendships')
                .select('id,created_at')
                .eq('receiver_id', agentId)
                .eq('status', 'pending')
                .gt('created_at', sinceIso)
                .order('created_at', { ascending: false })
                .limit(25)
            : Promise.resolve({ data: [] as Array<{ created_at?: string }> }),
          notifyLists
            ? supabase
                .from('recommendations')
                .select('id,created_at')
                .eq('receiver_id', agentId)
                .gt('created_at', sinceIso)
                .order('created_at', { ascending: false })
                .limit(25)
            : Promise.resolve({ data: [] as Array<{ created_at?: string }> }),
        ]);

        const rowsOf = (res: unknown): Array<{ created_at?: string }> => {
          const value = (res as { data?: unknown } | null)?.data;
          return Array.isArray(value) ? (value as Array<{ created_at?: string }>) : [];
        };

        const messageRows = rowsOf(msgRes);
        const friendRows = rowsOf(friendRes);
        const listRows = rowsOf(listRes);

        for (const row of [...messageRows, ...friendRows, ...listRows]) {
          const time = row.created_at ? new Date(row.created_at).getTime() : NaN;
          if (Number.isFinite(time) && time > newest) newest = time;
        }

        if (!cancelled) {
          if (messageRows.length > 0) {
            showAppNotification('Sinevia - Yeni Mesaj 💬', {
              body:
                messageRows.length > 1
                  ? `${messageRows.length} yeni mesajın var!`
                  : 'Ağından yeni bir mesajın var!',
              url: '/#network',
              tag: 'sinevia-messages',
            });
          }
          if (friendRows.length > 0) {
            showAppNotification('Sinevia - Yeni Bağlantı 👤', {
              body:
                friendRows.length > 1
                  ? `${friendRows.length} yeni arkadaşlık isteğin var!`
                  : 'Biri sana arkadaşlık isteği gönderdi!',
              url: '/#network',
              tag: 'sinevia-friendships',
            });
          }
          if (listRows.length > 0) {
            showAppNotification('Sinevia - Yeni Liste 🎁', {
              body:
                listRows.length > 1
                  ? `${listRows.length} yeni tavsiye listen var!`
                  : 'Sana özel bir tavsiye listesi gönderildi!',
              url: '/#network',
              tag: 'sinevia-lists',
            });
          }
        }

        if (newest > lastSeen) {
          lastSeen = newest;
          try {
            localStorage.setItem(seenKey, String(newest));
          } catch {
            /* yoksay */
          }
        }
      } catch (err) {
        console.warn('[bildirim] yoklama hatası:', err);
      }
    };

    // Tarayıcı aboneliği yenilerse (pushsubscriptionchange) yeni aboneliği kaydet.
    const onServiceWorkerMessage = (event: MessageEvent) => {
      const message = event.data as { type?: string } | null;
      if (message && message.type === 'sinevia:resubscribe-push') {
        void ensurePushSubscription(agentId);
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onServiceWorkerMessage);
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void check();
    };

    // 120 sn: sohbet/istek bildirimi için yeterli. Uygulama kapalıyken
    // zaten Web Push devrede; bu yoklama yalnızca açık sekme içindir.
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, 120000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    void check();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onServiceWorkerMessage);
      }
    };
  }, [data.notificationsEnabled, data.agentId, data.notifyMessages, data.notifyFriendRequests, data.notifyLists]);

  const showAchievementToast = useCallback((item: Omit<AchievementToastItem, 'id'>) => { const id = uid(); setAchievementToasts({ type: 'add', toast: { ...item, id } }); setTimeout(() => setAchievementToasts({ type: 'remove', id }), DISPLAY_DURATION_MS); }, []);

  // Kutlama kuyruğu beklerken veya ses çalarken kısa nabız. Nabız yalnızca
  // ses başladığında değil, bekleyen bir animasyon olduğunda da çalışır;
  // aksi halde ses bittikten sonra hiçbir state değişmeyip kuyruk kilitlenir.
  useEffect(() => {
    const hasPendingCelebration =
      !!contractQueuedRef.current ||
      !!contractOpenRef.current ||
      !!data.pendingXpGain ||
      !!data.pendingLevelUp ||
      (data.pendingLevelUpQueue?.length || 0) > 0 ||
      (data.pendingToasts?.length || 0) > 0 ||
      !!data.pendingCoinGain ||
      !!queuedCoinGain ||
      !!xpGainData ||
      !!levelUpData ||
      !!coinGainData ||
      isQuestCelebrating ||
      !!seasonCompleteData;
    if (!isSoundBusy() && !hasPendingCelebration) return;
    const delay = isSoundBusy()
      ? Math.min(getSoundBusyRemainingMs() + 40, 250)
      : 250;
    const timer = window.setTimeout(() => setAnimationTick((tick) => tick + 1), delay);
    return () => window.clearTimeout(timer);
  }, [
    animationTick,
    data.pendingXpGain,
    data.pendingLevelUp,
    data.pendingLevelUpQueue,
    data.pendingToasts,
    data.pendingCoinGain,
    queuedCoinGain,
    xpGainData,
    levelUpData,
    coinGainData,
    isQuestCelebrating,
    seasonCompleteData,
    contractCelebrationData,
    contractTick,
  ]);

  // Pazar görevi kutlaması her şeyden önce açılır; diğer animasyonlar
  // contractOpenRef kapanana kadar bekletilir.
  useEffect(() => {
    if (!contractQueuedRef.current || contractOpenRef.current) return;
    if (
      xpGainData ||
      levelUpData ||
      seasonCompleteData ||
      seasonQueuedRef.current ||
      seasonOpenRef.current ||
      questCelebratingRef.current ||
      coinGainData ||
      achievementToasts.length > 0 ||
      isProcessingToastRef.current ||
      isSoundBusy()
    ) return;
    const payload = contractQueuedRef.current;
    contractQueuedRef.current = null;
    contractOpenRef.current = true;
    setContractCelebrationData(payload);
    setAnimationTick((tick) => tick + 1);
    import('../lib/sound').then(({ playMarketContractCompleteSound }) => playMarketContractCompleteSound(payload.rarity));
  }, [contractTick, animationTick, queueTick, xpGainData, levelUpData, seasonCompleteData, isQuestCelebrating, coinGainData, achievementToasts.length]);

  // XP barı tek başına bir katmandır. Başarım bildirimiyle aynı anda
  // görünebilir (kullanıcı istisnası); diğer kutlamalarla binemez.
  useEffect(() => {
    const inBoot = Date.now() - bootStartRef.current < BOOT_RECONCILE_WINDOW_MS;
    if (!data.pendingXpGain) return;
    if (contractCompletionPendingRef.current || contractCelebratingRef.current || contractQueuedRef.current) return;
    if (levelUpData || seasonCompleteData || seasonQueuedRef.current || seasonOpenRef.current || questCelebratingRef.current || coinGainData) return;
    // Başarım sesi XP barıyla birlikte çalabilir; diğer sesler bitmeden başlamaz.
    if (isSoundBusy() && getSoundBusyKind() !== 'achievement') return;

    dispatch({ type: 'CLEAR_XP_GAIN' });
    if (inBoot) return;
    if (xpTimerRef.current) clearTimeout(xpTimerRef.current);
    xpGainOpenRef.current = true;
    setXpGainData(data.pendingXpGain);
    xpTimerRef.current = setTimeout(() => {
      xpGainOpenRef.current = false;
      setXpGainData(null);
      xpTimerRef.current = null;
      setAnimationTick((tick) => tick + 1);
    }, data.fastCelebrations ? 1900 : XP_OVERLAY_DURATION_MS);
  }, [data.pendingXpGain, data.fastCelebrations, animationTick, isContractCelebrating, contractTick, levelUpData, seasonCompleteData, isQuestCelebrating, coinGainData]);

  // Seviye modalı; XP kartı, başarım kuyruğu, pazar görevi, sezon ve quest
  // bitmeden açılmaz. Böylece sesler de üst üste binmez.
  useEffect(() => {
    const inBoot = Date.now() - bootStartRef.current < BOOT_RECONCILE_WINDOW_MS;
    if (!data.pendingLevelUp) return;
    if (contractCompletionPendingRef.current || contractCelebratingRef.current || contractQueuedRef.current) return;
    if (xpGainData || data.pendingXpGain || xpGainOpenRef.current) return;
    if (
      levelUpData ||
      levelUpQueuedRef.current ||
      seasonCompleteData ||
      seasonQueuedRef.current ||
      seasonOpenRef.current ||
      questCelebratingRef.current ||
      (data.pendingToasts?.length || 0) > 0 ||
      achievementToasts.length > 0 ||
      isProcessingToastRef.current ||
      coinGainData ||
      isSoundBusy()
    ) return;

    // Ref'i dispatch'ten ÖNCE işaretle: coin sahnesi aynı commit'te level modalını
    // henüz görmeden açılıp üst üste binmesin.
    levelUpQueuedRef.current = true;
    dispatch({ type: 'CLEAR_LEVELUP' });
    if (inBoot) return;
    if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
    const payload = data.pendingLevelUp;
    const fire = () => {
      // 150ms beklerken bir başarım bildirimi açılmış olabilir; modal onun
      // üstüne binmesin diye ses/bildirim bitene kadar tekrar dene.
      if (isProcessingToastRef.current || achievementToastsRef.current.length > 0 || isSoundBusy()) {
        levelUpTimerRef.current = setTimeout(fire, 250);
        return;
      }
      levelUpTimerRef.current = null;
      levelUpQueuedRef.current = false;
      setLevelUpData(payload);
      if (!levelUpSoundStartedRef.current) { levelUpSoundStartedRef.current = true; import('../lib/sound').then(({ playLevelUpSound }) => playLevelUpSound()); }
      setAnimationTick((tick) => tick + 1);
    };
    levelUpTimerRef.current = setTimeout(fire, 150);
  }, [data.pendingLevelUp, data.pendingXpGain, xpGainData, animationTick, queueTick, isContractCelebrating, contractTick, levelUpData, seasonCompleteData, isQuestCelebrating, achievementToasts.length, coinGainData]);

  // Coin animasyonu — başarım/level parçaları reducer'da birleşir. Ara parçalar
  // (final=false) tüketilmez; son toplam ancak bildirimler ve seviye zinciri
  // bittikten sonra tek bir animasyonda gösterilir.
  useEffect(() => {
    const payload = data.pendingCoinGain;
    if (!payload || payload.final === false) return;
    dispatch({ type: 'CLEAR_COIN_GAIN' });
    if (Date.now() - bootStartRef.current < BOOT_RECONCILE_WINDOW_MS) return;
    // Aktif coin sahnesinin kendi kapanma timer'ını BURADA iptal ETME.
    // Yeni coin gelince eski timer temizlenirse sahne ekranda kilitli kalır;
    // yeni sahne başlarken coin play effect timer'ı zaten yeniliyor.
    if (coinShowTimerRef.current) clearTimeout(coinShowTimerRef.current);
    // Başarım bildirimi + XP barı bitmeden coin animasyonu başlamaz.
    coinShowTimerRef.current = setTimeout(() => {
      setQueuedCoinGain((prev) => prev
        ? { amount: prev.amount + payload.amount, label: prev.label || payload.label }
        : { amount: payload.amount, label: payload.label });
      coinShowTimerRef.current = null;
    }, DISPLAY_DURATION_MS + 250);
  }, [data.pendingCoinGain]);

  // Seviye kutlaması açıkken coin sahnesi başlamaz; modal zinciri kapanınca
  // biriken toplam tek seferde oynar.
  useEffect(() => {
    if (!queuedCoinGain) return;
    if (
      contractCelebratingRef.current ||
      contractQueuedRef.current ||
      xpGainData ||
      data.pendingXpGain ||
      levelUpData ||
      levelUpQueuedRef.current ||
      data.pendingLevelUp ||
      data.pendingLevelUpQueue?.length ||
      seasonCompleteData ||
      seasonQueuedRef.current ||
      seasonOpenRef.current ||
      questCelebratingRef.current ||
      questQueuedRef.current ||
      (data.pendingToasts?.length || 0) > 0 ||
      achievementToasts.length > 0 ||
      isProcessingToastRef.current ||
      isSoundBusy()
    ) return;
    setQueuedCoinGain(null);
    if (coinGainTimerRef.current) clearTimeout(coinGainTimerRef.current);
    setCoinGainData({ amount: queuedCoinGain.amount, label: queuedCoinGain.label });
    import('../lib/sound').then(({ playCoinSound }) => playCoinSound());
    // Animasyon 6.2s sürüyor; fade bitmeden katmanı sökmemek için 6.4s bekle.
    coinGainTimerRef.current = setTimeout(() => { setCoinGainData(null); coinGainTimerRef.current = null; }, 2600);
  }, [queuedCoinGain, levelUpData, data.pendingLevelUp, data.pendingLevelUpQueue, data.pendingXpGain, xpGainData, seasonCompleteData, isQuestCelebrating, data.pendingToasts, achievementToasts.length, isContractCelebrating, contractTick, animationTick, queueTick]);

  // Ayna ref'ler: kuyruk etkileri state değişiminden ÖNCE ref okuyabilsin diye
  // her state değişiminde hemen eşitlenir (bileşen sırası: bu etkiler kuyruk
  // etkilerinden ÖNCE tanımlı → ilk turda da tazedir).
  useEffect(() => { levelUpOpenRef.current = !!levelUpData; }, [levelUpData]);
  useEffect(() => { seasonOpenRef.current = !!seasonCompleteData; }, [seasonCompleteData]);
  useEffect(() => { xpGainOpenRef.current = xpGainData !== null; }, [xpGainData]);
  useEffect(() => { questCelebratingRef.current = isQuestCelebrating; }, [isQuestCelebrating]);
  useEffect(() => () => {
    if (toastRetryRef.current) clearTimeout(toastRetryRef.current);
    if (coinGainTimerRef.current) clearTimeout(coinGainTimerRef.current);
    if (coinShowTimerRef.current) clearTimeout(coinShowTimerRef.current);
  }, []);

  // Sezon kutlaması: tam ekran bir kutlama/XP barı açıkken AÇILMAZ; hepsi
  // bitince sırayla kendiliğinden açılır (XP → seviye → sezon önceliği).
  const requestSeasonComplete = useCallback((payload: { seriesTitle: string; season: number }) => {
    // Kapı: tam ekran seviye/kutlama penceresi VEYA görünen başarım bildirimi
    // (sezon modalı kartın üstüne açılıp kaybolmasına yol açmasın).
    if (isSoundBusy() || contractCelebratingRef.current || contractQueuedRef.current || levelUpQueuedRef.current || levelUpOpenRef.current || xpGainOpenRef.current || questCelebratingRef.current || seasonOpenRef.current || coinGainData || queuedCoinGain || achievementToasts.length > 0) {
      seasonQueuedRef.current = payload;
    } else setSeasonCompleteData(payload);
  }, [achievementToasts]);
  useEffect(() => {
    if (!seasonQueuedRef.current) return;
    if (isSoundBusy() || contractCelebratingRef.current || contractQueuedRef.current || levelUpQueuedRef.current || levelUpOpenRef.current || xpGainOpenRef.current || questCelebratingRef.current || coinGainData || queuedCoinGain || achievementToasts.length > 0) return;
    const payload = seasonQueuedRef.current; seasonQueuedRef.current = null;
    setSeasonCompleteData(payload);
  }, [xpGainData, levelUpData, isQuestCelebrating, achievementToasts, isContractCelebrating, contractTick, animationTick]);

  useEffect(() => {
    const queue = data.pendingToasts || []; if (queue.length === 0 || isSoundBusy() || contractCompletionPendingRef.current || contractCelebratingRef.current || contractQueuedRef.current || levelUpData || levelUpOpenRef.current || seasonCompleteData || seasonQueuedRef.current || seasonOpenRef.current || isProcessingToastRef.current || questCelebratingRef.current || coinGainData) return;
    // Açılış uzlaşma penceresindeki kuyruk (bayat bulut/hidrasyon kaynaklı) GÖSTERİLMEZ, sessizce tüketilir.
    if (Date.now() - bootStartRef.current < BOOT_RECONCILE_WINDOW_MS) { dispatch({ type: 'CONSUME_NEXT_TOAST' }); dispatch({ type: 'CLEAR_LEVEL_UP_QUEUE' }); return; }
    isProcessingToastRef.current = true; const nextAchievement = queue[0], remainingCount = queue.length - 1; const comboText = remainingCount > 0 ? ` (+${remainingCount} Sırada)` : '';
    showAchievementToast({ achievementName: `${nextAchievement.name}${comboText}`, achievementId: nextAchievement.achievementId, tier: nextAchievement.tier, icon: nextAchievement.icon, description: nextAchievement.description });
    import('../lib/sound').then(({ playAchievementSound }) => playAchievementSound()); dispatch({ type: 'CONSUME_NEXT_TOAST' });
    setTimeout(() => { isProcessingToastRef.current = false; setQueueTick((t) => t + 1); }, QUEUE_STEP_DURATION_MS);
  }, [data.pendingToasts, levelUpData, seasonCompleteData, queueTick, showAchievementToast, isQuestCelebrating, isContractCelebrating, contractTick, animationTick, coinGainData]);

  const showToast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    // SIRA: yalnızca TAM EKRAN kutlamalar (seviye/sezon/görev) açıksa/beke-
    // leniyorsa ertelenir (modal altında kaybolmasın) → 400ms aralıkla dener.
    // Başarım bildirimleri artık ERTELENMEZ: stackOffset ile üstüne kaydırılır.
    const attempt = () => {
      if (isSoundBusy() || contractCelebratingRef.current || contractQueuedRef.current || levelUpQueuedRef.current || levelUpOpenRef.current || seasonOpenRef.current || seasonQueuedRef.current || questCelebratingRef.current) {
        toastRetryRef.current = setTimeout(attempt, 400);
        return;
      }
      toastRetryRef.current = null;
      const id = uid(); setToasts({ type: 'add', toast: { id, message, type } });
      setTimeout(() => setToasts({ type: 'remove', id }), 2800);
    };
    attempt();
  }, []);
  /* =======================================================================
     SENKRON — revizyon tabanlı protokol (src/lib/syncEngine.ts)
     Tek yazma yolu `sync_commit`, tek okuma yolu `sync_get_state`'tir.
     Otomatik birleştirme YOKTUR; `merge` yalnız kullanıcı seçimindedir.
     ======================================================================= */
  const syncMetaStore = useMemo<SyncMetaStore>(() => ({
    getLastSyncedHash: (agentId: string) => {
      try { return localStorage.getItem(`sinevia_last_synced_hash:${agentId}`); } catch { return null; }
    },
    setLastSyncedHash: (agentId: string, hash: string | null) => {
      try {
        if (hash) localStorage.setItem(`sinevia_last_synced_hash:${agentId}`, hash);
        else localStorage.removeItem(`sinevia_last_synced_hash:${agentId}`);
      } catch { /* kota / gizli mod */ }
    },
  }), []);

  /** Motorun indirdiği/commit ettiği kanonik kaydı yerel state'e uygular. */
  function applySyncedState(state: AppStateV3) {
    lastV3Ref.current = state;
    skipUpdatedAtBumpRef.current = true;
    writeQuestState(state.quests);
    const view = toLegacyCoreView(state) as unknown as ExtendedAppData;
    dataRef.current = view;
    dispatch({ type: 'REPLACE_FROM_CLOUD_STORAGE', data: view, questData: state.quests });
    void saveStateV3Immediate(state, { backup: true });
  }

  const syncEngine = useMemo<SyncEngine>(() => {
    const engine = createSyncEngine({
      client: createSupabaseSyncClient(supabase as unknown as SyncRpcClient),
      deviceId: readDeviceId(),
      getState: () => lastV3Ref.current ?? fromLegacyCore(dataRef.current, null, {
        quests: readQuestState(),
        extras: readLegacyExtras(),
        updatedAt: new Date().toISOString(),
      }),
      setState: applySyncedState,
      meta: syncMetaStore,
    });
    return engine;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applySyncedState yalnız ref/dispatch kullanır
  }, [syncMetaStore]);

  function handleSyncResult(result: SyncResult, manual = false) {
    switch (result.status) {
      case 'conflict':
        if (!cloudConflictRef.current) {
          cloudConflictRef.current = result.conflict;
          setCloudConflict(result.conflict);
          showToast('Cihaz ve bulut kaydı çakıştı; hangi verinin kullanılacağını seç.', 'warning');
        }
        setSyncStatus('synced');
        return;
      case 'cloud-loaded':
        setSyncStatus('synced');
        if (manual) showToast('Bulut kaydındaki veriler bu cihaza yüklendi.', 'success');
        return;
      case 'local-uploaded':
        setSyncStatus('synced');
        if (manual) showToast('Bu cihazdaki veriler buluta yüklendi.', 'success');
        return;
      case 'up-to-date':
        setSyncStatus('synced');
        if (manual) showToast('Cihaz ve bulut zaten eşit.', 'info');
        return;
      case 'error':
      default:
        setSyncStatus('error');
        if (manual) {
          showToast(
            result.status === 'error' && result.error.code === 'network'
              ? 'Buluta ulaşılamadı; bu cihazdaki veriler korunuyor.'
              : 'Eşitleme tamamlanamadı; bu cihazdaki veriler korunuyor.',
            'error',
          );
        }
        return;
    }
  }

  /** Karar matrisini çalıştırır (getRemote → karar → gerekirse commit). */
  const runSync = useCallback(async (manual = false) => {
    const agentId = dataRef.current.agentId;
    let zeroReset = false;
    try { zeroReset = localStorage.getItem('sinevia_zero_reset') === '1'; } catch { /* gizli mod */ }
    const gate = shouldRunSync({
      hydrated,
      agentId,
      trusted: hydrationTrustedRef.current,
      approvalPending: syncApprovalPendingRef.current,
      deferred: syncDeferredRef.current,
      conflictPending: Boolean(cloudConflictRef.current),
      zeroReset,
    }, manual);
    if (!gate || !agentId) return;
    if (syncInFlightRef.current) return;

    if (!lastV3Ref.current) {
      lastV3Ref.current = fromLegacyCore(dataRef.current, null, {
        quests: readQuestState(),
        extras: readLegacyExtras(),
        updatedAt: new Date().toISOString(),
      });
    }

    syncInFlightRef.current = true;
    setSyncStatus('syncing');
    try {
      const result = await syncEngine.sync(agentId);
      handleSyncResult(result, manual);
    } catch {
      setSyncStatus('error');
    } finally {
      syncInFlightRef.current = false;
    }
  }, [hydrated, syncEngine]);

  /**
   * Çakışma diyaloğu seçimi. 'merge' YALNIZ burada, açık kullanıcı seçimiyle
   * çalışır; varsayılan (X/ESC) 'later' → hiçbir veri değişmez.
   */
  const resolveCloudConflict = useCallback(async (choice: ConflictChoice) => {
    const agentId = dataRef.current.agentId;
    if (!agentId) return;
    cloudConflictRef.current = null;
    setCloudConflict(null);
    syncApprovalPendingRef.current = false;

    if (choice === 'later') {
      syncDeferredRef.current = true;
      syncEngine.clearPendingConflict();
      showToast('Eşitleme ertelendi; sayfayı yenilediğinde tekrar sorulacak. Veriler korunuyor.', 'info');
      return;
    }

    setSyncStatus('syncing');
    try {
      const result = await syncEngine.resolveConflict(agentId, choice);
      handleSyncResult(result, true);
    } catch {
      setSyncStatus('error');
      showToast('Seçim uygulanamadı; bu cihazdaki veriler korunuyor.', 'error');
    }
  }, [showToast, syncEngine]);

  // Otomatik senkron: veri değişiminde 15 sn debounce; sekme görünür/odaklanınca hemen.
  useEffect(() => {
    if (!hydrated || !data.agentId || !hydrationTrustedRef.current) return;
    const timer = window.setTimeout(() => { void runSync(); }, 15000);
    const onVisible = () => { if (document.visibilityState === 'visible') void runSync(); };
    const onFocus = () => { void runSync(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [data, hydrated, runSync]);

  // İlk hidrasyondan hemen sonra bir kez dene (açılış kontrolü).
  useEffect(() => {
    if (!hydrated) return;
    void runSync();
  }, [hydrated, runSync]);

  // DEPOLAMA HATASI — localStorage kotası dolarsa veya IndexedDB yazımı başarısız
  // olursa sessiz kalmak yerine kullanıcıyı uyar (5 dakikada en fazla bir kez).
  const storageWarnedAtRef = useRef(0);
  useEffect(() => {
    setStorageErrorHandler(() => {
      const now = Date.now();
      if (now - storageWarnedAtRef.current < 5 * 60 * 1000) return;
      storageWarnedAtRef.current = now;
      showToast('Veriler kaydedilemedi. Hafıza dolu olabilir; lütfen Ayarlar > Veri Yönetimi bölümünden yedek alın.', 'warning');
    });
    return () => setStorageErrorHandler(null);
  }, [showToast]);

  const toggleLockedNames = useCallback(() => dispatch({ type: 'TOGGLE_LOCKED_NAMES' }), []);
  const toggleBadgeDetails = useCallback(() => dispatch({ type: 'TOGGLE_BADGE_DETAILS' }), []);
  const toggleReducedMotion = useCallback(() => dispatch({ type: 'TOGGLE_REDUCED_MOTION' }), []);
  const toggleFastCelebrations = useCallback(() => dispatch({ type: 'TOGGLE_FAST_CELEBRATIONS' }), []);
  const toggleNotifications = useCallback((enabled: boolean) => {
    rememberNotificationPrefs({ notificationsEnabled: enabled });
    dispatch({ type: 'TOGGLE_NOTIFICATIONS', enabled });
  }, []);
  const toggleShareWatched = useCallback((enabled: boolean) => dispatch({ type: 'TOGGLE_SHARE_WATCHED', enabled }), []);
  const toggleSharePastWatched = useCallback((enabled: boolean) => {
    dispatch({ type: 'TOGGLE_SHARE_PAST_WATCHED', enabled });
    const from = enabled ? 'watched_hidden' : 'watched';
    const to = enabled ? 'watched' : 'watched_hidden';
    supabase.from('network_logs').update({ action_type: to }).eq('agent_id', data.agentId).eq('action_type', from)
      .then(({ error }: { error: any }) => { if (error) { console.error(error); showToast('Eski izleme kayıtları güncellenemedi!', 'warning'); } });
  }, [data.agentId, showToast]);
  const toggleSpecificNotification = useCallback((key: 'notifyMessages' | 'notifyFriendRequests' | 'notifyLists', enabled: boolean) => {
    rememberNotificationPrefs({ [key]: enabled });
    dispatch({ type: 'TOGGLE_SPECIFIC_NOTIFICATION', key, enabled });
  }, []);
  const setNickname = useCallback((nickname: string) => { dispatch({ type: 'SET_NICKNAME', nickname }); showToast('Kullanıcı adı güncellendi!', 'success'); }, [showToast]);
  
  const recoverIdentity = useCallback(async (
    agentId: string,
    recoveryKey: string,
    nickname: string,
    opts?: { keepExistingRecoveryKey?: boolean }
  ): Promise<boolean> => {
    try {
      const client = createSupabaseSyncClient(supabase as unknown as SyncRpcClient);
      const remote = await client.getRemote(agentId);
      if (!remote) {
        showToast('Bulut yedeği bulunamadı; kimlik değiştirilmedi.', 'error');
        return false;
      }

      const keyToStore = opts?.keepExistingRecoveryKey
        ? (data.recoveryKey || recoveryKey)
        : recoveryKey;

      // Buluttan gelen kayıt BİREBİR uygulanır; XP yeniden hesaplanmaz.
      const state: AppStateV3 = {
        ...remote.payload,
        schemaVersion: 3,
        ownerAgentId: agentId,
        revision: remote.revision,
        deviceId: remote.payload.deviceId || readDeviceId(),
        updatedAt: remote.payload.updatedAt || new Date().toISOString(),
        settings: {
          ...remote.payload.settings,
          nickname: nickname || remote.payload.settings?.nickname,
        },
        // recoveryKey cihaza özeldir ve V3'te yerel `legacy` torbasında taşınır.
        legacy: {
          ...(remote.payload.legacy ?? {}),
          core: {
            ...((remote.payload.legacy?.core as Record<string, unknown> | undefined) ?? {}),
            recoveryKey: keyToStore,
          },
        },
      };

      dispatch({ type: 'RECOVER_IDENTITY', agentId, recoveryKey: keyToStore, nickname });
      applySyncedState(state);
      syncMetaStore.setLastSyncedHash(agentId, makeSaveHash(state));
      syncDeferredRef.current = false;
      syncApprovalPendingRef.current = false;
      cloudConflictRef.current = null;
      showToast('Kimlik ve tüm kütüphane buluttan yüklendi!', 'success');
      return true;
    } catch {
      // Sessiz: kimlik değişmedi, çağıran taraf hata mesajı gösterir.
    }

    showToast('Bulut yedeği bulunamadı; kimlik değiştirilmedi.', 'error');
    return false;
  }, [data.recoveryKey, showToast, syncMetaStore]);

  /** Ağ hesabına giriş yapıldıktan sonra kimliği ağ hesabına geçirir. */
  const adoptNetworkIdentity = useCallback(
    (agentId: string, nickname: string) =>
      recoverIdentity(agentId, '', nickname, { keepExistingRecoveryKey: true }),
    [recoverIdentity]
  );

  // AÇILIŞ UZLAŞTIRMASI — Oturumdaki ağ hesabı ile cihazdaki kimlik ayrışmışsa
  // (önceki giriş yarıda kaldıysa) sessizce düzelt. Böylece arkadaşlar,
  // mesajlar ve akış yanlış hesap için yüklenmez.
  useEffect(() => {
    if (!hydrated || !hydrationTrustedRef.current || !data.agentId) return;
    if (identityReconciledRef.current) return;
    identityReconciledRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        // Sonsuz yenileme koruması: 20 saniye içinde ikinci kez deneme.
        const guardKey = 'sinevia_identity_reconcile_at';
        try {
          const lastAttempt = Number(sessionStorage.getItem(guardKey) || 0);
          if (Date.now() - lastAttempt < 20000) return;
          sessionStorage.setItem(guardKey, String(Date.now()));
        } catch { /* gizli mod */ }

        const me = await networkGetMe();
        if (!me || cancelled || !me.agent_id || me.agent_id === data.agentId) return;
        const adopted = await adoptNetworkIdentity(me.agent_id, me.username);
        // Yalnızca kimlik gerçekten diske/state'e uygulandıysa yenile.
        if (adopted && !cancelled && dataRef.current?.agentId === me.agent_id) {
          window.location.reload();
        }
      } catch {
        // Sessiz: bir sonraki açılışta yeniden denenir.
      }
    })();

    return () => { cancelled = true; };
  }, [hydrated, data.agentId, adoptNetworkIdentity]);
  
  const updateShowcase = useCallback((showcase: ShowcaseItem[]) => { dispatch({ type: 'SET_SHOWCASE', showcase }); showToast('Profil vitrinin güncellendi!', 'success'); }, [showToast]);

  // Sinematik Otopsi (DNF) — yarım bırakma ve geri diriltme.
  const abandonMedia = useCallback((mediaType: 'movie' | 'series', id: string, opts?: { abandonedAt?: string; progress?: AbandonedProgress; reasons?: string[]; note?: string }) => {
    dispatch({ type: 'ABANDON_MEDIA', mediaType, id, abandonedAt: opts?.abandonedAt, progress: opts?.progress, reasons: opts?.reasons, note: opts?.note });
    showToast('🪦 Otopsi kaydedildi — "Yarım Bırakılanlar" mezarlığına eklendi', 'success');
  }, [showToast]);
  const reviveMedia = useCallback((mediaType: 'movie' | 'series', id: string) => {
    dispatch({ type: 'REVIVE_MEDIA', mediaType, id });
    showToast('⏱️ Operasyon devam ediyor — otopsi geri alındı', 'info');
  }, [showToast]);
  // Kör kalibrasyon düellosu (sonuç modal içinde gösterilir — ekstra bildirim yok).
  const resolveDuel = useCallback((winnerId: string, loserId: string, mediaType?: 'movie' | 'series') => {
    dispatch({ type: 'RESOLVE_DUEL', winnerId, loserId, mediaType });
  }, []);
  const applyCalibrationSuggestion = useCallback((id: string, newRating: number) => {
    dispatch({ type: 'APPLY_CALIBRATION_SUGGESTION', id, newRating });
    showToast('⚖️ Puan kalibre edildi', 'success');
  }, [showToast]);
  const setExternalActions = useCallback((actions: ExternalActionTemplate[]) => {
    dispatch({ type: 'SET_EXTERNAL_ACTIONS', actions });
  }, []);

  const addMovie = useCallback((title: string, year: string, genres: string[], collectionId: string | null, runtime?: number, posterUrl?: string | null, overview?: string, tmdbId?: number, imdbId?: string, watchProviders?: WatchProvider[], extra?: MovieExtraData): boolean => {
    if (data.movies.some((m) => normalize(m.title) === normalize(title))) { showToast('Bu film zaten listede var!', 'warning'); return false; }
    dispatch({ type: 'ADD_MOVIE', movie: { id: uid(), title: title.trim(), year: year.trim(), genres, collectionId, inPastQueue: Boolean(extra?.inPastQueue), runtime, posterUrl: posterUrl || undefined, overview: overview || undefined, tmdbId, imdbId, watchProviders, directors: extra?.directors, cast: extra?.cast, studios: extra?.studios, keywords: extra?.keywords, originalLanguage: extra?.originalLanguage, watched: false, isPastWatch: false, rating: null, note: '', watchedAt: null, startedAt: null, actualRuntime: null, addedAt: new Date().toISOString() } }); showToast('Film eklendi'); return true;
  }, [data.movies, showToast]);

  const startWatchingMovie = useCallback((id: string, silent = false) => {
    const movie = data.movies.find((m) => m.id === id); if (!movie || movie.watched || movie.startedAt) return;
    const anotherActive = data.movies.find((m) => !m.watched && m.id !== id && m.startedAt);
    if (anotherActive) { if (!silent) showToast(`⛔ Sayaç Engelleyici: Şu anda "${anotherActive.title}" için sayaç zaten açık!`, 'warning'); return; }
    dispatch({ type: 'START_WATCHING_MOVIE', id, startedAt: new Date().toISOString() }); showToast(`⏳ "${movie.title}" için geri sayım başladı!`, 'info');
  }, [data.movies, showToast]);

  const togglePauseWatchingMovie = useCallback((id: string) => {
    const movie = data.movies.find((m) => m.id === id); if (!movie || !movie.startedAt) return; const info = getMovieTimerInfo(movie);
    if (info.isPaused) { const resumedStart = new Date(Date.now() - info.elapsedSec * 1000).toISOString(); dispatch({ type: 'START_WATCHING_MOVIE', id, startedAt: resumedStart }); showToast('▶️ Geri sayım devam ediyor', 'info'); } 
    else { dispatch({ type: 'START_WATCHING_MOVIE', id, startedAt: `PAUSED:${info.elapsedSec}` }); showToast('⏸️ Geri sayım duraklatıldı', 'warning'); }
  }, [data.movies, showToast]);

  const cancelWatchingMovie = useCallback((id: string) => { dispatch({ type: 'CANCEL_WATCHING_MOVIE', id }); showToast('İzleme sayacı iptal edildi', 'info'); }, [showToast]);
  const canRateMovieWithTimer = useCallback((id: string): boolean => { const movie = data.movies.find((m) => m.id === id); if (!movie || !movie.startedAt) return true; const info = getMovieTimerInfo(movie); if (!info.canRateWithTimer) { showToast(`⛔ Henüz ${info.elapsedMins} dk geçti! En az ${info.minRequiredMins} dk geçmeli.`, 'error'); return false; } return true; }, [data.movies, showToast]);

  const watchMovie = useCallback((id: string, rating: number, note: string, detailedRating?: Record<string, number>, reviewTags?: string[], isPastWatch?: boolean) => {
    const movie = data.movies.find((m) => m.id === id); if (!movie) return;
    const finalIsPastWatch = isPastWatch !== undefined ? isPastWatch : Boolean(movie.isPastWatch || movie.inPastQueue);
    const now = new Date().toISOString(); const info = getMovieTimerInfo(movie); let actualRuntime = info.maxMins;
    if (!finalIsPastWatch && movie.startedAt && info.canRateWithTimer) { actualRuntime = Math.min(Math.max(1, info.elapsedMins), info.maxMins); }
    
    const isSpoiler = note.toLowerCase().includes('[spoiler]') || note.toLowerCase().includes('#spoiler');
    
    dispatch({ type: 'WATCH_MOVIE', id, rating, detailedRating, reviewTags, note, watchedAt: now, actualRuntime, isPastWatch: finalIsPastWatch, historyItem: { id: uid(), itemId: movie.id, kind: 'movie', type: 'movie', title: movie.title, rating, detailedRating, reviewTags, note, watchedAt: now, isPastWatch: finalIsPastWatch, startedAt: finalIsPastWatch ? null : (movie.startedAt || null), actualRuntime, originalRuntime: info.maxMins, genres: movie.genres, year: movie.year } });
    
    if (!finalIsPastWatch && data.shareWatchedInFeed !== false) {
      const row = {
        id: uid(), agent_id: data.agentId, action_type: 'watched', item_id: movie.id, item_type: 'movie',
        item_title: movie.title, item_poster: movie.posterUrl || null, rating: rating, note: note || '',
        genres: movie.genres, review_tags: reviewTags || [], is_spoiler: isSpoiler, created_at: now
      };
      withRetry(() => supabase.from('network_logs').insert([row]).then(({ error }: { error: any }) => { if (error) throw error; }))
        .catch(() => { enqueueLogOp({ id: row.id, kind: 'insert', row, createdAt: Date.now() }); });
    }
    if (finalIsPastWatch) showToast(`"${movie.title}" puanlandı ve Geçmiş'e eklendi`, 'info'); else if (movie.startedAt && actualRuntime < info.maxMins) showToast(`Film ${actualRuntime} dk'da bitti! (${info.maxMins - actualRuntime} dk kazandın ⚡)`, 'success');
    // PREMIUM RİTÜEL: puanlama arp sesi (stereo, kısa)
    import('../lib/sound').then(({ playRatingArpSound }) => playRatingArpSound());
  }, [data.movies, data.agentId, data.shareWatchedInFeed, showToast]);

  const updateHistoryRating = useCallback((historyId: string, rating: number, note: string, detailedRating?: Record<string, number>, reviewTags?: string[], isPastWatch?: boolean) => { dispatch({ type: 'UPDATE_HISTORY_RATING', historyId, rating, note, detailedRating, reviewTags, isPastWatch }); showToast('Puan güncellendi'); import('../lib/sound').then(({ playRatingArpSound }) => playRatingArpSound()); }, [showToast]);

  const addSeries = useCallback((title: string, genres: string[], seasons: number[], posterUrl?: string | null, overview?: string, tmdbId?: number, year?: string, imdbId?: string, watchProviders?: WatchProvider[], extra?: SeriesExtraData, episodeRuntime?: number): boolean => {
    if (data.removedSeriesTitles.some((t) => normalize(t) === normalize(title))) { showToast('Daha önce tamamlandı!', 'warning'); return false; }
    if (data.series.some((s) => normalize(s.title) === normalize(title))) { showToast('Bu dizi zaten listede var!', 'warning'); return false; }
    const episodes: Episode[] = []; seasons.forEach((epCount, s) => { for (let e = 1; e <= epCount; e++) episodes.push({ id: uid(), season: s + 1, episode: e, watched: false, rating: null, note: '', watchedAt: null, runtime: episodeRuntime || undefined }); });
    dispatch({ type: 'ADD_SERIES', series: { id: uid(), title: title.trim(), genres, episodes, posterUrl: posterUrl || undefined, overview: overview || undefined, tmdbId, year, imdbId, watchProviders, creators: extra?.creators, cast: extra?.cast, studios: extra?.studios, keywords: extra?.keywords, originalLanguage: extra?.originalLanguage, episodeRuntime: episodeRuntime || undefined, addedAt: new Date().toISOString() } }); showToast('Dizi eklendi'); return true;
  }, [data.series, data.removedSeriesTitles, showToast]);

  const watchEpisode = useCallback((seriesId: string, episodeId: string, rating: number, note: string, detailedRating?: Record<string, number>, reviewTags?: string[]) => {
    const series = data.series.find((s) => s.id === seriesId); if (!series) return; const ep = series.episodes.find((e) => e.id === episodeId); if (!ep) return;
    const now = new Date().toISOString();
    const episodeRuntime = ep.runtime || series.episodeRuntime || undefined;
    
    const isSpoiler = note.toLowerCase().includes('[spoiler]') || note.toLowerCase().includes('#spoiler');

    dispatch({ type: 'WATCH_EPISODE', seriesId, episodeId, rating, detailedRating, reviewTags, note, watchedAt: now, historyItem: { id: uid(), itemId: ep.id, seriesId: series.id, kind: 'series', type: 'series', title: series.title, rating, detailedRating, reviewTags, note, watchedAt: now, genres: series.genres, season: ep.season, episode: ep.episode, originalRuntime: episodeRuntime, actualRuntime: episodeRuntime } });
    
    if (data.shareWatchedInFeed !== false) {
      const row = {
        id: uid(), agent_id: data.agentId, action_type: 'watched', item_id: ep.id, item_type: 'series',
        item_title: `${series.title} (S${ep.season} B${ep.episode})`, item_poster: series.posterUrl || null,
        rating: rating, note: note || '', genres: series.genres, review_tags: reviewTags || [], is_spoiler: isSpoiler, created_at: now
      };
      withRetry(() => supabase.from('network_logs').insert([row]).then(({ error }: { error: any }) => { if (error) throw error; }))
        .catch(() => { enqueueLogOp({ id: row.id, kind: 'insert', row, createdAt: Date.now() }); });
    }

    setTimeout(() => {
      const updatedSeries = dataRef.current.series?.find((s: any) => s.id === seriesId);
      if (updatedSeries) { if (updatedSeries.episodes.filter((e: any) => e.season === ep.season).every((e: any) => e.watched)) requestSeasonComplete({ seriesTitle: updatedSeries.title, season: ep.season });
      if (updatedSeries.episodes.every((e: any) => e.watched)) { dispatch({ type: 'COMPLETE_SERIES', id: seriesId, title: updatedSeries.title }); showToast(`${updatedSeries.title} tamamlandı!`, 'success'); } }
    }, 200);
    // PREMIUM RİTÜEL: puanlama arp sesi (stereo, kısa)
    import('../lib/sound').then(({ playRatingArpSound }) => playRatingArpSound());
  }, [data.series, data.agentId, data.shareWatchedInFeed, showToast]);

  const deleteMovie = useCallback((id: string) => dispatch({ type: 'DELETE_MOVIE', id }), []);
  const unwatchMovie = useCallback((id: string) => dispatch({ type: 'UNWATCH_MOVIE', id }), []);
  const deleteSeries = useCallback((id: string) => dispatch({ type: 'DELETE_SERIES', id }), []);
  const addEpisodes = useCallback((sId: string, s: number, ec: number, silent = false, runtime?: number) => { const series = data.series.find((x) => x.id === sId); if (!series) return; const epRuntime = runtime || series.episodeRuntime || undefined; const startEp = series.episodes.filter((e) => e.season === s).length > 0 ? Math.max(...series.episodes.filter((e) => e.season === s).map((e) => e.episode)) + 1 : 1; dispatch({ type: 'ADD_EPISODES', seriesId: sId, episodes: Array.from({ length: ec }, (_, i) => ({ id: uid(), season: s, episode: startEp + i, watched: false, rating: null, note: '', watchedAt: null, runtime: epRuntime })) }); if (!silent) showToast(`${ec} bölüm eklendi`); }, [data.series, showToast]);
  const canWatchEpisode = useCallback((sId: string, eId: string): boolean => { const series = data.series.find((s) => s.id === sId); if (!series) return false; const ep = series.episodes.find((e) => e.id === eId); if (!ep || ep.watched) return false; return [...series.episodes].sort((a, b) => a.season - b.season || a.episode - b.episode).find((e) => !e.watched)?.id === eId; }, [data.series]);
  const unwatchEpisode = useCallback((sId: string, eId: string) => dispatch({ type: 'UNWATCH_EPISODE', seriesId: sId, episodeId: eId }), []);
  const deleteEpisode = useCallback((sId: string, eId: string) => dispatch({ type: 'DELETE_EPISODE', seriesId: sId, episodeId: eId }), []);
  const restoreEpisodes = useCallback((sId: string, episodes: Episode[]) => { if (!episodes.length) return; dispatch({ type: 'RESTORE_EPISODES', seriesId: sId, episodes }); }, []);
  const addGenre = useCallback((g: string) => { if (!data.genres.some((x) => normalize(x) === normalize(g))) { dispatch({ type: 'ADD_GENRE', genre: g.trim() }); showToast('Tür eklendi'); } }, [data.genres, showToast]);
  const deleteGenre = useCallback((g: string) => dispatch({ type: 'DELETE_GENRE', genre: g }), []);
  const renameGenre = useCallback((o: string, n: string) => { if (n.trim()) { dispatch({ type: 'RENAME_GENRE', oldName: o, newName: n.trim() }); showToast('Tür güncellendi'); } }, [showToast]);
  const addReviewTag = useCallback((tag: string, sentiment?: 'positive' | 'negative') => { const clean = tag.trim(); if (!clean) return; if ((data.reviewTags || []).some((x) => normalize(x) === normalize(clean))) { showToast('Bu başlık zaten mevcut!', 'warning'); return; } dispatch({ type: 'ADD_REVIEW_TAG', tag: clean, sentiment }); showToast('Değerlendirme başlığı eklendi'); }, [data.reviewTags, showToast]);
  const deleteReviewTag = useCallback((tag: string) => { dispatch({ type: 'DELETE_REVIEW_TAG', tag }); showToast('Başlık silindi'); }, [showToast]);
  const renameReviewTag = useCallback((oldTag: string, newTag: string, sentiment?: 'positive' | 'negative') => { if (newTag.trim()) { dispatch({ type: 'RENAME_REVIEW_TAG', oldTag, newTag: newTag.trim(), sentiment }); showToast('Başlık güncellendi'); } }, [showToast]);
  const setTagSentiment = useCallback((tag: string, sentiment: 'positive' | 'negative') => { dispatch({ type: 'SET_TAG_SENTIMENT', tag, sentiment }); }, []);
  const editMovie = useCallback((i: string, t: string, y: string, g: string[], r?: number, p?: string | null, o?: string, tmdbId?: number, silent = false, customUrl?: string, imdbId?: string, watchProviders?: WatchProvider[], extra?: MovieExtraData) => { dispatch({ type: 'EDIT_MOVIE', id: i, title: t, year: y, genres: g, runtime: r, posterUrl: p || undefined, overview: o || undefined, tmdbId, customUrl, imdbId, watchProviders, extra }); if (!silent) showToast('Film güncellendi'); }, [showToast]);
  const editSeries = useCallback((i: string, t: string, g: string[], p?: string | null, o?: string, tmdbId?: number, y?: string, silent = false, customUrl?: string, imdbId?: string, watchProviders?: WatchProvider[], extra?: SeriesExtraData) => { dispatch({ type: 'EDIT_SERIES', id: i, title: t, genres: g, posterUrl: p || undefined, overview: o || undefined, tmdbId, year: y, customUrl, imdbId, watchProviders, extra }); if (!silent) showToast('Dizi güncellendi'); }, [showToast]);
  const addCollection = useCallback((n: string) => { const clean = n.trim(); const existing = data.collections.find((c) => normalize(c.name) === normalize(clean)); if (existing) return existing.id; const id = uid(); dispatch({ type: 'ADD_COLLECTION', collection: { id, name: clean } }); showToast('Koleksiyon eklendi'); return id; }, [data.collections, showToast]);
  const deleteCollection = useCallback((id: string) => dispatch({ type: 'DELETE_COLLECTION', id }), []);
  const renameCollection = useCallback((i: string, n: string) => { dispatch({ type: 'RENAME_COLLECTION', id: i, name: n.trim() }); showToast('Koleksiyon güncellendi'); }, [showToast]);
  const setMovieCollection = useCallback((i: string, c: string | null) => dispatch({ type: 'SET_MOVIE_COLLECTION', id: i, collectionId: c }), []);
  const setMoviePastQueue = useCallback((i: string, inPastQueue: boolean) => dispatch({ type: 'SET_MOVIE_PAST_QUEUE', id: i, inPastQueue }), []);
  const setSeriesPastQueue = useCallback((i: string, inPastQueue: boolean) => dispatch({ type: 'SET_SERIES_PAST_QUEUE', id: i, inPastQueue }), []);
  const rateSeriesBulk = useCallback((seriesId: string, scope: 'series' | 'season', rating: number, note: string, season?: number, isPastWatch?: boolean, detailedRating?: Record<string, number>, reviewTags?: string[]) => {
    const series = data.series.find((s) => s.id === seriesId);
    if (!series) return;
    const now = new Date().toISOString();
    const finalIsPastWatch = isPastWatch ?? Boolean(series.isPastWatch || series.inPastQueue);
    const targetEpisodes = scope === 'season' && season !== undefined
      ? series.episodes.filter((e) => e.season === season)
      : series.episodes;
    const fallbackRuntime = series.episodeRuntime || 42;
    const totalRuntime = targetEpisodes.length > 0
      ? targetEpisodes.reduce((sum, ep) => sum + (ep.runtime && ep.runtime > 0 ? ep.runtime : fallbackRuntime), 0)
      : fallbackRuntime;
    const bulkRuntimeMinutes = Math.max(1, Math.round(totalRuntime * 0.25));
    const historyItem: WatchHistoryItem = {
      id: uid(),
      itemId: series.id,
      seriesId: series.id,
      kind: 'series',
      type: 'series',
      title: series.title,
      rating,
      detailedRating,
      reviewTags,
      note,
      watchedAt: now,
      isPastWatch: finalIsPastWatch,
      genres: series.genres,
      year: series.year,
      ...(scope === 'season' && season !== undefined ? { season } : {}),
      ratingScope: scope,
      bulkRating: true,
      bulkRuntimeMinutes,
    };
    dispatch({
      type: 'RATE_SERIES_BULK',
      seriesId,
      scope,
      season,
      rating,
      detailedRating,
      reviewTags,
      note,
      watchedAt: now,
      isPastWatch: finalIsPastWatch,
      historyItems: [historyItem],
      bulkRuntimeMinutes,
    });
  }, [data.series]);
  const clearSeriesRatings = useCallback((seriesId: string, scope: 'all' | 'series' | 'season', season?: number) => {
    dispatch({ type: 'CLEAR_SERIES_RATINGS', seriesId, scope, season });
  }, []);
  const clearSeriesEpisodeRatings = useCallback((seriesId: string, seasons?: number[]) => {
    dispatch({ type: 'CLEAR_SERIES_EPISODE_RATINGS', seriesId, seasons });
  }, []);
  const updateAIHistory = useCallback((messages: AIMessage[]) => dispatch({ type: 'UPDATE_AI_HISTORY', messages }), []);
  const addCriterion = useCallback((c: RatingCriterion) => { dispatch({ type: 'ADD_CRITERION', criterion: c }); showToast('Kriter Eklendi'); }, [showToast]);
  const editCriterion = useCallback((id: string, c: RatingCriterion) => { dispatch({ type: 'EDIT_CRITERION', id, criterion: c }); showToast('Kriter Güncellendi'); }, [showToast]);
  const deleteCriterion = useCallback((id: string) => { dispatch({ type: 'DELETE_CRITERION', id }); showToast('Kriter Silindi'); }, [showToast]);
  const updateAltWatchTemplate = useCallback((template: string) => { dispatch({ type: 'UPDATE_ALT_TEMPLATE', template }); showToast('Alternatif izleme şablonu güncellendi', 'success'); }, [showToast]);
  const updateTheme = useCallback((theme: string) => { dispatch({ type: 'SET_THEME', theme }); showToast('Tema değiştirildi', 'success'); }, [showToast]);
  const exportData = useCallback(() => {
    const payload = buildBackupPayload(data, readQuestState(), readBackupExtras());
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sinevia-yedek-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Tam yedek alındı (görevler ve ayarlar dahil)', 'success');
  }, [data, showToast]);
  const importData = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json);
      const { core, quests, extras } = parseBackupPayload(parsed);
      if (!core || typeof core !== 'object' || Array.isArray(core)) throw new Error('Geçersiz yedek');
      const restoredQuests = quests != null ? writeQuestState(quests) : false;
      applyBackupExtras(extras);
      try {
        localStorage.removeItem('sinevia_zero_reset');
        localStorage.removeItem('sinevia_restore_prev');
      } catch { /* kota */ }
      dispatch({ type: 'IMPORT_DATA', data: { ...defaultData(), ...core } });
      if (quests == null) {
        showToast('Veriler geri yüklendi; yedekte görev verisi yok (mevcut görevler korundu).', 'warning');
      } else if (!restoredQuests) {
        showToast('Veriler geri yüklendi ancak görevler yazılamadı.', 'warning');
      } else {
        showToast('Tam yedek geri yüklendi (görevler dahil).', 'success');
      }
      return true;
    } catch {
      showToast('Yedek dosyası okunamadı', 'error');
      return false;
    }
  }, [showToast]);
  const resetData = useCallback(() => { dispatch({ type: 'IMPORT_DATA', data: defaultData() }); showToast('Sıfırlandı'); }, [showToast]);
  const exportShareList = useCallback(() => {
    const sharePayload = { isShareList: true, exportedAt: new Date().toISOString(), collections: data.collections.map((c) => ({ id: c.id, name: c.name })), movies: data.movies.map((m) => ({ title: m.title, year: m.year, genres: m.genres, collectionId: m.collectionId, runtime: m.runtime, posterUrl: m.posterUrl, overview: m.overview, tmdbId: m.tmdbId, imdbId: m.imdbId, watchProviders: m.watchProviders, directors: m.directors, cast: m.cast, studios: m.studios, keywords: m.keywords, originalLanguage: m.originalLanguage, customUrl: m.customUrl })), series: data.series.map((s) => ({ title: s.title, year: s.year, genres: s.genres, posterUrl: s.posterUrl, overview: s.overview, tmdbId: s.tmdbId, imdbId: s.imdbId, watchProviders: s.watchProviders, creators: s.creators, cast: s.cast, studios: s.studios, keywords: s.keywords, originalLanguage: s.originalLanguage, customUrl: s.customUrl, episodes: (s.episodes || []).map((e) => ({ season: e.season, episode: e.episode })) })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(sharePayload, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `sinevia-liste-paylasimi-${todayStr()}.json`; a.click(); URL.revokeObjectURL(url); showToast('Paylaşım listesi indirildi!', 'success');
  }, [data.collections, data.movies, data.series, showToast]);
  const importShareList = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json); const incMovies: any[] = Array.isArray(parsed.movies) ? parsed.movies : []; const incSeries: any[] = Array.isArray(parsed.series) ? parsed.series : []; const incCols: any[] = Array.isArray(parsed.collections) ? parsed.collections : [];
      const colIdMap = new Map<string, string>(); const newCollections: Collection[] = []; const tempCols = [...data.collections];
      incCols.forEach((ic) => { if (!ic || !ic.name) return; const ex = tempCols.find((c) => normalize(c.name) === normalize(ic.name)); if (ex) colIdMap.set(ic.id, ex.id); else { const nid = uid(), nc = { id: nid, name: ic.name.trim() }; newCollections.push(nc); tempCols.push(nc); colIdMap.set(ic.id, nid); } });
      let tempGenres = [...data.genres]; const newMovies: Movie[] = []; const existingMovieTitles = new Set(data.movies.map((m) => normalize(m.title)));
      incMovies.forEach((im) => { if (!im || !im.title) return; const normTitle = normalize(im.title); if (existingMovieTitles.has(normTitle)) return; existingMovieTitles.add(normTitle); const resolvedGenres = resolveTMDBGenres(Array.isArray(im.genres) ? im.genres : [], tempGenres); tempGenres = addNewGenres(tempGenres, resolvedGenres); newMovies.push({ id: uid(), title: im.title.trim(), year: im.year ? String(im.year).trim() : '', genres: resolvedGenres, collectionId: im.collectionId && colIdMap.has(im.collectionId) ? colIdMap.get(im.collectionId)! : null, runtime: im.runtime, posterUrl: im.posterUrl || undefined, overview: im.overview || undefined, tmdbId: im.tmdbId, imdbId: im.imdbId, watchProviders: im.watchProviders, directors: im.directors, cast: im.cast, studios: im.studios, keywords: im.keywords, originalLanguage: im.originalLanguage, customUrl: im.customUrl, watched: false, isPastWatch: false, rating: null, note: '', watchedAt: null, startedAt: null, actualRuntime: null, addedAt: new Date().toISOString() }); });
      const newSeries: Series[] = []; const existingSeriesTitles = new Set([...data.series.map((s) => normalize(s.title)), ...data.removedSeriesTitles.map((t) => normalize(t))]);
      incSeries.forEach((is) => { if (!is || !is.title) return; const normTitle = normalize(is.title); if (existingSeriesTitles.has(normTitle)) return; existingSeriesTitles.add(normTitle); const resolvedGenres = resolveTMDBGenres(Array.isArray(is.genres) ? is.genres : [], tempGenres); tempGenres = addNewGenres(tempGenres, resolvedGenres); const episodes: Episode[] = Array.isArray(is.episodes) ? is.episodes.map((ep: any) => ({ id: uid(), season: Number(ep.season) || 1, episode: Number(ep.episode) || 1, watched: false, rating: null, note: '', watchedAt: null })) : []; newSeries.push({ id: uid(), title: is.title.trim(), year: is.year ? String(is.year).trim() : undefined, genres: resolvedGenres, episodes, posterUrl: is.posterUrl || undefined, overview: is.overview || undefined, tmdbId: is.tmdbId, imdbId: is.imdbId, watchProviders: is.watchProviders, creators: is.creators, cast: is.cast, studios: is.studios, keywords: is.keywords, originalLanguage: is.originalLanguage, customUrl: is.customUrl, addedAt: new Date().toISOString() }); });
      if (newMovies.length === 0 && newSeries.length === 0 && newCollections.length === 0) { showToast('Listendeki tüm film ve diziler zaten mevcut!', 'info'); return true; }
      dispatch({ type: 'MERGE_SHARED_LIST', movies: newMovies, series: newSeries, collections: newCollections, genres: tempGenres }); showToast(`${newMovies.length} yeni film ve ${newSeries.length} yeni dizi eklendi!`, 'success'); return true;
    } catch { showToast('Geçersiz paylaşım dosyası!', 'error'); return false; }
  }, [data.collections, data.genres, data.movies, data.removedSeriesTitles, data.series, showToast]);
  const dismissLevelUp = useCallback(() => { levelUpSoundStartedRef.current = false; setLevelUpData(null); dispatch({ type: 'PROMOTE_LEVEL_UP' }); }, []); const dismissSeasonComplete = useCallback(() => setSeasonCompleteData(null), []);
  const requestContractCelebration = useCallback((payload: { contractId: string; xp: number; coins: number; rarity: ContractRarity }) => {
    contractQueuedRef.current = payload;
    contractCelebratingRef.current = true;
    setIsContractCelebrating(true);
    setContractTick((tick) => tick + 1);
  }, [setIsContractCelebrating]);
  const dismissContractCelebration = useCallback(() => {
    contractOpenRef.current = false;
    setContractCelebrationData(null);
    if (contractQueuedRef.current) {
      setContractTick((tick) => tick + 1);
      return;
    }
    contractCelebratingRef.current = false;
    setIsContractCelebrating(false);
    setContractTick((tick) => tick + 1);
  }, [setIsContractCelebrating]); const grantXp = useCallback((xp: number, source: XpEventSource = 'system', sourceId?: string, label?: string, base?: number, multiplier?: number) => {
    dispatch({ type: 'GRANT_XP', xp, source, sourceId, label, base, multiplier });
  }, []);
  const grantCoins = useCallback((amount: number, kind: CoinTx['kind'], label: string, refId: string, itemId?: string) => {
    if (amount <= 0) return;
    // Ses ve bildirim CoinGainOverlay açılınca tetiklenir (sıranın SON halkası).
    // Burada erken ses çalmak pazar görevi/görev kutlamasını 6.2s geciktiriyordu.
    dispatch({ type: 'GRANT_COINS', amount, kind, label, refId, itemId });
  }, []);
  const grantContractReward = useCallback((xp: number, coins: number, refId: string, label: string, opts?: { base?: number; multiplier?: number; sourceId?: string }) => {
    // Kutlama sesi ContractCelebrationOverlay açıldığında çalar; coin sesi ise
    // en sonda CoinGainOverlay ile gelir. Burada ses çalmak sırayı bozuyordu.
    dispatch({ type: 'GRANT_CONTRACT_REWARD', xp, coins, refId, label, ...opts });
  }, []);
  const purchaseItem = useCallback((itemId: string, name: string, price: number, kind: string, consumable?: boolean, coupon?: boolean) => {
    dispatch({ type: 'PURCHASE_ITEM', itemId, name, price, kind, consumable, coupon });
    showToast(`${name} satın alındı`, 'success');
  }, [showToast]);
  const equipItem = useCallback((slot: 'frameId' | 'titleId' | 'badgeId' | 'badgeId2' | 'backgroundId' | 'nameEffectId', itemId: string | null) => {
    dispatch({ type: 'EQUIP_ITEM', slot, itemId });
  }, []);
  const activateItem = useCallback((itemId: string, effect: string, label: string) => {
    dispatch({ type: 'USE_ITEM', itemId, effect, label });
    showToast(label, 'success');
  }, [showToast]);
  const pinContract = useCallback((contractId: string, week: string) => {
    dispatch({ type: 'PIN_CONTRACT', contractId, week });
    showToast('Görev gelecek hafta için sabitlendi', 'success');
  }, [showToast]);
  const consumeEffect = useCallback((itemId: string) => {
    dispatch({ type: 'CONSUME_EFFECT', itemId });
  }, []);
  const setSeriesRuntime = useCallback((seriesId: string, episodeRuntime?: number, runtimes?: Record<string, number>) => {
    dispatch({ type: 'SET_SERIES_RUNTIME', seriesId, episodeRuntime, runtimes });
  }, []);
  const markMarketIntroSeen = useCallback(() => dispatch({ type: 'MARK_MARKET_INTRO_SEEN' }), []);
  const rerollMarket = useCallback(() => dispatch({ type: 'REROLL_MARKET' }), []);
  const grantItem = useCallback((itemId: string, label: string, refId: string) => {
    dispatch({ type: 'GRANT_ITEM', itemId, label, refId });
    showToast(`Envantere eklendi: ${label}`, 'success');
  }, [showToast]);
  const recordMarketOutcome = useCallback((outcome: 'failed' | 'cancelled', weekly: boolean, penalty: number, label: string, refId: string) => {
    dispatch({ type: 'RECORD_MARKET_OUTCOME', outcome, weekly, penalty, label, refId });
  }, []);
  const findPlanConflict = useCallback((date: string, time: string, runtime: number | undefined, excludeId?: string) => { return (data.weeklyPlan || []).find((p) => { if (p.id === excludeId) return false; const refMovie = data.movies.find((m) => m.id === p.movieId); if (refMovie?.watched) return false; return planItemsOverlap(date, time, runtime, p.date, p.time, p.runtime); }); }, [data.weeklyPlan, data.movies]);
  const addPlanItem = useCallback((movie: Movie, date: string, time: string): boolean => { const conflict = findPlanConflict(date, time, movie.runtime); if (conflict) { showToast(`⛔ Bu saat aralığında zaten "${conflict.title}" planlanmış!`, 'warning'); return false; } dispatch({ type: 'ADD_PLAN_ITEM', item: { id: uid(), movieId: movie.id, title: movie.title, year: movie.year, posterUrl: movie.posterUrl, genres: movie.genres, runtime: movie.runtime, date, time, createdAt: new Date().toISOString() } }); showToast(`"${movie.title}" plana eklendi`, 'success'); return true; }, [findPlanConflict, showToast]);
  const deletePlanItem = useCallback((id: string) => { dispatch({ type: 'DELETE_PLAN_ITEM', id }); showToast('Plan silindi', 'info'); }, [showToast]);
  const updatePlanItem = useCallback((id: string, date: string, time: string): boolean => { const item = (data.weeklyPlan || []).find((p) => p.id === id); const conflict = findPlanConflict(date, time, item?.runtime, id); if (conflict) { showToast(`⛔ Çakışma var: "${conflict.title}"`, 'warning'); return false; } dispatch({ type: 'UPDATE_PLAN_ITEM', id, date, time }); showToast('Plan güncellendi', 'success'); return true; }, [data.weeklyPlan, findPlanConflict, showToast]);

  const forceXpSync = useCallback(() => {
    dispatch({ type: 'FORCE_XP_SYNC' });
    showToast('Tüm istatistikler ve başarımlar güncel değerlerle senkronize edildi.', 'info');
  }, [showToast]);

  // Tutorial ilerlemesi değişince gizli başarımı yeniden değerlendir
  const syncAchievements = useCallback(() => {
    dispatch({ type: 'SYNC_ACHIEVEMENTS' });
  }, []);

  /**
   * "Bu cihazı buluta yükle": kullanıcı seçimi otoritedir.
   * Karar matrisi atlanır; yerel kayıt güncel sunucu revizyonunun üstüne yazılır.
   */
  const forceCloudUpload = useCallback(() => {
    const agentId = dataRef.current.agentId;
    if (!agentId) {
      showToast('Bulut hesabı bulunamadı; yükleme yapılamadı.', 'error');
      return;
    }
    // Yanlış hesabın bulut kaydını ezmemek için sahip uyuşmazlığında AÇIK onay şart.
    const localOwner = lastV3Ref.current?.ownerAgentId ?? null;
    if (needsOwnerUploadConfirmation(localOwner, agentId)) {
      const confirmed = window.confirm(
        `Bu cihazdaki kayıt "${localOwner}" hesabına ait, oturum açık hesap ise "${agentId}". `
        + 'Yüklerseniz bu cihazdaki veriler oturumdaki hesabın bulut kaydının üzerine yazılacak. '
        + 'Devam edilsin mi?',
      );
      if (!confirmed) {
        showToast('Yükleme iptal edildi; hiçbir bulut kaydı değiştirilmedi.', 'info');
        return;
      }
    }
    hydrationTrustedRef.current = true;
    syncDeferredRef.current = false;
    syncApprovalPendingRef.current = false;
    setSyncStatus('syncing');
    void (async () => {
      try {
        const result = await syncEngine.pushLocal(agentId);
        handleSyncResult(result, true);
      } catch {
        setSyncStatus('error');
        showToast('Bu cihazdaki veriler yüklenemedi; veriler korunuyor.', 'error');
      }
    })();
  }, [showToast, syncEngine]);

  /**
   * "Bulutu bu cihaza indir": `sync_get_state` sonucu BİREBİR uygulanır.
   * Yerel kütüphane buluttakiyle değiştirilir; yankı yüklemesi yapılmaz.
   */
  const forceCloudDownload = useCallback(async () => {
    const agentId = dataRef.current.agentId;
    if (!agentId) {
      showToast('Bulut hesabı bulunamadı; indirme yapılamadı.', 'error');
      return;
    }
    syncDeferredRef.current = false;
    syncApprovalPendingRef.current = false;
    setSyncStatus('syncing');
    try {
      const result = await syncEngine.pullRemote(agentId);
      handleSyncResult(result, true);
    } catch {
      setSyncStatus('error');
      showToast('Bulut yedeği indirilemedi; bu cihazdaki veriler korundu.', 'error');
    }
  }, [showToast, syncEngine]);

  // State Slicing — yoğun sayfaların re-render izolasyonu için memo'lu dilimler (opt-in).
  const librarySlice = useMemo<LibrarySlice>(() => ({
    movies: data.movies, series: data.series, collections: data.collections,
    history: data.history, genres: data.genres,
  }), [data.movies, data.series, data.collections, data.history, data.genres]);

  const gamificationSlice = useMemo<GamificationSlice>(() => ({
    xp: data.xp, level: data.level, totalXp: data.totalXp, dailyStreak: data.dailyStreak,
    achievements: data.achievements, showcase: data.showcase,
  }), [data.xp, data.level, data.totalXp, data.dailyStreak, data.achievements, data.showcase]);

  const settingsSlice = useMemo<SettingsSlice>(() => ({
    theme: data.theme || 'premium-dark', criteria: data.criteria, reviewTags: data.reviewTags,
    weeklyPlan: data.weeklyPlan || [], notificationsEnabled: !!data.notificationsEnabled,
    shareWatchedInFeed: data.shareWatchedInFeed !== false, sharePastWatchedInFeed: data.sharePastWatchedInFeed !== false,
    showLockedNames: !!data.showLockedNames, showBadgeDetails: !!data.showBadgeDetails,
    reducedMotion: !!data.reducedMotion, fastCelebrations: !!data.fastCelebrations,
    altWatchTemplate: data.altWatchTemplate || '',
    externalActions: data.externalActions || [],
    agentId: data.agentId || '',
  }), [data.theme, data.criteria, data.reviewTags, data.weeklyPlan, data.notificationsEnabled, data.shareWatchedInFeed, data.sharePastWatchedInFeed, data.showLockedNames, data.showBadgeDetails, data.reducedMotion, data.fastCelebrations, data.altWatchTemplate, data.externalActions, data.agentId]);

  // Global tik YOK — sadece aktif timer filmini verir (seyrek değişir); sayfalar kendi
  // yerel nowMs tik'lerini tutmaya devam eder (HomePage dahil — kullanıcıya ait dosya).
  const timerSlice = useMemo<TimerSlice>(() => ({
    activeTimerMovie: data.movies.find((m) => !m.watched && m.startedAt) || null,
  }), [data.movies]);

  // Context değeri (tek kaynak) — useApp() bunu kullanır; ActionsContext bunun aksiyon
  // alt kümesini türetir (transient state değişince aksiyon referansı değişmez → izolasyon).
  const value: AppContextValue = {
    data, syncStatus, cloudConflict, resolveCloudConflict, isQuestCelebrating, setIsQuestCelebrating, setNickname, recoverIdentity, adoptNetworkIdentity, updateShowcase, addMovie, deleteMovie, startWatchingMovie, togglePauseWatchingMovie, cancelWatchingMovie, canRateMovieWithTimer, watchMovie, unwatchMovie, updateHistoryRating, addSeries, deleteSeries, addEpisodes, restoreEpisodes, watchEpisode, canWatchEpisode, unwatchEpisode, deleteEpisode, addGenre, deleteGenre, renameGenre, addReviewTag, deleteReviewTag, renameReviewTag, setTagSentiment, editMovie, editSeries, addCollection, deleteCollection, renameCollection, setMovieCollection, setMoviePastQueue, setSeriesPastQueue, rateSeriesBulk, clearSeriesRatings, clearSeriesEpisodeRatings, exportData, importData, resetData, exportShareList, importShareList, toasts, showToast, achievementToasts, levelUpData, seasonCompleteData, dismissLevelUp, dismissSeasonComplete, isContractCelebrating, contractCelebrationData, requestContractCelebration, dismissContractCelebration, setContractCompletionPending, toggleLockedNames, toggleBadgeDetails, toggleReducedMotion, toggleFastCelebrations, xpGainData, coinGainData, queuedCoinGain, levelUpQueuedRef, contractCelebratingRef, contractQueuedRef, questCelebratingRef, questQueuedRef, levelUpOpenRef, seasonOpenRef, seasonQueuedRef, xpGainOpenRef, updateAIHistory, addCriterion, editCriterion, deleteCriterion, updateAltWatchTemplate, updateTheme, weeklyPlan: data.weeklyPlan || [], addPlanItem, deletePlanItem, updatePlanItem, grantXp, grantCoins, grantContractReward, purchaseItem, equipItem, activateItem, pinContract, consumeEffect, setSeriesRuntime, markMarketIntroSeen, rerollMarket, grantItem, recordMarketOutcome, toggleNotifications, toggleShareWatched, toggleSharePastWatched, toggleSpecificNotification, forceXpSync, syncAchievements, forceCloudUpload, forceCloudDownload, abandonMedia, reviveMedia, resolveDuel, applyCalibrationSuggestion, setExternalActions
  };

  // Aksiyon bağımlılıkları (state hariç 59 ref) — sadece bunlar değişince actionsValue yenilenir.
  const actionDeps = [
    setIsQuestCelebrating, setNickname, recoverIdentity, updateShowcase,
    addMovie, deleteMovie, startWatchingMovie, togglePauseWatchingMovie, cancelWatchingMovie, canRateMovieWithTimer,
    watchMovie, unwatchMovie, updateHistoryRating, addSeries, deleteSeries, addEpisodes, restoreEpisodes,
    watchEpisode, canWatchEpisode, unwatchEpisode, deleteEpisode,
    addGenre, deleteGenre, renameGenre, addReviewTag, deleteReviewTag, renameReviewTag, setTagSentiment,
    editMovie, editSeries, addCollection, deleteCollection, renameCollection, setMovieCollection, setMoviePastQueue,
    setSeriesPastQueue, rateSeriesBulk, clearSeriesRatings, clearSeriesEpisodeRatings,
    exportData, importData, resetData, exportShareList, importShareList,
    showToast, dismissLevelUp, dismissSeasonComplete, isContractCelebrating, contractCelebrationData, requestContractCelebration, dismissContractCelebration, toggleLockedNames, toggleBadgeDetails, toggleReducedMotion, toggleFastCelebrations, updateAIHistory,
    addCriterion, editCriterion, deleteCriterion, updateAltWatchTemplate, updateTheme,
    addPlanItem, deletePlanItem, updatePlanItem, grantXp, grantCoins, grantContractReward, purchaseItem,
    equipItem, activateItem, pinContract, consumeEffect, setSeriesRuntime, markMarketIntroSeen, rerollMarket, grantItem, recordMarketOutcome,
    toggleNotifications, toggleShareWatched, toggleSharePastWatched, toggleSpecificNotification,
    forceXpSync, syncAchievements, forceCloudUpload, forceCloudDownload,
    abandonMedia, reviveMedia, resolveDuel, applyCalibrationSuggestion, setExternalActions,
  ];
  const actionsValue = useMemo<ActionsSlice>(() => {
    const { data: _d, syncStatus: _ss, isQuestCelebrating: _iqc, toasts: _t, achievementToasts: _at, levelUpData: _lud, seasonCompleteData: _scd, xpGainData: _xgd, coinGainData: _cgd, weeklyPlan: _wp, ...rest } = value;
    return rest;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sadece aksiyon ref'leri; state değişimi cache'i bozmaz
  }, actionDeps);

  return (
    <LibraryContext.Provider value={librarySlice}>
      <GamificationContext.Provider value={gamificationSlice}>
        <SettingsContext.Provider value={settingsSlice}>
          <TimerContext.Provider value={timerSlice}>
            <ActionsContext.Provider value={actionsValue}>
              <AppContext.Provider value={value}>
                {children}
              </AppContext.Provider>
            </ActionsContext.Provider>
          </TimerContext.Provider>
        </SettingsContext.Provider>
      </GamificationContext.Provider>
    </LibraryContext.Provider>
  );
}

function updateStreak(data: ExtendedAppData): number {
  const today = todayStr();
  if (data.dailyStreakDate === today) return data.dailyStreak;
  if (data.dailyStreakDate) {
    if (daysBetween(data.dailyStreakDate, today) === 1) return data.dailyStreak + 1;
    if (daysBetween(data.dailyStreakDate, today) > 1) return 1;
  }
  return 1;
}

/**
 * Seri Kalkanı: bir günlük kaçırma durumunda seriyi sıfırlamak yerine
 * kalkan hakkını harcayıp seriyi korur. Kalkan yoksa normal davranış.
 */
function applyStreakForWatch(data: ExtendedAppData): { dailyStreak: number; activeEffects?: ExtendedAppData['activeEffects'] } {
  const today = todayStr();
  const gap = data.dailyStreakDate ? daysBetween(data.dailyStreakDate, today) : 0;
  if (gap > 1 && activeEffectCharges(data, 'util_streak_shield') > 0) {
    const shielded = consumeEffectCharge(data, 'util_streak_shield');
    return { dailyStreak: data.dailyStreak + 1, activeEffects: shielded.activeEffects };
  }
  if (gap > 1) {
    const freeze = (data.activeEffects || []).find(
      (effect) =>
        effect.itemId === 'util_streak_freeze' &&
        (effect.charges ?? 1) > 0 &&
        (!effect.expiresAt || new Date(effect.expiresAt).getTime() > Date.now()),
    );
    if (freeze) {
      const frozen = consumeEffectCharge(data, 'util_streak_freeze');
      return { dailyStreak: data.dailyStreak + 1, activeEffects: frozen.activeEffects };
    }
  }
  return { dailyStreak: updateStreak(data) };
}