import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  playAchievementSound,
  playLevelUpSound,
  playLessonDoneSound,
  playQuestCompleteSound,
} from '../lib/sound';

// ============================================================================
// SES MOTORU (SOUND) — Web Audio API davranış testleri (sahte AudioContext)
// ============================================================================

const created = {
  oscillators: [] as any[],
  gains: [] as any[],
};

class FakeAudioContext {
  currentTime = 10; // saniye — deterministik zaman tabanı
  destination = { name: 'fake-destination' };

  createOscillator() {
    const osc = {
      type: '',
      frequency: {
        value: 0,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    created.oscillators.push(osc);
    return osc;
  }

  createGain() {
    const gain = {
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    created.gains.push(gain);
    return gain;
  }
}

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
  });

  test('playAchievementSound: 4 notalı (C5-E5-G5-C6) sine dalgası üretmeli', () => {
    playAchievementSound();

    expect(created.oscillators).toHaveLength(4);
    expect(created.gains).toHaveLength(4);

    const freqs = created.oscillators.map((o) => o.frequency.value);
    expect(freqs).toEqual([523.25, 659.25, 783.99, 1046.5]);
    created.oscillators.forEach((o) => expect(o.type).toBe('sine'));

    // Notalar 0.1sn arayla başlamalı (currentTime = 10)
    const startTimes = created.oscillators.map((o) => o.start.mock.calls[0][0]);
    expect(startTimes.map((t) => Number(t.toFixed(2)))).toEqual([10, 10.1, 10.2, 10.3]);

    // Her nota 0.3sn sonra durmalı
    const stopTimes = created.oscillators.map((o) => o.stop.mock.calls[0][0]);
    expect(stopTimes.map((t) => Number(t.toFixed(2)))).toEqual([10.3, 10.4, 10.5, 10.6]);

    // Her gain hafiflik eğrisi (0 → 0.15 → sönüm) çizmeli
    created.gains.forEach((g) => {
      expect(g.gain.setValueAtTime).toHaveBeenCalled();
      expect(g.gain.linearRampToValueAtTime).toHaveBeenCalled();
      expect(g.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    });
  });

  test('playLevelUpSound: 5 notalı (G4’ten C6’ya) triangle dalgası yükselişi üretmeli', () => {
    playLevelUpSound();

    expect(created.oscillators).toHaveLength(5);
    const freqs = created.oscillators.map((o) => o.frequency.value);
    expect(freqs).toEqual([392, 523.25, 659.25, 783.99, 1046.5]);
    created.oscillators.forEach((o) => expect(o.type).toBe('triangle'));

    const startTimes = created.oscillators.map((o) => o.start.mock.calls[0][0]);
    expect(startTimes.map((t) => Number(t.toFixed(2)))).toEqual([10, 10.08, 10.16, 10.24, 10.32]);
  });

  test('playLessonDoneSound: 4 nota × (temel + üst harmonik) = 8 osilatör üretmeli', () => {
    playLessonDoneSound();

    expect(created.oscillators).toHaveLength(8);
    expect(created.gains).toHaveLength(8);

    // Notalar sırayla: E5, G#5, B5, E6 → her biri sine (temel) + triangle (harmonik)
    const baseOscs = created.oscillators.filter((_, i) => i % 2 === 0);
    const harmOscs = created.oscillators.filter((_, i) => i % 2 === 1);

    expect(baseOscs.map((o) => o.frequency.value)).toEqual([659.25, 830.61, 987.77, 1318.51]);
    baseOscs.forEach((o) => expect(o.type).toBe('sine'));

    // Üst harmonik = temel tonun 2 katı
    harmOscs.forEach((o, i) => {
      expect(o.type).toBe('triangle');
      expect(o.frequency.value).toBeCloseTo(baseOscs[i].frequency.value * 2, 5);
    });
  });

  test('playQuestCompleteSound: bas + sweep + 5 akor + 4 zafer çınlaması = 11 osilatör', () => {
    playQuestCompleteSound();

    expect(created.oscillators).toHaveLength(11);

    const sawtooth = created.oscillators.filter((o) => o.type === 'sawtooth');
    const triangles = created.oscillators.filter((o) => o.type === 'triangle');
    const sines = created.oscillators.filter((o) => o.type === 'sine');

    expect(sawtooth).toHaveLength(1); // Derin bas
    expect(sawtooth[0].frequency.value).toBeCloseTo(65.41, 2); // C2
    expect(triangles).toHaveLength(5); // C Majör akoru
    expect(sines).toHaveLength(5); // Sweep + 4 çınlama

    // Yükselen sweep: A3 → A5
    const sweep = created.oscillators[1];
    expect(sweep.frequency.setValueAtTime).toHaveBeenCalledWith(220, 10);
    expect(sweep.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(880, 13);

    // Patlama 3. saniyede (now + 3) vurmalı
    triangles.forEach((o) => {
      expect(o.start.mock.calls[0][0]).toBeCloseTo(13, 5);
    });
  });

  test('osilatör → gain → destination zinciri kurulmalı (ses gerçekten çıkışa bağlanmalı)', () => {
    playAchievementSound();

    created.oscillators.forEach((o, i) => {
      // Osilatör kendi gain'ine bağlanmalı
      expect(o.connect).toHaveBeenCalledTimes(1);
      expect(o.connect).toHaveBeenCalledWith(created.gains[i]);
    });

    created.gains.forEach((g) => {
      // Gain, ortak destination (hoparlör) objesine bağlanmalı
      expect(g.connect).toHaveBeenCalledTimes(1);
      const target = g.connect.mock.calls[0][0];
      expect(target).toEqual({ name: 'fake-destination' });
    });
  });
});
