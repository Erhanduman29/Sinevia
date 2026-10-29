-- ============================================================
-- SINEVIA 004 — AĞ HESAP SİSTEMİ (KULLANICI ADI + ŞİFRE)
-- ============================================================
-- KURAL: Bu dosyada DROP TABLE, TRUNCATE veya toplu profil silme YOKTUR.
-- Tek istisna: kullanıcı "Hesabımı Sil" dediğinde, kendi şifresini doğrulayarak
-- yalnızca KENDİ kaydını silen network_delete_account fonksiyonudur.
-- Mevcut kullanıcı kayıtları korunur. Tekrar tekrar çalıştırılabilir.
-- Sıra: 001_schema.sql -> 002_security.sql -> 003_functions.sql -> 004_network_auth.sql
-- Önce yedek alın: Supabase > Database > Backups + tabloların CSV çıktısı.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) PGCRYPTO UZANTISI (şifre hashleme için gerekli)
-- ------------------------------------------------------------
-- Supabase'de pgcrypto çoğu zaman `extensions` şemasına kuruludur, `public`
-- şemasına değil. Fonksiyonların `search_path` ayarına `extensions` eklendi;
-- aksi halde "function gen_salt(unknown) does not exist" hatası alınır.
create extension if not exists pgcrypto;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- 2) AĞ HESAPLARI (kullanıcı adı + şifre -> profil bağlantısı)
-- ------------------------------------------------------------
create table if not exists public.network_accounts (
  id text primary key default gen_random_uuid()::text,
  username text not null,
  username_lower text not null,
  password_hash text not null,
  recovery_code text not null,
  agent_id text not null references public.profiles(agent_id) on delete cascade,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Aynı kullanıcı adı büyük/küçük harf duyarsız olarak tekrar alınamaz.
create unique index if not exists idx_network_accounts_username_lower
  on public.network_accounts (username_lower);

-- Bir profile yalnızca bir ağ hesabı bağlanabilir.
create unique index if not exists idx_network_accounts_agent_unique
  on public.network_accounts (agent_id);

-- Kurtarma kodu benzersiz olmalı (şifre unutulurken kullanılır).
create unique index if not exists idx_network_accounts_recovery_code
  on public.network_accounts (recovery_code);

-- ------------------------------------------------------------
-- 3) AĞ OTURUMLARI (giriş yaptıktan sonra oturum izleme)
-- ------------------------------------------------------------
create table if not exists public.network_sessions (
  session_token text primary key,
  agent_id text not null references public.profiles(agent_id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists idx_network_sessions_agent_id
  on public.network_sessions (agent_id);

create index if not exists idx_network_sessions_expires_at
  on public.network_sessions (expires_at);

-- ------------------------------------------------------------
-- 4) GİRİŞ DENEMELERİ (yarı şifreleme koruması)
-- ------------------------------------------------------------
create table if not exists public.login_attempts (
  id text primary key default gen_random_uuid()::text,
  username text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);

create index if not exists idx_login_attempts_username_time
  on public.login_attempts (username, attempted_at desc);

-- ------------------------------------------------------------
-- 5) YARDIMCI FONKSİYONLAR
-- ------------------------------------------------------------

-- Rastgele kurtarma kodu üretir (8 harfli, büyük harf + rakam).
create or replace function public.generate_recovery_code()
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i integer;
begin
  for i in 1..8 loop
    code := code || substring(chars from (floor(random() * length(chars))::int + 1) for 1);
  end loop;
  return code;
end;
$$;

-- ------------------------------------------------------------
-- 6) RPC: AĞ HESABI KAYDI
-- ------------------------------------------------------------
-- ÖNEMLİ: Kayıt, cihazdaki MEVCUT profili ağa bağlar. Böylece mevcut
-- kullanıcıların kütüphanesi, geçmişi ve XP'si korunur; ikinci bir boş
-- profil oluşmaz. p_agent_id + p_secret verilmezse (çok nadir) eski
-- davranışa düşüp yeni bir profil açar.
--
-- Eski 2 parametreli imza kalırsa Postgres iki ayrı fonksiyon tutar;
-- karışıklık olmaması için önce onu kaldırıyoruz. (Veri silmez.)
drop function if exists public.network_register(text, text);

create or replace function public.network_register(
  p_username text,
  p_password text,
  p_agent_id text default null,
  p_secret text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_username_lower text;
  v_existing_agent text;
  v_agent_id text;
  v_agent_secret text;
  v_linked_username text;
  v_recovery_code text;
  v_password_hash text;
  v_session_token text;
  v_expires_at timestamptz;
begin
  -- Girdi temizliği
  if p_username is null or btrim(p_username) = '' then
    raise exception 'Kullanıcı adı boş olamaz.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Şifre en az 6 karakter olmalı.';
  end if;

  v_username_lower := lower(btrim(p_username));
  if length(v_username_lower) < 3 then
    raise exception 'Kullanıcı adı en az 3 karakter olmalı.';
  end if;

  -- Aynı kullanıcı adı var mı?
  select agent_id into v_existing_agent
  from public.network_accounts
  where username_lower = v_username_lower;

  if v_existing_agent is not null then
    raise exception 'Bu kullanıcı adı zaten alınmış.';
  end if;

  -- Şifre hashleme (bcrypt)
  v_password_hash := crypt(p_password, gen_salt('bf'));

  -- Hangi profile bağlanacağız?
  if p_agent_id is not null and btrim(p_agent_id) <> '' then
    -- 1) Cihazdaki mevcut profil + güvenlik anahtarı doğrulanır.
    v_agent_id := btrim(p_agent_id);

    select secret_token into v_agent_secret
    from public.profiles
    where agent_id = v_agent_id;

    if v_agent_secret is null or btrim(v_agent_secret) = '' then
      raise exception 'Bu cihazdaki hesap doğrulanamadı (güvenlik anahtarı yok). Manuel destek gerekir.';
    end if;

    if p_secret is null or v_agent_secret <> p_secret then
      raise exception 'Bu cihazdaki hesap doğrulanamadı. Manuel destek gerekir.';
    end if;

    -- 2) Bu profil zaten başka bir kullanıcı adına bağlı olabilir.
    select username into v_linked_username
    from public.network_accounts
    where agent_id = v_agent_id;

    if v_linked_username is not null then
      raise exception 'Bu cihazdaki hesap zaten "%" kullanıcı adıyla ağa bağlı.', v_linked_username;
    end if;
  else
    -- Nadir durum: cihazda doğrulanabilir profil yok → yeni profil açılır.
    v_agent_id := gen_random_uuid()::text;

    insert into public.profiles (agent_id, nickname, level, total_xp, movies_watched,
                                 past_movies_watched, series_watched, episodes_watched,
                                 achievements_unlocked, quests_completed,
                                 currently_watching, showcase, last_seen, last_cloud_sync,
                                 secret_token)
    values (v_agent_id, split_part(p_username, '@', 1), 1, 0, 0, 0, 0, 0, 0, 0,
            '[]'::jsonb, '[]'::jsonb, now(), 0, null);
  end if;

  v_recovery_code := public.generate_recovery_code();

  insert into public.network_accounts (username, username_lower, password_hash,
                                       recovery_code, agent_id)
  values (p_username, v_username_lower, v_password_hash, v_recovery_code, v_agent_id);

  -- Oturum oluştur
  v_session_token := gen_random_uuid()::text;
  v_expires_at := now() + interval '30 days';

  insert into public.network_sessions (session_token, agent_id, expires_at)
  values (v_session_token, v_agent_id, v_expires_at);

  return jsonb_build_object(
    'agent_id', v_agent_id,
    'username', p_username,
    'recovery_code', v_recovery_code,
    'session_token', v_session_token,
    'expires_at', to_char(v_expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
end;
$$;

grant execute on function public.network_register(text, text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 7) RPC: AĞ GİRİŞİ
-- ------------------------------------------------------------
create or replace function public.network_login(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_username_lower text;
  v_agent_id text;
  v_password_hash text;
  v_recovery_code text;
  v_session_token text;
  v_expires_at timestamptz;
  v_username text;
  v_match boolean;
begin
  if p_username is null or p_password is null then
    raise exception 'Kullanıcı adı ve şifre gerekli.';
  end if;

  v_username_lower := lower(btrim(p_username));

  -- Giriş denemesini kaydet (başarısızlık bile kaydedilir)
  -- (gerçek rate limiting uygulamada burada sınır koyulur)

  select agent_id, password_hash, username
  into v_agent_id, v_password_hash, v_username
  from public.network_accounts
  where username_lower = v_username_lower;

  if v_agent_id is null then
    -- Kullanıcı bulunamadı; deneme kaydı at
    insert into public.login_attempts (username, success)
    values (p_username, false);
    raise exception 'Kullanıcı adı veya şifre hatalı.';
  end if;

  -- Şifre karşılaştırma
  begin
    v_match := (v_password_hash = crypt(p_password, v_password_hash));
  exception when others then
    v_match := false;
  end;

  if not v_match then
    insert into public.login_attempts (username, success)
    values (p_username, false);
    raise exception 'Kullanıcı adı veya şifre hatalı.';
  end if;

  -- Başarılı giriş denemesi
  insert into public.login_attempts (username, success)
  values (p_username, true);

  -- Çoklu cihaz: diğer cihazların oturumları SİLİNMEZ.
  -- (005_coklu_cihaz.sql de aynı davranışı uygular.)
  -- Yeni oturum
  v_session_token := gen_random_uuid()::text;
  v_expires_at := now() + interval '30 days';

  insert into public.network_sessions (session_token, agent_id, expires_at)
  values (v_session_token, v_agent_id, v_expires_at);

  update public.network_accounts
  set last_login_at = now()
  where agent_id = v_agent_id;

  select recovery_code into v_recovery_code
  from public.network_accounts
  where agent_id = v_agent_id;

  return jsonb_build_object(
    'agent_id', v_agent_id,
    'username', v_username,
    'recovery_code', v_recovery_code,
    'session_token', v_session_token,
    'expires_at', to_char(v_expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
end;
$$;

grant execute on function public.network_login(text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 8) RPC: AĞDAN ÇIKIŞ
-- ------------------------------------------------------------
create or replace function public.network_logout(p_session_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_session_token is null then
    return;
  end if;

  delete from public.network_sessions
  where session_token = p_session_token;
end;
$$;

grant execute on function public.network_logout(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 9) RPC: BEN KİMİM (oturum doğrulama)
-- ------------------------------------------------------------
create or replace function public.network_get_me(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_agent_id text;
  v_username text;
begin
  if p_session_token is null then
    raise exception 'Oturum bulunamadı.';
  end if;

  select na.agent_id, na.username
  into v_agent_id, v_username
  from public.network_sessions ns
  join public.network_accounts na on na.agent_id = ns.agent_id
  where ns.session_token = p_session_token
    and ns.expires_at > now();

  if v_agent_id is null then
    raise exception 'Oturum süresi dolmuş veya geçersiz.';
  end if;

  return jsonb_build_object(
    'agent_id', v_agent_id,
    'username', v_username
  );
end;
$$;

grant execute on function public.network_get_me(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 10) RPC: ŞİFRE DEĞİŞTİRME
-- ------------------------------------------------------------
create or replace function public.network_change_password(p_session_token text, p_old_password text, p_new_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_agent_id text;
  v_password_hash text;
  v_match boolean;
begin
  if p_session_token is null then
    raise exception 'Oturum bulunamadı.';
  end if;
  if p_new_password is null or length(p_new_password) < 6 then
    raise exception 'Yeni şifre en az 6 karakter olmalı.';
  end if;

  select ns.agent_id, na.password_hash
  into v_agent_id, v_password_hash
  from public.network_sessions ns
  join public.network_accounts na on na.agent_id = ns.agent_id
  where ns.session_token = p_session_token
    and ns.expires_at > now();

  if v_agent_id is null then
    raise exception 'Oturum süresi dolmuş veya geçersiz.';
  end if;

  -- Eski şifre kontrolü
  begin
    v_match := (v_password_hash = crypt(p_old_password, v_password_hash));
  exception when others then
    v_match := false;
  end;

  if not v_match then
    raise exception 'Eski şifre hatalı.';
  end if;

  update public.network_accounts
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where agent_id = v_agent_id;
end;
$$;

grant execute on function public.network_change_password(text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 11) RPC: HESABI SİLME (ağ hesabı + profil + tüm ağ verileri)
-- ------------------------------------------------------------
create or replace function public.network_delete_account(p_session_token text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, storage, extensions
as $$
declare
  v_agent_id text;
  v_password_hash text;
  v_match boolean;
  v_token text;
begin
  if p_session_token is null then
    raise exception 'Oturum bulunamadı.';
  end if;
  if p_password is null or btrim(p_password) = '' then
    raise exception 'Şifre gerekli.';
  end if;

  select ns.agent_id, na.password_hash
  into v_agent_id, v_password_hash
  from public.network_sessions ns
  join public.network_accounts na on na.agent_id = ns.agent_id
  where ns.session_token = p_session_token
    and ns.expires_at > now();

  if v_agent_id is null then
    raise exception 'Oturum süresi dolmuş veya geçersiz.';
  end if;

  -- Şifre kontrolü
  begin
    v_match := (v_password_hash = crypt(p_password, v_password_hash));
  exception when others then
    v_match := false;
  end;

  if not v_match then
    raise exception 'Şifre hatalı.';
  end if;

  -- Profillin secret_token'ını al (003 ile silmek için gerekli)
  select secret_token into v_token
  from public.profiles
  where agent_id = v_agent_id;

  if v_token is null or btrim(v_token) = '' then
    raise exception 'Bu profil için güvenlik anahtarı bulunamadı.';
  end if;

  -- Oturumu sonlandır
  delete from public.network_sessions
  where session_token = p_session_token;

  -- Ağ hesabını sil
  delete from public.network_accounts
  where agent_id = v_agent_id;

  -- Tüm ağ ve profil verilerini sil (003'deki aynı işlem)
  delete from public.messages
  where group_id in (
    select id from public.chat_groups where created_by = v_agent_id
  );
  delete from public.messages
  where sender_id = v_agent_id or receiver_id = v_agent_id;
  delete from public.recommendations
  where sender_id = v_agent_id or receiver_id = v_agent_id;
  delete from public.friendships
  where requester_id = v_agent_id or receiver_id = v_agent_id;
  delete from public.chat_group_members
  where group_id in (select id from public.chat_groups where created_by = v_agent_id);
  delete from public.chat_group_members
  where agent_id = v_agent_id;
  delete from public.chat_groups
  where created_by = v_agent_id;
  delete from public.network_logs
  where agent_id = v_agent_id;
  delete from public.profiles
  where agent_id = v_agent_id;
  delete from storage.objects
  where bucket_id = 'sinevia_saves' and name = v_agent_id || '.json';
end;
$$;

grant execute on function public.network_delete_account(text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 12) RLS POLİTİKALARI (yeni tablolar için)
-- ------------------------------------------------------------

-- NOT: Her create policy'den önce "drop policy if exists" vardır; böylece bu
-- dosya tekrar tekrar çalıştırılabilir. Eski policy'ler silinip aynısı
-- yeniden tanımlanır (veriye dokunulmaz).

-- network_accounts: sadece kendi hesabı görülebilir / değiştirilebilir.
alter table public.network_accounts enable row level security;

drop policy if exists network_accounts_select_own on public.network_accounts;
create policy network_accounts_select_own
  on public.network_accounts for select
  to anon, authenticated
  using (agent_id = public.current_agent_id());

drop policy if exists network_accounts_insert_self on public.network_accounts;
create policy network_accounts_insert_self
  on public.network_accounts for insert
  to anon, authenticated
  with check (agent_id = public.current_agent_id());

drop policy if exists network_accounts_update_own on public.network_accounts;
create policy network_accounts_update_own
  on public.network_accounts for update
  to anon, authenticated
  using (agent_id = public.current_agent_id())
  with check (agent_id = public.current_agent_id());

drop policy if exists network_accounts_delete_own on public.network_accounts;
create policy network_accounts_delete_own
  on public.network_accounts for delete
  to anon, authenticated
  using (agent_id = public.current_agent_id());

-- network_sessions: sadece kendi oturumu.
alter table public.network_sessions enable row level security;

drop policy if exists network_sessions_select_own on public.network_sessions;
create policy network_sessions_select_own
  on public.network_sessions for select
  to anon, authenticated
  using (agent_id = public.current_agent_id());

drop policy if exists network_sessions_insert_self on public.network_sessions;
create policy network_sessions_insert_self
  on public.network_sessions for insert
  to anon, authenticated
  with check (agent_id = public.current_agent_id());

drop policy if exists network_sessions_delete_own on public.network_sessions;
create policy network_sessions_delete_own
  on public.network_sessions for delete
  to anon, authenticated
  using (agent_id = public.current_agent_id());

-- login_attempts: sadece insert (kayıt), select kendi adıyla (anahtar yoksa kabul et).
alter table public.login_attempts enable row level security;

drop policy if exists login_attempts_insert_any on public.login_attempts;
create policy login_attempts_insert_any
  on public.login_attempts for insert
  to anon, authenticated
  with check (true);

drop policy if exists login_attempts_select_own on public.login_attempts;
create policy login_attempts_select_own
  on public.login_attempts for select
  to anon, authenticated
  using (true);

comment on table public.network_accounts is
  'Kullanıcı adı + şifre ile ağ girişi. username_lower ile büyük/küçük harf duyarsız benzersizlik.';
comment on table public.network_sessions is
  'Ağ giriş oturumları. 30 gün geçerlilik.';
comment on table public.login_attempts is
  'Giriş denemeleri kaydı (rate limiting için).';

-- ------------------------------------------------------------
-- 13) POSTGREST ŞEMA ÖNBELLEĞİNİ YENİLE
-- ------------------------------------------------------------
-- Yeni tablo/fonksiyonlar eklendiğinde istemci "Could not find the function
-- ... in the schema cache" hatası alabilir. Bu bildirim önbelleği hemen
-- yeniler; böylece sayfa yenilemeye gerek kalmaz.
notify pgrst, 'reload schema';

commit;
