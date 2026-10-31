import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  CloudDownload,
  GitCompareArrows,
  HardDrive,
  Layers,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { ConflictChoice, SyncConflict, SyncConflictReason, SyncSnapshotSummary } from '../types/sync';

/* =========================================================================
   BULUT ÇAKIŞMA MODALI — SADECE SUNUM
   -------------------------------------------------------------------------
   Karar matrisi ve seçeneklerin etkisi `docs/sync-contract.md` §3'tedir.
   Bu bileşen İŞ MANTIĞI İÇERMEZ: seçimi `onChoose(choice)` ile yukarı iletir.

   KURAL: "Birleştir" varsayılan/önerilen DEĞİLDİR. Tıklanınca açıklayıcı
   uyarı + ikinci, açık onay adımı ister; tek tıkla birleştirme yapılmaz.
   ========================================================================= */

export interface CloudConflictModalProps {
  conflict: SyncConflict;
  busy?: boolean;
  onChoose: (choice: ConflictChoice) => void;
}

const REASON_TEXT: Record<SyncConflictReason, string> = {
  'both-changed': 'Bu cihazda ve bulutta birbirinden bağımsız değişiklikler yapılmış.',
  'owner-mismatch': 'Bulut kaydı başka bir hesaba ait görünüyor.',
  'revision-mismatch': 'Bulut kaydı, beklenenden daha yeni bir revizyonda.',
};

const PREMIUM_LINE = 'var(--line-2, var(--border-dim, rgba(244, 244, 242, .13)))';
const PREMIUM_LINE_SOFT = 'var(--line, var(--border-dim, rgba(244, 244, 242, .07)))';
const PREMIUM_RED_GRAD =
  'linear-gradient(150deg, var(--red-hi, var(--color-2, #ff6b7a)) 0%, var(--red, var(--color-1, #e8384f)) 45%, var(--red-deep, var(--color-3, #8e1220)) 130%)';

const OVERLAY: React.CSSProperties = {
  background:
    'radial-gradient(1000px 600px at 50% 30%, rgba(232, 56, 79, .14), transparent 65%), rgba(4, 4, 6, .82)',
  backdropFilter: 'blur(16px) saturate(130%)',
};

const MODAL: React.CSSProperties = {
  background: 'linear-gradient(165deg, #17171C 0%, #0E0E12 60%, #0B0B0E 100%)',
  border: '1px solid rgba(255, 255, 255, .12)',
  borderRadius: 'var(--r-lg, 22px)',
  boxShadow:
    '0 50px 110px -30px rgba(0, 0, 0, .95), 0 0 0 1px rgba(0, 0, 0, .5), 0 0 100px -40px rgba(232, 56, 79, .55), inset 0 1px 0 rgba(255, 255, 255, .1)',
};

const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed';

const BTN_SECONDARY: React.CSSProperties = {
  background: 'linear-gradient(150deg, rgba(255, 255, 255, .14), rgba(255, 255, 255, .05))',
  border: `1px solid ${PREMIUM_LINE}`,
  borderRadius: 'var(--r-sm, 10px)',
  boxShadow: '0 8px 22px -12px rgba(0, 0, 0, .9), inset 0 1px 0 rgba(255, 255, 255, .16)',
  color: 'var(--text-main, #f4f4f2)',
};

const BTN_GHOST: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 'var(--r-sm, 10px)',
  color: 'var(--muted, #9a9a96)',
};

/** ISO → tr-TR kısa tarih; boş/geçersizse "Bilinmiyor". */
export function formatConflictDate(iso: string | undefined): string {
  if (!iso) return 'Bilinmiyor';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Bilinmiyor';
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return 'Bilinmiyor';
  }
}

/** Cihaz/bulut arasında farklı olan satırları işaretler (görsel vurgu için). */
export function conflictingSummaryKeys(
  local: SyncSnapshotSummary | undefined,
  cloud: SyncSnapshotSummary | undefined
): Set<keyof SyncSnapshotSummary> {
  const keys: (keyof SyncSnapshotSummary)[] = [
    'totalXp',
    'level',
    'movies',
    'series',
    'achievements',
    'quests',
    'updatedAt',
  ];
  const out = new Set<keyof SyncSnapshotSummary>();
  for (const key of keys) {
    if ((local?.[key] ?? '') !== (cloud?.[key] ?? '')) out.add(key);
  }
  return out;
}

interface SummaryRow {
  key: keyof SyncSnapshotSummary;
  label: string;
  format: (summary: SyncSnapshotSummary) => string;
}

const SUMMARY_ROWS: SummaryRow[] = [
  { key: 'totalXp', label: 'XP', format: (s) => `${Number(s.totalXp || 0).toLocaleString('tr-TR')} XP` },
  { key: 'level', label: 'Seviye', format: (s) => String(Number(s.level || 0)) },
  { key: 'movies', label: 'Film', format: (s) => Number(s.movies || 0).toLocaleString('tr-TR') },
  { key: 'series', label: 'Dizi', format: (s) => Number(s.series || 0).toLocaleString('tr-TR') },
  { key: 'achievements', label: 'Başarım', format: (s) => Number(s.achievements || 0).toLocaleString('tr-TR') },
  { key: 'quests', label: 'Görev', format: (s) => Number(s.quests || 0).toLocaleString('tr-TR') },
  { key: 'updatedAt', label: 'Son güncelleme', format: (s) => formatConflictDate(s.updatedAt) },
];

export default function CloudConflictModal({ conflict, busy = false, onChoose }: CloudConflictModalProps) {
  const [confirmMerge, setConfirmMerge] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  // Escape karar vermeden erteler (veri değişmez).
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || busy) return;
      event.stopPropagation();
      onChoose('later');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [busy, onChoose]);

  useEffect(() => {
    if (confirmMerge) confirmRef.current?.focus();
  }, [confirmMerge]);

  const differing = conflictingSummaryKeys(conflict.local, conflict.cloud);

  const choose = (choice: ConflictChoice) => {
    if (busy) return;
    onChoose(choice);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      style={OVERLAY}
      onClick={() => choose('later')}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy}
        className="w-full max-w-2xl max-h-[92svh] overflow-y-auto custom-scrollbar animate-uvPop"
        style={MODAL}
        onClick={(event) => event.stopPropagation()}
      >
        {/* BAŞLIK */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{
            background: 'linear-gradient(120deg, rgba(232, 56, 79, .2), rgba(232, 56, 79, .03) 70%)',
            borderBottom: `1px solid ${PREMIUM_LINE_SOFT}`,
            borderRadius: 'var(--r-lg, 22px) var(--r-lg, 22px) 0 0',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <GitCompareArrows size={17} style={{ color: 'var(--red-hi, #ff6b7a)', flexShrink: 0 }} />
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-widest truncate" style={{ color: 'var(--red-hi, #ff6b7a)' }}>
              Cihaz &amp; Bulut Çakışması
            </span>
          </div>
          <button
            type="button"
            onClick={() => choose('later')}
            disabled={busy}
            aria-label="Kapat ve sonra karar ver"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-[var(--r-sm,10px)] grid place-items-center transition-colors disabled:opacity-45"
            style={{ background: 'rgba(255, 255, 255, .08)', border: `1px solid ${PREMIUM_LINE_SOFT}`, color: 'var(--muted, #9a9a96)' }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <h2 id={titleId} className="text-base sm:text-xl font-extrabold text-white flex items-center gap-2">
              <ShieldCheck size={19} className="shrink-0" style={{ color: 'var(--red-hi, #ff6b7a)' }} />
              Hangi veri kullanılsın?
            </h2>
            <p id={descriptionId} className="text-[11px] sm:text-[13px] text-ink-400 mt-1.5 leading-relaxed">
              {REASON_TEXT[conflict.reason] ?? 'Cihaz ve bulut kayıtları farklı.'} Sen karar verene kadar{' '}
              <span className="font-bold text-white">hiçbir veri silinmez</span>. Cihaz revizyonu{' '}
              <span className="font-mono text-ink-200">{conflict.localRevision}</span>, bulut revizyonu{' '}
              <span className="font-mono text-ink-200">{conflict.cloudRevision}</span>.
            </p>
          </div>

          {/* YAN YANA ÖZET */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <SummaryCard
              title="Bu Cihaz"
              icon={<HardDrive size={15} />}
              summary={conflict.local}
              accent="#8fb8ff"
              differing={differing}
            />
            <SummaryCard
              title="Bulut"
              icon={<CloudDownload size={15} />}
              summary={conflict.cloud}
              accent="#ffb86b"
              differing={differing}
            />
          </div>

          {/* BİRLEŞTİR: AÇIK ONAY ADIMI */}
          {confirmMerge ? (
            <div
              role="alertdialog"
              aria-label="Birleştirmeyi onayla"
              aria-describedby={`${titleId}-merge`}
              className="rounded-xl p-3 sm:p-3.5 space-y-3"
              style={{ background: 'rgba(255, 200, 0, .06)', border: '1px solid rgba(255, 200, 0, .3)' }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: '#FFC800' }} />
                <p id={`${titleId}-merge`} className="text-[11px] sm:text-xs leading-relaxed" style={{ color: 'var(--muted, #9a9a96)' }}>
                  <span className="font-bold" style={{ color: '#FFE047' }}>Birleştirme geri alınamaz ve yeni bir revizyon oluşturur.</span>{' '}
                  Kütüphane kayıtları birleştirilir; XP defteri <span className="font-mono text-ink-200">(source, sourceId)</span>{' '}
                  çiftine göre tekilleştirilir. Aynı anahtar iki tarafta farklı tutardaysa bulut kopyası kazanır ve aradaki
                  fark bir <span className="font-mono text-ink-200">adjustment</span> kaydıyla kapatılır. Bu işlem
                  önerilen seçenek değildir; yalnızca iki tarafı da korumak istiyorsan kullan.
                </p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmMerge(false)}
                  disabled={busy}
                  aria-label="Birleştirmeyi iptal et"
                  className={BTN_BASE}
                  style={BTN_SECONDARY}
                >
                  Vazgeç
                </button>
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={() => choose('merge')}
                  disabled={busy}
                  aria-label="Birleştirmeyi onayla ve uygula"
                  className={BTN_BASE}
                  style={{
                    background: 'linear-gradient(150deg, #FFD026 0%, #EAB308 60%, #A16207 130%)',
                    border: '1px solid rgba(255, 224, 71, .55)',
                    borderRadius: 'var(--r-sm, 10px)',
                    color: '#09090D',
                  }}
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Layers size={13} />}
                  Onaylıyorum, Birleştir
                </button>
              </div>
            </div>
          ) : (
            <div
              className="rounded-lg px-3 py-2.5 text-[10.5px] sm:text-[11px] leading-relaxed"
              style={{ background: 'rgba(232, 56, 79, .07)', border: '1px solid rgba(232, 56, 79, .18)', color: 'var(--muted, #9a9a96)' }}
            >
              <span className="font-bold" style={{ color: 'var(--red-hi, #ff6b7a)' }}>Güvenli seçim:</span> Kapatma (×),
              dışarı tıklama veya ESC karar vermeden erteler; hiçbir veri değişmez.
            </div>
          )}

          {/* BUTONLAR */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => choose('cloud')}
                disabled={busy}
                aria-label="Bulut kaydını kullan"
                className={BTN_BASE}
                style={BTN_SECONDARY}
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <CloudDownload size={13} />} Bulutu Kullan
              </button>
              <button
                type="button"
                onClick={() => choose('local')}
                disabled={busy}
                aria-label="Bu cihazdaki kaydı kullan"
                className={BTN_BASE}
                style={BTN_SECONDARY}
              >
                <HardDrive size={13} /> Bu Cihazı Kullan
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmMerge(true)}
                disabled={busy || confirmMerge}
                aria-label="Birleştirme seçeneğini incele (onay gerektirir)"
                className={BTN_BASE}
                style={{
                  background: 'rgba(255, 200, 0, .1)',
                  border: '1px solid rgba(255, 200, 0, .34)',
                  borderRadius: 'var(--r-sm, 10px)',
                  color: '#FFE047',
                }}
              >
                <Layers size={13} /> Birleştir
              </button>
              <button
                type="button"
                onClick={() => choose('later')}
                disabled={busy}
                aria-label="Şimdi karar verme, sonra devam et"
                className={BTN_BASE}
                style={BTN_GHOST}
              >
                Sonra
              </button>
            </div>
            <p className="text-center text-[9.5px] font-mono" style={{ color: 'var(--text-dim, #52525b)' }}>
              {busy ? 'Seçim uygulanıyor...' : 'Hiçbir seçenek otomatik uygulanmaz; kararı sen verirsin.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  icon,
  summary,
  accent,
  differing,
}: {
  title: string;
  icon: React.ReactNode;
  summary: SyncSnapshotSummary;
  accent: string;
  differing: Set<keyof SyncSnapshotSummary>;
}) {
  return (
    <div
      className="flex-1 min-w-0 p-3 sm:p-3.5"
      style={{
        background: 'linear-gradient(160deg, rgba(255, 255, 255, .055), rgba(255, 255, 255, .018))',
        border: `1px solid ${PREMIUM_LINE_SOFT}`,
        borderRadius: 'var(--r, 16px)',
      }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className="w-7 h-7 rounded-lg grid place-items-center shrink-0"
          style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}35` }}
        >
          {icon}
        </span>
        <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest truncate" style={{ color: accent }}>
          {title}
        </span>
      </div>
      <dl className="space-y-1.5">
        {SUMMARY_ROWS.map((row) => {
          const isDifferent = differing.has(row.key);
          return (
            <div key={row.key} className="flex items-baseline justify-between gap-2 text-[11px] sm:text-xs">
              <dt style={{ color: 'var(--muted, #9a9a96)' }}>
                {row.label}
                {isDifferent && (
                  <span
                    className="ml-1 inline-block w-1.5 h-1.5 rounded-full align-middle"
                    style={{ background: accent }}
                    title="Diğer taraftan farklı"
                    aria-label="Diğer taraftan farklı"
                  />
                )}
              </dt>
              <dd className="font-bold tabular-nums text-right truncate" style={{ color: 'var(--text-main, #f4f4f2)' }}>
                {row.format(summary)}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
