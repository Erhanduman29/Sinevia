import { useState, useEffect, useMemo } from 'react';
import { useQuests } from '../context/QuestContext';
import { useTutorial } from '../context/TutorialContext';
import { useSettings } from '../context/slices';
import { QUEST_DEFS, RARITY_STYLES, QuestDef, QuestIcon } from '../lib/quests';
import AcademyPage from '../pages/AcademyPage';
import ConfirmDialog from './ConfirmDialog';
import {
  ShieldAlert, Trash2, Zap, Target, Lock, CheckCircle2, Timer,
  Sparkles, Check, AlertTriangle, Crosshair, GraduationCap, Award
} from 'lucide-react';

const RARITY_WEIGHTS = {
  common: 45,
  rare: 30,
  epic: 15,
  legendary: 8,
  mythic: 2,
};

type RarityKey = keyof typeof RARITY_WEIGHTS;

const RARITY_LABELS: Record<RarityKey, string> = {
  common: 'Yaygın',
  rare: 'Nadir',
  epic: 'Destansı',
  legendary: 'Efsanevi',
  mythic: 'Gizli Boss',
};

export default function QuestBoard() {
  const { questState, acceptQuest, rejectActiveQuest, equipBadge } = useQuests();
  const { notifyEvent } = useTutorial();
  const { showBadgeDetails } = useSettings();
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [offeredQuestId, setOfferedQuestId] = useState<string | null>(null);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [view, setView] = useState<'board' | 'academy'>('board');

  // Rozet Vitrini filtreleri
  const [statusFilter, setStatusFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [rarityFilter, setRarityFilter] = useState<'all' | RarityKey>('all');

  useEffect(() => {
    if (!questState.questCooldownUntil) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = questState.questCooldownUntil! - now;

      if (diff <= 0) {
        setTimeLeft('');
        window.location.reload();
      } else {
        const hrs = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(
          `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [questState.questCooldownUntil]);

  const getRandomQuest = (availableQuests: QuestDef[]) => {
    const pools: Record<string, QuestDef[]> = {
      common: availableQuests.filter((q) => q.rarity === 'common'),
      rare: availableQuests.filter((q) => q.rarity === 'rare'),
      epic: availableQuests.filter((q) => q.rarity === 'epic'),
      legendary: availableQuests.filter((q) => q.rarity === 'legendary'),
      mythic: availableQuests.filter((q) => q.rarity === 'mythic'),
    };

    const validWeights = Object.entries(RARITY_WEIGHTS)
      .filter(([rarity]) => pools[rarity].length > 0)
      .map(([rarity, weight]) => ({ rarity, weight }));

    if (validWeights.length === 0) return null;

    const totalWeight = validWeights.reduce((acc, curr) => acc + curr.weight, 0);
    let random = Math.random() * totalWeight;

    let selectedRarity = validWeights[0].rarity;
    for (const item of validWeights) {
      if (random < item.weight) {
        selectedRarity = item.rarity;
        break;
      }
      random -= item.weight;
    }

    const pool = pools[selectedRarity];
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const handleDrawQuest = () => {
    setIsDrawing(true);
    setTimeout(() => {
      const availableQuests = QUEST_DEFS.filter(
        (q) => !questState.completedQuests.includes(q.id) && q.id !== questState.activeQuestId
      );

      if (availableQuests.length === 0) {
        alert('Ağdaki tüm görevleri temizledin. Yeni kontratlar bekleniyor...');
        setIsDrawing(false);
        return;
      }

      const randomQuest = getRandomQuest(availableQuests);
      if (randomQuest) {
        setOfferedQuestId(randomQuest.id);
      }
      setIsDrawing(false);
    }, 1800);
  };

  const handleAcceptOffer = () => {
    if (offeredQuestId) {
      acceptQuest(offeredQuestId);
      setOfferedQuestId(null);
    }
  };

  const handleRejectOffer = () => {
    rejectActiveQuest();
    setOfferedQuestId(null);
  };

  const activeDef = questState.activeQuestId
    ? QUEST_DEFS.find((q) => q.id === questState.activeQuestId)
    : null;
  const offeredDef = offeredQuestId ? QUEST_DEFS.find((q) => q.id === offeredQuestId) : null;
  const equippedDef = questState.activeBadgeId
    ? QUEST_DEFS.find((q) => q.id === questState.activeBadgeId)
    : null;

  const isCooldown = Boolean(questState.questCooldownUntil && Date.now() < questState.questCooldownUntil);
  const remainingRejects = 3 - questState.questRejects;
  const isLastChance = questState.isPenaltyEnabled && remainingRejects === 1;

  const filteredQuests = useMemo(() => {
    return QUEST_DEFS.filter((def) => {
      const isCompleted = questState.completedQuests.includes(def.id);
      if (statusFilter === 'unlocked' && !isCompleted) return false;
      if (statusFilter === 'locked' && isCompleted) return false;
      if (rarityFilter !== 'all' && def.rarity !== rarityFilter) return false;
      return true;
    });
  }, [questState.completedQuests, statusFilter, rarityFilter]);

  if (view === 'academy') {
    return <AcademyPage onBack={() => setView('board')} />;
  }

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* ----------------- ÜST PANEL: OPERASYON TERMİNALİ ----------------- */}
      <div className="bg-ink-950 border border-ink-800 rounded-[2rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[340px]">
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.8) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div
          className={`absolute -top-32 -right-32 w-96 h-96 rounded-full blur-[120px] pointer-events-none opacity-25 ${
            isCooldown
              ? 'bg-red-500'
              : activeDef
              ? RARITY_STYLES[activeDef.rarity].bg.split('/')[0]
              : 'bg-red-600'
          }`}
        />

        {isCooldown ? (
          <div className="text-center z-10 animate-fade-in-up flex flex-col items-center mt-4">
            <div className="w-24 h-24 bg-red-950/50 border border-red-500/50 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(239,68,68,0.25)]">
              <Lock size={40} className="text-red-500" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-widest uppercase drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
              Sistem Kilitli
            </h2>
            <p className="text-sm font-medium text-ink-400 mb-8 max-w-md mx-auto leading-relaxed">
              Üst üste 3 kontratı reddettiğin için ağa erişimin askıya alındı. Cihaz soğuyana kadar yeni bir görev alamazsın.
            </p>
            <div className="bg-ink-950 border-2 border-red-500/40 px-8 py-4 rounded-2xl flex items-center gap-4 shadow-inner">
              <Timer className="text-red-500 animate-pulse" size={24} />
              <span className="text-2xl sm:text-3xl font-black text-red-400 tracking-widest tabular-nums">
                {timeLeft}
              </span>
            </div>
          </div>
        ) : offeredDef ? (
          <div className="w-full max-w-2xl z-10 animate-fade-in-up mt-2">
            <div className="flex items-center justify-center mb-5 gap-3">
              <AlertTriangle className="text-amber-400 animate-pulse" size={22} />
              <h2 className="text-lg sm:text-2xl font-black text-white uppercase tracking-widest text-center">
                Gelen Kontrat İletisi
              </h2>
              <AlertTriangle className="text-amber-400 animate-pulse" size={22} />
            </div>

            <div
              className={`p-6 sm:p-8 rounded-3xl border-2 transition-all shadow-2xl relative overflow-hidden bg-ink-900/85 backdrop-blur-md ${RARITY_STYLES[offeredDef.rarity].border} ${RARITY_STYLES[offeredDef.rarity].shadow}`}
            >
              <div className={`absolute inset-0 opacity-15 ${RARITY_STYLES[offeredDef.rarity].bg}`} />

              <div className="relative z-10 flex flex-col sm:flex-row gap-6 items-center text-center sm:text-left">
                {/* Özel İllüstrasyon Arma Podyumu */}
                <div className="relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0">
                  <div
                    className={`absolute inset-0 rounded-full blur-2xl opacity-40 ${RARITY_STYLES[offeredDef.rarity].bg}`}
                  />
                  <QuestIcon questId={offeredDef.id} size={76} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
                    <span
                      className={`text-[10px] sm:text-xs font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-ink-950/90 border ${RARITY_STYLES[offeredDef.rarity].border} ${RARITY_STYLES[offeredDef.rarity].color}`}
                    >
                      {RARITY_LABELS[offeredDef.rarity]} Kontrat
                    </span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white mb-2 leading-tight drop-shadow-md">
                    {offeredDef.title}
                  </h3>
                  <p className="text-xs sm:text-sm font-medium text-ink-300 mb-4 leading-relaxed">
                    {offeredDef.description}
                  </p>
                  <div className="inline-flex items-center gap-2 bg-ink-950/90 px-4 py-2 rounded-xl border border-ink-800 text-xs font-black text-emerald-400 shadow-inner">
                    <Sparkles size={15} /> Ödül: +{offeredDef.xpReward} XP &amp; Özel Arma
                  </div>
                </div>
              </div>

              <div className="mt-7 flex flex-col sm:flex-row items-center gap-3 relative z-10">
                <button
                  onClick={handleAcceptOffer}
                  className="w-full sm:flex-1 py-3.5 sm:py-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 hover:text-ink-950 text-emerald-400 border border-emerald-500/50 font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <Check strokeWidth={3} size={18} /> Kontratı Kabul Et
                </button>
                <button
                  onClick={handleRejectOffer}
                  className={`w-full sm:flex-1 py-3.5 sm:py-4 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 border ${
                    isLastChance
                      ? 'bg-red-500/10 text-red-500 border-red-500/50 hover:bg-red-500 hover:text-white'
                      : 'bg-ink-950 text-ink-400 border-ink-700 hover:bg-ink-800 hover:text-white'
                  }`}
                >
                  <Trash2 size={17} /> {isLastChance ? 'Riskli Reddet' : 'Reddet'}
                  {questState.isPenaltyEnabled ? (
                    <span
                      className={`ml-1 px-2 py-0.5 rounded text-[10px] border ${
                        isLastChance ? 'bg-red-500/20 border-red-400' : 'bg-ink-900 border-ink-700'
                      }`}
                    >
                      Hak: {remainingRejects}
                    </span>
                  ) : (
                    <span className="ml-1 bg-ink-900 px-2 py-0.5 rounded text-[10px] border border-ink-800 text-emerald-500">
                      Sınırsız Pas
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : activeDef ? (
          <div className="w-full max-w-2xl z-10 animate-fade-in-up mt-2">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[11px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-2">
                <Crosshair size={15} className={RARITY_STYLES[activeDef.rarity].color} />
                <span>Aktif Operasyon Kontratı</span>
              </div>
              <div className="flex items-center gap-2 bg-ink-900 border border-ink-800 px-3 py-1.5 rounded-lg shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  Takip Ediliyor
                </span>
              </div>
            </div>

            <div
              className={`relative p-6 sm:p-8 rounded-3xl border-2 transition-all overflow-hidden bg-ink-900/75 backdrop-blur-md ${RARITY_STYLES[activeDef.rarity].border} ${RARITY_STYLES[activeDef.rarity].shadow}`}
            >
              <div className={`absolute inset-0 opacity-10 ${RARITY_STYLES[activeDef.rarity].bg}`} />

              <div className="relative z-10 flex flex-col sm:flex-row gap-6 items-center text-center sm:text-left">
                {/* Büyük Özel Arma Gösterimi */}
                <div className="relative flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0">
                  <div
                    className={`absolute inset-0 rounded-full blur-2xl opacity-35 ${RARITY_STYLES[activeDef.rarity].bg}`}
                  />
                  <QuestIcon questId={activeDef.id} size={68} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-ink-950/80 border ${RARITY_STYLES[activeDef.rarity].border} ${RARITY_STYLES[activeDef.rarity].color}`}
                    >
                      {RARITY_LABELS[activeDef.rarity]}
                    </span>
                    <span className="text-xs font-black text-emerald-400 tabular-nums">
                      +{activeDef.xpReward} XP
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white mb-1.5 leading-tight drop-shadow-md">
                    {activeDef.title}
                  </h3>
                  <p className="text-xs sm:text-sm font-medium text-ink-200 mb-4 leading-relaxed">
                    {activeDef.description}
                  </p>
                  <div className="inline-flex items-center gap-1.5 bg-ink-950/90 px-3 py-1.5 rounded-xl border border-ink-800 text-[10px] sm:text-xs font-bold text-ink-300">
                    <Sparkles size={13} className="text-gold-400" />
                    <span>Koşul sağlandığında arma ve XP otomatik olarak hesabına işlenir.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3.5 flex justify-end">
              <button
                onClick={() => setShowRejectConfirm(true)}
                className="min-h-10 px-3 py-1.5 rounded-xl bg-ink-900/60 border border-ink-800 hover:border-red-500/40 text-[10px] font-black text-ink-400 hover:text-red-400 transition-all uppercase tracking-widest flex items-center gap-1.5"
              >
                <Trash2 size={12} /> Kontratı Feshet
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center z-10 flex flex-col items-center mt-4">
            {isDrawing ? (
              <div className="flex flex-col items-center animate-fade-in">
                <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                  <div className="absolute inset-0 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
                  <Crosshair size={32} className="text-rose-400 animate-pulse" />
                </div>
                <h3 className="text-lg font-black text-rose-300 tracking-widest uppercase">
                  Ağ Taranıyor...
                </h3>
                <p className="text-[10px] text-ink-500 mt-2 font-semibold uppercase tracking-widest">
                  Şifreli görev kontratı çözülüyor
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center animate-fade-in-up">
                <div className="w-24 h-24 bg-ink-900/90 border border-red-500/30 rounded-[2rem] flex items-center justify-center mb-6 shadow-[0_0_35px_rgba(232,56,79,0.15)]">
                  <Target size={40} className="text-rose-500" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 uppercase tracking-tight">
                  Görev Yuvası Boş
                </h2>
                <p className="text-xs sm:text-sm font-medium text-ink-400 mb-7 max-w-sm leading-relaxed">
                  Şu an takip ettiğin aktif bir kontrat bulunmuyor. Ağa bağlanarak rastgele bir operasyon çek.
                </p>
                <button
                  onClick={handleDrawQuest}
                  className="bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 text-white px-8 py-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest shadow-[0_10px_30px_-8px_rgba(232,56,79,0.75)] hover:shadow-[0_14px_40px_-8px_rgba(232,56,79,0.95)] hover:scale-105 transition-all flex items-center gap-2.5"
                >
                  <Zap size={18} className="fill-current" /> Ağa Bağlan &amp; Görev Çek
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ----------------- AKADEMİ GİRİŞİ ----------------- */}
      <button
        onClick={() => setView('academy')}
        title="Akademi derslerini tam sayfada aç"
        className="w-full relative rounded-2xl px-5 py-4 shadow-xl overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900/95 to-ink-950 border border-gold-500/40 hover:border-gold-500/70 transition-all group flex items-center justify-center gap-3 text-gold-300 hover:text-gold-200"
      >
        <GraduationCap size={18} className="group-hover:scale-110 transition-transform flex-shrink-0" />
        <span className="font-black text-sm uppercase tracking-widest">
          Sinevia Akademisi — Akademi Sayfası
        </span>
      </button>

      {/* ----------------- ALT PANEL: ÖZEL ARMA & ROZET VİTRİNİ ----------------- */}
      <div className="bg-ink-950/60 border border-ink-800 rounded-3xl p-5 sm:p-7 backdrop-blur-md space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white flex items-center gap-2.5">
              <ShieldAlert size={22} className="text-rose-400" /> Özel Arma &amp; Rozet Vitrini
            </h3>
            <p className="text-xs text-ink-400 mt-0.5 font-medium">
              Tamamlanan operasyonlardan kazanılan özel tasarım armalar. Profilinde sergilemek için bir armaya tıkla.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {equippedDef && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs">
                <Award size={14} className="text-emerald-400 shrink-0" />
                <span className="text-ink-300 font-semibold hidden xs:inline">Kuşanılan:</span>
                <strong className="text-emerald-300 font-black truncate max-w-[130px]">
                  {equippedDef.title}
                </strong>
              </div>
            )}
            <div className="text-xs font-black text-ink-200 bg-ink-950 px-3.5 py-2 rounded-xl border border-ink-800 shadow-inner flex items-center gap-2 shrink-0">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span className="tabular-nums">
                {questState.completedQuests.length} / {QUEST_DEFS.length}
              </span>
            </div>
          </div>
        </div>

        {/* Filtre Çubuğu: Durum & Nadirlik */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2 border-t border-ink-800/70">
          <div className="flex items-center gap-1 bg-ink-950/90 border border-ink-800 p-1 rounded-xl self-start">
            {[
              { id: 'all', label: `Tümü (${QUEST_DEFS.length})` },
              { id: 'unlocked', label: `Kazanılan (${questState.completedQuests.length})` },
              { id: 'locked', label: `Kilitli (${QUEST_DEFS.length - questState.completedQuests.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${
                  statusFilter === tab.id
                    ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow'
                    : 'text-ink-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar pb-0.5">
            <button
              type="button"
              onClick={() => setRarityFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all shrink-0 ${
                rarityFilter === 'all'
                  ? 'bg-white/10 text-white border-white/30'
                  : 'bg-ink-950/60 text-ink-400 border-ink-800 hover:text-ink-200'
              }`}
            >
              Tüm Kademeler
            </button>
            {(['common', 'rare', 'epic', 'legendary', 'mythic'] as RarityKey[]).map((rKey) => (
              <button
                key={rKey}
                type="button"
                onClick={() => setRarityFilter(rKey)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all shrink-0 ${
                  rarityFilter === rKey
                    ? `${RARITY_STYLES[rKey].bg} ${RARITY_STYLES[rKey].color}${RARITY_STYLES[rKey].border}`
                    : 'bg-ink-950/60 text-ink-400 border-ink-800 hover:text-ink-200'
                }`}
              >
                {RARITY_LABELS[rKey]}
              </button>
            ))}
          </div>
        </div>

        {/* Arma Izgarası */}
        {filteredQuests.length === 0 ? (
          <div className="text-center py-10 bg-ink-950/40 rounded-2xl border border-ink-800/60">
            <p className="text-xs text-ink-400 font-bold">Bu filtreye uygun görev arması bulunamadı.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {filteredQuests.map((def) => {
              const isCompleted = questState.completedQuests.includes(def.id);
              const isEquipped = questState.activeBadgeId === def.id;
              const style = RARITY_STYLES[def.rarity];

              return (
                <div
                  key={def.id}
                  onClick={
                    isCompleted
                      ? () => {
                          if (!isEquipped) notifyEvent('badge_equipped');
                          equipBadge(isEquipped ? null : def.id);
                        }
                      : undefined
                  }
                  title={
                    isCompleted
                      ? 'Profilinde sergilemek veya kaldırmak için tıkla'
                      : 'Kilitli — bu görevi henüz tamamlamadın'
                  }
                  className={`relative group flex flex-col items-center justify-between p-4 rounded-2xl border transition-all duration-300 overflow-hidden ${
                    isEquipped
                      ? 'bg-gradient-to-b from-emerald-950/40 via-ink-900 to-ink-950 border-emerald-400/70 shadow-[0_0_25px_-5px_rgba(16,185,129,0.45)] scale-[1.02] cursor-pointer'
                      : isCompleted
                      ? `bg-ink-950/85 ${style.border} hover:bg-ink-900/90 hover:-translate-y-1 hover:shadow-xl cursor-pointer`
                      : 'bg-ink-950/40 border-ink-800/50 opacity-60 hover:opacity-85 cursor-default'
                  }`}
                >
                  {/* Arka Plan Nadirlik Işıması */}
                  {isCompleted && (
                    <div
                      className={`absolute -top-10 inset-x-0 h-24 rounded-full blur-2xl opacity-25 pointer-events-none ${style.bg}`}
                    />
                  )}

                  {/* Sağ Üst Durum Rozeti */}
                  {isEquipped ? (
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-emerald-500 text-ink-950 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md z-10">
                      <Check size={10} strokeWidth={4} /> Aktif
                    </div>
                  ) : !isCompleted ? (
                    <div className="absolute top-2.5 right-2.5 w-6 h-6 bg-ink-900/90 rounded-full flex items-center justify-center border border-ink-800 z-10">
                      <Lock size={11} className="text-ink-500" />
                    </div>
                  ) : null}

                  {/* Merkez: Özel Vektörel Arma (Çift çerçevesiz, doğrudan parlayan kalkan) */}
                  <div
                    className={`relative my-2 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${
                      isCompleted ? '' : 'grayscale contrast-75 opacity-65'
                    }`}
                  >
                    <QuestIcon questId={def.id} size={52} />
                  </div>

                  {/* Alt Bilgiler */}
                  {showBadgeDetails && (
                    <div className="w-full text-center flex flex-col items-center mt-1 z-10">
                      <h4 className="text-xs sm:text-[13px] font-black text-white leading-tight mb-1 line-clamp-1">
                        {def.title}
                      </h4>
                      <p className="text-[10px] text-ink-400 leading-snug mb-2.5 line-clamp-2 min-h-[28px]">
                        {def.description}
                      </p>

                      <div className="w-full flex items-center justify-between gap-1 pt-2 border-t border-ink-800/70">
                        <span
                          className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-ink-950 border ${style.border} ${style.color}`}
                        >
                          {RARITY_LABELS[def.rarity]}
                        </span>
                        <span className="text-[10px] font-black text-emerald-400 tabular-nums">
                          +{def.xpReward} XP
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KONTRAT FESİH ONAYI */}
      {showRejectConfirm && (
        <ConfirmDialog
          title="Kontratı Feshet"
          message={
            questState.isPenaltyEnabled
              ? 'Bu kontratı feshetmek istediğine emin misin? Bu işlem bir reddetme (pas) hakkına mal olacak.'
              : 'Bu kontratı feshetmek istediğine emin misin?'
          }
          confirmLabel="Evet, Feshet"
          cancelLabel="Vazgeç"
          onConfirm={() => {
            setShowRejectConfirm(false);
            rejectActiveQuest();
          }}
          onCancel={() => setShowRejectConfirm(false)}
        />
      )}
    </div>
  );
}