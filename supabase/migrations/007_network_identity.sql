-- ============================================================
-- SINEVIA 007 — AĞ KİMLİĞİ (ÇOKLU CİHAZ + ÇOKLU HESAP)
-- ============================================================
-- SORUN
--   002'de `current_agent_id()` yalnızca `profiles.secret_token` ile
--   eşleşen anahtarı tanıyordu. 005 ile ikinci cihaz `network_devices`
--   tablosuna kaydediliyor ama `current_agent_id()` hâlâ eski mantıkta
--   kaldığı için:
--     - friendships / messages / recommendations okumaları BOŞ dönüyor,
--     - aynı cihazdaki ikinci hesap hiç görünmüyor,
--     - ikinci cihazdan atılan mesaj/arkadaşlık/paylaşım yazılamıyordu.
--   (Profil/kitap arşivi `can_write_profile` sayesinde çalışıyordu;
--    bu yüzden "kütüphane geldi ama arkadaşlar gelmedi" görülüyordu.)
--
-- ÇÖZÜM
--   1) İstemci her istekte `x-network-session` başlığını gönderir.
--   2) `current_agent_id()` sırayla çözer:
--        a) aktif ağ oturumu  → hangi hesap açıksa o (çoklu hesap)
--        b) profilin kendi anahtarı → birincil cihaz
--        c) bu cihaza kayıtlı TEK hesap → oturum yoksa geriye dönük uyum
--   3) `can_write_profile()` de aynı kimliği kabul eder.
--
-- KURAL: Veri silmez. Idempotent, tekrar çalıştırılabilir.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) İSTEK BAŞLIĞINDAN OTURUM TOKEN'I
-- ------------------------------------------------------------
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

-- Token aramaları için indeks (varsa atlanır).
create index if not exists idx_profiles_secret_token
  on public.profiles (secret_token)
  where secret_token is not null;

-- ------------------------------------------------------------
-- 2) AKTİF HESABI ÇÖZ: OTURUM → PROFİL ANAHTARI → CİHAZ
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 3) YAZMA İZNİ: OKUMA KİMLİĞİYLE AYNI KURAL
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

commit;

-- ------------------------------------------------------------
-- KONTROL
-- ------------------------------------------------------------
select
  'x-network-session okuyucusu' as kontrol,
  case when to_regprocedure('public.get_request_session()') is not null
       then 'VAR' else 'YOK' end as durum
union all
select
  'current_agent_id oturum destekli',
  case when pg_get_functiondef('public.current_agent_id()'::regprocedure)
            like '%network_sessions%' then 'VAR' else 'YOK' end
union all
select
  'current_agent_id cihaz destekli',
  case when pg_get_functiondef('public.current_agent_id()'::regprocedure)
            like '%network_devices%' then 'VAR' else 'YOK' end
union all
select
  'can_write_profile oturum destekli',
  case when pg_get_functiondef('public.can_write_profile(text)'::regprocedure)
            like '%current_agent_id()%' then 'VAR' else 'YOK' end;
