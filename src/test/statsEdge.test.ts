import { describe, test, expect } from 'vitest';
import { calculateStats } from '../lib/statsLogic';
import { PAST_WATCH_COLLECTION_NAME } from '../context/AppContext';
import type { ExtendedAppData } from '../context/AppContext';

// ============================================================================
// İSTATİSTİK MOTORU — Boş veri / kenar durumları ve kapsam testleri
// ============================================================================

function getInitialState(): ExtendedAppData {
  return {
    movies: [], series: [], removedSeriesTitles: [], collections: [],
    genres: [], reviewTags: [], history: [], achievements: [], criteria: [],
    xp: 0, level: 1, totalXp: 0, lastWatchDate: null, dailyStreak: 0, dailyStreakDate: null,
    showLockedNames: false, theme: 'default', altWatchTemplate: '', weeklyPlan: [], notificationsEnabled: false,
  };
}

describe('İSTATİSTİK MOTORU — BOŞ VERİ GÜVENLİĞİ', () => {
  test('hiç veri yokken tüm metrikler 0’a düşmeli, motor çökmemeli', () => {
    const stats = calculateStats(getInitialState(), 'all');

    expect(stats.movieCount).toBe(0);
    expect(stats.seriesCount).toBe(0);
    expect(stats.uniqueSeriesCount).toBe(0);
    expect(stats.avgMovie).toBe(0);
    expect(stats.avgSeries).toBe(0);
    expect(stats.avgTotal).toBe(0);
    expect(stats.totalActualMinutes).toBe(0);
    expect(stats.movieCompletionPct).toBe(0);
    expect(stats.seriesCompletionPct).toBe(0);
    expect(stats.remainingMovies).toBe(0);
    expect(stats.remainingEpisodes).toBe(0);
    expect(stats.maxStreakEver).toBe(0);
    expect(stats.busiestDay.count).toBe(0);
    expect(stats.longestMovie).toBeNull();
    expect(stats.mostWatchedSeries).toBeNull();
    expect(stats.topRated).toEqual([]);
    expect(stats.topDirectors).toEqual([]);
    expect(stats.decades).toEqual([]);
    expect(stats.notesCount).toBe(0);
    expect(stats.totalNoteWords).toBe(0);
  });

  test('veri yokken kişilik etiketi "Yeni Başlayan" ve günlük grafik 14 gün içermeli', () => {
    const stats = calculateStats(getInitialState(), 'all');

    expect(stats.ratingPersona.color).toBe('text-ink-400');
    expect(stats.last14Days).toHaveLength(14);
    expect(stats.last14Days.every((d) => d.count === 0)).toBe(true);
    expect(stats.max14DayCount).toBe(1); // Math.max(..., 1) güvenliği
    expect(stats.timeBuckets).toEqual({ morning: 0, afternoon: 0, evening: 0, night: 0 });
    expect(stats.collectionStats).toEqual([]);
  });
});

describe('İSTATİSTİK MOTORU — KAPSAM (SCOPE) KURALLARI', () => {
  test('"past" modunda diziler kapsam DIŞI kalmalı (seriesCount her koşulda 0)', () => {
    const state = getInitialState();
    state.movies = [{ id: 'm1', watched: true, isPastWatch: true, runtime: 120 } as any];
    state.history = [
      { itemId: 'm1', kind: 'movie', isPastWatch: true, watchedAt: '2010-05-05T20:00:00', rating: 9 } as any,
      { seriesId: 's1', kind: 'series', isPastWatch: true, watchedAt: '2010-05-05T21:00:00', rating: 8 } as any,
    ];

    const stats = calculateStats(state, 'past');
    expect(stats.movieCount).toBe(1);
    expect(stats.seriesCount).toBe(0);
    expect(stats.avgSeries).toBe(0);
    expect(stats.mostWatchedSeries).toBeNull();
  });

  test('"all" modunda hem film hem dizi geçmişi istatistiklere girmeli', () => {
    const state = getInitialState();
    state.history = [
      { itemId: 'm1', kind: 'movie', watchedAt: '2026-10-01T20:00:00', rating: 10 } as any,
      { seriesId: 's1', kind: 'series', watchedAt: '2026-10-02T21:00:00', rating: 6 } as any,
    ];

    const stats = calculateStats(state, 'all');
    expect(stats.seriesCount).toBe(1);
    expect(stats.uniqueSeriesCount).toBe(1);
    expect(stats.avgTotal).toBe(8); // (10 + 6) / 2
    expect(stats.avgMovie).toBe(10);
    expect(stats.avgSeries).toBe(6);
  });

  test('aynı dizi birden fazla bölüm izlense de dizi TEK KEZ sayılmalı', () => {
    const state = getInitialState();
    state.history = [
      { seriesId: 's1', kind: 'series', watchedAt: '2026-10-01T21:00:00', rating: 8 } as any,
      { seriesId: 's1', kind: 'series', watchedAt: '2026-10-02T21:00:00', rating: 9 } as any,
      { seriesId: 's1', kind: 'series', watchedAt: '2026-10-03T21:00:00', rating: 7 } as any,
    ];

    const stats = calculateStats(state, 'all');
    expect(stats.uniqueSeriesCount).toBe(1);
    expect(stats.seriesCount).toBe(3); // toplam izlenen bölüm kaydı
  });
});

describe('İSTATİSTİK MOTORU — KİŞİLİK & ZAMAN ANALİZİ', () => {
  test('puan ortalamasına göre kişilik rengi doğru değişmeli', () => {
    const mkState = (ratings: number[]) => {
      const state = getInitialState();
      state.history = ratings.map((rating, i) => ({
        itemId: `m${i}`, kind: 'movie', rating, watchedAt: '2026-10-04T20:00:00',
      } as any));
      return state;
    };

    expect(calculateStats(mkState([9, 10]), 'all').ratingPersona.color).toBe('text-emerald-400'); // cömert
    expect(calculateStats(mkState([7, 8]), 'all').ratingPersona.color).toBe('text-teal-400');      // pozitif
    expect(calculateStats(mkState([5, 6]), 'all').ratingPersona.color).toBe('text-amber-400');     // dengeli
    expect(calculateStats(mkState([1, 2]), 'all').ratingPersona.color).toBe('text-red-400');       // acımasız
  });

  test('izleme saatleri sabah/öğleden sonra/prime time/gece olarak ayrışmalı', () => {
    const state = getInitialState();
    state.history = [
      { itemId: 'a', kind: 'movie', watchedAt: '2026-10-04T08:00:00', rating: 5 } as any,
      { itemId: 'b', kind: 'movie', watchedAt: '2026-10-04T14:00:00', rating: 5 } as any,
      { itemId: 'c', kind: 'movie', watchedAt: '2026-10-04T20:00:00', rating: 5 } as any,
      { itemId: 'd', kind: 'movie', watchedAt: '2026-10-04T03:00:00', rating: 5 } as any,
    ];

    const stats = calculateStats(state, 'all');
    expect(stats.timeBuckets).toEqual({ morning: 1, afternoon: 1, evening: 1, night: 1 });
    expect(stats.totalTimeTracked).toBe(4);
  });

  test('aylık dağılım eskiden yeniye sıralanıp son 6 ay ile sınırlandırılmalı', () => {
    const state = getInitialState();
    state.history = [
      { itemId: 'a', kind: 'movie', watchedAt: '2026-08-10T20:00:00', rating: 5 } as any,
      { itemId: 'b', kind: 'movie', watchedAt: '2026-09-10T20:00:00', rating: 5 } as any,
      { itemId: 'c', kind: 'movie', watchedAt: '2026-10-01T20:00:00', rating: 5 } as any,
      { itemId: 'd', kind: 'movie', watchedAt: '2026-10-05T20:00:00', rating: 5 } as any,
    ];

    const stats = calculateStats(state, 'all');
    const keys = stats.monthly.map(([key]) => key);
    expect(keys).toEqual(['2026-08', '2026-09', '2026-10']); // artan sıra
    expect(stats.maxMonthly).toBe(2); // Ekim'de 2 izleme

    // "Bu ay" sayacı, içinde bulunulan ay (sistem saati) ile bağımsız doğrudan çapraz kontrol edilmeli
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const expectedThisMonth = state.history.filter((h) => h.watchedAt.slice(0, 7) === thisMonthKey).length;
    expect(stats.thisMonthCount).toBe(expectedThisMonth);
  });

  test('on yıl (decade) analizi 1920-2035 dışındaki yılları elemeli', () => {
    const state = getInitialState();
    state.movies = [
      { id: 'm1', watched: true, year: '1999', rating: 8, runtime: 120 } as any,
      { id: 'm2', watched: true, year: '1800', rating: 10, runtime: 90 } as any, // kapsam dışı
      { id: 'm3', watched: false, year: '2020', rating: null, runtime: 100 } as any, // izlenmedi
    ];

    const stats = calculateStats(state, 'all');
    expect(stats.decades).toHaveLength(1);
    expect(stats.decades[0].decade).toContain('1990');
    expect(stats.decades[0].count).toBe(1);
    expect(stats.decades[0].avg).toBe(8);
    expect(stats.maxDecadeCount).toBe(1);
  });

  test('tanımsız dil kodu için "Diğer (XX)" etiketi üretilmeli', () => {
    const state = getInitialState();
    state.movies = [
      { id: 'm1', watched: true, originalLanguage: 'xx', rating: 7, runtime: 90 } as any,
    ];

    const stats = calculateStats(state, 'all');
    const unknown = stats.topLanguages.find((l) => l.code === 'xx');
    expect(unknown).toBeDefined();
    expect(unknown!.name).toContain('XX');
    expect(unknown!.count).toBe(1);
  });

  test('not kelime sayımı ve koleksiyon ilerlemesi doğru hesaplanmalı (eski koleksiyon hariç)', () => {
    const state = getInitialState();
    state.collections = [
      { id: 'c1', name: 'Bilim Kurgu Koleksiyonu' } as any,
      { id: 'c2', name: PAST_WATCH_COLLECTION_NAME } as any, // istatistikten düşmeli
    ];
    state.movies = [
      { id: 'm1', collectionId: 'c1', watched: true, runtime: 100 } as any,
      { id: 'm2', collectionId: 'c1', watched: false, runtime: 100 } as any,
    ];
    state.history = [
      { itemId: 'm1', kind: 'movie', watchedAt: '2026-10-04T20:00:00', rating: 8, note: 'one two three' } as any,
    ];

    const stats = calculateStats(state, 'all');

    expect(stats.notesCount).toBe(1);
    expect(stats.totalNoteWords).toBe(3);

    expect(stats.collectionStats).toHaveLength(1); // "Eskiden İzlenenler" elenmeli
    expect(stats.collectionStats[0].name).toBe('Bilim Kurgu Koleksiyonu');
    expect(stats.collectionStats[0].total).toBe(2);
    expect(stats.collectionStats[0].watched).toBe(1);
    expect(stats.collectionStats[0].progress).toBe(50);
  });
});
