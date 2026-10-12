/**
 * Sinevia klavye kısayol sistemi — saf mantık katmanı.
 *
 * Parçalar:
 *  - `SHORTCUT_ACTIONS`: tanımlı eylemler + varsayılan tuşlar (tek doğruluk kaynağı).
 *  - `comboFromEvent`: klavye olayını kanonik kombinasyon metnine çevirir ('ctrl+shift+k').
 *  - `loadBindings` / `saveBindings` / `resetBindings`: localStorage kalıcılığı.
 *  - `findConflictingAction` / `findConflicts`: çakışma denetimi (ayarlar arayüzü uyarır).
 *  - `focusPageSearch`: '/' kısayolunun hedefi olan sayfa arama kutusunu bulur.
 *
 * Global keydown dinleyicisi `src/hooks/useShortcuts.ts` içinde,
 * ayarlar arayüzü `src/components/ShortcutsPanel.tsx` içindedir.
 *
 * Yayınlanan olaylar:
 *  - `sinevia:shortcuts-changed`: atamalar değişti (dinleyiciler bindings'i tazeler).
 *  - `sinevia:shortcut-close`: "kapat" eylemi tetiklendi (ör. ConfirmDialog dinler).
 */

/** localStorage anahtarı: Record<actionId, combo | null> (null = boşa alınmış). */
export const SHORTCUT_STORAGE_KEY = 'sinevia_shortcuts_v1';
/** Atamalar değiştiğinde yayınlanan olay. */
export const SHORTCUTS_CHANGED_EVENT = 'sinevia:shortcuts-changed';
/** "Kapat" eylemi tetiklendiğinde yayınlanan olay (açık pencereler dinleyebilir). */
export const SHORTCUT_CLOSE_EVENT = 'sinevia:shortcut-close';

export type ShortcutActionId =
  | 'close'
  | 'focusSearch'
  | 'openTutorial'
  | 'goHome'
  | 'goMovies'
  | 'goSeries'
  | 'goNetwork'
  | 'goPlan'
  | 'goHistory'
  | 'goAchievements'
  | 'goStats'
  | 'goAI'
  | 'goSettings';

export type ShortcutGroupId = 'general' | 'navigation';

export interface ShortcutAction {
  id: ShortcutActionId;
  /** Ayarlar arayüzünde görünen kısa ad. */
  label: string;
  /** Satır altında açıklama. */
  description: string;
  group: ShortcutGroupId;
  /** Varsayılan kanonik kombinasyon (örn. 'escape', '/', 'h', 'ctrl+k'). */
  defaultCombo: string;
}

/** actionId -> kombinasyon (null: kullanıcı boşa aldı). */
export type ShortcutBindings = Record<ShortcutActionId, string | null>;

export const SHORTCUT_GROUP_LABELS: Record<ShortcutGroupId, string> = {
  general: 'Genel',
  navigation: 'Sayfa Gezinimi',
};

/**
 * Tanımlı eylemler ve varsayılan kısayolları.
 * Varsayılan kombinasyonlar benzersizdir (bkz. findConflicts testleri).
 */
export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  {
    id: 'close',
    label: 'Pencereyi Kapat',
    description: 'Açık onay pencerelerini ve Tutorial Merkezi\'ni kapatır.',
    group: 'general',
    defaultCombo: 'escape',
  },
  {
    id: 'focusSearch',
    label: 'Aramaya Odaklan',
    description: 'Bulunduğun sayfadaki arama kutusuna geçer.',
    group: 'general',
    defaultCombo: '/',
  },
  {
    id: 'openTutorial',
    label: 'Tutorial Merkezi',
    description: 'Tutorial Merkezi\'ni açar veya kapatır.',
    group: 'general',
    defaultCombo: 'f1',
  },
  { id: 'goHome', label: 'Ana Sayfa', description: 'Ana sayfaya gider.', group: 'navigation', defaultCombo: 'h' },
  { id: 'goMovies', label: 'Filmler', description: 'Filmler sayfasına gider.', group: 'navigation', defaultCombo: 'f' },
  { id: 'goSeries', label: 'Diziler', description: 'Diziler sayfasına gider.', group: 'navigation', defaultCombo: 'd' },
  { id: 'goNetwork', label: 'Sinevia Ağı', description: 'Sinevia Ağı sayfasına gider.', group: 'navigation', defaultCombo: 'n' },
  { id: 'goPlan', label: 'Haftalık Plan', description: 'Haftalık Plan sayfasına gider.', group: 'navigation', defaultCombo: 't' },
  { id: 'goHistory', label: 'Geçmiş', description: 'Geçmiş sayfasına gider.', group: 'navigation', defaultCombo: 'g' },
  { id: 'goAchievements', label: 'Başarımlar', description: 'Başarımlar sayfasına gider.', group: 'navigation', defaultCombo: 'b' },
  { id: 'goStats', label: 'İstatistik', description: 'İstatistik sayfasına gider.', group: 'navigation', defaultCombo: 'i' },
  { id: 'goAI', label: 'AI Asistan', description: 'AI Asistan sayfasına gider.', group: 'navigation', defaultCombo: 'y' },
  { id: 'goSettings', label: 'Ayarlar', description: 'Ayarlar sayfasına gider.', group: 'navigation', defaultCombo: 's' },
];

/** Varsayılan atamalar (kullanıcı hiçbir şey değiştirdiğinde bunlar geçerlidir). */
export const DEFAULT_BINDINGS: ShortcutBindings = SHORTCUT_ACTIONS.reduce(
  (acc, action) => ({ ...acc, [action.id]: action.defaultCombo }),
  {} as ShortcutBindings,
);

/** Kısayol satırı için grup kimlikleri (arayüz sıralaması). */
export const SHORTCUT_GROUP_IDS: ShortcutGroupId[] = ['general', 'navigation'];

// ---------------------------------------------------------------------------
// Kombinasyon üretimi ve okunabilir gösterim
// ---------------------------------------------------------------------------

/** Klavye olayının ihtiyaç duyduğu minimum alanlar (test için KeyboardEvent'siz çalışır). */
export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

const MODIFIER_KEYS = new Set(['control', 'shift', 'alt', 'meta', 'capslock', 'altgraph', 'os']);

/** 'Escape' -> 'escape', ' ' -> 'space', 'A' -> 'a' (kanonik küçük harf). */
export function normalizeKeyName(key: string): string {
  if (key === ' ') return 'space';
  if (key === 'Esc') return 'escape';
  return key.toLowerCase();
}

/**
 * Olayı kanonik kombinasyona çevirir ('ctrl+shift+k').
 * Sadece modifier tuşu basılıyken null döner (henüz bir kombinasyon yoktur).
 */
export function comboFromEvent(e: KeyLike): string | null {
  const key = normalizeKeyName(e.key ?? '');
  if (!key || MODIFIER_KEYS.has(key)) return null;

  const parts: string[] = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.metaKey) parts.push('meta');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  parts.push(key);
  return parts.join('+');
}

const COMBO_TOKEN_LABELS: Record<string, string> = {
  ctrl: 'Ctrl',
  meta: 'Meta',
  alt: 'Alt',
  shift: 'Shift',
  escape: 'Esc',
  space: 'Boşluk',
  enter: 'Enter',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  f1: 'F1',
  f2: 'F2',
  f3: 'F3',
  f4: 'F4',
  f5: 'F5',
};

/** 'ctrl+shift+k' -> 'Ctrl + Shift + K' ; null -> '—' */
export function describeCombo(combo: string | null | undefined): string {
  if (!combo) return '—';
  return combo
    .split('+')
    .map((token) => {
      const known = COMBO_TOKEN_LABELS[token];
      if (known) return known;
      return token.length === 1 ? token.toUpperCase() : token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join(' + ');
}

// ---------------------------------------------------------------------------
// Eşleme ve çakışma denetimi
// ---------------------------------------------------------------------------

/** Verilen kombinasyona karşılık gelen eylemi bulur (yoksa null). */
export function findActionForCombo(bindings: ShortcutBindings, combo: string): ShortcutActionId | null {
  const match = SHORTCUT_ACTIONS.find((action) => bindings[action.id] === combo);
  return match ? match.id : null;
}

/**
 * `combo`'yu `excludeId` dışındaki bir eylem kullanıyorsa onu döner.
 * Atama ekranındaki çakışma uyarısı için kullanılır.
 */
export function findConflictingAction(
  bindings: ShortcutBindings,
  combo: string,
  excludeId: ShortcutActionId,
): ShortcutActionId | null {
  const conflict = SHORTCUT_ACTIONS.find((action) => action.id !== excludeId && bindings[action.id] === combo);
  return conflict ? conflict.id : null;
}

export interface ShortcutConflict {
  combo: string;
  actions: ShortcutActionId[];
}

/** Aynı kombinasyona birden fazla eylem atanmışsa (kayıtlı veri bozuksa) listeler. */
export function findConflicts(bindings: ShortcutBindings): ShortcutConflict[] {
  const byCombo = new Map<string, ShortcutActionId[]>();
  for (const action of SHORTCUT_ACTIONS) {
    const combo = bindings[action.id];
    if (!combo) continue;
    const list = byCombo.get(combo) ?? [];
    list.push(action.id);
    byCombo.set(combo, list);
  }
  return Array.from(byCombo.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([combo, actions]) => ({ combo, actions }));
}

// ---------------------------------------------------------------------------
// localStorage kalıcılığı
// ---------------------------------------------------------------------------

function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function isValidCombo(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 40 && !/\s/.test(value);
}

/**
 * Ham kaydı (localStorage / JSON) geçerli bindings'e çevirir.
 * Bilinmeyen eylem adları yok sayılır, bozuk değerler varsayılana döner,
 * `null` bilinçli olarak boşa alınmış atamayı korur.
 */
export function mergeStoredBindings(raw: unknown): ShortcutBindings {
  const merged: ShortcutBindings = { ...DEFAULT_BINDINGS };
  if (!raw || typeof raw !== 'object') return merged;
  const record = raw as Record<string, unknown>;
  for (const action of SHORTCUT_ACTIONS) {
    const value = record[action.id];
    if (value === null) merged[action.id] = null;
    else if (isValidCombo(value)) merged[action.id] = value;
  }
  return merged;
}

/** Kayıtlı atamaları okur; kayıt yoksa/bozuksa varsayılanlar döner. */
export function loadBindings(): ShortcutBindings {
  if (!hasStorage()) return { ...DEFAULT_BINDINGS };
  try {
    return mergeStoredBindings(JSON.parse(localStorage.getItem(SHORTCUT_STORAGE_KEY) || 'null'));
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

/** Atamaları kaydeder ve `sinevia:shortcuts-changed` olayını yayınlar. */
export function saveBindings(bindings: ShortcutBindings): void {
  try {
    if (hasStorage()) localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // Depolama kapalı/boş olabilir; atamalar yine de bellekte tutulur.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SHORTCUTS_CHANGED_EVENT));
  }
}

/** Varsayılan atamalara döner, kaydeder ve değişim olayını yayınlar. */
export function resetBindings(): ShortcutBindings {
  const defaults: ShortcutBindings = { ...DEFAULT_BINDINGS };
  saveBindings(defaults);
  return defaults;
}

// ---------------------------------------------------------------------------
// Hedefleme yardımcıları
// ---------------------------------------------------------------------------

/** Kullanıcı şu an bir metin girişi yapıyor mu? (yazarken kısayol tetiklenmesin) */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tag = (el.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable === true;
}

function isVisible(el: HTMLElement): boolean {
  return el.offsetParent !== null || el.getClientRects().length > 0;
}

function isSearchInput(el: HTMLInputElement): boolean {
  if (el.disabled || el.readOnly) return false;
  const type = (el.type || 'text').toLowerCase();
  if (type !== 'text' && type !== 'search') return false;
  if (!isVisible(el)) return false;
  return (el.placeholder || '').toLocaleLowerCase('tr-TR').includes('ara');
}

/**
 * '/' kısayolunun hedefi: sayfanın görünür arama kutusuna odaklanır.
 * Tercihen `data-sinevia-search` işaretli eleman, yoksa placeholder'ında
 * "ara" geçen ilk görünür text input'u seçilir. Bulunamazsa false döner.
 */
export function focusPageSearch(): boolean {
  if (typeof document === 'undefined') return false;
  const explicit = document.querySelector<HTMLInputElement>('[data-sinevia-search]');
  const target =
    explicit && isSearchInput(explicit)
      ? explicit
      : Array.from(document.querySelectorAll<HTMLInputElement>('input')).find(isSearchInput);
  if (!target) return false;
  target.focus();
  target.select();
  return true;
}
