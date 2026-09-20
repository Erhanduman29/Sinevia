import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import type { AchievementToastItem } from '../context/AppContext';
import { TIER_COLORS } from '../lib/achievements';

export default function AchievementToasts({ toasts }: { toasts: AchievementToastItem[] }) {
  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-3 items-end">
      {toasts.map((t) => (
        <AchievementToast key={t.id} toast={t} />
      ))}
    </div>
  );
}

function AchievementToast({ toast }: { toast: AchievementToastItem }) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');
  const tierInfo = TIER_COLORS[toast.tier];

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 30);
    return () => clearTimeout(t1);
  }, []);

  const Icon = (Icons as any)[toast.icon] || Icons.Award;

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'achievements' }));
  };

  return (
    <button
      onClick={handleClick}
      className={`text-left flex items-center gap-3 bg-ink-900 border-2 rounded-xl px-4 py-3 shadow-2xl min-w-[280px] transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95 ${
        phase === 'show' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      } ${tierInfo?.border || 'border-ink-700'}`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-inner ${tierInfo?.bg || 'bg-ink-700'}`}>
        <Icon size={20} className={tierInfo?.text || 'text-white'} />
      </div>
      <div className="flex-1">
        <div className="text-[10px] text-ink-400 uppercase tracking-widest font-bold flex items-center justify-between">
          <span>Başarım Kazanıldı!</span>
          <span className="text-gold-400 ml-3">Tıkla</span>
        </div>
        <div className="text-sm font-bold text-ink-50 mt-0.5">{toast.achievementName}</div>
        <div className="text-xs text-ink-400 mt-0.5">
          <span className={`font-semibold ${tierInfo?.text}`}>{tierInfo?.label}</span> · {toast.description}
        </div>
      </div>
    </button>
  );
}