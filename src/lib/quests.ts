import { createElement } from 'react';
import type { FC } from 'react';

type QuestRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

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
  { id: 'c_picky_taste', title: 'Hassas Kalibrasyon', description: 'Bir filme küsuratlı olarak tam "7.5" veya "8.5" puan ver.', rarity: 'common', icon: '⚖️', xpReward: 40 },
  { id: 'c_short_movie', title: 'Kompakt Kurgu', description: 'Süresi 90 dakikanın altında olan bir filmi izle.', rarity: 'common', icon: '🍿', xpReward: 50 },
  { id: 'c_action_fan', title: 'Yüksek Oktan', description: 'Türü "Aksiyon" olan bir film izle ve puanla.', rarity: 'common', icon: '🥊', xpReward: 40 },
  { id: 'c_comedy_fan', title: 'Mizah Dozu', description: 'Türü "Komedi" olan bir film izle.', rarity: 'common', icon: '😂', xpReward: 40 },
  { id: 'c_drama_fan', title: 'Kadife Trajedi', description: 'Türü "Dram" olan bir film bitir.', rarity: 'common', icon: '💧', xpReward: 40 },
  { id: 'c_sci_fi_fan', title: 'Ufuk Ötesi', description: 'Türü "Bilim Kurgu" olan bir film bitir.', rarity: 'common', icon: '🚀', xpReward: 40 },
  { id: 'c_documentary', title: 'Hakikat Kaydı', description: 'Bir "Belgesel" bitir.', rarity: 'common', icon: '🌍', xpReward: 40 },
  { id: 'c_animation', title: 'Çizgisel Evren', description: 'Bir Animasyon filmi bitir.', rarity: 'common', icon: '🎨', xpReward: 40 },
  { id: 'c_masterpiece', title: 'Başyapıt Mührü', description: 'İzlediğin bir filme tam 10 puan ver.', rarity: 'common', icon: '🏆', xpReward: 50 },
  { id: 'c_trash', title: 'Kayıp Bobin', description: 'İzlediğin bir filme 1 ile 3 arası puan ver.', rarity: 'common', icon: '🗑️', xpReward: 50 },
  { id: 'c_mediocre', title: 'Gri Bölge', description: 'Bir filme 5.0 ile 6.0 arası (ortalama) puan ver.', rarity: 'common', icon: '😐', xpReward: 40 },
  { id: 'c_detailer', title: 'Semantik Kodlama', description: 'Bir filme en az 3 farklı "İnceleme Etiketi" (Review Tag) ekle.', rarity: 'common', icon: '🏷️', xpReward: 45 },
  { id: 'c_writer', title: 'Eleştirmen Notu', description: 'Bir filmin notlar kısmına en az 50 karakterlik inceleme yaz.', rarity: 'common', icon: '✍️', xpReward: 50 },
  { id: 'c_old_movie', title: 'Yirminci Yüzyıl Mirası', description: 'Çıkış yılı 2000 öncesi olan bir film izle.', rarity: 'common', icon: '📼', xpReward: 50 },
  { id: 'c_new_movie', title: 'Vizyon Nabzı', description: 'İçinde bulunduğumuz yıla ait yeni bir film izle.', rarity: 'common', icon: '✨', xpReward: 50 },
  { id: 'c_weekend', title: 'Hafta Sonu Matinesi', description: 'Cumartesi veya Pazar günü bir film bitir.', rarity: 'common', icon: '🎉', xpReward: 40 },
  { id: 'c_weekday', title: 'Pazartesi Sendromu', description: 'Pazartesi günü bir film bitir.', rarity: 'common', icon: '☕', xpReward: 40 },
  { id: 'c_episode_rating', title: 'Bölüm Eleştirmeni', description: 'Bir dizi bölümüne 8 ve üzeri puan ver.', rarity: 'common', icon: '⭐', xpReward: 40 },
  { id: 'c_series_pilot', title: 'Açılış Sekansı', description: 'Herhangi bir dizinin 1. sezon 1. bölümünü izle.', rarity: 'common', icon: '🎬', xpReward: 40 },
  { id: 'c_series_double', title: 'İkili Gösterim', description: 'Aynı gün içinde peş peşe 2 dizi bölümü izle.', rarity: 'common', icon: '📺', xpReward: 50 },

  // --- NADİR (RARE) - 15 Görev ---
  { id: 'r_night_watch', title: 'Gece Yarısı Seansı', description: 'Gece 01:00 ile 05:00 saatleri arasında bir film bitir.', rarity: 'rare', icon: '🦉', xpReward: 100 },
  { id: 'r_two_hours', title: 'Altın Oran Süresi', description: 'Süresi tam olarak 120-130 dk arası olan bir film bitir.', rarity: 'rare', icon: '⌛', xpReward: 100 },
  { id: 'r_tarantino', title: 'Suç ve Ceza', description: '"Suç" veya "Gerilim" türünde bir film izle ve 8+ puan ver.', rarity: 'rare', icon: '🔫', xpReward: 120 },
  { id: 'r_classic', title: 'Yetmişler Ruhu', description: 'Çıkış yılı 1970 ile 1980 arasında olan kült bir film izle.', rarity: 'rare', icon: '📻', xpReward: 110 },
  { id: 'r_mystery_solver', title: 'Noir Dedektifi', description: 'Gizem türünde bir film izleyip uzun (100+ karakter) not yaz.', rarity: 'rare', icon: '🕵️', xpReward: 110 },
  { id: 'r_consistent', title: 'Kesintisiz Frekans', description: '3 gün üst üste (Seri) en az 1 içerik izle.', rarity: 'rare', icon: '📈', xpReward: 150 },
  { id: 'r_variety', title: 'Zıt Kutuplar', description: 'Aynı gün içinde 2 tamamen farklı türde film izle.', rarity: 'rare', icon: '🎭', xpReward: 120 },
  { id: 'r_series_wolf', title: 'Üçlü Bölüm Akışı', description: 'Bir dizinin tam 3 bölümünü aynı gün içinde izle.', rarity: 'rare', icon: '🐺', xpReward: 125 },
  { id: 'r_friday_joy', title: 'Cuma Galası', description: 'Cuma akşamı 20:00 ile 23:59 arası bir film bitir.', rarity: 'rare', icon: '🍕', xpReward: 100 },
  { id: 'r_double_action', title: 'Çifte Barut', description: 'Aynı gün içinde 2 Aksiyon filmi bitir.', rarity: 'rare', icon: '🔥', xpReward: 120 },
  { id: 'r_double_horror', title: 'Karanlık İkili', description: 'Aynı gün içinde 2 Korku filmi bitir.', rarity: 'rare', icon: '👻', xpReward: 120 },
  { id: 'r_second_chance', title: 'Dibe Yolculuk', description: 'Daha önce 5\'in altında puan verdiğin bir filme tekrar şans ver: puanını 7 ve üzerine yükselt.', rarity: 'rare', icon: '♻️', xpReward: 100 },
  { id: 'r_long_movie', title: 'Geniş Perspektif', description: 'Süresi 150 dakikayı (2.5 Saat) geçen bir film izle.', rarity: 'rare', icon: '👁️', xpReward: 110 },
  { id: 'r_perfect_pair', title: 'Çifte Şaheser', description: 'Aynı gün izlediğin 2 filme de 9 veya 10 tam puan ver.', rarity: 'rare', icon: '🥂', xpReward: 130 },
  { id: 'r_indecisive', title: 'Kanaat Revizyonu', description: 'İzlediğin bir filme verdiğin puanı sonradan değiştir (revize et).', rarity: 'rare', icon: '🤔', xpReward: 100 },

  // --- DESTANSI (EPIC) - 8 Görev ---
  { id: 'e_series_killer', title: 'Sezon İmhası', description: 'Herhangi bir dizinin peş peşe tam 5 bölümünü aynı gün bitir.', rarity: 'epic', icon: '☠️', xpReward: 300 },
  { id: 'e_culture_envoy', title: 'Türler Üstü Kurgu', description: 'Aynı gün içinde 3 tamamen farklı türde film bitir.', rarity: 'epic', icon: '🌐', xpReward: 280 },
  { id: 'e_heavy_novel', title: 'Sinematik Manifesto', description: 'Bir filmin notlar kısmına en az 1000 karakterlik detaylı bir inceleme yaz.', rarity: 'epic', icon: '📜', xpReward: 300 },
  { id: 'e_old_school', title: 'Selüloit Mirası', description: '1960 yılından daha eski bir film izle.', rarity: 'epic', icon: '🎩', xpReward: 270 },
  { id: 'e_marathon_3', title: 'Üçleme Maratonu', description: 'Aynı gün içinde arka arkaya 3 film bitir.', rarity: 'epic', icon: '🎳', xpReward: 350 },
  { id: 'e_perfect_3', title: 'Başyapıt Triolojisi', description: 'Aynı gün içinde izlediğin 3 filme de 8 ve üzeri puan ver.', rarity: 'epic', icon: '👑', xpReward: 300 },
  { id: 'e_weekday_warrior', title: 'Mesai Disiplini', description: 'Hafta içi 5 gün (Pzt-Cuma) her gün 1 film izleme serisi yap.', rarity: 'epic', icon: '🛡️', xpReward: 400 },
  { id: 'e_season_finale', title: 'Sezon Kapanışı', description: 'Bir dizinin tam bir sezonunun son bölümünü izle (Final).', rarity: 'epic', icon: '🏁', xpReward: 250 },

  // --- EFSANEVİ (LEGENDARY) - 5 Görev ---
  { id: 'l_directors_cut', title: 'Auteur Disiplini', description: 'Süresi 3 saati (180 dk) aşan bir epik filmi bitir.', rarity: 'legendary', icon: '🎞️', xpReward: 600 },
  { id: 'l_weekend_massacre', title: 'Kızıl Perde Maratonu', description: 'Sadece Cuma, Cumartesi ve Pazar günleri içinde toplam 4 film bitir.', rarity: 'legendary', icon: '⚔️', xpReward: 750 },
  { id: 'l_flawless_selection', title: 'Kusursuz Seçki', description: 'Araya kötü film girmeden, arka arkaya izlediğin 4 filme 9+ puan ver.', rarity: 'legendary', icon: '💎', xpReward: 800 },
  { id: 'l_sinevia_god', title: 'Yedi Günlük Nöbet', description: 'Tam 7 gün boyunca kesintisiz "Günlük Seri (Streak)" yap.', rarity: 'legendary', icon: '⚡', xpReward: 1000 },
  { id: 'l_marathon_5', title: 'Sinema Hipnozu', description: 'Aynı gün içinde arka arkaya tam 5 film bitir.', rarity: 'legendary', icon: '🧛', xpReward: 1200 },

  // --- GİZLİ (MYTHIC - BOSS) - 2 Görev ---
  { id: 'm_hater', title: 'Kıyamet Jürisi', description: 'Arka arkaya izlediğin 3 filme de 3 ve altı puan verdin!', rarity: 'mythic', icon: '🧨', xpReward: 500 },
  { id: 'm_impatient', title: 'Acil Tahliye', description: 'Sayacı başlayan bir filmi ilk 15 dakikasında iptal ettin!', rarity: 'mythic', icon: '🏃', xpReward: 500 },
];

/* ══════════════════════════════════════════════════════════════════════════
   SİNEVİA ÖZEL TASARIM İLLÜSTRASYON MOTORU (50 BENZERSİZ SANATSAL ARMA)
   Her görev kendi hikayesine uygun 3 katmanlı özel vektör çizimine sahiptir:
   - `base`: Gölgeli/gradyanlı ana hacim dolgusu
   - `line`: İnce işçilikli kontur ve mekanik detaylar
   - `core`: Parlayan neon/altın enerji ve vurgu noktaları
   ══════════════════════════════════════════════════════════════════════════ */
interface ArtLayers {
  base: string;
  line: string;
  core: string;
}

const QUEST_ILLUSTRATIONS: Record<string, ArtLayers> = {
  // 1. Hassas Kalibrasyon: Altın kefeli adalet terazisi ve elmas merkez ibresi
  c_picky_taste: {
    base: 'M3 15.5L6.5 8.5L10 15.5C8.5 17 4.5 17 3 15.5Z M14 15.5L17.5 8.5L21 15.5C19.5 17 15.5 17 14 15.5Z M8 20H16L14.5 18H9.5L8 20Z',
    line: 'M12 3V18 M4.5 7.5H19.5 M6.5 7.5L3 15.5H10L6.5 7.5Z M17.5 7.5L14 15.5H21L17.5 7.5Z M7 20.5H17',
    core: 'M12 2.5L14 5.5L12 8.5L10 5.5L12 2.5Z',
  },
  // 2. Kompakt Kurgu: Klasik çizgili sinema mısır kovası ve altın mısır taneleri
  c_short_movie: {
    base: 'M5.5 10L7 21H17L18.5 10H5.5Z M7 10C5.5 8 7 5.5 9.5 6C10.5 3.5 13.5 3.5 14.5 6C17 5.5 18.5 8 17 10H7Z',
    line: 'M5.5 10L7 21H17L18.5 10H5.5Z M9.5 10L10 21 M14.5 10L14 21 M7 10C5.5 8 7 5.5 9.5 6C10.5 3.5 13.5 3.5 14.5 6C17 5.5 18.5 8 17 10',
    core: 'M12 13.5L13.5 15.5L12 17.5L10.5 15.5Z M11 6.5A1 1 0 1 0 13 6.5A1 1 0 1 0 11 6.5Z',
  },
  // 3. Yüksek Oktan: Çapraz taktik kılıçları ve merkezde patlama çekirdeği
  c_action_fan: {
    base: 'M4 19L18.5 4.5L20 6L5.5 20.5L4 19Z M20 19L5.5 4.5L4 6L18.5 20.5L20 19Z',
    line: 'M3.5 20.5L19.5 4.5M14.5 4H20V9.5 M20.5 20.5L4.5 4.5M9.5 4H4V9.5 M3 16.5L7.5 21 M21 16.5L16.5 21',
    core: 'M12 7L13.5 10.5L17 12L13.5 13.5L12 17L10.5 13.5L7 12L10.5 10.5L12 7Z',
  },
  // 4. Mizah Dozu: Antik tiyatro sahne maskesi ve neşeli kıvrımlar
  c_comedy_fan: {
    base: 'M4.5 4.5C8 2.8 16 2.8 19.5 4.5V12.5C19.5 17.5 16 21 12 21C8 21 4.5 17.5 4.5 12.5V4.5Z',
    line: 'M4.5 4.5C8 2.8 16 2.8 19.5 4.5V12.5C19.5 17.5 16 21 12 21C8 21 4.5 17.5 4.5 12.5V4.5Z M7.5 13C8.5 16.5 15.5 16.5 16.5 13H7.5Z',
    core: 'M7.5 9C8.3 7.5 10 7.5 10.8 9 M13.2 9C14 7.5 15.7 7.5 16.5 9 M12 14.5V16',
  },
  // 5. Kadife Trajedi: İçinde sinema şeridi yansıyan kristal gözyaşı ve su halkası
  c_drama_fan: {
    base: 'M12 2.5C12 2.5 6 9.8 6 14.2C6 17.6 8.7 20.2 12 20.2C15.3 20.2 18 17.6 18 14.2C18 9.8 12 2.5 12 2.5Z',
    line: 'M12 2.5C12 2.5 6 9.8 6 14.2C6 17.6 8.7 20.2 12 20.2C15.3 20.2 18 17.6 18 14.2C18 9.8 12 2.5 12 2.5Z M4.5 21.5C8 22.5 16 22.5 19.5 21.5',
    core: 'M9.5 13C9.2 15.2 10.5 17.2 12.8 17.5',
  },
  // 6. Ufuk Ötesi: Yörünge halkalı yıldızlararası kruvazör roketi
  c_sci_fi_fan: {
    base: 'M12 2C15.2 5.8 16.2 10.2 16 14.5H8C7.8 10.2 8.8 5.8 12 2Z M8 11.5L4.5 15.5V17.5H8V11.5Z M16 11.5L19.5 15.5V17.5H16V11.5Z',
    line: 'M12 2C15.2 5.8 16.2 10.2 16 14.5H8C7.8 10.2 8.8 5.8 12 2Z M8 11.5L4.5 15.5V17.5H8 M16 11.5L19.5 15.5V17.5H16 M3 12.5C7 10 17 10 21 12.5',
    core: 'M12 7A1.8 1.8 0 1 0 12 10.6A1.8 1.8 0 1 0 12 7Z M10 14.5L12 22L14 14.5H10Z',
  },
  // 7. Hakikat Kaydı: Eksen halkalı dünya küresi ve kayıt vizörü
  c_documentary: {
    base: 'M12 4.5A7.5 7.5 0 1 0 12 19.5A7.5 7.5 0 1 0 12 4.5Z',
    line: 'M12 4.5A7.5 7.5 0 1 0 12 19.5A7.5 7.5 0 1 0 12 4.5Z M4.8 12H19.2 M12 4.5C14.8 7 14.8 17 12 19.5 M12 4.5C9.2 7 9.2 17 12 19.5 M3 7V3.5H6.5 M21 7V3.5H17.5 M3 17V20.5H6.5 M21 17V20.5H17.5',
    core: 'M12 10.2A1.8 1.8 0 1 0 12 13.8A1.8 1.8 0 1 0 12 10.2Z',
  },
  // 8. Çizgisel Evren: Ressam paleti ve çapraz illüstrasyon fırçası
  c_animation: {
    base: 'M12 3.2A8.8 8.8 0 0 0 3.2 12C3.2 16.8 7 20.8 11.5 20.8C13.2 20.8 14.2 19.8 14.2 18.2C14.2 17 13.4 16.2 13.4 15.2C13.4 14 14.4 13.2 15.8 13.2H17.5C19.5 13.2 20.8 11.6 20.8 9.5C20.8 5.8 16.8 3.2 12 3.2Z',
    line: 'M12 3.2A8.8 8.8 0 0 0 3.2 12C3.2 16.8 7 20.8 11.5 20.8C13.2 20.8 14.2 19.8 14.2 18.2C14.2 17 13.4 16.2 13.4 15.2C13.4 14 14.4 13.2 15.8 13.2H17.5C19.5 13.2 20.8 11.6 20.8 9.5C20.8 5.8 16.8 3.2 12 3.2Z M15 19L21 13',
    core: 'M7.5 10.5A1.2 1.2 0 1 0 7.5 12.9A1.2 1.2 0 1 0 7.5 10.5Z M10.5 6.8A1.2 1.2 0 1 0 10.5 9.2A1.2 1.2 0 1 0 10.5 6.8Z M15.2 7.2A1.2 1.2 0 1 0 15.2 9.6A1.2 1.2 0 1 0 15.2 7.2Z',
  },
  // 9. Başyapıt Mührü: Kanatlı altın akademi kupası ve taç yıldızı
  c_masterpiece: {
    base: 'M6.5 3.5H17.5V9.5C17.5 13 15 15.5 12 15.5C9 15.5 6.5 13 6.5 9.5V3.5Z M8 20.5H16L15 18H9L8 20.5Z',
    line: 'M6.5 3.5H17.5V9.5C17.5 13 15 15.5 12 15.5C9 15.5 6.5 13 6.5 9.5V3.5Z M6.5 5.5H3.5V8.5C3.5 11 5 12.2 6.8 12.2 M17.5 5.5H20.5V8.5C20.5 11 19 12.2 17.2 12.2 M12 15.5V18.5 M7 20.5H17',
    core: 'M12 5.8L13.1 8L15.5 8.3L13.7 10L14.2 12.4L12 11.2L9.8 12.4L10.3 10L8.5 8.3L10.9 8L12 5.8Z',
  },
  // 10. Kayıp Bobin: Parçalanmış film makarası ve kopuk selüloit şeridi
  c_trash: {
    base: 'M12 4A8 8 0 1 0 12 20A8 8 0 1 0 12 4Z',
    line: 'M12 4A8 8 0 1 0 12 20A8 8 0 1 0 12 4Z M4.5 9.5L19.5 14.5 M9.5 4.5L14.5 19.5 M18 18L21.5 21.5',
    core: 'M12 9.5A2.5 2.5 0 1 0 12 14.5A2.5 2.5 0 1 0 12 9.5Z',
  },
  // 11. Gri Bölge: Sarkaçlı denge metronomu (tam merkezde duran ibre)
  c_mediocre: {
    base: 'M7 4H17L19.5 20.5H4.5L7 4Z',
    line: 'M7 4H17L19.5 20.5H4.5L7 4Z M12 6V17 M5.5 17H18.5',
    core: 'M12 9.5A2 2 0 1 0 12 13.5A2 2 0 1 0 12 9.5Z',
  },
  // 12. Semantik Kodlama: Çift katmanlı delikli sinema kuponu & yıldız mühür
  c_detailer: {
    base: 'M3.5 6.5L11.5 3L20.5 12L12.5 20.5L3.5 11.5V6.5Z',
    line: 'M3.5 6.5L11.5 3L20.5 12L12.5 20.5L3.5 11.5V6.5Z M11.5 11.5L16 16 M14 9L17.5 12.5',
    core: 'M8.2 7.2A1.6 1.6 0 1 0 8.2 10.4A1.6 1.6 0 1 0 8.2 7.2Z',
  },
  // 13. Eleştirmen Notu: Altın işlemeli dolmakalem ucu ve mürekkep damlası
  c_writer: {
    base: 'M12 2.5L18.5 11.5L15.5 19H8.5L5.5 11.5L12 2.5Z',
    line: 'M12 2.5L18.5 11.5L15.5 19H8.5L5.5 11.5L12 2.5Z M12 2.5V12.5 M7.5 19H16.5V21.2H7.5V19Z',
    core: 'M12 11.2A1.8 1.8 0 1 0 12 14.8A1.8 1.8 0 1 0 12 11.2Z',
  },
  // 14. Yirminci Yüzyıl Mirası: Detaylı çift makaralı VHS Video Kaseti
  c_old_movie: {
    base: 'M2.5 5.5H21.5V18.5H2.5V5.5Z',
    line: 'M2.5 5.5H21.5V18.5H2.5V5.5Z M2.5 9.5H21.5 M6 5.5V9.5 M18 5.5V9.5 M9.5 14H14.5',
    core: 'M7.5 12A2 2 0 1 0 7.5 16A2 2 0 1 0 7.5 12Z M16.5 12A2 2 0 1 0 16.5 16A2 2 0 1 0 16.5 12Z',
  },
  // 15. Vizyon Nabzı: Dört köşeli prömiyer yıldızı ve projektör huzmeleri
  c_new_movie: {
    base: 'M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z',
    line: 'M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z M5 5L8 8 M19 5L16 8 M5 19L8 16 M19 19L16 16',
    core: 'M12 9.5A2.5 2.5 0 1 0 12 14.5A2.5 2.5 0 1 0 12 9.5Z',
  },
  // 16. Hafta Sonu Matinesi: Tırtıklı VIP Sinema Bileti
  c_weekend: {
    base: 'M2.5 7.5H21.5V10.5C19.8 10.5 19.8 13.5 21.5 13.5V16.5H2.5V13.5C4.2 13.5 4.2 10.5 2.5 10.5V7.5Z',
    line: 'M2.5 7.5H21.5V10.5C19.8 10.5 19.8 13.5 21.5 13.5V16.5H2.5V13.5C4.2 13.5 4.2 10.5 2.5 10.5V7.5Z M8.5 7.5V16.5',
    core: 'M14.5 9.8L15.3 11.4L17 11.6L15.8 12.8L16.1 14.5L14.5 13.6L12.9 14.5L13.2 12.8L12 11.6L13.7 11.4L14.5 9.8Z',
  },
  // 17. Pazartesi Sendromu: Buharı tüten sıcak kahve kupası ve film halkası
  c_weekday: {
    base: 'M4.5 8.5H16.5V14.5C16.5 18 14 20.2 10.5 20.2C7 20.2 4.5 18 4.5 14.5V8.5Z',
    line: 'M4.5 8.5H16.5V14.5C16.5 18 14 20.2 10.5 20.2C7 20.2 4.5 18 4.5 14.5V8.5Z M16.5 9.8H19C20.5 9.8 21.5 10.8 21.5 12.3C21.5 13.8 20.5 14.8 19 14.8H16.5 M3.5 21.2H17.5',
    core: 'M8 3.5C7.2 5 9.5 5.5 8.5 7 M12.5 3C11.7 4.5 14 5 13 6.5',
  },
  // 18. Bölüm Eleştirmeni: Taktiksel kronometre ve iç yıldırım
  c_episode_rating: {
    base: 'M12 5.5A7.8 7.8 0 1 0 12 21.1A7.8 7.8 0 1 0 12 5.5Z',
    line: 'M12 5.5A7.8 7.8 0 1 0 12 21.1A7.8 7.8 0 1 0 12 5.5Z M9.5 2.8H14.5 M12 2.8V5.5 M17.8 6.2L19.8 4.2',
    core: 'M13 8.8L9.5 13.8H12.5L11 18L14.5 13H11.5L13 8.8Z',
  },
  // 19. Açılış Sekansı: Şeritli yönetmen klaketi ve play ikonu
  c_series_pilot: {
    base: 'M3.5 9.5H20.5V20.5H3.5V9.5Z M3.5 9.5L4.5 4.8L19.5 2.8L20.5 7.5L3.5 9.5Z',
    line: 'M3.5 9.5H20.5V20.5H3.5V9.5Z M3.5 9.5L4.5 4.8L19.5 2.8L20.5 7.5L3.5 9.5Z M7.8 4.4L9.8 8.7 M13.2 3.6L15.2 7.9',
    core: 'M9.8 12.5L15.2 15.2L9.8 17.9V12.5Z',
  },
  // 20. İkili Gösterim: Üst üste binmiş çift sinema ekranı
  c_series_double: {
    base: 'M2.5 7.5H16.5V17.5H2.5V7.5Z M6.5 4.5H21.5V14.5H16.5V7.5H6.5V4.5Z',
    line: 'M2.5 7.5H16.5V17.5H2.5V7.5Z M7.5 4.5H21.5V14.5H16.5 M6.5 20.2H12.5 M9.5 17.5V20.2',
    core: 'M8 10.2L12.5 12.5L8 14.8V10.2Z',
  },

  // --- NADİR (RARE) - 15 Görev ---
  // 21. Gece Yarısı Seansı: Hilal ay ve keskin gece baykuşu silüeti
  r_night_watch: {
    base: 'M19.5 14.8A8 8 0 0 1 9.2 4.5A8 8 0 1 0 19.5 14.8Z',
    line: 'M19.5 14.8A8 8 0 0 1 9.2 4.5A8 8 0 1 0 19.5 14.8Z M13 6L14.5 8L16.5 8L15 9.8L15.5 11.8L13.5 10.5L11.5 11.8L12 9.8L10.5 8L12.5 8Z',
    core: 'M8 13.5A1.2 1.2 0 1 0 8 15.9A1.2 1.2 0 1 0 8 13.5Z M12 15.5A1.2 1.2 0 1 0 12 17.9A1.2 1.2 0 1 0 12 15.5Z',
  },
  // 22. Altın Oran Süresi: Kum saati ve içinden akan altın kum kristalleri
  r_two_hours: {
    base: 'M6.5 3.5H17.5L12 11.5L6.5 3.5Z M12 12.5L17.5 20.5H6.5L12 12.5Z',
    line: 'M5 3.5H19 M5 20.5H19 M6.5 3.5L17.5 20.5 M17.5 3.5L6.5 20.5',
    core: 'M9.5 7.5H14.5L12 11L9.5 7.5Z M8.5 19.5H15.5L12 15.5L8.5 19.5Z',
  },
  // 23. Suç ve Ceza: Lazer nişangah (Crosshair) ve merkezde kırmızı hedef
  r_tarantino: {
    base: 'M12 4.5A7.5 7.5 0 1 0 12 19.5A7.5 7.5 0 1 0 12 4.5Z',
    line: 'M12 4.5A7.5 7.5 0 1 0 12 19.5A7.5 7.5 0 1 0 12 4.5Z M12 1.8V6.8 M12 17.2V22.2 M1.8 12H6.8 M17.2 12H22.2',
    core: 'M12 9.8A2.2 2.2 0 1 0 12 14.2A2.2 2.2 0 1 0 12 9.8Z',
  },
  // 24. Yetmişler Ruhu: Antenli retro analog sinema/radyo konsolu
  r_classic: {
    base: 'M3.5 8.5H20.5V19.5H3.5V8.5Z',
    line: 'M3.5 8.5H20.5V19.5H3.5V8.5Z M6.5 8.5L12.5 3L17.5 8.5 M13.5 12.5H18 M13.5 15.8H18',
    core: 'M8.2 11.8A2.3 2.3 0 1 0 8.2 16.4A2.3 2.3 0 1 0 8.2 11.8Z',
  },
  // 25. Noir Dedektifi: Büyüteç merceği içinde neon parmak izi taraması
  r_mystery_solver: {
    base: 'M10.5 3.8A6.7 6.7 0 1 0 10.5 17.2A6.7 6.7 0 1 0 10.5 3.8Z',
    line: 'M10.5 3.8A6.7 6.7 0 1 0 10.5 17.2A6.7 6.7 0 1 0 10.5 3.8Z M15.4 15.4L21 21 M7.5 8.8C8.8 7 12.2 7 13.5 8.8 M7 11.2C8.8 9.5 12.2 9.5 14 11.2',
    core: 'M8.5 13.5C9.8 12.2 11.2 12.2 12.5 13.5 M10.5 10.5V11.5',
  },
  // 26. Kesintisiz Frekans: Yükselen siber-sinyal ve zirve yıldızı
  r_consistent: {
    base: 'M3 19.5L8.5 13L13 16L20.5 6.5V19.5H3Z',
    line: 'M3 17.5L8.5 11.5L13 14.5L20.5 5.5 M15.5 5.5H20.5V10.5 M3 20.2H21',
    core: 'M8.5 9.8A1.7 1.7 0 1 0 8.5 13.2A1.7 1.7 0 1 0 8.5 9.8Z M20.5 3.8A1.7 1.7 0 1 0 20.5 7.2A1.7 1.7 0 1 0 20.5 3.8Z',
  },
  // 27. Zıt Kutuplar: İkiz tiyatro maskesi (Aydınlık ve Karanlık Yüz)
  r_variety: {
    base: 'M2.5 4.5H13V12.5C13 15.8 10.5 18 7.8 18C5 18 2.5 15.8 2.5 12.5V4.5Z M11 8.5H21.5V15.5C21.5 18.8 19 21 16.2 21C13.5 21 11 18.8 11 15.5V8.5Z',
    line: 'M2.5 4.5H13V12.5C13 15.8 10.5 18 7.8 18C5 18 2.5 15.8 2.5 12.5V4.5Z M11 8.5H21.5V15.5C21.5 18.8 19 21 16.2 21C13.5 21 11 18.8 11 15.5V8.5Z',
    core: 'M5.5 12.5C6.5 14.2 9 14.2 10 12.5 M14 17.8C15 16.2 17.5 16.2 18.5 17.8',
  },
  // 28. Üçlü Bölüm Akışı: Geometrik Gece Kurdu (Alfa Arması)
  r_series_wolf: {
    base: 'M4.5 3.5L9 8.5H15L19.5 3.5L20.5 13L12 21.2L3.5 13L4.5 3.5Z',
    line: 'M4.5 3.5L9 8.5H15L19.5 3.5L20.5 13L12 21.2L3.5 13L4.5 3.5Z M9 13.5L12 16.5L15 13.5 M12 8.5V16.5',
    core: 'M7.5 11L10.2 12L8.2 12.8Z M16.5 11L13.8 12L15.8 12.8Z',
  },
  // 29. Cuma Galası: İtalyan pizza dilimi ve sinema spotu
  r_friday_joy: {
    base: 'M12 2.8L20.5 18.5C15 20.8 9 20.8 3.5 18.5L12 2.8Z',
    line: 'M12 2.8L20.5 18.5C15 20.8 9 20.8 3.5 18.5L12 2.8Z M5.2 15.5C9.5 17.2 14.5 17.2 18.8 15.5',
    core: 'M11.5 8.5A1.3 1.3 0 1 0 11.5 11.1A1.3 1.3 0 1 0 11.5 8.5Z M9.5 12.5A1.3 1.3 0 1 0 9.5 15.1A1.3 1.3 0 1 0 9.5 12.5Z M14.2 12A1.3 1.3 0 1 0 14.2 14.6A1.3 1.3 0 1 0 14.2 12Z',
  },
  // 30. Çifte Barut: İkiz plazma alevi
  r_double_action: {
    base: 'M12 2C12 2 5.5 8.2 5.5 14.2C5.5 18.2 8.4 21.2 12 21.2C15.6 21.2 18.5 18.2 18.5 14.2C18.5 11 16.5 7.8 14.8 6.2C14.8 8.8 13.2 10.2 12 10.2C10.8 10.2 10.2 7.8 12 2Z',
    line: 'M12 2C12 2 5.5 8.2 5.5 14.2C5.5 18.2 8.4 21.2 12 21.2C15.6 21.2 18.5 18.2 18.5 14.2C18.5 11 16.5 7.8 14.8 6.2C14.8 8.8 13.2 10.2 12 10.2C10.8 10.2 10.2 7.8 12 2Z',
    core: 'M12 12.5C10.2 14.2 9.5 15.8 9.5 17.5C9.5 19 10.6 20 12 20C13.4 20 14.5 19 14.5 17.5C14.5 15.8 13.8 14.2 12 12.5Z',
  },
  // 31. Karanlık İkili: Gece hayaleti ve parlayan ikiz ruh küresi
  r_double_horror: {
    base: 'M12 2.8C7.2 2.8 4.5 6.5 4.5 11.2V20.5L8.2 18.2L12 20.5L15.8 18.2L19.5 20.5V11.2C19.5 6.5 16.8 2.8 12 2.8Z',
    line: 'M12 2.8C7.2 2.8 4.5 6.5 4.5 11.2V20.5L8.2 18.2L12 20.5L15.8 18.2L19.5 20.5V11.2C19.5 6.5 16.8 2.8 12 2.8Z',
    core: 'M9.2 9.5A1.5 1.5 0 1 0 9.2 12.5A1.5 1.5 0 1 0 9.2 9.5Z M14.8 9.5A1.5 1.5 0 1 0 14.8 12.5A1.5 1.5 0 1 0 14.8 9.5Z',
  },
  // 32. Dibe Yolculuk: Biyo-atık / Geri dönüşüm vorteksi
  r_second_chance: {
    base: 'M12 5.5L16 9.5H8L12 5.5Z M12 18.5L8 14.5H16L12 18.5Z',
    line: 'M4.2 12A7.8 7.8 0 0 1 18.2 7.2 M19.8 12A7.8 7.8 0 0 1 5.8 16.8 M14.5 7.2H18.8V3 M9.5 16.8H5.2V21',
    core: 'M12 10A2 2 0 1 0 12 14A2 2 0 1 0 12 10Z',
  },
  // 33. Geniş Perspektif: Sinematik Anamorfik Göz ve diyafram bıçakları
  r_long_movie: {
    base: 'M1.8 12C4.5 6.8 8 4.5 12 4.5C16 4.5 19.5 6.8 22.2 12C19.5 17.2 16 19.5 12 19.5C8 19.5 4.5 17.2 1.8 12Z',
    line: 'M1.8 12C4.5 6.8 8 4.5 12 4.5C16 4.5 19.5 6.8 22.2 12C19.5 17.2 16 19.5 12 19.5C8 19.5 4.5 17.2 1.8 12Z M12 8A4 4 0 1 0 12 16A4 4 0 1 0 12 8Z',
    core: 'M12 10.2A1.8 1.8 0 1 0 12 13.8A1.8 1.8 0 1 0 12 10.2Z',
  },
  // 34. Çifte Şaheser: Tokuşan kristal şampanya kadehleri ve kıvılcım
  r_perfect_pair: {
    base: 'M4.5 4H10.5L9 11C8.5 12.8 6.5 12.8 6 11L4.5 4Z M13.5 4H19.5L18 11C17.5 12.8 15.5 12.8 15 11L13.5 4Z',
    line: 'M4.5 4H10.5L9 11C8.5 12.8 6.5 12.8 6 11L4.5 4Z M7.5 12.5V19.5 M5 19.5H10 M13.5 4H19.5L18 11C17.5 12.8 15.5 12.8 15 11L13.5 4Z M16.5 12.5V19.5 M14 19.5H19',
    core: 'M12 1.8L12.7 3.8L14.7 4.5L12.7 5.2L12 7.2L11.3 5.2L9.3 4.5L11.3 3.8L12 1.8Z',
  },
  // 35. Kanaat Revizyonu: Kuantum kesişim okları
  r_indecisive: {
    base: 'M16.5 3.5L21 7L16.5 10.5V3.5Z M16.5 13.5L21 17L16.5 20.5V13.5Z',
    line: 'M3 7H8.5L15.5 17H20 M3 17H8.5L15.5 7H20 M16.5 3.5L21 7L16.5 10.5 M16.5 13.5L21 17L16.5 20.5',
    core: 'M12 10.2A1.8 1.8 0 1 0 12 13.8A1.8 1.8 0 1 0 12 10.2Z',
  },

  // --- DESTANSI (EPIC) - 8 Görev ---
  // 36. Sezon İmhası: Kraliyet kurukafası ve çapraz kemik mührü
  e_series_killer: {
    base: 'M12 2.8C7.2 2.8 4.2 6 4.2 10.5C4.2 13.2 5.8 15.2 7.5 16.2V20H16.5V16.2C18.2 15.2 19.8 13.2 19.8 10.5C19.8 6 16.8 2.8 12 2.8Z',
    line: 'M12 2.8C7.2 2.8 4.2 6 4.2 10.5C4.2 13.2 5.8 15.2 7.5 16.2V20H16.5V16.2C18.2 15.2 19.8 13.2 19.8 10.5C19.8 6 16.8 2.8 12 2.8Z M9.8 16.2V20 M14.2 16.2V20',
    core: 'M8.8 9.8A1.7 1.7 0 1 0 8.8 13.2A1.7 1.7 0 1 0 8.8 9.8Z M15.2 9.8A1.7 1.7 0 1 0 15.2 13.2A1.7 1.7 0 1 0 15.2 9.8Z M12 13.5L13 15.2H11L12 13.5Z',
  },
  // 37. Türler Üstü Kurgu: Atomik prizma ve üçlü medeniyet yörüngesi
  e_culture_envoy: {
    base: 'M12 6.5A5.5 5.5 0 1 0 12 17.5A5.5 5.5 0 1 0 12 6.5Z',
    line: 'M2.2 12C5 7.2 19 7.2 21.8 12C19 16.8 5 16.8 2.2 12Z M12 2.2C16.8 5 16.8 19 12 21.8C7.2 19 7.2 5 12 2.2Z',
    core: 'M12 9.5A2.5 2.5 0 1 0 12 14.5A2.5 2.5 0 1 0 12 9.5Z',
  },
  // 38. Sinematik Manifesto: Mühürlü antik ferman parşömeni
  e_heavy_novel: {
    base: 'M5.5 3.5H18.5V19C18.5 20.2 17.5 21 16.2 21H5.5V3.5Z',
    line: 'M5.5 3.5H18.5V19C18.5 20.2 17.5 21 16.2 21H5.5C4.4 21 3.5 20.2 3.5 19V5.5C3.5 4.4 4.4 3.5 5.5 3.5Z M8.5 7.8H15.5 M8.5 11.2H15.5 M8.5 14.5H12.5',
    core: 'M15 15.5A2.2 2.2 0 1 0 15 19.9A2.2 2.2 0 1 0 15 15.5Z',
  },
  // 39. Selüloit Mirası: Çift makaralı klasik 35mm Sinema Kamerası
  e_old_school: {
    base: 'M4 11H16.5V19.5H4V11Z M16.5 13.2L21.5 10.5V20L16.5 17.2V13.2Z',
    line: 'M4 11H16.5V19.5H4V11Z M16.5 13.2L21.5 10.5V20L16.5 17.2 M7 5A3 3 0 1 0 7 11A3 3 0 1 0 7 5Z M13.8 5A3 3 0 1 0 13.8 11A3 3 0 1 0 13.8 5Z',
    core: 'M7 7A1 1 0 1 0 7 9A1 1 0 1 0 7 7Z M13.8 7A1 1 0 1 0 13.8 9A1 1 0 1 0 13.8 7Z',
  },
  // 40. Üçleme Maratonu: Üçlü süpersonik hız şeridi (Triple Chevron)
  e_marathon_3: {
    base: 'M3 5L9.5 12L3 19H6.5L13 12L6.5 5H3Z M10.5 5L17 12L10.5 19H14L20.5 12L14 5H10.5Z',
    line: 'M3 5L9.5 12L3 19 M9 5L15.5 12L9 19 M15 5L21.5 12L15 19',
    core: 'M15 5L21.5 12L15 19',
  },
  // 41. Başyapıt Triolojisi: Üç mücevherli İmparatorluk Tacı
  e_perfect_3: {
    base: 'M3 7.5L7.5 12L12 5L16.5 12L21 7.5L19.2 19.5H4.8L3 7.5Z',
    line: 'M3 7.5L7.5 12L12 5L16.5 12L21 7.5L19.2 19.5H4.8L3 7.5Z M4.5 16.5H19.5',
    core: 'M12 11.5L13.5 13.5L12 15.5L10.5 13.5L12 11.5Z M7.5 13.5A1 1 0 1 0 7.5 15.5A1 1 0 1 0 7.5 13.5Z M16.5 13.5A1 1 0 1 0 16.5 15.5A1 1 0 1 0 16.5 13.5Z',
  },
  // 42. Mesai Disiplini: Şövalye zırh kalkanı ve yıldızlı arma
  e_weekday_warrior: {
    base: 'M12 2.5L20 6V12C20 16.8 16.5 20.2 12 21.8C7.5 20.2 4 16.8 4 12V6L12 2.5Z',
    line: 'M12 2.5L20 6V12C20 16.8 16.5 20.2 12 21.8C7.5 20.2 4 16.8 4 12V6L12 2.5Z M12 2.5V21.8',
    core: 'M12 7L13.5 10.2L17 10.7L14.5 13.1L15.1 16.5L12 14.8L8.9 16.5L9.5 13.1L7 10.7L10.5 10.2L12 7Z',
  },
  // 43. Sezon Kapanışı: Dalgalanan zafer bayrağı
  e_season_finale: {
    base: 'M5 3.5C9 2 14 5.5 19.5 4V14C14 15.5 9 12 5 13.5V3.5Z',
    line: 'M5 2.5V21.5 M5 3.5C9 2 14 5.5 19.5 4V14C14 15.5 9 12 5 13.5 M10 3V13 M15 4.2V14.2 M5 8.5C9 7 14 10.5 19.5 9',
    core: 'M5 2.5A1.2 1.2 0 1 0 5 4.9A1.2 1.2 0 1 0 5 2.5Z',
  },

  // --- EFSANEVİ (LEGENDARY) - 5 Görev ---
  // 44. Auteur Disiplini: Altın sinema makarası ve yönetmen vizörü
  l_directors_cut: {
    base: 'M12 3A9 9 0 1 0 12 21A9 9 0 1 0 12 3Z',
    line: 'M12 3A9 9 0 1 0 12 21A9 9 0 1 0 12 3Z M12 3V21 M3 12H21',
    core: 'M12 9.5A2.5 2.5 0 1 0 12 14.5A2.5 2.5 0 1 0 12 9.5Z M8 6.5A1.2 1.2 0 1 0 8 8.9A1.2 1.2 0 1 0 8 6.5Z M16 6.5A1.2 1.2 0 1 0 16 8.9A1.2 1.2 0 1 0 16 6.5Z M8 15.1A1.2 1.2 0 1 0 8 17.5A1.2 1.2 0 1 0 8 15.1Z M16 15.1A1.2 1.2 0 1 0 16 17.5A1.2 1.2 0 1 0 16 15.1Z',
  },
  // 45. Kızıl Perde Maratonu: Alevli sinema bombası & fitil kıvılcımı
  l_weekend_massacre: {
    base: 'M11 6.5A7.5 7.5 0 1 0 11 21.5A7.5 7.5 0 1 0 11 6.5Z',
    line: 'M11 6.5A7.5 7.5 0 1 0 11 21.5A7.5 7.5 0 1 0 11 6.5Z M14.5 7.2L16.5 4.8C17.8 3.5 19.5 4 20.5 5.2',
    core: 'M20 2.2L20.8 4.2L22.8 5L20.8 5.8L20 7.8L19.2 5.8L17.2 5L19.2 4.2L20 2.2Z M8 11A2 2 0 0 1 10 9',
  },
  // 46. Kusursuz Seçki: Faset kesimli parlak İmparatorluk Elması
  l_flawless_selection: {
    base: 'M6.5 3.5H17.5L21.5 9.5L12 21.2L2.5 9.5L6.5 3.5Z',
    line: 'M6.5 3.5H17.5L21.5 9.5L12 21.2L2.5 9.5L6.5 3.5Z M2.5 9.5H21.5 M6.5 3.5L9 9.5L12 21.2 M17.5 3.5L15 9.5L12 21.2 M9 9.5L12 3.5L15 9.5',
    core: 'M9 9.5L12 16.5L15 9.5H9Z',
  },
  // 47. Yedi Günlük Nöbet: İlahi Yıldırım ve enerji halkası
  l_sinevia_god: {
    base: 'M13.5 2L4.5 13.5H11.5L9.5 22L19.5 10.5H12.5L13.5 2Z',
    line: 'M13.5 2L4.5 13.5H11.5L9.5 22L19.5 10.5H12.5L13.5 2Z',
    core: 'M12.2 6.5L8.2 12.5H12.5L11.2 17.5L15.8 11.5H11.5L12.2 6.5Z',
  },
  // 48. Sinema Hipnozu: Hipnotik spiral & çift iz adımı
  l_marathon_5: {
    base: 'M8 3.5C6 3.5 4.8 5.5 5.2 8.5C5.5 11 6.8 12.5 8.2 12.5C9.6 12.5 10.5 11 10.5 8.5C10.5 5.5 9.5 3.5 8 3.5Z M16 8.5C14.5 8.5 13.5 10.5 13.5 13.5C13.5 16 14.4 17.5 15.8 17.5C17.2 17.5 18.5 16 18.8 13.5C19.2 10.5 18 8.5 16 8.5Z',
    line: 'M8 3.5C6 3.5 4.8 5.5 5.2 8.5C5.5 11 6.8 12.5 8.2 12.5C9.6 12.5 10.5 11 10.5 8.5C10.5 5.5 9.5 3.5 8 3.5Z M16 8.5C14.5 8.5 13.5 10.5 13.5 13.5C13.5 16 14.4 17.5 15.8 17.5C17.2 17.5 18.5 16 18.8 13.5C19.2 10.5 18 8.5 16 8.5Z',
    core: 'M6.5 15C6.5 16.5 7.5 17.5 8.8 17.5C10 17.5 10.5 16.5 10.2 15H6.5Z M13.8 19.5C13.5 21 14 22 15.2 22C16.5 22 17.5 21 17.5 19.5H13.8Z',
  },

  // --- GİZLİ (MYTHIC - BOSS) - 2 Görev ---
  // 49. Kıyamet Jürisi: Ortadan yarılmış kızıl kristal kalp
  m_hater: {
    base: 'M12 5.8C9.8 3 5.5 3.2 3.5 6C1.5 8.8 2.2 13 5.5 16.2L12 21.5L18.5 16.2C21.8 13 22.5 8.8 20.5 6C18.5 3.2 14.2 3 12 5.8Z',
    line: 'M12 5.8C9.8 3 5.5 3.2 3.5 6C1.5 8.8 2.2 13 5.5 16.2L12 21.5L18.5 16.2C21.8 13 22.5 8.8 20.5 6C18.5 3.2 14.2 3 12 5.8Z',
    core: 'M12 5.8L9.8 10.2L13.2 13L10.5 16.8L12 21.5',
  },
  // 50. Acil Tahliye: Süpersonik çift ileri sarma ve kopan film şeridi
  m_impatient: {
    base: 'M3 5.5L12.5 12L3 18.5V5.5Z M12 5.5L21.5 12L12 18.5V5.5Z',
    line: 'M3 5.5L12.5 12L3 18.5V5.5Z M12 5.5L21.5 12L12 18.5V5.5Z M2 12H5 M1 8.5H3 M1 15.5H3',
    core: 'M14.5 9L19 12L14.5 15V9Z',
  },
};

const QUEST_RARITY_LOOKUP: Record<string, QuestRarity> = Object.fromEntries(
  QUEST_DEFS.map((q) => [q.id, q.rarity])
);

const EMBLEM_PALETTE: Record<
  QuestRarity,
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
  common: {
    shellOuter: '#27272a',
    shellInner: '#09090b',
    rimLight: '#d4d4d8',
    rimDark: '#3f3f46',
    glow: 'rgba(161,161,170,0.35)',
    artFillStart: '#a1a1aa',
    artFillEnd: '#3f3f46',
    artStroke: '#f4f4f5',
    artCore: '#e8384f',
  },
  rare: {
    shellOuter: '#0c4a6e',
    shellInner: '#051929',
    rimLight: '#7dd3fc',
    rimDark: '#0284c7',
    glow: 'rgba(56,189,248,0.55)',
    artFillStart: '#38bdf8',
    artFillEnd: '#0369a1',
    artStroke: '#e0f2fe',
    artCore: '#fde047',
  },
  epic: {
    shellOuter: '#4c1d95',
    shellInner: '#13072e',
    rimLight: '#e9d5ff',
    rimDark: '#7e22ce',
    glow: 'rgba(168,85,247,0.65)',
    artFillStart: '#c084fc',
    artFillEnd: '#581c87',
    artStroke: '#faf5ff',
    artCore: '#f43f5e',
  },
  legendary: {
    shellOuter: '#78350f',
    shellInner: '#1c0a02',
    rimLight: '#fef08a',
    rimDark: '#b45309',
    glow: 'rgba(245,158,11,0.8)',
    artFillStart: '#fbbf24',
    artFillEnd: '#92400e',
    artStroke: '#fffbeb',
    artCore: '#ffffff',
  },
  mythic: {
    shellOuter: '#881337',
    shellInner: '#19040a',
    rimLight: '#fecdd3',
    rimDark: '#e11d48',
    glow: 'rgba(244,63,94,0.9)',
    artFillStart: '#fb7185',
    artFillEnd: '#9f1239',
    artStroke: '#fff1f2',
    artCore: '#fde047',
  },
};

/**
 * Görev İllüstrasyon Bileşeni — Her görev için özel çizilmiş 3 katmanlı
 * SVG illüstrasyonu ve nadirliğe duyarlı zırhlı kalkan rozeti üretir.
 */
export function QuestIcon({
  questId,
  size = 24,
  className = '',
}: {
  questId: string;
  size?: number;
  className?: string;
}) {
  const art = QUEST_ILLUSTRATIONS[questId] || QUEST_ILLUSTRATIONS.c_new_movie;
  const rarity: QuestRarity =
    QUEST_RARITY_LOOKUP[questId] ||
    (questId.startsWith('m_')
      ? 'mythic'
      : questId.startsWith('l_')
      ? 'legendary'
      : questId.startsWith('e_')
      ? 'epic'
      : questId.startsWith('r_')
      ? 'rare'
      : 'common');

  const pal = EMBLEM_PALETTE[rarity];
  const uid = `sinevia-art-${questId}`;
  const badgePx = Math.max(size + 16, 38);

  return createElement(
    'span',
    {
      className: `relative inline-flex items-center justify-center select-none shrink-0 group/qart ${className}`,
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
        className: 'w-full h-full overflow-visible transition-transform duration-300 group-hover/qart:scale-110',
      },
      // 1. TANIMLAR: Metalik/Neon Gradyanlar ve Işık Filtreleri
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
          createElement('stop', { offset: '50%', stopColor: pal.rimDark }),
          createElement('stop', { offset: '100%', stopColor: pal.shellInner })
        ),
        createElement(
          'linearGradient',
          { id: `${uid}-fill`, x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
          createElement('stop', { offset: '0%', stopColor: pal.artFillStart, stopOpacity: '0.55' }),
          createElement('stop', { offset: '100%', stopColor: pal.artFillEnd, stopOpacity: '0.25' })
        )
      ),
      // 2. ZIRHLI KALKAN / SEKİZGEN ROZET TABANI
      createElement('polygon', {
        points: '20,3 44,3 61,20 61,44 44,61 20,61 3,44 3,20',
        fill: `url(#${uid}-bg)`,
        stroke: `url(#${uid}-rim)`,
        strokeWidth: rarity === 'legendary' || rarity === 'mythic' ? '2.6' : '2',
      }),
      // İç cam parlaması
      createElement('polygon', {
        points: '22,7 42,7 57,22 57,42 42,57 22,57 7,42 7,22',
        fill: 'none',
        stroke: pal.rimLight,
        strokeOpacity: '0.18',
        strokeWidth: '1',
      }),
      // Taktiksel Ajan Kadran Halkası
      createElement('circle', {
        cx: '32',
        cy: '32',
        r: '21',
        fill: 'none',
        stroke: pal.rimLight,
        strokeOpacity: '0.22',
        strokeWidth: '1',
        strokeDasharray: rarity === 'common' ? '2 4' : '6 3',
      }),
      // Prestij Tacı / Köşe Mücevherleri (Epic, Legendary, Mythic için)
      (rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic') &&
        createElement('polygon', {
          points: '32,0.5 36,5.5 32,9 28,5.5',
          fill: pal.rimLight,
        }),
      (rarity === 'legendary' || rarity === 'mythic') &&
        createElement('polygon', {
          points: '32,63.5 36,58.5 32,55 28,58.5',
          fill: pal.rimLight,
        }),
      // 3. ÖZEL ÇİZİLMİŞ GÖREV İLLÜSTRASYONU (24x24'ten 64x64 merkeze ölçeklendirilmiş)
      createElement(
        'g',
        { transform: 'translate(12, 12) scale(1.6667)' },
        // Katman A: Hacimli Gradyan Gövde
        art.base &&
          createElement('path', {
            d: art.base,
            fill: `url(#${uid}-fill)`,
          }),
        // Katman B: Keskin Vektör Çizgileri
        createElement('path', {
          d: art.line,
          fill: 'none',
          stroke: pal.artStroke,
          strokeWidth: '1.65',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
        // Katman C: Parlak Odak & Vurgu Çekirdeği
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

// Geriye dönük uyumluluk: QUEST_ICON_MAP'i doğrudan çağıran yerler için sarmalayıcı harita
export const QUEST_ICON_MAP: Record<string, FC<{ size?: number; className?: string }>> = Object.fromEntries(
  QUEST_DEFS.map((q) => [
    q.id,
    ({ size = 24, className = '' }: { size?: number; className?: string }) =>
      createElement(QuestIcon, { questId: q.id, size, className }),
  ])
);