import React, { useEffect, useState } from 'react';
import { ChevronRight, Star, Sparkles } from 'lucide-react';

export default function LevelUpModal({ 
  newLevel, 
  onDismiss 
}: { 
  newLevel: number; 
  onDismiss: () => void; 
}) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // Animasyonun zaman çizelgesi (Timeline)
    const t1 = setTimeout(() => setPhase(1), 50);    // 1. Faz: Arkaplan kararır, parçacıklar belirir
    const t2 = setTimeout(() => setPhase(2), 300);   // 2. Faz: Patlama ve Işık hüzmeleri (God Rays)
    const t3 = setTimeout(() => setPhase(3), 600);   // 3. Faz: Rozet ekrana çarpar
    const t4 = setTimeout(() => setPhase(4), 1400);  // 4. Faz: Yazılar ve Buton gelir

    return () => { 
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); 
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden font-sans">
      
      {/* 1. FAZ: Karanlık Arka Plan */}
      <div 
        className={`absolute inset-0 bg-ink-950/95 backdrop-blur-xl transition-opacity duration-1000 ease-in-out ${
          phase >= 1 ? 'opacity-100' : 'opacity-0'
        }`} 
        onClick={phase >= 4 ? onDismiss : undefined}
      />

      {/* 1. FAZ: Uçuşan Altın Parçacıklar */}
      {phase >= 1 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(30)].map((_, i) => {
            const size = Math.random() * 4 + 2;
            return (
              <div 
                key={i}
                className="absolute bg-gold-400 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.8)] animate-pulse"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  opacity: Math.random() * 0.5 + 0.2,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${Math.random() * 3 + 2}s`
                }}
              />
            );
          })}
        </div>
      )}

      {/* 2. FAZ: Merkezdeki Dev Işık Patlaması (Glow) */}
      <div 
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] md:w-[50rem] md:h-[50rem] bg-gold-500/20 blur-[100px] rounded-full pointer-events-none transition-all duration-1000 ease-out ${
          phase >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
        }`} 
      />

      {/* 2. FAZ: Dönen Sinematik Işık Hüzmeleri (God Rays) */}
      <div 
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vw] md:w-[70rem] md:h-[70rem] pointer-events-none transition-all duration-1000 ease-in-out ${
          phase >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        }`}
      >
        <div 
          className="w-full h-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(234,179,8,0.15)_15deg,transparent_30deg,rgba(234,179,8,0.15)_45deg,transparent_60deg,rgba(234,179,8,0.15)_75deg,transparent_90deg,rgba(234,179,8,0.15)_105deg,transparent_120deg,rgba(234,179,8,0.15)_135deg,transparent_150deg,rgba(234,179,8,0.15)_165deg,transparent_180deg,rgba(234,179,8,0.15)_195deg,transparent_210deg,rgba(234,179,8,0.15)_225deg,transparent_240deg,rgba(234,179,8,0.15)_255deg,transparent_270deg,rgba(234,179,8,0.15)_285deg,transparent_300deg,rgba(234,179,8,0.15)_315deg,transparent_330deg,rgba(234,179,8,0.15)_345deg,transparent_360deg)] animate-[spin_15s_linear_infinite]"
          style={{ 
            maskImage: 'radial-gradient(circle, black 10%, transparent 60%)', 
            WebkitMaskImage: 'radial-gradient(circle, black 10%, transparent 60%)' 
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center w-full px-4">
        
        {/* 3. FAZ: Ekrana Çarpan Rozet (Bounce In) */}
        <div 
          className={`relative flex items-center justify-center mb-8 transition-all duration-[800ms] cubic-bezier(0.34, 1.56, 0.64, 1) ${
            phase >= 3 ? 'scale-100 opacity-100 translate-y-0' : 'scale-[2.5] opacity-0 -translate-y-32'
          }`}
        >
           <div className="absolute inset-0 bg-gold-400 blur-3xl opacity-40 animate-pulse" />
           <div className="relative w-44 h-44 md:w-52 md:h-52 rounded-full bg-gradient-to-b from-gold-300 via-gold-500 to-yellow-700 p-1.5 shadow-[0_0_50px_rgba(234,179,8,0.6)]">
             <div className="w-full h-full rounded-full bg-ink-950 flex flex-col items-center justify-center shadow-inner relative overflow-hidden border-2 border-gold-900/80">
                
                {/* Rozet İçi Parlama */}
                <div className="absolute inset-0 bg-gradient-to-br from-gold-400/20 to-transparent" />
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-full" />

                <Star className="absolute top-5 text-gold-500/50" size={32} />
                
                <span className="text-gold-500 font-bold tracking-[0.4em] text-xs uppercase mb-1 mt-6">
                  Seviye
                </span>
                <span className="text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gold-200 drop-shadow-md leading-none">
                  {newLevel}
                </span>
                
                <Sparkles className="absolute bottom-5 text-gold-400/60" size={24} />
             </div>
           </div>
        </div>

        {/* 4. FAZ: Epik Yazılar */}
        <div 
          className={`text-center transition-all duration-1000 transform ${
            phase >= 4 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
          }`}
        >
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-[0.2em] mb-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
            Seviye Atladın!
          </h1>
          <p className="text-lg md:text-xl text-gold-200/90 font-medium max-w-sm mx-auto px-4 drop-shadow-md">
            Sinema evrenindeki vizyonun genişliyor. İzlemeye ve keşfetmeye devam et.
          </p>
        </div>

        {/* 4. FAZ: Devam Butonu */}
        <div 
          className={`mt-12 w-full max-w-xs transition-all duration-700 delay-300 transform ${
            phase >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <button 
            onClick={onDismiss}
            className="group relative w-full px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl font-bold text-white uppercase tracking-widest overflow-hidden transition-all flex items-center justify-center gap-3 backdrop-blur-md shadow-2xl hover:shadow-gold-500/20 hover:border-gold-400/50"
          >
            {/* Buton Üstü Işık Geçişi */}
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-out" />
            Devam Et
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform text-gold-400" />
          </button>
        </div>

      </div>
    </div>
  );
}