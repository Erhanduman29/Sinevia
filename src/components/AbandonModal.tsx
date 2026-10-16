import { useState } from 'react';
import { Skull, Scissors, X, Check, Activity, Stethoscope, FileText } from 'lucide-react';
import type { AbandonedProgress } from '../types';

/**
 * SİNEMATİK OTOPSİ (DNF) MODALI
 * Yarım bırakma akışının onay ekranı: ilerleme (opsiyonel), ölüm nedenleri
 * (çoklu çip) ve serbest not toplanır. onSubmit → abandonMedia reducer'ı
 * (bildirim toast'ı kontextte otomatik tetiklenir).
 *
 * Renkler sabit DEĞİL — var() fallback zincirleri (tema motoru uyumlu).
 */

export interface AbandonSubmitPayload {
  /** Verilmezse filmde reducer aktif sayaçtan otomatik hesaplar. */
  progress?: AbandonedProgress;
  reasons: string[];
  note: string;
}

interface AbandonModalProps {
  open: boolean;
  media: 'movie' | 'series';
  title: string;
  /** Film süresi (dk) — dakika input'unun üst sınırı. */
  runtime?: number;
  /** Dizi: sezon sayısı (sezon input üst sınırı). */
  seasonCount?: number;
  /** Dizi: bölüm sayısı (bölüm input üst sınırı). */
  episodes?: number;
  defaultSeason?: number;
  defaultEpisode?: number;
  onClose: () => void;
  onSubmit: (payload: AbandonSubmitPayload) => void;
}

const DEATH_REASONS = [
  'Sıkıcıydı',
  'Yavaş ilerliyordu',
  'Kötü senaryo',
  'Beklentimi karşılamadı',
  'Vaktim yok',
  'Odaklanamadım',
];

/* Ortak tema zincirleri — sabit renk yok. */
const RED = 'var(--red, var(--color-1, #e8384f))';
const SURFACE = 'var(--bg-surface, #10121a)';
const TEXT = 'var(--text-main, #f4f4f2)';
const MUTED = 'var(--muted, #9aa0ab)';
const LINE = 'var(--line, rgba(244, 244, 242, 0.14))';
const ON_RED = 'var(--on-color-1, #0a0a0e)';

export default function AbandonModal({
  open,
  media,
  title,
  runtime,
  seasonCount,
  episodes,
  defaultSeason,
  defaultEpisode,
  onClose,
  onSubmit,
}: AbandonModalProps) {
  const [minutes, setMinutes] = useState('');
  const [season, setSeason] = useState(
    defaultSeason && defaultSeason >= 1 ? String(Math.floor(defaultSeason)) : '1'
  );
  const [episode, setEpisode] = useState(
    defaultEpisode && defaultEpisode >= 1 ? String(Math.floor(defaultEpisode)) : ''
  );
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState('');

  if (!open) return null;

  const toggleReason = (r: string) =>
    setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const seasonValid = media === 'movie' || (/^\d+$/.test(season.trim()) && Number(season) >= 1);
  const canSubmit = seasonValid;

  const handleSubmit = () => {
    if (!canSubmit) return;

    let progress: AbandonedProgress | undefined;

    if (media === 'movie') {
      const raw = minutes.trim().replace(',', '.');
      if (raw !== '') {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 0) {
          const value = Math.round(parsed);
          progress = {
            unit: 'minute',
            value: runtime && runtime > 0 ? Math.min(value, runtime) : value,
          };
        }
      }
      // Boş bırakıldıysa progress undefined → reducer aktif sayaçtan otomatik hesaplar.
    } else {
      const seasonNum = Math.max(1, Math.floor(Number(season)));
      const rawEp = episode.trim();
      const epNum = /^\d+$/.test(rawEp) ? Math.max(1, Math.floor(Number(rawEp))) : 1;
      progress = { unit: 'episode', value: epNum, season: seasonNum };
    }

    onSubmit({
      progress,
      reasons,
      note: note.trim(),
    });
  };

  const isMovie = media === 'movie';
  const maxMinutes = runtime && runtime > 0 ? runtime : undefined;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-2.5 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: SURFACE, borderColor: LINE, color: TEXT }}
        className="relative w-full max-w-xl border rounded-3xl sm:rounded-[2rem] overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.85)] flex flex-col max-h-[90svh] sm:max-h-[92dvh] animate-fade-in-up"
      >
        {/* ÜST BAŞLIK BARI */}
        <div
          style={{ borderColor: LINE }}
          className="relative z-10 flex items-center justify-between px-4 pt-3.5 pb-3 sm:px-6 sm:pt-5 sm:pb-4 border-b shrink-0"
        >
          <div className="min-w-0 pr-3">
            <div
              style={{ color: RED }}
              className="inline-flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-1"
            >
              <Stethoscope size={12} /> Sinematik Otopsi (DNF)
            </div>
            <h2
              style={{ color: TEXT }}
              className="text-base sm:text-xl font-black uppercase tracking-tight truncate"
            >
              {title}
            </h2>
            <p style={{ color: MUTED }} className="text-[11px] sm:text-xs mt-0.5 truncate">
              {isMovie
                ? 'Yarım bırakılan film operasyonu'
                : 'Yarım bırakılan dizi operasyonu'}
            </p>
          </div>
          <button
            onClick={onClose}
            title="Kapat"
            style={{ background: 'var(--glass, rgba(255, 255, 255, 0.05))', borderColor: LINE, color: MUTED }}
            className="w-11 h-11 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center transition-all flex-shrink-0 hover:opacity-80"
          >
            <X size={17} />
          </button>
        </div>

        {/* İÇERİK */}
        <div className="relative z-10 flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-5 custom-scrollbar">
          {/* İLERLEME */}
          {isMovie ? (
            <div style={{ background: 'var(--glass, rgba(255, 255, 255, 0.04))', borderColor: LINE }} className="border rounded-2xl p-3.5 sm:p-4">
              <label
                htmlFor="abandon-minutes"
                style={{ color: TEXT }}
                className="text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 mb-2"
              >
                <Activity size={13} style={{ color: RED }} /> Kaç dakika izledin?
              </label>
              <input
                id="abandon-minutes"
                type="number"
                inputMode="numeric"
                min={0}
                max={maxMinutes}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder={maxMinutes ? `0 - ${maxMinutes}` : 'Örn: 45'}
                style={{ background: SURFACE, borderColor: LINE, color: TEXT }}
                className="w-full border rounded-xl px-3 py-3 text-sm font-black tabular-nums text-center focus:outline-none transition-colors placeholder:opacity-50"
              />
              <p style={{ color: MUTED }} className="text-[10px] sm:text-[11px] mt-2 leading-snug">
                Boş bırakırsan aktif sayaç otomatik hesaplar
                {maxMinutes ? ` (üst sınır: ${maxMinutes} dk)` : ''}.
              </p>
            </div>
          ) : (
            <div style={{ background: 'var(--glass, rgba(255, 255, 255, 0.04))', borderColor: LINE }} className="border rounded-2xl p-3.5 sm:p-4">
              <span
                style={{ color: TEXT }}
                className="text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 mb-2"
              >
                <Activity size={13} style={{ color: RED }} /> Nerede bırakın?
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="abandon-season" style={{ color: MUTED }} className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-center">
                    Sezon *
                  </label>
                  <input
                    id="abandon-season"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={seasonCount && seasonCount > 0 ? seasonCount : undefined}
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    style={{ background: SURFACE, borderColor: seasonValid ? LINE : RED, color: TEXT }}
                    className="w-full border rounded-xl px-3 py-3 text-sm font-black tabular-nums text-center focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="abandon-episode" style={{ color: MUTED }} className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-center">
                    Bölüm
                  </label>
                  <input
                    id="abandon-episode"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={episodes && episodes > 0 ? episodes : undefined}
                    value={episode}
                    onChange={(e) => setEpisode(e.target.value)}
                    placeholder="1"
                    style={{ background: SURFACE, borderColor: LINE, color: TEXT }}
                    className="w-full border rounded-xl px-3 py-3 text-sm font-black tabular-nums text-center focus:outline-none transition-colors placeholder:opacity-50"
                  />
                </div>
              </div>
              <p style={{ color: MUTED }} className="text-[10px] sm:text-[11px] mt-2 leading-snug">
                Sezon zorunlu; bölüm boş bırakılırsa 1 kabul edilir.
              </p>
            </div>
          )}

          {/* ÖLÜM NEDENİ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span style={{ color: TEXT }} className="text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Skull size={13} style={{ color: RED }} /> Ölüm Nedeni
              </span>
              {reasons.length > 0 && (
                <span
                  style={{ color: RED, background: 'var(--blob-1, rgba(232, 56, 79, 0.14))', borderColor: RED }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                >
                  {reasons.length} seçildi
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {DEATH_REASONS.map((r) => {
                const on = reasons.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleReason(r)}
                    style={
                      on
                        ? { background: RED, color: ON_RED, borderColor: RED }
                        : { background: 'transparent', color: TEXT, borderColor: LINE }
                    }
                    className={`inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold px-3 py-2 min-h-9 rounded-xl border transition-all ${
                      on ? 'shadow-md' : 'hover:opacity-80'
                    }`}
                  >
                    {on && <Check size={11} strokeWidth={3} />}
                    <span>{r}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SERBEST NOT */}
          <div className="space-y-1.5 pt-1">
            <label
              htmlFor="abandon-note"
              style={{ color: TEXT }}
              className="text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
            >
              <FileText size={13} style={{ color: RED }} /> Otopsi Notu
            </label>
            <textarea
              id="abandon-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Serbest not — istediğin kadar yaz (isteğe bağlı)..."
              style={{ background: SURFACE, borderColor: LINE, color: TEXT }}
              className="w-full border rounded-2xl p-3 text-xs sm:text-sm focus:outline-none transition-colors resize-none placeholder:opacity-50"
            />
          </div>
        </div>

        {/* ALT AKSİYONLAR */}
        <div
          style={{ borderColor: LINE }}
          className="relative z-10 p-3.5 sm:p-5 border-t flex items-center gap-2.5 shrink-0"
        >
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'var(--glass, rgba(255, 255, 255, 0.05))', borderColor: LINE, color: TEXT }}
            className="flex-1 sm:flex-none px-4 py-3 min-h-11 rounded-xl font-black text-xs sm:text-sm border transition-colors flex items-center justify-center gap-1.5 hover:opacity-80"
          >
            <Scissors size={15} /> Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{ background: RED, color: ON_RED, borderColor: RED }}
            className={`flex-[2] sm:flex-1 py-3 px-4 min-h-11 rounded-xl font-black text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-1.5 ${
              canSubmit ? 'hover:opacity-90 active:scale-[0.99]' : 'opacity-40 pointer-events-none'
            }`}
            title="Operasyonu iptal et — bu yapımda yarım bırakılan kaydı işlenir"
          >
            <Skull size={16} strokeWidth={2.5} />
            <span>Operasyonu İptal Et</span>
          </button>
        </div>
      </div>
    </div>
  );
}
