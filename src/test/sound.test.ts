import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  playAchievementSound,
  playLevelUpSound,
  playLessonDoneSound,
  playQuestCompleteSound,
  playUiClickSound,
  playRatingArpSound,
} from '../lib/sound';

// ============================================================================
// SES MOTORU (SOUND) — Web Audio API davranış testleri (sahte AudioContext)
// Sinematik motor: BiquadFilter + StereoPan + Reverb(Convolver) + Compressor
// kullanır; mock bu API'lerin tamamını destekler.
// ============================================================================

const created = {
  oscillators: [] as any[],
  gains: [] as any[],
  compressors: [] as any[],
};

/** setValueAtTime çağıran her parametreye `value` yansır (frekans okumak için). */
function makeParam(initial = 0) {
  const p: any = {
    value: initial,
    setValueAtTime: vi.fn((v: number) => {
      p.value = v;
      return p;
    }),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  return p;
}

class FakeAudioContext {
  currentTime = 10; // saniye — deterministik zaman tabanı
  sampleRate = 48000;
  state = 'running';
  destination = { name: 'fake-destination' };
  resume = vi.fn(() => Promise.resolve());

  createOscillator() {
    const osc = {
      type: '',
      frequency: makeParam(),
      detune: makeParam(),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    created.oscillators.push(osc);
    return osc;
  }

  createGain() {
    const gain = {
      gain: makeParam(),
      connect: vi.fn(),
    };
    created.gains.push(gain);
    return gain;
  }

  createBiquadFilter() {
    return { type: '', Q: makeParam(), frequency: makeParam(), connect: vi.fn() };
  }

  createStereoPanner() {
    return { pan: makeParam(), connect: vi.fn() };
  }

  /** Analog sıcaklık katmanı (WaveShaper) — engine init'i mock'ta da kurabilsin. */
  createWaveShaper() {
    return {
      curve: null as Float32Array | null,
      oversample: 'none',
      connect: vi.fn(),
    };
  }

  createDynamicsCompressor() {
    const c = {
      threshold: makeParam(),
      knee: makeParam(),
      ratio: makeParam(),
      attack: makeParam(),
      release: makeParam(),
      connect: vi.fn(),
    };
    created.compressors.push(c);
    return c;
  }

  createConvolver() {
    return { buffer: null as AudioBuffer | null, connect: vi.fn() };
  }

  createBuffer(_channels: number, length: number, _sampleRate: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
}

const freqsOf = (type: string) =>
  created.oscillators.filter((o) => o.type === type).map((o) => o.frequency.value);
const startsOf = (o: any) => o.start.mock.calls[0][0] as number;
const stopsOf = (o: any) => o.stop.mock.calls[0][0] as number;

describe('Penceresiz (Node/SSR) ortamda ses çalmayı DENEmemeli ama çökmemeli', () => {
  test('window yokken 4 ses fonksiyonu da hata fırlatmadan sessizce geri dönmeli', () => {
    delete (globalThis as any).window;
    expect(typeof window).toBe('undefined'); // kodun guart (guard) dalı çalışıyor

    expect(() => {
      playAchievementSound();
      playLevelUpSound();
      playLessonDoneSound();
      playQuestCompleteSound();
    }).not.toThrow();
  });
});

describe('SAHTE AudioContext ile ses üretimi', () => {
  beforeAll(() => {
    (globalThis as any).window = { AudioContext: FakeAudioContext };
  });

  afterAll(() => {
    delete (globalThis as any).window;
  });

  beforeEach(() => {
    created.oscillators.length = 0;
    created.gains.length = 0;
    // compressors sıfırlanmAZ: AudioContext/Compressor engine'de tek seferlik
    // yaratılır (singleton) — zincir testi ilk yaratımdaki kaydı okur.
  });

  test('playAchievementSound: 2 sub + 4 pad + 5 çan × 3 katman = 25 osilatör, kuyruk 4s toast süresi içinde', () => {
    playAchievementSound();

    // 2 sub (stereo çift) + 4 pad × 2 (saw+tri) + 5 bell × 3 (gövde+harmonik+parıltı) = 25
    expect(created.oscillators).toHaveLength(25);
    // 2 master bus gain (engine ilk açılışta) + 2 sub + 4 pad env + 5 bell × 3 env = 23
    expect(created.gains).toHaveLength(23);

    // Cmaj9 pad akoru (sawtooth gövdeleri)
    const saws = freqsOf('sawtooth');
    expect(saws).toEqual([130.81, 196.0, 246.94, 329.63]);

    // Kristal kupa arpeji (bell gövdeleri sine): G5 B5 D6 E6 G6
    // Üst oktav parıltısı (×3) ayrı sine — sadece tam gövde frekansları filtrelenir
    const bodyFreqs = [783.99, 987.77, 1174.66, 1318.51, 1567.98];
    const bellBodies = created.oscillators
      .filter((o) => o.type === 'sine' && bodyFreqs.includes(o.frequency.value))
      .map((o) => o.frequency.value);
    expect(bellBodies).toEqual(bodyFreqs);

    // Ses, 4000ms'lik başarım toast'ından UZUN sürmemeli (senkron)
    const lastStop = Math.max(...created.oscillators.map(stopsOf));
    expect(lastStop - 10).toBeLessThan(4);
  });

  test('playLevelUpSound: vuruş 0.68s (faz 3 arma inişi), son nota 1.45s (faz 5 plaka) — faz senkronu', () => {
    playLevelUpSound();

    // 5 sparkle çan (15) + 2 sub (stereo) + 7 fanfar pad (14) + 5 taç çanı (15) = 46
    expect(created.oscillators).toHaveLength(46);
    expect(created.gains).toHaveLength(39); // 2 sub + 7 pad env + 10 bell × 3 env

    // FAZ 3 (680ms): Unvan Arması iniş vuruşu
    const impact = created.oscillators.find((o) => o.type === 'sine' && o.frequency.value === 150);
    expect(impact).toBeTruthy();
    expect(startsOf(impact!)).toBeCloseTo(10.68, 5);

    // Fanfar akoru tam vuruş anında başlamalı
    const saws = created.oscillators.filter((o) => o.type === 'sawtooth');
    expect(saws).toHaveLength(7);
    expect(freqsOf('sawtooth')).toEqual([130.81, 196.0, 261.63, 329.63, 392.0, 493.88, 587.33]);
    saws.forEach((o) => expect(startsOf(o)).toBeCloseTo(10.68, 5));

    // FAZ 5 (1450ms): nihai zafer notası (G6) plakayla eşzamanlı
    const finalBell = created.oscillators.find(
      (o) => o.type === 'sine' && o.frequency.value === 1567.98
    );
    expect(finalBell).toBeTruthy();
    expect(startsOf(finalBell!)).toBeCloseTo(11.45, 5);
  });

  test('playLessonDoneSound: 4 nota × (gövde + harmonik + parıltı) = 12 osilatör üretmeli', () => {
    playLessonDoneSound();

    expect(created.oscillators).toHaveLength(12);
    expect(created.gains).toHaveLength(12); // 4 bell × 3 env

    // Gövde sine'leri (üst oktav parıltısı ×3 sine'lerinden tam frekansla ayrılır)
    const bodyFreqs = [698.46, 880.0, 1046.5, 1318.51];
    const baseOscs = created.oscillators.filter(
      (o) => o.type === 'sine' && bodyFreqs.includes(o.frequency.value)
    );
    const harmOscs = created.oscillators.filter((o) => o.type === 'triangle');

    expect(baseOscs.map((o) => o.frequency.value)).toEqual(bodyFreqs);

    // Üst harmonik = temel tonun 2 katı
    harmOscs.forEach((o, i) => {
      expect(o.frequency.value).toBeCloseTo(baseOscs[i].frequency.value * 2, 5);
    });

    // Notalar 0.07-0.08sn arayla başlamalı
    const startTimes = baseOscs.map(startsOf).map((t) => Number(t.toFixed(2)));
    expect(startTimes).toEqual([10, 10.07, 10.14, 10.22]);
  });

  test('playQuestCompleteSound (Common tier): 7 marimba + 2 riser + 2 sub + 6 pad × 2 + 6 bell × 3 = 48 osilatör, PATLAMA tam 3.0s\'te', () => {
    playQuestCompleteSound();

    expect(created.oscillators).toHaveLength(48);

    const saws = created.oscillators.filter((o) => o.type === 'sawtooth');
    const triangles = created.oscillators.filter((o) => o.type === 'triangle');
    const sines = created.oscillators.filter((o) => o.type === 'sine');
    expect(saws).toHaveLength(6);       // 6 pad saw gövdesi (Cmaj9)
    expect(triangles).toHaveLength(20); // 7 marimba harm + 1 riser + 6 pad + 6 bell harm
    expect(sines).toHaveLength(22);     // 7 marimba + 1 riser + 2 sub + 6 bell gövde + 6 bell parıltı

    // Yükselen riser: C3 → C4 (0 - 2.96s) — ilk nabız 0.18s'te başlar, riser 10.0s'te
    const riserSine = sines.find((o) => startsOf(o) === 10 && o.frequency.value === 130.81);
    expect(riserSine).toBeTruthy();
    expect(riserSine!.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      261.63,
      expect.closeTo(12.9, 2)
    );

    // Görsel senkron: QuestCelebrationOverlay faz 1 tam 3000ms'de → drop = now+3.0
    // (stereo sub çifti 115 Hz'den açılır)
    const dropSines = sines.filter((o) => o.frequency.value === 115);
    expect(dropSines).toHaveLength(2);
    dropSines.forEach((o) => expect(startsOf(o)).toBeCloseTo(13, 5));

    // Sıcak pad akoru da drop anında (13.0s) başlamalı
    const chordSaws = saws.filter((o) => startsOf(o) > 12);
    expect(chordSaws).toHaveLength(6);
    chordSaws.forEach((o) => expect(startsOf(o)).toBeCloseTo(13, 5));
  });

  test('osilatör → gain/node → destination zinciri kurulmalı (ses gerçekten çıkışa bağlanmalı)', () => {
    playAchievementSound();

    // Her osilatör bir env/gain/filter düğümüne bağlanmalı
    created.oscillators.forEach((o) => {
      expect(o.connect).toHaveBeenCalled();
    });

    // Her gain bir sonraki düğüme (panner/master) bağlanmalı
    created.gains.forEach((g) => {
      expect(g.connect).toHaveBeenCalled();
    });

    // Master compressor çıkışa (destination) bağlı olmalı
    expect(created.compressors.length).toBeGreaterThan(0);
    expect(created.compressors[0].connect).toHaveBeenCalledWith({ name: 'fake-destination' });
  });

  test('playUiClickSound: her grup farklı frekans/karakter — primary/secondary/nav/rating', () => {
    // primary: sıcak kadifemsi mallet (220 + 440 üst parlaklık)
    playUiClickSound('primary');
    expect(created.oscillators).toHaveLength(2);
    expect(created.oscillators.map((o) => o.frequency.value)).toEqual([220 * 1.06, 440 * 1.06]);

    // secondary: ince cam tick (523.25 + 783.99) — primary'den tamamen farklı
    playUiClickSound('secondary');
    const sec = created.oscillators.slice(2).map((o) => o.frequency.value);
    expect(sec).toEqual([523.25 * 1.06, 783.99 * 1.06]);

    // nav: yumuşak nefes (329.63 + 493.88)
    playUiClickSound('nav');
    const nav = created.oscillators.slice(4).map((o) => o.frequency.value);
    expect(nav).toEqual([329.63 * 1.06, 493.88 * 1.06]);

    // rating: cam pırıltı (587.33 + 880) — puanlama, diğer gruplardan farklı
    playUiClickSound('rating');
    const rating = created.oscillators.slice(6).map((o) => o.frequency.value);
    expect(rating).toEqual([587.33 * 1.06, 880 * 1.06]);

    // Mikro süre: hiçbir grup kutlama sesini ezmemeli (en uzun primary 150ms)
    const durations = created.oscillators.map((o) => stopsOf(o) - startsOf(o));
    expect(Math.max(...durations)).toBeLessThanOrEqual(0.18);
  });

  test('playRatingArpSound: yükselen E5→G5→B5→E6 Lydian arpeji, zirve notası en uzun', () => {
    playRatingArpSound();

    // 4 bell × 3 (gövde sine + harmonik triangle + üst oktav parıltısı) = 12 osilatör
    expect(created.oscillators).toHaveLength(12);

    // Gövde sine'leri (parıltı ×3 sine'lerinden tam frekansla ayrılır)
    const bodyFreqs = [659.25, 783.99, 987.77, 1318.51];
    const bodies = created.oscillators.filter(
      (o) => o.type === 'sine' && bodyFreqs.includes(o.frequency.value)
    );
    expect(bodies.map((o) => o.frequency.value)).toEqual(bodyFreqs);

    // 65ms arpej aralığı
    const starts = bodies.map(startsOf);
    expect(starts[1] - starts[0]).toBeCloseTo(0.065, 5);
    expect(starts[2] - starts[1]).toBeCloseTo(0.065, 5);
    expect(starts[3] - starts[2]).toBeCloseTo(0.07, 5);

    // Zirve notası (E6) en uzun sürelidir
    const bodyDurs = bodies.map((o) => stopsOf(o) - startsOf(o));
    expect(bodyDurs[3]).toBeGreaterThan(bodyDurs[2]);

    // Gövde + harmonikler, panner üzerinden dry+wet'e bağlı (stereo yayılım)
    created.oscillators.forEach((o) => expect(o.connect).toHaveBeenCalled());
  });
});
