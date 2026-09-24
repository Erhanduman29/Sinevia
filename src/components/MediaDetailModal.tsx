import React, { useState } from 'react';
import { X, Calendar, Clock, Star, Film, Tv, PlayCircle, ExternalLink, Search, User, Users, Sparkles, StickyNote, SlidersHorizontal, Youtube, Layers, Building2, Tag, Edit2, CheckCircle2 } from 'lucide-react';
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
  const { data: appData, watchMovie, watchEpisode, updateHistoryRating } = useApp();

  // Puanlama Modalı State'i
  const [ratingModalConfig, setRatingModalConfig] = useState<{
    title: string;
    subtitle: string;
    initialRating?: number | null;
    initialNote?: string;
    onSubmit: (rating: number, note: string, detailedRating?: Record<string, number>) => void;
  } | null>(null);

  const isMovie = target.type === 'movie';
  
  // AppContext üzerinden canlı veriyi çekiyoruz ki kart açıkken puan verildiğinde anında güncellensin!
  const liveMovie = isMovie 
    ? (appData.movies.find(m => m.id === target.data.id) || (target.data as Movie)) 
    : null;
    
  const liveSeries = !isMovie 
    ? (appData.series.find(s => s.id === target.data.id) || (target.data as Series)) 
    : null;

  const liveHistoryItem = target.historyItem 
    ? (appData.history.find(h => h.id === target.historyItem!.id) || target.historyItem) 
    : undefined;

  const title = isMovie ? liveMovie!.title : liveSeries!.title;
  const year = isMovie ? liveMovie!.year : liveSeries!.year;
  const posterUrl = isMovie ? liveMovie!.posterUrl : liveSeries!.posterUrl;
  const overview = isMovie ? liveMovie!.overview : liveSeries!.overview;
  const genres = isMovie ? liveMovie!.genres : liveSeries!.genres;
  const runtime = isMovie ? liveMovie!.runtime : undefined;
  
  const directorsOrCreators = isMovie ? liveMovie!.directors : liveSeries!.creators;
  const cast = isMovie ? liveMovie!.cast : liveSeries!.cast;
  const studios = isMovie ? liveMovie!.studios : liveSeries!.studios;
  const keywords = isMovie ? liveMovie!.keywords : liveSeries!.keywords;

  // Dizi için sıradaki izlenmemiş bölüm
  const nextEpisodeToWatch = !isMovie && liveSeries ? getNextUnwatchedEpisode(liveSeries.episodes) : null;

  // Puan ve Not Hesaplamaları
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

  const displayNote = liveHistoryItem
    ? liveHistoryItem.note
    : isMovie
    ? liveMovie!.note
    : '';

  const detailedRating = liveHistoryItem
    ? liveHistoryItem.detailedRating
    : isMovie
    ? liveMovie!.detailedRating
    : undefined;

  const watchedAt = liveHistoryItem
    ? liveHistoryItem.watchedAt
    : isMovie
    ? liveMovie!.watchedAt
    : null;

  // Koleksiyon Adı (Film ise)
  const collectionName = isMovie && liveMovie!.collectionId
    ? appData.collections.find((c) => c.id === liveMovie!.collectionId)?.name
    : undefined;

  // FİLM PUANLAMA TETİKLEYİCİSİ
  const handleOpenMovieRating = () => {
    if (!liveMovie) return;
    setRatingModalConfig({
      title: liveMovie.title,
      subtitle: liveMovie.year ? `Çıkış Yılı: ${liveMovie.year}` : 'Film',
      initialRating: liveHistoryItem ? liveHistoryItem.rating : liveMovie.rating,
      initialNote: liveHistoryItem ? liveHistoryItem.note : liveMovie.note,
      onSubmit: (r, n, dr) => {
        if (liveHistoryItem) {
          updateHistoryRating(liveHistoryItem.id, r, n, dr);
        } else if (liveMovie.watched) {
          const hist = appData.history.find(h => (h.itemId === liveMovie.id || h.id === liveMovie.id) && (h.kind === 'movie' || h.type === 'movie'));
          if (hist) updateHistoryRating(hist.id, r, n, dr);
          else watchMovie(liveMovie.id, r, n, dr);
        } else {
          watchMovie(liveMovie.id, r, n, dr);
        }
        setRatingModalConfig(null);
      }
    });
  };

  // DİZİ BÖLÜMÜ PUANLAMA TETİKLEYİCİSİ
  const handleOpenEpisodeRating = (ep: Episode, isAlreadyWatched: boolean) => {
    if (!liveSeries) return;
    setRatingModalConfig({
      title: liveSeries.title,
      subtitle: `${ep.season}. Sezon ${ep.episode}. Bölüm ${isAlreadyWatched ? '(Puanı Düzenle)' : ''}`,
      initialRating: ep.rating,
      initialNote: ep.note,
      onSubmit: (r, n, dr) => {
        if (isAlreadyWatched) {
          const hist = appData.history.find(h => h.itemId === ep.id || h.id === ep.id);
          if (hist) updateHistoryRating(hist.id, r, n, dr);
          else watchEpisode(liveSeries.id, ep.id, r, n, dr);
        } else {
          watchEpisode(liveSeries.id, ep.id, r, n, dr);
        }
        setRatingModalConfig(null);
      }
    });
  };

  // GEÇMİŞTEKİ ÖZEL DİZİ BÖLÜMÜNÜ DÜZENLEME
  const handleOpenHistoryItemRating = () => {
    if (!liveHistoryItem) return;
    setRatingModalConfig({
      title: liveHistoryItem.title,
      subtitle: liveHistoryItem.season != null 
        ? `${liveHistoryItem.season}. Sezon ${liveHistoryItem.episode}. Bölüm (Puanı Düzenle)` 
        : 'Puanı Düzenle',
      initialRating: liveHistoryItem.rating,
      initialNote: liveHistoryItem.note,
      onSubmit: (r, n, dr) => {
        updateHistoryRating(liveHistoryItem.id, r, n, dr);
        setRatingModalConfig(null);
      }
    });
  };

  // İzleme Linklerini Oluşturma
  const getWatchLinks = () => {
    const links: { href: string; text: string; logo: string | null; icon: any; isTrailer?: boolean }[] = [];

    // 1. YouTube Fragman Butonu
    const trailerQuery = encodeURIComponent(`${title} ${year || ''} official trailer fragman`);
    links.push({
      href: `https://www.youtube.com/results?search_query=${trailerQuery}`,
      text: 'Fragmanı İzle',
      logo: null,
      icon: Youtube,
      isTrailer: true,
    });

    const customUrl = isMovie ? liveMovie!.customUrl : liveSeries!.customUrl;
    const watchProviders = isMovie ? liveMovie!.watchProviders : liveSeries!.watchProviders;
    const imdbId = isMovie ? liveMovie!.imdbId : liveSeries!.imdbId;

    if (customUrl) {
      links.push({ href: customUrl, text: 'Özel Kaynak', logo: null, icon: ExternalLink });
    }

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
    links.push({
      href: `https://www.google.com/search?q=${searchQuery}`,
      text: "Google'da Bul",
      logo: null,
      icon: Search,
    });

    if (appData.altWatchTemplate && (imdbId || appData.altWatchTemplate.includes('{slug}') || appData.altWatchTemplate.includes('{title}'))) {
      const charMap: Record<string, string> = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
      const slug = title
        .toLocaleLowerCase('tr-TR')
        .replace(/[çğıöşü]/g, (match) => charMap[match])
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      const finalAltHref = appData.altWatchTemplate
        .replace('{imdb}', imdbId || '')
        .replace('{slug}', slug)
        .replace('{title}', encodeURIComponent(title))
        .replace('{year}', year || '');

      links.push({ href: finalAltHref, text: 'Alternatif', logo: null, icon: PlayCircle });
    }

    return links;
  };

  const watchLinks = getWatchLinks();

  // Dizi ise izlenen bölümlerin listesi
  const watchedEpisodes = !isMovie && liveSeries
    ? [...liveSeries.episodes]
        .filter((e) => e.watched)
        .sort((a, b) => (a.season === b.season ? a.episode - b.episode : a.season - b.season))
    : [];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-ink-900/95 border border-ink-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-fade-in-up"
      >
        {/* SİNEMATİK FLU POSTER ARKA PLANI */}
        {posterUrl && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
            <img
              src={posterUrl}
              alt=""
              className="w-full h-full object-cover blur-3xl scale-125 saturate-150"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-900/80 to-transparent" />
          </div>
        )}

        {/* KAPATMA BUTONU */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full bg-ink-950/80 hover:bg-ink-800 text-ink-300 hover:text-white border border-ink-700/60 flex items-center justify-center transition-all hover:scale-110 shadow-lg"
          title="Kapat"
        >
          <X size={20} />
        </button>

        {/* İÇERİK SCROLL ALANI */}
        <div className="relative z-10 flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 custom-scrollbar">
          
          {/* ÜST KISIM: POSTER VE ANA BİLGİLER */}
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            
            {/* Sol: Dev Poster */}
            <div className="w-40 sm:w-52 aspect-[2/3] flex-shrink-0 rounded-2xl overflow-hidden bg-ink-950 border-2 border-ink-700/60 shadow-2xl relative group">
              {posterUrl ? (
                <img src={posterUrl} alt={title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-ink-600 gap-2">
                  {isMovie ? <Film size={48} /> : <Tv size={48} />}
                  <span className="text-xs font-medium">Afiş Yok</span>
                </div>
              )}
              
              {/* Tür Etiketi (Sol Üst) */}
              <div className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1">
                {isMovie ? <Film size={11} className="text-gold-400" /> : <Tv size={11} className="text-azure-400" />}
                {isMovie ? 'Film' : 'Dizi'}
              </div>
            </div>

            {/* Sağ: Başlık, Rozetler, Puanlama Butonları, Konu ve Linkler */}
            <div className="flex-1 min-w-0 flex flex-col text-center md:text-left w-full">
              
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pr-0 md:pr-10">
                <div>
                  {collectionName && (
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-gold-400 bg-gold-500/10 border border-gold-500/30 px-2.5 py-0.5 rounded-full mb-2">
                      <Layers size={12} /> {collectionName} Koleksiyonu
                    </div>
                  )}
                  <h2 className="text-2xl sm:text-3xl font-black text-ink-50 tracking-tight leading-tight">
                    {title}
                  </h2>
                  
                  {liveHistoryItem && liveHistoryItem.season != null && (
                    <div className="mt-1.5 inline-block text-xs font-bold text-azure-300 bg-azure-500/20 border border-azure-500/30 px-2.5 py-1 rounded-lg">
                      İzlenen: {liveHistoryItem.season}. Sezon {liveHistoryItem.episode}. Bölüm
                    </div>
                  )}
                </div>

                {/* SAĞ ÜST: PUAN ROZETİ VE KART İÇİ PUANLAMA BUTONLARI */}
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

                  {/* FİLM İSE: Puanla veya Puanı Düzenle Butonu */}
                  {isMovie && liveMovie && (
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
                        <>
                          <Edit2 size={13} /> Puanı / Notu Düzenle
                        </>
                      ) : (
                        <>
                          <Star size={14} className="fill-current" /> Puanla
                        </>
                      )}
                    </button>
                  )}

                  {/* DİZİ İSE (Geçmişten açıldıysa): O Bölümün Puanını Düzenle */}
                  {!isMovie && liveHistoryItem && (
                    <button
                      type="button"
                      onClick={handleOpenHistoryItemRating}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-ink-800 hover:bg-ink-700 text-azure-400 border border-azure-500/30 transition-all shadow-md hover:scale-105"
                    >
                      <Edit2 size={13} /> Bölüm Puanını Düzenle
                    </button>
                  )}

                  {/* DİZİ İSE: Sıradaki Bölümü Puanla Butonu */}
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

              {/* Meta Bilgiler (Yıl, Süre, İzlenme Tarihi) */}
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

              {/* Türler */}
              {genres && genres.length > 0 && (
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mt-3">
                  {genres.map((g) => (
                    <span
                      key={g}
                      className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gold-500/10 text-gold-300 border border-gold-500/20"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Konu / Özet (TMDB) */}
              <div className="mt-5 bg-ink-950/60 border border-ink-800/80 rounded-2xl p-4 text-left shadow-inner">
                <div className="text-[10px] font-black uppercase tracking-widest text-ink-400 mb-1.5">
                  Konu & Özet
                </div>
                {overview ? (
                  <p className="text-xs sm:text-sm text-ink-200 leading-relaxed">
                    {overview}
                  </p>
                ) : (
                  <p className="text-xs text-ink-500 italic">
                    Bu yapım için henüz bir özet bilgisi bulunmuyor. Filmler/Diziler sayfasındaki "Eksikleri Bul" butonunu kullanarak TMDB verilerini çekebilirsin.
                  </p>
                )}
              </div>

              {/* Fragman ve İzleme Linkleri */}
              <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-2">
                {watchLinks.map((link, idx) => {
                  const Icon = link.icon;
                  if (link.isTrailer) {
                    return (
                      <a
                        key={idx}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-600/20 hover:scale-105"
                      >
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
                      className="inline-flex items-center gap-1.5 bg-ink-800 hover:bg-ink-700 text-gold-400 border border-gold-500/30 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                    >
                      {link.logo ? (
                        <img src={link.logo} alt={link.text} className="w-4 h-4 rounded-sm object-cover" />
                      ) : (
                        <Icon size={14} />
                      )}
                      {link.text}
                    </a>
                  );
                })}
              </div>

            </div>
          </div>

          {/* KULLANICI DEĞERLENDİRMESİ: NOTLAR VE DETAYLI KRİTER PUANLARI */}
          {(displayNote || (detailedRating && Object.keys(detailedRating).length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-ink-800/60">
              
              {/* Kişisel Not */}
              {displayNote && (
                <div className="bg-ink-950/70 border border-gold-500/30 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gold-400 mb-2">
                      <StickyNote size={14} /> Kişisel İnceleme & Notun
                    </div>
                    <p className="text-sm text-ink-100 italic whitespace-pre-wrap leading-relaxed">
                      "{displayNote}"
                    </p>
                  </div>
                </div>
              )}

              {/* Detaylı Kriter Puanları */}
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
                            <div
                              className="h-full bg-gradient-to-r from-gold-500 to-azure-500 rounded-full transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GENETİK KÜNYE: YÖNETMEN, OYUNCULAR, STÜDYO */}
          {((directorsOrCreators && directorsOrCreators.length > 0) ||
            (cast && cast.length > 0) ||
            (studios && studios.length > 0) ||
            (keywords && keywords.length > 0)) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-ink-800/60">
              
              {directorsOrCreators && directorsOrCreators.length > 0 && (
                <div className="bg-ink-950/40 border border-ink-800/60 rounded-2xl p-3.5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-1.5 mb-2">
                    <User size={13} className="text-gold-400" /> {isMovie ? 'Yönetmen' : 'Yaratıcı / Yönetmen'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {directorsOrCreators.map((d) => (
                      <span key={d} className="text-xs font-bold bg-ink-800/90 text-ink-100 px-2.5 py-1 rounded-lg border border-ink-700/60">
                        {d}
                      </span>
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
                      <span key={s} className="text-xs font-semibold bg-ink-800/90 text-ink-200 px-2.5 py-1 rounded-lg border border-ink-700/60">
                        {s}
                      </span>
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
                      <span key={actor} className="text-xs font-medium bg-ink-800/80 text-ink-100 px-3 py-1 rounded-xl border border-ink-700/50">
                        {actor}
                      </span>
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
                      <span key={kw} className="text-[11px] bg-ink-900 text-ink-400 px-2 py-0.5 rounded-md border border-ink-800">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DİZİ İSE: İZLENEN BÖLÜMLERİN NOT VE PUAN GEÇMİŞİ (Her biri düzenlenebilir!) */}
          {!isMovie && watchedEpisodes.length > 0 && (
            <div className="pt-2 border-t border-ink-800/60">
              <div className="text-xs font-black uppercase tracking-widest text-azure-400 mb-3 flex items-center gap-2">
                <Tv size={14} /> İzlenen Bölümler & Notların ({watchedEpisodes.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {watchedEpisodes.map((ep) => (
                  <div
                    key={ep.id}
                    className="bg-ink-950/60 border border-ink-800/80 rounded-xl p-3 flex flex-col justify-between gap-2 hover:border-azure-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink-100">
                        {ep.season}. Sezon {ep.episode}. Bölüm
                      </span>
                      <div className="flex items-center gap-1.5">
                        {ep.rating !== null && (
                          <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${ratingBgClass(ep.rating)}`}>
                            {ep.rating}
                          </span>
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
                    {ep.note && (
                      <p className="text-xs text-ink-300 italic bg-ink-900/60 p-2 rounded-lg border-l-2 border-azure-500/40">
                        "{ep.note}"
                      </p>
                    )}
                    {ep.watchedAt && (
                      <div className="text-[10px] text-ink-500 text-right">
                        {formatDateShort(ep.watchedAt)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* KART İÇİ PUANLAMA MODALI */}
      {ratingModalConfig && (
        <div onClick={(e) => e.stopPropagation()}>
          <RatingModal
            title={ratingModalConfig.title}
            subtitle={ratingModalConfig.subtitle}
            initialRating={ratingModalConfig.initialRating}
            initialNote={ratingModalConfig.initialNote}
            onRate={(rating, note, detailedRating) => {
              ratingModalConfig.onSubmit(rating, note, detailedRating);
            }}
            onClose={() => setRatingModalConfig(null)}
          />
        </div>
      )}
    </div>
  );
}