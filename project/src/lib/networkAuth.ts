/**
 * networkAuth — Sinevia Ağı kimlik doğrulama yardımcıları.
 *
 * Supabase RPC fonksiyonlarını (004_network_auth.sql ile oluşturulur) çağırır.
 * Oturum token'ı localStorage'da tutulur; sayfa yenilendiğinde korur.
 */

import { supabase, clearReadCache } from './supabase';

const SESSION_KEY = 'sinevia_network_session';

export interface NetworkUser {
  agent_id: string;
  username: string;
}

export interface NetworkSession {
  agent_id: string;
  username: string;
  session_token: string;
  recovery_code: string;
  expires_at: string;
}

/** Kaydedilmiş oturum token'ını döndürür (yoksa null). */
export function getStoredSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.session_token || null;
  } catch {
    return null;
  }
}

/** Oturum token'ını kaydeder. */
export function setStoredSessionToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ session_token: token }));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch { /* kota / gizli mod */ }
  // Hesap değişti: önceki hesabın önbelleğe alınmış ağ verileri gösterilmesin.
  clearReadCache();
}

/** Ağdan çıkış yap: RPC çağrısı + local temizleme. */
export async function networkLogout(): Promise<void> {
  const token = getStoredSessionToken();
  if (token) {
    try {
      await supabase.rpc('network_logout', { p_session_token: token });
    } catch {
      // RPC hata versin versin, lokal temizleme yine de yapılır.
    }
  }
  setStoredSessionToken(null);
}

/** Cihazdaki gizli anahtarı (x-agent-token) döndürür. */
export function getLocalSecretToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('sinevia_secret_token');
  } catch {
    return null;
  }
}

/**
 * Kullanıcı adı + şifre ile ağ hesabı oluşturur.
 *
 * agentId + secretToken verilirse cihazdaki MEVCUT profil ağa bağlanır;
 * kütüphane, geçmiş ve XP korunur. Verilmezse sunucu yeni profil açar.
 */
export async function networkRegister(
  username: string,
  password: string,
  agentId?: string | null,
  secretToken?: string | null
): Promise<NetworkSession> {
  const { data, error } = await supabase.rpc('network_register', {
    p_username: username,
    p_password: password,
    p_agent_id: agentId || null,
    p_secret: secretToken || null,
  });
  if (error) throw new Error(error.message || 'Kayıt oluşturulamadı.');
  if (!data) throw new Error('Kayıt yanıtı boş döndü.');
  const s = data as NetworkSession;
  setStoredSessionToken(s.session_token);
  return s;
}

/** Kullanıcı adı + şifre ile ağa giriş yapar. */
export async function networkLogin(
  username: string,
  password: string
): Promise<NetworkSession> {
  const { data, error } = await supabase.rpc('network_login', {
    p_username: username,
    p_password: password,
  });
  if (error) throw new Error(error.message || 'Giriş başarısız.');
  if (!data) throw new Error('Giriş yanıtı boş döndü.');
  const s = data as NetworkSession;
  setStoredSessionToken(s.session_token);
  return s;
}

/**
 * Bu cihazın gizli anahtarını profile yazar (ağ şifresiyle doğrulanır).
 * `true` → anahtar değişti (sayfa yenilenmeli), `false` → zaten bağlıydı.
 */
export async function networkClaimDevice(password: string): Promise<boolean> {
  const token = getStoredSessionToken();
  const secret = getLocalSecretToken();
  if (!token || !secret) return false;
  const { data, error } = await supabase.rpc('network_claim_device', {
    p_session_token: token,
    p_password: password,
    p_new_secret: secret,
  });
  if (error) throw new Error(error.message || 'Cihaz hesaba bağlanamadı.');
  return Boolean(data);
}

/** Oturum doğrular ve kullanıcı bilgisini döndürür. */
export async function networkGetMe(): Promise<NetworkUser | null> {
  const token = getStoredSessionToken();
  if (!token) return null;
  try {
    const { data, error } = await supabase.rpc('network_get_me', {
      p_session_token: token,
    });
    if (error) return null;
    if (!data) return null;
    return { agent_id: data.agent_id, username: data.username } as NetworkUser;
  } catch {
    return null;
  }
}

/** Şifre değiştirme. */
export async function networkChangePassword(
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const token = getStoredSessionToken();
  if (!token) throw new Error('Oturum bulunamadı.');
  const { error } = await supabase.rpc('network_change_password', {
    p_session_token: token,
    p_old_password: oldPassword,
    p_new_password: newPassword,
  });
  if (error) throw new Error(error.message || 'Şifre değiştirilemedi.');
}

/** Hesabı sil (şifre onaylı). RPC → network_delete_account. */
export async function networkDeleteAccount(password: string): Promise<void> {
  const token = getStoredSessionToken();
  if (!token) throw new Error('Oturum bulunamadı.');
  const { error } = await supabase.rpc('network_delete_account', {
    p_session_token: token,
    p_password: password,
  });
  if (error) throw new Error(error.message || 'Hesap silinemedi.');
  setStoredSessionToken(null);
}

/** Mevcut oturumu geçerli kılar (sunucuya istek atmadan, sadece local kontrol). */
export function hasNetworkSession(): boolean {
  return getStoredSessionToken() !== null;
}

/**
 * Bu cihazı (şifre sormadan) hesaba kaydeder.
 * 005_coklu_cihaz.sql ile eklenen `network_touch_device` RPC'sini çağırır.
 * true → cihaz ilk kez kaydedildi (artık bulut eşitlemesi yazabilir).
 */
export async function networkTouchDevice(): Promise<boolean> {
  const token = getStoredSessionToken();
  const secret = getLocalSecretToken();
  if (!token || !secret) return false;
  try {
    const { data, error } = await supabase.rpc('network_touch_device', {
      p_session_token: token,
      p_secret: secret,
    });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}