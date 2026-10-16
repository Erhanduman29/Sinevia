import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, MousePointerClick, Sparkles } from 'lucide-react';
import { useTutorial } from '../context/TutorialContext';
import { TUTORIAL_CENTER } from './texts';
import Sini from './Sini';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Aynı anahtara sahip birden fazla element olabilir (masaüstü + mobil).
 *  Görünür olanları döndürür. */
function findVisibleTargets(key: string): HTMLElement[] {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tutorial="${key}"]`));
  return all.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

function firstVisible(key: string): HTMLElement | null {
  return findVisibleTargets(key)[0] || null;
}

/* =========================================================================
   ÇAKIŞMA (ÜST ÜSTE BİNME) YARDIMCILARI
   Kart, hedef UI alanının üstüne geliyorsa kullanıcı tıklaması/görmesi
   gereken öğeyi kaçırır. Böyle adımlarda kart KÜÇÜLTÜLÜR: sadece Sini +
   kısa yönlendirme metni kalır; hedef tıklanıp adım değişince (ya da hedef
   kayınca) kart normale döner.
   ========================================================================= */

/** İki dikdörtgen kesişiyor mu? (pad, a'yı çevresinden genişletir) */
function overlaps(a: Rect, b: Rect, pad = 0): boolean {
  return (
    a.left - pad < b.left + b.width &&
    a.left + a.width + pad > b.left &&
    a.top - pad < b.top + b.height &&
    a.top + a.height + pad > b.top
  );
}

/** Kesişim alanı (px²) — hiç kesişmiyorsa 0. */
function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Normal (tam boy) kartın boyut tahminleri — konumlandırma hesabıyla aynı. */
const CARD_EST = { desktopW: 620, desktopH: 360, mobileH: 300, mobileBottom: 90 };
/** Küçük kartın ölçü tahmini. İçerik line-clamp ile sınırlı olduğundan
 *  GERÇEK yükseklik bu değerin altındadır → köşe seçimi güvenli kalır. */
const COMPACT_EST = { w: 300, h: 160 };
/** Küçük kart adayları: hedefin zıt köşesinden başlayan 4 köşe (2 satır × 2 sütun). */
const COMPACT_CANDIDATE_COUNT = 4;

/**
 * Normal (tam boy) kartın EKRAN dikdörtgeni.
 * - Masaüstü: aşağıdaki satır içi konumlandırma hesabıyla BİREBİR aynı.
 * - Mobil: global `.tutorial-card` CSS'inin uyguladığı alan
 *   (left/right 16px, bottom 90px) — mobilde de gerçek üst üste binme görülür.
 *   `useMobileCardCss`, CSS media query'siyle (max-width: 640px) birebir aynı
 *   aralığı kapsar (tam 640px'te CSS kazanır).
 */
function computeNormalCardRect(target: Rect, useMobileCardCss: boolean): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (useMobileCardCss) {
    return {
      left: 16,
      top: vh - CARD_EST.mobileBottom - CARD_EST.mobileH,
      width: vw - 32,
      height: CARD_EST.mobileH,
    };
  }
  const w = Math.min(CARD_EST.desktopW, vw - 32);
  const h = CARD_EST.desktopH;
  // Aynı mantık: önce altına, sığmazsa üstüne (ekran dışına taşarsa 16'ya kırp)
  let top = target.top + target.height + 20;
  if (top + h > vh) top = Math.max(16, target.top - h - 10);
  const left = Math.max(16, Math.min(target.left, vw - w - 16));
  return { left, top, width: w, height: h };
}

/** Küçük kart için köşe adayları — hedefin ZIT köşesinden başlar. */
function compactCandidates(target: Rect): Rect[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(COMPACT_EST.w, vw - 32);
  const h = COMPACT_EST.h;
  const cx = target.left + target.width / 2;
  const cy = target.top + target.height / 2;
  const cols: Array<'left' | 'right'> = cx < vw / 2 ? ['right', 'left'] : ['left', 'right'];
  const rows: Array<'top' | 'bottom'> = cy < vh / 2 ? ['bottom', 'top'] : ['top', 'bottom'];
  // Mobil kroma (md breakpoint'i altı): üstte sabit bant 56px, altta nav 68px
  const hasMobileChrome = vw < 768;
  const topGap = hasMobileChrome ? 64 : 16;
  const bottomGap = hasMobileChrome ? 84 : 16;
  const out: Rect[] = [];
  for (const row of rows) {
    for (const col of cols) {
      out.push({
        left: col === 'right' ? vw - w - 16 : 16,
        top: row === 'bottom' ? vh - h - bottomGap : topGap,
        width: w,
        height: h,
      });
    }
  }
  return out;
}

/** Hedefle hiç kesişmeyen ilk köşeyi; yoksa (hedef ekranı kaplıyorsa)
 *  en az kesişeni seç — küçük kart olsa da mümkün olan en temiz köşe. */
function pickCompactCandidate(target: Rect): number {
  const cands = compactCandidates(target);
  let best = 0;
  let bestArea = Infinity;
  for (let i = 0; i < cands.length; i++) {
    const area = overlapArea(cands[i], target);
    if (area === 0) return i;
    if (area < bestArea) {
      bestArea = area;
      best = i;
    }
  }
  return best;
}

/** Hedef elementin (data-tutorial="key") ekran koordinatını ölçer. */
function useTargetRect(target: string | undefined, stepKey: string): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  const measure = useCallback(() => {
    if (!target) {
      setRect((prev) => (prev === null ? prev : null));
      return;
    }
    const el = firstVisible(target);
    if (!el) {
      setRect((prev) => (prev === null ? prev : null));
      return;
    }
    const r = el.getBoundingClientRect();
    setRect((prev) =>
      prev &&
      prev.top === r.top &&
      prev.left === r.left &&
      prev.width === r.width &&
      prev.height === r.height
        ? prev
        : { top: r.top, left: r.left, width: r.width, height: r.height }
    );
  }, [target]);

  useEffect(() => {
    // Bir sonraki frame'de ölç (sayfa yeni render olmuş olabilir)
    const id = requestAnimationFrame(() => measure());
    // Hedef belirirken/yer değiştirirken (ör. alt nav açılırken) kendini güncellemesi için periyodik ölçüm
    const interval = setInterval(measure, 300);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(id);
      clearInterval(interval);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [stepKey, measure]);

  return rect;
}

export default function TutorialOverlay() {
  const {
    activeTutorial,
    activeStep,
    activeStepType,
    nextStep,
    prevStep,
    skipActive,
  } = useTutorial();

  const step = activeTutorial?.steps[activeStep];
  const stepKey = `${activeTutorial?.id}-${activeStep}`;
  const rect = useTargetRect(step?.target, stepKey);

  const isBlocking = activeStepType === 'slide' || activeStepType === 'spotlight';
  const isInteractive = activeStepType === 'direct' || activeStepType === 'action';
  const isLast = activeTutorial ? activeStep === activeTutorial.steps.length - 1 : false;

  // direct adımında hedefe tıklanınca ilerle. Eleman-takibi/interval yerine
  // adım süresince document CAPTURE dinleyicisi + composedPath kontrolü:
  // hedef geç mount olsa, düğüm değişse veya çipten tıklansa bile yol
  // (path) üzerinden güvenle yakalanır — yarış durumunda sağır kalmaz.
  useEffect(() => {
    if (activeStepType !== 'direct' || !step?.target) return;
    const target = step.target;
    const onDocClick = (e: MouseEvent) => {
      const els = findVisibleTargets(target);
      if (els.length === 0) return;
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      if (els.some((el) => path.indexOf(el) !== -1)) {
        // Tıklama gerçek uygulamaya da gitsin, sonra ilerle
        setTimeout(() => nextStep(), 50);
      }
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [activeStepType, step?.target, stepKey, nextStep]);

  /* ------------- Ekran boyutu (yeniden boyutlanınca karar tazelensin) ------------- */
  const [viewport, setViewport] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const isDesktop = viewport.w >= 640;

  /* ------------- ÇAKIŞMA TESPİTİ + KÜÇÜK MOD -------------
     Normal kart, hedef UI alanının üstüne biniyorsa (ör. hedef ekranı kaplayan
     bir liste/grid ya da mobilde alt bant) kart küçültülür: geriye sadece Sini
     + kısa yönlendirme metni kalır. Hedef tıklanıp adım değişince (ya da hedef
     kayınca) kart eski haline döner. */
  const normalRect = rect ? computeNormalCardRect(rect, viewport.w <= 640) : null;
  const isCompact = !!(rect && normalRect && overlaps(normalRect, rect, 6));
  const autoCandidate = rect ? pickCompactCandidate(rect) : 0;
  const [compactShift, setCompactShift] = useState(0);
  const compactRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setCompactShift(0);
  }, [stepKey]);
  const compactIdx = Math.min(COMPACT_CANDIDATE_COUNT - 1, autoCandidate + compactShift);
  const compactRect = isCompact && rect ? compactCandidates(rect)[compactIdx] : null;

  // Ölçülen GERÇEK küçük kart kutusu hedefle kesişirse sıradaki köşeye geç
  // (tahmini boyuttan büyük çıktıysa kendini düzeltir; sondaki adayda durur).
  useLayoutEffect(() => {
    if (!isCompact || !rect || !compactRef.current) return;
    if (compactIdx >= COMPACT_CANDIDATE_COUNT - 1) return;
    const r = compactRef.current.getBoundingClientRect();
    if (
      r.width > 0 &&
      r.height > 0 &&
      overlapArea({ top: r.top, left: r.left, width: r.width, height: r.height }, rect) > 0
    ) {
      setCompactShift((s) => s + 1);
    }
  }, [isCompact, rect, compactIdx]);

  if (!activeTutorial || !step) return null;

  const mood =
    activeStepType === 'direct' || activeStepType === 'action'
      ? 'point'
      : activeStepType === 'spotlight'
      ? 'talk'
      : 'idle';

  const padding = 10;
  const highlightStyle: React.CSSProperties | null = rect
    ? {
        position: 'fixed',
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius: 16,
        // Koyu hale delikli: hedef parlak kalır, çevre kararır + altın ring
        boxShadow:
          '0 0 0 9999px rgba(3,3,6,0.82), 0 0 0 3px rgba(245,158,11,0.9), 0 0 30px rgba(245,158,11,0.55)',
        zIndex: 290,
        pointerEvents: 'none',
        transition: 'top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease',
      }
    : null;

  // Kart konumu: hedef varsa ona bitişik, yoksa ekran ortası.
  // Masaüstünde kart GENİŞ ve gösterişli (620px); mobilde alt banda sabit.
  const cardWidth = isDesktop ? 620 : 400;
  // Kartın yaklaşık yüksekliği (konumlandırma tahmini)
  const cardEstimate = isDesktop ? 360 : 300;
  const cardStyle: React.CSSProperties = rect
    ? (() => {
        const w = Math.min(cardWidth, window.innerWidth - 32);
        let top = rect.top + rect.height + 20;
        // Alttan sığmıyorsa üstüne koy
        if (top + cardEstimate > window.innerHeight) top = Math.max(16, rect.top - cardEstimate - 10);
        const left = Math.max(16, Math.min(rect.left, window.innerWidth - w - 16));
        return { position: 'fixed', top, left, width: w, zIndex: 300 };
      })()
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 300,
        width: `min(${cardWidth}px, calc(100vw - 32px))`,
      };

  return (
    <>
      {/* Engelleyici: hedef yokken tam dim; hedef varken (blocking) şeffaf tıklayıcı.
          z-index BİLİNÇLİ OLARAK inline style: Layout'un modal algılayıcısı yalnızca
          className'deki z-[…] değerini okur. Tutorial katmanı "pencere" sayılmazsa
          mobil alt nav gizlenmez — karşılama turundaki hedef adımlar (örn. nav-movies)
          mobilde tıklanabilir kalır. */}
      {rect ? (
        isBlocking && (
          <div className="fixed inset-0 bg-transparent" style={{ zIndex: 288 }} />
        )
      ) : (
        isBlocking && (
          <div
            className="fixed inset-0 bg-black/25"
            style={{ zIndex: 285 }}
          />
        )
      )}

      {/* Hedef ışıklandırması (ring, koyu hale delikli) */}
      {rect && highlightStyle && <div style={highlightStyle} className="tutorial-ring" />}

      {/* Kart — hedefle çakışıyorsa KÜÇÜK mod: sadece Sini + kısa metin.
          Hedef tıklanıp adım değişince (veya hedef kayınca) tam kart geri gelir. */}
      {isCompact && rect && compactRect ? (
        <div
          ref={compactRef}
          data-tutorial-ui="compact"
          style={{
            position: 'fixed',
            top: compactRect.top,
            left: compactRect.left,
            width: compactRect.width,
            zIndex: 300,
          }}
          className="tutorial-card-compact relative overflow-hidden rounded-2xl border border-gold-500/35 bg-gradient-to-br from-ink-900 via-ink-900 to-ink-950 shadow-[0_20px_50px_-18px_rgba(0,0,0,0.95)] backdrop-blur-xl"
        >
          {/* İnce ilerleme çubuğu */}
          <div className="absolute top-0 inset-x-0 h-1 bg-ink-950/90">
            <div
              className="h-full bg-gradient-to-r from-gold-500 via-amber-400 to-gold-300"
              style={{ width: `${((activeStep + 1) / activeTutorial.steps.length) * 100}%` }}
            />
          </div>

          <div className="p-3 pt-3.5">
            <div className="flex items-start gap-2.5">
              {/* Sini — küçük altın tile */}
              <div className="flex-shrink-0 rounded-2xl border border-gold-500/35 bg-ink-950/70 p-1">
                <Sini size={44} mood={mood} showGlow={false} />
              </div>
              {/* Kısa yönlendirme metni */}
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-black text-white leading-tight line-clamp-1">
                  {step.title}
                </div>
                <p className="text-[11px] text-ink-300 leading-snug mt-1 line-clamp-2">
                  {isInteractive ? step.hint || step.desc : step.desc}
                </p>
                {isInteractive && (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-gold-500/30 bg-gold-500/10 px-2 py-1 text-[10px] font-bold text-gold-200 max-w-full">
                    <MousePointerClick
                      size={12}
                      className="flex-shrink-0 text-gold-400 animate-pulse"
                    />
                    <span className="truncate">{step.hint || 'Belirtilen yere dokun →'}</span>
                  </div>
                )}
              </div>
              {/* Atla */}
              <button
                onClick={skipActive}
                title="Turu atla — Tutorial Merkezi'nden istediğin an yeniden izleyebilirsin"
                className="flex-shrink-0 w-6 h-6 rounded-lg grid place-items-center bg-ink-950/80 border border-ink-700 text-ink-400 hover:text-white hover:bg-ink-800 transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            {/* Eylem beklenmeyen adımlarda minik ilerleme kontrolleri */}
            {!isInteractive && (
              <div className="flex items-center gap-2 mt-2">
                <span className="mr-auto text-[9px] font-black text-ink-500 tabular-nums">
                  <span className="text-gold-400">{activeStep + 1}</span>/
                  {activeTutorial.steps.length}
                </span>
                {activeStep > 0 && (
                  <button
                    onClick={prevStep}
                    title="Önceki adım"
                    className="w-8 h-8 rounded-lg grid place-items-center bg-ink-800/80 border border-ink-700 text-ink-300 hover:bg-ink-700 hover:text-white transition-colors"
                  >
                    <ChevronLeft size={15} />
                  </button>
                )}
                <button
                  onClick={nextStep}
                  title={isLast ? 'Bitir' : 'İleri'}
                  className={`h-8 px-3 rounded-lg text-[11px] font-black inline-flex items-center gap-1 transition-transform active:scale-95 ${
                    isLast
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-ink-950'
                      : 'bg-gradient-to-r from-gold-500 to-amber-500 text-ink-950'
                  }`}
                >
                  {isLast ? 'Bitir' : 'İleri'} <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
      <div
        style={cardStyle}
        className="tutorial-card relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-ink-900 via-ink-900 to-ink-950 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.95)] backdrop-blur-2xl"
      >
        {/* Üst: tam genişlikte ilerleme çubuğu */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-ink-950/90">
          <div
            className="h-full bg-gradient-to-r from-gold-500 via-amber-400 to-gold-300 transition-all duration-500 shadow-[0_0_12px_rgba(245,158,11,0.85)]"
            style={{ width: `${((activeStep + 1) / activeTutorial.steps.length) * 100}%` }}
          />
        </div>
        {/* Yumuşak ışık halesi */}
        <span className="pointer-events-none absolute -top-24 -right-20 w-56 h-56 rounded-full bg-gold-500/[0.12] blur-[70px]" />
        <span className="pointer-events-none absolute -bottom-24 -left-16 w-56 h-56 rounded-full bg-azure-500/[0.07] blur-[70px]" />
        {/* İnce nokta dokusu */}
        <span
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />

        {/* Başlık satırı: tur rozeti + adım rozeti */}
        <div className="relative flex items-center justify-between gap-3 mb-4 pt-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/10 border border-gold-500/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-gold-300">
            <Sparkles size={11} className="text-gold-400" />
            {TUTORIAL_CENTER.groups[activeTutorial.group]}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-ink-950/80 border border-ink-800 px-2.5 py-1.5 text-[10px] font-black text-ink-300 tabular-nums whitespace-nowrap">
            <span className="text-gold-400">{activeStep + 1}</span>
            <span className="text-ink-600">/</span>
            {activeTutorial.steps.length}
            <span className="text-ink-700">·</span>
            <span className={isLast ? 'text-emerald-300' : 'text-ink-400'}>
              {isLast ? 'Son adım' : `Adım ${activeStep + 1}`}
            </span>
          </span>
        </div>

        <div className="relative flex gap-4 sm:gap-5">
          {/* Sini — altın çerçeveli tile */}
          <div className="flex-shrink-0">
            <div className="relative">
              <span className="absolute inset-0 rounded-3xl bg-gold-500/25 blur-xl" />
              <div className="relative rounded-3xl border border-gold-500/35 bg-ink-950/70 p-2 shadow-[0_0_32px_-12px_rgba(245,158,11,0.95)]">
                <Sini size={isDesktop ? 74 : 60} mood={mood} showGlow={false} />
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className={`${isDesktop ? 'text-[19px]' : 'text-base'} font-black text-white leading-snug tracking-tight`}
            >
              {step.title}
            </h3>
            <p className={`${isDesktop ? 'text-sm' : 'text-xs'} text-ink-300 leading-relaxed mt-2`}>
              {step.desc}
            </p>

            {isInteractive && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2 text-[11px] font-bold text-gold-200">
                <MousePointerClick size={14} className="flex-shrink-0 text-gold-400 animate-pulse" />
                {step.hint || 'Belirtilen yere dokun →'}
              </div>
            )}
          </div>
        </div>

        {/* Kontroller */}
        <div className="relative flex flex-wrap items-center gap-3 mt-5 pt-4 border-t border-white/[0.07]">
          {/* ATLA — kolay fark edilen belirgin buton */}
          <button
            onClick={skipActive}
            title="Turu atla — Tutorial Merkezi'nden istediğin an yeniden izleyebilirsin"
            className="group inline-flex items-center gap-2 rounded-xl border-2 border-rose-400/70 bg-rose-500/20 px-4 sm:px-5 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white shadow-[0_0_20px_-6px_rgba(244,63,94,0.85)] transition-all hover:bg-rose-500 hover:border-rose-400 hover:shadow-[0_0_28px_-4px_rgba(244,63,94,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 active:scale-95"
          >
            <span className="grid place-items-center w-5 h-5 rounded-md bg-white/20 transition-colors group-hover:bg-white/30">
              <X size={13} />
            </span>
            Atla
          </button>
          <span className="hidden sm:block text-[10px] text-ink-500 leading-snug max-w-[150px]">
            Vazgeçtim diyebilirsin.
          </span>

          <div className="flex items-center gap-2 ml-auto">
            {!isInteractive && activeStep > 0 && (
              <button
                onClick={prevStep}
                title="Önceki adım"
                className="w-11 h-11 rounded-xl bg-ink-800/80 border border-ink-700 hover:bg-ink-700 hover:border-ink-600 text-ink-300 flex items-center justify-center transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {!isInteractive && (
              <button
                onClick={nextStep}
                className={`group relative overflow-hidden flex items-center gap-1.5 text-ink-950 px-7 sm:px-8 py-3 rounded-xl text-sm font-black shadow-lg transition-all hover:scale-[1.04] active:scale-100 ${
                  isLast
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400'
                    : 'bg-gradient-to-r from-gold-500 to-amber-500 shadow-gold-500/35 hover:from-gold-400 hover:to-amber-400'
                }`}
              >
                {/* Parlak süpürme efekti */}
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-full transition-transform duration-700" />
                {isLast ? 'Bitir' : 'İleri'} <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Mobile'da kart alta sabitlensin */}
      <style>{`
        @media (max-width: 640px) {
          .tutorial-card {
            left: 16px !important;
            right: 16px;
            width: auto !important;
            top: auto !important;
            bottom: 90px !important;
            transform: none !important;
          }
        }
      `}</style>
    </>
  );
}
