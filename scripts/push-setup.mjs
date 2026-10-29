#!/usr/bin/env node
/* ============================================================
   SINEVIA — WEB PUSH KURULUMU (tek komut)
   ============================================================
   Kullanım:  npm run push:setup

   Sırayla:
     1) VAPID anahtarlarını üretir (yoksa) ve .env dosyasına yazar,
     2) Supabase CLI ile giriş yapar (gerekirse tarayıcı açar),
     3) Projeyi bağlar,
     4) 006_web_push.sql migration'ını uygular,
     5) Edge Function secret'larını yükler,
     6) `send-push` fonksiyonunu yayına alır,
     7) Yapılacakları ekrana yazar.

   Not: Bu betik veri silmez, tekrar çalıştırılabilir.
   ============================================================ */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(projectRoot, '.env');
const envExamplePath = join(projectRoot, '.env.example');
const vapidPath = join(projectRoot, '.vapid.json');
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:destek@sinevia.app';

const isWindows = process.platform === 'win32';
const npx = isWindows ? 'npx.cmd' : 'npx';

function log(step, text) {
  console.log(`\n[${step}] ${text}`);
}

function run(args, { capture = false, allowFailure = false } = {}) {
  const result = spawnSync(npx, args, {
    cwd: projectRoot,
    shell: isWindows,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0 && !allowFailure) {
    const detail = capture ? `\n${result.stderr || ''}` : '';
    throw new Error(`Komut başarısız: npx ${args.join(' ')}${detail}`);
  }
  return result;
}

function detectProjectRef() {
  try {
    const source = readFileSync(join(projectRoot, 'src', 'lib', 'supabase.ts'), 'utf8');
    const match = source.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
    if (match) return match[1];
  } catch {
    /* yoksay */
  }
  return null;
}

function loadVapidKeys() {
  if (existsSync(vapidPath)) {
    try {
      const parsed = JSON.parse(readFileSync(vapidPath, 'utf8'));
      if (parsed.publicKey && parsed.privateKey) return parsed;
    } catch {
      /* bozuksa yeniden üret */
    }
  }

  log('1/6', 'VAPID anahtarları üretiliyor...');
  const result = run(['--yes', 'web-push@3.6.7', 'generate-vapid-keys', '--json'], { capture: true });
  const raw = `${result.stdout || ''}${result.stderr || ''}`;
  const match = raw.match(/\{[\s\S]*"publicKey"[\s\S]*\}/);
  if (!match) throw new Error('VAPID anahtarları okunamadı. Çıktı:\n' + raw);

  const keys = JSON.parse(match[0]);
  if (!keys.publicKey || !keys.privateKey) throw new Error('VAPID anahtarları eksik döndü.');

  writeFileSync(vapidPath, JSON.stringify(keys, null, 2), 'utf8');
  console.log('    Anahtarlar .vapid.json dosyasına kaydedildi (git deposuna eklenmez).');
  return keys;
}

function writeEnvKey(key, value) {
  let content = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');

  if (pattern.test(content)) {
    content = content.replace(pattern, line);
  } else {
    if (content.length > 0 && !content.endsWith('\n')) content += '\n';
    content += `${line}\n`;
  }

  writeFileSync(envPath, content, 'utf8');
  console.log(`    .env güncellendi: ${line}`);
}

function ensureEnvExampleKey(key) {
  try {
    if (!existsSync(envExamplePath)) return;
    const content = readFileSync(envExamplePath, 'utf8');
    if (new RegExp(`^${key}=`, 'm').test(content)) return;
    const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    writeFileSync(envExamplePath, `${content}${prefix}${key}=\n`, 'utf8');
  } catch {
    /* örnek dosya kritik değil */
  }
}

function main() {
  const projectRef = detectProjectRef();
  if (!projectRef) {
    throw new Error('Supabase proje kimliği bulunamadı (src/lib/supabase.ts).');
  }

  console.log('============================================');
  console.log(' SINEVIA — Web Push kurulumu');
  console.log(` Proje: ${projectRef}`);
  console.log('============================================');

  const vapidKeys = loadVapidKeys();
  writeEnvKey('VITE_VAPID_PUBLIC_KEY', vapidKeys.publicKey);
  ensureEnvExampleKey('VITE_VAPID_PUBLIC_KEY');

  log('2/6', 'Supabase CLI hazırlanıyor (ilk çalıştırmada birkaç dakika sürebilir)...');
  run(['--yes', 'supabase@latest', '--version']);

  log('3/6', 'Supabase hesabı kontrol ediliyor...');
  const whoami = run(['--yes', 'supabase@latest', 'projects', 'list'], {
    capture: true,
    allowFailure: true,
  });

  if (whoami.status !== 0) {
    console.log('    Giriş yapılmamış. Tarayıcı açılacak; giriş yaptıktan sonra bu ekrana dönün.');
    run(['--yes', 'supabase@latest', 'login']);
  } else {
    console.log('    Giriş yapılmış.');
  }

  log('4/6', 'Proje bağlanıyor...');
  run(['--yes', 'supabase@latest', 'link', '--project-ref', projectRef]);

  log('5/6', 'Veritabanı güncellemesi (006_web_push.sql) uygulanıyor...');
  const dbPush = run(['--yes', 'supabase@latest', 'db', 'push'], { allowFailure: true });
  if (dbPush.status !== 0) {
    console.log(
      '\n    UYARI: Veritabanı güncellemesi tamamlanamadı.\n' +
        '    Supabase panelinde Database > Extensions bölümünde "pg_net" eklentisini açıp\n' +
        '    ardından `npx supabase db push` komutunu tekrar çalıştırın.',
    );
  }

  log('6/6', 'Edge Function secret\'ları ve yayın...');
  run([
    '--yes',
    'supabase@latest',
    'secrets',
    'set',
    `VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`,
    `VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`,
    `VAPID_SUBJECT=${VAPID_SUBJECT}`,
  ]);

  run([
    '--yes',
    'supabase@latest',
    'functions',
    'deploy',
    'send-push',
    '--no-verify-jwt',
  ]);

  console.log('\n============================================');
  console.log(' KURULUM TAMAMLANDI');
  console.log('============================================');
  console.log('\n1) Vercel/Netlify panelinde şu ortam değişkenini ekleyin:');
  console.log(`   VITE_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
  console.log('   Sonra siteyi yeniden deploy edin (yoksa istemci push abonesi olamaz).\n');
  console.log('2) Telefonda/bilgisayarda siteyi açın:');
  console.log('   Ayarlar > Bildirimler > "Cihaz Bildirimleri"ni açın > "Test Bildirimi Gönder".');
  console.log('   iPhone/iPad: siteyi Safari\'de "Ana Ekrana Ekle" ile yükleyip oradan açın.\n');
  console.log('3) Uçtan uca test: başka bir hesapla mesaj gönderin;');
  console.log('   uygulama tamamen kapalıyken de bildirim düşmelidir.\n');
  console.log('Not: Yerel test `npm run build && npm run preview` ile yapılmalı;');
  console.log('     `npm run dev` geliştirme modunda service worker kapatılır.\n');
}

try {
  main();
} catch (err) {
  console.error('\nKURULUM BAŞARISIZ:', err instanceof Error ? err.message : err);
  process.exit(1);
}
