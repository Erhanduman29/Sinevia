import type { XpEvent, XpEventSource, XpLedgerSummary } from '../types/appState';

/* =========================================================================
   XP DEFTERİ (LEDGER) — SAF FONKSİYONLAR
   -------------------------------------------------------------------------
   XP'nin TEK doğrusu bu defterdir:

       totalXp = Σ xpEvents[i].amount

   Kurallar (docs/sync-contract.md §2):
   1. APPEND-ONLY: kayıt silinmez/düzenlenmez. Düzeltme negatif `adjustment`
      kaydıdır.
   2. TEK DOĞRU: başarım listesi, görev listesi, `bonusXp`, `xpBaseline`,
      bulut `total_xp` gibi hiçbir alan XP'yi ayrıca beslemez.
   3. İDEMPOTENCY: aynı `(source, sourceId)` çiftinden ikinci kayıt YAZILMAZ.
   4. `amount = Math.round(base * multiplier)`; `base` negatif olabilir,
      `multiplier` varsayılan 1.

   Bu modül React/storage/ağ kullanmaz. Yalnız `createdAt` verilmezse
   `new Date()` okunur (testlerde enjekte edilebilir), bu dışında yan etkisi
   yoktur.
   ========================================================================= */

/** Defterdeki tüm kaynaklar — özet tablosunu deterministik başlatmak için. */
export const XP_EVENT_SOURCES: readonly XpEventSource[] = [
  'achievement',
  'quest',
  'contract',
  'market',
  'system',
  'legacy',
  'legacy-cloud',
  'adjustment',
] as const;

/** Kaynak başına insan okur etiket (toast / geçmiş listesi). */
export const XP_SOURCE_LABELS: Record<XpEventSource, string> = {
  achievement: 'Başarım',
  quest: 'Görev',
  contract: 'Pazar Görevi',
  market: 'Pazar',
  system: 'Sistem',
  legacy: 'Devralınan XP',
  'legacy-cloud': 'Bulut XP',
  adjustment: 'Düzeltme',
};

/**
 * V2 → V3 göç kayıtlarının sabit `sourceId` değeri.
 * Aynı hesapta göç yalnız BİR kez yazılır (`(source, migration-v3)` anahtarı).
 */
export const LEGACY_MIGRATION_ID = 'migration-v3';

function finiteNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function nonNegative(value: unknown): number {
  return Math.max(0, finiteNumber(value));
}

function isValidEvent(value: unknown): value is XpEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<XpEvent>;
  return (
    typeof event.source === 'string'
    && (XP_EVENT_SOURCES as readonly string[]).includes(event.source)
    && typeof event.sourceId === 'string'
  );
}

/** Gelen bilinmeyen diziyi geçerli defter kayıtlarına indirger. */
export function normalizeXpEvents(raw: unknown): XpEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidEvent).map((event) => ({
    id: typeof event.id === 'string' && event.id ? event.id : `xp:${event.source}:${event.sourceId}`,
    source: event.source,
    sourceId: event.sourceId,
    label: typeof event.label === 'string' ? event.label : String(event.sourceId),
    base: finiteNumber(event.base),
    multiplier: Number.isFinite(Number(event.multiplier)) ? Number(event.multiplier) : 1,
    amount: Number.isFinite(Number(event.amount))
      ? Number(event.amount)
      : Math.round(finiteNumber(event.base) * Number(event.multiplier || 1)),
    createdAt: typeof event.createdAt === 'string' ? event.createdAt : '',
    ...(event.meta && typeof event.meta === 'object' ? { meta: event.meta } : {}),
  }));
}

/** İdempotency anahtarı: `source:sourceId`. */
export function xpEventKey(event: Pick<XpEvent, 'source' | 'sourceId'>): string {
  return `${event.source}:${event.sourceId}`;
}

/** Aynı `(source, sourceId)` zaten defterde mi? */
export function hasXpEvent(
  events: readonly XpEvent[] | null | undefined,
  source: XpEventSource,
  sourceId: string,
): boolean {
  if (!Array.isArray(events)) return false;
  return events.some((event) => event?.source === source && event?.sourceId === sourceId);
}

/** Defter toplamı: tek XP doğrusu. Boş/bozuk defter 0 döner. */
export function sumXpEvents(events: readonly XpEvent[] | null | undefined): number {
  if (!Array.isArray(events)) return 0;
  return events.reduce((sum, event) => sum + finiteNumber(event?.amount), 0);
}

/** Defterin türetilmiş özeti (asla kalıcı yazılmaz, her zaman yeniden hesaplanır). */
export function summarizeXpLedger(events: readonly XpEvent[] | null | undefined): XpLedgerSummary {
  const list: XpEvent[] = Array.isArray(events) ? (events as XpEvent[]) : [];
  const bySource = {} as Record<XpEventSource, number>;
  for (const source of XP_EVENT_SOURCES) bySource[source] = 0;

  let totalXp = 0;
  for (const event of list) {
    const amount = finiteNumber(event?.amount);
    totalXp += amount;
    if (event?.source && event.source in bySource) bySource[event.source] += amount;
  }
  return { totalXp, count: list.length, bySource };
}

export interface XpEventInput {
  source: XpEventSource;
  sourceId: string;
  /** İnsan okur etiket. Verilmezse sourceId kullanılır. */
  label?: string;
  /** Çarpan uygulanmadan önceki taban XP. Negatif olabilir (düzeltme). */
  base: number;
  /** Etkinlik çarpanı; varsayılan 1. */
  multiplier?: number;
  /** ISO 8601; verilmezse şimdi. */
  createdAt?: string;
  meta?: Record<string, unknown>;
}

/**
 * Tek bir defter kaydı üretir.
 * `id` deterministiktir (`xp:<source>:<sourceId>`): aynı hareket iki kez
 * üretilirse aynı kimliği taşır — idempotency anahtarı yine `(source, sourceId)`.
 */
export function makeXpEvent(input: XpEventInput): XpEvent {
  const base = finiteNumber(input.base);
  const multiplier = Number.isFinite(Number(input.multiplier)) ? Number(input.multiplier) : 1;
  const amount = Math.round(base * multiplier);
  return {
    id: `xp:${input.source}:${input.sourceId}`,
    source: input.source,
    sourceId: input.sourceId,
    label: input.label && input.label.trim() ? input.label : input.sourceId,
    base,
    multiplier,
    amount,
    createdAt: input.createdAt || new Date().toISOString(),
    ...(input.meta ? { meta: input.meta } : {}),
  };
}

export interface AppendXpEventResult {
  /** Yeni defter (değişiklik yoksa giriş dizisi AYNEN döner). */
  events: XpEvent[];
  /** Kayıt gerçekten eklendi mi? Aynı `(source, sourceId)` varsa false. */
  added: boolean;
}

/**
 * İdempotent ekleme: aynı `(source, sourceId)` ikinci kez eklenmez.
 * Giriş dizisi mutasyona uğratılmaz.
 */
export function appendXpEvent(
  events: readonly XpEvent[] | null | undefined,
  event: XpEvent,
): AppendXpEventResult {
  const current = Array.isArray(events) ? events : [];
  if (!isValidEvent(event)) return { events: current as XpEvent[], added: false };
  if (hasXpEvent(current, event.source, event.sourceId)) {
    return { events: current as XpEvent[], added: false };
  }
  return { events: [...current, event], added: true };
}

/**
 * İki defteri `(source, sourceId)` ile birleştirir.
 * Çakışan anahtarda `primary` kopyası korunur (senkron sözleşmesinde bulut
 * kopyası kazanır; çağıran bulutu primary verir).
 */
export function mergeXpLedgers(
  primary: readonly XpEvent[] | null | undefined,
  secondary: readonly XpEvent[] | null | undefined,
): XpEvent[] {
  const merged = normalizeXpEvents(primary);
  for (const event of normalizeXpEvents(secondary)) {
    if (!hasXpEvent(merged, event.source, event.sourceId)) merged.push(event);
  }
  return merged;
}

export interface LegacyXpMigrationInput {
  /** Mevcut defter (V3 kaydından). V2 kayıtlarında yoktur. */
  events?: readonly XpEvent[] | null;
  /** V2 yerel toplam XP (`totalXp`). */
  localTotalXp?: number;
  /** Bulut arşivinden gelen toplam XP (`total_xp`). */
  cloudTotalXp?: number;
  /**
   * V2 türetilmiş alanları. Eski kayıtta `totalXp` zaten bunları içerdiği
   * için YALNIZ `totalXp` yoksa (0 ise) taban olarak kullanılır — çift sayım
   * olmaz.
   */
  bonusXp?: number;
  xpBaseline?: number;
  /** Açıkça bilinen hedef toplam; kalan fark `adjustment` kaydına yazılır. */
  targetTotalXp?: number;
  /** Göç kayıtlarının zaman damgası (testlerde sabitlenebilir). */
  createdAt?: string;
}

/**
 * V2 kayıtlarını V3 defterine göç ettirir:
 *   1. yerel toplam eksiği → `legacy` / `migration-v3`
 *   2. bulut toplamı yerelden büyükse fark → `legacy-cloud` / `migration-v3`
 *   3. hedef toplam hâlâ tutmuyorsa fark → `adjustment` / `migration-v3`
 *
 * İDEMPOTENT: her adım `hasXpEvent` ile korunur; ikinci çağrı deftere dokunmaz.
 * Eski 1855 XP gibi değerler aynen korunur (kaynak listesi yeniden toplanmaz).
 */
export function migrateLegacyXp(input: LegacyXpMigrationInput = {}): XpEvent[] {
  const createdAt = input.createdAt || new Date().toISOString();
  let events = normalizeXpEvents(input.events);

  // Eski kayıtta totalXp varsa otorite odur; yoksa bonus+taban (tek seferlik).
  const declaredLocal = Math.max(
    nonNegative(input.localTotalXp),
    nonNegative(input.bonusXp) + nonNegative(input.xpBaseline),
  );

  if (declaredLocal > sumXpEvents(events) && !hasXpEvent(events, 'legacy', LEGACY_MIGRATION_ID)) {
    events = appendXpEvent(events, makeXpEvent({
      source: 'legacy',
      sourceId: LEGACY_MIGRATION_ID,
      label: 'Devralınan XP (yerel kayıt)',
      base: declaredLocal - sumXpEvents(events),
      multiplier: 1,
      createdAt,
    })).events;
  }

  const cloudTotal = nonNegative(input.cloudTotalXp);
  if (cloudTotal > sumXpEvents(events) && !hasXpEvent(events, 'legacy-cloud', LEGACY_MIGRATION_ID)) {
    events = appendXpEvent(events, makeXpEvent({
      source: 'legacy-cloud',
      sourceId: LEGACY_MIGRATION_ID,
      label: 'Devralınan XP (bulut yedeği)',
      base: cloudTotal - sumXpEvents(events),
      multiplier: 1,
      createdAt,
    })).events;
  }

  const target = Number.isFinite(Number(input.targetTotalXp)) ? Number(input.targetTotalXp) : undefined;
  if (
    target !== undefined
    && !hasXpEvent(events, 'adjustment', LEGACY_MIGRATION_ID)
    && target !== sumXpEvents(events)
  ) {
    events = appendXpEvent(events, makeXpEvent({
      source: 'adjustment',
      sourceId: LEGACY_MIGRATION_ID,
      label: 'XP dengesi düzeltmesi',
      base: target - sumXpEvents(events),
      multiplier: 1,
      createdAt,
    })).events;
  }

  return events;
}
