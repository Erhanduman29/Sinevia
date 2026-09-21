import { useState, useEffect } from 'react';
import { X, Star, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { ratingBgClass } from '../lib/utils';
import { useApp } from '../context/AppContext';

export function calculateCustomRating(score: number): number {
  if (!score || isNaN(score)) return 0;
  const val = Math.round(score * 100) / 100;
  const rem = val % 0.5;

  if (rem === 0.25) {
    if (val > 5) return val - 0.25; 
    if (val < 5) return val + 0.25; 
  }
  
  return Math.round(val * 2) / 2;
}

interface Props {
  title: string;
  subtitle?: string;
  initialRating?: number | null; 
  initialDetailedRating?: Record<string, number>;
  initialNote?: string;          
  type?: 'movie' | 'series';
  genres?: string[];
  onRate: (rating: number, note: string, detailedRating?: Record<string, number>) => void;
  onClose: () => void;
}

export default function RatingModal({ title, subtitle, initialRating, initialDetailedRating, initialNote, type = 'movie', genres = [], onRate, onClose }: Props) {
  const { data } = useApp();
  const [rating, setRating] = useState<number | null>(initialRating ?? null);
  const [hover, setHover] = useState<number | null>(null);
  const [note, setNote] = useState(initialNote ?? '');
  
  const [showDetailed, setShowDetailed] = useState(false);
  const [detailedScores, setDetailedScores] = useState<Record<string, number>>(initialDetailedRating || {});

  const display = hover ?? rating;

  useEffect(() => {
    const scrollEl = document.getElementById('main-scroll');
    if (scrollEl) scrollEl.style.overflow = 'hidden';
    document.body.classList.add('overflow-hidden');
    document.documentElement.classList.add('overflow-hidden');
    
    return () => {
      if (scrollEl) scrollEl.style.overflow = '';
      document.body.classList.remove('overflow-hidden');
      document.documentElement.classList.remove('overflow-hidden');
    };
  }, []);

  const applicableCriteria = (data.criteria || []).filter(c => {
    if (c.appliesTo !== 'both' && c.appliesTo !== type) return false;
    if (c.genres.length > 0 && genres.length > 0) {
      if (!c.genres.some(g => genres.includes(g))) return false;
    }
    return true;
  });

  useEffect(() => {
    if (Object.keys(detailedScores).length > 0 && applicableCriteria.length > 0) {
      let totalWeight = 0;
      let totalScore = 0;
      
      applicableCriteria.forEach(c => {
        if (detailedScores[c.id]) {
          totalWeight += c.weight;
          totalScore += detailedScores[c.id] * c.weight;
        }
      });

      if (totalWeight > 0) {
        const weightedAverage = totalScore / totalWeight;
        const finalCalculatedScore = calculateCustomRating(weightedAverage);
        setRating(finalCalculatedScore);
      }
    }
  }, [detailedScores, applicableCriteria]);

  const handleStarClick = (val: number) => {
    if (Object.keys(detailedScores).length > 0) {
      setDetailedScores({});
    }
    if (rating === val) {
      setRating(null);
    } else {
      setRating(val);
    }
  };

  const handleDetailedInputChange = (critId: string, val: string) => {
    if (val === '') {
      const newScores = { ...detailedScores };
      delete newScores[critId];
      setDetailedScores(newScores);
      return;
    }
    let num = parseFloat(val);
    if (isNaN(num)) return;
    if (num < 0) num = 0;
    if (num > 10) num = 10;
    setDetailedScores(prev => ({ ...prev, [critId]: num }));
  };

  const handleSubmit = () => {
    if (rating === null) return;
    const finalDetails = Object.keys(detailedScores).length > 0 ? detailedScores : undefined;
    onRate(rating, note.trim(), finalDetails);
    onClose();
  };

  const isEditing = initialRating !== undefined;
  const isAutoCalculated = Object.keys(detailedScores).some(key => detailedScores[key] > 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 md:p-4 md:pl-56 overscroll-none" onClick={onClose} onTouchMove={(e) => e.stopPropagation()}>
      <div
        className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-xl shadow-2xl max-h-[95dvh] flex flex-col overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-ink-700 bg-ink-900/50 shrink-0">
          <div>
            <h2 className="text-base md:text-xl font-bold text-ink-100 line-clamp-1 pr-2">{title}</h2>
            {subtitle && <p className="text-[11px] md:text-sm text-ink-400 mt-0.5 line-clamp-1 font-medium">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-white bg-ink-800/50 hover:bg-ink-700 transition-colors p-1.5 rounded-full shrink-0">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 md:p-5 space-y-5 overflow-y-auto overscroll-contain hide-scrollbar relative z-0">
          
          {/* GENEL PUANLAMA (Eski Klasik Haline Döndü) */}
          <div>
            <div className="flex items-center justify-between mb-2.5 md:mb-3">
              <label className="block text-xs md:text-sm font-medium text-ink-300">
                {isAutoCalculated ? 'Otomatik Hesaplanmış Puan' : 'Genel Puan (1-10)'}
              </label>
              {rating !== null && !isAutoCalculated && (
                <div className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 ${ratingBgClass(rating)}`}>
                  {rating} <Star size={12} className="text-amber-400 fill-amber-400" />
                </div>
              )}
            </div>
            
            <div className={`flex flex-wrap gap-1.5 md:gap-2 ${isAutoCalculated ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
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

            {rating !== null && isAutoCalculated && (
              <div className="mt-4 flex items-center gap-2">
                <span className={`px-4 py-2 rounded-lg text-sm font-bold ${ratingBgClass(rating)} shadow-md`}>
                  {rating} / 10
                </span>
                <Star size={18} className="text-amber-400 fill-amber-400" />
              </div>
            )}
            
            {isAutoCalculated && (
              <p className="text-[10px] text-pink-400/80 font-medium mt-3 bg-pink-500/10 p-2 rounded-lg border border-pink-500/20">
                * Puanınız, detaylı kriterlere ve verdiğiniz ağırlıklara göre otomatik hesaplanmaktadır. Manuel puan vermek isterseniz detaylı puanları sıfırlayın.
              </p>
            )}
          </div>

          {/* DETAYLI PUANLAMA (Kriterler - Yazılı Girdi) */}
          {applicableCriteria.length > 0 && (
            <div className="border border-ink-800 rounded-xl overflow-hidden transition-all bg-ink-900/50">
              <button 
                onClick={() => setShowDetailed(!showDetailed)}
                className="w-full p-3.5 flex items-center justify-between text-sm font-bold text-ink-200 hover:bg-ink-800 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal size={16} className="text-pink-400" />
                  Detaylı Puanlama (Kriterler)
                </div>
                {showDetailed ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
              </button>
              
              {showDetailed && (
                <div className="p-3 border-t border-ink-800 bg-ink-950/50 space-y-2.5">
                  {applicableCriteria.map(crit => {
                    const critScore = detailedScores[crit.id] || '';
                    return (
                      <div key={crit.id} className="flex items-center justify-between bg-ink-900 border border-ink-800 rounded-xl p-2.5 md:p-3 hover:border-ink-700 transition-colors">
                        <div className="flex-1 pr-3">
                          <h4 className="text-xs md:text-sm font-bold text-white leading-tight">{crit.name}</h4>
                          <p className="text-[9px] md:text-[10px] text-ink-500 font-medium mt-0.5 md:mt-1">Etki Değeri: <span className="text-pink-400">{crit.weight}x</span></p>
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="10"
                            step="0.5"
                            value={critScore}
                            onChange={(e) => handleDetailedInputChange(crit.id, e.target.value)}
                            className="w-14 h-9 md:w-16 md:h-10 bg-ink-950 border border-ink-700 rounded-lg text-center font-bold text-white text-sm focus:border-pink-500 focus:ring-1 focus:ring-pink-500/50 outline-none transition-all"
                            placeholder="-"
                          />
                          <span className="text-[10px] md:text-xs font-medium text-ink-500 w-5">/ 10</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* NOT */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-ink-300 mb-1.5">Not Bırak (İsteğe bağlı)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Film veya dizi hakkında aklında kalanlar..."
              rows={3}
              className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2.5 md:px-4 md:py-3 text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/30 transition-all resize-none leading-relaxed"
            />
          </div>
        </div>

        <div className="p-4 md:p-5 border-t border-ink-700 bg-ink-900 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={rating === null}
            className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-ink-950 rounded-lg md:rounded-xl py-3.5 md:py-4 font-black tracking-widest uppercase hover:scale-[1.02] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-gold-500/20 text-xs md:text-sm"
          >
            {isEditing ? 'Güncelle' : 'Puanla ve İzlendi Olarak İşaretle'}
          </button>
        </div>
      </div>
    </div>
  );
}