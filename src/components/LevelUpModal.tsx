import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Star, Sparkles, Trophy, Zap } from 'lucide-react';

export default function LevelUpModal({ 
  newLevel, 
  onDismiss 
}: { 
  newLevel: number; 
  onDismiss: () => void; 
}) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    setMounted(true);
    // Sinematik Animasyon Zaman Çizelgesi
    const t1 = setTimeout(() => setPhase(1), 50);    // Faz 1: Her şey kararır, yeni bir boyuta (pencereye) geçilir
    const t2 = setTimeout(() => setPhase(2), 400);   // Faz 2: Arkadan dönen ilahi ışıklar (God Rays) belirir
    const t3 = setTimeout(() => setPhase(3), 800);   // Faz 3: Rozet devasa bir hızla ekrana çarpar
    const t4 = setTimeout(() => setPhase(4), 950);   // Faz 4: Çarpma anında şok dalgası (Shockwave) ve parçacıklar patlar
    const t5 = setTimeout(() => setPhase(5), 1800);  // Faz 5: Tebrik yazıları ve devam butonu gelir

    return () => { 
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5);
    };
  }, []);

  // SSR (Next.js) uyumluluğu veya yüklenmeden önce render engelleme
  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden font-sans select-none">
      
      {/* 1. FAZ: Derin Karanlık Arka Plan (Uygulamayı tamamen gizler, yeni pencere hissi verir) */}
      <div 
        className={`absolute inset-0 bg-ink-950/95 backdrop-blur-2xl transition-all duration-1000 ease-in-out ${
          phase >= 1 ? 'opacity-100' : 'opacity-0'
        }`} 
        onClick={phase >= 5 ? onDismiss : undefined}
      >
        {/* Merkezdeki Dev Işık Patlaması */}
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] md:w-[60rem] md:h-[60rem] bg-gradient-to-tr from-gold-600/30 to-amber-500/10 blur-[120px] rounded-full pointer-events-none transition-all duration-1000 ease-out ${
            phase >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`} 
        />
      </div>

      {/* 2. FAZ: Dönen Sinematik Işık Hüzmeleri (God Rays) */}
      <div 
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200vw] h-[200vw] md:w-[90rem] md:h-[90rem] pointer-events-none transition-all duration-1000 ease-in-out ${
          phase >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        }`}
      >
        <div 
          className="w-full h-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(250,204,21,0.15)_15deg,transparent_30deg,rgba(250,204,21,0.15)_45deg,transparent_60deg,rgba(250,204,21,0.15)_75deg,transparent_90deg,rgba(250,204,21,0.15)_105deg,transparent_120deg,rgba(250,204,21,0.15)_135deg,transparent_150deg,rgba(250,204,21,0.15)_165deg,transparent_180deg,rgba(250,204,21,0.15)_195deg,transparent_210deg,rgba(250,204,21,0.15)_225deg,transparent_240deg,rgba(250,204,21,0.15)_255deg,transparent_270deg,rgba(250,204,21,0.15)_285deg,transparent_300deg,rgba(250,204,21,0.15)_315deg,transparent_330deg,rgba(250,204,21,0.15)_345deg,transparent_360deg)] animate-[spin_20s_linear_infinite]"
          style={{ 
            maskImage: 'radial-gradient(circle, black 10%, transparent 65%)', 
            WebkitMaskImage: 'radial-gradient(circle, black 10%, transparent 65%)' 
          }}
        />
      </div>

      {/* 4. FAZ: Uçuşan Ortam Parçacıkları */}
      {phase >= 4 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(40)].map((_, i) => {
            const size = Math.random() * 4 + 2;
            return (
              <div 
                key={i}
                className="absolute bg-gold-400 rounded-full shadow-[0_0_12px_rgba(250,204,21,0.9)] animate-pulse"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  opacity: Math.random() * 0.6 + 0.2,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${Math.random() * 2 + 1.5}s`,
                  transform: `scale(${phase >= 4 ? 1 : 0})`,
                  transition: 'transform 1s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              />
            );
          })}
        </div>
      )}

      {/* MERKEZ İÇERİK (Rozet ve Yazılar) */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full px-4">
        
        <div className="relative flex items-center justify-center mb-8">
          
          {/* 4. FAZ: Rozet Çarptığında Çıkan Şok Dalgası (Shockwave) */}
          <div 
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[6px] border-gold-400/80 transition-all duration-700 ease-out pointer-events-none ${
              phase >= 4 ? 'w-[30rem] h-[30rem] md:w-[40rem] md:h-[40rem] opacity-0' : 'w-44 h-44 opacity-100 hidden'
            }`}
            style={{ display: phase >= 3 ? 'block' : 'none' }}
          />

          {/* 3. FAZ: Ekrana Çarpan Rozet (Bounce In) */}
          <div 
            className={`relative flex items-center justify-center transition-all duration-[800ms] ${
              phase >= 3 ? 'scale-100 opacity-100 translate-y-0 rotate-0' : 'scale-[3] opacity-0 -translate-y-40 rotate-12'
            }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          >
            {/* Rozet Arka Parlaması */}
            <div className={`absolute inset-0 bg-gold-400 blur-3xl transition-opacity duration-500 ${phase >= 4 ? 'opacity-50 animate-pulse' : 'opacity-0'}`} />
             
            {/* Rozet Gövdesi */}
            <div className="relative w-48 h-48 md:w-56 md:h-56 rounded-full bg-gradient-to-b from-gold-300 via-gold-500 to-amber-700 p-2 shadow-[0_0_50px_rgba(250,204,21,0.6)]">
              <div className="w-full h-full rounded-full bg-ink-950 flex flex-col items-center justify-center shadow-inner relative overflow-hidden border-[3px] border-gold-900/80">
                
                {/* Rozet İçi Cam Parlaması (Glassmorphism) */}
                <div className="absolute inset-0 bg-gradient-to-br from-gold-400/20 to-transparent" />
                <div className="absolute top-0 left-0 w-full h-[45%] bg-gradient-to-b from-white/15 to-transparent rounded-t-full" />

                {/* İkonlar */}
                <Trophy className="absolute top-4 text-gold-500/40" size={32} />
                <Zap className="absolute bottom-5 text-gold-400/50" size={24} />
                <Star className="absolute left-4 top-1/2 -translate-y-1/2 text-gold-500/20" size={20} />
                <Star className="absolute right-4 top-1/2 -translate-y-1/2 text-gold-500/20" size={20} />
                
                <span className="text-gold-500 font-black tracking-[0.3em] text-xs md:text-sm uppercase mb-1 mt-6 z-10 drop-shadow-md">
                  Seviye
                </span>
                <span className="text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-gold-100 to-gold-400 drop-shadow-2xl leading-none z-10">
                  {newLevel}
                </span>
             </div>
            </div>
          </div>
        </div>

        {/* 5. FAZ: Epik Yazılar */}
        <div 
          className={`text-center transition-all duration-1000 transform ${
            phase >= 5 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
          }`}
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white uppercase tracking-[0.15em] mb-4 drop-shadow-[0_0_25px_rgba(250,204,21,0.5)]">
            Seviye Atladın!
          </h1>
          <p className="text-base md:text-lg text-gold-200/90 font-medium max-w-md mx-auto px-4 drop-shadow-md leading-relaxed">
            Sinema evrenindeki vizyonun genişliyor. Ajan kimliğin güçlendi, yeni yapımlar keşfetmeye devam et.
          </p>
        </div>

        {/* 5. FAZ: Devam Butonu */}
        <div 
          className={`mt-10 w-full max-w-xs transition-all duration-700 delay-300 transform ${
            phase >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <button 
            onClick={onDismiss}
            className="group relative w-full px-8 py-4 bg-ink-900/50 hover:bg-gold-500 border border-gold-500/40 hover:border-gold-400 rounded-2xl font-black text-gold-400 hover:text-ink-950 uppercase tracking-widest overflow-hidden transition-all duration-300 flex items-center justify-center gap-3 backdrop-blur-md shadow-[0_0_30px_rgba(250,204,21,0.15)] hover:shadow-[0_0_40px_rgba(250,204,21,0.4)]"
          >
            {/* Buton İçi Parlama (Shine Effect) */}
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-out" />
            <span className="relative z-10 flex items-center gap-2">
              Devam Et <ChevronRight size={22} className="group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </div>

      </div>
    </div>
  );

  // createPortal, modalı DOM ağacının en köküne (document.body) yerleştirir.
  // Bu, diğer hiçbir bileşenin (z-index, overflow) bu ekranı bozmasını veya altında bırakmasını engeller.
  return createPortal(modalContent, document.body);
}