import { expect, test, describe } from 'vitest';
import { calculateDnaSynthesis } from '../lib/dnaLogic';

// Testler için hızlıca film objesi üreten yardımcı fonksiyon
function createMovie(overrides: any = {}) {
  return {
    id: overrides.id || 'default_id',
    title: overrides.title || 'Adsız Film',
    directors: [], cast: [], genres: [], keywords: [], studios: [],
    year: '2020', runtime: 120, overview: '', collectionId: null,
    ...overrides
  };
}

describe('🧬 DNA SENTEZLEYİCİ ÇAPRAZLAMA MOTORU KAPSAMLI TESTİ', () => {

  // ==========================================
  // 1. YÖNETMEN (DIRECTORS)
  // ==========================================
  describe('Yönetmen Uyumları', () => {
    test('Her iki ebeveynle ORTAK yönetmen varsa +30 Puan vermeli', () => {
      const ebeveynA = createMovie({ id: 'A', directors: ['Christopher Nolan'] });
      const ebeveynB = createMovie({ id: 'B', directors: ['Christopher Nolan'] });
      const aday = createMovie({ id: 'C', directors: ['Christopher Nolan'] });

      const sonuc = calculateDnaSynthesis(ebeveynA, ebeveynB, [aday], 0);
      const trait = sonuc[0].traits.find((t: any) => t.category === 'Ortak Yönetmen');
      
      expect(trait).toBeDefined();
      expect(trait?.addedPct).toBe(30);
    });

    test('Sadece 1 ebeveynle AYNI yönetmen varsa +25 Puan vermeli', () => {
      const ebeveynA = createMovie({ id: 'A', directors: ['Tarantino'] });
      const ebeveynB = createMovie({ id: 'B', directors: ['Nolan'] });
      const aday = createMovie({ id: 'C', directors: ['Tarantino'] }); // Sadece A ile eşleşiyor

      const sonuc = calculateDnaSynthesis(ebeveynA, ebeveynB, [aday], 0);
      const trait = sonuc[0].traits.find((t: any) => t.category === 'Aynı Yönetmen');
      
      expect(trait).toBeDefined();
      expect(trait?.addedPct).toBe(25);
      expect(trait?.sourceType).toBe('A'); // Kaynak A filmi olmalı
    });
  });

  // ==========================================
  // 2. OYUNCU (CAST)
  // ==========================================
  describe('Oyuncu Uyumları ve Puan Sınırları (Caps)', () => {
    test('Ortak oyuncular başına +15 puan vermeli (Maksimum 30 puan sınırı ile)', () => {
      const ebeveynA = createMovie({ id: 'A', cast: ['Bale', 'Caine', 'Freeman'] });
      const ebeveynB = createMovie({ id: 'B', cast: ['Bale', 'Caine', 'Freeman'] });
      const aday = createMovie({ id: 'C', cast: ['Bale', 'Caine', 'Freeman'] }); // 3 ortak oyuncu (3 * 15 = 45 yapardı ama sınır 30)

      const sonuc = calculateDnaSynthesis(ebeveynA, ebeveynB, [aday], 0);
      const trait = sonuc[0].traits.find((t: any) => t.category === 'Ortak Oyuncu');
      
      expect(trait?.addedPct).toBe(30); // 30'da kesilmiş (Capped) olmalı
    });
  });

  // ==========================================
  // 3. TÜR (GENRES) VE ÇAPRAZ MELEZLEME
  // ==========================================
  describe('Tür ve Çapraz Tür Uyumları', () => {
    test('Çapraz Tür (1. Filmin Türü x 2. Filmin Türü) melezi doğru tespit edilmeli', () => {
      const ebeveynA = createMovie({ id: 'A', genres: ['Aksiyon'] });
      const ebeveynB = createMovie({ id: 'B', genres: ['Komedi'] });
      const aday = createMovie({ id: 'C', genres: ['Aksiyon', 'Komedi'] }); // İki türü de alıp melezlemiş!

      const sonuc = calculateDnaSynthesis(ebeveynA, ebeveynB, [aday], 0);
      const trait = sonuc[0].traits.find((t: any) => t.category === 'Çapraz Tür');
      
      expect(trait).toBeDefined();
      // 2 tür eşleştiği için 2 * 5 = 10 puan vermeli
      expect(trait?.addedPct).toBe(10);
      expect(trait?.sourceType).toBe('hybrid');
    });
  });

  // ==========================================
  // 4. TEMA VE ANAHTAR KELİMELER (KEYWORDS)
  // ==========================================
  describe('Tema Uyumları', () => {
    test('Ortak ve bireysel temalar toplanıp doğru oranlanmalı', () => {
      const ebeveynA = createMovie({ id: 'A', keywords: ['uzay', 'robot'] });
      const ebeveynB = createMovie({ id: 'B', keywords: ['uzay', 'zaman'] });
      const aday = createMovie({ id: 'C', keywords: ['uzay', 'robot'] }); 
      // 'uzay' ortak (+6), 'robot' sadece A ile (+4) = Toplam 10 puan

      const sonuc = calculateDnaSynthesis(ebeveynA, ebeveynB, [aday], 0);
      const trait = sonuc[0].traits.find((t: any) => t.category === 'Ortak Tema');
      
      expect(trait?.addedPct).toBe(10);
    });
  });

  // ==========================================
  // 5. KONU ÖZETİ (OVERVIEW NLP/STEMMING)
  // ==========================================
  describe('Konu Özeti Kök (Stem) Analizi', () => {
    test('Kelimelerin ilk 5 harfi (Kök) eşleşerek konu benzerliğini bulmalı', () => {
      const ebeveynA = createMovie({ id: 'A', overview: 'Uzaylılar dünyaya saldırıyor.' });
      const ebeveynB = createMovie({ id: 'B', overview: 'Normal bir hayat.' });
      const aday = createMovie({ id: 'C', overview: 'Uzayda büyük bir savaş var.' });
      // "Uzaylılar" ve "Uzayda" kelimelerinin ilk 5 harfi "uzayl" ve "uzayd". Eşleşmez.
      // Ama eğer 'saldırıyor' ve 'saldırı' olsa eşleşirdi.
      // Eşleşme olması için köklerin tam uyması lazım. Yeni bir aday yapalım:
      
      const ebeveynX = createMovie({ id: 'X', overview: 'Karanlık güçler savaşıyor' }); // kök: karan, güçle, savaş
      const adayY = createMovie({ id: 'Y', overview: 'Büyük bir savaş başlıyor' }); // kök: büyük, savaş, başlı
      
      const sonuc = calculateDnaSynthesis(ebeveynX, ebeveynB, [adayY], 0);
      const trait = sonuc[0].traits.find((t: any) => t.category === 'Konu Benzerliği');
      
      expect(trait).toBeDefined();
      expect(trait?.addedPct).toBe(3); // 1 kelime (savaş) eşleşti * 3 puan = 3
    });
  });

  // ==========================================
  // 6. DÖNEM (DECADE)
  // ==========================================
  describe('On Yıllık Dönem Uyumları', () => {
    test('Aynı 10 yıllık dönemde çıkan filmler +5 puan almalı', () => {
      const ebeveynA = createMovie({ id: 'A', year: '1984' }); // 1980'ler
      const ebeveynB = createMovie({ id: 'B', year: '1999' }); // 1990'lar
      const aday = createMovie({ id: 'C', year: '1988' });     // 1980'ler (A ile eşleşir)

      const sonuc = calculateDnaSynthesis(ebeveynA, ebeveynB, [aday], 0);
      const trait = sonuc[0].traits.find((t: any) => t.category === 'Aynı Dönem');
      
      expect(trait?.addedPct).toBe(5);
      expect(trait?.sourceType).toBe('A');
    });
  });

  // ==========================================
  // 7. SÜRE (TEMPO/RUNTIME) VE STÜDYO
  // ==========================================
  describe('Süre (Tempo) ve Stüdyo Uyumları', () => {
    test('Ebeveynlerin yaş (süre) ortalamasına ±15dk uyan filme +5 tempo puanı verilmeli', () => {
      const ebeveynA = createMovie({ id: 'A', runtime: 100 });
      const ebeveynB = createMovie({ id: 'B', runtime: 140 }); // Ortalama = 120
      const aday = createMovie({ id: 'C', runtime: 130 });     // 120 ± 15 dk içinde (130)

      const sonuc = calculateDnaSynthesis(ebeveynA, ebeveynB, [aday], 0);
      expect(sonuc[0].traits.find((t: any) => t.category === 'Süre Uyumu')?.addedPct).toBe(5);
    });

    test('Ortak stüdyo varsa +5 (tek) veya +8 (çoklu) puan verilmeli', () => {
      const ebeveynA = createMovie({ id: 'A', studios: ['Warner Bros'] });
      const ebeveynB = createMovie({ id: 'B', studios: [] });
      const aday = createMovie({ id: 'C', studios: ['Warner Bros'] }); 

      const sonuc = calculateDnaSynthesis(ebeveynA, ebeveynB, [aday], 0);
      expect(sonuc[0].traits.find((t: any) => t.category === 'Aynı Stüdyo')?.addedPct).toBe(5);
    });
  });

  // ==========================================
  // 8. KOLEKSİYON (SERİ)
  // ==========================================
  describe('Koleksiyon (Seri) Bağlantıları', () => {
    test('Aynı koleksiyonda olan filmlere +15 puan verilmeli', () => {
      const ebeveynA = createMovie({ id: 'A', collectionId: 'col_1' });
      const ebeveynB = createMovie({ id: 'B', collectionId: 'col_2' });
      const aday = createMovie({ id: 'C', collectionId: 'col_1' }); // A ile aynı seride

      const sonuc = calculateDnaSynthesis(ebeveynA, ebeveynB, [aday], 0);
      expect(sonuc[0].traits.find((t: any) => t.category === 'Koleksiyon Serisi')?.addedPct).toBe(15);
    });
  });

  // ==========================================
  // 9. MELEZ SİNERJİ & KAOS MODU
  // ==========================================
  describe('Sentezleme Stratejileri ve Melez Bonusları', () => {
    test('İki ebeveynden de en az %5 gen alan filme "Melez Sentez" bonusu (+5) eklenmeli', () => {
      // A'dan Dönem (+5), B'den Stüdyo (+5) alsın
      const ebeveynA = createMovie({ id: 'A', year: '1990', studios: ['X'] });
      const ebeveynB = createMovie({ id: 'B', year: '2020', studios: ['Y'] });
      const aday = createMovie({ id: 'C', year: '1995', studios: ['Y'] }); // A'dan 1990'lar, B'den 'Y' stüdyosu

      const sonuc = calculateDnaSynthesis(ebeveynA, ebeveynB, [aday], 0); // Mod 0 (Safkan)
      expect(sonuc[0].traits.find((t: any) => t.category === 'Melez Sentez')?.addedPct).toBe(5);
    });

    test('Kaos Modu (mutationRate = 2) seçildiğinde rastgele genetik sapma (+3 ile +10 arası) eklenmeli', () => {
      const ebeveynA = createMovie({ id: 'A', year: '1990' });
      const ebeveynB = createMovie({ id: 'B', year: '2020' });
      const aday = createMovie({ id: 'C', year: '1995' }); // Sadece A'dan uyum alıyor, normalde melez değil.
      
      const sonuc = calculateDnaSynthesis(ebeveynA, ebeveynB, [aday], 2); // Mod 2 (Kaos)
      const kaosTrait = sonuc[0].traits.find((t: any) => t.category === 'Kaos Mutasyonu');
      
      expect(kaosTrait).toBeDefined();
      expect(kaosTrait!.addedPct).toBeGreaterThanOrEqual(3);
      expect(kaosTrait!.addedPct).toBeLessThanOrEqual(10);
    });
  });

  // ==========================================
  // 10. ELEME SİSTEMİ (ELIMINATION)
  // ==========================================
  describe('Eleme Güvenliği', () => {
    test('Kendi ebeveynleri aday olarak gelse bile REDDEDİLMELİ', () => {
      const ebeveynA = createMovie({ id: 'A', directors: ['Nolan'] });
      const ebeveynB = createMovie({ id: 'B', directors: ['Nolan'] });
      
      const sonuc = calculateDnaSynthesis(ebeveynA, ebeveynB, [ebeveynA, ebeveynB], 0);
      expect(sonuc.length).toBe(0); // Hiçbiri listeye giremez
    });

    test('Hiçbir ortak özelliği olmayan (0 Puan) adaylar REDDEDİLMELİ', () => {
      const ebeveynA = createMovie({ id: 'A', year: '2020', genres: ['Korku'] });
      const ebeveynB = createMovie({ id: 'B', year: '2020', genres: ['Dram'] });
      // GİZLİ HATA BURADA ÇÖZÜLDÜ: Adaya süresi 120'den (ortalama) tamamen farklı olan 300 dakikayı veriyoruz
      const aday = createMovie({ id: 'C', year: '1980', genres: ['Aksiyon'], runtime: 300 }); 

      const sonuc = calculateDnaSynthesis(ebeveynA, ebeveynB, [aday], 0);
      expect(sonuc.length).toBe(0);
    });
  });

});