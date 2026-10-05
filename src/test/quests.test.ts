import { expect, test, describe } from 'vitest';
import { QUEST_DEFS } from '../lib/quests';
import { evaluateQuestCompletion } from '../lib/questLogic';

// --- YARDIMCI (HELPER) FONKSİYONLAR ---
// Görevleri test ederken kod tekrarını önlemek için hızlıca sahte (mock) veri üreten araçlar:
const acceptedAt = new Date('2026-10-04T12:00:00').getTime();

// Film ve dizi üreticilere varsayılan 'watchedAt' (15:00 - Görevden 3 saat sonra) eklendi
const mockH = (overrides: any = {}) => [{ itemId: 'm1', kind: 'movie', watchedAt: '2026-10-04T15:00:00', ...overrides }];
const mockM = (overrides: any = {}) => [{ id: 'm1', watched: true, watchedAt: '2026-10-04T15:00:00', ...overrides }];

const mockEp = (overrides: any = {}) => [{ itemId: 'e1', kind: 'series', watchedAt: '2026-10-04T15:00:00', ...overrides }];

const mockHMulti = (count: number, kind: 'movie' | 'series' = 'movie') => 
  Array.from({ length: count }, (_, i) => ({ itemId: `m${i}`, kind, watchedAt: '2026-10-04T15:00:00' }));
const mockMMulti = (count: number, overrides: any = {}) => 
  Array.from({ length: count }, (_, i) => ({ id: `m${i}`, watched: true, watchedAt: '2026-10-04T15:00:00', ...overrides }));

const checkQuest = (id: string, h: any[], m: any[], streak = 0) => evaluateQuestCompletion(id, acceptedAt, h, m, streak);

describe('🎯 GÖREV SİSTEMİ (QUEST ENGINE) %100 KAPSAMLI TEST', () => {

  // ==========================================
  // GÜVENLİK TESTLERİ
  // ==========================================
  describe('Zaman ve Geçmiş Güvenliği', () => {
    test('Görevi Kabul Etmeden ÖNCE izlenen filmler HİÇBİR GÖREVİ TAMAMLAYAMAZ', () => {
      // Görev öğlen 12'de alındı, film sabah 10'da izlenmiş
      const h = [{ itemId: 'm1', kind: 'movie', watchedAt: '2026-10-04T10:00:00' }];
      const m = [{ id: 'm1', watched: true, watchedAt: '2026-10-04T10:00:00', runtime: 80 }];
      expect(checkQuest('c_short_movie', h, m)).toBe(false); 
    });
  });

  // ==========================================
  // COMMON (YAYGIN) GÖREVLER (TÜMÜ)
  // ==========================================
  describe('⚪ Common (Yaygın) Görevler', () => {
    test('c_picky_taste: Filme tam 7.5 veya 8.5 verilmeli', () => {
      expect(checkQuest('c_picky_taste', mockH(), mockM({ rating: 7 }))).toBe(false);
      expect(checkQuest('c_picky_taste', mockH(), mockM({ rating: 7.5 }))).toBe(true);
    });

    test('c_short_movie: Süresi 90 dk altı olmalı', () => {
      expect(checkQuest('c_short_movie', mockH(), mockM({ runtime: 85 }))).toBe(true);
      expect(checkQuest('c_short_movie', mockH(), mockM({ runtime: 100 }))).toBe(false);
    });

    test('c_action_fan: Aksiyon türünde ve puan verilmiş olmalı', () => {
      expect(checkQuest('c_action_fan', mockH(), mockM({ genres: ['Aksiyon'], rating: 8 }))).toBe(true);
    });

    test('Tür Görevleri: Komedi, Dram, Bilim Kurgu, Belgesel, Animasyon', () => {
      expect(checkQuest('c_comedy_fan', mockH(), mockM({ genres: ['Komedi'] }))).toBe(true);
      expect(checkQuest('c_drama_fan', mockH(), mockM({ genres: ['Dram'] }))).toBe(true);
      expect(checkQuest('c_sci_fi_fan', mockH(), mockM({ genres: ['Bilim Kurgu'] }))).toBe(true);
      expect(checkQuest('c_documentary', mockH(), mockM({ genres: ['Belgesel'] }))).toBe(true);
      expect(checkQuest('c_animation', mockH(), mockM({ genres: ['Animasyon'] }))).toBe(true);
    });

    test('Puan Görevleri: Başyapıt (10), Çöp (<=3), Ortalama (5-6)', () => {
      expect(checkQuest('c_masterpiece', mockH(), mockM({ rating: 10 }))).toBe(true);
      expect(checkQuest('c_trash', mockH(), mockM({ rating: 2 }))).toBe(true);
      expect(checkQuest('c_mediocre', mockH(), mockM({ rating: 5.5 }))).toBe(true);
    });

    test('Detay ve Yazı: En az 3 etiket (Tag) ve 50 karakter not', () => {
      expect(checkQuest('c_detailer', mockH(), mockM({ reviewTags: ['1', '2', '3'] }))).toBe(true);
      expect(checkQuest('c_writer', mockH(), mockM({ note: 'A'.repeat(55) }))).toBe(true);
    });

    test('c_old_movie & c_new_movie: 2000 öncesi ve bu yıl', () => {
      expect(checkQuest('c_old_movie', mockH(), mockM({ year: '1995' }))).toBe(true);
      const currentYear = new Date().getFullYear().toString();
      expect(checkQuest('c_new_movie', mockH(), mockM({ year: currentYear }))).toBe(true);
    });

    test('Gün Görevleri: Hafta Sonu ve Pazartesi', () => {
      const hWeekend = [{ itemId: 'm1', kind: 'movie', watchedAt: '2026-10-04T15:00:00' }]; // Pazar
      const mWeekend = [{ id: 'm1', watched: true, watchedAt: '2026-10-04T15:00:00' }];
      
      const hWeekday = [{ itemId: 'm1', kind: 'movie', watchedAt: '2026-10-05T15:00:00' }]; // Pazartesi
      const mWeekday = [{ id: 'm1', watched: true, watchedAt: '2026-10-05T15:00:00' }];
      
      expect(checkQuest('c_weekend', hWeekend, mWeekend)).toBe(true);
      expect(checkQuest('c_weekday', hWeekday, mWeekday)).toBe(true);
    });

    test('Dizi Görevleri: Kısa bölüm, İlk bölüm, 2 Bölüm izleme', () => {
      expect(checkQuest('c_short_series', mockEp({ actualRuntime: 25 }), [])).toBe(true);
      expect(checkQuest('c_series_pilot', mockEp({ season: 1, episode: 1 }), [])).toBe(true);
      expect(checkQuest('c_series_double', mockHMulti(2, 'series'), [])).toBe(true);
    });
  });

  // ==========================================
  // RARE (NADİR) GÖREVLER (TÜMÜ)
  // ==========================================
  describe('🔵 Rare (Nadir) Görevler', () => {
    test('r_night_watch: Gece 01:00 - 05:00 arası izleme', () => {
      // GİZLİ HATA DÜZELTİLDİ: Görev 4 Ekim 12:00'de alındı, film 5 Ekim Gece 3'te izlenmeli.
      const hNight = [{ itemId: 'm1', kind: 'movie', watchedAt: '2026-10-05T03:00:00' }];
      const mNight = [{ id: 'm1', watched: true, watchedAt: '2026-10-05T03:00:00' }];
      expect(checkQuest('r_night_watch', hNight, mNight)).toBe(true);
    });

    test('r_two_hours: Tam 120-130 dk arası film', () => {
      expect(checkQuest('r_two_hours', mockH(), mockM({ runtime: 125 }))).toBe(true);
    });

    test('r_tarantino: Suç/Gerilim türü ve 8+ puan', () => {
      expect(checkQuest('r_tarantino', mockH(), mockM({ genres: ['Suç'], rating: 8.5 }))).toBe(true);
    });

    test('r_classic: 1970 - 1980 yılları arası kült', () => {
      expect(checkQuest('r_classic', mockH(), mockM({ year: '1975' }))).toBe(true);
    });

    test('r_mystery_solver: Gizem türü ve 100+ karakter not', () => {
      expect(checkQuest('r_mystery_solver', mockH(), mockM({ genres: ['Gizem'], note: 'A'.repeat(105) }))).toBe(true);
    });

    test('r_consistent: 3 Günlük Seri (Streak)', () => {
      expect(checkQuest('r_consistent', mockH(), mockM(), 3)).toBe(true); 
    });

    test('Çoklu İzleme: Varyete(2), Dizi Kurdu(3), Çifte Aksiyon/Korku(2)', () => {
      expect(checkQuest('r_variety', mockHMulti(2), mockMMulti(2))).toBe(true);
      expect(checkQuest('r_series_wolf', mockHMulti(3, 'series'), [])).toBe(true);
      expect(checkQuest('r_double_action', mockHMulti(2), mockMMulti(2, { genres: ['Aksiyon'] }))).toBe(true);
      expect(checkQuest('r_double_horror', mockHMulti(2), mockMMulti(2, { genres: ['Korku'] }))).toBe(true);
    });

    test('r_friday_joy: Cuma 20:00 sonrası', () => {
      const hFriday = [{ itemId: 'm1', kind: 'movie', watchedAt: '2026-10-09T21:00:00' }]; // 9 Ekim Cuma
      const mFriday = [{ id: 'm1', watched: true, watchedAt: '2026-10-09T21:00:00' }];
      expect(checkQuest('r_friday_joy', hFriday, mFriday)).toBe(true);
    });

    test('r_long_movie: 150 dk üzeri', () => {
      expect(checkQuest('r_long_movie', mockH(), mockM({ runtime: 160 }))).toBe(true);
    });

    test('r_perfect_pair & r_indecisive & r_second_chance', () => {
      expect(checkQuest('r_perfect_pair', mockHMulti(2), mockMMulti(2, { rating: 9 }))).toBe(true);
      expect(checkQuest('r_indecisive', mockH(), mockM({ rating: 5 }))).toBe(true);
      expect(checkQuest('r_second_chance', mockH(), mockM())).toBe(true);
    });
  });

  // ==========================================
  // EPIC (DESTANSI) GÖREVLER (TÜMÜ)
  // ==========================================
  describe('🟣 Epic (Destansı) Görevler', () => {
    test('e_series_killer: 5 Dizi bölümü', () => {
      expect(checkQuest('e_series_killer', mockHMulti(5, 'series'), [])).toBe(true);
    });

    test('e_old_school: 1960 ve altı', () => {
      expect(checkQuest('e_old_school', mockH(), mockM({ year: '1955' }))).toBe(true);
    });

    test('e_heavy_novel: 1000 karakter üstü not', () => {
      expect(checkQuest('e_heavy_novel', mockH(), mockM({ note: 'A'.repeat(1005) }))).toBe(true);
    });

    test('e_marathon_3 & e_perfect_3: 3 Film veya 3 İyi Puanlı Film', () => {
      expect(checkQuest('e_marathon_3', mockHMulti(3), mockMMulti(3))).toBe(true);
      expect(checkQuest('e_perfect_3', mockHMulti(3), mockMMulti(3, { rating: 8 }))).toBe(true);
    });
  });

  // ==========================================
  // LEGENDARY (EFSANEVİ) GÖREVLER (TÜMÜ)
  // ==========================================
  describe('🟡 Legendary (Efsanevi) Görevler', () => {
    test('l_directors_cut: 180 dk üstü', () => {
      expect(checkQuest('l_directors_cut', mockH(), mockM({ runtime: 185 }))).toBe(true);
    });

    test('l_weekend_massacre & l_flawless_selection & l_marathon_5', () => {
      expect(checkQuest('l_weekend_massacre', mockHMulti(4), mockMMulti(4))).toBe(true);
      expect(checkQuest('l_flawless_selection', mockHMulti(4), mockMMulti(4, { rating: 9 }))).toBe(true);
      expect(checkQuest('l_marathon_5', mockHMulti(5), mockMMulti(5))).toBe(true);
    });

    test('l_sinevia_god: 7 Günlük Streak', () => {
      expect(checkQuest('l_sinevia_god', mockH(), mockM(), 7)).toBe(true);
    });
  });

  // ==========================================
  // MYTHIC (GİZLİ BOSS) GÖREVLER (TÜMÜ)
  // ==========================================
  describe('🔴 Mythic (Gizli) Görevler', () => {
    test('m_hater: Peş peşe 3 filme <=3 puan verme', () => {
      expect(checkQuest('m_hater', mockHMulti(3), mockMMulti(3, { rating: 2 }))).toBe(true);
    });

    test('Tanımlanmamış Diğer Görevler (Fallback Default): Sadece içerik izleyince tamamlanmalı', () => {
      expect(checkQuest('m_impatient', mockH(), mockM())).toBe(true); 
    });
  });

});