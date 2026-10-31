import { describe, test, expect } from 'vitest';
import type { AppStateV3, XpEvent } from '../types/appState';
import { SAVE_SCHEMA_VERSION } from '../types/sync';
import {
  buildSaveEnvelope,
  buildSyncSummary,
  canFastForward,
  hasXpEvent,
  makeSaveHash,
  nextRevision,
  sameSaveHash,
  stableStringify,
  summarizeXpLedger,
  xpEventKey,
} from '../lib/syncContract';
import { levelFromXp } from '../lib/xp';

// ============================================================================
// V3 SÖZLEŞME TESTLERİ — yalnız saf yardımcılar (davranış yok)
// ============================================================================

function makeEvent(overrides: Partial<XpEvent> = {}): XpEvent {
  return {
    id: 'evt-1',
    source: 'achievement',
    sourceId: 'first_watch:gold',
    label: 'İlk Film · Altın',
    base: 50,
    multiplier: 1,
    amount: 50,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeState(overrides: Partial<AppStateV3> = {}): AppStateV3 {
  return {
    schemaVersion: 3,
    ownerAgentId: 'SNV-AAAA-BBBB',
    revision: 4,
    updatedAt: '2026-01-02T00:00:00.000Z',
    deviceId: 'dev-1',
    xpEvents: [makeEvent({ amount: 50 }), makeEvent({ id: 'evt-2', source: 'quest', sourceId: 'daily_watch_3', amount: 120 })],
    movies: [],
    series: [],
    collections: [],
    history: [],
    genres: [],
    removedSeriesTitles: [],
    criteria: [],
    showcase: [],
    achievements: [],
    quests: {
      activeQuestId: null,
      questAcceptedAt: null,
      questRejects: 0,
      questCooldownUntil: null,
      completedQuests: [],
      activeBadgeId: null,
      isPenaltyEnabled: false,
    },
    coins: 0,
    coinLedger: [],
    inventory: [],
    equipped: {},
    activeEffects: [],
    perks: [],
    dailyStreak: 0,
    dailyStreakDate: null,
    lastWatchDate: null,
    weeklyPlan: [],
    externalActions: [],
    tutorial: {
      welcomeDone: true,
      welcomeStep: 0,
      completed: [],
      pageVisited: [],
      modalSeen: [],
      academyStarted: false,
      academyStep: 0,
      academyDone: [],
      events: [],
      eventCounts: {},
    },
    academy: { started: false, step: 0, done: [] },
    settings: { theme: 'dark' },
    ...overrides,
  };
}

describe('makeSaveHash — deterministik parmak izi', () => {
  test('anahtar sırası hash\'i değiştirmez (düz nesne)', () => {
    const a = { b: 2, a: 1, c: 3 };
    const b = { c: 3, a: 1, b: 2 };
    expect(makeSaveHash(a)).toBe(makeSaveHash(b));
  });

  test('anahtar sırası iç içe nesnelerde de fark etmez', () => {
    const a = { core: { movies: [], xpEvents: [{ amount: 1, source: 'quest' }] } };
    const b = { core: { xpEvents: [{ source: 'quest', amount: 1 }], movies: [] } };
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(makeSaveHash(a)).toBe(makeSaveHash(b));
  });

  test('dizi sırası ANLAMLIDIR → hash değişir', () => {
    expect(makeSaveHash({ xs: [1, 2, 3] })).not.toBe(makeSaveHash({ xs: [3, 2, 1] }));
  });

  test('içerik değişince hash değişir', () => {
    expect(makeSaveHash({ total: 10 })).not.toBe(makeSaveHash({ total: 11 }));
    expect(makeSaveHash({ total: 10 })).not.toBe(makeSaveHash({ total: '10' }));
  });

  test('undefined değerli anahtar "yok" sayılır', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });

  test('çıktı fnv1a biçiminde ve tekrarlanabilir', () => {
    const hash = makeSaveHash({ a: 1 });
    expect(hash).toMatch(/^fnv1a-[0-9a-f]{8}-[0-9a-z]+$/);
    expect(makeSaveHash({ a: 1 })).toBe(hash);
  });

  test('uzunluk farkı tek başına çakışma üretmez (boyut hesaba katılır)', () => {
    expect(makeSaveHash('ab')).not.toBe(makeSaveHash('ba'));
    expect(makeSaveHash('')).toBe(makeSaveHash(''));
  });
});

describe('buildSaveEnvelope', () => {
  test('şema sürümü, hash ve gövde tutarlı', () => {
    const payload = makeState();
    const envelope = buildSaveEnvelope({
      payload,
      ownerAgentId: payload.ownerAgentId,
      revision: 7,
      deviceId: 'dev-1',
    });
    expect(envelope.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(envelope.schemaVersion).toBe(3);
    expect(envelope.revision).toBe(7);
    expect(envelope.saveHash).toBe(makeSaveHash(payload));
    expect(envelope.updatedAt).toBe(payload.updatedAt);
    expect(envelope.payload).toBe(payload);
  });

  test('geçersiz/negatif revizyon 0\'a sabitlenir (sunucu atar)', () => {
    const payload = makeState();
    const envelope = buildSaveEnvelope({ payload, ownerAgentId: null, revision: -5, deviceId: 'dev-1' });
    expect(envelope.revision).toBe(0);
  });

  test('updatedAt verilirse gövdeninkini ezer', () => {
    const payload = makeState();
    const envelope = buildSaveEnvelope({
      payload,
      ownerAgentId: payload.ownerAgentId,
      revision: 1,
      deviceId: 'dev-1',
      updatedAt: '2026-02-02T00:00:00.000Z',
    });
    expect(envelope.updatedAt).toBe('2026-02-02T00:00:00.000Z');
  });
});

describe('buildSyncSummary', () => {
  test('defter toplamı, seviye ve içerik sayımları', () => {
    const state = makeState({
      movies: [{} as never, {} as never, {} as never],
      series: [{} as never],
      achievements: [
        { achievementId: 'a', current: 1, unlockedTiers: ['bronze'], lastNotifiedTier: null },
        { achievementId: 'b', current: 0, unlockedTiers: [], lastNotifiedTier: null },
        { achievementId: 'c', current: 2, unlockedTiers: ['bronze', 'silver'], lastNotifiedTier: 'silver' },
      ],
      quests: {
        activeQuestId: null,
        questAcceptedAt: null,
        questRejects: 0,
        questCooldownUntil: null,
        completedQuests: ['q1', 'q2', 'q3', 'q4'],
        activeBadgeId: null,
        isPenaltyEnabled: false,
      },
    });

    const summary = buildSyncSummary(state);
    expect(summary.totalXp).toBe(170); // 50 + 120
    expect(summary.level).toBe(levelFromXp(170).level);
    expect(summary.movies).toBe(3);
    expect(summary.series).toBe(1);
    expect(summary.achievements).toBe(2); // kademesi olmayan 'b' sayılmaz
    expect(summary.quests).toBe(4);
    expect(summary.updatedAt).toBe(state.updatedAt);
  });

  test('boş defter → 0 XP, seviye 1', () => {
    const summary = buildSyncSummary(makeState({ xpEvents: [] }));
    expect(summary.totalXp).toBe(0);
    expect(summary.level).toBe(1);
  });
});

describe('nextRevision — yerel sayaç', () => {
  test('tek adım artar', () => {
    expect(nextRevision(0)).toBe(1);
    expect(nextRevision(9)).toBe(10);
    expect(nextRevision(1.9)).toBe(2);
  });

  test('geçersiz girdi 1\'den başlar', () => {
    expect(nextRevision(-1)).toBe(1);
    expect(nextRevision(Number.NaN)).toBe(1);
    expect(nextRevision(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('sameSaveHash', () => {
  test('aynı hash → true', () => {
    expect(sameSaveHash('fnv1a-00000001-1', 'fnv1a-00000001-1')).toBe(true);
  });

  test('farklı hash → false', () => {
    expect(sameSaveHash('fnv1a-00000001-1', 'fnv1a-00000002-1')).toBe(false);
  });

  test('boş/eksik hash "aynı" sayılmaz', () => {
    expect(sameSaveHash(undefined, undefined)).toBe(false);
    expect(sameSaveHash(null, 'fnv1a-00000001-1')).toBe(false);
    expect(sameSaveHash('', '')).toBe(false);
  });
});

describe('canFastForward — indirme yönü', () => {
  test('bulut ilerideyse true', () => {
    expect(canFastForward(3, 4)).toBe(true);
    expect(canFastForward(0, 1)).toBe(true);
  });

  test('eşit veya yerel ilerideyse false', () => {
    expect(canFastForward(4, 4)).toBe(false);
    expect(canFastForward(5, 4)).toBe(false);
  });

  test('geçersiz değerlerde false (asla ileri sarma)', () => {
    expect(canFastForward(Number.NaN, 4)).toBe(false);
    expect(canFastForward(3, Number.POSITIVE_INFINITY)).toBe(false);
    expect(canFastForward(-1, 4)).toBe(false);
  });
});

describe('XP defteri yardımcıları (idempotency)', () => {
  test('toplam = sum(amount) ve kaynak dağılımı', () => {
    const summary = summarizeXpLedger([
      makeEvent({ amount: 50 }),
      makeEvent({ id: 'e2', source: 'legacy-cloud', sourceId: 'legacy', amount: 1000 }),
      makeEvent({ id: 'e3', source: 'adjustment', sourceId: 'fix-1', amount: -25 }),
    ]);
    expect(summary.totalXp).toBe(1025);
    expect(summary.count).toBe(3);
    expect(summary.bySource.achievement).toBe(50);
    expect(summary.bySource['legacy-cloud']).toBe(1000);
    expect(summary.bySource.adjustment).toBe(-25);
    expect(summary.bySource.market).toBe(0);
  });

  test('(source, sourceId) çifti tekil anahtardır', () => {
    expect(xpEventKey(makeEvent())).toBe('achievement:first_watch:gold');
    const events = [makeEvent()];
    expect(hasXpEvent(events, 'achievement', 'first_watch:gold')).toBe(true);
    expect(hasXpEvent(events, 'achievement', 'first_watch:silver')).toBe(false);
    // Aynı sourceId başka kaynakta ayrı kayıttır.
    expect(hasXpEvent(events, 'quest', 'first_watch:gold')).toBe(false);
  });
});
