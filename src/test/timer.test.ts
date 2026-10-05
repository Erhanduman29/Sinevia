import { expect, test, describe } from 'vitest';
import { getMovieTimerInfo, computeEndTime } from '../context/AppContext';
import type { Movie } from '../types';

describe('⏱ CANLI SAYAÇ VE ZAMAN BÜKÜCÜ MOTORU KAPSAMLI TESTİ', () => {

  // ==========================================
  // 1. ZAMAN (SAAT) HESAPLAMALARI (computeEndTime)
  // ==========================================
  describe('Film Bitiş Saati (Haftalık Planlayıcı) Matematiği', () => {
    test('Standart bir başlangıç saati ve süreyi doğru toplamalı', () => {
      // 20:00'da başlayan 120 dakikalık film 22:00'da bitmeli
      expect(computeEndTime('20:00', 120)).toBe('22:00');
    });

    test('Gece yarısını (00:00) geçen filmlerin saatini başarıyla sarmalı', () => {
      // 23:30'da başlayan 90 dakikalık film gece 01:00'da bitmeli
      expect(computeEndTime('23:30', 90)).toBe('01:00');
    });

    test('Süresi bilinmeyen (undefined) filmler için varsayılan 115 dakika kullanmalı', () => {
      // 20:00 + 115 dakika (1 saat 55 dk) = 21:55
      expect(computeEndTime('20:00', undefined)).toBe('21:55');
    });

    test('0 (Sıfır) dakika olarak girilen hatalı süreyi de varsayılan (115dk) yapmalı', () => {
      // 18:00 + 115 dakika = 19:55
      expect(computeEndTime('18:00', 0)).toBe('19:55');
    });
  });

  // ==========================================
  // 2. TEMEL SAYAÇ (TIMER) OKUMALARI
  // ==========================================
  describe('Temel Sayaç Durumları', () => {
    test('Henüz başlatılmamış bir filmde sayaç kapalı (isActive: false) olmalı', () => {
      const movie = { id: 'm1', runtime: 120, startedAt: null } as Movie;
      const info = getMovieTimerInfo(movie);

      expect(info.isActive).toBe(false);
      expect(info.isPaused).toBe(false);
      expect(info.elapsedSec).toBe(0);
      expect(info.remainingSec).toBe(120 * 60); // Tamamı duruyor
    });

    test('Sayaç çalışıyorsa geçen ve kalan süreyi NowMs değerine göre doğru hesaplamalı', () => {
      const now = Date.now();
      // Filmi tam 10 dakika (600.000 ms) önce başlattığımızı varsayalım
      const movie = { id: 'm2', runtime: 120, startedAt: new Date(now - 10 * 60000).toISOString() } as Movie;
      
      const info = getMovieTimerInfo(movie, now);
      expect(info.isActive).toBe(true);
      expect(info.elapsedMins).toBe(10); // 10 dakika geçti
      expect(info.remainingSec).toBe((120 - 10) * 60); // 110 dakika kaldı
    });
  });

  // ==========================================
  // 3. DURAKLATMA (PAUSED) MANTIĞI
  // ==========================================
  describe('Duraklatma (Pause) ve Devam Etme Mantığı', () => {
    test('startedAt stringi "PAUSED:" ile başlıyorsa sistemi duraklatılmış moda almalı', () => {
      // 1800 saniye (30 dakika) izlenip durdurulmuş
      const movie = { id: 'm3', runtime: 120, startedAt: 'PAUSED:1800' } as Movie;
      
      const info = getMovieTimerInfo(movie);
      expect(info.isActive).toBe(true);
      expect(info.isPaused).toBe(true); // Mod değişti!
      expect(info.elapsedSec).toBe(1800);
      expect(info.elapsedMins).toBe(30);
    });

    test('Duraklatılan süre, filmin toplam süresini asla aşmamalı (Hata Kontrolü)', () => {
      // Film 100 dakika (6000 saniye), ama veritabanında hatalı olarak 8000 saniyede durdurulmuş gibi görünüyor
      const movie = { id: 'm4', runtime: 100, startedAt: 'PAUSED:8000' } as Movie;
      
      const info = getMovieTimerInfo(movie);
      expect(info.elapsedSec).toBe(6000); // 100 dakikada (6000s) sınırlanmalı
      expect(info.remainingSec).toBe(0); // Kalan süre eksiye düşmemeli
    });
  });

  // ==========================================
  // 4. HİLE KORUMASI VE PUANLAMA KİLİDİ
  // ==========================================
  describe('Hile Koruması ve Puanlama Kilidi (15% Kuralı)', () => {
    test('100 dakikalık filmde %15 kuralı (15 dk) çalışmalı - Süre DOLMADAN puan verilememeli', () => {
      const now = Date.now();
      const movie = { id: 'm5', runtime: 100, startedAt: new Date(now - 14 * 60000).toISOString() } as Movie; // 14 dk geçmiş
      
      const info = getMovieTimerInfo(movie, now);
      expect(info.minRequiredMins).toBe(15);
      expect(info.canRateWithTimer).toBe(false); // 1 dk daha lazım, kilitli!
    });

    test('100 dakikalık filmde %15 kuralı (15 dk) çalışmalı - Süre DOLDUĞUNDA kilit açılmalı', () => {
      const now = Date.now();
      const movie = { id: 'm6', runtime: 100, startedAt: new Date(now - 16 * 60000).toISOString() } as Movie; // 16 dk geçmiş
      
      const info = getMovieTimerInfo(movie, now);
      expect(info.canRateWithTimer).toBe(true); // Kilit Açıldı!
    });

    test('Kısa filmlerde (Örn: 20dk), %15 (3dk) olsa bile GÜVENLİK için en az 5 dakika şartı aranmalı', () => {
      const now = Date.now();
      const movie = { id: 'm7', runtime: 20, startedAt: new Date(now - 4 * 60000).toISOString() } as Movie; // 4 dk geçmiş
      
      const info = getMovieTimerInfo(movie, now);
      expect(info.minRequiredMins).toBe(5); // Math.max(5, %15) kuralı çalıştı!
      expect(info.canRateWithTimer).toBe(false); // Henüz 4 dk geçtiği için kilitli
    });
  });

  // ==========================================
  // 5. METİN/SAAT FORMATLAMALARI
  // ==========================================
  describe('Sayaç Metin Formatlaması', () => {
    test('1 saati (3600 sn) geçen süreler HH:MM:SS formatında dönmeli', () => {
      const now = Date.now();
      // Film 120 dk, hiç geçmedi, kalan: 7200 saniye
      const movie = { id: 'm8', runtime: 120, startedAt: new Date(now).toISOString() } as Movie;
      
      const info = getMovieTimerInfo(movie, now);
      expect(info.formattedRemaining).toBe('02:00:00'); // Saat hanesi var
    });

    test('1 saatin altına (3600 sn) düşen süreler MM:SS formatında dönmeli', () => {
      const now = Date.now();
      // Film 120 dk. 70 dakikası (4200 sn) geçmiş. Kalan: 50 dakika (3000 sn)
      const movie = { id: 'm9', runtime: 120, startedAt: new Date(now - 70 * 60000).toISOString() } as Movie;
      
      const info = getMovieTimerInfo(movie, now);
      expect(info.formattedRemaining).toBe('50:00'); // Saat hanesi yok
    });

    test('Süre tamamen bittiğinde 00:00 olarak kalmalı (Eksiye düşmemeli)', () => {
      const now = Date.now();
      // Film 100 dk. 150 dakika (9000 sn) geçmiş. (Açık unutulmuş)
      const movie = { id: 'm10', runtime: 100, startedAt: new Date(now - 150 * 60000).toISOString() } as Movie;
      
      const info = getMovieTimerInfo(movie, now);
      expect(info.remainingSec).toBe(0); // Kalan saniye sıfırlanmış
      expect(info.formattedRemaining).toBe('00:00'); 
    });
  });

});