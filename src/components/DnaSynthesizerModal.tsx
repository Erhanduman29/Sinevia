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
  Calendar,
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

interface SynthVariant {
  movie: Movie;
  matchScore: number;
  parentAPct: number;
  parentBPct: number;
  composition: { label: string; pct: number }[];
}

const STOP_WORDS = new Set([
  'bir', 've', 'ile', 'için', 'bu', 'da', 'de', 'çok', 'daha', 'en', 'gibi', 'kadar',
  'olan', 'olarak', 'sonra', 'önce', 'kendi', 'ise', 'ya', 'veya', 'ama', 'fakat',
  'göre', 'tüm', 'bütün', 'her', 'hiç', 'bazı', 'biraz', 'şu', 'onu', 'bunu', 'ona',
  'film', 'filmi', 'filmde', 'hikaye', 'hikayesi', 'hayat', 'hayatı', 'yaşam', 'insan',
  'dünya', 'zaman', 'yılında', 'birlikte', 'ancak', 'karşı', 'arasında', 'üzerine',
  'başlar', 'olaylar', 'anlatıyor', 'anlatır', 'konu', 'ediyor', 'sonunda', 'içinde',
  'tarafından', 'বüyük', 'küçük', 'yeni', 'eski', 'genç', 'adam', 'kadın', 'çocuk',
]);

function norm(str?: string): string {
  return (str || '').toLocaleLowerCase('tr-TR').trim();
}

export default function DnaSynthesizerModal({ onClose }: DnaSynthesizerModalProps) {
  const { data, watchMovie } = useApp();
  const [step, setStep] = useState<Step>('select');
  const [movieA, setMovieA] = useState<Movie | null>(null);
  const [movieB, setMovieB] = useState<Movie | null>(null);
  const [selectingSlot, setSelectingSlot] = useState<Slot>(null);
  const [selectionTab, setSelectionTab] = useState<SelectionTab>('library');
  const [search, setSearch] = useState('');

  const [showRating, setShowRating] = useState(false);
  const [detailMovie, setDetailMovie] = useState<Movie | null>(null);

  const [variants, setVariants] = useState<SynthVariant[]>([]);
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);
  const [mutationRate, setMutationRate] = useState<number>(1);

  // KOLEKSİYON KURALI: Koleksiyonlardaki filmlerden sadece izlenmemiş EN ESKİ (sıradaki ilk) film sentezlenebilir
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
    const q = norm(search);
    return sourceList.filter(
      (m) =>
        norm(m.title).includes(q) ||
        (m.directors && m.directors.some((d) => norm(d).includes(q))) ||
        (m.cast && m.cast.some((c) => norm(c).includes(q)))
    );
  }, [data.movies, historyMovies, selectionTab, search]);

  const handleRandomPair = () => {
    const highRated = historyMovies.filter((m) => (m.rating || 0) >= 8);
    const pool = highRated.length >= 2 ? highRated : data.movies;
    if (pool.length < 2) return;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setMovieA(shuffled[0]);
    setMovieB(shuffled[1]);
  };

  // =========================================================
  // GERÇEK ÇAPRAZLAMA (A × B MELEZLEME) MOTORU
  // =========================================================
  const handleSynthesize = () => {
    if (!movieA || !movieB || eligibleUnwatchedMovies.length === 0) return;
    setStep('synthesizing');

    setTimeout(() => {
      const safeMode = mutationRate === 0;
      const chaosMode = mutationRate === 2;

      const extractKeywordsFromText = (text?: string) => {
        const map = new Map<string, string>(); // stem -> original word
        if (!text) return map;
        const clean = norm(text).replace(/[.,/#!$%^&*;:{}=\-_`~()'"?<>]/g, ' ');
        clean.split(/\s+/).forEach((w) => {
          if (w.length >= 5 && !STOP_WORDS.has(w)) {
            const stem = w.slice(0, 5);
            if (!map.has(stem)) map.set(stem, w);
          }
        });
        return map;
      };

      const stemsA = extractKeywordsFromText(`${movieA.overview || ''} ${movieA.note || ''}`);
      const stemsB = extractKeywordsFromText(`${movieB.overview || ''} ${movieB.note || ''}`);

      const yearA = parseInt(movieA.year || '0', 10);
      const yearB = parseInt(movieB.year || '0', 10);
      const avgParentYear =
        yearA > 1900 && yearB > 1900
          ? Math.round((yearA + yearB) / 2)
          : yearA > 1900
          ? yearA
          : yearB > 1900
          ? yearB
          : 0;

      const rtA = movieA.runtime || 0;
      const rtB = movieB.runtime || 0;
      const avgParentRuntime =
        rtA > 0 && rtB > 0 ? Math.round((rtA + rtB) / 2) : rtA > 0 ? rtA : rtB > 0 ? rtB : 0;

      const dirsA = new Set((movieA.directors || []).map(norm).filter(Boolean));
      const dirsB = new Set((movieB.directors || []).map(norm).filter(Boolean));

      const castA = new Set((movieA.cast || []).map(norm).filter(Boolean));
      const castB = new Set((movieB.cast || []).map(norm).filter(Boolean));

      const studiosA = new Set((movieA.studios || []).map(norm).filter(Boolean));
      const studiosB = new Set((movieB.studios || []).map(norm).filter(Boolean));

      const kwA = new Set((movieA.keywords || []).map(norm).filter(Boolean));
      const kwB = new Set((movieB.keywords || []).map(norm).filter(Boolean));

      const genresA = new Set((movieA.genres || []).map(norm).filter(Boolean));
      const genresB = new Set((movieB.genres || []).map(norm).filter(Boolean));

      const scoredCandidates: (SynthVariant & { rawScore: number })[] = [];

      eligibleUnwatchedMovies.forEach((candidate) => {
        if (candidate.id === movieA.id || candidate.id === movieB.id) return;

        let affinityA = 0;
        let affinityB = 0;

        const traits: { label: string; points: number }[] = [];

        // 1. YÖNETMEN EŞLEŞMESİ (Gerçek kontrol)
        const candDirs = (candidate.directors || []).filter((d) => norm(d).length > 0);
        const sharedDirsBoth: string[] = [];
        const dirsFromA: string[] = [];
        const dirsFromB: string[] = [];

        candDirs.forEach((d) => {
          const nd = norm(d);
          const inA = dirsA.has(nd);
          const inB = dirsB.has(nd);
          if (inA && inB) sharedDirsBoth.push(d);
          else if (inA) dirsFromA.push(d);
          else if (inB) dirsFromB.push(d);
        });

        if (sharedDirsBoth.length > 0) {
          const pts = 45;
          affinityA += pts / 2;
          affinityB += pts / 2;
          traits.push({ label: `Ortak Yönetmen (${sharedDirsBoth.join(', ')})`, points: pts });
        } else {
          if (dirsFromA.length > 0) {
            const pts = 28;
            affinityA += pts;
            traits.push({
              label: `${movieA.title} Yönetmeni (${dirsFromA.join(', ')})`,
              points: pts,
            });
          }
          if (dirsFromB.length > 0) {
            const pts = 28;
            affinityB += pts;
            traits.push({
              label: `${movieB.title} Yönetmeni (${dirsFromB.join(', ')})`,
              points: pts,
            });
          }
        }

        // 2. OYUNCU KADROSU EŞLEŞMESİ
        const candCast = (candidate.cast || []).filter((c) => norm(c).length > 0);
        const castBoth: string[] = [];
        const castOnlyA: string[] = [];
        const castOnlyB: string[] = [];

        candCast.forEach((actor) => {
          const na = norm(actor);
          const inA = castA.has(na);
          const inB = castB.has(na);
          if (inA && inB) castBoth.push(actor);
          else if (inA) castOnlyA.push(actor);
          else if (inB) castOnlyB.push(actor);
        });

        if (castBoth.length > 0) {
          const pts = Math.min(40, castBoth.length * 24);
          affinityA += pts / 2;
          affinityB += pts / 2;
          traits.push({
            label: `Her İki Filmle Ortak Oyuncu (${castBoth.slice(0, 2).join(', ')})`,
            points: pts,
          });
        }
        if (castOnlyA.length > 0 || castOnlyB.length > 0) {
          const ptsA = Math.min(28, castOnlyA.length * 16);
          const ptsB = Math.min(28, castOnlyB.length * 16);
          affinityA += ptsA;
          affinityB += ptsB;
          const allMatchedCast = [...castOnlyA, ...castOnlyB];
          traits.push({
            label: `Oyuncu Mirası (${allMatchedCast.slice(0, 3).join(', ')})`,
            points: ptsA + ptsB,
          });
        }

        // 3. TÜR SENTEZİ & ÇAPRAZLAMA
        const candGenres = (candidate.genres || []).filter((g) => norm(g).length > 0);
        const genresBoth: string[] = [];
        const genresOnlyA: string[] = [];
        const genresOnlyB: string[] = [];

        candGenres.forEach((g) => {
          const ng = norm(g);
          const inA = genresA.has(ng);
          const inB = genresB.has(ng);
          if (inA && inB) genresBoth.push(g);
          else if (inA) genresOnlyA.push(g);
          else if (inB) genresOnlyB.push(g);
        });

        if (genresBoth.length > 0) {
          const pts = genresBoth.length * (chaosMode ? 12 : 18);
          affinityA += pts / 2;
          affinityB += pts / 2;
          traits.push({
            label: `Ortak Ana Tür (${genresBoth.join(', ')})`,
            points: pts,
          });
        }

        // Eğer aday film 1. filmden bir tür, 2. filmden başka bir tür aldıysa gerçek Tür Melezlemesi!
        if (genresOnlyA.length > 0 && genresOnlyB.length > 0) {
          const ptsA = genresOnlyA.length * 12 + 8;
          const ptsB = genresOnlyB.length * 12 + 8;
          affinityA += ptsA;
          affinityB += ptsB;
          traits.push({
            label: `Tür Çaprazlaması (${genresOnlyA[0]} + ${genresOnlyB[0]})`,
            points: ptsA + ptsB,
          });
        } else if (genresOnlyA.length > 0) {
          const pts = genresOnlyA.length * 9;
          affinityA += pts;
          traits.push({
            label: `${movieA.title} Türü (${genresOnlyA.join(', ')})`,
            points: pts,
          });
        } else if (genresOnlyB.length > 0) {
          const pts = genresOnlyB.length * 9;
          affinityB += pts;
          traits.push({
            label: `${movieB.title} Türü (${genresOnlyB.join(', ')})`,
            points: pts,
          });
        }

        // 4. TEMA VE ANAHTAR KELİMELER (TMDB Keywords)
        const candKws = (candidate.keywords || []).filter((k) => norm(k).length > 0);
        const matchedKws: string[] = [];
        let kwPtsA = 0;
        let kwPtsB = 0;

        candKws.forEach((k) => {
          const nk = norm(k);
          const inA = kwA.has(nk);
          const inB = kwB.has(nk);
          if (inA && inB) {
            matchedKws.push(k);
            kwPtsA += chaosMode ? 14 : 10;
            kwPtsB += chaosMode ? 14 : 10;
          } else if (inA) {
            matchedKws.push(k);
            kwPtsA += chaosMode ? 12 : 8;
          } else if (inB) {
            matchedKws.push(k);
            kwPtsB += chaosMode ? 12 : 8;
          }
        });

        if (matchedKws.length > 0) {
          const cappedA = Math.min(26, kwPtsA);
          const cappedB = Math.min(26, kwPtsB);
          affinityA += cappedA;
          affinityB += cappedB;
          traits.push({
            label: `Tema & Anahtar Kelime (${matchedKws.slice(0, 3).join(', ')})`,
            points: cappedA + cappedB,
          });
        }

        // 5. KONU ÖZETİ & HİKAYE MOTİFLERİ (Üst Sınırlı & Doğrulanmış Kelimeler)
        const candStems = extractKeywordsFromText(candidate.overview);
        const storyWords: string[] = [];
        let storyPtsA = 0;
        let storyPtsB = 0;

        candStems.forEach((origWord, stem) => {
          const inA = stemsA.has(stem);
          const inB = stemsB.has(stem);
          if (inA && inB) {
            storyWords.push(origWord);
            storyPtsA += 4.5;
            storyPtsB += 4.5;
          } else if (inA) {
            storyWords.push(origWord);
            storyPtsA += 3;
          } else if (inB) {
            storyWords.push(origWord);
            storyPtsB += 3;
          }
        });

        if (storyWords.length > 0) {
          // Uzun özetlerin haksız üstünlük kurmasını önlemek için puanı maksimum 18 ile sınırlıyoruz
          const cappedStoryA = Math.min(10, storyPtsA);
          const cappedStoryB = Math.min(10, storyPtsB);
          affinityA += cappedStoryA;
          affinityB += cappedStoryB;
          traits.push({
            label: `Hikaye & Konu Kesişimi (${storyWords.slice(0, 3).join(', ')})`,
            points: Math.round(cappedStoryA + cappedStoryB),
          });
        }

        // 6. YAPIMCI STÜDYO EŞLEŞMESİ
        const candStudios = (candidate.studios || []).filter((s) => norm(s).length > 0);
        const matchedStudios: string[] = [];
        let stPtsA = 0;
        let stPtsB = 0;

        candStudios.forEach((s) => {
          const ns = norm(s);
          if (studiosA.has(ns)) {
            matchedStudios.push(s);
            stPtsA += 12;
          }
          if (studiosB.has(ns)) {
            if (!matchedStudios.includes(s)) matchedStudios.push(s);
            stPtsB += 12;
          }
        });

        if (matchedStudios.length > 0) {
          const cA = Math.min(14, stPtsA);
          const cB = Math.min(14, stPtsB);
          affinityA += cA;
          affinityB += cB;
          traits.push({
            label: `Yapımcı Stüdyo (${matchedStudios.slice(0, 2).join(', ')})`,
            points: cA + cB,
          });
        }

        // 7. SÜRE & TEMPO ORTALAMASI
        if (avgParentRuntime > 0 && candidate.runtime && candidate.runtime > 0) {
          const diffAvg = Math.abs(candidate.runtime - avgParentRuntime);
          if (diffAvg <= 15) {
            const pts = 10;
            affinityA += pts / 2;
            affinityB += pts / 2;
            traits.push({
              label: `Süre & Tempo Ortalaması (${candidate.runtime} dk)`,
              points: pts,
            });
          }
        }

        // 8. DÖNEM (YIL) VE ÜLKE/DİL SİNEMASI UYUMU
        const candYear = parseInt(candidate.year || '0', 10);
        if (candYear > 1900 && avgParentYear > 1900) {
          const diffYear = Math.abs(candYear - avgParentYear);
          const betweenParents =
            yearA > 1900 &&
            yearB > 1900 &&
            candYear >= Math.min(yearA, yearB) &&
            candYear <= Math.max(yearA, yearB);

          if (diffYear <= 5 || betweenParents) {
            const pts = 8;
            affinityA += pts / 2;
            affinityB += pts / 2;
            traits.push({
              label: `Dönem Sentezi (${candYear} Yapımı)`,
              points: pts,
            });
          }
        }

        if (candidate.originalLanguage && candidate.originalLanguage !== 'en') {
          const inA = candidate.originalLanguage === movieA.originalLanguage;
          const inB = candidate.originalLanguage === movieB.originalLanguage;
          if (inA || inB) {
            const pts = 14;
            if (inA) affinityA += pts;
            if (inB) affinityB += pts;
            traits.push({
              label: `Ülke / Dil Sineması (${candidate.originalLanguage.toUpperCase()})`,
              points: pts,
            });
          }
        }

        // 9. KOLEKSİYON / EVREN BAĞI
        if (candidate.collectionId) {
          const inColA = candidate.collectionId === movieA.collectionId;
          const inColB = candidate.collectionId === movieB.collectionId;
          if (inColA || inColB) {
            const pts = 24;
            if (inColA) affinityA += pts;
            if (inColB) affinityB += pts;
            traits.push({
              label: `Aynı Seri / Sinematik Evren Bağı`,
              points: pts,
            });
          }
        }

        const basePoints = affinityA + affinityB;
        if (basePoints <= 0) return;

        // MELEZLEME SİNERJİ ÇARPANI:
        // Aday film hem 1. Filmden hem 2. Filmden özellik taşıyorsa (gerçek melezse) ödüllendirilir,
        // sadece tek bir filme benziyor ve diğer filmle hiç bağı yoksa puanı kırpılır.
        let synergyMultiplier = 1;
        if (affinityA > 0 && affinityB > 0) {
          const balanceRatio = Math.min(affinityA, affinityB) / Math.max(affinityA, affinityB);
          synergyMultiplier = 1.15 + balanceRatio * 0.35; // 1.15x ile 1.50x arası melezlik bonusu
        } else {
          synergyMultiplier = 0.6; // Sadece tek ebeveyne benzeyenleri geri plana at
        }

        // Mutasyon / Varyasyon Etkisi
        let mutationNoise = 0;
        if (chaosMode) {
          mutationNoise = Math.random() * 14;
          if (mutationNoise > 4) {
            traits.push({ label: 'Deneysel Kaos Mutasyonu', points: Math.round(mutationNoise) });
          }
        } else if (!safeMode) {
          mutationNoise = Math.random() * 3.5;
        }

        const finalRawScore = basePoints * synergyMultiplier + mutationNoise;

        // Yüzdelik dağılımı gerçek eşleşen özelliklerden oluştur
        const sortedTraits = traits.filter((t) => t.points > 0).sort((a, b) => b.points - a.points).slice(0, 5);
        const totalTraitPoints = sortedTraits.reduce((sum, t) => sum + t.points, 0) || 1;

        const composition = sortedTraits.map((t) => ({
          label: t.label,
          pct: Math.max(1, Math.round((t.points / totalTraitPoints) * 100)),
        }));

        const compSum = composition.reduce((sum, c) => sum + c.pct, 0);
        if (compSum !== 100 && composition.length > 0) {
          composition[0].pct += 100 - compSum;
        }

        const totalAffinity = affinityA + affinityB || 1;
        const parentAPct = Math.round((affinityA / totalAffinity) * 100);
        const parentBPct = 100 - parentAPct;

        // Uyum yüzdesi
        const matchScore = Math.min(99, Math.max(54, Math.round(48 + Math.min(51, finalRawScore * 0.68))));

        scoredCandidates.push({
          movie: candidate,
          rawScore: finalRawScore,
          matchScore,
          parentAPct,
          parentBPct,
          composition,
        });
      });

      scoredCandidates.sort((a, b) => b.rawScore - a.rawScore);

      // Eğer hiç ortak nokta bulunamadıysa (çok nadir), en azından rastgele 3 aday göster
      if (scoredCandidates.length === 0 && eligibleUnwatchedMovies.length > 0) {
        const fallback = eligibleUnwatchedMovies
          .filter((m) => m.id !== movieA.id && m.id !== movieB.id)
          .slice(0, 3)
          .map((m) => ({
            movie: m,
            rawScore: 10,
            matchScore: 55,
            parentAPct: 50,
            parentBPct: 50,
            composition: [{ label: 'Bağımsız Genetik Keşif Önerisi', pct: 100 }],
          }));
        setVariants(fallback);
      } else {
        setVariants(scoredCandidates.slice(0, 3));
      }

      setActiveVariantIdx(0);
      setStep('result');
    }, 1400);
  };

  const handleSelectMovie = (movie: Movie) => {
    if (selectingSlot === 'A') setMovieA(movie);
    else if (selectingSlot === 'B') setMovieB(movie);
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
        <div className="flex items-center justify-between px-6 py-5 border-b border-ink-800/50 bg-gradient-to-r from-emerald-950/40 to-ink-900">
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
              <p className="text-xs text-emerald-400/80">Çapraz Genetik Eşleştirme Laboratuvarı</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-white transition-colors bg-ink-800/50 hover:bg-ink-800 p-2 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* İÇERİK BÖLÜMÜ */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
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
                        {m.directors && m.directors.length > 0 ? m.directors[0] : m.genres.slice(0, 2).join(', ')}
                        {m.year && ` · ${m.year}`}
                      </div>
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
            <div className="space-y-6 animate-fade-in flex flex-col items-center">
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
                      Seçtiğin iki filmin <strong>tür, yönetmen, oyuncu, anahtar kelime, konu ve dönem</strong> verileri çaprazlanarak her ikisinden de izler taşıyan melez film bulunur.
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

                  {/* YUVA A VE YUVA B */}
                  <div className="grid grid-cols-2 gap-4 w-full">
                    {[
                      { slot: 'A' as const, movie: movieA, label: '1. Ebeveyn DNA' },
                      { slot: 'B' as const, movie: movieB, label: '2. Ebeveyn DNA' },
                    ].map(({ slot, movie, label }) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectingSlot(slot)}
                        className={`relative rounded-2xl border-2 border-dashed p-3 flex flex-col items-center justify-between min-h-[220px] transition-all overflow-hidden group ${
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
                                className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-20 transition-opacity"
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

                            <div className="relative z-10 my-2 text-center">
                              <div className="font-black text-white text-sm sm:text-base drop-shadow-md line-clamp-2">
                                {movie.title}
                              </div>
                              <div className="text-[11px] text-ink-300 mt-1">
                                {movie.year} {movie.runtime ? `· ${movie.runtime} dk` : ''}
                              </div>
                              {movie.directors && movie.directors.length > 0 && (
                                <div className="text-[10px] text-emerald-300 font-bold mt-1 truncate">
                                  🎬 {movie.directors[0]}
                                </div>
                              )}
                              {movie.genres.length > 0 && (
                                <div className="text-[10px] text-ink-400 mt-1 truncate">
                                  {movie.genres.slice(0, 2).join(' · ')}
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

                  {/* MUTASYON AYARI */}
                  <div className="w-full bg-ink-950/50 border border-ink-800 rounded-2xl p-4 space-y-2.5">
                    <div className="flex justify-between text-xs font-bold text-ink-400 uppercase tracking-wider">
                      <span>Genetik Sentez Modu</span>
                      <span className="text-emerald-400">
                        {mutationRate === 0 ? 'Safkan (Tam Eşleşme)' : mutationRate === 1 ? 'Dengeli Melez' : 'Kaos (Deneysel)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { val: 0, title: '🛡️ Safkan', sub: 'Sıfır rastgelelik, net bağlar' },
                        { val: 1, title: '⚖️ Dengeli', sub: 'İki ebeveynden eşit sentez' },
                        { val: 2, title: '⚡ Kaos Modu', sub: 'Gizli tema & sürpriz bağlar' },
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
                    disabled={!movieA || !movieB}
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
                <h3 className="text-xl font-black text-white tracking-widest">EBEVEYN GENLERİ ÇAPRAZLANIYOR...</h3>
                <p className="text-sm text-emerald-400/80 animate-pulse">
                  {movieA?.title} × {movieB?.title} ortak özellikleri taranıyor...
                </p>
              </div>
            </div>
          )}

          {/* DURUM 4: SONUÇ EKRANI (TOP 3 VARYANT SEÇENEĞİ İLE) */}
          {!selectingSlot && step === 'result' && currentResult && (
            <div className="animate-fade-in-up space-y-4">
              {/* Üst Varyant Seçici Sekmeler */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                  <Sparkles size={14} /> Sentez Başarılı
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
                        {idx === 0 ? '1. Varyant' : `${idx + 1}. Varyant`} (%{v.matchScore})
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

                {/* Sağ: Künye, DNA Barları ve İzleme Linkleri */}
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
                          <User size={12} /> {currentResult.movie.directors[0]}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-ink-400 mt-1">
                      {currentResult.movie.genres.join(' · ')}
                    </div>

                    {/* İzleme ve Fragman Linkleri */}
                    <div className="flex items-center justify-center md:justify-start gap-1.5 flex-wrap my-3.5">
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

                    {/* %100 DOĞRULANMIŞ DNA İLERLEME BARLARI */}
                    <div className="space-y-2.5 bg-ink-900/60 p-3.5 rounded-xl border border-ink-800 text-left">
                      <div className="text-[10px] font-black text-ink-400 uppercase tracking-widest flex justify-between">
                        <span>Eşleşen Genetik Özellikler</span>
                        <span className="text-emerald-400">%100</span>
                      </div>
                      {currentResult.composition.map((c, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-emerald-100 gap-2">
                            <span className="flex items-center gap-1.5 truncate">
                              <Dna size={12} className="text-emerald-400 flex-shrink-0" />
                              <span className="truncate">{c.label}</span>
                            </span>
                            <span className="text-emerald-400 font-black flex-shrink-0">%{c.pct}</span>
                          </div>
                          <div className="w-full h-1.5 bg-ink-950 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                              style={{ width: `${c.pct}%` }}
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