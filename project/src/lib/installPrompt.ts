/* ============================================================
   SINEVIA - UYGULAMA YÜKLEME (PWA INSTALL) YARDIMCILARI
   ============================================================
   Neden bu dosya var?
   - Chrome/Edge/Android: `beforeinstallprompt` olayı yakalanıp
     saklanmazsa tarayıcı kendi mini çubuğunu gösterir ve bir daha
     "Yükle" düğmesi sunmaz. Olay sayfa açılışında, kullanıcı
     Ayarlar'ı açmadan ÖNCE tetiklendiği için dinleyici uygulama
     başlangıcında (`initInstallPromptCapture`) kurulur.
   - iOS/Safari: `beforeinstallprompt` HİÇ desteklenmez; kurulum
     yalnızca Paylaş → "Ana Ekrana Ekle" ile yapılır. Bu yüzden
     adım adım yönerge gösterilir.
   - Firefox (masaüstü): PWA kurulumu desteklenmez; yönerge metni
     yerine "Chrome/Edge kullan" bilgisi verilir.
   ============================================================ */

export type InstallPlatform = 'ios' | 'android' | 'desktop';

export type InstallBrowser = 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'other';

/** Tarayıcının `beforeinstallprompt` olayı (standart dışı, Chromium'a özel). */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export type InstallSignal = {
  /** `beforeinstallprompt` yakalandı ve düğme ile kurulum başlatılabilir. */
  canPrompt: boolean;
  /** Uygulama standalone (ana ekrandan / masaüstünden) çalışıyor. */
  installed: boolean;
  platform: InstallPlatform;
  browser: InstallBrowser;
};

export type InstallPromptResult =
  | { ok: true }
  | { ok: false; reason: 'dismissed' | 'unavailable' | 'error' };

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedDuringSession = false;
let initialized = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* dinleyici hatası akışı bozmasın */
    }
  });
}

/** `beforeinstallprompt` olayından gelen olayı saklar; tarayıcının kendi çubuğunu kapatır. */
function handleBeforeInstallPrompt(event: Event): void {
  // preventDefault yapılmazsa tarayıcı kendi "Yükle" çubuğunu gösterir ve
  // programatik prompt() hakkı bir kez kullanılmış olur.
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  emit();
}

function handleAppInstalled(): void {
  installedDuringSession = true;
  deferredPrompt = null;
  emit();
}

/**
 * Olay dinleyicilerini kurar. Birden çok kez çağrılabilir (idempotent).
 * `main.tsx` içinde uygulama açılışında bir kez çağrılır.
 */
export function initInstallPromptCapture(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);

  // Masaüstü PWA penceresinden siteye dönüldüğünde durumu tazele.
  try {
    const media = window.matchMedia('(display-mode: standalone)');
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', emit);
    }
  } catch {
    /* matchMedia yoksa yoksay */
  }
}

/** Kurulum durumu değiştiğinde (olay yakalandı / uygulama yüklendi) haber verir. */
export function subscribeInstallSignal(listener: () => void): () => void {
  initInstallPromptCapture();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Uygulama standalone modda mı çalışıyor? (Ana ekran / masaüstü kısayolu) */
export function isInstalledApp(): boolean {
  if (installedDuringSession) return true;
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia && window.matchMedia('(display-mode: minimal-ui)').matches) return true;
  } catch {
    /* yoksay */
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** UA'dan platform tespiti (saf fonksiyon - test edilebilir). */
export function detectInstallPlatform(
  userAgent: string,
  maxTouchPoints = 0,
  platform = '',
): InstallPlatform {
  const ua = userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';
  // iPadOS 13+ masaüstü Safari gibi görünür: MacIntel + dokunmatik.
  if (platform === 'MacIntel' && maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** UA'dan tarayıcı tespiti (saf fonksiyon - test edilebilir). */
export function detectInstallBrowser(userAgent: string): InstallBrowser {
  const ua = userAgent || '';
  if (/EdgA?\//i.test(ua)) return 'edge';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/FxiOS|Firefox/i.test(ua)) return 'firefox';
  if (/CriOS|Chrome|Chromium/i.test(ua)) return 'chrome';
  if (/Safari/i.test(ua)) return 'safari';
  return 'other';
}

export function getInstallSignal(): InstallSignal {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { canPrompt: false, installed: false, platform: 'desktop', browser: 'other' };
  }
  const installed = isInstalledApp();
  const nav = navigator as Navigator & { maxTouchPoints?: number };
  const userAgent = nav.userAgent || '';
  const platform = detectInstallPlatform(userAgent, nav.maxTouchPoints || 0, nav.platform || '');
  const browser = detectInstallBrowser(userAgent);
  return {
    canPrompt: !!deferredPrompt && !installed,
    installed,
    platform,
    browser,
  };
}

/**
 * Tarayıcının kurulum penceresini açar. Yalnızca `canPrompt` true iken çalışır;
 * olay tek kullanımlıktır, kullanıldıktan sonra tarayıcı yeni olay gönderene
 * kadar düğme yönergeye döner.
 */
export async function promptInstall(): Promise<InstallPromptResult> {
  if (!deferredPrompt) return { ok: false, reason: 'unavailable' };
  const event = deferredPrompt;
  deferredPrompt = null;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    emit();
    return choice.outcome === 'accepted' ? { ok: true } : { ok: false, reason: 'dismissed' };
  } catch {
    emit();
    return { ok: false, reason: 'error' };
  }
}
