import { describe, expect, test } from 'vitest';
import {
  BOOT_SNAPSHOT_VERSION,
  buildBootSnapshot,
  createEmptyAppStateV3,
  fromLegacyCore,
  isAppStateV3,
  isBootSnapshotV3,
  isLegacyAppState,
  migrateLegacyToV3,
  toLegacyCoreView,
  LEGACY_XP_SOURCE_ID,
} from '../lib/localStateV3';
import { sumXpEvents } from '../lib/xpLedger';

// ============================================================================
// localStateV3 — V2 → V3 göçü, XP toplamı, quests, extras ve boot snapshot
// ============================================================================

function makeV2Core(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    movies: [
      { id: 'm1', title: 'Film Bir', rating: 8 },
      { id: 'm2', title: 'Film İki', rating: 7 },
    ],
    series: [{ id: 's1', title: 'Dizi Bir', episodes: [] }],
    collections: [{ id: 'c1', name: 'Koleksiyon' }],
    history: [{ id: 'h1', movieId: 'm1', watchedAt: '2026-01-01' }],
    genres: ['Dram', 'Aksiyon'],
    removedSeriesTitles: ['Kayıp Dizi'],
    criteria: [],
    showcase: [{ id: 'm1', title: 'Film Bir', type: 'movie' }],
    achievements: [
      { achievementId: 'movie_add', current: 2, unlockedTiers: ['bronze'], tierDates: {} },
    ],
    coins: 120,
    coinLedger: [{ id: 'welcome', amount: 150, kind: 'welcome', label: 'Hediye', refId: 'welcome', createdAt: '2026-01-01T00:00:00.000Z' }],
    inventory: [],
    equipped: { badgeId: 'b1' },
    activeEffects: [],
    perks: ['extra_slot'],
    xp: 0,
    level: 5,
    totalXp: 1850,
    bonusXp: 50,
    xpBaseline: 100,
    dailyStreak: 4,
    dailyStreakDate: '2026-01-01',
    lastWatchDate: '2026-01-01',
    theme: 'midnight',
    nickname: 'Test Kullanıcı',
    notificationsEnabled: true,
    reviewTags: ['🔥 Başyapıt'],
    agentId: 'SNV-TEST-1234',
    weeklyPlan: [{ id: 'p1', date: '2026-01-02', time: '20:00', title: 'Plan' }],
    externalActions: [{ id: 'x1', label: 'Ara', urlTemplate: 'https://x/{title}' }],
    mysteryField: { keep: true },
    ...overrides,
  };
}

describe('localStateV3 — doğrulama', () => {
  test('isAppStateV3 yalnız schemaVersion 3 + defter taşıyan kaydı kabul eder', () => {
    const empty = createEmptyAppStateV3({ deviceId: 'dev-1' });
    expect(isAppStateV3(empty)).toBe(true);
    expect(isAppStateV3({ ...empty, schemaVersion: 2 })).toBe(false);
    expect(isAppStateV3({ ...empty, xpEvents: undefined })).toBe(false);
    expect(isAppStateV3(null)).toBe(false);
  });

  test('isLegacyAppState V2 kaydını tanır, V3 kaydını reddeder', () => {
    expect(isLegacyAppState(makeV2Core())).toBe(true);
    expect(isLegacyAppState(createEmptyAppStateV3())).toBe(false);
    expect(isLegacyAppState({ movies: [], series: [] })).toBe(true);
  });

  test('createEmptyAppStateV3 boş, geçerli ve defter toplamı 0 olan kayıt üretir', () => {
    const state = createEmptyAppStateV3({ ownerAgentId: 'SNV-AAAA-BBBB', deviceId: 'dev-1' });
    expect(state.schemaVersion).toBe(3);
    expect(state.ownerAgentId).toBe('SNV-AAAA-BBBB');
    expect(state.xpEvents).toEqual([]);
    expect(sumXpEvents(state.xpEvents)).toBe(0);
    expect(state.movies).toEqual([]);
    expect(state.quests.completedQuests).toEqual([]);
  });
});

describe('localStateV3 — V2 → V3 göçü', () => {
  test('kütüphane ve ayar alanları V3 kaydına taşınır', () => {
    const extras = { tutorial: { welcomeDone: true }, academyUi: { open: true } };
    const state = migrateLegacyToV3({
      core: makeV2Core(),
      quests: { completedQuests: ['c_short_movie'] },
      extras,
      ownerAgentId: 'SNV-TEST-1234',
      deviceId: 'dev-1',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });

    expect(state.schemaVersion).toBe(3);
    expect(state.ownerAgentId).toBe('SNV-TEST-1234');
    expect(state.updatedAt).toBe('2026-02-01T00:00:00.000Z');
    expect(state.movies).toHaveLength(2);
    expect(state.series).toHaveLength(1);
    expect(state.collections).toHaveLength(1);
    expect(state.history).toHaveLength(1);
    expect(state.removedSeriesTitles).toEqual(['Kayıp Dizi']);
    expect(state.coins).toBe(120);
    expect(state.equipped).toEqual({ badgeId: 'b1' });
    expect(state.perks).toEqual(['extra_slot']);
    expect(state.weeklyPlan).toHaveLength(1);
    expect(state.externalActions).toHaveLength(1);
    expect(state.dailyStreak).toBe(4);
    expect(state.settings.theme).toBe('midnight');
    expect(state.settings.nickname).toBe('Test Kullanıcı');
    expect(state.settings.notificationsEnabled).toBe(true);
    expect(state.settings.reviewTags).toEqual(['🔥 Başyapıt']);
    expect(state.achievements).toHaveLength(1);
    // Türetilmiş XP alanları V3 kaydında YOKTUR.
    expect('totalXp' in state).toBe(false);
    expect('xpBaseline' in state).toBe(false);
  });

  test('XP toplamı korunur: eski totalXp defterin toplamına eşit', () => {
    const state = migrateLegacyToV3({ core: makeV2Core(), updatedAt: '2026-02-01T00:00:00.000Z' });
    expect(sumXpEvents(state.xpEvents)).toBe(1850);
    const legacy = state.xpEvents.filter((event) => event.source === 'legacy');
    expect(legacy).toHaveLength(1);
    expect(legacy[0].sourceId).toBe(LEGACY_XP_SOURCE_ID);
    expect(legacy[0].amount).toBe(1850);
  });

  test('totalXp yoksa bonusXp + xpBaseline taban olarak korunur', () => {
    const core = makeV2Core({ totalXp: undefined, xp: undefined, level: 1, bonusXp: 40, xpBaseline: 60 });
    const state = migrateLegacyToV3({ core });
    expect(sumXpEvents(state.xpEvents)).toBe(100);
    expect(state.xpEvents.every((event) => event.source === 'legacy' || event.source === 'adjustment')).toBe(true);
  });

  test('totalXp daha küçükse fark adjustment (negatif) ile kapatılır', () => {
    const core = makeV2Core({ totalXp: 100, bonusXp: 150, xpBaseline: 0 });
    const state = migrateLegacyToV3({ core });
    expect(sumXpEvents(state.xpEvents)).toBe(100);
    const adjustment = state.xpEvents.filter((event) => event.source === 'adjustment');
    expect(adjustment).toHaveLength(1);
    expect(adjustment[0].amount).toBe(-50);
  });

  test('bulut toplamı daha büyükse legacy-cloud kaydı yazılır', () => {
    const state = migrateLegacyToV3({ core: makeV2Core({ totalXp: 100, bonusXp: 0, xpBaseline: 0 }), cloudTotalXp: 250 });
    expect(sumXpEvents(state.xpEvents)).toBe(250);
    expect(state.xpEvents.some((event) => event.source === 'legacy-cloud')).toBe(true);
  });

  test('quests: completedQuests ve görev durumu taşınır', () => {
    const quests = {
      activeQuestId: 'q-active',
      questAcceptedAt: 111,
      questRejects: 2,
      questCooldownUntil: 222,
      completedQuests: ['c_short_movie', 'c_action_fan'],
      activeBadgeId: 'badge-1',
      isPenaltyEnabled: true,
      activeContract: { instanceId: 'i1', contractId: 'ci1' },
      freeDailyUsage: { date: '2026-01-01', count: 1 },
      unknownQuestField: 'korunmalı',
    };
    const state = migrateLegacyToV3({ core: makeV2Core(), quests });

    expect(state.quests.completedQuests).toEqual(['c_short_movie', 'c_action_fan']);
    expect(state.quests.activeQuestId).toBe('q-active');
    expect(state.quests.questRejects).toBe(2);
    expect(state.quests.isPenaltyEnabled).toBe(true);
    expect(state.quests.activeContract).toEqual({ instanceId: 'i1', contractId: 'ci1' });
    expect(state.quests.freeDailyUsage).toEqual({ date: '2026-01-01', count: 1 });
    expect((state.legacy?.quests as Record<string, unknown>).unknownQuestField).toBe('korunmalı');
  });

  test('extras: tutorial ve akademi bloklarına eşlenir, bilinmeyenler legacy torbasında kalır', () => {
    const extras = {
      tutorial: {
        welcomeDone: true,
        welcomeStep: 2,
        completed: ['t1'],
        academyStarted: true,
        academyStep: 1,
        academyDone: ['a1'],
        extraTutorialField: 'e',
      },
      academyUi: { started: true, step: 2, done: ['lesson-1'], panel: 'open' },
      sound: 'off',
      shortcuts: { key: 'value' },
    };
    const state = migrateLegacyToV3({ core: makeV2Core(), extras });

    expect(state.tutorial.welcomeDone).toBe(true);
    expect(state.tutorial.welcomeStep).toBe(2);
    expect(state.tutorial.events).toEqual([]);
    expect((state.tutorial as unknown as { legacy: Record<string, unknown> }).legacy.extraTutorialField).toBe('e');
    expect(state.academy.started).toBe(true);
    expect(state.academy.done).toEqual(['lesson-1']);
    expect(state.academy.ui).toEqual({ panel: 'open' });
    expect((state.legacy?.extras as Record<string, unknown>).sound).toBe('off');
    expect((state.legacy?.extras as Record<string, unknown>).shortcuts).toEqual({ key: 'value' });
  });

  test('bilinmeyen çekirdek alanları legacy torbasında korunur', () => {
    const state = migrateLegacyToV3({ core: makeV2Core() });
    expect((state.legacy?.core as Record<string, unknown>).mysteryField).toEqual({ keep: true });
  });

  test('V3 kaydı verilirse göç dokunmadan aynı kaydı döndürür', () => {
    const original = createEmptyAppStateV3({ ownerAgentId: 'SNV-AAAA-BBBB', deviceId: 'dev-1' });
    const migrated = migrateLegacyToV3({ core: original });
    expect(migrated).toEqual(original);
  });

  test('toLegacyCoreView XP alanlarını defterden türetir (geçiş köprüsü)', () => {
    const state = migrateLegacyToV3({ core: makeV2Core(), quests: { completedQuests: ['c_short_movie'] } });
    const view = toLegacyCoreView(state);
    expect(view.totalXp).toBe(1850);
    expect(view.theme).toBe('midnight');
    expect(view.agentId).toBe('SNV-TEST-1234');
    expect(view.bonusXp).toBe(0);
  });
});

describe('localStateV3 — canlı state → V3 (fromLegacyCore)', () => {
  test('core.xpEvents varsa defter otoritedir, yeniden üretim/çift sayım olmaz', () => {
    const events = [
      { id: 'e1', source: 'achievement' as const, sourceId: 'movie_add:bronze', label: 'A', base: 5, multiplier: 1, amount: 5, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'e2', source: 'quest' as const, sourceId: 'c_short_movie', label: 'B', base: 50, multiplier: 1, amount: 50, createdAt: '2026-01-02T00:00:00.000Z' },
    ];
    const core = makeV2Core({ xpEvents: events, totalXp: 55, bonusXp: 0, xpBaseline: 0 });
    const state = fromLegacyCore(core, { updatedAt: '2026-05-01T00:00:00.000Z' });

    expect(state.xpEvents).toHaveLength(2);
    expect(state.xpEvents.map((event) => event.id)).toEqual(['e1', 'e2']);
    expect(sumXpEvents(state.xpEvents)).toBe(55);
    expect(state.xpEvents.some((event) => event.source === 'legacy')).toBe(false);
  });

  test('önceki V3 zarfı (revision/deviceId/legacy) korunur', () => {
    const previous = migrateLegacyToV3({
      core: makeV2Core(),
      deviceId: 'dev-old',
      ownerAgentId: 'SNV-AAAA-BBBB',
      updatedAt: '2026-04-01T00:00:00.000Z',
    });
    previous.revision = 7;
    previous.lastCloudSync = 1234;

    const state = fromLegacyCore(makeV2Core({ totalXp: 2000, movies: [] }), {
      previous,
      quests: { completedQuests: ['q-new'] },
      updatedAt: '2026-05-01T00:00:00.000Z',
    });

    expect(state.revision).toBe(7);
    expect(state.deviceId).toBe('dev-old');
    expect(state.ownerAgentId).toBe('SNV-TEST-1234');
    expect(state.updatedAt).toBe('2026-05-01T00:00:00.000Z');
    expect(state.lastCloudSync).toBe(1234);
    expect(state.movies).toEqual([]);
    expect(state.quests.completedQuests).toEqual(['q-new']);
    // Yeni defter: previous olmadığı için totalXp'den göç edilir.
    expect(sumXpEvents(state.xpEvents)).toBe(2000);
  });

  test('önceki legacy torbası birleşerek korunur', () => {
    const previous = migrateLegacyToV3({ core: makeV2Core({ mysteryField: { keep: true } }) });
    const state = fromLegacyCore(makeV2Core(), { previous });
    expect((state.legacy?.core as Record<string, unknown>).mysteryField).toEqual({ keep: true });
  });
});

describe('localStateV3 — boot snapshot', () => {
  test('snapshot yalnız küçük alanları taşır, kütüphane ve defter GİRMEZ', () => {
    const core = makeV2Core({
      movies: Array.from({ length: 300 }, (_, i) => ({ id: `m${i}`, title: `Film ${i}`, notes: 'x'.repeat(100) })),
    });
    const state = migrateLegacyToV3({ core, updatedAt: '2026-02-01T00:00:00.000Z' });
    const snapshot = buildBootSnapshot(state);
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.schemaVersion).toBe(3);
    expect(snapshot.snapshotVersion).toBe(BOOT_SNAPSHOT_VERSION);
    expect(snapshot.totalXp).toBe(1850);
    expect(snapshot.theme).toBe('midnight');
    expect(snapshot.agentId).toBe('SNV-TEST-1234');
    expect(snapshot.achievements.total).toBe(1);
    expect(snapshot.prefs.notificationsEnabled).toBe(true);
    expect(serialized).not.toContain('movies');
    expect(serialized).not.toContain('xpEvents');
    expect(serialized).not.toContain('Film 0');
    expect(serialized.length).toBeLessThan(4096);
    expect(isBootSnapshotV3(snapshot)).toBe(true);
    // Boot snapshot'ı asla tam kayıt sanılmamalı.
    expect(isAppStateV3(snapshot)).toBe(false);
  });
});
