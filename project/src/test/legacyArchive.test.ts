import { describe, expect, test } from 'vitest';
import type { AppStateV3 } from '../types/appState';
import type { CommitSaveRequest } from '../types/sync';
import { createEmptyAppStateV3 } from '../lib/localStateV3';
import { makeSaveHash } from '../lib/syncContract';
import {
  createSupabaseSyncClient,
  createSyncEngine,
  legacyArchiveUrl,
  type SyncMetaStore,
  type SyncRpcClient,
} from '../lib/syncEngine';
import { sumXpEvents } from '../lib/xpLedger';

/* =========================================================================
   TEK SEFERLİK ESKİ STORAGE ARŞİVİ KÖPRÜSÜ
   app_saves boşken sinevia_saves/<agentId>.json → sahte bulut kaydı → karar
   matrisi → commit(0) ile app_saves'e taşıma.
   ========================================================================= */

const AGENT = 'SNV-LEGACY-0001';

/** app_saves + sync RPC'lerinin davranışını taklit eden sahte sunucu. */
class FakeAppSavesRpc implements SyncRpcClient {
  record: { revision: number; saveHash: string; payload: AppStateV3; updatedAt: string } | null = null;
  commits: Array<Record<string, unknown>> = [];
  /** true → commit her zaman başarılı ama kayıt yazılmaz (arşiv Set testi). */
  commitWithoutStoring = false;

  rpc(name: string, params: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> {
    if (name === 'sync_get_state') {
      if (!this.record) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({
        data: {
          revision: this.record.revision,
          save_hash: this.record.saveHash,
          payload: this.record.payload,
          updated_at: this.record.updatedAt,
        },
        error: null,
      });
    }
    if (name === 'sync_commit') {
      this.commits.push(params);
      const current = this.record?.revision ?? 0;
      const base = Number(params.p_base_revision);
      if (base !== current) {
        return Promise.resolve({
          data: { status: 'conflict', revision: current, reason: 'revision-mismatch' },
          error: null,
        });
      }
      if (!this.commitWithoutStoring) {
        this.record = {
          revision: current + 1,
          saveHash: String(params.p_save_hash),
          payload: params.p_payload as AppStateV3,
          updatedAt: '2026-01-01T00:00:02.000Z',
        };
      }
      return Promise.resolve({
        data: { status: 'ok', revision: current + 1, save_hash: params.p_save_hash, updated_at: '2026-01-01T00:00:02.000Z' },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: new Error(`bilinmeyen rpc: ${name}`) });
  }
}

function legacyCore(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    movies: [{ id: 'old-movie', title: 'Eski Film', watched: true, rating: 8 }],
    series: [],
    collections: [],
    history: [],
    genres: ['Dram'],
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
    nickname: 'Eski Üye',
    agentId: AGENT,
    ...overrides,
  };
}

function archiveJson(core: Record<string, unknown> = legacyCore()): string {
  return JSON.stringify({ sineviaBackup: 2, exportedAt: '2025-01-01T00:00:00.000Z', core, quests: null });
}

type FetchCall = { url: string; init?: RequestInit };

function fakeFetch(handler: (url: string) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    return handler(url);
  }) as typeof fetch;
  return { impl, calls };
}

function okResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
}

function memoryMeta(): SyncMetaStore {
  const values = new Map<string, string | null>();
  return {
    getLastSyncedHash: (agentId) => values.get(agentId) ?? null,
    setLastSyncedHash: (agentId, hash) => { values.set(agentId, hash); },
  };
}

function localState(overrides: Partial<AppStateV3> = {}): AppStateV3 {
  return {
    ...createEmptyAppStateV3({
      ownerAgentId: AGENT,
      deviceId: 'dev-a',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    ...overrides,
  };
}

function harness(initial: AppStateV3, client: ReturnType<typeof createSupabaseSyncClient>) {
  let local = initial;
  const applied: AppStateV3[] = [];
  const engine = createSyncEngine({
    client,
    deviceId: 'dev-a',
    getState: () => local,
    setState: (next) => { local = next; applied.push(next); },
    meta: memoryMeta(),
    now: () => '2026-01-01T00:00:05.000Z',
  });
  return { engine, applied, getLocal: () => local };
}

function makeClient(rpc: SyncRpcClient, fetchImpl: typeof fetch) {
  return createSupabaseSyncClient(rpc, {
    supabaseUrl: 'https://test.supabase.co',
    deviceId: 'dev-a',
    fetchImpl,
  });
}

describe('eski Storage arşivi — getRemote köprüsü', () => {
  test('arşiv var + yerel boş → indirilir, arşiv state uygulanır ve app_saves’e commit edilir', async () => {
    const rpc = new FakeAppSavesRpc();
    const fetch = fakeFetch(() => okResponse(archiveJson()));
    const client = makeClient(rpc, fetch.impl);
    const h = harness(localState(), client);

    const result = await h.engine.sync(AGENT);

    // Karar: cloud-only → indir. app_saves boş olduğu için aynı geçişte commit(0).
    expect(result.status).toBe('cloud-loaded');
    expect(result.revision).toBe(1);
    expect(h.getLocal().movies.map((movie) => movie.id)).toEqual(['old-movie']);
    expect(sumXpEvents(h.getLocal().xpEvents)).toBe(1855);
    expect(rpc.record?.revision).toBe(1);
    expect(rpc.commits).toHaveLength(1);
    expect(rpc.commits[0].p_base_revision).toBe(0);

    expect(fetch.calls).toHaveLength(1);
    expect(fetch.calls[0].url).toBe(legacyArchiveUrl('https://test.supabase.co', AGENT));
    expect(fetch.calls[0].init?.cache).toBe('no-store');
  });

  test('arşiv var + yerel dolu ve farklı → both-changed çakışması; otomatik yazma yok', async () => {
    const rpc = new FakeAppSavesRpc();
    const fetch = fakeFetch(() => okResponse(archiveJson()));
    const client = makeClient(rpc, fetch.impl);
    const local = localState({
      movies: [{ id: 'local-movie', title: 'Yerel Film' }] as AppStateV3['movies'],
    });
    const h = harness(local, client);

    const result = await h.engine.sync(AGENT);

    expect(result.status).toBe('conflict');
    if (result.status !== 'conflict') return;
    expect(result.conflict.reason).toBe('both-changed');
    expect(rpc.commits).toHaveLength(0);
    expect(rpc.record).toBeNull();
    expect(h.getLocal().movies.map((movie) => movie.id)).toEqual(['local-movie']);
  });

  test('arşiv yok (404) → normal ilk sync, commit base 0', async () => {
    const rpc = new FakeAppSavesRpc();
    const fetch = fakeFetch(() => new Response('not found', { status: 404 }));
    const client = makeClient(rpc, fetch.impl);
    const local = localState({
      movies: [{ id: 'fresh-movie', title: 'Yeni Film' }] as AppStateV3['movies'],
    });
    const h = harness(local, client);

    const result = await h.engine.sync(AGENT);

    expect(result.status).toBe('local-uploaded');
    expect(rpc.commits).toHaveLength(1);
    expect(rpc.commits[0].p_base_revision).toBe(0);
    expect(rpc.record?.payload.movies.map((movie) => movie.id)).toEqual(['fresh-movie']);
  });

  test('ağ hatası (404 dışı) → error + retryable, commit ÇAĞRILMAZ', async () => {
    const rpc = new FakeAppSavesRpc();
    const fetch = fakeFetch(() => Promise.reject(new Error('fetch failed')));
    const client = makeClient(rpc, fetch.impl);
    const h = harness(localState(), client);

    const result = await h.engine.sync(AGENT);

    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.error.code).toBe('network');
    expect(result.error.retryable).toBe(true);
    expect(rpc.commits).toHaveLength(0);
    expect(rpc.record).toBeNull();

    // HTTP 500 de yazma yapmaz.
    const rpc500 = new FakeAppSavesRpc();
    const fetch500 = fakeFetch(() => new Response('boom', { status: 500 }));
    const h500 = harness(localState(), makeClient(rpc500, fetch500.impl));
    const result500 = await h500.engine.sync(AGENT);
    expect(result500.status).toBe('error');
    expect(rpc500.commits).toHaveLength(0);
  });

  test('aynı oturumda arşiv ikinci kez çekilmez (commit sonrası Set)', async () => {
    const rpc = new FakeAppSavesRpc();
    rpc.commitWithoutStoring = true; // RPC kaydı yazmasa bile imported Set devrede olmalı.
    const fetch = fakeFetch(() => okResponse(archiveJson()));
    const client = makeClient(rpc, fetch.impl);

    const first = await client.getRemote(AGENT);
    expect(first?.source).toBe('legacy-archive');
    expect(fetch.calls).toHaveLength(1);

    const commit = await client.commit(AGENT, {
      ownerAgentId: AGENT,
      baseRevision: 0,
      deviceId: 'dev-a',
      saveHash: makeSaveHash(localState()),
      payload: localState(),
    } satisfies CommitSaveRequest);
    expect(commit.status).toBe('ok');

    const second = await client.getRemote(AGENT);
    expect(second).toBeNull();
    expect(fetch.calls).toHaveLength(1);
  });

  test('arşiv ilk getRemote’da servis edilir; commit olmasa da oturumda tekrar çekilmez', async () => {
    const rpc = new FakeAppSavesRpc();
    const fetch = fakeFetch(() => okResponse(archiveJson()));
    const client = makeClient(rpc, fetch.impl);

    expect((await client.getRemote(AGENT))?.source).toBe('legacy-archive');
    expect(await client.getRemote(AGENT)).toBeNull();
    expect(fetch.calls).toHaveLength(1);
  });

  test('boş RPC yanıtı ({}) de “kayıt yok” sayılır ve arşive düşer', async () => {
    const rpc: SyncRpcClient = {
      rpc: () => Promise.resolve({ data: {}, error: null }),
    };
    const fetch = fakeFetch(() => okResponse(archiveJson()));
    const client = makeClient(rpc, fetch.impl);

    const record = await client.getRemote(AGENT);
    expect(record?.source).toBe('legacy-archive');
    expect(record?.revision).toBe(0);
    expect(record?.payload.ownerAgentId).toBe(AGENT);
    // Eski arşiv bu cihazın kaydı sayılmaz: aynı-cihaz otomatik çözümüne girmez.
    expect(record?.deviceId).toBe('');
    expect(record?.saveHash).toBe(makeSaveHash(record!.payload));
  });

  test('arşivdeki farklı sahip kimliği oturum agentId’sine çekilir', async () => {
    const rpc = new FakeAppSavesRpc();
    const fetch = fakeFetch(() => okResponse(archiveJson(legacyCore({ agentId: 'SNV-OTHER-9999' }))));
    const client = makeClient(rpc, fetch.impl);

    const record = await client.getRemote(AGENT);
    expect(record?.payload.ownerAgentId).toBe(AGENT);
    expect(record?.payload.revision).toBe(0);
  });
});
