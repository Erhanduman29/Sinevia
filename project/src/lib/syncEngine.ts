/**
 * syncEngine — V3 revizyon tabanlı senkron motoru (SAF, React YOK).
 *
 * Tek doğru kaynak: `docs/sync-contract.md` §3 (karar matrisi) ve §4 (SQL).
 *
 * Tasarım:
 *  - Ağ erişimi `SyncClient` arayüzünün arkasındadır. Testlerde sahte istemci,
 *    uygulamada `createSupabaseSyncClient(supabase)` enjekte edilir.
 *  - `decideSyncAction` saf fonksiyondur: aynı girdi → aynı karar. Yan etkisi
 *    yoktur, ağ/storage/React kullanmaz.
 *  - Revizyon YALNIZ commit yanıtıyla ilerler. `mergeForks` revizyonu artırmaz.
 *  - Otomatik birleştirme YOKTUR: `merge` yalnızca `resolveConflict('merge')`
 *    ile, kullanıcı açıkça seçtiğinde çalışır.
 *  - "En büyük XP kazanır" gibi bir kural yoktur; XP defteri `(source,
 *    sourceId)` bazında birleşir, kayıp/çift kayıt üretmez.
 */

import type { AppStateV3, XpEvent } from '../types/appState';
import type { AchievementProgress, InventoryEntry } from '../types';
import type {
  CloudSaveRecord,
  CommitSaveRequest,
  ConflictChoice,
  SaveEnvelope,
  SyncConflict,
  SyncConflictReason,
  SyncError,
  SyncErrorCode,
  SyncResult,
} from '../types/sync';
import { SAVE_SCHEMA_VERSION } from '../types/sync';
import {
  buildSaveEnvelope,
  buildSyncSummary,
  canFastForward,
  makeContentHash,
  makeSaveHash,
  sameSaveHash,
} from './syncContract';
import { mergeXpLedgers, normalizeXpEvents, sumXpEvents } from './xpLedger';
import { parseBackupPayload } from './appBackup';
import { mergeQuestStates } from './localStateV3';

/* =========================================================================
   SABİTLER — SQL ile BİREBİR aynı (isimler değiştirilemez).
   ========================================================================= */

export const SYNC_RPC = {
  getState: 'sync_get_state',
  commit: 'sync_commit',
} as const;

/** `sync_commit` yanıtının istemci tarafındaki normalleştirilmiş hali. */
export type SyncCommitResponse =
  | { status: 'ok'; revision: number; saveHash?: string; updatedAt?: string }
  | { status: 'conflict'; revision: number; reason?: string };

/** Ağ katmanı sözleşmesi (Supabase, sahte istemci veya başka bir taşıyıcı). */
export interface SyncClient {
  /** `sync_get_state(p_agent_id)` — kayıt yoksa `null`. */
  getRemote(agentId: string): Promise<CloudSaveRecord | null>;
  /** `sync_commit(...)` — sunucu `baseRevision` uyuşmazsa `conflict` döner. */
  commit(agentId: string, request: CommitSaveRequest): Promise<SyncCommitResponse>;
  /**
   * Eski Storage arşivini (`sinevia_saves/<agentId>.json`) siler. Yalnızca
   * arşiv başarıyla `app_saves`e taşındıktan sonra çağrılır. İsteğe bağlıdır;
   * desteklemeyen taşıyıcılar arşivi olduğu gibi bırakır.
   */
  discardLegacyArchive?(agentId: string): Promise<void>;
}

/** Cihaz başına sync meta (gövdeye girmez, hash'i kirletmez). */
export interface SyncMetaStore {
  getLastSyncedHash(agentId: string): string | null;
  setLastSyncedHash(agentId: string, hash: string | null): void;
}

export interface SyncEngineDeps {
  client: SyncClient;
  /** Cihaz kimliği (zarf `deviceId` alanı). */
  deviceId: string;
  /** Yerel kanonik kayıt okuyucu. */
  getState: () => AppStateV3;
  /**
   * Yerel kanonik kayıt yazıcı (senkron sonucu uygulanır).
   * `source='download'` bulut kaydının aynen uygulandığı, `'upload'` ise
   * yalnız yerel commit'in onaylandığı anlamına gelir.
   */
  setState: (state: AppStateV3, source: 'download' | 'upload') => void | Promise<void>;
  /** Cihaz başına "son eşitlenen bulut hash'i". */
  meta?: SyncMetaStore;
  /** ISO 8601 üretici (testlerde sabitlenebilir). */
  now?: () => string;
}

/* =========================================================================
   HATA SINIFLANDIRMASI
   ========================================================================= */

/** Motorun fırlattığı, `code` taşıyan hata. */
export class SyncEngineError extends Error {
  code: SyncErrorCode;
  retryable: boolean;

  constructor(code: SyncErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'SyncEngineError';
    this.code = code;
    this.retryable = retryable;
  }
}

function messageOf(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '');
  return String(error);
}

/**
 * Ağ/kimlik/şema hatalarını `SyncErrorCode`'a çevirir.
 * Bilinmeyen hatalar `unknown` + `retryable: true` olur (geçici olabilir).
 */
export function classifySyncError(error: unknown): SyncError {
  if (error instanceof SyncEngineError) {
    return { code: error.code, message: error.message, retryable: error.retryable };
  }
  const message = messageOf(error) || 'Bilinmeyen senkron hatası';
  const lower = message.toLowerCase();
  const status = typeof error === 'object' && error !== null
    ? Number((error as { status?: unknown }).status ?? (error as { code?: unknown }).code)
    : NaN;

  const unauthorized = status === 401 || status === 403
    || lower.includes('jwt')
    || lower.includes('unauthorized')
    || lower.includes('permission')
    || lower.includes('yetkisiz')
    || lower.includes('başka bir ajana');
  if (unauthorized) {
    return { code: 'unauthorized', message, retryable: false };
  }

  const network = lower.includes('failed to fetch')
    || lower.includes('networkerror')
    || lower.includes('network request failed')
    || lower.includes('timeout')
    || lower.includes('abort')
    || lower.includes('offline')
    || lower.includes('fetch failed');
  if (network) {
    return { code: 'network', message, retryable: true };
  }

  if (lower.includes('hash')) {
    return { code: 'hash-mismatch', message, retryable: false };
  }
  if (lower.includes('schema') || lower.includes('envelope') || lower.includes('payload')) {
    return { code: 'invalid-envelope', message, retryable: false };
  }
  if (status >= 500 || lower.includes('server')) {
    return { code: 'server', message, retryable: true };
  }
  return { code: 'unknown', message, retryable: true };
}

/* =========================================================================
   KARAR MATRİSİ (SAF)
   ========================================================================= */

/**
 * `decideSyncAction` girdisi. Tüm değerler önceden hesaplanmıştır; fonksiyon
 * hiçbir şey okumaz (payload taşımaz, yalnız zarf alanları).
 */
export interface SyncDecisionSnapshot {
  /** Yerel zarfın gövde hash'i (`makeSaveHash(payload)`). */
  localHash: string;
  /** Yerel kaydın yalnız içerik hash'i (`makeContentHash`). */
  localContentHash?: string;
  localRevision: number;
  localOwnerAgentId: string | null;
  /** Yerel kayıt kütüphane/XP açısından boş mu? (cloud-only tespiti) */
  localEmpty: boolean;
  /** Yerel kaydı yazan cihaz (aynı-cihaz çakışmasını ayırmak için). */
  localDeviceId?: string | null;
  /** Yerel kaydın son içerik değişikliği zamanı. */
  localUpdatedAt?: string;
  /** Bulut kaydı; yoksa `null`. */
  cloud: {
    revision: number;
    saveHash: string;
    /** Bulut kaydının yalnız içerik hash'i (`makeContentHash`). */
    contentHash?: string;
    ownerAgentId: string | null;
    /** Bulutu son yazan cihaz. */
    deviceId?: string | null;
    /** Sunucudaki son commit zamanı. */
    updatedAt?: string;
  } | null;
  /** Cihazın son başarılı eşitlemede gördüğü bulut hash'i. */
  lastSyncedHash: string | null;
}

export type SyncDecision =
  | { kind: 'upload'; baseRevision: number; reason: 'cloud-empty' | 'local-ahead' | 'same-device-local-newer' }
  | { kind: 'download'; reason: 'cloud-ahead' | 'cloud-only' | 'same-device-cloud-newer' }
  | { kind: 'none'; reason: 'same' }
  | { kind: 'conflict'; reason: SyncConflictReason };

/** İki cihaz kimliği de biliniyor ve aynıysa true. `unknown-device` güvenilmez. */
export function sameKnownDevice(
  localDeviceId?: string | null,
  cloudDeviceId?: string | null,
): boolean {
  const local = (localDeviceId ?? '').trim();
  const cloud = (cloudDeviceId ?? '').trim();
  if (!local || !cloud || local === 'unknown-device' || cloud === 'unknown-device') return false;
  return local === cloud;
}

/**
 * Aynı cihazdaki iki kayıttan hangisi daha yeni? Önce içerik zamanı, saatler
 * eşit/geçersizse revizyon numarası kullanılır. Karar verilemezse `null`.
 */
export function fresherSide(
  localUpdatedAt: string | undefined,
  cloudUpdatedAt: string | undefined,
  localRevision: number,
  cloudRevision: number,
): 'local' | 'cloud' | null {
  const localTime = localUpdatedAt ? new Date(localUpdatedAt).getTime() : NaN;
  const cloudTime = cloudUpdatedAt ? new Date(cloudUpdatedAt).getTime() : NaN;
  if (Number.isFinite(localTime) && Number.isFinite(cloudTime) && localTime !== cloudTime) {
    return localTime > cloudTime ? 'local' : 'cloud';
  }
  if (localRevision !== cloudRevision) return localRevision > cloudRevision ? 'local' : 'cloud';
  return null;
}

/**
 * `docs/sync-contract.md` §3 karar matrisinin birebir uygulaması.
 *
 * Sıra önemlidir:
 *  1. Bulut kaydı yok          → ilk senkron / local-only → commit(0)
 *  2. Sahip uyuşmazlığı        → conflict `owner-mismatch` (asla otomatik yazma)
 *  3. Hash aynı                → up-to-date
 *  4. Yerel boş, bulut dolu    → cloud-only → indir
 *  5. Yerel temiz + bulut ileri→ cloud-ahead → indir
 *  6. Yerel temiz              → aynı/geride bulut → up-to-date
 *  7. Bulut temiz + yerel kirli→ local-ahead → commit(cloud.revision)
 *  8. İkisi de değişmiş        → conflict `both-changed`
 */
export function decideSyncAction(snapshot: SyncDecisionSnapshot): SyncDecision {
  const { cloud, localHash, localRevision, localOwnerAgentId, lastSyncedHash } = snapshot;

  // 1) Bulut kaydı yok → ilk yazım. baseRevision DAİMA 0.
  if (!cloud) {
    return { kind: 'upload', baseRevision: 0, reason: 'cloud-empty' };
  }

  const localClean = sameSaveHash(localHash, lastSyncedHash);
  const cloudClean = sameSaveHash(cloud.saveHash, lastSyncedHash);
  const sameContent = Boolean(
    snapshot.localContentHash
    && cloud.contentHash
    && snapshot.localContentHash === cloud.contentHash,
  );

  // 2) İÇERİK aynıysa çakışma YOKTUR. Saat, revizyon, cihaz kimliği, tema,
  //    eğitim ilerlemesi, market sayaçları gibi alanlar bu hash'e girmez.
  //    Yine de tek tarafta kalan gerçek bir değişiklik varsa normal yönlü
  //    senkron yapılır; burada yalnızca "çakışma" engellenir.
  if (sameContent) {
    // Yerel tamamen boşsa buluttaki (içerik dışı) tercihleri korumak için indir.
    if (snapshot.localEmpty && !localClean) {
      return { kind: 'download', reason: 'cloud-only' };
    }
    // Bulut temiz, yerel kirli → yereli yükle (ör. yalnızca tema değişti).
    if (!localClean && cloudClean) {
      return { kind: 'upload', baseRevision: cloud.revision, reason: 'local-ahead' };
    }
    // Yerel temiz, bulut kirli → bulutu indir (ör. yalnızca ayar değişti).
    if (localClean && !cloudClean) {
      if (canFastForward(localRevision, cloud.revision)) {
        return { kind: 'download', reason: 'cloud-ahead' };
      }
      return { kind: 'none', reason: 'same' };
    }
    // İki taraf da "kirli" görünse bile gerçek içerik aynı: uyarı gösterme.
    return { kind: 'none', reason: 'same' };
  }

  // 3) Sahip uyuşmazlığı: içerik farklıysa ve iki kimlik de biliniyorsa yazma yok.
  if (
    typeof localOwnerAgentId === 'string'
    && typeof cloud.ownerAgentId === 'string'
    && localOwnerAgentId.length > 0
    && cloud.ownerAgentId.length > 0
    && localOwnerAgentId !== cloud.ownerAgentId
  ) {
    return { kind: 'conflict', reason: 'owner-mismatch' };
  }

  // 4) Aynı gövde → yazacak bir şey yok.
  if (sameSaveHash(localHash, cloud.saveHash)) {
    return { kind: 'none', reason: 'same' };
  }

  // 5) Yerel boş, bulut dolu → güvenle indir (cloud-only).
  if (snapshot.localEmpty) {
    return { kind: 'download', reason: 'cloud-only' };
  }

  // 6) Yerel temiz + bulut ileride → indir.
  if (localClean) {
    if (canFastForward(localRevision, cloud.revision)) {
      return { kind: 'download', reason: 'cloud-ahead' };
    }
    // Aynı/geride bulut revizyonu: yerel zaten otorite (yankı yok).
    return { kind: 'none', reason: 'same' };
  }

  // 7) Bulut temiz + yerel kirli → yereli commit et (fast-forward upload).
  if (cloudClean) {
    return { kind: 'upload', baseRevision: cloud.revision, reason: 'local-ahead' };
  }

  // 8) İKİ TARAF DA KİRLİ ama ikisi de AYNI cihazdan: tek girişte kullanıcıya
  //    sorma. Aynı cihazın iki sekmesi / yarıda kalan commit / meta yazımı
  //    hatası bu duruma düşebilir. En yeni içerik kazanır.
  if (cloud && sameKnownDevice(snapshot.localDeviceId, cloud.deviceId)) {
    const side = fresherSide(
      snapshot.localUpdatedAt,
      cloud.updatedAt,
      localRevision,
      cloud.revision,
    );
    if (side === 'local') {
      return { kind: 'upload', baseRevision: cloud.revision, reason: 'same-device-local-newer' };
    }
    if (side === 'cloud') {
      return { kind: 'download', reason: 'same-device-cloud-newer' };
    }
  }

  // 9) Farklı cihazlar (veya cihaz bilgisi yok) → kullanıcı kararı.
  return { kind: 'conflict', reason: 'both-changed' };
}

/* =========================================================================
   ÇALIŞMA KAPISI (SAF) — AppContext otomatik/manüel senkron kararı
   ========================================================================= */

/**
 * Senkronun çalışıp çalışamayacağı. `manual` kullanıcı düğmesidir: güven
 * bekleyen onayları atlar, ancak açık çakışma/erteleme/sıfırlama yine durdurur.
 */
export interface SyncRunGate {
  hydrated: boolean;
  agentId: string | null | undefined;
  /** Yerel kayıt güvenilir mi? (yedekten kurtarma / bozuk IDB'de false) */
  trusted: boolean;
  /** Yedekten kurtarılan kayıt için kullanıcı seçimi bekleniyor mu? */
  approvalPending: boolean;
  /** Kullanıcı "sonra" dedi mi? */
  deferred: boolean;
  /** Çözülmemiş çakışma var mı? */
  conflictPending: boolean;
  /** Hesap sıfırlama bayrağı açık mı? */
  zeroReset?: boolean;
}

/** Otomatik (veya manüel) senkronun çalışmasına izin var mı? */
export function shouldRunSync(gate: SyncRunGate, manual = false): boolean {
  if (!gate.hydrated || !gate.agentId) return false;
  if (gate.conflictPending || gate.deferred || gate.zeroReset) return false;
  if (!manual && (gate.approvalPending || !gate.trusted)) return false;
  return true;
}

/**
 * "Bu cihazı buluta yükle" için sahip onayı gerekli mi?
 * Yerel kaydın sahibi ile oturumdaki ajan farklıysa (hesap değişimi) yanlış
 * hesabın bulutunu ezmemek için kullanıcıya AÇIKÇA sorulmalıdır.
 */
export function needsOwnerUploadConfirmation(
  localOwnerAgentId: string | null | undefined,
  sessionAgentId: string | null | undefined,
): boolean {
  return typeof localOwnerAgentId === 'string'
    && typeof sessionAgentId === 'string'
    && localOwnerAgentId.length > 0
    && sessionAgentId.length > 0
    && localOwnerAgentId !== sessionAgentId;
}

/* =========================================================================
   YARDIMCILAR
   ========================================================================= */

/** Kayıt gerçekten kullanılabilir bir V3 gövdesi mi? */
export function isSyncPayload(value: unknown): value is AppStateV3 {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== SAVE_SCHEMA_VERSION) return false;
  return Array.isArray(record.movies) && Array.isArray(record.series) && Array.isArray(record.xpEvents);
}

/** Yerel kayıt "boş" mu? (yalnız cloud-only tespiti için) */
export function isEmptyState(
  state: Pick<AppStateV3, 'movies' | 'series' | 'history' | 'xpEvents' | 'quests'>,
): boolean {
  const quests = state.quests;
  const hasQuestActivity = Boolean(
    quests?.activeQuestId
    || quests?.activeContract
    || (quests?.completedQuests?.length ?? 0) > 0
    || (quests?.contractHistory?.length ?? 0) > 0
    || (quests?.freeDailyUsage?.count ?? 0) > 0
    || quests?.freePinnedUsage,
  );
  return !hasQuestActivity
    && (state.movies?.length ?? 0) === 0
    && (state.series?.length ?? 0) === 0
    && (state.history?.length ?? 0) === 0
    && sumXpEvents(state.xpEvents) <= 0;
}

function unionStrings(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): string[] {
  return Array.from(new Set([...(a ?? []), ...(b ?? [])]));
}

/** "Daha zengin" medya kaydı kazanır (izlenmiş/puanlı kayıt korunur). */
function mediaRichnessScore(item: unknown): number {
  if (!item || typeof item !== 'object') return 0;
  const record = item as Record<string, unknown>;
  let score = 0;
  if (record.watched) score += 50;
  if (record.rating !== null && record.rating !== undefined) score += 20;
  if (Array.isArray(record.episodes)) score += record.episodes.length;
  if (Array.isArray(record.deletedEpisodes)) score += record.deletedEpisodes.length;
  for (const value of Object.values(record)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    score += 0.05;
  }
  return score;
}

/** `id` ile birleştirir; aynı id'de daha zengin kayıt kazanır (sıra: primary). */
function mergeById<T extends { id: string }>(primary: T[] = [], secondary: T[] = []): T[] {
  const merged = new Map<string, T>();
  for (const item of primary ?? []) if (item?.id) merged.set(item.id, item);
  for (const item of secondary ?? []) {
    if (!item?.id) continue;
    const existing = merged.get(item.id);
    if (!existing) {
      merged.set(item.id, item);
      continue;
    }
    merged.set(item.id, mediaRichnessScore(item) > mediaRichnessScore(existing) ? item : existing);
  }
  return Array.from(merged.values());
}

/** `id` ile birleştirir, ikisini de korur (geçmiş/ledger gibi append-only listeler). */
function mergeByIdKeepingBoth<T extends { id: string }>(primary: T[] = [], secondary: T[] = []): T[] {
  const merged = new Map<string, T>();
  for (const item of primary ?? []) if (item?.id) merged.set(item.id, item);
  for (const item of secondary ?? []) if (item?.id && !merged.has(item.id)) merged.set(item.id, item);
  return Array.from(merged.values());
}

/** Başarım kademeleri birleşir; hiçbir tarafın açtığı kademe kaybolmaz. */
function mergeAchievements(
  primary: AchievementProgress[] = [],
  secondary: AchievementProgress[] = [],
): AchievementProgress[] {
  const merged = new Map<string, AchievementProgress>();
  for (const item of primary ?? []) {
    if (!item?.achievementId) continue;
    merged.set(item.achievementId, {
      ...item,
      unlockedTiers: Array.isArray(item.unlockedTiers) ? [...item.unlockedTiers] : [],
      tierDates: { ...(item.tierDates ?? {}) },
    });
  }
  for (const item of secondary ?? []) {
    if (!item?.achievementId) continue;
    const existing = merged.get(item.achievementId);
    if (!existing) {
      merged.set(item.achievementId, {
        ...item,
        unlockedTiers: Array.isArray(item.unlockedTiers) ? [...item.unlockedTiers] : [],
        tierDates: { ...(item.tierDates ?? {}) },
      });
      continue;
    }
    const tierDates: Record<string, string> = { ...(existing.tierDates ?? {}) };
    for (const [tier, date] of Object.entries(item.tierDates ?? {})) {
      if (!tierDates[tier] || (date && date < tierDates[tier])) tierDates[tier] = date;
    }
    merged.set(item.achievementId, {
      ...existing,
      current: Math.max(Number(existing.current ?? 0), Number(item.current ?? 0)),
      unlockedTiers: unionStrings(existing.unlockedTiers, item.unlockedTiers),
      tierDates,
      lastNotifiedTier: existing.lastNotifiedTier ?? item.lastNotifiedTier ?? null,
    });
  }
  return Array.from(merged.values());
}

/** Envanter `itemId` bazında birleşir; miktar ASLA düşmez (en büyük korunur). */
function mergeInventory(primary: InventoryEntry[] = [], secondary: InventoryEntry[] = []): InventoryEntry[] {
  const merged = new Map<string, InventoryEntry>();
  for (const entry of primary ?? []) {
    if (!entry?.itemId) continue;
    merged.set(entry.itemId, { ...entry });
  }
  for (const entry of secondary ?? []) {
    if (!entry?.itemId) continue;
    const existing = merged.get(entry.itemId);
    if (!existing) {
      merged.set(entry.itemId, { ...entry });
      continue;
    }
    merged.set(entry.itemId, {
      itemId: entry.itemId,
      quantity: Math.max(Number(existing.quantity ?? 0), Number(entry.quantity ?? 0)),
      acquiredAt: existing.acquiredAt || entry.acquiredAt,
    });
  }
  return Array.from(merged.values());
}

/**
 * İki dalı birleştirir (yalnızca kullanıcı `merge` seçtiğinde çağrılır).
 *
 * - Kütüphane: `id` bazında birleşim; hiçbir film/dizi/geçmiş kaydı silinmez.
 * - XP defteri: `mergeXpLedgers(cloud, local)` → `(source, sourceId)` tekilleşir.
 *   Aynı anahtar iki tarafta varsa BULUT kopyası korunur (sözleşme §3).
 * - Revizyon ARTMAZ: yalnız commit yanıtıyla ilerler (`revision = cloud.revision`).
 */
export function mergeForks(local: AppStateV3, cloud: AppStateV3, updatedAt: string): AppStateV3 {
  const xpEvents: XpEvent[] = mergeXpLedgers(cloud.xpEvents, local.xpEvents);
  const merged: AppStateV3 = {
    ...cloud,
    schemaVersion: SAVE_SCHEMA_VERSION,
    ownerAgentId: cloud.ownerAgentId ?? local.ownerAgentId,
    // Revizyon sunucu otoritesindedir; commit baseRevision olarak kullanılacak.
    revision: cloud.revision,
    updatedAt,
    deviceId: cloud.deviceId || local.deviceId,
    xpEvents,
    movies: mergeById(cloud.movies, local.movies),
    series: mergeById(cloud.series, local.series),
    collections: mergeById(cloud.collections, local.collections),
    history: mergeByIdKeepingBoth(cloud.history, local.history),
    genres: unionStrings(cloud.genres, local.genres),
    removedSeriesTitles: unionStrings(cloud.removedSeriesTitles, local.removedSeriesTitles),
    achievements: mergeAchievements(cloud.achievements, local.achievements),
    quests: mergeQuestStates(local.quests, cloud.quests),
    coinLedger: mergeByIdKeepingBoth(cloud.coinLedger, local.coinLedger),
    inventory: mergeInventory(cloud.inventory, local.inventory),
    perks: unionStrings(cloud.perks, local.perks),
    // Yerel-only alanlar (hash'e girmez) yerel cihazdan korunur.
    aiChatHistory: local.aiChatHistory ?? cloud.aiChatHistory,
    lastCloudSync: local.lastCloudSync ?? cloud.lastCloudSync,
    legacy: cloud.legacy ?? local.legacy,
  };
  // `xpEvents` normalize edilmiş hâlde yazılır (defter otoritesi).
  merged.xpEvents = normalizeXpEvents(merged.xpEvents);
  return merged;
}

/* =========================================================================
   MOTOR
   ========================================================================= */

interface PendingConflict {
  agentId: string;
  cloud: CloudSaveRecord;
}

export interface SyncEngine {
  /** Karar matrisini uygular: indir / yükle / hiçbir şey / çakışma. */
  sync(agentId: string): Promise<SyncResult>;
  /** Yalnız `sync_get_state` çağırır (bulutu uygular). */
  pullRemote(agentId: string): Promise<SyncResult>;
  /** Yalnız yerel kaydı commit eder (`sync_commit`). */
  pushLocal(agentId: string): Promise<SyncResult>;
  /** Açık kullanıcı seçimini uygular. `merge` yalnız buradan çalışır. */
  resolveConflict(agentId: string, choice: ConflictChoice): Promise<SyncResult>;
  /** Bekleyen çakışma (UI için). */
  getPendingConflict(): SyncConflict | null;
  hasPendingConflict(): boolean;
  clearPendingConflict(): void;
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const now = deps.now ?? (() => new Date().toISOString());
  let pending: PendingConflict | null = null;

  const readHash = (agentId: string): string | null => deps.meta?.getLastSyncedHash(agentId) ?? null;
  const writeHash = (agentId: string, hash: string | null): void => { deps.meta?.setLastSyncedHash(agentId, hash); };

  const current = (): AppStateV3 => deps.getState();

  function buildLocalEnvelope(agentId: string, state: AppStateV3, revision: number): SaveEnvelope {
    return buildSaveEnvelope({
      payload: state,
      ownerAgentId: agentId,
      revision,
      deviceId: deps.deviceId,
      updatedAt: state.updatedAt || now(),
    });
  }

  function buildConflict(
    reason: SyncConflictReason,
    local: AppStateV3,
    cloud: CloudSaveRecord,
  ): SyncConflict {
    return {
      reason,
      local: buildSyncSummary(local),
      cloud: buildSyncSummary(cloud.payload),
      localRevision: Math.max(0, Number(local.revision) || 0),
      cloudRevision: Math.max(0, Number(cloud.revision) || 0),
    };
  }

  function applyDownload(agentId: string, cloud: CloudSaveRecord): SyncResult {
    if (!isSyncPayload(cloud.payload)) {
      throw new SyncEngineError('invalid-envelope', 'Bulut kaydı geçersiz şema sürümünde (V3 değil).');
    }
    const revision = Math.max(0, Number(cloud.revision) || 0);
    const applied: AppStateV3 = {
      ...cloud.payload,
      schemaVersion: SAVE_SCHEMA_VERSION,
      ownerAgentId: cloud.payload.ownerAgentId ?? agentId,
      revision,
      deviceId: cloud.payload.deviceId || cloud.deviceId || deps.deviceId,
      updatedAt: cloud.payload.updatedAt || cloud.updatedAt || now(),
    };
    void deps.setState(applied, 'download');
    const envelope = buildLocalEnvelope(agentId, applied, revision);
    // Sunucunun sakladığı hash ile bizim normalize gövdemizin hash'i farklı
    // olabilir (yabancı istemci). Yerel temiz sayılması için yerel hash yazılır.
    writeHash(agentId, envelope.saveHash);
    return { status: 'cloud-loaded', revision, envelope };
  }

  async function fetchRemote(agentId: string): Promise<CloudSaveRecord | null> {
    const cloud = await deps.client.getRemote(agentId);
    if (cloud && !isSyncPayload(cloud.payload)) {
      throw new SyncEngineError('invalid-envelope', 'Bulut kaydı geçersiz şema sürümünde (V3 değil).');
    }
    return cloud;
  }

  /**
   * Yerel kaydı commit eder. Payload'daki `revision` alanı, sunucunun atayacağı
   * değere (baseRevision + 1) önceden ayarlanır: böylece `makeSaveHash(payload)`
   * commit sonrası yerel gövdeyle AYNI kalır ve gereksiz çakışma üretilmez.
   * Nihai revizyon daima sunucu yanıtından okunur.
   */
  async function commitState(
    agentId: string,
    state: AppStateV3,
    baseRevision: number,
    allowSameDeviceRetry = true,
  ): Promise<SyncResult> {
    const predictedRevision = Math.max(1, Math.floor(baseRevision) + 1);
    const payload: AppStateV3 = {
      ...state,
      schemaVersion: SAVE_SCHEMA_VERSION,
      ownerAgentId: agentId,
      revision: predictedRevision,
      deviceId: deps.deviceId,
      updatedAt: state.updatedAt || now(),
    };
    const saveHash = makeSaveHash(payload);

    const response = await deps.client.commit(agentId, {
      ownerAgentId: agentId,
      baseRevision: Math.max(0, Math.floor(baseRevision)),
      deviceId: deps.deviceId,
      saveHash,
      payload,
    });

    if (response.status === 'conflict') {
      const cloud = await fetchRemote(agentId).catch(() => null);

      // Aynı cihazın kendi commit yarışı (iki sekme / ağ tekrarı): kullanıcıya
      // sorma. Bulut daha yeniyse indir; yerel daha yeniyse güncel revizyonla
      // bir kez daha dene. Farklı cihazda eski davranış (modal) korunur.
      if (cloud && sameKnownDevice(deps.deviceId, cloud.deviceId)) {
        const side = fresherSide(
          state.updatedAt,
          cloud.updatedAt || cloud.payload?.updatedAt || '',
          Math.max(0, Number(state.revision) || 0),
          Math.max(0, Number(cloud.revision) || 0),
        );
        if (side === 'cloud') return applyDownload(agentId, cloud);
        if (side === 'local' && allowSameDeviceRetry) {
          return commitState(
            agentId,
            state,
            Math.max(0, Number(cloud.revision) || 0),
            false,
          );
        }
      }

      const conflictReason: SyncConflictReason = 'revision-mismatch';
      const conflict = cloud
        ? buildConflict(conflictReason, state, cloud)
        : {
            reason: conflictReason,
            local: buildSyncSummary(state),
            cloud: buildSyncSummary(state),
            localRevision: Math.max(0, Number(state.revision) || 0),
            cloudRevision: Math.max(0, Number(response.revision) || 0),
          };
      if (cloud) pending = { agentId, cloud };
      return { status: 'conflict', revision: Math.max(0, Number(state.revision) || 0), conflict };
    }

    const revision = Math.max(0, Number(response.revision) || predictedRevision);
    if (revision !== predictedRevision) {
      // Beklenmedik revizyon: sunucunun sakladığı hash'i doğrula.
      const cloud = await fetchRemote(agentId).catch(() => null);
      if (cloud && !sameSaveHash(cloud.saveHash, saveHash)) {
        pending = { agentId, cloud };
        return {
          status: 'conflict',
          revision: Math.max(0, Number(state.revision) || 0),
          conflict: buildConflict('revision-mismatch', state, cloud),
        };
      }
    }

    const committed: AppStateV3 = {
      ...payload,
      revision,
      updatedAt: payload.updatedAt,
    };
    void deps.setState(committed, 'upload');
    writeHash(agentId, makeSaveHash(committed));
    return {
      status: 'local-uploaded',
      revision,
      envelope: buildSaveEnvelope({
        payload: committed,
        ownerAgentId: agentId,
        revision,
        deviceId: deps.deviceId,
        updatedAt: response.updatedAt ?? committed.updatedAt,
      }),
    };
  }

  /**
   * Eski Storage arşivini temizler. Yalnızca arşiv app_saves'e başarıyla
   * taşındıktan sonra çağrılır; hata senkron sonucunu bozmaz (bir sonraki
   * başarılı sync'te yeniden denenir).
   */
  async function discardLegacyArchive(agentId: string): Promise<void> {
    try {
      await deps.client.discardLegacyArchive?.(agentId);
    } catch {
      /* temizlik en iyi çaba; veri kaybı riski yok */
    }
  }

  async function decideAndAct(agentId: string, localOverride?: AppStateV3): Promise<SyncResult> {
    const local = localOverride ?? current();
    const fallbackRevision = Math.max(0, Number(local?.revision) || 0);
    if (!isSyncPayload(local)) {
      return {
        status: 'error',
        revision: fallbackRevision,
        error: { code: 'invalid-envelope', message: 'Yerel kayıt V3 değil (schemaVersion !== 3).', retryable: false },
      };
    }

    let cloud: CloudSaveRecord | null;
    try {
      cloud = await fetchRemote(agentId);
    } catch (error) {
      const classified = classifySyncError(error);
      return { status: 'error', revision: Math.max(0, Number(local.revision) || 0), error: classified };
    }

    const localHash = makeSaveHash(local);
    const decision = decideSyncAction({
      localHash,
      localContentHash: makeContentHash(local),
      localRevision: Math.max(0, Number(local.revision) || 0),
      localOwnerAgentId: local.ownerAgentId ?? null,
      localEmpty: isEmptyState(local),
      localDeviceId: deps.deviceId,
      localUpdatedAt: local.updatedAt,
      cloud: cloud
        ? {
            revision: Math.max(0, Number(cloud.revision) || 0),
            saveHash: cloud.saveHash || makeSaveHash(cloud.payload),
            contentHash: makeContentHash(cloud.payload),
            ownerAgentId: cloud.payload?.ownerAgentId ?? null,
            deviceId: cloud.deviceId,
            updatedAt: cloud.updatedAt || cloud.payload?.updatedAt || '',
          }
        : null,
      lastSyncedHash: readHash(agentId),
    });

    try {
      switch (decision.kind) {
        case 'none': {
          if (cloud) {
            writeHash(agentId, cloud.saveHash || makeSaveHash(cloud.payload));
            // app_saves boşken arşivle birebir aynı yerel kayıt: kaybı önlemek
            // için arşivi normal commit(0) ile app_saves'e taşı.
            if (cloud.source === 'legacy-archive') {
              const uploaded = await commitState(agentId, { ...local, ownerAgentId: agentId }, 0);
              if (uploaded.status === 'local-uploaded') await discardLegacyArchive(agentId);
              return uploaded;
            }
          }
          return {
            status: 'up-to-date',
            revision: Math.max(0, Number(local.revision) || 0),
            ...(cloud ? { envelope: buildLocalEnvelope(agentId, cloud.payload, cloud.revision) } : {}),
          };
        }
        case 'download': {
          const downloaded = applyDownload(agentId, cloud as CloudSaveRecord);
          if ((cloud as CloudSaveRecord | null)?.source === 'legacy-archive') {
            // Arşiv yerel kayda uygulandı; aynı oturumda app_saves'e de yaz
            // (baseRevision = 0, çünkü sunucu kaydı yok).
            const committed = await commitState(agentId, current(), 0);
            if (committed.status === 'local-uploaded') {
              await discardLegacyArchive(agentId);
              return { ...downloaded, revision: committed.revision };
            }
            return committed;
          }
          return downloaded;
        }
        case 'upload':
          return await commitState(agentId, { ...local, ownerAgentId: agentId }, decision.baseRevision);
        case 'conflict':
        default: {
          if (!cloud) {
            return {
              status: 'error',
              revision: Math.max(0, Number(local.revision) || 0),
              error: { code: 'server', message: 'Çakışma için bulut kaydı yok.', retryable: true },
            };
          }
          pending = { agentId, cloud };
          return {
            status: 'conflict',
            revision: Math.max(0, Number(local.revision) || 0),
            conflict: buildConflict(decision.reason, local, cloud),
          };
        }
      }
    } catch (error) {
      const classified = classifySyncError(error);
      return { status: 'error', revision: Math.max(0, Number(local.revision) || 0), error: classified };
    }
  }

  return {
    sync(agentId) {
      return decideAndAct(agentId);
    },

    async pullRemote(agentId) {
      const local = current();
      try {
        const cloud = await fetchRemote(agentId);
        if (!cloud) {
          return { status: 'up-to-date', revision: Math.max(0, Number(local.revision) || 0) };
        }
        return applyDownload(agentId, cloud);
      } catch (error) {
        return {
          status: 'error',
          revision: Math.max(0, Number(local.revision) || 0),
          error: classifySyncError(error),
        };
      }
    },

    async pushLocal(agentId) {
      const local = current();
      if (!isSyncPayload(local)) {
        return {
          status: 'error',
          revision: 0,
          error: { code: 'invalid-envelope', message: 'Yerel kayıt V3 değil.', retryable: false },
        };
      }
      try {
        const cloud = await fetchRemote(agentId).catch(() => null);
        const baseRevision = cloud
          ? Math.max(0, Number(cloud.revision) || 0)
          : Math.max(0, Number(local.revision) || 0);
        return await commitState(agentId, { ...local, ownerAgentId: agentId }, baseRevision);
      } catch (error) {
        return {
          status: 'error',
          revision: Math.max(0, Number(local.revision) || 0),
          error: classifySyncError(error),
        };
      }
    },

    async resolveConflict(agentId, choice) {
      const active = pending;
      const local = current();
      if (!active || active.agentId !== agentId) {
        return {
          status: 'error',
          revision: Math.max(0, Number(local.revision) || 0),
          error: { code: 'unknown', message: 'Bekleyen bir çakışma yok.', retryable: false },
        };
      }

      if (choice === 'later') {
        // Yerel kalır; hiçbir yazma yapılmaz. Çağıran taraf senkronu erteler.
        return { status: 'up-to-date', revision: Math.max(0, Number(local.revision) || 0) };
      }

      pending = null;
      try {
        if (choice === 'cloud') {
          return applyDownload(agentId, active.cloud);
        }

        const baseRevision = Math.max(0, Number(active.cloud.revision) || 0);
        if (choice === 'merge') {
          const merged = mergeForks(local, active.cloud.payload, now());
          // `mergeForks` revizyonu artırmaz; commit yanıtı nihai revizyonu verir.
          return await commitState(agentId, merged, baseRevision);
        }

        // 'local': kullanıcı bu cihazın verisini seçti → sunucu revizyonunun
        // üstüne YENİ revizyon olarak yazılır. Hesap kimliği hedef hesaba çekilir.
        return await commitState(agentId, { ...local, ownerAgentId: agentId }, baseRevision);
      } catch (error) {
        return {
          status: 'error',
          revision: Math.max(0, Number(local.revision) || 0),
          error: classifySyncError(error),
        };
      }
    },

    getPendingConflict() {
      return pending ? buildConflict('both-changed', current(), pending.cloud) : null;
    },

    hasPendingConflict() {
      return pending !== null;
    },

    clearPendingConflict() {
      pending = null;
    },
  };
}

/* =========================================================================
   SUPABASE İSTEMCİSİ (RPC adları/parametreleri SQL ile birebir)
   ========================================================================= */

/** supabase-js `storage.from(bucket).remove()` yüzeyinin motorun ihtiyaç duyduğu kadar. */
export interface SyncStorageBucket {
  remove(paths: string[]): PromiseLike<{ data?: unknown; error: unknown }>;
}

/** supabase-js istemcisinin motorun ihtiyaç duyduğu kadar. */
export interface SyncRpcClient {
  rpc(name: string, params: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
  storage?: {
    from(bucket: string): SyncStorageBucket;
  };
}

interface RawCloudRecord {
  revision?: unknown;
  save_hash?: unknown;
  payload?: unknown;
  updated_at?: unknown;
}

/** Eski Storage arşivi için geçici seçenekler (Supabase + test enjeksiyonu). */
export interface SupabaseSyncClientOptions {
  /** Örn. `https://<proje>.supabase.co`; verilmezse `VITE_SUPABASE_URL` kullanılır. */
  supabaseUrl?: string;
  /** Zarfın `deviceId`'si (mevcut cihaz). */
  deviceId?: string;
  /** Testlerde `fetch` enjeksiyonu. */
  fetchImpl?: typeof fetch;
}

/** `sinevia_saves` Storage bucket'ındaki eski arşivin public URL'i. */
export function legacyArchiveUrl(supabaseUrl: string, agentId: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/sinevia_saves/${encodeURIComponent(agentId)}.json`;
}

/**
 * Supabase RPC'lerini `SyncClient` arayüzüne bağlar.
 *
 * - `sync_get_state(p_agent_id)` → `{ revision, save_hash, payload, updated_at }` | null
 * - `sync_commit(p_agent_id, p_base_revision, p_device_id, p_save_hash, p_payload)`
 *   → `{ status: 'ok' | 'conflict', revision, ... }`
 *
 * TEK SEFERLİK ESKİ ARŞİV KÖPRÜSÜ: `app_saves` boşsa (RPC null) eski
 * `sinevia_saves/<agentId>.json` public arşivi `cache: 'no-store'` ile denenir.
 * Arşiv varsa V2/V3 yedeği `parseBackupPayload` ile çözülüp revision=0 sahte
 * bulut kaydı (`source: 'legacy-archive'`) olarak döner; motor normal karar
 * matrisini uygular ve commit ile app_saves'e taşır.
 * 404 → arşiv yok (normal ilk sync). 404 dışı ağ hatası → YAZMA YOK, retryable
 * hata. Aynı oturumda bir kez görülen arşiv yeniden çekilmez.
 */
export function createSupabaseSyncClient(
  client: SyncRpcClient,
  options: SupabaseSyncClientOptions = {},
): SyncClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const archiveTried = new Set<string>();
  const importedAgents = new Set<string>();

  function normalizeCloudRecord(data: unknown): CloudSaveRecord | null {
    if (!data) return null;
    const record = (Array.isArray(data) ? data[0] : data) as RawCloudRecord | null;
    if (!record || typeof record !== 'object' || Object.keys(record).length === 0) return null;
    const payload = record.payload;
    if (!isSyncPayload(payload)) {
      throw new SyncEngineError('invalid-envelope', 'Bulut kaydı geçersiz V3 gövdesi taşıyor.');
    }
    const revision = Math.max(0, Number(record.revision) || 0);
    return {
      revision,
      updatedAt: typeof record.updated_at === 'string' ? record.updated_at : payload.updatedAt ?? '',
      deviceId: payload.deviceId ?? '',
      saveHash: typeof record.save_hash === 'string' && record.save_hash.length > 0
        ? record.save_hash
        : makeSaveHash(payload),
      payload,
      source: 'app_saves',
    };
  }

  async function fetchLegacyArchive(agentId: string): Promise<CloudSaveRecord | null> {
    const baseUrl = options.supabaseUrl
      || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : '')
      || '';
    if (!baseUrl) {
      throw new SyncEngineError('network', 'Eski bulut arşivi için Supabase URL bulunamadı.', true);
    }

    let response: Response;
    try {
      response = await fetchImpl(legacyArchiveUrl(baseUrl, agentId), { cache: 'no-store' });
    } catch (error) {
      throw new SyncEngineError(
        'network',
        `Eski bulut arşivi alınamadı (ağ): ${messageOf(error) || 'fetch failed'}`,
        true,
      );
    }

    const body = await response.text();
    if (!response.ok) {
      // Supabase Storage eksik nesnede 404 veya 400 + not_found dönebilir.
      if (response.status === 404 || /not[_\s-]?found/i.test(body)) return null;
      throw new SyncEngineError(
        'network',
        `Eski bulut arşivi alınamadı (HTTP ${response.status}).`,
        true,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new SyncEngineError('invalid-envelope', 'Eski bulut arşivi geçersiz JSON taşıyor.', false);
    }

    let payload: AppStateV3;
    try {
      payload = parseBackupPayload(parsed).state;
    } catch {
      throw new SyncEngineError('invalid-envelope', 'Eski bulut arşivi V3 gövdesine çevrilemedi.', false);
    }
    if (!isSyncPayload(payload)) {
      throw new SyncEngineError('invalid-envelope', 'Eski bulut arşivi geçerli V3 gövdesi taşımıyor.', false);
    }

    const state: AppStateV3 = {
      ...payload,
      schemaVersion: SAVE_SCHEMA_VERSION,
      ownerAgentId: agentId,
      revision: 0,
      // Eski arşiv bu cihaz tarafından yazılmış sayılmaz; aksi halde aynı-cihaz
      // otomatik çözümü gerçek bir çakışmayı sessizce ezebilir.
      deviceId: payload.deviceId || '',
      updatedAt: payload.updatedAt || new Date().toISOString(),
    };
    return {
      revision: 0,
      updatedAt: state.updatedAt,
      deviceId: state.deviceId,
      saveHash: makeSaveHash(state),
      payload: state,
      source: 'legacy-archive',
    };
  }

  return {
    async getRemote(agentId) {
      const { data, error } = await client.rpc(SYNC_RPC.getState, { p_agent_id: agentId });
      if (error) throw error;
      const record = normalizeCloudRecord(data);
      if (record) return record;

      // app_saves boş: aynı oturumda arşiv zaten denenmiş/içe aktarılmışsa tekrar yok.
      if (archiveTried.has(agentId) || importedAgents.has(agentId)) return null;
      const archive = await fetchLegacyArchive(agentId);
      archiveTried.add(agentId);
      return archive;
    },

    async commit(agentId, request) {
      const { data, error } = await client.rpc(SYNC_RPC.commit, {
        p_agent_id: agentId,
        p_base_revision: request.baseRevision,
        p_device_id: request.deviceId,
        p_save_hash: request.saveHash,
        p_payload: request.payload,
      });
      if (error) throw error;
      const record = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
      if (!record || typeof record !== 'object') {
        throw new SyncEngineError('invalid-envelope', 'sync_commit beklenen yanıtı döndürmedi.');
      }
      const revision = Math.max(0, Number(record.revision) || 0);
      if (record.status === 'ok') {
        // Arşivden gelen kayıt app_saves'e yazıldı: oturum boyunca arşiv tekrar okunmaz.
        if (archiveTried.has(agentId)) importedAgents.add(agentId);
        return {
          status: 'ok',
          revision,
          saveHash: typeof record.save_hash === 'string' ? record.save_hash : undefined,
          updatedAt: typeof record.updated_at === 'string' ? record.updated_at : undefined,
        };
      }
      if (record.status === 'conflict') {
        return {
          status: 'conflict',
          revision,
          reason: typeof record.reason === 'string' ? record.reason : undefined,
        };
      }
      throw new SyncEngineError('server', `sync_commit bilinmeyen durum: ${String(record.status)}`, true);
    },

    async discardLegacyArchive(agentId) {
      // Storage nesnesi SQL'den DEĞİL, Storage API'sinden silinmeli; aksi halde
      // fiziksel dosya S3'te kalır (orphan) ve kota şişer. RLS politikası
      // `sinevia_saves/<agentId>.json` silmesine yalnız o ajanın token'ıyla izin verir.
      const bucket = client.storage?.from('sinevia_saves');
      if (!bucket) return;
      const { error } = await bucket.remove([`${agentId}.json`]);
      if (error) throw error;
    },
  };
}
