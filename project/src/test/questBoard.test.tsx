import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import QuestBoard from '../components/QuestBoard';
import { QUEST_DEFS } from '../lib/quests';

// ============================================================================
// QUESTBOARD SMOKE TESTLERİ — Görev panosu durumları (SSR statik render)
// ============================================================================

interface QuestStateMock {
  activeQuestId: string | null;
  questAcceptedAt: number | null;
  questRejects: number;
  questCooldownUntil: number | null;
  completedQuests: string[];
  activeBadgeId: string | null;
  isPenaltyEnabled: boolean;
}

const defaultQuestState = (): QuestStateMock => ({
  activeQuestId: null,
  questAcceptedAt: null,
  questRejects: 0,
  questCooldownUntil: null,
  completedQuests: [],
  activeBadgeId: null,
  isPenaltyEnabled: true,
});

const mocks = vi.hoisted(() => ({
  quest: {
    questState: {
      activeQuestId: null,
      questAcceptedAt: null,
      questRejects: 0,
      questCooldownUntil: null,
      completedQuests: [] as string[],
      activeBadgeId: null,
      isPenaltyEnabled: true,
    } as QuestStateMock,
    acceptQuest: () => {},
    rejectActiveQuest: () => {},
    completeActiveQuest: () => {},
    equipBadge: () => {},
    togglePenalty: () => {},
    resetQuestData: () => {},
  },
  tutorial: {
    notifyEvent: () => {},
  },
  settings: {
    showBadgeDetails: false,
  },
}));

vi.mock('../context/QuestContext', () => ({ useQuests: () => mocks.quest }));
vi.mock('../context/TutorialContext', () => ({ useTutorial: () => mocks.tutorial }));
vi.mock('../context/slices', () => ({ useSettings: () => mocks.settings }));

function renderBoard() {
  return renderToStaticMarkup(<QuestBoard />);
}

describe('QUESTBOARD SMOKE TESTLERİ', () => {
  beforeEach(() => {
    mocks.quest.questState = defaultQuestState();
    mocks.settings.showBadgeDetails = false;
  });

  test('aktif görev yokken "Görev Yuvası Boş" + vitrin sayacı + akademi GİRİŞ butonu görünmeli', () => {
    const html = renderBoard();

    expect(html).toContain('Görev Yuvası Boş');
    expect(html).toContain('Rozet Vitrini');
    expect(html).toContain(`0 / ${QUEST_DEFS.length}`); // vitrin sayacı
    // Akademi: panoda SADECE geçiş butonu (içerik AcademyPage'e taşındı)
    expect(html).toContain('Sinevia Akademisi — Akademi Sayfası');
    expect(html).not.toContain('Akademiyi Başlat');
    expect(html).not.toContain('Akademiye Devam Et');
    expect(html).not.toContain('Yaparak Öğren');
    expect(html).not.toContain('Ders Programı');
    // Vitrin boş durumu kalktı — 0 tamamlamada bile tüm rozet ikonları görünür
    expect(html).not.toContain('Henüz hiçbir görevi tamamlamadın');
  });

  test('aktif görev varken görev başlığı ve "Kontratı Feshet" butonu görünmeli', () => {
    mocks.quest.questState.activeQuestId = 'c_action_fan'; // 'Yüksek Oktan'
    const html = renderBoard();

    expect(html).toContain('Yüksek Oktan');
    expect(html).toContain('+40 XP'); // aktif kontrat ödül satırı
    expect(html).toContain('Koşul sağlandığında');
    expect(html).toContain('Kontratı Feshet');
    expect(html).not.toContain('Görev Yuvası Boş');
  });

  test('ceza kilitlendiyse (cooldown) "Sistem Kilitli" ekranı çıkmalı', () => {
    mocks.quest.questState.questCooldownUntil = Date.now() + 30 * 60 * 1000;
    const html = renderBoard();

    expect(html).toContain('Sistem Kilitli');
    expect(html).toContain('Cihaz soğuyana kadar');
    expect(html).not.toContain('Görev Yuvası Boş');
    expect(html).not.toContain('Yüksek Oktan');
  });

  test('rozet vitrini detay modu KAPALIYKEN sadece ikonlar görünür, isimler gizli, kilitli rozetler soluk', () => {
    mocks.quest.questState.completedQuests = ['c_picky_taste', 'm_hater'];
    mocks.settings.showBadgeDetails = false;
    const html = renderBoard();

    expect(html).toContain(`2 / ${QUEST_DEFS.length}`);
    expect(html).not.toContain('Hassas Kalibrasyon');
    expect(html).not.toContain('Kıyamet Jürisi');
    // Tüm 50 rozet kartı render edilir; tamamlanmamışlar kilit etiketiyle
    expect(html).toContain('Kilitli — bu görevi henüz tamamlamadın');
  });

  test('rozet vitrini detay modu AÇIKKEN isim, açıklama ve XP görünür', () => {
    mocks.quest.questState.completedQuests = ['c_picky_taste', 'm_hater'];
    mocks.quest.questState.activeBadgeId = 'c_picky_taste'; // takılı rozet
    mocks.settings.showBadgeDetails = true;
    const html = renderBoard();

    expect(html).toContain('Hassas Kalibrasyon');
    expect(html).toContain('Kıyamet Jürisi');
    expect(html).toContain('+40 XP'); // c_picky_taste ödülü
    expect(html).toContain(`2 / ${QUEST_DEFS.length}`);

    // Kuşanılmış rozet emerald kenarlıkla vurgulanmalı
    expect(html).toContain('border-emerald-400/70');
  });

  test("ceza şalteri Görev Panosu'ndan kaldırıldı (Ayarlar'a taşındı)", () => {
    mocks.quest.questState.isPenaltyEnabled = true;
    let html = renderBoard();
    expect(html).not.toContain('Ceza:');

    mocks.quest.questState.isPenaltyEnabled = false;
    html = renderBoard();
    expect(html).not.toContain('Ceza:');
  });
});
