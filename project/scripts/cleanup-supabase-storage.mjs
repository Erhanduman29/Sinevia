/**
 * SINEVIA — Supabase Storage Temizleme Scripti
 * ==============================================
 *
 * Bu script, `sinevia_saves` bucket'ındaki orphan (kullanılmayan)
 * archive dosyalarını tespit eder ve siler.
 *
 * KULLANIM:
 *   1. Supabase Dashboard > Settings > API'den `service_role` anahtarını kopyalayın.
 *   2. Aşağıdaki SUPABASE_SERVICE_ROLE_KEY değerini yapıştırın.
 *   3. Çalıştır: node scripts/cleanup-supabase-storage.mjs
 *
 * NE YAPAR:
 *   - `sinevia_saves` bucket'ındaki tüm dosyaları listeler
 *   - `app_saves` tablosundaki agent_id'lerle karşılaştırır
 *   - app_saves'ta olmayan agent dosyalarını siler (orphan temizliği)
 *   - Ne kadar boşaltıldığını raporlar
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// KENDİ BAĞLANTI BİLGİLERİNİ BURAYA YAPIŞTIR
// ============================================================================
const SUPABASE_URL = 'https://gropqzbuuhmwrtmrdntk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE';
// ============================================================================

const BUCKET = 'sinevia_saves';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  if (SUPABASE_SERVICE_ROLE_KEY === 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE') {
    console.error('❌ Lütfen SUPABASE_SERVICE_ROLE_KEY değerini scriptin başına yapıştırın.');
    process.exit(1);
  }

  console.log(`🔍 ${BUCKET} bucket taranıyor...`);

  // 1. Storage'daki tüm dosyaları listele
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: 1000 });

  if (listError) {
    console.error('❌ Storage listelenemedi:', listError.message);
    process.exit(1);
  }

  if (!files || files.length === 0) {
    console.log('✅ Bucket zaten boş. İşlem yok.');
    return;
  }

  console.log(`📦 Bucket'ta ${files.length} dosya bulundu.`);

  // 2. app_saves'taki tüm agent_id'leri al
  const { data: appSaves, error: appSavesError } = await supabase
    .from('app_saves')
    .select('agent_id');

  if (appSavesError) {
    console.error('❌ app_saves okunamadı:', appSavesError.message);
    process.exit(1);
  }

  const activeAgentIds = new Set((appSaves || []).map((r) => r.agent_id));
  console.log(`💾 app_saves'te ${activeAgentIds.size} aktif agent kaydı var.`);

  // 3. Orphan dosyaları tespit et (app_saves'ta olmayan agent dosyaları)
  const orphanFiles = [];
  const activeFiles = [];

  for (const file of files) {
    // Dosya adı formatı: <agentId>.json
    const agentId = file.name.replace('.json', '');
    if (activeAgentIds.has(agentId)) {
      activeFiles.push(file);
    } else {
      orphanFiles.push(file);
    }
  }

  console.log(`✅ Aktif dosya: ${activeFiles.length}`);
  console.log(`🗑️  Orphan (kullanılmayan) dosya: ${orphanFiles.length}`);

  if (orphanFiles.length === 0) {
    console.log('✅ Temizlenecek orphan dosya yok. Zaman ve kota zaten uygun.');
    return;
  }

  // 4. Orphan dosyaları sil
  const orphanNames = orphanFiles.map((f) => f.name);
  const { error: deleteError } = await supabase.storage
    .from(BUCKET)
    .remove(orphanNames);

  if (deleteError) {
    console.error('❌ Silme işlemi başarısız:', deleteError.message);
    process.exit(1);
  }

  // 5. Rapor
  const freedBytes = orphanFiles.reduce((sum, f) => sum + (f.metadata?.size || 0), 0);
  console.log(`\n✅ Temizleme tamamlandı!`);
  console.log(`   Silinen dosya sayısı: ${orphanFiles.length}`);
  console.log(`   Serbest bırakılan yaklaşık alan: ${(freedBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log('\nSilinen dosyalar:');
  for (const f of orphanFiles) {
    console.log(`   - ${f.name}`);
  }
}

main().catch((err) => {
  console.error('❌ Beklenmeyen hata:', err.message);
  process.exit(1);
});