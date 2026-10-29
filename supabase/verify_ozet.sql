-- ============================================================
-- SINEVIA — TEK SORGU ÖZET DOĞRULAMA (SALT OKUNUR)
-- ============================================================
-- NEDEN BU DOSYA VAR?
-- Supabase SQL Editor, bir betikte birden fazla sorgu varsa yalnızca
-- EN SON sorgunun sonucunu gösterir. verify.sql içinde 9 sorgu olduğu
-- için sadece son satır (bulut_arsiv_sayisi) görünür.
--
-- Bu dosya TEK bir sorgudur: tüm önemli sayıları tek tabloda döndürür.
-- Hiçbir şeyi değiştirmez, silmez.
--
-- Kullanım: dosyanın TAMAMINI kopyala -> SQL Editor -> Run.
-- "deger" ile "beklenen" aynı olmalı.
-- ============================================================

select '1) Tablo satır sayısı' as bolum, 'profiles' as kontrol,
       count(*)::text as deger, '8' as beklenen
  from public.profiles
union all
select '1) Tablo satır sayısı', 'friendships', count(*)::text, '3'
  from public.friendships
union all
select '1) Tablo satır sayısı', 'network_logs', count(*)::text, '493'
  from public.network_logs
union all
select '1) Tablo satır sayısı', 'messages', count(*)::text, '11'
  from public.messages
union all
select '1) Tablo satır sayısı', 'recommendations', count(*)::text, '0'
  from public.recommendations
union all
select '1) Tablo satır sayısı', 'chat_groups', count(*)::text, '0'
  from public.chat_groups
union all
select '1) Tablo satır sayısı', 'chat_group_members', count(*)::text, '0'
  from public.chat_group_members
union all
select '1) Tablo satır sayısı', 'bulut arşivi (storage)', count(*)::text, '141'
  from storage.objects
 where bucket_id = 'sinevia_saves'

union all
select '2) RLS kilidi', relname,
       case when relrowsecurity then 'AÇIK' else 'KAPALI' end, 'AÇIK'
  from pg_class
 where relnamespace = 'public'::regnamespace
   and relname in (
     'profiles','friendships','network_logs','recommendations',
     'messages','chat_groups','chat_group_members'
   )

union all
select '3) Policy (kural)', 'toplam policy sayısı', count(*)::text, '27'
  from pg_policies
 where schemaname = 'public'
   and tablename in (
     'profiles','friendships','network_logs','recommendations',
     'messages','chat_groups','chat_group_members'
   )
union all
select '3) Policy (kural)', 'profiles: anon select (0 olmalı)', count(*)::text, '0'
  from pg_policies
 where schemaname = 'public'
   and tablename = 'profiles'
   and cmd = 'SELECT'
   and 'anon'::name = any(roles)
union all
select '3) Policy (kural)', 'profiles: secret_token anon yetkisi (0 olmalı)', count(*)::text, '0'
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name = 'profiles'
   and column_name = 'secret_token'
   and grantee = 'anon'

union all
select '4) Fonksiyon', 'public fonksiyon sayısı', count(*)::text, '5 veya daha fazla'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'

union all
select '5) Ağ hesabı (004)', 'network_accounts tablosu',
       case when to_regclass('public.network_accounts') is null
            then 'YOK — 004 çalıştırılmadı' else 'VAR' end,
       'VAR'
union all
select '5) Ağ hesabı (004)', 'network_sessions tablosu',
       case when to_regclass('public.network_sessions') is null then 'YOK' else 'VAR' end,
       'VAR'
union all
select '5) Ağ hesabı (004)', 'login_attempts tablosu',
       case when to_regclass('public.login_attempts') is null then 'YOK' else 'VAR' end,
       'VAR'
union all
select '5) Ağ hesabı (004)', 'network_register RPC',
       case when exists (
              select 1 from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'network_register'
            ) then 'VAR' else 'YOK' end,
       'VAR'
union all
select '5) Ağ hesabı (004)', 'network_login RPC',
       case when exists (
              select 1 from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'network_login'
            ) then 'VAR' else 'YOK' end,
       'VAR'
union all
select '5) Ağ hesabı (004)', 'network_get_me RPC',
       case when exists (
              select 1 from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'network_get_me'
            ) then 'VAR' else 'YOK' end,
       'VAR'
union all
select '5) Ağ hesabı (004)', 'network_delete_account RPC',
       case when exists (
              select 1 from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'network_delete_account'
            ) then 'VAR' else 'YOK' end,
       'VAR'

order by bolum, kontrol;
