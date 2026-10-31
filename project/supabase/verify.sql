-- ============================================================================
-- SINEVIA V3 — VERIFY (SALT OKUNUR DOĞRULAMA)
-- ============================================================================
-- NE YAPAR?
--   Kanonik şema uygulandıktan SONRA durumu raporlar:
--     1) ÖZET: tablo/RLS/RPC/policy sayıları ve kritik eksikler
--     2) app_saves kolonları (agent_id, revision, save_hash, payload,
--        device_id, updated_at)
--     3) app_saves RLS + policy'leri (select/insert/update; delete YOK)
--     4) sync_get_state / sync_commit imzaları ve dönüş tipleri
--     5) profiles kolonları (istemcinin beklediği alanlar)
--     6) Eski tabloların satır sayıları (uygulama öncesiyle AYNI olmalı)
--     7) anon ALL yetkisi taraması (GRANT ALL kalıntısı)
--     8) RLS durumu, policy listesi, trigger listesi
--     9) Veri kuralı ihlalleri ve yetim (orphan) kayıt sayıları — SİLME YOK
--    10) Index listesi ve storage arşiv sayısı
--
-- NE YAPMAZ?
--   HİÇBİR YAZMA YOKTUR. Yalnızca SELECT / katalog okuması yapılır.
--
-- KULLANIM
--   Supabase SQL Editor yalnızca EN SON sorguyu gösterir; sorguları tek tek
--   seçerek çalıştırın. Satır sayılarını preflight.sql çıktısıyla karşılaştırın.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) ÖZET — kanonik şema beklendiği gibi mi?
-- ----------------------------------------------------------------------------
with beklenen(tablo) as (
  values
    ('profiles'), ('app_saves'), ('friendships'), ('network_logs'),
    ('chat_groups'), ('chat_group_members'), ('messages'), ('recommendations'),
    ('network_accounts'), ('network_sessions'), ('login_attempts'),
    ('network_devices'), ('push_subscriptions'), ('network_notification_prefs'),
    ('push_webhook_config'), ('push_config')
),
mevcut as (
  select b.tablo, c.oid, c.relrowsecurity
  from beklenen b
  left join pg_class c
    on c.relname = b.tablo
   and c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
)
select 'TABLOLAR (var/toplam)' as kontrol,
       count(*) filter (where oid is not null)::text || ' / ' || count(*)::text as deger,
       string_agg(tablo, ', ') filter (where oid is null) as detay
from mevcut
union all
select 'RLS KAPALI olan tablo sayısı',
       count(*) filter (where oid is not null and relrowsecurity = false)::text,
       string_agg(tablo, ', ') filter (where oid is not null and relrowsecurity = false)
from mevcut
union all
select 'app_saves kolon sayısı (6 beklenir)',
       (select count(*)::text
          from information_schema.columns
         where table_schema = 'public' and table_name = 'app_saves'),
       '-'
union all
select 'app_saves policy sayısı (3 beklenir: select/insert/update)',
       (select count(*)::text from pg_policies
         where schemaname = 'public' and tablename = 'app_saves'),
       (select string_agg(policyname || ' [' || cmd || ']', ', ' order by policyname)
          from pg_policies where schemaname = 'public' and tablename = 'app_saves')
union all
select 'app_saves DELETE policy (0 olmalı)',
       (select count(*)::text from pg_policies
         where schemaname = 'public' and tablename = 'app_saves' and cmd = 'DELETE'),
       'istemci kayıt silememeli'
union all
select 'sync_get_state(text)',
       case when to_regprocedure('public.sync_get_state(text)') is null then 'YOK' else 'VAR' end,
       coalesce((select pg_get_function_result(to_regprocedure('public.sync_get_state(text)'))), '-')
union all
select 'sync_commit(text,bigint,text,text,jsonb)',
       case when to_regprocedure('public.sync_commit(text,bigint,text,text,jsonb)') is null then 'YOK' else 'VAR' end,
       coalesce((select pg_get_function_result(to_regprocedure('public.sync_commit(text,bigint,text,text,jsonb)'))), '-')
union all
select 'ESKI network_register(text,text) kalmis mi',
       case when to_regprocedure('public.network_register(text,text)') is null then 'YOK (dogru)' else 'VAR (kaldirilmali)' end,
       '-'
union all
select 'TOPLAM policy (public)',
       (select count(*)::text from pg_policies where schemaname = 'public'),
       '-'
union all
select 'TOPLAM trigger (uygulama)',
       (select count(*)::text
          from pg_trigger t
         where not t.tgisinternal and t.tgrelid::regclass::text like 'public.%'),
       '-';


-- ----------------------------------------------------------------------------
-- 2) APP_SAVES KOLONLARI
-- ----------------------------------------------------------------------------
select
  e.kolon,
  e.beklenen_tip,
  e.beklenen_null,
  coalesce(c.data_type, 'YOK') as mevcut_tip,
  coalesce(c.is_nullable, '-') as mevcut_null,
  coalesce(c.column_default, '-') as varsayilan
from (values
  ('agent_id',   'text',                     'NO'),
  ('revision',   'bigint',                   'NO'),
  ('save_hash',  'text',                     'NO'),
  ('payload',    'jsonb',                    'NO'),
  ('device_id',  'text',                     'YES'),
  ('updated_at', 'timestamp with time zone', 'NO')
) as e(kolon, beklenen_tip, beklenen_null)
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = 'app_saves'
 and c.column_name = e.kolon
order by e.kolon;


-- ----------------------------------------------------------------------------
-- 3) APP_SAVES — RLS ve POLICY'LER
-- ----------------------------------------------------------------------------
select
  c.relname as tablo,
  c.relrowsecurity as rls_aktif,
  c.relforcerowsecurity as rls_zorunlu
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
  and c.relname = 'app_saves';

select
  p.policyname,
  p.cmd,
  array_to_string(p.roles, ',') as roller,
  coalesce(p.qual, '-') as using_ifadesi,
  coalesce(p.with_check, '-') as with_check_ifadesi
from pg_policies p
where p.schemaname = 'public'
  and p.tablename = 'app_saves'
order by p.cmd, p.policyname;


-- ----------------------------------------------------------------------------
-- 4) SYNC RPC İMZALARI
-- ----------------------------------------------------------------------------
select
  p.proname as fonksiyon,
  pg_get_function_identity_arguments(p.oid) as parametreler,
  pg_get_function_result(p.oid) as donus_tipi,
  p.prosecdef as security_definer,
  p.provolatile as volatilite,   -- 's' = stable, 'v' = volatile
  coalesce(array_to_string(p.proacl, ', '), '(varsayilan)') as yetkiler
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('sync_get_state', 'sync_commit')
order by p.proname;


-- ----------------------------------------------------------------------------
-- 5) PROFILES KOLONLARI (istemcinin beklediği alanlar)
-- ----------------------------------------------------------------------------
select
  e.kolon,
  coalesce(c.data_type, 'YOK') as mevcut_tip,
  coalesce(c.is_nullable, '-') as null_olabilir
from (values
  ('agent_id'), ('nickname'), ('level'), ('total_xp'),
  ('movies_watched'), ('past_movies_watched'), ('series_watched'),
  ('episodes_watched'), ('achievements_unlocked'), ('quests_completed'),
  ('currently_watching'), ('showcase'), ('secret_token'),
  ('last_cloud_sync'), ('last_seen')
) as e(kolon)
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = 'profiles'
 and c.column_name = e.kolon
order by e.kolon;


-- ----------------------------------------------------------------------------
-- 6) ESKİ TABLOLARIN SATIR SAYILARI (uygulama öncesiyle AYNI olmalı)
-- ----------------------------------------------------------------------------
with beklenen(tablo) as (
  values
    ('profiles'), ('friendships'), ('network_logs'), ('chat_groups'),
    ('chat_group_members'), ('messages'), ('recommendations'),
    ('network_accounts'), ('network_sessions'), ('login_attempts'),
    ('network_devices'), ('push_subscriptions'),
    ('network_notification_prefs'), ('app_saves')
)
select
  b.tablo,
  case when c.oid is null then null
       else (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from public.%I', b.tablo), false, true, '')
            ))[1]::text::bigint
  end as satir_sayisi
from beklenen b
left join pg_class c
  on c.relname = b.tablo
 and c.relnamespace = 'public'::regnamespace
 and c.relkind = 'r'
order by b.tablo;


-- ----------------------------------------------------------------------------
-- 7) ANON / AUTHENTICATED YETKİ TARAMASI (GRANT ALL kalıntısı)
-- ----------------------------------------------------------------------------
-- "TEHLİKELİ" = anon SELECT+INSERT+UPDATE+DELETE (+TRUNCATE) yetkisine sahip.
-- RLS hâlâ satırları sınırlar; ancak bu satır kanonik şemada beklenmez.
with yetki as (
  select
    c.relname,
    coalesce(bool_or(a.privilege_type = 'SELECT'), false)   as s,
    coalesce(bool_or(a.privilege_type = 'INSERT'), false)   as i,
    coalesce(bool_or(a.privilege_type = 'UPDATE'), false)   as u,
    coalesce(bool_or(a.privilege_type = 'DELETE'), false)   as d,
    coalesce(bool_or(a.privilege_type = 'TRUNCATE'), false) as t
  from pg_class c
  join pg_roles r on r.rolname in ('anon', 'authenticated')
  left join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    on a.grantee = r.oid
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
  group by c.relname
)
select
  relname as tablo,
  s as sel, i as ins, u as upd, d as del, t as trunc,
  case
    when t then 'TEHLIKELI: TRUNCATE yetkisi var'
    when s and i and u and d then 'GENIS: tam DML (RLS ile sinirli)'
    when (i or u or d) then 'YAZMA VAR'
    when s then 'SADECE OKUMA'
    else 'YETKI YOK'
  end as durum
from yetki
order by
  case
    when t then 0
    when s and i and u and d then 1
    when (i or u or d) then 2
    when s then 3
    else 4
  end,
  relname;


-- ----------------------------------------------------------------------------
-- 8) RLS DURUMU (tüm public tabloları)
-- ----------------------------------------------------------------------------
select relname as tablo, relrowsecurity as rls_aktif, relforcerowsecurity as rls_zorunlu
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
order by relname;


-- ----------------------------------------------------------------------------
-- 9) POLICY LİSTESİ
-- ----------------------------------------------------------------------------
select
  tablename,
  policyname,
  cmd,
  array_to_string(roles, ',') as roller,
  case when qual is null then '-' else left(qual, 100) end as using_ifadesi
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;


-- ----------------------------------------------------------------------------
-- 10) TRIGGER LİSTESİ
-- ----------------------------------------------------------------------------
select
  t.tgrelid::regclass as tablo,
  t.tgname as trigger_adi,
  case
    when t.tgtype & 2 <> 0 then 'BEFORE'
    when t.tgtype & 64 <> 0 then 'INSTEAD OF'
    else 'AFTER'
  end as zamanlama,
  pg_get_triggerdef(t.oid) as tanim
from pg_trigger t
where not t.tgisinternal
  and t.tgrelid::regclass::text like 'public.%'
order by tablo, trigger_adi;


-- ----------------------------------------------------------------------------
-- 11) VERİ KURALI İHLALLERİ (SİLME YOK — yalnızca sayım)
-- ----------------------------------------------------------------------------
select 'profiles negatif XP / seviye < 1' as kontrol, count(*) as adet
from public.profiles where total_xp < 0 or level < 1
union all
select 'profiles boş secret_token', count(*)
from public.profiles where secret_token is null or btrim(secret_token) = ''
union all
select 'messages boş içerik', count(*)
from public.messages where content is null or btrim(content) = ''
union all
select 'recommendations geçersiz status', count(*)
from public.recommendations
where status is not null and status not in ('pending','accepted','rejected','viewed')
union all
select 'network_logs boş action_type', count(*)
from public.network_logs where action_type is null or btrim(action_type) = ''
union all
select 'app_saves save_hash boş', count(*)
from public.app_saves where save_hash is null or btrim(save_hash) = ''
union all
select 'app_saves payload nesne değil', count(*)
from public.app_saves where jsonb_typeof(payload) is distinct from 'object'
union all
select 'app_saves revision < 0', count(*)
from public.app_saves where revision < 0;


-- ----------------------------------------------------------------------------
-- 12) YETİM (ORPHAN) KAYITLAR — SİLME YOK, sadece sayım
-- ----------------------------------------------------------------------------
select 'messages.sender_id yetim' as kontrol, count(*) as adet
from public.messages m
left join public.profiles p on p.agent_id = m.sender_id
where m.sender_id is not null and p.agent_id is null
union all
select 'messages.receiver_id yetim', count(*)
from public.messages m
left join public.profiles p on p.agent_id = m.receiver_id
where m.receiver_id is not null and p.agent_id is null
union all
select 'messages.group_id yetim', count(*)
from public.messages m
left join public.chat_groups g on g.id = m.group_id
where m.group_id is not null and g.id is null
union all
select 'chat_group_members.group_id yetim', count(*)
from public.chat_group_members m
left join public.chat_groups g on g.id = m.group_id
where g.id is null
union all
select 'chat_group_members.agent_id yetim', count(*)
from public.chat_group_members m
left join public.profiles p on p.agent_id = m.agent_id
where p.agent_id is null
union all
select 'friendships.requester_id yetim', count(*)
from public.friendships f
left join public.profiles p on p.agent_id = f.requester_id
where f.requester_id is not null and p.agent_id is null
union all
select 'friendships.receiver_id yetim', count(*)
from public.friendships f
left join public.profiles p on p.agent_id = f.receiver_id
where f.receiver_id is not null and p.agent_id is null
union all
select 'network_logs.agent_id yetim', count(*)
from public.network_logs l
left join public.profiles p on p.agent_id = l.agent_id
where l.agent_id is not null and p.agent_id is null
union all
select 'recommendations.sender_id yetim', count(*)
from public.recommendations r
left join public.profiles p on p.agent_id = r.sender_id
where r.sender_id is not null and p.agent_id is null
union all
select 'recommendations.receiver_id yetim', count(*)
from public.recommendations r
left join public.profiles p on p.agent_id = r.receiver_id
where r.receiver_id is not null and p.agent_id is null;


-- ----------------------------------------------------------------------------
-- 13) INDEX LİSTESİ
-- ----------------------------------------------------------------------------
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;


-- ----------------------------------------------------------------------------
-- 14) STORAGE — bulut arşiv sayısı (içerik okunmaz)
-- ----------------------------------------------------------------------------
select count(*) as bulut_arsiv_sayisi
from storage.objects
where bucket_id = 'sinevia_saves';
