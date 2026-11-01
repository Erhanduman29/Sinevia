-- ============================================================================
-- SINEVIA — AGENT SİLME TEMİZLİĞİ VE YENİ RPC FONKSİYONU
-- ============================================================================
-- Bu dosya 2 BÖLÜMDEN oluşur:
--   A) TEK SEFERLİK TEMİZLİK (orphan kayıtları sil)
--   B) YENİ RPC: public.delete_my_account(p_secret text) — Uygulamadan çağrılacak
--
-- KULLANIM:
--   1. Supabase Dashboard → SQL Editor → Bu dosyayı kopyala-yapıştır → RUN
--   2. A bölümü orphan verileri temizler (profiles'ta olmayan agent_id'ler)
--   3. B bölümü yeni fonksiyonu oluşturur (eskisi sinevia_delete_account kalsın)
--   4. Uygulamada "Hesabı Sil" butonuna: supabase.rpc('delete_my_account', {p_secret: token})
--   5. Silme sonrası client'tan: await discardLegacyArchive(agentId) // Storage API ile
-- ============================================================================

-- ============================================================================
-- A) TEK SEFERLİK ORPHAN TEMİZLİĞİ
-- ============================================================================
-- profiles tablosunda YOK ama diğer tablolarda VAR olan agent_id kayıtlarını siler.
-- Dashboard'dan profiles silindiğinde FK cascade çalışmamış olabilir (app_saves FK yok).
-- Bu script'i BİR KEZ çalıştır, sonra tekrar gerekmez.
-- ============================================================================

-- 1) ÖNİZLEME — Hangi agent_id'ler ve kaç kayıt etkilenecek?
-- Çalıştırıp sonucu incele, sonra DELETE bloklarını aç.
/*
with orphan_agents as (
  select agent_id from public.app_saves where agent_id not in (select agent_id from public.profiles)
  union
  select agent_id from public.friendships where requester_id not in (select agent_id from public.profiles)
  union
  select agent_id from public.friendships where receiver_id not in (select agent_id from public.profiles)
  union
  select agent_id from public.network_logs where agent_id not in (select agent_id from public.profiles)
  union
  select agent_id from public.chat_group_members where agent_id not in (select agent_id from public.profiles)
  union
  select agent_id from public.messages where sender_id not in (select agent_id from public.profiles)
  union
  select agent_id from public.messages where receiver_id not in (select agent_id from public.profiles)
  union
  select agent_id from public.recommendations where sender_id not in (select agent_id from public.profiles)
  union
  select agent_id from public.recommendations where receiver_id not in (select agent_id from public.profiles)
  union
  select agent_id from public.network_accounts where agent_id not in (select agent_id from public.profiles)
  union
  select agent_id from public.network_sessions where agent_id not in (select agent_id from public.profiles)
  union
  select agent_id from public.network_devices where agent_id not in (select agent_id from public.profiles)
  union
  select agent_id from public.push_subscriptions where agent_id not in (select agent_id from public.profiles)
  union
  select agent_id from public.network_notification_prefs where agent_id not in (select agent_id from public.profiles)
  union
  select agent_id from public.chat_groups where created_by not in (select agent_id from public.profiles)
)
select agent_id, count(*) as table_count
from (
  select agent_id from public.app_saves where agent_id not in (select agent_id from public.profiles)
  union all
  select requester_id as agent_id from public.friendships where requester_id not in (select agent_id from public.profiles)
  union all
  select receiver_id as agent_id from public.friendships where receiver_id not in (select agent_id from public.profiles)
  union all
  select agent_id from public.network_logs where agent_id not in (select agent_id from public.profiles)
  union all
  select agent_id from public.chat_group_members where agent_id not in (select agent_id from public.profiles)
  union all
  select sender_id as agent_id from public.messages where sender_id not in (select agent_id from public.profiles)
  union all
  select receiver_id as agent_id from public.messages where receiver_id not in (select agent_id from public.profiles)
  union all
  select sender_id as agent_id from public.recommendations where sender_id not in (select agent_id from public.profiles)
  union all
  select receiver_id as agent_id from public.recommendations where receiver_id not in (select agent_id from public.profiles)
  union all
  select agent_id from public.network_accounts where agent_id not in (select agent_id from public.profiles)
  union all
  select agent_id from public.network_sessions where agent_id not in (select agent_id from public.profiles)
  union all
  select agent_id from public.network_devices where agent_id not in (select agent_id from public.profiles)
  union all
  select agent_id from public.push_subscriptions where agent_id not in (select agent_id from public.profiles)
  union all
  select agent_id from public.network_notification_prefs where agent_id not in (select agent_id from public.profiles)
  union all
  select created_by as agent_id from public.chat_groups where created_by not in (select agent_id from public.profiles)
) t
group by agent_id
order by table_count desc;
*/

-- 2) GERÇEK SİLME — Önizlemeyi onayladıktan sonra AÇ (/* ... */ kaldır) ve çalıştır
-- İşlem sırası: child tablolar önce, sonra parent (app_saves en sonda)
/*
begin;

-- friendships (requester_id, receiver_id FK cascade var ama profiles yoksa çalışmaz)
delete from public.friendships
where requester_id not in (select agent_id from public.profiles)
   or receiver_id not in (select agent_id from public.profiles);

-- network_logs
delete from public.network_logs
where agent_id not in (select agent_id from public.profiles);

-- chat_group_members
delete from public.chat_group_members
where agent_id not in (select agent_id from public.profiles);

-- messages
delete from public.messages
where sender_id not in (select agent_id from public.profiles)
   or receiver_id not in (select agent_id from public.profiles);

-- recommendations
delete from public.recommendations
where sender_id not in (select agent_id from public.profiles)
   or receiver_id not in (select agent_id from public.profiles);

-- network_accounts
delete from public.network_accounts
where agent_id not in (select agent_id from public.profiles);

-- network_sessions
delete from public.network_sessions
where agent_id not in (select agent_id from public.profiles);

-- network_devices
delete from public.network_devices
where agent_id not in (select agent_id from public.profiles);

-- push_subscriptions
delete from public.push_subscriptions
where agent_id not in (select agent_id from public.profiles);

-- network_notification_prefs
delete from public.network_notification_prefs
where agent_id not in (select agent_id from public.profiles);

-- chat_groups (created_by FK)
delete from public.chat_groups
where created_by not in (select agent_id from public.profiles);

-- app_saves (FK YOK, en sonda)
delete from public.app_saves
where agent_id not in (select agent_id from public.profiles);

-- Storage arşiv (SQL DELETE KULLANMA! Bu orphan bırakır.)
-- Eski arşivler supabase/cleanup_legacy_archives.sql ile Storage UI'dan silinmeli.

commit;
*/

-- ============================================================================
-- B) YENİ RPC FONKSİYONU: public.delete_my_account(p_secret text)
-- ============================================================================
-- Client'tan çağrılacak: supabase.rpc('delete_my_account', {p_secret: token})
-- Yetkilendirme: x-agent-token header'ı (current_agent_id() çözer)
-- İşler:
--   1. Tüm child tabloları siler (FK cascade yoksa da çalışır)
--   2. app_saves siler
--   3. profiles siler
--   4. storage.objects SQL DELETE YAPMAZ (orphan bırakır)
--      → Client'tan discardLegacyArchive(agentId) çağrılacak (Storage API)
--   5. network_sessions/devices/account da siler (tam temizlik)
-- Dönen: void (hata olursa exception)
-- ============================================================================

create or replace function public.delete_my_account(p_secret text)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_agent_id text;
  v_token text;
begin
  -- 1) İstek başlığından agent_id çöz (x-agent-token veya x-network-session)
  v_agent_id := public.current_agent_id();
  
  if v_agent_id is null then
    raise exception 'Kimlik doğrulama gerekli: oturum veya cihaz bulunamadı.';
  end if;

  -- 2) Secret token doğrula (profiles.secret_token ile eşleşmeli)
  select secret_token into v_token
  from public.profiles
  where agent_id = v_agent_id;

  if v_token is null or btrim(v_token) = '' or v_token <> p_secret then
    raise exception 'Yetkisiz: secret_token eşleşmedi.';
  end if;

  -- 3) Child tabloları sil (FK cascade yoksa da güvenli)
  delete from public.friendships
  where requester_id = v_agent_id or receiver_id = v_agent_id;

  delete from public.network_logs
  where agent_id = v_agent_id;

  delete from public.chat_group_members
  where agent_id = v_agent_id;

  delete from public.messages
  where sender_id = v_agent_id or receiver_id = v_agent_id;

  delete from public.recommendations
  where sender_id = v_agent_id or receiver_id = v_agent_id;

  delete from public.network_accounts
  where agent_id = v_agent_id;

  delete from public.network_sessions
  where agent_id = v_agent_id;

  delete from public.network_devices
  where agent_id = v_agent_id;

  delete from public.push_subscriptions
  where agent_id = v_agent_id;

  delete from public.network_notification_prefs
  where agent_id = v_agent_id;

  delete from public.chat_groups
  where created_by = v_agent_id;

  -- 4) app_saves (V3 bulut kaydı) — FK YOK
  delete from public.app_saves
  where agent_id = v_agent_id;

  -- 5) profiles (en sonda)
  delete from public.profiles
  where agent_id = v_agent_id;

  -- 6) storage.objects SQL DELETE YOK!
  -- Eski arşiv (sinevia_saves/<agentId>.json) client'tan
  -- supabase.storage.from('sinevia_saves').remove([agentId + '.json'])
  -- ile silinmeli. RLS policy "sinevia_legacy_archive_delete_own" izin verir.

  -- Başarılı: void döner
end;
$$;

revoke all on function public.delete_my_account(text) from public;
grant execute on function public.delete_my_account(text) to anon, authenticated;

comment on function public.delete_my_account(text) is
  'Mevcut oturumun (x-agent-token) hesabını tamamen siler. Child tablolar, app_saves, profiles temizlenir. Storage eski arşivi client Storage API ile silmeli.';

-- ============================================================================
-- NOTLAR
-- ============================================================================
-- 1. Eski sinevia_delete_account(text, text) KORUNDU (geriye uyumluluk).
-- 2. Yeni delete_my_account(text) tek parametre (p_secret) alır,
--    agent_id'yi x-agent-token başlığından (current_agent_id) çözer.
-- 3. Uygulama akışı:
--    a) Kullanıcı "Hesabı Sil" der → şifre/onay istenir
--    b) Client: const { error } = await supabase.rpc('delete_my_account', {p_secret: token})
--    c) Hata yoksa: await discardLegacyArchive(agentId) // Storage API
--    d) Client state temizlenir, login sayfasına yönlendirilir
-- 4. A bölümü (orphan temizlik) sadece BİR KEZ çalıştırılır.
-- ============================================================================