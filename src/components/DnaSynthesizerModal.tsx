import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass } from '../lib/utils';
import RatingModal from './RatingModal';
import MediaDetailModal from './MediaDetailModal';
import type { Movie } from '../types';

interface DnaSynthesizerModalProps {
  onClose: () => void;
}

type Step = 'select' | 'synthesizing' | 'result';
type Slot = 'A' | 'B' | null;
type SelectionTab = 'library' | 'history';

interface SynthTrait {
  category: string;
  label: string;
  addedPct: number;
  sourceLabel: string;
  sourceType: 'both' | 'A' | 'B' | 'hybrid';
}

interface SynthVariant {
  movie: Movie;
  matchScore: number;
  parentAPct: number;
  parentBPct: number;
  traits: SynthTrait[];
}

const STOP_WORDS = new Set([
  'bir', 've', 'ile', 'için', 'bu', 'da', 'de', 'çok', 'daha', 'en', 'gibi', 'kadar',
  'olan', 'olarak', 'sonra', 'önce', 'kendi', 'ise', 'ya', 'veya', 'ama', 'fakat',
  'göre', 'tüm', 'bütün', 'her', 'hiç', 'bazı', 'biraz', 'şu', 'onu', 'bunu', 'ona',
  'film', 'filmi', 'filmde', 'hikaye', 'hikayesi', 'hayat', 'hayatı', 'yaşam', 'insan',
  'dünya', 'zaman', 'yılında', 'birlikte', 'ancak', 'karşı', 'arasında', 'üzerine',
  'başlar', 'olaylar', 'anlatıyor', 'anlatır', 'konu', 'ediyor', 'sonunda', 'içinde',
  'tarafından', 'büyük', 'küçük', 'yeni', 'eski', 'genç', 'adam', 'kadın', 'çocuk',
]);

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

  const movieA = useMemo(
    () => (movieAId ? data.movies.find((m) => m.id === movieAId) || null : null),
    [data.movies, movieAId]
  );
  const movieB = useMemo(
    () => (movieBId ? data.movies.find((m) => m.id === movieBId) || null : null),
    [data.movies, movieBId]
  );

  // KOLEKSİYON KURALI: Koleksiyondaki filmlerden sadece izlenmemiş EN ESKİ (sıradaki ilk) film sentezlenebilir
  const eligibleUnwatchedMovies = useMemo(() => {
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
        if (yearA !== yearB) return yearA - yearB;
        return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
      });
      if (sorted.length > 0) {
        sequentialCollectionMovies.push(sorted[0]);
      }
    });

    return [...standalone, ...sequentialCollectionMovies];
  }, [data.movies]);

  const historyMovies = useMemo(() => data.movies.filter((m) => m.watched), [data.movies]);

  const filteredMovies = useMemo(() => {
    const sourceList = selectionTab === 'history' ? historyMovies : data.movies;
    if (!search.trim()) return sourceList;
    const q = search.toLocaleLowerCase('tr-TR').trim();
    return sourceList.filter(
      (m) =>
        m.title.toLocaleLowerCase('tr-TR').includes(q) ||
        (m.directors && m.directors.some((d) => d.toLocaleLowerCase('tr-TR').includes(q))) ||
        (m.cast && m.cast.some((c) => c.toLocaleLowerCase('tr-TR').includes(q)))
    );
  }, [data.movies, historyMovies, selectionTab, search]);

  // Seçilen iki ebeveyn filmin kendi aralarındaki ortak genleri (Önizleme için)
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

  // Bir filmin TMDB üzerinden tam oyuncu (ilk 15 oyuncu) ve yönetmen verisini çeken yardımcı fonksiyon
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

      // Oyuncu eşleşmelerinin kaçmaması için ilk 15 oyuncuyu alıyoruz
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
    const highRated = historyMovies.filter((m) => (m.rating || 0) >= 8);
    const pool = highRated.length >= 2 ? highRated : data.movies;
    if (pool.length < 2) return;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setMovieAId(shuffled[0].id);
    setMovieBId(shuffled[1].id);
  };

  // =========================================================
  // SABİT ORANLI MATEMATİKSEL SENTEZ MOTORU
  // =========================================================
  const handleSynthesize = async () => {
    if (!movieA || !movieB || eligibleUnwatchedMovies.length === 0) return;
    setStep('synthesizing');

    // 1. Adım: Seçilen ebeveynlerin ve aday filmlerin oyuncu/yönetmen verisi eksikse TMDB'den çek
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
      // Sadece gerçekten oyuncu/yönetmen dizisi doluysa karşılaştırmaya al!
      const hasDirA = Array.isArray(activeA.directors) && activeA.directors.length > 0;
      const hasDirB = Array.isArray(activeB.directors) && activeB.directors.length > 0;
      const dirsA = new Set(hasDirA ? activeA.directors!.map((d) => d.trim()).filter(Boolean) : []);
      const dirsB = new Set(hasDirB ? activeB.directors!.map((d) => d.trim()).filter(Boolean) : []);

      const hasCastA = Array.isArray(activeA.cast) && activeA.cast.length > 0;
      const hasCastB = Array.isArray(activeB.cast) && activeB.cast.length > 0;
      const castA = new Set(hasCastA ? activeA.cast!.map((c) => c.trim()).filter(Boolean) : []);
      const castB = new Set(hasCastB ? activeB.cast!.map((c) => c.trim()).filter(Boolean) : []);

      const genresA = new Set((activeA.genres || []).map((g) => g.trim()).filter(Boolean));
      const genresB = new Set((activeB.genres || []).map((g) => g.trim()).filter(Boolean));

      const hasKwA = Array.isArray(activeA.keywords) && activeA.keywords.length > 0;
      const hasKwB = Array.isArray(activeB.keywords) && activeB.keywords.length > 0;
      const kwA = new Set(hasKwA ? activeA.keywords!.map((k) => k.trim().toLowerCase()).filter(Boolean) : []);
      const kwB = new Set(hasKwB ? activeB.keywords!.map((k) => k.trim().toLowerCase()).filter(Boolean) : []);

      const hasStA = Array.isArray(activeA.studios) && activeA.studios.length > 0;
      const hasStB = Array.isArray(activeB.studios) && activeB.studios.length > 0;
      const studiosA = new Set(hasStA ? activeA.studios!.map((s) => s.trim()).filter(Boolean) : []);
      const studiosB = new Set(hasStB ? activeB.studios!.map((s) => s.trim()).filter(Boolean) : []);

      const extractKeywordsFromText = (text?: string) => {
        const map = new Map<string, string>();
        if (!text) return map;
        const clean = text
          .toLocaleLowerCase('tr-TR')
          .replace(/[.,/#!$%^&*;:{}=\-_`~()'"?<>]/g, ' ');
        clean.split(/\s+/).forEach((w) => {
          if (w.length >= 5 && !STOP_WORDS.has(w)) {
            const stem = w.slice(0, 5);
            if (!map.has(stem)) map.set(stem, w);
          }
        });
        return map;
      };

      const stemsA = extractKeywordsFromText(activeA.overview);
      const stemsB = extractKeywordsFromText(activeB.overview);

      const yearA = parseInt(activeA.year || '0', 10);
      const yearB = parseInt(activeB.year || '0', 10);
      const decadeA = yearA > 1900 ? Math.floor(yearA / 10) * 10 : 0;
      const decadeB = yearB > 1900 ? Math.floor(yearB / 10) * 10 : 0;

      const rtA = activeA.runtime || 0;
      const rtB = activeB.runtime || 0;
      const avgParentRuntime =
        rtA > 0 && rtB > 0 ? Math.round((rtA + rtB) / 2) : rtA > 0 ? rtA : rtB > 0 ? rtB : 0;

      const scoredCandidates: (SynthVariant & { sortRank: number })[] = [];

      eligibleUnwatchedMovies.forEach((rawCand) => {
        const candidate = updatedMap.get(rawCand.id) || rawCand;
        if (candidate.id === activeA.id || candidate.id === activeB.id) return;

        let pctFromA = 0;
        let pctFromB = 0;
        const traits: SynthTrait[] = [];

        // ---------------------------------------------------------
        // 1. YÖNETMEN KARŞILAŞTIRMASI
        // KURAL: Aday filmde yönetmen verisi yoksa kesinlikle hiçbir şey alınmaz.
        // Sabit Oran: İki ebeveynde de aynı yönetmen varsa +%30, tek ebeveynde varsa +%25
        // ---------------------------------------------------------
        const hasCandDirs = Array.isArray(candidate.directors) && candidate.directors.length > 0;
        if (hasCandDirs && (hasDirA || hasDirB)) {
          const dirsBoth: string[] = [];
          const dirsOnlyA: string[] = [];
          const dirsOnlyB: string[] = [];

          candidate.directors!.forEach((d) => {
            const cleanD = d.trim();
            if (!cleanD) return;
            const inA = dirsA.has(cleanD);
            const inB = dirsB.has(cleanD);
            if (inA && inB) dirsBoth.push(cleanD);
            else if (inA) dirsOnlyA.push(cleanD);
            else if (inB) dirsOnlyB.push(cleanD);
          });

          if (dirsBoth.length > 0) {
            const pct = 30;
            pctFromA += 15;
            pctFromB += 15;
            traits.push({
              category: 'Ortak Yönetmen',
              label: dirsBoth.join(', '),
              addedPct: pct,
              sourceLabel: 'Her İki Filmle Ortak',
              sourceType: 'both',
            });
          } else {
            if (dirsOnlyA.length > 0) {
              const pct = 25;
              pctFromA += pct;
              traits.push({
                category: 'Aynı Yönetmen',
                label: dirsOnlyA.join(', '),
                addedPct: pct,
                sourceLabel: activeA.title,
                sourceType: 'A',
              });
            }
            if (dirsOnlyB.length > 0) {
              const pct = 25;
              pctFromB += pct;
              traits.push({
                category: 'Aynı Yönetmen',
                label: dirsOnlyB.join(', '),
                addedPct: pct,
                sourceLabel: activeB.title,
                sourceType: 'B',
              });
            }
          }
        }

        // ---------------------------------------------------------
        // 2. OYUNCU KARŞILAŞTIRMASI
        // KURAL: Aday filmde oyuncu verisi (cast) yoksa kesinlikle hiçbir şey alınmaz.
        // Sabit Oran:
        // - A filminde B oyuncusu + C filminde B oyuncusu + D filminde B oyuncusu = +%15 (Her İki Filmle Ortak Oyuncu)
        // - Tek ebeveynle ortak her oyuncu = +%10 (Maksimum toplam +%30)
        // ---------------------------------------------------------
        const hasCandCast = Array.isArray(candidate.cast) && candidate.cast.length > 0;
        if (hasCandCast && (hasCastA || hasCastB)) {
          const actorsBoth: string[] = [];
          const actorsOnlyA: string[] = [];
          const actorsOnlyB: string[] = [];

          candidate.cast!.forEach((actor) => {
            const cleanActor = actor.trim();
            if (!cleanActor) return;
            const inA = castA.has(cleanActor);
            const inB = castB.has(cleanActor);
            if (inA && inB) actorsBoth.push(cleanActor);
            else if (inA) actorsOnlyA.push(cleanActor);
            else if (inB) actorsOnlyB.push(cleanActor);
          });

          let castPctUsed = 0;

          if (actorsBoth.length > 0) {
            const pct = Math.min(30, actorsBoth.length * 15);
            castPctUsed += pct;
            pctFromA += pct / 2;
            pctFromB += pct / 2;
            traits.push({
              category: 'Ortak Oyuncu',
              label: actorsBoth.join(', '),
              addedPct: pct,
              sourceLabel: 'Her İki Filmde Oynuyor',
              sourceType: 'both',
            });
          }

          if (actorsOnlyA.length > 0 && castPctUsed < 30) {
            const pct = Math.min(30 - castPctUsed, actorsOnlyA.length * 10);
            castPctUsed += pct;
            pctFromA += pct;
            traits.push({
              category: 'Ortak Oyuncu',
              label: actorsOnlyA.join(', '),
              addedPct: pct,
              sourceLabel: activeA.title,
              sourceType: 'A',
            });
          }

          if (actorsOnlyB.length > 0 && castPctUsed < 30) {
            const pct = Math.min(30 - castPctUsed, actorsOnlyB.length * 10);
            castPctUsed += pct;
            pctFromB += pct;
            traits.push({
              category: 'Ortak Oyuncu',
              label: actorsOnlyB.join(', '),
              addedPct: pct,
              sourceLabel: activeB.title,
              sourceType: 'B',
            });
          }
        }

        // ---------------------------------------------------------
        // 3. TÜR KARŞILAŞTIRMASI
        // Sabit Oran: Her iki filmde de olan ortak tür başına +%8, tek filmle ortak tür başına +%5 (Maks +%25)
        // ---------------------------------------------------------
        const hasCandGenres = Array.isArray(candidate.genres) && candidate.genres.length > 0;
        if (hasCandGenres) {
          const genresBoth: string[] = [];
          const genresOnlyA: string[] = [];
          const genresOnlyB: string[] = [];

          candidate.genres.forEach((g) => {
            const cleanG = g.trim();
            if (!cleanG) return;
            const inA = genresA.has(cleanG);
            const inB = genresB.has(cleanG);
            if (inA && inB) genresBoth.push(cleanG);
            else if (inA) genresOnlyA.push(cleanG);
            else if (inB) genresOnlyB.push(cleanG);
          });

          let genrePctUsed = 0;

          if (genresBoth.length > 0) {
            const pct = Math.min(24, genresBoth.length * 8);
            genrePctUsed += pct;
            pctFromA += pct / 2;
            pctFromB += pct / 2;
            traits.push({
              category: 'Ortak Tür',
              label: genresBoth.join(', '),
              addedPct: pct,
              sourceLabel: 'Her İki Filmle Ortak',
              sourceType: 'both',
            });
          }

          if (genresOnlyA.length > 0 && genresOnlyB.length > 0 && genrePctUsed < 25) {
            const pct = Math.min(25 - genrePctUsed, (genresOnlyA.length + genresOnlyB.length) * 5);
            genrePctUsed += pct;
            pctFromA += pct / 2;
            pctFromB += pct / 2;
            traits.push({
              category: 'Çapraz Tür',
              label: `${genresOnlyA.join(', ')} × ${genresOnlyB.join(', ')}`,
              addedPct: pct,
              sourceLabel: '1. ve 2. Film Melezi',
              sourceType: 'hybrid',
            });
          } else if (genresOnlyA.length > 0 && genrePctUsed < 25) {
            const pct = Math.min(25 - genrePctUsed, genresOnlyA.length * 5);
            genrePctUsed += pct;
            pctFromA += pct;
            traits.push({
              category: 'Aynı Tür',
              label: genresOnlyA.join(', '),
              addedPct: pct,
              sourceLabel: activeA.title,
              sourceType: 'A',
            });
          } else if (genresOnlyB.length > 0 && genrePctUsed < 25) {
            const pct = Math.min(25 - genrePctUsed, genresOnlyB.length * 5);
            genrePctUsed += pct;
            pctFromB += pct;
            traits.push({
              category: 'Aynı Tür',
              label: genresOnlyB.join(', '),
              addedPct: pct,
              sourceLabel: activeB.title,
              sourceType: 'B',
            });
          }
        }

        // ---------------------------------------------------------
        // 4. ANAHTAR KELİME / TEMA KARŞILAŞTIRMASI
        // Sabit Oran: İki ebeveynde de olan tema +%6, tek ebeveynle ortak tema +%4 (Maks +%20)
        // ---------------------------------------------------------
        const hasCandKw = Array.isArray(candidate.keywords) && candidate.keywords.length > 0;
        if (hasCandKw && (hasKwA || hasKwB)) {
          const kwsBoth: string[] = [];
          const kwsOnlyA: string[] = [];
          const kwsOnlyB: string[] = [];

          candidate.keywords!.forEach((k) => {
            const cleanK = k.trim().toLowerCase();
            if (!cleanK) return;
            const inA = kwA.has(cleanK);
            const inB = kwB.has(cleanK);
            if (inA && inB) kwsBoth.push(k.trim());
            else if (inA) kwsOnlyA.push(k.trim());
            else if (inB) kwsOnlyB.push(k.trim());
          });

          const rawKwPct = kwsBoth.length * 6 + (kwsOnlyA.length + kwsOnlyB.length) * 4;
          const kwPct = Math.min(20, rawKwPct);
          if (kwPct > 0) {
            const allKws = [...kwsBoth, ...kwsOnlyA, ...kwsOnlyB];
            const shareA = kwsBoth.length * 3 + kwsOnlyA.length * 4;
            const shareB = kwsBoth.length * 3 + kwsOnlyB.length * 4;
            const sumShare = shareA + shareB || 1;
            pctFromA += Math.round(kwPct * (shareA / sumShare));
            pctFromB += kwPct - Math.round(kwPct * (shareA / sumShare));

            traits.push({
              category: 'Ortak Tema',
              label: allKws.slice(0, 4).join(', '),
              addedPct: kwPct,
              sourceLabel:
                kwsBoth.length > 0
                  ? 'Her İki Filmle Ortak'
                  : kwsOnlyA.length > 0 && kwsOnlyB.length > 0
                  ? '1. ve 2. Film'
                  : kwsOnlyA.length > 0
                  ? activeA.title
                  : activeB.title,
              sourceType: kwsBoth.length > 0 ? 'both' : kwsOnlyA.length > 0 ? 'A' : 'B',
            });
          }
        }

        // ---------------------------------------------------------
        // 5. KONU ÖZETİ KELİME KESİŞİMİ
        // Sabit Oran: Her ortak kavram +%3 (Maks +%12)
        // ---------------------------------------------------------
        if (candidate.overview && (activeA.overview || activeB.overview)) {
          const candStems = extractKeywordsFromText(candidate.overview);
          const matchedWords: string[] = [];
          let wA = 0;
          let wB = 0;

          candStems.forEach((origWord, stem) => {
            const inA = stemsA.has(stem);
            const inB = stemsB.has(stem);
            if (inA || inB) {
              matchedWords.push(origWord);
              if (inA) wA++;
              if (inB) wB++;
            }
          });

          if (matchedWords.length > 0) {
            const storyPct = Math.min(12, matchedWords.length * 3);
            const wSum = wA + wB || 1;
            pctFromA += Math.round(storyPct * (wA / wSum));
            pctFromB += storyPct - Math.round(storyPct * (wA / wSum));

            traits.push({
              category: 'Konu Benzerliği',
              label: matchedWords.slice(0, 4).join(', '),
              addedPct: storyPct,
              sourceLabel: wA > 0 && wB > 0 ? 'Her İki Film' : wA > 0 ? activeA.title : activeB.title,
              sourceType: wA > 0 && wB > 0 ? 'both' : wA > 0 ? 'A' : 'B',
            });
          }
        }

        // ---------------------------------------------------------
        // 6. KOLEKSİYON / SERİ BAĞI (Sabit Oran: +%15)
        // ---------------------------------------------------------
        if (candidate.collectionId) {
          const inColA = candidate.collectionId === activeA.collectionId;
          const inColB = candidate.collectionId === activeB.collectionId;
          if (inColA || inColB) {
            const colPct = 15;
            if (inColA && inColB) {
              pctFromA += 7.5;
              pctFromB += 7.5;
            } else if (inColA) {
              pctFromA += colPct;
            } else {
              pctFromB += colPct;
            }
            traits.push({
              category: 'Koleksiyon Serisi',
              label: 'Serinin Sıradaki İlk Filmi',
              addedPct: colPct,
              sourceLabel: inColA ? activeA.title : activeB.title,
              sourceType: inColA && inColB ? 'both' : inColA ? 'A' : 'B',
            });
          }
        }

        // ---------------------------------------------------------
        // 7. YAPIMCI STÜDYO (Sabit Oran: +%5, 2+ Stüdyo +%8)
        // ---------------------------------------------------------
        const hasCandSt = Array.isArray(candidate.studios) && candidate.studios.length > 0;
        if (hasCandSt && (hasStA || hasStB)) {
          const matchedStudios: string[] = [];
          let stInA = false;
          let stInB = false;

          candidate.studios!.forEach((s) => {
            const cleanS = s.trim();
            if (!cleanS) return;
            if (studiosA.has(cleanS)) {
              matchedStudios.push(cleanS);
              stInA = true;
            }
            if (studiosB.has(cleanS)) {
              if (!matchedStudios.includes(cleanS)) matchedStudios.push(cleanS);
              stInB = true;
            }
          });

          if (matchedStudios.length > 0) {
            const stPct = matchedStudios.length >= 2 ? 8 : 5;
            if (stInA && stInB) {
              pctFromA += stPct / 2;
              pctFromB += stPct / 2;
            } else if (stInA) {
              pctFromA += stPct;
            } else {
              pctFromB += stPct;
            }
            traits.push({
              category: 'Aynı Stüdyo',
              label: matchedStudios.slice(0, 2).join(', '),
              addedPct: stPct,
              sourceLabel: stInA && stInB ? 'Her İki Film' : stInA ? activeA.title : activeB.title,
              sourceType: stInA && stInB ? 'both' : stInA ? 'A' : 'B',
            });
          }
        }

        // ---------------------------------------------------------
        // 8. DÖNEM (ON YIL) UYUMU (Sabit Oran: +%5)
        // ---------------------------------------------------------
        const candYear = parseInt(candidate.year || '0', 10);
        const candDecade = candYear > 1900 ? Math.floor(candYear / 10) * 10 : 0;
        if (candDecade > 0 && (candDecade === decadeA || candDecade === decadeB)) {
          const decPct = 5;
          if (candDecade === decadeA && candDecade === decadeB) {
            pctFromA += 2.5;
            pctFromB += 2.5;
          } else if (candDecade === decadeA) {
            pctFromA += decPct;
          } else {
            pctFromB += decPct;
          }
          traits.push({
            category: 'Aynı Dönem',
            label: `${candDecade}'ler Sineması (${candidate.year})`,
            addedPct: decPct,
            sourceLabel:
              candDecade === decadeA && candDecade === decadeB
                ? 'Her İki Film'
                : candDecade === decadeA
                ? activeA.title
                : activeB.title,
            sourceType:
              candDecade === decadeA && candDecade === decadeB
                ? 'both'
                : candDecade === decadeA
                ? 'A'
                : 'B',
          });
        }

        // ---------------------------------------------------------
        // 9. SÜRE & TEMPO UYUMU (Sabit Oran: ±15 dk içindeyse +%5)
        // ---------------------------------------------------------
        if (candidate.runtime && candidate.runtime > 0 && avgParentRuntime > 0) {
          const diffAvg = Math.abs(candidate.runtime - avgParentRuntime);
          if (diffAvg <= 15) {
            const rtPct = 5;
            pctFromA += 2.5;
            pctFromB += 2.5;
            traits.push({
              category: 'Süre Uyumu',
              label: `${candidate.runtime} dk (Ebeveyn Ort: ${avgParentRuntime} dk)`,
              addedPct: rtPct,
              sourceLabel: 'Ortak Tempo',
              sourceType: 'both',
            });
          }
        }

        // ---------------------------------------------------------
        // 10. ÇİFT EBEVEYN MELEZ SENTEZ BONUSU (Sabit Oran: +%5)
        // Hem 1. filmden hem 2. filmden en az %5'lik özellik taşıyorsa
        // ---------------------------------------------------------
        const isTrueHybrid = pctFromA >= 5 && pctFromB >= 5;
        if (isTrueHybrid) {
          pctFromA += 2.5;
          pctFromB += 2.5;
          traits.push({
            category: 'Melez Sentez',
            label: 'Hem 1. Hem 2. Filmden Ortak Gen Taşıyor',
            addedPct: 5,
            sourceLabel: 'A × B Sinerjisi',
            sourceType: 'hybrid',
          });
        }

        // Sadece Kaos Modu seçiliyse deneysel mutasyon ekle
        if (mutationRate === 2) {
          const chaosBonus = Math.floor(Math.random() * 8) + 3;
          pctFromA += chaosBonus / 2;
          pctFromB += chaosBonus / 2;
          traits.push({
            category: 'Kaos Mutasyonu',
            label: 'Deneysel Genetik Sapma',
            addedPct: chaosBonus,
            sourceLabel: 'Kaos Modu',
            sourceType: 'hybrid',
          });
        }

        // TOPLAM UYUM = Kazanılan sabit yüzdelerin birebir toplamı!
        const exactSumPct = traits.reduce((sum, t) => sum + t.addedPct, 0);
        if (exactSumPct <= 0) return;

        const matchScore = Math.min(100, exactSumPct);

        const totalParentShare = pctFromA + pctFromB || 1;
        const parentAPct = Math.round((pctFromA / totalParentShare) * 100);
        const parentBPct = 100 - parentAPct;

        const hybridRankBonus = isTrueHybrid && mutationRate === 1 ? 8 : 0;
        const sortRank = matchScore + hybridRankBonus;

        const sortedTraits = [...traits].sort((a, b) => b.addedPct - a.addedPct);

        scoredCandidates.push({
          movie: candidate,
          matchScore,
          parentAPct,
          parentBPct,
          traits: sortedTraits,
          sortRank,
        });
      });

      scoredCandidates.sort((a, b) => b.sortRank - a.sortRank || b.matchScore - a.matchScore);

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
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-5 bg-black/85 backdrop-blur-xl animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-ink-950/95 border border-emerald-500/30 rounded-[2rem] w-full max-w-4xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.9)] flex flex-col max-h-[92vh]"
      >
        {/* SENTEZ SONUCU FLU ARKA PLAN ATMOSFERİ */}
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

        {/* ÜST HEADER */}
        <div className="relative z-10 flex items-center justify-between px-5 sm:px-7 py-4 border-b border-ink-800/70 bg-gradient-to-r from-emerald-950/50 via-ink-900/90 to-ink-950">
          <div className="flex items-center gap-3">
            {selectingSlot ? (
              <button
                onClick={() => setSelectingSlot(null)}
                className="p-2 -ml-2 rounded-xl bg-ink-800/80 hover:bg-ink-700 text-ink-200 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-500/10 flex items-center justify-center border border-emerald-500/40 shadow-lg shadow-emerald-500/10">
                <Dna size={22} className="text-emerald-400" />
              </div>
            )}
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Film DNA Sentezleyici
              </h2>
              <p className="text-[11px] sm:text-xs text-emerald-400/90 font-medium">
                Sabit Oranlı Genetik Çaprazlama Laboratuvarı
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFormulaTable(!showFormulaTable)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                showFormulaTable
                  ? 'bg-emerald-500 text-ink-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                  : 'bg-ink-900/90 text-emerald-300 border-emerald-500/30 hover:bg-ink-800'
              }`}
              title="Sabit Matematiksel Oranları Gör"
            >
              <Calculator size={14} /> <span className="hidden sm:inline">Sabit Oranlar</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-ink-900 hover:bg-ink-800 text-ink-400 hover:text-white border border-ink-800 flex items-center justify-center transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* SABİT MATEMATİKSEL ORAN TABLOSU */}
        {showFormulaTable && (
          <div className="relative z-10 bg-ink-900/95 border-b border-emerald-500/30 px-6 py-4 text-xs space-y-2.5 animate-fade-in">
            <div className="font-black text-emerald-400 uppercase tracking-wider flex items-center justify-between">
              <span>📐 Sabit Genetik Uyum Oranları (Kazanılan Puanların Toplamı = % Uyum)</span>
              <button
                onClick={() => setShowFormulaTable(false)}
                className="text-ink-400 hover:text-white font-bold"
              >
                Kapat
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-ink-200">
              <div className="bg-ink-950/90 p-2.5 rounded-xl border border-ink-800">
                🎬 <strong>Aynı Yönetmen:</strong>{' '}
                <span className="text-emerald-400 font-black">+%25</span> (İkisinde de ortaksa:{' '}
                <span className="text-emerald-400 font-black">+%30</span>)
              </div>
              <div className="bg-ink-950/90 p-2.5 rounded-xl border border-ink-800">
                🎭 <strong>Ortak Oyuncu:</strong> Oyuncu başı{' '}
                <span className="text-emerald-400 font-black">+%10</span> (İkisinde de oynuyorsa:{' '}
                <span className="text-emerald-400 font-black">+%15</span>)
              </div>
              <div className="bg-ink-950/90 p-2.5 rounded-xl border border-ink-800">
                🏷️ <strong>Ortak Tür:</strong> Tür başı{' '}
                <span className="text-emerald-400 font-black">+%5</span> (İkisinde de ortaksa:{' '}
                <span className="text-emerald-400 font-black">+%8</span>)
              </div>
              <div className="bg-ink-950/90 p-2.5 rounded-xl border border-ink-800">
                🔑 <strong>Ortak Tema:</strong> Kelime başı{' '}
                <span className="text-emerald-400 font-black">+%4</span> (İkisinde de varsa:{' '}
                <span className="text-emerald-400 font-black">+%6</span>)
              </div>
              <div className="bg-ink-950/90 p-2.5 rounded-xl border border-ink-800">
                📦 <strong>Aynı Koleksiyon:</strong>{' '}
                <span className="text-emerald-400 font-black">+%15</span> (Sadece sıradaki en eski film)
              </div>
              <div className="bg-ink-950/90 p-2.5 rounded-xl border border-ink-800">
                ⏱️ <strong>Stüdyo / Dönem / Süre:</strong> Her biri{' '}
                <span className="text-emerald-400 font-black">+%5</span>
              </div>
            </div>
          </div>
        )}

        {/* ANA İÇERİK GÖVDESİ */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-7 custom-scrollbar">
          {/* =========================================================
              DURUM 1: EBEVEYN FİLM SEÇİM LİSTESİ
              ========================================================= */}
          {selectingSlot && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Film adı, yönetmen veya oyuncu ara..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-ink-900 border border-ink-700/80 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-ink-500 focus:outline-none focus:border-emerald-500/60 transition-all"
                  />
                </div>
                <div className="flex bg-ink-900 p-1 rounded-xl border border-ink-800 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectionTab('library')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                      selectionTab === 'library'
                        ? 'bg-emerald-500 text-ink-950 shadow-sm'
                        : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Tüm Kütüphane ({data.movies.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectionTab('history')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                      selectionTab === 'history'
                        ? 'bg-emerald-500 text-ink-950 shadow-sm'
                        : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    İzlenenler ({historyMovies.length})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
                {filteredMovies.map((m) => {
                  const hasCast = Array.isArray(m.cast) && m.cast.length > 0;
                  const hasDirs = Array.isArray(m.directors) && m.directors.length > 0;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleSelectMovie(m)}
                      className="flex items-center gap-3.5 p-3 rounded-2xl border border-ink-800/90 bg-ink-900/50 hover:bg-ink-800/80 hover:border-emerald-500/40 transition-all text-left group relative overflow-hidden"
                    >
                      <div className="w-14 aspect-[2/3] bg-ink-950 rounded-xl overflow-hidden flex-shrink-0 border border-ink-700/60 shadow-md">
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
                          {m.watched && m.rating !== null && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-black flex-shrink-0 ${ratingBgClass(
                                m.rating
                              )}`}
                            >
                              ★ {m.rating}
                            </span>
                          )}
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

          {/* =========================================================
              DURUM 2: MODERN EBEVEYN SEÇİM VE SENTEZ HAZIRLIK EKRANI
              ========================================================= */}
          {!selectingSlot && step === 'select' && (
            <div className="space-y-6 animate-fade-in">
              {eligibleUnwatchedMovies.length === 0 ? (
                <div className="text-center py-12">
                  <Beaker size={48} className="mx-auto text-ink-600 mb-4" />
                  <h3 className="text-lg font-bold text-ink-200">Bekleyen Film Bulunamadı</h3>
                  <p className="text-sm text-ink-500 mt-2 max-w-md mx-auto">
                    Sentezleme yapabilmek için kütüphanende izlenmemiş (bekleyen) filmler olması gerekiyor.
                  </p>
                </div>
              ) : (
                <>
                  {/* Üst Bilgi & Hızlı Seçim Barı */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-ink-900/70 border border-ink-800 rounded-2xl p-4">
                    <div className="text-xs text-ink-300 leading-relaxed text-center sm:text-left">
                      Çaprazlamak istediğin iki filmi seç. Ortak <strong>oyuncular, yönetmen, tür, anahtar kelime ve dönem</strong> sabit matematiksel oranlarla toplanarak en uyumlu film sentezlenir.
                    </div>
                    {data.movies.length >= 2 && (
                      <button
                        type="button"
                        onClick={handleRandomPair}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-black bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 px-4 py-2.5 rounded-xl transition-all hover:scale-105"
                      >
                        <Shuffle size={14} /> Favorilerden Rastgele Doldur
                      </button>
                    )}
                  </div>

                  {/* EBEVEYN A VE EBEVEYN B MODERN SİNEMA KARTLARI */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          className={`relative rounded-3xl border-2 p-4 transition-all cursor-pointer group overflow-hidden ${
                            movie
                              ? `bg-ink-900/80 ${accent} shadow-xl`
                              : 'border-dashed border-ink-700 bg-ink-900/30 hover:border-emerald-500/40 hover:bg-ink-900/60 min-h-[200px] flex items-center justify-center'
                          }`}
                        >
                          {movie ? (
                            <div className="flex gap-4 items-start">
                              {/* Sol: Net 2:3 Poster */}
                              <div className="w-24 sm:w-28 aspect-[2/3] rounded-2xl overflow-hidden bg-ink-950 border border-ink-700/80 flex-shrink-0 shadow-lg relative">
                                {movie.posterUrl ? (
                                  <img
                                    src={movie.posterUrl}
                                    alt={movie.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-ink-600">
                                    <Film size={28} />
                                  </div>
                                )}
                                {movie.rating !== null && (
                                  <div
                                    className={`absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-md font-black shadow ${ratingBgClass(
                                      movie.rating
                                    )}`}
                                  >
                                    ★ {movie.rating}
                                  </div>
                                )}
                              </div>

                              {/* Sağ: Net Künye Detayları */}
                              <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[144px]">
                                <div>
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span
                                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeBg}`}
                                    >
                                      {label}
                                    </span>
                                    <span className="text-[11px] font-bold text-ink-400 group-hover:text-white transition-colors">
                                      Değiştir ↻
                                    </span>
                                  </div>

                                  <h3 className="text-base sm:text-lg font-black text-white leading-snug truncate">
                                    {movie.title}
                                  </h3>

                                  <div className="text-xs text-ink-400 mt-1 font-medium">
                                    {movie.year || 'Yıl yok'}
                                    {movie.runtime ? ` · ${movie.runtime} dk` : ''}
                                  </div>

                                  {/* Sadece yönetmen verisi varsa gösterilir */}
                                  {hasDirs && (
                                    <div className="text-xs text-emerald-300 font-bold mt-2 truncate flex items-center gap-1.5">
                                      <User size={13} className="flex-shrink-0" />
                                      <span className="truncate">{movie.directors!.join(', ')}</span>
                                    </div>
                                  )}

                                  {/* Sadece oyuncu verisi varsa gösterilir */}
                                  {hasCast && (
                                    <div className="text-[11px] text-ink-300 mt-1 line-clamp-2 leading-relaxed">
                                      <Users size={12} className="inline mr-1 text-gold-400" />
                                      {movie.cast!.slice(0, 4).join(', ')}
                                    </div>
                                  )}
                                </div>

                                {movie.genres.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2.5">
                                    {movie.genres.slice(0, 3).map((g) => (
                                      <span
                                        key={g}
                                        className="text-[10px] font-bold bg-ink-950 text-ink-300 px-2 py-0.5 rounded-md border border-ink-800"
                                      >
                                        {g}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center text-center p-4">
                              <div className="w-14 h-14 rounded-2xl bg-ink-800/80 border border-ink-700 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:border-emerald-500/50 transition-all">
                                <Plus size={26} className="text-ink-400 group-hover:text-emerald-400" />
                              </div>
                              <span className="text-sm font-black text-ink-200">{label} Seç</span>
                              <span className="text-xs text-ink-500 mt-1">
                                Kütüphanenden veya izleme geçmişinden bir film ekle
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* İKİ EBEVEYN ARASINDA TESPİT EDİLEN ORTAK GENLER ÖNİZLEMESİ */}
                  {movieA && movieB && (
                    <div className="bg-emerald-950/25 border border-emerald-500/30 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 animate-fade-in">
                      <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0">
                        <Dna size={15} /> Seçilen İki Filmin Ortak Genleri:
                      </span>
                      {sharedParentGenes.length > 0 ? (
                        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5">
                          {sharedParentGenes.map((badge, i) => (
                            <span
                              key={i}
                              className="text-xs font-bold bg-ink-950/90 text-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-500/30"
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-ink-400">
                          İki film tamamen farklı dünyalardan — çapraz melezleme yapılacak!
                        </span>
                      )}
                    </div>
                  )}

                  {/* SENTEZ MODU SEÇİMİ */}
                  <div className="bg-ink-900/60 border border-ink-800 rounded-2xl p-4 space-y-2.5">
                    <div className="flex justify-between text-xs font-bold text-ink-400 uppercase tracking-wider">
                      <span>Sentezleme Stratejisi</span>
                      <span className="text-emerald-400">
                        {mutationRate === 0
                          ? 'Safkan Matematik (%0 Rastgelelik)'
                          : mutationRate === 1
                          ? 'Melez A×B Öncelikli (%0 Rastgelelik)'
                          : 'Kaos Modu (+%3-10 Mutasyon)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { val: 0, title: '🛡️ Safkan', sub: 'En yüksek matematiksel toplam' },
                        { val: 1, title: '⚖️ Melez (A×B)', sub: 'Her iki filmden de gen alanlar' },
                        { val: 2, title: '⚡ Kaos Modu', sub: 'Deneysel sürpriz varyasyon' },
                      ].map((m) => (
                        <button
                          key={m.val}
                          type="button"
                          onClick={() => setMutationRate(m.val)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            mutationRate === m.val
                              ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md'
                              : 'bg-ink-950/60 border-ink-800 text-ink-400 hover:bg-ink-800'
                          }`}
                        >
                          <div className="text-xs font-black">{m.title}</div>
                          <div className="text-[10px] opacity-75 mt-0.5">{m.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={!movieA || !movieB}
                    onClick={handleSynthesize}
                    className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-ink-950 font-black px-8 py-4 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-99 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2.5 text-sm sm:text-base"
                  >
                    <Beaker size={20} />
                    <span>DNA Sentezini Başlat ({eligibleUnwatchedMovies.length} Uygun Aday)</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* =========================================================
              DURUM 3: SENTEZ & KÜNYE TAMAMLAMA ANİMASYONU
              ========================================================= */}
          {!selectingSlot && step === 'synthesizing' && (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in space-y-6">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin" />
                <Dna size={40} className="text-emerald-400 animate-pulse" />
              </div>
              <div className="text-center space-y-2 max-w-md">
                <h3 className="text-xl font-black text-white tracking-wider uppercase">
                  Genetik Matris Hesaplanıyor...
                </h3>
                <p className="text-xs sm:text-sm text-emerald-400 font-medium">
                  {syncStatusText || `${movieA?.title} × ${movieB?.title} çaprazlanıyor...`}
                </p>
              </div>
            </div>
          )}

          {/* =========================================================
              DURUM 4: YENİ GÖSTERİŞLİ SENTEZ SONUÇ VİTRİNİ
              ========================================================= */}
          {!selectingSlot && step === 'result' && (
            <div className="animate-fade-in-up space-y-5">
              {!currentResult ? (
                <div className="text-center py-12 space-y-4 bg-ink-900/50 rounded-3xl border border-ink-800 p-6">
                  <Beaker size={48} className="mx-auto text-ink-500" />
                  <h3 className="text-lg font-black text-white">Ortak Genetik Özellik Bulunamadı</h3>
                  <p className="text-xs sm:text-sm text-ink-400 max-w-md mx-auto">
                    Seçtiğin iki filmle bekleyen filmlerin arasında ortak yönetmen, oyuncu, tür veya tema kesişimi çıkmadı.
                  </p>
                  <button
                    onClick={() => setStep('select')}
                    className="bg-emerald-500 hover:bg-emerald-400 text-ink-950 font-black px-6 py-3 rounded-xl text-xs transition-all"
                  >
                    Farklı Filmler Seç
                  </button>
                </div>
              ) : (
                <>
                  {/* ÜST BAR: VARYANT SEÇİCİ SEKMELER */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider w-fit">
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      Sentezlenen Film Bulundu
                    </div>

                    {variants.length > 1 && (
                      <div className="flex items-center gap-1.5 bg-ink-900/90 p-1.5 rounded-2xl border border-ink-800">
                        {variants.map((v, idx) => (
                          <button
                            key={v.movie.id}
                            type="button"
                            onClick={() => setActiveVariantIdx(idx)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
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

                  {/* EBEVEYN KALITIM KÖPRÜSÜ (MİNİ POSTERLİ ÇİFT RENKLİ BARI) */}
                  {movieA && movieB && (
                    <div className="bg-ink-900/80 border border-ink-800 rounded-2xl p-3.5 flex items-center gap-3.5 shadow-lg">
                      {movieA.posterUrl && (
                        <img
                          src={movieA.posterUrl}
                          alt={movieA.title}
                          className="w-9 h-12 rounded-lg object-cover border border-emerald-500/50 flex-shrink-0 hidden sm:block"
                        />
                      )}
                      <div className="flex-1 space-y-1.5">
                        <div className="flex justify-between text-xs font-black">
                          <span className="text-emerald-400 truncate max-w-[46%]">
                            {movieA.title} (%{currentResult.parentAPct})
                          </span>
                          <span className="text-cyan-400 truncate max-w-[46%] text-right">
                            (%{currentResult.parentBPct}) {movieB.title}
                          </span>
                        </div>
                        <div className="h-2.5 w-full bg-ink-950 rounded-full overflow-hidden flex border border-ink-800 p-0.5 gap-0.5">
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
                          className="w-9 h-12 rounded-lg object-cover border border-cyan-500/50 flex-shrink-0 hidden sm:block"
                        />
                      )}
                    </div>
                  )}

                  {/* ANA SENTEZ VİTRİN KARTI (POSTER ASLA SÜNDÜRÜLMEZ - SABİT 2:3 ORAN) */}
                  <div className="bg-ink-900/75 backdrop-blur-md border border-emerald-500/35 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col lg:flex-row items-center lg:items-start gap-6">
                    {/* SOL: KUSURSUZ 2:3 POSTER VİTRİNİ */}
                    <div className="flex flex-col items-center gap-3 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setDetailMovie(currentResult.movie)}
                        title="Tam Sinema Kartını Aç"
                        className="w-48 sm:w-56 aspect-[2/3] rounded-2xl overflow-hidden bg-ink-950 border-2 border-emerald-500/50 shadow-[0_15px_40px_rgba(0,0,0,0.8)] relative group cursor-pointer"
                      >
                        {currentResult.movie.posterUrl ? (
                          <img
                            src={currentResult.movie.posterUrl}
                            alt={currentResult.movie.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-ink-600 gap-2">
                            <ImageIcon size={42} />
                            <span className="text-xs">Afiş Yok</span>
                          </div>
                        )}

                        {/* Hover Sinema Kartı İpucu */}
                        <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                          <div className="w-11 h-11 rounded-full bg-emerald-500 text-ink-950 flex items-center justify-center shadow-lg">
                            <Eye size={20} />
                          </div>
                          <span className="text-xs font-black text-white uppercase tracking-wider">
                            Sinema Kartını Gör
                          </span>
                        </div>
                      </button>

                      {/* Poster Altı Net Uyum Göstergesi */}
                      <div className="w-48 sm:w-56 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 rounded-2xl py-2.5 px-4 text-center shadow-lg">
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                          Matematiksel Uyum
                        </div>
                        <div className="text-2xl font-black text-white mt-0.5">
                          %{currentResult.matchScore}
                        </div>
                      </div>
                    </div>

                    {/* SAĞ: FİLM DETAYLARI VE SABİT ORANLI GENETİK TABLO */}
                    <div className="flex-1 min-w-0 w-full flex flex-col justify-between text-center lg:text-left">
                      <div>
                        {currentResult.movie.collectionId && (
                          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gold-400 bg-gold-500/10 border border-gold-500/30 px-3 py-0.5 rounded-full mb-2">
                            <Layers size={12} />{' '}
                            {
                              data.collections.find((c) => c.id === currentResult.movie.collectionId)
                                ?.name
                            }{' '}
                            (Sıradaki İlk Film)
                          </div>
                        )}

                        <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                          {currentResult.movie.title}
                        </h3>

                        {/* Yıl, Süre, Yönetmen ve Tür Rozetleri */}
                        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-2.5 text-xs text-ink-200 font-semibold">
                          {currentResult.movie.year && (
                            <span className="flex items-center gap-1 bg-ink-950/90 px-2.5 py-1 rounded-lg border border-ink-800">
                              <Calendar size={13} className="text-emerald-400" />{' '}
                              {currentResult.movie.year}
                            </span>
                          )}
                          {currentResult.movie.runtime && (
                            <span className="flex items-center gap-1 bg-ink-950/90 px-2.5 py-1 rounded-lg border border-ink-800">
                              <Clock size={13} className="text-emerald-400" />{' '}
                              {currentResult.movie.runtime} dk
                            </span>
                          )}
                          {Array.isArray(currentResult.movie.directors) &&
                            currentResult.movie.directors.length > 0 && (
                              <span className="flex items-center gap-1 bg-emerald-500/15 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/30 font-bold">
                                <User size={13} /> {currentResult.movie.directors.join(', ')}
                              </span>
                            )}
                        </div>

                        {/* Sadece oyuncu verisi varsa gösterilir */}
                        {Array.isArray(currentResult.movie.cast) &&
                          currentResult.movie.cast.length > 0 && (
                            <div className="mt-2.5 text-xs text-ink-300 bg-ink-950/60 px-3 py-2 rounded-xl border border-ink-800/80 text-left">
                              <span className="font-black text-gold-400 mr-1.5">🎭 Oyuncular:</span>
                              {currentResult.movie.cast.slice(0, 6).join(', ')}
                            </div>
                          )}

                        {/* Konu Özeti */}
                        {currentResult.movie.overview && (
                          <p className="mt-2.5 text-xs text-ink-300 leading-relaxed line-clamp-2 text-left">
                            {currentResult.movie.overview}
                          </p>
                        )}

                        {/* İzleme & Fragman Linkleri */}
                        <div className="flex items-center justify-center lg:justify-start gap-1.5 flex-wrap my-3.5">
                          {getWatchLinks(currentResult.movie).map((link, idx) => {
                            const Icon = link.icon;
                            if (link.isTrailer) {
                              return (
                                <a
                                  key={idx}
                                  href={link.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow"
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
                                className="inline-flex items-center gap-1.5 bg-ink-800 hover:bg-ink-700 text-gold-400 border border-gold-500/30 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
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

                        {/* SABİT ORANLI GENETİK EŞLEŞME MATRİSİ */}
                        <div className="bg-ink-950/85 border border-ink-800 rounded-2xl p-4 space-y-2.5 text-left">
                          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-ink-400 border-b border-ink-800 pb-2">
                            <span>Eşleşen Kriterler & Kaynakları</span>
                            <span className="text-emerald-400 font-mono">
                              Toplam: %{currentResult.matchScore}
                            </span>
                          </div>

                          <div className="space-y-2">
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
                                  className="bg-ink-900/80 border border-ink-800/80 rounded-xl p-2.5 flex items-center justify-between gap-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-black text-white">
                                        {t.category}:
                                      </span>
                                      <span className="text-xs font-bold text-emerald-300 truncate">
                                        {t.label}
                                      </span>
                                    </div>
                                    <div className="mt-1">
                                      <span
                                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeColor}`}
                                      >
                                        Kaynak: {t.sourceLabel}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex-shrink-0 text-right">
                                    <span className="inline-block bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black font-mono text-xs px-2.5 py-1 rounded-lg">
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

                  {/* ALT AKSİYON BUTONLARI */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-1 w-full">
                    <button
                      onClick={() => setShowRating(true)}
                      className="flex-1 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-ink-950 font-black py-3.5 rounded-xl shadow-lg shadow-gold-500/20 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
                    >
                      <Star size={17} className="fill-current" /> İzle ve Puanla
                    </button>
                    <button
                      onClick={() => setDetailMovie(currentResult.movie)}
                      className="sm:w-auto px-6 bg-ink-800 hover:bg-ink-700 text-emerald-300 border border-emerald-500/30 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm"
                    >
                      <Eye size={16} /> Sinema Kartı
                    </button>
                    <button
                      onClick={() => {
                        setStep('select');
                        setVariants([]);
                      }}
                      className="sm:w-auto px-6 bg-ink-900 hover:bg-ink-800 text-ink-200 font-bold py-3.5 rounded-xl transition-colors border border-ink-700 flex items-center justify-center gap-2 text-xs sm:text-sm"
                    >
                      <RefreshCw size={15} /> Yeni Sentez
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PUANLAMA MODALI */}
      {showRating && currentResult && (
        <RatingModal
          title={currentResult.movie.title}
          subtitle={currentResult.movie.year ? `Çıkış Yılı: ${currentResult.movie.year}` : 'Film'}
          onRate={(rating, note, detailedRating, reviewTags) => {
            watchMovie(currentResult.movie.id, rating, note, detailedRating, reviewTags);
            setShowRating(false);
            onClose();
          }}
          onClose={() => setShowRating(false)}
        />
      )}

      {/* SİNEMA KARTI MODALI */}
      {detailMovie && (
        <MediaDetailModal
          target={{ type: 'movie', data: detailMovie }}
          onClose={() => setDetailMovie(null)}
        />
      )}
    </div>
  );
}