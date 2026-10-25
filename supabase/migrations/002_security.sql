-- ============================================================
-- SINEVIA 002 — GÜVENLİK (RLS + KİMLİK KONTROLÜ)
-- ============================================================
-- KURAL: Veri silmez. Sadece kilit takar, policy tanımlar, trigger düzeltir.
-- 001_schema.sql çalıştırıldıktan SONRA uygulanır.
--
-- ÖNEMLİ: Bu dosyadan sonra istemci `profiles` tablosundan `select('*')`
-- YAPMAMALIDIR; secret_token kolonu okunamaz. İstemci kodunda gerekli
-- düzeltmeler yapıldı.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) İSTEK BAŞLIĞINDAN AJAN KİMLİĞİ
-- ------------------------------------------------------------
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

create or replace function public.current_agent_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  -- Header'daki değer agent_id değil, secret_token'dır. Token'ı agent_id'ye çevir.
  select p.agent_id
  from public.profiles p
  where p.secret_token = public.get_request_token()
  limit 1;
$$;

-- Yeni profil oluşturma / mevcut profili değiştirme kontrolü.
-- Profil yoksa (ilk kayıt) izin verir; varsa yalnızca doğru token'ı kabul eder.
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
  -- Bu, mevcut kullanıcıların hiçbir işlem yapmadan devam etmesini sağlar.
  if v_existing is null or btrim(v_existing) = '' then
    return true;
  end if;

  return v_existing = v_token;
end;
$$;

revoke all on function public.get_request_token() from public;
revoke all on function public.current_agent_id() from public;
revoke all on function public.can_write_profile(text) from public;
grant execute on function public.get_request_token() to anon, authenticated;
grant execute on function public.current_agent_id() to anon, authenticated;
grant execute on function public.can_write_profile(text) to anon, authenticated;

-- Grup üyeliği / kuruculuğu: RLS içinde kendi tablosuna tekrar bakıp
-- sonsuz döngüye girmemek için SECURITY DEFINER yardımcıları.
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

-- ------------------------------------------------------------
-- 2) TRIGGER'LAR — BOŞ TOKEN İLE GEÇİŞ YASAK
-- ------------------------------------------------------------
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

    if old.secret_token <> req_token then
      raise exception 'Güvenlik ihlali: bu profili değiştirme yetkiniz yok.';
    end if;

    new.secret_token := old.secret_token;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile
  before insert or update on public.profiles
  for each row execute function public.protect_profile_trigger();

create or replace function public.verify_message_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  req_token text;
  actual_token text;
  v_claims text;
  v_role text;
begin
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
    raise exception 'Kimlik doğrulama gerekli: mesaj göndermek için token gerekli.';
  end if;

  select secret_token into actual_token
  from public.profiles
  where agent_id = new.sender_id;

  -- Eski profilin anahtarı yoksa RLS zaten sender_id = current_agent_id ister.
  if actual_token is not null and btrim(actual_token) <> '' and actual_token <> req_token then
    raise exception 'Güvenlik ihlali: başka bir ajan adına mesaj gönderemezsiniz.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_verify_message_sender on public.messages;
create trigger trg_verify_message_sender
  before insert on public.messages
  for each row execute function public.verify_message_sender();

create or replace function public.verify_group_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  req_token text;
  creator_token text;
  v_claims text;
  v_role text;
begin
  v_claims := current_setting('request.jwt.claims', true);
  if v_claims is null or v_claims = '' then
    return old;
  end if;
  begin
    v_role := v_claims::json ->> 'role';
  exception when others then
    v_role := '';
  end;
  if v_role = 'service_role' then
    return old;
  end if;

  req_token := public.get_request_token();
  if req_token is null then
    raise exception 'Kimlik doğrulama gerekli: grup silmek için token gerekli.';
  end if;

  select secret_token into creator_token
  from public.profiles
  where agent_id = old.created_by;

  if creator_token is not null and btrim(creator_token) <> '' and creator_token <> req_token then
    raise exception 'Güvenlik ihlali: sadece grup kurucusu grubu silebilir.';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_verify_group_deletion on public.chat_groups;
create trigger trg_verify_group_deletion
  before delete on public.chat_groups
  for each row execute function public.verify_group_deletion();

-- ------------------------------------------------------------
-- 3) ESKİ POLICY'LERİ TEMİZLE (veriye dokunmaz)
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'friendships', 'network_logs', 'recommendations',
        'messages', 'chat_groups', 'chat_group_members'
      )
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 4) PROFILES — KOLON YETKİLERİ (secret_token okunamaz)
-- ------------------------------------------------------------
revoke all on table public.profiles from anon, authenticated;

grant select (
  agent_id, nickname, level, total_xp, movies_watched, past_movies_watched,
  series_watched, episodes_watched, achievements_unlocked, quests_completed,
  currently_watching, showcase, last_seen, last_cloud_sync
) on table public.profiles to anon, authenticated;

grant insert (
  agent_id, nickname, level, total_xp, movies_watched, past_movies_watched,
  series_watched, episodes_watched, achievements_unlocked, quests_completed,
  currently_watching, showcase, last_seen, last_cloud_sync
) on table public.profiles to anon, authenticated;

grant update (
  agent_id, nickname, level, total_xp, movies_watched, past_movies_watched,
  series_watched, episodes_watched, achievements_unlocked, quests_completed,
  currently_watching, showcase, last_seen, last_cloud_sync
) on table public.profiles to anon, authenticated;

grant delete on table public.profiles to anon, authenticated;

alter table public.profiles enable row level security;

create policy profiles_select_public
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy profiles_insert_self
  on public.profiles for insert
  to anon, authenticated
  with check (public.can_write_profile(agent_id));

create policy profiles_update_self
  on public.profiles for update
  to anon, authenticated
  using (public.can_write_profile(agent_id))
  with check (public.can_write_profile(agent_id));

create policy profiles_delete_self
  on public.profiles for delete
  to anon, authenticated
  using (public.can_write_profile(agent_id));

-- ------------------------------------------------------------
-- 5) DİĞER TABLOLAR — RLS
-- ------------------------------------------------------------
grant select, insert, update, delete on table public.friendships to anon, authenticated;
grant select, insert, update, delete on table public.network_logs to anon, authenticated;
grant select, insert, update, delete on table public.recommendations to anon, authenticated;
grant select, insert, update, delete on table public.messages to anon, authenticated;
grant select, insert, update, delete on table public.chat_groups to anon, authenticated;
grant select, insert, update, delete on table public.chat_group_members to anon, authenticated;

alter table public.friendships enable row level security;
alter table public.network_logs enable row level security;
alter table public.recommendations enable row level security;
alter table public.messages enable row level security;
alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;

-- FRIENDSHIPS
create policy friendships_select_own
  on public.friendships for select
  to anon, authenticated
  using (requester_id = public.current_agent_id() or receiver_id = public.current_agent_id());

create policy friendships_insert_self
  on public.friendships for insert
  to anon, authenticated
  with check (requester_id = public.current_agent_id());

create policy friendships_update_own
  on public.friendships for update
  to anon, authenticated
  using (receiver_id = public.current_agent_id())
  with check (receiver_id = public.current_agent_id());

create policy friendships_delete_own
  on public.friendships for delete
  to anon, authenticated
  using (requester_id = public.current_agent_id() or receiver_id = public.current_agent_id());

-- NETWORK_LOGS (akış herkese açık okunur; yazma sadece kendi adına)
create policy network_logs_select_public
  on public.network_logs for select
  to anon, authenticated
  using (true);

create policy network_logs_insert_self
  on public.network_logs for insert
  to anon, authenticated
  with check (agent_id = public.current_agent_id());

create policy network_logs_update_self
  on public.network_logs for update
  to anon, authenticated
  using (agent_id = public.current_agent_id())
  with check (agent_id = public.current_agent_id());

create policy network_logs_delete_self
  on public.network_logs for delete
  to anon, authenticated
  using (agent_id = public.current_agent_id());

-- RECOMMENDATIONS
create policy recommendations_select_own
  on public.recommendations for select
  to anon, authenticated
  using (sender_id = public.current_agent_id() or receiver_id = public.current_agent_id());

create policy recommendations_insert_self
  on public.recommendations for insert
  to anon, authenticated
  with check (sender_id = public.current_agent_id());

create policy recommendations_update_own
  on public.recommendations for update
  to anon, authenticated
  using (sender_id = public.current_agent_id() or receiver_id = public.current_agent_id())
  with check (sender_id = public.current_agent_id() or receiver_id = public.current_agent_id());

create policy recommendations_delete_own
  on public.recommendations for delete
  to anon, authenticated
  using (sender_id = public.current_agent_id() or receiver_id = public.current_agent_id());

-- MESSAGES
create policy messages_select_own
  on public.messages for select
  to anon, authenticated
  using (
    sender_id = public.current_agent_id()
    or receiver_id = public.current_agent_id()
    or (group_id is not null and public.is_group_member(group_id, public.current_agent_id()))
  );

create policy messages_insert_own
  on public.messages for insert
  to anon, authenticated
  with check (
    sender_id = public.current_agent_id()
    and (
      receiver_id is not null
      or (group_id is not null and public.is_group_member(group_id, public.current_agent_id()))
    )
  );

create policy messages_update_own
  on public.messages for update
  to anon, authenticated
  using (receiver_id = public.current_agent_id())
  with check (receiver_id = public.current_agent_id());

create policy messages_delete_own
  on public.messages for delete
  to anon, authenticated
  using (sender_id = public.current_agent_id() or receiver_id = public.current_agent_id());

-- CHAT_GROUPS
create policy chat_groups_select_member
  on public.chat_groups for select
  to anon, authenticated
  using (
    created_by = public.current_agent_id()
    or public.is_group_member(id, public.current_agent_id())
  );

create policy chat_groups_insert_self
  on public.chat_groups for insert
  to anon, authenticated
  with check (created_by = public.current_agent_id());

create policy chat_groups_update_creator
  on public.chat_groups for update
  to anon, authenticated
  using (created_by = public.current_agent_id())
  with check (created_by = public.current_agent_id());

create policy chat_groups_delete_creator
  on public.chat_groups for delete
  to anon, authenticated
  using (created_by = public.current_agent_id());

-- CHAT_GROUP_MEMBERS
create policy chat_group_members_select_member
  on public.chat_group_members for select
  to anon, authenticated
  using (
    agent_id = public.current_agent_id()
    or public.is_group_member(group_id, public.current_agent_id())
  );

-- Kurucu veya mevcut bir grup üyesi yeni üye ekleyebilir (UI tüm üyelere
-- "Ajan Ekle" gösteriyor). `agent_id = current_agent_id()` tek başına
-- KULLANILMAZ; yoksa grup dışındaki biri kendini gruba ekleyebilir.
create policy chat_group_members_insert_by_member
  on public.chat_group_members for insert
  to anon, authenticated
  with check (
    public.is_group_creator(group_id, public.current_agent_id())
    or public.is_group_member(group_id, public.current_agent_id())
  );

create policy chat_group_members_delete_self_or_creator
  on public.chat_group_members for delete
  to anon, authenticated
  using (
    agent_id = public.current_agent_id()
    or public.is_group_creator(group_id, public.current_agent_id())
  );

-- ------------------------------------------------------------
-- 6) REALTIME: profiles yayınından çıkar (secret_token sızmasın)
-- ------------------------------------------------------------
-- Uygulama artık bulut durumunu 60 saniyede bir yokluyor; profiles realtime'a
-- ihtiyaç yok. Profil satırı realtime ile yayınlanırsa token kolonu da
-- istemcilere gidebilir. Bu yüzden tabloyu yayından çıkarıyoruz.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime drop table public.profiles';
    exception when others then
      null; -- tablo zaten yayında değilse sorun değil
    end;
  end if;
end $$;

-- ------------------------------------------------------------
-- 7) STORAGE NOTU
-- ------------------------------------------------------------
-- sinevia_saves bucket'ı bu adımda PRIVATE YAPILMAZ.
-- Sebep: mevcut istemci getPublicUrl ile okuyor; private'a geçmek yedekleri
-- anında bozar. Önce istemcide imzalı URL / Edge Function desteği eklenmeli.
-- Bucket policy'si eski haliyle kalıyor; Faz 2'de kapatılacak.

commit;
