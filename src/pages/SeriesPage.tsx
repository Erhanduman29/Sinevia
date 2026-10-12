import { useState, useMemo } from 'react';
import {
  Plus, Tv, Trash2, ChevronDown, ChevronRight, Lock, Check, Filter,
  ArrowDownAZ, Star as StarIcon, Search, Edit2, Shuffle, RefreshCw,
  PlayCircle, ExternalLink, Eye, SlidersHorizontal, X, Send
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

/* ============================================================
   PREMIUM STILLER (svp- öneki · tema token'larına fallback'li)
   Kaynak: sinevia-premium.html — cam yüzeyler · kırmızı vurgu · shine
   ============================================================ */
const SERIES_PREMIUM_CSS = `
.svp-card {
  border: 1px solid var(--line-2, var(--border-dim, rgba(244,244,242,.13)));
  border-radius: var(--r-lg, 22px);
  background: var(--glass, var(--bg-surface, rgba(255,255,255,.05)));
  box-shadow: var(--shadow, 0 20px 48px -24px rgba(0,0,0,.75)), inset 0 1px 0 rgba(255,255,255,.07);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  transition: transform .28s cubic-bezier(.2,.7,.3,1), border-color .28s, box-shadow .28s;
}
.svp-card:hover {
  transform: translateY(-4px);
  border-color: rgba(232,56,79,.45);
  box-shadow: 0 30px 56px -22px rgba(0,0,0,.9), 0 0 36px -14px rgba(232,56,79,.45), inset 0 1px 0 rgba(255,255,255,.1);
}
.svp-panel {
  border: 1px solid var(--line-2, var(--border-dim, rgba(244,244,242,.13)));
  border-radius: var(--r-lg, 22px);
  background: var(--glass, var(--bg-surface, rgba(255,255,255,.05)));
  box-shadow: var(--shadow, 0 20px 48px -24px rgba(0,0,0,.75)), inset 0 1px 0 rgba(255,255,255,.07);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.svp-grad-text {
  background: linear-gradient(100deg, var(--ink, var(--text-main, #f4f4f2)) 25%, var(--muted, #9a9a96));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* --- premium buton sistemi (btn-p / btn-s ruhu) --- */
.svp-btn-p, .svp-btn-s {
  position: relative; overflow: hidden; isolation: isolate;
  display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
  font-weight: 800; letter-spacing: .04em;
  border-radius: 13px; border: 1px solid transparent;
  transition: .25s cubic-bezier(.2,.7,.3,1);
  white-space: nowrap;
}
.svp-btn-p::after, .svp-btn-s::after {
  content: ''; position: absolute; top: 0; left: -80%; width: 55%; height: 100%; z-index: -1;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent);
  transform: skewX(-20deg); transition: left .5s ease;
}
.svp-btn-p:hover::after, .svp-btn-s:hover::after { left: 130%; }
.svp-btn-p:active, .svp-btn-s:active { transform: translateY(1px) scale(.985); }
.svp-btn-p {
  color: #fff;
  background: linear-gradient(150deg, var(--red-hi, var(--color-2, #ff6b7a)) 0%, var(--red, var(--color-1, #e8384f)) 45%, var(--red-deep, var(--color-3, #8e1220)) 130%);
  box-shadow: 0 10px 28px -10px rgba(232,56,79,.75), inset 0 1px 0 rgba(255,255,255,.35), inset 0 -2px 6px rgba(0,0,0,.25);
}
.svp-btn-p:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 36px -10px rgba(232,56,79,.9), inset 0 1px 0 rgba(255,255,255,.4);
}
.svp-btn-s {
  color: var(--ink, var(--text-main, #f4f4f2));
  background: linear-gradient(150deg, rgba(255,255,255,.14), rgba(255,255,255,.05));
  border-color: rgba(255,255,255,.16);
  box-shadow: 0 8px 22px -12px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.16);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.svp-btn-s:hover {
  transform: translateY(-2px);
  background: linear-gradient(150deg, rgba(255,255,255,.2), rgba(255,255,255,.08));
  border-color: rgba(255,255,255,.3);
}
.svp-btn-p:disabled, .svp-btn-s:disabled { opacity: .4; pointer-events: none; }
.svp-btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: .45rem;
  border-radius: 12px; border: 1px solid var(--line-2, var(--border-dim, rgba(244,244,242,.13)));
  background: var(--surface, rgba(255,255,255,.04));
  color: var(--muted, #9a9a96);
  transition: .24s cubic-bezier(.2,.7,.3,1);
}
.svp-btn-ghost:hover {
  transform: translateY(-2px);
  color: var(--ink, var(--text-main, #f4f4f2));
  border-color: rgba(232,56,79,.55);
  box-shadow: 0 10px 26px -12px rgba(232,56,79,.7);
}

/* --- tab + chip sistemi (aktif = kırmızı) --- */
.svp-tab {
  border-radius: 12px; border: 1px solid transparent;
  font-weight: 800; letter-spacing: .03em;
  transition: .22s cubic-bezier(.2,.7,.3,1);
  color: var(--muted, #9a9a96);
  background: transparent;
}
.svp-tab:hover:not(.svp-tab-on) { color: var(--ink, var(--text-main, #f4f4f2)); background: var(--surface, rgba(255,255,255,.05)); }
.svp-tab-on {
  color: #fff;
  background: linear-gradient(140deg, var(--red-hi, var(--color-2, #ff6b7a)), var(--red-deep, var(--color-3, #8e1220)));
  border-color: transparent;
  box-shadow: 0 8px 22px -8px rgba(232,56,79,.8), inset 0 1px 0 rgba(255,255,255,.35);
}
.svp-tab-on .svp-tab-n { color: #fff; }
.svp-tab-n { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; opacity: .85; }
.svp-chip {
  flex-shrink: 0; display: inline-flex; align-items: center; gap: .3rem;
  padding: .34rem .7rem; border-radius: 99px;
  font-size: 11px; font-weight: 800; letter-spacing: .05em;
  border: 1px solid var(--line-2, var(--border-dim, rgba(244,244,242,.13)));
  background: var(--surface, rgba(255,255,255,.04));
  color: var(--muted, #9a9a96);
  transition: .22s cubic-bezier(.2,.7,.3,1);
}
.svp-chip:hover:not(.svp-chip-on) { color: var(--ink, var(--text-main, #f4f4f2)); border-color: rgba(255,255,255,.3); transform: translateY(-2px); }
.svp-chip-on {
  color: #fff;
  background: linear-gradient(140deg, var(--red-hi, var(--color-2, #ff6b7a)), var(--red-deep, var(--color-3, #8e1220)));
  border-color: transparent;
  box-shadow: 0 8px 22px -8px rgba(232,56,79,.8), inset 0 1px 0 rgba(255,255,255,.35);
}
.svp-chip-on:hover { color: #fff; }
.svp-count-pill {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 9.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
  color: var(--red-hi, var(--color-2, #ff6b7a));
  background: rgba(232,56,79,.14); border: 1px solid rgba(232,56,79,.4);
  padding: .3rem .65rem; border-radius: 99px; white-space: nowrap;
}

/* --- mono etiketler --- */
.svp-mono {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 9.5px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
  color: var(--muted, #9a9a96);
}

/* --- bölüm ilerleme barı (gradyan + shine) --- */
.svp-prog {
  position: relative; height: 8px; border-radius: 99px; overflow: hidden;
  background: rgba(0,0,0,.45);
  box-shadow: inset 0 1px 3px rgba(0,0,0,.7);
}
.svp-prog-fill {
  position: absolute; inset: 0 auto 0 0; border-radius: 99px; overflow: hidden;
  background: linear-gradient(90deg, var(--red-deep, var(--color-3, #8e1220)), var(--red, var(--color-1, #e8384f)) 55%, var(--red-hi, var(--color-2, #ff6b7a)));
  box-shadow: 0 0 12px rgba(232,56,79,.7);
  transition: width .5s cubic-bezier(.2,.7,.3,1);
}
.svp-prog-fill::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,.5), transparent);
  transform: translateX(-100%);
  animation: svp-shine 2.6s cubic-bezier(.4,0,.2,1) infinite;
}
@keyframes svp-shine { 60%, 100% { transform: translateX(100%); } }

/* --- kart içi izleme linkleri --- */
.svp-link {
  display: inline-flex; align-items: center; gap: .3rem;
  padding: .22rem .55rem; border-radius: 8px;
  font-size: 10px; font-weight: 700; letter-spacing: .03em;
  border: 1px solid var(--line-2, var(--border-dim, rgba(244,244,242,.13)));
  background: var(--surface, rgba(255,255,255,.05));
  color: var(--muted, #9a9a96);
  transition: .22s cubic-bezier(.2,.7,.3,1);
}
.svp-link:hover {
  color: var(--ink, var(--text-main, #f4f4f2));
  border-color: rgba(232,56,79,.5);
  background: rgba(232,56,79,.12);
  transform: translateY(-1px);
}

/* --- poster çerçevesi --- */
.svp-poster {
  position: relative; overflow: hidden; border-radius: 12px;
  border: 1px solid rgba(255,255,255,.12);
  background: linear-gradient(160deg, #221D2A, #0D0D11);
  box-shadow: 0 10px 26px -12px rgba(0,0,0,.9);
  transition: .26s cubic-bezier(.2,.7,.3,1);
}
.svp-poster:hover {
  border-color: rgba(232,56,79,.6);
  box-shadow: 0 0 0 3px rgba(232,56,79,.16), 0 14px 30px -12px rgba(0,0,0,.95);
}

/* --- bölüm kutucukları --- */
.svp-ep {
  position: relative; width: 100%; height: 2.5rem;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px; border: 1px solid var(--line-2, var(--border-dim, rgba(244,244,242,.13)));
  background: var(--surface, rgba(255,255,255,.04));
  color: var(--muted, #9a9a96);
  font-size: 11px; font-weight: 800;
  transition: .22s cubic-bezier(.2,.7,.3,1);
}
.svp-ep-done {
  color: #fff; border-color: transparent;
  background: linear-gradient(150deg, var(--red-hi, var(--color-2, #ff6b7a)), var(--red-deep, var(--color-3, #8e1220)));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 6px 16px -8px rgba(232,56,79,.8);
}
.svp-ep-ready { color: var(--red-hi, var(--color-2, #ff6b7a)); cursor: pointer; }
.svp-ep-ready:hover {
  transform: translateY(-2px);
  border-color: rgba(232,56,79,.65);
  background: rgba(232,56,79,.12);
  box-shadow: 0 0 0 3px rgba(232,56,79,.16), 0 8px 20px -10px rgba(232,56,79,.8);
  color: #fff;
}
.svp-ep-lock {
  border-style: dashed; cursor: not-allowed; opacity: .55;
  color: var(--muted, #9a9a96);
}

/* --- sezon başlıkları --- */
.svp-season {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10.5px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
  color: var(--ink, var(--text-main, #f4f4f2));
}
.svp-done-tag {
  display: inline-flex; align-items: center; gap: .25rem;
  font-size: 9.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
  color: #4ade80; background: rgba(16,185,129,.12); border: 1px solid rgba(16,185,129,.4);
  padding: .18rem .55rem; border-radius: 99px;
}

/* --- aksiyon ikon butonları --- */
.svp-act {
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 11px; border: 1px solid transparent;
  color: var(--muted, #9a9a96);
  transition: .22s cubic-bezier(.2,.7,.3,1);
}
.svp-act:hover { transform: translateY(-2px); color: var(--ink, var(--text-main, #f4f4f2)); border-color: var(--line-2, var(--border-dim, rgba(244,244,242,.13))); background: var(--surface, rgba(255,255,255,.05)); }
.svp-act-send:hover { color: var(--red-hi, var(--color-2, #ff6b7a)); border-color: rgba(232,56,79,.5); box-shadow: 0 8px 20px -10px rgba(232,56,79,.7); }
.svp-act-del:hover { color: #f87171; border-color: rgba(248,113,113,.45); box-shadow: 0 8px 20px -10px rgba(248,113,113,.6); }

/* --- boş durum kartı --- */
.svp-empty {
  border: 1px dashed var(--line-2, var(--border-dim, rgba(244,244,242,.13)));
  border-radius: var(--r-lg, 22px);
  background: var(--glass, var(--bg-surface, rgba(255,255,255,.04)));
}
`;

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
    } catch {
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
      <style>{SERIES_PREMIUM_CSS}</style>

      {/* ÜST BAŞLIK & MOBİL UYUMLU AKSİYON BARI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase flex items-center gap-2.5">
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-[14px] flex items-center justify-center text-white flex-shrink-0"
              style={{
                background: 'linear-gradient(140deg, var(--red-hi, var(--color-2, #ff6b7a)), var(--red-deep, var(--color-3, #8e1220)))',
                boxShadow: '0 8px 22px -8px rgba(232,56,79,.85), inset 0 1px 0 rgba(255,255,255,.4)'
              }}
            >
              <Tv size={20} />
            </div>
            <span className="svp-grad-text">Diziler</span>
          </h1>

          <button
            onClick={() => setShowAdd(true)}
            className="svp-btn-p sm:hidden px-3.5 py-2 min-h-11 text-xs"
          >
            <Plus size={16} strokeWidth={2.5} /> Dizi Ekle
          </button>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2">
          {/* ARKADAŞA TAVSİYE (TEKLİ & TOPLU) */}
          <button
            onClick={() => openSendModal()}
            className="svp-btn-s flex-1 sm:flex-none px-2.5 sm:px-3.5 py-2 sm:py-2.5 min-h-11 sm:min-h-0 rounded-xl sm:rounded-[13px] text-xs sm:text-sm"
            title="Arkadaşına tekli veya çoklu dizi listesi öner"
          >
            <Send size={15} className="flex-shrink-0 text-[var(--red-hi,#ff6b7a)]" />
            <span className="truncate">Tavsiye Et</span>
          </button>

          <button
            onClick={handleSyncTMDBSeries}
            disabled={isSyncing}
            className="svp-btn-s flex-1 sm:flex-none px-3 sm:px-3.5 py-2 sm:py-2.5 min-h-11 sm:min-h-0 rounded-xl sm:rounded-[13px] text-xs sm:text-sm"
          >
            <RefreshCw size={15} className={`flex-shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="truncate">{isSyncing ? 'Taranıyor...' : 'Eksikleri Bul'}</span>
          </button>

          <button
            onClick={() => setShowPick(true)}
            className="svp-btn-s flex-1 sm:flex-none px-3 sm:px-3.5 py-2 sm:py-2.5 min-h-11 sm:min-h-0 rounded-xl sm:rounded-[13px] text-xs sm:text-sm"
          >
            <Shuffle size={15} className="flex-shrink-0" />
            <span className="truncate">Ne İzlesem</span>
          </button>

          <button
            onClick={() => setShowAdd(true)}
            className="svp-btn-p hidden sm:inline-flex px-4 py-2.5 text-sm"
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
            <div
              className="grid grid-cols-3 sm:flex rounded-[14px] p-1 gap-1"
              style={{
                background: 'var(--surface, rgba(255,255,255,.04))',
                border: '1px solid var(--line-2, var(--border-dim, rgba(244,244,242,.13)))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)'
              }}
            >
              <button
                onClick={() => setWatchedFilter(null)}
                className={`svp-tab px-2.5 sm:px-3 py-1.5 min-h-11 sm:min-h-0 text-[11px] sm:text-xs truncate ${watchedFilter === null ? 'svp-tab-on' : ''}`}
              >
                Tümü <span className="svp-tab-n">({data.series.length})</span>
              </button>
              <button
                onClick={() => setWatchedFilter(false)}
                className={`svp-tab px-2.5 sm:px-3 py-1.5 min-h-11 sm:min-h-0 text-[11px] sm:text-xs truncate ${watchedFilter === false ? 'svp-tab-on' : ''}`}
              >
                İzlenecek <span className="svp-tab-n">({totalOngoing})</span>
              </button>
              <button
                onClick={() => setWatchedFilter(true)}
                className={`svp-tab px-2.5 sm:px-3 py-1.5 min-h-11 sm:min-h-0 text-[11px] sm:text-xs truncate ${watchedFilter === true ? 'svp-tab-on' : ''}`}
              >
                Bitenler <span className="svp-tab-n">({totalCompleted})</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsFilterPanelOpen((prev) => !prev)}
                className={`svp-btn-ghost flex-1 sm:flex-none px-3.5 py-2 min-h-11 sm:min-h-0 text-xs font-bold ${
                  isFilterPanelOpen || activeFilterCount > 0 ? 'svp-chip-on' : ''
                }`}
              >
                <SlidersHorizontal size={14} />
                <span>Ara &amp; Filtrele</span>
                {activeFilterCount > 0 && (
                  <span className="svp-tab-n px-1.5 py-0.2 rounded-full bg-white/25 text-white text-[10px] font-black">
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
                  className="p-2 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-xl text-red-300 border border-red-500/30 bg-red-500/15 hover:bg-red-500/25 text-xs font-bold transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {isFilterPanelOpen && (
            <div className="svp-panel p-3 sm:p-4 space-y-3 animate-fade-in-up">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted,#9a9a96)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Dizi ara..."
                  className="w-full rounded-xl pl-9 pr-8 py-2.5 text-xs sm:text-sm outline-none transition-all"
                  style={{
                    background: 'var(--surface, rgba(255,255,255,.05))',
                    border: '1px solid var(--line-2, var(--border-dim, rgba(244,244,242,.13)))',
                    color: 'var(--ink, var(--text-main, #f4f4f2))',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)'
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted,#9a9a96)] hover:text-[var(--ink,#f4f4f2)] p-1 min-h-9 min-w-9 sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
                <div className="svp-mono flex items-center gap-1 mr-1 flex-shrink-0">
                  <Filter size={12} /> Sırala:
                </div>
                <button
                  onClick={() => setSortMode('az')}
                  className={`svp-chip ${sortMode === 'az' ? 'svp-chip-on' : ''}`}
                >
                  <ArrowDownAZ size={13} /> A-Z
                </button>
                <button
                  onClick={() => setSortMode('recent')}
                  className={`svp-chip ${sortMode === 'recent' ? 'svp-chip-on' : ''}`}
                >
                  En Yeni
                </button>
                <button
                  onClick={() => setSortMode('rating')}
                  className={`svp-chip ${sortMode === 'rating' ? 'svp-chip-on' : ''}`}
                >
                  <StarIcon size={13} /> Puan
                </button>
              </div>

              {allGenres.length > 0 && (
                <div className="flex sm:flex-wrap gap-1.5 items-center overflow-x-auto hide-scrollbar pt-2 border-t" style={{ borderColor: 'var(--line, rgba(244,244,242,.07))' }}>
                  <button
                    onClick={clearGenres}
                    className={`svp-chip ${selectedGenres.size === 0 ? 'svp-chip-on' : ''}`}
                  >
                    Tüm Türler
                  </button>
                  {allGenres.map((g) => {
                    const active = selectedGenres.has(g);
                    return (
                      <button
                        key={g}
                        onClick={() => toggleGenre(g)}
                        className={`svp-chip ${active ? 'svp-chip-on' : ''}`}
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
        <div className="svp-empty text-center py-16 px-6 text-[var(--muted,#9a9a96)]">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: 'linear-gradient(140deg, var(--red-hi, var(--color-2, #ff6b7a)), var(--red-deep, var(--color-3, #8e1220)))',
              boxShadow: '0 10px 26px -10px rgba(232,56,79,.8), inset 0 1px 0 rgba(255,255,255,.4)'
            }}
          >
            <Tv size={32} className="text-white" />
          </div>
          <p className="text-lg font-bold uppercase tracking-wide">Henüz dizi yok.</p>
          <p className="text-sm mt-1">Dizi ekleyerek başla!</p>
        </div>
      ) : sortedSeries.length === 0 ? (
        <div className="svp-empty text-center py-12 px-6 text-[var(--muted,#9a9a96)]">
          <Tv size={40} className="mx-auto mb-3 opacity-40" />
          <p>{watchedFilter === true ? 'Tamamen bitirdiğin bir dizi yok.' : watchedFilter === false ? 'Bölümleri kalan (izlenecek) dizi yok.' : 'Aramaya uygun dizi bulunamadı.'}</p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {sortedSeries.map((s) => {
            const isExpanded = expandedSeries.has(s.id);
            const seasons = Array.from(new Set(s.episodes.map((e) => e.season))).sort((a, b) => a - b);
            const watchedCount = s.episodes.filter((e) => e.watched).length;
            const allWatched = s.episodes.length > 0 && s.episodes.every((e) => e.watched);
            const nextEp = getNextUnwatchedEpisode(s.episodes);
            const progressPct = s.episodes.length > 0 ? Math.round((watchedCount / s.episodes.length) * 100) : 0;

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
              <div key={s.id} className="svp-card overflow-hidden flex flex-col sm:flex-row flex-wrap">
                <div
                  onClick={() => toggleSeries(s.id)}
                  className="flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 w-full cursor-pointer transition-colors hover:bg-[rgba(255,255,255,.03)]"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 w-full min-w-0">
                    {isExpanded ? <ChevronDown size={17} className="text-[var(--red-hi,#ff6b7a)] flex-shrink-0" /> : <ChevronRight size={17} className="text-[var(--muted,#9a9a96)] flex-shrink-0" />}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailSeriesId(s.id);
                      }}
                      title="Dizi Sinema Kartını Gör"
                      className="svp-poster w-14 sm:w-16 aspect-[2/3] flex-shrink-0 flex items-center justify-center group/poster cursor-pointer focus:outline-none"
                    >
                      {s.posterUrl ? (
                        <img src={s.posterUrl} alt={s.title} className="w-full h-full object-cover group-hover/poster:scale-110 transition-transform duration-300" />
                      ) : (
                        <Tv size={16} className="text-[var(--muted,#9a9a96)]" />
                      )}
                      <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/poster:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5 p-1">
                        <div
                          className="w-6 h-6 rounded-full text-white flex items-center justify-center shadow-md"
                          style={{ background: 'linear-gradient(140deg, var(--red-hi, #ff6b7a), var(--red-deep, #8e1220))' }}
                        >
                          <Eye size={13} />
                        </div>
                      </div>
                    </button>

                    <div className="text-left min-w-0 flex-1 flex flex-col justify-center">
                      <div className={`font-black text-[13px] sm:text-[15px] uppercase tracking-tight truncate mb-0.5 ${allWatched ? 'opacity-55' : ''}`} style={{ color: 'var(--ink, var(--text-main, #f4f4f2))' }}>
                        {s.title}
                      </div>

                      <div className="svp-mono truncate mb-1.5">
                        {s.genres.join(' · ') || 'Tür yok'} {s.year && `· ${s.year}`}
                      </div>

                      {!allWatched && nextEp && (
                        <div className="mb-1.5">
                          <span className="svp-count-pill">
                            Sıradaki · S{nextEp.season}B{nextEp.episode}
                          </span>
                        </div>
                      )}

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
                              className="svp-link"
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

                <div className="flex sm:flex-col items-center sm:items-stretch justify-between sm:justify-center gap-2 px-3 py-3 sm:p-4 border-t sm:border-t-0 sm:border-l w-full sm:w-auto sm:min-w-[210px] shrink-0" style={{ borderColor: 'var(--line, rgba(244,244,242,.07))' }}>
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <span className="svp-mono">
                      <span style={{ color: 'var(--red-hi, var(--color-2, #ff6b7a))' }}>{watchedCount}</span>/{s.episodes.length} bölüm
                    </span>
                    {allWatched && (
                      <span className="svp-done-tag"><Check size={10} /> Tamam</span>
                    )}
                  </div>

                  {/* BÖLÜM İLERLEME BARI (gradyan + shine) */}
                  <div className="svp-prog flex-1 min-w-[90px]" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.title} ilerleme`}>
                    <div className="svp-prog-fill" style={{ width: `${progressPct}%` }} />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openSendModal(s);
                      }}
                      title="Arkadaşına Tavsiye Et"
                      className="svp-act svp-act-send p-2.5 min-h-11 min-w-11 sm:p-2 sm:min-h-0 sm:min-w-0"
                    >
                      <Send size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditTarget(s);
                      }}
                      title="Düzenle"
                      className="svp-act p-2.5 min-h-11 min-w-11 sm:p-2 sm:min-h-0 sm:min-w-0"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(s);
                      }}
                      title="Sil"
                      className="svp-act svp-act-del p-2.5 min-h-11 min-w-11 sm:p-2 sm:min-h-0 sm:min-w-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="w-full basis-full border-t" style={{ borderColor: 'var(--line, rgba(244,244,242,.07))', background: 'rgba(0,0,0,.18)' }}>
                    {seasons.length === 0 ? (
                      <div className="p-4 text-sm text-center" style={{ color: 'var(--muted, #9a9a96)' }}>Henüz bölüm eklenmedi.</div>
                    ) : (
                      seasons.map((season) => {
                        const eps = s.episodes.filter((e) => e.season === season).sort((a, b) => a.episode - b.episode);
                        const seasonAllWatched = eps.length > 0 && eps.every((e) => e.watched);
                        return (
                          <div key={season} className="p-3 sm:p-4 border-b last:border-0" style={{ borderColor: 'var(--line, rgba(244,244,242,.07))' }}>
                            <div className="svp-season mb-2.5 flex items-center gap-2">
                              {season}. Sezon
                              {seasonAllWatched && (
                                <span className="svp-done-tag"><Check size={10} /> Tamamlandı</span>
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

      {/* ARKADAŞA TAVSİYE MODALI (TEKLİ & ÇOKLU DİZİ DESTEKLİ, GRID TASARIMLI) */}
      {showSendModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in-up" onClick={() => setShowSendModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl h-[85dvh] bg-ink-950 border border-violet-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-ink-800 bg-ink-900/50 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 shrink-0 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center border border-violet-500/30"><Send size={15} /></div>
                <h2 className="text-sm font-black text-white truncate">Arkadaşına Dizi Tavsiyesi Gönder</h2>
              </div>
              <button onClick={() => setShowSendModal(false)} className="text-ink-500 hover:text-white p-2.5 min-h-11 min-w-11 md:min-h-0 md:min-w-0 md:p-1 flex items-center justify-center rounded-lg shrink-0"><X size={17} /></button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              <div className="w-full md:w-64 p-4 border-b md:border-b-0 md:border-r border-ink-800 bg-ink-900/20 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-shrink-0">
                {loadingFriends ? (
                  <div className="text-center py-6 text-xs text-ink-500 animate-pulse">Arkadaşlar yükleniyor...</div>
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

            <div className="p-3.5 border-t border-ink-800 bg-ink-950 flex flex-wrap gap-2 shrink-0">
              <button onClick={() => setShowSendModal(false)} className="px-4 py-2.5 min-h-11 md:min-h-0 bg-ink-900 text-ink-300 rounded-xl text-xs font-bold hover:bg-ink-800 transition-colors">Vazgeç</button>
              <button 
                onClick={handleSendRecommendations} 
                disabled={!selectedFriendId || selectedSeriesIdsForSend.size === 0} 
                className="flex-1 min-w-[200px] py-2.5 min-h-11 md:min-h-0 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5 px-2 shadow-lg shadow-violet-500/20"
              >
                <Send size={14} /> Tavsiye Listesini Gönder ({selectedSeriesIdsForSend.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {showPick && (
        <PickModal
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
        className={`svp-ep min-h-11 md:min-h-0 ${
          episode.watched ? 'svp-ep-done' : canWatch ? 'svp-ep-ready' : 'svp-ep-lock'
        }`}
      >
        {episode.watched ? (
          <Check size={14} />
        ) : canWatch ? (
          <span>{episode.episode}</span>
        ) : (
          <Lock size={12} />
        )}
      </button>
      <div className={`text-[10px] text-center mt-0.5 ${episode.watched ? 'opacity-60' : ''}`} style={{ color: 'var(--muted, #9a9a96)' }}>
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
