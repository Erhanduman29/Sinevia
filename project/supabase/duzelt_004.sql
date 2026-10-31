-- ============================================================
-- SINEVIA — 004 ONARIM + ÖNBELLEK YENİLEME
-- ============================================================
-- Ne yapar?
--   1. Sunucunun (PostgREST) şema önbelleğini yeniler.
--   2. Ardından TEK bir tablo halinde durumu raporlar.
--
-- Ne YAPMAZ?
--   Tablo silmez, veri silmez, profiles'a dokunmaz.
--   Policy'leri de değiştirmez (zaten doğru kurulmuşlar).
--
-- Neden bu dosya?
--   "policy ... already exists" hatası, 004'ün DAHA ÖNCE başarıyla
--   çalıştığını gösterir. Yani tablolar ve policy'ler yerinde.
--   Kalan tek iş, sunucunun yeni fonksiyonu tanıması.
-- ============================================================

notify pgrst, 'reload schema';

-- Tek sonuç tablosu (SQL Editor yalnızca son sonucu gösterir).
select '1) Ağ tablosu' as bolum, 'network_accounts' as kontrol,
       case when to_regclass('public.network_accounts') is null then 'YOK' else 'VAR' end as deger
union all
select '1) Ağ tablosu', 'network_sessions',
       case when to_regclass('public.network_sessions') is null then 'YOK' else 'VAR' end
union all
select '1) Ağ tablosu', 'login_attempts',
       case when to_regclass('public.login_attempts') is null then 'YOK' else 'VAR' end

union all
select '2) network_register sürümü', '4 parametreli (YENİ — olması gereken)',
       case when exists (
              select 1 from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public'
                and p.proname = 'network_register'
                and pg_get_function_identity_arguments(p.oid) like '%p_agent_id%'
            ) then 'VAR' else 'YOK' end
union all
select '2) network_register sürümü', '2 parametreli (ESKİ — kalmamalı)',
       case when exists (
              select 1 from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public'
                and p.proname = 'network_register'
                and pg_get_function_identity_arguments(p.oid) = 'p_username text, p_password text'
            ) then 'VAR' else 'yok' end

union all
select '3) Diğer RPC', p.proname, 'VAR'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in (
     'network_login','network_logout','network_get_me',
     'network_change_password','network_delete_account'
   )

union all
select '4) Önbellek', 'reload bildirimi', 'gönderildi'

order by bolum, kontrol;
