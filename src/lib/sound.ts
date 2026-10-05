let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function playAchievementSound() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + i * 0.1);
    gain.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.3);
  });
}

export function playLevelUpSound() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [392, 523.25, 659.25, 783.99, 1046.5]; // G4, C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + i * 0.08);
    gain.gain.linearRampToValueAtTime(0.2, now + i * 0.08 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.4);
  });
}

// YENİ: Sinematik Görev Tamamlanma Müziği
export function playQuestCompleteSound() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // --- BÖLÜM 1: GERİLİM VE YÜKSELİŞ (0 - 3 Saniye) ---
  // Yazılar ekranda akarken alttan giren derin bas ve yükselen frekans
  
  // 1. Derin Bas (Sub-bass drone)
  const bassOsc = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bassOsc.type = 'sawtooth';
  bassOsc.frequency.value = 65.41; // C2 (Çok kalın bir bas)
  bassGain.gain.setValueAtTime(0, now);
  bassGain.gain.linearRampToValueAtTime(0.12, now + 3); // 3 Saniye boyunca şiddetlenir
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + 3.1); // Patlama anında kesilir
  bassOsc.connect(bassGain);
  bassGain.connect(ctx.destination);
  bassOsc.start(now);
  bassOsc.stop(now + 3.1);

  // 2. Yükselen Dijital Ses (Sci-fi sweep)
  const sweepOsc = ctx.createOscillator();
  const sweepGain = ctx.createGain();
  sweepOsc.type = 'sine';
  sweepOsc.frequency.setValueAtTime(220, now); // A3
  sweepOsc.frequency.exponentialRampToValueAtTime(880, now + 3); // 3 Saniyede A5'e kadar tizleşir
  sweepGain.gain.setValueAtTime(0, now);
  sweepGain.gain.linearRampToValueAtTime(0.15, now + 2.8);
  sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 3.1);
  sweepOsc.connect(sweepGain);
  sweepGain.connect(ctx.destination);
  sweepOsc.start(now);
  sweepOsc.stop(now + 3.1);


  // --- BÖLÜM 2: DESTANSI PATLAMA (3. Saniye ve Sonrası) ---
  // Rozet ekrana çarptığı an giren orkestral/synth akor
  
  // Görkemli C Majör Akoru (C4, E4, G4, C5, E5)
  const climaxNotes = [261.63, 329.63, 392.00, 523.25, 659.25]; 

  climaxNotes.forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle'; // Tok ve epik bir ses
    osc.frequency.value = freq;

    // Tam 3. saniyede vurur
    gain.gain.setValueAtTime(0, now + 3);
    gain.gain.linearRampToValueAtTime(0.2, now + 3.05); // Çok sert ve hızlı giriş (Attack)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 6.5); // 3.5 saniye boyunca yankılanarak söner

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + 3);
    osc.stop(now + 6.5);
  });

  // Zirve anında parlayan ince zafer çanı (Arpeggio)
  const sparkleNotes = [1046.50, 1318.51, 1567.98, 2093.00]; // C6, E6, G6, C7
  sparkleNotes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const startTime = now + 3 + (i * 0.08); // Arka arkaya çok hızlı çalar
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.08, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.5);
  });
}