import { useEffect, useState } from 'react';
import {
  getInstallSignal,
  subscribeInstallSignal,
  type InstallSignal,
} from '../lib/installPrompt';

/**
 * PWA kurulum durumunu (yüklenebilir / yüklü / platform) React'e taşır.
 * `beforeinstallprompt` olayı uygulama açılışında yakalandığı için bu hook
 * yalnızca mevcut durumu okur ve değişikliklere abone olur.
 */
export function useInstallSignal(): InstallSignal {
  const [signal, setSignal] = useState<InstallSignal>(getInstallSignal);

  useEffect(() => {
    const refresh = () => setSignal(getInstallSignal());
    // Abone olurken durumu da tazele (olay hook'tan önce yakalanmış olabilir).
    refresh();
    return subscribeInstallSignal(refresh);
  }, []);

  return signal;
}
