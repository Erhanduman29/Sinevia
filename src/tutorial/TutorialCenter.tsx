import { X, Play, RotateCcw, Check, BookOpen, Map, Package, GraduationCap, HelpCircle, Sparkles, Footprints } from 'lucide-react';
import { useTutorial } from '../context/TutorialContext';
import { ALL_TUTORIALS, ACADEMY_QUESTS, TUTORIAL_CENTER } from './texts';
import Sini from './Sini';

/* Grup başına ikon + renk tonu (görsel hiyerarşi için) */
const GROUP_META = {
  welcome: { icon: HelpCircle, tone: 'from-azure-500/25 to-azure-500/5 text-azure-300 border-azure-500/30' },
  page: { icon: Map, tone: 'from-gold-500/25 to-gold-500/5 text-gold-300 border-gold-500/30' },
  modal: { icon: Package, tone: 'from-amber-500/25 to-amber-500/5 text-amber-300 border-amber-500/30' },
  academy: { icon: GraduationCap, tone: 'from-emerald-500/25 to-emerald-500/5 text-emerald-300 border-emerald-500/30' },
} as const;

type GroupKey = keyof typeof GROUP_META;

const GROUP_ORDER: GroupKey[] = ['welcome', 'page', 'modal'];

const stagger = (i: number) => ({
  animation: 'sini-card-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
  animationDelay: `${i * 0.05}s`,
});

/**
 * Tutorial Merkezi — Ayarlar/menüden açılır. Tüm tutorialeri gruplar,
 * durumlarını ve genel ilerlemeyi gösterir. GİZLİ BAŞARIMI ASLA SEZDİRMEZ.
 *
 * Önemli: "Başla/ Tekrar İzle" basınca tur ILGİLİ SAYFAYI AÇAR ve orada
 * başlar (eski davranış: merkezin önünde ortada kalıyordu — saçmaydı).
 */
export default function TutorialCenter({ onClose }: { onClose: () => void }) {
  const { isDone, startTutorial, academyStep, progress, startLesson, academyQuestDone } = useTutorial();

  // İlerleme hesabı: karşılama + sayfa + pencere + akademi(7 ders) tekil tamamlanma
  const stepTutorials = ALL_TUTORIALS;
  const doneStep = stepTutorials.filter((t) => isDone(t.id)).length;
  const academyLessonsDone = progress.academyDone.length;
  const totalUnits = stepTutorials.length + ACADEMY_QUESTS.length;
  const doneUnits = doneStep + academyLessonsDone;
  const pct = Math.round((doneUnits / totalUnits) * 100);
  const allDone = doneUnits === totalUnits;

  const nudge =
    TUTORIAL_CENTER.nudges[doneStep % TUTORIAL_CENTER.nudges.length];

  /* ----- Turu ilgili sayfayı açarak başlat ----- */
  const launch = (id: string) => {
    const def = ALL_TUTORIALS.find((t) => t.id === id);
    const page = id === 'welcome' ? 'home' : def?.page;
    startTutorial(id); // önce tur aktif olsun (notifyPageVisit bunu görünce geri çekilir)
    onClose();
    if (page) {
      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: page }));
    }
  };

  /* ----- Tek bir akademi dersini, o işin yapıldığı sayfayla başlat -----
     Dersler tek tek başlar/baştan yapılır; ilgili sayfaya gidilir ki
     kullanıcı "ne yapacağım" diye aramasın. */
  const LESSON_PAGE: Record<string, string> = {
    ac_movie: 'home',
    ac_quest: 'home',
    ac_series: 'home',
    ac_plan: 'plan',
    ac_stats: 'stats',
    ac_network: 'network',
    ac_history: 'history',
    ac_achievements: 'achievements',
    ac_ai: 'ai',
    ac_backup: 'settings',
  };

  const launchLesson = (index: number) => {
    startLesson(index);
    onClose();
    const page = LESSON_PAGE[ACADEMY_QUESTS[index]?.id];
    if (page) {
      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: page }));
    }
  };

  const rowTitle = (t: (typeof ALL_TUTORIALS)[number]) =>
    t.id === 'welcome'
      ? TUTORIAL_CENTER.groups.welcome
      : t.steps[0]?.title || TUTORIAL_CENTER.groups[t.group as GroupKey];

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-3 sm:p-4 bg-ink-950/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl max-h-[88vh] overflow-y-auto center-scroll rounded-[2rem] border border-gold-500/25 bg-gradient-to-b from-ink-900 via-ink-950 to-ink-950 shadow-[0_0_90px_-20px_rgba(245,158,11,0.45)] animate-fade-in"
      >
        {/* Dekoratif parıltılar */}
        <span className="pointer-events-none absolute -top-14 -right-14 w-48 h-48 rounded-full bg-gold-500/20 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-16 -left-16 w-52 h-52 rounded-full bg-azure-500/15 blur-3xl" />
        {/* Üst altın vurgu çizgisi */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gold-400 to-transparent" />

        {/* ---------- BAŞLIK ---------- */}
        <div className="relative flex items-start gap-3.5 px-5 sm:px-6 pt-5 pb-4">
          <div className="relative flex-shrink-0">
            <span className="absolute inset-0 rounded-2xl bg-gold-500/25 blur-lg" />
            <div className="relative rounded-2xl border border-gold-500/40 bg-ink-950/80 p-1.5">
              <Sini size={52} mood="happy" showGlow={false} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Sparkles size={16} className="text-gold-400" />
              {TUTORIAL_CENTER.title}
            </h2>
            <p className="text-[11px] sm:text-xs text-ink-300 mt-0.5 leading-snug">
              {TUTORIAL_CENTER.subtitle}
            </p>

            {/* İlerleme */}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex-1 h-2.5 rounded-full bg-ink-950 border border-ink-800 overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold-500 via-amber-400 to-gold-500 shadow-[0_0_10px_rgba(245,158,11,0.7)] transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] font-black text-gold-300 tabular-nums">%{pct}</span>
            </div>
            <div className="mt-1 text-[10px] font-bold text-ink-500">
              {doneUnits}/{totalUnits} {TUTORIAL_CENTER.progressLabel}
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-xl grid place-items-center bg-ink-900 border border-ink-700 text-ink-300 hover:text-white hover:bg-ink-800 transition-colors"
            title={TUTORIAL_CENTER.close}
          >
            <X size={16} />
          </button>
        </div>

        {/* ---------- GRUPLAR ---------- */}
        <div className="relative px-5 sm:px-6 pb-4 space-y-5">
          {GROUP_ORDER.map((gKey, gi) => {
            const meta = GROUP_META[gKey];
            const Icon = meta.icon;
            const tutorials = ALL_TUTORIALS.filter((t) => t.group === gKey);
            const groupDone = tutorials.filter((t) => isDone(t.id)).length;
            if (tutorials.length === 0) return null;
            let runningIndex = 0;

            return (
              <section key={gKey} style={stagger(gi)}>
                {/* Grup başlığı */}
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-7 h-7 rounded-lg grid place-items-center border bg-gradient-to-br ${meta.tone}`}
                  >
                    <Icon size={14} />
                  </span>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-ink-200">
                    {TUTORIAL_CENTER.groups[gKey]}
                  </h3>
                  <span className="ml-auto text-[10px] font-black text-ink-500 bg-ink-900 border border-ink-800 rounded-full px-2 py-0.5 tabular-nums">
                    {groupDone}/{tutorials.length}
                  </span>
                </div>
                <p className="text-[11px] text-ink-400 mb-2 leading-snug">
                  {TUTORIAL_CENTER.groupDescs[gKey]}
                </p>

                {/* Satırlar */}
                <div className="space-y-2">
                  {tutorials.map((t) => {
                    const done = isDone(t.id);
                    const idx = runningIndex++;
                    return (
                      <div
                        key={t.id}
                        style={stagger(gi * 3 + idx)}
                        className={`group flex items-center gap-3 rounded-2xl border p-3 transition-all duration-200 hover:-translate-y-0.5 ${
                          done
                            ? 'border-emerald-500/25 bg-emerald-500/[0.04] hover:border-emerald-400/40'
                            : 'border-ink-800 bg-ink-900/70 hover:border-gold-500/45 hover:bg-ink-900 hover:shadow-[0_0_24px_-8px_rgba(245,158,11,0.4)]'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 flex-shrink-0 rounded-xl grid place-items-center border bg-gradient-to-br ${meta.tone}`}
                        >
                          {done ? <Check size={16} className="text-emerald-300" /> : <Icon size={16} />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[13px] font-black text-white truncate">
                              {rowTitle(t)}
                            </span>
                            <span className="flex-shrink-0 text-[9px] font-black text-ink-500 bg-ink-950 border border-ink-800 rounded-full px-1.5 py-px">
                              {t.steps.length} {TUTORIAL_CENTER.steps}
                            </span>
                          </div>
                          <div className="text-[11px] text-ink-400 truncate">
                            {done ? TUTORIAL_CENTER.status.done : TUTORIAL_CENTER.status.todo} ·{' '}
                            {TUTORIAL_CENTER.startHint}
                          </div>
                        </div>

                        <button
                          onClick={() => launch(t.id)}
                          className={`flex-shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black transition-all ${
                            done
                              ? 'bg-ink-950 border border-ink-700 text-ink-300 hover:border-emerald-400/50 hover:text-emerald-300'
                              : 'bg-gradient-to-r from-gold-500 to-amber-500 text-ink-950 shadow-md shadow-gold-500/25 hover:from-gold-400 hover:to-amber-400 hover:shadow-gold-500/40'
                          }`}
                          title={rowTitle(t)}
                        >
                          {done ? <RotateCcw size={13} /> : <Play size={13} />}
                          <span className="hidden sm:inline">
                            {done ? TUTORIAL_CENTER.status.repeat : TUTORIAL_CENTER.status.todo}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* ---------- AKADEMİ (dersler tek tek) ---------- */}
          <section style={stagger(GROUP_ORDER.length)}>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-7 h-7 rounded-lg grid place-items-center border bg-gradient-to-br ${GROUP_META.academy.tone}`}
              >
                <GraduationCap size={14} />
              </span>
              <h3 className="text-[11px] font-black uppercase tracking-widest text-ink-200">
                {TUTORIAL_CENTER.groups.academy}
              </h3>
              <span className="ml-auto text-[10px] font-black text-ink-500 bg-ink-900 border border-ink-800 rounded-full px-2 py-0.5 tabular-nums">
                {academyLessonsDone}/{ACADEMY_QUESTS.length}
              </span>
            </div>
            <p className="text-[11px] text-ink-400 mb-2 leading-snug">
              {TUTORIAL_CENTER.groupDescs.academy}
            </p>

            {/* Her ders ayrı satır: istenen dersten başla, bitmişi yeniden yap */}
            <div className="space-y-2">
              {ACADEMY_QUESTS.map((q, i) => {
                const done = academyQuestDone(q.id);
                const current = !allDone && i === academyStep;
                const locked = !done && i > academyStep;
                return (
                  <div
                    key={q.id}
                    style={stagger(GROUP_ORDER.length * 3 + i)}
                    className={`group flex items-center gap-3 rounded-2xl border p-3 transition-all duration-200 hover:-translate-y-0.5 ${
                      done
                        ? 'border-emerald-500/25 bg-emerald-500/[0.04] hover:border-emerald-400/40'
                        : current
                        ? 'border-gold-500/50 bg-gold-500/[0.07] shadow-[0_0_26px_-10px_rgba(245,158,11,0.6)]'
                        : 'border-ink-800 bg-ink-900/70 hover:border-gold-500/45 hover:bg-ink-900 hover:shadow-[0_0_24px_-8px_rgba(245,158,11,0.4)]'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 flex-shrink-0 rounded-xl grid place-items-center border bg-gradient-to-br ${GROUP_META.academy.tone}`}
                    >
                      {done ? (
                        <Check size={15} className="text-emerald-300" />
                      ) : current ? (
                        <Play size={15} />
                      ) : (
                        <Footprints size={15} className={locked ? 'opacity-45' : ''} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="flex-shrink-0 text-[10px] font-black text-gold-400 tabular-nums">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="text-[13px] font-black text-white truncate">{q.title}</span>
                        <span className="flex-shrink-0 text-[9px] font-black text-ink-500 bg-ink-950 border border-ink-800 rounded-full px-1.5 py-px tabular-nums">
                          {i + 1}/{ACADEMY_QUESTS.length}
                        </span>
                      </div>
                      <div className="text-[11px] truncate">
                        <span
                          className={
                            done
                              ? 'text-emerald-300 font-bold'
                              : current
                              ? 'text-gold-300 font-bold'
                              : 'text-ink-400 font-bold'
                          }
                        >
                          {done
                            ? TUTORIAL_CENTER.status.done
                            : current
                            ? TUTORIAL_CENTER.status.current
                            : TUTORIAL_CENTER.status.todo}
                        </span>
                        <span className="text-ink-500"> · {q.desc}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => launchLesson(i)}
                      className={`flex-shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black transition-all ${
                        done
                          ? 'bg-ink-950 border border-ink-700 text-ink-300 hover:border-emerald-400/50 hover:text-emerald-300'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-ink-950 shadow-md shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 hover:shadow-emerald-500/40'
                      }`}
                      title={`${i + 1}. ders · ${q.title}`}
                    >
                      {done ? <RotateCcw size={13} /> : <Play size={13} />}
                      <span className="hidden sm:inline">
                        {done
                          ? TUTORIAL_CENTER.status.repeat
                          : current
                          ? TUTORIAL_CENTER.status.current
                          : TUTORIAL_CENTER.status.todo}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ---------- ALT BANT ---------- */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 px-5 sm:px-6 py-3 bg-ink-950/92 backdrop-blur border-t border-ink-800">
          <p className="text-[11px] text-ink-400 leading-snug">
            {allDone ? TUTORIAL_CENTER.allDone : nudge}
          </p>
          <button
            onClick={onClose}
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-ink-900 border border-ink-700 text-xs font-black text-ink-200 hover:bg-ink-800 hover:text-white transition-colors"
          >
            {TUTORIAL_CENTER.close}
          </button>
        </div>
      </div>
    </div>
  );
}
