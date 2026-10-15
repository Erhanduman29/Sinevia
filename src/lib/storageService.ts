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
  'lastCloudSync', 'level', 'totalXp', 'dailyStreak',
] as const;

/** localStorage'a yazarken büyük kütüphaneyi ATLA (quota hatası + 5MB sınırı önlemek için). */
const LOCAL_SNAPSHOT_KEY = 'sinevia-v1';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      // Bazı tarayıcılar bloke eder (çok hızlı art arda open vb.) → localStorage'a düş.
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
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
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
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
export function writeBootSnapshot(data: Record<string, unknown>): void {
  try {
    const snapshot: Record<string, unknown> = {};
    for (const k of BOOT_SNAPSHOT_KEYS) {
      if (data[k] !== undefined) snapshot[k] = data[k];
    }
    localStorage.setItem(LOCAL_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    /* kota dolu / localStorage yok → sessiz geç */
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
 * Göç (migration): localStorage'da hâlâ TAM kütüphane varsa ve IDB boşsa, IDB'ye taşı.
 * Taşıma başarılıysa localStorage'ı küçült (sadece boot anlık görüntüsü kalsın).
 * Dönen değer: IDB'de artık ana kayıt var mı?
 */
export async function migrateToIdbIfNeeded(fullKey: string): Promise<boolean> {
  const existing = await idbGet(fullKey);
  if (existing != null) return true; // IDB zaten dolu

  let legacy: Record<string, unknown> | null = null;
  try {
    const raw = localStorage.getItem(fullKey);
    if (raw) legacy = JSON.parse(raw);
  } catch {
    legacy = null;
  }
  if (!legacy) return false;

  const ok = await idbSet(fullKey, legacy);
  if (ok) writeBootSnapshot(legacy); // localStorage'ı küçült
  return ok;
}

/** IndexedDB kullanılabilir mi? (özel sekme vb. durumlar için UI ipucu) */
export async function isIdbAvailable(): Promise<boolean> {
  const db = await openDb();
  return db != null;
}
