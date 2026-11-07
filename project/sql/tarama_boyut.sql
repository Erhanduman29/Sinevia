-- ============================================================================
-- SINEVIA — SUPABASE BOYUT TARAMASI (SALT-OKUNUR, HİÇBİR ŞEYİ DEĞİŞTİRMEZ)
-- ============================================================================
-- Bu dosyayı Supabase SQL Editor'de çalıştırın.
-- Veriyi silmez, tabloları bozmaz, sadece ölçüm yapar.
-- ============================================================================

-- 1) Veritabanı ve şema boyutu
SELECT pg_size_pretty(pg_database_size(current_database())) AS veritabani_boyutu;

-- 2) En büyük tablolar (tablo + TOAST + index)
SELECT
  n.nspname AS schema,
  c.relname AS tablo,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS toplam_boyut,
  pg_size_pretty(pg_relation_size(c.oid)) AS veri_boyutu,
  pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) AS index_ve_diger,
  pg_stat.n_live_tup AS satir_sayisi
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_stat_user_tables pg_stat ON pg_stat.relid = c.oid
WHERE n.nspname = 'public'
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 15;

-- 3) app_saves payload boyutları (tek kayıt en büyük ve en çok yer kaplayan)
SELECT
  agent_id,
  pg_size_pretty(pg_column_size(payload)) AS payload_boyutu,
  length(payload::text) AS json_karakter,
  revision,
  updated_at
FROM public.app_saves
ORDER BY pg_column_size(payload) DESC
LIMIT 10;

-- 4) Teknik kayıtların büyümesi (kullanıcı verisi yok, sadece log/oturum)
SELECT 'network_logs' AS tablo, count(*) AS satir_sayisi FROM public.network_logs
UNION ALL
SELECT 'login_attempts', count(*) FROM public.login_attempts
UNION ALL
SELECT 'network_sessions', count(*) FROM public.network_sessions
UNION ALL
SELECT 'push_subscriptions', count(*) FROM public.push_subscriptions;

-- 5) Hiç kullanılmayan index'ler (kaldırılabilir, yer kazanır)
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS boyut
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- 6) Ölü satırlar (autovacuum bekleyen silinen/güncellenmiş satırlar)
SELECT
  schemaname,
  relname AS tablo,
  n_dead_tup AS ole_satir,
  last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY n_dead_tup DESC
LIMIT 10;

-- ============================================================================
-- BİTİŞ — bu dosyadan sonra hiçbir şey çalışmaz.
-- ============================================================================
