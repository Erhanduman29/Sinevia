/**
 * Basit özellik bayrakları.
 *
 * Amaç: riskli davranış değişikliklerini (ör. bulut birleştirme) kod tabanına
 * eklerken varsayılan olarak KAPALI tutmak. Bayrak açık/kapalı karşılaştırması
 * böylece aynı sürümde yapılabilir; sorun çıkarsa tek satırla eski davranışa
 * dönülür.
 *
 * Öncelik sırası:
 *   1. localStorage override:  `sinevia_flag_overrides` = {"syncMergeV2": true}
 *   2. Varsayılan değerler.
 *
 * Not: Bu bayraklar yalnızca davranış seçimi içindir; kalıcı kullanıcı verisi
 * burada tutulmaz.
 */

export interface FeatureFlags {
  /**
   * Çakışma birleştirmesinde "daha yeni kazanır" + silme taşları (tombstone)
   * kullan.
   *
   * Kapalıyken: eski `mergeForks` davranışı — aynı id'de "zenginlik skoru"
   * (daha dolu kayıt) kazanır, silinen kayıt geri gelebilir.
   * Açıkken: aynı id'de `updatedAt`/`editedAt`/`watchedAt` zaman damgası yeni
   * olan kazanır ve `deletedItems` taşları silinen kayıtları geri getirmez.
   *
   * Her iki durumda da çakışma kullanıcıya modal göstermeden otomatik
   * birleştirilir (`autoMergeAndCommit`); bu bayrak yalnızca birleştirme
   * KURALINI değiştirir, çakışma akışını değil.
   */
  syncMergeV2: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  syncMergeV2: false,
};

const STORAGE_KEY = 'sinevia_flag_overrides';

function readOverrides(): Partial<FeatureFlags> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<FeatureFlags> = {};
    (Object.keys(DEFAULT_FEATURE_FLAGS) as (keyof FeatureFlags)[]).forEach((key) => {
      const value = parsed[key];
      if (typeof value === 'boolean') out[key] = value;
    });
    return out;
  } catch {
    return {};
  }
}

/** Tüm bayrakların etkin değerlerini döndürür (override + varsayılan). */
export function readFeatureFlags(): FeatureFlags {
  return { ...DEFAULT_FEATURE_FLAGS, ...readOverrides() };
}

/** Tek bir bayrağın etkin değeri. */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return readFeatureFlags()[flag];
}

/**
 * Bayrağı çalışma anında değiştirir (yalnızca localStorage override).
 * `null` geçilirse override kaldırılır ve varsayılana dönülür.
 */
export function setFeatureFlag(flag: keyof FeatureFlags, value: boolean | null): void {
  if (typeof window === 'undefined') return;
  try {
    const overrides = readOverrides();
    if (value === null) delete overrides[flag];
    else overrides[flag] = value;

    if (Object.keys(overrides).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    }
  } catch {
    // localStorage kapalı/erişilemez — varsayılanlar geçerli kalır.
  }
}

/** Tüm override'ları temizler. */
export function clearFeatureFlags(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // yoksay
  }
}
