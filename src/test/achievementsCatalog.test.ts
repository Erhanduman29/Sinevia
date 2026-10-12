import { describe, test, expect } from 'vitest';
import { ACHIEVEMENT_DEFS, TIER_ORDER, TIER_COLORS, TUTORIAL_TOTAL_UNITS } from '../lib/achievements';
import { ALL_TUTORIALS, ACADEMY_QUESTS } from '../tutorial/texts';

// ============================================================================
// BAŞARIM KATALOGU (ACHIEVEMENT DEFS) — Tanım dosyası bütünlük testleri
// ============================================================================

describe('BAŞARIM KATALOGU (ACHIEVEMENT_DEFS) BÜTÜNLÜK TESTLERİ', () => {
  test('başarım kimlikleri benzersiz ve dolu olmalı', () => {
    expect(ACHIEVEMENT_DEFS.length).toBeGreaterThan(30);

    const ids = ACHIEVEMENT_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id.trim().length).toBeGreaterThan(2));
  });

  test('her başarımın adı, açıklaması ve ikonu dolu olmalı', () => {
    ACHIEVEMENT_DEFS.forEach((d) => {
      expect(d.name.trim().length).toBeGreaterThan(2);
      expect(d.description.trim().length).toBeGreaterThan(5);
      expect(d.icon.trim().length).toBeGreaterThan(0);
      expect(d.tiers.length).toBeGreaterThan(0);
    });
  });

  test('kademe eşikleri (threshold) içinde artan sırada olmalı (ilk kademe en küçük eşik)', () => {
    ACHIEVEMENT_DEFS.forEach((d) => {
      for (let i = 1; i < d.tiers.length; i++) {
        expect(
          d.tiers[i].threshold,
          `${d.id} → ${d.tiers[i].tier} eşiği öncekinden büyük olmalı`
        ).toBeGreaterThan(d.tiers[i - 1].threshold);
      }
    });
  });

  test('kullanılan tüm kademe isimleri TIER_ORDER içinde olmalı ve pozitif XP vermeli', () => {
    ACHIEVEMENT_DEFS.forEach((d) => {
      d.tiers.forEach((t) => {
        expect(TIER_ORDER, `${d.id} → ${t.tier}`).toContain(t.tier);
        expect(t.xp).toBeGreaterThan(0);
        expect(t.threshold).toBeGreaterThan(0);
      });
    });
  });

  test('TIER_ORDER ve TIER_COLORS aynı 6 kademeyi kapsamalı, renkler dolu olmalı', () => {
    expect(TIER_ORDER).toEqual(['bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond']);
    expect(Object.keys(TIER_COLORS).sort()).toEqual([...TIER_ORDER].sort());

    TIER_ORDER.forEach((tier) => {
      const c = TIER_COLORS[tier];
      expect(c.bg).toMatch(/^bg-/);
      expect(c.text).toMatch(/^text-/);
      expect(c.border).toMatch(/^border-/);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.icon.length).toBeGreaterThan(0);
    });
  });

  test('her kademe adı benzersiz olmalı (toast’ta karışmasın)', () => {
    ACHIEVEMENT_DEFS.forEach((d) => {
      const names = d.tiers.map((t) => t.name).filter(Boolean) as string[];
      expect(new Set(names).size, `${d.id} kademe adları çakışıyor`).toBe(names.length);
    });
  });

  test('gizli başarım eşiği, tutorial + akademi dersi toplamına eşit olmalı', () => {
    expect(TUTORIAL_TOTAL_UNITS).toBe(ALL_TUTORIALS.length + ACADEMY_QUESTS.length);
    expect(TUTORIAL_TOTAL_UNITS).toBeGreaterThanOrEqual(10);

    const explorer = ACHIEVEMENT_DEFS.find((d) => d.id === 'tutorial_explorer');
    expect(explorer).toBeDefined();
    expect(explorer!.secret).toBe(true);
    expect(explorer!.tiers[0].threshold).toBe(TUTORIAL_TOTAL_UNITS);
  });

  test('gizli (secret) başarım kategorisi "Gizli" olmalı ve en az birkaç tanesi bulunmalı', () => {
    const secrets = ACHIEVEMENT_DEFS.filter((d) => d.secret);
    expect(secrets.length).toBeGreaterThanOrEqual(5);
    secrets.forEach((d) => {
      expect(d.hidden).toBe(true);
      expect(d.category).toBeTruthy();
    });
  });
});
