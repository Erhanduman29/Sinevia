import { CloudDownload, GitCompareArrows, HardDrive, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import type { CloudConflictInfo, DataSummary } from '../context/AppContext';
import { SHORTCUT_CLOSE_EVENT } from '../lib/shortcuts';

interface Props {
  conflict: CloudConflictInfo;
  onUseCloud: () => void;
  onUseLocal: () => void;
  onDefer: () => void;
}

const PREMIUM_LINE = 'var(--line-2, var(--border-dim, rgba(244, 244, 242, .13)))';
const PREMIUM_LINE_SOFT = 'var(--line, var(--border-dim, rgba(244, 244, 242, .07)))';
const PREMIUM_RADIUS_SM = 'var(--r-sm, 10px)';
const PREMIUM_RED_GRAD =
  'linear-gradient(150deg, var(--red-hi, var(--color-2, #ff6b7a)) 0%, var(--red, var(--color-1, #e8384f)) 45%, var(--red-deep, var(--color-3, #8e1220)) 130%)';
const PREMIUM_RED_GLOW =
  '0 10px 28px -10px rgba(232, 56, 79, .75), inset 0 1px 0 rgba(255, 255, 255, .35), inset 0 -2px 6px rgba(0, 0, 0, .25)';

const OVERLAY: React.CSSProperties = {
  background: 'radial-gradient(1000px 600px at 50% 30%, rgba(232, 56, 79, .14), transparent 65%), rgba(4, 4, 6, .78)',
  backdropFilter: 'blur(16px) saturate(130%)',
};

const MODAL: React.CSSProperties = {
  background: 'linear-gradient(165deg, #17171C 0%, #0E0E12 60%, #0B0B0E 100%)',
  border: '1px solid rgba(255, 255, 255, .12)',
  borderRadius: 'var(--r-lg, 22px)',
  boxShadow:
    '0 50px 110px -30px rgba(0, 0, 0, .95), 0 0 0 1px rgba(0, 0, 0, .5), 0 0 100px -40px rgba(232, 56, 79, .55), inset 0 1px 0 rgba(255, 255, 255, .1)',
};

const BTN_PRIMARY: React.CSSProperties = {
  background: PREMIUM_RED_GRAD,
  borderRadius: PREMIUM_RADIUS_SM,
  color: '#fff',
  boxShadow: PREMIUM_RED_GLOW,
};

const BTN_SECONDARY: React.CSSProperties = {
  background: 'linear-gradient(150deg, rgba(255, 255, 255, .14), rgba(255, 255, 255, .05))',
  border: `1px solid ${PREMIUM_LINE}`,
  borderRadius: PREMIUM_RADIUS_SM,
  boxShadow: '0 8px 22px -12px rgba(0, 0, 0, .9), inset 0 1px 0 rgba(255, 255, 255, .16)',
  color: 'var(--text-main, #f4f4f2)',
};

const CARD: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255, 255, 255, .055), rgba(255, 255, 255, .018))',
  border: `1px solid ${PREMIUM_LINE_SOFT}`,
  borderRadius: 'var(--r, 16px)',
};

const ROWS: Array<{ key: keyof Pick<DataSummary, 'movies' | 'series' | 'episodes' | 'history' | 'achievements' | 'totalXp' | 'level'>; label: string; suffix?: string }> = [
  { key: 'movies', label: 'Film' },
  { key: 'series', label: 'Dizi' },
  { key: 'episodes', label: 'Bölüm' },
  { key: 'history', label: 'Geçmiş' },
  { key: 'achievements', label: 'Başarım' },
  { key: 'totalXp', label: 'Toplam XP' },
  { key: 'level', label: 'Seviye' },
];

function SummaryCard({ title, icon, summary, accent }: { title: string; icon: React.ReactNode; summary: DataSummary; accent: string }) {
  return (
    <div className="flex-1 min-w-0 p-3.5" style={CARD}>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}35` }}>
          {icon}
        </span>
        <span className="text-[11px] font-extrabold uppercase tracking-widest truncate" style={{ color: accent }}>{title}</span>
      </div>
      <div className="space-y-1.5">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-2 text-[11px]">
            <span style={{ color: 'var(--muted, #9a9a96)' }}>{row.label}</span>
            <span className="font-bold tabular-nums" style={{ color: 'var(--text-main, #f4f4f2)' }}>
              {Number(summary[row.key] || 0).toLocaleString('tr-TR')}{row.suffix || ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CloudConflictDialog({ conflict, onUseCloud, onUseLocal, onDefer }: Props) {
  useEffect(() => {
    const handleCloseRequest = () => onDefer();
    window.addEventListener(SHORTCUT_CLOSE_EVENT, handleCloseRequest);
    return () => window.removeEventListener(SHORTCUT_CLOSE_EVENT, handleCloseRequest);
  }, [onDefer]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-fade-in" onClick={onDefer} style={OVERLAY}>
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto animate-uvPop"
        onClick={(event) => event.stopPropagation()}
        style={MODAL}
      >
        <div
          className="flex items-center justify-between gap-4 p-4"
          style={{
            background: 'linear-gradient(120deg, rgba(232, 56, 79, .2), rgba(232, 56, 79, .03) 70%)',
            borderBottom: `1px solid ${PREMIUM_LINE_SOFT}`,
            borderRadius: 'var(--r-lg, 22px) var(--r-lg, 22px) 0 0',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <GitCompareArrows size={17} style={{ color: 'var(--red-hi, #ff6b7a)', flexShrink: 0 }} />
            <span className="text-xs font-extrabold uppercase tracking-widest truncate" style={{ color: 'var(--red-hi, #ff6b7a)' }}>
              Hesap Eşitleme Çakışması
            </span>
          </div>
          <button
            onClick={onDefer}
            aria-label="Kapat ve sonra karar ver"
            className="w-9 h-9 rounded-[var(--r-sm,10px)] font-extrabold text-lg leading-none transition-all duration-250 flex-shrink-0"
            style={{ background: 'rgba(255, 255, 255, .08)', border: `1px solid ${PREMIUM_LINE_SOFT}`, color: 'var(--muted, #9a9a96)' }}
          >
            ×
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <h2 className="text-lg sm:text-xl font-extrabold text-white mb-2 flex items-center gap-2">
            <ShieldCheck size={20} style={{ color: 'var(--red-hi, #ff6b7a)' }} />
            Hangi hesap verisi kullanılsın?
          </h2>
          <p className="text-[13px] text-ink-400 mb-4 leading-relaxed">
            Aynı hesap (<span className="font-bold text-white">{conflict.agentId}</span> — {conflict.nickname}) için bu cihazda ve bulutta farklı veriler var.
            Sen seçim yapana kadar <span className="font-bold text-white">hiçbir veri silinmez</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
            <SummaryCard title="Bu Cihaz" icon={<HardDrive size={15} />} summary={conflict.local} accent="#8fb8ff" />
            <SummaryCard title="Bulut" icon={<CloudDownload size={15} />} summary={conflict.cloud} accent="#ffb86b" />
          </div>

          <div className="rounded-lg px-3 py-2.5 mb-5 text-[11px] leading-relaxed" style={{ background: 'rgba(232, 56, 79, .07)', border: '1px solid rgba(232, 56, 79, .18)', color: 'var(--muted, #9a9a96)' }}>
            <span className="font-bold" style={{ color: 'var(--red-hi, #ff6b7a)' }}>Güvenli seçim:</span> Kapatma (×), dışarı tıklama veya ESC karar vermeden erteler; hiçbir veri değişmez. Eşitleme, sayfayı yenilediğinde tekrar sorulur.
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <button
              onClick={onDefer}
              className="text-[11px] font-bold uppercase tracking-wider px-2 py-2.5 transition-opacity hover:opacity-100"
              style={{ color: 'var(--muted, #9a9a96)' }}
            >
              Sonra Karar Ver
            </button>
            <div className="flex flex-col-reverse sm:flex-row gap-2.5">
              <button
                onClick={onUseLocal}
                className="inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wider px-4 py-3 text-xs transition-all duration-300 hover:-translate-y-0.5 active:translate-y-px"
                style={BTN_SECONDARY}
              >
                <HardDrive size={14} /> Bu Cihazı Kullan
              </button>
              <button
                onClick={onUseCloud}
                className="inline-flex items-center justify-center gap-2 font-extrabold uppercase tracking-wider px-4 py-3 text-xs transition-all duration-300 hover:-translate-y-0.5 active:translate-y-px"
                style={BTN_PRIMARY}
              >
                <CloudDownload size={14} /> Bulutu Kullan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
