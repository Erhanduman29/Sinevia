import { createContext, useContext, useEffect, useReducer, useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppData, Movie, Series, Episode, Collection, WatchHistoryItem, AchievementProgress, RatingCriterion } from '../types';
import { normalize, uid, todayStr, daysBetween } from '../lib/utils';
import { ACHIEVEMENT_DEFS } from '../lib/achievements';
import { levelFromXp } from '../lib/xp';

const STORAGE_KEY = 'sinevia-v1';
const DEFAULT_GENRES = ['Aksiyon', 'Macera', 'Komedi', 'Dram', 'Korku', 'Bilim Kurgu', 'Fantastik', 'Romantik', 'Gerilim', 'Suç', 'Belgesel', 'Animasyon'];

export interface AIMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number; 
  actionItems?: any[]; 
}

interface ExtendedAppData extends AppData {
  aiChatHistory?: AIMessage[];
}

function defaultData(): ExtendedAppData {
  return {
    movies: [], series: [], removedSeriesTitles: [], collections: [],
    genres: DEFAULT_GENRES, history: [], achievements: [],
    criteria: [
      { id: 'crit_1', name: 'Senaryo ve Hikaye', weight: 10, appliesTo: 'both', genres: [] },
      { id: 'crit_2', name: 'Oyunculuk', weight: 8, appliesTo: 'both', genres: [] },
      { id: 'crit_3', name: 'Görsel Yönetim', weight: 7, appliesTo: 'both', genres: [] }
    ],
    xp: 0, level: 1, totalXp: 0, lastWatchDate: null,
    dailyStreak: 0, dailyStreakDate: null, showLockedNames: false,
    aiChatHistory: [] 
  };
}

export function resolveTMDBGenres(incomingGenres: string[], existingGenres: string[]): string[] {
  const resolved = incomingGenres.map(incoming => {
    const cleanIn = normalize(incoming).replace(/[\s-]/g, '');
    let match = existingGenres.find(g => normalize(g).replace(/[\s-]/g, '') === cleanIn);
    if (match) return match;
    match = existingGenres.find(g => {
      const cleanG = normalize(g).replace(/[\s-]/g, '');
      if (cleanG.length < 3 || cleanIn.length < 3) return false;
      return cleanIn.startsWith(cleanG) || cleanG.startsWith(cleanIn);
    });
    return match || incoming;
  });
  return Array.from(new Set(resolved));
}

function addNewGenres(currentGenres: string[], incomingGenres: string[]): string[] {
  const newItems = incomingGenres.filter(incoming => !currentGenres.some(current => normalize(current) === normalize(incoming)));
  if (newItems.length > 0) {
    return [...currentGenres, ...newItems];
  }
  return currentGenres;
}

type Action =
  | { type: 'ADD_MOVIE'; movie: Movie }
  | { type: 'DELETE_MOVIE'; id: string }
  | { type: 'WATCH_MOVIE'; id: string; rating: number; note: string; detailedRating?: Record<string, number>; watchedAt: string; historyItem: WatchHistoryItem }
  | { type: 'UNWATCH_MOVIE'; id: string }
  | { type: 'UPDATE_HISTORY_RATING'; historyId: string; rating: number; note: string; detailedRating?: Record<string, number> }
  | { type: 'ADD_SERIES'; series: Series }
  | { type: 'DELETE_SERIES'; id: string }
  | { type: 'COMPLETE_SERIES'; id: string; title: string }
  | { type: 'ADD_EPISODES'; seriesId: string; episodes: Episode[] }
  | { type: 'WATCH_EPISODE'; seriesId: string; episodeId: string; rating: number; note: string; detailedRating?: Record<string, number>; watchedAt: string; historyItem: WatchHistoryItem }
  | { type: 'UNWATCH_EPISODE'; seriesId: string; episodeId: string }
  | { type: 'DELETE_EPISODE'; seriesId: string; episodeId: string }
  | { type: 'ADD_GENRE'; genre: string }
  | { type: 'DELETE_GENRE'; genre: string }
  | { type: 'RENAME_GENRE'; oldName: string; newName: string }
  | { type: 'EDIT_MOVIE'; id: string; title: string; year: string; genres: string[]; runtime?: number; posterUrl?: string; overview?: string; tmdbId?: number }
  | { type: 'EDIT_SERIES'; id: string; title: string; genres: string[]; year?: string; posterUrl?: string; overview?: string; tmdbId?: number }
  | { type: 'ADD_COLLECTION'; collection: Collection }
  | { type: 'DELETE_COLLECTION'; id: string }
  | { type: 'RENAME_COLLECTION'; id: string; name: string }
  | { type: 'SET_MOVIE_COLLECTION'; id: string; collectionId: string | null }
  | { type: 'IMPORT_DATA'; data: ExtendedAppData }
  | { type: 'SET_ACHIEVEMENT_PROGRESS'; progress: AchievementProgress[] }
  | { type: 'TOGGLE_LOCKED_NAMES' }
  | { type: 'CLEAR_TOASTS' }
  | { type: 'CLEAR_LEVELUP' }
  | { type: 'CLEAR_XP_GAIN' }
  | { type: 'SYNC_ACHIEVEMENTS' }
  | { type: 'UPDATE_AI_HISTORY'; messages: AIMessage[] }
  | { type: 'ADD_CRITERION'; criterion: RatingCriterion }
  | { type: 'EDIT_CRITERION'; id: string; criterion: RatingCriterion }
  | { type: 'DELETE_CRITERION'; id: string }
  | { type: 'GRANT_XP'; xp: number };

function applyAchievements(state: ExtendedAppData): ExtendedAppData {
  const unlocked: { achievementId: string; tier: string; xp: number; name: string; icon: string; description: string }[] = [];
  const validHistory = [...(state.history || [])].filter((h) => h.watchedAt).sort((a, b) => new Date(a.watchedAt).getTime() - new Date(b.watchedAt).getTime());
  const moviesHistory = validHistory.filter(h => h.type === 'movie' || h.kind === 'movie');
  const seriesHistory = validHistory.filter(h => h.type === 'series' || h.kind === 'series');

  const calcMaxStreak = (hist: any[], typeMatch?: string) => {
    const dates = hist.filter(h => !typeMatch || h.type === typeMatch || h.kind === typeMatch).map(h => h.watchedAt.slice(0, 10));
    const unique = Array.from(new Set(dates)).sort();
    let max = 0, current = 0;
    for (let i = 0; i < unique.length; i++) {
      if (i === 0) { current = 1; max = 1; continue; }
      const diff = Math.round((new Date(unique[i]).getTime() - new Date(unique[i-1]).getTime()) / 86400000);
      if (diff === 1) current++; else current = 1;
      if (current > max) max = current;
    }
    return max;
  };

  const checkGenre = (genres: string[] | undefined, words: string[]) => {
    if (!genres) return false;
    return genres.some(g => {
      const trLower = g.toLocaleLowerCase('tr-TR');
      const enLower = g.toLowerCase();
      return words.some(w => trLower.includes(w) || enLower.includes(w));
    });
  };

  const newAchievements = state.achievements.map(a => ({ ...a, unlockedTiers: [...(a.unlockedTiers || [])], tierDates: { ...(a.tierDates || {}) } }));
  const progressMap = new Map(newAchievements.map(a => [a.achievementId, a]));

  const watchedMoviesWithRuntime = state.movies.filter(m => m.watched && m.runtime);

  for (const def of ACHIEVEMENT_DEFS) {
    const prog = progressMap.get(def.id);
    if (!prog) continue;

    let currentVal = 0;
    
    switch (def.id) {
      case 'movie_add': currentVal = state.movies.length; break;
      case 'series_add': currentVal = state.series.length; break;
      case 'daily_movie': currentVal = calcMaxStreak(validHistory, 'movie'); break;
      case 'daily_series': currentVal = calcMaxStreak(validHistory, 'series'); break;
      
      case 'movie_genre_action': currentVal = moviesHistory.filter(h => checkGenre(h.genres, ['aksiyon', 'action'])).length; break;
      case 'series_genre_action': currentVal = new Set(seriesHistory.filter(h => checkGenre(h.genres, ['aksiyon', 'action'])).map(h => h.seriesId)).size; break;
      case 'movie_genre_comedy': currentVal = moviesHistory.filter(h => checkGenre(h.genres, ['komedi', 'comedy'])).length; break;
      case 'series_genre_comedy': currentVal = new Set(seriesHistory.filter(h => checkGenre(h.genres, ['komedi', 'comedy'])).map(h => h.seriesId)).size; break;
      case 'movie_genre_drama': currentVal = moviesHistory.filter(h => checkGenre(h.genres, ['dram', 'drama'])).length; break;
      case 'series_genre_drama': currentVal = new Set(seriesHistory.filter(h => checkGenre(h.genres, ['dram', 'drama'])).map(h => h.seriesId)).size; break;
      case 'movie_genre_horror': currentVal = moviesHistory.filter(h => checkGenre(h.genres, ['korku', 'horror'])).length; break;
      case 'series_genre_horror': currentVal = new Set(seriesHistory.filter(h => checkGenre(h.genres, ['korku', 'horror'])).map(h => h.seriesId)).size; break;
      case 'movie_genre_scifi': currentVal = moviesHistory.filter(h => checkGenre(h.genres, ['bilim kurgu', 'bilimkurgu', 'sci-fi', 'scifi'])).length; break;
      case 'series_genre_scifi': currentVal = new Set(seriesHistory.filter(h => checkGenre(h.genres, ['bilim kurgu', 'bilimkurgu', 'sci-fi', 'scifi'])).map(h => h.seriesId)).size; break;
      
      case 'perfect_rating': case 'secret_perfectionist': currentVal = validHistory.filter(h => h.rating === 10).length; break;
      case 'high_rating': currentVal = validHistory.filter(h => h.rating === 9 || h.rating === 9.5).length; break;
      case 'low_rating': case 'secret_critic': currentVal = validHistory.filter(h => h.rating !== null && h.rating <= 3).length; break;
      case 'first_rating': currentVal = validHistory.filter(h => h.rating !== null).length; break;
      case 'strict_critic': currentVal = validHistory.filter(h => h.rating !== null && h.note && h.note.trim().length > 0).length; break;
      
      case 'total_watch': currentVal = validHistory.length; break;
      case 'genre_explorer': currentVal = new Set(validHistory.flatMap(h => h.genres || [])).size; break;
      case 'note_taker': currentVal = validHistory.filter(h => h.note && h.note.trim().length > 0).length; break;
      case 'night_owl': currentVal = validHistory.filter(h => { const hr = new Date(h.watchedAt).getHours(); return hr >= 0 && hr < 5; }).length; break;
      case 'weekend_watcher': currentVal = validHistory.filter(h => { const d = new Date(h.watchedAt).getDay(); return d === 0 || d === 6; }).length; break;
      
      case 'marathon': {
        const days:any = {}; validHistory.forEach(h => { const d = h.watchedAt.slice(0, 10); days[d] = (days[d]||0)+1; });
        currentVal = Object.values(days).filter((c:any) => c >= 3).length; break;
      }
      case 'secret_binge': {
        const days:any = {}; seriesHistory.forEach(h => { const d = h.watchedAt.slice(0, 10); days[d] = (days[d]||0)+1; });
        currentVal = Math.max(0, ...Object.values(days as Record<string,number>)); break;
      }
      case 'season_complete': {
        let c = 0;
        state.series.forEach(s => {
          const eps = s.episodes || []; const seas = new Set(eps.map(e => e.season));
          seas.forEach(season => { const sEps = eps.filter(e => e.season === season); if (sEps.length > 0 && sEps.every(e => e.watched)) c++; });
        });
        currentVal = c; break;
      }
      case 'collection_complete': {
        let c = 0;
        (state.collections || []).forEach(col => {
          const cm = state.movies.filter(m => m.collectionId === col.id);
          if (cm.length > 0 && cm.every(m => m.watched)) c++;
        });
        currentVal = c; break;
      }
      
      case 'sinevia_legend': currentVal = validHistory.length; break;
      case 'caveman': {
        const days:any = {}; validHistory.forEach(h => { const d = h.watchedAt.slice(0, 10); days[d] = (days[d]||0)+1; });
        let streak = 0, maxS = 0; const sortedDays = Object.keys(days).sort();
        for (let i = 0; i < sortedDays.length; i++) {
          if (days[sortedDays[i]] >= 5) {
            if (i > 0) {
              const diff = Math.round((new Date(sortedDays[i]).getTime() - new Date(sortedDays[i - 1]).getTime()) / 86400000);
              if (diff === 1) streak++; else streak = 1;
            } else streak = 1;
          } else streak = 0;
          if (streak > maxS) maxS = streak;
        }
        currentVal = maxS; break;
      }
      case 'hater': currentVal = validHistory.filter(h => h.rating !== null && h.rating <= 2).length; break;
      case 'epic_writer': currentVal = validHistory.filter(h => h.note && h.note.trim().length >= 5000).length; break;
      case 'ghost_viewer': currentVal = validHistory.filter(h => h.rating === null && (!h.note || h.note.trim() === '')).length; break;
      case 'trash_lover': currentVal = validHistory.filter(h => h.rating !== null && h.rating < 3 && h.note && h.note.trim().length >= 500).length; break;
      
      case 'polarization': {
        const tens = validHistory.filter(h => h.rating === 10).length;
        const lows = validHistory.filter(h => h.rating !== null && h.rating <= 2).length;
        currentVal = (tens >= 20 && lows >= 20) ? 1 : 0; break;
      }
      
      case 'new_year_lonely': {
        currentVal = validHistory.filter(h => { 
          const d = new Date(h.watchedAt); 
          const month = d.getMonth();
          const hr = d.getHours();
          return (month === 11 && d.getDate() === 31 && hr >= 20) || (month === 0 && d.getDate() === 1 && hr <= 4);
        }).length;
        break;
      }
      
      case 'cinephile': currentVal = (seriesHistory.length > 0) ? 0 : moviesHistory.length; break;
      case 'short_day_profit': {
        const days:any = {}; moviesHistory.forEach(h => { const d = h.watchedAt.slice(0, 10); days[d] = (days[d]||0)+1; });
        currentVal = Object.values(days).filter((c:any) => c >= 3).length; break;
      }
      
      case 'selective_critic': {
        const rated = moviesHistory.filter(h => h.rating !== null);
        currentVal = !rated.some(r => r.rating === 10) ? rated.length : 0; 
        break;
      }
      
      case 'weekend_cinema': {
        const wknd: any = {};
        moviesHistory.forEach(h => {
          const d = new Date(h.watchedAt);
          if (d.getDay() === 0 || d.getDay() === 6) {
            const sat = new Date(d); if (d.getDay() === 0) sat.setDate(sat.getDate() - 1);
            wknd[sat.toISOString().slice(0, 10)] = (wknd[sat.toISOString().slice(0, 10)] || 0) + 1;
          }
        });
        currentVal = Math.max(0, ...Object.values(wknd as Record<string, number>)); break;
      }
      case 'episode_monster': currentVal = seriesHistory.length; break;
      case 'patience_stone': currentVal = state.series.filter(s => {
          if (!s.episodes || s.episodes.length === 0) return false;
          const maxS = Math.max(...s.episodes.map(e => e.season));
          return maxS >= 8 && s.episodes.every(e => e.watched);
        }).length; break;
      case 'loyalty_test': {
        let maxL = 0; const byS:any = {};
        seriesHistory.forEach(h => {
          const sid = h.seriesId || h.itemId || h.id;
          if (!byS[sid]) byS[sid] = new Set();
          byS[sid].add(h.watchedAt.slice(0, 10)); 
        });
        Object.values(byS).forEach((dSet:any) => {
          const dates = Array.from(dSet).sort() as string[]; let s = 1;
          for (let i = 1; i < dates.length; i++) {
            if (Math.round((new Date(dates[i]).getTime() - new Date(dates[i-1]).getTime()) / 86400000) === 1) s++; else s = 1;
            if (s > maxL) maxL = s;
          }
        });
        currentVal = maxL; break;
      }
      case 'break_taker': case 'lost_colony': {
        let maxGap = 0; const byS:any = {};
        seriesHistory.forEach(h => {
          const sid = h.seriesId || h.itemId || h.id;
          if (!byS[sid]) byS[sid] = []; 
          byS[sid].push(new Date(h.watchedAt).getTime()); 
        });
        Object.values(byS).forEach((dates:any) => {
          dates.sort((a:number, b:number) => a - b);
          for (let i = 1; i < dates.length; i++) {
            const gap = (dates[i] - dates[i-1]) / 86400000; if (gap > maxGap) maxGap = gap;
          }
        });
        if (def.id === 'break_taker') currentVal = Math.floor(maxGap);
        if (def.id === 'lost_colony') currentVal = Math.floor(maxGap);
        break;
      }
      case 'morning_sweet': currentVal = moviesHistory.filter(h => { const hr = new Date(h.watchedAt).getHours(); return hr >= 6 && hr < 9; }).length; break;
      case 'nostalgia_wind': currentVal = moviesHistory.filter(h => h.year && parseInt(h.year) <= 1980).length; break;
      case 'universe_conqueror': currentVal = (state.collections || []).filter(c => { const cM = state.movies.filter(m => m.collectionId === c.id); return cM.length >= 3 && cM.every(m => m.watched); }).length; break;
      
      case 'final_phobia': case 'delayed_goodbye': {
        let phobiaGap = 0; let delayedCount = 0;
        state.series.forEach(s => {
          if (!s.episodes || s.episodes.length < 2) return;
          const eps = [...s.episodes].sort((a, b) => a.season === b.season ? a.episode - b.episode : a.season - b.season);
          const finalEp = eps[eps.length - 1]; const penEp = eps[eps.length - 2];
          if (penEp.watched && penEp.watchedAt) {
            const penTime = new Date(penEp.watchedAt).getTime();
            const finalTime = (finalEp.watched && finalEp.watchedAt) ? new Date(finalEp.watchedAt).getTime() : Date.now();
            const gap = (finalTime - penTime) / 86400000;
            if (!finalEp.watched) phobiaGap = Math.max(phobiaGap, gap);
            if (finalEp.watched && gap >= 90) delayedCount++;
          }
        });
        if (def.id === 'final_phobia') currentVal = Math.floor(phobiaGap);
        if (def.id === 'delayed_goodbye') currentVal = delayedCount;
        break;
      }
      
      case 'half_century_series': currentVal = state.series.filter(s => s.episodes && s.episodes.length > 100 && s.episodes.every(e => e.watched)).length; break;
      case 'light_speed': {
        let lsCount = 0;
        validHistory.forEach(h => {
          if (h.rating != null) {
            const addedAt = h.kind === 'series'
              ? state.series.find(s => s.id === (h.seriesId || h.itemId || h.id))?.addedAt
              : state.movies.find(m => m.id === (h.itemId || h.id))?.addedAt;
            if (addedAt) {
              if ((new Date(h.watchedAt).getTime() - new Date(addedAt).getTime()) / 3600000 <= 24) lsCount++;
            }
          }
        });
        currentVal = lsCount; break;
      }
      case 'color_palette': currentVal = new Set(validHistory.filter(h => h.rating !== null).map(h => h.rating)).size; break;
      
      case 'caps_lock': currentVal = validHistory.filter(h => {
          if (!h.note || h.note.trim().length < 5) return false;
          const n = h.note.trim(); return /[a-zA-ZğüşöçİĞÜŞÖÇ]/.test(n) && n === n.toLocaleUpperCase('tr-TR');
        }).length; break;
        
      case 'spider_sense': currentVal = state.movies.filter(m => !m.watched && m.year && parseInt(m.year) > new Date().getFullYear()).length; break;
      case 'time_bender': currentVal = watchedMoviesWithRuntime.reduce((sum, m) => sum + (m.runtime || 0), 0); break;
      case 'epic_watcher': currentVal = watchedMoviesWithRuntime.filter(m => (m.runtime || 0) >= 180).length; break;
      case 'short_sweet': currentVal = watchedMoviesWithRuntime.filter(m => (m.runtime || 0) > 0 && (m.runtime || 0) < 90).length; break;
      case 'couch_potato': {
        const daysRuntime: Record<string, number> = {};
        moviesHistory.forEach(h => {
          const movie = state.movies.find(m => m.id === (h.itemId || h.id));
          if (movie && movie.runtime) {
            const d = h.watchedAt.slice(0, 10);
            daysRuntime[d] = (daysRuntime[d] || 0) + movie.runtime;
          }
        });
        currentVal = Object.values(daysRuntime).filter((minutes: any) => minutes > 300).length;
        break;
      }
    }

    prog.current = currentVal;

    for (const tier of def.tiers) {
      if (currentVal >= tier.threshold && !prog.unlockedTiers.includes(tier.tier)) {
        prog.unlockedTiers.push(tier.tier);
        prog.tierDates[tier.tier] = new Date().toISOString();
        prog.unlockedAt = new Date().toISOString();
        prog.lastNotifiedTier = tier.tier;
        
        unlocked.push({ 
          achievementId: def.id, tier: tier.tier, xp: tier.xp, 
          name: tier.name || def.name, icon: def.icon, 
          description: def.description.replace('{threshold}', String(tier.threshold)) 
        });
      }
    }
  }

  if (unlocked.length > 0) {
    return {
      ...state,
      achievements: newAchievements,
      pendingToasts: [...(state.pendingToasts || []), ...unlocked]
    };
  }

  return { ...state, achievements: newAchievements };
}

function rootReducer(state: ExtendedAppData, action: Action): ExtendedAppData {
  if (action.type === 'IMPORT_DATA') return action.data;
  if (action.type === 'CLEAR_TOASTS') return { ...state, pendingToasts: [] };
  if (action.type === 'CLEAR_LEVELUP') return { ...state, pendingLevelUp: undefined };
  if (action.type === 'CLEAR_XP_GAIN') return { ...state, pendingXpGain: undefined };
  if (action.type === 'TOGGLE_LOCKED_NAMES') return { ...state, showLockedNames: !state.showLockedNames };
  if (action.type === 'SET_ACHIEVEMENT_PROGRESS') return { ...state, achievements: action.progress };
  if (action.type === 'UPDATE_AI_HISTORY') return { ...state, aiChatHistory: action.messages };

  let nextState = { ...state };

  switch (action.type) {
    case 'GRANT_XP': {
      const newTotalXp = state.totalXp + action.xp;
      const oldLevel = levelFromXp(state.totalXp).level;
      const levelData = levelFromXp(newTotalXp);

      return {
        ...state,
        totalXp: newTotalXp,
        xp: levelData.currentLevelXp,
        level: levelData.level,
        pendingXpGain: { gained: action.xp, oldTotal: state.totalXp, newTotal: newTotalXp },
        pendingLevelUp: levelData.level > oldLevel ? { newLevel: levelData.level } : state.pendingLevelUp
      };
    }
    case 'ADD_MOVIE': {
      const resolved = resolveTMDBGenres(action.movie.genres, state.genres);
      action.movie.genres = resolved;
      nextState.genres = addNewGenres(state.genres, resolved);
      nextState.movies = [...state.movies, action.movie];
      break;
    }
    case 'DELETE_MOVIE':
      nextState.movies = state.movies.filter((m) => m.id !== action.id);
      break;
    case 'WATCH_MOVIE':
      nextState.movies = state.movies.map((m) => m.id === action.id ? { ...m, watched: true, rating: action.rating, detailedRating: action.detailedRating, note: action.note, watchedAt: action.watchedAt } : m);
      nextState.history = [action.historyItem, ...state.history];
      nextState.dailyStreak = updateStreak(state);
      nextState.dailyStreakDate = todayStr();
      nextState.lastWatchDate = todayStr();
      break;
    case 'UNWATCH_MOVIE':
      nextState.movies = state.movies.map((m) => m.id === action.id ? { ...m, watched: false, rating: null, detailedRating: undefined, note: '', watchedAt: null } : m);
      nextState.history = state.history.filter((h) => h.itemId !== action.id && h.id !== action.id);
      break;
    case 'UPDATE_HISTORY_RATING': {
      const hItem = state.history.find(h => h.id === action.historyId);
      if (!hItem) break;
      nextState.history = state.history.map(h => h.id === action.historyId ? { ...h, rating: action.rating, detailedRating: action.detailedRating, note: action.note } : h);
      const targetId = hItem.itemId || hItem.id;
      if (hItem.kind === 'movie' || hItem.type === 'movie') {
        nextState.movies = state.movies.map(m => m.id === targetId ? { ...m, rating: action.rating, detailedRating: action.detailedRating, note: action.note } : m);
      } else {
        nextState.series = state.series.map(s => ({
          ...s,
          episodes: s.episodes.map(e => e.id === targetId ? { ...e, rating: action.rating, detailedRating: action.detailedRating, note: action.note } : e)
        }));
      }
      break;
    }
    case 'ADD_SERIES': {
      const resolved = resolveTMDBGenres(action.series.genres, state.genres);
      action.series.genres = resolved;
      nextState.genres = addNewGenres(state.genres, resolved);
      nextState.series = [...state.series, action.series];
      break;
    }
    case 'DELETE_SERIES':
      nextState.series = state.series.filter((s) => s.id !== action.id);
      break;
    case 'COMPLETE_SERIES':
      break;
    case 'ADD_EPISODES':
      nextState.series = state.series.map((s) => s.id === action.seriesId ? { ...s, episodes: [...s.episodes, ...action.episodes] } : s);
      break;
    case 'WATCH_EPISODE':
      nextState.series = state.series.map((s) => s.id === action.seriesId ? { ...s, episodes: s.episodes.map((e) => e.id === action.episodeId ? { ...e, watched: true, rating: action.rating, detailedRating: action.detailedRating, note: action.note, watchedAt: action.watchedAt } : e) } : s);
      nextState.history = [action.historyItem, ...state.history];
      nextState.dailyStreak = updateStreak(state);
      nextState.dailyStreakDate = todayStr();
      nextState.lastWatchDate = todayStr();
      break;
    case 'UNWATCH_EPISODE':
      nextState.series = state.series.map((s) => s.id === action.seriesId ? { ...s, episodes: s.episodes.map((e) => e.id === action.episodeId ? { ...e, watched: false, rating: null, detailedRating: undefined, note: '', watchedAt: null } : e) } : s);
      nextState.history = state.history.filter((h) => h.itemId !== action.episodeId && h.id !== action.episodeId);
      break;
    case 'DELETE_EPISODE':
      nextState.series = state.series.map((s) => s.id === action.seriesId ? { ...s, episodes: s.episodes.filter((e) => e.id !== action.episodeId) } : s);
      break;
    case 'ADD_GENRE':
      if (!state.genres.some((g) => normalize(g) === normalize(action.genre))) nextState.genres = [...state.genres, action.genre];
      break;
    case 'DELETE_GENRE':
      nextState.genres = state.genres.filter((g) => g !== action.genre);
      break;
    case 'RENAME_GENRE':
      nextState.genres = state.genres.map((g) => (g === action.oldName ? action.newName : g));
      nextState.movies = state.movies.map((m) => ({ ...m, genres: m.genres.map((g) => (g === action.oldName ? action.newName : g)) }));
      nextState.series = state.series.map((s) => ({ ...s, genres: s.genres.map((g) => (g === action.oldName ? action.newName : g)) }));
      nextState.history = state.history.map((h) => ({ ...h, genres: h.genres.map((g) => (g === action.oldName ? action.newName : g)) }));
      break;
    case 'EDIT_MOVIE': {
      const resolved = resolveTMDBGenres(action.genres, state.genres);
      nextState.genres = addNewGenres(state.genres, resolved);
      nextState.movies = state.movies.map((m) => m.id === action.id ? { 
        ...m, title: action.title, year: action.year, genres: resolved, runtime: action.runtime,
        ...(action.posterUrl !== undefined && { posterUrl: action.posterUrl }),
        ...(action.overview !== undefined && { overview: action.overview }),
        ...(action.tmdbId !== undefined && { tmdbId: action.tmdbId })
      } : m);
      break;
    }
    case 'EDIT_SERIES': {
      const resolved = resolveTMDBGenres(action.genres, state.genres);
      nextState.genres = addNewGenres(state.genres, resolved);
      nextState.series = state.series.map((s) => s.id === action.id ? { 
        ...s, title: action.title, genres: resolved,
        ...(action.year !== undefined && { year: action.year }),
        ...(action.posterUrl !== undefined && { posterUrl: action.posterUrl }),
        ...(action.overview !== undefined && { overview: action.overview }),
        ...(action.tmdbId !== undefined && { tmdbId: action.tmdbId })
      } : s);
      break;
    }
    case 'ADD_COLLECTION':
      nextState.collections = [...state.collections, action.collection];
      break;
    case 'DELETE_COLLECTION':
      nextState.collections = state.collections.filter((c) => c.id !== action.id);
      nextState.movies = state.movies.map((m) => m.collectionId === action.id ? { ...m, collectionId: null } : m);
      break;
    case 'RENAME_COLLECTION':
      nextState.collections = state.collections.map((c) => c.id === action.id ? { ...c, name: action.name } : c);
      break;
    case 'SET_MOVIE_COLLECTION':
      nextState.movies = state.movies.map((m) => m.id === action.id ? { ...m, collectionId: action.collectionId } : m);
      break;
    case 'ADD_CRITERION':
      nextState.criteria = [...(state.criteria || []), action.criterion];
      break;
    case 'EDIT_CRITERION':
      nextState.criteria = (state.criteria || []).map(c => c.id === action.id ? action.criterion : c);
      break;
    case 'DELETE_CRITERION':
      nextState.criteria = (state.criteria || []).filter(c => c.id !== action.id);
      break;
  }

  return applyAchievements(nextState);
}

export interface ToastItem { id: string; message: string; type: 'success' | 'warning' | 'error' | 'info'; }
export interface AchievementToastItem { id: string; achievementName: string; tier: string; icon: string; description: string; }
interface LevelUpData { newLevel: number; }
interface SeasonCompleteData { seriesTitle: string; season: number; }

interface AppContextValue {
  data: ExtendedAppData;
  addMovie: (t: string, y: string, g: string[], c: string | null, r?: number, p?: string | null, o?: string, tmdbId?: number) => boolean;
  deleteMovie: (id: string) => void;
  watchMovie: (id: string, r: number, n: string, dr?: Record<string, number>) => void;
  unwatchMovie: (id: string) => void;
  updateHistoryRating: (historyId: string, rating: number, note: string, dr?: Record<string, number>) => void;
  addSeries: (t: string, g: string[], s: number[], p?: string | null, o?: string, tmdbId?: number, y?: string) => boolean;
  deleteSeries: (id: string) => void;
  addEpisodes: (sId: string, s: number, ec: number) => void;
  watchEpisode: (sId: string, eId: string, r: number, n: string, dr?: Record<string, number>) => void;
  canWatchEpisode: (sId: string, eId: string) => boolean;
  unwatchEpisode: (sId: string, eId: string) => void;
  deleteEpisode: (sId: string, eId: string) => void;
  addGenre: (g: string) => void; deleteGenre: (g: string) => void; renameGenre: (o: string, n: string) => void;
  editMovie: (i: string, t: string, y: string, g: string[], r?: number, p?: string | null, o?: string, tmdbId?: number, silent?: boolean) => void; 
  editSeries: (i: string, t: string, g: string[], p?: string | null, o?: string, tmdbId?: number, y?: string, silent?: boolean) => void;
  addCollection: (n: string) => string; deleteCollection: (i: string) => void; renameCollection: (i: string, n: string) => void; setMovieCollection: (i: string, c: string | null) => void;
  exportData: () => void; importData: (j: string) => boolean; resetData: () => void;
  toasts: ToastItem[]; showToast: (m: string, t?: ToastItem['type']) => void;
  achievementToasts: AchievementToastItem[];
  levelUpData: LevelUpData | null; seasonCompleteData: SeasonCompleteData | null;
  dismissLevelUp: () => void; dismissSeasonComplete: () => void;
  toggleLockedNames: () => void;
  xpGainData: { gained: number; oldTotal: number; newTotal: number } | null;
  updateAIHistory: (messages: AIMessage[]) => void;
  addCriterion: (criterion: RatingCriterion) => void;
  editCriterion: (id: string, criterion: RatingCriterion) => void;
  deleteCriterion: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(rootReducer, undefined, () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedData = { ...defaultData(), ...JSON.parse(stored) };
        if (parsedData.aiChatHistory) {
          const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
          parsedData.aiChatHistory = parsedData.aiChatHistory.filter((msg: AIMessage) => msg.timestamp >= threeDaysAgo);
        }
        if (!parsedData.criteria) parsedData.criteria = defaultData().criteria;
        return parsedData;
      }
    } catch {}
    return defaultData();
  });

  const toastsRef = useRef<ToastItem[]>([]);
  const achievementToastsRef = useRef<AchievementToastItem[]>([]);
  
  const [achievementQueue, setAchievementQueue] = useState<any[]>([]);
  const [isShowingAchievement, setIsShowingAchievement] = useState(false);

  const [toasts, setToasts] = useReducer((state: ToastItem[], a: any) => {
      if (a.type === 'add') { toastsRef.current = [...state, a.toast]; return toastsRef.current; }
      toastsRef.current = state.filter((t) => t.id !== a.id); return toastsRef.current;
  }, []);

  const [achievementToasts, setAchievementToasts] = useReducer((state: AchievementToastItem[], a: any) => {
      if (a.type === 'add') { achievementToastsRef.current = [...state, a.toast]; return achievementToastsRef.current; }
      achievementToastsRef.current = state.filter((t) => t.id !== a.id); return achievementToastsRef.current;
  }, []);

  const [levelUpData, setLevelUpData] = useReducer((_s: any, a: any) => a, null);
  const [seasonCompleteData, setSeasonCompleteData] = useReducer((_s: any, a: any) => a, null);
  const [xpGainData, setXpGainData] = useState<{ gained: number; oldTotal: number; newTotal: number } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [data]);

  useEffect(() => {
    const existing = new Map(data.achievements.map((a) => [a.achievementId, a]));
    let needsUpdate = false;
    const progress: AchievementProgress[] = ACHIEVEMENT_DEFS.map((def) => {
      const ex = existing.get(def.id);
      if (ex) return ex; 
      needsUpdate = true;
      return { achievementId: def.id, current: 0, unlockedTiers: [], lastNotifiedTier: null };
    });
    if (needsUpdate) dispatch({ type: 'SET_ACHIEVEMENT_PROGRESS', progress });
    
    // YENİ: setTimeout kaldırıldı, böylece ilk açılışta gecikme olmadan senkronizasyon tamamlanır.
    dispatch({ type: 'SYNC_ACHIEVEMENTS' });
  }, []);

  const showAchievementToast = useCallback((item: Omit<AchievementToastItem, 'id'>) => {
    const id = uid();
    setAchievementToasts({ type: 'add', toast: { ...item, id } });
    setTimeout(() => setAchievementToasts({ type: 'remove', id }), 5000);
  }, []);

  useEffect(() => {
    if (data.pendingXpGain) {
      setXpGainData(data.pendingXpGain);
      setTimeout(() => setXpGainData(null), 4000);
      dispatch({ type: 'CLEAR_XP_GAIN' });
    }
    
    if (data.pendingLevelUp) {
      setLevelUpData(data.pendingLevelUp);
      import('../lib/sound').then(({ playLevelUpSound }) => playLevelUpSound());
      dispatch({ type: 'CLEAR_LEVELUP' });
    }
    
    if (data.pendingToasts && data.pendingToasts.length > 0) {
      setAchievementQueue(prev => [...prev, ...data.pendingToasts!]);
      dispatch({ type: 'CLEAR_TOASTS' });
    }
  }, [data.pendingToasts, data.pendingLevelUp, data.pendingXpGain]);

  // YENİ: Birden fazla başarım kazanıldığında kuyruktaki diğer başarımları da bildirir.
  useEffect(() => {
    if (levelUpData) return;
    if (isShowingAchievement) return;
    if (achievementQueue.length === 0) return;

    const nextAchievement = achievementQueue[0];
    const remainingCount = achievementQueue.length - 1;
    const comboText = remainingCount > 0 ? ` (+${remainingCount} Bekliyor)` : '';
    
    setAchievementQueue(prev => prev.slice(1));
    setIsShowingAchievement(true);

    showAchievementToast({
      achievementName: nextAchievement.name + comboText,
      tier: nextAchievement.tier,
      icon: nextAchievement.icon,
      description: nextAchievement.description
    });
    import('../lib/sound').then(({ playAchievementSound }) => playAchievementSound());

    dispatch({ type: 'GRANT_XP', xp: nextAchievement.xp });

    setTimeout(() => {
      setIsShowingAchievement(false);
    }, 5500);

  }, [achievementQueue, isShowingAchievement, levelUpData, showAchievementToast]);

  const showToast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = uid();
    setToasts({ type: 'add', toast: { id, message, type } });
    setTimeout(() => setToasts({ type: 'remove', id }), 2000);
  }, []);

  const toggleLockedNames = useCallback(() => { dispatch({ type: 'TOGGLE_LOCKED_NAMES' }); }, []);

  const addMovie = useCallback((title: string, year: string, genres: string[], collectionId: string | null, runtime?: number, posterUrl?: string | null, overview?: string, tmdbId?: number): boolean => {
      if (data.movies.some((m) => normalize(m.title) === normalize(title))) { showToast('Bu film zaten listede var!', 'warning'); return false; }
      dispatch({ 
        type: 'ADD_MOVIE', 
        movie: { id: uid(), title: title.trim(), year: year.trim(), genres, collectionId, runtime, posterUrl: posterUrl || undefined, overview: overview || undefined, tmdbId, watched: false, rating: null, note: '', watchedAt: null, addedAt: new Date().toISOString() } 
      });
      showToast('Film eklendi'); return true;
    }, [data.movies, showToast]
  );

  const watchMovie = useCallback((id: string, rating: number, note: string, detailedRating?: Record<string, number>) => {
      const movie = data.movies.find((m) => m.id === id); if (!movie) return;
      dispatch({ type: 'WATCH_MOVIE', id, rating, detailedRating, note, watchedAt: new Date().toISOString(), historyItem: { id: uid(), itemId: movie.id, kind: 'movie', type: 'movie', title: movie.title, rating, detailedRating, note, watchedAt: new Date().toISOString(), genres: movie.genres, year: movie.year } });
    }, [data.movies]
  );

  const updateHistoryRating = useCallback((historyId: string, rating: number, note: string, detailedRating?: Record<string, number>) => {
    dispatch({ type: 'UPDATE_HISTORY_RATING', historyId, rating, note, detailedRating });
    showToast('Puan güncellendi');
  }, [showToast]);

  const addSeries = useCallback((title: string, genres: string[], seasons: number[], posterUrl?: string | null, overview?: string, tmdbId?: number, year?: string): boolean => {
      if (data.removedSeriesTitles.some((t) => normalize(t) === normalize(title))) { showToast('Daha önce tamamlandı!', 'warning'); return false; }
      if (data.series.some((s) => normalize(s.title) === normalize(title))) { showToast('Bu dizi zaten listede var!', 'warning'); return false; }
      const episodes: Episode[] = [];
      seasons.forEach((epCount, s) => { for (let e = 1; e <= epCount; e++) { episodes.push({ id: uid(), season: s + 1, episode: e, watched: false, rating: null, note: '', watchedAt: null }); } });
      dispatch({ type: 'ADD_SERIES', series: { id: uid(), title: title.trim(), genres, episodes, posterUrl: posterUrl || undefined, overview: overview || undefined, tmdbId, year, addedAt: new Date().toISOString() } });
      showToast('Dizi eklendi'); return true;
    }, [data.series, data.removedSeriesTitles, showToast]
  );

  const watchEpisode = useCallback((seriesId: string, episodeId: string, rating: number, note: string, detailedRating?: Record<string, number>) => {
      const series = data.series.find((s) => s.id === seriesId); if (!series) return;
      const ep = series.episodes.find((e) => e.id === episodeId); if (!ep) return;
      dispatch({ type: 'WATCH_EPISODE', seriesId, episodeId, rating, detailedRating, note, watchedAt: new Date().toISOString(), historyItem: { id: uid(), itemId: ep.id, seriesId: series.id, kind: 'series', type: 'series', title: series.title, rating, detailedRating, note, watchedAt: new Date().toISOString(), genres: series.genres, season: ep.season, episode: ep.episode } });
      setTimeout(() => {
        const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const updatedSeries = state.series?.find((s: any) => s.id === seriesId);
        if (updatedSeries) {
          if (updatedSeries.episodes.filter((e:any) => e.season === ep.season).every((e:any) => e.watched)) setSeasonCompleteData({ seriesTitle: updatedSeries.title, season: ep.season });
          if (updatedSeries.episodes.every((e:any) => e.watched)) {
            dispatch({ type: 'COMPLETE_SERIES', id: seriesId, title: updatedSeries.title }); showToast(`${updatedSeries.title} tamamlandı!`, 'success');
          }
        }
      }, 200);
    }, [data.series, showToast]
  );

  const deleteMovie = useCallback((id: string) => { dispatch({ type: 'DELETE_MOVIE', id }); }, []);
  const unwatchMovie = useCallback((id: string) => { dispatch({ type: 'UNWATCH_MOVIE', id }); }, []);
  const deleteSeries = useCallback((id: string) => { dispatch({ type: 'DELETE_SERIES', id }); }, []);
  const addEpisodes = useCallback((sId: string, s: number, ec: number) => {
    const series = data.series.find(x => x.id === sId); if(!series) return;
    const startEp = series.episodes.filter(e => e.season === s).length > 0 ? Math.max(...series.episodes.filter(e => e.season === s).map(e => e.episode)) + 1 : 1;
    dispatch({ type: 'ADD_EPISODES', seriesId: sId, episodes: Array.from({length: ec}, (_, i) => ({ id: uid(), season: s, episode: startEp + i, watched: false, rating: null, note: '', watchedAt: null })) }); showToast(`${ec} bölüm eklendi`);
  }, [data.series, showToast]);
  
  const canWatchEpisode = useCallback((sId: string, eId: string): boolean => {
    const series = data.series.find(s => s.id === sId); if (!series) return false;
    const ep = series.episodes.find(e => e.id === eId); if (!ep || ep.watched) return false;
    return [...series.episodes].sort((a, b) => a.season - b.season || a.episode - b.episode).find(e => !e.watched)?.id === eId;
  }, [data.series]);
  
  const unwatchEpisode = useCallback((sId: string, eId: string) => { dispatch({ type: 'UNWATCH_EPISODE', seriesId: sId, episodeId: eId }); }, []);
  const deleteEpisode = useCallback((sId: string, eId: string) => { dispatch({ type: 'DELETE_EPISODE', seriesId: sId, episodeId: eId }); }, []);
  const addGenre = useCallback((g: string) => { if(data.genres.some(x => normalize(x) === normalize(g))) return; dispatch({ type: 'ADD_GENRE', genre: g.trim() }); showToast('Tür eklendi'); }, [data.genres, showToast]);
  const deleteGenre = useCallback((g: string) => { dispatch({ type: 'DELETE_GENRE', genre: g }); }, []);
  const renameGenre = useCallback((o: string, n: string) => { if(!n.trim()) return; dispatch({ type: 'RENAME_GENRE', oldName: o, newName: n.trim() }); showToast('Tür güncellendi'); }, [showToast]);
  
  const editMovie = useCallback((i: string, t: string, y: string, g: string[], r?: number, p?: string | null, o?: string, tmdbId?: number, silent = false) => { 
    dispatch({ type: 'EDIT_MOVIE', id: i, title: t, year: y, genres: g, runtime: r, posterUrl: p || undefined, overview: o || undefined, tmdbId }); 
    if (!silent) showToast('Film güncellendi'); 
  }, [showToast]);
  
  const editSeries = useCallback((i: string, t: string, g: string[], p?: string | null, o?: string, tmdbId?: number, y?: string, silent = false) => { 
    dispatch({ type: 'EDIT_SERIES', id: i, title: t, genres: g, posterUrl: p || undefined, overview: o || undefined, tmdbId, year: y }); 
    if (!silent) showToast('Dizi güncellendi'); 
  }, [showToast]);

  const addCollection = useCallback((n: string) => { const id = uid(); dispatch({ type: 'ADD_COLLECTION', collection: { id, name: n.trim() } }); showToast('Koleksiyon eklendi'); return id; }, [showToast]);
  const deleteCollection = useCallback((id: string) => { dispatch({ type: 'DELETE_COLLECTION', id }); }, []);
  const renameCollection = useCallback((i: string, n: string) => { dispatch({ type: 'RENAME_COLLECTION', id: i, name: n.trim() }); showToast('Koleksiyon güncellendi'); }, [showToast]);
  const setMovieCollection = useCallback((i: string, c: string | null) => { dispatch({ type: 'SET_MOVIE_COLLECTION', id: i, collectionId: c }); }, []);
  
  const updateAIHistory = useCallback((messages: AIMessage[]) => { 
    dispatch({ type: 'UPDATE_AI_HISTORY', messages }); 
  }, []);

  const addCriterion = useCallback((c: RatingCriterion) => {
    dispatch({ type: 'ADD_CRITERION', criterion: c });
    showToast('Kriter Eklendi');
  }, [showToast]);

  const editCriterion = useCallback((id: string, c: RatingCriterion) => {
    dispatch({ type: 'EDIT_CRITERION', id, criterion: c });
    showToast('Kriter Güncellendi');
  }, [showToast]);

  const deleteCriterion = useCallback((id: string) => {
    dispatch({ type: 'DELETE_CRITERION', id });
    showToast('Kriter Silindi');
  }, [showToast]);

  const exportData = useCallback(() => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `sinevia-yedek-${todayStr()}.json`; a.click(); URL.revokeObjectURL(url); showToast('Yedek alındı');
  }, [data, showToast]);
  const importData = useCallback((json: string) => { try { dispatch({ type: 'IMPORT_DATA', data: { ...defaultData(), ...JSON.parse(json) } }); showToast('Veriler geri yüklendi'); return true; } catch { showToast('Hata', 'error'); return false; } }, [showToast]);
  const resetData = useCallback(() => { const f = defaultData(); f.achievements = ACHIEVEMENT_DEFS.map(d => ({ achievementId: d.id, current: 0, unlockedTiers: [], lastNotifiedTier: null })); dispatch({ type: 'IMPORT_DATA', data: f }); showToast('Sıfırlandı'); }, [showToast]);
  
  const dismissLevelUp = useCallback(() => setLevelUpData(null), []);
  const dismissSeasonComplete = useCallback(() => setSeasonCompleteData(null), []);

  return <AppContext.Provider value={{ data, addMovie, deleteMovie, watchMovie, unwatchMovie, updateHistoryRating, addSeries, deleteSeries, addEpisodes, watchEpisode, canWatchEpisode, unwatchEpisode, deleteEpisode, addGenre, deleteGenre, renameGenre, editMovie, editSeries, addCollection, deleteCollection, renameCollection, setMovieCollection, exportData, importData, resetData, toasts, showToast, achievementToasts, levelUpData, seasonCompleteData, dismissLevelUp, dismissSeasonComplete, toggleLockedNames, xpGainData, updateAIHistory, addCriterion, editCriterion, deleteCriterion }}>{children}</AppContext.Provider>;
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