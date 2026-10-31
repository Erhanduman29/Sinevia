import { useState, useEffect, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { useSettings } from './context/slices';
import { QuestProvider } from './context/QuestContext'; // YENİ: QuestProvider eklendi
import { TutorialProvider, useTutorial } from './context/TutorialContext';
import { NetworkAuthProvider } from './context/NetworkAuthContext';
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
import MarketPage from './pages/MarketPage';
import WeeklyPlanPage from './pages/WeeklyPlanPage';
import NetworkPage from './pages/NetworkPage'; // YENİ: Sinevia Ağı import edildi
import NetworkAuthModal from './components/NetworkAuthModal'; // YENİ: Ağ auth modalı
import Toasts from './components/Toasts';
import AchievementToasts from './components/AchievementToasts';
import CloudConflictDialog from './components/CloudConflictDialog';
import LevelUpModal from './components/LevelUpModal';
import SeasonCompleteModal from './components/SeasonCompleteModal';
import XpGainOverlay from './components/XpGainOverlay';
import CoinGainOverlay from './components/CoinGainOverlay';
import { ContractCelebrationOverlay } from './components/ContractCelebrationOverlay';
import TutorialOverlay from './tutorial/TutorialOverlay';
import AcademyCompanion from './tutorial/AcademyCompanion';
import TutorialCenter from './tutorial/TutorialCenter';
import { ACADEMY_QUESTS } from './tutorial/texts';
// Klavye kısayolları: global dinleyici + sabit yardımcılar (bkz. src/lib/shortcuts.ts)
import { useShortcuts } from './hooks/useShortcuts';
import { SHORTCUT_CLOSE_EVENT, focusPageSearch } from './lib/shortcuts';
import ErrorScreen from './components/ErrorScreen';
import AppErrorBoundary from './components/AppErrorBoundary';

const ACTIVE_TAB_STORAGE_KEY = 'sinevia_active_tab';
const VALID_TABS: TabId[] = [
  'home',
  'movies',
  'series',
  'network', // YENİ: Ağ sekmesi geçerli yollara eklendi
  'plan',
  'history',
  'achievements',
  'market',
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

/** Bilinmeyen hash/sekmeler için 404 tespiti (geçerli sekmeler hariç). */
function getInitialNotFound(): string | null {
  try {
    const hashTab = window.location.hash.replace('#', '').trim();
    if (hashTab && !isValidTab(hashTab)) return hashTab;
  } catch {}
  return null;
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);
  const [notFoundPath, setNotFoundPath] = useState<string | null>(getInitialNotFound);
  const [showNetworkAuthModal, setShowNetworkAuthModal] = useState(false);
  const {
    toasts,
    achievementToasts,
    levelUpData,
    seasonCompleteData,
    dismissLevelUp,
    dismissSeasonComplete,
    xpGainData,
    coinGainData,
    contractCelebrationData,
    dismissContractCelebration,
    cloudConflict,
    resolveCloudConflict,
  } = useApp();
  const { reducedMotion, fastCelebrations } = useSettings();
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

  // Geçerli sekme değiştiğinde 404 ekranını kapat (kısayol/sidebar gezinmeleri dahil)
  const prevTabRef = useRef<TabId>(activeTab);
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      prevTabRef.current = activeTab;
      setNotFoundPath(null);
    }
  }, [activeTab]);

  /** Hata/404 ekranlarından güvenli ana sayfa dönüşü */
  const handleHomeFromError = () => {
    setNotFoundPath(null);
    setActiveTab('home');
    try {
      window.history.replaceState(null, '', '#home');
    } catch {}
  };

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
        setNotFoundPath(null);
        setActiveTab(e.detail);
      }
    };

    const handleHashChange = () => {
      const hashTab = window.location.hash.replace('#', '').trim();
      if (isValidTab(hashTab)) {
        setNotFoundPath(null);
        setActiveTab(hashTab);
      } else if (hashTab) {
        // Bilinmeyen sekme/yol → 404 hata ekranı (boş/siyah ekran yerine)
        setNotFoundPath(hashTab);
      }
    };

    window.addEventListener('navigate-tab', handleNavigation);
    window.addEventListener('hashchange', handleHashChange);

    // Sinevia Ağı kayıt/giriş modalını açma talebi (Layout.tsx'tan gönderilir)
    const handleOpenNetworkAuth = () => setShowNetworkAuthModal(true);
    window.addEventListener('sinevia-open-network-auth', handleOpenNetworkAuth);

    return () => {
      window.removeEventListener('navigate-tab', handleNavigation);
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('sinevia-open-network-auth', handleOpenNetworkAuth);
    };
  }, []);

  // Arka plan durgunluğu (onaylı): sekme gizlenince animasyonları duraklat
  useEffect(() => {
    const sync = () => document.body.classList.toggle('anim-paused', document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  // Kullanıcı tercihleri: süslemeleri sakinleştir / kutlamaları kısalt.
  // Yalnızca body sınıfı değişir; sesler ve oyun kuralları etkilenmez.
  useEffect(() => {
    document.body.classList.toggle('reduce-motion', !!reducedMotion);
    document.body.classList.toggle('fast-celebrations', !!fastCelebrations);
  }, [reducedMotion, fastCelebrations]);

  // PREMIUM MİKRO-ETKİLEŞİM: global buton tık sesi (stereo, 60ms).
  // Yakalama fazında + 40ms throttle; ses terbiyesi sound.ts içindeki
  // isSoundEnabled kontrolüne saygılıdır.
  useEffect(() => {
    let lastAt = 0;
    const onPointerDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('button, [role="button"]');
      if (!el || (el as HTMLButtonElement).disabled) return;
      // GRUPLAMA: data-snd="primary|secondary|nav|rating" olan butonlar sesli.
      // Kapatma butonları data-snd="close" ile İMZALANIR → asla ses yok.
      // Attribute yoksa da ses yok (her butonda ses istenmiyor).
      const snd = el.getAttribute('data-snd');
      if (!snd || snd === 'close') return;
      if (snd !== 'primary' && snd !== 'secondary' && snd !== 'nav' && snd !== 'rating') return;
      const now = performance.now();
      if (now - lastAt < 40) return;
      lastAt = now;
      import('./lib/sound').then(({ playUiClickSound }) => playUiClickSound(snd));
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  return (
    <AppErrorBoundary onHome={handleHomeFromError}>
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      <AppErrorBoundary key={activeTab} onHome={handleHomeFromError}>
      {notFoundPath ? (
        <ErrorScreen code={404} onHome={handleHomeFromError} />
      ) : (
      <>
      {activeTab === 'home' && <HomePage />}
      {activeTab === 'movies' && <MoviesPage />}
      {activeTab === 'series' && <SeriesPage />}
      {activeTab === 'network' && <NetworkPage />} {/* YENİ: Tıklandığında NetworkPage açılacak */}
      {activeTab === 'plan' && <WeeklyPlanPage />}
      {activeTab === 'history' && <HistoryPage />}
      {activeTab === 'achievements' && <AchievementsPage />}
      {activeTab === 'market' && <MarketPage />}
      {activeTab === 'stats' && <StatsPage />}
      {activeTab === 'settings' && <SettingsPage />}
      {activeTab === 'ai' && <AIPage />}
      </>
      )}
      </AppErrorBoundary>

      <TutorialLayer activeTab={activeTab} />

      {/* Kutlamalar eğitim/karşılama katmanının (z-300) üstünde kalmalı. */}
      <div className="relative z-[400]">
        {cloudConflict && (
          <CloudConflictDialog
            conflict={cloudConflict}
            onUseCloud={() => resolveCloudConflict('cloud')}
            onUseLocal={() => resolveCloudConflict('local')}
            onDefer={() => resolveCloudConflict('later')}
          />
        )}
        {contractCelebrationData && (
        <ContractCelebrationOverlay
          contractId={contractCelebrationData.contractId}
          xp={contractCelebrationData.xp}
          coins={contractCelebrationData.coins}
          onClose={dismissContractCelebration}
        />
      )}
      {xpGainData && (
          <XpGainOverlay key={`${xpGainData.oldTotal}-${xpGainData.newTotal}`} />
        )}

        {coinGainData && (
          <CoinGainOverlay key={`${coinGainData.amount}-${coinGainData.label}`} amount={coinGainData.amount} label={coinGainData.label} />
        )}

        <Toasts toasts={toasts} stackOffset={achievementToasts.length > 0 ? achievementToasts.length * 104 : 0} />
        <AchievementToasts toasts={achievementToasts} />

        {showNetworkAuthModal && (
          <NetworkAuthModal onClose={() => setShowNetworkAuthModal(false)} />
        )}

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
    </AppErrorBoundary>
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
          <NetworkAuthProvider>
            <AppContent />
          </NetworkAuthProvider>
        </TutorialProvider>
      </QuestProvider>
    </AppProvider>
  );
}