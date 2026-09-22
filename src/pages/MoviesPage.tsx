import { useState, useMemo } from 'react';
import { Plus, Projector, Trash2, Boxes, ChevronDown, ChevronRight, Star, Calendar, Filter, ArrowDownAZ, CalendarDays, Star as StarIcon, Check, Search, Edit2, Shuffle, Clock, CalendarPlus, Image as ImageIcon, RefreshCw, Dna } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass, formatDateShort } from '../lib/utils';
import { searchTMDB } from '../lib/tmdb';
import AddMovieModal from '../components/AddMovieModal';
import RatingModal from '../components/RatingModal';
import EditMovieModal from '../components/EditMovieModal';
import ConfirmDialog from '../components/ConfirmDialog';
import PickModal from '../components/PickModal';
import DnaSynthesizerModal from '../components/DnaSynthesizerModal';
import type { Movie } from '../types';

type SortMode = 'az' | 'year' | 'rating' | 'added';

export default function MoviesPage() {
  const { data, editMovie, deleteMovie, watchMovie, unwatchMovie, showToast } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [showPick, setShowPick] = useState(false);
  const [showDna, setShowDna] = useState(false);
  const [pickedMovie, setPickedMovie] = useState<Movie | null>(null);
  const [ratingTarget, setRatingTarget] = useState<Movie | null>(null);
  const [editTarget, setEditTarget] = useState<Movie | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Movie | null>(null);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  
  const [watchedFilter, setWatchedFilter] = useState<boolean | null>(false);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('added');
  const [search, setSearch] = useState('');
  
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncTMDB = async () => {
    setIsSyncing(true);
    // DÜZELTİLDİ: Sadece afişi eksik olanları değil, DNA'sı (keywords/directors) eksik olanları da bulur
    const moviesToSync = data.movies.filter(m => !m.tmdbId || !m.posterUrl || !m.keywords || !m.directors);
    let syncedCount = 0;
    
    for (const movie of moviesToSync) {
      try {
        const results = await searchTMDB(movie.title);
        if (results.length > 0) {
          const match = results.find(r => r.year === movie.year) || results[0];
          const newGenres = Array.from(new Set([...movie.genres, ...match.genres]));
          
          editMovie(
            movie.id, 
            movie.title, 
            match.year || movie.year, 
            newGenres, 
            match.runtime || movie.runtime, 
            match.posterUrl, 
            match.overview, 
            match.id,
            true 
          );
          syncedCount++;
        }
      } catch (e) {
        console.error(`Senkronizasyon hatası (${movie.title}):`, e);
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    
    setIsSyncing(false);
    if (syncedCount > 0) {
      showToast(`${syncedCount} filme DNA ve eksik veriler eklendi!`, 'success');
    } else {
      showToast('Kütüphanenin DNA verileri tamamen güncel.', 'info');
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
    unwatched.filter((m) => m.collectionId).forEach((m) => {
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
      filtered = filtered.filter(m => m.watched === watchedFilter);
    }

    if (selectedGenres.size > 0) {
      filtered = filtered.filter((m) => Array.from(selectedGenres).every((g) => m.genres.includes(g)));
    }
    
    filtered = filtered.filter(searchMatches);
    
    return [...filtered].sort((a, b) => {
      if (sortMode === 'az') return a.title.localeCompare(b.title, 'tr');
      if (sortMode === 'year') return (a.year || '9999').localeCompare(b.year || '9999');
      if (sortMode === 'added') return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
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
          {/* DNA Sentez Butonu */}
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
            <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{isSyncing ? 'Taranıyor...' : 'Eksikleri Bul'}</span>
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
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${watchedFilter === null ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-300'}`}
          >
            Tümü ({data.movies.length})
          </button>
          <button
            onClick={() => setWatchedFilter(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${watchedFilter === false ? 'bg-gold-500/20 text-gold-400' : 'text-ink-400 hover:text-ink-300'}`}
          >
            İzlenecekler ({totalUnwatched})
          </button>
          <button
            onClick={() => setWatchedFilter(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${watchedFilter === true ? 'bg-green-500/20 text-green-400' : 'text-ink-400 hover:text-ink-300'}`}
          >
            İzlenenler ({totalWatched})
          </button>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
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

      {collectionMap.size > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wide flex items-center gap-2">
            <Boxes size={16} className="text-gold-400" /> Koleksiyonlar
          </h2>
          {Array.from(collectionMap.entries()).map(([collId, movies]) => {
            const coll = data.collections.find((c) => c.id === collId);
            if (!coll) return null;
            
            const matchesSearch = search.trim() === '' || 
              coll.name.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')) ||
              movies.some(m => m.title.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')));
              
            if (!matchesSearch) return null;

            const visibleMovies = [...movies].sort((a, b) => {
              const yearA = parseInt(a.year || '9999', 10);
              const yearB = parseInt(b.year || '9999', 10);
              return yearA - yearB;
            });
            
            const isExpanded = expandedCollections.has(collId);

            return (
              <div key={collId} className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl overflow-hidden shadow-lg shadow-ink-950/30 transition-all hover:border-ink-600/50">
                <button
                  onClick={() => toggleCollection(collId)}
                  className="w-full flex items-center justify-between p-4 hover:bg-ink-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {isExpanded ? <ChevronDown size={18} className="text-ink-500" /> : <ChevronRight size={18} className="text-ink-500" />}
                    <Boxes size={18} className="text-gold-400" />
                    <span className="font-semibold text-ink-100">{coll.name}</span>
                  </div>
                  <span className="text-xs text-ink-500 bg-ink-800/60 px-2 py-0.5 rounded-full">{visibleMovies.length} film</span>
                </button>
                {isExpanded && (
                  <div className="border-t border-ink-700/40">
                    {visibleMovies.map((m) => (
                      <MovieRow
                        key={m.id}
                        movie={m}
                        collectionName={coll.name}
                        onDelete={(movie) => setDeleteTarget(movie)}
                        onRate={(movie) => setRatingTarget(movie)}
                        onUnwatch={unwatchMovie}
                        onEdit={(movie) => setEditTarget(movie)}
                      />
                    ))}
                  </div>
                )}
                {!isExpanded && (
                  <div className="px-4 pb-3 text-xs text-ink-500">
                    {visibleMovies.map((m) => m.title).join(' · ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wide">Bağımsız Filmler</h2>
        {sortedStandalone.length === 0 ? (
          <div className="text-center py-12 text-ink-500">
            <Projector size={40} className="mx-auto mb-3 opacity-40" />
            <p>{watchedFilter === true ? 'İzlenen film yok.' : watchedFilter === false ? 'İzlenecek film kalmadı.' : 'Aramaya uygun film bulunamadı.'}</p>
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
            />
          ))
        )}
      </div>

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

      {/* YENİ EKLENEN DNA SENTEZLEYİCİ */}
      {showDna && <DnaSynthesizerModal onClose={() => setShowDna(false)} />}

      {pickedMovie && (
        <RatingModal
          title={pickedMovie.title}
          subtitle={pickedMovie.year ? `Çıkış Yılı: ${pickedMovie.year}` : 'Film'}
          onRate={(rating, note) => {
            watchMovie(pickedMovie.id, rating, note);
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
          onRate={(rating, note) => watchMovie(ratingTarget.id, rating, note)}
          onClose={() => setRatingTarget(null)}
        />
      )}
      {editTarget && <EditMovieModal movie={editTarget} onClose={() => setEditTarget(null)} />}
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
}: {
  movie: Movie;
  collectionName?: string;
  onDelete: (movie: Movie) => void;
  onRate: (movie: Movie) => void;
  onUnwatch: (id: string) => void;
  onEdit: (movie: Movie) => void;
}) {
  return (
    <div className="flex items-center gap-4 p-3 hover:bg-ink-800/40 transition-colors group border-b border-ink-800/40 last:border-0">
      <div className="w-12 sm:w-16 aspect-[2/3] flex-shrink-0 bg-ink-900 rounded-md overflow-hidden flex items-center justify-center border border-ink-700/50">
        {movie.posterUrl ? (
          <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={20} className="text-ink-600" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium ${movie.watched ? 'text-ink-500 line-through' : 'text-ink-100'}`}>
            {movie.title}
          </span>
          {movie.year && (
            <span className="text-xs text-ink-300 flex items-center gap-0.5">
              <Calendar size={11} /> Çıkış Yılı: {movie.year}
            </span>
          )}
          {movie.runtime && (
            <span className="text-xs text-ink-300 flex items-center gap-0.5 ml-1">
              <Clock size={11} /> Süre: {movie.runtime} dk
            </span>
          )}
          {collectionName && (
            <span className="text-xs text-gold-400/70 bg-gold-500/10 border border-gold-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Boxes size={10} /> {collectionName}
            </span>
          )}
        </div>
        {movie.genres.length > 0 && (
          <div className="text-xs text-ink-500 mt-0.5">{movie.genres.join(' · ')}</div>
        )}
        {movie.watched && movie.rating !== null && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${ratingBgClass(movie.rating)}`}>
              {movie.rating}
            </span>
            <span className="text-xs text-ink-300">{formatDateShort(movie.watchedAt!)}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {movie.watched ? (
          <button
            onClick={() => onUnwatch(movie.id)}
            className="text-xs text-ink-500 hover:text-ink-300 px-2 py-1 rounded transition-colors"
          >
            Geri Al
          </button>
        ) : (
          <button
            onClick={() => onRate(movie)}
            className="flex items-center gap-1 text-xs bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-ink-950 px-2.5 py-1.5 rounded-lg transition-all shadow-sm"
          >
            <Star size={14} />
            İzle
          </button>
        )}
        <button
          onClick={() => onEdit(movie)}
          className="text-ink-600 hover:text-gold-400 transition-colors p-1"
        >
          <Edit2 size={15} />
        </button>
        <button
          onClick={() => onDelete(movie)}
          className="text-ink-600 hover:text-red-400 transition-colors p-1"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}