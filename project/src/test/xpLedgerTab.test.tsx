import { describe, test, expect } from 'vitest';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import XpLedgerTab, {
  XP_SOURCE_GROUPS,
  buildXpLedgerRows,
  filterXpEvents,
  formatXpAmount,
  formatXpFormula,
  formatXpNumber,
  groupXpLedgerRows,
  limitGroupedXpRows,
  reconcileXpLedger,
  resolveXpSourceGroup,
  sumEventAmounts,
  sumXpInLastDays,
} from '../components/XpLedgerTab';
import type { XpEvent } from '../types/appState';
import { createEmptyAppStateV3, toLegacyCoreView } from '../lib/localStateV3';

// ============================================================================
// XP DEFTERİ SEKMESİ — saf yardımcılar + SSR smoke (React Testing Library yok)
// ============================================================================

const NOW = Date.now(); // testler aralık sınırlarını sabit "now" ile doğrular
const dayAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

function event(partial: Partial<XpEvent> & Pick<XpEvent, 'id' | 'source' | 'amount'>): XpEvent {
  return {
    sourceId: `${partial.source}-ref`,
    label: 'Kayıt',
    base: partial.amount,
    multiplier: 1,
    createdAt: dayAgo(1),
    ...partial,
  };
}

const SAMPLE: XpEvent[] = [
  event({ id: 'e1', source: 'achievement', sourceId: 'first_watch:gold', label: 'İlk Film — Altın', base: 100, multiplier: 1.5, amount: 150, createdAt: dayAgo(2) }),
  event({ id: 'e2', source: 'quest', sourceId: 'daily_watch_3', label: 'Günün Görevi', base: 40, multiplier: 1, amount: 40, createdAt: dayAgo(10) }),
  event({ id: 'e3', source: 'contract', sourceId: 'c_001', label: 'Kontrat Ödülü', base: 60, multiplier: 1, amount: 60, createdAt: dayAgo(20) }),
  event({ id: 'e4', source: 'market', sourceId: 'tx_9', label: 'Pazar Dönüşümü', base: 25, multiplier: 1, amount: 25, createdAt: dayAgo(40) }),
  event({ id: 'e5', source: 'legacy', sourceId: 'migration-v3', label: 'V2 Devir', base: 500, multiplier: 1, amount: 500, createdAt: dayAgo(3) }),
  event({ id: 'e6', source: 'adjustment', sourceId: 'fix-1', label: 'Düzeltme', base: -50, multiplier: 1, amount: -50, createdAt: dayAgo(0) }),
];

const SAMPLE_TOTAL = 150 + 40 + 60 + 25 + 500 - 50; // 725

describe('XP DEFTERİ — saf yardımcılar', () => {
  test('sumEventAmounts defter toplamını verir (geçersiz amount 0)', () => {
    expect(sumEventAmounts(SAMPLE)).toBe(SAMPLE_TOTAL);
    expect(sumEventAmounts([])).toBe(0);
    expect(sumEventAmounts([{ ...SAMPLE[0], amount: Number.NaN }])).toBe(0);
  });

  test('reconcileXpLedger eşleşme ve farkı doğru hesaplar', () => {
    const ok = reconcileXpLedger(SAMPLE, SAMPLE_TOTAL);
    expect(ok.matches).toBe(true);
    expect(ok.difference).toBe(0);

    const bad = reconcileXpLedger(SAMPLE, 700);
    expect(bad.matches).toBe(false);
    expect(bad.difference).toBe(25);
    expect(bad.totalXp).toBe(700);
  });

  test('son 7 / 30 gün toplamları aralık sınırına saygı duyar', () => {
    // 7 gün: e1 (150) + e5 (500) + e6 (-50) → 600
    expect(sumXpInLastDays(SAMPLE, 7, NOW)).toBe(600);
    // 30 gün: + e2 (40) + e3 (60) → 700
    expect(sumXpInLastDays(SAMPLE, 30, NOW)).toBe(700);
    expect(sumXpInLastDays(SAMPLE, 0, NOW)).toBe(0);
  });

  test('resolveXpSourceGroup pazar ve kontratı tek grupta toplar', () => {
    expect(resolveXpSourceGroup('market').id).toBe('market');
    expect(resolveXpSourceGroup('contract').id).toBe('market');
    expect(resolveXpSourceGroup('legacy-cloud').id).toBe('legacy');
    expect(resolveXpSourceGroup('achievement').label).toBe('Başarımlar');
  });

  test('groupXpLedgerRows kaynak sırasını korur ve grup toplamını verir', () => {
    const groups = groupXpLedgerRows(buildXpLedgerRows(SAMPLE));
    const ids = groups.map((g) => g.group.id);

    expect(ids).toEqual(['achievement', 'quest', 'market', 'legacy', 'adjustment']);
    const marketGroup = groups.find((g) => g.group.id === 'market');
    expect(marketGroup?.count).toBe(2); // contract + market
    expect(marketGroup?.total).toBe(85);
    expect(XP_SOURCE_GROUPS[0].id).toBe('achievement');
  });

  test('buildXpLedgerRows en yeniden eskiye sıralar', () => {
    const rows = buildXpLedgerRows(SAMPLE);
    expect(rows[0].event.id).toBe('e6');
    expect(rows[rows.length - 1].event.id).toBe('e4');
  });

  test('filterXpEvents kaynak, aralık ve arama filtresini uygular', () => {
    expect(filterXpEvents(SAMPLE, { group: 'achievement' }, NOW).map((e) => e.id)).toEqual(['e1']);
    expect(filterXpEvents(SAMPLE, { range: '7' }, NOW).map((e) => e.id).sort()).toEqual(['e1', 'e5', 'e6']);
    expect(filterXpEvents(SAMPLE, { search: 'kontrat' }, NOW).map((e) => e.id)).toEqual(['e3']);
    expect(filterXpEvents(SAMPLE, { search: 'pazar' }, NOW).map((e) => e.id)).toEqual(['e4']);
    expect(filterXpEvents(SAMPLE, { group: 'quest', range: '7' }, NOW)).toEqual([]);
  });

  test('limitGroupedXpRows satırları keser, grup sayacı tam kalır', () => {
    const groups = groupXpLedgerRows(buildXpLedgerRows(SAMPLE));
    const limited = limitGroupedXpRows(groups, 2);
    expect(limited.reduce((sum, g) => sum + g.rows.length, 0)).toBe(2);
    expect(limited[0].count).toBe(groups[0].count);
  });

  test('biçimlendirme: işaretli XP ve base × multiplier = amount', () => {
    expect(formatXpNumber(1250)).toBe('1.250');
    expect(formatXpAmount(150)).toBe('+150');
    expect(formatXpAmount(-50)).toBe('-50');
    expect(formatXpAmount(0)).toBe('0');
    expect(formatXpFormula({ base: 100, multiplier: 1.5, amount: 150 })).toBe('100 × 1,5 = 150');
  });
});

describe('XP DEFTERİ — SSR görünümü', () => {
  const render = (props: Partial<ComponentProps<typeof XpLedgerTab>> = {}) =>
    renderToStaticMarkup(
      <XpLedgerTab events={SAMPLE} totalXp={SAMPLE_TOTAL} level={4} {...props} />
    );

  test('üst kartlarda toplam XP, seviye ve 7/30 gün özetleri görünür', () => {
    const html = render();
    expect(html).toContain('Toplam XP');
    expect(html).toContain('725 XP');
    expect(html).toContain('Son 7 gün');
    expect(html).toContain('+600');
    expect(html).toContain('Son 30 gün');
    expect(html).toContain('+700');
    expect(html).toContain('Seviye');
  });

  test('kaynak grupları başlık olarak render edilir', () => {
    const html = render();
    expect(html).toContain('aria-label="Başarımlar kayıtları"');
    expect(html).toContain('aria-label="Görevler kayıtları"');
    expect(html).toContain('aria-label="Pazar / Kontrat kayıtları"');
    expect(html).toContain('aria-label="Eski Kayıt kayıtları"');
    expect(html).toContain('aria-label="Düzeltme kayıtları"');
    // satır detayı: formül + işaretli tutar
    expect(html).toContain('100 × 1,5 = 150');
    expect(html).toContain('İlk Film — Altın');
    // satır rozeti ham kaynağı gösterir (XP_SOURCE_LABELS tek kaynak)
    expect(html).toContain('Pazar Görevi');
    expect(html).toContain('Devralınan XP');
  });

  test('mutabakat tutarlıysa yeşil bilgi kutusu gösterir', () => {
    const html = render();
    expect(html).toContain('Defter tutarlı');
    expect(html).not.toContain('Mutabakat farkı');
  });

  test('mutabakat farkında kırmızı uyarı ve fark gösterilir', () => {
    const html = render({ totalXp: 700 });
    expect(html).toContain('Mutabakat farkı: +25 XP');
    expect(html).toContain('eşleşmiyor');
    expect(html).not.toContain('Defter tutarlı');
  });

  test('defter boşsa "Henüz XP kazanılmadı" gösterilir', () => {
    const html = renderToStaticMarkup(<XpLedgerTab events={[]} totalXp={0} level={1} />);
    expect(html).toContain('Henüz XP kazanılmadı');
  });

  test('loading durumunda aria-busy ve iskelet render edilir', () => {
    const html = renderToStaticMarkup(<XpLedgerTab events={[]} totalXp={0} level={1} loading />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('animate-pulse');
    expect(html).not.toContain('Henüz XP kazanılmadı');
  });
});

// ============================================================================
// GERÇEK VERİ YOLU: AppStateV3 → toLegacyCoreView → sekme
// ============================================================================

describe('XP DEFTERİ — toLegacyCoreView ile uyum (AppContext veri yolu)', () => {
  const buildView = () => {
    const state = {
      ...createEmptyAppStateV3({ ownerAgentId: 'SNV-TEST-0001' }),
      xpEvents: SAMPLE,
    };
    return toLegacyCoreView(state) as unknown as {
      xpEvents: XpEvent[];
      totalXp: number;
      level: number;
    };
  };

  test('legacy görünüm defteri aynen taşır ve totalXp = sum(events) olur', () => {
    const view = buildView();
    expect(view.xpEvents).toHaveLength(SAMPLE.length);
    expect(sumEventAmounts(view.xpEvents)).toBe(SAMPLE_TOTAL);
    expect(view.totalXp).toBe(SAMPLE_TOTAL);
    // seviye defterden türetilir (7 → 725 XP ile seviye 3+)
    expect(view.level).toBeGreaterThanOrEqual(1);
  });

  test('gerçek veri yoluyla mutabakat kutusu yeşil kalır', () => {
    const view = buildView();
    const html = renderToStaticMarkup(
      <XpLedgerTab events={view.xpEvents} totalXp={view.totalXp} level={view.level} />
    );
    expect(html).toContain('Defter tutarlı');
    expect(html).not.toContain('Mutabakat farkı');
  });

  test('defter boşsa gerçek veri yolunda boş durum gösterilir', () => {
    const view = toLegacyCoreView(createEmptyAppStateV3()) as unknown as {
      xpEvents: XpEvent[];
      totalXp: number;
      level: number;
    };
    expect(view.xpEvents).toEqual([]);
    expect(view.totalXp).toBe(0);
    const html = renderToStaticMarkup(
      <XpLedgerTab events={view.xpEvents} totalXp={view.totalXp} level={view.level} />
    );
    expect(html).toContain('Henüz XP kazanılmadı');
  });
});
