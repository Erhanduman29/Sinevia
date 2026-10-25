import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        // Geliştirme sırasında service worker, güncelleme reload'larında eski önbelleği
        // servis edip veri kaybı yanılsaması/çakışması yaratabiliyor. Prod PWA etkilenmez.
        enabled: false
      },
      manifest: {
        name: 'Sinevia - Sinema Takip',
        short_name: 'Sinevia',
        description: 'Kişisel ve yerel sinema kütüphaneniz',
        theme_color: '#090a0f',
        background_color: '#090a0f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
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