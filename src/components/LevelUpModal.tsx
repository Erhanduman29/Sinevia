import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Crown, Sparkles, ArrowRight } from 'lucide-react';
import { RANK_TIERS, RankEmblem } from '../lib/rankTiers';

export default function LevelUpModal({
  newLevel,
  onDismiss,
}: {
  newLevel: number;
  onDismiss: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState(0);

  // Yeni seviyeye karşılık gelen Unvan Kademesini ve varsa önceki kademeyi bul
  const { currentRankIndex, currentRank, prevRank, nextRank, isRankPromotion } = useMemo(() => {
    let idx = 0;
    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
      if (newLevel >= RANK_TIERS[i].minLevel) {
        idx = i;
        break;
      }
    }
    const prevLevel = Math.max(1, newLevel - 1);
    let prevIdx = 0;
    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
      if (prevLevel >= RANK_TIERS[i].minLevel) {
        prevIdx = i;
        break;
      }
    }

    return {
      currentRankIndex: idx,
      currentRank: RANK_TIERS[idx],
      prevRank: RANK_TIERS[prevIdx],
      nextRank: RANK_TIERS[idx + 1] || null,
      isRankPromotion: newLevel > 1 && idx > prevIdx,
    };
  }, [newLevel]);

  // Bir sonraki unvana olan ilerleme yüzdesi
  const rankProgressPct = useMemo(() => {
    if (!nextRank) return 100;
    const span = Math.max(1, nextRank.minLevel - currentRank.minLevel);
    const done = newLevel - currentRank.minLevel;
    return Math.min(100, Math.max(8, Math.round((done / span) * 100)));
  }, [newLevel, currentRank, nextRank]);

  useEffect(() => {
    setMounted(true);
    const t1 = setTimeout(() => setPhase(1), 40);   // Faz 1: Sahne kararır ve derinleşir
    const t2 = setTimeout(() => setPhase(2), 320);  // Faz 2: Unvan renginde God Rays ve yörünge halkaları açılır
    const t3 = setTimeout(() => setPhase(3), 680);  // Faz 3: 3 Katmanlı Unvan Arması sahneye iner
    const t4 = setTimeout(() => setPhase(4), 840);  // Faz 4: Çifte şok dalgası ve yıldız parçacıkları patlar
    const t5 = setTimeout(() => setPhase(5), 1450); // Faz 5: Seviye plakası, unvan kartı ve aksiyon butonu belirir

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, []);

  // ESC tuşu ile kapatma desteği
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase >= 5) onDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, onDismiss]);

  if (!mounted) return null;

  const accentHex = currentRank.strokeColor || '#f59e0b';

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto overflow-x-hidden p-4 select-none"
      style={{ fontFamily: 'inherit' }}
    >
      {/* 1. FAZ: Derin Sinematik Karanlık Katman */}
      <div
        className={`fixed inset-0 bg-[#06060a]/95 backdrop-blur-2xl transition-opacity duration-700 ${
          phase >= 1 ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={phase >= 5 ? onDismiss : undefined}
      >
        {/* Unvan Renginde Radyal Atmosfer Işıması */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] md:w-[54rem] md:h-[54rem] rounded-full blur-[130px] pointer-events-none transition-all duration-1000 ease-out ${
            phase >= 2 ? 'opacity-35 scale-100' : 'opacity-0 scale-50'
          }`}
          style={{
            background: `radial-gradient(circle, ${accentHex} 0%, rgba(232,56,79,0.25) 55%, transparent 75%)`,
          }}
        />
      </div>

      {/* 2. FAZ: Dönen Sinematik Işık Hüzmeleri (Unvan Rengine Duyarlı God Rays) */}
      <div
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180vw] h-[180vw] md:w-[82rem] md:h-[82rem] pointer-events-none transition-all duration-1000 ease-out ${
          phase >= 2 ? 'opacity-90 scale-100' : 'opacity-0 scale-50'
        }`}
      >
        <div
          className="w-full h-full animate-[spin_26s_linear_infinite]"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, ${accentHex}22 15deg, transparent 30deg, ${accentHex}18 45deg, transparent 60deg, ${accentHex}22 75deg, transparent 90deg, ${accentHex}18 105deg, transparent 120deg, ${accentHex}22 135deg, transparent 150deg, ${accentHex}18 165deg, transparent 180deg, ${accentHex}22 195deg, transparent 210deg, ${accentHex}18 225deg, transparent 240deg, ${accentHex}22 255deg, transparent 270deg, ${accentHex}18 285deg, transparent 300deg, ${accentHex}22 315deg, transparent 330deg, ${accentHex}18 345deg, transparent 360deg)`,
            maskImage: 'radial-gradient(circle, black 12%, transparent 66%)',
            WebkitMaskImage: 'radial-gradient(circle, black 12%, transparent 66%)',
          }}
        />
      </div>

      {/* 4. FAZ: Işıltılı Ortam Parçacıkları */}
      {phase >= 4 && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(32)].map((_, i) => {
            const size = (i % 4) + 2.5;
            const top = ((i * 37) % 92) + 4;
            const left = ((i * 53) % 92) + 4;
            return (
              <div
                key={i}
                className="absolute rounded-full animate-pulse"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  top: `${top}%`,
                  left: `${left}%`,
                  background: i % 3 === 0 ? '#ffffff' : accentHex,
                  boxShadow: `0 0 12px ${accentHex}`,
                  opacity: ((i % 5) + 2) * 0.12,
                  animationDuration: `${1.5 + (i % 3)}s`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* MERKEZ PRESTİJ KARTI VE ARMA SAHNESİ */}
      <div className="relative z-10 w-full max-w-xl flex flex-col items-center text-center my-auto py-4">
        {/* Üst Bildirim Rozeti */}
        <div
          className={`mb-4 transition-all duration-700 ${
            phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'
          }`}
        >
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.22em] border backdrop-blur-md shadow-lg"
            style={{
              backgroundColor: 'rgba(12, 12, 18, 0.85)',
              borderColor: `${accentHex}66`,
              color: accentHex,
              boxShadow: `0 0 24px -4px ${accentHex}55`,
            }}
          >
            <Sparkles size={13} />
            {isRankPromotion ? 'Yeni Unvan Kademesi Açıldı' : 'Sinevia Kariyer Terfisi'}
            <Sparkles size={13} />
          </span>
        </div>

        {/* MERKEZ ARMA PODYUMU VE DÖNEN HALKALAR */}
        <div className="relative flex items-center justify-center w-60 h-60 sm:w-68 sm:h-68 mb-4">
          {/* 4. FAZ: Çarpma Şok Dalgası (Shockwave) */}
          {phase >= 3 && (
            <>
              <div
                className={`absolute rounded-full border-4 pointer-events-none transition-all duration-700 ease-out ${
                  phase >= 4 ? 'w-[26rem] h-[26rem] sm:w-[34rem] sm:h-[34rem] opacity-0' : 'w-40 h-40 opacity-90'
                }`}
                style={{ borderColor: accentHex }}
              />
              <div
                className={`absolute rounded-full border-2 pointer-events-none transition-all duration-1000 delay-100 ease-out ${
                  phase >= 4 ? 'w-[32rem] h-[32rem] sm:w-[42rem] sm:h-[42rem] opacity-0' : 'w-36 h-36 opacity-70'
                }`}
                style={{ borderColor: '#ffffff' }}
              />
            </>
          )}

          {/* Dış Dönen Taktiksel Astrolab / Kadran Halkası */}
          <svg
            viewBox="0 0 240 240"
            className={`absolute inset-0 w-full h-full pointer-events-none transition-all duration-1000 ${
              phase >= 2 ? 'opacity-100 scale-100 animate-[spin_40s_linear_infinite]' : 'opacity-0 scale-75'
            }`}
          >
            <circle
              cx="120"
              cy="120"
              r="112"
              fill="none"
              stroke={accentHex}
              strokeOpacity="0.28"
              strokeWidth="1.5"
              strokeDasharray="6 8"
            />
            <circle
              cx="120"
              cy="120"
              r="98"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.14"
              strokeWidth="1"
              strokeDasharray="24 12 4 12"
            />
            <polygon points="120,2 125,11 115,11" fill={accentHex} fillOpacity="0.8" />
            <polygon points="120,238 125,229 115,229" fill={accentHex} fillOpacity="0.8" />
            <polygon points="2,120 11,125 11,115" fill={accentHex} fillOpacity="0.8" />
            <polygon points="238,120 229,125 229,115" fill={accentHex} fillOpacity="0.8" />
          </svg>

          {/* 3. FAZ: Sahneye İnen 3 Katmanlı Özel Rütbe Arması */}
          <div
            className={`relative flex flex-col items-center justify-center transition-all duration-700 ${
              phase >= 3
                ? 'scale-100 opacity-100 translate-y-0 rotate-0'
                : 'scale-[2.4] opacity-0 -translate-y-24 rotate-6'
            }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          >
            {/* Arma Arka Çekirdek Parlaması */}
            <div
              className={`absolute w-40 h-40 rounded-full blur-2xl transition-opacity duration-500 ${
                phase >= 4 ? 'opacity-65 animate-pulse' : 'opacity-0'
              }`}
              style={{ backgroundColor: accentHex }}
            />

            {/* Koyu Kristal Madalyon Yuvası + 3 Katmanlı RankEmblem */}
            <div
              className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-full bg-gradient-to-b from-[#171722] via-[#0c0c14] to-[#07070c] flex items-center justify-center shadow-2xl"
              style={{
                border: `2.5px solid ${accentHex}`,
                boxShadow: `0 20px 60px -10px rgba(0,0,0,0.95), 0 0 45px -5px ${accentHex}66, inset 0 2px 12px rgba(255,255,255,0.2)`,
              }}
            >
              {/* İç Cam Yansıması */}
              <div className="absolute inset-2 rounded-full border border-white/10 pointer-events-none" />
              <div className="absolute top-0 inset-x-6 h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-full pointer-events-none" />

              {/* Özel 3 Katmanlı Rütbe Arması */}
              <RankEmblem rankIndex={currentRankIndex} size={126} />
            </div>

            {/* Arma Altı Lüks Seviye Plakası */}
            <div
              className="relative -mt-6 z-20 px-6 py-1.5 rounded-2xl border-2 flex items-baseline gap-2 shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #161622 0%, #09090f 100%)',
                borderColor: accentHex,
                boxShadow: `0 10px 25px rgba(0,0,0,0.9), 0 0 20px -4px ${accentHex}80`,
              }}
            >
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#a1a1aa]">
                SEVİYE
              </span>
              <span
                className="text-3xl sm:text-4xl font-black tracking-tight tabular-nums leading-none"
                style={{ color: '#FFF', textShadow: `0 0 18px ${accentHex}` }}
              >
                {newLevel}
              </span>
            </div>
          </div>
        </div>

        {/* 5. FAZ: Unvan Bilgisi, Terfi Vitrini ve Aksiyon Butonu */}
        <div
          className={`w-full flex flex-col items-center transition-all duration-700 ${
            phase >= 5 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'
          }`}
        >
          <h1
            className="text-3xl sm:text-5xl font-black text-[#ffffff] uppercase tracking-tight mb-1.5"
            style={{ textShadow: `0 6px 30px ${accentHex}66` }}
          >
            {isRankPromotion ? 'Yeni Unvana Terfi Ettin!' : 'Seviye Atladın!'}
          </h1>

          <p className="text-xs sm:text-sm text-[#d4d4d8] font-semibold max-w-md mx-auto mb-5 leading-relaxed">
            {currentRank.subtitle}
          </p>

          {/* UNVAN KARTI: Terfi Olduysa Eski ➔ Yeni Karşılaştırması, Olmadıysa Unvan İlerleme Vitrini */}
          <div
            className="w-full max-w-md rounded-2xl p-4 sm:p-5 border backdrop-blur-xl mb-6 text-left"
            style={{
              background: 'linear-gradient(145deg, rgba(20,20,30,0.9) 0%, rgba(10,10,16,0.95) 100%)',
              borderColor: 'rgba(255,255,255,0.12)',
              boxShadow: '0 20px 50px -20px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            {isRankPromotion ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[#fcd34d]">
                  <span className="flex items-center gap-1.5">
                    <Crown size={13} /> Rütbe Terfisi Gerçekleşti
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#fbbf24]/15 border border-[#fbbf24]/40">
                    SV.{newLevel} EŞİĞİ
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pt-1">
                  {/* Önceki Unvan */}
                  <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.07] rounded-xl p-2.5 opacity-70">
                    <RankEmblem rankIndex={Math.max(0, currentRankIndex - 1)} size={38} />
                    <div className="min-w-0">
                      <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#a1a1aa]">
                        Önceki
                      </div>
                      <div className="text-xs font-black text-[#e4e4e7] truncate">
                        {prevRank.title}
                      </div>
                    </div>
                  </div>

                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center border"
                    style={{
                      backgroundColor: `${accentHex}22`,
                      borderColor: `${accentHex}66`,
                      color: accentHex,
                    }}
                  >
                    <ArrowRight size={15} />
                  </div>

                  {/* Yeni Unvan */}
                  <div
                    className="flex items-center gap-2.5 rounded-xl p-2.5 border"
                    style={{
                      background: `linear-gradient(135deg, ${accentHex}22, rgba(255,255,255,0.03))`,
                      borderColor: `${accentHex}88`,
                    }}
                  >
                    <RankEmblem rankIndex={currentRankIndex} size={42} />
                    <div className="min-w-0">
                      <div
                        className="text-[9px] font-extrabold uppercase tracking-wider"
                        style={{ color: accentHex }}
                      >
                        Yeni Unvan
                      </div>
                      <div className="text-xs sm:text-sm font-black text-[#ffffff] truncate">
                        {currentRank.title}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <RankEmblem rankIndex={currentRankIndex} size={44} />
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#a1a1aa] flex items-center gap-1">
                        <Crown size={11} style={{ color: accentHex }} /> Aktif Ajan Unvanı
                      </div>
                      <div className="text-base sm:text-lg font-black text-[#ffffff] truncate">
                        {currentRank.title}
                      </div>
                    </div>
                  </div>

                  {nextRank ? (
                    <span className="text-[10px] font-extrabold tabular-nums px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[#e4e4e7] shrink-0">
                      Sonraki: Sv.{nextRank.minLevel}
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-[#fbbf24]/20 border border-[#fbbf24]/40 text-[#fcd34d] shrink-0">
                      Zirve Unvan
                    </span>
                  )}
                </div>

                {nextRank && (
                  <div className="space-y-1.5 pt-1 border-t border-white/[0.07]">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#a1a1aa]">
                      <span>
                        Sıradaki Unvan: <strong className="text-[#ffffff]">{nextRank.title}</strong>
                      </span>
                      <span className="tabular-nums font-black" style={{ color: accentHex }}>
                        {nextRank.minLevel - newLevel} Sv. Kaldı (%{rankProgressPct})
                      </span>
                    </div>
                    <div className="h-2 w-full bg-black/60 rounded-full overflow-hidden border border-white/10">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${currentRank.barGradient} transition-all duration-1000`}
                        style={{ width: `${rankProgressPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Devam Butonu */}
          <button
            type="button"
            onClick={onDismiss}
            className="group relative w-full max-w-xs py-4 px-8 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-[0.18em] text-[#ffffff] overflow-hidden transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] flex items-center justify-center gap-2 shadow-2xl"
            style={{
              background: `linear-gradient(135deg, ${accentHex} 0%, #e8384f 100%)`,
              boxShadow: `0 14px 35px -10px ${accentHex}99, inset 0 1px 0 rgba(255,255,255,0.4)`,
            }}
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/35 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-out" />
            <span className="relative z-10 flex items-center gap-2 drop-shadow">
              Yolculuğa Devam Et
              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}