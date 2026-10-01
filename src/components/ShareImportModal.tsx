import { useState, useMemo, useEffect } from 'react';
import {
  X, Film, Tv, Search, Check, Plus, Boxes, Calendar, Clock,
  AlertTriangle, Sparkles, Image as ImageIcon, CheckSquare, Square,
} from 'lucide-react';
import { useApp, resolveTMDBGenres } from '../context/AppContext';
import { normalize } from '../lib/utils';

interface ShareImportModalProps {
  rawJson: string;
  onClose: () => void;
}

export default function ShareImportModal({ rawJson, onClose }: ShareImportModalProps) {
  const { data, importShareList, showToast } = useApp();

  // Modal açıldığında arkadaki sayfanın kaymasını engelle
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const parsedPayload = useMemo(() => {
    try {
      const parsed = JSON.parse(rawJson);
      const rawMovies: any[] = Array.isArray(parsed.movies) ? parsed.movies : [];
      const rawSeries: any[] = Array.isArray(parsed.series) ? parsed.series : [];
      const rawCols: any[] = Array.isArray(parsed.collections) ? parsed.collections : [];

      const colMap = new Map<string, string>();
      rawCols.forEach((c) => { if (c && c.id && c.name) colMap.set(c.id, c.name); });

      const existingMovies = new Set(data.movies.map((m) => normalize(m.title)));
      const missingMovies: any[] = [];
      rawMovies.forEach((m, idx) => {
        if (!m || !m.title) return;
        const norm = normalize(m.title);
        if (existingMovies.has(norm)) return;
        existingMovies.add(norm);
        const resolvedGenres = resolveTMDBGenres(Array.isArray(m.genres) ? m.genres : [], data.genres);
        missingMovies.push({ ...m, _idx: idx, genres: resolvedGenres, _colName: m.collectionId ? colMap.get(m.collectionId) : undefined });
      });

      const existingSeries = new Set([...data.series.map((s) => normalize(s.title)), ...data.removedSeriesTitles.map((t) => normalize(t))]);
      const missingSeries: any[] = [];
      rawSeries.forEach((s, idx) => {
        if (!s || !s.title) return;
        const norm = normalize(s.title);
        if (existingSeries.has(norm)) return;
        existingSeries.add(norm);
        const resolvedGenres = resolveTMDBGenres(Array.isArray(s.genres) ? s.genres : [], data.genres);
        const epCount = Array.isArray(s.episodes) ? s.episodes.length : 0;
        const seasonCount = Array.isArray(s.episodes) ? new Set(s.episodes.map((e: any) => e.season)).size : 0;
        missingSeries.push({ ...s, _idx: idx, genres: resolvedGenres, _epCount: epCount, _seasonCount: seasonCount });
      });

      return { valid: true, missingMovies, missingSeries, rawCols };
    } catch {
      return { valid: false, missingMovies: [], missingSeries: [], rawCols: [] };
    }
  }, [rawJson, data.movies, data.series, data.removedSeriesTitles, data.genres]);

  const [activeTab, setActiveTab] = useState<'movies' | 'series'>(() =>
    parsedPayload.missingMovies.length === 0 && parsedPayload.missingSeries.length > 0 ? 'series' : 'movies'
  );
  const [search, setSearch] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [selectedMovieIds, setSelectedMovieIds] = useState<Set<number>>(new Set());
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<Set<number>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);

  const activeItems = activeTab === 'movies' ? parsedPayload.missingMovies : parsedPayload.missingSeries;

  // Sadece o anki sekmede arkadaşın oluşturduğu ve içinde eksik film bulunan koleksiyon grupları (TEK TUŞLA SEÇİM İÇİN)
  const collectionGroups = useMemo(() => {
    if (activeTab !== 'movies') return [];
    const map = new Map<string, number[]>();
    parsedPayload.missingMovies.forEach((m) => {
      if (m._colName) {
        const arr = map.get(m._colName) || [];
        arr.push(m._idx);
        map.set(m._colName, arr);
      }
    });
    const groups: { name: string; indices: number[] }[] = [];
    map.forEach((indices, name) => groups.push({ name, indices }));
    return groups;
  }, [parsedPayload.missingMovies, activeTab]);

  const availableGenres = useMemo(() => {
    const gSet = new Set<string>();
    activeItems.forEach((item) => (item.genres || []).forEach((g: string) => gSet.add(g)));
    return Array.from(gSet).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [activeItems]);

  const filteredItems = useMemo(() => {
    return activeItems.filter((item) => {
      if (search.trim()) {
        const q = search.toLocaleLowerCase('tr-TR');
        if (!item.title.toLocaleLowerCase('tr-TR').includes(q)) return false;
      }
      if (selectedGenres.size > 0) {
        const itemGenres: string[] = item.genres || [];
        if (!Array.from(selectedGenres).every((g) => itemGenres.includes(g))) return false;
      }
      return true;
    });
  }, [activeItems, search, selectedGenres]);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const toggleItemSelection = (idx: number) => {
    if (activeTab === 'movies') {
      setSelectedMovieIds((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        return next;
      });
    } else {
      setSelectedSeriesIds((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        return next;
      });
    }
  };

  const toggleCollectionSelection = (indices: number[], isAllSelected: boolean) => {
    setSelectedMovieIds((prev) => {
      const next = new Set(prev);
      indices.forEach((idx) => {
        if (isAllSelected) next.delete(idx);
        else next.add(idx);
      });
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (activeTab === 'movies') {
      const allSelected = filteredItems.every((m) => selectedMovieIds.has(m._idx));
      setSelectedMovieIds((prev) => {
        const next = new Set(prev);
        filteredItems.forEach((m) => (allSelected ? next.delete(m._idx) : next.add(m._idx)));
        return next;
      });
    } else {
      const allSelected = filteredItems.every((s) => selectedSeriesIds.has(s._idx));
      setSelectedSeriesIds((prev) => {
        const next = new Set(prev);
        filteredItems.forEach((s) => (allSelected ? next.delete(s._idx) : next.add(s._idx)));
        return next;
      });
    }
  };

  const handleConfirmImport = () => {
    const chosenMovies = parsedPayload.missingMovies.filter((m) => selectedMovieIds.has(m._idx));
    const chosenSeries = parsedPayload.missingSeries.filter((s) => selectedSeriesIds.has(s._idx));
    const usedColIds = new Set(chosenMovies.map((m) => m.collectionId).filter(Boolean));
    const chosenCols = parsedPayload.rawCols.filter((c) => usedColIds.has(c.id));

    const finalJson = JSON.stringify({
      isShareList: true,
      collections: chosenCols,
      movies: chosenMovies,
      series: chosenSeries,
    });

    importShareList(finalJson);
    onClose();
  };

  if (!parsedPayload.valid) {
    return (
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="bg-ink-900 border border-red-500/40 rounded-2xl p-6 max-w-md w-full text-center space-y-4">
          <AlertTriangle size={40} className="text-red-400 mx-auto" />
          <h3 className="text-lg font-bold text-white">Geçersiz Paylaşım Dosyası</h3>
          <p className="text-xs text-ink-400">Yüklediğin dosya okunamadı. Lütfen geçerli bir Sinevia JSON dosyası seç.</p>
          <button onClick={onClose} className="w-full py-2.5 bg-ink-800 hover:bg-ink-700 text-white rounded-xl font-bold text-xs">Kapat</button>
        </div>
      </div>
    );
  }

  const totalMissing = parsedPayload.missingMovies.length + parsedPayload.missingSeries.length;
  const totalSelected = selectedMovieIds.size + selectedSeriesIds.size;
  const totalUnselected = totalMissing - totalSelected;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-ink-900 border border-ink-700 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[85svh] sm:max-h-[88vh] animate-fade-in-up"
      >
        {/* ÜST BAŞLIK */}
        <div className="flex items-center justify-between p-3 sm:p-5 border-b border-ink-800 bg-ink-950/60 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-azure-500/20 border border-azure-500/40 flex items-center justify-center flex-shrink-0">
              <Sparkles size={16} className="text-azure-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-black text-white truncate">Paylaşılan Listeden Seç</h2>
              <p className="text-[10px] sm:text-xs text-ink-400 truncate">
                Sende olmayanlardan istediklerini seçip kütüphanene ekle!
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-ink-800 hover:bg-ink-700 text-ink-300 hover:text-white flex items-center justify-center transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {totalMissing === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-3 sm:space-y-4">
            <Check size={40} className="text-emerald-400 mx-auto" />
            <h3 className="text-base sm:text-lg font-bold text-white">Harika! Listedeki Tüm Yapımlar Sende Var</h3>
            <p className="text-[11px] sm:text-xs text-ink-400 max-w-md mx-auto">
              Arkadaşının listesindeki tüm film ve diziler senin kütüphanende zaten bulunuyor. Eklenecek yeni bir yapım kalmadı.
            </p>
            <button onClick={onClose} className="px-6 py-2.5 bg-gold-500 text-ink-950 font-black rounded-xl text-xs">Tamam</button>
          </div>
        ) : (
          <>
            {/* SEKMELER & FİLTRELER */}
            <div className="p-3 sm:p-4 border-b border-ink-800 bg-ink-950/30 space-y-2.5 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="grid grid-cols-2 sm:flex bg-ink-950 p-1 rounded-xl border border-ink-800 gap-1">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('movies'); setSelectedGenres(new Set()); setSearch(''); }}
                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs font-black transition-all truncate ${
                      activeTab === 'movies' ? 'bg-gold-500 text-ink-950 shadow-md' : 'text-ink-400 hover:text-white'
                    }`}
                  >
                    <Film size={14} className="flex-shrink-0" />
                    <span className="truncate">Filmler ({parsedPayload.missingMovies.length})</span>
                    {selectedMovieIds.size > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'movies' ? 'bg-black/20 text-white' : 'bg-gold-500/20 text-gold-400'}`}>
                        {selectedMovieIds.size}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('series'); setSelectedGenres(new Set()); setSearch(''); }}
                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs font-black transition-all truncate ${
                      activeTab === 'series' ? 'bg-azure-500 text-white shadow-md' : 'text-ink-400 hover:text-white'
                    }`}
                  >
                    <Tv size={14} className="flex-shrink-0" />
                    <span className="truncate">Diziler ({parsedPayload.missingSeries.length})</span>
                    {selectedSeriesIds.size > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'series' ? 'bg-black/20 text-white' : 'bg-azure-500/20 text-azure-300'}`}>
                        {selectedSeriesIds.size}
                      </span>
                    )}
                  </button>
                </div>

                {filteredItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-bold text-ink-200 hover:text-gold-400 bg-ink-800 hover:bg-ink-700 px-3 py-2 rounded-xl border border-ink-700 transition-colors"
                  >
                    {(activeTab === 'movies'
                      ? filteredItems.every((m) => selectedMovieIds.has(m._idx))
                      : filteredItems.every((s) => selectedSeriesIds.has(s._idx))) ? (
                      <><Square size={13} /> Seçimi Kaldır</>
                    ) : (
                      <><CheckSquare size={13} className="text-gold-400" /> Tümünü Seç ({filteredItems.length})</>
                    )}
                  </button>
                )}
              </div>

              {/* ARAMA ÇUBUĞU */}
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={activeTab === 'movies' ? 'Paylaşılan filmlerde ara...' : 'Paylaşılan dizilerde ara...'}
                  className="w-full bg-ink-950 border border-ink-700 rounded-xl pl-9 pr-4 py-2 text-base sm:text-sm text-white placeholder-ink-500 focus:outline-none focus:border-gold-500"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white p-1"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* TEK TUŞLA KOLEKSİYON SEÇME BARI (Sadece Film sekmesinde ve koleksiyon varsa görünür) */}
              {collectionGroups.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5 custom-scrollbar">
                  <span className="text-[10px] font-black uppercase tracking-wider text-ink-400 flex items-center gap-1 mr-1 flex-shrink-0">
                    <Boxes size={11} className="text-gold-400" /> Koleksiyon:
                  </span>
                  {collectionGroups.map((g) => {
                    const isAllSelected = g.indices.every((idx) => selectedMovieIds.has(idx));
                    return (
                      <button
                        key={g.name}
                        type="button"
                        onClick={() => toggleCollectionSelection(g.indices, isAllSelected)}
                        className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                          isAllSelected ? 'bg-gold-500/20 text-gold-300 border-gold-500/40' : 'bg-ink-900 text-ink-300 border-ink-800 hover:text-white hover:border-gold-500/30'
                        }`}
                      >
                        {isAllSelected ? <CheckSquare size={11} /> : <Square size={11} />}
                        {g.name} ({g.indices.length})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* TÜR FİLTRELERİ */}
              {availableGenres.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedGenres(new Set())}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex-shrink-0 transition-all ${
                      selectedGenres.size === 0 ? 'bg-gold-500 text-ink-950' : 'bg-ink-800 text-ink-400 hover:text-white'
                    }`}
                  >
                    Tümü
                  </button>
                  {availableGenres.map((g) => {
                    const active = selectedGenres.has(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGenre(g)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold flex-shrink-0 transition-all ${
                          active ? 'bg-gold-500 text-ink-950' : 'bg-ink-800 text-ink-400 hover:text-white'
                        }`}
                      >
                        {active && <Check size={10} />}
                        {g}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* LİSTE İÇERİĞİ */}
            <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-1.5 sm:space-y-2 custom-scrollbar">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-ink-500 text-[11px] sm:text-xs">
                  Bu sekmede veya filtrede görüntülenecek yapım bulunamadı.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = activeTab === 'movies' ? selectedMovieIds.has(item._idx) : selectedSeriesIds.has(item._idx);
                  return (
                    <div
                      key={item._idx}
                      onClick={() => toggleItemSelection(item._idx)}
                      className={`flex items-center gap-2.5 sm:gap-3.5 p-2 sm:p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? activeTab === 'movies'
                            ? 'bg-gold-500/15 border-gold-500/60 shadow-md'
                            : 'bg-azure-500/15 border-azure-500/60 shadow-md'
                          : 'bg-ink-950/60 hover:bg-ink-800/50 border-ink-800/80'
                      }`}
                    >
                      <div className="w-10 sm:w-12 aspect-[2/3] rounded-lg sm:rounded-xl bg-ink-900 overflow-hidden flex-shrink-0 border border-ink-700/60 flex items-center justify-center">
                        {item.posterUrl ? (
                          <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon size={14} className="text-ink-600" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-white truncate">{item.title}</span>
                          {item._colName && (
                            <span className="text-[9px] sm:text-[10px] font-bold text-gold-400 bg-gold-500/10 border border-gold-500/30 px-1.5 py-0.5 rounded-md flex items-center gap-1 truncate">
                              <Boxes size={10} /> {item._colName}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 sm:gap-2.5 text-[10px] sm:text-[11px] text-ink-400 mt-0.5 flex-wrap">
                          {item.year && (
                            <span className="flex items-center gap-1">
                              <Calendar size={10} /> {item.year}
                            </span>
                          )}
                          {activeTab === 'movies' && item.runtime && (
                            <span className="flex items-center gap-1">
                              <Clock size={10} /> {item.runtime} dk
                            </span>
                          )}
                          {activeTab === 'series' && (
                            <span className="flex items-center gap-1 text-azure-300">
                              <Tv size={10} /> {item._seasonCount} Sz • {item._epCount} Böl
                            </span>
                          )}
                        </div>

                        {item.genres && item.genres.length > 0 && (
                          <div className="text-[10px] text-ink-500 truncate mt-0.5">
                            {item.genres.slice(0, 3).join(' · ')}
                          </div>
                        )}
                      </div>

                      <div
                        className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[10px] sm:text-xs font-black flex items-center gap-1 flex-shrink-0 transition-all ${
                          isSelected
                            ? activeTab === 'movies'
                              ? 'bg-gold-500 text-ink-950'
                              : 'bg-azure-500 text-white'
                            : 'bg-ink-800 text-ink-300 border border-ink-700'
                        }`}
                      >
                        {isSelected ? <><Check size={12} /> Seçildi</> : <><Plus size={12} /> Seç</>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ALT EKLEME BARI */}
            <div className="p-3 sm:p-4 border-t border-ink-800 bg-ink-950/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
              <div className="text-[11px] sm:text-xs text-ink-300 text-center sm:text-left">
                Seçilen: <strong className="text-gold-400">{selectedMovieIds.size} Film</strong> ve{' '}
                <strong className="text-azure-400">{selectedSeriesIds.size} Dizi</strong>
                <span className="text-ink-500 block sm:inline sm:ml-2">({totalUnselected} yapım seçilmedi)</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-300 text-xs font-bold transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (totalSelected === 0) {
                      showToast('Lütfen eklemek için en az 1 film veya dizi seç!', 'warning');
                      return;
                    }
                    setShowConfirm(true);
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 text-ink-950 font-black text-xs shadow-lg shadow-gold-500/20 transition-all"
                >
                  <Check size={14} /> Seçilenleri Ekle ({totalSelected})
                </button>
              </div>
            </div>
          </>
        )}

        {/* ONAY UYARI PENCERESİ */}
        {showConfirm && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
            <div className="bg-ink-900 border border-gold-500/40 rounded-2xl max-w-md w-full p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-2xl animate-fade-in-up">
              <div className="flex items-center gap-3 text-amber-400">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white">Seçilmeyenler Listeden Çıkarılacak!</h3>
                  <p className="text-[10px] sm:text-[11px] text-amber-300 font-semibold">Son Onay</p>
                </div>
              </div>

              <div className="text-[11px] sm:text-xs text-ink-200 leading-relaxed space-y-1.5 sm:space-y-2 bg-ink-950/70 p-3 sm:p-4 rounded-xl border border-ink-800">
                <p>
                  Seçtiğin <strong className="text-gold-400">{selectedMovieIds.size} film</strong> ve{' '}
                  <strong className="text-azure-400">{selectedSeriesIds.size} dizi</strong> kütüphanene eklenecek.
                </p>
                {totalUnselected > 0 && (
                  <p className="text-red-400 font-semibold">
                    ⚠️ İşaretlemediğin <strong>{totalUnselected} yapım</strong> bu aktarımdan çıkarılacak ve listene eklenmeyecektir!
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-200 text-[11px] sm:text-xs font-bold"
                >
                  Geri Dön
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink-950 font-black text-[11px] sm:text-xs shadow-lg"
                >
                  <Check size={14} /> Ekle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}