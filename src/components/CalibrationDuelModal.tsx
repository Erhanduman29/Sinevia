import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Crown,
  Dices,
  Film,
  Gauge,
  SkipForward,
  Star,
  Swords,
  X,
} from 'lucide-react';
import { useActions, useLibrary } from '../context/slices';
import { calculateEloDelta, pickDuelPair } from '../lib/calibrationEngine';
import { handleImgFallback } from '../lib/selectors';
import { ratingBgClass } from '../lib/utils';
import { isTypingTarget } from '../lib/shortcuts';
import { useShortcuts } from '../hooks/useShortcuts';
import type { Movie } from '../types';

/**
 * KÖR KALİBRASYON DÜELLO MODALI (Zevk Kalibrasyonu — Mod 2)
 *
 * pickDuelPair() ile sıradaki eşleşme seçilir; kullanıcı ← / → ile (veya
 * afiş kartlarına dokunarak) kazananı seçer, ↓/Boşluk ile atlar. resolveDuel()
 * reducer'ı Elo güncellemesini (calibratedScore, duelCount/duelWins) halleder.
 * 5 düello tamamlanınca modal kapanır ve toast yayınlanır.
 *
 * Tasarım: masaüstünde sinematik VS ekranı (büyük afişler, tıklanabilir kart),
 * mobilde kompakt tek-satır meta. 5'lik tur ilerlemesi modalın en üstünde
 * ince bar olarak taşınır.
 *
 * Klavye: useShortcuts "close" (ESC) eylemini taşır; ok/boşluk tuşları
 * modalın kendi keydown dinleyicisinde yakalanır (metin girişi odaktayken
 * etkisizdir).
 *
 * Renkler sabit DEĞİL — var() fallback zincirleri (tema motoru uyumlu).
 */

const RED = 'var(--red, var(--color-1, #e8384f))';
const SURFACE = 'var(--bg-surface, #10121a)';
const TEXT = 'var(--text-main, #f4f4f2)';
const MUTED = 'var(--muted, #9aa0ab)';
const LINE = 'var(--line, rgba(244, 244, 242, 0.14))';
const ON_RED = 'var(--on-color-1, #0a0a0e)';
const GLASS = 'var(--glass, rgba(255, 255, 255, 0.05))';
/** Nötr cam ikinci ton (karşılaştırma çubuğunda B tarafı). */
const GLASS_TEXT = `color-mix(in srgb, ${TEXT} 35%, transparent)`;
/** Afiş üzerinde okunurluk perdesi (siyah → saydam dikey degrade). */
const POSTER_SCRIM =
  'linear-gradient(to top, rgba(8, 8, 12, 0.96) 0%, rgba(8, 8, 12, 0.55) 32%, rgba(8, 8, 12, 0.08) 62%, transparent 100%)';

/** Tur uzunluğu: 5 düello → kapanış + toast. */
const ROUNDS = 5;
/** Tur sonu (delta animasyonu) ekranının gösterim süresi. */
const REVEAL_MS = 1400;

interface RevealSide {
  id: string;
  title: string;
  posterUrl: string | null;
  oldScore: number;
  newScore: number;
}

interface RevealState {
  side: 'a' | 'b';
  delta: number;
  winner: RevealSide;
  loser: RevealSide;
}

interface CalibrationDuelModalProps {
  onClose: () => void;
}

/**
 * VS kartı — sinematik afiş paneli.
 * Tüm kart kazanan seçimine tıklanabilir (hover'da afiş hafif büyür,
 * kenarlık aksan rengine döner); alt şeritte kalibre puan + düello sayısı.
 */
function DuelSide({
  movie,
  side,
  disabled,
  onPick,
}: {
  movie: Movie;
  side: 'a' | 'b';
  disabled: boolean;
  onPick: () => void;
}) {
  const calibrated =
    movie.calibratedScore ?? (typeof movie.rating === 'number' ? movie.rating : null);
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      title={`Kazanan: ${movie.title} (${side === 'a' ? '←' : '→'})`}
      style={{ background: GLASS, borderColor: LINE }}
      className="group relative w-full min-w-0 max-w-[300px] sm:max-w-[min(320px,30svh)] lg:max-w-[min(340px,32svh)] mx-auto rounded-2xl overflow-hidden border text-left transition-all duration-200 hover:border-[color:var(--red,#e8384f)] hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 disabled:hover:translate-y-0"
    >
      {/* AFİŞ */}
      <div
        style={{ background: SURFACE }}
        className="relative w-full aspect-[2/3] overflow-hidden"
      >
        {movie.posterUrl ? (
          <img
            loading="lazy"
            decoding="async"
            src={movie.posterUrl}
            alt={movie.title}
            onError={handleImgFallback}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        ) : (
          <div
            style={{ color: MUTED }}
            className="absolute inset-0 grid place-items-center"
          >
            <Film size={34} strokeWidth={1.5} />
          </div>
        )}

        {/* Okunurluk perdesi */}
        <div className="absolute inset-0" style={{ background: POSTER_SCRIM }} />

        {/* Puan rozeti — afişin sol üstünde (Geçmiş'teki ratingBgClass paleti) */}
        <span
          className={`absolute top-2.5 left-2.5 sm:top-3 sm:left-3 text-[11px] sm:text-sm font-black px-2 py-1 rounded-lg flex items-center gap-1 tabular-nums shadow-lg ${ratingBgClass(movie.rating ?? 0)}`}
        >
          <Star size={11} fill="currentColor" /> {movie.rating ?? '—'}
        </span>

        {/* Kazanan yön ipucu — afişin sağ üstünde (sadece hover) */}
        <span
          style={{ background: 'rgba(8, 8, 12, 0.72)', color: TEXT, borderColor: LINE }}
          className="hidden sm:flex absolute top-3 right-3 items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg border opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
          {side === 'a' ? <ArrowLeft size={11} /> : <ArrowRight size={11} />}
          Kazandı
        </span>

        {/* Başlık — perde üzerinde */}
        <div className="absolute bottom-0 inset-x-0 p-2.5 sm:p-3.5">
          <div
            style={{ color: TEXT }}
            className="text-[13px] sm:text-lg lg:text-xl font-black leading-tight line-clamp-2 drop-shadow"
          >
            {movie.title}
          </div>
          <div
            style={{ color: 'color-mix(in srgb, var(--text-main, #f4f4f2) 60%, transparent)' }}
            className="text-[10px] sm:text-xs font-bold mt-0.5 tabular-nums"
          >
            {movie.year || '—'}
          </div>
        </div>
      </div>

      {/* META ŞERİDİ */}
      <div
        style={{ borderColor: LINE }}
        className="flex items-center justify-between gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 border-t"
      >
        <span style={{ color: MUTED }} className="text-[10px] sm:text-[11px] font-bold">
          Kalibre{' '}
          <span style={{ color: TEXT }} className="font-black tabular-nums">
            {calibrated != null ? calibrated.toFixed(2) : '—'}
          </span>
        </span>
        <span
          style={{ color: MUTED }}
          className="text-[9.5px] sm:text-[10px] font-bold tabular-nums flex items-center gap-1"
          title="Bu filmin girdiği düello sayısı"
        >
          <Swords size={10} /> {movie.duelCount || 0} düello
        </span>
      </div>
    </button>
  );
}

/** VS amblemi: ince çizgiler + merkez rozet. */
function VsEmblem({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-1 py-2">
      <div style={{ background: LINE }} className="hidden sm:block w-px flex-1 min-h-6" />
      <div
        style={{ background: RED, color: ON_RED, boxShadow: '0 8px 28px rgba(232, 56, 79, 0.35)' }}
        className="w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-black text-sm sm:text-lg tracking-tight shrink-0"
      >
        VS
      </div>
      <div style={{ background: LINE }} className="hidden sm:block w-px flex-1 min-h-6" />
      <span
        style={{ color: MUTED }}
        className="text-[8.5px] sm:text-[9px] font-black uppercase tracking-widest text-center leading-tight max-w-[74px] sm:max-w-[86px]"
      >
        {label}
      </span>
    </div>
  );
}

/** Klavye ipucu tuşu (masaüstü). */
function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{ borderColor: LINE, color: TEXT, background: GLASS }}
      className="px-1.5 py-0.5 rounded-md border text-[10px] font-black"
    >
      {children}
    </kbd>
  );
}

export default function CalibrationDuelModal({ onClose }: CalibrationDuelModalProps) {
  const { movies } = useLibrary();
  const { resolveDuel, showToast } = useActions();

  const [round, setRound] = useState(0);
  /** Kullanıcının atlattığı adaylar (b tarafı) — eşleşme çeşitliliği için. */
  const [excluded, setExcluded] = useState<string[]>([]);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  /** Açılışta filtre penceresi gösterilir; düello "Başla" ile başlar. */
  const [phase, setPhase] = useState<'setup' | 'duel'>('setup');
  /** Seçilen türler (boş = tüm türler). */
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  /** Rastgele mod: eşit puan bandında rastgele ikili seçer. */
  const [randomMode, setRandomMode] = useState(false);

  /** Düello havuzundaki (izlenmiş + puanlı + abandoned olmayan) filmlerin türleri. */
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    movies
      .filter((m) => m.watched && typeof m.rating === 'number' && !m.abandoned)
      .forEach((m) => (m.genres || []).forEach((g) => set.add(g)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [movies]);

  const toggleGenre = (g: string) =>
    setSelectedGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const pair = useMemo(() => {
    const pool = excluded.length > 0 ? movies.filter((m) => !excluded.includes(m.id)) : movies;
    return pickDuelPair(pool, undefined, {
      genres: selectedGenres.length > 0 ? selectedGenres : undefined,
      random: randomMode,
    });
  }, [movies, excluded, selectedGenres, randomMode]);

  // ESC — useShortcuts'ın "close" eylemi (modal açıkken de tetiklenir).
  useShortcuts({ close: () => onClose() });

  const pickWinner = (side: 'a' | 'b') => {
    if (!pair || reveal) return;
    const winner = side === 'a' ? pair.a : pair.b;
    const loser = side === 'a' ? pair.b : pair.a;
    const wOld = winner.calibratedScore ?? winner.rating ?? 5;
    const lOld = loser.calibratedScore ?? loser.rating ?? 5;
    // Sonucu reducer öncesi yerel olarak hesapla — calculateEloDelta saf ve
    // reducer'la aynı girdileri kullandığı için değerler birebir örtüşür.
    const { winnerNew, loserNew, delta } = calculateEloDelta(wOld, lOld);
    setReveal({
      side,
      delta,
      winner: {
        id: winner.id,
        title: winner.title,
        posterUrl: winner.posterUrl || null,
        oldScore: wOld,
        newScore: winnerNew,
      },
      loser: {
        id: loser.id,
        title: loser.title,
        posterUrl: loser.posterUrl || null,
        oldScore: lOld,
        newScore: loserNew,
      },
    });
    // Reducer: Elo + duelCount/duelWins.
    resolveDuel(winner.id, loser.id, 'movie');
  };

  const skipPair = () => {
    if (!pair || reveal) return;
    setExcluded((prev) => (prev.includes(pair.b.id) ? prev : [...prev, pair.b.id]));
  };

  // Tur akışı: sonuç ekranı REVEAL_MS → sonraki tur; 5. turda kapanış + toast.
  useEffect(() => {
    if (!reveal) return;
    const t = window.setTimeout(() => {
      setReveal(null);
      const next = round + 1;
      if (next >= ROUNDS) {
        showToast(`⚖️ ${ROUNDS} düello tamamlandı — puanların kalibre edildi`, 'success');
        onClose();
      } else {
        setRound(next);
      }
    }, REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [reveal, round, onClose, showToast]);

  // Klavye: ← Sol kazanan, → Sağ kazanan, ↓ / Boşluk atla.
  // (useShortcuts yalnızca tanımlı eylemleri yürütür; ok/boşluk eylem
  //  listesinde olmadığından modal kendi dinleyicisini kurar — core'a dokunmadan.)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'duel') return;
      if (e.defaultPrevented || e.repeat) return;
      if (isTypingTarget(e.target)) return;
      // Odaklı butonda Boşluk doğal tıklamayı tetikler — çift aksiyonu engelle.
      const onButton = (e.target as HTMLElement | null)?.tagName === 'BUTTON';
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        pickWinner('a');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        pickWinner('b');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        skipPair();
      } else if (e.key === ' ') {
        if (onButton) return;
        e.preventDefault();
        skipPair();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const aRating = typeof pair?.a.rating === 'number' ? pair.a.rating : 0;
  const bRating = typeof pair?.b.rating === 'number' ? pair.b.rating : 0;
  const ratingTotal = Math.max(aRating + bRating, 0.001);
  const aPct = (aRating / ratingTotal) * 100;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-2 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: SURFACE, borderColor: LINE, color: TEXT }}
        className="relative w-full max-w-xl sm:max-w-4xl lg:max-w-5xl border rounded-2xl sm:rounded-[1.75rem] overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.9)] flex flex-col max-h-[94svh] sm:max-h-[92dvh] animate-fade-in-up"
      >
        {/* TUR İLERLEMESİ — en üstte ince bar */}
        <div style={{ background: LINE }} className="absolute top-0 inset-x-0 h-[3px] z-20">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${phase === 'duel' ? ((round + (reveal ? 1 : 0)) / ROUNDS) * 100 : 0}%`,
              background: RED,
            }}
          />
        </div>

        {/* ÜST BAŞLIK */}
        <div
          style={{ borderColor: LINE }}
          className="relative z-10 flex items-center justify-between gap-3 px-3.5 pt-4 pb-3 sm:px-7 sm:pt-5 sm:pb-4 border-b shrink-0"
        >
          <div className="min-w-0">
            <div
              style={{ color: RED }}
              className="inline-flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-0.5"
            >
              <Swords size={12} /> Kör Kalibrasyon
            </div>
            <h2
              style={{ color: TEXT }}
              className="text-lg sm:text-2xl font-black uppercase tracking-tight truncate leading-none"
            >
              Düelloya Başla
            </h2>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {phase === 'duel' && (
              <span
                style={{ color: MUTED }}
                className="text-[10px] sm:text-xs font-black tabular-nums uppercase tracking-wider"
              >
                {round} / {ROUNDS}
              </span>
            )}
            <button
              onClick={onClose}
              title="Kapat"
              style={{ background: GLASS, borderColor: LINE, color: MUTED }}
              className="w-9 h-9 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center transition-all hover:opacity-75"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* İÇERİK */}
        <div className="relative z-10 flex-1 overflow-y-auto p-3 sm:p-5 custom-scrollbar">
          {reveal ? (
            /* ---------- TUR SONU: animasyonlu ±delta ---------- */
            <div className="animate-fade-in-up space-y-4 py-2 sm:py-4">
              <div className="text-center">
                <div
                  style={{ color: RED }}
                  className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] flex items-center justify-center gap-1.5"
                >
                  <Crown size={13} /> Tur Sonucu
                </div>
                <div
                  style={{ color: TEXT }}
                  className="text-4xl sm:text-6xl font-black tabular-nums tracking-tight mt-1.5"
                >
                  ±{reveal.delta.toFixed(2)}
                </div>
                <div style={{ color: MUTED }} className="text-[11px] sm:text-xs font-bold mt-1">
                  Elo güncellemesi uygulandı
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 max-w-2xl mx-auto">
                {[reveal.winner, reveal.loser].map((item, idx) => {
                  const won = idx === 0;
                  return (
                    <div
                      key={`${item.id}-${won ? 'w' : 'l'}`}
                      style={{
                        background: won
                          ? `color-mix(in srgb, ${RED} 12%, transparent)`
                          : GLASS,
                        borderColor: won
                          ? `color-mix(in srgb, ${RED} 45%, transparent)`
                          : LINE,
                      }}
                      className="border rounded-2xl p-2.5 sm:p-4 flex items-center gap-2.5 sm:gap-3.5 animate-fade-in-up min-w-0"
                    >
                      {/* Küçük afiş */}
                      <div
                        style={{ background: SURFACE, borderColor: LINE }}
                        className="w-11 sm:w-16 aspect-[2/3] rounded-lg overflow-hidden border shrink-0"
                      >
                        {item.posterUrl ? (
                          <img
                            src={item.posterUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            style={{ color: MUTED }}
                            className="w-full h-full grid place-items-center"
                          >
                            <Film size={16} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span
                            style={{ color: won ? RED : MUTED }}
                            className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
                          >
                            {won ? (
                              <>
                                <Crown size={11} /> Kazanan
                              </>
                            ) : (
                              'Kaybeden'
                            )}
                          </span>
                          <span
                            style={{ color: won ? RED : MUTED }}
                            className="text-xs sm:text-sm font-black tabular-nums"
                          >
                            {won ? '+' : '−'}
                            {reveal.delta.toFixed(2)}
                          </span>
                        </div>
                        <div
                          style={{ color: TEXT }}
                          className="text-[11px] sm:text-sm font-black truncate"
                          title={item.title}
                        >
                          {item.title}
                        </div>
                        <div
                          style={{ color: MUTED }}
                          className="text-[10px] sm:text-[11px] font-bold tabular-nums mt-0.5"
                        >
                          {item.oldScore.toFixed(2)} → {item.newScore.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : phase === 'setup' ? (
            /* ---------- AÇILIŞ: FİLTRE PENCERESİ ---------- */
            <div className="space-y-4 sm:space-y-5 max-w-lg mx-auto animate-fade-in-up">
              <div className="text-center">
                <div
                  style={{ color: RED }}
                  className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] flex items-center justify-center gap-1.5"
                >
                  <Swords size={13} /> Düello Filtresi
                </div>
                <p
                  style={{ color: MUTED }}
                  className="text-[11px] sm:text-sm mt-1.5 leading-relaxed"
                >
                  Düellolara hangi filmlerle gireceğini seç. Eşleşmeler yalnızca aynı
                  puanlı (veya <strong style={{ color: TEXT }}>±0.5</strong> puan
                  aralığındaki) filmler arasından yapılır.
                </p>
              </div>

              {/* RASTGELE MOD */}
              <button
                type="button"
                onClick={() => setRandomMode((v) => !v)}
                style={{
                  background: randomMode
                    ? `color-mix(in srgb, ${RED} 14%, transparent)`
                    : GLASS,
                  borderColor: randomMode
                    ? `color-mix(in srgb, ${RED} 45%, transparent)`
                    : LINE,
                  color: randomMode ? RED : MUTED,
                }}
                className="w-full flex items-center justify-between gap-3 px-3.5 sm:px-4 py-3 sm:py-3.5 rounded-xl border text-left transition-all"
              >
                <span className="min-w-0 flex items-center gap-2.5">
                  <Dices size={18} className="shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-[11px] sm:text-xs font-black uppercase tracking-wider">
                      Rastgele Eşleşme
                    </span>
                    <span className="block text-[10px] sm:text-[11px] font-bold opacity-75 mt-0.5">
                      Aynı puan bandındaki adaylardan rastgele ikili seç
                    </span>
                  </span>
                </span>
                <span
                  className="shrink-0 text-[9.5px] sm:text-[10px] font-black px-2 py-1 rounded-lg border tabular-nums"
                  style={{
                    background: randomMode ? RED : 'transparent',
                    color: randomMode ? ON_RED : MUTED,
                    borderColor: randomMode ? RED : LINE,
                  }}
                >
                  {randomMode ? 'AÇIK' : 'KAPALI'}
                </span>
              </button>

              {/* TÜR FİLTRESİ */}
              <div>
                <div
                  style={{ color: MUTED }}
                  className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-widest mb-2"
                >
                  Türler {selectedGenres.length > 0 && `(${selectedGenres.length} seçili)`}
                </div>
                {allGenres.length === 0 ? (
                  <p style={{ color: MUTED }} className="text-xs py-3 text-center">
                    Düello havuzunda film yok — önce izleyip puanla.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedGenres([])}
                      style={{
                        background: selectedGenres.length === 0 ? RED : GLASS,
                        borderColor: selectedGenres.length === 0 ? RED : LINE,
                        color: selectedGenres.length === 0 ? ON_RED : MUTED,
                      }}
                      className="px-3 py-1.5 rounded-lg border text-[11px] font-black transition-all"
                    >
                      Tümü
                    </button>
                    {allGenres.map((g) => {
                      const on = selectedGenres.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => toggleGenre(g)}
                          style={{
                            background: on
                              ? `color-mix(in srgb, ${RED} 14%, transparent)`
                              : GLASS,
                            borderColor: on
                              ? `color-mix(in srgb, ${RED} 45%, transparent)`
                              : LINE,
                            color: on ? RED : MUTED,
                          }}
                          className="px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all"
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* BAŞLA */}
              <button
                type="button"
                onClick={() => setPhase('duel')}
                disabled={allGenres.length === 0}
                style={{ background: RED, color: ON_RED, borderColor: RED }}
                className="w-full py-3.5 sm:py-4 min-h-12 rounded-xl border font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Swords size={16} /> Düelloya Başla
              </button>
              <p style={{ color: MUTED }} className="text-[10px] text-center leading-relaxed">
                Eşleşme bulunamazsa (±0.5 puan bandında film yoksa) düello boş durumu gösterir.
                5 düello tamamlanınca modal kapanır.
              </p>
            </div>
          ) : pair ? (
            /* ---------- VS EKRANI ---------- */
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-1.5 sm:gap-5 items-center">
                <DuelSide
                  movie={pair.a}
                  side="a"
                  disabled={Boolean(reveal)}
                  onPick={() => pickWinner('a')}
                />
                <VsEmblem
                  label={pair.mode === 'target' ? 'Anlık Eşleşme' : 'En Yakın Eşleşme'}
                />
                <DuelSide
                  movie={pair.b}
                  side="b"
                  disabled={Boolean(reveal)}
                  onPick={() => pickWinner('b')}
                />
              </div>

              {/* PUAN KARŞILAŞTIRMA ÇUBUĞU */}
              <div className="max-w-2xl mx-auto w-full">
                <div
                  style={{ color: MUTED }}
                  className="flex items-center justify-between text-[9.5px] sm:text-[10px] font-black uppercase tracking-widest mb-1.5"
                >
                  <span className={`tabular-nums px-1.5 py-0.5 rounded ${ratingBgClass(aRating || 0)}`}>Puan {aRating || '—'}</span>
                  <span>Karşılaştırma</span>
                  <span className={`tabular-nums px-1.5 py-0.5 rounded ${ratingBgClass(bRating || 0)}`}>{bRating || '—'} Puan</span>
                </div>
                <div
                  style={{ background: LINE }}
                  className="h-1.5 sm:h-2 w-full rounded-full overflow-hidden flex"
                >
                  <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${aPct}%`, background: RED }}
                  />
                  <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${100 - aPct}%`, background: GLASS_TEXT }}
                  />
                </div>
              </div>

              {/* AKSİYONLAR */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-2xl mx-auto w-full">
                <button
                  type="button"
                  onClick={() => pickWinner('a')}
                  disabled={Boolean(reveal)}
                  style={{ background: RED, color: ON_RED, borderColor: RED }}
                  className="py-3 min-h-11 rounded-xl border font-black text-[11px] sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
                  title="Kazanan: Sol film (←)"
                >
                  <ArrowLeft size={15} /> <span className="hidden sm:inline">Sol Kazandı</span>
                  <span className="sm:hidden">Sol</span>
                </button>
                <button
                  type="button"
                  onClick={skipPair}
                  disabled={Boolean(reveal)}
                  style={{ background: GLASS, borderColor: LINE, color: MUTED }}
                  className="py-3 min-h-11 rounded-xl border font-bold text-[10px] sm:text-[11px] flex flex-col items-center justify-center gap-0.5 transition-all hover:opacity-80 active:scale-[0.98] disabled:opacity-50"
                  title="Bu eşleşmeyi atla (↓ veya Boşluk)"
                >
                  <span className="flex items-center gap-1">
                    <SkipForward size={12} /> Atla
                  </span>
                  <span className="hidden sm:block text-[9px] tracking-wider">↓ / Boşluk</span>
                </button>
                <button
                  type="button"
                  onClick={() => pickWinner('b')}
                  disabled={Boolean(reveal)}
                  style={{ background: RED, color: ON_RED, borderColor: RED }}
                  className="py-3 min-h-11 rounded-xl border font-black text-[11px] sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
                  title="Kazanan: Sağ film (→)"
                >
                  <span className="hidden sm:inline">Sağ Kazandı</span>
                  <span className="sm:hidden">Sağ</span> <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            /* ---------- BOŞ DURUM ---------- */
            <div className="text-center py-10 px-4">
              <Gauge size={36} style={{ color: MUTED }} className="mx-auto mb-3" />
              <p style={{ color: TEXT }} className="text-sm font-black uppercase tracking-widest">
                Uygun düello adayı yok
              </p>
              <p style={{ color: MUTED }} className="text-xs mt-1.5 leading-relaxed max-w-sm mx-auto">
                En az 2 izlenmiş ve puanlı film gerekiyor
                {excluded.length > 0
                  ? ' — atlattığın adaylar da havuzu tüketmiş olabilir.'
                  : '.'}
              </p>
              {excluded.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExcluded([])}
                  style={{ background: RED, color: ON_RED, borderColor: RED }}
                  className="mt-4 px-4 py-2.5 rounded-xl border font-black text-xs uppercase tracking-wider transition-all active:scale-[0.98]"
                >
                  Atlananları Sıfırla
                </button>
              )}
            </div>
          )}
        </div>

        {/* ALT: KLAVYE İPUÇLARI (masaüstü) + KAPAT */}
        <div
          style={{ borderColor: LINE, background: SURFACE }}
          className="relative z-10 px-3.5 py-2.5 sm:px-7 sm:py-3.5 border-t flex items-center justify-between gap-3 shrink-0"
        >
          <div
            style={{ color: MUTED }}
            className="hidden sm:flex items-center gap-3 text-[9.5px] font-black uppercase tracking-widest"
          >
            <span className="flex items-center gap-1">
              <KeyCap>←</KeyCap> Sol kazanan
            </span>
            <span className="flex items-center gap-1">
              <KeyCap>→</KeyCap> Sağ kazanan
            </span>
            <span className="flex items-center gap-1">
              <KeyCap>↓</KeyCap>
              <KeyCap>Boşluk</KeyCap> Atla
            </span>
          </div>
          <span
            style={{ color: MUTED }}
            className="sm:hidden text-[10px] font-bold"
          >
            Afişe dokunarak kazananı seç
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: GLASS, borderColor: LINE, color: TEXT }}
            className="px-3.5 py-2 min-h-9 rounded-xl border font-bold text-[11px] transition-all hover:opacity-80 shrink-0"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
