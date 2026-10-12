import { describe, test, expect } from 'vitest';
import { QUEST_DEFS, RARITY_STYLES } from '../lib/quests';
import type { QuestDef } from '../lib/quests';

// ============================================================================
// GÖREV KATALOGU (QUEST DEFS) — Tanım dosyası bütünlük testleri
// ============================================================================
const RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'] as const;

describe('GÖREV KATALOGU (QUEST_DEFS) BÜTÜNLÜK TESTLERİ', () => {
  test('Toplam 50 görev tanımlı olmalı ve nadirlik dağılımı dokümante edilmiş gibi olmalı', () => {
    expect(QUEST_DEFS).toHaveLength(50);

    const counts = RARITIES.reduce((acc, r) => {
      acc[r] = QUEST_DEFS.filter((q) => q.rarity === r).length;
      return acc;
    }, {} as Record<string, number>);

    expect(counts).toEqual({ common: 20, rare: 15, epic: 8, legendary: 5, mythic: 2 });
  });

  test('görev kimlikleri (id) benzersiz olmalı', () => {
    const ids = QUEST_DEFS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id.length).toBeGreaterThan(3));
  });

  test('görev id ön eki nadirliği ile birebir eşleşmeli (c_/r_/e_/l_/m_)', () => {
    const prefixByRarity: Record<string, string> = {
      common: 'c_',
      rare: 'r_',
      epic: 'e_',
      legendary: 'l_',
      mythic: 'm_',
    };

    QUEST_DEFS.forEach((q) => {
      expect(q.id.startsWith(prefixByRarity[q.rarity]), `${q.id} ön eki hatalı`).toBe(true);
    });
  });

  test('her görevin başlığı, açıklaması ve ikonu dolu olmalı', () => {
    QUEST_DEFS.forEach((q: QuestDef) => {
      expect(q.title.trim().length).toBeGreaterThan(2);
      expect(q.description.trim().length).toBeGreaterThan(10);
      expect(q.icon.trim().length).toBeGreaterThan(0);
      expect(q.xpReward).toBeGreaterThan(0);
    });
  });

  test('XP ödülleri nadirlik arttıkça yükselmeli (common ≤ rare ≤ epic ≤ legendary)', () => {
    const maxOf = (r: string) => Math.max(...QUEST_DEFS.filter((q) => q.rarity === r).map((q) => q.xpReward));
    const minOf = (r: string) => Math.min(...QUEST_DEFS.filter((q) => q.rarity === r).map((q) => q.xpReward));

    expect(maxOf('common')).toBeLessThanOrEqual(minOf('rare'));
    expect(maxOf('rare')).toBeLessThanOrEqual(minOf('epic'));
    expect(maxOf('epic')).toBeLessThanOrEqual(minOf('legendary'));
  });

  test('RARITY_STYLES tam olarak 5 nadirliğin stilini tanımlamalı (QuestBoard bu stillere bağımlı)', () => {
    expect(Object.keys(RARITY_STYLES).sort()).toEqual([...RARITIES].sort());

    RARITIES.forEach((r) => {
      const style = RARITY_STYLES[r];
      expect(style.color).toMatch(/^text-/);
      expect(style.border).toMatch(/^border-/);
      expect(style.bg).toMatch(/^bg-/);
      expect(style.shadow).toMatch(/^shadow/);
    });
  });

  test('her nadirlikte EN AZ bir görev olmalı (boş havuz QuestBoard’da ağırlık hatası verir)', () => {
    RARITIES.forEach((r) => {
      expect(QUEST_DEFS.filter((q) => q.rarity === r).length).toBeGreaterThan(0);
    });
  });
});
