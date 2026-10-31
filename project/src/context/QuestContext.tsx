import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { useApp } from './AppContext'; 
import { QUEST_DEFS, RARITY_STYLES, QuestIcon } from '../lib/quests';
import { Sparkles } from 'lucide-react';
import { evaluateQuestCompletion } from '../lib/questLogic';
import { isSoundBusy, playQuestCompleteSound } from '../lib/sound';
import { CONTRACT_MAP, CONTRACT_FAILURE_PENALTY, contractItemId } from '../lib/contracts';
import { evaluateContractProgress, remainingLabel, weekKey } from '../lib/contractLogic';
import { LIFETIME_QUEST_COINS } from '../lib/coins';
import { todayStr } from '../lib/utils';
import type { ActiveContract, ContractHistoryEntry } from '../types';
import { MARKET_ITEM_MAP } from '../lib/marketItems';

const QUEST_STORAGE_KEY = 'sinevia-quests-v1';

interface QuestState {
  activeQuestId: string | null;      
  questAcceptedAt: number | null;    
  questRejects: number;              
  questCooldownUntil: number | null; 
  completedQuests: string[];         
  activeBadgeId: string | null;
  isPenaltyEnabled: boolean;
  activeContract?: ActiveContract | null;
  contractHistory?: ContractHistoryEntry[];
  /** Günlük ücretsiz görev kullanımı (tarih + kullanılan adet). */
  freeDailyUsage?: { date: string; count: number };
  /** Sabitlenmiş görevin ücretsiz başlatma hakkının kullanıldığı hafta. */
  freePinnedUsage?: { week: string; contractId: string };
}

interface QuestContextValue {
  questState: QuestState;
  acceptQuest: (questId: string) => void;
  rejectActiveQuest: () => void;
  completeActiveQuest: (questId: string) => void;
  equipBadge: (questId: string | null) => void;
  togglePenalty: () => void; 
  resetQuestData: () => void;
  activeContract: ActiveContract | null;
  contractHistory: ContractHistoryEntry[];
  activateContract: (contractId: string) => boolean;
  cancelContract: () => void;
  extendActiveContract: (itemId?: string) => boolean;
  activeContractProgress: ReturnType<typeof evaluateContractProgress> | null;
  activeContractRemaining: string;
}

const defaultQuestState: QuestState = {
  activeQuestId: null,
  questAcceptedAt: null,
  questRejects: 0,
  questCooldownUntil: null,
  completedQuests: [],
  activeBadgeId: null,
  isPenaltyEnabled: false,
  activeContract: null,
  contractHistory: [],
};

const QuestContext = createContext<QuestContextValue | null>(null);

export function useQuests() {
  const ctx = useContext(QuestContext);
  if (!ctx) throw new Error('useQuests must be used within QuestProvider');
  return ctx;
}

export function QuestProvider({ children }: { children: ReactNode }) {
  const { data, grantXp, grantCoins, grantItem, grantContractReward, recordMarketOutcome, consumeEffect, setIsQuestCelebrating, isQuestCelebrating, levelUpData, seasonCompleteData, xpGainData, achievementToasts, levelUpQueuedRef, levelUpOpenRef, seasonOpenRef, seasonQueuedRef, xpGainOpenRef, contractCelebratingRef, contractQueuedRef, questCelebratingRef, questQueuedRef, activateItem, showToast, requestContractCelebration, isContractCelebrating, coinGainData, queuedCoinGain, setContractCompletionPending } = useApp();

  // Ses hâlâ çalarken görev kutlaması başlamasın diye kısa nabız.
  const [soundTick, setSoundTick] = useState(0);
  useEffect(() => {
    if (!isSoundBusy()) return;
    const timer = window.setTimeout(() => setSoundTick((tick) => tick + 1), 200);
    return () => window.clearTimeout(timer);
  }, [soundTick, isQuestCelebrating, isContractCelebrating]);

  const [questState, setQuestState] = useState<QuestState>(() => {
    try {
      // TAM SIFIRLAMA ("Her Şeyi Sil"): sıfırlama bayrağı ayaktayken eski görev
      // verisini localStorage'dan GERİ YÜKLEME. QuestProvider, AppProvider'ın
      // çocuğu olduğu için bu başlatıcı, AppProvider'ın bayrağı görüp anahtarı
      // sildiği effect'ten ÖNCE çalışır; guard olmazsa silinen görevler geri gelir.
      if (localStorage.getItem('sinevia_zero_reset') === '1') return defaultQuestState;
      const stored = localStorage.getItem(QUEST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.questCooldownUntil && Date.now() >= parsed.questCooldownUntil) {
          parsed.questCooldownUntil = null;
          parsed.questRejects = 0;
        }
        return { ...defaultQuestState, ...parsed };
      }
    } catch (e) {
      console.error(e);
    }
    return defaultQuestState;
  });

  const [celebratingQuestId, setCelebratingQuestId] = useState<string | null>(null);

  // SIRA: görev tamamlanınca tam ekran kutlama (seviye/sezon) veya XP kartı
  // AÇIKSA kutlama ertelenir; hepsi bitince sırayla başlatılır.
  const queuedCelebrationRef = useRef<string | null>(null);

  useEffect(() => {
    // Tam sıfırlama sürerken görev verisini geri YAZMA (silinen hesap dirilmesin).
    if (localStorage.getItem('sinevia_zero_reset') === '1') return;
    localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(questState));
  }, [questState]);

  // Yedek geri yükleme / bulut eşitleme görevleri localStorage'a yazdığında
  // QuestContext'i anında tazele (yeniden yükleme beklemeden).
  useEffect(() => {
    const restoreQuests = () => {
      try {
        const stored = localStorage.getItem(QUEST_STORAGE_KEY);
        if (!stored) {
          setQuestState(defaultQuestState);
          return;
        }
        const parsed = JSON.parse(stored);
        setQuestState({ ...defaultQuestState, ...parsed });
      } catch {
        setQuestState(defaultQuestState);
      }
    };
    window.addEventListener('sinevia-quests-restored', restoreQuests);
    return () => window.removeEventListener('sinevia-quests-restored', restoreQuests);
  }, []);

  const togglePenalty = () => {
    setQuestState(prev => ({
      ...prev,
      isPenaltyEnabled: !prev.isPenaltyEnabled,
      questRejects: 0,
      questCooldownUntil: null
    }));
  };

  const acceptQuest = (questId: string) => {
    setQuestState((prev) => ({
      ...prev,
      activeQuestId: questId,
      questAcceptedAt: Date.now(), 
    }));
  };

  const rejectActiveQuest = () => {
    setQuestState((prev) => {
      if (!prev.isPenaltyEnabled) {
        return { ...prev, activeQuestId: null, questAcceptedAt: null };
      }

      const newRejects = prev.questRejects + 1;
      let newCooldown = prev.questCooldownUntil;
      
      if (newRejects >= 3) {
        newCooldown = Date.now() + 24 * 60 * 60 * 1000; 
      }
      
      return {
        ...prev,
        activeQuestId: null,
        questAcceptedAt: null,
        questRejects: newRejects >= 3 ? 0 : newRejects,
        questCooldownUntil: newCooldown,
      };
    });
  };

  const completeActiveQuest = (questId: string) => {
    setQuestState((prev) => {
      const newCompleted = Array.from(new Set([...prev.completedQuests, questId]));
      return {
        ...prev,
        activeQuestId: null,
        questAcceptedAt: null,
        completedQuests: newCompleted,
        questRejects: 0, 
      };
    });
  };

  const equipBadge = (questId: string | null) => {
    setQuestState((prev) => ({ ...prev, activeBadgeId: questId }));
  };

  const resetQuestData = () => {
    setQuestState(defaultQuestState);
  };


  const activeContract = questState.activeContract || null;
  const contractHistory = questState.contractHistory || [];

  const activeContractProgress = useMemo(() => {
    if (!activeContract) return null;
    const def = CONTRACT_MAP.get(activeContract.contractId);
    if (!def) return null;
    return evaluateContractProgress(def, activeContract.startedAt, data);
  }, [activeContract, data]);

  // Pazar görevi tamamlandığında AppContext'in XP/başarım efektleri aynı
  // commit'te araya girmesin. Layout effect, pasif efektlerden ÖNCE çalışır;
  // böylece sözleşme kutlaması gerçekten ilk sırada açılır.
  useLayoutEffect(() => {
    setContractCompletionPending(Boolean(activeContract && activeContractProgress?.completed));
    return () => setContractCompletionPending(false);
  }, [activeContract, activeContractProgress, setContractCompletionPending]);

  const activeContractRemaining = activeContract
    ? remainingLabel(activeContract)
    : '';

  const activateContract = (contractId: string): boolean => {
    if (questState.activeContract) {
      showToast('Aynı anda yalnızca 1 pazar görevi aktif olabilir.', 'warning');
      return false;
    }
    const def = CONTRACT_MAP.get(contractId);
    if (!def) return false;

    const today = todayStr();
    const currentWeek = weekKey();
    const usedToday =
      questState.freeDailyUsage?.date === today ? questState.freeDailyUsage.count : 0;
    const freeDailyLimit = 1 + ((data.perks || []).includes('contract_slot') ? 1 : 0);
    const dailyFree = def.type === 'daily' && usedToday < freeDailyLimit;
    const pinFreeAlreadyUsed =
      questState.freePinnedUsage?.week === currentWeek &&
      questState.freePinnedUsage?.contractId === contractId;
    const pinnedFree =
      data.pinnedContract?.contractId === contractId &&
      data.pinnedContract?.week === currentWeek &&
      !pinFreeAlreadyUsed;
    const freeSource: 'daily' | 'pin' | undefined = pinnedFree
      ? 'pin'
      : dailyFree
        ? 'daily'
        : undefined;

    if (!freeSource) {
      const itemId = contractItemId(contractId);
      const owned = (data.inventory || []).find((entry) => entry.itemId === itemId)?.quantity || 0;
      if (owned <= 0) {
        showToast('Bu görev envanterinde yok. Önce pazardan satın al.', 'warning');
        return false;
      }
      activateItem(itemId, 'contract_activate', `${def.title} aktifleştirildi`);
    } else {
      showToast(
        freeSource === 'pin'
          ? `${def.title} ücretsiz başlatıldı (sabitlenmiş görev).`
          : `${def.title} ücretsiz başlatıldı.`,
        'success',
      );
    }

    const startedAt = Date.now();
    const expiresAt = startedAt + def.durationHours * 60 * 60 * 1000;
    setQuestState((prev) => ({
      ...prev,
      activeContract: {
        instanceId: `ci_${startedAt}_${Math.random().toString(36).slice(2, 8)}`,
        contractId,
        startedAt,
        expiresAt,
        free: Boolean(freeSource),
        freeSource,
      },
      freeDailyUsage:
        freeSource === 'daily'
          ? { date: today, count: usedToday + 1 }
          : prev.freeDailyUsage,
      freePinnedUsage:
        freeSource === 'pin'
          ? { week: currentWeek, contractId }
          : prev.freePinnedUsage,
    }));
    return true;
  };

  const cancelContract = () => {
    if (!questState.activeContract) return;
    const def = CONTRACT_MAP.get(questState.activeContract.contractId);
    recordMarketOutcome(
      'cancelled',
      def?.type === 'weekly',
      0,
      `Görev iptali: ${def?.title || 'Pazar görevi'}`,
      `contract-cancel:${questState.activeContract.instanceId}`,
    );
    setQuestState((prev) => ({ ...prev, activeContract: null }));
    showToast(
      questState.activeContract.free
        ? 'Ücretsiz pazar görevi iptal edildi.'
        : 'Pazar görevi iptal edildi. Satın alınan görev tüketildi.',
      'info',
    );
  };

  const extendActiveContract = (itemId = 'util_contract_extension'): boolean => {
    if (!questState.activeContract) {
      showToast('Uzatılacak aktif bir görev yok.', 'warning');
      return false;
    }
    const def = CONTRACT_MAP.get(questState.activeContract.contractId);
    if (!def) return false;
    const hours = def.type === 'daily' ? 24 : 72;
    activateItem(itemId, 'contract_extension', `Görev süresi +${hours} saat uzatıldı`);
    setQuestState((prev) =>
      prev.activeContract
        ? {
            ...prev,
            activeContract: {
              ...prev.activeContract,
              expiresAt: prev.activeContract.expiresAt + hours * 60 * 60 * 1000,
            },
          }
        : prev,
    );
    return true;
  };

  const applyContractFailure = (instanceId: string, contractId: string) => {
    const def = CONTRACT_MAP.get(contractId);
    if (!def) {
      setQuestState((prev) => ({ ...prev, activeContract: null }));
      return;
    }
    const wasFree =
      questState.activeContract?.instanceId === instanceId &&
      Boolean(questState.activeContract?.free);
    let penalty = wasFree ? 0 : CONTRACT_FAILURE_PENALTY[def.rarity] || 25;
    const waiver = !wasFree && (data.activeEffects || []).some(
      (effect) => effect.itemId === 'util_penalty_waiver' && (effect.charges || 1) > 0,
    );
    if (waiver) {
      consumeEffect('util_penalty_waiver');
      penalty = 0;
      showToast('Ceza Affı kullanıldı: ceza uygulanmadı.', 'success');
    }
    const insured = !wasFree && (data.activeEffects || []).some(
      (effect) => effect.itemId === 'util_contract_insurance' && (effect.charges || 1) > 0,
    );
    if (insured) {
      consumeEffect('util_contract_insurance');
      const refund = Math.max(1, Math.round(def.price * 0.5));
      grantCoins(refund, 'refund', `Görev sigortası: ${def.title}`, `contract-insurance:${instanceId}`);
    }
    recordMarketOutcome(
      'failed',
      def.type === 'weekly',
      penalty,
      `Görev cezası: ${def.title}`,
      `contract-fail:${instanceId}`,
    );
    setQuestState((prev) => ({ ...prev, activeContract: null }));
    if (wasFree) {
      showToast(`"${def.title}" ücretsiz görevi sona erdi. Ceza yok.`, 'info');
    } else if (penalty > 0) {
      showToast(`"${def.title}" süresi doldu. ${penalty} SC ceza uygulandı.`, 'warning');
    } else {
      showToast(`"${def.title}" süresi doldu. Ceza uygulanmadı.`, 'info');
    }
  };

  // Layout effect: pazar görevi kutlaması, aynı commit'te açılan XP/başarım
  // efektlerinden ÖNCE sırayı kapmalı. Passive effect parent-first çalıştığı
  // için contract ref'i geç kalıyor ve XP barı öne geçiyordu.
  useLayoutEffect(() => {
    if (!activeContract) return;
    const def = CONTRACT_MAP.get(activeContract.contractId);
    if (!def) return;
    if (Date.now() >= activeContract.expiresAt) {
      applyContractFailure(activeContract.instanceId, activeContract.contractId);
      return;
    }
    const progress = evaluateContractProgress(def, activeContract.startedAt, data);
    if (!progress.completed) return;

    const doubled = (data.activeEffects || []).some(
      (effect) => effect.itemId === 'util_double_reward' && (effect.charges || 1) > 0,
    );
    const boosted = (data.activeEffects || []).some(
      (effect) => effect.itemId === 'util_xp_boost' && (effect.charges || 1) > 0,
    );
    const coins = activeContract.free
      ? 0
      : Math.round(def.coinReward * (doubled ? 2 : 1));
    const boostedMultiplier = (boosted ? 1.5 : 1) * (doubled ? 1.1 : 1);
    const gainedXp = Math.round(def.xpReward * boostedMultiplier);
    if (doubled) consumeEffect('util_double_reward');
    if (boosted) consumeEffect('util_xp_boost');
    // Pazar görevi kutlaması her şeyden önce kuyruğa girer. Ödül dispatch'i
    // XP/başarım effect'lerini tetiklemeden önce ref'i işaretlemek gerekir;
    // aksi halde XP barı görev animasyonunun önüne geçiyor.
    requestContractCelebration({ contractId: activeContract.contractId, xp: gainedXp, coins, rarity: def.rarity });
    // XP defterine (contract, contract:<instanceId>) olarak yazılır; base ve
    // çarpan AYRI saklanır (amount nihaî). Aynı örnek ikinci kez XP yazmaz.
    grantContractReward(gainedXp, coins, `contract:${activeContract.instanceId}`, def.title, {
      base: def.xpReward,
      multiplier: boostedMultiplier,
      sourceId: `contract:${activeContract.instanceId}`,
    });
    setQuestState((prev) => ({
      ...prev,
      activeContract: null,
      contractHistory: [
        {
          instanceId: activeContract.instanceId,
          contractId: activeContract.contractId,
          startedAt: activeContract.startedAt,
          completedAt: Date.now(),
          xp: gainedXp,
          coins,
          free: activeContract.free,
        },
        ...(prev.contractHistory || []),
      ].slice(0, 100),
    }));
  }, [activeContract, data, consumeEffect, grantContractReward, recordMarketOutcome, requestContractCelebration, showToast]);

  useEffect(() => {
    if (!activeContract) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= activeContract.expiresAt) {
        applyContractFailure(activeContract.instanceId, activeContract.contractId);
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [activeContract, recordMarketOutcome, showToast]);

  useEffect(() => {
    if (!questState.activeQuestId || !questState.questAcceptedAt) return;

    const isCompleted = evaluateQuestCompletion(
      questState.activeQuestId,
      questState.questAcceptedAt,
      data.history,
      data.movies,
      data.dailyStreak,
      data.series
    );

    if (isCompleted) {
      const questDef = QUEST_DEFS.find((q) => q.id === questState.activeQuestId);
      if (questDef) {
        if (questDef.itemReward) {
          grantItem(questDef.itemReward, `Görev ödülü: ${questDef.title}`, `questitem:${questDef.id}`);
        } else {
          grantCoins(
            questDef.coinReward ?? LIFETIME_QUEST_COINS[questDef.rarity] ?? 20,
            'lifetime_quest',
            `Görev: ${questDef.title}`,
            `quest:${questDef.id}`,
          );
        }
      }
      completeActiveQuest(questState.activeQuestId);
      queuedCelebrationRef.current = null;
      if (isSoundBusy() || contractCelebratingRef.current || contractQueuedRef.current || seasonCompleteData || seasonOpenRef.current || seasonQueuedRef.current || xpGainData || levelUpData || achievementToasts.length > 0 || coinGainData) {
        queuedCelebrationRef.current = questState.activeQuestId;
questQueuedRef.current = true;
      } else {
        setIsQuestCelebrating(true);
        setCelebratingQuestId(questState.activeQuestId);
      }
    }

  }, [data.history, data.movies, data.series, data.pendingLevelUp, data.pendingToasts, questState.activeQuestId, questState.questAcceptedAt, data.dailyStreak, levelUpData, seasonCompleteData, xpGainData, achievementToasts, isContractCelebrating, coinGainData, queuedCoinGain, soundTick, grantCoins, grantItem]);

  useEffect(() => {
    const qid = queuedCelebrationRef.current;
    if (!qid) return;
    if (isSoundBusy() || isContractCelebrating || contractCelebratingRef.current || contractQueuedRef.current || seasonCompleteData || seasonOpenRef.current || seasonQueuedRef.current || xpGainData || levelUpData || achievementToasts.length > 0 || coinGainData) return;
    queuedCelebrationRef.current = null;
    questQueuedRef.current = false;
    setIsQuestCelebrating(true);
    setCelebratingQuestId(qid);
  }, [levelUpData, seasonCompleteData, xpGainData, data.pendingLevelUp, data.pendingToasts, achievementToasts, isContractCelebrating, coinGainData, queuedCoinGain, soundTick]);

  return (
    <QuestContext.Provider value={{ 
      questState, 
      acceptQuest, 
      rejectActiveQuest,
      completeActiveQuest,
      equipBadge,
      togglePenalty,
      resetQuestData,
      activeContract,
      contractHistory,
      activateContract,
      cancelContract,
      extendActiveContract,
      activeContractProgress,
      activeContractRemaining,
    }}>
      {children}

      {celebratingQuestId && (
        <QuestCelebrationOverlay 
          questId={celebratingQuestId} 
          onClaim={(xp) => {
            const def = QUEST_DEFS.find((q) => q.id === celebratingQuestId);
            // Görev XP'si deftere (quest, quest:<id>) olarak yazılır; listeden
            // yeniden toplanmaz, aynı görev ikinci kez XP yazmaz.
            grantXp(
              xp,
              'quest',
              `quest:${celebratingQuestId}`,
              def ? `${def.title}` : 'Görev',
              def?.xpReward ?? xp,
              1,
            );
            setCelebratingQuestId(null);
            setIsQuestCelebrating(false); 
          }} 
        />
      )}
    </QuestContext.Provider>
  );
}

// ----------------------------------------------------------------------
// NADİRLİK (TIER) GÖRSEL KONFİGÜRASYONU & KADEMELİ EFEKT MOTORU
// ----------------------------------------------------------------------
type TierLevel = 1 | 2 | 3 | 4 | 5;

interface TierVisualConfig {
  level: TierLevel;
  labelTr: string;
  accentHex: string;
  secondaryHex: string;
  glowRgba: string;
  particleCount: number;
  ringCount: number;
  shockwaveCount: number;
  hasGodRays: boolean;
  hasLaserSweep: boolean;
  hasVacuumImplosion: boolean;
  shakeClassDrop: string;
  shakeClassSeal: string;
  titleGradient: string;
  buttonAura: string;
  terminalTag: string;
}

function getTierVisualConfig(rarity?: string): TierVisualConfig {
  const r = (rarity || 'common').trim().toLowerCase();

  if (r.includes('mythic') || r.includes('mitik')) {
    return {
      level: 5,
      labelTr: 'MİTİK TEKİLLİK KONTRATI',
      accentHex: '#f43f5e',
      secondaryHex: '#a855f7',
      glowRgba: 'rgba(244, 63, 94, 0.55)',
      particleCount: 46,
      ringCount: 3,
      shockwaveCount: 3,
      hasGodRays: true,
      hasLaserSweep: true,
      hasVacuumImplosion: true,
      shakeClassDrop: 'animate-[qShakeHeavy_0.65s_cubic-bezier(0.36,0.07,0.19,0.97)_both]',
      shakeClassSeal: 'animate-[qShakeHeavy_0.55s_cubic-bezier(0.36,0.07,0.19,0.97)_both]',
      titleGradient: 'from-rose-200 via-white to-fuchsia-300 drop-shadow-[0_0_65px_rgba(244,63,94,0.75)]',
      buttonAura: 'from-rose-500 via-fuchsia-500 to-amber-400',
      terminalTag: 'KOZMİK TEKİLLİK PROTOKOLÜ // SEVİYE V',
    };
  }

  if (r.includes('legend') || r.includes('efsane')) {
    return {
      level: 4,
      labelTr: 'EFSANEVİ KRALİYET KONTRATI',
      accentHex: '#f59e0b',
      secondaryHex: '#fde047',
      glowRgba: 'rgba(245, 158, 11, 0.5)',
      particleCount: 32,
      ringCount: 2,
      shockwaveCount: 2,
      hasGodRays: true,
      hasLaserSweep: true,
      hasVacuumImplosion: false,
      shakeClassDrop: 'animate-[qShakeMedium_0.55s_cubic-bezier(0.36,0.07,0.19,0.97)_both]',
      shakeClassSeal: 'animate-[qShakeMedium_0.45s_cubic-bezier(0.36,0.07,0.19,0.97)_both]',
      titleGradient: 'from-amber-100 via-yellow-200 to-amber-400 drop-shadow-[0_0_55px_rgba(245,158,11,0.65)]',
      buttonAura: 'from-amber-400 via-yellow-300 to-orange-500',
      terminalTag: 'KRALİYET ARŞİV PROTOKOLÜ // SEVİYE IV',
    };
  }

  if (r.includes('epic') || r.includes('epik')) {
    return {
      level: 3,
      labelTr: 'EPİK SİNEMATİK KONTRAT',
      accentHex: '#a855f7',
      secondaryHex: '#ec4899',
      glowRgba: 'rgba(168, 85, 247, 0.45)',
      particleCount: 22,
      ringCount: 2,
      shockwaveCount: 2,
      hasGodRays: true,
      hasLaserSweep: false,
      hasVacuumImplosion: false,
      shakeClassDrop: 'animate-[qShakeLight_0.45s_ease-in-out_both]',
      shakeClassSeal: 'animate-[qShakeLight_0.38s_ease-in-out_both]',
      titleGradient: 'from-purple-100 via-white to-fuchsia-300 drop-shadow-[0_0_45px_rgba(168,85,247,0.55)]',
      buttonAura: 'from-purple-500 via-fuchsia-400 to-indigo-500',
      terminalTag: 'YÜKSEK FREKANS PROTOKOLÜ // SEVİYE III',
    };
  }

  if (r.includes('rare') || r.includes('nadir')) {
    return {
      level: 2,
      labelTr: 'NADİR PRİZMA KONTRATI',
      accentHex: '#38bdf8',
      secondaryHex: '#818cf8',
      glowRgba: 'rgba(56, 189, 248, 0.38)',
      particleCount: 14,
      ringCount: 1,
      shockwaveCount: 1,
      hasGodRays: false,
      hasLaserSweep: false,
      hasVacuumImplosion: false,
      shakeClassDrop: '',
      shakeClassSeal: '',
      titleGradient: 'from-sky-100 via-white to-cyan-300 drop-shadow-[0_0_38px_rgba(56,189,248,0.45)]',
      buttonAura: 'from-sky-400 via-cyan-300 to-blue-500',
      terminalTag: 'KRİSTAL PRİZMA PROTOKOLÜ // SEVİYE II',
    };
  }

  // Common (Varsayılan - Sade, sıcak ve zarif)
  return {
    level: 1,
    labelTr: 'STANDART KONTRAT',
    accentHex: '#10b981',
    secondaryHex: '#34d399',
    glowRgba: 'rgba(16, 185, 129, 0.28)',
    particleCount: 8,
    ringCount: 0,
    shockwaveCount: 1,
    hasGodRays: false,
    hasLaserSweep: false,
    hasVacuumImplosion: false,
    shakeClassDrop: '',
    shakeClassSeal: '',
    titleGradient: 'from-white via-white to-emerald-200/70 drop-shadow-[0_0_30px_rgba(255,255,255,0.22)]',
    buttonAura: 'from-emerald-400 via-teal-300 to-emerald-500',
    terminalTag: 'STANDART AĞ PROTOKOLÜ // SEVİYE I',
  };
}

// ----------------------------------------------------------------------
// SİNEMATİK KUTLAMA MODALI BİLEŞENİ (0.0s -> 3.0s -> 5.0s TAM SENKRON)
// ----------------------------------------------------------------------
function QuestCelebrationOverlay({ questId, onClaim }: { questId: string, onClaim: (xp: number) => void }) {
  const def = QUEST_DEFS.find(q => q.id === questId);
  const [phase, setPhase] = useState(0);
  const [isVacuum, setIsVacuum] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  const tierCfg = useMemo(() => getTierVisualConfig(def?.rarity), [def?.rarity]);

  // Deterministik kozmik parçacık dizisi (Her tier'da sayı, hız ve parlaklık artar)
  const particles = useMemo(() => {
    return Array.from({ length: tierCfg.particleCount }, (_, i) => {
      const seed = (i * 73 + 19) % 100;
      const left = (i * (100 / tierCfg.particleCount) + (seed % 7)) % 98;
      const size = tierCfg.level >= 4 ? 2.5 + (i % 4) * 1.4 : 2 + (i % 3);
      const delay = (i * 0.17) % 2.4;
      const duration = Math.max(2.2, 5.2 - tierCfg.level * 0.45 + (i % 3) * 0.6);
      const isSecondary = i % 2 === 1;
      return { id: i, left, size, delay, duration, isSecondary };
    });
  }, [tierCfg.particleCount, tierCfg.level]);

  useEffect(() => {
    // Görevin tier'ine (Common, Rare, Epic, Legendary, Mythic) özel senfoniyi başlatır:
    playQuestCompleteSound(def?.rarity);

    // Phase 0 içinde 0% -> 100% senkronizasyon sayacı (2.85 saniyede 100'e ulaşır)
    const start = performance.now();
    const progInterval = setInterval(() => {
      const elapsed = performance.now() - start;
      const p = Math.min(100, Math.floor((elapsed / 2820) * 100));
      setSyncProgress(p);
      if (p >= 100) clearInterval(progInterval);
    }, 35);

    // Mythic için 2.91s'de 90ms'lik IMAX Vakum Kararması (Ses ile milimetrik senkron)
    const tVacuum = tierCfg.hasVacuumImplosion
      ? setTimeout(() => setIsVacuum(true), 2910)
      : null;

    // ANA FAZ SÜRELERİ KESİNLİKLE KORUNDU (3000ms ve 5000ms)
    const t1 = setTimeout(() => {
      setIsVacuum(false);
      setPhase(1);
    }, 3000);

    const t2 = setTimeout(() => {
      setPhase(2);
    }, 5000);

    return () => {
      clearInterval(progInterval);
      if (tVacuum) clearTimeout(tVacuum);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [def?.rarity, tierCfg.hasVacuumImplosion]);

  if (!def) return null;
  const style = RARITY_STYLES[def.rarity];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4 overflow-hidden select-none">
      {/* ÖZEL SİNEMATİK KEYFRAME ANİMASYONLARI */}
      <style>{`
        @keyframes qFloatUp {
          0% { transform: translateY(45vh) scale(0.4); opacity: 0; }
          25% { opacity: 0.9; }
          80% { opacity: 0.75; }
          100% { transform: translateY(-55vh) scale(1.25); opacity: 0; }
        }
        @keyframes qShockwave {
          0% { transform: translate(-50%, -50%) scale(0.45); opacity: 0.95; }
          100% { transform: translate(-50%, -50%) scale(3.3); opacity: 0; }
        }
        @keyframes qFlashBurst {
          0% { opacity: 0.85; }
          100% { opacity: 0; }
        }
        @keyframes qSpinSlow {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes qSpinReverse {
          from { transform: translate(-50%, -50%) rotate(360deg); }
          to { transform: translate(-50%, -50%) rotate(0deg); }
        }
        @keyframes qLaserScan {
          0% { top: -10%; opacity: 0; }
          15% { opacity: 0.9; }
          85% { opacity: 0.9; }
          100% { top: 110%; opacity: 0; }
        }
        @keyframes qShimmerSweep {
          0% { transform: translateX(-140%) skewX(-25deg); }
          45%, 100% { transform: translateX(220%) skewX(-25deg); }
        }
        @keyframes qShakeLight {
          0%, 100% { transform: translate3d(0, 0, 0); }
          20% { transform: translate3d(-4px, 3px, 0); }
          40% { transform: translate3d(4px, -3px, 0); }
          60% { transform: translate3d(-3px, -2px, 0); }
          80% { transform: translate3d(3px, 2px, 0); }
        }
        @keyframes qShakeMedium {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          15% { transform: translate3d(-8px, 6px, 0) scale(1.015); }
          30% { transform: translate3d(8px, -6px, 0) scale(0.99); }
          45% { transform: translate3d(-6px, -4px, 0) scale(1.01); }
          60% { transform: translate3d(6px, 4px, 0); }
          75% { transform: translate3d(-3px, 2px, 0); }
        }
        @keyframes qShakeHeavy {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          12% { transform: translate3d(-14px, 10px, 0) scale(1.03); }
          24% { transform: translate3d(14px, -10px, 0) scale(0.98); }
          36% { transform: translate3d(-11px, -8px, 0) scale(1.02); }
          48% { transform: translate3d(11px, 8px, 0) scale(0.99); }
          64% { transform: translate3d(-7px, 5px, 0); }
          80% { transform: translate3d(5px, -4px, 0); }
        }
      `}</style>

      {/* FAZ GEÇİŞ FLAŞI (Phase 1 Drop ve Phase 2 Arma Mühürlenme Anında Patlar) */}
      {phase === 1 && tierCfg.level >= 2 && (
        <div
          key="flash-phase-1"
          className="fixed inset-0 pointer-events-none z-50 animate-[qFlashBurst_0.85s_ease-out_forwards]"
          style={{
            background: `radial-gradient(circle at center, ${tierCfg.accentHex} 0%, rgba(255,255,255,0.45) 35%, transparent 75%)`,
            opacity: 0.15 + tierCfg.level * 0.12,
          }}
        />
      )}
      {phase === 2 && tierCfg.level >= 3 && (
        <div
          key="flash-phase-2"
          className="fixed inset-0 pointer-events-none z-50 animate-[qFlashBurst_0.75s_ease-out_forwards]"
          style={{
            background: `radial-gradient(circle at center, #ffffff 0%, ${tierCfg.accentHex} 45%, transparent 80%)`,
            opacity: 0.12 + tierCfg.level * 0.1,
          }}
        />
      )}

      {/* ATMOSFER: Perspektif Siber Izgara + Tier Nadirlik Aurası */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
        style={{
          opacity: phase === 0 ? 0.06 : 0.03 + tierCfg.level * 0.02,
          backgroundImage: `linear-gradient(${tierCfg.accentHex}44 1px, transparent 1px), linear-gradient(90deg, ${tierCfg.accentHex}44 1px, transparent 1px)`,
          backgroundSize: tierCfg.level >= 4 ? '36px 36px' : '44px 44px',
          maskImage: 'radial-gradient(ellipse at center, black 25%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 25%, transparent 75%)',
        }}
      />

      {/* Köşe Atmosfer Küreleri */}
      <div className={`absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full blur-[140px] opacity-30 animate-pulse pointer-events-none ${style.bg}`} />
      <div className={`absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full blur-[140px] opacity-30 animate-pulse [animation-delay:800ms] pointer-events-none ${style.bg}`} />

      {/* TANRISAL IŞIK HÜZMELERİ (GOD RAYS - Epic, Legendary ve Mythic İçin) */}
      {phase >= 1 && tierCfg.hasGodRays && (
        <div
          className="absolute top-1/2 left-1/2 w-[1100px] h-[1100px] pointer-events-none animate-[qSpinSlow_28s_linear_infinite] transition-opacity duration-1000"
          style={{
            opacity: phase === 2 ? (tierCfg.level === 5 ? 0.32 : 0.2) : 0.12,
            background: `conic-gradient(from 0deg, transparent 0deg, ${tierCfg.accentHex}33 18deg, transparent 38deg, ${tierCfg.secondaryHex}28 65deg, transparent 90deg, ${tierCfg.accentHex}33 125deg, transparent 160deg, ${tierCfg.secondaryHex}28 205deg, transparent 245deg, ${tierCfg.accentHex}35 295deg, transparent 340deg)`,
            maskImage: 'radial-gradient(circle, black 15%, transparent 68%)',
            WebkitMaskImage: 'radial-gradient(circle, black 15%, transparent 68%)',
          }}
        />
      )}

      {/* YÜKSELEN KOZMİK PARÇACIKLAR (Her Tier'da Yoğunlaşır) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute bottom-0 rounded-full"
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.isSecondary ? tierCfg.secondaryHex : tierCfg.accentHex,
              boxShadow: `0 0 ${p.size * 3.5}px ${p.isSecondary ? tierCfg.secondaryHex : tierCfg.accentHex}`,
              animation: `qFloatUp ${p.duration}s linear ${p.delay}s infinite`,
              opacity: phase === 0 ? 0.35 : 0.85,
            }}
          />
        ))}
      </div>

      {/* =====================================================================
          FAZ 0 (0.00s - 3.00s): SİBER TELEMETRİ & KONTRAT DOĞRULAMA EKRANI
         ===================================================================== */}
      {phase === 0 && (
        <div
          className={`relative z-10 rounded-3xl border px-6 py-9 md:px-14 md:py-11 backdrop-blur-md transition-all duration-150 ${
            isVacuum ? 'scale-[0.72] opacity-0 blur-md' : 'scale-100 opacity-100 animate-fade-in'
          }`}
          style={{
            borderColor: `${tierCfg.accentHex}55`,
            backgroundColor: `${tierCfg.accentHex}0d`,
            boxShadow: `0 0 ${45 + tierCfg.level * 22}px ${tierCfg.glowRgba}, inset 0 0 30px ${tierCfg.accentHex}15`,
          }}
        >
          {/* Legendary & Mythic için Lazer Tarama Çizgisi */}
          {tierCfg.hasLaserSweep && (
            <div
              className="absolute left-0 right-0 h-[2px] pointer-events-none animate-[qLaserScan_1.45s_ease-in-out_infinite]"
              style={{
                background: `linear-gradient(90deg, transparent, ${tierCfg.accentHex}, #ffffff, ${tierCfg.accentHex}, transparent)`,
                boxShadow: `0 0 18px ${tierCfg.accentHex}`,
              }}
            />
          )}

          {/* Üst Protokol Başlığı */}
          <div className="flex items-center justify-between gap-4 mb-5 pb-3 border-b border-white/10 text-[10px] md:text-xs font-mono tracking-[0.28em] uppercase">
            <span style={{ color: tierCfg.accentHex }} className="font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: tierCfg.accentHex }} />
              {tierCfg.terminalTag}
            </span>
            <span className="text-white/60 font-bold">{syncProgress}%</span>
          </div>

          <div
            className="font-semibold text-base md:text-xl tracking-[0.2em] md:tracking-[0.28em] text-center leading-relaxed"
            style={{ color: tierCfg.accentHex }}
          >
            &gt; SİNEVİA AĞINA BAĞLANILDI...<br />
            &gt; İZLEME GEÇMİŞİ DOĞRULANIYOR...<br />
            &gt; ŞARTLAR EŞLEŞTİ: <span className="text-white font-black drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]">KONTRAT BAŞARILI</span><br />
            <span className="text-xs md:text-sm text-white/60 tracking-[0.25em] mt-4 block font-bold">
              [{def.rarity.toUpperCase()}] MÜHÜR PROTOKOLÜ YÜKLENİYOR...
            </span>
          </div>

          {/* Canlı Dolum Barı (0.0s -> 2.9s Riser ile Senkron) */}
          <div className="mt-6 w-full h-1.5 bg-white/10 rounded-full overflow-hidden p-[1px]">
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{
                width: `${syncProgress}%`,
                background: `linear-gradient(90deg, ${tierCfg.accentHex}, #ffffff, ${tierCfg.secondaryHex})`,
                boxShadow: `0 0 16px ${tierCfg.accentHex}`,
              }}
            />
          </div>
        </div>
      )}

      {/* =====================================================================
          FAZ 1 (3.00s) & FAZ 2 (5.00s): BAŞLIK PATLAMASI VE ARMA MÜHÜRLENMESİ
         ===================================================================== */}
      {phase >= 1 && (
        <div
          key={`stage-phase-${phase}`}
          className={`relative z-10 flex flex-col items-center text-center w-full max-w-3xl ${
            phase === 1 ? tierCfg.shakeClassDrop : tierCfg.shakeClassSeal
          }`}
        >
          {/* Merkez Arka Plan Süpernova Aurası */}
          <div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[520px] blur-[150px] pointer-events-none transition-all duration-1000 ${
              phase === 2 ? style.bg.split(' ')[0] : 'bg-transparent'
            }`}
            style={{ opacity: phase === 2 ? 0.25 + tierCfg.level * 0.08 : 0.15 }}
          />

          {/* ÜST KISIM: NADİRLİK ROZETİ VE GÖREV BAŞLIĞI */}
          <div className="animate-fade-in-up mb-8 relative z-20 flex flex-col items-center">
            {/* Nadirlik rozeti (chip) */}
            <div
              className={`inline-flex items-center gap-3 px-5 py-2 rounded-full border bg-ink-950/85 backdrop-blur-md mb-5 ${style.border}`}
              style={{
                boxShadow: `0 0 ${15 + tierCfg.level * 8}px ${tierCfg.glowRgba}`,
              }}
            >
              <span className={`text-xs animate-spin [animation-duration:6s] ${style.color}`}>◆</span>
              <span className={`text-[10px] md:text-xs font-black uppercase tracking-[0.35em] ${style.color}`}>
                {def.rarity} Sınıf
              </span>
              <span className="w-px h-3.5 bg-white/20" />
              <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.35em] text-white/80">
                {tierCfg.labelTr}
              </span>
            </div>

            {/* Başlık: Tier'a Özel Parlayan Kristal/Altın/Kozmik Gradient */}
            <h3
              className={`text-5xl md:text-8xl font-black uppercase tracking-tight leading-[0.92] bg-gradient-to-b bg-clip-text text-transparent ${tierCfg.titleGradient}`}
            >
              {def.title}
            </h3>

            {/* Nadirlik renkli alt vurgu çizgisi (Tier yükseldikçe genişler ve parlar) */}
            <div className="mt-5 flex items-center justify-center gap-3">
              {tierCfg.level >= 3 && <span className={`text-xs ${style.color}`}>◇</span>}
              <div
                className={`h-1 rounded-full border-2 opacity-90 transition-all duration-700 ${style.border}`}
                style={{
                  width: `${150 + tierCfg.level * 28}px`,
                  boxShadow: `0 0 ${10 + tierCfg.level * 6}px ${tierCfg.accentHex}`,
                }}
              />
              {tierCfg.level >= 3 && <span className={`text-xs ${style.color}`}>◇</span>}
            </div>
          </div>

          {/* ORTA KISIM: GÖREV ARMASI (CREST) + KUTSAL GEOMETRİ HALKALARI + ŞOK DALGALARI */}
          <div
            className={`mt-10 transition-all duration-[1500ms] cubic-bezier(0.16, 1, 0.3, 1) z-20 relative ${
              phase === 1
                ? tierCfg.level >= 4
                  ? 'scale-[2.45] rotate-[18deg] opacity-0 blur-sm'
                  : 'scale-[2] rotate-12 opacity-0'
                : 'scale-100 rotate-0 opacity-100 blur-0'
            }`}
          >
            {/* FAZ 2 (5.00s): ARMA YERİNE OTURDUĞU AN YAYILAN SONİK ŞOK DALGALARI */}
            {phase === 2 &&
              Array.from({ length: tierCfg.shockwaveCount }).map((_, idx) => (
                <div
                  key={`shock-${idx}`}
                  className={`absolute top-1/2 left-1/2 w-60 h-60 md:w-72 md:h-72 rounded-[3.5rem] border-2 pointer-events-none ${style.border}`}
                  style={{
                    boxShadow: `0 0 35px ${tierCfg.accentHex}`,
                    animation: `qShockwave ${1.15 + idx * 0.25}s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.14}s forwards`,
                  }}
                />
              ))}

            {/* KUTSAL GEOMETRİ HALKASI 1 (Rare, Epic, Legendary, Mythic) */}
            {tierCfg.ringCount >= 1 && (
              <div
                className="absolute top-1/2 left-1/2 w-[280px] h-[280px] md:w-[345px] md:h-[345px] rounded-full border border-dashed pointer-events-none animate-[qSpinSlow_18s_linear_infinite]"
                style={{
                  borderColor: `${tierCfg.accentHex}66`,
                  boxShadow: `0 0 25px ${tierCfg.accentHex}22`,
                }}
              />
            )}

            {/* KUTSAL GEOMETRİ HALKASI 2 (Epic, Legendary, Mythic - Ters Yönde Dönen Sekizgen Çerçeve) */}
            {tierCfg.ringCount >= 2 && (
              <div
                className="absolute top-1/2 left-1/2 w-[315px] h-[315px] md:w-[385px] md:h-[385px] rounded-[4.5rem] border pointer-events-none animate-[qSpinReverse_24s_linear_infinite]"
                style={{
                  borderColor: `${tierCfg.secondaryHex}55`,
                }}
              />
            )}

            {/* KUTSAL GEOMETRİ HALKASI 3 (Sadece Mythic - Kozmik Yıldız Usturlabı) */}
            {tierCfg.ringCount >= 3 && (
              <div
                className="absolute top-1/2 left-1/2 w-[350px] h-[350px] md:w-[430px] md:h-[430px] rounded-full border-2 border-dotted pointer-events-none animate-[qSpinSlow_12s_linear_infinite]"
                style={{
                  borderColor: `${tierCfg.accentHex}88`,
                  boxShadow: `0 0 40px ${tierCfg.glowRgba}`,
                }}
              />
            )}

            {/* Nadirlik aurası */}
            <div
              className={`absolute -inset-8 rounded-[5rem] blur-2xl animate-pulse pointer-events-none ${style.bg}`}
              style={{ opacity: 0.28 + tierCfg.level * 0.09 }}
            />

            {/* Yörünge parıltıları */}
            <div className="absolute -top-4 -right-4 w-3.5 h-3.5 rounded-full bg-white animate-ping shadow-[0_0_16px_#fff]" />
            <div className="absolute -bottom-3 -left-4 w-3 h-3 rounded-full bg-white/80 animate-ping [animation-delay:600ms] shadow-[0_0_14px_#fff]" />
            {tierCfg.level >= 4 && (
              <>
                <div className="absolute -top-4 -left-4 w-3 h-3 rounded-full bg-white/90 animate-ping [animation-delay:300ms] shadow-[0_0_15px_#fff]" />
                <div className="absolute -bottom-4 -right-4 w-3.5 h-3.5 rounded-full bg-white/90 animate-ping [animation-delay:900ms] shadow-[0_0_15px_#fff]" />
              </>
            )}

            {/* ARMA ÇERÇEVESİ */}
            <div
              className={`relative w-56 h-56 md:w-72 md:h-72 rounded-[3.5rem] border-4 flex items-center justify-center bg-ink-950 overflow-hidden ${style.border}`}
              style={{
                boxShadow: `0 0 ${50 + tierCfg.level * 22}px ${tierCfg.glowRgba}, inset 0 0 ${20 + tierCfg.level * 10}px ${tierCfg.accentHex}33`,
              }}
            >
              {/* Pulsing iç zemin — çerçevenin tam ortası */}
              <div
                className={`absolute inset-0 flex items-center justify-center ${style.bg} rounded-[3.5rem] animate-pulse`}
                style={{ opacity: 0.24 + tierCfg.level * 0.05 }}
              />

              {/* HOLOGRAFİK IŞIK GEÇİŞİ (Shimmer - Rare ve Üstü Görevlerde) */}
              {tierCfg.level >= 2 && (
                <div
                  className="absolute inset-0 w-1/2 h-full pointer-events-none animate-[qShimmerSweep_3.8s_ease-in-out_infinite]"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.26), transparent)',
                  }}
                />
              )}

              {/* ARMA: çerçeve içinde mutlak ortalı */}
              <span
                className={`relative z-10 flex items-center justify-center leading-none ${style.color}`}
                style={{
                  filter: `drop-shadow(0 0 ${12 + tierCfg.level * 6}px ${tierCfg.accentHex})`,
                }}
              >
                <QuestIcon questId={def.id} size={200} className="w-36 h-36 md:w-56 md:h-56 block" />
              </span>

              {/* İç ince halka */}
              <div className={`absolute inset-3 rounded-[2.75rem] border opacity-45 pointer-events-none ${style.border}`} />
              {tierCfg.level >= 4 && (
                <div className={`absolute inset-5 rounded-[2.35rem] border border-dashed opacity-30 pointer-events-none ${style.border}`} />
              )}
            </div>
          </div>

          {/* ALT KISIM: ÖDÜL TAHSİL BUTONU (Phase 2 - 5000ms) */}
          <div
            className={`mt-14 flex flex-col items-center transition-all duration-1000 z-20 ${
              phase === 2 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95 pointer-events-none'
            }`}
          >
            <button
              onClick={() => onClaim(def.xpReward)}
              className="group relative bg-white text-ink-950 px-12 py-5 md:px-16 md:py-6 rounded-[2rem] font-black text-sm md:text-base uppercase tracking-[0.25em] hover:scale-105 active:scale-95 transition-all overflow-hidden ring-2 ring-white/40"
              style={{
                boxShadow: `0 0 ${35 + tierCfg.level * 15}px ${tierCfg.glowRgba}`,
              }}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-r ${tierCfg.buttonAura} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
              />
              <span className="relative z-10 flex items-center gap-3 group-hover:text-ink-950 transition-colors">
                <Sparkles size={20} className="text-ink-950 group-hover:rotate-[25deg] group-hover:scale-110 transition-transform duration-300" />
                Ödülü Tahsil Et (+{def.xpReward} XP · {def.itemReward ? MARKET_ITEM_MAP.get(def.itemReward)?.name || 'Pazar itemi' : `${def.coinReward ?? LIFETIME_QUEST_COINS[def.rarity] ?? 20} SC`})
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}