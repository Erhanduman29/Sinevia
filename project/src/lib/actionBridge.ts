import type { ExternalActionTemplate, Movie, Series } from '../types';

/* =========================================================================
   ÇOKLU HIZLI AKSİYON KÖPRÜSÜ
   Kullanıcının tanımladığı URL şablonlarını (dış siteye hızlı geçiş)
   çözümlemek için saf yardımcılar. Placeholder'lar:
     {title}      → URL-encode edilmiş başlık
     {title_slug} → boşluksuz/normalize slug (Wikipedia, Letterboxd vb.)
     {title_plus} → boşluklar + ile (arama sorguları)
     {year}       → yapım yılı
     {imdbId}     → IMDb kimliği (örn. tt1375666)
     {tmdbId}     → TMDB kimliği (örn. 27205)
   Eski altWatchTemplate placeholder'ları için dönüşüm: {imdb} → {imdbId},
   {slug} → {title_slug} (rewriteLegacyTemplate).
   ========================================================================= */

/** Eşleşmeyen/kısmi placeholder'lı şablonda eksik veri varsa null → buton disabled. */
export interface ActionUrlTarget {
  url: string;
}

function slugifyPart(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/** Şablonda geçen tüm placeholder anahtarlarını döndürür (boş/eksik kontrolü için). */
export function extractPlaceholders(template: string): string[] {
  const matches = template.match(/\{[a-z_]+\}/gi) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1, -1))));
}

/**
 * Şablon + medya ile gerçek URL üretir.
 * Şablonda geçen bir alan medyada yoksa (örn. {imdbId} ama imdbId tanımsız)
 * `null` döner — çağıran butonu disabled yapmalıdır.
 */
export function resolveActionUrl(
  template: string,
  media: Pick<Movie | Series, 'title' | 'year' | 'imdbId' | 'tmdbId'>
): string | null {
  if (!template) return null;
  const title = (media.title || '').trim();
  const year = (media.year || '').trim();
  const imdbId = media.imdbId ? String(media.imdbId).trim() : '';
  const tmdbId = media.tmdbId != null && String(media.tmdbId).trim() !== '' ? String(media.tmdbId).trim() : '';

  const values: Record<string, string | null> = {
    title: title ? encodeURIComponent(title) : null,
    title_slug: title ? slugifyPart(title) : null,
    title_plus: title ? title.replace(/\s+/g, '+') : null,
    year: year || null,
    imdbId: imdbId || null,
    tmdbId: tmdbId || null,
    // Eski anahtarlar (legacy şablonlar için emniyet ağı)
    imdb: imdbId || null,
    slug: title ? slugifyPart(title) : null,
  };

  const placeholders = extractPlaceholders(template);
  let url = template;
  for (const key of placeholders) {
    const value = values[key];
    if (value == null || value === '') return null; // eksik veri → disabled
    url = url.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return url;
}

/** Eski altWatchTemplate metnini yeni placeholder diline çevirir. */
export function rewriteLegacyTemplate(legacy: string): string {
  if (!legacy) return legacy;
  return legacy
    .replace(/\{imdb\}/g, '{imdbId}')
    .replace(/\{slug\}/g, '{title_slug}');
}

/** Eski "Alternatif İzle" etiketlerini kullanıcıya görünen kısa "İzle" etiketine çevirir. */
export function normalizeActionLabel(label?: string | null): string {
  const trimmed = (label || '').trim();
  if (!trimmed) return 'Aksiyon';
  return /alternatif/i.test(trimmed) ? 'İzle' : trimmed;
}

/** Hazır şablonlar — SettingsPage "şablon ekle" menüsü ve ilk kurulum için. */
export const ACTION_BRIDGE_PRESETS: Array<Omit<ExternalActionTemplate, 'id'>> = [
  { label: 'YouTube Fragman', urlTemplate: 'https://www.youtube.com/results?search_query={title_slug}+{year}+trailer', icon: 'Play', targetScope: 'all', isPrimary: false },
  { label: 'Google Arama', urlTemplate: 'https://www.google.com/search?q={title}+{year}', icon: 'Search', targetScope: 'all', isPrimary: false },
  { label: 'IMDb', urlTemplate: 'https://www.imdb.com/title/{imdbId}/', icon: 'Info', targetScope: 'all', isPrimary: true },
  { label: 'Letterboxd', urlTemplate: 'https://letterboxd.com/search/films/{title_slug}/', icon: 'Film', targetScope: 'movie', isPrimary: false },
  { label: 'Ekşi Sözlük', urlTemplate: 'https://eksisozluk.com/?q={title}+{year}', icon: 'MessageSquare', targetScope: 'all', isPrimary: false },
  { label: 'Stremio', urlTemplate: 'https://www.stremio.com/search?query={title}', icon: 'MonitorPlay', targetScope: 'all', isPrimary: false },
];

/** Yeni şablon için rastgez kimlik (kütüphane/dış bağımlılıksız). */
export function newActionId(): string {
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
