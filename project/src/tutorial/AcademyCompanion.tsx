import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, X, GraduationCap, Move, BookOpen } from 'lucide-react';
import { useTutorial } from '../context/TutorialContext';
import { ACADEMY_QUESTS, TUTORIAL_CENTER } from './texts';
import Sini from './Sini';

const UI_STATE_KEY = 'sinevia-academy-ui-v1';

interface CompanionUiState {
  dismissed?: boolean;
  x?: number;
  y?: number;
}

function loadUiState(): CompanionUiState {
  try {
    // "Her şeyi sil" sonrası: eski arayüz durumu geri yüklenmesin.
    if (localStorage.getItem('sinevia_zero_reset') === '1') return {};
    const raw = localStorage.getItem(UI_STATE_KEY);
    return raw ? (JSON.parse(raw) as CompanionUiState) : {};
  } catch {
    return {};
  }
}

function saveUiState(state: CompanionUiState) {
  try {
    if (localStorage.getItem('sinevia_zero_reset') === '1') return;
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
  } catch {
    /* kota dolu olabilir — sessizce geç */
  }
}

/* ---------- Köşe korumalı konumlandırma ----------
   Kart ile balon arasında geçerken "hangi köşedeyse o köşede kal" kuralı:
   kaynak sağ/alta yakınsa o boşluklar korunur (pencere sağ alttaysa balon da
   sağ altta açılır), sol/üstteyse sol/üst korunur. Sonuç daima viewport içinde. */
const EDGE_PAD = 6;
const CARD_EST = { w: 300, h: 210 };
const BALLOON_EST = { w: 58, h: 80 };

/** Mobilde alt nav (68px) üstünde boşluk bırak. */
function bottomPad() {
  return window.innerWidth >= 768 ? EDGE_PAD : 84;
}

function anchorPoint(from: DOMRect, toW: number, toH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const keepRight = vw - from.right < from.left;
  const keepBottom = vh - from.bottom < from.top;
  const x = keepRight ? vw - (vw - from.right) - toW : from.left;
  const y = keepBottom ? vh - (vh - from.bottom) - toH : from.top;
  const maxW = Math.max(EDGE_PAD, vw - toW - EDGE_PAD);
  const maxH = Math.max(EDGE_PAD, vh - toH - bottomPad());
  return {
    x: Math.min(Math.max(EDGE_PAD, x), maxW),
    y: Math.min(Math.max(EDGE_PAD, y), maxH),
  };
}

function cardWidth() {
  return Math.min(CARD_EST.w, window.innerWidth - 32);
}

/**
 * Sinevia Akademisi — kalıcı, engelleyici olmayan maskot yoldaşı.
 * Sini bir köşede durur, güncel görevi gösterir; kullanıcı gerçek eylemi
 * yaptıkça görev kendiliğinden tamamlanır ve sıradakine geçilir.
 *
 * - **Sürüklenebilir**: başlık çubuğundan tutup istediğiniz köşeye taşıyın
 *   (konum hafızada saklanır). Daraltılmış/kapatılmış hâldeki Sini balonu da
 *   basılı tutup sürüklenerek taşınabilir; tıklayınca kart geri açılır.
 * - **Kapatılabilir**: X ile tamamen gizlenir; sağ altta küçük bir Sini
 *   balonu kalır, tıklayınca geri açılır. Yeni bir ders tamamlanınca
 *   kendiliğinden yeniden belirir.
 */
export default function AcademyCompanion() {
  const { academyActive, academyStep, progress, startTutorial, activeTutorial, setCenterOpen } = useTutorial();
  const [collapsed, setCollapsed] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [prevStep, setPrevStep] = useState(academyStep);
  const [ui, setUi] = useState<CompanionUiState>(() => loadUiState());

  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  /* Balon (daraltılmış / kapatılmış Sini) için sürükleme durumu.
     Balona bas-tut + sürükle = taşı, kısa basıp bırak = tıkla (aç/kapat). */
  const balloonRef = useRef<HTMLButtonElement | null>(null);
  const balloonCleanup = useRef<(() => void) | null>(null);
  const balloonDrag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [balloonDragging, setBalloonDragging] = useState(false);

  const total = ACADEMY_QUESTS.length;
  const allDone = academyStep >= total;
  const current = ACADEMY_QUESTS[academyStep];
  const dismissed = !!ui.dismissed;

  // Görev ilerlediğinde küçük kutlama + yeni ders gelince kapalıysa geri aç
  useEffect(() => {
    if (academyStep > prevStep) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1600);
      setPrevStep(academyStep);
      if (ui.dismissed) {
        const next = { ...ui, dismissed: false };
        setUi(next);
        saveUiState(next);
      }
      return () => clearTimeout(t);
    }
    setPrevStep(academyStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academyStep]);

  // Buluttan eşitleme geldiğinde UI durumunu (konum/kapalı) tazele
  useEffect(() => {
    const onSync = () => setUi(loadUiState());
    window.addEventListener('sinevia-sync-extras-applied', onSync);
    return () => window.removeEventListener('sinevia-sync-extras-applied', onSync);
  }, []);

  // Balon sürüklemesi sırasında pencere kapanırsa global dinleyicileri temizle.
  useEffect(() => {
    return () => {
      balloonCleanup.current?.();
    };
  }, []);

  /* ---------- Sürükleme bitişi (early-return ÖNCESİ tanımlı olmalı) ---------- */
  const onDragEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* yoksay */
    }
    setUi((prev) => {
      saveUiState(prev);
      return prev;
    });
  }, []);

  /* ---------- Görünür elemanın viewport içinde kalmasını sağla ----------
     Genişlet/aç sonrası ve pencere boyutu değişince gerçek ölçüme göre
     sıkıştırır; böylece kart ekran dışına kaçmaz (kart sağ alttaysa balon
     da sağ altta, ikisi de görünür alanda kalır). HOOK: early-return ÖNCESİ. */
  const positionedNow = typeof ui.x === 'number' && typeof ui.y === 'number';
  useEffect(() => {
    if (!positionedNow || !academyActive || activeTutorial || allDone) return;
    const el = cardRef.current || balloonRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const padTop = EDGE_PAD;
      const maxX = Math.max(EDGE_PAD, window.innerWidth - r.width - EDGE_PAD);
      const maxY = Math.max(padTop, window.innerHeight - r.height - bottomPad());
      setUi((prev) => {
        const px = typeof prev.x === 'number' ? prev.x : EDGE_PAD;
        const py = typeof prev.y === 'number' ? prev.y : padTop;
        const nx = Math.min(Math.max(px, EDGE_PAD), maxX);
        const ny = Math.min(Math.max(py, padTop), maxY);
        if (nx === px && ny === py) return prev;
        const next = { ...prev, x: nx, y: ny };
        saveUiState(next);
        return next;
      });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [positionedNow, academyActive, activeTutorial, allDone, collapsed, dismissed]);

  // Bir adım-tutorial (akış/sayfa/pencere) sürerken yoldaş gizlenir (çakışmasın)
  if (!academyActive || activeTutorial) return null;

  // Akademi bitti: yoldaş TAMAMEN kapansın — ne kart, ne balon geri gelmesin
  if (allDone) return null;

  const dismiss = () => {
    // Kartın köşesi korunarak balona dönüşsün (sağ alttaysa balon da sağ altta)
    const card = cardRef.current;
    const pos = card ? anchorPoint(card.getBoundingClientRect(), BALLOON_EST.w, BALLOON_EST.h) : null;
    setUi((prev) => {
      const next: CompanionUiState = { ...prev, dismissed: true, ...(pos || {}) };
      saveUiState(next);
      return next;
    });
  };

  const reopen = () => {
    // Balon köşesinden kart açılsın; konum sonra ölçüme göre sıkıştırılır
    const from = balloonRef.current?.getBoundingClientRect();
    const pos = from ? anchorPoint(from, cardWidth(), CARD_EST.h) : null;
    setUi((prev) => {
      const next: CompanionUiState = { ...prev, dismissed: false, ...(pos || {}) };
      saveUiState(next);
      return next;
    });
  };

  /** Kartı daralt: balon kartın köşesinde kalsın. */
  const collapse = () => {
    const card = cardRef.current;
    const pos = card ? anchorPoint(card.getBoundingClientRect(), BALLOON_EST.w, BALLOON_EST.h) : null;
    setUi((prev) => {
      const next: CompanionUiState = { ...prev, ...(pos || {}) };
      saveUiState(next);
      return next;
    });
    setCollapsed(true);
  };

  /* ---------- Sürükleme (başlık çubuğundan) ---------- */
  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    // Butonlara basmak sürüklemeyi başlatmasın
    if ((e.target as HTMLElement).closest('button')) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    dragRef.current = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const card = cardRef.current;
    if (!drag || !card) return;
    const rect = card.getBoundingClientRect();
    const x = Math.min(
      Math.max(8, e.clientX - drag.offsetX),
      window.innerWidth - rect.width - 8
    );
    const y = Math.min(
      Math.max(8, e.clientY - drag.offsetY),
      window.innerHeight - rect.height - 8
    );
    setUi((prev) => ({ ...prev, x, y }));
  };

  /* ---------- Balon sürükleme (bas-tut → taşı, tıkla → aç) ----------
     Mobil tarayıcılarda pointer capture + React sentetik olayları güvenilir
     çalışmadığı için (özellikle iOS Safari) hareket/bitiş olayları doğrudan
     window üzerinden dinlenir. Böylece küçültülmüş balon parmağı takip eder,
     sürükleme sırasında yanlışlıkla "aç" tıklaması tetiklenmez. */
  const onBalloonDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    suppressClick.current = false;
    const el = balloonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    balloonDrag.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    };

    const onMove = (event: PointerEvent) => {
      const d = balloonDrag.current;
      if (!d || event.pointerId !== d.pointerId) return;
      const dx = event.clientX - d.x;
      const dy = event.clientY - d.y;
      if (!d.moved) {
        // Küçük parmak titremesi tıklamayı bozmasın
        if (Math.hypot(dx, dy) < 5) return;
        d.moved = true;
        suppressClick.current = true;
        setBalloonDragging(true);
      }
      event.preventDefault();
      const current = balloonRef.current;
      if (!current) return;
      const width = current.offsetWidth;
      const height = current.offsetHeight;
      const maxLeft = Math.max(4, window.innerWidth - width - 4);
      // Mobilde alt navigasyon çubuğunun altına inmesin.
      const bottomGap = window.innerWidth >= 768 ? 4 : 72;
      const maxTop = Math.max(4, window.innerHeight - height - bottomGap);
      const left = Math.min(Math.max(4, d.left + dx), maxLeft);
      const top = Math.min(Math.max(4, d.top + dy), maxTop);
      setUi((prev) => ({ ...prev, x: left, y: top }));
    };

    const finish = (event: PointerEvent) => {
      const d = balloonDrag.current;
      if (!d || event.pointerId !== d.pointerId) return;
      balloonDrag.current = null;
      setBalloonDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      balloonCleanup.current = null;
      if (d.moved) {
        // Sürüklendiyse tıklama olayını yut (balon açılmasın), konumu kaydet
        suppressClick.current = true;
        setUi((prev) => {
          saveUiState(prev);
          return prev;
        });
      }
    };

    balloonCleanup.current?.();
    balloonCleanup.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  const onBalloonClick = (action: () => void) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    action();
  };

  /** Balon köşesinden kartı aç: kart da aynı köşede açılsın, ekran dışına
      taşmasın (konum sonra gerçek ölçüme göre bir kez daha sıkıştırılır). */
  const expand = () => {
    const from = balloonRef.current?.getBoundingClientRect();
    const pos = from ? anchorPoint(from, cardWidth(), CARD_EST.h) : null;
    setUi((prev) => {
      const next: CompanionUiState = { ...prev, ...(pos || {}) };
      saveUiState(next);
      return next;
    });
    setCollapsed(false);
  };

  const balloonHandlers = {
    onPointerDown: onBalloonDown,
  };

  // Konum: sürüklendiyse sol/üst, değilse varsayılan köşe
  const positioned = typeof ui.x === 'number' && typeof ui.y === 'number';
  const posStyle: React.CSSProperties = positioned
    ? { left: ui.x!, top: ui.y! }
    : {};

  const cornerCls = positioned
    ? ''
    : 'bottom-20 right-4 md:bottom-4 md:right-4';

  /* ---------- Küçük geri aç balonu (kapatıldıysa) ---------- */
  if (dismissed) {
    return (
      <button
        ref={balloonRef}
        onClick={() => onBalloonClick(reopen)}
        {...balloonHandlers}
        title="Sinevia Akademisi'ni aç · Taşımak için sürükle"
        className={`fixed ${positioned ? '' : 'bottom-20 right-4 md:bottom-4 md:right-4'} z-[190] group touch-none ${balloonDragging ? 'cursor-grabbing scale-105' : 'cursor-grab active:cursor-grabbing'}`}
        /* Global `button { touch-action: manipulation }` kuralını ezmek için
           inline veriyoruz; aksi hâlde mobil tarayıcı jesti devralıp
           pointercancel ile sürüklemeyi kesiyor. */
        style={{ ...posStyle, touchAction: 'none' }}
      >
        <span className="relative block">
          <span className="absolute inset-0 rounded-full bg-gold-500/20 blur-md group-hover:bg-gold-500/30 transition-colors" />
          <span className="relative block rounded-full border border-gold-500/40 bg-ink-950/95 p-1 shadow-lg shadow-gold-500/10 backdrop-blur-md transition-transform group-hover:scale-110">
            <Sini size={40} mood="idle" showGlow={false} />
          </span>
        </span>
      </button>
    );
  }

  /* ---------- Daraltıldıysa: canlı Sini balonu ----------
     Kart genişliğindeyken altındaki içerik tıklanamıyordu/okunamıyordu.
     Daraltma artık sadece ~50px'lik yuvarlak bir balon bırakır: arkasına
     rahatça erişilir, tıklanır; tıklayınca kart geri açılır, sürüklendiğinde
     taşınır (konum hafızada saklanır). */
  if (collapsed) {
    return (
      <button
        ref={balloonRef}
        onClick={() => onBalloonClick(expand)}
        {...balloonHandlers}
        title="Akademisi'ni genişlet · Taşımak için sürükle"
        className={`fixed ${positioned ? '' : 'bottom-20 right-4 md:bottom-4 md:right-4'} z-[190] group touch-none ${balloonDragging ? 'cursor-grabbing scale-105' : 'cursor-grab active:cursor-grabbing'}`}
        style={{ ...posStyle, touchAction: 'none' }}
      >
        <span className="relative block">
          <span className="absolute inset-0 rounded-full bg-gold-500/20 blur-md group-hover:bg-gold-500/35 transition-colors" />
          <span className="relative flex items-center rounded-full border border-gold-500/50 bg-ink-950/95 p-1 shadow-lg shadow-gold-500/15 backdrop-blur-md transition-transform group-hover:scale-110">
            <Sini size={42} mood="idle" showGlow={false} />
          </span>
          <span className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 rounded-full bg-gold-500 border-2 border-ink-950 text-ink-950 text-[10px] font-black flex items-center justify-center shadow-md">
            {academyStep + 1}
          </span>
        </span>
        <span className="block mt-1 text-[9px] font-black text-gold-300/90 tracking-wider">
          {academyStep + 1}/{total} DERS
        </span>
      </button>
    );
  }

  /* ---------- Tamamlandı kartı KALDIRILDI ----------
     Tüm dersler bitince yoldaş tamamen kapanır (yukarıda `allDone → null`). */

  if (!current) return null;

  const doneCount = progress.academyDone.length;
  const pct = Math.round((doneCount / total) * 100);

  return (
    <div
      ref={cardRef}
      className={`fixed ${cornerCls} z-[190] tutorial-card select-none ${
        collapsed ? 'overflow-hidden' : 'max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain'
      } ${
        dragging ? 'cursor-grabbing shadow-[0_30px_90px_rgba(0,0,0,0.85)]' : ''
      }`}
      style={{
        ...posStyle,
        width: collapsed ? undefined : 'min(300px, calc(100vw - 32px))',
      }}
    >
      {/* Konfeti */}
      {celebrate && (
        <div className="sini-confetti absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              style={{
                left: `${6 + i * 6}%`,
                background: ['#f59e0b', '#38bdf8', '#f472b6', '#34d399', '#a78bfa'][i % 5],
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Başlık çubuğu = sürükleme tutamağı */}
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        className="flex items-center justify-between mb-2 -mt-0.5 cursor-grab active:cursor-grabbing touch-none"
        title="Sürükle"
      >
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gold-400">
          <GraduationCap size={12} /> {TUTORIAL_CENTER.groups.academy}
        </div>
        <div className="flex items-center gap-2">
          <Move size={11} className="text-ink-600" />
          <button
            onClick={collapse}
            className="text-ink-500 hover:text-ink-300 transition-colors"
            title={collapsed ? 'Genişlet' : 'Daralt'}
          >
            <span className={`block text-[13px] font-black leading-none ${collapsed ? '' : ''}`}>{collapsed ? '+' : '–'}</span>
          </button>
          <button onClick={dismiss} className="text-ink-500 hover:text-ink-300 transition-colors" title="Kapat">
            <X size={14} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="flex gap-2.5">
            <div className="flex-shrink-0">
              <Sini size={54} mood={celebrate ? 'happy' : 'point'} pointDir="down" showGlow={false} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-ink-500 mb-0.5">
                Ders {academyStep + 1} / {total}
              </div>
              <h4 className="text-sm font-black text-white leading-tight">{current.title}</h4>
              <p className="text-[11px] text-ink-300 leading-snug mt-1">{current.desc}</p>
            </div>
          </div>

          {/* İlerleme çubuğu */}
          <div className="mt-3">
            <div className="h-1.5 w-full bg-ink-900 rounded-full overflow-hidden border border-ink-800">
              <div
                className="h-full bg-gradient-to-r from-gold-500 to-amber-400 rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 gap-2">
              <span className="text-[9px] font-bold text-ink-500">{doneCount}/{total} ders</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => startTutorial('welcome')}
                  className="text-[9px] font-bold text-azure-400 hover:text-azure-300 transition-colors flex items-center gap-1"
                >
                  <Sparkles size={9} /> Turu tekrar izle
                </button>
                <button
                  onClick={() => setCenterOpen(true)}
                  title="Tutorial Merkezi'ni aç"
                  className="text-[9px] font-bold text-gold-400 hover:text-gold-300 transition-colors flex items-center gap-1 border border-gold-500/30 bg-gold-500/10 hover:bg-gold-500/20 rounded-lg px-2 py-1"
                >
                  <BookOpen size={9} /> Tutorial Merkezi
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
