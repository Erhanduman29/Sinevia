// XP needed for a given level. Level 1 starts at 0 total XP.
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 2; l <= level; l++) {
    total += xpGapForLevel(l);
  }
  return total;
}

// ARİTMETİK ARTIŞ MANTIĞI
export function xpGapForLevel(level: number): number {
  if (level <= 1) return 0;
  
  const baseXP = 250; // Seviye 2 olmak için gereken ilk büyük eşik (Anında seviye atlamayı önler)
  const stepXP = 25;  // Her seviyede, bir önceki seviyeden 25 XP daha fazla ister.
  
  // Örnek: 
  // Lvl 2 = 250
  // Lvl 3 = 250 + 25 = 275
  // Lvl 4 = 250 + 50 = 300
  return baseXP + ((level - 2) * stepXP);
}

export function levelFromXp(totalXp: number): { level: number; currentLevelXp: number; nextLevelXp: number; progress: number } {
  let level = 1;
  let remaining = totalXp;
  
  while (remaining >= xpGapForLevel(level + 1)) {
    remaining -= xpGapForLevel(level + 1);
    level++;
  }
  
  const gap = xpGapForLevel(level + 1);
  const progress = gap > 0 ? Math.min(100, (remaining / gap) * 100) : 0;
  
  return {
    level,
    currentLevelXp: remaining,
    nextLevelXp: gap,
    progress,
  };
}