import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import type { ToastItem } from '../context/AppContext';

const ICONS: Record<string, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const COLORS: Record<string, string> = {
  success: 'text-green-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
  info: 'text-blue-400',
};

export default function Toasts({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 items-end">
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            className="flex items-center gap-2.5 bg-ink-900 border border-ink-700 rounded-lg px-4 py-3 shadow-xl animate-slide-in-right max-w-xs"
          >
            <Icon size={18} className={COLORS[t.type]} />
            <span className="text-sm text-ink-200">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
