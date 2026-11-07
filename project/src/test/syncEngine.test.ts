import { describe, expect, test } from 'vitest';
import type { AppStateV3 } from '../types/appState';
import type { CloudSaveRecord, CommitSaveRequest, SaveEnvelope, SyncResult } from '../types/sync';
import { createEmptyAppStateV3 } from '../lib/localStateV3';
import { makeContentHash, makeSaveHash } from '../lib/syncContract';
import { makeXpEvent, sumXpEvents } from '../lib/xpLedger';
import {
  compressCloudPayload,
  createSyncEngine,
  createSupabaseSyncClient,
  decideSyncAction,
  decompressCloudPayload,
  isEmptyState,
  mergeForks,
  SyncEngineError,
  SyncRpcClient,
  type SyncClient,
  type SyncCommitResponse,
  type SyncMetaStore,
} from '../lib/syncEngine';/* -------------------------------------------------------------------------
   FAKE BULUT — SQL davranışının birebir taklidi (base_revision eşleşmesi).
   ------------------------------------------------------------------------- */

class FakeCloud {
  record: CloudSaveRecord | null = null;
  commits: CommitSaveRequest[] = [];
  discarded: string[] = [];
  getCalls = 0;
  failWith: unknown = null;
  /** Test: bir sonraki commit'i, aynı içerikli başka bir cihaz yarışı gibi reddet. */
  conflictNextCommit = false;

  client: SyncClient = {
    getRemote: async (): Promise<CloudSaveRecord | null> => {
      this.getCalls += 1;
      if (this.failWith) throw this.failWith;
      return this.record ? JSON.parse(JSON.stringify(this.record)) : null;
    },
    getRemoteMeta: async (): Promise<{ revision: number; saveHash: string; updatedAt: string; deviceId: string } | null> => {
      if (this.failWith) throw this.failWith;
      if (!this.record) return null;
      return {
        revision: this.record.revision,
        saveHash: this.record.saveHash,
        updatedAt: this.record.updatedAt,
        deviceId: this.record.deviceId,
      };
    },
    commit: async (_agentId: string, request: CommitSaveRequest): Promise<SyncCommitResponse> => {
      if (this.failWith) throw this.failWith;
      this.commits.push(request);
      const current = this.record ? this.record.revision : 0;
      if (this.conflictNextCommit) {
        this.conflictNextCommit = false;
        const revision = current + 1;
        const payload = {
          ...request.payload,
          revision,
          updatedAt: '2026-01-01T00:00:03.000Z',
          deviceId: 'dev-2',
        };
        this.record = {
          revision,
          updatedAt: payload.updatedAt,
          deviceId: payload.deviceId,
          saveHash: makeSaveHash(payload),
          payload,
        };
        return { status: 'conflict', revision };
      }
      if (request.baseRevision !== current) {
        return { status: 'conflict', revision: current };
      }
      const revision = current + 1;
      this.record = {
        revision,
        updatedAt: '2026-01-01T00:00:02.000Z',
        deviceId: request.deviceId,
        saveHash: request.saveHash,
        payload: request.payload,
      };
      return { status: 'ok', revision, updatedAt: '2026-01-01T00:00:02.000Z' };
    },
    discardLegacyArchive: async (agentId: string): Promise<void> => {
      this.discarded.push(agentId);
    },
  };
}

function memoryMeta(): SyncMetaStore & { values: Map<string, string | null> } {
  const values = new Map<string, string | null>();
  return {
    values,
    getLastSyncedHash: (agentId) => values.get(agentId) ?? null,
    setLastSyncedHash: (agentId, hash) => { values.set(agentId, hash); },
  };
}

function stateWith(overrides: Partial<AppStateV3> = {}): AppStateV3 {
  return {
    ...createEmptyAppStateV3({ ownerAgentId: 'SNV-AAAA-0001', deviceId: 'dev-1', updatedAt: '2026-01-01T00:00:00.000Z' }),
    ...overrides,
  };
}

function xpState(id: string, amount: number, overrides: Partial<AppStateV3> = {}): AppStateV3 {
  return stateWith({
    xpEvents: [makeXpEvent({ source: 'achievement', sourceId: id, base: amount, createdAt: '2026-01-01T00:00:00.000Z' })],
    ...overrides,
  });
}

function cloudOf(state: AppStateV3, revision: number): CloudSaveRecord {
  return {
    revision,
    updatedAt: state.updatedAt,
    deviceId: state.deviceId,
    saveHash: makeSaveHash(state),
    payload: state,
  };
}

function envelopeOf(state: AppStateV3, revision = 0): SaveEnvelope {
  return {
    schemaVersion: 3,
    ownerAgentId: state.ownerAgentId,
    revision,
    updatedAt: state.updatedAt,
    deviceId: state.deviceId,
    saveHash: makeSaveHash(state),
    payload: state,
  };
}

function createHarness(initial: AppStateV3, cloud: FakeCloud, meta = memoryMeta()) {
  let local = initial;
  const applied: AppStateV3[] = [];
  const appliedSources: Array<'download' | 'upload'> = [];
  const engine = createSyncEngine({
    client: cloud.client,
    deviceId: 'dev-1',
    getState: () => local,
    setState: (next, source) => { local = next; applied.push(next); appliedSources.push(source); },
    meta,
    now: () => '2026-01-01T00:00:05.000Z',
  });
  return {
    engine,
    meta,
    applied,
    appliedSources,
    getLocal: () => local,
    setLocal: (next: AppStateV3) => { local = next; },
  };
}

/* -------------------------------------------------------------------------
   KARAR MATRİSİ (SAF)
   ------------------------------------------------------------------------- */

describe('decideSyncAction — karar matrisi', () => {
  const base = {
    localHash: 'local-hash',
    localRevision: 4,
    localOwnerAgentId: 'SNV-AAAA-0001',
    localEmpty: false,
    lastSyncedHash: 'synced-hash',
  } as const;

  test('bulut yok → ilk senkron baseRevision 0 (local-only)', () => {
    expect(decideSyncAction({ ...base, cloud: null })).toEqual({ kind: 'upload', baseRevision: 0, reason: 'cloud-empty' });
  });

  test('aynı hash → yazma yok', () => {
    expect(
      decideSyncAction({ ...base, cloud: { revision: 4, saveHash: 'local-hash', ownerAgentId: 'SNV-AAAA-0001' } }),
    ).toEqual({ kind: 'none', reason: 'same' });
  });

  test('yerel temiz + bulut ileride → indir (cloud-ahead)', () => {
    expect(
      decideSyncAction({
        ...base,
        localHash: 'synced-hash',
        cloud: { revision: 5, saveHash: 'cloud-hash', ownerAgentId: 'SNV-AAAA-0001' },
      }),
    ).toEqual({ kind: 'download', reason: 'cloud-ahead' });
  });

  test('bulut temiz + yerel kirli → yükle (local-ahead, base=cloud.revision)', () => {
    expect(
      decideSyncAction({
        ...base,
        localHash: 'dirty-local',
        cloud: { revision: 4, saveHash: 'synced-hash', ownerAgentId: 'SNV-AAAA-0001' },
      }),
    ).toEqual({ kind: 'upload', baseRevision: 4, reason: 'local-ahead' });
  });

  test('iki taraf da değişmiş, farklı cihaz → çakışma (both-changed)', () => {
    expect(
      decideSyncAction({
        ...base,
        localDeviceId: 'dev-1',
        localHash: 'dirty-local',
        cloud: {
          revision: 5,
          saveHash: 'cloud-dirty',
          ownerAgentId: 'SNV-AAAA-0001',
          deviceId: 'dev-2',
        },
      }),
    ).toEqual({ kind: 'conflict', reason: 'both-changed' });
  });

  test('iki taraf da değişmiş ama aynı cihaz + bulut daha yeni → indir', () => {
    expect(
      decideSyncAction({
        ...base,
        localDeviceId: 'dev-1',
        localUpdatedAt: '2026-01-01T00:00:01.000Z',
        localHash: 'dirty-local',
        cloud: {
          revision: 5,
          saveHash: 'cloud-dirty',
          ownerAgentId: 'SNV-AAAA-0001',
          deviceId: 'dev-1',
          updatedAt: '2026-01-01T00:00:03.000Z',
        },
      }),
    ).toEqual({ kind: 'download', reason: 'same-device-cloud-newer' });
  });

  test('iki taraf da değişmiş ama aynı cihaz + yerel daha yeni → yükle', () => {
    expect(
      decideSyncAction({
        ...base,
        localDeviceId: 'dev-1',
        localUpdatedAt: '2026-01-01T00:00:09.000Z',
        localHash: 'dirty-local',
        cloud: {
          revision: 5,
          saveHash: 'cloud-dirty',
          ownerAgentId: 'SNV-AAAA-0001',
          deviceId: 'dev-1',
          updatedAt: '2026-01-01T00:00:03.000Z',
        },
      }),
    ).toEqual({ kind: 'upload', baseRevision: 5, reason: 'same-device-local-newer' });
  });

  test('sahip uyuşmazlığı → çakışma (owner-mismatch)', () => {
    expect(
      decideSyncAction({ ...base, cloud: { revision: 4, saveHash: 'local-hash', ownerAgentId: 'SNV-BBBB-0002' } }),
    ).toEqual({ kind: 'conflict', reason: 'owner-mismatch' });
  });

  test('içerik birebir aynıysa metadata farkı çakışma üretmez', () => {
    expect(
      decideSyncAction({
        ...base,
        localHash: 'local-zarf-hash',
        localContentHash: 'ayni-icerik',
        lastSyncedHash: 'eski-hash',
        cloud: {
          revision: 9,
          saveHash: 'bulut-zarf-hash',
          contentHash: 'ayni-icerik',
          ownerAgentId: 'SNV-BBBB-0002',
        },
      }),
    ).toEqual({ kind: 'none', reason: 'same' });
  });

  test('yerel boş + bulut dolu → indir (cloud-only)', () => {
    expect(
      decideSyncAction({
        ...base,
        localEmpty: true,
        localHash: 'empty-hash',
        cloud: { revision: 3, saveHash: 'cloud-hash', ownerAgentId: 'SNV-AAAA-0001' },
      }),
    ).toEqual({ kind: 'download', reason: 'cloud-only' });
  });

  test('eşit revizyon, yerel temiz → güncel (yankı yüklemesi yok)', () => {
    expect(
      decideSyncAction({
        ...base,
        localHash: 'synced-hash',
        cloud: { revision: 4, saveHash: 'cloud-hash', ownerAgentId: 'SNV-AAAA-0001' },
      }),
    ).toEqual({ kind: 'none', reason: 'same' });
  });
});

/* -------------------------------------------------------------------------
   MOTOR
   ------------------------------------------------------------------------- */

describe('syncEngine.sync', () => {
  test('ilk senkron: bulutta kayıt yok → baseRevision 0 ile commit, revizyon sunucudan gelir', async () => {
    const cloud = new FakeCloud();
    const local = xpState('ach:first:bronze', 10);
    const harness = createHarness(local, cloud);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('local-uploaded');
    expect(result.revision).toBe(1);
    expect(cloud.commits).toHaveLength(1);
    expect(cloud.commits[0].baseRevision).toBe(0);
    expect(harness.getLocal().revision).toBe(1);
    expect(harness.meta.getLastSyncedHash('SNV-AAAA-0001')).toBe(makeSaveHash(harness.getLocal()));
  });

  test('eski Storage arşivi app_saves’e taşınınca temizleme çağrılır', async () => {
    const cloud = new FakeCloud();
    const cloudState = stateWith({
      movies: [{ id: 'old-movie', title: 'Eski Film' }] as AppStateV3['movies'],
    });
    cloud.record = { ...cloudOf(cloudState, 0), source: 'legacy-archive' };
    const harness = createHarness(stateWith(), cloud);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('cloud-loaded');
    expect(cloud.commits).toHaveLength(1);
    expect(cloud.discarded).toEqual(['SNV-AAAA-0001']);
  });

  test('aynı kayıt → up-to-date, commit YOK', async () => {
    const cloud = new FakeCloud();
    const local = xpState('ach:first:bronze', 10);
    const meta = memoryMeta();
    meta.setLastSyncedHash('SNV-AAAA-0001', makeSaveHash(local));
    cloud.record = cloudOf(local, 3);
    const harness = createHarness(local, cloud, meta);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('up-to-date');
    expect(cloud.commits).toHaveLength(0);
  });

  test('yerel önde (bulut temiz) → cloud revision tabanıyla commit', async () => {
    const cloud = new FakeCloud();
    const synced = xpState('ach:first:bronze', 10);
    const local = xpState('ach:first:bronze', 10, { movies: [{ id: 'm1', title: 'Yeni' }] as AppStateV3['movies'] });
    const meta = memoryMeta();
    meta.setLastSyncedHash('SNV-AAAA-0001', makeSaveHash(synced));
    cloud.record = cloudOf(synced, 2);
    const harness = createHarness(local, cloud, meta);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('local-uploaded');
    expect(cloud.commits[0].baseRevision).toBe(2);
    expect(result.revision).toBe(3);
    expect(harness.getLocal().revision).toBe(3);
  });

  test('bulut önde (yerel temiz) → bulut yüklenir, yerel revizyon sunucudan', async () => {
    const cloud = new FakeCloud();
    const local = xpState('ach:first:bronze', 10, { revision: 1 });
    const remote = xpState('ach:cloud:gold', 40, { revision: 5, movies: [{ id: 'cloud-movie', title: 'Buluttan' }] as AppStateV3['movies'] });
    const meta = memoryMeta();
    meta.setLastSyncedHash('SNV-AAAA-0001', makeSaveHash(local));
    cloud.record = cloudOf(remote, 5);
    const harness = createHarness(local, cloud, meta);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('cloud-loaded');
    expect(result.revision).toBe(5);
    expect(harness.getLocal().revision).toBe(5);
    expect(harness.getLocal().movies[0].id).toBe('cloud-movie');
    expect(cloud.commits).toHaveLength(0);
  });

  test('iki taraf da değişti → kullanıcıya sorulmadan GÜVENLİ BİRLEŞİR', async () => {
    const cloud = new FakeCloud();
    const local = xpState('ach:local', 10, { revision: 2 });
    // Farklı cihaz da olsa modal ÇIKMAZ: iki dal otomatik birleşir.
    const remote = xpState('ach:cloud', 40, { revision: 3, deviceId: 'dev-2' });
    const meta = memoryMeta();
    meta.setLastSyncedHash('SNV-AAAA-0001', 'fnv1a-00000000-1');
    cloud.record = cloudOf(remote, 3);
    const harness = createHarness(local, cloud, meta);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('local-uploaded');
    expect(result.revision).toBe(4);
    expect(cloud.commits).toHaveLength(1);
    expect(cloud.commits[0].baseRevision).toBe(3);
    // İki tarafın XP kayıtları da korunur (hiçbir veri kaybolmaz).
    const committedXp = sumXpEvents(cloud.record?.payload.xpEvents ?? []);
    expect(committedXp).toBe(50);
    expect(harness.engine.hasPendingConflict()).toBe(false);
    expect(harness.getLocal().revision).toBe(4);
  });

  test('aynı cihazda bulut daha yeni → soru sorulmadan indirilir', async () => {
    const cloud = new FakeCloud();
    const local = xpState('ach:local', 10, {
      revision: 2,
      updatedAt: '2026-01-01T00:00:01.000Z',
    });
    const remote = xpState('ach:cloud', 40, {
      revision: 3,
      deviceId: 'dev-1',
      updatedAt: '2026-01-01T00:00:03.000Z',
    });
    const meta = memoryMeta();
    meta.setLastSyncedHash('SNV-AAAA-0001', 'fnv1a-00000000-1');
    cloud.record = cloudOf(remote, 3);
    const harness = createHarness(local, cloud, meta);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('cloud-loaded');
    expect(harness.engine.hasPendingConflict()).toBe(false);
    expect(harness.getLocal().xpEvents.some((event) => event.sourceId === 'ach:cloud')).toBe(true);
  });

  test('aynı cihazda yerel daha yeni → soru sorulmadan yüklenir', async () => {
    const cloud = new FakeCloud();
    const local = xpState('ach:local', 10, {
      revision: 2,
      updatedAt: '2026-01-01T00:00:09.000Z',
    });
    const remote = xpState('ach:cloud', 40, {
      revision: 3,
      deviceId: 'dev-1',
      updatedAt: '2026-01-01T00:00:03.000Z',
    });
    const meta = memoryMeta();
    meta.setLastSyncedHash('SNV-AAAA-0001', 'fnv1a-00000000-1');
    cloud.record = cloudOf(remote, 3);
    const harness = createHarness(local, cloud, meta);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('local-uploaded');
    expect(harness.engine.hasPendingConflict()).toBe(false);
    expect(cloud.commits).toHaveLength(1);
    expect(cloud.commits[0].baseRevision).toBe(3);
  });

  test('commit yarışı çözülemezse → yazma ertelenir (hata), modal olmadan', async () => {
    const cloud = new FakeCloud();
    const local = xpState('ach:local', 10, { revision: 2 });
    const remote = xpState('ach:cloud', 40, { revision: 3 });
    const meta = memoryMeta();
    // Bulut temiz görünüyor (lastSynced = cloud hash) → yerel yükleme denenir.
    meta.setLastSyncedHash('SNV-AAAA-0001', makeSaveHash(remote));
    cloud.record = cloudOf(remote, 3);
    // Araya başka bir cihaz girdi: sunucu her commit'i reddediyor.
    let commitAttempts = 0;
    const racingClient: SyncClient = {
      getRemote: async () => cloudOf({ ...remote, deviceId: 'dev-2' }, 4),
      getRemoteMeta: async () => {
        const rec = cloudOf({ ...remote, deviceId: 'dev-2' }, 4);
        return {
          revision: rec.revision,
          saveHash: rec.saveHash,
          updatedAt: rec.updatedAt,
          deviceId: rec.deviceId,
        };
      },
      commit: async () => {
        commitAttempts += 1;
        return { status: 'conflict', revision: 4 };
      },
    };
    const harness = createHarness(local, { ...cloud, client: racingClient } as FakeCloud, meta);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    // Modal DÜŞMEZ: denemeler tükendiğinde yazma ertelenir, yerel korunur.
    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('expected error');
    expect(result.error.retryable).toBe(true);
    expect((result as { conflict?: unknown }).conflict).toBeUndefined();
    expect(harness.getLocal()).toBe(local);
    // Her denemede birleştirilmiş gövde commit edilmeye çalışılır (+iç deneme).
    expect(commitAttempts).toBeGreaterThanOrEqual(3);
  });

  test('commit yanıtı conflict ise → revision-mismatch ve yazma yok', async () => {
    const cloud = new FakeCloud();
    const local = xpState('ach:local', 10, { revision: 1 });
    const remote = xpState('ach:cloud', 40, { revision: 1 });
    const meta = memoryMeta();
    meta.setLastSyncedHash('SNV-AAAA-0001', makeSaveHash(remote));
    cloud.record = cloudOf(remote, 1);
    cloud.client = {
      getRemote: async () => cloudOf(remote, 1),
      getRemoteMeta: async () => {
        const rec = cloudOf(remote, 1);
        return {
          revision: rec.revision,
          saveHash: rec.saveHash,
          updatedAt: rec.updatedAt,
          deviceId: rec.deviceId,
        };
      },
      // Sunucu, istemcinin gördüğünden farklı bir revizyonda: conflict.
      commit: async () => ({ status: 'conflict', revision: 2 }),
    };
    const harness = createHarness(local, cloud, meta);

    const result = await harness.engine.sync('SNV-AAAA-0001');
    expect(result.status).toBe('conflict');
    if (result.status !== 'conflict') throw new Error('expected conflict');
    expect(result.conflict.reason).toBe('revision-mismatch');
    expect(result.revision).toBe(1);
  });

  test('ağ hatası → error (network, retryable), yerel korunur', async () => {
    const cloud = new FakeCloud();
    cloud.failWith = new Error('Failed to fetch');
    const local = xpState('ach:first:bronze', 10, { revision: 2 });
    const harness = createHarness(local, cloud);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('expected error');
    expect(result.error.code).toBe('network');
    expect(result.error.retryable).toBe(true);
    expect(harness.getLocal()).toBe(local);
    expect(cloud.commits).toHaveLength(0);
  });

  test('hesap değişimi (owner mismatched) → soru sorulmadan birleşir, sahiplik geçer', async () => {
    const cloud = new FakeCloud();
    const local = xpState('ach:local', 10, { ownerAgentId: 'SNV-OLD0-0001', revision: 1 });
    const remote = xpState('ach:cloud', 40, { ownerAgentId: 'SNV-NEW0-0002', revision: 4 });
    cloud.record = cloudOf(remote, 4);
    const harness = createHarness(local, cloud);

    const result = await harness.engine.sync('SNV-NEW0-0002');

    // Modal YOK: iki hesabın verisi birleşir, kayıt hedef hesaba commit edilir.
    expect(result.status).toBe('local-uploaded');
    expect(result.revision).toBe(5);
    expect(cloud.commits).toHaveLength(1);
    expect(cloud.commits[0].baseRevision).toBe(4);
    expect(cloud.commits[0].payload.ownerAgentId).toBe('SNV-NEW0-0002');
    const committedXp = sumXpEvents(cloud.record?.payload.xpEvents ?? []);
    expect(committedXp).toBe(50);
    expect(harness.engine.hasPendingConflict()).toBe(false);
  });

  test('hesap değişimi: yerel veri "bu cihaz" yoluyla bulut hesabına yazılır', async () => {
    const cloud = new FakeCloud();
    const local = xpState('ach:local', 10, { ownerAgentId: 'SNV-OLD0-0001', revision: 1 });
    const remote = xpState('ach:cloud', 40, { ownerAgentId: 'SNV-NEW0-0002', revision: 4 });
    cloud.record = cloudOf(remote, 4);
    const harness = createHarness(local, cloud);

    const chosen = await harness.engine.pushLocal('SNV-NEW0-0002');

    expect(chosen.status).toBe('local-uploaded');
    expect(cloud.commits).toHaveLength(1);
    expect(cloud.commits[0].baseRevision).toBe(4);
    expect(cloud.commits[0].payload.ownerAgentId).toBe('SNV-NEW0-0002');
    expect(harness.getLocal().revision).toBe(5);
  });
});

/* -------------------------------------------------------------------------
   BİRLEŞTİRME (yalnız açık seçimle)
   ------------------------------------------------------------------------- */

describe('mergeForks / resolveConflict(merge)', () => {
  test('defter (source, sourceId) bazında birleşir; kayıp ve çift XP yok', () => {
    const local = stateWith({
      xpEvents: [
        makeXpEvent({ source: 'achievement', sourceId: 'ach:local', base: 10, createdAt: '2026-01-01T00:00:00.000Z' }),
        makeXpEvent({ source: 'achievement', sourceId: 'ach:shared', base: 5, createdAt: '2026-01-01T00:00:00.000Z' }),
      ],
    });
    const cloud = stateWith({
      xpEvents: [
        makeXpEvent({ source: 'achievement', sourceId: 'ach:cloud', base: 40, createdAt: '2026-01-01T00:00:00.000Z' }),
        // Aynı anahtar: bulut kopyası kazanır (6, yerel 5 değil).
        makeXpEvent({ source: 'achievement', sourceId: 'ach:shared', base: 6, createdAt: '2026-01-01T00:00:00.000Z' }),
      ],
    });

    const merged = mergeForks(local, cloud, '2026-01-01T00:00:05.000Z');

    expect(merged.xpEvents).toHaveLength(4);
    // Bulut satırı (6) korunur + fark (5-6=-1) `adjustment` kaydına yazılır:
    // hiçbir tarafın değeri sessizce atılmaz, toplam satırlarla açıklanır.
    expect(sumXpEvents(merged.xpEvents)).toBe(10 + 40 + 6 - 1);
    expect(merged.xpEvents.filter((event) => event.sourceId === 'ach:shared')).toHaveLength(1);
    const adjustment = merged.xpEvents.find(
      (event) => event.source === 'adjustment'
        && event.sourceId === 'merge-adjust:achievement:ach:shared',
    );
    expect(adjustment?.amount).toBe(-1);
    // `mergeForks` revizyonu KENDİ BAŞINA artırmaz.
    expect(merged.revision).toBe(cloud.revision);
  });

  test('kütüphane birleşir: hiçbir film kaybolmaz', () => {
    const local = stateWith({ movies: [{ id: 'local-movie', title: 'Yerel' }] as AppStateV3['movies'] });
    const cloud = stateWith({ movies: [{ id: 'cloud-movie', title: 'Bulut' }] as AppStateV3['movies'] });

    const merged = mergeForks(local, cloud, '2026-01-01T00:00:05.000Z');
    expect(merged.movies.map((movie) => movie.id).sort()).toEqual(['cloud-movie', 'local-movie']);
  });

  test('otomatik birleştirme yeni revizyonla commit eder, XP birleşir', async () => {
    const cloud = new FakeCloud();
    const local = xpState('ach:local', 10, { revision: 2 });
    const remote = xpState('ach:cloud', 40, { revision: 3, deviceId: 'dev-2' });
    const meta = memoryMeta();
    meta.setLastSyncedHash('SNV-AAAA-0001', 'stale-hash');
    cloud.record = cloudOf(remote, 3);
    const harness = createHarness(local, cloud, meta);

    const mergedResult = await harness.engine.sync('SNV-AAAA-0001');

    expect(mergedResult.status).toBe('local-uploaded');
    expect(cloud.commits).toHaveLength(1);
    expect(cloud.commits[0].baseRevision).toBe(3);
    const committedXp = sumXpEvents(cloud.record?.payload.xpEvents ?? []);
    expect(committedXp).toBe(50);
    expect(harness.getLocal().revision).toBe(cloud.commits[0].payload.revision);
  });

  test('bekleyen çakışma yokken merge → error (sessiz birleştirme yok)', async () => {
    const cloud = new FakeCloud();
    const harness = createHarness(stateWith(), cloud);
    const result = await harness.engine.resolveConflict('SNV-AAAA-0001', 'merge');
    expect(result.status).toBe('error');
    expect(cloud.commits).toHaveLength(0);
  });

  test('bekleyen çakışma yokken later/cloud/local → error (modal akışı fiilen kullanılmaz)', async () => {
    const cloud = new FakeCloud();
    const local = xpState('ach:local', 10, { revision: 2 });
    const remote = xpState('ach:cloud', 40, { revision: 3, deviceId: 'dev-2' });
    const meta = memoryMeta();
    meta.setLastSyncedHash('SNV-AAAA-0001', 'x');
    cloud.record = cloudOf(remote, 3);
    const harness = createHarness(local, cloud, meta);

    // sync() çakışmayı OTOMATİK çözdüğü için bekleyen çakışma kalmaz.
    const first = await harness.engine.sync('SNV-AAAA-0001');
    expect(first.status).toBe('local-uploaded');
    expect(harness.engine.hasPendingConflict()).toBe(false);
    const result = await harness.engine.resolveConflict('SNV-AAAA-0001', 'later');
    expect(result.status).toBe('error');
    expect(cloud.commits).toHaveLength(1);
  });
});

describe('classifySyncError / geçersiz gövde', () => {
  test('yetkisiz hata unauthorized döner (retryable değil)', async () => {
    const cloud = new FakeCloud();
    cloud.failWith = new SyncEngineError('unauthorized', 'JWT expired', false);
    const harness = createHarness(stateWith(), cloud);
    const result = await harness.engine.sync('SNV-AAAA-0001');
    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('expected error');
    expect(result.error.code).toBe('unauthorized');
    expect(result.error.retryable).toBe(false);
  });

  test('V3 olmayan bulut gövdesi invalid-envelope döner', async () => {
    const cloud = new FakeCloud();
    cloud.record = { revision: 2, updatedAt: '', deviceId: '', saveHash: 'h', payload: { schemaVersion: 2 } as any };
    const harness = createHarness(stateWith(), cloud);
    const result = await harness.engine.sync('SNV-AAAA-0001');
    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('expected error');
    expect(result.error.code).toBe('invalid-envelope');
  });
});

describe('quest state — senkron kaynağı ve boş kayıt', () => {
  test('yalnız görev aktivitesi olan kayıt "boş" sayılmaz (cloud-only indirme yok)', () => {
    expect(isEmptyState(stateWith())).toBe(true);
    expect(isEmptyState(stateWith({
      quests: { ...createEmptyAppStateV3().quests, activeQuestId: 'q-active' },
    }))).toBe(false);
    expect(isEmptyState(stateWith({
      quests: {
        ...createEmptyAppStateV3().quests,
        activeContract: {
          instanceId: 'ci_1',
          contractId: 'd_watch_2',
          startedAt: 1,
          expiresAt: 2,
          free: true,
        },
      },
    }))).toBe(false);
  });

  test('yükleme onayı setState\'e "upload" olarak bildirilir', async () => {
    const cloud = new FakeCloud();
    const harness = createHarness(stateWith(), cloud);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('local-uploaded');
    expect(harness.appliedSources).toEqual(['upload']);
  });

  test('bulut indirme setState\'e "download" olarak bildirilir', async () => {
    const cloud = new FakeCloud();
    const local = stateWith({ revision: 1 });
    const remote = xpState('ach:cloud', 40, { revision: 5, deviceId: 'dev-2' });
    const meta = memoryMeta();
    meta.setLastSyncedHash('SNV-AAAA-0001', makeSaveHash(local));
    cloud.record = cloudOf(remote, 5);
    const harness = createHarness(local, cloud, meta);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('cloud-loaded');
    expect(harness.appliedSources).toEqual(['download']);
  });

  test('içerik aynı, yalnız updatedAt/revision/deviceId farklı → çakışma yok', async () => {
    const cloud = new FakeCloud();
    const local = stateWith({
      revision: 2,
      updatedAt: '2026-01-01T00:00:05.000Z',
      deviceId: 'dev-1',
      movies: [{ id: 'm1', title: 'Aynı Film' }] as AppStateV3['movies'],
    });
    const cloudPayload: AppStateV3 = {
      ...local,
      revision: 7,
      updatedAt: '2026-01-01T00:00:04.000Z',
      deviceId: 'dev-2',
    };
    const meta = memoryMeta();
    meta.setLastSyncedHash('SNV-AAAA-0001', 'stale-hash');
    cloud.record = {
      revision: 7,
      updatedAt: cloudPayload.updatedAt,
      deviceId: 'dev-2',
      saveHash: makeSaveHash(cloudPayload),
      payload: cloudPayload,
    };
    const harness = createHarness(local, cloud, meta);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('up-to-date');
    expect(harness.applied).toHaveLength(0);
  });

  test('makeContentHash metadata değişimini yok sayar, içerik değişimini yakalar', () => {
    const base = stateWith({
      revision: 2,
      updatedAt: '2026-01-01T00:00:05.000Z',
      deviceId: 'dev-1',
      movies: [{ id: 'm1', title: 'Film' }] as AppStateV3['movies'],
    });
    const metadataOnly = { ...base, revision: 9, updatedAt: '2026-01-01T00:00:09.000Z', deviceId: 'dev-9' };
    const contentChanged = {
      ...base,
      movies: [{ id: 'm1', title: 'Film' }, { id: 'm2', title: 'Yeni' }] as AppStateV3['movies'],
    };

    expect(makeContentHash(metadataOnly)).toBe(makeContentHash(base));
    expect(makeSaveHash(metadataOnly)).not.toBe(makeSaveHash(base));
    expect(makeContentHash(contentChanged)).not.toBe(makeContentHash(base));
  });

  test('cihaza özel/ayar alanları ve dizi sırası çakışma hash’ini değiştirmez', () => {
    const base = stateWith({
      movies: [
        { id: 'm2', title: 'İkinci' },
        { id: 'm1', title: 'Birinci' },
      ] as AppStateV3['movies'],
    });
    const sameContentDifferentUi: AppStateV3 = {
      ...base,
      settings: { ...base.settings, theme: 'light', nickname: 'Başka İsim' },
      tutorial: { ...base.tutorial, welcomeDone: true, completed: ['welcome'] },
      academy: { ...base.academy, started: true, step: 3 },
      equipped: { ...base.equipped, badgeId: 'badge-x' },
      activeEffects: [{ itemId: 'util_xp_boost', charges: 1 }],
      pinnedContract: { week: '2026-W20', contractId: 'd_watch_2' },
      marketIntroSeen: true,
      marketRerollNonce: 4,
      marketDailyNonce: 7,
      marketWeeklyNonce: 2,
      coins: 999,
      dailyStreakDate: '2026-05-20',
      lastWatchDate: '2026-05-20',
      externalActions: [{ id: 'x' } as NonNullable<AppStateV3['externalActions']>[number]],
      movies: [
        { id: 'm1', title: 'Birinci' },
        { id: 'm2', title: 'İkinci' },
      ] as AppStateV3['movies'],
    };

    expect(makeContentHash(sameContentDifferentUi)).toBe(makeContentHash(base));
    // Film puanı gibi işlenmiş gerçek veri değişirse hash DEĞİŞİR.
    const ratingChanged: AppStateV3 = {
      ...sameContentDifferentUi,
      movies: sameContentDifferentUi.movies.map((movie) => (
        movie.id === 'm1' ? { ...movie, rating: 8 } : movie
      )),
    };
    expect(makeContentHash(ratingChanged)).not.toBe(makeContentHash(base));
  });

  test('otomatik sayaçlar ve başarım ilerleme sayısı çakışma hash’ine girmez', () => {
    const base = stateWith({
      achievements: [
        { achievementId: 'watch_count', current: 5, unlockedTiers: ['bronze'], lastNotifiedTier: null, tierDates: {} },
      ] as AppStateV3['achievements'],
    });
    const autoCountersChanged: AppStateV3 = {
      ...base,
      dailyStreak: 44,
      marketStats: { ...stateWith().marketStats, rerollCount: 99 } as AppStateV3['marketStats'],
      totalDuelsCompleted: 33,
      giantSlayerWins: 12,
      achievements: base.achievements.map((item) => (
        item.achievementId === 'watch_count' ? { ...item, current: 8, lastNotifiedTier: 'bronze', unlockedAt: '2026-06-01T00:00:00.000Z' } : item
      )),
    } as AppStateV3;

    // Kullanıcı hiçbir şey yapmadan değişen alanlar çakışma üretmez.
    expect(makeContentHash(autoCountersChanged)).toBe(makeContentHash(base));
    // Ama gerçek işlenmiş veri (açılmış kademeler) hâlâ hash'te korunur.
    const tierOpened: AppStateV3 = {
      ...base,
      achievements: base.achievements.map((item) => (
        item.achievementId === 'watch_count' ? { ...item, unlockedTiers: ['bronze', 'silver'] } : item
      )),
    };
    expect(makeContentHash(tierOpened)).not.toBe(makeContentHash(base));
  });

  test('film/başarım içindeki saat ve bildirim alanları çakışma hash’ine girmez', () => {
    const achievement = {
      achievementId: 'first_watch',
      current: 1,
      unlockedTiers: ['bronze'],
      lastNotifiedTier: null,
      tierDates: { bronze: '2026-01-01T00:00:00.000Z' },
    };
    const base = stateWith({
      movies: [
        { id: 'm1', title: 'Film', addedAt: '2026-01-01T00:00:00.000Z' },
      ] as AppStateV3['movies'],
      achievements: [achievement] as AppStateV3['achievements'],
    });
    const clockAndNotificationChanged: AppStateV3 = {
      ...base,
      movies: [
        {
          ...base.movies[0],
          startedAt: '2026-01-02T00:00:00.000Z',
          addedAt: '2026-01-02T00:00:00.000Z',
        },
      ] as AppStateV3['movies'],
      achievements: [
        { ...achievement, lastNotifiedTier: 'bronze' },
      ] as AppStateV3['achievements'],
    };

    expect(makeContentHash(clockAndNotificationChanged)).toBe(makeContentHash(base));
  });

  test('iki taraf kirli ama yalnızca ayar/cihaz alanları farklıysa çakışma yok', async () => {
    const cloud = new FakeCloud();
    const local = stateWith({
      settings: { ...stateWith().settings, theme: 'dark' },
      movies: [{ id: 'm1', title: 'Aynı Film' }] as AppStateV3['movies'],
    });
    const cloudPayload: AppStateV3 = {
      ...local,
      settings: { ...local.settings, theme: 'light' },
      revision: 5,
      updatedAt: '2026-01-01T00:00:04.000Z',
      deviceId: 'dev-2',
    };
    const meta = memoryMeta();
    meta.setLastSyncedHash('SNV-AAAA-0001', 'stale-hash');
    cloud.record = cloudOf(cloudPayload, 5);
    const harness = createHarness(local, cloud, meta);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('up-to-date');
    expect(harness.applied).toHaveLength(0);
  });

  test('yalnızca yerel ayar değiştiyse çakışma değil, normal yükleme yapılır', async () => {
    const cloud = new FakeCloud();
    const local = stateWith({
      settings: { ...stateWith().settings, theme: 'dark' },
      movies: [{ id: 'm1', title: 'Aynı Film' }] as AppStateV3['movies'],
    });
    const cloudPayload: AppStateV3 = {
      ...local,
      settings: { ...local.settings, theme: 'light' },
      revision: 4,
      updatedAt: '2026-01-01T00:00:04.000Z',
      deviceId: 'dev-2',
    };
    const meta = memoryMeta();
    cloud.record = cloudOf(cloudPayload, 4);
    meta.setLastSyncedHash('SNV-AAAA-0001', makeSaveHash(cloudPayload));
    const harness = createHarness(local, cloud, meta);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('local-uploaded');
    expect(harness.appliedSources).toEqual(['upload']);
  });

  test('yalnızca bulut ayarı değiştiyse çakışma değil, normal indirme yapılır', async () => {
    const cloud = new FakeCloud();
    const local = stateWith({ settings: { ...stateWith().settings, theme: 'dark' } });
    const cloudPayload: AppStateV3 = {
      ...local,
      settings: { ...local.settings, theme: 'light' },
      revision: 8,
      updatedAt: '2026-01-01T00:00:04.000Z',
      deviceId: 'dev-2',
    };
    const meta = memoryMeta();
    cloud.record = cloudOf(cloudPayload, 8);
    meta.setLastSyncedHash('SNV-AAAA-0001', makeSaveHash(local));
    const harness = createHarness(local, cloud, meta);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('cloud-loaded');
    expect(harness.appliedSources).toEqual(['download']);
  });

  test('commit yarışında içerik aynıysa çakışma yerine up-to-date döner', async () => {
    const cloud = new FakeCloud();
    const local = stateWith({
      movies: [{ id: 'm1', title: 'Aynı Film' }] as AppStateV3['movies'],
    });
    cloud.conflictNextCommit = true;
    const harness = createHarness(local, cloud);

    const result = await harness.engine.sync('SNV-AAAA-0001');

    expect(result.status).toBe('up-to-date');
    expect(harness.appliedSources).toEqual([]);
  });

  /* -------------------------------------------------------------------------
     TAŞIMA KATMANI SIKIŞTIRMA (gzip + base64)
     ------------------------------------------------------------------------- */

  describe('compressCloudPayload / decompressCloudPayload', () => {
    test('tekrarlanan büyük içerik gzip zarfına sarılır', async () => {
      const repetitive: AppStateV3 = stateWith({
        movies: Array.from({ length: 200 }, (_, i) => ({
          id: `m${i}`,
          title: 'Tekrarlanan Film',
          year: '2026',
          genres: ['drama'],
          collectionId: null,
          watched: true,
          rating: 5,
          note: 'Aynı not buraya kadar',
          watchedAt: '2026-01-01T00:00:00.000Z',
        })) as AppStateV3['movies'],
      });

      const result = await compressCloudPayload(repetitive);

      // Gzip + base64 sarmalanmış olmalı
      expect(result).not.toBeNull();
      expect(result?.['__sinevia_gz']).toBe(true);
      expect(typeof result?.d).toBe('string');
      expect(result!.d.length).toBeGreaterThan(0);
    });

    test('küçük içerik sıkıştırılmaz (kazanç yok)', async () => {
      const small = { a: 1, b: 2 };
      const result = await compressCloudPayload(small);
      expect(result).toBeNull();
    });

    test('sıkıştır → açar döndürür aynı içeriği', async () => {
      const state = stateWith({
        movies: [{ id: 'm1', title: 'Film' }] as AppStateV3['movies'],
        achievements: [
          { achievementId: 'a1', current: 1, unlockedTiers: ['bronze'], tierDates: {} },
        ] as AppStateV3['achievements'],
      });

      const compressed = await compressCloudPayload(state);
      // Küçük olabilir null döner; büyükse zarf açılır.
      const decompressed = compressed ? await decompressCloudPayload(compressed) : state;
      expect(JSON.stringify(decompressed)).toBe(JSON.stringify(state));
    });

    test('düz payload (zarf olmayan) olduğu gibi geçer', async () => {
      const plain = { foo: 'bar' };
      expect(await decompressCloudPayload(plain)).toBe(plain);
      expect(await decompressCloudPayload(null)).toBeNull();
    });
  });

  describe('normalizeCloudRecord gzip açma (createSupabaseSyncClient)', () => {
    test('zarflı kayıt düz payload olarak döner', async () => {
      const state = stateWith({
        movies: [{ id: 'm1', title: 'Film' }] as AppStateV3['movies'],
      });
      const wrapper = await compressCloudPayload(state);
      expect(wrapper).not.toBeNull();

      const cloudRecord = {
        revision: 3,
        save_hash: makeSaveHash(state),
        payload: wrapper!,
        updated_at: '2026-01-01T00:00:02.000Z',
      };
      const fakeRpc: SyncRpcClient = {
        rpc: (_name: string, params: Record<string, unknown>) => {
          // `sync_get_state` → cloud record döndür
          return Promise.resolve({ data: [cloudRecord], error: null });
        },
      };
      const client = createSupabaseSyncClient(fakeRpc);

      const normalized = await (client as any).getRemote('SNV-AAAA-0001');
      expect(normalized?.payload).toEqual(state);
      expect(normalized?.saveHash).toBe(makeSaveHash(state));
    });

    test('sıfır kaydı null döner', async () => {
      const fakeRpc: SyncRpcClient = {
        rpc: () => Promise.resolve({ data: null, error: null }),
      };
      const client = createSupabaseSyncClient(fakeRpc);
      const normalized = await (client as any).getRemote('SNV-AAAA-0001');
      expect(normalized).toBeNull();
    });
  });

  describe('commit transport paketlemesi (p_payload)', () => {
    test('commit gövdeyi düz gönderir (SQL xpEvents okuyabilir), saveHash düz gövde üzerinden', async () => {
      const repetitive: AppStateV3 = stateWith({
        movies: Array.from({ length: 300 }, (_, i) => ({
          id: `m${i}`,
          title: 'Tekrarlanan Film',
          year: '2026',
          genres: ['drama'],
          collectionId: null,
          watched: true,
          rating: 5,
          note: 'Aynı not buraya kadar',
          watchedAt: '2026-01-01T00:00:00.000Z',
        })) as AppStateV3['movies'],
      });

      const captured: Record<string, unknown>[] = [];
      const fakeRpc: SyncRpcClient = {
        rpc: (_name: string, params: Record<string, unknown>) => {
          captured.push(params);
          // sync_get_state → kayıt yok (ilk upload)
          if ((_name as string).includes('getState')) {
            return Promise.resolve({ data: null, error: null });
          }
          // sync_commit → başarılı yanıt
          return Promise.resolve({ data: { status: 'ok', revision: 1, save_hash: makeSaveHash(repetitive) }, error: null });
        },
      };
      const client = createSupabaseSyncClient(fakeRpc);
      const engine = createSyncEngine({
        client,
        deviceId: 'dev-1',
        getState: () => repetitive,
        setState: () => {},
        meta: memoryMeta(),
        now: () => '2026-01-01T00:00:05.000Z',
      });

      const result = await engine.pushLocal('SNV-AAAA-0001');

      expect(result.status).toBe('local-uploaded');
      const commitParams = captured.find((p) => p.p_payload !== undefined);
      expect(commitParams).toBeDefined();
      // p_payload düz V3 gövdesi olmalı: SQL sync_commit p_payload->'xpEvents'
      // üzerinden total_xp hesaplar; gzip zarfı bu hesabı bozar.
      const pPayload = commitParams!.p_payload;
      expect(isGzipWrapper(pPayload)).toBe(false);
      expect((pPayload as AppStateV3).xpEvents).toBeDefined();
      // saveHash düz gövde üzerinden hesaplanmalı.
      expect(typeof commitParams!.p_save_hash).toBe('string');
      expect(commitParams!.p_save_hash).toMatch(/^fnv1a-/);
    });
  });

  /* yardımcı: GzipWrapper tipi doğrudan erişim için */
  function isGzipWrapper(value: unknown): value is { __sinevia_gz: true; d: string } {
    return Boolean(
      value
      && typeof value === 'object'
      && (value as Record<string, unknown>)['__sinevia_gz'] === true
      && typeof (value as Record<string, unknown>).d === 'string',
    );
  }
});
