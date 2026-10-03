import { useState, useEffect } from 'react';
import { useQuests } from '../context/QuestContext';
import { QUEST_DEFS, RARITY_STYLES, QuestDef } from '../lib/quests';
import { ShieldAlert, RefreshCcw, Trash2, Zap, Target, Lock, CheckCircle2, Timer, Sparkles, Check, AlertTriangle, Crosshair, Power } from 'lucide-react';

const RARITY_WEIGHTS = {
  common: 45,
  rare: 30,
  epic: 15,
  legendary: 8,
  mythic: 2
};

export default function QuestBoard() {
  const { questState, acceptQuest, rejectActiveQuest, equipBadge, togglePenalty } = useQuests();
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [offeredQuestId, setOfferedQuestId] = useState<string | null>(null);

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
        setTimeLeft(`${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [questState.questCooldownUntil]);

  const getRandomQuest = (availableQuests: QuestDef[]) => {
    const pools: Record<string, QuestDef[]> = {
      common: availableQuests.filter(q => q.rarity === 'common'),
      rare: availableQuests.filter(q => q.rarity === 'rare'),
      epic: availableQuests.filter(q => q.rarity === 'epic'),
      legendary: availableQuests.filter(q => q.rarity === 'legendary'),
      mythic: availableQuests.filter(q => q.rarity === 'mythic'),
    };

    const validWeights = Object.entries(RARITY_WEIGHTS)
      .filter(([rarity]) => pools[rarity].length > 0)
      .map(([rarity, weight]) => ({ rarity, weight }));

    if (validWeights.length === 0) return null;

    const totalWeight = validWeights.reduce((acc, curr) => acc + curr.weight, 0);
    let random = Math.random() * totalWeight;

    let selectedRarity = validWeights[0].rarity;
    for (let item of validWeights) {
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
        alert("Ağdaki tüm görevleri temizledin. Yeni kontratlar bekleniyor...");
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

  const activeDef = questState.activeQuestId ? QUEST_DEFS.find(q => q.id === questState.activeQuestId) : null;
  const offeredDef = offeredQuestId ? QUEST_DEFS.find(q => q.id === offeredQuestId) : null;
  
  const isCooldown = Boolean(questState.questCooldownUntil && Date.now() < questState.questCooldownUntil);
  const remainingRejects = 3 - questState.questRejects;
  const isLastChance = questState.isPenaltyEnabled && remainingRejects === 1;

  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* ----------------- ÜST PANEL: SİBERPUNK TERMİNAL ----------------- */}
      <div className="bg-ink-950 border border-ink-800 rounded-[2rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[340px]">
        
        {/* YENİ YER: Sistem Güvenliği Override (Ceza Şalteri) Terminalin sağ üstünde */}
        <button 
          onClick={togglePenalty}
          title="Sistem Override: Ceza limitini devre dışı bırakır."
          className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 flex items-center gap-2 px-3 py-2 rounded-xl bg-ink-900/60 hover:bg-ink-900 border border-ink-800 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-ink-500 hover:text-white transition-all shadow-md group"
        >
          <Power size={12} className={questState.isPenaltyEnabled ? 'text-red-500 group-hover:scale-110 transition-transform' : 'text-emerald-500 group-hover:scale-110 transition-transform'} />
          <span className="hidden sm:inline">
            Ceza: <span className={questState.isPenaltyEnabled ? 'text-red-400' : 'text-emerald-400'}>{questState.isPenaltyEnabled ? 'Açık' : 'Kapalı'}</span>
          </span>
        </button>

        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.8) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className={`absolute -top-32 -right-32 w-96 h-96 rounded-full blur-[120px] pointer-events-none opacity-20 ${
          isCooldown ? 'bg-red-500' : activeDef ? RARITY_STYLES[activeDef.rarity].bg.replace('bg-', 'bg-').split('/')[0] : 'bg-violet-500'
        }`} />

        {isCooldown ? (
          <div className="text-center z-10 animate-fade-in-up flex flex-col items-center mt-4">
            <div className="w-24 h-24 bg-red-950/50 border border-red-500/50 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
              <Lock size={40} className="text-red-500" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-widest uppercase drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">Sistem Kilitli</h2>
            <p className="text-sm font-medium text-ink-400 mb-8 max-w-md mx-auto leading-relaxed">
              Üst üste 3 kontratı reddettiğin için ağa erişimin askıya alındı. Cihaz soğuyana kadar yeni bir görev alamazsın.
            </p>
            <div className="bg-ink-950 border-2 border-red-500/40 px-8 py-4 rounded-2xl flex items-center gap-4 shadow-inner">
              <Timer className="text-red-500 animate-pulse" size={24} />
              <span className="text-2xl sm:text-3xl font-mono font-black text-red-400 tracking-widest">{timeLeft}</span>
            </div>
          </div>

        ) : offeredDef ? (
          <div className="w-full max-w-2xl z-10 animate-fade-in-up mt-4">
            <div className="flex items-center justify-center mb-6 gap-3">
              <AlertTriangle className="text-amber-400 animate-pulse" size={24} />
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-widest text-center">Gelen Kontrat İletisi</h2>
              <AlertTriangle className="text-amber-400 animate-pulse" size={24} />
            </div>

            <div className={`p-6 sm:p-8 rounded-3xl border-2 transition-all shadow-2xl relative overflow-hidden bg-ink-900/80 ${RARITY_STYLES[offeredDef.rarity].border} ${RARITY_STYLES[offeredDef.rarity].shadow}`}>
              <div className={`absolute inset-0 opacity-10 ${RARITY_STYLES[offeredDef.rarity].bg}`} />
              
              <div className="relative z-10 flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
                <div className={`w-28 h-28 flex-shrink-0 bg-ink-950 rounded-[2rem] border-2 flex items-center justify-center text-5xl shadow-inner ${RARITY_STYLES[offeredDef.rarity].border}`}>
                  {offeredDef.icon}
                </div>
                <div className="flex-1">
                  <div className={`text-[10px] sm:text-xs font-black uppercase tracking-widest mb-1 ${RARITY_STYLES[offeredDef.rarity].color}`}>
                    {offeredDef.rarity} SEVİYE GÖREV
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white mb-2 leading-tight drop-shadow-md">{offeredDef.title}</h3>
                  <p className="text-sm font-medium text-ink-300 mb-4 leading-relaxed">{offeredDef.description}</p>
                  <div className="inline-flex items-center gap-2 bg-ink-950 px-4 py-2 rounded-xl border border-ink-800 text-xs font-black text-emerald-400 shadow-inner">
                    <Sparkles size={16} /> Ödül: {offeredDef.xpReward} XP + Rozet
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 relative z-10">
                <button 
                  onClick={handleAcceptOffer}
                  className="w-full sm:flex-1 py-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 hover:text-ink-950 text-emerald-400 border border-emerald-500/50 font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <Check strokeWidth={3} size={18} /> Kontratı Kabul Et
                </button>
                <button 
                  onClick={handleRejectOffer}
                  className={`w-full sm:flex-1 py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 border ${
                    isLastChance 
                      ? 'bg-red-500/10 text-red-500 border-red-500/50 hover:bg-red-500 hover:text-white' 
                      : 'bg-ink-950 text-ink-400 border-ink-700 hover:bg-ink-800 hover:text-white'
                  }`}
                >
                  <Trash2 size={18} /> {isLastChance ? 'Riskli Reddet' : 'Reddet'}
                  
                  {questState.isPenaltyEnabled ? (
                    <span className={`ml-1 px-2 py-0.5 rounded text-[10px] border ${isLastChance ? 'bg-red-500/20 border-red-400' : 'bg-ink-950 border-ink-800'}`}>
                      Hak: {remainingRejects}
                    </span>
                  ) : (
                    <span className="ml-1 bg-ink-950 px-2 py-0.5 rounded text-[10px] border border-ink-800 text-emerald-500">
                      Sınırsız Pas
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

        ) : activeDef ? (
          <div className="w-full max-w-2xl z-10 animate-fade-in-up mt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-ink-500 flex items-center gap-1.5">
                <Crosshair size={14} className={RARITY_STYLES[activeDef.rarity].color} />
                Aktif Kontrat
              </div>
              <div className="flex items-center gap-2 bg-ink-900 border border-ink-800 px-3 py-1.5 rounded-lg shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Devam Ediyor</span>
              </div>
            </div>

            <div className={`relative p-6 sm:p-8 rounded-3xl border transition-all overflow-hidden ${RARITY_STYLES[activeDef.rarity].bg} ${RARITY_STYLES[activeDef.rarity].border} ${RARITY_STYLES[activeDef.rarity].shadow}`}>
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-current to-transparent opacity-50" style={{ color: RARITY_STYLES[activeDef.rarity].color.replace('text-', '') }} />
              
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
                <div className={`w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 bg-ink-950 rounded-2xl border flex items-center justify-center text-4xl shadow-inner ${RARITY_STYLES[activeDef.rarity].border}`}>
                  {activeDef.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl sm:text-2xl font-black text-white mb-2 leading-tight drop-shadow-md">{activeDef.title}</h3>
                  <p className="text-xs sm:text-sm font-medium text-ink-200 mb-4">{activeDef.description}</p>
                  <div className="inline-flex items-center gap-1.5 bg-ink-950 px-3 py-1.5 rounded-lg border border-ink-800 text-[10px] sm:text-xs font-bold text-emerald-400">
                    <Sparkles size={14} /> Şartı sağladığında rozet otomatik kilit açar.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
               <button 
                  onClick={() => {
                    const msg = questState.isPenaltyEnabled 
                      ? "Bu kontratı feshetmek istediğine emin misin? Bu işlem bir reddetme (pas) hakkına mal olacak." 
                      : "Bu kontratı feshetmek istediğine emin misin?";
                    if (window.confirm(msg)) {
                      rejectActiveQuest();
                    }
                  }}
                  className="text-[10px] font-black text-ink-500 hover:text-red-400 transition-colors uppercase tracking-widest flex items-center gap-1"
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
                  <div className="absolute inset-0 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></div>
                  <Crosshair size={32} className="text-violet-400 animate-pulse" />
                </div>
                <h3 className="text-lg font-black text-violet-300 tracking-widest uppercase">Ağ Taranıyor...</h3>
                <p className="text-[10px] text-ink-500 mt-2 font-mono uppercase tracking-widest">Uygun profilli kontratlar aranıyor</p>
              </div>
            ) : (
              <div className="flex flex-col items-center animate-fade-in-up">
                <div className="w-24 h-24 bg-ink-900 border border-violet-500/30 rounded-[2rem] flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(139,92,246,0.1)]">
                  <Target size={40} className="text-violet-500 opacity-80" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">Görev Yuvası Boş</h2>
                <p className="text-xs sm:text-sm font-medium text-ink-400 mb-8 max-w-sm leading-relaxed">
                  Şu an takip ettiğin aktif bir kontrat bulunmuyor. Ağ bağlantısını başlat ve yeni bir hedef belirle.
                </p>
                <button 
                  onClick={handleDrawQuest}
                  className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-azure-600 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_40px_rgba(139,92,246,0.6)] hover:scale-105 transition-all flex items-center gap-2.5"
                >
                  <Zap size={18} className="fill-current" /> Ağa Bağlan & Görev Çek
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ----------------- ALT PANEL: ROZET VİTRİNİ (BADGE CASE) ----------------- */}
      <div className="bg-ink-950/40 border border-ink-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2.5">
              <ShieldAlert size={24} className="text-violet-400" /> Rozet Vitrini
            </h3>
            <p className="text-xs text-ink-500 mt-1 font-medium">Tamamlanan görevlerden kazanılan siber-çöplerin koleksiyonu.</p>
          </div>
          <div className="text-xs font-black text-ink-400 bg-ink-950 px-4 py-2 rounded-xl border border-ink-800 shadow-inner flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-500" />
            {questState.completedQuests.length} / {QUEST_DEFS.length}
          </div>
        </div>

        {questState.completedQuests.length === 0 ? (
          <div className="text-center py-12 bg-ink-900/30 rounded-3xl border border-ink-800/50 border-dashed">
            <Lock size={40} className="mx-auto mb-4 text-ink-600 opacity-40" />
            <p className="text-sm font-medium text-ink-500">Henüz hiçbir görevi tamamlamadın.<br/>Ağa bağlanıp kontratları yerine getirdikçe vitrinin dolacak.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 sm:gap-5">
            {questState.completedQuests.map((qId) => {
              const def = QUEST_DEFS.find((d) => d.id === qId);
              if (!def) return null;
              
              const isEquipped = questState.activeBadgeId === qId;

              return (
                <div 
                  key={qId} 
                  className={`relative group flex flex-col items-center p-4 sm:p-5 rounded-[1.5rem] border-2 transition-all cursor-pointer ${
                    isEquipped 
                      ? 'bg-ink-900 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] scale-105' 
                      : `bg-ink-950/80 ${RARITY_STYLES[def.rarity].border} hover:bg-ink-900 hover:shadow-lg hover:-translate-y-1`
                  }`}
                  onClick={() => equipBadge(isEquipped ? null : qId)}
                  title="Profilinde sergilemek/gizlemek için tıkla"
                >
                  {isEquipped && (
                    <div className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-ink-950 shadow-md z-10 animate-fade-in">
                      <Check size={14} className="text-ink-950" strokeWidth={4} />
                    </div>
                  )}
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border flex items-center justify-center text-3xl sm:text-4xl mb-3 sm:mb-4 ${RARITY_STYLES[def.rarity].bg} ${RARITY_STYLES[def.rarity].border} shadow-inner group-hover:scale-110 transition-transform`}>
                    {def.icon}
                  </div>
                  <h4 className="text-[10px] sm:text-xs font-black text-white text-center leading-tight mb-1.5">{def.title}</h4>
                  <p className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest bg-ink-950 px-2 py-0.5 rounded-md border border-ink-800 ${RARITY_STYLES[def.rarity].color}`}>
                    {def.rarity}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}