import { describe, test, expect } from 'vitest';
import { formatDateTime, formatDateShort, todayStr, daysBetween, ratingBorderClass, ratingBgClass, normalize, uid } from '../lib/utils';

// ============================================================================
// UTILS — Tarih/saat formatlama ve ek yardımcı davranışlar
// (utils.test.ts dosyasındaki temel testleri TAMAMLAYICI kenar durumları)
// ============================================================================

describe('UTILS — TARİH & SAAT FORMATLAMA', () => {
  test('formatDateTime: uzun tarih + HH:MM saat formatı dönmeli', () => {
    const result = formatDateTime('2026-10-05T14:30:00');

    expect(result).toContain('2026');
    expect(result).toContain('14:30'); // saat korunmalı
    expect(result).toContain('05'); // gün
  });

  test('formatDateTime ile formatDateShort FARKLI uzunlukta metin üretmeli (ay uzun adı vs kısa)', () => {
    const iso = '2026-10-05T14:30:00';
    expect(formatDateTime(iso).length).toBeGreaterThan(formatDateShort(iso).length);
  });

  test('todayStr: bugünü YYYY-AA-GG (ISO) biçiminde dönmeli', () => {
    const today = todayStr();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(today).toBe(new Date().toISOString().slice(0, 10));
  });

  test('daysBetween: negatif fark (ters yönde) ve aynı ay günleri', () => {
    expect(daysBetween('2026-10-05', '2026-10-04')).toBe(-1); // ters yön
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1); // ay geçişi
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365); // tam yıl
  });
});

describe('UTILS — PUAN & METİN KENAR DURUMLARI', () => {
  test('ratingBorderClass / ratingBgClass sınır değerlerinde doğru sınıfa düşmeli', () => {
    expect(ratingBorderClass(10)).toBe('border-blue-500');
    expect(ratingBorderClass(9.9)).toBe('border-green-500');
    expect(ratingBorderClass(8)).toBe('border-green-500');
    expect(ratingBorderClass(7.9)).toBe('border-yellow-400');
    expect(ratingBorderClass(5.5)).toBe('border-yellow-400');
    expect(ratingBorderClass(3.4)).toBe('border-red-500');
    expect(ratingBorderClass(0.9)).toBe('border-ink-600');

    expect(ratingBgClass(3.4)).toContain('red');
    expect(ratingBgClass(0.9)).toContain('ink');
  });

  test('normalize: İ/ı dönüşümleri ve çoklu boşluklar tek boşluğa inmeli', () => {
    expect(normalize('İSTANBUL')).toBe('istanbul');
    expect(normalize('Isparta  ilıca')).toBe('isparta ilica');
    expect(normalize('   çok    boşluklu   metin  ')).toBe('cok bosluklu metin');
  });

  test('uid: 1000 üretimde bile benzersiz olmalı', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uid()));
    expect(ids.size).toBe(1000);
  });
});
