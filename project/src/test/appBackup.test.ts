import { describe, expect, test } from 'vitest';
import { BACKUP_VERSION, buildBackupPayload, parseBackupPayload } from '../lib/appBackup';

describe('Tam yedek payload biçimi', () => {
  test('yeni sürümlü yedek core, görevler ve ek durumları taşır', () => {
    const core = { movies: [{ id: 'm1' }], coins: 120 };
    const quests = { completedQuests: ['q1'], activeContract: null };
    const extras = { tutorial: { step: 3 }, sound: 'off' };
    const payload = buildBackupPayload(core, quests, extras);

    expect(payload.sineviaBackup).toBe(BACKUP_VERSION);
    expect(payload.core).toEqual(core);
    expect(payload.quests).toEqual(quests);
    expect(payload.tutorial).toEqual({ step: 3 });
    expect(payload.sound).toBe('off');

    const parsed = parseBackupPayload(payload);
    expect(parsed.core).toEqual(core);
    expect(parsed.quests).toEqual(quests);
    expect(parsed.extras.tutorial).toEqual({ step: 3 });
    expect(parsed.extras.sound).toBe('off');
  });

  test('görev verisi olmayan yeni yedekte quests null döner', () => {
    const payload = buildBackupPayload({ movies: [] }, null, {});
    expect(parseBackupPayload(payload).quests).toBeNull();
  });

  test('eski çekirdek-only yedek geriye dönük okunur', () => {
    const legacy = { movies: [{ id: 'old' }], series: [], coins: 5 };
    const parsed = parseBackupPayload(legacy);
    expect(parsed.core).toEqual(legacy);
    expect(parsed.quests).toBeNull();
    expect(parsed.extras).toEqual({});
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
