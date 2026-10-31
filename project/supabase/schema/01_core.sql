-- ============================================================================
-- SINEVIA V3 — KANONİK ŞEMA / 01 CORE (TABLOLAR + KISITLAR + INDEX'LER)
-- ============================================================================
-- KAYNAK: project/supabase/migrations/001_schema.sql + 004_network_auth.sql +
--         005_coklu_cihaz.sql + 006_web_push.sql + 007_network_identity.sql +
--         010_push_public_key.sql  (en son sürümler, tek kez)
--         + private snippet 01/02/03/06/07/08/09/10/14 (hepsi eski kopyalar,
--           çakışan sürümlerin EN SON olanı alındı)
--
-- BU DOSYA NE YAPAR?
--   Mevcut tüm tabloları, kolonları, kısıtları ve index'leri kanonik hâlde
--   yeniden tanımlar. Tekrar tekrar çalıştırılabilir (idempotent).
--
-- BU DOSYA NE YAPMAZ?
--   * DROP TABLE / TRUNCATE / DELETE / DROP ... CASCADE yok.
--   * DISABLE ROW LEVEL SECURITY yok.
--   * GRANT ALL yok (yetkiler 03_security.sql'de açık listelenir).
--   * ALTER COLUMN TYPE yok (yalnızca "add column if not exists" ve
--     "drop not null" gibi geriye dönük uyumlu değişiklikler).
--   * FK'ler mevcut davranışı korur (on delete cascade yalnızca FK kısıtıdır;
--     kullanıcı silme akışının parçasıdır, şema silmez).
--
-- TRANSACTION: Bu dosya tek başına begin/commit İÇERMEZ. `schema.sql`
--   içinde begin; ... commit; bloğu içinde çalışır. Tek başına çalıştırmak
--   isterseniz etrafına kendi begin/commit'inizi koyun.
--
-- SIRA: 01_core.sql -> 02_functions.sql -> 03_security.sql
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0) UZANTILAR VE ŞEMALAR
-- ----------------------------------------------------------------------------
-- pgcrypto: bcrypt (crypt / gen_salt) — ağ hesabı şifreleri.
create extension if not exists pgcrypto;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- pg_net: web push webhook'u (asenkron HTTP). Bazı projelerde kapalı olabilir;
-- bu yüzden hata fırlatmak yerine uyarı verilir (şema kurulumu devam eder).
do $$
begin
  begin
    execute 'create schema if not exists net';
    execute 'create extension if not exists pg_net with schema net';
  exception when others then
    raise warning 'pg_net etkinleştirilemedi (push webhook devre dışı kalır): %', sqlerrm;
  end;
end $$;


-- ----------------------------------------------------------------------------
-- 1) PROFILES — hesap/kimlik tablosu (ASLA silinmez)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  agent_id text primary key,
  nickname text not null default 'Yeni Üye',
  level integer not null default 1,
  total_xp integer not null default 0,
  movies_watched integer not null default 0,
  series_watched integer not null default 0,
  achievements_unlocked integer not null default 0,
  quests_completed integer not null default 0,
  last_seen timestamptz not null default now()
);

-- Eski kurulumlarda eksik olan kolonlar (istemcinin kullandığı alanlar).
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists level integer not null default 1;
alter table public.profiles add column if not exists total_xp integer not null default 0;
alter table public.profiles add column if not exists movies_watched integer not null default 0;
alter table public.profiles add column if not exists past_movies_watched integer not null default 0;
alter table public.profiles add column if not exists series_watched integer not null default 0;
alter table public.profiles add column if not exists episodes_watched integer not null default 0;
alter table public.profiles add column if not exists achievements_unlocked integer not null default 0;
alter table public.profiles add column if not exists quests_completed integer not null default 0;
alter table public.profiles add column if not exists currently_watching jsonb default null;
alter table public.profiles add column if not exists showcase jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists secret_token text;
alter table public.profiles add column if not exists last_cloud_sync bigint not null default 0;
alter table public.profiles add column if not exists last_seen timestamptz not null default now();

-- Eski satırlarda boş isim varsa yalnızca GÖRÜNÜR isim düzeltilir; satır
-- silinmez, başka kolona dokunulmaz.
update public.profiles
set nickname = 'Yeni Üye'
where nickname is null or btrim(nickname) = '';

comment on column public.profiles.secret_token is
  'İstemci tarafından gönderilen x-agent-token. Okunamaz (kolon yetkisi yok); sadece trigger ve RPC kullanır.';
comment on column public.profiles.total_xp is
  'Türetilmiş özet: app_saves.payload.xpEvents toplamı. Otorite app_saves.payload''dır.';
comment on column public.profiles.last_cloud_sync is
  'İstemcinin son bulut damgası (epoch ms). Eski istemci uyumu için korunur.';


-- ----------------------------------------------------------------------------
-- 2) APP_SAVES — V3 bulut kaydı (SaveEnvelope.payload, otorite kayıt)
-- ----------------------------------------------------------------------------
-- Sözleşme: docs/sync-contract.md §4, src/types/sync.ts.
--   revision sunucu otoritesidir; yalnızca sync_commit() artırır.
--   save_hash istemcide hesaplanır (makeSaveHash) ve burada yeniden
--   hesaplanmaz; sadece "değişti mi" karşılaştırması için saklanır.
--   payload = AppStateV3 (schemaVersion = 3).
-- NOT: agent_id üzerinde FK YOKTUR. Kayıt, profil satırından önce de
--   yazılabilmelidir (ilk senkron). Sahiplik RLS ile app_saves.agent_id =
--   current_agent_id() üzerinden korunur.
create table if not exists public.app_saves (
  agent_id text primary key,
  revision bigint not null default 0,
  save_hash text not null,
  payload jsonb not null,
  device_id text,
  updated_at timestamptz not null default now()
);

-- Kolon garantisi (tablo daha eski bir sürümle kurulmuş olabilir).
alter table public.app_saves add column if not exists revision bigint not null default 0;
alter table public.app_saves add column if not exists save_hash text not null default '';
alter table public.app_saves add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.app_saves add column if not exists device_id text;
alter table public.app_saves add column if not exists updated_at timestamptz not null default now();

do $$
begin
  -- NOT VALID: mevcut satırlar taranmaz; yeni/yenilenen satırlar kurala uyar.
  if not exists (select 1 from pg_constraint where conname = 'app_saves_revision_nonnegative') then
    alter table public.app_saves
      add constraint app_saves_revision_nonnegative
      check (revision >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'app_saves_payload_object') then
    alter table public.app_saves
      add constraint app_saves_payload_object
      check (jsonb_typeof(payload) = 'object') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'app_saves_save_hash_not_blank') then
    alter table public.app_saves
      add constraint app_saves_save_hash_not_blank
      check (char_length(btrim(save_hash)) > 0) not valid;
  end if;
end $$;

comment on table public.app_saves is
  'V3 bulut kaydı: agent başına tek satır. revision sunucu otoritesi; payload AppStateV3 (schemaVersion=3).';
comment on column public.app_saves.revision is
  'Sunucu revizyonu. Yalnızca sync_commit() atomik olarak artırır (base_revision eşleşme şartı).';
comment on column public.app_saves.save_hash is
  'İstemcinin makeSaveHash(payload) sonucu (fnv1a- öneki). Sunucu yeniden hesaplamaz.';
comment on column public.app_saves.updated_at is
  'Sunucunun commit anı (now()). İstemci saatine güvenilmez.';


-- ----------------------------------------------------------------------------
-- 3) FRIENDSHIPS
-- ----------------------------------------------------------------------------
create table if not exists public.friendships (
  id text primary key,
  requester_id text references public.profiles(agent_id) on delete cascade,
  receiver_id text references public.profiles(agent_id) on delete cascade,
  status text check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz default now(),
  unique (requester_id, receiver_id)
);


-- ----------------------------------------------------------------------------
-- 4) NETWORK_LOGS — ana sayfa akışı
-- ----------------------------------------------------------------------------
create table if not exists public.network_logs (
  id text primary key,
  agent_id text references public.profiles(agent_id) on delete cascade,
  action_type text not null default 'watched',
  item_id text,
  item_type text,
  item_title text,
  item_poster text,
  rating numeric,
  note text,
  genres jsonb,
  created_at timestamptz default now()
);

alter table public.network_logs add column if not exists review_tags jsonb;
alter table public.network_logs add column if not exists is_spoiler boolean not null default false;
alter table public.network_logs alter column action_type set default 'watched';


-- ----------------------------------------------------------------------------
-- 5) CHAT_GROUPS / CHAT_GROUP_MEMBERS
-- ----------------------------------------------------------------------------
create table if not exists public.chat_groups (
  id text primary key,
  name text not null,
  created_by text not null references public.profiles(agent_id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.chat_group_members (
  group_id text not null references public.chat_groups(id) on delete cascade,
  agent_id text not null references public.profiles(agent_id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, agent_id)
);

-- Eski tablolarda FK yoksa ekle; mevcut satırlar yüzünden hata vermemesi için
-- NOT VALID kullanılır (yeni satırlarda kural yine işler, eski satırlar silinmez).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chat_groups_created_by_fkey') then
    alter table public.chat_groups
      add constraint chat_groups_created_by_fkey
      foreign key (created_by) references public.profiles(agent_id)
      on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chat_group_members_group_id_fkey') then
    alter table public.chat_group_members
      add constraint chat_group_members_group_id_fkey
      foreign key (group_id) references public.chat_groups(id)
      on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chat_group_members_agent_id_fkey') then
    alter table public.chat_group_members
      add constraint chat_group_members_agent_id_fkey
      foreign key (agent_id) references public.profiles(agent_id)
      on delete cascade not valid;
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 6) MESSAGES
-- ----------------------------------------------------------------------------
create table if not exists public.messages (
  id text primary key,
  sender_id text references public.profiles(agent_id) on delete cascade,
  receiver_id text references public.profiles(agent_id) on delete cascade,
  group_id text references public.chat_groups(id) on delete cascade,
  content text not null,
  created_at timestamptz default now(),
  is_read boolean not null default false
);

alter table public.messages add column if not exists group_id text;
alter table public.messages add column if not exists is_read boolean not null default false;
-- Grup mesajlarında bireysel alıcı yoktur (receiver_id NULL). Tip DEĞİŞMEZ.
alter table public.messages alter column receiver_id drop not null;
alter table public.messages alter column is_read set default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'messages_group_id_fkey') then
    alter table public.messages
      add constraint messages_group_id_fkey
      foreign key (group_id) references public.chat_groups(id)
      on delete cascade not valid;
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 7) RECOMMENDATIONS
-- ----------------------------------------------------------------------------
create table if not exists public.recommendations (
  id text primary key,
  sender_id text references public.profiles(agent_id) on delete cascade,
  receiver_id text references public.profiles(agent_id) on delete cascade,
  list_title text,
  items jsonb not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected', 'viewed')),
  created_at timestamptz default now()
);

-- Eski CHECK yalnızca pending/accepted/rejected kabul ediyordu; istemci
-- 'viewed' yazınca hata alıyordu. Yalnızca 'viewed' İÇERMEYEN (eski) kısıtlar
-- kaldırılır; doğru tanımlı kısıta dokunulmaz. NOT VALID: eski satırlar
-- taranmaz, silinmez.
do $$
declare c record;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as tanim
    from pg_constraint
    where conrelid = 'public.recommendations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    if c.tanim not ilike '%viewed%' then
      execute format('alter table public.recommendations drop constraint %I', c.conname);
    end if;
  end loop;

  if not exists (select 1 from pg_constraint where conname = 'recommendations_status_check') then
    alter table public.recommendations
      add constraint recommendations_status_check
      check (status in ('pending', 'accepted', 'rejected', 'viewed')) not valid;
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 8) VERİ KURALLARI (eski satırları silmez; NOT VALID)
-- ----------------------------------------------------------------------------
do $$
declare c record;
begin
  -- Mesaj: boş olamaz. Üst sınır 20.000 (medya/anket JSON'ları 2.000'i aşar).
  -- Eski kurulumlarda 2.000 sınırlı bir check_msg_length olabilir (snippet 14);
  -- yalnızca '%20000%' İÇERMEYEN (eski) tanım kaldırılıp yenisi eklenir.
  for c in
    select conname, pg_get_constraintdef(oid) as tanim
    from pg_constraint
    where conrelid = 'public.messages'::regclass
      and contype = 'c'
      and conname = 'check_msg_length'
  loop
    if c.tanim not ilike '%20000%' then
      execute format('alter table public.messages drop constraint %I', c.conname);
    end if;
  end loop;

  if not exists (select 1 from pg_constraint where conname = 'check_msg_length') then
    alter table public.messages
      add constraint check_msg_length
      check (char_length(btrim(content)) > 0 and char_length(content) <= 20000) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'check_group_name_length') then
    alter table public.chat_groups
      add constraint check_group_name_length
      check (char_length(btrim(name)) > 0 and char_length(name) <= 60) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'check_list_title_length') then
    alter table public.recommendations
      add constraint check_list_title_length
      check (char_length(btrim(list_title)) > 0 and char_length(list_title) <= 100) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'check_positive_stats') then
    alter table public.profiles
      add constraint check_positive_stats
      check (total_xp >= 0 and level >= 1) not valid;
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 9) AĞ HESAPLARI / OTURUMLAR / GİRİŞ DENEMELERİ / CİHAZLAR
-- ----------------------------------------------------------------------------
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

create unique index if not exists idx_network_accounts_username_lower
  on public.network_accounts (username_lower);

create unique index if not exists idx_network_accounts_agent_unique
  on public.network_accounts (agent_id);

create unique index if not exists idx_network_accounts_recovery_code
  on public.network_accounts (recovery_code);

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

create table if not exists public.login_attempts (
  id text primary key default gen_random_uuid()::text,
  username text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);

create index if not exists idx_login_attempts_username_time
  on public.login_attempts (username, attempted_at desc);

-- Bir cihaz (localStorage'daki gizli anahtar) birden fazla hesap için kayıtlı
-- olabilir; bu yüzden birincil anahtar (cihaz + hesap) çiftidir.
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

comment on table public.network_accounts is
  'Kullanıcı adı + şifre ile ağ girişi. username_lower ile büyük/küçük harf duyarsız benzersizlik.';
comment on table public.network_sessions is
  'Ağ giriş oturumları. 30 gün geçerlilik. Çoklu cihaz: her cihaz kendi oturumuyla açık kalır.';
comment on table public.login_attempts is
  'Giriş denemeleri kaydı (rate limiting için).';
comment on table public.network_devices is
  'Hesaba bağlı cihazlar. Her cihazın kendi gizli anahtarı; aynı hesap sınırsız cihazda açılabilir.';


-- ----------------------------------------------------------------------------
-- 10) WEB PUSH TABLOLARI
-- ----------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  agent_id text not null references public.profiles(agent_id) on delete cascade,
  p256dh text not null default '',
  auth text not null default '',
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_agent
  on public.push_subscriptions (agent_id);

create table if not exists public.network_notification_prefs (
  agent_id text primary key references public.profiles(agent_id) on delete cascade,
  notify_messages boolean not null default true,
  notify_friend_requests boolean not null default true,
  notify_lists boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Tek satırlık tablo. RLS açık, policy YOK: istemci okuyamaz/yazamaz.
-- `secret`, Edge Function'ın gerçekten veritabanımızdan geldiğini doğrular.
create table if not exists public.push_webhook_config (
  id boolean primary key default true check (id),
  secret text not null default (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ),
  endpoint text not null default 'https://gropqzbuuhmwrtmrdntk.supabase.co/functions/v1/send-push',
  updated_at timestamptz not null default now()
);

-- Webhook satırı yoksa oluştur (varsa dokunma: secret korunur).
insert into public.push_webhook_config (id) values (true)
on conflict (id) do nothing;

-- VAPID açık anahtarının TEK doğru kaynağı (011'de eklenen tablo).
create table if not exists public.push_config (
  id smallint primary key default 1,
  vapid_public_key text not null,
  updated_at timestamptz not null default now(),
  constraint push_config_single_row check (id = 1)
);

-- Anahtar değişirse yalnızca buradaki değer güncellenir (tek satır, id = 1).
insert into public.push_config (id, vapid_public_key)
values (1, 'BCZIEjTCuV3saXPGXvrw2WB60vRCchlzSNTsYgk2Qmv6Yf1YeTbkQkrZOEN8D8ehAOIFdVa5rZlPovlOF9nDe6U')
on conflict (id) do update
  set vapid_public_key = excluded.vapid_public_key,
      updated_at = now();


-- ----------------------------------------------------------------------------
-- 11) INDEX'LER (okuma hızı; veri silmez)
-- ----------------------------------------------------------------------------
create index if not exists idx_profiles_total_xp on public.profiles (total_xp desc);
create index if not exists idx_profiles_secret_token
  on public.profiles (secret_token) where secret_token is not null;

create index if not exists idx_friendships_requester on public.friendships (requester_id, status);
create index if not exists idx_friendships_receiver on public.friendships (receiver_id, status);

create index if not exists idx_network_logs_agent_created on public.network_logs (agent_id, created_at desc);
create index if not exists idx_network_logs_created on public.network_logs (created_at desc);

create index if not exists idx_messages_receiver_unread on public.messages (receiver_id, is_read) where is_read = false;
create index if not exists idx_messages_sender_created on public.messages (sender_id, created_at desc);
create index if not exists idx_messages_group_created on public.messages (group_id, created_at desc) where group_id is not null;

create index if not exists idx_group_members_agent on public.chat_group_members (agent_id);
create index if not exists idx_group_members_group on public.chat_group_members (group_id);
create index if not exists idx_chat_groups_creator on public.chat_groups (created_by);

create index if not exists idx_recommendations_receiver on public.recommendations (receiver_id, created_at desc);
create index if not exists idx_recommendations_sender on public.recommendations (sender_id, created_at desc);

create index if not exists idx_app_saves_updated_at on public.app_saves (updated_at desc);
