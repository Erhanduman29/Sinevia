import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Check,
  Crown,
  History,
  MoreHorizontal,
  Package,
  RefreshCw,
  ScrollText,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Trophy,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useQuests } from '../context/QuestContext';
import { useTutorial } from '../context/TutorialContext';
import CoinPill, { SineCoinIcon } from '../components/CoinPill';
import { ContractArtwork, MarketArtwork } from '../components/MarketArtwork';
import {
  formatCoins,
  inventoryQuantity,
  streakDayCoinReward,
  WEEKLY_ACTIVITY_REQUIRED_DAYS,
  WEEKLY_ACTIVITY_REWARD,
} from '../lib/coins';
import {
  CONTRACT_MAP,
  CONTRACT_RARITY_STYLES,
  CONTRACT_FAILURE_PENALTY,
  METRIC_LABELS,
  contractItemId,
  parseContractItemId,
  type ContractDef,
  type ContractRarity,
} from '../lib/contracts';
import { getMarketOffers, nextWeekStart, weekKey } from '../lib/contractLogic';
import {
  MARKET_ITEMS,
  SEASONAL_ITEMS,
  getMarketItem,
  isCosmetic,
  isPermanentItem,
  type MarketItemDef,
  type MarketItemKind,
} from '../lib/marketItems';
import { localDayKey, todayStr } from '../lib/utils';

type Tab =
  | 'pazar'
  | 'gorevler'
  | 'item'
  | 'kozmetik'
  | 'koleksiyon'
  | 'envanter'
  | 'cuzdan';

interface PurchaseTarget {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  kind: string;
  rarity: ContractRarity;
  contract?: ContractDef;
  item?: MarketItemDef;
}

const TABS: { id: Tab; label: string; icon: typeof ShoppingBag }[] = [
  { id: 'pazar', label: 'Pazar', icon: Store },
  { id: 'gorevler', label: 'Görev', icon: ScrollText },
  { id: 'item', label: 'İtem', icon: Wand2 },
  { id: 'kozmetik', label: 'Kozmetik', icon: Crown },
  { id: 'koleksiyon', label: 'Koleksiyon', icon: Trophy },
  { id: 'envanter', label: 'Envanter', icon: Package },
  { id: 'cuzdan', label: 'Cüzdan', icon: History },
];

const MOBILE_PRIMARY_TABS: Tab[] = ['pazar', 'gorevler', 'item', 'envanter'];
const MOBILE_SECONDARY_TABS: Tab[] = ['kozmetik', 'koleksiyon', 'cuzdan'];
const MARKET_TAB_ALIASES: Record<string, Tab> = {
  // Eski "vitrin" yönlendirmeleri artık doğrudan Pazar'a düşer.
  vitrin: 'pazar',
  pazar: 'pazar',
  market: 'pazar',
  gorevler: 'gorevler',
  gorev: 'gorevler',
  kozmetik: 'kozmetik',
  koleksiyon: 'koleksiyon',
  item: 'item',
  envanter: 'envanter',
  inventory: 'envanter',
  cuzdan: 'cuzdan',
  wallet: 'cuzdan',
};

const KIND_LABELS: Record<string, string> = {
  frame: 'Profil Çerçevesi',
  title: 'Özel Unvan',
  badge: 'Profil Rozeti',
  collectible: 'Koleksiyon Kartı',
  utility: 'İşlevsel İtem',
  contract: 'Pazar Kontratı',
  background: 'Profil Arka Planı',
  nameEffect: 'İsim Efekti',
  perk: 'Kalıcı Gelişim',
};

const EFFECT_LABELS: Record<string, string> = {
  streak_shield: 'Seri koruması',
  contract_reroll: 'Görev yenileme',
  double_reward: 'Çifte coin ödülü',
  market_coupon: '%20 indirim',
  contract_extension: 'Görev süresi uzatma',
  penalty_waiver: 'Ceza affı',
  single_reroll: 'Günlük görev yenileme',
  selective_reroll: 'Haftalık görev yenileme',
  contract_pin: 'Görev sabitleme',
  xp_boost: 'Görev XP ×1,5',
  contract_insurance: '%50 görev iadesi',
  streak_freeze: '7 günlük seri dondurma',
  collectible_unlock: 'Koleksiyon kartı açma',
  discovery_ticket: 'Keşif önerisi + XP',
  daily_ink: 'Günlük not XP',
};

export default function MarketPage() {
  const {
    data,
    showToast,
    purchaseItem,
    equipItem,
    activateItem,
    markMarketIntroSeen,
    grantItem,
    grantXp,
    pinContract,
  } = useApp();
  const {
    activeContract,
    activeContractProgress,
    activeContractRemaining,
    activateContract,
    cancelContract,
    contractHistory,
    extendActiveContract,
    questState,
  } = useQuests();
  const { notifyEvent } = useTutorial();

  const [tab, setTab] = useState<Tab>(() => {
    // Pazar varsayılan sekmedir. Coin kısayolu yönlendirme sırasında
    // Cüzdan hedefini bırakır.
    try {
      const requested = sessionStorage.getItem('sinevia-market-tab');
      if (requested) {
        sessionStorage.removeItem('sinevia-market-tab');
        return MARKET_TAB_ALIASES[requested] || 'pazar';
      }
    } catch {
      // Depolama kapalıysa varsayılan Pazar.
    }
    return 'pazar';
  });
  const [moreOpen, setMoreOpen] = useState(false);
  const [target, setTarget] = useState<PurchaseTarget | null>(null);
  const [detailEntry, setDetailEntry] = useState<
    | { kind: 'contract'; contract: ContractDef; quantity: number }
    | { kind: 'item'; item: MarketItemDef; quantity: number }
    | null
  >(null);
  const [pendingActivation, setPendingActivation] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenTab = (e: Event) => {
      const detail = String((e as CustomEvent).detail || '');
      const next = MARKET_TAB_ALIASES[detail];
      if (next) setTab(next);
    };
    window.addEventListener('sinevia-open-market-tab', handleOpenTab);
    return () => window.removeEventListener('sinevia-open-market-tab', handleOpenTab);
  }, []);

  useEffect(() => {
    if (!pendingActivation || activeContract) return;
    const ok = activateContract(pendingActivation);
    if (ok) setPendingActivation(null);
  }, [pendingActivation, activeContract, activateContract, data.inventory]);

  const coins = Number(data.coins) || 0;
  const inventory = data.inventory || [];
  const sortedInventory = [...inventory].sort((a, b) => Number(Boolean(parseContractItemId(b.itemId))) - Number(Boolean(parseContractItemId(a.itemId))));
  const equipped = data.equipped || {};
  const effects = data.activeEffects || [];
  const ledger = data.coinLedger || [];
  const couponActive = effects.some(
    (effect) => effect.itemId === 'util_market_coupon' && (effect.charges || 0) > 0,
  );

  const perks = data.perks || [];
  const storeItems = useMemo(() => [...MARKET_ITEMS, ...SEASONAL_ITEMS], []);

  const offers = useMemo(() => {
    const base = getMarketOffers(
      weekKey(),
      Number(data.marketRerollNonce) || 0,
      Number(data.marketDailyNonce) || 0,
      Number(data.marketWeeklyNonce) || 0,
      perks.includes('contract_slot') ? 1 : 0,
    );
    const pin = data.pinnedContract;
    if (!pin || pin.week !== base.weekKey) return base;
    const pinnedDef = CONTRACT_MAP.get(pin.contractId);
    if (!pinnedDef) return base;
    const list = pinnedDef.type === 'daily' ? [...base.daily] : [...base.weekly];
    if (list.some((contract) => contract.id === pinnedDef.id)) return base;
    if (list.length > 0) list[list.length - 1] = pinnedDef;
    else list.push(pinnedDef);
    return pinnedDef.type === 'daily' ? { ...base, daily: list } : { ...base, weekly: list };
  }, [
    data.marketRerollNonce,
    data.marketDailyNonce,
    data.marketWeeklyNonce,
    data.pinnedContract,
    data.perks,
  ]);

  const owned = (itemId: string) => inventoryQuantity(data, itemId) > 0;

  // Bu hafta satın alınan görevler bir daha satın alınamaz. Kayıt, coin
  // hareketlerindeki satın alma işlemlerinden türetilir; böylece görev
  // aktifleştirilip envanterden düşse bile "Tükendi" durumu korunur.
  const purchasedContracts = useMemo(() => {
    const ids = new Set<string>();
    for (const tx of ledger) {
      if (tx.kind !== 'purchase' || !tx.itemId) continue;
      const contractId = parseContractItemId(tx.itemId);
      if (contractId && weekKey(new Date(tx.createdAt)) === offers.weekKey) {
        ids.add(contractId);
      }
    }
    return ids;
  }, [ledger, offers.weekKey]);

  // Tüketilebilir itemlerde haftalık alım sayısı da coin hareketlerinden
  // hesaplanır; envanterde kalan adet değil, bu hafta yapılan alımlar sayılır.
  const weeklyPurchaseCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of ledger) {
      if (tx.kind !== 'purchase' || !tx.itemId) continue;
      if (parseContractItemId(tx.itemId)) continue;
      if (weekKey(new Date(tx.createdAt)) !== offers.weekKey) continue;
      counts.set(tx.itemId, (counts.get(tx.itemId) || 0) + 1);
    }
    return counts;
  }, [ledger, offers.weekKey]);

  const freeDailyLimit = 1 + (perks.includes('contract_slot') ? 1 : 0);
  const freeDailyUsed =
    questState.freeDailyUsage?.date === todayStr() ? questState.freeDailyUsage.count : 0;
  const freeDailyAvailable = !activeContract && freeDailyUsed < freeDailyLimit;
  const pinnedFreeAvailable = useMemo(() => {
    const pin = data.pinnedContract;
    if (activeContract || !pin || pin.week !== offers.weekKey) return false;
    const usage = questState.freePinnedUsage;
    return !(usage?.week === pin.week && usage?.contractId === pin.contractId);
  }, [activeContract, data.pinnedContract, offers.weekKey, questState.freePinnedUsage]);
  const freeStartIds = useMemo(() => {
    const ids = new Set<string>();
    if (freeDailyAvailable) {
      for (const contract of offers.daily) ids.add(contract.id);
    }
    if (pinnedFreeAvailable && data.pinnedContract) {
      ids.add(data.pinnedContract.contractId);
    }
    return ids;
  }, [freeDailyAvailable, pinnedFreeAvailable, offers.daily, data.pinnedContract]);

  const activeDaysThisWeek = useMemo(() => {
    const days = new Set<string>();
    for (const entry of data.history || []) {
      if (entry.isPastWatch || !entry.watchedAt) continue;
      if (weekKey(new Date(entry.watchedAt)) !== offers.weekKey) continue;
      days.add(localDayKey(entry.watchedAt));
    }
    return days.size;
  }, [data.history, offers.weekKey]);

  const contractBoard = useMemo(() => {
    const all = [...offers.daily, ...offers.weekly];
    const spend = all.reduce((sum, contract) => sum + contract.price, 0);
    const xp = all.reduce((sum, contract) => sum + contract.xpReward, 0);
    const rebate = all.reduce((sum, contract) => sum + contract.coinReward, 0);
    return { spend, xp, rebate, net: spend - rebate };
  }, [offers]);

  const weeklyMarketSpend = useMemo(
    () =>
      ledger
        .filter(
          (tx) =>
            tx.kind === 'purchase' &&
            weekKey(new Date(tx.createdAt)) === offers.weekKey,
        )
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
    [ledger, offers.weekKey],
  );

  const weeklyActivityClaimed = ledger.some((tx) => tx.refId === `activity:${offers.weekKey}`);
  const todayStreakReward = streakDayCoinReward(Number(data.dailyStreak) || 0);

  const isSoldOut = (entry: PurchaseTarget): boolean => {
    if (entry.contract) return purchasedContracts.has(entry.contract.id);
    const item = entry.item;
    if (!item) return false;
    if (isPermanentItem(item.kind)) return owned(item.id);
    if (item.weeklyLimit) {
      return (weeklyPurchaseCounts.get(item.id) || 0) >= item.weeklyLimit;
    }
    return false;
  };

  const basePrice = target?.price || 0;
  const finalPrice = target
    ? couponActive
      ? Math.max(1, Math.round(basePrice * 0.8))
      : basePrice
    : 0;
  const canAfford = finalPrice <= coins;
  const targetSoldOut = target ? isSoldOut(target) : false;
  const targetPurchased = target?.item
    ? weeklyPurchaseCounts.get(target.item.id) || 0
    : 0;
  const targetWeeklyLimit = target?.item?.weeklyLimit;
  const targetRemaining = targetWeeklyLimit
    ? Math.max(0, targetWeeklyLimit - targetPurchased)
    : null;

  const openMarketItem = (item: MarketItemDef) => {
    setTarget({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      icon: item.icon,
      kind: item.kind,
      rarity: item.rarity,
      item,
    });
  };

  const openContract = (contract: ContractDef) => {
    setTarget({
      id: contractItemId(contract.id),
      name: contract.title,
      description: contract.description,
      price: contract.price,
      icon: contract.icon,
      kind: 'contract',
      rarity: contract.rarity,
      contract,
    });
  };

  const confirmPurchase = () => {
    if (!target) return;
    if (isSoldOut(target)) {
      showToast(
        target.contract
          ? 'Bu görev bu hafta için tükendi. Haftaya yeniden satın alabilirsin.'
          : target.item?.weeklyLimit
            ? 'Bu ürünün haftalık alım limiti doldu. Haftaya tekrar alabilirsin.'
            : 'Bu ürün zaten envanterinde.',
        'info',
      );
      return;
    }
    if (!canAfford) {
      showToast('Yetersiz SineCoin. Görev ve başarımlardan coin kazanabilirsin.', 'error');
      return;
    }
    const consumable = target.kind === 'utility' || target.kind === 'contract';
    const hadActiveContract = Boolean(activeContract);
    purchaseItem(target.id, target.name, target.price, target.kind, consumable, couponActive);
    if (target.contract) {
      if (hadActiveContract) {
        setTab('envanter');
      } else {
        setPendingActivation(target.contract.id);
        setTab('gorevler');
      }
    } else {
      notifyEvent('market_item_bought');
      setTab('envanter');
    }
    setTarget(null);
  };

  const handleEquip = (item: MarketItemDef) => {
    if (item.kind === 'badge') {
      if (equipped.badgeId === item.id) {
        equipItem('badgeId', null);
        return;
      }
      if (equipped.badgeId2 === item.id) {
        equipItem('badgeId2', null);
        return;
      }
      if (perks.includes('badge_slot') && equipped.badgeId && !equipped.badgeId2) {
        equipItem('badgeId2', item.id);
        return;
      }
      equipItem('badgeId', item.id);
      return;
    }
    const slot =
      item.kind === 'frame'
        ? 'frameId'
        : item.kind === 'title'
          ? 'titleId'
          : item.kind === 'background'
            ? 'backgroundId'
            : item.kind === 'nameEffect'
              ? 'nameEffectId'
              : null;
    if (!slot) return;
    const current = equipped[slot] === item.id ? null : item.id;
    equipItem(slot, current);
  };

  const handleUse = (item: MarketItemDef) => {
    if (!item.effect) return;

    if (item.effect === 'contract_extension') {
      extendActiveContract(item.id);
      return;
    }

    if (item.effect === 'collectible_unlock') {
      const missing = MARKET_ITEMS.filter(
        (candidate) => candidate.kind === 'collectible' && !owned(candidate.id),
      );
      if (missing.length === 0) {
        showToast('Tüm koleksiyon kartlarına zaten sahipsin.', 'info');
        return;
      }
      const pick = missing[Math.floor(Math.random() * missing.length)];
      activateItem(item.id, item.effect, item.name);
      grantItem(pick.id, 'Koleksiyon Kartı', `collectible:${Date.now()}`);
      showToast(`${pick.name} koleksiyonuna eklendi!`, 'success');
      return;
    }

    if (item.effect === 'discovery_ticket') {
      const candidates = (data.movies || []).filter(
        (movie) => !movie.watched && Number(movie.rating) >= 7.5,
      );
      const pick = candidates[Math.floor(Math.random() * Math.max(1, candidates.length))];
      activateItem(item.id, item.effect, item.name);
      grantXp(200);
      showToast(
        pick
          ? `Keşif önerisi: ${pick.title} · +200 XP`
          : 'Keşif bileti kullanıldı · +200 XP',
        'success',
      );
      return;
    }

    if (item.effect === 'daily_ink') {
      activateItem(item.id, item.effect, item.name);
      grantXp(100);
      showToast('Günlük mürekkep kullanıldı · +100 XP', 'success');
      return;
    }

    if (item.effect === 'contract_pin') {
      const rank: Record<ContractRarity, number> = {
        common: 0,
        rare: 1,
        epic: 2,
        legendary: 3,
        mythic: 4,
      };
      const best = [...offers.daily, ...offers.weekly].sort(
        (a, b) => rank[b.rarity] - rank[a.rarity],
      )[0];
      if (!best) {
        showToast('Sabitlenecek bir görev bulunamadı.', 'info');
        return;
      }
      pinContract(best.id, weekKey(nextWeekStart()));
      activateItem(item.id, item.effect, item.name);
      showToast(`${best.title} gelecek haftaya sabitlendi.`, 'success');
      return;
    }

    activateItem(item.id, item.effect, item.name);
  };

  const activeDef = activeContract ? CONTRACT_MAP.get(activeContract.contractId) : undefined;
  const weekLabel = new Date(offers.weekKey).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
  });
  const nextWeek = nextWeekStart().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
  });

  const itemPrice = (item: MarketItemDef) =>
    couponActive ? Math.max(1, Math.round(item.price * 0.8)) : item.price;

  const renderItemCard = (item: MarketItemDef) => (
    <ItemCard
      key={item.id}
      item={item}
      price={itemPrice(item)}
      coins={coins}
      owned={owned(item.id)}
      weeklyPurchased={weeklyPurchaseCounts.get(item.id) || 0}
      onAction={() => openMarketItem(item)}
    />
  );

  const activeSecondaryTab = MOBILE_SECONDARY_TABS.includes(tab)
    ? TABS.find((entry) => entry.id === tab)
    : undefined;

  const renderInventoryCard = (entry: { itemId: string; quantity: number }) => {
    const contractId = parseContractItemId(entry.itemId);
                    const contract = contractId ? CONTRACT_MAP.get(contractId) : undefined;
                    if (contract) {
                      const style = CONTRACT_RARITY_STYLES[contract.rarity];
                      return (
                        <div
                          key={entry.itemId}
                          role="button"
                          tabIndex={0}
                          onClick={() => setDetailEntry({ kind: 'contract', contract, quantity: entry.quantity })}
                          title={contract.description}
                          className={`relative flex min-w-0 flex-col cursor-pointer overflow-hidden rounded-xl border ${style.border} ${style.bg} p-1.5 sm:rounded-2xl sm:p-2.5`}
                        >
                          <div className="relative flex h-14 items-center justify-center sm:h-20">
                            <div
                              className={`pointer-events-none absolute h-8 w-8 rounded-full bg-gradient-radial ${style.glow} opacity-70 blur-xl sm:h-12 sm:w-12`}
                            />
                            <ContractArtwork
                              contract={contract}
                              className="relative h-11 w-11 sm:h-16 sm:w-16"
                            />
                          </div>
                          <p className="line-clamp-2 min-h-[22px] text-center text-[9px] font-black leading-tight text-white sm:min-h-[28px] sm:text-[11px]">
                            {contract.title}
                          </p>
                          <p className="text-center text-[8px] font-bold uppercase tracking-wide text-ink-400 sm:text-[9px]">
                            {style.label} · {entry.quantity}x
                          </p>
                          <p className="mt-1 line-clamp-2 text-center text-[8px] leading-tight text-ink-300 sm:text-[9px]">
                            {contract.description}
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); activateContract(contract.id); }}
                            disabled={Boolean(activeContract)}
                            className="mt-1 w-full rounded-md bg-gradient-to-r from-gold-400 to-amber-500 px-1 py-1 text-[8px] font-black text-ink-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:rounded-lg sm:py-1.5 sm:text-[10px]"
                          >
                            {activeContract ? 'Dolu' : 'Başlat'}
                          </button>
                        </div>
                      );
                    }

                    const item = getMarketItem(entry.itemId);
                    if (!item) return null;
                    const style = CONTRACT_RARITY_STYLES[item.rarity];
                    const slot =
                      item.kind === 'frame'
                        ? 'frameId'
                        : item.kind === 'title'
                          ? 'titleId'
                          : item.kind === 'badge'
                            ? 'badgeId'
                            : item.kind === 'background'
                              ? 'backgroundId'
                              : item.kind === 'nameEffect'
                                ? 'nameEffectId'
                                : null;
                    const isEquipped =
                      item.kind === 'badge'
                        ? equipped.badgeId === item.id || equipped.badgeId2 === item.id
                        : Boolean(slot && equipped[slot] === item.id);
                    const canEquip = isCosmetic(item.kind) && Boolean(slot);

                    return (
                      <div
                        key={entry.itemId}
                        role="button"
                        tabIndex={0}
                        onClick={() => setDetailEntry({ kind: 'item', item, quantity: entry.quantity })}
                        title={item.description}
                        className={`relative flex min-w-0 flex-col cursor-pointer overflow-hidden rounded-xl border ${style.border} ${style.bg} p-1.5 sm:rounded-2xl sm:p-2.5`}
                      >
                        <div className="relative flex h-14 items-center justify-center sm:h-20">
                          <div
                            className={`pointer-events-none absolute h-8 w-8 rounded-full bg-gradient-radial ${style.glow} opacity-70 blur-xl sm:h-12 sm:w-12`}
                          />
                          <MarketArtwork
                            item={item}
                            className="relative h-11 w-11 drop-shadow-[0_5px_8px_rgba(0,0,0,0.45)] sm:h-16 sm:w-16"
                          />
                          {isEquipped && (
                            <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-ink-950 shadow sm:h-5 sm:w-5">
                              <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 min-h-[22px] text-center text-[9px] font-black leading-tight text-white sm:min-h-[28px] sm:text-[11px]">
                          {item.name}
                        </p>
                        <p className="text-center text-[8px] font-bold uppercase tracking-wide text-ink-400 sm:text-[9px]">
                          {style.label} · {entry.quantity}x
                        </p>
                        <p className="mt-1 line-clamp-2 text-center text-[8px] leading-tight text-ink-300 sm:text-[9px]">
                          {item.description}
                        </p>
                        {canEquip ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEquip(item); }}
                            className={`mt-1 w-full rounded-md px-1 py-1 text-[8px] font-black transition sm:rounded-lg sm:py-1.5 sm:text-[10px] ${
                              isEquipped
                                ? 'border border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                                : 'border border-white/15 bg-white/5 text-white hover:bg-white/10'
                            }`}
                          >
                            {isEquipped ? 'Çıkar' : 'Kuşan'}
                          </button>
                        ) : item.kind === 'utility' && item.effect ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUse(item); }}
                            className="mt-1 w-full rounded-md bg-gradient-to-r from-azure-500 to-cyan-500 px-1 py-1 text-[8px] font-black text-white shadow transition hover:brightness-110 sm:rounded-lg sm:py-1.5 sm:text-[10px]"
                          >
                            Kullan
                          </button>
                        ) : item.kind === 'perk' ? (
                          <span className="mt-1 w-full rounded-md border border-emerald-400/30 bg-emerald-500/10 px-1 py-1 text-center text-[8px] font-black text-emerald-300 sm:rounded-lg sm:py-1.5 sm:text-[10px]">
                            Kalıcı
                          </span>
                        ) : (
                          <span className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-1 py-1 text-center text-[8px] font-black text-ink-400 sm:rounded-lg sm:py-1.5 sm:text-[10px]">
                            Koleksiyon
                          </span>
                        )}
                      </div>
                    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4 sm:px-6 sm:pt-6">
      {/* İlk Giriş Tanıtım Modalı */}
      {!data.marketIntroSeen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-gold-400/40 bg-gradient-to-b from-ink-900 via-ink-950 to-ink-950 p-8 text-center shadow-[0_25px_70px_-15px_rgba(245,158,11,0.35)]">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-gold-500/25 blur-3xl" />
            <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
              <SineCoinIcon className="h-16 w-16 drop-shadow-[0_0_25px_rgba(245,158,11,0.7)]" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-gold-300">
              Sinevia Mağazası Açıldı
            </p>
            <h2 className="mt-2 bg-gradient-to-b from-white to-ink-200 bg-clip-text text-3xl font-black text-transparent">
              SineCoin ile Tanış
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-300">
              Başarımların ve tamamladığın görevler artık SineCoin kazandırıyor. Birikimin hesabına
              eklendi. Pazarda özel kozmetikler, koleksiyon kartları ve zamanlı kontratlar seni
              bekliyor.
            </p>
            <div className="mt-6 rounded-2xl border border-gold-500/30 bg-gradient-to-r from-gold-500/10 via-gold-400/15 to-gold-500/10 px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gold-300">
                Mevcut Bakiyen
              </p>
              <div className="mt-1.5 flex items-center justify-center gap-2">
                <SineCoinIcon className="h-7 w-7" />
                <p className="text-3xl font-black text-white">{formatCoins(coins)} SC</p>
              </div>
            </div>
            <button
              onClick={markMarketIntroSeen}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 px-5 py-3.5 text-sm font-black text-ink-950 shadow-[0_10px_25px_-5px_rgba(245,158,11,0.5)] transition hover:brightness-110"
            >
              <Sparkles className="h-4 w-4" /> Pazarı Keşfet
            </button>
          </div>
        </div>
      )}

      {/* Sayfa Başlığı — diğer sayfaların başlık diliyle uyumlu */}
      <header data-tutorial="market-header" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2.5 text-2xl font-black uppercase tracking-tight text-ink-100 sm:text-3xl">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-300 via-gold-400 to-amber-600 text-ink-950 shadow-[0_8px_22px_-6px_rgba(245,158,11,0.75),inset_0_1px_0_rgba(255,255,255,0.5)] sm:h-10 sm:w-10">
            <Store size={20} strokeWidth={2.4} />
          </span>
          <span>
            Pazar <span className="text-[#FCD34D]">&amp;</span> Envanter
          </span>
        </h1>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span data-tutorial="market-coin" className="inline-flex">
            <CoinPill amount={coins} size="md" onClick={() => setTab('cuzdan')} />
          </span>
          {couponActive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300 sm:text-[11px]">
              <Tag className="h-3 w-3" /> %20 Kupon Aktif
            </span>
          ) : (
            <span className="rounded-full border border-white/10 bg-ink-900/70 px-2.5 py-1 text-[10px] font-medium text-ink-400 sm:text-[11px]">
              Yeni fırsatlar: <span className="font-bold text-ink-200">{nextWeek}</span>
            </span>
          )}
        </div>
      </header>

      {/* Aktif Pazar Kontratı Gösterge Paneli */}
      {activeContract && activeDef && (
        <div
          className={`group relative mt-4 overflow-hidden rounded-2xl border ${CONTRACT_RARITY_STYLES[activeDef.rarity].border} ${CONTRACT_RARITY_STYLES[activeDef.rarity].bg} ${CONTRACT_RARITY_STYLES[activeDef.rarity].shadow} p-4 sm:mt-6 sm:rounded-3xl sm:p-6`}
        >
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${CONTRACT_RARITY_STYLES[activeDef.rarity].accentBar}`}
          />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden sm:block">
                <ContractArtwork contract={activeDef} className="h-14 w-14" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-gold-300">
                    Aktif Pazar Kontratı
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${CONTRACT_RARITY_STYLES[activeDef.rarity].badgeBg}`}
                  >
                    {CONTRACT_RARITY_STYLES[activeDef.rarity].label}
                  </span>
                </div>
                <h3 className="mt-0.5 text-base font-black text-white sm:text-lg">{activeDef.title}</h3>
                <p className="text-xs text-ink-300">
                  İlerleme:{' '}
                  <span className="font-bold text-white">{activeContractProgress?.percent || 0}%</span> ·
                  Kalan süre: <span className="font-bold text-gold-300">{activeContractRemaining}</span>
                  {' · '}
                  <span className="font-bold text-rose-300">Süre dolarsa −{CONTRACT_FAILURE_PENALTY[activeDef.rarity]} SC</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="min-w-[160px] flex-1">
                <div className="h-2.5 overflow-hidden rounded-full bg-ink-950/80 p-0.5 ring-1 ring-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold-500 via-amber-400 to-yellow-300 transition-all duration-500"
                    style={{ width: `${activeContractProgress?.percent || 0}%` }}
                  />
                </div>
              </div>
              <button
                onClick={cancelContract}
                className="rounded-xl border border-white/10 bg-ink-950/60 px-3.5 py-2 text-xs font-bold text-ink-300 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
              >
                İptal Et
              </button>
            </div>
          </div>
          {activeContractProgress && (
            <div className="mt-4 flex flex-wrap gap-2">
              {activeContractProgress.requirements.map((req) => (
                <span
                  key={req.metric}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
                    req.met
                      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                      : 'border-white/10 bg-ink-950/60 text-ink-300'
                  }`}
                >
                  {req.met && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  {METRIC_LABELS[req.metric]}: {Math.min(req.current, req.target)}/{req.target}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sekme Navigasyonu — mobilde 4 ana sekme + Diğer */}
      <div data-tutorial="market-tabs" className="relative mt-4 md:hidden">
        <nav className="grid grid-cols-5 gap-1 rounded-2xl border border-white/10 bg-ink-900/75 p-1 backdrop-blur-md">
          {MOBILE_PRIMARY_TABS.map((id) => {
            const entry = TABS.find((candidate) => candidate.id === id)!;
            const Icon = entry.icon;
            const active = tab === id;
            return (
              <button
                key={id}
                data-tutorial={`market-tab-${id}`}
                onClick={() => { setTab(id); setMoreOpen(false); }}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[9px] font-black leading-none transition-all ${
                  active
                    ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-ink-950 shadow-[0_4px_15px_-3px_rgba(245,158,11,0.5)]'
                    : 'text-ink-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{entry.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen((open) => !open)}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[9px] font-black leading-none transition-all ${
              activeSecondaryTab || moreOpen
                ? 'bg-white/10 text-white'
                : 'text-ink-300'
            }`}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="truncate">{activeSecondaryTab?.label || 'Diğer'}</span>
          </button>
        </nav>
        {moreOpen && (
          <div className="absolute inset-x-0 top-full z-30 mt-2 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-ink-950/95 p-1.5 shadow-2xl backdrop-blur-xl">
            {MOBILE_SECONDARY_TABS.map((id) => {
              const entry = TABS.find((candidate) => candidate.id === id)!;
              const Icon = entry.icon;
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => { setTab(id); setMoreOpen(false); }}
                  className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[10px] font-bold transition ${
                    active ? 'bg-gold-500/20 text-gold-200' : 'text-ink-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {entry.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <nav data-tutorial="market-tabs" className="mt-6 hidden gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-ink-900/75 p-1.5 backdrop-blur-md md:flex">
        {TABS.map((entry) => {
          const Icon = entry.icon;
          const active = tab === entry.id;
          return (
            <button
              key={entry.id}
              data-tutorial={`market-tab-${entry.id}`}
              onClick={() => setTab(entry.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all duration-200 sm:text-sm ${
                active
                  ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-ink-950 shadow-[0_4px_15px_-3px_rgba(245,158,11,0.5)]'
                  : 'text-ink-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" /> {entry.label}
            </button>
          );
        })}
      </nav>

      {/* PAZAR SEKMESİ — görevler hariç tüm satın alınabilir eşyalar */}
      {tab === 'pazar' && (
        <div data-tutorial="market-items">
          <GridSection
            title="İşlevsel İtemler"
            subtitle="Görev, seri ve XP akışını doğrudan etkileyen güçlendirmeler."
          >
            {MARKET_ITEMS.filter((item) => item.kind === 'utility').map(renderItemCard)}
          </GridSection>

          <GridSection
            title="Kalıcı Gelişim"
            subtitle="Bir kez alınır, hesabına kalıcı olarak eklenir."
          >
            {MARKET_ITEMS.filter((item) => item.kind === 'perk').map(renderItemCard)}
          </GridSection>

          <GridSection title="Profil Kozmetikleri" subtitle="Çerçeve, unvan ve rozetler.">
            {MARKET_ITEMS.filter(
              (item) => item.kind === 'frame' || item.kind === 'title' || item.kind === 'badge',
            ).map(renderItemCard)}
          </GridSection>

          <GridSection title="Profil Arka Planları" subtitle="Profilini bir sahne gibi tasarla.">
            {MARKET_ITEMS.filter((item) => item.kind === 'background').map(renderItemCard)}
          </GridSection>

          <GridSection title="İsim Efektleri" subtitle="Adın akışta ve profilde öne çıksın.">
            {MARKET_ITEMS.filter((item) => item.kind === 'nameEffect').map(renderItemCard)}
          </GridSection>

          <GridSection
            title="Koleksiyon Kartları"
            subtitle="Sinema tarihine ait kalıcı koleksiyon parçaları."
          >
            {MARKET_ITEMS.filter((item) => item.kind === 'collectible').map(renderItemCard)}
          </GridSection>

          <GridSection
            title="Sezonluk Lüks"
            subtitle="Uzun vadeli birikim hedefi; yalnızca kozmetik, oyun gücü yok."
          >
            {SEASONAL_ITEMS.map(renderItemCard)}
          </GridSection>
        </div>
      )}

      {/* GÖREV (KONTRATLAR) SEKMESİ */}
      {tab === 'gorevler' && (
        <section data-tutorial="market-contracts" className="mt-6 space-y-8">
          <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-white sm:text-xl">Görev Panosu</h2>
                <p className="mt-0.5 text-[11px] text-ink-400 sm:text-xs">
                  {weekLabel} dönemi · Sonraki yenilenme: {nextWeek}
                </p>
              </div>
              <button
                onClick={() => {
                  if (inventoryQuantity(data, 'util_contract_reroll') <= 0) {
                    showToast('Görev yenileme jetonun yok. İtem sekmesinden alabilirsin.', 'info');
                    return;
                  }
                  activateItem('util_contract_reroll', 'contract_reroll', 'Görev yenileme');
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-2.5 text-xs font-black text-gold-200 transition hover:border-gold-400/60 hover:bg-gold-500/20"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Görevleri Yenile (
                {inventoryQuantity(data, 'util_contract_reroll')})
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Toplam Bedel', value: `${formatCoins(contractBoard.spend)} SC` },
                { label: 'Toplam XP', value: `${formatCoins(contractBoard.xp)} XP` },
                { label: 'Coin İadesi', value: `+${formatCoins(contractBoard.rebate)} SC` },
                { label: 'Net Maliyet', value: `${formatCoins(contractBoard.net)} SC` },
              ].map((entry) => (
                <div
                  key={entry.label}
                  className="rounded-xl border border-white/10 bg-ink-950/55 px-3 py-2.5"
                >
                  <p className="text-[9px] font-black uppercase tracking-widest text-ink-500">
                    {entry.label}
                  </p>
                  <p className="mt-0.5 text-sm font-black tabular-nums text-white">{entry.value}</p>
                </div>
              ))}
            </div>

            <p className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold leading-relaxed text-emerald-200">
              Her gün ilk günlük görev ücretsizdir; XP verir, coin iadesi yoktur.
              {freeDailyAvailable
                ? ` Bugün ${freeDailyLimit - freeDailyUsed} ücretsiz başlatma hakkın var.`
                : ' Bugünkü ücretsiz başlatma hakkın kullanıldı.'}
            </p>
          </div>

          <ContractGroup
            title="Günlük Görevler"
            contracts={offers.daily}
            onBuy={openContract}
            onFreeStart={(contract) => activateContract(contract.id)}
            freeContractIds={freeStartIds}
            couponActive={couponActive}
            coins={coins}
            soldOutIds={purchasedContracts}
          />

          <ContractGroup
            title="Haftalık Görevler"
            contracts={offers.weekly}
            onBuy={openContract}
            onFreeStart={(contract) => activateContract(contract.id)}
            freeContractIds={freeStartIds}
            couponActive={couponActive}
            coins={coins}
            soldOutIds={purchasedContracts}
          />
        </section>
      )}

      {/* KOZMETİK SEKMESİ */}
      {tab === 'kozmetik' && (
        <>
          <GridSection title="Prestij Kozmetikleri">
            {storeItems
              .filter(
                (item) =>
                  item.kind === 'frame' ||
                  item.kind === 'title' ||
                  item.kind === 'badge' ||
                  item.kind === 'background' ||
                  item.kind === 'nameEffect',
              )
              .map(renderItemCard)}
          </GridSection>
        </>
      )}

      {/* KOLEKSİYON SEKMESİ */}
      {tab === 'koleksiyon' && (
        <GridSection title="Sinema Tarihi Koleksiyon Kartları">
          {MARKET_ITEMS.filter((item) => item.kind === 'collectible').map(renderItemCard)}
        </GridSection>
      )}

      {/* İŞLEVSEL İTEM SEKMESİ */}
      {tab === 'item' && (
        <>
          <GridSection title="İşlevsel Güçlendirmeler">
            {MARKET_ITEMS.filter((item) => item.kind === 'utility').map(renderItemCard)}
          </GridSection>
          <GridSection title="Kalıcı Gelişim">
            {MARKET_ITEMS.filter((item) => item.kind === 'perk').map(renderItemCard)}
          </GridSection>
        </>
      )}

      {/* ENVANTER SEKMESİ */}
      {tab === 'envanter' && (
        <section className="mt-6">
          <h2 className="text-xl font-black text-white">Envanterim</h2>
          <p className="text-sm text-ink-400">
            Kozmetikleri kuşan, güçlendirmeleri etkinleştir veya bekleyen kontratlarını başlat.
          </p>
          {inventory.length === 0 ? (
            <EmptyState
              icon={<Package className="h-10 w-10" />}
              title="Envanterin henüz boş"
              text="Mağazadan kontrat, kozmetik veya koleksiyon kartı alarak envanterini doldurabilirsin."
            />
          ) : (
             <>
            {sortedInventory.some((e) => parseContractItemId(e.itemId)) && (
              <h3 className="mt-4 text-sm font-black uppercase tracking-widest text-gold-300">Görevler (Pazar)</h3>
            )}
            {sortedInventory.some((e) => parseContractItemId(e.itemId)) && (
              <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5 xl:grid-cols-6">
                {sortedInventory.filter((e) => parseContractItemId(e.itemId)).map(renderInventoryCard)}
              </div>
            )}
            {sortedInventory.some((e) => !parseContractItemId(e.itemId)) && (
              <h3 className="mt-5 text-sm font-black uppercase tracking-widest text-ink-300">Eşyalar</h3>
            )}
            {sortedInventory.some((e) => !parseContractItemId(e.itemId)) && (
              <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5 xl:grid-cols-6">
                {sortedInventory.filter((e) => !parseContractItemId(e.itemId)).map(renderInventoryCard)}
              </div>
            )}
             </>
          )}
        </section>
      )}

      {/* CÜZDAN SEKMESİ */}
      {tab === 'cuzdan' && (
        <section className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[1fr_1.15fr]">
          <div className="min-w-0 space-y-5">
            <div className="relative overflow-hidden rounded-3xl border border-gold-400/35 bg-gradient-to-br from-ink-900 via-gold-950/30 to-ink-950 p-4 shadow-[0_15px_40px_-12px_rgba(245,158,11,0.3)] sm:p-6">
              <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gold-400/20 blur-2xl" />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FCD34D] sm:text-[11px] sm:tracking-[0.25em]">
                    SineCoin Hazinesi
                  </p>
                  <p className="mt-2 break-words text-3xl font-black tabular-nums text-white sm:text-4xl">
                    {formatCoins(coins)}{' '}
                    <span className="text-base font-black text-[#FCD34D] sm:text-lg">SC</span>
                  </p>
                </div>
                <SineCoinIcon className="h-12 w-12 shrink-0 drop-shadow-[0_0_24px_rgba(245,158,11,0.65)] sm:h-16 sm:w-16" />
              </div>
              <p className="mt-3 text-xs text-ink-300">
                Başarımlar, koleksiyon hedefleri ve zamanlı pazar kontratlarıyla kazanılır.
              </p>
            </div>

            <div className="min-w-0 rounded-3xl border border-white/10 bg-ink-900/75 p-4 sm:p-6">
              <div className="flex items-center gap-2.5">
                <Zap className="h-5 w-5 shrink-0 text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <h3 className="text-sm font-black text-white sm:text-base">Haftalık Ekonomi</h3>
              </div>
              <p className="mt-1 text-xs text-ink-400">
                İzleme serisi ve haftalık aktivite doğrudan coin kazandırır. Kontratlar ise coin
                değil XP satın alımıdır.
              </p>

              <div className="mt-4 rounded-2xl border border-white/10 bg-ink-950/60 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-ink-200">Haftalık aktivite</span>
                  <span className="text-xs font-black tabular-nums text-emerald-300">
                    {activeDaysThisWeek} / {WEEKLY_ACTIVITY_REQUIRED_DAYS} gün
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
                    style={{
                      width: `${Math.min(100, (activeDaysThisWeek / WEEKLY_ACTIVITY_REQUIRED_DAYS) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-[11px] font-bold text-ink-400">
                  {weeklyActivityClaimed
                    ? `Bu haftanın +${WEEKLY_ACTIVITY_REWARD} SC ödülü alındı.`
                    : `${WEEKLY_ACTIVITY_REQUIRED_DAYS} farklı gün izle · +${WEEKLY_ACTIVITY_REWARD} SC`}
                </p>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-gold-400/25 bg-gold-500/10 p-3.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-amber-300/80">
                    Günlük seri
                  </p>
                  <p className="mt-1 text-lg font-black text-white">
                    {data.dailyStreak || 0}. gün
                  </p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-amber-200">
                    <SineCoinIcon className="h-3.5 w-3.5" /> Bugün +{todayStreakReward} SC
                  </p>
                </div>
                <div className="rounded-2xl border border-azure-400/25 bg-azure-500/10 p-3.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-azure-300/80">
                    Bu hafta pazar
                  </p>
                  <p className="mt-1 text-lg font-black text-white">
                    {formatCoins(weeklyMarketSpend)} SC
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold text-ink-300">
                    Kontrat neti: {formatCoins(contractBoard.net)} SC
                  </p>
                </div>
              </div>

              <p className="mt-3 rounded-xl border border-white/5 bg-ink-950/70 px-3 py-2.5 text-[11px] leading-relaxed text-ink-400">
                Her gün ilk günlük görev ücretsiz. Görev fiyatı kadar XP kazandırır; tamamlanınca
                fiyatın %12’si kadar coin iadesi verir.
              </p>
            </div>
          </div>

          <div className="min-w-0 rounded-3xl border border-white/10 bg-ink-900/75 p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 shrink-0 text-gold-300" />
              <h3 className="text-sm font-black text-white sm:text-base">Hesap Hareketleri</h3>
            </div>
            <div className="mt-4 max-h-[520px] space-y-2.5 overflow-y-auto pr-1">
              {ledger.length === 0 && (
                <p className="py-8 text-center text-xs text-ink-400">
                  Henüz bir SineCoin hareketi bulunmuyor.
                </p>
              )}
              {[...ledger]
                .reverse()
                .slice(0, 60)
                .map((tx) => (
                  <div
                    key={tx.id}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-2xl border border-white/5 bg-ink-950/55 px-3 py-3 sm:gap-3 sm:px-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-ink-100 sm:text-xs">
                        {tx.label}
                      </p>
                      <p className="text-[10px] text-ink-500">
                        {new Date(tx.createdAt).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-black sm:text-xs ${
                        tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {tx.amount >= 0 ? '+' : ''}
                      <SineCoinIcon className="inline h-3.5 w-3.5 align-[-2px]" /> {formatCoins(tx.amount)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* Tamamlanan Pazar Görevleri Özeti */}
      {tab === 'gorevler' && contractHistory.length > 0 && (
        <section className="mt-6 rounded-3xl border border-emerald-500/25 bg-emerald-500/5 p-5">
          <h3 className="flex items-center gap-2 text-sm font-black text-white">
            <BadgeCheck className="h-4 w-4 text-emerald-300" /> Son Tamamlanan Kontratlar
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {contractHistory.slice(0, 8).map((entry) => {
              const def = CONTRACT_MAP.get(entry.contractId);
              return (
                <span
                  key={entry.instanceId}
                  className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-200"
                >
                  {def?.title} · +{entry.xp} XP
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* SATIN ALMA / DETAY MODALI */}
      {target && (
        <div
          className="fixed inset-0 z-[105] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-4"
          onClick={() => setTarget(null)}
        >
          <div
            className={`relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border ${CONTRACT_RARITY_STYLES[target.rarity].border} bg-gradient-to-b from-ink-900 via-ink-950 to-ink-950 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95)] sm:max-h-[84vh] sm:rounded-3xl`}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${CONTRACT_RARITY_STYLES[target.rarity].accentBar}`}
            />

            <button
              type="button"
              onClick={() => setTarget(null)}
              aria-label="Kapat"
              className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-ink-950/70 text-ink-300 backdrop-blur transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex-1 overflow-y-auto overscroll-contain px-1">
            {/* Sahne: büyük 3D ikon + nadirlik ışıltısı */}
            <div className="relative flex h-44 items-center justify-center overflow-hidden pt-2 sm:h-48">
              <div
                className={`pointer-events-none absolute h-40 w-40 rounded-full bg-gradient-radial ${CONTRACT_RARITY_STYLES[target.rarity].glow} opacity-80 blur-2xl`}
              />
              <div className="pointer-events-none absolute inset-x-10 bottom-4 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              {targetSoldOut && (
                <span className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rotate-[-10deg] rounded-lg border-2 border-rose-400/60 bg-ink-950/90 px-4 py-1.5 text-sm font-black uppercase tracking-[0.25em] text-rose-200 shadow-[0_10px_30px_rgba(0,0,0,0.65)] sm:text-base">
                  Tükendi
                </span>
              )}
              {target.contract ? (
                <ContractArtwork
                  contract={target.contract}
                  className="relative z-10 h-32 w-32 drop-shadow-[0_18px_28px_rgba(0,0,0,0.55)] sm:h-36 sm:w-36"
                />
              ) : target.item ? (
                <MarketArtwork
                  item={target.item}
                  className="relative z-10 h-32 w-32 drop-shadow-[0_18px_28px_rgba(0,0,0,0.55)] sm:h-36 sm:w-36"
                />
              ) : null}
            </div>

            <div className="px-5 text-center sm:px-6">
              <span
                className={`inline-block rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${CONTRACT_RARITY_STYLES[target.rarity].badgeBg}`}
              >
                {CONTRACT_RARITY_STYLES[target.rarity].label} ·{' '}
                {KIND_LABELS[target.kind] || target.kind}
              </span>
              <h3 className="mt-2 text-xl font-black leading-tight text-white sm:text-2xl">
                {target.name}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-ink-300 sm:text-sm">
                {target.description}
              </p>
            </div>

            {target.contract ? (
              <div className="mx-5 mt-5 grid grid-cols-2 gap-2.5 sm:mx-6">
                <div className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2.5 text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-ink-500">Süre</p>
                  <p className="mt-0.5 text-sm font-black text-white">
                    {target.contract.durationHours === 24 ? '24 Saat' : '7 Gün'}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2.5 text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-ink-500">
                    Görev Tipi
                  </p>
                  <p className="mt-0.5 text-sm font-black text-white">
                    {target.contract.type === 'daily' ? 'Günlük' : 'Haftalık'}
                  </p>
                </div>
                <div className="rounded-xl border border-azure-400/25 bg-azure-500/10 px-3 py-2.5 text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-azure-300/70">
                    XP Ödülü
                  </p>
                  <p className="mt-0.5 text-sm font-black text-azure-200">
                    +{target.contract.xpReward} XP
                  </p>
                </div>
                <div className="rounded-xl border border-gold-400/25 bg-gold-500/10 px-3 py-2.5 text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-amber-300/70">
                    Coin İadesi (%12)
                  </p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-black text-amber-200">
                    <SineCoinIcon className="h-3.5 w-3.5" /> +{target.contract.coinReward} SC
                  </p>
                </div>
                <div className="col-span-2 rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2.5 text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-ink-500">Hedef</p>
                  <p className="mt-0.5 text-sm font-bold text-white">
                    {target.contract.requirements
                      .map((req) => `${req.target} ${METRIC_LABELS[req.metric]}`)
                      .join(' + ')}
                  </p>
                </div>
                <p className="col-span-2 text-center text-[10px] font-bold text-rose-300/80">
                  Süre dolarsa −{CONTRACT_FAILURE_PENALTY[target.contract.rarity]} SC ceza uygulanır.
                </p>
              </div>
            ) : (
              <div className="mx-5 mt-5 grid grid-cols-2 gap-2.5 sm:mx-6">
                <div className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2.5 text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-ink-500">Tür</p>
                  <p className="mt-0.5 text-sm font-black text-white">
                    {KIND_LABELS[target.kind] || target.kind}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2.5 text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-ink-500">
                    Nadirlik
                  </p>
                  <p className="mt-0.5 text-sm font-black text-white">
                    {CONTRACT_RARITY_STYLES[target.rarity].label}
                  </p>
                </div>
                <div className="col-span-2 rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2.5 text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-ink-500">
                    Kullanım
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-white">
                    {target.item?.effect
                      ? EFFECT_LABELS[target.item.effect] || 'Etkinleştirilebilir güçlendirme'
                      : isCosmetic(target.kind as MarketItemKind)
                        ? 'Profilinde ve koleksiyonunda sergilenir.'
                        : 'Satın alındığında envantere eklenir.'}
                  </p>
                </div>
                {targetWeeklyLimit && (
                  <div className="col-span-2 rounded-xl border border-azure-400/25 bg-azure-500/10 px-3 py-2.5 text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-azure-300">
                      Haftalık Alım Limiti
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-white">
                      {targetPurchased} / {targetWeeklyLimit} kullanıldı ·{' '}
                      <span className={targetRemaining === 0 ? 'text-rose-300' : 'text-emerald-300'}>
                        {targetRemaining} hak kaldı
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mx-5 mt-4 rounded-2xl border border-white/10 bg-ink-950/70 p-4 sm:mx-6">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-ink-400">Fiyat</span>
                <div className="text-right">
                  {couponActive && (
                    <p className="text-[10px] font-bold text-ink-500 line-through">
                      {formatCoins(basePrice)} SC
                    </p>
                  )}
                  <p
                    className={`inline-flex items-center gap-1.5 text-xl font-black tabular-nums ${
                      canAfford ? 'text-white' : 'text-rose-400'
                    }`}
                  >
                    <SineCoinIcon className="h-4 w-4" /> {formatCoins(finalPrice)}
                    <span className="text-[10px] font-black text-ink-400">SC</span>
                  </p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-white/5 pt-2.5">
                <span className="text-xs font-medium text-ink-400">Mevcut Bakiye</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-black tabular-nums ${
                    coins >= finalPrice ? 'text-white' : 'text-rose-400'
                  }`}
                >
                  <SineCoinIcon className="h-3.5 w-3.5" /> {formatCoins(coins)} SC
                </span>
              </div>
              {couponActive && (
                <p className="mt-2 text-[10px] font-bold text-emerald-300">
                  %20 Pazar kuponu uygulandı.
                </p>
              )}
              {couponActive && basePrice < 2750 && (
                <p className="mt-1 text-[10px] font-bold text-amber-300">
                  Kupon 550 SC; bu alışverişte indirim {formatCoins(basePrice - finalPrice)} SC.
                  Kuponu 2.750 SC üzeri bir alışverişte kullanmak daha avantajlı.
                </p>
              )}
              {target.contract && (
                <p className="mt-2 rounded-lg border border-azure-400/20 bg-azure-500/10 px-2.5 py-2 text-[10px] font-bold leading-relaxed text-azure-200">
                  Bu bedel kadar XP kazanırsın. Tamamlanınca fiyatın %12’si coin olarak geri döner.
                </p>
              )}
            </div>

            {targetSoldOut ? (
              <p className="mx-5 mt-2.5 flex items-center justify-center gap-1.5 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-center text-[11px] font-bold text-rose-300 sm:mx-6">
                {target.contract
                  ? 'Bu görev bu hafta için tükendi. Haftaya yeniden satın alabilirsin.'
                  : targetWeeklyLimit
                    ? 'Bu ürünün haftalık alım limiti doldu. Haftaya tekrar alabilirsin.'
                    : 'Bu ürün zaten envanterinde.'}
              </p>
            ) : !canAfford ? (
              <p className="mx-5 mt-2.5 flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-center text-[11px] font-bold text-rose-300 sm:mx-6">
                Yetersiz bakiye · {(finalPrice - coins).toLocaleString('tr-TR')} SC daha gerekiyor
              </p>
            ) : null}

            </div>
            <div className="mt-4 flex gap-2.5 border-t border-white/5 p-4 sm:p-5">
              <button
                onClick={() => setTarget(null)}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-ink-200 transition hover:bg-white/10"
              >
                Vazgeç
              </button>
              <button
                onClick={confirmPurchase}
                disabled={!canAfford || targetSoldOut}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-black transition ${
                  targetSoldOut
                    ? 'cursor-default border border-rose-400/35 bg-rose-500/10 text-rose-300'
                    : !canAfford
                      ? 'cursor-not-allowed border border-rose-500/35 bg-rose-500/10 text-rose-300'
                      : 'bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 text-ink-950 shadow-[0_8px_20px_-4px_rgba(245,158,11,0.5)] hover:brightness-110'
                }`}
              >
                {targetSoldOut ? (
                  'Tükendi'
                ) : !canAfford ? (
                  'Satın Alınamaz'
                ) : (
                  <>
                    <SineCoinIcon className="h-4 w-4" />
                    {formatCoins(finalPrice)} SC · Satın Al
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    {detailEntry && (
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        onClick={() => setDetailEntry(null)}
      >
        <div
          className="w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-b from-ink-900 via-ink-950 to-ink-950 p-5 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-ink-500">
                {detailEntry.kind === 'contract' ? 'Pazar Görevi' : 'Envanter Eşyası'}
              </p>
              <h3 className="mt-1 text-lg font-black text-white">
                {detailEntry.kind === 'contract' ? detailEntry.contract.title : detailEntry.item.name}
              </h3>
            </div>
            <button onClick={() => setDetailEntry(null)} className="rounded-full border border-white/10 bg-white/5 p-2 text-ink-300 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-ink-950/60">
              {detailEntry.kind === 'contract' ? (
                <ContractArtwork contract={detailEntry.contract} className="h-12 w-12" />
              ) : (
                <MarketArtwork item={detailEntry.item} className="h-12 w-12" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-relaxed text-ink-300">
                {detailEntry.kind === 'contract' ? detailEntry.contract.description : detailEntry.item.description}
              </p>
              <p className="mt-2 text-[11px] font-bold text-ink-400">
                Adet: {detailEntry.quantity} · Nadirlik:{' '}
                {CONTRACT_RARITY_STYLES[detailEntry.kind === 'contract' ? detailEntry.contract.rarity : detailEntry.item.rarity].label}
              </p>
            </div>
          </div>
          {detailEntry.kind === 'contract' ? (
            <button
              onClick={() => {
                if (activeContract) return;
                activateContract(detailEntry.contract.id);
                setDetailEntry(null);
              }}
              disabled={Boolean(activeContract)}
              className="w-full rounded-xl bg-gradient-to-r from-gold-400 to-amber-500 px-4 py-3 text-sm font-black text-ink-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {activeContract ? 'Aktif görev var' : 'Görevi Başlat'}
            </button>
          ) : detailEntry.item.kind === 'utility' && detailEntry.item.effect ? (
            <button
              onClick={() => {
                handleUse(detailEntry.item);
                setDetailEntry(null);
              }}
              className="w-full rounded-xl bg-gradient-to-r from-azure-500 to-cyan-500 px-4 py-3 text-sm font-black text-white transition hover:brightness-110"
            >
              Kullan
            </button>
          ) : detailEntry.item.kind === 'frame' || detailEntry.item.kind === 'title' || detailEntry.item.kind === 'badge' || detailEntry.item.kind === 'background' || detailEntry.item.kind === 'nameEffect' ? (
            <button
              onClick={() => {
                const slot =
                  detailEntry.item.kind === 'frame'
                    ? 'frameId'
                    : detailEntry.item.kind === 'title'
                      ? 'titleId'
                      : detailEntry.item.kind === 'badge'
                        ? 'badgeId'
                        : detailEntry.item.kind === 'background'
                          ? 'backgroundId'
                          : 'nameEffectId';
                handleEquip(detailEntry.item);
                setDetailEntry(null);
              }}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
            >
              Kuşan / Çıkar
            </button>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-ink-400">
              Bu eşya koleksiyonluk bir parçadır.
            </p>
          )}
        </div>
      </div>
    )}
    </div>
  );
}

function GridSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-black uppercase tracking-tight text-white sm:text-xl">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[11px] text-ink-400 sm:text-xs">{subtitle}</p>}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

function ContractGroup({
  title,
  contracts,
  onBuy,
  onFreeStart,
  freeContractIds,
  couponActive,
  coins,
  soldOutIds,
}: {
  title: string;
  contracts: ContractDef[];
  onBuy: (contract: ContractDef) => void;
  onFreeStart?: (contract: ContractDef) => void;
  freeContractIds?: Set<string>;
  couponActive: boolean;
  coins: number;
  soldOutIds: Set<string>;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-black uppercase tracking-tight text-white sm:text-lg">
          {title}
        </h3>
        <span className="rounded-full border border-gold-500/30 bg-gold-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#FDE68A]">
          {contracts.length} Görev
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {contracts.map((contract) => (
          <ContractCard
            key={contract.id}
            contract={contract}
            price={couponActive ? Math.max(1, Math.round(contract.price * 0.8)) : contract.price}
            coins={coins}
            soldOut={soldOutIds.has(contract.id)}
            freeAvailable={Boolean(freeContractIds?.has(contract.id) && onFreeStart)}
            onFreeStart={() => onFreeStart?.(contract)}
            onBuy={() => onBuy(contract)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Sadece 3D ikon + başlık gösteren premium görev kartı.
 * Detaylar ve satın alma, karta tıklandığında açılan pencerede yer alır.
 */
function ContractCard({
  contract,
  price,
  coins,
  soldOut,
  freeAvailable = false,
  onFreeStart,
  onBuy,
}: {
  contract: ContractDef;
  price: number;
  coins: number;
  soldOut: boolean;
  freeAvailable?: boolean;
  onFreeStart?: () => void;
  onBuy: () => void;
}) {
  const style = CONTRACT_RARITY_STYLES[contract.rarity];
  const canStartFree = Boolean(freeAvailable && onFreeStart && !soldOut);
  const affordable = canStartFree || (!soldOut && coins >= price);
  const primaryAction = canStartFree ? onFreeStart! : onBuy;

  return (
    <article
      onClick={primaryAction}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          primaryAction();
        }
      }}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border ${style.border} ${style.bg} ${style.shadow} p-2.5 transition-all duration-300 hover:-translate-y-1 sm:rounded-3xl sm:p-4`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${style.accentBar}`}
      />

      {canStartFree && (
        <span className="absolute left-2 top-2 z-20 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-200 sm:left-3 sm:top-3 sm:text-[9px]">
          Ücretsiz
        </span>
      )}

      {soldOut && (
        <div className="pointer-events-none absolute inset-x-0 top-10 z-20 flex -translate-y-1/2 justify-center sm:top-16">
          <span className="rotate-[-10deg] rounded-md border-2 border-rose-400/60 bg-ink-950/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-rose-200 shadow-[0_6px_18px_rgba(0,0,0,0.55)] sm:px-3 sm:py-1 sm:text-xs">
            Tükendi
          </span>
        </div>
      )}

      <div className="relative flex h-20 w-full items-center justify-center sm:h-32">
        <div
          className={`pointer-events-none absolute h-12 w-12 rounded-full bg-gradient-radial ${style.glow} opacity-75 blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-100 sm:h-24 sm:w-24`}
        />
        <ContractArtwork
          contract={contract}
          className="relative h-16 w-16 drop-shadow-[0_12px_18px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:scale-110 sm:h-24 sm:w-24"
        />
      </div>

      <h3 className="mt-1 line-clamp-2 min-h-[27px] text-center text-[11px] font-black leading-tight text-white transition-colors group-hover:text-[#FDE68A] sm:mt-2 sm:min-h-0 sm:text-sm sm:leading-snug">
        {contract.title}
      </h3>

      <p className="mt-0.5 line-clamp-2 min-h-[24px] text-center text-[9px] leading-tight text-ink-300 sm:mt-1.5 sm:min-h-[32px] sm:text-[11px] sm:leading-snug">
        {contract.description}
      </p>

      <p className="mt-0.5 text-center text-[8px] font-bold text-emerald-300/80 sm:text-[10px]">
        +{formatCoins(contract.xpReward)} XP · +{formatCoins(contract.coinReward)} SC iade
      </p>

      <div className="mt-auto flex items-center justify-between gap-1.5 border-t border-white/5 pt-2 sm:gap-2 sm:pt-3">
        <span
          className={`inline-flex items-center gap-0.5 text-[10px] font-black tabular-nums sm:gap-1 sm:text-sm ${
            soldOut
              ? 'text-ink-500 line-through'
              : canStartFree
                ? 'text-emerald-300'
                : affordable
                  ? 'text-white'
                  : 'text-rose-400'
          }`}
        >
          {canStartFree ? (
            'Ücretsiz'
          ) : (
            <>
              <SineCoinIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              {formatCoins(price)}
            </>
          )}
        </span>

        <button
          type="button"
          disabled={soldOut || (!canStartFree && !affordable)}
          onClick={(event) => {
            event.stopPropagation();
            primaryAction();
          }}
          className={`rounded-md px-1.5 py-1 text-[9px] font-black leading-none transition sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-[11px] ${
            soldOut
              ? 'cursor-default border border-rose-400/30 bg-rose-500/10 text-rose-300'
              : canStartFree
                ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-ink-950 shadow-[0_4px_12px_-3px_rgba(16,185,129,0.5)] hover:brightness-110'
                : affordable
                  ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-ink-950 shadow-[0_4px_12px_-3px_rgba(245,158,11,0.5)] hover:brightness-110'
                  : 'cursor-not-allowed border border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
        >
          <span className="sm:hidden">
            {soldOut ? 'Bitti' : canStartFree ? 'Başlat' : affordable ? 'Satın Al' : 'Yetersiz'}
          </span>
          <span className="hidden sm:inline">
            {soldOut
              ? 'Tükendi'
              : canStartFree
                ? 'Ücretsiz Başlat'
                : affordable
                  ? 'Satın Al'
                  : 'Yetersiz'}
          </span>
        </button>
      </div>
    </article>
  );
}

/**
 * Sadece 3D ikon + eşya adı gösteren premium pazar kartı.
 * Açıklama, nadirlik ve satın alma detayları modalda sunulur.
 */
function ItemCard({
  item,
  price,
  coins,
  owned,
  weeklyPurchased = 0,
  onAction,
}: {
  item: MarketItemDef;
  price: number;
  coins: number;
  owned: boolean;
  weeklyPurchased?: number;
  onAction: () => void;
}) {
  const style = CONTRACT_RARITY_STYLES[item.rarity];
  const alreadyOwned = owned && isPermanentItem(item.kind);
  const limitReached = Boolean(
    item.weeklyLimit && weeklyPurchased >= item.weeklyLimit,
  );
  const soldOut = alreadyOwned || limitReached;
  const affordable = coins >= price;

  return (
    <article
      onClick={onAction}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onAction();
        }
      }}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border ${style.border} ${style.bg} ${style.shadow} p-2 transition-all duration-300 hover:-translate-y-1 sm:rounded-3xl sm:p-4`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${style.accentBar}`}
      />

      {item.weeklyLimit && (
        <span
          className={`absolute right-1 top-1 z-20 rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide sm:right-2 sm:top-2 sm:text-[9px] ${
            limitReached
              ? 'border-rose-400/50 bg-rose-500/20 text-rose-200'
              : 'border-azure-400/40 bg-azure-500/15 text-azure-200'
          }`}
        >
          {Math.max(0, item.weeklyLimit - weeklyPurchased)}/{item.weeklyLimit}
        </span>
      )}

      {soldOut && (
        <div className="pointer-events-none absolute inset-x-0 top-8 z-20 flex -translate-y-1/2 justify-center sm:top-16">
          <span className="rotate-[-10deg] rounded-md border-2 border-rose-400/60 bg-ink-950/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-rose-200 shadow-[0_6px_18px_rgba(0,0,0,0.55)] sm:px-3 sm:py-1 sm:text-xs">
            Tükendi
          </span>
        </div>
      )}

      <div className="relative flex h-16 w-full items-center justify-center sm:h-32">
        <div
          className={`pointer-events-none absolute h-10 w-10 rounded-full bg-gradient-radial ${style.glow} opacity-75 blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-100 sm:h-24 sm:w-24`}
        />
        <MarketArtwork
          item={item}
          className="relative h-14 w-14 drop-shadow-[0_10px_14px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110 sm:h-24 sm:w-24 sm:drop-shadow-[0_12px_18px_rgba(0,0,0,0.45)]"
        />
      </div>

      <h3 className="mt-1.5 line-clamp-2 min-h-[24px] text-center text-[10px] font-black leading-tight text-white transition-colors group-hover:text-[#FDE68A] sm:mt-2 sm:min-h-0 sm:line-clamp-1 sm:text-sm sm:leading-snug">
        {item.name}
      </h3>

      <div className="mt-auto flex items-center justify-between gap-1 border-t border-white/5 pt-1.5 sm:gap-2 sm:pt-3">
        <span
          className={`inline-flex items-center gap-0.5 text-[9px] font-black tabular-nums sm:gap-1 sm:text-sm ${
            soldOut ? 'text-ink-500 line-through' : affordable ? 'text-white' : 'text-rose-400'
          }`}
        >
          <SineCoinIcon className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
          {formatCoins(price)}
        </span>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAction();
          }}
          disabled={soldOut}
          title={
            alreadyOwned
              ? 'Envanterde mevcut'
              : limitReached
                ? 'Haftalık alım limiti doldu'
                : affordable
                  ? 'Satın al'
                  : 'Yetersiz bakiye'
          }
          className={`rounded-md px-1.5 py-1 text-[9px] font-black leading-none transition sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-[11px] ${
            soldOut
              ? 'cursor-default border border-rose-400/30 bg-rose-500/10 text-rose-300'
              : affordable
                ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-ink-950 shadow-[0_4px_12px_-3px_rgba(245,158,11,0.5)] hover:brightness-110'
                : 'cursor-not-allowed border border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
        >
          <span className="sm:hidden">{soldOut ? 'Bitti' : affordable ? 'Al' : 'Yok'}</span>
          <span className="hidden sm:inline">
            {soldOut ? 'Tükendi' : affordable ? 'Satın Al' : 'Yetersiz'}
          </span>
        </button>
      </div>
    </article>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-ink-900/40 px-6 py-16 text-center">
      <div className="mb-3 text-ink-400">{icon}</div>
      <p className="text-base font-black text-white">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-ink-400">{text}</p>
    </div>
  );
}