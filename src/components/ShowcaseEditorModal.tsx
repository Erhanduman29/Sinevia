import { useState, useMemo, useEffect } from 'react';
import { X, Crown, Search, Star, Film, Tv, Check, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import type { ShowcaseItem } from '../context/AppContext';

interface ShowcaseEditorModalProps {
  isOpen: boolean;
  initialShowcase: ShowcaseItem[];
  movies: any[];
  series: any[];
  onSave: (newShowcase: ShowcaseItem[]) => void;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function ShowcaseEditorModal({
  isOpen,
  initialShowcase,
  movies,
  series,
  onSave,
  onClose,
  showToast,
}: ShowcaseEditorModalProps) {
  const [draft, setDraft] = useState<ShowcaseItem[]>(initialShowcase || []);
  const [search, setSearch] = useState('');
  const [minRatingFilter, setMinRatingFilter] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setDraft(initialShowcase || []);
      setSearch('');
      setMinRatingFilter(0);
    }
  }, [isOpen, initialShowcase]);

  // SADECE İZLENMİŞ VE PUANLANMIŞ YAPIMLARI FİLTRELE VE PUANA GÖRE SIRALA
  const eligibleItems = useMemo(() => {
    const ratedMovies = movies
      .filter(m => m.watched && m.rating !== null && m.rating !== undefined && Number(m.rating) > 0)
      .map(m => ({
        id: m.id,
        title: m.title,
        type: 'movie' as const,
        posterUrl: m.posterUrl || m.poster || null,
        year: m.year || '',
        rating: Number(m.rating),
        genres: m.genres || [],
      }));

    const ratedSeries = series
      .map(s => {
        const watchedAndRatedEps = (s.episodes || []).filter(
          (e: any) => e.watched && e.rating !== null && e.rating !== undefined && Number(e.rating) > 0
        );
        const avgRating =
          watchedAndRatedEps.length > 0
            ? Number(
                (
                  watchedAndRatedEps.reduce((acc: number, curr: any) => acc + Number(curr.rating), 0) /
                  watchedAndRatedEps.length
                ).toFixed(1)
              )
            : s.rating && Number(s.rating) > 0
            ? Number(s.rating)
            : null;

        const hasWatchedAny = (s.episodes || []).some((e: any) => e.watched) || Boolean(s.watched);
        return {
          id: s.id,
          title: s.title,
          type: 'series' as const,
          posterUrl: s.posterUrl || s.poster || null,
          year: s.year || '',
          rating: hasWatchedAny && avgRating ? avgRating : null,
          genres: s.genres || [],
        };
      })
      .filter((s): s is NonNullable<typeof s> & { rating: number } => s.rating !== null && s.rating > 0);

    return [...ratedMovies, ...ratedSeries]
      .filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase());
        const matchesMinRating = item.rating >= minRatingFilter;
        return matchesSearch && matchesMinRating;
      })
      .sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return a.title.localeCompare(b.title);
      });
  }, [movies, series, search, minRatingFilter]);

  if (!isOpen) return null;

  const toggleItem = (item: any) => {
    setDraft(prev => {
      const exists = prev.some(x => x.id === item.id);
      if (exists) return prev.filter(x => x.id !== item.id);
      if (prev.length >= 4) {
        showToast('Vitrine en fazla 4 başyapıt ekleyebilirsin!', 'warning');
        return prev;
      }
      return [
        ...prev,
        {
          id: item.id,
          title: item.title,
          type: item.type,
          posterUrl: item.posterUrl,
          year: item.year,
          rating: item.rating,
        },
      ];
    });
  };

  const moveSlot = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= draft.length) return;
    setDraft(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  return (
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-4xl h-[88vh] bg-ink-950 border border-gold-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
      >
        {/* ÜST BAŞLIK */}
        <div className="p-4 sm:p-5 border-b border-ink-800 bg-gradient-to-r from-gold-500/10 via-ink-900 to-ink-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gold-500/20 text-gold-400 flex items-center justify-center border border-gold-500/40 shadow-lg shadow-gold-500/10">
              <Crown size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                Başyapıt Vitrinini Tasarla
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 border border-gold-500/30">
                  En İyi 4'lü
                </span>
              </h2>
              <p className="text-[11px] text-ink-400">
                Sadece izlediğin ve puanladığın yapımlar en yüksek puandan başlayarak listelenir.
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

        {/* SEÇİLEN 4 SLOT (SIRALAMA DESTEKLİ) */}
        <div className="p-4 bg-ink-900/40 border-b border-ink-800 shrink-0">
          <div className="grid grid-cols-4 gap-3 max-w-xl mx-auto">
            {[0, 1, 2, 3].map(slotIdx => {
              const slotItem = draft[slotIdx];
              const poster = slotItem?.posterUrl || (slotItem as any)?.poster;
              return (
                <div
                  key={slotIdx}
                  className={`relative aspect-[2/3] rounded-2xl overflow-hidden flex flex-col items-center justify-center transition-all ${
                    slotItem
                      ? 'border-2 border-gold-400/80 bg-ink-900 shadow-[0_0_25px_rgba(250,204,21,0.15)]'
                      : 'border-2 border-dashed border-ink-800 bg-ink-950/60'
                  }`}
                >
                  {slotItem ? (
                    <>
                      {poster ? (
                        <img src={poster} alt={slotItem.title} className="w-full h-full object-cover" />
                      ) : (
                        <Film size={24} className="text-ink-600" />
                      )}
                      <div className="absolute top-1.5 left-1.5 bg-black/80 backdrop-blur-md text-gold-400 text-[10px] font-black px-2 py-0.5 rounded-lg border border-gold-500/30 flex items-center gap-1">
                        #{slotIdx + 1}
                        {slotItem.rating && (
                          <span className="text-white flex items-center gap-0.5">
                            • <Star size={9} className="fill-gold-400 text-gold-400" /> {slotItem.rating}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleItem(slotItem)}
                        className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-500 text-white p-1 rounded-lg shadow-md transition-colors"
                        title="Vitrinden Kaldır"
                      >
                        <X size={12} />
                      </button>

                      {/* SIRA DEĞİŞTİRME OKLARI */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/90 to-transparent p-2 pt-6 flex flex-col gap-1">
                        <div className="text-[10px] font-bold text-white truncate text-center">{slotItem.title}</div>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            disabled={slotIdx === 0}
                            onClick={() => moveSlot(slotIdx, -1)}
                            className="p-1 rounded bg-ink-800/90 hover:bg-gold-500 hover:text-ink-950 text-ink-300 disabled:opacity-30 transition-colors"
                            title="Sola Kaydır"
                          >
                            <ArrowLeft size={11} />
                          </button>
                          <button
                            disabled={slotIdx === draft.length - 1}
                            onClick={() => moveSlot(slotIdx, 1)}
                            className="p-1 rounded bg-ink-800/90 hover:bg-gold-500 hover:text-ink-950 text-ink-300 disabled:opacity-30 transition-colors"
                            title="Sağa Kaydır"
                          >
                            <ArrowRight size={11} />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-2">
                      <div className="w-7 h-7 rounded-full bg-ink-900 border border-ink-800 flex items-center justify-center text-ink-600 font-black text-xs mx-auto mb-1">
                        {slotIdx + 1}
                      </div>
                      <span className="text-[9px] font-bold text-ink-600 uppercase tracking-widest block">
                        Aşağıdan Seç
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ARAMA VE PUAN FİLTRESİ */}
        <div className="p-3 sm:p-4 border-b border-ink-800 bg-ink-950 flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              placeholder="İzlediğin ve puanladığın yapımlarda ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-ink-900 border border-ink-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white focus:border-gold-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-ink-900 p-1 rounded-xl border border-ink-800">
            {[
              { label: 'Tümü', val: 0 },
              { label: '★ 9+', val: 9 },
              { label: '★ 8+', val: 8 },
              { label: '★ 7+', val: 7 },
            ].map(f => (
              <button
                key={f.val}
                onClick={() => setMinRatingFilter(f.val)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all ${
                  minRatingFilter === f.val
                    ? 'bg-gold-500 text-ink-950 shadow'
                    : 'text-ink-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* PUANA GÖRE SIRALI LİSTE */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
          {eligibleItems.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Sparkles size={36} className="mx-auto text-ink-700 mb-3" />
              <div className="text-sm font-bold text-ink-400 mb-1">
                Kriterlere uygun izlenmiş ve puanlanmış yapım bulunamadı.
              </div>
              <p className="text-xs text-ink-600">
                Vitrine eklemek istediğin film veya dizileri önce izlendi olarak işaretleyip puanlamalısın.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3.5">
              {eligibleItems.map(item => {
                const selectedIndex = draft.findIndex(x => x.id === item.id);
                const isSelected = selectedIndex !== -1;

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item)}
                    className={`relative aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer border-2 transition-all group ${
                      isSelected
                        ? 'border-gold-400 scale-95 shadow-[0_0_20px_rgba(250,204,21,0.3)]'
                        : 'border-ink-800 hover:border-gold-500/50 bg-ink-900 hover:-translate-y-1'
                    }`}
                  >
                    {item.posterUrl ? (
                      <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ink-700">
                        {item.type === 'series' ? <Tv size={28} /> : <Film size={28} />}
                      </div>
                    )}

                    {/* VERİLEN PUAN ROZETİ */}
                    <div className="absolute top-2 right-2 bg-ink-950/90 backdrop-blur-md text-gold-400 text-xs font-black px-2 py-0.5 rounded-lg border border-gold-500/40 flex items-center gap-1 shadow-lg">
                      <Star size={11} className="fill-gold-400 text-gold-400" />
                      {item.rating}
                    </div>

                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-ink-300 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                      {item.type === 'series' ? 'Dizi' : 'Film'}
                    </div>

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/90 to-transparent p-2.5 pt-8">
                      <h4 className="text-[11px] font-bold text-white line-clamp-2 leading-tight">{item.title}</h4>
                    </div>

                    {isSelected && (
                      <div className="absolute inset-0 bg-gold-500/25 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-gold-500 text-ink-950 flex items-center justify-center font-black text-sm shadow-xl border-2 border-white">
                          #{selectedIndex + 1}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* KAYDET / İPTAL */}
        <div className="p-4 border-t border-ink-800 bg-ink-950 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-ink-900 hover:bg-ink-800 text-ink-300 rounded-xl text-sm font-bold transition-colors"
          >
            İptal
          </button>
          <button
            onClick={() => onSave(draft)}
            className="flex-1 bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 text-ink-950 rounded-xl text-sm font-black uppercase tracking-wider transition-all shadow-lg shadow-gold-500/20 flex items-center justify-center gap-2"
          >
            <Check size={18} strokeWidth={3} /> Vitrini Kaydet ({draft.length}/4)
          </button>
        </div>
      </div>
    </div>
  );
}