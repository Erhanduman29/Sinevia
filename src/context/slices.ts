import { createContext, useContext } from 'react';
import type { ExtendedAppData } from './AppContext';

/**
 * State Slicing — re-render izolasyonu katmanı (opt-in).
 *
 * AppContext (useApp) tek büyük context olarak KALIR ve eskisi gibi çalışır (25 dosya
 * bozulmaz). Bu dosya, yoğun sayfaların sadece kendi ihtiyaç duyduğu "dilimi" dinlemesi
 * için ayrı context'ler sunar. Bir bileşen sadece useLibrary() kullanırsa, sadece
 * movies/series/collections/history değiştiğinde re-render olur; ayar/gamification
 * değiştikçe değil.
 *
 * Aksiyonlar (dispatch sarmalayıcıları) stable'dır (useCallback) ve useApp'ten gelir;
 * buraya taşımak zorunlu değil. Sayfalar hem useApp (aksiyon) hem useLibrary (veri)
 * kullanabilir — izolasyon yine de çalışır çünkü useLibrary ayrı bir context'tendir.
 */

export interface LibrarySlice {
  movies: ExtendedAppData['movies'];
  series: ExtendedAppData['series'];
  collections: ExtendedAppData['collections'];
  history: ExtendedAppData['history'];
  genres: ExtendedAppData['genres'];
}

export interface GamificationSlice {
  xp: number;
  level: number;
  totalXp: number;
  dailyStreak: number;
  achievements: ExtendedAppData['achievements'];
  showcase: ExtendedAppData['showcase'];
}

export interface SettingsSlice {
  theme: string;
  criteria: ExtendedAppData['criteria'];
  reviewTags: ExtendedAppData['reviewTags'];
  weeklyPlan: ExtendedAppData['weeklyPlan'];
  notificationsEnabled: boolean;
  shareWatchedInFeed: boolean;
  sharePastWatchedInFeed: boolean;
  showLockedNames: boolean;
  altWatchTemplate: string;
}

export interface TimerSlice {
  /** Şu an işleyen film zamanlayıcısı (null = aktif geri sayım yok). Seyrek değişir. */
  activeTimerMovie: ExtendedAppData['movies'][number] | null;
}

export const LibraryContext = createContext<LibrarySlice | null>(null);
export const GamificationContext = createContext<GamificationSlice | null>(null);
export const SettingsContext = createContext<SettingsSlice | null>(null);
export const TimerContext = createContext<TimerSlice | null>(null);

function useSlice<T>(ctx: React.Context<T | null>, name: string): T {
  const v = useContext(ctx);
  if (!v) throw new Error(`${name} must be used within AppProvider`);
  return v;
}

export const useLibrary = () => useSlice(LibraryContext, 'useLibrary');
export const useGamification = () => useSlice(GamificationContext, 'useGamification');
export const useSettings = () => useSlice(SettingsContext, 'useSettings');
export const useTimer = () => useSlice(TimerContext, 'useTimer');
