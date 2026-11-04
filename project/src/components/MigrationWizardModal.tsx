import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import {
  AlertTriangle, ArrowRight, Bookmark, Calendar, Check, CheckCircle2, CheckSquare, Clock, Database,
  Eye, FileText, Film, Link2, Loader2, RotateCcw, Search, Sparkles, Square, Star, Tv, Upload, X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { handleImgFallback } from '../lib/selectors';
import { normalize } from '../lib/utils';
import {
  buildLegacyImportPayload,
  countDraftStatuses,
  enrichImportDrafts,
  parseImportFiles,
  type EnrichmentProgress,
  type ImportDraft,
  type ImportSource,
  type ImportStatus,
  type ParsedImportFile,
} from '../lib/parsers';
import type { LegacyImportSource } from '../lib/reducerActions';

interface MigrationWizardModalProps {
  onClose: () => void;
}

type Phase = 'select' | 'parsing' | 'preview' | 'importing' | 'done';

const PREMIUM_LINE = 'var(--line-2, var(--border-dim, rgba(244, 244, 242, .13)))';
const PREMIUM_LINE_SOFT = 'var(--line, var(--border-dim, rgba(244, 244, 242, .07)))';
const PREMIUM_RADIUS = 'var(--r, 16px)';
const PREMIUM_RADIUS_LG = 'var(--r-lg, 22px)';
const PREMIUM_RADIUS_SM = 'var(--r-sm, 10px)';
const PREMIUM_RED_GRAD =
  'linear-gradient(150deg, var(--red-hi, var(--color-2, #ff6b7a)) 0%, var(--red, var(--color-1, #e8384f)) 45%, var(--red-deep, var(--color-3, #8e1220)) 130%)';
const PREMIUM_RED_GLOW =
  '0 10px 28px -10px rgba(232, 56, 79, .75), inset 0 1px 0 rgba(255, 255, 255, .35), inset 0 -2px 6px rgba(0, 0, 0, .25)';

const MODAL_OVERLAY_STYLE: CSSProperties = {
  background: 'radial-gradient(1000px 600px at 50% 30%, rgba(232, 56, 79, .14), transparent 65%), rgba(4, 4, 6, .72)',
  backdropFilter: 'blur(16px) saturate(130%)',
};

const MODAL_STYLE: CSSProperties = {
  background: 'linear-gradient(165deg, #17171C 0%, #0E0E12 60%, #0B0B0E 100%)',
  border: '1px solid rgba(255, 255, 255, .12)',
  borderRadius: PREMIUM_RADIUS_LG,
  boxShadow: '0 50px 110px -30px rgba(0, 0, 0, .95), 0 0 0 1px rgba(0, 0, 0, .5), 0 0 100px -40px rgba(232, 56, 79, .55), inset 0 1px 0 rgba(255, 255, 255, .1)',
};

const BTN_P_STYLE: CSSProperties = {
  background: PREMIUM_RED_GRAD,
  borderRadius: PREMIUM_RADIUS_SM,
  color: '#fff',
  boxShadow: PREMIUM_RED_GLOW,
};

const BTN_S_STYLE: CSSProperties = {
  background: 'linear-gradient(150deg, rgba(255, 255, 255, .14), rgba(255, 255, 255, .05))',
  border: `1px solid ${PREMIUM_LINE}`,
  borderRadius: PREMIUM_RADIUS_SM,
  boxShadow: '0 8px 22px -12px rgba(0, 0, 0, .9), inset 0 1px 0 rgba(255, 255, 255, .16)',
  color: 'var(--text-main, #f4f4f2)',
};

const ROW_STYLE: CSSProperties = {
  background: 'var(--glass, var(--bg-surface, rgba(255, 255, 255, .03)))',
  border: `1px solid ${PREMIUM_LINE_SOFT}`,
  borderRadius: PREMIUM_RADIUS,
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, .06)',
};

const SOURCE_META: Record<ImportSource, { label: string; color: string; bg: string; icon: typeof Film }> = {
  letterboxd: { label: 'Letterboxd', color: '#7dd3a8', bg: 'rgba(0, 224, 84, .12)', icon: Film },
  trakt: { label: 'Trakt', color: '#fca5a5', bg: 'rgba(237, 28, 36, .14)', icon: Tv },
  imdb: { label: 'IMDb', color: '#fcd34d', bg: 'rgba(245, 197, 24, .14)', icon: Database },
};

const STATUS_META: Record<ImportStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  matched: { label: 'Eşleşti', color: '#6ee7b7', bg: 'rgba(16, 185, 129, .14)', icon: CheckCircle2 },
  review: { label: 'Kontrol Et', color: '#fcd34d', bg: 'rgba(245, 158, 11, .14)', icon: AlertTriangle },
  error: { label: 'Hatalı', color: '#fda4af', bg: 'rgba(244, 63, 94, .14)', icon: AlertTriangle },
};

function formatDate(iso: string | null): string {
  if (!iso) return 'Tarih yok';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Tarih yok';
  return date.toLocaleDateString('tr-TR');
}

function ratingLabel(rating: number | null): string {
  if (rating == null) return '—';
  return `${rating.toFixed(1)} / 10`;
}

interface LibraryItem {
  title: string;
  year?: string;
  tmdbId?: number;
  imdbId?: string;
  watched: boolean;
  isPastWatch?: boolean;
}

interface LibraryMatch {
  watched: boolean;
  isPastWatch: boolean;
}

function libraryYear(value?: string | number | null): number | null {
  const match = String(value ?? '').match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

function libraryYearsCompatible(a?: string | number | null, b?: string | number | null): boolean {
  const ya = libraryYear(a);
  const yb = libraryYear(b);
  if (ya == null || yb == null) return true;
  return Math.abs(ya - yb) <= 1;
}

function buildLibraryIndex(items: LibraryItem[]) {
  const byTmdb = new Map<number, LibraryMatch>();
  const byImdb = new Map<string, LibraryMatch>();
  const byTitleYear = new Map<string, LibraryMatch>();
  const titleCounts = new Map<string, number>();
  items.forEach((item) => {
    const key = normalize(item.title);
    titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
  });
  const byTitle = new Map<string, LibraryMatch>();
  items.forEach((item) => {
    const match: LibraryMatch = { watched: item.watched, isPastWatch: Boolean(item.isPastWatch) };
    if (item.tmdbId != null) byTmdb.set(item.tmdbId, match);
    if (item.imdbId) byImdb.set(item.imdbId, match);
    const titleKey = normalize(item.title);
    byTitleYear.set(`${titleKey}|${String(item.year ?? '').slice(0, 4)}`, match);
    if (titleCounts.get(titleKey) === 1) byTitle.set(titleKey, match);
  });
  return { byTmdb, byImdb, byTitleYear, byTitle, items };
}

/** Önizlemede kütüphanede zaten var olan kayıtları işaretlemek için eşleşme üretir. */
function buildLibraryMatches(
  drafts: ImportDraft[],
  movies: LibraryItem[],
  series: LibraryItem[],
): Map<string, LibraryMatch> {
  const movieIndex = buildLibraryIndex(movies);
  const seriesIndex = buildLibraryIndex(series);
  const matches = new Map<string, LibraryMatch>();

  drafts.forEach((draft) => {
    const index = draft.mediaType === 'series' ? seriesIndex : movieIndex;
    let match: LibraryMatch | undefined;
    if (draft.tmdbId != null) match = index.byTmdb.get(draft.tmdbId);
    if (!match && draft.imdbId) match = index.byImdb.get(draft.imdbId);
    if (!match) {
      match = index.byTitleYear.get(`${normalize(draft.title)}|${draft.year ?? ''}`);
    }
    if (!match) {
      const candidate = index.byTitle.get(normalize(draft.title));
      if (candidate) {
        const existing = index.items.find((item) => normalize(item.title) === normalize(draft.title));
        if (existing && libraryYearsCompatible(draft.year, existing.year)) match = candidate;
      }
    }
    if (match) matches.set(draft.id, match);
  });

  return matches;
}

function seriesLibraryItems(series: Array<{
  title: string;
  year?: string;
  tmdbId?: number;
  imdbId?: string;
  isPastWatch?: boolean;
  episodes?: Array<{ watched: boolean }>;
}>): LibraryItem[] {
  return series.map((item) => ({
    title: item.title,
    year: item.year,
    tmdbId: item.tmdbId,
    imdbId: item.imdbId,
    watched: Boolean(item.episodes?.some((episode) => episode.watched)),
    isPastWatch: item.isPastWatch,
  }));
}

export default function MigrationWizardModal({ onClose }: MigrationWizardModalProps) {
  const { data, importLegacyData, showToast } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('select');
  const [files, setFiles] = useState<File[]>([]);
  const [parsedFiles, setParsedFiles] = useState<ParsedImportFile[]>([]);
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | ImportStatus>('all');
  const [search, setSearch] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState<EnrichmentProgress | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [summary, setSummary] = useState({ movies: 0, series: 0, watchlist: 0, history: 0 });

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !enriching && phase !== 'importing') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enriching, onClose, phase]);

  const counts = useMemo(() => countDraftStatuses(drafts), [drafts]);
  const librarySeries = useMemo(() => seriesLibraryItems(data.series), [data.series]);
  const libraryMatches = useMemo(
    () => buildLibraryMatches(drafts, data.movies, librarySeries),
    [drafts, data.movies, librarySeries],
  );
  const listedCount = useMemo(
    () => drafts.filter((draft) => draft.status !== 'error' && libraryMatches.has(draft.id)).length,
    [drafts, libraryMatches],
  );

  const selectedCount = useMemo(
    () => drafts.filter((draft) => selected.has(draft.id) && draft.status !== 'error').length,
    [drafts, selected],
  );

  const filteredDrafts = useMemo(() => {
    const query = normalize(search);
    return drafts.filter((draft) => {
      if (filter !== 'all' && draft.status !== filter) return false;
      if (query && !normalize(draft.title).includes(query)) return false;
      return true;
    });
  }, [drafts, filter, search]);

  const addFiles = useCallback(async (incoming: FileList | File[]) => {
    const csvFiles = Array.from(incoming).filter((file) => /\.csv$/i.test(file.name));
    if (csvFiles.length === 0) {
      showToast('Lütfen .csv uzantılı Letterboxd, Trakt veya IMDb dosyası seç.', 'error');
      return;
    }

    const merged = [...files, ...csvFiles].filter((file, index, arr) => (
      arr.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size) === index
    ));

    setPhase('parsing');
    setErrors([]);
    setWarning(null);
    setProgress(null);

    try {
      const result = await parseImportFiles(merged);
      const matches = buildLibraryMatches(result.drafts, data.movies, seriesLibraryItems(data.series));
      setFiles(merged);
      setParsedFiles(result.files);
      setDrafts(result.drafts);
      setErrors(result.errors);
      // Kütüphanede zaten izlenecek olarak duran kayıtlar varsayılan olarak
      // seçilmez; listede oldukları önizlemede ayrıca işaretlenir.
      setSelected(new Set(result.drafts
        .filter((draft) => draft.status !== 'error' && !(draft.intent === 'watchlist' && matches.has(draft.id)))
        .map((draft) => draft.id)));
      setFilter('all');
      setSearch('');
      setPhase(result.drafts.length > 0 ? 'preview' : 'select');
      if (result.drafts.length === 0) {
        showToast('CSV içinde aktarılabilir kayıt bulunamadı.', 'error');
      } else {
        const listed = result.drafts.filter((draft) => draft.status !== 'error' && matches.has(draft.id)).length;
        showToast(`${result.drafts.length} kayıt okundu${listed > 0 ? ` · ${listed} kayıt kütüphanede/listede` : ''}. Önizlemeyi kontrol edebilirsin.`, 'success');
      }
    } catch (error) {
      setPhase('select');
      showToast(error instanceof Error ? error.message : 'CSV dosyaları okunamadı.', 'error');
    }
  }, [data.movies, data.series, files, showToast]);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    void addFiles(event.dataTransfer.files);
  };

  const handleEnrich = async () => {
    if (drafts.length === 0 || enriching) return;
    setEnriching(true);
    setWarning(null);
    setProgress({ done: 0, total: drafts.filter((draft) => draft.status !== 'error').length, matched: 0, review: 0 });
    try {
      const result = await enrichImportDrafts(drafts, setProgress);
      const matches = buildLibraryMatches(result.drafts, data.movies, seriesLibraryItems(data.series));
      setDrafts(result.drafts);
      setWarning(result.warning || null);
      setSelected((current) => new Set(result.drafts
        .filter((draft) => draft.status !== 'error'
          && (current.has(draft.id) || (draft.status === 'matched' && !(draft.intent === 'watchlist' && matches.has(draft.id)))))
        .map((draft) => draft.id)));
      showToast(result.warning || 'TMDB eşleştirmesi tamamlandı.', result.warning ? 'warning' : 'success');
    } catch (error) {
      showToast(error instanceof Error ? `TMDB eşleştirmesi başarısız: ${error.message}` : 'TMDB eşleştirmesi başarısız.', 'error');
    } finally {
      setEnriching(false);
    }
  };

  const toggleDraft = (draft: ImportDraft) => {
    if (draft.status === 'error') return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(draft.id)) next.delete(draft.id);
      else next.add(draft.id);
      return next;
    });
  };

  const toggleVisible = () => {
    const selectable = filteredDrafts.filter((draft) => draft.status !== 'error');
    const allSelected = selectable.length > 0 && selectable.every((draft) => selected.has(draft.id));
    setSelected((current) => {
      const next = new Set(current);
      selectable.forEach((draft) => {
        if (allSelected) next.delete(draft.id);
        else next.add(draft.id);
      });
      return next;
    });
  };

  const handleImport = async () => {
    const chosenBase = drafts.filter((draft) => selected.has(draft.id) && draft.status !== 'error');
    if (chosenBase.length === 0) {
      showToast('Aktarım için en az bir kayıt seç.', 'warning');
      return;
    }
    setPhase('importing');
    setProgress({ done: 0, total: chosenBase.length, matched: 0, review: 0 });
    try {
      // Seçilen kayıtlarda eksik TMDB bilgisi varsa aktarımdan hemen önce
      // afiş + özet + tür + süre + kadro + platform verilerini tamamla.
      let chosen = chosenBase;
      if (chosen.some((draft) => !draft.posterUrl || draft.tmdbId == null)) {
        const enriched = await enrichImportDrafts(chosen, setProgress);
        chosen = enriched.drafts;
        if (enriched.warning) setWarning(enriched.warning);
        const enrichedById = new Map(enriched.drafts.map((draft) => [draft.id, draft]));
        setDrafts((current) => current.map((draft) => enrichedById.get(draft.id) || draft));
      }

      const sourceSet = new Set(chosen.map((draft) => draft.source));
      const source: LegacyImportSource = sourceSet.size === 1 ? Array.from(sourceSet)[0] : 'mixed';
      const payload = buildLegacyImportPayload(chosen, source);
      const movieCount = payload.movies.length;
      const seriesCount = payload.series.length;
      const watchlistCount = (payload.watchlistMovies?.length || 0) + (payload.watchlistSeries?.length || 0);
      const historyCount = payload.history.length;
      importLegacyData(payload);
      setSummary({ movies: movieCount, series: seriesCount, watchlist: watchlistCount, history: historyCount });
      setPhase('done');
    } catch (error) {
      setPhase('preview');
      showToast(error instanceof Error ? `Aktarım başarısız: ${error.message}` : 'Aktarım başarısız.', 'error');
    }
  };

  const resetWizard = () => {
    setPhase('select');
    setFiles([]);
    setParsedFiles([]);
    setDrafts([]);
    setErrors([]);
    setSelected(new Set());
    setSearch('');
    setFilter('all');
    setWarning(null);
    setProgress(null);
    setEnriching(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const progressPercent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      style={MODAL_OVERLAY_STYLE}
      onClick={() => { if (!enriching && phase !== 'importing') onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Dış kaynak veri aktarımı"
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        style={MODAL_STYLE}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Başlık */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-7 py-4 sm:py-5 border-b" style={{ borderColor: PREMIUM_LINE_SOFT }}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl grid place-items-center flex-shrink-0" style={{ background: 'rgba(232,56,79,.14)', border: `1px solid ${PREMIUM_LINE}` }}>
              <Upload size={21} className="text-[var(--red,#e8384f)]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black text-white leading-tight">Koleksiyon Aktarımı</h2>
              <p className="text-[11px] sm:text-xs text-ink-400 mt-1 leading-relaxed">
                Letterboxd, Trakt ve IMDb CSV dosyalarını tarayıcında okuyup Sinevia’ya aktar. İzlenenler geçmişe, izleme listen kataloğa eklenir.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={enriching || phase === 'importing'}
            className="p-2 rounded-xl text-ink-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            aria-label="Kapat"
          >
            <X size={20} />
          </button>
        </div>

        {/* Adım göstergesi */}
        <div className="px-5 sm:px-7 py-3 flex items-center gap-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-ink-500 border-b" style={{ borderColor: PREMIUM_LINE_SOFT }}>
          {[
            { key: 'select', label: '1 · Dosya' },
            { key: 'preview', label: '2 · Önizleme' },
            { key: 'done', label: '3 · Tamam' },
          ].map((step) => {
            const active = phase === step.key || (step.key === 'preview' && (phase === 'parsing' || phase === 'importing'));
            return (
              <span
                key={step.key}
                className={`px-2.5 py-1 rounded-full border transition-colors ${active ? 'text-white' : ''}`}
                style={{ borderColor: active ? 'rgba(232,56,79,.45)' : PREMIUM_LINE_SOFT, background: active ? 'rgba(232,56,79,.12)' : 'transparent' }}
              >
                {step.label}
              </span>
            );
          })}
          <span className="ml-auto normal-case tracking-normal text-ink-500">Veriler cihazından çıkmaz</span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5">
          {phase === 'select' && (
            <div className="space-y-5">
              <div
                onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className="rounded-2xl border-2 border-dashed p-7 sm:p-10 text-center transition-colors cursor-pointer"
                style={{
                  borderColor: dragActive ? 'rgba(232,56,79,.75)' : PREMIUM_LINE,
                  background: dragActive ? 'rgba(232,56,79,.08)' : 'rgba(255,255,255,.02)',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-14 h-14 mx-auto rounded-2xl grid place-items-center mb-4" style={{ background: 'rgba(232,56,79,.12)', border: `1px solid ${PREMIUM_LINE}` }}>
                  <Upload size={25} className={dragActive ? 'text-[var(--red,#e8384f)]' : 'text-ink-400'} />
                </div>
                <p className="text-sm sm:text-base font-bold text-white">
                  CSV dosyalarını sürükle veya <span className="text-[var(--red,#e8384f)]">bilgisayarından seç</span>
                </p>
                <p className="text-[11px] sm:text-xs text-ink-500 mt-2">
                  Birden fazla dosya seçebilirsin. Örneğin Letterboxd’dan <b>diary.csv</b> + <b>ratings.csv</b> + <b>watchlist.csv</b> birlikte.
                </p>
                <p className="text-[10px] text-ink-600 mt-1">Maksimum boyut yok · İşlem tamamen yerel · Sunucuya yüklenmez</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                multiple
                className="hidden"
                onChange={(event) => { if (event.target.files) void addFiles(event.target.files); }}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['letterboxd', 'trakt', 'imdb'] as ImportSource[]).map((source) => {
                  const meta = SOURCE_META[source];
                  const Icon = meta.icon;
                  const help = source === 'letterboxd'
                    ? ['diary.csv / ratings.csv / watched.csv', '5 yıldız → 10 puan']
                    : source === 'trakt'
                      ? ['history.csv / ratings.csv', 'tmdb_id doğrudan kullanılır']
                      : ['ratings.csv', 'Const alanı IMDb ID olarak alınır'];
                  return (
                    <div key={source} className="p-3.5" style={ROW_STYLE}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: meta.bg, color: meta.color }}>
                          <Icon size={15} />
                        </span>
                        <span className="text-xs font-black text-white">{meta.label}</span>
                      </div>
                      {help.map((line) => (
                        <p key={line} className="text-[10px] text-ink-500 leading-relaxed">{line}</p>
                      ))}
                    </div>
                  );
                })}
              </div>

              {errors.length > 0 && <ErrorList errors={errors} />}

              <div className="rounded-xl px-3.5 py-3 text-[11px] text-ink-400 leading-relaxed" style={{ background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.18)' }}>
                <b className="text-amber-300">Puanı olan izlenenler</b> Eskiden İzlenenler’e taşınır; <b className="text-amber-300">puanı olmayanlar ve izleme listesi</b> Filmler/Diziler kataloğuna izlenecek olarak eklenir. Kütüphanede zaten olan kayıtlar çoğaltılmaz. Uygun geçmiş/katalog başarımları hesaplanır; günlük/haftalık görevler ve sözleşmeler etkilenmez.
              </div>
            </div>
          )}

          {phase === 'parsing' && (
            <div className="py-16 text-center">
              <Loader2 size={34} className="animate-spin mx-auto text-[var(--red,#e8384f)]" />
              <p className="text-sm font-bold text-white mt-4">CSV dosyaları okunuyor…</p>
              <p className="text-xs text-ink-500 mt-1">Tüm işlem tarayıcında, senin cihazında yapılıyor.</p>
            </div>
          )}

          {phase === 'preview' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {parsedFiles.map((file) => {
                  const meta = file.source !== 'unknown' ? SOURCE_META[file.source] : null;
                  return (
                    <span key={`${file.name}-${file.rowCount}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ background: meta?.bg || 'rgba(255,255,255,.05)', color: meta?.color || '#cbd5e1', border: `1px solid ${PREMIUM_LINE_SOFT}` }}>
                      <FileText size={11} /> {file.name}
                      <span className="opacity-60">· {file.rowCount} satır</span>
                    </span>
                  );
                })}
                <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-ink-300 hover:text-white transition-colors" style={{ border: `1px solid ${PREMIUM_LINE}` }}>
                  <Upload size={11} /> Dosya ekle
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  multiple
                  className="hidden"
                  onChange={(event) => { if (event.target.files) void addFiles(event.target.files); }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <StatCard label="Toplam" value={counts.total} color="#f4f4f2" />
                <StatCard label="İzlenen" value={counts.total - counts.watchlist - counts.error} color="#a5b4fc" />
                <StatCard label="İzlenecek" value={counts.watchlist} color="#5eead4" />
                <StatCard label="Eşleşti" value={counts.matched} color="#6ee7b7" />
                <StatCard label="Kontrol" value={counts.review} color="#fcd34d" />
              </div>

              {warning && (
                <div className="rounded-xl px-3 py-2.5 text-[11px] text-amber-200" style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)' }}>
                  {warning}
                </div>
              )}

              {enriching && progress && (
                <div className="rounded-xl px-3.5 py-3" style={{ background: 'rgba(56,189,248,.06)', border: '1px solid rgba(56,189,248,.18)' }}>
                  <div className="flex items-center justify-between mb-2 text-[11px]">
                    <span className="text-sky-200 font-bold inline-flex items-center gap-1.5"><Sparkles size={13} /> TMDB ile eşleştiriliyor</span>
                    <span className="text-ink-400">{progress.done} / {progress.total} · %{progressPercent}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg,#38bdf8,#a78bfa)' }} />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,.035)', border: `1px solid ${PREMIUM_LINE_SOFT}` }}>
                  {([
                    { key: 'all', label: `Tümü ${counts.total}` },
                    { key: 'matched', label: `Eşleşen ${counts.matched}` },
                    { key: 'review', label: `Kontrol ${counts.review}` },
                    { key: 'error', label: `Hata ${counts.error}` },
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setFilter(tab.key)}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-colors ${filter === tab.key ? 'text-white' : 'text-ink-500 hover:text-ink-200'}`}
                      style={filter === tab.key ? { background: 'rgba(232,56,79,.16)', border: '1px solid rgba(232,56,79,.28)' } : undefined}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[150px] flex-1 sm:max-w-[220px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Başlıkta ara…"
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder:text-ink-600 outline-none focus:border-[var(--red,#e8384f)]"
                    style={{ background: 'var(--bg-base, #0a0a0d)', border: `1px solid ${PREMIUM_LINE}` }}
                  />
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <button onClick={toggleVisible} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[10px] font-bold text-ink-300" style={{ border: `1px solid ${PREMIUM_LINE}` }}>
                    <CheckSquare size={13} /> Görünenleri Seç
                  </button>
                  {!enriching && (
                    <button onClick={() => void handleEnrich()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold text-sky-200" style={{ background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.25)' }}>
                      <Sparkles size={13} /> TMDB ile Eşleştir
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[43vh] overflow-y-auto space-y-2 pr-1">
                {filteredDrafts.length === 0 && (
                  <div className="py-10 text-center text-xs text-ink-500">Bu filtreye uygun kayıt yok.</div>
                )}
                {filteredDrafts.map((draft) => (
                  <DraftRow
                    key={draft.id}
                    draft={draft}
                    selected={selected.has(draft.id)}
                    libraryMatch={libraryMatches.get(draft.id)}
                    onToggle={() => toggleDraft(draft)}
                  />
                ))}
              </div>

              {errors.length > 0 && <ErrorList errors={errors} />}
            </div>
          )}

          {phase === 'importing' && (
            <div className="py-16 text-center">
              <Loader2 size={34} className="animate-spin mx-auto text-[var(--red,#e8384f)]" />
              <p className="text-sm font-bold text-white mt-4">Kütüphanene aktarılıyor…</p>
              <p className="text-xs text-ink-500 mt-1">
                Afiş ve TMDB verileri tamamlanıyor; ardından izlenenler geçmişe, izlenecekler kataloğa ekleniyor.
              </p>
              {progress && progress.total > 0 && (
                <div className="max-w-sm mx-auto mt-4">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg,#38bdf8,#a78bfa)' }} />
                  </div>
                  <p className="text-[10px] text-ink-500 mt-2">{progress.done} / {progress.total} · %{progressPercent}</p>
                </div>
              )}
            </div>
          )}

          {phase === 'done' && (
            <div className="py-8 sm:py-10 text-center">
              <div className="w-16 h-16 mx-auto rounded-3xl grid place-items-center mb-4" style={{ background: 'rgba(16,185,129,.13)', border: '1px solid rgba(16,185,129,.32)' }}>
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-xl font-black text-white">Aktarım tamamlandı</h3>
              <p className="text-xs text-ink-400 mt-2">
                {summary.movies} izlenen film, {summary.series} izlenen dizi, {summary.watchlist} izleme listesi kaydı ve {summary.history} izleme geçmişi işlendi.
              </p>

              <div className="max-w-md mx-auto mt-5 rounded-2xl p-4 text-left" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,.12), rgba(232,56,79,.07))', border: '1px solid rgba(245,158,11,.25)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: 'rgba(245,158,11,.18)', color: '#fcd34d' }}>
                    <Sparkles size={19} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-amber-200">Büyük Göç · Başarım Açıldı</p>
                    <p className="text-[11px] text-ink-400 mt-0.5">Harici bir kaynaktan koleksiyon aktardın.</p>
                    <p className="text-[10px] text-amber-300/80 mt-1">+100 XP · Geçmiş izleme ve katalog ekleme başarımları da hesaplandı. Görevler etkilenmedi.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2.5 mt-6">
                <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold" style={BTN_P_STYLE}>Kapat</button>
                <button onClick={resetWizard} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-ink-200" style={BTN_S_STYLE}>
                  <RotateCcw size={15} /> Yeni Aktarım
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Alt eylem çubuğu */}
        {(phase === 'preview' || phase === 'importing') && (
          <div className="px-5 sm:px-7 py-4 border-t flex flex-wrap items-center gap-3" style={{ borderColor: PREMIUM_LINE_SOFT, background: 'rgba(255,255,255,.015)' }}>
            <div className="text-[11px] text-ink-400">
              <b className="text-white">{selectedCount}</b> kayıt seçili
              {listedCount > 0 && <span className="text-sky-300"> · {listedCount} kayıt kütüphanede/listede</span>}
              {counts.error > 0 && <span className="text-rose-300"> · {counts.error} hatalı kayıt atlanacak</span>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={resetWizard} disabled={enriching || phase === 'importing'} className="px-3.5 py-2.5 text-xs font-bold text-ink-300 disabled:opacity-40" style={BTN_S_STYLE}>
                Baştan Başla
              </button>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0 || enriching || phase === 'importing'}
                className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                style={BTN_P_STYLE}
              >
                {phase === 'importing' ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {selectedCount} Kaydı Aktar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="px-3 py-2.5" style={ROW_STYLE}>
      <p className="text-[9px] uppercase tracking-wider font-bold text-ink-500">{label}</p>
      <p className="text-lg font-black leading-tight" style={{ color }}>{value}</p>
    </div>
  );
}

function ErrorList({ errors }: { errors: string[] }) {
  return (
    <div className="rounded-xl px-3 py-2.5 space-y-1" style={{ background: 'rgba(244,63,94,.06)', border: '1px solid rgba(244,63,94,.18)' }}>
      {errors.slice(0, 6).map((error) => (
        <p key={error} className="text-[10px] text-rose-200 leading-relaxed">• {error}</p>
      ))}
      {errors.length > 6 && <p className="text-[10px] text-rose-300/70">… ve {errors.length - 6} uyarı daha</p>}
    </div>
  );
}

function DraftRow({
  draft,
  selected,
  libraryMatch,
  onToggle,
}: {
  draft: ImportDraft;
  selected: boolean;
  libraryMatch?: LibraryMatch;
  onToggle: () => void;
}) {
  const source = SOURCE_META[draft.source];
  const status = STATUS_META[draft.status];
  const SourceIcon = source.icon;
  const StatusIcon = status.icon;
  const tmdbUrl = draft.tmdbId ? `https://www.themoviedb.org/${draft.mediaType === 'series' ? 'tv' : 'movie'}/${draft.tmdbId}` : null;
  const letterboxdUrl = draft.sourceRef?.startsWith('letterboxd:http') ? draft.sourceRef.slice('letterboxd:'.length) : null;
  const movingToPast = Boolean(libraryMatch && !libraryMatch.watched && !libraryMatch.isPastWatch && draft.intent === 'watched');
  const libraryLabel = libraryMatch
    ? libraryMatch.isPastWatch
      ? 'Kütüphanede · Eskiden İzlenenler'
      : libraryMatch.watched
        ? 'Kütüphanede · izlenmiş'
        : movingToPast
          ? 'Listede · geçmişe taşınacak'
          : 'Listede · zaten var'
    : null;

  return (
    <div
      className={`px-2.5 sm:px-3 py-2.5 flex items-start gap-2.5 transition-colors ${draft.status === 'error' ? 'opacity-70' : 'hover:bg-white/[.035]'}`}
      style={{ ...ROW_STYLE, borderColor: selected ? 'rgba(232,56,79,.32)' : PREMIUM_LINE_SOFT }}
    >
      <button
        onClick={onToggle}
        disabled={draft.status === 'error'}
        className="mt-1.5 flex-shrink-0 text-[var(--red,#e8384f)] disabled:text-ink-600"
        aria-label={selected ? 'Seçimi kaldır' : 'Seç'}
      >
        {selected ? <CheckSquare size={18} /> : <Square size={18} />}
      </button>

      <div className="w-10 h-14 sm:w-11 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 grid place-items-center" style={{ background: 'rgba(255,255,255,.045)', border: `1px solid ${PREMIUM_LINE_SOFT}` }}>
        {draft.posterUrl ? (
          <img src={draft.posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={handleImgFallback} />
        ) : draft.mediaType === 'series' ? <Tv size={17} className="text-ink-600" /> : <Film size={17} className="text-ink-600" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-xs sm:text-sm font-bold text-white truncate max-w-full">{draft.title}</p>
          {draft.year && <span className="text-[10px] text-ink-500">{draft.year}</span>}
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: source.bg, color: source.color }}>
            <SourceIcon size={9} /> {source.label}
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-ink-300" style={{ background: 'rgba(255,255,255,.06)' }}>
            {draft.mediaType === 'series' ? <Tv size={9} /> : <Film size={9} />}
            {draft.mediaType === 'series' ? 'Dizi' : 'Film'}
          </span>
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
            style={draft.intent === 'watchlist'
              ? { background: 'rgba(20,184,166,.14)', color: '#5eead4' }
              : { background: 'rgba(165,180,252,.14)', color: '#a5b4fc' }}
          >
            {draft.intent === 'watchlist' ? <Bookmark size={9} /> : <Eye size={9} />}
            {draft.intent === 'watchlist' ? 'İzlenecek' : 'İzlendi'}
          </span>
          {libraryLabel && (
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-bold"
              style={movingToPast
                ? { background: 'rgba(245,158,11,.14)', color: '#fcd34d' }
                : { background: 'rgba(56,189,248,.12)', color: '#7dd3fc' }}
            >
              {libraryLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] text-ink-400">
          {draft.intent === 'watchlist' ? (
            <span className="inline-flex items-center gap-1"><Bookmark size={10} className="text-teal-300" /> Kataloğa eklenecek</span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1"><Star size={10} className="text-amber-300" /> {ratingLabel(draft.rating)}</span>
              <span className="inline-flex items-center gap-1"><Calendar size={10} /> {formatDate(draft.watchedAt)}</span>
              <span className="inline-flex items-center gap-1"><Clock size={10} /> {draft.watches.length} izleme</span>
            </>
          )}
          {draft.runtime ? <span>{draft.runtime} dk</span> : null}
          {draft.episodeRuntime ? <span>{draft.episodeRuntime} dk/bölüm</span> : null}
          {draft.intent === 'watchlist' && draft.seasonCounts?.length ? <span>{draft.seasonCounts.length} sezon</span> : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: status.bg, color: status.color }}>
            <StatusIcon size={9} /> {status.label}
          </span>
          <span className="text-[9px] text-ink-500 truncate">{draft.reason}</span>
          {tmdbUrl && (
            <a href={tmdbUrl} target="_blank" rel="noreferrer" className="text-[9px] text-sky-300 hover:text-sky-200 inline-flex items-center gap-0.5">
              <Link2 size={9} /> TMDB
            </a>
          )}
          {letterboxdUrl && (
            <a href={letterboxdUrl} target="_blank" rel="noreferrer" className="text-[9px] text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-0.5">
              <Link2 size={9} /> Letterboxd
            </a>
          )}
        </div>
      </div>

      {selected && <Check size={15} className="text-[var(--red,#e8384f)] flex-shrink-0 mt-1.5" />}
    </div>
  );
}
