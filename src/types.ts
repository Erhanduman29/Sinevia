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
  xp: number;
  level: number;
  totalXp: number;
  lastWatchDate: string | null;
  dailyStreak: number;
  dailyStreakDate: string | null;
  showLockedNames?: boolean;
  altWatchTemplate?: string;
  weeklyPlan?: WeeklyPlanItem[];
  /** Çoklu hızlı aksiyon köprüsü şablonları (varsa altWatchTemplate'i temsil eder). */
  externalActions?: ExternalActionTemplate[];
  /** Kör kalibrasyon: tamamlanan düello sayısı (Terazi Ustası başarımı için). */
  totalDuelsCompleted?: number;
  /** Kalıcı bonus XP (başarı/görev ödülleri; synchronizeXPAndLevel recalc'ine dahildir). */
  bonusXp?: number;
  pendingToasts?: {
    achievementId: string;
    tier: string;
    xp: number;
    name: string;
    icon: string;
    description: string;
  }[];
  pendingLevelUp?: { newLevel: number };
  pendingXpGain?: { gained: number; oldTotal: number; newTotal: number };
}