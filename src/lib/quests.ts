export type QuestRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  rarity: QuestRarity;
  icon: string;
  xpReward: number;
}

export const RARITY_STYLES: Record<QuestRarity, { color: string; border: string; bg: string; shadow: string }> = {
  common: { color: 'text-ink-200', border: 'border-ink-400/50', bg: 'bg-ink-800/40', shadow: 'shadow-ink-500/20' },
  rare: { color: 'text-azure-400', border: 'border-azure-500/50', bg: 'bg-azure-500/10', shadow: 'shadow-azure-500/30' },
  epic: { color: 'text-violet-400', border: 'border-violet-500/50', bg: 'bg-violet-500/10', shadow: 'shadow-violet-500/40' },
  legendary: { color: 'text-gold-400', border: 'border-gold-500/60', bg: 'bg-gold-500/15', shadow: 'shadow-[0_0_20px_rgba(245,158,11,0.5)]' },
  mythic: { color: 'text-red-500', border: 'border-red-600/70', bg: 'bg-red-600/20', shadow: 'shadow-[0_0_25px_rgba(220,38,38,0.6)]' },
};

// TOPLAM 50 GÖREV: 20 Common, 15 Rare, 8 Epic, 5 Legendary, 2 Mythic
export const QUEST_DEFS: QuestDef[] = [
  // --- YAYGIN (COMMON) - 20 Görev ---
  { id: 'c_picky_taste', title: 'Seçici Zevk', description: 'Bir filme küsuratlı olarak tam "7.5" veya "8.5" puan ver.', rarity: 'common', icon: '⚖️', xpReward: 40 },
  { id: 'c_short_movie', title: 'Çerezlik Kaçamak', description: 'Süresi 90 dakikanın altında olan bir filmi izle.', rarity: 'common', icon: '🍿', xpReward: 50 },
  { id: 'c_action_fan', title: 'İlk Kan', description: 'Türü "Aksiyon" olan bir film izle ve puanla.', rarity: 'common', icon: '🥊', xpReward: 40 },
  { id: 'c_comedy_fan', title: 'Kahkaha Tufanı', description: 'Türü "Komedi" olan bir film izle.', rarity: 'common', icon: '😂', xpReward: 40 },
  { id: 'c_drama_fan', title: 'Peçete Lütfen', description: 'Türü "Dram" olan bir film bitir.', rarity: 'common', icon: '💧', xpReward: 40 },
  { id: 'c_sci_fi_fan', title: 'Uzay Yolcusu', description: 'Türü "Bilim Kurgu" olan bir film bitir.', rarity: 'common', icon: '🚀', xpReward: 40 },
  { id: 'c_documentary', title: 'Gerçeklik Payı', description: 'Bir "Belgesel" bitir.', rarity: 'common', icon: '🌍', xpReward: 40 },
  { id: 'c_animation', title: 'Çizgilerin Gücü', description: 'Bir Animasyon filmi bitir.', rarity: 'common', icon: '🎨', xpReward: 40 },
  { id: 'c_masterpiece', title: 'Başyapıt', description: 'İzlediğin bir filme tam 10 puan ver.', rarity: 'common', icon: '🏆', xpReward: 50 },
  { id: 'c_trash', title: 'Zaman Kaybı', description: 'İzlediğin bir filme 1 ile 3 arası puan ver.', rarity: 'common', icon: '🗑️', xpReward: 50 },
  { id: 'c_mediocre', title: 'Puan Cimi', description: 'Bir filme 5.0 ile 6.0 arası (ortalama) puan ver.', rarity: 'common', icon: '😐', xpReward: 40 },
  { id: 'c_detailer', title: 'Detaycı', description: 'Bir filme en az 3 farklı "İnceleme Etiketi" (Review Tag) ekle.', rarity: 'common', icon: '🏷️', xpReward: 45 },
  { id: 'c_writer', title: 'Eleştirmen Çırağı', description: 'Bir filmin notlar kısmına en az 50 karakterlik inceleme yaz.', rarity: 'common', icon: '✍️', xpReward: 50 },
  { id: 'c_old_movie', title: 'Eski Toprak', description: 'Çıkış yılı 2000 öncesi olan bir film izle.', rarity: 'common', icon: '📼', xpReward: 50 },
  { id: 'c_new_movie', title: 'Taze Çıkmış', description: 'İçinde bulunduğumuz yıla ait yeni bir film izle.', rarity: 'common', icon: '✨', xpReward: 50 },
  { id: 'c_weekend', title: 'Hafta Sonu', description: 'Cumartesi veya Pazar günü bir film bitir.', rarity: 'common', icon: '🎉', xpReward: 40 },
  { id: 'c_weekday', title: 'Hafta İçi Sendromu', description: 'Pazartesi günü bir film bitir.', rarity: 'common', icon: '☕', xpReward: 40 },
  { id: 'c_short_series', title: 'Hızlı Başlangıç', description: 'Süresi 30 dakikanın altında olan bir dizi bölümü izle.', rarity: 'common', icon: '⏱️', xpReward: 40 },
  { id: 'c_series_pilot', title: 'İlk Bölüm', description: 'Herhangi bir dizinin 1. sezon 1. bölümünü izle.', rarity: 'common', icon: '🎬', xpReward: 40 },
  { id: 'c_series_double', title: 'Isınma Turu', description: 'Aynı gün içinde peş peşe 2 dizi bölümü izle.', rarity: 'common', icon: '📺', xpReward: 50 },

  // --- NADİR (RARE) - 15 Görev ---
  { id: 'r_night_watch', title: 'Gece Nöbeti', description: 'Gece 01:00 ile 05:00 saatleri arasında bir film bitir.', rarity: 'rare', icon: '🦉', xpReward: 100 },
  { id: 'r_two_hours', title: 'İki Saatlik Serüven', description: 'Süresi tam olarak 120-130 dk arası olan bir film bitir.', rarity: 'rare', icon: '⌛', xpReward: 100 },
  { id: 'r_tarantino', title: 'Tarantino Sendromu', description: '"Suç" veya "Gerilim" türünde bir film izle ve 8+ puan ver.', rarity: 'rare', icon: '🔫', xpReward: 120 },
  { id: 'r_classic', title: 'Yarım Asırlık', description: 'Çıkış yılı 1970 ile 1980 arasında olan kült bir film izle.', rarity: 'rare', icon: '📻', xpReward: 110 },
  { id: 'r_mystery_solver', title: 'Gizem Çözücü', description: 'Gizem türünde bir film izleyip uzun (100+ karakter) not yaz.', rarity: 'rare', icon: '🕵️', xpReward: 110 },
  { id: 'r_consistent', title: 'İstikrarlı İzleyici', description: '3 gün üst üste (Seri) en az 1 içerik izle.', rarity: 'rare', icon: '📈', xpReward: 150 },
  { id: 'r_variety', title: 'Çeşitlilik İyidir', description: 'Aynı gün içinde 2 tamamen farklı türde film izle.', rarity: 'rare', icon: '🎭', xpReward: 120 },
  { id: 'r_series_wolf', title: 'Dizi Kurdu', description: 'Bir dizinin tam 3 bölümünü aynı gün içinde izle.', rarity: 'rare', icon: '🐺', xpReward: 125 },
  { id: 'r_friday_joy', title: 'Cuma Neşesi', description: 'Cuma akşamı 20:00 ile 23:59 arası bir film bitir.', rarity: 'rare', icon: '🍕', xpReward: 100 },
  { id: 'r_double_action', title: 'Aksiyon Gecesi', description: 'Aynı gün içinde 2 Aksiyon filmi bitir.', rarity: 'rare', icon: '🔥', xpReward: 120 },
  { id: 'r_double_horror', title: 'Korku Gecesi', description: 'Aynı gün içinde 2 Korku filmi bitir.', rarity: 'rare', icon: '👻', xpReward: 120 },
  { id: 'r_second_chance', title: 'İkinci Şans', description: 'Daha önce 5\'in altında puan verdiğin bir filme tekrar şans ver (Aynı gün 2. çöp film).', rarity: 'rare', icon: '♻️', xpReward: 100 },
  { id: 'r_long_movie', title: 'Gözler Yoruldu', description: 'Süresi 150 dakikayı (2.5 Saat) geçen bir film izle.', rarity: 'rare', icon: '👁️', xpReward: 110 },
  { id: 'r_perfect_pair', title: 'Kusursuz İkili', description: 'Aynı gün izlediğin 2 filme de 9 veya 10 tam puan ver.', rarity: 'rare', icon: '🥂', xpReward: 130 },
  { id: 'r_indecisive', title: 'Kararsız', description: 'Bir filmin puanını izledikten sonra 3 kez değiştir.', rarity: 'rare', icon: '🤔', xpReward: 100 },

  // --- DESTANSI (EPIC) - 8 Görev ---
  { id: 'e_series_killer', title: 'Dizi Katili', description: 'Herhangi bir dizinin peş peşe tam 5 bölümünü aynı gün bitir.', rarity: 'epic', icon: '☠️', xpReward: 300 },
  { id: 'e_culture_envoy', title: 'Kültür Elçisi', description: 'Aynı gün içinde 3 tamamen farklı türde film bitir.', rarity: 'epic', icon: '🌐', xpReward: 280 },
  { id: 'e_heavy_novel', title: 'Ağır Roman', description: 'Bir filmin notlar kısmına en az 1000 karakterlik detaylı bir inceleme yaz.', rarity: 'epic', icon: '📜', xpReward: 300 },
  { id: 'e_old_school', title: 'Gerçek Klasik', description: '1960 yılından daha eski bir film izle.', rarity: 'epic', icon: '🎩', xpReward: 270 },
  { id: 'e_marathon_3', title: 'Üçlü Kombo', description: 'Aynı gün içinde arka arkaya 3 film bitir.', rarity: 'epic', icon: '🎳', xpReward: 350 },
  { id: 'e_perfect_3', title: 'Altın Seçki', description: 'Aynı gün içinde izlediğin 3 filme de 8 ve üzeri puan ver.', rarity: 'epic', icon: '👑', xpReward: 300 },
  { id: 'e_weekday_warrior', title: 'Hafta İçi Savaşçısı', description: 'Hafta içi 5 gün (Pzt-Cuma) her gün 1 film izleme serisi yap.', rarity: 'epic', icon: '🛡️', xpReward: 400 },
  { id: 'e_season_finale', title: 'Sezon Finali', description: 'Bir dizinin tam bir sezonunun son bölümünü izle (Final).', rarity: 'epic', icon: '🏁', xpReward: 250 },

  // --- EFSANEVİ (LEGENDARY) - 5 Görev ---
  { id: 'l_directors_cut', title: 'Yönetmenin Kesimi', description: 'Süresi 3 saati (180 dk) aşan bir epik filmi bitir.', rarity: 'legendary', icon: '🎞️', xpReward: 600 },
  { id: 'l_weekend_massacre', title: 'Hafta Sonu Katliamı', description: 'Sadece Cuma, Cumartesi ve Pazar günleri içinde toplam 4 film bitir.', rarity: 'legendary', icon: '⚔️', xpReward: 750 },
  { id: 'l_flawless_selection', title: 'Kusursuz Seçki', description: 'Araya kötü film girmeden, arka arkaya izlediğin 4 filme 9+ puan ver.', rarity: 'legendary', icon: '💎', xpReward: 800 },
  { id: 'l_sinevia_god', title: 'Sinevia Tanrısı', description: 'Tam 7 gün boyunca kesintisiz "Günlük Seri (Streak)" yap.', rarity: 'legendary', icon: '⚡', xpReward: 1000 },
  { id: 'l_marathon_5', title: 'Gözler Kanıyor', description: 'Aynı gün içinde arka arkaya tam 5 film bitir.', rarity: 'legendary', icon: '🧛', xpReward: 1200 },

  // --- GİZLİ (MYTHIC - BOSS) - 2 Görev ---
  { id: 'm_hater', title: 'Hater (Nefret Kusan)', description: 'Arka arkaya izlediğin 3 filme de 3 ve altı puan verdin!', rarity: 'mythic', icon: '🧨', xpReward: 500 },
  { id: 'm_impatient', title: 'Sabırsız', description: 'Sayacı başlayan bir filmi ilk 15 dakikasında iptal ettin!', rarity: 'mythic', icon: '🏃', xpReward: 500 },
];