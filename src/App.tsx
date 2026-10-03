import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { QuestProvider } from './context/QuestContext'; // YENİ: QuestProvider eklendi
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
import Toasts from './components/Toasts';
import AchievementToasts from './components/AchievementToasts';
import LevelUpModal from './components/LevelUpModal';
import SeasonCompleteModal from './components/SeasonCompleteModal';
import XpGainOverlay from './components/XpGainOverlay';

const ACTIVE_TAB_STORAGE_KEY = 'sinevia_active_tab';
const VALID_TABS: TabId[] = [
  'home',
  'movies',
  'series',
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

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
      if (window.location.hash !== `#${activeTab}`) {
        window.history.replaceState(null, '', `#${activeTab}`);
      }
    } catch {}
  }, [activeTab]);

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

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'home' && <HomePage />}
      {activeTab === 'movies' && <MoviesPage />}
      {activeTab === 'series' && <SeriesPage />}
      {activeTab === 'plan' && <WeeklyPlanPage />}
      {activeTab === 'history' && <HistoryPage />}
      {activeTab === 'achievements' && <AchievementsPage />}
      {activeTab === 'stats' && <StatsPage />}
      {activeTab === 'settings' && <SettingsPage />}
      {activeTab === 'ai' && <AIPage />}

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

export default function App() {
  return (
    <AppProvider>
      <QuestProvider>  {/* GÖREV SİSTEMİ TÜM UYGULAMAYI SARMALADI */}
        <AppContent />
      </QuestProvider>
    </AppProvider>
  );
}