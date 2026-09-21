import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
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
            // Otomatik oluşturulan 192x192 PNG
            src: 'https://placehold.co/192x192/090a0f/3b82f6.png?text=S',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            // Otomatik oluşturulan 512x512 PNG
            src: 'https://placehold.co/512x512/090a0f/3b82f6.png?text=Sinevia',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
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
  ]
});