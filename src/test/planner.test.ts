import { expect, test, describe } from 'vitest';
import { checkOverlap, formatDuration, computeEndTime } from '../lib/plannerLogic';

describe('🗓️ HAFTALIK PLANLAYICI & ÇAKIŞMA (OVERLAP) MOTORU TESTLERİ', () => {

  // ==========================================
  // 1. ZAMAN (OVERLAP) ÇAKIŞMA KONTROLLERİ
  // ==========================================
  describe('Zaman Çakışması (Overlap) Güvenlik Filtresi', () => {

    test('Birbiriyle çakışmayan iki film (Biri bitince diğeri başlıyor) TEMİZ sayılmalı', () => {
      // Film 1: 14:00'da başlıyor, 120 dk sürüyor (16:00'da biter)
      // Film 2: 16:30'da başlıyor, 90 dk sürüyor
      const isOverlap = checkOverlap('14:00', 120, '16:30', 90);
      expect(isOverlap).toBe(false); // Çakışma YOK!
    });

    test('Ucu ucuna eklenen filmler (Biri 16:00 biter, diğeri 16:00 başlar) TEMİZ sayılmalı', () => {
      const isOverlap = checkOverlap('14:00', 120, '16:00', 90);
      expect(isOverlap).toBe(false); // Tam sınırda, çakışma yok.
    });

    test('Süreleri birbiri içine giren (Örn: 15:00 ve 15:30) filmler ÇAKIŞIYOR olarak işaretlenmeli', () => {
      // Film 1: 15:00 - 17:00 (120dk)
      // Film 2: 15:30 - 17:30 (120dk) -> Yarım saati çakışıyor!
      const isOverlap = checkOverlap('15:00', 120, '15:30', 120);
      expect(isOverlap).toBe(true); // ÇAKIŞMA VAR! (Uyarı fırlatacak)
    });

    test('Bir filmin tamamen diğerinin içine girdiği durumlarda (Kapsama) ÇAKIŞIYOR sayılmalı', () => {
      // Film 1: 14:00 - 18:00 (240dk) Epic film
      // Film 2: 15:00 - 16:00 (60dk) Kısa film -> Tamamen 1. filmin içinde
      const isOverlap = checkOverlap('14:00', 240, '15:00', 60);
      expect(isOverlap).toBe(true); // ÇAKIŞMA VAR!
    });
  });

  // ==========================================
  // 2. BİTİŞ SAATİ VE GECE YARISI (MIDNIGHT) HESAPLARI
  // ==========================================
  describe('Bitiş Saati (End Time) Hesaplamaları', () => {

    test('Gün içi standart bir filmin bitiş saati doğru bulunmalı', () => {
      // 20:00 + 135 dk (2 saat 15 dk) = 22:15
      const end = computeEndTime('20:00', 135);
      expect(end).toBe('22:15');
    });

    test('Gece yarısını (00:00) geçen filmlerin saati başarıyla SARILMALI', () => {
      // 23:30 + 120 dk (2 saat) = 01:30
      const end = computeEndTime('23:30', 120);
      expect(end).toBe('01:30');
    });

    test('Süresi tanımlı olmayan filmler varsayılan olarak (115dk) üzerinden hesaplanmalı', () => {
      // 10:00 + 115 dk = 11:55
      const end = computeEndTime('10:00', 0 as any); // Süre yok veya 0
      expect(end).toBe('11:55');
    });
  });

  // ==========================================
  // 3. SÜRE METİN FORMATLAMALARI
  // ==========================================
  describe('Kullanıcı Arayüzü (UI) Süre Çevirileri', () => {

    test('1 saatin altındaki süreler sadece "dk" olarak dönmeli', () => {
      expect(formatDuration(45)).toBe('45 dk');
      expect(formatDuration(59)).toBe('59 dk');
    });

    test('Tam saat olan süreler (60, 120) sadece "sa" olarak dönmeli', () => {
      expect(formatDuration(60)).toBe('1 sa');
      expect(formatDuration(180)).toBe('3 sa');
    });

    test('Saat ve dakika içeren süreler birleştirilerek dönmeli', () => {
      expect(formatDuration(135)).toBe('2 sa 15 dk');
      expect(formatDuration(200)).toBe('3 sa 20 dk');
    });

    test('Sıfır veya eksi süreler "0 dk" olarak güvenlik altına alınmalı', () => {
      expect(formatDuration(0)).toBe('0 dk');
      expect(formatDuration(-50)).toBe('0 dk');
    });
  });

});