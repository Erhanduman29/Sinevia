import { useEffect, useState } from 'react';
import { AlertTriangle, Keyboard, RotateCcw, X } from 'lucide-react';
import {
  SHORTCUT_ACTIONS,
  SHORTCUT_GROUP_IDS,
  SHORTCUT_GROUP_LABELS,
  comboFromEvent,
  describeCombo,
  findConflictingAction,
  loadBindings,
  resetBindings,
  saveBindings,
} from '../lib/shortcuts';
import type { ShortcutActionId, ShortcutBindings } from '../lib/shortcuts';

/** Çakışan bir tuş ataması için kullanıcı onayı bekleyen durum. */
interface PendingConflict {
  actionId: ShortcutActionId;
  combo: string;
  conflictId: ShortcutActionId;
}

/**
 * Ayarlar → "Kısayollar" sekmesinin içeriği.
 *
 * - Atamalar `src/lib/shortcuts.ts` üzerinden localStorage'a yazılır ve
 *   yayılan olay ile global dinleyici (useShortcuts) anında tazelenir.
 * - Tuş yakalama pencerenin *capture* fazında dinlenir; global kısayol
 *   dinleyicisi ve hedef elemanlar bu tuşu görmez.
 * - Yakalanan tuş başka bir eylemde kullanılıyorsa uyarı gösterilir;
 *   kullanıcı onaylarsa çakışan eylemin ataması boşa alınır.
 */
export default function ShortcutsPanel() {
  const [bindings, setBindings] = useState<ShortcutBindings>(() => loadBindings());
  const [capturingId, setCapturingId] = useState<ShortcutActionId | null>(null);
  const [pending, setPending] = useState<PendingConflict | null>(null);

  // Tuş yakalama modu: Esc atamayı iptal eder, modifier-only tuşlar bekletir.
  useEffect(() => {
    if (!capturingId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setCapturingId(null);
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) return;
      const conflictId = findConflictingAction(bindings, combo, capturingId);
      if (conflictId) {
        setPending({ actionId: capturingId, combo, conflictId });
        setCapturingId(null);
        return;
      }
      applyBindings({ ...bindings, [capturingId]: combo });
      setCapturingId(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturingId, bindings]);

  const applyBindings = (next: ShortcutBindings) => {
    saveBindings(next);
    setBindings(next);
    setPending(null);
  };

  const handleUnbind = (actionId: ShortcutActionId) => {
    applyBindings({ ...bindings, [actionId]: null });
  };

  const handleReset = () => {
    setBindings(resetBindings());
    setCapturingId(null);
    setPending(null);
  };

  /** Uyarı onaylandıysa çakışan eylemin ataması boşa alınarak yeni tuş atanır. */
  const handleConfirmPending = () => {
    if (!pending) return;
    applyBindings({ ...bindings, [pending.actionId]: pending.combo, [pending.conflictId]: null });
  };

  const pendingAction = pending ? SHORTCUT_ACTIONS.find((a) => a.id === pending.actionId) : null;
  const conflictAction = pending ? SHORTCUT_ACTIONS.find((a) => a.id === pending.conflictId) : null;

  return (
    <div className="bg-ink-900/60 backdrop-blur-sm border border-ink-700/50 rounded-2xl shadow-xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h2 className="text-base sm:text-lg font-semibold text-ink-100 flex items-center gap-2">
          <Keyboard size={18} className="text-gold-400 flex-shrink-0" />
          Klavye Kısayolları
        </h2>
        <button
          onClick={handleReset}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-ink-800 text-ink-300 border border-ink-700 hover:bg-ink-700 hover:text-white transition-colors"
        >
          <RotateCcw size={13} /> Varsayılara Dön
        </button>
      </div>

      <p className="text-xs sm:text-sm text-ink-400 mb-4">
        Değiştirmek istediğin satırda <strong className="text-ink-200">Değiştir</strong>'e bas ve yeni tuşa bas.
        Metin kutularına yazarken kısayollar çalışmaz; bir pencere açıksa yalnızca{' '}
        <strong className="text-ink-200">Esc</strong> aktiftir.
      </p>

      {pending && pendingAction && conflictAction && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 animate-fade-in">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-amber-200 font-bold mb-0.5">
                <span>{describeCombo(pending.combo)}</span> tuşu zaten kullanılıyor!
              </p>
              <p className="text-[11px] sm:text-xs text-amber-200/70">
                Bu kombinasyon şu an <strong>"{pendingAction.label}"</strong> eyleminde. Onaylarsan{' '}
                <strong>"{conflictAction.label}"</strong> eyleminin ataması boşa alınır.
              </p>
              <div className="flex gap-2 mt-2.5">
                <button
                  onClick={() => setPending(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-ink-800 text-ink-200 border border-ink-700 hover:bg-ink-700 transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleConfirmPending}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-ink-950 hover:bg-amber-400 transition-colors"
                >
                  Yine de ata
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {SHORTCUT_GROUP_IDS.map((groupId) => (
          <div key={groupId}>
            <h3 className="text-[10px] font-black text-ink-500 uppercase tracking-widest mb-2">
              {SHORTCUT_GROUP_LABELS[groupId]}
            </h3>
            <div className="space-y-2">
              {SHORTCUT_ACTIONS.filter((action) => action.group === groupId).map((action) => {
                const binding = bindings[action.id];
                const isCapturing = capturingId === action.id;
                return (
                  <div
                    key={action.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                      isCapturing
                        ? 'bg-gold-500/10 border-gold-500/50'
                        : 'bg-ink-950/50 border-ink-800 hover:border-ink-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-white">{action.label}</div>
                      <div className="text-[11px] text-ink-500 leading-snug">{action.description}</div>
                      {binding && binding !== action.defaultCombo && (
                        <div className="text-[10px] text-ink-600 mt-0.5">
                          Varsayılan: <span className="font-semibold">{describeCombo(action.defaultCombo)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isCapturing ? (
                        <span className="text-[11px] font-bold text-gold-300 animate-pulse whitespace-nowrap">
                          Tuşa bas... (Esc iptal)
                        </span>
                      ) : (
                        <>
                          <kbd
                            className={`px-2 py-1 rounded-lg border text-[11px] font-bold min-w-[3rem] text-center ${
                              binding
                                ? 'bg-ink-900 border-ink-700 text-gold-300'
                                : 'bg-ink-950 border-ink-800 text-ink-500'
                            }`}
                          >
                            {describeCombo(binding)}
                          </kbd>
                          <button
                            onClick={() => {
                              setPending(null);
                              setCapturingId(action.id);
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-gold-500/15 text-gold-400 border border-gold-500/30 hover:bg-gold-500/25 transition-colors"
                          >
                            Değiştir
                          </button>
                          {binding && (
                            <button
                              onClick={() => handleUnbind(action.id)}
                              title="Atamayı boşa al"
                              className="p-1.5 rounded-lg text-ink-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
