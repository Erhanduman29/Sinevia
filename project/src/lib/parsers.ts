/**
 * MIGRATION ENGINE — CSV AYRIŞTIRICILARI
 *
 * Letterboxd / Trakt / IMDb CSV çıktılarını tarayıcıda (sunucuya göndermeden)
 * okuyup standart Sinevia aktarım taslağına çevirir.
 *
 * PapaParse bağımlılığı YOKTUR: tırnak içi virgül, kaçışlı tırnak, satır içi
 * yeni satır, BOM ve farklı ayraçları destekleyen küçük bir RFC-4180 ayrıştırıcı
 * burada bulunur.
 */
import type { Episode, Movie, Series, WatchHistoryItem } from '../types';
import type { LegacyImportPayload, LegacyImportSource } from './reducerActions';
import {
  TMDB_API_KEY,
  fetchTMDBMovieDetails,
  fetchTMDBSeriesDetails,
  findTMDBByImdbId,
  searchTMDBBasic,
  searchTMDBSeriesBasic,
  type TMDBBasicResult,
  type TMDBResult,
  type TMDBSeriesResult,
  type WatchProvider,
} from './tmdb';

export type ImportSource = 'letterboxd' | 'trakt' | 'imdb';
export type ImportStatus = 'matched' | 'review' | 'error';
export type ImportIntent = 'watched' | 'watchlist';

export interface ImportWatch {
  watchedAt: string;
  season?: number;
  episode?: number;
}

export interface ImportDraft {
  id: string;
  source: ImportSource;
  mediaType: 'movie' | 'series';
  /** İzlenmiş kayıt mı, yoksa katalog/izleme listesi kaydı mı? */
  intent: ImportIntent;
  title: string;
  year: number | null;
  rating: number | null;
  /** En güncel izleme tarihi (ISO). */
  watchedAt: string | null;
  /** Birden fazla izleme/yeniden izleme tarihi. */
  watches: ImportWatch[];
  /** Yalnızca puanlama tarihi varsa (diary/watched tarihi yoksa) yedek izleme tarihi. */
  fallbackWatchedAt?: string | null;
  note: string;
  reviewTags: string[];
  tmdbId: number | null;
  imdbId: string | null;
  posterUrl: string | null;
  overview?: string;
  runtime?: number | null;
  episodeRuntime?: number | null;
  genres: string[];
  directors?: string[];
  cast?: string[];
  creators?: string[];
  studios?: string[];
  keywords?: string[];
  watchProviders?: WatchProvider[];
  /** Diziler için TMDB sezon başına bölüm sayıları. */
  seasonCounts?: number[];
  originalLanguage?: string;
  status: ImportStatus;
  reason: string;
  sourceRef?: string;
}

export interface ParsedImportFile {
  name: string;
  source: ImportSource | 'unknown';
  rowCount: number;
  skipped: number;
}

export interface ParsedImport {
  drafts: ImportDraft[];
  files: ParsedImportFile[];
  errors: string[];
}

type CsvRow = Record<string, string>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ──────────────────────────────────────────────────────────────────────────
   CSV AYRIŞTIRICI
   ────────────────────────────────────────────────────────────────────────── */

function detectDelimiter(sample: string): string {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  let inQuotes = false;
  for (const ch of sample) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch] += 1;
    if (ch === '\n') break;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || ',';
}

function normalizeHeader(key: string): string {
  return key.replace(/^\ufeff/, '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

/** RFC-4180 uyumlu, tırnak ve satır içi yeni satır destekli CSV okuyucu. */
export function parseCsvText(text: string): { headers: string[]; rows: CsvRow[] } {
  let source = text.replace(/^\ufeff/, '');
  let delimiter = detectDelimiter(source);
  // Excel'in "sep=;" satırı.
  if (/^sep=./i.test(source)) {
    delimiter = source[1] || delimiter;
    source = source.slice(source.indexOf('\n') + 1);
  }

  const table: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushRow = () => {
    row.push(field);
    field = '';
    if (row.some((cell) => cell.trim().length > 0)) table.push(row);
    row = [];
  };

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      pushRow();
    } else if (ch === '\r') {
      if (source[i + 1] !== '\n') pushRow();
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();

  if (table.length === 0) return { headers: [], rows: [] };
  const headers = table[0].map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let r = 1; r < table.length; r += 1) {
    const cells = table[r];
    const obj: CsvRow = {};
    headers.forEach((header, index) => {
      const key = normalizeHeader(header);
      if (!key) return;
      obj[key] = (cells[index] ?? '').trim();
    });
    rows.push(obj);
  }
  return { headers: headers.map(normalizeHeader), rows };
}

function getField(row: CsvRow, ...aliases: string[]): string {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
}

function parseNumber(raw: string): number | null {
  if (!raw) return null;
  const normalized = raw.replace(',', '.').replace(/[^0-9.+-]/g, '');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseYear(raw: string): number | null {
  const value = parseNumber(raw);
  if (value == null) return null;
  const year = Math.trunc(value);
  return year >= 1870 && year <= 2200 ? year : null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Date / Watched Date / Date Rated alanlarını ISO (YYYY-MM-DD) biçimine çevirir. */
export function toIsoDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  // 2024-03-07 / 2024-03-07T20:00:00Z
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // 07.03.2024 / 07/03/2024 / 7-3-2024
  const dmy = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    if (month > 12 && day <= 12) {
      return `${dmy[3]}-${pad2(day)}-${pad2(month)}`;
    }
    return `${dmy[3]}-${pad2(month)}-${pad2(day)}`;
  }
  // 03/07/2024 (ABD) — gün/ay ayrımı belirsizse ayı öne al.
  const mdy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${pad2(Number(mdy[1]))}-${pad2(Number(mdy[2]))}`;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }
  return null;
}

/** Tarihi gün ortasına sabitler: saat dilimi kaynaklı gün kaymasını önler. */
function withNoon(isoDate: string): string {
  return `${isoDate}T12:00:00.000`;
}

const GENRE_TR: Record<string, string> = {
  action: 'Aksiyon',
  adventure: 'Macera',
  animation: 'Animasyon',
  comedy: 'Komedi',
  crime: 'Suç',
  documentary: 'Belgesel',
  drama: 'Dram',
  family: 'Aile',
  fantasy: 'Fantastik',
  history: 'Tarih',
  horror: 'Korku',
  music: 'Müzik',
  musical: 'Müzik',
  mystery: 'Gizem',
  romance: 'Romantik',
  'science fiction': 'Bilim Kurgu',
  'sci-fi': 'Bilim Kurgu',
  scifi: 'Bilim Kurgu',
  'tv movie': 'TV Filmi',
  thriller: 'Gerilim',
  war: 'Savaş',
  western: 'Vahşi Batı',
  biography: 'Biyografi',
  sport: 'Spor',
  'film-noir': 'Film-Noir',
  short: 'Kısa Film',
};

function normalizeGenre(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  return GENRE_TR[value.toLocaleLowerCase('tr-TR')] || value;
}

function splitList(raw: string): string[] {
  return raw
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitTags(raw: string): string[] {
  return splitList(raw)
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter((tag) => tag.length > 0 && tag.length <= 40);
}

function dedupeStrings(values: string[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function baseKey(source: ImportSource, title: string, year: number | null): string {
  return `${source}|${title.toLocaleLowerCase('tr-TR').trim()}|${year ?? ''}`;
}

const draftsByKey = new Map<string, ImportDraft>();

function getOrCreateDraft(
  source: ImportSource,
  title: string,
  year: number | null,
  mediaType: 'movie' | 'series',
  intent: ImportIntent,
): ImportDraft {
  const key = baseKey(source, title, year);
  const existing = draftsByKey.get(key);
  if (existing) {
    // Aynı yapım hem izleme listesinde hem izleme geçmişinde varsa izlenmiş kayıt kazanır.
    if (intent === 'watched') existing.intent = 'watched';
    return existing;
  }

  const draft: ImportDraft = {
    id: `imp-${source}-${stableHash(key)}`,
    source,
    mediaType,
    intent,
    title: title.trim(),
    year,
    rating: null,
    watchedAt: null,
    watches: [],
    note: '',
    reviewTags: [],
    tmdbId: null,
    imdbId: null,
    posterUrl: null,
    genres: [],
    status: 'review',
    reason: 'TMDB eşleştirmesi bekliyor',
    sourceRef: key,
  };
  draftsByKey.set(key, draft);
  return draft;
}

function addWatch(draft: ImportDraft, isoDate: string | null, season?: number, episode?: number): void {
  if (!isoDate) return;
  draft.intent = 'watched';
  if (draft.watches.some((w) => w.watchedAt.slice(0, 10) === isoDate && w.season === season && w.episode === episode)) {
    return;
  }
  draft.watches.push({ watchedAt: withNoon(isoDate), season, episode });
}

function finalizeDraft(draft: ImportDraft): void {
  // Kullanıcı kuralı: puanı olmayan hiçbir kayıt izlenmiş sayılmaz. Hangi
  // dosyadan gelirse gelsin (diary/history/ratings) puan yoksa katalogda
  // izlenecek olarak durur; geçmiş kaydı oluşturmaz.
  if (draft.intent === 'watched' && draft.rating == null) {
    draft.intent = 'watchlist';
  }
  if (draft.intent === 'watchlist') {
    draft.watches = [];
    draft.watchedAt = null;
    draft.rating = null;
    draft.note = '';
  } else if (draft.watches.length === 0 && draft.fallbackWatchedAt) {
    addWatch(draft, draft.fallbackWatchedAt);
  }
  draft.watches.sort((a, b) => a.watchedAt.localeCompare(b.watchedAt));
  draft.watchedAt = draft.watches.length > 0 ? draft.watches[draft.watches.length - 1].watchedAt : null;
  if (!draft.title.trim()) {
    draft.status = 'error';
    draft.reason = 'Başlık (Title / Name) alanı boş.';
  } else if (draft.status !== 'error') {
    draft.status = 'review';
    draft.reason = 'TMDB eşleştirmesi bekliyor';
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   PLATFORM AYRIŞTIRICILARI
   ────────────────────────────────────────────────────────────────────────── */

function parseLetterboxdRow(row: CsvRow, watchlist: boolean): void {
  const title = getField(row, 'Name', 'Title');
  if (!title) return;
  const year = parseYear(getField(row, 'Year'));
  const draft = getOrCreateDraft('letterboxd', title, year, 'movie', watchlist ? 'watchlist' : 'watched');

  if (!watchlist) {
    const ratingRaw = parseNumber(getField(row, 'Rating'));
    if (ratingRaw != null && ratingRaw > 0) {
      // Letterboxd 5 yıldız → Sinevia 10 puan.
      draft.rating = clamp(ratingRaw * 2, 0, 10);
    }

    const watchedDate = toIsoDate(getField(row, 'Watched Date', 'WatchedDate'));
    const ratedDate = toIsoDate(getField(row, 'Date'));
    if (watchedDate) addWatch(draft, watchedDate);
    else if (ratedDate) draft.fallbackWatchedAt = draft.fallbackWatchedAt || ratedDate;
  }

  const review = getField(row, 'Review', 'Note');
  if (review) draft.note = review;
  const tags = splitTags(getField(row, 'Tags'));
  if (tags.length) draft.reviewTags = dedupeStrings([...draft.reviewTags, ...tags]);

  const uri = getField(row, 'Letterboxd URI', 'LetterboxdURI', 'URI');
  if (uri) draft.sourceRef = `letterboxd:${uri}`;
  const tmdbId = parseNumber(getField(row, 'tmdbID', 'TMDB ID', 'tmdb_id'));
  if (tmdbId != null && tmdbId > 0) draft.tmdbId = Math.trunc(tmdbId);
  const imdbId = getField(row, 'imdbID', 'IMDb ID', 'imdb_id');
  if (/^tt\d+$/i.test(imdbId)) draft.imdbId = imdbId.toLowerCase();
}

function parseTraktRow(row: CsvRow, watchlist: boolean): void {
  const rawType = getField(row, 'Type', 'Media Type', 'media_type').toLocaleLowerCase('tr-TR');
  const seasonRaw = parseNumber(getField(row, 'Season', 'season'));
  const episodeRaw = parseNumber(getField(row, 'Episode', 'episode'));
  const isSeries = ['show', 'series', 'tv', 'tvshow', 'episode'].includes(rawType) || seasonRaw != null;
  const showTitle = getField(row, 'Show', 'Series', 'show', 'series');
  const title = showTitle || getField(row, 'Title', 'Name');
  if (!title) return;
  const year = parseYear(getField(row, 'Year', 'year'));
  const draft = getOrCreateDraft('trakt', title, year, isSeries ? 'series' : 'movie', watchlist ? 'watchlist' : 'watched');

  if (!watchlist) {
    const rating = parseNumber(getField(row, 'Rating', 'rating', 'Your Rating'));
    if (rating != null && rating > 0) draft.rating = clamp(rating, 0, 10);

    const watchedDate = toIsoDate(getField(row, 'Watched_At', 'Watched At', 'watched_at', 'Watched Date'));
    const ratedDate = toIsoDate(getField(row, 'Rated_At', 'Rated At', 'rated_at', 'Date'));
    if (watchedDate) {
      addWatch(
        draft,
        watchedDate,
        seasonRaw != null ? Math.trunc(seasonRaw) : undefined,
        episodeRaw != null ? Math.trunc(episodeRaw) : undefined,
      );
    } else if (ratedDate) {
      draft.fallbackWatchedAt = draft.fallbackWatchedAt || ratedDate;
    }
  }

  const note = getField(row, 'Notes', 'Note', 'Review', 'Comment');
  if (note) draft.note = note;
  const tags = splitTags(getField(row, 'Tags', 'tags'));
  if (tags.length) draft.reviewTags = dedupeStrings([...draft.reviewTags, ...tags]);

  const tmdbId = parseNumber(getField(row, 'tmdb_id', 'TMDB ID', 'tmdbId', 'tmdb'));
  if (tmdbId != null && tmdbId > 0) draft.tmdbId = Math.trunc(tmdbId);
  const imdbId = getField(row, 'imdb_id', 'IMDb ID', 'imdbId', 'imdb');
  if (/^tt\d+$/i.test(imdbId)) draft.imdbId = imdbId.toLowerCase();
  draft.sourceRef = draft.tmdbId
    ? `trakt:tmdb:${draft.tmdbId}`
    : draft.imdbId
      ? `trakt:imdb:${draft.imdbId}`
      : draft.sourceRef;
}

function imdbMediaType(raw: string): 'movie' | 'series' {
  const type = raw.trim().toLocaleLowerCase('tr-TR').replace(/[\s_-]+/g, '');
  if (['tvseries', 'tvminiseries', 'tvepisode', 'tvshort', 'tvspecial'].includes(type)) return 'series';
  return 'movie';
}

function parseImdbRow(row: CsvRow, watchlist: boolean): void {
  const title = getField(row, 'Title', 'Original Title', 'Name');
  if (!title) return;
  const year = parseYear(getField(row, 'Year', 'Release Year'));
  const typeRaw = getField(row, 'Title Type', 'TitleType', 'Type');
  const mediaType = imdbMediaType(typeRaw);
  const draft = getOrCreateDraft('imdb', title, year, mediaType, watchlist ? 'watchlist' : 'watched');

  const imdbId = getField(row, 'Const', 'IMDb ID', 'imdb_id', 'imdbId');
  if (/^tt\d+$/i.test(imdbId)) draft.imdbId = imdbId.toLowerCase();

  if (!watchlist) {
    const rating = parseNumber(getField(row, 'Your Rating', 'YourRating', 'Rating'));
    if (rating != null && rating > 0) draft.rating = clamp(rating, 0, 10);

    const ratedDate = toIsoDate(getField(row, 'Date Rated', 'DateRated', 'Watched Date', 'Date'));
    addWatch(draft, ratedDate);
  }

  const runtime = parseNumber(getField(row, 'Runtime (mins)', 'Runtime', 'RuntimeMins'));
  if (runtime != null && runtime > 0) {
    if (mediaType === 'series') draft.episodeRuntime = Math.round(runtime);
    else draft.runtime = Math.round(runtime);
  }

  const genres = splitList(getField(row, 'Genres', 'Genre')).map(normalizeGenre).filter(Boolean);
  if (genres.length) draft.genres = dedupeStrings([...draft.genres, ...genres]);

  const directors = splitList(getField(row, 'Directors', 'Director'));
  if (directors.length) draft.directors = dedupeStrings([...directors]);
  draft.sourceRef = draft.imdbId ? `imdb:${draft.imdbId}` : draft.sourceRef;
}

function addErrorDraft(source: ImportSource, fileName: string, rowNumber: number, reason: string): void {
  const id = `imp-error-${stableHash(`${fileName}|${rowNumber}`)}`;
  const draft: ImportDraft = {
    id,
    source,
    mediaType: 'movie',
    intent: 'watched',
    title: '(Başlıksız kayıt)',
    year: null,
    rating: null,
    watchedAt: null,
    watches: [],
    note: '',
    reviewTags: [],
    tmdbId: null,
    imdbId: null,
    posterUrl: null,
    genres: [],
    status: 'error',
    reason: `${fileName} · satır ${rowNumber}: ${reason}`,
    sourceRef: `error:${fileName}:${rowNumber}`,
  };
  draftsByKey.set(`error:${id}`, draft);
}

function rowTitle(source: ImportSource, row: CsvRow): string {
  if (source === 'letterboxd') return getField(row, 'Name', 'Title');
  if (source === 'trakt') return getField(row, 'Show', 'Series', 'show', 'series', 'Title', 'Name');
  return getField(row, 'Title', 'Original Title', 'Name');
}

function isWatchlistFile(fileName: string, headers: string[]): boolean {
  const h = new Set(headers.map(normalizeHeader));
  if (h.has('watchlist') || h.has('watchlistdate') || h.has('watchlistedat')) return true;
  if (h.has('listedat') && !h.has('watchedat')) return true;
  return /watch[\s_-]*list|izleme[\s_-]*listesi/i.test(fileName);
}

function detectSource(fileName: string, headers: string[]): ImportSource | 'unknown' {
  const h = new Set(headers.map(normalizeHeader));
  if (h.has('letterboxduri') || (h.has('name') && (h.has('watcheddate') || h.has('letterboxduri')))) return 'letterboxd';
  if (h.has('const') || h.has('yourrating') || (h.has('titletype') && h.has('daterated'))) return 'imdb';
  if (h.has('tmdbid') || h.has('watchedat') || h.has('listedat') || h.has('traktid') || (h.has('type') && h.has('rating'))) return 'trakt';

  const lower = fileName.toLowerCase();
  if (lower.includes('letterboxd')) return 'letterboxd';
  if (lower.includes('imdb')) return 'imdb';
  if (lower.includes('trakt')) return 'trakt';
  return 'unknown';
}

/** Tek bir CSV dosyasını okuyup platforma göre taslak üretir. */
export async function parseImportFile(file: File): Promise<ParsedImportFile & { drafts: ImportDraft[]; errors: string[] }> {
  const text = await file.text();
  const { headers, rows } = parseCsvText(text);
  const source = detectSource(file.name, headers);
  const watchlist = isWatchlistFile(file.name, headers);
  const errors: string[] = [];

  if (rows.length === 0) {
    return {
      name: file.name,
      source,
      rowCount: 0,
      skipped: 0,
      drafts: [],
      errors: [`${file.name}: CSV satırı bulunamadı.`],
    };
  }
  if (source === 'unknown') {
    return {
      name: file.name,
      source,
      rowCount: rows.length,
      skipped: rows.length,
      drafts: [],
      errors: [`${file.name}: platform tanınamadı. Letterboxd, Trakt veya IMDb CSV dosyası seçin.`],
    };
  }

  const before = draftsByKey.size;
  rows.forEach((row, index) => {
    if (!rowTitle(source, row).trim()) {
      addErrorDraft(source, file.name, index + 2, 'Başlık (Title / Name) alanı boş.');
      return;
    }
    if (source === 'letterboxd') parseLetterboxdRow(row, watchlist);
    else if (source === 'trakt') parseTraktRow(row, watchlist);
    else parseImdbRow(row, watchlist);
  });
  const drafted = Array.from(draftsByKey.values()).slice(before);

  return {
    name: file.name,
    source,
    rowCount: rows.length,
    skipped: Math.max(0, rows.length - drafted.length),
    drafts: drafted,
    errors,
  };
}

/** Birden çok CSV dosyasını (Letterboxd diary + ratings gibi) tek önizlemede birleştirir. */
export async function parseImportFiles(files: File[] | FileList): Promise<ParsedImport> {
  draftsByKey.clear();
  const list = Array.from(files);
  const parsedFiles: ParsedImportFile[] = [];
  const errors: string[] = [];

  for (const file of list) {
    try {
      const result = await parseImportFile(file);
      parsedFiles.push({
        name: result.name,
        source: result.source,
        rowCount: result.rowCount,
        skipped: result.skipped,
      });
      errors.push(...result.errors);
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Dosya okunamadı.'}`);
    }
  }

  const drafts = Array.from(draftsByKey.values()).filter((d) => Boolean(d.title));
  drafts.sort((a, b) => (b.watchedAt || '').localeCompare(a.watchedAt || '') || a.title.localeCompare(b.title, 'tr'));

  // Aynı film farklı dosyalardan geldiyse yıl/başlık eşleşmesiyle tekrar eden
  // taslakları birleştir (ör. ratings.csv + diary.csv).
  const merged = new Map<string, ImportDraft>();
  for (const draft of drafts) {
    const key = draft.status === 'error'
      ? `error|${draft.id}`
      : `${draft.source}|${draft.title.toLocaleLowerCase('tr-TR')}|${draft.year ?? ''}|${draft.mediaType}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, draft);
      continue;
    }
    if (draft.intent === 'watched') existing.intent = 'watched';
    existing.rating = existing.rating ?? draft.rating;
    existing.note = existing.note || draft.note;
    existing.reviewTags = dedupeStrings([...existing.reviewTags, ...draft.reviewTags]);
    existing.genres = dedupeStrings([...existing.genres, ...draft.genres]);
    existing.tmdbId = existing.tmdbId ?? draft.tmdbId;
    existing.imdbId = existing.imdbId || draft.imdbId;
    existing.posterUrl = existing.posterUrl || draft.posterUrl;
    existing.overview = existing.overview || draft.overview;
    existing.runtime = existing.runtime ?? draft.runtime;
    existing.episodeRuntime = existing.episodeRuntime ?? draft.episodeRuntime;
    existing.keywords = existing.keywords?.length ? existing.keywords : draft.keywords;
    existing.watchProviders = existing.watchProviders?.length ? existing.watchProviders : draft.watchProviders;
    existing.seasonCounts = existing.seasonCounts?.length ? existing.seasonCounts : draft.seasonCounts;
    existing.directors = existing.directors?.length ? existing.directors : draft.directors;
    existing.cast = existing.cast?.length ? existing.cast : draft.cast;
    existing.creators = existing.creators?.length ? existing.creators : draft.creators;
    existing.studios = existing.studios?.length ? existing.studios : draft.studios;
    existing.watches = [...existing.watches, ...draft.watches]
      .filter((w, index, arr) => arr.findIndex((x) => x.watchedAt === w.watchedAt && x.season === w.season && x.episode === w.episode) === index)
      .sort((a, b) => a.watchedAt.localeCompare(b.watchedAt));
    existing.watchedAt = existing.watches.length ? existing.watches[existing.watches.length - 1].watchedAt : null;
  }

  const uniqueDrafts = Array.from(merged.values());
  // Birleştirmeden sonra tekrar değerlendir: puanlı bir dosyayla eşleşen kayıt
  // izlenmiş kalır, puanı olmayanlar ise izlenecek kataloğuna düşer.
  uniqueDrafts.forEach(finalizeDraft);

  return { drafts: uniqueDrafts, files: parsedFiles, errors };
}

/* ──────────────────────────────────────────────────────────────────────────
   TMDB ZENGİNLEŞTİRME (yalnızca eksik alanlar, batch + rate limit)
   ────────────────────────────────────────────────────────────────────────── */

let lastTmdbRequestAt = 0;

async function tmdbThrottle(ms = 200): Promise<void> {
  const wait = Math.max(0, lastTmdbRequestAt + ms - Date.now());
  if (wait > 0) await sleep(wait);
  lastTmdbRequestAt = Date.now();
}

function applyMovieMeta(draft: ImportDraft, meta: TMDBResult): void {
  draft.tmdbId = meta.id;
  draft.imdbId = draft.imdbId || meta.imdbId || null;
  draft.posterUrl = draft.posterUrl || meta.posterUrl;
  draft.overview = draft.overview || meta.overview;
  draft.genres = dedupeStrings([...draft.genres, ...(meta.genres || [])]);
  draft.runtime = draft.runtime ?? meta.runtime ?? null;
  draft.directors = draft.directors?.length ? draft.directors : meta.directors;
  draft.cast = draft.cast?.length ? draft.cast : meta.cast;
  draft.studios = draft.studios?.length ? draft.studios : meta.studios;
  draft.keywords = draft.keywords?.length ? draft.keywords : meta.keywords;
  draft.watchProviders = draft.watchProviders?.length ? draft.watchProviders : meta.watchProviders;
  draft.originalLanguage = draft.originalLanguage || meta.originalLanguage;
}

function applySeriesMeta(draft: ImportDraft, meta: TMDBSeriesResult): void {
  draft.tmdbId = meta.id;
  draft.imdbId = draft.imdbId || meta.imdbId || null;
  draft.posterUrl = draft.posterUrl || meta.posterUrl;
  draft.overview = draft.overview || meta.overview;
  draft.genres = dedupeStrings([...draft.genres, ...(meta.genres || [])]);
  draft.episodeRuntime = draft.episodeRuntime ?? meta.episodeRuntime ?? null;
  draft.creators = draft.creators?.length ? draft.creators : meta.creators;
  draft.cast = draft.cast?.length ? draft.cast : meta.cast;
  draft.studios = draft.studios?.length ? draft.studios : meta.studios;
  draft.keywords = draft.keywords?.length ? draft.keywords : meta.keywords;
  draft.watchProviders = draft.watchProviders?.length ? draft.watchProviders : meta.watchProviders;
  draft.seasonCounts = meta.hasSeasonData
    ? (draft.seasonCounts?.length ? draft.seasonCounts : meta.seasons)
    : draft.seasonCounts;
  draft.originalLanguage = draft.originalLanguage || meta.originalLanguage;
}

interface EnrichmentOutcome {
  draft: ImportDraft;
  matched: boolean;
  reason: string;
}

async function enrichOne(draft: ImportDraft): Promise<EnrichmentOutcome> {
  try {
    if (draft.tmdbId) {
      await tmdbThrottle();
      const meta = draft.mediaType === 'series'
        ? await fetchTMDBSeriesDetails(draft.tmdbId)
        : await fetchTMDBMovieDetails(draft.tmdbId);
      if (meta) {
        if (draft.mediaType === 'series') applySeriesMeta(draft, meta as TMDBSeriesResult);
        else applyMovieMeta(draft, meta as TMDBResult);
        return { draft, matched: true, reason: 'TMDB ID doğrudan eşleşti' };
      }
    }

    if (draft.imdbId) {
      await tmdbThrottle();
      const found = await findTMDBByImdbId(draft.imdbId, draft.mediaType);
      if (found) {
        await tmdbThrottle();
        const meta = found.type === 'series'
          ? await fetchTMDBSeriesDetails(found.id)
          : await fetchTMDBMovieDetails(found.id);
        if (meta) {
          if (found.type === 'series') applySeriesMeta(draft, meta as TMDBSeriesResult);
          else applyMovieMeta(draft, meta as TMDBResult);
          return { draft, matched: true, reason: 'IMDb ID ile TMDB eşleşti' };
        }
      }
    }

    await tmdbThrottle();
    const query = `${draft.title}${draft.year ? ` ${draft.year}` : ''}`;
    let results = draft.mediaType === 'series'
      ? await searchTMDBSeriesBasic(query)
      : await searchTMDBBasic(query);

    if (results.length === 0 && draft.year) {
      // Yıl eşleşmesi TMDB'de farklıysa (vizyon tarihi / ülke farkı) yılsız dene.
      await tmdbThrottle(260);
      results = draft.mediaType === 'series'
        ? await searchTMDBSeriesBasic(draft.title)
        : await searchTMDBBasic(draft.title);
    }

    if (results.length === 0) {
      return { draft, matched: false, reason: 'TMDB’de sonuç bulunamadı' };
    }

    const targetTitle = draft.title.toLocaleLowerCase('tr-TR').trim();
    const titleOf = (result: TMDBBasicResult) => [
      result.title,
      result.originalTitle,
    ].filter(Boolean).map((value) => String(value).toLocaleLowerCase('tr-TR').trim());
    const exact = results.find((r) => {
      const titleMatch = titleOf(r).includes(targetTitle);
      const yearMatch = !draft.year || !r.year || Math.abs(Number(r.year) - draft.year) <= 1;
      return titleMatch && yearMatch;
    }) || results.find((r) => titleOf(r).includes(targetTitle));

    const chosen = exact || results[0];
    if (!chosen) return { draft, matched: false, reason: 'TMDB’de sonuç bulunamadı' };

    await tmdbThrottle();
    if (draft.mediaType === 'series') {
      const meta = await fetchTMDBSeriesDetails(chosen.id);
      if (meta) applySeriesMeta(draft, meta);
      else {
        draft.tmdbId = chosen.id;
        draft.posterUrl = draft.posterUrl || chosen.posterUrl;
        draft.overview = draft.overview || chosen.overview;
        draft.genres = dedupeStrings([...draft.genres, ...chosen.genres]);
      }
    } else {
      const meta = await fetchTMDBMovieDetails(chosen.id);
      if (meta) applyMovieMeta(draft, meta);
      else {
        draft.tmdbId = chosen.id;
        draft.posterUrl = draft.posterUrl || chosen.posterUrl;
        draft.overview = draft.overview || chosen.overview;
        draft.genres = dedupeStrings([...draft.genres, ...chosen.genres]);
      }
    }

    if (exact) return { draft, matched: true, reason: 'Başlık ve yıl eşleşti' };
    return { draft, matched: false, reason: `Benzer sonuç: ${chosen.title}${chosen.year ? ` (${chosen.year})` : ''}` };
  } catch (error) {
    return {
      draft,
      matched: false,
      reason: error instanceof Error ? `TMDB hatası: ${error.message}` : 'TMDB isteği başarısız',
    };
  }
}

export interface EnrichmentProgress {
  done: number;
  total: number;
  matched: number;
  review: number;
}

/** Afişi hâlâ eksik olan kayıt için İngilizce başlıkla ikinci bir TMDB denemesi yapar. */
async function fillMissingPoster(draft: ImportDraft): Promise<void> {
  if (draft.posterUrl) return;
  try {
    await tmdbThrottle(320);
    const search = draft.mediaType === 'series' ? searchTMDBSeriesBasic : searchTMDBBasic;
    let results = await search(draft.title, 'en-US');
    if (results.length === 0) {
      await tmdbThrottle(260);
      results = await search(draft.title);
    }
    const chosen = results[0];
    if (!chosen) return;

    await tmdbThrottle(260);
    const meta = draft.mediaType === 'series'
      ? await fetchTMDBSeriesDetails(chosen.id)
      : await fetchTMDBMovieDetails(chosen.id);
    if (meta) {
      if (draft.mediaType === 'series') applySeriesMeta(draft, meta as TMDBSeriesResult);
      else applyMovieMeta(draft, meta as TMDBResult);
    }
    draft.posterUrl = draft.posterUrl || chosen.posterUrl;
    if (!draft.posterUrl) draft.reason = `${draft.reason} · Afiş TMDB’de bulunamadı`;
  } catch {
    /* ikinci deneme başarısız olsa da aktarım devam eder */
  }
}

/**
 * Eksik TMDB verilerini batch halinde tamamlar. Promise.allSettled kullanır;
 * tek bir kayıt hata verse bile diğerleri aktarılabilir kalır. İstekler
 * arasında gecikme vardır (rate-limit koruması).
 */
export async function enrichImportDrafts(
  drafts: ImportDraft[],
  onProgress?: (progress: EnrichmentProgress) => void,
): Promise<{ drafts: ImportDraft[]; warning?: string }> {
  if (!TMDB_API_KEY) {
    const next = drafts.map((draft) => (
      draft.status === 'error'
        ? draft
        : { ...draft, status: 'matched' as const, reason: 'TMDB anahtarı yok — başlık ve yıl ile aktarılacak' }
    ));
    return { drafts: next, warning: 'TMDB API anahtarı tanımlı değil. Afiş ve süre bilgileri olmadan aktarılacak.' };
  }

  const next = drafts.map((draft) => ({ ...draft, watches: [...draft.watches] }));
  const pending = next.filter((draft) => draft.status !== 'error' && draft.title);
  let done = 0;
  let matched = 0;
  let review = 0;
  const batchSize = 4;

  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((draft) => enrichOne(draft)));
    results.forEach((result, index) => {
      const draft = batch[index];
      if (result.status === 'fulfilled') {
        draft.status = result.value.matched ? 'matched' : 'review';
        draft.reason = result.value.reason;
        if (result.value.matched) matched += 1;
        else review += 1;
      } else {
        draft.status = 'review';
        draft.reason = 'TMDB isteği başarısız';
        review += 1;
      }
    });
    done += batch.length;
    onProgress?.({ done, total: pending.length, matched, review });
    if (i + batchSize < pending.length) await sleep(180);
  }

  // İlk turda afişi gelmeyen kayıtlar için tek tek ikinci deneme.
  const missingPosters = next.filter((draft) => draft.status !== 'error' && !draft.posterUrl && draft.title);
  if (missingPosters.length > 0) {
    const baseTotal = done;
    for (let i = 0; i < missingPosters.length; i += 1) {
      await fillMissingPoster(missingPosters[i]);
      onProgress?.({
        done: baseTotal + i + 1,
        total: baseTotal + missingPosters.length,
        matched,
        review,
      });
    }
  }

  return { drafts: next };
}

/* ──────────────────────────────────────────────────────────────────────────
   SINEVIA MODELİNE DÖNÜŞTÜRME
   ────────────────────────────────────────────────────────────────────────── */

function draftYear(draft: ImportDraft): string {
  return draft.year != null ? String(draft.year) : '';
}

function draftHistoryId(draft: ImportDraft, index: number): string {
  return `imp-h-${stableHash(`${draft.sourceRef || draft.id}|${draft.watches[index]?.watchedAt || ''}|${index}`)}`;
}

/**
 * Seçilen taslakları reducer'a gönderilecek tek pakete çevirir.
 * İzlenmiş kayıtlar `isPastWatch: true` + `importedAt`; izleme listesi kayıtları
 * ise `watched: false` / `isPastWatch: false` olarak katalog listelerine gider.
 */
export function buildLegacyImportPayload(
  drafts: ImportDraft[],
  source: LegacyImportSource = 'mixed',
  importedAt = new Date().toISOString(),
): LegacyImportPayload {
  const movies: Movie[] = [];
  const series: Series[] = [];
  const watchlistMovies: Movie[] = [];
  const watchlistSeries: Series[] = [];
  const history: WatchHistoryItem[] = [];
  const reviewTags: string[] = [];

  for (const draft of drafts) {
    if (!draft.title || draft.status === 'error') continue;
    const id = draft.id || `imp-${draft.source}-${stableHash(`${draft.title}|${draft.year ?? ''}`)}`;
    const tags = draft.reviewTags.length ? draft.reviewTags : undefined;
    const isWatchlist = draft.intent === 'watchlist';

    if (!isWatchlist && tags) reviewTags.push(...tags);

    if (draft.mediaType === 'series') {
      const latest = draft.watchedAt || importedAt;
      const commonSeries = {
        id,
        title: draft.title,
        year: draftYear(draft),
        genres: draft.genres,
        posterUrl: draft.posterUrl || undefined,
        overview: draft.overview,
        tmdbId: draft.tmdbId ?? undefined,
        imdbId: draft.imdbId ?? undefined,
        originalLanguage: draft.originalLanguage,
        episodeRuntime: draft.episodeRuntime ?? undefined,
        creators: draft.creators,
        cast: draft.cast,
        studios: draft.studios,
        keywords: draft.keywords,
        watchProviders: draft.watchProviders,
        addedAt: importedAt,
        importedAt,
      };

      if (isWatchlist) {
        watchlistSeries.push({
          ...commonSeries,
          episodes: buildWatchlistEpisodes(draft),
          isPastWatch: false,
          overallRating: null,
          overallNote: '',
          overallRatedAt: null,
          overallReviewTags: undefined,
        });
      } else {
        series.push({
          ...commonSeries,
          episodes: buildWatchedEpisodes(draft),
          isPastWatch: true,
          overallRating: draft.rating,
          overallNote: draft.note,
          overallRatedAt: latest,
          overallReviewTags: tags,
        });
      }
    } else {
      const commonMovie = {
        id,
        title: draft.title,
        year: draftYear(draft),
        genres: draft.genres,
        collectionId: null,
        runtime: draft.runtime ?? undefined,
        posterUrl: draft.posterUrl || undefined,
        overview: draft.overview,
        tmdbId: draft.tmdbId ?? undefined,
        imdbId: draft.imdbId ?? undefined,
        originalLanguage: draft.originalLanguage,
        directors: draft.directors,
        cast: draft.cast,
        studios: draft.studios,
        keywords: draft.keywords,
        watchProviders: draft.watchProviders,
        addedAt: importedAt,
        importedAt,
      };

      if (isWatchlist) {
        watchlistMovies.push({
          ...commonMovie,
          watched: false,
          isPastWatch: false,
          rating: null,
          reviewTags: undefined,
          note: '',
          watchedAt: null,
        });
      } else {
        movies.push({
          ...commonMovie,
          actualRuntime: draft.runtime ?? undefined,
          watched: true,
          isPastWatch: true,
          rating: draft.rating,
          reviewTags: tags,
          note: draft.note,
          watchedAt: draft.watchedAt,
        });
      }
    }

    if (isWatchlist) continue;

    draft.watches.forEach((watch, index) => {
      const isSeries = draft.mediaType === 'series';
      const hasEpisodeNumber = typeof watch.season === 'number' && typeof watch.episode === 'number';
      history.push({
        id: draftHistoryId(draft, index),
        itemId: id,
        seriesId: isSeries ? id : undefined,
        kind: isSeries ? 'series' : 'movie',
        type: isSeries ? 'series' : 'movie',
        title: draft.title,
        rating: draft.rating,
        reviewTags: tags,
        note: draft.note,
        watchedAt: watch.watchedAt,
        isPastWatch: true,
        importedAt,
        genres: draft.genres,
        year: draftYear(draft),
        season: watch.season,
        episode: watch.episode,
        ratingScope: isSeries ? (hasEpisodeNumber ? 'episode' : 'series') : undefined,
        bulkRating: isSeries && !hasEpisodeNumber ? true : undefined,
        originalRuntime: isSeries ? draft.episodeRuntime ?? undefined : draft.runtime ?? undefined,
      });
    });
  }

  return {
    source,
    importedAt,
    movies,
    series,
    watchlistMovies,
    watchlistSeries,
    history,
    reviewTags: dedupeStrings(reviewTags),
  };
}

/** İzleme listesindeki dizi için TMDB sezon sayılarından izlenmemiş bölümler üretir. */
function buildWatchlistEpisodes(draft: ImportDraft): Episode[] {
  const counts = draft.seasonCounts || [];
  const episodes: Episode[] = [];
  counts.forEach((count, seasonIndex) => {
    for (let episode = 1; episode <= count; episode += 1) {
      episodes.push({
        id: `imp-ep-${stableHash(`${draft.id}|${seasonIndex + 1}|${episode}`)}`,
        season: seasonIndex + 1,
        episode,
        runtime: draft.episodeRuntime ?? undefined,
        watched: false,
        rating: null,
        note: '',
        watchedAt: null,
      });
    }
  });
  return episodes;
}

/** İzlenmiş dizi için yalnızca gerçekten izlenen bölümleri üretir. */
function buildWatchedEpisodes(draft: ImportDraft): Episode[] {
  const episodes: Episode[] = [];
  const seen = new Set<string>();
  for (const watch of draft.watches) {
    if (typeof watch.season !== 'number' || typeof watch.episode !== 'number') continue;
    const key = `${watch.season}:${watch.episode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    episodes.push({
      id: `imp-ep-${stableHash(`${draft.id}|${key}`)}`,
      season: watch.season,
      episode: watch.episode,
      runtime: draft.episodeRuntime ?? undefined,
      watched: true,
      rating: draft.rating,
      note: draft.note,
      reviewTags: draft.reviewTags.length ? draft.reviewTags : undefined,
      watchedAt: watch.watchedAt,
    });
  }
  return episodes;
}

/** Kayıt sayısı özeti (UI rozetleri). */
export function countDraftStatuses(drafts: ImportDraft[]): {
  total: number;
  matched: number;
  review: number;
  error: number;
  movies: number;
  series: number;
  watches: number;
  watchlist: number;
} {
  return drafts.reduce(
    (acc, draft) => {
      acc.total += 1;
      acc[draft.status] += 1;
      if (draft.mediaType === 'series') acc.series += 1;
      else acc.movies += 1;
      acc.watches += draft.watches.length;
      if (draft.intent === 'watchlist') acc.watchlist += 1;
      return acc;
    },
    { total: 0, matched: 0, review: 0, error: 0, movies: 0, series: 0, watches: 0, watchlist: 0 },
  );
}
