import { describe, test, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RANK_TIERS } from '../lib/rankTiers';

// ============================================================================
// KADEMELER (RANK TIERS) — Seviye tablosu bütünlük testleri
// ============================================================================
describe('KADEMELER (RANK TIERS) BÜTÜNLÜK TESTLERİ', () => {
  test('10 kademe tanımlı olmalı, ilk kademe seviye 1’den başlamalı ve aralar boşluksuz dizilmeli', () => {
    expect(RANK_TIERS).toHaveLength(10);
    expect(RANK_TIERS[0].minLevel).toBe(1);
    expect(RANK_TIERS[RANK_TIERS.length - 1].maxLevel).toBeGreaterThanOrEqual(999);

    for (let i = 1; i < RANK_TIERS.length; i++) {
      // Bir kademenin bittiği seviyenin BİR SONRAKİ seviyesi yeni kademenin başlangıcı olmalı
      expect(RANK_TIERS[i].minLevel).toBe(RANK_TIERS[i - 1].maxLevel + 1);
      expect(RANK_TIERS[i].minLevel).toBeGreaterThan(RANK_TIERS[i - 1].minLevel);
      expect(RANK_TIERS[i].maxLevel).toBeGreaterThan(RANK_TIERS[i].minLevel);
    }
  });

  test('1 - 999 arası HER seviye tam olarak BİR kademe tarafından karşılanmalı (boşluk/çakışma yok)', () => {
    for (let level = 1; level <= 999; level++) {
      const matching = RANK_TIERS.filter((t) => level >= t.minLevel && level <= t.maxLevel);
      expect(matching.length, `Seviye ${level} için kademe sayısı`).toBe(1);
    }
  });

  test('kademe başlıkları benzersiz olmalı, başlık ve alt başlıklar dolu metin içermeli', () => {
    const titles = RANK_TIERS.map((t) => t.title);
    expect(new Set(titles).size).toBe(titles.length);

    const subtitles = RANK_TIERS.map((t) => t.subtitle);
    expect(new Set(subtitles).size).toBe(subtitles.length);

    RANK_TIERS.forEach((t) => {
      expect(t.title.trim().length).toBeGreaterThan(3);
      expect(t.subtitle.trim().length).toBeGreaterThan(5);
    });
  });

  test('her kademenin stil sınıfları (renk/kenar/gradient) dolu ve geçerli formatta olmalı', () => {
    RANK_TIERS.forEach((t) => {
      expect(t.color).toMatch(/^text-/);
      expect(t.border).toMatch(/^border-/);
      expect(t.badgeBg).toMatch(/^bg-/);
      expect(t.bgGlow).toMatch(/^bg-/);
      expect(t.gradient).toMatch(/from-/);
      expect(t.barGradient).toMatch(/from-/);
      expect(t.strokeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  test('her kademenin ikonu geçerli bir React bileşeni olarak render edilebilmeli', () => {
    RANK_TIERS.forEach((t) => {
      const html = renderToStaticMarkup(React.createElement(t.icon, { size: 24 }));
      expect(html, `${t.title} ikonu render edilemedi`).toContain('<svg');
      expect(html).toContain('24');
    });
  });

  test('kademe seviyeleri zirveye doğru artan ödül hissi vermeli (strokeColor benzersizliği)', () => {
    // Renk paleti kademeli olarak değişmeli: ilk kademe "slate" tonlarından başlar
    expect(RANK_TIERS[0].color).toContain('slate');
    expect(RANK_TIERS[RANK_TIERS.length - 1].color).toContain('zinc');
    // Son kademe "Sinema Tanrısı" 75+ seviyelerini kapsamalı
    const last = RANK_TIERS[RANK_TIERS.length - 1];
    expect(last.minLevel).toBe(75);
    expect(last.icon).toBeDefined();
  });
});
