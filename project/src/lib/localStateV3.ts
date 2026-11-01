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
import { stableStringify } from './syncContract';
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

/** Bir quest kaydını (localStorage / V3 / yedek) güvenli V3 şekline çevirir. */
export function normalizeQuestStateValue(raw: unknown): QuestStateV3 {
  return normalizeQuestState(raw).quests;
}

/** İki quest kaydı içerik olarak aynı mı? (anahtar sırası önemsiz) */
export function sameQuestState(
  a: unknown,
  b: unknown,
): boolean {
  return stableStringify(normalizeQuestStateValue(a)) === stableStringify(normalizeQuestStateValue(b));
}

/**
 * İki quest kaydını alan bazında birleştirir (çakışma çözümü / açılış mutabakatı).
 *
 * - `completedQuests` her iki tarafta da korunur.
 * - `contractHistory` `instanceId` bazında tekilleşir (en yeni kayıt kazanır).
 * - Aktif görev/sözleşme yalnızca tamamlanmamışsa ve daha yeni başlatılmışsa korunur.
 * - Ücretsiz kullanım sayaçları geriye gitmez (tarih/hafta + maksimum adet).
 */
export function mergeQuestStates(localRaw: unknown, cloudRaw: unknown): QuestStateV3 {
  const local = normalizeQuestStateValue(localRaw);
  const cloud = normalizeQuestStateValue(cloudRaw);

  const completedQuests = Array.from(
    new Set([...(cloud.completedQuests ?? []), ...(local.completedQuests ?? [])]),
  );

  const historyByInstance = new Map<string, NonNullable<QuestStateV3['contractHistory']>[number]>();
  for (const entry of [...(cloud.contractHistory ?? []), ...(local.contractHistory ?? [])]) {
    if (!entry || typeof entry.instanceId !== 'string') continue;
    const existing = historyByInstance.get(entry.instanceId);
    if (!existing || Number(entry.completedAt ?? 0) >= Number(existing.completedAt ?? 0)) {
      historyByInstance.set(entry.instanceId, entry);
    }
  }
  const contractHistory = Array.from(historyByInstance.values())
    .sort((a, b) => Number(b.completedAt ?? 0) - Number(a.completedAt ?? 0))
    .slice(0, 100);
  const completedContractIds = new Set(contractHistory.map((entry) => entry.instanceId));

  const activeQuest = [local, cloud]
    .filter((side) => side.activeQuestId && !completedQuests.includes(side.activeQuestId))
    .sort((a, b) => Number(b.questAcceptedAt ?? 0) - Number(a.questAcceptedAt ?? 0))[0] ?? null;

  const activeContract = [local, cloud]
    .filter((side) => side.activeContract && !completedContractIds.has(side.activeContract.instanceId))
    .sort((a, b) => Number(b.activeContract?.startedAt ?? 0) - Number(a.activeContract?.startedAt ?? 0))[0]
    ?.activeContract ?? null;

  let freeDailyUsage = local.freeDailyUsage ?? cloud.freeDailyUsage;
  if (local.freeDailyUsage && cloud.freeDailyUsage) {
    if (local.freeDailyUsage.date > cloud.freeDailyUsage.date) {
      freeDailyUsage = local.freeDailyUsage;
    } else if (local.freeDailyUsage.date < cloud.freeDailyUsage.date) {
      freeDailyUsage = cloud.freeDailyUsage;
    } else {
      freeDailyUsage = {
        date: local.freeDailyUsage.date,
        count: Math.max(local.freeDailyUsage.count, cloud.freeDailyUsage.count),
      };
    }
  }

  let freePinnedUsage = cloud.freePinnedUsage ?? local.freePinnedUsage;
  if (local.freePinnedUsage && cloud.freePinnedUsage) {
    freePinnedUsage = local.freePinnedUsage.week >= cloud.freePinnedUsage.week
      ? local.freePinnedUsage
      : cloud.freePinnedUsage;
  }

  const merged: QuestStateV3 = {
    activeQuestId: activeQuest?.activeQuestId ?? null,
    questAcceptedAt: activeQuest?.questAcceptedAt ?? null,
    questRejects: local.questRejects,
    questCooldownUntil: local.questCooldownUntil ?? cloud.questCooldownUntil,
    completedQuests,
    activeBadgeId: local.activeBadgeId ?? cloud.activeBadgeId,
    isPenaltyEnabled: local.isPenaltyEnabled,
    activeContract,
    contractHistory,
  };
  if (freeDailyUsage) merged.freeDailyUsage = freeDailyUsage;
  if (freePinnedUsage) merged.freePinnedUsage = freePinnedUsage;
  return merged;
}

function normalizeSettings(
  core: Record<string, unknown>,
  extras: Record<string, unknown>,
  fallback: AppSettingsV3,
): AppSettingsV3 {
  const settingsSource = isRecord(core.settings) ? core.settings : {};
  const pick = (key: string): unknown => (core[key] !== undefined ? core[key] : settingsSource[key]);
  const settings: AppSettingsV3 = {
    theme: asString(pick('theme'), '') || fallback.theme || DEFAULT_THEME_V3,
    nickname: asOptionalString(pick('nickname')) ?? fallback.nickname,
    notificationsEnabled: asBool(pick('notificationsEnabled')) ?? fallback.notificationsEnabled,
    shareWatchedInFeed: asBool(pick('shareWatchedInFeed')) ?? fallback.shareWatchedInFeed,
    sharePastWatchedInFeed: asBool(pick('sharePastWatchedInFeed')) ?? fallback.sharePastWatchedInFeed,
    notifyMessages: asBool(pick('notifyMessages')) ?? fallback.notifyMessages,
    notifyFriendRequests: asBool(pick('notifyFriendRequests')) ?? fallback.notifyFriendRequests,
    notifyLists: asBool(pick('notifyLists')) ?? fallback.notifyLists,
    showLockedNames: asBool(pick('showLockedNames')) ?? fallback.showLockedNames,
    showBadgeDetails: asBool(pick('showBadgeDetails')) ?? fallback.showBadgeDetails,
    reducedMotion: asBool(pick('reducedMotion')) ?? fallback.reducedMotion,
    fastCelebrations: asBool(pick('fastCelebrations')) ?? fallback.fastCelebrations,
    altWatchTemplate: asString(pick('altWatchTemplate'), '') || fallback.altWatchTemplate || DEFAULT_ALT_WATCH_TEMPLATE_V3,
    externalActions: Array.isArray(core.externalActions ?? settingsSource.externalActions)
      ? asArray<ExternalActionTemplate>(core.externalActions ?? settingsSource.externalActions)
      : fallback.externalActions ?? [],
    reviewTags: Array.isArray(pick('reviewTags'))
      ? asStringArray(pick('reviewTags'))
      : fallback.reviewTags ?? [],
    tagSentiments: asRecord<'positive' | 'negative'>(pick('tagSentiments')) ?? fallback.tagSentiments,
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

/** `core`'da alan varsa onu, yoksa `fallback` değerini kullan (previous korunur). */
function pickArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function pickNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return value !== undefined && value !== null && Number.isFinite(n) ? n : fallback;
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Eşlenemeyen çekirdek alanlarını `legacy` torbasına koy (veri kaybı yok). */
function collectLegacyBag(
  core: Record<string, unknown>,
  extras: Record<string, unknown>,
  unknownQuestKeys: Record<string, unknown>,
  previous?: AppStateV3 | null,
): Record<string, unknown> | undefined {
  const legacyCore: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(core)) {
    if (!MAPPED_CORE_KEYS.has(key)) legacyCore[key] = value;
  }
  const legacyExtras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extras)) {
    if (!MAPPED_EXTRA_KEYS.has(key)) legacyExtras[key] = value;
  }

  const legacy: Record<string, unknown> = { ...(previous?.legacy ?? {}) };
  if (Object.keys(legacyCore).length > 0) {
    legacy.core = { ...(isRecord(legacy.core) ? legacy.core : {}), ...legacyCore };
  }
  if (Object.keys(unknownQuestKeys).length > 0) {
    legacy.quests = { ...(isRecord(legacy.quests) ? legacy.quests : {}), ...unknownQuestKeys };
  }
  if (Object.keys(legacyExtras).length > 0) {
    legacy.extras = { ...(isRecord(legacy.extras) ? legacy.extras : {}), ...legacyExtras };
  }
  return Object.keys(legacy).length > 0 ? legacy : undefined;
}

/** `AppStateV3` içerik alanları (zarf ve xpEvents hariç). */
type ContentFields = Omit<
  AppStateV3,
  'schemaVersion' | 'ownerAgentId' | 'revision' | 'updatedAt' | 'deviceId' | 'xpEvents' | 'legacy'
>;

/**
 * ORTAK EŞLEME: `core` (+ quests + extras) → V3 içerik alanları.
 * Hem `migrateLegacyToV3` hem `fromLegacyCore` bunu kullanır (kod tekrarı yok).
 *
 * `fallback` = eksik alanlarda kullanılacak kayıt. Göçte boş V3, canlı
 * kaydetmede önceki V3 verilir → previous alanları bozulmadan korunur,
 * core'daki yeni veri (yeni film/başarım) üzerine eklenir.
 */
function mapContentFromCore(
  core: Record<string, unknown>,
  extras: Record<string, unknown>,
  fallback: AppStateV3,
  questsSource?: unknown,
): { content: ContentFields; legacy?: Record<string, unknown> } {
  const { quests, unknown: unknownQuestKeys } = questsSource !== undefined
    ? normalizeQuestState(questsSource)
    : { quests: fallback.quests, unknown: {} as Record<string, unknown> };

  const tutorialSource = extras.tutorial ?? core.tutorial;
  const academySource = extras.academy ?? extras.academyUi ?? core.academy ?? core.academyUi;
  const settings = normalizeSettings(core, extras, fallback.settings);

  const content: ContentFields = {
    movies: pickArray<Movie>(core.movies, fallback.movies),
    series: pickArray<Series>(core.series, fallback.series),
    collections: pickArray<Collection>(core.collections, fallback.collections),
    history: pickArray<WatchHistoryItem>(core.history, fallback.history),
    genres: asStringArray(core.genres).length > 0 ? asStringArray(core.genres) : fallback.genres,
    removedSeriesTitles: pickArray<string>(core.removedSeriesTitles, fallback.removedSeriesTitles),
    criteria: asArray<RatingCriterion>(core.criteria).length > 0
      ? asArray<RatingCriterion>(core.criteria)
      : fallback.criteria,
    showcase: pickArray<AppStateV3['showcase'][number]>(core.showcase, fallback.showcase),
    achievements: pickArray<AchievementProgress>(core.achievements, fallback.achievements),
    quests,
    coins: Math.max(0, Math.round(pickNumber(core.coins, fallback.coins))),
    coinLedger: pickArray<CoinTx>(core.coinLedger, fallback.coinLedger),
    inventory: pickArray<InventoryEntry>(core.inventory, fallback.inventory),
    equipped: isRecord(core.equipped) ? (core.equipped as EquippedItems) : fallback.equipped,
    activeEffects: pickArray<ActiveEffect>(core.activeEffects, fallback.activeEffects),
    perks: pickArray<string>(core.perks, fallback.perks),
    marketStats: isRecord(core.marketStats)
      ? (core.marketStats as unknown as MarketStats)
      : fallback.marketStats,
    pinnedContract: 'pinnedContract' in core
      ? (isRecord(core.pinnedContract)
        ? { week: asString(core.pinnedContract.week), contractId: asString(core.pinnedContract.contractId) }
        : null)
      : fallback.pinnedContract,
    marketIntroSeen: pickBool(core.marketIntroSeen, Boolean(fallback.marketIntroSeen)),
    marketRerollNonce: pickNumber(core.marketRerollNonce, fallback.marketRerollNonce ?? 0),
    marketDailyNonce: pickNumber(core.marketDailyNonce, fallback.marketDailyNonce ?? 0),
    marketWeeklyNonce: pickNumber(core.marketWeeklyNonce, fallback.marketWeeklyNonce ?? 0),
    dailyStreak: Math.max(0, pickNumber(core.dailyStreak, fallback.dailyStreak)),
    dailyStreakDate: 'dailyStreakDate' in core
      ? asNullableString(core.dailyStreakDate)
      : fallback.dailyStreakDate,
    lastWatchDate: 'lastWatchDate' in core ? asNullableString(core.lastWatchDate) : fallback.lastWatchDate,
    totalDuelsCompleted: pickNumber(core.totalDuelsCompleted, fallback.totalDuelsCompleted ?? 0),
    giantSlayerWins: pickNumber(core.giantSlayerWins, fallback.giantSlayerWins ?? 0),
    weeklyPlan: pickArray<WeeklyPlanItem>(core.weeklyPlan, fallback.weeklyPlan),
    externalActions: settings.externalActions ?? fallback.externalActions,
    tutorial: isRecord(tutorialSource) ? normalizeTutorial(tutorialSource) : fallback.tutorial,
    academy: isRecord(academySource) ? normalizeAcademy(academySource) : fallback.academy,
    settings,
    lastCloudSync: Number.isFinite(Number(core.lastCloudSync))
      ? Number(core.lastCloudSync)
      : fallback.lastCloudSync,
    aiChatHistory: pickArray<NonNullable<AppStateV3['aiChatHistory']>[number]>(
      core.aiChatHistory,
      fallback.aiChatHistory ?? [],
    ),
  };

  return { content, legacy: collectLegacyBag(core, extras, unknownQuestKeys, fallback) };
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
  // Göç yolunda previous yoktur: quests yalnız açıkça verilen kaynaktan gelir.
  const { content, legacy } = mapContentFromCore(core, extras, base, input.quests);

  const state: AppStateV3 = {
    ...base,
    ...content,
    xpEvents,
  };
  if (legacy) state.legacy = legacy;
  return state;
}

export interface FromLegacyCoreOptions {
  /** Kayıt sahibi; verilmezse previous → core.agentId sırasıyla kullanılır. */
  ownerAgentId?: string | null;
  revision?: number;
  deviceId?: string;
  /** ISO 8601; verilmezse core.lastModified → previous.updatedAt → epoch. */
  updatedAt?: string;
  /** Canlı `sinevia-quests-v1` içeriği (AppContext quests'i localStorage'da tutuyor). */
  quests?: unknown;
  /** Yedek ek durumları (tutorial / academyUi / sound / shortcuts). */
  extras?: Record<string, unknown> | null;
}

/**
 * CANLI `ExtendedAppData` → `AppStateV3` (kaydetme yolu). SAF ve deterministik.
 *
 * Kurallar:
 *  - Eşleme `migrateLegacyToV3` ile AYNI ortak helper'ı kullanır (kod tekrarı yok).
 *  - `previous` verilmişse ledger/kimlik alanları korunur: `xpEvents` (ASLA
 *    sıfırlanmaz/yeniden üretilmez — core'da daha yeni bir defter varsa o
 *    kullanılır), `quests`, `tutorial`, `academy`, `settings`, `revision`,
 *    `ownerAgentId`, `deviceId`, `legacy` torbası.
 *  - `previous` yoksa ve core'da `totalXp` varsa `migrateLegacyXp` ile BİR KEZ
 *    legacy event üretilir (idempotent).
 *  - `totalXp` / `bonusXp` / `xpBaseline` V3 kaydına YAZILMAZ.
 *  - core'da olup previous'ta olmayan yeni veri (yeni film/başarım) eklenir.
 *
 * Orion: `saveStateV3(fromLegacyCore(data, lastV3, { quests: readQuestState() }))`.
 */
export function fromLegacyCore(
  core: unknown,
  previous: AppStateV3 | null = null,
  options: FromLegacyCoreOptions = {},
): AppStateV3 {
  const source = isRecord(core) ? core : {};
  const extras = isRecord(options.extras) ? options.extras : {};

  const composeUpdatedAt = options.updatedAt
    ?? (typeof source.lastModified === 'string' ? source.lastModified : undefined)
    ?? previous?.updatedAt
    ?? new Date(0).toISOString();

  // Zaten V3 ise zarf dışında dokunma.
  if (isAppStateV3(source)) {
    return {
      ...source,
      ownerAgentId: options.ownerAgentId !== undefined ? options.ownerAgentId : source.ownerAgentId,
      revision: options.revision !== undefined ? options.revision : source.revision,
      deviceId: options.deviceId ?? source.deviceId,
      updatedAt: composeUpdatedAt,
    };
  }

  const fallback = previous ?? createEmptyAppStateV3({
    ownerAgentId: options.ownerAgentId ?? (typeof source.agentId === 'string' ? source.agentId : null),
    deviceId: options.deviceId ?? asString(source.deviceId, ''),
    revision: options.revision ?? asNumber(source.revision, 0),
    updatedAt: composeUpdatedAt,
  });

  // ---- XP defteri (OTORİTE) -------------------------------------------------
  // 1) core'da defter varsa (canlı ledger) normalize edilip AYNEN kullanılır,
  // 2) yoksa previous defteri korunur,
  // 3) o da yoksa V2 totalXp'den BİR KEZ göç edilir.
  let xpEvents = normalizeXpEvents(source.xpEvents);
  if (xpEvents.length === 0) xpEvents = normalizeXpEvents(previous?.xpEvents);
  if (xpEvents.length === 0) {
    xpEvents = buildLegacyXpEvents(source, composeUpdatedAt, undefined, undefined);
  }

  const questsSource = options.quests != null ? options.quests : previous?.quests;
  const { content, legacy } = mapContentFromCore(source, extras, fallback, questsSource);

  const state: AppStateV3 = {
    schemaVersion: 3,
    ownerAgentId: options.ownerAgentId !== undefined
      ? options.ownerAgentId
      : (previous?.ownerAgentId ?? (typeof source.agentId === 'string' ? source.agentId : null)),
    revision: options.revision !== undefined
      ? options.revision
      : (previous?.revision ?? asNumber(source.revision, 0)),
    updatedAt: composeUpdatedAt,
    deviceId: options.deviceId ?? previous?.deviceId ?? asString(source.deviceId, ''),
    xpEvents,
    ...content,
  };
  if (legacy) state.legacy = legacy;
  return state;
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
    // Türetilmiş XP — yalnız V2 uyumluluğu için. Otorite `xpEvents`'tir ve
    // aşağıda aynen taşınır; `bonusXp`/`xpBaseline` yalnız eski okuyucular
    // için 0'dır (yeni kayıtta bu alanlar hiç yazılmaz).
    totalXp,
    level: level.level,
    xp: level.currentLevelXp,
    xpEvents: state.xpEvents,
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
