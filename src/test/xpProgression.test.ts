import { describe, test, expect } from 'vitest';
import { levelFromXp } from '../lib/xp';

// ============================================================================
// XP / SEVİYE ARİTMETİĞİ — Sıfır noktasından sınır değerlere kadar
// ============================================================================

// Dokümante edilmiş kural: Seviye 2 = 250 XP, sonraki her seviye +30 XP
function specGap(level: number): number {
  if (level <= 1) return 0;
  return 250 + (level - 2) * 30;
}

function specLevel(totalXp: number): { level: number; currentLevelXp: number; nextLevelXp: number } {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= specGap(level + 1)) {
    remaining -= specGap(level + 1);
    level++;
  }
  return { level, currentLevelXp: remaining, nextLevelXp: specGap(level + 1) };
}

describe('XP İLERLEME (LEVELING) SINIR DEĞER TESTLERİ', () => {
  test('0 XP → Seviye 1, ilk eşik tam 250 XP olmalı', () => {
    const zero = levelFromXp(0);
    expect(zero.level).toBe(1);
    expect(zero.currentLevelXp).toBe(0);
    expect(zero.nextLevelXp).toBe(250);
    expect(zero.progress).toBe(0);

    // 249 XP hala seviye 1'de kalmalı (250'den 1 XP önce)
    const justBefore = levelFromXp(249);
    expect(justBefore.level).toBe(1);
    expect(justBefore.currentLevelXp).toBe(249);
    expect(justBefore.progress).toBeCloseTo((249 / 250) * 100, 5);

    // Tam 250 XP → anında seviye 2 ve bar sıfırlanır
    const atThreshold = levelFromXp(250);
    expect(atThreshold.level).toBe(2);
    expect(atThreshold.currentLevelXp).toBe(0);
    expect(atThreshold.nextLevelXp).toBe(280); // 2. seviye sonrası ilk boşluk 280
    expect(atThreshold.progress).toBe(0);
  });

  test('İkinci eşik: 250 + 280 = 530 XP tam seviye 3 olmalı', () => {
    expect(levelFromXp(529).level).toBe(2);
    expect(levelFromXp(529).currentLevelXp).toBe(279);

    const lvl3 = levelFromXp(530);
    expect(lvl3.level).toBe(3);
    expect(lvl3.currentLevelXp).toBe(0);
    expect(lvl3.nextLevelXp).toBe(310);
  });

  test('seviye boşlukları her adımda tam +30 XP artmalı', () => {
    // 1 → 2: 250, 2 → 3: 280, 3 → 4: 310 ... 10 → 11: 520
    for (let level = 1; level <= 20; level++) {
      const { nextLevelXp } = levelFromXp(
        Array.from({ length: level - 1 }, (_, i) => specGap(i + 2)).reduce((a, b) => a + b, 0)
      );
      expect(nextLevelXp).toBe(250 + (level - 1) * 30);
    }
  });

  test('XP arttıkça seviye asla düşmemeli (monoton artan)', () => {
    let prevLevel = 0;
    for (let xp = 0; xp <= 20000; xp += 100) {
      const { level } = levelFromXp(xp);
      expect(level).toBeGreaterThanOrEqual(prevLevel);
      prevLevel = level;
    }
    expect(prevLevel).toBeGreaterThanOrEqual(30); // 20.000 XP (+30 adım) ile ≈ seviye 30
  });

  test('ilerleme yüzdesi hiçbir koşulda 0-100 aralığını (dahil) aşmamalı', () => {
    for (let xp = 0; xp <= 25000; xp += 137) {
      const { progress, currentLevelXp, nextLevelXp } = levelFromXp(xp);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);
      expect(currentLevelXp).toBeLessThan(nextLevelXp);
    }
  });

  test('büyük XP değerleri spesifikasyonla (spec) birebir aynı seviyeyi üretmeli', () => {
    [0, 1, 249, 250, 524, 525, 999, 5000, 12345, 100000].forEach((xp) => {
      const expected = specLevel(xp);
      const actual = levelFromXp(xp);
      expect(actual.level, `xp=${xp}`).toBe(expected.level);
      expect(actual.currentLevelXp, `xp=${xp} (içinde kalınan xp)`).toBe(expected.currentLevelXp);
      expect(actual.nextLevelXp, `xp=${xp} (sonraki eşik)`).toBe(expected.nextLevelXp);
    });
  });

  test('negatif bozuk veri bile seviye 1’in altına düşürmemeli', () => {
    const result = levelFromXp(-500);
    expect(result.level).toBe(1);
    expect(result.nextLevelXp).toBe(250);
  });
});
