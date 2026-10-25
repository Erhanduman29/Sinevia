-- ============================================================
-- SINEVIA — SALT OKUNUR DOĞRULAMA
-- ============================================================
-- Bu dosya HİÇBİR ŞEY DEĞİŞTİRMEZ. Sadece durumu raporlar.
-- 001/002/003 öncesi ve sonrası çalıştırıp sonuçları karşılaştırın.
-- ============================================================

-- 1) Tablo satır sayıları (yedek öncesi/sonrası aynı olmalı)
select 'profiles' as tablo, count(*) as kayit from public.profiles
union all select 'friendships', count(*) from public.friendships
union all select 'network_logs', count(*) from public.network_logs
union all select 'recommendations', count(*) from public.recommendations
union all select 'messages', count(*) from public.messages
union all select 'chat_groups', count(*) from public.chat_groups
union all select 'chat_group_members', count(*) from public.chat_group_members
order by tablo;

-- 2) İstemcinin beklediği kolonlar var mı?
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'profiles' and column_name in (
      'agent_id','nickname','level','total_xp','movies_watched','past_movies_watched',
      'series_watched','episodes_watched','achievements_unlocked','quests_completed',
      'currently_watching','showcase','secret_token','last_cloud_sync','last_seen'
    ))
    or (table_name = 'network_logs' and column_name in ('review_tags','is_spoiler','action_type'))
    or (table_name = 'messages' and column_name in ('group_id','is_read','receiver_id'))
  )
order by table_name, column_name;

-- 3) Yetim (orphan) kayıtlar — SİLME YOK, sadece sayım
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
select 'friendships requester yetim', count(*)
from public.friendships f
left join public.profiles p on p.agent_id = f.requester_id
where f.requester_id is not null and p.agent_id is null
union all
select 'friendships receiver yetim', count(*)
from public.friendships f
left join public.profiles p on p.agent_id = f.receiver_id
where f.receiver_id is not null and p.agent_id is null
union all
select 'network_logs.agent_id yetim', count(*)
from public.network_logs l
left join public.profiles p on p.agent_id = l.agent_id
where l.agent_id is not null and p.agent_id is null
union all
select 'recommendations.sender yetim', count(*)
from public.recommendations r
left join public.profiles p on p.agent_id = r.sender_id
where r.sender_id is not null and p.agent_id is null
union all
select 'recommendations.receiver yetim', count(*)
from public.recommendations r
left join public.profiles p on p.agent_id = r.receiver_id
where r.receiver_id is not null and p.agent_id is null;

-- 4) Kural ihlalleri (silmeden önce görülmeli)
select 'network_logs.action_type NULL/boş' as kontrol, count(*) as adet
from public.network_logs
where action_type is null or btrim(action_type) = ''
union all
select 'messages boş içerik', count(*)
from public.messages
where content is null or btrim(content) = ''
union all
select 'recommendations geçersiz status', count(*)
from public.recommendations
where status is not null and status not in ('pending','accepted','rejected','viewed')
union all
select 'profiles negatif XP / seviye', count(*)
from public.profiles
where total_xp < 0 or level < 1
union all
select 'profiles boş secret_token', count(*)
from public.profiles
where secret_token is null or btrim(secret_token) = '';

-- 5) Olası mükerrer arkadaşlık çiftleri
select requester_id, receiver_id, count(*) as adet
from public.friendships
group by requester_id, receiver_id
having count(*) > 1
order by adet desc;

-- 6) RLS durumu (hepsi true olmalı)
select relname as tablo, relrowsecurity as rls_aktif, relforcerowsecurity as rls_zorunlu
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'profiles','friendships','network_logs','recommendations',
    'messages','chat_groups','chat_group_members'
  )
order by relname;

-- 7) Policy listesi
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles','friendships','network_logs','recommendations',
    'messages','chat_groups','chat_group_members'
  )
order by tablename, policyname;

-- 8) Index listesi
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'profiles','friendships','network_logs','recommendations',
    'messages','chat_groups','chat_group_members'
  )
order by tablename, indexname;

-- 9) Storage arşiv sayısı (içerik okunmaz)
select count(*) as bulut_arsiv_sayisi
from storage.objects
where bucket_id = 'sinevia_saves';
