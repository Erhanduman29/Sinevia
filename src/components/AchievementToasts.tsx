import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { DISPLAY_DURATION_MS } from '../context/AppContext';
import type { AchievementToastItem } from '../context/AppContext';
import { TIER_COLORS } from '../lib/achievements';

export default function AchievementToasts({ toasts }: { toasts: AchievementToastItem[] }) {
  return (
    <div className="fixed bottom-4 right-4 z-[250] flex flex-col gap-3 items-end pointer-events-none">
      {toasts.map((t) => (
        <AchievementToast key={t.id} toast={t} />
      ))}
    </div>
  );
}

function AchievementToast({ toast }: { toast: AchievementToastItem }) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');
  const tierInfo = (TIER_COLORS as any)[toast.tier];

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 30);
    const t2 = setTimeout(() => setPhase('exit'), Math.max(500, DISPLAY_DURATION_MS - 350));
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const Icon = (Icons as any)[toast.icon] || Icons.Award;

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'achievements' }));
  };

  return (
    <button
      onClick={handleClick}
      className={`pointer-events-auto text-left flex items-center gap-3.5 bg-ink-900/95 backdrop-blur-xl border-2 rounded-2xl px-4 py-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] min-w-[290px] max-w-sm transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95 ${
        phase === 'show' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      } ${tierInfo?.border || 'border-gold-500'}`}
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-inner flex-shrink-0 ${
          tierInfo?.bg || 'bg-gold-500'
        }`}
      >
        <Icon size={22} className={tierInfo?.text || 'text-white'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-ink-400 uppercase tracking-widest font-black flex items-center justify-between">
          <span>🏆 Başarım Kazanıldı!</span>
          <span className="text-gold-400 ml-3">İncele ➔</span>
        </div>
        <div className="text-sm font-black text-ink-50 mt-0.5 truncate">
          {toast.achievementName}
        </div>
        <div className="text-xs text-ink-300 mt-0.5 line-clamp-2">
          <span className="font-bold text-gold-400">{tierInfo?.label}</span> · {toast.description}
        </div>
      </div>
    </button>
  );
}