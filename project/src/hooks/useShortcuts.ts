import { useEffect, useRef, useState } from 'react';
import {
  SHORTCUTS_CHANGED_EVENT,
  comboFromEvent,
  findActionForCombo,
  isTypingTarget,
  loadBindings,
} from '../lib/shortcuts';
import type { ShortcutActionId, ShortcutBindings } from '../lib/shortcuts';

/** Eylem kimliği -> o eylem tetiklendiğinde çalışacak handler. */
export type ShortcutHandlers = Partial<Record<ShortcutActionId, (event: KeyboardEvent) => void>>;

/**
 * Modal / tutorial katmanı açık mı?
 * Uygulamadaki tüm katmanlar `fixed inset-0` kapsayıcısı kullanır
 * (bkz. Layout'un modal algılayıcısı); bildirim toastları kullanmaz.
 */
function isOverlayOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return document.querySelector('.fixed.inset-0') !== null;
}

/**
 * Global klavye kısayolu dinleyicisi.
 *
 * - `bindings` localStorage'dan okunur ve `sinevia:shortcuts-changed` /
 *   `storage` olaylarıyla tazelenir (ayarlar sekmesindeki değişiklik anında yansır).
 * - Metin girişi odaktayken (input/textarea/contentEditable) yalnızca
 *   modifier'lı kombinasyonlar çalışır; böylece yazarken yanlış sayfa değişmez.
 * - Modal/tutorial katmanı açıkken yalnızca `close` eylemi çalışır.
 *
 * @returns güncel atamalar (ayarlar arayüzü de kullanabilir).
 */
export function useShortcuts(handlers: ShortcutHandlers): ShortcutBindings {
  const handlersRef = useRef(handlers);
  const [bindings, setBindings] = useState<ShortcutBindings>(() => loadBindings());

  // Handler kimliği her render'da değişir; ref güncel tutulur ki dinleyici
  // (bindings değiştikçe yeniden bağlanan) taze klosürleri görsün.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  // Atama değişikliklerini izle (aynı sekme: custom event, diğer sekmeler: storage).
  useEffect(() => {
    const sync = () => setBindings(loadBindings());
    window.addEventListener(SHORTCUTS_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SHORTCUTS_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;

      const combo = comboFromEvent(e);
      if (!combo) return;

      const actionId = findActionForCombo(bindings, combo);
      if (!actionId) return;

      const handler = handlersRef.current[actionId];
      if (!handler) return;

      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
      if (!hasModifier && isTypingTarget(e.target)) return;
      if (actionId !== 'close' && isOverlayOpen()) return;

      e.preventDefault();
      handler(e);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bindings]);

  return bindings;
}
