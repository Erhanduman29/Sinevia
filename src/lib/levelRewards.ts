import type { MarketItemDef } from './marketItems';

/**
 * Seviye kilometre taşlarında verilen, pazarda satılmayan özel ödüller.
 * Fiyat 0'dır; amaç koleksiyon ve prestijdir.
 */
export const MILESTONE_LEVELS = [5, 20, 50, 75, 100] as const;

const BASE_MILESTONES: Record<number, Omit<MarketItemDef, 'price' | 'oneTime'>> = {
  5: {
    id: 'milestone_badge_first_reel',
    name: 'İlk Makara',
    description: 'Sinevia yolculuğunun ilk kilometre taşı.',
    kind: 'badge',
    rarity: 'rare',
    icon: '🎞️',
    badgeText: 'İLK MAKARA',
  },
  20: {
    id: 'milestone_title_projector',
    name: 'Projeksiyoncu',
    description: 'Karanlık salonda ışığı ilk yakan kişi.',
    kind: 'title',
    rarity: 'epic',
    icon: '📽️',
    titleText: 'Projeksiyoncu',
  },
  50: {
    id: 'milestone_frame_gold_reel',
    name: 'Sinevia Altın Makarası',
    description: 'Elli seviyenin emeğini taşıyan özel altın çerçeve.',
    kind: 'frame',
    rarity: 'legendary',
    icon: '🏆',
    frameClass:
      'ring-[3px] ring-gold-300 ring-offset-2 ring-offset-ink-950 shadow-[0_0_30px_rgba(252,211,77,0.7)]',
  },
  75: {
    id: 'milestone_name_cinematic',
    name: 'Sinematik',
    description: 'İsminin yanında altın bir sinema ışığı parlar.',
    kind: 'nameEffect',
    rarity: 'legendary',
    icon: '✨',
    nameEffectClass:
      'bg-gradient-to-r from-gold-200 via-amber-300 to-gold-500 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(252,211,77,0.55)]',
  },
  100: {
    id: 'milestone_badge_sinevia_legend',
    name: 'Sinevia Efsanesi',
    description: 'Yüz seviyeye ulaşan gerçek bir Sinevia efsanesi.',
    kind: 'badge',
    rarity: 'mythic',
    icon: '👑',
    badgeText: 'SINEVIA EFSANESİ',
  },
};

export function isMilestoneLevel(level: number): boolean {
  return (
    level === 5 ||
    level === 20 ||
    level === 50 ||
    level === 75 ||
    level === 100 ||
    (level > 100 && level % 25 === 0)
  );
}

export function milestoneItemForLevel(level: number): MarketItemDef | null {
  const base = BASE_MILESTONES[level];
  if (base) return { ...base, price: 0, oneTime: true };

  if (level > 100 && level % 25 === 0) {
    return {
      id: `milestone_prestige_${level}`,
      name: `Prestij ${level}`,
      description: `${level}. seviyeye ulaşanlara özel prestij rozeti.`,
      kind: 'badge',
      rarity: 'mythic',
      price: 0,
      icon: '💠',
      badgeText: `PRESTİJ ${level}`,
      oneTime: true,
    };
  }

  return null;
}

export function milestoneItemForId(itemId: string): MarketItemDef | null {
  const match = /^milestone_prestige_(\d+)$/.exec(itemId);
  if (match) return milestoneItemForLevel(Number(match[1]));
  return Object.values(BASE_MILESTONES).find((item) => item.id === itemId)
    ? { ...(Object.values(BASE_MILESTONES).find((item) => item.id === itemId) as Omit<MarketItemDef, 'price' | 'oneTime'>), price: 0, oneTime: true }
    : null;
}

/** Envanterde gösterilebilmesi için 1000. seviyeye kadar prestij ödülleri. */
export const MILESTONE_ITEMS: MarketItemDef[] = (() => {
  const levels: number[] = [...MILESTONE_LEVELS];
  for (let level = 125; level <= 1000; level += 25) levels.push(level);
  return levels
    .map((level) => milestoneItemForLevel(level))
    .filter((item): item is MarketItemDef => item !== null);
})();
