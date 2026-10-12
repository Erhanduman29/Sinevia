import { useState, useMemo, useEffect } from 'react';
import {
  X, Send, Gift, Search, Filter, Check, Plus, Trash2, Film, Tv, Star,
  Boxes, ExternalLink, Eye, Play, Pause, Timer, Lock, Calendar, Clock,
  Zap, History, PlayCircle, MessageSquare, Sparkles, CheckSquare, Image as ImageIcon
} from 'lucide-react';
import { useApp, getMovieTimerInfo } from '../context/AppContext';
import { ratingBgClass, formatDateShort, uid } from '../lib/utils';
import { supabase } from '../lib/supabase';
import RatingModal from './RatingModal';
import MediaDetailModal from './MediaDetailModal';
import type { Movie } from '../types';

interface RecommendationModalsProps {
  myAgentId: string | null | undefined;
  friends: any[];
  profilesMap: Record<string, any>;
  showSendModal: boolean;
  setShowSendModal: (val: boolean) => void;
  viewingList: any | null;
  setViewingList: (val: any | null) => void;
  listToDelete: string | null;
  setListToDelete: (val: string | null) => void;
  onTriggerSync: () => void;
}

export default function RecommendationModals({
  myAgentId,
  friends,
  profilesMap,
  showSendModal,
  setShowSendModal,
  viewingList,
  setViewingList,
  listToDelete,
  setListToDelete,
  onTriggerSync,
}: RecommendationModalsProps) {
  const {
    data,
    addMovie,
    addSeries,
    addCollection,
    setMovieCollection,
    startWatchingMovie,
    togglePauseWatchingMovie,
    cancelWatchingMovie,
    canRateMovieWithTimer,
    watchMovie,
    unwatchMovie,
    showToast,
  } = useApp();

  // LİSTE GÖNDERME STATELERİ
  const [sendTargetId, setSendTargetId] = useState('');
  const [sendListTitle, setSendListTitle] = useState('');
  const [sendListNote, setSendListNote] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'top' | 'movie' | 'series'>('all');

  // LİSTE İNCELEME İÇİ FİLM SAYFASI KARTI STATELERİ
  const [selectedListItem, setSelectedListItem] = useState<any | null>(null);
  const [ratingTarget, setRatingTarget] = useState<Movie | null>(null);
  const [detailMovie, setDetailMovie] = useState<Movie | null>(null);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const activeTimerMovie = useMemo(
    () => data.movies.find((m: Movie) => !m.watched && m.startedAt) || null,
    [data.movies]
  );

  useEffect(() => {
    if (!activeTimerMovie) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimerMovie]);

  const plannedMovieIds = useMemo(() => {
    const ids = new Set<string>();
    (data.weeklyPlan || []).forEach((p: any) => ids.add(p.movieId));
    return ids;
  }, [data.weeklyPlan]);

  // KÜTÜPHANEDEKİ TÜM FİLM VE DİZİLER (PUAN HESAPLAMALI)
  const combinedLibrary = useMemo(() => {
    const moviesList = data.movies.map((m: Movie) => ({
      ...m,
      type: 'movie' as const,
      displayRating: m.watched && m.rating ? Number(m.rating) : null,
    }));
    const seriesList = data.series.map((s: any) => {
      const ratedEps = (s.episodes || []).filter((e: any) => e.watched && e.rating !== null);
      const avg =
        ratedEps.length > 0
          ? Number((ratedEps.reduce((a: number, b: any) => a + (b.rating || 0), 0) / ratedEps.length).toFixed(1))
          : null;
      return {
        ...s,
        type: 'series' as const,
        displayRating: avg,
      };
    });
    return [...moviesList, ...seriesList];
  }, [data.movies, data.series]);

  const filteredLibraryItems = useMemo(() => {
    return combinedLibrary
      .filter((item: any) => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesGenre = filterGenre ? (item.genres || []).includes(filterGenre) : true;
        const matchesQuick =
          quickFilter === 'all'
            ? true
            : quickFilter === 'top'
            ? (item.displayRating || 0) >= 8
            : item.type === quickFilter;
        return matchesSearch && matchesGenre && matchesQuick;
      })
      .sort((a: any, b: any) => {
        if (quickFilter === 'top') return (b.displayRating || 0) - (a.displayRating || 0);
        return a.title.localeCompare(b.title);
      });
  }, [combinedLibrary, searchQuery, filterGenre, quickFilter]);

  const handleAddSingleItem = (item: any) => {
    const title = item.title || item.item_title || '';
    const type = item.type || item.item_type || 'movie';
    const poster = item.poster || item.posterUrl || item.item_poster || null;
    const genres = item.genres || [];
    const year = item.year || '';
    const cleanTitle = title.replace(/\s\(S\d+\sB\d+\)$/i, '').trim();
    const success =
      type === 'series'
        ? addSeries(cleanTitle, genres, [1], poster)
        : addMovie(cleanTitle, year, genres, null, undefined, poster);
    if (success) showToast(`"${cleanTitle}" kütüphanene eklendi!`, 'success');
    return success;
  };

  // EKSİK OLANLARIN TÜMÜNÜ TEK TIKLA KÜTÜPHANEYE EKLE
  const handleAddAllMissingFromList = () => {
    if (!viewingList || !Array.isArray(viewingList.items)) return;
    let addedCount = 0;
    viewingList.items.forEach((item: any) => {
      const cleanTitle = (item.title || '').trim();
      if (!cleanTitle) return;
      const alreadyHas =
        data.movies.some((m: Movie) => m.title.toLowerCase() === cleanTitle.toLowerCase()) ||
        data.series.some((s: any) => s.title.toLowerCase() === cleanTitle.toLowerCase());
      if (!alreadyHas) {
        const ok =
          item.type === 'series'
            ? addSeries(cleanTitle, item.genres || [], [1], item.poster || null)
            : addMovie(cleanTitle, item.year || '', item.genres || [], null, undefined, item.poster || null);
        if (ok) addedCount++;
      }
    });
    if (addedCount > 0) {
      showToast(`${addedCount} yeni yapım kütüphanene eklendi!`, 'success');
    } else {
      showToast('Bu listedeki tüm yapımlar zaten kütüphanende mevcut!', 'info');
    }
  };

  // GELEN LİSTEYİ YENİ KOLEKSİYON OLARAK KAYDET
  const handleSaveListAsCollection = () => {
    if (!viewingList || !Array.isArray(viewingList.items)) return;
    const movieItems = viewingList.items.filter((x: any) => x.type !== 'series');
    if (movieItems.length === 0) {
      showToast('Koleksiyonlar sadece filmler için oluşturulabilir. Önce dizileri kütüphanene ekleyebilirsin.', 'warning');
      return;
    }

    const colName = viewingList.list_title || 'Arkadaş Tavsiyesi';
    const newColId = addCollection(colName);
    let assignedCount = 0;

    movieItems.forEach((item: any) => {
      const cleanTitle = (item.title || '').trim();
      const existingMovie = data.movies.find((m: Movie) => m.title.toLowerCase() === cleanTitle.toLowerCase());
      if (existingMovie) {
        setMovieCollection(existingMovie.id, newColId);
        assignedCount++;
      } else {
        addMovie(cleanTitle, item.year || '', item.genres || [], null, undefined, item.poster || null);
        assignedCount++;
      }
    });

    showToast(`"${colName}" koleksiyonu oluşturuldu ve ${assignedCount} film eklendi!`, 'success');
  };

  // LİSTE GÖNDERME İŞLEMİ
  const handleSendList = async () => {
    if (!myAgentId) return;
    if (!sendTargetId) {
      showToast('Lütfen arkadaş seç!', 'error');
      return;
    }
    if (!sendListTitle.trim()) {
      showToast('Listene bir isim ver!', 'error');
      return;
    }
    if (selectedItemIds.length === 0) {
      showToast('En az bir yapım seçmelisin!', 'error');
      return;
    }

    const cleanNote = sendListNote.trim();
    const itemsToSend = combinedLibrary
      .filter((x: any) => selectedItemIds.includes(x.id))
      .map((x: any, idx: number) => ({
        id: x.id,
        title: x.title,
        type: x.type,
        poster: x.posterUrl || null,
        genres: x.genres || [],
        year: x.year || '',
        senderRating: x.displayRating || null,
        ...(idx === 0 && cleanNote ? { listNote: cleanNote } : {}),
      }));

    try {
      await supabase.from('recommendations').insert([
        {
          id: uid(),
          sender_id: myAgentId,
          receiver_id: sendTargetId,
          list_title: sendListTitle.trim(),
          items: itemsToSend,
          status: 'pending',
        },
      ]);
      showToast('Özel tavsiye listesi gönderildi!', 'success');
      setShowSendModal(false);
      setSendListTitle('');
      setSendListNote('');
      setSelectedItemIds([]);
      setSendTargetId('');
      onTriggerSync();
    } catch {
      showToast('Liste gönderilirken hata oluştu!', 'error');
    }
  };

  const executeDeleteList = async () => {
    if (!listToDelete) return;
    try {
      await supabase.from('recommendations').delete().eq('id', listToDelete);
      if (viewingList?.id === listToDelete) setViewingList(null);
      showToast('Liste başarıyla silindi!', 'success');
      onTriggerSync();
    } catch {
      showToast('Liste silinirken hata oluştu.', 'error');
    }
    setListToDelete(null);
  };

  // FİLM VEYA DİZİ SAYFASINA NOKTA ATIŞI YÖNLENDİRME
  const handleNavigateToMediaPage = (item: any, addIfMissing = false) => {
    const cleanTitle = (item.title || '').replace(/\s\(S\d+\sB\d+\)$/i, '').trim();
    const alreadyInLib =
      data.movies.some((m: Movie) => m.title.toLowerCase() === cleanTitle.toLowerCase()) ||
      data.series.some((s: any) => s.title.toLowerCase() === cleanTitle.toLowerCase());

    if (!alreadyInLib && addIfMissing) {
      handleAddSingleItem(item);
    }

    try {
      sessionStorage.setItem('sinevia_focus_media_title', cleanTitle);
    } catch {}

    const targetTab = item.type === 'series' ? 'series' : 'movies';
    setSelectedListItem(null);
    setViewingList(null);
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: targetTab }));
  };

  const handleRequestRateFromCard = (movie: Movie) => {
    if (!movie.inPastQueue && !canRateMovieWithTimer(movie.id)) return;
    setRatingTarget(movie);
  };

  return (
    <>
      {/* ========================================================= */}
      {/* 1. LİSTE OLUŞTURMA VE GÖNDERME MODALI */}
      {/* ========================================================= */}
      {showSendModal && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in"
          onClick={() => setShowSendModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-5xl h-[88vh] bg-ink-950 border border-violet-500/35 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-4 sm:p-5 border-b border-ink-800 bg-gradient-to-r from-violet-950/40 via-ink-900 to-ink-950 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center border border-violet-500/30 shadow-lg">
                  <Send size={18} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white">Özel Tavsiye Koleksiyonu Gönder</h2>
                  <p className="text-[11px] text-ink-400">
                    Seçtiğin yapımlar senin verdiğin puanlar ve özel notunla birlikte arkadaşına iletilir.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-ink-400 hover:text-white p-2 rounded-xl bg-ink-900 hover:bg-ink-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              {/* SOL AYAR PANELİ */}
              <div className="w-full md:w-80 p-5 border-b md:border-b-0 md:border-r border-ink-800 bg-ink-900/25 flex flex-col gap-4 overflow-y-auto custom-scrollbar shrink-0">
                <div>
                  <label className="block text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1.5">
                    1. Kime Gidecek?
                  </label>
                  <select
                    value={sendTargetId}
                    onChange={e => setSendTargetId(e.target.value)}
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-violet-500 outline-none"
                  >
                    <option value="">-- Arkadaş Seç --</option>
                    {friends.map((f: any) => (
                      <option key={f.agent_id} value={f.agent_id}>
                        {f.nickname}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1.5">
                    2. Listenin Adı
                  </label>
                  <input
                    type="text"
                    value={sendListTitle}
                    onChange={e => setSendListTitle(e.target.value)}
                    placeholder="Örn: Beyin Yakan Bilim Kurgular"
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-violet-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-ink-400 uppercase tracking-widest mb-1.5">
                    3. Arkadaşına Notun (İsteğe Bağlı)
                  </label>
                  <textarea
                    rows={2}
                    value={sendListNote}
                    onChange={e => setSendListNote(e.target.value)}
                    placeholder="Örn: Özellikle 2. sıradaki filmi hafta sonu mutlaka izle!"
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-violet-500 outline-none resize-none"
                  />
                </div>

                <div className="pt-3 border-t border-ink-800 space-y-2.5">
                  <label className="block text-[10px] font-black text-ink-400 uppercase tracking-widest">
                    4. Kütüphaneni Filtrele
                  </label>
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
                    <input
                      type="text"
                      placeholder="İsimle Ara..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-ink-950 border border-ink-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:border-violet-500 outline-none"
                    />
                  </div>
                  <div className="relative">
                    <Filter size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
                    <select
                      value={filterGenre}
                      onChange={e => setFilterGenre(e.target.value)}
                      className="w-full bg-ink-950 border border-ink-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:border-violet-500 outline-none appearance-none"
                    >
                      <option value="">Tüm Türler</option>
                      {data.genres.map((g: string) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SAĞ SEÇİM IZGARASI */}
              <div className="flex-1 flex flex-col overflow-hidden bg-ink-950 relative">
                <div className="p-3.5 border-b border-ink-800 flex flex-wrap items-center justify-between gap-2 bg-ink-900/40">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: 'all', label: 'Tümü' },
                      { id: 'top', label: '★ 8+ Favorilerim' },
                      { id: 'movie', label: 'Filmler' },
                      { id: 'series', label: 'Diziler' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setQuickFilter(tab.id as 'all' | 'top' | 'movie' | 'series')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          quickFilter === tab.id
                            ? 'bg-violet-600 text-white shadow'
                            : 'bg-ink-900 text-ink-400 hover:text-white border border-ink-800'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-violet-300 font-black bg-violet-500/15 px-3 py-1 rounded-xl border border-violet-500/30">
                    {selectedItemIds.length} Yapım Seçildi
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
                  {filteredLibraryItems.length === 0 ? (
                    <div className="text-center py-12 text-ink-600 text-sm italic border border-ink-800 border-dashed rounded-2xl">
                      Sonuç bulunamadı.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3.5">
                      {filteredLibraryItems.map((item: any) => {
                        const isSelected = selectedItemIds.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() =>
                              setSelectedItemIds((prev: string[]) =>
                                isSelected ? prev.filter((id: string) => id !== item.id) : [...prev, item.id]
                              )
                            }
                            className={`relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer group border-2 transition-all ${
                              isSelected
                                ? 'border-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.4)] scale-95'
                                : 'border-transparent hover:border-ink-600 bg-ink-900'
                            }`}
                          >
                            {item.posterUrl ? (
                              <img src={item.posterUrl} alt="poster" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-ink-700">
                                {item.type === 'series' ? <Tv size={32} /> : <Film size={32} />}
                              </div>
                            )}

                            {item.displayRating && (
                              <div className="absolute top-1.5 right-1.5 bg-black/85 text-gold-400 text-[10px] font-black px-1.5 py-0.5 rounded border border-gold-500/30 flex items-center gap-0.5">
                                <Star size={9} className="fill-gold-400" /> {item.displayRating}
                              </div>
                            )}

                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/85 to-transparent p-2.5 pt-8">
                              <h3 className="text-[10px] sm:text-[11px] font-bold text-white line-clamp-2 leading-tight">
                                {item.title}
                              </h3>
                            </div>

                            <div
                              className={`absolute inset-0 bg-violet-500/25 backdrop-blur-[1px] flex items-center justify-center transition-opacity ${
                                isSelected ? 'opacity-100' : 'opacity-0'
                              }`}
                            >
                              <div className="w-10 h-10 rounded-full bg-violet-500 text-white flex items-center justify-center shadow-xl">
                                <Check size={20} strokeWidth={4} />
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

            <div className="p-4 border-t border-ink-800 bg-ink-950 flex gap-3 shrink-0">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-6 py-3.5 bg-ink-900 text-ink-300 rounded-xl text-sm font-bold hover:bg-ink-800 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSendList}
                className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 uppercase tracking-wider shadow-lg shadow-violet-500/20"
              >
                <Send size={18} /> Koleksiyonu Gönder ({selectedItemIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. GELEN / GÖNDERİLEN LİSTEYİ İNCELEME MODALI */}
      {/* ========================================================= */}
      {viewingList && (() => {
        const listItems: any[] = Array.isArray(viewingList.items) ? viewingList.items : [];
        const listNote = listItems[0]?.listNote || null;
        const senderNick = profilesMap[viewingList.sender_id]?.nickname || 'Bilinmeyen Ajan';

        const ownedCount = listItems.filter((item: any) => {
          const t = (item.title || '').toLowerCase();
          return (
            data.movies.some((m: Movie) => m.title.toLowerCase() === t) ||
            data.series.some((s: any) => s.title.toLowerCase() === t)
          );
        }).length;
        const missingCount = listItems.length - ownedCount;

        return (
          <div
            className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in"
            onClick={() => setViewingList(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="w-full max-w-5xl bg-ink-950 border border-violet-500/35 rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl"
            >
              {/* ÜST BİLGİ VE TOPLU AKSİYON BARI */}
              <div className="p-5 sm:p-6 border-b border-ink-800 bg-gradient-to-r from-violet-950/35 via-ink-900/60 to-ink-950 relative shrink-0">
                <button
                  onClick={() => setViewingList(null)}
                  className="absolute top-5 right-5 text-ink-400 hover:text-white bg-ink-900 hover:bg-ink-800 p-2 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>

                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pr-10">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-black text-violet-300 bg-violet-500/20 border border-violet-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                        <Gift size={12} /> Özel Tavsiye Koleksiyonu
                      </span>
                      <span className="text-xs font-mono text-ink-400 bg-ink-900 px-2.5 py-0.5 rounded-lg border border-ink-800">
                        {ownedCount}/{listItems.length} Kütüphanende Mevcut
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                      {viewingList.list_title}
                    </h2>
                    <div className="text-xs sm:text-sm text-ink-400 mt-1">
                      Gönderen: <span className="text-violet-400 font-black">{senderNick}</span> • Afişlere tıklayarak Film Kartını ve Sayacı açabilirsin!
                    </div>

                    {listNote && (
                      <div className="mt-3 bg-ink-900/80 border border-violet-500/30 rounded-2xl p-3 max-w-2xl flex items-start gap-2.5">
                        <MessageSquare size={15} className="text-violet-400 shrink-0 mt-0.5" />
                        <p className="text-xs sm:text-sm text-ink-200 italic">"{listNote}"</p>
                      </div>
                    )}
                  </div>

                  {/* TOPLU İŞLEM BUTONLARI */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {missingCount > 0 && (
                      <button
                        onClick={handleAddAllMissingFromList}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
                      >
                        <CheckSquare size={15} /> Eksik Olanları Ekle (+{missingCount})
                      </button>
                    )}
                    <button
                      onClick={handleSaveListAsCollection}
                      className="bg-gold-500/15 hover:bg-gold-500/25 text-gold-300 border border-gold-500/35 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                      title="Bu listedeki filmleri kendi Koleksiyonlarına yeni bir koleksiyon olarak kaydet"
                    >
                      <Boxes size={15} /> Koleksiyon Olarak Kaydet
                    </button>
                  </div>
                </div>
              </div>

              {/* LİSTE İÇERİĞİ (TIKLANABİLİR KARTLAR) */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar bg-ink-950">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {listItems.map((item: any, idx: number) => {
                    const alreadyHas =
                      data.movies.some((m: Movie) => m.title.toLowerCase() === (item.title || '').toLowerCase()) ||
                      data.series.some((s: any) => s.title.toLowerCase() === (item.title || '').toLowerCase());

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedListItem(item)}
                        className="relative aspect-[2/3] rounded-2xl overflow-hidden group border border-ink-800 hover:border-gold-500/50 bg-ink-900 shadow-md cursor-pointer transition-all hover:-translate-y-1"
                      >
                        {item.poster ? (
                          <img
                            src={item.poster}
                            alt={item.title}
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-ink-700">
                            {item.type === 'series' ? <Tv size={32} /> : <Film size={32} />}
                          </div>
                        )}

                        {item.senderRating && (
                          <div className="absolute top-2.5 left-2.5 bg-black/85 backdrop-blur-md text-gold-400 text-[10px] font-black px-2 py-0.5 rounded-lg border border-gold-500/30 flex items-center gap-1 shadow">
                            <Star size={10} className="fill-gold-400" /> {item.senderRating}
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                          <Eye size={22} className="text-gold-400 mb-1" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-white">
                            Film Kartını Aç
                          </span>
                        </div>

                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/85 to-transparent p-3 pt-10">
                          <h4 className="text-[11px] sm:text-xs font-bold text-white line-clamp-2 leading-tight mb-1 drop-shadow-md">
                            {item.title}
                          </h4>
                          <div className="text-[9px] text-ink-400 uppercase tracking-widest">
                            {item.type === 'series' ? 'Dizi' : 'Film'} {item.year ? `• ${item.year}` : ''}
                          </div>
                        </div>

                        <div className="absolute top-2.5 right-2.5 z-10">
                          {alreadyHas ? (
                            <div
                              className="bg-emerald-500/90 text-white p-1.5 rounded-lg shadow-md backdrop-blur-sm"
                              title="Kütüphanende Mevcut"
                            >
                              <Check size={14} strokeWidth={3} />
                            </div>
                          ) : (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleAddSingleItem(item);
                              }}
                              className="bg-violet-600 hover:bg-violet-500 text-white p-1.5 rounded-lg shadow-xl backdrop-blur-sm transition-all hover:scale-110"
                              title="Kütüphaneme Ekle"
                            >
                              <Plus size={14} strokeWidth={3} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-ink-800 bg-ink-950 flex gap-3 shrink-0">
                <button
                  onClick={() => setListToDelete(viewingList.id)}
                  className="px-5 sm:px-6 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-sm font-bold transition-colors tracking-widest uppercase flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} /> <span className="hidden sm:inline">Listeyi Sil</span>
                </button>
                <button
                  onClick={() => setViewingList(null)}
                  className="flex-1 py-3.5 bg-ink-900 hover:bg-ink-800 text-white rounded-xl text-sm font-bold transition-colors tracking-widest uppercase"
                >
                  Pencereyi Kapat
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* 3. LİSTEDEKİ AFİŞE TIKLAYINCA AÇILAN FİLM SAYFASI KARTI */}
      {/* ========================================================= */}
      {selectedListItem && (() => {
        const cleanTitle = (selectedListItem.title || '').replace(/\s\(S\d+\sB\d+\)$/i, '').trim();
        const myMovie = data.movies.find((m: Movie) => m.title.toLowerCase() === cleanTitle.toLowerCase());
        const mySeriesItem = data.series.find((s: any) => s.title.toLowerCase() === cleanTitle.toLowerCase());

        const displayTitle = myMovie?.title || cleanTitle;
        const displayPoster = myMovie?.posterUrl || selectedListItem.poster || null;
        const displayYear = myMovie?.year || selectedListItem.year || '';
        const displayRuntime = myMovie?.runtime || null;
        const displayGenres = myMovie?.genres?.length ? myMovie.genres : (selectedListItem.genres || []);
        const collectionName = myMovie?.collectionId
          ? data.collections.find((c: any) => c.id === myMovie.collectionId)?.name
          : undefined;

        const watchLinks: { href: string; text: string; logo: string | null; icon: any }[] = [];
        if (myMovie?.customUrl) {
          watchLinks.push({ href: myMovie.customUrl, text: 'Özel Kaynak', logo: null, icon: ExternalLink });
        }
        const searchQueryUrl = encodeURIComponent(`${displayTitle} ${displayYear} izle`);
        watchLinks.push({ href: `https://www.google.com/search?q=${searchQueryUrl}`, text: "Google'da Bul", logo: null, icon: Search });

        if (data.altWatchTemplate && (myMovie?.imdbId || data.altWatchTemplate.includes('{slug}') || data.altWatchTemplate.includes('{title}'))) {
          const charMap: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
          const slug = displayTitle
            .toLocaleLowerCase('tr-TR')
            .replace(/[çğıöşü]/g, (match: string) => charMap[match])
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
          const finalAltHref = data.altWatchTemplate
            .replace('{imdb}', myMovie?.imdbId || '')
            .replace('{slug}', slug)
            .replace('{title}', encodeURIComponent(displayTitle))
            .replace('{year}', displayYear);
          watchLinks.push({ href: finalAltHref, text: 'Alternatif', logo: null, icon: PlayCircle });
        }

        const timerInfo = myMovie && !myMovie.watched && myMovie.startedAt ? getMovieTimerInfo(myMovie, nowMs) : null;
        const anotherTimerActive = Boolean(activeTimerMovie && myMovie && activeTimerMovie.id !== myMovie.id);
        const isPlanned = Boolean(myMovie && plannedMovieIds.has(myMovie.id));

        return (
          <div
            className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
            onClick={() => setSelectedListItem(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="w-full max-w-3xl bg-ink-950 border border-gold-500/35 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 relative"
            >
              <div className="flex items-center justify-between border-b border-ink-800/80 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-gold-500/15 text-gold-300 border border-gold-500/30 flex items-center gap-1.5">
                    <Sparkles size={12} /> Tavsiye Film Kartı
                  </span>
                  {selectedListItem.senderRating && (
                    <span className="text-xs font-black text-violet-300 bg-violet-500/15 px-2.5 py-1 rounded-lg border border-violet-500/30 flex items-center gap-1">
                      <Star size={11} className="fill-violet-400 text-violet-400" />
                      Tavsiye Edenin Puanı: {selectedListItem.senderRating}/10
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedListItem(null)}
                  className="w-8 h-8 rounded-full bg-ink-900 hover:bg-ink-800 text-ink-300 hover:text-white flex items-center justify-center border border-ink-700"
                >
                  <X size={16} />
                </button>
              </div>

              {/* MOVIEROW KARTI */}
              <div className="bg-ink-900/60 border border-ink-800/80 rounded-2xl p-3 sm:p-4 hover:border-gold-500/40 transition-all flex flex-col md:flex-row gap-3.5 md:gap-4 md:items-center shadow-lg">
                <div className="flex gap-3.5 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (myMovie) setDetailMovie(myMovie);
                    }}
                    className="w-16 sm:w-20 flex-shrink-0 aspect-[2/3] bg-ink-900 rounded-xl overflow-hidden flex items-center justify-center border border-ink-700/60 shadow-md relative group/poster cursor-pointer"
                  >
                    {displayPoster ? (
                      <img src={displayPoster} alt={displayTitle} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={20} className="text-ink-600" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`font-bold text-sm sm:text-base truncate ${myMovie?.watched ? 'text-ink-500 line-through' : 'text-ink-100'}`}>
                        {displayTitle}
                      </span>
                      {myMovie?.watched && myMovie.isPastWatch && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded">
                          <History size={9} /> Önceden
                        </span>
                      )}
                      {collectionName && (
                        <span className="text-[9px] text-gold-400 bg-gold-500/10 border border-gold-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 truncate">
                          <Boxes size={9} /> {collectionName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-ink-400 mb-2">
                      {displayYear && (
                        <span className="flex items-center gap-1">
                          <Calendar size={11} /> {displayYear}
                        </span>
                      )}
                      {displayRuntime && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {displayRuntime} dk
                        </span>
                      )}
                      {myMovie?.watched && !myMovie.isPastWatch && myMovie.actualRuntime && myMovie.runtime && myMovie.actualRuntime < myMovie.runtime && (
                        <span className="flex items-center gap-0.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1 rounded font-bold text-[9px]">
                          <Zap size={9} /> {myMovie.actualRuntime} dk
                        </span>
                      )}
                      {displayGenres.length > 0 && <span className="truncate">{displayGenres.join(', ')}</span>}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap mt-auto">
                      {myMovie?.watched && myMovie.rating !== null && (
                        <div className="flex items-center gap-1 mr-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ratingBgClass(myMovie.rating)}`}>
                            Senin Puanın: {myMovie.rating}
                          </span>
                          {!myMovie.isPastWatch && myMovie.watchedAt && (
                            <span className="text-[10px] text-ink-500 hidden sm:inline">
                              {formatDateShort(myMovie.watchedAt)}
                            </span>
                          )}
                        </div>
                      )}

                      {watchLinks.map((link, idx) => {
                        const Icon = link.icon;
                        return (
                          <a
                            key={idx}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-ink-800/60 hover:bg-gold-900/40 text-gold-400/90 hover:text-gold-300 border border-gold-500/20 px-2 py-0.5 rounded text-[10px] font-semibold transition-all"
                          >
                            <Icon size={10} />
                            <span>{link.text}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* SAĞ BUTONLAR (BAŞLAT / SAYAÇ / PUANLA / EKLE) */}
                <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto bg-ink-950/50 md:bg-transparent p-2.5 md:p-0 rounded-xl border border-ink-800/50 md:border-0 flex-shrink-0">
                  {selectedListItem.type !== 'series' ? (
                    myMovie ? (
                      <div className="flex items-center gap-1.5 w-full md:w-auto">
                        {myMovie.watched ? (
                          <button
                            onClick={() => unwatchMovie(myMovie.id)}
                            className="text-xs text-ink-300 hover:text-white bg-ink-800 hover:bg-ink-700 px-3.5 py-2 rounded-xl border border-ink-700 font-bold w-full md:w-auto"
                          >
                            Geri Al
                          </button>
                        ) : isPlanned ? (
                          <div className="flex items-center justify-center gap-1 text-xs px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 font-bold">
                            <Lock size={12} /> Takvimde Planlı
                          </div>
                        ) : (
                          <>
                            {timerInfo ? (
                              <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold">
                                <Timer size={13} className={timerInfo.isPaused ? 'text-amber-400' : 'animate-pulse text-emerald-400'} />
                                <span className="font-mono">{timerInfo.formattedRemaining}</span>
                                <button type="button" onClick={() => togglePauseWatchingMovie(myMovie.id)} className="ml-1 text-amber-300 hover:text-white">
                                  {timerInfo.isPaused ? <Play size={12} className="fill-current" /> : <Pause size={12} />}
                                </button>
                                <button type="button" onClick={() => cancelWatchingMovie(myMovie.id)} className="ml-0.5 text-ink-400 hover:text-red-400">
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startWatchingMovie(myMovie.id, false)}
                                disabled={anotherTimerActive}
                                className={`flex items-center justify-center gap-1.5 text-xs px-3.5 py-2 rounded-xl font-bold border ${
                                  anotherTimerActive
                                    ? 'bg-ink-900/50 text-ink-600 border-ink-800 cursor-not-allowed'
                                    : 'bg-ink-800 hover:bg-emerald-900/40 text-emerald-400 border-emerald-500/40'
                                }`}
                              >
                                {anotherTimerActive ? <Lock size={11} /> : <Play size={11} className="fill-current" />} Başlat
                              </button>
                            )}

                            <button
                              onClick={() => handleRequestRateFromCard(myMovie)}
                              disabled={Boolean(timerInfo && !timerInfo.canRateWithTimer)}
                              className={`flex items-center justify-center gap-1.5 text-xs px-3.5 py-2 rounded-xl font-bold ${
                                timerInfo && !timerInfo.canRateWithTimer
                                  ? 'bg-ink-800/50 text-ink-600 border border-ink-800 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-ink-950 shadow-md'
                              }`}
                            >
                              {timerInfo && !timerInfo.canRateWithTimer ? (
                                <>
                                  <Lock size={11} /> {timerInfo.minRequiredMins - timerInfo.elapsedMins} dk
                                </>
                              ) : (
                                <>
                                  <Star size={12} className="fill-current" /> Puanla
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddSingleItem(selectedListItem)}
                        className="w-full md:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg"
                      >
                        <Plus size={14} strokeWidth={3} /> Kütüphaneme Ekle (Sayaç & Puanla)
                      </button>
                    )
                  ) : (
                    !mySeriesItem && (
                      <button
                        onClick={() => handleAddSingleItem(selectedListItem)}
                        className="w-full md:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg"
                      >
                        <Plus size={14} strokeWidth={3} /> Diziyi Kütüphaneme Ekle
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                {myMovie && (
                  <button
                    type="button"
                    onClick={() => setDetailMovie(myMovie)}
                    className="px-4 py-3 rounded-xl bg-ink-900 hover:bg-ink-800 border border-ink-700 text-gold-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Eye size={15} /> Sinema Künyesini Gör
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleNavigateToMediaPage(selectedListItem, true)}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 text-ink-950 text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-gold-500/20 transition-all"
                >
                  <ExternalLink size={16} />
                  {myMovie || mySeriesItem
                    ? selectedListItem.type === 'series'
                      ? 'Dizi Sayfasında Bu Diziye Git'
                      : 'Film Sayfasında Bu Filme Git'
                    : `Kütüphaneme Ekle & ${selectedListItem.type === 'series' ? 'Dizi' : 'Film'} Sayfasında Git`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* 4. LİSTE SİLME ONAY MODALI */}
      {/* ========================================================= */}
      {listToDelete && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setListToDelete(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-ink-950 border border-ink-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-black text-white mb-2">Listeyi Sil</h3>
            <p className="text-sm text-ink-300 mb-6">
              Bu listeyi kalıcı olarak silmek istediğine emin misin? Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setListToDelete(null)}
                className="flex-1 py-3 rounded-xl bg-ink-900 hover:bg-ink-800 text-white font-bold transition-colors"
              >
                İptal
              </button>
              <button
                onClick={executeDeleteList}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-lg shadow-red-500/20"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PUANLAMA VE DETAY MODALLARI */}
      {ratingTarget && (
        <RatingModal
          title={ratingTarget.title}
          subtitle={ratingTarget.year ? `Çıkış Yılı: ${ratingTarget.year}` : 'Film'}
          initialIsPastWatch={Boolean(ratingTarget.isPastWatch || ratingTarget.inPastQueue)}
          onRate={(rating, note, detailedRating, reviewTags, isPastWatch) => {
            watchMovie(ratingTarget.id, rating, note, detailedRating, reviewTags, isPastWatch);
            setRatingTarget(null);
          }}
          onClose={() => setRatingTarget(null)}
        />
      )}

      {detailMovie && (
        <MediaDetailModal target={{ type: 'movie', data: detailMovie }} onClose={() => setDetailMovie(null)} />
      )}
    </>
  );
}