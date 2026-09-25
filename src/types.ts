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

export interface Movie {
  id: string;
  title: string;
  year: string;
  genres: string[];
  collectionId: string | null;
  runtime?: number;
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
  genres: string[];
  year?: string;
  season?: number;
  episode?: number;
}

export type TierName = 'bronze' | 'silver' | 'gold' | 'diamond' | 'secret';

export interface AchievementProgress {
  achievementId: string;
  current: number;
  unlockedTiers: string[];
  lastNotifiedTier: string | null;
  unlockedAt?: string;
  tierDates?: Record<string, string>;
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