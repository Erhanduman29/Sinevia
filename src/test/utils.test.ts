import { expect, test, describe } from 'vitest';
import { 
  normalize, uid, ratingBgClass, ratingBorderClass, 
  daysBetween, getNextUnwatchedEpisode, formatDateShort 
} from '../lib/utils';

describe('🛠️ YARDIMCI ARAÇLAR (UTILS) TESTLERİ', () => {

  // ==========================================
  // 1. METİN VE ARAMA (NORMALIZE) FONKSİYONLARI
  // ==========================================
  describe('Metin Normalizasyonu (Arama Motoru İçin)', () => {
    test('Büyük/Küçük harf duyarlılığını kaldırmalı', () => {
      expect(normalize('DUNE')).toBe('dune');
      expect(normalize('Avatar')).toBe('avatar');
    });

    test('Türkçe karakterleri (ı, İ, ş, ğ, ü, ö, ç) İngilizce eşdeğerlerine çevirmeli', () => {
      // Çok tehlikeli bir arama cümlesi
      expect(normalize('Şaşı Beşö Ğü Çı')).toBe('sasi beso gu ci');
      // I ve i harfleri
      expect(normalize('İSTANBUL ırak')).toBe('istanbul irak');
    });

    test('Fazladan boşlukları (space) temizleyip tek boşluğa indirmeli', () => {
      expect(normalize('Yüzüklerin     Efendisi')).toBe('yuzuklerin efendisi');
      expect(normalize('   Başında ve sonunda    ')).toBe('basinda ve sonunda');
    });
  });

  // ==========================================
  // 2. RENK VE PUANLAMA (STİL) FONKSİYONLARI
  // ==========================================
  describe('Puanlama Renk Sınıfları (UI Stil Motoru)', () => {
    test('10 Tam Puan: Mavi tonlarında (Masterpiece) dönmeli', () => {
      expect(ratingBgClass(10)).toContain('blue');
      expect(ratingBorderClass(10)).toContain('blue');
    });

    test('8 ile 9.9 arası: Yeşil tonlarında (Harika) dönmeli', () => {
      expect(ratingBgClass(9)).toContain('green');
      expect(ratingBgClass(8)).toContain('green');
    });

    test('5.5 ile 7.9 arası: Sarı tonlarında (Ortalama/İyi) dönmeli', () => {
      expect(ratingBgClass(7.5)).toContain('yellow');
      expect(ratingBgClass(5.5)).toContain('yellow');
    });

    test('3.5 ile 5.4 arası: Turuncu tonlarında (Kötü) dönmeli', () => {
      expect(ratingBgClass(4)).toContain('orange');
      expect(ratingBgClass(3.5)).toContain('orange');
    });

    test('1 ile 3.4 arası: Kırmızı tonlarında (Çöp) dönmeli', () => {
      expect(ratingBgClass(2)).toContain('red');
      expect(ratingBgClass(1)).toContain('red');
    });

    test('1 in altı veya tanımsız: Varsayılan (Ink) dönmeli', () => {
      expect(ratingBgClass(0)).toContain('ink');
    });
  });

  // ==========================================
  // 3. TARİH VE ZAMAN FONKSİYONLARI
  // ==========================================
  describe('Zaman ve Tarih Hesaplamaları', () => {
    test('daysBetween: İki tarih arasındaki GÜN FARKINI doğru hesaplamalı (Streak için kritik!)', () => {
      const bugun = '2026-10-05';
      const dun = '2026-10-04';
      const ikiGunOnce = '2026-10-03';

      expect(daysBetween(dun, bugun)).toBe(1); // Peş peşe (Streak artar)
      expect(daysBetween(ikiGunOnce, bugun)).toBe(2); // 2 gün geçmiş (Streak bozulur)
      expect(daysBetween(bugun, bugun)).toBe(0); // Aynı gün
    });

    test('formatDateShort: Tarihi kısa, okunabilir formata (örn: "05 Eki 2026") çevirmeli', () => {
      const kisaTarih = formatDateShort('2026-10-05T12:00:00Z');
      expect(kisaTarih).toContain('05');
      // Aydan aya dil çevirisi fark edebilir, o yüzden yılın ve günün doğru yerde olduğunu teyit ediyoruz
      expect(kisaTarih).toContain('2026');
    });
  });

  // ==========================================
  // 4. MANTIK VE VERİ (LOGIC) FONKSİYONLARI
  // ==========================================
  describe('Veri Mantığı Araçları', () => {
    test('uid: Rastgele, eşsiz ve boş olmayan bir ID üretmeli', () => {
      const id1 = uid();
      const id2 = uid();
      expect(id1.length).toBeGreaterThan(5);
      expect(id1).not.toBe(id2); // İkisi birbirinden farklı olmalı
    });

    test('getNextUnwatchedEpisode: Dizi bölümlerini sıralayıp sıradaki İZLENMEMİŞ bölümü bulmalı', () => {
      const eps = [
        { id: '1', season: 1, episode: 1, watched: true },
        { id: '3', season: 1, episode: 3, watched: false }, // 2. den sonra izlenmeli
        { id: '2', season: 1, episode: 2, watched: false }, // SIRADAKİ BÖLÜM BU!
        { id: '4', season: 2, episode: 1, watched: false }
      ];

      const nextEp = getNextUnwatchedEpisode(eps);
      expect(nextEp?.episode).toBe(2);
      expect(nextEp?.season).toBe(1);
    });

    test('getNextUnwatchedEpisode: Tüm bölümler izlenmişse NULL dönmeli', () => {
      const eps = [
        { season: 1, episode: 1, watched: true },
        { season: 1, episode: 2, watched: true }
      ];
      expect(getNextUnwatchedEpisode(eps)).toBeNull();
    });
  });

});