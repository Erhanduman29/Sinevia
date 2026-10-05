import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useApp } from './AppContext'; 
import { QUEST_DEFS, RARITY_STYLES } from '../lib/quests';
import { Sparkles } from 'lucide-react';
import { evaluateQuestCompletion } from '../lib/questLogic';
import { playQuestCompleteSound } from '../lib/sound';

const QUEST_STORAGE_KEY = 'sinevia-quests-v1';

export interface QuestState {
  activeQuestId: string | null;      
  questAcceptedAt: number | null;    
  questRejects: number;              
  questCooldownUntil: number | null; 
  completedQuests: string[];         
  activeBadgeId: string | null;
  isPenaltyEnabled: boolean; 
}

interface QuestContextValue {
  questState: QuestState;
  acceptQuest: (questId: string) => void;
  rejectActiveQuest: () => void;
  completeActiveQuest: (questId: string) => void;
  equipBadge: (questId: string | null) => void;
  togglePenalty: () => void; 
  resetQuestData: () => void;
}

const defaultQuestState: QuestState = {
  activeQuestId: null,
  questAcceptedAt: null,
  questRejects: 0,
  questCooldownUntil: null,
  completedQuests: [],
  activeBadgeId: null,
  isPenaltyEnabled: false, 
};

const QuestContext = createContext<QuestContextValue | null>(null);

export function useQuests() {
  const ctx = useContext(QuestContext);
  if (!ctx) throw new Error('useQuests must be used within QuestProvider');
  return ctx;
}

export function QuestProvider({ children }: { children: ReactNode }) {
  const { data, grantXp, setIsQuestCelebrating } = useApp();

  const [questState, setQuestState] = useState<QuestState>(() => {
    try {
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

  useEffect(() => {
    localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(questState));
  }, [questState]);

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

  useEffect(() => {
    if (!questState.activeQuestId || !questState.questAcceptedAt) return;

    const isCompleted = evaluateQuestCompletion(
      questState.activeQuestId,
      questState.questAcceptedAt,
      data.history,
      data.movies,
      data.dailyStreak
    );

    if (isCompleted) {
      completeActiveQuest(questState.activeQuestId);
      setIsQuestCelebrating(true); 
      setCelebratingQuestId(questState.activeQuestId);
    }

  }, [data.history, data.movies, questState.activeQuestId, questState.questAcceptedAt, data.dailyStreak]);

  return (
    <QuestContext.Provider value={{ 
      questState, 
      acceptQuest, 
      rejectActiveQuest,
      completeActiveQuest,
      equipBadge,
      togglePenalty,
      resetQuestData 
    }}>
      {children}

      {celebratingQuestId && (
        <QuestCelebrationOverlay 
          questId={celebratingQuestId} 
          onClaim={(xp) => {
            grantXp(xp); 
            setCelebratingQuestId(null);
            setIsQuestCelebrating(false); 
          }} 
        />
      )}
    </QuestContext.Provider>
  );
}

// ----------------------------------------------------------------------
// SİNEMATİK KUTLAMA MODALI BİLEŞENİ
// ----------------------------------------------------------------------
function QuestCelebrationOverlay({ questId, onClaim }: { questId: string, onClaim: (xp: number) => void }) {
  const def = QUEST_DEFS.find(q => q.id === questId);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // YENİ: Sinematik müziği ekran açıldığı an başlatıyoruz.
    // Fonksiyon kendi içinde 3 saniye boyunca yükselecek ve tam Phase 1'de patlayacak!
    playQuestCompleteSound();
    
    const t1 = setTimeout(() => setPhase(1), 3000);
    const t2 = setTimeout(() => setPhase(2), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!def) return null;
  const style = RARITY_STYLES[def.rarity];
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4 overflow-hidden select-none">
      
      {phase === 0 && (
        <div className="text-emerald-500 font-mono text-base md:text-xl animate-pulse tracking-[0.2em] md:tracking-[0.3em] text-center leading-relaxed">
          &gt; SİNEVİA AĞINA BAĞLANILDI...<br/>
          &gt; İZLEME GEÇMİŞİ DOĞRULANIYOR...<br/>
          &gt; ŞARTLAR EŞLEŞTİ: <span className="text-white font-black drop-shadow-md">KONTRAT BAŞARILI</span><br/>
          <span className="text-xs md:text-sm text-emerald-700 tracking-[0.2em] mt-4 block">GÖRSEL ARAYÜZ YÜKLENİYOR...</span>
        </div>
      )}

      {phase >= 1 && (
        <div className="relative z-10 flex flex-col items-center text-center w-full max-w-3xl">
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[500px] blur-[150px] opacity-40 pointer-events-none transition-all duration-1000 ${phase === 2 ? style.bg.split(' ')[0] : 'bg-transparent'}`} />
          
          <div className="animate-fade-in-up mb-10 relative z-20">
            <h2 className={`text-sm md:text-lg font-black tracking-[0.4em] uppercase mb-3 ${style.color}`}>
              {def.rarity} Sınıf Kontrat Tamamlandı
            </h2>
            <h3 className="text-4xl md:text-7xl font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] uppercase tracking-tight leading-none">
              {def.title}
            </h3>
          </div>

          <div className={`relative transition-all duration-[1500ms] ease-out z-20 ${phase === 1 ? 'scale-[2] rotate-12 opacity-0' : 'scale-100 rotate-0 opacity-100'}`}>
            <div className={`w-56 h-56 md:w-72 md:h-72 rounded-[3.5rem] border-4 flex items-center justify-center text-[8rem] md:text-[10rem] shadow-[0_0_100px_rgba(0,0,0,0.9)] relative bg-ink-950 ${style.border}`}>
               <div className={`absolute inset-0 opacity-30 ${style.bg} rounded-[3.5rem] animate-pulse`} />
               <span className="relative z-10 drop-shadow-2xl">{def.icon}</span>
            </div>
          </div>

          <div className={`mt-14 flex flex-col items-center transition-all duration-1000 z-20 ${phase === 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
            <button 
              onClick={() => onClaim(def.xpReward)}
              className="group relative bg-white text-ink-950 px-12 py-5 md:px-16 md:py-6 rounded-[2rem] font-black text-sm md:text-base uppercase tracking-[0.25em] hover:scale-105 transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative z-10 flex items-center gap-3 group-hover:text-ink-950">
                <Sparkles size={20} className="text-ink-950" />
                Ödülü Tahsil Et (+{def.xpReward} XP)
              </span>
            </button>
          </div>
          
        </div>
      )}
    </div>
  );
}