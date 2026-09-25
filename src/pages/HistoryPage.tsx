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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass, formatDateTime, formatDateShort } from '../lib/utils';
import RatingModal from '../components/RatingModal';
import MediaDetailModal from '../components/MediaDetailModal';
import type { DetailModalTarget } from '../components/MediaDetailModal';
import type { WatchHistoryItem, Movie, Series } from '../types';

type SortMode = 'newest' | 'oldest' | 'rating';
type FilterType = 'all' | 'movie' | 'series';
type ViewMode = 'timeline' | 'grid';

export default function HistoryPage() {
  const { data, updateHistoryRating } = useApp();
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());
  // Notlar varsayılan olarak tek satırdır (kapalıdır). Tıklananların ID'si burada tutulur ve açılır.
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<WatchHistoryItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<DetailModalTarget | null>(null);

  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [onlyWithNotes, setOnlyWithNotes] = useState(false);
  const [onlyHighRated, setOnlyHighRated] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  // Geçmişte kullanılan tüm değerlendirme başlıklarını çıkar
  const usedReviewTags = useMemo(() => {
    const set = new Set<string>();
    data.history.forEach((h) => (h.reviewTags || []).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [data.history]);

  // Günlük Özet İstatistikleri
  const diaryStats = useMemo(() => {
    const total = data.history.length;
    const movies = data.history.filter((h) => h.kind === 'movie' || h.type === 'movie').length;
    const episodes = total - movies;
    const withNotes = data.history.filter((h) => h.note && h.note.trim().length > 0).length;
    const uniqueDays = new Set(
      data.history.map((h) => (h.watchedAt ? h.watchedAt.slice(0, 10) : '')).filter(Boolean)
    ).size;
    const rated = data.history.filter((h) => h.rating !== null);
    const avgRating =
      rated.length > 0
        ? (rated.reduce((sum, h) => sum + (h.rating || 0), 0) / rated.length).toFixed(1)
        : '-';

    return { total, movies, episodes, withNotes, uniqueDays, avgRating };
  }, [data.history]);

  // Arama, Filtreleme ve Sıralama
  const processedItems = useMemo(() => {
    let items = [...data.history];

    if (filterType !== 'all') {
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
  }, [data.history, search, sortMode, filterType, onlyWithNotes, onlyHighRated, selectedTagFilter]);

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
    <div className="space-y-6 animate-fade-in">
      {/* =========================================================
          1. BAŞLIK VE GÖRÜNÜM SEÇİCİ
          ========================================================= */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-ink-100 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500/20 to-azure-500/20 border border-gold-500/30 flex items-center justify-center shadow-lg">
            <Clock size={22} className="text-gold-400" />
          </div>
          <div>
            <span>Sinema Günlüğü & Geçmiş</span>
            <span className="block text-xs font-medium text-ink-400 mt-0.5">
              İzlediğin tüm yapımların kronolojik zaman tüneli ve inceleme arşivin
            </span>
          </div>
        </h1>

        {data.history.length > 0 && (
          <div className="flex items-center bg-ink-900/80 border border-ink-700/60 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'timeline'
                  ? 'bg-gold-500 text-ink-950 shadow-md'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              <LayoutList size={14} /> Zaman Tüneli
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grid'
                  ? 'bg-gold-500 text-ink-950 shadow-md'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              <LayoutGrid size={14} /> Poster Vitrini
            </button>
          </div>
        )}
      </div>

      {/* =========================================================
          2. SİNEMA GÜNLÜĞÜ ÖZET VİTRİNİ (HERO STATS)
          ========================================================= */}
      {data.history.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-3.5 flex items-center gap-3 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
              <Sparkles size={18} className="text-gold-400" />
            </div>
            <div>
              <div className="text-xl font-black text-ink-50 leading-none">{diaryStats.total}</div>
              <div className="text-[11px] font-bold text-ink-400 mt-1">Toplam Kayıt</div>
            </div>
          </div>

          <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-3.5 flex items-center gap-3 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Film size={18} className="text-amber-400" />
            </div>
            <div>
              <div className="text-xl font-black text-ink-50 leading-none">{diaryStats.movies}</div>
              <div className="text-[11px] font-bold text-ink-400 mt-1">İzlenen Film</div>
            </div>
          </div>

          <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-3.5 flex items-center gap-3 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-azure-500/15 border border-azure-500/30 flex items-center justify-center flex-shrink-0">
              <Tv size={18} className="text-azure-400" />
            </div>
            <div>
              <div className="text-xl font-black text-ink-50 leading-none">{diaryStats.episodes}</div>
              <div className="text-[11px] font-bold text-ink-400 mt-1">Dizi Bölümü</div>
            </div>
          </div>

          <div className="bg-ink-900/70 border border-ink-700/50 rounded-2xl p-3.5 flex items-center gap-3 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <StickyNote size={18} className="text-emerald-400" />
            </div>
            <div>
              <div className="text-xl font-black text-ink-50 leading-none">{diaryStats.withNotes}</div>
              <div className="text-[11px] font-bold text-ink-400 mt-1">Yazılan İnceleme</div>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-ink-900/70 border border-ink-700/50 rounded-2xl p-3.5 flex items-center gap-3 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
              <Calendar size={18} className="text-violet-400" />
            </div>
            <div>
              <div className="text-xl font-black text-ink-50 leading-none">
                {diaryStats.uniqueDays}{' '}
                <span className="text-xs font-bold text-gold-400">★{diaryStats.avgRating}</span>
              </div>
              <div className="text-[11px] font-bold text-ink-400 mt-1">Aktif Gün & Ort.</div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          3. ARAMA VE AKILLI FİLTRE MERKEZİ
          ========================================================= */}
      {data.history.length > 0 && (
        <div className="bg-ink-900/50 backdrop-blur-sm border border-ink-700/50 rounded-2xl p-4 space-y-3 shadow-xl">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Yapım adı, değerlendirme başlığı, tür veya inceleme notları içinde ara..."
              className="w-full bg-ink-950/80 border border-ink-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/30 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-ink-950/80 rounded-xl p-1 border border-ink-800">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    filterType === 'all'
                      ? 'bg-ink-800 text-ink-50 shadow-sm'
                      : 'text-ink-400 hover:text-ink-200'
                  }`}
                >
                  Tümü
                </button>
                <button
                  onClick={() => setFilterType('movie')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    filterType === 'movie'
                      ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                      : 'text-ink-400 hover:text-ink-200'
                  }`}
                >
                  <Film size={13} /> Filmler
                </button>
                <button
                  onClick={() => setFilterType('series')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    filterType === 'series'
                      ? 'bg-azure-500/20 text-azure-400 border border-azure-500/30'
                      : 'text-ink-400 hover:text-ink-200'
                  }`}
                >
                  <Tv size={13} /> Diziler
                </button>
              </div>

              <button
                type="button"
                onClick={() => setOnlyWithNotes(!onlyWithNotes)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  onlyWithNotes
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-ink-950/70 text-ink-400 border-ink-800 hover:text-ink-200'
                }`}
              >
                <StickyNote size={13} /> Sadece Notlular
              </button>

              <button
                type="button"
                onClick={() => setOnlyHighRated(!onlyHighRated)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  onlyHighRated
                    ? 'bg-gold-500/20 text-gold-300 border-gold-500/40 shadow-sm'
                    : 'bg-ink-950/70 text-ink-400 border-ink-800 hover:text-ink-200'
                }`}
              >
                <Flame size={13} /> 8.5+ Başyapıtlar
              </button>
            </div>

            <div className="flex bg-ink-950/80 rounded-xl p-1 border border-ink-800">
              <button
                onClick={() => setSortMode('newest')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                  sortMode === 'newest'
                    ? 'bg-ink-800 text-ink-50 shadow-sm'
                    : 'text-ink-400 hover:text-ink-200'
                }`}
              >
                <Clock size={12} /> En Yeni
              </button>
              <button
                onClick={() => setSortMode('oldest')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                  sortMode === 'oldest'
                    ? 'bg-ink-800 text-ink-50 shadow-sm'
                    : 'text-ink-400 hover:text-ink-200'
                }`}
              >
                En Eski
              </button>
              <button
                onClick={() => setSortMode('rating')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                  sortMode === 'rating'
                    ? 'bg-ink-800 text-ink-50 shadow-sm'
                    : 'text-ink-400 hover:text-ink-200'
                }`}
              >
                <StarIcon size={12} /> Puana Göre
              </button>
            </div>
          </div>

          {/* Değerlendirme Başlıkları Filtre Barı */}
          {usedReviewTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-ink-800/60">
              <span className="text-[10px] font-black uppercase tracking-wider text-ink-400 flex items-center gap-1 mr-1">
                <Tag size={11} className="text-gold-400" /> Başlıklar:
              </span>
              <button
                type="button"
                onClick={() => setSelectedTagFilter(null)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
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
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
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

      {/* =========================================================
          4. İÇERİK ALANI: BOŞ DURUM / POSTER VİTRİNİ / ZAMAN TÜNELİ
          ========================================================= */}
      {displayItems.length === 0 ? (
        <div className="text-center py-16 bg-ink-900/40 border border-ink-800/60 rounded-3xl text-ink-500">
          <div className="w-16 h-16 rounded-2xl bg-ink-800/50 flex items-center justify-center mx-auto mb-4">
            <Film size={32} className="text-ink-600" />
          </div>
          <p className="text-lg font-bold text-ink-200">
            {data.history.length === 0
              ? 'Henüz izlenen bir şey yok.'
              : 'Aramaya ve filtrelere uygun kayıt bulunamadı.'}
          </p>
          <p className="text-sm mt-1">
            {data.history.length === 0
              ? 'Film veya dizi puanladıkça sinema günlüğün burada oluşacak.'
              : 'Filtreleri sıfırlamayı veya arama kelimesini değiştirmeyi dene.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* =========================================================
           MOD A: POSTER VİTRİNİ (GALERİ GÖRÜNÜMÜ)
           ========================================================= */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fade-in">
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
                      {isMovie ? <Film size={36} /> : <Tv size={36} />}
                    </div>
                  )}

                  <div className="absolute top-2.5 left-2.5 bg-black/80 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border border-white/15 flex items-center gap-1">
                    {isMovie ? (
                      <>
                        <Film size={10} className="text-gold-400" /> Film
                      </>
                    ) : (
                      <>
                        <Tv size={10} className="text-azure-400" /> S{item.season} B{item.episode}
                      </>
                    )}
                  </div>

                  {item.rating !== null && (
                    <div
                      className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-xl text-xs font-black shadow-lg ${ratingBgClass(
                        item.rating
                      )}`}
                    >
                      ★ {item.rating}
                    </div>
                  )}

                  <div className="absolute bottom-2 inset-x-2 flex items-center justify-between gap-1">
                    {item.note ? (
                      <span className="bg-emerald-500/90 text-ink-950 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shadow">
                        <StickyNote size={10} /> İncelemeli
                      </span>
                    ) : (
                      <span />
                    )}
                    {!isMovie && epsCount > 1 && (
                      <span className="bg-azure-500/90 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow">
                        {epsCount} Bölüm
                      </span>
                    )}
                  </div>

                  <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                    <div className="w-10 h-10 rounded-full bg-gold-500 text-ink-950 flex items-center justify-center shadow-lg">
                      <Eye size={18} />
                    </div>
                    <span className="text-xs font-black text-white uppercase tracking-wider">
                      Sinema Kartı
                    </span>
                  </div>
                </div>

                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-black text-xs sm:text-sm text-ink-100 truncate group-hover:text-gold-400 transition-colors">
                      {item.title}
                    </h3>
                    {item.reviewTags && item.reviewTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.reviewTags.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="text-[9px] font-bold bg-gold-500/15 text-gold-300 border border-gold-500/30 px-1.5 py-0.5 rounded"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.note && (
                      <p className="text-[11px] text-ink-400 italic line-clamp-1 mt-1">
                        "{item.note}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-ink-500 font-semibold mt-2 pt-2 border-t border-ink-800/60">
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
        /* =========================================================
           MOD B: SİNEMATİK ZAMAN TÜNELİ (TIMELINE) GÖRÜNÜMÜ
           ========================================================= */
        <div className="relative pl-3 sm:pl-6 space-y-8">
          <div className="absolute left-1 sm:left-2.5 top-3 bottom-3 w-0.5 bg-gradient-to-b from-gold-500 via-azure-500/50 to-transparent rounded-full pointer-events-none" />

          {Array.from(groupedByDate.entries()).map(([dateLabel, items]) => (
            <div key={dateLabel} className="relative animate-fade-in-up">
              <div className="flex items-center gap-3 mb-4">
                <div className="absolute -left-[11px] sm:-left-[19px] w-4 h-4 rounded-full bg-ink-950 border-2 border-gold-400 shadow-[0_0_10px_rgba(245,158,11,0.7)]" />
                <div className="inline-flex items-center gap-2 bg-ink-900/90 border border-gold-500/30 px-3.5 py-1.5 rounded-full text-xs font-black text-gold-300 uppercase tracking-wider shadow-md">
                  <Calendar size={13} className="text-gold-400" />
                  <span>{dateLabel}</span>
                  <span className="text-[10px] bg-gold-500/20 text-gold-300 px-1.5 py-0.5 rounded-full ml-1">
                    {items.length} Kayıt
                  </span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-ink-700/60 to-transparent" />
              </div>

              <div className="space-y-4">
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
                            (ratedEps.reduce((s, e) => s + (e.rating || 0), 0) / ratedEps.length) *
                              10
                          ) / 10
                        : null;

                    return (
                      <div
                        key={sid}
                        className="relative bg-ink-900/80 backdrop-blur-md border border-ink-700/60 hover:border-azure-500/40 rounded-3xl overflow-hidden shadow-xl transition-all"
                      >
                        {seriesData?.posterUrl && (
                          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-15">
                            <img
                              src={seriesData.posterUrl}
                              alt=""
                              className="w-full h-full object-cover blur-3xl scale-125 saturate-150"
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-transparent" />
                          </div>
                        )}

                        <div
                          onClick={() => toggleSeries(sid)}
                          className="relative z-10 w-full flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 sm:p-5 hover:bg-ink-800/30 transition-colors cursor-pointer"
                        >
                          <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openSeriesDetail(item, seriesData);
                              }}
                              title="Dizi Sinema Kartını Gör"
                              className="flex-shrink-0 w-16 sm:w-20 aspect-[2/3] rounded-2xl bg-ink-950 border-2 border-ink-700/60 flex items-center justify-center overflow-hidden shadow-xl relative group/poster cursor-pointer focus:outline-none focus:ring-2 focus:ring-azure-500"
                            >
                              {seriesData?.posterUrl ? (
                                <img
                                  src={seriesData.posterUrl}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300"
                                />
                              ) : (
                                <Tv size={26} className="text-ink-600" />
                              )}
                              <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/poster:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5 p-1">
                                <div className="w-7 h-7 rounded-full bg-azure-500 text-white flex items-center justify-center shadow-md">
                                  <Eye size={14} />
                                </div>
                                <span className="text-[9px] font-black text-white uppercase tracking-wider">
                                  Künye
                                </span>
                              </div>
                            </button>

                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-azure-500/20 text-azure-300 border border-azure-500/30">
                                  <Tv size={11} /> Dizi Günlüğü
                                </span>
                                <span className="text-xs font-bold text-azure-300 bg-ink-950/80 border border-azure-500/30 px-2.5 py-0.5 rounded-lg">
                                  Son İzlenen: {item.season}. Sezon {item.episode}. Bölüm
                                </span>
                              </div>

                              <h3 className="text-lg sm:text-xl font-black text-ink-50 truncate mt-1.5">
                                {item.title}
                              </h3>

                              <div className="flex items-center gap-2.5 flex-wrap text-xs text-ink-300 mt-1.5 font-medium">
                                {seriesData?.year && <span>{seriesData.year}</span>}
                                {seriesData?.creators && seriesData.creators.length > 0 && (
                                  <>
                                    <span className="text-ink-600">·</span>
                                    <span className="flex items-center gap-1 text-ink-200">
                                      <User size={12} className="text-azure-400" />{' '}
                                      {seriesData.creators[0]}
                                    </span>
                                  </>
                                )}
                                {item.genres && item.genres.length > 0 && (
                                  <>
                                    <span className="text-ink-600">·</span>
                                    <span className="text-ink-400 truncate">
                                      {item.genres.slice(0, 3).join(', ')}
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Son Bölümün Seçili Değerlendirme Başlıkları */}
                              {item.reviewTags && item.reviewTags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2.5">
                                  {item.reviewTags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="text-[11px] font-bold bg-azure-500/15 text-azure-300 border border-azure-500/30 px-2.5 py-0.5 rounded-lg"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="text-xs text-ink-400 mt-2.5 flex items-center gap-1.5 font-medium">
                                <Clock size={12} className="text-azure-400" />
                                <span>Son aktivite: {formatDateTime(item.watchedAt)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 pt-3 sm:pt-0 border-t border-ink-800/60 sm:border-0 flex-shrink-0">
                            <div className="flex items-center gap-2">
                              {item.rating !== null && (
                                <div
                                  className={`px-3.5 py-1.5 rounded-2xl font-black text-base shadow-lg flex items-center gap-1.5 ${ratingBgClass(
                                    item.rating
                                  )}`}
                                  title="Son Bölüm Puanı"
                                >
                                  <StarIcon size={15} className="fill-current" />
                                  <span>{item.rating}</span>
                                </div>
                              )}
                              {avgEpRating !== null && eps.length > 1 && (
                                <div className="text-[11px] font-bold bg-ink-950/80 border border-ink-700 text-ink-300 px-2.5 py-1.5 rounded-xl">
                                  Ort: <strong className="text-azure-400">{avgEpRating}</strong>
                                </div>
                              )}
                            </div>

                            <div className="inline-flex items-center gap-1.5 text-xs font-black text-azure-300 bg-azure-500/15 hover:bg-azure-500/25 border border-azure-500/30 px-3 py-1.5 rounded-xl transition-colors">
                              <span>{eps.length} Bölüm Kaydı</span>
                              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </div>
                          </div>
                        </div>

                        {/* Genişletilmiş Bölüm Listesi */}
                        {isExpanded && (
                          <div className="relative z-10 border-t border-ink-700/50 bg-ink-950/60 p-4 space-y-2.5 animate-fade-in">
                            <div className="text-[11px] font-black uppercase tracking-widest text-azure-400 mb-2 flex items-center gap-1.5">
                              <Layers size={13} /> İzlenen Bölümlerin Kronolojisi ({eps.length})
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              {eps.map((ep) => {
                                const isEpNoteExpanded = expandedNotes.has(ep.id);
                                return (
                                  <div
                                    key={ep.id}
                                    className="bg-ink-900/80 border border-ink-800 hover:border-azure-500/40 rounded-2xl p-3.5 flex flex-col justify-between gap-2.5 transition-all"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => openSeriesDetail(ep, seriesData)}
                                          className="text-sm font-black text-ink-100 hover:text-azure-400 transition-colors text-left flex items-center gap-1.5"
                                          title="Bu Bölümün Sinema Kartını Gör"
                                        >
                                          <span className="w-2 h-2 rounded-full bg-azure-400" />
                                          {ep.season}. Sezon {ep.episode}. Bölüm
                                        </button>
                                        <div className="text-[11px] text-ink-500 mt-1 flex items-center gap-1.5">
                                          <Clock size={11} /> {formatDateTime(ep.watchedAt)}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {ep.rating !== null && (
                                          <span
                                            className={`text-xs px-2.5 py-1 rounded-lg font-black ${ratingBgClass(
                                              ep.rating
                                            )}`}
                                          >
                                            ★ {ep.rating}
                                          </span>
                                        )}
                                        <button
                                          onClick={() => setEditingItem(ep)}
                                          className="text-ink-400 hover:text-azure-400 bg-ink-950 p-1.5 rounded-lg border border-ink-800 transition-colors"
                                          title="Bölüm Puanını / Notunu Düzenle"
                                        >
                                          <Edit2 size={13} />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Bölümün Seçili Değerlendirme Başlıkları */}
                                    {ep.reviewTags && ep.reviewTags.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {ep.reviewTags.map((t) => (
                                          <span
                                            key={t}
                                            className="text-[10px] font-bold bg-azure-500/15 text-azure-300 border border-azure-500/30 px-2 py-0.5 rounded-md"
                                          >
                                            {t}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {/* Bölümün Detaylı Kriter Rozetleri */}
                                    {ep.detailedRating && Object.keys(ep.detailedRating).length > 0 && (
                                      <div className="flex flex-wrap gap-1 pt-0.5">
                                        {Object.entries(ep.detailedRating).map(([cId, sc]) => {
                                          const cName =
                                            data.criteria?.find((c) => c.id === cId)?.name || cId;
                                          return (
                                            <span
                                              key={cId}
                                              className="text-[10px] font-bold bg-ink-950 text-ink-300 px-2 py-0.5 rounded-md border border-ink-800"
                                            >
                                              {cName}: <strong className="text-azure-400">{sc}</strong>
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Bölümün Günlük Notu (Tek Satır, Tıklayınca Büyür/Küçülür) */}
                                    {ep.note && (
                                      <div
                                        onClick={() => toggleNoteExpand(ep.id)}
                                        title={
                                          isEpNoteExpanded
                                            ? 'Küçültmek için tıkla'
                                            : 'Tamamını okumak için tıkla'
                                        }
                                        className="bg-ink-950/80 hover:bg-ink-950 rounded-xl p-2.5 border-l-2 border-azure-500 flex items-start gap-2 cursor-pointer transition-colors"
                                      >
                                        <Quote
                                          size={13}
                                          className="text-azure-400 flex-shrink-0 mt-0.5"
                                        />
                                        <p
                                          className={`text-xs text-ink-200 italic leading-relaxed flex-1 min-w-0 ${
                                            isEpNoteExpanded
                                              ? 'whitespace-pre-wrap break-words'
                                              : 'line-clamp-1'
                                          }`}
                                        >
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

      {/* PUAN, NOT VE BAŞLIK DÜZENLEME MODALI */}
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
          onRate={(rating, note, detailedRating, reviewTags) => {
            updateHistoryRating(editingItem.id, rating, note, detailedRating, reviewTags);
            setEditingItem(null);
          }}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* TAM SİNEMA KARTI MODALI */}
      {detailTarget && (
        <MediaDetailModal target={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  );
}

/* =========================================================
   GÖSTERİŞLİ FİLM GEÇMİŞİ KARTI (TEK SATIR TIKLANABİLİR NOT & BAŞLIK ROZETLERİ)
   ========================================================= */
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

  return (
    <div className="relative bg-ink-900/80 backdrop-blur-md border border-ink-700/60 hover:border-gold-500/40 rounded-3xl p-4 sm:p-5 shadow-xl transition-all overflow-hidden group">
      {movieData?.posterUrl && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-15 group-hover:opacity-25 transition-opacity">
          <img
            src={movieData.posterUrl}
            alt=""
            className="w-full h-full object-cover blur-3xl scale-125 saturate-150"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-transparent" />
        </div>
      )}

      <div className="relative z-10 flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
        <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
          <button
            type="button"
            onClick={onSelectDetail}
            title="Sinema Kartını & Detayları Gör"
            className="flex-shrink-0 w-16 sm:w-20 aspect-[2/3] rounded-2xl bg-ink-950 border-2 border-ink-700/60 flex items-center justify-center overflow-hidden shadow-xl relative group/poster cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold-500"
          >
            {movieData?.posterUrl ? (
              <img
                src={movieData.posterUrl}
                alt={item.title}
                className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300"
              />
            ) : (
              <Film size={26} className="text-ink-600" />
            )}
            <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/poster:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5 p-1">
              <div className="w-7 h-7 rounded-full bg-gold-500 text-ink-950 flex items-center justify-center shadow-md">
                <Eye size={14} />
              </div>
              <span className="text-[9px] font-black text-white uppercase tracking-wider">
                Künye
              </span>
            </div>
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-gold-500/20 text-gold-300 border border-gold-500/30">
                <Film size={11} /> Film Kaydı
              </span>
              {item.rating !== null && item.rating >= 9 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Award size={11} /> Favori Seçim
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onSelectDetail}
              className="text-lg sm:text-xl font-black text-ink-50 hover:text-gold-400 transition-colors text-left truncate block w-full mt-1"
              title="Sinema Kartını Gör"
            >
              {item.title}
            </button>

            <div className="text-xs text-ink-300 mt-1.5 flex items-center gap-2 flex-wrap font-medium">
              {(movieData?.year || item.year) && <span>{movieData?.year || item.year}</span>}
              {movieData?.runtime && (
                <>
                  <span className="text-ink-600">·</span>
                  <span>{movieData.runtime} dk</span>
                </>
              )}
              {movieData?.directors && movieData.directors.length > 0 && (
                <>
                  <span className="text-ink-600">·</span>
                  <span className="flex items-center gap-1 text-ink-200">
                    <User size={12} className="text-gold-400" /> {movieData.directors[0]}
                  </span>
                </>
              )}
              {item.genres && item.genres.length > 0 && (
                <>
                  <span className="text-ink-600">·</span>
                  <span className="text-ink-400 truncate">{item.genres.join(', ')}</span>
                </>
              )}
            </div>

            <div className="text-xs text-ink-400 mt-2 flex items-center gap-1.5 font-medium">
              <Clock size={12} className="text-gold-400" />
              <span>İzlendi: {formatDateTime(item.watchedAt)}</span>
            </div>

            {/* Seçilen Değerlendirme Başlıkları (🔥 Başyapıt, 🎭 Oyunculuk Muazzam vb.) */}
            {hasTags && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {item.reviewTags!.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-bold bg-gold-500/15 text-gold-300 border border-gold-500/30 px-2.5 py-0.5 rounded-lg shadow-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Varsa Detaylı Kriter Analizi Rozetleri */}
            {hasDetailed && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-azure-400 flex items-center gap-1 mr-1">
                  <SlidersHorizontal size={11} /> Kriterler:
                </span>
                {Object.entries(item.detailedRating!).map(([critId, score]) => {
                  const critName = criteriaList.find((c) => c.id === critId)?.name || critId;
                  return (
                    <span
                      key={critId}
                      className="text-[11px] font-bold bg-ink-950/90 text-ink-200 px-2.5 py-0.5 rounded-lg border border-ink-800"
                    >
                      {critName}: <strong className="text-gold-400">{score}</strong>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Eleştirmen İnceleme & Not Kutusu (SADECE TEK SATIR, TIKLAYINCA BÜYÜR/KÜÇÜLÜR) */}
            {item.note && (
              <div
                onClick={onToggleNote}
                title={isNoteExpanded ? 'Küçültmek için tıkla' : 'Tamamını okumak için tıkla'}
                className="mt-3 bg-ink-950/75 hover:bg-ink-950 border border-ink-800/90 hover:border-gold-500/40 border-l-4 border-l-gold-500 rounded-2xl px-3.5 py-2.5 relative cursor-pointer transition-all"
              >
                <div className="flex items-start gap-2.5">
                  <Quote size={15} className="text-gold-400 flex-shrink-0 mt-0.5 opacity-80" />
                  <p
                    className={`text-xs sm:text-sm text-ink-100 italic leading-relaxed flex-1 min-w-0 ${
                      isNoteExpanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-1'
                    }`}
                  >
                    {item.note}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sağ: Dev Puan Rozeti ve Düzenleme/İnceleme Butonları */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 pt-3 sm:pt-0 border-t border-ink-800/60 sm:border-0 flex-shrink-0">
          {item.rating !== null && (
            <div
              className={`px-4 py-2 rounded-2xl font-black text-lg sm:text-xl shadow-lg flex items-center gap-1.5 ${ratingBgClass(
                item.rating
              )}`}
            >
              <StarIcon size={17} className="fill-current" />
              <span>{item.rating}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onSelectDetail}
              className="flex items-center gap-1 text-xs font-bold bg-ink-950/80 hover:bg-ink-800 text-ink-300 hover:text-white px-2.5 py-1.5 rounded-xl border border-ink-800 transition-colors"
              title="Sinema Kartını Aç"
            >
              <Eye size={14} /> <span className="sm:hidden md:inline">Kart</span>
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1 text-xs font-bold bg-ink-950/80 hover:bg-ink-800 text-ink-300 hover:text-gold-400 px-2.5 py-1.5 rounded-xl border border-ink-800 transition-colors"
              title="Puanı ve Notu Düzenle"
            >
              <Edit2 size={14} /> <span className="sm:hidden md:inline">Düzenle</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}