/**
 * localStateV3 — V2 → V3 durum göçü ve boot anlık görüntüsü (SAF, React YOK).
 *
 * Bu modül bilinçli olarak yan etkisizdir: localStorage/IndexedDB/ağ/React
 * kullanmaz, `Date.now()`/`Math.random()` çağırmaz. `updatedAt` gibi değerler
 * çağırandan gelir. Böylece aynı girdi her zaman aynı çıktıyı üretir.
 *
 * Göç kuralları (tek doğru kaynak: `docs/sync-contract.md`):
 *  1. Tek kanonik yerel kayıt `AppStateV3`'tür (schemaVersion 3).
 *  2. V2'nin türetilmiş XP alanları (`totalXp`, `xp`, `level`, `bonusXp`,
 *     `xpBaseline`) V3 kaydında YOKTUR. Göçte tek seferlik `xpEvents`
 *     kayıtlarına çevrilir ve toplam korunur:
 *       - `legacy` (sourceId `migration-v3`) → toplamdan bonus/taban düşülmüş kısım
 *       - `adjustment` (sourceId `migration-v3-adjust`) → `bonusXp + xpBaseline`
 *     Böylece `sum(xpEvents.amount) === eski totalXp`.
 *  3. Eski `sinevia-quests-v1` durumu `quests` bloğuna taşınır.
 *  4. `extras` (tutorial / academyUi) ilgili bloklara; bilinmeyen her şey
 *     `legacy` torbasına konur — hiçbir veri sessizce kaybolmaz.
 */

import { levelFromXp } from './xp';
import { LEGACY_MIGRATION_ID, migrateLegacyXp, normalizeXpEvents, sumXpEvents } from './xpLedger';
import type {
  AcademyProgressV3,
  AppSettingsV3,
  AppStateV3,
  QuestStateV3,
  TutorialProgressV3,
  XpEvent,
} from '../types/appState';
import type {
  AchievementProgress,
  ActiveEffect,
  CoinTx,
  Collection,
  EquippedItems,
  ExternalActionTemplate,
  InventoryEntry,
  MarketStats,
  Movie,
  RatingCriterion,
  Series,
  WatchHistoryItem,
  WeeklyPlanItem,
} from '../types';

/* =========================================================================
   SABİTLER
   ========================================================================= */

/** Göç kayıtlarının idempotency anahtarı (aynı hesapta tek kez yazılır). */
export const LEGACY_XP_SOURCE_ID = LEGACY_MIGRATION_ID;
/** Düzeltme kaydı da aynı `migration-v3` anahtarını kullanır (tek seferlik). */
export const LEGACY_XP_ADJUSTMENT_SOURCE_ID = LEGACY_MIGRATION_ID;

/** V2 localStorage anahtarları (göç girdisi). */
export const LEGACY_QUEST_STORAGE_KEY = 'sinevia-quests-v1';
export const LEGACY_TUTORIAL_STORAGE_KEY = 'sinevia-tutorial-v1';
export const LEGACY_ACADEMY_STORAGE_KEY = 'sinevia-academy-ui-v1';

export const DEFAULT_THEME_V3 = 'premium-dark';
export const DEFAULT_NICKNAME_V3 = 'Yeni Üye';
export const DEFAULT_ALT_WATCH_TEMPLATE_V3 =
  'https://duckduckgo.com/?q=\\site:hdfilmcehennemi.nl+{title}+{year}+izle';

/**
 * V2 `defaultData()` ile aynı liste. React'e bağımlı olmamak için burada
 * tanımlıdır; AppContext'ten bağımsız kullanımda boş kütüphane oluşmasın.
 */
export const DEFAULT_GENRES_V3: string[] = [
  'Aksiyon', 'Macera', 'Komedi', 'Dram', 'Korku', 'Bilim Kurgu', 'Fantastik',
  'Romantik', 'Gerilim', 'Suç', 'Belgesel', 'Animasyon',
];

export const DEFAULT_CRITERIA_V3: RatingCriterion[] = [
  { id: 'crit_1', name: 'Senaryo ve Hikaye', weight: 10, appliesTo: 'both', genres: [] },
  { id: 'crit_2', name: 'Oyunculuk', weight: 8, appliesTo: 'both', genres: [] },
  { id: 'crit_3', name: 'Görsel Yönetim', weight: 7, appliesTo: 'both', genres: [] },
];

/** Boot anlık görüntüsünün sürümü (localStorage'daki küçük kayıt). */
export const BOOT_SNAPSHOT_VERSION = 3;

/** Boot anlık görüntüsünde taşınan güvenli/küçük alanlar. */
export interface BootSnapshotV3 {
  schemaVersion: 3;
  snapshotVersion: typeof BOOT_SNAPSHOT_VERSION;
  updatedAt: string;
  theme: string;
  agentId: string | null;
  nickname: string | null;
  level: number;
  totalXp: number;
  xp: number;
  dailyStreak: number;
  /** Yalnız sayısal özet — tam başarım listesi localStorage'a YAZILMAZ. */
  achievements: { total: number; unlocked: number };
  prefs: {
    notificationsEnabled?: boolean;
    shareWatchedInFeed?: boolean;
    sharePastWatchedInFeed?: boolean;
    notifyMessages?: boolean;
    notifyFriendRequests?: boolean;
    notifyLists?: boolean;
    showLockedNames?: boolean;
    showBadgeDetails?: boolean;
    reducedMotion?: boolean;
    fastCelebrations?: boolean;
  };
  lastCloudSync?: number;
}

/* =========================================================================
   KÜÇÜK YARDIMCILAR (tip güvenli, yan etkisiz)
   ========================================================================= */

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asNullableNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asRecord<T>(value: unknown): Record<string, T> | undefined {
  return isRecord(value) ? (value as Record<string, T>) : undefined;
}

function toIso(value: unknown): string {
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  return new Date(0).toISOString();
}

/* =========================================================================
   DOĞRULAMA
   ========================================================================= */

/**
 * Değer kanonik V3 kaydı mı? Şema sürümü 3 olmalı; kütüphane dizileri ve
 * XP defteri bulunmalıdır. V2 kayıtları (schemaVersion yok/2) reddedilir.
 */
export function isAppStateV3(value: unknown): value is AppStateV3 {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== 3) return false;
  if (!Array.isArray(value.movies) || !Array.isArray(value.series)) return false;
  if (!Array.isArray(value.xpEvents)) return false;
  return true;
}

/** localStorage'daki küçük boot anlık görüntüsü mü? */
export function isBootSnapshotV3(value: unknown): value is BootSnapshotV3 {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== 3) return false;
  if (value.snapshotVersion !== BOOT_SNAPSHOT_VERSION) return false;
  // Tam kayıt işareti varsa boot snapshot DEĞİLDİR (güvenlik kemeri).
  return !Array.isArray(value.movies) && !Array.isArray(value.series);
}

/** V2 (veya daha eski) tam uygulama kaydı mı — göç girdisi. */
export function isLegacyAppState(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  if (value.schemaVersion === 3) return false;
  return Array.isArray(value.movies) && Array.isArray(value.series);
}

/* =========================================================================
   BOŞ V3 KAYDI
   ========================================================================= */

export interface CreateEmptyAppStateInput {
  ownerAgentId?: string | null;
  deviceId?: string;
  /** ISO 8601. Verilmezse epoch (deterministik). */
  updatedAt?: string;
  revision?: number;
  nickname?: string;
  /** Testlerde/hesap taşımada hazır başarım listesi geçmek için. */
  achievements?: AchievementProgress[];
}

function emptyQuestState(): QuestStateV3 {
  return {
    activeQuestId: null,
    questAcceptedAt: null,
    questRejects: 0,
    questCooldownUntil: null,
    completedQuests: [],
    activeBadgeId: null,
    isPenaltyEnabled: false,
    activeContract: null,
    contractHistory: [],
  };
}

function emptyTutorial(): TutorialProgressV3 {
  return {
    welcomeDone: false,
    welcomeStep: 0,
    completed: [],
    pageVisited: [],
    modalSeen: [],
    academyStarted: false,
    academyStep: 0,
    academyDone: [],
    events: [],
    eventCounts: {},
  };
}

function emptyAcademy(): AcademyProgressV3 {
  return { started: false, step: 0, done: [] };
}

function emptySettings(nickname?: string): AppSettingsV3 {
  return {
    theme: DEFAULT_THEME_V3,
    nickname,
    notificationsEnabled: false,
    shareWatchedInFeed: true,
    sharePastWatchedInFeed: true,
    notifyMessages: true,
    notifyFriendRequests: true,
    notifyLists: true,
    showLockedNames: false,
    showBadgeDetails: false,
    reducedMotion: false,
    fastCelebrations: false,
    altWatchTemplate: DEFAULT_ALT_WATCH_TEMPLATE_V3,
    externalActions: [],
    reviewTags: [],
  };
}

/** Yeni, tamamen boş V3 kaydı üretir. XP defteri boştur → totalXp 0. */
export function createEmptyAppStateV3(input: CreateEmptyAppStateInput = {}): AppStateV3 {
  const updatedAt = input.updatedAt ?? new Date(0).toISOString();
  const nickname = input.nickname ?? DEFAULT_NICKNAME_V3;
  return {
    schemaVersion: 3,
    ownerAgentId: input.ownerAgentId ?? null,
    revision: Math.max(0, Math.floor(asNumber(input.revision, 0))),
    updatedAt,
    deviceId: input.deviceId ?? '',
    xpEvents: [],
    movies: [],
    series: [],
    collections: [],
    history: [],
    genres: [...DEFAULT_GENRES_V3],
    removedSeriesTitles: [],
    criteria: DEFAULT_CRITERIA_V3.map((criterion) => ({ ...criterion, genres: [...(criterion.genres || [])] })),
    showcase: [],
    achievements: input.achievements ? input.achievements.map((item) => ({ ...item })) : [],
    quests: emptyQuestState(),
    coins: 0,
    coinLedger: [],
    inventory: [],
    equipped: {},
    activeEffects: [],
    perks: [],
    marketStats: {
      purchases: 0,
      coinsSpent: 0,
      contractsCompleted: 0,
      contractsFailed: 0,
      weeklyContractsFailed: 0,
      contractsCancelled: 0,
    },
    pinnedContract: null,
    marketIntroSeen: false,
    marketRerollNonce: 0,
    marketDailyNonce: 0,
    marketWeeklyNonce: 0,
    dailyStreak: 0,
    dailyStreakDate: null,
    lastWatchDate: null,
    totalDuelsCompleted: 0,
    giantSlayerWins: 0,
    weeklyPlan: [],
    externalActions: [],
    tutorial: emptyTutorial(),
    academy: emptyAcademy(),
    settings: emptySettings(nickname),
    lastCloudSync: undefined,
    aiChatHistory: [],
  };
}

/* =========================================================================
   XP GÖÇÜ
   ========================================================================= */

/**
 * V2 türetilmiş XP alanlarını tek seferlik defter kayıtlarına çevirir.
 * Mantık Lumen'ın `xpLedger.migrateLegacyXp` fonksiyonundadır (tek doğru):
 *  - yerel toplam (`totalXp`, yoksa `bonusXp + xpBaseline`) → `legacy`
 *  - bulut toplamı daha büyükse fark → `legacy-cloud`
 *  - hedef toplam hâlâ tutmuyorsa fark → `adjustment`
 * Toplam KORUNUR: `sum(xpEvents.amount) === eski totalXp`.
 *
 * `existingEvents` doluysa defter OTORİTEDİR: V3'ten gelen kayıtlar aynen
 * (normalize edilerek) korunur, V2 alanlarından yeniden üretim YAPILMAZ.
 * Bu, canlı state → V3 dönüşümünde çift sayımı engeller.
 */
function buildLegacyXpEvents(
  core: Record<string, unknown>,
  createdAt: string,
  cloudTotalXp?: number,
  existingEvents?: unknown,
): XpEvent[] {
  const current = normalizeXpEvents(existingEvents);
  if (current.length > 0) return current;

  const hasTotalXp = core.totalXp !== undefined && core.totalXp !== null && Number.isFinite(Number(core.totalXp));
  const totalXp = Math.max(0, Math.round(asNumber(core.totalXp, 0)));
  const cloudTotal = Number.isFinite(Number(cloudTotalXp)) ? Math.max(0, Math.round(Number(cloudTotalXp))) : 0;
  // Bulut toplamı yerelden büyükse `legacy-cloud` yazılır ve hedef o olur;
  // bu durumda `adjustment` ile geri düşürmek bulut XP'sini silmek olur.
  const targetTotalXp = hasTotalXp && cloudTotal <= totalXp ? totalXp : undefined;
  return migrateLegacyXp({
    localTotalXp: totalXp,
    cloudTotalXp: cloudTotal,
    bonusXp: asNumber(core.bonusXp, 0),
    xpBaseline: asNumber(core.xpBaseline, 0),
    targetTotalXp,
    createdAt,
  });
}

/* =========================================================================
   V2 → V3 GÖÇÜ
   ========================================================================= */

export interface MigrateLegacyToV3Input {
  /** V2 çekirdek durumu (`ExtendedAppData` / `AppData`). V3 kaydı da kabul edilir. */
  core?: unknown;
  /** `sinevia-quests-v1` içeriği. */
  quests?: unknown;
  /** Yedek ek durumları (`sinevia-tutorial-v1`, `sinevia-academy-ui-v1`, sound, shortcuts...). */
  extras?: Record<string, unknown> | null;
  ownerAgentId?: string | null;
  deviceId?: string;
  revision?: number;
  /** Bulut arşivindeki toplam XP (V2 `total_xp`); yerelden büyükse `legacy-cloud` yazılır. */
  cloudTotalXp?: number;
  /** ISO 8601; deterministik testler için. */
  updatedAt?: string;
}

/** Bilinen V2 çekirdek alanları — `legacy` torbasına düşmemeleri için. */
const MAPPED_CORE_KEYS = new Set<string>([
  'schemaVersion', 'ownerAgentId', 'revision', 'updatedAt', 'deviceId', 'xpEvents',
  'movies', 'series', 'collections', 'history', 'genres', 'removedSeriesTitles', 'criteria', 'showcase',
  'achievements', 'coins', 'coinLedger', 'inventory', 'equipped', 'activeEffects', 'perks',
  'marketStats', 'pinnedContract', 'marketIntroSeen', 'marketRerollNonce', 'marketDailyNonce',
  'marketWeeklyNonce', 'dailyStreak', 'dailyStreakDate', 'lastWatchDate', 'totalDuelsCompleted',
  'giantSlayerWins', 'weeklyPlan', 'externalActions',
  'theme', 'nickname', 'notificationsEnabled', 'shareWatchedInFeed', 'sharePastWatchedInFeed',
  'notifyMessages', 'notifyFriendRequests', 'notifyLists', 'showLockedNames', 'showBadgeDetails',
  'reducedMotion', 'fastCelebrations', 'altWatchTemplate', 'reviewTags', 'tagSentiments',
  'agentId', 'lastCloudSync', 'aiChatHistory',
  // Türetilmiş XP alanları — deftere çevrildi, saklanmaz.
  'xp', 'level', 'totalXp', 'bonusXp', 'xpBaseline',
  // Geçici kuyruklar — V3'te yok, bilinçli olarak taşınmaz.
  'pendingToasts', 'pendingLevelUp', 'pendingLevelUpQueue', 'pendingXpGain', 'pendingCoinGain',
  // V3'te settings/tutorial/academy altına taşınan V2 alanları.
  'tutorial', 'academy', 'academyUi', 'settings',
]);

const MAPPED_QUEST_KEYS = new Set<string>([
  'activeQuestId', 'questAcceptedAt', 'questRejects', 'questCooldownUntil', 'completedQuests',
  'activeBadgeId', 'isPenaltyEnabled', 'activeContract', 'contractHistory',
  'freeDailyUsage', 'freePinnedUsage',
]);

/**
 * Doğrudan settings/tutorial/academy bloklarına eşlenen extras anahtarları.
 * Bunun dışındaki her şey (sound, shortcuts, bilinmeyenler) `legacy.extras`
 * torbasında olduğu gibi korunur.
 */
const MAPPED_EXTRA_KEYS = new Set<string>(['tutorial', 'academy', 'academyUi', 'settings']);

function normalizeTutorial(raw: unknown): TutorialProgressV3 {
  const source = isRecord(raw) ? raw : {};
  const known = new Set([
    'welcomeDone', 'welcomeStep', 'completed', 'pageVisited', 'modalSeen',
    'academyStarted', 'academyStep', 'academyDone', 'events', 'eventCounts',
  ]);
  const tutorial = emptyTutorial();
  tutorial.welcomeDone = Boolean(source.welcomeDone);
  tutorial.welcomeStep = asNumber(source.welcomeStep, 0);
  tutorial.completed = asStringArray(source.completed);
  tutorial.pageVisited = asStringArray(source.pageVisited);
  tutorial.modalSeen = asStringArray(source.modalSeen);
  tutorial.academyStarted = Boolean(source.academyStarted);
  tutorial.academyStep = asNumber(source.academyStep, 0);
  tutorial.academyDone = asStringArray(source.academyDone);
  tutorial.events = asStringArray(source.events);
  tutorial.eventCounts = asRecord<number>(source.eventCounts) ?? {};
  // Eşlenemeyen tutorial alanları kaybolmasın.
  const unknown: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) if (!known.has(key)) unknown[key] = value;
  if (Object.keys(unknown).length > 0) (tutorial as TutorialProgressV3 & { legacy?: unknown }).legacy = unknown;
  return tutorial;
}

function normalizeAcademy(raw: unknown): AcademyProgressV3 {
  const source = isRecord(raw) ? raw : {};
  const known = new Set(['started', 'step', 'done']);
  const ui: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) if (!known.has(key)) ui[key] = value;
  const academy: AcademyProgressV3 = {
    started: Boolean(source.started),
    step: asNumber(source.step, 0),
    done: asStringArray(source.done),
  };
  if (Object.keys(ui).length > 0) academy.ui = ui;
  return academy;
}

function normalizeQuestState(raw: unknown): { quests: QuestStateV3; unknown: Record<string, unknown> } {
  const source = isRecord(raw) ? raw : {};
  const quests = emptyQuestState();
  quests.activeQuestId = asNullableString(source.activeQuestId);
  quests.questAcceptedAt = asNullableNumber(source.questAcceptedAt);
  quests.questRejects = asNumber(source.questRejects, 0);
  quests.questCooldownUntil = asNullableNumber(source.questCooldownUntil);
  quests.completedQuests = asStringArray(source.completedQuests);
  quests.activeBadgeId = asNullableString(source.activeBadgeId);
  quests.isPenaltyEnabled = Boolean(source.isPenaltyEnabled);
  quests.activeContract = isRecord(source.activeContract)
    ? (source.activeContract as unknown as QuestStateV3['activeContract'])
    : null;
  quests.contractHistory = asArray(source.contractHistory);
  if (isRecord(source.freeDailyUsage)) {
    quests.freeDailyUsage = {
      date: asString(source.freeDailyUsage.date),
      count: asNumber(source.freeDailyUsage.count, 0),
    };
  }
  if (isRecord(source.freePinnedUsage)) {
    quests.freePinnedUsage = {
      week: asString(source.freePinnedUsage.week),
      contractId: asString(source.freePinnedUsage.contractId),
    };
  }
  const unknown: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) if (!MAPPED_QUEST_KEYS.has(key)) unknown[key] = value;
  return { quests, unknown };
}

function normalizeSettings(core: Record<string, unknown>, extras: Record<string, unknown>): AppSettingsV3 {
  const settingsSource = isRecord(core.settings) ? core.settings : {};
  const pick = (key: string): unknown => (core[key] !== undefined ? core[key] : settingsSource[key]);
  const settings: AppSettingsV3 = {
    theme: asString(pick('theme'), '') || DEFAULT_THEME_V3,
    nickname: asOptionalString(pick('nickname')),
    notificationsEnabled: asBool(pick('notificationsEnabled')),
    shareWatchedInFeed: asBool(pick('shareWatchedInFeed')),
    sharePastWatchedInFeed: asBool(pick('sharePastWatchedInFeed')),
    notifyMessages: asBool(pick('notifyMessages')),
    notifyFriendRequests: asBool(pick('notifyFriendRequests')),
    notifyLists: asBool(pick('notifyLists')),
    showLockedNames: asBool(pick('showLockedNames')),
    showBadgeDetails: asBool(pick('showBadgeDetails')),
    reducedMotion: asBool(pick('reducedMotion')),
    fastCelebrations: asBool(pick('fastCelebrations')),
    altWatchTemplate: asString(pick('altWatchTemplate'), '') || DEFAULT_ALT_WATCH_TEMPLATE_V3,
    externalActions: asArray<ExternalActionTemplate>(core.externalActions ?? settingsSource.externalActions),
    reviewTags: asStringArray(pick('reviewTags')),
    tagSentiments: asRecord<'positive' | 'negative'>(pick('tagSentiments')),
  };
  // Hiçbir zaman undefined anahtar bırakma (hash kararlılığı).
  for (const key of Object.keys(settings) as (keyof AppSettingsV3)[]) {
    if (settings[key] === undefined) delete settings[key];
  }
  // extras'taki bilinen görünüm tercihleri yoksa onları kullan (yedek geri yükleme).
  if (settings.reducedMotion === undefined && typeof extras.reducedMotion === 'boolean') {
    settings.reducedMotion = extras.reducedMotion;
  }
  if (settings.fastCelebrations === undefined && typeof extras.fastCelebrations === 'boolean') {
    settings.fastCelebrations = extras.fastCelebrations;
  }
  return settings;
}

/**
 * V2 durumunu (çekirdek + quests + extras) tek kanonik V3 kaydına yükseltir.
 * V3 kaydı verilirse dokunmadan (kopya olarak) döndürür.
 */
export function migrateLegacyToV3(input: MigrateLegacyToV3Input): AppStateV3 {
  const now = input.updatedAt ?? new Date(0).toISOString();

  if (isAppStateV3(input.core)) {
    return { ...input.core, updatedAt: input.updatedAt ?? input.core.updatedAt ?? now };
  }

  const core = isRecord(input.core) ? input.core : {};
  const extras = isRecord(input.extras) ? input.extras : {};
  const base = createEmptyAppStateV3({
    ownerAgentId: input.ownerAgentId ?? (typeof core.agentId === 'string' ? core.agentId : null),
    deviceId: input.deviceId ?? asString(core.deviceId, ''),
    revision: input.revision ?? asNumber(core.revision, 0),
    updatedAt: now,
  });

  const xpEvents = buildLegacyXpEvents(core, now, input.cloudTotalXp, core.xpEvents);
  const { quests, unknown: unknownQuestKeys } = normalizeQuestState(input.quests);
  const settings = normalizeSettings(core, extras);

  const tutorialSource = extras.tutorial ?? core.tutorial;
  const academySource = extras.academy ?? extras.academyUi ?? core.academy ?? core.academyUi;

  const legacyCore: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(core)) {
    if (!MAPPED_CORE_KEYS.has(key)) legacyCore[key] = value;
  }

  const legacyExtras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extras)) {
    if (!MAPPED_EXTRA_KEYS.has(key)) legacyExtras[key] = value;
  }

  const legacy: Record<string, unknown> = {};
  if (Object.keys(legacyCore).length > 0) legacy.core = legacyCore;
  if (Object.keys(unknownQuestKeys).length > 0) legacy.quests = unknownQuestKeys;
  if (Object.keys(legacyExtras).length > 0) legacy.extras = legacyExtras;

  const state: AppStateV3 = {
    ...base,
    xpEvents,
    movies: asArray<Movie>(core.movies),
    series: asArray<Series>(core.series),
    collections: asArray<Collection>(core.collections),
    history: asArray<WatchHistoryItem>(core.history),
    genres: asStringArray(core.genres).length > 0 ? asStringArray(core.genres) : [...DEFAULT_GENRES_V3],
    removedSeriesTitles: asStringArray(core.removedSeriesTitles),
    criteria: asArray<RatingCriterion>(core.criteria).length > 0
      ? asArray<RatingCriterion>(core.criteria)
      : base.criteria,
    showcase: asArray<AppStateV3['showcase'][number]>(core.showcase),
    achievements: asArray<AchievementProgress>(core.achievements),
    quests,
    coins: Math.max(0, Math.round(asNumber(core.coins, 0))),
    coinLedger: asArray<CoinTx>(core.coinLedger),
    inventory: asArray<InventoryEntry>(core.inventory),
    equipped: isRecord(core.equipped) ? (core.equipped as EquippedItems) : {},
    activeEffects: asArray<ActiveEffect>(core.activeEffects),
    perks: asStringArray(core.perks),
    marketStats: isRecord(core.marketStats) ? (core.marketStats as unknown as MarketStats) : base.marketStats,
    pinnedContract: isRecord(core.pinnedContract)
      ? { week: asString(core.pinnedContract.week), contractId: asString(core.pinnedContract.contractId) }
      : null,
    marketIntroSeen: Boolean(core.marketIntroSeen),
    marketRerollNonce: asNumber(core.marketRerollNonce, 0),
    marketDailyNonce: asNumber(core.marketDailyNonce, 0),
    marketWeeklyNonce: asNumber(core.marketWeeklyNonce, 0),
    dailyStreak: Math.max(0, asNumber(core.dailyStreak, 0)),
    dailyStreakDate: asNullableString(core.dailyStreakDate),
    lastWatchDate: asNullableString(core.lastWatchDate),
    totalDuelsCompleted: asNumber(core.totalDuelsCompleted, 0),
    giantSlayerWins: asNumber(core.giantSlayerWins, 0),
    weeklyPlan: asArray<WeeklyPlanItem>(core.weeklyPlan),
    externalActions: settings.externalActions ?? [],
    tutorial: normalizeTutorial(tutorialSource),
    academy: normalizeAcademy(academySource),
    settings,
    lastCloudSync: Number.isFinite(Number(core.lastCloudSync)) ? Number(core.lastCloudSync) : undefined,
    aiChatHistory: asArray<NonNullable<AppStateV3['aiChatHistory']>[number]>(core.aiChatHistory),
  };

  if (Object.keys(legacy).length > 0) state.legacy = legacy;
  return state;
}

export interface FromLegacyCoreOptions {
  /** Önceki V3 kaydı: revizyon, legacy torbası ve bilinmeyen alanlar korunur. */
  previous?: AppStateV3 | null;
  /** Canlı `sinevia-quests-v1` içeriği (AppContext quests'i localStorage'da tutuyor). */
  quests?: unknown;
  /** Yedek ek durumları (tutorial / academyUi / sound / shortcuts). */
  extras?: Record<string, unknown> | null;
  deviceId?: string;
  /** ISO 8601; verilmezse `previous.updatedAt` (o da yoksa epoch). */
  updatedAt?: string;
}

/**
 * CANLI state → V3 dönüşümü (kaydetme yolu).
 *
 * `migrateLegacyToV3`'ten farkı: V3 zarf alanlarını (ownerAgentId, revision,
 * deviceId, legacy torbası) önceki kayıttan devralır ve `core.xpEvents` varsa
 * defteri OTORİTE kabul eder (V2 alanlarından yeniden üretmez). Böylece her
 * kayıtta çift XP/göç kaydı oluşmaz.
 *
 * Orion: `saveStateV3(fromLegacyCore(data, { previous: lastV3, quests: readQuestState() }))`.
 */
export function fromLegacyCore(core: unknown, options: FromLegacyCoreOptions = {}): AppStateV3 {
  if (isAppStateV3(core) && !options.quests && !options.extras) {
    return options.updatedAt ? { ...core, updatedAt: options.updatedAt } : core;
  }
  const previous = options.previous ?? null;
  const source = isRecord(core) ? core : {};
  const updatedAt = options.updatedAt ?? previous?.updatedAt ?? new Date(0).toISOString();

  const next = migrateLegacyToV3({
    core: source,
    quests: options.quests ?? previous?.quests,
    extras: options.extras ?? undefined,
    ownerAgentId: typeof source.agentId === 'string'
      ? source.agentId
      : (previous?.ownerAgentId ?? null),
    deviceId: options.deviceId ?? previous?.deviceId ?? asString(source.deviceId, ''),
    revision: previous?.revision ?? asNumber(source.revision, 0),
    updatedAt,
  });

  // Önceki kaydın eşlenemeyen alanları kaybolmasın (yeni torbayla birleştir).
  if (previous?.legacy) {
    next.legacy = { ...previous.legacy, ...(next.legacy ?? {}) };
  }
  if (previous?.lastCloudSync !== undefined && next.lastCloudSync === undefined) {
    next.lastCloudSync = previous.lastCloudSync;
  }
  if (previous?.aiChatHistory && !next.aiChatHistory?.length) {
    next.aiChatHistory = previous.aiChatHistory;
  }
  return next;
}

/* =========================================================================
   GERİYE DÖNÜŞ: V3 → V2 GÖRÜNÜMÜ (geçiş dönemi köprüsü)
   ========================================================================= */

/**
 * V3 kaydını AppContext'in bugün beklediği düz V2 şekline çevirir.
 * Yalnız GEÇİŞ DÖNEMİ içindir: XP artık defterden türetilip `totalXp`/`xp`/
 * `level` alanlarına yazılır. Orion entegrasyonundan sonra bu köprü
 * kaldırılmalıdır; kanonik kayıt daima `state` alanıdır.
 */
export function toLegacyCoreView(state: AppStateV3): Record<string, unknown> {
  const totalXp = sumXpEvents(state.xpEvents);
  const level = levelFromXp(totalXp);
  const settings = state.settings;
  return {
    ...(state.legacy?.core && isRecord(state.legacy.core) ? state.legacy.core : {}),
    movies: state.movies,
    series: state.series,
    collections: state.collections,
    history: state.history,
    genres: state.genres,
    removedSeriesTitles: state.removedSeriesTitles,
    criteria: state.criteria,
    showcase: state.showcase,
    achievements: state.achievements,
    coins: state.coins,
    coinLedger: state.coinLedger,
    inventory: state.inventory,
    equipped: state.equipped,
    activeEffects: state.activeEffects,
    perks: state.perks,
    marketStats: state.marketStats,
    pinnedContract: state.pinnedContract,
    marketIntroSeen: state.marketIntroSeen,
    marketRerollNonce: state.marketRerollNonce,
    marketDailyNonce: state.marketDailyNonce,
    marketWeeklyNonce: state.marketWeeklyNonce,
    dailyStreak: state.dailyStreak,
    dailyStreakDate: state.dailyStreakDate,
    lastWatchDate: state.lastWatchDate,
    totalDuelsCompleted: state.totalDuelsCompleted,
    giantSlayerWins: state.giantSlayerWins,
    weeklyPlan: state.weeklyPlan,
    externalActions: state.externalActions,
    reviewTags: settings.reviewTags ?? [],
    tagSentiments: settings.tagSentiments,
    theme: settings.theme,
    nickname: settings.nickname,
    notificationsEnabled: settings.notificationsEnabled,
    shareWatchedInFeed: settings.shareWatchedInFeed,
    sharePastWatchedInFeed: settings.sharePastWatchedInFeed,
    notifyMessages: settings.notifyMessages,
    notifyFriendRequests: settings.notifyFriendRequests,
    notifyLists: settings.notifyLists,
    showLockedNames: settings.showLockedNames,
    showBadgeDetails: settings.showBadgeDetails,
    reducedMotion: settings.reducedMotion,
    fastCelebrations: settings.fastCelebrations,
    altWatchTemplate: settings.altWatchTemplate,
    agentId: state.ownerAgentId ?? undefined,
    lastCloudSync: state.lastCloudSync,
    aiChatHistory: state.aiChatHistory,
    // Türetilmiş XP — yalnız V2 uyumluluğu için.
    totalXp,
    level: level.level,
    xp: level.currentLevelXp,
    bonusXp: 0,
    xpBaseline: 0,
  };
}

/* =========================================================================
   BOOT ANLIK GÖRÜNTÜSÜ
   ========================================================================= */

/**
 * localStorage'a yazılacak KÜÇÜK açılış anlık görüntüsü.
 * Kütüphane (movies/series/history/collections) ve XP defteri ASLA girmez.
 */
export function buildBootSnapshot(state: AppStateV3): BootSnapshotV3 {
  const totalXp = sumXpEvents(state.xpEvents);
  const level = levelFromXp(totalXp);
  const achievements = state.achievements ?? [];
  const settings = state.settings ?? emptySettings();
  return {
    schemaVersion: 3,
    snapshotVersion: BOOT_SNAPSHOT_VERSION,
    updatedAt: state.updatedAt,
    theme: settings.theme || DEFAULT_THEME_V3,
    agentId: state.ownerAgentId,
    nickname: settings.nickname ?? null,
    level: level.level,
    totalXp,
    xp: level.currentLevelXp,
    dailyStreak: state.dailyStreak ?? 0,
    achievements: {
      total: achievements.length,
      unlocked: achievements.filter((item) => Array.isArray(item?.unlockedTiers) && item.unlockedTiers.length > 0).length,
    },
    prefs: {
      notificationsEnabled: settings.notificationsEnabled,
      shareWatchedInFeed: settings.shareWatchedInFeed,
      sharePastWatchedInFeed: settings.sharePastWatchedInFeed,
      notifyMessages: settings.notifyMessages,
      notifyFriendRequests: settings.notifyFriendRequests,
      notifyLists: settings.notifyLists,
      showLockedNames: settings.showLockedNames,
      showBadgeDetails: settings.showBadgeDetails,
      reducedMotion: settings.reducedMotion,
      fastCelebrations: settings.fastCelebrations,
    },
    lastCloudSync: state.lastCloudSync,
  };
}
