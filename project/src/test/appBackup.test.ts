import { describe, expect, test } from 'vitest';
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_VERSION,
  buildBackupPayload,
  parseBackupPayload,
} from '../lib/appBackup';
import { createEmptyAppStateV3, migrateLegacyToV3 } from '../lib/localStateV3';
import { sumXpEvents } from '../lib/xpLedger';

// ============================================================================
// Tam yedek payload biçimi — V3 kanonik kayıt + V2 geriye dönük okuma
// ============================================================================

function makeV2Core(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    movies: [{ id: 'm1', title: 'Film' }],
    series: [],
    collections: [],
    history: [],
    achievements: [],
    coins: 120,
    theme: 'midnight',
    agentId: 'SNV-AAAA-BBBB',
    totalXp: 500,
    bonusXp: 20,
    xpBaseline: 30,
    ...overrides,
  };
}

describe('Tam yedek payload biçimi', () => {
  test('yeni sürümlü yedek core, görevler ve ek durumları taşır', () => {
    const core = { movies: [{ id: 'm1' }], coins: 120 };
    const quests = { completedQuests: ['q1'], activeContract: null };
    const extras = { tutorial: { step: 3 }, sound: 'off' };
    const payload = buildBackupPayload(core, quests, extras);

    expect(payload.sineviaBackup).toBe(BACKUP_VERSION);
    expect(payload.sineviaBackup).toBe(3);
    expect(payload.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(payload.core).toEqual(core);
    expect(payload.quests).toEqual(quests);
    expect(payload.tutorial).toEqual({ step: 3 });
    expect(payload.sound).toBe('off');
    // V3 kanonik kayıt da yedeğe girer.
    expect(payload.state.schemaVersion).toBe(3);
    expect(payload.state.movies).toEqual([{ id: 'm1' }]);

    const parsed = parseBackupPayload(payload);
    expect(parsed.core).toEqual(core);
    expect(parsed.quests).toEqual(quests);
    expect(parsed.extras.tutorial).toEqual({ step: 3 });
    expect(parsed.extras.sound).toBe('off');
    expect(parsed.version).toBe(3);
    expect(parsed.migrated).toBe(false);
  });

  test('görev verisi olmayan yeni yedekte quests null döner', () => {
    const payload = buildBackupPayload({ movies: [] }, null, {});
    expect(parseBackupPayload(payload).quests).toBeNull();
  });

  test('eski çekirdek-only yedek geriye dönük okunur ve V3 state üretilir', () => {
    const legacy = { movies: [{ id: 'old' }], series: [], coins: 5, totalXp: 250 };
    const parsed = parseBackupPayload(legacy);
    expect(parsed.core).toEqual(legacy);
    expect(parsed.quests).toBeNull();
    expect(parsed.extras).toEqual({});
    expect(parsed.migrated).toBe(true);
    expect(parsed.state.schemaVersion).toBe(3);
    expect(parsed.state.coins).toBe(5);
    expect(sumXpEvents(parsed.state.xpEvents)).toBe(250);
  });

  test('eski bulut yedeğindeki tutorial/akademi alanları ek durum olarak seçilir', () => {
    const legacyCloud = {
      movies: [],
      tutorial: { step: 1 },
      academyUi: { open: true },
      sound: 'on',
    };
    const parsed = parseBackupPayload(legacyCloud);
    expect(parsed.extras).toEqual({
      tutorial: { step: 1 },
      academyUi: { open: true },
      sound: 'on',
    });
  });
});

describe('Yedek V3 — kanonik kayıt ve V2 yükseltme', () => {
  test('V3 kaydı roundtrip: state ve XP defteri birebir korunur', () => {
    const state = migrateLegacyToV3({
      core: makeV2Core({ totalXp: 1234 }),
      quests: { completedQuests: ['c_short_movie'] },
      extras: { tutorial: { welcomeDone: true }, sound: 'on' },
      updatedAt: '2026-03-01T00:00:00.000Z',
    });
    const payload = buildBackupPayload(state, null, { sound: 'on' });
    const parsed = parseBackupPayload(payload);

    expect(parsed.version).toBe(3);
    expect(parsed.state).toEqual(state);
    expect(sumXpEvents(parsed.state.xpEvents)).toBe(1234);
    expect(parsed.state.quests.completedQuests).toEqual(['c_short_movie']);
    // V2 uyumluluk görünümü de XP'yi defterden türetir.
    expect(parsed.core.totalXp).toBe(1234);
    expect(parsed.extras.sound).toBe('on');
  });

  test('V2 yedek (sineviaBackup 2) okunurken V3e yukseltilir', () => {
    const v2Backup = {
      sineviaBackup: 2,
      exportedAt: '2025-12-01T00:00:00.000Z',
      core: makeV2Core({ totalXp: 900, bonusXp: 100, xpBaseline: 0 }),
      quests: { completedQuests: ['q-a', 'q-b'], activeQuestId: 'q-a' },
      tutorial: { welcomeDone: true },
      academyUi: { started: true },
      sound: 'off',
    };

    const parsed = parseBackupPayload(v2Backup);
    expect(parsed.version).toBe(2);
    expect(parsed.migrated).toBe(true);
    expect(parsed.state.schemaVersion).toBe(3);
    expect(sumXpEvents(parsed.state.xpEvents)).toBe(900);
    expect(parsed.state.quests.completedQuests).toEqual(['q-a', 'q-b']);
    expect(parsed.state.tutorial.welcomeDone).toBe(true);
    expect(parsed.state.academy.started).toBe(true);
    expect(parsed.extras.sound).toBe('off');
    expect(parsed.state.settings.theme).toBe('midnight');
  });

  test('envelope içindeki V3 state doğrudan kullanılır', () => {
    const state = createEmptyAppStateV3({ ownerAgentId: 'SNV-AAAA-BBBB' });
    const parsed = parseBackupPayload({ sineviaBackup: 3, state, core: { movies: [] }, quests: null });
    expect(parsed.migrated).toBe(false);
    expect(parsed.state).toEqual(state);
    expect(parsed.core).toEqual({ movies: [] });
  });
});
