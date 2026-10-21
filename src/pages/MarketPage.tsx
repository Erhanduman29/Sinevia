import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Calendar,
  Check,
  Clapperboard,
  Clock,
  Compass,
  Crown,
  Dices,
  Film,
  Flame,
  Gem,
  History,
  Hourglass,
  Layers,
  Moon,
  Orbit,
  Package,
  Palette,
  PenTool,
  Popcorn,
  Radio,
  RefreshCw,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Ticket,
  Timer,
  Trophy,
  Tv,
  Wand2,
  Waves,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useQuests } from '../context/QuestContext';
import CoinPill, { SineCoinIcon } from '../components/CoinPill';
import { formatCoins, inventoryQuantity } from '../lib/coins';
import {
  CONTRACT_MAP,
  CONTRACT_RARITY_STYLES,
  CONTRACT_FAILURE_PENALTY,
  METRIC_LABELS,
  contractItemId,
  parseContractItemId,
  type ContractDef,
  type ContractMetric,
  type ContractRarity,
} from '../lib/contracts';
import { getMarketOffers, nextWeekStart, weekKey } from '../lib/contractLogic';
import {
  MARKET_ITEMS,
  XP_CONVERSION_RATE,
  getMarketItem,
  isCosmetic,
  type MarketItemDef,
  type MarketItemKind,
} from '../lib/marketItems';

type Tab = 'vitrin' | 'kozmetik' | 'koleksiyon' | 'item' | 'gorevler' | 'envanter' | 'cuzdan';

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
  { id: 'vitrin', label: 'Vitrin', icon: Sparkles },
  { id: 'gorevler', label: 'Pazar Görevleri', icon: Timer },
  { id: 'kozmetik', label: 'Kozmetik', icon: Crown },
  { id: 'koleksiyon', label: 'Koleksiyon', icon: Trophy },
  { id: 'item', label: 'İtem', icon: Wand2 },
  { id: 'envanter', label: 'Envanter', icon: Package },
  { id: 'cuzdan', label: 'Cüzdan', icon: History },
];

const KIND_LABELS: Record<string, string> = {
  frame: 'Profil Çerçevesi',
  title: 'Özel Unvan',
  badge: 'Profil Rozeti',
  collectible: 'Koleksiyon Kartı',
  utility: 'İşlevsel İtem',
  contract: 'Pazar Kontratı',
};

const RARITY_ICON_COLOR: Record<ContractRarity, string> = {
  common: 'text-slate-200 drop-shadow-[0_0_14px_rgba(226,232,240,0.45)]',
  rare: 'text-azure-300 drop-shadow-[0_0_16px_rgba(56,189,248,0.65)]',
  epic: 'text-violet-300 drop-shadow-[0_0_18px_rgba(167,139,250,0.75)]',
  legendary: 'text-gold-300 drop-shadow-[0_0_20px_rgba(251,191,36,0.85)]',
  mythic: 'text-rose-300 drop-shadow-[0_0_22px_rgba(251,113,133,0.9)]',
};

/**
 * Çerçevesiz, arkadan aydınlatmalı (ambient glow) ve katmanlı
 * premium pazar eşyası ikonu
 */
function FramelessMarketArtwork({
  item,
  size = 'md',
}: {
  item: MarketItemDef;
  size?: 'sm' | 'md' | 'lg';
}) {
  const style = CONTRACT_RARITY_STYLES[item.rarity];
  const colorClass = RARITY_ICON_COLOR[item.rarity];
  const dim = size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-10 w-10' : 'h-14 w-14';
  const iconDim = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-7 w-7' : 'h-10 w-10';

  const renderGraphic = () => {
    // 1. Profil Çerçeveleri: Gerçek ışıklı halka önizlemesi
    if (item.kind === 'frame') {
      const ringStyles: Record<string, string> = {
        frame_silver:
          'border-slate-200 shadow-[0_0_22px_rgba(226,232,240,0.55),inset_0_0_12px_rgba(226,232,240,0.35)]',
        frame_gold:
          'border-gold-400 shadow-[0_0_25px_rgba(245,158,11,0.75),inset_0_0_14px_rgba(245,158,11,0.45)]',
        frame_neon:
          'border-violet-400 shadow-[0_0_28px_rgba(139,92,246,0.85),inset_0_0_16px_rgba(139,92,246,0.5)]',
        frame_crimson:
          'border-rose-500 shadow-[0_0_28px_rgba(244,63,94,0.85),inset_0_0_16px_rgba(244,63,94,0.5)]',
        frame_cosmic:
          'border-cyan-300 shadow-[0_0_32px_rgba(34,211,238,0.9),inset_0_0_18px_rgba(34,211,238,0.6)]',
      };
      return (
        <div className="relative flex items-center justify-center">
          <div
            className={`${iconDim} rounded-full border-[3px] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12 ${
              ringStyles[item.id] || ringStyles.frame_silver
            }`}
          />
          <Sparkles className={`absolute h-4 w-4 ${colorClass} animate-pulse`} />
        </div>
      );
    }

    // 2. Özel İtem İkon Eşleştirmeleri (Çerçevesiz Vektörel Sanat)
    switch (item.id) {
      case 'title_nightowl':
        return <Moon className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'title_salon':
        return <Award className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'title_culture':
        return <Compass className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'title_sovereign':
        return <Crown className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'badge_popcorn':
        return <Popcorn className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'badge_director':
        return <Clapperboard className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'badge_goldenticket':
        return <Ticket className={`${iconDim} ${colorClass} -rotate-12`} strokeWidth={1.75} />;
      case 'card_first_screening':
        return <Film className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'card_silent_era':
        return <Orbit className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'card_new_wave':
        return <Waves className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'card_blockbuster':
        return <Flame className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'card_cult':
        return <Gem className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'util_streak_shield':
        return <Shield className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'util_contract_reroll':
        return <Dices className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'util_double_reward':
        return <Zap className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'util_market_coupon':
        return <Tag className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      default:
        return <span className={`text-4xl ${colorClass}`}>{item.icon}</span>;
    }
  };

  return (
    <div className={`relative flex ${dim} shrink-0 items-center justify-center select-none`}>
      {/* Çerçevesiz Arka Plan Radyal Işık Halesi */}
      <div
        className={`pointer-events-none absolute inset-0 scale-125 rounded-full bg-gradient-radial ${style.glow} blur-xl opacity-80 transition-all duration-500 group-hover:scale-150 group-hover:opacity-100`}
      />
      <div className="relative z-10 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5">
        {renderGraphic()}
      </div>
    </div>
  );
}

/**
 * Kontratlar için çerçevesiz, metriğe ve nadirliğe duyarlı
 * arkadan aydınlatmalı (spotlight) ikon bileşeni
 */
function FramelessContractArtwork({
  contract,
  size = 'md',
}: {
  contract: ContractDef;
  size?: 'sm' | 'md' | 'lg';
}) {
  const style = CONTRACT_RARITY_STYLES[contract.rarity];
  const colorClass = RARITY_ICON_COLOR[contract.rarity];
  const dim = size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-10 w-10' : 'h-14 w-14';
  const iconDim = size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-7 w-7' : 'h-10 w-10';

  const primaryMetric: ContractMetric = contract.requirements[0]?.metric || 'items';

  const renderMetricIcon = () => {
    if (contract.rarity === 'mythic') {
      return <Gem className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
    }
    if (contract.requirements.length > 1) {
      return <Layers className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
    }
    switch (primaryMetric) {
      case 'movies':
      case 'weekend_movies':
        return <Clapperboard className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'episodes':
      case 'weekend_episodes':
        return <Tv className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'items':
        return <Ticket className={`${iconDim} ${colorClass} -rotate-6`} strokeWidth={1.75} />;
      case 'minutes':
        return contract.rarity === 'legendary' || contract.rarity === 'epic' ? (
          <Hourglass className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />
        ) : (
          <Clock className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />
        );
      case 'genres':
        return <Palette className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'ratings':
        return <Star className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'notes':
        return <PenTool className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'adds':
        return <BookOpen className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'distinct_series':
        return <Radio className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'watch_days':
        return <Calendar className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'max_day_items':
        return <Flame className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      case 'streak':
        return <Zap className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
      default:
        return <Film className={`${iconDim} ${colorClass}`} strokeWidth={1.75} />;
    }
  };

  return (
    <div className={`relative flex ${dim} shrink-0 items-center justify-center select-none`}>
      <div
        className={`pointer-events-none absolute inset-0 scale-125 rounded-full bg-gradient-radial ${style.glow} blur-xl opacity-85 transition-all duration-500 group-hover:scale-150 group-hover:opacity-100`}
      />
      <div className="relative z-10 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5">
        {renderMetricIcon()}
      </div>
    </div>
  );
}

export default function MarketPage() {
  const {
    data,
    showToast,
    purchaseItem,
    equipItem,
    activateItem,
    convertCoinsToXp,
    markMarketIntroSeen,
  } = useApp();
  const {
    activeContract,
    activeContractProgress,
    activeContractRemaining,
    activateContract,
    cancelContract,
    contractHistory,
  } = useQuests();

  const [tab, setTab] = useState<Tab>('vitrin');
  const [target, setTarget] = useState<PurchaseTarget | null>(null);
  const [xpAmount, setXpAmount] = useState(100);

  useEffect(() => {
    const handleOpenTab = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'inventory' || detail === 'envanter') setTab('envanter');
    };
    window.addEventListener('sinevia-open-market-tab', handleOpenTab);
    return () => window.removeEventListener('sinevia-open-market-tab', handleOpenTab);
  }, []);

  const coins = Number(data.coins) || 0;
  const inventory = data.inventory || [];
  const equipped = data.equipped || {};
  const effects = data.activeEffects || [];
  const ledger = data.coinLedger || [];
  const couponActive = effects.some(
    (effect) => effect.itemId === 'util_market_coupon' && (effect.charges || 0) > 0,
  );

  const offers = useMemo(
    () => getMarketOffers(weekKey(), Number(data.marketRerollNonce) || 0),
    [data.marketRerollNonce],
  );

  const owned = (itemId: string) => inventoryQuantity(data, itemId) > 0;
  const basePrice = target?.price || 0;
  const finalPrice = target
    ? couponActive
      ? Math.max(1, Math.round(basePrice * 0.8))
      : basePrice
    : 0;
  const canAfford = finalPrice <= coins;

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
    if (!canAfford) {
      showToast('Yetersiz SineCoin. Görev ve başarımlardan coin kazanabilirsin.', 'error');
      return;
    }
    if (isCosmetic(target.kind as MarketItemKind) && owned(target.id)) {
      showToast('Bu kozmetik zaten envanterinde.', 'info');
      return;
    }
    const consumable = target.kind === 'utility' || target.kind === 'contract';
    purchaseItem(target.id, target.name, target.price, target.kind, consumable, couponActive);
    setTarget(null);
    setTab('envanter');
  };

  const handleEquip = (item: MarketItemDef) => {
    const slot =
      item.kind === 'frame'
        ? 'frameId'
        : item.kind === 'title'
          ? 'titleId'
          : item.kind === 'badge'
            ? 'badgeId'
            : null;
    if (!slot) return;
    const current = equipped[slot] === item.id ? null : item.id;
    equipItem(slot, current);
  };

  const handleUse = (item: MarketItemDef) => {
    if (!item.effect) return;
    activateItem(item.id, item.effect, item.name);
  };

  const handleConvert = () => {
    if (coins < xpAmount) {
      showToast('Yetersiz SineCoin.', 'error');
      return;
    }
    convertCoinsToXp(xpAmount, `xp:${Date.now()}`);
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

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6">
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
                <p className="text-3xl font-black text-gold-100">{formatCoins(coins)} SC</p>
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

      {/* Premium Sinematik Hero Header */}
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-ink-900 via-ink-950 to-gold-950/35 p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.85)] sm:p-9">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gold-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/50 to-transparent" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-gold-300">
              <Sparkles className="h-3.5 w-3.5" /> Sinevia Özel Koleksiyon & Kontrat Pazarı
            </div>
            <h1 className="mt-3 bg-gradient-to-br from-white via-white to-gold-200 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
              Sinema Mirasını İnşa Et.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-300">
              İzleme serilerinden ve başarımlardan kazandığın SineCoin’leri prestijli profil
              kozmetiklerine, sinema tarihi kartlarına ve yüksek ödüllü kontratlara dönüştür.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2.5 sm:items-end">
            <CoinPill amount={coins} size="lg" onClick={() => setTab('cuzdan')} />
            {couponActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                <Tag className="h-3 w-3" /> %20 Pazar Kuponun Aktif!
              </span>
            ) : (
              <p className="text-[11px] font-medium text-ink-400">
                Vitrin her Pazartesi yenilenir · Yeni vitrin: <span className="text-ink-200">{nextWeek}</span>
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Aktif Pazar Kontratı Gösterge Paneli */}
      {activeContract && activeDef && (
        <div
          className={`group relative mt-6 overflow-hidden rounded-3xl border ${CONTRACT_RARITY_STYLES[activeDef.rarity].border} ${CONTRACT_RARITY_STYLES[activeDef.rarity].bg} ${CONTRACT_RARITY_STYLES[activeDef.rarity].shadow} p-5 sm:p-6`}
        >
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${CONTRACT_RARITY_STYLES[activeDef.rarity].accentBar}`}
          />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <FramelessContractArtwork contract={activeDef} size="md" />
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
                <h3 className="mt-0.5 text-lg font-black text-white">{activeDef.title}</h3>
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

      {/* Sekme Navigasyonu */}
      <nav className="mt-6 flex gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-ink-900/75 p-1.5 backdrop-blur-md">
        {TABS.map((entry) => {
          const Icon = entry.icon;
          const active = tab === entry.id;
          return (
            <button
              key={entry.id}
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

      {/* VİTRİN SEKMESİ */}
      {tab === 'vitrin' && (
        <section className="mt-6 space-y-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {offers.daily.slice(0, 2).map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                price={
                  couponActive ? Math.max(1, Math.round(contract.price * 0.8)) : contract.price
                }
                onBuy={() => openContract(contract)}
              />
            ))}
            {MARKET_ITEMS.filter(
              (item) => item.rarity === 'legendary' || item.rarity === 'epic',
            )
              .slice(0, 4)
              .map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  price={itemPrice(item)}
                  owned={owned(item.id)}
                  onAction={() => openMarketItem(item)}
                />
              ))}
          </div>

          {/* Hızlı Erişim Kartları */}
          <div className="grid gap-4 sm:grid-cols-3">
            <button
              onClick={() => setTab('gorevler')}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-ink-900/90 to-ink-950 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-gold-500/40"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gold-500/15 blur-2xl transition-opacity group-hover:opacity-100" />
              <Timer className="h-6 w-6 text-gold-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
              <p className="mt-3 text-base font-black text-white">Pazar Kontratları</p>
              <p className="mt-1 text-xs text-ink-400">
                Bu haftanın günlük ve haftalık yüksek ödüllü kontratlarını incele.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-gold-300 group-hover:translate-x-0.5 transition-transform">
                Kontratları aç <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>

            <button
              onClick={() => setTab('envanter')}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-ink-900/90 to-ink-950 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-azure-500/40"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-azure-500/15 blur-2xl" />
              <Package className="h-6 w-6 text-azure-300 drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]" />
              <p className="mt-3 text-base font-black text-white">Envanterim</p>
              <p className="mt-1 text-xs text-ink-400">
                Satın aldığın kontratları başlat, çerçeve ve unvanlarını kuşan.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-azure-300 group-hover:translate-x-0.5 transition-transform">
                Envanteri aç <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>

            <button
              onClick={() => setTab('cuzdan')}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-ink-900/90 to-ink-950 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-500/40"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/15 blur-2xl" />
              <SineCoinIcon className="h-6 w-6" />
              <p className="mt-3 text-base font-black text-white">SineCoin → XP Dönüşümü</p>
              <p className="mt-1 text-xs text-ink-400">
                1 SC = {XP_CONVERSION_RATE} XP. Hızlı seviye atlamak için bakiyeni kullan.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-300 group-hover:translate-x-0.5 transition-transform">
                Cüzdana git <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          </div>
        </section>
      )}

      {/* PAZAR GÖREVLERİ (KONTRATLAR) SEKMESİ */}
      {tab === 'gorevler' && (
        <section className="mt-6 space-y-8">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-ink-900/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">Haftalık Kontrat Vitrini</h2>
              <p className="mt-0.5 text-sm text-ink-400">
                {weekLabel} dönemi · Sonraki yenilenme: {nextWeek}. Alınan kontratlar envantere
                eklenir.
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
              <RefreshCw className="h-3.5 w-3.5" /> Vitrini Yenile (
              {inventoryQuantity(data, 'util_contract_reroll')})
            </button>
          </div>

          <ContractGroup
            title="Günlük Kontratlar"
            subtitle="Envanterden etkinleştirildiği andan itibaren 24 saat geçerlidir."
            contracts={offers.daily}
            onBuy={openContract}
            couponActive={couponActive}
          />

          <ContractGroup
            title="Haftalık Büyük Kontratlar"
            subtitle="Envanterden etkinleştirildiği andan itibaren 7 gün geçerlidir."
            contracts={offers.weekly}
            onBuy={openContract}
            couponActive={couponActive}
          />
        </section>
      )}

      {/* KOZMETİK SEKMESİ */}
      {tab === 'kozmetik' && (
        <GridSection
          title="Prestij Kozmetikleri"
          subtitle="Profilini öne çıkaran ışıklı çerçeveler, özel unvanlar ve rozetler."
        >
          {MARKET_ITEMS.filter(
            (item) => item.kind === 'frame' || item.kind === 'title' || item.kind === 'badge',
          ).map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              price={itemPrice(item)}
              owned={owned(item.id)}
              onAction={() => openMarketItem(item)}
            />
          ))}
        </GridSection>
      )}

      {/* KOLEKSİYON SEKMESİ */}
      {tab === 'koleksiyon' && (
        <GridSection
          title="Sinema Tarihi Koleksiyon Kartları"
          subtitle="Sinema çağlarını simgeleyen nadir hatıra kartları."
        >
          {MARKET_ITEMS.filter((item) => item.kind === 'collectible').map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              price={itemPrice(item)}
              owned={owned(item.id)}
              onAction={() => openMarketItem(item)}
            />
          ))}
        </GridSection>
      )}

      {/* İŞLEVSEL İTEM SEKMESİ */}
      {tab === 'item' && (
        <GridSection
          title="İşlevsel Güçlendirmeler"
          subtitle="Seri koruma kalkanı, vitrin yenileme jetonu, çifte kazanç ve indirim kuponları."
        >
          {MARKET_ITEMS.filter((item) => item.kind === 'utility').map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              price={itemPrice(item)}
              owned={owned(item.id)}
              onAction={() => openMarketItem(item)}
            />
          ))}
        </GridSection>
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
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {inventory.map((entry) => {
                const contractId = parseContractItemId(entry.itemId);
                const contract = contractId ? CONTRACT_MAP.get(contractId) : undefined;
                if (contract) {
                  const style = CONTRACT_RARITY_STYLES[contract.rarity];
                  return (
                    <div
                      key={entry.itemId}
                      className={`group relative flex flex-col overflow-hidden rounded-3xl border ${style.border} ${style.bg} ${style.shadow} p-5`}
                    >
                      <div
                        className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${style.accentBar}`}
                      />
                      <div className="flex items-center gap-4">
                        <FramelessContractArtwork contract={contract} size="sm" />
                        <div className="min-w-0 flex-1">
                          <span
                            className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${style.badgeBg}`}
                          >
                            {style.label} · {entry.quantity} Adet
                          </span>
                          <p className="mt-1 truncate text-base font-black text-white">
                            {contract.title}
                          </p>
                          <p className="text-[11px] text-ink-400">
                            {contract.type === 'daily' ? 'Günlük Kontrat' : 'Haftalık Kontrat'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-[11px] font-bold">
                        <span className="rounded-full border border-azure-400/30 bg-azure-500/15 px-2.5 py-0.5 text-azure-200">
                          +{contract.xpReward} XP
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-gold-400/30 bg-gold-500/15 px-2.5 py-0.5 text-gold-200">
                          <SineCoinIcon className="h-3.5 w-3.5" /> +{contract.coinReward} SC
                        </span>
                      </div>
                      <button
                        onClick={() => activateContract(contract.id)}
                        disabled={Boolean(activeContract)}
                        className="mt-4 w-full rounded-xl bg-gradient-to-r from-gold-400 to-amber-500 px-4 py-2.5 text-xs font-black text-ink-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {activeContract ? 'Başka Görev Aktif' : 'Kontratı Başlat'}
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
                        : null;
                const isEquipped = Boolean(slot && equipped[slot] === item.id);

                return (
                  <div
                    key={entry.itemId}
                    className={`group relative flex flex-col overflow-hidden rounded-3xl border ${style.border} ${style.bg} ${style.shadow} p-5`}
                  >
                    <div
                      className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${style.accentBar}`}
                    />
                    <div className="flex items-center gap-4">
                      <FramelessMarketArtwork item={item} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${style.badgeBg}`}
                          >
                            {KIND_LABELS[item.kind]}
                          </span>
                          {isEquipped && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-300">
                              <Check className="h-3 w-3" /> Kuşanıldı
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-base font-black text-white">{item.name}</p>
                        <p className="text-[11px] text-ink-400">{entry.quantity} adet mevcut</p>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs text-ink-300">{item.description}</p>
                    {isCosmetic(item.kind) && slot && (
                      <button
                        onClick={() => handleEquip(item)}
                        className={`mt-4 w-full rounded-xl px-4 py-2.5 text-xs font-black transition ${
                          isEquipped
                            ? 'border border-emerald-400/50 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                            : 'border border-white/15 bg-white/5 text-white hover:bg-white/10'
                        }`}
                      >
                        {isEquipped ? 'Üzerinden Çıkar' : 'Şimdi Kuşan'}
                      </button>
                    )}
                    {item.kind === 'utility' && item.effect && (
                      <button
                        onClick={() => handleUse(item)}
                        className="mt-4 w-full rounded-xl bg-gradient-to-r from-azure-500 to-cyan-500 px-4 py-2.5 text-xs font-black text-white shadow-lg transition hover:brightness-110"
                      >
                        Şimdi Kullan
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* CÜZDAN SEKMESİ */}
      {tab === 'cuzdan' && (
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-3xl border border-gold-400/35 bg-gradient-to-br from-ink-900 via-gold-950/30 to-ink-950 p-6 shadow-[0_15px_40px_-12px_rgba(245,158,11,0.3)]">
              <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gold-400/20 blur-2xl" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gold-300">
                    SineCoin Hazinesi
                  </p>
                  <p className="mt-2 text-4xl font-black text-white">
                    {formatCoins(coins)}{' '}
                    <span className="text-lg font-black text-gold-400">SC</span>
                  </p>
                </div>
                <SineCoinIcon className="h-16 w-16 drop-shadow-[0_0_24px_rgba(245,158,11,0.65)]" />
              </div>
              <p className="mt-3 text-xs text-ink-300">
                Başarımlar, koleksiyon hedefleri ve zamanlı pazar kontratlarıyla kazanılır.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-ink-900/75 p-6">
              <div className="flex items-center gap-2.5">
                <Zap className="h-5 w-5 text-azure-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
                <h3 className="text-base font-black text-white">SineCoin → XP Dönüştürücü</h3>
              </div>
              <p className="mt-1 text-xs text-ink-400">
                1 SC = {XP_CONVERSION_RATE} XP. Dönüştürülen XP profil seviyene kalıcı olarak
                eklenir.
              </p>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {[50, 100, 250, 500].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setXpAmount(amount)}
                    className={`rounded-xl border py-2.5 text-xs font-black transition ${
                      xpAmount === amount
                        ? 'border-azure-400 bg-azure-500/20 text-azure-200 shadow-[0_0_15px_rgba(56,189,248,0.25)]'
                        : 'border-white/10 bg-ink-950/40 text-ink-300 hover:bg-white/5'
                    }`}
                  >
                    <SineCoinIcon className="mx-auto h-3.5 w-3.5" />
                    <span className="mt-0.5 block">{amount} SC</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/5 bg-ink-950/70 px-4 py-3.5">
                <span className="text-sm font-black text-azure-300">
                  +{xpAmount * XP_CONVERSION_RATE} XP Kazanacaksın
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gold-200">
                  <SineCoinIcon className="h-4 w-4" /> {xpAmount} SC
                </span>
              </div>
              <button
                onClick={handleConvert}
                disabled={coins < xpAmount}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-azure-500 to-cyan-500 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                XP’ye Dönüştür
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-ink-900/75 p-6">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-gold-300" />
              <h3 className="text-base font-black text-white">Hesap Hareketleri</h3>
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
                    className="flex items-center justify-between rounded-2xl border border-white/5 bg-ink-950/55 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink-100">{tx.label}</p>
                      <p className="text-[10px] text-ink-500">
                        {new Date(tx.createdAt).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                    <span
                      className={`ml-3 inline-flex shrink-0 items-center gap-1 text-xs font-black ${
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
      {tab === 'vitrin' && contractHistory.length > 0 && (
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

      {/* SATIN ALMA ONAY MODALI (Çerçevesiz Büyük İkonlu) */}
      {target && (
        <div
          className="fixed inset-0 z-[105] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          onClick={() => setTarget(null)}
        >
          <div
            className={`relative w-full max-w-md overflow-hidden rounded-3xl border ${CONTRACT_RARITY_STYLES[target.rarity].border} ${CONTRACT_RARITY_STYLES[target.rarity].bg} ${CONTRACT_RARITY_STYLES[target.rarity].shadow} p-6`}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${CONTRACT_RARITY_STYLES[target.rarity].accentBar}`}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                {target.contract ? (
                  <FramelessContractArtwork contract={target.contract} size="lg" />
                ) : target.item ? (
                  <FramelessMarketArtwork item={target.item} size="lg" />
                ) : null}
                <div>
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${CONTRACT_RARITY_STYLES[target.rarity].badgeBg}`}
                  >
                    {CONTRACT_RARITY_STYLES[target.rarity].label} ·{' '}
                    {KIND_LABELS[target.kind] || target.kind}
                  </span>
                  <h3 className="mt-1.5 text-xl font-black text-white">{target.name}</h3>
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-ink-200">{target.description}</p>

            {target.contract && (
              <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-ink-950/60 p-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-400">Kontrat Süresi</span>
                  <span className="font-bold text-white">
                    {target.contract.durationHours === 24 ? '24 Saat' : '7 Gün'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-400">XP Ödülü</span>
                  <span className="font-black text-azure-300">+{target.contract.xpReward} XP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-400">SineCoin Ödülü</span>
                  <span className="inline-flex items-center gap-1 font-black text-gold-300">
                    <SineCoinIcon className="h-3.5 w-3.5" /> +{target.contract.coinReward} SC
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-400">Hedef</span>
                  <span className="max-w-[220px] text-right font-bold text-white">
                    {target.contract.requirements
                      .map((req) => `${req.target} ${METRIC_LABELS[req.metric]}`)
                      .join(' + ')}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-ink-950/70 px-4 py-3.5">
              <span className="text-xs font-medium text-ink-400">İşlem Sonrası Bakiye</span>
              <div className="text-right">
                <p
                  className={`inline-flex items-center gap-1.5 text-lg font-black ${
                    coins - finalPrice < 0 ? 'text-rose-400' : 'text-gold-200'
                  }`}
                >
                  <SineCoinIcon className="h-4 w-4" />
                  {formatCoins(coins - finalPrice)} SC
                </p>
                {couponActive && (
                  <p className="text-[10px] font-bold text-emerald-300">%20 Kupon İndirimi Uygulandı</p>
                )}
              </div>
            </div>

            {!canAfford && (
              <p className="mt-2.5 text-center text-xs font-bold text-rose-400">
                Bu işlem için {(finalPrice - coins).toLocaleString('tr-TR')} SC daha gerekiyor.
              </p>
            )}

            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setTarget(null)}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-ink-200 transition hover:bg-white/10"
              >
                Vazgeç
              </button>
              <button
                onClick={confirmPurchase}
                disabled={
                  !canAfford || (isCosmetic(target.kind as MarketItemKind) && owned(target.id))
                }
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 px-4 py-3 text-sm font-black text-ink-950 shadow-[0_8px_20px_-4px_rgba(245,158,11,0.5)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isCosmetic(target.kind as MarketItemKind) && owned(target.id) ? (
                  'Envanterde Mevcut'
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
    </div>
  );
}

function GridSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-xl font-black text-white">{title}</h2>
      <p className="text-sm text-ink-400">{subtitle}</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function ContractGroup({
  title,
  subtitle,
  contracts,
  onBuy,
  couponActive,
}: {
  title: string;
  subtitle: string;
  contracts: ContractDef[];
  onBuy: (contract: ContractDef) => void;
  couponActive: boolean;
}) {
  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h3 className="text-lg font-black text-white">{title}</h3>
          <p className="text-xs text-ink-400">{subtitle}</p>
        </div>
        <span className="rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gold-300">
          {contracts.length} Kontrat
        </span>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {contracts.map((contract) => (
          <ContractCard
            key={contract.id}
            contract={contract}
            price={couponActive ? Math.max(1, Math.round(contract.price * 0.8)) : contract.price}
            onBuy={() => onBuy(contract)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Premium Pazar Kontrat Kartı (Çerçevesiz İkon + Nadirlik Işıltısı)
 */
function ContractCard({
  contract,
  price,
  onBuy,
}: {
  contract: ContractDef;
  price: number;
  onBuy: () => void;
}) {
  const style = CONTRACT_RARITY_STYLES[contract.rarity];
  return (
    <article
      onClick={onBuy}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-3xl border ${style.border} ${style.bg} ${style.shadow} p-5 transition-all duration-300 hover:-translate-y-1`}
    >
      {/* Üst Nadirlik Işık Çizgisi */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${style.accentBar}`}
      />

      {/* Nadirlik Rozeti */}
      <div
        className={`absolute right-4 top-4 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${style.badgeBg}`}
      >
        {style.label}
      </div>

      {/* Çerçevesiz Öne Çıkan İkon & Başlık */}
      <div className="flex items-center gap-4 pr-20">
        <FramelessContractArtwork contract={contract} size="md" />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ink-400">
            {contract.type === 'daily' ? 'Günlük Kontrat' : 'Haftalık Kontrat'} ·{' '}
            {contract.durationHours === 24 ? '24 Saat' : '7 Gün'}
          </p>
          <h3 className="mt-0.5 text-base font-black leading-snug text-white group-hover:text-gold-200 transition-colors">
            {contract.title}
          </h3>
        </div>
      </div>

      <p className="mt-3.5 line-clamp-2 min-h-[34px] text-xs leading-relaxed text-ink-300">
        {contract.description}
      </p>

      {/* Hedef Etiketleri */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {contract.requirements.map((req) => (
          <span
            key={req.metric}
            className="rounded-lg border border-white/10 bg-ink-950/60 px-2.5 py-1 text-[10px] font-bold text-ink-200"
          >
            {req.target} {METRIC_LABELS[req.metric]}
          </span>
        ))}
      </div>

      <p className="mt-2 text-[10px] font-bold text-rose-300/80">
        Süre dolarsa −{CONTRACT_FAILURE_PENALTY[contract.rarity]} SC ceza
      </p>

      {/* Alt Ödül ve Satın Alma Çubuğu */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/5 pt-4 mt-4">
        <div className="flex items-center gap-1.5 text-[11px] font-black">
          <span className="rounded-full border border-azure-400/30 bg-azure-500/15 px-2.5 py-0.5 text-azure-200">
            +{contract.xpReward} XP
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-gold-400/30 bg-gold-500/15 px-2.5 py-0.5 text-gold-200">
            <SineCoinIcon className="h-3 w-3" /> +{contract.coinReward}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onBuy();
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-gold-400 to-amber-500 px-3.5 py-2 text-xs font-black text-ink-950 shadow-[0_4px_14px_-2px_rgba(245,158,11,0.45)] transition group-hover:brightness-110"
        >
          <SineCoinIcon className="h-3.5 w-3.5" />
          {formatCoins(price)} SC
        </button>
      </div>
    </article>
  );
}

/**
 * Premium Pazar Eşyası Kartı (Çerçevesiz Yüzen İkon + Vitrin Tasarımı)
 */
function ItemCard({
  item,
  price,
  owned,
  onAction,
}: {
  item: MarketItemDef;
  price: number;
  owned: boolean;
  onAction: () => void;
}) {
  const style = CONTRACT_RARITY_STYLES[item.rarity];
  const alreadyOwned = owned && isCosmetic(item.kind);

  return (
    <article
      onClick={() => {
        if (!alreadyOwned) onAction();
      }}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border ${style.border} ${style.bg} ${style.shadow} p-5 transition-all duration-300 ${
        alreadyOwned ? 'opacity-80' : 'cursor-pointer hover:-translate-y-1'
      }`}
    >
      {/* Üst Nadirlik Işık Çizgisi */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${style.accentBar}`}
      />

      {/* Nadirlik Rozeti */}
      <div
        className={`absolute right-4 top-4 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${style.badgeBg}`}
      >
        {style.label}
      </div>

      {/* Çerçevesiz İkon & Başlık */}
      <div className="flex items-center gap-4 pr-20">
        <FramelessMarketArtwork item={item} size="md" />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ink-400">
            {KIND_LABELS[item.kind]}
          </p>
          <h3 className="mt-0.5 text-base font-black leading-snug text-white group-hover:text-gold-200 transition-colors">
            {item.name}
          </h3>
        </div>
      </div>

      <p className="mt-3.5 line-clamp-2 min-h-[34px] text-xs leading-relaxed text-ink-300">
        {item.description}
      </p>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/5 pt-4 mt-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-black text-gold-200">
          <SineCoinIcon className="h-4 w-4" />
          {formatCoins(price)} <span className="text-[10px] text-gold-400">SC</span>
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
          disabled={alreadyOwned}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gold-400/40 bg-gold-500/15 px-3.5 py-2 text-xs font-black text-gold-100 transition hover:border-gold-400/75 hover:bg-gold-500/25 disabled:cursor-default disabled:border-emerald-500/30 disabled:bg-emerald-500/10 disabled:text-emerald-300"
        >
          {alreadyOwned ? (
            <>
              <Check className="h-3.5 w-3.5" /> Envanterde
            </>
          ) : (
            'Satın Al'
          )}
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