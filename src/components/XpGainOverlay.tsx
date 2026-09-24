import { useEffect, useState } from 'react';
import { Crown, Sparkles, Zap, Star, TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { levelFromXp } from '../lib/xp';

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
    const delay = 250; // Kart üstten yerine oturduktan sonra saymaya başla
    const duration = 1800; // 1.8 saniye boyunca bar dolsun ve sayılar aksın

    let rafId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime - delay;
      if (elapsed < 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min(1, elapsed / duration);
      // Yumuşak frenleme (easeOutQuart) eğrisi
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

    // 3500ms'lik toplam sürenin 3100. milisaniyesinde yukarı doğru çıkış animasyonunu başlat
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 3100);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(exitTimer);
    };
  }, [xpGainData]);

  if (!xpGainData) return null;

  const currentLvlData = levelFromXp(animatedXp);
  const oldLvlData = levelFromXp(xpGainData.oldTotal);

  const baseProgress =
    currentLvlData.level === oldLvlData.level ? Math.max(0, oldLvlData.progress) : 0;
  const activeProgress = Math.max(2, Math.min(100, currentLvlData.progress));

  return (
    <div className="fixed top-16 md:top-6 inset-x-0 z-[85] flex justify-center px-4 pointer-events-none">
      <style>{`
        @keyframes xp-slide-down-in {
          0% { opacity: 0; transform: translateY(-50px) scale(0.85); }
          60% { opacity: 1; transform: translateY(6px) scale(1.03); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes xp-slide-up-out {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-35px) scale(0.92); }
        }
        @keyframes xp-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes badge-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-3px) rotate(2deg); }
        }
        .animate-xp-in { animation: xp-slide-down-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-xp-out { animation: xp-slide-up-out 0.35s ease-in forwards; }
        .animate-xp-shimmer { animation: xp-shimmer 1.6s infinite linear; }
        .animate-badge-float { animation: badge-float 2.5s ease-in-out infinite; }
      `}</style>

      <div
        className={`relative w-full max-w-md rounded-3xl p-[1.5px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden ${
          isExiting ? 'animate-xp-out' : 'animate-xp-in'
        }`}
        style={{
          background: 'linear-gradient(135deg, var(--color-1, #f59e0b), var(--color-2, #0ea5e9), var(--color-3, #8b5cf6))',
        }}
      >
        {/* Dış Ortam Işıması */}
        <div
          className="absolute -inset-6 blur-2xl opacity-40 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 50%, var(--color-1, #f59e0b), transparent 70%)',
          }}
        />

        {/* Ana Cam (Glassmorphism) Kart Gövdesi */}
        <div className="relative bg-ink-950/95 backdrop-blur-2xl rounded-[22px] p-4 sm:p-5 overflow-hidden">
          
          {/* Arka Plan Dekoratif Işık Topları */}
          <div
            className="absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl opacity-25 pointer-events-none"
            style={{ backgroundColor: 'var(--color-1, #f59e0b)' }}
          />
          <div
            className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ backgroundColor: 'var(--color-2, #0ea5e9)' }}
          />

          <div className="relative z-10 flex items-center gap-4">
            
            {/* SOL: 3B Seviye Arması */}
            <div className="relative flex-shrink-0 animate-badge-float">
              <div
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl p-0.5 shadow-lg flex items-center justify-center relative"
                style={{
                  background: 'linear-gradient(135deg, var(--color-1, #f59e0b), var(--color-2, #0ea5e9))',
                }}
              >
                <div className="w-full h-full bg-ink-950 rounded-[14px] flex flex-col items-center justify-center relative overflow-hidden">
                  <Crown size={18} className="text-gold-400 mb-0.5 drop-shadow" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-ink-400 leading-none">
                    LVL
                  </span>
                  <span className="text-base sm:text-lg font-black text-ink-50 leading-tight">
                    {currentLvlData.level}
                  </span>
                </div>
              </div>

              {/* Seviye Atlandıysa Parlayan Küçük Yıldız Rozeti */}
              {leveledUpMidAnimation && (
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-gold-500 to-amber-400 text-ink-950 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-0.5 animate-bounce">
                  <Star size={9} className="fill-current" /> UP!
                </div>
              )}
            </div>

            {/* SAĞ: Başlık, Kazanılan XP Rozeti ve İlerleme Barı */}
            <div className="flex-1 min-w-0">
              
              {/* Üst Satır: Başlık & +XP Hapı */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-gold-400 animate-spin" style={{ animationDuration: '4s' }} />
                  <span className="text-xs font-black uppercase tracking-wider text-ink-100">
                    {leveledUpMidAnimation ? 'Seviye Yükseldi!' : 'Deneyim Kazanıldı'}
                  </span>
                </div>

                {/* Gösterişli +XP Rozeti */}
                <div
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black text-white shadow-lg transform scale-105"
                  style={{
                    background: 'linear-gradient(90deg, var(--color-1, #f59e0b), var(--color-2, #0ea5e9))',
                    boxShadow: '0 0 15px var(--blob-1, rgba(245,158,11,0.4))',
                  }}
                >
                  <Zap size={12} className="fill-current" />
                  <span>+{xpGainData.gained} XP</span>
                </div>
              </div>

              {/* Orta Satır: Lazer Uçlu Çok Katmanlı XP Barı */}
              <div className="relative h-3.5 w-full bg-ink-900 rounded-full overflow-hidden border border-ink-700/80 shadow-inner p-0.5">
                
                {/* Önceki XP İlerlemesi (Sabit Alt Katman) */}
                {baseProgress > 0 && (
                  <div
                    className="absolute inset-y-0.5 left-0.5 rounded-full opacity-35"
                    style={{
                      width: `${baseProgress}%`,
                      backgroundColor: 'var(--color-1, #f59e0b)',
                    }}
                  />
                )}

                {/* Yeni Dolmakta Olan Canlı XP Katmanı */}
                <div
                  className="relative h-full rounded-full transition-all duration-75 ease-out overflow-hidden"
                  style={{
                    width: `${activeProgress}%`,
                    background: 'linear-gradient(90deg, var(--color-1, #f59e0b), var(--color-2, #0ea5e9))',
                    boxShadow: '0 0 12px var(--color-1, #f59e0b)',
                  }}
                >
                  {/* Akan Işık Dalgası (Shimmer) */}
                  <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-xp-shimmer" />
                  
                  {/* Barın Ucundaki Parlak Lazer Noktası */}
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full blur-[1px] shadow-[0_0_8px_#fff]" />
                </div>
              </div>

              {/* Alt Satır: Canlı Sayı Sayacı ve Yüzde */}
              <div className="flex items-center justify-between mt-2 text-[11px] font-bold">
                <div className="flex items-center gap-1 text-ink-300 font-mono">
                  <TrendingUp size={12} className="text-gold-400" />
                  <span className="text-ink-50 font-black">{animatedXp.toLocaleString('tr-TR')}</span>
                  <span className="text-ink-500">XP</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-ink-400">
                    Sonraki: <strong className="text-ink-200">{Math.max(0, currentLvlData.nextLevelXp - currentLvlData.currentLevelXp).toLocaleString('tr-TR')} XP</strong>
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-ink-800 text-gold-400 font-black text-[10px] border border-ink-700">
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