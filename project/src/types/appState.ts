import type {
  AchievementProgress,
  ActiveContract,
  ActiveEffect,
  CoinTx,
  Collection,
  ContractHistoryEntry,
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
   UYGULAMA DURUMU (V3) — TEK KANONİK YEREL KAYIT
   -------------------------------------------------------------------------
   Bu dosya SADECE tipleri tanımlar (davranış yok). V3'e geçişin amacı:

   1) XP artık TÜRETİLMEZ. Tek kaynak `xpEvents` defteridir (ledger).
      `totalXp = sum(xpEvents.amount)` — başka hiçbir alan (başarım listesi,
      görev listesi, bonusXp, xpBaseline, bulut toplamı) XP'yi beslemez.
   2) Yerel kayıt sürüm numarası taşır (`schemaVersion`) ve sunucu revizyonu
      ile karşılaştırılabilir (`revision`). Senkron protokolü için bkz.
      `src/types/sync.ts` ve `docs/sync-contract.md`.

   GÖÇ (migration) NOTU:
   V2 durumu (ExtendedAppData + 'sinevia-quests-v1' + 'sinevia-tutorial-v1'
   + 'sinevia-academy-ui-v1') düz alanlar halinde bu tipe taşınır. Eski
   türetilmiş XP alanları (`totalXp`, `xp`, `bonusXp`, `xpBaseline`) BİLEREK
   bu tipte yoktur; göç sırasında tek seferlik `xpEvents` kayıtlarına çevrilir
   (kaynak: 'legacy' / 'legacy-cloud' / 'adjustment'). Eşlenemeyen eski
   alanlar `legacy` torbasına konur — böylece hiçbir veri sessizce kaybolmaz.
   ========================================================================= */

/** XP defteri kaydının kaynağı. Yeni kaynak eklemek şema değişikliğidir. */
export type XpEventSource =
  /** Başarım kademesi açıldı (sourceId = `${achievementId}:${tier}`). */
  | 'achievement'
  /** Görev tamamlandı (sourceId = questId). */
  | 'quest'
  /** Sözleşme (contract) tamamlandı (sourceId = instanceId). */
  | 'contract'
  /** Pazar alışverişi / dönüşüm (sourceId = coinTx.refId). */
  | 'market'
  /** Sistem ödülü: karşılama, streak, telafi (sourceId = sistem anahtarı). */
  | 'system'
  /** V2 yerel durumundan devralınan toplam XP. */
  | 'legacy'
  /** Bulut arşivinden devralınan toplam XP. */
  | 'legacy-cloud'
  /** Elle yapılan düzeltme (pozitif veya negatif olabilir). */
  | 'adjustment';

/**
 * Tek bir XP hareketi. Defter APPEND-ONLY'dir; silme/düzenleme yerine
 * karşı kayıt ('adjustment') yazılır.
 *
 * `amount = Math.round(base * multiplier)` — yuvarlama kuralı burada sabittir.
 */
export interface XpEvent {
  /** UUID benzeri tekil kayıt kimliği (idempotency için ASIL anahtar değil). */
  id: string;
  source: XpEventSource;
  /**
   * Kaynağa özgü tekil anahtar. İdempotency `(source, sourceId)` çifti ile
   * sağlanır: aynı çiftten ikinci kayıt YAZILMAZ.
   * Örnek: achievement → 'first_watch:gold', quest → 'daily_watch_3'.
   */
  sourceId: string;
  /** İnsan okur etiket (toast / geçmiş listesi için). */
  label: string;
  /** Çarpan uygulanmadan önceki taban XP. Negatif olabilir (düzeltme). */
  base: number;
  /** Etkinlik çarpanı (streak, etkinlik vb.). Varsayılan 1. */
  multiplier: number;
  /** Deftere yazılan nihai değer: Math.round(base * multiplier). */
  amount: number;
  /** ISO 8601 zaman damgası. */
  createdAt: string;
  /** Kaynağa özgü serbest ek veri (örn. { tier: 'gold' }); hash'e girer. */
  meta?: Record<string, unknown>;
}

/** Defterin türetilmiş özeti (asla kalıcı yazılmaz, her zaman yeniden hesaplanır). */
export interface XpLedgerSummary {
  totalXp: number;
  count: number;
  /** Kaynak başına toplam XP; tüm kaynaklar 0 ile başlar. */
  bySource: Record<XpEventSource, number>;
}

/** Görev deposunun kalıcı şekli (V2 'sinevia-quests-v1' ile aynı). */
export interface QuestStateV3 {
  activeQuestId: string | null;
  questAcceptedAt: number | null;
  questRejects: number;
  questCooldownUntil: number | null;
  /** Tamamlanan görev kimlikleri — V3'te XP kaynağı DEĞİL, yalnız kayıt. */
  completedQuests: string[];
  activeBadgeId: string | null;
  isPenaltyEnabled: boolean;
  activeContract?: ActiveContract | null;
  contractHistory?: ContractHistoryEntry[];
  freeDailyUsage?: { date: string; count: number };
  freePinnedUsage?: { week: string; contractId: string };
}

/** Eğitim (tutorial) ilerlemesi (V2 'sinevia-tutorial-v1'). */
export interface TutorialProgressV3 {
  welcomeDone: boolean;
  welcomeStep: number;
  completed: string[];
  pageVisited: string[];
  modalSeen: string[];
  academyStarted: boolean;
  academyStep: number;
  academyDone: string[];
  events: string[];
  eventCounts: Record<string, number>;
}

/** Akademi arayüz tercihleri (V2 'sinevia-academy-ui-v1', gevşek tutulur). */
export interface AcademyProgressV3 {
  started: boolean;
  step: number;
  /** Tamamlanan akademi dersleri. */
  done: string[];
  /** Arayüz tarafı serbest alanlar (eski sürümlerden gelen bilinmeyenler). */
  ui?: Record<string, unknown>;
}

/** Kullanıcı/görünüm tercihleri — site verisinden ayrılmış ayar bloğu. */
export interface AppSettingsV3 {
  theme: string;
  nickname?: string;
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
  altWatchTemplate?: string;
  externalActions?: ExternalActionTemplate[];
  reviewTags?: string[];
  tagSentiments?: Record<string, 'positive' | 'negative'>;
}

/** V3'te artık kullanılmayan, göçte `xpEvents`'e çevrilen V2 XP alanları. */
export interface LegacyXpFields {
  xp?: number;
  level?: number;
  totalXp?: number;
  bonusXp?: number;
  xpBaseline?: number;
}

/**
 * V3 KANONİK YEREL KAYIT.
 *
 * Bu nesne "doğru"nun yerel kopyasıdır (canonical local record). Bulut kopyası
 * `SaveEnvelope.payload` içinde aynı şekilde taşınır; `saveHash` bu gövdenin
 * deterministik parmak izidir.
 *
 * `updatedAt` her içerik değişiminde yenilenir; `revision` ise SENKRON
 * commit'i başarılı olduğunda sunucudan gelen değere eşitlenir (bkz.
 * `src/lib/syncContract.ts` revizyon kuralları).
 */
export interface AppStateV3 {
  /** Şema sürümü — sabit 3. */
  schemaVersion: 3;
  /** Kaydın sahibi (SNV-xxxx-xxxx veya Supabase agent id); sahipsiz yerel kayıt null. */
  ownerAgentId: string | null;
  /** Sunucu otoritesindeki revizyon; commit başarılı olduğunda güncellenir. */
  revision: number;
  /** Son içerik değişikliğinin ISO zaman damgası. */
  updatedAt: string;
  /** Kaydı en son yazan cihaz kimliği (göç/telemetri için). */
  deviceId: string;
  /** XP'nin TEK kaynağı. totalXp türetilir: sum(amount). */
  xpEvents: XpEvent[];

  /* ---------------- Kütüphane ---------------- */
  movies: Movie[];
  series: Series[];
  collections: Collection[];
  history: WatchHistoryItem[];
  genres: string[];
  /** Kaldırılan dizi başlıkları (Eksikleri Bul telafisi). */
  removedSeriesTitles: string[];
  criteria: RatingCriterion[];
  showcase: {
    id: string;
    title: string;
    type: 'movie' | 'series';
    posterUrl?: string | null;
    year?: string;
    rating?: number | null;
  }[];

  /* ---------------- Oyunlaştırma (XP hariç) ---------------- */
  achievements: AchievementProgress[];
  quests: QuestStateV3;
  coins: number;
  coinLedger: CoinTx[];
  inventory: InventoryEntry[];
  equipped: EquippedItems;
  activeEffects: ActiveEffect[];
  perks: string[];
  marketStats?: MarketStats;
  pinnedContract?: { week: string; contractId: string } | null;
  marketIntroSeen?: boolean;
  marketRerollNonce?: number;
  marketDailyNonce?: number;
  marketWeeklyNonce?: number;
  dailyStreak: number;
  dailyStreakDate: string | null;
  lastWatchDate: string | null;
  totalDuelsCompleted?: number;
  giantSlayerWins?: number;

  /* ---------------- Planlama ---------------- */
  weeklyPlan: WeeklyPlanItem[];
  externalActions: ExternalActionTemplate[];

  /* ---------------- Eğitim ---------------- */
  tutorial: TutorialProgressV3;
  academy: AcademyProgressV3;

  /* ---------------- Ayarlar ---------------- */
  settings: AppSettingsV3;

  /* ---------------- Geçici / eşitlenmeyen ---------------- */
  /** Yalnız yerel: son bulut senkronu (hash'e girmez). */
  lastCloudSync?: number;
  /** Yalnız yerel: AI sohbet geçmişi (hash'e girmez, buluta yazılmaz). */
  aiChatHistory?: { id: string; sender: 'user' | 'ai'; text: string; timestamp: number; actionItems?: unknown[] }[];

  /** Eşlenemeyen eski alanlar — göçte olduğu gibi korunur. */
  legacy?: Record<string, unknown>;
}
