-- ============================================================================
-- SINEVIA V3 — KANONİK ŞEMA / 03 GÜVENLİK (YETKİLER + RLS + POLICY + TRIGGER)
-- ============================================================================
-- KAYNAK: migrations 002_security.sql, 004_network_auth.sql,
--         005_coklu_cihaz.sql, 006_web_push.sql, 009_network_identity_guards.sql,
--         010_push_public_key.sql + private snippet 06 (şema önbelleği yenileme)
--         ve 14 (güvenlik; eski sürüm — en son hükümler 002/005/009'dadır).
--
-- KURALLAR
--   * DISABLE ROW LEVEL SECURITY YOK — yalnızca ENABLE.
--   * GRANT ALL YOK — her yetki açıkça listelenir.
--   * DROP TABLE / TRUNCATE / DROP ... CASCADE yok.
--   * Policy'ler `drop policy if exists` + `create policy` ile idempotenttir.
--   * Trigger'lar `drop trigger if exists` + `create trigger` ile idempotenttir.
--
-- app_saves RLS ÖZETİ
--   select / insert / update YALNIZCA sahibine (agent_id = current_agent_id()).
--   DELETE politikası YOKTUR (silme yalnızca hesap-silme RPC'siyle olur).
--   Token'ı/oturumu olmayan istekte current_agent_id() NULL döner, policy
--   hiçbir satırı eşleştirmez → anonim erişim fiilen kapalıdır.
--
-- TRANSACTION: begin/commit içermez (schema.sql bloğu içinde çalışır).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) TRIGGER'LAR (fonksiyonlar 02_functions.sql'de tanımlı)
-- ----------------------------------------------------------------------------

-- Profil sahipliği (002 + 005: kayıtlı cihaz anahtarı da kabul edilir).
drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile
  before insert or update on public.profiles
  for each row execute function public.protect_profile_trigger();

-- Mesaj gönderen kimliği (009: current_agent_id()).
drop trigger if exists trg_verify_message_sender on public.messages;
create trigger trg_verify_message_sender
  before insert on public.messages
  for each row execute function public.verify_message_sender();

-- Grup silme yetkisi (009: current_agent_id()).
drop trigger if exists trg_verify_group_deletion on public.chat_groups;
create trigger trg_verify_group_deletion
  before delete on public.chat_groups
  for each row execute function public.verify_group_deletion();

-- Web push köprüsü (006).
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


-- ----------------------------------------------------------------------------
-- 2) PROFILES — kolon yetkileri (secret_token ASLA okunamaz)
-- ----------------------------------------------------------------------------
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

drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles for insert
  to anon, authenticated
  with check (public.can_write_profile(agent_id));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update
  to anon, authenticated
  using (public.can_write_profile(agent_id))
  with check (public.can_write_profile(agent_id));

drop policy if exists profiles_delete_self on public.profiles;
create policy profiles_delete_self
  on public.profiles for delete
  to anon, authenticated
  using (public.can_write_profile(agent_id));


-- ----------------------------------------------------------------------------
-- 3) SOSYAL TABLOLAR — yetkiler + RLS + policy'ler
-- ----------------------------------------------------------------------------
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
drop policy if exists friendships_select_own on public.friendships;
create policy friendships_select_own
  on public.friendships for select
  to anon, authenticated
  using (requester_id = public.current_agent_id() or receiver_id = public.current_agent_id());

drop policy if exists friendships_insert_self on public.friendships;
create policy friendships_insert_self
  on public.friendships for insert
  to anon, authenticated
  with check (requester_id = public.current_agent_id());

drop policy if exists friendships_update_own on public.friendships;
create policy friendships_update_own
  on public.friendships for update
  to anon, authenticated
  using (receiver_id = public.current_agent_id())
  with check (receiver_id = public.current_agent_id());

drop policy if exists friendships_delete_own on public.friendships;
create policy friendships_delete_own
  on public.friendships for delete
  to anon, authenticated
  using (requester_id = public.current_agent_id() or receiver_id = public.current_agent_id());

-- NETWORK_LOGS (akış herkese açık okunur; yazma sadece kendi adına)
drop policy if exists network_logs_select_public on public.network_logs;
create policy network_logs_select_public
  on public.network_logs for select
  to anon, authenticated
  using (true);

drop policy if exists network_logs_insert_self on public.network_logs;
create policy network_logs_insert_self
  on public.network_logs for insert
  to anon, authenticated
  with check (agent_id = public.current_agent_id());

drop policy if exists network_logs_update_self on public.network_logs;
create policy network_logs_update_self
  on public.network_logs for update
  to anon, authenticated
  using (agent_id = public.current_agent_id())
  with check (agent_id = public.current_agent_id());

drop policy if exists network_logs_delete_self on public.network_logs;
create policy network_logs_delete_self
  on public.network_logs for delete
  to anon, authenticated
  using (agent_id = public.current_agent_id());

-- RECOMMENDATIONS
drop policy if exists recommendations_select_own on public.recommendations;
create policy recommendations_select_own
  on public.recommendations for select
  to anon, authenticated
  using (sender_id = public.current_agent_id() or receiver_id = public.current_agent_id());

drop policy if exists recommendations_insert_self on public.recommendations;
create policy recommendations_insert_self
  on public.recommendations for insert
  to anon, authenticated
  with check (sender_id = public.current_agent_id());

drop policy if exists recommendations_update_own on public.recommendations;
create policy recommendations_update_own
  on public.recommendations for update
  to anon, authenticated
  using (sender_id = public.current_agent_id() or receiver_id = public.current_agent_id())
  with check (sender_id = public.current_agent_id() or receiver_id = public.current_agent_id());

drop policy if exists recommendations_delete_own on public.recommendations;
create policy recommendations_delete_own
  on public.recommendations for delete
  to anon, authenticated
  using (sender_id = public.current_agent_id() or receiver_id = public.current_agent_id());

-- MESSAGES
drop policy if exists messages_select_own on public.messages;
create policy messages_select_own
  on public.messages for select
  to anon, authenticated
  using (
    sender_id = public.current_agent_id()
    or receiver_id = public.current_agent_id()
    or (group_id is not null and public.is_group_member(group_id, public.current_agent_id()))
  );

drop policy if exists messages_insert_own on public.messages;
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

drop policy if exists messages_update_own on public.messages;
create policy messages_update_own
  on public.messages for update
  to anon, authenticated
  using (receiver_id = public.current_agent_id())
  with check (receiver_id = public.current_agent_id());

drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own
  on public.messages for delete
  to anon, authenticated
  using (sender_id = public.current_agent_id() or receiver_id = public.current_agent_id());

-- CHAT_GROUPS
drop policy if exists chat_groups_select_member on public.chat_groups;
create policy chat_groups_select_member
  on public.chat_groups for select
  to anon, authenticated
  using (
    created_by = public.current_agent_id()
    or public.is_group_member(id, public.current_agent_id())
  );

drop policy if exists chat_groups_insert_self on public.chat_groups;
create policy chat_groups_insert_self
  on public.chat_groups for insert
  to anon, authenticated
  with check (created_by = public.current_agent_id());

drop policy if exists chat_groups_update_creator on public.chat_groups;
create policy chat_groups_update_creator
  on public.chat_groups for update
  to anon, authenticated
  using (created_by = public.current_agent_id())
  with check (created_by = public.current_agent_id());

drop policy if exists chat_groups_delete_creator on public.chat_groups;
create policy chat_groups_delete_creator
  on public.chat_groups for delete
  to anon, authenticated
  using (created_by = public.current_agent_id());

-- CHAT_GROUP_MEMBERS
drop policy if exists chat_group_members_select_member on public.chat_group_members;
create policy chat_group_members_select_member
  on public.chat_group_members for select
  to anon, authenticated
  using (
    agent_id = public.current_agent_id()
    or public.is_group_member(group_id, public.current_agent_id())
  );

-- Kurucu veya mevcut bir grup üyesi yeni üye ekleyebilir.
-- `agent_id = current_agent_id()` tek başına KULLANILMAZ; yoksa grup dışındaki
-- biri kendini gruba ekleyebilir.
drop policy if exists chat_group_members_insert_by_member on public.chat_group_members;
create policy chat_group_members_insert_by_member
  on public.chat_group_members for insert
  to anon, authenticated
  with check (
    public.is_group_creator(group_id, public.current_agent_id())
    or public.is_group_member(group_id, public.current_agent_id())
  );

drop policy if exists chat_group_members_delete_self_or_creator on public.chat_group_members;
create policy chat_group_members_delete_self_or_creator
  on public.chat_group_members for delete
  to anon, authenticated
  using (
    agent_id = public.current_agent_id()
    or public.is_group_creator(group_id, public.current_agent_id())
  );


-- ----------------------------------------------------------------------------
-- 4) AĞ HESAPLARI / OTURUMLAR / GİRİŞ DENEMELERİ
-- ----------------------------------------------------------------------------
-- NOT: Bu tablolara tablo düzeyinde yetki VERİLMEZ (004 ile aynı davranış).
-- Erişim yalnızca RPC'ler ve policy'ler üzerinden yapılır.

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

-- CİHAZLAR: doğrudan erişim kapalı. RLS açık, policy YOK.
-- Okuma/yazma yalnızca security definer fonksiyonlar (is_network_device,
-- can_write_profile, protect_profile_trigger, network_claim_device, ...) ile.
alter table public.network_devices enable row level security;


-- ----------------------------------------------------------------------------
-- 5) WEB PUSH TABLOLARI
-- ----------------------------------------------------------------------------
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

-- Webhook ayarı: yalnızca sunucu (security definer fonksiyonlar) okur.
revoke all on table public.push_webhook_config from anon, authenticated;
alter table public.push_webhook_config enable row level security;

-- VAPID açık anahtarı: herkese okunur, istemci YAZAMAZ.
revoke insert, update, delete on public.push_config from anon, authenticated;
grant select on public.push_config to anon, authenticated;
alter table public.push_config enable row level security;

drop policy if exists "push_config_read" on public.push_config;
create policy "push_config_read"
  on public.push_config
  for select
  to anon, authenticated
  using (true);


-- ----------------------------------------------------------------------------
-- 6) APP_SAVES — V3 bulut kaydı RLS
-- ----------------------------------------------------------------------------
-- Sahip: app_saves.agent_id = current_agent_id()
--   * select : yalnızca sahibi
--   * insert : yalnızca sahibi (agent_id = kendi kimliği)
--   * update : yalnızca sahibi (USING + WITH CHECK)
--   * delete : POLICY YOK → istemci silemez (hesap silme RPC'si muaf).
revoke all on table public.app_saves from anon, authenticated;
grant select, insert, update on table public.app_saves to anon, authenticated;

alter table public.app_saves enable row level security;

drop policy if exists app_saves_select_own on public.app_saves;
create policy app_saves_select_own
  on public.app_saves for select
  to anon, authenticated
  using (agent_id = public.current_agent_id());

drop policy if exists app_saves_insert_self on public.app_saves;
create policy app_saves_insert_self
  on public.app_saves for insert
  to anon, authenticated
  with check (agent_id = public.current_agent_id());

drop policy if exists app_saves_update_own on public.app_saves;
create policy app_saves_update_own
  on public.app_saves for update
  to anon, authenticated
  using (agent_id = public.current_agent_id())
  with check (agent_id = public.current_agent_id());


-- ----------------------------------------------------------------------------
-- 7) REALTIME — profiles yayınından çıkar (secret_token sızmasın)
-- ----------------------------------------------------------------------------
-- Uygulama bulut durumunu yokluyor; profiles realtime'a ihtiyaç yok. Profil
-- satırı realtime ile yayınlanırsa token kolonu da istemcilere gidebilir.
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


-- ----------------------------------------------------------------------------
-- 8) POSTGREST ŞEMA ÖNBELLEĞİNİ YENİLE
-- ----------------------------------------------------------------------------
-- Yeni tablo/fonksiyonlar eklendiğinde istemci "Could not find the function ...
-- in the schema cache" hatası alabilir. Bu bildirim önbelleği hemen yeniler.
notify pgrst, 'reload schema';
