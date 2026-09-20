// XP needed for a given level. Level 1 starts at 0 total XP.
// Each level requires progressively more XP, making leveling harder.
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 2; l <= level; l++) {
    total += xpGapForLevel(l);
  }
  return total;
}

export function xpGapForLevel(level: number): number {
  // Level 2 needs 100, level 3 needs 150, level 4 needs 225, etc.
  // Formula: base * multiplier^(level-2), rounded
  const base = 100;
  const multiplier = 1.4;
  return Math.round(base * Math.pow(multiplier, level - 2));
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
