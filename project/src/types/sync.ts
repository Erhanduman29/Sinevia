import type { AppStateV3 } from './appState';

/* =========================================================================
   SENKRON SÖZLEŞMESİ (V3) — SADECE TİPLER
   -------------------------------------------------------------------------
   Bulut yazımı `app_saves` tablosuna SaveEnvelope olarak gider. Sunucu
   revizyonu OTORİTEDİR; istemci yalnızca `baseRevision === server revision`
   iken commit edebilir. Kuralların tamamı: `docs/sync-contract.md`.
   ========================================================================= */

/** Bulut kaydının şema sürümü. istemci bunu görmezse kaydı reddeder. */
export const SAVE_SCHEMA_VERSION = 3 as const;

/**
 * Buluta yazılan/okunan zarf.
 *
 * `saveHash`, `payload`'ın deterministik JSON parmak izidir (bkz.
 * `makeSaveHash`). Zarf içeriği değişmedikçe hash değişmez → gereksiz
 * yüklemeler `sameSaveHash` ile elenir.
 */
export interface SaveEnvelope {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  ownerAgentId: string | null;
  /** Sunucunun atadığı revizyon (commit yanıtından gelir). */
  revision: number;
  /** Gövdenin üretildiği an (ISO 8601). */
  updatedAt: string;
  /** Gövdeyi üreten cihaz kimliği. */
  deviceId: string;
  /** `payload` için deterministik hash. */
  saveHash: string;
  payload: AppStateV3;
}

/** Çakışma diyaloglarında gösterilen hafif özet (tam payload taşımaz). */
export interface SyncSnapshotSummary {
  totalXp: number;
  level: number;
  movies: number;
  series: number;
  /** En az bir kademesi açılmış başarım sayısı. */
  achievements: number;
  /** Tamamlanmış görev sayısı. */
  quests: number;
  /** ISO 8601; bilinmiyorsa boş string. */
  updatedAt: string;
}

/** Çakışmanın nedeni. */
export type SyncConflictReason =
  /** Sunucu, istemcinin bilmediği bir revizyonda; ikisi de değişmiş. */
  | 'both-changed'
  /** Bulut kaydı başka bir agent'a ait (ownerAgentId uyuşmuyor). */
  | 'owner-mismatch'
  /** Yerel `baseRevision` sunucu revizyonuna eşit değil. */
  | 'revision-mismatch';

export interface SyncConflict {
  reason: SyncConflictReason;
  local: SyncSnapshotSummary;
  cloud: SyncSnapshotSummary;
  localRevision: number;
  cloudRevision: number;
}

/** Hata kodları — UI metni bu koda göre seçilir. */
export type SyncErrorCode =
  | 'network'
  | 'unauthorized'
  | 'invalid-envelope'
  | 'hash-mismatch'
  | 'server'
  | 'unknown';

export interface SyncError {
  code: SyncErrorCode;
  message: string;
  /** Aynı istek yeniden denenebilir mi (offline/5xx → true). */
  retryable?: boolean;
}

/**
 * Senkron sonucu — ayrık birlik (discriminated union).
 *
 * `revision` her durumda dolu: başarılıysa yeni sunucu revizyonu, çakışmada
 * yerel revizyon, hatada bilinen son revizyon. `envelope` yalnız indirme/
 * yükleme yapılan durumlarda döner.
 */
export type SyncResult =
  /** Commit başarılı, bulut güncellendi. */
  | { status: 'ok'; revision: number; envelope?: SaveEnvelope }
  /** Hash aynı: yazacak bir şey yok. */
  | { status: 'up-to-date'; revision: number; envelope?: SaveEnvelope }
  /** Bulut daha yeniydi, yerel kayıt bulutla değiştirildi. */
  | { status: 'cloud-loaded'; revision: number; envelope: SaveEnvelope }
  /** Yerel kayıt buluta yazıldı (ilk yükleme veya fast-forward). */
  | { status: 'local-uploaded'; revision: number; envelope: SaveEnvelope }
  /** Çakışma: kullanıcı kararı bekleniyor (`ConflictChoice`). */
  | { status: 'conflict'; revision: number; conflict: SyncConflict }
  /** Senkron yapılamadı; yerel kayıt korunur. */
  | { status: 'error'; revision: number; error: SyncError };

/** Çakışma diyaloğunda kullanıcının seçimi. */
export type ConflictChoice =
  /** Bulut kazanır: yerel kayıt bulutla değiştirilir. */
  | 'cloud'
  /** Yerel kazanır: sunucu revizyonunun üstüne yazılır (yeni revizyon). */
  | 'local'
  /** Birleştir: kütüphane + defter birleşimi yeni revizyon olarak yazılır. */
  | 'merge'
  /** Şimdilik karar verme: yerel kalır, senkron ertelenir. */
  | 'later';

/** `sync_get_state` RPC yanıtı. */
export interface CloudSaveRecord {
  revision: number;
  updatedAt: string;
  deviceId: string;
  saveHash: string;
  payload: AppStateV3;
  /**
   * Kaydın kaynağı. `legacy-archive`: app_saves boşken Storage'daki eski
   * `sinevia_saves/<agentId>.json` arşivinden tek seferlik içe aktarıldı.
   * Karar matrisi aynı çalışır; motor bu kaydı commit ederek app_saves'e taşır.
   */
  source?: 'app_saves' | 'legacy-archive';
}

/** `sync_commit` RPC isteği. Sunucu `baseRevision` eşleşmezse conflict döner. */
export interface CommitSaveRequest {
  ownerAgentId: string;
  /** İstemcinin gördüğü son sunucu revizyonu (0 = ilk yazım). */
  baseRevision: number;
  deviceId: string;
  saveHash: string;
  payload: AppStateV3;
}
