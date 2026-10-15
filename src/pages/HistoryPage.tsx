import { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Film,
  Tv,
  StickyNote,
  Clock,
  Search,
  Star as StarIcon,
  Edit2,
  Calendar,
  Eye,
  Sparkles,
  LayoutList,
  LayoutGrid,
  Flame,
  SlidersHorizontal,
  Quote,
  Award,
  Tag,
  History,
  Skull,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass, formatDateTime, formatDateShort } from '../lib/utils';
import RatingModal from '../components/RatingModal';
import MediaDetailModal from '../components/MediaDetailModal';
import type { DetailModalTarget } from '../components/MediaDetailModal';
import type { WatchHistoryItem, Movie, Series } from '../types';
import { handleImgFallback } from '../lib/selectors';
import { useFilteredHistory } from '../lib/selectorHooks';

type SortMode = 'newest' | 'oldest' | 'rating';
type FilterType = 'all' | 'movie' | 'series';
type ViewMode = 'timeline' | 'grid' | 'past';

/* Premium tokenlar yalnızca premium-dark temasında tanımlı; plain-dark gibi
   diğer temalarda fallback taban değişkenlere düşer (var(--r, 16px), var(--red, var(--color-1, #e8384f)), var(--glass, var(--bg-card))). */

/* Premium tokenlar yalnızca premium-dark temasında tanımlı; plain-dark gibi
   diğer temalarda fallback taban değişkenlere düşer (var(--x, var(--y))). */
const monoLabel = 'text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--red-hi,var(--color-1))]';

const accent = 'var(--red, var(--color-1, #e8384f))';

export default function HistoryPage() {
  const { data, updateHistoryRating } = useApp();
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<WatchHistoryItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<DetailModalTarget | null>(null);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [onlyWithNotes, setOnlyWithNotes] = useState(false);
  const [onlyHighRated, setOnlyHighRated] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  const isItemPastWatch = (h: WatchHistoryItem): boolean => {
    if (h.isPastWatch) return true;
    if (h.kind === 'movie' || h.type === 'movie') {
      const m = data.movies.find((x) => x.id === (h.itemId || h.id));
      if (m?.isPastWatch) return true;
    }
    return false;
  };

  const regularHistory = useMemo(
    () => data.history.filter((h) => !isItemPastWatch(h)),
    [data.history, data.movies]
  );

  const pastHistory = useMemo(
    () => data.history.filter((h) => isItemPastWatch(h)),
    [data.history, data.movies]
  );

  const activeBaseHistory = viewMode === 'past' ? pastHistory : regularHistory;

  const usedReviewTags = useMemo(() => {
    const set = new Set<string>();
    activeBaseHistory.forEach((h) => (h.reviewTags || []).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [activeBaseHistory]);

  const activeFilterCount =
    (search.trim() !== '' ? 1 : 0) +
    (viewMode !== 'past' && filterType !== 'all' ? 1 : 0) +
    (onlyWithNotes ? 1 : 0) +
    (onlyHighRated ? 1 : 0) +
    (selectedTagFilter ? 1 : 0) +
    (sortMode !== 'newest' ? 1 : 0);

  const resetAllFilters = () => {
    setSearch('');
    setFilterType('all');
    setOnlyWithNotes(false);
    setOnlyHighRated(false);
    setSelectedTagFilter(null);
    setSortMode('newest');
  };

  // Günlük Özet İstatistikleri
  const diaryStats = useMemo(() => {
    const total = regularHistory.length;
    const movies = regularHistory.filter((h) => h.kind === 'movie' || h.type === 'movie').length;
    const episodes = total - movies;
    const withNotes = regularHistory.filter((h) => h.note && h.note.trim().length > 0).length;
    const uniqueDays = new Set(
      regularHistory.map((h) => (h.watchedAt ? h.watchedAt.slice(0, 10) : '')).filter(Boolean)
    ).size;
    const rated = regularHistory.filter((h) => h.rating !== null);
    const avgRating =
      rated.length > 0
        ? (rated.reduce((sum, h) => sum + (h.rating || 0), 0) / rated.length).toFixed(1)
        : '-';

    return { total, movies, episodes, withNotes, uniqueDays, avgRating };
  }, [regularHistory]);

  const processedItems = useFilteredHistory(
    activeBaseHistory, viewMode, filterType, onlyWithNotes, onlyHighRated, selectedTagFilter, search, sortMode
  );

  const seriesGroups = new Map<string, WatchHistoryItem[]>();
  processedItems
    .filter((h) => h.kind === 'series' || h.type === 'series')
    .forEach((h) => {
      const sid = h.seriesId || h.itemId || h.id;
      const arr = seriesGroups.get(sid) || [];
      arr.push(h);
      seriesGroups.set(sid, arr);
    });

  const latestPerSeries = new Map<string, WatchHistoryItem>();
  processedItems
    .filter((h) => h.kind === 'series' || h.type === 'series')
    .forEach((h) => {
      const sid = h.seriesId || h.itemId || h.id;
      const existing = latestPerSeries.get(sid);
      if (!existing || new Date(h.watchedAt) > new Date(existing.watchedAt)) {
        latestPerSeries.set(sid, h);
      }
    });

  const displayItems: { type: 'movie' | 'series'; item: WatchHistoryItem; seriesId?: string }[] = [];
  const seenSeries = new Set<string>();

  for (const item of processedItems) {
    if (item.kind === 'movie' || item.type === 'movie') {
      displayItems.push({ type: 'movie', item });
    } else {
      const sid = item.seriesId || item.itemId || hIdFallback(item);
      if (!seenSeries.has(sid)) {
        seenSeries.add(sid);
        const latest = latestPerSeries.get(sid)!;
        displayItems.push({ type: 'series', item: latest, seriesId: sid });
      }
    }
  }

  function hIdFallback(item: WatchHistoryItem) {
    return item.seriesId || item.itemId || item.id;
  }

  const groupedByDate = new Map<
    string,
    { type: 'movie' | 'series'; item: WatchHistoryItem; seriesId?: string }[]
  >();
  displayItems.forEach((d) => {
    const dateKey = new Date(d.item.watchedAt).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      weekday: 'long',
    });
    const arr = groupedByDate.get(dateKey) || [];
    arr.push(d);
    groupedByDate.set(dateKey, arr);
  });

  const toggleSeries = (sid: string) => {
    setExpandedSeries((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const toggleNoteExpand = (id: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openMovieDetail = (item: WatchHistoryItem, movieData?: Movie) => {
    const fallbackMovie: Movie = movieData || {
      id: item.itemId || item.id,
      title: item.title,
      year: item.year || '',
      genres: item.genres || [],
      collectionId: null,
      watched: true,
      isPastWatch: item.isPastWatch,
      rating: item.rating,
      detailedRating: item.detailedRating,
      reviewTags: item.reviewTags,
      note: item.note,
      watchedAt: item.watchedAt,
      addedAt: item.watchedAt,
    };
    setDetailTarget({ type: 'movie', data: fallbackMovie, historyItem: item });
  };

  const openSeriesDetail = (item: WatchHistoryItem, seriesData?: Series) => {
    const fallbackSeries: Series = seriesData || {
      id: item.seriesId || item.itemId || item.id,
      title: item.title,
      year: item.year,
      genres: item.genres || [],
      episodes: [],
      addedAt: item.watchedAt,
    };
    setDetailTarget({ type: 'series', data: fallbackSeries, historyItem: item });
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* 1. BAŞLIK — KATALOG MASTHEAD */}
      <div className="relative overflow-hidden rounded-2xl border border-[color:var(--line-2,var(--border-dim))] bg-[color:var(--glass, var(--bg-card))] shadow-[var(--shadow,0_1px_3px_rgba(0,0,0,0.25))] p-4 sm:p-5">
        <div className="absolute inset-x-4 sm:inset-x-6 -bottom-px h-px bg-gradient-to-r from-[color:var(--red, var(--color-1, #e8384f))] via-[color:var(--red-hi,var(--color-2))] to-transparent opacity-70" />
        <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[color:var(--red, var(--color-1, #e8384f))] to-[color:var(--red-deep,var(--color-3))] border border-[color:var(--line-2,var(--border-dim))] flex items-center justify-center shadow-[0_8px_22px_-8px_var(--red, var(--color-1, #e8384f))]">
              <Clock size={20} className="text-white" />
            </div>
            <div>
              <div className={`${monoLabel} text-[color:var(--red-hi,var(--color-1))] mb-0.5`}>Kayıt Defteri</div>
              <h1 className="text-2xl sm:text-3xl font-black text-ink-100 uppercase tracking-tight leading-none">
                Sinema Günlüğü & Geçmiş
              </h1>
              <p className="hidden sm:block text-[11px] font-medium text-ink-400 mt-1">
                İzlediğin tüm yapımların kronolojik zaman tüneli ve inceleme arşivin
              </p>
            </div>
          </div>
          {data.history.length > 0 && (
            <div className="flex items-center gap-2">
              <span className={`${monoLabel} text-ink-400`}>Arşiv</span>
              <span className="text-lg font-black text-ink-50 tabular-nums leading-none">
                {String(data.history.length).padStart(3, '0')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. SİNEMA GÜNLÜĞÜ ÖZET — MONO SAYAÇ BANDI */}
      {data.history.length > 0 && (
        <div
          data-tutorial="history-stats"
          className="grid grid-cols-2 sm:grid-cols-5 rounded-2xl overflow-hidden border border-[color:var(--line-2,var(--border-dim))] bg-[color:var(--glass, var(--bg-card))] shadow-[var(--shadow,0_1px_3px_rgba(0,0,0,0.25))]"
        >
          <StatCell icon={<Sparkles size={15} className="text-[color:var(--red-hi,var(--color-1))]" />} value={diaryStats.total} label="Toplam Kayıt" accent />
          <StatCell icon={<Film size={15} className="text-amber-400" />} value={diaryStats.movies} label="İzlenen Film" />
          <StatCell icon={<Tv size={15} className="text-azure-400" />} value={diaryStats.episodes} label="Dizi Bölümü" />
          <StatCell icon={<StickyNote size={15} className="text-emerald-400" />} value={diaryStats.withNotes} label="İnceleme" />
          <StatCell
            icon={<Calendar size={15} className="text-violet-400" />}
            value={diaryStats.uniqueDays}
            label="Aktif Gün & Ort."
            suffix={<span className="text-[color:var(--red-hi,var(--color-1))]">★{diaryStats.avgRating}</span>}
            className="col-span-2 sm:col-span-1"
          />
        </div>
      )}

      {/* 3. GÖRÜNÜM SEÇİCİ SEKMELER & ARAMA/FİLTRE BUTONU */}
      {data.history.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div
              data-tutorial="history-views"
              className="grid grid-cols-3 sm:flex items-center bg-[color:var(--surface,var(--bg-surface))] border border-[color:var(--line-2,var(--border-dim))] rounded-xl p-1 gap-1 backdrop-blur-md"
            >
              <ViewTab
                active={viewMode === 'timeline'}
                onClick={() => setViewMode('timeline')}
                icon={<LayoutList size={13} className="flex-shrink-0" />}
                label="Zaman Tüneli"
              />
              <ViewTab
                active={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
                icon={<LayoutGrid size={13} className="flex-shrink-0" />}
                label="Poster Vitrini"
              />
              <ViewTab
                active={viewMode === 'past'}
                onClick={() => setViewMode('past')}
                icon={<History size={13} className="flex-shrink-0" />}
                label={`Önceden (${pastHistory.length})`}
                accent="violet"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsFilterPanelOpen((prev) => !prev)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 min-h-11 sm:min-h-0 rounded-xl text-xs font-bold border transition-all ${
                  isFilterPanelOpen || activeFilterCount > 0
                    ? 'bg-[color:var(--surface2,var(--bg-card))] text-[color:var(--red-hi,var(--color-1))] border-[color:var(--red, var(--color-1, #e8384f))]/40 shadow-[0_0_18px_-6px_var(--red, var(--color-1, #e8384f))]'
                    : 'bg-[color:var(--surface,var(--bg-surface))] hover:bg-[color:var(--surface2,var(--bg-card))] text-ink-300 border-[color:var(--line-2,var(--border-dim))]'
                }`}
              >
                <SlidersHorizontal size={14} className="text-[color:var(--red-hi,var(--color-1))]" />
                <span className="uppercase tracking-wider">Ara & Filtrele</span>
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[color:var(--red, var(--color-1, #e8384f))] text-white text-[10px] font-black tabular-nums">
                    {activeFilterCount}
                  </span>
                )}
                {isFilterPanelOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  title="Filtreleri sıfırla"
                  className="p-2 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-bold transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* AÇILIR/KAPANIR ARAMA VE FİLTRE MERKEZİ */}
          {isFilterPanelOpen && (
            <div className="bg-[color:var(--glass, var(--bg-card))] backdrop-blur-md border border-[color:var(--line-2,var(--border-dim))] rounded-2xl p-3 sm:p-4 space-y-3 shadow-[var(--shadow,0_1px_3px_rgba(0,0,0,0.25))] animate-fade-in">
              <div className="relative group">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted,#9a9a96)] group-focus-within:text-[color:var(--red,var(--color-1,#e8384f))] transition-colors" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Yapım adı, başlık, tür veya inceleme notu ara..."
                  className="w-full h-11 bg-[color:var(--bg-surface,#12121a)] border border-[color:var(--line,var(--border-dim))] rounded-xl pl-9 pr-8 text-xs sm:text-sm text-[color:var(--text-main,#f4f4f2)] placeholder:text-[color:var(--muted,#9a9a96)] focus:outline-none focus:border-[color:var(--red,var(--color-1,#e8384f))] focus:ring-1 focus:ring-[color:var(--red,var(--color-1,#e8384f))] transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted,#9a9a96)] hover:text-[color:var(--red,var(--color-1,#e8384f))] p-1 min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {viewMode !== 'past' && (
                    <div className="flex bg-[color:var(--surface,var(--bg-surface))] rounded-xl p-1 border border-[color:var(--line-2,var(--border-dim))]">
                      <FilterChip active={filterType === 'all'} onClick={() => setFilterType('all')}>
                        Tümü
                      </FilterChip>
                      <FilterChip
                        active={filterType === 'movie'}
                        onClick={() => setFilterType('movie')}
                        icon={<Film size={12} />}
                      >
                        Filmler
                      </FilterChip>
                      <FilterChip
                        active={filterType === 'series'}
                        onClick={() => setFilterType('series')}
                        icon={<Tv size={12} />}
                      >
                        Diziler
                      </FilterChip>
                    </div>
                  )}

                  <ToggleChip active={onlyWithNotes} onClick={() => setOnlyWithNotes(!onlyWithNotes)} icon={<StickyNote size={12} />}>
                    Notlular
                  </ToggleChip>

                  <ToggleChip active={onlyHighRated} onClick={() => setOnlyHighRated(!onlyHighRated)} icon={<Flame size={12} />}>
                    8.5+
                  </ToggleChip>
                </div>

                <div className="flex bg-[color:var(--surface,var(--bg-surface))] rounded-xl p-1 border border-[color:var(--line-2,var(--border-dim))]">
                  <SortChip active={sortMode === 'newest'} onClick={() => setSortMode('newest')} icon={<Clock size={11} />}>
                    En Yeni
                  </SortChip>
                  <SortChip active={sortMode === 'oldest'} onClick={() => setSortMode('oldest')}>
                    En Eski
                  </SortChip>
                  <SortChip active={sortMode === 'rating'} onClick={() => setSortMode('rating')} icon={<StarIcon size={11} />}>
                    Puan
                  </SortChip>
                </div>
              </div>

              {usedReviewTags.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pt-2 border-t border-[color:var(--line,var(--border-dim))]">
                  <span className={`${monoLabel} text-ink-400 flex items-center gap-1 mr-1 flex-shrink-0`}>
                    <Tag size={11} className="text-[color:var(--red-hi,var(--color-1))]" /> Başlıklar:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedTagFilter(null)}
                    className={`flex-shrink-0 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 min-h-9 sm:min-h-0 rounded-lg border transition-all ${
                      selectedTagFilter === null
                        ? 'bg-[color:var(--red, var(--color-1, #e8384f))] text-white border-[color:var(--red, var(--color-1, #e8384f))]'
                        : 'bg-[color:var(--surface,var(--bg-surface))] text-ink-400 border-[color:var(--line-2,var(--border-dim))] hover:text-ink-200'
                    }`}
                  >
                    Tümü
                  </button>
                  {usedReviewTags.map((tag) => {
                    const active = selectedTagFilter === tag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSelectedTagFilter(active ? null : tag)}
                        className={`flex-shrink-0 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 min-h-9 sm:min-h-0 rounded-lg border transition-all ${
                          active
                            ? 'bg-[color:var(--red, var(--color-1, #e8384f))] text-white border-[color:var(--red, var(--color-1, #e8384f))] shadow-[0_0_16px_-4px_var(--red, var(--color-1, #e8384f))]'
                            : 'bg-[color:var(--surface,var(--bg-surface))] text-ink-300 border-[color:var(--line-2,var(--border-dim))] hover:border-[color:var(--red, var(--color-1, #e8384f))]/40'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. İÇERİK ALANI */}
      {displayItems.length === 0 ? (
        <div className="text-center py-14 bg-[color:var(--surface,var(--bg-surface))] border border-[color:var(--line-2,var(--border-dim))] rounded-3xl text-ink-500 px-4">
          <div className="w-14 h-14 rounded-2xl bg-[color:var(--surface2,var(--bg-card))] border border-[color:var(--line-2,var(--border-dim))] flex items-center justify-center mx-auto mb-3">
            {viewMode === 'past' ? (
              <History size={28} className="text-violet-400/70" />
            ) : (
              <Film size={28} className="text-ink-600" />
            )}
          </div>
          <p className="text-base sm:text-lg font-bold text-ink-200">
            {viewMode === 'past'
              ? pastHistory.length === 0
                ? 'Daha önce izlediklerim kısmında henüz film yok.'
                : 'Aramaya ve filtrelere uygun kayıt bulunamadı.'
              : regularHistory.length === 0
              ? 'Henüz izlenen bir şey yok.'
              : 'Aramaya ve filtrelere uygun kayıt bulunamadı.'}
          </p>
          <p className="text-xs sm:text-sm mt-1">
            {viewMode === 'past'
              ? 'Bir filmi puanlarken "Önceden İzlendi" seçeneğini işaretlediğinde burada listelenir.'
              : regularHistory.length === 0
              ? 'Film veya dizi puanladıkça sinema günlüğün burada oluşacak.'
              : 'Filtreleri sıfırlamayı veya arama kelimesini değiştirmeyi dene.'}
          </p>
        </div>
      ) : viewMode === 'past' ? (
        <div className="space-y-3 sm:space-y-4 animate-fade-in">
          {displayItems.map(({ item }) => {
            const movieData = data.movies.find((m) => m.id === (item.itemId || item.id));
            return (
              <MovieHistoryCard
                key={item.id}
                item={item}
                movieData={movieData}
                criteriaList={data.criteria || []}
                isNoteExpanded={expandedNotes.has(item.id)}
                onToggleNote={() => toggleNoteExpand(item.id)}
                onEdit={() => setEditingItem(item)}
                onSelectDetail={() => openMovieDetail(item, movieData)}
              />
            );
          })}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 animate-fade-in">
          {displayItems.map(({ type, item, seriesId }) => {
            const isMovie = type === 'movie';
            const movieData = isMovie
              ? data.movies.find((m) => m.id === (item.itemId || item.id))
              : undefined;
            const seriesData = !isMovie
              ? data.series.find((s) => s.id === seriesId)
              : undefined;
            const posterUrl = isMovie ? movieData?.posterUrl : seriesData?.posterUrl;
            const epsCount = !isMovie && seriesId ? (seriesGroups.get(seriesId) || []).length : 0;
            // Sinematik Otopsi: item.abandoned yoksa itemId/seriesId lookup ile türetilir.
            const isDnf = Boolean(item.abandoned ?? (isMovie ? movieData?.abandoned : seriesData?.abandoned));

            return (
              <div
                key={isMovie ? item.id : seriesId}
                onClick={() =>
                  isMovie ? openMovieDetail(item, movieData) : openSeriesDetail(item, seriesData)
                }
                className="group relative flex flex-col bg-[color:var(--glass, var(--bg-card))] border border-[color:var(--line-2,var(--border-dim))] hover:border-[color:var(--red, var(--color-1, #e8384f))]/50 hover:shadow-[var(--glow)] rounded-2xl overflow-hidden shadow-[var(--shadow,0_1px_3px_rgba(0,0,0,0.25))] transition-all hover:-translate-y-1.5 cursor-pointer"
              >
                <div className="aspect-[2/3] w-full bg-[color:var(--surface,var(--bg-surface))] relative overflow-hidden">
                  {posterUrl ? (
                    <img loading="lazy" decoding="async"
                      src={posterUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                     onError={handleImgFallback}/>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-ink-600">
                      {isMovie ? <Film size={32} /> : <Tv size={32} />}
                    </div>
                  )}

                  <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border border-white/15 flex items-center gap-1">
                    {isMovie ? (
                      <><Film size={10} className="text-[color:var(--red-hi,var(--color-1))]" /> Film</>
                    ) : (
                      <><Tv size={10} className="text-azure-400" /> S{item.season} B{item.episode}</>
                    )}
                  </div>

                  {item.rating !== null && (
                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-xl text-xs font-black tabular-nums shadow-lg ${ratingBgClass(item.rating)}`}>
                      ★ {item.rating}
                    </div>
                  )}

                  <div className="absolute bottom-2 inset-x-2 flex items-center justify-between gap-1">
                    {item.note ? (
                      <span className="bg-emerald-500/90 text-ink-950 text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow">
                        <StickyNote size={9} /> Notlu
                      </span>
                    ) : (
                      <span />
                    )}
                    {!isMovie && epsCount > 1 && (
                      <span className="bg-azure-500/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow">
                        {epsCount} Böl.
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm text-ink-100 truncate group-hover:text-[color:var(--red-hi,var(--color-1))] transition-colors">
                      {item.title}
                    </h3>
                    {isDnf && (
                      <div className="mt-1 flex">
                        <DnfBadge />
                      </div>
                    )}
                    {item.reviewTags && item.reviewTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.reviewTags.slice(0, 2).map((t) => (
                          <span key={t} className="text-[9px] font-bold uppercase tracking-wider bg-[color:var(--blob-1,var(--color-1))] text-[color:var(--red-hi,var(--color-1))] border border-[color:var(--red, var(--color-1, #e8384f))]/30 px-1.5 py-0.5 rounded truncate">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.note && (
                      <p className="text-[10px] sm:text-[11px] text-ink-400 italic line-clamp-1 mt-1">
                        "{item.note}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-ink-500 font-semibold mt-2 pt-1.5 border-t border-[color:var(--line,var(--border-dim))]">
                    <span className="tabular-nums">{formatDateShort(item.watchedAt)}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItem(item);
                      }}
                      className="text-ink-400 hover:text-[color:var(--red-hi,var(--color-1))] p-1 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded transition-colors"
                      title="Puanı / Notu Düzenle"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="relative pl-2.5 sm:pl-6 space-y-6 sm:space-y-8">
          <div className="absolute left-0.5 sm:left-2.5 top-3 bottom-3 w-px bg-gradient-to-b from-[color:var(--red, var(--color-1, #e8384f))] via-[color:var(--line-2,var(--border-dim))] to-transparent pointer-events-none" />

          {Array.from(groupedByDate.entries()).map(([dateLabel, items]) => (
            <div key={dateLabel} className="relative animate-fade-in-up">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="absolute -left-[10px] sm:-left-[20px] w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[color:var(--bg-base,#0a0a0d)] border-2 border-[color:var(--red, var(--color-1, #e8384f))] shadow-[0_0_10px_var(--red, var(--color-1, #e8384f))]" />
                <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-[color:var(--surface2,var(--bg-card))] border border-[color:var(--line-2,var(--border-dim))] px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg backdrop-blur-md shadow-[var(--shadow,0_1px_3px_rgba(0,0,0,0.25))]">
                  <Calendar size={12} className="text-[color:var(--red-hi,var(--color-1))] flex-shrink-0" />
                  <span className={`${monoLabel} text-ink-100 truncate`}>{dateLabel}</span>
                  <span className="text-[10px] font-bold tabular-nums text-[color:var(--red-hi,var(--color-1))] bg-[color:var(--blob-1,var(--color-1))] px-1.5 py-0.5 rounded ml-0.5 flex-shrink-0">
                    {String(items.length).padStart(2, '0')}
                  </span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-[color:var(--line-2,var(--border-dim))] to-transparent" />
              </div>

              <div className="space-y-3 sm:space-y-4">
                {items.map(({ type, item, seriesId }) => {
                  if (type === 'movie') {
                    const movieData = data.movies.find((m) => m.id === (item.itemId || item.id));
                    return (
                      <MovieHistoryCard
                        key={item.id}
                        item={item}
                        movieData={movieData}
                        criteriaList={data.criteria || []}
                        isNoteExpanded={expandedNotes.has(item.id)}
                        onToggleNote={() => toggleNoteExpand(item.id)}
                        onEdit={() => setEditingItem(item)}
                        onSelectDetail={() => openMovieDetail(item, movieData)}
                      />
                    );
                  } else {
                    const sid = seriesId!;
                    const seriesData = data.series.find((s) => s.id === sid);
                    // Sinematik Otopsi: item.abandoned yoksa seriesId lookup ile türetilir.
                    const isDnf = Boolean(item.abandoned ?? seriesData?.abandoned);
                    const eps = (seriesGroups.get(sid) || []).sort((a, b) => {
                      if (sortMode === 'oldest')
                        return new Date(a.watchedAt).getTime() - new Date(b.watchedAt).getTime();
                      if (sortMode === 'rating') return (b.rating ?? -1) - (a.rating ?? -1);
                      return new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime();
                    });
                    const isExpanded = expandedSeries.has(sid);

                    const ratedEps = eps.filter((e) => e.rating !== null);
                    const avgEpRating =
                      ratedEps.length > 0
                        ? Math.round(
                            (ratedEps.reduce((s, e) => s + (e.rating || 0), 0) / ratedEps.length) * 10
                          ) / 10
                        : null;

                    return (
                      <div
                        key={sid}
                        className="relative bg-[color:var(--glass, var(--bg-card))] backdrop-blur-md border border-[color:var(--line-2,var(--border-dim))] hover:border-[color:var(--red, var(--color-1, #e8384f))]/40 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[var(--shadow,0_1px_3px_rgba(0,0,0,0.25))] transition-all group/series"
                      >
                        {seriesData?.posterUrl && (
                          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-15">
                            <img loading="lazy" decoding="async" src={seriesData.posterUrl} alt="" className="w-full h-full object-cover blur-3xl scale-125 saturate-150"  onError={handleImgFallback}/>
                            <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--bg-base,#0a0a0d)] via-[color:var(--bg-base,#0a0a0d)]/85 to-transparent" />
                          </div>
                        )}

                        <div
                          onClick={() => toggleSeries(sid)}
                          className="relative z-10 w-full flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3.5 sm:p-5 hover:bg-[color:var(--surface,var(--bg-surface))] transition-colors cursor-pointer"
                        >
                          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openSeriesDetail(item, seriesData);
                              }}
                              title="Dizi Sinema Kartını Gör"
                              className="flex-shrink-0 w-14 sm:w-20 aspect-[2/3] rounded-xl sm:rounded-2xl bg-[color:var(--surface,var(--bg-surface))] border-2 border-[color:var(--line-2,var(--border-dim))] group-hover/poster:border-[color:var(--red, var(--color-1, #e8384f))]/60 flex items-center justify-center overflow-hidden shadow-xl relative group/poster cursor-pointer transition-colors"
                            >
                              {seriesData?.posterUrl ? (
                                <img loading="lazy" decoding="async" src={seriesData.posterUrl} alt={item.title} className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300"  onError={handleImgFallback}/>
                              ) : (
                                <Tv size={22} className="text-ink-600" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`${monoLabel} inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[color:var(--blob-2,var(--color-2))] text-azure-300 border border-azure-500/30`}>
                                  <Tv size={10} /> Dizi
                                </span>
                                <span className="text-[11px] font-bold text-azure-300 bg-[color:var(--surface,var(--bg-surface))] border border-azure-500/30 px-2 py-0.5 rounded-lg">
                                  Son: S{item.season} B{item.episode}
                                </span>
                                {isDnf && <DnfBadge />}
                              </div>

                              <h3 className="text-base sm:text-xl font-bold text-ink-50 truncate mt-1 uppercase tracking-tight">
                                {item.title}
                              </h3>

                              <div className="flex items-center gap-2 flex-wrap text-[11px] sm:text-xs text-ink-300 mt-1 font-medium">
                                {seriesData?.year && <span className="tabular-nums">{seriesData.year}</span>}
                                {item.genres && item.genres.length > 0 && (
                                  <>
                                    <span className="text-ink-600">·</span>
                                    <span className="text-ink-400 truncate">{item.genres.slice(0, 3).join(', ')}</span>
                                  </>
                                )}
                              </div>

                              <div className="text-[11px] text-ink-400 mt-1.5 flex items-center gap-1 font-medium">
                                <Clock size={11} className="text-[color:var(--red-hi,var(--color-1))]" />
                                <span className="tabular-nums">{formatDateTime(item.watchedAt)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 pt-2.5 sm:pt-0 border-t border-[color:var(--line,var(--border-dim))] sm:border-0 flex-shrink-0">
                            <div className="flex items-center gap-1.5">
                              {item.rating !== null && (
                                <div className={`px-3 py-1 rounded-xl font-black text-sm sm:text-base shadow-lg flex items-center gap-1 tabular-nums ${ratingBgClass(item.rating)}`}>
                                  <StarIcon size={13} className="fill-current" />
                                  <span>{item.rating}</span>
                                </div>
                              )}
                              {avgEpRating !== null && eps.length > 1 && (
                                <div className="text-[11px] font-bold bg-[color:var(--surface,var(--bg-surface))] border border-[color:var(--line-2,var(--border-dim))] text-ink-300 px-2 py-1 rounded-xl tabular-nums">
                                  Ort: <strong className="text-azure-400">{avgEpRating}</strong>
                                </div>
                              )}
                            </div>

                            <div className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-azure-300 bg-[color:var(--blob-2,var(--color-2))] hover:bg-azure-500/25 border border-azure-500/30 px-2.5 py-1 rounded-xl transition-colors">
                              <span>{eps.length} Bölüm</span>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="relative z-10 border-t border-[color:var(--line,var(--border-dim))] bg-[color:var(--surface,var(--bg-surface))]/60 p-3 sm:p-4 space-y-2 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {eps.map((ep) => {
                                const isEpNoteExpanded = expandedNotes.has(ep.id);
                                return (
                                  <div
                                    key={ep.id}
                                    className="bg-[color:var(--glass, var(--bg-card))] border border-[color:var(--line-2,var(--border-dim))] hover:border-[color:var(--red, var(--color-1, #e8384f))]/40 hover:shadow-[var(--glow)] rounded-xl p-3 flex flex-col justify-between gap-2 transition-all"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => openSeriesDetail(ep, seriesData)}
                                          className="text-xs sm:text-sm font-black text-ink-100 hover:text-[color:var(--red-hi,var(--color-1))] transition-colors text-left flex items-center gap-1.5"
                                        >
                                          <span className="w-2 h-2 rounded-full bg-[color:var(--red, var(--color-1, #e8384f))]" />
                                          <span>{ep.season}. Sezon {ep.episode}. Bölüm</span>
                                        </button>
                                        <div className="text-[10px] text-ink-500 mt-0.5 flex items-center gap-1 tabular-nums">
                                          <Clock size={10} /> {formatDateTime(ep.watchedAt)}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {ep.rating !== null && (
                                          <span className={`text-xs px-2 py-0.5 rounded-lg font-black tabular-nums ${ratingBgClass(ep.rating)}`}>
                                            ★ {ep.rating}
                                          </span>
                                        )}
                                        <button
                                          onClick={() => setEditingItem(ep)}
                                          className="text-ink-400 hover:text-[color:var(--red-hi,var(--color-1))] bg-[color:var(--surface,var(--bg-surface))] p-1.5 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg border border-[color:var(--line-2,var(--border-dim))] transition-colors"
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                      </div>
                                    </div>

                                    {ep.reviewTags && ep.reviewTags.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {ep.reviewTags.map((t) => (
                                          <span key={t} className="text-[10px] font-bold uppercase tracking-wider bg-[color:var(--blob-2,var(--color-2))] text-azure-300 border border-azure-500/30 px-2 py-0.5 rounded-md">
                                            {t}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {ep.note && (
                                      <div
                                        onClick={() => toggleNoteExpand(ep.id)}
                                        className="bg-[color:var(--surface,var(--bg-surface))] hover:bg-[color:var(--surface2,var(--bg-card))] rounded-xl p-2 border-l-2 border-[color:var(--red, var(--color-1, #e8384f))] flex items-start gap-2 cursor-pointer transition-colors"
                                      >
                                        <Quote size={12} className="text-[color:var(--red-hi,var(--color-1))] flex-shrink-0 mt-0.5" />
                                        <p className={`text-xs text-ink-200 italic leading-relaxed flex-1 min-w-0 ${isEpNoteExpanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-1'}`}>
                                          {ep.note}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingItem && (
        <RatingModal
          title={editingItem.title}
          subtitle={
            editingItem.season != null
              ? `${editingItem.season}. Sezon ${editingItem.episode}. Bölüm (Puanı Düzenle)`
              : editingItem.year
              ? `Çıkış Yılı: ${editingItem.year} (Puanı Düzenle)`
              : 'Puanı Düzenle'
          }
          initialRating={editingItem.rating}
          initialNote={editingItem.note}
          initialDetailedRating={editingItem.detailedRating}
          initialReviewTags={editingItem.reviewTags}
          initialIsPastWatch={isItemPastWatch(editingItem)}
          allowPastWatch={editingItem.kind === 'movie' || editingItem.type === 'movie'}
          onRate={(rating, note, detailedRating, reviewTags, isPastWatch) => {
            updateHistoryRating(editingItem.id, rating, note, detailedRating, reviewTags, isPastWatch);
            setEditingItem(null);
          }}
          onClose={() => setEditingItem(null)}
        />
      )}

      {detailTarget && (
        <MediaDetailModal target={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  );
}

/* ---------- Küçük premium bileşenler ---------- */

function StatCell({
  icon,
  value,
  label,
  suffix,
  accent,
  className = '',
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  suffix?: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden p-3 sm:p-4 flex items-center gap-2.5 border-l border-t sm:border-t-0 first:border-l-0 [&:nth-child(odd)]:border-l-0 sm:[&:nth-child(odd)]:border-l transition-colors hover:bg-[color:var(--surface2,var(--bg-card))] ${className}`}
    >
      <div
        className={`w-9 h-9 rounded-lg border border-[color:var(--line-2,var(--border-dim))] bg-[color:var(--surface,var(--bg-surface))] flex items-center justify-center flex-shrink-0 ${
          accent ? 'shadow-[0_0_16px_-6px_var(--red, var(--color-1, #e8384f))]' : ''
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-lg sm:text-xl font-black text-ink-50 leading-none tabular-nums">
          {value}
          {suffix && <span className="text-xs font-bold ml-1">{suffix}</span>}
        </div>
        <div className={`${monoLabel} text-ink-400 mt-1 truncate`}>{label}</div>
      </div>
      <span className="absolute right-0 bottom-[-6px] font-black text-4xl text-[color:var(--ink,var(--text-main))] opacity-[0.04] select-none pointer-events-none">
        {value}
      </span>
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  label,
  accent = 'gold',
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  accent?: 'gold' | 'violet';
}) {
  const activeCls =
    accent === 'violet'
      ? 'bg-violet-500 text-white shadow-md'
      : 'bg-[color:var(--red, var(--color-1, #e8384f))] text-white shadow-[0_0_16px_-4px_var(--red, var(--color-1, #e8384f))]';
  const idleCls =
    accent === 'violet'
      ? 'text-ink-400 hover:text-violet-300'
      : 'text-ink-400 hover:text-[color:var(--red-hi,var(--color-1))]';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 min-h-11 sm:min-h-0 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all truncate ${
        active ? activeCls : idleCls
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 min-h-11 sm:min-h-0 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
        active
          ? 'bg-[color:var(--surface2,var(--bg-card))] text-[color:var(--red-hi,var(--color-1))]'
          : 'text-ink-400 hover:text-ink-200'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function ToggleChip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1.5 min-h-11 sm:min-h-0 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
        active
          ? 'bg-[color:var(--blob-1,var(--color-1))] text-[color:var(--red-hi,var(--color-1))] border-[color:var(--red, var(--color-1, #e8384f))]/40'
          : 'bg-[color:var(--surface,var(--bg-surface))] text-ink-400 border-[color:var(--line-2,var(--border-dim))] hover:text-ink-200'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function SortChip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 min-h-11 sm:min-h-0 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 ${
        active ? 'bg-[color:var(--surface2,var(--bg-card))] text-ink-50 shadow-sm' : 'text-ink-400 hover:text-ink-200'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

/* SİNEMATİK OTOPSİ (DNF) ROZETİ — kırmızı tonlu, muted görünüm. */
function DnfBadge() {
  return (
    <span
      title="Sinematik Otopsi: yarım bırakıldı"
      className={`${monoLabel} inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[color:var(--blob-1,var(--color-1))] text-[color:var(--red-hi,var(--color-1))] border border-[color:var(--red, var(--color-1, #e8384f))]/40 opacity-90`}
    >
      <Skull size={10} className="flex-shrink-0" />
      <span className="truncate">Operasyon İptal Edildi (DNF)</span>
    </span>
  );
}

function MovieHistoryCard({
  item,
  movieData,
  criteriaList,
  isNoteExpanded,
  onToggleNote,
  onEdit,
  onSelectDetail,
}: {
  item: WatchHistoryItem;
  movieData?: Movie;
  criteriaList: { id: string; name: string }[];
  isNoteExpanded: boolean;
  onToggleNote: () => void;
  onEdit: () => void;
  onSelectDetail: () => void;
}) {
  const hasDetailed = item.detailedRating && Object.keys(item.detailedRating).length > 0;
  const hasTags = item.reviewTags && item.reviewTags.length > 0;
  const isPast = Boolean(item.isPastWatch || movieData?.isPastWatch);
  // Sinematik Otopsi: item.abandoned yoksa itemId → film lookup ile türetilir.
  const isDnf = Boolean(item.abandoned ?? movieData?.abandoned);

  return (
    <div className="relative bg-[color:var(--glass, var(--bg-card))] backdrop-blur-md border border-[color:var(--line-2,var(--border-dim))] hover:border-[color:var(--red, var(--color-1, #e8384f))]/40 hover:shadow-[var(--glow)] rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-[var(--shadow,0_1px_3px_rgba(0,0,0,0.25))] transition-all overflow-hidden group">
      {movieData?.posterUrl && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-15 group-hover:opacity-25 transition-opacity">
          <img loading="lazy" decoding="async" src={movieData.posterUrl} alt="" className="w-full h-full object-cover blur-3xl scale-125 saturate-150"  onError={handleImgFallback}/>
          <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--bg-base,#0a0a0d)] via-[color:var(--bg-base,#0a0a0d)]/85 to-transparent" />
        </div>
      )}

      <div className="relative z-10 flex flex-col sm:flex-row items-start gap-3 sm:gap-5">
        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0 w-full">
          <button
            type="button"
            onClick={onSelectDetail}
            title="Sinema Kartını & Detayları Gör"
            className="flex-shrink-0 w-14 sm:w-20 aspect-[2/3] rounded-xl sm:rounded-2xl bg-[color:var(--surface,var(--bg-surface))] border-2 border-[color:var(--line-2,var(--border-dim))] group-hover/poster:border-[color:var(--red, var(--color-1, #e8384f))]/60 flex items-center justify-center overflow-hidden shadow-xl relative group/poster cursor-pointer transition-colors"
          >
            {movieData?.posterUrl ? (
              <img loading="lazy" decoding="async" src={movieData.posterUrl} alt={item.title} className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300"  onError={handleImgFallback}/>
            ) : (
              <Film size={22} className="text-ink-600" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isPast ? (
                <span className={`${monoLabel} inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30`}>
                  <History size={10} /> Daha Önce İzlendi
                </span>
              ) : (
                <span className={`${monoLabel} inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[color:var(--blob-1,var(--color-1))] text-[color:var(--red-hi,var(--color-1))] border border-[color:var(--red, var(--color-1, #e8384f))]/30`}>
                  <Film size={10} /> Film Kaydı
                </span>
              )}
              {item.rating !== null && item.rating >= 9 && (
                <span className={`${monoLabel} inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30`}>
                  <Award size={10} /> Favori
                </span>
              )}
              {isDnf && <DnfBadge />}
            </div>

            <button
              type="button"
              onClick={onSelectDetail}
              className="text-base sm:text-xl font-black text-ink-50 hover:text-[color:var(--red-hi,var(--color-1))] transition-colors text-left truncate block w-full mt-1 uppercase tracking-tight"
            >
              {item.title}
            </button>

            <div className="text-[11px] sm:text-xs text-ink-300 mt-1 flex items-center gap-1.5 flex-wrap font-medium">
              {(movieData?.year || item.year) && <span className="tabular-nums">{movieData?.year || item.year}</span>}
              {movieData?.runtime && (
                <>
                  <span className="text-ink-600">·</span>
                  <span className="tabular-nums">{movieData.runtime} dk</span>
                </>
              )}
              {item.genres && item.genres.length > 0 && (
                <>
                  <span className="text-ink-600">·</span>
                  <span className="text-ink-400 truncate">{item.genres.join(', ')}</span>
                </>
              )}
            </div>

            <div className="text-[11px] text-ink-400 mt-1.5 flex items-center gap-1 font-medium">
              {isPast ? (
                <>
                  <History size={11} className="text-violet-400" />
                  <span className="uppercase tracking-wider">Daha önce izlendi</span>
                </>
              ) : (
                <>
                  <Clock size={11} className="text-[color:var(--red-hi,var(--color-1))]" />
                  <span className="tabular-nums">{formatDateTime(item.watchedAt)}</span>
                </>
              )}
            </div>

            {hasTags && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {item.reviewTags!.map((tag) => (
                  <span key={tag} className="text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-[color:var(--blob-1,var(--color-1))] text-[color:var(--red-hi,var(--color-1))] border border-[color:var(--red, var(--color-1, #e8384f))]/30 px-2 py-0.5 rounded-lg">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {hasDetailed && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {Object.entries(item.detailedRating!).map(([critId, score]) => {
                  const critName = criteriaList.find((c) => c.id === critId)?.name || critId;
                  return (
                    <span key={critId} className="text-[10px] font-bold uppercase tracking-wider bg-[color:var(--surface,var(--bg-surface))] text-ink-200 px-2 py-0.5 rounded-lg border border-[color:var(--line-2,var(--border-dim))]">
                      {critName}: <strong className="text-[color:var(--red-hi,var(--color-1))] tabular-nums">{score}</strong>
                    </span>
                  );
                })}
              </div>
            )}

            {item.note && (
              <div
                onClick={onToggleNote}
                className="mt-2.5 bg-[color:var(--surface,var(--bg-surface))] hover:bg-[color:var(--surface2,var(--bg-card))] border border-[color:var(--line-2,var(--border-dim))] hover:border-[color:var(--red, var(--color-1, #e8384f))]/40 border-l-4 border-l-[color:var(--red, var(--color-1, #e8384f))] rounded-xl px-3 py-2 relative cursor-pointer transition-all"
              >
                <div className="flex items-start gap-2">
                  <Quote size={13} className="text-[color:var(--red-hi,var(--color-1))] flex-shrink-0 mt-0.5 opacity-80" />
                  <p className={`text-xs sm:text-sm text-ink-100 italic leading-relaxed flex-1 min-w-0 ${isNoteExpanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-1'}`}>
                    {item.note}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 pt-2.5 sm:pt-0 border-t border-[color:var(--line,var(--border-dim))] sm:border-0 flex-shrink-0">
          {item.rating !== null && (
            <div className={`px-3 py-1 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl font-black text-base sm:text-xl shadow-lg flex items-center gap-1 tabular-nums ${ratingBgClass(item.rating)}`}>
              <StarIcon size={15} className="fill-current" />
              <span>{item.rating}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onSelectDetail}
              className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider bg-[color:var(--surface,var(--bg-surface))] hover:bg-[color:var(--surface2,var(--bg-card))] text-ink-300 hover:text-white px-2.5 py-1.5 min-h-11 sm:min-h-0 rounded-xl border border-[color:var(--line-2,var(--border-dim))] transition-colors"
            >
              <Eye size={13} /> <span>Kart</span>
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider bg-[color:var(--surface,var(--bg-surface))] hover:bg-[color:var(--surface2,var(--bg-card))] text-ink-300 hover:text-[color:var(--red-hi,var(--color-1))] px-2.5 py-1.5 min-h-11 sm:min-h-0 rounded-xl border border-[color:var(--line-2,var(--border-dim))] transition-colors"
            >
              <Edit2 size={13} /> <span>Düzenle</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
