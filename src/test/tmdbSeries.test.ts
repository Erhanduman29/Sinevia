import { describe, test, expect, vi, beforeEach } from 'vitest';
import { searchTMDBSeries } from '../lib/tmdb';

// ============================================================================
// TMDB DİZİ ARAMA (searchTMDBSeries) — Dönüşüm, yedekleme ve hata güvenliği
// ============================================================================

const mockSeriesSearchData = {
  results: [
    {
      id: 1399,
      name: 'Game of Thrones',
      first_air_date: '2011-04-17',
      poster_path: '/got.jpg',
      overview: 'Taht savaşları',
      genre_ids: [18, 10765],
      original_language: 'en',
    },
  ],
};

const mockSeriesDetailData = {
  seasons: [
    { season_number: 0, episode_count: 10 }, // Özel sezon (0) elenmeli
    { season_number: 2, episode_count: 8 },
    { season_number: 1, episode_count: 73 },
  ],
  genres: [{ name: 'Fantastik' }, { name: 'Dram' }],
  created_by: [{ name: 'D. Benioff' }, { name: 'D. B. Weiss' }],
  production_companies: [{ name: 'HBO' }],
  keywords: { results: [{ name: 'Dragon' }, { name: 'Throne' }] },
  credits: { cast: [{ name: 'Emilia Clarke' }, { name: 'Kit Harington' }] },
  external_ids: { imdb_id: 'tt0944947' },
  'watch/providers': {
    results: {
      TR: {
        flatrate: [{ provider_name: 'Max', logo_path: '/max.jpg' }],
        link: 'https://www.themoviedb.org/w320',
      },
    },
  },
};

describe('TMDB DİZİ ENTEGRASYON TESTLERİ', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/search/tv')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSeriesSearchData) });
      }
      const detailMatch = url.match(/\/tv\/(\d+)\?/);
      if (detailMatch) {
        const id = Number(detailMatch[1]);
        if (id === 1399) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSeriesDetailData) });
        }
        // Detay verisi olmayan diziler boş obje döner (yedek dal testleri)
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: false });
    });
  });

  test('detaylı veriyi Sinevia Series objesine doğru çevirmeli (sezon, tür, künye)', async () => {
    const results = await searchTMDBSeries('Game of Thrones');

    expect(results).toHaveLength(1);
    const s = results[0];

    expect(s.id).toBe(1399);
    expect(s.title).toBe('Game of Thrones');
    expect(s.year).toBe('2011'); // first_air_date yalnızca yıl
    expect(s.posterUrl).toBe('https://image.tmdb.org/t/p/w500/got.jpg');
    expect(s.originalLanguage).toBe('en');
    expect(s.imdbId).toBe('tt0944947');

    // 0. sezon elenmeli, sezonlar artan sırada ve bölüm sayılarıyla dönmeli
    expect(s.seasons).toEqual([73, 8]);

    // Detaydan gelen türler (id → isim eşlemesi DEĞİL)
    expect(s.genres).toEqual(['Fantastik', 'Dram']);
    expect(s.creators).toEqual(['D. Benioff', 'D. B. Weiss']);
    expect(s.cast).toEqual(['Emilia Clarke', 'Kit Harington']);
    expect(s.studios).toEqual(['HBO']);
    expect(s.keywords).toEqual(['dragon', 'throne']); // küçük harfe çevrilmeli

    // Türkiye yasal platformları
    expect(s.watchProviders).toHaveLength(1);
    expect(s.watchProviders![0].providerName).toBe('Max');
    expect(s.watchProviders![0].logoUrl).toBe('https://image.tmdb.org/t/p/w200/max.jpg');
  });

  test('detay isteği boş dönerse yedek değerler devreye girmeli (sezon=[10], tür id’den)', async () => {
    // 1399 dışındaki id'ler boş detay döner
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/search/tv')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            results: [{ id: 99, name: 'Bilinmeyen Dizi', first_air_date: '2020-01-01', genre_ids: [18] }],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const results = await searchTMDBSeries('Bilinmeyen');
    expect(results).toHaveLength(1);
    expect(results[0].seasons).toEqual([10]); // varsayılan sezon sayısı
    expect(results[0].genres).toEqual(['Dram']); // 18 → Dram
    expect(results[0].watchProviders).toEqual([]);
    expect(results[0].creators).toEqual([]);
  });

  test('sonuç sayısı 8 ile sınırlı olmalı (10 sonuç gelse bile 8 dönmalı)', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: 100 + i,
      name: `Dizi ${i}`,
      first_air_date: '2021-01-01',
      genre_ids: [],
    }));

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/search/tv')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: many }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const results = await searchTMDBSeries('Dizi');
    expect(results).toHaveLength(8);
    expect(results[0].id).toBe(100);
    expect(results[7].id).toBe(107);
  });

  test('API hata verdiğinde (ok:false) boş dizi dönmeli', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const results = await searchTMDBSeries('Test');
    expect(results).toEqual([]);
  });

  test('fetch tamamen patlarsa çökmemeli, boş dizi dönmeli', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    const results = await searchTMDBSeries('Test');
    expect(results).toEqual([]);
  });
});
