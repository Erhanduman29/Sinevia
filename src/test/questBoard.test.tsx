import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import QuestBoard from '../components/QuestBoard';
import { QUEST_DEFS } from '../lib/quests';
import { ACADEMY_QUESTS } from '../tutorial/texts';

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
    activeTutorial: null as unknown,
    academyStep: 0,
    academyActive: false,
    startAcademy: () => {},
  },
}));

vi.mock('../context/QuestContext', () => ({ useQuests: () => mocks.quest }));
vi.mock('../context/TutorialContext', () => ({ useTutorial: () => mocks.tutorial }));

function renderBoard() {
  return renderToStaticMarkup(<QuestBoard />);
}

describe('QUESTBOARD SMOKE TESTLERİ', () => {
  beforeEach(() => {
    mocks.quest.questState = defaultQuestState();
    mocks.tutorial.academyStep = 0;
    mocks.tutorial.academyActive = false;
  });

  test('aktif görev yokken "Görev Yuvası Boş" + rozet sayacı + akademi bloğu görünmeli', () => {
    const html = renderBoard();

    expect(html).toContain('Görev Yuvası Boş');
    expect(html).toContain('Rozet Vitrini');
    expect(html).toContain(`0 / ${QUEST_DEFS.length}`); // vitrin sayacı
    expect(html).toContain('Sinevia Akademisi');
    expect(html).toContain(`${ACADEMY_QUESTS.length} Ders`);
    expect(html).toContain('Akademiyi Başlat'); // akademi henüz başlamadı
    expect(html).not.toContain('Akademiye Devam Et');
  });

  test('aktif görev varken görev başlığı ve "Kontratı Feshet" butonu görünmeli', () => {
    mocks.quest.questState.activeQuestId = 'c_action_fan'; // 'İlk Kan'
    const html = renderBoard();

    expect(html).toContain('İlk Kan');
    expect(html).toContain('Aktif Kontrat');
    expect(html).toContain('Devam Ediyor');
    expect(html).toContain('Kontratı Feshet');
    expect(html).not.toContain('Görev Yuvası Boş');
  });

  test('ceza kilitlendiyse (cooldown) "Sistem Kilitli" ekranı çıkmalı', () => {
    mocks.quest.questState.questCooldownUntil = Date.now() + 30 * 60 * 1000;
    const html = renderBoard();

    expect(html).toContain('Sistem Kilitli');
    expect(html).toContain('Cihaz soğuyana kadar');
    expect(html).not.toContain('Görev Yuvası Boş');
    expect(html).not.toContain('İlk Kan');
  });

  test('tamamlanan görevler rozet vitrininde başlıkları ve sayaçla görünmeli', () => {
    mocks.quest.questState.completedQuests = ['c_picky_taste', 'm_hater'];
    mocks.quest.questState.activeBadgeId = 'c_picky_taste'; // takılı rozet
    const html = renderBoard();

    expect(html).toContain('Seçici Zevk');
    expect(html).toContain('Hater (Nefret Kusan)');
    expect(html).toContain(`2 / ${QUEST_DEFS.length}`);

    // Takılı rozet emerald kenarlıkla vurgulanmalı
    expect(html).toContain('border-emerald-500/50');
  });

  test('ceza şalteri açık/kapalı durumunu doğru metinle göstermeli', () => {
    mocks.quest.questState.isPenaltyEnabled = true;
    let html = renderBoard();
    expect(html).toMatch(/Ceza: <span class="text-red-400">Açık<\/span>/);

    mocks.quest.questState.isPenaltyEnabled = false;
    html = renderBoard();
    expect(html).toMatch(/Ceza: <span class="text-emerald-400">Kapalı<\/span>/);
  });

  test('akademi ilerledikçe "Devam Et" butonu, bitince "Mezunusun" ve disable gelmeli', () => {
    mocks.tutorial.academyStep = 3;
    let html = renderBoard();
    expect(html).toContain('Akademiye Devam Et');
    expect(html).not.toContain('Akademiyi Başlat');

    mocks.tutorial.academyStep = ACADEMY_QUESTS.length;
    html = renderBoard();
    expect(html).toContain('Akademi Mezunusun');
    expect(html).toContain('disabled=""'); // buton devre dışı
  });
});
