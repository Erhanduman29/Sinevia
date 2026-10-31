-- ============================================================================
-- SINEVIA V3 — PREFLIGHT (SALT OKUNUR ENVANTER)
-- ============================================================================
-- NE YAPAR?
--   Kanonik şemayı uygulamadan ÖNCE mevcut durumu raporlar:
--     * beklenen tablolar var mı, RLS açık mı, kaç satır var,
--     * app_saves tablosu ve kolonları,
--     * sync_get_state / sync_commit RPC'leri,
--     * tüm beklenen fonksiyonlar (imza bazında),
--     * policy ve trigger envanteri.
--
-- NE YAPMAZ?
--   HİÇBİR YAZMA YOKTUR. Yalnızca SELECT / katalog okuması yapılır.
--   (Satır sayıları `query_to_xml(... count(*) ...)` ile okunur; veri değişmez.)
--
-- KULLANIM
--   Supabase SQL Editor yalnızca EN SON sorgunun sonucunu gösterir. Bu yüzden
--   sorguları tek tek seçerek çalıştırın; "0) ÖZET" bölümü tek ekranda
--   uygulanabilirlik kararını verir.
--   Çıktıyı kaydedin: kanonik şema uygulandıktan sonra verify.sql ile
--   karşılaştırılacak (satır sayıları aynı kalmalı).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0) ÖZET — kanonik şema uygulanabilir mi?
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
select 'TABLOLAR' as bolum,
       count(*) filter (where oid is not null)::text || ' / ' || count(*)::text as durum,
       string_agg(tablo, ', ') filter (where oid is null) as eksik
from mevcut
union all
select 'RLS KAPALI TABLOLAR',
       count(*) filter (where oid is not null and relrowsecurity = false)::text || ' adet',
       string_agg(tablo, ', ') filter (where oid is not null and relrowsecurity = false)
from mevcut
union all
select 'app_saves',
       case when exists (
         select 1 from pg_class
         where relname = 'app_saves' and relnamespace = 'public'::regnamespace and relkind = 'r'
       ) then 'VAR' else 'YOK' end,
       case when exists (
         select 1 from pg_class
         where relname = 'app_saves' and relnamespace = 'public'::regnamespace and relkind = 'r'
       ) then (
         -- DİKKAT: burada alt sorgu (select ...) DEĞİL, doğrudan fonksiyon
         -- çağrısı kullanılır. CASE yalnızca seçilen dalı değerlendirir;
         -- böylece tablo yokken dinamik sayaç hiç çalışmaz.
         (xpath('/row/c/text()',
           query_to_xml('select count(*) as c from public.app_saves', false, true, '')
         ))[1]::text || ' satır'
       ) else 'kanonik şema oluşturacak' end
union all
select 'sync_get_state(text)',
       case when to_regprocedure('public.sync_get_state(text)') is null then 'YOK' else 'VAR' end,
       'kanonik şema tanımlayacak'
union all
select 'sync_commit(text,bigint,text,text,jsonb)',
       case when to_regprocedure('public.sync_commit(text,bigint,text,text,jsonb)') is null then 'YOK' else 'VAR' end,
       'kanonik şema tanımlayacak'
union all
select 'push_config (VAPID)',
       case when exists (
         select 1 from pg_class
         where relname = 'push_config' and relnamespace = 'public'::regnamespace and relkind = 'r'
       ) then 'VAR' else 'YOK' end,
       'migration 010 / kanonik 01_core'
union all
select 'pgcrypto (extensions)',
       case when exists (select 1 from pg_extension where extname = 'pgcrypto') then 'VAR' else 'YOK' end,
       'şifre hashleme için gerekli'
union all
select 'pg_net',
       case when exists (select 1 from pg_extension where extname = 'pg_net') then 'VAR' else 'YOK' end,
       'push webhook için (yoksa uyarı verilir, kurulum durmaz)';


-- ----------------------------------------------------------------------------
-- 1) TABLO ENVANTERİ — var/yok, RLS, satır sayısı
-- ----------------------------------------------------------------------------
with beklenen(tablo, kategori) as (
  values
    ('profiles',                 'kimlik'),
    ('app_saves',                'V3 bulut kaydı'),
    ('network_accounts',         'ağ kimliği'),
    ('network_sessions',         'ağ kimliği'),
    ('network_devices',          'ağ kimliği'),
    ('login_attempts',           'ağ kimliği'),
    ('friendships',              'sosyal'),
    ('network_logs',             'sosyal'),
    ('chat_groups',              'sosyal'),
    ('chat_group_members',       'sosyal'),
    ('messages',                 'sosyal'),
    ('recommendations',          'sosyal'),
    ('push_subscriptions',       'push'),
    ('network_notification_prefs','push'),
    ('push_webhook_config',      'push'),
    ('push_config',              'push')
)
select
  b.kategori,
  b.tablo,
  case when c.oid is null then 'YOK' else 'VAR' end as durum,
  case when c.oid is null then '-'
       when c.relrowsecurity then 'ACIK'
       else 'KAPALI' end as rls,
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
order by b.kategori, b.tablo;


-- ----------------------------------------------------------------------------
-- 2) APP_SAVES KOLONLARI (V3 sözleşmesi)
-- ----------------------------------------------------------------------------
select
  e.kolon,
  e.beklenen_tip,
  coalesce(c.data_type, 'YOK') as mevcut_tip,
  coalesce(c.is_nullable, '-') as null_olabilir,
  coalesce(c.column_default, '-') as varsayilan
from (values
  ('agent_id',   'text',                    'NO'),
  ('revision',   'bigint',                  'NO'),
  ('save_hash',  'text',                    'NO'),
  ('payload',    'jsonb',                   'NO'),
  ('device_id',  'text',                    'YES'),
  ('updated_at', 'timestamp with time zone', 'NO')
) as e(kolon, beklenen_tip, beklenen_null)
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = 'app_saves'
 and c.column_name = e.kolon
order by e.kolon;


-- ----------------------------------------------------------------------------
-- 3) FONKSİYON ENVANTERİ — beklenen imzalar (tek kez, en son sürüm)
-- ----------------------------------------------------------------------------
with beklenen(sig, grup) as (
  values
    ('public.get_request_token()',                              'kimlik'),
    ('public.get_request_session()',                            'kimlik'),
    ('public.current_agent_id()',                               'kimlik'),
    ('public.can_write_profile(text)',                          'kimlik'),
    ('public.is_network_device(text)',                          'kimlik'),
    ('public.is_group_member(text,text)',                       'kimlik'),
    ('public.is_group_creator(text,text)',                      'kimlik'),
    ('public.protect_profile_trigger()',                        'trigger'),
    ('public.verify_message_sender()',                          'trigger'),
    ('public.verify_group_deletion()',                          'trigger'),
    ('public.push_dispatch_webhook()',                          'trigger'),
    ('public.generate_recovery_code()',                         'ağ RPC'),
    ('public.network_register(text,text,text,text)',            'ağ RPC'),
    ('public.network_login(text,text)',                         'ağ RPC'),
    ('public.network_logout(text)',                             'ağ RPC'),
    ('public.network_get_me(text)',                             'ağ RPC'),
    ('public.network_change_password(text,text,text)',          'ağ RPC'),
    ('public.network_claim_device(text,text,text)',             'ağ RPC'),
    ('public.network_touch_device(text,text)',                  'ağ RPC'),
    ('public.network_delete_account(text,text)',                'ağ RPC'),
    ('public.sinevia_delete_account(text,text)',                'ağ RPC'),
    ('public.push_pipeline_status()',                           'push'),
    ('public.push_self_test()',                                 'push'),
    ('public.sync_get_state(text)',                             'sync'),
    ('public.sync_commit(text,bigint,text,text,jsonb)',         'sync')
)
select
  b.grup,
  b.sig,
  case when to_regprocedure(b.sig) is null then 'YOK' else 'VAR' end as durum
from beklenen b
order by b.grup, b.sig;

-- Çakışan eski imza KALMAMALI (2 parametreli eski network_register).
select 'ESKI IMZA: public.network_register(text,text)' as kontrol,
       case when to_regprocedure('public.network_register(text,text)') is null
            then 'YOK (dogru)' else 'VAR (kanonik sema kaldiracak)' end as durum;


-- ----------------------------------------------------------------------------
-- 4) POLICY ENVANTERİ
-- ----------------------------------------------------------------------------
select
  p.tablename,
  p.policyname,
  p.cmd,
  array_to_string(p.roles, ',') as roller,
  case when p.qual is null then '-' else left(p.qual, 90) end as using_ifadesi,
  case when p.with_check is null then '-' else left(p.with_check, 90) end as with_check_ifadesi
from pg_policies p
where p.schemaname = 'public'
order by p.tablename, p.cmd, p.policyname;


-- ----------------------------------------------------------------------------
-- 5) TRIGGER ENVANTERİ (yalnızca uygulama trigger'ları)
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
-- 6) ANON / AUTHENTICATED TABLO YETKİLERİ (yalnızca görünürlük)
-- ----------------------------------------------------------------------------
select
  c.relname as tablo,
  coalesce(bool_or(a.privilege_type = 'SELECT'), false) as anon_select,
  coalesce(bool_or(a.privilege_type = 'INSERT'), false) as anon_insert,
  coalesce(bool_or(a.privilege_type = 'UPDATE'), false) as anon_update,
  coalesce(bool_or(a.privilege_type = 'DELETE'), false) as anon_delete,
  coalesce(bool_or(a.privilege_type = 'TRUNCATE'), false) as anon_truncate
from pg_class c
join pg_roles r on r.rolname in ('anon', 'authenticated')
left join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a on a.grantee = r.oid
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
group by c.relname
order by c.relname;


-- ----------------------------------------------------------------------------
-- 7) STORAGE — bulut arşiv sayısı (içerik okunmaz)
-- ----------------------------------------------------------------------------
select count(*) as bulut_arsiv_sayisi
from storage.objects
where bucket_id = 'sinevia_saves';
