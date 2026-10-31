/**
 * appBackup — tam yedek / bulut eşitleme yardımcıları.
 *
 * Yedek V3'te KANONİK `AppStateV3` kaydını taşır (`state` alanı). Geriye dönük
 * uyum için `core` (V2 düz görünüm) ve `quests` alanları da yazılır; V2
 * yedekleri okunurken `migrateLegacyToV3` ile otomatik yükseltilir.
 */

import { isAppStateV3, migrateLegacyToV3, toLegacyCoreView } from './localStateV3';
import type { AppStateV3 } from '../types/appState';

export const BACKUP_VERSION = 3;
/** Yedek gövdesinin şema sürümü (AppStateV3). */
export const BACKUP_SCHEMA_VERSION = 3;

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

/** Tam yedek dosyası için sürümlü payload üret (V3 kanonik kayıt). */
export function buildBackupPayload(core: unknown, quests?: unknown, extras: BackupExtras = {}) {
  const sourceCore = core ?? {};
  const extrasRecord = extras as Record<string, unknown>;
  const state = isAppStateV3(sourceCore)
    ? sourceCore
    : migrateLegacyToV3({
        core: sourceCore,
        quests,
        extras: extrasRecord,
        ownerAgentId: readAgentId(sourceCore),
        deviceId: readDeviceId(sourceCore),
        updatedAt: new Date().toISOString(),
      });

  return {
    ...extras,
    sineviaBackup: BACKUP_VERSION,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    /** Kanonik kayıt — V3 geri yükleme bunu kullanır. */
    state,
    /** V2 uyumluluk görünümü (eski istemciler/AppContext geçiş yolu). */
    core: isAppStateV3(sourceCore) ? toLegacyCoreView(state) : sourceCore,
    quests: quests ?? null,
  };
}

function readAgentId(core: unknown): string | null {
  if (core && typeof core === 'object' && typeof (core as Record<string, unknown>).agentId === 'string') {
    return (core as Record<string, string>).agentId;
  }
  return null;
}

function readDeviceId(core: unknown): string {
  if (core && typeof core === 'object' && typeof (core as Record<string, unknown>).deviceId === 'string') {
    return (core as Record<string, string>).deviceId;
  }
  return '';
}

export interface ParsedBackupPayload {
  /** Kanonik V3 kaydı (V2 yedekleri göç ettirilerek üretilir). */
  state: AppStateV3;
  /** V2 uyumluluk görünümü; eski yedeklerde orijinal gövde. */
  core: any;
  quests: unknown | null;
  extras: BackupExtras;
  /** Yedek dosyasının sürümü (0 = eski çekirdek-only). */
  version: number;
  /** true → gövde V2'ydi ve V3'e yükseltildi. */
  migrated: boolean;
}

/**
 * Yeni sürümlü tam yedeği (V3) veya eski V2/çekirdek-only yedeği normalize eder.
 * `core` her iki durumda da kütüphane verisidir; kanonik veri `state` alanındadır.
 */
export function parseBackupPayload(incoming: unknown): ParsedBackupPayload {
  const source = (incoming && typeof incoming === 'object' ? incoming : {}) as Record<string, any>;
  const extras = pickBackupExtras(source);
  const version = typeof source.sineviaBackup === 'number' ? source.sineviaBackup : 0;
  const exportedAt = typeof source.exportedAt === 'string' ? source.exportedAt : undefined;

  // V3 zarf: `state` kanoniktir.
  if (isAppStateV3(source.state)) {
    const quests = Object.prototype.hasOwnProperty.call(source, 'quests')
      ? (source.quests ?? null)
      : source.state.quests;
    return {
      state: source.state,
      core: source.core && typeof source.core === 'object' ? source.core : toLegacyCoreView(source.state),
      quests,
      extras,
      version,
      migrated: false,
    };
  }

  const hasEnvelope = Boolean(source.core && typeof source.core === 'object');
  const core = hasEnvelope ? source.core : source;
  const quests = hasEnvelope && source.quests != null ? source.quests : null;

  // Gövde zaten V3 ise (envelope'sız V3 kaydı) doğrudan kullan.
  if (isAppStateV3(core)) {
    return { state: core, core, quests: quests ?? core.quests, extras, version, migrated: false };
  }

  const state = migrateLegacyToV3({
    core,
    quests,
    extras: extras as Record<string, unknown>,
    ownerAgentId: readAgentId(core),
    deviceId: readDeviceId(core),
    updatedAt: exportedAt,
  });
  return { state, core, quests, extras, version, migrated: true };
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
