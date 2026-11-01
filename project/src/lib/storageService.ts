/**
 * storageService — Hibrit kalıcılık katmanı.
 *
 * Amaç:
 *  - Ana kütüphane verisini (movies/series/history...) IndexedDB'de TUT (localStorage 5MB sınırından kurtul).
 *  - localStorage'da SADECE küçük bir "boot anlık görüntüsü" bırak (theme/agentId/recoveryKey...).
 *    Böylece açılışta tema titremesi (FOUC) olmaz, kimlik anında hazır olur.
 *  - Yazmaları asenkron bir kuyrukla sıraya al (ana thread'i bloklama).
 *
 * Sıfır bağımlılık: kendi mini IndexedDB wrapper'ımız. IndexedDB yoksa (ör. özel sekme)
 * sessizce localStorage'a düşer — veri kaybı olmaz, sadece 5MB sınırı geri gelir.
 */

import {
  buildBootSnapshot,
  isAppStateV3,
  isBootSnapshotV3,
  isLegacyAppState,
  migrateLegacyToV3,
} from './localStateV3';
import { BACKUP_EXTRA_KEYS } from './appBackup';
import type { AppStateV3 } from '../types/appState';

const DB_NAME = 'sinevia-db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

/**
 * KANONİK YEREL KAYIT ANAHTARI.
 *
 * - IndexedDB `kv/sinevia-v1`  → TAM `AppStateV3` (schemaVersion 3).
 * - localStorage `sinevia-v1`  → YALNIZ küçük boot anlık görüntüsü
 *   (`buildBootSnapshot`). Tam veri localStorage'a ASLA yazılmaz.
 *
 * Aynı anahtar adı iki farklı depoda farklı içerik taşır; bu bilinçlidir
 * (AppContext geçiş döneminde localStorage'dan lastCloudSync okuyor).
 */
export const STATE_STORAGE_KEY = 'sinevia-v1';

/** localStorage'daki tam kayıt için V2 anahtarı (göç girdisi). */
export const LEGACY_STATE_STORAGE_KEY = STATE_STORAGE_KEY;

/** localStorage'da tutulacak küçük boot alanları (FOUC + anında kimlik için). */
export const BOOT_SNAPSHOT_KEYS = [
  'theme', 'agentId', 'recoveryKey', 'nickname',
  'lastCloudSync', 'level', 'totalXp', 'xp', 'dailyStreak',
  // Başarımlar XP'nin tek kaynağıdır. Snapshot'ta yoksa açılışta XP/level sıfıra
  // düşüp (kısa süreli "1. seviye" parlaması) yanlış veri buluta yazılabiliyordu.
  'achievements',
  'notificationsEnabled', 'notifyMessages', 'notifyFriendRequests', 'notifyLists',
  // Görsel tercihler açılışta hemen uygulanmalı (aksi halde ilk karelerde tam animasyon oynar).
  'reducedMotion', 'fastCelebrations',
] as const;

/** localStorage'a yazarken büyük kütüphaneyi ATLA (quota hatası + 5MB sınırı önlemek için). */
const LOCAL_SNAPSHOT_KEY = STATE_STORAGE_KEY;

/**
 * Ana IDB kaydının yanında tutulan tam yedek. Ana kayıt bozulur/silinirse
 * (güncelleme, tarayıcı kesintisi, yarım yazma) kütüphane buradan kurtarılır.
 */
export const BACKUP_STORAGE_KEY = 'sinevia-v1-backup';

/** Bir kaydın gerçek kütüphane verisi taşıyıp taşımadığını anlar (boot snapshot değil). */
export function isFullAppRecord(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.movies) && Array.isArray(record.series);
}

/**
 * "Önceki hesap" yedeği: Taşıma Kodu ile yeni hesap yüklendiğinde bu cihazdaki
 * yerel hesap buraya saklanır. Yeni davranış: çıkışta TÜM yerel veri silinir,
 * bu yedek de dahil — eski hesapla oturum otomatik geri gelmez.
 */
export const PREV_ACCOUNT_KEY = 'sinevia_prev_account';

/** Tüm yerel verinin silindiğini işaretleyen bayrak (init bu bayrağı görüp sıfırdan başlar). */
export const ZERO_RESET_KEY = 'sinevia_zero_reset';

let dbPromise: Promise<IDBDatabase | null> | null = null;

/** Depolama yazımı başarısız olduğunda uygulamayı haberdar etmek için basit köprü. */
export type StorageErrorKind = 'idb' | 'local';
let storageErrorHandler: ((kind: StorageErrorKind) => void) | null = null;

export function setStorageErrorHandler(handler: ((kind: StorageErrorKind) => void) | null): void {
  storageErrorHandler = handler;
}

function reportStorageError(kind: StorageErrorKind): void {
  try {
    storageErrorHandler?.(kind);
  } catch {
    /* hata bildirimi de hata vermesin */
  }
}

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  let failedSync = false;
  const promise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') { failedSync = true; return resolve(null); }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      // Başarısız açılış CACHE'LENMEMELİ: aksi halde tek bir geçici hata
      // (başka sekme DB'yi tutuyor / tarayıcı kesintisi) tüm oturum boyunca
      // IndexedDB'yi devre dışı bırakır ve veri kaybı riski doğurur.
      const fail = () => {
        if (dbPromise === promise) dbPromise = null;
        resolve(null);
      };
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = fail;
      // Bazı tarayıcılar bloke eder (çok hızlı art arda open vb.) → localStorage'a düş.
      req.onblocked = fail;
    } catch {
      failedSync = true;
      resolve(null);
    }
  });
  dbPromise = failedSync ? null : promise;
  return promise;
}

/** IDB'den oku. Yoksa/hata → null. */
export async function idbGet<T = unknown>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** IDB'ye yaz. IDB yoksa → false (çağıran taraf localStorage'a düşebilir). */
export async function idbSet(key: string, value: unknown): Promise<boolean> {
  const db = await openDb();
  if (!db) {
    reportStorageError('idb');
    return false;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => { reportStorageError('idb'); resolve(false); };
      tx.onabort = () => { reportStorageError('idb'); resolve(false); };
    } catch {
      reportStorageError('idb');
      resolve(false);
    }
  });
}

export async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Boot anlık görüntüsü: localStorage'da sadece küçük alanları tut (büyük kütüphaneyi yazma). */
export function writeBootSnapshot(data: Record<string, unknown>): boolean {
  try {
    const snapshot: Record<string, unknown> = {};
    for (const k of BOOT_SNAPSHOT_KEYS) {
      if (data[k] !== undefined) snapshot[k] = data[k];
    }
    let serialized = JSON.stringify(snapshot);
    // Güvenlik kemeri: beklenmedik büyüme (örn. şişmiş achievements) localStorage'ı
    // doldurmasın. Özet yeterli — tam veri zaten IndexedDB'de.
    if (serialized.length > MAX_BOOT_SNAPSHOT_BYTES && 'achievements' in snapshot) {
      delete snapshot.achievements;
      serialized = JSON.stringify(snapshot);
    }
    localStorage.setItem(LOCAL_SNAPSHOT_KEY, serialized);
    return true;
  } catch {
    // Kota dolu / localStorage kapalı: sessiz kalmak yerine uygulamaya haber ver.
    reportStorageError('local');
    return false;
  }
}

/** localStorage'dan ilk açılış anlık görüntüsünü oku (küçük). */
export function readBootSnapshot(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(LOCAL_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Eski (tam) kayıt da gelebilir; onu da döndür, çağıran ayıklar.
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/* =========================================================================
   V3 KANONİK KAYIT API'Sİ
   -------------------------------------------------------------------------
   loadStateV3 / saveStateV3 / readLegacyState / migrateStoredStateToV3 /
   clearStateV3. Orion AppContext entegrasyonunda bu API'yi kullanmalıdır.
   ========================================================================= */

export interface SaveStateV3Options {
  /** Debounce (varsayılan 600ms — eski yazma kuyruğuyla aynı). */
  delayMs?: number;
  /** Tam yedeği ('sinevia-v1-backup') da yaz. */
  backup?: boolean;
}

/** localStorage'daki boot anlık görüntüsünün üst sınırı (güvenlik kemeri). */
export const MAX_BOOT_SNAPSHOT_BYTES = 32 * 1024;

/**
 * AppStateV3 → küçük boot anlık görüntüsü. Kütüphane ve XP defteri yazılmaz;
 * yalnız tema/kimlik/seviye/özet alanları (bkz. `buildBootSnapshot`).
 */
export function writeBootSnapshotFromState(state: AppStateV3): boolean {
  try {
    localStorage.setItem(LOCAL_SNAPSHOT_KEY, JSON.stringify(buildBootSnapshot(state)));
    return true;
  } catch {
    reportStorageError('local');
    return false;
  }
}

/** Boot anlık görüntüsünü V3 biçiminde oku. Eski/tam kayıt → null. */
export function readBootSnapshotV3(): ReturnType<typeof buildBootSnapshot> | null {
  const raw = readBootSnapshot();
  return isBootSnapshotV3(raw) ? raw : null;
}

/**
 * Ana kayıt / yedek arasından kullanılabilir V3 kaydını seçer (SAF).
 * Ana kayıt bozuk/silinmişse (güncelleme, yarım yazma, kota) yedek kurtarır.
 */
export function pickStoredStateV3(
  main: unknown,
  backup?: unknown,
): { state: AppStateV3 | null; source: 'main' | 'backup' | null } {
  if (isAppStateV3(main)) return { state: main, source: 'main' };
  if (isAppStateV3(backup)) return { state: backup, source: 'backup' };
  return { state: null, source: null };
}

/**
 * IDB'deki kanonik kaydı oku. Ana kayıt V3 değilse (V2/boot/bozuk) yedeğe
 * ('sinevia-v1-backup') düşer. Hiçbiri yoksa null.
 */
export async function loadStateV3(
  key: string = STATE_STORAGE_KEY,
  options: { allowBackupFallback?: boolean } = {},
): Promise<AppStateV3 | null> {
  return (await loadStateV3WithSource(key, options)).state;
}

/** `loadStateV3` ile aynı, ancak kaydın hangi depodan geldiğini de bildirir. */
export async function loadStateV3WithSource(
  key: string = STATE_STORAGE_KEY,
  options: { allowBackupFallback?: boolean } = {},
): Promise<{ state: AppStateV3 | null; source: 'main' | 'backup' | null }> {
  const main = await idbGet(key);
  const allowBackup = options.allowBackupFallback !== false && key === STATE_STORAGE_KEY;
  const backup = allowBackup ? await idbGet(BACKUP_STORAGE_KEY) : null;
  return pickStoredStateV3(main, backup);
}

/**
 * Kanonik kaydı yaz: IDB ('sinevia-v1') + küçük boot snapshot.
 * Yazma kuyruğuna girer (debounce + coalesce); tam kayıt localStorage'a GİRMEZ.
 */
export function saveStateV3(state: AppStateV3, options: SaveStateV3Options = {}): void {
  if (!isAppStateV3(state)) {
    reportStorageError('idb');
    return;
  }
  const delay = options.delayMs ?? 600;
  writeQueue.set(STATE_STORAGE_KEY, state, delay);
  writeBootSnapshotFromState(state);
  if (options.backup) writeQueue.set(BACKUP_STORAGE_KEY, state, delay);
}

/** Beklemeden yaz (kapanış/hesap değişimi gibi kritik anlar için). */
export async function saveStateV3Immediate(
  state: AppStateV3,
  options: { backup?: boolean } = {},
): Promise<boolean> {
  if (!isAppStateV3(state)) return false;
  try { await writeQueue.flush(); } catch { /* devam */ }
  writeBootSnapshotFromState(state);
  const ok = await idbSet(STATE_STORAGE_KEY, state);
  if (options.backup) await idbSet(BACKUP_STORAGE_KEY, state);
  return ok;
}

/** Tam yedeği ('sinevia-v1-backup') yaz. */
export async function saveStateV3Backup(state: AppStateV3): Promise<boolean> {
  if (!isAppStateV3(state)) return false;
  return idbSet(BACKUP_STORAGE_KEY, state);
}

function readLocalJson(storageKey: string): unknown {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw == null) return undefined;
    try { return JSON.parse(raw); } catch { return raw; }
  } catch {
    return undefined;
  }
}

/**
 * V2 kalıntısını oku: önce IDB'deki eski tam kayıt, yoksa localStorage'daki
 * tam kayıt. Boot snapshot'ı (movies/series yok) asla "tam kayıt" sayılmaz.
 */
export async function readLegacyState(key: string = STATE_STORAGE_KEY): Promise<Record<string, unknown> | null> {
  const idbValue = await idbGet(key);
  if (isLegacyAppState(idbValue)) return idbValue;
  const localValue = readLocalJson(key);
  if (isLegacyAppState(localValue)) return localValue;
  return null;
}

/** localStorage'daki V2 ek durumları (tutorial/academy/sound/shortcuts). */
export function readLegacyExtras(): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  for (const [name, storageKey] of Object.entries(BACKUP_EXTRA_KEYS)) {
    const value = readLocalJson(storageKey);
    if (value !== undefined) extras[name] = value;
  }
  return extras;
}

export interface MigrateStoredStateResult {
  state: AppStateV3 | null;
  /** true → V2 kaydı okunup V3'e çevrildi ve IDB'ye yazıldı. */
  migrated: boolean;
}

/**
 * Cihazdaki V2 kaydını V3'e yükseltir. IDB zaten V3 ise hiçbir şey yapmaz.
 * Göç tamamlanınca localStorage'daki tam kayıt boot snapshot'a küçültülür.
 */
export async function migrateStoredStateToV3(options: {
  ownerAgentId?: string | null;
  deviceId?: string;
  updatedAt?: string;
  key?: string;
} = {}): Promise<MigrateStoredStateResult> {
  const key = options.key ?? STATE_STORAGE_KEY;
  const existing = await idbGet(key);
  if (isAppStateV3(existing)) return { state: existing, migrated: false };

  const legacy = isLegacyAppState(existing)
    ? existing
    : (await readLegacyState(key));
  if (!legacy) return { state: null, migrated: false };

  const state = migrateLegacyToV3({
    core: legacy,
    quests: readLocalJson('sinevia-quests-v1'),
    extras: readLegacyExtras(),
    ownerAgentId: options.ownerAgentId ?? (typeof legacy.agentId === 'string' ? legacy.agentId : null),
    deviceId: options.deviceId ?? (typeof legacy.deviceId === 'string' ? legacy.deviceId : ''),
    updatedAt: options.updatedAt,
  });

  try { await writeQueue.flush(); } catch { /* devam */ }
  const ok = await idbSet(key, state);
  if (!ok) return { state, migrated: false };
  writeBootSnapshotFromState(state);
  if (key === STATE_STORAGE_KEY) await idbSet(BACKUP_STORAGE_KEY, state);
  return { state, migrated: true };
}

/**
 * Cihazdaki V3 kaydını (ana + yedek) sil. localStorage'daki `sinevia*`
 * anahtarları ve V2 kalıntıları `clearAllLocalAppData` tarafından temizlenir.
 */
export async function clearStateV3(options: { keepBootSnapshot?: boolean } = {}): Promise<void> {
  try { await writeQueue.flush(); } catch { /* devam */ }
  await idbDel(STATE_STORAGE_KEY);
  await idbDel(BACKUP_STORAGE_KEY);
  if (!options.keepBootSnapshot) {
    try { localStorage.removeItem(LOCAL_SNAPSHOT_KEY); } catch { /* erişilemez */ }
  }
}

/**
 * Yazma kuyruğu: art arda gelen yazmaları birleştirir, tek bir asenkron yazmaya indirger.
 * Debounce (coalesce) + son-yazan-kazanır semantiği.
 */
class WriteQueue {
  private pending: Map<string, unknown> = new Map();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;

  set(key: string, value: unknown, delayMs = 250): void {
    this.pending.set(key, value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), delayMs);
  }

  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.flushing) return;
    this.flushing = true;
    try {
      const entries = Array.from(this.pending.entries());
      this.pending.clear();
      for (const [k, v] of entries) {
        await idbSet(k, v);
      }
    } finally {
      this.flushing = false;
      // Flush sırasında yeni yazım geldiyse onu da gönder.
      if (this.pending.size > 0) await this.flush();
    }
  }
}

export const writeQueue = new WriteQueue();

/**
 * Cihazdaki TÜM Sinevia verisini siler: bekleyen yazımları boşaltır,
 * `sinevia*` localStorage anahtarlarını ve IndexedDB kayıtlarını temizler.
 * En son sıfırlama bayrağını bırakır; böylece reload sırasında pagehide eski
 * veriyi geri yazsa bile uygulama temiz başlar.
 */
export async function clearAllLocalAppData(): Promise<void> {
  try { await writeQueue.flush(); } catch { /* yazma hatası temizliği engellemesin */ }

  try {
    const keys: string[] = [];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.toLowerCase().startsWith('sinevia')) keys.push(key);
    }
    for (const key of keys) {
      try { localStorage.removeItem(key); } catch { /* devam */ }
    }
  } catch { /* localStorage erişilemez */ }

  try { await idbDel(LOCAL_SNAPSHOT_KEY); } catch { /* devam */ }
  try { await idbDel(BACKUP_STORAGE_KEY); } catch { /* devam */ }
  try { await idbDel(PREV_ACCOUNT_KEY); } catch { /* devam */ }

  try { localStorage.setItem(ZERO_RESET_KEY, '1'); } catch { /* kota */ }
}

/**
 * Göç (migration): IDB'de V3 kaydı yoksa localStorage/IDB'deki V2 tam kaydını
 * `AppStateV3`'e yükseltip IDB'ye yazar. Başarılıysa localStorage yalnız küçük
 * boot anlık görüntüsüne küçültülür.
 * Dönen değer: IDB'de artık kanonik V3 kaydı var mı?
 */
export async function migrateToIdbIfNeeded(fullKey: string): Promise<boolean> {
  const existing = await idbGet(fullKey);
  // Yalnızca GERÇEK V3 kaydı yeterli. Boot snapshot'ı ana kayıt sanılırsa
  // hidrasyon onu yükler ve tüm kütüphane silinir.
  if (isAppStateV3(existing)) return true;

  const result = await migrateStoredStateToV3({ key: fullKey });
  if (!result.state) return false;
  return isAppStateV3(await idbGet(fullKey));
}

/** IndexedDB kullanılabilir mi? (özel sekme vb. durumlar için UI ipucu) */
export async function isIdbAvailable(): Promise<boolean> {
  const db = await openDb();
  return db != null;
}
