import { useState, useMemo, useEffect } from 'react';
import { X, Send, Search, Filter, Check, Film, Tv, Star } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { uid } from '../lib/utils';
import { supabase } from '../lib/supabase';
import type { Movie } from '../types';
import { handleImgFallback } from '../lib/selectors';

/**
 * ARKADAŞA TAVSİYE GÖNDERME MODALI — TEK KAYNAK.
 * Filmler/Diziler sayfaları ve Ağ sayfası (RecommendationModals) bu bileşeni paylaşır.
 * Mor (violet) premium tasarım; 4 adımlı akış: Kime → Başlık → Not → Filtre + Seçim ızgarası.
 */
interface SendRecommendationModalProps {
  open: boolean;
  onClose: () => void;
  /** Dışarıdan hazır arkadaş listesi (Ağ sayfası). Verilmezse bileşen kendisi çeker. */
  friends?: any[];
  /** Kütüphanede hangi tip yapımlar seçilebilir. Varsayılan 'all'. */
  mode?: 'all' | 'movie' | 'series';
  /** Açılışta liste başlığı ön doldurması (örn. tek film paylaşımı). */
  initialTitle?: string;
  /** Açılışta seçili gelecek yapımların id'leri (örn. tek film paylaşımı). */
  initialSelectedIds?: string[];
  /** Gönderim sonrası (Ağ sayfası senkron tetikler). */
  onSent?: () => void;
}

export default function SendRecommendationModal({
  open,
  onClose,
  friends,
  mode = 'all',
  initialTitle,
  initialSelectedIds,
  onSent,
}: SendRecommendationModalProps) {
  const { data, showToast } = useApp();

  const [sendTargetId, setSendTargetId] = useState('');
  const [sendListTitle, setSendListTitle] = useState('');
  const [sendListNote, setSendListNote] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'top' | 'movie' | 'series'>(
    mode === 'movie' ? 'movie' : mode === 'series' ? 'series' : 'all'
  );

  // DIŞARIDAN ARKADAŞ LİSTESİ VERİLMEZSE KENDİ ÇEKER
  const [fetchedFriends, setFetchedFriends] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const effectiveFriends = friends ?? fetchedFriends;

  const agentId = data.agentId ?? null;

  // AÇILIŞTA STATE SIFIRLA + ÖN DOLDUR + (GEREKİRSE) ARKADAŞLARI ÇEK
  useEffect(() => {
    if (!open) return;
    setSendTargetId('');
    setSendListTitle(initialTitle || '');
    setSendListNote('');
    setSelectedItemIds(initialSelectedIds ? [...initialSelectedIds] : []);
    setSearchQuery('');
    setFilterGenre('');
    setQuickFilter(mode === 'movie' ? 'movie' : mode === 'series' ? 'series' : 'all');

    if (!friends && agentId) {
      setLoadingFriends(true);
      (async () => {
        try {
          const { data: fData } = await supabase
            .from('friendships')
            .select('*')
            .or(`requester_id.eq.${agentId},receiver_id.eq.${agentId}`)
            .eq('status', 'accepted');
          const friendIds = (fData || []).map((f: any) =>
            f.requester_id === agentId ? f.receiver_id : f.requester_id
          );
          if (friendIds.length > 0) {
            const { data: pData } = await supabase.from('profiles').select('*').in('agent_id', friendIds);
            setFetchedFriends(pData || []);
            if (pData && pData.length > 0) setSendTargetId(pData[0].agent_id);
          } else {
            setFetchedFriends([]);
          }
        } catch (err) {
          console.error(err);
          showToast('Arkadaş listesi alınamadı.', 'error');
        } finally {
          setLoadingFriends(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
      return { ...s, type: 'series' as const, displayRating: avg };
    });
    return mode === 'movie' ? moviesList : mode === 'series' ? seriesList : [...moviesList, ...seriesList];
  }, [data.movies, data.series, mode]);

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

  const handleSendList = async () => {
    if (!agentId) return;
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
          sender_id: agentId,
          receiver_id: sendTargetId,
          list_title: sendListTitle.trim(),
          items: itemsToSend,
          status: 'pending',
        },
      ]);
      showToast('Özel tavsiye listesi gönderildi!', 'success');
      onClose();
      onSent?.();
    } catch {
      showToast('Liste gönderilirken hata oluştu!', 'error');
    }
  };

  if (!open) return null;

  const quickTabs: { id: 'all' | 'top' | 'movie' | 'series'; label: string }[] = [
    { id: 'all', label: 'Tümü' },
    { id: 'top', label: '★ 8+ Favorilerim' },
    ...(mode === 'all'
      ? ([
          { id: 'movie', label: 'Filmler' },
          { id: 'series', label: 'Diziler' },
        ] as { id: 'movie' | 'series'; label: string }[])
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5 sm:pt-[max(1.25rem,env(safe-area-inset-top))] sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-5xl h-[88dvh] max-h-full bg-ink-950 border border-violet-500/35 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
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
            onClick={onClose}
            className="text-ink-400 hover:text-white p-2 rounded-xl bg-ink-900 hover:bg-ink-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* SOL AYAR PANELİ */}
          <div className="w-full md:w-80 p-5 border-b md:border-b-0 md:border-r border-ink-800 bg-ink-900/25 flex flex-col gap-4 overflow-y-auto custom-scrollbar shrink-0 max-h-[45%] md:max-h-none">
            <div>
              <label className="block text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1.5">
                1. Kime Gidecek?
              </label>
              {loadingFriends ? (
                <div className="text-center py-4 text-xs text-ink-500 animate-pulse">Arkadaşlar yükleniyor...</div>
              ) : effectiveFriends.length === 0 ? (
                <div className="text-center py-4 text-xs text-ink-500 border border-ink-800 border-dashed rounded-xl">
                  Ağında ekli arkadaşın bulunamadı.
                </div>
              ) : (
                <select
                  value={sendTargetId}
                  onChange={e => setSendTargetId(e.target.value)}
                  className="w-full bg-ink-900 border border-ink-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-violet-500 outline-none"
                >
                  <option value="">-- Arkadaş Seç --</option>
                  {effectiveFriends.map((f: any) => (
                    <option key={f.agent_id} value={f.agent_id}>
                      {f.nickname}
                    </option>
                  ))}
                </select>
              )}
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
                {quickTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setQuickFilter(tab.id)}
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
                          <img loading="lazy" decoding="async" src={item.posterUrl} alt="poster" className="w-full h-full object-cover" onError={handleImgFallback}/>
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
            onClick={onClose}
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
  );
}
