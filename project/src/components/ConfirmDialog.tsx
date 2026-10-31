import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';
import { SHORTCUT_CLOSE_EVENT } from '../lib/shortcuts';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Premium modal tokenları (sinevia-premium.html ile uyumlu)
const PREMIUM_LINE = 'var(--line-2, var(--border-dim, rgba(244, 244, 242, .13)))';
const PREMIUM_LINE_SOFT = 'var(--line, var(--border-dim, rgba(244, 244, 242, .07)))';
const PREMIUM_RADIUS = 'var(--r, 16px)';
const PREMIUM_RADIUS_LG = 'var(--r-lg, 22px)';
const PREMIUM_RADIUS_SM = 'var(--r-sm, 10px)';
const PREMIUM_RED_GRAD =
  'linear-gradient(150deg, var(--red-hi, var(--color-2, #ff6b7a)) 0%, var(--red, var(--color-1, #e8384f)) 45%, var(--red-deep, var(--color-3, #8e1220)) 130%)';
const PREMIUM_RED_GLOW =
  '0 10px 28px -10px rgba(232, 56, 79, .75), inset 0 1px 0 rgba(255, 255, 255, .35), inset 0 -2px 6px rgba(0, 0, 0, .25)';

const MODAL_OVERLAY_STYLE: React.CSSProperties = {
  background: 'radial-gradient(1000px 600px at 50% 30%, rgba(232, 56, 79, .14), transparent 65%), rgba(4, 4, 6, .72)',
  backdropFilter: 'blur(16px) saturate(130%)',
};

const MODAL_STYLE: React.CSSProperties = {
  background: 'linear-gradient(165deg, #17171C 0%, #0E0E12 60%, #0B0B0E 100%)',
  border: '1px solid rgba(255, 255, 255, .12)',
  borderRadius: PREMIUM_RADIUS_LG,
  boxShadow: '0 50px 110px -30px rgba(0, 0, 0, .95), 0 0 0 1px rgba(0, 0, 0, .5), 0 0 100px -40px rgba(232, 56, 79, .55), inset 0 1px 0 rgba(255, 255, 255, .1)',
};

const MODAL_BAR_STYLE: React.CSSProperties = {
  background: 'linear-gradient(120deg, rgba(232, 56, 79, .2), rgba(232, 56, 79, .03) 70%)',
  borderBottom: `1px solid ${PREMIUM_LINE_SOFT}`,
  borderRadius: `${PREMIUM_RADIUS_LG} ${PREMIUM_RADIUS_LG} 0 0`,
};

const BTN_P_STYLE: React.CSSProperties = {
  background: PREMIUM_RED_GRAD,
  borderRadius: PREMIUM_RADIUS_SM,
  color: '#fff',
  boxShadow: PREMIUM_RED_GLOW,
};

const BTN_S_STYLE: React.CSSProperties = {
  background: 'linear-gradient(150deg, rgba(255, 255, 255, .14), rgba(255, 255, 255, .05))',
  border: `1px solid ${PREMIUM_LINE}`,
  borderRadius: PREMIUM_RADIUS_SM,
  boxShadow: '0 8px 22px -12px rgba(0, 0, 0, .9), inset 0 1px 0 rgba(255, 255, 255, .16)',
  backdropFilter: 'blur(8px)',
  color: 'var(--text-main, #f4f4f2)',
};

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Sil',
  cancelLabel = 'İptal',
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    const handleCloseRequest = () => onCancel();
    window.addEventListener(SHORTCUT_CLOSE_EVENT, handleCloseRequest);
    return () => window.removeEventListener(SHORTCUT_CLOSE_EVENT, handleCloseRequest);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={onCancel} style={MODAL_OVERLAY_STYLE}>
      <div
        className="w-full max-w-sm animate-uvPop"
        onClick={(e) => e.stopPropagation()}
        style={MODAL_STYLE}
      >
        <div className="flex justify-between align-items-center gap-14 p-4" style={MODAL_BAR_STYLE}>
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--red-hi, #ff6b7a)', boxShadow: '0 0 8px var(--red-hi, #ff6b7a)' }} />
            <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'var(--red-hi, #ff6b7a)' }}>ONAY GEREKLİ</span>
          </div>
          <button
            onClick={onCancel}
            className="w-9 h-9 rounded-[var(--r-sm,10px)] font-extrabold text-lg leading-none transition-all duration-250 flex-shrink-0"
            style={{
              background: 'rgba(255, 255, 255, .08)',
              border: `1px solid ${PREMIUM_LINE_SOFT}`,
              color: 'var(--muted, #9a9a96)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--red, #e8384f)';
              e.currentTarget.style.borderColor = 'var(--red, #e8384f)';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.transform = 'rotate(90deg)';
              e.currentTarget.style.boxShadow = '0 6px 20px -6px rgba(232, 56, 79, .9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, .08)';
              e.currentTarget.style.borderColor = PREMIUM_LINE_SOFT;
              e.currentTarget.style.color = 'var(--muted, #9a9a96)';
              e.currentTarget.style.transform = 'rotate(0deg)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            ×
          </button>
        </div>
        <div className="p-6">
          <h2 className="text-xl font-extrabold text-white mb-2" style={{
            background: 'linear-gradient(100deg, #fff 35%, #A5A5AA)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}>
            {title}
          </h2>
          <p className="text-sm text-ink-400 mb-6 leading-relaxed">{message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className={`${BTN_S_STYLE} inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wider px-4 py-2.5 text-xs transition-all duration-300 hover:-translate-y-0.5 active:translate-y-px disabled:opacity-40 disabled:pointer-events-none`}
              style={BTN_S_STYLE}
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className="inline-flex items-center justify-center gap-2 font-extrabold uppercase tracking-wider px-4 py-2.5 text-xs transition-all duration-300 hover:-translate-y-0.5 active:translate-y-px disabled:opacity-40 disabled:pointer-events-none"
              style={BTN_P_STYLE}
            >
              <AlertTriangle size={14} /> {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
