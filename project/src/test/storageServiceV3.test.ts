import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  BOOT_SNAPSHOT_KEYS,
  loadStateV3,
  loadStateV3WithSource,
  migrateToIdbIfNeeded,
  pickStoredStateV3,
  readBootSnapshotV3,
  readLegacyState,
  saveStateV3Immediate,
  STATE_STORAGE_KEY,
  writeBootSnapshotFromState,
} from '../lib/storageService';
import { createEmptyAppStateV3, migrateLegacyToV3 } from '../lib/localStateV3';
import type { AppStateV3 } from '../types/appState';

// ============================================================================
// storageService — V3 kayıt API'si, boot snapshot ve V2 göçü
// Node ortamında IndexedDB yoktur: burada yerel davranış (localStorage +
// güvenli geri dönüş) doğrulanır; IDB yolu tarayıcıda aynı sözleşmeyi izler.
// ============================================================================

const storageMap = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => storageMap.get(k) ?? null,
  setItem: (k: string, v: string) => void storageMap.set(k, v),
  removeItem: (k: string) => void storageMap.delete(k),
  clear: () => storageMap.clear(),
  key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
  get length() {
    return storageMap.size;
  },
};

function bigState(): AppStateV3 {
  const core = {
    movies: Array.from({ length: 50 }, (_, i) => ({ id: `m${i}`, title: `Film ${i}`, notes: 'y'.repeat(200) })),
    series: [{ id: 's1', episodes: [] }],
    totalXp: 1850,
    bonusXp: 50,
    theme: 'midnight',
    agentId: 'SNV-AAAA-BBBB',
  };
  return migrateLegacyToV3({ core, deviceId: 'dev-1', updatedAt: '2026-04-01T00:00:00.000Z' });
}

beforeEach(() => {
  storageMap.clear();
  vi.stubGlobal('localStorage', fakeStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storageService V3 — boot snapshot', () => {
  test('writeBootSnapshotFromState kütüphaneyi localStorage a yazmaz', () => {
    const state = bigState();
    expect(writeBootSnapshotFromState(state)).toBe(true);

    const raw = storageMap.get(STATE_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(raw!).not.toContain('movies');
    expect(raw!).not.toContain('xpEvents');
    expect(raw!.length).toBeLessThan(32 * 1024);

    const snapshot = readBootSnapshotV3();
    expect(snapshot?.totalXp).toBe(1850);
    expect(snapshot?.theme).toBe('midnight');
    expect(snapshot?.agentId).toBe('SNV-AAAA-BBBB');
  });

  test('boot snapshot anahtarları büyük kütüphane alanlarını içermez', () => {
    expect(BOOT_SNAPSHOT_KEYS).not.toContain('movies');
    expect(BOOT_SNAPSHOT_KEYS).not.toContain('series');
    expect(BOOT_SNAPSHOT_KEYS).not.toContain('xpEvents');
  });

  test('saveStateV3Immediate yalnız V3 kaydını kabul eder (boot snapshot yazar)', async () => {
    const state = bigState();
    await saveStateV3Immediate(state);
    const snapshot = readBootSnapshotV3();
    expect(snapshot?.level).toBeGreaterThanOrEqual(1);
    expect(readBootSnapshotV3()?.schemaVersion).toBe(3);
  });
});

describe('storageService V3 — göç ve okuma', () => {
  test('IndexedDB yoksa loadStateV3 null döner (veri kaybı yok, çağıran düşer)', async () => {
    await expect(loadStateV3()).resolves.toBeNull();
    await expect(loadStateV3WithSource()).resolves.toEqual({ state: null, source: null });
  });

  test('pickStoredStateV3: ana kayıt bozuksa yedeğe düşer', () => {
    const backup = createEmptyAppStateV3({ ownerAgentId: 'SNV-BACKUP-1' });
    expect(pickStoredStateV3(null, backup)).toEqual({ state: backup, source: 'backup' });
    expect(pickStoredStateV3({ schemaVersion: 2, movies: [], series: [] }, backup).source).toBe('backup');
    // Boot snapshot tam kayıt sayılmaz.
    expect(pickStoredStateV3({ schemaVersion: 3, theme: 'x' }, backup).source).toBe('backup');
    const main = createEmptyAppStateV3({ ownerAgentId: 'SNV-MAIN-1' });
    expect(pickStoredStateV3(main, backup)).toEqual({ state: main, source: 'main' });
    expect(pickStoredStateV3(null, null)).toEqual({ state: null, source: null });
  });

  test('readLegacyState localStorage daki V2 tam kaydı bulur, boot snapshot ı yok sayar', async () => {
    storageMap.set(STATE_STORAGE_KEY, JSON.stringify({ schemaVersion: 3, theme: 'midnight' }));
    await expect(readLegacyState()).resolves.toBeNull();

    const v2 = { movies: [{ id: 'm1' }], series: [], totalXp: 300 };
    storageMap.set(STATE_STORAGE_KEY, JSON.stringify(v2));
    await expect(readLegacyState()).resolves.toEqual(v2);
  });

  test('idb yokken migrateToIdbIfNeeded false döner (sessiz veri kaybı yok)', async () => {
    storageMap.set(STATE_STORAGE_KEY, JSON.stringify({ movies: [{ id: 'm1' }], series: [] }));
    await expect(migrateToIdbIfNeeded(STATE_STORAGE_KEY)).resolves.toBe(false);
  });

  test('createEmptyAppStateV3 V3 doğrulamasından geçer', () => {
    const empty = createEmptyAppStateV3({ ownerAgentId: 'SNV-AAAA-BBBB' });
    expect(empty.schemaVersion).toBe(3);
    expect(empty.ownerAgentId).toBe('SNV-AAAA-BBBB');
  });
});
