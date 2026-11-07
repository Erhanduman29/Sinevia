-- ============================================================================
-- SUPABASE FREE PLANI — TEKNİK KAYIT TEMİZLİĞİ (RETENTION)
-- ============================================================================
-- AÇIKLAMA: Sadece TEKNİK KAYITLAR temizlenir.
--           history (izleme geçmişi), profiles, film/dizi detayları DOKUNULMAZ.
--           Şema bozulmaz (yeni sütun/tablo yok, DELETE-only).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) APP_SAVES — kullanılmayan gzip kopyası (disk geri kazanımı)
--    payload_gz hiçbir okuma yolunda kullanılmıyor; sadece diskte ikinci kopya.
--    (Kolon yoksa bu satır hata verir; önce sync_commit_fix.sql çalıştırılmalı.)
-- ----------------------------------------------------------------------------
update public.app_saves
set payload_gz = null
where payload_gz is not null;

-- ----------------------------------------------------------------------------
-- 1) NETWORK_LOGS — ana sayfa akışı
--    Kural: Agent başına en son 1000 kayıt tutulur; 12 aydan eski olanlar silinir.
-- ----------------------------------------------------------------------------

-- 1a) 12 aydan eski tüm ağ akış kayıtlarını sil
delete from public.network_logs
where created_at < now() - interval '12 months';

-- 1b) Agent başına 1000'den fazla kayıt varsa, en eski olanları sil
with ranked_logs as (
  select id,
         row_number() over (
           partition by agent_id
           order by created_at desc
         ) as rn
  from public.network_logs
)
delete from public.network_logs
where id in (
  select id from ranked_logs where rn > 1000
);

-- ----------------------------------------------------------------------------
-- 2) NETWORK_SESSIONS — ağ giriş oturumları (30 gün geçerlilik)
--    Kural: expires_at'inden süresi geçmiş oturumları sil.
-- ----------------------------------------------------------------------------
delete from public.network_sessions
where expires_at < now();

-- ----------------------------------------------------------------------------
-- 3) LOGIN_ATTEMPTS — giriş denemeleri (rate limiting)
--    Kural: 30 günden eski kayıtları sil.
-- ----------------------------------------------------------------------------
delete from public.login_attempts
where attempted_at < now() - interval '30 days';

-- ----------------------------------------------------------------------------
-- 4) PUSH_SUBSCRIPTIONS — web push abonelikleri
--    Kural: 90 günden eski (created_at veya last_seen_at) kayıtları sil.
-- ----------------------------------------------------------------------------
delete from public.push_subscriptions
where last_seen_at < now() - interval '90 days'
   or created_at < now() - interval '90 days';

-- ----------------------------------------------------------------------------
-- RAPOR — temizlikten sonra kalan satır sayısı
-- ----------------------------------------------------------------------------
select 'network_logs' as tablo, count(*)::text as kalan_satir
  from public.network_logs
union all
select 'network_sessions', count(*)::text
  from public.network_sessions
union all
select 'login_attempts', count(*)::text
  from public.login_attempts
union all
select 'push_subscriptions', count(*)::text
  from public.push_subscriptions
order by 1;
