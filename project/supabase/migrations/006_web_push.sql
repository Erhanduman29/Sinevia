-- ============================================================
-- SINEVIA 006 — WEB PUSH (UYGULAMA KAPALIYKEN BİLDİRİM)
-- ============================================================
-- AMAÇ
--   Telefon/bilgisayar bildirimleri yalnızca uygulama açıkken değil,
--   uygulama kapalıyken de çalışsın.
--
-- ÖNCEKİ SORUN
--   1) Bildirimler `new Notification()` ile gösteriliyordu; bu constructor
--      mobil tarayıcılarda (Android Chrome, iOS PWA) çalışmaz.
--   2) Tek kaynak Supabase Realtime'dı; realtime websocket `x-agent-token`
--      başlığını taşımadığı için RLS tüm olayları düşürüyordu.
--   3) Bildirim tercihleri yalnızca localStorage'daydı; sunucu göremiyordu.
--
-- ÇÖZÜM
--   1) push_subscriptions: her cihazın Web Push aboneliği.
--   2) network_notification_prefs: tercihlerin sunucu kopyası
--      (Edge Function push göndermeden önce buraya bakar).
--   3) push_dispatch_webhook: INSERT olaylarını Edge Function'a iletir.
--      pg_net ile asenkron çalışır; hata olsa bile asıl INSERT'i bozmaz.
--
-- KURAL: Veri silmez. Idempotent, tekrar çalıştırılabilir.
-- Sıra: 001 -> 002 -> 003 -> 004 -> 005 -> 006
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) CİHAZ PUSH ABONELİKLERİ
-- ------------------------------------------------------------
-- `endpoint` tarayıcının verdiği benzersiz push adresidir. Aynı cihaz
-- tekrar abone olduğunda aynı endpoint gelir; upsert ile tazelenir.
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

grant select, insert, update, delete on table public.push_subscriptions to anon, authenticated;
alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own
  on public.push_subscriptions for select
  to anon, authenticated
  using (agent_id = public.current_agent_id());

drop policy if exists push_subscriptions_insert_self on public.push_subscriptions;
create policy push_subscriptions_insert_self
  on public.push_subscriptions for insert
  to anon, authenticated
  with check (agent_id = public.current_agent_id());

drop policy if exists push_subscriptions_update_self on public.push_subscriptions;
create policy push_subscriptions_update_self
  on public.push_subscriptions for update
  to anon, authenticated
  using (agent_id = public.current_agent_id())
  with check (agent_id = public.current_agent_id());

drop policy if exists push_subscriptions_delete_self on public.push_subscriptions;
create policy push_subscriptions_delete_self
  on public.push_subscriptions for delete
  to anon, authenticated
  using (agent_id = public.current_agent_id());

-- ------------------------------------------------------------
-- 2) BİLDİRİM TERCİHLERİNİN SUNUCU KOPYASI
-- ------------------------------------------------------------
-- İstemci tercihleri localStorage'da tutmaya devam eder (anında tepki),
-- ama her değişiklikte buraya da yazılır. Edge Function yalnızca buraya
-- bakar; böylece kapatılan tür için push gönderilmez.
create table if not exists public.network_notification_prefs (
  agent_id text primary key references public.profiles(agent_id) on delete cascade,
  notify_messages boolean not null default true,
  notify_friend_requests boolean not null default true,
  notify_lists boolean not null default true,
  updated_at timestamptz not null default now()
);

grant select, insert, update on table public.network_notification_prefs to anon, authenticated;
alter table public.network_notification_prefs enable row level security;

drop policy if exists network_notification_prefs_select_own on public.network_notification_prefs;
create policy network_notification_prefs_select_own
  on public.network_notification_prefs for select
  to anon, authenticated
  using (agent_id = public.current_agent_id());

drop policy if exists network_notification_prefs_insert_self on public.network_notification_prefs;
create policy network_notification_prefs_insert_self
  on public.network_notification_prefs for insert
  to anon, authenticated
  with check (agent_id = public.current_agent_id());

drop policy if exists network_notification_prefs_update_self on public.network_notification_prefs;
create policy network_notification_prefs_update_self
  on public.network_notification_prefs for update
  to anon, authenticated
  using (agent_id = public.current_agent_id())
  with check (agent_id = public.current_agent_id());

-- ------------------------------------------------------------
-- 3) WEBHOOK AYARI (yalnızca sunucu okur)
-- ------------------------------------------------------------
-- Tek satırlık tablo. RLS açık ama politika YOK: istemci okuyamaz/yazamaz.
-- `secret`, Edge Function'ın gerçekten veritabanımızdan geldiğini doğrular.
-- Yeni proje ref'i kullanılırsa yalnızca `endpoint` güncellenmeli.
create table if not exists public.push_webhook_config (
  id boolean primary key default true check (id),
  secret text not null default (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ),
  endpoint text not null default 'https://gropqzbuuhmwrtmrdntk.supabase.co/functions/v1/send-push',
  updated_at timestamptz not null default now()
);

revoke all on table public.push_webhook_config from anon, authenticated;
alter table public.push_webhook_config enable row level security;

insert into public.push_webhook_config (id) values (true)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 4) INSERT → EDGE FUNCTION KÖPRÜSÜ (pg_net)
-- ------------------------------------------------------------
-- pg_net Supabase'de hazır gelir; burada açıkça istenir.
create schema if not exists net;
create extension if not exists pg_net with schema net;

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

  -- Asenkron istek. Hata olursa yalnızca uyarı yazılır; mesaj kaydı bozulmaz.
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

drop trigger if exists messages_push_webhook on public.messages;
create trigger messages_push_webhook
  after insert on public.messages
  for each row execute function public.push_dispatch_webhook();

drop trigger if exists friendships_push_webhook on public.friendships;
create trigger friendships_push_webhook
  after insert on public.friendships
  for each row execute function public.push_dispatch_webhook();

drop trigger if exists recommendations_push_webhook on public.recommendations;
create trigger recommendations_push_webhook
  after insert on public.recommendations
  for each row execute function public.push_dispatch_webhook();

commit;
