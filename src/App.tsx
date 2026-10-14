import { useState, useEffect, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { QuestProvider } from './context/QuestContext'; // YENİ: QuestProvider eklendi
import { TutorialProvider, useTutorial } from './context/TutorialContext';
import Layout from './components/Layout';
import type { TabId } from './components/Layout';
import HomePage from './pages/HomePage';
import MoviesPage from './pages/MoviesPage';
import SeriesPage from './pages/SeriesPage';
import HistoryPage from './pages/HistoryPage';
import AchievementsPage from './pages/AchievementsPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import AIPage from './pages/AIPage';
import WeeklyPlanPage from './pages/WeeklyPlanPage';
import NetworkPage from './pages/NetworkPage'; // YENİ: Sinevia Ağı import edildi
import Toasts from './components/Toasts';
import AchievementToasts from './components/AchievementToasts';
import LevelUpModal from './components/LevelUpModal';
import SeasonCompleteModal from './components/SeasonCompleteModal';
import XpGainOverlay from './components/XpGainOverlay';
import TutorialOverlay from './tutorial/TutorialOverlay';
import AcademyCompanion from './tutorial/AcademyCompanion';
import TutorialCenter from './tutorial/TutorialCenter';
import { ACADEMY_QUESTS } from './tutorial/texts';
// Klavye kısayolları: global dinleyici + sabit yardımcılar (bkz. src/lib/shortcuts.ts)
import { useShortcuts } from './hooks/useShortcuts';
import { SHORTCUT_CLOSE_EVENT, focusPageSearch } from './lib/shortcuts';

const ACTIVE_TAB_STORAGE_KEY = 'sinevia_active_tab';
const VALID_TABS: TabId[] = [
  'home',
  'movies',
  'series',
  'network', // YENİ: Ağ sekmesi geçerli yollara eklendi
  'plan',
  'history',
  'achievements',
  'stats',
  'settings',
  'ai',
];

function isValidTab(val: any): val is TabId {
  return typeof val === 'string' && VALID_TABS.includes(val as TabId);
}

function getInitialTab(): TabId {
  try {
    const hashTab = window.location.hash.replace('#', '').trim();
    if (isValidTab(hashTab)) return hashTab;

    const savedTab = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    if (isValidTab(savedTab)) return savedTab;
  } catch {}
  return 'home';
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);
  const {
    toasts,
    achievementToasts,
    levelUpData,
    seasonCompleteData,
    dismissLevelUp,
    dismissSeasonComplete,
    xpGainData,
  } = useApp();
  // Tutorial Merkezi kısayolla açılıp kapatılabilsin (Esc / F1).
  const { centerOpen, setCenterOpen } = useTutorial();

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
      if (window.location.hash !== `#${activeTab}`) {
        window.history.replaceState(null, '', `#${activeTab}`);
      }
    } catch {}
  }, [activeTab]);

  // Global klavye kısayolları (varsayılanlar ve kullanıcı atamaları için
  // bkz. src/lib/shortcuts.ts; ayarlardan değiştirilebilir: Ayarlar → Kısayollar).
  useShortcuts({
    close: () => {
      if (centerOpen) {
        setCenterOpen(false);
        return;
      }
      // Açık pencereler (ör. ConfirmDialog) bu olayı dinleyerek kapanabilir.
      window.dispatchEvent(new CustomEvent(SHORTCUT_CLOSE_EVENT));
    },
    focusSearch: () => {
      focusPageSearch();
    },
    openTutorial: () => setCenterOpen(!centerOpen),
    goHome: () => setActiveTab('home'),
    goMovies: () => setActiveTab('movies'),
    goSeries: () => setActiveTab('series'),
    goNetwork: () => setActiveTab('network'),
    goPlan: () => setActiveTab('plan'),
    goHistory: () => setActiveTab('history'),
    goAchievements: () => setActiveTab('achievements'),
    goStats: () => setActiveTab('stats'),
    goAI: () => setActiveTab('ai'),
    goSettings: () => setActiveTab('settings'),
  });

  useEffect(() => {
    const handleNavigation = (e: any) => {
      if (isValidTab(e.detail)) {
        setActiveTab(e.detail);
      }
    };

    const handleHashChange = () => {
      const hashTab = window.location.hash.replace('#', '').trim();
      if (isValidTab(hashTab)) {
        setActiveTab(hashTab);
      }
    };

    window.addEventListener('navigate-tab', handleNavigation);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('navigate-tab', handleNavigation);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Arka plan durgunluğu (onaylı): sekme gizlenince animasyonları duraklat
  useEffect(() => {
    const sync = () => document.body.classList.toggle('anim-paused', document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'home' && <HomePage />}
      {activeTab === 'movies' && <MoviesPage />}
      {activeTab === 'series' && <SeriesPage />}
      {activeTab === 'network' && <NetworkPage />} {/* YENİ: Tıklandığında NetworkPage açılacak */}
      {activeTab === 'plan' && <WeeklyPlanPage />}
      {activeTab === 'history' && <HistoryPage />}
      {activeTab === 'achievements' && <AchievementsPage />}
      {activeTab === 'stats' && <StatsPage />}
      {activeTab === 'settings' && <SettingsPage />}
      {activeTab === 'ai' && <AIPage />}

      <TutorialLayer activeTab={activeTab} />

      <div className="relative z-[200]">
        {xpGainData && (
          <XpGainOverlay key={`${xpGainData.oldTotal}-${xpGainData.newTotal}`} />
        )}

        <Toasts toasts={toasts} />
        <AchievementToasts toasts={achievementToasts} />

        {levelUpData && (
          <LevelUpModal newLevel={levelUpData.newLevel} onDismiss={dismissLevelUp} />
        )}

        {seasonCompleteData && (
          <SeasonCompleteModal
            seriesTitle={seasonCompleteData.seriesTitle}
            season={seasonCompleteData.season}
            onDismiss={dismissSeasonComplete}
          />
        )}
      </div>
    </Layout>
  );
}

/** Tutorial katmanı: sayfa ziyaretini bildirir, overlay + akademi + merkez + yardım butonu. */
function TutorialLayer({ activeTab }: { activeTab: TabId }) {
  const { notifyPageVisit, centerOpen, setCenterOpen, progress } = useTutorial();
  const academyDone = progress.academyDone.length;
  const prevAcademyDone = useRef(academyDone);
  /** Akademi bittiği commit'teki ani notifyPageVisit tetikini atlamak için */
  const skipNextVisit = useRef(false);

  // Akademi tamamlanır tamamlanmaz o an bulunulan sayfanın bekleyen turunu başlat
  useEffect(() => {
    const total = ACADEMY_QUESTS.length;
    const justFinished = prevAcademyDone.current < total && academyDone >= total;
    prevAcademyDone.current = academyDone;
    if (justFinished) {
      // Kısa gecikme: akademi kutlaması rahatlasın
      skipNextVisit.current = true; // aşağıdaki normal effect bu commit'te tetiklenmesin
      const t = setTimeout(() => notifyPageVisit(activeTab), 1400);
      return () => clearTimeout(t);
    }
  }, [academyDone, activeTab, notifyPageVisit]);

  // Sayfa ziyareti bildirimi. academyInProgress değişince bu callback'in kimliği de
  // değişir ve effect yeniden koşar; akademi biterken bu ani tetik, ertelenmiş
  // tetikle üst üste binerdi. Bu yüzden akademi bitişi commit'inde bir kez atlanır.
  useEffect(() => {
    if (skipNextVisit.current) {
      skipNextVisit.current = false;
      return;
    }
    notifyPageVisit(activeTab);
  }, [activeTab, notifyPageVisit]);

  return (
    <>
      <TutorialOverlay />
      <AcademyCompanion />

      {/* Tutorial Merkezi düğmesi artık Layout içinde (sidebar + mobil menü). */}
      {centerOpen && <TutorialCenter onClose={() => setCenterOpen(false)} />}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <QuestProvider>
        <TutorialProvider>
          <AppContent />
        </TutorialProvider>
      </QuestProvider>
    </AppProvider>
  );
}