/**
 * Puanları kullanıcıya gösterilecek biçime getirir: en yakın 0,5'e yuvarlar.
 * Tam (8) ve buçuklu (8.5) dışındaki değerler arayüzde asla görünmez.
 */
export function roundHalfRating(value: number): number {
  if (!Number.isFinite(value)) return value;
  const clamped = Math.min(10, Math.max(1, value));
  return Math.round(clamped * 2) / 2;
}
