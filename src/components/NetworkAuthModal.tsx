import { useState, useEffect, useCallback } from 'react';
import {
  Mail, Lock, Eye, EyeOff, ArrowLeft, LogOut, ShieldAlert, Users,
  Save, Type, User, CheckCircle2, AlertTriangle, Key
} from 'lucide-react';
import { useNetworkAuth } from '../context/NetworkAuthContext';
import { useApp } from '../context/AppContext';
import {
  networkRegister, networkLogin, networkLogout, getLocalSecretToken,
  networkClaimDevice,
} from '../lib/networkAuth';

// ---------------------------------------------------------------------------
// SİNEVİA AĞI — KAYIT / GİRİŞ MODALI
// Bu modal şu etkinlikle açılır: window.dispatchEvent(new CustomEvent('sinevia-open-network-auth'))
// Layout.tsx masaüstü topbar butonu ve mobil alt bar 'Hesabını Bağla' etiketinden tetiklenir.
//
// KAYIT = cihazdaki MEVCUT hesabı ağa bağlar (kütüphane silinmez/taşınmaz).
// GİRİŞ  = başka cihazda oluşturulmuş ağ hesabına girer (bulut yedeği çekilir).
// ---------------------------------------------------------------------------

export default function NetworkAuthModal({ onClose }: { onClose: () => void }) {
  const { networkUser, isNetworkLoading, refreshNetworkUser } = useNetworkAuth();
  const { data, adoptNetworkIdentity } = useApp();

  // Modal dışına tıklanırsa kapatmak için state
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualSupport, setManualSupport] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal dışarıya tıklama → kapat
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
      onClose();
    }
  };

  // Etkinlik dinleyicisi: dışarıdan açma talebi geldiğinde (örn. Layout'tan)
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setMode('register');
    setError(null);
    setManualSupport(false);
    setSuccess(null);
    };
    window.addEventListener('sinevia-open-network-auth', handleOpen);
    return () => window.removeEventListener('sinevia-open-network-auth', handleOpen);
  }, []);

  // Kayıt işlemi
  const handleRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setManualSupport(false);
    setSuccess(null);

    const u = username.trim();
    const p = password.trim();

    if (!u || !p) {
      setError('Kullanıcı adı ve şifre zorunludur.');
      return;
    }
    if (u.length < 3 || u.length > 20) {
      setError('Kullanıcı adı 3 ile 20 karakter arasında olmalıdır.');
      return;
    }
    if (!/^[a-z0-9_]+$/i.test(u)) {
      setError('Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir.');
      return;
    }
    if (p.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (mode === 'register' && p !== confirmPassword.trim()) {
      setError('Şifreler uyuşmuyor.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        // Mevcut cihaz profilini ağa bağla: agent_id + gizli anahtar gönderilir.
        await networkRegister(u, p, data.agentId, getLocalSecretToken());
        await refreshNetworkUser();
        setIsOpen(false);
        onClose();
      } else {
        const session = await networkLogin(u, p);

        // 1) Bu cihazı hesaba kaydet. Profilin gizli anahtarı EZİLMEZ;
        //    böylece aynı hesap diğer cihazlarda da açık kalır (005).
        let deviceChanged = false;
        try {
          deviceChanged = await networkClaimDevice(p);
        } catch {
          // Sessiz geç: eşitleme bir sonraki denemede kendini toparlar.
        }

        // 2) Farklı bir cihazdan girildiyse kimliği ağ hesabına geçir
        //    (bulut yedeği çekilir; yedek yoksa giriş geri alınır).
        if (data.agentId && session.agent_id !== data.agentId) {
          const adopted = await adoptNetworkIdentity(session.agent_id, session.username);
          if (!adopted) {
            await networkLogout();
            await refreshNetworkUser();
            setError(
              'Bu ağ hesabının bulut yedeği bulunamadı. Kütüphanen bu cihazda güvende; ' +
              'ağa bağlanmak için manuel destek gerekir.'
            );
            return;
          }
        }

        await refreshNetworkUser();

        setIsOpen(false);
        onClose();

        // Anahtar yenilendiyse temiz bir açılış yap (eşitleme hemen çalışsın).
        if (deviceChanged) window.location.reload();
      }
    } catch (err: any) {
      const raw = String(err?.message || '');
      if (raw.includes('doğrulanamadı')) {
        setManualSupport(true);
        setError(
          'Bu tarayıcıdaki güvenlik anahtarı, sunucudaki hesapla eşleşmiyor. ' +
          'Bu durum hesabın başka bir cihazda oluşturulduğunda, taşıma koduyla ' +
          'bu cihaza getirildiğinde veya tarayıcı verilerinin bir kısmı silindiğinde olur. ' +
          'Kütüphanen bu cihazda güvende. Çözüm: hesabın daha önce ağa bağlandıysa ' +
          '"Zaten hesabın var mı? Giriş yap" ile gir; hiç bağlanmadıysa manuel destek gerekir.'
        );
      } else {
        setError(raw || 'Beklenmedik bir hata oluştu.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [username, password, confirmPassword, mode, data.agentId, adoptNetworkIdentity, refreshNetworkUser]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(4, 4, 6, .75)', backdropFilter: 'blur(16px)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-md animate-uvPop rounded-[22px] overflow-hidden border border-white/12"
        style={{ background: 'linear-gradient(165deg, #17171C 0%, #0E0E12 60%, #0B0B0E 100%)', boxShadow: '0 50px 110px -30px rgba(0, 0, 0, .95)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal başlığı */}
        <div className="p-6 border-b border-white/8" style={{ background: 'linear-gradient(120deg, rgba(212, 165, 60, .16), rgba(212, 165, 60, .02) 70%)' }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: '#d4a53c', boxShadow: '0 0 8px #d4a53c' }} />
            <span className="text-xs font-extrabold uppercase tracking-widest text-gold-300">
              {mode === 'register' ? 'Sinevia Ağı — Hesabını Bağla' : 'Sinevia Ağı — Giriş Yap'}
            </span>
          </div>
          <p className="text-[11px] text-ink-400 mt-2 leading-relaxed">
            {mode === 'register'
              ? 'Kullanıcı adı ve şifre belirle. Bu cihazdaki mevcut Sinevia hesabın ağa bağlanır; kütüphanen, geçmişin ve puanların olduğu gibi kalır.'
              : 'Daha önce başka bir cihazda oluşturduğun ağ hesabına gir. Kütüphanen buluttan geri yüklenir.'}
          </p>
        </div>

        <form onSubmit={handleRegister} className="p-6 space-y-5">
          {/* Hata mesajı */}
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-[11px] leading-relaxed">
              <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-red-300">{error}</span>
            </div>
          )}

          {/* Manuel destek paneli (güvenlik anahtarı eşleşmediğinde) */}
          {manualSupport && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                Manuel destek (tek seferlik)
              </p>
              <ol className="text-[10.5px] text-amber-200/90 space-y-1.5 list-decimal pl-4 leading-relaxed">
                <li>Supabase → SQL Editor → <code>supabase/manuel_baglama.sql</code> dosyasının tamamını bir kez çalıştır. (Veri silmez.)</li>
                <li>Aşağıdaki satırı çalıştır; kullanıcı adı ve şifreyi kendine göre değiştir.</li>
                <li>Çıkan <strong>kurtarma kodunu</strong> bir yere yaz, sonra "Zaten hesabın var mı? Giriş yap" ile gir.</li>
              </ol>
              <pre className="text-[10px] leading-relaxed text-amber-100 bg-black/40 border border-white/10 rounded-lg p-2 overflow-x-auto select-all">{`select public.network_admin_link(
  '${data.agentId || 'SNV-XXXX-XXXX'}',
  'erhan',
  'enAz6Karakter'
) as kurtarma_kodu;`}</pre>
            </div>
          )}

          {/* Başarı mesajı (sadece kayıt modunda) */}
          {success && mode === 'register' && (
            <div className="flex items-start gap-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] leading-relaxed">
              <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <span className="text-emerald-300">{success}</span>
            </div>
          )}

          {/* Bu cihazdaki hesap bilgisi */}
          <div className="rounded-xl border border-white/8 bg-white/[.03] px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-wider text-ink-500 mb-0.5">
              Bu cihazdaki hesap
            </p>
            <p className="text-[11px] text-ink-300 font-semibold">
              {data.nickname || 'Yeni Üye'}
              <span className="text-ink-500 font-normal"> · {data.agentId || 'kayıtsız'}</span>
            </p>
            <p className="text-[9px] mt-1 text-ink-500">
              Güvenlik anahtarı: {getLocalSecretToken() ? 'hazır' : 'YOK (manuel destek gerekir)'}
            </p>
          </div>

          {/* Kullanıcı adı */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-ink-500 mb-1.5">
              <User size={12} className="mr-1" /> Kullanıcı Adı
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="örn. erhan"
              maxLength={20}
              disabled={submitting}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg transition-colors focus:outline-none focus:border-[color:var(--red,var(--color-1,#e8384f))]"
              style={{ background: 'var(--bg-base, #0a0a0d)', border: '1px solid rgba(244,244,242,.13)' }}
            />
            <p className="text-[9px] text-ink-500 mt-1">
              3–20 karakter · harf, rakam, alt çizgi
            </p>
          </div>

          {/* Şifre */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-ink-500 mb-1.5">
              <Lock size={12} className="mr-1" /> Şifre
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                minLength={6}
                disabled={submitting}
                className="w-full px-3 py-2 text-xs sm:text-sm pr-10 rounded-lg transition-colors focus:outline-none focus:border-[color:var(--red,var(--color-1,#e8384f))]"
                style={{ background: 'var(--bg-base, #0a0a0d)', border: '1px solid rgba(244,244,242,.13)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={submitting}
                className="absolute right-3 top-2.5 text-ink-500 hover:text-ink-200 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {mode === 'register' && (
              <div className="mt-2">
                <label className="block text-[10px] font-black uppercase tracking-wider text-ink-500 mb-1.5">
                  <Lock size={12} className="mr-1" /> Şifre (Tekrar)
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••"
                  disabled={submitting}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg transition-colors focus:outline-none focus:border-[color:var(--red,var(--color-1,#e8384f))]"
                  style={{ background: 'var(--bg-base, #0a0a0d)', border: '1px solid rgba(244,244,242,.13)' }}
                />
              </div>
            )}
            <p className="text-[9px] text-ink-500 mt-1">
              En az 6 karakter · şifreni unutursan kurtarma koduyla sıfırlanabilir
            </p>
          </div>

          {/* Butonlar */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
              disabled={submitting}
              className="px-3 py-2 rounded-lg text-xs font-bold transition-colors border border-ink-700 hover:bg-white/[.05]"
              style={{ background: 'rgba(255,255,255,.05)', color: '#ccc' }}
            >
              {mode === 'register' ? 'Zaten hesabın var mı? Giriş yap' : 'Yeni hesap oluştur'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`font-extrabold uppercase tracking-wider px-4 py-2.5 rounded-lg text-white transition-all hover:-translate-y-0.5 shrink-0 ${submitting ? 'opacity-50 pointer-events-none' : ''}`}
              style={{ background: 'linear-gradient(120deg, #d4a53c, #9a7420)', boxShadow: '0 8px 22px -10px rgba(212, 165, 60, .7)' }}
            >
              {submitting ? 'İşlem yapılıyor...' : mode === 'register' ? 'Hesabımı Bağla' : 'Giriş Yap'}
            </button>
          </div>

          {/* Moda göre alt ipucu */}
          {mode === 'login' && (
            <p className="text-[10px] text-ink-400 mt-3 text-center">
              Şifreni unuttuysan kurtarma kodunla sıfırlayabilirsin.
            </p>
          )}
        </form>

        <div className="p-4 border-t border-white/8 bg-black/20 text-center">
          <button
            onClick={() => { setIsOpen(false); onClose(); }}
            className="text-xs font-bold text-ink-400 hover:text-ink-200 transition-colors underline decoration-ink-500/30"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
