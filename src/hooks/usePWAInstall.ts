import { useState, useEffect } from 'react';

// Tetikleyiciyi React bileşeninin dışında, en üst seviyede yakalıyoruz
let globalDeferredPrompt: any = null;
let isInstallableGlobal = false;
const listeners: Set<() => void> = new Set();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  globalDeferredPrompt = e;
  isInstallableGlobal = true;
  listeners.forEach(listener => listener());
});

export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState(isInstallableGlobal);

  useEffect(() => {
    const updateState = () => setIsInstallable(isInstallableGlobal);
    listeners.add(updateState);
    return () => {
      listeners.delete(updateState);
    };
  }, []);

  const installPWA = async () => {
    if (!globalDeferredPrompt) return;
    globalDeferredPrompt.prompt();
    const { outcome } = await globalDeferredPrompt.userChoice;
    if (outcome === 'accepted') {
      isInstallableGlobal = false;
      globalDeferredPrompt = null;
      listeners.forEach(listener => listener());
    }
  };

  return { isInstallable, installPWA };
}