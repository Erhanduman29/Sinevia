import type { Movie, WatchHistoryItem, Series } from '../types';

// ============================================================================
// SAF SEÇİCİ (SELECTOR) MANTIĞI — memoize edilebilir, test edilebilir.
// Sayfalar bu saf fonksiyonları useMemo ile sarar; burada React bağımlılığı yok.
// ============================================================================

export type WatchedFilterMode = 'all' | 'unwatched' | 'watched' | 'past' | 'graveyard';
export type SortMode = 'az' | 'year' | 'added' | 'rating';

/** Films arama: sadece görünür alanlar (başlık). Boş sorgu = hepsi. */
export function movieSearchMatches(m: Movie, search: string): boolean {
  const q = search.trim().toLocaleLowerCase('tr-TR');
  if (!q) return true;
  return (m.title || '').toLocaleLowerCase('tr-TR').includes(q);
}

/** Filtre + sıralama: izleme durumu, türler (AND), arama, sıralama modu. */
export function filterAndSortMovies(
  movies: Movie[],
  watchedFilter: WatchedFilterMode,
  selectedGenres: Set<string> | ReadonlySet<string>,
  search: string,
  sortMode: SortMode
): Movie[] {
  let filtered = movies;
  // İzlenecek (watchlist): yarım bırakılanlar (abandoned) izlenecek listesine girmez.
  if (watchedFilter === 'unwatched') filtered = filtered.filter((m) => !m.watched && !m.abandoned);
  else if (watchedFilter === 'watched') filtered = filtered.filter((m) => m.watched && !m.isPastWatch);
  else if (watchedFilter === 'past') filtered = filtered.filter((m) => m.watched && m.isPastWatch);
  // Mezarlık: yalnızca yarım bırakılanlar (Sinematik Otopsi / DNF).
  else if (watchedFilter === 'graveyard') filtered = filtered.filter((m) => Boolean(m.abandoned));

  if (selectedGenres.size > 0) {
    filtered = filtered.filter((m) => Array.from(selectedGenres).every((g) => m.genres.includes(g)));
  }
  filtered = filtered.filter((m) => movieSearchMatches(m, search));

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sortMode === 'az') return (a.title || '').localeCompare(b.title || '', 'tr');
    if (sortMode === 'year') return (a.year || '9999').localeCompare(b.year || '9999');
    if (sortMode === 'added') return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    const ra = a.watched ? (a.rating ?? -1) : -1;
    const rb = b.watched ? (b.rating ?? -1) : -1;
    return rb - ra;
  });
  return sorted;
}

// ============================================================================
// AFRİŞ (POSTER) GÖRSEL YÜKLEME YARDIMCILARI — bellek/performans dostu.
// ============================================================================

/**
 * Kırık afiş için otomatik yedek: onError'da img'yi tek seferlik yer tutucu bir
 * data-URI SVG'ye yönlendirir. DOM yapısına (placeholder kardeş var mı) bağımlı DEĞİLDİR,
 * bu yüzden her <img> üzerinde güvenle kullanılabilir. Sonsuz döngüyü dataset ile engeller.
 * Kullanım: <img onError={handleImgFallback} ... />
 */
const FALLBACK_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 3"><rect width="2" height="3" fill="#16161d"/><path d="M0.5 0.6h1v0.2h-1zM0.5 1.2h1v0.2h-1zM0.5 1.8h0.7v0.2h-0.7z" fill="#2a2a36"/></svg>'
  );

export function handleImgFallback(e: React.SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget;
  if (img.dataset.fallback === '1') return; // yedek de başarısız olursa tekrar deneme (sonsuz döngü yok)
  img.dataset.fallback = '1';
  img.src = FALLBACK_SVG;
}

/** Geriye dönük uyumluluk alias — eski çağrı yerleri çalışır kalsın. */
export const handlePosterError = handleImgFallback;

/**
 * TMDB afiş URL'ini "orijinal" yerine "orta" boyuta çevirir (bellek şişmesini azaltır).
 * TMDB dışı URL'ler aynen döner.
 */
export function optimizePosterUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.includes('image.tmdb.org')) return url.replace('/original/', '/w500/');
  return url;
}

// ============================================================================
// İSTATİSTİK SEÇİCİ — seyrek değişen türevleri tek yerde hesapla.
// ============================================================================

/** İzlenen (geçerli) film sayısı — isPastWatch hariç. */
export function countWatchedCurrentMovies(movies: Movie[]): number {
  return movies.filter((m) => m.watched && !m.isPastWatch).length;
}

/** Eskiden izlenen film sayısı. */
export function countPastMovies(movies: Movie[]): number {
  return movies.filter((m) => m.watched && m.isPastWatch).length;
}

/** Tamamlanan dizi sayısı (tüm bölümler izlenmiş). */
export function countCompletedSeries(series: Series[]): number {
  return series.filter((s) => (s.episodes || []).length > 0 && s.episodes.every((e) => e.watched)).length;
}

/** Geçmiş kalemlerinin yıl → aylık sayımlı haritası (yıllık ısı haritası için). */
export function buildYearMonthMap(history: WatchHistoryItem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const h of history) {
    if (!h.watchedAt) continue;
    const d = new Date(h.watchedAt);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

// ============================================================================
// DİZİ + GEÇMİŞ FİLTRE SEÇİCİLERİ — SeriesPage / HistoryPage (Madde 4)
// ============================================================================

export type SeriesSortMode = 'az' | 'recent' | 'rating';

/**
 * Dizi filtresi + sıralaması: tamamlanma durumu, türler (AND), arama, sıralama.
 * watchedFilter: null=filtre yok, true=sadece tamamlanan, false=sadece devam eden.
 */
export function filterAndSortSeries(
  series: Series[],
  watchedFilter: boolean | null,
  selectedGenres: ReadonlySet<string>,
  search: string,
  sortMode: SeriesSortMode
): Series[] {
  let list = series;
  if (watchedFilter !== null) {
    list = list.filter((s) => {
      const isCompleted = s.episodes.length > 0 && s.episodes.every((e) => e.watched);
      // İzlenecek: yarım bırakılanlar (abandoned) izlenecek listesine girmez.
      return watchedFilter ? isCompleted : (!isCompleted && !s.abandoned);
    });
  }
  if (selectedGenres.size > 0) list = list.filter((s) => Array.from(selectedGenres).every((g) => s.genres.includes(g)));
  if (search.trim()) {
    const q = search.toLocaleLowerCase('tr-TR');
    list = list.filter((s) => s.title.toLocaleLowerCase('tr-TR').includes(q));
  }
  return [...list].sort((a, b) => {
    if (sortMode === 'az') return a.title.localeCompare(b.title, 'tr');
    if (sortMode === 'recent') return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    const ratedA = a.episodes.filter((e) => e.rating !== null);
    const ratedB = b.episodes.filter((e) => e.rating !== null);
    const avgA = ratedA.length > 0 ? ratedA.reduce((s, e) => s + (e.rating || 0), 0) / ratedA.length : -1;
    const avgB = ratedB.length > 0 ? ratedB.reduce((s, e) => s + (e.rating || 0), 0) / ratedB.length : -1;
    return avgB - avgA;
  });
}

export type HistorySortMode = 'newest' | 'oldest' | 'rating';
export type HistoryFilterType = 'all' | 'movie' | 'series';
export type HistoryViewMode = 'timeline' | 'grid' | 'past';

/** Geçmiş filtresi + sıralaması: tür, notlu, yüksek puanlı, etiket, arama, sıralama. */
export function filterAndSortHistory(
  base: WatchHistoryItem[],
  viewMode: HistoryViewMode,
  filterType: HistoryFilterType,
  onlyWithNotes: boolean,
  onlyHighRated: boolean,
  selectedTagFilter: string | null,
  search: string,
  sortMode: HistorySortMode
): WatchHistoryItem[] {
  let items = [...base];
  if (viewMode !== 'past' && filterType !== 'all') {
    items = items.filter((h) => h.kind === filterType || h.type === filterType);
  }
  if (onlyWithNotes) items = items.filter((h) => h.note && h.note.trim().length > 0);
  if (onlyHighRated) items = items.filter((h) => h.rating !== null && h.rating >= 8.5);
  if (selectedTagFilter) items = items.filter((h) => h.reviewTags && h.reviewTags.includes(selectedTagFilter));
  if (search.trim()) {
    const q = search.toLocaleLowerCase('tr-TR');
    items = items.filter(
      (h) =>
        h.title.toLocaleLowerCase('tr-TR').includes(q) ||
        (h.note && h.note.toLocaleLowerCase('tr-TR').includes(q)) ||
        (h.genres && h.genres.some((g) => g.toLocaleLowerCase('tr-TR').includes(q))) ||
        (h.reviewTags && h.reviewTags.some((t) => t.toLocaleLowerCase('tr-TR').includes(q)))
    );
  }
  items.sort((a, b) => {
    if (sortMode === 'newest') return new Date(b.ratingChangedAt || b.watchedAt).getTime() - new Date(a.ratingChangedAt || a.watchedAt).getTime();
    if (sortMode === 'oldest') return new Date(a.ratingChangedAt || a.watchedAt).getTime() - new Date(b.ratingChangedAt || b.watchedAt).getTime();
    if (sortMode === 'rating') return (b.rating ?? -1) - (a.rating ?? -1);
    return 0;
  });
  return items;
}
