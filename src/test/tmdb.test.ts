import { expect, test, describe, vi, beforeEach } from 'vitest';
import { searchTMDB, searchTMDBSeries } from '../lib/tmdb';

// TMDB'den gelecekmiş gibi davranan SAHTE (Mock) veriler
const mockMovieSearchData = {
  results: [
    {
      id: 550,
      title: "Fight Club",
      release_date: "1999-10-15",
      poster_path: "/fclub.jpg",
      overview: "İlk kural...",
      genre_ids: [18, 53] // Dram, Gerilim
    }
  ]
};

const mockMovieDetailData = {
  runtime: 139,
  external_ids: { imdb_id: "tt0137523" },
  production_companies: [{ name: "Fox 2000 Pictures" }],
  keywords: { keywords: [{ name: "fight" }, { name: "club" }] },
  credits: {
    crew: [{ name: "David Fincher", job: "Director" }],
    cast: [{ name: "Brad Pitt" }, { name: "Edward Norton" }]
  },
  "watch/providers": {
    results: {
      TR: {
        flatrate: [{ provider_name: "Netflix", logo_path: "/netflix.jpg" }]
      }
    }
  }
};

describe('🌐 TMDB API ENTEGRASYON TESTLERİ', () => {

  // Her testten önce fetch'i ele geçiriyoruz (Mocking)
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      // Eğer ana arama linki ise:
      if (url.includes('/search/movie')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMovieSearchData) });
      }
      // Eğer detaylar (append_to_response) linki ise:
      if (url.includes('/movie/550')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMovieDetailData) });
      }
      return Promise.resolve({ ok: false });
    });
  });

  // ==========================================
  // 1. FİLM ARAMA VE VERİ ÇEVİRME
  // ==========================================
  describe('searchTMDB (Film)', () => {
    
    test('Gelen karmaşık API verisini Sinevia Movie objesine doğru çevirmeli', async () => {
      const results = await searchTMDB('Fight Club');
      
      expect(results.length).toBe(1);
      const movie = results[0];

      // Temel bilgiler
      expect(movie.id).toBe(550);
      expect(movie.title).toBe('Fight Club');
      expect(movie.year).toBe('1999'); // release_date'ten sadece yılı almalı
      expect(movie.posterUrl).toBe('https://image.tmdb.org/t/p/w500/fclub.jpg');
      expect(movie.runtime).toBe(139);
      expect(movie.imdbId).toBe('tt0137523');

      // Tür çevirisi (18 -> Dram, 53 -> Gerilim)
      expect(movie.genres).toContain('Dram');
      expect(movie.genres).toContain('Gerilim');

      // Ekstra Bilgiler (Yönetmen, Oyuncu, Stüdyo)
      expect(movie.directors).toContain('David Fincher');
      expect(movie.cast).toContain('Brad Pitt');
      expect(movie.studios).toContain('Fox 2000 Pictures');
      expect(movie.keywords).toContain('fight');

      // Yasal İzleme Platformları (Watch Providers)
      expect(movie.watchProviders?.length).toBe(1);
      expect(movie.watchProviders![0].providerName).toBe('Netflix');
      expect(movie.watchProviders![0].logoUrl).toBe('https://image.tmdb.org/t/p/w200/netflix.jpg');
    });

    test('API Hata verdiğinde çökmek yerine boş dizi ([]) dönmeli', async () => {
      // Fetch'i kasten bozuyoruz
      global.fetch = vi.fn().mockRejectedValue(new Error("API Down"));
      
      const results = await searchTMDB('Test');
      expect(results).toEqual([]); // Çökmedi, boş döndü.
    });

  });

});