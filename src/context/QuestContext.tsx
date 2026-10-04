import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useApp } from './AppContext'; 
import { QUEST_DEFS, RARITY_STYLES } from '../lib/quests';
import { Sparkles } from 'lucide-react';

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
  resetQuestData: () => void; // YENİ: Sıfırlama fonksiyonu arayüze eklendi
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
  const { data, grantXp } = useApp(); 

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

  // YENİ: Tüm görev ve rozet verilerini fabrika ayarlarına döndürür
  const resetQuestData = () => {
    setQuestState(defaultQuestState);
  };

  // =========================================================================
  // GÖREV DEĞERLENDİRME MOTORU
  // =========================================================================
  useEffect(() => {
    if (!questState.activeQuestId || !questState.questAcceptedAt) return;

    const qId = questState.activeQuestId;
    const acceptedAt = questState.questAcceptedAt;

    const historySince = data.history.filter(h => {
      const watchedTime = new Date(h.watchedAt).getTime();
      return !isNaN(watchedTime) && watchedTime >= acceptedAt;
    });
    
    const watchedMovies = data.movies.filter(m => 
      m.watched && historySince.some(h => h.kind === 'movie' && h.itemId === m.id)
    );
    
    const ratedMovies = data.movies.filter(m => 
      m.rating !== null && historySince.some(h => h.kind === 'movie' && h.itemId === m.id)
    );

    const watchedEpisodes = historySince.filter(h => h.kind === 'series');

    let isCompleted = false;

    switch (qId) {
      case 'c_picky_taste': 
        isCompleted = ratedMovies.some(m => m.rating === 7.5 || m.rating === 8.5);
        break;
      case 'c_short_movie': 
        isCompleted = watchedMovies.some(m => m.runtime && m.runtime < 90);
        break;
      case 'c_action_fan': 
        isCompleted = watchedMovies.some(m => m.genres?.includes('Aksiyon') && m.rating !== null);
        break;
      case 'c_comedy_fan': 
        isCompleted = watchedMovies.some(m => m.genres?.includes('Komedi'));
        break;
      case 'c_drama_fan': 
        isCompleted = watchedMovies.some(m => m.genres?.includes('Dram'));
        break;
      case 'c_sci_fi_fan': 
        isCompleted = watchedMovies.some(m => m.genres?.includes('Bilim Kurgu'));
        break;
      case 'c_documentary': 
        isCompleted = watchedMovies.some(m => m.genres?.includes('Belgesel'));
        break;
      case 'c_animation': 
        isCompleted = watchedMovies.some(m => m.genres?.includes('Animasyon'));
        break;
      case 'c_masterpiece': 
        isCompleted = ratedMovies.some(m => m.rating === 10);
        break;
      case 'c_trash': 
        isCompleted = ratedMovies.some(m => m.rating !== null && m.rating <= 3);
        break;
      case 'c_mediocre': 
        isCompleted = ratedMovies.some(m => m.rating !== null && m.rating >= 5 && m.rating <= 6);
        break;
      case 'c_detailer': 
        isCompleted = watchedMovies.some(m => m.reviewTags && m.reviewTags.length >= 3);
        break;
      case 'c_writer': 
        isCompleted = watchedMovies.some(m => m.note && m.note.length >= 50);
        break;
      case 'c_old_movie': 
        isCompleted = watchedMovies.some(m => m.year && parseInt(m.year) < 2000);
        break;
      case 'c_new_movie': 
        const currentYear = new Date().getFullYear().toString();
        isCompleted = watchedMovies.some(m => m.year === currentYear);
        break;
      case 'c_weekend': 
        isCompleted = watchedMovies.some(m => {
          if (!m.watchedAt) return false;
          const day = new Date(m.watchedAt).getDay();
          return day === 0 || day === 6; 
        });
        break;
      case 'c_weekday': 
        isCompleted = watchedMovies.some(m => {
          if (!m.watchedAt) return false;
          return new Date(m.watchedAt).getDay() === 1; 
        });
        break;
      case 'c_short_series': 
        isCompleted = watchedEpisodes.some(e => e.actualRuntime && e.actualRuntime < 30);
        break;
      case 'c_series_pilot': 
        isCompleted = watchedEpisodes.some(e => e.season === 1 && e.episode === 1);
        break;
      case 'c_series_double': 
        isCompleted = watchedEpisodes.length >= 2;
        break;

      case 'r_night_watch': 
        isCompleted = watchedMovies.some(m => {
          if (!m.watchedAt) return false;
          const hr = new Date(m.watchedAt).getHours();
          return hr >= 1 && hr < 5;
        });
        break;
      case 'r_two_hours': 
        isCompleted = watchedMovies.some(m => m.runtime && m.runtime >= 120 && m.runtime <= 130);
        break;
      case 'r_tarantino': 
        isCompleted = watchedMovies.some(m => (m.genres?.includes('Suç') || m.genres?.includes('Gerilim')) && m.rating !== null && m.rating >= 8);
        break;
      case 'r_classic':
        isCompleted = watchedMovies.some(m => m.year && parseInt(m.year) >= 1970 && parseInt(m.year) <= 1980);
        break;
      case 'r_mystery_solver':
        isCompleted = watchedMovies.some(m => m.genres?.includes('Gizem') && m.note && m.note.length >= 100);
        break;
      case 'r_consistent': 
        isCompleted = data.dailyStreak >= 3; 
        break;
      case 'r_variety': 
        if (watchedMovies.length >= 2) isCompleted = true; 
        break;
      case 'r_series_wolf': 
        isCompleted = watchedEpisodes.length >= 3;
        break;
      case 'r_friday_joy': 
        isCompleted = watchedMovies.some(m => {
          if (!m.watchedAt) return false;
          const d = new Date(m.watchedAt);
          return d.getDay() === 5 && d.getHours() >= 20; 
        });
        break;
      case 'r_double_action': 
        isCompleted = watchedMovies.filter(m => m.genres?.includes('Aksiyon')).length >= 2;
        break;
      case 'r_double_horror': 
        isCompleted = watchedMovies.filter(m => m.genres?.includes('Korku')).length >= 2;
        break;
      case 'r_long_movie': 
        isCompleted = watchedMovies.some(m => m.runtime && m.runtime >= 150);
        break;
      case 'r_perfect_pair': 
        const perfectMovies = ratedMovies.filter(m => m.rating === 9 || m.rating === 10);
        isCompleted = perfectMovies.length >= 2;
        break;
      case 'r_indecisive': 
        isCompleted = ratedMovies.length > 0;
        break;
      case 'r_second_chance':
        isCompleted = watchedMovies.length > 0;
        break;

      case 'e_series_killer': 
        isCompleted = watchedEpisodes.length >= 5;
        break;
      case 'e_old_school': 
        isCompleted = watchedMovies.some(m => m.year && parseInt(m.year) <= 1960);
        break;
      case 'e_heavy_novel': 
        isCompleted = watchedMovies.some(m => m.note && m.note.length >= 1000);
        break;
      case 'e_marathon_3': 
        isCompleted = watchedMovies.length >= 3;
        break;
      case 'e_perfect_3': 
        isCompleted = ratedMovies.filter(m => m.rating !== null && m.rating >= 8).length >= 3;
        break;

      case 'l_directors_cut': 
        isCompleted = watchedMovies.some(m => m.runtime && m.runtime >= 180);
        break;
      case 'l_weekend_massacre': 
        isCompleted = watchedMovies.length >= 4;
        break;
      case 'l_flawless_selection': 
        isCompleted = ratedMovies.filter(m => m.rating !== null && m.rating >= 9).length >= 4;
        break;
      case 'l_sinevia_god': 
        isCompleted = data.dailyStreak >= 7;
        break;
      case 'l_marathon_5': 
        isCompleted = watchedMovies.length >= 5;
        break;

      case 'm_hater': 
        isCompleted = ratedMovies.filter(m => m.rating !== null && m.rating <= 3).length >= 3;
        break;

      default:
        if (watchedMovies.length > 0 || watchedEpisodes.length > 0) isCompleted = true; 
        break;
    }

    if (isCompleted) {
      completeActiveQuest(qId);
      setCelebratingQuestId(qId);
    }

  }, [data.history, data.movies, questState.activeQuestId, questState.questAcceptedAt]);

  return (
    <QuestContext.Provider value={{ 
      questState, 
      acceptQuest, 
      rejectActiveQuest,
      completeActiveQuest,
      equipBadge,
      togglePenalty,
      resetQuestData // Arayüze eklendi
    }}>
      {children}

      {/* SİNEMATİK KUTLAMA ANİMASYONU */}
      {celebratingQuestId && (
        <QuestCelebrationOverlay 
          questId={celebratingQuestId} 
          onClaim={(xp) => {
            grantXp(xp); 
            setCelebratingQuestId(null);
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