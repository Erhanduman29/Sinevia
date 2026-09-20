import { useState } from 'react';
import { X, Star } from 'lucide-react';
import { ratingBgClass } from '../lib/utils';

interface Props {
  title: string;
  subtitle?: string;
  initialRating?: number | null; // YENİ: Önceden verilmiş puanı tutacak
  initialNote?: string;          // YENİ: Önceden yazılmış notu tutacak
  onRate: (rating: number, note: string) => void;
  onClose: () => void;
}

export default function RatingModal({ title, subtitle, initialRating, initialNote, onRate, onClose }: Props) {
  // YENİ: State'leri ilk açılışta gönderilen verilerle (varsa) başlatıyoruz
  const [rating, setRating] = useState<number | null>(initialRating ?? null);
  const [hover, setHover] = useState<number | null>(null);
  const [note, setNote] = useState(initialNote ?? '');

  const display = hover ?? rating;

  const handleStarClick = (val: number) => {
    if (rating === val) {
      setRating(null);
    } else {
      setRating(val);
    }
  };

  const handleSubmit = () => {
    if (rating === null) return;
    onRate(rating, note.trim());
    onClose();
  };

  // Düzenleme mi yapıyoruz yoksa ilk kez mi puanlıyoruz?
  const isEditing = initialRating !== undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-ink-700">
          <div>
            <h2 className="text-lg font-semibold text-ink-100">{title}</h2>
            {subtitle && <p className="text-sm text-ink-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-200 transition-colors">
            <X size={22} />
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink-300 mb-3">Puan (1-10)</label>
            <div className="flex flex-wrap gap-1.5">
              {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((val) => (
                <button
                  key={val}
                  onClick={() => handleStarClick(val)}
                  onMouseEnter={() => setHover(val)}
                  onMouseLeave={() => setHover(null)}
                  className={`px-2.5 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    rating === val
                      ? ratingBgClass(val) + ' scale-110 shadow-lg'
                      : display !== null && val <= display
                      ? 'bg-ink-700 text-ink-200'
                      : 'bg-ink-800 text-ink-500 hover:bg-ink-700 hover:text-ink-300'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
            {rating !== null && (
              <div className="mt-3 flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${ratingBgClass(rating)}`}>
                  {rating} / 10
                </span>
                <Star size={18} className="text-amber-400 fill-amber-400" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">Not (isteğe bağlı)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bu yapım hakkında notun..."
              rows={4}
              className="w-full bg-ink-800 border border-ink-700 rounded-lg px-4 py-3 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/30 transition-all resize-none leading-relaxed"
            />
          </div>
        </div>
        <div className="p-5 border-t border-ink-700">
          <button
            onClick={handleSubmit}
            disabled={rating === null}
            className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-ink-950 rounded-lg py-3 font-semibold hover:from-gold-400 hover:to-gold-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-gold-500/20"
          >
            {isEditing ? 'Güncelle' : 'Puanla ve İzlendi Olarak İşaretle'}
          </button>
        </div>
      </div>
    </div>
  );
}