import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Shuffle, Film, Tv, Sparkles, Tag, Check, Calendar, Clock, Image as ImageIcon } from 'lucide-react';
import type { Movie, Series, Episode } from '../types';

type Filter = 'all' | 'movie' | 'series';
type PickItem = { kind: 'movie'; movie: Movie } | { kind: 'series'; series: Series; episode: Episode };

interface Props {
  movieCount: number;
  seriesCount: number;
  unwatchedMovies: Movie[];
  nextEpisodes: { series: Series; episode: Episode }[];
  onPick: (item: PickItem) => void;
  onClose: () => void;
}

export default function PickModal({ movieCount, seriesCount, unwatchedMovies, nextEpisodes, onPick, onClose }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [spinning, setSpinning] = useState(false);
  
  const [displayItem, setDisplayItem] = useState<PickItem | null>(null);
  const [finalPick, setFinalPick] = useState<PickItem | null>(null);
  
  const spinTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalCount = movieCount + seriesCount;

  // YENİ: Mobilde arka planı tamamen donduran güçlü kod
  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    document.documentElement.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
      document.documentElement.classList.remove('overflow-hidden');
    };
  }, []);

  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    unwatchedMovies.forEach((m) => m.genres.forEach((g) => set.add(g)));
    nextEpisodes.forEach(({ series }) => series.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [unwatchedMovies, nextEpisodes]);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const clearGenres = () => setSelectedGenres(new Set());

  const filteredPool = useMemo(() => {
    const moviePool: PickItem[] = unwatchedMovies
      .filter((m) => selectedGenres.size === 0 || m.genres.some((g) => selectedGenres.has(g)))
      .map((m) => ({ kind: 'movie' as const, movie: m }));
    const seriesPool: PickItem[] = nextEpisodes
      .filter(({ series }) => selectedGenres.size === 0 || series.genres.some((g) => selectedGenres.has(g)))
      .map(({ series, episode }) => ({ kind: 'series' as const, series, episode }));

    if (filter === 'movie') return moviePool;
    if (filter === 'series') return seriesPool;
    return [...moviePool, ...seriesPool];
  }, [unwatchedMovies, nextEpisodes, filter, selectedGenres]);

  const poolCount = filteredPool.length;

  const handlePick = () => {
    if (poolCount === 0) return;
    setSpinning(true);
    setFinalPick(null);

    const pick = filteredPool[Math.floor(Math.random() * filteredPool.length)];
    let elapsed = 0;
    const totalDuration = 2200;
    const interval = 80;

    spinTimerRef.current = setInterval(() => {
      elapsed += interval;
      if (elapsed >= totalDuration) {
        if (spinTimerRef.current) clearInterval(spinTimerRef.current);
        setDisplayItem(pick);
        setSpinning(false);
        setFinalPick(pick);
        return;
      }
      const randomItem = filteredPool[Math.floor(Math.random() * filteredPool.length)];
      setDisplayItem(randomItem);
    }, interval);
  };

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearInterval(spinTimerRef.current);
    };
  }, []);

  const handleConfirm = () => {
    if (finalPick) {
      onPick(finalPick);
      onClose();
    }
  };

  const handleRespin = () => {
    setFinalPick(null);
    handlePick();
  };

  const currentPick = spinning ? displayItem : finalPick;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 md:pl-56 overscroll-none" onClick={spinning ? undefined : onClose}>
      <div
        className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[95dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-ink-700 bg-ink-900 z-10 shrink-0">
          <h2 className="text-base md:text-lg font-semibold text-ink-100 flex items-center gap-2">
            <Sparkles size={18} className="text-gold-400" />
            Bugün Ne İzlesem?
          </h2>
          <button onClick={onClose} disabled={spinning} className="text-ink-400 hover:text-ink-200 transition-colors disabled:opacity-40 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 md:p-5 space-y-4 overflow-y-auto overscroll-contain hide-scrollbar">
          <div>
            <p className="text-xs md:text-sm text-ink-400 mb-2">Neyden seçim yapılsın?</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setFilter('all')}
                disabled={spinning || !!finalPick}
                className={`flex flex-col items-center gap-1.5 py-2.5 md:py-3 rounded-xl border transition-all disabled:opacity-50 ${
                  filter === 'all'
                    ? 'bg-gradient-to-br from-gold-500/20 to-gold-700/20 border-gold-500/50 text-gold-300'
                    : 'bg-ink-800/60 border-ink-700 text-ink-400 hover:text-ink-200 hover:border-ink-600'
                }`}
              >
                <Sparkles size={18} />
                <span className="text-[11px] md:text-xs font-medium">Hepsi</span>
                <span className="text-[9px] md:text-[10px] text-ink-500">{totalCount}</span>
              </button>
              <button
                onClick={() => setFilter('movie')}
                disabled={spinning || !!finalPick}
                className={`flex flex-col items-center gap-1.5 py-2.5 md:py-3 rounded-xl border transition-all disabled:opacity-50 ${
                  filter === 'movie'
                    ? 'bg-gradient-to-br from-gold-500/20 to-gold-700/20 border-gold-500/50 text-gold-300'
                    : 'bg-ink-800/60 border-ink-700 text-ink-400 hover:text-ink-200 hover:border-ink-600'
                }`}
              >
                <Film size={18} />
                <span className="text-[11px] md:text-xs font-medium">Film</span>
                <span className="text-[9px] md:text-[10px] text-ink-500">{movieCount}</span>
              </button>
              <button
                onClick={() => setFilter('series')}
                disabled={spinning || !!finalPick}
                className={`flex flex-col items-center gap-1.5 py-2.5 md:py-3 rounded-xl border transition-all disabled:opacity-50 ${
                  filter === 'series'
                    ? 'bg-gradient-to-br from-azure-500/20 to-azure-700/20 border-azure-500/50 text-azure-300'
                    : 'bg-ink-800/60 border-ink-700 text-ink-400 hover:text-ink-200 hover:border-ink-600'
                }`}
              >
                <Tv size={18} />
                <span className="text-[11px] md:text-xs font-medium">Dizi</span>
                <span className="text-[9px] md:text-[10px] text-ink-500">{seriesCount}</span>
              </button>
            </div>
          </div>

          {availableGenres.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag size={12} className="text-ink-500" />
                <p className="text-xs md:text-sm text-ink-400">Türlere göre filtrele</p>
                {selectedGenres.size > 0 && (
                  <button
                    onClick={clearGenres}
                    disabled={spinning || !!finalPick}
                    className="ml-auto text-[10px] md:text-xs text-gold-400 hover:text-gold-300 transition-colors disabled:opacity-40"
                  >
                    Temizle
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto overscroll-contain hide-scrollbar">
                {availableGenres.map((g) => {
                  const active = selectedGenres.has(g);
                  return (
                    <button
                      key={g}
                      onClick={() => toggleGenre(g)}
                      disabled={spinning || !!finalPick}
                      className={`flex items-center gap-1 px-3 py-1.5 md:px-2.5 md:py-1 rounded-full text-[11px] md:text-xs font-medium transition-all disabled:opacity-50 ${
                        active
                          ? 'bg-gold-500 text-ink-950'
                          : 'bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-ink-200'
                      }`}
                    >
                      {active && <Check size={10} />}
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(!spinning && !finalPick) && (
            <div className="text-[11px] md:text-xs text-ink-500 bg-ink-800/40 rounded-lg p-3">
              {filter === 'series'
                ? 'Dizilerde sadece izlenmesi gereken sonraki bölüm seçilir. Bölümler sırayla izlenir.'
                : filter === 'movie'
                ? 'Sadece izlenmemiş filmler arasından rastgele seçilir.'
                : 'Tüm izlenmemiş filmler ve dizilerin sıradaki bölümleri arasından rastgele seçilir.'}
            </div>
          )}

          {(spinning || finalPick) && currentPick && (
            <div className={`bg-gradient-to-br from-ink-800/80 to-ink-950 border ${finalPick ? (currentPick.kind === 'movie' ? 'border-gold-500/40 shadow-lg shadow-gold-500/10' : 'border-azure-500/40 shadow-lg shadow-azure-500/10') : 'border-ink-700/50'} rounded-xl p-3 md:p-4 flex gap-3 md:gap-4 min-h-[120px] md:min-h-[140px] items-center transition-all`}>
              
              <div className="w-16 sm:w-20 md:w-24 aspect-[2/3] flex-shrink-0 bg-ink-950 rounded-lg overflow-hidden flex items-center justify-center border border-ink-700/50 shadow-inner relative">
                {spinning ? (
                  <Shuffle size={24} className="text-gold-500/30 animate-spin" style={{ animationDuration: '3s' }} />
                ) : (
                  (currentPick.kind === 'movie' ? currentPick.movie.posterUrl : currentPick.series.posterUrl) ? (
                    <img 
                      src={currentPick.kind === 'movie' ? currentPick.movie.posterUrl! : currentPick.series.posterUrl!} 
                      alt="Afiş" 
                      className="w-full h-full object-cover animate-fade-in" 
                    />
                  ) : (
                    currentPick.kind === 'movie' ? <Film size={20} className="text-ink-700" /> : <Tv size={20} className="text-ink-700" />
                  )
                )}
              </div>

              <div className="flex-1 text-left">
                <div className={`text-sm md:text-lg font-bold line-clamp-2 leading-tight ${spinning ? 'text-gold-300/80 animate-pulse' : 'text-ink-100'}`}>
                  {currentPick.kind === 'movie' ? currentPick.movie.title : currentPick.series.title}
                </div>

                {!spinning ? (
                  <div className="text-xs md:text-sm text-ink-400 mt-1.5 md:mt-2.5 space-y-1 animate-fade-in-up">
                    {currentPick.kind === 'movie' ? (
                      <>
                        {currentPick.movie.year && (
                          <div className="flex items-center gap-1.5 text-ink-300 text-[11px] md:text-xs">
                            <Calendar size={12} className="text-ink-500" /> {currentPick.movie.year}
                          </div>
                        )}
                        {currentPick.movie.runtime && (
                          <div className="flex items-center gap-1.5 text-ink-300 text-[11px] md:text-xs">
                            <Clock size={12} className="text-ink-500" /> {currentPick.movie.runtime} dk
                          </div>
                        )}
                        {currentPick.movie.genres.length > 0 && (
                          <div className="text-[10px] md:text-xs text-ink-500 mt-2 line-clamp-1 border-t border-ink-800 pt-1.5 md:pt-2">
                            {currentPick.movie.genres.join(' · ')}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 font-semibold text-azure-400 bg-azure-500/10 px-1.5 py-0.5 md:px-2 md:py-1 rounded w-fit text-[10px] md:text-xs">
                          {currentPick.episode.season}. Sezon {currentPick.episode.episode}. Bölüm
                        </div>
                        {currentPick.series.year && (
                          <div className="flex items-center gap-1.5 text-ink-300 mt-1.5 md:mt-2 text-[11px] md:text-xs">
                            <Calendar size={12} className="text-ink-500" /> Başlangıç: {currentPick.series.year}
                          </div>
                        )}
                        {currentPick.series.genres.length > 0 && (
                          <div className="text-[10px] md:text-xs text-ink-500 mt-2 line-clamp-1 border-t border-ink-800 pt-1.5 md:pt-2">
                            {currentPick.series.genres.join(' · ')}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] md:text-xs text-ink-500 mt-2 animate-pulse">
                    {currentPick.kind === 'movie' ? 'Aranıyor...' : 'Seçiliyor...'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 md:p-5 border-t border-ink-700 bg-ink-900 shrink-0">
          {finalPick ? (
            <div className="flex gap-2 md:gap-3">
              <button
                onClick={handleRespin}
                className="flex-1 flex items-center justify-center gap-1.5 md:gap-2 bg-ink-800 text-ink-200 rounded-lg py-2.5 md:py-3 font-semibold hover:bg-ink-700 transition-all border border-ink-700 text-xs md:text-sm"
              >
                <Shuffle size={16} />
                Tekrar Çek
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 text-white rounded-lg py-2.5 md:py-3 font-semibold transition-all shadow-lg text-xs md:text-sm ${
                  finalPick.kind === 'movie' 
                    ? 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 shadow-gold-500/20 text-ink-950' 
                    : 'bg-gradient-to-r from-azure-500 to-azure-600 hover:from-azure-400 hover:to-azure-500 shadow-azure-500/20'
                }`}
              >
                <Check size={16} />
                Bunu İzle
              </button>
            </div>
          ) : (
            <button
              onClick={handlePick}
              disabled={poolCount === 0 || spinning}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-ink-950 rounded-lg py-2.5 md:py-3 font-semibold hover:from-gold-400 hover:to-gold-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-gold-500/20 text-sm md:text-base"
            >
              <Shuffle size={18} className={spinning ? 'animate-spin' : ''} style={spinning ? { animationDuration: '0.5s'} : {}} />
              {spinning ? 'Çekiliyor...' : poolCount === 0 ? 'İzlenecek Bir Şey Yok' : 'Rastgele Çek'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}