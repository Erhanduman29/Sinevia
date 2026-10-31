import type { ContractRarity } from './contracts';
import { MILESTONE_ITEMS, milestoneItemForId } from './levelRewards';

export type MarketItemKind =
  | 'frame'
  | 'title'
  | 'badge'
  | 'collectible'
  | 'utility'
  | 'background'
  | 'nameEffect'
  | 'perk';

export type UtilityEffect =
  | 'streak_shield'
  | 'contract_reroll'
  | 'double_reward'
  | 'market_coupon'
  | 'contract_extension'
  | 'penalty_waiver'
  | 'single_reroll'
  | 'selective_reroll'
  | 'contract_pin'
  | 'xp_boost'
  | 'contract_insurance'
  | 'streak_freeze'
  | 'collectible_unlock'
  | 'discovery_ticket'
  | 'daily_ink';

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
  backgroundClass?: string;
  nameEffectClass?: string;
  /** Haftalık satın alma sınırı (tüketilebilir itemler). */
  weeklyLimit?: number;
  /** Bir kez alınır; envanterdeyken Tükendi görünür. */
  oneTime?: boolean;
  /** Kalıcı gelişim iteminin açtığı avantaj. */
  perk?: string;
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
    weeklyLimit: 2,
    consumable: true,
  },
  {
    id: 'util_contract_reroll',
    name: 'Görev Jetonu',
    description: 'Günlük ve haftalık görevleri yeniden karıştırır.',
    kind: 'utility',
    rarity: 'common',
    price: 350,
    icon: '🎲',
    effect: 'contract_reroll',
    weeklyLimit: 5,
    consumable: true,
  },
  {
    id: 'util_double_reward',
    name: 'Çifte Kazanç',
    description: 'Tamamlanacak bir sonraki görevin coin iadesini ikiye katlar ve XP ödülünü %10 artırır.',
    kind: 'utility',
    rarity: 'rare',
    price: 300,
    icon: '⚡',
    effect: 'double_reward',
    weeklyLimit: 3,
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
    weeklyLimit: 3,
    consumable: true,
  },
  {
    id: 'util_contract_extension',
    name: 'Süre Uzatma Kalkanı',
    description: 'Aktif görevin süresini günlükte +24 saat, haftalıkta +72 saat uzatır.',
    kind: 'utility',
    rarity: 'rare',
    price: 250,
    icon: '⏳',
    effect: 'contract_extension',
    weeklyLimit: 3,
    consumable: true,
  },
  {
    id: 'util_penalty_waiver',
    name: 'Ceza Affı',
    description: 'Bir sonraki başarısız görevin cezasını tamamen iptal eder.',
    kind: 'utility',
    rarity: 'epic',
    price: 200,
    icon: '🕊️',
    effect: 'penalty_waiver',
    weeklyLimit: 2,
    consumable: true,
  },
  {
    id: 'util_single_reroll',
    name: 'Tek Görev Jetonu',
    description: 'Yalnızca günlük görev panosunu yeniden karıştırır.',
    kind: 'utility',
    rarity: 'common',
    price: 150,
    icon: '🎯',
    effect: 'single_reroll',
    weeklyLimit: 5,
    consumable: true,
  },
  {
    id: 'util_selective_reroll',
    name: 'Seçmeli Rulo',
    description: 'Yalnızca haftalık görev panosunu yeniden karıştırır.',
    kind: 'utility',
    rarity: 'epic',
    price: 200,
    icon: '🎰',
    effect: 'selective_reroll',
    weeklyLimit: 2,
    consumable: true,
  },
  {
    id: 'util_contract_pin',
    name: 'Görev Sabitleyici',
    description: 'Gelecek hafta en yüksek nadirlikteki görevi sabitler; o görev ücretsiz başlatılır.',
    kind: 'utility',
    rarity: 'legendary',
    price: 1000,
    icon: '📌',
    effect: 'contract_pin',
    weeklyLimit: 1,
    consumable: true,
  },
  {
    id: 'util_xp_boost',
    name: 'XP Katlayıcı',
    description: 'Bir sonraki tamamlanan görevin XP ödülünü %50 artırır.',
    kind: 'utility',
    rarity: 'rare',
    price: 400,
    icon: '🔷',
    effect: 'xp_boost',
    weeklyLimit: 3,
    consumable: true,
  },
  {
    id: 'util_contract_insurance',
    name: 'Haftalık Sigorta',
    description: 'Başarısız olan görevin ücretinin %50’sini iade eder.',
    kind: 'utility',
    rarity: 'epic',
    price: 700,
    icon: '🧾',
    effect: 'contract_insurance',
    weeklyLimit: 2,
    consumable: true,
  },
  {
    id: 'util_streak_freeze',
    name: 'Seri Dondurucu',
    description: 'Bir sonraki seri boşluğunu 7 güne kadar tolere eder.',
    kind: 'utility',
    rarity: 'legendary',
    price: 1800,
    icon: '❄️',
    effect: 'streak_freeze',
    weeklyLimit: 1,
    consumable: true,
  },
  {
    id: 'util_collectible_unlock',
    name: 'Koleksiyon Tamamlama Bileti',
    description: 'Envanterinde olmayan rastgele bir koleksiyon kartı verir.',
    kind: 'utility',
    rarity: 'legendary',
    price: 4000,
    icon: '🗂️',
    effect: 'collectible_unlock',
    weeklyLimit: 1,
    consumable: true,
  },
  {
    id: 'util_discovery_ticket',
    name: 'Keşif Bileti',
    description: 'İzlemediğin yüksek puanlı bir film önerir ve 200 XP verir.',
    kind: 'utility',
    rarity: 'rare',
    price: 350,
    icon: '🧭',
    effect: 'discovery_ticket',
    weeklyLimit: 3,
    consumable: true,
  },
  {
    id: 'util_daily_ink',
    name: 'Günlük Mürekkep',
    description: 'Günlük kayıt defterine 100 XP ekler.',
    kind: 'utility',
    rarity: 'common',
    price: 150,
    icon: '🖋️',
    effect: 'daily_ink',
    weeklyLimit: 5,
    consumable: true,
  },

  // Kalıcı gelişim
  {
    id: 'perk_showcase_slot_a',
    name: 'Vitrin Yuvası I',
    description: 'Profil vitrinine kalıcı olarak +1 yuva ekler (4 → 5).',
    kind: 'perk',
    rarity: 'epic',
    price: 3000,
    icon: '🖼️',
    perk: 'showcase_slot_1',
    oneTime: true,
  },
  {
    id: 'perk_showcase_slot_b',
    name: 'Vitrin Yuvası II',
    description: 'Profil vitrinine kalıcı olarak +1 yuva daha ekler (5 → 6).',
    kind: 'perk',
    rarity: 'epic',
    price: 4500,
    icon: '🖼️',
    perk: 'showcase_slot_2',
    oneTime: true,
  },
  {
    id: 'perk_badge_slot',
    name: 'Rozet Yuvası',
    description: 'Profilinde ikinci bir rozet gösterme hakkı açar.',
    kind: 'perk',
    rarity: 'legendary',
    price: 6000,
    icon: '🎖️',
    perk: 'badge_slot',
    oneTime: true,
  },
  {
    id: 'perk_contract_slot',
    name: 'Görev Yuvası',
    description: 'Günlük görev panosuna ücretsiz olarak başlatılabilen +1 görev ekler.',
    kind: 'perk',
    rarity: 'mythic',
    price: 7000,
    icon: '🧩',
    perk: 'contract_slot',
    oneTime: true,
  },

  // Profil arka planları
  {
    id: 'bg_cinema_red',
    name: 'Kızıl Perde',
    description: 'Profilinin arkasında klasik sinema salonu kırmızısı.',
    kind: 'background',
    rarity: 'rare',
    price: 1200,
    icon: '🎭',
    backgroundClass: 'bg-gradient-to-br from-rose-950/90 via-ink-950 to-ink-950',
    oneTime: true,
  },
  {
    id: 'bg_neon_city',
    name: 'Neon Şehir',
    description: 'Gece seanslarının mor ve fuşya neon ışıkları.',
    kind: 'background',
    rarity: 'epic',
    price: 3200,
    icon: '🌆',
    backgroundClass: 'bg-gradient-to-br from-violet-950/80 via-fuchsia-950/30 to-ink-950',
    oneTime: true,
  },
  {
    id: 'bg_starfield',
    name: 'Yıldız Alanı',
    description: 'Derin uzayda süzülen sinematik bir yıldız örtüsü.',
    kind: 'background',
    rarity: 'legendary',
    price: 7500,
    icon: '🌌',
    backgroundClass: 'bg-gradient-to-br from-azure-500/20 via-ink-950 to-black',
    oneTime: true,
  },

  // İsim efektleri
  {
    id: 'name_gold',
    name: 'Altın İsim',
    description: 'Kullanıcı adını altın renginde parlatır.',
    kind: 'nameEffect',
    rarity: 'epic',
    price: 2500,
    icon: '✨',
    nameEffectClass: 'text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.65)]',
    oneTime: true,
  },
  {
    id: 'name_aurora',
    name: 'Kutup Işığı İsmi',
    description: 'Kullanıcı adında akan yeşil-mor aurora efekti.',
    kind: 'nameEffect',
    rarity: 'legendary',
    price: 6000,
    icon: '🌈',
    nameEffectClass:
      'bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(56,189,248,0.35)]',
    oneTime: true,
  },
];

/** Sezonluk, yalnızca kozmetik lüks coin hedefleri. */
export const SEASONAL_ITEMS: MarketItemDef[] = [
  {
    id: 'seasonal_frame_gilded_reel',
    name: 'Yaldızlı Makara',
    description: 'Sezonun en prestijli altın çerçevesi.',
    kind: 'frame',
    rarity: 'legendary',
    price: 8000,
    icon: '🎬',
    frameClass:
      'ring-[4px] ring-gold-300 ring-offset-[3px] ring-offset-ink-950 shadow-[0_0_40px_rgba(252,211,77,0.8)]',
    oneTime: true,
  },
  {
    id: 'seasonal_bg_eternal_cinema',
    name: 'Ebedi Sinema',
    description: 'Işıkları hiç sönmeyen, yıldızlarla çevrili ebedi salon.',
    kind: 'background',
    rarity: 'mythic',
    price: 12000,
    icon: '🌠',
    backgroundClass:
      'bg-[radial-gradient(circle_at_20%_10%,rgba(251,191,36,0.3),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(139,92,246,0.35),transparent_45%),linear-gradient(160deg,#09090b,#1c1917)]',
    oneTime: true,
  },
  {
    id: 'seasonal_title_sinevia_architect',
    name: 'Sinevia Mimarı',
    description: 'Sinevia evrenini şekillendirenler için sezonluk unvan.',
    kind: 'title',
    rarity: 'mythic',
    price: 15000,
    icon: '🏛️',
    titleText: 'SINEVIA MİMARI',
    oneTime: true,
  },
];

export const ALL_MARKET_ITEMS: MarketItemDef[] = [
  ...MARKET_ITEMS,
  ...SEASONAL_ITEMS,
  ...MILESTONE_ITEMS,
];

export const MARKET_ITEM_MAP = new Map(ALL_MARKET_ITEMS.map((item) => [item.id, item]));

export function getMarketItem(itemId: string): MarketItemDef | undefined {
  return MARKET_ITEM_MAP.get(itemId) ?? milestoneItemForId(itemId) ?? undefined;
}

export function isCosmetic(kind: MarketItemKind): boolean {
  return (
    kind === 'frame' ||
    kind === 'title' ||
    kind === 'badge' ||
    kind === 'collectible' ||
    kind === 'background' ||
    kind === 'nameEffect'
  );
}

export function isPermanentItem(kind: MarketItemKind): boolean {
  return isCosmetic(kind) || kind === 'perk';
}

export function showcaseLimit(perks?: string[] | null): number {
  const extra =
    (perks?.includes('showcase_slot_1') ? 1 : 0) + (perks?.includes('showcase_slot_2') ? 1 : 0);
  return 4 + extra;
}