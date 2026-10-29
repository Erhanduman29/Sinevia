import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/animations.css';
import { initInstallPromptCapture } from './lib/installPrompt';

// PWA kurulum olayı (`beforeinstallprompt`) sayfa açılışında, kullanıcı
// Ayarlar'ı açmadan önce tetiklenir. Dinleyici burada erkenden kurulmazsa
// "Uygulamayı Yükle" düğmesi hiçbir zaman tarayıcının kurulum penceresini
// açamaz. Üretimde ve geliştirmede zararsızdır.
initInstallPromptCapture();

// GELİŞTİRME TEMİZLİĞİ: Eski sürümlerden kalan dev service worker'ı ve önbellekleri
// kaldır. Aksi halde `vite dev` sırasında eski SW yeni JS yerine cache'teki sürümü
// servis edebiliyor; güncelleme sonrası "veriler gitti" görüntüsü oluşuyor.
// Üretim derlemesinde (import.meta.env.DEV = false) bu blok çalışmaz.
if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => { /* sessiz */ });
  if (typeof caches !== 'undefined') {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => { /* sessiz */ });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
