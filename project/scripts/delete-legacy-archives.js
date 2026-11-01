/**
 * scripts/delete-legacy-archives.js
 * 
 * Eski Storage arşivlerini (sinevia_saves/<agentId>.json) toplu siler.
 * SADECE app_saves tablosunda KAYDI OLMAYAN agent_id'lere ait dosyalar silinir.
 * 
 * KULLANIM:
 *   1. .env dosyasına SUPABASE_SERVICE_ROLE_KEY ekle (Dashboard → Settings → API → service_role)
 *   2. node scripts/delete-legacy-archives.js
 *   3. Listeyi onayla → "EVET" yaz → Enter
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'sinevia_saves';
const BATCH_SIZE = 100;

// KORUNACAK AGENT_ID'LER (senin listenden)
const PROTECTED_AGENT_IDS = new Set([
  'SNV-0MBG-NFCT',
  'SNV-0S0T-Q0Y1',
  'SNV-GRPE-HEQE',
  'SNV-PEY9-TZRX',
  'SNV-Q0QV-YTGP',
  'SNV-Y8YD-ORST',
  'SNV-ZTOH-1NIC',
]);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ .env dosyasında VITE_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY olmalı!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function confirm(prompt) {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(`\n${prompt} (EVET/hayır): `);
  rl.close();
  return answer.trim().toUpperCase() === 'EVET';
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SINEVIA — Eski Storage Arşivi Temizleyici');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Aktif hesapları al (app_saves)
  console.log('🔍 Aktif hesaplar (app_saves) alınıyor...');
  const { data: saves, error: savesErr } = await supabase
    .from('app_saves')
    .select('agent_id, updated_at, revision')
    .order('updated_at', { ascending: false });

  if (savesErr) throw savesErr;

  const activeAgentIds = new Set(saves.map(s => s.agent_id));
  
  console.log(`\n📋 AKTIF HESAPLAR (${activeAgentIds.size} adet):`);
  console.log('────────────────────────────────────────────────────────────');
  saves.forEach((s, i) => {
    const date = new Date(s.updated_at).toLocaleString('tr-TR');
    console.log(`  ${i + 1}. ${s.agent_id}  |  rev: ${s.revision}  |  ${date}`);
  });
  console.log('────────────────────────────────────────────────────────────\n');

  // 2. Storage'daki TÜM dosyaları listele
  console.log('📦 Storage dosyaları listeleniyor...');
  let allFiles = [];
  let offset = 0;
  const LIMIT = 1000;

  while (true) {
    const { data: files, error: listErr } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: LIMIT, offset });

    if (listErr) throw listErr;
    if (!files.length) break;

    allFiles.push(...files);
    offset += LIMIT;
  }

  console.log(`📦 Storage'da TOPLAM ${allFiles.length} dosya bulundu.\n`);

  // 3. Dosyaları ayır: KORUNACAK vs SİLİNECEK
  // KORUMA: PROTECTED_AGENT_IDS listesindekiler + app_saves'tekiler
  const toKeep = [];
  const toDelete = [];

  for (const file of allFiles) {
    const agentId = file.name.replace('.json', '');
    const isProtected = PROTECTED_AGENT_IDS.has(agentId) || activeAgentIds.has(agentId);
    if (isProtected) {
      toKeep.push({ agentId, file });
    } else {
      toDelete.push({ agentId, file });
    }
  }

  // 4. ÖZET GÖSTER
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ÖZET');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`🛡️  MANUEL KORUMA LİSTESİ (${PROTECTED_AGENT_IDS.size} adet):`);
  Array.from(PROTECTED_AGENT_IDS).forEach((id, i) => {
    const inAppSaves = activeAgentIds.has(id) ? ' ✓' : '';
    console.log(`   ${i + 1}. ${id}${inAppSaves}`);
  });
  console.log('');

  console.log(`\n✅ KORUNACAK (koruma listesinde VEYA app_saves kaydı VAR): ${toKeep.length} dosya`);
  if (toKeep.length > 0) {
    console.log('   İlk 10:');
    toKeep.slice(0, 10).forEach(({ agentId, file }) => {
      const sizeKB = (file.metadata?.size / 1024).toFixed(1);
      console.log(`     • ${agentId}.json  (${sizeKB} KB)`);
    });
    if (toKeep.length > 10) console.log(`     ... ve ${toKeep.length - 10} dosya daha`);
  }

  console.log(`\n🗑️  SİLİNECEK (app_saves kaydi YOK - ORPHAN): ${toDelete.length} dosya`);
  if (toDelete.length > 0) {
    console.log('   İlk 10:');
    toDelete.slice(0, 10).forEach(({ agentId, file }) => {
      const sizeKB = (file.metadata?.size / 1024).toFixed(1);
      const updated = file.updated_at ? new Date(file.updated_at).toLocaleString('tr-TR') : 'bilinmiyor';
      console.log(`     • ${agentId}.json  (${sizeKB} KB, ${updated})`);
    });
    if (toDelete.length > 10) console.log(`     ... ve ${toDelete.length - 10} dosya daha`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');

  // 5. ONAY İSTE
  if (toDelete.length === 0) {
    console.log('\n✅ Silinecek orphan dosya YOK. İşlem gerekmez.\n');
    return;
  }

  console.log(`\n⚠️  UYARI: ${toDelete.length} dosya KALICI OLARAK SİLİNECEK!`);
  console.log('   Bu işlem GERİ ALINAMAZ. Storage API kullanılır (gerçek silme).');
  console.log('   KORUNACAK dosyalara DOKUNMUYORUZ.\n');

  const ok = await confirm(`Emin misiniz? "${toDelete.length} orphan dosya" silinsin mi?`);
  
  if (!ok) {
    console.log('\n❌ İptal edildi. Hiçbir dosya silinmedi.\n');
    return;
  }

  // 6. SİLME
  console.log('\n🗑️  Silme başlıyor...\n');
  let deleted = 0;
  let errors = 0;

  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE).map(x => x.file.name);
    const { error: delErr } = await supabase.storage
      .from(BUCKET)
      .remove(batch);

    if (delErr) {
      console.error(`❌ Batch ${i}: ${delErr.message}`);
      errors += batch.length;
    } else {
      deleted += batch.length;
      console.log(`✅ ${batch.length} dosya silindi (${deleted}/${toDelete.length})`);
    }
  }

  // 7. SONUÇ
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  TAMAMLANDI');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Başarıyla silinen: ${deleted}`);
  console.log(`❌ Hatalı: ${errors}`);
  console.log(`📦 Kalan (korunan): ${toKeep.length}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n❌ KRİTİK HATA:', err.message);
  process.exit(1);
});