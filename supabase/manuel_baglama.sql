-- ============================================================
-- SINEVIA — MANUEL BAĞLAMA (ESKİ ANAHTARI OLMAYAN HESAPLAR)
-- ============================================================
-- NE ZAMAN KULLANILIR?
--   Uygulamada "Bu cihazdaki hesap doğrulanamadı. Manuel destek gerekir."
--   hatası alındığında. Bu, tarayıcıdaki gizli anahtar (secret_token) ile
--   sunucudaki profil anahtarının eşleşmediği anlamına gelir. Sebepleri:
--     - Hesap başka bir tarayıcıda/cihazda oluşturulmuş,
--     - Hesap "taşıma kodu" ile bu cihaza getirilmiş,
--     - Tarayıcı verilerinin bir kısmı silinmiş,
--     - Gizli mod (incognito) kullanılmış.
--
-- NE YAPAR?
--   Belirtilen hesabı (agent_id) belirtilen kullanıcı adı + şifreye bağlar.
--   Kütüphaneye, geçmişe, XP'ye DOKUNMAZ.
--
-- NE YAPMAZ?
--   Tablo/veri silmez. Zaten bağlı bir hesabı yeniden bağlamaz (hata verir).
--
-- GÜVENLİK:
--   Bu fonksiyon yalnızca Supabase SQL Editor'de (tablo sahibi / service_role)
--   çalışır. Uygulamadan (anon/authenticated) ÇAĞRILAMAZ.
-- ============================================================

begin;

create or replace function public.network_admin_link(
  p_agent_id text,
  p_username text,
  p_password text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_agent text := btrim(coalesce(p_agent_id, ''));
  v_user  text := btrim(coalesce(p_username, ''));
  v_existing text;
  v_code text;
begin
  if v_agent = '' then
    raise exception 'agent_id boş olamaz.';
  end if;
  if length(v_user) < 3 then
    raise exception 'Kullanıcı adı en az 3 karakter olmalı.';
  end if;
  if length(v_user) > 20 then
    raise exception 'Kullanıcı adı en fazla 20 karakter olabilir.';
  end if;
  if v_user !~ '^[A-Za-z0-9_]+$' then
    raise exception 'Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Şifre en az 6 karakter olmalı.';
  end if;

  if not exists (select 1 from public.profiles where agent_id = v_agent) then
    raise exception 'Bu agent_id profiles tablosunda bulunamadı: %', v_agent;
  end if;

  select username into v_existing
  from public.network_accounts
  where agent_id = v_agent;

  if v_existing is not null then
    raise exception 'Bu hesap zaten "%" kullanıcı adıyla ağa bağlı. Bağlamak yerine giriş yapın.', v_existing;
  end if;

  select username into v_existing
  from public.network_accounts
  where username_lower = lower(v_user);

  if v_existing is not null then
    raise exception 'Bu kullanıcı adı başka bir hesapta kullanılıyor. Farklı bir ad seçin.';
  end if;

  v_code := public.generate_recovery_code();

  insert into public.network_accounts
    (username, username_lower, password_hash, recovery_code, agent_id)
  values
    (v_user, lower(v_user),
     extensions.crypt(p_password, extensions.gen_salt('bf')),
     v_code, v_agent);

  return v_code;
end;
$$;

-- Uygulamadan çağrılamasın: yalnızca SQL Editor (service_role / postgres).
revoke all on function public.network_admin_link(text, text, text) from public;
revoke all on function public.network_admin_link(text, text, text) from anon;
revoke all on function public.network_admin_link(text, text, text) from authenticated;

commit;

-- ============================================================
-- KULLANIM
-- ============================================================
-- 1) ADIM: Hangi hesabı bağlayacağını bul (en son aktif olan en üstte).
--
--    select agent_id, nickname, total_xp, last_seen
--    from public.profiles
--    order by last_seen desc nulls last;
--
-- 2) ADIM: Aşağıdaki satırı kopyala, TEK TIRNAK içindeki 3 değeri kendine
--          göre değiştir, çalıştır. (YENİ bir sorgu penceresinde.)
--
--    select public.network_admin_link(
--      'SNV-XXXX-XXXX',      -- <-- 1. adımda bulduğun agent_id
--      'erhan',              -- <-- istediğin kullanıcı adı
--      'enAz6Karakter'       -- <-- istediğin şifre
--    ) as kurtarma_kodu;
--
-- 3) ADIM: Çıkan kurtarma kodunu bir yere yaz.
--          (Şifreni unutursan bu kodla sıfırlayacaksın.)
--
-- 4) ADIM: Uygulamaya dön, sayfayı yenile (Ctrl + F5),
--          "Hesabını Bağla" -> "Zaten hesabın var mı? Giriş yap"
--          ve 2. adımda belirlediğin kullanıcı adı + şifre ile gir.
-- ============================================================
