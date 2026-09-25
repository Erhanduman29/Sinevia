import { useState, useMemo } from 'react';
import {
  Plus,
  Projector,
  Trash2,
  Boxes,
  ChevronDown,
  ChevronRight,
  Star,
  Calendar,
  Filter,
  ArrowDownAZ,
  CalendarDays,
  Star as StarIcon,
  Check,
  Search,
  Edit2,
  Shuffle,
  Clock,
  CalendarPlus,
  Image as ImageIcon,
  RefreshCw,
  Dna,
  PlayCircle,
  ExternalLink,
  Eye,
  FolderPlus,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass, formatDateShort } from '../lib/utils';
import { searchTMDB } from '../lib/tmdb';
import AddMovieModal from '../components/AddMovieModal';
import RatingModal from '../components/RatingModal';
import EditMovieModal from '../components/EditMovieModal';
import ConfirmDialog from '../components/ConfirmDialog';
import PickModal from '../components/PickModal';
import DnaSynthesizerModal from '../components/DnaSynthesizerModal';
import MediaDetailModal from '../components/MediaDetailModal';
import type { Movie } from '../types';

type SortMode = 'az' | 'year' | 'rating' | 'added';

export default function MoviesPage() {
  const {
    data,
    editMovie,
    deleteMovie,
    watchMovie,
    unwatchMovie,
    setMovieCollection,
    addCollection,
    showToast,
  } = useApp();

  const [showAdd, setShowAdd] = useState(false);
  const [showPick, setShowPick] = useState(false);
  const [showDna, setShowDna] = useState(false);
  const [pickedMovie, setPickedMovie] = useState<Movie | null>(null);
  const [ratingTarget, setRatingTarget] = useState<Movie | null>(null);
  const [editTarget, setEditTarget] = useState<Movie | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Movie | null>(null);
  const [detailMovieId, setDetailMovieId] = useState<string | null>(null);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());

  // Hızlı Koleksiyon Atama State'leri
  const [collectionTargetMovie, setCollectionTargetMovie] = useState<Movie | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [addMoviesToCollectionId, setAddMoviesToCollectionId] = useState<string | null>(null);
  const [collectionSearch, setCollectionSearch] = useState('');

  const [watchedFilter, setWatchedFilter] = useState<boolean | null>(false);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('added');
  const [search, setSearch] = useState('');

  const [isSyncing, setIsSyncing] = useState(false);

  const detailMovie = useMemo(
    () => (detailMovieId ? data.movies.find((m) => m.id === detailMovieId) || null : null),
    [data.movies, detailMovieId]
  );

  const handleSyncTMDB = async () => {
    setIsSyncing(true);
    const moviesToSync = data.movies.filter(
      (m) =>
        !m.tmdbId ||
        !m.posterUrl ||
        !m.keywords ||
        m.keywords.length === 0 ||
        !m.directors ||
        m.directors.length === 0 ||
        !m.cast ||
        m.cast.length === 0 ||
        !m.imdbId
    );
    let syncedCount = 0;

    for (const movie of moviesToSync) {
      try {
        const results = await searchTMDB(movie.title);
        if (results.length > 0) {
          const match = results.find((r) => r.year === movie.year) || results[0];
          const newGenres = Array.from(new Set([...movie.genres, ...match.genres]));

          editMovie(
            movie.id,
            movie.title,
            match.year || movie.year,
            newGenres,
            match.runtime || movie.runtime,
            match.posterUrl || movie.posterUrl,
            match.overview || movie.overview,
            match.id,
            true,
            movie.customUrl,
            match.imdbId || movie.imdbId,
            match.watchProviders && match.watchProviders.length > 0
              ? match.watchProviders
              : movie.watchProviders,
            {
              directors:
                match.directors && match.directors.length > 0
                  ? match.directors
                  : movie.directors,
              cast: match.cast && match.cast.length > 0 ? match.cast : movie.cast,
              studios:
                match.studios && match.studios.length > 0 ? match.studios : movie.studios,
              keywords:
                match.keywords && match.keywords.length > 0 ? match.keywords : movie.keywords,
              originalLanguage: match.originalLanguage || movie.originalLanguage,
            }
          );
          syncedCount++;
        }
      } catch (e) {
        console.error(`Senkronizasyon hatası (${movie.title}):`, e);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    setIsSyncing(false);
    if (syncedCount > 0) {
      showToast(`${syncedCount} filme Sinema Kartı, DNA ve izleme bilgileri eklendi!`, 'success');
    } else {
      showToast('Kütüphanenin tüm film künyeleri güncel.', 'info');
    }
  };

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    data.movies.forEach((m) => m.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [data.movies]);

  const eligibleMovies = useMemo(() => {
    const unwatched = data.movies.filter((m) => !m.watched);
    const standalone = unwatched.filter((m) => !m.collectionId);

    const collectionGroups = new Map<string, Movie[]>();
    unwatched
      .filter((m) => m.collectionId)
      .forEach((m) => {
        const arr = collectionGroups.get(m.collectionId!) || [];
        arr.push(m);
        collectionGroups.set(m.collectionId!, arr);
      });

    const sequentialCollectionMovies: Movie[] = [];
    collectionGroups.forEach((movies) => {
      const sorted = [...movies].sort((a, b) => {
        const yearA = parseInt(a.year || '9999', 10);
        const yearB = parseInt(b.year || '9999', 10);
        return yearA - yearB;
      });
      if (sorted.length > 0) sequentialCollectionMovies.push(sorted[0]);
    });

    return [...standalone, ...sequentialCollectionMovies];
  }, [data.movies]);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const clearGenres = () => setSelectedGenres(new Set());

  const searchMatches = (m: Movie) => {
    if (!search.trim()) return true;
    const q = search.toLocaleLowerCase('tr-TR');
    return m.title.toLocaleLowerCase('tr-TR').includes(q);
  };

  const sortMovies = (movies: Movie[]): Movie[] => {
    let filtered = movies;

    if (watchedFilter !== null) {
      filtered = filtered.filter((m) => m.watched === watchedFilter);
    }

    if (selectedGenres.size > 0) {
      filtered = filtered.filter((m) =>
        Array.from(selectedGenres).every((g) => m.genres.includes(g))
      );
    }

    filtered = filtered.filter(searchMatches);

    return [...filtered].sort((a, b) => {
      if (sortMode === 'az') return a.title.localeCompare(b.title, 'tr');
      if (sortMode === 'year') return (a.year || '9999').localeCompare(b.year || '9999');
      if (sortMode === 'added')
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      const ra = a.watched ? (a.rating ?? -1) : -1;
      const rb = b.watched ? (b.rating ?? -1) : -1;
      return rb - ra;
    });
  };

  const standaloneMovies = data.movies.filter((m) => !m.collectionId);
  const collectionMovies = data.movies.filter((m) => m.collectionId);

  const collectionMap = new Map<string, Movie[]>();
  collectionMovies.forEach((m) => {
    const arr = collectionMap.get(m.collectionId!) || [];
    arr.push(m);
    collectionMap.set(m.collectionId!, arr);
  });

  const toggleCollection = (id: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssignCollection = (movie: Movie, colId: string | null) => {
    setMovieCollection(movie.id, colId);
    if (colId) {
      const colName = data.collections.find((c) => c.id === colId)?.name || 'Koleksiyon';
      showToast(`"${movie.title}" ➔ ${colName} koleksiyonuna eklendi`, 'success');
    } else {
      showToast(`"${movie.title}" koleksiyondan çıkarıldı`, 'info');
    }
    setCollectionTargetMovie(null);
    setNewCollectionName('');
  };

  const handleCreateAndAssignCollection = () => {
    if (!collectionTargetMovie || !newCollectionName.trim()) return;
    const newId = addCollection(newCollectionName.trim());
    setMovieCollection(collectionTargetMovie.id, newId);
    showToast(
      `"${collectionTargetMovie.title}" ➔ ${newCollectionName.trim()} koleksiyonuna eklendi`,
      'success'
    );
    setNewCollectionName('');
    setCollectionTargetMovie(null);
  };

  const sortedStandalone = sortMovies(standaloneMovies);
  const totalUnwatched = data.movies.filter((m) => !m.watched).length;
  const totalWatched = data.movies.filter((m) => m.watched).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-ink-100 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500/20 to-gold-700/20 border border-gold-500/30 flex items-center justify-center">
            <Projector size={22} className="text-gold-300" />
          </div>
          Filmler
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDna(true)}
            className="flex items-center gap-2 bg-emerald-900/30 hover:bg-emerald-800/40 text-emerald-400 border border-emerald-500/30 px-3.5 py-2.5 rounded-lg font-semibold transition-all shadow-sm"
          >
            <Dna size={18} />
            <span className="hidden sm:inline">DNA Sentezle</span>
          </button>

          <button
            onClick={handleSyncTMDB}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-ink-800/80 hover:bg-ink-700 text-gold-300 border border-gold-500/30 px-3.5 py-2.5 rounded-lg font-semibold transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">
              {isSyncing ? 'Taranıyor...' : 'Eksikleri Bul'}
            </span>
          </button>

          <button
            onClick={() => setShowPick(true)}
            className="flex items-center gap-2 bg-ink-800/80 hover:bg-ink-700 text-gold-300 border border-gold-500/30 px-3.5 py-2.5 rounded-lg font-semibold transition-all shadow-sm"
          >
            <Shuffle size={18} />
            <span className="hidden sm:inline">Bugün Ne İzlesem</span>
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-ink-950 px-4 py-2.5 rounded-lg font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20"
          >
            <Plus size={20} />
            Film Ekle
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex bg-ink-800/50 rounded-lg p-1 border border-ink-700/50 w-fit">
          <button
            onClick={() => setWatchedFilter(null)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              watchedFilter === null
                ? 'bg-ink-700 text-ink-100'
                : 'text-ink-400 hover:text-ink-300'
            }`}
          >
            Tümü ({data.movies.length})
          </button>
          <button
            onClick={() => setWatchedFilter(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              watchedFilter === false
                ? 'bg-gold-500/20 text-gold-400'
                : 'text-ink-400 hover:text-ink-300'
            }`}
          >
            İzlenecekler ({totalUnwatched})
          </button>
          <button
            onClick={() => setWatchedFilter(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              watchedFilter === true
                ? 'bg-green-500/20 text-green-400'
                : 'text-ink-400 hover:text-ink-300'
            }`}
          >
            İzlenenler ({totalWatched})
          </button>
        </div>

        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Film ara..."
            className="w-full bg-ink-800/80 border border-ink-700 rounded-lg pl-10 pr-4 py-2 text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/30 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-ink-500">
            <Filter size={14} />
          </div>
          <button
            onClick={() => setSortMode('added')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortMode === 'added'
                ? 'bg-gold-500/20 border border-gold-500/30 text-gold-300'
                : 'bg-ink-800/50 border border-ink-700/50 text-ink-400 hover:text-ink-200'
            }`}
          >
            <CalendarPlus size={14} />
            Eklenme
          </button>
          <button
            onClick={() => setSortMode('az')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortMode === 'az'
                ? 'bg-gold-500/20 border border-gold-500/30 text-gold-300'
                : 'bg-ink-800/50 border border-ink-700/50 text-ink-400 hover:text-ink-200'
            }`}
          >
            <ArrowDownAZ size={14} />
            A-Z
          </button>
          <button
            onClick={() => setSortMode('year')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortMode === 'year'
                ? 'bg-gold-500/20 border border-gold-500/30 text-gold-300'
                : 'bg-ink-800/50 border border-ink-700/50 text-ink-400 hover:text-ink-200'
            }`}
          >
            <CalendarDays size={14} />
            Yıl
          </button>
          <button
            onClick={() => setSortMode('rating')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortMode === 'rating'
                ? 'bg-gold-500/20 border border-gold-500/30 text-gold-300'
                : 'bg-ink-800/50 border border-ink-700/50 text-ink-400 hover:text-ink-200'
            }`}
          >
            <StarIcon size={14} />
            Puan
          </button>
        </div>

        {allGenres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <button
              onClick={clearGenres}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedGenres.size === 0
                  ? 'bg-gold-500 text-ink-950'
                  : 'bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-ink-200'
              }`}
            >
              Tümü
            </button>
            {allGenres.map((g) => {
              const active = selectedGenres.has(g);
              return (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    active
                      ? 'bg-gold-500 text-ink-950'
                      : 'bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-ink-200'
                  }`}
                >
                  {active && <Check size={11} />}
                  {g}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* KOLEKSİYONLAR LİSTESİ */}
      {data.collections.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wide flex items-center gap-2">
            <Boxes size={16} className="text-gold-400" /> Koleksiyonlar
          </h2>
          {data.collections.map((coll) => {
            const movies = collectionMap.get(coll.id) || [];

            const matchesSearch =
              search.trim() === '' ||
              coll.name.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')) ||
              movies.some((m) =>
                m.title.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'))
              );

            if (!matchesSearch) return null;

            const visibleMovies = [...movies].sort((a, b) => {
              const yearA = parseInt(a.year || '9999', 10);
              const yearB = parseInt(b.year || '9999', 10);
              return yearA - yearB;
            });

            const isExpanded = expandedCollections.has(coll.id);

            return (
              <div
                key={coll.id}
                className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl overflow-hidden shadow-lg shadow-ink-950/30 transition-all hover:border-ink-600/50"
              >
                <div className="w-full flex items-center justify-between p-4 hover:bg-ink-800/40 transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleCollection(coll.id)}
                    className="flex items-center gap-2.5 flex-1 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown size={18} className="text-ink-500" />
                    ) : (
                      <ChevronRight size={18} className="text-ink-500" />
                    )}
                    <Boxes size={18} className="text-gold-400" />
                    <span className="font-semibold text-ink-100">{coll.name}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAddMoviesToCollectionId(coll.id);
                        setCollectionSearch('');
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold text-gold-400 hover:text-gold-300 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/30 px-2.5 py-1 rounded-lg transition-colors"
                      title="Listeden bu koleksiyona film ekle"
                    >
                      <Plus size={12} /> Film Ekle
                    </button>
                    <span className="text-xs text-ink-500 bg-ink-800/60 px-2.5 py-1 rounded-full">
                      {visibleMovies.length} film
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-ink-700/40">
                    {visibleMovies.length === 0 ? (
                      <div className="p-4 text-xs text-ink-500 text-center">
                        Bu koleksiyonda henüz film yok. Sağ üstteki "+ Film Ekle" butonundan ekleyebilirsin.
                      </div>
                    ) : (
                      visibleMovies.map((m) => (
                        <MovieRow
                          key={m.id}
                          movie={m}
                          collectionName={coll.name}
                          onDelete={(movie) => setDeleteTarget(movie)}
                          onRate={(movie) => setRatingTarget(movie)}
                          onUnwatch={unwatchMovie}
                          onEdit={(movie) => setEditTarget(movie)}
                          onAssignCollection={(movie) => setCollectionTargetMovie(movie)}
                          onSelectDetail={(movie) => setDetailMovieId(movie.id)}
                          altWatchTemplate={data.altWatchTemplate}
                        />
                      ))
                    )}
                  </div>
                )}

                {!isExpanded && visibleMovies.length > 0 && (
                  <div className="px-4 pb-4 flex items-center gap-2 overflow-x-auto hide-scrollbar pt-1">
                    {visibleMovies.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        title={`${m.title} - Detayları Gör`}
                        onClick={() => setDetailMovieId(m.id)}
                        className="w-10 sm:w-12 aspect-[2/3] flex-shrink-0 rounded-md overflow-hidden border border-ink-700/50 shadow-sm relative group cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold-500"
                      >
                        {m.posterUrl ? (
                          <img
                            src={m.posterUrl}
                            alt={m.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-ink-800 flex items-center justify-center">
                            <ImageIcon size={14} className="text-ink-600" />
                          </div>
                        )}
                        {m.watched && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px] group-hover:opacity-0 transition-opacity">
                            <Check size={16} className="text-green-400 drop-shadow-md" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye size={14} className="text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* BAĞIMSIZ FİLMLER LİSTESİ */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wide">
          Bağımsız Filmler
        </h2>
        {sortedStandalone.length === 0 ? (
          <div className="text-center py-12 text-ink-500">
            <Projector size={40} className="mx-auto mb-3 opacity-40" />
            <p>
              {watchedFilter === true
                ? 'İzlenen film yok.'
                : watchedFilter === false
                ? 'İzlenecek film kalmadı.'
                : 'Aramaya uygun film bulunamadı.'}
            </p>
          </div>
        ) : (
          sortedStandalone.map((m) => (
            <MovieRow
              key={m.id}
              movie={m}
              onDelete={(movie) => setDeleteTarget(movie)}
              onRate={(movie) => setRatingTarget(movie)}
              onUnwatch={unwatchMovie}
              onEdit={(movie) => setEditTarget(movie)}
              onAssignCollection={(movie) => setCollectionTargetMovie(movie)}
              onSelectDetail={(movie) => setDetailMovieId(movie.id)}
              altWatchTemplate={data.altWatchTemplate}
            />
          ))
        )}
      </div>

      {/* =========================================================
          TEK TIKLA FİLMİ KOLEKSİYONA EKLEME / TAŞIMA MODALI
          ========================================================= */}
      {collectionTargetMovie && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setCollectionTargetMovie(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-up"
          >
            <div className="flex items-center justify-between p-4 border-b border-ink-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                  <Boxes size={18} className="text-gold-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white truncate">
                    Koleksiyona Ekle / Değiştir
                  </h3>
                  <p className="text-xs text-gold-400 truncate font-medium">
                    {collectionTargetMovie.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCollectionTargetMovie(null)}
                className="text-ink-400 hover:text-white p-1.5 rounded-full hover:bg-ink-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Yeni Koleksiyon Oluşturup Direkt Atama */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-ink-400 flex items-center gap-1.5">
                  <FolderPlus size={13} className="text-gold-400" /> Yeni Koleksiyon Oluştur ve Ata
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Yeni koleksiyon adı yaz..."
                    className="flex-1 bg-ink-950 border border-ink-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-ink-500 focus:outline-none focus:border-gold-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateAndAssignCollection();
                    }}
                  />
                  <button
                    type="button"
                    disabled={!newCollectionName.trim()}
                    onClick={handleCreateAndAssignCollection}
                    className="bg-gold-500 hover:bg-gold-400 text-ink-950 font-black px-4 py-2 rounded-xl text-xs transition-all disabled:opacity-40"
                  >
                    Oluştur
                  </button>
                </div>
              </div>

              {/* Mevcut Koleksiyonlardan Seç */}
              <div className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-ink-400">
                  Mevcut Koleksiyonlar ({data.collections.length})
                </div>

                {data.collections.length === 0 ? (
                  <p className="text-xs text-ink-500 py-3 text-center bg-ink-950/50 rounded-xl border border-ink-800">
                    Henüz hiç koleksiyon yok. Yukarıdan yeni bir koleksiyon oluşturabilirsin.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {data.collections.map((col) => {
                      const isCurrent = collectionTargetMovie.collectionId === col.id;
                      const count = (collectionMap.get(col.id) || []).length;
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => handleAssignCollection(collectionTargetMovie, col.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                            isCurrent
                              ? 'bg-gold-500/20 border-gold-500 text-gold-300 font-black'
                              : 'bg-ink-950/60 hover:bg-ink-800 border-ink-800 text-ink-200 font-semibold'
                          }`}
                        >
                          <span className="flex items-center gap-2 text-xs truncate">
                            <Boxes
                              size={15}
                              className={isCurrent ? 'text-gold-400' : 'text-ink-400'}
                            />
                            {col.name}
                          </span>
                          <span className="flex items-center gap-2 text-[11px] text-ink-400 flex-shrink-0">
                            <span>{count} film</span>
                            {isCurrent && <Check size={15} className="text-gold-400" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Koleksiyondan Çıkar */}
              {collectionTargetMovie.collectionId && (
                <button
                  type="button"
                  onClick={() => handleAssignCollection(collectionTargetMovie, null)}
                  className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold transition-colors"
                >
                  Koleksiyondan Çıkar (Bağımsız Film Yap)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          KOLEKSİYON İÇİNE LİSTEDEN ÇOKLU FİLM SEÇME MODALI
          ========================================================= */}
      {addMoviesToCollectionId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setAddMoviesToCollectionId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[82vh] animate-fade-in-up"
          >
            <div className="flex items-center justify-between p-4 border-b border-ink-800">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Boxes size={17} className="text-gold-400" />
                  {data.collections.find((c) => c.id === addMoviesToCollectionId)?.name}{' '}
                  Koleksiyonuna Film Ekle
                </h3>
                <p className="text-xs text-ink-400 mt-0.5">
                  Listendeki filmlere tıklayarak bu koleksiyona dahil edebilir veya çıkarabilirsin
                </p>
              </div>
              <button
                onClick={() => setAddMoviesToCollectionId(null)}
                className="text-ink-400 hover:text-white p-1.5 rounded-full hover:bg-ink-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 border-b border-ink-800 bg-ink-950/40">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
                />
                <input
                  type="text"
                  value={collectionSearch}
                  onChange={(e) => setCollectionSearch(e.target.value)}
                  placeholder="Listendeki filmlerde ara..."
                  className="w-full bg-ink-900 border border-ink-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-ink-500 focus:outline-none focus:border-gold-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
              {data.movies
                .filter(
                  (m) =>
                    !collectionSearch.trim() ||
                    m.title
                      .toLocaleLowerCase('tr-TR')
                      .includes(collectionSearch.toLocaleLowerCase('tr-TR'))
                )
                .map((m) => {
                  const isInThisCollection = m.collectionId === addMoviesToCollectionId;
                  const otherColName =
                    m.collectionId && !isInThisCollection
                      ? data.collections.find((c) => c.id === m.collectionId)?.name
                      : null;

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        setMovieCollection(
                          m.id,
                          isInThisCollection ? null : addMoviesToCollectionId
                        )
                      }
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                        isInThisCollection
                          ? 'bg-gold-500/20 border-gold-500/50 text-white'
                          : 'bg-ink-950/50 hover:bg-ink-800/70 border-ink-800/80 text-ink-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-11 rounded bg-ink-900 overflow-hidden flex-shrink-0 border border-ink-700">
                          {m.posterUrl ? (
                            <img
                              src={m.posterUrl}
                              alt={m.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon size={12} className="text-ink-600" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{m.title}</div>
                          <div className="text-[10px] text-ink-400">
                            {m.year || 'Yıl yok'}
                            {otherColName ? ` · Mevcut: ${otherColName}` : ''}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 flex-shrink-0 ${
                          isInThisCollection
                            ? 'bg-gold-500 text-ink-950'
                            : 'bg-ink-800 text-ink-300'
                        }`}
                      >
                        {isInThisCollection ? (
                          <>
                            <Check size={12} /> Eklendi
                          </>
                        ) : (
                          <>
                            <Plus size={12} /> Ekle
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>

            <div className="p-3 border-t border-ink-800 bg-ink-950/60">
              <button
                type="button"
                onClick={() => setAddMoviesToCollectionId(null)}
                className="w-full py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink-950 font-black text-xs transition-colors"
              >
                Tamamla
              </button>
            </div>
          </div>
        </div>
      )}

      {showPick && (
        <PickModal
          movieCount={eligibleMovies.length}
          seriesCount={0}
          unwatchedMovies={eligibleMovies}
          nextEpisodes={[]}
          onPick={(item) => {
            if (item.kind === 'movie') setPickedMovie(item.movie);
          }}
          onClose={() => setShowPick(false)}
        />
      )}

      {showDna && <DnaSynthesizerModal onClose={() => setShowDna(false)} />}

      {pickedMovie && (
        <RatingModal
          title={pickedMovie.title}
          subtitle={pickedMovie.year ? `Çıkış Yılı: ${pickedMovie.year}` : 'Film'}
          onRate={(rating, note, detailedRating, reviewTags) => {
            watchMovie(pickedMovie.id, rating, note, detailedRating, reviewTags);
            setPickedMovie(null);
          }}
          onClose={() => setPickedMovie(null)}
        />
      )}

      {showAdd && <AddMovieModal onClose={() => setShowAdd(false)} />}
      {ratingTarget && (
        <RatingModal
          title={ratingTarget.title}
          subtitle={ratingTarget.year ? `Çıkış Yılı: ${ratingTarget.year}` : 'Film'}
          onRate={(rating, note, detailedRating, reviewTags) =>
            watchMovie(ratingTarget.id, rating, note, detailedRating, reviewTags)
          }
          onClose={() => setRatingTarget(null)}
        />
      )}
      {editTarget && (
        <EditMovieModal movie={editTarget} onClose={() => setEditTarget(null)} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Film Sil"
          message={`"${deleteTarget.title}" silinecek. Emin misin?`}
          onConfirm={() => {
            deleteMovie(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {detailMovie && (
        <MediaDetailModal
          target={{ type: 'movie', data: detailMovie }}
          onClose={() => setDetailMovieId(null)}
        />
      )}
    </div>
  );
}

function MovieRow({
  movie,
  collectionName,
  onDelete,
  onRate,
  onUnwatch,
  onEdit,
  onAssignCollection,
  onSelectDetail,
  altWatchTemplate,
}: {
  movie: Movie;
  collectionName?: string;
  onDelete: (movie: Movie) => void;
  onRate: (movie: Movie) => void;
  onUnwatch: (id: string) => void;
  onEdit: (movie: Movie) => void;
  onAssignCollection: (movie: Movie) => void;
  onSelectDetail: (movie: Movie) => void;
  altWatchTemplate?: string;
}) {
  const watchLinks: { href: string; text: string; logo: string | null; icon: any }[] = [];

  if (movie.customUrl) {
    watchLinks.push({
      href: movie.customUrl,
      text: 'Özel Kaynak',
      logo: null,
      icon: ExternalLink,
    });
  }

  if (movie.watchProviders && movie.watchProviders.length > 0) {
    movie.watchProviders.slice(0, 2).forEach((provider) => {
      let finalHref = provider.link || '';
      const pName = provider.providerName.toLowerCase();

      if (pName.includes('netflix'))
        finalHref = `https://www.netflix.com/search?q=${encodeURIComponent(movie.title)}`;
      else if (pName.includes('amazon') || pName.includes('prime'))
        finalHref = `https://www.primevideo.com/search/ref=atv_sr_sug_1?phrase=${encodeURIComponent(
          movie.title
        )}`;
      else if (pName.includes('disney'))
        finalHref = `https://www.disneyplus.com/search?q=${encodeURIComponent(movie.title)}`;
      else if (pName.includes('blutv'))
        finalHref = `https://www.blutv.com/arama?q=${encodeURIComponent(movie.title)}`;
      else if (pName.includes('mubi'))
        finalHref = `https://mubi.com/tr/search?query=${encodeURIComponent(movie.title)}`;
      else if (pName.includes('apple'))
        finalHref = `https://tv.apple.com/tr/search?q=${encodeURIComponent(movie.title)}`;

      watchLinks.push({
        href: finalHref,
        text: provider.providerName,
        logo: provider.logoUrl,
        icon: PlayCircle,
      });
    });
  }

  const searchQuery = encodeURIComponent(`${movie.title} ${movie.year || ''} izle`);
  watchLinks.push({
    href: `https://www.google.com/search?q=${searchQuery}`,
    text: "Google'da Bul",
    logo: null,
    icon: Search,
  });

  if (
    altWatchTemplate &&
    (movie.imdbId || altWatchTemplate.includes('{slug}') || altWatchTemplate.includes('{title}'))
  ) {
    const charMap: Record<string, string> = {
      ç: 'c',
      ğ: 'g',
      ı: 'i',
      ö: 'o',
      ş: 's',
      ü: 'u',
    };
    const slug = movie.title
      .toLocaleLowerCase('tr-TR')
      .replace(/[çğıöşü]/g, (match) => charMap[match])
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const finalAltHref = altWatchTemplate
      .replace('{imdb}', movie.imdbId || '')
      .replace('{slug}', slug)
      .replace('{title}', encodeURIComponent(movie.title))
      .replace('{year}', movie.year || '');

    watchLinks.push({ href: finalAltHref, text: 'Alternatif', logo: null, icon: PlayCircle });
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-ink-800/40 transition-colors group border-b border-ink-800/40 last:border-0 relative">
      <div className="flex gap-3 sm:gap-4 flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onSelectDetail(movie)}
          title="Sinema Kartını & Detayları Gör"
          className="w-16 sm:w-20 aspect-[2/3] flex-shrink-0 bg-ink-900 rounded-lg overflow-hidden flex items-center justify-center border border-ink-700/50 shadow-md relative group/poster cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold-500"
        >
          {movie.posterUrl ? (
            <img
              src={movie.posterUrl}
              alt={movie.title}
              className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300"
            />
          ) : (
            <ImageIcon size={20} className="text-ink-600" />
          )}
          <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/poster:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
            <div className="w-7 h-7 rounded-full bg-gold-500/90 text-ink-950 flex items-center justify-center shadow-md transform scale-75 group-hover/poster:scale-100 transition-transform">
              <Eye size={15} />
            </div>
            <span className="text-[9px] font-black text-white uppercase tracking-wider">
              İncele
            </span>
          </div>
        </button>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => onSelectDetail(movie)}
              className={`font-bold text-sm sm:text-base truncate text-left hover:text-gold-400 transition-colors ${
                movie.watched ? 'text-ink-500 line-through' : 'text-ink-100'
              }`}
              title="Sinema Kartını Gör"
            >
              {movie.title}
            </button>
            {collectionName && (
              <button
                type="button"
                onClick={() => onAssignCollection(movie)}
                title="Koleksiyonu Değiştir"
                className="text-[10px] text-gold-400 hover:text-gold-300 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 whitespace-nowrap transition-colors"
              >
                <Boxes size={10} /> {collectionName}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-[10px] sm:text-xs text-ink-400 mb-1">
            {movie.year && (
              <span className="flex items-center gap-1">
                <Calendar size={12} /> {movie.year}
              </span>
            )}
            {movie.runtime && (
              <span className="flex items-center gap-1">
                <Clock size={12} /> {movie.runtime} dk
              </span>
            )}
          </div>

          {movie.genres.length > 0 && (
            <div className="text-[10px] sm:text-xs text-ink-500 truncate mb-2">
              {movie.genres.join(' · ')}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap mt-auto">
            {movie.watched && movie.rating !== null && (
              <div className="flex items-center gap-1.5 mr-2">
                <span
                  className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold shadow-sm ${ratingBgClass(
                    movie.rating
                  )}`}
                >
                  {movie.rating}
                </span>
                <span className="text-[10px] text-ink-500 hidden sm:inline">
                  {formatDateShort(movie.watchedAt!)}
                </span>
              </div>
            )}

            {watchLinks.map((link, idx) => {
              const Icon = link.icon;
              return (
                <a
                  key={idx}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 bg-ink-800/80 hover:bg-gold-900/30 text-gold-400 border border-gold-500/30 px-2 py-1 sm:py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold transition-all hover:scale-105"
                >
                  {link.logo ? (
                    <img
                      src={link.logo}
                      alt="Platform"
                      className="w-3.5 h-3.5 rounded-sm object-cover"
                    />
                  ) : (
                    <Icon size={12} />
                  )}
                  {link.text}
                </a>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 sm:gap-1.5 pt-3 sm:pt-0 mt-1 sm:mt-0 border-t border-ink-800/50 sm:border-0 flex-shrink-0">
        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
          {movie.watched ? (
            <button
              onClick={() => onUnwatch(movie.id)}
              className="flex-1 sm:flex-none text-xs text-ink-400 hover:text-ink-200 bg-ink-800/50 hover:bg-ink-700 px-3 py-1.5 rounded-lg transition-colors border border-ink-700/50"
            >
              Geri Al
            </button>
          ) : (
            <button
              onClick={() => onRate(movie)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-ink-950 px-4 py-1.5 rounded-lg transition-all shadow-md shadow-gold-500/10 font-bold"
            >
              <Star size={14} /> Puanla
            </button>
          )}
          <div className="flex items-center gap-1 ml-auto sm:ml-0">
            <button
              onClick={() => onAssignCollection(movie)}
              title="Koleksiyona Ekle / Değiştir"
              className={`p-1.5 rounded-lg transition-colors border ${
                movie.collectionId
                  ? 'text-gold-400 bg-gold-500/10 border-gold-500/30 hover:bg-gold-500/20'
                  : 'text-ink-500 hover:text-gold-400 bg-ink-900/50 hover:bg-ink-800 border-transparent hover:border-ink-700'
              }`}
            >
              <Boxes size={15} />
            </button>
            <button
              onClick={() => onEdit(movie)}
              title="Filmi Düzenle"
              className="text-ink-500 hover:text-gold-400 bg-ink-900/50 hover:bg-ink-800 p-1.5 rounded-lg transition-colors border border-transparent hover:border-ink-700"
            >
              <Edit2 size={15} />
            </button>
            <button
              onClick={() => onDelete(movie)}
              title="Filmi Sil"
              className="text-ink-500 hover:text-red-400 bg-ink-900/50 hover:bg-ink-800 p-1.5 rounded-lg transition-colors border border-transparent hover:border-ink-700"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}