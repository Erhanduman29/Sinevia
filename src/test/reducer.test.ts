import { expect, test, describe } from 'vitest';
import { rootReducer, isPositiveTag } from '../context/AppContext';
import type { ExtendedAppData } from '../context/AppContext';

// Temiz bir veritabanı yedeği oluşturucu
function getInitialState(): ExtendedAppData {
  return {
    movies: [], series: [], removedSeriesTitles: [], collections: [],
    genres: ['Aksiyon', 'Komedi', 'Dram'], reviewTags: [], history: [], achievements: [],
    criteria: [], xp: 0, level: 1, totalXp: 0, lastWatchDate: null, tagSentiments: {},
    dailyStreak: 0, dailyStreakDate: null, showLockedNames: false,
    theme: 'default', altWatchTemplate: '', weeklyPlan: [], notificationsEnabled: false
  };
}

describe('🧠 SİNEVİA ANA VERİTABANI VE AYARLAR (REDUCER) TESTLERİ', () => {

  // ==========================================
  // 1. TÜR (GENRE) YÖNETİMİ
  // ==========================================
  describe('Tür (Genre) Ayarları ve Güncellemeleri', () => {
    
    test('ADD_GENRE: Yeni tür eklendiğinde listeye girmeli (Ancak aynı tür iki kez eklenemez)', () => {
      let state = getInitialState();
      
      state = rootReducer(state, { type: 'ADD_GENRE', genre: 'Korku' } as any);
      expect(state.genres).toContain('Korku');

      // Aynı türü (küçük/büyük harf fark etmeksizin) tekrar eklemeye çalışalım
      state = rootReducer(state, { type: 'ADD_GENRE', genre: 'KORKU' } as any);
      // Listede sadece 1 tane "Korku" olmalı, aynı isimle 2. kez eklenmemeli
      const korkuCount = state.genres.filter(g => g.toLowerCase() === 'korku').length;
      expect(korkuCount).toBe(1);
    });

    test('RENAME_GENRE: Tür adı değiştiğinde, kütüphanedeki TÜM filmlerin ve geçmişin türleri de güncellenmeli', () => {
      const state = getInitialState();
      // Kütüphanede 'Aksiyon' türünde bir film ve geçmiş var
      state.movies = [{ id: 'm1', title: 'Zor Ölüm', genres: ['Aksiyon', 'Gerilim'] } as any];
      state.history = [{ id: 'h1', genres: ['Aksiyon', 'Gerilim'] } as any];

      // Kullanıcı Ayarlar sayfasından 'Aksiyon' türünün adını 'Süper Aksiyon' olarak değiştiriyor
      const newState = rootReducer(state, { type: 'RENAME_GENRE', oldName: 'Aksiyon', newName: 'Süper Aksiyon' } as any);
      
      expect(newState.genres).toContain('Süper Aksiyon');
      expect(newState.genres).not.toContain('Aksiyon'); // Eski isim silinmeli
      
      // Filmin ve Geçmişin içindeki türler de otomatik güncellenmiş olmalı!
      expect(newState.movies[0].genres).toContain('Süper Aksiyon');
      expect(newState.history[0].genres).toContain('Süper Aksiyon');
    });

    test('DELETE_GENRE: Tür silindiğinde listeden çıkmalı', () => {
      const state = getInitialState();
      const newState = rootReducer(state, { type: 'DELETE_GENRE', genre: 'Komedi' } as any);
      expect(newState.genres).not.toContain('Komedi');
    });
  });

  // ==========================================
  // 2. İNCELEME ETİKETLERİ (REVIEW TAGS) VE DUYGULAR (SENTIMENTS)
  // ==========================================
  describe('İnceleme Etiketleri ve Duygu (Övgü/Eleştiri) Analizi', () => {

    test('isPositiveTag (Helper): Emojilerin veya manuel ayarların duygu analizini doğru yapmalı', () => {
      const sentiments = { 'Harika Film': 'positive', 'Berbat Ötesi': 'negative' } as const;
      
      // 1. Manuel ayar varsa onu kullanmalı
      expect(isPositiveTag('Berbat Ötesi', sentiments)).toBe(false);
      
      // 2. Manuel ayar yoksa İlk Emojiye (🔥, 💩) göre karar vermeli
      expect(isPositiveTag('🔥 Başyapıt', sentiments)).toBe(true); // Pozitif
      expect(isPositiveTag('💩 Zaman Kaybı', sentiments)).toBe(false); // Negatif
    });

    test('SET_TAG_SENTIMENT: Kullanıcı bir etiket için özel övgü/eleştiri atadığında state güncellenmeli', () => {
      const state = getInitialState();
      const newState = rootReducer(state, { type: 'SET_TAG_SENTIMENT', tag: 'İlginç', sentiment: 'negative' } as any);
      
      expect(newState.tagSentiments?.['İlginç']).toBe('negative');
    });

    test('RENAME_REVIEW_TAG: Etiket adı değiştiğinde filmlerdeki etiketler de değişmeli', () => {
      const state = getInitialState();
      state.movies = [{ id: 'm1', reviewTags: ['🔥 Başyapıt', '🍿 Çerezlik'] } as any];
      
      const newState = rootReducer(state, { 
        type: 'RENAME_REVIEW_TAG', oldTag: '🔥 Başyapıt', newTag: '👑 Efsane', sentiment: 'positive' 
      } as any);

      expect(newState.movies[0].reviewTags).toContain('👑 Efsane');
      expect(newState.movies[0].reviewTags).not.toContain('🔥 Başyapıt');
      expect(newState.tagSentiments?.['👑 Efsane']).toBe('positive'); // Duygu da yeni isme aktarılmalı
    });
  });

  // ==========================================
  // 3. PUANLAMA KRİTERLERİ (CRITERIA)
  // ==========================================
  describe('Detaylı Puanlama Kriterleri Ayarları', () => {
    
    test('ADD_CRITERION & DELETE_CRITERION: Kriter ekleme ve silme', () => {
      let state = getInitialState();
      
      const newCrit = { id: 'c1', name: 'Oyunculuk', weight: 8, appliesTo: 'both', genres: [] } as any;
      state = rootReducer(state, { type: 'ADD_CRITERION', criterion: newCrit } as any);
      
      expect(state.criteria?.length).toBe(1);
      expect(state.criteria![0].name).toBe('Oyunculuk');

      state = rootReducer(state, { type: 'DELETE_CRITERION', id: 'c1' } as any);
      expect(state.criteria?.length).toBe(0);
    });
  });

  // ==========================================
  // 4. SİSTEM, TEMA VE GELİŞTİRİCİ AYARLARI
  // ==========================================
  describe('Uygulama İçi Özelleştirmeler', () => {

    test('SET_THEME: Tema değiştirme işlemi', () => {
      const state = getInitialState();
      const newState = rootReducer(state, { type: 'SET_THEME', theme: 'cyberpunk' } as any);
      expect(newState.theme).toBe('cyberpunk');
    });

    test('TOGGLE_NOTIFICATIONS: Bildirim izinleri', () => {
      const state = getInitialState();
      const newState = rootReducer(state, { type: 'TOGGLE_NOTIFICATIONS', enabled: true } as any);
      expect(newState.notificationsEnabled).toBe(true);
    });

    test('TOGGLE_LOCKED_NAMES: Kilitli başarım isimlerini gösterme (Dev Mode)', () => {
      const state = getInitialState();
      expect(state.showLockedNames).toBe(false);
      
      const newState = rootReducer(state, { type: 'TOGGLE_LOCKED_NAMES' } as any);
      expect(newState.showLockedNames).toBe(true);
    });
  });

  // ==========================================
  // 5. FİLM EYLEMLERİ (GÜVENLİK TESTLERİ)
  // ==========================================
  describe('Film (Movie) Eylemleri Temel Kontroller', () => {
    test('WATCH_MOVIE: Film izlendiğinde geçmiş kaydedilmeli', () => {
      const state = getInitialState();
      state.movies = [{ id: 'm1', title: 'Dune', watched: false, rating: null } as any];

      const action: any = {
        type: 'WATCH_MOVIE', id: 'm1', rating: 9, note: 'Efsane!', watchedAt: '2026-10-04',
        isPastWatch: false, historyItem: { id: 'h1', kind: 'movie', rating: 9 }
      };

      const newState = rootReducer(state, action);
      expect(newState.movies[0].watched).toBe(true);
      expect(newState.history.length).toBe(1);
    });

    test('UNWATCH_MOVIE: Filmin izlenmesi geri alındığında (Geri Al) film sıfırlanmalı', () => {
      const state = getInitialState();
      state.movies = [{ id: 'm1', watched: true, rating: 8, note: 'İyi' } as any];
      state.history = [{ id: 'h1', itemId: 'm1' } as any];

      const newState = rootReducer(state, { type: 'UNWATCH_MOVIE', id: 'm1' } as any);
      expect(newState.movies[0].watched).toBe(false); 
      expect(newState.movies[0].rating).toBeNull(); 
      expect(newState.history.length).toBe(0); 
    });

    test('DELETE_MOVIE: Film silindiğinde Haftalık Plandan da SİLİNMELİ', () => {
      const state = getInitialState();
      state.movies = [{ id: 'm1', title: 'Silinecek' } as any];
      state.weeklyPlan = [{ id: 'p1', movieId: 'm1' } as any]; 

      const newState = rootReducer(state, { type: 'DELETE_MOVIE', id: 'm1' } as any);
      expect(newState.movies.length).toBe(0); 
      expect(newState.weeklyPlan!.length).toBe(0); 
    });
  });

  // ==========================================
  // 6. HAFTALIK PLAN (WEEKLY PLAN) EYLEMLERİ
  // ==========================================
  describe('Haftalık Plan (Takvim) Eylemleri', () => {
    test('ADD_PLAN_ITEM: Yeni bir plan öğesi eklendiğinde state doğru güncellenmeli', () => {
      const state = getInitialState();
      const newState = rootReducer(state, { type: 'ADD_PLAN_ITEM', item: { id: 'p1', movieId: 'm1', date: '2026-10-04', time: '20:00' } } as any);
      expect(newState.weeklyPlan!.length).toBe(1);
    });

    test('UPDATE_PLAN_ITEM: Planlanan saati ve tarihi değiştirebilmeli', () => {
      const state = getInitialState();
      state.weeklyPlan = [{ id: 'p1', movieId: 'm1', date: '2026-10-04', time: '20:00' } as any];

      const newState = rootReducer(state, { type: 'UPDATE_PLAN_ITEM', id: 'p1', date: '2026-10-05', time: '22:30' } as any);
      expect(newState.weeklyPlan![0].date).toBe('2026-10-05');
      expect(newState.weeklyPlan![0].time).toBe('22:30');
    });
  });

});