import { describe, test, expect } from 'vitest';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CloudConflictModal, {
  CONFLICT_COPIES,
  CONFLICT_REASON_LABELS,
  ConflictConfirmPanel,
  conflictCopy,
  conflictReasonLabel,
  conflictingSummaryKeys,
  formatConflictDate,
} from '../components/CloudConflictModal';
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

  test('çakışmanın nedeni ve farklı görünen veriler açıkça yazılır', () => {
    const html = render();
    expect(html).toContain('Çakışma nedeni');
    expect(html).toContain(CONFLICT_REASON_LABELS['both-changed']);
    expect(html).toContain('Farklı görünen veriler:');
    expect(html).toContain('XP');
    expect(html).toContain('Film');
    expect(html).toContain('Başarım');
    // Yalnızca değişen satırlar nedene girer; aynı olanlar girmez.
    expect(html).toContain('725 XP');
    expect(html).toContain('800 XP');
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

  test('yalnızca güncelleme zamanı farkı çakışma göstergesi sayılmaz', () => {
    const keys = conflictingSummaryKeys(local, { ...local, updatedAt: '2026-11-02T00:00:00.000Z' });
    expect(keys.size).toBe(0);
  });

  test('tarih biçimi geçersiz değerde güvenli', () => {
    expect(formatConflictDate('')).toBe('Bilinmiyor');
    expect(formatConflictDate('bozuk')).toBe('Bilinmiyor');
    expect(formatConflictDate('2026-11-01T10:00:00.000Z')).not.toBe('Bilinmiyor');
  });
});

// ============================================================================
// NEDEN (reason) VARYANTLARI
// ============================================================================

const withReason = (reason: SyncConflict['reason']): SyncConflict => ({ ...conflict, reason });

const renderReason = (reason: SyncConflict['reason'], props: Partial<ComponentProps<typeof CloudConflictModal>> = {}) =>
  renderToStaticMarkup(
    <CloudConflictModal conflict={withReason(reason)} onChoose={() => {}} {...props} />
  );

describe('CLOUD CONFLICT MODAL — çakışma nedeni bazlı davranış', () => {
  test("'both-changed': iki tarafta da yeni değişiklik başlığı + 4 seçenek", () => {
    const html = renderReason('both-changed');
    expect(html).toContain('İki tarafta da yeni değişiklik var');
    expect(html).toContain('Bulutu Kullan');
    expect(html).toContain('Bu Cihazı Kullan');
    expect(html).toContain('Birleştir');
    expect(html).toContain('Sonra');
    // Bu varyantta hiçbir seçenek "önerilen" değil, "bu cihaz" yıkıcı değil.
    expect(html).not.toContain('ÖNERİLEN');
    expect(html).toContain('aria-label="Bu cihazdaki kaydı kullan"');
  });

  test("'owner-mismatch': başka hesap başlığı + 'bu cihazı kullan' ikinci onay ister", () => {
    const html = renderReason('owner-mismatch');
    expect(html).toContain('Bu cihazda başka bir hesabın verisi var');
    expect(html).toContain('buluttaki hesabın kaydı ezilir');
    // Başlangıçta onay paneli KAPALI, yıkıcı niyet aria-label'da bildirilir
    expect(html).not.toContain('Onaylıyorum, Bu Cihazı Kullan');
    expect(html).toContain('buluttaki hesap ezilecek, onay gerektirir');
    expect(html).toContain('aria-label="Bulut kaydını kullan"');
    expect(html).not.toContain('ÖNERİLEN');
  });

  test("'revision-mismatch': başka cihaz başlığı + 'Bulutu kullan' önerilir", () => {
    const html = renderReason('revision-mismatch');
    expect(html).toContain('Başka bir cihaz aynı anda kaydetti');
    expect(html).toContain('ÖNERİLEN');
    expect(html).toContain('aria-label="Bulut kaydını kullan (önerilen)"');
    // Birleştir yine açık onay ister
    expect(html).not.toContain('Onaylıyorum, Birleştir');
    expect(html).toContain('açık onay gerektirir');
  });

  test('neden metinleri tabloda eksiksiz ve bilinmeyen neden güvenli varsayılana düşer', () => {
    const reasons: SyncConflict['reason'][] = ['both-changed', 'owner-mismatch', 'revision-mismatch'];
    for (const reason of reasons) {
      expect(CONFLICT_COPIES[reason].title.length).toBeGreaterThan(0);
      expect(CONFLICT_COPIES[reason].description.length).toBeGreaterThan(0);
    }
    expect(conflictCopy('bilinmeyen').title).toBe(CONFLICT_COPIES['both-changed'].title);
    expect(conflictCopy(undefined).title).toBe(CONFLICT_COPIES['both-changed'].title);
    expect(CONFLICT_COPIES['revision-mismatch'].cloudRecommended).toBe(true);
    expect(CONFLICT_COPIES['owner-mismatch'].localDestructive).toBe(true);
    expect(CONFLICT_COPIES['both-changed'].localDestructive).toBe(false);
  });

  test('iki tarafın revizyon numaraları gösterilir', () => {
    const html = renderReason('both-changed');
    expect(html).toContain('Yerel revizyon');
    expect(html).toContain('Bulut revizyonu');
    expect(html).toContain('aria-label="Bu Cihaz revizyonu 7"');
    expect(html).toContain('aria-label="Bulut revizyonu 9"');
    expect(html).toContain('Revizyon 7');
    expect(html).toContain('Revizyon 9');
  });

  test('yalnızca güncelleme zamanı farklıysa "özetler aynı" açıklaması gösterilir', () => {
    const sameContent: SyncConflict = {
      ...conflict,
      local,
      cloud: { ...local, updatedAt: '2026-11-01T11:00:00.000Z' },
    };
    const html = renderToStaticMarkup(
      <CloudConflictModal conflict={sameContent} onChoose={() => {}} />
    );
    expect(html).toContain('Çakışma nedeni');
    expect(html).toContain('Sayısal özetler aynı');
    expect(html).not.toContain('Farklı görünen veriler:');
  });

  test('neden etiketleri her varyantta dolu ve bilinmeyen neden güvenli', () => {
    expect(conflictReasonLabel('both-changed')).toBe(CONFLICT_REASON_LABELS['both-changed']);
    expect(conflictReasonLabel('owner-mismatch')).toContain('farklı hesaplara');
    expect(conflictReasonLabel('revision-mismatch')).toContain('başka bir cihaz');
    expect(conflictReasonLabel('bilinmeyen')).toBe(CONFLICT_REASON_LABELS['both-changed']);
  });
});

// ============================================================================
// İKİNCİ ONAY PANELİ
// ============================================================================

describe('CONFLICT CONFIRM PANEL — ikinci onay adımı', () => {
  test("'local' + owner-mismatch: kırmızı ezme uyarısı ve onay butonu", () => {
    const html = renderToStaticMarkup(
      <ConflictConfirmPanel
        choice="local"
        reason="owner-mismatch"
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('Buluttaki hesabın verisi kalıcı olarak ezilecek');
    expect(html).toContain('geri alınamaz');
    expect(html).toContain('Zaten bu cihazda başka bir hesabın verisi var');
    expect(html).toContain('Onaylıyorum, Bu Cihazı Kullan');
    expect(html).toContain('aria-label="Onaylıyorum, bu cihazdaki veriyi yükle"');
    expect(html).toContain('Vazgeç');
  });

  test("'merge': defter tekilleştirme açıklaması ve açık onay", () => {
    const html = renderToStaticMarkup(
      <ConflictConfirmPanel choice="merge" reason="both-changed" onCancel={() => {}} onConfirm={() => {}} />
    );
    expect(html).toContain('Birleştirme geri alınamaz ve yeni bir revizyon oluşturur');
    expect(html).toContain('(source, sourceId)');
    expect(html).toContain('adjustment');
    expect(html).toContain('önerilen seçenek değildir');
    expect(html).toContain('Onaylıyorum, Birleştir');
  });

  test('busy iken onay butonları devre dışı', () => {
    const html = renderToStaticMarkup(
      <ConflictConfirmPanel choice="merge" reason="both-changed" busy onCancel={() => {}} onConfirm={() => {}} />
    );
    expect(html).toContain('disabled=""');
  });
});
