// Dakikaları okunabilir formata çevirir (Örn: 135 -> "2 sa 15 dk")
export function formatDuration(totalMins: number): string {
  if (totalMins <= 0) return '0 dk';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

// İki film saati birbiriyle çakışıyor mu? (Overlap)
export function checkOverlap(time1: string, dur1: number, time2: string, dur2: number): boolean {
  const t1 = time1.split(':').map(Number);
  const start1 = t1[0] * 60 + t1[1];
  const end1 = start1 + dur1;
  
  const t2 = time2.split(':').map(Number);
  const start2 = t2[0] * 60 + t2[1];
  const end2 = start2 + dur2;
  
  return start1 < end2 && end1 > start2;
}

// Filmin süresine göre bitiş saatini hesaplar (Gece yarısını geçme dahil)
export function computeEndTime(startTime: string, durationMins: number): string {
  if (!startTime) return '';
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + (durationMins || 115);
  const endH = Math.floor(total / 60) % 24; // Gece yarısını sarmak için % 24
  const endM = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}