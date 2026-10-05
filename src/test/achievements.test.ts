import { expect, test, describe } from 'vitest';
import { applyAchievements } from '../context/AppContext';
import type { ExtendedAppData } from '../context/AppContext';
import { ACHIEVEMENT_DEFS } from '../lib/achievements';

// --- YARDIMCI FONKSİYONLAR ---
function getBaseState(): ExtendedAppData {
  return {
    movies: [], series: [], removedSeriesTitles: [], collections: [],
    genres: [], reviewTags: [], history: [],
    achievements: ACHIEVEMENT_DEFS.map(def => ({ 
      achievementId: def.id, 
      current: 0, 
      unlockedTiers: [],
      tierDates: {},
      lastNotifiedTier: null 
    })),
    criteria: [], xp: 0, level: 1, totalXp: 0, lastWatchDate: null,
    dailyStreak: 0, dailyStreakDate: null, showLockedNames: false,
    theme: 'default', altWatchTemplate: '', weeklyPlan: [], notificationsEnabled: false
  };
}

const getBadgeCurrent = (state: ExtendedAppData, badgeId: string) => {
  return applyAchievements(state).achievements.find(a => a.achievementId === badgeId)?.current || 0;
};

describe('🏆 TÜM BAŞARIMLAR (ACHIEVEMENTS) %100 KAPSAM TESTİ', () => {

  // ==========================================
  // 1. KÜTÜPHANE VE EKLEME BAŞARIMLARI
  // ==========================================
  describe('Kütüphane & Ekleme (Film, Dizi, Örümcek Hisleri)', () => {
    test('Film & Dizi Ekleme: Eklenen yapım sayısını doğru okumalı', () => {
      const state = getBaseState();
      state.movies = Array.from({ length: 15 }, (_, i) => ({ id: `m${i}` } as any));
      state.series = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}` } as any));
      
      expect(getBadgeCurrent(state, 'movie_add')).toBe(15);
      expect(getBadgeCurrent(state, 'series_add')).toBe(7);
    });

    test('Örümcek Hisleri (Spider Sense): Çıkış yılı gelecek olan (örn: 2030) izlenmemiş filmleri bulmalı', () => {
      const state = getBaseState();
      state.movies = [
        { id: '1', watched: false, year: '2030' },
        { id: '2', watched: false, year: '2020' },
        { id: '3', watched: true, year: '2035' }
      ] as any[];
      expect(getBadgeCurrent(state, 'spider_sense')).toBe(1);
    });
  });

  // ==========================================
  // 2. PUANLAMA VE ELEŞTİRMEN BAŞARIMLARI
  // ==========================================
  describe('Puanlama (Mükemmelliyetçi, Nefret Kusucu, Kutuplaşma vb.)', () => {
    test('10 Tam Puanlar ve 9+ Puanlar doğru ayrıştırılmalı', () => {
      const state = getBaseState();
      state.history = [
        { kind: 'movie', rating: 10, watchedAt: '2026-01-01T12:00:00', isPastWatch: false },
        { kind: 'movie', rating: 10, watchedAt: '2026-01-02T12:00:00', isPastWatch: false },
        { kind: 'movie', rating: 9.5, watchedAt: '2026-01-03T12:00:00', isPastWatch: false },
        { kind: 'movie', rating: 9, watchedAt: '2026-01-04T12:00:00', isPastWatch: false },
        { kind: 'movie', rating: 3, watchedAt: '2026-01-05T12:00:00', isPastWatch: false },
      ] as any[];

      expect(getBadgeCurrent(state, 'perfect_rating')).toBe(2);
      expect(getBadgeCurrent(state, 'high_rating')).toBe(2);
      expect(getBadgeCurrent(state, 'low_rating')).toBe(1);
    });

    test('Acımasız Yargıç & Hater (1 ve 2 puanlık nefret kusma)', () => {
      const state = getBaseState();
      state.history = [
        { kind: 'movie', rating: 1, watchedAt: '2026-01-01T12:00:00', isPastWatch: false },
        { kind: 'movie', rating: 2, watchedAt: '2026-01-02T12:00:00', isPastWatch: false }
      ] as any[];
      expect(getBadgeCurrent(state, 'secret_critic')).toBe(2);
    });

    test('Seçici Eleştirmen (Puan verip hiç 10 vermeme durumu)', () => {
      const state = getBaseState();
      state.history = [
        { kind: 'movie', rating: 9, watchedAt: '2026-01-01T12:00:00', isPastWatch: false },
        { kind: 'movie', rating: 8, watchedAt: '2026-01-02T12:00:00', isPastWatch: false }
      ] as any[];
      expect(getBadgeCurrent(state, 'selective_critic')).toBe(2);
    });

    test('Renk Paleti (Geniş Puan Yelpazesi)', () => {
      const state = getBaseState();
      state.history = [1, 3.5, 7, 9].map(r => ({ kind: 'movie', rating: r, watchedAt: '2026-01-01T12:00:00', isPastWatch: false } as any));
      expect(getBadgeCurrent(state, 'color_palette')).toBe(4);
    });
  });

  // ==========================================
  // 3. İNCELEME (NOT) BAŞARIMLARI
  // ==========================================
  describe('Yorumlar (Destan Yazarı, Çöp Sevdalısı, Caps Lock)', () => {
    test('Destan Yazarı (5000+ karakter) ve Not Tutucu', () => {
      const state = getBaseState();
      const longNote = 'A'.repeat(5001);
      state.history = [
        { kind: 'movie', note: longNote, watchedAt: '2026-01-01T12:00:00', isPastWatch: false },
        { kind: 'movie', note: 'Kısa not', watchedAt: '2026-01-02T12:00:00', isPastWatch: false }
      ] as any[];
      expect(getBadgeCurrent(state, 'epic_writer')).toBe(1);
      expect(getBadgeCurrent(state, 'note_taker')).toBe(2);
    });

    test('Çöp Sevdalısı (3 Puan altı filmlere 500+ karakter not)', () => {
      const state = getBaseState();
      state.history = [{ kind: 'movie', rating: 2, note: 'A'.repeat(505), watchedAt: '2026-01-01T12:00:00', isPastWatch: false } as any];
      expect(getBadgeCurrent(state, 'trash_lover')).toBe(1);
    });

    test('Büyük Harf Sendromu (CAPS LOCK)', () => {
      const state = getBaseState();
      state.history = [
        { kind: 'movie', note: 'SÜPER BİR FİLM', watchedAt: '2026-01-01T12:00:00', isPastWatch: false },
        { kind: 'movie', note: 'Süper', watchedAt: '2026-01-02T12:00:00', isPastWatch: false }
      ] as any[];
      expect(getBadgeCurrent(state, 'caps_lock')).toBe(1);
    });
  });

  // ==========================================
  // 4. TÜR (GENRE) BAŞARIMLARI
  // ==========================================
  describe('Tür ve Kategori Analizleri (Aksiyon, Komedi vs.)', () => {
    test('Film Türleri (Aksiyon, Komedi, Dram, Korku, Bilim Kurgu)', () => {
      const state = getBaseState();
      state.history = [
        { kind: 'movie', genres: ['Aksiyon', 'Komedi'], watchedAt: '2026-01-01T12:00:00', isPastWatch: false },
        { kind: 'movie', genres: ['Korku', 'Dram', 'Sci-Fi'], watchedAt: '2026-01-02T12:00:00', isPastWatch: false }
      ] as any[];
      
      expect(getBadgeCurrent(state, 'movie_genre_action')).toBe(1);
      expect(getBadgeCurrent(state, 'movie_genre_comedy')).toBe(1);
      expect(getBadgeCurrent(state, 'movie_genre_horror')).toBe(1);
      expect(getBadgeCurrent(state, 'movie_genre_drama')).toBe(1);
      expect(getBadgeCurrent(state, 'movie_genre_scifi')).toBe(1);
    });

    test('Tür Kaşifi (Farklı Türlerin Toplamı)', () => {
      const state = getBaseState();
      state.history = [
        { kind: 'movie', genres: ['Aksiyon', 'Komedi'], watchedAt: '2026-01-01T12:00:00', isPastWatch: false },
        { kind: 'movie', genres: ['Aksiyon', 'Gerilim'], watchedAt: '2026-01-02T12:00:00', isPastWatch: false }
      ] as any[];
      expect(getBadgeCurrent(state, 'genre_explorer')).toBe(3); 
    });
  });

  // ==========================================
  // 5. ALIŞKANLIK VE ZAMAN DİLİMİ BAŞARIMLARI
  // ==========================================
  describe('Zaman Dilimleri (Gece Kuşu, Hafta Sonu, Yılbaşı)', () => {
    test('Gece Kuşu ve Sabah Şekeri saat aralıkları', () => {
      const state = getBaseState();
      // UTC zaman dilimi sorununu engellemek için Z yi kaldırdık
      state.history = [
        { watchedAt: '2026-10-04T03:00:00', isPastWatch: false, kind: 'movie' }, // Gece 3
        { watchedAt: '2026-10-04T07:00:00', isPastWatch: false, kind: 'movie' }  // Sabah 7
      ] as any[];
      expect(getBadgeCurrent(state, 'night_owl')).toBe(1);
      expect(getBadgeCurrent(state, 'morning_sweet')).toBe(1);
    });

    test('Hafta Sonu Keyfi (Cumartesi & Pazar)', () => {
      const state = getBaseState();
      state.history = [
        { watchedAt: '2026-10-04T12:00:00', isPastWatch: false }, // Pazar
        { watchedAt: '2026-10-05T12:00:00', isPastWatch: false }  // Pazartesi
      ] as any[];
      expect(getBadgeCurrent(state, 'weekend_watcher')).toBe(1);
    });

    test('Yılbaşı Yalnızlığı (31 Aralık Gecesi veya 1 Ocak Sabahı)', () => {
      const state = getBaseState();
      state.history = [{ watchedAt: '2026-12-31T22:00:00', isPastWatch: false }] as any[];
      expect(getBadgeCurrent(state, 'new_year_lonely')).toBe(1);
    });
  });

  // ==========================================
  // 6. MARATON VE SERİ BAŞARIMLARI
  // ==========================================
  describe('Maraton Serileri (Mağara Adamı, Günlük Seri, Dizi Koması)', () => {
    test('Günlük Film Rutini (Üst üste izlenen günler)', () => {
      const state = getBaseState();
      state.history = [
        { kind: 'movie', watchedAt: '2026-10-01T12:00:00', isPastWatch: false },
        { kind: 'movie', watchedAt: '2026-10-02T12:00:00', isPastWatch: false },
        { kind: 'movie', watchedAt: '2026-10-03T12:00:00', isPastWatch: false }
      ] as any[];
      expect(getBadgeCurrent(state, 'daily_movie')).toBe(3);
    });

    test('Mağara Adamı (7 Gün boyunca her gün 5 film)', () => {
      const state = getBaseState();
      const hist = [];
      for (let day = 1; day <= 7; day++) {
        for (let i = 0; i < 5; i++) {
          hist.push({ kind: 'movie', watchedAt: `2026-10-0${day}T12:00:00`, isPastWatch: false } as any);
        }
      }
      state.history = hist;
      expect(getBadgeCurrent(state, 'caveman')).toBe(7);
    });

    test('Kısa Günün Kârı (Tek Günde 3 Film)', () => {
      const state = getBaseState();
      state.history = [
        { kind: 'movie', watchedAt: '2026-10-04T10:00:00', isPastWatch: false },
        { kind: 'movie', watchedAt: '2026-10-04T12:00:00', isPastWatch: false },
        { kind: 'movie', watchedAt: '2026-10-04T15:00:00', isPastWatch: false }
      ] as any[];
      expect(getBadgeCurrent(state, 'short_day_profit')).toBe(1);
    });

    test('Dizi Koması (Aynı Günde Maksimum Bölüm)', () => {
      const state = getBaseState();
      state.history = [
        { kind: 'series', watchedAt: '2026-10-04T10:00:00', isPastWatch: false },
        { kind: 'series', watchedAt: '2026-10-04T12:00:00', isPastWatch: false },
        { kind: 'series', watchedAt: '2026-10-04T14:00:00', isPastWatch: false }
      ] as any[];
      expect(getBadgeCurrent(state, 'secret_binge')).toBe(3);
    });
  });

  // ==========================================
  // 7. HIZ, SÜRE VE SAYAÇ (TIMER) BAŞARIMLARI
  // ==========================================
  describe('Zaman Yönetimi (Hız Tutkunu, Koltuk Sevdalısı, Sabır Taşı)', () => {
    test('Zaman Tasarrufçusu (Kazanılan dakikalar)', () => {
      const state = getBaseState();
      state.movies = [{ id: 'm1', runtime: 150, actualRuntime: 100, watched: true, isPastWatch: false }] as any[];
      expect(getBadgeCurrent(state, 'time_saver')).toBe(50);
    });

    test('Orijinal Sadakat (Tam Süresinde İzleyenler)', () => {
      const state = getBaseState();
      state.movies = [{ id: 'm1', startedAt: 'xxx', runtime: 120, actualRuntime: 120, watched: true, isPastWatch: false }] as any[]; 
      expect(getBadgeCurrent(state, 'patient_purist')).toBe(1);
    });

    test('Koltuk Sevdalısı (Bir günde 300+ dakika izleme)', () => {
      const state = getBaseState();
      // AppContext, runtime okumak için history'deki filmi movies'te arıyor (h.itemId === m.id)
      state.movies = [
        { id: 'm1', runtime: 160 }, { id: 'm2', runtime: 150 }
      ] as any[];
      state.history = [
        { itemId: 'm1', kind: 'movie', watchedAt: '2026-10-04T10:00:00' },
        { itemId: 'm2', kind: 'movie', watchedAt: '2026-10-04T14:00:00' }
      ] as any[];
      expect(getBadgeCurrent(state, 'couch_potato')).toBe(1);
    });

    test('Işık Hızı (Eklendikten sonraki 24 saat içinde izleme)', () => {
      const state = getBaseState();
      state.movies = [{ id: 'm1', addedAt: '2026-10-04T10:00:00Z' }] as any[];
      state.history = [{ itemId: 'm1', kind: 'movie', rating: 9, watchedAt: '2026-10-04T15:00:00Z' }] as any[];
      expect(getBadgeCurrent(state, 'light_speed')).toBe(1);
    });
  });

  // ==========================================
  // 8. DİZİ SADAKATİ VE FİNAL BAŞARIMLARI
  // ==========================================
  describe('Dizi Yönetimi (Final Fobisi, Sabır Taşı, Yarım Asırlık)', () => {
    test('Sezon Fatihi (Tüm sezonların izlenmiş bölümleri)', () => {
      const state = getBaseState();
      state.series = [{
        id: 's1', episodes: [
          { season: 1, episode: 1, watched: true },
          { season: 1, episode: 2, watched: true } 
        ]
      }] as any[];
      expect(getBadgeCurrent(state, 'season_complete')).toBe(1);
    });

    test('Sabır Taşı (En az 8 sezonluk dizi bitirme)', () => {
      const state = getBaseState();
      state.series = [{
        id: 's1', episodes: [
          { season: 1, watched: true }, { season: 8, watched: true } 
        ]
      }] as any[];
      expect(getBadgeCurrent(state, 'patience_stone')).toBe(1);
    });

    test('Yarım Asırlık Dizi (100+ bölüm bitirme)', () => {
      const state = getBaseState();
      const episodes = Array.from({ length: 101 }, () => ({ watched: true }));
      state.series = [{ id: 's1', episodes }] as any[];
      expect(getBadgeCurrent(state, 'half_century_series')).toBe(1);
    });
  });

  // ==========================================
  // 9. KOLEKSİYON VE NOSTALJİ BAŞARIMLARI
  // ==========================================
  describe('Özel Koleksiyonlar ve Önceden İzlenenler', () => {
    test('Evren Fatihi (En az 3 filmlik koleksiyonu fulleme)', () => {
      const state = getBaseState();
      state.collections = [{ id: 'c1', name: 'Marvel' }] as any[];
      state.movies = [
        { collectionId: 'c1', watched: true },
        { collectionId: 'c1', watched: true },
        { collectionId: 'c1', watched: true }
      ] as any[];
      expect(getBadgeCurrent(state, 'universe_conqueror')).toBe(1);
    });

    test('Geçmişin Koruyucuları (Önceden izlenenlere puan verme)', () => {
      const state = getBaseState();
      state.movies = [
        { watched: true, isPastWatch: true, rating: 10 },
        { watched: true, isPastWatch: true, rating: 8, note: 'Harika' }
      ] as any[];
      
      expect(getBadgeCurrent(state, 'past_watcher')).toBe(2);
      expect(getBadgeCurrent(state, 'past_masterpiece')).toBe(1); 
      expect(getBadgeCurrent(state, 'past_critic')).toBe(1); 
    });
  });

});