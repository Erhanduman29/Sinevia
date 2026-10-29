/**
 * appBackup — tam yedek / bulut eşitleme yardımcıları.
 *
 * Çekirdek kütüphane AppContext state'inde tutulur; görevler, tutorial,
 * akademi arayüzü ve küçük tercihler ise ayrı localStorage anahtarlarındadır.
 * Bu modül, yedek dosyasına ve Supabase arşivine giden payload'ın bu ek
 * durumların TAMAMINI taşımasını sağlar.
 */

export const BACKUP_VERSION = 2;

export const BACKUP_EXTRA_KEYS = {
  tutorial: 'sinevia-tutorial-v1',
  academyUi: 'sinevia-academy-ui-v1',
  sound: 'sinevia_sound_enabled',
  shortcuts: 'sinevia_shortcuts_v1',
} as const;

export type BackupExtraKey = keyof typeof BACKUP_EXTRA_KEYS;
export type BackupExtras = Partial<Record<BackupExtraKey, unknown>>;

const QUEST_STORAGE_KEY = 'sinevia-quests-v1';

/** localStorage değerini JSON ise parse ederek, düz metinse olduğu gibi okur. */
function readExtraValue(storageKey: string): unknown {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw == null) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  } catch {
    return undefined;
  }
}

/** Bu cihazdaki tüm ek durumları oku (yedek ve bulut payload'ı için). */
export function readBackupExtras(): BackupExtras {
  const extras: BackupExtras = {};
  for (const [name, storageKey] of Object.entries(BACKUP_EXTRA_KEYS) as [BackupExtraKey, string][]) {
    const value = readExtraValue(storageKey);
    if (value !== undefined) extras[name] = value;
  }
  return extras;
}

/** Gelen payload'daki bilinen ek durumları seç (eski yedeklerde eksik olabilir). */
export function pickBackupExtras(incoming: unknown): BackupExtras {
  const extras: BackupExtras = {};
  if (!incoming || typeof incoming !== 'object') return extras;
  const source = incoming as Record<string, unknown>;
  for (const name of Object.keys(BACKUP_EXTRA_KEYS) as BackupExtraKey[]) {
    if (Object.prototype.hasOwnProperty.call(source, name) && source[name] !== undefined) {
      extras[name] = source[name];
    }
  }
  return extras;
}

/** Ek durumları localStorage'a yaz. En az bir değer yazıldıysa true döner. */
export function applyBackupExtras(extras: BackupExtras): boolean {
  let applied = false;
  for (const [name, storageKey] of Object.entries(BACKUP_EXTRA_KEYS) as [BackupExtraKey, string][]) {
    if (!Object.prototype.hasOwnProperty.call(extras, name)) continue;
    const value = extras[name];
    if (value === undefined) continue;
    try {
      localStorage.setItem(storageKey, typeof value === 'string' ? value : JSON.stringify(value));
      applied = true;
    } catch {
      /* kota dolu / localStorage yok — diğer anahtarları denemeye devam et */
    }
  }
  if (applied) {
    try { window.dispatchEvent(new CustomEvent('sinevia-sync-extras-applied')); } catch { /* yok */ }
  }
  return applied;
}

/** Görev durumunu yaz ve QuestContext'in anında yeniden yüklemesini sağla. */
export function writeQuestState(quests: unknown): boolean {
  if (quests == null) return false;
  try {
    localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(quests));
    window.dispatchEvent(new CustomEvent('sinevia-quests-restored'));
    return true;
  } catch {
    return false;
  }
}

/** Tam yedek dosyası için sürümlü payload üret. */
export function buildBackupPayload(core: unknown, quests: unknown, extras: BackupExtras) {
  return {
    sineviaBackup: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    core,
    quests: quests ?? null,
    ...extras,
  };
}

/**
 * Yeni sürümlü tam yedeği veya eski çekirdek-only yedeği normalize eder.
 * `core` her iki durumda da kütüphane verisidir.
 */
export function parseBackupPayload(incoming: unknown): { core: any; quests: unknown | null; extras: BackupExtras } {
  const source = (incoming && typeof incoming === 'object' ? incoming : {}) as Record<string, any>;
  const hasEnvelope = Boolean(source.core && typeof source.core === 'object');
  const core = hasEnvelope ? source.core : source;
  const quests = hasEnvelope && source.quests != null ? source.quests : null;
  return { core, quests, extras: pickBackupExtras(source) };
}

/** Görev verisini localStorage'dan oku (yedeğe koymak için). */
export function readQuestState(): unknown | null {
  try {
    const raw = localStorage.getItem(QUEST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
