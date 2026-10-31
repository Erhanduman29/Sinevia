import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rootReducer } from '../context/AppContext';
import type { ExtendedAppData } from '../context/AppContext';

// ============================================================================
// TEMA SEÇİMİ — Ayarlar menüsü ↔ CSS tema tanımları ↔ reducer sözleşmesi
// ============================================================================

const settingsSource = readFileSync(fileURLToPath(new URL('../pages/SettingsPage.tsx', import.meta.url)), 'utf8');
const cssSource = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8');
const appContextSource = readFileSync(fileURLToPath(new URL('../context/AppContext.tsx', import.meta.url)), 'utf8');

/** SettingsPage içindeki THEMES dizisinden tema id'lerini çek (kaynak sözleşme testi). */
function getThemeBlock(): string {
  const start = settingsSource.indexOf('const THEMES = [');
  expect(start, 'SettingsPage içinde THEMES dizisi bulunamadı').toBeGreaterThan(-1);
  const end = settingsSource.indexOf('];', start);
  return settingsSource.slice(start, end);
}

function getThemeIds(): string[] {
  return Array.from(getThemeBlock().matchAll(/id: '([^']+)'/g)).map((m) => m[1]);
}

function getInitialState(): ExtendedAppData {
  return {
    movies: [], series: [], removedSeriesTitles: [], collections: [],
    genres: [], reviewTags: [], history: [], achievements: [], criteria: [],
    xp: 0, level: 1, totalXp: 0, lastWatchDate: null, dailyStreak: 0, dailyStreakDate: null,
    showLockedNames: false, theme: 'default', altWatchTemplate: '', weeklyPlan: [], notificationsEnabled: false,
  };
}

describe('TEMA SEÇİMİ — AYARLAR MENÜSÜ (THEMES)', () => {
  test('tam 17 tema sunulmalı ve id’leri benzersiz olmalı', () => {
    const ids = getThemeIds();
    expect(ids).toEqual([
      'premium-dark', 'default', 'light', 'cyberpunk', 'blood', 'matrix', 'ocean',
      'dracula', 'nord', 'solarized-dark', 'monokai', 'paper-light', 'retro-amber',
      'plain-dark', 'solo-crimson', 'duo-sunset', 'quad-festival',
    ]);
    expect(new Set(ids).size).toBe(17);
  });

  test('her tema kartının adı, açıklaması, önizleme rengi ve 1-4 arası renk paleti tanımlı olmalı', () => {
    const lines = getThemeBlock()
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith("{ id: '"));

    expect(lines).toHaveLength(17);

    lines.forEach((line) => {
      expect(line).toMatch(/name: '[^']+'/);
      expect(line).toMatch(/desc: '[^']+'/);
      expect(line).toMatch(/previewBg: '#[0-9a-fA-F]{6}'/);
      expect(line).toMatch(/textMode: '(light|dark)'/);

      const colorsMatch = line.match(/colors: \[([^\]]+)\]/);
      expect(colorsMatch, `renk paleti okunamadı: ${line}`).not.toBeNull();
      const colors = colorsMatch![1].split(',').map((c) => c.trim());
      // Tema paletleri 1-4 renk arasında olabilir (tek renk / iki renk / dört renk temalar desteklenir)
      expect(colors.length).toBeGreaterThanOrEqual(1);
      expect(colors.length).toBeLessThanOrEqual(4);
      colors.forEach((c) => expect(c).toMatch(/^'#[0-9a-fA-F]{6}'$/));
    });
  });

  test('Ayarlar sayfası tema seçtiğinde updateTheme çağırmalı (kaynak sözleşmesi)', () => {
    expect(settingsSource).toContain('updateTheme(theme.id)');
    expect(settingsSource).toContain("isSelected = (data.theme || 'default') === theme.id");
  });
});

describe('TEMA SEÇİMİ — CSS KARŞILIKLARI', () => {
  test('varsayılan tema HARİÇ her tema için body[data-theme] kuralı index.css’te olmalı', () => {
    const ids = getThemeIds().filter((id) => id !== 'default');
    expect(ids.length).toBe(16);

    ids.forEach((id) => {
      expect(cssSource.includes(`body[data-theme="${id}"]`), `CSS'te ${id} teması tanımsız`).toBe(true);
    });
  });

  test('"default" temanın ayrı override kuralı OLMAMALI (temel palet doğrudan kullanılır)', () => {
    expect(cssSource.includes('body[data-theme="default"]')).toBe(false);
    // Bunun yerine tüm temalar için genel değişken kuralları olmalı
    expect(cssSource.includes('body[data-theme]')).toBe(true);
  });
});

describe('TEMA SEÇİMİ — REDUCER & UYGULAMA SÖZLEŞMESİ', () => {
  test('SET_THEME her tema id’sini state’e yazmalı ve önceki state’i MUTASYONA UĞRATMAMALI', () => {
    getThemeIds().forEach((id) => {
      const state = getInitialState();
      const snapshot = { ...state };

      const next = rootReducer(state, { type: 'SET_THEME', theme: id } as any);

      expect(next.theme).toBe(id);
      expect(next).not.toBe(state);
      expect(state).toEqual(snapshot); // orijinal state bozulmadı
    });
  });

  test('varsayılan tema "default" olmalı ve bilinmeyen tema id’si de saklanabilmeli', () => {
    const state = getInitialState();
    expect(state.theme).toBe('default');

    const custom = rootReducer(state, { type: 'SET_THEME', theme: 'neon-ozel' } as any);
    expect(custom.theme).toBe('neon-ozel');
  });

  test('AppContext, tema değişince body[data-theme] attribute’unu güncellemeli', () => {
    expect(appContextSource).toContain("document.body.setAttribute('data-theme'");
    expect(appContextSource).toContain('data.theme');
  });
});
