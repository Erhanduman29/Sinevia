import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { useApp } from './AppContext';
import { useQuests } from './QuestContext';
import {
  ALL_TUTORIALS,
  PAGE_TUTORIALS,
  MODAL_TUTORIALS,
  ACADEMY_QUESTS,
  TutorialDef,
} from '../tutorial/texts';
import { playLessonDoneSound } from '../lib/sound';

const STORAGE_KEY = 'sinevia-tutorial-v1';

/* ---------------- Durum ---------------- */
export interface TutorialProgress {
  welcomeDone: boolean;
  welcomeStep: number;
  completed: string[]; // %100 bitirilen tutorial kimlikleri
  pageVisited: string[]; // sayfa anahtarları (otomatik tetik için)
  modalSeen: string[]; // pencere kimlikleri (otomatik tetik için)
  academyStarted: boolean;
  academyStep: number; // 0..11 (ACADEMY_QUESTS.length'e kadar)
  academyDone: string[]; // tamamlanan akademi görevleri
  events: string[]; // tetiklenen eylem olayları (akademi için)
}

const defaultProgress: TutorialProgress = {
  welcomeDone: false,
  welcomeStep: 0,
  completed: [],
  pageVisited: [],
  modalSeen: [],
  academyStarted: false,
  academyStep: 0,
  academyDone: [],
  events: [],
};

function loadProgress(): TutorialProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultProgress, ...JSON.parse(raw) };
  } catch {}
  return { ...defaultProgress };
}

/* ---------------- Context ---------------- */
export type ActiveKind = 'welcome' | 'page' | 'modal' | null;

interface TutorialContextValue {
  progress: TutorialProgress;
  // Adım-adım tutorial (karşılama / sayfa / pencere)
  activeTutorial: TutorialDef | null;
  activeKind: ActiveKind;
  activeStep: number;
  /** Yürürlükteki adımın türü ('slide' | 'spotlight' | 'direct' | 'action' | null) */
  activeStepType: 'slide' | 'spotlight' | 'direct' | 'action' | null;
  startTutorial: (id: string) => void;
  skipActive: () => void;
  nextStep: () => void;
  prevStep: () => void;
  // Akademi (eylem tabanlı, kalıcı maskot yoldaşı)
  academyActive: boolean;
  academyStep: number;
  startAcademy: () => void;
  /** Akademiye belirli bir dersten başla (merkezden dersi ayrı ayrı tekrar yap). */
  startLesson: (index: number) => void;
  // Tetikleyiciler
  notifyPageVisit: (page: string) => void;
  notifyModalOpen: (modalId: string) => void;
  notifyModalClose: (modalId: string) => void;
  notifyEvent: (eventName: string) => void;
  // Sorgular
  isDone: (id: string) => boolean;
  academyQuestDone: (id: string) => boolean;
  // Tutorial Merkezi (global modal)
  centerOpen: boolean;
  setCenterOpen: (open: boolean) => void;
  resetAll: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider');
  return ctx;
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const quests = useQuests();

  const [progress, setProgress] = useState<TutorialProgress>(loadProgress);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [centerOpen, setCenterOpen] = useState(false);
  const [academyActive, setAcademyActive] = useState(false);

  // Değişimi izlemek için önceki değerler
  const prevMovies = useRef(0);
  const prevSeries = useRef(0);
  const prevHistory = useRef(0);
  const prevPlan = useRef(0);
  const prevActiveQuest = useRef<string | null>(null);
  const booted = useRef(false);

  // İlerleme kaydı
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {}
  }, [progress]);

  // Tamamlanan birim artınca gizli başarımı yeniden değerlendir
  const prevUnits = useRef<{ c: number; a: number } | null>(null);
  const syncAchievements = app.syncAchievements;
  useEffect(() => {
    const c = progress.completed.length;
    const a = progress.academyDone.length;
    // İlk koşum gerçek değerleri referans alır: mount anında (her açılışta) gereksiz
    // SYNC_ACHIEVEMENTS → applyAchievements → seviye yeniden hesabı tetiklenmez.
    if (prevUnits.current === null) { prevUnits.current = { c, a }; return; }
    if (c > prevUnits.current.c || a > prevUnits.current.a) {
      syncAchievements();
    }
    prevUnits.current = { c, a };
  }, [progress.completed.length, progress.academyDone.length, syncAchievements]);

  // Ders tamamlanınca güzel bir bildirim sesi (ilk yüklemede çalmaz)
  const prevLessonCount = useRef<number | null>(null);
  useEffect(() => {
    const n = progress.academyDone.length;
    if (prevLessonCount.current === null) {
      prevLessonCount.current = n;
      return;
    }
    if (n > prevLessonCount.current) playLessonDoneSound();
    prevLessonCount.current = n;
  }, [progress.academyDone.length]);

  // Bulut eşitlemesi tutorial ilerlemesini tazelediğinde localStorage'dan yeniden oku
  useEffect(() => {
    const onSync = () => setProgress(loadProgress());
    window.addEventListener('sinevia-sync-extras-applied', onSync);
    return () => window.removeEventListener('sinevia-sync-extras-applied', onSync);
  }, []);

  const activeTutorial = activeId ? ALL_TUTORIALS.find((t) => t.id === activeId) || null : null;
  const activeKind: ActiveKind = activeTutorial ? (activeTutorial.group as ActiveKind) : null;
  const stepDef = activeTutorial?.steps[activeStep];
  const activeStepType = stepDef?.type || null;

  /* ------------- Basit yardımcılar ------------- */
  const isDone = useCallback((id: string) => progress.completed.includes(id), [progress.completed]);
  const academyQuestDone = useCallback((id: string) => progress.academyDone.includes(id), [progress.academyDone]);

  /* ------------- Tutorial başlat / bitir ------------- */
  const startTutorial = useCallback((id: string) => {
    const def = ALL_TUTORIALS.find((t) => t.id === id);
    if (!def) return;
    setActiveId(id);
    // Merkezden/yoldaştan "yeniden başlat" = baştan (0. adım).
    // (İlk açılıştaki welcome devamı ayrı bir efektte ele alınır.)
    setActiveStep(0);
  }, []);

  const finishActive = useCallback(
    (id: string) => {
      setProgress((prev) => {
        const next = { ...prev };
        if (id === 'welcome') {
          next.welcomeDone = true;
          next.welcomeStep = 0;
          // Akademi karşılama turundan sonra başlar
          if (!next.academyStarted) next.academyStarted = true;
        }
        if (!next.completed.includes(id)) next.completed = [...next.completed, id];
        return next;
      });
      setActiveId(null);
      setActiveStep(0);
      setAcademyActive((prev) => prev || id === 'welcome');
      // Tutorial okunup pencere kapandığında hoş bir bildirim sesi
      playLessonDoneSound();
    },
    []
  );

  const skipActive = useCallback(() => {
    if (activeId) finishActive(activeId);
  }, [activeId, finishActive]);

  const nextStep = useCallback(() => {
    if (!activeTutorial) return;
    if (activeStep < activeTutorial.steps.length - 1) {
      const ns = activeStep + 1;
      setActiveStep(ns);
      if (activeTutorial.id === 'welcome') {
        setProgress((p) => ({ ...p, welcomeStep: ns }));
      }
    } else {
      finishActive(activeTutorial.id);
    }
  }, [activeTutorial, activeStep, finishActive]);

  const prevStep = useCallback(() => {
    if (activeStep > 0) {
      const ns = activeStep - 1;
      setActiveStep(ns);
      if (activeId === 'welcome') setProgress((p) => ({ ...p, welcomeStep: ns }));
    }
  }, [activeStep, activeId]);

  /* ------------- Akademi ------------- */
  const startAcademy = useCallback(() => {
    setProgress((p) => ({
      ...p,
      academyStarted: true,
      // Akademi bitmişse "Başla" yeniden 1. dersten başlasın
      academyStep: p.academyStep >= ACADEMY_QUESTS.length ? 0 : p.academyStep,
    }));
    setAcademyActive(true);
  }, []);

  /** Tek bir derse atla. Merkezdeki ders satırları bunu kullanır: ister
   *  baştan, ister bitmiş bir dersi ayrı ayrı yeniden yap. */
  const startLesson = useCallback((index: number) => {
    const target = Math.max(0, Math.min(index, ACADEMY_QUESTS.length - 1));
    setProgress((p) => ({ ...p, academyStarted: true, academyStep: target }));
    setAcademyActive(true);
  }, []);

  // Olay geldiğinde akademi görevini ilerlet
  const notifyEvent = useCallback(
    (eventName: string) => {
      // 1) Yürürlükteki 'action' adımı bu olayı bekliyorsa ilerle
      if (activeTutorial && activeStepType === 'action') {
        const step = activeTutorial.steps[activeStep];
        if (step?.target && `action_${step.target}` === eventName) {
          nextStep();
          return;
        }
      }

      setProgress((p) => {
        if (p.events.includes(eventName)) return p;
        return { ...p, events: [...p.events, eventName] };
      });
      // Eşleşen aktif akademi görevini tamamla
      setProgress((p) => {
        if (!p.academyStarted || p.academyStep >= ACADEMY_QUESTS.length) return p;
        const quest = ACADEMY_QUESTS[p.academyStep];
        if (quest && quest.trigger === eventName) {
          // Bitmiş bir dersi yeniden yapmak da ilerletsin: id zaten listede olsa
          // bile akademi adımı ilerletilir.
          const done = p.academyDone.includes(quest.id)
            ? p.academyDone
            : [...p.academyDone, quest.id];
          // Tamamlanan dersten sonraki BAŞLANMAMIŞ (bitmemiş) dersi bul.
          // Sıradaki hepsi bitmişse baştan tara; hiçbiri yoksa akademi biter.
          let step = ACADEMY_QUESTS.length;
          for (let i = p.academyStep + 1; i < ACADEMY_QUESTS.length; i++) {
            if (!done.includes(ACADEMY_QUESTS[i].id)) {
              step = i;
              break;
            }
          }
          if (step === ACADEMY_QUESTS.length) {
            for (let i = 0; i < p.academyStep; i++) {
              if (!done.includes(ACADEMY_QUESTS[i].id)) {
                step = i;
                break;
              }
            }
          }
          return { ...p, academyDone: done, academyStep: step };
        }
        return p;
      });
    },
    [activeTutorial, activeStepType, activeStep, nextStep]
  );

  // Ders sırası dışında yapılmış eylemleri geriye dönük tamamla: akademi adımı
  // bir derse oturduğunda o dersin olayı daha önce events'e düşmüşse ders
  // kendiliğinden tamamlanır (kullanıcının aynı eylemi tekrar yapması gerekmez).
  useEffect(() => {
    if (!progress.academyStarted || progress.academyStep >= ACADEMY_QUESTS.length) return;
    const quest = ACADEMY_QUESTS[progress.academyStep];
    if (!quest || progress.academyDone.includes(quest.id)) return;
    if (!progress.events.includes(quest.trigger)) return;
    notifyEvent(quest.trigger);
  }, [progress.academyStarted, progress.academyStep, progress.academyDone, progress.events, notifyEvent]);

  /* ------------- Tetikleyiciler ------------- */
  // Akademi sürerken adım-tutorial'lar ertelenir (sıra: karşılama > akademi > sayfa > pencere)
  const academyInProgress = progress.academyStarted && progress.academyStep < ACADEMY_QUESTS.length;

  const notifyPageVisit = useCallback(
    (page: string) => {
      // Karşılama turu önceliklidir: çocuk effect'ler ebeveyn effect'inden önce
      // çalıştığı için ilk ziyaret buradan geçer. Karşılama bitmeden sayfa turu
      // başlatılırsa boot effect onu ezer ve o sayfanın turu hiçbir zaman
      // gösterilmez (ziyaret kaydedildiği için tekrar tetiklenmez). Bu yüzden
      // karşılama sürerken ziyaret kaydedilmiyor.
      if (!progress.welcomeDone) return;
      // Bir adım-tutorial sürüyorsa bu ziyareti ertele (sonraya taze kalsın)
      if (activeId) return;
      // NOT: Akademi artık sayfa turlarını ENGELLEMEZ — bir sayfaya ilk girişte
      // karşılama da akademi de sürse sayfa turu başlar (kullanıcı talebi).
      // Pencere (modal) turlarında akademi kapısı korunur: akademi dersleri
      // puanlama penceresini açar, iki katman üst üste binmesin.

      setProgress((p) => {
        if (p.pageVisited.includes(page)) return p;
        return { ...p, pageVisited: [...p.pageVisited, page] };
      });

      // Tutorial başlat (sayfa ziyaretinde ilk kez)
      const tut = PAGE_TUTORIALS.find((t) => t.page === page);
      if (tut && !progress.completed.includes(tut.id) && !progress.pageVisited.includes(page)) {
        startTutorial(tut.id);
      }
    },
    [activeId, academyInProgress, progress.completed, progress.pageVisited, progress.welcomeDone, notifyEvent, startTutorial]
  );

  const notifyModalOpen = useCallback(
    (modalId: string) => {
      // Karşılama sürerken pencere turu da ertelenir (öncelik: karşılama > pencere)
      if (!progress.welcomeDone) return;
      if (activeId) return;
      // Akademi sürerken pencere turu ertelenir (mesela Akademi 2. ders puanlama açar)
      if (academyInProgress) return;
      const tut = MODAL_TUTORIALS.find((t) => t.id === modalId);
      if (tut && !progress.completed.includes(tut.id) && !progress.modalSeen.includes(modalId)) {
        setProgress((p) => ({ ...p, modalSeen: [...p.modalSeen, modalId] }));
        startTutorial(tut.id);
      }
    },
    [activeId, academyInProgress, progress.completed, progress.modalSeen, progress.welcomeDone, startTutorial]
  );

  // Pencere kapandıysa (puanlandı/gönderdi ya da vazgeçti) açık tutoriali kapat
  const notifyModalClose = useCallback(
    (modalId: string) => {
      if (activeTutorial && activeTutorial.id === modalId) {
        finishActive(modalId);
      }
    },
    [activeTutorial, finishActive]
  );

  /* ------------- Veri değişiminden akademi tespiti ------------- */
  useEffect(() => {
    const movies = app.data.movies?.length || 0;
    const series = app.data.series?.length || 0;
    const history = app.data.history?.length || 0;
    const plan = app.data.weeklyPlan?.length || 0;
    const activeQ = quests.questState.activeQuestId;

    if (movies > prevMovies.current) notifyEvent('movie_added');
    if (series > prevSeries.current) notifyEvent('series_added');
    if (history > prevHistory.current) notifyEvent('movie_rated');
    if (plan > prevPlan.current) notifyEvent('plan_added');
    if (activeQ && activeQ !== prevActiveQuest.current) notifyEvent('quest_accepted');

    prevMovies.current = movies;
    prevSeries.current = series;
    prevHistory.current = history;
    prevPlan.current = plan;
    prevActiveQuest.current = activeQ;
  }, [app.data.movies?.length, app.data.series?.length, app.data.history?.length, app.data.weeklyPlan?.length, quests.questState.activeQuestId, notifyEvent]);

  // Akademi başlangıcı senkronu
  useEffect(() => {
    if (progress.academyStarted && progress.academyStep < ACADEMY_QUESTS.length) {
      setAcademyActive(true);
    } else {
      setAcademyActive(false);
    }
  }, [progress.academyStarted, progress.academyStep]);

  /* ------------- Karşılama turu otomatik (ilk açılış) ------------- */
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    if (!progress.welcomeDone) {
      setActiveId('welcome');
      setActiveStep(progress.welcomeStep || 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetAll = useCallback(() => {
    setProgress({ ...defaultProgress });
    setActiveId(null);
    setActiveStep(0);
    setAcademyActive(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const value: TutorialContextValue = {
    progress,
    activeTutorial,
    activeKind,
    activeStep,
    activeStepType,
    startTutorial,
    skipActive,
    nextStep,
    prevStep,
    academyActive,
    academyStep: progress.academyStep,
    startAcademy,
    startLesson,
    notifyPageVisit,
    notifyModalOpen,
    notifyModalClose,
    notifyEvent,
    isDone,
    academyQuestDone,
    centerOpen,
    setCenterOpen,
    resetAll,
  };

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}
