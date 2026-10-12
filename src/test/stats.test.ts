import { expect, test, describe } from 'vitest';
import { calculateStats } from '../lib/statsLogic';
import type { ExtendedAppData } from '../context/AppContext';

// Tertemiz bir başlangıç durumu oluşturucu
function getInitialState(): ExtendedAppData {
  return {
    movies: [], series: [], removedSeriesTitles: [], collections: [],
    genres: [], reviewTags: [], history: [], achievements: [], criteria: [],
    xp: 0, level: 1, totalXp: 0, lastWatchDate: null, dailyStreak: 0, dailyStreakDate: null,
    showLockedNames: false, theme: 'default', altWatchTemplate: '', weeklyPlan: [], notificationsEnabled: false
  };
}

describe('📊 İSTATİSTİK VE ANALİZ MOTORU KAPSAMLI TESTİ', () => {

  // ==========================================
  // 1. KAPSAM (GÜNCEL / GEÇMİŞ) FİLTRELEME
  // ==========================================
  describe('Mod Filtreleme (Current, Past, All)', () => {
    test('Güncel (current) modunda, Önceden İzlenenler veri havuzundan DÜŞÜLMELİ', () => {
      const state = getInitialState();
      state.movies = [
        { id: 'm1', watched: true, isPastWatch: false, runtime: 100 } as any,
        { id: 'm2', watched: true, isPastWatch: true, runtime: 100 } as any // Geçmiş (Eskiden izlenen)
      ];
      state.history = [
        { itemId: 'm1', kind: 'movie', isPastWatch: false, watchedAt: '2026-10-04T12:00:00', rating: 9 } as any,
        { itemId: 'm2', kind: 'movie', isPastWatch: true, watchedAt: '2026-10-04T12:00:00', rating: 1 } as any
      ];

      const stats = calculateStats(state, 'current');
      expect(stats.movieCount).toBe(1); // Sadece 1 film sayılmalı
      expect(stats.totalActualMinutes).toBe(100);
      expect(stats.avgMovie).toBe(9); // 1 Puanlık geçmiş film ortalamayı BOZAMAZ
    });

    test('Tümü (all) modunda hem güncel hem geçmiş veriler BİRLEŞTİRİLMELİ', () => {
      const state = getInitialState();
      state.history = [
        { itemId: 'm1', kind: 'movie', isPastWatch: false, watchedAt: '2026-10-04T12:00:00', rating: 8 } as any,
        { itemId: 'm2', kind: 'movie', isPastWatch: true, watchedAt: '2026-10-04T12:00:00', rating: 10 } as any
      ];
      const stats = calculateStats(state, 'all');
      expect(stats.avgTotal).toBe(9); // (8 + 10) / 2 = 9
    });
  });

  // ==========================================
  // 2. YILDIZLAR GEÇİDİ VE KÜNYE ANALİZİ
  // ==========================================
  describe('Yıldızlar Geçidi (Favori Kişiler & Stüdyolar)', () => {
    test('En Çok İzlenen Yönetmenler ve Oyuncular doğru sıralanmalı', () => {
      const state = getInitialState();
      state.movies = [
        { id: 'm1', watched: true, directors: ['Christopher Nolan'], cast: ['Cillian Murphy'], rating: 9 } as any,
        { id: 'm2', watched: true, directors: ['Christopher Nolan'], cast: ['Christian Bale'], rating: 8 } as any,
        { id: 'm3', watched: true, directors: ['Tarantino'], cast: ['Brad Pitt'], rating: 10 } as any
      ];
      state.history = state.movies.map(m => ({ itemId: m.id, kind: 'movie', rating: m.rating, watchedAt: '2026-10-04T12:00:00' } as any));

      const stats = calculateStats(state, 'current');
      
      expect(stats.topDirectors[0].name).toBe('Christopher Nolan');
      expect(stats.topDirectors[0].count).toBe(2);
      expect(stats.topDirectors[1].name).toBe('Tarantino');
    });

    test('Dünya Sineması Pasaportu (Diller) doğru ayrıştırılmalı', () => {
      const state = getInitialState();
      state.movies = [
        { id: 'm1', watched: true, originalLanguage: 'en', rating: 8 } as any,
        { id: 'm2', watched: true, originalLanguage: 'en', rating: 10 } as any,
        { id: 'm3', watched: true, originalLanguage: 'ko', rating: 9 } as any // Korece
      ];
      
      const stats = calculateStats(state, 'current');
      const englishStats = stats.topLanguages.find(l => l.code === 'en');
      const koreanStats = stats.topLanguages.find(l => l.code === 'ko');

      expect(englishStats?.count).toBe(2);
      expect(englishStats?.avg).toBe(9); // (8+10)/2
      expect(koreanStats?.count).toBe(1);
    });
  });

  // ==========================================
  // 3. SAYAÇ & ZAMAN BÜKÜCÜ METRİKLERİ
  // ==========================================
  describe('Zaman Bükücü & Tasarruf Metrikleri', () => {
    test('Erken Biten filmler, Kazanılan Süre ve Hız Çarpanı doğru hesaplanmalı', () => {
      const state = getInitialState();
      state.movies = [
        // 120 dakikalık film 60 dakikada bitirildi (2x Hız / 60 dk Kâr)
        { id: 'm1', watched: true, isPastWatch: false, runtime: 120, actualRuntime: 60 } as any,
        // 100 dakikalık film tam süresinde bitirildi (1x Hız / Kâr yok)
        { id: 'm2', watched: true, isPastWatch: false, runtime: 100, actualRuntime: 100 } as any
      ];
      state.history = state.movies.map(m => ({ itemId: m.id, kind: 'movie', watchedAt: '2026-10-04T12:00:00' } as any));

      const stats = calculateStats(state, 'current');
      
      expect(stats.earlyFinishedCount).toBe(1); // Sadece 1 film erken bitirilmiş
      expect(stats.totalSavedMinutes).toBe(60); // Toplam 60 dk kâr
      expect(stats.catalogMovieRuntimeMinutes).toBe(220); // 120 + 100 (Katalog süresi)
      expect(stats.actualMovieRuntimeMinutes).toBe(160);  // 60 + 100 (Gerçek izlenen süre)
      
      // Toplam Runtime (220) / Toplam Actual (160) = 1.375x Ortalama Hız
      expect(stats.avgSpeedMultiplier).toBeCloseTo(1.375, 2);
      expect(stats.fastestMovieRecord?.title).toBe(state.movies[0].title); // En hızlısı 1. film
    });
  });

  // ==========================================
  // 4. ALIŞKANLIK VE ZAMAN DİLİMİ (BİYORİTİM)
  // ==========================================
  describe('İzleme Biyoritmi ve Seriler', () => {
    test('İzleme saatleri Sabah, Gündüz, Prime Time ve Gece olarak ayrıştırılmalı', () => {
      const state = getInitialState();
      // UTC SORUNU ÇÖZÜLDÜ: 'Z' ibareleri kaldırıldı, yerel saat sabitlendi!
      state.history = [
        { watchedAt: '2026-10-04T08:00:00', isPastWatch: false } as any, // Sabah (06-12)
        { watchedAt: '2026-10-04T15:00:00', isPastWatch: false } as any, // Öğlen (12-18)
        { watchedAt: '2026-10-04T20:00:00', isPastWatch: false } as any, // Akşam (18-23)
        { watchedAt: '2026-10-04T03:00:00', isPastWatch: false } as any  // Gece (00-06)
      ];

      const stats = calculateStats(state, 'all');
      expect(stats.timeBuckets.morning).toBe(1);
      expect(stats.timeBuckets.afternoon).toBe(1);
      expect(stats.timeBuckets.evening).toBe(1);
      expect(stats.timeBuckets.night).toBe(1);
    });

    test('En Yoğun Gün (Busiest Day) ve Max Seri (Max Streak) doğru bulunmalı', () => {
      const state = getInitialState();
      state.history = [
        { watchedAt: '2026-10-01T10:00:00' } as any,
        { watchedAt: '2026-10-02T10:00:00' } as any,
        { watchedAt: '2026-10-02T12:00:00' } as any, // Ayın 2'sinde 2 film izlendi (En yoğun)
        { watchedAt: '2026-10-03T10:00:00' } as any  // 3 gün peş peşe!
      ];

      const stats = calculateStats(state, 'all');
      expect(stats.busiestDay.count).toBe(2); 
      expect(stats.maxStreakEver).toBe(3); // 3 gün aralıksız
    });
  });

  // ==========================================
  // 5. RADAR & DETAYLI ANALİZLER
  // ==========================================
  describe('Karakter Radarı ve Not İstatistikleri', () => {
    test('Sinefil Karakter Radarı (Kriter Ortalamaları) doğru hesaplanmalı', () => {
      const state = getInitialState();
      state.criteria = [
        { id: 'crit_1', name: 'Senaryo', weight: 10, appliesTo: 'both', genres: [] },
        { id: 'crit_2', name: 'Oyunculuk', weight: 10, appliesTo: 'both', genres: [] }
      ];
      state.history = [
        { watchedAt: '2026-10-04T12:00:00', detailedRating: { 'crit_1': 8, 'crit_2': 6 } } as any,
        { watchedAt: '2026-10-05T12:00:00', detailedRating: { 'crit_1': 10, 'crit_2': 8 } } as any
      ];

      const stats = calculateStats(state, 'current');
      
      const senaryoRadar = stats.radarData.find(r => r.name === 'Senaryo');
      const oyunculukRadar = stats.radarData.find(r => r.name === 'Oyunculuk');
      
      expect(senaryoRadar?.score).toBe(9); // (8+10)/2
      expect(oyunculukRadar?.score).toBe(7); // (6+8)/2
    });

    test('Değerlendirme Başlıkları (Review Tags) sıklığı ve ortalaması doğru olmalı', () => {
      const state = getInitialState();
      state.history = [
        { reviewTags: ['🔥 Başyapıt', '🍿 Akıcı & Keyifli'], rating: 10, watchedAt: '2026-10-01T12:00:00' } as any,
        { reviewTags: ['🔥 Başyapıt'], rating: 8, watchedAt: '2026-10-02T12:00:00' } as any
      ];

      const stats = calculateStats(state, 'current');
      
      const basyapitStat = stats.reviewTagStats.find(t => t.tag === '🔥 Başyapıt');
      expect(basyapitStat?.count).toBe(2);
      expect(basyapitStat?.avg).toBe(9); // (10+8)/2
    });

    test('Yazılan notların kelime sayısı (totalNoteWords) doğru sayılmalı', () => {
      const state = getInitialState();
      state.history = [
        { note: 'Bu film gerçekten çok güzeldi', watchedAt: '2026-10-01T12:00:00' } as any, // 5 kelime
        { note: 'Berbat', watchedAt: '2026-10-02T12:00:00' } as any // 1 kelime
      ];

      const stats = calculateStats(state, 'current');
      expect(stats.notesCount).toBe(2);
      expect(stats.totalNoteWords).toBe(6); // 5 + 1
    });
  });

  // ==========================================
  // 6. SIRADA BEKLEYENLER VE KOLEKSİYONLAR
  // ==========================================
  describe('İzlenmeyi Bekleyenler ve Koleksiyon İlerlemesi', () => {
    test('İzlenmemiş yapımlar ve tamamlanma oranları doğru verilmeli', () => {
      const state = getInitialState();
      state.movies = [
        { id: 'm1', watched: true },
        { id: 'm2', watched: false },
        { id: 'm3', watched: false }
      ] as any[];
      // 3 filmin 1'i izlenmiş (%33 tamamlanma)

      const stats = calculateStats(state, 'current');
      expect(stats.remainingMovies).toBe(2);
      expect(stats.movieCompletionPct).toBe(33); // (1/3) * 100
    });

    test('Koleksiyon İlerlemesi (Yüzdelik) doğru hesaplanmalı', () => {
      const state = getInitialState();
      state.collections = [{ id: 'c1', name: 'Yüzüklerin Efendisi' }] as any[];
      state.movies = [
        { id: 'm1', collectionId: 'c1', watched: true },
        { id: 'm2', collectionId: 'c1', watched: false }
      ] as any[];

      const stats = calculateStats(state, 'current');
      const lotrStat = stats.collectionStats.find(c => c.name === 'Yüzüklerin Efendisi');
      
      expect(lotrStat?.total).toBe(2);
      expect(lotrStat?.watched).toBe(1);
      expect(lotrStat?.progress).toBe(50); // %50 Tamamlandı
    });
  });

});