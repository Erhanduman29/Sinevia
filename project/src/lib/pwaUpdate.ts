import { registerSW } from 'virtual:pwa-register';
import { APP_VERSION } from './appVersion';

/**
 * PWA GÜNCELLEME YÖNETİMİ
 *
 * Sorun: `vite-plugin-pwa` varsayılan olarak sadece `navigator.serviceWorker.register`
 * çağrısı içeren bir `registerSW.js` enjekte ediyordu. Yeni service worker
 * `skipWaiting` + `clientsClaim` ile devreye girse bile açık sayfa eski JS
 * paketiyle çalışmaya devam ediyordu. Özellikle iOS/Android ana ekran
 * uygulamalarında sayfa hiç yenilenmediği için cihaz sürüm 5.0'da takılı kalıyordu.
 *
 * Çözüm katmanları:
 *  1. `virtual:pwa-register` + `registerType: 'autoUpdate'`: yeni SW devreye
 *     girdiğinde sayfayı otomatik yeniler.
 *  2. Uygulama öne geldiğinde / odaklandığında / çevrimiçi olduğunda ve
 *     periyodik olarak `registration.update()` çağrılır.
 *  3. `/version.json` (derlemede üretilir) `no-store` ile çekilir; sunucudaki
 *     sürüm yüklü sürümden farklıysa service worker ve Cache Storage temizlenip
 *     sayfa yeniden yüklenir. Bu, SW önbelleğinde kilitlenen cihazları kurtarır.
 */

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const FORCED_UPDATE_KEY = 'sinevia:forced-update-version';
const VERSION_ENDPOINT = '/version.json';
const FETCH_TIMEOUT_MS = 10_000;
const FETCH_MAX_RETRIES = 3;

let swRegistration: ServiceWorkerRegistration | null = null;
let listenersBound = false;
let versionCheckInFlight = false;

export interface UpdateCheckResult {
  /** Sunucuda yayında olan sürüm (ulaşılamazsa null). */
  deployedVersion: string | null;
  /** true ise sayfa yeniden yükleniyor; çağıran taraf başka işlem yapmamalı. */
  updateApplied: boolean;
}

/** Yüklü (çalışan) uygulama sürümü. */
export function getRunningVersion(): string {
  return APP_VERSION;
}

/** Sunucudaki güncel sürümü önbelleğe dokunmadan okur. Geçici ağ/SSL
 *  hataları için kısa bir yeniden deneme döngüsüyle çalışır. Hata durumunda
 *  sessize geçer ve null döner (kullanıcıya hiçbir hata yansıtmaz). */
export async function fetchDeployedVersion(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const abortController = new AbortController();
  const timeout = window.setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);

  const attempt = async (tryNo: number): Promise<string | null> => {
    try {
      const response = await fetch(VERSION_ENDPOINT, {
        cache: 'no-store',
        signal: abortController.signal,
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { version?: unknown };
      return typeof data.version === 'string' && data.version ? data.version : null;
    } catch {
      if (tryNo >= FETCH_MAX_RETRIES) return null;
      // Geçici hata: kısa bir beklemeden yeniden dene.
      await new Promise((resolve) => window.setTimeout(resolve, 500 * (tryNo + 1)));
      return attempt(tryNo + 1);
    }
  };

  try {
    return await attempt(0);
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Service worker kaydını ve tüm önbellekleri temizleyip sayfayı yeniden yükler.
 * Kullanıcı verilerine (localStorage/IndexedDB) dokunmaz.
 */
export async function forceAppUpdate(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    /* yoksay */
  }

  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* yoksay */
  }

  const url = new URL(window.location.href);
  url.searchParams.set('_guncelleme', Date.now().toString(36));
  window.location.replace(url.toString());
}

/**
 * Yayındaki sürümü kontrol eder. Sürüm farklıysa önbellekleri temizleyip
 * sayfayı yeniler. Aynı hedef sürüm için oturum başına yalnızca bir kez
 * zorlar; böylece hatalı/eski bir `version.json` yüzünden sonsuz döngü olmaz.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (versionCheckInFlight) return { deployedVersion: null, updateApplied: false };
  versionCheckInFlight = true;

  try {
    const deployedVersion = await fetchDeployedVersion();
    if (!deployedVersion || deployedVersion === APP_VERSION) {
      return { deployedVersion, updateApplied: false };
    }

    try {
      if (window.sessionStorage.getItem(FORCED_UPDATE_KEY) === deployedVersion) {
        // Bu oturumda aynı sürüm için zaten zorladık; döngüye girme.
        return { deployedVersion, updateApplied: false };
      }
      window.sessionStorage.setItem(FORCED_UPDATE_KEY, deployedVersion);
    } catch {
      /* private mode: yine de devam et */
    }

    await forceAppUpdate();
    return { deployedVersion, updateApplied: true };
  } finally {
    versionCheckInFlight = false;
  }
}

function requestServiceWorkerUpdate(): void {
  try {
    void swRegistration?.update()?.catch(() => undefined);
  } catch {
    /* yoksay */
  }
}

function setupUpdateChecks(): void {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;

  const runChecks = () => {
    requestServiceWorkerUpdate();
    void checkForUpdate();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') runChecks();
  });
  window.addEventListener('focus', runChecks);
  window.addEventListener('online', runChecks);

  window.setInterval(() => {
    if (document.visibilityState === 'visible') runChecks();
  }, UPDATE_CHECK_INTERVAL_MS);

  runChecks();
}

/**
 * Uygulama açılışında bir kez çağrılır. Üretimde service worker'ı kaydeder,
 * güncelleme kontrollerini bağlar; geliştirmede yalnızca sürüm kontrolü yapar.
 */
export function initPwaUpdates(): void {
  if (typeof window === 'undefined') return;

  if (!import.meta.env.PROD) {
    // Geliştirmede SW kapalı (vite.config.ts devOptions.enabled = false).
    return;
  }

  if (!('serviceWorker' in navigator)) {
    // SW desteklenmese bile sunucu sürümü ile karşılaştırıp tazeleyebiliriz.
    void checkForUpdate();
    return;
  }

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      swRegistration = registration ?? null;
      setupUpdateChecks();
    },
    onRegisterError(error) {
      console.warn('[pwa] Service worker kaydı başarısız:', error);
      // Kayıt başarısız olsa da sürüm takibini sürdür.
      setupUpdateChecks();
    },
  });

  // SW kaydı gecikirse/güvenlik nedeniyle kurulamazsa sürüm kontrolü yine çalışsın.
  setupUpdateChecks();
}
