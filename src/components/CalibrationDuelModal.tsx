import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Crown,
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
import { isTypingTarget } from '../lib/shortcuts';
import { useShortcuts } from '../hooks/useShortcuts';
import type { Movie } from '../types';

/**
 * KÖR KALİBRASYON DÜELLO MODALI (Zevk Kalibrasyonu — Mod 2)
 *
 * pickDuelPair() ile sıradaki eşleşme seçilir; kullanıcı ← / → ile kazananı
 * seçer, ↓/Boşluk ile atlar. resolveDuel() reducer'ı Elo güncellemesini
 * (calibratedScore, duelCount/duelWins, toplam +XP: her düello +10 XP ve
 * 5'li seride +50) kendi halleder — bu bileşen yalnızca arayüzü gösterir.
 * 5 düello tamamlanınca modal kapanır ve toast yayınlanır.
 *
 * Klavye: useShortcuts "close" (ESC) eylemini taşır (modal açıkken de çalışır);
 * ok/boşluk tuşları kısayol listesinde tanımlı olmadığı için modalın kendi
 * keydown dinleyicisi bunları yakalar (metin girişi odaktayken etkisizdir).
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

/** VS kartı: poster + ad + yıl + rating + duelCount rozeti + kalibre puan. */
function DuelSide({ movie }: { movie: Movie }) {
  const calibrated =
    movie.calibratedScore ?? (typeof movie.rating === 'number' ? movie.rating : null);
  return (
    <div
      style={{ background: GLASS, borderColor: LINE }}
      className="border rounded-2xl p-2.5 sm:p-3 flex flex-col items-center gap-2 text-center min-w-0"
    >
      <div
        style={{ borderColor: LINE }}
        className="w-16 sm:w-20 aspect-[2/3] rounded-xl overflow-hidden border shrink-0"
      >
        {movie.posterUrl ? (
          <img
            loading="lazy"
            decoding="async"
            src={movie.posterUrl}
            alt={movie.title}
            onError={handleImgFallback}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            style={{ color: MUTED, background: SURFACE }}
            className="w-full h-full grid place-items-center"
          >
            <Film size={20} />
          </div>
        )}
      </div>

      <div className="min-w-0 w-full">
        <div
          style={{ color: TEXT }}
          className="text-[11px] sm:text-xs font-black leading-tight line-clamp-2"
        >
          {movie.title}
        </div>
        <div style={{ color: MUTED }} className="text-[10px] font-bold mt-0.5">
          {movie.year || '—'}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <span
          style={{ background: RED, color: ON_RED }}
          className="text-[10px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 tabular-nums"
        >
          <Star size={9} fill="currentColor" /> {movie.rating ?? '—'}
        </span>
        <span
          style={{ borderColor: LINE, color: MUTED }}
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 tabular-nums"
          title="Bu filmin girdiği düello sayısı"
        >
          <Swords size={9} /> {movie.duelCount || 0} düello
        </span>
      </div>

      <div style={{ color: MUTED }} className="text-[10px] font-bold">
        Kalibre{' '}
        <span style={{ color: TEXT }} className="font-black tabular-nums">
          {calibrated != null ? calibrated.toFixed(2) : '—'}
        </span>
      </div>
    </div>
  );
}

/** Klavye ipucu tuşu. */
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
    // Reducer: Elo + duelCount/duelWins + toplam +XP (10; 5'li seride +50).
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
      className="fixed inset-0 z-[95] flex items-center justify-center p-2.5 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: SURFACE, borderColor: LINE, color: TEXT }}
        className="relative w-full max-w-2xl border rounded-3xl sm:rounded-[2rem] overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.85)] flex flex-col max-h-[90svh] sm:max-h-[92dvh] animate-fade-in-up"
      >
        {/* ÜST BAŞLIK + 5'LİK TUR İLERLEMESİ */}
        <div
          style={{ borderColor: LINE }}
          className="relative z-10 flex items-start justify-between gap-3 px-4 pt-3.5 pb-3 sm:px-6 sm:pt-5 sm:pb-4 border-b shrink-0"
        >
          <div className="min-w-0 pr-2">
            <div
              style={{ color: RED }}
              className="inline-flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-1"
            >
              <Swords size={12} /> Kör Kalibrasyon &amp; Elo
            </div>
            <h2
              style={{ color: TEXT }}
              className="text-base sm:text-xl font-black uppercase tracking-tight truncate"
            >
              Zevk Kalibrasyonu
            </h2>
            <p style={{ color: MUTED }} className="text-[11px] sm:text-xs mt-0.5 leading-snug">
              İki filmi kör seç — Elo motoru kalibre puanlarını dengeler.
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              style={{ color: MUTED }}
              className="text-[11px] font-black tabular-nums uppercase tracking-wider"
            >
              {round} / {ROUNDS} düello
            </span>
            <div className="flex gap-1">
              {Array.from({ length: ROUNDS }, (_, i) => (
                <span
                  key={i}
                  className="h-1.5 w-5 sm:w-6 rounded-full transition-all duration-500"
                  style={{ background: i < round ? RED : LINE }}
                />
              ))}
            </div>
            <button
              onClick={onClose}
              title="Kapat"
              style={{ background: GLASS, borderColor: LINE, color: MUTED }}
              className="mt-0.5 w-9 h-9 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center transition-all hover:opacity-80"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* İÇERİK */}
        <div className="relative z-10 flex-1 overflow-y-auto p-3.5 sm:p-6 custom-scrollbar">
          {reveal ? (
            /* ---------- TUR SONU: animasyonlu ±delta ---------- */
            <div className="animate-fade-in-up space-y-3 py-1">
              <div className="text-center">
                <div
                  style={{ color: RED }}
                  className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-1.5"
                >
                  <Crown size={12} /> Tur Sonucu
                </div>
                <div
                  style={{ color: TEXT }}
                  className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight mt-1"
                >
                  ±{reveal.delta.toFixed(2)}
                </div>
                <div style={{ color: MUTED }} className="text-[11px] font-bold mt-0.5">
                  Elo güncellemesi uygulandı
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 max-w-lg mx-auto">
                {[reveal.winner, reveal.loser].map((item, idx) => {
                  const won = idx === 0;
                  return (
                    <div
                      key={`${item.id}-${won ? 'w' : 'l'}`}
                      style={{
                        background: won
                          ? `color-mix(in srgb, ${RED} 14%, transparent)`
                          : GLASS,
                        borderColor: won
                          ? `color-mix(in srgb, ${RED} 45%, transparent)`
                          : LINE,
                      }}
                      className="border rounded-2xl p-3 text-left animate-fade-in-up"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          style={{ color: won ? RED : MUTED }}
                          className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1"
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
                          className="text-sm font-black tabular-nums"
                        >
                          {won ? '+' : '−'}
                          {reveal.delta.toFixed(2)}
                        </span>
                      </div>
                      <div
                        style={{ color: TEXT }}
                        className="text-xs font-black truncate"
                        title={item.title}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{ color: MUTED }}
                        className="text-[10px] font-bold tabular-nums mt-0.5"
                      >
                        {item.oldScore.toFixed(2)} → {item.newScore.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : phase === 'setup' ? (
            /* ---------- AÇILIŞ: FİLTRE PENCERESİ ---------- */
            <div className="space-y-4 animate-fade-in-up">
              <div className="text-center">
                <div
                  style={{ color: RED }}
                  className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-1.5"
                >
                  <Swords size={12} /> Düello Filtresi
                </div>
                <p style={{ color: MUTED }} className="text-[11px] sm:text-xs mt-1 leading-relaxed max-w-md mx-auto">
                  Düellolara hangi filmlerle gireceğini seç. Eşleşmeler yalnızca aynı puanlı
                  (veya <strong>±0.5</strong> puan aralığındaki) filmler arasından yapılır.
                </p>
              </div>

              {/* RASTGELE MOD */}
              <button
                type="button"
                onClick={() => setRandomMode((v) => !v)}
                style={{
                  background: randomMode
                    ? `color-mix(in srgb, ${RED} 16%, transparent)`
                    : GLASS,
                  borderColor: randomMode
                    ? `color-mix(in srgb, ${RED} 45%, transparent)`
                    : LINE,
                  color: randomMode ? RED : MUTED,
                }}
                className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border text-left transition-all"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-black uppercase tracking-wider">
                    🎲 Rastgele Eşleşme
                  </span>
                  <span className="block text-[10.5px] font-bold opacity-75 mt-0.5">
                    Aynı puan bandındaki adaylardan rastgele ikili seç
                  </span>
                </span>
                <span
                  className="shrink-0 text-[10px] font-black px-2 py-1 rounded-lg border"
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
                  className="text-[9.5px] font-black uppercase tracking-widest mb-2"
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
                      className="px-2.5 py-1.5 rounded-lg border text-[11px] font-black transition-all"
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
                              ? `color-mix(in srgb, ${RED} 16%, transparent)`
                              : GLASS,
                            borderColor: on
                              ? `color-mix(in srgb, ${RED} 45%, transparent)`
                              : LINE,
                            color: on ? RED : MUTED,
                          }}
                          className="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all"
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
                className="w-full py-3.5 min-h-12 rounded-xl border font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
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
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 items-stretch">
                <DuelSide movie={pair.a} />
                <div className="flex flex-col items-center justify-center gap-1.5 px-0.5">
                  <div
                    style={{ background: RED, color: ON_RED }}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-black text-sm sm:text-base shadow-lg"
                  >
                    VS
                  </div>
                  <span
                    style={{ color: MUTED }}
                    className="text-[8.5px] sm:text-[9px] font-black uppercase tracking-widest text-center leading-tight max-w-[70px]"
                  >
                    {pair.mode === 'target' ? 'Anlık Eşleşme' : 'En Yakın Eşleşme'}
                  </span>
                </div>
                <DuelSide movie={pair.b} />
              </div>

              {/* PUAN KARŞILAŞTIRMA ÇUBUĞU */}
              <div>
                <div
                  style={{ color: MUTED }}
                  className="flex items-center justify-between text-[9.5px] font-black uppercase tracking-widest mb-1.5"
                >
                  <span className="tabular-nums">Puan {aRating || '—'}</span>
                  <span>Karşılaştırma</span>
                  <span className="tabular-nums">{bRating || '—'} Puan</span>
                </div>
                <div
                  style={{ background: LINE }}
                  className="h-2.5 w-full rounded-full overflow-hidden flex"
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
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => pickWinner('a')}
                  disabled={Boolean(reveal)}
                  style={{ background: RED, color: ON_RED, borderColor: RED }}
                  className="py-3 min-h-11 rounded-xl border font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
                  title="Kazanan: Sol film (←)"
                >
                  <ArrowLeft size={15} /> Sol Kazandı
                </button>
                <button
                  type="button"
                  onClick={skipPair}
                  disabled={Boolean(reveal)}
                  style={{ background: GLASS, borderColor: LINE, color: MUTED }}
                  className="py-3 min-h-11 rounded-xl border font-bold text-[11px] flex flex-col items-center justify-center gap-0.5 transition-all hover:opacity-80 active:scale-[0.98] disabled:opacity-50"
                  title="Bu eşleşmeyi atla (↓ veya Boşluk)"
                >
                  <span className="flex items-center gap-1">
                    <SkipForward size={12} /> Atla
                  </span>
                  <span className="text-[9px] tracking-wider">↓ / Boşluk</span>
                </button>
                <button
                  type="button"
                  onClick={() => pickWinner('b')}
                  disabled={Boolean(reveal)}
                  style={{ background: RED, color: ON_RED, borderColor: RED }}
                  className="py-3 min-h-11 rounded-xl border font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
                  title="Kazanan: Sağ film (→)"
                >
                  Sağ Kazandı <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            /* ---------- BOŞ DURUM ---------- */
            <div className="text-center py-10 px-4">
              <Gauge
                size={36}
                style={{ color: MUTED }}
                className="mx-auto mb-3"
              />
              <p
                style={{ color: TEXT }}
                className="text-sm font-black uppercase tracking-widest"
              >
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

        {/* ALT: KLAVYE İPUÇLARI */}
        <div
          style={{ borderColor: LINE, background: SURFACE }}
          className="relative z-10 px-4 py-3 sm:px-6 border-t flex items-center justify-between gap-3 shrink-0"
        >
          <div
            style={{ color: MUTED }}
            className="flex items-center gap-2 sm:gap-3 flex-wrap text-[9.5px] font-black uppercase tracking-widest"
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
