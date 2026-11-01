export interface WatchProvider {
  logoUrl: string;
  providerName: string;
  link?: string;
}

export interface RatingCriterion {
  id: string;
  name: string;
  weight: number;
  appliesTo: 'movie' | 'series' | 'both';
  genres: string[];
}

/** Yarım bırakma ilerlemesi (Sinematik Otopsi / DNF). */
export interface AbandonedProgress {
  unit: 'minute' | 'episode';
  value: number;
  season?: number;
}

/** Hızlı aksiyon köprüsü şablonu (Çoklu Hızlı Aksiyon Köprüsü). */
export interface ExternalActionTemplate {
  id: string;
  label: string;
  /** Placeholder'lar: {title} {title_slug} {title_plus} {year} {imdbId} {tmdbId} */
  urlTemplate: string;
  /** Lucide ikon adı (örn. ExternalLink, Play, Search). */
  icon: string;
  targetScope: 'all' | 'movie' | 'series';
  isPrimary?: boolean;
}

export interface Movie {
  id: string;
  title: string;
  year: string;
  genres: string[];
  collectionId: string | null;
  inPastQueue?: boolean;
  runtime?: number;
  startedAt?: string | null;
  actualRuntime?: number | null;
  /** Sinematik Otopsi: yarım bırakılan film. */
  abandoned?: boolean;
  abandonedAt?: string | null;
  abandonedProgress?: AbandonedProgress;
  autopsyReasons?: string[];
  autopsyNote?: string;
  /** Kör kalibrasyon: düello ile düzeltilen puan (rating'ten bağımsız sapma korunur). */
  calibratedScore?: number;
  duelCount?: number;
  duelWins?: number;
  posterUrl?: string;
  overview?: string;
  tmdbId?: number;
  customUrl?: string;
  imdbId?: string;
  watchProviders?: WatchProvider[];
  keywords?: string[];
  directors?: string[];
  cast?: string[];
  studios?: string[];
  originalLanguage?: string;
  watched: boolean;
  isPastWatch?: boolean;
  rating: number | null;
  detailedRating?: Record<string, number>;
  reviewTags?: string[];
  note: string;
  watchedAt: string | null;
  addedAt: string;
}

export interface Episode {
  id: string;
  season: number;
  episode: number;
  /** Bölüm süresi (dakika) — TMDB'den çekilir. */
  runtime?: number;
  watched: boolean;
  rating: number | null;
  detailedRating?: Record<string, number>;
  reviewTags?: string[];
  note: string;
  watchedAt: string | null;
}

export interface Series {
  id: string;
  title: string;
  year?: string;
  genres: string[];
  episodes: Episode[];
  /** Yanlışlıkla silinen bölümler — Eksikleri Bul ile puanı/notu korunarak geri gelir. */
  deletedEpisodes?: Episode[];
  posterUrl?: string;
  overview?: string;
  tmdbId?: number;
  customUrl?: string;
  imdbId?: string;
  watchProviders?: WatchProvider[];
  keywords?: string[];
  creators?: string[];
  cast?: string[];
  studios?: string[];
  originalLanguage?: string;
  /** Ortalama bölüm süresi (dakika) — TMDB'den çekilir. */
  episodeRuntime?: number;
  addedAt: string;
  /** Sinematik Otopsi: yarım bırakılan dizi. */
  abandoned?: boolean;
  abandonedAt?: string | null;
  abandonedProgress?: AbandonedProgress;
  autopsyReasons?: string[];
  autopsyNote?: string;
  /** Kör kalibrasyon (dizilerde film gibi puanlanabilir ep yok — alan opsiyonel). */
  calibratedScore?: number;
  duelCount?: number;
  duelWins?: number;
  /** Filmlerdeki Eskiden İzlenenler sırasının dizi karşılığı. */
  inPastQueue?: boolean;
  /** Önceden izlenen dizi: istatistiklerde yalnız "Önceden" kapsamında sayılır. */
  isPastWatch?: boolean;
  /** Dizinin genel (toptan) puanı. */
  overallRating?: number | null;
  overallNote?: string;
  overallRatedAt?: string | null;
  overallDetailedRating?: Record<string, number>;
  overallReviewTags?: string[];
  /** Sezon bazlı toptan puanlar. */
  seasonRatings?: Record<number, {
    rating: number;
    note: string;
    ratedAt: string;
    detailedRating?: Record<string, number>;
    reviewTags?: string[];
  }>;
}

export interface Collection {
  id: string;
  name: string;
}

export interface WatchHistoryItem {
  id: string;
  itemId?: string;
  seriesId?: string;
  kind: 'movie' | 'series';
  type?: 'movie' | 'series';
  title: string;
  rating: number | null;
  detailedRating?: Record<string, number>;
  reviewTags?: string[];
  note: string;
  watchedAt: string;
  isPastWatch?: boolean;
  startedAt?: string | null;
  actualRuntime?: number | null;
  originalRuntime?: number | null;
  genres: string[];
  year?: string;
  season?: number;
  episode?: number;
  /** DNF işareti: bu kayıt "yarım bırakma" otopsisinden geliyorsa true. */
  abandoned?: boolean;
  /** Puan düzenleme: önceki puan (yalnız sonradan yapılan değişimlerde yazılır). */
  previousRating?: number;
  /** Puan değişiminin yapıldığı an — sıralama/tarih önceliğinde kullanılır. */
  ratingChangedAt?: string;
  /** Notun son değiştirildiği an (görev ilerlemesi için). */
  noteChangedAt?: string;
  /** Kayıtta herhangi bir düzenlemenin yapıldığı son an. */
  editedAt?: string;
  /** Toptan puan kaydı: bölüm / sezon / tüm dizi. */
  ratingScope?: 'episode' | 'season' | 'series';
  /** Toptan puanlama kaydı mı? (bölüm sayısı/süre hesaplarına girmez) */
  bulkRating?: boolean;
  /** Toptan puanlamada istatistiğe eklenen %25 süre (dakika). */
  bulkRuntimeMinutes?: number;
}

export interface AchievementProgress {
  achievementId: string;
  current: number;
  unlockedTiers: string[];
  lastNotifiedTier: string | null;
  unlockedAt?: string;
  tierDates?: Record<string, string>;
}

export interface WeeklyPlanItem {
  id: string;
  movieId: string;
  title: string;
  year?: string;
  posterUrl?: string;
  genres: string[];
  runtime?: number;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm"
  createdAt: string;
}

export interface CoinTx {
  id: string;
  /** Pozitif kazanç, negatif harcama. */
  amount: number;
  kind: 'achievement' | 'lifetime_quest' | 'contract' | 'purchase' | 'welcome' | 'bonus' | 'refund' | 'xp_conversion' | 'penalty' | 'streak';
  label: string;
  /** Aynı ödülün iki kez yazılmasını engelleyen tekil anahtar. */
  refId: string;
  itemId?: string;
  createdAt: string;
}

export interface InventoryEntry {
  itemId: string;
  quantity: number;
  acquiredAt: string;
}

export interface EquippedItems {
  frameId?: string | null;
  titleId?: string | null;
  badgeId?: string | null;
  badgeId2?: string | null;
  backgroundId?: string | null;
  nameEffectId?: string | null;
}

export interface ActiveEffect {
  itemId: string;
  charges?: number;
  expiresAt?: string;
}

export interface ActiveContract {
  instanceId: string;
  contractId: string;
  startedAt: number;
  expiresAt: number;
  /** Günlük ücretsiz görev veya sabitlenmiş ücretsiz görev. */
  free?: boolean;
  freeSource?: 'daily' | 'pin';
}

export interface ContractHistoryEntry {
  instanceId: string;
  contractId: string;
  startedAt: number;
  completedAt: number;
  xp: number;
  coins: number;
  free?: boolean;
}

export interface MarketStats {
  purchases: number;
  coinsSpent: number;
  contractsCompleted: number;
  contractsFailed: number;
  weeklyContractsFailed: number;
  contractsCancelled: number;
}

export interface AppData {
  movies: Movie[];
  series: Series[];
  removedSeriesTitles: string[];
  collections: Collection[];
  genres: string[];
  reviewTags?: string[];
  history: WatchHistoryItem[];
  achievements: AchievementProgress[];
  criteria?: RatingCriterion[];
  /** SineCoin bakiyesi (ledger toplamıyla senkron tutulur). */
  coins?: number;
  coinLedger?: CoinTx[];
  inventory?: InventoryEntry[];
  equipped?: EquippedItems;
  activeEffects?: ActiveEffect[];
  /** Pazar vitrinini haftalık yeniden karıştırma sayacı. */
  marketRerollNonce?: number;
  /** Yalnız günlük görevleri yenileyen sayaç. */
  marketDailyNonce?: number;
  /** Yalnız haftalık görevleri yenileyen sayaç. */
  marketWeeklyNonce?: number;
  /** Kalıcı gelişim avantajları (vitrin yuvası, rozet yuvası, ek görev). */
  perks?: string[];
  /** Bir sonraki hafta için sabitlenen görev. */
  pinnedContract?: { week: string; contractId: string } | null;
  /** Pazar tanıtım/backfill ekranı gösterildi mi. */
  marketIntroSeen?: boolean;
  /** Pazar başarımları için sayaçlar. */
  marketStats?: MarketStats;
  xp: number;
  level: number;
  totalXp: number;
  lastWatchDate: string | null;
  dailyStreak: number;
  dailyStreakDate: string | null;
  showLockedNames?: boolean;
  /** Rozet vitrininde isim/açıklama/XP detayları görünsün mü. */
  showBadgeDetails?: boolean;
  /** Süsleme animasyonlarını ve geçişleri sakinleştirir; sesler etkilenmez. */
  reducedMotion?: boolean;
  /** XP ve seviye atlama sahnelerini kısaltır; sesler etkilenmez. */
  fastCelebrations?: boolean;
  altWatchTemplate?: string;
  weeklyPlan?: WeeklyPlanItem[];
  /** Çoklu hızlı aksiyon köprüsü şablonları (varsa altWatchTemplate'i temsil eder). */
  externalActions?: ExternalActionTemplate[];
  /** Kör kalibrasyon: tamamlanan düello sayısı (Terazi Ustası başarımı için). */
  totalDuelsCompleted?: number;
  /** Kör kalibrasyon: "Taht Deviren" gizli başarımı için — orijinal puanı düşük olan kazanan düello sayısı. */
  giantSlayerWins?: number;
  pendingToasts?: {
    achievementId: string;
    tier: string;
    xp: number;
    name: string;
    icon: string;
    description: string;
  }[];
  pendingLevelUp?: { newLevel: number };
  /** Sıradaki seviye kutlamaları (tetikten sonraki ara seviyeler; PROMOTE_LEVEL_UP ile sırayla açılır). */
  pendingLevelUpQueue?: number[];
  pendingXpGain?: {
    gained: number;
    oldTotal: number;
    newTotal: number;
    /** Defter kaynağı (XpGainOverlay etiketi için). */
    source?: import('./types/appState').XpEventSource;
    label?: string;
  };
  /** Başarım coin animasyonu için geçici kuyruk kaydı (buluta yazılmaz). */
  pendingCoinGain?: { amount: number; label: string; final?: boolean };
}