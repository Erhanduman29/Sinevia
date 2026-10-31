import React, { useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import type { XpEvent, XpEventSource } from '../types/appState';

/* =========================================================================
   XP DEFTERİ SEKMESİ
   -------------------------------------------------------------------------
   SADECE SUNUM: defter APPEND-ONLY'dir, burada hiçbir kayıt yazılmaz/silinmez.
   XP kuralı tek doğrudur → totalXp = Σ events.amount (docs/sync-contract.md).
   Bu bileşen hesap yapmaz; mutabakat kutusu yalnızca farkı GÖSTERİR.
   ========================================================================= */

/** Kaynak filtreleri için gruplanmış defter kaynakları. */
export type XpSourceGroupId =
  | 'achievement'
  | 'quest'
  | 'market'
  | 'system'
  | 'legacy'
  | 'adjustment';

export interface XpSourceGroupDef {
  id: XpSourceGroupId;
  label: string;
  /** Bu gruba düşen ham defter kaynakları. */
  sources: readonly XpEventSource[];
  /** Grup vurgu rengi (rozet/şerit). */
  accent: string;
}

/**
 * Grup sırası üründür: başarımlar → görevler → pazar/kontrat → sistem →
 * eski kayıt → düzeltme. Pazar ve kontrat tek satırda birleşir.
 */
export const XP_SOURCE_GROUPS: readonly XpSourceGroupDef[] = [
  { id: 'achievement', label: 'Başarımlar', sources: ['achievement'], accent: '#FFC800' },
  { id: 'quest', label: 'Görevler', sources: ['quest'], accent: '#a78bfa' },
  { id: 'market', label: 'Pazar / Kontrat', sources: ['market', 'contract'], accent: '#38bdf8' },
  { id: 'system', label: 'Sistem', sources: ['system'], accent: '#34d399' },
  { id: 'legacy', label: 'Eski Kayıt', sources: ['legacy', 'legacy-cloud'], accent: '#a1a1aa' },
  { id: 'adjustment', label: 'Düzeltme', sources: ['adjustment'], accent: '#fb7185' },
] as const;

const GROUP_BY_SOURCE = new Map<XpEventSource, XpSourceGroupDef>(
  XP_SOURCE_GROUPS.flatMap((group) => group.sources.map((source) => [source, group] as const))
);

/** Ham kaynaktan görünen grup tanımını çözer; bilinmeyen kaynak Düzeltme'ye düşer. */
export function resolveXpSourceGroup(source: XpEventSource | string | undefined): XpSourceGroupDef {
  const group = GROUP_BY_SOURCE.get(source as XpEventSource);
  return group ?? XP_SOURCE_GROUPS[XP_SOURCE_GROUPS.length - 1];
}

/* ------------------------------------------------------------------ */
/* SAF YARDIMCILAR (test edilebilir — React gerektirmez)              */
/* ------------------------------------------------------------------ */

export type XpRangeFilter = 'all' | '7' | '30';

export interface XpLedgerFilter {
  /** 'all' veya grup kimliği. */
  group?: XpSourceGroupId | 'all';
  /** Zaman aralığı: tümü / son 7 gün / son 30 gün. */
  range?: XpRangeFilter;
  /** Etiket + sourceId + kaynak adı üzerinde arama. */
  search?: string;
}

export interface XpLedgerRow {
  event: XpEvent;
  group: XpSourceGroupDef;
  /** ISO zaman damgasının ms karşılığı; geçersizse NaN. */
  time: number;
}

export interface XpLedgerReconciliation {
  /** Σ events.amount */
  ledgerSum: number;
  /** Uygulamanın gösterdiği toplam XP. */
  totalXp: number;
  /** ledgerSum − totalXp (pozitif: defter fazla, negatif: defter eksik). */
  difference: number;
  matches: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function safeAmount(event: XpEvent): number {
  return Number.isFinite(event?.amount) ? Number(event.amount) : 0;
}

function eventTime(event: XpEvent): number {
  const t = new Date(event?.createdAt ?? '').getTime();
  return Number.isFinite(t) ? t : Number.NaN;
}

/** Defter toplamı — tek XP doğrusu: Σ amount (geçersiz amount 0 sayılır). */
export function sumEventAmounts(events: readonly XpEvent[]): number {
  let total = 0;
  for (const event of events) total += safeAmount(event);
  return total;
}

/** Mutabakat: defter toplamı ile uygulama toplamı eşit mi? */
export function reconcileXpLedger(
  events: readonly XpEvent[],
  totalXp: number
): XpLedgerReconciliation {
  const ledgerSum = sumEventAmounts(events);
  const safeTotal = Number.isFinite(totalXp) ? Number(totalXp) : 0;
  const difference = ledgerSum - safeTotal;
  return { ledgerSum, totalXp: safeTotal, difference, matches: difference === 0 };
}

/** Son N gün içindeki net XP (sınır dahil: now − N gün ≤ t ≤ now). */
export function sumXpInLastDays(events: readonly XpEvent[], days: number, now: number = Date.now()): number {
  if (!Number.isFinite(days) || days <= 0) return 0;
  const from = now - days * DAY_MS;
  let total = 0;
  for (const event of events) {
    const t = eventTime(event);
    if (Number.isFinite(t) && t >= from && t <= now) total += safeAmount(event);
  }
  return total;
}

/** Kayıtları en yeniden eskiye sıralı satırlara çevirir (bozuk tarih en sonda). */
export function buildXpLedgerRows(events: readonly XpEvent[]): XpLedgerRow[] {
  return events
    .map((event) => ({ event, group: resolveXpSourceGroup(event?.source), time: eventTime(event) }))
    .sort((a, b) => {
      const aValid = Number.isFinite(a.time);
      const bValid = Number.isFinite(b.time);
      if (aValid && bValid && a.time !== b.time) return b.time - a.time;
      if (aValid !== bValid) return aValid ? -1 : 1;
      return 0;
    });
}

/** Kaynak + aralık + arama filtresi. */
export function filterXpEvents(
  events: readonly XpEvent[],
  filter: XpLedgerFilter = {},
  now: number = Date.now()
): XpEvent[] {
  const group = filter.group ?? 'all';
  const range = filter.range ?? 'all';
  const query = (filter.search ?? '').trim().toLocaleLowerCase('tr-TR');
  const from = range === 'all' ? Number.NEGATIVE_INFINITY : now - Number(range) * DAY_MS;

  return events.filter((event) => {
    if (!event) return false;
    if (group !== 'all' && resolveXpSourceGroup(event.source).id !== group) return false;

    if (range !== 'all') {
      const t = eventTime(event);
      if (!Number.isFinite(t) || t < from || t > now) return false;
    }

    if (query) {
      const haystack = [event.label, event.sourceId, event.source]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR');
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

/** Satırları grup sırasına göre böler; boş gruplar atlanır. */
export function groupXpLedgerRows(
  rows: readonly XpLedgerRow[]
): { group: XpSourceGroupDef; rows: XpLedgerRow[]; total: number; count: number }[] {
  const buckets = new Map<XpSourceGroupId, XpLedgerRow[]>();
  for (const row of rows) {
    const list = buckets.get(row.group.id);
    if (list) list.push(row);
    else buckets.set(row.group.id, [row]);
  }

  const result: { group: XpSourceGroupDef; rows: XpLedgerRow[]; total: number; count: number }[] = [];
  for (const group of XP_SOURCE_GROUPS) {
    const list = buckets.get(group.id);
    if (!list || list.length === 0) continue;
    result.push({
      group,
      rows: list,
      count: list.length,
      total: list.reduce((sum, row) => sum + safeAmount(row.event), 0),
    });
  }
  return result;
}

/**
 * Grup listesini toplam `limit` satıra indirger; grup başlığındaki toplam ve
 * sayaç TAM gruba aittir (görünen dilim başlığı yanıltmaz).
 */
export function limitGroupedXpRows(
  groups: ReturnType<typeof groupXpLedgerRows>,
  limit: number
): ReturnType<typeof groupXpLedgerRows> {
  let remaining = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  const limited: ReturnType<typeof groupXpLedgerRows> = [];
  for (const entry of groups) {
    if (remaining <= 0) break;
    const rows = entry.rows.slice(0, remaining);
    limited.push({ ...entry, rows });
    remaining -= rows.length;
  }
  return limited;
}

/** Sayı biçimi — tr-TR binlik ayraçlı, işaretsiz. */
export function formatXpNumber(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}

/** İşaretli XP: +120 / -45. */
export function formatXpAmount(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${safe > 0 ? '+' : ''}${formatXpNumber(safe)}`;
}

/** `base × multiplier = amount` metni. */
export function formatXpFormula(event: Pick<XpEvent, 'base' | 'multiplier' | 'amount'>): string {
  const base = Number.isFinite(event?.base) ? Number(event.base) : 0;
  const multiplier = Number.isFinite(event?.multiplier) && Number(event.multiplier) > 0
    ? Number(event.multiplier)
    : 1;
  const amount = Number.isFinite(event?.amount) ? Number(event.amount) : 0;
  const multiplierText = multiplier.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  return `${formatXpNumber(base)} × ${multiplierText} = ${formatXpNumber(amount)}`;
}

/** Defter satırı tarihi: gün + kısa ay + yıl + saat. */
export function formatXpDate(iso: string | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '—';
  }
}

/* ------------------------------------------------------------------ */
/* GÖRÜNÜM                                                            */
/* ------------------------------------------------------------------ */

const RANGE_OPTIONS: { id: XpRangeFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: '7', label: 'Son 7 gün' },
  { id: '30', label: 'Son 30 gün' },
];

/** İlk açılışta çizilen satır sayısı; "Daha fazla" ile çoğaltılır. */
const PAGE_SIZE = 60;

export interface XpLedgerTabProps {
  events: XpEvent[];
  totalXp: number;
  level: number;
  loading?: boolean;
}

export default function XpLedgerTab({ events, totalXp, level, loading = false }: XpLedgerTabProps) {
  const [group, setGroup] = useState<XpSourceGroupId | 'all'>('all');
  const [range, setRange] = useState<XpRangeFilter>('all');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const safeEvents = useMemo(
    () => (Array.isArray(events) ? events.filter((event) => !!event) : []),
    [events]
  );

  const reconciliation = useMemo(
    () => reconcileXpLedger(safeEvents, totalXp),
    [safeEvents, totalXp]
  );

  const last7 = useMemo(() => sumXpInLastDays(safeEvents, 7), [safeEvents]);
  const last30 = useMemo(() => sumXpInLastDays(safeEvents, 30), [safeEvents]);

  // Not: now her filtre değişiminde sabit kalsın diye useMemo bağımlılıkları
  // arasına alınmadı; aralık sınırı kullanıcı etkileşiminde yeniden hesaplanır.
  const rows = useMemo(() => {
    const filtered = filterXpEvents(safeEvents, { group, range, search });
    return buildXpLedgerRows(filtered);
  }, [safeEvents, group, range, search]);

  const grouped = useMemo(() => groupXpLedgerRows(rows), [rows]);
  const visibleRows = rows.slice(0, visibleCount);
  // Görünür dilim grup sınırlarını kesebilir; başlık sayaçları tam gruptan gelir.
  const visibleGrouped = useMemo(
    () => limitGroupedXpRows(grouped, visibleCount),
    [grouped, visibleCount]
  );

  const hasAnyEvent = safeEvents.length > 0;
  const hasFilter = group !== 'all' || range !== 'all' || search.trim().length > 0;

  const resetFilters = () => {
    setGroup('all');
    setRange('all');
    setSearch('');
    setVisibleCount(PAGE_SIZE);
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in" aria-busy="true" aria-live="polite">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="h-[76px] rounded-xl border border-[#22222C] bg-[#0D0D12] animate-pulse" />
          ))}
        </div>
        <div className="h-10 rounded-xl border border-[#22222C] bg-[#0D0D12] animate-pulse" />
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((key) => (
            <div key={key} className="h-14 rounded-xl border border-[#22222C] bg-[#0D0D12] animate-pulse" />
          ))}
        </div>
        <span className="sr-only">XP defteri yükleniyor</span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 sm:space-y-4 animate-fade-in-up">
      {/* ÜST KARTLAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <SummaryCard
          icon={<Icons.Zap size={14} />}
          label="Toplam XP"
          value={`${formatXpNumber(totalXp)} XP`}
          accent="#FFC800"
        />
        <SummaryCard
          icon={<Icons.Crown size={14} />}
          label="Seviye"
          value={String(level)}
          accent="#a78bfa"
        />
        <SummaryCard
          icon={<Icons.CalendarDays size={14} />}
          label="Son 7 gün"
          value={formatXpAmount(last7)}
          accent="#34d399"
          signed
        />
        <SummaryCard
          icon={<Icons.CalendarRange size={14} />}
          label="Son 30 gün"
          value={formatXpAmount(last30)}
          accent="#38bdf8"
          signed
        />
      </div>

      {/* MUTABAKAT KUTUSU */}
      <div
        role="status"
        aria-live="polite"
        className={`rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 text-[11px] sm:text-xs leading-relaxed ${
          reconciliation.matches
            ? 'border-[#1E3A2C] bg-[#0C1712] text-ink-300'
            : 'border-rose-700/60 bg-[#1A0B10] text-rose-100'
        }`}
      >
        {reconciliation.matches ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
            <span className="flex items-center gap-1.5 font-bold text-emerald-300">
              <Icons.ShieldCheck size={14} className="shrink-0" />
              Defter tutarlı
            </span>
            <span className="text-ink-400 font-mono">
              Σ kayıt = {formatXpNumber(reconciliation.ledgerSum)} XP · Toplam = {formatXpNumber(reconciliation.totalXp)} XP
            </span>
          </div>
        ) : (
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 font-black text-rose-300">
              <Icons.AlertTriangle size={14} className="shrink-0" />
              Mutabakat farkı: {formatXpAmount(reconciliation.difference)} XP
            </span>
            <p className="text-rose-200/80">
              Defter toplamı ({formatXpNumber(reconciliation.ledgerSum)} XP) ile gösterilen toplam XP (
              {formatXpNumber(reconciliation.totalXp)} XP) eşleşmiyor. XP yalnız defterden hesaplanır;
              fark bir düzeltme (<strong>adjustment</strong>) kaydıyla kapatılmalıdır.
            </p>
          </div>
        )}
      </div>

      {/* FİLTRE ÇUBUĞU */}
      <div className="rounded-xl border border-[#22222C] bg-[#0D0D12] p-2 sm:p-2.5 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Icons.Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Etiket, kaynak veya kayıt kimliği ara..."
              aria-label="XP kayıtlarında ara"
              className="w-full pl-9 pr-9 py-1.5 sm:py-2 rounded-lg bg-[#09090D] border border-[#242430] text-xs sm:text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-[#3A3A4E]"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setVisibleCount(PAGE_SIZE);
                }}
                aria-label="Aramayı temizle"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-ink-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Icons.X size={14} />
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Zaman aralığı"
            className="grid grid-cols-3 rounded-lg border border-[#22222C] bg-[#09090D] p-0.5"
          >
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setRange(option.id);
                  setVisibleCount(PAGE_SIZE);
                }}
                aria-pressed={range === option.id}
                aria-label={`Zaman aralığı: ${option.label}`}
                className={`px-2 py-1.5 rounded-md text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all ${
                  range === option.id
                    ? 'bg-[#22222E] text-white border border-[#3A3A4E]'
                    : 'text-ink-400 hover:text-ink-200 border border-transparent'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-0.5" role="group" aria-label="XP kaynağı">
          <SourceChip
            active={group === 'all'}
            label="Tümü"
            count={safeEvents.length}
            accent="#e4e4e7"
            onClick={() => {
              setGroup('all');
              setVisibleCount(PAGE_SIZE);
            }}
          />
          {XP_SOURCE_GROUPS.map((def) => {
            const count = safeEvents.filter((event) => resolveXpSourceGroup(event.source).id === def.id).length;
            if (count === 0) return null;
            return (
              <SourceChip
                key={def.id}
                active={group === def.id}
                label={def.label}
                count={count}
                accent={def.accent}
                onClick={() => {
                  setGroup(def.id);
                  setVisibleCount(PAGE_SIZE);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* LİSTE */}
      {!hasAnyEvent ? (
        <EmptyState
          icon={<Icons.Sparkles size={22} />}
          title="Henüz XP kazanılmadı"
          description="İlk başarımı açtığında ya da bir görevi tamamladığında XP defteri burada oluşmaya başlar."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Icons.SearchX size={22} />}
          title="Bu filtreye uyan kayıt yok"
          description="Arama terimini değiştir veya filtreleri sıfırla."
          action={
            hasFilter ? (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-[#2D2D3F] bg-[#181824] text-ink-200 hover:text-white hover:border-[#3A3A4E] transition-colors"
              >
                <Icons.RotateCcw size={12} /> Filtreleri sıfırla
              </button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          {visibleGrouped.map(({ group: def, rows: groupRows, total, count }) => (
            <section
              key={def.id}
              aria-label={`${def.label} kayıtları`}
              className="rounded-xl border border-[#22222C] bg-[#0D0D12] overflow-hidden"
            >
              <header
                className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-[#1C1C26]"
                style={{ background: `linear-gradient(90deg, ${def.accent}14, transparent 70%)` }}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: def.accent }} />
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-ink-100 truncate">
                    {def.label}
                  </span>
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold bg-black/40 border border-[#2D2D3F] text-ink-300">
                    {count}
                  </span>
                </span>
                <span
                  className="font-mono font-black text-[11px] sm:text-xs shrink-0"
                  style={{ color: total >= 0 ? def.accent : '#fda4af' }}
                >
                  {formatXpAmount(total)} XP
                </span>
              </header>

              <ul className="divide-y divide-[#1A1A24]">
                {groupRows.map(({ event }) => (
                  <XpLedgerRowView key={event.id} event={event} group={def} />
                ))}
              </ul>
            </section>
          ))}

          {rows.length > visibleRows.length && (
            <div className="flex flex-col items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                aria-label={`Daha fazla XP kaydı göster (${rows.length - visibleRows.length} kayıt kaldı)`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider border border-[#2D2D3F] bg-[#14141D] text-ink-200 hover:text-white hover:border-[#3A3A4E] transition-colors"
              >
                <Icons.ChevronDown size={13} /> Daha Fazla Göster
              </button>
              <span className="text-[10px] font-mono text-ink-500">
                {visibleRows.length} / {rows.length} kayıt
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ALT BİLEŞENLER                                                     */
/* ------------------------------------------------------------------ */

function SummaryCard({
  icon,
  label,
  value,
  accent,
  signed = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  signed?: boolean;
}) {
  const negative = signed && value.startsWith('-');
  return (
    <div className="rounded-xl border border-[#22222C] bg-[#0D0D12] px-3 py-2.5 sm:px-3.5 sm:py-3 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-6 h-6 rounded-md grid place-items-center shrink-0"
          style={{ background: `${accent}1F`, border: `1px solid ${accent}45`, color: accent }}
        >
          {icon}
        </span>
        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-ink-400 truncate">
          {label}
        </span>
      </div>
      <div
        className={`text-base sm:text-xl font-black font-mono tracking-tight tabular-nums truncate ${
          negative ? 'text-rose-400' : 'text-white'
        }`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function SourceChip({
  active,
  label,
  count,
  accent,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Kaynak filtresi: ${label} (${count} kayıt)`}
      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold border transition-all whitespace-nowrap"
      style={{
        background: active ? `${accent}22` : 'transparent',
        borderColor: active ? `${accent}80` : '#242430',
        color: active ? '#fff' : '#a1a1aa',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
      {label}
      <span className="font-mono text-[9px] sm:text-[10px] text-ink-400">{count}</span>
    </button>
  );
}

function XpLedgerRowView({ event, group }: { event: XpEvent; group: XpSourceGroupDef }) {
  const amount = safeAmount(event);
  const positive = amount >= 0;
  return (
    <li className="px-3 sm:px-4 py-2 sm:py-2.5">
      <div className="flex items-center gap-2.5">
        <span
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg grid place-items-center shrink-0"
          style={{ background: `${group.accent}14`, border: `1px solid ${group.accent}35`, color: group.accent }}
          aria-hidden="true"
        >
          {positive ? <Icons.Plus size={14} /> : <Icons.Minus size={14} />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[12px] sm:text-[13px] font-bold text-ink-100 truncate" title={event.label}>
              {event.label || event.sourceId || 'Adsız kayıt'}
            </span>
            <span
              className="hidden xs:inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider border"
              style={{ background: `${group.accent}16`, borderColor: `${group.accent}45`, color: group.accent }}
            >
              {group.label}
            </span>
          </div>
          <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-[10px] sm:text-[11px] text-ink-400 font-mono mt-0.5">
            <span className="truncate" title={formatXpFormula(event)}>{formatXpFormula(event)} XP</span>
            <span className="text-ink-600" aria-hidden="true">·</span>
            <time dateTime={event.createdAt || undefined}>{formatXpDate(event.createdAt)}</time>
          </div>
        </div>

        <span
          className={`shrink-0 font-mono font-black text-sm sm:text-base tabular-nums ${
            positive ? 'text-emerald-400' : 'text-rose-400'
          }`}
          aria-label={`${positive ? 'kazanılan' : 'kaybedilen'} ${Math.abs(amount)} XP`}
        >
          {formatXpAmount(amount)}
          <span className="text-[9px] font-bold text-ink-500 ml-0.5">XP</span>
        </span>
      </div>
    </li>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#2A2A38] bg-[#0B0B10] px-4 py-10 text-center">
      <div className="w-11 h-11 mx-auto rounded-xl grid place-items-center bg-[#14141D] border border-[#262632] text-ink-400 mb-3">
        {icon}
      </div>
      <h3 className="text-sm sm:text-base font-black text-ink-100">{title}</h3>
      <p className="text-[11px] sm:text-xs text-ink-400 mt-1 max-w-sm mx-auto leading-relaxed">{description}</p>
      {action}
    </div>
  );
}
