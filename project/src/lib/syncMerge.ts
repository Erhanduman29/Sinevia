/* =========================================================================
   SENKRON BİRLEŞTİRME V2 — ZAMAN DAMGASI + MEZAR TAŞI (TOMBSTONE)
   -------------------------------------------------------------------------
   Amaç (v5.1 "Merge V2"):
   1) İki cihazda aynı kayıt (film/dizi/koleksiyon/geçmiş) farklıysa
      "daha zengin olan" yerine "en son değiştirilen" kazanır.
   2) Bir cihazda silinen kayıt, diğer cihazın eski kopyasından geri gelmez.
      (Silme kayıtları "mezar taşı" olarak saklanır.)

   GERİYE UYUMLULUK
   - `deletedItems` ve `updatedAt` alanları OPSİYONELDİR. Eski istemciler bu
     alanları göndermez; birleştirme zaman damgası bulunamazsa mevcut
     "zenginlik" kuralına düşer.
   - Feature flag (`syncMergeV2`) kapalıyken bu modülün kuralları uygulanmaz;
     davranış eskisiyle birebir aynı kalır.
   ========================================================================= */

export type TombstoneType = 'movie' | 'series' | 'collection' | 'history';

/** Silinmiş bir kaydın mezar taşı. `deletedAt` ISO 8601 zaman damgasıdır. */
export interface DeletedItem {
  id: string;
  type: TombstoneType;
  deletedAt: string;
}

/** Diskte şişmemesi için tutulan en fazla mezar taşı sayısı (en yeniler kalır). */
export const MAX_TOMBSTONES = 500;

/** ISO zaman damgasını milisaniyeye çevirir; geçersiz/boş değer 0 döner. */
export function timeValue(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Bir kaydın "son değişiklik" zamanı. `updatedAt` yoksa eski sürümlerden gelen
 * alanlara sırayla düşer (en büyük geçerli zaman kullanılır).
 */
export function itemTimestamp(item: unknown): number {
  if (!item || typeof item !== 'object') return 0;
  const record = item as Record<string, unknown>;
  return Math.max(
    timeValue(record.updatedAt as string | undefined),
    timeValue(record.editedAt as string | undefined),
    timeValue(record.ratingChangedAt as string | undefined),
    timeValue(record.noteChangedAt as string | undefined),
    timeValue(record.watchedAt as string | undefined),
    timeValue(record.createdAt as string | undefined),
    timeValue(record.importedAt as string | undefined),
    0
  );
}

/** En yeni `MAX_TOMBSTONES` kaydı tutar (eski silmeler budanır). */
export function pruneTombstones(list: DeletedItem[], max = MAX_TOMBSTONES): DeletedItem[] {
  const clean = (list ?? []).filter(
    (t): t is DeletedItem => Boolean(t && t.id && t.type && t.deletedAt)
  );
  if (clean.length <= max) return clean;
  return [...clean]
    .sort((a, b) => timeValue(a.deletedAt) - timeValue(b.deletedAt))
    .slice(-max);
}

/** İki tarafın mezar taşlarını birleştirir; aynı kayıtta en yeni silme kazanır. */
export function mergeTombstones(
  cloudItems?: DeletedItem[] | null,
  localItems?: DeletedItem[] | null
): DeletedItem[] {
  const merged = new Map<string, DeletedItem>();
  for (const tombstone of [...(cloudItems ?? []), ...(localItems ?? [])]) {
    if (!tombstone?.id || !tombstone?.type) continue;
    const key = `${tombstone.type}:${tombstone.id}`;
    const existing = merged.get(key);
    if (!existing || timeValue(tombstone.deletedAt) > timeValue(existing.deletedAt)) {
      merged.set(key, {
        id: tombstone.id,
        type: tombstone.type,
        deletedAt: tombstone.deletedAt || new Date(0).toISOString(),
      });
    }
  }
  return pruneTombstones(Array.from(merged.values()));
}

/** Yeni silme kaydı ekler (aynı kaydın eski taşı varsa değiştirir). */
export function createTombstone(
  existing: DeletedItem[] | undefined | null,
  type: TombstoneType,
  id: string,
  at = new Date().toISOString()
): DeletedItem[] {
  const kept = (existing ?? []).filter((t) => !(t?.id === id && t?.type === type));
  return pruneTombstones([...kept, { id, type, deletedAt: at }]);
}

/**
 * Kayıt silinmiş mi?
 * - Mezar taşı yoksa → hayır.
 * - Kaydın son değişikliği silme zamanından SONRA ise → kayıt yeniden
 *   oluşturulmuştur, silme sayılmaz (hayır).
 * - Aksi hâlde → evet.
 */
export function isTombstoned(
  type: TombstoneType,
  id: string,
  tombstones: DeletedItem[] | null | undefined,
  stampMs: number
): boolean {
  if (!tombstones || tombstones.length === 0) return false;
  const hit = tombstones.find((t) => t?.type === type && t?.id === id);
  if (!hit) return false;
  const deletedAt = timeValue(hit.deletedAt);
  if (deletedAt === 0) return true;
  return stampMs <= deletedAt;
}

/** Bir listeye mezar taşlarını uygular. */
export function applyTombstones<T extends { id: string }>(
  items: T[] | null | undefined,
  type: TombstoneType,
  tombstones: DeletedItem[] | null | undefined
): T[] {
  const list = items ?? [];
  if (!tombstones || tombstones.length === 0) return list;
  return list.filter((item) => {
    if (!item?.id) return false;
    return !isTombstoned(type, item.id, tombstones, itemTimestamp(item));
  });
}
