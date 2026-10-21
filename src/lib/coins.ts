import type { AppData, CoinTx } from '../types';
import { ACHIEVEMENT_DEFS } from './achievements';
import { QUEST_DEFS } from './quests';

export const WELCOME_BONUS = 150;

/** Başarım tier'ı başına SineCoin ödülü. */
export const TIER_COIN_REWARDS: Record<string, number> = {
  bronze: 10,
  silver: 20,
  gold: 50,
  platinum: 120,
  emerald: 300,
  diamond: 700,
};

/** Koleksiyon görevleri için nadirliğe göre coin ödülü. */
export const LIFETIME_QUEST_COINS: Record<string, number> = {
  common: 20,
  rare: 40,
  epic: 80,
  legendary: 200,
  mythic: 500,
};

export const QUEST_STORAGE_KEY = 'sinevia-quests-v1';

export function formatCoins(amount: number): string {
  return new Intl.NumberFormat('tr-TR').format(Math.max(0, Math.round(amount)));
}

export function coinBalance(data: Pick<AppData, 'coins' | 'coinLedger'>): number {
  if (Array.isArray(data.coinLedger)) {
    return data.coinLedger.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  }
  return Number(data.coins) || 0;
}

function makeTx(
  refId: string,
  amount: number,
  kind: CoinTx['kind'],
  label: string,
  itemId?: string,
): CoinTx {
  return {
    id: refId,
    refId,
    amount,
    kind,
    label,
    itemId,
    createdAt: new Date().toISOString(),
  };
}

export function hasCoinTx(ledger: CoinTx[] | undefined, refId: string): boolean {
  return !!ledger?.some((tx) => tx.refId === refId || tx.id === refId);
}

/** Ledger'a tek seferlik işlem ekler (aynı refId ikinci kez yazılmaz). */
export function appendCoinTx<T extends AppData>(data: T, tx: CoinTx): T {
  const ledger = Array.isArray(data.coinLedger) ? data.coinLedger : [];
  if (hasCoinTx(ledger, tx.refId)) return data;
  const nextLedger = [tx, ...ledger];
  return {
    ...data,
    coinLedger: nextLedger,
    coins: nextLedger.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
  };
}

/**
 * Başarımlar + tamamlanmış koleksiyon görevleri için eksik coin kayıtlarını
 * oluşturur. Eski hesapların geriye dönük kazanımı da buradan gelir.
 * Idempotenttir: her açılışta çalışsa bile aynı ödül iki kez yazılmaz.
 */
export function syncCoinLedger<T extends AppData>(state: T): T {
  let ledger: CoinTx[] = Array.isArray(state.coinLedger) ? [...state.coinLedger] : [];
  const seen = new Set(ledger.map((tx) => tx.refId));

  const push = (refId: string, amount: number, kind: CoinTx['kind'], label: string) => {
    if (seen.has(refId) || amount <= 0) return;
    seen.add(refId);
    ledger = [makeTx(refId, amount, kind, label), ...ledger];
  };

  push('welcome', WELCOME_BONUS, 'welcome', 'Sinevia Pazarı hoş geldin hediyesi');

  const progressMap = new Map((state.achievements || []).map((p) => [p.achievementId, p]));
  for (const def of ACHIEVEMENT_DEFS) {
    const progress = progressMap.get(def.id);
    if (!progress) continue;
    for (const tierName of progress.unlockedTiers || []) {
      const amount = TIER_COIN_REWARDS[tierName] || 0;
      const tierDef = def.tiers.find((t) => t.tier === tierName);
      push(
        `ach:${def.id}:${tierName}`,
        amount,
        'achievement',
        `${def.name}${tierDef?.name ? ` — ${tierDef.name}` : ''}`,
      );
    }
  }

  try {
    const raw = localStorage.getItem(QUEST_STORAGE_KEY);
    if (raw) {
      const questState = JSON.parse(raw) as { completedQuests?: string[] };
      const completed = new Set(questState.completedQuests || []);
      for (const def of QUEST_DEFS) {
        if (!completed.has(def.id)) continue;
        push(
          `quest:${def.id}`,
          LIFETIME_QUEST_COINS[def.rarity] || 20,
          'lifetime_quest',
          `Görev: ${def.title}`,
        );
      }
    }
  } catch {
    /* localStorage erişilemezse koleksiyon coinleri sonraki açılışta eklenir */
  }

  const coins = ledger.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  if (ledger.length === (state.coinLedger || []).length && coins === state.coins) return state;
  return { ...state, coinLedger: ledger, coins };
}

export function grantCoins<T extends AppData>(
  data: T,
  amount: number,
  kind: CoinTx['kind'],
  label: string,
  refId: string,
  itemId?: string,
): T {
  return appendCoinTx(data, makeTx(refId, amount, kind, label, itemId));
}

/** Seviye atlama ödülü — düşük seviyelerde mütevazı, yüksek seviyelerde artan. */
export function levelCoinReward(level: number): number {
  if (level < 2) return 0;
  return Math.min(120, 15 + (level - 2) * 5);
}

/** Eski ve yeni seviye arasındaki her kademe için coin yazar (ledger idempotent). */
export function awardLevelCoins<T extends AppData>(state: T, oldLevel: number, newLevel: number): T {
  let next = state;
  for (let level = oldLevel + 1; level <= newLevel; level += 1) {
    next = grantCoins(next, levelCoinReward(level), 'bonus', `Seviye ${level} ödülü`, `level:${level}`);
  }
  return next;
}

/**
 * Henüz ledger'a yazılmamış seviye ödüllerinin toplamı. Aynı seviye aralığı
 * birden fazla akışta (başarım reveal'ı, pazar görevi, XP kazanımı) işlense de
 * coin animasyonunda mükerrer tutar gösterilmesini engeller.
 */
export function pendingLevelCoinTotal(
  state: Pick<AppData, 'coinLedger'>,
  oldLevel: number,
  newLevel: number,
): number {
  let total = 0;
  for (let level = oldLevel + 1; level <= newLevel; level += 1) {
    if (!hasCoinTx(state.coinLedger, `level:${level}`)) total += levelCoinReward(level);
  }
  return total;
}

export function inventoryQuantity(data: AppData, itemId: string): number {
  const entry = (data.inventory || []).find((item) => item.itemId === itemId);
  return entry?.quantity || 0;
}

export function addInventoryItem<T extends AppData>(data: T, itemId: string, quantity = 1): T {
  const inventory = [...(data.inventory || [])];
  const index = inventory.findIndex((item) => item.itemId === itemId);
  if (index >= 0) {
    inventory[index] = { ...inventory[index], quantity: inventory[index].quantity + quantity };
  } else {
    inventory.push({ itemId, quantity, acquiredAt: new Date().toISOString() });
  }
  return { ...data, inventory };
}

export function removeInventoryItem<T extends AppData>(data: T, itemId: string, quantity = 1): T {
  const inventory = (data.inventory || [])
    .map((item) => (item.itemId === itemId ? { ...item, quantity: item.quantity - quantity } : item))
    .filter((item) => item.quantity > 0);
  return { ...data, inventory };
}

export function activeEffectCharges(data: AppData, itemId: string): number {
  return (data.activeEffects || [])
    .filter((effect) => effect.itemId === itemId)
    .reduce((sum, effect) => sum + (effect.charges || 1), 0);
}

export function addEffectCharge<T extends AppData>(data: T, itemId: string): T {
  const activeEffects = [...(data.activeEffects || [])];
  const index = activeEffects.findIndex((effect) => effect.itemId === itemId);
  if (index >= 0) {
    activeEffects[index] = {
      ...activeEffects[index],
      charges: (activeEffects[index].charges || 1) + 1,
    };
  } else {
    activeEffects.push({ itemId, charges: 1 });
  }
  return { ...data, activeEffects };
}

export function consumeEffectCharge<T extends AppData>(data: T, itemId: string): T {
  const activeEffects = (data.activeEffects || [])
    .map((effect) =>
      effect.itemId === itemId ? { ...effect, charges: (effect.charges || 1) - 1 } : effect,
    )
    .filter((effect) => (effect.charges || 0) > 0);
  return { ...data, activeEffects };
}
