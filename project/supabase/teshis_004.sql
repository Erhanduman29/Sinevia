-- ============================================================
-- SINEVIA — 004 TEŞHİS (SALT OKUNUR, HİÇBİR ŞEY DEĞİŞTİRMEZ)
-- ============================================================
-- "Could not find the function public.network_register(...) in the
-- schema cache" hatasının sebebini bulur.
-- Tek sorgu → tek sonuç tablosu. Sonucu olduğu gibi paylaş.
-- ============================================================

select '1) Tablo var mı?' as bolum,
       'network_accounts' as kontrol,
       case when to_regclass('public.network_accounts') is null then 'YOK' else 'VAR' end as deger
union all
select '1) Tablo var mı?', 'network_sessions',
       case when to_regclass('public.network_sessions') is null then 'YOK' else 'VAR' end
union all
select '1) Tablo var mı?', 'login_attempts',
       case when to_regclass('public.login_attempts') is null then 'YOK' else 'VAR' end

union all
select '2) Fonksiyonlar',
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       'VAR'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname like 'network_%'

union all
select '3) Ağ hesabı sayısı', 'network_accounts kayıt',
       case when to_regclass('public.network_accounts') is null then 'tablo yok'
            else (xpath('/row/c/text()',
                        query_to_xml('select count(*) as c from public.network_accounts',
                                     false, true, '')))[1]::text
       end

union all
select '4) Eski tip kontrolü', 'network_register 2 parametreli (ESKİ) sürüm',
       case when exists (
              select 1 from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public'
                and p.proname = 'network_register'
                and pg_get_function_identity_arguments(p.oid) = 'p_username text, p_password text'
            ) then 'VAR — güncel 004 çalıştırılmalı' else 'yok' end
union all
select '4) Eski tip kontrolü', 'network_register 4 parametreli (YENİ) sürüm',
       case when exists (
              select 1 from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public'
                and p.proname = 'network_register'
                and pg_get_function_identity_arguments(p.oid) like '%p_agent_id%'
            ) then 'VAR — doğru' else 'YOK' end

order by bolum, kontrol;
