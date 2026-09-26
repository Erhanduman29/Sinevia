import { createContext, useContext, useEffect, useReducer, useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppData, Movie, Series, Episode, Collection, WatchHistoryItem, AchievementProgress, RatingCriterion, WatchProvider } from '../types';
import { normalize, uid, todayStr, daysBetween } from '../lib/utils';
import { ACHIEVEMENT_DEFS } from '../lib/achievements';
import { levelFromXp } from '../lib/xp';

const STORAGE_KEY = 'sinevia-v1';
const DEFAULT_GENRES = ['Aksiyon', 'Macera', 'Komedi', 'Dram', 'Korku', 'Bilim Kurgu', 'Fantastik', 'Romantik', 'Gerilim', 'Suç', 'Belgesel', 'Animasyon'];
export const DEFAULT_REVIEW_TAGS = ['🔥 Başyapıt', '🎭 Oyunculuk Muazzam', '🤯 Ters Köşe Final', '🎵 Müzikler Efsane', '🎬 Görsellik Şahane', '🍿 Akıcı & Keyifli', '💤 Tempo Yavaştı', '📉 Beklentimin Altında'];
export const DISPLAY_DURATION_MS = 4000;
export const QUEUE_STEP_DURATION_MS = 4300;

export interface AIMessage { id: string; sender: 'user' | 'ai'; text: string; timestamp: number; actionItems?: any[]; }
export interface MovieExtraData { keywords?: string[]; directors?: string[]; cast?: string[]; studios?: string[]; originalLanguage?: string; }
export interface SeriesExtraData { keywords?: string[]; creators?: string[]; cast?: string[]; studios?: string[]; originalLanguage?: string; }
interface ExtendedAppData extends AppData { aiChatHistory?: AIMessage[]; theme?: string; reviewTags: string[]; }

// ⏱️ CANLI GERİ SAYIM VE ENGELLEYİCİ HESAPLAMA YARDIMCISI
export function getMovieTimerInfo(movie: Movie, nowMs = Date.now()) {
  const maxMins = movie.runtime && movie.runtime > 0 ? movie.runtime : 115;
  const totalSec = maxMins * 60;
  const minRequiredMins = Math.max(5, Math.ceil(maxMins * 0.15)); // En az %15 (veya min 5 dk) izleme şartı

  if (!movie.startedAt) {
    return { isActive: false, isPaused: false, elapsedSec: 0, remainingSec: totalSec, elapsedMins: 0, maxMins, minRequiredMins, canRateWithTimer: true, formattedRemaining: '' };
  }

  let elapsedSec = 0;
  let isPaused = false;

  if (movie.startedAt.startsWith('PAUSED:')) {
    isPaused = true;
    elapsedSec = Math.min(totalSec, Math.max(0, parseInt(movie.startedAt.slice(7), 10) || 0));
  } else {
    const startMs = new Date(movie.startedAt).getTime();
    if (!isNaN(startMs)) {
      elapsedSec = Math.min(totalSec, Math.max(0, Math.floor((nowMs - startMs) / 1000)));
    }
  }

  const remainingSec = Math.max(0, totalSec - elapsedSec);
  const elapsedMins = Math.floor(elapsedSec / 60);
  const canRateWithTimer = elapsedMins >= minRequiredMins;

  const hrs = Math.floor(remainingSec / 3600);
  const mins = Math.floor((remainingSec % 3600) / 60);
  const secs = remainingSec % 60;
  const formattedRemaining = hrs > 0
    ? `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return { isActive: true, isPaused, elapsedSec, remainingSec, elapsedMins, maxMins, minRequiredMins, canRateWithTimer, formattedRemaining };
}

function createInitialAchievements(existingList?: AchievementProgress[]): AchievementProgress[] {
  const existingMap = new Map((existingList || []).map((a) => [a.achievementId, a]));
  return ACHIEVEMENT_DEFS.map((def) => {
    const ex = existingMap.get(def.id);
    if (ex) return { ...ex, unlockedTiers: Array.isArray(ex.unlockedTiers) ? [...ex.unlockedTiers] : [], tierDates: ex.tierDates ? { ...ex.tierDates } : {} };
    return { achievementId: def.id, current: 0, unlockedTiers: [], tierDates: {}, lastNotifiedTier: null };
  });
}

function defaultData(): ExtendedAppData {
  return {
    movies: [], series: [], removedSeriesTitles: [], collections: [], genres: DEFAULT_GENRES, reviewTags: DEFAULT_REVIEW_TAGS, history: [],
    achievements: createInitialAchievements(),
    criteria: [
      { id: 'crit_1', name: 'Senaryo ve Hikaye', weight: 10, appliesTo: 'both', genres: [] },
      { id: 'crit_2', name: 'Oyunculuk', weight: 8, appliesTo: 'both', genres: [] },
      { id: 'crit_3', name: 'Görsel Yönetim', weight: 7, appliesTo: 'both', genres: [] }
    ],
    xp: 0, level: 1, totalXp: 0, lastWatchDate: null, dailyStreak: 0, dailyStreakDate: null,
    showLockedNames: false, aiChatHistory: [], theme: 'default',
    altWatchTemplate: 'https://duckduckgo.com/?q=\\site:hdfilmcehennemi.nl+{title}+{year}+izle'
  };
}

export function resolveTMDBGenres(incomingGenres: string[], existingGenres: string[]): string[] {
  const resolved = incomingGenres.map((incoming) => {
    const cleanIn = normalize(incoming).replace(/[\s-]/g, '');
    let match = existingGenres.find((g) => normalize(g).replace(/[\s-]/g, '') === cleanIn);
    if (match) return match;
    match = existingGenres.find((g) => {
      const cleanG = normalize(g).replace(/[\s-]/g, '');
      return cleanG.length >= 3 && cleanIn.length >= 3 && (cleanIn.startsWith(cleanG) || cleanG.startsWith(cleanIn));
    });
    return match || incoming;
  });
  return Array.from(new Set(resolved));
}

function addNewGenres(currentGenres: string[], incomingGenres: string[]): string[] {
  const newItems = incomingGenres.filter((inc) => !currentGenres.some((cur) => normalize(cur) === normalize(inc)));
  return newItems.length > 0 ? [...currentGenres, ...newItems] : currentGenres;
}

type Action =
  | { type: 'ADD_MOVIE'; movie: Movie } | { type: 'DELETE_MOVIE'; id: string }
  | { type: 'START_WATCHING_MOVIE'; id: string; startedAt: string } | { type: 'CANCEL_WATCHING_MOVIE'; id: string }
  | { type: 'WATCH_MOVIE'; id: string; rating: number; note: string; detailedRating?: Record<string, number>; reviewTags?: string[]; watchedAt: string; actualRuntime: number; historyItem: WatchHistoryItem }
  | { type: 'UNWATCH_MOVIE'; id: string }
  | { type: 'UPDATE_HISTORY_RATING'; historyId: string; rating: number; note: string; detailedRating?: Record<string, number>; reviewTags?: string[] }
  | { type: 'ADD_SERIES'; series: Series } | { type: 'DELETE_SERIES'; id: string } | { type: 'COMPLETE_SERIES'; id: string; title: string }
  | { type: 'ADD_EPISODES'; seriesId: string; episodes: Episode[] }
  | { type: 'WATCH_EPISODE'; seriesId: string; episodeId: string; rating: number; note: string; detailedRating?: Record<string, number>; reviewTags?: string[]; watchedAt: string; historyItem: WatchHistoryItem }
  | { type: 'UNWATCH_EPISODE'; seriesId: string; episodeId: string } | { type: 'DELETE_EPISODE'; seriesId: string; episodeId: string }
  | { type: 'ADD_GENRE'; genre: string } | { type: 'DELETE_GENRE'; genre: string } | { type: 'RENAME_GENRE'; oldName: string; newName: string }
  | { type: 'ADD_REVIEW_TAG'; tag: string } | { type: 'DELETE_REVIEW_TAG'; tag: string } | { type: 'RENAME_REVIEW_TAG'; oldTag: string; newTag: string }
  | { type: 'EDIT_MOVIE'; id: string; title: string; year: string; genres: string[]; runtime?: number; posterUrl?: string; overview?: string; tmdbId?: number; customUrl?: string; imdbId?: string; watchProviders?: WatchProvider[]; extra?: MovieExtraData }
  | { type: 'EDIT_SERIES'; id: string; title: string; genres: string[]; year?: string; posterUrl?: string; overview?: string; tmdbId?: number; customUrl?: string; imdbId?: string; watchProviders?: WatchProvider[]; extra?: SeriesExtraData }
  | { type: 'ADD_COLLECTION'; collection: Collection } | { type: 'DELETE_COLLECTION'; id: string } | { type: 'RENAME_COLLECTION'; id: string; name: string } | { type: 'SET_MOVIE_COLLECTION'; id: string; collectionId: string | null }
  | { type: 'IMPORT_DATA'; data: ExtendedAppData } | { type: 'MERGE_SHARED_LIST'; movies: Movie[]; series: Series[]; collections: Collection[]; genres: string[] }
  | { type: 'SET_ACHIEVEMENT_PROGRESS'; progress: AchievementProgress[] }
  | { type: 'TOGGLE_LOCKED_NAMES' } | { type: 'CONSUME_NEXT_TOAST' } | { type: 'CLEAR_LEVELUP' } | { type: 'CLEAR_XP_GAIN' } | { type: 'SYNC_ACHIEVEMENTS' }
  | { type: 'UPDATE_AI_HISTORY'; messages: AIMessage[] }
  | { type: 'ADD_CRITERION'; criterion: RatingCriterion } | { type: 'EDIT_CRITERION'; id: string; criterion: RatingCriterion } | { type: 'DELETE_CRITERION'; id: string }
  | { type: 'UPDATE_ALT_TEMPLATE'; template: string } | { type: 'SET_THEME'; theme: string } | { type: 'GRANT_XP'; xp: number };

const FIXED_BUGGED_ACHIEVEMENTS = new Set(['selective_critic', 'weekend_cinema', 'loyalty_test', 'break_taker', 'lost_colony', 'final_phobia', 'ghost_viewer', 'secret_critic']);

function applyAchievements(state: ExtendedAppData): ExtendedAppData {
  const unlocked: { achievementId: string; tier: string; xp: number; name: string; icon: string; description: string }[] = [];
  const validHistory = [...(state.history || [])].filter((h) => {
    if (!h.watchedAt) return false;
    const t = new Date(h.watchedAt).getTime();
    return !isNaN(t) && t > 1262304000000;
  }).sort((a, b) => new Date(a.watchedAt).getTime() - new Date(b.watchedAt).getTime());

  const moviesHistory = validHistory.filter((h) => h.type === 'movie' || h.kind === 'movie');
  const seriesHistory = validHistory.filter((h) => h.type === 'series' || h.kind === 'series');

  const calcMaxStreak = (hist: any[], typeMatch?: string) => {
    const dates = hist.filter((h) => !typeMatch || h.type === typeMatch || h.kind === typeMatch).map((h) => h.watchedAt.slice(0, 10));
    const unique = Array.from(new Set(dates)).sort();
    let max = 0, current = 0;
    for (let i = 0; i < unique.length; i++) {
      if (i === 0) { current = 1; max = 1; continue; }
      const diff = Math.round((new Date(unique[i]).getTime() - new Date(unique[i - 1]).getTime()) / 86400000);
      current = diff === 1 ? current + 1 : 1;
      if (current > max) max = current;
    }
    return max;
  };

  const checkGenre = (genres: string[] | undefined, words: string[]) => {
    if (!genres) return false;
    return genres.some((g) => {
      const tr = g.toLocaleLowerCase('tr-TR'), en = g.toLowerCase();
      return words.some((w) => tr.includes(w) || en.includes(w));
    });
  };

  const newAchievements = createInitialAchievements(state.achievements);
  const progressMap = new Map(newAchievements.map((a) => [a.achievementId, a]));
  const watchedMovies = state.movies.filter((m) => m.watched);
  const watchedMoviesWithRuntime = watchedMovies.filter((m) => m.runtime);

  for (const def of ACHIEVEMENT_DEFS) {
    const prog = progressMap.get(def.id);
    if (!prog) continue;
    let currentVal = 0;

    switch (def.id) {
      case 'movie_add': currentVal = state.movies.length; break;
      case 'series_add': currentVal = state.series.length; break;
      case 'daily_movie': currentVal = calcMaxStreak(validHistory, 'movie'); break;
      case 'daily_series': currentVal = calcMaxStreak(validHistory, 'series'); break;
      case 'movie_genre_action': currentVal = moviesHistory.filter((h) => checkGenre(h.genres, ['aksiyon', 'action'])).length; break;
      case 'series_genre_action': currentVal = new Set(seriesHistory.filter((h) => checkGenre(h.genres, ['aksiyon', 'action'])).map((h) => h.seriesId)).size; break;
      case 'movie_genre_comedy': currentVal = moviesHistory.filter((h) => checkGenre(h.genres, ['komedi', 'comedy'])).length; break;
      case 'series_genre_comedy': currentVal = new Set(seriesHistory.filter((h) => checkGenre(h.genres, ['komedi', 'comedy'])).map((h) => h.seriesId)).size; break;
      case 'movie_genre_drama': currentVal = moviesHistory.filter((h) => checkGenre(h.genres, ['dram', 'drama'])).length; break;
      case 'series_genre_drama': currentVal = new Set(seriesHistory.filter((h) => checkGenre(h.genres, ['dram', 'drama'])).map((h) => h.seriesId)).size; break;
      case 'movie_genre_horror': currentVal = moviesHistory.filter((h) => checkGenre(h.genres, ['korku', 'horror'])).length; break;
      case 'series_genre_horror': currentVal = new Set(seriesHistory.filter((h) => checkGenre(h.genres, ['korku', 'horror'])).map((h) => h.seriesId)).size; break;
      case 'movie_genre_scifi': currentVal = moviesHistory.filter((h) => checkGenre(h.genres, ['bilim kurgu', 'bilimkurgu', 'sci-fi', 'scifi'])).length; break;
      case 'series_genre_scifi': currentVal = new Set(seriesHistory.filter((h) => checkGenre(h.genres, ['bilim kurgu', 'bilimkurgu', 'sci-fi', 'scifi'])).map((h) => h.seriesId)).size; break;
      case 'perfect_rating': case 'secret_perfectionist': currentVal = validHistory.filter((h) => h.rating === 10).length; break;
      case 'high_rating': currentVal = validHistory.filter((h) => h.rating === 9 || h.rating === 9.5).length; break;
      case 'low_rating': currentVal = validHistory.filter((h) => h.rating !== null && h.rating <= 3).length; break;
      case 'secret_critic': case 'hater': currentVal = validHistory.filter((h) => h.rating !== null && h.rating <= 2).length; break;
      case 'first_rating': currentVal = validHistory.filter((h) => h.rating !== null).length; break;
      case 'strict_critic': currentVal = validHistory.filter((h) => h.rating !== null && h.note && h.note.trim().length > 0).length; break;
      case 'total_watch': case 'sinevia_legend': currentVal = validHistory.length; break;
      case 'genre_explorer': currentVal = new Set(validHistory.flatMap((h) => h.genres || [])).size; break;
      case 'note_taker': currentVal = validHistory.filter((h) => h.note && h.note.trim().length > 0).length; break;
      case 'night_owl': currentVal = validHistory.filter((h) => { const hr = new Date(h.watchedAt).getHours(); return hr >= 0 && hr < 5; }).length; break;
      case 'weekend_watcher': currentVal = validHistory.filter((h) => { const d = new Date(h.watchedAt).getDay(); return d === 0 || d === 6; }).length; break;
      case 'marathon': {
        const days: any = {}; validHistory.forEach((h) => { const d = h.watchedAt.slice(0, 10); days[d] = (days[d] || 0) + 1; });
        currentVal = Object.values(days).filter((c: any) => c >= 3).length; break;
      }
      case 'secret_binge': {
        const days: any = {}; seriesHistory.forEach((h) => { const d = h.watchedAt.slice(0, 10); days[d] = (days[d] || 0) + 1; });
        currentVal = Math.max(0, ...Object.values(days as Record<string, number>)); break;
      }
      case 'season_complete': {
        let c = 0;
        state.series.forEach((s) => {
          const eps = s.episodes || []; const seas = new Set(eps.map((e) => e.season));
          seas.forEach((season) => { const sEps = eps.filter((e) => e.season === season); if (sEps.length > 0 && sEps.every((e) => e.watched)) c++; });
        });
        currentVal = c; break;
      }
      case 'collection_complete': {
        let c = 0;
        (state.collections || []).forEach((col) => { const cm = state.movies.filter((m) => m.collectionId === col.id); if (cm.length > 0 && cm.every((m) => m.watched)) c++; });
        currentVal = c; break;
      }
      case 'caveman': {
        const days: any = {}; validHistory.forEach((h) => { const d = h.watchedAt.slice(0, 10); days[d] = (days[d] || 0) + 1; });
        let streak = 0, maxS = 0; const sortedDays = Object.keys(days).sort();
        for (let i = 0; i < sortedDays.length; i++) {
          if (days[sortedDays[i]] >= 5) {
            const diff = i > 0 ? Math.round((new Date(sortedDays[i]).getTime() - new Date(sortedDays[i - 1]).getTime()) / 86400000) : 0;
            streak = i > 0 && diff === 1 ? streak + 1 : 1;
          } else streak = 0;
          if (streak > maxS) maxS = streak;
        }
        currentVal = maxS; break;
      }
      case 'epic_writer': currentVal = validHistory.filter((h) => h.note && h.note.trim().length >= 5000).length; break;
      case 'ghost_viewer': currentVal = validHistory.filter((h) => !h.note || h.note.trim() === '').length; break;
      case 'trash_lover': currentVal = validHistory.filter((h) => h.rating !== null && h.rating < 3 && h.note && h.note.trim().length >= 500).length; break;
      case 'polarization': {
        const tens = validHistory.filter((h) => h.rating === 10).length, lows = validHistory.filter((h) => h.rating !== null && h.rating <= 2).length;
        currentVal = tens >= 20 && lows >= 20 ? 1 : 0; break;
      }
      case 'new_year_lonely': {
        currentVal = validHistory.filter((h) => {
          const d = new Date(h.watchedAt), m = d.getMonth(), hr = d.getHours();
          return (m === 11 && d.getDate() === 31 && hr >= 20) || (m === 0 && d.getDate() === 1 && hr <= 4);
        }).length; break;
      }
      case 'cinephile': currentVal = seriesHistory.length > 0 ? 0 : moviesHistory.length; break;
      case 'short_day_profit': {
        const days: any = {}; moviesHistory.forEach((h) => { const d = h.watchedAt.slice(0, 10); days[d] = (days[d] || 0) + 1; });
        currentVal = Object.values(days).filter((c: any) => c >= 3).length; break;
      }
      case 'selective_critic': {
        const rated = moviesHistory.filter((h) => h.rating !== null);
        currentVal = !rated.some((r) => r.rating === 10) ? rated.length : 0; break;
      }
      case 'weekend_cinema': {
        const wknd: Record<string, number> = {};
        moviesHistory.forEach((h) => {
          const d = new Date(h.watchedAt);
          if (d.getDay() === 0 || d.getDay() === 6) {
            const sat = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() === 0 ? 1 : 0));
            const k = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, '0')}-${String(sat.getDate()).padStart(2, '0')}`;
            wknd[k] = (wknd[k] || 0) + 1;
          }
        });
        currentVal = Math.max(0, ...Object.values(wknd)); break;
      }
      case 'episode_monster': currentVal = seriesHistory.length; break;
      case 'patience_stone': currentVal = state.series.filter((s) => s.episodes && s.episodes.length > 0 && Math.max(...s.episodes.map((e) => e.season)) >= 8 && s.episodes.every((e) => e.watched)).length; break;
      case 'loyalty_test': {
        let maxL = 0; const byS: any = {};
        seriesHistory.forEach((h) => { const sid = h.seriesId || h.itemId || h.id; if (!byS[sid]) byS[sid] = new Set(); byS[sid].add(h.watchedAt.slice(0, 10)); });
        Object.values(byS).forEach((dSet: any) => {
          const dates = Array.from(dSet).sort() as string[];
          if (dates.length === 0) return;
          let s = 1; if (s > maxL) maxL = s;
          for (let i = 1; i < dates.length; i++) { s = Math.round((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000) === 1 ? s + 1 : 1; if (s > maxL) maxL = s; }
        });
        currentVal = maxL; break;
      }
      case 'break_taker': case 'lost_colony': {
        let maxGap = 0; const byS: any = {};
        seriesHistory.forEach((h) => { const sid = h.seriesId || h.itemId || h.id; if (!byS[sid]) byS[sid] = []; byS[sid].push(new Date(h.watchedAt).getTime()); });
        Object.values(byS).forEach((dates: any) => {
          dates.sort((a: number, b: number) => a - b);
          for (let i = 1; i < dates.length; i++) { const gap = Math.max(0, (dates[i] - dates[i - 1]) / 86400000); if (gap > maxGap) maxGap = gap; }
        });
        currentVal = Math.floor(maxGap); break;
      }
      case 'morning_sweet': currentVal = moviesHistory.filter((h) => { const hr = new Date(h.watchedAt).getHours(); return hr >= 6 && hr < 9; }).length; break;
      case 'nostalgia_wind': currentVal = moviesHistory.filter((h) => h.year && parseInt(h.year) <= 1980).length; break;
      case 'universe_conqueror': currentVal = (state.collections || []).filter((c) => { const cM = state.movies.filter((m) => m.collectionId === c.id); return cM.length >= 3 && cM.every((m) => m.watched); }).length; break;
      case 'final_phobia': case 'delayed_goodbye': {
        let phobiaGap = 0, delayedCount = 0;
        state.series.forEach((s) => {
          if (!s.episodes || s.episodes.length < 2) return;
          const eps = [...s.episodes].sort((a, b) => (a.season === b.season ? a.episode - b.episode : a.season - b.season));
          const finalEp = eps[eps.length - 1], penEp = eps[eps.length - 2];
          if (penEp.watched && penEp.watchedAt) {
            const penTime = new Date(penEp.watchedAt).getTime();
            const finalTime = finalEp.watched && finalEp.watchedAt ? new Date(finalEp.watchedAt).getTime() : Date.now();
            if (isNaN(penTime) || penTime < 1262304000000 || isNaN(finalTime) || finalTime < 1262304000000) return;
            const gap = Math.max(0, (finalTime - penTime) / 86400000);
            if (!finalEp.watched) phobiaGap = Math.max(phobiaGap, gap);
            if (finalEp.watched && gap >= 90) delayedCount++;
          }
        });
        currentVal = def.id === 'final_phobia' ? Math.floor(phobiaGap) : delayedCount; break;
      }
      case 'half_century_series': currentVal = state.series.filter((s) => s.episodes && s.episodes.length > 100 && s.episodes.every((e) => e.watched)).length; break;
      case 'light_speed': {
        let lsCount = 0;
        validHistory.forEach((h) => {
          if (h.rating != null) {
            const addedAt = h.kind === 'series' ? state.series.find((s) => s.id === (h.seriesId || h.itemId || h.id))?.addedAt : state.movies.find((m) => m.id === (h.itemId || h.id))?.addedAt;
            if (addedAt) {
              const addTime = new Date(addedAt).getTime(), watchTime = new Date(h.watchedAt).getTime();
              if (!isNaN(addTime) && addTime > 1262304000000 && (watchTime - addTime) / 3600000 <= 24 && watchTime - addTime >= 0) lsCount++;
            }
          }
        });
        currentVal = lsCount; break;
      }
      case 'color_palette': currentVal = new Set(validHistory.filter((h) => h.rating !== null).map((h) => h.rating)).size; break;
      case 'caps_lock': currentVal = validHistory.filter((h) => { if (!h.note || h.note.trim().length < 5) return false; const n = h.note.trim(); return /[a-zA-ZğüşöçİĞÜŞÖÇ]/.test(n) && n === n.toLocaleUpperCase('tr-TR'); }).length; break;
      case 'spider_sense': currentVal = state.movies.filter((m) => !m.watched && m.year && parseInt(m.year) > new Date().getFullYear()).length; break;
      case 'time_bender': currentVal = watchedMoviesWithRuntime.reduce((sum, m) => sum + (m.actualRuntime && m.actualRuntime > 0 ? Math.min(m.actualRuntime, m.runtime || 110) : (m.runtime || 0)), 0); break;
      case 'epic_watcher': currentVal = watchedMoviesWithRuntime.filter((m) => (m.runtime || 0) >= 180).length; break;
      case 'short_sweet': currentVal = watchedMoviesWithRuntime.filter((m) => (m.runtime || 0) > 0 && (m.runtime || 0) < 90).length; break;
      case 'couch_potato': {
        const daysRuntime: Record<string, number> = {};
        moviesHistory.forEach((h) => {
          const movie = state.movies.find((m) => m.id === (h.itemId || h.id));
          const mins = h.actualRuntime || movie?.actualRuntime || movie?.runtime;
          if (mins) { const d = h.watchedAt.slice(0, 10); daysRuntime[d] = (daysRuntime[d] || 0) + mins; }
        });
        currentVal = Object.values(daysRuntime).filter((minutes: any) => minutes > 300).length; break;
      }
      case 'live_timer': currentVal = watchedMovies.filter((m) => m.startedAt != null && m.actualRuntime != null).length; break;
      case 'speed_watcher': currentVal = watchedMovies.filter((m) => m.actualRuntime != null && m.runtime != null && m.actualRuntime < m.runtime).length; break;
      case 'time_saver': currentVal = watchedMovies.filter((m) => m.actualRuntime != null && m.runtime != null && m.actualRuntime < m.runtime).reduce((sum, m) => sum + ((m.runtime || 0) - (m.actualRuntime || 0)), 0); break;
      case 'patient_purist': currentVal = watchedMovies.filter((m) => m.startedAt != null && m.actualRuntime != null && m.runtime != null && m.actualRuntime >= m.runtime).length; break;
      case 'secret_speedrunner': currentVal = watchedMovies.filter((m) => m.actualRuntime != null && m.runtime != null && m.runtime >= 90 && m.actualRuntime <= Math.floor(m.runtime / 2)).length; break;
    }

    prog.current = currentVal;

    if (FIXED_BUGGED_ACHIEVEMENTS.has(def.id)) {
      prog.unlockedTiers = prog.unlockedTiers.filter((tName) => {
        const tDef = def.tiers.find((x) => x.tier === tName);
        const keep = tDef ? currentVal >= tDef.threshold : false;
        if (!keep && prog.tierDates) delete prog.tierDates[tName];
        return keep;
      });
    }

    for (const tier of def.tiers) {
      if (currentVal >= tier.threshold) {
        if (!prog.unlockedTiers.includes(tier.tier)) {
          prog.unlockedTiers.push(tier.tier);
          if (!prog.tierDates) prog.tierDates = {};
          prog.tierDates[tier.tier] = new Date().toISOString();
          prog.unlockedAt = new Date().toISOString();
          prog.lastNotifiedTier = tier.tier;
          unlocked.push({ achievementId: def.id, tier: tier.tier, xp: tier.xp, name: tier.name || def.name, icon: def.icon, description: def.description.replace('{threshold}', String(tier.threshold)) });
        } else {
          if (!prog.tierDates) prog.tierDates = {};
          const d = prog.tierDates[tier.tier];
          if (!d || d.startsWith('2000-') || d.startsWith('1970-')) {
            const fb = validHistory.length > 0 ? validHistory[validHistory.length - 1].watchedAt : new Date().toISOString();
            prog.tierDates[tier.tier] = fb;
            if (!prog.unlockedAt || prog.unlockedAt.startsWith('2000-') || prog.unlockedAt.startsWith('1970-')) prog.unlockedAt = fb;
          }
        }
      }
    }
  }

  if (unlocked.length > 0) {
    const existingQueue = state.pendingToasts || [];
    const uniqueUnlocked = unlocked.filter((u) => !existingQueue.some((eq) => eq.achievementId === u.achievementId && eq.tier === u.tier));
    return { ...state, achievements: newAchievements, pendingToasts: [...existingQueue, ...uniqueUnlocked] };
  }
  return { ...state, achievements: newAchievements };
}

function rootReducer(state: ExtendedAppData, action: Action): ExtendedAppData {
  if (action.type === 'IMPORT_DATA') return applyAchievements({ ...defaultData(), ...action.data, achievements: createInitialAchievements(action.data.achievements) });
  if (action.type === 'CONSUME_NEXT_TOAST') {
    const queue = state.pendingToasts || [];
    if (queue.length === 0) return state;
    const currentToast = queue[0], remainingQueue = queue.slice(1), gainedXp = currentToast.xp || 0;
    const newTotalXp = (state.totalXp || 0) + gainedXp;
    const oldLevel = levelFromXp(state.totalXp || 0).level, levelData = levelFromXp(newTotalXp);
    return {
      ...state, totalXp: newTotalXp, xp: levelData.currentLevelXp, level: levelData.level,
      pendingToasts: remainingQueue,
      pendingXpGain: { gained: gainedXp, oldTotal: state.totalXp || 0, newTotal: newTotalXp },
      pendingLevelUp: levelData.level > oldLevel ? { newLevel: levelData.level } : state.pendingLevelUp
    };
  }
  if (action.type === 'CLEAR_LEVELUP') return { ...state, pendingLevelUp: undefined };
  if (action.type === 'CLEAR_XP_GAIN') return { ...state, pendingXpGain: undefined };
  if (action.type === 'TOGGLE_LOCKED_NAMES') return { ...state, showLockedNames: !state.showLockedNames };
  if (action.type === 'SET_ACHIEVEMENT_PROGRESS') return { ...state, achievements: action.progress };
  if (action.type === 'UPDATE_AI_HISTORY') return { ...state, aiChatHistory: action.messages };
  if (action.type === 'UPDATE_ALT_TEMPLATE') return { ...state, altWatchTemplate: action.template };
  if (action.type === 'SET_THEME') return { ...state, theme: action.theme };

  let nextState = { ...state };
  switch (action.type) {
    case 'GRANT_XP': {
      const newTotalXp = state.totalXp + action.xp, oldLevel = levelFromXp(state.totalXp).level, levelData = levelFromXp(newTotalXp);
      return { ...state, totalXp: newTotalXp, xp: levelData.currentLevelXp, level: levelData.level, pendingXpGain: { gained: action.xp, oldTotal: state.totalXp, newTotal: newTotalXp }, pendingLevelUp: levelData.level > oldLevel ? { newLevel: levelData.level } : state.pendingLevelUp };
    }
    case 'MERGE_SHARED_LIST':
      nextState.genres = addNewGenres(state.genres, action.genres);
      nextState.collections = [...state.collections, ...action.collections];
      nextState.movies = [...state.movies, ...action.movies];
      nextState.series = [...state.series, ...action.series]; break;
    case 'ADD_MOVIE': {
      const resolved = resolveTMDBGenres(action.movie.genres, state.genres);
      action.movie.genres = resolved; nextState.genres = addNewGenres(state.genres, resolved); nextState.movies = [...state.movies, action.movie]; break;
    }
    case 'DELETE_MOVIE': nextState.movies = state.movies.filter((m) => m.id !== action.id); break;
    case 'START_WATCHING_MOVIE': nextState.movies = state.movies.map((m) => (m.id === action.id ? { ...m, startedAt: action.startedAt } : m)); break;
    case 'CANCEL_WATCHING_MOVIE': nextState.movies = state.movies.map((m) => (m.id === action.id ? { ...m, startedAt: null } : m)); break;
    case 'WATCH_MOVIE':
      nextState.movies = state.movies.map((m) => (m.id === action.id ? { ...m, watched: true, rating: action.rating, detailedRating: action.detailedRating, reviewTags: action.reviewTags, note: action.note, watchedAt: action.watchedAt, actualRuntime: action.actualRuntime } : m));
      nextState.history = [action.historyItem, ...state.history]; nextState.dailyStreak = updateStreak(state); nextState.dailyStreakDate = todayStr(); nextState.lastWatchDate = todayStr(); break;
    case 'UNWATCH_MOVIE':
      nextState.movies = state.movies.map((m) => (m.id === action.id ? { ...m, watched: false, rating: null, detailedRating: undefined, reviewTags: undefined, note: '', watchedAt: null, startedAt: null, actualRuntime: null } : m));
      nextState.history = state.history.filter((h) => h.itemId !== action.id && h.id !== action.id); break;
    case 'UPDATE_HISTORY_RATING': {
      const hItem = state.history.find((h) => h.id === action.historyId); if (!hItem) break;
      nextState.history = state.history.map((h) => (h.id === action.historyId ? { ...h, rating: action.rating, detailedRating: action.detailedRating, reviewTags: action.reviewTags, note: action.note } : h));
      const targetId = hItem.itemId || hItem.id;
      if (hItem.kind === 'movie' || hItem.type === 'movie') {
        nextState.movies = state.movies.map((m) => (m.id === targetId ? { ...m, rating: action.rating, detailedRating: action.detailedRating, reviewTags: action.reviewTags, note: action.note } : m));
      } else {
        nextState.series = state.series.map((s) => ({ ...s, episodes: s.episodes.map((e) => (e.id === targetId ? { ...e, rating: action.rating, detailedRating: action.detailedRating, reviewTags: action.reviewTags, note: action.note } : e)) }));
      }
      break;
    }
    case 'ADD_SERIES': {
      const resolved = resolveTMDBGenres(action.series.genres, state.genres);
      action.series.genres = resolved; nextState.genres = addNewGenres(state.genres, resolved); nextState.series = [...state.series, action.series]; break;
    }
    case 'DELETE_SERIES': nextState.series = state.series.filter((s) => s.id !== action.id); break;
    case 'COMPLETE_SERIES': break;
    case 'ADD_EPISODES': nextState.series = state.series.map((s) => (s.id === action.seriesId ? { ...s, episodes: [...s.episodes, ...action.episodes] } : s)); break;
    case 'WATCH_EPISODE':
      nextState.series = state.series.map((s) => (s.id === action.seriesId ? { ...s, episodes: s.episodes.map((e) => (e.id === action.episodeId ? { ...e, watched: true, rating: action.rating, detailedRating: action.detailedRating, reviewTags: action.reviewTags, note: action.note, watchedAt: action.watchedAt } : e)) } : s));
      nextState.history = [action.historyItem, ...state.history]; nextState.dailyStreak = updateStreak(state); nextState.dailyStreakDate = todayStr(); nextState.lastWatchDate = todayStr(); break;
    case 'UNWATCH_EPISODE':
      nextState.series = state.series.map((s) => (s.id === action.seriesId ? { ...s, episodes: s.episodes.map((e) => (e.id === action.episodeId ? { ...e, watched: false, rating: null, detailedRating: undefined, reviewTags: undefined, note: '', watchedAt: null } : e)) } : s));
      nextState.history = state.history.filter((h) => h.itemId !== action.episodeId && h.id !== action.episodeId); break;
    case 'DELETE_EPISODE': nextState.series = state.series.map((s) => (s.id === action.seriesId ? { ...s, episodes: s.episodes.filter((e) => e.id !== action.episodeId) } : s)); break;
    case 'ADD_GENRE': if (!state.genres.some((g) => normalize(g) === normalize(action.genre))) nextState.genres = [...state.genres, action.genre]; break;
    case 'DELETE_GENRE': nextState.genres = state.genres.filter((g) => g !== action.genre); break;
    case 'RENAME_GENRE':
      nextState.genres = state.genres.map((g) => (g === action.oldName ? action.newName : g));
      nextState.movies = state.movies.map((m) => ({ ...m, genres: m.genres.map((g) => (g === action.oldName ? action.newName : g)) }));
      nextState.series = state.series.map((s) => ({ ...s, genres: s.genres.map((g) => (g === action.oldName ? action.newName : g)) }));
      nextState.history = state.history.map((h) => ({ ...h, genres: h.genres.map((g) => (g === action.oldName ? action.newName : g)) })); break;
    case 'ADD_REVIEW_TAG': { const cur = state.reviewTags || DEFAULT_REVIEW_TAGS; if (!cur.some((t) => normalize(t) === normalize(action.tag))) nextState.reviewTags = [...cur, action.tag]; break; }
    case 'DELETE_REVIEW_TAG': nextState.reviewTags = (state.reviewTags || DEFAULT_REVIEW_TAGS).filter((t) => t !== action.tag); break;
    case 'RENAME_REVIEW_TAG': {
      nextState.reviewTags = (state.reviewTags || DEFAULT_REVIEW_TAGS).map((t) => (t === action.oldTag ? action.newTag : t));
      nextState.movies = state.movies.map((m) => (m.reviewTags ? { ...m, reviewTags: m.reviewTags.map((t) => (t === action.oldTag ? action.newTag : t)) } : m));
      nextState.series = state.series.map((s) => ({ ...s, episodes: s.episodes.map((e) => (e.reviewTags ? { ...e, reviewTags: e.reviewTags.map((t) => (t === action.oldTag ? action.newTag : t)) } : e)) }));
      nextState.history = state.history.map((h) => (h.reviewTags ? { ...h, reviewTags: h.reviewTags.map((t) => (t === action.oldTag ? action.newTag : t)) } : h)); break;
    }
    case 'EDIT_MOVIE': {
      const resolved = resolveTMDBGenres(action.genres, state.genres); nextState.genres = addNewGenres(state.genres, resolved);
      nextState.movies = state.movies.map((m) => (m.id === action.id ? {
        ...m, title: action.title, year: action.year, genres: resolved, runtime: action.runtime,
        ...(action.posterUrl !== undefined && { posterUrl: action.posterUrl }), ...(action.overview !== undefined && { overview: action.overview }),
        ...(action.tmdbId !== undefined && { tmdbId: action.tmdbId }), ...(action.customUrl !== undefined && { customUrl: action.customUrl }),
        ...(action.imdbId !== undefined && { imdbId: action.imdbId }), ...(action.watchProviders !== undefined && { watchProviders: action.watchProviders }),
        ...(action.extra?.directors !== undefined && { directors: action.extra.directors }), ...(action.extra?.cast !== undefined && { cast: action.extra.cast }),
        ...(action.extra?.studios !== undefined && { studios: action.extra.studios }), ...(action.extra?.keywords !== undefined && { keywords: action.extra.keywords }),
        ...(action.extra?.originalLanguage !== undefined && { originalLanguage: action.extra.originalLanguage })
      } : m)); break;
    }
    case 'EDIT_SERIES': {
      const resolved = resolveTMDBGenres(action.genres, state.genres); nextState.genres = addNewGenres(state.genres, resolved);
      nextState.series = state.series.map((s) => (s.id === action.id ? {
        ...s, title: action.title, genres: resolved, ...(action.year !== undefined && { year: action.year }),
        ...(action.posterUrl !== undefined && { posterUrl: action.posterUrl }), ...(action.overview !== undefined && { overview: action.overview }),
        ...(action.tmdbId !== undefined && { tmdbId: action.tmdbId }), ...(action.customUrl !== undefined && { customUrl: action.customUrl }),
        ...(action.imdbId !== undefined && { imdbId: action.imdbId }), ...(action.watchProviders !== undefined && { watchProviders: action.watchProviders }),
        ...(action.extra?.creators !== undefined && { creators: action.extra.creators }), ...(action.extra?.cast !== undefined && { cast: action.extra.cast }),
        ...(action.extra?.studios !== undefined && { studios: action.extra.studios }), ...(action.extra?.keywords !== undefined && { keywords: action.extra.keywords }),
        ...(action.extra?.originalLanguage !== undefined && { originalLanguage: action.extra.originalLanguage })
      } : s)); break;
    }
    case 'ADD_COLLECTION': nextState.collections = [...state.collections, action.collection]; break;
    case 'DELETE_COLLECTION': nextState.collections = state.collections.filter((c) => c.id !== action.id); nextState.movies = state.movies.map((m) => (m.collectionId === action.id ? { ...m, collectionId: null } : m)); break;
    case 'RENAME_COLLECTION': nextState.collections = state.collections.map((c) => (c.id === action.id ? { ...c, name: action.name } : c)); break;
    case 'SET_MOVIE_COLLECTION': nextState.movies = state.movies.map((m) => (m.id === action.id ? { ...m, collectionId: action.collectionId } : m)); break;
    case 'ADD_CRITERION': nextState.criteria = [...(state.criteria || []), action.criterion]; break;
    case 'EDIT_CRITERION': nextState.criteria = (state.criteria || []).map((c) => (c.id === action.id ? action.criterion : c)); break;
    case 'DELETE_CRITERION': nextState.criteria = (state.criteria || []).filter((c) => c.id !== action.id); break;
  }
  return applyAchievements(nextState);
}

export interface ToastItem { id: string; message: string; type: 'success' | 'warning' | 'error' | 'info'; }
export interface AchievementToastItem { id: string; achievementName: string; tier: string; icon: string; description: string; }
interface LevelUpData { newLevel: number; }
interface SeasonCompleteData { seriesTitle: string; season: number; }

interface AppContextValue {
  data: ExtendedAppData;
  addMovie: (t: string, y: string, g: string[], c: string | null, r?: number, p?: string | null, o?: string, tmdbId?: number, imdbId?: string, watchProviders?: WatchProvider[], extra?: MovieExtraData) => boolean;
  deleteMovie: (id: string) => void;
  startWatchingMovie: (id: string, silent?: boolean) => void;
  togglePauseWatchingMovie: (id: string) => void;
  cancelWatchingMovie: (id: string) => void;
  canRateMovieWithTimer: (id: string) => boolean;
  watchMovie: (id: string, r: number, n: string, dr?: Record<string, number>, reviewTags?: string[]) => void;
  unwatchMovie: (id: string) => void;
  updateHistoryRating: (historyId: string, rating: number, note: string, dr?: Record<string, number>, reviewTags?: string[]) => void;
  addSeries: (t: string, g: string[], s: number[], p?: string | null, o?: string, tmdbId?: number, y?: string, imdbId?: string, watchProviders?: WatchProvider[], extra?: SeriesExtraData) => boolean;
  deleteSeries: (id: string) => void; addEpisodes: (sId: string, s: number, ec: number) => void;
  watchEpisode: (sId: string, eId: string, r: number, n: string, dr?: Record<string, number>, reviewTags?: string[]) => void;
  canWatchEpisode: (sId: string, eId: string) => boolean; unwatchEpisode: (sId: string, eId: string) => void; deleteEpisode: (sId: string, eId: string) => void;
  addGenre: (g: string) => void; deleteGenre: (g: string) => void; renameGenre: (o: string, n: string) => void;
  addReviewTag: (tag: string) => void; deleteReviewTag: (tag: string) => void; renameReviewTag: (oldTag: string, newTag: string) => void;
  editMovie: (i: string, t: string, y: string, g: string[], r?: number, p?: string | null, o?: string, tmdbId?: number, silent?: boolean, customUrl?: string, imdbId?: string, watchProviders?: WatchProvider[], extra?: MovieExtraData) => void;
  editSeries: (i: string, t: string, g: string[], p?: string | null, o?: string, tmdbId?: number, y?: string, silent?: boolean, customUrl?: string, imdbId?: string, watchProviders?: WatchProvider[], extra?: SeriesExtraData) => void;
  addCollection: (n: string) => string; deleteCollection: (i: string) => void; renameCollection: (i: string, n: string) => void; setMovieCollection: (i: string, c: string | null) => void;
  exportData: () => void; importData: (j: string) => boolean; resetData: () => void;
  exportShareList: () => void; importShareList: (j: string) => boolean;
  toasts: ToastItem[]; showToast: (m: string, t?: ToastItem['type']) => void; achievementToasts: AchievementToastItem[];
  levelUpData: LevelUpData | null; seasonCompleteData: SeasonCompleteData | null; dismissLevelUp: () => void; dismissSeasonComplete: () => void;
  toggleLockedNames: () => void; xpGainData: { gained: number; oldTotal: number; newTotal: number } | null;
  updateAIHistory: (messages: AIMessage[]) => void; addCriterion: (criterion: RatingCriterion) => void; editCriterion: (id: string, criterion: RatingCriterion) => void; deleteCriterion: (id: string) => void;
  updateAltWatchTemplate: (template: string) => void; updateTheme: (theme: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);
export function useApp() { const ctx = useContext(AppContext); if (!ctx) throw new Error('useApp must be used within AppProvider'); return ctx; }

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(rootReducer, undefined, () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const parsedData: ExtendedAppData = { ...defaultData(), ...parsed, achievements: createInitialAchievements(parsed.achievements) };
        if (parsedData.aiChatHistory) parsedData.aiChatHistory = parsedData.aiChatHistory.filter((msg: AIMessage) => msg.timestamp >= Date.now() - 3 * 86400000);
        if (!parsedData.criteria) parsedData.criteria = defaultData().criteria;
        if (!parsedData.reviewTags || !Array.isArray(parsedData.reviewTags)) parsedData.reviewTags = DEFAULT_REVIEW_TAGS;
        if (!parsedData.theme) parsedData.theme = 'default';
        return parsedData;
      }
    } catch {}
    return defaultData();
  });

  const toastsRef = useRef<ToastItem[]>([]);
  const achievementToastsRef = useRef<AchievementToastItem[]>([]);
  const xpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingToastRef = useRef(false);
  const [queueTick, setQueueTick] = useState(0);

  const [toasts, setToasts] = useReducer((state: ToastItem[], a: any) => {
    toastsRef.current = a.type === 'add' ? [...state, a.toast] : state.filter((t) => t.id !== a.id);
    return toastsRef.current;
  }, []);

  const [achievementToasts, setAchievementToasts] = useReducer((state: AchievementToastItem[], a: any) => {
    achievementToastsRef.current = a.type === 'add' ? [...state, a.toast] : state.filter((t) => t.id !== a.id);
    return achievementToastsRef.current;
  }, []);

  const [levelUpData, setLevelUpData] = useReducer((_s: any, a: any) => a, null);
  const [seasonCompleteData, setSeasonCompleteData] = useReducer((_s: any, a: any) => a, null);
  const [xpGainData, setXpGainData] = useState<{ gained: number; oldTotal: number; newTotal: number } | null>(null);

  useEffect(() => { document.body.setAttribute('data-theme', data.theme || 'default'); }, [data.theme]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {} }, [data]);
  useEffect(() => { dispatch({ type: 'SYNC_ACHIEVEMENTS' }); }, []);

  const showAchievementToast = useCallback((item: Omit<AchievementToastItem, 'id'>) => {
    const id = uid(); setAchievementToasts({ type: 'add', toast: { ...item, id } });
    setTimeout(() => setAchievementToasts({ type: 'remove', id }), DISPLAY_DURATION_MS);
  }, []);

  useEffect(() => {
    if (data.pendingXpGain) {
      if (xpTimerRef.current) clearTimeout(xpTimerRef.current);
      setXpGainData(data.pendingXpGain);
      xpTimerRef.current = setTimeout(() => { setXpGainData(null); xpTimerRef.current = null; }, DISPLAY_DURATION_MS);
      dispatch({ type: 'CLEAR_XP_GAIN' });
    }
    if (data.pendingLevelUp) {
      setLevelUpData(data.pendingLevelUp);
      import('../lib/sound').then(({ playLevelUpSound }) => playLevelUpSound());
      dispatch({ type: 'CLEAR_LEVELUP' });
    }
  }, [data.pendingXpGain, data.pendingLevelUp]);

  useEffect(() => {
    const queue = data.pendingToasts || [];
    if (queue.length === 0 || levelUpData || isProcessingToastRef.current) return;
    isProcessingToastRef.current = true;
    const nextAchievement = queue[0], remainingCount = queue.length - 1;
    const comboText = remainingCount > 0 ? ` (+${remainingCount} Sırada)` : '';

    showAchievementToast({ achievementName: `${nextAchievement.name}${comboText}`, tier: nextAchievement.tier, icon: nextAchievement.icon, description: nextAchievement.description });
    import('../lib/sound').then(({ playAchievementSound }) => playAchievementSound());
    dispatch({ type: 'CONSUME_NEXT_TOAST' });

    setTimeout(() => { isProcessingToastRef.current = false; setQueueTick((t) => t + 1); }, QUEUE_STEP_DURATION_MS);
  }, [data.pendingToasts, levelUpData, queueTick, showAchievementToast]);

  const showToast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = uid(); setToasts({ type: 'add', toast: { id, message, type } });
    setTimeout(() => setToasts({ type: 'remove', id }), 2800);
  }, []);

  const toggleLockedNames = useCallback(() => dispatch({ type: 'TOGGLE_LOCKED_NAMES' }), []);

  const addMovie = useCallback((title: string, year: string, genres: string[], collectionId: string | null, runtime?: number, posterUrl?: string | null, overview?: string, tmdbId?: number, imdbId?: string, watchProviders?: WatchProvider[], extra?: MovieExtraData): boolean => {
    if (data.movies.some((m) => normalize(m.title) === normalize(title))) { showToast('Bu film zaten listede var!', 'warning'); return false; }
    dispatch({ type: 'ADD_MOVIE', movie: { id: uid(), title: title.trim(), year: year.trim(), genres, collectionId, runtime, posterUrl: posterUrl || undefined, overview: overview || undefined, tmdbId, imdbId, watchProviders, directors: extra?.directors, cast: extra?.cast, studios: extra?.studios, keywords: extra?.keywords, originalLanguage: extra?.originalLanguage, watched: false, rating: null, note: '', watchedAt: null, startedAt: null, actualRuntime: null, addedAt: new Date().toISOString() } });
    showToast('Film eklendi'); return true;
  }, [data.movies, showToast]);

  // 🔒 ENGELLEYİCİ 1: Aynı anda sadece 1 filmin sayacı çalışabilir!
  const startWatchingMovie = useCallback((id: string, silent = false) => {
    const movie = data.movies.find((m) => m.id === id);
    if (!movie || movie.watched) return;
    if (movie.startedAt) return;

    const anotherActive = data.movies.find((m) => !m.watched && m.id !== id && m.startedAt);
    if (anotherActive) {
      if (!silent) showToast(`⛔ Sayaç Engelleyici: Şu anda "${anotherActive.title}" için sayaç zaten açık! Önce onu tamamla veya iptal et.`, 'warning');
      return;
    }

    dispatch({ type: 'START_WATCHING_MOVIE', id, startedAt: new Date().toISOString() });
    showToast(`⏳ "${movie.title}" için geri sayım başladı!`, 'info');
  }, [data.movies, showToast]);

  // ⏸️ DURAKLAT / DEVAM ET KONTROLÜ
  const togglePauseWatchingMovie = useCallback((id: string) => {
    const movie = data.movies.find((m) => m.id === id);
    if (!movie || !movie.startedAt) return;
    const info = getMovieTimerInfo(movie);

    if (info.isPaused) {
      const resumedStart = new Date(Date.now() - info.elapsedSec * 1000).toISOString();
      dispatch({ type: 'START_WATCHING_MOVIE', id, startedAt: resumedStart });
      showToast('▶️ Geri sayım kaldığı yerden devam ediyor', 'info');
    } else {
      dispatch({ type: 'START_WATCHING_MOVIE', id, startedAt: `PAUSED:${info.elapsedSec}` });
      showToast('⏸️ Geri sayım duraklatıldı', 'warning');
    }
  }, [data.movies, showToast]);

  const cancelWatchingMovie = useCallback((id: string) => {
    dispatch({ type: 'CANCEL_WATCHING_MOVIE', id });
    showToast('İzleme sayacı iptal edildi', 'info');
  }, [showToast]);

  // ⛔ ENGELLEYİCİ 2: Minimum izleme süresi (%25) geçmeden sayaçlı puanlamayı engeller!
  const canRateMovieWithTimer = useCallback((id: string): boolean => {
    const movie = data.movies.find((m) => m.id === id);
    if (!movie || !movie.startedAt) return true;
    const info = getMovieTimerInfo(movie);
    if (!info.canRateWithTimer) {
      showToast(`⛔ Sayaç Engelleyici: Henüz ${info.elapsedMins} dk geçti! Puanlamak için en az ${info.minRequiredMins} dk geçmeli (veya X ile sayacı iptal et).`, 'error');
      return false;
    }
    return true;
  }, [data.movies, showToast]);

  const watchMovie = useCallback((id: string, rating: number, note: string, detailedRating?: Record<string, number>, reviewTags?: string[]) => {
    const movie = data.movies.find((m) => m.id === id); if (!movie) return;
    const now = new Date().toISOString();
    const info = getMovieTimerInfo(movie);
    let actualRuntime = info.maxMins;

    if (movie.startedAt && info.canRateWithTimer) {
      actualRuntime = Math.min(Math.max(1, info.elapsedMins), info.maxMins);
    }

    dispatch({
      type: 'WATCH_MOVIE', id, rating, detailedRating, reviewTags, note, watchedAt: now, actualRuntime,
      historyItem: {
        id: uid(), itemId: movie.id, kind: 'movie', type: 'movie', title: movie.title,
        rating, detailedRating, reviewTags, note, watchedAt: now,
        startedAt: movie.startedAt || null, actualRuntime, originalRuntime: info.maxMins,
        genres: movie.genres, year: movie.year
      }
    });

    if (movie.startedAt && actualRuntime < info.maxMins) {
      showToast(`Film ${actualRuntime} dk'da bitti! (${info.maxMins - actualRuntime} dk kazandın ⚡)`, 'success');
    }
  }, [data.movies, showToast]);

  const updateHistoryRating = useCallback((historyId: string, rating: number, note: string, detailedRating?: Record<string, number>, reviewTags?: string[]) => {
    dispatch({ type: 'UPDATE_HISTORY_RATING', historyId, rating, note, detailedRating, reviewTags }); showToast('Puan güncellendi');
  }, [showToast]);

  const addSeries = useCallback((title: string, genres: string[], seasons: number[], posterUrl?: string | null, overview?: string, tmdbId?: number, year?: string, imdbId?: string, watchProviders?: WatchProvider[], extra?: SeriesExtraData): boolean => {
    if (data.removedSeriesTitles.some((t) => normalize(t) === normalize(title))) { showToast('Daha önce tamamlandı!', 'warning'); return false; }
    if (data.series.some((s) => normalize(s.title) === normalize(title))) { showToast('Bu dizi zaten listede var!', 'warning'); return false; }
    const episodes: Episode[] = [];
    seasons.forEach((epCount, s) => { for (let e = 1; e <= epCount; e++) episodes.push({ id: uid(), season: s + 1, episode: e, watched: false, rating: null, note: '', watchedAt: null }); });
    dispatch({ type: 'ADD_SERIES', series: { id: uid(), title: title.trim(), genres, episodes, posterUrl: posterUrl || undefined, overview: overview || undefined, tmdbId, year, imdbId, watchProviders, creators: extra?.creators, cast: extra?.cast, studios: extra?.studios, keywords: extra?.keywords, originalLanguage: extra?.originalLanguage, addedAt: new Date().toISOString() } });
    showToast('Dizi eklendi'); return true;
  }, [data.series, data.removedSeriesTitles, showToast]);

  const watchEpisode = useCallback((seriesId: string, episodeId: string, rating: number, note: string, detailedRating?: Record<string, number>, reviewTags?: string[]) => {
    const series = data.series.find((s) => s.id === seriesId); if (!series) return;
    const ep = series.episodes.find((e) => e.id === episodeId); if (!ep) return;
    const now = new Date().toISOString();
    dispatch({ type: 'WATCH_EPISODE', seriesId, episodeId, rating, detailedRating, reviewTags, note, watchedAt: now, historyItem: { id: uid(), itemId: ep.id, seriesId: series.id, kind: 'series', type: 'series', title: series.title, rating, detailedRating, reviewTags, note, watchedAt: now, genres: series.genres, season: ep.season, episode: ep.episode } });
    setTimeout(() => {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const updatedSeries = state.series?.find((s: any) => s.id === seriesId);
      if (updatedSeries) {
        if (updatedSeries.episodes.filter((e: any) => e.season === ep.season).every((e: any) => e.watched)) setSeasonCompleteData({ seriesTitle: updatedSeries.title, season: ep.season });
        if (updatedSeries.episodes.every((e: any) => e.watched)) { dispatch({ type: 'COMPLETE_SERIES', id: seriesId, title: updatedSeries.title }); showToast(`${updatedSeries.title} tamamlandı!`, 'success'); }
      }
    }, 200);
  }, [data.series, showToast]);

  const deleteMovie = useCallback((id: string) => dispatch({ type: 'DELETE_MOVIE', id }), []);
  const unwatchMovie = useCallback((id: string) => dispatch({ type: 'UNWATCH_MOVIE', id }), []);
  const deleteSeries = useCallback((id: string) => dispatch({ type: 'DELETE_SERIES', id }), []);
  const addEpisodes = useCallback((sId: string, s: number, ec: number) => {
    const series = data.series.find((x) => x.id === sId); if (!series) return;
    const startEp = series.episodes.filter((e) => e.season === s).length > 0 ? Math.max(...series.episodes.filter((e) => e.season === s).map((e) => e.episode)) + 1 : 1;
    dispatch({ type: 'ADD_EPISODES', seriesId: sId, episodes: Array.from({ length: ec }, (_, i) => ({ id: uid(), season: s, episode: startEp + i, watched: false, rating: null, note: '', watchedAt: null })) });
    showToast(`${ec} bölüm eklendi`);
  }, [data.series, showToast]);

  const canWatchEpisode = useCallback((sId: string, eId: string): boolean => {
    const series = data.series.find((s) => s.id === sId); if (!series) return false;
    const ep = series.episodes.find((e) => e.id === eId); if (!ep || ep.watched) return false;
    return [...series.episodes].sort((a, b) => a.season - b.season || a.episode - b.episode).find((e) => !e.watched)?.id === eId;
  }, [data.series]);

  const unwatchEpisode = useCallback((sId: string, eId: string) => dispatch({ type: 'UNWATCH_EPISODE', seriesId: sId, episodeId: eId }), []);
  const deleteEpisode = useCallback((sId: string, eId: string) => dispatch({ type: 'DELETE_EPISODE', seriesId: sId, episodeId: eId }), []);
  const addGenre = useCallback((g: string) => { if (!data.genres.some((x) => normalize(x) === normalize(g))) { dispatch({ type: 'ADD_GENRE', genre: g.trim() }); showToast('Tür eklendi'); } }, [data.genres, showToast]);
  const deleteGenre = useCallback((g: string) => dispatch({ type: 'DELETE_GENRE', genre: g }), []);
  const renameGenre = useCallback((o: string, n: string) => { if (n.trim()) { dispatch({ type: 'RENAME_GENRE', oldName: o, newName: n.trim() }); showToast('Tür güncellendi'); } }, [showToast]);

  const addReviewTag = useCallback((tag: string) => {
    const clean = tag.trim(); if (!clean) return;
    if ((data.reviewTags || []).some((x) => normalize(x) === normalize(clean))) { showToast('Bu başlık zaten mevcut!', 'warning'); return; }
    dispatch({ type: 'ADD_REVIEW_TAG', tag: clean }); showToast('Değerlendirme başlığı eklendi');
  }, [data.reviewTags, showToast]);
  const deleteReviewTag = useCallback((tag: string) => { dispatch({ type: 'DELETE_REVIEW_TAG', tag }); showToast('Başlık silindi'); }, [showToast]);
  const renameReviewTag = useCallback((oldTag: string, newTag: string) => { if (newTag.trim()) { dispatch({ type: 'RENAME_REVIEW_TAG', oldTag, newTag: newTag.trim() }); showToast('Başlık güncellendi'); } }, [showToast]);

  const editMovie = useCallback((i: string, t: string, y: string, g: string[], r?: number, p?: string | null, o?: string, tmdbId?: number, silent = false, customUrl?: string, imdbId?: string, watchProviders?: WatchProvider[], extra?: MovieExtraData) => {
    dispatch({ type: 'EDIT_MOVIE', id: i, title: t, year: y, genres: g, runtime: r, posterUrl: p || undefined, overview: o || undefined, tmdbId, customUrl, imdbId, watchProviders, extra });
    if (!silent) showToast('Film güncellendi');
  }, [showToast]);

  const editSeries = useCallback((i: string, t: string, g: string[], p?: string | null, o?: string, tmdbId?: number, y?: string, silent = false, customUrl?: string, imdbId?: string, watchProviders?: WatchProvider[], extra?: SeriesExtraData) => {
    dispatch({ type: 'EDIT_SERIES', id: i, title: t, genres: g, posterUrl: p || undefined, overview: o || undefined, tmdbId, year: y, customUrl, imdbId, watchProviders, extra });
    if (!silent) showToast('Dizi güncellendi');
  }, [showToast]);

  const addCollection = useCallback((n: string) => { const id = uid(); dispatch({ type: 'ADD_COLLECTION', collection: { id, name: n.trim() } }); showToast('Koleksiyon eklendi'); return id; }, [showToast]);
  const deleteCollection = useCallback((id: string) => dispatch({ type: 'DELETE_COLLECTION', id }), []);
  const renameCollection = useCallback((i: string, n: string) => { dispatch({ type: 'RENAME_COLLECTION', id: i, name: n.trim() }); showToast('Koleksiyon güncellendi'); }, [showToast]);
  const setMovieCollection = useCallback((i: string, c: string | null) => dispatch({ type: 'SET_MOVIE_COLLECTION', id: i, collectionId: c }), []);

  const updateAIHistory = useCallback((messages: AIMessage[]) => dispatch({ type: 'UPDATE_AI_HISTORY', messages }), []);
  const addCriterion = useCallback((c: RatingCriterion) => { dispatch({ type: 'ADD_CRITERION', criterion: c }); showToast('Kriter Eklendi'); }, [showToast]);
  const editCriterion = useCallback((id: string, c: RatingCriterion) => { dispatch({ type: 'EDIT_CRITERION', id, criterion: c }); showToast('Kriter Güncellendi'); }, [showToast]);
  const deleteCriterion = useCallback((id: string) => { dispatch({ type: 'DELETE_CRITERION', id }); showToast('Kriter Silindi'); }, [showToast]);
  const updateAltWatchTemplate = useCallback((template: string) => { dispatch({ type: 'UPDATE_ALT_TEMPLATE', template }); showToast('Alternatif izleme şablonu güncellendi', 'success'); }, [showToast]);
  const updateTheme = useCallback((theme: string) => { dispatch({ type: 'SET_THEME', theme }); showToast('Tema değiştirildi', 'success'); }, [showToast]);

  const exportData = useCallback(() => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `sinevia-yedek-${todayStr()}.json`; a.click(); URL.revokeObjectURL(url); showToast('Yedek alındı');
  }, [data, showToast]);

  const importData = useCallback((json: string) => { try { dispatch({ type: 'IMPORT_DATA', data: { ...defaultData(), ...JSON.parse(json) } }); showToast('Veriler geri yüklendi'); return true; } catch { showToast('Hata', 'error'); return false; } }, [showToast]);
  const resetData = useCallback(() => { dispatch({ type: 'IMPORT_DATA', data: defaultData() }); showToast('Sıfırlandı'); }, [showToast]);

  const exportShareList = useCallback(() => {
    const sharePayload = {
      isShareList: true, exportedAt: new Date().toISOString(),
      collections: data.collections.map((c) => ({ id: c.id, name: c.name })),
      movies: data.movies.map((m) => ({
        title: m.title, year: m.year, genres: m.genres, collectionId: m.collectionId, runtime: m.runtime,
        posterUrl: m.posterUrl, overview: m.overview, tmdbId: m.tmdbId, imdbId: m.imdbId, watchProviders: m.watchProviders,
        directors: m.directors, cast: m.cast, studios: m.studios, keywords: m.keywords, originalLanguage: m.originalLanguage, customUrl: m.customUrl
      })),
      series: data.series.map((s) => ({
        title: s.title, year: s.year, genres: s.genres, posterUrl: s.posterUrl, overview: s.overview,
        tmdbId: s.tmdbId, imdbId: s.imdbId, watchProviders: s.watchProviders, creators: s.creators,
        cast: s.cast, studios: s.studios, keywords: s.keywords, originalLanguage: s.originalLanguage, customUrl: s.customUrl,
        episodes: (s.episodes || []).map((e) => ({ season: e.season, episode: e.episode }))
      }))
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(sharePayload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `sinevia-liste-paylasimi-${todayStr()}.json`; a.click(); URL.revokeObjectURL(url);
    showToast('Paylaşım listesi indirildi!', 'success');
  }, [data.collections, data.movies, data.series, showToast]);

  const importShareList = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      const incMovies: any[] = Array.isArray(parsed.movies) ? parsed.movies : [];
      const incSeries: any[] = Array.isArray(parsed.series) ? parsed.series : [];
      const incCols: any[] = Array.isArray(parsed.collections) ? parsed.collections : [];

      const colIdMap = new Map<string, string>();
      const newCollections: Collection[] = [];
      const tempCols = [...data.collections];

      incCols.forEach((ic) => {
        if (!ic || !ic.name) return;
        const ex = tempCols.find((c) => normalize(c.name) === normalize(ic.name));
        if (ex) colIdMap.set(ic.id, ex.id);
        else { const nid = uid(), nc = { id: nid, name: ic.name.trim() }; newCollections.push(nc); tempCols.push(nc); colIdMap.set(ic.id, nid); }
      });

      let tempGenres = [...data.genres];
      const newMovies: Movie[] = [];
      const existingMovieTitles = new Set(data.movies.map((m) => normalize(m.title)));

      incMovies.forEach((im) => {
        if (!im || !im.title) return;
        const normTitle = normalize(im.title);
        if (existingMovieTitles.has(normTitle)) return;
        existingMovieTitles.add(normTitle);
        const resolvedGenres = resolveTMDBGenres(Array.isArray(im.genres) ? im.genres : [], tempGenres);
        tempGenres = addNewGenres(tempGenres, resolvedGenres);
        newMovies.push({
          id: uid(), title: im.title.trim(), year: im.year ? String(im.year).trim() : '',
          genres: resolvedGenres, collectionId: im.collectionId && colIdMap.has(im.collectionId) ? colIdMap.get(im.collectionId)! : null,
          runtime: im.runtime, posterUrl: im.posterUrl || undefined, overview: im.overview || undefined,
          tmdbId: im.tmdbId, imdbId: im.imdbId, watchProviders: im.watchProviders,
          directors: im.directors, cast: im.cast, studios: im.studios, keywords: im.keywords,
          originalLanguage: im.originalLanguage, customUrl: im.customUrl,
          watched: false, rating: null, note: '', watchedAt: null, startedAt: null, actualRuntime: null, addedAt: new Date().toISOString()
        });
      });

      const newSeries: Series[] = [];
      const existingSeriesTitles = new Set([...data.series.map((s) => normalize(s.title)), ...data.removedSeriesTitles.map((t) => normalize(t))]);

      incSeries.forEach((is) => {
        if (!is || !is.title) return;
        const normTitle = normalize(is.title);
        if (existingSeriesTitles.has(normTitle)) return;
        existingSeriesTitles.add(normTitle);
        const resolvedGenres = resolveTMDBGenres(Array.isArray(is.genres) ? is.genres : [], tempGenres);
        tempGenres = addNewGenres(tempGenres, resolvedGenres);
        const episodes: Episode[] = Array.isArray(is.episodes)
          ? is.episodes.map((ep: any) => ({ id: uid(), season: Number(ep.season) || 1, episode: Number(ep.episode) || 1, watched: false, rating: null, note: '', watchedAt: null }))
          : [];
        newSeries.push({
          id: uid(), title: is.title.trim(), year: is.year ? String(is.year).trim() : undefined,
          genres: resolvedGenres, episodes, posterUrl: is.posterUrl || undefined, overview: is.overview || undefined,
          tmdbId: is.tmdbId, imdbId: is.imdbId, watchProviders: is.watchProviders,
          creators: is.creators, cast: is.cast, studios: is.studios, keywords: is.keywords,
          originalLanguage: is.originalLanguage, customUrl: is.customUrl, addedAt: new Date().toISOString()
        });
      });

      if (newMovies.length === 0 && newSeries.length === 0 && newCollections.length === 0) {
        showToast('Listendeki tüm film ve diziler zaten mevcut!', 'info');
        return true;
      }

      dispatch({ type: 'MERGE_SHARED_LIST', movies: newMovies, series: newSeries, collections: newCollections, genres: tempGenres });
      showToast(`${newMovies.length} yeni film ve ${newSeries.length} yeni dizi eklendi!`, 'success');
      return true;
    } catch {
      showToast('Geçersiz paylaşım dosyası!', 'error');
      return false;
    }
  }, [data.collections, data.genres, data.movies, data.removedSeriesTitles, data.series, showToast]);

  const dismissLevelUp = useCallback(() => setLevelUpData(null), []);
  const dismissSeasonComplete = useCallback(() => setSeasonCompleteData(null), []);

  return (
    <AppContext.Provider value={{ data, addMovie, deleteMovie, startWatchingMovie, togglePauseWatchingMovie, cancelWatchingMovie, canRateMovieWithTimer, watchMovie, unwatchMovie, updateHistoryRating, addSeries, deleteSeries, addEpisodes, watchEpisode, canWatchEpisode, unwatchEpisode, deleteEpisode, addGenre, deleteGenre, renameGenre, addReviewTag, deleteReviewTag, renameReviewTag, editMovie, editSeries, addCollection, deleteCollection, renameCollection, setMovieCollection, exportData, importData, resetData, exportShareList, importShareList, toasts, showToast, achievementToasts, levelUpData, seasonCompleteData, dismissLevelUp, dismissSeasonComplete, toggleLockedNames, xpGainData, updateAIHistory, addCriterion, editCriterion, deleteCriterion, updateAltWatchTemplate, updateTheme }}>
      {children}
    </AppContext.Provider>
  );
}

function updateStreak(data: ExtendedAppData): number {
  const today = todayStr();
  if (data.dailyStreakDate === today) return data.dailyStreak;
  if (data.dailyStreakDate) {
    if (daysBetween(data.dailyStreakDate, today) === 1) return data.dailyStreak + 1;
    if (daysBetween(data.dailyStreakDate, today) > 1) return 1;
  }
  return 1;
}