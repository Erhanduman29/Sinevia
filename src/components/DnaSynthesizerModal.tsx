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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass } from '../lib/utils';
import { searchTMDB } from '../lib/tmdb';
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
  source: 'both' | 'A' | 'B' | 'hybrid';
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

// Yabancı ve Türkçe oyuncu/yönetmen isimlerinin (I/ı, İ/i farkı olmadan) %100 doğru eşleşmesi için normalize fonksiyonu
function normKey(str?: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/i̇/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function DnaSynthesizerModal({ onClose }: DnaSynthesizerModalProps) {
  const { data, watchMovie, editMovie, showToast } = useApp();
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

  const [isSyncingDna, setIsSyncingDna] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });

  // Seçili filmleri her zaman güncel state'ten al (künye senkronize edildiğinde anında güncellensin)
  const movieA = useMemo(
    () => (movieAId ? data.movies.find((m) => m.id === movieAId) || null : null),
    [data.movies, movieAId]
  );
  const movieB = useMemo(
    () => (movieBId ? data.movies.find((m) => m.id === movieBId) || null : null),
    [data.movies, movieBId]
  );

  // Oyuncu veya yönetmen bilgisi eksik olan filmlerin sayısı
  const moviesMissingCredits = useMemo(() => {
    return data.movies.filter(
      (m) => !m.cast || m.cast.length === 0 || !m.directors || m.directors.length === 0
    );
  }, [data.movies]);

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
    const q = normKey(search);
    return sourceList.filter(
      (m) =>
        normKey(m.title).includes(q) ||
        (m.directors && m.directors.some((d) => normKey(d).includes(q))) ||
        (m.cast && m.cast.some((c) => normKey(c).includes(q)))
    );
  }, [data.movies, historyMovies, selectionTab, search]);

  // Eksik oyuncu/yönetmen verilerini TMDB'den çekip tamamlayan fonksiyon
  const syncMoviesList = async (listToSync: Movie[]): Promise<Map<string, Movie>> => {
    const updatedMap = new Map<string, Movie>();
    if (listToSync.length === 0) return updatedMap;

    setIsSyncingDna(true);
    setSyncProgress({ current: 0, total: listToSync.length });

    for (let i = 0; i < listToSync.length; i++) {
      const m = listToSync[i];
      setSyncProgress({ current: i + 1, total: listToSync.length });
      try {
        const results = await searchTMDB(m.title);
        if (results.length > 0) {
          const match = results.find((r) => r.year === m.year) || results[0];
          const mergedGenres = Array.from(new Set([...m.genres, ...match.genres]));
          const extra = {
            directors: match.directors && match.directors.length > 0 ? match.directors : m.directors,
            cast: match.cast && match.cast.length > 0 ? match.cast : m.cast,
            studios: match.studios && match.studios.length > 0 ? match.studios : m.studios,
            keywords: match.keywords && match.keywords.length > 0 ? match.keywords : m.keywords,
            originalLanguage: match.originalLanguage || m.originalLanguage,
          };

          editMovie(
            m.id,
            m.title,
            match.year || m.year,
            mergedGenres,
            match.runtime || m.runtime,
            match.posterUrl || m.posterUrl,
            match.overview || m.overview,
            match.id,
            true,
            m.customUrl,
            match.imdbId || m.imdbId,
            match.watchProviders && match.watchProviders.length > 0
              ? match.watchProviders
              : m.watchProviders,
            extra
          );

          updatedMap.set(m.id, {
            ...m,
            year: match.year || m.year,
            genres: mergedGenres,
            runtime: match.runtime || m.runtime,
            posterUrl: match.posterUrl || m.posterUrl || undefined,
            overview: match.overview || m.overview,
            tmdbId: match.id,
            ...extra,
          });
        }
      } catch (err) {
        console.error('DNA künye tamamlama hatası:', m.title, err);
      }
      await new Promise((r) => setTimeout(r, 180));
    }

    setIsSyncingDna(false);
    return updatedMap;
  };

  const handleSyncAllMissing = async () => {
    if (moviesMissingCredits.length === 0) return;
    const synced = await syncMoviesList(moviesMissingCredits);
    showToast(`${synced.size} filmin oyuncu ve yönetmen DNA'sı tamamlandı!`, 'success');
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

    // Eğer seçilen 2 ebeveyn filmin veya adayların oyuncu/yönetmen verisi eksikse önce hızlıca tamamla
    const parentsMissing = [movieA, movieB].filter(
      (m) => !m.cast || m.cast.length === 0 || !m.directors || m.directors.length === 0
    );
    const syncedOverrides =
      parentsMissing.length > 0 ? await syncMoviesList(parentsMissing) : new Map<string, Movie>();

    const activeA = syncedOverrides.get(movieA.id) || movieA;
    const activeB = syncedOverrides.get(movieB.id) || movieB;

    setTimeout(() => {
      const extractKeywordsFromText = (text?: string) => {
        const map = new Map<string, string>();
        if (!text) return map;
        const clean = normKey(text).replace(/[.,/#!$%^&*;:{}=\-_`~()'"?<>]/g, ' ');
        clean.split(/\s+/).forEach((w) => {
          if (w.length >= 5 && !STOP_WORDS.has(w)) {
            const stem = w.slice(0, 5);
            if (!map.has(stem)) map.set(stem, w);
          }
        });
        return map;
      };

      const stemsA = extractKeywordsFromText(`${activeA.overview || ''} ${activeA.note || ''}`);
      const stemsB = extractKeywordsFromText(`${activeB.overview || ''} ${activeB.note || ''}`);

      const yearA = parseInt(activeA.year || '0', 10);
      const yearB = parseInt(activeB.year || '0', 10);
      const decadeA = yearA > 1900 ? Math.floor(yearA / 10) * 10 : 0;
      const decadeB = yearB > 1900 ? Math.floor(yearB / 10) * 10 : 0;

      const rtA = activeA.runtime || 0;
      const rtB = activeB.runtime || 0;
      const avgParentRuntime =
        rtA > 0 && rtB > 0 ? Math.round((rtA + rtB) / 2) : rtA > 0 ? rtA : rtB > 0 ? rtB : 0;

      // Ebeveynlerin Yönetmen, Oyuncu, Tür, Anahtar Kelime ve Stüdyo kümeleri
      const dirsA = new Set((activeA.directors || []).map(normKey).filter(Boolean));
      const dirsB = new Set((activeB.directors || []).map(normKey).filter(Boolean));

      const castA = new Set((activeA.cast || []).map(normKey).filter(Boolean));
      const castB = new Set((activeB.cast || []).map(normKey).filter(Boolean));

      const genresA = new Set((activeA.genres || []).map(normKey).filter(Boolean));
      const genresB = new Set((activeB.genres || []).map(normKey).filter(Boolean));

      const kwA = new Set((activeA.keywords || []).map(normKey).filter(Boolean));
      const kwB = new Set((activeB.keywords || []).map(normKey).filter(Boolean));

      const studiosA = new Set((activeA.studios || []).map(normKey).filter(Boolean));
      const studiosB = new Set((activeB.studios || []).map(normKey).filter(Boolean));

      const scoredCandidates: (SynthVariant & { sortRank: number })[] = [];

      eligibleUnwatchedMovies.forEach((rawCand) => {
        const candidate = syncedOverrides.get(rawCand.id) || rawCand;
        if (candidate.id === activeA.id || candidate.id === activeB.id) return;

        let pctFromA = 0;
        let pctFromB = 0;
        const traits: SynthTrait[] = [];

        // ---------------------------------------------------------
        // 1. YÖNETMEN KARŞILAŞTIRMASI (Sabit Oran: +%25, İki Ebeveynde de Varsa +%30)
        // ---------------------------------------------------------
        const candDirs = (candidate.directors || []).filter((d) => normKey(d).length > 0);
        const dirsBoth: string[] = [];
        const dirsOnlyA: string[] = [];
        const dirsOnlyB: string[] = [];

        candDirs.forEach((d) => {
          const nd = normKey(d);
          const inA = dirsA.has(nd);
          const inB = dirsB.has(nd);
          if (inA && inB) dirsBoth.push(d);
          else if (inA) dirsOnlyA.push(d);
          else if (inB) dirsOnlyB.push(d);
        });

        if (dirsBoth.length > 0) {
          const pct = 30;
          pctFromA += 15;
          pctFromB += 15;
          traits.push({
            category: 'Yönetmen',
            label: `Ortak Yönetmen: ${dirsBoth.join(', ')}`,
            addedPct: pct,
            source: 'both',
          });
        } else {
          if (dirsOnlyA.length > 0) {
            const pct = 25;
            pctFromA += pct;
            traits.push({
              category: 'Yönetmen',
              label: `Aynı Yönetmen (${activeA.title}): ${dirsOnlyA.join(', ')}`,
              addedPct: pct,
              source: 'A',
            });
          }
          if (dirsOnlyB.length > 0) {
            const pct = 25;
            pctFromB += pct;
            traits.push({
              category: 'Yönetmen',
              label: `Aynı Yönetmen (${activeB.title}): ${dirsOnlyB.join(', ')}`,
              addedPct: pct,
              source: 'B',
            });
          }
        }

        // ---------------------------------------------------------
        // 2. OYUNCU KADROSU KARŞILAŞTIRMASI (Sabit Oran: Her Ortak Oyuncu +%10, İki Ebeveynde de Varsa +%15, Maks +%30)
        // ---------------------------------------------------------
        const candCast = (candidate.cast || []).filter((c) => normKey(c).length > 0);
        const actorsBoth: string[] = [];
        const actorsOnlyA: string[] = [];
        const actorsOnlyB: string[] = [];

        candCast.forEach((actor) => {
          const na = normKey(actor);
          const inA = castA.has(na);
          const inB = castB.has(na);
          if (inA && inB) actorsBoth.push(actor);
          else if (inA) actorsOnlyA.push(actor);
          else if (inB) actorsOnlyB.push(actor);
        });

        let castPctTotal = 0;
        if (actorsBoth.length > 0) {
          const pct = Math.min(30, actorsBoth.length * 15);
          castPctTotal += pct;
          pctFromA += pct / 2;
          pctFromB += pct / 2;
        }
        if (actorsOnlyA.length > 0) {
          const pct = Math.min(30 - castPctTotal, actorsOnlyA.length * 10);
          if (pct > 0) {
            castPctTotal += pct;
            pctFromA += pct;
          }
        }
        if (actorsOnlyB.length > 0) {
          const pct = Math.min(30 - castPctTotal, actorsOnlyB.length * 10);
          if (pct > 0) {
            castPctTotal += pct;
            pctFromB += pct;
          }
        }

        if (castPctTotal > 0) {
          const allMatchedActors = [...actorsBoth, ...actorsOnlyA, ...actorsOnlyB];
          traits.push({
            category: 'Oyuncu',
            label: `Ortak Oyuncu (${allMatchedActors.length}): ${allMatchedActors.join(', ')}`,
            addedPct: castPctTotal,
            source:
              actorsBoth.length > 0 || (actorsOnlyA.length > 0 && actorsOnlyB.length > 0)
                ? 'both'
                : actorsOnlyA.length > 0
                ? 'A'
                : 'B',
          });
        }

        // ---------------------------------------------------------
        // 3. TÜR KARŞILAŞTIRMASI (Sabit Oran: Tek Ebeveynle Aynı Tür +%5, İkisiyle de Aynı Tür +%8, Çapraz Tür Bonusu +%5, Maks +%25)
        // ---------------------------------------------------------
        const candGenres = (candidate.genres || []).filter((g) => normKey(g).length > 0);
        const genresBoth: string[] = [];
        const genresOnlyA: string[] = [];
        const genresOnlyB: string[] = [];

        candGenres.forEach((g) => {
          const ng = normKey(g);
          const inA = genresA.has(ng);
          const inB = genresB.has(ng);
          if (inA && inB) genresBoth.push(g);
          else if (inA) genresOnlyA.push(g);
          else if (inB) genresOnlyB.push(g);
        });

        let genrePctTotal = 0;
        if (genresBoth.length > 0) {
          const pct = Math.min(24, genresBoth.length * 8);
          genrePctTotal += pct;
          pctFromA += pct / 2;
          pctFromB += pct / 2;
          traits.push({
            category: 'Tür',
            label: `Her İki Ebeveynde Ortak Tür (${genresBoth.length}): ${genresBoth.join(', ')}`,
            addedPct: pct,
            source: 'both',
          });
        }

        if (genresOnlyA.length > 0 && genresOnlyB.length > 0) {
          // Aday film 1. Filmden bir tür, 2. Filmden başka bir tür birleştirdiyse: Tür başına %5 + %5 Melez Tür Bonusu
          const rawCrossPct = (genresOnlyA.length + genresOnlyB.length) * 5 + 5;
          const pct = Math.min(25 - genrePctTotal, rawCrossPct);
          if (pct > 0) {
            genrePctTotal += pct;
            pctFromA += pct / 2;
            pctFromB += pct / 2;
            traits.push({
              category: 'Tür',
              label: `Çapraz Tür Sentezi: ${genresOnlyA.join(', ')} × ${genresOnlyB.join(', ')}`,
              addedPct: pct,
              source: 'hybrid',
            });
          }
        } else if (genresOnlyA.length > 0) {
          const pct = Math.min(20 - genrePctTotal, genresOnlyA.length * 5);
          if (pct > 0) {
            genrePctTotal += pct;
            pctFromA += pct;
            traits.push({
              category: 'Tür',
              label: `Aynı Tür (${genresOnlyA.length}): ${genresOnlyA.join(', ')}`,
              addedPct: pct,
              source: 'A',
            });
          }
        } else if (genresOnlyB.length > 0) {
          const pct = Math.min(20 - genrePctTotal, genresOnlyB.length * 5);
          if (pct > 0) {
            genrePctTotal += pct;
            pctFromB += pct;
            traits.push({
              category: 'Tür',
              label: `Aynı Tür (${genresOnlyB.length}): ${genresOnlyB.join(', ')}`,
              addedPct: pct,
              source: 'B',
            });
          }
        }

        // ---------------------------------------------------------
        // 4. TEMA / ANAHTAR KELİME (Sabit Oran: Her Ortak Tema +%4, İki Ebeveynde Varsa +%6, Maks +%20)
        // ---------------------------------------------------------
        const candKws = (candidate.keywords || []).filter((k) => normKey(k).length > 0);
        const kwsBoth: string[] = [];
        const kwsOnlyA: string[] = [];
        const kwsOnlyB: string[] = [];

        candKws.forEach((k) => {
          const nk = normKey(k);
          const inA = kwA.has(nk);
          const inB = kwB.has(nk);
          if (inA && inB) kwsBoth.push(k);
          else if (inA) kwsOnlyA.push(k);
          else if (inB) kwsOnlyB.push(k);
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
            category: 'Tema',
            label: `Ortak Anahtar Kelime (${allKws.length}): ${allKws.slice(0, 3).join(', ')}`,
            addedPct: kwPct,
            source: kwsBoth.length > 0 ? 'both' : kwsOnlyA.length > 0 ? 'A' : 'B',
          });
        }

        // ---------------------------------------------------------
        // 5. KONU ÖZETİ KELİME KESİŞİMİ (Sabit Oran: Her Ortak Kavram +%3, Maks +%12)
        // ---------------------------------------------------------
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
            category: 'Konu',
            label: `Konu Kesişimi (${matchedWords.slice(0, 3).join(', ')})`,
            addedPct: storyPct,
            source: wA > 0 && wB > 0 ? 'both' : wA > 0 ? 'A' : 'B',
          });
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
              category: 'Koleksiyon',
              label: `Aynı Film Serisi (Sıradaki İlk Film)`,
              addedPct: colPct,
              source: inColA && inColB ? 'both' : inColA ? 'A' : 'B',
            });
          }
        }

        // ---------------------------------------------------------
        // 7. YAPIMCI STÜDYO (Sabit Oran: 1 Stüdyo +%5, 2+ Stüdyo +%8)
        // ---------------------------------------------------------
        const candStudios = (candidate.studios || []).filter((s) => normKey(s).length > 0);
        const matchedStudios: string[] = [];
        let stInA = false;
        let stInB = false;

        candStudios.forEach((s) => {
          const ns = normKey(s);
          if (studiosA.has(ns)) {
            matchedStudios.push(s);
            stInA = true;
          }
          if (studiosB.has(ns)) {
            if (!matchedStudios.includes(s)) matchedStudios.push(s);
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
            category: 'Stüdyo',
            label: `Aynı Stüdyo: ${matchedStudios.slice(0, 2).join(', ')}`,
            addedPct: stPct,
            source: stInA && stInB ? 'both' : stInA ? 'A' : 'B',
          });
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
            category: 'Dönem',
            label: `Aynı Dönem (${candDecade}'ler Sineması)`,
            addedPct: decPct,
            source: candDecade === decadeA && candDecade === decadeB ? 'both' : candDecade === decadeA ? 'A' : 'B',
          });
        }

        // ---------------------------------------------------------
        // 9. SÜRE & TEMPO UYUMU (Sabit Oran: ±15 dk içindeyse +%5)
        // ---------------------------------------------------------
        if (candidate.runtime && candidate.runtime > 0 && avgParentRuntime > 0) {
          const diffAvg = Math.abs(candidate.runtime - avgParentRuntime);
          const diffA = rtA > 0 ? Math.abs(candidate.runtime - rtA) : 999;
          const diffB = rtB > 0 ? Math.abs(candidate.runtime - rtB) : 999;

          if (diffAvg <= 15 || diffA <= 10 || diffB <= 10) {
            const rtPct = 5;
            pctFromA += 2.5;
            pctFromB += 2.5;
            traits.push({
              category: 'Süre',
              label: `Süre & Tempo Uyumu (${candidate.runtime} dk)`,
              addedPct: rtPct,
              source: 'both',
            });
          }
        }

        // ---------------------------------------------------------
        // 10. ORİJİNAL DİL / ÜLKE SİNEMASI (Sabit Oran: +%5, İngilizce ise +%3)
        // ---------------------------------------------------------
        if (candidate.originalLanguage) {
          const langInA = candidate.originalLanguage === activeA.originalLanguage;
          const langInB = candidate.originalLanguage === activeB.originalLanguage;
          if (langInA || langInB) {
            const langPct = candidate.originalLanguage !== 'en' ? 5 : 3;
            if (langInA && langInB) {
              pctFromA += langPct / 2;
              pctFromB += langPct / 2;
            } else if (langInA) {
              pctFromA += langPct;
            } else {
              pctFromB += langPct;
            }
            traits.push({
              category: 'Dil',
              label: `Aynı Orijinal Dil (${candidate.originalLanguage.toUpperCase()})`,
              addedPct: langPct,
              source: langInA && langInB ? 'both' : langInA ? 'A' : 'B',
            });
          }
        }

        // ---------------------------------------------------------
        // 11. GERÇEK MELEZ (A × B) SENTEZ BONUSU (Sabit Oran: +%5)
        // Aday film hem 1. Filmden hem 2. Filmden en az %5'lik özellik aldıysa
        // ---------------------------------------------------------
        const isTrueHybrid = pctFromA >= 5 && pctFromB >= 5;
        if (isTrueHybrid) {
          pctFromA += 2.5;
          pctFromB += 2.5;
          traits.push({
            category: 'Melez',
            label: `Çift Ebeveyn Melez Sentezi (1. ve 2. Filmden Ortak Gen)`,
            addedPct: 5,
            source: 'hybrid',
          });
        }

        // Kaos Modu seçiliyse deneysel mutasyon ekle (Safkan ve Dengeli modda %0 rastgelelik!)
        if (mutationRate === 2) {
          const chaosBonus = Math.floor(Math.random() * 8) + 3; // +%3 ile +%10 arası
          pctFromA += chaosBonus / 2;
          pctFromB += chaosBonus / 2;
          traits.push({
            category: 'Mutasyon',
            label: `Kaos Modu Genetik Mutasyonu`,
            addedPct: chaosBonus,
            source: 'hybrid',
          });
        }

        // GERÇEK TOPLAM UYUM = Tüm kazanılan sabit yüzdelerin birebir toplamı!
        const exactSumPct = traits.reduce((sum, t) => sum + t.addedPct, 0);
        if (exactSumPct <= 0) return;

        const matchScore = Math.min(100, exactSumPct);

        // Ebeveyn A ve B kalıtım oranı
        const totalParentShare = pctFromA + pctFromB || 1;
        const parentAPct = Math.round((pctFromA / totalParentShare) * 100);
        const parentBPct = 100 - parentAPct;

        // Sıralama puanı: Dengeli modda her iki ebeveynden de gen alan melezler önceliklendirilir
        const hybridRankBonus = isTrueHybrid && mutationRate === 1 ? 6 : 0;
        const sortRank = matchScore + hybridRankBonus;

        // Özellikleri en yüksek yüzdeliden en düşüğe sırala
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
    }, 800);
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
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-ink-950/90 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-ink-900 border border-emerald-500/30 rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl shadow-emerald-900/20 flex flex-col max-h-[92vh]"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-800/50 bg-gradient-to-r from-emerald-950/40 to-ink-900">
          <div className="flex items-center gap-3">
            {selectingSlot ? (
              <button
                onClick={() => setSelectingSlot(null)}
                className="p-2 -ml-2 rounded-full hover:bg-ink-800 text-ink-300 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <Dna size={20} className="text-emerald-400" />
              </div>
            )}
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white">Film DNA Sentezleyici</h2>
              <p className="text-xs text-emerald-400/80">Sabit Oranlı Matematiksel Eşleştirme Motoru</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFormulaTable(!showFormulaTable)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                showFormulaTable
                  ? 'bg-emerald-500 text-ink-950 border-emerald-400'
                  : 'bg-ink-800/80 text-emerald-300 border-emerald-500/30 hover:bg-ink-800'
              }`}
              title="Sabit Oran Tablosunu Gör"
            >
              <Calculator size={14} /> <span className="hidden sm:inline">Oran Tablosu</span>
            </button>
            <button
              onClick={onClose}
              className="text-ink-400 hover:text-white transition-colors bg-ink-800/50 hover:bg-ink-800 p-2 rounded-full"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* SABİT MATEMATİKSEL ORAN TABLOSU (AÇILIR/KAPANIR BİLGİ PANELİ) */}
        {showFormulaTable && (
          <div className="bg-ink-950/95 border-b border-emerald-500/30 px-6 py-4 text-xs space-y-2 animate-fade-in">
            <div className="font-black text-emerald-400 uppercase tracking-wider flex items-center justify-between">
              <span>📐 Sabit Genetik Uyum Oranları (Toplam = % Uyum)</span>
              <button onClick={() => setShowFormulaTable(false)} className="text-ink-400 hover:text-white">
                Gizle
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-ink-300">
              <div className="bg-ink-900/80 p-2 rounded-lg border border-ink-800">
                🎬 <strong>Aynı Yönetmen:</strong> <span className="text-emerald-400 font-bold">+%25</span> (İkisinde de: +%30)
              </div>
              <div className="bg-ink-900/80 p-2 rounded-lg border border-ink-800">
                🎭 <strong>Aynı Oyuncu:</strong> Oyuncu başı <span className="text-emerald-400 font-bold">+%10</span> (Maks +%30)
              </div>
              <div className="bg-ink-900/80 p-2 rounded-lg border border-ink-800">
                🏷️ <strong>Aynı Tür:</strong> Tür başı <span className="text-emerald-400 font-bold">+%5</span> (İkisinde de: +%8)
              </div>
              <div className="bg-ink-900/80 p-2 rounded-lg border border-ink-800">
                🔑 <strong>Ortak Tema:</strong> Kelime başı <span className="text-emerald-400 font-bold">+%4</span> (Maks +%20)
              </div>
              <div className="bg-ink-900/80 p-2 rounded-lg border border-ink-800">
                📦 <strong>Aynı Seri/Koleksiyon:</strong> <span className="text-emerald-400 font-bold">+%15</span> (En eski film)
              </div>
              <div className="bg-ink-900/80 p-2 rounded-lg border border-ink-800">
                ⏱️ <strong>Stüdyo / Dönem / Süre:</strong> Her biri <span className="text-emerald-400 font-bold">+%5</span>
              </div>
            </div>
          </div>
        )}

        {/* İÇERİK BÖLÜMÜ */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
          {/* EKSİK OYUNCU / YÖNETMEN VERİSİ UYARISI VE TEK TIKLA TAMAMLAMA */}
          {moviesMissingCredits.length > 0 && !selectingSlot && step === 'select' && (
            <div className="mb-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-amber-200 text-center sm:text-left">
                <strong className="text-amber-400 block mb-0.5">
                  🔍 {moviesMissingCredits.length} Filmin Oyuncu & Yönetmen Verisi Eksik!
                </strong>
                Oyuncu ve yönetmenlerin eksiksiz karşılaştırılması için TMDB künyelerini tamamlayabilirsin.
              </div>
              <button
                type="button"
                disabled={isSyncingDna}
                onClick={handleSyncAllMissing}
                className="flex-shrink-0 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-ink-950 font-black text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
              >
                <RefreshCw size={14} className={isSyncingDna ? 'animate-spin' : ''} />
                {isSyncingDna
                  ? `Tamamlanıyor (${syncProgress.current}/${syncProgress.total})`
                  : 'Oyuncu Verilerini Tamamla'}
              </button>
            </div>
          )}

          {/* DURUM 1: YUVA SEÇİMİ */}
          {selectingSlot && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input
                    type="text"
                    autoFocus
                    placeholder={
                      selectionTab === 'history'
                        ? 'Geçmişte film, yönetmen veya oyuncu ara...'
                        : 'Kütüphanede film, yönetmen veya oyuncu ara...'
                    }
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-ink-950/50 border border-emerald-500/20 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-ink-600 focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>
                <button
                  onClick={() => setSelectionTab((prev) => (prev === 'library' ? 'history' : 'library'))}
                  className={`px-4 flex items-center gap-2 rounded-xl font-bold text-xs sm:text-sm transition-all border ${
                    selectionTab === 'history'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-ink-950/50 border-ink-800 text-ink-400 hover:text-ink-200'
                  }`}
                >
                  <Clock size={16} />
                  <span>{selectionTab === 'history' ? 'Sadece İzlenenler' : 'Tüm Kütüphane'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[52vh] overflow-y-auto pr-1 custom-scrollbar">
                {filteredMovies.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMovie(m)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-ink-800 bg-ink-950/40 hover:bg-ink-800 hover:border-emerald-500/40 transition-all text-left group relative overflow-hidden"
                  >
                    {m.watched && m.rating !== null && (
                      <div
                        className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-md font-black ${ratingBgClass(
                          m.rating
                        )}`}
                      >
                        ★ {m.rating}
                      </div>
                    )}
                    <div className="w-11 h-16 bg-ink-900 rounded-lg overflow-hidden flex-shrink-0 border border-ink-700/50">
                      {m.posterUrl ? (
                        <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon size={14} className="text-ink-700" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pr-10">
                      <div className="font-bold text-xs sm:text-sm text-ink-100 truncate group-hover:text-emerald-400 transition-colors">
                        {m.title}
                      </div>
                      <div className="text-[11px] text-ink-400 truncate mt-0.5">
                        {m.directors && m.directors.length > 0 ? `🎬 ${m.directors[0]}` : m.genres.slice(0, 2).join(', ')}
                        {m.year && ` · ${m.year}`}
                      </div>
                      {m.cast && m.cast.length > 0 && (
                        <div className="text-[10px] text-ink-500 truncate mt-0.5">
                          🎭 {m.cast.slice(0, 2).join(', ')}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {filteredMovies.length === 0 && (
                <div className="text-center text-ink-500 py-8 text-sm">
                  Aramaya uygun film bulunamadı.
                </div>
              )}
            </div>
          )}

          {/* DURUM 2: SENTEZ BEKLEME EKRANI */}
          {!selectingSlot && step === 'select' && (
            <div className="space-y-5 animate-fade-in flex flex-col items-center">
              {eligibleUnwatchedMovies.length === 0 ? (
                <div className="text-center py-8">
                  <Beaker size={48} className="mx-auto text-ink-600 mb-4" />
                  <h3 className="text-lg font-bold text-ink-200">Denek Bulunamadı</h3>
                  <p className="text-sm text-ink-500 mt-2 max-w-md mx-auto">
                    Sentezleme yapabilmek için kütüphanende izlenmemiş (bekleyen) filmler olması gerekiyor.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3 bg-ink-950/50 border border-ink-800 rounded-2xl p-3.5">
                    <p className="text-ink-300 text-xs leading-relaxed text-center sm:text-left">
                      Seçtiğin iki filmin <strong>yönetmen (+%25), oyuncu (+%10), tür (+%5), tema (+%4) ve dönem (+%5)</strong> oranları toplanarak gerçek uyum yüzdesi hesaplanır.
                    </p>
                    {data.movies.length >= 2 && (
                      <button
                        type="button"
                        onClick={handleRandomPair}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-xl transition-all"
                      >
                        <Shuffle size={13} /> Favorilerden Seç
                      </button>
                    )}
                  </div>

                  {/* YUVA A VE YUVA B (OYUNCU VE YÖNETMEN BİLGİLERİYLE) */}
                  <div className="grid grid-cols-2 gap-4 w-full">
                    {[
                      { slot: 'A' as const, movie: movieA, label: '1. Ebeveyn DNA' },
                      { slot: 'B' as const, movie: movieB, label: '2. Ebeveyn DNA' },
                    ].map(({ slot, movie, label }) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectingSlot(slot)}
                        className={`relative rounded-2xl border-2 border-dashed p-3.5 flex flex-col items-center justify-between min-h-[230px] transition-all overflow-hidden group ${
                          movie
                            ? 'border-emerald-500/60 bg-ink-950/70 shadow-lg'
                            : 'border-ink-700 bg-ink-950/30 hover:border-emerald-500/40 hover:bg-ink-800/40'
                        }`}
                      >
                        {movie ? (
                          <>
                            {movie.posterUrl && (
                              <img
                                src={movie.posterUrl}
                                alt={movie.title}
                                className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:opacity-15 transition-opacity"
                              />
                            )}
                            <div className="relative z-10 w-full flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-emerald-400">
                              <span>{label}</span>
                              {movie.rating !== null && (
                                <span className={`px-1.5 py-0.5 rounded ${ratingBgClass(movie.rating)}`}>
                                  ★ {movie.rating}
                                </span>
                              )}
                            </div>

                            <div className="relative z-10 my-2 text-center w-full space-y-1">
                              <div className="font-black text-white text-sm sm:text-base drop-shadow-md line-clamp-2">
                                {movie.title}
                              </div>
                              <div className="text-[11px] text-ink-300">
                                {movie.year} {movie.runtime ? `· ${movie.runtime} dk` : ''}
                              </div>
                              {movie.directors && movie.directors.length > 0 ? (
                                <div className="text-[11px] text-emerald-300 font-bold truncate">
                                  🎬 {movie.directors[0]}
                                </div>
                              ) : (
                                <div className="text-[10px] text-amber-400/80">🎬 Yönetmen verisi yok</div>
                              )}
                              {movie.cast && movie.cast.length > 0 ? (
                                <div className="text-[10px] text-ink-200 truncate px-1">
                                  🎭 {movie.cast.slice(0, 3).join(', ')}
                                </div>
                              ) : (
                                <div className="text-[10px] text-amber-400/80">🎭 Oyuncu verisi yok</div>
                              )}
                              {movie.genres.length > 0 && (
                                <div className="text-[10px] text-ink-400 truncate">
                                  {movie.genres.slice(0, 3).join(' · ')}
                                </div>
                              )}
                            </div>

                            <span className="relative z-10 text-[10px] font-bold text-emerald-300 bg-ink-950/90 px-3 py-1 rounded-full border border-emerald-500/30">
                              Değiştir
                            </span>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center my-auto py-8">
                            <div className="w-12 h-12 rounded-full bg-ink-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border border-ink-700">
                              <Plus size={24} className="text-ink-400 group-hover:text-emerald-400" />
                            </div>
                            <span className="text-xs font-black text-ink-400 uppercase tracking-widest">
                              {label} Seç
                            </span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* SENTEZ MODU SEÇİMİ */}
                  <div className="w-full bg-ink-950/50 border border-ink-800 rounded-2xl p-4 space-y-2.5">
                    <div className="flex justify-between text-xs font-bold text-ink-400 uppercase tracking-wider">
                      <span>Sentezleme Modu</span>
                      <span className="text-emerald-400">
                        {mutationRate === 0
                          ? 'Safkan Matematik (%0 Rastgelelik)'
                          : mutationRate === 1
                          ? 'Melez Öncelikli (%0 Rastgelelik)'
                          : 'Kaos (+%3-10 Mutasyon)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { val: 0, title: '🛡️ Safkan', sub: 'Saf toplam yüzde sırası' },
                        { val: 1, title: '⚖️ Melez (A×B)', sub: 'İki filmden ortak gen alanlar' },
                        { val: 2, title: '⚡ Kaos Modu', sub: '+%3 ile +%10 sürpriz mutasyon' },
                      ].map((m) => (
                        <button
                          key={m.val}
                          type="button"
                          onClick={() => setMutationRate(m.val)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            mutationRate === m.val
                              ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md'
                              : 'bg-ink-900/60 border-ink-800 text-ink-400 hover:bg-ink-800'
                          }`}
                        >
                          <div className="text-xs font-black">{m.title}</div>
                          <div className="text-[10px] opacity-75 mt-0.5">{m.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={!movieA || !movieB || isSyncingDna}
                    onClick={handleSynthesize}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-8 py-4 rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                  >
                    <Beaker size={20} /> DNA Sentezini Başlat ({eligibleUnwatchedMovies.length} Uygun Aday)
                  </button>
                </>
              )}
            </div>
          )}

          {/* DURUM 3: SENTEZ ANİMASYONU */}
          {!selectingSlot && step === 'synthesizing' && (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in space-y-6">
              <div className="relative">
                <Dna size={64} className="text-emerald-400 animate-spin opacity-80" style={{ animationDuration: '3s' }} />
                <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-white tracking-widest">
                  {isSyncingDna ? 'EKSİK OYUNCU VERİLERİ ÇEKİLİYOR...' : 'MATEMATİKSEL UYUM HESAPLANIYOR...'}
                </h3>
                <p className="text-sm text-emerald-400/80 animate-pulse">
                  {movieA?.title} × {movieB?.title} yönetmen, oyuncu, tür ve tema oranları toplanıyor...
                </p>
              </div>
            </div>
          )}

          {/* DURUM 4: SONUÇ EKRANI */}
          {!selectingSlot && step === 'result' && (
            <div className="animate-fade-in-up space-y-4">
              {!currentResult ? (
                <div className="text-center py-10 space-y-3">
                  <Beaker size={44} className="mx-auto text-ink-500" />
                  <h3 className="text-lg font-bold text-white">Ortak Genetik Özellik Bulunamadı</h3>
                  <p className="text-xs text-ink-400 max-w-md mx-auto">
                    Seçtiğin iki filmle bekleyen filmlerin arasında ortak yönetmen, oyuncu, tür veya tema kesişimi çıkmadı.
                  </p>
                  <button
                    onClick={() => setStep('select')}
                    className="bg-emerald-500 text-ink-950 font-black px-5 py-2.5 rounded-xl text-xs"
                  >
                    Farklı Filmler Dene
                  </button>
                </div>
              ) : (
                <>
                  {/* Üst Varyant Seçici Sekmeler */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                      <Sparkles size={14} /> Net Uyum: %{currentResult.matchScore}
                    </div>

                    {variants.length > 1 && (
                      <div className="flex items-center gap-1.5 bg-ink-950 p-1 rounded-xl border border-ink-800">
                        {variants.map((v, idx) => (
                          <button
                            key={v.movie.id}
                            type="button"
                            onClick={() => setActiveVariantIdx(idx)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                              activeVariantIdx === idx
                                ? 'bg-emerald-500 text-ink-950 font-black shadow-sm'
                                : 'text-ink-400 hover:text-ink-200'
                            }`}
                          >
                            {idx + 1}. Varyant (%{v.matchScore})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ebeveyn Kalıtım Oranı Çubuğu (Film A vs Film B) */}
                  {movieA && movieB && (
                    <div className="bg-ink-950/70 border border-ink-800 rounded-xl p-3 space-y-1.5">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-emerald-400 truncate max-w-[45%]">
                          🧬 %{currentResult.parentAPct} {movieA.title}
                        </span>
                        <span className="text-cyan-400 truncate max-w-[45%] text-right">
                          {movieB.title} %{currentResult.parentBPct} 🧬
                        </span>
                      </div>
                      <div className="h-2 w-full bg-ink-900 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                          style={{ width: `${currentResult.parentAPct}%` }}
                        />
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                          style={{ width: `${currentResult.parentBPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row gap-5 items-center md:items-stretch bg-ink-950/60 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 w-full">
                    {/* Sol: Tıklanabilir Poster */}
                    <button
                      type="button"
                      onClick={() => setDetailMovie(currentResult.movie)}
                      title="Sinema Kartını Gör"
                      className="w-36 md:w-44 flex-shrink-0 aspect-[2/3] bg-ink-900 rounded-xl overflow-hidden shadow-xl border-2 border-emerald-500/40 relative group cursor-pointer"
                    >
                      {currentResult.movie.posterUrl ? (
                        <img
                          src={currentResult.movie.posterUrl}
                          alt={currentResult.movie.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="text-ink-700" size={32} />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-emerald-500 text-ink-950 font-black text-xs px-2.5 py-1 rounded-lg shadow-lg">
                        %{currentResult.matchScore} Uyum
                      </div>
                      <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                        <Eye size={20} className="text-emerald-400" />
                        <span className="text-[10px] font-black text-white uppercase">Sinema Kartı</span>
                      </div>
                    </button>

                    {/* Sağ: Künye, Oyuncular, Sabit Matematiksel Kırılım ve Linkler */}
                    <div className="flex-1 flex flex-col justify-between w-full text-center md:text-left min-w-0">
                      <div>
                        <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                          {currentResult.movie.title}
                        </h3>

                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 text-xs text-ink-300 font-semibold mt-2">
                          {currentResult.movie.year && (
                            <span className="flex items-center gap-1">
                              <Calendar size={12} className="text-emerald-400" /> {currentResult.movie.year}
                            </span>
                          )}
                          {currentResult.movie.runtime && (
                            <span className="flex items-center gap-1">
                              <Clock size={12} className="text-emerald-400" /> {currentResult.movie.runtime} dk
                            </span>
                          )}
                          {currentResult.movie.directors && currentResult.movie.directors.length > 0 && (
                            <span className="flex items-center gap-1 text-emerald-300">
                              <User size={12} /> {currentResult.movie.directors.join(', ')}
                            </span>
                          )}
                        </div>

                        {currentResult.movie.cast && currentResult.movie.cast.length > 0 && (
                          <div className="flex items-center justify-center md:justify-start gap-1.5 text-[11px] text-ink-300 mt-1.5">
                            <Users size={12} className="text-gold-400 flex-shrink-0" />
                            <span className="truncate">
                              <strong>Oyuncular:</strong> {currentResult.movie.cast.slice(0, 4).join(', ')}
                            </span>
                          </div>
                        )}

                        <div className="text-xs text-ink-400 mt-1">
                          {currentResult.movie.genres.join(' · ')}
                        </div>

                        {/* İzleme ve Fragman Linkleri */}
                        <div className="flex items-center justify-center md:justify-start gap-1.5 flex-wrap my-3">
                          {getWatchLinks(currentResult.movie).map((link, idx) => {
                            const Icon = link.icon;
                            if (link.isTrailer) {
                              return (
                                <a
                                  key={idx}
                                  href={link.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shadow"
                                >
                                  <Icon size={12} /> {link.text}
                                </a>
                              );
                            }
                            return (
                              <a
                                key={idx}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 bg-ink-800 hover:bg-ink-700 text-gold-400 border border-gold-500/30 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                              >
                                {link.logo ? (
                                  <img src={link.logo} alt="Platform" className="w-3.5 h-3.5 rounded-sm object-cover" />
                                ) : (
                                  <Icon size={12} />
                                )}
                                {link.text}
                              </a>
                            );
                          })}
                        </div>

                        {/* SABİT ORANLI MATEMATİKSEL TABLO (TOPLAMI = % UYUM) */}
                        <div className="space-y-2 bg-ink-900/70 p-3.5 rounded-xl border border-ink-800 text-left">
                          <div className="text-[10px] font-black text-ink-400 uppercase tracking-widest flex justify-between border-b border-ink-800 pb-1.5">
                            <span>Kazanılan Sabit Kriter Puanları</span>
                            <span className="text-emerald-400 font-mono">
                              Toplam = %{currentResult.matchScore} Uyum
                            </span>
                          </div>
                          {currentResult.traits.map((t, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-xs font-semibold text-emerald-100 gap-2">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <Dna size={12} className="text-emerald-400 flex-shrink-0" />
                                  <span className="truncate" title={t.label}>
                                    {t.label}
                                  </span>
                                </span>
                                <span className="text-emerald-400 font-black font-mono flex-shrink-0">
                                  +%{t.addedPct}
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-ink-950 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                                  style={{ width: `${Math.min(100, t.addedPct * 3.5)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ALT AKSİYON BUTONLARI */}
                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1 w-full">
                    <button
                      onClick={() => setShowRating(true)}
                      className="flex-1 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-ink-950 font-black py-3.5 rounded-xl shadow-lg shadow-gold-500/20 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
                    >
                      <Star size={17} className="fill-current" /> Puanla
                    </button>
                    <button
                      onClick={() => setDetailMovie(currentResult.movie)}
                      className="sm:w-auto px-5 bg-ink-800 hover:bg-ink-700 text-emerald-400 border border-emerald-500/30 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-xs sm:text-sm"
                    >
                      <Eye size={16} /> Sinema Kartı
                    </button>
                    <button
                      onClick={() => {
                        setStep('select');
                        setVariants([]);
                      }}
                      className="sm:w-auto px-5 bg-ink-800 hover:bg-ink-700 text-white font-bold py-3.5 rounded-xl transition-colors border border-ink-700 flex items-center justify-center text-xs sm:text-sm"
                    >
                      Yeni Sentez
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