import type { Movie, WatchHistoryItem, Series } from '../types';

// ============================================================================
// SAF SEÇİCİ (SELECTOR) MANTIĞI — memoize edilebilir, test edilebilir.
// Sayfalar bu saf fonksiyonları useMemo ile sarar; burada React bağımlılığı yok.
// ============================================================================

export type WatchedFilterMode = 'all' | 'unwatched' | 'watched' | 'past';
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
  if (watchedFilter === 'unwatched') filtered = filtered.filter((m) => !m.watched);
  else if (watchedFilter === 'watched') filtered = filtered.filter((m) => m.watched && !m.isPastWatch);
  else if (watchedFilter === 'past') filtered = filtered.filter((m) => m.watched && m.isPastWatch);

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
