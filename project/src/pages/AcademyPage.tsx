import { ArrowLeft, GraduationCap, Sparkles, Check, Lock, BookOpen } from 'lucide-react';
import { useTutorial } from '../context/TutorialContext';
import { ACADEMY_QUESTS } from '../tutorial/texts';
import Sini from '../tutorial/Sini';

/**
 * SİNEVİA AKADEMİSİ — TAM SAYFA
 * Görev Panosu'ndaki altın Akademi bloğundaki "Akademi Sayfası" butonuyla açılır.
 * Sıralı pratik dersleri (XP yok — sadece ustalık). React.lazy YASAK olduğu için
 * statik import edilir; QuestBoard view anahtarıyla açıp kapatır.
 */
export default function AcademyPage({ onBack }: { onBack: () => void }) {
  const { academyStep, academyActive, startAcademy } = useTutorial();

  const isGraduated = academyStep >= ACADEMY_QUESTS.length;
  const progressPct = (academyStep / ACADEMY_QUESTS.length) * 100;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ÜST BAR: GERİ + BAŞLIK */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-11 h-11 rounded-2xl bg-ink-950 border border-ink-800 text-ink-300 hover:text-white hover:border-gold-500/40 flex items-center justify-center transition-all shadow-md shrink-0"
          title="Görev Panosu'na dön"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-widest text-gold-400 flex items-center gap-1.5">
            <GraduationCap size={13} /> Sinevia Akademisi
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight truncate">
            Yaparak Öğren · {ACADEMY_QUESTS.length} Ders
          </h2>
        </div>
      </div>

      {/* HERO KARTI: SİNİ + İLERLEME + BAŞLAT */}
      <div className="relative rounded-[2rem] p-6 sm:p-10 shadow-2xl overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900/95 to-ink-950 border border-gold-500/40">
        <div className="absolute -top-24 -right-16 w-72 h-72 bg-gold-500/10 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(245,158,11,0.9) 1px, transparent 0)', backgroundSize: '22px 22px' }} />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6 mb-8">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <Sini size={84} mood={isGraduated ? 'happy' : 'idle'} />
            <div className="min-w-0">
              <p className="text-sm text-ink-300 leading-relaxed">
                Sıralı pratik derslerle Sinevia'nın tüm inceliklerini öğren.
                <span className="text-gold-300 font-bold"> XP yok — sadece ustalık.</span>
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-4xl font-black text-gold-300 leading-none tabular-nums">
              {academyStep}<span className="text-ink-500 text-xl">/{ACADEMY_QUESTS.length}</span>
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest text-ink-500 mt-1">Ders Tamam</div>
          </div>
        </div>

        {/* İLERLEME ÇUBUĞU */}
        <div className="relative h-3 w-full bg-ink-900 rounded-full overflow-hidden border border-ink-800 mb-6">
          <div className="h-full bg-gradient-to-r from-gold-500 via-amber-400 to-gold-500 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(245,158,11,0.5)]" style={{ width: `${progressPct}%` }} />
        </div>

        {/* BAŞLAT / DEVAM BUTONU */}
        <button
          onClick={startAcademy}
          className={`relative w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
            isGraduated
              ? 'bg-ink-900 text-ink-400 border border-ink-700 cursor-default'
              : 'bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 text-ink-950 shadow-lg shadow-gold-500/25 hover:scale-[1.01]'
          }`}
          disabled={isGraduated}
        >
          {isGraduated ? (
            <>
              <Check size={18} strokeWidth={3} /> Akademi Mezunusun 🎓
            </>
          ) : (
            <>
              <Sparkles size={18} />
              {academyStep > 0 || academyActive ? 'Akademiye Devam Et' : 'Akademiyi Başlat'}
            </>
          )}
        </button>
      </div>

      {/* DERS LİSTESİ */}
      <div className="bg-ink-950/40 border border-ink-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <BookOpen size={20} className="text-gold-400" />
          <h3 className="text-lg font-black text-white">Ders Programı</h3>
        </div>

        <div className="space-y-2.5">
          {ACADEMY_QUESTS.map((q, i) => {
            const done = i < academyStep;
            const isCurrent = i === academyStep;
            return (
              <div
                key={q.id}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  isCurrent
                    ? 'bg-gold-500/10 border-gold-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                    : done
                    ? 'bg-ink-900/40 border-emerald-500/25'
                    : 'bg-ink-950/40 border-ink-800'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border text-sm font-black ${
                  done
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : isCurrent
                    ? 'bg-gold-500/20 border-gold-500/50 text-gold-300'
                    : 'bg-ink-900 border-ink-700 text-ink-500'
                }`}>
                  {done ? <Check size={17} strokeWidth={3} /> : isCurrent ? i + 1 : <Lock size={14} />}
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-black truncate ${isCurrent ? 'text-white' : done ? 'text-ink-300' : 'text-ink-400'}`}>
                    {q.title}
                  </div>
                  <div className={`text-xs truncate ${isCurrent ? 'text-gold-300/80' : 'text-ink-500'}`}>{q.desc}</div>
                </div>
                {isCurrent && academyActive && (
                  <span className="ml-auto shrink-0 text-[9px] font-black uppercase tracking-widest text-gold-400 bg-gold-500/15 border border-gold-500/30 px-2.5 py-1 rounded-lg animate-pulse">
                    Aktif
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
