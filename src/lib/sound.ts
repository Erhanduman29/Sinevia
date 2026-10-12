let audioCtx: AudioContext | null = null;

/**
 * Ses efektleri tercihi (Ses & Bildirim sekmesinden yönetilir).
 * Varsayılan açıktır; 'off' dışında her değer açık sayılır.
 */
const SOUND_ENABLED_KEY = 'sinevia_sound_enabled';

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_ENABLED_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'on' : 'off');
  } catch {
    // Depolama kapalı olabilir; tercih yalnızca oturumda kalır.
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function playAchievementSound() {
  const ctx = getCtx();
  if (!ctx || !isSoundEnabled()) return;
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
  if (!ctx || !isSoundEnabled()) return;
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

// Akademi dersi / tutorial tamamlanma bildirimi — kısa, yumuşak, "güzel" bir çan arpeyi
export function playLessonDoneSound() {
  const ctx = getCtx();
  if (!ctx || !isSoundEnabled()) return;
  const now = ctx.currentTime;
  // E5 · G#5 · B5 · E6 — parlak majör arpey (hoş ve dinlendirici)
  const notes = [659.25, 830.61, 987.77, 1318.51];
  notes.forEach((freq, i) => {
    const t = now + i * 0.085;

    // Temel ton (yumuşak çan)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.75);

    // Üst harmonik parıltısı
    const harm = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harm.type = 'triangle';
    harm.frequency.value = freq * 2;
    harmGain.gain.setValueAtTime(0, t);
    harmGain.gain.linearRampToValueAtTime(0.04, t + 0.01);
    harmGain.gain.exponentialRampToValueAtTime(0.0005, t + 0.35);
    harm.connect(harmGain);
    harmGain.connect(ctx.destination);
    harm.start(t);
    harm.stop(t + 0.4);
  });
}

// YENİ: Sinematik Görev Tamamlanma Müziği
export function playQuestCompleteSound() {
  const ctx = getCtx();
  if (!ctx || !isSoundEnabled()) return;
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