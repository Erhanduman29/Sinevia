import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from 'react';

// ============================================================================
// VIRTUALLIST — Liste sanallaştırma (windowing) sarmalayıcısı — Madde 2.
//
// Prensip: Sayfa akışı (window scroll) içinde çalışan liste, yalnızca görünür
// aralığa düşen (viewport ± overscan px) öğeleri DOM'a basar. Kaydırma esnasında
// yükseklik ölçümü ResizeObserver ile yapılır; pozisyonlar prefix-sum offset'ler
// (dinamik) veya sabit öğe yüksekliği (sabit mod) üzerinden binary search ile
// bulunur. Görünürdeki ~15-20 öğe hariç tüm DOM düğümleri geri dönüştürülür.
//
// Destekler:
//   • Sabit yükseklik  → itemHeight verilir (ölçüm yapılmaz, en ucuz yol).
//   • Dinamik yükseklik → estimateHeight + ResizeObserver ölçümü (akordeon kart,
//     tarih gruplu zaman çizelgesi vb. değişken boyutlu listeler).
//
// Not: pencere (window) kaydırmasını varsayar — modal içi kaydırma alanlarında
// kullanılmaz (oradaki grid'ler sonuç kümesi süzülmüş ve sınırlıdır).
// ============================================================================

export interface VirtualListProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Sanallaştırılacak öğeler. */
  items: readonly T[];
  /** Öğe anahtarı — ölçüm önbelleği kimliği. Varsayılan: index. */
  getKey?: (item: T, index: number) => string | number;
  /** Öğeler arası dikey boşluk (px). Tailwind space-y yerine kullanılır. */
  gap?: number;
  /** Dinamik modda tahmini öğe yüksekliği (px). */
  estimateHeight?: number;
  /** Sabit yükseklik modu (px) — verilirse ölçüm atlanır. */
  itemHeight?: number;
  /** Görünür alanın üst/altına taşan px güvenlik payı (varsayılan 400). */
  overscan?: number;
  /** Yalnızca pencere aralığındaki öğeler çağrılır. */
  renderItem: (item: T, index: number) => ReactNode;
}

/** `spec` = "0:2,640:3,768:4,1024:5" → genişlik ≥ min olan son kolon sayısı. */
function parseColumns(spec: string, width: number): number {
  let cols = 1;
  for (const part of spec.split(',')) {
    const sep = part.indexOf(':');
    if (sep < 0) continue;
    const min = Number(part.slice(0, sep));
    const col = Number(part.slice(sep + 1));
    if (!Number.isNaN(min) && !Number.isNaN(col) && width >= min) cols = col;
  }
  return cols;
}

/**
 * Pencere genişliğine göre kolon sayısı (matchMedia yerine resize + string dep).
 * spec: "0:2,640:3,768:4,1024:5" — Tailwind grid-cols breakpoint'leriyle eşleştirin.
 */
export function useMediaColumns(spec: string, fallback = 2): number {
  const [cols, setCols] = useState(() =>
    typeof window === 'undefined' ? fallback : parseColumns(spec, window.innerWidth)
  );
  useEffect(() => {
    const calc = () => setCols(parseColumns(spec, window.innerWidth));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [spec]);
  return cols;
}

/** Listeyi satırlara böler (grid sanallaştırma için). */
export function chunkArray<T>(items: readonly T[], columns: number): T[][] {
  const cols = Math.max(1, Math.floor(columns));
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols) as T[]);
  return rows;
}

function findStart(tops: Float64Array, viewStart: number): number {
  // ilk i: tops[i+1] > viewStart (öğenin bitişi viewStart'ın altında)
  let lo = 0;
  let hi = tops.length - 1; // tops.length = n + 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tops[mid + 1] <= viewStart) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function findEnd(tops: Float64Array, viewEnd: number): number {
  // ilk i: tops[i] >= viewEnd (dahil edilmez — exclusive)
  let lo = 0;
  let hi = tops.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tops[mid] < viewEnd) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function VirtualListInner<T>(props: VirtualListProps<T>): ReactElement {
  const {
    items,
    getKey,
    gap = 0,
    estimateHeight = 180,
    itemHeight,
    overscan = 400,
    renderItem,
    className,
    style,
    ...rest
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  /** item key → ölçülen yükseklik (border-box). */
  const heightsRef = useRef<Map<string, number>>(new Map());
  const observedRef = useRef<Set<HTMLElement>>(new Set());
  const roRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef(0);
  const [, setMeasureTick] = useState(0);

  const keyOf = useCallback(
    (item: T, index: number): string => String(getKey ? getKey(item, index) : index),
    [getKey]
  );

  // --- Offsets: her ölçüm/filtre değişiminde prefix-sum yeniden hesaplanır ---
  const offsets = useMemo(() => {
    const n = items.length;
    const tops = new Float64Array(n + 1);
    const heights = heightsRef.current;
    let top = 0;
    for (let i = 0; i < n; i++) {
      tops[i] = top;
      const k = keyOf(items[i], i);
      const h = itemHeight ?? heights.get(k) ?? estimateHeight;
      top += h + gap;
    }
    tops[n] = n > 0 ? top - gap : 0;
    return tops;
    // measureTick: ölçüm sonrası yeniden hesap tetikleyicisi.
  }, [items, keyOf, itemHeight, estimateHeight, gap, /* eslint-disable-next-line react-hooks/exhaustive-deps */ setMeasureTick]);

  const offsetsRef = useRef(offsets);
  offsetsRef.current = offsets;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const keyOfRef = useRef(keyOf);
  keyOfRef.current = keyOf;

  // --- Pencere aralığını güncelle (rAF ile throttle'lı) ---
  const updateRange = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewStart = -rect.top - overscan;
    const viewEnd = (window.innerHeight || 800) - rect.top + overscan;
    const tops = offsetsRef.current;
    const n = itemsRef.current.length;
    if (n === 0) return;
    let start = findStart(tops, Math.max(0, viewStart));
    let end = findEnd(tops, viewEnd);
    if (start < 0) start = 0;
    if (end > n) end = n;
    if (end < start) end = start;
    setMeasureTick((prev) => {
      // prev yalnızca state'i diri tutar; aralık değişimini rangeState'e yazıyoruz.
      void prev;
      return prev;
    });
    rangeRef.current = { start, end };
    forceIfChanged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overscan]);

  // Aralık state'i: prev ile karşılaştırılıp yalnızca değişimde re-render tetiklenir.
  const [range, setRange] = useState({ start: 0, end: Math.ceil(900 / estimateHeight) + 4 });
  const rangeRef = useRef(range);
  const forceIfChanged = useCallback(() => {
    const next = rangeRef.current;
    setRange((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);

  const scheduleRange = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      updateRange();
    });
  }, [updateRange]);

  useEffect(() => {
    updateRange();
    window.addEventListener('scroll', scheduleRange, { passive: true });
    window.addEventListener('resize', scheduleRange);
    return () => {
      window.removeEventListener('scroll', scheduleRange);
      window.removeEventListener('resize', scheduleRange);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [updateRange, scheduleRange]);

  // --- Ölçüm: görünür sarmalayıcıları ResizeObserver ile izle ---
  const scheduleMeasure = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      setMeasureTick((t) => t + 1);
      updateRange();
    });
  }, [updateRange]);

  useLayoutEffect(() => {
    if (itemHeight) return; // sabit mod: ölçüm yok
    const container = containerRef.current;
    if (!container) return;
    if (!roRef.current) {
      roRef.current = new ResizeObserver(() => scheduleMeasure());
    }
    const ro = roRef.current;
    const current = new Set<HTMLElement>();
    container.querySelectorAll<HTMLElement>('[data-vl-key]').forEach((el) => current.add(el));
    // pencereden çıkan öğeleri bırak (detached DOM referansı kalmasın)
    observedRef.current.forEach((el) => {
      if (!current.has(el)) {
        ro.unobserve(el);
        observedRef.current.delete(el);
      }
    });
    current.forEach((el) => {
      if (!observedRef.current.has(el)) {
        observedRef.current.add(el);
        ro.observe(el);
        heightsRef.current.set(el.dataset.vlKey!, el.offsetHeight);
      }
    });
    scheduleMeasure();
  }, [range, offsets, itemHeight, scheduleMeasure]);

  // Anahtar kümesi çok büyürse (uzun oturum) eski ölçüm girdilerini temizle.
  useLayoutEffect(() => {
    const heights = heightsRef.current;
    if (heights.size > items.length + 64) {
      const keep = new Set<string>();
      for (let i = 0; i < items.length; i++) keep.add(keyOf(items[i], i));
      heights.forEach((_v, k) => {
        if (!keep.has(k)) heights.delete(k);
      });
    }
  }, [items, keyOf]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (roRef.current) roRef.current.disconnect();
      observedRef.current.clear();
    },
    []
  );

  const totalHeight = offsets[items.length] ?? 0;
  const nodes: ReactNode[] = [];
  const { start, end } = range;
  for (let i = start; i < end && i < items.length; i++) {
    const k = keyOf(items[i], i);
    nodes.push(
      <div
        key={k}
        data-vl-key={k}
        style={{
          position: 'absolute',
          top: offsets[i],
          left: 0,
          right: 0,
          height: itemHeight,
        }}
      >
        {renderItem(items[i], i)}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', height: totalHeight, ...style } as CSSProperties}
      {...rest}
    >
      {nodes}
    </div>
  );
}

/** React.memo: items/keyOf/gap gibi sabit girdilerde gereksiz yeniden render'ı keser. */
const VirtualList = memo(VirtualListInner) as typeof VirtualListInner;

export default VirtualList;
