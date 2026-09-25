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
  Tag,
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

interface SynthCandidate {
  movie: Movie;
  matchScore: number;
  composition: { label: string; pct: number }[];
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

  // En iyi 3 sentez varyantını tutuyoruz
  const [variants, setVariants] = useState<
    {
      movie: Movie;
      matchScore: number;
      composition: { label: string; pct: number }[];
    }[]
  >([]);
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);

  const [mutationRate, setMutationRate] = useState<number>(1);

  const unwatchedMovies = useMemo(() => data.movies.filter((m) => !m.watched), [data.movies]);
  const historyMovies = useMemo(() => data.movies.filter((m) => m.watched), [data.movies]);

  const filteredMovies = useMemo(() => {
    const sourceList = selectionTab === 'history' ? historyMovies : data.movies;
    if (!search.trim()) return sourceList;
    const q = search.toLocaleLowerCase('tr-TR');
    return sourceList.filter(
      (m) =>
        m.title.toLocaleLowerCase('tr-TR').includes(q) ||
        (m.directors && m.directors.some((d) => d.toLocaleLowerCase('tr-TR').includes(q))) ||
        (m.cast && m.cast.some((c) => c.toLocaleLowerCase('tr-TR').includes(q)))
    );
  }, [data.movies, historyMovies, selectionTab, search]);

  // Kullanıcının geçmişte yüksek puan (8.0+) verdiği favori yönetmen ve oyuncuları çıkar (Kişisel İzleyici DNA'sı)
  const userFavoriteGenome = useMemo(() => {
    const favDirectors = new Set<string>();
    const favActors = new Set<string>();
    const favStudios = new Set<string>();

    historyMovies.forEach((m) => {
      if (m.rating !== null && m.rating >= 8) {
        (m.directors || []).forEach((d) => favDirectors.add(d.toLocaleLowerCase('tr-TR').trim()));
        (m.cast || []).forEach((a) => favActors.add(a.toLocaleLowerCase('tr-TR').trim()));
        (m.studios || []).forEach((s) => favStudios.add(s.toLocaleLowerCase('tr-TR').trim()));
      }
    });

    return { favDirectors, favActors, favStudios };
  }, [historyMovies]);

  // Tek tıkla favorilerden veya kütüphaneden rastgele 2 denek seçme
  const handleRandomPair = () => {
    const highRated = historyMovies.filter((m) => (m.rating || 0) >= 8);
    const pool = highRated.length >= 2 ? highRated : data.movies;
    if (pool.length < 2) return;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setMovieA(shuffled[0]);
    setMovieB(shuffled[1]);
  };

  // =========================================================
  // 12 KATMANLI GELİŞMİŞ DNA SENTEZ MOTORU
  // =========================================================
  const handleSynthesize = () => {
    if (!movieA || !movieB || unwatchedMovies.length === 0) return;
    setStep('synthesizing');

    setTimeout(() => {
      const safeMode = mutationRate === 0;
      const chaosMode = mutationRate === 2;

      const stopWords = new Set([
        'bir', 've', 'ile', 'için', 'bu', 'da', 'de', 'çok', 'daha', 'en', 'gibi', 'kadar',
        'olan', 'olarak', 'sonra', 'önce', 'kendi', 'ise', 'ya', 'veya', 'ama', 'fakat',
        'göre', 'tüm', 'bütün', 'her', 'hiç', 'bazı', 'biraz', 'şu', 'onu', 'bunu', 'ona',
      ]);

      const extractWords = (text?: string) => {
        if (!text) return new Set<string>();
        const clean = text.toLocaleLowerCase('tr-TR').replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ');
        return new Set(clean.split(/\s+/).filter((w) => w.length > 4 && !stopWords.has(w)));
      };

      // Hem filmin kendi özetini hem de kullanıcının o filme yazdığı kişisel inceleme notunu tarıyoruz!
      const wordsA = extractWords(`${movieA.overview || ''} ${movieA.note || ''}`);
      const wordsB = extractWords(`${movieB.overview || ''} ${movieB.note || ''}`);

      const decadeA = Math.floor(parseInt(movieA.year || '0') / 10) * 10;
      const decadeB = Math.floor(parseInt(movieB.year || '0') / 10) * 10;

      // Ebeveyn filmlerin süre (tempo) ortalaması
      const rtA = movieA.runtime || 0;
      const rtB = movieB.runtime || 0;
      const avgParentRuntime =
        rtA > 0 && rtB > 0 ? Math.round((rtA + rtB) / 2) : rtA > 0 ? rtA : rtB > 0 ? rtB : 0;

      // Ebeveyn filmlerde seçilen Değerlendirme Başlıkları (🔥 Başyapıt, 🎭 Oyunculuk Muazzam vb.) ve Detaylı Kriter çarpanları
      const parentTags = new Set([
        ...(movieA.reviewTags || []),
        ...(movieB.reviewTags || []),
      ]);
      const hasActingTag = Array.from(parentTags).some((t) =>
        t.toLocaleLowerCase('tr-TR').includes('oyunculuk')
      );
      const hasVisualOrDirectorTag = Array.from(parentTags).some(
        (t) =>
          t.toLocaleLowerCase('tr-TR').includes('görsel') ||
          t.toLocaleLowerCase('tr-TR').includes('başyapıt')
      );

      // Ebeveynlerin kullanıcının verdiği puana göre ağırlık bonusu
      const parentRatingBoost =
        ((movieA.rating || 7.5) + (movieB.rating || 7.5)) / 15; // ~0.8 - 1.33 arası çarpan

      const scoredCandidates: {
        movie: Movie;
        totalScore: number;
        matchScore: number;
        composition: { label: string; pct: number }[];
      }[] = [];

      unwatchedMovies.forEach((candidate) => {
        if (candidate.id === movieA.id || candidate.id === movieB.id) return;

        let sG = 0, // Tür
          sK = 0, // Tema / Keywords
          sD = 0, // Yönetmen
          sC = 0, // Oyuncu Kadrosu
          sS = 0, // Stüdyo
          sO = 0, // Hikaye & Not Kelimeleri
          sE = 0, // Dönem & Dil
          sR = 0, // Süre & Tempo Uyumu
          sCol = 0, // Koleksiyon / Evren Bağı
          sFav = 0, // Kullanıcının Favori Yönetmen/Oyuncu Geçmişi
          sM = 0; // Genetik Mutasyon

        const mG: string[] = [],
          mK: string[] = [],
          mD: string[] = [],
          mC: string[] = [],
          mS: string[] = [],
          mE: string[] = [],
          mL: string[] = [],
          mFav: string[] = [];

        // 1. Tür Eşleşmesi
        candidate.genres.forEach((g) => {
          const inA = movieA.genres.includes(g);
          const inB = movieB.genres.includes(g);
          if (inA || inB) {
            mG.push(g);
            sG += inA && inB ? (chaosMode ? 8 : 22) : chaosMode ? 4 : 11;
          }
        });

        // 2. TMDB DNA Etiketleri (Keywords)
        if (candidate.keywords) {
          candidate.keywords.forEach((k) => {
            const cleanK = k.toLocaleLowerCase('tr-TR').trim();
            const inA = movieA.keywords?.some((ka) => ka.toLocaleLowerCase('tr-TR').trim() === cleanK);
            const inB = movieB.keywords?.some((kb) => kb.toLocaleLowerCase('tr-TR').trim() === cleanK);
            if (inA || inB) {
              mK.push(k);
              sK += inA && inB ? (chaosMode ? 35 : 18) : chaosMode ? 15 : 9;
            }
          });
        }

        // 3. Yönetmen İmzası (Başyapıt / Görsel etiketi varsa ekstra güçlü)
        if (candidate.directors) {
          candidate.directors.forEach((d) => {
            const cleanD = d.toLocaleLowerCase('tr-TR').trim();
            const inA = movieA.directors?.some((dir) => dir.toLocaleLowerCase('tr-TR').trim() === cleanD);
            const inB = movieB.directors?.some((dir) => dir.toLocaleLowerCase('tr-TR').trim() === cleanD);
            if (inA || inB) {
              mD.push(d);
              sD += hasVisualOrDirectorTag ? 45 : 35;
            } else if (userFavoriteGenome.favDirectors.has(cleanD)) {
              mFav.push(d);
              sFav += 16;
            }
          });
        }

        // 4. Başrol Oyuncuları (Oyunculuk etiketi varsa ekstra güçlü)
        if (candidate.cast) {
          candidate.cast.forEach((c) => {
            const cleanC = c.toLocaleLowerCase('tr-TR').trim();
            const inA = movieA.cast?.some((actor) => actor.toLocaleLowerCase('tr-TR').trim() === cleanC);
            const inB = movieB.cast?.some((actor) => actor.toLocaleLowerCase('tr-TR').trim() === cleanC);
            if (inA || inB) {
              mC.push(c);
              sC += hasActingTag ? 28 : 20;
            } else if (userFavoriteGenome.favActors.has(cleanC)) {
              mFav.push(c);
              sFav += 10;
            }
          });
        }

        // 5. Yapımcı Stüdyo
        if (candidate.studios) {
          candidate.studios.forEach((s) => {
            const cleanS = s.toLocaleLowerCase('tr-TR').trim();
            const inA = movieA.studios?.some((st) => st.toLocaleLowerCase('tr-TR').trim() === cleanS);
            const inB = movieB.studios?.some((st) => st.toLocaleLowerCase('tr-TR').trim() === cleanS);
            if (inA || inB) {
              mS.push(s);
              sS += safeMode ? 16 : 8;
            }
          });
        }

        // 6. Konu & Kişisel İnceleme Notu Kelime Kesişimi
        const wordsC = extractWords(candidate.overview);
        let matchCount = 0;
        wordsC.forEach((w) => {
          if (wordsA.has(w) || wordsB.has(w)) matchCount++;
        });
        if (matchCount > 0) {
          sO += safeMode ? matchCount * 5 : matchCount * 3.5;
        }

        // 7. Dönem (On Yıl) ve Orijinal Dil / Ülke Sineması Uyumu
        const decadeCand = Math.floor(parseInt(candidate.year || '0') / 10) * 10;
        if (decadeCand > 1900 && (decadeCand === decadeA || decadeCand === decadeB)) {
          sE += 7;
          mE.push(`${decadeCand}'ler Dönemi`);
        }
        if (candidate.originalLanguage) {
          if (
            candidate.originalLanguage === movieA.originalLanguage ||
            candidate.originalLanguage === movieB.originalLanguage
          ) {
            const langBonus = candidate.originalLanguage !== 'en' ? 14 : 5;
            sE += langBonus;
            mL.push(`Dil/Ülke (${candidate.originalLanguage.toUpperCase()})`);
          }
        }

        // 8. YENİ: Süre & Tempo Uyumu (Runtime)
        if (avgParentRuntime > 0 && candidate.runtime && candidate.runtime > 0) {
          const diff = Math.abs(candidate.runtime - avgParentRuntime);
          if (diff <= 15) {
            sR += 12;
          } else if (diff <= 25) {
            sR += 6;
          }
        }

        // 9. YENİ: Koleksiyon & Evren Bağı
        if (
          candidate.collectionId &&
          (candidate.collectionId === movieA.collectionId ||
            candidate.collectionId === movieB.collectionId)
        ) {
          sCol += 25;
        }

        // 10. Mutasyon Faktörü
        if (chaosMode) {
          sM += Math.random() * 28;
        } else if (!safeMode) {
          sM += Math.random() * 9;
        }

        const rawTotal = (sG + sK + sD + sC + sS + sO + sE + sR + sCol + sFav) * parentRatingBoost + sM;
        const totalPoints = sG + sK + sD + sC + sS + sO + sE + sR + sCol + sFav + sM;

        const comp: { label: string; pct: number }[] = [];
        if (totalPoints > 0) {
          if (sD > 0 && mD.length > 0) {
            comp.push({
              label: `Ortak Yönetmen İmzası (${Array.from(new Set(mD)).join(', ')})`,
              pct: Math.round((sD / totalPoints) * 100),
            });
          }
          if (sC > 0 && mC.length > 0) {
            comp.push({
              label: `Ortak Oyuncu Kadrosu (${Array.from(new Set(mC)).slice(0, 2).join(', ')})`,
              pct: Math.round((sC / totalPoints) * 100),
            });
          }
          if (sCol > 0) {
            comp.push({
              label: `Aynı Sinematik Evren / Koleksiyon Bağı`,
              pct: Math.round((sCol / totalPoints) * 100),
            });
          }
          if (sG > 0 && mG.length > 0) {
            comp.push({
              label: `Tür Genetiği (${Array.from(new Set(mG)).slice(0, 3).join(', ')})`,
              pct: Math.round((sG / totalPoints) * 100),
            });
          }
          if (sK > 0 && mK.length > 0) {
            comp.push({
              label: `Ortak Tema DNA'sı (${Array.from(new Set(mK)).slice(0, 2).join(', ')})`,
              pct: Math.round((sK / totalPoints) * 100),
            });
          }
          if (sFav > 0 && mFav.length > 0) {
            comp.push({
              label: `Kişisel Favori Genetiğin (${Array.from(new Set(mFav)).slice(0, 2).join(', ')})`,
              pct: Math.round((sFav / totalPoints) * 100),
            });
          }
          if (sR > 0 && candidate.runtime) {
            comp.push({
              label: `Süre & Tempo Uyumu (${candidate.runtime} dk)`,
              pct: Math.round((sR / totalPoints) * 100),
            });
          }
          if (sO > 0) {
            comp.push({
              label: `Hikaye Örgüsü & İnceleme Notu Uyumu`,
              pct: Math.round((sO / totalPoints) * 100),
            });
          }
          if (sS > 0 && mS.length > 0) {
            comp.push({
              label: `Yapımcı Stüdyo (${mS[0]})`,
              pct: Math.round((sS / totalPoints) * 100),
            });
          }
          if (sE > 0 && (mE.length > 0 || mL.length > 0)) {
            comp.push({
              label: [...mE, ...mL].join(' · '),
              pct: Math.round((sE / totalPoints) * 100),
            });
          }
          if (sM > 0) {
            comp.push({
              label: 'Genetik Mutasyon & Sürpriz Faktörü',
              pct: Math.round((sM / totalPoints) * 100),
            });
          }
        } else {
          comp.push({ label: 'Saf Genetik Mutasyon Çıktısı', pct: 100 });
        }

        const filteredComp = comp.filter((c) => c.pct > 0).sort((a, b) => b.pct - a.pct);
        const currentSum = filteredComp.reduce((acc, c) => acc + c.pct, 0);
        if (currentSum !== 100 && filteredComp.length > 0) {
          filteredComp[0].pct += 100 - currentSum;
        }

        const matchScore = Math.min(99, Math.max(52, Math.floor(48 + rawTotal * 0.85)));

        scoredCandidates.push({
          movie: candidate,
          totalScore: rawTotal,
          matchScore,
          composition: filteredComp,
        });
      });

      scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);
      const topVariants = scoredCandidates.slice(0, 3);

      setVariants(topVariants);
      setActiveVariantIdx(0);
      setStep('result');
    }, 1800);
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
              <p className="text-xs text-emerald-400/80">12 Katmanlı Genetik Çaprazlama Laboratuvarı</p>
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
                      {m.reviewTags && m.reviewTags.length > 0 && (
                        <div className="text-[10px] text-emerald-400 truncate mt-0.5 font-semibold">
                          {m.reviewTags[0]}
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
            <div className="space-y-6 animate-fade-in flex flex-col items-center">
              {unwatchedMovies.length === 0 ? (
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
                      İki filmi çaprazla; <strong>yönetmen, oyuncu, tema, süre, dönem ve senin değerlendirme başlıkların</strong> analiz edilerek en uyumlu film sentezlensin.
                    </p>
                    {data.movies.length >= 2 && (
                      <button
                        type="button"
                        onClick={handleRandomPair}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-xl transition-all"
                      >
                        <Shuffle size={13} /> Favorilerden Doldur
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
                              {movie.reviewTags && movie.reviewTags.length > 0 && (
                                <div className="inline-block text-[10px] bg-gold-500/20 text-gold-300 border border-gold-500/30 px-2 py-0.5 rounded-md mt-1.5 font-bold">
                                  {movie.reviewTags[0]}
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

                  {/* MUTASYON AYARI (3 SEÇENEKLİ MODERN BUTONLAR) */}
                  <div className="w-full bg-ink-950/50 border border-ink-800 rounded-2xl p-4 space-y-2.5">
                    <div className="flex justify-between text-xs font-bold text-ink-400 uppercase tracking-wider">
                      <span>Genetik Mutasyon Oranı</span>
                      <span className="text-emerald-400">
                        {mutationRate === 0 ? 'Safkan (Güvenli)' : mutationRate === 1 ? 'Dengeli Sentez' : 'Kaos (Deneysel)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { val: 0, title: '🛡️ Güvenli', sub: 'Yönetmen & Tür odaklı' },
                        { val: 1, title: '⚖️ Dengeli', sub: 'Tüm DNA katmanları' },
                        { val: 2, title: '⚡ Kaos Modu', sub: 'Gizli temalar & Sürpriz' },
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
                    <Beaker size={20} /> DNA Sentezini Başlat ({unwatchedMovies.length} Aday)
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
                <h3 className="text-xl font-black text-white tracking-widest">12 GENETİK KATMAN TARANIYOR...</h3>
                <p className="text-sm text-emerald-400/80 animate-pulse">
                  Yönetmenler, oyuncular, temalar, süre temposu ve kişisel zevk genomun çaprazlanıyor...
                </p>
              </div>
            </div>
          )}

          {/* DURUM 4: SONUÇ EKRANI (TOP 3 VARYANT SEÇENEĞİ İLE) */}
          {!selectingSlot && step === 'result' && currentResult && (
            <div className="animate-fade-in-up space-y-5">
              {/* Üst Varyant Seçici Sekmeler */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                  <Sparkles size={14} /> Sentez Tamamlandı
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
                        {idx === 0 ? '1. Ana Sentez' : `${idx + 1}. Varyant`} (%{v.matchScore})
                      </button>
                    ))}
                  </div>
                )}
              </div>

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

                    {/* %100 DNA İLERLEME BARLARI */}
                    <div className="space-y-2.5 bg-ink-900/60 p-3.5 rounded-xl border border-ink-800 text-left">
                      <div className="text-[10px] font-black text-ink-400 uppercase tracking-widest flex justify-between">
                        <span>Genetik Uyum Kırılımı (Neden Seçildi?)</span>
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

      {/* PUANLAMA MODALI (Detaylı Kriter & Değerlendirme Başlıkları Desteğiyle) */}
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