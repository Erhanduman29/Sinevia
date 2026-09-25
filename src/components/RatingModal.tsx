import { useState, useMemo, useEffect } from 'react';
import { X, Star, Sparkles, SlidersHorizontal, StickyNote, Award, Flame, ThumbsUp, Meh, Frown, Skull, Check, Wand2, RotateCcw, Minus, Plus, Tag } from 'lucide-react';
import { useApp, DEFAULT_REVIEW_TAGS } from '../context/AppContext';
import { ratingBgClass } from '../lib/utils';

interface RatingModalProps {
  title: string;
  subtitle: string;
  initialRating?: number | null;
  initialNote?: string;
  initialDetailedRating?: Record<string, number>;
  initialReviewTags?: string[];
  onRate: (rating: number, note: string, detailedRating?: Record<string, number>, reviewTags?: string[]) => void;
  onClose: () => void;
}

const STAR_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SEQUENTIAL_SCORES = [
  1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10
];

export default function RatingModal({
  title,
  subtitle,
  initialRating,
  initialNote = '',
  initialDetailedRating,
  initialReviewTags = [],
  onRate,
  onClose,
}: RatingModalProps) {
  const { data } = useApp();
  const criteriaList = data.criteria || [];
  const availableTags = data.reviewTags && data.reviewTags.length > 0 ? data.reviewTags : DEFAULT_REVIEW_TAGS;

  // Her film/bölüm için benzersiz taslak (draft) anahtarı
  const draftKey = useMemo(() => {
    return `sinevia_rating_draft_${title.trim()}_${subtitle.trim()}`;
  }, [title, subtitle]);

  // Kaydedilmiş taslağı kontrol et
  const savedDraft = useMemo(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }, [draftKey]);

  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(Boolean(savedDraft));

  const [rating, setRating] = useState<number>(() => {
    if (savedDraft && typeof savedDraft.rating === 'number') return savedDraft.rating;
    return initialRating ?? 8;
  });

  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const [note, setNote] = useState<string>(() => {
    if (savedDraft && typeof savedDraft.note === 'string') return savedDraft.note;
    return initialNote;
  });

  // Seçilebilir Değerlendirme Başlıkları (Notlara yazılmaz, rozet olarak seçilir)
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    if (savedDraft && Array.isArray(savedDraft.selectedTags)) return savedDraft.selectedTags;
    return initialReviewTags || [];
  });

  const [showCriteria, setShowCriteria] = useState<boolean>(() => {
    if (savedDraft && typeof savedDraft.showCriteria === 'boolean') return savedDraft.showCriteria;
    return Boolean(initialDetailedRating && Object.keys(initialDetailedRating).length > 0);
  });

  // Sayısal kriter puanları
  const [critScores, setCritScores] = useState<Record<string, number>>(() => {
    if (savedDraft && savedDraft.critScores) {
      return { ...savedDraft.critScores };
    }
    if (initialDetailedRating && Object.keys(initialDetailedRating).length > 0) {
      return { ...initialDetailedRating };
    }
    const defaults: Record<string, number> = {};
    criteriaList.forEach((c) => {
      defaults[c.id] = initialRating ?? 8;
    });
    return defaults;
  });

  // Klavyeden rahatça silip yazabilmek için metin tabanlı input state'i
  const [critInputs, setCritInputs] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    const source =
      (savedDraft && savedDraft.critScores) ||
      (initialDetailedRating && Object.keys(initialDetailedRating).length > 0 ? initialDetailedRating : null);

    criteriaList.forEach((c) => {
      const val = source?.[c.id] ?? initialRating ?? 8;
      map[c.id] = String(val);
    });
    return map;
  });

  // Kullanıcı ne yazarsa veya hangi puanı/başlığı seçerse anında taslak olarak kaydet
  useEffect(() => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          rating,
          note,
          selectedTags,
          showCriteria,
          critScores,
        })
      );
    } catch {}
  }, [draftKey, rating, note, selectedTags, showCriteria, critScores]);

  // Taslağı sıfırlama fonksiyonu
  const handleResetDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    const defRating = initialRating ?? 8;
    setRating(defRating);
    setNote(initialNote);
    setSelectedTags(initialReviewTags || []);
    const defShow = Boolean(initialDetailedRating && Object.keys(initialDetailedRating).length > 0);
    setShowCriteria(defShow);

    const nextScores: Record<string, number> = {};
    const nextInputs: Record<string, string> = {};
    criteriaList.forEach((c) => {
      const val = initialDetailedRating?.[c.id] ?? defRating;
      nextScores[c.id] = val;
      nextInputs[c.id] = String(val);
    });
    setCritScores(nextScores);
    setCritInputs(nextInputs);
    setHasRestoredDraft(false);
  };

  const activeScore = hoverRating !== null ? hoverRating : rating;

  const scoreMeta = useMemo(() => {
    if (activeScore >= 9.5) {
      return {
        label: 'Kusursuz Başyapıt',
        sub: 'Sinema tarihine geçecek efsanevi bir deneyim!',
        icon: Award,
      };
    }
    if (activeScore >= 8.5) {
      return {
        label: 'Muazzam Yapım',
        sub: 'Kesinlikle izlenmesi gereken, üst düzey kalite.',
        icon: Flame,
      };
    }
    if (activeScore >= 7.0) {
      return {
        label: 'Çok İyi & Keyifli',
        sub: 'Vaktine fazlasıyla değen, başarılı bir yapım.',
        icon: ThumbsUp,
      };
    }
    if (activeScore >= 5.0) {
      return {
        label: 'Ortalama / Çerezlik',
        sub: 'Eksikleri olsa da kendini izlettiren standart yapım.',
        icon: Meh,
      };
    }
    if (activeScore >= 3.0) {
      return {
        label: 'Hayal Kırıklığı',
        sub: 'Potansiyelini harcamış, ciddi kusurları olan bir yapım.',
        icon: Frown,
      };
    }
    return {
      label: 'Tam Bir Felaket',
      sub: 'Zaman kaybı, uzak durulması gereken bir deneyim.',
      icon: Skull,
    };
  }, [activeScore]);

  const MetaIcon = scoreMeta.icon;

  // Kriterlerin ağırlıklı ortalamasını hesapla
  const recalculateWeightedAverage = (updatedScores: Record<string, number>) => {
    let totalWeight = 0;
    let weightedSum = 0;
    criteriaList.forEach((c) => {
      const s = updatedScores[c.id] ?? rating;
      weightedSum += s * c.weight;
      totalWeight += c.weight;
    });

    if (totalWeight > 0) {
      const avg = Math.round((weightedSum / totalWeight) * 2) / 2;
      setRating(Math.max(1, Math.min(10, avg)));
    }
  };

  const handleCriterionInputChange = (critId: string, rawVal: string) => {
    const normalized = rawVal.replace(',', '.');
    setCritInputs((prev) => ({ ...prev, [critId]: normalized }));

    if (normalized.trim() === '') return;

    const parsed = parseFloat(normalized);
    if (!isNaN(parsed)) {
      const clamped = Math.max(1, Math.min(10, parsed));
      const updated = { ...critScores, [critId]: clamped };
      setCritScores(updated);
      recalculateWeightedAverage(updated);
    }
  };

  const handleCriterionInputBlur = (critId: string) => {
    const raw = critInputs[critId];
    let parsed = parseFloat(raw);
    if (isNaN(parsed)) {
      parsed = critScores[critId] ?? 8;
    }
    const clamped = Math.max(1, Math.min(10, Math.round(parsed * 2) / 2));
    const updated = { ...critScores, [critId]: clamped };
    setCritScores(updated);
    setCritInputs((prev) => ({ ...prev, [critId]: String(clamped) }));
    recalculateWeightedAverage(updated);
  };

  const stepCriterionScore = (critId: string, delta: number) => {
    const current = critScores[critId] ?? rating;
    const next = Math.max(1, Math.min(10, Math.round((current + delta) * 2) / 2));
    const updated = { ...critScores, [critId]: next };
    setCritScores(updated);
    setCritInputs((prev) => ({ ...prev, [critId]: String(next) }));
    recalculateWeightedAverage(updated);
  };

  // Başlık Seç / Kaldır (Notlara yazmaz, seçili diziyi günceller)
  const toggleReviewTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Varsa önceden seçilmiş ama ayarlardan silinmiş başlıkları da listede göster
  const displayedTags = useMemo(() => {
    return Array.from(new Set([...availableTags, ...selectedTags]));
  }, [availableTags, selectedTags]);

  const handleSubmit = () => {
    const finalDetailed = showCriteria && criteriaList.length > 0 ? critScores : undefined;
    const finalTags = selectedTags.length > 0 ? selectedTags : undefined;
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    onRate(rating, note.trim(), finalDetailed, finalTags);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl bg-ink-950/95 border border-ink-700/80 rounded-[2rem] overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.85)] flex flex-col max-h-[92vh] animate-fade-in-up"
      >
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-64 bg-gold-500/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 right-0 w-72 h-72 bg-azure-500/10 rounded-full blur-[110px] pointer-events-none" />

        {/* ÜST BAŞLIK BARI */}
        <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-4 border-b border-ink-800/60">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gold-400">
                <Sparkles size={12} /> Sinevia Değerlendirme Stüdyosu
              </div>
              {hasRestoredDraft && (
                <button
                  type="button"
                  onClick={handleResetDraft}
                  className="inline-flex items-center gap-1 text-[10px] font-bold bg-ink-800 hover:bg-ink-700 text-ink-300 hover:text-white px-2 py-0.5 rounded-full border border-ink-700 transition-colors"
                  title="Kaydedilen taslağı temizle ve sıfırla"
                >
                  <RotateCcw size={10} /> Taslağı Sıfırla
                </button>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-black text-ink-50 truncate">{title}</h2>
            <p className="text-xs text-ink-400 truncate mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-ink-900 hover:bg-ink-800 text-ink-400 hover:text-white border border-ink-800 flex items-center justify-center transition-all hover:scale-110 flex-shrink-0"
            title="Kapat (Yazdıkların taslak olarak korunur)"
          >
            <X size={18} />
          </button>
        </div>

        {/* İÇERİK GÖVDESİ */}
        <div className="relative z-10 flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
          
          {/* MERKEZİ PUAN KADRANI */}
          <div className="flex flex-col items-center text-center bg-ink-900/50 border border-ink-800/80 rounded-3xl p-5 relative overflow-hidden shadow-inner">
            <div className="flex items-center gap-4 mb-3">
              <div
                className={`px-5 py-3 rounded-2xl font-black text-3xl sm:text-4xl shadow-lg flex items-center gap-2 transition-all duration-300 ${ratingBgClass(activeScore)}`}
              >
                <MetaIcon size={26} />
                <span>{activeScore % 1 === 0 ? `${activeScore}.0` : activeScore}</span>
              </div>

              <div className="text-left">
                <div className="text-sm sm:text-base font-black text-ink-100 tracking-wide">
                  {scoreMeta.label}
                </div>
                <p className="text-xs text-ink-400 font-medium mt-0.5 max-w-[240px]">
                  {scoreMeta.sub}
                </p>
              </div>
            </div>

            {/* 10'LU İNTERAKTİF YILDIZ DİZİLİMİ */}
            <div
              className="flex items-center justify-center gap-1 sm:gap-1.5 w-full mb-4 pt-2"
              onMouseLeave={() => setHoverRating(null)}
            >
              {STAR_VALUES.map((starVal) => {
                const isFilled = activeScore >= starVal;
                const isHalf = !isFilled && activeScore >= starVal - 0.5;
                return (
                  <button
                    key={starVal}
                    type="button"
                    onMouseEnter={() => setHoverRating(starVal)}
                    onClick={() => setRating(starVal)}
                    className="p-1 sm:p-1.5 rounded-lg transition-transform hover:scale-125 focus:outline-none"
                    title={`${starVal} Puan`}
                  >
                    <Star
                      size={22}
                      className={`transition-all duration-200 ${
                        isFilled
                          ? 'text-gold-400 fill-current drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                          : isHalf
                          ? 'text-gold-400 fill-current opacity-60'
                          : 'text-ink-700 hover:text-ink-500'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* 1'DEN 10'A SIRALI PUAN BUTONLARI */}
            <div className="w-full space-y-2.5 pt-3 border-t border-ink-800/60">
              <div className="flex items-center justify-between text-[11px] font-bold text-ink-400 px-1">
                <span>Puan Seçimi (1 - 10 Sıralı)</span>
                <span className="text-gold-400 font-mono">Seçilen: {rating} / 10</span>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                {SEQUENTIAL_SCORES.map((num) => {
                  const isCurrent = rating === num;
                  const isWhole = num % 1 === 0;
                  return (
                    <button
                      key={num}
                      type="button"
                      onMouseEnter={() => setHoverRating(num)}
                      onMouseLeave={() => setHoverRating(null)}
                      onClick={() => setRating(num)}
                      className={`py-2 rounded-xl text-xs transition-all border ${
                        num === 10 ? 'col-span-1 sm:col-span-2 font-black' : isWhole ? 'font-black' : 'font-bold'
                      } ${
                        isCurrent
                          ? `${ratingBgClass(num)} scale-105 shadow-md border-white/40`
                          : isWhole
                          ? 'bg-ink-950/90 text-ink-100 border-ink-700/80 hover:bg-ink-800 hover:border-ink-600'
                          : 'bg-ink-950/40 text-ink-400 border-ink-800/60 hover:bg-ink-800 hover:text-ink-200'
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* AĞIRLIKLI DETAYLI KRİTER HESAPLAYICI */}
          {criteriaList.length > 0 && (
            <div className="bg-ink-900/40 border border-ink-800/80 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowCriteria(!showCriteria)}
                className="w-full flex items-center justify-between p-4 hover:bg-ink-800/40 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-azure-500/20 border border-azure-500/30 flex items-center justify-center text-azure-400">
                    <SlidersHorizontal size={16} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-black uppercase tracking-wider text-ink-100 flex items-center gap-1.5">
                      Detaylı Kriter Puanlama
                      {showCriteria && (
                        <span className="text-[10px] bg-azure-500/20 text-azure-300 px-2 py-0.5 rounded-full border border-azure-500/30">
                          Aktif
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-400">
                      Kriter puanlarını sayıyla gir, ağırlıklı ortalaman otomatik hesaplansın
                    </div>
                  </div>
                </div>
                <div className="text-xs font-bold text-azure-400 bg-ink-950 px-3 py-1.5 rounded-xl border border-ink-800 flex items-center gap-1">
                  <Wand2 size={13} /> {showCriteria ? 'Gizle' : 'Puan Gir'}
                </div>
              </button>

              {showCriteria && (
                <div className="p-4 pt-3 border-t border-ink-800/60 space-y-2.5 animate-fade-in">
                  {criteriaList.map((crit) => {
                    const currentVal = critScores[crit.id] ?? rating;
                    const inputVal = critInputs[crit.id] ?? String(currentVal);
                    return (
                      <div
                        key={crit.id}
                        className="bg-ink-950/70 px-3.5 py-2.5 rounded-xl border border-ink-800/70 flex items-center justify-between gap-3 hover:border-ink-700 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-ink-100 truncate">
                            {crit.name}
                          </div>
                          <div className="text-[10px] font-semibold text-ink-500 mt-0.5">
                            Ağırlık Etkisi: <span className="text-azure-400">{crit.weight} / 10</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => stepCriterionScore(crit.id, -0.5)}
                            className="w-7 h-8 rounded-lg bg-ink-900 hover:bg-ink-800 text-ink-400 hover:text-white border border-ink-800 flex items-center justify-center transition-colors"
                            title="0.5 Azalt"
                          >
                            <Minus size={13} />
                          </button>

                          <div className="relative flex items-center">
                            <input
                              type="number"
                              min="1"
                              max="10"
                              step="0.5"
                              value={inputVal}
                              onChange={(e) => handleCriterionInputChange(crit.id, e.target.value)}
                              onBlur={() => handleCriterionInputBlur(crit.id)}
                              className="w-16 h-8 bg-ink-900 border border-ink-700 focus:border-gold-500 rounded-lg text-center font-black text-xs text-gold-400 focus:outline-none transition-colors"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => stepCriterionScore(crit.id, 0.5)}
                            className="w-7 h-8 rounded-lg bg-ink-900 hover:bg-ink-800 text-ink-400 hover:text-white border border-ink-800 flex items-center justify-center transition-colors"
                            title="0.5 Artır"
                          >
                            <Plus size={13} />
                          </button>

                          <span className={`ml-1 text-[11px] px-2 py-1 rounded-md font-bold min-w-[34px] text-center ${ratingBgClass(currentVal)}`}>
                            {currentVal}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SEÇİLEBİLİR DEĞERLENDİRME BAŞLIKLARI (NOTLARA YAZILMAZ, ROZET OLARAK SEÇİLİR) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-ink-300 flex items-center gap-1.5">
                <Tag size={14} className="text-gold-400" /> Değerlendirme Başlıkları (Seçilebilir)
              </label>
              {selectedTags.length > 0 && (
                <span className="text-[10px] font-bold text-gold-400 bg-gold-500/15 px-2 py-0.5 rounded-full border border-gold-500/30">
                  {selectedTags.length} Başlık Seçildi
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {displayedTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleReviewTag(tag)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-gold-500 text-ink-950 border-gold-400 shadow-md shadow-gold-500/20 scale-[1.03]'
                        : 'bg-ink-900/90 hover:bg-ink-800 text-ink-300 hover:text-ink-100 border-ink-800 hover:border-ink-700'
                    }`}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                    <span>{tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* KİŞİSEL İNCELEME DEFTERİ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-ink-300 flex items-center gap-1.5">
                <StickyNote size={14} className="text-gold-400" /> Eleştirmen Notun / Günlük
              </label>
              <span className="text-[10px] text-ink-500 font-mono">{note.length} karakter</span>
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Bu yapım hakkında ne düşündün? (Pencereden yanlışlıkla çıksan bile yazdıkların silinmez, otomatik kaydedilir...)"
              className="w-full bg-ink-900/80 border border-ink-700/80 rounded-2xl p-3.5 text-sm text-ink-100 placeholder-ink-500 focus:outline-none focus:border-gold-500/50 transition-all resize-none shadow-inner"
            />
          </div>

        </div>

        {/* ALT KAYDET BUTONU */}
        <div className="relative z-10 p-5 border-t border-ink-800/60 bg-ink-950/90 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl font-bold text-xs sm:text-sm bg-ink-900 hover:bg-ink-800 text-ink-300 border border-ink-800 transition-colors"
          >
            Sonra Devam Et
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 py-3 px-6 rounded-xl font-black text-xs sm:text-sm text-ink-950 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 shadow-xl shadow-gold-500/20 transition-all hover:scale-[1.02] active:scale-98 flex items-center justify-center gap-2"
          >
            <Check size={18} strokeWidth={3} />
            <span>{rating} Puanla Kaydet</span>
          </button>
        </div>

      </div>
    </div>
  );
}