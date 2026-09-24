import { useState, useMemo } from 'react';
import { X, Dna, Search, Beaker, ChevronLeft, Sparkles, Image as ImageIcon, Plus, Clock, Star, PlayCircle, ExternalLink } from 'lucide-react';
import { useApp } from '../context/AppContext';
import RatingModal from './RatingModal';
import type { Movie } from '../types';

interface DnaSynthesizerModalProps {
  onClose: () => void;
}

type Step = 'select' | 'synthesizing' | 'result';
type Slot = 'A' | 'B' | null;
type SelectionTab = 'library' | 'history';

export default function DnaSynthesizerModal({ onClose }: DnaSynthesizerModalProps) {
  const { data, watchMovie } = useApp();
  const [step, setStep] = useState<Step>('select');
  const [movieA, setMovieA] = useState<Movie | null>(null);
  const [movieB, setMovieB] = useState<Movie | null>(null);
  const [selectingSlot, setSelectingSlot] = useState<Slot>(null);
  const [selectionTab, setSelectionTab] = useState<SelectionTab>('library');
  const [search, setSearch] = useState('');
  
  const [showRating, setShowRating] = useState(false);
  const [result, setResult] = useState<{ 
    movie: Movie; 
    matchScore: number; 
    composition: { label: string; pct: number }[] 
  } | null>(null);
  
  const [mutationRate, setMutationRate] = useState<number>(1); 

  const unwatchedMovies = useMemo(() => data.movies.filter(m => !m.watched), [data.movies]);
  const historyMovies = useMemo(() => data.movies.filter(m => m.watched), [data.movies]);

  const filteredMovies = useMemo(() => {
    const sourceList = selectionTab === 'history' ? historyMovies : data.movies;
    if (!search.trim()) return sourceList;
    const q = search.toLocaleLowerCase('tr-TR');
    return sourceList.filter(m => m.title.toLocaleLowerCase('tr-TR').includes(q));
  }, [data.movies, historyMovies, selectionTab, search]);

  const handleSynthesize = () => {
    if (!movieA || !movieB || unwatchedMovies.length === 0) return;
    setStep('synthesizing');

    setTimeout(() => {
      let bestMatch: Movie | null = null;
      let highestScore = -1;
      
      let bestDetails = { 
        genres: [] as string[], 
        keywords: [] as string[], 
        directors: [] as string[], 
        cast: [] as string[], 
        studios: [] as string[], 
        era: [] as string[],
        lang: [] as string[]
      };
      let bestScores = { genres: 0, keywords: 0, directors: 0, cast: 0, studios: 0, overview: 0, era: 0, mutation: 0 };

      const safeMode = mutationRate === 0;
      const chaosMode = mutationRate === 2;

      const stopWords = new Set(['bir','ve','ile','için','bu','da','de','çok','daha','en','gibi','kadar','olan','olarak','sonra','önce','kendi','ise','ya','veya','ama','fakat','göre','tüm','bütün','her','hiç','bazı','biraz','şu','onu','bunu','ona']);
      
      const extractWords = (text?: string) => {
        if (!text) return new Set<string>();
        const clean = text.toLocaleLowerCase('tr-TR').replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ");
        return new Set(clean.split(/\s+/).filter(w => w.length > 4 && !stopWords.has(w)));
      };

      const wordsA = extractWords(movieA.overview);
      const wordsB = extractWords(movieB.overview);
      
      const decadeA = Math.floor(parseInt(movieA.year || '0') / 10) * 10;
      const decadeB = Math.floor(parseInt(movieB.year || '0') / 10) * 10;

      unwatchedMovies.forEach(candidate => {
        if (candidate.id === movieA.id || candidate.id === movieB.id) return;

        let sG = 0, sK = 0, sD = 0, sC = 0, sS = 0, sO = 0, sE = 0, sM = 0;
        let mG: string[] = [], mK: string[] = [], mD: string[] = [], mC: string[] = [], mS: string[] = [], mE: string[] = [], mL: string[] = [];

        candidate.genres.forEach(g => {
          const inA = movieA.genres.includes(g);
          const inB = movieB.genres.includes(g);
          if (inA || inB) { 
            mG.push(g);
            sG += (inA && inB) ? (chaosMode ? 5 : 20) : (chaosMode ? 2 : 10); 
          }
        });

        if (candidate.keywords) {
          candidate.keywords.forEach(k => {
            const inA = movieA.keywords?.includes(k);
            const inB = movieB.keywords?.includes(k);
            if (inA || inB) { 
              mK.push(k);
              sK += (inA && inB) ? (chaosMode ? 35 : 15) : (chaosMode ? 15 : 7); 
            }
          });
        }

        if (candidate.directors) {
          candidate.directors.forEach(d => {
            const cleanD = d.toLocaleLowerCase('tr-TR').trim();
            const inA = movieA.directors?.some(dir => dir.toLocaleLowerCase('tr-TR').trim() === cleanD);
            const inB = movieB.directors?.some(dir => dir.toLocaleLowerCase('tr-TR').trim() === cleanD);
            if (inA || inB) { 
              mD.push(d);
              sD += 35; 
            }
          });
        }

        if (candidate.cast) {
          candidate.cast.forEach(c => {
            const cleanC = c.toLocaleLowerCase('tr-TR').trim();
            const inA = movieA.cast?.some(actor => actor.toLocaleLowerCase('tr-TR').trim() === cleanC);
            const inB = movieB.cast?.some(actor => actor.toLocaleLowerCase('tr-TR').trim() === cleanC);
            if (inA || inB) { 
              mC.push(c);
              sC += 20; 
            }
          });
        }

        if (candidate.studios) {
          candidate.studios.forEach(s => {
            const cleanS = s.toLocaleLowerCase('tr-TR').trim();
            const inA = movieA.studios?.some(st => st.toLocaleLowerCase('tr-TR').trim() === cleanS);
            const inB = movieB.studios?.some(st => st.toLocaleLowerCase('tr-TR').trim() === cleanS);
            if (inA || inB) { 
              mS.push(s);
              sS += safeMode ? 15 : 5; 
            }
          });
        }

        const wordsC = extractWords(candidate.overview);
        let matchCount = 0;
        wordsC.forEach(w => {
            if (wordsA.has(w) || wordsB.has(w)) matchCount++;
        });
        if (matchCount > 1) { 
            sO += safeMode ? matchCount * 4 : matchCount * 3;
        }

        const decadeCand = Math.floor(parseInt(candidate.year || '0') / 10) * 10;
        if (decadeCand > 1900 && (decadeCand === decadeA || decadeCand === decadeB)) {
          sE += 5;
          mE.push(`${decadeCand}'ler Dönemi`);
        }
        if (candidate.originalLanguage && candidate.originalLanguage !== 'en') {
          if (candidate.originalLanguage === movieA.originalLanguage || candidate.originalLanguage === movieB.originalLanguage) {
            sE += 10;
            mL.push(`Orijinal Dil (${candidate.originalLanguage.toUpperCase()})`);
          }
        }

        if (chaosMode) {
          sM += Math.random() * 30; 
        } else if (!safeMode) {
          sM += Math.random() * 10; 
        }

        const totalScore = sG + sK + sD + sC + sS + sO + sE + sM;

        if (totalScore > highestScore) {
          highestScore = totalScore;
          bestMatch = candidate;
          bestScores = { genres: sG, keywords: sK, directors: sD, cast: sC, studios: sS, overview: sO, era: sE, mutation: sM };
          bestDetails = { genres: mG, keywords: mK, directors: mD, cast: mC, studios: mS, era: mE, lang: mL };
        }
      });

      if (bestMatch) {
        const matchScore = Math.min(99, Math.max(45, Math.floor(highestScore * 1.3 + (Math.random() * 10))));
        const totalPoints = bestScores.genres + bestScores.keywords + bestScores.directors + bestScores.cast + bestScores.studios + bestScores.overview + bestScores.era + bestScores.mutation;
        const comp: { label: string; pct: number }[] = [];
        
        if (totalPoints > 0) {
          if (bestScores.directors > 0 && bestDetails.directors.length > 0) {
            comp.push({ label: `Ortak Yönetmen İmzası (${Array.from(new Set(bestDetails.directors)).join(', ')})`, pct: Math.round((bestScores.directors / totalPoints) * 100) });
          }
          if (bestScores.cast > 0 && bestDetails.cast.length > 0) {
            comp.push({ label: `Ortak Oyuncu Kadrosu (${Array.from(new Set(bestDetails.cast)).slice(0, 2).join(', ')})`, pct: Math.round((bestScores.cast / totalPoints) * 100) });
          }
          if (bestScores.genres > 0 && bestDetails.genres.length > 0) {
            comp.push({ label: `Ortak Türler (${Array.from(new Set(bestDetails.genres)).slice(0, 2).join(', ')})`, pct: Math.round((bestScores.genres / totalPoints) * 100) });
          }
          if (bestScores.keywords > 0 && bestDetails.keywords.length > 0) {
            comp.push({ label: `Ortak Tema / Anahtar Kelimeler`, pct: Math.round((bestScores.keywords / totalPoints) * 100) });
          }
          if (bestScores.overview > 0) {
            comp.push({ label: `Ortak Hikaye Örgüsü ve Kurgu Stili`, pct: Math.round((bestScores.overview / totalPoints) * 100) });
          }
          if (bestScores.studios > 0 && bestDetails.studios.length > 0) {
            comp.push({ label: `Yapımcı Stüdyo (${bestDetails.studios[0]})`, pct: Math.round((bestScores.studios / totalPoints) * 100) });
          }
          if (bestScores.era > 0) {
            comp.push({ label: [...bestDetails.era, ...bestDetails.lang].join(' · '), pct: Math.round((bestScores.era / totalPoints) * 100) });
          }
          if (bestScores.mutation > 0) {
            comp.push({ label: 'Rastgele Genetik Mutasyon', pct: Math.round((bestScores.mutation / totalPoints) * 100) });
          }
        } else {
          comp.push({ label: 'Rastgele Mutasyon Çıktısı', pct: 100 });
        }

        const currentSum = comp.reduce((acc, c) => acc + c.pct, 0);
        if (currentSum !== 100 && comp.length > 0) {
          comp[0].pct += (100 - currentSum);
        }

        const finalComp = comp.filter(c => c.pct > 0).sort((a, b) => b.pct - a.pct);

        setResult({ movie: bestMatch, matchScore, composition: finalComp });
      }
      setStep('result');
    }, 2500);
  };

  const handleSelectMovie = (movie: Movie) => {
    if (selectingSlot === 'A') setMovieA(movie);
    else if (selectingSlot === 'B') setMovieB(movie);
    setSelectingSlot(null);
    setSearch('');
  };

  // İZLEME LİNKLERİ OLUŞTURUCU (DNA SONUCU İÇİN)
  const getWatchLinks = (movie: Movie) => {
    let links: {href: string; text: string; logo: string | null; icon: any}[] = [];

    if (movie.customUrl) {
      links.push({ href: movie.customUrl, text: 'Özel Kaynak', logo: null, icon: ExternalLink });
    }

    if (movie.watchProviders && movie.watchProviders.length > 0) {
      movie.watchProviders.slice(0, 2).forEach(provider => {
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
      icon: Search 
    });

    if (data.altWatchTemplate && (movie.imdbId || data.altWatchTemplate.includes('{slug}') || data.altWatchTemplate.includes('{title}'))) {
      const charMap: Record<string, string> = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
      const slug = movie.title.toLocaleLowerCase('tr-TR')
        .replace(/[çğıöşü]/g, match => charMap[match])
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
        
      let finalAltHref = data.altWatchTemplate
        .replace('{imdb}', movie.imdbId || '')
        .replace('{slug}', slug)
        .replace('{title}', encodeURIComponent(movie.title))
        .replace('{year}', movie.year || '');
        
      links.push({ href: finalAltHref, text: 'Alternatif', logo: null, icon: PlayCircle });
    }

    return links;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-ink-950/90 backdrop-blur-md animate-fade-in">
      <div className="bg-ink-900 border border-emerald-500/30 rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl shadow-emerald-900/20 flex flex-col max-h-full">
        
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-ink-800/50 bg-gradient-to-r from-emerald-950/40 to-ink-900">
          <div className="flex items-center gap-3">
            {selectingSlot ? (
              <button onClick={() => setSelectingSlot(null)} className="p-2 -ml-2 rounded-full hover:bg-ink-800 text-ink-300 transition-colors">
                <ChevronLeft size={20} />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <Dna size={20} className="text-emerald-400" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">Film DNA Sentezleyici</h2>
              <p className="text-xs text-emerald-400/80">Laboratuvar</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-white transition-colors bg-ink-800/50 hover:bg-ink-800 p-2 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* İÇERİK BÖLÜMÜ */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* DURUM 1: YUVA SEÇİMİ */}
          {selectingSlot && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input
                    type="text"
                    autoFocus
                    placeholder={selectionTab === 'history' ? "Geçmişte ara..." : "Kütüphanende ara..."}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-ink-950/50 border border-emerald-500/20 rounded-xl pl-12 pr-4 py-3 text-white placeholder-ink-600 focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>
                <button
                  onClick={() => setSelectionTab(prev => prev === 'library' ? 'history' : 'library')}
                  className={`px-4 flex items-center gap-2 rounded-xl font-bold transition-all border ${
                    selectionTab === 'history' 
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                      : 'bg-ink-950/50 border-ink-800 text-ink-500 hover:text-ink-300'
                  }`}
                >
                  <Clock size={18} />
                  <span className="hidden sm:inline">Geçmiş</span>
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {filteredMovies.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMovie(m)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-ink-800 bg-ink-950/30 hover:bg-ink-800 hover:border-emerald-500/30 transition-all text-left group relative overflow-hidden"
                  >
                    {m.watched && (
                      <div className="absolute top-0 right-0 bg-ink-800/80 text-ink-400 text-[10px] px-2 py-0.5 rounded-bl-lg font-bold flex items-center gap-1">
                        <Star size={10} className={m.rating ? 'text-gold-400' : ''} /> {m.rating || '-'}
                      </div>
                    )}
                    <div className="w-10 h-14 bg-ink-900 rounded overflow-hidden flex-shrink-0">
                      {m.posterUrl ? <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-ink-700" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-ink-200 truncate group-hover:text-emerald-400 transition-colors">{m.title}</div>
                      <div className="text-xs text-ink-500 truncate">{m.genres.join(', ')}</div>
                    </div>
                  </button>
                ))}
              </div>
              {filteredMovies.length === 0 && (
                <div className="text-center text-ink-500 py-8 text-sm">
                  {selectionTab === 'history' ? 'Geçmişinde bu isimde bir film yok.' : 'Kütüphanende bu isimde bir film yok.'}
                </div>
              )}
            </div>
          )}

          {/* DURUM 2: SENTEZ BEKLEME EKRANI */}
          {!selectingSlot && step === 'select' && (
            <div className="space-y-8 animate-fade-in flex flex-col items-center">
              {unwatchedMovies.length === 0 ? (
                <div className="text-center py-8">
                  <Beaker size={48} className="mx-auto text-ink-600 mb-4" />
                  <h3 className="text-lg font-bold text-ink-200">Denek Bulunamadı</h3>
                  <p className="text-sm text-ink-500 mt-2 max-w-md mx-auto">Sentezleme yapabilmek için kütüphanende izlenmemiş (bekleyen) filmler olması gerekiyor.</p>
                </div>
              ) : (
                <>
                  <div className="text-center max-w-md mx-auto">
                    <p className="text-ink-400 text-sm">DNA'sını birleştirmek istediğin iki filmi seç. Yapay zeka bu iki filmin genetiğini (yönetmen, oyuncu, tema) çaprazlayarak yeni bir tavsiye sunacak.</p>
                  </div>
                  
                  <div className="flex items-center justify-center gap-4 w-full">
                    {/* YUVA A */}
                    <button 
                      onClick={() => setSelectingSlot('A')}
                      className={`relative w-32 h-48 sm:w-40 sm:h-56 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden group ${movieA ? 'border-emerald-500/50 bg-ink-950/50' : 'border-ink-700 bg-ink-900/30 hover:border-emerald-500/30 hover:bg-ink-800/50'}`}
                    >
                      {movieA ? (
                        <>
                          {movieA.posterUrl ? <img src={movieA.posterUrl} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-30 transition-opacity" /> : null}
                          <div className="relative z-10 flex flex-col items-center p-3 text-center">
                            <span className="font-bold text-white text-sm drop-shadow-md">{movieA.title}</span>
                            <span className="text-[10px] text-emerald-400 mt-2 bg-ink-950/80 px-2 py-1 rounded-full border border-emerald-500/30">Değiştir</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-ink-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <Plus size={24} className="text-ink-400 group-hover:text-emerald-400" />
                          </div>
                          <span className="text-xs font-bold text-ink-500 uppercase tracking-widest">1. Genetik</span>
                        </>
                      )}
                    </button>

                    <div className="text-ink-600">
                      <X size={24} />
                    </div>

                    {/* YUVA B */}
                    <button 
                      onClick={() => setSelectingSlot('B')}
                      className={`relative w-32 h-48 sm:w-40 sm:h-56 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden group ${movieB ? 'border-emerald-500/50 bg-ink-950/50' : 'border-ink-700 bg-ink-900/30 hover:border-emerald-500/30 hover:bg-ink-800/50'}`}
                    >
                      {movieB ? (
                        <>
                          {movieB.posterUrl ? <img src={movieB.posterUrl} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-30 transition-opacity" /> : null}
                          <div className="relative z-10 flex flex-col items-center p-3 text-center">
                            <span className="font-bold text-white text-sm drop-shadow-md">{movieB.title}</span>
                            <span className="text-[10px] text-emerald-400 mt-2 bg-ink-950/80 px-2 py-1 rounded-full border border-emerald-500/30">Değiştir</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-ink-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <Plus size={24} className="text-ink-400 group-hover:text-emerald-400" />
                          </div>
                          <span className="text-xs font-bold text-ink-500 uppercase tracking-widest">2. Genetik</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* MUTASYON AYARI */}
                  <div className="w-full max-w-sm mt-4 bg-ink-950/30 border border-ink-800 rounded-xl p-4">
                    <div className="flex justify-between text-xs font-bold text-ink-400 mb-3 uppercase tracking-wider">
                      <span>Mutasyon Oranı</span>
                      <span className="text-emerald-400">{mutationRate === 0 ? 'Güvenli' : mutationRate === 1 ? 'Dengeli' : 'Kaos'}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="2" step="1" 
                      value={mutationRate} 
                      onChange={(e) => setMutationRate(parseInt(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                    <div className="text-[10px] text-ink-500 mt-2 text-center h-4">
                      {mutationRate === 0 ? 'Sadece yönetmen ve benzer filmleri önerir.' : mutationRate === 1 ? 'Yönetmen ve oyuncu eşleşmelerine odaklanır.' : 'Absürt ve gizli bağları bulur.'}
                    </div>
                  </div>

                  <button
                    disabled={!movieA || !movieB}
                    onClick={handleSynthesize}
                    className="w-full max-w-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-8 py-4 rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Beaker size={20} /> Sentezlemeyi Başlat
                  </button>
                </>
              )}
            </div>
          )}

          {/* DURUM 3: SENTEZ ANİMASYONU */}
          {!selectingSlot && step === 'synthesizing' && (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in space-y-6">
              <div className="relative">
                <Dna size={64} className="text-emerald-400 animate-spin-slow opacity-80" />
                <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-white tracking-widest">DNA İŞLENİYOR...</h3>
                <p className="text-sm text-emerald-400/80 animate-pulse">Yönetmenler, oyuncular ve temalar çaprazlanıyor...</p>
              </div>
            </div>
          )}

          {/* DURUM 4: SONUÇ EKRANI */}
          {!selectingSlot && step === 'result' && result && (
            <div className="animate-fade-in-up flex flex-col items-center">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
                <Sparkles size={14} /> Sentez Başarılı
              </div>
              
              <div className="flex flex-col md:flex-row gap-6 items-center md:items-stretch bg-ink-950/50 border border-ink-800 rounded-2xl p-5 w-full">
                <div className="w-32 md:w-40 flex-shrink-0 aspect-[2/3] bg-ink-900 rounded-xl overflow-hidden shadow-lg border border-ink-700/50 relative">
                  {result.movie.posterUrl ? <img src={result.movie.posterUrl} alt={result.movie.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="text-ink-700" size={32} /></div>}
                  <div className="absolute top-2 right-2 bg-emerald-500 text-ink-950 font-black text-xs px-2 py-1 rounded shadow-lg">
                    % {result.matchScore} Uyum
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col justify-center w-full text-center md:text-left">
                  <h3 className="text-2xl font-black text-white mb-1">{result.movie.title}</h3>
                  <div className="text-sm text-ink-400 mb-4">{result.movie.genres.join(' · ')} {result.movie.year && ` · ${result.movie.year}`}</div>
                  
                  {/* YENİ: İZLEME LİNKLERİ ALANI */}
                  <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap mb-4">
                    {getWatchLinks(result.movie).map((link, idx) => {
                      const Icon = link.icon;
                      return (
                        <a 
                          key={idx}
                          href={link.href} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-ink-800/80 hover:bg-gold-900/30 text-gold-400 border border-gold-500/30 px-2 py-1 rounded-md text-[10px] sm:text-xs font-semibold transition-all hover:scale-105"
                        >
                          {link.logo ? <img src={link.logo} alt="Platform" className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm object-cover" /> : <Icon size={12} />}
                          {link.text}
                        </a>
                      )
                    })}
                  </div>
                  
                  {/* %100 DNA İLERLEME BARLARI */}
                  <div className="space-y-3 bg-ink-900/40 p-4 rounded-xl border border-ink-800/80">
                    <div className="text-[10px] font-bold text-ink-500 uppercase tracking-widest mb-1 flex justify-between">
                      <span>DNA Analizi (Neden Seçildi?)</span>
                      <span className="text-emerald-500">%100</span>
                    </div>
                    {result.composition.map((c, i) => (
                      <div key={i} className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs font-medium text-emerald-100">
                          <span className="flex items-center gap-1.5"><Dna size={12} className="text-emerald-500/70" /> {c.label}</span>
                          <span className="text-emerald-400 font-bold">%{c.pct}</span>
                        </div>
                        <div className="w-full h-1.5 bg-ink-950 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500/80" style={{ width: `${c.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* BUTONLAR (Puanlama dahil) */}
              <div className="flex flex-col sm:flex-row gap-3 mt-8 w-full">
                <button 
                  onClick={() => setShowRating(true)} 
                  className="flex-1 bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 text-ink-950 font-black py-3 rounded-xl shadow-lg shadow-gold-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Star size={18} /> İzle ve Puanla
                </button>
                <button 
                  onClick={() => { setStep('select'); setResult(null); setMovieA(null); setMovieB(null); }} 
                  className="flex-1 bg-ink-800 hover:bg-ink-700 text-white font-bold py-3 rounded-xl transition-colors border border-ink-700 flex items-center justify-center"
                >
                  Yeni Sentez
                </button>
                <button 
                  onClick={onClose} 
                  className="flex-1 bg-ink-900 hover:bg-red-900/30 text-ink-400 hover:text-red-400 border border-ink-800 hover:border-red-500/30 font-bold py-3 rounded-xl transition-all flex items-center justify-center"
                >
                  Kapat
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* PUANLAMA MODALI */}
      {showRating && result && (
        <RatingModal
          title={result.movie.title}
          subtitle={result.movie.year ? `Çıkış Yılı: ${result.movie.year}` : 'Film'}
          onRate={(rating, note) => {
            watchMovie(result.movie.id, rating, note);
            setShowRating(false);
            onClose(); 
          }}
          onClose={() => setShowRating(false)}
        />
      )}
    </div>
  );
}