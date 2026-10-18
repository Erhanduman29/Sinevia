import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  playAchievementSound,
  playLevelUpSound,
  playLessonDoneSound,
  playQuestCompleteSound,
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

  test('playAchievementSound: sub + 4 pad + 5 çan = 19 osilatör, kuyruk 4s toast süresi içinde', () => {
    playAchievementSound();

    // 1 sub + 4 pad × 2 (saw+tri) + 5 bell × 2 (sine+tri) = 19
    expect(created.oscillators).toHaveLength(19);
    // 2 master bus gain (engine ilk açılışta) + 1 sub + 4 pad env + 5 bell × 2 env = 17
    expect(created.gains).toHaveLength(17);

    // Cmaj9 pad akoru (sawtooth gövdeleri)
    const saws = freqsOf('sawtooth');
    expect(saws).toEqual([130.81, 196.0, 246.94, 329.63]);

    // Kristal kupa arpeji (bell gövdeleri sine): G5 B5 D6 E6 G6
    const bellBodies = created.oscillators
      .filter((o) => o.type === 'sine' && o.frequency.value >= 700)
      .map((o) => o.frequency.value);
    expect(bellBodies).toEqual([783.99, 987.77, 1174.66, 1318.51, 1567.98]);

    // Ses, 4000ms'lik başarım toast'ından UZUN sürmemeli (senkron)
    const lastStop = Math.max(...created.oscillators.map(stopsOf));
    expect(lastStop - 10).toBeLessThan(4);
  });

  test('playLevelUpSound: vuruş 0.68s (faz 3 arma inişi), son nota 1.45s (faz 5 plaka) — faz senkronu', () => {
    playLevelUpSound();

    // 5 sparkle çan (10) + 1 sub + 7 fanfar pad (14) + 5 taç çanı (10) = 35
    expect(created.oscillators).toHaveLength(35);
    expect(created.gains).toHaveLength(28); // 1 sub + 7 pad env + 10 sparkle env + 10 taç env

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

  test('playLessonDoneSound: 4 nota × (temel + üst harmonik) = 8 osilatör üretmeli', () => {
    playLessonDoneSound();

    expect(created.oscillators).toHaveLength(8);
    expect(created.gains).toHaveLength(8);

    const baseOscs = created.oscillators.filter((o) => o.type === 'sine');
    const harmOscs = created.oscillators.filter((o) => o.type === 'triangle');

    expect(baseOscs.map((o) => o.frequency.value)).toEqual([698.46, 880.0, 1046.5, 1318.51]);

    // Üst harmonik = temel tonun 2 katı
    harmOscs.forEach((o, i) => {
      expect(o.frequency.value).toBeCloseTo(baseOscs[i].frequency.value * 2, 5);
    });

    // Notalar 0.07-0.08sn arayla başlamalı
    const startTimes = baseOscs.map(startsOf).map((t) => Number(t.toFixed(2)));
    expect(startTimes).toEqual([10, 10.07, 10.14, 10.22]);
  });

  test('playQuestCompleteSound: 3 riser + sub + 9 akor + 5 çan = 32 osilatör, PATLAMA tam 3.0s\'te', () => {
    playQuestCompleteSound();

    // 3 riser + 1 sub-drop + 9 epic pad × 2 + 5 victory bell × 2 = 32
    expect(created.oscillators).toHaveLength(32);

    const saws = created.oscillators.filter((o) => o.type === 'sawtooth');
    const triangles = created.oscillators.filter((o) => o.type === 'triangle');
    const sines = created.oscillators.filter((o) => o.type === 'sine');
    expect(saws).toHaveLength(10);  // 1 riser + 9 akor gövdesi
    expect(triangles).toHaveLength(15); // 1 riser + 9 akor + 5 çan harmoniği
    expect(sines).toHaveLength(7);  // 1 riser + 1 sub + 5 çan gövdesi

    // Yükselen riser: C2 → C3 (0 - 3.0s)
    const riserSaw = saws.find((o) => startsOf(o) === 10);
    expect(riserSaw).toBeTruthy();
    expect(riserSaw!.frequency.value).toBeCloseTo(65.41, 2);
    expect(riserSaw!.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      130.81,
      expect.closeTo(12.98, 3)
    );

    // Görsel senkron: QuestCelebrationOverlay faz 1 tam 3000ms'de → drop = now+3.0
    const drop = created.oscillators.find((o) => o.type === 'sine' && o.frequency.value === 160);
    expect(drop).toBeTruthy();
    expect(startsOf(drop!)).toBeCloseTo(13, 5);

    // Orkestral akor da drop anında (13.0s) başlamalı
    const chordSaws = saws.filter((o) => startsOf(o) > 12);
    expect(chordSaws).toHaveLength(9);
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
});
