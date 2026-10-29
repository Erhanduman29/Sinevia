import { createClient } from '@supabase/supabase-js';

// 1. KENDİ BAĞLANTI BİLGİLERİN
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gropqzbuuhmwrtmrdntk.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb3BxemJ1dWhtd3J0bXJkbnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTQxNjEsImV4cCI6MjEwNjc3MDE2MX0.57PLAdysepy6b0SwaEPEt3PFXqfHg5bggkHXO3Wr0T8';

// 2. GÜVENLİK İMZASI OLUŞTURUCU (Siteni koruyan yeni sistem)
function getOrCreateSecretToken(): string {
  if (typeof window === 'undefined') return '';
  let token = localStorage.getItem('sinevia_secret_token');
  if (!token) {
    token = 'sec_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
    localStorage.setItem('sinevia_secret_token', token);
  }
  return token;
}

// 3a. OKUMA ÖNBELLEĞİ (GET /rest/v1/*): "Değişiklik yoksa yeniden yükleme yok"
// - Aynı sorgu TTL içinde tekrar indirilmez (sayfa geziniminde istek atılmaz).
// - Eşzamanlı aynı sorgular tek isteğe düşer (StrictMode/çift-mount çift isteği engeller).
// - Her yazma (POST/PATCH/PUT/DELETE /rest/v1/*) önbelleği temizler → mutasyon sonrası taze veri.
type BufferedRead = { ok: boolean; status: number; body: string; contentType: string | null };
type CachedRead = { exp: number } & BufferedRead;
const READ_CACHE_TTL_MS = 15000;
const READ_CACHE_MAX_ENTRIES = 80;
const readCache = new Map<string, CachedRead>();
const inflightReads = new Map<string, Promise<BufferedRead>>();
let readCacheEpoch = 0;

function bufferedToResponse(b: BufferedRead): Response {
  return new Response(b.body, {
    status: b.status,
    headers: b.contentType ? { 'content-type': b.contentType } : undefined,
  });
}

/**
 * Aktif ağ oturumunu (hangi hesap açıksa) her istekte başlık olarak gönderir.
 * Böylece aynı cihazda birden fazla hesap olsa bile sunucu doğru hesabı bilir.
 * (networkAuth.ts ile aynı localStorage anahtarı; döngüsel import olmasın diye
 * burada doğrudan okunuyor.)
 */
function getNetworkSessionToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('sinevia_network_session');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return typeof parsed?.session_token === 'string' ? parsed.session_token : '';
  } catch {
    return '';
  }
}

/** İsteğe güncel hesap başlıklarını ekler (x-network-session). */
function withAccountHeaders(input: RequestInfo | URL, init?: RequestInit): RequestInit {
  const sessionToken = getNetworkSessionToken();
  const baseHeaders = init?.headers
    ?? (input instanceof Request ? input.headers : undefined);
  const headers = new Headers(baseHeaders);
  if (sessionToken) {
    headers.set('x-network-session', sessionToken);
  } else {
    headers.delete('x-network-session');
  }
  return { ...(init || {}), headers };
}

/** Okuma önbelleğini temizler (giriş/çıkış/hesap değişiminde). */
export function clearReadCache(): void {
  readCache.clear();
  inflightReads.clear();
  readCacheEpoch++;
}

const cachedFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const preparedInit = withAccountHeaders(input, init);
  const method = ((preparedInit.method) || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (!url.includes('/rest/v1/')) return fetch(input, preparedInit);

  // Token + oturum bilgisini cache anahtarına kat: hesap değişince eski
  // kullanıcının yanıtı yeni oturuma servis edilmesin.
  const headers = new Headers(preparedInit.headers);
  const token = headers.get('x-agent-token') || '';
  const sessionToken = headers.get('x-network-session') || '';
  const cacheKey = `${token}::${sessionToken}::${url}`;

  if (method !== 'GET') {
    // Yazma → sadece YAZILAN TABLO okumalarını geçersiz kıl (epoch, yazmayla eşzamanlı biten okumaların cache'e girmesini de engeller).
    readCacheEpoch++;
    const table = url.split('/rest/v1/')[1]?.split(/[?/]/)[0];
    if (table && table !== 'rpc') {
      const prefix = `/rest/v1/${table}?`;
      for (const key of Array.from(readCache.keys())) { if (key.includes(prefix)) readCache.delete(key); }
    } else {
      readCache.clear();
    }
    return fetch(input, preparedInit);
  }

  const hit = readCache.get(cacheKey);
  if (hit && hit.exp > Date.now()) return bufferedToResponse(hit);

  let pending = inflightReads.get(cacheKey);
  if (!pending) {
    const epoch = readCacheEpoch;
    pending = fetch(input, preparedInit).then(async (res): Promise<BufferedRead> => {
      const entry: BufferedRead = {
        ok: res.ok,
        status: res.status,
        body: await res.text(),
        contentType: res.headers.get('content-type'),
      };
      if (entry.ok && epoch === readCacheEpoch) {
        readCache.set(cacheKey, { exp: Date.now() + READ_CACHE_TTL_MS, ...entry });
        if (readCache.size > READ_CACHE_MAX_ENTRIES) {
          const oldest = readCache.keys().next().value;
          if (oldest) readCache.delete(oldest);
        }
      }
      return entry;
    }).finally(() => { inflightReads.delete(cacheKey); });
    inflightReads.set(cacheKey, pending);
  }
  // Her çağıran kendi Response nesnesini kurar (gövde tek okuma hakkı olan Response sorununu çözer).
  return bufferedToResponse(await pending);
};

// 3. SORGU KOLONLARI
// profiles.secret_token 002_security.sql ile okunamaz hale geliyor.
// Bu yüzden profil sorgularında ASLA select('*') kullanılmamalı.
export const PROFILE_PUBLIC_COLUMNS = [
  'agent_id', 'nickname', 'level', 'total_xp', 'movies_watched',
  'past_movies_watched', 'series_watched', 'episodes_watched',
  'achievements_unlocked', 'quests_completed', 'currently_watching',
  'showcase', 'last_seen',
].join(',');

export const FRIENDSHIP_COLUMNS = 'id,requester_id,receiver_id,status,created_at';

export const RECOMMENDATION_COLUMNS = 'id,sender_id,receiver_id,list_title,items,status,created_at';

export const NETWORK_LOG_COLUMNS = [
  'id', 'agent_id', 'action_type', 'item_id', 'item_type', 'item_title',
  'item_poster', 'rating', 'note', 'genres', 'review_tags', 'is_spoiler', 'created_at',
].join(',');

export const MESSAGE_COLUMNS = 'id,sender_id,receiver_id,group_id,content,created_at,is_read';

// 4. SUPABASE BAĞLANTISI (Güvenlik imzasıyla birlikte)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-agent-token': getOrCreateSecretToken(),
    },
    fetch: cachedFetch,
  },
});