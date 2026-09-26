import { useState } from 'react';
import { X, Calendar, Clock, Star, Film, Tv, PlayCircle, ExternalLink, Search, User, Users, Sparkles, StickyNote, SlidersHorizontal, Youtube, Layers, Building2, Tag, Edit2, CheckCircle2, Play, Timer, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass, formatDateShort, formatDateTime, getNextUnwatchedEpisode } from '../lib/utils';
import RatingModal from './RatingModal';
import type { Movie, Series, Episode, WatchHistoryItem } from '../types';

export type DetailModalTarget =
  | { type: 'movie'; data: Movie; historyItem?: WatchHistoryItem }
  | { type: 'series'; data: Series; historyItem?: WatchHistoryItem };

interface MediaDetailModalProps {
  target: DetailModalTarget;
  onClose: () => void;
}

export default function MediaDetailModal({ target, onClose }: MediaDetailModalProps) {
  const { data: appData, startWatchingMovie, cancelWatchingMovie, watchMovie, watchEpisode, updateHistoryRating } = useApp();
  const [isMainNoteExpanded, setIsMainNoteExpanded] = useState(false);
  const [expandedEpNotes, setExpandedEpNotes] = useState<Set<string>>(new Set());

  const [ratingModalConfig, setRatingModalConfig] = useState<{
    title: string;
    subtitle: string;
    initialRating?: number | null;
    initialNote?: string;
    initialDetailedRating?: Record<string, number>;
    initialReviewTags?: string[];
    onSubmit: (rating: number, note: string, detailedRating?: Record<string, number>, reviewTags?: string[]) => void;
  } | null>(null);

  const isMovie = target.type === 'movie';
  const liveMovie = isMovie ? (appData.movies.find((m) => m.id === target.data.id) || (target.data as Movie)) : null;
  const liveSeries = !isMovie ? (appData.series.find((s) => s.id === target.data.id) || (target.data as Series)) : null;
  const liveHistoryItem = target.historyItem ? (appData.history.find((h) => h.id === target.historyItem!.id) || target.historyItem) : undefined;

  const title = isMovie ? liveMovie!.title : liveSeries!.title;
  const year = isMovie ? liveMovie!.year : liveSeries!.year;
  const posterUrl = isMovie ? liveMovie!.posterUrl : liveSeries!.posterUrl;
  const overview = isMovie ? liveMovie!.overview : liveSeries!.overview;
  const genres = isMovie ? liveMovie!.genres : liveSeries!.genres;
  const runtime = isMovie ? liveMovie!.runtime : undefined;
  const actualRuntime = isMovie ? (liveHistoryItem?.actualRuntime ?? liveMovie!.actualRuntime) : undefined;
  const directorsOrCreators = isMovie ? liveMovie!.directors : liveSeries!.creators;
  const cast = isMovie ? liveMovie!.cast : liveSeries!.cast;
  const studios = isMovie ? liveMovie!.studios : liveSeries!.studios;
  const keywords = isMovie ? liveMovie!.keywords : liveSeries!.keywords;

  const nextEpisodeToWatch = !isMovie && liveSeries ? getNextUnwatchedEpisode(liveSeries.episodes) : null;

  const displayRating = liveHistoryItem
    ? liveHistoryItem.rating
    : isMovie
    ? liveMovie!.rating
    : (() => {
        const ratedEps = liveSeries!.episodes.filter((e) => e.rating !== null);
        if (ratedEps.length === 0) return null;
        const avg = ratedEps.reduce((sum, e) => sum + (e.rating || 0), 0) / ratedEps.length;
        return Math.round(avg * 10) / 10;
      })();

  const displayNote = liveHistoryItem ? liveHistoryItem.note : isMovie ? liveMovie!.note : '';
  const detailedRating = liveHistoryItem ? liveHistoryItem.detailedRating : isMovie ? liveMovie!.detailedRating : undefined;
  const reviewTags = liveHistoryItem ? liveHistoryItem.reviewTags : isMovie ? liveMovie!.reviewTags : undefined;
  const watchedAt = liveHistoryItem ? liveHistoryItem.watchedAt : isMovie ? liveMovie!.watchedAt : null;
  const collectionName = isMovie && liveMovie!.collectionId ? appData.collections.find((c) => c.id === liveMovie!.collectionId)?.name : undefined;

  const startedTimeText = isMovie && liveMovie?.startedAt
    ? new Date(liveMovie.startedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const toggleEpNote = (epId: string) => {
    setExpandedEpNotes((prev) => {
      const next = new Set(prev);
      if (next.has(epId)) next.delete(epId);
      else next.add(epId);
      return next;
    });
  };

  const handleOpenMovieRating = () => {
    if (!liveMovie) return;
    setRatingModalConfig({
      title: liveMovie.title,
      subtitle: liveMovie.year ? `Çıkış Yılı: ${liveMovie.year}` : 'Film',
      initialRating: liveHistoryItem ? liveHistoryItem.rating : liveMovie.rating,
      initialNote: liveHistoryItem ? liveHistoryItem.note : liveMovie.note,
      initialDetailedRating: liveHistoryItem ? liveHistoryItem.detailedRating : liveMovie.detailedRating,
      initialReviewTags: liveHistoryItem ? liveHistoryItem.reviewTags : liveMovie.reviewTags,
      onSubmit: (r, n, dr, tags) => {
        if (liveHistoryItem) {
          updateHistoryRating(liveHistoryItem.id, r, n, dr, tags);
        } else if (liveMovie.watched) {
          const hist = appData.history.find((h) => (h.itemId === liveMovie.id || h.id === liveMovie.id) && (h.kind === 'movie' || h.type === 'movie'));
          if (hist) updateHistoryRating(hist.id, r, n, dr, tags);
          else watchMovie(liveMovie.id, r, n, dr, tags);
        } else {
          watchMovie(liveMovie.id, r, n, dr, tags);
        }
        setRatingModalConfig(null);
        onClose();
      }
    });
  };

  const handleOpenEpisodeRating = (ep: Episode, isAlreadyWatched: boolean) => {
    if (!liveSeries) return;
    setRatingModalConfig({
      title: liveSeries.title,
      subtitle: `${ep.season}. Sezon ${ep.episode}. Bölüm ${isAlreadyWatched ? '(Puanı Düzenle)' : ''}`,
      initialRating: ep.rating,
      initialNote: ep.note,
      initialDetailedRating: ep.detailedRating,
      initialReviewTags: ep.reviewTags,
      onSubmit: (r, n, dr, tags) => {
        if (isAlreadyWatched) {
          const hist = appData.history.find((h) => h.itemId === ep.id || h.id === ep.id);
          if (hist) updateHistoryRating(hist.id, r, n, dr, tags);
          else watchEpisode(liveSeries.id, ep.id, r, n, dr, tags);
        } else {
          watchEpisode(liveSeries.id, ep.id, r, n, dr, tags);
        }
        setRatingModalConfig(null);
        onClose();
      }
    });
  };

  const handleOpenHistoryItemRating = () => {
    if (!liveHistoryItem) return;
    setRatingModalConfig({
      title: liveHistoryItem.title,
      subtitle: liveHistoryItem.season != null ? `${liveHistoryItem.season}. Sezon ${liveHistoryItem.episode}. Bölüm (Puanı Düzenle)` : 'Puanı Düzenle',
      initialRating: liveHistoryItem.rating,
      initialNote: liveHistoryItem.note,
      initialDetailedRating: liveHistoryItem.detailedRating,
      initialReviewTags: liveHistoryItem.reviewTags,
      onSubmit: (r, n, dr, tags) => {
        updateHistoryRating(liveHistoryItem.id, r, n, dr, tags);
        setRatingModalConfig(null);
        onClose();
      }
    });
  };

  const getWatchLinks = () => {
    const links: { href: string; text: string; logo: string | null; icon: any; isTrailer?: boolean }[] = [];
    const trailerQuery = encodeURIComponent(`${title} ${year || ''} official trailer fragman`);
    links.push({ href: `https://www.youtube.com/results?search_query=${trailerQuery}`, text: 'Fragmanı İzle', logo: null, icon: Youtube, isTrailer: true });

    const customUrl = isMovie ? liveMovie!.customUrl : liveSeries!.customUrl;
    const watchProviders = isMovie ? liveMovie!.watchProviders : liveSeries!.watchProviders;
    const imdbId = isMovie ? liveMovie!.imdbId : liveSeries!.imdbId;

    if (customUrl) links.push({ href: customUrl, text: 'Özel Kaynak', logo: null, icon: ExternalLink });

    if (watchProviders && watchProviders.length > 0) {
      watchProviders.slice(0, 3).forEach((provider) => {
        let finalHref = provider.link || '';
        const pName = provider.providerName.toLowerCase();
        if (pName.includes('netflix')) finalHref = `https://www.netflix.com/search?q=${encodeURIComponent(title)}`;
        else if (pName.includes('amazon') || pName.includes('prime')) finalHref = `https://www.primevideo.com/search/ref=atv_sr_sug_1?phrase=${encodeURIComponent(title)}`;
        else if (pName.includes('disney')) finalHref = `https://www.disneyplus.com/search?q=${encodeURIComponent(title)}`;
        else if (pName.includes('blutv')) finalHref = `https://www.blutv.com/arama?q=${encodeURIComponent(title)}`;
        else if (pName.includes('mubi')) finalHref = `https://mubi.com/tr/search?query=${encodeURIComponent(title)}`;
        else if (pName.includes('apple')) finalHref = `https://tv.apple.com/tr/search?q=${encodeURIComponent(title)}`;
        links.push({ href: finalHref, text: provider.providerName, logo: provider.logoUrl, icon: PlayCircle });
      });
    }

    const searchSuffix = isMovie ? 'izle' : 'dizi izle';
    const searchQuery = encodeURIComponent(`${title} ${year || ''} ${searchSuffix}`);
    links.push({ href: `https://www.google.com/search?q=${searchQuery}`, text: "Google'da Bul", logo: null, icon: Search });

    if (appData.altWatchTemplate && (imdbId || appData.altWatchTemplate.includes('{slug}') || appData.altWatchTemplate.includes('{title}'))) {
      const charMap: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
      const slug = title.toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, (match) => charMap[match]).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const finalAltHref = appData.altWatchTemplate.replace('{imdb}', imdbId || '').replace('{slug}', slug).replace('{title}', encodeURIComponent(title)).replace('{year}', year || '');
      links.push({ href: finalAltHref, text: 'Alternatif', logo: null, icon: PlayCircle });
    }
    return links;
  };

  const watchLinks = getWatchLinks();
  const watchedEpisodes = !isMovie && liveSeries ? [...liveSeries.episodes].filter((e) => e.watched).sort((a, b) => (a.season === b.season ? a.episode - b.episode : a.season - b.season)) : [];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-3 pt-16 pb-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-ink-900/95 border border-ink-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[calc(100vh-5rem)] sm:max-h-[90vh] animate-fade-in-up"
      >
        {posterUrl && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
            <img src={posterUrl} alt="" className="w-full h-full object-cover blur-3xl scale-125 saturate-150" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-900/80 to-transparent" />
          </div>
        )}

        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-30 w-10 h-10 rounded-full bg-ink-950/90 hover:bg-ink-800 text-ink-200 hover:text-white border border-ink-700/80 flex items-center justify-center transition-all hover:scale-110 shadow-lg"
          title="Kapat"
        >
          <X size={20} />
        </button>

        <div className="relative z-10 flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 custom-scrollbar">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div className="w-40 sm:w-52 aspect-[2/3] flex-shrink-0 rounded-2xl overflow-hidden bg-ink-950 border-2 border-ink-700/60 shadow-2xl relative group">
              {posterUrl ? (
                <img src={posterUrl} alt={title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-ink-600 gap-2">
                  {isMovie ? <Film size={48} /> : <Tv size={48} />}
                  <span className="text-xs font-medium">Afiş Yok</span>
                </div>
              )}
              <div className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1">
                {isMovie ? <Film size={11} className="text-gold-400" /> : <Tv size={11} className="text-azure-400" />}
                {isMovie ? 'Film' : 'Dizi'}
              </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col text-center md:text-left w-full">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pr-0 md:pr-10">
                <div>
                  {collectionName && (
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-gold-400 bg-gold-500/10 border border-gold-500/30 px-2.5 py-0.5 rounded-full mb-2">
                      <Layers size={12} /> {collectionName} Koleksiyonu
                    </div>
                  )}
                  <h2 className="text-2xl sm:text-3xl font-black text-ink-50 tracking-tight leading-tight">{title}</h2>
                  {liveHistoryItem && liveHistoryItem.season != null && (
                    <div className="mt-1.5 inline-block text-xs font-bold text-azure-300 bg-azure-500/20 border border-azure-500/30 px-2.5 py-1 rounded-lg">
                      İzlenen: {liveHistoryItem.season}. Sezon {liveHistoryItem.episode}. Bölüm
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center md:items-end gap-2 flex-shrink-0 mx-auto md:mx-0">
                  {displayRating !== null && displayRating !== undefined && (
                    <div className="flex flex-col items-center md:items-end">
                      <div className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl font-black text-xl shadow-lg ${ratingBgClass(displayRating)}`}>
                        <Star size={20} className="fill-current" />
                        <span>{displayRating}</span>
                        <span className="text-xs opacity-75 font-bold">/ 10</span>
                      </div>
                      <span className="text-[10px] text-ink-400 mt-1 font-semibold uppercase tracking-wider">
                        {!isMovie && !liveHistoryItem ? 'Ortalama Puan' : 'Senin Puanın'}
                      </span>
                    </div>
                  )}

                  {isMovie && liveMovie && (
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      {!liveMovie.watched && !liveHistoryItem && (
                        startedTimeText ? (
                          <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-3 py-2 rounded-xl text-xs font-bold">
                            <Timer size={14} className="animate-pulse text-emerald-400" />
                            <span>İzleniyor ({startedTimeText})</span>
                            <button
                              type="button"
                              onClick={() => cancelWatchingMovie(liveMovie.id)}
                              title="Sayacı İptal Et"
                              className="ml-1 text-ink-400 hover:text-red-400"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startWatchingMovie(liveMovie.id, false)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-ink-800 hover:bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 transition-all"
                          >
                            <Play size={13} className="fill-current" /> İzlemeye Başla
                          </button>
                        )
                      )}

                      <button
                        type="button"
                        onClick={handleOpenMovieRating}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md hover:scale-105 ${
                          liveMovie.watched || liveHistoryItem
                            ? 'bg-ink-800 hover:bg-ink-700 text-gold-400 border border-gold-500/30'
                            : 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-ink-950 font-black shadow-gold-500/20'
                        }`}
                      >
                        {liveMovie.watched || liveHistoryItem ? (
                          <><Edit2 size={13} /> Puanı / Notu Düzenle</>
                        ) : (
                          <><Star size={14} className="fill-current" /> Puanla</>
                        )}
                      </button>
                    </div>
                  )}

                  {!isMovie && liveHistoryItem && (
                    <button
                      type="button"
                      onClick={handleOpenHistoryItemRating}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-ink-800 hover:bg-ink-700 text-azure-400 border border-azure-500/30 transition-all shadow-md hover:scale-105"
                    >
                      <Edit2 size={13} /> Bölüm Puanını Düzenle
                    </button>
                  )}

                  {!isMovie && liveSeries && nextEpisodeToWatch && (
                    <button
                      type="button"
                      onClick={() => handleOpenEpisodeRating(nextEpisodeToWatch, false)}
                      className="flex items-center gap-1.5 bg-gradient-to-r from-azure-500 to-azure-600 hover:from-azure-400 hover:to-azure-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-lg shadow-azure-500/20 hover:scale-105"
                    >
                      <Star size={14} className="fill-current" />
                      Sıradaki: {nextEpisodeToWatch.season}. Sezon {nextEpisodeToWatch.episode}. Bölüm Puanla
                    </button>
                  )}

                  {!isMovie && liveSeries && !nextEpisodeToWatch && liveSeries.episodes.length > 0 && (
                    <div className="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-xl">
                      <CheckCircle2 size={14} /> Tüm Bölümler Puanlandı
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3 text-xs text-ink-300 font-medium">
                {year && (
                  <span className="flex items-center gap-1.5 bg-ink-800/70 px-2.5 py-1 rounded-lg border border-ink-700/50">
                    <Calendar size={13} className="text-gold-400" /> {year}
                  </span>
                )}
                {runtime && (
                  <span className="flex items-center gap-1.5 bg-ink-800/70 px-2.5 py-1 rounded-lg border border-ink-700/50">
                    <Clock size={13} className="text-gold-400" /> {runtime} dakika
                  </span>
                )}
                {isMovie && actualRuntime && runtime && actualRuntime < runtime && (
                  <span className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/30 font-bold">
                    <Zap size={13} className="text-emerald-400" /> {actualRuntime} dk'da bitti ({runtime - actualRuntime} dk tasarruf)
                  </span>
                )}
                {!isMovie && liveSeries && (
                  <span className="flex items-center gap-1.5 bg-ink-800/70 px-2.5 py-1 rounded-lg border border-ink-700/50">
                    <Tv size={13} className="text-azure-400" /> {watchedEpisodes.length} / {liveSeries.episodes.length} Bölüm İzlendi
                  </span>
                )}
                {watchedAt && (
                  <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    <Sparkles size={13} /> İzlendi: {liveHistoryItem ? formatDateTime(watchedAt) : formatDateShort(watchedAt)}
                  </span>
                )}
              </div>

              {genres && genres.length > 0 && (
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mt-3">
                  {genres.map((g) => (
                    <span key={g} className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gold-500/10 text-gold-300 border border-gold-500/20">{g}</span>
                  ))}
                </div>
              )}

              {reviewTags && reviewTags.length > 0 && (
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mt-3">
                  {reviewTags.map((tag) => (
                    <span key={tag} className="text-xs font-black px-3 py-1 rounded-xl bg-gold-500/20 text-gold-300 border border-gold-500/40 shadow-sm">{tag}</span>
                  ))}
                </div>
              )}

              <div className="mt-5 bg-ink-950/60 border border-ink-800/80 rounded-2xl p-4 text-left shadow-inner">
                <div className="text-[10px] font-black uppercase tracking-widest text-ink-400 mb-1.5">Konu & Özet</div>
                {overview ? (
                  <p className="text-xs sm:text-sm text-ink-200 leading-relaxed">{overview}</p>
                ) : (
                  <p className="text-xs text-ink-500 italic">
                    Bu yapım için henüz bir özet bilgisi bulunmuyor. Filmler/Diziler sayfasındaki "Eksikleri Bul" butonunu kullanarak TMDB verilerini çekebilirsin.
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-2">
                {watchLinks.map((link, idx) => {
                  const Icon = link.icon;
                  if (link.isTrailer) {
                    return (
                      <a key={idx} href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-600/20 hover:scale-105">
                        <Icon size={15} /> {link.text}
                      </a>
                    );
                  }
                  return (
                    <a
                      key={idx}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        if (isMovie && liveMovie && !liveMovie.watched) startWatchingMovie(liveMovie.id, true);
                      }}
                      className="inline-flex items-center gap-1.5 bg-ink-800 hover:bg-ink-700 text-gold-400 border border-gold-500/30 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                    >
                      {link.logo ? <img src={link.logo} alt={link.text} className="w-4 h-4 rounded-sm object-cover" /> : <Icon size={14} />}
                      {link.text}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {(displayNote || (detailedRating && Object.keys(detailedRating).length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-ink-800/60">
              {displayNote && (
                <div
                  onClick={() => setIsMainNoteExpanded(!isMainNoteExpanded)}
                  title={isMainNoteExpanded ? 'Küçültmek için tıkla' : 'Tamamını okumak için tıkla'}
                  className="bg-ink-950/70 hover:bg-ink-950 border border-gold-500/30 rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-gold-400 mb-2">
                      <span className="flex items-center gap-2"><StickyNote size={14} /> Kişisel İnceleme & Notun</span>
                      <span className="text-[10px] text-ink-500 font-semibold">{isMainNoteExpanded ? 'Küçült' : 'Tıkla & Büyüt'}</span>
                    </div>
                    <p className={`text-sm text-ink-100 italic leading-relaxed ${isMainNoteExpanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-1'}`}>"{displayNote}"</p>
                  </div>
                </div>
              )}

              {detailedRating && Object.keys(detailedRating).length > 0 && (
                <div className="bg-ink-950/70 border border-ink-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-azure-400 mb-3">
                    <SlidersHorizontal size={14} /> Detaylı Kriter Analizi
                  </div>
                  <div className="space-y-2.5">
                    {Object.entries(detailedRating).map(([critId, score]) => {
                      const critObj = appData.criteria?.find((c) => c.id === critId);
                      const critName = critObj ? critObj.name : critId;
                      const pct = Math.min(100, Math.max(0, (Number(score) / 10) * 100));
                      return (
                        <div key={critId} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-ink-200">{critName}</span>
                            <span className="text-gold-400">{score} / 10</span>
                          </div>
                          <div className="h-2 w-full bg-ink-900 rounded-full overflow-hidden border border-ink-800">
                            <div className="h-full bg-gradient-to-r from-gold-500 to-azure-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {((directorsOrCreators && directorsOrCreators.length > 0) || (cast && cast.length > 0) || (studios && studios.length > 0) || (keywords && keywords.length > 0)) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-ink-800/60">
              {directorsOrCreators && directorsOrCreators.length > 0 && (
                <div className="bg-ink-950/40 border border-ink-800/60 rounded-2xl p-3.5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-1.5 mb-2">
                    <User size={13} className="text-gold-400" /> {isMovie ? 'Yönetmen' : 'Yaratıcı / Yönetmen'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {directorsOrCreators.map((d) => (
                      <span key={d} className="text-xs font-bold bg-ink-800/90 text-ink-100 px-2.5 py-1 rounded-lg border border-ink-700/60">{d}</span>
                    ))}
                  </div>
                </div>
              )}

              {studios && studios.length > 0 && (
                <div className="bg-ink-950/40 border border-ink-800/60 rounded-2xl p-3.5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-1.5 mb-2">
                    <Building2 size={13} className="text-azure-400" /> Yapımcı Stüdyo
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {studios.map((s) => (
                      <span key={s} className="text-xs font-semibold bg-ink-800/90 text-ink-200 px-2.5 py-1 rounded-lg border border-ink-700/60">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {cast && cast.length > 0 && (
                <div className="bg-ink-950/40 border border-ink-800/60 rounded-2xl p-3.5 sm:col-span-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-1.5 mb-2">
                    <Users size={13} className="text-gold-400" /> Başrol Oyuncuları
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cast.map((actor) => (
                      <span key={actor} className="text-xs font-medium bg-ink-800/80 text-ink-100 px-3 py-1 rounded-xl border border-ink-700/50">{actor}</span>
                    ))}
                  </div>
                </div>
              )}

              {keywords && keywords.length > 0 && (
                <div className="bg-ink-950/40 border border-ink-800/60 rounded-2xl p-3.5 sm:col-span-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-1.5 mb-2">
                    <Tag size={13} className="text-emerald-400" /> Temalar & Etiketler (DNA)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.slice(0, 15).map((kw) => (
                      <span key={kw} className="text-[11px] bg-ink-900 text-ink-400 px-2 py-0.5 rounded-md border border-ink-800">#{kw}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!isMovie && watchedEpisodes.length > 0 && (
            <div className="pt-2 border-t border-ink-800/60">
              <div className="text-xs font-black uppercase tracking-widest text-azure-400 mb-3 flex items-center gap-2">
                <Tv size={14} /> İzlenen Bölümler & Notların ({watchedEpisodes.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {watchedEpisodes.map((ep) => {
                  const isEpExpanded = expandedEpNotes.has(ep.id);
                  return (
                    <div key={ep.id} className="bg-ink-950/60 border border-ink-800/80 rounded-xl p-3 flex flex-col justify-between gap-2 hover:border-azure-500/40 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-ink-100">{ep.season}. Sezon {ep.episode}. Bölüm</span>
                        <div className="flex items-center gap-1.5">
                          {ep.rating !== null && (
                            <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${ratingBgClass(ep.rating)}`}>{ep.rating}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEpisodeRating(ep, true)}
                            className="p-1 text-ink-500 hover:text-azure-400 bg-ink-900 rounded-md transition-colors"
                            title="Bu Bölümün Puanını / Notunu Düzenle"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                      </div>

                      {ep.reviewTags && ep.reviewTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {ep.reviewTags.map((t) => (
                            <span key={t} className="text-[10px] font-bold bg-azure-500/15 text-azure-300 border border-azure-500/30 px-2 py-0.5 rounded-md">{t}</span>
                          ))}
                        </div>
                      )}

                      {ep.note && (
                        <p
                          onClick={() => toggleEpNote(ep.id)}
                          title={isEpExpanded ? 'Küçültmek için tıkla' : 'Tamamını okumak için tıkla'}
                          className={`text-xs text-ink-300 italic bg-ink-900/60 hover:bg-ink-900 p-2 rounded-lg border-l-2 border-azure-500/40 cursor-pointer ${
                            isEpExpanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-1'
                          }`}
                        >
                          "{ep.note}"
                        </p>
                      )}
                      {ep.watchedAt && <div className="text-[10px] text-ink-500 text-right">{formatDateShort(ep.watchedAt)}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {ratingModalConfig && (
        <div onClick={(e) => e.stopPropagation()}>
          <RatingModal
            title={ratingModalConfig.title}
            subtitle={ratingModalConfig.subtitle}
            initialRating={ratingModalConfig.initialRating}
            initialNote={ratingModalConfig.initialNote}
            initialDetailedRating={ratingModalConfig.initialDetailedRating}
            initialReviewTags={ratingModalConfig.initialReviewTags}
            onRate={(rating, note, detailedRating, reviewTags) => {
              ratingModalConfig.onSubmit(rating, note, detailedRating, reviewTags);
            }}
            onClose={() => setRatingModalConfig(null)}
          />
        </div>
      )}
    </div>
  );
}