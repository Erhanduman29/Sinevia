import { expect, test, describe } from 'vitest';
import { filterAndSortMovies, filterAndSortSeries, searchMatches } from '../lib/catalogLogic';
import type { Movie, Series } from '../types';

describe('🔍 KATALOG, ARAMA VE FİLTRELEME MOTORU TESTLERİ', () => {

  // ==========================================
  // 1. ARAMA MOTORU EŞLEŞMELERİ (SEARCH)
  // ==========================================
  describe('Arama Kutusu (Search Match) Kontrolleri', () => {
    test('Büyük/küçük harf veya TR karakter fark etmeksizin doğru bulmalı', () => {
      expect(searchMatches('Yüzüklerin Efendisi', 'yüzük')).toBe(true);
      expect(searchMatches('YÜZÜKLERİN EFENDİSİ', 'yüzük')).toBe(true);
      expect(searchMatches('İzleyici', 'izle')).toBe(true);
    });

    test('Aranan kelime yoksa boş veya alakasız filmleri getirmemeli', () => {
      expect(searchMatches('Dune', 'avatar')).toBe(false);
      // Boş arama yapıldığında tüm filmler gelsin diye "true" dönmeli
      expect(searchMatches('Dune', '')).toBe(true); 
    });
  });

  // ==========================================
  // 2. FİLM LİSTESİ FİLTRE VE SIRALAMA
  // ==========================================
  describe('Film (Movie) Filtreleme ve Sıralaması', () => {
    
    const mockMovies: Movie[] = [
      { id: '1', title: 'Aksiyon Filmi', watched: false, genres: ['Aksiyon'], addedAt: '2026-01-01', rating: null } as any,
      { id: '2', title: 'İyi Dram', watched: true, isPastWatch: false, genres: ['Dram'], addedAt: '2026-02-01', rating: 9 } as any,
      { id: '3', title: 'Eski Çöp', watched: true, isPastWatch: true, genres: ['Dram', 'Korku'], addedAt: '2026-03-01', rating: 2 } as any,
    ];

    test('Sadece "İzlenmemişleri" getirmeli', () => {
      const res = filterAndSortMovies(mockMovies, 'unwatched', new Set(), '', 'added');
      expect(res.length).toBe(1);
      expect(res[0].id).toBe('1');
    });

    test('Sadece "Geçmişte İzlenenleri (Past)" getirmeli', () => {
      const res = filterAndSortMovies(mockMovies, 'past', new Set(), '', 'added');
      expect(res.length).toBe(1);
      expect(res[0].title).toBe('Eski Çöp');
    });

    test('Çoklu tür (Genre) filtresinde AND mantığı çalışmalı (Tüm türleri barındırmalı)', () => {
      const genres = new Set(['Dram', 'Korku']);
      const res = filterAndSortMovies(mockMovies, 'all', genres, '', 'added');
      expect(res.length).toBe(1);
      expect(res[0].title).toBe('Eski Çöp'); // Sadece "Eski Çöp" filminde hem Dram hem Korku var
    });

    test('Puana göre sıralama (Yüksekten Düşüğe)', () => {
      const res = filterAndSortMovies(mockMovies, 'all', new Set(), '', 'rating');
      expect(res[0].title).toBe('İyi Dram'); // 9 Puanlık film en üstte olmalı
      expect(res[1].title).toBe('Eski Çöp'); // 2 Puan
      expect(res[2].title).toBe('Aksiyon Filmi'); // Null puan (En altta)
    });

  });

  // ==========================================
  // 3. DİZİ LİSTESİ FİLTRE VE SIRALAMA
  // ==========================================
  describe('Dizi (Series) Filtreleme ve Sıralaması', () => {
    
    const mockSeries: Series[] = [
      { 
        id: 's1', title: 'Devam Eden Dizi', genres: [], addedAt: '2026-01-01',
        episodes: [{ watched: true, rating: 8 } as any, { watched: false, rating: null } as any] 
      } as any,
      { 
        id: 's2', title: 'Biten Dizi', genres: [], addedAt: '2026-02-01',
        episodes: [{ watched: true, rating: 10 } as any, { watched: true, rating: 8 } as any] // Ortalama 9
      } as any,
    ];

    test('Sadece "Tamamlanmış" (Biten) dizileri getirmeli', () => {
      // watchedFilter = true (Tamamlananlar)
      const res = filterAndSortSeries(mockSeries, true, new Set(), '', 'added');
      expect(res.length).toBe(1);
      expect(res[0].title).toBe('Biten Dizi'); // S2 dizisinde izlenmemiş bölüm yok
    });

    test('Sadece "İzlenmeye Devam Eden" dizileri getirmeli', () => {
      // watchedFilter = false (İzlenecek/Devam Eden)
      const res = filterAndSortSeries(mockSeries, false, new Set(), '', 'added');
      expect(res.length).toBe(1);
      expect(res[0].title).toBe('Devam Eden Dizi');
    });

    test('Bölüm Puanı Ortalamasına Göre Sıralama', () => {
      const res = filterAndSortSeries(mockSeries, null, new Set(), '', 'rating');
      // S2 dizisi (10+8 / 2 = 9) puan ortalaması ile üstte olmalı
      // S1 dizisi (8/1 = 8) puan ortalaması ile altta olmalı
      expect(res[0].id).toBe('s2'); 
    });

  });

});