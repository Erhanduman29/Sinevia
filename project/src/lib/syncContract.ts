import { levelFromXp } from './xp';
import type { AppStateV3 } from '../types/appState';
import { SAVE_SCHEMA_VERSION } from '../types/sync';
import type { SaveEnvelope, SyncSnapshotSummary } from '../types/sync';
// Defter yardımcıları TEK yerde (src/lib/xpLedger.ts) tanımlıdır; buradan
// yeniden dışa aktarılır ki sözleşme tüketicileri aynı davranışı görsün.
import { summarizeXpLedger } from './xpLedger';
export { XP_EVENT_SOURCES, xpEventKey, hasXpEvent, summarizeXpLedger } from './xpLedger';

/* =========================================================================
   SENKRON SÖZLEŞMESİ — SAF YARDIMCILAR (React YOK)
   -------------------------------------------------------------------------
   Bu modül bilinçli olarak yan etkisizdir: storage, ağ, React, tarih/rastgele
   üretimi YAPMAZ. `updatedAt`/`deviceId` gibi değerler çağırandan gelir.
   Böylece aynı girdi her zaman aynı çıktıyı verir ve test edilebilir.

   REVİZYON KURALLARI (tek doğru kaynak: docs/sync-contract.md)
   -----------------------------------------------------------
   1. Sunucu revizyonu OTORİTEDİR. İstemci asla kendi kafasına göre revizyon
      "artırmaz"; commit yanıtındaki değeri yazar. `nextRevision` YALNIZ
      sunucusuz/yerel modda ve/or commit sonrası yerel sayaç için kullanılır.
   2. Commit yalnızca `baseRevision === sunucu revizyonu` iken yapılabilir.
      Sunucu tarafı bunu atomik olarak doğrular (tek UPDATE ... WHERE revision).
   3. Uyuşmazlık = çakışma. Karar `ConflictChoice` ile verilir; sessizce
      üzerine YAZILMAZ.
   4. `saveHash` aynıysa yükleme atlanır (`up-to-date`).
   ========================================================================= */

/**
 * Anahtar sırasından bağımsız, deterministik JSON üretir.
 *
 * Kurallar:
 *  - nesne anahtarları sözlüksel sıralanır,
 *  - `undefined` değerli anahtarlar (ve `undefined` dizi elemanları) atlanır,
 *    dizi elemanları `null` yazılır (JSON.stringify ile aynı davranış),
 *  - `NaN` / `Infinity` → `null` (JSON.stringify ile aynı).
 */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? 'null' : stableStringify(item))).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

/**
 * FNV-1a (32 bit) — kripto bağımlılığı YOK, tarayıcı/Node aynı sonucu verir.
 * Çıktı: `fnv1a-<8 hex>-<uzunluk base36>`. Uzunluk eklemek kısa-girdi
 * çakışmalarını pratikte ortadan kaldırır.
 */
export function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a-${hash.toString(16).padStart(8, '0')}-${input.length.toString(36)}`;
}

/**
 * Gövde için kararlı parmak izi. Boşluk/sıralama farkı hash'i değiştirmez,
 * içerik farkı (sayı, string, dizi sırası) değiştirir.
 */
export function makeSaveHash(payload: unknown): string {
  return fnv1aHash(stableStringify(payload));
}

/** İçerik hash'inde sayılmayan, cihaz/oturum bazlı veya türetilmiş alanlar. */
const CONTENT_HASH_EXCLUDED_KEYS = new Set([
  'schemaVersion',
  'ownerAgentId',
  'revision',
  'updatedAt',
  'deviceId',
  'lastCloudSync',
  'aiChatHistory',
  'legacy',
]);

/**
 * Yalnızca GERÇEK içeriğin parmak izi.
 *
 * `makeSaveHash` tüm gövdeyi (updatedAt/revision/deviceId dahil) hash'ler.
 * İki cihaz aynı kütüphaneye sahip olsa bile bu alanlar farklı olduğu için
 * gereksiz "çakışma" üretilebiliyordu. Bu hash yalnız kullanıcı verisini
 * (filmler, geçmiş, XP, görevler, ayarlar vb.) karşılaştırır.
 */
export function makeContentHash(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return makeSaveHash(payload);
  }
  const content: Record<string, unknown> = { ...(payload as Record<string, unknown>) };
  for (const key of CONTENT_HASH_EXCLUDED_KEYS) delete content[key];
  return makeSaveHash(content);
}

/** İki hash aynı kaydı mı temsil ediyor? Boş/eksik hash "aynı" SAYILMAZ. */
export function sameSaveHash(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length === 0 || b.length === 0) return false;
  return a === b;
}

/** Sonraki yerel revizyon: geçersiz/negatif değerlerde 1'e döner. */
export function nextRevision(revision: number): number {
  if (!Number.isFinite(revision) || revision < 0) return 1;
  return Math.floor(revision) + 1;
}

/**
 * Bulut revizyonu yerelden ileride mi? (yalnız indirme yönünde güvenli)
 * Eşitlik "zaten güncel" demektir; asla `true` dönmemeli.
 */
export function canFastForward(localRevision: number, cloudRevision: number): boolean {
  if (!Number.isFinite(localRevision) || !Number.isFinite(cloudRevision)) return false;
  if (localRevision < 0 || cloudRevision < 0) return false;
  return cloudRevision > localRevision;
}

export interface BuildSaveEnvelopeInput {
  payload: AppStateV3;
  ownerAgentId: string | null;
  /** Sunucunun atadığı (veya yerel moddaki) revizyon. */
  revision: number;
  deviceId: string;
  /** Verilmezse `payload.updatedAt` kullanılır. */
  updatedAt?: string;
}

/**
 * Zarfı kurar. `saveHash` DAİMA `payload`'dan hesaplanır; çağıranın verdiği
 * bir hash kabul edilmez (aksi halde istemci/sunucu hash'i ayrışabilir).
 */
export function buildSaveEnvelope(input: BuildSaveEnvelopeInput): SaveEnvelope {
  const { payload } = input;
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    ownerAgentId: input.ownerAgentId,
    revision: Number.isFinite(input.revision) ? Math.max(0, Math.floor(input.revision)) : 0,
    updatedAt: input.updatedAt ?? payload.updatedAt,
    deviceId: input.deviceId,
    saveHash: makeSaveHash(payload),
    payload,
  };
}

/**
 * Çakışma diyaloğu için hafif özet. Sayımlar "içerik" odaklıdır:
 *  - movies / series: kayıt sayısı,
 *  - achievements: en az bir kademesi açılmış başarım sayısı,
 *  - quests: completedQuests uzunluğu,
 *  - totalXp: defter toplamı, level: ondan türetilir.
 */
export function buildSyncSummary(state: AppStateV3): SyncSnapshotSummary {
  const events = Array.isArray(state.xpEvents) ? state.xpEvents : [];
  const totalXp = summarizeXpLedger(events).totalXp;
  const achievements = Array.isArray(state.achievements) ? state.achievements : [];
  const completedQuests = state.quests && Array.isArray(state.quests.completedQuests)
    ? state.quests.completedQuests
    : [];

  return {
    totalXp,
    level: levelFromXp(totalXp).level,
    movies: Array.isArray(state.movies) ? state.movies.length : 0,
    series: Array.isArray(state.series) ? state.series.length : 0,
    achievements: achievements.filter((item) => Array.isArray(item?.unlockedTiers) && item.unlockedTiers.length > 0).length,
    quests: completedQuests.length,
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : '',
  };
}
