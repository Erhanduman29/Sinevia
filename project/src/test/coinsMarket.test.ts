import { describe, expect, test } from 'vitest';
import { applyAchievements, rootReducer, type ExtendedAppData } from '../context/AppContext';
import { coinBalance, inventoryQuantity, levelCoinReward, streakDayCoinReward } from '../lib/coins';
import { getMarketOffers, evaluateContractProgress, weekKey } from '../lib/contractLogic';
import {
  CONTRACT_DEFS,
  contractItemId,
  type ContractDef,
} from '../lib/contracts';
import { milestoneItemForLevel } from '../lib/levelRewards';

function base(): ExtendedAppData {
  return {
    movies: [], series: [], removedSeriesTitles: [], collections: [], genres: [],
    reviewTags: [], history: [], achievements: [], criteria: [], xp: 0, level: 1,
    totalXp: 0, lastWatchDate: null, dailyStreak: 0, dailyStreakDate: null,
    theme: 'premium-dark', altWatchTemplate: '', weeklyPlan: [], notificationsEnabled: false,
    coins: 0, coinLedger: [], inventory: [], equipped: {}, activeEffects: [],
    marketRerollNonce: 0, marketIntroSeen: false,
  };
}

describe('SineCoin ekonomisi', () => {
  test('aynı refId ikinci kez coin yazmaz', () => {
    let state = base();
    state = rootReducer(state, {
      type: 'GRANT_COINS', amount: 100, kind: 'bonus', label: 'Test', refId: 'test:1',
    } as any);
    state = rootReducer(state, {
      type: 'GRANT_COINS', amount: 100, kind: 'bonus', label: 'Test', refId: 'test:1',
    } as any);
    expect(coinBalance(state)).toBe(100);
    expect(state.coinLedger).toHaveLength(1);
  });

  test('yetersiz bakiyede satın alma reddedilir', () => {
    let state = base();
    state = rootReducer(state, {
      type: 'PURCHASE_ITEM', itemId: 'frame_test', name: 'Test Çerçeve', price: 500, kind: 'frame',
    } as any);
    expect(inventoryQuantity(state, 'frame_test')).toBe(0);
    expect(coinBalance(state)).toBe(0);
  });

  test('satın alma coin düşer ve envantere ekler', () => {
    let state = base();
    state = rootReducer(state, {
      type: 'GRANT_COINS', amount: 1000, kind: 'bonus', label: 'Test', refId: 'test:2',
    } as any);
    state = rootReducer(state, {
      type: 'PURCHASE_ITEM', itemId: 'frame_test', name: 'Test Çerçeve', price: 400, kind: 'frame',
    } as any);
    expect(coinBalance(state)).toBe(760); // 1000 − 400 + 150 hoş geldin + 10 pazar başarımı
    expect(inventoryQuantity(state, 'frame_test')).toBe(1);
  });

  test('aynı görev aynı hafta içinde ikinci kez satın alınamaz', () => {
    const itemId = contractItemId('d_one_movie');
    let state = base();
    state = rootReducer(state, {
      type: 'GRANT_COINS', amount: 2000, kind: 'bonus', label: 'Test', refId: 'test:contract-buy',
    } as any);
    state = rootReducer(state, {
      type: 'PURCHASE_ITEM', itemId, name: 'Bir Film', price: 100, kind: 'contract',
    } as any);
    const coinsAfterFirst = coinBalance(state);
    expect(inventoryQuantity(state, itemId)).toBe(1);

    state = rootReducer(state, {
      type: 'PURCHASE_ITEM', itemId, name: 'Bir Film', price: 100, kind: 'contract',
    } as any);

    expect(coinBalance(state)).toBe(coinsAfterFirst);
    expect(inventoryQuantity(state, itemId)).toBe(1);
  });

  test('haftalık limiti olan item limit dolunca satın alınamaz', () => {
    let state = base();
    state = rootReducer(state, {
      type: 'GRANT_COINS', amount: 3000, kind: 'bonus', label: 'Test', refId: 'test:limit-buy',
    } as any);

    for (let i = 0; i < 5; i += 1) {
      state = rootReducer(state, {
        type: 'PURCHASE_ITEM',
        itemId: 'util_daily_ink',
        name: 'Günlük Mürekkep',
        price: 150,
        kind: 'utility',
        consumable: true,
      } as any);
    }

    expect(inventoryQuantity(state, 'util_daily_ink')).toBe(5);
    const coinsAfterLimit = coinBalance(state);

    state = rootReducer(state, {
      type: 'PURCHASE_ITEM',
      itemId: 'util_daily_ink',
      name: 'Günlük Mürekkep',
      price: 150,
      kind: 'utility',
      consumable: true,
    } as any);

    expect(inventoryQuantity(state, 'util_daily_ink')).toBe(5);
    expect(coinBalance(state)).toBe(coinsAfterLimit);
  });

  test('görev ödülü XP defterinde kalıcıdır', () => {
    let state = base();
    state = rootReducer(state, {
      type: 'GRANT_CONTRACT_REWARD', xp: 500, coins: 25, refId: 'contract:1', label: 'Test görevi',
    } as any);
    // Tek XP kaynağı defterdir; eski bonusXp alanı yok.
    const contractEvent = state.xpEvents!.find((event) => event.source === 'contract');
    expect(contractEvent?.sourceId).toBe('contract:1');
    expect(contractEvent?.amount).toBe(500);
    expect(state.totalXp).toBe(515); // 500 görev XP + 15 "Taahhüt Ustası" bronz
    expect(coinBalance(state)).toBe(200); // 25 + 150 hoş geldin + 10 başarım + 15 seviye 2 ödülü
    expect(state.pendingLevelUp?.newLevel).toBe(2);
    expect(state.pendingXpGain).toEqual({ gained: 500, oldTotal: 0, newTotal: 500, source: 'contract', label: 'Test görevi' });
    expect(state.pendingCoinGain?.amount).toBe(40); // 25 görev coin + 15 seviye 2 ödülü
  });

  test('üst üste seviye atlayınca tüm seviye coinleri tek animasyonda toplanır', () => {
    let state = base();
    state = rootReducer(state, { type: 'GRANT_XP', xp: 5000 } as any);

    const expected = Array.from({ length: state.level - 1 }, (_, i) => levelCoinReward(i + 2))
      .reduce((sum, amount) => sum + amount, 0);

    expect(state.pendingLevelUp?.newLevel).toBe(2);
    expect(state.pendingLevelUpQueue).toHaveLength(state.level - 2);
    expect(state.pendingCoinGain).toEqual({
      amount: expected,
      label: 'Seviye ödülleri',
      final: true,
    });
    expect(coinBalance(state)).toBe(expected);
  });

  test('süresi dolan haftalık görev coin cezası keser ve gizli başarım açar', () => {
    let state = base();
    state = rootReducer(state, {
      type: 'GRANT_COINS', amount: 200, kind: 'bonus', label: 'Test', refId: 'test:penalty-seed',
    } as any);
    state = rootReducer(state, {
      type: 'RECORD_MARKET_OUTCOME', outcome: 'failed', weekly: true, penalty: 50,
      label: 'Görev cezası: Test', refId: 'contract-fail:test',
    } as any);
    expect(state.marketStats?.contractsFailed).toBe(1);
    expect(state.marketStats?.weeklyContractsFailed).toBe(1);
    expect(state.coinLedger?.some((tx) => tx.kind === 'penalty' && tx.amount === -50)).toBe(true);
    // 200 + 150 hoş geldin − 50 ceza + 10 gizli başarım ödülü
    expect(coinBalance(state)).toBe(310);
    expect(state.achievements.find((a) => a.achievementId === 'weekly_contract_fail')?.unlockedTiers).toContain('bronze');
  });

  test('görev iptali ceza kesmez ama gizli iptal başarımını açar', () => {
    let state = base();
    state = rootReducer(state, {
      type: 'RECORD_MARKET_OUTCOME', outcome: 'cancelled', weekly: false, penalty: 0,
      label: 'Görev iptali: Test', refId: 'contract-cancel:test',
    } as any);
    expect(state.marketStats?.contractsCancelled).toBe(1);
    expect(state.coinLedger?.some((tx) => tx.kind === 'penalty')).toBe(false);
    expect(coinBalance(state)).toBe(160); // 150 + 10 gizli başarım
    expect(state.achievements.find((a) => a.achievementId === 'contract_cancelled')?.unlockedTiers).toContain('bronze');
  });

  test('seviye coin ödülleri 2–98 aralığında 13.071 SC üretir', () => {
    let total = 0;
    for (let level = 2; level <= 98; level += 1) total += levelCoinReward(level);
    expect(total).toBe(13071);
    expect(levelCoinReward(2)).toBe(15);
    expect(levelCoinReward(98)).toBe(255);
    expect(levelCoinReward(105)).toBe(272);
  });

  test('günlük seri coin ödülü eğrisi çapa değerleri karşılar', () => {
    expect(streakDayCoinReward(1)).toBe(1);
    expect(streakDayCoinReward(2)).toBe(2);
    expect(streakDayCoinReward(7)).toBe(10);
    expect(streakDayCoinReward(14)).toBe(20);
    expect(streakDayCoinReward(21)).toBe(30);
    expect(streakDayCoinReward(60)).toBe(30);
  });
});

describe('Yeni ekonomi dengesi', () => {
  test('her kontratın fiyatı XP ödülüne eşittir', () => {
    for (const contract of CONTRACT_DEFS) {
      expect(contract.price).toBe(contract.xpReward);
    }
  });

  test('kontrat coin iadesi %12 ve en az 5 SC', () => {
    for (const contract of CONTRACT_DEFS) {
      expect(contract.coinReward).toBe(Math.max(5, Math.round(contract.price * 0.12)));
    }
  });

  test('kilometre taşı seviyeleri ödül üretir', () => {
    expect(milestoneItemForLevel(5)?.id).toBe('milestone_badge_first_reel');
    expect(milestoneItemForLevel(20)?.id).toBe('milestone_title_projector');
    expect(milestoneItemForLevel(50)?.id).toBe('milestone_frame_gold_reel');
    expect(milestoneItemForLevel(75)?.id).toBe('milestone_name_cinematic');
    expect(milestoneItemForLevel(100)?.id).toBe('milestone_badge_sinevia_legend');
    expect(milestoneItemForLevel(125)?.id).toBe('milestone_prestige_125');
    expect(milestoneItemForLevel(6)).toBeNull();
  });
});

describe('Pazar görevleri', () => {
  test('haftalık teklifler deterministik ve 6+6', () => {
    const a = getMarketOffers('2026-W43', 0);
    const b = getMarketOffers('2026-W43', 0);
    expect(a.daily).toHaveLength(6);
    expect(a.weekly).toHaveLength(6);
    expect(a).toEqual(b);
  });

  test('hafta anahtarı Pazartesi başlar', () => {
    expect(weekKey(new Date(2026, 9, 19))).toBe(weekKey(new Date(2026, 9, 25)));
    expect(weekKey(new Date(2026, 9, 19))).not.toBe(weekKey(new Date(2026, 9, 26)));
  });

  test('film sayısı hedefi geçmişten hesaplanır', () => {
    const def: ContractDef = {
      id: 'test_contract', type: 'daily', title: 'Test', description: 'Test',
      icon: '🎬', rarity: 'common', requirements: [{ metric: 'movies', target: 2 }],
      xpReward: 100, coinReward: 5, price: 50, durationHours: 24,
    };
    const startedAt = Date.now() - 60_000;
    const data = base();
    data.history = [
      { id: '1', kind: 'movie', title: 'A', rating: null, note: '', watchedAt: new Date().toISOString(), genres: ['Dram'] },
      { id: '2', kind: 'movie', title: 'B', rating: null, note: '', watchedAt: new Date().toISOString(), genres: ['Dram'] },
      { id: '3', kind: 'movie', title: 'C', rating: null, note: '', watchedAt: new Date(Date.now() - 120_000).toISOString(), genres: ['Dram'] },
    ];
    const progress = evaluateContractProgress(def, startedAt, data);
    expect(progress.completed).toBe(true);
    expect(progress.percent).toBe(100);
  });
});

describe('Dizi süresi başarımları', () => {
  test('izlenen bölüm süreleri toplamı hesaplanır', () => {
    const state = base();
    state.series = [{
      id: 's1', title: 'Test Dizi', genres: [], addedAt: new Date().toISOString(),
      episodes: [
        { id: 'e1', season: 1, episode: 1, watched: true, rating: null, note: '', watchedAt: new Date().toISOString(), runtime: 60 },
        { id: 'e2', season: 1, episode: 2, watched: true, rating: null, note: '', watchedAt: new Date().toISOString(), runtime: 40 },
      ],
    }] as any;
    const next = applyAchievements(state);
    const progress = next.achievements.find((a) => a.achievementId === 'series_time');
    expect(progress?.current).toBe(100);
  });
});
