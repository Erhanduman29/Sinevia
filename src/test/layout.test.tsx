import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import Layout, { type TabId } from '../components/Layout';

// ============================================================================
// LAYOUT SMOKE TESTLERİ — SSR render ile temel kabuk doğrulaması
// (DOM olayları için ortam yok; statik markup üzerinden gerçek assertion)
// ============================================================================

const mocks = vi.hoisted(() => ({
  appCtx: { syncStatus: 'synced' } as { syncStatus?: string },
  tutorialCtx: { activeTutorial: null as unknown },
}));

vi.mock('../context/AppContext', () => ({ useApp: () => mocks.appCtx }));
vi.mock('../context/TutorialContext', () => ({ useTutorial: () => mocks.tutorialCtx }));

function renderLayout(activeTab: TabId, children: ReactNode = <div>CHILD_CONTENT</div>) {
  return renderToStaticMarkup(
    <Layout activeTab={activeTab} onTabChange={() => {}}>
      {children}
    </Layout>
  );
}

describe('LAYOUT SMOKE TESTLERİ', () => {
  beforeEach(() => {
    mocks.appCtx.syncStatus = 'synced';
    mocks.tutorialCtx.activeTutorial = null;
  });

  test('marka adı ve 9 masaüstü + 6 mobil menü öğesi render edilmeli', () => {
    const html = renderLayout('home');

    expect(html).toContain('SINEVIA');

    ['Ana Sayfa', 'Filmler', 'Diziler', 'Sinevia Ağı', 'Haftalık Plan', 'Geçmiş', 'Başarımlar', 'İstatistik', 'AI Asistan']
      .forEach((label) => expect(html, `menü etiketi eksik: ${label}`).toContain(label));

    // data-tutorial="nav-<id>" bağlantıları: 9 sidebar + 6 alt bar = 15
    // (kullanıcı mobil alt bara "Ayarlar" ekledi — 6. sekme, en sağda)
    const navLinks = html.match(/data-tutorial="nav-(home|movies|series|network|plan|history|achievements|stats|ai|settings)"/g) || [];
    expect(navLinks).toHaveLength(15);
  });

  test('aktif sekme altın renk vurgusu almalı, diğer sekmeler almamalı', () => {
    const html = renderLayout('movies');

    // Sidebar'da sadece "Filmler" aktif olmalı
    const goldHighlights = html.match(/bg-gold-500\/20 text-gold-400/g) || [];
    expect(goldHighlights).toHaveLength(1);

    // Mobil alt barda aktif sekme class'ı da sadece 1 kez görünmeli
    const mobileHighlights = html.match(/text-gold-400 bg-gold-500\/10/g) || [];
    expect(mobileHighlights).toHaveLength(1);

    // Pasif sekme sınıfı "İstatistik" için hâlâ mevcut olmalı
    expect(html).toContain('text-ink-400 hover:bg-ink-800');
  });

  test('AI sekmesi aktifken premium vurgu pill\'ini almalı (tüm sekmelerde birleşik)', () => {
    const html = renderLayout('ai');

    // Aktif nav artık tüm sekmelerde tek tip: vurgu rengi pill (tema değişkenli)
    const aiHighlights = html.match(/bg-gold-500\/20 text-gold-400/g) || [];
    expect(aiHighlights).toHaveLength(1);

    // Eski azure-özel aktif gradyan kaldırıldı (birleşik premium görünüm)
    expect(html).not.toContain('bg-gradient-to-r from-azure-500 to-indigo-600');
  });

  test('eşitleme durumları (synced / syncing / error) doğru metni göstermeli', () => {
    mocks.appCtx.syncStatus = 'synced';
    let html = renderLayout('home');
    expect(html).toContain('Sistem Güncel');
    expect(html).not.toContain('Eşitleniyor...');

    mocks.appCtx.syncStatus = 'syncing';
    html = renderLayout('home');
    expect(html).toContain('Eşitleniyor...');
    expect(html).not.toContain('Sistem Güncel');

    mocks.appCtx.syncStatus = 'error';
    html = renderLayout('home');
    expect(html).toContain('Bağlantı Yok');
    expect(html).not.toContain('Sistem Güncel');
  });

  test('syncStatus yoksa "synced" varsayılmalı (fallback)', () => {
    mocks.appCtx.syncStatus = undefined;
    const html = renderLayout('home');
    expect(html).toContain('Sistem Güncel');
  });

  test('children içeriği ana alana yerleştirilmeli, Wrapped butonu görünür olmalı', () => {
    const html = renderLayout('stats', <section data-testid="page">ÖZEL_SAYFA_İÇERİĞİ</section>);

    expect(html).toContain('ÖZEL_SAYFA_İÇERİĞİ');
    expect(html).toContain('Wrapped Özetin');

    // Mobil açılır menü kapalıyken "Story" kartı render edilmemeli
    expect(html).not.toContain('SINEVIA WRAPPED');
  });
});
