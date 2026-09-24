import { useState, useMemo } from 'react';
import { Plus, Tv, Trash2, ChevronDown, ChevronRight, Lock, Check, Filter, ArrowDownAZ, Star as StarIcon, Search, Edit2, Shuffle, RefreshCw, PlayCircle, ExternalLink, Eye } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass, getNextUnwatchedEpisode } from '../lib/utils';
import { searchTMDBSeries } from '../lib/tmdb';
import AddSeriesModal from '../components/AddSeriesModal';
import RatingModal from '../components/RatingModal';
import EditSeriesModal from '../components/EditSeriesModal';
import ConfirmDialog from '../components/ConfirmDialog';
import PickModal from '../components/PickModal';
import MediaDetailModal from '../components/MediaDetailModal';
import type { Series, Episode } from '../types';

type SortMode = 'az' | 'recent' | 'rating';

export default function SeriesPage() {
  const { data, editSeries, deleteSeries, watchEpisode, canWatchEpisode, unwatchEpisode, deleteEpisode, showToast } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [showPick, setShowPick] = useState(false);
  const [pickedSeriesItem, setPickedSeriesItem] = useState<{ series: Series; episode: Episode } | null>(null);
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());
  const [ratingTarget, setRatingTarget] = useState<{ series: Series; episode: Episode } | null>(null);
  const [editTarget, setEditTarget] = useState<Series | null>(null);
  const [detailSeries, setDetailSeries] = useState<Series | null>(null);
  
  const [deleteTarget, setDeleteTarget] = useState<Series | null>(null);
  const [deleteEpisodeTarget, setDeleteEpisodeTarget] = useState<{ series: Series; episode: Episode } | null>(null);
  
  const [watchedFilter, setWatchedFilter] = useState<boolean | null>(false);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('az');
  const [search, setSearch] = useState('');
  
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncTMDBSeries = async () => {
    setIsSyncing(true);
    const seriesToSync = data.series.filter(
      s => !s.tmdbId || !s.posterUrl || !s.imdbId || !s.watchProviders || !s.creators || s.creators.length === 0 || !s.cast || s.cast.length === 0
    );
    let syncedCount = 0;
    
    for (const s of seriesToSync) {
      try {
        const results = await searchTMDBSeries(s.title);
        if (results.length > 0) {
          const match = results[0];
          const newGenres = Array.from(new Set([...s.genres, ...match.genres]));
          
          editSeries(
            s.id, 
            s.title, 
            newGenres, 
            match.posterUrl || s.posterUrl, 
            match.overview || s.overview, 
            match.id, 
            match.year || s.year, 
            true,
            s.customUrl,
            match.imdbId || s.imdbId,
            match.watchProviders && match.watchProviders.length > 0 ? match.watchProviders : s.watchProviders,
            {
              creators: match.creators && match.creators.length > 0 ? match.creators : s.creators,
              cast: match.cast && match.cast.length > 0 ? match.cast : s.cast,
              studios: match.studios && match.studios.length > 0 ? match.studios : s.studios,
              keywords: match.keywords && match.keywords.length > 0 ? match.keywords : s.keywords,
              originalLanguage: match.originalLanguage || s.originalLanguage
            }
          );
          syncedCount++;
        }
      } catch (e) {
        console.error(`Senkronizasyon hatası (${s.title}):`, e);
      }
      await new Promise(resolve => setTimeout(resolve, 250)); 
    }
    
    setIsSyncing(false);
    if (syncedCount > 0) {
      showToast(`${syncedCount} diziye Sinema Kartı künyesi ve izleme linkleri eklendi!`, 'success');
    } else {
      showToast('Kütüphanenin tüm dizi künyeleri güncel.', 'info');
    }
  };

  const nextEpisodes = useMemo(() => {
    return data.series
      .map((s) => {
        const next = getNextUnwatchedEpisode(s.episodes);
        return next ? { series: s, episode: next } : null;
      })
      .filter((x): x is { series: Series; episode: Episode } => x !== null);
  }, [data.series]);

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    data.series.forEach((s) => s.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [data.series]);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const clearGenres = () => setSelectedGenres(new Set());

  const sortedSeries = useMemo(() => {
    let list = data.series;
    
    if (watchedFilter !== null) {
      list = list.filter(s => {
        const isCompleted = s.episodes.length > 0 && s.episodes.every(e => e.watched);
        return watchedFilter ? isCompleted : !isCompleted;
      });
    }

    if (selectedGenres.size > 0) {
      list = list.filter((s) => Array.from(selectedGenres).every((g) => s.genres.includes(g)));
    }
    
    if (search.trim()) {
      const q = search.toLocaleLowerCase('tr-TR');
      list = list.filter((s) => s.title.toLocaleLowerCase('tr-TR').includes(q));
    }
    
    return [...list].sort((a, b) => {
      if (sortMode === 'az') return a.title.localeCompare(b.title, 'tr');
      if (sortMode === 'recent') return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      const avgA = a.episodes.filter((e) => e.rating !== null).length > 0
        ? a.episodes.reduce((sum, e) => sum + (e.rating || 0), 0) / a.episodes.filter((e) => e.rating !== null).length
        : -1;
      const avgB = b.episodes.filter((e) => e.rating !== null).length > 0
        ? b.episodes.reduce((sum, e) => sum + (e.rating || 0), 0) / b.episodes.filter((e) => e.rating !== null).length
        : -1;
      return avgB - avgA;
    });
  }, [data.series, watchedFilter, selectedGenres, sortMode, search]);

  const toggleSeries = (id: string) => {
    setExpandedSeries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalCompleted = data.series.filter(s => s.episodes.length > 0 && s.episodes.every(e => e.watched)).length;
  const totalOngoing = data.series.length - totalCompleted;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-ink-100 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-azure-500/20 to-azure-700/20 border border-azure-500/30 flex items-center justify-center">
            <Tv size={22} className="text-azure-300" />
          </div>
          Diziler
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncTMDBSeries}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-ink-800/80 hover:bg-ink-700 text-azure-300 border border-azure-500/30 px-3.5 py-2.5 rounded-lg font-semibold transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{isSyncing ? 'Taranıyor...' : 'Eksikleri Bul'}</span>
          </button>
          
          <button
            onClick={() => setShowPick(true)}
            className="flex items-center gap-2 bg-ink-800/80 hover:bg-ink-700 text-azure-300 border border-azure-500/30 px-3.5 py-2.5 rounded-lg font-semibold transition-all shadow-sm"
          >
            <Shuffle size={18} />
            <span className="hidden sm:inline">Bugün Ne İzlesem</span>
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-azure-500 to-azure-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:from-azure-400 hover:to-azure-500 transition-all shadow-lg shadow-azure-500/20"
          >
            <Plus size={20} />
            Dizi Ekle
          </button>
        </div>
      </div>

      {data.series.length > 0 && (
        <div className="space-y-3">
          <div className="flex bg-ink-800/50 rounded-lg p-1 border border-ink-700/50 w-fit">
            <button
              onClick={() => setWatchedFilter(null)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${watchedFilter === null ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-300'}`}
            >
              Tümü ({data.series.length})
            </button>
            <button
              onClick={() => setWatchedFilter(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${watchedFilter === false ? 'bg-azure-500/20 text-azure-400' : 'text-ink-400 hover:text-ink-300'}`}
            >
              İzlenecekler ({totalOngoing})
            </button>
            <button
              onClick={() => setWatchedFilter(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${watchedFilter === true ? 'bg-green-500/20 text-green-400' : 'text-ink-400 hover:text-ink-300'}`}
            >
              Bitenler ({totalCompleted})
            </button>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Dizi ara..."
              className="w-full bg-ink-800/80 border border-ink-700 rounded-lg pl-10 pr-4 py-2 text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-azure-500/50 focus:ring-1 focus:ring-azure-500/30 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-ink-500">
              <Filter size={14} />
            </div>
            <button
              onClick={() => setSortMode('az')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sortMode === 'az' ? 'bg-azure-500/20 border border-azure-500/30 text-azure-300' : 'bg-ink-800/50 border border-ink-700/50 text-ink-400 hover:text-ink-200'
              }`}
            >
              <ArrowDownAZ size={14} /> A-Z
            </button>
            <button
              onClick={() => setSortMode('recent')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sortMode === 'recent' ? 'bg-azure-500/20 border border-azure-500/30 text-azure-300' : 'bg-ink-800/50 border border-ink-700/50 text-ink-400 hover:text-ink-200'
              }`}
            >
              En Yeni
            </button>
            <button
              onClick={() => setSortMode('rating')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sortMode === 'rating' ? 'bg-azure-500/20 border border-azure-500/30 text-azure-300' : 'bg-ink-800/50 border border-ink-700/50 text-ink-400 hover:text-ink-200'
              }`}
            >
              <StarIcon size={14} /> Puan
            </button>
          </div>

          {allGenres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <button
                onClick={clearGenres}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedGenres.size === 0 ? 'bg-azure-500 text-white' : 'bg-ink-800 text-ink-400 hover:bg-ink-700'
                }`}
              >
                Tümü
              </button>
              {allGenres.map((g) => {
                const active = selectedGenres.has(g);
                return (
                  <button
                    key={g}
                    onClick={() => toggleGenre(g)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      active ? 'bg-azure-500 text-white' : 'bg-ink-800 text-ink-400 hover:bg-ink-700'
                    }`}
                  >
                    {active && <Check size={11} />} {g}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {data.series.length === 0 ? (
        <div className="text-center py-16 text-ink-500">
          <div className="w-16 h-16 rounded-2xl bg-ink-800/50 flex items-center justify-center mx-auto mb-4">
            <Tv size={32} className="text-ink-600" />
          </div>
          <p className="text-lg font-medium">Henüz dizi yok.</p>
          <p className="text-sm mt-1">Dizi ekleyerek başla!</p>
        </div>
      ) : sortedSeries.length === 0 ? (
        <div className="text-center py-12 text-ink-500">
          <Tv size={40} className="mx-auto mb-3 opacity-40" />
          <p>{watchedFilter === true ? 'Tamamen bitirdiğin bir dizi yok.' : watchedFilter === false ? 'Bölümleri kalan (izlenecek) dizi yok.' : 'Aramaya uygun dizi bulunamadı.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedSeries.map((s) => {
            const isExpanded = expandedSeries.has(s.id);
            const seasons = Array.from(new Set(s.episodes.map((e) => e.season))).sort((a, b) => a - b);
            const watchedCount = s.episodes.filter((e) => e.watched).length;
            const allWatched = s.episodes.length > 0 && s.episodes.every((e) => e.watched);

            let watchLinks: {href: string; text: string; logo: string | null; icon: any}[] = [];

            if (s.customUrl) {
              watchLinks.push({ href: s.customUrl, text: 'Özel Kaynak', logo: null, icon: ExternalLink });
            }

            if (s.watchProviders && s.watchProviders.length > 0) {
              s.watchProviders.slice(0, 2).forEach(provider => {
                let finalHref = provider.link || '';
                const pName = provider.providerName.toLowerCase();
                
                if (pName.includes('netflix')) finalHref = `https://www.netflix.com/search?q=${encodeURIComponent(s.title)}`;
                else if (pName.includes('amazon') || pName.includes('prime')) finalHref = `https://www.primevideo.com/search/ref=atv_sr_sug_1?phrase=${encodeURIComponent(s.title)}`;
                else if (pName.includes('disney')) finalHref = `https://www.disneyplus.com/search?q=${encodeURIComponent(s.title)}`;
                else if (pName.includes('blutv')) finalHref = `https://www.blutv.com/arama?q=${encodeURIComponent(s.title)}`;
                else if (pName.includes('mubi')) finalHref = `https://mubi.com/tr/search?query=${encodeURIComponent(s.title)}`;
                else if (pName.includes('apple')) finalHref = `https://tv.apple.com/tr/search?q=${encodeURIComponent(s.title)}`;

                watchLinks.push({ href: finalHref, text: provider.providerName, logo: provider.logoUrl, icon: PlayCircle });
              });
            }

            const searchQuery = encodeURIComponent(`${s.title} ${s.year || ''} dizi izle`);
            watchLinks.push({ 
              href: `https://www.google.com/search?q=${searchQuery}`, 
              text: "Google'da Bul", 
              logo: null, 
              icon: Search 
            });

            if (data.altWatchTemplate && (s.imdbId || data.altWatchTemplate.includes('{slug}') || data.altWatchTemplate.includes('{title}'))) {
              const charMap: Record<string, string> = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
              const slug = s.title.toLocaleLowerCase('tr-TR')
                .replace(/[çğıöşü]/g, match => charMap[match])
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
                
              let finalAltHref = data.altWatchTemplate
                .replace('{imdb}', s.imdbId || '')
                .replace('{slug}', slug)
                .replace('{title}', encodeURIComponent(s.title))
                .replace('{year}', s.year || '');
                
              watchLinks.push({ href: finalAltHref, text: 'Alternatif', logo: null, icon: PlayCircle });
            }

            return (
              <div key={s.id} className="flex flex-col sm:flex-row bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl overflow-hidden shadow-lg shadow-ink-950/30 transition-all hover:border-ink-600/50 flex-wrap">
                
                {/* SOL: Başlık ve İçerik */}
                <div
                  onClick={() => toggleSeries(s.id)}
                  className="flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 hover:bg-ink-800/40 transition-colors w-full cursor-pointer"
                >
                  <div className="flex items-center gap-3 w-full min-w-0 pr-0">
                    {isExpanded ? <ChevronDown size={18} className="text-ink-500 flex-shrink-0" /> : <ChevronRight size={18} className="text-ink-500 flex-shrink-0" />}
                    
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailSeries(s);
                      }}
                      title="Dizi Sinema Kartını Gör"
                      className="w-16 sm:w-16 aspect-[2/3] flex-shrink-0 bg-ink-900 rounded-md overflow-hidden flex items-center justify-center border border-ink-700/50 shadow-md relative group/poster cursor-pointer focus:outline-none focus:ring-2 focus:ring-azure-500"
                    >
                      {s.posterUrl ? (
                        <img src={s.posterUrl} alt={s.title} className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300" />
                      ) : (
                        <Tv size={16} className="text-ink-600" />
                      )}
                      <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/poster:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5 p-1">
                        <div className="w-6 h-6 rounded-full bg-azure-500 text-white flex items-center justify-center shadow-md">
                          <Eye size={13} />
                        </div>
                        <span className="text-[8px] font-black text-white uppercase tracking-wider">İncele</span>
                      </div>
                    </button>
                    
                    <div className="text-left min-w-0 flex flex-col justify-center h-full">
                      <div className={`font-bold text-sm sm:text-base truncate mb-1 ${allWatched ? 'text-ink-500' : 'text-ink-100'}`}>
                        {s.title}
                      </div>
                      
                      <div className="text-[10px] sm:text-xs text-ink-500 truncate mb-2">
                        {s.genres.join(' · ') || 'Tür yok'} {s.year && ` · Çıkış: ${s.year}`}
                      </div>
                      
                      <div className="flex gap-2 flex-wrap">
                        {watchLinks.map((link, idx) => {
                          const Icon = link.icon;
                          return (
                            <a 
                              key={idx}
                              href={link.href} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 bg-ink-800/80 hover:bg-azure-900/40 text-azure-400 border border-azure-500/30 px-2 py-1 sm:py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold transition-all hover:scale-105"
                            >
                              {link.logo ? <img src={link.logo} alt="Platform" className="w-3.5 h-3.5 rounded-sm object-cover" /> : <Icon size={12} />}
                              {link.text}
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SAĞ (Mobilde Alt): Aksiyon Butonları */}
                <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 p-3 sm:p-4 border-t border-ink-800/50 sm:border-t-0 sm:border-l shrink-0">
                  <span className="text-[10px] sm:text-xs text-ink-500 bg-ink-800/60 px-2 py-0.5 rounded-full font-medium">
                    {watchedCount}/{s.episodes.length} bölüm
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditTarget(s); }}
                      className="text-ink-500 hover:text-azure-400 bg-ink-900/50 hover:bg-ink-800 p-1.5 rounded-lg transition-colors border border-transparent hover:border-ink-700"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}
                      className="text-ink-500 hover:text-red-400 bg-ink-900/50 hover:bg-ink-800 p-1.5 rounded-lg transition-colors border border-transparent hover:border-ink-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="w-full basis-full border-t border-ink-700/40 bg-ink-950/20">
                    {seasons.length === 0 ? (
                      <div className="p-4 text-sm text-ink-500 text-center">Henüz bölüm eklenmedi.</div>
                    ) : (
                      seasons.map((season) => {
                        const eps = s.episodes.filter((e) => e.season === season).sort((a, b) => a.episode - b.episode);
                        const seasonAllWatched = eps.length > 0 && eps.every((e) => e.watched);
                        return (
                          <div key={season} className="p-4 border-b border-ink-700/30 last:border-0">
                            <div className="text-sm font-semibold text-ink-300 mb-3 flex items-center gap-2">
                              {season}. Sezon
                              {seasonAllWatched && <span className="text-green-400 flex items-center gap-0.5"><Check size={14} /> Tamamlandı</span>}
                            </div>
                            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
                              {eps.map((ep) => {
                                const canWatch = canWatchEpisode(s.id, ep.id);
                                return (
                                  <EpisodeBox
                                    key={ep.id}
                                    episode={ep}
                                    canWatch={canWatch}
                                    onRate={() => {
                                      if (canWatch) setRatingTarget({ series: s, episode: ep });
                                      else showToast('Önce önceki bölümleri izlemelisin!', 'warning');
                                    }}
                                    onUnwatch={() => unwatchEpisode(s.id, ep.id)}
                                    onDelete={() => setDeleteEpisodeTarget({ series: s, episode: ep })} 
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showPick && (
        <PickModal
          movieCount={0}
          seriesCount={nextEpisodes.length}
          unwatchedMovies={[]}
          nextEpisodes={nextEpisodes}
          onPick={(item) => {
            if (item.kind === 'series') setPickedSeriesItem({ series: item.series, episode: item.episode });
          }}
          onClose={() => setShowPick(false)}
        />
      )}

      {pickedSeriesItem && (
        <RatingModal
          title={pickedSeriesItem.series.title}
          subtitle={`${pickedSeriesItem.episode.season}. Sezon ${pickedSeriesItem.episode.episode}. Bölüm`}
          onRate={(rating, note) => {
            watchEpisode(pickedSeriesItem.series.id, pickedSeriesItem.episode.id, rating, note);
            setPickedSeriesItem(null);
          }}
          onClose={() => setPickedSeriesItem(null)}
        />
      )}

      {showAdd && <AddSeriesModal onClose={() => setShowAdd(false)} />}
      
      {ratingTarget && (
        <RatingModal
          title={ratingTarget.series.title}
          subtitle={`${ratingTarget.episode.season}. Sezon ${ratingTarget.episode.episode}. Bölüm`}
          onRate={(rating, note) => watchEpisode(ratingTarget.series.id, ratingTarget.episode.id, rating, note)}
          onClose={() => setRatingTarget(null)}
        />
      )}
      
      {editTarget && <EditSeriesModal series={editTarget} onClose={() => setEditTarget(null)} />}
      
      {deleteTarget && (
        <ConfirmDialog
          title="Dizi Sil"
          message={`"${deleteTarget.title}" ve tüm bölümleri silinecek. Emin misin?`}
          onConfirm={() => {
            deleteSeries(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {deleteEpisodeTarget && (
        <ConfirmDialog
          title="Bölümü Sil"
          message={`"${deleteEpisodeTarget.series.title}" dizisinin ${deleteEpisodeTarget.episode.season}. Sezon ${deleteEpisodeTarget.episode.episode}. Bölümü tamamen silinecek. Emin misin?`}
          onConfirm={() => {
            deleteEpisode(deleteEpisodeTarget.series.id, deleteEpisodeTarget.episode.id);
            setDeleteEpisodeTarget(null);
          }}
          onCancel={() => setDeleteEpisodeTarget(null)}
        />
      )}

      {detailSeries && (
        <MediaDetailModal
          target={{ type: 'series', data: detailSeries }}
          onClose={() => setDetailSeries(null)}
        />
      )}
    </div>
  );
}

function EpisodeBox({
  episode,
  canWatch,
  onRate,
  onUnwatch,
  onDelete,
}: {
  episode: Episode;
  canWatch: boolean;
  onRate: () => void;
  onUnwatch: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {episode.watched && episode.rating !== null && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg ${ratingBgClass(episode.rating)}`}>
            {episode.rating}
          </span>
        </div>
      )}
      <button
        onClick={episode.watched ? onUnwatch : onRate}
        disabled={episode.watched ? false : !canWatch}
        className={`w-full h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
          episode.watched
            ? 'bg-ink-800/60 border-ink-600 hover:border-ink-500'
            : canWatch
            ? 'bg-gradient-to-br from-azure-500/10 to-azure-700/10 border-azure-500/40 hover:border-azure-400 hover:from-azure-500/20 hover:to-azure-700/20 cursor-pointer'
            : 'bg-ink-800/30 border-ink-700/50 cursor-not-allowed'
        }`}
      >
        {episode.watched ? (
          <Check size={14} className="text-green-400" />
        ) : canWatch ? (
          <span className="text-xs font-bold text-azure-300">{episode.episode}</span>
        ) : (
          <Lock size={12} className="text-ink-600" />
        )}
      </button>
      <div className={`text-[10px] text-center mt-0.5 ${episode.watched ? 'text-ink-500' : canWatch ? 'text-ink-400' : 'text-ink-700'}`}>
        {episode.episode}
      </div>
      {showActions && (
        <button
          onClick={onDelete}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-ink-800 border border-ink-600 flex items-center justify-center text-ink-500 hover:text-red-400 transition-colors z-20"
        >
          <Trash2 size={8} />
        </button>
      )}
    </div>
  );
}