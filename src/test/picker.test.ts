import { expect, test, describe } from 'vitest';
import { filterPickerCandidates } from '../lib/pickerLogic';

// Testler için hızlıca Film ve Dizi objeleri üreten yardımcı fonksiyonlar
function createMovie(overrides: any = {}) {
  return { 
    id: overrides.id || 'm_default', 
    title: overrides.title || 'Adsız Film', 
    runtime: 120, 
    genres: ['Dram'], 
    inPastQueue: false, 
    ...overrides 
  };
}

function createSeriesItem(overrides: any = {}) {
  return {
    series: { 
      id: overrides.id || 's_default', 
      title: overrides.title || 'Adsız Dizi', 
      genres: ['Dram'], 
      ...overrides.series 
    },
    episode: { season: 1, episode: 1, ...overrides.episode }
  };
}

describe('🎡 SİNEMA ÇARKI (PICKER) VE FİLTRELEME MOTORU KAPSAMLI TESTİ', () => {

  // ==========================================
  // 1. KATEGORİ (MOD) FİLTRELERİ
  // ==========================================
  describe('Kategori Seçimi (Film, Dizi, Tümü)', () => {
    const mockMovies = [createMovie({ id: 'm1' }), createMovie({ id: 'm2' })];
    const mockSeries = [createSeriesItem({ id: 's1' }), createSeriesItem({ id: 's2' })];

    test('Sadece Film (movie) modu seçildiğinde diziler elenmeli', () => {
      const sonuc = filterPickerCandidates(mockMovies, mockSeries as any, 'movie', null, 'any');
      expect(sonuc.length).toBe(2);
      expect(sonuc.every(item => item.kind === 'movie')).toBe(true);
    });

    test('Sadece Dizi (series) modu seçildiğinde filmler elenmeli', () => {
      const sonuc = filterPickerCandidates(mockMovies, mockSeries as any, 'series', null, 'any');
      expect(sonuc.length).toBe(2);
      expect(sonuc.every(item => item.kind === 'series')).toBe(true);
    });

    test('Karışık (all) modunda hem film hem diziler gelmeli', () => {
      const sonuc = filterPickerCandidates(mockMovies, mockSeries as any, 'all', null, 'any');
      expect(sonuc.length).toBe(4);
    });
  });

  // ==========================================
  // 2. SÜRE (TEMPO/RUNTIME) FİLTRELERİ
  // ==========================================
  describe('Film Süresi Filtrelemeleri', () => {
    const mockMovies = [
      createMovie({ title: 'Çerezlik', runtime: 85 }),    // Short (< 100)
      createMovie({ title: 'Standart', runtime: 120 }),   // Medium (100 - 140)
      createMovie({ title: 'Epik', runtime: 160 }),       // Long (> 140)
      createMovie({ title: 'Tanımsız', runtime: undefined }) // Undefined (Varsayılan 115 dk kabul edilir)
    ];

    test('⚡ Çerezlik (short) modu 100 dakikadan kısa filmleri getirmeli', () => {
      const sonuc = filterPickerCandidates(mockMovies, [], 'movie', null, 'short');
      expect(sonuc.length).toBe(1);
      expect((sonuc[0] as any).movie.title).toBe('Çerezlik');
    });

    test('🎬 Standart (medium) modu 100 ile 140 dakika arasını (ve süresi bilinmeyenleri) getirmeli', () => {
      const sonuc = filterPickerCandidates(mockMovies, [], 'movie', null, 'medium');
      expect(sonuc.length).toBe(2);
      
      const titles = sonuc.map(s => (s as any).movie.title);
      expect(titles).toContain('Standart');
      expect(titles).toContain('Tanımsız'); // 115 varsayıldığı için medium aralığındadır
    });

    test('🍿 Epik/Uzun (long) modu 140 dakikadan uzun filmleri getirmeli', () => {
      const sonuc = filterPickerCandidates(mockMovies, [], 'movie', null, 'long');
      expect(sonuc.length).toBe(1);
      expect((sonuc[0] as any).movie.title).toBe('Epik');
    });
  });

  // ==========================================
  // 3. TÜR (GENRE) FİLTRELERİ
  // ==========================================
  describe('Tür ve Ruh Hali Filtrelemesi', () => {
    test('Belirli bir tür seçildiğinde sadece o türe sahip Film ve Diziler gelmeli', () => {
      const mockMovies = [
        createMovie({ title: 'Aksiyon Filmi', genres: ['Aksiyon'] }),
        createMovie({ title: 'Korku Filmi', genres: ['Korku'] })
      ];
      const mockSeries = [
        createSeriesItem({ series: { genres: ['Bilim Kurgu', 'Aksiyon'] } }),
        createSeriesItem({ series: { genres: ['Komedi'] } })
      ];

      const sonuc = filterPickerCandidates(mockMovies, mockSeries as any, 'all', 'Aksiyon', 'any');
      
      expect(sonuc.length).toBe(2);
      // Bir film, bir de dizi dönmeli
      const aksiyonFilmi = sonuc.find(s => s.kind === 'movie');
      const aksiyonDizisi = sonuc.find(s => s.kind === 'series');
      
      expect(aksiyonFilmi).toBeDefined();
      expect(aksiyonDizisi).toBeDefined();
    });

    test('Farketmez (null) seçildiğinde tür gözetmeksizin tümü gelmeli', () => {
      const mockMovies = [createMovie({ genres: ['Aksiyon'] }), createMovie({ genres: ['Korku'] })];
      const sonuc = filterPickerCandidates(mockMovies, [], 'movie', null, 'any');
      expect(sonuc.length).toBe(2);
    });
  });

  // ==========================================
  // 4. GÜVENLİK VE HARİÇ TUTMALAR
  // ==========================================
  describe('Eleme ve Güvenlik Duvarı', () => {
    test('Eskiden İzlenenler sırasındaki (inPastQueue) yapımlar çarka ASLA girememeli', () => {
      const mockMovies = [
        createMovie({ title: 'Normal Film', inPastQueue: false }),
        createMovie({ title: 'Geçmişe Atılan Film', inPastQueue: true }) // Bu elenmeli
      ];

      const sonuc = filterPickerCandidates(mockMovies, [], 'movie', null, 'any');
      expect(sonuc.length).toBe(1);
      expect((sonuc[0] as any).movie.title).toBe('Normal Film');
    });
  });

});