import { useState } from 'react';
import { X, Check, Clock, Link as LinkIcon, Boxes, Plus, History } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Movie } from '../types';

interface Props {
  movie: Movie;
  onClose: () => void;
}

export default function EditMovieModal({ movie, onClose }: Props) {
  const { data, editMovie, setMovieCollection, setMoviePastQueue, addCollection } = useApp();
  const [title, setTitle] = useState(movie.title);
  const [year, setYear] = useState(movie.year);
  const [runtime, setRuntime] = useState<string>(movie.runtime ? movie.runtime.toString() : '');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(movie.genres);
  const [customUrl, setCustomUrl] = useState<string>(movie.customUrl || '');
  const [inPastQueue, setInPastQueue] = useState<boolean>(Boolean(movie.inPastQueue));

  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
    movie.collectionId || null
  );
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewCollInput, setShowNewCollInput] = useState(false);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const handleCreateCollectionInline = () => {
    if (!newCollectionName.trim()) return;
    const newId = addCollection(newCollectionName.trim());
    setSelectedCollectionId(newId);
    setNewCollectionName('');
    setShowNewCollInput(false);
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    const runtimeNum = runtime ? parseInt(runtime, 10) : undefined;

    let finalCollectionId = selectedCollectionId;
    if (showNewCollInput && newCollectionName.trim()) {
      finalCollectionId = addCollection(newCollectionName.trim());
    }

    if (finalCollectionId !== movie.collectionId) {
      setMovieCollection(movie.id, finalCollectionId);
    }

    if (!movie.watched && inPastQueue !== Boolean(movie.inPastQueue)) {
      setMoviePastQueue(movie.id, inPastQueue);
    }

    editMovie(
      movie.id,
      title.trim(),
      year.trim(),
      selectedGenres,
      runtimeNum,
      movie.posterUrl,
      movie.overview,
      movie.tmdbId,
      false,
      customUrl.trim() !== '' ? customUrl.trim() : undefined,
      movie.imdbId,
      movie.watchProviders,
      {
        directors: movie.directors,
        cast: movie.cast,
        studios: movie.studios,
        keywords: movie.keywords,
        originalLanguage: movie.originalLanguage,
      }
    );

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2.5 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-ink-900 border border-ink-700 rounded-2xl sm:rounded-3xl w-full max-w-lg max-h-[90svh] flex flex-col overflow-hidden shadow-2xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3.5 sm:p-5 border-b border-ink-800 bg-ink-900 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-ink-100 truncate">
            Film Düzenle & Koleksiyon Ata
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-ink-800/80 hover:bg-ink-700 text-ink-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-ink-300 mb-1.5">Film Adı</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-ink-800 border border-ink-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-ink-300 mb-1.5">Çıkış Yılı</label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full bg-ink-800 border border-ink-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-ink-300 mb-1.5">
                <Clock size={14} className="text-ink-400" />
                Süre (Dakika)
              </label>
              <input
                type="number"
                value={runtime}
                onChange={(e) => setRuntime(e.target.value)}
                placeholder="örn. 148"
                className="w-full bg-ink-800 border border-ink-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>
          </div>

          {/* ESKİDEN İZLENENLER SIRASI SEÇENEĞİ */}
          {!movie.watched && (
            <button
              type="button"
              onClick={() => setInPastQueue(!inPastQueue)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                inPastQueue
                  ? 'bg-violet-500/20 border-violet-500 text-violet-200'
                  : 'bg-ink-950/60 hover:bg-ink-800 border-ink-800 text-ink-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <History size={16} className={inPastQueue ? 'text-violet-300 flex-shrink-0' : 'text-ink-400 flex-shrink-0'} />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-ink-100">
                    Eskiden İzlenenler Koleksiyonunda (Sırada)
                  </div>
                  <div className="text-[10px] text-ink-400 truncate">
                    Kendi serisinden kopmadan puanlanmak üzere Eskiden İzlenenler kutusunda görünür
                  </div>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border ml-2 ${
                  inPastQueue ? 'bg-violet-500 border-violet-300 text-white' : 'bg-ink-900 border-ink-700 text-transparent'
                }`}
              >
                <Check size={12} strokeWidth={3} />
              </div>
            </button>
          )}

          {/* KOLEKSİYONA EKLEME / DEĞİŞTİRME BÖLÜMÜ */}
          <div className="bg-ink-950/60 border border-ink-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-gold-400">
                <Boxes size={15} />
                Koleksiyon (Seri / Evren)
              </label>
              <button
                type="button"
                onClick={() => setShowNewCollInput(!showNewCollInput)}
                className="text-[11px] font-bold text-gold-400 hover:text-gold-300 flex items-center gap-1 bg-gold-500/10 border border-gold-500/30 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Plus size={12} />
                {showNewCollInput ? 'Vazgeç' : 'Yeni Koleksiyon'}
              </button>
            </div>

            {showNewCollInput && (
              <div className="flex gap-2 animate-fade-in">
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Yeni koleksiyon adı..."
                  className="flex-1 bg-ink-900 border border-gold-500/40 rounded-lg px-3 py-2 text-xs sm:text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateCollectionInline();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleCreateCollectionInline}
                  disabled={!newCollectionName.trim()}
                  className="bg-gold-500 hover:bg-gold-400 text-ink-950 font-bold px-3 py-2 rounded-lg text-xs transition-colors disabled:opacity-40"
                >
                  Ekle & Seç
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCollectionId(null)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  selectedCollectionId === null
                    ? 'bg-ink-700 text-white border-ink-500 shadow-sm'
                    : 'bg-ink-900 text-ink-400 border-ink-800 hover:text-ink-200'
                }`}
              >
                Bağımsız Film
              </button>

              {data.collections.map((col) => {
                const isSelected = selectedCollectionId === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setSelectedCollectionId(col.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-gold-500 text-ink-950 border-gold-400 shadow-md'
                        : 'bg-ink-900 text-ink-300 border-ink-800 hover:border-gold-500/40'
                    }`}
                  >
                    <Boxes size={12} />
                    {col.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ÖZEL İZLEME LİNKİ */}
          <div>
            <label className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-ink-300 mb-1.5">
              <LinkIcon size={14} className="text-azure-400" />
              Özel İzleme Linki (İsteğe Bağlı)
            </label>
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://... (Kişisel arşiv linki)"
              className="w-full bg-ink-800 border border-ink-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-azure-500 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-ink-300 mb-2">Türler</label>
            <div className="flex flex-wrap gap-1.5">
              {data.genres.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenre(g)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedGenres.includes(g)
                      ? 'bg-gold-500 text-ink-950 font-bold'
                      : 'bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-ink-200'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3.5 sm:p-5 border-t border-ink-800 bg-ink-900 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-ink-950 rounded-xl py-3 font-black text-xs sm:text-sm hover:from-gold-400 hover:to-gold-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={18} strokeWidth={2.5} />
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}