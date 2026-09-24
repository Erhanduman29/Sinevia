export interface RatingCriterion {
  id: string;
  name: string;
  weight: number;
  appliesTo: 'movie' | 'series' | 'both';
  genres: string[]; // Boş ise tüm türlerde geçerli
}

export interface WatchProvider {
  logoUrl: string;
  providerName: string;
  link?: string;
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
  watched: boolean;
  rating: number | null;
  detailedRating?: Record<string, number>;
  note: string;
  watchedAt: string | null;
  addedAt: string;
  
  // DNA Sentezleyici için Genetik Veriler
  keywords?: string[];
  directors?: string[];
  cast?: string[];
  studios?: string[];
  originalLanguage?: string;
  
  // İzleme Merkezi (YENİ)
  imdbId?: string;
  watchProviders?: WatchProvider[];
  customUrl?: string;
}

export interface Episode {
  id: string;
  season: number;
  episode: number;
  watched: boolean;
  rating: number | null;
  detailedRating?: Record<string, number>;
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
  addedAt: string;
  
  // DNA Sentezleyici için Genetik Veriler
  keywords?: string[];
  creators?: string[];
  cast?: string[];
  studios?: string[];
  originalLanguage?: string;
  
  // İzleme Merkezi (YENİ)
  imdbId?: string;
  watchProviders?: WatchProvider[];
  customUrl?: string;
}

export interface Collection {
  id: string;
  name: string;
}

export type WatchHistoryItem = {
  id: string;
  kind: 'movie' | 'series';
  title: string;
  rating: number | null;
  detailedRating?: Record<string, number>;
  note: string;
  watchedAt: string;
  genres: string[];
  season?: number;
  episode?: number;
  seriesId?: string;
  year?: string;
  itemId?: string;
  type?: string;
};

export interface AchievementTier {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
  diamond: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  hidden: boolean;
  secret: boolean;
  tiers: { threshold: number; xp: number; tier: string; name?: string }[];
  category: string;
}

export interface AchievementProgress {
  achievementId: string;
  current: number;
  unlockedTiers: string[];
  lastNotifiedTier: string | null;
  tierDates?: Record<string, string>;
  unlockedAt?: string;
}

export interface AppData {
  movies: Movie[];
  series: Series[];
  removedSeriesTitles: string[];
  collections: Collection[];
  genres: string[];
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
  pendingToasts?: any[];
  pendingLevelUp?: any;
  pendingXpGain?: any;
  
  // İzleme Merkezi (YENİ)
  altWatchTemplate?: string; // Alternatif izleme sitesinin URL şablonu (Örn: https://site.com/embed/{imdb})
}