-- ============================================================
-- SINEVIA 005 — ÇOKLU CİHAZ (AYNI HESAP, SINIRSIZ CİHAZ)
-- ============================================================
-- AMAÇ
--   Aynı hesap; telefon, tablet, bilgisayar, farklı tarayıcılar...
--   hepsinde AYNI ANDA açık olabilir ve birbirleriyle eşitlenir.
--
-- ÖNCEKİ SORUN
--   002'de her profilin TEK bir gizli anahtarı var (profiles.secret_token).
--   Bu yüzden yalnızca o anahtarı taşıyan cihaz yazabiliyordu. İkinci cihaz
--   giriş yapınca profil güncellenemiyor ("Bulut Ağı: Bağlantı Yok") ve
--   004'teki network_login diğer oturumları siliyordu.
--
-- ÇÖZÜM
--   1) network_devices: her cihazın kendi gizli anahtarı.
--   2) can_write_profile: profil anahtarı VEYA kayıtlı cihaz anahtarı.
--   3) protect_profile_trigger: kayıtlı cihaz anahtarını da kabul eder.
--   4) network_login: diğer oturumları SİLMEZ.
--   5) network_claim_device: anahtarı ezmek yerine cihazı kaydeder.
--
-- KURAL: Veri silmez. Idempotent, tekrar çalıştırılabilir.
-- Sıra: 001 -> 002 -> 003 -> 004 -> 005
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) CİHAZ TABLOSU
-- ------------------------------------------------------------
-- Bir cihaz (localStorage'daki gizli anahtar) birden fazla hesap için
-- kayıtlı olabilir; bu yüzden birincil anahtar (cihaz + hesap) çiftidir.
create table if not exists public.network_devices (
  device_secret text not null,
  agent_id text not null references public.profiles(agent_id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (device_secret, agent_id)
);

create index if not exists idx_network_devices_agent_id
  on public.network_devices (agent_id);

-- Doğrudan erişim kapalı: yalnızca aşağıdaki security definer fonksiyonlar
-- ve trigger okur/yazar. (Policy tanımlanmadığı için anon/authenticated
-- bu tabloyu okuyup yazamaz.)
alter table public.network_devices enable row level security;

comment on table public.network_devices is
  'Hesaba bağlı cihazlar. Her cihazın kendi gizli anahtarı; aynı hesap sınırsız cihazda açılabilir.';

-- ------------------------------------------------------------
-- 2) YARDIMCI: BU İSTEK, HESABIN KAYITLI BİR CİHAZI MI?
-- ------------------------------------------------------------
create or replace function public.is_network_device(p_agent_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  v_token := public.get_request_token();
  if v_token is null or p_agent_id is null then
    return false;
  end if;

  return exists (
    select 1 from public.network_devices d
    where d.agent_id = p_agent_id
      and d.device_secret = v_token
  );
end;
$$;

revoke all on function public.is_network_device(text) from public;
grant execute on function public.is_network_device(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 3) YAZMA İZNİ: PROFİL ANAHTARI **VEYA** KAYITLI CİHAZ
-- ------------------------------------------------------------
create or replace function public.can_write_profile(p_agent_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_token text;
  v_existing text;
begin
  v_token := public.get_request_token();
  if v_token is null then
    return false;
  end if;

  select secret_token into v_existing
  from public.profiles
  where agent_id = p_agent_id;

  if not found then
    return true; -- ilk profil kaydı; trigger token'ı mühürleyecek
  end if;

  -- Geçiş penceresi: eski (anahtarsız) profil ilk yazmada sahiplenilir.
  if v_existing is null or btrim(v_existing) = '' then
    return true;
  end if;

  if v_existing = v_token then
    return true;
  end if;

  -- Çoklu cihaz: bu hesaba kayıtlı herhangi bir cihaz yazabilir.
  return exists (
    select 1 from public.network_devices d
    where d.agent_id = p_agent_id
      and d.device_secret = v_token
  );
end;
$$;

revoke all on function public.can_write_profile(text) from public;
grant execute on function public.can_write_profile(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 4) TRIGGER: KAYITLI CİHAZ ANAHTARINI DA KABUL ET
-- ------------------------------------------------------------
-- 002'deki kurallar aynen korunur; tek ek: hesaba kayıtlı cihaz anahtarı
-- ile de güncelleme yapılabilir. secret_token alanı asla değiştirilmez.
create or replace function public.protect_profile_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  req_token text;
  v_claims text;
  v_role text;
  v_is_device boolean;
begin
  -- SQL Editor / Dashboard isteklerinde JWT claim yoktur; bakım işlemlerine izin ver.
  v_claims := current_setting('request.jwt.claims', true);
  if v_claims is null or v_claims = '' then
    return new;
  end if;

  begin
    v_role := v_claims::json ->> 'role';
  exception when others then
    v_role := '';
  end;

  if v_role = 'service_role' then
    return new;
  end if;

  req_token := public.get_request_token();
  if req_token is null then
    raise exception 'Kimlik doğrulama gerekli: x-agent-token başlığı yok.';
  end if;

  if tg_op = 'INSERT' then
    if new.secret_token is null or btrim(new.secret_token) = '' then
      new.secret_token := req_token;
    end if;
    if new.secret_token is distinct from req_token then
      raise exception 'Güvenlik ihlali: yeni profil başka bir anahtarla oluşturulamaz.';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Eski (anahtarsız) profil: ilk yazmada mevcut cihazın anahtarıyla mühürlenir.
    if old.secret_token is null or btrim(old.secret_token) = '' then
      new.secret_token := req_token;
      return new;
    end if;

    -- 1) Profilin kendi anahtarı (eski davranış)
    if old.secret_token = req_token then
      new.secret_token := old.secret_token;
      return new;
    end if;

    -- 2) Bu hesaba kayıtlı bir cihazın anahtarı (çoklu cihaz)
    select exists (
      select 1 from public.network_devices d
      where d.agent_id = old.agent_id
        and d.device_secret = req_token
    ) into v_is_device;

    if v_is_device then
      new.secret_token := old.secret_token;
      return new;
    end if;

    raise exception 'Güvenlik ihlali: bu profili değiştirme yetkiniz yok.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile
  before insert or update on public.profiles
  for each row execute function public.protect_profile_trigger();

-- ------------------------------------------------------------
-- 5) GİRİŞ: DİĞER CİHAZLARIN OTURUMUNU SİLME
-- ------------------------------------------------------------
-- Eski sürüm, giriş yapıldığında aynı hesabın tüm oturumlarını siliyordu.
-- Artık her cihaz kendi oturumuyla açık kalır.
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

  select agent_id, password_hash, username
  into v_agent_id, v_password_hash, v_username
  from public.network_accounts
  where username_lower = v_username_lower;

  if v_agent_id is null then
    insert into public.login_attempts (username, success)
    values (p_username, false);
    raise exception 'Kullanıcı adı veya şifre hatalı.';
  end if;

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

  insert into public.login_attempts (username, success)
  values (p_username, true);

  -- Süresi dolmuş oturumları temizle (sadece bu hesabın, sadece süresi geçmişler).
  delete from public.network_sessions
  where agent_id = v_agent_id
    and expires_at <= now();

  -- Yeni oturum: diğer cihazların oturumlarına DOKUNULMAZ.
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
-- 6) CİHAZI HESABA BAĞLA: ANAHTARI EZMEZ, CİHAZI KAYDEDER
-- ------------------------------------------------------------
-- Eski sürüm profiles.secret_token'ı bu cihaza çeviriyordu; bu yüzden
-- diğer cihazlar yazamaz hâle geliyordu. Artık yalnızca cihaz kaydı açılır.
create or replace function public.network_claim_device(
  p_session_token text,
  p_password text,
  p_new_secret text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_agent text;
  v_hash text;
  v_match boolean;
  v_exists boolean;
begin
  if p_new_secret is null or length(btrim(p_new_secret)) < 8 then
    raise exception 'Geçersiz cihaz anahtarı.';
  end if;

  select ns.agent_id, na.password_hash
  into v_agent, v_hash
  from public.network_sessions ns
  join public.network_accounts na on na.agent_id = ns.agent_id
  where ns.session_token = p_session_token
    and ns.expires_at > now();

  if v_agent is null then
    raise exception 'Oturum süresi dolmuş veya geçersiz.';
  end if;

  begin
    v_match := (v_hash = crypt(p_password, v_hash));
  exception when others then
    v_match := false;
  end;

  if not v_match then
    raise exception 'Şifre hatalı.';
  end if;

  select exists (
    select 1 from public.network_devices d
    where d.device_secret = p_new_secret
      and d.agent_id = v_agent
  ) into v_exists;

  insert into public.network_devices (device_secret, agent_id)
  values (p_new_secret, v_agent)
  on conflict (device_secret, agent_id) do nothing;

  update public.network_devices
  set last_seen_at = now()
  where device_secret = p_new_secret
    and agent_id = v_agent;

  return not v_exists; -- true: bu cihaz ilk kez kaydedildi
end;
$$;

grant execute on function public.network_claim_device(text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 7) KAYIT: CİHAZI OTOMATİK TANIT
-- ------------------------------------------------------------
-- network_register aynı hesabı mevcut profile bağladığında, kullanılan
-- cihaz anahtarı da otomatik olarak cihaz listesine eklenir.
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
  v_bound_username text;
  v_agent_id text;
  v_recovery_code text;
  v_password_hash text;
  v_session_token text;
  v_expires_at timestamptz;
  v_token text;
  v_profile_token text;
begin
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
  if v_username_lower !~ '^[a-z0-9_]+$' then
    raise exception 'Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir.';
  end if;

  select agent_id into v_existing_agent
  from public.network_accounts
  where username_lower = v_username_lower;

  if v_existing_agent is not null then
    raise exception 'Bu kullanıcı adı zaten alınmış.';
  end if;

  v_password_hash := crypt(p_password, gen_salt('bf'));
  v_token := nullif(btrim(coalesce(p_secret, '')), '');

  if p_agent_id is not null and btrim(p_agent_id) <> '' then
    -- MEVCUT hesabı bağla (kütüphane/geçmiş korunur).
    select secret_token into v_profile_token
    from public.profiles
    where agent_id = btrim(p_agent_id);

    if not found then
      raise exception 'Bu cihazdaki hesap bulunamadı. Manuel destek gerekir.';
    end if;

    if v_profile_token is not null and btrim(v_profile_token) <> ''
       and v_profile_token <> v_token then
      raise exception 'Bu cihazdaki hesap doğrulanamadı. Manuel destek gerekir.';
    end if;

    select username into v_bound_username
    from public.network_accounts
    where agent_id = btrim(p_agent_id);

    if v_bound_username is not null then
      raise exception 'Bu cihazdaki hesap zaten "%" kullanıcı adıyla ağa bağlı.', v_bound_username;
    end if;

    v_agent_id := btrim(p_agent_id);
  else
    -- Cihazda profil yok: yeni profil aç (nadir durum).
    v_agent_id := gen_random_uuid()::text;

    insert into public.profiles (
      agent_id, nickname, level, total_xp, movies_watched,
      past_movies_watched, series_watched, episodes_watched,
      achievements_unlocked, quests_completed,
      currently_watching, showcase, last_seen, last_cloud_sync,
      secret_token
    )
    values (
      v_agent_id, btrim(p_username), 1, 0, 0,
      0, 0, 0,
      0, 0,
      '[]'::jsonb, '[]'::jsonb, now(), 0, v_token
    );
  end if;

  v_recovery_code := public.generate_recovery_code();

  insert into public.network_accounts (username, username_lower, password_hash,
                                       recovery_code, agent_id)
  values (btrim(p_username), v_username_lower, v_password_hash, v_recovery_code, v_agent_id);

  -- Bu cihazı hesabın güvenilir cihazı olarak kaydet.
  if v_token is not null then
    insert into public.network_devices (device_secret, agent_id)
    values (v_token, v_agent_id)
    on conflict (device_secret, agent_id) do nothing;
  end if;

  v_session_token := gen_random_uuid()::text;
  v_expires_at := now() + interval '30 days';

  insert into public.network_sessions (session_token, agent_id, expires_at)
  values (v_session_token, v_agent_id, v_expires_at);

  return jsonb_build_object(
    'agent_id', v_agent_id,
    'username', btrim(p_username),
    'recovery_code', v_recovery_code,
    'session_token', v_session_token,
    'expires_at', to_char(v_expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
end;
$$;

grant execute on function public.network_register(text, text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 8) SESSİZ CİHAZ KAYDI (uygulama açılışında)
-- ------------------------------------------------------------
-- Cihazda geçerli bir ağ oturumu varsa, şifre sormadan cihazı kaydeder.
-- Amaç: 005'ten önce giriş yapmış cihazların da otomatik olarak yazma
-- izni kazanması (yeniden giriş gerekmez).
create or replace function public.network_touch_device(
  p_session_token text,
  p_secret text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_agent text;
  v_exists boolean;
begin
  if p_secret is null or length(btrim(p_secret)) < 8 then
    return false;
  end if;

  select agent_id into v_agent
  from public.network_sessions
  where session_token = p_session_token
    and expires_at > now();

  if v_agent is null then
    return false;
  end if;

  select exists (
    select 1 from public.network_devices d
    where d.device_secret = p_secret
      and d.agent_id = v_agent
  ) into v_exists;

  insert into public.network_devices (device_secret, agent_id)
  values (p_secret, v_agent)
  on conflict (device_secret, agent_id) do nothing;

  update public.network_devices
  set last_seen_at = now()
  where device_secret = p_secret
    and agent_id = v_agent;

  return not v_exists;
end;
$$;

grant execute on function public.network_touch_device(text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 9) SÖZDE SİLME (hesap silinince cihaz kayıtları da gider)
-- ------------------------------------------------------------
-- network_devices.agent_id → profiles(agent_id) ON DELETE CASCADE olduğu
-- için network_delete_account çalıştığında cihazlar kendiliğinden silinir.
-- Ek işlem gerekmez.

notify pgrst, 'reload schema';

commit;

-- ============================================================
-- KONTROL (salt okunur, tek sonuç)
-- ============================================================
select 'network_devices tablosu' as kontrol,
       case when to_regclass('public.network_devices') is not null
            then 'VAR' else 'YOK' end as durum
union all
select 'is_network_device fonksiyonu',
       case when exists (
         select 1 from pg_proc
         where pronamespace = 'public'::regnamespace and proname = 'is_network_device'
       ) then 'VAR' else 'YOK' end
union all
select 'can_write_profile → çoklu cihaz destekli',
       case when pg_get_functiondef('public.can_write_profile(text)'::regprocedure)
                 like '%network_devices%' then 'VAR' else 'YOK' end
union all
select 'trigger → çoklu cihaz destekli',
       case when pg_get_functiondef('public.protect_profile_trigger()'::regprocedure)
                 like '%network_devices%' then 'VAR' else 'YOK' end
union all
select 'network_login → oturum silmiyor',
       case when pg_get_functiondef('public.network_login(text,text)'::regprocedure)
                 like '%delete from public.network_sessions%where agent_id = v_agent_id%and expires_at%'
            then 'VAR' else 'KONTROL ET' end
union all
select 'network_claim_device → cihaz kaydediyor',
       case when pg_get_functiondef('public.network_claim_device(text,text,text)'::regprocedure)
                 like '%insert into public.network_devices%' then 'VAR' else 'YOK' end
union all
select 'network_touch_device → sessiz cihaz kaydı',
       case when exists (
         select 1 from pg_proc
         where pronamespace = 'public'::regnamespace and proname = 'network_touch_device'
       ) then 'VAR' else 'YOK' end;
