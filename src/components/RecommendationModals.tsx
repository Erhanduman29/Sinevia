import { useState } from 'react';
import {
  X, Gift, Check, Plus, Trash2, Film, Tv, Star,
  Boxes, Eye, MessageSquare, CheckSquare,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import SendRecommendationModal from './SendRecommendationModal';
import MediaDetailModal from './MediaDetailModal';
import type { DetailModalTarget } from './MediaDetailModal';
import ConfirmDialog from './ConfirmDialog';
import type { Movie } from '../types';
import { handleImgFallback } from '../lib/selectors';

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

/**
 * AĞ SAYFASI MODALLARI:
 * 1) Tavsiye gönderme → SendRecommendationModal (TEK KAYNAK, Filmler/Diziler sayfalarıyla ortak)
 * 2) Gelen/gönderilen listeyi inceleme (poster ızgarası; afiş tıklaması doğrudan MediaDetailModal'ı açar)
 * 3) Liste silme onayı → ConfirmDialog (ortak tasarım)
 */
export default function RecommendationModals({
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
    showToast,
  } = useApp();

  // AFİŞE TIKLAYINCA AÇILAN ORTAK DETAY PENCERESİ (gönderen puanı rozetiyle)
  const [detailTarget, setDetailTarget] = useState<DetailModalTarget | null>(null);
  const [detailSenderRating, setDetailSenderRating] = useState<number | null>(null);

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

  // AFİŞE TIKLAYINCA: KÜTÜPHANEDEYSE KÜNYE (MediaDetailModal), DEĞİLSE KÜTÜPHANEYE EKLE
  const handlePosterClick = (item: any) => {
    const cleanTitle = (item.title || '').replace(/\s\(S\d+\sB\d+\)$/i, '').trim();
    const myMovie = data.movies.find((m: Movie) => m.title.toLowerCase() === cleanTitle.toLowerCase());
    const mySeriesItem = data.series.find((s: any) => s.title.toLowerCase() === cleanTitle.toLowerCase());
    if (myMovie) {
      setDetailSenderRating(item.senderRating || null);
      setDetailTarget({ type: 'movie', data: myMovie });
    } else if (mySeriesItem) {
      setDetailSenderRating(item.senderRating || null);
      setDetailTarget({ type: 'series', data: mySeriesItem });
    } else {
      handleAddSingleItem(item);
    }
  };

  return (
    <>
      {/* ========================================================= */}
      {/* 1. LİSTE GÖNDERME MODALI (ORTAK BİLEŞEN — TEK KAYNAK) */}
      {/* ========================================================= */}
      <SendRecommendationModal
        open={showSendModal}
        onClose={() => setShowSendModal(false)}
        friends={friends}
        onSent={onTriggerSync}
      />

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
            className="fixed inset-0 z-[130] flex items-center justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5 sm:pt-[max(1.25rem,env(safe-area-inset-top))] sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-black/85 backdrop-blur-md animate-fade-in"
            onClick={() => setViewingList(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="w-full max-w-5xl bg-ink-950 border border-violet-500/35 rounded-3xl overflow-hidden flex flex-col max-h-[min(90dvh,100%)] shadow-2xl"
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
                      <span className="text-xs font-semibold text-ink-400 bg-ink-900 px-2.5 py-0.5 rounded-lg border border-ink-800 tabular-nums">
                        {ownedCount}/{listItems.length} Kütüphanende Mevcut
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                      {viewingList.list_title}
                    </h2>
                    <div className="text-xs sm:text-sm text-ink-400 mt-1">
                      Gönderen: <span className="text-violet-400 font-black">{senderNick}</span> • Afişlere tıklayarak künyeyi açabilir, kütüphanende olmayanları ekleyebilirsin!
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
                        onClick={() => handlePosterClick(item)}
                        className="relative aspect-[2/3] rounded-2xl overflow-hidden group border border-ink-800 hover:border-gold-500/50 bg-ink-900 shadow-md cursor-pointer transition-all hover:-translate-y-1"
                      >
                        {item.poster ? (
                          <img loading="lazy" decoding="async"
                            src={item.poster}
                            alt={item.title}
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                           onError={handleImgFallback}/>
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
                          {alreadyHas ? (
                            <>
                              <Eye size={22} className="text-gold-400 mb-1" />
                              <span className="text-[10px] font-black uppercase tracking-wider text-white">
                                Künye
                              </span>
                            </>
                          ) : (
                            <>
                              <Plus size={22} className="text-violet-300 mb-1" />
                              <span className="text-[10px] font-black uppercase tracking-wider text-white">
                                Kütüphaneme Ekle
                              </span>
                            </>
                          )}
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
      {/* 3. LİSTE SİLME ONAYI (ORTAK CONFIRMDIALOG — YEREL METİNLE) */}
      {/* ========================================================= */}
      {listToDelete && (
        <ConfirmDialog
          title="Tavsiye Listesini Sil"
          message="Bu tavsiye listesini kalıcı olarak silmek istediğine emin misin? Bu işlem geri alınamaz."
          confirmLabel="Evet, Sil"
          cancelLabel="Vazgeç"
          onConfirm={executeDeleteList}
          onCancel={() => setListToDelete(null)}
        />
      )}

      {/* DETAY PENCERESİ (TAVSİYE EDENİN PUANI ROZETİYLE) */}
      {detailTarget && (
        <MediaDetailModal
          target={detailTarget}
          senderRating={detailSenderRating}
          onClose={() => {
            setDetailTarget(null);
            setDetailSenderRating(null);
          }}
        />
      )}
    </>
  );
}
