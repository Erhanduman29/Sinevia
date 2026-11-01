import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AppStateV3 } from '../types/appState';
import type { CloudSaveRecord, CommitSaveRequest } from '../types/sync';
import { createEmptyAppStateV3, migrateLegacyToV3, toLegacyCoreView } from '../lib/localStateV3';
import { pickStoredStateV3 } from '../lib/storageService';
import { makeSaveHash } from '../lib/syncContract';
import {
  createSupabaseSyncClient,
  createSyncEngine,
  needsOwnerUploadConfirmation,
  shouldRunSync,
  SYNC_RPC,
  type SyncClient,
  type SyncCommitResponse,
  type SyncMetaStore,
  type SyncRpcClient,
} from '../lib/syncEngine';
import { migrateLegacyXp, sumXpEvents } from '../lib/xpLedger';
import { marketXpSourceId } from '../lib/marketItems';
import { ACHIEVEMENT_DEFS } from '../lib/achievements';
import { rootReducer, type ExtendedAppData } from '../context/AppContext';

/* =========================================================================
   V3 ENTEGRASYON — iki cihaz, hesap değişimi, yedek, göç ve SQL sözleşmesi
   ========================================================================= */

/** SQL davranışını taklit eden çok hesaplı sahte bulut (base_revision şartı). */
class FakeCloud {
  records = new Map<string, CloudSaveRecord>();
  commits: Array<{ agentId: string; request: CommitSaveRequest }> = [];

  client: SyncClient = {
    getRemote: async (agentId: string): Promise<CloudSaveRecord | null> => {
      const record = this.records.get(agentId);
      return record ? JSON.parse(JSON.stringify(record)) : null;
    },
    commit: async (agentId: string, request: CommitSaveRequest): Promise<SyncCommitResponse> => {
      this.commits.push({ agentId, request });
      const current = this.records.get(agentId)?.revision ?? 0;
      if (request.baseRevision !== current) {
        return { status: 'conflict', revision: current, reason: 'revision-mismatch' };
      }
      const revision = current + 1;
      this.records.set(agentId, {
        revision,
        updatedAt: '2026-01-01T00:00:02.000Z',
        deviceId: request.deviceId,
        saveHash: request.saveHash,
        payload: request.payload,
      });
      return { status: 'ok', revision, updatedAt: '2026-01-01T00:00:02.000Z' };
    },
  };
}

function memoryMeta(): SyncMetaStore {
  const values = new Map<string, string | null>();
  return {
    getLastSyncedHash: (agentId) => values.get(agentId) ?? null,
    setLastSyncedHash: (agentId, hash) => { values.set(agentId, hash); },
  };
}

function stateWith(agentId: string, overrides: Partial<AppStateV3> = {}): AppStateV3 {
  return {
    ...createEmptyAppStateV3({
      ownerAgentId: agentId,
      deviceId: 'dev-test',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    ...overrides,
  };
}

function harness(initial: AppStateV3, client: SyncClient) {
  let local = initial;
  const engine = createSyncEngine({
    client,
    deviceId: 'dev-test',
    getState: () => local,
    setState: (next) => { local = next; },
    meta: memoryMeta(),
    now: () => '2026-01-01T00:00:05.000Z',
  });
  return { engine, getLocal: () => local };
}

describe('iki cihaz — revizyon çakışması', () => {
  test('A commit ederken B aynı base ile commit ederse revision-mismatch; sessiz ezme yok', async () => {
    const cloud = new FakeCloud();
    const agentId = 'SNV-AAAA-0001';
    const aState = stateWith(agentId, { movies: [{ id: 'a-movie', title: 'A Filmi' }] as AppStateV3['movies'] });
    const bState = stateWith(agentId, { movies: [{ id: 'b-movie', title: 'B Filmi' }] as AppStateV3['movies'] });
    const a = harness(aState, cloud.client);

    // B, bulutu A'dan ÖNCE okur (kayıt yok), sonra A commit eder, sonra B commit dener.
    let raced = false;
    const racingClient: SyncClient = {
      getRemote: async (id) => {
        const before = await cloud.client.getRemote(id);
        if (!raced) {
          raced = true;
          await a.engine.pushLocal(id);
        }
        return before;
      },
      commit: (id, request) => cloud.client.commit(id, request),
    };
    const b = harness(bState, racingClient);

    const result = await b.engine.pushLocal(agentId);

    expect(result.status).toBe('conflict');
    if (result.status !== 'conflict') return;
    expect(result.conflict.reason).toBe('revision-mismatch');
    // B'nin base 0 denemesi sunucuda reddedildi; buluttaki kayıt A'nın verisi.
    expect(cloud.commits.map((entry) => entry.request.baseRevision)).toEqual([0, 0]);
    expect(cloud.records.get(agentId)?.payload.movies.map((movie) => movie.id)).toEqual(['a-movie']);
    expect(b.getLocal().movies.map((movie) => movie.id)).toEqual(['b-movie']);
  });
});

describe('hesap (owner) değişimi', () => {
  test('farklı agentId ile girişte otomatik upload yok, owner-mismatch çakışması üretilir', async () => {
    const cloud = new FakeCloud();
    const sessionAgent = 'SNV-BBBB-0002';
    const local = stateWith('SNV-AAAA-0001', {
      movies: [{ id: 'old-account', title: 'Eski Hesap' }] as AppStateV3['movies'],
    });
    const cloudState = stateWith(sessionAgent, {
      movies: [{ id: 'cloud-account', title: 'Bulut Hesabı' }] as AppStateV3['movies'],
    });
    cloud.records.set(sessionAgent, {
      revision: 4,
      updatedAt: '2026-01-01T00:00:00.000Z',
      deviceId: 'other-device',
      saveHash: makeSaveHash(cloudState),
      payload: cloudState,
    });
    const h = harness(local, cloud.client);

    const result = await h.engine.sync(sessionAgent);

    expect(result.status).toBe('conflict');
    if (result.status !== 'conflict') return;
    expect(result.conflict.reason).toBe('owner-mismatch');
    expect(cloud.commits).toHaveLength(0); // otomatik yükleme YOK
    expect(cloud.records.get(sessionAgent)?.payload.movies.map((movie) => movie.id)).toEqual(['cloud-account']);
    expect(h.getLocal().ownerAgentId).toBe('SNV-AAAA-0001');

    // "Bu cihazı buluta yükle" için sahip onayı gerekir.
    expect(needsOwnerUploadConfirmation(h.getLocal().ownerAgentId, sessionAgent)).toBe(true);
    expect(needsOwnerUploadConfirmation(sessionAgent, sessionAgent)).toBe(false);
    expect(needsOwnerUploadConfirmation(null, sessionAgent)).toBe(false);
  });
});

describe('yedekten kurtarma — otomatik senkron kapısı', () => {
  test("source='backup' otomatik sync'i durdurur; force download/upload sonrası yeniden çalışır", () => {
    const main = { broken: true };
    const backup = stateWith('SNV-AAAA-0001', {
      movies: [{ id: 'restored', title: 'Kurtarılan' }] as AppStateV3['movies'],
    });

    const picked = pickStoredStateV3(main, backup);
    expect(picked.source).toBe('backup');
    expect(picked.state).not.toBeNull();

    const baseGate = {
      hydrated: true,
      agentId: 'SNV-AAAA-0001',
      trusted: true,
      deferred: false,
      conflictPending: false,
      zeroReset: false,
    };

    // Yedekten kurtarılan kayıt: kullanıcı seçimi bekleniyor → otomatik sync YOK.
    expect(shouldRunSync({ ...baseGate, approvalPending: true })).toBe(false);
    // forceCloudDownload: approvalPending=false + deferred=false → otomatik sync yeniden çalışır.
    expect(shouldRunSync({ ...baseGate, approvalPending: false })).toBe(true);
    // forceCloudUpload: güven true + onay beklemiyor → yeniden çalışır.
    expect(shouldRunSync({ ...baseGate, trusted: true, approvalPending: false })).toBe(true);
    // Manüel seçim onay bekleyen kapıyı atlar (kullanıcı düğmeye bastı).
    expect(shouldRunSync({ ...baseGate, trusted: false, approvalPending: true }, true)).toBe(true);
    // Açık çakışma/erteleme hiçbir modda atlanmaz.
    expect(shouldRunSync({ ...baseGate, approvalPending: false, conflictPending: true }, true)).toBe(false);
  });
});

function makeV2Core(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    movies: [{ id: 'm1', title: 'Film' }],
    series: [],
    collections: [],
    history: [],
    genres: [],
    removedSeriesTitles: [],
    criteria: [],
    showcase: [],
    achievements: [],
    coins: 150,
    coinLedger: [],
    inventory: [],
    equipped: {},
    activeEffects: [],
    perks: [],
    totalXp: 1855,
    xp: 55,
    level: 9,
    theme: 'premium-dark',
    nickname: 'Test',
    agentId: 'SNV-AAAA-0001',
    ...overrides,
  };
}

describe('eski 1855 XP göçü (v1/v2 → V3)', () => {
  test('toplam korunur, ikinci göçte çift sayım yok', () => {
    const first = migrateLegacyToV3({
      core: makeV2Core({ bonusXp: 500, xpBaseline: 0 }),
      ownerAgentId: 'SNV-AAAA-0001',
      deviceId: 'dev-test',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(sumXpEvents(first.xpEvents)).toBe(1855);
    expect('bonusXp' in first).toBe(false);
    expect('xpBaseline' in first).toBe(false);

    // V3 kaydının düz görünümü ikinci kez göç ettirilirse defter otoritedir.
    const second = migrateLegacyToV3({
      core: toLegacyCoreView(first),
      ownerAgentId: 'SNV-AAAA-0001',
      deviceId: 'dev-test',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    expect(sumXpEvents(second.xpEvents)).toBe(1855);
    expect(second.xpEvents).toEqual(first.xpEvents);
  });
});

/* -------------------------------------------------------------------------
   XP MUTABAKATI — başarım + görev + kontrat + market + legacy
   ------------------------------------------------------------------------- */

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

function emptyExtended(): ExtendedAppData {
  return {
    movies: [], series: [], removedSeriesTitles: [], collections: [], genres: [],
    reviewTags: [], history: [],
    achievements: ACHIEVEMENT_DEFS.map((def) => ({
      achievementId: def.id,
      current: 0,
      unlockedTiers: [],
      tierDates: {},
      lastNotifiedTier: null,
    })),
    criteria: [], xp: 0, level: 1, totalXp: 0, xpEvents: [],
    lastWatchDate: null, dailyStreak: 0, dailyStreakDate: null,
    theme: 'premium-dark', altWatchTemplate: '', weeklyPlan: [], notificationsEnabled: false,
  } as ExtendedAppData;
}

describe('market XP anahtarı', () => {
  test('coinTx refId varsa deterministik; yoksa Date.now tabanlı', () => {
    expect(marketXpSourceId('util_daily_ink', 'buy:util_daily_ink:123:abc'))
      .toBe('market:util_daily_ink:buy:util_daily_ink:123:abc');
    // Aynı alım → aynı anahtar (idempotent).
    expect(marketXpSourceId('util_daily_ink', 'buy:util_daily_ink:123:abc', 999))
      .toBe(marketXpSourceId('util_daily_ink', 'buy:util_daily_ink:123:abc', 111));
    // Alım refId'si yoksa eski zaman tabanlı davranış korunur.
    expect(marketXpSourceId('util_daily_ink', null, 4242)).toBe('market:util_daily_ink:4242');
    expect(marketXpSourceId('util_daily_ink', '   ', 4242)).toBe('market:util_daily_ink:4242');
  });
});

describe('XP mutabakatı', () => {
  beforeEach(() => {
    storageMap.clear();
    vi.stubGlobal('localStorage', fakeStorage);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('karışık kaynaklar sonrası sum(events) === totalXp', () => {
    let state = emptyExtended();
    state.xpEvents = migrateLegacyXp({
      localTotalXp: 1855,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    state = rootReducer(state, {
      type: 'GRANT_XP', xp: 10, source: 'achievement', sourceId: 'ach:movie_add:bronze', label: 'Başarım',
    } as never);
    state = rootReducer(state, {
      type: 'GRANT_XP', xp: 50, source: 'quest', sourceId: 'quest:q1', label: 'Görev',
    } as never);
    state = rootReducer(state, {
      type: 'GRANT_CONTRACT_REWARD', xp: 120, coins: 20, refId: 'contract:inst-1', label: 'Kontrat',
    } as never);
    state = rootReducer(state, {
      type: 'GRANT_XP', xp: 200, source: 'market', sourceId: marketXpSourceId('util_discovery', 'buy:util_discovery:1'), label: 'Pazar',
    } as never);
    // Aynı market anahtarı ikinci kez → defter idempotent.
    state = rootReducer(state, {
      type: 'GRANT_XP', xp: 200, source: 'market', sourceId: marketXpSourceId('util_discovery', 'buy:util_discovery:1'), label: 'Pazar',
    } as never);

    const total = sumXpEvents(state.xpEvents);
    // Tek doğru: defter toplamı her zaman totalXp ile aynı (başka kaynak beslemez).
    expect(total).toBe(state.totalXp);
    expect(state.xpEvents?.filter((event) => event.source === 'market')).toHaveLength(1);
    const sources = new Set((state.xpEvents || []).map((event) => event.source));
    for (const source of ['legacy', 'achievement', 'quest', 'contract', 'market'] as const) {
      expect(sources.has(source)).toBe(true);
    }
    // Market anahtarı idempotent: ikinci aynı sourceId 200 XP'yi çiftlemez.
    expect(
      (state.xpEvents || [])
        .filter((event) => event.source === 'market')
        .reduce((sum, event) => sum + event.amount, 0),
    ).toBe(200);
    expect(total).toBeGreaterThanOrEqual(1855 + 10 + 50 + 120 + 200);
  });
});

/* -------------------------------------------------------------------------
   SQL İSTEMCİ SÖZLEŞMESİ (statik; canlıya dokunmaz)
   ------------------------------------------------------------------------- */

describe('SQL istemci sözleşmesi', () => {
  const functionsSql = readFileSync(
    fileURLToPath(new URL('../../supabase/schema/02_functions.sql', import.meta.url)),
    'utf8',
  );
  const combinedSql = readFileSync(
    fileURLToPath(new URL('../../supabase/schema.sql', import.meta.url)),
    'utf8',
  );

  test('syncEngine’in gönderdiği RPC adları ve parametreleri SQL imzalarıyla eşleşir', async () => {
    const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
    const rpc: SyncRpcClient = {
      rpc: (name, params) => {
        calls.push({ name, params });
        if (name === SYNC_RPC.getState) return Promise.resolve({ data: null, error: null });
        return Promise.resolve({
          data: { status: 'ok', revision: 1, save_hash: 'x', updated_at: '2026-01-01T00:00:00.000Z' },
          error: null,
        });
      },
    };
    const client = createSupabaseSyncClient(rpc, {
      supabaseUrl: 'https://test.supabase.co',
      deviceId: 'dev-test',
      fetchImpl: (async () => new Response('not found', { status: 404 })) as typeof fetch,
    });

    await client.getRemote('SNV-AAAA-0001');
    await client.commit('SNV-AAAA-0001', {
      ownerAgentId: 'SNV-AAAA-0001',
      baseRevision: 0,
      deviceId: 'dev-test',
      saveHash: 'fnv1a-test',
      payload: stateWith('SNV-AAAA-0001'),
    });

    expect(calls[0]).toEqual({ name: 'sync_get_state', params: { p_agent_id: 'SNV-AAAA-0001' } });
    expect(calls[1].name).toBe('sync_commit');
    expect(Object.keys(calls[1].params).sort()).toEqual(
      ['p_agent_id', 'p_base_revision', 'p_device_id', 'p_payload', 'p_save_hash'].sort(),
    );
    expect(calls[1].params).toMatchObject({
      p_agent_id: 'SNV-AAAA-0001',
      p_base_revision: 0,
      p_device_id: 'dev-test',
      p_save_hash: 'fnv1a-test',
    });

    // SQL imzaları istemcinin adlarıyla birebir.
    expect(functionsSql).toMatch(
      /create or replace function public\.sync_get_state\(\s*p_agent_id text\s*\)/i,
    );
    expect(functionsSql).toMatch(
      /create or replace function public\.sync_commit\(\s*p_agent_id text,\s*p_base_revision bigint,\s*p_device_id text,\s*p_save_hash text,\s*p_payload jsonb\s*\)/i,
    );
    // Kanonik birleşik şema da aynı imzaları taşımalı.
    expect(combinedSql).toMatch(/create or replace function public\.sync_get_state\(\s*p_agent_id text\s*\)/i);
    expect(combinedSql).toMatch(/create or replace function public\.sync_commit\(/i);
  });

  test('app_saves kolonları ve sync RPC grant’leri kanonik şemada tanımlı', () => {
    expect(combinedSql).toMatch(/create table if not exists public\.app_saves \(/i);
    for (const column of ['agent_id', 'revision', 'save_hash', 'payload', 'device_id', 'updated_at']) {
      expect(combinedSql).toMatch(new RegExp(`\\b${column}\\b`, 'i'));
    }
    expect(functionsSql).toMatch(/grant execute on function public\.sync_get_state\(text\) to anon, authenticated;/i);
    expect(functionsSql).toMatch(/grant execute on function public\.sync_commit\(text, bigint, text, text, jsonb\) to anon, authenticated;/i);
  });
});
