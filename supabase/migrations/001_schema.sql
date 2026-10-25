-- ============================================================
-- SINEVIA 001 — ŞEMA (SADECE EKLEME YAPAR)
-- ============================================================
-- KURAL: Bu dosyada DROP TABLE, TRUNCATE veya DELETE FROM profiles YOKTUR.
-- Mevcut kullanıcı kayıtları korunur. Tekrar tekrar çalıştırılabilir.
--
-- Sıra: 001_schema.sql -> 002_security.sql -> 003_functions.sql
-- Önce yedek alın: Supabase > Database > Backups + tabloların CSV çıktısı.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) PROFILES (hesap tablosu — ASLA silinmez)
-- ------------------------------------------------------------
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

-- Eski satırlarda boş isim varsa yalnızca GÖRÜNÜR isim düzeltilir; kayıt silinmez.
update public.profiles
set nickname = 'Yeni Üye'
where nickname is null or btrim(nickname) = '';

-- ------------------------------------------------------------
-- 2) FRIENDSHIPS
-- ------------------------------------------------------------
create table if not exists public.friendships (
  id text primary key,
  requester_id text references public.profiles(agent_id) on delete cascade,
  receiver_id text references public.profiles(agent_id) on delete cascade,
  status text check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz default now(),
  unique (requester_id, receiver_id)
);

-- ------------------------------------------------------------
-- 3) NETWORK_LOGS (akış)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 4) CHAT_GROUPS / CHAT_GROUP_MEMBERS
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 5) MESSAGES
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 6) RECOMMENDATIONS
-- ------------------------------------------------------------
create table if not exists public.recommendations (
  id text primary key,
  sender_id text references public.profiles(agent_id) on delete cascade,
  receiver_id text references public.profiles(agent_id) on delete cascade,
  list_title text,
  items jsonb not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected', 'viewed')),
  created_at timestamptz default now()
);

-- Eski CHECK yalnızca pending/accepted/rejected kabul ediyordu; istemci 'viewed'
-- yazınca hata alıyordu. Kısıtı kaldırıp dört değeri kabul eden yenisini ekliyoruz.
-- NOT VALID: eski satırlar taranmaz, silinmez; yeni/yenilenen satırlar kurala uyar.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.recommendations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.recommendations drop constraint %I', c.conname);
  end loop;

  if not exists (select 1 from pg_constraint where conname = 'recommendations_status_check') then
    alter table public.recommendations
      add constraint recommendations_status_check
      check (status in ('pending', 'accepted', 'rejected', 'viewed')) not valid;
  end if;
end $$;

-- ------------------------------------------------------------
-- 7) VERİ KURALLARI (eski satırları silmez; NOT VALID)
-- ------------------------------------------------------------
do $$
begin
  -- Mesaj: boş olamaz. Üst sınır 20.000: medya/anket JSON'ları 2.000'i aşabilir.
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

-- ------------------------------------------------------------
-- 8) INDEX'LER (okuma hızı; veri silmez)
-- ------------------------------------------------------------
create index if not exists idx_profiles_total_xp on public.profiles (total_xp desc);
create index if not exists idx_profiles_secret_token on public.profiles (secret_token);

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

comment on column public.profiles.secret_token is
  'İstemci tarafından gönderilen x-agent-token. Okuma izni verilmez; sadece trigger ve RPC kullanır.';

commit;
