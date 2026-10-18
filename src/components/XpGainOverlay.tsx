import { useEffect, useState, useMemo } from 'react';
import { Crown, Sparkles, Zap, ArrowUpRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { levelFromXp } from '../lib/xp';
import { RANK_TIERS, RankEmblem } from '../lib/rankTiers';

export default function XpGainOverlay() {
  const { xpGainData } = useApp();
  const [animatedXp, setAnimatedXp] = useState<number>(xpGainData?.oldTotal ?? 0);
  const [isExiting, setIsExiting] = useState(false);
  const [leveledUpMidAnimation, setLeveledUpMidAnimation] = useState(false);

  useEffect(() => {
    if (!xpGainData) return;

    setIsExiting(false);
    setLeveledUpMidAnimation(false);
    setAnimatedXp(xpGainData.oldTotal);

    const startLevel = levelFromXp(xpGainData.oldTotal).level;
    const startTime = performance.now();
    const delay = 240; // Kapsül yerine oturduktan sonra akışı başlat
    const duration = 2000; // 2 saniye boyunca akıcı sayaç ve bar dolumu

    let rafId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime - delay;
      if (elapsed < 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min(1, elapsed / duration);
      // Pürüzsüz frenleme (easeOutQuart)
      const easeOut = 1 - Math.pow(1 - progress, 4);
      const currentVal = Math.round(
        xpGainData.oldTotal + (xpGainData.newTotal - xpGainData.oldTotal) * easeOut
      );

      setAnimatedXp(currentVal);

      if (levelFromXp(currentVal).level > startLevel) {
        setLeveledUpMidAnimation(true);
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    // Sayaç 240+2000=2240ms'de biter → ~1sn dinlenme, sonra 380ms çıkış (3200+380=3580)
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 3200);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(exitTimer);
    };
  }, [xpGainData]);

  const currentLvlData = useMemo(() => levelFromXp(animatedXp), [animatedXp]);
  const oldLvlData = useMemo(
    () => levelFromXp(xpGainData?.oldTotal ?? 0),
    [xpGainData?.oldTotal]
  );

  // Mevcut seviyeye göre rütbe ve 3 katmanlı arma bilgisini çöz
  const { rankIndex, userRank } = useMemo(() => {
    let idx = 0;
    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
      if (currentLvlData.level >= RANK_TIERS[i].minLevel) {
        idx = i;
        break;
      }
    }
    return { rankIndex: idx, userRank: RANK_TIERS[idx] };
  }, [currentLvlData.level]);

  if (!xpGainData) return null;

  const baseProgress =
    currentLvlData.level === oldLvlData.level ? Math.max(0, oldLvlData.progress) : 0;
  const activeProgress = Math.max(3, Math.min(100, currentLvlData.progress));
  const remainingXp = Math.max(0, currentLvlData.nextLevelXp - currentLvlData.currentLevelXp);

  // Rütbe rengi (Seviye atlandığında saf altın vurguya döner)
  const accentColor = leveledUpMidAnimation ? '#fbbf24' : userRank.strokeColor || '#e8384f';

  // Sol arma etrafındaki mikro dairesel ilerleme halkası
  const ringRadius = 31;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (activeProgress / 100) * ringCircumference;

  return (
    <div
      className="fixed top-14 md:top-6 inset-x-0 z-[85] flex justify-center px-3.5 sm:px-4 pointer-events-none select-none"
      style={{ fontFamily: 'inherit' }}
    >
      <style>{`
        @keyframes snv-xp-enter {
          0% { opacity: 0; transform: translateY(-42px) scale(0.92); filter: blur(6px); }
          65% { opacity: 1; transform: translateY(4px) scale(1.015); filter: blur(0px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px); }
        }
        @keyframes snv-xp-exit {
          0% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px); }
          100% { opacity: 0; transform: translateY(-28px) scale(0.95); filter: blur(4px); }
        }
        @keyframes snv-xp-sheen {
          0% { transform: translateX(-120%) skewX(-20deg); }
          100% { transform: translateX(240%) skewX(-20deg); }
        }
        .snv-xp-in { animation: snv-xp-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .snv-xp-out { animation: snv-xp-exit 0.38s cubic-bezier(0.4, 0, 1, 1) forwards; }
        .snv-xp-shimmer { animation: snv-xp-sheen 1.8s infinite ease-in-out; }
      `}</style>

      <div
        className={`relative w-full max-w-[460px] rounded-[24px] p-[1px] overflow-hidden transition-shadow duration-500 ${
          isExiting ? 'snv-xp-out' : 'snv-xp-in'
        }`}
        style={{
          background: `linear-gradient(135deg, ${accentColor}99 0%, rgba(255,255,255,0.14) 45%, rgba(232,56,79,0.55) 100%)`,
          boxShadow: `0 28px 70px -16px rgba(0,0,0,0.95), 0 0 38px -10px ${accentColor}66`,
        }}
      >
        {/* İç Obsidyen Cam Gövde */}
        <div className="relative bg-[#09090f]/95 backdrop-blur-2xl rounded-[23px] px-4 py-3.5 sm:px-5 sm:py-4 overflow-hidden">
          {/* Üst İnce Lazer Işık Çizgisi */}
          <div
            className="absolute top-0 left-8 right-8 h-[1.5px] opacity-85 pointer-events-none"
            style={{
              background: `linear-gradient(90deg, transparent, ${accentColor}, #ffffff, ${accentColor}, transparent)`,
            }}
          />

          {/* Arka Plan Rütbe Atmosfer Işıması */}
          <div
            className="absolute -top-16 -left-10 w-44 h-44 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-500"
            style={{ backgroundColor: accentColor }}
          />
          <div
            className="absolute -bottom-16 -right-10 w-44 h-44 rounded-full blur-3xl opacity-15 pointer-events-none"
            style={{ backgroundColor: '#e8384f' }}
          />

          {/* İnce Taktiksel Nokta Dokusu */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)',
              backgroundSize: '18px 18px',
            }}
          />

          <div className="relative z-10 flex items-center gap-3.5 sm:gap-4">
            {/* SOL: Dairesel İlerleme Halkalı 3 Katmanlı Rütbe Arması */}
            <div className="relative w-[68px] h-[68px] flex-shrink-0 flex items-center justify-center">
              <svg
                className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                viewBox="0 0 68 68"
              >
                <circle
                  cx="34"
                  cy="34"
                  r={ringRadius}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="34"
                  cy="34"
                  r={ringRadius}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth="2.5"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  className="transition-all duration-100 ease-out"
                />
              </svg>

              {/* Koyu Kristal Arma Podyumu */}
              <div className="w-[54px] h-[54px] rounded-full bg-gradient-to-b from-[#161622] to-[#08080d] border border-white/15 flex items-center justify-center shadow-inner">
                <RankEmblem rankIndex={rankIndex} size={38} />
              </div>

              {/* Alt Seviye Rozeti */}
              <span
                className="absolute -bottom-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest text-[#ffffff] border shadow-md tabular-nums"
                style={{
                  background: 'linear-gradient(135deg, #1b1b28 0%, #09090f 100%)',
                  borderColor: `${accentColor}88`,
                }}
              >
                SV.{currentLvlData.level}
              </span>

              {/* Seviye Atlandıysa Sağ Üst Terfi Kıvılcımı */}
              {leveledUpMidAnimation && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-[#fbbf24] to-[#fde047] text-[#09090f] text-[8.5px] font-black uppercase tracking-wider shadow-lg flex items-center gap-0.5 animate-bounce">
                  <ArrowUpRight size={10} strokeWidth={3} /> TERFİ
                </span>
              )}
            </div>

            {/* SAĞ: Üst Bilgiler, Lazer Bar ve Alt Telemetri */}
            <div className="flex-1 min-w-0">
              {/* Üst Satır: Rütbe/Durum Başlığı & Kazanılan XP Kapsülü */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {leveledUpMidAnimation ? (
                      <Crown size={12} className="text-[#fcd34d] shrink-0" />
                    ) : (
                      <Sparkles size={12} style={{ color: accentColor }} className="shrink-0" />
                    )}
                    <span
                      className="text-[10px] font-black uppercase tracking-[0.16em] truncate"
                      style={{ color: leveledUpMidAnimation ? '#fde047' : accentColor }}
                    >
                      {leveledUpMidAnimation ? 'Seviye Terfisi' : userRank.title}
                    </span>
                  </div>
                  <div className="text-xs sm:text-[13px] font-black text-[#ffffff] tracking-tight truncate mt-0.5">
                    {leveledUpMidAnimation
                      ? `Seviye ${currentLvlData.level} Kilidi Açıldı!`
                      : 'Deneyim Puanı İşlendi'}
                  </div>
                </div>

                {/* Kazanılan +XP Mücevher Kapsülü */}
                <div
                  className="relative overflow-hidden inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black text-[#ffffff] shrink-0 border shadow-lg tabular-nums"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}33 0%, rgba(232,56,79,0.28) 100%)`,
                    borderColor: `${accentColor}88`,
                    boxShadow: `0 6px 20px -6px ${accentColor}77, inset 0 1px 0 rgba(255,255,255,0.25)`,
                  }}
                >
                  <Zap size={12} className="fill-current" style={{ color: accentColor }} />
                  <span>+{xpGainData.gained.toLocaleString('tr-TR')} XP</span>
                </div>
              </div>

              {/* Orta Satır: Çift Katmanlı Hassas Lazer İlerleme Çubuğu */}
              <div className="relative h-2.5 w-full bg-[#12121c] rounded-full overflow-hidden border border-white/10 p-[1px] shadow-inner">
                {/* Önceki XP İzi */}
                {baseProgress > 0 && (
                  <div
                    className="absolute inset-y-[1px] left-[1px] rounded-full opacity-30"
                    style={{
                      width: `${baseProgress}%`,
                      backgroundColor: accentColor,
                    }}
                  />
                )}

                {/* Yeni Dolmakta Olan Canlı XP Barı */}
                <div
                  className={`relative h-full rounded-full bg-gradient-to-r ${userRank.barGradient} transition-all duration-75 ease-out overflow-hidden`}
                  style={{
                    width: `${activeProgress}%`,
                    boxShadow: `0 0 14px ${accentColor}`,
                  }}
                >
                  <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent snv-xp-shimmer" />
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full blur-[0.5px] shadow-[0_0_10px_#fff]" />
                </div>
              </div>

              {/* Alt Satır: Canlı Sayaç, Kalan XP ve Yüzde */}
              <div className="flex items-center justify-between gap-2 mt-2 text-[10.5px] font-bold">
                <div className="flex items-baseline gap-1 tabular-nums">
                  <span className="text-[#ffffff] font-black text-xs">
                    {animatedXp.toLocaleString('tr-TR')}
                  </span>
                  <span className="text-[#71717a] text-[10px] font-extrabold uppercase tracking-wider">
                    Toplam XP
                  </span>
                </div>

                <div className="flex items-center gap-2 tabular-nums">
                  <span className="text-[#a1a1aa] text-[10px]">
                    Sv.{currentLvlData.level + 1} için{' '}
                    <strong className="text-[#e4e4e7] font-extrabold">
                      {remainingXp.toLocaleString('tr-TR')} XP
                    </strong>
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded-md bg-white/[0.05] border border-white/10 font-black text-[10px]"
                    style={{ color: accentColor }}
                  >
                    %{Math.floor(activeProgress)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}