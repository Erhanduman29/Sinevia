import { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Info,
  Monitor,
  Share,
  Smartphone,
  TriangleAlert,
} from 'lucide-react';
import { promptInstall } from '../lib/installPrompt';
import { useInstallSignal } from '../hooks/useInstallSignal';

const ROW_STYLE: React.CSSProperties = {
  background: 'var(--glass, var(--bg-surface, rgba(255, 255, 255, .03)))',
  border: '1px solid var(--line, var(--border-dim, rgba(244, 244, 242, .07)))',
  borderRadius: 'var(--r, 16px)',
};

const STEP_CLS =
  'flex items-start gap-3 p-2.5 rounded-[var(--r-sm,10px)] bg-white/[.03] border border-white/[.07]';

function StepNumber({ n }: { n: number }) {
  return (
    <span
      className="flex-shrink-0 w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center text-white"
      style={{
        background:
          'linear-gradient(140deg, var(--red-hi, var(--color-2, #ff6b7a)), var(--red, var(--color-1, #e8384f)))',
        boxShadow: '0 4px 12px -4px rgba(232, 56, 79, .7)',
      }}
    >
      {n}
    </span>
  );
}

function CopyLinkButton({ label = 'Bağlantıyı Kopyala' }: { label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      onClick={copy}
      className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider rounded-[var(--r-sm,10px)] border transition-colors hover:bg-white/[.07]"
      style={{ background: 'rgba(255,255,255,.05)', borderColor: 'var(--line-2, rgba(244,244,242,.13))', color: 'var(--text-main, #f4f4f2)' }}
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
      {copied ? 'Kopyalandı' : label}
    </button>
  );
}

/**
 * Ayarlar → "Uygulamayı Yükle" bölümünün içeriği.
 * Platforma göre (iOS / Android / masaüstü) doğru yönergeyi gösterir;
 * Chromium tabanlı tarayıcılarda gerçek kurulum penceresini açabilir.
 */
export default function InstallAppCard() {
  const signal = useInstallSignal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startInstall = async () => {
    setBusy(true);
    setError(null);
    const result = await promptInstall();
    setBusy(false);
    if (!result.ok) {
      if (result.reason === 'unavailable') {
        setError('Tarayıcı kurulum penceresini henüz hazırlamadı. Sayfayı yenileyip birkaç saniye sonra tekrar deneyin.');
      } else if (result.reason === 'error') {
        setError('Kurulum başlatılamadı. Tarayıcı menüsünden "Uygulamayı yükle" seçeneğini kullanabilirsiniz.');
      }
    }
  };

  // --- Zaten yüklü -------------------------------------------------------
  if (signal.installed) {
    return (
      <div className="space-y-3">
        <div className="p-4 flex items-start gap-3" style={ROW_STYLE}>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <Check size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white">Uygulama bu cihazda yüklü</div>
            <p className="text-xs text-ink-400 mt-1 leading-relaxed">
              Sinevia ana ekrandan / masaüstü kısayolundan kendi penceresinde açılıyor.
              Bildirimlerin çalışması için Ayarlar → Ses &amp; Bildirim bölümünden izin vermeyi unutma.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- iOS / iPadOS ------------------------------------------------------
  if (signal.platform === 'ios') {
    const onSafari = signal.browser === 'safari';
    return (
      <div className="space-y-3">
        <div className="p-4" style={ROW_STYLE}>
          <div className="flex items-center gap-2.5 mb-1">
            <Smartphone size={16} className="text-azure-400 flex-shrink-0" />
            <span className="text-sm font-bold text-white">iPhone / iPad</span>
          </div>
          <p className="text-xs text-ink-400 leading-relaxed">
            Apple, uygulama kurulumuna yalnızca Safari üzerinden izin verir. Kurulumdan sonra
            bildirimler de çalışır (iOS 16.4 ve üzeri).
          </p>
        </div>

        {!onSafari && (
          <div
            className="p-3 flex items-start gap-2.5 rounded-[var(--r-sm,10px)] border"
            style={{ background: 'rgba(245, 158, 11, .1)', borderColor: 'rgba(245, 158, 11, .35)' }}
          >
            <TriangleAlert size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-amber-300">
                Şu an Safari değil, {signal.browser === 'chrome' ? 'Chrome' : 'başka bir tarayıcı'} kullanıyorsun.
              </p>
              <p className="text-[11px] text-amber-200/80 mt-1 leading-relaxed">
                Bağlantıyı kopyala, Safari'de aç, sonra aşağıdaki adımları izle.
              </p>
              <div className="mt-2">
                <CopyLinkButton />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className={STEP_CLS}>
            <StepNumber n={1} />
            <div className="min-w-0 text-xs text-ink-300 leading-relaxed">
              Sinevia'yı <span className="font-bold text-white">Safari</span> ile aç.
            </div>
          </div>
          <div className={STEP_CLS}>
            <StepNumber n={2} />
            <div className="min-w-0 text-xs text-ink-300 leading-relaxed">
              Alt araç çubuğundaki <Share size={13} className="inline text-azure-400 -mt-0.5" />{' '}
              <span className="font-bold text-white">Paylaş</span> düğmesine dokun.
            </div>
          </div>
          <div className={STEP_CLS}>
            <StepNumber n={3} />
            <div className="min-w-0 text-xs text-ink-300 leading-relaxed">
              Listeden <span className="font-bold text-white">Ana Ekrana Ekle</span> seç, ardından{' '}
              <span className="font-bold text-white">Ekle</span>'ye dokun.
            </div>
          </div>
        </div>

        <p className="flex items-start gap-1.5 text-[10px] text-ink-500 leading-relaxed">
          <Info size={12} className="flex-shrink-0 mt-0.5" />
          <span>
            Kurulumdan sonra uygulamayı mutlaka ana ekrandaki Sinevia simgesinden aç; bildirim izni
            yalnızca o pencerede verilebilir.
          </span>
        </p>

        {onSafari && (
          <div className="pt-1">
            <CopyLinkButton label="Sayfa Bağlantısını Kopyala" />
          </div>
        )}
      </div>
    );
  }

  // --- Android -----------------------------------------------------------
  if (signal.platform === 'android') {
    return (
      <div className="space-y-3">
        <div className="p-4" style={ROW_STYLE}>
          <div className="flex items-center gap-2.5 mb-1">
            <Smartphone size={16} className="text-emerald-400 flex-shrink-0" />
            <span className="text-sm font-bold text-white">Android</span>
          </div>
          <p className="text-xs text-ink-400 leading-relaxed">
            Sinevia'yı ana ekranına uygulama olarak ekle; kendi penceresinde ve çevrimdışı açılır.
          </p>
        </div>

        {signal.canPrompt ? (
          <button
            onClick={startInstall}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-white rounded-[var(--r-sm,10px)] transition-all hover:-translate-y-0.5 active:translate-y-px disabled:opacity-50"
            style={{
              background:
                'linear-gradient(150deg, var(--red-hi, var(--color-2, #ff6b7a)) 0%, var(--red, var(--color-1, #e8384f)) 45%, var(--red-deep, var(--color-3, #8e1220)) 130%)',
              boxShadow: '0 10px 28px -10px rgba(232, 56, 79, .75), inset 0 1px 0 rgba(255, 255, 255, .35)',
            }}
          >
            <Download size={15} /> {busy ? 'Kurulum açılıyor...' : "Sinevia'yı Yükle"}
          </button>
        ) : (
          <div className="space-y-2">
            <div className={STEP_CLS}>
              <StepNumber n={1} />
              <div className="min-w-0 text-xs text-ink-300 leading-relaxed">
                Sağ üstteki <span className="font-bold text-white">⋮</span> menüsüne dokun.
              </div>
            </div>
            <div className={STEP_CLS}>
              <StepNumber n={2} />
              <div className="min-w-0 text-xs text-ink-300 leading-relaxed">
                <span className="font-bold text-white">Uygulamayı yükle</span> veya{' '}
                <span className="font-bold text-white">Ana ekrana ekle</span> seçeneğini seç.
              </div>
            </div>
            <p className="flex items-start gap-1.5 text-[10px] text-ink-500 leading-relaxed">
              <Info size={12} className="flex-shrink-0 mt-0.5" />
              <span>Seçenek görünmüyorsa sayfayı yenile ve birkaç saniye bekle; Chrome menüyü hazırlar.</span>
            </p>
          </div>
        )}

        {error && <p className="text-[10px] text-amber-400 leading-relaxed">{error}</p>}
      </div>
    );
  }

  // --- Masaüstü ----------------------------------------------------------
  const unsupported = signal.browser === 'firefox' || signal.browser === 'safari';
  return (
    <div className="space-y-3">
      <div className="p-4" style={ROW_STYLE}>
        <div className="flex items-center gap-2.5 mb-1">
          <Monitor size={16} className="text-azure-400 flex-shrink-0" />
          <span className="text-sm font-bold text-white">Bilgisayar</span>
        </div>
        <p className="text-xs text-ink-400 leading-relaxed">
          Sinevia'yı masaüstüne uygulama olarak kur; kendi penceresinde açılır ve çevrimdışı çalışır.
        </p>
      </div>

      {signal.canPrompt ? (
        <button
          onClick={startInstall}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-white rounded-[var(--r-sm,10px)] transition-all hover:-translate-y-0.5 active:translate-y-px disabled:opacity-50"
          style={{
            background:
              'linear-gradient(150deg, var(--red-hi, var(--color-2, #ff6b7a)) 0%, var(--red, var(--color-1, #e8384f)) 45%, var(--red-deep, var(--color-3, #8e1220)) 130%)',
            boxShadow: '0 10px 28px -10px rgba(232, 56, 79, .75), inset 0 1px 0 rgba(255, 255, 255, .35)',
          }}
        >
          <Download size={15} /> {busy ? 'Kurulum açılıyor...' : "Sinevia'yı Yükle"}
        </button>
      ) : unsupported ? (
        <div
          className="p-3 flex items-start gap-2.5 rounded-[var(--r-sm,10px)] border"
          style={{ background: 'rgba(245, 158, 11, .1)', borderColor: 'rgba(245, 158, 11, .35)' }}
        >
          <TriangleAlert size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            {signal.browser === 'safari' ? 'Safari' : 'Firefox'} masaüstünde uygulama kurulumunu
            desteklemez. Sinevia'yı <span className="font-bold text-white">Chrome</span> veya{' '}
            <span className="font-bold text-white">Edge</span> ile açıp buradan yükleyebilirsin.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className={STEP_CLS}>
            <StepNumber n={1} />
            <div className="min-w-0 text-xs text-ink-300 leading-relaxed">
              Adres çubuğunun sağındaki <Download size={13} className="inline text-azure-400 -mt-0.5" />{' '}
              <span className="font-bold text-white">yükle</span> simgesine tıkla.
            </div>
          </div>
          <div className={STEP_CLS}>
            <StepNumber n={2} />
            <div className="min-w-0 text-xs text-ink-300 leading-relaxed">
              Açılan pencerede <span className="font-bold text-white">Yükle</span>'ye bas.
            </div>
          </div>
          <p className="flex items-start gap-1.5 text-[10px] text-ink-500 leading-relaxed">
            <Info size={12} className="flex-shrink-0 mt-0.5" />
            <span>
              Simge görünmüyorsa tarayıcı menüsünden (⋮) "Uygulamayı yükle" seçeneğini kullan.
            </span>
          </p>
        </div>
      )}

      {error && <p className="text-[10px] text-amber-400 leading-relaxed">{error}</p>}
    </div>
  );
}
