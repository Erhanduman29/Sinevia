import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FEATURE_FLAGS,
  clearFeatureFlags,
  isFeatureEnabled,
  readFeatureFlags,
  setFeatureFlag,
} from '../lib/featureFlags';

describe('featureFlags', () => {
  const store = new Map<string, string>();
  const originalWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    store.clear();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    };
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
    vi.restoreAllMocks();
  });

  it('varsayılan olarak Merge V2 kapalıdır', () => {
    expect(DEFAULT_FEATURE_FLAGS.syncMergeV2).toBe(false);
    expect(isFeatureEnabled('syncMergeV2')).toBe(false);
    expect(readFeatureFlags()).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it('override ile bayrak açılır', () => {
    setFeatureFlag('syncMergeV2', true);
    expect(isFeatureEnabled('syncMergeV2')).toBe(true);
  });

  it('null override kaldırır ve varsayılana döner', () => {
    setFeatureFlag('syncMergeV2', true);
    expect(isFeatureEnabled('syncMergeV2')).toBe(true);

    setFeatureFlag('syncMergeV2', null);
    expect(isFeatureEnabled('syncMergeV2')).toBe(false);
    expect(store.size).toBe(0);
  });

  it('geçersiz JSON override yok sayılır', () => {
    store.set('sinevia_flag_overrides', '{bozuk json');
    expect(readFeatureFlags()).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it('boolean olmayan override değerleri yok sayılır', () => {
    store.set('sinevia_flag_overrides', JSON.stringify({ syncMergeV2: 'evet' }));
    expect(isFeatureEnabled('syncMergeV2')).toBe(false);
  });

  it('clearFeatureFlags tüm override ları temizler', () => {
    setFeatureFlag('syncMergeV2', true);
    clearFeatureFlags();
    expect(store.size).toBe(0);
    expect(isFeatureEnabled('syncMergeV2')).toBe(false);
  });
});
