import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Projector, Trash2, Boxes, ChevronDown, ChevronRight, Star, Calendar, Filter,
  ArrowDownAZ, CalendarDays, Star as StarIcon, Check, Search, Edit2, Shuffle, Clock,
  CalendarPlus, Image as ImageIcon, RefreshCw, Dna, PlayCircle, ExternalLink, Eye,
  FolderPlus, X, Play, Pause, Timer, Zap, Lock, EyeOff, ChevronsUpDown, History,
  CheckSquare, Square, ArrowRightLeft, SlidersHorizontal, Send, Film, Skull, RotateCcw,
  Info, MessageSquare, MonitorPlay, Scale, MoreHorizontal
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getMovieTimerInfo, PAST_WATCH_COLLECTION_NAME } from '../context/AppContext';
import { useActions, useLibrary, useSettings } from '../context/slices';
import { ratingBgClass, formatDateShort, normalize } from '../lib/utils';
import { normalizeActionLabel, resolveActionUrl, rewriteLegacyTemplate } from '../lib/actionBridge';
import { searchTMDB } from '../lib/tmdb';
import { countWatchedCurrentMovies, countPastMovies, handleImgFallback } from '../lib/selectors';
import { useFilteredMovies } from '../lib/selectorHooks';
import { openPlatform, listLibraryPlatforms } from '../lib/platformLinks';
import AddMovieModal from '../components/AddMovieModal';
import SendRecommendationModal from '../components/SendRecommendationModal';
import RatingModal from '../components/RatingModal';
import EditMovieModal from '../components/EditMovieModal';
import ConfirmDialog from '../components/ConfirmDialog';
import PickModal from '../components/PickModal';
import DnaSynthesizerModal from '../components/DnaSynthesizerModal';
import MediaDetailModal from '../components/MediaDetailModal';
import AbandonModal from '../components/AbandonModal';
import type { Movie, ExternalActionTemplate } from '../types';
import '../components/movies-premium.css';

type SortMode = 'az' | 'year' | 'rating' | 'added' | 'calibrated';
type WatchedFilterMode = 'all' | 'unwatched' | 'watched' | 'past' | 'graveyard';
const PAST_QUEUE_MODAL_ID = '__PAST_QUEUE__';

/**
 * 'Gerçek Sıralama (Kalibre Edilmiş)': kalibre puan (calibratedScore, yoksa
 * puan) azalan — dürüst sıralama. İzlenmemiş / taksiz (geçerli puanı olmayan)
 * öğeler SONA toplanır; göreli sıraları korunur (Array.sort stabil).
 */
function sortCalibratedMovies(list: Movie[]): Movie[] {
  const rank = (m: Movie): number | null =>
    m.watched && typeof m.rating === 'number' ? (m.calibratedScore ?? m.rating) : null;
  const scored: Movie[] = [];
  const rest: Movie[] = [];
  list.forEach((m) => (rank(m) === null ? rest : scored).push(m));
  scored.sort((a, b) => {
    const d = (rank(b) as number) - (rank(a) as number);
    if (d !== 0) return d;
    // 10 puan gibi eşit kalibrepuanlarda: düello kazancı (duelWins) yüksek olan üstte.
    const wd = (b.duelWins || 0) - (a.duelWins || 0);
    if (wd !== 0) return wd;
    return (a.title || '').localeCompare(b.title || '', 'tr');
  });
  return [...scored, ...rest];
}

/** Hızlı Aksiyon Köprüsü şablon ikonları (lucide adı → bileşen). */
const BRIDGE_ICONS: Record<string, LucideIcon> = {
  ExternalLink, Play, Search, Info, Film, MessageSquare, MonitorPlay, PlayCircle,
};

export default function MoviesPage() {
  const {
    editMovie, deleteMovie, startWatchingMovie, togglePauseWatchingMovie,
    cancelWatchingMovie, canRateMovieWithTimer, watchMovie, unwatchMovie,
    setMovieCollection, setMoviePastQueue, addCollection, showToast,
    abandonMedia, reviveMedia,
  } = useActions();
  const { movies: libMovies, collections: libCollections } = useLibrary();
  const { agentId, altWatchTemplate, weeklyPlan, externalActions } = useSettings();

  const [showAdd, setShowAdd] = useState(false);
  const [showPick, setShowPick] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unwatchTarget, setUnwatchTarget] = useState<Movie | null>(null);
  const [reviveTarget, setReviveTarget] = useState<Movie | null>(null);
  const [showDna, setShowDna] = useState(false);
  const [pickedMovie, setPickedMovie] = useState<Movie | null>(null);
  const [ratingTarget, setRatingTarget] = useState<Movie | null>(null);
  const [editTarget, setEditTarget] = useState<Movie | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Movie | null>(null);
  const [detailMovieId, setDetailMovieId] = useState<string | null>(null);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [isCollectionsSectionOpen, setIsCollectionsSectionOpen] = useState(true);
  const [isPastCollectionOpen, setIsPastCollectionOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [highlightedMovieId, setHighlightedMovieId] = useState<string | null>(null);

  // ARKADAŞA TAVSİYE MODALI (ortak SendRecommendationModal — tek kaynak)
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendInitial, setSendInitial] = useState<{ title?: string; selectedIds?: string[] }>({});

  const [collectionTargetMovie, setCollectionTargetMovie] = useState<Movie | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [addMoviesToCollectionId, setAddMoviesToCollectionId] = useState<string | null>(null);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [bulkSelectedMovieIds, setBulkSelectedMovieIds] = useState<Set<string>>(new Set());

  const [confirmMoveColTarget, setConfirmMoveColTarget] = useState<{
    id: string; name: string; count: number; fromModal?: boolean;
  } | null>(null);

  const [showMoveFromPastModal, setShowMoveFromPastModal] = useState(false);
  const [pastMoveSearch, setPastMoveSearch] = useState('');
  const [pastMoveSelectedIds, setPastMoveSelectedIds] = useState<Set<string>>(new Set());
  const [pastMoveDestinationMode, setPastMoveDestinationMode] = useState<'remove_queue' | 'existing' | 'new'>('remove_queue');
  const [pastMoveTargetColId, setPastMoveTargetColId] = useState<string>('');
  const [pastMoveNewColName, setPastMoveNewColName] = useState<string>('');

  const [watchedFilter, setWatchedFilter] = useState<WatchedFilterMode>('unwatched');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [abandonTarget, setAbandonTarget] = useState<Movie | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('added');
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  /* "Durum ⋯" menüsü: dışına tıklayınca / Esc ile kapansın */
  useEffect(() => {
    if (!statusMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-menu-root]')) return;
      setStatusMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStatusMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [statusMenuOpen]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const activeTimerMovie = useMemo(() => libMovies.find((m) => !m.watched && m.startedAt) || null, [libMovies]);

  useEffect(() => {
    if (!activeTimerMovie) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimerMovie]);

  // PROFİLDEN VEYA AĞDAN "BU FİLME GİT" DENİLDİĞİNDE OTOMATİK FİLTRELE, KOLEKSİYONU AÇ VE KAYDIR
  useEffect(() => {
    try {
      const focusTitle = sessionStorage.getItem('sinevia_focus_media_title');
      if (!focusTitle || libMovies.length === 0) return;
      sessionStorage.removeItem('sinevia_focus_media_title');

      const targetMovie = libMovies.find(
        (m) => m.title.toLocaleLowerCase('tr-TR') === focusTitle.toLocaleLowerCase('tr-TR')
      );

      setWatchedFilter('all');
      setSelectedGenres(new Set());
      setIsFilterPanelOpen(true);

      if (targetMovie) {
        setSearch(targetMovie.title);
        setHighlightedMovieId(targetMovie.id);

        if (targetMovie.collectionId) {
          setIsCollectionsSectionOpen(true);
          setExpandedCollections((prev) => new Set(prev).add(targetMovie.collectionId!));
        }
        if (targetMovie.inPastQueue && !targetMovie.watched) {
          setIsPastCollectionOpen(true);
        }

        setTimeout(() => {
          const el = document.getElementById(`movie-row-${targetMovie.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 250);

        setTimeout(() => setHighlightedMovieId(null), 5000);
      } else {
        setSearch(focusTitle);
      }
    } catch {}
  }, [libMovies]);

  const detailMovie = useMemo(
    () => (detailMovieId ? libMovies.find((m) => m.id === detailMovieId) || null : null),
    [libMovies, detailMovieId]
  );

  const handleRequestRate = (movie: Movie) => {
    if (!movie.inPastQueue && !canRateMovieWithTimer(movie.id)) return;
    setRatingTarget(movie);
  };

  const handleSyncTMDB = async () => {
    setIsSyncing(true);
    const moviesToSync = libMovies.filter(
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
            { directors: match.directors, cast: match.cast, studios: match.studios, keywords: match.keywords, originalLanguage: match.originalLanguage }
          );
          syncedCount++;
        }
      } catch (e) {
        console.error(`Hata (${movie.title}):`, e);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    setIsSyncing(false);
    if (syncedCount > 0) showToast(`${syncedCount} filme Sinema Kartı eklendi!`, 'success');
    else showToast('Tüm künyeler güncel.', 'info');
  };

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    libMovies.forEach((m) => m.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [libMovies]);

  const eligibleMovies = useMemo(() => {
    const unwatched = libMovies.filter((m) => !m.watched && !m.inPastQueue);
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
  }, [libMovies]);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  const clearGenres = () => setSelectedGenres(new Set());
  const searchMatches = (m: Movie) => !search.trim() || m.title.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'));

  const activeFilterCount = (search.trim() !== '' ? 1 : 0) + selectedGenres.size + (sortMode !== 'added' ? 1 : 0);

  const resetAllFilters = () => { setSearch(''); setSelectedGenres(new Set()); setSortMode('added'); };

  const baseBottomListMovies = useMemo(() => {
    // Mezarlık: izleme durumundan bağımsız, yalnızca abandoned filmler.
    if (watchedFilter === 'graveyard') return libMovies.filter((m) => Boolean(m.abandoned));
    if (watchedFilter === 'past') return libMovies.filter((m) => m.watched && m.isPastWatch);
    return libMovies.filter((m) => !m.collectionId && !m.inPastQueue && !m.isPastWatch);
  }, [libMovies, watchedFilter]);

  // collectionMovies her render'da yeni referans üretiyordu (useMemo'yu anlamsız kılıyordu);
  // filtre artık useMemo gövdesinin içinde — collectionMap sadece libMovies değişince yeniden hesaplanır.
  const collectionMap = useMemo(() => {
    const map = new Map<string, Movie[]>();
    libMovies.filter((m) => m.collectionId).forEach((m) => {
      const arr = map.get(m.collectionId!) || []; arr.push(m); map.set(m.collectionId!, arr);
    });
    return map;
  }, [libMovies]);

  const allPastColUnratedMovies = useMemo(() => libMovies.filter((m) => !m.watched && m.inPastQueue).sort((a, b) => parseInt(a.year || '9999', 10) - parseInt(b.year || '9999', 10)), [libMovies]);

  const pastCollectionUnratedMovies = useMemo(() => {
    let filtered = allPastColUnratedMovies;
    if (selectedGenres.size > 0) filtered = filtered.filter((m) => Array.from(selectedGenres).every((g) => m.genres.includes(g)));
    if (search.trim() !== '') filtered = filtered.filter(searchMatches);
    return filtered;
  }, [allPastColUnratedMovies, selectedGenres, search]);

  const filteredCollections = useMemo(() => {
    // Mezarlık filtresinde koleksiyon bölümü gizlenir (tüm abandoned filmler tek listede).
    if (watchedFilter === 'graveyard') return [];
    return libCollections.filter((coll) => {
      if (normalize(coll.name) === normalize(PAST_WATCH_COLLECTION_NAME)) return false;
      const movies = collectionMap.get(coll.id) || [];
      const hasUnwatched = movies.some((m) => !m.watched && !m.abandoned);
      const hasNormalWatched = movies.some((m) => m.watched && !m.isPastWatch);
      const hasPastWatched = movies.some((m) => m.watched && m.isPastWatch);
      if (watchedFilter === 'unwatched' && !hasUnwatched) return false;
      if (watchedFilter === 'watched' && (hasUnwatched || !hasNormalWatched)) return false;
      if (watchedFilter === 'past' && (hasUnwatched || !hasPastWatched)) return false;
      if (selectedGenres.size > 0) { const hasGenreMatch = movies.some((m) => Array.from(selectedGenres).every((g) => m.genres.includes(g))); if (!hasGenreMatch) return false; }
      if (search.trim() !== '') {
        const q = search.toLocaleLowerCase('tr-TR');
        const matchesName = coll.name.toLocaleLowerCase('tr-TR').includes(q);
        const matchesMovie = movies.some((m) => m.title.toLocaleLowerCase('tr-TR').includes(q));
        if (!matchesName && !matchesMovie) return false;
      }
      return true;
    });
  }, [libCollections, collectionMap, watchedFilter, selectedGenres, search]);

  const toggleCollection = (id: string) => {
    setExpandedCollections((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const allFilteredExpanded = useMemo(() => filteredCollections.length > 0 && filteredCollections.every((c) => expandedCollections.has(c.id)), [filteredCollections, expandedCollections]);

  const handleToggleAllCollectionsExpand = () => {
    if (allFilteredExpanded) { setExpandedCollections((prev) => { const next = new Set(prev); filteredCollections.forEach((c) => next.delete(c.id)); return next; }); }
    else { setExpandedCollections((prev) => { const next = new Set(prev); filteredCollections.forEach((c) => next.add(c.id)); return next; }); }
  };

  const handleAssignCollection = (movie: Movie, colId: string | null) => {
    setMovieCollection(movie.id, colId);
    if (colId) { const colName = libCollections.find((c) => c.id === colId)?.name || 'Koleksiyon'; showToast(`"${movie.title}" ➔ ${colName} koleksiyonuna eklendi`, 'success'); }
    else { showToast(`"${movie.title}" koleksiyondan çıkarıldı`, 'info'); }
    setCollectionTargetMovie(null); setNewCollectionName('');
  };

  const handleCreateAndAssignCollection = () => {
    if (!collectionTargetMovie || !newCollectionName.trim()) return;
    const newId = addCollection(newCollectionName.trim());
    setMovieCollection(collectionTargetMovie.id, newId);
    showToast(`"${collectionTargetMovie.title}" ➔ ${newCollectionName.trim()} koleksiyonuna eklendi`, 'success');
    setNewCollectionName(''); setCollectionTargetMovie(null);
  };

  const requestMoveEntireCollectionToPast = (sourceColId: string, sourceColName: string, fromModal = false) => {
    const moviesToMove = (collectionMap.get(sourceColId) || []).filter((m) => !m.watched && !m.inPastQueue);
    if (moviesToMove.length === 0) { showToast(`"${sourceColName}" içindeki izlenmemiş filmler zaten Eskiden İzlenenler sırasında.`, 'info'); return; }
    setConfirmMoveColTarget({ id: sourceColId, name: sourceColName, count: moviesToMove.length, fromModal });
  };

  const executeConfirmedCollectionMove = () => {
    if (!confirmMoveColTarget) return;
    const { id: sourceColId, name: sourceColName, fromModal } = confirmMoveColTarget;
    const moviesToMove = (collectionMap.get(sourceColId) || []).filter((m) => !m.watched);
    if (fromModal) { setBulkSelectedMovieIds((prev) => { const next = new Set(prev); moviesToMove.forEach((m) => next.add(m.id)); return next; }); showToast(`"${sourceColName}" içindeki ${moviesToMove.length} film seçime eklendi`, 'info'); }
    else { moviesToMove.forEach((m) => setMoviePastQueue(m.id, true)); setIsPastCollectionOpen(true); showToast(`"${sourceColName}" koleksiyonundaki ${moviesToMove.length} film Eskiden İzlenenler sırasına eklendi!`, 'success'); }
    setConfirmMoveColTarget(null);
  };

  const openBulkCollectionModal = (colId: string) => {
    setAddMoviesToCollectionId(colId); setCollectionSearch('');
    if (colId === PAST_QUEUE_MODAL_ID) { const currentInQueue = libMovies.filter((m) => !m.watched && m.inPastQueue).map((m) => m.id); setBulkSelectedMovieIds(new Set(currentInQueue)); }
    else { const currentInCol = libMovies.filter((m) => m.collectionId === colId).map((m) => m.id); setBulkSelectedMovieIds(new Set(currentInCol)); }
  };

  const toggleBulkMovieSelection = (movieId: string) => {
    setBulkSelectedMovieIds((prev) => { const next = new Set(prev); if (next.has(movieId)) next.delete(movieId); else next.add(movieId); return next; });
  };

  const toggleSelectWholeCollectionInModal = (colId: string, colName: string) => {
    const isTargetPastCol = addMoviesToCollectionId === PAST_QUEUE_MODAL_ID;
    const colMovies = (collectionMap.get(colId) || []).filter((m) => (isTargetPastCol ? !m.watched : true));
    if (colMovies.length === 0) return;
    const allSelected = colMovies.every((m) => bulkSelectedMovieIds.has(m.id));
    if (allSelected) { setBulkSelectedMovieIds((prev) => { const next = new Set(prev); colMovies.forEach((m) => next.delete(m.id)); return next; }); }
    else if (isTargetPastCol) { requestMoveEntireCollectionToPast(colId, colName, true); }
    else { setBulkSelectedMovieIds((prev) => { const next = new Set(prev); colMovies.forEach((m) => next.add(m.id)); return next; }); }
  };

  const handleApplyBulkCollectionSelection = () => {
    if (!addMoviesToCollectionId) return;
    if (addMoviesToCollectionId === PAST_QUEUE_MODAL_ID) {
      let addedCount = 0; let removedCount = 0;
      libMovies.forEach((m) => {
        if (m.watched) return; const shouldBeInQueue = bulkSelectedMovieIds.has(m.id); const isCurrentlyInQueue = Boolean(m.inPastQueue);
        if (shouldBeInQueue && !isCurrentlyInQueue) { setMoviePastQueue(m.id, true); addedCount++; } else if (!shouldBeInQueue && isCurrentlyInQueue) { setMoviePastQueue(m.id, false); removedCount++; }
      });
      if (addedCount > 0 || removedCount > 0) { showToast(`Eskiden İzlenenler: ${addedCount} film eklendi${removedCount > 0 ? `, ${removedCount} film çıkarıldı` : ''}`, 'success'); if (addedCount > 0) setIsPastCollectionOpen(true); }
      setAddMoviesToCollectionId(null); return;
    }

    const targetColId = addMoviesToCollectionId; const targetColName = libCollections.find((c) => c.id === targetColId)?.name || 'Koleksiyon';
    let addedCount = 0; let removedCount = 0;
    libMovies.forEach((m) => {
      const shouldBeInCol = bulkSelectedMovieIds.has(m.id); const isCurrentlyInCol = m.collectionId === targetColId;
      if (shouldBeInCol && !isCurrentlyInCol) { setMovieCollection(m.id, targetColId); addedCount++; } else if (!shouldBeInCol && isCurrentlyInCol) { setMovieCollection(m.id, null); removedCount++; }
    });
    if (addedCount > 0 || removedCount > 0) { showToast(`${targetColName}: ${addedCount} eklendi${removedCount > 0 ? `, ${removedCount} çıkarıldı` : ''}`, 'success'); }
    setAddMoviesToCollectionId(null);
  };

  const openMoveFromPastModal = () => {
    setPastMoveSearch(''); setPastMoveSelectedIds(new Set()); setPastMoveDestinationMode('remove_queue');
    const regularCols = libCollections.filter((c) => normalize(c.name) !== normalize(PAST_WATCH_COLLECTION_NAME));
    setPastMoveTargetColId(regularCols[0]?.id || ''); setPastMoveNewColName(''); setShowMoveFromPastModal(true);
  };

  const togglePastMoveMovie = (id: string) => {
    setPastMoveSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const handleExecuteMoveFromPast = () => {
    if (pastMoveSelectedIds.size === 0) return;
    if (pastMoveDestinationMode === 'remove_queue') { pastMoveSelectedIds.forEach((movieId) => { setMoviePastQueue(movieId, false); }); showToast('Seçilen filmler sıradan çıkarıldı!', 'success'); setShowMoveFromPastModal(false); setPastMoveSelectedIds(new Set()); return; }

    let finalDestColId: string | null = null; let destLabel = 'Koleksiyon';
    if (pastMoveDestinationMode === 'existing') { if (!pastMoveTargetColId) { showToast('Koleksiyon seçin!', 'warning'); return; } finalDestColId = pastMoveTargetColId; destLabel = libCollections.find((c) => c.id === pastMoveTargetColId)?.name || 'Koleksiyon'; }
    else if (pastMoveDestinationMode === 'new') { if (!pastMoveNewColName.trim()) { showToast('İsim yazın!', 'warning'); return; } finalDestColId = addCollection(pastMoveNewColName.trim()); destLabel = pastMoveNewColName.trim(); }

    pastMoveSelectedIds.forEach((movieId) => { setMoviePastQueue(movieId, false); setMovieCollection(movieId, finalDestColId); });
    showToast(`${pastMoveSelectedIds.size} film "${destLabel}" koleksiyonuna taşındı!`, 'success'); setShowMoveFromPastModal(false); setPastMoveSelectedIds(new Set());
  };

  const openSendModal = (singleMovie?: Movie) => {
    if (!agentId) { showToast('Lütfen önce ayarlardan Sinevia Ağı kimliğinizi oluşturun!', 'error'); return; }
    if (singleMovie) {
      setSendInitial({ title: `Tavsiye: ${singleMovie.title}`, selectedIds: [singleMovie.id] });
    } else {
      setSendInitial({ title: 'Özel Film Tavsiyeleri' });
    }
    setShowSendModal(true);
  };

  // Kalibre mod lib SortMode'a girmediği için filtreme 'added' ile yapılır,
  // dürüst sıralama yerel karşılaştırıcıyla Memo içinde uygulanır.
  const filteredBottomForSort = useFilteredMovies(
    baseBottomListMovies,
    watchedFilter,
    selectedGenres,
    search,
    sortMode === 'calibrated' ? 'added' : sortMode
  );
  const sortedBottomMovies = useMemo(() => {
    const base = sortMode === 'calibrated' ? sortCalibratedMovies(filteredBottomForSort) : filteredBottomForSort;
    if (!platformFilter) return base;
    return base.filter((m) =>
      (m.watchProviders || []).some((p) => p.providerName === platformFilter)
    );
  }, [filteredBottomForSort, sortMode, platformFilter]);
  const platformOptions = useMemo(() => listLibraryPlatforms(libMovies), [libMovies]);
  const totalUnwatched = useMemo(() => libMovies.filter((m) => !m.watched && !m.abandoned).length, [libMovies]);
  const totalWatched = useMemo(() => countWatchedCurrentMovies(libMovies), [libMovies]);
  const totalPastWatched = useMemo(() => countPastMovies(libMovies), [libMovies]);
  const totalAbandoned = useMemo(() => libMovies.filter((m) => Boolean(m.abandoned)).length, [libMovies]);

  const modalSelectableMovies = useMemo(() => {
    if (!addMoviesToCollectionId) return [];
    const isTargetPastCol = addMoviesToCollectionId === PAST_QUEUE_MODAL_ID;
    return libMovies.filter((m) => {
      if (isTargetPastCol && m.watched) return false;
      if (!collectionSearch.trim()) return true;
      return m.title.toLocaleLowerCase('tr-TR').includes(collectionSearch.toLocaleLowerCase('tr-TR'));
    });
  }, [libMovies, addMoviesToCollectionId, collectionSearch]);

  const modalOtherCollections = useMemo(() => {
    if (!addMoviesToCollectionId) return [];
    const isTargetPastCol = addMoviesToCollectionId === PAST_QUEUE_MODAL_ID;
    return libCollections.filter((c) => {
      if (c.id === addMoviesToCollectionId) return false;
      if (normalize(c.name) === normalize(PAST_WATCH_COLLECTION_NAME)) return false;
      const movies = (collectionMap.get(c.id) || []).filter((m) => (isTargetPastCol ? !m.watched : true));
      return movies.length > 0;
    });
  }, [libCollections, collectionMap, addMoviesToCollectionId]);

  const filteredPastMoviesForMove = useMemo(() => {
    if (!pastMoveSearch.trim()) return allPastColUnratedMovies;
    const q = pastMoveSearch.toLocaleLowerCase('tr-TR');
    return allPastColUnratedMovies.filter((m) => m.title.toLocaleLowerCase('tr-TR').includes(q));
  }, [allPastColUnratedMovies, pastMoveSearch]);

  const regularCollectionsList = useMemo(() => libCollections.filter((c) => normalize(c.name) !== normalize(PAST_WATCH_COLLECTION_NAME)), [libCollections]);
  const plannedMovieIds = useMemo(() => { const ids = new Set<string>(); (weeklyPlan || []).forEach(p => ids.add(p.movieId)); return ids; }, [weeklyPlan]);

  return (
    <div className="space-y-4 sm:space-y-5 mpx-root">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-ink-100 flex items-center gap-2.5">
            <div className="mpx-tile">
              <Projector size={20} />
            </div>
            Filmler
          </h1>

          <div className="flex items-center gap-1.5 md:hidden">
            <button
              onClick={() => setShowAdd(true)}
              data-tutorial="movies-add"
              className="mpx-btn mpx-btn-p mpx-btn-xs"
            >
              <Plus size={16} strokeWidth={2.5} /> Film Ekle
            </button>
            <div className="relative">
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="mpx-btn mpx-btn-s mpx-btn-xs"
                aria-expanded={mobileMenuOpen}
                aria-label="Diğer film aksiyonları"
              >
                <MoreHorizontal size={16} />
              </button>
              {mobileMenuOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 flex w-44 flex-col gap-1 rounded-2xl border border-white/10 bg-ink-950/95 p-1.5 shadow-2xl backdrop-blur-md">
                  <button
                    onClick={() => { setMobileMenuOpen(false); openSendModal(); }}
                    className="mpx-btn mpx-btn-s mpx-btn-xs w-full justify-start"
                  >
                    <Send size={15} className="flex-shrink-0 text-violet-400" />
                    <span className="truncate">Tavsiye Et</span>
                  </button>
                  <button
                    onClick={() => { setMobileMenuOpen(false); handleSyncTMDB(); }}
                    disabled={isSyncing}
                    className="mpx-btn mpx-btn-s mpx-btn-xs w-full justify-start"
                  >
                    <RefreshCw size={15} className={`flex-shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span className="truncate">{isSyncing ? 'Taranıyor' : 'Eksik Bul'}</span>
                  </button>
                  <button
                    onClick={() => { setMobileMenuOpen(false); setShowPick(true); }}
                    data-tutorial="movies-pick"
                    className="mpx-btn mpx-btn-s mpx-btn-xs w-full justify-start"
                  >
                    <Shuffle size={15} className="flex-shrink-0" />
                    <span className="truncate">Ne İzlesem</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="hidden md:flex md:flex-nowrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => openSendModal()}
            className="mpx-btn mpx-btn-s mpx-btn-xs flex-1 sm:flex-none"
            title="Arkadaşına tekli veya çoklu film listesi öner"
          >
            <Send size={15} className="flex-shrink-0 text-violet-400" />
            <span className="truncate">Tavsiye Et</span>
          </button>

          <button
            onClick={() => setShowDna(true)}
            className="mpx-btn mpx-btn-s mpx-btn-xs flex-1 sm:flex-none"
          >
            <Dna size={15} className="flex-shrink-0 text-emerald-400" />
            <span className="truncate">DNA</span>
          </button>
          <button
            onClick={handleSyncTMDB}
            disabled={isSyncing}
            className="mpx-btn mpx-btn-s mpx-btn-xs flex-1 sm:flex-none"
          >
            <RefreshCw size={15} className={`flex-shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="truncate">{isSyncing ? 'Taranıyor' : 'Eksik Bul'}</span>
          </button>
          <button
            onClick={() => setShowPick(true)}
            data-tutorial="movies-pick"
            className="mpx-btn mpx-btn-s mpx-btn-xs flex-1 sm:flex-none"
          >
            <Shuffle size={15} className="flex-shrink-0" />
            <span className="truncate">Ne İzlesem</span>
          </button>
          <button
            onClick={() => setShowAdd(true)}
            data-tutorial="movies-add"
            className="mpx-btn mpx-btn-p"
          >
            <Plus size={18} /> Film Ekle
          </button>
        </div>
      </div>

      {activeTimerMovie && (() => {
        const info = getMovieTimerInfo(activeTimerMovie, nowMs);
        return (
          <div className="mpx-timerbar p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                <Timer size={18} className={info.isPaused ? 'text-amber-400' : 'text-emerald-400 animate-pulse'} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 truncate">
                  <span>{info.isPaused ? '⏸️ Duraklatıldı' : '⏳ Sayaç Aktif'}</span>
                  <span className="text-white truncate">• {activeTimerMovie.title}</span>
                </div>
                <div className="text-[11px] text-ink-300 mt-0.5 flex flex-wrap items-center gap-x-2">
                  <span className="mpx-mono font-semibold">Kalan: <strong className="text-emerald-300 tabular-nums">{info.formattedRemaining}</strong></span>
                  <span className="mpx-mono font-semibold">• Geçen: <strong>{info.elapsedMins}/{info.maxMins} dk</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end flex-wrap">
              <button
                type="button"
                onClick={() => togglePauseWatchingMovie(activeTimerMovie.id)}
                className="mpx-btn mpx-btn-s mpx-btn-xs flex-1 sm:flex-none text-amber-300"
              >
                {info.isPaused ? <><Play size={12} className="fill-current" /> Devam</> : <><Pause size={12} /> Duraklat</>}
              </button>
              <button
                type="button"
                onClick={() => handleRequestRate(activeTimerMovie)}
                className={`mpx-btn mpx-btn-xs flex-1 sm:flex-none ${
                  info.canRateWithTimer
                    ? 'mpx-btn-p'
                    : 'mpx-btn-g mpx-off'
                }`}
              >
                {info.canRateWithTimer ? <><Star size={12} className="fill-current" /> Bitir & Puanla</> : <><Lock size={11} /> {info.minRequiredMins - info.elapsedMins} dk</>}
              </button>
              <button
                type="button"
                onClick={() => cancelWatchingMovie(activeTimerMovie.id)}
                title="Sayacı İptal Et"
                className="mpx-ibtn text-red-400"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })()}

      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div data-tutorial="movies-filter" className="mpx-chipbar w-full sm:w-auto hide-scrollbar">
            <button
              onClick={() => setWatchedFilter('all')}
              className={`mpx-chip ${watchedFilter === 'all' ? 'on' : ''}`}
            >
              Tümü ({libMovies.length})
            </button>
            <button
              onClick={() => setWatchedFilter('unwatched')}
              className={`mpx-chip ${watchedFilter === 'unwatched' ? 'on' : ''}`}
            >
              İzlenecek ({totalUnwatched})
            </button>
            <div className="relative" data-menu-root>
              <button
                type="button"
                onClick={() => setStatusMenuOpen((prev) => !prev)}
                className={`mpx-chip ${['watched', 'past', 'graveyard'].includes(watchedFilter) ? 'on' : ''}`}
                aria-expanded={statusMenuOpen}
                title="Diğer durumlar"
              >
                <MoreHorizontal size={14} />
                <span>
                  {watchedFilter === 'watched'
                    ? 'İzlenen'
                    : watchedFilter === 'past'
                      ? 'Önceden'
                      : watchedFilter === 'graveyard'
                        ? 'Mezarlık'
                        : 'Durum'}
                </span>
              </button>
              {statusMenuOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 flex w-44 flex-col gap-1 rounded-2xl border border-white/10 bg-ink-950/95 p-1.5 shadow-2xl backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => {
                      setWatchedFilter('watched');
                      setStatusMenuOpen(false);
                    }}
                    className={`mpx-btn mpx-btn-s mpx-btn-xs w-full justify-start ${watchedFilter === 'watched' ? 'on' : ''}`}
                  >
                    İzlenen ({totalWatched})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWatchedFilter('past');
                      setStatusMenuOpen(false);
                    }}
                    className={`mpx-btn mpx-btn-s mpx-btn-xs w-full justify-start ${watchedFilter === 'past' ? 'on' : ''}`}
                  >
                    <History size={12} /> Önceden ({totalPastWatched})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWatchedFilter('graveyard');
                      setStatusMenuOpen(false);
                    }}
                    className={`mpx-btn mpx-btn-s mpx-btn-xs w-full justify-start ${watchedFilter === 'graveyard' ? 'on' : ''}`}
                    title="Yarım bırakılan filmler (Sinematik Otopsi)"
                  >
                    🪦 Mezarlık ({totalAbandoned})
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {platformOptions.length > 0 && (
              <div className="hidden md:block">
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  title="Platforma göre filtrele"
                  className="mpx-btn mpx-btn-xs mpx-btn-s sm:flex-none"
                >
                  <option value="">Tüm Platformlar</option>
                  {platformOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsFilterPanelOpen((prev) => !prev)}
              className={`mpx-btn mpx-btn-xs mpx-filter-btn flex-1 sm:flex-none ${
                isFilterPanelOpen || activeFilterCount > 0 ? 'mpx-btn-s on' : 'mpx-btn-s'
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>Ara & Filtrele</span>
              {activeFilterCount > 0 && (
                <span className="mpx-idx ml-0.5">
                  {activeFilterCount}
                </span>
              )}
              {isFilterPanelOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetAllFilters}
                title="Arama ve filtreleri sıfırla"
                className="mpx-ibtn text-red-400"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {isFilterPanelOpen && (
          <div className="mpx-card mpx-hair p-3 sm:p-4 space-y-3 animate-fade-in">
            <div className="relative mpx-search-field">
              <Search size={15} className="mpx-search-ico absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 z-10" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Film veya koleksiyon adı ara..."
                className="mpx-input has-icon mpx-search"
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

            {platformOptions.length > 0 && (
              <div className="md:hidden">
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  title="Platforma göre filtrele"
                  className="mpx-btn mpx-btn-xs mpx-btn-s w-full"
                >
                  <option value="">Tüm Platformlar</option>
                  {platformOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
              <div className="mpx-mono flex items-center gap-1 text-[11px] font-bold text-ink-400 mr-1 flex-shrink-0">
                <Filter size={12} /> Sırala:
              </div>
              <button onClick={() => setSortMode('added')} className={`mpx-chip ${sortMode === 'added' ? 'on' : ''}`}>
                <CalendarPlus size={13} /> Eklenme
              </button>
              <button onClick={() => setSortMode('az')} className={`mpx-chip ${sortMode === 'az' ? 'on' : ''}`}>
                <ArrowDownAZ size={13} /> A-Z
              </button>
              <button onClick={() => setSortMode('year')} className={`mpx-chip ${sortMode === 'year' ? 'on' : ''}`}>
                <CalendarDays size={13} /> Yıl
              </button>
              <button onClick={() => setSortMode('rating')} className={`mpx-chip ${sortMode === 'rating' ? 'on' : ''}`}>
                <StarIcon size={13} /> Puan
              </button>
              <button
                onClick={() => setSortMode('calibrated')}
                className={`mpx-chip ${sortMode === 'calibrated' ? 'on' : ''}`}
                title="Gerçek Sıralama (Kalibre Edilmiş) — kalibre puan (Elo) bazlı dürüst sıralama; izlenmemiş/taksizler sonda"
              >
                <Scale size={13} /> Gerçek Sıralama
              </button>
            </div>

            {allGenres.length > 0 && (
              <div className="flex sm:flex-wrap gap-1.5 items-center overflow-x-auto hide-scrollbar pt-1 border-t border-ink-800/70">
                <button
                  onClick={clearGenres}
                  className={`mpx-chip ${selectedGenres.size === 0 ? 'on' : ''}`}
                >
                  Tüm Türler
                </button>
                {allGenres.map((g) => {
                  const active = selectedGenres.has(g);
                  return (
                    <button
                      key={g}
                      onClick={() => toggleGenre(g)}
                      className={`mpx-chip ${active ? 'on' : ''}`}
                    >
                      {active && <Check size={11} />}
                      {g}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ESKİDEN İZLENENLER */}
      {watchedFilter !== 'watched' && watchedFilter !== 'past' && watchedFilter !== 'graveyard' && (
        <div className="mpx-card mpx-card-hover is-past overflow-hidden transition-all">
          <div className="mpx-headrow">
            <button
              type="button"
              onClick={() => setIsPastCollectionOpen((prev) => !prev)}
              className="flex items-center gap-2 flex-1 text-left min-w-0"
            >
              {isPastCollectionOpen ? (
                <ChevronDown size={17} className="text-violet-400 flex-shrink-0" />
              ) : (
                <ChevronRight size={17} className="text-violet-400 flex-shrink-0" />
              )}
              <History size={16} className="text-violet-400 flex-shrink-0" />
              <span className="font-bold text-xs sm:text-sm text-ink-100 truncate">
                Eskiden İzlenenler
              </span>
              <span className="mpx-idx flex-shrink-0" style={{ background: 'linear-gradient(135deg,#a78bfa,#6d28d9)' }}>
                {pastCollectionUnratedMovies.length}
              </span>
            </button>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {allPastColUnratedMovies.length > 0 && (
                <button
                  type="button"
                  onClick={openMoveFromPastModal}
                  className="mpx-btn mpx-btn-s mpx-btn-xs text-amber-300"
                  title="Buradaki filmleri seçerek sıradan çıkar veya başka bir koleksiyona topluca taşı"
                >
                  <ArrowRightLeft size={11} />
                  <span>Taşı</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => openBulkCollectionModal(PAST_QUEUE_MODAL_ID)}
                className="mpx-btn mpx-btn-s mpx-btn-xs text-violet-300"
                title="Listeden çoklu film veya koleksiyon seçerek buraya ekle"
              >
                <Plus size={12} />
                <span>Film Seç</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPastCollectionOpen((prev) => !prev)}
                className="mpx-btn mpx-btn-s mpx-btn-xs text-violet-300"
              >
                {isPastCollectionOpen ? (
                  <><EyeOff size={12} /> <span className="hidden xs:inline">Kapat</span></>
                ) : (
                  <><Eye size={12} /> <span className="hidden xs:inline">Aç</span></>
                )}
              </button>
            </div>
          </div>

          {isPastCollectionOpen && (
            <div className="border-t border-violet-500/25 animate-fade-in">
              <div className="p-3 sm:p-4 custom-scrollbar">
                {pastCollectionUnratedMovies.length === 0 ? (
                  <div className="mpx-empty">
                    <p className="text-xs">
                      Bu koleksiyonda puanlanmayı bekleyen film yok. Sağ üstteki <strong>"+ Film Seç"</strong> butonundan birden fazla filmi veya koleksiyonu buraya ekleyebilirsin.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {pastCollectionUnratedMovies.map((m) => {
                      const origColName = m.collectionId
                        ? libCollections.find((c) => c.id === m.collectionId)?.name
                        : undefined;
                      return (
                        <div key={m.id} className="flex flex-col gap-1.5 min-w-0">
                          {/* Afiş: tıklayınca künye açılır. Butonlar afişin ALTINDA (mobil). */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setDetailMovieId(m.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailMovieId(m.id); } }}
                            className="mpx-poster relative aspect-[2/3] overflow-hidden cursor-pointer group"
                            title="Künyeyi gör"
                          >
                            {m.posterUrl ? (
                              <img loading="lazy" decoding="async" src={m.posterUrl} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"  onError={handleImgFallback}/>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-ink-700">
                                <Film size={24} />
                              </div>
                            )}
                            <i className="mpx-corner" />
                            <div className="absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent p-2 pt-6">
                              <h3 className="text-[9px] font-bold text-white line-clamp-2 leading-tight">{m.title}</h3>
                              <div className="text-[8px] text-ink-400 mt-0.5 truncate">{m.year || 'Yıl yok'} {origColName ? `· ${origColName}` : ''}</div>
                            </div>
                            {/* Masaüstünde hover ile tek aksiyon: Puanla */}
                            <div className="hidden sm:flex absolute inset-0 z-[2] bg-ink-950/80 flex-col justify-center items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRequestRate(m); }}
                                className="mpx-btn mpx-btn-p mpx-btn-xs w-full"
                              >
                                <Star size={10} /> Puanla
                              </button>
                            </div>
                          </div>
                          {/* Mobil: afişin altında sadece Puanla */}
                          <button
                            type="button"
                            onClick={() => handleRequestRate(m)}
                            className="sm:hidden mpx-btn mpx-btn-p mpx-btn-xs w-full"
                            title="Puanla"
                          >
                            <Star size={10} /> Puanla
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* KOLEKSİYONLAR */}
      {filteredCollections.length > 0 && (
        <div className="space-y-2.5">
          <div className="mpx-secbar">
            <button
              type="button"
              onClick={() => setIsCollectionsSectionOpen((prev) => !prev)}
              className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-ink-200 hover:text-gold-400 uppercase tracking-wide transition-colors min-w-0"
            >
              {isCollectionsSectionOpen ? <ChevronDown size={16} className="text-gold-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-gold-400 flex-shrink-0" />}
              <Boxes size={15} className="text-gold-400 flex-shrink-0" />
              <span className="truncate">Koleksiyonlar</span>
              <span className="mpx-idx flex-shrink-0">
                {filteredCollections.length}
              </span>
            </button>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isCollectionsSectionOpen && (
                <button
                  type="button"
                  onClick={handleToggleAllCollectionsExpand}
                  className="mpx-btn mpx-btn-s mpx-btn-xs"
                >
                  <ChevronsUpDown size={12} className="text-gold-400" />
                  <span>{allFilteredExpanded ? 'Daralt' : 'Genişlet'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsCollectionsSectionOpen((prev) => !prev)}
                className="mpx-btn mpx-btn-s mpx-btn-xs"
              >
                {isCollectionsSectionOpen ? (
                  <><EyeOff size={12} /> <span>Gizle</span></>
                ) : (
                  <><Eye size={12} /> <span>Göster</span></>
                )}
              </button>
            </div>
          </div>

          {isCollectionsSectionOpen && (
            <div className="space-y-2.5 animate-fade-in">
              {filteredCollections.map((coll) => {
                const movies = collectionMap.get(coll.id) || [];
                const visibleMovies = [...movies].sort((a, b) => parseInt(a.year || '9999', 10) - parseInt(b.year || '9999', 10));

                const watchedInCol = movies.filter((m) => m.watched).length;
                const notInPastQueueUnwatched = movies.filter((m) => !m.watched && !m.inPastQueue).length;
                const isCompletelyWatched = movies.length > 0 && watchedInCol === movies.length;
                const isExpanded = expandedCollections.has(coll.id);

                return (
                  <div
                    key={coll.id}
                    className={`mpx-card overflow-hidden transition-all ${
                      isCompletelyWatched ? 'is-done' : 'mpx-card-hover'
                    }`}
                  >
                    <div className="mpx-headrow">
                      <button type="button" onClick={() => toggleCollection(coll.id)} className="flex items-center gap-2.5 flex-1 text-left min-w-0">
                        {isExpanded ? <ChevronDown size={18} className="text-ink-500 flex-shrink-0" /> : <ChevronRight size={18} className="text-ink-500 flex-shrink-0" />}
                        <Boxes size={16} className={isCompletelyWatched ? 'text-green-400 flex-shrink-0' : 'text-gold-400 flex-shrink-0'} />
                        <span className="font-semibold text-xs sm:text-sm text-ink-100 truncate">{coll.name}</span>
                        {isCompletelyWatched && (
                          <span className="mpx-tag is-done flex-shrink-0">
                            <Check size={10} /> <span className="hidden sm:inline">Tamamlandı</span>
                          </span>
                        )}
                      </button>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {notInPastQueueUnwatched > 0 && (
                          <button
                            type="button"
                            onClick={() => requestMoveEntireCollectionToPast(coll.id, coll.name, false)}
                            className="mpx-btn mpx-btn-s mpx-btn-xs text-violet-300"
                            title="Bu koleksiyondaki izlenmemiş filmleri kendi koleksiyonundan silmeden Eskiden İzlenenler sırasına ekle"
                          >
                            <History size={12} /> <span className="hidden md:inline">Eskiden İzlenenlere Aktar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openBulkCollectionModal(coll.id)}
                          className="mpx-btn mpx-btn-s mpx-btn-xs"
                          title="Listeden bu koleksiyona çoklu film ekle"
                        >
                          <Plus size={12} className="text-gold-400" /> <span className="hidden sm:inline">Film Ekle</span>
                        </button>
                        <span className="mpx-count">
                          {watchedInCol}/{movies.length}
                        </span>
                      </div>
                    </div>

                    {!isExpanded && visibleMovies.length > 0 && (
                      <div
                        onClick={() => toggleCollection(coll.id)}
                        className="px-3 sm:px-4 pb-3 sm:pb-4 flex items-center gap-1.5 sm:gap-2 overflow-x-auto hide-scrollbar cursor-pointer"
                      >
                        {visibleMovies.map((m) => (
                          <div
                            key={m.id}
                            className="mpx-poster w-9 sm:w-11 aspect-[2/3] flex-shrink-0"
                            title={m.title}
                          >
                            {m.posterUrl ? (
                              <img loading="lazy" decoding="async" src={m.posterUrl} alt={m.title} className="w-full h-full object-cover"  onError={handleImgFallback}/>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon size={12} className="text-ink-600" />
                              </div>
                            )}
                            {m.watched && !m.abandoned && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                                <Check size={16} strokeWidth={3} className="text-green-400 drop-shadow-lg" />
                              </div>
                            )}
                            {m.abandoned && (
                              <div className="absolute inset-0 bg-black/65 flex items-center justify-center backdrop-blur-[1px]">
                                <div className="flex flex-col items-center gap-0.5">
                                  <Skull size={13} strokeWidth={2.5} className="text-amber-400 drop-shadow-lg" />
                                  <span className="text-[6.5px] font-black uppercase tracking-wider text-amber-300">Mezarlık</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {isExpanded && (
                      <div className="border-t border-ink-700/40 bg-ink-950/20 p-2 sm:p-3 space-y-2.5">
                        {visibleMovies.length === 0 ? (
                          <div className="p-4 text-xs text-ink-500 text-center">Bu koleksiyonda bu filtreye uygun film yok.</div>
                        ) : (
                          visibleMovies.map((m) => (
                            <MovieRow
                              key={m.id}
                              movie={m}
                              isHighlighted={highlightedMovieId === m.id}
                              nowMs={nowMs}
                              anotherTimerActive={Boolean(activeTimerMovie && activeTimerMovie.id !== m.id)}
                              isPlanned={plannedMovieIds.has(m.id)}
                              collectionName={coll.name}
                              onDelete={(movie) => setDeleteTarget(movie)}
                              onRate={handleRequestRate}
                              onStartWatch={startWatchingMovie}
                              onTogglePause={togglePauseWatchingMovie}
                              onCancelWatch={cancelWatchingMovie}
                              onUnwatch={(id) => setUnwatchTarget(libMovies.find((m) => m.id === id) ?? null)}
                              onEdit={(movie) => setEditTarget(movie)}
                              onAssignCollection={(movie) => setCollectionTargetMovie(movie)}
                              onSelectDetail={(movie) => setDetailMovieId(movie.id)}
                              onSendToFriend={openSendModal}
                              onPastQueue={(movie) => setMoviePastQueue(movie.id, true)}
                              altWatchTemplate={altWatchTemplate}
                              externalActions={externalActions}
                              onAbandon={(movie) => setAbandonTarget(movie)}
                              onRevive={(movie) => setReviveTarget(movie)}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* BAĞIMSIZ FİLMLER */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="mpx-sec-title">
            {watchedFilter === 'graveyard'
              ? '🪦 Mezarlık'
              : watchedFilter === 'past'
              ? 'Daha Önce İzlenen Filmler'
              : 'Bağımsız Filmler'}
          </h2>
          {watchedFilter === 'unwatched' && sortedBottomMovies.length > 0 && (
            <button
              type="button"
              onClick={() => openBulkCollectionModal(PAST_QUEUE_MODAL_ID)}
              className="mpx-btn mpx-btn-s mpx-btn-xs text-violet-300"
            >
              <CheckSquare size={12} /> <span>Toplu Seç & Eskiden İzlenenlere Ekle</span>
            </button>
          )}
        </div>
        {sortedBottomMovies.length === 0 ? (
          <div className="mpx-empty">
            <Projector size={40} className="opacity-40" />
            <p className="text-sm">
              {watchedFilter === 'graveyard'
                ? 'Mezarlıkta yarım bırakılan film yok.'
                : watchedFilter === 'past'
                ? 'Daha önce izlenen bağımsız film yok.'
                : watchedFilter === 'watched'
                ? 'İzlenen bağımsız film yok.'
                : watchedFilter === 'unwatched'
                ? 'İzlenecek bağımsız film kalmadı.'
                : 'Aramaya uygun film bulunamadı.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5" data-tutorial="movies-list">
            {sortedBottomMovies.map((m) => {
              const colName = m.collectionId
                ? libCollections.find((c) => c.id === m.collectionId)?.name
                : undefined;
              return (
                <MovieRow
                  key={m.id}
                  movie={m}
                  isHighlighted={highlightedMovieId === m.id}
                  nowMs={nowMs}
                  anotherTimerActive={Boolean(activeTimerMovie && activeTimerMovie.id !== m.id)}
                  isPlanned={plannedMovieIds.has(m.id)}
                  collectionName={colName}
                  onDelete={(movie) => setDeleteTarget(movie)}
                  onRate={handleRequestRate}
                  onStartWatch={startWatchingMovie}
                  onTogglePause={togglePauseWatchingMovie}
                  onCancelWatch={cancelWatchingMovie}
                  onUnwatch={(id) => setUnwatchTarget(libMovies.find((m) => m.id === id) ?? null)}
                  onEdit={(movie) => setEditTarget(movie)}
                  onAssignCollection={(movie) => setCollectionTargetMovie(movie)}
                  onSelectDetail={(movie) => setDetailMovieId(movie.id)}
                  onSendToFriend={openSendModal}
                  onPastQueue={(movie) => setMoviePastQueue(movie.id, true)}
                  altWatchTemplate={altWatchTemplate}
                  externalActions={externalActions}
                  onAbandon={(movie) => setAbandonTarget(movie)}
                  onRevive={(movie) => setReviveTarget(movie)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* TEKİL FİLM KOLEKSİYON ATAMA MODALI */}
      {collectionTargetMovie && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-fade-in" onClick={() => setCollectionTargetMovie(null)}>
          <div onClick={(e) => e.stopPropagation()} className="mpx-modal relative w-full max-w-md h-[100dvh] sm:h-auto max-h-none sm:max-h-[85dvh] rounded-none sm:rounded-[26px] shadow-2xl overflow-hidden flex flex-col [padding-top:env(safe-area-inset-top)] [padding-bottom:env(safe-area-inset-bottom)] sm:!pt-0 sm:!pb-0">
            <button
              onClick={() => setCollectionTargetMovie(null)}
              className="sm:hidden fixed top-3 right-3 sm:top-3 sm:right-3 z-20 w-10 h-10 rounded-full bg-ink-900/90 border border-ink-700 text-ink-300 hover:text-white flex items-center justify-center backdrop-blur-md"
              aria-label="Kapat"
            >
              <X size={18} />
            </button>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4">
              <div className="border-b border-ink-800 pb-3 pr-12">
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold uppercase tracking-tight text-white flex items-center gap-2">
                    <FolderPlus size={16} className="text-gold-400 flex-shrink-0" />
                    <span className="truncate">Koleksiyona Ata</span>
                  </h3>
                  <p className="mpx-mono font-semibold text-[11px] text-ink-400 truncate mt-0.5">{collectionTargetMovie.title}</p>
                </div>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                <button
                  type="button"
                  onClick={() => handleAssignCollection(collectionTargetMovie, null)}
                  className={`mpx-chip w-full !justify-between ${!collectionTargetMovie.collectionId ? 'on' : ''}`}
                >
                  <span>Bağımsız (Koleksiyon Yok)</span>
                  {!collectionTargetMovie.collectionId && <Check size={14} />}
                </button>
                {regularCollectionsList.map((col) => {
                  const isCurrent = collectionTargetMovie.collectionId === col.id;
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => handleAssignCollection(collectionTargetMovie, col.id)}
                      className={`mpx-chip w-full !justify-between ${isCurrent ? 'on' : ''}`}
                    >
                      <span className="truncate">{col.name}</span>
                      {isCurrent && <Check size={14} />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-ink-800 space-y-2">
                <label className="mpx-mono block text-[10px] font-bold text-ink-400 tracking-wider">Yeni Koleksiyon Oluştur & Ata</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Koleksiyon adı..."
                    className="mpx-input flex-1"
                  />
                  <button
                    type="button"
                    disabled={!newCollectionName.trim()}
                    onClick={handleCreateAndAssignCollection}
                    className="mpx-btn mpx-btn-p mpx-btn-xs"
                  >
                    Ekle
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ARKADAŞA TAVSİYE MODALI (ORTAK BİLEŞEN — TEK KAYNAK) */}
      <SendRecommendationModal
        open={showSendModal}
        onClose={() => setShowSendModal(false)}
        mode="movie"
        initialTitle={sendInitial.title}
        initialSelectedIds={sendInitial.selectedIds}
      />

      {/* TOPLU KOLEKSİYONA EKLEME MODALI */}
      {addMoviesToCollectionId && (() => {
        const isTargetPast = addMoviesToCollectionId === PAST_QUEUE_MODAL_ID;
        const targetColName = isTargetPast
          ? 'Eskiden İzlenenler'
          : libCollections.find((c) => c.id === addMoviesToCollectionId)?.name || 'Koleksiyon';
        const allVisibleSelected =
          modalSelectableMovies.length > 0 &&
          modalSelectableMovies.every((m) => bulkSelectedMovieIds.has(m.id));

        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-3 md:p-4 animate-fade-in" onClick={() => setAddMoviesToCollectionId(null)}>
            <div onClick={(e) => e.stopPropagation()} className="mpx-modal relative w-full max-w-4xl h-[100dvh] sm:h-auto max-h-none sm:max-h-[88svh] rounded-none sm:rounded-[26px] flex flex-col overflow-hidden animate-fade-in-up [padding-top:env(safe-area-inset-top)] [padding-bottom:env(safe-area-inset-bottom)] sm:!pt-0 sm:!pb-0">
              <button
                onClick={() => setAddMoviesToCollectionId(null)}
                className="sm:hidden fixed top-3 right-3 z-20 w-10 h-10 rounded-full bg-ink-900/90 border border-ink-700 text-ink-300 flex items-center justify-center backdrop-blur-md"
                aria-label="Kapat"
              >
                <X size={18} />
              </button>

              <div className="flex flex-1 min-h-0 flex-col">
                <div className="mpx-modal-bar p-3.5 pr-14 sm:p-4 sm:pr-4 flex items-center justify-between shrink-0">
                  <div className="min-w-0 pr-2">
                    <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-tight text-white flex items-center gap-2">
                      {isTargetPast ? <History size={16} className="text-violet-400 flex-shrink-0" /> : <Boxes size={16} className="text-gold-400 flex-shrink-0" />}
                      <span className="truncate">{targetColName} İçin Çoklu Seç</span>
                    </h3>
                    <p className="text-[11px] text-ink-400 mt-0.5">
                      {isTargetPast
                        ? 'Seçtiğin filmler kendi koleksiyonlarından silinmeden Eskiden İzlenenler sırasına eklenir'
                        : 'Üstten koleksiyon veya alttan istediğin filmleri topluca seç'}
                    </p>
                  </div>
                  <button onClick={() => setAddMoviesToCollectionId(null)} className="mpx-ibtn shrink-0 hidden sm:inline-flex"><X size={18} /></button>
                </div>

              {modalOtherCollections.length > 0 && (
                <div className="p-3 border-b border-ink-800 bg-ink-950/60 space-y-1.5 shrink-0">
                  <div className="mpx-mono text-[10px] font-black tracking-wider text-gold-400 flex items-center gap-1">
                    <Boxes size={12} /> Koleksiyon Olarak Toplu Seç ({modalOtherCollections.length})
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
                    {modalOtherCollections.map((col) => {
                      const colMovies = (collectionMap.get(col.id) || []).filter((m) => (isTargetPast ? !m.watched : true));
                      const isAllColSelected = colMovies.length > 0 && colMovies.every((m) => bulkSelectedMovieIds.has(m.id));
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => toggleSelectWholeCollectionInModal(col.id, col.name)}
                          className={`mpx-chip ${isAllColSelected ? 'on' : ''}`}
                        >
                          {isAllColSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                          <span>{col.name}</span>
                          <span className="mpx-count !py-0">
                            {colMovies.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="p-3 border-b border-ink-800 bg-ink-950/40 flex items-center gap-2 shrink-0">
                <div className="relative flex-1 mpx-search-field">
                  <Search size={14} className="mpx-search-ico absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 z-10" />
                  <input
                    type="text"
                    value={collectionSearch}
                    onChange={(e) => setCollectionSearch(e.target.value)}
                    placeholder="Listendeki filmlerde ara..."
                    className="mpx-input has-icon mpx-search"
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
                    className="mpx-btn mpx-btn-s mpx-btn-xs"
                  >
                    {allVisibleSelected ? <CheckSquare size={13} className={isTargetPast ? 'text-violet-400' : 'text-gold-400'} /> : <Square size={13} />}
                    <span>{allVisibleSelected ? 'Kaldır' : 'Tümü'}</span>
                  </button>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 custom-scrollbar bg-ink-950">
                {modalSelectableMovies.length === 0 ? (
                  <div className="text-center py-8 text-xs text-ink-500">
                    Aramaya uygun izlenmemiş film bulunamadı.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {modalSelectableMovies.map((m) => {
                      const isSelected = bulkSelectedMovieIds.has(m.id);
                      const otherColName =
                        m.collectionId && m.collectionId !== addMoviesToCollectionId
                          ? libCollections.find((c) => c.id === m.collectionId)?.name
                          : null;
                      return (
                        <div
                          key={m.id}
                          onClick={() => toggleBulkMovieSelection(m.id)}
                          className={`mpx-poster aspect-[2/3] cursor-pointer group ${isSelected ? 'is-sel' : ''}`}
                        >
                          {m.posterUrl ? (
                            <img loading="lazy" decoding="async" src={m.posterUrl} alt={m.title} className="w-full h-full object-cover"  onError={handleImgFallback}/>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-ink-700">
                              <ImageIcon size={24} />
                            </div>
                          )}
                          <i className="mpx-corner" />

                          <div className="absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent p-2 pt-6">
                            <h3 className="text-[9px] font-bold text-white line-clamp-2 leading-tight">{m.title}</h3>
                            <div className="text-[8px] text-ink-400 mt-0.5 truncate">
                              {m.year || 'Yıl yok'} {otherColName ? `· ${otherColName}` : ''}
                            </div>
                          </div>

                          <div className={`absolute inset-0 z-[2] bg-violet-500/20 backdrop-blur-[1px] flex items-center justify-center transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
                            <div className={`w-8 h-8 rounded-full ${isTargetPast ? 'bg-violet-500 text-white' : 'bg-gold-500 text-ink-950'} flex items-center justify-center shadow-lg`}>
                              <Check size={18} strokeWidth={4} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-ink-800 bg-ink-950/80 flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setAddMoviesToCollectionId(null)}
                  className="mpx-btn mpx-btn-g mpx-btn-xs"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkCollectionSelection}
                  className="mpx-btn mpx-btn-p flex-1 min-w-[160px]"
                >
                  Kaydet ({bulkSelectedMovieIds.size} Film)
                </button>
              </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TOPLU ESKİDEN İZLENENLERDEN TAŞI/ÇIKAR MODALI */}
      {showMoveFromPastModal && (() => {
        const allVisiblePastSelected =
          filteredPastMoviesForMove.length > 0 &&
          filteredPastMoviesForMove.every((m) => pastMoveSelectedIds.has(m.id));

        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-3 md:p-4 animate-fade-in" onClick={() => setShowMoveFromPastModal(false)}>
            <div onClick={(e) => e.stopPropagation()} className="mpx-modal relative w-full max-w-4xl h-[100dvh] sm:h-auto max-h-none sm:max-h-[88svh] rounded-none sm:rounded-[26px] flex flex-col overflow-hidden animate-fade-in-up [padding-top:env(safe-area-inset-top)] [padding-bottom:env(safe-area-inset-bottom)] sm:!pt-0 sm:!pb-0">
              <button
                onClick={() => setShowMoveFromPastModal(false)}
                className="sm:hidden fixed top-3 right-3 z-20 w-10 h-10 rounded-full bg-ink-900/90 border border-ink-700 text-ink-300 flex items-center justify-center backdrop-blur-md"
                aria-label="Kapat"
              >
                <X size={18} />
              </button>

              <div className="flex flex-1 min-h-0 flex-col">
                <div className="mpx-modal-bar p-3.5 pr-14 sm:p-4 sm:pr-4 flex items-center justify-between shrink-0">
                  <div className="min-w-0 pr-2">
                    <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-tight text-white flex items-center gap-2">
                      <ArrowRightLeft size={16} className="text-amber-400 flex-shrink-0" />
                      <span className="truncate">Eskiden İzlenenler'den Toplu Taşı / Çıkar</span>
                    </h3>
                    <p className="text-[11px] text-ink-400 mt-0.5">
                      Seçtiğin filmleri sıradan çıkarabilir veya başka bir koleksiyona aktarabilirsin
                    </p>
                  </div>
                  <button onClick={() => setShowMoveFromPastModal(false)} className="mpx-ibtn shrink-0 hidden sm:inline-flex"><X size={18} /></button>
                </div>

              <div className="p-3 border-b border-ink-800 bg-ink-950/40 flex items-center gap-2 shrink-0">
                <div className="relative flex-1 mpx-search-field">
                  <Search size={14} className="mpx-search-ico absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 z-10" />
                  <input
                    type="text"
                    value={pastMoveSearch}
                    onChange={(e) => setPastMoveSearch(e.target.value)}
                    placeholder="Filmlerde ara..."
                    className="mpx-input has-icon mpx-search"
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
                    className="mpx-btn mpx-btn-s mpx-btn-xs"
                  >
                    {allVisiblePastSelected ? <CheckSquare size={13} className="text-amber-400" /> : <Square size={13} />}
                    <span>{allVisiblePastSelected ? 'Kaldır' : 'Tümü'}</span>
                  </button>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 custom-scrollbar bg-ink-950">
                {filteredPastMoviesForMove.length === 0 ? (
                  <div className="text-center py-8 text-xs text-ink-500">
                    Aramaya uygun film bulunamadı.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {filteredPastMoviesForMove.map((m) => {
                      const isSelected = pastMoveSelectedIds.has(m.id);
                      const origColName = m.collectionId
                        ? libCollections.find((c) => c.id === m.collectionId)?.name
                        : null;
                      return (
                        <div
                          key={m.id}
                          onClick={() => togglePastMoveMovie(m.id)}
                          className={`mpx-poster aspect-[2/3] cursor-pointer group ${isSelected ? 'is-sel' : ''}`}
                        >
                          {m.posterUrl ? (
                            <img loading="lazy" decoding="async" src={m.posterUrl} alt={m.title} className="w-full h-full object-cover"  onError={handleImgFallback}/>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-ink-700">
                              <ImageIcon size={24} />
                            </div>
                          )}
                          <i className="mpx-corner" />

                          <div className="absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent p-2 pt-6">
                            <h3 className="text-[9px] font-bold text-white line-clamp-2 leading-tight">{m.title}</h3>
                            <div className="text-[8px] text-ink-400 mt-0.5 truncate">
                              {m.year || 'Yıl yok'} {origColName ? `· ${origColName}` : '· Bağımsız'}
                            </div>
                          </div>

                          <div className={`absolute inset-0 z-[2] bg-gold-500/20 backdrop-blur-[1px] flex items-center justify-center transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
                            <div className="w-8 h-8 rounded-full bg-amber-500 text-ink-950 flex items-center justify-center shadow-lg">
                              <Check size={18} strokeWidth={4} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-ink-800 bg-ink-950/70 space-y-3 shrink-0">
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPastMoveDestinationMode('remove_queue')}
                    className={`mpx-chip !px-2 truncate ${pastMoveDestinationMode === 'remove_queue' ? 'on' : ''}`}
                  >
                    Sıradan Çıkar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPastMoveDestinationMode('existing')}
                    disabled={regularCollectionsList.length === 0}
                    className={`mpx-chip !px-2 truncate disabled:opacity-40 ${pastMoveDestinationMode === 'existing' ? 'on' : ''}`}
                  >
                    Koleksiyona
                  </button>
                  <button
                    type="button"
                    onClick={() => setPastMoveDestinationMode('new')}
                    className={`mpx-chip !px-2 truncate ${pastMoveDestinationMode === 'new' ? 'on' : ''}`}
                  >
                    Yeni Koleksiyon
                  </button>
                </div>

                {pastMoveDestinationMode === 'existing' && regularCollectionsList.length > 0 && (
                  <select
                    value={pastMoveTargetColId}
                    onChange={(e) => setPastMoveTargetColId(e.target.value)}
                    className="mpx-input"
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
                    className="mpx-input"
                  />
                )}

                <div className="flex flex-wrap items-center gap-3 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowMoveFromPastModal(false)}
                    className="mpx-btn mpx-btn-g mpx-btn-xs"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    disabled={pastMoveSelectedIds.size === 0}
                    onClick={handleExecuteMoveFromPast}
                    className="mpx-btn mpx-btn-p flex-1 min-w-[160px]"
                  >
                    Uygula ({pastMoveSelectedIds.size} Film)
                  </button>
                </div>
              </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showPick && (
        <PickModal
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
          initialIsPastWatch={Boolean(pickedMovie.isPastWatch || pickedMovie.inPastQueue)}
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
          initialIsPastWatch={Boolean(ratingTarget.isPastWatch || ratingTarget.inPastQueue)}
          onRate={(rating, note, detailedRating, reviewTags, isPastWatch) =>
            watchMovie(ratingTarget.id, rating, note, detailedRating, reviewTags, isPastWatch)
          }
          onClose={() => setRatingTarget(null)}
        />
      )}

      {editTarget && <EditMovieModal movie={editTarget} onClose={() => setEditTarget(null)} />}

      {abandonTarget && (
        <AbandonModal
          open
          media="movie"
          title={abandonTarget.title}
          runtime={abandonTarget.runtime}
          onClose={() => setAbandonTarget(null)}
          onSubmit={({ progress, reasons, note }) => {
            abandonMedia('movie', abandonTarget.id, { progress, reasons, note });
            setAbandonTarget(null);
          }}
        />
      )}

      {confirmMoveColTarget && (
        <ConfirmDialog
          title="Koleksiyondan Toplu Aktarım"
          message={`"${confirmMoveColTarget.name}" koleksiyonundaki ${confirmMoveColTarget.count} adet izlenmemiş film (kendi koleksiyonundan silinmeden) "Eskiden İzlenenler" sırasına eklenecek. Onaylıyor musun?`}
          onConfirm={executeConfirmedCollectionMove}
          onCancel={() => setConfirmMoveColTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Film Sil"
          message={`"${deleteTarget.title}" silinecek. Emin misin?`}
          onConfirm={() => { deleteMovie(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {unwatchTarget && (
        <ConfirmDialog
          title="İzlemeyi Geri Al"
          message={`"${unwatchTarget.title}" izlenmemiş olarak işaretlenecek; puanı, notu ve izleme bilgileri silinecek. Emin misin?`}
          confirmLabel="Evet, Geri Al"
          cancelLabel="Vazgeç"
          onConfirm={() => { unwatchMovie(unwatchTarget.id); setUnwatchTarget(null); }}
          onCancel={() => setUnwatchTarget(null)}
        />
      )}

      {reviveTarget && (
        <ConfirmDialog
          title="Operasyonu Geri Al"
          message={`"${reviveTarget.title}" için otopsi kaydı silinecek; izleme durumuna dokunulmaz. Devam edilsin mi?`}
          confirmLabel="Evet, Geri Al"
          cancelLabel="Vazgeç"
          onConfirm={() => { reviveMedia('movie', reviveTarget.id); setReviveTarget(null); }}
          onCancel={() => setReviveTarget(null)}
        />
      )}

      {detailMovie && <MediaDetailModal target={{ type: 'movie', data: detailMovie }} onClose={() => setDetailMovieId(null)} />}
    </div>
  );
}

function MovieRow({
  movie, isHighlighted, nowMs, anotherTimerActive, isPlanned, collectionName, onDelete, onRate, onStartWatch, onTogglePause, onCancelWatch, onUnwatch, onEdit, onAssignCollection, onSelectDetail, onSendToFriend, onPastQueue, altWatchTemplate, externalActions, onAbandon, onRevive,
}: {
  movie: Movie;
  isHighlighted?: boolean;
  nowMs: number;
  anotherTimerActive: boolean;
  isPlanned?: boolean;
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
  onSendToFriend: (movie: Movie) => void;
  onPastQueue: (movie: Movie) => void;
  altWatchTemplate?: string;
  externalActions?: ExternalActionTemplate[];
  onAbandon: (movie: Movie) => void;
  onRevive: (movie: Movie) => void;
}) {
  // Kart içi ⋯ menüleri (izleme köprüleri + araçlar) — mobilde kompakt kart
  const [openMenu, setOpenMenu] = useState<'watch' | 'actions' | null>(null);
  // Sayfanın en altındaki kartlarda menü ekran dışına taşmasın diye yukarı açılır.
  const [menuPlacement, setMenuPlacement] = useState<'down' | 'up'>('down');

  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-row-menu]')) return;
      setOpenMenu(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [openMenu]);

  const watchLinks: { href: string; text: string; logo: string | null; icon: any; primary?: boolean; platform?: string }[] = [];

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
      watchLinks.push({ href: finalHref, text: provider.providerName, logo: provider.logoUrl, icon: PlayCircle, platform: provider.providerName });
    });
  }

  const searchQuery = encodeURIComponent(`${movie.title} ${movie.year || ''} izle`);
  watchLinks.push({ href: `https://www.google.com/search?q=${searchQuery}`, text: "Google'da Bul", logo: null, icon: Search });

  // Hızlı Aksiyon Köprüsü — varsa (isPrimary + resolve edilebilir + kapsam uygun)
  // ilk harici şablon, kartta birincil buton olarak dışarı açılır.
  const primaryAction = (externalActions || []).find(
    (t) =>
      t.isPrimary &&
      (t.targetScope === 'all' || t.targetScope === 'movie') &&
      resolveActionUrl(t.urlTemplate, movie) !== null
  );
  if (primaryAction) {
    const primaryHref = resolveActionUrl(primaryAction.urlTemplate, movie);
    if (primaryHref) {
      watchLinks.unshift({
        href: primaryHref,
        text: normalizeActionLabel(primaryAction.label),
        logo: null,
        icon: BRIDGE_ICONS[primaryAction.icon] || ExternalLink,
        primary: true,
      });
    }
  }

  // Köprü, eski tekli alternatif şablonun kendisiyle aynıysa ikisi birden görünmesin.
  const skipLegacyAlt = Boolean(
    primaryAction && altWatchTemplate && primaryAction.urlTemplate === rewriteLegacyTemplate(altWatchTemplate)
  );

  if (altWatchTemplate && !skipLegacyAlt && (movie.imdbId || altWatchTemplate.includes('{slug}') || altWatchTemplate.includes('{title}'))) {
    const charMap: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
    const slug = movie.title.toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, (match) => charMap[match]).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const finalAltHref = altWatchTemplate.replace('{imdb}', movie.imdbId || '').replace('{slug}', slug).replace('{title}', encodeURIComponent(movie.title)).replace('{year}', movie.year || '');
    watchLinks.push({ href: finalAltHref, text: 'İzle', logo: null, icon: PlayCircle });
  }

  const timerInfo = !movie.watched && movie.startedAt ? getMovieTimerInfo(movie, nowMs) : null;

  return (
    <div
      id={`movie-row-${movie.id}`}
      className={`mpx-row group flex flex-row items-center gap-2 md:gap-4 mb-1.5 md:mb-2 p-1.5 sm:p-3 ${isHighlighted ? 'is-hl' : ''} ${openMenu ? 'z-[70]' : ''}`}
    >
      <div className="flex gap-2.5 sm:gap-3.5 flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onSelectDetail(movie)}
          title="Sinema Kartını & Detayları Gör"
          className="mpx-poster mpx-poster-sm w-12 sm:w-16 flex-shrink-0 aspect-[2/3] flex items-center justify-center group/poster cursor-pointer focus:outline-none self-start md:self-center"
        >
          {movie.posterUrl ? (
            <img loading="lazy" decoding="async" src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300"  onError={handleImgFallback}/>
          ) : (
            <ImageIcon size={16} className="text-ink-600" />
          )}
          <i className="mpx-corner" />
          <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/poster:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1 z-[2]">
            <div className="w-6 h-6 rounded-full bg-gold-500/90 text-ink-950 flex items-center justify-center shadow-md">
              <Eye size={12} />
            </div>
          </div>
        </button>

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 py-0.5">
          <div className="flex flex-wrap items-center gap-1 mb-0.5 md:mb-0.5">
            <button
              type="button"
              onClick={() => onSelectDetail(movie)}
              className={`max-w-full font-bold text-[12.5px] sm:text-sm truncate text-left hover:text-gold-400 transition-colors ${movie.watched ? 'text-ink-500 line-through' : 'text-ink-100'}`}
              title="Sinema Kartını Gör"
            >
              {movie.title}
            </button>
            {movie.watched && movie.isPastWatch && (
              <span className="mpx-tag is-past">
                <History size={9} /> Önceden
              </span>
            )}
            {!movie.watched && movie.inPastQueue && (
              <span className="mpx-tag is-past">
                <History size={9} /> Eskiden Sırada
              </span>
            )}
            {movie.abandoned && (
              <span className="mpx-tag is-dnf" title="Sinematik Otopsi: yarım bırakıldı">
                🪦 Otopsi
              </span>
            )}
            {collectionName && (
              <button
                type="button"
                onClick={() => onAssignCollection(movie)}
                title="Koleksiyonu Değiştir"
                className="mpx-tag is-accent max-w-[120px] sm:max-w-none"
              >
                <Boxes size={9} className="flex-shrink-0" /> <span className="truncate">{collectionName}</span>
              </button>
            )}
          </div>

          <div className="mpx-mono font-semibold flex items-center gap-1.5 flex-wrap text-[9.5px] sm:text-[11px] text-ink-400 mb-1 md:mb-1">
            {movie.year && <span className="flex items-center gap-1"><Calendar size={10} /> {movie.year}</span>}
            {movie.runtime && <span className="flex items-center gap-1"><Clock size={10} /> {movie.runtime} dk</span>}
            {movie.watched && !movie.isPastWatch && movie.actualRuntime && movie.runtime && movie.actualRuntime < movie.runtime && (
              <span className="flex items-center gap-0.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1 rounded font-bold text-[9px]">
                <Zap size={9} /> {movie.actualRuntime} dk
              </span>
            )}
            {movie.genres.length > 0 && <span className="hidden sm:inline px-0.5 opacity-40">•</span>}
            {movie.genres.length > 0 && <span className="hidden sm:inline">{movie.genres.join(', ')}</span>}
          </div>

          {/* izleme köprüleri — birincil + ilk alternatif satır içinde, kalanı ⋯ menüsünde */}
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap mt-0.5">
            {movie.watched && movie.rating !== null && (
              <div className="flex items-center gap-1 mr-0.5 sm:mr-1">
                <span className={`mpx-rate ${ratingBgClass(movie.rating)}`}>{movie.rating}</span>
                {!movie.isPastWatch && movie.watchedAt && (
                  <span className="mpx-mono font-semibold text-[9.5px] text-ink-500 hidden sm:inline">{formatDateShort(movie.watchedAt)}</span>
                )}
              </div>
            )}

            {(() => {
              const primaryLink = watchLinks.find((link) => link.primary) || null;
              const secondaryLinks = watchLinks.filter((link) => link !== primaryLink);
              // "İzle" her kartta en solda görünmeli; varsa birincil köprü onu takip eder.
              const izleLink = watchLinks.find((link) => link.text === 'İzle') || null;
              // Mobilde kartı kompakt tutmak için yalnızca bir köprü satır içinde kalır,
              // gerisi "⋯" menüsüne taşınır.
              const inlineLinks = izleLink
                ? [izleLink, ...(primaryLink && primaryLink !== izleLink ? [primaryLink] : [])]
                : primaryLink ? [primaryLink] : secondaryLinks.slice(0, 1);
              const overflowLinks = watchLinks.filter((link) => !inlineLinks.includes(link));

              return (
                <>
                  {inlineLinks.map((link, idx) => {
                    const Icon = link.icon;
                    const isPrimary = Boolean(link.primary);
                    return (
                      <a
                        key={`inline-${idx}`}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isPrimary && link.platform && openPlatform(link.platform, movie.title)) {
                            e.preventDefault();
                          }
                        }}
                        title={
                          isPrimary
                            ? `${link.text} — yeni sekmede açılır`
                            : link.platform
                              ? `${link.platform} uygulamasında aç`
                              : undefined
                        }
                        className={`mpx-link ${isPrimary ? 'mpx-link-p' : ''} ${/alternatif/i.test(link.text) ? 'mpx-link-alt' : ''}`}
                      >
                        {link.logo ? (
                          <img loading="lazy" decoding="async" src={link.logo} alt="Platform" className="w-2.5 h-2.5 rounded-[2px] object-cover" onError={handleImgFallback} />
                        ) : (
                          <Icon size={10} />
                        )}
                        <span
                          className="max-w-[7.5rem] truncate"
                          style={/alternatif/i.test(link.text) ? { textTransform: 'lowercase' } : undefined}
                        >
                          {link.text}
                        </span>
                      </a>
                    );
                  })}

                  <div className={`relative flex-shrink-0 ${overflowLinks.length > 0 ? '' : 'md:hidden'}`} data-row-menu>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const spaceBelow = window.innerHeight - rect.bottom - 72;
                          setMenuPlacement(spaceBelow < 340 ? 'up' : 'down');
                          setOpenMenu((prev) => (prev === 'watch' ? null : 'watch'));
                        }}
                        aria-expanded={openMenu === 'watch'}
                        aria-label="Diğer izleme bağlantıları ve film işlemleri"
                        title="Diğer izleme bağlantıları"
                        className="mpx-link"
                      >
                        <MoreHorizontal size={12} />
                      </button>
                      {openMenu === 'watch' && (
                        <div
                          className={`absolute left-0 z-[80] flex max-h-[min(65vh,20rem)] w-44 flex-col gap-1 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-ink-950/95 p-1.5 shadow-2xl backdrop-blur-md ${
                            menuPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                          }`}
                        >
                          {overflowLinks.map((link, idx) => {
                            const Icon = link.icon;
                            return (
                              <a
                                key={`more-${idx}`}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (link.platform && openPlatform(link.platform, movie.title)) e.preventDefault();
                                  setOpenMenu(null);
                                }}
                                title={link.platform ? `${link.platform} uygulamasında aç` : undefined}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold text-ink-200 transition hover:bg-white/10 hover:text-white"
                              >
                                {link.logo ? (
                                  <img loading="lazy" decoding="async" src={link.logo} alt="Platform" className="h-3 w-3 flex-shrink-0 rounded-[2px] object-cover" onError={handleImgFallback} />
                                ) : (
                                  <Icon size={11} className="flex-shrink-0" />
                                )}
                                <span className="truncate">{link.text}</span>
                              </a>
                            );
                          })}

                          {!movie.watched && !movie.inPastQueue && (
                            <>
                              <div className="my-0.5 h-px bg-white/10" />
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  onPastQueue(movie);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold text-violet-200 transition hover:bg-white/10 hover:text-white"
                              >
                                <History size={12} className="flex-shrink-0" /> Önceden İzlenenler'e Ekle
                              </button>
                            </>
                          )}

                          {/* Mobilde kart içi işlemler de aynı menüde — kartı kısaltır */}
                          <div className="md:hidden flex flex-col gap-1">
                            <div className="my-0.5 h-px bg-white/10" />
                            {!movie.abandoned && !movie.watched && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  onAbandon(movie);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold text-red-300 transition hover:bg-white/10 hover:text-red-200"
                              >
                                <Skull size={12} className="flex-shrink-0" /> Yarım Bırak
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenu(null);
                                onSendToFriend(movie);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold text-ink-200 transition hover:bg-white/10 hover:text-white"
                            >
                              <Send size={12} className="flex-shrink-0" /> Tavsiye Et
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenu(null);
                                onAssignCollection(movie);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold text-ink-200 transition hover:bg-white/10 hover:text-white"
                            >
                              <Boxes size={12} className="flex-shrink-0" /> Koleksiyon
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenu(null);
                                onEdit(movie);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold text-ink-200 transition hover:bg-white/10 hover:text-white"
                            >
                              <Edit2 size={12} className="flex-shrink-0" /> Düzenle
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenu(null);
                                onDelete(movie);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold text-red-300 transition hover:bg-white/10 hover:text-red-200"
                            >
                              <Trash2 size={12} className="flex-shrink-0" /> Sil
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Sağ Kısım: Aksiyon Butonları — mobilde kompakt dikey sütun */}
      <div
        data-row-menu
        className="flex flex-col md:flex-row md:items-center md:justify-end gap-1 md:gap-2 w-[5.75rem] md:w-auto flex-shrink-0 self-stretch md:self-auto justify-center"
      >
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-1 md:gap-2 w-full md:w-auto md:flex-none">
          {movie.abandoned ? (
            <button
              onClick={() => onRevive(movie)}
              title="Operasyonu Geri Al — otopsi kaydı silinir, izleme durumuna dokunulmaz"
              className="mpx-btn mpx-btn-s mpx-btn-xs w-full md:w-auto"
            >
              <RotateCcw size={11} /> Operasyonu Geri Al
            </button>
          ) : movie.watched ? (
            <button onClick={() => onUnwatch(movie.id)} className="mpx-btn mpx-btn-g mpx-btn-xs w-full md:w-auto">
              Geri Al
            </button>
          ) : movie.inPastQueue ? (
            <button
              type="button"
              onClick={() => onRate(movie)}
              className="mpx-btn mpx-btn-p mpx-btn-xs w-full md:w-auto"
            >
              <Star size={11} className="fill-current" /> Puanla
            </button>
          ) : isPlanned ? (
            <div
              title="Bu film haftalık planda. Puanlamak veya izlemek için Planlayıcı sekmesine gidin."
              className="mpx-btn mpx-btn-g mpx-btn-xs mpx-off w-full md:w-auto text-violet-400"
            >
              <Lock size={11} /> Takvime Planlandı
            </div>
          ) : (
            <>
              {timerInfo ? (
                <div className="mpx-timerpill w-full md:w-auto text-emerald-300">
                  <Timer size={11} className={timerInfo.isPaused ? 'text-amber-400' : 'animate-pulse text-emerald-400'} />
                  <span className="tabular-nums">{timerInfo.formattedRemaining}</span>
                  <button type="button" onClick={() => onTogglePause(movie.id)} title={timerInfo.isPaused ? 'Devam Et' : 'Duraklat'} className="mpx-ibtn text-amber-300 hover:text-white">
                    {timerInfo.isPaused ? <Play size={10} className="fill-current" /> : <Pause size={10} />}
                  </button>
                  <button type="button" onClick={() => onCancelWatch(movie.id)} title="Sayacı İptal Et" className="mpx-ibtn text-ink-400 hover:text-red-400">
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onStartWatch(movie.id, false)}
                  title={anotherTimerActive ? 'Başka bir filmin sayacı açık!' : 'Geri Sayımı Başlat'}
                  disabled={anotherTimerActive}
                  className={`mpx-btn mpx-btn-xs w-full md:w-auto ${
                    anotherTimerActive
                      ? 'mpx-btn-g mpx-off'
                      : 'mpx-btn-s text-emerald-400'
                  }`}
                >
                  {anotherTimerActive ? <Lock size={10} /> : <Play size={10} className="fill-current" />} Başlat
                </button>
              )}

              <button
                onClick={() => onRate(movie)}
                title={timerInfo && !timerInfo.canRateWithTimer ? `En az ${timerInfo.minRequiredMins} dk geçmeden puanlanamaz!` : 'Filmi Puanla'}
                disabled={Boolean(timerInfo && !timerInfo.canRateWithTimer)}
                className={`mpx-btn mpx-btn-xs w-full md:w-auto ${
                  timerInfo && !timerInfo.canRateWithTimer
                    ? 'mpx-btn-g mpx-off'
                    : 'mpx-btn-p'
                }`}
              >
                {timerInfo && !timerInfo.canRateWithTimer ? <><Lock size={10} /> Puanla</> : <><Star size={11} /> Puanla</>}
              </button>
            </>
          )}
        </div>

        {/* Yardımcı araçlar — masaüstünde ikon satırı */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0 justify-end">
          {!movie.abandoned && !movie.watched && (
            <button
              onClick={() => onAbandon(movie)}
              title="Yarım Bırak (Sinematik Otopsi)"
              className="mpx-btn mpx-btn-s mpx-btn-xs text-red-400/90 hover:text-red-300"
            >
              <Skull size={11} /> Yarım Bırak
            </button>
          )}
          <button
            onClick={() => onSendToFriend(movie)}
            title="Arkadaşına Tavsiye Et"
            className="mpx-ibtn text-violet-400"
          >
            <Send size={13} />
          </button>
          <button
            onClick={() => onAssignCollection(movie)}
            title="Koleksiyona Ekle / Değiştir"
            className={`mpx-ibtn ${
              movie.collectionId || movie.inPastQueue
                ? 'is-on text-gold-400'
                : 'text-ink-500 hover:text-gold-400'
            }`}
          >
            <Boxes size={13} />
          </button>
          <button onClick={() => onEdit(movie)} title="Filmi Düzenle" className="mpx-ibtn text-ink-500 hover:text-gold-400">
            <Edit2 size={13} />
          </button>
          <button onClick={() => onDelete(movie)} title="Filmi Sil" className="mpx-ibtn text-ink-500 hover:text-red-400">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}