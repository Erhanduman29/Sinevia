import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
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
import Toasts from './components/Toasts';
import AchievementToasts from './components/AchievementToasts';
import LevelUpModal from './components/LevelUpModal';
import SeasonCompleteModal from './components/SeasonCompleteModal';
import XpGainOverlay from './components/XpGainOverlay';

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const { toasts, achievementToasts, levelUpData, seasonCompleteData, dismissLevelUp, dismissSeasonComplete, xpGainData } = useApp();

  useEffect(() => {
    const handleNavigation = (e: any) => {
      if (e.detail) setActiveTab(e.detail);
    };
    window.addEventListener('navigate-tab', handleNavigation);
    return () => window.removeEventListener('navigate-tab', handleNavigation);
  }, []);

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'home' && <HomePage />}
      {activeTab === 'movies' && <MoviesPage />}
      {activeTab === 'series' && <SeriesPage />}
      {activeTab === 'history' && <HistoryPage />}
      {activeTab === 'achievements' && <AchievementsPage />}
      {activeTab === 'stats' && <StatsPage />}
      {activeTab === 'settings' && <SettingsPage />}
      {activeTab === 'ai' && <AIPage />}

      {/* Her yeni başarımda XP barının sıfırdan animasyona girmesi için benzersiz key ile koşullu render */}
      {xpGainData && (
        <XpGainOverlay key={`${xpGainData.oldTotal}-${xpGainData.newTotal}`} />
      )}
      
      <Toasts toasts={toasts} />
      <AchievementToasts toasts={achievementToasts} />
      
      {levelUpData && (
        <LevelUpModal 
          newLevel={levelUpData.newLevel} 
          onDismiss={dismissLevelUp} 
        />
      )}
      
      {seasonCompleteData && (
        <SeasonCompleteModal
          seriesTitle={seasonCompleteData.seriesTitle}
          season={seasonCompleteData.season}
          onDismiss={dismissSeasonComplete}
        />
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}