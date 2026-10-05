import { useState, useMemo } from 'react';
import {
  Plus, Tv, Trash2, ChevronDown, ChevronRight, Lock, Check, Filter,
  ArrowDownAZ, Star as StarIcon, Search, Edit2, Shuffle, RefreshCw,
  PlayCircle, ExternalLink, Eye, SlidersHorizontal, X, Send, Gift, ListVideo
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ratingBgClass, getNextUnwatchedEpisode, uid } from '../lib/utils';
import { searchTMDBSeries } from '../lib/tmdb';
import { supabase } from '../lib/supabase';
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
  const [detailSeriesId, setDetailSeriesId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Series | null>(null);
  const [deleteEpisodeTarget, setDeleteEpisodeTarget] = useState<{ series: Series; episode: Episode } | null>(null);

  // ARKADAŞA TAVSİYE (TEKLİ & TOPLU) MODAL STATELERİ
  const [showSendModal, setShowSendModal] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [selectedSeriesIdsForSend, setSelectedSeriesIdsForSend] = useState<Set<string>>(new Set());
  const [sendListTitle, setSendListTitle] = useState('');
  const [sendSeriesSearch, setSendSeriesSearch] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);

  const [watchedFilter, setWatchedFilter] = useState<boolean | null>(false);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('az');
  const [search, setSearch] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const detailSeries = useMemo(
    () => (detailSeriesId ? data.series.find((s) => s.id === detailSeriesId) || null : null),
    [data.series, detailSeriesId]
  );

  const handleSyncTMDBSeries = async () => {
    setIsSyncing(true);
    const seriesToSync = data.series.filter(
      (s) => !s.tmdbId || !s.posterUrl || !s.imdbId || !s.watchProviders || !s.creators || s.creators.length === 0 || !s.cast || s.cast.length === 0
    );
    let syncedCount = 0;

    for (const s of seriesToSync) {
      try {
        const results = await searchTMDBSeries(s.title);
        if (results.length > 0) {
          const match = results[0];
          const newGenres = Array.from(new Set([...s.genres, ...match.genres]));

          editSeries(
            s.id, s.title, newGenres, match.posterUrl || s.posterUrl, match.overview || s.overview, match.id, match.year || s.year, true, s.customUrl, match.imdbId || s.imdbId,
            match.watchProviders && match.watchProviders.length > 0 ? match.watchProviders : s.watchProviders,
            { creators: match.creators, cast: match.cast, studios: match.studios, keywords: match.keywords, originalLanguage: match.originalLanguage }
          );
          syncedCount++;
        }
      } catch (e) {
        console.error(`Hata (${s.title}):`, e);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    setIsSyncing(false);
    if (syncedCount > 0) { showToast(`${syncedCount} diziye Sinema Kartı eklendi!`, 'success'); } 
    else { showToast('Tüm künyeler güncel.', 'info'); }
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
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  const clearGenres = () => setSelectedGenres(new Set());

  const activeFilterCount = (search.trim() !== '' ? 1 : 0) + selectedGenres.size + (sortMode !== 'az' ? 1 : 0);

  const resetAllFilters = () => { setSearch(''); setSelectedGenres(new Set()); setSortMode('az'); };

  const sortedSeries = useMemo(() => {
    let list = data.series;

    if (watchedFilter !== null) {
      list = list.filter((s) => {
        const isCompleted = s.episodes.length > 0 && s.episodes.every((e) => e.watched);
        return watchedFilter ? isCompleted : !isCompleted;
      });
    }
    if (selectedGenres.size > 0) { list = list.filter((s) => Array.from(selectedGenres).every((g) => s.genres.includes(g))); }
    if (search.trim()) { const q = search.toLocaleLowerCase('tr-TR'); list = list.filter((s) => s.title.toLocaleLowerCase('tr-TR').includes(q)); }

    return [...list].sort((a, b) => {
      if (sortMode === 'az') return a.title.localeCompare(b.title, 'tr');
      if (sortMode === 'recent') return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      const avgA = a.episodes.filter((e) => e.rating !== null).length > 0 ? a.episodes.reduce((sum, e) => sum + (e.rating || 0), 0) / a.episodes.filter((e) => e.rating !== null).length : -1;
      const avgB = b.episodes.filter((e) => e.rating !== null).length > 0 ? b.episodes.reduce((sum, e) => sum + (e.rating || 0), 0) / b.episodes.filter((e) => e.rating !== null).length : -1;
      return avgB - avgA;
    });
  }, [data.series, watchedFilter, selectedGenres, sortMode, search]);

  const toggleSeries = (id: string) => {
    setExpandedSeries((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  // TAVSİYE MODALINI AÇ (TEKİL VEYA TOPLU)
  const openSendModal = async (singleSeries?: Series) => {
    if (!data.agentId) { showToast('Lütfen önce ayarlardan Sinevia Ağı kimliğinizi oluşturun!', 'error'); return; }
    
    if (singleSeries) {
      setSelectedSeriesIdsForSend(new Set([singleSeries.id]));
      setSendListTitle(`Tavsiye: ${singleSeries.title}`);
    } else {
      setSelectedSeriesIdsForSend(new Set());
      setSendListTitle('Özel Dizi Tavsiyeleri');
    }

    setSendSeriesSearch('');
    setShowSendModal(true);
    setLoadingFriends(true);

    try {
      const { data: fData } = await supabase.from('friendships').select('*').or(`requester_id.eq.${data.agentId},receiver_id.eq.${data.agentId}`).eq('status', 'accepted');
      const friendIds = (fData || []).map(f => f.requester_id === data.agentId ? f.receiver_id : f.requester_id);
      
      if (friendIds.length > 0) {
        const { data: pData } = await supabase.from('profiles').select('*').in('agent_id', friendIds);
        setFriendsList(pData || []);
        if (pData && pData.length > 0) setSelectedFriendId(pData[0].agent_id);
      } else {
        setFriendsList([]);
      }
    } catch (err) {
      console.error(err);
      showToast('Arkadaş listesi alınamadı.', 'error');
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleSendRecommendations = async () => {
    if (!selectedFriendId) { showToast('Lütfen bir arkadaş seç!', 'error'); return; }
    if (selectedSeriesIdsForSend.size === 0) { showToast('En az bir dizi seçmelisin!', 'warning'); return; }

    const selectedSeries = data.series.filter(s => selectedSeriesIdsForSend.has(s.id));
    const items = selectedSeries.map(s => ({
      id: s.id,
      title: s.title,
      type: 'series',
      poster: s.posterUrl || null,
      genres: s.genres,
      year: s.year || ''
    }));

    try {
      await supabase.from('recommendations').insert([{
        id: uid(),
        sender_id: data.agentId,
        receiver_id: selectedFriendId,
        list_title: sendListTitle.trim() || 'Dizi Tavsiyeleri',
        items: items,
        status: 'pending'
      }]);
      showToast(`${items.length} dizi arkadaşına başarıyla gönderildi!`, 'success');
      setShowSendModal(false);
      setSelectedFriendId('');
      setSelectedSeriesIdsForSend(new Set());
    } catch (err) {
      showToast('Gönderilirken hata oluştu!', 'error');
    }
  };

  const toggleSelectSeriesForSend = (id: string) => {
    setSelectedSeriesIdsForSend(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredSeriesForModal = useMemo(() => {
    const q = sendSeriesSearch.trim().toLowerCase();
    if (!q) return data.series;
    return data.series.filter(s => s.title.toLowerCase().includes(q));
  }, [data.series, sendSeriesSearch]);

  const totalCompleted = data.series.filter((s) => s.episodes.length > 0 && s.episodes.every((e) => e.watched)).length;
  const totalOngoing = data.series.length - totalCompleted;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ÜST BAŞLIK & MOBİL UYUMLU AKSİYON BARI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-ink-100 flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-azure-500/20 to-azure-700/20 border border-azure-500/30 flex items-center justify-center">
              <Tv size={20} className="text-azure-300" />
            </div>
            Diziler
          </h1>

          <button
            onClick={() => setShowAdd(true)}
            className="sm:hidden flex items-center gap-1.5 bg-gradient-to-r from-azure-500 to-azure-600 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-lg shadow-azure-500/20"
          >
            <Plus size={16} strokeWidth={2.5} /> Dizi Ekle
          </button>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2">
          {/* YENİ: Toplu Tavsiye Gönder Butonu */}
          <button
            onClick={() => openSendModal()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-violet-950/40 hover:bg-violet-900/60 text-violet-300 border border-violet-500/40 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-lg text-xs sm:text-sm font-bold transition-all shadow-sm"
            title="Arkadaşına tekli veya çoklu dizi listesi öner"
          >
            <Send size={15} className="flex-shrink-0 text-violet-400" />
            <span className="truncate">Tavsiye Et</span>
          </button>

          <button
            onClick={handleSyncTMDBSeries}
            disabled={isSyncing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-ink-800/80 hover:bg-ink-700 text-azure-300 border border-azure-500/30 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={15} className={`flex-shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="truncate">{isSyncing ? 'Taranıyor...' : 'Eksikleri Bul'}</span>
          </button>

          <button
            onClick={() => setShowPick(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-ink-800/80 hover:bg-ink-700 text-azure-300 border border-azure-500/30 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-sm"
          >
            <Shuffle size={15} className="flex-shrink-0" />
            <span className="truncate">Ne İzlesem</span>
          </button>

          <button
            onClick={() => setShowAdd(true)}
            className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-azure-500 to-azure-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:from-azure-400 hover:to-azure-500 transition-all shadow-lg shadow-azure-500/20 whitespace-nowrap"
          >
            <Plus size={18} />
            Dizi Ekle
          </button>
        </div>
      </div>

      {/* SEKMELER & TIKLANINCA AÇILAN ARAMA/FİLTRELEME BARI */}
      {data.series.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="grid grid-cols-3 sm:flex bg-ink-900/80 rounded-xl p-1 border border-ink-700/60 gap-1">
              <button
                onClick={() => setWatchedFilter(null)}
                className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all truncate ${
                  watchedFilter === null ? 'bg-ink-700 text-ink-100 shadow-sm' : 'text-ink-400 hover:text-ink-300'
                }`}
              >
                Tümü ({data.series.length})
              </button>
              <button
                onClick={() => setWatchedFilter(false)}
                className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all truncate ${
                  watchedFilter === false ? 'bg-azure-500/20 text-azure-400 border border-azure-500/30' : 'text-ink-400 hover:text-ink-300'
                }`}
              >
                İzlenecek ({totalOngoing})
              </button>
              <button
                onClick={() => setWatchedFilter(true)}
                className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all truncate ${
                  watchedFilter === true ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-ink-400 hover:text-ink-300'
                }`}
              >
                Bitenler ({totalCompleted})
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsFilterPanelOpen((prev) => !prev)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                  isFilterPanelOpen || activeFilterCount > 0
                    ? 'bg-azure-500/15 text-azure-300 border-azure-500/40 shadow-sm'
                    : 'bg-ink-900/70 hover:bg-ink-800 text-ink-300 border-ink-700/60'
                }`}
              >
                <SlidersHorizontal size={14} className="text-azure-400" />
                <span>Ara & Filtrele</span>
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-azure-500 text-white text-[10px] font-black">
                    {activeFilterCount}
                  </span>
                )}
                {isFilterPanelOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  title="Filtreleri sıfırla"
                  className="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-bold transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {isFilterPanelOpen && (
            <div className="bg-ink-900/75 backdrop-blur-md border border-ink-700/70 rounded-2xl p-3 sm:p-4 space-y-3 shadow-xl animate-fade-in">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Dizi ara..."
                  className="w-full bg-ink-950/90 border border-ink-700 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-azure-500/50 transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
                <div className="flex items-center gap-1 text-[11px] font-bold text-ink-400 mr-1 flex-shrink-0">
                  <Filter size={12} /> Sırala:
                </div>
                <button
                  onClick={() => setSortMode('az')}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    sortMode === 'az' ? 'bg-azure-500/20 border border-azure-500/30 text-azure-300' : 'bg-ink-950/60 border border-ink-800 text-ink-400 hover:text-ink-200'
                  }`}
                >
                  <ArrowDownAZ size={13} /> A-Z
                </button>
                <button
                  onClick={() => setSortMode('recent')}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    sortMode === 'recent' ? 'bg-azure-500/20 border border-azure-500/30 text-azure-300' : 'bg-ink-950/60 border border-ink-800 text-ink-400 hover:text-ink-200'
                  }`}
                >
                  En Yeni
                </button>
                <button
                  onClick={() => setSortMode('rating')}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    sortMode === 'rating' ? 'bg-azure-500/20 border border-azure-500/30 text-azure-300' : 'bg-ink-950/60 border border-ink-800 text-ink-400 hover:text-ink-200'
                  }`}
                >
                  <StarIcon size={13} /> Puan
                </button>
              </div>

              {allGenres.length > 0 && (
                <div className="flex sm:flex-wrap gap-1.5 items-center overflow-x-auto hide-scrollbar pt-1 border-t border-ink-800/70">
                  <button
                    onClick={clearGenres}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                      selectedGenres.size === 0 ? 'bg-azure-500 text-white' : 'bg-ink-950 text-ink-400 hover:bg-ink-800 hover:text-ink-200 border border-ink-800'
                    }`}
                  >
                    Tüm Türler
                  </button>
                  {allGenres.map((g) => {
                    const active = selectedGenres.has(g);
                    return (
                      <button
                        key={g}
                        onClick={() => toggleGenre(g)}
                        className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                          active ? 'bg-azure-500 text-white' : 'bg-ink-950 text-ink-400 hover:bg-ink-800 hover:text-ink-200 border border-ink-800'
                        }`}
                      >
                        {active && <Check size={11} />}
                        {g}
                      </button>
                    );
                  })}
                </div>
              )}
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
        <div className="space-y-2.5 sm:space-y-3">
          {sortedSeries.map((s) => {
            const isExpanded = expandedSeries.has(s.id);
            const seasons = Array.from(new Set(s.episodes.map((e) => e.season))).sort((a, b) => a - b);
            const watchedCount = s.episodes.filter((e) => e.watched).length;
            const allWatched = s.episodes.length > 0 && s.episodes.every((e) => e.watched);

            const watchLinks: { href: string; text: string; logo: string | null; icon: any }[] = [];

            if (s.customUrl) {
              watchLinks.push({ href: s.customUrl, text: 'Özel Kaynak', logo: null, icon: ExternalLink });
            }

            if (s.watchProviders && s.watchProviders.length > 0) {
              s.watchProviders.slice(0, 2).forEach((provider) => {
                let finalHref = provider.link || '';
                const pName = provider.providerName.toLowerCase();

                if (pName.includes('netflix')) finalHref = `https://www.netflix.com/search?q=${encodeURIComponent(s.title)}`;
                else if (pName.includes('amazon') || pName.includes('prime')) finalHref = `https://www.primevideo.com/search?ref=atv_sr_sug_1?phrase=${encodeURIComponent(s.title)}`;
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
              icon: Search,
            });

            if (data.altWatchTemplate && (s.imdbId || data.altWatchTemplate.includes('{slug}') || data.altWatchTemplate.includes('{title}'))) {
              const charMap: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
              const slug = s.title
                .toLocaleLowerCase('tr-TR')
                .replace(/[çğıöşü]/g, (match) => charMap[match])
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');

              const finalAltHref = data.altWatchTemplate
                .replace('{imdb}', s.imdbId || '')
                .replace('{slug}', slug)
                .replace('{title}', encodeURIComponent(s.title))
                .replace('{year}', s.year || '');

              watchLinks.push({ href: finalAltHref, text: 'Alternatif', logo: null, icon: PlayCircle });
            }

            return (
              <div key={s.id} className="flex flex-col sm:flex-row bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl overflow-hidden shadow-lg shadow-ink-950/30 transition-all hover:border-ink-600/50 flex-wrap">
                <div
                  onClick={() => toggleSeries(s.id)}
                  className="flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 hover:bg-ink-800/40 transition-colors w-full cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 w-full min-w-0">
                    {isExpanded ? <ChevronDown size={17} className="text-ink-500 flex-shrink-0" /> : <ChevronRight size={17} className="text-ink-500 flex-shrink-0" />}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailSeriesId(s.id);
                      }}
                      title="Dizi Sinema Kartını Gör"
                      className="w-14 sm:w-16 aspect-[2/3] flex-shrink-0 bg-ink-900 rounded-lg overflow-hidden flex items-center justify-center border border-ink-700/50 shadow-md relative group/poster cursor-pointer focus:outline-none focus:ring-2 focus:ring-azure-500"
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
                      </div>
                    </button>

                    <div className="text-left min-w-0 flex-1 flex flex-col justify-center">
                      <div className={`font-bold text-sm sm:text-base truncate mb-0.5 ${allWatched ? 'text-ink-500' : 'text-ink-100'}`}>
                        {s.title}
                      </div>

                      <div className="text-[11px] sm:text-xs text-ink-500 truncate mb-1.5">
                        {s.genres.join(' · ') || 'Tür yok'} {s.year && ` · ${s.year}`}
                      </div>

                      <div className="flex gap-1.5 flex-wrap">
                        {watchLinks.map((link, idx) => {
                          const Icon = link.icon;
                          return (
                            <a
                              key={idx}
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 bg-ink-800/80 hover:bg-azure-900/40 text-azure-400 border border-azure-500/30 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all"
                            >
                              {link.logo ? <img src={link.logo} alt="Platform" className="w-3 h-3 rounded-sm object-cover" /> : <Icon size={11} />}
                              <span>{link.text}</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 px-3 py-2.5 sm:p-4 border-t border-ink-800/50 sm:border-t-0 sm:border-l shrink-0">
                  <span className="text-[11px] sm:text-xs text-ink-400 bg-ink-800/60 px-2.5 py-0.5 rounded-full font-semibold">
                    {watchedCount}/{s.episodes.length} bölüm
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* YENİ: Arkadaşa Tavsiye Et Butonu */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openSendModal(s);
                      }}
                      title="Arkadaşına Tavsiye Et"
                      className="text-violet-400 hover:text-white bg-violet-500/10 hover:bg-violet-500/30 p-1.5 rounded-lg transition-colors border border-transparent hover:border-violet-500/50"
                    >
                      <Send size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditTarget(s);
                      }}
                      className="text-ink-500 hover:text-azure-400 bg-ink-900/50 hover:bg-ink-800 p-1.5 rounded-lg transition-colors border border-transparent hover:border-ink-700"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(s);
                      }}
                      className="text-ink-500 hover:text-red-400 bg-ink-900/50 hover:bg-ink-800 p-1.5 rounded-lg transition-colors border border-transparent hover:border-ink-700"
                    >
                      <Trash2 size={15} />
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
                          <div key={season} className="p-3 sm:p-4 border-b border-ink-700/30 last:border-0">
                            <div className="text-xs sm:text-sm font-semibold text-ink-300 mb-2.5 flex items-center gap-2">
                              {season}. Sezon
                              {seasonAllWatched && (
                                <span className="text-green-400 text-xs flex items-center gap-0.5">
                                  <Check size={13} /> Tamamlandı
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-5 xs:grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
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

      {/* YENİ: ARKADAŞA TAVSİYE MODALI (TEKLİ & ÇOKLU DİZİ DESTEKLİ, GRID TASARIMLI) */}
      {showSendModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowSendModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl h-[85vh] bg-ink-950 border border-violet-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-ink-800 bg-ink-900/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center border border-violet-500/30"><Send size={15} /></div>
                <h2 className="text-sm font-black text-white">Arkadaşına Dizi Tavsiyesi Gönder</h2>
              </div>
              <button onClick={() => setShowSendModal(false)} className="text-ink-500 hover:text-white p-1 rounded-lg"><X size={17} /></button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              <div className="w-full md:w-64 p-4 border-b md:border-b-0 md:border-r border-ink-800 bg-ink-900/20 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-shrink-0">
                {loadingFriends ? (
                  <div className="text-center py-6 text-xs text-ink-500 animate-pulse">Arkadaşların yükleniyor...</div>
                ) : friendsList.length === 0 ? (
                  <div className="text-center py-8 text-xs text-ink-500 bg-ink-900/40 rounded-2xl border border-ink-800">
                    Ağında ekli arkadaşın bulunamadı.
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-1.5">1. Kime Gidecek?</label>
                      <select 
                        value={selectedFriendId} 
                        onChange={(e) => setSelectedFriendId(e.target.value)}
                        className="w-full bg-ink-900 border border-ink-700 rounded-xl px-3 py-2 text-xs text-white focus:border-violet-500 outline-none"
                      >
                        <option value="">-- Arkadaş Seç --</option>
                        {friendsList.map(f => (
                          <option key={f.agent_id} value={f.agent_id}>{f.nickname}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-1.5">2. Liste Başlığı</label>
                      <input 
                        type="text" 
                        value={sendListTitle}
                        onChange={(e) => setSendListTitle(e.target.value)}
                        placeholder="Örn: Bu Sezon Kaçırılmayacaklar"
                        className="w-full bg-ink-900 border border-ink-700 rounded-xl px-3 py-2 text-xs text-white focus:border-violet-500 outline-none"
                      />
                    </div>
                  </>
                )}

                <div className="pt-2 border-t border-ink-800">
                  <label className="block text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-2">3. Listende Ara</label>
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                    <input 
                      type="text" 
                      placeholder="Dizi adı yaz..."
                      value={sendSeriesSearch}
                      onChange={(e) => setSendSeriesSearch(e.target.value)}
                      className="w-full bg-ink-950 border border-ink-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:border-violet-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden bg-ink-950 relative">
                <div className="p-3 border-b border-ink-800 flex items-center justify-between bg-ink-900/40">
                  <span className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Kütüphanen</span>
                  <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap">
                    {selectedSeriesIdsForSend.size} Dizi Seçildi
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
                  {filteredSeriesForModal.length === 0 ? (
                    <div className="text-center py-6 text-xs text-ink-500">Dizi bulunamadı.</div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 p-1">
                      {filteredSeriesForModal.map(s => {
                        const isChecked = selectedSeriesIdsForSend.has(s.id);
                        return (
                          <div 
                            key={s.id}
                            onClick={() => toggleSelectSeriesForSend(s.id)}
                            className={`relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer group border-2 transition-all ${isChecked ? 'border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.5)] scale-95' : 'border-transparent hover:border-ink-700 bg-ink-900'}`}
                          >
                            {s.posterUrl ? (
                              <img src={s.posterUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-ink-700 bg-ink-900">
                                <Tv size={24} />
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent p-2 pt-6">
                              <h3 className="text-[9px] font-bold text-white line-clamp-2 leading-tight">{s.title}</h3>
                              <div className="text-[8px] text-ink-400 mt-0.5 truncate">{s.year || 'Yıl yok'} · {s.episodes.length} bölüm</div>
                            </div>
                            <div className={`absolute inset-0 bg-violet-500/20 backdrop-blur-[1px] flex items-center justify-center transition-opacity ${isChecked ? 'opacity-100' : 'opacity-0'}`}>
                              <div className="w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center shadow-lg">
                                <Check size={18} strokeWidth={4} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3.5 border-t border-ink-800 bg-ink-950 flex gap-2 shrink-0">
              <button onClick={() => setShowSendModal(false)} className="px-4 py-2.5 bg-ink-900 text-ink-300 rounded-xl text-xs font-bold hover:bg-ink-800 transition-colors">Vazgeç</button>
              <button 
                onClick={handleSendRecommendations} 
                disabled={!selectedFriendId || selectedSeriesIdsForSend.size === 0} 
                className="flex-1 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-lg shadow-violet-500/20"
              >
                <Send size={14} /> Tavsiye Listesini Gönder ({selectedSeriesIdsForSend.size})
              </button>
            </div>
          </div>
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
          allowPastWatch={false}
          onRate={(rating, note, detailedRating, reviewTags) => {
            watchEpisode(pickedSeriesItem.series.id, pickedSeriesItem.episode.id, rating, note, detailedRating, reviewTags);
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
          allowPastWatch={false}
          onRate={(rating, note, detailedRating, reviewTags) =>
            watchEpisode(ratingTarget.series.id, ratingTarget.episode.id, rating, note, detailedRating, reviewTags)
          }
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
          onClose={() => setDetailSeriesId(null)}
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