import { describe, test, expect } from 'vitest';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CloudConflictModal, { conflictingSummaryKeys, formatConflictDate } from '../components/CloudConflictModal';
import type { SyncConflict, SyncSnapshotSummary } from '../types/sync';

// ============================================================================
// BULUT ÇAKIŞMA MODALI — SSR smoke: sunum var, iş mantığı yok
// ============================================================================

const local: SyncSnapshotSummary = {
  totalXp: 725,
  level: 4,
  movies: 12,
  series: 3,
  achievements: 8,
  quests: 5,
  updatedAt: '2026-11-01T10:00:00.000Z',
};

const cloud: SyncSnapshotSummary = {
  totalXp: 800,
  level: 4,
  movies: 14,
  series: 3,
  achievements: 9,
  quests: 5,
  updatedAt: '2026-11-01T09:00:00.000Z',
};

const conflict: SyncConflict = {
  reason: 'both-changed',
  local,
  cloud,
  localRevision: 7,
  cloudRevision: 9,
};

const render = (props: Partial<ComponentProps<typeof CloudConflictModal>> = {}) =>
  renderToStaticMarkup(<CloudConflictModal conflict={conflict} onChoose={() => {}} {...props} />);

describe('CLOUD CONFLICT MODAL', () => {
  test('erişilebilir dialog + iki tarafın özetleri yan yana', () => {
    const html = render();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Bu Cihaz');
    expect(html).toContain('Bulut');
    expect(html).toContain('725 XP');
    expect(html).toContain('800 XP');
    expect(html).toContain('Son güncelleme');
  });

  test('dört seçenek butonu ve erişilebilir etiketleri var', () => {
    const html = render();
    expect(html).toContain('Bulutu Kullan');
    expect(html).toContain('Bu Cihazı Kullan');
    expect(html).toContain('Birleştir');
    expect(html).toContain('Sonra');
    expect(html).toContain('aria-label="Bulut kaydını kullan"');
    expect(html).toContain('aria-label="Bu cihazdaki kaydı kullan"');
    expect(html).toContain('aria-label="Şimdi karar verme, sonra devam et"');
  });

  test('birleştirme varsayılan değil: açık onay adımı başlangıçta kapalı', () => {
    const html = render();
    expect(html).not.toContain('Onaylıyorum, Birleştir');
    expect(html).not.toContain('Birleştirmeyi onayla');
    expect(html).toContain('onay gerektirir');
  });

  test('busy iken aria-busy ve devre dışı butonlar', () => {
    const html = render({ busy: true });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Seçim uygulanıyor...');
  });

  test('farklı özet anahtarlarını işaretler', () => {
    const keys = conflictingSummaryKeys(local, cloud);
    expect(keys.has('totalXp')).toBe(true);
    expect(keys.has('movies')).toBe(true);
    expect(keys.has('level')).toBe(false);
    expect(keys.has('series')).toBe(false);
  });

  test('tarih biçimi geçersiz değerde güvenli', () => {
    expect(formatConflictDate('')).toBe('Bilinmiyor');
    expect(formatConflictDate('bozuk')).toBe('Bilinmiyor');
    expect(formatConflictDate('2026-11-01T10:00:00.000Z')).not.toBe('Bilinmiyor');
  });
});
