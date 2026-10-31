import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AcademyPage from '../pages/AcademyPage';
import { ACADEMY_QUESTS } from '../tutorial/texts';

// ============================================================================
// ACADEMYPAGE TESTLERİ — Görev Panosu'ndan taşınan tam sayfa akademi
// ============================================================================

const mocks = vi.hoisted(() => ({
  tutorial: {
    academyStep: 0,
    academyActive: false,
    startAcademy: () => {},
  },
}));

vi.mock('../context/TutorialContext', () => ({ useTutorial: () => mocks.tutorial }));

function renderPage() {
  return renderToStaticMarkup(<AcademyPage onBack={() => {}} />);
}

describe('ACADEMYPAGE — Sinevia Akademisi tam sayfa', () => {
  beforeEach(() => {
    mocks.tutorial.academyStep = 0;
    mocks.tutorial.academyActive = false;
  });

  test('geri butonu + başlık + ders programı görünmeli', () => {
    const html = renderPage();

    expect(html).toContain('Görev Panosu'); // title="Görev Panosu'na dön" (escape'li)
    expect(html).toContain('Sinevia Akademisi');
    expect(html).toContain(`${ACADEMY_QUESTS.length} Ders`);
    expect(html).toContain('Ders Programı');
    expect(html).toContain('Akademiyi Başlat');
    // İlk ders listede görünür
    expect(html).toContain(ACADEMY_QUESTS[0].title);
  });

  test('ders ilerledikçe "Devam Et" butonu, bitince "Mezunusun" ve disable gelmeli', () => {
    mocks.tutorial.academyStep = 3;
    let html = renderPage();
    expect(html).toContain('Akademiye Devam Et');
    expect(html).not.toContain('Akademiyi Başlat');

    mocks.tutorial.academyStep = ACADEMY_QUESTS.length;
    html = renderPage();
    expect(html).toContain('Akademi Mezunusun');
    expect(html).toContain('disabled=""'); // buton devre dışı
  });
});
