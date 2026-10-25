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

const DB_NAME = 'sinevia-db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

/** localStorage'da tutulacak küçük boot alanları (FOUC + anında kimlik için). */
export const BOOT_SNAPSHOT_KEYS = [
  'theme', 'agentId', 'recoveryKey', 'nickname',
  'lastCloudSync', 'level', 'totalXp', 'xp', 'bonusXp', 'dailyStreak',
  // Başarımlar XP'nin tek kaynağıdır. Snapshot'ta yoksa açılışta XP/level sıfıra
  // düşüp (kısa süreli "1. seviye" parlaması) yanlış veri buluta yazılabiliyordu.
  'achievements',
  'notificationsEnabled', 'notifyMessages', 'notifyFriendRequests', 'notifyLists',
  // Görsel tercihler açılışta hemen uygulanmalı (aksi halde ilk karelerde tam animasyon oynar).
  'reducedMotion', 'fastCelebrations',
] as const;

/** localStorage'a yazarken büyük kütüphaneyi ATLA (quota hatası + 5MB sınırı önlemek için). */
const LOCAL_SNAPSHOT_KEY = 'sinevia-v1';

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
    localStorage.setItem(LOCAL_SNAPSHOT_KEY, JSON.stringify(snapshot));
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
 * Göç (migration): localStorage'da hâlâ TAM kütüphane varsa ve IDB boşsa, IDB'ye taşı.
 * Taşıma başarılıysa localStorage'ı küçült (sadece boot anlık görüntüsü kalsın).
 * Dönen değer: IDB'de artık ana kayıt var mı?
 */
export async function migrateToIdbIfNeeded(fullKey: string): Promise<boolean> {
  const existing = await idbGet(fullKey);
  // Yalnızca GERÇEK kütüphane kaydı yeterli. Boot snapshot'ı (movies/series yok)
  // ana kayıt sanılırsa hidrasyon onu yükler ve tüm kütüphane silinir.
  if (isFullAppRecord(existing)) return true;

  let legacy: Record<string, unknown> | null = null;
  try {
    const raw = localStorage.getItem(fullKey);
    if (raw) legacy = JSON.parse(raw);
  } catch {
    legacy = null;
  }
  if (!legacy || !isFullAppRecord(legacy)) return false;

  const ok = await idbSet(fullKey, legacy);
  if (ok) writeBootSnapshot(legacy); // localStorage'ı küçült
  return ok;
}

/** IndexedDB kullanılabilir mi? (özel sekme vb. durumlar için UI ipucu) */
export async function isIdbAvailable(): Promise<boolean> {
  const db = await openDb();
  return db != null;
}
