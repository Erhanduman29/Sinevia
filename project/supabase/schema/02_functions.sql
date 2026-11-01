-- ============================================================================
-- SINEVIA V3 — KANONİK ŞEMA / 02 FONKSİYONLAR
-- ============================================================================
-- KAYNAK: migrations 002, 003, 004, 005, 006, 007, 008, 009 + private snippet
--         01, 06, 07, 08, 11, 14. Tekrarlanan fonksiyonların YALNIZCA EN SON
--         sürümü burada tek kez tanımlanır:
--           * current_agent_id / can_write_profile  -> 007 (oturum + cihaz)
--           * protect_profile_trigger               -> 005 (+ cihaz anahtarı)
--           * verify_message_sender / verify_group_deletion -> 009 (current_agent_id)
--           * network_register                      -> 005 (cihaz kaydı)
--           * network_login                         -> 005 (oturumu silmez)
--           * network_claim_device                  -> 005 (anahtarı EZMEZ)
--
-- BU DOSYA NE YAPMAZ?
--   * DROP TABLE / TRUNCATE / DROP ... CASCADE yok.
--   * GRANT ALL yok; her fonksiyon revoke + açık execute ile tanımlanır.
--   * Tek "drop function": yalnızca çakışan eski imza
--     public.network_register(text, text). (Veriye dokunmaz.)
--
-- DELETE HAKKINDA: `delete from ...` YALNIZCA iki hesap-silme RPC'sinin
--   (sinevia_delete_account / network_delete_account) içinde geçer. Bunlar
--   security definer'dır, kullanıcı şifresini/anahtarını doğrular ve yalnızca
--   o ajanın kendi satırlarını siler. Şema kurulumu hiçbir veriyi silmez.
--
-- TRANSACTION: begin/commit içermez (schema.sql bloğu içinde çalışır).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0) KİMLİK ÇÖZÜCÜLERİ
-- ----------------------------------------------------------------------------

-- x-agent-token başlığı (cihazın gizli anahtarı). agent_id DEĞİLDİR.
create or replace function public.get_request_token()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text;
begin
  begin
    v := current_setting('request.headers', true)::json ->> 'x-agent-token';
  exception when others then
    v := null;
  end;
  return nullif(btrim(coalesce(v, '')), '');
end;
$$;

revoke all on function public.get_request_token() from public;
grant execute on function public.get_request_token() to anon, authenticated;


-- x-network-session başlığı (aktif ağ oturumu). Çoklu hesap desteği sağlar.
create or replace function public.get_request_session()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text;
begin
  begin
    v := current_setting('request.headers', true)::json ->> 'x-network-session';
  exception when others then
    v := null;
  end;
  return nullif(btrim(coalesce(v, '')), '');
end;
$$;

revoke all on function public.get_request_session() from public;
grant execute on function public.get_request_session() to anon, authenticated;


-- Aktif hesabı çöz: a) ağ oturumu  b) profilin anahtarı  c) cihaza kayıtlı tek hesap
create or replace function public.current_agent_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  with req as (
    select
      public.get_request_token()   as device_token,
      public.get_request_session() as session_token
  )
  select coalesce(
    -- a) Aktif ağ oturumu: çoklu hesapta hangi hesap açıksa o kazanır.
    (select s.agent_id
       from public.network_sessions s, req
      where req.session_token is not null
        and s.session_token = req.session_token
        and s.expires_at > now()
      limit 1),

    -- b) Profilin kendi gizli anahtarı (birincil cihaz / eski kayıtlar).
    (select p.agent_id
       from public.profiles p, req
      where req.device_token is not null
        and p.secret_token = req.device_token
      limit 1),

    -- c) Bu cihaza kayıtlı ve TEK olan hesap (oturum yoksa geriye dönük uyum).
    (select d.agent_id
       from public.network_devices d, req
      where req.device_token is not null
        and d.device_secret = req.device_token
        and (select count(*)
               from public.network_devices d2
              where d2.device_secret = req.device_token) = 1
      limit 1)
  );
$$;

revoke all on function public.current_agent_id() from public;
grant execute on function public.current_agent_id() to anon, authenticated;


-- Bu istek, hesabın kayıtlı bir cihazı mı?
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


-- Yazma izni: aktif kimlik VEYA profil anahtarı VEYA kayıtlı cihaz anahtarı.
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
  if p_agent_id is null then
    return false;
  end if;

  -- Oturum/cihaz üzerinden çözülen aktif hesap her zaman yazabilir.
  if public.current_agent_id() = p_agent_id then
    return true;
  end if;

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

comment on function public.can_write_profile(text) is
  'Profil yazma izni: aktif oturum/cihaz kimliği, profil anahtarı veya hesaba kayıtlı cihaz anahtarı.';


-- RLS içinde kendi tablosuna tekrar bakıp sonsuz döngüye girmemek için
-- SECURITY DEFINER + row_security = off yardımcıları.
create or replace function public.is_group_member(p_group_id text, p_agent_id text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.chat_group_members
    where group_id = p_group_id and agent_id = p_agent_id
  );
$$;

create or replace function public.is_group_creator(p_group_id text, p_agent_id text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.chat_groups
    where id = p_group_id and created_by = p_agent_id
  );
$$;

revoke all on function public.is_group_member(text, text) from public;
revoke all on function public.is_group_creator(text, text) from public;
grant execute on function public.is_group_member(text, text) to anon, authenticated;
grant execute on function public.is_group_creator(text, text) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 1) TRIGGER FONKSİYONLARI
-- ----------------------------------------------------------------------------

-- Profil sahipliği: secret_token mühürlenir, başka anahtar yazamaz.
-- Kayıtlı cihaz anahtarı da kabul edilir; secret_token asla değiştirilmez.
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


-- Mesaj göndereninin kimliği: current_agent_id() üzerinden (009).
create or replace function public.verify_message_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims text;
  v_role text;
  v_actor text;
begin
  v_claims := current_setting('request.jwt.claims', true);
  if v_claims is not null and v_claims <> '' then
    begin
      v_role := v_claims::json ->> 'role';
    exception when others then
      v_role := '';
    end;
    if v_role = 'service_role' then
      return new;
    end if;
  end if;

  v_actor := public.current_agent_id();
  if v_actor is not null and v_actor <> new.sender_id then
    raise exception 'Güvenlik ihlali: başka bir ajan adına mesaj gönderemezsiniz.';
  end if;

  return new;
end;
$$;


-- Grubu yalnızca gerçek kurucusu silebilir (009).
create or replace function public.verify_group_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims text;
  v_role text;
  v_actor text;
begin
  v_claims := current_setting('request.jwt.claims', true);
  if v_claims is not null and v_claims <> '' then
    begin
      v_role := v_claims::json ->> 'role';
    exception when others then
      v_role := '';
    end;
    if v_role = 'service_role' then
      return old;
    end if;
  end if;

  v_actor := public.current_agent_id();
  if v_actor is not null and v_actor <> old.created_by then
    raise exception 'Güvenlik ihlali: sadece grup kurucusu grubu silebilir.';
  end if;

  return old;
end;
$$;


-- ----------------------------------------------------------------------------
-- 2) AĞ HESABI RPC'LERİ
-- ----------------------------------------------------------------------------

-- Rastgele kurtarma kodu üretir (8 karakter, karışmayan büyük harf + rakam).
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

revoke all on function public.generate_recovery_code() from public;
grant execute on function public.generate_recovery_code() to anon, authenticated;


-- Eski 2 parametreli imza kalırsa Postgres iki ayrı fonksiyon tutar;
-- karışıklık olmaması için yalnızca o çakışan imza kaldırılır. Veri silinmez.
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
    -- MEVCUT hesabı bağla (kütüphane/geçmiş/XP korunur; ikinci boş profil açılmaz).
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

revoke all on function public.network_register(text, text, text, text) from public;
grant execute on function public.network_register(text, text, text, text) to anon, authenticated;


-- Giriş: diğer cihazların oturumları SİLİNMEZ; yalnızca süresi geçmişler temizlenir.
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

revoke all on function public.network_login(text, text) from public;
grant execute on function public.network_login(text, text) to anon, authenticated;


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

revoke all on function public.network_logout(text) from public;
grant execute on function public.network_logout(text) to anon, authenticated;


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

revoke all on function public.network_get_me(text) from public;
grant execute on function public.network_get_me(text) to anon, authenticated;


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

revoke all on function public.network_change_password(text, text, text) from public;
grant execute on function public.network_change_password(text, text, text) to anon, authenticated;


-- Cihazı hesaba bağla: profilin anahtarını EZMEZ, cihazı kaydeder (005).
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

revoke all on function public.network_claim_device(text, text, text) from public;
grant execute on function public.network_claim_device(text, text, text) to anon, authenticated;


-- Sessiz cihaz kaydı (uygulama açılışında; şifre sormaz, oturum ister).
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

revoke all on function public.network_touch_device(text, text) from public;
grant execute on function public.network_touch_device(text, text) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 3) HESAP SİLME (kullanıcı isteğiyle, kimlik doğrulamalı)
-- ----------------------------------------------------------------------------
-- Snippet 11, sinevia_delete_account'ın eski bir kopyasıydı; burada tek
-- fonksiyonda birleştirildi (V3: app_saves satırı da silinir).

create or replace function public.sinevia_delete_account(p_agent_id text, p_secret text)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_token text;
begin
  if p_agent_id is null or btrim(p_agent_id) = '' then
    raise exception 'unauthorized';
  end if;
  if p_secret is null or btrim(p_secret) = '' then
    raise exception 'unauthorized';
  end if;

  select secret_token into v_token
  from public.profiles
  where agent_id = p_agent_id;

  if v_token is null or btrim(v_token) = '' or v_token <> p_secret then
    raise exception 'unauthorized';
  end if;

  -- Kullanıcının kurduğu grupların mesajları (receiver_id NULL olduğu için
  -- aşağıdaki bireysel mesaj adımı bunları kapsamaz).
  delete from public.messages
  where group_id in (
    select id from public.chat_groups where created_by = p_agent_id
  );

  delete from public.messages
  where sender_id = p_agent_id or receiver_id = p_agent_id;

  delete from public.recommendations
  where sender_id = p_agent_id or receiver_id = p_agent_id;

  delete from public.friendships
  where requester_id = p_agent_id or receiver_id = p_agent_id;

  delete from public.chat_group_members
  where group_id in (select id from public.chat_groups where created_by = p_agent_id);
  delete from public.chat_group_members
  where agent_id = p_agent_id;

  delete from public.chat_groups
  where created_by = p_agent_id;

  delete from public.network_logs
  where agent_id = p_agent_id;

  -- V3 bulut kaydı (FK yok; açıkça temizlenir).
  delete from public.app_saves
  where agent_id = p_agent_id;

  delete from public.profiles
  where agent_id = p_agent_id;

  -- Bulut arşivi (varsa)
  delete from storage.objects
  where bucket_id = 'sinevia_saves' and name = p_agent_id || '.json';
end;
$$;

revoke all on function public.sinevia_delete_account(text, text) from public;
grant execute on function public.sinevia_delete_account(text, text) to anon, authenticated;

comment on function public.sinevia_delete_account(text, text) is
  'Kullanıcı hesabını ve ona bağlı ağ verilerini siler. Sadece doğru secret_token ile çalışır.';


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

  begin
    v_match := (v_password_hash = crypt(p_password, v_password_hash));
  exception when others then
    v_match := false;
  end;

  if not v_match then
    raise exception 'Şifre hatalı.';
  end if;

  select secret_token into v_token
  from public.profiles
  where agent_id = v_agent_id;

  if v_token is null or btrim(v_token) = '' then
    raise exception 'Bu profil için güvenlik anahtarı bulunamadı.';
  end if;

  delete from public.network_sessions
  where session_token = p_session_token;

  delete from public.network_accounts
  where agent_id = v_agent_id;

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

  -- V3 bulut kaydı (FK yok; açıkça temizlenir).
  delete from public.app_saves
  where agent_id = v_agent_id;

  delete from public.profiles
  where agent_id = v_agent_id;

  delete from storage.objects
  where bucket_id = 'sinevia_saves' and name = v_agent_id || '.json';
end;
$$;

revoke all on function public.network_delete_account(text, text) from public;
grant execute on function public.network_delete_account(text, text) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 4) WEB PUSH FONKSİYONLARI
-- ----------------------------------------------------------------------------

-- INSERT olaylarını Edge Function'a iletir (pg_net, asenkron).
-- Hata olsa bile asıl INSERT'i bozmaz.
create or replace function public.push_dispatch_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_secret text;
  v_endpoint text;
  v_body jsonb;
begin
  select secret, endpoint into v_secret, v_endpoint
  from public.push_webhook_config
  where id = true;

  if v_endpoint is null or v_secret is null then
    return new;
  end if;

  if tg_table_name = 'messages' then
    if new.receiver_id is null then
      return new;
    end if;
    v_body := jsonb_build_object(
      'table', 'messages',
      'record', jsonb_build_object(
        'id', new.id,
        'sender_id', new.sender_id,
        'receiver_id', new.receiver_id,
        'content', left(coalesce(new.content, ''), 200),
        'created_at', new.created_at
      )
    );
  elsif tg_table_name = 'friendships' then
    if new.receiver_id is null or new.status is distinct from 'pending' then
      return new;
    end if;
    v_body := jsonb_build_object(
      'table', 'friendships',
      'record', jsonb_build_object(
        'id', new.id,
        'requester_id', new.requester_id,
        'receiver_id', new.receiver_id,
        'status', new.status,
        'created_at', new.created_at
      )
    );
  elsif tg_table_name = 'recommendations' then
    if new.receiver_id is null then
      return new;
    end if;
    v_body := jsonb_build_object(
      'table', 'recommendations',
      'record', jsonb_build_object(
        'id', new.id,
        'sender_id', new.sender_id,
        'receiver_id', new.receiver_id,
        'list_title', new.list_title,
        'created_at', new.created_at
      )
    );
  else
    return new;
  end if;

  -- pg_net bazı projelerde `net`, bazılarında `extensions` şemasında olabilir.
  begin
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'net' and p.proname = 'http_post'
    ) then
      perform net.http_post(
        url := v_endpoint,
        body := v_body,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', v_secret
        )
      );
    elsif exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'extensions' and p.proname = 'http_post'
    ) then
      perform extensions.http_post(
        url := v_endpoint,
        body := v_body,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', v_secret
        )
      );
    else
      raise warning 'pg_net bulunamadı; push webhook atlandı (Database > Extensions bölümünden etkinleştirin).';
    end if;
  exception when others then
    raise warning 'push webhook gönderilemedi: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.push_dispatch_webhook() from public;
revoke all on function public.push_dispatch_webhook() from anon, authenticated;


-- Teşhis: pg_net şeması, trigger sayısı, abonelik/tercih durumu.
create or replace function public.push_pipeline_status()
returns jsonb
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_net_schema text;
  v_triggers int;
  v_responses jsonb := '[]'::jsonb;
  v_agent text;
  v_subs int := 0;
  v_prefs boolean := false;
begin
  select n.nspname into v_net_schema
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'http_post' and n.nspname in ('net', 'extensions')
  limit 1;

  select count(*) into v_triggers
  from pg_trigger
  where tgname in (
    'messages_push_webhook',
    'friendships_push_webhook',
    'recommendations_push_webhook'
  );

  -- Son 5 webhook yanıtı (yalnızca durum bilgisi; içerik kısaltılır).
  if to_regclass('net._http_response') is not null then
    execute $q$
      select coalesce(jsonb_agg(x order by x.created desc), '[]'::jsonb)
      from (
        select status_code,
               error_msg,
               timed_out,
               created,
               left(coalesce(content, ''), 200) as body_preview
        from net._http_response
        order by created desc
        limit 5
      ) x
    $q$ into v_responses;
  end if;

  v_agent := public.current_agent_id();
  if v_agent is not null then
    select count(*) into v_subs from public.push_subscriptions where agent_id = v_agent;
    select exists(
      select 1 from public.network_notification_prefs where agent_id = v_agent
    ) into v_prefs;
  end if;

  return jsonb_build_object(
    'pg_net_schema', v_net_schema,
    'triggers', v_triggers,
    'webhook_configured', exists(select 1 from public.push_webhook_config),
    'agent_id', v_agent,
    'subscriptions', v_subs,
    'prefs_row', v_prefs,
    'recent_responses', v_responses
  );
exception when others then
  return jsonb_build_object('error', sqlerrm);
end;
$$;

revoke all on function public.push_pipeline_status() from public;
grant execute on function public.push_pipeline_status() to anon, authenticated;


-- Uçtan uca test: yalnızca oturum sahibinin kendi cihazlarına push isteği.
create or replace function public.push_self_test()
returns jsonb
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_secret text;
  v_endpoint text;
  v_agent text;
  v_request_id bigint;
  v_body jsonb;
begin
  v_agent := public.current_agent_id();
  if v_agent is null then
    return jsonb_build_object('ok', false, 'reason', 'no_identity');
  end if;

  select secret, endpoint into v_secret, v_endpoint
  from public.push_webhook_config
  where id = true;

  if v_secret is null or v_endpoint is null then
    return jsonb_build_object('ok', false, 'reason', 'no_config');
  end if;

  v_body := jsonb_build_object(
    'table', 'self_test',
    'record', jsonb_build_object('receiver_id', v_agent)
  );

  begin
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'net' and p.proname = 'http_post'
    ) then
      select net.http_post(
        url := v_endpoint,
        body := v_body,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', v_secret
        )
      ) into v_request_id;
    elsif exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'extensions' and p.proname = 'http_post'
    ) then
      select extensions.http_post(
        url := v_endpoint,
        body := v_body,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', v_secret
        )
      ) into v_request_id;
    else
      return jsonb_build_object('ok', false, 'reason', 'pg_net_missing');
    end if;
  exception when others then
    return jsonb_build_object('ok', false, 'reason', 'dispatch_failed', 'detail', sqlerrm);
  end;

  return jsonb_build_object('ok', true, 'request_id', v_request_id);
end;
$$;

revoke all on function public.push_self_test() from public;
grant execute on function public.push_self_test() to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 5) SENKRON RPC'LERİ (V3 — sözleşme: docs/sync-contract.md §4)
-- ----------------------------------------------------------------------------

-- Bulut kaydını döner. Kayıt yoksa NULL döner (jsonb karşılığı "boş küme").
create or replace function public.sync_get_state(p_agent_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_agent text := btrim(coalesce(p_agent_id, ''));
  v_actor text;
  v_revision bigint;
  v_save_hash text;
  v_payload jsonb;
  v_updated_at timestamptz;
begin
  if v_agent = '' then
    raise exception 'sync_get_state: p_agent_id zorunlu.';
  end if;

  -- Kimlik çözülebiliyorsa sahiplik doğrulanır (başkasının kaydı okunamaz).
  v_actor := public.current_agent_id();
  if v_actor is not null and v_actor <> v_agent then
    raise exception 'sync_get_state: bu kayıt başka bir ajana ait.';
  end if;

  select s.revision, s.save_hash, s.payload, s.updated_at
  into v_revision, v_save_hash, v_payload, v_updated_at
  from public.app_saves s
  where s.agent_id = v_agent;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'revision', v_revision,
    'save_hash', v_save_hash,
    'payload', v_payload,
    'updated_at', to_char(v_updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

revoke all on function public.sync_get_state(text) from public;
grant execute on function public.sync_get_state(text) to anon, authenticated;

comment on function public.sync_get_state(text) is
  'V3 bulut kaydını döner: revision, save_hash, payload, updated_at. Kayıt yoksa NULL.';


-- Atomik commit:
--   * Satır FOR UPDATE ile kilitlenir.
--   * Satır yoksa YALNIZCA base_revision = 0 kabul edilir ve revision = 1 insert.
--   * Satır varsa base_revision = mevcut revision ise revision + 1 yazılır.
--   * Aksi halde {status:'conflict', revision: mevcut} döner (yazma YOK).
--   * Başarıda profiles özeti AYNI transaction'da payload'dan güncellenir.
create or replace function public.sync_commit(
  p_agent_id text,
  p_base_revision bigint,
  p_device_id text,
  p_save_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent text := btrim(coalesce(p_agent_id, ''));
  v_actor text;
  v_revision bigint;
  v_next bigint;
  v_now timestamptz := now();
  v_total_xp numeric := 0;
  v_level integer;
  v_movies integer := 0;
  v_past_movies integer := 0;
  v_series integer := 0;
  v_episodes integer := 0;
  v_achievements integer := 0;
  v_quests integer := 0;
begin
  -- 1) Girdi doğrulama ------------------------------------------------
  if v_agent = '' then
    raise exception 'sync_commit: p_agent_id zorunlu.';
  end if;
  if p_base_revision is null or p_base_revision < 0 then
    raise exception 'sync_commit: p_base_revision 0 veya daha büyük olmalı.';
  end if;
  if p_save_hash is null or btrim(p_save_hash) = '' then
    raise exception 'sync_commit: p_save_hash zorunlu.';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'sync_commit: p_payload JSON nesnesi olmalı.';
  end if;

  -- 2) Sahiplik: kimlik çözülebiliyorsa kayıt sahibiyle eşleşmeli ------
  v_actor := public.current_agent_id();
  if v_actor is not null and v_actor <> v_agent then
    raise exception 'sync_commit: bu kayıt başka bir ajana ait (yetkisiz).';
  end if;

  -- 3) profiles özetini payload'dan türet (aynı transaction'da yazılır) --
  --    total_xp: payload.totalXp (sayı ise) yoksa xpEvents.amount toplamı.
  if jsonb_typeof(p_payload->'totalXp') = 'number' then
    v_total_xp := (p_payload->>'totalXp')::numeric;
  elsif jsonb_typeof(p_payload->'xpEvents') = 'array' then
    select coalesce(sum(
             case when jsonb_typeof(x->'amount') = 'number'
                  then (x->>'amount')::numeric
                  else 0 end
           ), 0)
    into v_total_xp
    from jsonb_array_elements(p_payload->'xpEvents') x;
  else
    v_total_xp := 0;
  end if;
  v_total_xp := greatest(0, round(v_total_xp));

  -- level: payload.level (sayı ise). Yoksa mevcut level korunur.
  -- AppStateV3 has NO level field: level is DERIVED from total XP with the
  -- same arithmetic as src/lib/xp.ts (L2 = 250, each next level +25).
  -- cumulative(L) = 12.5*L^2 + 212.5*L - 225  =>  closed form below.
  v_level := greatest(1, floor(
    (-212.5 + sqrt(45156.25 + 50 * (225 + v_total_xp))) / 25
  )::integer);

  -- movies: watched = true; isPastWatch = true olanlar "önceki film".
  if jsonb_typeof(p_payload->'movies') = 'array' then
    select
      count(*) filter (
        where lower(coalesce(m->>'watched', 'false')) in ('true', '1')
          and lower(coalesce(m->>'isPastWatch', 'false')) not in ('true', '1')
      ),
      count(*) filter (
        where lower(coalesce(m->>'watched', 'false')) in ('true', '1')
          and lower(coalesce(m->>'isPastWatch', 'false')) in ('true', '1')
      )
    into v_movies, v_past_movies
    from jsonb_array_elements(p_payload->'movies') m;
  end if;

  -- series: tüm bölümleri izlenmiş diziler + toplam izlenen bölüm.
  -- (episodes dizisi boş/eksik olan dizi "tamamlanmış" sayılmaz.)
  if jsonb_typeof(p_payload->'series') = 'array' then
    with s as (
      select s2.value as item, s2.ordinality as idx
      from jsonb_array_elements(p_payload->'series') with ordinality as s2(value, ordinality)
    ),
    e as (
      select s.idx,
             count(ep)::integer as total,
             count(ep) filter (
               where lower(coalesce(ep->>'watched', 'false')) in ('true', '1')
             )::integer as watched
      from s
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(s.item->'episodes') = 'array'
             then s.item->'episodes'
             else '[]'::jsonb end
      ) ep
      group by s.idx
    )
    select
      coalesce(count(*) filter (where e.total > 0 and e.watched = e.total), 0),
      coalesce(sum(e.watched), 0)
    into v_series, v_episodes
    from e;
  end if;

  -- achievements: açılan kademe sayısı (unlockedTiers uzunlukları toplamı).
  if jsonb_typeof(p_payload->'achievements') = 'array' then
    select coalesce(sum(
             case when jsonb_typeof(a->'unlockedTiers') = 'array'
                  then jsonb_array_length(a->'unlockedTiers')
                  else 0 end
           ), 0)
    into v_achievements
    from jsonb_array_elements(p_payload->'achievements') a;
  end if;

  -- quests: completedQuests uzunluğu (XP kaynağı DEĞİL, yalnız sayaç).
  if jsonb_typeof(p_payload->'quests'->'completedQuests') = 'array' then
    v_quests := jsonb_array_length(p_payload->'quests'->'completedQuests');
  end if;

  -- 4) Satırı kilitle ve revizyon kuralını uygula -----------------------
  select s.revision into v_revision
  from public.app_saves s
  where s.agent_id = v_agent
  for update;

  if not found then
    -- Kayıt yok: yalnızca base_revision = 0 kabul edilir (yarış koşulu yok).
    if p_base_revision <> 0 then
      return jsonb_build_object(
        'status', 'conflict',
        'revision', 0,
        'reason', 'no-record'
      );
    end if;

    v_next := 1;

    insert into public.app_saves (agent_id, revision, save_hash, payload, device_id, updated_at)
    values (v_agent, v_next, btrim(p_save_hash), p_payload, nullif(btrim(coalesce(p_device_id, '')), ''), v_now)
    on conflict (agent_id) do nothing;

    if not found then
      -- Aynı anda başka bir commit satırı oluşturdu: çakışma döndür.
      select s.revision into v_revision
      from public.app_saves s
      where s.agent_id = v_agent;

      return jsonb_build_object(
        'status', 'conflict',
        'revision', coalesce(v_revision, 0),
        'reason', 'race'
      );
    end if;
  else
    if p_base_revision <> v_revision then
      return jsonb_build_object(
        'status', 'conflict',
        'revision', v_revision,
        'reason', 'revision-mismatch'
      );
    end if;

    v_next := v_revision + 1;

    update public.app_saves s
    set revision = v_next,
        save_hash = btrim(p_save_hash),
        payload = p_payload,
        device_id = nullif(btrim(coalesce(p_device_id, '')), ''),
        updated_at = v_now
    where s.agent_id = v_agent;
  end if;

  -- 5) profiles özeti (YALNIZCA var olan satır güncellenir; yeni satır
  --    OLUŞTURULMAZ). Sayaçlar asla aşağı yazılmaz: en büyük değer korunur.
  update public.profiles p
  set total_xp = v_total_xp::integer,
      level = coalesce(v_level, 1),
      movies_watched = greatest(p.movies_watched, v_movies),
      past_movies_watched = greatest(p.past_movies_watched, v_past_movies),
      series_watched = greatest(p.series_watched, v_series),
      episodes_watched = greatest(p.episodes_watched, v_episodes),
      achievements_unlocked = greatest(p.achievements_unlocked, v_achievements),
      quests_completed = greatest(p.quests_completed, v_quests),
      last_seen = v_now
  where p.agent_id = v_agent;

  -- 6) Başarı yanıtı ----------------------------------------------------
  return jsonb_build_object(
    'status', 'ok',
    'revision', v_next,
    'save_hash', btrim(p_save_hash),
    'updated_at', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

revoke all on function public.sync_commit(text, bigint, text, text, jsonb) from public;
grant execute on function public.sync_commit(text, bigint, text, text, jsonb) to anon, authenticated;

comment on function public.sync_commit(text, bigint, text, text, jsonb) is
  'Atomik V3 commit: FOR UPDATE kilidi, base_revision eşleşme şartı, conflict yanıtı ve profiles özet güncellemesi.';
