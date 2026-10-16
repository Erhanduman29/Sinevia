import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

/**
 * Genel hata ekranı ailesi (404 / 405 / 500 ...).
 * Boş siyah ekran yerine kod + açıklama + kurtarma aksiyonu gösterir.
 * Tüm renkler var() zinciri; sabit renk yok.
 */
export interface ErrorScreenProps {
  /** HTTP benzeri hata kodu (ör. 404, 405, 500) */
  code: string | number;
  /** Kod için hazır metin yoksa başlık */
  title?: string;
  /** Kod için hazır metin yoksa açıklama */
  description?: string;
  /** Ana sayfaya dönüş (verilirse buton görünür) */
  onHome?: () => void;
  /** Yeniden dene (verilirse buton görünür) */
  onRetry?: () => void;
}

const COPY: Record<string, { title: string; description: string }> = {
  404: {
    title: 'Sayfa bulunamadı',
    description: 'Aradığın sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir.',
  },
  405: {
    title: 'İzin verilmeyen işlem',
    description: 'Bu adres bu işlem için uygun değil. Ana sayfadan devam edebilirsin.',
  },
  500: {
    title: 'Bir şeyler ters gitti',
    description: 'Sayfa beklenmedik bir hatayla karşılaştı. Yeniden deneyebilirsin.',
  },
};

export default function ErrorScreen({ code, title, description, onHome, onRetry }: ErrorScreenProps) {
  const key = String(code);
  const copy = COPY[key] ?? {
    title: title ?? 'Beklenmeyen bir hata oluştu',
    description: description ?? 'Sayfa yüklenirken bir sorun çıktı. Yeniden deneyebilirsin.',
  };

  return (
    <div className="min-h-[55vh] w-full flex items-center justify-center p-4" role="alert">
      <div
        className="w-full max-w-md rounded-3xl border p-7 sm:p-9 text-center animate-fade-in"
        style={{
          background: 'var(--bg-surface, rgba(15,15,20,0.92))',
          borderColor: 'var(--line, rgba(255,255,255,0.10))',
          boxShadow: '0 30px 70px -30px rgba(0,0,0,0.8)',
        }}
      >
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            background: 'color-mix(in srgb, var(--red, var(--color-1, #e8384f)) 14%, transparent)',
            border: '1px solid color-mix(in srgb, var(--red, var(--color-1, #e8384f)) 35%, transparent)',
          }}
        >
          <AlertTriangle size={28} style={{ color: 'var(--red, var(--color-1, #e8384f))' }} />
        </div>

        <div
          className="text-6xl font-black tracking-tight leading-none"
          style={{ color: 'var(--text-main, #f5f5f2)' }}
        >
          {key}
        </div>
        <h1 className="mt-3 text-xl font-extrabold" style={{ color: 'var(--text-main, #f5f5f2)' }}>
          {title ?? copy.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted, #9a9a96)' }}>
          {description ?? copy.description}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
              style={{
                background: 'var(--red, var(--color-1, #e8384f))',
                color: 'var(--on-color-1, #0a0a0e)',
              }}
            >
              <RotateCcw size={15} /> Yeniden Dene
            </button>
          )}
          {onHome && (
            <button
              type="button"
              onClick={onHome}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-80"
              style={{
                borderColor: 'var(--line, rgba(255,255,255,0.12))',
                color: 'var(--text-main, #f5f5f2)',
                background: 'var(--bg-surface, rgba(20,20,26,0.9))',
              }}
            >
              <Home size={15} /> Ana Sayfa
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
