import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  appendXpEvent,
  hasXpEvent,
  makeXpEvent,
  mergeXpLedgers,
  migrateLegacyXp,
  normalizeXpEvents,
  sumXpEvents,
  summarizeXpLedger,
  xpEventKey,
  LEGACY_MIGRATION_ID,
} from '../lib/xpLedger';
import { applyAchievements, rootReducer, type ExtendedAppData } from '../context/AppContext';
import { ACHIEVEMENT_DEFS } from '../lib/achievements';
import { levelFromXp } from '../lib/xp';
import { migrateLegacyToV3, toLegacyCoreView } from '../lib/localStateV3';

/* ============================================================================
   XP DEFTERİ — saf fonksiyonlar + AppContext reducer entegrasyonu
   Tek doğru: totalXp = sum(xpEvents.amount). Liste/görev taraması YOK.
   ========================================================================== */

const storageMap = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => storageMap.get(k) ?? null,
  setItem: (k: string, v: string) => void storageMap.set(k, v),
  removeItem: (k: string) => void storageMap.delete(k),
  clear: () => storageMap.clear(),
  key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
  get length() {
    return storageMap.size;
  },
};

beforeEach(() => {
  storageMap.clear();
  vi.stubGlobal('localStorage', fakeStorage);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function baseState(): ExtendedAppData {
  return {
    movies: [], series: [], removedSeriesTitles: [], collections: [], genres: [],
    reviewTags: [], history: [],
    achievements: ACHIEVEMENT_DEFS.map((def) => ({
      achievementId: def.id,
      current: 0,
      unlockedTiers: [],
      tierDates: {},
      lastNotifiedTier: null,
    })),
    criteria: [], xp: 0, level: 1, totalXp: 0, xpEvents: [],
    lastWatchDate: null, dailyStreak: 0, dailyStreakDate: null,
    theme: 'premium-dark', altWatchTemplate: '', weeklyPlan: [], notificationsEnabled: false,
  } as ExtendedAppData;
}

describe('xpLedger — saf fonksiyonlar', () => {
  test('makeXpEvent: amount = round(base * multiplier), varsayılan çarpan 1', () => {
    const plain = makeXpEvent({ source: 'quest', sourceId: 'q1', base: 50 });
    expect(plain.amount).toBe(50);
    expect(plain.multiplier).toBe(1);

    const boosted = makeXpEvent({ source: 'contract', sourceId: 'c1', base: 333, multiplier: 1.5 });
    expect(boosted.base).toBe(333);
    expect(boosted.multiplier).toBe(1.5);
    expect(boosted.amount).toBe(Math.round(333 * 1.5)); // 500

    // Negatif taban (düzeltme) korunur.
    const negative = makeXpEvent({ source: 'adjustment', sourceId: 'fix', base: -25 });
    expect(negative.amount).toBe(-25);
  });

  test('xpEventKey + hasXpEvent: (source, sourceId) çifti anahtardır', () => {
    const event = makeXpEvent({ source: 'achievement', sourceId: 'ach:first_watch:gold', base: 50 });
    expect(xpEventKey(event)).toBe('achievement:ach:first_watch:gold');
    expect(hasXpEvent([event], 'achievement', 'ach:first_watch:gold')).toBe(true);
    expect(hasXpEvent([event], 'achievement', 'ach:first_watch:silver')).toBe(false);
    // Aynı sourceId farklı kaynakta çakışmaz.
    expect(hasXpEvent([event], 'quest', 'ach:first_watch:gold')).toBe(false);
  });

  test('sumXpEvents + summarizeXpLedger: toplam ve kaynak dağılımı', () => {
    const events = [
      makeXpEvent({ source: 'achievement', sourceId: 'a1', base: 50 }),
      makeXpEvent({ source: 'quest', sourceId: 'q1', base: 120 }),
      makeXpEvent({ source: 'adjustment', sourceId: 'fix', base: -20 }),
    ];
    expect(sumXpEvents(events)).toBe(150);

    const summary = summarizeXpLedger(events);
    expect(summary.totalXp).toBe(150);
    expect(summary.count).toBe(3);
    expect(summary.bySource.achievement).toBe(50);
    expect(summary.bySource.quest).toBe(120);
    expect(summary.bySource.adjustment).toBe(-20);
    expect(summary.bySource.market).toBe(0);
    // Boş/bozuk defter 0.
    expect(summarizeXpLedger(null).totalXp).toBe(0);
    expect(normalizeXpEvents([{ nope: true }])).toEqual([]);
  });

  test('appendXpEvent idempotent: aynı (source, sourceId) ikinci kez eklenmez', () => {
    const first = makeXpEvent({ source: 'quest', sourceId: 'quest:q1', base: 40 });
    const once = appendXpEvent([], first);
    expect(once.added).toBe(true);
    expect(once.events).toHaveLength(1);

    const twice = appendXpEvent(once.events, makeXpEvent({ source: 'quest', sourceId: 'quest:q1', base: 999 }));
    expect(twice.added).toBe(false);
    expect(twice.events).toHaveLength(1);
    expect(sumXpEvents(twice.events)).toBe(40);

    // Giriş dizisi mutasyona uğramaz.
    expect(once.events).toHaveLength(1);
  });

  test('mergeXpLedgers: kaynak+sourceId tekilleştirir, primary kazanır', () => {
    const cloud = [
      makeXpEvent({ source: 'legacy', sourceId: 'migration-v3', base: 1850 }),
      makeXpEvent({ source: 'achievement', sourceId: 'ach:movie_add:bronze', base: 5 }),
    ];
    const local = [
      makeXpEvent({ source: 'achievement', sourceId: 'ach:movie_add:bronze', base: 5 }),
      makeXpEvent({ source: 'quest', sourceId: 'quest:q9', base: 30 }),
    ];
    const merged = mergeXpLedgers(cloud, local);
    expect(merged).toHaveLength(3);
    expect(sumXpEvents(merged)).toBe(1885);
  });

  test('mergeXpLedgers: aynı anahtar farklı amount → bulut satırı + tek adjustment', () => {
    const cloud = [
      makeXpEvent({ source: 'achievement', sourceId: 'ach:shared', base: 100, createdAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const local = [
      makeXpEvent({ source: 'achievement', sourceId: 'ach:shared', base: 120, createdAt: '2026-01-01T00:00:01.000Z' }),
    ];

    const merged = mergeXpLedgers(cloud, local);

    expect(merged).toHaveLength(2);
    expect(merged[0].amount).toBe(100); // primary (bulut) korunur
    const adjustment = merged[1];
    expect(adjustment.source).toBe('adjustment');
    expect(adjustment.sourceId).toBe('merge-adjust:achievement:ach:shared');
    expect(adjustment.amount).toBe(20);
    // İki tarafın farkı kaybolmaz: toplam, secondary'nin toplamına eşit açıklanır.
    expect(sumXpEvents(merged)).toBe(120);
  });

  test('mergeXpLedgers: adjustment idempotent — ikinci birleştirme çift kayıt üretmez', () => {
    const cloud = [makeXpEvent({ source: 'quest', sourceId: 'q1', base: 100 })];
    const local = [makeXpEvent({ source: 'quest', sourceId: 'q1', base: 80 })];

    const once = mergeXpLedgers(cloud, local);
    const twice = mergeXpLedgers(once, local);
    const thrice = mergeXpLedgers(twice, local);

    expect(once).toHaveLength(2);
    expect(sumXpEvents(once)).toBe(80);
    expect(twice).toEqual(once);
    expect(thrice).toEqual(once);
    expect(thrice.filter((event) => event.source === 'adjustment')).toHaveLength(1);
  });
});

describe('xpLedger — V2 göç (migrateLegacyXp)', () => {
  test('eski 1855 XP aynen legacy kaydına dönüşür', () => {
    const events = migrateLegacyXp({ localTotalXp: 1855 });
    expect(sumXpEvents(events)).toBe(1855);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('legacy');
    expect(events[0].sourceId).toBe(LEGACY_MIGRATION_ID);
    expect(events[0].amount).toBe(1855);
  });

  test('göç idempotent: ikinci çağrı deftere dokunmaz', () => {
    const once = migrateLegacyXp({ localTotalXp: 1855, createdAt: '2026-01-01T00:00:00.000Z' });
    const twice = migrateLegacyXp({ events: once, localTotalXp: 1855, createdAt: '2026-02-02T00:00:00.000Z' });
    expect(twice).toHaveLength(1);
    expect(sumXpEvents(twice)).toBe(1855);
    // Yeni kayıt üretilmedi: ilk göçün zaman damgası korunur.
    expect(twice[0]).toStrictEqual(once[0]);
    expect(twice[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  test('totalXp yoksa bonusXp + xpBaseline tek seferlik taban olur (çift sayım yok)', () => {
    const fromFields = migrateLegacyXp({ bonusXp: 40, xpBaseline: 60 });
    expect(sumXpEvents(fromFields)).toBe(100);

    // totalXp varsa otorite odur; bonus/taban ikinci kez eklenmez.
    const withTotal = migrateLegacyXp({ localTotalXp: 100, bonusXp: 40, xpBaseline: 60 });
    expect(sumXpEvents(withTotal)).toBe(100);
  });

  test('bulut farkı legacy-cloud, kalan sapma adjustment olarak yazılır', () => {
    const cloudAhead = migrateLegacyXp({ localTotalXp: 100, cloudTotalXp: 250 });
    expect(sumXpEvents(cloudAhead)).toBe(250);
    expect(cloudAhead.some((event) => event.source === 'legacy-cloud')).toBe(true);
    expect(cloudAhead.find((event) => event.source === 'legacy')?.amount).toBe(100);

    const adjusted = migrateLegacyXp({ localTotalXp: 100, targetTotalXp: 90 });
    expect(sumXpEvents(adjusted)).toBe(90);
    const adjustment = adjusted.find((event) => event.source === 'adjustment');
    expect(adjustment?.amount).toBe(-10);
  });
});

describe('AppContext — XP defteri tek kaynak', () => {
  test('GRANT_XP: totalXp defter toplamı, level ondan türetilir', () => {
    const state = rootReducer(baseState(), {
      type: 'GRANT_XP', xp: 600, source: 'system', sourceId: 'system:welcome', label: 'Hoş geldin',
    } as any);
    expect(state.xpEvents).toHaveLength(1);
    expect(state.xpEvents![0].source).toBe('system');
    expect(state.totalXp).toBe(600);
    expect(state.level).toBe(levelFromXp(600).level);
    expect(state.pendingXpGain).toMatchObject({ gained: 600, oldTotal: 0, newTotal: 600, source: 'system' });
  });

  test('GRANT_XP aynı (source, sourceId) ile tekrarlandığında toplam ARTMAZ', () => {
    const action = {
      type: 'GRANT_XP', xp: 200, source: 'market', sourceId: 'market:util_discovery_ticket:1', label: 'Keşif Bileti',
    } as any;
    const once = rootReducer(baseState(), action);
    expect(once.totalXp).toBe(200);

    const twice = rootReducer(once, action);
    expect(twice.totalXp).toBe(200);
    expect(twice.xpEvents).toHaveLength(1);
    // İkinci çağrı yeni kutlama üretmez.
    expect(twice.pendingXpGain).toBe(once.pendingXpGain);
  });

  test('çarpanlı kazançta base ve multiplier ayrı saklanır, amount nihaidir', () => {
    const state = rootReducer(baseState(), {
      type: 'GRANT_XP', xp: 518, base: 345, multiplier: 1.5,
      source: 'contract', sourceId: 'contract:inst-1', label: 'Zorlu Görev',
    } as any);
    const event = state.xpEvents![0];
    expect(event.base).toBe(345);
    expect(event.multiplier).toBe(1.5);
    expect(event.amount).toBe(518); // round(345 * 1.5) = 518
    expect(state.totalXp).toBe(518);
  });

  test('başarım + görev çift sayılmaz: liste taranmaz, defter idempotenttir', () => {
    // 1 film → movie_add bronze (5 XP) açılır.
    let state = baseState();
    state.movies = [{ id: 'm1', title: 'Film', watched: false } as any];

    const firstPass = applyAchievements(state);
    expect(firstPass.totalXp).toBe(5);
    expect(firstPass.xpEvents!.filter((event) => event.source === 'achievement')).toHaveLength(1);
    expect(firstPass.xpEvents![0].sourceId).toBe('ach:movie_add:bronze');

    // Aynı başarım tekrar uygulanır → yeni kayıt yok, toplam değişmez.
    const secondPass = applyAchievements(firstPass);
    expect(secondPass.totalXp).toBe(5);
    expect(secondPass.xpEvents).toHaveLength(1);

    // Aynı görev iki kez talep edilir → ikinci XP yazılmaz.
    const questAction = {
      type: 'GRANT_XP', xp: 50, source: 'quest', sourceId: 'quest:c_short_movie', label: 'Kompakt Kurgu',
    } as any;
    const withQuest = rootReducer(secondPass, questAction);
    const withQuestAgain = rootReducer(withQuest, questAction);
    expect(withQuest.totalXp).toBe(55);
    expect(withQuestAgain.totalXp).toBe(55);
  });

  test('V2 kaydı (1855 XP) göç eder: bonusXp/xpBaseline kaldırılır, toplam korunur', () => {
    const legacy = {
      ...baseState(),
      totalXp: 1855,
      xp: 55,
      level: 9,
      bonusXp: 505,
      xpBaseline: 0,
      xpEvents: undefined,
    } as any;

    const migrated = rootReducer(legacy, { type: 'FORCE_XP_SYNC' } as any);
    expect(migrated.totalXp).toBe(1855);
    expect(migrated.level).toBe(levelFromXp(1855).level);
    expect(migrated.xpEvents).toHaveLength(1);
    expect(migrated.xpEvents![0].source).toBe('legacy');
    expect(migrated.xpEvents![0].amount).toBe(1855);
    expect('bonusXp' in migrated).toBe(false);
    expect('xpBaseline' in migrated).toBe(false);

    // İkinci göç çağrısı toplamı şişirmez.
    const again = rootReducer(migrated, { type: 'FORCE_XP_SYNC' } as any);
    expect(again.totalXp).toBe(1855);
    expect(again.xpEvents).toHaveLength(1);
  });

  test('REPLACE_FROM_CLOUD_STORAGE defteri korur ve totalXp yeniden hesaplar', () => {
    // Bulut kaydı: V2 toplamı tek seferlik `legacy` kaydına çevrilmiş kanonik görünüm.
    const cloud = {
      ...baseState(),
      totalXp: 1850,
      xpEvents: [makeXpEvent({ source: 'legacy', sourceId: 'migration-v3', base: 1850 })],
    } as any;

    expect(cloud.totalXp).toBe(1850);
    expect(cloud.xpEvents).toHaveLength(1);

    const local = { ...baseState(), totalXp: 95 } as any;
    const next = rootReducer(local, { type: 'REPLACE_FROM_CLOUD_STORAGE', data: cloud } as any);
    expect(next.totalXp).toBe(1850);
    expect(next.xpEvents).toHaveLength(1);
    expect(sumXpEvents(next.xpEvents)).toBe(1850);
    expect('xpBaseline' in next).toBe(false);
  });

  test('art arda iki bulut indirmesi defteri takip eder (eski toplamda takılmaz)', () => {
    // Gerçek köprü: kanonik V3 kaydı → redüktör görünümü (toLegacyCoreView).
    const cloud1850 = toLegacyCoreView(migrateLegacyToV3({
      core: { ...baseState(), movies: [], totalXp: 1850, level: 20 } as any,
      quests: {},
      updatedAt: '2026-01-01T00:00:00.000Z',
      cloudTotalXp: 1850,
    })) as unknown as ExtendedAppData;

    const afterFirst = rootReducer(baseState(), {
      type: 'REPLACE_FROM_CLOUD_STORAGE', data: cloud1850,
    } as any);
    expect(afterFirst.totalXp).toBe(1850);
    expect(afterFirst.xpEvents?.[0].source).toBe('legacy');

    // İkinci (daha yeni) bulut kaydı: defter köprüden aynen geçmeli, toplam 2000 olmalı.
    const cloud2000 = toLegacyCoreView(migrateLegacyToV3({
      core: { ...baseState(), movies: [], totalXp: 2000, level: 21 } as any,
      quests: {},
      updatedAt: '2026-02-01T00:00:00.000Z',
      cloudTotalXp: 2000,
    })) as unknown as ExtendedAppData;

    expect((cloud2000 as any).xpEvents).toHaveLength(1);

    const afterSecond = rootReducer(afterFirst, {
      type: 'REPLACE_FROM_CLOUD_STORAGE', data: cloud2000,
    } as any);
    expect(afterSecond.totalXp).toBe(2000);
    expect(sumXpEvents(afterSecond.xpEvents)).toBe(2000);
    expect(afterSecond.level).toBe(levelFromXp(2000).level);
  });

  test('HYDRATE_FROM_IDB defteri birleştirir (kayıp yok, çift sayım yok)', () => {
    const base = baseState();
    const withLocal = rootReducer(base, {
      type: 'GRANT_XP', xp: 100, source: 'system', sourceId: 'system:local', label: 'Yerel',
    } as any);

    const hydrateData = {
      ...baseState(),
      xpEvents: [
        makeXpEvent({ source: 'achievement', sourceId: 'ach:movie_add:bronze', base: 5 }),
      ],
    } as any;

    const hydrated = rootReducer(withLocal, { type: 'HYDRATE_FROM_IDB', data: hydrateData } as any);
    expect(hydrated.xpEvents).toHaveLength(2);
    expect(hydrated.totalXp).toBe(105);
    expect(sumXpEvents(hydrated.xpEvents)).toBe(105);
  });

  test('CONSUME_NEXT_TOAST XP kaynağını pendingXpGain’e taşır (overlay etiketi)', () => {
    const state = baseState();
    state.pendingToasts = [
      { achievementId: 'movie_add', tier: 'bronze', xp: 5, name: 'Acemi Sinefil', icon: 'Film', description: 'x' } as any,
    ];
    const next = rootReducer(state, { type: 'CONSUME_NEXT_TOAST' } as any);
    expect(next.pendingXpGain).toMatchObject({
      gained: 5,
      source: 'achievement',
      label: 'Acemi Sinefil',
    });
  });
});
