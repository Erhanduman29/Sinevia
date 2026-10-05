import { useState, useMemo, useEffect } from 'react';
import {
  X,
  Dna,
  Search,
  Beaker,
  ChevronLeft,
  Sparkles,
  Image as ImageIcon,
  Plus,
  Clock,
  Star,
  PlayCircle,
  ExternalLink,
  Shuffle,
  Eye,
  Youtube,
  User,
  Users,
  Calendar,
  RefreshCw,
  Calculator,
  CheckCircle2,
  Layers,
  Film,
  History,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass } from '../lib/utils';
import RatingModal from './RatingModal';
import MediaDetailModal from './MediaDetailModal';
import type { Movie } from '../types';

// YENİ BEYNİMİZİ İÇERİ ALIYORUZ!
import { calculateDnaSynthesis } from '../lib/dnaLogic';
import type { SynthVariant, SynthTrait } from '../lib/dnaLogic';

interface DnaSynthesizerModalProps {
  onClose: () => void;
}

type Step = 'select' | 'synthesizing' | 'result';
type Slot = 'A' | 'B' | null;
type SelectionTab = 'library' | 'watched' | 'past';

const API_KEY = import.meta.env.VITE_TMDB_API_KEY || 'a6230f08d495e326b7a89e52dc186a45';

export default function DnaSynthesizerModal({ onClose }: DnaSynthesizerModalProps) {
  const { data, watchMovie, editMovie } = useApp();
  const [step, setStep] = useState<Step>('select');
  const [movieAId, setMovieAId] = useState<string | null>(null);
  const [movieBId, setMovieBId] = useState<string | null>(null);
  const [selectingSlot, setSelectingSlot] = useState<Slot>(null);
  const [selectionTab, setSelectionTab] = useState<SelectionTab>('library');
  const [search, setSearch] = useState('');

  const [showRating, setShowRating] = useState(false);
  const [detailMovie, setDetailMovie] = useState<Movie | null>(null);
  const [showFormulaTable, setShowFormulaTable] = useState(false);

  const [variants, setVariants] = useState<SynthVariant[]>([]);
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);
  const [mutationRate, setMutationRate] = useState<number>(1);

  const [syncStatusText, setSyncStatusText] = useState<string>('');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const movieA = useMemo(
    () => (movieAId ? data.movies.find((m) => m.id === movieAId) || null : null),
    [data.movies, movieAId]
  );
  const movieB = useMemo(
    () => (movieBId ? data.movies.find((m) => m.id === movieBId) || null : null),
    [data.movies, movieBId]
  );

  const eligibleUnwatchedMovies = useMemo(() => {
    const unwatched = data.movies.filter((m) => !m.watched && !m.inPastQueue);
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
        if (yearA !== yearB) return yearA - yearB;
        return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
      });
      if (sorted.length > 0) {
        sequentialCollectionMovies.push(sorted[0]);
      }
    });

    return [...standalone, ...sequentialCollectionMovies];
  }, [data.movies]);

  const currentWatchedMovies = useMemo(
    () => data.movies.filter((m) => m.watched && !m.isPastWatch),
    [data.movies]
  );
  const pastWatchedMovies = useMemo(
    () => data.movies.filter((m) => m.watched && m.isPastWatch),
    [data.movies]
  );

  const filteredMovies = useMemo(() => {
    const sourceList =
      selectionTab === 'watched'
        ? currentWatchedMovies
        : selectionTab === 'past'
        ? pastWatchedMovies
        : data.movies;
        
    if (!search.trim()) return sourceList;
    const q = search.toLocaleLowerCase('tr-TR').trim();
    return sourceList.filter(
      (m) =>
        m.title.toLocaleLowerCase('tr-TR').includes(q) ||
        (m.directors && m.directors.some((d) => d.toLocaleLowerCase('tr-TR').includes(q))) ||
        (m.cast && m.cast.some((c) => c.toLocaleLowerCase('tr-TR').includes(q)))
    );
  }, [data.movies, currentWatchedMovies, pastWatchedMovies, selectionTab, search]);

  const sharedParentGenes = useMemo(() => {
    if (!movieA || !movieB) return [];
    const badges: string[] = [];

    if (
      Array.isArray(movieA.directors) &&
      movieA.directors.length > 0 &&
      Array.isArray(movieB.directors) &&
      movieB.directors.length > 0
    ) {
      movieA.directors.forEach((d) => {
        if (movieB.directors!.some((db) => db.trim() === d.trim())) {
          badges.push(`🎬 Ortak Yönetmen: ${d}`);
        }
      });
    }

    if (
      Array.isArray(movieA.cast) &&
      movieA.cast.length > 0 &&
      Array.isArray(movieB.cast) &&
      movieB.cast.length > 0
    ) {
      movieA.cast.forEach((c) => {
        if (movieB.cast!.some((cb) => cb.trim() === c.trim())) {
          badges.push(`🎭 Ortak Oyuncu: ${c}`);
        }
      });
    }

    movieA.genres.forEach((g) => {
      if (movieB.genres.some((gb) => gb.trim() === g.trim())) {
        badges.push(`🏷️ Ortak Tür: ${g}`);
      }
    });

    return badges;
  }, [movieA, movieB]);

  const fetchFullCreditsForMovie = async (m: Movie): Promise<Movie> => {
    try {
      let targetTmdbId = m.tmdbId;
      if (!targetTmdbId) {
        const sRes = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(
            m.title
          )}&language=tr-TR`
        );
        const sJson = await sRes.json();
        const results = sJson.results || [];
        if (results.length > 0) {
          const match =
            results.find(
              (r: any) => r.release_date && r.release_date.substring(0, 4) === m.year
            ) || results[0];
          targetTmdbId = match.id;
        }
      }

      if (!targetTmdbId) return m;

      const dRes = await fetch(
        `https://api.themoviedb.org/3/movie/${targetTmdbId}?api_key=${API_KEY}&language=tr-TR&append_to_response=credits,keywords`
      );
      if (!dRes.ok) return m;
      const details = await dRes.json();

      const directors: string[] = (details.credits?.crew || [])
        .filter((c: any) => c.job === 'Director')
        .map((c: any) => String(c.name).trim())
        .filter(Boolean)
        .slice(0, 4);

      const cast: string[] = (details.credits?.cast || [])
        .slice(0, 15)
        .map((c: any) => String(c.name).trim())
        .filter(Boolean);

      const studios: string[] = (details.production_companies || [])
        .slice(0, 3)
        .map((s: any) => String(s.name).trim())
        .filter(Boolean);

      const keywords: string[] = (details.keywords?.keywords || [])
        .map((k: any) => String(k.name).trim())
        .filter(Boolean);

      const originalLanguage: string | undefined = details.original_language || m.originalLanguage;
      const runtime: number | undefined = details.runtime || m.runtime;
      const overview: string | undefined = details.overview || m.overview;
      const posterUrl: string | undefined = details.poster_path
        ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
        : m.posterUrl;

      const extra = {
        directors: directors.length > 0 ? directors : m.directors,
        cast: cast.length > 0 ? cast : m.cast,
        studios: studios.length > 0 ? studios : m.studios,
        keywords: keywords.length > 0 ? keywords : m.keywords,
        originalLanguage,
      };

      editMovie(
        m.id,
        m.title,
        m.year,
        m.genres,
        runtime,
        posterUrl,
        overview,
        targetTmdbId,
        true,
        m.customUrl,
        m.imdbId,
        m.watchProviders,
        extra
      );

      return {
        ...m,
        tmdbId: targetTmdbId,
        runtime,
        posterUrl,
        overview,
        ...extra,
      };
    } catch {
      return m;
    }
  };

  const handleRandomPair = () => {
    const allWatched = data.movies.filter((m) => m.watched);
    const highRated = allWatched.filter((m) => (m.rating || 0) >= 8);
    const pool = highRated.length >= 2 ? highRated : data.movies;
    if (pool.length < 2) return;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setMovieAId(shuffled[0].id);
    setMovieBId(shuffled[1].id);
  };

  const handleSynthesize = async () => {
    if (!movieA || !movieB || eligibleUnwatchedMovies.length === 0) return;
    
    setStep('synthesizing');

    const updatedMap = new Map<string, Movie>();
    const allInvolved = [movieA, movieB, ...eligibleUnwatchedMovies];
    const needsSync = allInvolved.filter(
      (m) =>
        !Array.isArray(m.cast) ||
        m.cast.length === 0 ||
        !Array.isArray(m.directors) ||
        m.directors.length === 0
    );

    if (needsSync.length > 0) {
      for (let i = 0; i < needsSync.length; i++) {
        const target = needsSync[i];
        setSyncStatusText(
          `Eksik oyuncu & yönetmen künyeleri tamamlanıyor (${i + 1}/${needsSync.length}): ${target.title}`
        );
        const enriched = await fetchFullCreditsForMovie(target);
        updatedMap.set(enriched.id, enriched);
      }
    }

    setSyncStatusText('Sabit matematiksel uyum oranları hesaplanıyor...');

    const activeA = updatedMap.get(movieA.id) || movieA;
    const activeB = updatedMap.get(movieB.id) || movieB;

    setTimeout(() => {
      // TMDB'den güncellenmiş hallerini yolluyoruz
      const updatedCandidates = eligibleUnwatchedMovies.map(c => updatedMap.get(c.id) || c);

      // YENİ: SADECE BEYNİ (FONKSİYONU) ÇAĞIRIYORUZ! Yüzlerce satır matematik gitti.
      const scoredCandidates = calculateDnaSynthesis(activeA, activeB, updatedCandidates, mutationRate);

      setVariants(scoredCandidates.slice(0, 3));
      setActiveVariantIdx(0);
      setStep('result');
    }, 500);
  };

  const handleSelectMovie = (movie: Movie) => {
    if (selectingSlot === 'A') setMovieAId(movie.id);
    else if (selectingSlot === 'B') setMovieBId(movie.id);
    setSelectingSlot(null);
    setSearch('');
  };

  const getWatchLinks = (movie: Movie) => {
    const links: { href: string; text: string; logo: string | null; icon: any; isTrailer?: boolean }[] = [];

    const trailerQuery = encodeURIComponent(`${movie.title} ${movie.year || ''} official trailer fragman`);
    links.push({
      href: `https://www.youtube.com/results?search_query=${trailerQuery}`,
      text: 'Fragman',
      logo: null,
      icon: Youtube,
      isTrailer: true,
    });

    if (movie.customUrl) {
      links.push({ href: movie.customUrl, text: 'Özel Kaynak', logo: null, icon: ExternalLink });
    }

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

        links.push({ href: finalHref, text: provider.providerName, logo: provider.logoUrl, icon: PlayCircle });
      });
    }

    const searchQuery = encodeURIComponent(`${movie.title} ${movie.year || ''} izle`);
    links.push({
      href: `https://www.google.com/search?q=${searchQuery}`,
      text: "Google'da Bul",
      logo: null,
      icon: Search,
    });

    if (
      data.altWatchTemplate &&
      (movie.imdbId || data.altWatchTemplate.includes('{slug}') || data.altWatchTemplate.includes('{title}'))
    ) {
      const charMap: Record<string, string> = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
      const slug = movie.title
        .toLocaleLowerCase('tr-TR')
        .replace(/[çğıöşü]/g, (match) => charMap[match])
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      const finalAltHref = data.altWatchTemplate
        .replace('{imdb}', movie.imdbId || '')
        .replace('{slug}', slug)
        .replace('{title}', encodeURIComponent(movie.title))
        .replace('{year}', movie.year || '');

      links.push({ href: finalAltHref, text: 'Alternatif', logo: null, icon: PlayCircle });
    }

    return links;
  };

  const currentResult = variants[activeVariantIdx] || null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center sm:p-5 bg-black sm:bg-black/85 backdrop-blur-xl animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full h-full sm:h-auto sm:max-h-[92vh] max-w-4xl bg-ink-950/95 border-0 sm:border border-emerald-500/30 rounded-none sm:rounded-[2rem] overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.9)] flex flex-col"
      >
        {step === 'result' && currentResult?.movie.posterUrl && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
            <img
              src={currentResult.movie.posterUrl}
              alt=""
              className="w-full h-full object-cover blur-3xl scale-125 saturate-150"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/85 to-ink-950/50" />
          </div>
        )}

        <div className="relative z-10 flex items-center justify-between px-4 sm:px-7 py-3 sm:py-4 border-b border-ink-800/70 bg-gradient-to-r from-emerald-950/50 via-ink-900/90 to-ink-950 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {selectingSlot ? (
              <button
                onClick={() => setSelectingSlot(null)}
                className="p-2 -ml-2 rounded-xl bg-ink-800/80 hover:bg-ink-700 text-ink-200 transition-colors flex-shrink-0"
              >
                <ChevronLeft size={20} />
              </button>
            ) : (
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-500/10 flex items-center justify-center border border-emerald-500/40 shadow-lg shadow-emerald-500/10 flex-shrink-0">
                <Dna size={20} className="text-emerald-400" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-black text-white tracking-tight truncate">
                Film DNA Sentezleyici
              </h2>
              <p className="text-[10px] sm:text-xs text-emerald-400/90 font-medium truncate">
                Sabit Oranlı Genetik Çaprazlama
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowFormulaTable(!showFormulaTable)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold border transition-all ${
                showFormulaTable
                  ? 'bg-emerald-500 text-ink-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                  : 'bg-ink-900/90 text-emerald-300 border-emerald-500/30 hover:bg-ink-800'
              }`}
              title="Sabit Matematiksel Oranları Gör"
            >
              <Calculator size={13} /> <span className="hidden xs:inline">Oranlar</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-ink-900 hover:bg-ink-800 text-ink-400 hover:text-white border border-ink-800 flex items-center justify-center transition-all flex-shrink-0"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {showFormulaTable && (
          <div className="relative z-10 bg-ink-900/95 border-b border-emerald-500/30 px-4 sm:px-6 py-3 sm:py-4 text-xs space-y-2.5 animate-fade-in shrink-0">
            <div className="font-black text-emerald-400 uppercase tracking-wider flex items-center justify-between text-[10px] sm:text-xs">
              <span>📐 Sabit Genetik Uyum Oranları</span>
              <button
                onClick={() => setShowFormulaTable(false)}
                className="text-ink-400 hover:text-white font-bold"
              >
                Kapat
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-ink-200">
              <div className="bg-ink-950/90 p-2 sm:p-2.5 rounded-xl border border-ink-800">
                🎬 <strong>Yönetmen:</strong>{' '}
                <span className="text-emerald-400 font-black">+%25</span> (Ortak:{' '}
                <span className="text-emerald-400 font-black">+%30</span>)
              </div>
              <div className="bg-ink-950/90 p-2 sm:p-2.5 rounded-xl border border-ink-800">
                🎭 <strong>Oyuncu:</strong> Her biri{' '}
                <span className="text-emerald-400 font-black">+%10</span> (Ortak:{' '}
                <span className="text-emerald-400 font-black">+%15</span>)
              </div>
              <div className="bg-ink-950/90 p-2 sm:p-2.5 rounded-xl border border-ink-800">
                🏷 <strong>Tür:</strong> Her biri{' '}
                <span className="text-emerald-400 font-black">+%5</span> (Ortak:{' '}
                <span className="text-emerald-400 font-black">+%8</span>)
              </div>
              <div className="bg-ink-950/90 p-2 sm:p-2.5 rounded-xl border border-ink-800">
                🔑 <strong>Tema:</strong> Her biri{' '}
                <span className="text-emerald-400 font-black">+%4</span> (Ortak:{' '}
                <span className="text-emerald-400 font-black">+%6</span>)
              </div>
              <div className="bg-ink-950/90 p-2 sm:p-2.5 rounded-xl border border-ink-800">
                📦 <strong>Koleksiyon:</strong>{' '}
                <span className="text-emerald-400 font-black">+%15</span> (Sıradaki ilk)
              </div>
              <div className="bg-ink-950/90 p-2 sm:p-2.5 rounded-xl border border-ink-800">
                ⏱ <strong>Stüdyo / Süre:</strong>{' '}
                <span className="text-emerald-400 font-black">+%5</span>
              </div>
            </div>
          </div>
        )}

        <div className="relative z-10 flex-1 overflow-y-auto p-3.5 sm:p-7 custom-scrollbar pb-20 sm:pb-7">
          {selectingSlot && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Film adı, yönetmen veya oyuncu ara..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-ink-900 border border-ink-700/80 rounded-xl pl-10 pr-4 py-2.5 text-base sm:text-sm text-white placeholder-ink-500 focus:outline-none focus:border-emerald-500/60 transition-all"
                  />
                </div>
                <div className="grid grid-cols-3 sm:flex bg-ink-900 p-1 rounded-xl border border-ink-800 flex-shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectionTab('library')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all truncate ${
                      selectionTab === 'library'
                        ? 'bg-emerald-500 text-ink-950 shadow-sm'
                        : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Tümü ({data.movies.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectionTab('watched')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all truncate ${
                      selectionTab === 'watched'
                        ? 'bg-emerald-500 text-ink-950 shadow-sm'
                        : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    İzlenen ({currentWatchedMovies.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectionTab('past')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all truncate flex items-center justify-center gap-1.5 ${
                      selectionTab === 'past'
                        ? 'bg-violet-500 text-white shadow-sm'
                        : 'text-ink-400 hover:text-violet-300'
                    }`}
                  >
                    <History size={12} className="hidden xs:inline" /> Önceden
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[55svh] overflow-y-auto pr-1 custom-scrollbar">
                {filteredMovies.map((m) => {
                  const hasCast = Array.isArray(m.cast) && m.cast.length > 0;
                  const hasDirs = Array.isArray(m.directors) && m.directors.length > 0;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleSelectMovie(m)}
                      className="flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl border border-ink-800/90 bg-ink-900/50 hover:bg-ink-800/80 hover:border-emerald-500/40 transition-all text-left group relative overflow-hidden"
                    >
                      <div className="w-12 sm:w-14 aspect-[2/3] bg-ink-950 rounded-xl overflow-hidden flex-shrink-0 border border-ink-700/60 shadow-md">
                        {m.posterUrl ? (
                          <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon size={16} className="text-ink-700" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-sm text-ink-100 truncate group-hover:text-emerald-400 transition-colors">
                            {m.title}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {m.isPastWatch && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold">
                                Önceden
                              </span>
                            )}
                            {m.watched && m.rating !== null && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-md font-black flex-shrink-0 ${ratingBgClass(
                                  m.rating
                                )}`}
                              >
                                ★ {m.rating}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-[11px] text-ink-400 truncate mt-0.5">
                          {m.year || 'Yıl yok'} · {m.genres.slice(0, 2).join(', ')}
                        </div>

                        {hasDirs && (
                          <div className="text-[11px] text-emerald-400/90 font-semibold truncate mt-1">
                            🎬 {m.directors![0]}
                          </div>
                        )}

                        {hasCast && (
                          <div className="text-[10px] text-ink-400 truncate mt-0.5">
                            🎭 {m.cast!.slice(0, 2).join(', ')}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!selectingSlot && step === 'select' && (
            <div className="space-y-4 sm:space-y-6 animate-fade-in">
              {eligibleUnwatchedMovies.length === 0 ? (
                <div className="text-center py-10 sm:py-12 bg-ink-900/40 rounded-3xl border border-ink-800">
                  <Beaker size={48} className="mx-auto text-ink-600 mb-4" />
                  <h3 className="text-base sm:text-lg font-bold text-ink-200">Aday Film Bulunamadı</h3>
                  <p className="text-xs sm:text-sm text-ink-500 mt-2 max-w-md mx-auto px-4">
                    Sentezleme yapabilmek için kütüphanende normal olarak izlenmeyi bekleyen filmler olması gerekiyor.<br/><br/>
                    *(Eskiden izlenenler sırasına attığın filmler yeni aday havuzuna dahil edilmez)*
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-ink-900/70 border border-ink-800 rounded-2xl p-3.5 sm:p-4">
                    <div className="text-[11px] sm:text-xs text-ink-300 leading-relaxed text-center sm:text-left">
                      Çaprazlamak istediğin iki filmi seç. Ortak <strong>oyuncular, yönetmen, tür, tema ve dönem</strong> sabit matematiksel oranlarla toplanarak en uyumlu film sentezlenir.
                    </div>
                    {data.movies.length >= 2 && (
                      <button
                        type="button"
                        onClick={handleRandomPair}
                        className="flex-shrink-0 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-black bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 px-4 py-2.5 rounded-xl transition-all"
                      >
                        <Shuffle size={14} /> Rastgele Doldur
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {[
                      {
                        slot: 'A' as const,
                        movie: movieA,
                        label: '1. Ebeveyn DNA',
                        accent: 'border-emerald-500/50 hover:border-emerald-400',
                        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                      },
                      {
                        slot: 'B' as const,
                        movie: movieB,
                        label: '2. Ebeveyn DNA',
                        accent: 'border-cyan-500/50 hover:border-cyan-400',
                        badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
                      },
                    ].map(({ slot, movie, label, accent, badgeBg }) => {
                      const hasDirs = movie && Array.isArray(movie.directors) && movie.directors.length > 0;
                      const hasCast = movie && Array.isArray(movie.cast) && movie.cast.length > 0;

                      return (
                        <div
                          key={slot}
                          onClick={() => setSelectingSlot(slot)}
                          className={`relative rounded-2xl sm:rounded-3xl border-2 p-3 sm:p-4 transition-all cursor-pointer group overflow-hidden ${
                            movie
                              ? `bg-ink-900/80 ${accent} shadow-xl`
                              : 'border-dashed border-ink-700 bg-ink-900/30 hover:border-emerald-500/40 hover:bg-ink-900/60 min-h-[140px] sm:min-h-[180px] flex items-center justify-center'
                          }`}
                        >
                          {movie ? (
                            <div className="flex gap-3 sm:gap-4 items-start">
                              <div className="w-20 sm:w-28 aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden bg-ink-950 border border-ink-700/80 flex-shrink-0 shadow-lg relative">
                                {movie.posterUrl ? (
                                  <img
                                    src={movie.posterUrl}
                                    alt={movie.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-ink-600">
                                    <Film size={24} />
                                  </div>
                                )}
                                {movie.rating !== null && (
                                  <div
                                    className={`absolute top-1.5 left-1.5 text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md font-black shadow ${ratingBgClass(
                                      movie.rating
                                    )}`}
                                  >
                                    ★ {movie.rating}
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[120px] sm:min-h-[144px]">
                                <div>
                                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                                    <span
                                      className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeBg}`}
                                    >
                                      {label}
                                    </span>
                                    <span className="text-[10px] font-bold text-ink-400 group-hover:text-white transition-colors">
                                      Değiştir ↻
                                    </span>
                                  </div>

                                  <h3 className="text-sm sm:text-lg font-black text-white leading-snug truncate">
                                    {movie.title}
                                  </h3>

                                  <div className="text-[11px] sm:text-xs text-ink-400 mt-1 font-medium flex items-center gap-1.5 flex-wrap">
                                    <span>{movie.year || 'Yıl yok'}</span>
                                    {movie.runtime && <span>· {movie.runtime} dk</span>}
                                    {movie.isPastWatch && (
                                      <span className="inline-flex items-center gap-0.5 text-violet-300">
                                        <History size={10} /> Önceden
                                      </span>
                                    )}
                                  </div>

                                  {hasDirs && (
                                    <div className="text-[11px] sm:text-xs text-emerald-300 font-bold mt-1.5 truncate flex items-center gap-1.5">
                                      <User size={12} className="flex-shrink-0" />
                                      <span className="truncate">{movie.directors!.join(', ')}</span>
                                    </div>
                                  )}

                                  {hasCast && (
                                    <div className="text-[10px] sm:text-[11px] text-ink-300 mt-1 line-clamp-1 sm:line-clamp-2 leading-relaxed">
                                      <Users size={11} className="inline mr-1 text-gold-400" />
                                      {movie.cast!.slice(0, 4).join(', ')}
                                    </div>
                                  )}
                                </div>

                                {movie.genres.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {movie.genres.slice(0, 3).map((g) => (
                                      <span
                                        key={g}
                                        className="text-[9px] sm:text-[10px] font-bold bg-ink-950 text-ink-300 px-1.5 sm:px-2 py-0.5 rounded-md border border-ink-800"
                                      >
                                        {g}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center text-center p-3">
                              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-ink-800/80 border border-ink-700 flex items-center justify-center mb-2.5 group-hover:scale-110 group-hover:border-emerald-500/50 transition-all">
                                <Plus size={24} className="text-ink-400 group-hover:text-emerald-400" />
                              </div>
                              <span className="text-xs sm:text-sm font-black text-ink-200">{label} Seç</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {movieA && movieB && (
                    <div className="bg-emerald-950/25 border border-emerald-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 animate-fade-in">
                      <span className="text-[11px] sm:text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0">
                        <Dna size={14} /> Ortak Genler:
                      </span>
                      {sharedParentGenes.length > 0 ? (
                        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5">
                          {sharedParentGenes.map((badge, i) => (
                            <span
                              key={i}
                              className="text-[10px] sm:text-[11px] font-bold bg-ink-950/90 text-emerald-200 px-2.5 py-0.5 rounded-lg border border-emerald-500/30"
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] sm:text-[11px] text-ink-400 text-center">
                          İki film tamamen farklı dünyalardan — çapraz melezleme yapılacak!
                        </span>
                      )}
                    </div>
                  )}

                  <div className="bg-ink-900/60 border border-ink-800 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
                    <div className="flex justify-between text-[11px] sm:text-xs font-bold text-ink-400 uppercase tracking-wider">
                      <span>Sentezleme Stratejisi</span>
                      <span className="text-emerald-400 truncate max-w-[50%] text-right">
                        {mutationRate === 0
                          ? 'Safkan Matematik'
                          : mutationRate === 1
                          ? 'Melez A×B Öncelikli'
                          : 'Kaos Modu'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                      {[
                        { val: 0, title: '🛡️ Safkan', sub: 'En yüksek toplam' },
                        { val: 1, title: '⚖️ Melez', sub: 'İkisinden de gen' },
                        { val: 2, title: '⚡ Kaos', sub: 'Deneysel sürpriz' },
                      ].map((m) => (
                        <button
                          key={m.val}
                          type="button"
                          onClick={() => setMutationRate(m.val)}
                          className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
                            mutationRate === m.val
                              ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md'
                              : 'bg-ink-950/60 border-ink-800 text-ink-400 hover:bg-ink-800'
                          }`}
                        >
                          <div className="text-[11px] sm:text-xs font-black truncate">{m.title}</div>
                          <div className="text-[9px] sm:text-[10px] opacity-75 mt-0.5 truncate">{m.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={!movieA || !movieB || eligibleUnwatchedMovies.length === 0}
                    onClick={handleSynthesize}
                    className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-ink-950 font-black px-6 py-3.5 sm:py-4 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-99 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 text-xs sm:text-base"
                  >
                    <Beaker size={18} />
                    <span>
                      {eligibleUnwatchedMovies.length > 0 
                        ? `DNA Sentezini Başlat (${eligibleUnwatchedMovies.length} Aday)`
                        : 'Sentez İçin Aday Bekleyen Film Yok'
                      }
                    </span>
                  </button>
                </>
              )}
            </div>
          )}

          {!selectingSlot && step === 'synthesizing' && (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in space-y-5">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin" />
                <Dna size={36} className="text-emerald-400 animate-pulse" />
              </div>
              <div className="text-center space-y-2 max-w-md px-4">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-wider uppercase">
                  Genetik Matris Hesaplanıyor...
                </h3>
                <p className="text-[11px] sm:text-xs text-emerald-400 font-medium">
                  {syncStatusText || `${movieA?.title} × ${movieB?.title} çaprazlanıyor...`}
                </p>
              </div>
            </div>
          )}

          {!selectingSlot && step === 'result' && (
            <div className="animate-fade-in-up space-y-4 sm:space-y-5">
              {!currentResult ? (
                <div className="text-center py-12 space-y-3 sm:space-y-4 bg-ink-900/50 rounded-3xl border border-ink-800 p-6">
                  <Beaker size={48} className="mx-auto text-ink-500" />
                  <h3 className="text-base sm:text-lg font-black text-white">Ortak Genetik Özellik Bulunamadı</h3>
                  <p className="text-[11px] sm:text-xs text-ink-400 max-w-md mx-auto">
                    Seçtiğin iki filmle bekleyen filmlerin arasında hiçbir uyum eşleşmedi.
                  </p>
                  <button
                    onClick={() => setStep('select')}
                    className="bg-emerald-500 hover:bg-emerald-400 text-ink-950 font-black px-5 py-2.5 sm:py-3 rounded-xl text-xs transition-all"
                  >
                    Farklı Filmler Seç
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-3.5 py-1.5 rounded-2xl text-[11px] sm:text-xs font-black uppercase tracking-wider w-fit">
                      <CheckCircle2 size={15} className="text-emerald-400" />
                      Sentezlenen Film Bulundu
                    </div>

                    {variants.length > 1 && (
                      <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-ink-900/90 p-1 rounded-2xl border border-ink-800">
                        {variants.map((v, idx) => (
                          <button
                            key={v.movie.id}
                            type="button"
                            onClick={() => setActiveVariantIdx(idx)}
                            className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-black transition-all truncate ${
                              activeVariantIdx === idx
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-ink-950 shadow-md'
                                : 'text-ink-400 hover:text-white'
                            }`}
                          >
                            {idx + 1}. Varyant (%{v.matchScore})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {movieA && movieB && (
                    <div className="bg-ink-900/80 border border-ink-800 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 flex items-center gap-3 shadow-lg">
                      {movieA.posterUrl && (
                        <img
                          src={movieA.posterUrl}
                          alt={movieA.title}
                          className="w-8 h-11 rounded-lg object-cover border border-emerald-500/50 flex-shrink-0 hidden sm:block"
                        />
                      )}
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="flex justify-between text-[10px] sm:text-[11px] font-black gap-2">
                          <span className="text-emerald-400 truncate">
                            {movieA.title} (%{currentResult.parentAPct})
                          </span>
                          <span className="text-cyan-400 truncate text-right">
                            (%{currentResult.parentBPct}) {movieB.title}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-ink-950 rounded-full overflow-hidden flex border border-ink-800 p-[1px] gap-[1px]">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-l-full transition-all duration-500"
                            style={{ width: `${currentResult.parentAPct}%` }}
                          />
                          <div
                            className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-r-full transition-all duration-500"
                            style={{ width: `${currentResult.parentBPct}%` }}
                          />
                        </div>
                      </div>
                      {movieB.posterUrl && (
                        <img
                          src={movieB.posterUrl}
                          alt={movieB.title}
                          className="w-8 h-11 rounded-lg object-cover border border-cyan-500/50 flex-shrink-0 hidden sm:block"
                        />
                      )}
                    </div>
                  )}

                  <div className="bg-ink-900/75 backdrop-blur-md border border-emerald-500/35 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col lg:flex-row items-center lg:items-start gap-4 sm:gap-6">
                    <div className="flex flex-col items-center gap-2.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setDetailMovie(currentResult.movie)}
                        title="Tam Sinema Kartını Aç"
                        className="w-36 sm:w-52 aspect-[2/3] rounded-2xl overflow-hidden bg-ink-950 border-2 border-emerald-500/50 shadow-[0_15px_40px_rgba(0,0,0,0.8)] relative group cursor-pointer"
                      >
                        {currentResult.movie.posterUrl ? (
                          <img
                            src={currentResult.movie.posterUrl}
                            alt={currentResult.movie.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-ink-600 gap-2">
                            <ImageIcon size={36} />
                            <span className="text-[10px] sm:text-xs">Afiş Yok</span>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                          <div className="w-10 h-10 rounded-full bg-emerald-500 text-ink-950 flex items-center justify-center shadow-lg">
                            <Eye size={18} />
                          </div>
                          <span className="text-[10px] font-black text-white uppercase tracking-wider">
                            Sinema Kartı
                          </span>
                        </div>
                      </button>

                      <div className="w-36 sm:w-52 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 rounded-xl sm:rounded-2xl py-2 sm:py-2.5 px-3 sm:px-4 text-center shadow-lg">
                        <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-300">
                          Matematiksel Uyum
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-white mt-0.5">
                          %{currentResult.matchScore}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 w-full flex flex-col justify-between text-center lg:text-left">
                      <div>
                        {currentResult.movie.collectionId && (
                          <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-gold-400 bg-gold-500/10 border border-gold-500/30 px-2.5 py-0.5 rounded-full mb-1.5">
                            <Layers size={11} />{' '}
                            {
                              data.collections.find((c) => c.id === currentResult.movie.collectionId)
                                ?.name
                            }{' '}
                            (Sıradaki İlk)
                          </div>
                        )}

                        <h3 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                          {currentResult.movie.title}
                        </h3>

                        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-2 text-[11px] sm:text-xs text-ink-200 font-semibold">
                          {currentResult.movie.year && (
                            <span className="flex items-center gap-1 bg-ink-950/90 px-2.5 py-1 rounded-lg border border-ink-800">
                              <Calendar size={12} className="text-emerald-400" />{' '}
                              {currentResult.movie.year}
                            </span>
                          )}
                          {currentResult.movie.runtime && (
                            <span className="flex items-center gap-1 bg-ink-950/90 px-2.5 py-1 rounded-lg border border-ink-800">
                              <Clock size={12} className="text-emerald-400" />{' '}
                              {currentResult.movie.runtime} dk
                            </span>
                          )}
                          {Array.isArray(currentResult.movie.directors) &&
                            currentResult.movie.directors.length > 0 && (
                              <span className="flex items-center gap-1 bg-emerald-500/15 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/30 font-bold">
                                <User size={12} /> {currentResult.movie.directors.join(', ')}
                              </span>
                            )}
                        </div>

                        {Array.isArray(currentResult.movie.cast) &&
                          currentResult.movie.cast.length > 0 && (
                            <div className="mt-2.5 text-[10px] sm:text-xs text-ink-300 bg-ink-950/60 px-3 py-2 rounded-xl border border-ink-800/80 text-left">
                              <span className="font-black text-gold-400 mr-1.5">🎭 Oyuncular:</span>
                              {currentResult.movie.cast.slice(0, 5).join(', ')}
                            </div>
                          )}

                        {currentResult.movie.overview && (
                          <p className="mt-2 text-[11px] sm:text-xs text-ink-300 leading-relaxed line-clamp-2 text-left">
                            {currentResult.movie.overview}
                          </p>
                        )}

                        <div className="flex items-center justify-center lg:justify-start gap-1.5 flex-wrap my-3">
                          {getWatchLinks(currentResult.movie).map((link, idx) => {
                            const Icon = link.icon;
                            if (link.isTrailer) {
                              return (
                                <a
                                  key={idx}
                                  href={link.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md hover:scale-105"
                                >
                                  <Icon size={13} /> {link.text}
                                </a>
                              );
                            }
                            return (
                              <a
                                key={idx}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 bg-ink-800 hover:bg-ink-700 text-gold-400 border border-gold-500/30 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                              >
                                {link.logo ? (
                                  <img
                                    src={link.logo}
                                    alt="Platform"
                                    className="w-3.5 h-3.5 rounded-sm object-cover"
                                  />
                                ) : (
                                  <Icon size={13} />
                                )}
                                {link.text}
                              </a>
                            );
                          })}
                        </div>

                        <div className="bg-ink-950/85 border border-ink-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-1.5 sm:space-y-2 text-left">
                          <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-ink-400 border-b border-ink-800 pb-1.5">
                            <span>Eşleşen Kriterler & Kaynakları</span>
                            <span className="text-emerald-400 font-mono">
                              Toplam: %{currentResult.matchScore}
                            </span>
                          </div>

                          <div className="space-y-1 sm:space-y-1.5">
                            {currentResult.traits.map((t, i) => {
                              const badgeColor =
                                t.sourceType === 'both'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : t.sourceType === 'hybrid'
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                  : t.sourceType === 'A'
                                  ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';

                              return (
                                <div
                                  key={i}
                                  className="bg-ink-900/80 border border-ink-800/80 rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[10px] sm:text-[11px] font-black text-white">
                                        {t.category}:
                                      </span>
                                      <span className="text-[10px] sm:text-[11px] font-bold text-emerald-300 truncate">
                                        {t.label}
                                      </span>
                                    </div>
                                    <div className="mt-0.5 sm:mt-1">
                                      <span
                                        className={`inline-block text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md border ${badgeColor}`}
                                      >
                                        Kaynak: {t.sourceLabel}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex-shrink-0 text-right">
                                    <span className="inline-block bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black font-mono text-[10px] sm:text-[11px] px-2 py-0.5 rounded-lg">
                                      +%{t.addedPct}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:flex gap-2 pt-1 w-full">
                    <button
                      onClick={() => setShowRating(true)}
                      className="col-span-2 sm:flex-1 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-ink-950 font-black py-2.5 sm:py-3.5 rounded-xl shadow-lg shadow-gold-500/20 transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm"
                    >
                      <Star size={15} className="fill-current" /> İzledim & Puanla
                    </button>
                    <button
                      onClick={() => setDetailMovie(currentResult.movie)}
                      className="bg-ink-800 hover:bg-ink-700 text-emerald-300 border border-emerald-500/30 font-bold py-2.5 sm:py-3.5 px-4 sm:px-6 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-xs sm:text-sm"
                    >
                      <Eye size={14} /> Künye
                    </button>
                    <button
                      onClick={() => {
                        setStep('select');
                        setVariants([]);
                      }}
                      className="bg-ink-900 hover:bg-ink-800 text-ink-200 font-bold py-2.5 sm:py-3.5 px-4 sm:px-6 rounded-xl transition-colors border border-ink-700 flex items-center justify-center gap-1.5 text-xs sm:text-sm"
                    >
                      <RefreshCw size={13} /> Sentez
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showRating && currentResult && (
        <RatingModal
          title={currentResult.movie.title}
          subtitle={currentResult.movie.year ? `Çıkış Yılı: ${currentResult.movie.year}` : 'Film'}
          initialIsPastWatch={Boolean(currentResult.movie.isPastWatch || currentResult.movie.inPastQueue)}
          onRate={(rating, note, detailedRating, reviewTags, isPastWatch) => {
            watchMovie(currentResult.movie.id, rating, note, detailedRating, reviewTags, isPastWatch);
            setShowRating(false);
            onClose();
          }}
          onClose={() => setShowRating(false)}
        />
      )}

      {detailMovie && (
        <MediaDetailModal
          target={{ type: 'movie', data: detailMovie }}
          onClose={() => setDetailMovie(null)}
        />
      )}
    </div>
  );
}