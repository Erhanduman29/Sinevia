import { useState, useEffect, useMemo } from 'react';
import {
  Search, X, Check, Film, Tv, ShoppingCart, FolderPlus, Loader2, Sparkles,
  Plus, Trash2, ChevronDown, ChevronUp, Filter, ArrowUpDown, AlertTriangle, User, CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { normalize } from '../lib/utils';

const MOVIE_GENRES = [
  { id: 28, name: 'Aksiyon' },
  { id: 12, name: 'Macera' },
  { id: 16, name: 'Animasyon' },
  { id: 35, name: 'Komedi' },
  { id: 80, name: 'Suç' },
  { id: 18, name: 'Dram' },
  { id: 14, name: 'Fantastik' },
  { id: 27, name: 'Korku' },
  { id: 878, name: 'Bilim Kurgu' },
  { id: 53, name: 'Gerilim' },
];

const TV_GENRES = [
  { id: 10759, name: 'Aksiyon & Macera' },
  { id: 16, name: 'Animasyon' },
  { id: 35, name: 'Komedi' },
  { id: 80, name: 'Suç' },
  { id: 18, name: 'Dram' },
  { id: 9648, name: 'Gizem' },
  { id: 10765, name: 'Bilim Kurgu & Fantastik' },
  { id: 10768, name: 'Savaş & Politik' },
];

type MediaType = 'movie' | 'tv';
type Step = 'browse' | 'collection' | 'importing';

interface TMDBItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  media_type?: MediaType;
  popularity?: number;
  vote_count?: number;
}

interface TMDBPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
}

export default function BulkAddModal({
  initialTab = 'movie',
  onClose,
}: {
  initialTab?: MediaType;
  onClose: () => void;
}) {
  const { data, addMovie, addSeries, addCollection, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<MediaType>(initialTab);
  const [step, setStep] = useState<Step>('browse');

  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<string>('popularity.desc');

  const [matchedPeople, setMatchedPeople] = useState<TMDBPerson[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<TMDBPerson | null>(null);

  const [results, setResults] = useState<TMDBItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [cart, setCart] = useState<TMDBItem[]>([]);
  const [isCartExpanded, setIsCartExpanded] = useState(false);

  const [collectionName, setCollectionName] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const API_KEY = import.meta.env.VITE_TMDB_API_KEY || 'a6230f08d495e326b7a89e52dc186a45';

  // Kütüphanedeki mevcut Film ve Dizileri hızlı kontrol için haritalandır
  const libraryLookup = useMemo(() => {
    const movieTmdbIds = new Map<number, boolean>();
    const movieTitles = new Map<string, boolean>();
    data.movies.forEach((m) => {
      if (m.tmdbId) movieTmdbIds.set(m.tmdbId, m.watched);
      movieTitles.set(normalize(m.title), m.watched);
    });

    const seriesTmdbIds = new Map<number, boolean>();
    const seriesTitles = new Map<string, boolean>();
    data.series.forEach((s) => {
      const allWatched = s.episodes.length > 0 && s.episodes.every((e) => e.watched);
      if (s.tmdbId) seriesTmdbIds.set(s.tmdbId, allWatched);
      seriesTitles.set(normalize(s.title), allWatched);
    });
    data.removedSeriesTitles.forEach((t) => {
      seriesTitles.set(normalize(t), true);
    });

    return { movieTmdbIds, movieTitles, seriesTmdbIds, seriesTitles };
  }, [data.movies, data.series, data.removedSeriesTitles]);

  const getExistingStatus = (item: TMDBItem): { exists: boolean; watched: boolean } => {
    const type = item.media_type || activeTab;
    const rawTitle = item.title || item.name || '';
    const normTitle = normalize(rawTitle);

    if (type === 'movie') {
      if (libraryLookup.movieTmdbIds.has(item.id)) {
        return { exists: true, watched: Boolean(libraryLookup.movieTmdbIds.get(item.id)) };
      }
      if (normTitle && libraryLookup.movieTitles.has(normTitle)) {
        return { exists: true, watched: Boolean(libraryLookup.movieTitles.get(normTitle)) };
      }
    } else {
      if (libraryLookup.seriesTmdbIds.has(item.id)) {
        return { exists: true, watched: Boolean(libraryLookup.seriesTmdbIds.get(item.id)) };
      }
      if (normTitle && libraryLookup.seriesTitles.has(normTitle)) {
        return { exists: true, watched: Boolean(libraryLookup.seriesTitles.get(normTitle)) };
      }
    }
    return { exists: false, watched: false };
  };

  useEffect(() => {
    const scrollEl = document.getElementById('main-scroll');
    if (scrollEl) scrollEl.style.overflow = 'hidden';
    document.body.classList.add('overflow-hidden');
    document.documentElement.classList.add('overflow-hidden');

    return () => {
      if (scrollEl) scrollEl.style.overflow = '';
      document.body.classList.remove('overflow-hidden');
      document.documentElement.classList.remove('overflow-hidden');
    };
  }, []);

  useEffect(() => {
    setPage(1);
    setResults([]);
    if (!query.trim()) {
      setMatchedPeople([]);
      setSelectedPerson(null);
    }
  }, [query, activeTab, selectedGenre, sortBy]);

  const fetchPersonCredits = async (personId: number, mediaType: MediaType): Promise<TMDBItem[]> => {
    try {
      const endpoint = mediaType === 'movie' ? 'movie_credits' : 'tv_credits';
      const res = await fetch(`https://api.themoviedb.org/3/person/${personId}/${endpoint}?api_key=${API_KEY}&language=tr-TR`);
      if (!res.ok) return [];
      const credits = await res.json();

      const castItems: TMDBItem[] = credits.cast || [];
      const crewItems: TMDBItem[] = (credits.crew || []).filter(
        (c: any) => c.job === 'Director' || c.department === 'Directing' || c.job === 'Creator' || c.job === 'Executive Producer' || c.job === 'Writer'
      );

      const uniqueMap = new Map<number, TMDBItem>();
      [...crewItems, ...castItems].forEach((item) => {
        if (item && item.id && item.poster_path && !uniqueMap.has(item.id)) {
          uniqueMap.set(item.id, { ...item, media_type: mediaType });
        }
      });

      return Array.from(uniqueMap.values()).sort(
        (a, b) => (b.vote_count || 0) - (a.vote_count || 0) || (b.popularity || 0) - (a.popularity || 0)
      );
    } catch {
      return [];
    }
  };

  useEffect(() => {
    const fetchTMDB = async () => {
      if (page === 1) setIsLoading(true);
      else setIsLoadingMore(true);

      try {
        if (selectedPerson) {
          const personWorks = await fetchPersonCredits(selectedPerson.id, activeTab);
          setResults(personWorks);
          setTotalPages(1);
          setIsLoading(false);
          setIsLoadingMore(false);
          return;
        }

        if (query.trim().length > 1) {
          const titleUrl = `https://api.themoviedb.org/3/search/${activeTab}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=tr-TR&page=${page}`;

          if (page === 1) {
            const personUrl = `https://api.themoviedb.org/3/search/person?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=tr-TR&page=1`;
            const [titleRes, personRes] = await Promise.all([fetch(titleUrl), fetch(personUrl)]);
            const titleJson = await titleRes.json();
            const personJson = await personRes.json();

            const peopleList: TMDBPerson[] = (personJson.results || []).slice(0, 6);
            setMatchedPeople(peopleList);

            let combinedResults: TMDBItem[] = titleJson.results || [];

            if (peopleList.length > 0) {
              const topPersonWorks = await fetchPersonCredits(peopleList[0].id, activeTab);
              const existingIds = new Set(combinedResults.map((r) => r.id));
              const extraWorks = topPersonWorks.filter((w) => !existingIds.has(w.id));

              if (combinedResults.filter((r) => r.poster_path).length < 3) {
                combinedResults = [...topPersonWorks, ...combinedResults.filter((r) => !topPersonWorks.some((w) => w.id === r.id))];
              } else {
                combinedResults = [...combinedResults, ...extraWorks];
              }
            }

            setResults(combinedResults);
            setTotalPages(titleJson.total_pages || 1);
          } else {
            const res = await fetch(titleUrl);
            const json = await res.json();
            setResults((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const incoming = (json.results || []).filter((r: TMDBItem) => !existingIds.has(r.id));
              return [...prev, ...incoming];
            });
            setTotalPages(json.total_pages || 1);
          }
        } else {
          const dateSortParam = activeTab === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
          const actualSort = sortBy === 'date.desc' ? dateSortParam : sortBy;

          let url = `https://api.themoviedb.org/3/discover/${activeTab}?api_key=${API_KEY}&language=tr-TR&sort_by=${actualSort}&page=${page}`;
          if (selectedGenre) url += `&with_genres=${selectedGenre}`;
          if (actualSort === 'vote_average.desc') url += '&vote_count.gte=200';

          const res = await fetch(url);
          const json = await res.json();

          if (page === 1) setResults(json.results || []);
          else setResults((prev) => [...prev, ...(json.results || [])]);

          setTotalPages(json.total_pages || 1);
        }
      } catch (error) {
        console.error('TMDB Hatası', error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    };

    const debounce = setTimeout(fetchTMDB, 450);
    return () => clearTimeout(debounce);
  }, [query, activeTab, selectedGenre, sortBy, page, selectedPerson]);

  const toggleCartItem = (item: TMDBItem) => {
    const status = getExistingStatus(item);
    if (status.exists) {
      showToast(`"${item.title || item.name}" zaten kütüphanende ekli!`, 'info');
      return;
    }

    const itemType = item.media_type || activeTab;
    const exists = cart.find((c) => c.id === item.id);
    if (exists) {
      const newCart = cart.filter((c) => c.id !== item.id);
      setCart(newCart);
      if (newCart.length === 0) setIsCartExpanded(false);
    } else {
      setCart([...cart, { ...item, media_type: itemType }]);
    }
  };

  const handleSafeClose = () => {
    if (cart.length > 0 && step !== 'importing') setShowCloseConfirm(true);
    else onClose();
  };

  const processWatchProviders = (detailData: any) => {
    const trProviders = detailData['watch/providers']?.results?.TR;
    if (trProviders) {
      const providersList = [...(trProviders.flatrate || []), ...(trProviders.rent || []), ...(trProviders.buy || [])];
      const uniqueProviders = Array.from(new Map(providersList.map((p) => [p.provider_id, p])).values());
      return uniqueProviders.slice(0, 3).map((p: any) => ({
        logoUrl: `https://image.tmdb.org/t/p/w200${p.logo_path}`,
        providerName: p.provider_name,
        link: trProviders.link,
      }));
    }
    return [];
  };

  const handleImport = async () => {
    setStep('importing');
    let finalColId = selectedCollectionId;

    if (collectionName.trim()) {
      finalColId = addCollection(collectionName) as unknown as string;
    }

    const preparedMovies: Parameters<typeof addMovie>[] = [];
    const preparedSeries: Parameters<typeof addSeries>[] = [];

    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      try {
        if (item.media_type === 'movie') {
          const res = await fetch(
            `https://api.themoviedb.org/3/movie/${item.id}?api_key=${API_KEY}&language=tr-TR&append_to_response=credits,keywords,watch/providers,external_ids`
          );
          const details = await res.json();

          const year = details.release_date ? details.release_date.substring(0, 4) : '';
          const genres = details.genres ? details.genres.map((g: any) => g.name) : [];
          const runtime = details.runtime || undefined;
          const posterFullUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;
          const overview = details.overview || '';
          const imdbId = details.external_ids?.imdb_id || details.imdb_id;
          const watchProviders = processWatchProviders(details);

          const directors = (details.credits?.crew || []).filter((c: any) => c.job === 'Director').map((c: any) => c.name).slice(0, 3);
          const cast = (details.credits?.cast || []).slice(0, 12).map((c: any) => c.name);
          const studios = (details.production_companies || []).slice(0, 3).map((s: any) => s.name);
          const keywords = (details.keywords?.keywords || []).map((k: any) => k.name);
          const originalLanguage = details.original_language || undefined;

          preparedMovies.push([
            details.title || item.title || '', year, genres, finalColId, runtime, posterFullUrl, overview,
            details.id, imdbId, watchProviders, { directors, cast, studios, keywords, originalLanguage },
          ]);
        } else if (item.media_type === 'tv') {
          const res = await fetch(
            `https://api.themoviedb.org/3/tv/${item.id}?api_key=${API_KEY}&language=tr-TR&append_to_response=credits,keywords,watch/providers,external_ids`
          );
          const details = await res.json();

          const year = details.first_air_date ? details.first_air_date.substring(0, 4) : '';
          const genres = details.genres ? details.genres.map((g: any) => g.name) : [];
          const seasons = (details.seasons || []).filter((s: any) => s.season_number > 0).map((s: any) => s.episode_count);
          const posterFullUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;
          const overview = details.overview || '';
          const imdbId = details.external_ids?.imdb_id;
          const watchProviders = processWatchProviders(details);

          const rawCreators = [
            ...(details.created_by || []).map((c: any) => c.name),
            ...(details.credits?.crew || []).filter((c: any) => c.job === 'Director' || c.job === 'Executive Producer').map((c: any) => c.name),
          ];
          const creators = Array.from(new Set(rawCreators)).slice(0, 3);
          const cast = (details.credits?.cast || []).slice(0, 12).map((c: any) => c.name);
          const rawStudios = [...(details.networks || []).map((n: any) => n.name), ...(details.production_companies || []).map((s: any) => s.name)];
          const studios = Array.from(new Set(rawStudios)).slice(0, 3);
          const keywords = (details.keywords?.results || []).map((k: any) => k.name);
          const originalLanguage = details.original_language || undefined;

          preparedSeries.push([
            details.name || item.name || '', genres, seasons, posterFullUrl, overview,
            details.id, year, imdbId, watchProviders, { creators, cast, studios, keywords, originalLanguage },
          ]);
        }
      } catch (error) {
        console.error(`${item.title || item.name} çekilirken hata:`, error);
      }
      setImportProgress(Math.floor(((i + 1) / cart.length) * 100));
    }

    preparedMovies.forEach((args) => addMovie(...args));
    preparedSeries.forEach((args) => addSeries(...args));

    setTimeout(() => {
      onClose();
    }, 350);
  };

  const activeGenres = activeTab === 'movie' ? MOVIE_GENRES : TV_GENRES;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-4 md:pl-56 overscroll-none" onTouchMove={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-ink-950/95 backdrop-blur-xl animate-fade-in" onClick={handleSafeClose} />

      {showCloseConfirm && (
        <div className="absolute inset-0 z-[150] flex items-center justify-center bg-ink-950/80 backdrop-blur-sm animate-fade-in px-4 md:pl-56">
          <div className="bg-ink-900 border border-ink-700 rounded-2xl p-5 md:p-6 shadow-2xl max-w-sm w-full text-center animate-fade-in-up">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <AlertTriangle className="text-red-500" size={28} />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-white mb-2">Emin misiniz?</h3>
            <p className="text-xs md:text-sm text-ink-400 mb-6">Sepetinizde seçili yapımlar var. Kapatırsanız bu seçimler silinecek.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCloseConfirm(false)} className="flex-1 py-2.5 md:py-3 rounded-xl bg-ink-800 text-white font-bold hover:bg-ink-700 border border-ink-700 transition-colors text-sm">
                Vazgeç
              </button>
              <button onClick={onClose} className="flex-1 py-2.5 md:py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold shadow-lg shadow-red-500/20 transition-colors text-sm">
                Evet, Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-6xl h-[90svh] md:h-[90vh] bg-ink-900/80 backdrop-blur-md border border-ink-700/50 rounded-2xl md:rounded-3xl shadow-2xl flex flex-col animate-fade-in-up overflow-hidden">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-ink-800/50 bg-ink-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-gold-500/20 to-gold-500/10 flex items-center justify-center border border-gold-500/20">
              <Sparkles className="text-gold-400" size={18} />
            </div>
            <div>
              <h2 className="text-base md:text-xl font-black text-white tracking-wide">Kütüphaneyi Genişlet</h2>
              <p className="text-[10px] md:text-xs text-ink-400 font-medium">Film/Dizi adı, oyuncu veya yönetmen ismiyle keşfet</p>
            </div>
          </div>
          <button onClick={handleSafeClose} className="text-ink-400 hover:text-white transition-colors bg-ink-800/50 hover:bg-ink-700 p-2 rounded-full">
            <X size={20} />
          </button>
        </div>

        {step === 'browse' && (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar relative z-0 flex flex-col bg-ink-950/30">
              <div className="p-4 md:p-6 border-b border-ink-800/50 space-y-4 shrink-0 bg-ink-900/40">
                <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                  <div className="flex bg-ink-950 rounded-xl p-1.5 border border-ink-800/50 flex-shrink-0">
                    <button
                      onClick={() => { setActiveTab('movie'); setSelectedGenre(null); setSortBy('popularity.desc'); }}
                      className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'movie' ? 'bg-ink-800 text-white shadow-sm' : 'text-ink-400 hover:text-ink-200'
                      }`}
                    >
                      <Film size={16} /> Filmler
                    </button>
                    <button
                      onClick={() => { setActiveTab('tv'); setSelectedGenre(null); setSortBy('popularity.desc'); }}
                      className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'tv' ? 'bg-ink-800 text-white shadow-sm' : 'text-ink-400 hover:text-ink-200'
                      }`}
                    >
                      <Tv size={16} /> Diziler
                    </button>
                  </div>

                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500" size={18} />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setSelectedPerson(null); }}
                      placeholder="Film/Dizi adı, oyuncu veya yönetmen ara (Örn: Christopher Nolan, Brad Pitt)..."
                      className="w-full bg-ink-950 border border-ink-800/50 rounded-xl pl-11 pr-10 py-3 text-sm font-medium text-white placeholder-ink-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/30 transition-all shadow-inner"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => { setQuery(''); setSelectedPerson(null); setMatchedPeople([]); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white p-1"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {matchedPeople.length > 0 && (
                  <div className="pt-1 space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-gold-400">
                      <span className="flex items-center gap-1.5">
                        <User size={13} /> Bulunan Oyuncu & Yönetmenler (Tüm Filmografisi İçin Tıkla)
                      </span>
                      {selectedPerson && (
                        <button type="button" onClick={() => setSelectedPerson(null)} className="text-xs text-ink-400 hover:text-white underline">
                          Kişi Filtresini Kaldır
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                      {matchedPeople.map((person) => {
                        const isSelected = selectedPerson?.id === person.id;
                        const roleLabel = person.known_for_department === 'Directing' ? 'Yönetmen' : person.known_for_department === 'Acting' ? 'Oyuncu' : 'Sinema';
                        return (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() => setSelectedPerson(isSelected ? null : person)}
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-left transition-all flex-shrink-0 ${
                              isSelected
                                ? 'bg-gold-500 text-ink-950 border-gold-400 shadow-lg scale-[1.02]'
                                : 'bg-ink-950/90 hover:bg-ink-800 text-ink-100 border-ink-800 hover:border-gold-500/40'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-ink-800 flex-shrink-0 border border-white/10 flex items-center justify-center">
                              {person.profile_path ? (
                                <img src={`https://image.tmdb.org/t/p/w200${person.profile_path}`} alt={person.name} className="w-full h-full object-cover" />
                              ) : (
                                <User size={14} className={isSelected ? 'text-ink-950' : 'text-ink-400'} />
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-black leading-tight">{person.name}</div>
                              <div className={`text-[10px] font-bold ${isSelected ? 'text-ink-900' : 'text-gold-400'}`}>{roleLabel}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!query && (
                  <div className="pt-1 md:pt-2 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-[10px] md:text-xs font-black text-ink-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Filter size={14} /> Kategoriye Göre Keşfet
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <ArrowUpDown size={14} className="text-ink-500 hidden sm:block" />
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="w-full sm:w-auto bg-ink-900 border border-ink-700 text-gold-400 text-xs font-bold rounded-lg px-3 py-2.5 focus:outline-none focus:border-gold-500/50 cursor-pointer shadow-inner hover:bg-ink-800 transition-colors"
                        >
                          <option value="popularity.desc">🔥 En Popüler</option>
                          <option value="vote_average.desc">⭐ En Yüksek Puanlılar</option>
                          <option value="date.desc">🆕 En Yeniler</option>
                          {activeTab === 'movie' && <option value="revenue.desc">💰 En Çok Hasılat Yapanlar</option>}
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0 overscroll-contain">
                      {activeGenres.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setSelectedGenre(selectedGenre === g.id ? null : g.id)}
                          className={`flex-shrink-0 px-3 md:px-4 py-2 rounded-lg text-[11px] md:text-xs font-bold transition-all border ${
                            selectedGenre === g.id ? 'bg-gold-500/20 text-gold-400 border-gold-500/30 shadow-sm' : 'bg-ink-950 border-ink-800/50 text-ink-400 hover:bg-ink-800'
                          }`}
                        >
                          {g.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 md:p-6 pb-24 md:pb-6 flex-1">
                {isLoading && page === 1 ? (
                  <div className="flex flex-col items-center justify-center h-48 md:h-64 text-gold-500">
                    <Loader2 className="animate-spin mb-4" size={32} />
                    <span className="text-xs md:text-sm font-bold tracking-widest uppercase">Aranıyor...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2 md:gap-4">
                      {results
                        .filter((r) => r.poster_path)
                        .map((item) => {
                          const isSelected = cart.some((c) => c.id === item.id);
                          const status = getExistingStatus(item);
                          const title = item.title || item.name;
                          const date = item.release_date || item.first_air_date;

                          return (
                            <div
                              key={item.id}
                              onClick={() => toggleCartItem(item)}
                              className={`group relative rounded-xl overflow-hidden transition-all duration-300 ${
                                status.exists
                                  ? 'ring-2 ring-emerald-500/70 opacity-85 cursor-default'
                                  : isSelected
                                  ? 'ring-2 md:ring-4 ring-gold-500 ring-offset-1 md:ring-offset-2 ring-offset-ink-900 scale-95 shadow-[0_0_15px_rgba(234,179,8,0.4)] cursor-pointer'
                                  : 'hover:scale-105 hover:shadow-xl hover:ring-2 hover:ring-ink-500 hover:ring-offset-2 hover:ring-offset-ink-900 cursor-pointer'
                              }`}
                            >
                              <img
                                src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
                                alt={title}
                                className="w-full h-auto aspect-[2/3] object-cover"
                                loading="lazy"
                              />

                              {/* KÜTÜPHANEDE EKLİ ROZETİ */}
                              {status.exists ? (
                                <div className="absolute top-1.5 inset-x-1.5 bg-emerald-600/95 backdrop-blur-md text-white px-2 py-1 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-lg border border-emerald-400/40">
                                  <CheckCircle2 size={11} className="flex-shrink-0" />
                                  <span className="truncate">{status.watched ? 'İzlendi' : 'Listede Ekli'}</span>
                                </div>
                              ) : (
                                <div
                                  className={`absolute top-1.5 right-1.5 md:top-2 md:right-2 w-5 h-5 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all ${
                                    isSelected
                                      ? 'bg-gold-500 text-ink-900 opacity-100 scale-100'
                                      : 'bg-black/50 text-white opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100'
                                  }`}
                                >
                                  {isSelected ? (
                                    <Check size={12} strokeWidth={3} className="md:w-3.5 md:h-3.5" />
                                  ) : (
                                    <Plus size={12} className="md:w-3.5 md:h-3.5" />
                                  )}
                                </div>
                              )}

                              <div
                                className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-1.5 md:p-3 pt-6 md:pt-10 transition-opacity ${
                                  isSelected || status.exists ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                <div className="text-[10px] md:text-xs font-bold text-white truncate">{title}</div>
                                <div className="text-[8px] md:text-[10px] text-gold-400 font-medium">{date?.substring(0, 4)}</div>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {results.length > 0 && page < totalPages && !selectedPerson && (
                      <div className="flex justify-center pt-4 pb-8">
                        <button
                          onClick={() => setPage((p) => p + 1)}
                          disabled={isLoadingMore}
                          className="flex items-center gap-2 px-6 py-3 bg-ink-800 hover:bg-ink-700 text-white rounded-xl font-bold transition-all border border-ink-700/50 shadow-lg disabled:opacity-50 text-sm"
                        >
                          {isLoadingMore ? (
                            <><Loader2 size={16} className="animate-spin text-gold-400" /> Yükleniyor...</>
                          ) : (
                            <>Daha Fazla Göster <ChevronDown size={16} className="text-gold-400" /></>
                          )}
                        </button>
                      </div>
                    )}

                    {results.length === 0 && !isLoading && (
                      <div className="text-center py-16 md:py-20 text-xs md:text-sm text-ink-500 px-4">
                        Sonuç bulunamadı. Başka bir film, oyuncu veya yönetmen adı deneyin.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {cart.length > 0 && (
              <div className="bg-ink-900 border-t border-ink-800/80 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] animate-fade-in-up flex flex-col absolute bottom-0 inset-x-0 md:relative z-20">
                {isCartExpanded && (
                  <div className="p-4 border-b border-ink-800 bg-ink-950/50 max-h-48 md:max-h-60 overflow-y-auto overscroll-contain animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs md:text-sm font-bold text-white">Sepetindeki Yapımlar</h4>
                      <button
                        onClick={() => { setCart([]); setIsCartExpanded(false); }}
                        className="text-[10px] md:text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-bold transition-colors"
                      >
                        <Trash2 size={14} /> Tümünü Sil
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 md:gap-3">
                      {cart.map((item) => (
                        <div key={item.id} className="relative group w-12 h-16 md:w-16 md:h-24 rounded-lg overflow-hidden border border-ink-700 shadow-md">
                          <img src={`https://image.tmdb.org/t/p/w200${item.poster_path}`} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleCartItem(item); }}
                            className="absolute inset-0 bg-red-500/90 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex backdrop-blur-sm"
                          >
                            <Trash2 size={16} className="text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-2.5 md:p-4 px-3 md:px-6 flex flex-row items-center justify-between gap-3">
                  <button
                    onClick={() => setIsCartExpanded(!isCartExpanded)}
                    className="flex items-center gap-2.5 md:gap-3 hover:opacity-80 transition-opacity text-left group flex-1"
                  >
                    <div className="relative">
                      <div className="w-9 h-9 md:w-12 md:h-12 rounded-full bg-gold-500/10 flex items-center justify-center border border-gold-500/30 group-hover:bg-gold-500/20 transition-colors">
                        <ShoppingCart className="text-gold-400 w-4 h-4 md:w-5 md:h-5" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 md:w-6 md:h-6 rounded-full bg-gold-500 text-ink-950 font-black text-[9px] md:text-xs flex items-center justify-center shadow-lg shadow-gold-500/40">
                        {cart.length}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-xs md:text-base text-white flex items-center gap-1">
                        Sepet {isCartExpanded ? <ChevronDown size={14} className="text-ink-400" /> : <ChevronUp size={14} className="text-ink-400" />}
                      </div>
                      <div className="hidden md:block text-[10px] md:text-xs font-medium text-ink-400">
                        {cart.filter((c) => c.media_type === 'movie').length} Film, {cart.filter((c) => c.media_type === 'tv').length} Dizi
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => { setIsCartExpanded(false); setStep('collection'); }}
                    className="bg-gradient-to-r from-gold-500 to-gold-400 text-ink-950 px-4 md:px-8 py-2 md:py-3 rounded-lg md:rounded-xl text-[11px] md:text-base font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-gold-500/20 flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    İlerle <Check size={14} className="md:w-[18px] md:h-[18px]" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {step === 'collection' && (
          <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto overscroll-contain bg-ink-950/50">
            <div className="max-w-3xl mx-auto w-full space-y-6 md:space-y-8">
              <div className="text-center space-y-2">
                <h3 className="text-2xl md:text-3xl font-black text-white">Toplu Atama</h3>
                <p className="text-xs md:text-sm text-ink-400">Seçtiğin {cart.length} yapımı istersen tek tıkla bir koleksiyona atayabilirsin.</p>
              </div>

              <div className="flex flex-wrap justify-center gap-2 md:gap-3 p-3 md:p-4 bg-ink-900/50 rounded-2xl border border-ink-800/50">
                {cart.map((item) => (
                  <div key={item.id} className="relative group w-12 h-16 md:w-16 md:h-24 rounded-lg overflow-hidden border border-ink-700 shadow-md">
                    <img src={`https://image.tmdb.org/t/p/w200${item.poster_path}`} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setCart(cart.filter((c) => c.id !== item.id))}
                      className="absolute inset-0 bg-red-500/80 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex backdrop-blur-sm"
                    >
                      <Trash2 size={16} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="bg-ink-900 border border-ink-800 rounded-2xl p-4 md:p-6 space-y-4 md:space-y-6 shadow-lg">
                <div className="flex items-center gap-2 md:gap-3 text-gold-400 mb-2 md:mb-4">
                  <FolderPlus size={20} />
                  <h4 className="font-bold text-base md:text-lg text-white">Koleksiyona Ekle (Opsiyonel)</h4>
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    value={collectionName}
                    onChange={(e) => { setCollectionName(e.target.value); setSelectedCollectionId(null); }}
                    placeholder="Yeni koleksiyon adı (Örn: Hafta Sonu)"
                    className="w-full bg-ink-950 border border-ink-800 rounded-xl px-4 py-3 text-xs md:text-sm font-medium text-white placeholder-ink-500 focus:outline-none focus:border-gold-500/50 transition-all"
                  />

                  {data.collections?.length > 0 && (
                    <>
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="h-px bg-ink-800 flex-1" />
                        <span className="text-[10px] md:text-xs font-bold text-ink-500 uppercase tracking-widest">VEYA MEVCUT SEÇ</span>
                        <div className="h-px bg-ink-800 flex-1" />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {data.collections.map((col: any) => (
                          <button
                            key={col.id}
                            onClick={() => { setSelectedCollectionId(col.id); setCollectionName(''); }}
                            className={`px-3 md:px-4 py-2 rounded-lg text-[11px] md:text-xs font-bold transition-all border ${
                              selectedCollectionId === col.id ? 'bg-gold-500/20 text-gold-400 border-gold-500/30' : 'bg-ink-950 border-ink-800 text-ink-400 hover:bg-ink-800'
                            }`}
                          >
                            {col.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-2 md:pt-4">
                <button onClick={() => setStep('browse')} className="w-full sm:flex-1 py-3.5 md:py-4 bg-ink-900 text-ink-300 font-bold rounded-xl hover:bg-ink-800 transition-colors border border-ink-700 text-sm md:text-base">
                  Geri Dön
                </button>
                <button onClick={handleImport} className="w-full sm:flex-[2] py-3.5 md:py-4 bg-gradient-to-r from-gold-500 to-gold-400 text-ink-950 font-black tracking-widest uppercase rounded-xl hover:scale-[1.02] transition-transform shadow-lg shadow-gold-500/20 text-xs md:text-sm">
                  {cart.length} Yapımı Ekle
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex-1 flex flex-col items-center justify-center bg-ink-950/80 p-6 md:p-8 text-center">
            <div className="w-20 h-20 md:w-24 md:h-24 relative mb-6 md:mb-8">
              <div className="absolute inset-0 border-4 border-gold-500/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-gold-500 rounded-full border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="text-gold-400" size={28} />
              </div>
            </div>

            <h3 className="text-xl md:text-2xl font-black text-white mb-2">Sinema Kartları & DNA Künyeleri Çekiliyor...</h3>
            <p className="text-xs md:text-sm text-ink-400 mb-6 md:mb-8 max-w-md">
              Yönetmen, oyuncu kadrosu, özet ve izleme platformları kütüphanene işleniyor.
            </p>

            <div className="w-full max-w-sm">
              <div className="flex justify-between text-[10px] md:text-xs font-bold text-ink-300 mb-2 uppercase tracking-widest">
                <span>İlerleme</span>
                <span className="text-gold-400">% {importProgress}</span>
              </div>
              <div className="h-2 md:h-3 w-full bg-ink-900 rounded-full overflow-hidden border border-ink-800 shadow-inner relative">
                <div className="h-full bg-gradient-to-r from-gold-600 to-yellow-400 transition-all duration-300" style={{ width: `${importProgress}%` }} />
              </div>
            </div>

            {importProgress === 100 && (
              <div className="mt-6 md:mt-8 text-green-400 font-bold flex items-center gap-2 animate-fade-in-up text-sm md:text-base">
                <Check size={18} /> İşlem Tamamlandı!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}