export type ContractType = 'daily' | 'weekly';
export type ContractRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type ContractMetric =
  | 'movies'
  | 'episodes'
  | 'items'
  | 'minutes'
  | 'genres'
  | 'ratings'
  | 'notes'
  | 'adds'
  | 'weekend_movies'
  | 'weekend_episodes'
  | 'distinct_series'
  | 'watch_days'
  | 'max_day_items'
  | 'streak';

export interface ContractRequirement {
  metric: ContractMetric;
  target: number;
}

export interface ContractDef {
  id: string;
  type: ContractType;
  title: string;
  description: string;
  icon: string;
  rarity: ContractRarity;
  requirements: ContractRequirement[];
  xpReward: number;
  coinReward: number;
  price: number;
  durationHours: number;
}

export interface RarityStyleDef {
  color: string;
  border: string;
  bg: string;
  shadow: string;
  label: string;
  glow: string;
  badgeBg: string;
  accentBar: string;
}

export const CONTRACT_RARITY_STYLES: Record<ContractRarity, RarityStyleDef> = {
  common: {
    color: 'text-slate-200',
    border: 'border-slate-500/30 hover:border-slate-400/55',
    bg: 'bg-gradient-to-br from-ink-900/95 via-ink-900/80 to-slate-900/50',
    shadow: 'shadow-[0_8px_30px_-12px_rgba(148,163,184,0.18)]',
    label: 'Yaygın',
    glow: 'from-slate-300/25 via-slate-400/10 to-transparent',
    badgeBg: 'bg-slate-500/15 border-slate-400/35 text-slate-200',
    accentBar: 'from-transparent via-slate-400/50 to-transparent',
  },
  rare: {
    color: 'text-azure-300',
    border: 'border-azure-500/40 hover:border-azure-400/70',
    bg: 'bg-gradient-to-br from-ink-900/95 via-azure-950/25 to-ink-950/95',
    shadow: 'shadow-[0_10px_32px_-10px_rgba(56,189,248,0.28)]',
    label: 'Nadir',
    glow: 'from-azure-400/35 via-azure-500/15 to-transparent',
    badgeBg: 'bg-azure-500/15 border-azure-400/40 text-azure-300',
    accentBar: 'from-transparent via-azure-400/70 to-transparent',
  },
  epic: {
    color: 'text-violet-300',
    border: 'border-violet-500/45 hover:border-violet-400/80',
    bg: 'bg-gradient-to-br from-ink-900/95 via-violet-950/30 to-ink-950/95',
    shadow: 'shadow-[0_12px_36px_-10px_rgba(139,92,246,0.35)]',
    label: 'Destansı',
    glow: 'from-violet-400/40 via-fuchsia-500/15 to-transparent',
    badgeBg: 'bg-violet-500/20 border-violet-400/50 text-violet-200',
    accentBar: 'from-transparent via-violet-400/80 to-transparent',
  },
  legendary: {
    color: 'text-gold-300',
    border: 'border-gold-500/55 hover:border-gold-400/90',
    bg: 'bg-gradient-to-br from-ink-900/95 via-gold-950/35 to-ink-950/95',
    shadow: 'shadow-[0_12px_40px_-8px_rgba(245,158,11,0.4)]',
    label: 'Efsanevi',
    glow: 'from-gold-400/45 via-amber-500/20 to-transparent',
    badgeBg: 'bg-gold-500/20 border-gold-400/60 text-gold-200',
    accentBar: 'from-transparent via-gold-400/90 to-transparent',
  },
  mythic: {
    color: 'text-rose-300',
    border: 'border-rose-500/65 hover:border-rose-400/95',
    bg: 'bg-gradient-to-br from-ink-900/95 via-rose-950/40 to-ink-950/95',
    shadow: 'shadow-[0_14px_44px_-8px_rgba(244,63,94,0.5)]',
    label: 'Mitik',
    glow: 'from-rose-500/50 via-orange-500/25 to-transparent',
    badgeBg: 'bg-rose-500/25 border-rose-400/70 text-rose-200',
    accentBar: 'from-transparent via-rose-400 to-transparent',
  },
};

const XP_BY_RARITY: Record<ContractRarity, { daily: number; weekly: number }> = {
  common: { daily: 40, weekly: 120 },
  rare: { daily: 90, weekly: 260 },
  epic: { daily: 180, weekly: 520 },
  legendary: { daily: 320, weekly: 900 },
  mythic: { daily: 550, weekly: 1500 },
};

const PRICE_BY_RARITY: Record<ContractRarity, { daily: number; weekly: number }> = {
  common: { daily: 50, weekly: 180 },
  rare: { daily: 100, weekly: 360 },
  epic: { daily: 200, weekly: 650 },
  legendary: { daily: 350, weekly: 1100 },
  mythic: { daily: 550, weekly: 1800 },
};

/** Süresi dolan pazar görevinde bakiyeden düşülecek ceza. */
export const CONTRACT_FAILURE_PENALTY: Record<ContractRarity, number> = {
  common: 25,
  rare: 50,
  epic: 100,
  legendary: 200,
  mythic: 350,
};

const COIN_RATE_BY_RARITY: Record<ContractRarity, number> = {
  common: 0.05,
  rare: 0.06,
  epic: 0.07,
  legendary: 0.09,
  mythic: 0.12,
};

function contract(
  id: string,
  type: ContractType,
  title: string,
  description: string,
  icon: string,
  rarity: ContractRarity,
  requirements: ContractRequirement[],
): ContractDef {
  const xpReward = XP_BY_RARITY[rarity][type];
  return {
    id,
    type,
    title,
    description,
    icon,
    rarity,
    requirements,
    xpReward,
    coinReward: Math.max(5, Math.round(xpReward * COIN_RATE_BY_RARITY[rarity])),
    price: PRICE_BY_RARITY[rarity][type],
    durationHours: type === 'daily' ? 24 : 168,
  };
}

export const CONTRACT_DEFS: ContractDef[] = [
  // ── GÜNLÜK ────────────────────────────────────────────────────────────────
  contract('d_one_movie', 'daily', 'Günün Filmi', '1 film izle.', '🎬', 'common', [{ metric: 'movies', target: 1 }]),
  contract('d_two_movies', 'daily', 'Çifte Seans', '2 film izle.', '🍿', 'common', [{ metric: 'movies', target: 2 }]),
  contract('d_one_episode', 'daily', 'Bölüm Molası', '1 dizi bölümü izle.', '📺', 'common', [{ metric: 'episodes', target: 1 }]),
  contract('d_two_episodes', 'daily', 'İkili Bölüm', '2 dizi bölümü izle.', '📼', 'common', [{ metric: 'episodes', target: 2 }]),
  contract('d_three_episodes', 'daily', 'Mini Maraton', '3 dizi bölümü izle.', '⚡', 'rare', [{ metric: 'episodes', target: 3 }]),
  contract('d_one_item', 'daily', 'Tek Seans', '1 içerik izle.', '🎟️', 'common', [{ metric: 'items', target: 1 }]),
  contract('d_two_items', 'daily', 'Çift Gösterim', '2 içerik izle.', '🎞️', 'common', [{ metric: 'items', target: 2 }]),
  contract('d_three_items', 'daily', 'Üçlü Kuşak', '3 içerik izle.', '🎥', 'rare', [{ metric: 'items', target: 3 }]),
  contract('d_sixty_minutes', 'daily', 'Bir Saatlik Kaçış', 'Toplam 60 dakika izle.', '⏱️', 'common', [{ metric: 'minutes', target: 60 }]),
  contract('d_120_minutes', 'daily', 'İki Saatlik Perde', 'Toplam 120 dakika izle.', '⌛', 'rare', [{ metric: 'minutes', target: 120 }]),
  contract('d_two_genres', 'daily', 'Tür Geçişi', '2 farklı türden içerik izle.', '🎭', 'common', [{ metric: 'genres', target: 2 }]),
  contract('d_three_genres', 'daily', 'Tür Turu', '3 farklı türden içerik izle.', '🌈', 'rare', [{ metric: 'genres', target: 3 }]),
  contract('d_one_rating', 'daily', 'Puan Ver', '1 içeriği puanla.', '⭐', 'common', [{ metric: 'ratings', target: 1 }]),
  contract('d_two_ratings', 'daily', 'Eleştirmen', '2 içeriği puanla.', '🌟', 'rare', [{ metric: 'ratings', target: 2 }]),
  contract('d_one_note', 'daily', 'Not Bırak', '1 içeriğe not yaz.', '✍️', 'common', [{ metric: 'notes', target: 1 }]),
  contract('d_two_notes', 'daily', 'Günlük Yazarı', '2 içeriğe not yaz.', '📝', 'rare', [{ metric: 'notes', target: 2 }]),
  contract('d_one_add', 'daily', 'Arşive Ekle', 'Listeye 1 yapım ekle.', '📚', 'common', [{ metric: 'adds', target: 1 }]),
  contract('d_two_adds', 'daily', 'Koleksiyoner', 'Listeye 2 yapım ekle.', '🗂️', 'rare', [{ metric: 'adds', target: 2 }]),
  contract('d_weekend_movie', 'daily', 'Hafta Sonu Matinesi', 'Hafta sonu 1 film izle.', '🍿', 'rare', [{ metric: 'weekend_movies', target: 1 }]),
  contract('d_weekend_movies', 'daily', 'Hafta Sonu Çifti', 'Hafta sonu 2 film izle.', '🎉', 'epic', [{ metric: 'weekend_movies', target: 2 }]),
  contract('d_weekend_episode', 'daily', 'Pazar Bölümü', 'Hafta sonu 1 bölüm izle.', '☕', 'rare', [{ metric: 'weekend_episodes', target: 1 }]),
  contract('d_weekend_episodes', 'daily', 'Hafta Sonu Dizisi', 'Hafta sonu 2 bölüm izle.', '🛋️', 'epic', [{ metric: 'weekend_episodes', target: 2 }]),
  contract('d_one_series', 'daily', 'Tek Dizi', '1 farklı diziden bölüm izle.', '📡', 'common', [{ metric: 'distinct_series', target: 1 }]),
  contract('d_two_series', 'daily', 'Kanal Gezintisi', '2 farklı diziden bölüm izle.', '🎛️', 'rare', [{ metric: 'distinct_series', target: 2 }]),
  contract('d_one_day', 'daily', 'Bugün de İzle', 'Bugün en az 1 içerik izle.', '📅', 'common', [{ metric: 'watch_days', target: 1 }]),
  contract('d_two_same_day', 'daily', 'Aynı Gün İkili', 'Aynı gün 2 içerik izle.', '🌙', 'rare', [{ metric: 'max_day_items', target: 2 }]),
  contract('d_three_same_day', 'daily', 'Aynı Gün Üçlü', 'Aynı gün 3 içerik izle.', '🔥', 'epic', [{ metric: 'max_day_items', target: 3 }]),
  contract('d_streak_one', 'daily', 'Seriyi Koru', 'Günlük izleme serisini sürdür.', '🔗', 'common', [{ metric: 'streak', target: 1 }]),
  contract('d_streak_two', 'daily', 'İki Gün Üst Üste', 'En az 2 günlük seriye ulaş.', '⚡', 'rare', [{ metric: 'streak', target: 2 }]),
  contract('d_film_plus_episode', 'daily', 'Film + Bölüm', '1 film ve 1 dizi bölümü izle.', '🎬', 'epic', [{ metric: 'movies', target: 1 }, { metric: 'episodes', target: 1 }]),
  contract('d_hour_and_rate', 'daily', 'İzle ve Puanla', '60 dakika izle ve 1 puan ver.', '🏅', 'epic', [{ metric: 'minutes', target: 60 }, { metric: 'ratings', target: 1 }]),
  contract('d_triple_mix', 'daily', 'Üçlü Karışım', '3 içerik izle ve 2 farklı tür gör.', '🧩', 'legendary', [{ metric: 'items', target: 3 }, { metric: 'genres', target: 2 }]),

  // ── HAFTALIK ──────────────────────────────────────────────────────────────
  contract('w_five_movies', 'weekly', 'Haftalık Maraton', '5 film izle.', '🎬', 'common', [{ metric: 'movies', target: 5 }]),
  contract('w_ten_movies', 'weekly', 'On Film Kulübü', '10 film izle.', '🍿', 'rare', [{ metric: 'movies', target: 10 }]),
  contract('w_twenty_movies', 'weekly', 'Sinema Haftası', '20 film izle.', '🏛️', 'epic', [{ metric: 'movies', target: 20 }]),
  contract('w_ten_episodes', 'weekly', 'Dizi Kuşağı', '10 dizi bölümü izle.', '📺', 'common', [{ metric: 'episodes', target: 10 }]),
  contract('w_twentyfive_episodes', 'weekly', 'Bölüm Fırtınası', '25 dizi bölümü izle.', '🌪️', 'rare', [{ metric: 'episodes', target: 25 }]),
  contract('w_fifty_episodes', 'weekly', 'Sezon Yutucu', '50 dizi bölümü izle.', '🐉', 'legendary', [{ metric: 'episodes', target: 50 }]),
  contract('w_five_items', 'weekly', 'Haftalık Beşli', '5 içerik izle.', '🎟️', 'common', [{ metric: 'items', target: 5 }]),
  contract('w_fifteen_items', 'weekly', 'On Beş Seans', '15 içerik izle.', '🎞️', 'rare', [{ metric: 'items', target: 15 }]),
  contract('w_thirty_items', 'weekly', 'Otuz Perde', '30 içerik izle.', '🎥', 'epic', [{ metric: 'items', target: 30 }]),
  contract('w_300_minutes', 'weekly', 'Beş Saatlik Kaçış', 'Toplam 300 dakika izle.', '⏱️', 'common', [{ metric: 'minutes', target: 300 }]),
  contract('w_600_minutes', 'weekly', 'On Saatlik Perde', 'Toplam 600 dakika izle.', '⌛', 'rare', [{ metric: 'minutes', target: 600 }]),
  contract('w_1000_minutes', 'weekly', 'Bin Dakika', 'Toplam 1000 dakika izle.', '🕰️', 'epic', [{ metric: 'minutes', target: 1000 }]),
  contract('w_1500_minutes', 'weekly', 'Sinema Mesaisi', 'Toplam 1500 dakika izle.', '🏆', 'legendary', [{ metric: 'minutes', target: 1500 }]),
  contract('w_1000_hours', 'weekly', 'Bin Saat', 'Toplam 1000 saat izle. (Efsane avı)', '🌌', 'mythic', [{ metric: 'minutes', target: 60000 }]),
  contract('w_five_genres', 'weekly', 'Tür Kâşifi', '5 farklı türden içerik izle.', '🌈', 'rare', [{ metric: 'genres', target: 5 }]),
  contract('w_eight_genres', 'weekly', 'Tür Ustası', '8 farklı türden içerik izle.', '🎨', 'epic', [{ metric: 'genres', target: 8 }]),
  contract('w_five_ratings', 'weekly', 'Haftalık Eleştirmen', '5 içeriği puanla.', '⭐', 'rare', [{ metric: 'ratings', target: 5 }]),
  contract('w_ten_ratings', 'weekly', 'Puan Makinesi', '10 içeriği puanla.', '🌟', 'epic', [{ metric: 'ratings', target: 10 }]),
  contract('w_three_notes', 'weekly', 'Haftalık Günlük', '3 içeriğe not yaz.', '✍️', 'rare', [{ metric: 'notes', target: 3 }]),
  contract('w_five_notes', 'weekly', 'Uzun Form', '5 içeriğe not yaz.', '📝', 'epic', [{ metric: 'notes', target: 5 }]),
  contract('w_three_adds', 'weekly', 'Arşiv Genişletme', 'Listeye 3 yapım ekle.', '📚', 'common', [{ metric: 'adds', target: 3 }]),
  contract('w_five_adds', 'weekly', 'Kütüphaneci', 'Listeye 5 yapım ekle.', '🗂️', 'rare', [{ metric: 'adds', target: 5 }]),
  contract('w_weekend_combo', 'weekly', 'Hafta Sonu Paketi', 'Hafta sonu 3 film ve 2 bölüm izle.', '🎉', 'epic', [{ metric: 'weekend_movies', target: 3 }, { metric: 'weekend_episodes', target: 2 }]),
  contract('w_weekend_big', 'weekly', 'Hafta Sonu Festivali', 'Hafta sonu 5 film ve 5 bölüm izle.', '🎪', 'legendary', [{ metric: 'weekend_movies', target: 5 }, { metric: 'weekend_episodes', target: 5 }]),
  contract('w_three_series', 'weekly', 'Üç Dizi', '3 farklı diziden bölüm izle.', '📡', 'rare', [{ metric: 'distinct_series', target: 3 }]),
  contract('w_five_series', 'weekly', 'Beş Kanal', '5 farklı diziden bölüm izle.', '🎛️', 'epic', [{ metric: 'distinct_series', target: 5 }]),
  contract('w_four_days', 'weekly', 'Dört Gün', '4 farklı gün izle.', '📅', 'rare', [{ metric: 'watch_days', target: 4 }]),
  contract('w_five_days', 'weekly', 'Beş Gün', '5 farklı gün izle.', '🗓️', 'epic', [{ metric: 'watch_days', target: 5 }]),
  contract('w_streak_three', 'weekly', 'Üç Günlük Seri', '3 günlük izleme serisine ulaş.', '🔗', 'rare', [{ metric: 'streak', target: 3 }]),
  contract('w_streak_five', 'weekly', 'Beş Günlük Seri', '5 günlük izleme serisine ulaş.', '⚡', 'epic', [{ metric: 'streak', target: 5 }]),
  contract('w_streak_seven', 'weekly', 'Yedi Günlük Seri', '7 günlük izleme serisine ulaş.', '🔥', 'legendary', [{ metric: 'streak', target: 7 }]),
  contract('w_binge_day', 'weekly', 'Maraton Günü', 'Aynı gün 4 içerik izle.', '🌙', 'epic', [{ metric: 'max_day_items', target: 4 }]),
  contract('w_binge_day_six', 'weekly', 'Binge Gecesi', 'Aynı gün 6 içerik izle.', '🌃', 'legendary', [{ metric: 'max_day_items', target: 6 }]),
  contract('w_film_episode_combo', 'weekly', 'Film + Dizi', '10 film ve 5 bölüm izle.', '🎬', 'legendary', [{ metric: 'movies', target: 10 }, { metric: 'episodes', target: 5 }]),
  contract('w_thousand_and_ten', 'weekly', 'Bin Dakika ve On Seans', '1000 dakika izle ve 10 içerik tamamla.', '💎', 'mythic', [{ metric: 'minutes', target: 1000 }, { metric: 'items', target: 10 }]),
];

export const CONTRACT_MAP = new Map(CONTRACT_DEFS.map((def) => [def.id, def]));

export const DAILY_CONTRACTS = CONTRACT_DEFS.filter((def) => def.type === 'daily');
export const WEEKLY_CONTRACTS = CONTRACT_DEFS.filter((def) => def.type === 'weekly');

export const METRIC_LABELS: Record<ContractMetric, string> = {
  movies: 'film',
  episodes: 'bölüm',
  items: 'içerik',
  minutes: 'dakika',
  genres: 'farklı tür',
  ratings: 'puanlama',
  notes: 'not',
  adds: 'yeni yapım',
  weekend_movies: 'hafta sonu filmi',
  weekend_episodes: 'hafta sonu bölümü',
  distinct_series: 'farklı dizi',
  watch_days: 'izleme günü',
  max_day_items: 'aynı gün içerik',
  streak: 'günlük seri',
};

export function contractItemId(contractId: string): string {
  return `contract:${contractId}`;
}

export function parseContractItemId(itemId: string): string | null {
  return itemId.startsWith('contract:') ? itemId.slice('contract:'.length) : null;
}