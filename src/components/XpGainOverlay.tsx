import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { levelFromXp } from '../lib/xp';

export default function XpGainOverlay() {
  const { xpGainData } = useApp();
  const [visible, setVisible] = useState(false);
  const [displayXp, setDisplayXp] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);
  const [showPlus, setShowPlus] = useState(false);

  useEffect(() => {
    if (xpGainData) {
      setVisible(true);
      setShowPlus(false);
      
      const oldLvl = levelFromXp(xpGainData.oldTotal);
      const newLvl = levelFromXp(xpGainData.newTotal);
      
      setProgressWidth(oldLvl.progress);
      setDisplayXp(xpGainData.oldTotal);

      const timer1 = setTimeout(() => setShowPlus(true), 300);

      const timer2 = setTimeout(() => {
        setProgressWidth(newLvl.progress);
        
        let start = xpGainData.oldTotal;
        const end = xpGainData.newTotal;
        const duration = 1200; 
        const startTime = performance.now();

        const updateNum = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const prog = Math.min(elapsed / duration, 1);
          const easeOut = 1 - Math.pow(1 - prog, 3);
          setDisplayXp(Math.floor(start + (end - start) * easeOut));
          
          if (prog < 1) requestAnimationFrame(updateNum);
          else setDisplayXp(end);
        };
        requestAnimationFrame(updateNum);
      }, 800);

      const hideTimer = setTimeout(() => setVisible(false), 5500);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(hideTimer);
      };
    }
  }, [xpGainData]);

  if (!xpGainData) return null;

  const currentLevelData = levelFromXp(displayXp);

  return (
    <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[100] transition-all duration-700 pointer-events-none ${visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-8 opacity-0 scale-95'}`}>
      <div className="bg-ink-950/90 backdrop-blur-md border border-gold-500/40 shadow-[0_8px_32px_rgba(234,179,8,0.2)] rounded-2xl p-4 flex flex-col items-center min-w-[340px]">
        
        <div className="flex items-center gap-3 mb-3 w-full border-b border-white/5 pb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-lg shadow-gold-500/30">
            <Zap size={16} className="text-gold-950 fill-current" />
          </div>
          <span className="font-bold text-lg text-ink-50 tracking-wide">Seviye {currentLevelData.level}</span>
        </div>

        {/* BİLGİ ALANI: Mevcut XP ve Eklenen XP Yan Yana */}
        <div className="flex items-baseline justify-between w-full mb-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gold-400 drop-shadow-sm">{displayXp}</span>
            <span className="text-sm font-bold text-ink-500">XP</span>
            
            {/* YENİLİK: Eklenen XP Miktarı Animasyonla Belirir */}
            <span className={`text-sm font-black text-green-400 transition-all duration-500 ${showPlus ? 'opacity-100 translate-y-0 animate-pulse' : 'opacity-0 translate-y-2'}`}>
              +{xpGainData.gained} XP
            </span>
          </div>
          
          <div className="text-xs font-semibold text-ink-500">
            Hedef: {currentLevelData.nextLevelXp}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-4 bg-ink-900 shadow-inner rounded-full overflow-hidden relative border border-ink-800">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-gold-600 via-gold-400 to-yellow-300 transition-all duration-[1200ms] ease-out rounded-full"
            style={{ width: `${progressWidth}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
          </div>
        </div>
        
      </div>
    </div>
  );
}