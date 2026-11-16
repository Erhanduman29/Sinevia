import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * `APP_VERSION` değerini tek kaynaktan (src/lib/appVersion.ts) okuyup
 * derleme çıktısına `/version.json` olarak yazar. İstemci bu dosyayı
 * `no-store` ile çekip yüklü sürümle karşılaştırarak, service worker
 * önbelleğinde takılı kalan cihazları otomatik günceller.
 */
function appVersionManifest(): Plugin {
  let version = '0.0.0';
  return {
    name: 'sinevia-app-version-manifest',
    apply: 'build',
    buildStart() {
      const source = readFileSync(
        fileURLToPath(new URL('./src/lib/appVersion.ts', import.meta.url)),
        'utf8',
      );
      version = /APP_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(source)?.[1] ?? '0.0.0';
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version, builtAt: new Date().toISOString() }),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    appVersionManifest(),
    VitePWA({
      registerType: 'autoUpdate',
      // Kayıt işlemi src/lib/pwaUpdate.ts içinde `virtual:pwa-register` ile
      // yapılır. Otomatik enjekte edilen düz `registerSW.js` güncelleme
      // sonrası sayfayı yenilemediği için mobil PWA'lar eski sürümde kalıyordu.
      injectRegister: false,
      devOptions: {
        // Geliştirme sırasında service worker, güncelleme reload'larında eski önbelleği
        // servis edip veri kaybı yanılsaması/çakışması yaratabiliyor. Prod PWA etkilenmez.
        enabled: false
      },
      manifest: {
        // `id` ve `scope` sabit: kurulum kimliği start_url değişse bile bozulmasın.
        id: '/',
        name: 'Sinevia - Sinema Takip',
        short_name: 'Sinevia',
        description: 'Kişisel ve yerel sinema kütüphaneniz',
        lang: 'tr',
        theme_color: '#090a0f',
        background_color: '#090a0f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        prefer_related_applications: false,
        icons: [
          {
            // Statik (animasyonsuz) Sini maskotu
            src: 'sini.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'sini.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          },
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // `injectRegister: false` kullanıldığında plugin bu iki bayrağı otomatik
        // açmıyor. Yeni service worker'ın beklemeden devreye girmesi ve açık
        // sayfaları devralması için açıkça set edilmeli.
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // public/push-sw.js → Web Push + bildirime tıklama davranışı.
        // public/update-sw.js → yeni SW aktif olunca eski sürümdeki açık
        // sayfaları (özellikle ana ekran PWA'larını) otomatik yeniler.
        importScripts: ['push-sw.js', 'update-sw.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/image\.tmdb\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tmdb-poster-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        // Büyük ve seyrek değişen bağımlılıkları ayrı parçalara al: ana uygulama
        // kodu değiştiğinde tarayıcı bu parçaları yeniden indirmez.
        manualChunks(id) {
          const path = id.replace(/\\/g, '/');
          if (!path.includes('node_modules')) return undefined;
          if (path.includes('/@supabase/')) return 'vendor-supabase';
          if (path.includes('/lucide-react/')) return 'vendor-icons';
          if (
            path.includes('/react/') ||
            path.includes('/react-dom/') ||
            path.includes('/scheduler/')
          ) {
            return 'vendor-react';
          }
          return 'vendor';
        }
      }
    }
  }
});