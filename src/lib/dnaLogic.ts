import type { Movie } from '../types';

export interface SynthTrait {
  category: string;
  label: string;
  addedPct: number;
  sourceLabel: string;
  sourceType: 'both' | 'A' | 'B' | 'hybrid';
}

export interface SynthVariant {
  movie: Movie;
  matchScore: number;
  parentAPct: number;
  parentBPct: number;
  traits: SynthTrait[];
  sortRank: number;
}

const STOP_WORDS = new Set([
  'bir', 've', 'ile', 'için', 'bu', 'da', 'de', 'çok', 'daha', 'en', 'gibi', 'kadar',
  'olan', 'olarak', 'sonra', 'önce', 'kendi', 'ise', 'ya', 'veya', 'ama', 'fakat',
  'göre', 'tüm', 'bütün', 'her', 'hiç', 'bazı', 'biraz', 'şu', 'onu', 'bunu', 'ona',
  'film', 'filmi', 'filmde', 'hikaye', 'hikayesi', 'hayat', 'hayatı', 'yaşam', 'insan',
  'dünya', 'zaman', 'yılında', 'birlikte', 'ancak', 'karşı', 'arasında', 'üzerine',
  'başlar', 'olaylar', 'anlatıyor', 'anlatır', 'konu', 'ediyor', 'sonunda', 'içinde',
  'tarafından', 'büyük', 'küçük', 'yeni', 'eski', 'genç', 'adam', 'kadın', 'çocuk',
]);

function extractKeywordsFromText(text?: string) {
  const map = new Map<string, string>();
  if (!text) return map;
  const clean = text
    .toLocaleLowerCase('tr-TR')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"?<>]/g, ' ');
  clean.split(/\s+/).forEach((w) => {
    if (w.length >= 5 && !STOP_WORDS.has(w)) {
      const stem = w.slice(0, 5);
      if (!map.has(stem)) map.set(stem, w);
    }
  });
  return map;
}

export function calculateDnaSynthesis(
  activeA: Movie,
  activeB: Movie,
  candidates: Movie[],
  mutationRate: number
): SynthVariant[] {
  const hasDirA = Array.isArray(activeA.directors) && activeA.directors.length > 0;
  const hasDirB = Array.isArray(activeB.directors) && activeB.directors.length > 0;
  const dirsA = new Set(hasDirA ? activeA.directors!.map((d) => d.trim()).filter(Boolean) : []);
  const dirsB = new Set(hasDirB ? activeB.directors!.map((d) => d.trim()).filter(Boolean) : []);

  const hasCastA = Array.isArray(activeA.cast) && activeA.cast.length > 0;
  const hasCastB = Array.isArray(activeB.cast) && activeB.cast.length > 0;
  const castA = new Set(hasCastA ? activeA.cast!.map((c) => c.trim()).filter(Boolean) : []);
  const castB = new Set(hasCastB ? activeB.cast!.map((c) => c.trim()).filter(Boolean) : []);

  const genresA = new Set((activeA.genres || []).map((g) => g.trim()).filter(Boolean));
  const genresB = new Set((activeB.genres || []).map((g) => g.trim()).filter(Boolean));

  const hasKwA = Array.isArray(activeA.keywords) && activeA.keywords.length > 0;
  const hasKwB = Array.isArray(activeB.keywords) && activeB.keywords.length > 0;
  const kwA = new Set(hasKwA ? activeA.keywords!.map((k) => k.trim().toLowerCase()).filter(Boolean) : []);
  const kwB = new Set(hasKwB ? activeB.keywords!.map((k) => k.trim().toLowerCase()).filter(Boolean) : []);

  const hasStA = Array.isArray(activeA.studios) && activeA.studios.length > 0;
  const hasStB = Array.isArray(activeB.studios) && activeB.studios.length > 0;
  const studiosA = new Set(hasStA ? activeA.studios!.map((s) => s.trim()).filter(Boolean) : []);
  const studiosB = new Set(hasStB ? activeB.studios!.map((s) => s.trim()).filter(Boolean) : []);

  const stemsA = extractKeywordsFromText(activeA.overview);
  const stemsB = extractKeywordsFromText(activeB.overview);

  const yearA = parseInt(activeA.year || '0', 10);
  const yearB = parseInt(activeB.year || '0', 10);
  const decadeA = yearA > 1900 ? Math.floor(yearA / 10) * 10 : 0;
  const decadeB = yearB > 1900 ? Math.floor(yearB / 10) * 10 : 0;

  const rtA = activeA.runtime || 0;
  const rtB = activeB.runtime || 0;
  const avgParentRuntime = rtA > 0 && rtB > 0 ? Math.round((rtA + rtB) / 2) : rtA > 0 ? rtA : rtB > 0 ? rtB : 0;

  const scoredCandidates: SynthVariant[] = [];

  candidates.forEach((candidate) => {
    if (candidate.id === activeA.id || candidate.id === activeB.id) return;

    let pctFromA = 0;
    let pctFromB = 0;
    const traits: SynthTrait[] = [];

    // 1. YÖNETMEN
    const hasCandDirs = Array.isArray(candidate.directors) && candidate.directors.length > 0;
    if (hasCandDirs && (hasDirA || hasDirB)) {
      const dirsBoth: string[] = [];
      const dirsOnlyA: string[] = [];
      const dirsOnlyB: string[] = [];

      candidate.directors!.forEach((d) => {
        const cleanD = d.trim();
        if (!cleanD) return;
        const inA = dirsA.has(cleanD);
        const inB = dirsB.has(cleanD);
        if (inA && inB) dirsBoth.push(cleanD);
        else if (inA) dirsOnlyA.push(cleanD);
        else if (inB) dirsOnlyB.push(cleanD);
      });

      if (dirsBoth.length > 0) {
        pctFromA += 15; pctFromB += 15;
        traits.push({ category: 'Ortak Yönetmen', label: dirsBoth.join(', '), addedPct: 30, sourceLabel: 'Her İki Filmle Ortak', sourceType: 'both' });
      } else {
        if (dirsOnlyA.length > 0) {
          pctFromA += 25;
          traits.push({ category: 'Aynı Yönetmen', label: dirsOnlyA.join(', '), addedPct: 25, sourceLabel: activeA.title, sourceType: 'A' });
        }
        if (dirsOnlyB.length > 0) {
          pctFromB += 25;
          traits.push({ category: 'Aynı Yönetmen', label: dirsOnlyB.join(', '), addedPct: 25, sourceLabel: activeB.title, sourceType: 'B' });
        }
      }
    }

    // 2. OYUNCU
    const hasCandCast = Array.isArray(candidate.cast) && candidate.cast.length > 0;
    if (hasCandCast && (hasCastA || hasCastB)) {
      const actorsBoth: string[] = [];
      const actorsOnlyA: string[] = [];
      const actorsOnlyB: string[] = [];

      candidate.cast!.forEach((actor) => {
        const cleanActor = actor.trim();
        if (!cleanActor) return;
        const inA = castA.has(cleanActor);
        const inB = castB.has(cleanActor);
        if (inA && inB) actorsBoth.push(cleanActor);
        else if (inA) actorsOnlyA.push(cleanActor);
        else if (inB) actorsOnlyB.push(cleanActor);
      });

      let castPctUsed = 0;
      if (actorsBoth.length > 0) {
        const pct = Math.min(30, actorsBoth.length * 15);
        castPctUsed += pct; pctFromA += pct / 2; pctFromB += pct / 2;
        traits.push({ category: 'Ortak Oyuncu', label: actorsBoth.join(', '), addedPct: pct, sourceLabel: 'Her İki Filmde Oynuyor', sourceType: 'both' });
      }
      if (actorsOnlyA.length > 0 && castPctUsed < 30) {
        const pct = Math.min(30 - castPctUsed, actorsOnlyA.length * 10);
        castPctUsed += pct; pctFromA += pct;
        traits.push({ category: 'Ortak Oyuncu', label: actorsOnlyA.join(', '), addedPct: pct, sourceLabel: activeA.title, sourceType: 'A' });
      }
      if (actorsOnlyB.length > 0 && castPctUsed < 30) {
        const pct = Math.min(30 - castPctUsed, actorsOnlyB.length * 10);
        castPctUsed += pct; pctFromB += pct;
        traits.push({ category: 'Ortak Oyuncu', label: actorsOnlyB.join(', '), addedPct: pct, sourceLabel: activeB.title, sourceType: 'B' });
      }
    }

    // 3. TÜR
    const hasCandGenres = Array.isArray(candidate.genres) && candidate.genres.length > 0;
    if (hasCandGenres) {
      const genresBoth: string[] = [];
      const genresOnlyA: string[] = [];
      const genresOnlyB: string[] = [];

      candidate.genres.forEach((g) => {
        const cleanG = g.trim();
        if (!cleanG) return;
        const inA = genresA.has(cleanG);
        const inB = genresB.has(cleanG);
        if (inA && inB) genresBoth.push(cleanG);
        else if (inA) genresOnlyA.push(cleanG);
        else if (inB) genresOnlyB.push(cleanG);
      });

      let genrePctUsed = 0;
      if (genresBoth.length > 0) {
        const pct = Math.min(24, genresBoth.length * 8);
        genrePctUsed += pct; pctFromA += pct / 2; pctFromB += pct / 2;
        traits.push({ category: 'Ortak Tür', label: genresBoth.join(', '), addedPct: pct, sourceLabel: 'Her İki Filmle Ortak', sourceType: 'both' });
      }
      if (genresOnlyA.length > 0 && genresOnlyB.length > 0 && genrePctUsed < 25) {
        const pct = Math.min(25 - genrePctUsed, (genresOnlyA.length + genresOnlyB.length) * 5);
        genrePctUsed += pct; pctFromA += pct / 2; pctFromB += pct / 2;
        traits.push({ category: 'Çapraz Tür', label: `${genresOnlyA.join(', ')} × ${genresOnlyB.join(', ')}`, addedPct: pct, sourceLabel: '1. ve 2. Film Melezi', sourceType: 'hybrid' });
      } else if (genresOnlyA.length > 0 && genrePctUsed < 25) {
        const pct = Math.min(25 - genrePctUsed, genresOnlyA.length * 5);
        genrePctUsed += pct; pctFromA += pct;
        traits.push({ category: 'Aynı Tür', label: genresOnlyA.join(', '), addedPct: pct, sourceLabel: activeA.title, sourceType: 'A' });
      } else if (genresOnlyB.length > 0 && genrePctUsed < 25) {
        const pct = Math.min(25 - genrePctUsed, genresOnlyB.length * 5);
        genrePctUsed += pct; pctFromB += pct;
        traits.push({ category: 'Aynı Tür', label: genresOnlyB.join(', '), addedPct: pct, sourceLabel: activeB.title, sourceType: 'B' });
      }
    }

    // 4. TEMA
    const hasCandKw = Array.isArray(candidate.keywords) && candidate.keywords.length > 0;
    if (hasCandKw && (hasKwA || hasKwB)) {
      const kwsBoth: string[] = [];
      const kwsOnlyA: string[] = [];
      const kwsOnlyB: string[] = [];

      candidate.keywords!.forEach((k) => {
        const cleanK = k.trim().toLowerCase();
        if (!cleanK) return;
        const inA = kwA.has(cleanK);
        const inB = kwB.has(cleanK);
        if (inA && inB) kwsBoth.push(k.trim());
        else if (inA) kwsOnlyA.push(k.trim());
        else if (inB) kwsOnlyB.push(k.trim());
      });

      const rawKwPct = kwsBoth.length * 6 + (kwsOnlyA.length + kwsOnlyB.length) * 4;
      const kwPct = Math.min(20, rawKwPct);
      if (kwPct > 0) {
        const allKws = [...kwsBoth, ...kwsOnlyA, ...kwsOnlyB];
        const shareA = kwsBoth.length * 3 + kwsOnlyA.length * 4;
        const shareB = kwsBoth.length * 3 + kwsOnlyB.length * 4;
        const sumShare = shareA + shareB || 1;
        
        pctFromA += Math.round(kwPct * (shareA / sumShare));
        pctFromB += kwPct - Math.round(kwPct * (shareA / sumShare));

        traits.push({
          category: 'Ortak Tema', label: allKws.slice(0, 4).join(', '), addedPct: kwPct,
          sourceLabel: kwsBoth.length > 0 ? 'Her İki Filmle Ortak' : kwsOnlyA.length > 0 && kwsOnlyB.length > 0 ? '1. ve 2. Film' : kwsOnlyA.length > 0 ? activeA.title : activeB.title,
          sourceType: kwsBoth.length > 0 ? 'both' : kwsOnlyA.length > 0 ? 'A' : 'B',
        });
      }
    }

    // 5. KONU ÖZETİ
    if (candidate.overview && (activeA.overview || activeB.overview)) {
      const candStems = extractKeywordsFromText(candidate.overview);
      const matchedWords: string[] = [];
      let wA = 0; let wB = 0;

      candStems.forEach((origWord, stem) => {
        const inA = stemsA.has(stem);
        const inB = stemsB.has(stem);
        if (inA || inB) {
          matchedWords.push(origWord);
          if (inA) wA++;
          if (inB) wB++;
        }
      });

      if (matchedWords.length > 0) {
        const storyPct = Math.min(12, matchedWords.length * 3);
        const wSum = wA + wB || 1;
        pctFromA += Math.round(storyPct * (wA / wSum));
        pctFromB += storyPct - Math.round(storyPct * (wA / wSum));

        traits.push({
          category: 'Konu Benzerliği', label: matchedWords.slice(0, 4).join(', '), addedPct: storyPct,
          sourceLabel: wA > 0 && wB > 0 ? 'Her İki Film' : wA > 0 ? activeA.title : activeB.title,
          sourceType: wA > 0 && wB > 0 ? 'both' : wA > 0 ? 'A' : 'B',
        });
      }
    }

    // 6. KOLEKSİYON
    if (candidate.collectionId) {
      const inColA = candidate.collectionId === activeA.collectionId;
      const inColB = candidate.collectionId === activeB.collectionId;
      if (inColA || inColB) {
        const colPct = 15;
        if (inColA && inColB) { pctFromA += 7.5; pctFromB += 7.5; }
        else if (inColA) { pctFromA += colPct; }
        else { pctFromB += colPct; }
        
        traits.push({ category: 'Koleksiyon Serisi', label: 'Serinin Sıradaki İlk Filmi', addedPct: colPct, sourceLabel: inColA ? activeA.title : activeB.title, sourceType: inColA && inColB ? 'both' : inColA ? 'A' : 'B' });
      }
    }

    // 7. STÜDYO
    const hasCandSt = Array.isArray(candidate.studios) && candidate.studios.length > 0;
    if (hasCandSt && (hasStA || hasStB)) {
      const matchedStudios: string[] = [];
      let stInA = false; let stInB = false;

      candidate.studios!.forEach((s) => {
        const cleanS = s.trim();
        if (!cleanS) return;
        if (studiosA.has(cleanS)) { matchedStudios.push(cleanS); stInA = true; }
        if (studiosB.has(cleanS)) { if (!matchedStudios.includes(cleanS)) matchedStudios.push(cleanS); stInB = true; }
      });

      if (matchedStudios.length > 0) {
        const stPct = matchedStudios.length >= 2 ? 8 : 5;
        if (stInA && stInB) { pctFromA += stPct / 2; pctFromB += stPct / 2; }
        else if (stInA) { pctFromA += stPct; }
        else { pctFromB += stPct; }
        traits.push({ category: 'Aynı Stüdyo', label: matchedStudios.slice(0, 2).join(', '), addedPct: stPct, sourceLabel: stInA && stInB ? 'Her İki Film' : stInA ? activeA.title : activeB.title, sourceType: stInA && stInB ? 'both' : stInA ? 'A' : 'B' });
      }
    }

    // 8. DÖNEM
    const candYear = parseInt(candidate.year || '0', 10);
    const candDecade = candYear > 1900 ? Math.floor(candYear / 10) * 10 : 0;
    if (candDecade > 0 && (candDecade === decadeA || candDecade === decadeB)) {
      const decPct = 5;
      if (candDecade === decadeA && candDecade === decadeB) {
        pctFromA += 2.5; pctFromB += 2.5;
        traits.push({ category: 'Aynı Dönem', label: `${candDecade}'ler Sineması (${candidate.year})`, addedPct: decPct, sourceLabel: 'Her İki Film', sourceType: 'both' });
      } else if (candDecade === decadeA) {
        pctFromA += decPct;
        traits.push({ category: 'Aynı Dönem', label: `${candDecade}'ler Sineması (${candidate.year})`, addedPct: decPct, sourceLabel: activeA.title, sourceType: 'A' });
      } else {
        pctFromB += decPct;
        traits.push({ category: 'Aynı Dönem', label: `${candDecade}'ler Sineması (${candidate.year})`, addedPct: decPct, sourceLabel: activeB.title, sourceType: 'B' });
      }
    }

    // 9. SÜRE
    if (candidate.runtime && candidate.runtime > 0 && avgParentRuntime > 0) {
      const diffAvg = Math.abs(candidate.runtime - avgParentRuntime);
      if (diffAvg <= 15) {
        pctFromA += 2.5; pctFromB += 2.5;
        traits.push({ category: 'Süre Uyumu', label: `${candidate.runtime} dk (Ebeveyn Ort: ${avgParentRuntime} dk)`, addedPct: 5, sourceLabel: 'Ortak Tempo', sourceType: 'both' });
      }
    }

    // 10. ÇİFT EBEVEYN MELEZ SENTEZ BONUSU
    const isTrueHybrid = pctFromA >= 5 && pctFromB >= 5;
    if (isTrueHybrid) {
      pctFromA += 2.5; pctFromB += 2.5;
      traits.push({ category: 'Melez Sentez', label: 'Hem 1. Hem 2. Filmden Ortak Gen Taşıyor', addedPct: 5, sourceLabel: 'A × B Sinerjisi', sourceType: 'hybrid' });
    }

    if (mutationRate === 2) {
      const chaosBonus = Math.floor(Math.random() * 8) + 3;
      pctFromA += chaosBonus / 2; pctFromB += chaosBonus / 2;
      traits.push({ category: 'Kaos Mutasyonu', label: 'Deneysel Genetik Sapma', addedPct: chaosBonus, sourceLabel: 'Kaos Modu', sourceType: 'hybrid' });
    }

    const exactSumPct = traits.reduce((sum, t) => sum + t.addedPct, 0);
    if (exactSumPct <= 0) return; // Sıfır uyum elendi

    const matchScore = Math.min(100, exactSumPct);
    const totalParentShare = pctFromA + pctFromB || 1;
    const parentAPct = Math.round((pctFromA / totalParentShare) * 100);
    const hybridRankBonus = isTrueHybrid && mutationRate === 1 ? 8 : 0;

    scoredCandidates.push({
      movie: candidate,
      matchScore,
      parentAPct,
      parentBPct: 100 - parentAPct,
      traits: [...traits].sort((a, b) => b.addedPct - a.addedPct),
      sortRank: matchScore + hybridRankBonus,
    });
  });

  return scoredCandidates.sort((a, b) => b.sortRank - a.sortRank || b.matchScore - a.matchScore);
}