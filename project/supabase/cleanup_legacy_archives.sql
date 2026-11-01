-- ============================================================================
-- ESKİ STORAGE ARŞİVLERİNİ TEMİZLE (tek seferlik bakım)
-- ============================================================================
-- V3 öncesi bulut yedeği `sinevia_saves/<agentId>.json` olarak Storage'da
-- tutuluyordu. V3 artık `public.app_saves` tablosunu kullanıyor.
--
-- ÖNEMLİ: Storage nesneleri ASLA `delete from storage.objects` ile silinmez.
-- Bu, fiziksel dosyayı S3'te bırakır (orphan) ve kotayı düşürmez; yeni
-- Supabase sürümleri doğrudan SQL DELETE'i zaten reddeder.
--
-- Bu dosya yalnızca ÖNİZLEME sorgusu içerir. Silme için:
--   1. Supabase Dashboard → Storage → `sinevia_saves` bucket'ı.
--   2. Aşağıdaki listede görünen ve `app_saves` kaydı olan dosyaları seçip
--      arayüzden silin (Storage API kullanır, fiziksel dosyayı da kaldırır).
--   3. Uygulama, V3'e taşıdığı hesabın arşivini açılışta otomatik silmeyi
--      dener (RLS politikası: `sinevia_legacy_archive_delete_own`).
--
-- Henüz V3'e taşınmamış kullanıcıların arşivi korunmalıdır; listede yalnız
-- `app_saves` satırı olan hesaplar görünür.
-- ============================================================================

select
  o.name as archive_object,
  pg_size_pretty((o.metadata->>'size')::bigint) as size,
  o.updated_at,
  s.revision as app_saves_revision,
  s.updated_at as app_saves_updated_at
from storage.objects o
join public.app_saves s
  on o.name = s.agent_id || '.json'
where o.bucket_id = 'sinevia_saves'
order by o.updated_at asc;
