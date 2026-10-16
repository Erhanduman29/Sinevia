/**
 * Platform uygulama derin-link (deep-link) + web yedeği.
 *
 * Bir platform adına (ör. "Netflix") göre: uygulama yüklüyse özel şemasıyla
 * açmayı dener (gizli iframe — sayfadan ayrılmadan), kısa süre sonra hâlâ
 * sitede kaldıysak web aramasına yönlendirir.
 */

interface PlatformLink {
  /** Uygulama özel şeması (varsa). Örn. "netflix://". */
  scheme?: string;
  /** Web'de arama/sayfa URL'i (yedek). */
  webUrl: (q: string) => string;
}

/** Anahtar = providerName'in küçük harfli alt-dizesi. İlk eşleşen kullanılır. */
const PLATFORM_LINKS: Record<string, PlatformLink> = {
  netflix: {
    scheme: 'netflix://',
    webUrl: (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`,
  },
  disney: {
    scheme: 'disneyplus://',
    webUrl: (q) => `https://www.disneyplus.com/search?q=${encodeURIComponent(q)}`,
  },
  'prime video': {
    scheme: 'aiv://',
    webUrl: (q) => `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encodeURIComponent(q)}`,
  },
  primevideo: {
    scheme: 'aiv://',
    webUrl: (q) => `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encodeURIComponent(q)}`,
  },
  'amazon': {
    scheme: 'aiv://',
    webUrl: (q) => `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encodeURIComponent(q)}`,
  },
  blutv: {
    scheme: 'blutv://',
    webUrl: (q) => `https://www.blutv.com/search?q=${encodeURIComponent(q)}`,
  },
  mubi: {
    scheme: 'mubi://',
    webUrl: (q) => `https://mubi.com/tr/search?query=${encodeURIComponent(q)}`,
  },
  'apple tv': {
    scheme: 'com.apple.tv://',
    webUrl: (q) => `https://tv.apple.com/search?term=${encodeURIComponent(q)}`,
  },
  'tv.apple': {
    scheme: 'com.apple.tv://',
    webUrl: (q) => `https://tv.apple.com/search?term=${encodeURIComponent(q)}`,
  },
  hbomax: {
    scheme: 'hbomax://',
    webUrl: (q) => `https://www.max.com/search?q=${encodeURIComponent(q)}`,
  },
  'max': {
    scheme: 'hbomax://',
    webUrl: (q) => `https://www.max.com/search?q=${encodeURIComponent(q)}`,
  },
  hbo: {
    scheme: 'hbomax://',
    webUrl: (q) => `https://www.max.com/search?q=${encodeURIComponent(q)}`,
  },
  exxen: {
    webUrl: () => `https://www.exxen.com/`,
  },
  tabii: {
    webUrl: () => `https://www.tabii.com/`,
  },
  gain: {
    webUrl: () => `https://gain.tv/`,
  },
};

/** Verilen provider adı için bilinen bir platform var mı? */
export function matchPlatform(providerName: string): PlatformLink | null {
  const n = providerName.toLocaleLowerCase('tr-TR').trim();
  for (const key of Object.keys(PLATFORM_LINKS)) {
    if (n.includes(key)) return PLATFORM_LINKS[key];
  }
  return null;
}

/** Bilinen platformların küçük harfli anahtarlarını filtre çubuğu için listeler. */
export function knownPlatformKeys(): string[] {
  return Object.keys(PLATFORM_LINKS);
}

/**
 * Verilen film/dizi listesindeki benzersiz platform adlarını toplar
 * (filtre çubuğu için). Alfabetik sıralı döner.
 */
export function listLibraryPlatforms(
  items: Array<{ watchProviders?: { providerName: string }[] }>
): string[] {
  const set = new Set<string>();
  for (const it of items) {
    for (const p of it.watchProviders || []) {
      if (p?.providerName) set.add(p.providerName);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
}

/**
 * Platformu aç: önce uygulama şemasını dener (gizli iframe), ~900ms sonra
 * tarayıcı hâlâ sitede kaldıysa web URL'ine yönlendirir. Özel şema yoksa
 * doğrudan web'e gider.
 *
 * @param providerName TMDB provider adı (ör. "Netflix")
 * @param query aranacak film/dizi adı
 * @returns true = bilinen bir platforma yönlendirildi
 */
export function openPlatform(providerName: string, query: string): boolean {
  const p = matchPlatform(providerName);
  if (!p) return false;
  const web = p.webUrl(query);

  if (p.scheme) {
    // Gizli iframe: özel şemayı tetikler, ana sayfadan ayrılmaz.
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = p.scheme;
      document.body.appendChild(iframe);
      setTimeout(() => iframe.remove(), 1000);
    } catch {
      /* yoksay */
    }
    // Uygulama açılırsa tarayıcı odağını/görünürlüğünü kaybeder; kısa süre
    // sonra hâlâ buradaysak web yedeğine geç.
    setTimeout(() => {
      if (document.hasFocus() && !document.hidden) {
        window.open(web, '_blank', 'noopener,noreferrer');
      }
    }, 900);
    return true;
  }

  window.open(web, '_blank', 'noopener,noreferrer');
  return true;
}
