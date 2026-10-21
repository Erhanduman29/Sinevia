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
 * Analog Tüp Doygunluğu (Soft-Clipper WaveShaper).
 * Devasa Mythic/Legendary akorlarda dijital kırpılmayı (clipping) önler,
 * harmonik sıcaklık ve tok bir sinema miksajı kazandırır.
 */
// Dönüş tipi bilinçli olarak yazılmıyor: yeni TS (5.7+) `Float32Array<ArrayBuffer>`
// çıkarır (WaveShaperNode.curve bunu ister), eski TS `Float32Array` — annotation
// her iki sürümde de kırılırdı; `new Float32Array(...)` zaten doğru alt tipi verir.
function createWarmSaturationCurve() {
  const samples = 8192;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // Yumuşak hiperbolik tanjant doygunluğu
    curve[i] = Math.tanh(x * 1.35) / Math.tanh(1.35);
  }
  return curve;
}

/**
 * Sinema salonu akustiği için True-Stereo Impulse Response (Yankı) üretici.
 * Sol/sağ dekoratif erken yansımalar (early reflections) + kadifemsi kuyruk içerir.
 */
function createCinemaImpulse(ctx: AudioContext, duration = 2.8, decay = 2.9): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);

  // Gerçek IMAX salonu duvar yansımaları (ms cinsinden sağ/sol farklı gecikmeler)
  const earlyTapsL = [0.011, 0.019, 0.029, 0.043, 0.059, 0.078];
  const earlyTapsR = [0.013, 0.023, 0.034, 0.048, 0.064, 0.083];

  for (let ch = 0; ch < 2; ch++) {
    const channelData = impulse.getChannelData(ch);
    const taps = ch === 0 ? earlyTapsL : earlyTapsR;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const fadeIn = Math.min(1, t / 0.035);
      // Çift katmanlı sönümlenme (hızlı gövde + uzun kadife kuyruk)
      const env = (Math.pow(1 - i / length, decay) * 0.8 + Math.pow(1 - i / length, decay * 0.55) * 0.2) * fadeIn;
      channelData[i] = (Math.random() * 2 - 1) * env * 0.48;
    }

    // Erken yansımaları (Early Reflections) enjekte et
    taps.forEach((tapTime, idx) => {
      const sampleIdx = Math.floor(tapTime * sampleRate);
      if (sampleIdx < length) {
        channelData[sampleIdx] += (idx % 2 === 0 ? 0.35 : -0.35) * Math.pow(0.78, idx);
      }
    });
  }
  return impulse;
}

/**
 * AudioContext + Analog Saturator + Master Compressor + Sinematik Reverb Veri Yolu
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

      // Master Limiter / Compressor
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-13, audioCtx.currentTime);
      compressor.knee.setValueAtTime(16, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(6.5, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.002, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.24, audioCtx.currentTime);
      compressor.connect(audioCtx.destination);

      // Analog Sıcaklık Katmanı (Soft Clipper)
      const saturator = audioCtx.createWaveShaper();
      saturator.curve = createWarmSaturationCurve();
      saturator.oversample = '2x';
      saturator.connect(compressor);

      masterBus = audioCtx.createGain();
      masterBus.gain.setValueAtTime(0.86, audioCtx.currentTime);
      masterBus.connect(saturator);

      // Sinematik Reverb Kanalı (Sub-çamuru önleyen Highpass + Tiz yumuşatan Lowpass)
      const convolver = audioCtx.createConvolver();
      convolver.buffer = createCinemaImpulse(audioCtx, 2.8, 2.9);

      const reverbHighpass = audioCtx.createBiquadFilter();
      reverbHighpass.type = 'highpass';
      reverbHighpass.frequency.setValueAtTime(145, audioCtx.currentTime);

      const reverbLowpass = audioCtx.createBiquadFilter();
      reverbLowpass.type = 'lowpass';
      reverbLowpass.frequency.setValueAtTime(3400, audioCtx.currentTime);

      reverbWetBus = audioCtx.createGain();
      reverbWetBus.gain.setValueAtTime(0.38, audioCtx.currentTime);

      reverbWetBus.connect(reverbHighpass);
      reverbHighpass.connect(reverbLowpass);
      reverbLowpass.connect(convolver);
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

type AudioEngine = { ctx: AudioContext; dry: AudioNode; wet: AudioNode };

/* ============================================================================
   YARDIMCI ENSTRÜMAN SENTEZLEYİCİLERİ
   (CHIME, WARM PAD, SUB IMPACT, CELESTA, BRASS HORN, ETHEREAL CHOIR, TELEMETRY)
   ============================================================================ */

/**
 * 1. Kristal / Rhodes Çan Sesi (FM Sentezli + Harmonik Parıltılı + Stereo Panlı)
 */
function playHarmonicBell(
  engine: AudioEngine,
  freq: number,
  startTime: number,
  duration: number,
  volume = 0.14,
  pan = 0
) {
  const { ctx, dry, wet } = engine;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(8200, freq * 3.4), startTime);
  filter.frequency.exponentialRampToValueAtTime(Math.max(900, freq * 1.2), startTime + duration);

  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const outNode = panner || ctx.createGain();
  if (panner) {
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), startTime);
  }
  filter.connect(outNode);
  outNode.connect(dry);
  outNode.connect(wet);

  // Ana Gövde (Sıcak Sine + Triangle + Kristal Üst Oktav Parıltısı)
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const osc3 = ctx.createOscillator();
  osc1.type = 'sine';
  osc2.type = 'triangle';
  osc3.type = 'sine';

  osc1.frequency.setValueAtTime(freq, startTime);
  osc2.frequency.setValueAtTime(freq * 2, startTime);
  osc2.detune.setValueAtTime(4, startTime);
  osc3.frequency.setValueAtTime(freq * 3, startTime);
  osc3.detune.setValueAtTime(-5, startTime);

  const env1 = ctx.createGain();
  const env2 = ctx.createGain();
  const env3 = ctx.createGain();

  env1.gain.setValueAtTime(0.0001, startTime);
  env1.gain.linearRampToValueAtTime(volume, startTime + 0.014);
  env1.gain.exponentialRampToValueAtTime(volume * 0.26, startTime + duration * 0.36);
  env1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  env2.gain.setValueAtTime(0.0001, startTime);
  env2.gain.linearRampToValueAtTime(volume * 0.22, startTime + 0.009);
  env2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.42);

  env3.gain.setValueAtTime(0.0001, startTime);
  env3.gain.linearRampToValueAtTime(volume * 0.08, startTime + 0.006);
  env3.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.min(0.35, duration * 0.28));

  osc1.connect(env1);
  osc2.connect(env2);
  osc3.connect(env3);
  env1.connect(filter);
  env2.connect(filter);
  env3.connect(filter);

  osc1.start(startTime);
  osc2.start(startTime);
  osc3.start(startTime);
  osc1.stop(startTime + duration + 0.05);
  osc2.stop(startTime + duration * 0.5);
  osc3.stop(startTime + Math.min(0.4, duration * 0.35));
}

/**
 * 2. Sinematik Sıcak Synth Pad Akor Sesi (Filtreli & Detuned)
 */
function playWarmPadNote(
  engine: AudioEngine,
  freq: number,
  startTime: number,
  attack: number,
  duration: number,
  volume = 0.1,
  pan = 0
) {
  const { ctx, dry, wet } = engine;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.setValueAtTime(1.4, startTime);
  filter.frequency.setValueAtTime(280, startTime);
  filter.frequency.exponentialRampToValueAtTime(2300, startTime + attack + 0.15);
  filter.frequency.exponentialRampToValueAtTime(580, startTime + duration);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, startTime);
  env.gain.linearRampToValueAtTime(volume, startTime + attack);
  env.gain.setValueAtTime(volume * 0.85, startTime + Math.min(duration * 0.7, attack + 0.15));
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (panner) {
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), startTime);
    filter.connect(env);
    env.connect(panner);
    panner.connect(dry);
    panner.connect(wet);
  } else {
    filter.connect(env);
    env.connect(dry);
    env.connect(wet);
  }

  [-6, 6].forEach((detuneCents, idx) => {
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
 * 3. Sinematik Sub-Bass Impact (Tok ve geniş stereo bas darbesi)
 */
function playSubImpact(
  engine: AudioEngine,
  startTime: number,
  startFreq = 130,
  endFreq = 36,
  duration = 0.85,
  volume = 0.34,
  centerPan = 0
) {
  const { ctx, dry, wet } = engine;

  [-5, 5].forEach((detune, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.detune.setValueAtTime(detune, startTime);

    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration * 0.65);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume * 0.55, startTime + 0.016);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      const pan = i === 0 ? centerPan - 0.3 : centerPan + 0.3;
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), startTime);
      gain.connect(panner);
      panner.connect(dry);
      panner.connect(wet);
    } else {
      gain.connect(dry);
    }

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  });
}

/**
 * 4. Kadifemsi Akustik Marimba / Celesta Notası (Sıfır çıtırtı, sıcak ahşap/kristal gövde)
 */
function playSoftMarimbaNote(
  engine: AudioEngine,
  freq: number,
  startTime: number,
  duration: number,
  volume: number,
  pan = 0
) {
  const { ctx, dry, wet } = engine;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.setValueAtTime(1.4, startTime);
  filter.frequency.setValueAtTime(freq * 4.2, startTime);
  filter.frequency.exponentialRampToValueAtTime(freq * 1.15, startTime + duration);

  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const outNode = panner || ctx.createGain();
  if (panner) {
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), startTime);
  }
  filter.connect(outNode);
  outNode.connect(dry);
  outNode.connect(wet);

  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.setValueAtTime(freq * 1.015, startTime);
  o1.frequency.exponentialRampToValueAtTime(freq, startTime + 0.018);

  const env1 = ctx.createGain();
  env1.gain.setValueAtTime(0.0001, startTime);
  env1.gain.linearRampToValueAtTime(volume, startTime + 0.012);
  env1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  o1.connect(env1);
  env1.connect(filter);
  o1.start(startTime);
  o1.stop(startTime + duration + 0.03);

  const o2 = ctx.createOscillator();
  o2.type = 'triangle';
  o2.frequency.setValueAtTime(freq * 2.0, startTime);

  const env2 = ctx.createGain();
  const harmDur = Math.min(0.24, duration * 0.55);
  env2.gain.setValueAtTime(0.0001, startTime);
  env2.gain.linearRampToValueAtTime(volume * 0.18, startTime + 0.008);
  env2.gain.exponentialRampToValueAtTime(0.0001, startTime + harmDur);

  o2.connect(env2);
  env2.connect(filter);
  o2.start(startTime);
  o2.stop(startTime + harmDur + 0.02);
}

/**
 * 5. Epik Sinematik Korno / Bakır Üflemeli (Hans Zimmer Stili Brass Swell)
 * Epic, Legendary ve Mythic görevlerde orkestral ihtişam ve gövde sağlar.
 */
function playCinematicBrass(
  engine: AudioEngine,
  freq: number,
  startTime: number,
  attack: number,
  duration: number,
  volume = 0.09,
  pan = 0
) {
  const { ctx, dry, wet } = engine;

  // Bakır karakterini veren çift filtre: Formant Rezonans + Lowpass Zarfı
  const brassFilter = ctx.createBiquadFilter();
  brassFilter.type = 'lowpass';
  brassFilter.Q.setValueAtTime(2.4, startTime);
  brassFilter.frequency.setValueAtTime(Math.max(160, freq * 0.8), startTime);
  brassFilter.frequency.exponentialRampToValueAtTime(Math.min(4800, freq * 7.5), startTime + attack);
  brassFilter.frequency.exponentialRampToValueAtTime(Math.max(320, freq * 1.8), startTime + duration);

  const formant = ctx.createBiquadFilter();
  formant.type = 'peaking';
  formant.frequency.setValueAtTime(680, startTime);
  formant.Q.setValueAtTime(1.8, startTime);
  formant.gain.setValueAtTime(4.5, startTime);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, startTime);
  env.gain.linearRampToValueAtTime(volume, startTime + attack);
  env.gain.setValueAtTime(volume * 0.82, startTime + Math.min(duration * 0.72, attack + 0.25));
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const outNode = panner || ctx.createGain();
  if (panner) {
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), startTime);
  }

  brassFilter.connect(formant);
  formant.connect(env);
  env.connect(outNode);
  outNode.connect(dry);
  outNode.connect(wet);

  // 3'lü Supersaw Unison + Nefes gerçekçiliği için mikro pitch-glide
  [-9, 0, 9].forEach((detuneCents) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 0.992, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq, startTime + Math.min(0.06, attack * 0.5));
    osc.detune.setValueAtTime(detuneCents, startTime);
    osc.connect(brassFilter);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  });
}

/**
 * 6. Göksel Koro Sentezleyicisi (Formant Vowel "Ahhh" Choir)
 * Legendary ve Mythic görevlerin zirve anında kutsal/destansı atmosfer açar.
 */
function playEtherealChoir(
  engine: AudioEngine,
  freq: number,
  startTime: number,
  attack: number,
  duration: number,
  volume = 0.065,
  pan = 0
) {
  const { ctx, dry, wet } = engine;

  // İnsan sesindeki "Aaa-Ooo" ünlü formant frekansları (Paralel Bandpass)
  const formant1 = ctx.createBiquadFilter();
  formant1.type = 'bandpass';
  formant1.frequency.setValueAtTime(750, startTime);
  formant1.Q.setValueAtTime(3.2, startTime);

  const formant2 = ctx.createBiquadFilter();
  formant2.type = 'bandpass';
  formant2.frequency.setValueAtTime(1180, startTime);
  formant2.Q.setValueAtTime(3.8, startTime);

  const airFilter = ctx.createBiquadFilter();
  airFilter.type = 'lowpass';
  airFilter.frequency.setValueAtTime(2600, startTime);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, startTime);
  env.gain.linearRampToValueAtTime(volume, startTime + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const outNode = panner || ctx.createGain();
  if (panner) {
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), startTime);
  }

  formant1.connect(airFilter);
  formant2.connect(airFilter);
  airFilter.connect(env);
  env.connect(outNode);
  // Koro ağırlıklı olarak geniş salon yankısına (wet) gönderilir
  outNode.connect(wet);
  outNode.connect(dry);

  [-11, -4, 4, 11].forEach((detune, idx) => {
    const osc = ctx.createOscillator();
    osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.detune.setValueAtTime(detune, startTime);
    osc.connect(formant1);
    osc.connect(formant2);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.06);
  });
}

/**
 * 7. Sinematik Veri / Telemetri Nabzı (Phase 0 Terminal Doğrulama Ritimleri İçin)
 * Kulak tırmalamayan, sıcak kristal-elektronik doğrulama darbesi.
 */
function playTelemetryPulse(
  engine: AudioEngine,
  freq: number,
  startTime: number,
  duration = 0.14,
  volume = 0.05,
  pan = 0
) {
  const { ctx, dry, wet } = engine;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq * 1.6, startTime);
  filter.Q.setValueAtTime(2.2, startTime);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, startTime);
  env.gain.linearRampToValueAtTime(volume, startTime + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const outNode = panner || ctx.createGain();
  if (panner) {
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), startTime);
  }

  filter.connect(env);
  env.connect(outNode);
  outNode.connect(dry);
  outNode.connect(wet);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq * 1.04, startTime);
  osc.frequency.exponentialRampToValueAtTime(freq, startTime + 0.025);

  osc.connect(filter);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

/**
 * 8. Sinematik Gerilim Yükseltici (Harmonik Stereo Riser)
 */
function playHarmonicRiser(
  engine: AudioEngine,
  startTime: number,
  duration: number,
  voices: Array<{ startFreq: number; endFreq: number; type: OscillatorType; panStart: number; panEnd: number }>,
  peakVolume = 0.14,
  cutoffEnd = 2800
) {
  const { ctx, dry, wet } = engine;

  voices.forEach((v, idx) => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(2.8, startTime);
    filter.frequency.setValueAtTime(110, startTime);
    filter.frequency.exponentialRampToValueAtTime(cutoffEnd, startTime + duration * 0.96);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakVolume / voices.length, startTime + duration * 0.92);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.03);

    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const out = panner || ctx.createGain();
    if (panner) {
      panner.pan.setValueAtTime(v.panStart, startTime);
      panner.pan.linearRampToValueAtTime(v.panEnd, startTime + duration);
    }

    filter.connect(gain);
    gain.connect(out);
    out.connect(dry);
    out.connect(wet);

    const osc = ctx.createOscillator();
    osc.type = v.type;
    osc.frequency.setValueAtTime(v.startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(v.endFreq, startTime + duration * 0.98);
    osc.detune.setValueAtTime((idx - 1) * 7, startTime);

    osc.connect(filter);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  });
}

/**
 * Tek bir tok SineCoin tıkırtısı: yumuşak temas gürültüsü, alçak metalik
 * kısmi tonlar ve paranın ağırlığını hissettiren kısa bir bas gövdesi.
 */
function playCoinClink(
  engine: { ctx: AudioContext; dry: AudioNode; wet: AudioNode },
  startTime: number,
  baseFreq: number,
  pan: number,
  volume: number,
) {
  const { ctx, dry, wet } = engine;
  const out = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  if ('pan' in out) out.pan.setValueAtTime(pan, startTime);

  // Tiz cızırtıyı kesen, gövdeyi öne çıkaran ortak renk filtresi.
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.setValueAtTime(5200, startTime);
  tone.Q.setValueAtTime(0.55, startTime);
  tone.connect(out);

  out.connect(dry);

  // Orta seviye reverb: kuru tıkırtıyı boğmadan mekân derinliği ekler.
  const wetSend = ctx.createGain();
  wetSend.gain.value = 0.36;
  out.connect(wetSend);
  wetSend.connect(wet);

  // 1) Yumuşak temas gürültüsü (6 kHz cızırtısı yerine alçak-orta bant)
  const noiseLen = Math.floor(ctx.sampleRate * 0.075);
  const buffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
  const ch = buffer.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen) ** 2.4;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(2150, startTime);
  bp.Q.setValueAtTime(0.75, startTime);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.28, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.065);
  noise.connect(bp); bp.connect(noiseGain); noiseGain.connect(tone);
  noise.start(startTime); noise.stop(startTime + 0.09);

  // 2) Alçak, inharmonik ve uzun sönümlü metalik kısmi tonlar
  const partials = [
    { ratio: 1, gain: 0.5, decay: 0.72, type: 'triangle' as OscillatorType },
    { ratio: 1.51, gain: 0.26, decay: 0.58, type: 'sine' as OscillatorType },
    { ratio: 2.04, gain: 0.14, decay: 0.42, type: 'sine' as OscillatorType },
    { ratio: 2.63, gain: 0.07, decay: 0.28, type: 'sine' as OscillatorType },
  ];
  partials.forEach((p) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const freq = baseFreq * p.ratio;
    osc.type = p.type;
    osc.frequency.setValueAtTime(freq, startTime);
    // Hafif aşağı kayma: temas anındaki metal gerilimi ve "tok" hissi.
    osc.frequency.exponentialRampToValueAtTime(freq * 0.984, startTime + Math.min(0.14, p.decay * 0.4));
    osc.detune.setValueAtTime((Math.random() - 0.5) * 9, startTime);
    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.exponentialRampToValueAtTime(volume * p.gain, startTime + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + p.decay);
    osc.connect(g); g.connect(tone);
    osc.start(startTime); osc.stop(startTime + p.decay + 0.03);
  });

  // 3) Paranın avuca düşme ağırlığı: alçak, yuvarlak bas gövdesi.
  const thud = ctx.createOscillator();
  const thudGain = ctx.createGain();
  const thudFilter = ctx.createBiquadFilter();
  thud.type = 'triangle';
  thud.frequency.setValueAtTime(165, startTime);
  thud.frequency.exponentialRampToValueAtTime(88, startTime + 0.24);
  thudFilter.type = 'lowpass';
  thudFilter.frequency.setValueAtTime(430, startTime);
  thudGain.gain.setValueAtTime(0.0001, startTime);
  thudGain.gain.exponentialRampToValueAtTime(volume * 0.34, startTime + 0.008);
  thudGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.46);
  thud.connect(thudFilter); thudFilter.connect(thudGain); thudGain.connect(tone);
  thud.start(startTime); thud.stop(startTime + 0.5);
}

/**
 * SineCoin kazanma / harcama için stereo, tok ve uzun kuyruklu para sesi.
 * İlk temas → kısa stereo cascade → ağır oturma ve sıcak çan kuyruğu.
 */
export function playCoinSound() {
  if (!isSoundEnabled()) return;
  const engine = getAudioEngine();
  if (!engine) return;
  const now = engine.ctx.currentTime;

  // Paraların avuca bıraktığı ağırlık (sinematik alt gövde).
  playSubImpact(engine, now, 150, 52, 1.55, 0.14, 0);

  // İlk temas: sağ-sol genişliğinde üç tok tıkırtı.
  playCoinClink(engine, now, 1174.66, -0.38, 0.24);
  playCoinClink(engine, now + 0.105, 1318.51, 0.4, 0.21);
  playCoinClink(engine, now + 0.22, 1244.51, 0.02, 0.17);

  // İkinci dalga: daha hafif, soldan sağa akan paralar.
  playCoinClink(engine, now + 0.74, 1108.73, -0.46, 0.12);
  playCoinClink(engine, now + 0.87, 1174.66, 0.48, 0.11);
  playCoinClink(engine, now + 1.04, 987.77, 0.08, 0.1);

  // Son paranın oturması + sıcak, alçak rezonans kuyruğu.
  playCoinClink(engine, now + 1.58, 880, -0.08, 0.13);
  playSubImpact(engine, now + 1.59, 122, 44, 1.85, 0.11, 0);
  playHarmonicBell(engine, 587.33, now + 1.76, 2.5, 0.05, 0.16);
}

/* ============================================================================
   1. BAŞARIM / KUPA KAZANMA SESİ (PS5 Platinum Trophy / Xbox Rare Chime Stili)
   ============================================================================ */
export function playAchievementSound() {
  if (!isSoundEnabled()) return;
  const engine = getAudioEngine();
  if (!engine) return;

  const now = engine.ctx.currentTime;

  playSubImpact(engine, now, 110, 55, 0.7, 0.22);
  const padChord = [130.81, 196.0, 246.94, 329.63];
  padChord.forEach((f, i) => {
    playWarmPadNote(engine, f, now + 0.02, 0.08, 1.45, 0.055, (i - 1.5) * 0.35);
  });

  const bellNotes = [
    { freq: 783.99, time: 0.0, dur: 1.1, vol: 0.13, pan: -0.4 },   // G5
    { freq: 987.77, time: 0.075, dur: 1.1, vol: 0.13, pan: -0.15 }, // B5
    { freq: 1174.66, time: 0.15, dur: 1.2, vol: 0.14, pan: 0.15 }, // D6
    { freq: 1318.51, time: 0.23, dur: 1.6, vol: 0.16, pan: 0.4 },  // E6
    { freq: 1567.98, time: 0.34, dur: 1.9, vol: 0.12, pan: 0.0 },  // G6
  ];

  bellNotes.forEach((n) => {
    playHarmonicBell(engine, n.freq, now + n.time, n.dur, n.vol, n.pan);
  });
}

/* ============================================================================
   2. SEVİYE ATLAMA SESİ (LevelUpModal Fazlarıyla Tam Senkronize Epik Fanfar)
   ============================================================================ */
export function playLevelUpSound() {
  if (!isSoundEnabled()) return;
  const engine = getAudioEngine();
  if (!engine) return;

  const now = engine.ctx.currentTime;

  const introSparkles = [523.25, 659.25, 783.99, 987.77, 1174.66];
  introSparkles.forEach((f, i) => {
    playHarmonicBell(engine, f, now + i * 0.09, 0.7, 0.065, (i - 2) * 0.3);
  });

  const impactTime = now + 0.68;
  playSubImpact(engine, impactTime, 150, 38, 1.3, 0.38);

  const fanfareChord = [130.81, 196.0, 261.63, 329.63, 392.0, 493.88, 587.33];
  fanfareChord.forEach((f, i) => {
    const pan = ((i % 2 === 0 ? 1 : -1) * (i + 1)) / 8;
    playWarmPadNote(engine, f, impactTime, 0.04, 2.4, 0.075, pan);
  });

  const crownMelody = [
    { freq: 523.25, delay: 0.70, dur: 1.4, vol: 0.14, pan: -0.3 },
    { freq: 783.99, delay: 0.86, dur: 1.4, vol: 0.15, pan: 0.3 },
    { freq: 1046.5, delay: 1.02, dur: 1.6, vol: 0.16, pan: -0.2 },
    { freq: 1318.51, delay: 1.20, dur: 1.8, vol: 0.16, pan: 0.2 },
    { freq: 1567.98, delay: 1.45, dur: 2.3, vol: 0.18, pan: 0.0 },
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
   4. SİNEMATİK GÖREV TAMAMLANMA MÜZİĞİ (5 TIER ÖZEL BESTE & 3 FAZ TAM SENKRON)
   ----------------------------------------------------------------------------
   QuestCelebrationOverlay Zaman Çizelgesi:
   - Phase 0 (0.00s - 3.00s): Terminal Doğrulama & Kontrat Eşleşmesi (Ritim + Riser)
   - Phase 1 (3.00s - 5.00s): Nadirlik Rozeti & Görev Başlığı Patlaması (Ana Drop)
   - Phase 2 (5.00s+)       : Görev Arması (Crest) Mühürlenmesi & Ödül Butonu Açılışı
   ============================================================================ */

export type QuestSoundTier = 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';

function normalizeQuestTier(rarity?: string): QuestSoundTier {
  const r = (rarity || 'common').trim().toLowerCase();
  if (r.includes('mythic') || r.includes('mitik')) return 'Mythic';
  if (r.includes('legend') || r.includes('efsane')) return 'Legendary';
  if (r.includes('epic') || r.includes('epik')) return 'Epic';
  if (r.includes('rare') || r.includes('nadir')) return 'Rare';
  return 'Common';
}

/**
 * TIER 1: COMMON (20 Görev) — "Sıcak Akustik Sinema & Minimal Zarafet"
 * Ton: C Major 9 | Ritim: Sakin 6 adımlı (0.48s) kadifemsi marimba nabzı.
 * Sade, yormayan, sıcak ahşap ve yumuşak kristal dokunuşlu kontrat onayı.
 */
function playCommonQuestSymphony(engine: AudioEngine, now: number) {
  // FAZ 0 (0.0s - 3.0s): Sakin terminal nabzı (6 adım) + İpeksi Riser
  const pulseNotes = [261.63, 329.63, 392.0, 493.88, 523.25, 659.25]; // Cmaj7 tırmanışı
  pulseNotes.forEach((f, i) => {
    const t = now + 0.18 + i * 0.45;
    const pan = (i % 2 === 0 ? -1 : 1) * 0.25;
    playSoftMarimbaNote(engine, f, t, 0.38, 0.042 + i * 0.005, pan);
  });

  playHarmonicRiser(
    engine,
    now,
    2.96,
    [
      { startFreq: 130.81, endFreq: 261.63, type: 'sine', panStart: -0.25, panEnd: 0.25 },
      { startFreq: 196.0, endFreq: 392.0, type: 'triangle', panStart: 0.25, panEnd: -0.25 },
    ],
    0.09,
    1600
  );

  // FAZ 1 (3.00s): Kontrat Başlığı Açılışı — Sıcak Cmaj9 Pad & Yumuşak Çan Arpeji
  const drop = now + 3.0;
  playSubImpact(engine, drop, 115, 45, 1.15, 0.24);

  const commonChord = [130.81, 196.0, 261.63, 329.63, 392.0, 587.33]; // C Maj9
  commonChord.forEach((f, idx) => {
    playWarmPadNote(engine, f, drop, 0.05, 2.5, 0.048, (idx - 2.5) * 0.18);
  });

  const chimes = [
    { freq: 523.25, delay: 0.02, pan: -0.3, vol: 0.09 },  // C5
    { freq: 659.25, delay: 0.13, pan: 0.0, vol: 0.095 },  // E5
    { freq: 783.99, delay: 0.25, pan: 0.3, vol: 0.105 },  // G5
    { freq: 1174.66, delay: 0.40, pan: 0.0, vol: 0.11 },  // D6
  ];
  chimes.forEach((c, idx) => {
    playHarmonicBell(engine, c.freq, drop + c.delay, idx === 3 ? 1.9 : 1.2, c.vol, c.pan);
  });

  // FAZ 2 (5.00s): Arma Yerine Otururken Nazik Kristal Mühür
  const seal = now + 5.0;
  playSoftMarimbaNote(engine, 523.25, seal, 0.8, 0.065, -0.2);
  playHarmonicBell(engine, 1046.5, seal + 0.04, 1.6, 0.09, 0.0);
  playHarmonicBell(engine, 1318.51, seal + 0.14, 1.9, 0.08, 0.25);
}

/**
 * TIER 2: RARE (15 Görev) — "Kristal Prizma & Senkoplu Stereo Akış"
 * Ton: D Dorian -> D Major 9 | Ritim: 10 adımlı hızlanan stereo telemetri + marimba.
 * Common'dan belirgin şekilde daha parlak, stereo sahnesi geniş ve enerjik.
 */
function playRareQuestSymphony(engine: AudioEngine, now: number) {
  // FAZ 0 (0.0s - 3.0s): 10 Adımlı Stereo Prizma Arpeji + Derin Bas Kalp Atışı
  const dorianScale = [293.66, 329.63, 349.23, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
  dorianScale.forEach((f, i) => {
    const t = now + 0.12 + i * 0.275;
    const pan = Math.sin(i * 1.1) * 0.48;
    playSoftMarimbaNote(engine, f, t, 0.34, 0.045 + i * 0.004, pan);
    if (i % 2 === 1) {
      playTelemetryPulse(engine, f * 2, t + 0.08, 0.12, 0.032, -pan);
    }
  });

  // 2 adet derin radar bas nabzı
  playSubImpact(engine, now + 0.4, 95, 48, 0.55, 0.15, -0.2);
  playSubImpact(engine, now + 1.65, 105, 50, 0.55, 0.18, 0.2);

  playHarmonicRiser(
    engine,
    now,
    2.97,
    [
      { startFreq: 73.42, endFreq: 146.83, type: 'sawtooth', panStart: -0.4, panEnd: 0.4 },
      { startFreq: 146.83, endFreq: 293.66, type: 'triangle', panStart: 0.4, panEnd: -0.4 },
      { startFreq: 220.0, endFreq: 587.33, type: 'sine', panStart: 0.0, panEnd: 0.0 },
    ],
    0.12,
    2400
  );

  // FAZ 1 (3.00s): D Dorian'dan Parlak D Major 9'a Işıltılı Çözülüş!
  const drop = now + 3.0;
  playSubImpact(engine, drop, 135, 38, 1.45, 0.31);

  const rareChord = [73.42, 146.83, 220.0, 293.66, 369.99, 440.0, 554.37, 659.25]; // D Maj9
  rareChord.forEach((f, idx) => {
    const pan = ((idx % 2 === 0 ? -1 : 1) * (idx + 1)) / 9;
    playWarmPadNote(engine, f, drop, 0.04, 2.8, 0.056, pan);
  });

  const rareBells = [
    { freq: 739.99, delay: 0.0, pan: -0.45, vol: 0.105 },  // F#5
    { freq: 880.0, delay: 0.09, pan: 0.45, vol: 0.11 },    // A5
    { freq: 1108.73, delay: 0.18, pan: -0.25, vol: 0.115 },// C#6
    { freq: 1174.66, delay: 0.28, pan: 0.25, vol: 0.12 },  // D6
    { freq: 1479.98, delay: 0.40, pan: 0.0, vol: 0.13 },   // F#6
  ];
  rareBells.forEach((b, i) => {
    playHarmonicBell(engine, b.freq, drop + b.delay, i === 4 ? 2.1 : 1.35, b.vol, b.pan);
  });

  // FAZ 2 (5.00s): Arma İnişi & Kristal Çift Sesli Mühür
  const seal = now + 5.0;
  playSubImpact(engine, seal, 120, 44, 0.85, 0.20);
  playWarmPadNote(engine, 293.66, seal, 0.03, 1.6, 0.055, -0.3);
  playWarmPadNote(engine, 369.99, seal, 0.03, 1.6, 0.055, 0.3);
  playHarmonicBell(engine, 880.0, seal + 0.02, 1.5, 0.10, -0.35);
  playHarmonicBell(engine, 1174.66, seal + 0.10, 1.8, 0.11, 0.35);
  playHarmonicBell(engine, 1760.0, seal + 0.20, 2.1, 0.10, 0.0);
}

/**
 * TIER 3: EPIC (8 Görev) — "IMAX Orkestral Gerilim, Taiko Ritim & Bakır Fanfar"
 * Ton: E Minor -> C Lydian / E Major (Heroic Cadence)
 * Ritim: 3'e karşı 2 poliritmik tırmanış + Taiko bas yürüyüşü + Sinematik Korno (Brass).
 */
function playEpicQuestSymphony(engine: AudioEngine, now: number) {
  // FAZ 0 (0.0s - 3.0s): Poliritmik Ostinato (12 Adım) + 4 Hızlanan Taiko Darbesi
  const ostinato = [
    164.81, 246.94, 329.63, 392.0, 493.88, 587.33,
    659.25, 783.99, 987.77, 1174.66, 1318.51, 1567.98,
  ];
  ostinato.forEach((f, i) => {
    const t = now + 0.08 + i * 0.235;
    const pan = ((i % 3) - 1) * 0.55;
    playSoftMarimbaNote(engine, f, t, 0.32, 0.052 + i * 0.003, pan);
    if (i >= 4) {
      playHarmonicBell(engine, f * 1.5, t + 0.06, 0.45, 0.038, -pan);
    }
  });

  // Gerilimi tırmandıran sinematik Taiko vuruşları
  [0.0, 0.95, 1.75, 2.35, 2.72].forEach((t, idx) => {
    playSubImpact(engine, now + t, 110 + idx * 10, 42, 0.6, 0.18 + idx * 0.03, (idx % 2 === 0 ? -1 : 1) * 0.25);
  });

  playHarmonicRiser(
    engine,
    now,
    2.98,
    [
      { startFreq: 82.41, endFreq: 164.81, type: 'sawtooth', panStart: -0.6, panEnd: 0.6 },
      { startFreq: 123.47, endFreq: 246.94, type: 'sawtooth', panStart: 0.6, panEnd: -0.6 },
      { startFreq: 164.81, endFreq: 659.25, type: 'triangle', panStart: -0.3, panEnd: 0.3 },
    ],
    0.15,
    3200
  );

  // FAZ 1 (3.00s): Epik Patlama! Sinematik Bakır (Brass) + Geniş Orkestral Halı
  const drop = now + 3.0;
  playSubImpact(engine, drop, 165, 34, 1.85, 0.40);

  // Kahramanca E MajorAdd9 + C Lydian bas derinliği
  const epicBrassVoices = [82.41, 164.81, 246.94, 329.63, 415.30, 493.88]; // E2 B2 E3 G#3 B3
  epicBrassVoices.forEach((f, idx) => {
    const pan = ((idx % 2 === 0 ? -1 : 1) * (idx + 1)) / 7;
    playCinematicBrass(engine, f, drop, 0.06, 2.3, 0.068, pan);
  });

  const epicPads = [164.81, 246.94, 329.63, 415.30, 659.25, 739.99];
  epicPads.forEach((f, idx) => {
    playWarmPadNote(engine, f, drop, 0.04, 3.2, 0.055, (idx - 2.5) * 0.25);
  });

  // Zirve Fanfar Melodisi (B5 -> E6 -> F#6 -> G#6 -> B6)
  const fanfare = [
    { freq: 987.77, delay: 0.0, dur: 1.3, vol: 0.12, pan: -0.5 },
    { freq: 1318.51, delay: 0.11, dur: 1.4, vol: 0.125, pan: 0.5 },
    { freq: 1479.98, delay: 0.22, dur: 1.5, vol: 0.13, pan: -0.3 },
    { freq: 1661.22, delay: 0.34, dur: 1.8, vol: 0.135, pan: 0.3 },
    { freq: 1975.53, delay: 0.48, dur: 2.4, vol: 0.145, pan: 0.0 },
  ];
  fanfare.forEach((n) => {
    playHarmonicBell(engine, n.freq, drop + n.delay, n.dur, n.vol, n.pan);
  });

  // FAZ 2 (5.00s): Görev Arması (Crest) Mühür Darbesi & Bakır Yankısı
  const seal = now + 5.0;
  playSubImpact(engine, seal, 145, 38, 1.3, 0.30);
  playCinematicBrass(engine, 164.81, seal, 0.04, 1.8, 0.06, -0.35);
  playCinematicBrass(engine, 246.94, seal, 0.04, 1.8, 0.06, 0.35);
  playCinematicBrass(engine, 415.30, seal, 0.05, 1.9, 0.055, 0.0);

  playHarmonicBell(engine, 1318.51, seal + 0.02, 1.8, 0.12, -0.4);
  playHarmonicBell(engine, 1661.22, seal + 0.11, 2.0, 0.12, 0.4);
  playHarmonicBell(engine, 2637.02, seal + 0.22, 2.4, 0.11, 0.0); // E7 Parıltısı
}

/**
 * TIER 4: LEGENDARY (5 Görev) — "Kraliyet Senfonisi, Göksel Koro & Üçlü Modülasyon"
 * Ton: F Lydian -> D Major -> G Major 9 (Kraliyet Zafer Çözülüşü)
 * Ritim: 16 adımlı çift kanallı hızlanan arpej + Melek Korosu + Korno Fanfarı.
 */
function playLegendaryQuestSymphony(engine: AudioEngine, now: number) {
  // FAZ 0 (0.0s - 3.0s): 16 Adımlı Çift Kanallı Hızlanan Arpej Fırtınası
  const notesL = [
    196.0, 246.94, 293.66, 369.99, 392.0, 493.88, 587.33, 739.99,
    783.99, 987.77, 1174.66, 1479.98, 1567.98, 1760.0, 1975.53, 2349.32,
  ];
  for (let i = 0; i < 16; i++) {
    // Easing ile giderek sıklaşan heyecan verici ritim
    const progress = i / 16;
    const t = now + 0.05 + (progress * 0.75 + Math.pow(progress, 1.8) * 0.25) * 2.78;
    const pan = Math.cos(i * 0.9) * 0.68;
    const f = notesL[i];

    playSoftMarimbaNote(engine, f, t, 0.35, 0.055, pan);
    playHarmonicBell(engine, f * 1.5, t + 0.035, 0.55, 0.045 + progress * 0.03, -pan);
  }

  // Kademeli Sismik Kalp Atışı (5 Darbe)
  [0.0, 0.72, 1.35, 1.90, 2.38, 2.74].forEach((t, idx) => {
    playSubImpact(engine, now + t, 115 + idx * 12, 38, 0.62, 0.20 + idx * 0.032, (idx % 2 === 0 ? -1 : 1) * 0.35);
  });

  // Alttan yükselen Göksel Koro Önsezi Katmanı
  playEtherealChoir(engine, 293.66, now + 0.8, 1.4, 2.2, 0.045, -0.45);
  playEtherealChoir(engine, 440.0, now + 1.1, 1.2, 1.9, 0.045, 0.45);

  playHarmonicRiser(
    engine,
    now,
    2.98,
    [
      { startFreq: 73.42, endFreq: 196.0, type: 'sawtooth', panStart: -0.75, panEnd: 0.75 },
      { startFreq: 110.0, endFreq: 293.66, type: 'sawtooth', panStart: 0.75, panEnd: -0.75 },
      { startFreq: 146.83, endFreq: 587.33, type: 'triangle', panStart: -0.4, panEnd: 0.4 },
      { startFreq: 293.66, endFreq: 1174.66, type: 'sine', panStart: 0.4, panEnd: -0.4 },
    ],
    0.17,
    3800
  );

  // FAZ 1 (3.00s): Kraliyet G Major 9 Patlaması (Koro + Brass + Sub + Kristal Çanlar)
  const drop = now + 3.0;
  playSubImpact(engine, drop, 175, 32, 2.2, 0.44);

  // 1. Katman: Hans Zimmer Brass Section
  const legBrass = [98.0, 146.83, 196.0, 246.94, 293.66, 392.0, 493.88]; // G2 D3 G3 B3 D4 G4 B4
  legBrass.forEach((f, idx) => {
    const pan = ((idx % 2 === 0 ? -1 : 1) * (idx + 1)) / 8;
    playCinematicBrass(engine, f, drop, 0.05, 2.8, 0.068, pan);
  });

  // 2. Katman: Göksel Koro ("Ahhh" Formant Chord)
  const choirVoices = [293.66, 369.99, 493.88, 587.33, 783.99]; // D4 F#4 B4 D5 G5
  choirVoices.forEach((f, idx) => {
    playEtherealChoir(engine, f, drop + 0.04, 0.35, 3.6, 0.056, (idx - 2) * 0.35);
  });

  // 3. Katman: Kraliyet Taç Melodisi
  const crownFanfare = [
    { freq: 783.99, delay: 0.0, dur: 1.5, vol: 0.13, pan: -0.6 },   // G5
    { freq: 987.77, delay: 0.09, dur: 1.5, vol: 0.13, pan: 0.6 },   // B5
    { freq: 1174.66, delay: 0.18, dur: 1.6, vol: 0.135, pan: -0.4 },// D6
    { freq: 1479.98, delay: 0.28, dur: 1.8, vol: 0.14, pan: 0.4 },  // F#6
    { freq: 1567.98, delay: 0.40, dur: 2.1, vol: 0.15, pan: -0.2 }, // G6
    { freq: 1975.53, delay: 0.54, dur: 2.8, vol: 0.16, pan: 0.0 },  // B6
  ];
  crownFanfare.forEach((n) => {
    playHarmonicBell(engine, n.freq, drop + n.delay, n.dur, n.vol, n.pan);
  });

  // FAZ 2 (5.00s): Efsanevi Arma Mühürlenmesi (D Major -> G Major 9 İkinci Zirve!)
  const seal = now + 5.0;
  playSubImpact(engine, seal, 160, 35, 1.7, 0.36);

  [196.0, 293.66, 392.0, 493.88, 587.33].forEach((f, idx) => {
    playCinematicBrass(engine, f, seal, 0.04, 2.3, 0.06, (idx - 2) * 0.3);
    playEtherealChoir(engine, f * 2, seal + 0.03, 0.25, 2.6, 0.045, (2 - idx) * 0.3);
  });

  // Kristal Şelale Arpeji (5.0s -> 5.6s)
  [1174.66, 1479.98, 1567.98, 1975.53, 2349.32, 3135.96].forEach((f, idx) => {
    playHarmonicBell(engine, f, seal + idx * 0.08, 2.3, 0.115, ((idx % 2 === 0 ? -1 : 1) * (idx + 1)) / 7);
  });
}

/**
 * TIER 5: MYTHIC (Sadece 2 Görev!) — "Kozmik Tekillik, 40ms Vakum Sessizliği & İlahi Senfoni"
 * Ton: Eb Lydian Augmented -> Bb Major -> C# Major -> D Major 13 (#11) Kozmik Çözülüş!
 * Özel Efekt: 2.92s - 3.00s arasında tüm sesler vakumlanarak kesilir (IMAX Silence Drop)
 * ve tam 3.00s'de (Phase 1) devasa senfoni + 5.00s'de (Phase 2) İlahi Arma Kıyameti patlar!
 */
function playMythicQuestSymphony(engine: AudioEngine, now: number) {
  // FAZ 0 (0.00s - 2.92s): Çift Sarmal Kuantum Hızlandırıcı (20 Adım) + Sismik Braaam!
  // 1. Açılış Kozmik "BRAAAM" Darbesi (t = 0.0s)
  playSubImpact(engine, now, 140, 28, 1.4, 0.36);
  playCinematicBrass(engine, 65.41, now + 0.02, 0.15, 1.6, 0.085, -0.5);
  playCinematicBrass(engine, 98.0, now + 0.02, 0.15, 1.6, 0.085, 0.5);

  // 2. Birbirine Dolanan 20 Adımlı Kuantum Çift Sarmal (Sol ve Sağ Kulaklık Ters Fazda Döner)
  const helixA = [
    261.63, 293.66, 329.63, 369.99, 392.0, 440.0, 493.88, 554.37, 587.33, 659.25,
    739.99, 783.99, 880.0, 987.77, 1108.73, 1174.66, 1318.51, 1479.98, 1760.0, 2093.0,
  ];
  const helixB = [...helixA].reverse();

  for (let i = 0; i < 20; i++) {
    const p = i / 20;
    // 0.06s'den başlayıp 2.86s'de zirveye ulaşan logaritmik hızlanma
    const t = now + 0.06 + (p * 0.65 + Math.pow(p, 2.2) * 0.35) * 2.76;
    const angle = p * Math.PI * 6; // 3 tam 360° stereo dönüş
    const pan = Math.sin(angle) * 0.85;

    // Sarmal A: Yükselen Kristal Çanlar
    playHarmonicBell(engine, helixA[i], t, 0.42, 0.05 + p * 0.055, pan);
    // Sarmal B: Ters yönde akan Marimba & Telemetri Parçacıkları
    playSoftMarimbaNote(engine, helixB[i] * 0.5, t + 0.02, 0.28, 0.045 + p * 0.03, -pan);
    if (i % 2 === 0) {
      playTelemetryPulse(engine, helixA[i] * 1.5, t + 0.01, 0.09, 0.035, pan * 0.7);
    }
  }

  // 3. Sismik Kalp Atışı Hızlanması (7 Darbe)
  [0.45, 1.05, 1.55, 1.95, 2.28, 2.54, 2.74].forEach((t, idx) => {
    playSubImpact(
      engine,
      now + t,
      110 + idx * 14,
      34,
      0.48,
      0.22 + idx * 0.025,
      Math.sin(idx * 1.7) * 0.5
    );
  });

  // 4. Kozmik Koro & 5 Sesli Mega Riser (2.92s'de bıçak gibi kesilir -> 80ms Vakum Sessizliği!)
  playEtherealChoir(engine, 293.66, now + 0.4, 1.8, 2.48, 0.055, -0.6);
  playEtherealChoir(engine, 440.0, now + 0.6, 1.6, 2.28, 0.055, 0.6);
  playEtherealChoir(engine, 587.33, now + 0.9, 1.4, 1.98, 0.055, 0.0);

  playHarmonicRiser(
    engine,
    now,
    2.89, // 2.89 + 0.03 = 2.92s'de tam sessizlik (Vakum etkisi)
    [
      { startFreq: 55.0, endFreq: 146.83, type: 'sawtooth', panStart: -0.9, panEnd: 0.9 },
      { startFreq: 110.0, endFreq: 293.66, type: 'sawtooth', panStart: 0.9, panEnd: -0.9 },
      { startFreq: 146.83, endFreq: 587.33, type: 'sawtooth', panStart: -0.5, panEnd: 0.5 },
      { startFreq: 220.0, endFreq: 880.0, type: 'triangle', panStart: 0.5, panEnd: -0.5 },
      { startFreq: 293.66, endFreq: 1760.0, type: 'sine', panStart: 0.0, panEnd: 0.0 },
    ],
    0.20,
    4600
  );

  // =========================================================================
  // FAZ 1 (3.00s): VAKUM SONRASI KOZMİK SUPERNOVA PATLAMASI (D Major 13 #11)
  // =========================================================================
  const drop = now + 3.0;

  // Çift Kademeli Sismik Sub-Drop (32Hz Sinema Koltuğu Titreşimi)
  playSubImpact(engine, drop, 195, 29, 2.6, 0.48, 0.0);
  playSubImpact(engine, drop + 0.08, 120, 36.71, 2.2, 0.32, 0.0);

  // 8 Sesli Devasa Orkestral Brass Duvarı (D1'den G#4'e Lydian Harmoni)
  const mythicBrass = [73.42, 110.0, 146.83, 220.0, 293.66, 369.99, 440.0, 554.37];
  mythicBrass.forEach((f, idx) => {
    const pan = ((idx % 2 === 0 ? -1 : 1) * (idx + 1)) / 9;
    playCinematicBrass(engine, f, drop, 0.04, 3.4, 0.068, pan);
  });

  // 6 Sesli İlahi Koro Katmanı (D4, F#4, A4, C#5, E5, G#5 - Lydian Maj9#11)
  const mythicChoir = [293.66, 369.99, 440.0, 554.37, 659.25, 830.61];
  mythicChoir.forEach((f, idx) => {
    const pan = (idx - 2.5) * 0.34;
    playEtherealChoir(engine, f, drop + 0.02, 0.25, 4.2, 0.058, pan);
    playWarmPadNote(engine, f * 0.5, drop, 0.03, 4.0, 0.05, -pan);
  });

  // Mitik Zafer Melodisi (Polifonik Çift Oktav Kristal Çanlar + Marimba Gövdesi)
  const mythicMelody = [
    { freq: 880.0, delay: 0.0, dur: 1.8, vol: 0.135, pan: -0.7 },    // A5
    { freq: 1108.73, delay: 0.08, dur: 1.8, vol: 0.135, pan: 0.7 },  // C#6
    { freq: 1174.66, delay: 0.16, dur: 1.9, vol: 0.14, pan: -0.45 }, // D6
    { freq: 1318.51, delay: 0.25, dur: 2.0, vol: 0.145, pan: 0.45 }, // E6
    { freq: 1479.98, delay: 0.35, dur: 2.2, vol: 0.15, pan: -0.25 }, // F#6
    { freq: 1661.22, delay: 0.46, dur: 2.4, vol: 0.155, pan: 0.25 }, // G#6 (Lydian Sihri!)
    { freq: 1760.0, delay: 0.58, dur: 2.8, vol: 0.16, pan: -0.1 },   // A6
    { freq: 2349.32, delay: 0.72, dur: 3.4, vol: 0.17, pan: 0.0 },   // D7 (Zirve!)
  ];
  mythicMelody.forEach((n) => {
    playHarmonicBell(engine, n.freq, drop + n.delay, n.dur, n.vol, n.pan);
    playSoftMarimbaNote(engine, n.freq * 0.5, drop + n.delay, 0.65, n.vol * 0.55, -n.pan);
  });

  // =========================================================================
  // FAZ 2 (5.00s): MİTİK ARMA MÜHÜRLENMESİ & İLAHİ FİNAL AKORU (5.0s -> 9.2s)
  // =========================================================================
  const seal = now + 5.0;

  // Arma yerine kilitlendiği an sismik taç darbesi
  playSubImpact(engine, seal, 180, 30, 2.3, 0.44, 0.0);

  // Tam Orkestra + Koro İkinci Büyüme (Swell)
  const finalChord = [73.42, 146.83, 220.0, 293.66, 369.99, 440.0, 587.33, 739.99, 880.0];
  finalChord.forEach((f, idx) => {
    const pan = ((idx % 2 === 0 ? -1 : 1) * (idx + 1)) / 10;
    playCinematicBrass(engine, f, seal, 0.05, 3.5, 0.062, pan);
    if (idx >= 3) {
      playEtherealChoir(engine, f, seal + 0.02, 0.3, 3.9, 0.054, -pan);
    }
  });

  // Yıldız Tozu Kristal Şelalesi (360° Panoramik Parıltı Yağmuru: 5.05s -> 6.10s)
  const stardust = [
    1174.66, 1318.51, 1479.98, 1661.22, 1760.0, 2217.46, 2349.32, 2637.02, 2959.96, 3520.0,
  ];
  stardust.forEach((f, idx) => {
    const delay = idx * 0.095;
    const pan = Math.sin(idx * 1.2) * 0.8;
    const isFinal = idx === stardust.length - 1;
    playHarmonicBell(
      engine,
      f,
      seal + delay,
      isFinal ? 3.5 : 2.1,
      isFinal ? 0.14 : 0.105,
      pan
    );
  });
}

/**
 * Görev Tamamlanma Müziği Ana Yönlendirici:
 * Görevin nadirlik (rarity) değerine göre 5 farklı besteden birini çalıştırır.
 * Parametre verilmezse geriye dönük uyumluluk için 'Common' bestesi çalar.
 */
export function playQuestCompleteSound(rarity?: string) {
  if (!isSoundEnabled()) return;
  const engine = getAudioEngine();
  if (!engine) return;

  const now = engine.ctx.currentTime;
  const tier = normalizeQuestTier(rarity);

  switch (tier) {
    case 'Common':
      playCommonQuestSymphony(engine, now);
      break;
    case 'Rare':
      playRareQuestSymphony(engine, now);
      break;
    case 'Epic':
      playEpicQuestSymphony(engine, now);
      break;
    case 'Legendary':
      playLegendaryQuestSymphony(engine, now);
      break;
    case 'Mythic':
      playMythicQuestSymphony(engine, now);
      break;
  }
}

/* ============================================================================
   5. PREMIUM MİKRO-ETKİLEŞİM VE SİNEMATİK MODÜL SESLERİ
   (Animasyon süreleriyle milimetrik senkron — Süreler Birebir Korundu)
   ============================================================================ */

/**
 * 5c. NE İZLESEM — Sinematik Projektör & Celesta Seçim Çarkı (22 Adım Senkron)
 * PickModal'ın 22 adımlık easing formülüyle milimetrik senkron çalışır.
 */
export function playPickSpinSound() {
  if (!isSoundEnabled()) return;
  const engine = getAudioEngine();
  if (!engine) return;

  const now = engine.ctx.currentTime;

  const steps = 22;
  const delays: number[] = [];
  let acc = 0;
  for (let i = 0; i < steps; i++) {
    acc += 45 + Math.floor(Math.pow(i / steps, 2.6) * 240);
    delays.push(acc / 1000);
  }
  const spinDur = delays[delays.length - 1];

  // Altta nefes alan sıcak sinematik pad (F3, C4, E4, A4)
  [174.61, 261.63, 329.63, 440.0].forEach((f, idx) => {
    playWarmPadNote(engine, f, now, 0.45, spinDur + 0.5, 0.028, (idx - 1.5) * 0.28);
  });

  // Sinematik Lydian/Maj9 tırmanışı
  const scaleFreqs = [
    349.23, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 987.77, 1046.5, 1174.66,
  ];

  delays.forEach((t, i) => {
    const isLast = i === steps - 1;
    const ct = now + t;
    const progress = i / (steps - 1);
    const freq = scaleFreqs[i % scaleFreqs.length] * (i >= 14 ? 1.25 : 1.0);
    const pan = Math.sin(i * 0.85) * 0.45;
    const vol = 0.038 + progress * 0.045;

    playSoftMarimbaNote(engine, freq, ct, isLast ? 0.95 : 0.22, vol, pan);

    if (isLast) {
      playHarmonicBell(engine, 1318.51, ct + 0.05, 1.4, 0.09, 0.0);
    }
  });
}

/**
 * 5d. NE İZLESEM — KAZANAN FİLM AÇIKLAMASI (Sıcak Sinema Spot Işığı & Zafer Akoru)
 */
export function playPickRevealSound() {
  if (!isSoundEnabled()) return;
  const engine = getAudioEngine();
  if (!engine) return;

  const now = engine.ctx.currentTime;

  playSubImpact(engine, now, 115, 48, 0.75, 0.24);
  const chord = [130.81, 196.0, 246.94, 293.66, 329.63]; // C3 G3 B3 D4 E4
  chord.forEach((f, i) => {
    playWarmPadNote(engine, f, now, 0.035, 1.5, 0.052, (i - 2) * 0.25);
  });

  playHarmonicBell(engine, 783.99, now + 0.02, 1.1, 0.1, -0.35);
  playHarmonicBell(engine, 987.77, now + 0.09, 1.2, 0.11, 0.0);
  playHarmonicBell(engine, 1318.51, now + 0.17, 1.5, 0.13, 0.35);
  playHarmonicBell(engine, 1567.98, now + 0.27, 1.8, 0.1, 0.0);
}

/**
 * 5e. KÖR KALİBRASYON DÜELLOSU — Seçim & Çarpışma Sesi (Tok Taiko Darbesi + Mühür Çanı)
 */
export function playDuelSelectSound() {
  if (!isSoundEnabled()) return;
  const engine = getAudioEngine();
  if (!engine) return;

  const now = engine.ctx.currentTime;

  playSubImpact(engine, now, 145, 42, 0.65, 0.32);

  playWarmPadNote(engine, 146.83, now + 0.01, 0.025, 1.1, 0.065, -0.3);
  playWarmPadNote(engine, 220.0, now + 0.01, 0.025, 1.1, 0.065, 0.3);
  playWarmPadNote(engine, 369.99, now + 0.02, 0.035, 1.25, 0.05, 0.0);

  playSoftMarimbaNote(engine, 440.0, now, 0.35, 0.09, -0.2);
  playHarmonicBell(engine, 880.0, now + 0.04, 0.9, 0.11, -0.3);
  playHarmonicBell(engine, 1174.66, now + 0.13, 1.25, 0.12, 0.3);
}

/**
 * 5f. DNA SENTEZİ — Biyo-Genetik Çift Sarmal & Kuantum Füzyon Müziği (~5.5sn)
 */
export function playDnaSynthSound() {
  if (!isSoundEnabled()) return;
  const engine = getAudioEngine();
  if (!engine) return;

  const now = engine.ctx.currentTime;

  // 1. Biyo-Laboratuvar Atmosfer Yatağı
  const bioBed = [73.42, 110.0, 146.83, 174.61, 220.0, 261.63, 329.63];
  bioBed.forEach((f, i) => {
    const pan = ((i % 2 === 0 ? -1 : 1) * (i + 1)) / 8;
    playWarmPadNote(engine, f, now + 0.1, 0.65, 4.4, 0.04, pan);
  });

  // 2. Çift Sarmal (Double Helix) İnteraktif Arpej
  const strandA = [293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
  const strandB = [440.0, 392.0, 329.63, 293.66, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];

  for (let i = 0; i < 10; i++) {
    const tA = now + i * 0.28;
    const tB = now + i * 0.28 + 0.14;
    const phasePan = Math.sin((i / 10) * Math.PI * 2) * 0.55;

    playSoftMarimbaNote(engine, strandA[i], tA, 0.65, 0.06, phasePan);
    playHarmonicBell(engine, strandB[i] * 1.5, tB, 0.7, 0.048, -phasePan);
  }

  // 3. Biyo-Nabız
  [0.0, 0.85, 1.7, 2.45].forEach((t, idx) => {
    playSubImpact(engine, now + t, 96 + idx * 8, 46, 0.55, 0.16);
  });

  // 4. GENETİK FÜZYON TAMAMLANDI (t = 3.15s — Süre birebir korundu)
  const fusionTime = now + 3.15;
  playSubImpact(engine, fusionTime, 146.83, 36.71, 1.6, 0.34);

  const fusionChord = [146.83, 220.0, 293.66, 369.99, 440.0, 554.37, 659.25]; // D Maj9
  fusionChord.forEach((f, i) => {
    playWarmPadNote(engine, f, fusionTime, 0.04, 2.6, 0.06, (i - 3) * 0.22);
  });

  const fusionChimes = [
    { freq: 880.0, delay: 0.0, pan: -0.4, vol: 0.11 },    // A5
    { freq: 1108.73, delay: 0.09, pan: 0.4, vol: 0.11 },  // C#6
    { freq: 1318.51, delay: 0.18, pan: -0.2, vol: 0.12 }, // E6
    { freq: 1479.98, delay: 0.28, pan: 0.2, vol: 0.12 },  // F#6
    { freq: 1760.0, delay: 0.40, pan: 0.0, vol: 0.14 },   // A6
  ];

  fusionChimes.forEach((c) => {
    playHarmonicBell(engine, c.freq, fusionTime + c.delay, 2.2, c.vol, c.pan);
  });
}

/** Buton ses grupları — data-snd attribute'u ile eşleşir. */
export type UiClickGroup = 'primary' | 'secondary' | 'nav' | 'rating';

const UI_CLICK_PRESETS: Record<
  UiClickGroup,
  { f1: number; f2: number; dur: number; vol: number; pan1: number; pan2: number; delay2: number }
> = {
  primary:   { f1: 220, f2: 440, dur: 0.13, vol: 0.075, pan1: -0.15, pan2: 0.18,  delay2: 0.008 },
  secondary: { f1: 523.25, f2: 783.99, dur: 0.075, vol: 0.045, pan1: 0.18, pan2: -0.18, delay2: 0.005 },
  nav:       { f1: 329.63, f2: 493.88, dur: 0.095, vol: 0.05, pan1: -0.12, pan2: 0.12, delay2: 0.006 },
  rating:    { f1: 587.33, f2: 880.0, dur: 0.11, vol: 0.055, pan1: -0.22, pan2: 0.22, delay2: 0.012 },
};

export function playUiClickSound(group: UiClickGroup) {
  if (!isSoundEnabled()) return;
  const engine = getAudioEngine();
  if (!engine) return;

  const { ctx, dry, wet } = engine;
  const now = ctx.currentTime;
  const p = UI_CLICK_PRESETS[group];

  const voice = (freq: number, pan: number, vol: number, delay: number, dur: number) => {
    const t = now + delay;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 2.8, t);
    filter.frequency.exponentialRampToValueAtTime(freq * 0.9, t + dur);

    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const out = panner || ctx.createGain();
    if (panner) panner.pan.setValueAtTime(pan, t);

    filter.connect(out);
    out.connect(dry);
    if (group === 'rating' || group === 'primary') {
      out.connect(wet);
    }

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.06, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.92, t + dur);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(vol, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(env);
    env.connect(filter);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  voice(p.f1, p.pan1, p.vol, 0, p.dur);
  voice(p.f2, p.pan2, p.vol * 0.5, p.delay2, p.dur * 0.75);
}

/**
 * 5b. PUANLAMA RİTÜELİ — Sıcak Lydian Kristal Arp Akoru (E5 -> G5 -> B5 -> E6)
 */
export function playRatingArpSound() {
  if (!isSoundEnabled()) return;
  const engine = getAudioEngine();
  if (!engine) return;

  const now = engine.ctx.currentTime;
  const notes = [
    { freq: 659.25, delay: 0.0, pan: -0.35, dur: 0.75, vol: 0.075 }, // E5
    { freq: 783.99, delay: 0.065, pan: -0.1, dur: 0.85, vol: 0.085 }, // G5
    { freq: 987.77, delay: 0.13, pan: 0.15, dur: 0.95, vol: 0.095 }, // B5
    { freq: 1318.51, delay: 0.20, pan: 0.35, dur: 1.3, vol: 0.11 },  // E6 (Zirve)
  ];

  notes.forEach((n) => {
    playHarmonicBell(engine, n.freq, now + n.delay, n.dur, n.vol, n.pan);
  });
}