import type { ActiveContract, AppData, Series, WatchHistoryItem } from '../types';
import {
  CONTRACT_DEFS,
  DAILY_CONTRACTS,
  WEEKLY_CONTRACTS,
  type ContractDef,
  type ContractMetric,
} from './contracts';

export function localDayKey(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Pazartesi başlangıçlı hafta anahtarı (YYYY-MM-DD). */
export function weekKey(value: string | number | Date = new Date()): string {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return localDayKey(date);
}

export function nextWeekStart(value: string | number | Date = new Date()): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seedText: string): T[] {
  const random = mulberry32(hashSeed(seedText));
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface MarketOffers {
  weekKey: string;
  daily: ContractDef[];
  weekly: ContractDef[];
}

/** Görevler her Pazartesi değişir; reroll jetonu aynı hafta içinde yeniden karıştırır. */
export function getMarketOffers(
  week: string,
  rerollNonce = 0,
  dailyNonce = 0,
  weeklyNonce = 0,
  extraDaily = 0,
): MarketOffers {
  const seed = `${week}:${rerollNonce}`;
  return {
    weekKey: week,
    daily: seededShuffle(DAILY_CONTRACTS, `daily:${seed}:${dailyNonce}`).slice(0, 6 + extraDaily),
    weekly: seededShuffle(WEEKLY_CONTRACTS, `weekly:${seed}:${weeklyNonce}`).slice(0, 6),
  };
}

function findSeriesForEntry(entry: WatchHistoryItem, series: Series[]): Series | undefined {
  return series.find(
    (item) => item.id === entry.seriesId || item.id === entry.itemId || item.title === entry.title,
  );
}

function entryMinutes(entry: WatchHistoryItem, data: AppData): number {
  if (entry.bulkRating) return 0;
  if (entry.kind === 'movie') {
    const direct = entry.originalRuntime || entry.actualRuntime;
    if (direct) return direct;
    const movie = data.movies.find((item) => item.id === entry.itemId || item.title === entry.title);
    return movie?.actualRuntime || movie?.runtime || 0;
  }
  const series = findSeriesForEntry(entry, data.series);
  if (!series) return entry.originalRuntime || entry.actualRuntime || 0;
  const episode = series.episodes.find(
    (item) => item.season === entry.season && item.episode === entry.episode,
  );
  return (
    episode?.runtime ||
    entry.originalRuntime ||
    entry.actualRuntime ||
    series.episodeRuntime ||
    0
  );
}

function isWeekend(value: string): boolean {
  const day = new Date(value).getDay();
  return day === 0 || day === 6;
}

export interface MetricValue {
  metric: ContractMetric;
  current: number;
  target: number;
  met: boolean;
}

export interface ContractProgress {
  requirements: MetricValue[];
  completed: boolean;
  percent: number;
}

export function evaluateContractProgress(
  contract: ContractDef,
  startedAt: number,
  data: AppData,
): ContractProgress {
  const entries = (data.history || []).filter((entry) => {
    // Önceden izlenen kayıtlar pazar görevini tetiklemez.
    if (entry.isPastWatch) return false;
    const timestamp = new Date(entry.watchedAt).getTime();
    return Number.isFinite(timestamp) && timestamp >= startedAt;
  });

  const values: Record<ContractMetric, number> = {
    movies: entries.filter((entry) => entry.kind === 'movie').length,
    episodes: entries.filter((entry) => entry.kind === 'series' && !entry.bulkRating).length,
    items: entries.length,
    minutes: entries.reduce((sum, entry) => sum + entryMinutes(entry, data), 0),
    genres: new Set(entries.flatMap((entry) => entry.genres || []).filter(Boolean)).size,
    ratings: entries.filter((entry) => entry.rating != null).length,
    notes: entries.filter((entry) => (entry.note || '').trim().length > 0).length,
    adds:
      (data.movies || []).filter((movie) => new Date(movie.addedAt).getTime() >= startedAt).length +
      (data.series || []).filter((series) => new Date(series.addedAt).getTime() >= startedAt).length,
    weekend_movies: entries.filter((entry) => entry.kind === 'movie' && isWeekend(entry.watchedAt))
      .length,
    weekend_episodes: entries.filter(
      (entry) => entry.kind === 'series' && !entry.bulkRating && isWeekend(entry.watchedAt),
    ).length,
    distinct_series: new Set(entries.filter((entry) => entry.kind === 'series').map((entry) => entry.seriesId || entry.title)).size,
    watch_days: new Set(entries.map((entry) => localDayKey(entry.watchedAt))).size,
    max_day_items: (() => {
      const groups = new Map<string, number>();
      for (const entry of entries) {
        if (entry.bulkRating) continue;
        const key = localDayKey(entry.watchedAt);
        groups.set(key, (groups.get(key) || 0) + 1);
      }
      return Math.max(0, ...groups.values());
    })(),
    streak: Number(data.dailyStreak) || 0,
  };

  const requirements = contract.requirements.map((requirement) => {
    const current = Math.round(values[requirement.metric] || 0);
    return {
      metric: requirement.metric,
      current,
      target: requirement.target,
      met: current >= requirement.target,
    };
  });

  const percent = requirements.length
    ? Math.min(100, Math.round((requirements.reduce((sum, req) => sum + Math.min(1, req.current / req.target), 0) / requirements.length) * 100))
    : 0;

  return {
    requirements,
    completed: requirements.every((requirement) => requirement.met),
    percent,
  };
}

export function isContractExpired(active: ActiveContract, now = Date.now()): boolean {
  return active.expiresAt <= now;
}

export function remainingLabel(active: ActiveContract, now = Date.now()): string {
  const ms = Math.max(0, active.expiresAt - now);
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}g ${hours % 24}s`;
  }
  return `${hours}s ${minutes}dk`;
}

export function getContractDef(contractId: string): ContractDef | undefined {
  return CONTRACT_DEFS.find((def) => def.id === contractId);
}

export { CONTRACT_DEFS };
