/* ============================================================
   SINEVIA — BİLDİRİM / WEB PUSH YARDIMCILARI
   ============================================================
   Neden bu dosya var?
   - Masaüstünde `new Notification()` çalışır ama mobilde ÇALIŞMAZ
     (Android Chrome: "Illegal constructor"; iOS: yalnızca kurulu PWA
     ve service worker üzerinden). Bu yüzden gösterim her zaman
     `registration.showNotification()` üzerinden yapılır, constructor
     yalnızca son çare fallback'tir.
   - Uygulama kapalıyken bildirim için gerçek Web Push aboneliği
     (VAPID) kurulur; abonelik `push_subscriptions` tablosuna yazılır.
   - Sunucu, bildirim tercihlerini görebilsin diye tercihler
     `network_notification_prefs` tablosuna da senkronlanır.

   Geliştirme notu: `src/main.tsx` DEV modda service worker'ı siler.
   Bu yüzden push yalnızca `npm run build && npm run preview` ile
   (veya yayındaki sitede) test edilebilir.
   ============================================================ */

import { supabase } from './supabase';

const ICON = '/icon-192.png';

export const VAPID_PUBLIC_KEY: string = (
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || ''
).trim();

const SERVER_KEY_CACHE = 'sinevia_vapid_server_key';

let cachedServerKey: string | null = null;

function readCachedServerKey(): string {
  if (cachedServerKey) return cachedServerKey;
  try {
    const stored = localStorage.getItem(SERVER_KEY_CACHE);
    if (stored) {
      cachedServerKey = stored.trim();
      return cachedServerKey;
    }
  } catch {
    /* yoksay */
  }
  return '';
}

/**
 * Abonelik anahtarı.
 *
 * Tek doğru kaynak veritabanıdır (`push_config`): sunucu push'u bu anahtarın
 * özel eşiyle imzalar. Build sırasında gömülen `VITE_VAPID_PUBLIC_KEY` yanlış
 * ya da eskiyse abonelikler sunucuyla uyuşmaz ve push servisi 400 döner.
 * Bu yüzden önce sunucudan okunur; erişilemezse build değerine düşülür.
 */
export async function resolveVapidPublicKey(): Promise<string> {
  const cached = readCachedServerKey();
  if (cached) return cached;
  try {
    const { data } = await supabase
      .from('push_config')
      .select('vapid_public_key')
      .eq('id', 1)
      .maybeSingle();
    const key = String((data as { vapid_public_key?: string } | null)?.vapid_public_key || '').trim();
    if (key) {
      cachedServerKey = key;
      try {
        localStorage.setItem(SERVER_KEY_CACHE, key);
      } catch {
        /* yoksay */
      }
      return key;
    }
  } catch {
    /* yoksay */
  }
  return VAPID_PUBLIC_KEY;
}

export type PushSupportStatus =
  | 'supported'
  | 'unsupported'
  | 'ios-install-required'
  | 'missing-key';

export type PushSetupResult =
  | { ok: true; endpoint: string }
  | {
      ok: false;
      reason: 'unsupported' | 'ios-install-required' | 'missing-key' | 'denied' | 'error';
      message: string;
    };

export type NotificationPrefs = {
  messages: boolean;
  friendRequests: boolean;
  lists: boolean;
};

/** iPhone / iPad / iPod tespiti (iPadOS masaüstü UA'sı için ek kontrol). */
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  const maxTouchPoints = (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints || 0;
  return navigator.platform === 'MacIntel' && maxTouchPoints > 1;
}

/** Ana ekrana eklenmiş (standalone) PWA mı? */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch {
    /* yoksay */
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function getPushSupportStatus(): PushSupportStatus {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported';
  if (!readCachedServerKey() && !VAPID_PUBLIC_KEY) return 'missing-key';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  // iOS 16.4+ gerekir; PushManager yoksa yukarıdaki kontrol zaten yakalar.
  if (isIosDevice() && !isStandalonePwa()) return 'ios-install-required';
  return 'supported';
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * `Notification.requestPermission()` eski ve yeni tarayıcılarda farklı
 * davranır: bir kısmı Promise döner, çok eski Safari callback bekler.
 * İkisini de destekleyen tek seferlik bir sarmalayıcı.
 */
export function requestNotificationPermission(): Promise<NotificationPermission> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      resolve('denied');
      return;
    }

    let settled = false;
    const finish = (value: NotificationPermission) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      const requestFn = Notification.requestPermission as unknown as (
        cb?: (status: NotificationPermission) => void,
      ) => Promise<NotificationPermission> | undefined;
      const maybePromise = requestFn((status) => finish(status));
      if (maybePromise && typeof (maybePromise as Promise<NotificationPermission>).then === 'function') {
        (maybePromise as Promise<NotificationPermission>)
          .then((status) => finish(status))
          .catch(() => finish(Notification.permission));
      }
    } catch {
      finish(Notification.permission);
    }
  });
}

/** VAPID public key (base64url) → Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * `navigator.serviceWorker.ready` hiç kayıtlı SW yoksa sonsuza kadar bekler
 * (ör. geliştirme modu). Bu yüzden her kullanımda zaman aşımıyla sarılır.
 */
function waitForServiceWorker(timeoutMs: number): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Service worker hazır değil. Sayfayı yenileyip tekrar dene.')),
        timeoutMs,
      ),
    ),
  ]);
}

/** Mevcut abonelik, elimizdeki VAPID anahtarıyla mı kurulmuş? */
function sameApplicationServerKey(subscription: PushSubscription, expected: Uint8Array): boolean {
  const existing = subscription.options?.applicationServerKey;
  if (!existing) return false;
  const bytes = new Uint8Array(existing as ArrayBuffer);
  if (bytes.length !== expected.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] !== expected[i]) return false;
  }
  return true;
}

/**
 * İzin ver + cihazı push aboneliğine kaydet.
 * Idempotent: abonelik zaten varsa yeniden kullanır, sunucudaki satırı tazeler.
 */
export async function ensurePushSubscription(agentId: string): Promise<PushSetupResult> {
  if (!agentId) {
    return { ok: false, reason: 'error', message: 'Bildirimler için önce Sinevia Ağı hesabına giriş yapmalısın.' };
  }

  const keyString = await resolveVapidPublicKey();
  if (!keyString) {
    return {
      ok: false,
      reason: 'missing-key',
      message: 'Bildirim altyapısı kurulmamış (VAPID anahtarı yok). Kurulum komutunu çalıştırın.',
    };
  }

  const support = getPushSupportStatus();
  if (support === 'missing-key') {
    return {
      ok: false,
      reason: 'missing-key',
      message: 'Bildirim altyapısı kurulmamış (VAPID anahtarı yok). Kurulum komutunu çalıştırın.',
    };
  }
  if (support === 'ios-install-required') {
    return {
      ok: false,
      reason: 'ios-install-required',
      message:
        'iPhone/iPad\'de bildirim için siteyi Safari\'de açıp "Ana Ekrana Ekle" ile yükle, sonra uygulamayı ana ekrandan aç.',
    };
  }
  if (support === 'unsupported') {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'Bu tarayıcı bildirimleri desteklemiyor. Chrome, Edge veya Safari (kurulu PWA) deneyin.',
    };
  }

  if (Notification.permission !== 'granted') {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      return {
        ok: false,
        reason: 'denied',
        message: 'Bildirim izni verilmedi. Tarayıcı/telefon ayarlarından Sinevia için bildirimleri açmalısın.',
      };
    }
  }

  try {
    const registration = await waitForServiceWorker(8000);
    const applicationServerKey = urlBase64ToUint8Array(keyString);
    let subscription = await registration.pushManager.getSubscription();

    // VAPID anahtarı değiştiyse eski abonelik sunucuda 403 verir; yenile.
    if (subscription && !sameApplicationServerKey(subscription, applicationServerKey)) {
      await subscription.unsubscribe().catch(() => false);
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const json = subscription.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        agent_id: agentId,
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh || '',
        auth: json.keys?.auth || '',
        user_agent: (navigator.userAgent || '').slice(0, 300),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );

    if (error) throw error;

    return { ok: true, endpoint: subscription.endpoint };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Bildirim aboneliği kurulamadı. Lütfen tekrar dene.';
    console.warn('[bildirim] abonelik kurulamadı:', err);
    return { ok: false, reason: 'error', message };
  }
}

/** Bu cihazın push aboneliğini iptal et ve sunucudaki kaydı sil. */
export async function removePushSubscription(agentId: string): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registration = await waitForServiceWorker(3000);
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe().catch(() => false);
    if (agentId) {
      await supabase.from('push_subscriptions').delete().eq('agent_id', agentId).eq('endpoint', endpoint);
    }
  } catch (err) {
    console.warn('[bildirim] abonelik kaldırılamadı:', err);
  }
}

/** Sunucudaki bildirim tercihlerini güncelle (Edge Function bunları okur). */
export async function saveNotificationPrefs(agentId: string, prefs: NotificationPrefs): Promise<void> {
  if (!agentId) return;
  try {
    const { error } = await supabase.from('network_notification_prefs').upsert(
      {
        agent_id: agentId,
        notify_messages: prefs.messages,
        notify_friend_requests: prefs.friendRequests,
        notify_lists: prefs.lists,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'agent_id' },
    );
    if (error) console.warn('[bildirim] tercihler kaydedilemedi:', error.message);
  } catch (err) {
    console.warn('[bildirim] tercihler kaydedilemedi:', err);
  }
}

/**
 * Uygulama açıkken yerel bildirim göster.
 * Önce service worker dener (mobilde tek çalışan yol), olmazsa
 * masaüstü `Notification` constructor'ına düşer.
 */
export function showAppNotification(
  title: string,
  options: { body?: string; url?: string; tag?: string } = {},
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const body = options.body || '';
  const url = options.url || '/';
  const tag = options.tag;

  const viaServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) throw new Error('service worker yok');
    const registration = await waitForServiceWorker(1500);
    await registration.showNotification(title, {
      body,
      icon: ICON,
      badge: ICON,
      tag,
      data: { url },
    });
  };

  void viaServiceWorker().catch(() => {
    try {
      // Masaüstü fallback — mobilde bu satır hata verir, bu yüzden try/catch.
      new Notification(title, { body, icon: ICON, tag });
    } catch {
      /* bildirim gösterilemedi; uygulamayı bozmamak için sessiz geç */
    }
  });
}
