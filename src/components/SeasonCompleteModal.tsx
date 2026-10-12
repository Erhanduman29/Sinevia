import { useEffect, useState } from 'react';
import { Trophy, PartyPopper } from 'lucide-react';

interface Props {
  seriesTitle: string;
  season: number;
  onDismiss: () => void;
}

export default function SeasonCompleteModal({ seriesTitle, season, onDismiss }: Props) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 50);
    return () => clearTimeout(t1);
  }, []);

  const handleDismiss = () => {
    setPhase('exit');
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md cursor-pointer"
      onClick={handleDismiss}
    >
      <div
        className={`transition-all duration-400 ${
          phase === 'show' ? 'scale-100 opacity-100' : phase === 'enter' ? 'scale-50 opacity-0' : 'scale-110 opacity-0'
        }`}
      >
        <div className="relative flex flex-col items-center gap-5 px-8">
          {/* Confetti */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-sm animate-bounce"
              style={{
                width: `${4 + Math.random() * 8}px`,
                height: `${4 + Math.random() * 8}px`,
                left: `${Math.random() * 400 - 200}px`,
                top: `${Math.random() * 300 - 150}px`,
                backgroundColor: ['#fbbf24', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#a78bfa'][i % 6],
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${0.8 + Math.random() * 0.6}s`,
              }}
            />
          ))}

          <div className="relative flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/50 border-4 border-amber-300">
              <Trophy size={44} className="text-amber-950" />
            </div>
            <div className="text-amber-400 text-sm font-semibold uppercase tracking-widest flex items-center gap-2">
              <PartyPopper size={16} /> Sezon Tamamlandı
            </div>
            <div className="text-2xl font-bold text-ink-100 text-center">
              {seriesTitle}
            </div>
            <div className="text-lg text-ink-300">
              {season}. Sezon tamamlandı!
            </div>
            <button
              onClick={handleDismiss}
              className="mt-2 px-6 py-2.5 bg-ink-800 hover:bg-ink-700 text-ink-200 rounded-lg font-medium transition-colors border border-ink-700"
            >
              Harika!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
