export function normalize(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function ratingBgClass(rating: number): string {
  if (rating >= 10) return 'bg-gradient-to-br from-blue-500 to-blue-600 text-white';
  if (rating >= 8) return 'bg-gradient-to-br from-green-500 to-green-600 text-white';
  // Not: /100 (opaklık) eki bilinçli — index.css MOTOR v2.1 "A" kuralı
  // [class*="from-yellow"]:not([class*="/"]) ile sarıyı tema rengine çeviriyor;
  // "/" eklenince tema remap'i atlar ve puan bandı HER TEMADA gerçek sarı kalır.
  if (rating >= 5.5) return 'bg-gradient-to-br from-yellow-400/100 to-yellow-500/100 text-ink-950';
  // Turuncu bant bilinçli olarak orange-500→600: orange-400 sarımsı duruyordu
  // (kullanıcı "4 puan sarı görünüyordu" şikâyeti), 500-600 net turuncu.
  if (rating >= 3.5) return 'bg-gradient-to-br from-orange-500 to-orange-600 text-white';
  if (rating >= 1) return 'bg-gradient-to-br from-red-500 to-red-600 text-white';
  return 'bg-ink-600 text-white';
}

export function ratingBorderClass(rating: number): string {
  if (rating >= 10) return 'border-blue-500';
  if (rating >= 8) return 'border-green-500';
  if (rating >= 5.5) return 'border-yellow-400';
  if (rating >= 3.5) return 'border-orange-400';
  if (rating >= 1) return 'border-red-500';
  return 'border-ink-600';
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(d1: string, d2: string): number {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
}

export function getNextUnwatchedEpisode<T extends { watched: boolean; season: number; episode: number }>(episodes: T[]): T | null {
  const sorted = [...episodes].sort((a, b) => a.season - b.season || a.episode - b.episode);
  return sorted.find((e) => !e.watched) || null;
}

// ============================================================================
// AĞ YARDIMCILARI — çevrimdışı dayanıklılık için (Aşama 3)
// ============================================================================

/** Basit üstel geri çekilme (exponential backoff) ile yeniden deneme sarmalayıcısı. */
export async function withRetry<T>(fn: () => PromiseLike<T>, attempts = 3, baseMs = 400): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

export interface QueuedLogOp {
  id: string;
  kind: 'insert';
  row: Record<string, unknown>;
  createdAt: number;
}

const LOG_QUEUE_KEY = 'sinevia.networkLogQueue.v1';

/** Bekleyen (çevrimdışı) network_logs satırlarını oku. localStorage küçük veriler için yeterli. */
export function readLogQueue(): QueuedLogOp[] {
  try {
    const raw = localStorage.getItem(LOG_QUEUE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Kuyruğa bir gönderim opsiyonu ekle (idempotent: aynı id tekrar eklenmez). */
export function enqueueLogOp(op: QueuedLogOp): QueuedLogOp[] {
  const q = readLogQueue();
  if (!q.some((x) => x.id === op.id)) q.push(op);
  try { localStorage.setItem(LOG_QUEUE_KEY, JSON.stringify(q)); } catch { /* kota */ }
  return q;
}

/** Bir gönderim başarılı olunca kuyruktan çıkar. */
export function dequeueLogOp(id: string): QueuedLogOp[] {
  const q = readLogQueue().filter((x) => x.id !== id);
  try { localStorage.setItem(LOG_QUEUE_KEY, JSON.stringify(q)); } catch { /* kota */ }
  return q;
}
