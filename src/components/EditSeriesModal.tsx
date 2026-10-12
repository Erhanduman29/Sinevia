import { useState } from 'react';
import { X, Check, Link as LinkIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Series } from '../types';

interface Props {
  series: Series;
  onClose: () => void;
}

export default function EditSeriesModal({ series, onClose }: Props) {
  const { data, editSeries } = useApp();
  const [title, setTitle] = useState(series.title);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(series.genres);
  const [customUrl, setCustomUrl] = useState<string>(series.customUrl || '');

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    
    // editSeries fonksiyonuna parametreleri eksiksiz geçiyoruz ki diğer veriler silinmesin
    // (i, t, g, p, o, tmdbId, y, silent, customUrl, imdbId, watchProviders)
    editSeries(
      series.id, 
      title.trim(), 
      selectedGenres, 
      series.posterUrl, 
      series.overview, 
      series.tmdbId, 
      series.year, 
      false, 
      customUrl.trim() !== '' ? customUrl.trim() : undefined,
      series.imdbId,
      series.watchProviders
    );
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-ink-700 sticky top-0 bg-ink-900 z-10">
          <h2 className="text-lg font-semibold text-ink-100">Dizi Düzenle</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-200 transition-colors">
            <X size={22} />
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">Dizi Adı</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-ink-800 border border-ink-700 rounded-lg px-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {/* YENİ: ÖZEL İZLEME LİNKİ (CUSTOM URL) */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-ink-300 mb-1.5">
              <LinkIcon size={16} className="text-azure-400" />
              Özel İzleme Linki (İsteğe Bağlı)
            </label>
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://... (Kişisel arşiv linki)"
              className="w-full bg-ink-800 border border-ink-700 rounded-lg px-4 py-2.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-azure-500 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <p className="text-[10px] text-ink-500 mt-1">Bu linki girerseniz, dizi kartındaki "Hemen İzle" butonu otomatik olarak buraya yönlenir.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-300 mb-2">Türler</label>
            <div className="flex flex-wrap gap-2">
              {data.genres.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedGenres.includes(g)
                      ? 'bg-gold-500 text-ink-950'
                      : 'bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-ink-200'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-ink-700 sticky bottom-0 bg-ink-900">
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-ink-950 rounded-lg py-3 font-semibold hover:from-gold-400 hover:to-gold-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={20} />
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}