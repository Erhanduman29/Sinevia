import type { ContractRarity } from './contracts';

export type MarketItemKind = 'frame' | 'title' | 'badge' | 'collectible' | 'utility';
export type UtilityEffect =
  | 'streak_shield'
  | 'contract_reroll'
  | 'double_reward'
  | 'market_coupon';

export interface MarketItemDef {
  id: string;
  name: string;
  description: string;
  kind: MarketItemKind;
  rarity: ContractRarity;
  price: number;
  icon: string;
  frameClass?: string;
  titleText?: string;
  badgeText?: string;
  effect?: UtilityEffect;
  consumable?: boolean;
}

export const MARKET_ITEMS: MarketItemDef[] = [
  // Profil çerçeveleri
  {
    id: 'frame_silver',
    name: 'Gümüş Perde',
    description: 'Profilinin etrafında sade, gümüş bir ışık halkası.',
    kind: 'frame',
    rarity: 'common',
    price: 350,
    icon: '💿',
    frameClass: 'ring-2 ring-slate-200/90 ring-offset-2 ring-offset-ink-950 shadow-[0_0_16px_rgba(226,232,240,0.3)]',
  },
  {
    id: 'frame_gold',
    name: 'Altın Makara',
    description: 'Klasik sinema salonlarından ilham alan altın çerçeve.',
    kind: 'frame',
    rarity: 'rare',
    price: 900,
    icon: '⚜️',
    frameClass: 'ring-2 ring-gold-400/90 ring-offset-2 ring-offset-ink-950 shadow-[0_0_20px_rgba(245,158,11,0.45)]',
  },
  {
    id: 'frame_neon',
    name: 'Neon Vizör',
    description: 'Gece seanslarının elektrikli mor halkası.',
    kind: 'frame',
    rarity: 'epic',
    price: 2200,
    icon: '🔮',
    frameClass: 'ring-[3px] ring-violet-400/90 ring-offset-2 ring-offset-ink-950 shadow-[0_0_24px_rgba(139,92,246,0.6)]',
  },
  {
    id: 'frame_crimson',
    name: 'Kızıl Kadraj',
    description: 'Gerilim ve korku maratonları için kan kırmızısı çerçeve.',
    kind: 'frame',
    rarity: 'epic',
    price: 2600,
    icon: '🩸',
    frameClass: 'ring-[3px] ring-rose-500/90 ring-offset-2 ring-offset-ink-950 shadow-[0_0_24px_rgba(244,63,94,0.55)]',
  },
  {
    id: 'frame_cosmic',
    name: 'Kozmik Projeksiyon',
    description: 'Yıldızlararası bir projeksiyonun efsanevi halkası.',
    kind: 'frame',
    rarity: 'legendary',
    price: 5500,
    icon: '🪐',
    frameClass: 'ring-[3px] ring-cyan-300/95 ring-offset-2 ring-offset-ink-950 shadow-[0_0_28px_rgba(34,211,238,0.65)]',
  },

  // Unvanlar
  {
    id: 'title_nightowl',
    name: 'Gece Kuşu',
    description: 'Profilinde "Gece Kuşu" unvanını taşı.',
    kind: 'title',
    rarity: 'common',
    price: 400,
    icon: '🌙',
    titleText: 'Gece Kuşu',
  },
  {
    id: 'title_salon',
    name: 'Salon Efsanesi',
    description: 'Profilinde "Salon Efsanesi" unvanını taşı.',
    kind: 'title',
    rarity: 'rare',
    price: 1100,
    icon: '🏛️',
    titleText: 'Salon Efsanesi',
  },
  {
    id: 'title_culture',
    name: 'Kültür Avcısı',
    description: 'Profilinde "Kültür Avcısı" unvanını taşı.',
    kind: 'title',
    rarity: 'epic',
    price: 2400,
    icon: '🧭',
    titleText: 'Kültür Avcısı',
  },
  {
    id: 'title_sovereign',
    name: 'Perde Hükümdarı',
    description: 'Profilinde "Perde Hükümdarı" unvanını taşı.',
    kind: 'title',
    rarity: 'legendary',
    price: 6000,
    icon: '👑',
    titleText: 'Perde Hükümdarı',
  },

  // Rozetler
  {
    id: 'badge_popcorn',
    name: 'Patlamış Mısır',
    description: 'Profilinde patlamış mısır rozetini göster.',
    kind: 'badge',
    rarity: 'common',
    price: 300,
    icon: '🍿',
    badgeText: '🍿',
  },
  {
    id: 'badge_director',
    name: 'Yönetmen Koltuğu',
    description: 'Profilinde yönetmen koltuğu rozetini göster.',
    kind: 'badge',
    rarity: 'rare',
    price: 950,
    icon: '🎬',
    badgeText: '🎬',
  },
  {
    id: 'badge_goldenticket',
    name: 'Altın Bilet',
    description: 'Profilinde altın bilet rozetini göster.',
    kind: 'badge',
    rarity: 'legendary',
    price: 5000,
    icon: '🎫',
    badgeText: '🎫',
  },

  // Koleksiyon kartları
  {
    id: 'card_first_screening',
    name: 'İlk Gösterim',
    description: 'Koleksiyon kartı: sinemanın ilk ışıkları.',
    kind: 'collectible',
    rarity: 'common',
    price: 500,
    icon: '📽️',
  },
  {
    id: 'card_silent_era',
    name: 'Sessiz Dönem',
    description: 'Koleksiyon kartı: sessiz sinemanın altın çağı.',
    kind: 'collectible',
    rarity: 'rare',
    price: 900,
    icon: '🎭',
  },
  {
    id: 'card_new_wave',
    name: 'Yeni Dalga',
    description: 'Koleksiyon kartı: kuralları yeniden yazan sinemacılar.',
    kind: 'collectible',
    rarity: 'epic',
    price: 1600,
    icon: '🌊',
  },
  {
    id: 'card_blockbuster',
    name: 'Blockbuster',
    description: 'Koleksiyon kartı: büyük perdenin büyük gişeleri.',
    kind: 'collectible',
    rarity: 'epic',
    price: 3200,
    icon: '☄️',
  },
  {
    id: 'card_cult',
    name: 'Kült Klasik',
    description: 'Koleksiyon kartı: yıllar geçse de unutulmayanlar.',
    kind: 'collectible',
    rarity: 'legendary',
    price: 7500,
    icon: '💎',
  },

  // İşlevsel
  {
    id: 'util_streak_shield',
    name: 'Seri Kalkanı',
    description: 'Bir günlük izleme serisini bir günlük boşluğa karşı korur.',
    kind: 'utility',
    rarity: 'rare',
    price: 900,
    icon: '🛡️',
    effect: 'streak_shield',
    consumable: true,
  },
  {
    id: 'util_contract_reroll',
    name: 'Görev Jetonu',
    description: 'Pazardaki günlük ve haftalık görev vitrinini yeniden karıştırır.',
    kind: 'utility',
    rarity: 'common',
    price: 350,
    icon: '🎲',
    effect: 'contract_reroll',
    consumable: true,
  },
  {
    id: 'util_double_reward',
    name: 'Çifte Kazanç',
    description: 'Tamamlanacak bir sonraki görevin coin ödülünü ikiye katlar.',
    kind: 'utility',
    rarity: 'rare',
    price: 650,
    icon: '⚡',
    effect: 'double_reward',
    consumable: true,
  },
  {
    id: 'util_market_coupon',
    name: 'Pazar Kuponu',
    description: 'Bir sonraki alışverişinde %20 indirim uygular.',
    kind: 'utility',
    rarity: 'rare',
    price: 550,
    icon: '🏷️',
    effect: 'market_coupon',
    consumable: true,
  },
];

export const MARKET_ITEM_MAP = new Map(MARKET_ITEMS.map((item) => [item.id, item]));

export function getMarketItem(itemId: string): MarketItemDef | undefined {
  return MARKET_ITEM_MAP.get(itemId);
}

export function isCosmetic(kind: MarketItemKind): boolean {
  return kind === 'frame' || kind === 'title' || kind === 'badge' || kind === 'collectible';
}

export const XP_CONVERSION_RATE = 2;