import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Shuffle, Film, Tv, Sparkles, Clock, Calendar, Star, PlayCircle, ExternalLink, Search, Youtube, RotateCcw, Eye, Filter, Zap, User, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import MediaDetailModal from './MediaDetailModal';
import type { DetailModalTarget } from './MediaDetailModal';
import type { Movie, Series, Episode } from '../types';

export type PickedItem =
  | { kind: 'movie'; movie: Movie }
  | { kind: 'series'; series: Series; episode: Episode };

interface PickModalProps {
  movieCount: number;
  seriesCount: number;
  unwatchedMovies: Movie[];
  nextEpisodes: { series: Series; episode: Episode }[];
  onPick: (item: PickedItem) => void;
  onClose: () => void;
}

type ModeFilter = 'all' | 'movie' | 'series';
type DurationFilter = 'any' | 'short' | 'medium' | 'long';
type ModalPhase = 'setup' | 'spinning' | 'result';

export default function PickModal({
  movieCount,
  seriesCount,
  unwatchedMovies,
  nextEpisodes,
  onPick,
  onClose,
}: PickModalProps) {
  const { data: appData } = useApp();

  // Başlangıç modunu mevcut içerik sayısına göre akıllı belirle
  const [mode, setMode] = useState<ModeFilter>(() => {
    if (movieCount > 0 && seriesCount > 0) return 'all';
    if (seriesCount > 0) return 'series';
    return 'movie';
  });

  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('any');
  const [phase, setPhase] = useState<ModalPhase>('setup');

  // Rulet / Slot animasyonu state'leri
  const [rollingItem, setRollingItem] = useState<PickedItem | null>(null);
  const [winner, setWinner] = useState<PickedItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<DetailModalTarget | null>(null);

  const spinTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      spinTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  // Seçilen moda göre mevcut tüm türleri çıkar
  const availableGenres = useMemo(() => {
    const genreSet = new Set<string>();
    if (mode === 'all' || mode === 'movie') {
      unwatchedMovies.forEach((m) => m.genres.forEach((g) => genreSet.add(g)));
    }
    if (mode === 'all' || mode === 'series') {
      nextEpisodes.forEach((s) => s.series.genres.forEach((g) => genreSet.add(g)));
    }
    return Array.from(genreSet).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [mode, unwatchedMovies, nextEpisodes]);

  // Filtrelenmiş aday havuzu
  const candidatePool = useMemo<PickedItem[]>(() => {
    const pool: PickedItem[] = [];

    if (mode === 'all' || mode === 'movie') {
      unwatchedMovies.forEach((m) => {
        if (selectedGenre && !m.genres.includes(selectedGenre)) return;
        if (durationFilter !== 'any') {
          const rt = m.runtime || 115;
          if (durationFilter === 'short' && rt >= 100) return;
          if (durationFilter === 'medium' && (rt < 100 || rt > 140)) return;
          if (durationFilter === 'long' && rt <= 140) return;
        }
        pool.push({ kind: 'movie', movie: m });
      });
    }

    if (mode === 'all' || mode === 'series') {
      nextEpisodes.forEach((item) => {
        if (selectedGenre && !item.series.genres.includes(selectedGenre)) return;
        pool.push({ kind: 'series', series: item.series, episode: item.episode });
      });
    }

    return pool;
  }, [mode, unwatchedMovies, nextEpisodes, selectedGenre, durationFilter]);

  // Ruleti Başlatma (Yavaşlayan Slot Makinesi Efekti)
  const startRoulette = () => {
    if (candidatePool.length === 0) return;

    spinTimeoutsRef.current.forEach(clearTimeout);
    spinTimeoutsRef.current = [];

    setPhase('spinning');
    const finalWinner = candidatePool[Math.floor(Math.random() * candidatePool.length)];

    const totalSteps = 22;
    let cumulativeDelay = 0;

    for (let i = 0; i < totalSteps; i++) {
      // Başta çok hızlı (45ms), sona doğru yavaşlayan (ease-in) gecikme eğrisi
      const stepDelay = 45 + Math.floor(Math.pow(i / totalSteps, 2.6) * 240);
      cumulativeDelay += stepDelay;

      const t = setTimeout(() => {
        if (i === totalSteps - 1) {
          setRollingItem(finalWinner);
          setWinner(finalWinner);
          const finishTimer = setTimeout(() => {
            setPhase('result');
          }, 320);
          spinTimeoutsRef.current.push(finishTimer);
        } else {
          const randomCandidate = candidatePool[Math.floor(Math.random() * candidatePool.length)];
          setRollingItem(randomCandidate);
        }
      }, cumulativeDelay);

      spinTimeoutsRef.current.push(t);
    }
  };

  // Yardımcı: PickedItem'dan görüntü verilerini çıkarma
  const extractMeta = (item: PickedItem) => {
    if (item.kind === 'movie') {
      const m = item.movie;
      return {
        title: m.title,
        subtitle: m.year ? `Çıkış Yılı: ${m.year}` : 'Film',
        badge: 'FİLM',
        posterUrl: m.posterUrl,
        year: m.year,
        runtime: m.runtime,
        genres: m.genres,
        overview: m.overview,
        directorsOrCreators: m.directors,
        cast: m.cast,
        customUrl: m.customUrl,
        watchProviders: m.watchProviders,
        imdbId: m.imdbId,
        isMovie: true,
      };
    } else {
      const s = item.series;
      const ep = item.episode;
      return {
        title: s.title,
        subtitle: `Sıradaki: ${ep.season}. Sezon ${ep.episode}. Bölüm`,
        badge: `${ep.season}. SEZON ${ep.episode}. BÖLÜM`,
        posterUrl: s.posterUrl,
        year: s.year,
        runtime: undefined,
        genres: s.genres,
        overview: s.overview,
        directorsOrCreators: s.creators,
        cast: s.cast,
        customUrl: s.customUrl,
        watchProviders: s.watchProviders,
        imdbId: s.imdbId,
        isMovie: false,
      };
    }
  };

  // Kazanan için izleme ve fragman linklerini oluştur
  const getWatchLinks = (item: PickedItem) => {
    const meta = extractMeta(item);
    const links: { href: string; text: string; logo: string | null; icon: any; isTrailer?: boolean }[] = [];

    const trailerQuery = encodeURIComponent(`${meta.title} ${meta.year || ''} official trailer fragman`);
    links.push({
      href: `https://www.youtube.com/results?search_query=${trailerQuery}`,
      text: 'Fragman',
      logo: null,
      icon: Youtube,
      isTrailer: true,
    });

    if (meta.customUrl) {
      links.push({ href: meta.customUrl, text: 'Özel Kaynak', logo: null, icon: ExternalLink });
    }

    if (meta.watchProviders && meta.watchProviders.length > 0) {
      meta.watchProviders.slice(0, 2).forEach((provider) => {
        let finalHref = provider.link || '';
        const pName = provider.providerName.toLowerCase();

        if (pName.includes('netflix')) finalHref = `https://www.netflix.com/search?q=${encodeURIComponent(meta.title)}`;
        else if (pName.includes('amazon') || pName.includes('prime')) finalHref = `https://www.primevideo.com/search/ref=atv_sr_sug_1?phrase=${encodeURIComponent(meta.title)}`;
        else if (pName.includes('disney')) finalHref = `https://www.disneyplus.com/search?q=${encodeURIComponent(meta.title)}`;
        else if (pName.includes('blutv')) finalHref = `https://www.blutv.com/arama?q=${encodeURIComponent(meta.title)}`;
        else if (pName.includes('mubi')) finalHref = `https://mubi.com/tr/search?query=${encodeURIComponent(meta.title)}`;
        else if (pName.includes('apple')) finalHref = `https://tv.apple.com/tr/search?q=${encodeURIComponent(meta.title)}`;

        links.push({ href: finalHref, text: provider.providerName, logo: provider.logoUrl, icon: PlayCircle });
      });
    }

    const searchSuffix = meta.isMovie ? 'izle' : 'dizi izle';
    const searchQuery = encodeURIComponent(`${meta.title} ${meta.year || ''} ${searchSuffix}`);
    links.push({
      href: `https://www.google.com/search?q=${searchQuery}`,
      text: "Google'da Bul",
      logo: null,
      icon: Search,
    });

    if (appData.altWatchTemplate && (meta.imdbId || appData.altWatchTemplate.includes('{slug}') || appData.altWatchTemplate.includes('{title}'))) {
      const charMap: Record<string, string> = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
      const slug = meta.title
        .toLocaleLowerCase('tr-TR')
        .replace(/[çğıöşü]/g, (match) => charMap[match])
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      const finalAltHref = appData.altWatchTemplate
        .replace('{imdb}', meta.imdbId || '')
        .replace('{slug}', slug)
        .replace('{title}', encodeURIComponent(meta.title))
        .replace('{year}', meta.year || '');

      links.push({ href: finalAltHref, text: 'Alternatif', logo: null, icon: PlayCircle });
    }

    return links;
  };

  const activeBgPoster =
    phase === 'spinning' && rollingItem
      ? extractMeta(rollingItem).posterUrl
      : phase === 'result' && winner
      ? extractMeta(winner).posterUrl
      : null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <style>{`
        @keyframes scanline-move {
          0% { top: 5%; opacity: 0.4; }
          50% { top: 90%; opacity: 0.9; }
          100% { top: 5%; opacity: 0.4; }
        }
        @keyframes winner-glow-pulse {
          0%, 100% { box-shadow: 0 0 25px rgba(245, 158, 11, 0.35); }
          50% { box-shadow: 0 0 50px rgba(245, 158, 11, 0.65); }
        }
        .animate-scanline { animation: scanline-move 1.1s ease-in-out infinite; }
        .animate-winner-glow { animation: winner-glow-pulse 2.2s ease-in-out infinite; }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-ink-950/95 border border-ink-700/80 rounded-[2rem] overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.85)] flex flex-col max-h-[92vh] animate-fade-in-up"
      >
        {/* DİNAMİK FLU POSTER VEYA NEON IŞIK ARKA PLANI */}
        {activeBgPoster ? (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25 transition-all duration-300">
            <img
              src={activeBgPoster}
              alt=""
              className="w-full h-full object-cover blur-3xl scale-125 saturate-150"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent" />
          </div>
        ) : (
          <>
            <div className="absolute -top-24 -left-24 w-80 h-80 bg-gold-500/15 rounded-full blur-[110px] pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-azure-500/15 rounded-full blur-[110px] pointer-events-none" />
          </>
        )}

        {/* ÜST BAŞLIK BARI */}
        <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-4 border-b border-ink-800/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-gold-500/25 to-azure-500/20 border border-gold-500/40 flex items-center justify-center shadow-lg">
              <Shuffle size={22} className="text-gold-400" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gold-400">
                <Sparkles size={11} /> Sinema Ruleti & Karar Stüdyosu
              </div>
              <h2 className="text-lg sm:text-xl font-black text-ink-50 leading-tight">
                Bugün Ne İzlesem?
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-ink-900 hover:bg-ink-800 text-ink-400 hover:text-white border border-ink-800 flex items-center justify-center transition-all hover:scale-110"
          >
            <X size={18} />
          </button>
        </div>

        {/* İÇERİK GÖVDESİ */}
        <div className="relative z-10 flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
          
          {/* =========================================================
              AŞAMA 1: FİLTRE VE RULET HAZIRLIK EKRANI (SETUP)
              ========================================================= */}
          {phase === 'setup' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Üst Bilgi & Aday Sayacı Kartı */}
              <div className="bg-ink-900/60 border border-ink-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-ink-200">
                    Kütüphanendeki İzlenmemiş Aday Havuzu
                  </div>
                  <p className="text-[11px] text-ink-400 mt-0.5">
                    İstersen aşağıdaki filtrelerle ruh haline göre daralt, istersen doğrudan çarkı çevir!
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center bg-ink-950 border border-gold-500/30 px-4 py-2 rounded-xl flex-shrink-0">
                  <span className="text-2xl font-black text-gold-400 leading-none">
                    {candidatePool.length}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-1">
                    Aday
                  </span>
                </div>
              </div>

              {/* 1. Format Seçimi (Hem Film Hem Dizi Varsa Gösterilir) */}
              {movieCount > 0 && seriesCount > 0 && (
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-wider text-ink-400 flex items-center gap-1.5">
                    <Filter size={13} className="text-gold-400" /> Ne İzlemek İstiyorsun?
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setMode('all')}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                        mode === 'all'
                          ? 'bg-gold-500/15 border-gold-500 text-ink-50 shadow-md scale-[1.02]'
                          : 'bg-ink-900/50 border-ink-800 text-ink-400 hover:bg-ink-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Sparkles size={16} className="text-gold-400" />
                        <span className="text-[10px] font-bold bg-ink-950 px-2 py-0.5 rounded-full">
                          {movieCount + seriesCount}
                        </span>
                      </div>
                      <span className="text-xs font-black mt-1">Karışık Şans</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('movie')}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                        mode === 'movie'
                          ? 'bg-gold-500/15 border-gold-500 text-ink-50 shadow-md scale-[1.02]'
                          : 'bg-ink-900/50 border-ink-800 text-ink-400 hover:bg-ink-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Film size={16} className="text-gold-400" />
                        <span className="text-[10px] font-bold bg-ink-950 px-2 py-0.5 rounded-full">
                          {movieCount}
                        </span>
                      </div>
                      <span className="text-xs font-black mt-1">Sadece Film</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('series')}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                        mode === 'series'
                          ? 'bg-azure-500/15 border-azure-500 text-ink-50 shadow-md scale-[1.02]'
                          : 'bg-ink-900/50 border-ink-800 text-ink-400 hover:bg-ink-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Tv size={16} className="text-azure-400" />
                        <span className="text-[10px] font-bold bg-ink-950 px-2 py-0.5 rounded-full">
                          {seriesCount}
                        </span>
                      </div>
                      <span className="text-xs font-black mt-1">Sadece Dizi</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Süre Modu (Film Seçiliyse Gösterilir) */}
              {(mode === 'all' || mode === 'movie') && movieCount > 0 && (
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-wider text-ink-400 flex items-center gap-1.5">
                    <Clock size={13} className="text-gold-400" /> Ne Kadar Vaktin Var? (Film Süresi)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'any', label: 'Farketmez', desc: 'Tüm Süreler' },
                      { id: 'short', label: '⚡ Çerezlik', desc: '100 dk altı' },
                      { id: 'medium', label: '🎬 Standart', desc: '100 - 140 dk' },
                      { id: 'long', label: '🍿 Epik / Uzun', desc: '140 dk üstü' },
                    ].map((d) => {
                      const active = durationFilter === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setDurationFilter(d.id as DurationFilter)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            active
                              ? 'bg-gold-500/20 border-gold-500 text-ink-50 shadow-sm'
                              : 'bg-ink-900/40 border-ink-800/80 text-ink-400 hover:bg-ink-800/50'
                          }`}
                        >
                          <div className="text-xs font-black">{d.label}</div>
                          <div className="text-[10px] opacity-75 mt-0.5">{d.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Tür Filtresi */}
              {availableGenres.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-wider text-ink-400 flex items-center gap-1.5">
                    <Zap size={13} className="text-gold-400" /> Ruh Halin Hangi Türde?
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                    <button
                      type="button"
                      onClick={() => setSelectedGenre(null)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        selectedGenre === null
                          ? 'bg-gold-500 text-ink-950 border-gold-400 shadow-md'
                          : 'bg-ink-900 text-ink-400 border-ink-800 hover:bg-ink-800 hover:text-ink-200'
                      }`}
                    >
                      🎲 Farketmez (Tümü)
                    </button>
                    {availableGenres.map((g) => {
                      const active = selectedGenre === g;
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setSelectedGenre(active ? null : g)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            active
                              ? 'bg-gold-500 text-ink-950 border-gold-400 shadow-md'
                              : 'bg-ink-900 text-ink-400 border-ink-800 hover:bg-ink-800 hover:text-ink-200'
                          }`}
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Aday Havuzu Posteri Önizleme Şeridi */}
              {candidatePool.length > 0 ? (
                <div className="bg-ink-900/30 border border-ink-800/60 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-ink-500">
                    <span>Çarkta Dönecek Adaylardan Bazıları</span>
                    <span>{candidatePool.length} Yapım Hazır</span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar py-1">
                    {candidatePool.slice(0, 14).map((item, idx) => {
                      const meta = extractMeta(item);
                      return (
                        <div
                          key={idx}
                          className="w-11 aspect-[2/3] rounded-lg overflow-hidden bg-ink-900 border border-ink-700/60 flex-shrink-0 shadow-sm"
                          title={meta.title}
                        >
                          {meta.posterUrl ? (
                            <img src={meta.posterUrl} alt={meta.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-ink-600">
                              {meta.isMovie ? <Film size={14} /> : <Tv size={14} />}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 bg-ink-900/40 rounded-2xl border border-ink-800">
                  <p className="text-sm font-bold text-ink-300">
                    Seçtiğin kriterlere uygun izlenmemiş yapım bulunamadı.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGenre(null);
                      setDurationFilter('any');
                    }}
                    className="mt-3 text-xs font-bold text-gold-400 hover:underline inline-flex items-center gap-1"
                  >
                    <RotateCcw size={12} /> Filtreleri Sıfırla
                  </button>
                </div>
              )}

              {/* DEV RULET BAŞLATMA BUTONU */}
              <button
                type="button"
                disabled={candidatePool.length === 0}
                onClick={startRoulette}
                className="w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base text-ink-950 bg-gradient-to-r from-gold-500 via-amber-400 to-gold-500 hover:from-gold-400 hover:to-amber-300 shadow-[0_10px_35px_rgba(245,158,11,0.35)] transition-all hover:scale-[1.02] active:scale-98 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2.5"
              >
                <Shuffle size={20} strokeWidth={2.5} />
                <span>KADER ÇARKINI DÖNDÜR ({candidatePool.length} ADAY)</span>
              </button>
            </div>
          )}

          {/* =========================================================
              AŞAMA 2: 3B POSTER SLOT / RULET ANİMASYONU (SPINNING)
              ========================================================= */}
          {phase === 'spinning' && rollingItem && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-6 animate-fade-in">
              {(() => {
                const meta = extractMeta(rollingItem);
                return (
                  <>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold-500/20 border border-gold-500/40 text-gold-300 text-xs font-black uppercase tracking-widest animate-pulse">
                      <Sparkles size={14} /> Kader Çarkı Dönüyor...
                    </div>

                    {/* Lazer Tarayıcılı Poster Çerçevesi */}
                    <div className="relative w-44 sm:w-52 aspect-[2/3] rounded-3xl overflow-hidden bg-ink-900 border-2 border-gold-500 shadow-[0_0_50px_rgba(245,158,11,0.4)] transform scale-105 transition-all duration-75">
                      {meta.posterUrl ? (
                        <img src={meta.posterUrl} alt={meta.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink-600">
                          {meta.isMovie ? <Film size={48} /> : <Tv size={48} />}
                        </div>
                      )}

                      {/* Hareketli Neon Lazer Çizgisi */}
                      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-gold-400 to-transparent shadow-[0_0_15px_#fbbf24] animate-scanline pointer-events-none" />
                      
                      <div className="absolute bottom-2 inset-x-2 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/15">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gold-400">
                          {meta.badge}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 max-w-md px-4">
                      <h3 className="text-xl sm:text-2xl font-black text-ink-50 truncate">
                        {meta.title}
                      </h3>
                      <p className="text-xs font-bold text-ink-400">
                        {meta.genres.slice(0, 3).join(' · ') || meta.subtitle}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* =========================================================
              AŞAMA 3: KAZANAN SİNEMA KARTI EKRANI (RESULT)
              ========================================================= */}
          {phase === 'result' && winner && (
            <div className="space-y-6 animate-fade-in-up">
              {(() => {
                const meta = extractMeta(winner);
                const watchLinks = getWatchLinks(winner);

                return (
                  <>
                    {/* Üst Rozet */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                        <Sparkles size={14} /> Günün Seçimi Belirlendi!
                      </div>
                      <button
                        type="button"
                        onClick={() => setPhase('setup')}
                        className="text-xs font-bold text-ink-400 hover:text-ink-200 flex items-center gap-1 bg-ink-900 px-3 py-1.5 rounded-xl border border-ink-800 transition-colors"
                      >
                        <Filter size={12} /> Filtreleri Değiştir
                      </button>
                    </div>

                    {/* Kazanan Gövde Kartı */}
                    <div className="bg-ink-900/75 border border-gold-500/40 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row gap-5 items-center sm:items-start animate-winner-glow">
                      
                      {/* Sol: Kazanan Poster */}
                      <div
                        onClick={() =>
                          setDetailTarget(
                            winner.kind === 'movie'
                              ? { type: 'movie', data: winner.movie }
                              : { type: 'series', data: winner.series }
                          )
                        }
                        title="Sinema Kartını Gör"
                        className="w-36 sm:w-44 aspect-[2/3] flex-shrink-0 rounded-2xl overflow-hidden bg-ink-950 border-2 border-gold-500/60 shadow-2xl relative group cursor-pointer"
                      >
                        {meta.posterUrl ? (
                          <img src={meta.posterUrl} alt={meta.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-ink-600">
                            {meta.isMovie ? <Film size={40} /> : <Tv size={40} />}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                          <Eye size={20} className="text-gold-400" />
                          <span className="text-[10px] font-black text-white uppercase">Tam Künye</span>
                        </div>
                      </div>

                      {/* Sağ: Detaylar ve İzleme Linkleri */}
                      <div className="flex-1 min-w-0 text-center sm:text-left flex flex-col justify-between w-full">
                        <div>
                          <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-gold-500/20 text-gold-300 border border-gold-500/30 mb-2">
                            {meta.isMovie ? <Film size={11} /> : <Tv size={11} />}
                            {meta.badge}
                          </div>

                          <h3 className="text-xl sm:text-2xl font-black text-ink-50 leading-tight">
                            {meta.title}
                          </h3>

                          {/* Yıl ve Süre */}
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-2 text-xs text-ink-300 font-semibold">
                            {meta.year && (
                              <span className="flex items-center gap-1">
                                <Calendar size={13} className="text-gold-400" /> {meta.year}
                              </span>
                            )}
                            {meta.runtime && (
                              <span className="flex items-center gap-1">
                                <Clock size={13} className="text-gold-400" /> {meta.runtime} dk
                              </span>
                            )}
                            {meta.genres.length > 0 && (
                              <span className="text-gold-400/90">
                                · {meta.genres.join(', ')}
                              </span>
                            )}
                          </div>

                          {/* Yönetmen & Oyuncular */}
                          {((meta.directorsOrCreators && meta.directorsOrCreators.length > 0) ||
                            (meta.cast && meta.cast.length > 0)) && (
                            <div className="mt-2.5 space-y-1 text-[11px] text-ink-400">
                              {meta.directorsOrCreators && meta.directorsOrCreators.length > 0 && (
                                <div className="flex items-center justify-center sm:justify-start gap-1">
                                  <User size={12} className="text-gold-400 flex-shrink-0" />
                                  <span className="font-bold text-ink-200">
                                    {meta.isMovie ? 'Yönetmen:' : 'Yaratıcı:'}
                                  </span>
                                  <span className="truncate">{meta.directorsOrCreators.slice(0, 2).join(', ')}</span>
                                </div>
                              )}
                              {meta.cast && meta.cast.length > 0 && (
                                <div className="flex items-center justify-center sm:justify-start gap-1">
                                  <Users size={12} className="text-azure-400 flex-shrink-0" />
                                  <span className="font-bold text-ink-200">Oyuncular:</span>
                                  <span className="truncate">{meta.cast.slice(0, 3).join(', ')}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Konu Özeti */}
                          {meta.overview && (
                            <p className="mt-3 text-xs text-ink-300 leading-relaxed line-clamp-3 bg-ink-950/60 p-3 rounded-xl border border-ink-800/80 text-left">
                              {meta.overview}
                            </p>
                          )}
                        </div>

                        {/* Doğrudan İzleme ve Fragman Butonları */}
                        <div className="mt-4 pt-3 border-t border-ink-800/60">
                          <div className="text-[10px] font-black uppercase tracking-wider text-ink-400 mb-2">
                            Hemen İzle veya Fragmana Bak:
                          </div>
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                            {watchLinks.map((link, idx) => {
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
                                    <Icon size={14} /> {link.text}
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
                                    <img src={link.logo} alt={link.text} className="w-3.5 h-3.5 rounded-sm object-cover" />
                                  ) : (
                                    <Icon size={13} />
                                  )}
                                  {link.text}
                                </a>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* ALT AKSİYON BUTONLARI */}
                    <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onPick(winner);
                          onClose();
                        }}
                        className="w-full sm:flex-1 py-3.5 px-5 rounded-xl font-black text-xs sm:text-sm text-ink-950 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 shadow-xl shadow-gold-500/20 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                      >
                        <Star size={17} className="fill-current" />
                        <span>İzledim & Puanla</span>
                      </button>

                      <button
                        type="button"
                        onClick={startRoulette}
                        className="w-full sm:w-auto py-3.5 px-5 rounded-xl font-bold text-xs sm:text-sm bg-ink-800 hover:bg-ink-700 text-ink-100 border border-ink-700 transition-all flex items-center justify-center gap-2"
                      >
                        <RotateCcw size={16} />
                        <span>Tekrar Çevir</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setDetailTarget(
                            winner.kind === 'movie'
                              ? { type: 'movie', data: winner.movie }
                              : { type: 'series', data: winner.series }
                          )
                        }
                        className="w-full sm:w-auto py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-ink-900 hover:bg-ink-800 text-gold-400 border border-gold-500/30 transition-all flex items-center justify-center gap-1.5"
                        title="Tam Sinema Kartını Aç"
                      >
                        <Eye size={16} />
                        <span>Detay</span>
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

        </div>
      </div>

      {/* TAM SİNEMA KARTI (DETAY MODALI) */}
      {detailTarget && (
        <MediaDetailModal
          target={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </div>
  );
}