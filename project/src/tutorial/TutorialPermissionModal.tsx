import { useState } from 'react';
import { GraduationCap, Sparkles, Check, Compass, BookOpen, Settings } from 'lucide-react';
import { useTutorial } from '../context/TutorialContext';
import Sini from './Sini';

/**
 * İlk açılış izni — "Tutorial ister misin?".
 *
 * - "Evet" → karşılama turu + akademi normal akışla başlar.
 * - "Hayır" → hiçbir tutorial başlamaz; kullanıcıya Tutorial Merkezi'ne
 *   nereden ulaşacağı bilgisi gösterilir ve ancak onaylayınca kapanır.
 *
 * Not: Bu modal yalnızca `permissionAsked === false` iken render edilir.
 */
export default function TutorialPermissionModal() {
  const { answerPermission } = useTutorial();
  const [declined, setDeclined] = useState(false);

  if (declined) {
    return (
      <div
        className="fixed inset-0 z-[310] flex items-center justify-center p-3 sm:p-4 bg-ink-950/55 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-declined-title"
      >
        <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-gold-500/25 bg-gradient-to-b from-ink-900 via-ink-950 to-ink-950 shadow-[0_0_90px_-20px_rgba(245,158,11,0.45)] animate-fade-in">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
          <span className="pointer-events-none absolute -top-14 -right-14 w-40 h-40 rounded-full bg-gold-500/15 blur-3xl" />

          <div className="relative flex items-start gap-3.5 px-5 sm:px-6 pt-5 pb-3">
            <div className="relative flex-shrink-0">
              <span className="absolute inset-0 rounded-2xl bg-gold-500/20 blur-lg" />
              <div className="relative rounded-2xl border border-gold-500/40 bg-ink-950/80 p-1.5">
                <Sini size={48} mood="talk" showGlow={false} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 id="tutorial-declined-title" className="text-base font-black text-white flex items-center gap-2">
                <Compass size={16} className="text-gold-400" />
                Sorun değil!
              </h2>
              <p className="text-[12px] text-ink-300 mt-1 leading-snug">
                Tutorialleri şimdi göstermeyeceğim. Sinevia'yı dilediğin gibi keşfedebilirsin.
              </p>
            </div>
          </div>

          <div className="relative px-5 sm:px-6 pb-5">
            <div className="rounded-2xl border border-ink-800 bg-ink-900/70 p-3.5 space-y-2.5">
              <p className="text-[12px] font-bold text-white flex items-center gap-2">
                <BookOpen size={14} className="text-gold-400 flex-shrink-0" />
                Tutoriallere istediğin zaman ulaşabilirsin:
              </p>
              <div className="flex items-start gap-2 text-[11px] text-ink-300 leading-snug">
                <Settings size={13} className="text-ink-400 flex-shrink-0 mt-0.5" />
                <span>
                  Menüdeki <span className="font-black text-gold-300">Tutorial Merkezi</span> bölümünü aç.
                  Karşılama turu, sayfa turları ve Sinevia Akademisi'ni oradan başlatabilirsin.
                </span>
              </div>
              <div className="flex items-start gap-2 text-[11px] text-ink-400 leading-snug">
                <GraduationCap size={13} className="text-ink-500 flex-shrink-0 mt-0.5" />
                <span>Mobilde aynı bölüm üstteki/menüdeki menü düğmesindedir.</span>
              </div>
            </div>

            <button
              onClick={() => answerPermission(false)}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 px-4 py-2.5 text-sm font-black text-ink-950 shadow-md shadow-gold-500/25 transition-all hover:from-gold-400 hover:to-amber-400 active:scale-95"
            >
              Anladım, devam et
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[310] flex items-center justify-center p-3 sm:p-4 bg-ink-950/55 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-permission-title"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-gold-500/25 bg-gradient-to-b from-ink-900 via-ink-950 to-ink-950 shadow-[0_0_90px_-20px_rgba(245,158,11,0.45)] animate-fade-in">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
        <span className="pointer-events-none absolute -top-14 -right-14 w-40 h-40 rounded-full bg-gold-500/20 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-azure-500/15 blur-3xl" />

        <div className="relative flex items-start gap-3.5 px-5 sm:px-6 pt-5 pb-3">
          <div className="relative flex-shrink-0">
            <span className="absolute inset-0 rounded-2xl bg-gold-500/25 blur-lg" />
            <div className="relative rounded-2xl border border-gold-500/40 bg-ink-950/80 p-1.5">
              <Sini size={52} mood="happy" showGlow={false} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="tutorial-permission-title"
              className="text-base sm:text-lg font-black text-white flex items-center gap-2"
            >
              <Sparkles size={16} className="text-gold-400" />
              Merhaba, ben Sini!
            </h2>
            <p className="text-[12px] text-ink-300 mt-1 leading-snug">
              Sinevia'yı adım adım tanıtmamı ister misin? Kısa turlar ve gerçek görevlerle
              her köşeyi birlikte keşfederiz.
            </p>
          </div>
        </div>

        <div className="relative px-5 sm:px-6 pb-5">
          <ul className="rounded-2xl border border-ink-800 bg-ink-900/70 p-3.5 space-y-2 text-[11px] text-ink-300">
            <li className="flex items-start gap-2">
              <Check size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              Karşılama turu ve her sayfanın kısa tanıtımı
            </li>
            <li className="flex items-start gap-2">
              <Check size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              Sinevia Akademisi: 13 gerçek görevle yaparak öğrenme
            </li>
            <li className="flex items-start gap-2">
              <Check size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              İstediğin an atlayabilir, sonra Tutorial Merkezi'nden tekrar başlatabilirsin
            </li>
          </ul>

          <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => answerPermission(true)}
              className="flex-1 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 px-4 py-2.5 text-sm font-black text-ink-950 shadow-md shadow-gold-500/25 transition-all hover:from-gold-400 hover:to-amber-400 active:scale-95"
            >
              Evet, göster
            </button>
            <button
              onClick={() => setDeclined(true)}
              className="flex-1 rounded-xl border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm font-black text-ink-200 transition-colors hover:bg-ink-800 hover:text-white active:scale-95"
            >
              Hayır, kendim keşfederim
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
