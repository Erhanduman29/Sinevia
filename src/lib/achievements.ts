import type { AchievementDef } from '../types';

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // --- TEMEL BAŞARIMLAR ---
  { id: 'movie_add', name: 'Film Koleksiyoncusu', description: 'Listeye toplam {threshold} film ekle.', icon: 'Film', hidden: false, secret: false, category: 'Filmler', tiers: [
    { threshold: 1, xp: 5, tier: 'bronze', name: 'Acemi Sinefilm' }, 
    { threshold: 10, xp: 15, tier: 'silver', name: 'Film Meraklısı' }, 
    { threshold: 50, xp: 40, tier: 'gold', name: 'Film Koleksiyoncusu' }, 
    { threshold: 100, xp: 100, tier: 'platinum', name: 'Sinema Arşivcisi' }, 
    { threshold: 250, xp: 250, tier: 'diamond', name: 'Sinema Müzesi Kurucusu' }
  ]},
  { id: 'series_add', name: 'Dizi Arşivcisi', description: 'Listeye toplam {threshold} dizi ekle.', icon: 'Tv', hidden: false, secret: false, category: 'Diziler', tiers: [
    { threshold: 1, xp: 5, tier: 'bronze', name: 'Dizi Yolcusu' }, 
    { threshold: 10, xp: 15, tier: 'silver', name: 'Bölüm Avcısı' }, 
    { threshold: 50, xp: 40, tier: 'gold', name: 'Dizi Arşivcisi' }, 
    { threshold: 100, xp: 100, tier: 'platinum', name: 'Dizi Koleksiyoncusu' }, 
    { threshold: 250, xp: 250, tier: 'diamond', name: 'TV Ağı Yöneticisi' }
  ]},
  { id: 'daily_movie', name: 'Günlük Film Rutini', description: 'Üst üste {threshold} gün sektirmeden her gün film izle.', icon: 'Calendar', hidden: false, secret: false, category: 'Alışkanlık', tiers: [
    { threshold: 3, xp: 15, tier: 'bronze', name: 'Isınma Turu (Film)' }, 
    { threshold: 7, xp: 30, tier: 'silver', name: 'Haftalık Film Rutini' }, 
    { threshold: 14, xp: 60, tier: 'gold', name: 'Sinema Tutkunu' }, 
    { threshold: 30, xp: 150, tier: 'platinum', name: 'Aylık Sinefilm Maratonu' }, 
    { threshold: 60, xp: 300, tier: 'diamond', name: 'Sinemayla Beslenen' }
  ]},
  { id: 'daily_series', name: 'Günlük Dizi Rutini', description: 'Üst üste {threshold} gün sektirmeden her gün dizi izle.', icon: 'CalendarCheck', hidden: false, secret: false, category: 'Alışkanlık', tiers: [
    { threshold: 3, xp: 15, tier: 'bronze', name: 'Dizi Akşamları' }, 
    { threshold: 7, xp: 30, tier: 'silver', name: 'Haftalık Dizi Rutini' }, 
    { threshold: 14, xp: 60, tier: 'gold', name: 'Bölüm Tüketicisi' }, 
    { threshold: 30, xp: 150, tier: 'platinum', name: 'Aylık Dizi Maratonu' }, 
    { threshold: 60, xp: 300, tier: 'diamond', name: 'Ekran Bağımlısı' }
  ]},

  // --- TÜR BAŞARIMLARI (FİLM VE DİZİ OLARAK AYRILDI) ---
  { id: 'movie_genre_action', name: 'Aksiyon Filmleri', description: 'Aksiyon türünde toplam {threshold} film izle.', icon: 'Zap', hidden: false, secret: false, category: 'Tür (Film)', tiers: [
    { threshold: 5, xp: 10, tier: 'bronze', name: 'Kavgacı' }, 
    { threshold: 15, xp: 25, tier: 'silver', name: 'Adrenalin Bağımlısı' }, 
    { threshold: 30, xp: 60, tier: 'gold', name: 'Aksiyon Tutkunu' }, 
    { threshold: 50, xp: 120, tier: 'platinum', name: 'Patlayıcı Uzmanı' }
  ]},
  { id: 'series_genre_action', name: 'Aksiyon Dizileri', description: 'Aksiyon türünde toplam {threshold} farklı dizi izle.', icon: 'Zap', hidden: false, secret: false, category: 'Tür (Dizi)', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'Operasyon Başlıyor' }, 
    { threshold: 3, xp: 25, tier: 'silver', name: 'Taktiksel İzleyici' }, 
    { threshold: 7, xp: 60, tier: 'gold', name: 'Dizi Savaşçısı' }, 
    { threshold: 15, xp: 120, tier: 'platinum', name: 'Özel Kuvvetler' }
  ]},
  { id: 'movie_genre_comedy', name: 'Komedi Filmleri', description: 'Komedi türünde toplam {threshold} film izle.', icon: 'Laugh', hidden: false, secret: false, category: 'Tür (Film)', tiers: [
    { threshold: 5, xp: 10, tier: 'bronze', name: 'Kıkırdayan' }, 
    { threshold: 15, xp: 25, tier: 'silver', name: 'Kahkaha Makinesi' }, 
    { threshold: 30, xp: 60, tier: 'gold', name: 'Komedi Aşığı' }, 
    { threshold: 50, xp: 120, tier: 'platinum', name: 'Stand-up Gurusu' }
  ]},
  { id: 'series_genre_comedy', name: 'Komedi Dizileri', description: 'Komedi türünde toplam {threshold} farklı dizi izle.', icon: 'Laugh', hidden: false, secret: false, category: 'Tür (Dizi)', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'Tebessüm' }, 
    { threshold: 3, xp: 25, tier: 'silver', name: 'Sitcom Bağımlısı' }, 
    { threshold: 7, xp: 60, tier: 'gold', name: 'Eğlence Maratonu' }, 
    { threshold: 15, xp: 120, tier: 'platinum', name: 'Komedi Kulübü' }
  ]},
  { id: 'movie_genre_drama', name: 'Dram Filmleri', description: 'Dram türünde toplam {threshold} film izle.', icon: 'Drama', hidden: false, secret: false, category: 'Tür (Film)', tiers: [
    { threshold: 5, xp: 10, tier: 'bronze', name: 'Gözü Yaşlı' }, 
    { threshold: 15, xp: 25, tier: 'silver', name: 'Mendil Tüketen' }, 
    { threshold: 30, xp: 60, tier: 'gold', name: 'Drama Ustası' }, 
    { threshold: 50, xp: 120, tier: 'platinum', name: 'Duygu Selinde Yüzen' }
  ]},
  { id: 'series_genre_drama', name: 'Dram Dizileri', description: 'Dram türünde toplam {threshold} farklı dizi izle.', icon: 'Drama', hidden: false, secret: false, category: 'Tür (Dizi)', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'İlk Gözyaşı' }, 
    { threshold: 3, xp: 25, tier: 'silver', name: 'Melodram' }, 
    { threshold: 7, xp: 60, tier: 'gold', name: 'Derin Karakterler' }, 
    { threshold: 15, xp: 120, tier: 'platinum', name: 'Trajedi Uzmanı' }
  ]},
  { id: 'movie_genre_horror', name: 'Korku Filmleri', description: 'Korku türünde toplam {threshold} film izle.', icon: 'Ghost', hidden: false, secret: false, category: 'Tür (Film)', tiers: [
    { threshold: 5, xp: 10, tier: 'bronze', name: 'Ürkmüş' }, 
    { threshold: 15, xp: 25, tier: 'silver', name: 'Çığlık Atan' }, 
    { threshold: 30, xp: 60, tier: 'gold', name: 'Korku Meraklısı' }, 
    { threshold: 50, xp: 120, tier: 'platinum', name: 'Kabuslarda Yaşayan' }
  ]},
  { id: 'series_genre_horror', name: 'Korku Dizileri', description: 'Korku türünde toplam {threshold} farklı dizi izle.', icon: 'Ghost', hidden: false, secret: false, category: 'Tür (Dizi)', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'Karanlık Başlangıç' }, 
    { threshold: 3, xp: 25, tier: 'silver', name: 'Gece Nöbeti' }, 
    { threshold: 7, xp: 60, tier: 'gold', name: 'Gerilim Hattı' }, 
    { threshold: 15, xp: 120, tier: 'platinum', name: 'Korkusuz' }
  ]},
  { id: 'movie_genre_scifi', name: 'Bilim Kurgu Filmleri', description: 'Bilim Kurgu türünde toplam {threshold} film izle.', icon: 'Rocket', hidden: false, secret: false, category: 'Tür (Film)', tiers: [
    { threshold: 5, xp: 10, tier: 'bronze', name: 'Uzay Yolcusu' }, 
    { threshold: 15, xp: 25, tier: 'silver', name: 'Zaman Yolcusu' }, 
    { threshold: 30, xp: 60, tier: 'gold', name: 'Bilim Kurgu Kaşifi' }, 
    { threshold: 50, xp: 120, tier: 'platinum', name: 'Evrenler Arası Gezgin' }
  ]},
  { id: 'series_genre_scifi', name: 'Bilim Kurgu Dizileri', description: 'Bilim Kurgu türünde toplam {threshold} farklı dizi izle.', icon: 'Rocket', hidden: false, secret: false, category: 'Tür (Dizi)', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'İlk Temas' }, 
    { threshold: 3, xp: 25, tier: 'silver', name: 'Galaktik İzleyici' }, 
    { threshold: 7, xp: 60, tier: 'gold', name: 'Paralel Evren' }, 
    { threshold: 15, xp: 120, tier: 'platinum', name: 'Boyut Atlayan' }
  ]},

  // --- GENEL Puanlama ve Devamlılık Başarımları ---
  { id: 'perfect_rating', name: 'Mükemmellikçi', description: 'İzlediğin {threshold} farklı yapıma 10 tam puan ver.', icon: 'Crown', hidden: false, secret: false, category: 'Puanlama', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'İlk Başyapıt' }, 
    { threshold: 5, xp: 25, tier: 'silver', name: 'Seçkin Zevk' }, 
    { threshold: 10, xp: 60, tier: 'gold', name: 'Mükemmellikçi' }, 
    { threshold: 25, xp: 150, tier: 'platinum', name: 'Şaheser Avcısı' }, 
    { threshold: 50, xp: 350, tier: 'diamond', name: 'Kusursuzluk Elçisi' }
  ]},
  { id: 'high_rating', name: 'Yüksek Standartlar', description: 'İzlediğin {threshold} farklı yapıma 9 veya 9.5 puan ver.', icon: 'Star', hidden: false, secret: false, category: 'Puanlama', tiers: [
    { threshold: 5, xp: 10, tier: 'bronze', name: 'İyi İzleyici' }, 
    { threshold: 10, xp: 25, tier: 'silver', name: 'Seçici Göz' }, 
    { threshold: 25, xp: 60, tier: 'gold', name: 'Yüksek Standartlar' }, 
    { threshold: 50, xp: 150, tier: 'platinum', name: 'Kalite Kontrolörü' }
  ]},
  { id: 'low_rating', name: 'Kötü İzlenim', description: 'İzlediğin {threshold} farklı yapıma 3 veya daha düşük puan ver.', icon: 'ThumbsDown', hidden: false, secret: false, category: 'Puanlama', tiers: [
    { threshold: 1, xp: 5, tier: 'bronze', name: 'Hayal Kırıklığı' }, 
    { threshold: 5, xp: 15, tier: 'silver', name: 'Kötü İzlenim' }, 
    { threshold: 10, xp: 40, tier: 'gold', name: 'Vakit Kaybı Uzmanı' },
    { threshold: 25, xp: 100, tier: 'platinum', name: 'Acımasız Eleştirmen' }, 
    { threshold: 50, xp: 250, tier: 'diamond', name: 'Nefret İmparatorluğu' }
  ]},
  { id: 'first_rating', name: 'İlk Puan', description: 'İlk defa bir yapımı puanla.', icon: 'Heart', hidden: true, secret: false, category: 'Puanlama', tiers: [
    { threshold: 1, xp: 5, tier: 'bronze', name: 'İlk Puan' }
  ]},
  { id: 'strict_critic', name: 'Sıkı Eleştirmen', description: '{threshold} farklı yapıma hem puan ver hem de not yaz.', icon: 'PenTool', hidden: false, secret: false, category: 'Puanlama', tiers: [
    { threshold: 5, xp: 15, tier: 'bronze', name: 'Hevesli Yorumcu' }, 
    { threshold: 15, xp: 40, tier: 'silver', name: 'Sıkı Eleştirmen' }, 
    { threshold: 30, xp: 90, tier: 'gold', name: 'Usta Eleştirmen' },
    { threshold: 50, xp: 150, tier: 'platinum', name: 'Otoriter Kalem' }, 
    { threshold: 100, xp: 350, tier: 'diamond', name: 'Sinema Otoritesi' }
  ]},
  { id: 'season_complete', name: 'Sezon Fatihi', description: 'Bir dizinin tüm bölümlerini bitirerek toplam {threshold} sezon tamamla.', icon: 'Trophy', hidden: false, secret: false, category: 'Diziler', tiers: [
    { threshold: 1, xp: 15, tier: 'bronze', name: 'İlk Final' }, 
    { threshold: 5, xp: 40, tier: 'silver', name: 'Sezon Avcısı' }, 
    { threshold: 10, xp: 90, tier: 'gold', name: 'Sezon Fatihi' }, 
    { threshold: 25, xp: 200, tier: 'platinum', name: 'Dizi Gurusu' }, 
    { threshold: 50, xp: 450, tier: 'diamond', name: 'Sezonların Efendisi' }
  ]},
  { id: 'total_watch', name: 'Seyirci', description: 'Toplam {threshold} farklı yapım izle.', icon: 'Eye', hidden: false, secret: false, category: 'Genel', tiers: [
    { threshold: 10, xp: 10, tier: 'bronze', name: 'Yeni Seyirci' }, 
    { threshold: 50, xp: 30, tier: 'silver', name: 'Düzenli İzleyici' }, 
    { threshold: 100, xp: 75, tier: 'gold', name: 'Tecrübeli Seyirci' }, 
    { threshold: 250, xp: 180, tier: 'platinum', name: 'Ekran Uzmanı' }, 
    { threshold: 500, xp: 450, tier: 'diamond', name: 'Hayatı Ekran Olan' }
  ]},
  { id: 'collection_complete', name: 'Evren Tamamlayıcı', description: 'İçindeki tüm filmleri izleyerek {threshold} farklı koleksiyonu eksiksiz bitir.', icon: 'Boxes', hidden: true, secret: false, category: 'Koleksiyon', tiers: [
    { threshold: 1, xp: 20, tier: 'bronze', name: 'Seri İzleyici' }, 
    { threshold: 3, xp: 50, tier: 'silver', name: 'Seri Katili' }, 
    { threshold: 5, xp: 100, tier: 'gold', name: 'Evren Tamamlayıcı' }, 
    { threshold: 10, xp: 250, tier: 'platinum', name: 'Hikaye Hakimi' }
  ]},
  { id: 'genre_explorer', name: 'Tür Kaşifi', description: '{threshold} farklı türde yapım keşfet.', icon: 'Compass', hidden: false, secret: false, category: 'Genel', tiers: [
    { threshold: 3, xp: 10, tier: 'bronze', name: 'Çeşitlilik Arayan' }, 
    { threshold: 5, xp: 20, tier: 'silver', name: 'Tür Kaşifi' }, 
    { threshold: 8, xp: 45, tier: 'gold', name: 'Sınır Tanımayan' }, 
    { threshold: 12, xp: 120, tier: 'platinum', name: 'Türlerin Efendisi' }
  ]},
  { id: 'note_taker', name: 'Not Tutucu', description: 'İzlediğin {threshold} farklı yapıma not ekle.', icon: 'StickyNote', hidden: false, secret: false, category: 'Genel', tiers: [
    { threshold: 1, xp: 5, tier: 'bronze', name: 'İlk Not' }, 
    { threshold: 10, xp: 15, tier: 'silver', name: 'Not Tutucu' }, 
    { threshold: 25, xp: 40, tier: 'gold', name: 'Sine-Günlük Yazarı' }, 
    { threshold: 50, xp: 100, tier: 'platinum', name: 'Sinema Tarihçisi' }
  ]},
  { id: 'night_owl', name: 'Gece Kuşu', description: 'Gece 00:00 ile 05:00 saatleri arasında toplam {threshold} izleme yap.', icon: 'Moon', hidden: false, secret: false, category: 'Alışkanlık', tiers: [
    { threshold: 1, xp: 10, tier: 'bronze', name: 'Gececi' }, 
    { threshold: 10, xp: 25, tier: 'silver', name: 'Gece Kuşu' }, 
    { threshold: 30, xp: 60, tier: 'gold', name: 'Uykusuzluk' }, 
    { threshold: 50, xp: 150, tier: 'platinum', name: 'Vampir Yaşamı' }
  ]},
  { id: 'weekend_watcher', name: 'Hafta Sonu Keyfi', description: 'Sadece Cumartesi ve Pazar günleri toplam {threshold} izleme yap.', icon: 'Sofa', hidden: false, secret: false, category: 'Alışkanlık', tiers: [
    { threshold: 5, xp: 15, tier: 'bronze', name: 'Cumartesi Gecesi' }, 
    { threshold: 20, xp: 50, tier: 'silver', name: 'Hafta Sonu Keyfi' }, 
    { threshold: 50, xp: 120, tier: 'gold', name: 'Tatil İzleyicisi' },
    { threshold: 100, xp: 250, tier: 'platinum', name: 'Hafta Sonu Savaşçısı' }, 
    { threshold: 250, xp: 500, tier: 'diamond', name: 'Sadece Hafta Sonu Yaşayan' }
  ]},
  { id: 'marathon', name: 'Maratoncu', description: 'Tek bir günde 3 veya daha fazla yapım izleme serisini {threshold} farklı günde gerçekleştir.', icon: 'Flame', hidden: false, secret: false, category: 'Alışkanlık', tiers: [
    { threshold: 1, xp: 15, tier: 'bronze', name: 'Üçleme Gecesi' }, 
    { threshold: 5, xp: 40, tier: 'silver', name: 'Küçük Maraton' }, 
    { threshold: 10, xp: 90, tier: 'gold', name: 'Maratoncu' }, 
    { threshold: 25, xp: 200, tier: 'platinum', name: 'Göz Kırpmayan' }
  ]},

  // --- EFSANE VE GİZLİ BAŞARIMLAR (Progress Bar Uyumlu) ---
  { id: 'secret_critic', name: 'Acımasız Yargıç', description: 'Tam {threshold} farklı yapıma çok düşük (1 veya 2) puanlar ver.', icon: 'Skull', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 10, xp: 100, tier: 'diamond', name: 'Acımasız Yargıç' }] },
  { id: 'secret_perfectionist', name: 'Kusursuzluk Takıntısı', description: 'Tam {threshold} farklı yapıma 10 tam puan ver.', icon: 'Sparkles', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 100, xp: 150, tier: 'diamond', name: 'Kusursuzluk Takıntısı' }] },
  { id: 'secret_binge', name: 'Dizi Koması', description: 'Aynı gün içinde tam {threshold} bölüm dizi izle.', icon: 'ZapOff', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 10, xp: 200, tier: 'diamond', name: 'Dizi Koması' }] },
  { id: 'sinevia_legend', name: 'Sinevia Efsanesi', description: 'Sinevia evreninin gerçek yöneticisi ol! Toplamda {threshold} yapım izle.', icon: 'Database', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 1000, xp: 1000, tier: 'diamond', name: 'Sinevia Efsanesi' }] },
  { id: 'caveman', name: 'Mağara Adamı', description: 'Tam {threshold} gün boyunca, her gün en az 5 yapım izle.', icon: 'MonitorX', hidden: false, secret: false, category: 'Alışkanlık', tiers: [{ threshold: 7, xp: 750, tier: 'diamond', name: 'Mağara Adamı' }] },
  { id: 'hater', name: 'Nefret Kusucu', description: 'Toplam {threshold} yapıma 1, 1.5 veya 2 puan vererek ne kadar zor beğendiğini göster.', icon: 'Frown', hidden: false, secret: false, category: 'Puanlama', tiers: [{ threshold: 20, xp: 150, tier: 'gold', name: 'Nefret Kusucu' }] },
  { id: 'epic_writer', name: 'Destan Yazarı', description: 'Tek bir yapım için 5000 karakterden uzun bir inceleme yaz.', icon: 'ScrollText', hidden: false, secret: false, category: 'Genel', tiers: [{ threshold: 1, xp: 500, tier: 'diamond', name: 'Destan Yazarı' }] },
  { id: 'ghost_viewer', name: 'Hayalet İzleyici', description: 'İzlediğin {threshold} yapıma hiçbir puan vermeden ve not yazmadan geç.', icon: 'Ghost', hidden: false, secret: false, category: 'Genel', tiers: [{ threshold: 50, xp: 75, tier: 'silver', name: 'Hayalet İzleyici' }] },
  { id: 'trash_lover', name: 'Çöp Sevdalısı', description: 'Puanı 3\'ün altında olan çok kötü {threshold} yapıma uzun incelemeler yaz.', icon: 'Trash2', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 10, xp: 300, tier: 'platinum', name: 'Çöp Sevdalısı' }] },
  { id: 'polarization', name: 'Kutuplaşma', description: 'Listende 20 adet 10 puanlık, 20 adet de 1-2 puanlık yapım bulundur.', icon: 'Magnet', hidden: false, secret: false, category: 'Puanlama', tiers: [{ threshold: 1, xp: 400, tier: 'platinum', name: 'Kutuplaşma' }] },
  { id: 'new_year_lonely', name: 'Yılbaşı Yalnızlığı', description: 'Tam 31 Aralık gecesi saat 00:00 ile 01:00 arasında izleme yap.', icon: 'PartyPopper', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 1, xp: 600, tier: 'diamond', name: 'Yılbaşı Yalnızlığı' }] },
  { id: 'cinephile', name: 'Sinefilm', description: 'Hiçbir diziye bulaşmadan, izleme geçmişinde tam {threshold} film biriktir.', icon: 'Film', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 100, xp: 400, tier: 'platinum', name: 'Sinefilm' }] },
  { id: 'short_day_profit', name: 'Kısa Günün Kârı', description: 'Sadece tek bir gün içinde 3 farklı film bitir.', icon: 'Sun', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 1, xp: 50, tier: 'bronze', name: 'Kısa Günün Kârı' }] },
  { id: 'selective_critic', name: 'Seçici Eleştirmen', description: 'Toplam 50 farklı filme puan ver ama hiçbirine 10 tam puan verme.', icon: 'Search', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 1, xp: 250, tier: 'gold', name: 'Seçici Eleştirmen' }] },
  { id: 'weekend_cinema', name: 'Hafta Sonu Sineması', description: 'Sadece bir hafta sonu (Cumartesi-Pazar) içinde 5 film bitir.', icon: 'Sofa', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 1, xp: 150, tier: 'gold', name: 'Hafta Sonu Sineması' }] },
  { id: 'episode_monster', name: 'Bölüm Canavarı', description: 'Toplamda {threshold} dizi bölümü izlemiş ol.', icon: 'MonitorPlay', hidden: false, secret: false, category: 'Diziler', tiers: [{ threshold: 500, xp: 500, tier: 'diamond', name: 'Bölüm Canavarı' }] },
  { id: 'patience_stone', name: 'Sabır Taşı', description: 'En az 8 sezonu olan uzun bir dizinin tüm bölümlerini eksiksiz bitir.', icon: 'Hourglass', hidden: false, secret: false, category: 'Diziler', tiers: [{ threshold: 1, xp: 350, tier: 'platinum', name: 'Sabır Taşı' }] },
  { id: 'loyalty_test', name: 'Sadakat Testi', description: 'Aynı diziden her gün en az 1 bölüm olmak şartıyla 10 gün peş peşe izle.', icon: 'HeartHandshake', hidden: false, secret: false, category: 'Diziler', tiers: [{ threshold: 1, xp: 150, tier: 'silver', name: 'Sadakat Testi' }] },
  { id: 'break_taker', name: 'Ara Veren', description: 'Bir dizinin herhangi iki bölümü arasında en az 30 gün boşluk bırak.', icon: 'Coffee', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 1, xp: 300, tier: 'platinum', name: 'Ara Veren' }] },
  { id: 'lost_colony', name: 'Kayıp Koloni', description: 'Bir dizinin iki bölümü arasında tam 365 gün boşluk bırak.', icon: 'Milestone', hidden: false, secret: false, category: 'Diziler', tiers: [{ threshold: 1, xp: 300, tier: 'platinum', name: 'Kayıp Koloni' }] },
  { id: 'morning_sweet', name: 'Sabah Şekeri', description: 'Sabah 06:00 ile 09:00 saatleri arasında tam {threshold} farklı film bitir.', icon: 'Sunrise', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 5, xp: 50, tier: 'bronze', name: 'Sabah Şekeri' }] },
  { id: 'nostalgia_wind', name: 'Nostalji Rüzgarı', description: 'Yapım yılı 1980 ve öncesi olan tam {threshold} klasik film izle.', icon: 'Radio', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 20, xp: 200, tier: 'gold', name: 'Nostalji Rüzgarı' }] },
  { id: 'universe_conqueror', name: 'Evren Fatihi', description: 'İçinde en az 3 film barındıran {threshold} farklı koleksiyonu eksiksiz bitir.', icon: 'Globe2', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 5, xp: 350, tier: 'platinum', name: 'Evren Fatihi' }] },
  { id: 'final_phobia', name: 'Final Fobisi', description: 'Bir dizinin final bölümünü tam 90 gün boyunca izlenmemiş bırak.', icon: 'ShieldQuestion', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 1, xp: 150, tier: 'gold', name: 'Final Fobisi' }] },
  { id: 'delayed_goodbye', name: 'Ertelenmiş Veda', description: '90 gün boyunca beklettiğin o final bölümünü nihayet izle.', icon: 'DoorOpen', hidden: true, secret: true, category: 'Gizli', tiers: [{ threshold: 1, xp: 200, tier: 'platinum', name: 'Ertelenmiş Veda' }] },
  { id: 'half_century_series', name: 'Yarım Asırlık Dizi', description: 'Toplam bölüm sayısı 100\'ü geçen devasa bir diziyi bitir.', icon: 'Library', hidden: false, secret: false, category: 'Diziler', tiers: [{ threshold: 1, xp: 150, tier: 'gold', name: 'Yarım Asırlık Dizi' }] },
  { id: 'light_speed', name: 'Işık Hızı', description: 'Bir yapıma eklendiği ilk 24 saat içinde puan ver ve bunu {threshold} kez yap.', icon: 'Zap', hidden: false, secret: false, category: 'Genel', tiers: [{ threshold: 20, xp: 500, tier: 'platinum', name: 'Işık Hızı' }] },
  { id: 'color_palette', name: 'Renk Paleti', description: 'Tam {threshold} farklı puan değerini (0.5, 1, 1.5...) en az bir kez kullan.', icon: 'Palette', hidden: false, secret: false, category: 'Puanlama', tiers: [{ threshold: 15, xp: 150, tier: 'silver', name: 'Renk Paleti' }] },
  { id: 'caps_lock', name: 'Büyük Harf Sendromu', description: 'Bir yapıma yazdığın notun tamamını BÜYÜK HARFLERLE yaz.', icon: 'Keyboard', hidden: false, secret: false, category: 'Genel', tiers: [{ threshold: 1, xp: 50, tier: 'bronze', name: 'Büyük Harf Sendromu' }] },
  { id: 'spider_sense', name: 'Örümcek Hisleri', description: 'Çıkış tarihi henüz gelmemiş (gelecek bir tarihteki) filmi takip listesine ekle.', icon: 'Eye', hidden: false, secret: false, category: 'Filmler', tiers: [{ threshold: 1, xp: 75, tier: 'bronze', name: 'Örümcek Hisleri' }] },

  // --- SÜRE (RUNTIME) BAŞARIMLARI ---
  { id: 'time_bender', name: 'Zaman Bükücü', description: 'İzlediğin filmlerin toplam süresi {threshold} dakikaya ulaştı.', icon: 'Hourglass', hidden: false, secret: false, category: 'Filmler', tiers: [
    { threshold: 1000, xp: 100, tier: 'bronze', name: 'Vakit Geçirici' }, 
    { threshold: 5000, xp: 250, tier: 'silver', name: 'Film Mesaisi' }, 
    { threshold: 10000, xp: 500, tier: 'gold', name: 'Zaman Bükücü' }, 
    { threshold: 25000, xp: 1000, tier: 'platinum', name: 'Sinemada Yaşayan' }, 
    { threshold: 50000, xp: 2500, tier: 'diamond', name: 'Zamanın Efendisi' }
  ]},
  { id: 'epic_watcher', name: 'Yönetmenin Vizyonu', description: 'Süresi 180 dakikayı (3 saat) aşan tam {threshold} epik film izledin.', icon: 'Clapperboard', hidden: false, secret: false, category: 'Filmler', tiers: [
    { threshold: 1, xp: 50, tier: 'bronze', name: 'Epik Giriş' }, 
    { threshold: 5, xp: 150, tier: 'silver', name: 'Sabırlı Seyirci' }, 
    { threshold: 15, xp: 300, tier: 'gold', name: 'Yönetmenin Vizyonu' }, 
    { threshold: 30, xp: 600, tier: 'platinum', name: 'Çelik İradeli' }, 
    { threshold: 50, xp: 1200, tier: 'diamond', name: 'Destansı Seyirci' }
  ]},
  { id: 'short_sweet', name: 'Çerezlik Niyetine', description: 'Süresi 90 dakikanın altında olan tam {threshold} çerezlik film izledin.', icon: 'Popcorn', hidden: false, secret: false, category: 'Filmler', tiers: [
    { threshold: 5, xp: 50, tier: 'bronze', name: 'Hızlı Tüketici' }, 
    { threshold: 15, xp: 150, tier: 'silver', name: 'Çerezlik Niyetine' }, 
    { threshold: 30, xp: 300, tier: 'gold', name: 'Tempo Bağımlısı' }, 
    { threshold: 50, xp: 500, tier: 'platinum', name: 'Kısa ve Öz' }, 
    { threshold: 100, xp: 1000, tier: 'diamond', name: 'Zaman Gezgini' }
  ]},
  { id: 'couch_potato', name: 'Koltuk Sevdalısı', description: 'Aynı gün içinde toplam 300 dakikadan fazla film izlediğin gün sayısı {threshold} oldu.', icon: 'Armchair', hidden: false, secret: false, category: 'Alışkanlık', tiers: [
    { threshold: 1, xp: 100, tier: 'bronze', name: 'Günlük Kaçamak' }, 
    { threshold: 3, xp: 250, tier: 'silver', name: 'Hafta Sonu Kampı' }, 
    { threshold: 7, xp: 500, tier: 'gold', name: 'Koltuk Sevdalısı' }, 
    { threshold: 15, xp: 1000, tier: 'platinum', name: 'Ekran Bağımlısı' }, 
    { threshold: 30, xp: 2000, tier: 'diamond', name: 'Güneşi Görmeyen' }
  ]}
];

export const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

export const TIER_COLORS: Record<string, { bg: string; text: string; border: string; label: string; icon: string }> = {
  bronze: { bg: 'bg-orange-600', text: 'text-orange-100', border: 'border-orange-500', label: 'Bronz', icon: 'Medal' },
  silver: { bg: 'bg-gray-400', text: 'text-gray-100', border: 'border-gray-300', label: 'Gümüş', icon: 'Award' },
  gold: { bg: 'bg-yellow-500', text: 'text-yellow-950', border: 'border-yellow-400', label: 'Altın', icon: 'Crown' },
  platinum: { bg: 'bg-cyan-300', text: 'text-cyan-950', border: 'border-cyan-200', label: 'Platin', icon: 'Sparkles' },
  diamond: { bg: 'bg-sky-400', text: 'text-sky-950', border: 'border-sky-300', label: 'Elmas', icon: 'Gem' },
};