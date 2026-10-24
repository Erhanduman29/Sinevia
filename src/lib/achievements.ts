import { createElement } from 'react';
import type { FC } from 'react';

export interface AchievementTierDef {
  threshold: number;
  xp: number;
  tier: string;
  name?: string;
}

// Tutorial birimlerinin toplamı — gizli başarımın eşiği (V1'de 6 adım-tutorial + 7 akademi dersi = 13)
import { ALL_TUTORIALS, ACADEMY_QUESTS } from '../tutorial/texts';
export const TUTORIAL_TOTAL_UNITS = ALL_TUTORIALS.length + ACADEMY_QUESTS.length;

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  hidden?: boolean;
  secret?: boolean;
  category?: string;
  tiers: AchievementTierDef[];
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // --- TEMEL BAŞARIMLAR ---
  { id: 'movie_add', name: 'Film Koleksiyoncusu', description: 'Listeye toplam {threshold} film ekle.', icon: 'Film', hidden: false, secret: false, category: 'Filmler', tiers: [
    { threshold: 1, xp: 5, tier: 'bronze', name: 'Acemi Sinefil' },
    { threshold: 10, xp: 10, tier: 'silver', name: 'Film Meraklısı' },
    { threshold: 50, xp: 25, tier: 'gold', name: 'Film Koleksiyoncusu' },
    { threshold: 100, xp: 60, tier: 'platinum', name: 'Sinema Arşivcisi' },
    { threshold: 250, xp: 150, tier: 'emerald', name: 'Sinema Müzesi Kurucusu' },
    { threshold: 500, xp: 350, tier: 'diamond', name: 'Sinema Evreninin Hakimi' }
  ]},
  { id: 'series_add', name: 'Dizi Arşivcisi', description: 'Listeye toplam {threshold} dizi ekle.', icon: 'Tv', hidden: false, secret: false, category: 'Diziler', tiers: [
    { threshold: 1, xp: 5, tier: 'bronze', name: 'Dizi Yolcusu' },
    { threshold: 10, xp: 10, tier: 'silver', name: 'Bölüm Avcısı' },
    { threshold: 50, xp: 25, tier: 'gold', name: 'Dizi Arşivcisi' },
    { threshold: 100, xp: 60, tier: 'platinum', name: 'Dizi Koleksiyoncusu' },
    { threshold: 250, xp: 150, tier: 'emerald', name: 'TV Ağı Yöneticisi' },
    { threshold: 500, xp: 350, tier: 'diamond', name: 'Dizi Evreninin Yaratıcısı' }
  ]},
  { id: 'daily_movie', name: 'Günlük Film Rutini', description: 'Üst üste {threshold} gün sektirmeden her gün film izle.', icon: 'Calendar', hidden: false, secret: false, category: 'Alışkanlık', tiers: [
    { threshold: 3, xp: 20, tier: 'bronze', name: 'Isınma Turu (Film)' },
    { threshold: 7, xp: 50, tier: 'silver', name: 'Haftalık Film Rutini' },
    { threshold: 14, xp: 120, tier: 'gold', name: 'Sinema Tutkunu' },
    { threshold: 30, xp: 250, tier: 'platinum', name: 'Aylık Sinefil Maratonu' },
    { threshold: 60, xp: 600, tier: 'emerald', name: 'Sinemayla Beslenen' },
    { threshold: 100, xp: 1200, tier: 'diamond', name: 'Sinema Makinesi' }
  ]},
  { id: 'daily_series', name: 'Günlük Dizi Rutini', description: 'Üst üste {threshold} gün sektirmeden her gün dizi izle.', icon: 'CalendarCheck', hidden: false, secret: false, category: 'Alışkanlık', tiers: [
    { threshold: 3, xp: 20, tier: 'bronze', name: 'Dizi Akşamları' },
    { threshold: 7, xp: 50, tier: 'silver', name: 'Haftalık Dizi Rutini' },
    { threshold: 14, xp: 120, tier: 'gold', name: 'Bölüm Tüketicisi' },
    { threshold: 30, xp: 250, tier: 'platinum', name: 'Aylık Dizi Maratonu' },
    { threshold: 60, xp: 600, tier: 'emerald', name: 'Ekran Bağımlısı' },
    { threshold: 100, xp: 1200, tier: 'diamond', name: 'Asla Uyumayan' }
  ]},

  // --- TÜR BAŞARIMLARI ---
  { id: 'movie_genre_action', name: 'Aksiyon Filmleri', description: 'Aksiyon türünde toplam {threshold} film izle.', icon: 'Zap', hidden: false, secret: false, category: 'Tür (Film)', tiers: [
    { threshold: 5, xp: 10, tier: 'bronze', name: 'Kavgacı' },
    { threshold: 15, xp: 25, tier: 'silver', name: 'Adrenalin Bağımlısı' },
    { threshold: 30, xp: 60, tier: 'gold', name: 'Aksiyon Tutkunu' },
    { threshold: 50, xp: 120, tier: 'platinum', name: 'Patlayıcı Uzmanı' },
    { threshold: 100, xp: 300, tier: 'emerald', name: 'Aksiyon İkonu' },
    { threshold: 250, xp: 750, tier: 'diamond', name: 'Adrenalin Tanrısı' }
  ]},
  { id: 'series_genre_action', name: 'Aksiyon Dizileri', description: 'Aksiyon türünde toplam {threshold} farklı dizi izle.', icon: 'Zap', hidden: false, secret: false, category: 'Tür (Dizi)', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'Operasyon Başlıyor' },
    { threshold: 3, xp: 25, tier: 'silver', name: 'Taktiksel İzleyici' },
    { threshold: 7, xp: 60, tier: 'gold', name: 'Dizi Savaşçısı' },
    { threshold: 15, xp: 120, tier: 'platinum', name: 'Özel Kuvvetler' },
    { threshold: 30, xp: 250, tier: 'emerald', name: 'Komutan' },
    { threshold: 50, xp: 600, tier: 'diamond', name: 'Savaş Tanrısı' }
  ]},
  { id: 'movie_genre_comedy', name: 'Komedi Filmleri', description: 'Komedi türünde toplam {threshold} film izle.', icon: 'Laugh', hidden: false, secret: false, category: 'Tür (Film)', tiers: [
    { threshold: 5, xp: 10, tier: 'bronze', name: 'Kıkırdayan' },
    { threshold: 15, xp: 25, tier: 'silver', name: 'Kahkaha Makinesi' },
    { threshold: 30, xp: 60, tier: 'gold', name: 'Komedi Aşığı' },
    { threshold: 50, xp: 120, tier: 'platinum', name: 'Stand-up Gurusu' },
    { threshold: 100, xp: 300, tier: 'emerald', name: 'Kahkaha Terapisti' },
    { threshold: 250, xp: 750, tier: 'diamond', name: 'Komedi Efsanesi' }
  ]},
  { id: 'series_genre_comedy', name: 'Komedi Dizileri', description: 'Komedi türünde toplam {threshold} farklı dizi izle.', icon: 'Laugh', hidden: false, secret: false, category: 'Tür (Dizi)', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'Tebessüm' },
    { threshold: 3, xp: 25, tier: 'silver', name: 'Sitcom Bağımlısı' },
    { threshold: 7, xp: 60, tier: 'gold', name: 'Eğlence Maratonu' },
    { threshold: 15, xp: 120, tier: 'platinum', name: 'Komedi Kulübü' },
    { threshold: 30, xp: 250, tier: 'emerald', name: 'Kral Soytarı' },
    { threshold: 50, xp: 600, tier: 'diamond', name: 'Eğlence İlahı' }
  ]},
  { id: 'movie_genre_drama', name: 'Dram Filmleri', description: 'Dram türünde toplam {threshold} film izle.', icon: 'Drama', hidden: false, secret: false, category: 'Tür (Film)', tiers: [
    { threshold: 5, xp: 10, tier: 'bronze', name: 'Gözü Yaşlı' },
    { threshold: 15, xp: 25, tier: 'silver', name: 'Mendil Tüketen' },
    { threshold: 30, xp: 60, tier: 'gold', name: 'Drama Ustası' },
    { threshold: 50, xp: 120, tier: 'platinum', name: 'Duygu Selinde Yüzen' },
    { threshold: 100, xp: 300, tier: 'emerald', name: 'Gözyaşı Denizi' },
    { threshold: 250, xp: 750, tier: 'diamond', name: 'Dramın Saf Hali' }
  ]},
  { id: 'series_genre_drama', name: 'Dram Dizileri', description: 'Dram türünde toplam {threshold} farklı dizi izle.', icon: 'Drama', hidden: false, secret: false, category: 'Tür (Dizi)', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'İlk Gözyaşı' },
    { threshold: 3, xp: 25, tier: 'silver', name: 'Melodram' },
    { threshold: 7, xp: 60, tier: 'gold', name: 'Derin Karakterler' },
    { threshold: 15, xp: 120, tier: 'platinum', name: 'Trajedi Uzmanı' },
    { threshold: 30, xp: 250, tier: 'emerald', name: 'Kalp Kıran' },
    { threshold: 50, xp: 600, tier: 'diamond', name: 'Melodram Efsanesi' }
  ]},
  { id: 'movie_genre_horror', name: 'Korku Filmleri', description: 'Korku türünde toplam {threshold} film izle.', icon: 'Ghost', hidden: false, secret: false, category: 'Tür (Film)', tiers: [
    { threshold: 5, xp: 10, tier: 'bronze', name: 'Ürkmüş' },
    { threshold: 15, xp: 25, tier: 'silver', name: 'Çığlık Atan' },
    { threshold: 30, xp: 60, tier: 'gold', name: 'Korku Meraklısı' },
    { threshold: 50, xp: 120, tier: 'platinum', name: 'Kabuslarda Yaşayan' },
    { threshold: 100, xp: 300, tier: 'emerald', name: 'Korkunun Kendisi' },
    { threshold: 250, xp: 750, tier: 'diamond', name: 'Dehşet Lordu' }
  ]},
  { id: 'series_genre_horror', name: 'Korku Dizileri', description: 'Korku türünde toplam {threshold} farklı dizi izle.', icon: 'Ghost', hidden: false, secret: false, category: 'Tür (Dizi)', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'Karanlık Başlangıç' },
    { threshold: 3, xp: 25, tier: 'silver', name: 'Gece Nöbeti' },
    { threshold: 7, xp: 60, tier: 'gold', name: 'Gerilim Hattı' },
    { threshold: 15, xp: 120, tier: 'platinum', name: 'Korkusuz' },
    { threshold: 30, xp: 250, tier: 'emerald', name: 'Karabasan' },
    { threshold: 50, xp: 600, tier: 'diamond', name: 'Gecenin Hakimi' }
  ]},
  { id: 'movie_genre_scifi', name: 'Bilim Kurgu Filmleri', description: 'Bilim Kurgu türünde toplam {threshold} film izle.', icon: 'Rocket', hidden: false, secret: false, category: 'Tür (Film)', tiers: [
    { threshold: 5, xp: 10, tier: 'bronze', name: 'Uzay Yolcusu' },
    { threshold: 15, xp: 25, tier: 'silver', name: 'Zaman Yolcusu' },
    { threshold: 30, xp: 60, tier: 'gold', name: 'Bilim Kurgu Kaşifi' },
    { threshold: 50, xp: 120, tier: 'platinum', name: 'Evrenler Arası Gezgin' },
    { threshold: 100, xp: 300, tier: 'emerald', name: 'Galaksi Fatihi' },
    { threshold: 250, xp: 750, tier: 'diamond', name: 'Zaman Lordu' }
  ]},
  { id: 'series_genre_scifi', name: 'Bilim Kurgu Dizileri', description: 'Bilim Kurgu türünde toplam {threshold} farklı dizi izle.', icon: 'Rocket', hidden: false, secret: false, category: 'Tür (Dizi)', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'İlk Temas' },
    { threshold: 3, xp: 25, tier: 'silver', name: 'Galaktik İzleyici' },
    { threshold: 7, xp: 60, tier: 'gold', name: 'Paralel Evren' },
    { threshold: 15, xp: 120, tier: 'platinum', name: 'Boyut Atlayan' },
    { threshold: 30, xp: 250, tier: 'emerald', name: 'Evrenin Sırrı' },
    { threshold: 50, xp: 600, tier: 'diamond', name: 'Kozmik Varlık' }
  ]},

  // --- GENEL PUANLAMA VE DEVAMLILIK BAŞARIMLARI ---
  { id: 'perfect_rating', name: 'Mükemmellikçi', description: 'İzlediğin {threshold} farklı yapıma 10 tam puan ver.', icon: 'Crown', hidden: false, secret: false, category: 'Puanlama', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'İlk Başyapıt' },
    { threshold: 5, xp: 25, tier: 'silver', name: 'Seçkin Zevk' },
    { threshold: 10, xp: 60, tier: 'gold', name: 'Mükemmellikçi' },
    { threshold: 25, xp: 150, tier: 'platinum', name: 'Şaheser Avcısı' },
    { threshold: 50, xp: 350, tier: 'emerald', name: 'Kusursuzluk Elçisi' },
    { threshold: 100, xp: 800, tier: 'diamond', name: 'Otorite' }
  ]},
  { id: 'high_rating', name: 'Yüksek Standartlar', description: 'İzlediğin {threshold} farklı yapıma 9 veya 9.5 puan ver.', icon: 'Star', hidden: false, secret: false, category: 'Puanlama', tiers: [
    { threshold: 5, xp: 10, tier: 'bronze', name: 'İyi İzleyici' },
    { threshold: 10, xp: 25, tier: 'silver', name: 'Seçici Göz' },
    { threshold: 25, xp: 60, tier: 'gold', name: 'Yüksek Standartlar' },
    { threshold: 50, xp: 150, tier: 'platinum', name: 'Kalite Kontrolörü' },
    { threshold: 100, xp: 350, tier: 'emerald', name: 'Kalite Dedektifi' },
    { threshold: 200, xp: 800, tier: 'diamond', name: 'Seçkin Jüri' }
  ]},
  { id: 'low_rating', name: 'Kötü İzlenim', description: 'İzlediğin {threshold} farklı yapıma 3 veya daha düşük puan ver.', icon: 'ThumbsDown', hidden: false, secret: false, category: 'Puanlama', tiers: [
    { threshold: 1, xp: 5, tier: 'bronze', name: 'Hayal Kırıklığı' },
    { threshold: 5, xp: 15, tier: 'silver', name: 'Kötü İzlenim' },
    { threshold: 10, xp: 40, tier: 'gold', name: 'Vakit Kaybı Uzmanı' },
    { threshold: 25, xp: 100, tier: 'platinum', name: 'Acımasız Eleştirmen' },
    { threshold: 50, xp: 250, tier: 'emerald', name: 'Nefret İmparatorluğu' },
    { threshold: 100, xp: 600, tier: 'diamond', name: 'Yok Edici' }
  ]},
  { id: 'first_rating', name: 'İlk Puan', description: 'İlk defa bir yapımı puanla.', icon: 'Heart', hidden: true, secret: false, category: 'Puanlama', tiers: [
    { threshold: 1, xp: 5, tier: 'bronze', name: 'İlk Puan' }
  ]},
  { id: 'strict_critic', name: 'Sıkı Eleştirmen', description: '{threshold} farklı yapıma hem puan ver hem de not yaz.', icon: 'PenTool', hidden: false, secret: false, category: 'Puanlama', tiers: [
    { threshold: 5, xp: 20, tier: 'bronze', name: 'Hevesli Yorumcu' },
    { threshold: 15, xp: 60, tier: 'silver', name: 'Sıkı Eleştirmen' },
    { threshold: 30, xp: 150, tier: 'gold', name: 'Usta Eleştirmen' },
    { threshold: 50, xp: 300, tier: 'platinum', name: 'Otoriter Kalem' },
    { threshold: 100, xp: 650, tier: 'emerald', name: 'Sinema Otoritesi' },
    { threshold: 250, xp: 1500, tier: 'diamond', name: 'Sözü Kanun Olan' }
  ]},
  { id: 'season_complete', name: 'Sezon Fatihi', description: 'Bir dizinin tüm bölümlerini bitirerek toplam {threshold} sezon tamamla.', icon: 'Trophy', hidden: false, secret: false, category: 'Diziler', tiers: [
    { threshold: 1, xp: 50, tier: 'bronze', name: 'İlk Final' },
    { threshold: 5, xp: 150, tier: 'silver', name: 'Sezon Avcısı' },
    { threshold: 10, xp: 360, tier: 'gold', name: 'Sezon Fatihi' },
    { threshold: 25, xp: 800, tier: 'platinum', name: 'Dizi Gurusu' },
    { threshold: 50, xp: 1600, tier: 'emerald', name: 'Sezonların Efendisi' },
    { threshold: 100, xp: 3000, tier: 'diamond', name: 'Sonsuz Senaryo' }
  ]},
  { id: 'total_watch', name: 'Seyirci', description: 'Toplam {threshold} farklı yapım izle.', icon: 'Eye', hidden: false, secret: false, category: 'Genel', tiers: [
    { threshold: 10, xp: 25, tier: 'bronze', name: 'Yeni Seyirci' },
    { threshold: 50, xp: 100, tier: 'silver', name: 'Düzenli İzleyici' },
    { threshold: 100, xp: 250, tier: 'gold', name: 'Tecrübeli Seyirci' },
    { threshold: 250, xp: 600, tier: 'platinum', name: 'Ekran Uzmanı' },
    { threshold: 400, xp: 1200, tier: 'emerald', name: 'Hayatı Ekran Olan' },
    { threshold: 750, xp: 2500, tier: 'diamond', name: 'Görsel Hafıza Tanrısı' }
  ]},
  { id: 'collection_complete', name: 'Evren Tamamlayıcı', description: 'İçindeki tüm filmleri izleyerek {threshold} farklı koleksiyonu eksiksiz bitir.', icon: 'Boxes', hidden: true, secret: false, category: 'Koleksiyon', tiers: [
    { threshold: 1, xp: 40, tier: 'bronze', name: 'Seri İzleyici' },
    { threshold: 3, xp: 100, tier: 'silver', name: 'Seri Katili' },
    { threshold: 5, xp: 200, tier: 'gold', name: 'Evren Tamamlayıcı' },
    { threshold: 10, xp: 450, tier: 'platinum', name: 'Hikaye Hakimi' },
    { threshold: 20, xp: 1000, tier: 'emerald', name: 'Koleksiyoner Şefi' },
    { threshold: 40, xp: 2200, tier: 'diamond', name: 'Mitik Arşivci' }
  ]},
  { id: 'genre_explorer', name: 'Tür Kaşifi', description: '{threshold} farklı türde yapım keşfet.', icon: 'Compass', hidden: false, secret: false, category: 'Genel', tiers: [
    { threshold: 3, xp: 10, tier: 'bronze', name: 'Çeşitlilik Arayan' },
    { threshold: 5, xp: 20, tier: 'silver', name: 'Tür Kaşifi' },
    { threshold: 8, xp: 45, tier: 'gold', name: 'Sınır Tanımayan' },
    { threshold: 12, xp: 120, tier: 'platinum', name: 'Türlerin Efendisi' },
    { threshold: 18, xp: 300, tier: 'emerald', name: 'Rehber' },
    { threshold: 24, xp: 600, tier: 'diamond', name: 'Kültürel Miras' }
  ]},
  { id: 'note_taker', name: 'Not Tutucu', description: 'İzlediğin {threshold} farklı yapıma not ekle.', icon: 'StickyNote', hidden: false, secret: false, category: 'Genel', tiers: [
    { threshold: 1, xp: 5, tier: 'bronze', name: 'İlk Not' },
    { threshold: 10, xp: 15, tier: 'silver', name: 'Not Tutucu' },
    { threshold: 25, xp: 40, tier: 'gold', name: 'Sine-Günlük Yazarı' },
    { threshold: 50, xp: 100, tier: 'platinum', name: 'Sinema Tarihçisi' },
    { threshold: 100, xp: 250, tier: 'emerald', name: 'Sinema Yazarı' },
    { threshold: 200, xp: 600, tier: 'diamond', name: 'Baş Eleştirmen' }
  ]},
  { id: 'night_owl', name: 'Gece Kuşu', description: 'Gece 00:00 ile 05:00 saatleri arasında toplam {threshold} izleme yap.', icon: 'Moon', hidden: false, secret: false, category: 'Alışkanlık', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'Gececi' },
    { threshold: 10, xp: 25, tier: 'silver', name: 'Gece Kuşu' },
    { threshold: 30, xp: 60, tier: 'gold', name: 'Uykusuzluk' },
    { threshold: 50, xp: 150, tier: 'platinum', name: 'Vampir Yaşamı' },
    { threshold: 100, xp: 350, tier: 'emerald', name: 'Gecenin Gözleri' },
    { threshold: 200, xp: 800, tier: 'diamond', name: 'Karanlık Lord' }
  ]},
  { id: 'weekend_watcher', name: 'Hafta Sonu Keyfi', description: 'Sadece Cumartesi ve Pazar günleri toplam {threshold} izleme yap.', icon: 'Sofa', hidden: false, secret: false, category: 'Alışkanlık', tiers: [
    { threshold: 5, xp: 15, tier: 'bronze', name: 'Cumartesi Gecesi' },
    { threshold: 20, xp: 50, tier: 'silver', name: 'Hafta Sonu Keyfi' },
    { threshold: 50, xp: 120, tier: 'gold', name: 'Tatil İzleyicisi' },
    { threshold: 100, xp: 250, tier: 'platinum', name: 'Hafta Sonu Savaşçısı' },
    { threshold: 250, xp: 500, tier: 'emerald', name: 'Sadece Hafta Sonu Yaşayan' },
    { threshold: 500, xp: 1200, tier: 'diamond', name: 'Hafta Sonu Efsanesi' }
  ]},
  { id: 'marathon', name: 'Maratoncu', description: 'Tek bir günde 3 veya daha fazla yapım izleme serisini {threshold} farklı günde gerçekleştir.', icon: 'Flame', hidden: false, secret: false, category: 'Alışkanlık', tiers: [
    { threshold: 1, xp: 15, tier: 'bronze', name: 'Üçleme Gecesi' },
    { threshold: 5, xp: 40, tier: 'silver', name: 'Küçük Maraton' },
    { threshold: 10, xp: 90, tier: 'gold', name: 'Maratoncu' },
    { threshold: 25, xp: 200, tier: 'platinum', name: 'Göz Kırpmayan' },
    { threshold: 50, xp: 450, tier: 'emerald', name: 'Bitmek Bilmeyen' },
    { threshold: 100, xp: 1000, tier: 'diamond', name: 'Dizi/Film Koması' }
  ]},

  // --- EFSANE VE GİZLİ BAŞARIMLAR ---
  { id: 'secret_critic', name: 'Acımasız Yargıç', description: 'Tam {threshold} farklı yapıma çok düşük (2 ve altı) puanlar ver.', icon: 'Skull', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 10, xp: 100, tier: 'gold', name: 'Acımasız Yargıç' }] },
  { id: 'secret_perfectionist', name: 'Kusursuzluk Takıntısı', description: 'Tam {threshold} farklı yapıma 10 tam puan ver.', icon: 'Sparkles', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 150, xp: 1000, tier: 'diamond', name: 'Kusursuzluk Takıntısı' }] },
  { id: 'secret_binge', name: 'Dizi Koması', description: 'Aynı gün içinde tam {threshold} bölüm dizi izle.', icon: 'ZapOff', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 10, xp: 200, tier: 'diamond', name: 'Dizi Koması' }] },
  { id: 'sinevia_legend', name: 'Sinevia Efsanesi', description: 'Sinevia evreninin gerçek yöneticisi ol! Toplamda {threshold} yapım izle.', icon: 'Database', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 1000, xp: 5000, tier: 'diamond', name: 'Sinevia Efsanesi' }] },
  { id: 'caveman', name: 'Mağara Adamı', description: 'Tam {threshold} gün boyunca, her gün en az 5 yapım izle.', icon: 'MonitorX', hidden: false, secret: false, category: 'Alışkanlık', tiers: [{ threshold: 7, xp: 750, tier: 'diamond', name: 'Mağara Adamı' }] },
  { id: 'hater', name: 'Nefret Kusucu', description: 'Toplam {threshold} yapıma 1, 1.5 veya 2 puan vererek ne kadar zor beğendiğini göster.', icon: 'Frown', hidden: false, secret: false, category: 'Puanlama', tiers: [{ threshold: 20, xp: 250, tier: 'platinum', name: 'Nefret Kusucu' }] },
  { id: 'epic_writer', name: 'Destan Yazarı', description: 'Tek bir yapım için 5000 karakterden uzun bir inceleme yaz.', icon: 'ScrollText', hidden: false, secret: false, category: 'Genel', tiers: [{ threshold: 1, xp: 500, tier: 'diamond', name: 'Destan Yazarı' }] },
  { id: 'ghost_viewer', name: 'Hayalet İzleyici', description: 'İzlediğin {threshold} yapıma not yazmadan geç.', icon: 'Ghost', hidden: false, secret: false, category: 'Genel', tiers: [{ threshold: 50, xp: 75, tier: 'silver', name: 'Hayalet İzleyici' }] },
  { id: 'trash_lover', name: 'Çöp Sevdalısı', description: 'Puanı 3\'ün altında olan çok kötü {threshold} yapıma uzun incelemeler yaz.', icon: 'Trash2', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 10, xp: 300, tier: 'platinum', name: 'Çöp Sevdalısı' }] },
  { id: 'polarization', name: 'Kutuplaşma', description: 'Listende 20 adet 10 puanlık, 20 adet de 1-2 puanlık yapım bulundur.', icon: 'Magnet', hidden: false, secret: false, category: 'Puanlama', tiers: [{ threshold: 1, xp: 400, tier: 'platinum', name: 'Kutuplaşma' }] },
  { id: 'new_year_lonely', name: 'Yılbaşı Yalnızlığı', description: 'Tam 31 Aralık yılbaşı gecesi izleme yap.', icon: 'PartyPopper', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 1, xp: 600, tier: 'diamond', name: 'Yılbaşı Yalnızlığı' }] },
  { id: 'cinephile', name: 'Sinefil', description: 'Hiçbir diziye bulaşmadan, izleme geçmişinde tam {threshold} film biriktir.', icon: 'Film', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 100, xp: 600, tier: 'emerald', name: 'Sinefil' }] },
  { id: 'short_day_profit', name: 'Kısa Günün Kârı', description: 'Sadece tek bir gün içinde 3 farklı film bitir.', icon: 'Sun', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 1, xp: 50, tier: 'bronze', name: 'Kısa Günün Kârı' }] },
  { id: 'selective_critic', name: 'Seçici Eleştirmen', description: 'Toplam {threshold} farklı filme puan ver ama hiçbirine 10 tam puan verme.', icon: 'Search', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 50, xp: 250, tier: 'gold', name: 'Seçici Eleştirmen' }] },
  { id: 'weekend_cinema', name: 'Hafta Sonu Sineması', description: 'Sadece bir hafta sonu (Cumartesi-Pazar) içinde {threshold} film bitir.', icon: 'Sofa', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 5, xp: 150, tier: 'gold', name: 'Hafta Sonu Sineması' }] },
  { id: 'episode_monster', name: 'Bölüm Canavarı', description: 'Toplamda {threshold} dizi bölümü izlemiş ol.', icon: 'MonitorPlay', hidden: false, secret: false, category: 'Diziler', tiers: [{ threshold: 500, xp: 1000, tier: 'diamond', name: 'Bölüm Canavarı' }] },
  { id: 'patience_stone', name: 'Sabır Taşı', description: 'En az 8 sezonu olan uzun bir dizinin tüm bölümlerini eksiksiz bitir.', icon: 'Hourglass', hidden: false, secret: false, category: 'Diziler', tiers: [{ threshold: 1, xp: 600, tier: 'emerald', name: 'Sabır Taşı' }] },
  { id: 'loyalty_test', name: 'Sadakat Testi', description: 'Aynı diziden her gün en az 1 bölüm olmak şartıyla {threshold} gün peş peşe izle.', icon: 'HeartHandshake', hidden: false, secret: false, category: 'Diziler', tiers: [{ threshold: 10, xp: 250, tier: 'gold', name: 'Sadakat Testi' }] },
  { id: 'break_taker', name: 'Ara Veren', description: 'Bir dizinin herhangi iki bölümü arasında en az {threshold} gün boşluk bırak.', icon: 'Coffee', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 30, xp: 100, tier: 'silver', name: 'Ara Veren' }] },
  { id: 'lost_colony', name: 'Kayıp Koloni', description: 'Bir dizinin iki bölümü arasında tam {threshold} gün boşluk bırak.', icon: 'Milestone', hidden: false, secret: false, category: 'Diziler', tiers: [{ threshold: 365, xp: 300, tier: 'platinum', name: 'Kayıp Koloni' }] },
  { id: 'morning_sweet', name: 'Sabah Şekeri', description: 'Sabah 06:00 ile 09:00 saatleri arasında tam {threshold} farklı film bitir.', icon: 'Sunrise', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 5, xp: 50, tier: 'bronze', name: 'Sabah Şekeri' }] },
  { id: 'nostalgia_wind', name: 'Nostalji Rüzgarı', description: 'Yapım yılı 1980 ve öncesi olan tam {threshold} klasik film izle.', icon: 'Radio', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 20, xp: 200, tier: 'gold', name: 'Nostalji Rüzgarı' }] },
  { id: 'universe_conqueror', name: 'Evren Fatihi', description: 'İçinde en az 3 film barındıran {threshold} farklı koleksiyonu eksiksiz bitir.', icon: 'Globe2', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 5, xp: 350, tier: 'platinum', name: 'Evren Fatihi' }] },
  { id: 'final_phobia', name: 'Final Fobisi', description: 'Bir dizinin final bölümünü tam {threshold} gün boyunca izlenmemiş bırak.', icon: 'ShieldQuestion', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 90, xp: 150, tier: 'gold', name: 'Final Fobisi' }] },
  { id: 'delayed_goodbye', name: 'Ertelenmiş Veda', description: '90 gün boyunca beklettiğin o final bölümünü nihayet izle.', icon: 'DoorOpen', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 1, xp: 200, tier: 'platinum', name: 'Ertelenmiş Veda' }] },
  { id: 'half_century_series', name: 'Yarım Asırlık Dizi', description: 'Toplam bölüm sayısı 100\'ü geçen devasa bir diziyi bitir.', icon: 'Library', hidden: false, secret: false, category: 'Diziler', tiers: [{ threshold: 1, xp: 400, tier: 'platinum', name: 'Yarım Asırlık Dizi' }] },
  { id: 'light_speed', name: 'Işık Hızı', description: 'Bir yapıma eklendiği ilk 24 saat içinde puan ver ve bunu {threshold} kez yap.', icon: 'Zap', hidden: false, secret: false, category: 'Genel', tiers: [{ threshold: 20, xp: 500, tier: 'platinum', name: 'Işık Hızı' }] },
  { id: 'color_palette', name: 'Renk Paleti', description: 'Tam {threshold} farklı puan değerini (0.5, 1, 1.5...) en az bir kez kullan.', icon: 'Palette', hidden: false, secret: false, category: 'Puanlama', tiers: [{ threshold: 15, xp: 150, tier: 'silver', name: 'Renk Paleti' }] },
  { id: 'caps_lock', name: 'Büyük Harf Sendromu', description: 'Bir yapıma yazdığın notun tamamını BÜYÜK HARFLERLE yaz.', icon: 'Keyboard', hidden: false, secret: false, category: 'Genel', tiers: [{ threshold: 1, xp: 50, tier: 'bronze', name: 'Büyük Harf Sendromu' }] },
  { id: 'spider_sense', name: 'Örümcek Hisleri', description: 'Çıkış tarihi henüz gelmemiş (gelecek bir tarihteki) filmi takip listesine ekle.', icon: 'Eye', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 1, xp: 75, tier: 'bronze', name: 'Örümcek Hisleri' }] },

  // --- SÜRE (RUNTIME) VE CANLI SAYAÇ BAŞARIMLARI ---
  { id: 'time_bender', name: 'Zaman Bükücü', description: 'İzlediğin filmlerin toplam süresi {threshold} dakikaya ulaştı.', icon: 'Hourglass', hidden: false, secret: false, category: 'Filmler', tiers: [
    { threshold: 1000, xp: 100, tier: 'bronze', name: 'Vakit Geçirici' },
    { threshold: 5000, xp: 250, tier: 'silver', name: 'Film Mesaisi' },
    { threshold: 10000, xp: 500, tier: 'gold', name: 'Zaman Bükücü' },
    { threshold: 25000, xp: 1000, tier: 'platinum', name: 'Sinemada Yaşayan' },
    { threshold: 50000, xp: 2500, tier: 'emerald', name: 'Zamanın Efendisi' },
    { threshold: 100000, xp: 6000, tier: 'diamond', name: 'Ölümsüz Seyirci' }
  ]},
  { id: 'epic_watcher', name: 'Yönetmenin Vizyonu', description: 'Süresi 180 dakikayı (3 saat) aşan tam {threshold} epik film izledin.', icon: 'Clapperboard', hidden: false, secret: false, category: 'Filmler', tiers: [
    { threshold: 1, xp: 50, tier: 'bronze', name: 'Epik Giriş' },
    { threshold: 5, xp: 150, tier: 'silver', name: 'Sabırlı Seyirci' },
    { threshold: 15, xp: 300, tier: 'gold', name: 'Yönetmenin Vizyonu' },
    { threshold: 30, xp: 600, tier: 'platinum', name: 'Çelik İradeli' },
    { threshold: 50, xp: 1200, tier: 'emerald', name: 'Destansı Seyirci' },
    { threshold: 100, xp: 2500, tier: 'diamond', name: 'Sinematik Şaheser' }
  ]},
  { id: 'short_sweet', name: 'Çerezlik Niyetine', description: 'Süresi 90 dakikanın altında olan tam {threshold} çerezlik film izledin.', icon: 'Popcorn', hidden: false, secret: false, category: 'Filmler', tiers: [
    { threshold: 5, xp: 50, tier: 'bronze', name: 'Hızlı Tüketici' },
    { threshold: 15, xp: 150, tier: 'silver', name: 'Çerezlik Niyetine' },
    { threshold: 30, xp: 300, tier: 'gold', name: 'Tempo Bağımlısı' },
    { threshold: 50, xp: 500, tier: 'platinum', name: 'Kısa ve Öz' },
    { threshold: 100, xp: 1000, tier: 'emerald', name: 'Zaman Gezgini' },
    { threshold: 250, xp: 2000, tier: 'diamond', name: 'Kısa Metraj Gurusu' }
  ]},
  { id: 'couch_potato', name: 'Koltuk Sevdalısı', description: 'Aynı gün içinde toplam 300 dakikadan fazla film izlediğin gün sayısı {threshold} oldu.', icon: 'Armchair', hidden: false, secret: false, category: 'Alışkanlık', tiers: [
    { threshold: 1, xp: 100, tier: 'bronze', name: 'Günlük Kaçamak' },
    { threshold: 3, xp: 250, tier: 'silver', name: 'Hafta Sonu Kampı' },
    { threshold: 7, xp: 500, tier: 'gold', name: 'Koltuk Sevdalısı' },
    { threshold: 15, xp: 1000, tier: 'platinum', name: 'Ekran Bağımlısı' },
    { threshold: 30, xp: 2000, tier: 'emerald', name: 'Güneşi Görmeyen' },
    { threshold: 60, xp: 4000, tier: 'diamond', name: 'Mobilyayla Bütünleşen' }
  ]},

  // --- CANLI İZLEME SÜRESİ, HIZ VE GİZLİ SÜRE BAŞARIMLARI ---
  { id: 'live_timer', name: 'Kronometre Ustası', description: 'İzleme sayacını başlatarak toplam {threshold} filmi gerçek süresiyle tamamla.', icon: 'Timer', hidden: false, secret: false, category: 'Filmler', tiers: [
    { threshold: 1, xp: 15, tier: 'bronze', name: 'Kronometre Başladı' },
    { threshold: 5, xp: 40, tier: 'silver', name: 'Zaman Takipçisi' },
    { threshold: 15, xp: 100, tier: 'gold', name: 'Canlı İzleyici' },
    { threshold: 30, xp: 250, tier: 'platinum', name: 'Dakika Mühendisi' },
    { threshold: 50, xp: 500, tier: 'emerald', name: 'Kronometre Ustası' },
    { threshold: 100, xp: 1000, tier: 'diamond', name: 'Zaman Bekçisi' }
  ]},
  { id: 'speed_watcher', name: 'Hız Tutkunu', description: 'Toplam {threshold} filmi orijinal süresinden daha kısa sürede (hızlı/atlayarak) bitir.', icon: 'FastForward', hidden: false, secret: false, category: 'Filmler', tiers: [
    { threshold: 1, xp: 15, tier: 'bronze', name: 'İlk Hız Denemesi' },
    { threshold: 5, xp: 45, tier: 'silver', name: '1.25x Alışkanlığı' },
    { threshold: 15, xp: 100, tier: 'gold', name: 'Hız Tutkunu' },
    { threshold: 30, xp: 250, tier: 'platinum', name: 'Sahne Atlayıcı' },
    { threshold: 50, xp: 500, tier: 'emerald', name: 'Işık Hızında Sinefil' },
    { threshold: 100, xp: 1000, tier: 'diamond', name: 'Zaman Bükücü Flash' }
  ]},
  { id: 'time_saver', name: 'Zaman Tasarrufçusu', description: 'Filmleri zamanından önce bitirerek toplam {threshold} dakika vakit kazan.', icon: 'Gauge', hidden: false, secret: false, category: 'Filmler', tiers: [
    { threshold: 120, xp: 20, tier: 'bronze', name: 'İki Saat Kâr' },
    { threshold: 600, xp: 60, tier: 'silver', name: '10 Saatlik Hazine' },
    { threshold: 1800, xp: 250, tier: 'gold', name: 'Zaman Tasarrufçusu' },
    { threshold: 4200, xp: 500, tier: 'platinum', name: '70 Saatlik Ömür' },
    { threshold: 7200, xp: 1000, tier: 'emerald', name: 'Zaman Ekonomisti' },
    { threshold: 15000, xp: 2500, tier: 'diamond', name: 'Hayat Kurtaran' }
  ]},
  { id: 'patient_purist', name: 'Orijinal Sadakat', description: 'Sayacı başlatıp {threshold} filmi hiç hızlandırmadan/atlamadan tam süresinde bitir.', icon: 'Clock', hidden: false, secret: false, category: 'Filmler', tiers: [
    { threshold: 1, xp: 25, tier: 'bronze', name: 'Yönetmene Saygı' },
    { threshold: 5, xp: 100, tier: 'silver', name: 'Sabırlı İzleyici' },
    { threshold: 15, xp: 500, tier: 'gold', name: 'Orijinal Sadakat' },
    { threshold: 30, xp: 1000, tier: 'platinum', name: 'Sinema Püristi' },
    { threshold: 50, xp: 2000, tier: 'emerald', name: 'Gerçek Sinefil' },
    { threshold: 100, xp: 4000, tier: 'diamond', name: 'Yönetmenin Rüyası' }
  ]},
  { id: 'secret_speedrunner', name: 'Kurgu Yönetmeni', description: 'Süresi en az 90 dakika olan {threshold} farklı filmi kendi süresinin yarısından bile kısa sürede (2x hızda/atlayarak) bitir.', icon: 'Zap', hidden: true, secret: true, category: 'Gizli', tiers: [
    { threshold: 25, xp: 350, tier: 'diamond', name: 'Kurgu Yönetmeni' }
  ]},

  // --- DAHA ÖNCE (GEÇMİŞTE) İZLENEN FİLM BAŞARIMLARI ---
  { id: 'past_watcher', name: 'Sine-Hafıza', description: 'Daha önceden izlediğin {threshold} filmi puanlayarak arşivine geçir.', icon: 'History', hidden: false, secret: false, category: 'Nostalji', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'İlk Hatıra' },
    { threshold: 10, xp: 30, tier: 'silver', name: 'Film Belleği' },
    { threshold: 25, xp: 75, tier: 'gold', name: 'Nostalji Koleksiyoncusu' },
    { threshold: 50, xp: 180, tier: 'platinum', name: 'Yılların Birikimi' },
    { threshold: 100, xp: 400, tier: 'emerald', name: 'Canlı Sinema Ansiklopedisi' },
    { threshold: 250, xp: 1000, tier: 'diamond', name: 'Geçmişin Koruyucusu' }
  ]},
  { id: 'past_masterpiece', name: 'Unutulmaz Başyapıtlar', description: 'Daha önceden izlediğin {threshold} filme 10 tam puan ver.', icon: 'Award', hidden: false, secret: false, category: 'Nostalji', tiers: [
    { threshold: 1, xp: 15, tier: 'bronze', name: 'Unutulmayan Efsane' },
    { threshold: 5, xp: 40, tier: 'silver', name: 'Zamana Direnenler' },
    { threshold: 15, xp: 100, tier: 'gold', name: 'Altın Arşiv' },
    { threshold: 30, xp: 250, tier: 'platinum', name: 'Kült Koleksiyoner' },
    { threshold: 50, xp: 500, tier: 'emerald', name: 'Ölümsüz Başyapıtlar Müzesi' },
    { threshold: 100, xp: 1200, tier: 'diamond', name: 'Sinemanın Altın Çağı' }
  ]},
  { id: 'past_critic', name: 'Eski Defterler', description: 'Daha önceden izlediğin {threshold} filme hem puan ver hem de inceleme notu yaz.', icon: 'BookOpen', hidden: false, secret: false, category: 'Nostalji', tiers: [
    { threshold: 5, xp: 20, tier: 'bronze', name: 'Geriye Dönük Notlar' },
    { threshold: 15, xp: 50, tier: 'silver', name: 'Hafıza Kayıtları' },
    { threshold: 30, xp: 120, tier: 'gold', name: 'Eski Defterler' },
    { threshold: 50, xp: 250, tier: 'platinum', name: 'Geçmişin Başyazarı' },
    { threshold: 100, xp: 500, tier: 'emerald', name: 'Zamanın Ötesindeki Eleştirmen' },
    { threshold: 250, xp: 1000, tier: 'diamond', name: 'Tarih Yazan' }
  ]},
  { id: 'past_series_watcher', name: 'Dizi Hafızası', description: 'Daha önceden izlediğin {threshold} diziyi puanlayarak arşivine geçir.', icon: 'History', hidden: false, secret: false, category: 'Nostalji', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'İlk Dizi Hatırası' },
    { threshold: 5, xp: 30, tier: 'silver', name: 'Sezon Belleği' },
    { threshold: 15, xp: 75, tier: 'gold', name: 'Nostalji Arşivi' },
    { threshold: 30, xp: 180, tier: 'platinum', name: 'Yılların Dizisi' },
    { threshold: 60, xp: 400, tier: 'emerald', name: 'Canlı Dizi Ansiklopedisi' },
    { threshold: 100, xp: 1000, tier: 'diamond', name: 'Geçmişin Dizi Koruyucusu' }
  ]},
  { id: 'past_series_masterpiece', name: 'Unutulmaz Diziler', description: 'Daha önceden izlediğin {threshold} diziye 10 tam puan ver.', icon: 'Award', hidden: false, secret: false, category: 'Nostalji', tiers: [
    { threshold: 1, xp: 15, tier: 'bronze', name: 'Unutulmayan Dizi' },
    { threshold: 3, xp: 40, tier: 'silver', name: 'Zamana Direnen Diziler' },
    { threshold: 10, xp: 100, tier: 'gold', name: 'Altın Arşiv' },
    { threshold: 20, xp: 250, tier: 'platinum', name: 'Kült Dizi Koleksiyoner' },
    { threshold: 35, xp: 500, tier: 'emerald', name: 'Ölümsüz Diziler Müzesi' },
    { threshold: 60, xp: 1200, tier: 'diamond', name: 'Televizyonun Altın Çağı' }
  ]},
  { id: 'past_series_critic', name: 'Eski Sezonlar', description: 'Daha önceden izlediğin {threshold} diziye hem puan ver hem de inceleme notu yaz.', icon: 'BookOpen', hidden: false, secret: false, category: 'Nostalji', tiers: [
    { threshold: 3, xp: 20, tier: 'bronze', name: 'Geriye Dönük Notlar' },
    { threshold: 10, xp: 50, tier: 'silver', name: 'Hafıza Kayıtları' },
    { threshold: 20, xp: 120, tier: 'gold', name: 'Eski Sezonlar' },
    { threshold: 35, xp: 250, tier: 'platinum', name: 'Geçmişin Başyazarı' },
    { threshold: 60, xp: 500, tier: 'emerald', name: 'Zamanın Ötesindeki Eleştirmen' },
    { threshold: 100, xp: 1000, tier: 'diamond', name: 'Tarih Yazan' }
  ]},

  // --- SİNEMATİK OTOPSİ (YARIM BIRAKILAN FİLMLER) ---
  { id: 'ruthless_critic', name: 'Sinematik Otopsi', description: 'Film süresinin yarısından önce terk edip otopsisini tamamladığın {threshold} film.', icon: 'Skull', hidden: false, secret: false, category: 'Özel', tiers: [
    { threshold: 1, xp: 25, tier: 'bronze', name: 'İlk Otopsi' },
    { threshold: 3, xp: 60, tier: 'silver', name: 'Erken Teşhis' },
    { threshold: 7, xp: 150, tier: 'gold', name: 'Zaman Kurtaran' },
    { threshold: 15, xp: 300, tier: 'platinum', name: 'Baş Adli Tabip' },
    { threshold: 30, xp: 600, tier: 'emerald', name: 'Bileti Kesen' },
    { threshold: 50, xp: 1200, tier: 'diamond', name: 'Otopsi Efendisi' }
  ]},

  // --- KÖR KALİBRASYON (PUAN DÜELLOLARI) ---
  { id: 'scale_master', name: 'Terazi Ustası', description: 'Kör puan düellosunu {threshold} kez tamamla ve puanlarını kalibre et.', icon: 'Scale', hidden: false, secret: false, category: 'Özel', tiers: [
    { threshold: 5, xp: 25, tier: 'bronze', name: 'Çırak Kalibratör' },
    { threshold: 15, xp: 60, tier: 'silver', name: 'Hassas Terazi' },
    { threshold: 35, xp: 140, tier: 'gold', name: 'Dengeli Ölçek' },
    { threshold: 75, xp: 300, tier: 'platinum', name: 'Terazi Ustası' },
    { threshold: 150, xp: 600, tier: 'emerald', name: 'Kusursuz Kalibrasyon' },
    { threshold: 300, xp: 1200, tier: 'diamond', name: 'Mutlak Adalet' }
  ]},

  // --- KÖR KALİBRASYON GİZLİ BAŞARIMI ---
  { id: 'secret_giant_slayer', name: 'Taht Deviren', description: 'Kör düellolarda orijinal puanı rakibinden daha düşük olan bir yapımı {threshold} kez galip getirerek kendi geçmiş puanına meydan oku.', icon: 'Swords', hidden: true, secret: true, category: 'Gizli', tiers: [
    { threshold: 10, xp: 300, tier: 'platinum', name: 'Taht Deviren' }
  ]},

  // --- BAĞIMSIZ BAŞARIMLAR (detaylı puanlama) ---
  { id: 'detail_master', name: 'Kriter Ustası', description: 'Detaylı kriter puanlamasıyla {threshold} farklı filmi puanla.', icon: 'SlidersHorizontal', hidden: false, secret: false, category: 'Puanlama', tiers: [
    { threshold: 10, xp: 120, tier: 'silver', name: 'Kriter Ustası' }
  ]},
  { id: 'review_tagger', name: 'Etiket Ustası', description: 'Değerlendirme başlığı (etiket) ekleyerek {threshold} farklı filmi puanla.', icon: 'Tags', hidden: false, secret: false, category: 'Puanlama', tiers: [
    { threshold: 5, xp: 60, tier: 'bronze', name: 'Etiket Ustası' }
  ]},

  // --- GİZLİ BAŞARIM (tüm tutorialer bitince açılır; elmas) ---
  { id: 'tutorial_explorer', name: 'Sinevia Kâşifi', description: 'Uygulamanın her köşesini gezdin, her tutoriali tamamladın.', icon: 'Compass', hidden: true, secret: true, category: 'Özel', tiers: [
    { threshold: TUTORIAL_TOTAL_UNITS, xp: 400, tier: 'diamond', name: 'Sinevia Kâşifi' }
  ]},

  // --- DİZİ SÜRESİ BAŞARIMLARI ---
  { id: 'series_time', name: 'Dizi Süresi Ustası', description: 'Dizilerde toplam {threshold} dakika izle.', icon: 'Tv', hidden: false, secret: false, category: 'Diziler', tiers: [
    { threshold: 600, xp: 20, tier: 'bronze', name: 'İlk Bölümler' },
    { threshold: 3000, xp: 50, tier: 'silver', name: 'Sezon Gezgini' },
    { threshold: 9000, xp: 120, tier: 'gold', name: 'Dizi Maratoncusu' },
    { threshold: 24000, xp: 250, tier: 'platinum', name: 'Ekran Bağımlısı' },
    { threshold: 60000, xp: 600, tier: 'emerald', name: 'Sonsuz Sezon' },
    { threshold: 150000, xp: 1200, tier: 'diamond', name: 'Zaman Yolcusu' }
  ]},
  { id: 'series_binge_time', name: 'Tek Oturum Efsanesi', description: 'Tek günde dizilerde toplam {threshold} dakika izle.', icon: 'Clock', hidden: false, secret: false, category: 'Diziler', tiers: [
    { threshold: 120, xp: 15, tier: 'bronze', name: 'Kısa Seans' },
    { threshold: 300, xp: 30, tier: 'silver', name: 'Uzun Akşam' },
    { threshold: 600, xp: 60, tier: 'gold', name: 'Gece Kuşu' },
    { threshold: 900, xp: 120, tier: 'platinum', name: 'Binge Başlangıcı' },
    { threshold: 1200, xp: 300, tier: 'emerald', name: 'Dizi Fırtınası' },
    { threshold: 1800, xp: 600, tier: 'diamond', name: 'Uykusuz Efsane' }
  ]},
  { id: 'series_complete_time', name: 'Tamamlanmış Koleksiyon', description: 'Tamamen bitirdiğin dizilerin toplam süresi {threshold} dakika olsun.', icon: 'Timer', hidden: false, secret: false, category: 'Diziler', tiers: [
    { threshold: 1200, xp: 25, tier: 'bronze', name: 'İlk Final' },
    { threshold: 6000, xp: 60, tier: 'silver', name: 'Koleksiyoner' },
    { threshold: 18000, xp: 150, tier: 'gold', name: 'Sezon Arşivcisi' },
    { threshold: 48000, xp: 300, tier: 'platinum', name: 'Dizi Müzesi' },
    { threshold: 120000, xp: 750, tier: 'emerald', name: 'Yayın İmparatoru' },
    { threshold: 300000, xp: 1500, tier: 'diamond', name: 'Ekran Tanrısı' }
  ]},

  // --- PAZAR BAŞARIMLARI ---
  { id: 'market_buyer', name: 'Pazar Müşterisi', description: 'Pazardan {threshold} kez alışveriş yap.', icon: 'ShoppingBag', hidden: false, secret: false, category: 'Pazar', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'İlk Alışveriş' },
    { threshold: 5, xp: 20, tier: 'silver', name: 'Vitrin Gezgini' },
    { threshold: 15, xp: 50, tier: 'gold', name: 'Sadık Müşteri' },
    { threshold: 30, xp: 120, tier: 'platinum', name: 'Pazar Ustası' },
    { threshold: 50, xp: 300, tier: 'emerald', name: 'Koleksiyon Tüccarı' },
    { threshold: 100, xp: 700, tier: 'diamond', name: 'Sinevia Borsası' }
  ]},
  { id: 'market_spender', name: 'SineCoin Sirkülasyonu', description: 'Pazarda toplam {threshold} SineCoin harca.', icon: 'Coins', hidden: false, secret: false, category: 'Pazar', tiers: [
    { threshold: 500, xp: 10, tier: 'bronze', name: 'İlk Harcama' },
    { threshold: 2000, xp: 25, tier: 'silver', name: 'Bütçe Planlayıcı' },
    { threshold: 5000, xp: 60, tier: 'gold', name: 'Pazar Yatırımcısı' },
    { threshold: 15000, xp: 150, tier: 'platinum', name: 'SineCoin Balinası' },
    { threshold: 40000, xp: 400, tier: 'emerald', name: 'Ekonomi Motoru' },
    { threshold: 100000, xp: 900, tier: 'diamond', name: 'Pazar İmparatoru' }
  ]},
  { id: 'contract_finisher', name: 'Taahhüt Ustası', description: '{threshold} pazar görevini zamanında tamamla.', icon: 'ClipboardCheck', hidden: false, secret: false, category: 'Pazar', tiers: [
    { threshold: 1, xp: 15, tier: 'bronze', name: 'İlk Teslim' },
    { threshold: 5, xp: 35, tier: 'silver', name: 'Güvenilir Oyuncu' },
    { threshold: 15, xp: 90, tier: 'gold', name: 'Taahhüt Ustası' },
    { threshold: 30, xp: 200, tier: 'platinum', name: 'Kusursuz Sicil' },
    { threshold: 60, xp: 500, tier: 'emerald', name: 'Pazar Profesyoneli' },
    { threshold: 100, xp: 1100, tier: 'diamond', name: 'Efsanevi Yüklenici' }
  ]},

  // --- GİZLİ PAZAR BAŞARIMLARI ---
  { id: 'weekly_contract_fail', name: 'Kırık Taahhüt', description: 'Bir haftalık pazar görevini süresi içinde tamamlayamadın.', icon: 'Unlink', hidden: true, secret: true, category: 'Gizli', tiers: [
    { threshold: 1, xp: 15, tier: 'bronze', name: 'Kırık Taahhüt' }
  ]},
  { id: 'contract_cancelled', name: 'Yarıda Kalan Seans', description: 'Aktif bir pazar görevini kendi isteğinle iptal ettin.', icon: 'XCircle', hidden: true, secret: true, category: 'Gizli', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'Yarıda Kalan Seans' }
  ]}
];

export const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond'];

export const TIER_COLORS: Record<string, { bg: string; text: string; border: string; label: string; icon: string }> = {
  bronze: { bg: 'bg-orange-600', text: 'text-orange-100', border: 'border-orange-500', label: 'Bronz', icon: 'Medal' },
  silver: { bg: 'bg-gray-400', text: 'text-gray-100', border: 'border-gray-300', label: 'Gümüş', icon: 'Award' },
  gold: { bg: 'bg-yellow-500', text: 'text-yellow-950', border: 'border-yellow-400', label: 'Altın', icon: 'Crown' },
  platinum: { bg: 'bg-cyan-300', text: 'text-cyan-950', border: 'border-cyan-200', label: 'Platin', icon: 'Sparkles' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-950', border: 'border-emerald-400', label: 'Zümrüt', icon: 'Hexagon' },
  diamond: { bg: 'bg-sky-400', text: 'text-sky-950', border: 'border-sky-300', label: 'Elmas', icon: 'Gem' },
};

/* ══════════════════════════════════════════════════════════════════════════
   67 BAŞARIM İÇİN 3 KATMANLI ÖZEL VEKTÖREL ARMA KATALOĞU
   Her başarım ID'si kendi hikayesine uygun 3 katmanlı SVG çizimine sahiptir:
   - `base`: Gölgeli/gradyanlı ana hacim dolgusu
   - `line`: İnce işçilikli kontur ve mekanik detaylar
   - `core`: Parlayan mücevher/enerji çekirdeği
   ══════════════════════════════════════════════════════════════════════════ */
export interface AchievementArtLayers {
  base: string;
  line: string;
  core: string;
}

export const ACHIEVEMENT_ILLUSTRATIONS: Record<string, AchievementArtLayers> = {
  // --- TEMEL BAŞARIMLAR ---
  // 1. Film Koleksiyoncusu: Sinema makarası + +ekleme rozeti
  movie_add: {
    base: 'M11 4A7.5 7.5 0 1 0 11 19A7.5 7.5 0 1 0 11 4Z',
    line: 'M11 4A7.5 7.5 0 1 0 11 19A7.5 7.5 0 1 0 11 4Z M11 4V19 M3.5 11.5H18.5 M18 15V21 M15 18H21',
    core: 'M11 9.5A2 2 0 1 0 11 13.5A2 2 0 1 0 11 9.5Z M18 15V21 M15 18H21',
  },
  // 2. Dizi Arşivcisi: Klasik TV ekranı + arşiv katmanları
  series_add: {
    base: 'M3.5 7.5H18.5V18.5H3.5V7.5Z M6.5 4.5H20.5V15.5H18.5V7.5H6.5V4.5Z',
    line: 'M3.5 7.5H18.5V18.5H3.5V7.5Z M7.5 3L11 7.5L14.5 3 M7.5 21H14.5',
    core: 'M11 10.5V15.5 M8.5 13H13.5',
  },
  // 3. Günlük Film Rutini: Takvim yaprağı + alevli film şeridi
  daily_movie: {
    base: 'M4 6H20V20H4V6Z',
    line: 'M4 6H20V20H4V6Z M4 10H20 M8 3.5V7.5 M16 3.5V7.5',
    core: 'M12 11.5C12 11.5 9.5 14 9.5 16C9.5 17.5 10.6 18.5 12 18.5C13.4 18.5 14.5 17.5 14.5 16C14.5 14 12 11.5 12 11.5Z',
  },
  // 4. Günlük Dizi Rutini: Takvim + onaylı bölüm ekranı
  daily_series: {
    base: 'M4 6H20V20H4V6Z',
    line: 'M4 6H20V20H4V6Z M4 10H20 M8 3.5V7.5 M16 3.5V7.5',
    core: 'M8.5 14.8L11 17.2L15.8 12.5',
  },

  // --- TÜR BAŞARIMLARI ---
  // 5. Aksiyon Filmleri: Çapraz kılıçlar ve yıldırım darbesi
  movie_genre_action: {
    base: 'M13 2.5L5.5 13H11.5L9.5 21.5L18.5 11H12.5L13 2.5Z',
    line: 'M4 20L20 4 M20 20L4 4 M13 2.5L5.5 13H11.5L9.5 21.5L18.5 11H12.5L13 2.5Z',
    core: 'M12 10A2 2 0 1 0 12 14A2 2 0 1 0 12 10Z',
  },
  // 6. Aksiyon Dizileri: Taktiksel kalkan + nişangah yıldızı
  series_genre_action: {
    base: 'M12 2.5L19.5 6V12C19.5 16.5 16.2 20 12 21.5C7.8 20 4.5 16.5 4.5 12V6L12 2.5Z',
    line: 'M12 2.5L19.5 6V12C19.5 16.5 16.2 20 12 21.5C7.8 20 4.5 16.5 4.5 12V6L12 2.5Z M8 12H16 M12 8V16',
    core: 'M12 10.2A1.8 1.8 0 1 0 12 13.8A1.8 1.8 0 1 0 12 10.2Z',
  },
  // 7. Komedi Filmleri: Neşeli antik sahne maskesi
  movie_genre_comedy: {
    base: 'M4.5 4.5C8 2.8 16 2.8 19.5 4.5V12.5C19.5 17.5 16 21 12 21C8 21 4.5 17.5 4.5 12.5V4.5Z',
    line: 'M4.5 4.5C8 2.8 16 2.8 19.5 4.5V12.5C19.5 17.5 16 21 12 21C8 21 4.5 17.5 4.5 12.5V4.5Z M7.5 13C8.5 16.5 15.5 16.5 16.5 13H7.5Z',
    core: 'M8 9L9.5 7.5L11 9 M13 9L14.5 7.5L16 9',
  },
  // 8. Komedi Dizileri: Stand-up mikrofonu + kahkaha dalgaları
  series_genre_comedy: {
    base: 'M9 4.5A3 3 0 0 1 15 4.5V10.5A3 3 0 0 1 9 10.5V4.5Z',
    line: 'M9 4.5A3 3 0 0 1 15 4.5V10.5A3 3 0 0 1 9 10.5V4.5Z M6 10.5A6 6 0 0 0 18 10.5 M12 16.5V21 M8.5 21H15.5',
    core: 'M9 7.5H15 M4 6.5C3 8 3 10 4 11.5 M20 6.5C21 8 21 10 20 11.5',
  },
  // 9. Dram Filmleri: Kristal gözyaşı ve kırık maske
  movie_genre_drama: {
    base: 'M12 2.5C12 2.5 6 9.8 6 14.2C6 17.6 8.7 20.2 12 20.2C15.3 20.2 18 17.6 18 14.2C18 9.8 12 2.5 12 2.5Z',
    line: 'M12 2.5C12 2.5 6 9.8 6 14.2C6 17.6 8.7 20.2 12 20.2C15.3 20.2 18 17.6 18 14.2C18 9.8 12 2.5 12 2.5Z',
    core: 'M9.5 13.5C9.5 15.8 11 17.5 13.2 17.5 M12 6.5V9.5',
  },
  // 10. Dram Dizileri: İkiz trajedi maskesi
  series_genre_drama: {
    base: 'M3 5H13V13C13 16.2 10.5 18.5 8 18.5C5.5 18.5 3 16.2 3 13V5Z M11 8.5H21V16C21 19 18.5 21 16 21C13.5 21 11 19 11 16V8.5Z',
    line: 'M3 5H13V13C13 16.2 10.5 18.5 8 18.5C5.5 18.5 3 16.2 3 13V5Z M11 8.5H21V16C21 19 18.5 21 16 21C13.5 21 11 19 11 16V8.5Z',
    core: 'M6 14.5C7 13 9 13 10 14.5 M14 18C15 16.5 17 16.5 18 18',
  },
  // 11. Korku Filmleri: Karanlık hayalet ve parlayan gözler
  movie_genre_horror: {
    base: 'M12 2.8C7.2 2.8 4.5 6.5 4.5 11.2V20.5L8.2 18.2L12 20.5L15.8 18.2L19.5 20.5V11.2C19.5 6.5 16.8 2.8 12 2.8Z',
    line: 'M12 2.8C7.2 2.8 4.5 6.5 4.5 11.2V20.5L8.2 18.2L12 20.5L15.8 18.2L19.5 20.5V11.2C19.5 6.5 16.8 2.8 12 2.8Z',
    core: 'M9.2 9.8A1.5 1.5 0 1 0 9.2 12.8A1.5 1.5 0 1 0 9.2 9.8Z M14.8 9.8A1.5 1.5 0 1 0 14.8 12.8A1.5 1.5 0 1 0 14.8 9.8Z',
  },
  // 12. Korku Dizileri: Kanlı hançer ve dolunay
  series_genre_horror: {
    base: 'M12 2.5L14.5 14.5H9.5L12 2.5Z M6 7A6.5 6.5 0 1 0 18 13',
    line: 'M12 2.5L14.5 14.5H9.5L12 2.5Z M8 14.5H16 M12 14.5V20.5',
    core: 'M12 20.5A1.2 1.2 0 1 0 12 22.9A1.2 1.2 0 1 0 12 20.5Z M12 6V12',
  },
  // 13. Bilim Kurgu Filmleri: Yıldız kruvazörü roketi
  movie_genre_scifi: {
    base: 'M12 2C15.2 5.8 16.2 10.2 16 14.5H8C7.8 10.2 8.8 5.8 12 2Z',
    line: 'M12 2C15.2 5.8 16.2 10.2 16 14.5H8C7.8 10.2 8.8 5.8 12 2Z M8 11.5L4.5 15.5V17.5H8 M16 11.5L19.5 15.5V17.5H16',
    core: 'M12 7.2A1.8 1.8 0 1 0 12 10.8A1.8 1.8 0 1 0 12 7.2Z M10 14.5L12 21.5L14 14.5H10Z',
  },
  // 14. Bilim Kurgu Dizileri: Satürn halkalı gezegen ve portal
  series_genre_scifi: {
    base: 'M12 5.5A6.5 6.5 0 1 0 12 18.5A6.5 6.5 0 1 0 12 5.5Z',
    line: 'M12 5.5A6.5 6.5 0 1 0 12 18.5A6.5 6.5 0 1 0 12 5.5Z M2.2 14.5C5.5 10.5 18.5 7.5 21.8 9.5C18.5 13.5 5.5 16.5 2.2 14.5Z',
    core: 'M15.5 4L16.2 5.8L18 6.5L16.2 7.2L15.5 9L14.8 7.2L13 6.5L14.8 5.8Z',
  },

  // --- GENEL PUANLAMA VE DEVAMLILIK BAŞARIMLARI ---
  // 15. Mükemmellikçi: İmparatorluk tacı ve 10 mührü
  perfect_rating: {
    base: 'M3 7.5L7.5 12L12 4.5L16.5 12L21 7.5L19.2 19.5H4.8L3 7.5Z',
    line: 'M3 7.5L7.5 12L12 4.5L16.5 12L21 7.5L19.2 19.5H4.8L3 7.5Z M4.5 16.5H19.5',
    core: 'M12 10.5L13.6 13L12 15.5L10.4 13L12 10.5Z',
  },
  // 16. Yüksek Standartlar: Çift katmanlı süpernova yıldızı
  high_rating: {
    base: 'M12 2.2L14.9 8.6L21.8 9.5L16.7 14.3L18 21.2L12 17.8L6 21.2L7.3 14.3L2.2 9.5L9.1 8.6L12 2.2Z',
    line: 'M12 2.2L14.9 8.6L21.8 9.5L16.7 14.3L18 21.2L12 17.8L6 21.2L7.3 14.3L2.2 9.5L9.1 8.6L12 2.2Z',
    core: 'M12 7.5L13.4 10.5L16.6 11L14.2 13.2L14.8 16.4L12 14.8L9.2 16.4L9.8 13.2L7.4 11L10.6 10.5L12 7.5Z',
  },
  // 17. Kötü İzlenim: Aşağı bakan Roma İmparatorluk başparmağı / kırık mühür
  low_rating: {
    base: 'M10 4H18.5V13H14.5L12.5 20.5L9.5 19.5L11 13H4.5V7.5L7 4H10Z',
    line: 'M10 4H18.5V13H14.5L12.5 20.5L9.5 19.5L11 13H4.5V7.5L7 4H10Z M18.5 4H21V13H18.5',
    core: 'M6 16.5L9 19.5 M9 16.5L6 19.5',
  },
  // 18. İlk Puan: Parlayan kalp ve merkez yıldızı
  first_rating: {
    base: 'M12 5.8C9.8 3 5.5 3.2 3.5 6C1.5 8.8 2.2 13 5.5 16.2L12 21.5L18.5 16.2C21.8 13 22.5 8.8 20.5 6C18.5 3.2 14.2 3 12 5.8Z',
    line: 'M12 5.8C9.8 3 5.5 3.2 3.5 6C1.5 8.8 2.2 13 5.5 16.2L12 21.5L18.5 16.2C21.8 13 22.5 8.8 20.5 6C18.5 3.2 14.2 3 12 5.8Z',
    core: 'M12 9L13.2 11.5L16 12L14 14L14.5 16.8L12 15.4L9.5 16.8L10 14L8 12L10.8 11.5L12 9Z',
  },
  // 19. Sıkı Eleştirmen: Divit kalem ucu ve yıldız mührü
  strict_critic: {
    base: 'M12 2.5L18.5 11.5L15.5 19H8.5L5.5 11.5L12 2.5Z',
    line: 'M12 2.5L18.5 11.5L15.5 19H8.5L5.5 11.5L12 2.5Z M12 2.5V12.5 M7.5 19H16.5V21.2H7.5V19Z',
    core: 'M12 11.2A1.8 1.8 0 1 0 12 14.8A1.8 1.8 0 1 0 12 11.2Z',
  },
  // 20. Sezon Fatihi: Zafer kupası ve defne çelengi
  season_complete: {
    base: 'M6.5 3.5H17.5V9.5C17.5 13 15 15.5 12 15.5C9 15.5 6.5 13 6.5 9.5V3.5Z',
    line: 'M6.5 3.5H17.5V9.5C17.5 13 15 15.5 12 15.5C9 15.5 6.5 13 6.5 9.5V3.5Z M6.5 5.5H3.5V8.5C3.5 11 5 12.2 6.8 12.2 M17.5 5.5H20.5V8.5C20.5 11 19 12.2 17.2 12.2 M12 15.5V19.5 M7.5 20H16.5',
    core: 'M12 6L13.2 8.4L15.8 8.8L13.9 10.6L14.4 13.2L12 11.9L9.6 13.2L10.1 10.6L8.2 8.8L10.8 8.4L12 6Z',
  },
  // 21. Seyirci: Her şeyi gören sinematik göz
  total_watch: {
    base: 'M1.8 12C4.5 6.8 8 4.5 12 4.5C16 4.5 19.5 6.8 22.2 12C19.5 17.2 16 19.5 12 19.5C8 19.5 4.5 17.2 1.8 12Z',
    line: 'M1.8 12C4.5 6.8 8 4.5 12 4.5C16 4.5 19.5 6.8 22.2 12C19.5 17.2 16 19.5 12 19.5C8 19.5 4.5 17.2 1.8 12Z M12 8A4 4 0 1 0 12 16A4 4 0 1 0 12 8Z',
    core: 'M12 10.2A1.8 1.8 0 1 0 12 13.8A1.8 1.8 0 1 0 12 10.2Z',
  },
  // 22. Evren Tamamlayıcı: İç içe geçmiş izometrik koleksiyon küpleri
  collection_complete: {
    base: 'M12 2.5L20.5 7.2V16.8L12 21.5L3.5 16.8V7.2L12 2.5Z',
    line: 'M12 2.5L20.5 7.2V16.8L12 21.5L3.5 16.8V7.2L12 2.5Z M3.5 7.2L12 12L20.5 7.2 M12 12V21.5',
    core: 'M12 7L16 9.2L12 11.5L8 9.2L12 7Z',
  },
  // 23. Tür Kaşifi: Yıldız pusulası (Astrolabe)
  genre_explorer: {
    base: 'M12 3A9 9 0 1 0 12 21A9 9 0 1 0 12 3Z',
    line: 'M12 3A9 9 0 1 0 12 21A9 9 0 1 0 12 3Z M16.5 7.5L14 14L7.5 16.5L10 10L16.5 7.5Z',
    core: 'M12 10.5A1.5 1.5 0 1 0 12 13.5A1.5 1.5 0 1 0 12 10.5Z',
  },
  // 24. Not Tutucu: Kıvrık köşeli eleştirmen günlüğü
  note_taker: {
    base: 'M4.5 3.5H19.5V15.5L14.5 20.5H4.5V3.5Z',
    line: 'M4.5 3.5H19.5V15.5L14.5 20.5H4.5V3.5Z M14 20.5V15H19.5 M8 8.5H16 M8 12H13',
    core: 'M8 15.5H11',
  },
  // 25. Gece Kuşu: Hilal ay ve gece yıldızları
  night_owl: {
    base: 'M19.5 14.8A8 8 0 0 1 9.2 4.5A8 8 0 1 0 19.5 14.8Z',
    line: 'M19.5 14.8A8 8 0 0 1 9.2 4.5A8 8 0 1 0 19.5 14.8Z',
    core: 'M15.5 5L16.3 7.2L18.5 8L16.3 8.8L15.5 11L14.7 8.8L12.5 8L14.7 7.2Z',
  },
  // 26. Hafta Sonu Keyfi: Geniş sinema koltuğu (VIP Sofa)
  weekend_watcher: {
    base: 'M5 9C5 7 6.5 5.5 8.5 5.5H15.5C17.5 5.5 19 7 19 9V12H21V17.5H3V12H5V9Z',
    line: 'M5 12V9C5 7 6.5 5.5 8.5 5.5H15.5C17.5 5.5 19 7 19 9V12 M3 12H6V15H18V12H21V17.5H3V12Z M5 17.5V20 M19 17.5V20',
    core: 'M12 8.5L13 10.5L12 12.5L11 10.5Z',
  },
  // 27. Maratoncu: Üç çekirdekli maraton alevi
  marathon: {
    base: 'M12 2C12 2 5.5 8.2 5.5 14.2C5.5 18.2 8.4 21.2 12 21.2C15.6 21.2 18.5 18.2 18.5 14.2C18.5 11 16.5 7.8 14.8 6.2C14.8 8.8 13.2 10.2 12 10.2C10.8 10.2 10.2 7.8 12 2Z',
    line: 'M12 2C12 2 5.5 8.2 5.5 14.2C5.5 18.2 8.4 21.2 12 21.2C15.6 21.2 18.5 18.2 18.5 14.2C18.5 11 16.5 7.8 14.8 6.2C14.8 8.8 13.2 10.2 12 10.2C10.8 10.2 10.2 7.8 12 2Z',
    core: 'M12 12.5C10.2 14.2 9.5 15.8 9.5 17.5C9.5 19 10.6 20 12 20C13.4 20 14.5 19 14.5 17.5C14.5 15.8 13.8 14.2 12 12.5Z',
  },

  // --- EFSANE VE GİZLİ BAŞARIMLAR ---
  // 28. Acımasız Yargıç: Yargıç tokmağı + kurukafa mührü
  secret_critic: {
    base: 'M12 3C7.5 3 4.5 6 4.5 10.5C4.5 13 6 15 7.5 16V19.5H16.5V16C18 15 19.5 13 19.5 10.5C19.5 6 16.5 3 12 3Z',
    line: 'M12 3C7.5 3 4.5 6 4.5 10.5C4.5 13 6 15 7.5 16V19.5H16.5V16C18 15 19.5 13 19.5 10.5C19.5 6 16.5 3 12 3Z M10 16V19.5 M14 16V19.5',
    core: 'M9 10A1.5 1.5 0 1 0 9 13A1.5 1.5 0 1 0 9 10Z M15 10A1.5 1.5 0 1 0 15 13A1.5 1.5 0 1 0 15 10Z',
  },
  // 29. Kusursuzluk Takıntısı: Kusursuz 8 köşeli prizma yıldızı
  secret_perfectionist: {
    base: 'M12 1.5L14.8 9.2L22.5 12L14.8 14.8L12 22.5L9.2 14.8L1.5 12L9.2 9.2L12 1.5Z',
    line: 'M12 1.5L14.8 9.2L22.5 12L14.8 14.8L12 22.5L9.2 14.8L1.5 12L9.2 9.2L12 1.5Z M5 5L19 19 M19 5L5 19',
    core: 'M12 9A3 3 0 1 0 12 15A3 3 0 1 0 12 9Z',
  },
  // 30. Dizi Koması: Kırık şimşek ve aşırı yüklenmiş ekran
  secret_binge: {
    base: 'M3.5 6H20.5V17H3.5V6Z',
    line: 'M3.5 6H20.5V17H3.5V6Z M8 20H16 M12 17V20 M3 3L21 21',
    core: 'M13 7.5L9.5 12H12.5L11 15.5',
  },
  // 31. Sinevia Efsanesi: Kutsal Veri Monoliti & Taç
  sinevia_legend: {
    base: 'M5 4.5C5 3.1 8.1 2 12 2C15.9 2 19 3.1 19 4.5V19.5C19 20.9 15.9 22 12 22C8.1 22 5 20.9 5 19.5V4.5Z',
    line: 'M5 4.5C5 3.1 8.1 2 12 2C15.9 2 19 3.1 19 4.5V19.5C19 20.9 15.9 22 12 22C8.1 22 5 20.9 5 19.5V4.5Z M5 9.5C5 10.9 8.1 12 12 12C15.9 12 19 10.9 19 9.5 M5 14.5C5 15.9 8.1 17 12 17C15.9 17 19 15.9 19 14.5',
    core: 'M12 5.5L13.5 7.5L12 9.5L10.5 7.5Z',
  },
  // 32. Mağara Adamı: Karanlık mağara kemeri ve parlayan ekran
  caveman: {
    base: 'M3 19.5V11C3 6 7 3 12 3C17 3 21 6 21 11V19.5H3Z',
    line: 'M3 19.5V11C3 6 7 3 12 3C17 3 21 6 21 11V19.5H3Z M7 11H17V17H7V11Z',
    core: 'M10 12.5L14 14L10 15.5V12.5Z',
  },
  // 33. Nefret Kusucu: Çatık kaşlı zehirli maske
  hater: {
    base: 'M12 3A9 9 0 1 0 12 21A9 9 0 1 0 12 3Z',
    line: 'M12 3A9 9 0 1 0 12 21A9 9 0 1 0 12 3Z M8 16.5C9.5 14.5 14.5 14.5 16 16.5 M7.5 8.5L10.5 10.5 M16.5 8.5L13.5 10.5',
    core: 'M9 10.5A1 1 0 1 0 9 12.5A1 1 0 1 0 9 10.5Z M15 10.5A1 1 0 1 0 15 12.5A1 1 0 1 0 15 10.5Z',
  },
  // 34. Destan Yazarı: Açılmış kraliyet parşömeni ve tüy kalem
  epic_writer: {
    base: 'M5.5 3.5H18.5V19C18.5 20.2 17.5 21 16.2 21H5.5V3.5Z',
    line: 'M5.5 3.5H18.5V19C18.5 20.2 17.5 21 16.2 21H5.5C4.4 21 3.5 20.2 3.5 19V5.5C3.5 4.4 4.4 3.5 5.5 3.5Z M8.5 8H15.5 M8.5 11.5H15.5 M8.5 15H12.5',
    core: 'M15.5 15.5L19.5 11.5L21 13L17 17H15.5V15.5Z',
  },
  // 35. Hayalet İzleyici: Saydam hayalet silüeti
  ghost_viewer: {
    base: 'M12 3C7.5 3 5 6.5 5 11V20L8.5 18L12 20L15.5 18L19 20V11C19 6.5 16.5 3 12 3Z',
    line: 'M12 3C7.5 3 5 6.5 5 11V20L8.5 18L12 20L15.5 18L19 20V11C19 6.5 16.5 3 12 3Z M9 14H15',
    core: 'M9.5 10A1.2 1.2 0 1 0 9.5 12.4A1.2 1.2 0 1 0 9.5 10Z M14.5 10A1.2 1.2 0 1 0 14.5 12.4A1.2 1.2 0 1 0 14.5 10Z',
  },
  // 36. Çöp Sevdalısı: Çöp kutusu içinden yükselen altın kalp/elmas
  trash_lover: {
    base: 'M6 8H18L16.8 20.5H7.2L6 8Z',
    line: 'M4.5 8H19.5 M9 8V5.5H15V8 M6 8L7.2 20.5H16.8L18 8',
    core: 'M12 11.5C11 10 8.5 10.5 8.5 12.5C8.5 14.5 12 16.8 12 16.8C12 16.8 15.5 14.5 15.5 12.5C15.5 10.5 13 10 12 11.5Z',
  },
  // 37. Kutuplaşma: U-Mıknatıs ve zıt kutup şimşekleri
  polarization: {
    base: 'M5 4H9V12A3 3 0 0 0 15 12V4H19V12A7 7 0 0 1 5 12V4Z',
    line: 'M5 4H9V12A3 3 0 0 0 15 12V4H19V12A7 7 0 0 1 5 12V4Z M5 8H9 M15 8H19',
    core: 'M12 2L11 5H13L12 8',
  },
  // 38. Yılbaşı Yalnızlığı: Gece yarısı havai fişeği ve konfeti külahı
  new_year_lonely: {
    base: 'M4 20L9 8L16 15L4 20Z',
    line: 'M4 20L9 8L16 15L4 20Z M13 5L16 2 M17 9L21 7 M15 11L19 12',
    core: 'M18 3.5L19 5.5L21 6.5L19 7.5L18 9.5L17 7.5L15 6.5L17 5.5Z',
  },
  // 39. Sinefil: Saf altın 35mm sinema şeridi
  cinephile: {
    base: 'M4 4H20V20H4V4Z',
    line: 'M4 4H20V20H4V4Z M8 4V20 M16 4V20 M4 8H8 M4 12H8 M4 16H8 M16 8H20 M16 12H20 M16 16H20',
    core: 'M10 9.5L15 12L10 14.5V9.5Z',
  },
  // 40. Kısa Günün Kârı: Parlayan güneş ve 3 film karesi
  short_day_profit: {
    base: 'M12 6.5A5.5 5.5 0 1 0 12 17.5A5.5 5.5 0 1 0 12 6.5Z',
    line: 'M12 6.5A5.5 5.5 0 1 0 12 17.5A5.5 5.5 0 1 0 12 6.5Z M12 2V4.5 M12 19.5V22 M2 12H4.5 M19.5 12H22 M4.9 4.9L6.7 6.7 M17.3 17.3L19.1 19.1 M19.1 4.9L17.3 6.7 M6.7 17.3L4.9 19.1',
    core: 'M12 9.5L13.5 12L12 14.5L10.5 12Z',
  },
  // 41. Seçici Eleştirmen: Büyüteç altında incelenen yıldız
  selective_critic: {
    base: 'M10.5 4A6.5 6.5 0 1 0 10.5 17A6.5 6.5 0 1 0 10.5 4Z',
    line: 'M10.5 4A6.5 6.5 0 1 0 10.5 17A6.5 6.5 0 1 0 10.5 4Z M15.2 15.2L20.5 20.5',
    core: 'M10.5 7L11.5 9.2L13.8 9.5L12.1 11.1L12.5 13.4L10.5 12.3L8.5 13.4L8.9 11.1L7.2 9.5L9.5 9.2L10.5 7Z',
  },
  // 42. Hafta Sonu Sineması: Perdeli sinema sahnesi ve koltuk
  weekend_cinema: {
    base: 'M3 4H21V18H3V4Z',
    line: 'M3 4H21V18H3V4Z M3 4C6 9 6 14 3 18 M21 4C18 9 18 14 21 18 M6 20.5H18',
    core: 'M10 9L15 11.5L10 14V9Z',
  },
  // 43. Bölüm Canavarı: Canavar dişli dev ekran
  episode_monster: {
    base: 'M3 5.5H21V17.5H3V5.5Z',
    line: 'M3 5.5H21V17.5H3V5.5Z M8 20.5H16 M12 17.5V20.5 M6 5.5L8 8.5L10 5.5L12 8.5L14 5.5L16 8.5L18 5.5',
    core: 'M9.5 11L15 13.5L9.5 16V11Z',
  },
  // 44. Sabır Taşı: Kanatlı antik kum saati
  patience_stone: {
    base: 'M6.5 3.5H17.5L12 11.5L6.5 3.5Z M12 12.5L17.5 20.5H6.5L12 12.5Z',
    line: 'M5 3.5H19 M5 20.5H19 M6.5 3.5L17.5 20.5 M17.5 3.5L6.5 20.5 M2.5 10L6 12L2.5 14 M21.5 10L18 12L21.5 14',
    core: 'M12 10.5A1.5 1.5 0 1 0 12 13.5A1.5 1.5 0 1 0 12 10.5Z',
  },
  // 45. Sadakat Testi: Kenetlenmiş sadakat halkaları ve kalp mührü
  loyalty_test: {
    base: 'M12 5.8C9.8 3 5.5 3.2 3.5 6C1.5 8.8 2.2 13 5.5 16.2L12 21.5L18.5 16.2C21.8 13 22.5 8.8 20.5 6C18.5 3.2 14.2 3 12 5.8Z',
    line: 'M12 5.8C9.8 3 5.5 3.2 3.5 6C1.5 8.8 2.2 13 5.5 16.2L12 21.5L18.5 16.2C21.8 13 22.5 8.8 20.5 6C18.5 3.2 14.2 3 12 5.8Z M7.5 12.5L10.5 15.5L16.5 9.5',
    core: 'M10.5 15.5L16.5 9.5',
  },
  // 46. Ara Veren: Kahve molası ve duraklatma (Pause) sembolü
  break_taker: {
    base: 'M4.5 8.5H16.5V14.5C16.5 18 14 20.2 10.5 20.2C7 20.2 4.5 18 4.5 14.5V8.5Z',
    line: 'M4.5 8.5H16.5V14.5C16.5 18 14 20.2 10.5 20.2C7 20.2 4.5 18 4.5 14.5V8.5Z M16.5 9.8H19C20.5 9.8 21.5 10.8 21.5 12.3C21.5 13.8 20.5 14.8 19 14.8H16.5',
    core: 'M9 11.5V15.5 M12 11.5V15.5',
  },
  // 47. Kayıp Koloni: Yön tabelası ve ıssız gezegen ufku
  lost_colony: {
    base: 'M4 5.5H18L21 8.5L18 11.5H4V5.5Z',
    line: 'M12 3V21 M4 5.5H18L21 8.5L18 11.5H4V5.5Z M6 14.5H16L3 17.5L6 14.5Z M7 21H17',
    core: 'M12 7.2A1.3 1.3 0 1 0 12 9.8A1.3 1.3 0 1 0 12 7.2Z',
  },
  // 48. Sabah Şekeri: Ufuktan doğan sabah güneşi
  morning_sweet: {
    base: 'M5 16A7 7 0 0 1 19 16H5Z',
    line: 'M2.5 16H21.5 M5 19.5H19 M5 16A7 7 0 0 1 19 16 M12 4V6.5 M4.9 8.9L6.7 10.7 M19.1 8.9L17.3 10.7',
    core: 'M12 11.5L13.5 14H10.5L12 11.5Z',
  },
  // 49. Nostalji Rüzgarı: Klasik radyo/sinema alıcısı
  nostalgia_wind: {
    base: 'M3.5 8.5H20.5V19.5H3.5V8.5Z',
    line: 'M3.5 8.5H20.5V19.5H3.5V8.5Z M6.5 8.5L15.5 3.5 M13.5 12.5H18 M13.5 15.8H18',
    core: 'M8.2 11.8A2.3 2.3 0 1 0 8.2 16.4A2.3 2.3 0 1 0 8.2 11.8Z',
  },
  // 50. Evren Fatihi: Yörüngeli gezegen ve fetih bayrağı
  universe_conqueror: {
    base: 'M12 5.5A6.5 6.5 0 1 0 12 18.5A6.5 6.5 0 1 0 12 5.5Z',
    line: 'M12 5.5A6.5 6.5 0 1 0 12 18.5A6.5 6.5 0 1 0 12 5.5Z M2.5 12H21.5 M12 2.5C15 6 15 18 12 21.5C9 18 9 6 12 2.5Z',
    core: 'M12 9.5L14.5 12L12 14.5L9.5 12Z',
  },
  // 51. Final Fobisi: Soru işaretli gizemli kalkan
  final_phobia: {
    base: 'M12 2.5L20 6V12C20 16.8 16.5 20.2 12 21.8C7.5 20.2 4 16.8 4 12V6L12 2.5Z',
    line: 'M12 2.5L20 6V12C20 16.8 16.5 20.2 12 21.8C7.5 20.2 4 16.8 4 12V6L12 2.5Z M9.8 9.2C9.8 7.5 14.2 7.5 14.2 9.8C14.2 11.5 12 11.8 12 13.5',
    core: 'M12 16A1.2 1.2 0 1 0 12 18.4A1.2 1.2 0 1 0 12 16Z',
  },
  // 52. Ertelenmiş Veda: Aralanan ışık kapısı
  delayed_goodbye: {
    base: 'M5 3.5H16V20.5H5V3.5Z M16 3.5L19.5 5.5V18.5L16 20.5V3.5Z',
    line: 'M5 3.5H16V20.5H5V3.5Z M16 3.5L19.5 5.5V18.5L16 20.5 M3 20.5H21',
    core: 'M13.5 11.2A1.2 1.2 0 1 0 13.5 13.6A1.2 1.2 0 1 0 13.5 11.2Z',
  },
  // 53. Yarım Asırlık Dizi: Devasa antik kütüphane sütunları
  half_century_series: {
    base: 'M4 5H8V19H4V5Z M10 4H14V19H10V4Z M16 6L20 5V19H16V6Z',
    line: 'M4 5H8V19H4V5Z M10 4H14V19H10V4Z M16 6L20 5V19H16V6Z M3 20.5H21',
    core: 'M6 8V11 M12 7V11 M18 8V11',
  },
  // 54. Işık Hızı: Süpersonik yıldırım oku
  light_speed: {
    base: 'M13.5 2L4.5 13.5H11.5L9.5 22L19.5 10.5H12.5L13.5 2Z',
    line: 'M13.5 2L4.5 13.5H11.5L9.5 22L19.5 10.5H12.5L13.5 2Z',
    core: 'M12 8.5L8.5 13H12.5L11.5 17L15 11.5H11.5L12 8.5Z',
  },
  // 55. Renk Paleti: Puan spektrumu paleti
  color_palette: {
    base: 'M12 3.2A8.8 8.8 0 0 0 3.2 12C3.2 16.8 7 20.8 11.5 20.8C13.2 20.8 14.2 19.8 14.2 18.2C14.2 17 13.4 16.2 13.4 15.2C13.4 14 14.4 13.2 15.8 13.2H17.5C19.5 13.2 20.8 11.6 20.8 9.5C20.8 5.8 16.8 3.2 12 3.2Z',
    line: 'M12 3.2A8.8 8.8 0 0 0 3.2 12C3.2 16.8 7 20.8 11.5 20.8C13.2 20.8 14.2 19.8 14.2 18.2C14.2 17 13.4 16.2 13.4 15.2C13.4 14 14.4 13.2 15.8 13.2H17.5C19.5 13.2 20.8 11.6 20.8 9.5C20.8 5.8 16.8 3.2 12 3.2Z',
    core: 'M7.5 10.5A1.2 1.2 0 1 0 7.5 12.9A1.2 1.2 0 1 0 7.5 10.5Z M10.5 6.8A1.2 1.2 0 1 0 10.5 9.2A1.2 1.2 0 1 0 10.5 6.8Z M15.2 7.2A1.2 1.2 0 1 0 15.2 9.6A1.2 1.2 0 1 0 15.2 7.2Z',
  },
  // 56. Büyük Harf Sendromu: Mekanik klavye ve parlayan CAPS tuşu
  caps_lock: {
    base: 'M3 6.5H21V17.5H3V6.5Z',
    line: 'M3 6.5H21V17.5H3V6.5Z M6.5 10H8.5 M11 10H13 M15.5 10H17.5 M7.5 14.5H16.5',
    core: 'M12 8.5L14 11.5H10L12 8.5Z',
  },
  // 57. Örümcek Hisleri: Geometrik örümcek ağı ve gelecek vizörü
  spider_sense: {
    base: 'M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z',
    line: 'M12 3V21 M4 7.5L20 16.5 M20 7.5L4 16.5 M12 7L16.5 9.5V14.5L12 17L7.5 14.5V9.5L12 7Z',
    core: 'M12 10.2A1.8 1.8 0 1 0 12 13.8A1.8 1.8 0 1 0 12 10.2Z',
  },

  // --- SÜRE VE CANLI SAYAÇ BAŞARIMLARI ---
  // 58. Zaman Bükücü: Bükülen uzay-zaman kum saati
  time_bender: {
    base: 'M6.5 3.5H17.5L12 11.5L6.5 3.5Z M12 12.5L17.5 20.5H6.5L12 12.5Z',
    line: 'M5 3.5H19 M5 20.5H19 M6.5 3.5L17.5 20.5 M17.5 3.5L6.5 20.5 M3 12C3 7 7 3 12 3 M21 12C21 17 17 21 12 21',
    core: 'M12 10.2A1.8 1.8 0 1 0 12 13.8A1.8 1.8 0 1 0 12 10.2Z',
  },
  // 59. Yönetmenin Vizyonu: Altın klaket ve yönetmen vizörü
  epic_watcher: {
    base: 'M3.5 9.5H20.5V20.5H3.5V9.5Z M3.5 9.5L4.5 4.8L19.5 2.8L20.5 7.5L3.5 9.5Z',
    line: 'M3.5 9.5H20.5V20.5H3.5V9.5Z M3.5 9.5L4.5 4.8L19.5 2.8L20.5 7.5L3.5 9.5Z M8 4.4L10 8.7 M13.5 3.6L15.5 7.9',
    core: 'M12 12L13.5 14.5L16.2 15L14.2 16.8L14.7 19.5L12 18L9.3 19.5L9.8 16.8L7.8 15L10.5 14.5L12 12Z',
  },
  // 60. Çerezlik Niyetine: Hızlı mısır kovası
  short_sweet: {
    base: 'M5.5 10L7 21H17L18.5 10H5.5Z',
    line: 'M5.5 10L7 21H17L18.5 10H5.5Z M9.5 10L10 21 M14.5 10L14 21 M7 10C5.5 8 7 5.5 9.5 6C10.5 3.5 13.5 3.5 14.5 6C17 5.5 18.5 8 17 10',
    core: 'M12 13.5L13.5 15.5L12 17.5L10.5 15.5Z',
  },
  // 61. Koltuk Sevdalısı: Kraliyet sinema tahtı
  couch_potato: {
    base: 'M5 8C5 6 6.8 4.5 9 4.5H15C17.2 4.5 19 6 19 8V12H21.5V18H2.5V12H5V8Z',
    line: 'M5 12V8C5 6 6.8 4.5 9 4.5H15C17.2 4.5 19 6 19 8V12 M2.5 12H6V15.5H18V12H21.5V18H2.5V12Z M5 18V20.5 M19 18V20.5',
    core: 'M12 7.5L13.5 10L12 12.5L10.5 10Z',
  },
  // 62. Kronometre Ustası: Hassas mekanik kronometre
  live_timer: {
    base: 'M12 5.5A7.8 7.8 0 1 0 12 21.1A7.8 7.8 0 1 0 12 5.5Z',
    line: 'M12 5.5A7.8 7.8 0 1 0 12 21.1A7.8 7.8 0 1 0 12 5.5Z M9.5 2.8H14.5 M12 2.8V5.5 M17.8 6.2L19.8 4.2 M12 9V13.5L15 15.5',
    core: 'M12 11.8A1.5 1.5 0 1 0 12 14.8A1.5 1.5 0 1 0 12 11.8Z',
  },
  // 63. Hız Tutkunu: Çift ileri sarma (Fast-Forward)
  speed_watcher: {
    base: 'M3 5.5L12.5 12L3 18.5V5.5Z M12 5.5L21.5 12L12 18.5V5.5Z',
    line: 'M3 5.5L12.5 12L3 18.5V5.5Z M12 5.5L21.5 12L12 18.5V5.5Z',
    core: 'M14.5 9L19 12L14.5 15V9Z',
  },
  // 64. Zaman Tasarrufçusu: Turbo takometre kadranı
  time_saver: {
    base: 'M3 16.5A9 9 0 0 1 21 16.5L18 19.5H6L3 16.5Z',
    line: 'M3 16.5A9 9 0 0 1 21 16.5 M6 19.5H18 M12 15.5L17 8.5',
    core: 'M12 14A2 2 0 1 0 12 18A2 2 0 1 0 12 14Z',
  },
  // 65. Orijinal Sadakat: Mühürlü zaman saati
  patient_purist: {
    base: 'M12 3A9 9 0 1 0 12 21A9 9 0 1 0 12 3Z',
    line: 'M12 3A9 9 0 1 0 12 21A9 9 0 1 0 12 3Z M12 6.5V12L16 14.5',
    core: 'M12 10.5A1.5 1.5 0 1 0 12 13.5A1.5 1.5 0 1 0 12 10.5Z',
  },
  // 66. Kurgu Yönetmeni: Makas ve yıldırım şeridi
  secret_speedrunner: {
    base: 'M13.5 2L4.5 13.5H11.5L9.5 22L19.5 10.5H12.5L13.5 2Z',
    line: 'M13.5 2L4.5 13.5H11.5L9.5 22L19.5 10.5H12.5L13.5 2Z M4 4L20 20',
    core: 'M12 10A2 2 0 1 0 12 14A2 2 0 1 0 12 10Z',
  },

  // --- NOSTALJİ & ÖZEL BAŞARIMLAR ---
  // 67. Sine-Hafıza: Geriye dönen zaman saati (History)
  past_watcher: {
    base: 'M12 4A8 8 0 1 0 20 12H12V4Z',
    line: 'M4.5 9.5A8 8 0 1 1 6.3 17.7 M4 5V10H9 M12 7.5V12L15 14',
    core: 'M12 10.5A1.5 1.5 0 1 0 12 13.5A1.5 1.5 0 1 0 12 10.5Z',
  },
  // 68. Unutulmaz Başyapıtlar: Kurdeleli şeref madalyası
  past_masterpiece: {
    base: 'M12 3A6.5 6.5 0 1 0 12 16A6.5 6.5 0 1 0 12 3Z',
    line: 'M12 3A6.5 6.5 0 1 0 12 16A6.5 6.5 0 1 0 12 3Z M8.5 15L6.5 21.5L12 19L17.5 21.5L15.5 15',
    core: 'M12 6.8L13 8.8L15.2 9.1L13.6 10.6L14 12.8L12 11.7L10 12.8L10.4 10.6L8.8 9.1L11 8.8L12 6.8Z',
  },
  // 69. Eski Defterler: Açık ansiklopedi kitabı
  past_critic: {
    base: 'M2.5 5.5C6 4.5 9.5 5.5 12 7.5C14.5 5.5 18 4.5 21.5 5.5V19C18 18 14.5 19 12 21C9.5 19 6 18 2.5 19V5.5Z',
    line: 'M2.5 5.5C6 4.5 9.5 5.5 12 7.5C14.5 5.5 18 4.5 21.5 5.5V19C18 18 14.5 19 12 21C9.5 19 6 18 2.5 19V5.5Z M12 7.5V21',
    core: 'M6 10H9.5 M6 13H9.5 M14.5 10H18 M14.5 13H18',
  },
  // 70. Sinematik Otopsi: Neşterli otopsi kurukafası
  ruthless_critic: {
    base: 'M12 2.8C7.2 2.8 4.2 6 4.2 10.5C4.2 13.2 5.8 15.2 7.5 16.2V20H16.5V16.2C18.2 15.2 19.8 13.2 19.8 10.5C19.8 6 16.8 2.8 12 2.8Z',
    line: 'M12 2.8C7.2 2.8 4.2 6 4.2 10.5C4.2 13.2 5.8 15.2 7.5 16.2V20H16.5V16.2C18.2 15.2 19.8 13.2 19.8 10.5C19.8 6 16.8 2.8 12 2.8Z M9.8 16.2V20 M14.2 16.2V20',
    core: 'M8.8 9.8A1.7 1.7 0 1 0 8.8 13.2A1.7 1.7 0 1 0 8.8 9.8Z M15.2 9.8A1.7 1.7 0 1 0 15.2 13.2A1.7 1.7 0 1 0 15.2 9.8Z',
  },
  // 71. Terazi Ustası: Kalibrasyon terazisi
  scale_master: {
    base: 'M3 15.5L6.5 8.5L10 15.5C8.5 17 4.5 17 3 15.5Z M14 15.5L17.5 8.5L21 15.5C19.5 17 15.5 17 14 15.5Z',
    line: 'M12 3V20 M4.5 7.5H19.5 M6.5 7.5L3 15.5H10L6.5 7.5Z M17.5 7.5L14 15.5H21L17.5 7.5Z M7 20H17',
    core: 'M12 2.5L14 5.5L12 8.5L10 5.5L12 2.5Z',
  },
  // 72. Taht Deviren: Devrilen tacı kesen çapraz kılıçlar
  secret_giant_slayer: {
    base: 'M4 8.5L8 12.5L12 6L16 12.5L20 8.5L18.5 18.5H5.5L4 8.5Z',
    line: 'M4 8.5L8 12.5L12 6L16 12.5L20 8.5L18.5 18.5H5.5L4 8.5Z M3 20.5L21 3.5',
    core: 'M12 11L13.5 13.5L12 16L10.5 13.5Z',
  },
  // 73. Kriter Ustası: Üçlü hassas mikser / kriter sürgüleri
  detail_master: {
    base: 'M4 5H20V19H4V5Z',
    line: 'M4 7H20 M4 12H20 M4 17H20',
    core: 'M9 5V9 M15 10V14 M11 15V19',
  },
  // 74. Etiket Ustası: Çift inceleme etiketi rozeti
  review_tagger: {
    base: 'M3 7L11 3L19 11L11 19L3 11V7Z',
    line: 'M3 7L11 3L19 11L11 19L3 11V7Z M14 6L21 13L13 21',
    core: 'M8 7.5A1.5 1.5 0 1 0 8 10.5A1.5 1.5 0 1 0 8 7.5Z',
  },
  // 75. Sinevia Kâşifi: Akademi yıldızlı kraliyet pusulası
  tutorial_explorer: {
    base: 'M12 2.5L20.5 7.2V16.8L12 21.5L3.5 16.8V7.2L12 2.5Z',
    line: 'M12 2.5L20.5 7.2V16.8L12 21.5L3.5 16.8V7.2L12 2.5Z M16.5 7.5L14 14L7.5 16.5L10 10L16.5 7.5Z',
    core: 'M12 10.2A1.8 1.8 0 1 0 12 13.8A1.8 1.8 0 1 0 12 10.2Z',
  },
};

type BadgeTierKey = 'locked' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'emerald' | 'diamond';

const TIER_EMBLEM_PALETTE: Record<
  BadgeTierKey,
  {
    shellOuter: string;
    shellInner: string;
    rimLight: string;
    rimDark: string;
    glow: string;
    artFillStart: string;
    artFillEnd: string;
    artStroke: string;
    artCore: string;
  }
> = {
  locked: {
    shellOuter: '#18181b',
    shellInner: '#09090b',
    rimLight: '#52525b',
    rimDark: '#27272a',
    glow: 'rgba(0,0,0,0.4)',
    artFillStart: '#52525b',
    artFillEnd: '#27272a',
    artStroke: '#71717a',
    artCore: '#a1a1aa',
  },
  bronze: {
    shellOuter: '#7c2d12',
    shellInner: '#1f0b04',
    rimLight: '#fdba74',
    rimDark: '#c2410c',
    glow: 'rgba(234,88,12,0.55)',
    artFillStart: '#fb923c',
    artFillEnd: '#9a3412',
    artStroke: '#ffedd5',
    artCore: '#fde047',
  },
  silver: {
    shellOuter: '#3f3f46',
    shellInner: '#111115',
    rimLight: '#f4f4f5',
    rimDark: '#71717a',
    glow: 'rgba(212,212,216,0.55)',
    artFillStart: '#e4e4e7',
    artFillEnd: '#52525b',
    artStroke: '#ffffff',
    artCore: '#38bdf8',
  },
  gold: {
    shellOuter: '#78350f',
    shellInner: '#1c0a02',
    rimLight: '#fef08a',
    rimDark: '#d97706',
    glow: 'rgba(245,158,11,0.75)',
    artFillStart: '#fbbf24',
    artFillEnd: '#92400e',
    artStroke: '#fffbeb',
    artCore: '#ffffff',
  },
  platinum: {
    shellOuter: '#155e75',
    shellInner: '#061a23',
    rimLight: '#a5f3fc',
    rimDark: '#0891b2',
    glow: 'rgba(34,211,238,0.75)',
    artFillStart: '#67e8f9',
    artFillEnd: '#0e7490',
    artStroke: '#ecfeff',
    artCore: '#fde047',
  },
  emerald: {
    shellOuter: '#065f46',
    shellInner: '#031c15',
    rimLight: '#6ee7b7',
    rimDark: '#059669',
    glow: 'rgba(16,185,129,0.8)',
    artFillStart: '#34d399',
    artFillEnd: '#047857',
    artStroke: '#ecfdf5',
    artCore: '#fef08a',
  },
  diamond: {
    shellOuter: '#0c4a6e',
    shellInner: '#0a0720',
    rimLight: '#e0f2fe',
    rimDark: '#38bdf8',
    glow: 'rgba(56,189,248,0.9)',
    artFillStart: '#7dd3fc',
    artFillEnd: '#4f46e5',
    artStroke: '#ffffff',
    artCore: '#f43f5e',
  },
};

/**
 * Başarım Arması Bileşeni (`AchievementIcon`)
 * Her başarım için 3 katmanlı özel SVG illüstrasyonunu ve açılan en yüksek
 * kademeye (`bronze` -> `diamond` veya `locked`) duyarlı zırhlı madalyayı çizer.
 */
export function AchievementIcon({
  achievementId,
  tier = 'gold',
  size = 28,
  className = '',
}: {
  achievementId: string;
  tier?: string | null;
  size?: number;
  className?: string;
}) {
  const art = ACHIEVEMENT_ILLUSTRATIONS[achievementId] || ACHIEVEMENT_ILLUSTRATIONS.total_watch;
  const normalizedTier: BadgeTierKey =
    tier && tier in TIER_EMBLEM_PALETTE ? (tier as BadgeTierKey) : 'locked';

  const pal = TIER_EMBLEM_PALETTE[normalizedTier];
  const uid = `ach-art-${achievementId}-${normalizedTier}`;
  const badgePx = Math.max(size + 16, 40);
  const isHighTier =
    normalizedTier === 'platinum' || normalizedTier === 'emerald' || normalizedTier === 'diamond';

  return createElement(
    'span',
    {
      className: `relative inline-flex items-center justify-center select-none shrink-0 group/aart ${className}`,
      style: {
        width: badgePx,
        height: badgePx,
        filter: `drop-shadow(0 6px 12px ${pal.glow})`,
      },
      'aria-hidden': true,
    },
    createElement(
      'svg',
      {
        viewBox: '0 0 64 64',
        className: 'w-full h-full overflow-visible transition-transform duration-300 group-hover/aart:scale-110',
      },
      // 1. TANIMLAR: Kademe Gradyanları
      createElement(
        'defs',
        null,
        createElement(
          'radialGradient',
          { id: `${uid}-bg`, cx: '35%', cy: '25%', r: '75%' },
          createElement('stop', { offset: '0%', stopColor: pal.shellOuter }),
          createElement('stop', { offset: '100%', stopColor: pal.shellInner })
        ),
        createElement(
          'linearGradient',
          { id: `${uid}-rim`, x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
          createElement('stop', { offset: '0%', stopColor: pal.rimLight }),
          createElement('stop', { offset: '55%', stopColor: pal.rimDark }),
          createElement('stop', { offset: '100%', stopColor: pal.shellInner })
        ),
        createElement(
          'linearGradient',
          { id: `${uid}-fill`, x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
          createElement('stop', { offset: '0%', stopColor: pal.artFillStart, stopOpacity: '0.6' }),
          createElement('stop', { offset: '100%', stopColor: pal.artFillEnd, stopOpacity: '0.25' })
        )
      ),
      // 2. ZIRHLI KUPA / MADALYA TABANI
      createElement('polygon', {
        points: '20,3 44,3 61,20 61,44 44,61 20,61 3,44 3,20',
        fill: `url(#${uid}-bg)`,
        stroke: `url(#${uid}-rim)`,
        strokeWidth: isHighTier ? '2.6' : '2',
      }),
      // İç Cam Çerçeve
      createElement('polygon', {
        points: '22,7 42,7 57,22 57,42 42,57 22,57 7,42 7,22',
        fill: 'none',
        stroke: pal.rimLight,
        strokeOpacity: '0.2',
        strokeWidth: '1',
      }),
      // Kadran Halkası
      createElement('circle', {
        cx: '32',
        cy: '32',
        r: '21',
        fill: 'none',
        stroke: pal.rimLight,
        strokeOpacity: '0.24',
        strokeWidth: '1',
        strokeDasharray: normalizedTier === 'locked' ? '2 4' : '6 3',
      }),
      // Prestij Mücevherleri (Gold, Platinum, Emerald, Diamond için)
      (normalizedTier === 'gold' || isHighTier) &&
        createElement('polygon', {
          points: '32,0.5 36,5.5 32,9 28,5.5',
          fill: pal.rimLight,
        }),
      isHighTier &&
        createElement('polygon', {
          points: '32,63.5 36,58.5 32,55 28,58.5',
          fill: pal.rimLight,
        }),
      // 3. 3 KATMANLI ÖZEL BAŞARIM İLLÜSTRASYONU
      createElement(
        'g',
        { transform: 'translate(12, 12) scale(1.6667)' },
        // Katman A: Hacimli Gövde Dolgusu (`base`)
        art.base &&
          createElement('path', {
            d: art.base,
            fill: `url(#${uid}-fill)`,
          }),
        // Katman B: Keskin Vektör Çizgileri (`line`)
        createElement('path', {
          d: art.line,
          fill: 'none',
          stroke: pal.artStroke,
          strokeWidth: '1.65',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
        // Katman C: Parlak Odak & Enerji Çekirdeği (`core`)
        art.core &&
          createElement('path', {
            d: art.core,
            fill: pal.artCore,
            stroke: pal.artCore,
            strokeWidth: '0.9',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          })
      )
    )
  );
}

// Geriye dönük uyumluluk: Başarım ID'sine göre doğrudan bileşen döndüren harita
export const ACHIEVEMENT_ICON_MAP: Record<
  string,
  FC<{ tier?: string | null; size?: number; className?: string }>
> = Object.fromEntries(
  ACHIEVEMENT_DEFS.map((a) => [
    a.id,
    ({ tier = 'gold', size = 28, className = '' }) =>
      createElement(AchievementIcon, { achievementId: a.id, tier, size, className }),
  ])
);