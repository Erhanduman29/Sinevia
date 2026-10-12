import { expect, test, describe } from 'vitest';
import {
  SHORTCUT_ACTIONS,
  DEFAULT_BINDINGS,
  comboFromEvent,
  describeCombo,
  findActionForCombo,
  findConflictingAction,
  findConflicts,
  isTypingTarget,
  loadBindings,
  mergeStoredBindings,
  normalizeKeyName,
  resetBindings,
} from '../lib/shortcuts';
import type { ShortcutActionId, ShortcutBindings } from '../lib/shortcuts';

/** Basit bir KeyboardEvent benzeri nesne (node ortamında DOM gerekmez). */
function keyEvent(key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) {
  return { key, ...mods };
}

describe('KLAVYE KISAYOL SİSTEMİ TESTLERİ', () => {
  // ==========================================================
  // 1. TANIMLAR VE VARSAYILAN ATAMALAR
  // ==========================================================
  describe('Kısayol tanımları', () => {
    test('her eylemin bir label, açıklama, grup ve varsayılan kombinasyonu olmalı', () => {
      for (const action of SHORTCUT_ACTIONS) {
        expect(action.label.length).toBeGreaterThan(0);
        expect(action.description.length).toBeGreaterThan(0);
        expect(['general', 'navigation']).toContain(action.group);
        expect(action.defaultCombo.length).toBeGreaterThan(0);
      }
    });

    test('varsayılan kombinasyonlar benzersiz olmalı (çakışma yok)', () => {
      const combos = SHORTCUT_ACTIONS.map((a) => a.defaultCombo);
      expect(new Set(combos).size).toBe(combos.length);
      expect(findConflicts(DEFAULT_BINDINGS)).toEqual([]);
    });

    test('DEFAULT_BINDINGS tüm eylemleri kapsar', () => {
      expect(Object.keys(DEFAULT_BINDINGS).sort()).toEqual(SHORTCUT_ACTIONS.map((a) => a.id).sort());
    });

    test('uygulamaya özgü temel kısayollar varsayılan olarak tanımlı', () => {
      expect(DEFAULT_BINDINGS.close).toBe('escape'); // Esc = kapat
      expect(DEFAULT_BINDINGS.focusSearch).toBe('/'); // / = ara
      expect(DEFAULT_BINDINGS.goHome).toBe('h');
      expect(DEFAULT_BINDINGS.goSettings).toBe('s');
    });
  });

  // ==========================================================
  // 2. OLAY -> KOMBİNASYON DÖNÜŞÜMÜ
  // ==========================================================
  describe('comboFromEvent / normalizeKeyName', () => {
    test('düz tuşları kanonik küçük harfe çevirir', () => {
      expect(comboFromEvent(keyEvent('H'))).toBe('h');
      expect(comboFromEvent(keyEvent('Escape'))).toBe('escape');
      expect(comboFromEvent(keyEvent('/'))).toBe('/');
      expect(comboFromEvent(keyEvent('F1'))).toBe('f1');
    });

    test('boşluk tuşu "space" olur', () => {
      expect(normalizeKeyName(' ')).toBe('space');
      expect(comboFromEvent(keyEvent(' '))).toBe('space');
    });

    test('modifier tuşları kombinasyona eklenir', () => {
      expect(comboFromEvent(keyEvent('k', { ctrlKey: true }))).toBe('ctrl+k');
      expect(comboFromEvent(keyEvent('K', { ctrlKey: true, shiftKey: true }))).toBe('ctrl+shift+k');
      expect(comboFromEvent(keyEvent('p', { metaKey: true, altKey: true }))).toBe('meta+alt+p');
    });

    test('yalnızca modifier basılıyken kombinasyon yoktur (null)', () => {
      expect(comboFromEvent(keyEvent('Shift', { shiftKey: true }))).toBeNull();
      expect(comboFromEvent(keyEvent('Control', { ctrlKey: true }))).toBeNull();
      expect(comboFromEvent(keyEvent('Alt', { altKey: true }))).toBeNull();
      expect(comboFromEvent(keyEvent('Meta', { metaKey: true }))).toBeNull();
    });
  });

  // ==========================================================
  // 3. EŞLEME VE ÇAKIŞMA DENETİMİ
  // ==========================================================
  describe('Eşleme ve çakışma', () => {
    test('her varsayılan kombinasyon kendi eylemini bulur', () => {
      for (const action of SHORTCUT_ACTIONS) {
        expect(findActionForCombo(DEFAULT_BINDINGS, action.defaultCombo)).toBe(action.id);
      }
    });

    test('atanmamış kombinasyon null döner', () => {
      expect(findActionForCombo(DEFAULT_BINDINGS, 'ctrl+shift+q')).toBeNull();
    });

    test('findConflictingAction çakışan eylemi bulur ve hariç tutmayı uygular', () => {
      const bindings: ShortcutBindings = { ...DEFAULT_BINDINGS, goMovies: 'h' }; // goHome da 'h'
      expect(findConflictingAction(bindings, 'h', 'goMovies')).toBe('goHome');
      expect(findConflictingAction(bindings, 'h', 'goHome')).toBe('goMovies');
      expect(findConflictingAction(bindings, 'ctrl+shift+z', 'goHome')).toBeNull();
    });

    test('findConflicts bozuk kayıtlarda iki eylemi birden listeler', () => {
      const bindings: ShortcutBindings = { ...DEFAULT_BINDINGS, goSeries: 'h' };
      const conflicts = findConflicts(bindings);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].combo).toBe('h');
      expect(conflicts[0].actions.sort()).toEqual(['goHome', 'goSeries']);
    });
  });

  // ==========================================================
  // 4. KALICILIK (localStorage) — ŞEMA DOĞRULAMASI
  // ==========================================================
  describe('mergeStoredBindings / loadBindings / resetBindings', () => {
    test('geçersiz veya boş kayıt varsayılana döner', () => {
      expect(mergeStoredBindings(null)).toEqual(DEFAULT_BINDINGS);
      expect(mergeStoredBindings('bozuk')).toEqual(DEFAULT_BINDINGS);
      expect(mergeStoredBindings({ unknownAction: 'x', goHome: 42 })).toEqual(DEFAULT_BINDINGS);
    });

    test('geçerli kayıt varsayılanların üzerine yazılır', () => {
      const merged = mergeStoredBindings({ goHome: 'ctrl+alt+h' });
      expect(merged.goHome).toBe('ctrl+alt+h');
      expect(merged.goMovies).toBe(DEFAULT_BINDINGS.goMovies);
    });

    test('null (boşa alınmış) atama korunur', () => {
      const merged = mergeStoredBindings({ focusSearch: null });
      expect(merged.focusSearch).toBeNull();
    });

    test('boşluk içeren sahte kombinasyonlar reddedilir', () => {
      const merged = mergeStoredBindings({ goHome: 'h x' });
      expect(merged.goHome).toBe(DEFAULT_BINDINGS.goHome);
    });

    test('loadBindings depolama yoksa/bozuksa varsayılanları döner', () => {
      expect(loadBindings()).toEqual(DEFAULT_BINDINGS);
    });

    test('resetBindings varsayılan seti döndürür ve kaydı temizler', () => {
      expect(resetBindings()).toEqual(DEFAULT_BINDINGS);
      expect(loadBindings()).toEqual(DEFAULT_BINDINGS);
    });
  });

  // ==========================================================
  // 5. YAZMA (INPUT) HEDEFİ ALGILAMA VE GÖSTERİM
  // ==========================================================
  describe('Yardımcılar', () => {
    test('isTypingTarget metin girdilerini ve contentEditable alanları tanır', () => {
      expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
      expect(isTypingTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
      expect(isTypingTarget({ tagName: 'SELECT' } as unknown as EventTarget)).toBe(true);
      expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true);
      expect(isTypingTarget({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false);
      expect(isTypingTarget(null)).toBe(false);
    });

    test('describeCombo kombinasyonu okunabilir hale getirir', () => {
      expect(describeCombo(null)).toBe('—');
      expect(describeCombo('escape')).toBe('Esc');
      expect(describeCombo('h')).toBe('H');
      expect(describeCombo('ctrl+shift+k')).toBe('Ctrl + Shift + K');
      expect(describeCombo('/')).toBe('/');
    });
  });
});
