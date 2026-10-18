let audioCtx: AudioContext | null = null;
let masterBus: GainNode | null = null;
let reverbWetBus: GainNode | null = null;

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

/**
 * Sinema salonu akustiği için prosedürel Impulse Response (Yankı) üretici.
 * Seslerin "kuru ve dijital" duyulmasını engeller, uzaysal derinlik katar.
 */
function createCinemaImpulse(ctx: AudioContext, duration = 2.4, decay = 2.6): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const channelData = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, decay);
      // Yumuşatılmış pembe/beyaz gürültü karışımı
      channelData[i] = (Math.random() * 2 - 1) * env * 0.55;
    }
  }
  return impulse;
}

/**
 * AudioContext + Master Compressor + Sinematik Reverb Veri Yolu
 */
function getAudioEngine(): {
  ctx: AudioContext;
  dry: AudioNode;
  wet: AudioNode;
} | null {
  if (typeof window === 'undefined') return null;

  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();

      // Master Limiter / Compressor (Çoklu akorlarda ses patlamasını/cızırtıyı önler)
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, audioCtx.currentTime);
      compressor.knee.setValueAtTime(18, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(6, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.25, audioCtx.currentTime);
      compressor.connect(audioCtx.destination);

      masterBus = audioCtx.createGain();
      masterBus.gain.setValueAtTime(0.85, audioCtx.currentTime);
      masterBus.connect(compressor);

      // Sinematik Reverb Kanalı
      const convolver = audioCtx.createConvolver();
      convolver.buffer = createCinemaImpulse(audioCtx, 2.5, 2.8);

      const reverbFilter = audioCtx.createBiquadFilter();
      reverbFilter.type = 'lowpass';
      reverbFilter.frequency.setValueAtTime(3400, audioCtx.currentTime);

      reverbWetBus = audioCtx.createGain();
      reverbWetBus.gain.setValueAtTime(0.38, audioCtx.currentTime);

      reverbWetBus.connect(reverbFilter);
      reverbFilter.connect(convolver);
      convolver.connect(masterBus);
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    return {
      ctx: audioCtx,
      dry: masterBus!,
      wet: reverbWetBus!,
    };
  } catch {
    return null;
  }
}

/* ============================================================================
   YARDIMCI ENSTRÜMAN SENTEZLEYİCİLERİ (CHIME, WARM PAD, SUB IMPACT, SHIMMER)
   ============================================================================ */

/**
 * 1. Kristal / Rhodes Çan Sesi (FM Sentezli + Harmonik Parıltılı + Stereo Panlı)
 */
function playHarmonicBell(
  engine: { ctx: AudioContext; dry: AudioNode; wet: AudioNode },
  freq: number,
  startTime: number,
  duration: number,
  volume = 0.14,
  pan = 0
) {
  const { ctx, dry, wet } = engine;

  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const outNode = panner || ctx.createGain();
  if (panner) {
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), startTime);
  }
  outNode.connect(dry);
  outNode.connect(wet);

  // Ana Gövde (Sıcak Sine + Triangle)
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = 'sine';
  osc2.type = 'triangle';
  osc1.frequency.setValueAtTime(freq, startTime);
  osc2.frequency.setValueAtTime(freq * 2, startTime); // 1 oktav üst harmonik
  osc2.detune.setValueAtTime(4, startTime);

  const env1 = ctx.createGain();
  const env2 = ctx.createGain();

  env1.gain.setValueAtTime(0.0001, startTime);
  env1.gain.linearRampToValueAtTime(volume, startTime + 0.014);
  env1.gain.exponentialRampToValueAtTime(volume * 0.25, startTime + duration * 0.35);
  env1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  // Üst harmonik daha çabuk sönümlenir (gerçek akustik çan физиği)
  env2.gain.setValueAtTime(0.0001, startTime);
  env2.gain.linearRampToValueAtTime(volume * 0.28, startTime + 0.008);
  env2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.45);

  osc1.connect(env1);
  osc2.connect(env2);
  env1.connect(outNode);
  env2.connect(outNode);

  osc1.start(startTime);
  osc2.start(startTime);
  osc1.stop(startTime + duration + 0.05);
  osc2.stop(startTime + duration * 0.5);
}

/**
 * 2. Sinematik Sıcak Synth Pad / Bakır (Brass) Akor Sesi (Filtreli & Detuned)
 */
function playWarmPadNote(
  engine: { ctx: AudioContext; dry: AudioNode; wet: AudioNode },
  freq: number,
  startTime: number,
  attack: number,
  duration: number,
  volume = 0.1,
  pan = 0
) {
  const { ctx, dry, wet } = engine;

  // Kadifemsi ses için Alçak Geçiren Filtre (Low-pass filter envelope)
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.setValueAtTime(1.8, startTime);
  filter.frequency.setValueAtTime(320, startTime);
  filter.frequency.exponentialRampToValueAtTime(2600, startTime + attack + 0.12);
  filter.frequency.exponentialRampToValueAtTime(680, startTime + duration);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, startTime);
  env.gain.linearRampToValueAtTime(volume, startTime + attack);
  env.gain.setValueAtTime(volume * 0.85, startTime + attack + 0.15);
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (panner) {
    panner.pan.setValueAtTime(pan, startTime);
    filter.connect(env);
    env.connect(panner);
    panner.connect(dry);
    panner.connect(wet);
  } else {
    filter.connect(env);
    env.connect(dry);
    env.connect(wet);
  }

  // Çift osilatör (Hafif detune ile zengin koro/ensemble hissi)
  [-7, 7].forEach((detuneCents, idx) => {
    const osc = ctx.createOscillator();
    osc.type = idx === 0 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.detune.setValueAtTime(detuneCents, startTime);
    osc.connect(filter);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  });
}

/**
 * 3. Sinematik Sub-Bass Impact (Rozet / Arma çarptığında oluşan tok sinema bası)
 */
function playSubImpact(
  engine: { ctx: AudioContext; dry: AudioNode; wet: AudioNode },
  startTime: number,
  startFreq = 130,
  endFreq = 36,
  duration = 0.85,
  volume = 0.34
) {
  const { ctx, dry } = engine;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';

  osc.frequency.setValueAtTime(startFreq, startTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration * 0.65);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(dry);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

/* ============================================================================
   1. BAŞARIM / KUPA KAZANMA SESİ (PS5 Platinum Trophy / Xbox Rare Chime Stili)
   ============================================================================ */
export function playAchievementSound() {
  if (!isSoundEnabled()) return;
  const engine = getAudioEngine();
  if (!engine) return;

  const now = engine.ctx.currentTime;

  // A) Yumuşak Sinematik Alt Bas & Sıcak Pad Halısı (Cmaj9: C3, G3, B3, E4)
  playSubImpact(engine, now, 110, 55, 0.7, 0.22);
  const padChord = [130.81, 196.0, 246.94, 329.63];
  padChord.forEach((f, i) => {
    playWarmPadNote(engine, f, now + 0.02, 0.08, 1.45, 0.055, (i - 1.5) * 0.35);
  });

  // B) Kristal Kupa Melodisi (Parlak Lydian/Maj9 Arpej: G5 -> B5 -> D6 -> E6 -> G6)
  const bellNotes = [
    { freq: 783.99, time: 0.0, dur: 1.1, vol: 0.13, pan: -0.4 },  // G5
    { freq: 987.77, time: 0.075, dur: 1.1, vol: 0.13, pan: -0.15 }, // B5
    { freq: 1174.66, time: 0.15, dur: 1.2, vol: 0.14, pan: 0.15 }, // D6
    { freq: 1318.51, time: 0.23, dur: 1.6, vol: 0.16, pan: 0.4 },  // E6
    { freq: 1567.98, time: 0.34, dur: 1.9, vol: 0.12, pan: 0.0 },  // G6 (Zirve Parıltı)
  ];

  bellNotes.forEach((n) => {
    playHarmonicBell(engine, n.freq, now + n.time, n.dur, n.vol, n.pan);
  });
}

/* ============================================================================
   2. SEVİYE ATLAMA SESİ (LevelUpModal Fazlarıyla Tam Senkronize Epik Fanfar)
   - 0.00s: Faz 1-2 (40/320ms): Sahne kararır, God Rays açılır → Shimmer Riser
   - 0.68s: Faz 3 (680ms): 3 Katmanlı Unvan Arması sahneye iner → Sub-Bass Impact + Akor
   - 0.86s: Faz 4 (840ms): Çifte şok dalgası → G5
   - 1.45s: Faz 5 (1450ms): Seviye plakası + buton belirir → nihai zafer notası
   ============================================================================ */
export function playLevelUpSound() {
  if (!isSoundEnabled()) return;
  const engine = getAudioEngine();
  if (!engine) return;

  const now = engine.ctx.currentTime;

  // FAZ 1 (0.00s - 0.68s): Boyut Açılışı & Yükselen Işık Hüzmesi
  const introSparkles = [523.25, 659.25, 783.99, 987.77, 1174.66];
  introSparkles.forEach((f, i) => {
    playHarmonicBell(engine, f, now + i * 0.09, 0.7, 0.065, (i - 2) * 0.3);
  });

  // FAZ 3 (0.68s): Unvan Arması Sahneye Çarpar (Ağır Sinematik Vuruş + Görkemli D Majör/Lydian Akoru)
  const impactTime = now + 0.68;
  playSubImpact(engine, impactTime, 150, 38, 1.3, 0.38);

  // Geniş Orkestral Synth Fanfarı (C3, G3, C4, E4, G4, B4, D5)
  const fanfareChord = [130.81, 196.0, 261.63, 329.63, 392.0, 493.88, 587.33];
  fanfareChord.forEach((f, i) => {
    const pan = ((i % 2 === 0 ? 1 : -1) * (i + 1)) / 8;
    playWarmPadNote(engine, f, impactTime, 0.04, 2.4, 0.075, pan);
  });

  // FAZ 3-5 (0.70s - 1.45s): Taçlandırma Melodisi — son nota faz 5'e (plaka) denk düşer
  const crownMelody = [
    { freq: 523.25, delay: 0.70, dur: 1.4, vol: 0.14, pan: -0.3 }, // C5 (faz 3)
    { freq: 783.99, delay: 0.86, dur: 1.4, vol: 0.15, pan: 0.3 },  // G5 (faz 4 — şok dalgası)
    { freq: 1046.5, delay: 1.02, dur: 1.6, vol: 0.16, pan: -0.2 }, // C6
    { freq: 1318.51, delay: 1.20, dur: 1.8, vol: 0.16, pan: 0.2 }, // E6
    { freq: 1567.98, delay: 1.45, dur: 2.3, vol: 0.18, pan: 0.0 }, // G6 (faz 5 — plaka+buton)
  ];

  crownMelody.forEach((n) => {
    playHarmonicBell(engine, n.freq, now + n.delay, n.dur, n.vol, n.pan);
  });
}

/* ============================================================================
   3. AKADEMİ DERSİ / BİLDİRİM TAMAMLANMA SESİ (Zarif Akustik Cam-Arp Akoru)
   ============================================================================ */
export function playLessonDoneSound() {
  if (!isSoundEnabled()) return;
  const engine = getAudioEngine();
  if (!engine) return;

  const now = engine.ctx.currentTime;

  // Sıcak ve huzurlu Fmaj7/G6 arpeji (F5 -> A5 -> C6 -> E6)
  const notes = [
    { freq: 698.46, delay: 0.0, pan: -0.35 },
    { freq: 880.0, delay: 0.07, pan: -0.1 },
    { freq: 1046.5, delay: 0.14, pan: 0.15 },
    { freq: 1318.51, delay: 0.22, pan: 0.35 },
  ];

  notes.forEach((n, idx) => {
    const isLast = idx === notes.length - 1;
    playHarmonicBell(
      engine,
      n.freq,
      now + n.delay,
      isLast ? 1.35 : 0.85,
      isLast ? 0.13 : 0.1,
      n.pan
    );
  });
}

/* ============================================================================
   4. SİNEMATİK GÖREV TAMAMLANMA MÜZİĞİ (THX / IMAX Gerilim Yükselişi + Patlama)
   0 - 3 Saniye: Filtreli sinematik gerilim ve nabız yükselişi
   3. Saniye: Rozet ekrana çarptığında devasa Sub-Drop + Destansı Zafer Akoru
   ============================================================================ */
export function playQuestCompleteSound() {
  if (!isSoundEnabled()) return;
  const engine = getAudioEngine();
  if (!engine) return;

  const { ctx, dry, wet } = engine;
  const now = ctx.currentTime;

  // --- BÖLÜM 1: FİLTRELİ SİNEMATİK GERİLİM VE YÜKSELİŞ (0.0s - 3.0s) ---
  const riserFilter = ctx.createBiquadFilter();
  riserFilter.type = 'lowpass';
  riserFilter.Q.setValueAtTime(3.5, now);
  riserFilter.frequency.setValueAtTime(110, now);
  riserFilter.frequency.exponentialRampToValueAtTime(3200, now + 2.95);

  const riserGain = ctx.createGain();
  riserGain.gain.setValueAtTime(0.0001, now);
  riserGain.gain.linearRampToValueAtTime(0.16, now + 2.75);
  riserGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.04);

  riserFilter.connect(riserGain);
  riserGain.connect(dry);
  riserGain.connect(wet);

  // THX tarzı birbirine yakınsayan 3 osilatör (Derin sinematik drone/riser)
  const riserFreqs = [
    { start: 65.41, end: 130.81, type: 'sawtooth' as OscillatorType }, // C2 -> C3
    { start: 98.0, end: 196.0, type: 'triangle' as OscillatorType },   // G2 -> G3
    { start: 196.0, end: 523.25, type: 'sine' as OscillatorType },     // G3 -> C5
  ];

  riserFreqs.forEach((rf, i) => {
    const osc = ctx.createOscillator();
    osc.type = rf.type;
    osc.frequency.setValueAtTime(rf.start, now);
    osc.frequency.exponentialRampToValueAtTime(rf.end, now + 2.98);
    osc.detune.setValueAtTime((i - 1) * 8, now);
    osc.connect(riserFilter);
    osc.start(now);
    osc.stop(now + 3.05);
  });

  // --- BÖLÜM 2: DESTANSI PATLAMA VE ZAFER SENFONİSİ (Tam 3.0. Saniyede) ---
  const dropTime = now + 3.0;

  // 1. Devasa IMAX Sub-Drop
  playSubImpact(engine, dropTime, 160, 32, 1.8, 0.42);

  // 2. Görkemli Orkestral Synth Akoru (C2, G2, C3, E3, G3, B3, D4, G4, C5)
  const epicChord = [65.41, 130.81, 196.0, 261.63, 329.63, 392.0, 493.88, 587.33, 783.99];
  epicChord.forEach((freq, idx) => {
    const pan = ((idx % 2 === 0 ? -1 : 1) * (idx + 1)) / 10;
    playWarmPadNote(engine, freq, dropTime, 0.03, 3.6, 0.068, pan);
  });

  // 3. Zirve Kristal Zafer Çanları (Arpeggio)
  const victoryBells = [
    { freq: 1046.5, delay: 0.02, pan: -0.4 },  // C6
    { freq: 1174.66, delay: 0.11, pan: 0.4 },  // D6
    { freq: 1318.51, delay: 0.20, pan: -0.25 }, // E6
    { freq: 1567.98, delay: 0.30, pan: 0.25 }, // G6
    { freq: 2093.0, delay: 0.42, pan: 0.0 },   // C7
  ];

  victoryBells.forEach((b, i) => {
    const isFinal = i === victoryBells.length - 1;
    playHarmonicBell(
      engine,
      b.freq,
      dropTime + b.delay,
      isFinal ? 2.6 : 1.5,
      isFinal ? 0.14 : 0.11,
      b.pan
    );
  });
}