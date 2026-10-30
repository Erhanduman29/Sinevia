// @ts-nocheck
// NOT: Bu dosya tarayıcıda değil, Supabase'in sunucusunda (Deno) çalışır.
// Editörde "Deno bulunamadı" veya "npm:... bulunamadı" gibi kırmızı uyarılar
// görünür; bunlar gerçek hata DEĞİLDİR. Tarayıcı projesinin TypeScript
// ayarları Deno ortamını tanımadığı için çıkar. Uygulama derlemesi bu dosyayı
// hiç okumaz (tsconfig yalnızca `src` klasörünü kontrol eder).
//
// ============================================================
// SINEVIA — PUSH GÖNDERİCİ (Supabase Edge Function)
// ============================================================
// Veritabanındaki INSERT tetikleyicisi (006_web_push.sql) bu fonksiyonu
// `x-webhook-secret` başlığıyla çağırır. Fonksiyon:
//   1) İsteğin gerçekten bizim veritabanımızdan geldiğini doğrular,
//   2) Alıcının bildirim tercihlerine bakar (kapalıysa hiç göndermez),
//   3) Alıcının tüm cihaz aboneliklerine Web Push gönderir,
//   4) Süresi geçmiş (404/410) abonelikleri temizler.
//
// Deploy: `supabase functions deploy send-push --no-verify-jwt`
// (JWT yerine webhook secret kullanılıyor; DB webhook JWT taşımaz.)
//
// Gerekli secret'lar:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY otomatik gelir.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

type WebhookRecord = {
  id?: string;
  receiver_id?: string | null;
  sender_id?: string | null;
  requester_id?: string | null;
  content?: string | null;
  list_title?: string | null;
  status?: string | null;
};

function truncate(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:destek@sinevia.app';

  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'server_misconfigured' }, 500);
  if (!vapidPublicKey || !vapidPrivateKey) return json({ error: 'vapid_missing' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- 1) Webhook doğrulaması -------------------------------------------
  const { data: config } = await admin
    .from('push_webhook_config')
    .select('secret')
    .eq('id', true)
    .maybeSingle();

  const providedSecret = req.headers.get('x-webhook-secret') || '';
  if (!config?.secret || providedSecret !== config.secret) {
    return json({ error: 'unauthorized' }, 401);
  }

  // --- 2) Gelen olayı çöz -----------------------------------------------
  let payload: { table?: string; record?: WebhookRecord } | null = null;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const table = payload?.table || '';
  const record = payload?.record || {};
  const receiverId = record.receiver_id;
  // Ayarlar > "Test Bildirimi" bu türle gelir: tercih kontrolü yapılmaz,
  // böylece kullanıcı zincirin tamamını (pg_net -> function -> cihaz) test eder.
  const isSelfTest = table === 'self_test';

  if (!table || !receiverId) return json({ skipped: 'no_receiver' });

  if (!isSelfTest) {
    const { data: prefs } = await admin
      .from('network_notification_prefs')
      .select('notify_messages, notify_friend_requests, notify_lists')
      .eq('agent_id', receiverId)
      .maybeSingle();

    const allowed =
      table === 'messages'
        ? prefs?.notify_messages !== false
        : table === 'friendships'
          ? prefs?.notify_friend_requests !== false
          : table === 'recommendations'
            ? prefs?.notify_lists !== false
            : false;

    if (!allowed) return json({ skipped: 'preference_off' });
  }

  // --- 3) Bildirim metnini hazırla --------------------------------------
  const senderId = record.sender_id || record.requester_id || null;
  let senderName = 'Bir Sinevia üyesi';
  if (senderId && !isSelfTest) {
    const { data: sender } = await admin
      .from('profiles')
      .select('nickname')
      .eq('agent_id', senderId)
      .maybeSingle();
    if (sender?.nickname) senderName = String(sender.nickname);
  }

  let message: PushPayload;
  if (isSelfTest) {
    message = {
      title: 'Sinevia - Test Bildirimi',
      body: 'Bildirimler çalışıyor. Bu bildirimi görüyorsan hazırsın!',
      url: '/#settings',
      tag: 'sinevia-test',
    };
  } else if (table === 'messages') {
    message = {
      title: 'Sinevia - Yeni Mesaj 💬',
      body: `${senderName}: ${truncate(String(record.content || 'Yeni bir mesajın var.'), 90)}`,
      url: '/#network',
      tag: 'sinevia-messages',
    };
  } else if (table === 'friendships') {
    message = {
      title: 'Sinevia - Yeni Bağlantı 👤',
      body: `${senderName} sana arkadaşlık isteği gönderdi.`,
      url: '/#network',
      tag: 'sinevia-friendships',
    };
  } else {
    const listTitle = record.list_title ? `: "${truncate(String(record.list_title), 60)}"` : '.';
    message = {
      title: 'Sinevia - Yeni Liste 🎁',
      body: `${senderName} sana bir tavsiye listesi gönderdi${listTitle}`,
      url: '/#network',
      tag: 'sinevia-lists',
    };
  }

  // --- 4) Aboneliklere gönder -------------------------------------------
  const { data: subscriptions, error: subscriptionsError } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('agent_id', receiverId);

  if (subscriptionsError) {
    console.error('[send-push] abonelikler okunamadı:', subscriptionsError.message);
    return json({ error: 'subscriptions_query_failed' }, 500);
  }

  if (!subscriptions || subscriptions.length === 0) return json({ sent: 0, reason: 'no_devices', vapidPublicKey });

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const staleEndpoints: string[] = [];
  const failures: Array<{ statusCode?: number; message?: string; body?: string; endpointHost?: string }> = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(message),
          { TTL: 3600, urgency: 'high' },
        );
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(subscription.endpoint);
        } else {
          failed += 1;
          // Uç nokta adresini gizle, yalnızca teşhis için sebebi sakla.
          failures.push({
            statusCode,
            message: String((err as Error)?.message || '')
              .replace(/https?:\/\/\S+/g, '[endpoint]')
              .slice(0, 180),
            // Push servisinin (FCM/APNs) gerçek cevabı; 400'ün nedenini gösterir.
            body: String((err as { body?: unknown })?.body || '')
              .replace(/https?:\/\/\S+/g, '[endpoint]')
              .slice(0, 220),
            endpointHost: (() => {
              try {
                return new URL(subscription.endpoint).host;
              } catch {
                return 'unknown';
              }
            })(),
          });
          console.error('[send-push] gönderim hatası:', statusCode, (err as Error)?.message);
        }
      }
    }),
  );

  if (staleEndpoints.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
  }

  return json({ sent, failed, removed: staleEndpoints.length, errors: failures, vapidPublicKey });
});
