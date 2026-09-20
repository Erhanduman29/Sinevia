import { AlertTriangle } from 'lucide-react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Sil',
  cancelLabel = 'İptal',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        className="bg-ink-900 border border-red-500/30 rounded-2xl w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-ink-100 mb-1.5">{title}</h2>
          <p className="text-sm text-ink-400">{message}</p>
        </div>
        <div className="flex gap-2 p-5 pt-0">
          <button
            onClick={onCancel}
            className="flex-1 bg-ink-800 text-ink-200 rounded-lg py-2.5 font-medium hover:bg-ink-700 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg py-2.5 font-semibold hover:from-red-500 hover:to-red-400 transition-all shadow-lg shadow-red-500/20"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
