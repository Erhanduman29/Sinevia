import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Projector, Trash2, Boxes, ChevronDown, ChevronRight, Star, Calendar, Filter,
  ArrowDownAZ, CalendarDays, Star as StarIcon, Check, Search, Edit2, Shuffle, Clock,
  CalendarPlus, Image as ImageIcon, RefreshCw, Dna, PlayCircle, ExternalLink, Eye,
  FolderPlus, X, Play, Pause, Timer, Zap, Lock, EyeOff, ChevronsUpDown, History,
  CheckSquare, Square, ArrowRightLeft,
} from 'lucide-react';
import { useApp, getMovieTimerInfo, PAST_WATCH_COLLECTION_NAME } from '../context/AppContext';
import { ratingBgClass, formatDateShort, normalize } from '../lib/utils';
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
type WatchedFilterMode = 'all' | 'unwatched' | 'watched' | 'past';

export default function MoviesPage() {
  const {
    data, editMovie, deleteMovie, startWatchingMovie, togglePauseWatchingMovie,
    cancelWatchingMovie, canRateMovieWithTimer, watchMovie, unwatchMovie,
    setMovieCollection, addCollection, showToast,
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
  const [isCollectionsSectionOpen, setIsCollectionsSectionOpen] = useState(true);
  // Eskiden İzlenenler koleksiyonu ayrıdır ve ekranı doldurmaması için varsayılan olarak kapalıdır
  const [isPastCollectionOpen, setIsPastCollectionOpen] = useState(false);

  const [collectionTargetMovie, setCollectionTargetMovie] = useState<Movie | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [addMoviesToCollectionId, setAddMoviesToCollectionId] = useState<string | null>(null);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [bulkSelectedMovieIds, setBulkSelectedMovieIds] = useState<Set<string>>(new Set());

  // Koleksiyondan toplu aktarma onay penceresi state'i
  const [confirmMoveColTarget, setConfirmMoveColTarget] = useState<{
    id: string;
    name: string;
    count: number;
    fromModal?: boolean;
  } | null>(null);

  // "Eskiden İzlenenler" koleksiyonundan başka koleksiyona veya bağımsız listeye toplu taşıma modalı state'leri
  const [showMoveFromPastModal, setShowMoveFromPastModal] = useState(false);
  const [pastMoveSearch, setPastMoveSearch] = useState('');
  const [pastMoveSelectedIds, setPastMoveSelectedIds] = useState<Set<string>>(new Set());
  const [pastMoveDestinationMode, setPastMoveDestinationMode] = useState<'standalone' | 'existing' | 'new'>('standalone');
  const [pastMoveTargetColId, setPastMoveTargetColId] = useState<string>('');
  const [pastMoveNewColName, setPastMoveNewColName] = useState<string>('');

  const [watchedFilter, setWatchedFilter] = useState<WatchedFilterMode>('unwatched');
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('added');
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Canlı geri sayım için her saniye güncellenen saat
  const [nowMs, setNowMs] = useState(() => Date.now());
  const activeTimerMovie = useMemo(() => data.movies.find((m) => !m.watched && m.startedAt) || null, [data.movies]);

  useEffect(() => {
    if (!activeTimerMovie) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimerMovie]);

  const detailMovie = useMemo(
    () => (detailMovieId ? data.movies.find((m) => m.id === detailMovieId) || null : null),
    [data.movies, detailMovieId]
  );

  // "Eskiden İzlenenler" özel koleksiyonunu bul
  const pastCollection = useMemo(
    () => data.collections.find((c) => normalize(c.name) === normalize(PAST_WATCH_COLLECTION_NAME)) || null,
    [data.collections]
  );

  const isMovieInPastCollection = (movie: Movie) => {
    if (!movie.collectionId || !pastCollection) return false;
    return movie.collectionId === pastCollection.id;
  };

  const handleRequestRate = (movie: Movie) => {
    if (!canRateMovieWithTimer(movie.id)) return;
    setRatingTarget(movie);
  };

  const handleSyncTMDB = async () => {
    setIsSyncing(true);
    const moviesToSync = data.movies.filter(
      (m) => !m.tmdbId || !m.posterUrl || !m.keywords || m.keywords.length === 0 || !m.directors || m.directors.length === 0 || !m.cast || m.cast.length === 0 || !m.imdbId
    );
    let syncedCount = 0;

    for (const movie of moviesToSync) {
      try {
        const results = await searchTMDB(movie.title);
        if (results.length > 0) {
          const match = results.find((r) => r.year === movie.year) || results[0];
          const newGenres = Array.from(new Set([...movie.genres, ...match.genres]));
          editMovie(
            movie.id, movie.title, match.year || movie.year, newGenres, match.runtime || movie.runtime,
            match.posterUrl || movie.posterUrl, match.overview || movie.overview, match.id, true,
            movie.customUrl, match.imdbId || movie.imdbId,
            match.watchProviders && match.watchProviders.length > 0 ? match.watchProviders : movie.watchProviders,
            {
              directors: match.directors && match.directors.length > 0 ? match.directors : movie.directors,
              cast: match.cast && match.cast.length > 0 ? match.cast : movie.cast,
              studios: match.studios && match.studios.length > 0 ? match.studios : movie.studios,
              keywords: match.keywords && match.keywords.length > 0 ? match.keywords : movie.keywords,
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
    if (syncedCount > 0) showToast(`${syncedCount} filme Sinema Kartı, DNA ve izleme bilgileri eklendi!`, 'success');
    else showToast('Kütüphanenin tüm film künyeleri güncel.', 'info');
  };

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    data.movies.forEach((m) => m.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [data.movies]);

  const eligibleMovies = useMemo(() => {
    const unwatched = data.movies.filter((m) => !m.watched && !isMovieInPastCollection(m));
    const standalone = unwatched.filter((m) => !m.collectionId);
    const collectionGroups = new Map<string, Movie[]>();
    unwatched.filter((m) => m.collectionId).forEach((m) => {
      const arr = collectionGroups.get(m.collectionId!) || [];
      arr.push(m);
      collectionGroups.set(m.collectionId!, arr);
    });
    const sequentialCollectionMovies: Movie[] = [];
    collectionGroups.forEach((movies) => {
      const sorted = [...movies].sort((a, b) => parseInt(a.year || '9999', 10) - parseInt(b.year || '9999', 10));
      if (sorted.length > 0) sequentialCollectionMovies.push(sorted[0]);
    });
    return [...standalone, ...sequentialCollectionMovies];
  }, [data.movies, pastCollection]);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const clearGenres = () => setSelectedGenres(new Set());
  const searchMatches = (m: Movie) => !search.trim() || m.title.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'));

  const sortMovies = (movies: Movie[]): Movie[] => {
    let filtered = movies;
    if (watchedFilter === 'unwatched') filtered = filtered.filter((m) => !m.watched);
    else if (watchedFilter === 'watched') filtered = filtered.filter((m) => m.watched);
    else if (watchedFilter === 'past') filtered = filtered.filter((m) => m.watched && m.isPastWatch);

    if (selectedGenres.size > 0) filtered = filtered.filter((m) => Array.from(selectedGenres).every((g) => m.genres.includes(g)));
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
  const collectionMap = useMemo(() => {
    const map = new Map<string, Movie[]>();
    collectionMovies.forEach((m) => {
      const arr = map.get(m.collectionId!) || [];
      arr.push(m);
      map.set(m.collectionId!, arr);
    });
    return map;
  }, [collectionMovies]);

  // "Eskiden İzlenenler" koleksiyonunun içindeki tüm puanlanmamış filmler (filtrelerden bağımsız ham liste)
  const allPastColUnratedMovies = useMemo(() => {
    if (!pastCollection) return [];
    return (collectionMap.get(pastCollection.id) || [])
      .filter((m) => !m.watched)
      .sort((a, b) => parseInt(a.year || '9999', 10) - parseInt(b.year || '9999', 10));
  }, [pastCollection, collectionMap]);

  // "Eskiden İzlenenler" koleksiyonunun içindeki arama/tür filtresine uygun puanlanmamış filmler
  const pastCollectionUnratedMovies = useMemo(() => {
    let filtered = allPastColUnratedMovies;
    if (selectedGenres.size > 0) {
      filtered = filtered.filter((m) => Array.from(selectedGenres).every((g) => m.genres.includes(g)));
    }
    if (search.trim() !== '') {
      filtered = filtered.filter(searchMatches);
    }
    return filtered;
  }, [allPastColUnratedMovies, selectedGenres, search]);

  // Normal koleksiyonlar ("Eskiden İzlenenler" koleksiyonu buradan tamamen ayrıldı)
  const filteredCollections = useMemo(() => {
    return data.collections.filter((coll) => {
      if (normalize(coll.name) === normalize(PAST_WATCH_COLLECTION_NAME)) return false;

      const movies = collectionMap.get(coll.id) || [];
      const isCompletelyWatched = movies.length > 0 && movies.every((m) => m.watched);
      const hasPastWatchedMovie = movies.some((m) => m.watched && m.isPastWatch);

      if (watchedFilter === 'past') {
        if (!hasPastWatchedMovie) return false;
      } else if (watchedFilter === 'watched') {
        if (!isCompletelyWatched) return false;
      } else if (watchedFilter === 'unwatched') {
        if (isCompletelyWatched) return false;
      }

      if (selectedGenres.size > 0) {
        const hasGenreMatch = movies.some((m) => Array.from(selectedGenres).every((g) => m.genres.includes(g)));
        if (!hasGenreMatch) return false;
      }

      if (search.trim() !== '') {
        const q = search.toLocaleLowerCase('tr-TR');
        const matchesName = coll.name.toLocaleLowerCase('tr-TR').includes(q);
        const matchesMovie = movies.some((m) => m.title.toLocaleLowerCase('tr-TR').includes(q));
        if (!matchesName && !matchesMovie) return false;
      }

      return true;
    });
  }, [data.collections, collectionMap, watchedFilter, selectedGenres, search]);

  const toggleCollection = (id: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredExpanded = useMemo(
    () => filteredCollections.length > 0 && filteredCollections.every((c) => expandedCollections.has(c.id)),
    [filteredCollections, expandedCollections]
  );

  const handleToggleAllCollectionsExpand = () => {
    if (allFilteredExpanded) {
      setExpandedCollections((prev) => {
        const next = new Set(prev);
        filteredCollections.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setExpandedCollections((prev) => {
        const next = new Set(prev);
        filteredCollections.forEach((c) => next.add(c.id));
        return next;
      });
    }
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
    showToast(`"${collectionTargetMovie.title}" ➔ ${newCollectionName.trim()} koleksiyonuna eklendi`, 'success');
    setNewCollectionName('');
    setCollectionTargetMovie(null);
  };

  // Bir koleksiyondaki tüm izlenmemiş filmleri "Eskiden İzlenenler"e aktarmadan önce onay iste
  const requestMoveEntireCollectionToPast = (sourceColId: string, sourceColName: string, fromModal = false) => {
    if (!pastCollection) return;
    const moviesToMove = (collectionMap.get(sourceColId) || []).filter((m) => !m.watched);
    if (moviesToMove.length === 0) {
      showToast(`"${sourceColName}" içinde taşınacak izlenmemiş film yok.`, 'info');
      return;
    }
    setConfirmMoveColTarget({
      id: sourceColId,
      name: sourceColName,
      count: moviesToMove.length,
      fromModal,
    });
  };

  // Onay verildiğinde koleksiyon aktarımını uygula
  const executeConfirmedCollectionMove = () => {
    if (!confirmMoveColTarget || !pastCollection) return;
    const { id: sourceColId, name: sourceColName, fromModal } = confirmMoveColTarget;
    const moviesToMove = (collectionMap.get(sourceColId) || []).filter((m) => !m.watched);

    if (fromModal) {
      setBulkSelectedMovieIds((prev) => {
        const next = new Set(prev);
        moviesToMove.forEach((m) => next.add(m.id));
        return next;
      });
      showToast(`"${sourceColName}" içindeki ${moviesToMove.length} film seçime eklendi`, 'info');
    } else {
      moviesToMove.forEach((m) => setMovieCollection(m.id, pastCollection.id));
      setIsPastCollectionOpen(true);
      showToast(`"${sourceColName}" koleksiyonundaki ${moviesToMove.length} film Eskiden İzlenenler'e aktarıldı!`, 'success');
    }
    setConfirmMoveColTarget(null);
  };

  // Çoklu film seçme modalını açar ve mevcut koleksiyondaki filmleri işaretli getirir
  const openBulkCollectionModal = (colId: string) => {
    setAddMoviesToCollectionId(colId);
    setCollectionSearch('');
    const currentInCol = data.movies
      .filter((m) => m.collectionId === colId && (!pastCollection || colId !== pastCollection.id || !m.watched))
      .map((m) => m.id);
    setBulkSelectedMovieIds(new Set(currentInCol));
  };

  const toggleBulkMovieSelection = (movieId: string) => {
    setBulkSelectedMovieIds((prev) => {
      const next = new Set(prev);
      if (next.has(movieId)) next.delete(movieId);
      else next.add(movieId);
      return next;
    });
  };

  // Çoklu seçim modalında bir koleksiyona tıklandığında onay uyarısı vererek o koleksiyondaki tüm filmleri seçime ekle / çıkar
  const toggleSelectWholeCollectionInModal = (colId: string, colName: string) => {
    const isTargetPastCol = Boolean(pastCollection && addMoviesToCollectionId === pastCollection.id);
    const colMovies = (collectionMap.get(colId) || []).filter((m) => (isTargetPastCol ? !m.watched : true));
    if (colMovies.length === 0) return;

    const allSelected = colMovies.every((m) => bulkSelectedMovieIds.has(m.id));
    if (allSelected) {
      setBulkSelectedMovieIds((prev) => {
        const next = new Set(prev);
        colMovies.forEach((m) => next.delete(m.id));
        return next;
      });
    } else {
      requestMoveEntireCollectionToPast(colId, colName, true);
    }
  };

  // Çoklu seçim modalındaki seçimleri kaydet ve uygula
  const handleApplyBulkCollectionSelection = () => {
    if (!addMoviesToCollectionId) return;
    const targetColId = addMoviesToCollectionId;
    const targetColName = data.collections.find((c) => c.id === targetColId)?.name || 'Koleksiyon';

    let addedCount = 0;
    let removedCount = 0;

    data.movies.forEach((m) => {
      const shouldBeInCol = bulkSelectedMovieIds.has(m.id);
      const isCurrentlyInCol = m.collectionId === targetColId;

      if (shouldBeInCol && !isCurrentlyInCol) {
        setMovieCollection(m.id, targetColId);
        addedCount++;
      } else if (!shouldBeInCol && isCurrentlyInCol) {
        setMovieCollection(m.id, null);
        removedCount++;
      }
    });

    if (addedCount > 0 || removedCount > 0) {
      showToast(
        `${targetColName}: ${addedCount} film eklendi${removedCount > 0 ? `, ${removedCount} film çıkarıldı` : ''}`,
        'success'
      );
      if (pastCollection && targetColId === pastCollection.id && addedCount > 0) {
        setIsPastCollectionOpen(true);
      }
    }
    setAddMoviesToCollectionId(null);
  };

  // "Eskiden İzlenenler" içindeki filmleri başka bir koleksiyona veya bağımsız listeye toplu taşıma modalını aç
  const openMoveFromPastModal = () => {
    setPastMoveSearch('');
    setPastMoveSelectedIds(new Set());
    setPastMoveDestinationMode('standalone');
    const regularCols = data.collections.filter((c) => normalize(c.name) !== normalize(PAST_WATCH_COLLECTION_NAME));
    setPastMoveTargetColId(regularCols[0]?.id || '');
    setPastMoveNewColName('');
    setShowMoveFromPastModal(true);
  };

  const togglePastMoveMovie = (id: string) => {
    setPastMoveSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExecuteMoveFromPast = () => {
    if (pastMoveSelectedIds.size === 0) return;

    let finalDestColId: string | null = null;
    let destLabel = 'Bağımsız Filmler (İzlenecekler)';

    if (pastMoveDestinationMode === 'existing') {
      if (!pastMoveTargetColId) {
        showToast('Lütfen hedef bir koleksiyon seçin!', 'warning');
        return;
      }
      finalDestColId = pastMoveTargetColId;
      destLabel = data.collections.find((c) => c.id === pastMoveTargetColId)?.name || 'Koleksiyon';
    } else if (pastMoveDestinationMode === 'new') {
      if (!pastMoveNewColName.trim()) {
        showToast('Lütfen yeni koleksiyon adını yazın!', 'warning');
        return;
      }
      finalDestColId = addCollection(pastMoveNewColName.trim());
      destLabel = pastMoveNewColName.trim();
    }

    pastMoveSelectedIds.forEach((movieId) => {
      setMovieCollection(movieId, finalDestColId);
    });

    showToast(`${pastMoveSelectedIds.size} film ➔ ${destLabel} kısmına taşındı!`, 'success');
    setShowMoveFromPastModal(false);
    setPastMoveSelectedIds(new Set());
  };

  const sortedStandalone = sortMovies(standaloneMovies);
  const totalUnwatched = data.movies.filter((m) => !m.watched).length;
  const totalWatched = data.movies.filter((m) => m.watched).length;
  const totalPastWatched = data.movies.filter((m) => m.watched && m.isPastWatch).length;

  // Çoklu seçim modalında listelenecek filmler
  const modalSelectableMovies = useMemo(() => {
    if (!addMoviesToCollectionId) return [];
    const isTargetPastCol = Boolean(pastCollection && addMoviesToCollectionId === pastCollection.id);
    return data.movies.filter((m) => {
      if (isTargetPastCol && m.watched) return false;
      if (!collectionSearch.trim()) return true;
      return m.title.toLocaleLowerCase('tr-TR').includes(collectionSearch.toLocaleLowerCase('tr-TR'));
    });
  }, [data.movies, addMoviesToCollectionId, pastCollection, collectionSearch]);

  // Çoklu seçim modalında hızlı aktarım için diğer koleksiyonlar
  const modalOtherCollections = useMemo(() => {
    if (!addMoviesToCollectionId) return [];
    const isTargetPastCol = Boolean(pastCollection && addMoviesToCollectionId === pastCollection.id);
    return data.collections.filter((c) => {
      if (c.id === addMoviesToCollectionId) return false;
      if (normalize(c.name) === normalize(PAST_WATCH_COLLECTION_NAME)) return false;
      const movies = (collectionMap.get(c.id) || []).filter((m) => (isTargetPastCol ? !m.watched : true));
      return movies.length > 0;
    });
  }, [data.collections, collectionMap, addMoviesToCollectionId, pastCollection]);

  // "Eskiden İzlenenler"den taşıma modalında filtrelenmiş filmler
  const filteredPastMoviesForMove = useMemo(() => {
    if (!pastMoveSearch.trim()) return allPastColUnratedMovies;
    const q = pastMoveSearch.toLocaleLowerCase('tr-TR');
    return allPastColUnratedMovies.filter((m) => m.title.toLocaleLowerCase('tr-TR').includes(q));
  }, [allPastColUnratedMovies, pastMoveSearch]);

  const regularCollectionsList = useMemo(
    () => data.collections.filter((c) => normalize(c.name) !== normalize(PAST_WATCH_COLLECTION_NAME)),
    [data.collections]
  );

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
          <button onClick={() => setShowDna(true)} className="flex items-center gap-2 bg-emerald-900/30 hover:bg-emerald-800/40 text-emerald-400 border border-emerald-500/30 px-3.5 py-2.5 rounded-lg font-semibold transition-all shadow-sm">
            <Dna size={18} />
            <span className="hidden sm:inline">DNA Sentezle</span>
          </button>
          <button onClick={handleSyncTMDB} disabled={isSyncing} className="flex items-center gap-2 bg-ink-800/80 hover:bg-ink-700 text-gold-300 border border-gold-500/30 px-3.5 py-2.5 rounded-lg font-semibold transition-all shadow-sm disabled:opacity-50">
            <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{isSyncing ? 'Taranıyor...' : 'Eksikleri Bul'}</span>
          </button>
          <button onClick={() => setShowPick(true)} className="flex items-center gap-2 bg-ink-800/80 hover:bg-ink-700 text-gold-300 border border-gold-500/30 px-3.5 py-2.5 rounded-lg font-semibold transition-all shadow-sm">
            <Shuffle size={18} />
            <span className="hidden sm:inline">Bugün Ne İzlesem</span>
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-ink-950 px-4 py-2.5 rounded-lg font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20">
            <Plus size={20} /> Film Ekle
          </button>
        </div>
      </div>

      {/* AKTİF İZLEME SAYACI BANNER'I */}
      {activeTimerMovie && (() => {
        const info = getMovieTimerInfo(activeTimerMovie, nowMs);
        return (
          <div className="bg-gradient-to-r from-emerald-950/80 via-ink-900 to-ink-950 border border-emerald-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                <Timer size={20} className={info.isPaused ? 'text-amber-400' : 'text-emerald-400 animate-pulse'} />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <span>{info.isPaused ? '⏸️ Sayaç Duraklatıldı' : '⏳ Canlı Geri Sayım Aktif'}</span>
                  <span className="text-white">• {activeTimerMovie.title}</span>
                </div>
                <div className="text-[11px] text-ink-300 mt-0.5">
                  Kalan Süre: <strong className="text-emerald-300 font-mono text-xs">{info.formattedRemaining}</strong> • Geçen: <strong>{info.elapsedMins} dk</strong> / {info.maxMins} dk
                  {!info.canRateWithTimer && (
                    <span className="text-amber-400 ml-2">(En az {info.minRequiredMins} dk geçmeden puanlanamaz)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => togglePauseWatchingMovie(activeTimerMovie.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-amber-300 border border-amber-500/30 text-xs font-bold"
              >
                {info.isPaused ? <><Play size={13} className="fill-current" /> Devam Et</> : <><Pause size={13} /> Duraklat</>}
              </button>
              <button
                type="button"
                onClick={() => handleRequestRate(activeTimerMovie)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                  info.canRateWithTimer
                    ? 'bg-gold-500 hover:bg-gold-400 text-ink-950 shadow-md'
                    : 'bg-ink-800 text-ink-500 border border-ink-700 cursor-not-allowed'
                }`}
              >
                {info.canRateWithTimer ? <><Star size={13} className="fill-current" /> Bitir & Puanla</> : <><Lock size={12} /> Kilitli ({info.minRequiredMins - info.elapsedMins} dk)</>}
              </button>
              <button
                type="button"
                onClick={() => cancelWatchingMovie(activeTimerMovie.id)}
                title="Sayacı İptal Et"
                className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })()}

      <div className="space-y-3">
        <div className="flex flex-wrap bg-ink-800/50 rounded-lg p-1 border border-ink-700/50 w-fit gap-1">
          <button onClick={() => setWatchedFilter('all')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${watchedFilter === 'all' ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-300'}`}>
            Tümü ({data.movies.length})
          </button>
          <button onClick={() => setWatchedFilter('unwatched')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${watchedFilter === 'unwatched' ? 'bg-gold-500/20 text-gold-400' : 'text-ink-400 hover:text-ink-300'}`}>
            İzlenecekler ({totalUnwatched})
          </button>
          <button onClick={() => setWatchedFilter('watched')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${watchedFilter === 'watched' ? 'bg-green-500/20 text-green-400' : 'text-ink-400 hover:text-ink-300'}`}>
            İzlenenler ({totalWatched})
          </button>
          <button onClick={() => setWatchedFilter('past')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${watchedFilter === 'past' ? 'bg-violet-500/25 text-violet-300' : 'text-ink-400 hover:text-violet-300'}`}>
            <History size={13} /> Daha Önce İzlenenler ({totalPastWatched})
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
          <div className="flex items-center gap-1 text-xs text-ink-500"><Filter size={14} /></div>
          <button onClick={() => setSortMode('added')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortMode === 'added' ? 'bg-gold-500/20 border border-gold-500/30 text-gold-300' : 'bg-ink-800/50 border border-ink-700/50 text-ink-400 hover:text-ink-200'}`}>
            <CalendarPlus size={14} /> Eklenme
          </button>
          <button onClick={() => setSortMode('az')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortMode === 'az' ? 'bg-gold-500/20 border border-gold-500/30 text-gold-300' : 'bg-ink-800/50 border border-ink-700/50 text-ink-400 hover:text-ink-200'}`}>
            <ArrowDownAZ size={14} /> A-Z
          </button>
          <button onClick={() => setSortMode('year')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortMode === 'year' ? 'bg-gold-500/20 border border-gold-500/30 text-gold-300' : 'bg-ink-800/50 border border-ink-700/50 text-ink-400 hover:text-ink-200'}`}>
            <CalendarDays size={14} /> Yıl
          </button>
          <button onClick={() => setSortMode('rating')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortMode === 'rating' ? 'bg-gold-500/20 border border-gold-500/30 text-gold-300' : 'bg-ink-800/50 border border-ink-700/50 text-ink-400 hover:text-ink-200'}`}>
            <StarIcon size={14} /> Puan
          </button>
        </div>

        {allGenres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <button onClick={clearGenres} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedGenres.size === 0 ? 'bg-gold-500 text-ink-950' : 'bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-ink-200'}`}>
              Tümü
            </button>
            {allGenres.map((g) => {
              const active = selectedGenres.has(g);
              return (
                <button key={g} onClick={() => toggleGenre(g)} className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${active ? 'bg-gold-500 text-ink-950' : 'bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-ink-200'}`}>
                  {active && <Check size={11} />}
                  {g}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================
          AYRI BÖLÜM: ESKİDEN İZLENENLER KOLEKSİYONU (PUANLANMAYI BEKLEYENLER)
          ========================================================= */}
      {pastCollection && watchedFilter !== 'watched' && watchedFilter !== 'past' && (
        <div className="bg-ink-900/60 backdrop-blur-sm border border-violet-500/35 rounded-2xl overflow-hidden shadow-lg shadow-ink-950/30 transition-all">
          <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-ink-800/40 transition-colors gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsPastCollectionOpen((prev) => !prev)}
              className="flex items-center gap-2.5 flex-1 text-left min-w-0"
            >
              {isPastCollectionOpen ? (
                <ChevronDown size={18} className="text-violet-400 flex-shrink-0" />
              ) : (
                <ChevronRight size={18} className="text-violet-400 flex-shrink-0" />
              )}
              <History size={18} className="text-violet-400 flex-shrink-0" />
              <span className="font-semibold text-sm text-ink-100 truncate">
                {pastCollection.name} Koleksiyonu
              </span>
              <span className="text-[11px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full flex-shrink-0">
                {pastCollectionUnratedMovies.length} puanlanacak film
              </span>
            </button>

            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {allPastColUnratedMovies.length > 0 && (
                <button
                  type="button"
                  onClick={openMoveFromPastModal}
                  className="flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-white bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2.5 py-1 rounded-lg transition-colors"
                  title="Buradaki filmleri seçerek başka bir koleksiyona veya bağımsız film listesine topluca taşı"
                >
                  <ArrowRightLeft size={12} /> Toplu Taşı / Çıkar
                </button>
              )}

              <button
                type="button"
                onClick={() => openBulkCollectionModal(pastCollection.id)}
                className="flex items-center gap-1 text-[11px] font-bold text-violet-300 hover:text-white bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 px-2.5 py-1 rounded-lg transition-colors"
                title="Listeden çoklu film veya koleksiyon seçerek buraya ekle"
              >
                <Plus size={12} /> Çoklu Film / Koleksiyon Ekle
              </button>

              <button
                type="button"
                onClick={() => setIsPastCollectionOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs font-bold text-violet-300 hover:text-white bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 px-3 py-1 rounded-lg transition-all"
              >
                {isPastCollectionOpen ? (
                  <><EyeOff size={13} /> Kapat</>
                ) : (
                  <><Eye size={13} /> Aç</>
                )}
              </button>
            </div>
          </div>

          {isPastCollectionOpen && (
            <div className="border-t border-violet-500/25 animate-fade-in">
              {pastCollectionUnratedMovies.length === 0 ? (
                <div className="p-4 text-xs text-ink-400 text-center">
                  Bu koleksiyonda puanlanmayı bekleyen film yok. Sağ üstteki <strong>"+ Çoklu Film / Koleksiyon Ekle"</strong> butonundan birden fazla filmi veya koleksiyonu tek seferde buraya aktarabilirsin.
                </div>
              ) : (
                pastCollectionUnratedMovies.map((m) => (
                  <MovieRow
                    key={m.id}
                    movie={m}
                    nowMs={nowMs}
                    anotherTimerActive={Boolean(activeTimerMovie && activeTimerMovie.id !== m.id)}
                    collectionName={pastCollection.name}
                    onDelete={(movie) => setDeleteTarget(movie)}
                    onRate={handleRequestRate}
                    onStartWatch={startWatchingMovie}
                    onTogglePause={togglePauseWatchingMovie}
                    onCancelWatch={cancelWatchingMovie}
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
        </div>
      )}

      {/* NORMAL KOLEKSİYONLAR LİSTESİ (AÇILIR/KAPANIR VE İZLENME DURUMUNA GÖRE FİLTRELENİR) */}
      {filteredCollections.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap bg-ink-900/50 border border-ink-800/80 px-3.5 py-2.5 rounded-xl">
            <button
              type="button"
              onClick={() => setIsCollectionsSectionOpen((prev) => !prev)}
              className="flex items-center gap-2 text-sm font-semibold text-ink-200 hover:text-gold-400 uppercase tracking-wide transition-colors"
            >
              {isCollectionsSectionOpen ? <ChevronDown size={17} className="text-gold-400" /> : <ChevronRight size={17} className="text-gold-400" />}
              <Boxes size={16} className="text-gold-400" />
              <span>Koleksiyonlar</span>
              <span className="text-[11px] font-bold bg-gold-500/15 text-gold-300 border border-gold-500/30 px-2 py-0.5 rounded-full">
                {filteredCollections.length}
              </span>
            </button>

            <div className="flex items-center gap-2">
              {isCollectionsSectionOpen && (
                <button
                  type="button"
                  onClick={handleToggleAllCollectionsExpand}
                  className="flex items-center gap-1 text-xs font-semibold text-ink-300 hover:text-gold-300 bg-ink-800/80 hover:bg-ink-700 border border-ink-700/70 px-2.5 py-1 rounded-lg transition-all"
                >
                  <ChevronsUpDown size={13} className="text-gold-400" />
                  <span>{allFilteredExpanded ? 'Tümünü Daralt' : 'Tümünü Genişlet'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsCollectionsSectionOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs font-bold text-gold-400 hover:text-gold-300 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/30 px-3 py-1 rounded-lg transition-all"
              >
                {isCollectionsSectionOpen ? (
                  <><EyeOff size={13} /> Koleksiyonları Gizle</>
                ) : (
                  <><Eye size={13} /> Koleksiyonları Göster</>
                )}
              </button>
            </div>
          </div>

          {isCollectionsSectionOpen && (
            <div className="space-y-3 animate-fade-in">
              {filteredCollections.map((coll) => {
                const movies = collectionMap.get(coll.id) || [];
                const visibleMovies = [...movies]
                  .filter((m) => (watchedFilter === 'past' ? m.watched && m.isPastWatch : true))
                  .sort((a, b) => parseInt(a.year || '9999', 10) - parseInt(b.year || '9999', 10));
                const watchedInCol = visibleMovies.filter((m) => m.watched).length;
                const unwatchedInCol = visibleMovies.length - watchedInCol;
                const isCompletelyWatched = visibleMovies.length > 0 && watchedInCol === visibleMovies.length;
                const isExpanded = expandedCollections.has(coll.id);

                return (
                  <div
                    key={coll.id}
                    className={`bg-ink-900/60 backdrop-blur-sm border rounded-2xl overflow-hidden shadow-lg shadow-ink-950/30 transition-all ${
                      isCompletelyWatched ? 'border-green-500/30 hover:border-green-500/50' : 'border-ink-700/50 hover:border-ink-600/50'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between p-4 hover:bg-ink-800/40 transition-colors gap-2 flex-wrap">
                      <button type="button" onClick={() => toggleCollection(coll.id)} className="flex items-center gap-2.5 flex-1 text-left min-w-0">
                        {isExpanded ? <ChevronDown size={18} className="text-ink-500 flex-shrink-0" /> : <ChevronRight size={18} className="text-ink-500 flex-shrink-0" />}
                        <Boxes size={18} className={isCompletelyWatched ? 'text-green-400 flex-shrink-0' : 'text-gold-400 flex-shrink-0'} />
                        <span className="font-semibold text-ink-100 truncate">{coll.name}</span>
                        {isCompletelyWatched && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full flex-shrink-0">
                            <Check size={11} /> Tamamlandı
                          </span>
                        )}
                      </button>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {pastCollection && unwatchedInCol > 0 && (
                          <button
                            type="button"
                            onClick={() => requestMoveEntireCollectionToPast(coll.id, coll.name, false)}
                            className="flex items-center gap-1 text-[11px] font-bold text-violet-300 hover:text-white bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 px-2.5 py-1 rounded-lg transition-colors"
                            title="Bu koleksiyondaki izlenmemiş tüm filmleri Eskiden İzlenenler koleksiyonuna aktar"
                          >
                            <History size={12} /> <span className="hidden sm:inline">Eskiden İzlenenlere Aktar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openBulkCollectionModal(coll.id)}
                          className="flex items-center gap-1 text-[11px] font-bold text-gold-400 hover:text-gold-300 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/30 px-2.5 py-1 rounded-lg transition-colors"
                          title="Listeden bu koleksiyona çoklu film ekle"
                        >
                          <Plus size={12} /> Film Ekle
                        </button>
                        <span className="text-xs text-ink-400 bg-ink-800/60 px-2.5 py-1 rounded-full">
                          {watchedInCol}/{visibleMovies.length} film
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-ink-700/40">
                        {visibleMovies.length === 0 ? (
                          <div className="p-4 text-xs text-ink-500 text-center">Bu koleksiyonda henüz film yok. Sağ üstteki "+ Film Ekle" butonundan ekleyebilirsin.</div>
                        ) : (
                          visibleMovies.map((m) => (
                            <MovieRow
                              key={m.id}
                              movie={m}
                              nowMs={nowMs}
                              anotherTimerActive={Boolean(activeTimerMovie && activeTimerMovie.id !== m.id)}
                              collectionName={coll.name}
                              onDelete={(movie) => setDeleteTarget(movie)}
                              onRate={handleRequestRate}
                              onStartWatch={startWatchingMovie}
                              onTogglePause={togglePauseWatchingMovie}
                              onCancelWatch={cancelWatchingMovie}
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
                              <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full bg-ink-800 flex items-center justify-center"><ImageIcon size={14} className="text-ink-600" /></div>
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
        </div>
      )}

      {/* BAĞIMSIZ FİLMLER LİSTESİ */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-ink-400 uppercase tracking-wide">
            {watchedFilter === 'past' ? 'Daha Önce İzlenen Filmler' : 'Bağımsız Filmler'}
          </h2>
          {pastCollection && watchedFilter === 'unwatched' && sortedStandalone.length > 0 && (
            <button
              type="button"
              onClick={() => openBulkCollectionModal(pastCollection.id)}
              className="flex items-center gap-1.5 text-xs font-bold text-violet-300 hover:text-white bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 px-3 py-1 rounded-lg transition-colors"
            >
              <CheckSquare size={13} /> Filmleri Seçip Eskiden İzlenenlere Ekle
            </button>
          )}
        </div>
        {sortedStandalone.length === 0 ? (
          <div className="text-center py-12 text-ink-500">
            <Projector size={40} className="mx-auto mb-3 opacity-40" />
            <p>
              {watchedFilter === 'past'
                ? 'Daha önce izlenen film yok.'
                : watchedFilter === 'watched'
                ? 'İzlenen bağımsız film yok.'
                : watchedFilter === 'unwatched'
                ? 'İzlenecek bağımsız film kalmadı.'
                : 'Aramaya uygun film bulunamadı.'}
            </p>
          </div>
        ) : (
          sortedStandalone.map((m) => (
            <MovieRow
              key={m.id}
              movie={m}
              nowMs={nowMs}
              anotherTimerActive={Boolean(activeTimerMovie && activeTimerMovie.id !== m.id)}
              onDelete={(movie) => setDeleteTarget(movie)}
              onRate={handleRequestRate}
              onStartWatch={startWatchingMovie}
              onTogglePause={togglePauseWatchingMovie}
              onCancelWatch={cancelWatchingMovie}
              onUnwatch={unwatchMovie}
              onEdit={(movie) => setEditTarget(movie)}
              onAssignCollection={(movie) => setCollectionTargetMovie(movie)}
              onSelectDetail={(movie) => setDetailMovieId(movie.id)}
              altWatchTemplate={data.altWatchTemplate}
            />
          ))
        )}
      </div>

      {/* TEKİL FİLM KOLEKSİYON DEĞİŞTİRME / TAŞIMA MODALI */}
      {collectionTargetMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setCollectionTargetMovie(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between p-4 border-b border-ink-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                  <Boxes size={18} className="text-gold-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white truncate">Koleksiyona Ekle / Değiştir</h3>
                  <p className="text-xs text-gold-400 truncate font-medium">{collectionTargetMovie.title}</p>
                </div>
              </div>
              <button onClick={() => setCollectionTargetMovie(null)} className="text-ink-400 hover:text-white p-1.5 rounded-full hover:bg-ink-800"><X size={18} /></button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
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
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateAndAssignCollection(); }}
                  />
                  <button type="button" disabled={!newCollectionName.trim()} onClick={handleCreateAndAssignCollection} className="bg-gold-500 hover:bg-gold-400 text-ink-950 font-black px-4 py-2 rounded-xl text-xs transition-all disabled:opacity-40">
                    Oluştur
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-ink-400">Mevcut Koleksiyonlar ({data.collections.length})</div>
                {data.collections.length === 0 ? (
                  <p className="text-xs text-ink-500 py-3 text-center bg-ink-950/50 rounded-xl border border-ink-800">Henüz hiç koleksiyon yok.</p>
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
                            isCurrent ? 'bg-gold-500/20 border-gold-500 text-gold-300 font-black' : 'bg-ink-950/60 hover:bg-ink-800 border-ink-800 text-ink-200 font-semibold'
                          }`}
                        >
                          <span className="flex items-center gap-2 text-xs truncate">
                            <Boxes size={15} className={isCurrent ? 'text-gold-400' : 'text-ink-400'} /> {col.name}
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

              {collectionTargetMovie.collectionId && (
                <button type="button" onClick={() => handleAssignCollection(collectionTargetMovie, null)} className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold transition-colors">
                  Koleksiyondan Çıkar (Bağımsız Film Yap)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          ESKİDEN İZLENENLER KOLEKSİYONUNDAN BAŞKA KOLEKSİYONA / FİLM LİSTESİNE TOPLU TAŞIMA MODALI
          ========================================================= */}
      {showMoveFromPastModal && (() => {
        const allVisiblePastSelected =
          filteredPastMoviesForMove.length > 0 &&
          filteredPastMoviesForMove.every((m) => pastMoveSelectedIds.has(m.id));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowMoveFromPastModal(false)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh] animate-fade-in-up">
              <div className="flex items-center justify-between p-4 border-b border-ink-800">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <ArrowRightLeft size={17} className="text-amber-400" />
                    Eskiden İzlenenler'den Toplu Taşı / Çıkar
                  </h3>
                  <p className="text-xs text-ink-400 mt-0.5">
                    Buradaki filmleri seçerek bağımsız film listesine (İzleneceklere) veya başka bir koleksiyona topluca aktarabilirsin
                  </p>
                </div>
                <button onClick={() => setShowMoveFromPastModal(false)} className="text-ink-400 hover:text-white p-1.5 rounded-full hover:bg-ink-800"><X size={18} /></button>
              </div>

              {/* ARAMA VE TÜMÜNÜ SEÇ */}
              <div className="p-3 border-b border-ink-800 bg-ink-950/40 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input
                    type="text"
                    value={pastMoveSearch}
                    onChange={(e) => setPastMoveSearch(e.target.value)}
                    placeholder="Eskiden izlenenler içindeki filmlerde ara..."
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-ink-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                {filteredPastMoviesForMove.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPastMoveSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (allVisiblePastSelected) {
                          filteredPastMoviesForMove.forEach((m) => next.delete(m.id));
                        } else {
                          filteredPastMoviesForMove.forEach((m) => next.add(m.id));
                        }
                        return next;
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-200 border border-ink-700 text-xs font-bold whitespace-nowrap transition-colors"
                  >
                    {allVisiblePastSelected ? <CheckSquare size={14} className="text-amber-400" /> : <Square size={14} />}
                    <span>{allVisiblePastSelected ? 'Seçimi Kaldır' : 'Tümünü Seç'}</span>
                  </button>
                )}
              </div>

              {/* FİLM SEÇİM LİSTESİ */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                {filteredPastMoviesForMove.length === 0 ? (
                  <div className="text-center py-8 text-xs text-ink-500">
                    Aramaya uygun film bulunamadı.
                  </div>
                ) : (
                  filteredPastMoviesForMove.map((m) => {
                    const isSelected = pastMoveSelectedIds.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => togglePastMoveMovie(m.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500/50 text-white'
                            : 'bg-ink-950/50 hover:bg-ink-800/70 border-ink-800/80 text-ink-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckSquare size={18} className="text-amber-400" />
                            ) : (
                              <Square size={18} className="text-ink-500" />
                            )}
                          </div>
                          <div className="w-8 h-11 rounded bg-ink-900 overflow-hidden flex-shrink-0 border border-ink-700">
                            {m.posterUrl ? (
                              <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><ImageIcon size={12} className="text-ink-600" /></div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{m.title}</div>
                            <div className="text-[10px] text-ink-400">{m.year || 'Yıl yok'}</div>
                          </div>
                        </div>
                        <div className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 flex-shrink-0 ${isSelected ? 'bg-amber-500 text-ink-950' : 'bg-ink-800 text-ink-300'}`}>
                          {isSelected ? <><Check size={12} /> Seçildi</> : <><Plus size={12} /> Seç</>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* HEDEF SEÇİMİ (BAĞIMSIZ LİSTE / MEVCUT KOLEKSİYON / YENİ KOLEKSİYON) */}
              <div className="p-3.5 border-t border-ink-800 bg-ink-950/70 space-y-3">
                <div className="text-[11px] font-black uppercase tracking-wider text-ink-300">
                  Seçilen Filmler Nereye Taşınsın?
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPastMoveDestinationMode('standalone')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border text-center transition-all ${
                      pastMoveDestinationMode === 'standalone'
                        ? 'bg-amber-500 text-ink-950 border-amber-400 shadow-sm'
                        : 'bg-ink-900 text-ink-300 border-ink-800 hover:bg-ink-800'
                    }`}
                  >
                    Bağımsız Film Listesine
                  </button>
                  <button
                    type="button"
                    onClick={() => setPastMoveDestinationMode('existing')}
                    disabled={regularCollectionsList.length === 0}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border text-center transition-all disabled:opacity-40 ${
                      pastMoveDestinationMode === 'existing'
                        ? 'bg-amber-500 text-ink-950 border-amber-400 shadow-sm'
                        : 'bg-ink-900 text-ink-300 border-ink-800 hover:bg-ink-800'
                    }`}
                  >
                    Mevcut Koleksiyona
                  </button>
                  <button
                    type="button"
                    onClick={() => setPastMoveDestinationMode('new')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border text-center transition-all ${
                      pastMoveDestinationMode === 'new'
                        ? 'bg-amber-500 text-ink-950 border-amber-400 shadow-sm'
                        : 'bg-ink-900 text-ink-300 border-ink-800 hover:bg-ink-800'
                    }`}
                  >
                    Yeni Koleksiyona
                  </button>
                </div>

                {pastMoveDestinationMode === 'existing' && regularCollectionsList.length > 0 && (
                  <select
                    value={pastMoveTargetColId}
                    onChange={(e) => setPastMoveTargetColId(e.target.value)}
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {regularCollectionsList.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                )}

                {pastMoveDestinationMode === 'new' && (
                  <input
                    type="text"
                    value={pastMoveNewColName}
                    onChange={(e) => setPastMoveNewColName(e.target.value)}
                    placeholder="Yeni koleksiyon adı yazın..."
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-ink-500 focus:outline-none focus:border-amber-500"
                  />
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowMoveFromPastModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-300 font-bold text-xs transition-colors"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    disabled={pastMoveSelectedIds.size === 0}
                    onClick={handleExecuteMoveFromPast}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-ink-950 font-black text-xs transition-colors disabled:opacity-40"
                  >
                    Seçilen {pastMoveSelectedIds.size} Filmi Taşı
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* KOLEKSİYON İÇİNE ÇOKLU FİLM VE KOLEKSİYON SEÇME MODALI */}
      {addMoviesToCollectionId && (() => {
        const targetCol = data.collections.find((c) => c.id === addMoviesToCollectionId);
        const isTargetPast = Boolean(pastCollection && addMoviesToCollectionId === pastCollection.id);
        const allVisibleSelected =
          modalSelectableMovies.length > 0 &&
          modalSelectableMovies.every((m) => bulkSelectedMovieIds.has(m.id));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setAddMoviesToCollectionId(null)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[86vh] animate-fade-in-up">
              <div className="flex items-center justify-between p-4 border-b border-ink-800">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    {isTargetPast ? <History size={17} className="text-violet-400" /> : <Boxes size={17} className="text-gold-400" />}
                    {targetCol?.name} Koleksiyonuna Çoklu Ekle
                  </h3>
                  <p className="text-xs text-ink-400 mt-0.5">
                    İster üstten komple bir koleksiyonu seç, ister alttan istediğin filmleri topluca işaretle
                  </p>
                </div>
                <button onClick={() => setAddMoviesToCollectionId(null)} className="text-ink-400 hover:text-white p-1.5 rounded-full hover:bg-ink-800"><X size={18} /></button>
              </div>

              {/* HIZLI KOLEKSİYON SEÇİMİ (KOMPLE KOLEKSİYON AKTARMA - ONAY UYARILI) */}
              {modalOtherCollections.length > 0 && (
                <div className="p-3.5 border-b border-ink-800 bg-ink-950/60 space-y-2">
                  <div className="text-[11px] font-black uppercase tracking-wider text-gold-400 flex items-center gap-1.5">
                    <Boxes size={13} /> Koleksiyon Olarak Toplu Seç ({modalOtherCollections.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                    {modalOtherCollections.map((col) => {
                      const colMovies = (collectionMap.get(col.id) || []).filter((m) => (isTargetPast ? !m.watched : true));
                      const isAllColSelected = colMovies.length > 0 && colMovies.every((m) => bulkSelectedMovieIds.has(m.id));
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => toggleSelectWholeCollectionInModal(col.id, col.name)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            isAllColSelected
                              ? 'bg-violet-500 text-white border-violet-400 shadow-sm'
                              : 'bg-ink-900 hover:bg-ink-800 text-ink-200 border-ink-700'
                          }`}
                        >
                          {isAllColSelected ? <CheckSquare size={13} /> : <Square size={13} className="text-ink-400" />}
                          <span>{col.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isAllColSelected ? 'bg-black/25 text-white' : 'bg-ink-800 text-ink-400'}`}>
                            {colMovies.length} film
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ARAMA VE TÜMÜNÜ SEÇ BARI */}
              <div className="p-3 border-b border-ink-800 bg-ink-950/40 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input
                    type="text"
                    value={collectionSearch}
                    onChange={(e) => setCollectionSearch(e.target.value)}
                    placeholder="Listendeki filmlerde ara..."
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-ink-500 focus:outline-none focus:border-gold-500"
                  />
                </div>
                {modalSelectableMovies.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setBulkSelectedMovieIds((prev) => {
                        const next = new Set(prev);
                        if (allVisibleSelected) {
                          modalSelectableMovies.forEach((m) => next.delete(m.id));
                        } else {
                          modalSelectableMovies.forEach((m) => next.add(m.id));
                        }
                        return next;
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-200 border border-ink-700 text-xs font-bold whitespace-nowrap transition-colors"
                  >
                    {allVisibleSelected ? <CheckSquare size={14} className="text-gold-400" /> : <Square size={14} />}
                    <span>{allVisibleSelected ? 'Seçimi Kaldır' : 'Tümünü Seç'}</span>
                  </button>
                )}
              </div>

              {/* ÇOKLU SEÇİM FİLM LİSTESİ */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                {modalSelectableMovies.length === 0 ? (
                  <div className="text-center py-8 text-xs text-ink-500">
                    Aramaya uygun izlenmemiş film bulunamadı.
                  </div>
                ) : (
                  modalSelectableMovies.map((m) => {
                    const isSelected = bulkSelectedMovieIds.has(m.id);
                    const otherColName =
                      m.collectionId && m.collectionId !== addMoviesToCollectionId
                        ? data.collections.find((c) => c.id === m.collectionId)?.name
                        : null;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleBulkMovieSelection(m.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? isTargetPast
                              ? 'bg-violet-500/20 border-violet-500/50 text-white'
                              : 'bg-gold-500/20 border-gold-500/50 text-white'
                            : 'bg-ink-950/50 hover:bg-ink-800/70 border-ink-800/80 text-ink-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckSquare size={18} className={isTargetPast ? 'text-violet-400' : 'text-gold-400'} />
                            ) : (
                              <Square size={18} className="text-ink-500" />
                            )}
                          </div>
                          <div className="w-8 h-11 rounded bg-ink-900 overflow-hidden flex-shrink-0 border border-ink-700">
                            {m.posterUrl ? (
                              <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><ImageIcon size={12} className="text-ink-600" /></div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{m.title}</div>
                            <div className="text-[10px] text-ink-400">
                              {m.year || 'Yıl yok'}
                              {otherColName ? ` · Mevcut Koleksiyon: ${otherColName}` : ''}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 flex-shrink-0 ${
                            isSelected
                              ? isTargetPast
                                ? 'bg-violet-500 text-white'
                                : 'bg-gold-500 text-ink-950'
                              : 'bg-ink-800 text-ink-300'
                          }`}
                        >
                          {isSelected ? <><Check size={12} /> Seçildi</> : <><Plus size={12} /> Seç</>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="p-3 border-t border-ink-800 bg-ink-950/80 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddMoviesToCollectionId(null)}
                  className="px-4 py-2.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-300 font-bold text-xs transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkCollectionSelection}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-colors ${
                    isTargetPast
                      ? 'bg-violet-500 hover:bg-violet-400 text-white'
                      : 'bg-gold-500 hover:bg-gold-400 text-ink-950'
                  }`}
                >
                  Seçilenleri Kaydet ({bulkSelectedMovieIds.size} Film)
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* KOLEKSİYONDAN TOPLU AKTARIM ONAY UYARISI */}
      {confirmMoveColTarget && (
        <ConfirmDialog
          title="Koleksiyondan Toplu Aktarım"
          message={`"${confirmMoveColTarget.name}" koleksiyonundaki ${confirmMoveColTarget.count} adet izlenmemiş film "Eskiden İzlenenler" koleksiyonuna aktarılacak. Onaylıyor musun?`}
          onConfirm={executeConfirmedCollectionMove}
          onCancel={() => setConfirmMoveColTarget(null)}
        />
      )}

      {showPick && (
        <PickModal
          movieCount={eligibleMovies.length}
          seriesCount={0}
          unwatchedMovies={eligibleMovies}
          nextEpisodes={[]}
          onPick={(item) => { if (item.kind === 'movie') setPickedMovie(item.movie); }}
          onClose={() => setShowPick(false)}
        />
      )}

      {showDna && <DnaSynthesizerModal onClose={() => setShowDna(false)} />}

      {pickedMovie && (
        <RatingModal
          title={pickedMovie.title}
          subtitle={pickedMovie.year ? `Çıkış Yılı: ${pickedMovie.year}` : 'Film'}
          initialIsPastWatch={Boolean(pickedMovie.isPastWatch || isMovieInPastCollection(pickedMovie))}
          onRate={(rating, note, detailedRating, reviewTags, isPastWatch) => {
            watchMovie(pickedMovie.id, rating, note, detailedRating, reviewTags, isPastWatch);
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
          initialIsPastWatch={Boolean(ratingTarget.isPastWatch || isMovieInPastCollection(ratingTarget))}
          onRate={(rating, note, detailedRating, reviewTags, isPastWatch) =>
            watchMovie(ratingTarget.id, rating, note, detailedRating, reviewTags, isPastWatch)
          }
          onClose={() => setRatingTarget(null)}
        />
      )}
      {editTarget && <EditMovieModal movie={editTarget} onClose={() => setEditTarget(null)} />}
      {deleteTarget && (
        <ConfirmDialog
          title="Film Sil"
          message={`"${deleteTarget.title}" silinecek. Emin misin?`}
          onConfirm={() => { deleteMovie(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {detailMovie && <MediaDetailModal target={{ type: 'movie', data: detailMovie }} onClose={() => setDetailMovieId(null)} />}
    </div>
  );
}

function MovieRow({
  movie, nowMs, anotherTimerActive, collectionName, onDelete, onRate, onStartWatch, onTogglePause, onCancelWatch, onUnwatch, onEdit, onAssignCollection, onSelectDetail, altWatchTemplate,
}: {
  movie: Movie;
  nowMs: number;
  anotherTimerActive: boolean;
  collectionName?: string;
  onDelete: (movie: Movie) => void;
  onRate: (movie: Movie) => void;
  onStartWatch: (id: string, silent?: boolean) => void;
  onTogglePause: (id: string) => void;
  onCancelWatch: (id: string) => void;
  onUnwatch: (id: string) => void;
  onEdit: (movie: Movie) => void;
  onAssignCollection: (movie: Movie) => void;
  onSelectDetail: (movie: Movie) => void;
  altWatchTemplate?: string;
}) {
  const watchLinks: { href: string; text: string; logo: string | null; icon: any }[] = [];

  if (movie.customUrl) watchLinks.push({ href: movie.customUrl, text: 'Özel Kaynak', logo: null, icon: ExternalLink });

  if (movie.watchProviders && movie.watchProviders.length > 0) {
    movie.watchProviders.slice(0, 2).forEach((provider) => {
      let finalHref = provider.link || '';
      const pName = provider.providerName.toLowerCase();
      if (pName.includes('netflix')) finalHref = `https://www.netflix.com/search?q=${encodeURIComponent(movie.title)}`;
      else if (pName.includes('amazon') || pName.includes('prime')) finalHref = `https://www.primevideo.com/search/ref=atv_sr_sug_1?phrase=${encodeURIComponent(movie.title)}`;
      else if (pName.includes('disney')) finalHref = `https://www.disneyplus.com/search?q=${encodeURIComponent(movie.title)}`;
      else if (pName.includes('blutv')) finalHref = `https://www.blutv.com/arama?q=${encodeURIComponent(movie.title)}`;
      else if (pName.includes('mubi')) finalHref = `https://mubi.com/tr/search?query=${encodeURIComponent(movie.title)}`;
      else if (pName.includes('apple')) finalHref = `https://tv.apple.com/tr/search?q=${encodeURIComponent(movie.title)}`;
      watchLinks.push({ href: finalHref, text: provider.providerName, logo: provider.logoUrl, icon: PlayCircle });
    });
  }

  const searchQuery = encodeURIComponent(`${movie.title} ${movie.year || ''} izle`);
  watchLinks.push({ href: `https://www.google.com/search?q=${searchQuery}`, text: "Google'da Bul", logo: null, icon: Search });

  if (altWatchTemplate && (movie.imdbId || altWatchTemplate.includes('{slug}') || altWatchTemplate.includes('{title}'))) {
    const charMap: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
    const slug = movie.title.toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, (match) => charMap[match]).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const finalAltHref = altWatchTemplate.replace('{imdb}', movie.imdbId || '').replace('{slug}', slug).replace('{title}', encodeURIComponent(movie.title)).replace('{year}', movie.year || '');
    watchLinks.push({ href: finalAltHref, text: 'Alternatif', logo: null, icon: PlayCircle });
  }

  const timerInfo = !movie.watched && movie.startedAt ? getMovieTimerInfo(movie, nowMs) : null;

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
            <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300" />
          ) : (
            <ImageIcon size={20} className="text-ink-600" />
          )}
          <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/poster:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
            <div className="w-7 h-7 rounded-full bg-gold-500/90 text-ink-950 flex items-center justify-center shadow-md transform scale-75 group-hover/poster:scale-100 transition-transform">
              <Eye size={15} />
            </div>
            <span className="text-[9px] font-black text-white uppercase tracking-wider">İncele</span>
          </div>
        </button>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => onSelectDetail(movie)}
              className={`font-bold text-sm sm:text-base truncate text-left hover:text-gold-400 transition-colors ${movie.watched ? 'text-ink-500 line-through' : 'text-ink-100'}`}
              title="Sinema Kartını Gör"
            >
              {movie.title}
            </button>
            {movie.watched && movie.isPastWatch && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                <History size={10} /> Önceden İzlendi
              </span>
            )}
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
            {movie.year && <span className="flex items-center gap-1"><Calendar size={12} /> {movie.year}</span>}
            {movie.runtime && <span className="flex items-center gap-1"><Clock size={12} /> {movie.runtime} dk</span>}
            {movie.watched && !movie.isPastWatch && movie.actualRuntime && movie.runtime && movie.actualRuntime < movie.runtime && (
              <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded font-bold text-[10px]" title={`Orijinal süre: ${movie.runtime} dk | Senin bitirme süren: ${movie.actualRuntime} dk`}>
                <Zap size={10} /> {movie.actualRuntime} dk'da bitti
              </span>
            )}
          </div>

          {movie.genres.length > 0 && <div className="text-[10px] sm:text-xs text-ink-500 truncate mb-2">{movie.genres.join(' · ')}</div>}

          <div className="flex items-center gap-2 flex-wrap mt-auto">
            {movie.watched && movie.rating !== null && (
              <div className="flex items-center gap-1.5 mr-2">
                <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold shadow-sm ${ratingBgClass(movie.rating)}`}>{movie.rating}</span>
                {!movie.isPastWatch && movie.watchedAt && (
                  <span className="text-[10px] text-ink-500 hidden sm:inline">{formatDateShort(movie.watchedAt)}</span>
                )}
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
                  {link.logo ? <img src={link.logo} alt="Platform" className="w-3.5 h-3.5 rounded-sm object-cover" /> : <Icon size={12} />}
                  {link.text}
                </a>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 sm:gap-1.5 pt-3 sm:pt-0 mt-1 sm:mt-0 border-t border-ink-800/50 sm:border-0 flex-shrink-0">
        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end flex-wrap">
          {movie.watched ? (
            <button onClick={() => onUnwatch(movie.id)} className="flex-1 sm:flex-none text-xs text-ink-400 hover:text-ink-200 bg-ink-800/50 hover:bg-ink-700 px-3 py-1.5 rounded-lg transition-colors border border-ink-700/50">
              Geri Al
            </button>
          ) : (
            <>
              {timerInfo ? (
                <div className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-2.5 py-1.5 rounded-lg text-[11px] font-bold">
                  <Timer size={13} className={timerInfo.isPaused ? 'text-amber-400' : 'animate-pulse text-emerald-400'} />
                  <span className="font-mono" title={`Geçen: ${timerInfo.elapsedMins} dk | Kalan: ${timerInfo.formattedRemaining}`}>
                    {timerInfo.formattedRemaining}
                  </span>
                  <button
                    type="button"
                    onClick={() => onTogglePause(movie.id)}
                    title={timerInfo.isPaused ? 'Devam Et' : 'Duraklat'}
                    className="ml-1 text-amber-300 hover:text-white"
                  >
                    {timerInfo.isPaused ? <Play size={12} className="fill-current" /> : <Pause size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onCancelWatch(movie.id)}
                    title="Sayacı İptal Et"
                    className="ml-0.5 text-ink-400 hover:text-red-400"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onStartWatch(movie.id, false)}
                  title={anotherTimerActive ? 'Başka bir filmin sayacı açık!' : 'Geri Sayımı Başlat'}
                  className={`flex items-center justify-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all font-bold border ${
                    anotherTimerActive
                      ? 'bg-ink-900 text-ink-500 border-ink-800 cursor-not-allowed'
                      : 'bg-ink-800 hover:bg-emerald-900/30 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {anotherTimerActive ? <Lock size={11} /> : <Play size={12} className="fill-current" />} Başlat
                </button>
              )}

              <button
                onClick={() => onRate(movie)}
                title={timerInfo && !timerInfo.canRateWithTimer ? `En az ${timerInfo.minRequiredMins} dk geçmeden puanlanamaz!` : 'Filmi Puanla'}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg transition-all font-bold ${
                  timerInfo && !timerInfo.canRateWithTimer
                    ? 'bg-ink-800 text-ink-500 border border-ink-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-ink-950 shadow-md shadow-gold-500/10'
                }`}
              >
                {timerInfo && !timerInfo.canRateWithTimer ? <><Lock size={12} /> Puanla</> : <><Star size={14} /> Puanla</>}
              </button>
            </>
          )}

          <div className="flex items-center gap-1 ml-auto sm:ml-0">
            <button
              onClick={() => onAssignCollection(movie)}
              title="Koleksiyona Ekle / Değiştir"
              className={`p-1.5 rounded-lg transition-colors border ${
                movie.collectionId ? 'text-gold-400 bg-gold-500/10 border-gold-500/30 hover:bg-gold-500/20' : 'text-ink-500 hover:text-gold-400 bg-ink-900/50 hover:bg-ink-800 border-transparent hover:border-ink-700'
              }`}
            >
              <Boxes size={15} />
            </button>
            <button onClick={() => onEdit(movie)} title="Filmi Düzenle" className="text-ink-500 hover:text-gold-400 bg-ink-900/50 hover:bg-ink-800 p-1.5 rounded-lg transition-colors border border-transparent hover:border-ink-700">
              <Edit2 size={15} />
            </button>
            <button onClick={() => onDelete(movie)} title="Filmi Sil" className="text-ink-500 hover:text-red-400 bg-ink-900/50 hover:bg-ink-800 p-1.5 rounded-lg transition-colors border border-transparent hover:border-ink-700">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}