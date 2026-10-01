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
  Layers,
  User,
  Tag,
  History,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass, formatDateTime, formatDateShort } from '../lib/utils';
import RatingModal from '../components/RatingModal';
import MediaDetailModal from '../components/MediaDetailModal';
import type { DetailModalTarget } from '../components/MediaDetailModal';
import type { WatchHistoryItem, Movie, Series } from '../types';

type SortMode = 'newest' | 'oldest' | 'rating';
type FilterType = 'all' | 'movie' | 'series';
type ViewMode = 'timeline' | 'grid' | 'past';

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

  const processedItems = useMemo(() => {
    let items = [...activeBaseHistory];

    if (viewMode !== 'past' && filterType !== 'all') {
      items = items.filter((h) => h.kind === filterType || h.type === filterType);
    }

    if (onlyWithNotes) {
      items = items.filter((h) => h.note && h.note.trim().length > 0);
    }

    if (onlyHighRated) {
      items = items.filter((h) => h.rating !== null && h.rating >= 8.5);
    }

    if (selectedTagFilter) {
      items = items.filter((h) => h.reviewTags && h.reviewTags.includes(selectedTagFilter));
    }

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
      if (sortMode === 'newest')
        return new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime();
      if (sortMode === 'oldest')
        return new Date(a.watchedAt).getTime() - new Date(b.watchedAt).getTime();
      if (sortMode === 'rating') {
        const ra = a.rating ?? -1;
        const rb = b.rating ?? -1;
        return rb - ra;
      }
      return 0;
    });

    return items;
  }, [activeBaseHistory, viewMode, search, sortMode, filterType, onlyWithNotes, onlyHighRated, selectedTagFilter]);

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
      {/* 1. BAŞLIK */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-ink-100 flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-gold-500/20 to-azure-500/20 border border-gold-500/30 flex items-center justify-center shadow-lg">
            <Clock size={20} className="text-gold-400" />
          </div>
          <div>
            <span>Sinema Günlüğü & Geçmiş</span>
            <span className="hidden sm:block text-xs font-medium text-ink-400 mt-0.5">
              İzlediğin tüm yapımların kronolojik zaman tüneli ve inceleme arşivin
            </span>
          </div>
        </h1>
      </div>

      {/* 2. SİNEMA GÜNLÜĞÜ ÖZET VİTRİNİ (HERO STATS - MOBİLDE YATAY KAYDIRMALI VEYA KOMPAKT) */}
      {data.history.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
          <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-3 flex items-center gap-2.5 shadow-lg">
            <div className="w-9 h-9 rounded-xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
              <Sparkles size={16} className="text-gold-400" />
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-ink-50 leading-none">{diaryStats.total}</div>
              <div className="text-[10px] sm:text-[11px] font-bold text-ink-400 mt-1">Toplam Kayıt</div>
            </div>
          </div>

          <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-3 flex items-center gap-2.5 shadow-lg">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Film size={16} className="text-amber-400" />
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-ink-50 leading-none">{diaryStats.movies}</div>
              <div className="text-[10px] sm:text-[11px] font-bold text-ink-400 mt-1">İzlenen Film</div>
            </div>
          </div>

          <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-3 flex items-center gap-2.5 shadow-lg">
            <div className="w-9 h-9 rounded-xl bg-azure-500/15 border border-azure-500/30 flex items-center justify-center flex-shrink-0">
              <Tv size={16} className="text-azure-400" />
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-ink-50 leading-none">{diaryStats.episodes}</div>
              <div className="text-[10px] sm:text-[11px] font-bold text-ink-400 mt-1">Dizi Bölümü</div>
            </div>
          </div>

          <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-3 flex items-center gap-2.5 shadow-lg">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <StickyNote size={16} className="text-emerald-400" />
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-ink-50 leading-none">{diaryStats.withNotes}</div>
              <div className="text-[10px] sm:text-[11px] font-bold text-ink-400 mt-1">İnceleme</div>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-ink-900/70 border border-ink-700/50 rounded-2xl p-3 flex items-center gap-2.5 shadow-lg">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
              <Calendar size={16} className="text-violet-400" />
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-ink-50 leading-none">
                {diaryStats.uniqueDays}{' '}
                <span className="text-xs font-bold text-gold-400">★{diaryStats.avgRating}</span>
              </div>
              <div className="text-[10px] sm:text-[11px] font-bold text-ink-400 mt-1">Aktif Gün & Ort.</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. GÖRÜNÜM SEÇİCİ SEKMELER & GİZLİ ARAMA/FİLTRE BUTONU */}
      {data.history.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="grid grid-cols-3 sm:flex items-center bg-ink-900/80 border border-ink-700/60 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all truncate ${
                  viewMode === 'timeline'
                    ? 'bg-gold-500 text-ink-950 shadow-md'
                    : 'text-ink-400 hover:text-ink-200'
                }`}
              >
                <LayoutList size={13} className="flex-shrink-0" />
                <span className="truncate">Zaman Tüneli</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all truncate ${
                  viewMode === 'grid'
                    ? 'bg-gold-500 text-ink-950 shadow-md'
                    : 'text-ink-400 hover:text-ink-200'
                }`}
              >
                <LayoutGrid size={13} className="flex-shrink-0" />
                <span className="truncate">Poster Vitrini</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('past')}
                className={`flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all truncate ${
                  viewMode === 'past'
                    ? 'bg-violet-500 text-white shadow-md'
                    : 'text-ink-400 hover:text-violet-300'
                }`}
              >
                <History size={13} className="flex-shrink-0" />
                <span className="truncate">Önceden ({pastHistory.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsFilterPanelOpen((prev) => !prev)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                  isFilterPanelOpen || activeFilterCount > 0
                    ? 'bg-gold-500/15 text-gold-300 border-gold-500/40 shadow-sm'
                    : 'bg-ink-900/70 hover:bg-ink-800 text-ink-300 border-ink-700/60'
                }`}
              >
                <SlidersHorizontal size={14} className="text-gold-400" />
                <span>Ara & Filtrele</span>
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-gold-500 text-ink-950 text-[10px] font-black">
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
                  className="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-bold transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* AÇILIR/KAPANIR ARAMA VE FİLTRE MERKEZİ */}
          {isFilterPanelOpen && (
            <div className="bg-ink-900/70 backdrop-blur-sm border border-ink-700/60 rounded-2xl p-3 sm:p-4 space-y-3 shadow-xl animate-fade-in">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Yapım adı, başlık, tür veya inceleme notu ara..."
                  className="w-full bg-ink-950/90 border border-ink-700/80 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {viewMode !== 'past' && (
                    <div className="flex bg-ink-950/80 rounded-xl p-1 border border-ink-800">
                      <button
                        onClick={() => setFilterType('all')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                          filterType === 'all' ? 'bg-ink-800 text-ink-50 shadow-sm' : 'text-ink-400 hover:text-ink-200'
                        }`}
                      >
                        Tümü
                      </button>
                      <button
                        onClick={() => setFilterType('movie')}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                          filterType === 'movie' ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30' : 'text-ink-400 hover:text-ink-200'
                        }`}
                      >
                        <Film size={12} /> Filmler
                      </button>
                      <button
                        onClick={() => setFilterType('series')}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                          filterType === 'series' ? 'bg-azure-500/20 text-azure-400 border border-azure-500/30' : 'text-ink-400 hover:text-ink-200'
                        }`}
                      >
                        <Tv size={12} /> Diziler
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setOnlyWithNotes(!onlyWithNotes)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      onlyWithNotes
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-ink-950/70 text-ink-400 border-ink-800 hover:text-ink-200'
                    }`}
                  >
                    <StickyNote size={12} /> Notlular
                  </button>

                  <button
                    type="button"
                    onClick={() => setOnlyHighRated(!onlyHighRated)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      onlyHighRated
                        ? 'bg-gold-500/20 text-gold-300 border-gold-500/40'
                        : 'bg-ink-950/70 text-ink-400 border-ink-800 hover:text-ink-200'
                    }`}
                  >
                    <Flame size={12} /> 8.5+
                  </button>
                </div>

                <div className="flex bg-ink-950/80 rounded-xl p-1 border border-ink-800">
                  <button
                    onClick={() => setSortMode('newest')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                      sortMode === 'newest' ? 'bg-ink-800 text-ink-50 shadow-sm' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    <Clock size={11} /> En Yeni
                  </button>
                  <button
                    onClick={() => setSortMode('oldest')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                      sortMode === 'oldest' ? 'bg-ink-800 text-ink-50 shadow-sm' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    En Eski
                  </button>
                  <button
                    onClick={() => setSortMode('rating')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                      sortMode === 'rating' ? 'bg-ink-800 text-ink-50 shadow-sm' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    <StarIcon size={11} /> Puan
                  </button>
                </div>
              </div>

              {usedReviewTags.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pt-2 border-t border-ink-800/60">
                  <span className="text-[10px] font-black uppercase tracking-wider text-ink-400 flex items-center gap-1 mr-1 flex-shrink-0">
                    <Tag size={11} className="text-gold-400" /> Başlıklar:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedTagFilter(null)}
                    className={`flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                      selectedTagFilter === null
                        ? 'bg-gold-500 text-ink-950 border-gold-400'
                        : 'bg-ink-950/70 text-ink-400 border-ink-800 hover:text-ink-200'
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
                        className={`flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                          active
                            ? 'bg-gold-500 text-ink-950 border-gold-400 shadow-sm'
                            : 'bg-ink-950/70 text-ink-300 border-ink-800 hover:border-gold-500/40'
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
        <div className="text-center py-14 bg-ink-900/40 border border-ink-800/60 rounded-3xl text-ink-500 px-4">
          <div className="w-14 h-14 rounded-2xl bg-ink-800/50 flex items-center justify-center mx-auto mb-3">
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

            return (
              <div
                key={isMovie ? item.id : seriesId}
                onClick={() =>
                  isMovie ? openMovieDetail(item, movieData) : openSeriesDetail(item, seriesData)
                }
                className="group relative flex flex-col bg-ink-900/80 border border-ink-700/60 hover:border-gold-500/50 rounded-2xl overflow-hidden shadow-xl transition-all hover:-translate-y-1.5 cursor-pointer"
              >
                <div className="aspect-[2/3] w-full bg-ink-950 relative overflow-hidden">
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-ink-600">
                      {isMovie ? <Film size={32} /> : <Tv size={32} />}
                    </div>
                  )}

                  <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border border-white/15 flex items-center gap-1">
                    {isMovie ? (
                      <><Film size={10} className="text-gold-400" /> Film</>
                    ) : (
                      <><Tv size={10} className="text-azure-400" /> S{item.season} B{item.episode}</>
                    )}
                  </div>

                  {item.rating !== null && (
                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-xl text-xs font-black shadow-lg ${ratingBgClass(item.rating)}`}>
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
                    <h3 className="font-black text-xs sm:text-sm text-ink-100 truncate group-hover:text-gold-400 transition-colors">
                      {item.title}
                    </h3>
                    {item.reviewTags && item.reviewTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.reviewTags.slice(0, 2).map((t) => (
                          <span key={t} className="text-[9px] font-bold bg-gold-500/15 text-gold-300 border border-gold-500/30 px-1.5 py-0.5 rounded truncate">
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

                  <div className="flex items-center justify-between text-[10px] text-ink-500 font-semibold mt-2 pt-1.5 border-t border-ink-800/60">
                    <span>{formatDateShort(item.watchedAt)}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItem(item);
                      }}
                      className="text-ink-400 hover:text-gold-400 p-1 rounded transition-colors"
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
          <div className="absolute left-0.5 sm:left-2.5 top-3 bottom-3 w-0.5 bg-gradient-to-b from-gold-500 via-azure-500/50 to-transparent rounded-full pointer-events-none" />

          {Array.from(groupedByDate.entries()).map(([dateLabel, items]) => (
            <div key={dateLabel} className="relative animate-fade-in-up">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="absolute -left-[9px] sm:-left-[19px] w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-ink-950 border-2 border-gold-400 shadow-[0_0_10px_rgba(245,158,11,0.7)]" />
                <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-ink-900/90 border border-gold-500/30 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-black text-gold-300 uppercase tracking-wider shadow-md">
                  <Calendar size={12} className="text-gold-400 flex-shrink-0" />
                  <span className="truncate">{dateLabel}</span>
                  <span className="text-[10px] bg-gold-500/20 text-gold-300 px-1.5 py-0.5 rounded-full ml-0.5 flex-shrink-0">
                    {items.length}
                  </span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-ink-700/60 to-transparent" />
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
                        className="relative bg-ink-900/80 backdrop-blur-md border border-ink-700/60 hover:border-azure-500/40 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl transition-all"
                      >
                        {seriesData?.posterUrl && (
                          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-15">
                            <img src={seriesData.posterUrl} alt="" className="w-full h-full object-cover blur-3xl scale-125 saturate-150" />
                            <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-transparent" />
                          </div>
                        )}

                        <div
                          onClick={() => toggleSeries(sid)}
                          className="relative z-10 w-full flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3.5 sm:p-5 hover:bg-ink-800/30 transition-colors cursor-pointer"
                        >
                          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openSeriesDetail(item, seriesData);
                              }}
                              title="Dizi Sinema Kartını Gör"
                              className="flex-shrink-0 w-14 sm:w-20 aspect-[2/3] rounded-xl sm:rounded-2xl bg-ink-950 border-2 border-ink-700/60 flex items-center justify-center overflow-hidden shadow-xl relative group/poster cursor-pointer"
                            >
                              {seriesData?.posterUrl ? (
                                <img src={seriesData.posterUrl} alt={item.title} className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300" />
                              ) : (
                                <Tv size={22} className="text-ink-600" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-azure-500/20 text-azure-300 border border-azure-500/30">
                                  <Tv size={10} /> Dizi
                                </span>
                                <span className="text-[11px] font-bold text-azure-300 bg-ink-950/80 border border-azure-500/30 px-2 py-0.5 rounded-lg">
                                  Son: S{item.season} B{item.episode}
                                </span>
                              </div>

                              <h3 className="text-base sm:text-xl font-black text-ink-50 truncate mt-1">
                                {item.title}
                              </h3>

                              <div className="flex items-center gap-2 flex-wrap text-[11px] sm:text-xs text-ink-300 mt-1 font-medium">
                                {seriesData?.year && <span>{seriesData.year}</span>}
                                {item.genres && item.genres.length > 0 && (
                                  <>
                                    <span className="text-ink-600">·</span>
                                    <span className="text-ink-400 truncate">{item.genres.slice(0, 3).join(', ')}</span>
                                  </>
                                )}
                              </div>

                              <div className="text-[11px] text-ink-400 mt-1.5 flex items-center gap-1 font-medium">
                                <Clock size={11} className="text-azure-400" />
                                <span>{formatDateTime(item.watchedAt)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 pt-2.5 sm:pt-0 border-t border-ink-800/60 sm:border-0 flex-shrink-0">
                            <div className="flex items-center gap-1.5">
                              {item.rating !== null && (
                                <div className={`px-3 py-1 rounded-xl font-black text-sm sm:text-base shadow-lg flex items-center gap-1 ${ratingBgClass(item.rating)}`}>
                                  <StarIcon size={13} className="fill-current" />
                                  <span>{item.rating}</span>
                                </div>
                              )}
                              {avgEpRating !== null && eps.length > 1 && (
                                <div className="text-[11px] font-bold bg-ink-950/80 border border-ink-700 text-ink-300 px-2 py-1 rounded-xl">
                                  Ort: <strong className="text-azure-400">{avgEpRating}</strong>
                                </div>
                              )}
                            </div>

                            <div className="inline-flex items-center gap-1 text-xs font-black text-azure-300 bg-azure-500/15 hover:bg-azure-500/25 border border-azure-500/30 px-2.5 py-1 rounded-xl transition-colors">
                              <span>{eps.length} Bölüm</span>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="relative z-10 border-t border-ink-700/50 bg-ink-950/60 p-3 sm:p-4 space-y-2 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {eps.map((ep) => {
                                const isEpNoteExpanded = expandedNotes.has(ep.id);
                                return (
                                  <div
                                    key={ep.id}
                                    className="bg-ink-900/80 border border-ink-800 hover:border-azure-500/40 rounded-xl p-3 flex flex-col justify-between gap-2 transition-all"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => openSeriesDetail(ep, seriesData)}
                                          className="text-xs sm:text-sm font-black text-ink-100 hover:text-azure-400 transition-colors text-left flex items-center gap-1.5"
                                        >
                                          <span className="w-2 h-2 rounded-full bg-azure-400" />
                                          {ep.season}. Sezon {ep.episode}. Bölüm
                                        </button>
                                        <div className="text-[10px] text-ink-500 mt-0.5 flex items-center gap-1">
                                          <Clock size={10} /> {formatDateTime(ep.watchedAt)}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {ep.rating !== null && (
                                          <span className={`text-xs px-2 py-0.5 rounded-lg font-black ${ratingBgClass(ep.rating)}`}>
                                            ★ {ep.rating}
                                          </span>
                                        )}
                                        <button
                                          onClick={() => setEditingItem(ep)}
                                          className="text-ink-400 hover:text-azure-400 bg-ink-950 p-1.5 rounded-lg border border-ink-800 transition-colors"
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                      </div>
                                    </div>

                                    {ep.reviewTags && ep.reviewTags.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {ep.reviewTags.map((t) => (
                                          <span key={t} className="text-[10px] font-bold bg-azure-500/15 text-azure-300 border border-azure-500/30 px-2 py-0.5 rounded-md">
                                            {t}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {ep.note && (
                                      <div
                                        onClick={() => toggleNoteExpand(ep.id)}
                                        className="bg-ink-950/80 hover:bg-ink-950 rounded-xl p-2 border-l-2 border-azure-500 flex items-start gap-2 cursor-pointer transition-colors"
                                      >
                                        <Quote size={12} className="text-azure-400 flex-shrink-0 mt-0.5" />
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

  return (
    <div className="relative bg-ink-900/80 backdrop-blur-md border border-ink-700/60 hover:border-gold-500/40 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xl transition-all overflow-hidden group">
      {movieData?.posterUrl && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-15 group-hover:opacity-25 transition-opacity">
          <img src={movieData.posterUrl} alt="" className="w-full h-full object-cover blur-3xl scale-125 saturate-150" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-transparent" />
        </div>
      )}

      <div className="relative z-10 flex flex-col sm:flex-row items-start gap-3 sm:gap-5">
        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0 w-full">
          <button
            type="button"
            onClick={onSelectDetail}
            title="Sinema Kartını & Detayları Gör"
            className="flex-shrink-0 w-14 sm:w-20 aspect-[2/3] rounded-xl sm:rounded-2xl bg-ink-950 border-2 border-ink-700/60 flex items-center justify-center overflow-hidden shadow-xl relative group/poster cursor-pointer"
          >
            {movieData?.posterUrl ? (
              <img src={movieData.posterUrl} alt={item.title} className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300" />
            ) : (
              <Film size={22} className="text-ink-600" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isPast ? (
                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  <History size={10} /> Daha Önce İzlendi
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-gold-500/20 text-gold-300 border border-gold-500/30">
                  <Film size={10} /> Film Kaydı
                </span>
              )}
              {item.rating !== null && item.rating >= 9 && (
                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Award size={10} /> Favori
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onSelectDetail}
              className="text-base sm:text-xl font-black text-ink-50 hover:text-gold-400 transition-colors text-left truncate block w-full mt-1"
            >
              {item.title}
            </button>

            <div className="text-[11px] sm:text-xs text-ink-300 mt-1 flex items-center gap-1.5 flex-wrap font-medium">
              {(movieData?.year || item.year) && <span>{movieData?.year || item.year}</span>}
              {movieData?.runtime && (
                <>
                  <span className="text-ink-600">·</span>
                  <span>{movieData.runtime} dk</span>
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
                  <span>Daha önce izlendi</span>
                </>
              ) : (
                <>
                  <Clock size={11} className="text-gold-400" />
                  <span>{formatDateTime(item.watchedAt)}</span>
                </>
              )}
            </div>

            {hasTags && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {item.reviewTags!.map((tag) => (
                  <span key={tag} className="text-[10px] sm:text-xs font-bold bg-gold-500/15 text-gold-300 border border-gold-500/30 px-2 py-0.5 rounded-lg">
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
                    <span key={critId} className="text-[10px] font-bold bg-ink-950/90 text-ink-200 px-2 py-0.5 rounded-lg border border-ink-800">
                      {critName}: <strong className="text-gold-400">{score}</strong>
                    </span>
                  );
                })}
              </div>
            )}

            {item.note && (
              <div
                onClick={onToggleNote}
                className="mt-2.5 bg-ink-950/75 hover:bg-ink-950 border border-ink-800/90 hover:border-gold-500/40 border-l-4 border-l-gold-500 rounded-xl px-3 py-2 relative cursor-pointer transition-all"
              >
                <div className="flex items-start gap-2">
                  <Quote size={13} className="text-gold-400 flex-shrink-0 mt-0.5 opacity-80" />
                  <p className={`text-xs sm:text-sm text-ink-100 italic leading-relaxed flex-1 min-w-0 ${isNoteExpanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-1'}`}>
                    {item.note}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 pt-2.5 sm:pt-0 border-t border-ink-800/60 sm:border-0 flex-shrink-0">
          {item.rating !== null && (
            <div className={`px-3 py-1 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl font-black text-base sm:text-xl shadow-lg flex items-center gap-1 ${ratingBgClass(item.rating)}`}>
              <StarIcon size={15} className="fill-current" />
              <span>{item.rating}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onSelectDetail}
              className="flex items-center gap-1 text-xs font-bold bg-ink-950/80 hover:bg-ink-800 text-ink-300 hover:text-white px-2.5 py-1.5 rounded-xl border border-ink-800 transition-colors"
            >
              <Eye size={13} /> <span>Kart</span>
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1 text-xs font-bold bg-ink-950/80 hover:bg-ink-800 text-ink-300 hover:text-gold-400 px-2.5 py-1.5 rounded-xl border border-ink-800 transition-colors"
            >
              <Edit2 size={13} /> <span>Düzenle</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}