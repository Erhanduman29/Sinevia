import { expect, test, describe } from 'vitest';
import { levelFromXp } from '../lib/xp'; 
import { rootReducer } from '../context/AppContext';
import type { ExtendedAppData } from '../context/AppContext';

// Not: Eğer '../lib/xp' yoksa AppContext'teki XP fonksiyonunu export edip ordan alabiliriz,
// Ama senin importlarından anladığım kadarıyla 'lib/xp.ts' dosyasında duruyor.

function getInitialState(): ExtendedAppData {
  return {
    movies: [], series: [], removedSeriesTitles: [], collections: [],
    genres: [], reviewTags: [], history: [], achievements: [],
    criteria: [], xp: 0, level: 1, totalXp: 0, lastWatchDate: null,
    dailyStreak: 0, dailyStreakDate: null, showLockedNames: false,
    theme: 'default', altWatchTemplate: '', weeklyPlan: [], notificationsEnabled: false
  };
}

describe('⚔️ SİNEVİA SEVİYE (LEVELING) VE XP SİSTEMİ', () => {

  // ==========================================
  // 1. XP VE SEVİYE FORMÜLÜ (levelFromXp)
  // ==========================================
  describe('Matematiksel Seviye Hesabı', () => {

    test('0 XP her zaman Level 1 olmalı', () => {
      const data = levelFromXp(0);
      expect(data.level).toBe(1);
    });

    test('XP arttıkça (Örn: 5000 XP) seviye yükselmeli', () => {
      const data = levelFromXp(5000);
      expect(data.level).toBeGreaterThan(1);
    });

  });

  // ==========================================
  // 2. GRANT_XP (XP KAZANMA) EYLEMİ
  // ==========================================
  describe('XP Ekleme Eylemleri (GRANT_XP)', () => {

    test('XP eklendiğinde Total XP artmalı ve (gerekiyorsa) Seviye atlamalı (Level Up)', () => {
      const state = getInitialState(); // totalXp: 0, Level: 1
      
      // Kullanıcıya büyük bir XP ödülü (Örn: 2000 XP) verdik
      const newState = rootReducer(state, { type: 'GRANT_XP', xp: 2000 } as any);
      
      expect(newState.totalXp).toBe(2000);
      
      // Level 1'den büyük olmalı
      expect(newState.level).toBeGreaterThan(1);

      // Ekranda "Seviye Atladın!" kutlaması için pendingLevelUp objesi oluşturulmalı
      expect(newState.pendingLevelUp).toBeDefined(); 
      expect(newState.pendingLevelUp?.newLevel).toBe(newState.level);
    });

    test('Ufak XP kazanımları (Level atlatmayacak kadar) sadece totalXp yi artırmalı', () => {
      const state = getInitialState(); 
      state.totalXp = 0; state.level = 1;
      
      // Çok ufak bir XP verdik
      const newState = rootReducer(state, { type: 'GRANT_XP', xp: 10 } as any);
      
      expect(newState.totalXp).toBe(10);
      expect(newState.level).toBe(1); // Seviye hala 1
      expect(newState.pendingLevelUp).toBeUndefined(); // Kutlama (LevelUp) yok
    });

  });

});