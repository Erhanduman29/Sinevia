import { useState } from 'react';
import { X, Star } from 'lucide-react';
import { ratingBgClass } from '../lib/utils';

interface Props {
  title: string;
  subtitle?: string;
  initialRating?: number | null; 
  initialNote?: string;          
  onRate: (rating: number, note: string) => void;
  onClose: () => void;
}

export default function RatingModal({ title, subtitle, initialRating, initialNote, onRate, onClose }: Props) {
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

  const isEditing = initialRating !== undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 md:pl-56" onClick={onClose}>
      <div
        className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-md shadow-2xl max-h-[95svh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-ink-700 shrink-0">
          <div>
            <h2 className="text-base md:text-lg font-semibold text-ink-100 line-clamp-1 pr-2">{title}</h2>
            {subtitle && <p className="text-[11px] md:text-sm text-ink-400 mt-0.5 line-clamp-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-200 transition-colors p-1 shrink-0">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 md:p-5 space-y-4 md:space-y-5 overflow-y-auto hide-scrollbar">
          <div>
            <label className="block text-xs md:text-sm font-medium text-ink-300 mb-2.5 md:mb-3">Puan (1-10)</label>
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((val) => (
                <button
                  key={val}
                  onClick={() => handleStarClick(val)}
                  onMouseEnter={() => setHover(val)}
                  onMouseLeave={() => setHover(null)}
                  className={`px-3 py-2 md:px-2.5 md:py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all ${
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
              <div className="mt-4 md:mt-3 flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${ratingBgClass(rating)}`}>
                  {rating} / 10
                </span>
                <Star size={18} className="text-amber-400 fill-amber-400" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs md:text-sm font-medium text-ink-300 mb-1.5">Not (isteğe bağlı)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bu yapım hakkında notun..."
              rows={4}
              className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2.5 md:px-4 md:py-3 text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/30 transition-all resize-none leading-relaxed"
            />
          </div>
        </div>

        <div className="p-4 md:p-5 border-t border-ink-700 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={rating === null}
            className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-ink-950 rounded-lg py-3 font-semibold hover:from-gold-400 hover:to-gold-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-gold-500/20 text-sm md:text-base"
          >
            {isEditing ? 'Güncelle' : 'Puanla ve İzlendi Olarak İşaretle'}
          </button>
        </div>
      </div>
    </div>
  );
}