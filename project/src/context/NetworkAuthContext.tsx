/**
 * NetworkAuthContext — Sinevia Ağı oturum durumu.
 *
 * AppContext ile ayrı tutulmuştur (karmaşık reducer'a dokunulmaz).
 * Bileşenler bu context'i kullanarak "giriş yapıldı mı?" bilgisine erişir.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  getStoredSessionToken,
  networkGetMe,
  networkLogout,
  networkTouchDevice,
  setStoredSessionToken,
  type NetworkUser,
} from '../lib/networkAuth';

interface NetworkAuthContextValue {
  networkUser: NetworkUser | null;
  isNetworkLoading: boolean;
  hasNetworkSession: () => boolean;
  refreshNetworkUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const NetworkAuthContext = createContext<NetworkAuthContextValue | null>(null);

export function useNetworkAuth() {
  const ctx = useContext(NetworkAuthContext);
  if (!ctx) throw new Error('useNetworkAuth must be used within NetworkAuthProvider');
  return ctx;
}

export function NetworkAuthProvider({ children }: { children: ReactNode }) {
  const [networkUser, setNetworkUser] = useState<NetworkUser | null>(null);
  const [isNetworkLoading, setIsNetworkLoading] = useState(true);

  const refreshNetworkUser = useCallback(async () => {
    const user = await networkGetMe();
    setNetworkUser(user);
    setIsNetworkLoading(false);

    if (user) {
      // Çoklu cihaz: oturum geçerliyse bu cihazı şifre sormadan kaydet.
      // İlk kez kaydedildiyse temiz bir açılış yap (bulut eşitlemesi hemen yazabilsin).
      const linked = await networkTouchDevice();
      if (linked && typeof window !== 'undefined') {
        const guard = 'sinevia_device_linked_reload';
        try {
          if (!sessionStorage.getItem(guard)) {
            sessionStorage.setItem(guard, '1');
            window.location.reload();
          }
        } catch { /* gizli mod: sessizce geç */ }
      }
    }
  }, []);

  const logout = useCallback(async () => {
    await networkLogout();
    setNetworkUser(null);
    setIsNetworkLoading(false);
  }, []);

  useEffect(() => {
    // Mountta oturum varsa kullanıcı bilgisini çek.
    refreshNetworkUser();
  }, [refreshNetworkUser]);

  const value: NetworkAuthContextValue = {
    networkUser,
    isNetworkLoading,
    hasNetworkSession: () => getStoredSessionToken() !== null,
    refreshNetworkUser,
    logout,
  };

  return (
    <NetworkAuthContext.Provider value={value}>
      {children}
    </NetworkAuthContext.Provider>
  );
}