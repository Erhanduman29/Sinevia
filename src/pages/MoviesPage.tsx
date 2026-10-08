import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Projector, Trash2, Boxes, ChevronDown, ChevronRight, Star, Calendar, Filter,
  ArrowDownAZ, CalendarDays, Star as StarIcon, Check, Search, Edit2, Shuffle, Clock,
  CalendarPlus, Image as ImageIcon, RefreshCw, Dna, PlayCircle, ExternalLink, Eye,
  FolderPlus, X, Play, Pause, Timer, Zap, Lock, EyeOff, ChevronsUpDown, History,
  CheckSquare, Square, ArrowRightLeft, SlidersHorizontal, Send, Film
} from 'lucide-react';
import { useApp, getMovieTimerInfo, PAST_WATCH_COLLECTION_NAME } from '../context/AppContext';
import { ratingBgClass, formatDateShort, normalize, uid } from '../lib/utils';
import { searchTMDB } from '../lib/tmdb';
import { supabase } from '../lib/supabase';
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
const PAST_QUEUE_MODAL_ID = '__PAST_QUEUE__';

export default function MoviesPage() {
  const {
    data, editMovie, deleteMovie, startWatchingMovie, togglePauseWatchingMovie,
    cancelWatchingMovie, canRateMovieWithTimer, watchMovie, unwatchMovie,
    setMovieCollection, setMoviePastQueue, addCollection, showToast,
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
  const [isPastCollectionOpen, setIsPastCollectionOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [highlightedMovieId, setHighlightedMovieId] = useState<string | null>(null);

  // ARKADAŞA TAVSİYE (TEKLİ & TOPLU) MODAL STATELERİ
  const [showSendModal, setShowSendModal] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [selectedMovieIdsForSend, setSelectedMovieIdsForSend] = useState<Set<string>>(new Set());
  const [sendListTitle, setSendListTitle] = useState('');
  const [sendMovieSearch, setSendMovieSearch] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);

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
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('added');
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const activeTimerMovie = useMemo(() => data.movies.find((m) => !m.watched && m.startedAt) || null, [data.movies]);

  useEffect(() => {
    if (!activeTimerMovie) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimerMovie]);

  // PROFİLDEN VEYA AĞDAN "BU FİLME GİT" DENİLDİĞİNDE OTOMATİK FİLTRELE, KOLEKSİYONU AÇ VE KAYDIR
  useEffect(() => {
    try {
      const focusTitle = sessionStorage.getItem('sinevia_focus_media_title');
      if (!focusTitle || data.movies.length === 0) return;
      sessionStorage.removeItem('sinevia_focus_media_title');

      const targetMovie = data.movies.find(
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
  }, [data.movies]);

  const detailMovie = useMemo(
    () => (detailMovieId ? data.movies.find((m) => m.id === detailMovieId) || null : null),
    [data.movies, detailMovieId]
  );

  const handleRequestRate = (movie: Movie) => {
    if (!movie.inPastQueue && !canRateMovieWithTimer(movie.id)) return;
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
    data.movies.forEach((m) => m.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [data.movies]);

  const eligibleMovies = useMemo(() => {
    const unwatched = data.movies.filter((m) => !m.watched && !m.inPastQueue);
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
  }, [data.movies]);

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

  const sortMovies = (movies: Movie[]): Movie[] => {
    let filtered = movies;
    if (watchedFilter === 'unwatched') filtered = filtered.filter((m) => !m.watched);
    else if (watchedFilter === 'watched') filtered = filtered.filter((m) => m.watched && !m.isPastWatch);
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

  const baseBottomListMovies = useMemo(() => {
    if (watchedFilter === 'past') return data.movies.filter((m) => m.watched && m.isPastWatch);
    return data.movies.filter((m) => !m.collectionId && !m.inPastQueue && !m.isPastWatch);
  }, [data.movies, watchedFilter]);

  const collectionMovies = data.movies.filter((m) => m.collectionId);
  const collectionMap = useMemo(() => {
    const map = new Map<string, Movie[]>();
    collectionMovies.forEach((m) => {
      const arr = map.get(m.collectionId!) || []; arr.push(m); map.set(m.collectionId!, arr);
    });
    return map;
  }, [collectionMovies]);

  const allPastColUnratedMovies = useMemo(() => data.movies.filter((m) => !m.watched && m.inPastQueue).sort((a, b) => parseInt(a.year || '9999', 10) - parseInt(b.year || '9999', 10)), [data.movies]);

  const pastCollectionUnratedMovies = useMemo(() => {
    let filtered = allPastColUnratedMovies;
    if (selectedGenres.size > 0) filtered = filtered.filter((m) => Array.from(selectedGenres).every((g) => m.genres.includes(g)));
    if (search.trim() !== '') filtered = filtered.filter(searchMatches);
    return filtered;
  }, [allPastColUnratedMovies, selectedGenres, search]);

  const filteredCollections = useMemo(() => {
    return data.collections.filter((coll) => {
      if (normalize(coll.name) === normalize(PAST_WATCH_COLLECTION_NAME)) return false;
      const movies = collectionMap.get(coll.id) || [];
      const hasUnwatched = movies.some((m) => !m.watched);
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
  }, [data.collections, collectionMap, watchedFilter, selectedGenres, search]);

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
    if (colId) { const colName = data.collections.find((c) => c.id === colId)?.name || 'Koleksiyon'; showToast(`"${movie.title}" ➔ ${colName} koleksiyonuna eklendi`, 'success'); }
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
    if (colId === PAST_QUEUE_MODAL_ID) { const currentInQueue = data.movies.filter((m) => !m.watched && m.inPastQueue).map((m) => m.id); setBulkSelectedMovieIds(new Set(currentInQueue)); }
    else { const currentInCol = data.movies.filter((m) => m.collectionId === colId).map((m) => m.id); setBulkSelectedMovieIds(new Set(currentInCol)); }
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
      data.movies.forEach((m) => {
        if (m.watched) return; const shouldBeInQueue = bulkSelectedMovieIds.has(m.id); const isCurrentlyInQueue = Boolean(m.inPastQueue);
        if (shouldBeInQueue && !isCurrentlyInQueue) { setMoviePastQueue(m.id, true); addedCount++; } else if (!shouldBeInQueue && isCurrentlyInQueue) { setMoviePastQueue(m.id, false); removedCount++; }
      });
      if (addedCount > 0 || removedCount > 0) { showToast(`Eskiden İzlenenler: ${addedCount} film eklendi${removedCount > 0 ? `, ${removedCount} film çıkarıldı` : ''}`, 'success'); if (addedCount > 0) setIsPastCollectionOpen(true); }
      setAddMoviesToCollectionId(null); return;
    }

    const targetColId = addMoviesToCollectionId; const targetColName = data.collections.find((c) => c.id === targetColId)?.name || 'Koleksiyon';
    let addedCount = 0; let removedCount = 0;
    data.movies.forEach((m) => {
      const shouldBeInCol = bulkSelectedMovieIds.has(m.id); const isCurrentlyInCol = m.collectionId === targetColId;
      if (shouldBeInCol && !isCurrentlyInCol) { setMovieCollection(m.id, targetColId); addedCount++; } else if (!shouldBeInCol && isCurrentlyInCol) { setMovieCollection(m.id, null); removedCount++; }
    });
    if (addedCount > 0 || removedCount > 0) { showToast(`${targetColName}: ${addedCount} eklendi${removedCount > 0 ? `, ${removedCount} çıkarıldı` : ''}`, 'success'); }
    setAddMoviesToCollectionId(null);
  };

  const openMoveFromPastModal = () => {
    setPastMoveSearch(''); setPastMoveSelectedIds(new Set()); setPastMoveDestinationMode('remove_queue');
    const regularCols = data.collections.filter((c) => normalize(c.name) !== normalize(PAST_WATCH_COLLECTION_NAME));
    setPastMoveTargetColId(regularCols[0]?.id || ''); setPastMoveNewColName(''); setShowMoveFromPastModal(true);
  };

  const togglePastMoveMovie = (id: string) => {
    setPastMoveSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const handleExecuteMoveFromPast = () => {
    if (pastMoveSelectedIds.size === 0) return;
    if (pastMoveDestinationMode === 'remove_queue') { pastMoveSelectedIds.forEach((movieId) => { setMoviePastQueue(movieId, false); }); showToast('Seçilen filmler sıradan çıkarıldı!', 'success'); setShowMoveFromPastModal(false); setPastMoveSelectedIds(new Set()); return; }

    let finalDestColId: string | null = null; let destLabel = 'Koleksiyon';
    if (pastMoveDestinationMode === 'existing') { if (!pastMoveTargetColId) { showToast('Koleksiyon seçin!', 'warning'); return; } finalDestColId = pastMoveTargetColId; destLabel = data.collections.find((c) => c.id === pastMoveTargetColId)?.name || 'Koleksiyon'; }
    else if (pastMoveDestinationMode === 'new') { if (!pastMoveNewColName.trim()) { showToast('İsim yazın!', 'warning'); return; } finalDestColId = addCollection(pastMoveNewColName.trim()); destLabel = pastMoveNewColName.trim(); }

    pastMoveSelectedIds.forEach((movieId) => { setMoviePastQueue(movieId, false); setMovieCollection(movieId, finalDestColId); });
    showToast(`${pastMoveSelectedIds.size} film "${destLabel}" koleksiyonuna taşındı!`, 'success'); setShowMoveFromPastModal(false); setPastMoveSelectedIds(new Set());
  };

  const openSendModal = async (singleMovie?: Movie) => {
    if (!data.agentId) { showToast('Lütfen önce ayarlardan Sinevia Ağı kimliğinizi oluşturun!', 'error'); return; }

    if (singleMovie) {
      setSelectedMovieIdsForSend(new Set([singleMovie.id]));
      setSendListTitle(`Tavsiye: ${singleMovie.title}`);
    } else {
      setSelectedMovieIdsForSend(new Set());
      setSendListTitle('Özel Film Tavsiyeleri');
    }

    setSendMovieSearch('');
    setShowSendModal(true);
    setLoadingFriends(true);

    try {
      const { data: fData } = await supabase.from('friendships').select('*').or(`requester_id.eq.${data.agentId},receiver_id.eq.${data.agentId}`).eq('status', 'accepted');
      const friendIds = (fData || []).map(f => f.requester_id === data.agentId ? f.receiver_id : f.requester_id);

      if (friendIds.length > 0) {
        const { data: pData } = await supabase.from('profiles').select('*').in('agent_id', friendIds);
        setFriendsList(pData || []);
        if (pData && pData.length > 0) setSelectedFriendId(pData[0].agent_id);
      } else {
        setFriendsList([]);
      }
    } catch (err) {
      console.error(err);
      showToast('Arkadaş listesi alınamadı.', 'error');
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleSendRecommendations = async () => {
    if (!selectedFriendId) { showToast('Lütfen bir arkadaş seç!', 'error'); return; }
    if (selectedMovieIdsForSend.size === 0) { showToast('En az bir film seçmelisin!', 'warning'); return; }

    const selectedMovies = data.movies.filter(m => selectedMovieIdsForSend.has(m.id));
    const items = selectedMovies.map(m => ({
      id: m.id,
      title: m.title,
      type: 'movie',
      poster: m.posterUrl || null,
      genres: m.genres,
      year: m.year || ''
    }));

    try {
      await supabase.from('recommendations').insert([{
        id: uid(),
        sender_id: data.agentId,
        receiver_id: selectedFriendId,
        list_title: sendListTitle.trim() || 'Film Tavsiyeleri',
        items: items,
        status: 'pending'
      }]);
      showToast(`${items.length} film arkadaşına başarıyla gönderildi!`, 'success');
      setShowSendModal(false);
      setSelectedFriendId('');
      setSelectedMovieIdsForSend(new Set());
    } catch {
      showToast('Gönderilirken hata oluştu!', 'error');
    }
  };

  const toggleSelectMovieForSend = (id: string) => {
    setSelectedMovieIdsForSend(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredMoviesForModal = useMemo(() => {
    const q = sendMovieSearch.trim().toLowerCase();
    if (!q) return data.movies;
    return data.movies.filter(m => m.title.toLowerCase().includes(q));
  }, [data.movies, sendMovieSearch]);

  const sortedBottomMovies = sortMovies(baseBottomListMovies);
  const totalUnwatched = data.movies.filter((m) => !m.watched).length;
  const totalWatched = data.movies.filter((m) => m.watched && !m.isPastWatch).length;
  const totalPastWatched = data.movies.filter((m) => m.watched && m.isPastWatch).length;

  const modalSelectableMovies = useMemo(() => {
    if (!addMoviesToCollectionId) return [];
    const isTargetPastCol = addMoviesToCollectionId === PAST_QUEUE_MODAL_ID;
    return data.movies.filter((m) => {
      if (isTargetPastCol && m.watched) return false;
      if (!collectionSearch.trim()) return true;
      return m.title.toLocaleLowerCase('tr-TR').includes(collectionSearch.toLocaleLowerCase('tr-TR'));
    });
  }, [data.movies, addMoviesToCollectionId, collectionSearch]);

  const modalOtherCollections = useMemo(() => {
    if (!addMoviesToCollectionId) return [];
    const isTargetPastCol = addMoviesToCollectionId === PAST_QUEUE_MODAL_ID;
    return data.collections.filter((c) => {
      if (c.id === addMoviesToCollectionId) return false;
      if (normalize(c.name) === normalize(PAST_WATCH_COLLECTION_NAME)) return false;
      const movies = (collectionMap.get(c.id) || []).filter((m) => (isTargetPastCol ? !m.watched : true));
      return movies.length > 0;
    });
  }, [data.collections, collectionMap, addMoviesToCollectionId]);

  const filteredPastMoviesForMove = useMemo(() => {
    if (!pastMoveSearch.trim()) return allPastColUnratedMovies;
    const q = pastMoveSearch.toLocaleLowerCase('tr-TR');
    return allPastColUnratedMovies.filter((m) => m.title.toLocaleLowerCase('tr-TR').includes(q));
  }, [allPastColUnratedMovies, pastMoveSearch]);

  const regularCollectionsList = useMemo(() => data.collections.filter((c) => normalize(c.name) !== normalize(PAST_WATCH_COLLECTION_NAME)), [data.collections]);
  const plannedMovieIds = useMemo(() => { const ids = new Set<string>(); (data.weeklyPlan || []).forEach(p => ids.add(p.movieId)); return ids; }, [data.weeklyPlan]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-ink-100 flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-gold-500/20 to-gold-700/20 border border-gold-500/30 flex items-center justify-center">
              <Projector size={20} className="text-gold-300" />
            </div>
            Filmler
          </h1>

          <button
            onClick={() => setShowAdd(true)}
            className="sm:hidden flex items-center gap-1.5 bg-gradient-to-r from-gold-500 to-gold-600 text-ink-950 px-3.5 py-2 rounded-xl text-xs font-black shadow-lg shadow-gold-500/20"
          >
            <Plus size={16} strokeWidth={2.5} /> Film Ekle
          </button>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => openSendModal()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-violet-950/40 hover:bg-violet-900/60 text-violet-300 border border-violet-500/40 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-lg text-xs sm:text-sm font-bold transition-all shadow-sm"
            title="Arkadaşına tekli veya çoklu film listesi öner"
          >
            <Send size={15} className="flex-shrink-0 text-violet-400" />
            <span className="truncate">Tavsiye Et</span>
          </button>

          <button
            onClick={() => setShowDna(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-900/30 hover:bg-emerald-800/40 text-emerald-400 border border-emerald-500/30 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-sm"
          >
            <Dna size={15} className="flex-shrink-0" />
            <span className="truncate">DNA</span>
          </button>
          <button
            onClick={handleSyncTMDB}
            disabled={isSyncing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-ink-800/80 hover:bg-ink-700 text-gold-300 border border-gold-500/30 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={15} className={`flex-shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="truncate">{isSyncing ? 'Taranıyor' : 'Eksik Bul'}</span>
          </button>
          <button
            onClick={() => setShowPick(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-ink-800/80 hover:bg-ink-700 text-gold-300 border border-gold-500/30 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-sm"
          >
            <Shuffle size={15} className="flex-shrink-0" />
            <span className="truncate">Ne İzlesem</span>
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-ink-950 px-4 py-2.5 rounded-lg font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20 whitespace-nowrap"
          >
            <Plus size={18} /> Film Ekle
          </button>
        </div>
      </div>

      {activeTimerMovie && (() => {
        const info = getMovieTimerInfo(activeTimerMovie, nowMs);
        return (
          <div className="bg-gradient-to-r from-emerald-950/80 via-ink-900 to-ink-950 border border-emerald-500/40 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
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
                  <span>Kalan: <strong className="text-emerald-300 font-mono">{info.formattedRemaining}</strong></span>
                  <span>• Geçen: <strong>{info.elapsedMins}/{info.maxMins} dk</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => togglePauseWatchingMovie(activeTimerMovie.id)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-amber-300 border border-amber-500/30 text-xs font-bold"
              >
                {info.isPaused ? <><Play size={12} className="fill-current" /> Devam</> : <><Pause size={12} /> Duraklat</>}
              </button>
              <button
                type="button"
                onClick={() => handleRequestRate(activeTimerMovie)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  info.canRateWithTimer
                    ? 'bg-gold-500 hover:bg-gold-400 text-ink-950 shadow-md'
                    : 'bg-ink-800 text-ink-500 border border-ink-700 cursor-not-allowed'
                }`}
              >
                {info.canRateWithTimer ? <><Star size={12} className="fill-current" /> Bitir & Puanla</> : <><Lock size={11} /> {info.minRequiredMins - info.elapsedMins} dk</>}
              </button>
              <button
                type="button"
                onClick={() => cancelWatchingMovie(activeTimerMovie.id)}
                title="Sayacı İptal Et"
                className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex-shrink-0"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })()}

      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex overflow-x-auto hide-scrollbar bg-ink-900/80 rounded-xl p-1 border border-ink-700/60 gap-1 w-full sm:w-auto">
            <button
              onClick={() => setWatchedFilter('all')}
              className={`whitespace-nowrap px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all flex-shrink-0 ${
                watchedFilter === 'all' ? 'bg-ink-700 text-ink-100 shadow-sm' : 'text-ink-400 hover:text-ink-300'
              }`}
            >
              Tümü ({data.movies.length})
            </button>
            <button
              onClick={() => setWatchedFilter('unwatched')}
              className={`whitespace-nowrap px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all flex-shrink-0 ${
                watchedFilter === 'unwatched' ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30' : 'text-ink-400 hover:text-ink-300'
              }`}
            >
              İzlenecek ({totalUnwatched})
            </button>
            <button
              onClick={() => setWatchedFilter('watched')}
              className={`whitespace-nowrap px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all flex-shrink-0 ${
                watchedFilter === 'watched' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-ink-400 hover:text-ink-300'
              }`}
            >
              İzlenen ({totalWatched})
            </button>
            <button
              onClick={() => setWatchedFilter('past')}
              className={`whitespace-nowrap flex items-center justify-center gap-1 px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all flex-shrink-0 ${
                watchedFilter === 'past' ? 'bg-violet-500/25 text-violet-300 border border-violet-500/35' : 'text-ink-400 hover:text-violet-300'
              }`}
            >
              <History size={12} className="flex-shrink-0 hidden xs:inline" />
              <span>Önceden ({totalPastWatched})</span>
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
                title="Arama ve filtreleri sıfırla"
                className="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-bold transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {isFilterPanelOpen && (
          <div className="bg-ink-900/75 backdrop-blur-md border border-ink-700/70 rounded-2xl p-3 sm:p-4 space-y-3 shadow-xl animate-fade-in">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Film veya koleksiyon adı ara..."
                className="w-full bg-ink-950/90 border border-ink-700 rounded-xl pl-9 pr-8 py-2 text-base sm:text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 transition-all"
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

            <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
              <div className="flex items-center gap-1 text-[11px] font-bold text-ink-400 mr-1 flex-shrink-0">
                <Filter size={12} /> Sırala:
              </div>
              <button onClick={() => setSortMode('added')} className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${sortMode === 'added' ? 'bg-gold-500/20 border border-gold-500/30 text-gold-300' : 'bg-ink-950/60 border border-ink-800 text-ink-400 hover:text-ink-200'}`}>
                <CalendarPlus size={13} /> Eklenme
              </button>
              <button onClick={() => setSortMode('az')} className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${sortMode === 'az' ? 'bg-gold-500/20 border border-gold-500/30 text-gold-300' : 'bg-ink-950/60 border border-ink-800 text-ink-400 hover:text-ink-200'}`}>
                <ArrowDownAZ size={13} /> A-Z
              </button>
              <button onClick={() => setSortMode('year')} className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${sortMode === 'year' ? 'bg-gold-500/20 border border-gold-500/30 text-gold-300' : 'bg-ink-950/60 border border-ink-800 text-ink-400 hover:text-ink-200'}`}>
                <CalendarDays size={13} /> Yıl
              </button>
              <button onClick={() => setSortMode('rating')} className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${sortMode === 'rating' ? 'bg-gold-500/20 border border-gold-500/30 text-gold-300' : 'bg-ink-950/60 border border-ink-800 text-ink-400 hover:text-ink-200'}`}>
                <StarIcon size={13} /> Puan
              </button>
            </div>

            {allGenres.length > 0 && (
              <div className="flex sm:flex-wrap gap-1.5 items-center overflow-x-auto hide-scrollbar pt-1 border-t border-ink-800/70">
                <button
                  onClick={clearGenres}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                    selectedGenres.size === 0 ? 'bg-gold-500 text-ink-950' : 'bg-ink-950 text-ink-400 hover:bg-ink-800 hover:text-ink-200 border border-ink-800'
                  }`}
                >
                  Tüm Türler
                </button>
                {allGenres.map((g) => {
                  const active = selectedGenres.has(g);
                  return (
                    <button
                      key={g}
                      onClick={() => toggleGenre(g)}
                      className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                        active ? 'bg-gold-500 text-ink-950' : 'bg-ink-950 text-ink-400 hover:bg-ink-800 hover:text-ink-200 border border-ink-800'
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
        )}
      </div>

      {/* ESKİDEN İZLENENLER */}
      {watchedFilter !== 'watched' && watchedFilter !== 'past' && (
        <div className="bg-ink-900/60 backdrop-blur-sm border border-violet-500/35 rounded-2xl overflow-hidden shadow-lg shadow-ink-950/30 transition-all">
          <div className="w-full flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-ink-800/40 transition-colors gap-2 flex-wrap">
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
              <span className="text-[10px] sm:text-[11px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full flex-shrink-0">
                {pastCollectionUnratedMovies.length}
              </span>
            </button>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {allPastColUnratedMovies.length > 0 && (
                <button
                  type="button"
                  onClick={openMoveFromPastModal}
                  className="flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-white bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2 sm:px-2.5 py-1 rounded-lg transition-colors"
                  title="Buradaki filmleri seçerek sıradan çıkar veya başka bir koleksiyona topluca taşı"
                >
                  <ArrowRightLeft size={11} />
                  <span>Taşı</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => openBulkCollectionModal(PAST_QUEUE_MODAL_ID)}
                className="flex items-center gap-1 text-[11px] font-bold text-violet-300 hover:text-white bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 px-2 sm:px-2.5 py-1 rounded-lg transition-colors"
                title="Listeden çoklu film veya koleksiyon seçerek buraya ekle"
              >
                <Plus size={12} />
                <span>Film Seç</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPastCollectionOpen((prev) => !prev)}
                className="flex items-center gap-1 text-[11px] font-bold text-violet-300 hover:text-white bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 px-2.5 py-1 rounded-lg transition-all"
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
                  <div className="text-center py-8 text-xs text-ink-500">
                    Bu koleksiyonda puanlanmayı bekleyen film yok. Sağ üstteki <strong>"+ Film Seç"</strong> butonundan birden fazla filmi veya koleksiyonu buraya ekleyebilirsin.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {pastCollectionUnratedMovies.map((m) => {
                      const origColName = m.collectionId
                        ? data.collections.find((c) => c.id === m.collectionId)?.name
                        : undefined;
                      return (
                        <div key={m.id} className="relative aspect-[2/3] rounded-xl overflow-hidden group border border-ink-800 bg-ink-900 shadow-sm">
                          {m.posterUrl ? (
                            <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-ink-700">
                              <Film size={24} />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent p-2 pt-6">
                            <h3 className="text-[9px] font-bold text-white line-clamp-2 leading-tight">{m.title}</h3>
                            <div className="text-[8px] text-ink-400 mt-0.5 truncate">{m.year || 'Yıl yok'} {origColName ? `· ${origColName}` : ''}</div>
                          </div>
                          <div className="absolute inset-0 bg-ink-950/80 flex flex-col justify-center items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                            <button onClick={() => handleRequestRate(m)} className="w-full py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded text-[10px] font-bold flex items-center justify-center gap-1">
                              <Star size={10} /> Puanla
                            </button>
                            <div className="flex w-full gap-1">
                              <button onClick={() => setCollectionTargetMovie(m)} className="flex-1 py-1.5 bg-ink-800 hover:bg-gold-500/20 text-gold-400 rounded flex items-center justify-center" title="Koleksiyona Ata">
                                <Boxes size={12} />
                              </button>
                              <button onClick={() => setDetailMovieId(m.id)} className="flex-1 py-1.5 bg-ink-800 hover:bg-ink-700 text-white rounded flex items-center justify-center" title="Detaylar">
                                <Eye size={12} />
                              </button>
                            </div>
                          </div>
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
          <div className="flex items-center justify-between gap-2 bg-ink-900/50 border border-ink-800/80 px-3.5 py-2.5 rounded-xl">
            <button
              type="button"
              onClick={() => setIsCollectionsSectionOpen((prev) => !prev)}
              className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-ink-200 hover:text-gold-400 uppercase tracking-wide transition-colors min-w-0"
            >
              {isCollectionsSectionOpen ? <ChevronDown size={16} className="text-gold-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-gold-400 flex-shrink-0" />}
              <Boxes size={15} className="text-gold-400 flex-shrink-0" />
              <span className="truncate">Koleksiyonlar</span>
              <span className="text-[10px] sm:text-[11px] font-bold bg-gold-500/15 text-gold-300 border border-gold-500/30 px-2 py-0.5 rounded-full flex-shrink-0">
                {filteredCollections.length}
              </span>
            </button>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isCollectionsSectionOpen && (
                <button
                  type="button"
                  onClick={handleToggleAllCollectionsExpand}
                  className="flex items-center gap-1 text-[11px] font-semibold text-ink-300 hover:text-gold-300 bg-ink-800/80 hover:bg-ink-700 border border-ink-700/70 px-2 sm:px-2.5 py-1 rounded-lg transition-all"
                >
                  <ChevronsUpDown size={12} className="text-gold-400" />
                  <span>{allFilteredExpanded ? 'Daralt' : 'Genişlet'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsCollectionsSectionOpen((prev) => !prev)}
                className="flex items-center gap-1 text-[11px] font-bold text-gold-400 hover:text-gold-300 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/30 px-2.5 py-1 rounded-lg transition-all"
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
                    className={`bg-ink-900/60 backdrop-blur-sm border rounded-2xl overflow-hidden shadow-lg shadow-ink-950/30 transition-all ${
                      isCompletelyWatched ? 'border-green-500/30 hover:border-green-500/50' : 'border-ink-700/50 hover:border-ink-600/50'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-ink-800/40 transition-colors gap-2 flex-wrap">
                      <button type="button" onClick={() => toggleCollection(coll.id)} className="flex items-center gap-2.5 flex-1 text-left min-w-0">
                        {isExpanded ? <ChevronDown size={18} className="text-ink-500 flex-shrink-0" /> : <ChevronRight size={18} className="text-ink-500 flex-shrink-0" />}
                        <Boxes size={16} className={isCompletelyWatched ? 'text-green-400 flex-shrink-0' : 'text-gold-400 flex-shrink-0'} />
                        <span className="font-semibold text-xs sm:text-sm text-ink-100 truncate">{coll.name}</span>
                        {isCompletelyWatched && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            <Check size={10} /> <span className="hidden sm:inline">Tamamlandı</span>
                          </span>
                        )}
                      </button>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {notInPastQueueUnwatched > 0 && (
                          <button
                            type="button"
                            onClick={() => requestMoveEntireCollectionToPast(coll.id, coll.name, false)}
                            className="flex items-center gap-1 text-[11px] font-bold text-violet-300 hover:text-white bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 px-2 py-1 rounded-lg transition-colors"
                            title="Bu koleksiyondaki izlenmemiş filmleri kendi koleksiyonundan silmeden Eskiden İzlenenler sırasına ekle"
                          >
                            <History size={12} /> <span className="hidden md:inline">Eskiden İzlenenlere Aktar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openBulkCollectionModal(coll.id)}
                          className="flex items-center gap-1 text-[11px] font-bold text-gold-400 hover:text-gold-300 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/30 px-2 py-1 rounded-lg transition-colors"
                          title="Listeden bu koleksiyona çoklu film ekle"
                        >
                          <Plus size={12} /> <span className="hidden sm:inline">Film Ekle</span>
                        </button>
                        <span className="text-[11px] font-bold text-ink-400 bg-ink-800/60 px-2 py-1 rounded-full">
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
                            className="relative w-9 sm:w-11 aspect-[2/3] flex-shrink-0 rounded-md overflow-hidden border border-ink-700/60 bg-ink-900"
                            title={m.title}
                          >
                            {m.posterUrl ? (
                              <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon size={12} className="text-ink-600" />
                              </div>
                            )}
                            {m.watched && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                                <Check size={16} strokeWidth={3} className="text-green-400 drop-shadow-lg" />
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
                              onUnwatch={unwatchMovie}
                              onEdit={(movie) => setEditTarget(movie)}
                              onAssignCollection={(movie) => setCollectionTargetMovie(movie)}
                              onSelectDetail={(movie) => setDetailMovieId(movie.id)}
                              onSendToFriend={openSendModal}
                              altWatchTemplate={data.altWatchTemplate}
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
          <h2 className="text-xs sm:text-sm font-semibold text-ink-400 uppercase tracking-wide">
            {watchedFilter === 'past' ? 'Daha Önce İzlenen Filmler' : 'Bağımsız Filmler'}
          </h2>
          {watchedFilter === 'unwatched' && sortedBottomMovies.length > 0 && (
            <button
              type="button"
              onClick={() => openBulkCollectionModal(PAST_QUEUE_MODAL_ID)}
              className="flex items-center gap-1 text-[11px] font-bold text-violet-300 hover:text-white bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 px-2.5 py-1 rounded-lg transition-colors"
            >
              <CheckSquare size={12} /> <span>Toplu Seç & Eskiden İzlenenlere Ekle</span>
            </button>
          )}
        </div>
        {sortedBottomMovies.length === 0 ? (
          <div className="text-center py-12 text-ink-500">
            <Projector size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {watchedFilter === 'past'
                ? 'Daha önce izlenen bağımsız film yok.'
                : watchedFilter === 'watched'
                ? 'İzlenen bağımsız film yok.'
                : watchedFilter === 'unwatched'
                ? 'İzlenecek bağımsız film kalmadı.'
                : 'Aramaya uygun film bulunamadı.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedBottomMovies.map((m) => {
              const colName = m.collectionId
                ? data.collections.find((c) => c.id === m.collectionId)?.name
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
                  onUnwatch={unwatchMovie}
                  onEdit={(movie) => setEditTarget(movie)}
                  onAssignCollection={(movie) => setCollectionTargetMovie(movie)}
                  onSelectDetail={(movie) => setDetailMovieId(movie.id)}
                  onSendToFriend={openSendModal}
                  altWatchTemplate={data.altWatchTemplate}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* TEKİL FİLM KOLEKSİYON ATAMA MODALI */}
      {collectionTargetMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setCollectionTargetMovie(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-ink-800 pb-3">
              <div className="min-w-0 pr-2">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <FolderPlus size={16} className="text-gold-400 flex-shrink-0" />
                  <span className="truncate">Koleksiyona Ata</span>
                </h3>
                <p className="text-xs text-ink-400 truncate mt-0.5">{collectionTargetMovie.title}</p>
              </div>
              <button onClick={() => setCollectionTargetMovie(null)} className="text-ink-400 hover:text-white p-1 rounded-lg"><X size={17} /></button>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
              <button
                type="button"
                onClick={() => handleAssignCollection(collectionTargetMovie, null)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-between ${
                  !collectionTargetMovie.collectionId
                    ? 'bg-gold-500/20 text-gold-300 border-gold-500/40'
                    : 'bg-ink-950 hover:bg-ink-800 text-ink-300 border-ink-800'
                }`}
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
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-between ${
                      isCurrent
                        ? 'bg-gold-500/20 text-gold-300 border-gold-500/40'
                        : 'bg-ink-950 hover:bg-ink-800 text-ink-200 border-ink-800'
                    }`}
                  >
                    <span className="truncate">{col.name}</span>
                    {isCurrent && <Check size={14} />}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-ink-800 space-y-2">
              <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-wider">Yeni Koleksiyon Oluştur & Ata</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Koleksiyon adı..."
                  className="flex-1 bg-ink-950 border border-ink-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-500"
                />
                <button
                  type="button"
                  disabled={!newCollectionName.trim()}
                  onClick={handleCreateAndAssignCollection}
                  className="px-4 py-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-40 text-ink-950 rounded-xl text-xs font-black transition-colors"
                >
                  Ekle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ARKADAŞA TAVSİYE MODALI */}
      {showSendModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowSendModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl h-[85vh] bg-ink-950 border border-violet-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-ink-800 bg-ink-900/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center border border-violet-500/30"><Send size={15} /></div>
                <h2 className="text-sm font-black text-white">Arkadaşına Film Tavsiyesi Gönder</h2>
              </div>
              <button onClick={() => setShowSendModal(false)} className="text-ink-500 hover:text-white p-1 rounded-lg"><X size={17} /></button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              <div className="w-full md:w-64 p-4 border-b md:border-b-0 md:border-r border-ink-800 bg-ink-900/20 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-shrink-0">
                {loadingFriends ? (
                  <div className="text-center py-6 text-xs text-ink-500 animate-pulse">Arkadaşların yükleniyor...</div>
                ) : friendsList.length === 0 ? (
                  <div className="text-center py-8 text-xs text-ink-500 bg-ink-900/40 rounded-2xl border border-ink-800">
                    Ağında ekli arkadaşın bulunamadı.
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-1.5">1. Kime Gidecek?</label>
                      <select
                        value={selectedFriendId}
                        onChange={(e) => setSelectedFriendId(e.target.value)}
                        className="w-full bg-ink-900 border border-ink-700 rounded-xl px-3 py-2 text-xs text-white focus:border-violet-500 outline-none"
                      >
                        <option value="">-- Arkadaş Seç --</option>
                        {friendsList.map(f => (
                          <option key={f.agent_id} value={f.agent_id}>{f.nickname}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-1.5">2. Liste Başlığı</label>
                      <input
                        type="text"
                        value={sendListTitle}
                        onChange={(e) => setSendListTitle(e.target.value)}
                        placeholder="Örn: Bu Haftanın Önerileri"
                        className="w-full bg-ink-900 border border-ink-700 rounded-xl px-3 py-2 text-xs text-white focus:border-violet-500 outline-none"
                      />
                    </div>
                  </>
                )}

                <div className="pt-2 border-t border-ink-800">
                  <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-2">3. Listende Ara</label>
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                    <input
                      type="text"
                      placeholder="Film adı yaz..."
                      value={sendMovieSearch}
                      onChange={(e) => setSendMovieSearch(e.target.value)}
                      className="w-full bg-ink-950 border border-ink-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:border-violet-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden bg-ink-950 relative">
                <div className="p-3 border-b border-ink-800 flex items-center justify-between bg-ink-900/40">
                  <span className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Kütüphanen</span>
                  <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap">
                    {selectedMovieIdsForSend.size} Film Seçildi
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
                  {filteredMoviesForModal.length === 0 ? (
                    <div className="text-center py-6 text-xs text-ink-500">Film bulunamadı.</div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 p-1">
                      {filteredMoviesForModal.map(m => {
                        const isChecked = selectedMovieIdsForSend.has(m.id);
                        return (
                          <div
                            key={m.id}
                            onClick={() => toggleSelectMovieForSend(m.id)}
                            className={`relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer group border-2 transition-all ${isChecked ? 'border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.5)] scale-95' : 'border-transparent hover:border-ink-700 bg-ink-900'}`}
                          >
                            {m.posterUrl ? (
                              <img src={m.posterUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-ink-700 bg-ink-900">
                                <Film size={24} />
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent p-2 pt-6">
                              <h3 className="text-[9px] font-bold text-white line-clamp-2 leading-tight">{m.title}</h3>
                              <div className="text-[8px] text-ink-400 mt-0.5 truncate">{m.year || 'Yıl yok'}</div>
                            </div>
                            <div className={`absolute inset-0 bg-violet-500/20 backdrop-blur-[1px] flex items-center justify-center transition-opacity ${isChecked ? 'opacity-100' : 'opacity-0'}`}>
                              <div className="w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center shadow-lg">
                                <Check size={18} strokeWidth={4} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-ink-800 bg-ink-950 flex gap-2 shrink-0">
              <button onClick={() => setShowSendModal(false)} className="px-5 py-3 bg-ink-900 text-ink-300 rounded-xl text-xs font-bold hover:bg-ink-800 transition-colors">Vazgeç</button>
              <button
                onClick={handleSendRecommendations}
                disabled={!selectedFriendId || selectedMovieIdsForSend.size === 0}
                className="flex-1 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-lg shadow-violet-500/20"
              >
                <Send size={14} /> Tavsiye Listesini Gönder ({selectedMovieIdsForSend.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOPLU KOLEKSİYONA EKLEME MODALI */}
      {addMoviesToCollectionId && (() => {
        const isTargetPast = addMoviesToCollectionId === PAST_QUEUE_MODAL_ID;
        const targetColName = isTargetPast
          ? 'Eskiden İzlenenler'
          : data.collections.find((c) => c.id === addMoviesToCollectionId)?.name || 'Koleksiyon';
        const allVisibleSelected =
          modalSelectableMovies.length > 0 &&
          modalSelectableMovies.every((m) => bulkSelectedMovieIds.has(m.id));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-fade-in" onClick={() => setAddMoviesToCollectionId(null)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[88svh] animate-fade-in-up">
              <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-ink-800 shrink-0">
                <div className="min-w-0 pr-2">
                  <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                    {isTargetPast ? <History size={16} className="text-violet-400 flex-shrink-0" /> : <Boxes size={16} className="text-gold-400 flex-shrink-0" />}
                    <span className="truncate">{targetColName} İçin Çoklu Seç</span>
                  </h3>
                  <p className="text-[11px] text-ink-400 mt-0.5">
                    {isTargetPast
                      ? 'Seçtiğin filmler kendi koleksiyonlarından silinmeden Eskiden İzlenenler sırasına eklenir'
                      : 'Üstten koleksiyon veya alttan istediğin filmleri topluca seç'}
                  </p>
                </div>
                <button onClick={() => setAddMoviesToCollectionId(null)} className="text-ink-400 hover:text-white p-1.5 rounded-full hover:bg-ink-800 flex-shrink-0"><X size={18} /></button>
              </div>

              {modalOtherCollections.length > 0 && (
                <div className="p-3 border-b border-ink-800 bg-ink-950/60 space-y-1.5 shrink-0">
                  <div className="text-[10px] font-black uppercase tracking-wider text-gold-400 flex items-center gap-1">
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
                          className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            isAllColSelected
                              ? isTargetPast ? 'bg-violet-500 text-white border-violet-400 shadow-sm' : 'bg-gold-500 text-ink-950 border-gold-400 shadow-sm'
                              : 'bg-ink-900 hover:bg-ink-800 text-ink-200 border-ink-700'
                          }`}
                        >
                          {isAllColSelected ? <CheckSquare size={12} /> : <Square size={12} className="text-ink-400" />}
                          <span>{col.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isAllColSelected ? 'bg-black/25' : 'bg-ink-800 text-ink-400'}`}>
                            {colMovies.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="p-3 border-b border-ink-800 bg-ink-950/40 flex items-center gap-2 shrink-0">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input
                    type="text"
                    value={collectionSearch}
                    onChange={(e) => setCollectionSearch(e.target.value)}
                    placeholder="Listendeki filmlerde ara..."
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl pl-8 pr-3 py-2 text-base sm:text-sm text-white placeholder-ink-500 focus:outline-none focus:border-gold-500"
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
                    className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-200 border border-ink-700 text-xs font-bold whitespace-nowrap transition-colors"
                  >
                    {allVisibleSelected ? <CheckSquare size={13} className={isTargetPast ? 'text-violet-400' : 'text-gold-400'} /> : <Square size={13} />}
                    <span>{allVisibleSelected ? 'Kaldır' : 'Tümü'}</span>
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar bg-ink-950">
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
                          ? data.collections.find((c) => c.id === m.collectionId)?.name
                          : null;
                      return (
                        <div
                          key={m.id}
                          onClick={() => toggleBulkMovieSelection(m.id)}
                          className={`relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer group border-2 transition-all ${
                            isSelected
                              ? isTargetPast
                                ? 'border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.5)] scale-95'
                                : 'border-gold-500 shadow-[0_0_15px_rgba(234,179,8,0.5)] scale-95'
                              : 'border-transparent hover:border-ink-700 bg-ink-900'
                          }`}
                        >
                          {m.posterUrl ? (
                            <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-ink-700 bg-ink-900">
                              <ImageIcon size={24} />
                            </div>
                          )}

                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent p-2 pt-6">
                            <h3 className="text-[9px] font-bold text-white line-clamp-2 leading-tight">{m.title}</h3>
                            <div className="text-[8px] text-ink-400 mt-0.5 truncate">
                              {m.year || 'Yıl yok'} {otherColName ? `· ${otherColName}` : ''}
                            </div>
                          </div>

                          <div className={`absolute inset-0 ${isTargetPast ? 'bg-violet-500/20' : 'bg-gold-500/20'} backdrop-blur-[1px] flex items-center justify-center transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
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

              <div className="p-4 border-t border-ink-800 bg-ink-950/80 flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setAddMoviesToCollectionId(null)}
                  className="px-5 py-3 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-300 font-bold text-xs transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkCollectionSelection}
                  className={`flex-1 py-3 rounded-xl font-black text-xs transition-colors shadow-lg ${
                    isTargetPast
                      ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/20'
                      : 'bg-gold-500 hover:bg-gold-400 text-ink-950 shadow-gold-500/20'
                  }`}
                >
                  Kaydet ({bulkSelectedMovieIds.size} Film)
                </button>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-fade-in" onClick={() => setShowMoveFromPastModal(false)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[88svh] animate-fade-in-up">
              <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-ink-800 shrink-0">
                <div className="min-w-0 pr-2">
                  <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                    <ArrowRightLeft size={16} className="text-amber-400 flex-shrink-0" />
                    <span className="truncate">Eskiden İzlenenler'den Toplu Taşı / Çıkar</span>
                  </h3>
                  <p className="text-[11px] text-ink-400 mt-0.5">
                    Seçtiğin filmleri sıradan çıkarabilir veya başka bir koleksiyona aktarabilirsin
                  </p>
                </div>
                <button onClick={() => setShowMoveFromPastModal(false)} className="text-ink-400 hover:text-white p-1.5 rounded-full hover:bg-ink-800 flex-shrink-0"><X size={18} /></button>
              </div>

              <div className="p-3 border-b border-ink-800 bg-ink-950/40 flex items-center gap-2 shrink-0">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input
                    type="text"
                    value={pastMoveSearch}
                    onChange={(e) => setPastMoveSearch(e.target.value)}
                    placeholder="Filmlerde ara..."
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl pl-8 pr-3 py-2 text-base sm:text-sm text-white placeholder-ink-500 focus:outline-none focus:border-amber-500"
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
                    className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-200 border border-ink-700 text-xs font-bold whitespace-nowrap transition-colors"
                  >
                    {allVisiblePastSelected ? <CheckSquare size={13} className="text-amber-400" /> : <Square size={13} />}
                    <span>{allVisiblePastSelected ? 'Kaldır' : 'Tümü'}</span>
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar bg-ink-950">
                {filteredPastMoviesForMove.length === 0 ? (
                  <div className="text-center py-8 text-xs text-ink-500">
                    Aramaya uygun film bulunamadı.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {filteredPastMoviesForMove.map((m) => {
                      const isSelected = pastMoveSelectedIds.has(m.id);
                      const origColName = m.collectionId
                        ? data.collections.find((c) => c.id === m.collectionId)?.name
                        : null;
                      return (
                        <div
                          key={m.id}
                          onClick={() => togglePastMoveMovie(m.id)}
                          className={`relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer group border-2 transition-all ${
                            isSelected
                              ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-95'
                              : 'border-transparent hover:border-ink-700 bg-ink-900'
                          }`}
                        >
                          {m.posterUrl ? (
                            <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-ink-700 bg-ink-900">
                              <ImageIcon size={24} />
                            </div>
                          )}

                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent p-2 pt-6">
                            <h3 className="text-[9px] font-bold text-white line-clamp-2 leading-tight">{m.title}</h3>
                            <div className="text-[8px] text-ink-400 mt-0.5 truncate">
                              {m.year || 'Yıl yok'} {origColName ? `· ${origColName}` : '· Bağımsız'}
                            </div>
                          </div>

                          <div className={`absolute inset-0 bg-amber-500/20 backdrop-blur-[1px] flex items-center justify-center transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
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
                    className={`px-2 py-2 rounded-xl text-[11px] font-bold border text-center transition-all truncate ${
                      pastMoveDestinationMode === 'remove_queue'
                        ? 'bg-amber-500 text-ink-950 border-amber-400 shadow-sm'
                        : 'bg-ink-900 text-ink-300 border-ink-800 hover:bg-ink-800'
                    }`}
                  >
                    Sıradan Çıkar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPastMoveDestinationMode('existing')}
                    disabled={regularCollectionsList.length === 0}
                    className={`px-2 py-2 rounded-xl text-[11px] font-bold border text-center transition-all truncate disabled:opacity-40 ${
                      pastMoveDestinationMode === 'existing'
                        ? 'bg-amber-500 text-ink-950 border-amber-400 shadow-sm'
                        : 'bg-ink-900 text-ink-300 border-ink-800 hover:bg-ink-800'
                    }`}
                  >
                    Koleksiyona
                  </button>
                  <button
                    type="button"
                    onClick={() => setPastMoveDestinationMode('new')}
                    className={`px-2 py-2 rounded-xl text-[11px] font-bold border text-center transition-all truncate ${
                      pastMoveDestinationMode === 'new'
                        ? 'bg-amber-500 text-ink-950 border-amber-400 shadow-sm'
                        : 'bg-ink-900 text-ink-300 border-ink-800 hover:bg-ink-800'
                    }`}
                  >
                    Yeni Koleksiyon
                  </button>
                </div>

                {pastMoveDestinationMode === 'existing' && regularCollectionsList.length > 0 && (
                  <select
                    value={pastMoveTargetColId}
                    onChange={(e) => setPastMoveTargetColId(e.target.value)}
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl px-3 py-2 text-base sm:text-xs text-white focus:outline-none focus:border-amber-500"
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
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl px-3 py-2 text-base sm:text-xs text-white placeholder-ink-500 focus:outline-none focus:border-amber-500"
                  />
                )}

                <div className="flex items-center gap-3 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowMoveFromPastModal(false)}
                    className="px-5 py-3 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-300 font-bold text-xs transition-colors"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    disabled={pastMoveSelectedIds.size === 0}
                    onClick={handleExecuteMoveFromPast}
                    className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-ink-950 font-black text-xs transition-colors disabled:opacity-40 shadow-lg shadow-amber-500/20"
                  >
                    Uygula ({pastMoveSelectedIds.size} Film)
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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

      {detailMovie && <MediaDetailModal target={{ type: 'movie', data: detailMovie }} onClose={() => setDetailMovieId(null)} />}
    </div>
  );
}

function MovieRow({
  movie, isHighlighted, nowMs, anotherTimerActive, isPlanned, collectionName, onDelete, onRate, onStartWatch, onTogglePause, onCancelWatch, onUnwatch, onEdit, onAssignCollection, onSelectDetail, onSendToFriend, altWatchTemplate,
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
    <div
      id={`movie-row-${movie.id}`}
      className={`border rounded-xl sm:rounded-2xl p-2.5 sm:p-3 transition-all group flex flex-col md:flex-row gap-3 md:gap-4 mb-2 md:items-center ${
        isHighlighted
          ? 'bg-gold-500/10 border-gold-400 ring-2 ring-gold-400/50 shadow-[0_0_25px_rgba(250,204,21,0.25)]'
          : 'bg-ink-900/40 border-ink-800/60 hover:border-gold-500/30'
      }`}
    >
      <div className="flex gap-3 sm:gap-3.5 flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onSelectDetail(movie)}
          title="Sinema Kartını & Detayları Gör"
          className="w-14 sm:w-16 flex-shrink-0 aspect-[2/3] bg-ink-900 rounded-lg overflow-hidden flex items-center justify-center border border-ink-700/50 shadow-md relative group/poster cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold-500 self-start md:self-center"
        >
          {movie.posterUrl ? (
            <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300" />
          ) : (
            <ImageIcon size={16} className="text-ink-600" />
          )}
          <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/poster:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
            <div className="w-6 h-6 rounded-full bg-gold-500/90 text-ink-950 flex items-center justify-center shadow-md">
              <Eye size={12} />
            </div>
          </div>
        </button>

        <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
          <div className="flex flex-wrap items-center gap-1.5 mb-1 md:mb-0.5">
            <button
              type="button"
              onClick={() => onSelectDetail(movie)}
              className={`font-bold text-sm truncate text-left hover:text-gold-400 transition-colors ${movie.watched ? 'text-ink-500 line-through' : 'text-ink-100'}`}
              title="Sinema Kartını Gör"
            >
              {movie.title}
            </button>
            {movie.watched && movie.isPastWatch && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                <History size={9} /> Önceden
              </span>
            )}
            {!movie.watched && movie.inPastQueue && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                <History size={9} /> Eskiden Sırada
              </span>
            )}
            {collectionName && (
              <button
                type="button"
                onClick={() => onAssignCollection(movie)}
                title="Koleksiyonu Değiştir"
                className="text-[9px] text-gold-400 hover:text-gold-300 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 max-w-[120px] sm:max-w-none truncate transition-colors"
              >
                <Boxes size={9} className="flex-shrink-0" /> <span className="truncate">{collectionName}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-[10.5px] sm:text-[11px] text-ink-400 mb-1.5 md:mb-1">
            {movie.year && <span className="flex items-center gap-1"><Calendar size={10} /> {movie.year}</span>}
            {movie.runtime && <span className="flex items-center gap-1"><Clock size={10} /> {movie.runtime} dk</span>}
            {movie.watched && !movie.isPastWatch && movie.actualRuntime && movie.runtime && movie.actualRuntime < movie.runtime && (
              <span className="flex items-center gap-0.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1 rounded font-bold text-[9px]">
                <Zap size={9} /> {movie.actualRuntime} dk
              </span>
            )}
            {movie.genres.length > 0 && <span className="hidden sm:inline px-0.5 opacity-40">•</span>}
            {movie.genres.length > 0 && <span className="truncate max-w-[180px] sm:max-w-none">{movie.genres.join(', ')}</span>}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mt-auto">
            {movie.watched && movie.rating !== null && (
              <div className="flex items-center gap-1 mr-1">
                <span className={`text-[9.5px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm ${ratingBgClass(movie.rating)}`}>{movie.rating}</span>
                {!movie.isPastWatch && movie.watchedAt && (
                  <span className="text-[9.5px] text-ink-500 hidden sm:inline">{formatDateShort(movie.watchedAt)}</span>
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
                  className="inline-flex items-center gap-1 bg-ink-800/60 hover:bg-gold-900/40 text-gold-400/90 hover:text-gold-300 border border-gold-500/20 hover:border-gold-500/40 px-1.5 py-0.5 rounded text-[9.5px] font-semibold transition-all"
                >
                  {link.logo ? <img src={link.logo} alt="Platform" className="w-2.5 h-2.5 rounded-[2px] object-cover" /> : <Icon size={10} />}
                  <span>{link.text}</span>
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sağ Kısım: Aksiyon Butonları */}
      <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-2 w-full md:w-auto bg-ink-950/40 md:bg-transparent p-2 md:p-0 rounded-xl md:rounded-none border border-ink-800/40 md:border-0 flex-shrink-0">
        <div className="flex items-center gap-1.5 flex-1 md:flex-none">
          {movie.watched ? (
            <button onClick={() => onUnwatch(movie.id)} className="text-[11px] text-ink-400 hover:text-ink-200 bg-ink-800/50 hover:bg-ink-700 px-3 py-1.5 rounded-lg transition-colors border border-ink-700/50 font-semibold w-full md:w-auto text-center whitespace-nowrap">
              Geri Al
            </button>
          ) : movie.inPastQueue ? (
            <button
              type="button"
              onClick={() => onRate(movie)}
              className="flex items-center justify-center gap-1 text-[11px] px-4 py-1.5 rounded-lg transition-all font-bold w-full md:w-auto whitespace-nowrap bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white shadow-md shadow-violet-500/20 border border-violet-500/50"
            >
              <Star size={11} className="fill-current" /> Puanla
            </button>
          ) : isPlanned ? (
            <div
              title="Bu film haftalık planda. Puanlamak veya izlemek için Planlayıcı sekmesine gidin."
              className="flex items-center justify-center gap-1 text-[11px] px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 font-bold w-full md:w-auto whitespace-nowrap cursor-not-allowed"
            >
              <Lock size={11} /> Takvime Planlandı
            </div>
          ) : (
            <>
              {timerInfo ? (
                <div className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold w-full md:w-auto justify-center whitespace-nowrap">
                  <Timer size={11} className={timerInfo.isPaused ? 'text-amber-400' : 'animate-pulse text-emerald-400'} />
                  <span className="font-mono">{timerInfo.formattedRemaining}</span>
                  <button type="button" onClick={() => onTogglePause(movie.id)} title={timerInfo.isPaused ? 'Devam Et' : 'Duraklat'} className="ml-0.5 text-amber-300 hover:text-white">
                    {timerInfo.isPaused ? <Play size={10} className="fill-current" /> : <Pause size={10} />}
                  </button>
                  <button type="button" onClick={() => onCancelWatch(movie.id)} title="Sayacı İptal Et" className="ml-0.5 text-ink-400 hover:text-red-400">
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onStartWatch(movie.id, false)}
                  title={anotherTimerActive ? 'Başka bir filmin sayacı açık!' : 'Geri Sayımı Başlat'}
                  disabled={anotherTimerActive}
                  className={`flex items-center justify-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg transition-all font-bold border w-full md:w-auto whitespace-nowrap ${
                    anotherTimerActive
                      ? 'bg-ink-900/50 text-ink-600 border-ink-800 cursor-not-allowed'
                      : 'bg-ink-800 hover:bg-emerald-900/30 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {anotherTimerActive ? <Lock size={10} /> : <Play size={10} className="fill-current" />} Başlat
                </button>
              )}

              <button
                onClick={() => onRate(movie)}
                title={timerInfo && !timerInfo.canRateWithTimer ? `En az ${timerInfo.minRequiredMins} dk geçmeden puanlanamaz!` : 'Filmi Puanla'}
                disabled={Boolean(timerInfo && !timerInfo.canRateWithTimer)}
                className={`flex items-center justify-center gap-1 text-[11px] px-3 py-1.5 rounded-lg transition-all font-bold w-full md:w-auto whitespace-nowrap ${
                  timerInfo && !timerInfo.canRateWithTimer
                    ? 'bg-ink-800/50 text-ink-600 border border-ink-800 cursor-not-allowed'
                    : 'bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-ink-950 shadow-md shadow-gold-500/10'
                }`}
              >
                {timerInfo && !timerInfo.canRateWithTimer ? <><Lock size={10} /> Puanla</> : <><Star size={11} /> Puanla</>}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0 md:pl-2 md:border-l md:border-ink-800/60">
          <button
            onClick={() => onSendToFriend(movie)}
            title="Arkadaşına Tavsiye Et"
            className="p-1.5 rounded-lg transition-colors border text-violet-400 bg-transparent hover:bg-violet-500/10 border-transparent hover:border-violet-500/30"
          >
            <Send size={13} />
          </button>
          <button
            onClick={() => onAssignCollection(movie)}
            title="Koleksiyona Ekle / Değiştir"
            className={`p-1.5 rounded-lg transition-colors border ${
              movie.collectionId || movie.inPastQueue
                ? 'text-gold-400 bg-gold-500/10 border-gold-500/30 hover:bg-gold-500/20'
                : 'text-ink-500 hover:text-gold-400 bg-transparent hover:bg-ink-800 border-transparent hover:border-ink-700'
            }`}
          >
            <Boxes size={13} />
          </button>
          <button onClick={() => onEdit(movie)} title="Filmi Düzenle" className="text-ink-500 hover:text-gold-400 bg-transparent hover:bg-ink-800 p-1.5 rounded-lg transition-colors border border-transparent hover:border-ink-700">
            <Edit2 size={13} />
          </button>
          <button onClick={() => onDelete(movie)} title="Filmi Sil" className="text-ink-500 hover:text-red-400 bg-transparent hover:bg-ink-800 p-1.5 rounded-lg transition-colors border border-transparent hover:border-ink-700">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}