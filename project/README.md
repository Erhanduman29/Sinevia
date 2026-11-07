# Sinevia — Film ve Dizi Takip Uygulaması

Sinevia, film ve dizi koleksiyonunu takip etmek, puanlamak, yorumlamak ve sosyal olarak paylaşmak için geliştirilmiş bir web uygulamasıdır. PWA (Progressive Web App) olarak kurulabilir, çevrimdışı çalışabilir ve bulut senkronizasyonu ile birden fazla cihazda aynı veriyi kullanabilir.

**Sürüm:** 4.5

---

## İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Teknoloji Yığını](#teknoloji-yığını)
3. [Kurulum ve Çalıştırma](#kurulum-ve-çalıştırma)
4. [Uygulama Sekmeleri](#uygulama-sekmeleri)
5. [Film Yönetimi](#film-yönetimi)
6. [Dizi Yönetimi](#dizi-yönetimi)
7. [Puanlama Sistemi](#puanlama-sistemi)
8. [İzleme Geçmişi](#izleme-geçmişi)
9. [Koleksiyonlar ve Türler](#koleksiyonlar-ve-türler)
10. [Başarımlar](#başarımlar)
11. [XP ve Seviye Sistemi](#xp-ve-seviye-sistemi)
12. [SineCoin ve Pazar](#sinecoin-ve-pazar)
13. [Pazar Görevleri (Sözleşmeler)](#pazar-görevleri-sözleşmeler)
14. [Görevler (Quests)](#görevler-quests)
15. [Akademi ve Eğitim](#akademi-ve-eğitim)
16. [Kör Kalibrasyon (Düello)](#kör-kalibrasyon-düello)
17. [Sinematik Otopsi (DNF)](#sinematik-otopsi-dnf)
18. [Haftalık Plan](#haftalık-plan)
19. [İstatistikler](#istatistikler)
20. [Sinevia Ağı (Sosyal)](#sinevia-ağı-sosyal)
21. [Bulut Senkronizasyonu](#bulut-senkronizasyonu)
22. [Cihaz Yönetimi](#cihaz-yönetimi)
23. [Bildirimler](#bildirimler)
24. [Ayarlar](#ayarlar)
25. [Kısayollar](#kısayollar)
26. [PWA (Kurulabilir Uygulama)](#pwa-kurulabilir-uygulama)
27. [Yedekleme ve Geri Yükleme](#yedekleme-ve-geri-yükleme)
28. [Yapı ve Klasörler](#yapı-ve-klasörler)
29. [Testler](#testler)

---

## Genel Bakış

Sinevia, bir film ve dizi takip uygulamasıdır. Kullanıcılar filmlerini ve dizilerini ekleyebilir, puanlayabilir, not yazabilir, koleksiyonlar oluşturabilir, izleme geçmişini kaydedebilir. XP ve seviye sistemi, başarımlar, SineCoin ekonomisi, pazar ve görevler ile oyunlaştırılmış bir deneyim sunar. Bulut senkronizasyonu ile birden fazla cihazda aynı veri kullanılabilir.

---

## Teknoloji Yığını

- **Frontend:** React 18 + TypeScript
- **Build:** Vite 5
- **Stil:** Tailwind CSS 3
- **Backend/Veritabanı:** Supabase (PostgreSQL + RPC + Storage)
- **Durum Yönetimi:** React Context (AppContext, QuestContext, TutorialContext, NetworkAuthContext)
- **Yerel Depolama:** IndexedDB (`sinevia-db`) + localStorage
- **PWA:** vite-plugin-pwa (service worker, manifest, offline cache)
- **Test:** Vitest (573+ test)
- **İkonlar:** lucide-react
- **Bildirimler:** Web Push (VAPID) + Service Worker

---

## Kurulum ve Çalıştırma

```bash
cd project
npm install
npm run dev          # Geliştirme sunucusu (http://localhost:5173)
npm run build        # Üretim derlemesi
npm run typecheck    # TypeScript kontrolü
npm run lint         # ESLint
npx vitest run       # Testler
npm run preview      # Üretim önizlemesi
```

Ortam değişkenleri (`.env`):
- `VITE_SUPABASE_URL` — Supabase proje URL'si
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key
- `VITE_VAPID_PUBLIC_KEY` — Web Push VAPID public key (push:setup ile üretilir)

---

## Uygulama Sekmeleri

Alt navigasyon / sidebar ile erişilen sekmeler:

| Sekme | Açıklama |
|---|---|
| Ana Sayfa | Özet, Sinevia kimlik kartı, öneriler, zamanlayıcı |
| Filmler | Film listesi, ekleme, filtreleme, puanlama |
| Diziler | Dizi listesi, bölüm/sezon puanlama |
| Ağ | Sosyal özellikler (arkadaşlar, chat, öneriler, liderlik) |
| Plan | Haftalık izleme planı |
| Geçmiş | İzleme geçmişi |
| Başarımlar | Başarım listesi ve ilerleme |
| Pazar | Market, sözleşmeler, görevler |
| İstatistikler | Detaylı istatistikler |
| Ayarlar | Tüm ayarlar |
| Yapay Zeka | AI asistan |

---

## Film Yönetimi

- **Film ekleme:** Manuel veya TMDB'den arama ile. Başlık, yıl, tür, poster, özet, IMDb/TMDB ID, oyuncular, yönetmenler, stüdyolar, anahtar kelimeler, orijinal dil, runtime.
- **Toplu ekleme:** `BulkAddModal` ile birden fazla film ekleme.
- **Film düzenleme:** `EditMovieModal` ile tüm alanlar düzenlenebilir.
- **Film silme:** Onay dialogu ile.
- **İzlenmiş işaretleme:** `watched` flag + `watchedAt` tarihi.
- **Geçmiş izleme (past watch):** Daha önce izlenmiş filmleri arşive ekleme (`isPastWatch`).
- **Koleksiyon atama:** Filmler koleksiyonlara atanabilir.
- **Tür atama:** Filmler türlere atanabilir.
- **Yeniden izleme:** Aynı film tekrar izlenince `rewatchCounter` artar.
- **Yarım bırakma (DNF / Sinematik Otopsi):** Film yarım bırakılırsa autopsy kaydı.
- **Kör kalibrasyon:** Düello ile puan düzeltilir (`calibratedScore`, `duelCount`, `duelWins`).
- **Gerçek izleme süresi sayacı:** `startedAt`, `actualRuntime` ile izleme süresi takibi.
- **Hızlı izleme:** Orijinal süreden kısa sürede bitirme takibi.
- **Film arama/filtreleme:** Başlık, tür, koleksiyon, izlenmiş durumu.

---

## Dizi Yönetimi

- **Dizi ekleme:** TMDB'den arama ile. Başlık, yıl, tür, poster, özet, sezon/bölüm bilgisi, IMDb/TMDB ID, oyuncular, yaratıcılar, stüdyolar.
- **Bölüm yapısı:** Her dizi sezon ve bölümlerden oluşur. Her bölümün süresi (runtime) TMDB'den çekilir.
- **Bölüm puanlama:** Tek tek bölüm puanlama (rating, detailedRating, reviewTags, note).
- **Sezon toplu puanlama:** "Sezonu Puanla" ile bir sezonun tüm bölümlerini tek seferde puanlama.
- **Dizi genel puanlama:** "Diziyi Genel Puanla" ile tüm diziyi tek puanla puanlama.
- **Toplu puanlama kuralları:**
  - Toplu puanlama bölümleri "izlenmiş" olarak işaretler (hücreler dolar, sonraki sezonun 1. bölümü açılır, dizi "izlenecek" listesinden çıkar).
  - Sözleşmelerde toplu puanlama geçersiz (0 kredi).
  - İzleme süresi başarımlarında toplu puanlama 0 dakika.
  - İzleme sayısı başarımlarında her toplu puanlama 1 izleme sayılır.
  - Puanlama tabanlı başarımlar (10 puan, 9+ puan vb.) her toplu puanlama için 1 kez sayılır.
- **Bölüm kilidi/açma:** İlk izlenmemiş bölüm tek seferde puanlanabilir; önceki bölüm bitince sonraki açılır.
- **Sezon tamamlama kutlaması:** Sezon bitince `SeasonCompleteModal`.
- **Yarım bırakma (DNF):** Dizi yarım bırakma autopsy kaydı.
- **Silinen bölümler:** Yanlışlıkla silinen bölümler "Eksikleri Bul" ile puan/not korunarak geri getirilebilir.
- **Geçmiş izleme (past watch):** Daha önce izlenmiş dizileri arşive ekleme.
- **Dizi arama/filtreleme:** Başlık, tür, izlenmiş durumu.

---

## Puanlama Sistemi

- **10 üzerinden puanlama:** 0.5 artışlarla (0.5, 1, 1.5, ..., 10).
- **Detaylı kriter puanlama:** Her film/dizi için birden fazla kriter (RatingCriterion) ile ağırlıklı puanlama. Kriterler kullanıcı tarafından oluşturulur (ad, ağırlık, uygulama alanı: film/dizi/ikisi, türler).
- **İnceleme notu:** Her yapım için metin notu.
- **İnceleme etiketleri (review tags):** Pozitif/negatif etiketler.
- **Puan düzenleme geçmişi:** `previousRating`, `ratingChangedAt`, `noteChangedAt`, `editedAt`.
- **Kör kalibrasyon düellosu:** İki filmi yan yana karşılaştırarak puan düzeltme.

---

## İzleme Geçmişi

- **Otomatik kayıt:** Film/dizi izlendiğinde `WatchHistoryItem` oluşturulur.
- **Geçmiş düzenleme:** Puan, not, etiket düzenlenebilir (`UPDATE_HISTORY_RATING`).
- **Geçmiş silme:** İzleme kaydı silinebilir.
- **Geçmiş filtreleme:** Tarih, tür, puan aralığı.
- **Yeniden izleme:** Aynı yapım tekrar izlenince yeni kayıt.

---

## Koleksiyonlar ve Türler

- **Koleksiyonlar:** Kullanıcı tanımlı film koleksiyonları. Her film bir koleksiyona atanabilir. Koleksiyon tamamlama başarımı.
- **Türler (Genres):** Film ve dizi türleri. Varsayılan türler + kullanıcı ekleyebilir. Tür bazlı başarımlar (her tür için ayrı başarım).
- **Koleksiyon tamamlama:** Koleksiyondaki tüm filmler izlendiğinde başarım.

---

## Başarımlar

86+ başarım tanımı. Kategoriler:

- **Filmler:** Film koleksiyoncusu, sinefil, epik izleyici, çerezlik, nostalji, sabah şekeri, vb.
- **Diziler:** Dizi arşivcisi, bölüm canavarı, sezon fatihi, sabır taşı, sadakat testi, vb.
- **Puanlama:** Mükemmellikçi, sıkı eleştirmen, renk paleti, vb.
- **Tür (Film/Dizi):** Her tür için ayrı başarım (aksiyon, komedi, dram, korku, bilim kurgu, vb.).
- **Alışkanlık:** Günlük film/dizi rutini, gece kuşu, hafta sonu keyfi, maratoncu, koltuk sevdalısı, vb.
- **Genel:** Toplam izleme, tür kaşifi, not tutucu, vb.
- **Koleksiyon:** Evren tamamlayıcı, evren fatihi.
- **Nostalji:** Eski defterler, unutulmaz başyapıtlar.
- **Özel:** Sinematik otopsi, terazi ustası, tutorial kaşifi.
- **Gizli:** Acımasız yargıç, kusursuzluk takıntısı, dizi koması, sinevia efsanesi, vb.
- **Pazar:** Pazar müşterisi, sinecoin sirkülasyonu, taahhüt ustası.
- **Dizi Süresi:** Dizi süresi ustası, tek oturum efsanesi, tamamlanmış koleksiyon.

Her başarımın birden fazla kademesi (bronze, silver, gold, platinum, emerald, diamond) ve XP ödülü vardır. Gizli başarımlar kullanıcıya gösterilmez (kilit ikonu ile).

---

## XP ve Seviye Sistemi

- **XP kazanma:** Film/dizi izleme, puanlama, not yazma, başarım açma, görev tamamlama, pazar görevleri.
- **Seviye:** XP toplamından hesaplanır (`levelFromXp`).
- **Seviye atlama kutlaması:** `LevelUpModal` ile.
- **XP defteri:** Tüm XP hareketleri kaydedilir (`xpEvents`, `xpLedger`).
- **XP kaynağı:** `source` ve `sourceId` ile izlenebilir (film, dizi, başarım, görev, pazar, vb.).
- **Coin dönüşümü:** XP → SineCoin dönüşümü (`xp_conversion`).

---

## SineCoin ve Pazar

- **SineCoin:** Uygulama içi para birimi. XP dönüşümü, görev ödülleri, pazar görevleri ile kazanılır.
- **Pazar (Market):** SineCoin ile satın alınabilir öğeler:
  - **Çerçeveler (frame):** Profil çerçevesi.
  - **Unvanlar (title):** Kullanıcı unvanı.
  - **Rozetler (badge):** Rozet (2 yuva).
  - **Arka planlar (background):** Profil arka planı.
  - **İsim efektleri (nameEffect):** İsim animasyonu.
  - **Koleksiyonluk (collectible):** Koleksiyonluk öğeler.
  - **Kalıcı avantajlar (perk):** Vitrin yuvası, rozet yuvası, ek görev.
  - **Yardımcı öğeler (utility):** Streak kalkanı, görev yenileme, çift ödül, pazar kuponu, görev uzatma, ceza affı, seçici yenileme, görev sabitleme, XP boost, görev sigortası, streak dondurma, koleksiyonluk açma, keşif bileti, günlük mürekkep.
- **Envanter:** Satın alınan öğeler envanterde saklanır.
- **Kuşanma (equipped):** Çerçeve, unvan, rozet, arka plan, isim efekti kuşanılabilir.
- **Geçici etkiler (activeEffects):** Kullanılan yardımcı öğelerin etkileri.
- **Pazar istatistikleri:** Satın alma sayısı, harcanan coin, tamamlanan/başarısız/iptal edilen görevler.

---

## Pazar Görevleri (Sözleşmeler)

- **Günlük ve haftalık görevler:** Her gün/hafta yeni görevler.
- **Görev türleri (rarity):** Yaygın, nadir, epik, efsanevi, mitik.
- **Görev metrikleri:** Film sayısı, bölüm sayısı, öğe, dakika, tür, puan, not, ekleme, hafta sonu film/bölüm, farklı dizi, izleme günü, tek günde en çok, seri.
- **Görev ödülleri:** XP + SineCoin.
- **Görev başarısızlığı:** Süre içinde tamamlanamazsa ceza (SineCoin düşüşü).
- **Görev iptali:** Kullanıcı görevi iptal edebilir.
- **Görev sabitleme (pin):** Bir görevi sonraki haftaya sabitleme.
- **Günlük ücretsiz görev:** Her gün bir ücretsiz görev.
- **Haftalık ücretsiz görev:** Her hafta bir ücretsiz görev.
- **Görev yenileme:** Yardımcı öğelerle görev yenileme.
- **Görev uzatma:** Yardımcı öğelerle süre uzatma.
- **Görev sigortası:** Başarısızlık cezasını önleme.

---

## Görevler (Quests)

- **Günlük görevler:** Her gün yeni görevler.
- **Görev kabul/red:** Kullanıcı görevi kabul veya reddedebilir.
- **Görev tamamlama:** Koşullar sağlandığında otomatik tamamlanır.
- **Görev geçmişi:** Tamamlanan görevlerin kaydı.
- **Görev soğuma (cooldown):** Reddedilen görevler için bekleme süresi.
- **Ücretsiz görev kullanımı:** Günlük ve sabitlenmiş ücretsiz görev sayaçları.

---

## Akademi ve Eğitim

- **Tutorial sistemi:** Uygulama içi eğitim adımları (13 birim: 6 tutorial + 7 akademi dersi).
- **Akademi tamamlama:** Tüm dersler tamamlanınca başarımlar açılır.
- **Tutorial merkezi:** `TutorialCenter` ile eğitim merkezi.
- **Akademi yoldaşı:** `AcademyCompanion` ile rehber karakter.
- **Sayfa ziyareti bildirimi:** Her sayfa ziyaretinde eğitim tetiklenir.

---

## Kör Kalibrasyon (Düello)

- **Düello:** İki filmi yan yana karşılaştırarak puan düzeltme.
- **Kör puanlama:** Orijinal puan gizli, kullanıcı kendi puanını verir.
- **Sapma koruması:** Düello sonucu orijinal puandan bağımsız sapma korunur (`calibratedScore`).
- **Düello istatistikleri:** `duelCount`, `duelWins`.
- **Başarımlar:** Terazi ustası, taht deviren (gizli).

---

## Sinematik Otopsi (DNF)

- **Yarım bırakma:** Film/dizi yarım bırakılırsa autopsy kaydı.
- **Otopsi nedenleri:** `autopsyReasons` ile nedenler.
- **Otopsi notu:** `autopsyNote`.
- **İlerleme:** `abandonedProgress` (dakika veya bölüm).
- **Başarımlar:** Sinematik otopsi başarımı.

---

## Haftalık Plan

- **Plan oluşturma:** Filmler/diziler haftalık plana eklenebilir.
- **Tarih ve saat:** Her öğe için tarih ve saat.
- **Plan düzenleme:** Öğe ekleme/çıkarma.
- **Plan temizleme:** `planPrune` ile eski planlar temizlenir.

---

## İstatistikler

- **İzleme istatistikleri:** Toplam film/dizi, izleme süresi, tür dağılımı.
- **Puanlama istatistikleri:** Ortalama puan, puan dağılımı.
- **Zaman istatistikleri:** Günlük/haftalık/aylık izleme.
- **Başarım istatistikleri:** Açılan başarımlar.
- **SineCoin istatistikleri:** Kazanılan/harcanan coin.
- **Sözleşme istatistikleri:** Tamamlanan/başarısız görevler.

---

## Sinevia Ağı (Sosyal)

- **Hesap oluşturma:** Kullanıcı adı + şifre ile ağ hesabı.
- **Giriş/çıkış:** Ağ oturumu yönetimi.
- **Profil:** Kullanıcı profili (takma ad, avatar, bio).
- **Arkadaşlar:** Arkadaşlık isteği gönderme/kabul etme.
- **Mesajlaşma:** 1-1 ve grup sohbeti.
- **Öneriler:** Film/dizi önerisi gönderme.
- **Vitrin (Showcase):** Profil vitrininde film/dizi sergileme.
- **Liderlik tablosu:** XP sıralaması.
- **Akış (Feed):** Sosyal aktivite akışı.
- **Bildirimler:** Sosyal etkileşim bildirimleri.
- **Ağ kimliği:** `current_agent_id()` ile hesap doğrulama.

---

## Bulut Senkronizasyonu

- **Otomatik senkron:** Veri değiştiğinde 30 saniyelik sessizlik sonrası buluta kayıt.
- **Çakışma çözümü:** Otomatik birleştirme (modal yok). Gerçek veri farkı varsa birleştirilir.
- **Çakışma hash'i:** Yalnızca gerçek kullanıcı verisi (filmler, diziler, XP, görevler, envanter, vb.) karşılaştırılır. Saat, cihaz, tema, eğitim, market sayaçları çakışma nedeni değildir.
- **İçerik sıkıştırma:** gzip+base64 ile taşıma boyutu küçültülür.
- **Sürüm yönetimi:** Sunucu tarafı revizyon numarası ile atomik commit.
- **Kimlik kurtarma:** Ağ hesabına bağlanınca yerel kimlik otomatik kurtarılır.
- **Yedek arşivi:** Eski Storage arşivinden otomatik içe aktarma.

---

## Cihaz Yönetimi

- **Cihaz listesi:** Ayarlar → Hesap ve Cihaz Yönetimi → "Bu Hesabın Cihazları".
- **Her cihaz:** Etiket (tarayıcı + işletim sistemi), son görülme zamanı.
- **Bu cihaz işareti:** Mevcut cihaz "Bu cihaz" rozeti ile işaretlenir.
- **Cihazdan çıkış:** Herhangi bir cihazdan uzaktan çıkış yapılabilir.
- **Mevcut cihazdan çıkış:** Mevcut cihazdan çıkınca sayfa yenilenir.

---

## Bildirimler

- **Web Push:** Uygulama kapalıyken bildirim (VAPID).
- **Uygulama içi bildirimler:** Toast mesajları.
- **Başarım bildirimleri:** `AchievementToasts` ile.
- **Seviye atlama bildirimi:** `LevelUpModal`.
- **Sözleşme kutlaması:** `ContractCelebrationOverlay`.
- **Bildirim tercihleri:** Kullanıcı ayarlayabilir (sunucu kopyası ile).

---

## Ayarlar

- **Tema:** Koyu/açık tema.
- **Ses:** Ses efektleri açma/kapama.
- **Animasyon:** Hareketi azalt, kutlamaları kısalt.
- **Bildirim:** Bildirim tercihleri.
- **Görünürlük:** Akış görünürlüğü.
- **Alternatif izleme kaynağı:** Özel izleme linki şablonu.
- **Hızlı aksiyon köprüsü:** Çoklu hızlı aksiyon şablonları.
- **Liste paylaşımı:** JSON ile liste paylaşımı.
- **Bulut eşitleme:** Manuel yükleme/indirme.
- **Yedekleme:** Tam yedek al/geri yükle.
- **Hesap yönetimi:** Ağdan çıkış, cihaz sıfırlama, hesap silme.
- **Kısayollar:** Klavye kısayolları özelleştirme.
- **Gösterim:** Kilitli isimleri göster, rozet detayları göster.

---

## Kısayollar

- **Global kısayollar:** ESC (kapat), F1 (tutorial merkezi), arama odaklama.
- **Sekme kısayolları:** Ana sayfa, filmler, diziler, ağ, plan, geçmiş, başarımlar, istatistikler, AI, ayarlar.
- **Özelleştirilebilir:** Ayarlar → Kısayollar ile değiştirilebilir.

---

## PWA (Kurulabilir Uygulama)

- **Kurulum:** Tarayıcıdan "Ana ekrana ekle" ile kurulabilir.
- **Çevrimdışı:** Service worker ile offline cache.
- **Manifest:** Uygulama adı, ikon, tema rengi.
- **Güncelleme:** Yeni sürüm otomatik algılanır.

---

## Yedekleme ve Geri Yükleme

- **Tam yedek:** Tüm veriyi JSON olarak dışa aktarma.
- **Geri yükleme:** JSON yedeğinden içe aktarma.
- **Otomatik bulut yedeği:** Bulut senkronizasyonu ile.

---

## Yapı ve Klasörler

```
project/
├── src/
│   ├── App.tsx              # Ana uygulama, sekme yönetimi
│   ├── main.tsx             # Giriş noktası
│   ├── types.ts             # TypeScript tipleri
│   ├── context/             # React Context (AppContext, QuestContext, TutorialContext, NetworkAuthContext)
│   ├── pages/               # Sayfa bileşenleri (12 sayfa)
│   ├── components/          # Yeniden kullanılabilir bileşenler (50+)
│   ├── lib/                 # Yardımcı kütüphaneler (50+ modül)
│   ├── tutorial/            # Eğitim sistemi
│   ├── hooks/               # Custom hooks
│   └── test/                # Test dosyaları (41 dosya, 573+ test)
├── supabase/
│   ├── schema.sql           # Kanonik veritabanı şeması
│   ├── migrations/          # Migration dosyaları
│   └── README.md            # Supabase rehberi
├── docs/
│   └── sync-contract.md     # Senkronizasyon sözleşmesi
├── public/                  # Statik dosyalar (ikonlar, manifest)
└── package.json
```

### Önemli Modüller

| Modül | Açıklama |
|---|---|
| `AppContext.tsx` | Ana durum yönetimi, senkron, reducer |
| `QuestContext.tsx` | Görev yönetimi |
| `TutorialContext.tsx` | Eğitim sistemi |
| `NetworkAuthContext.tsx` | Ağ kimlik doğrulama |
| `syncEngine.ts` | Bulut senkronizasyon motoru |
| `syncContract.ts` | Senkronizasyon sözleşmesi, hash fonksiyonları |
| `localStateV3.ts` | Yerel durum yönetimi, birleştirme |
| `storageService.ts` | IndexedDB + localStorage |
| `supabase.ts` | Supabase istemcisi |
| `networkAuth.ts` | Ağ kimlik doğrulama RPC'leri |
| `notifications.ts` | Bildirim yönetimi |
| `achievements.ts` | Başarım tanımları |
| `contracts.ts` | Pazar görevi tanımları |
| `marketItems.ts` | Pazar öğeleri |
| `quests.ts` | Görev tanımları |
| `xp.ts` | XP hesaplama |
| `coins.ts` | SineCoin yönetimi |
| `statsLogic.ts` | İstatistik hesaplama |
| `contractLogic.ts` | Sözleşme ilerleme hesaplama |
| `questLogic.ts` | Görev tamamlama kontrolü |
| `selectors.ts` | Veri filtreleme/sıralama |
| `utils.ts` | Yardımcı fonksiyonlar |

---

## Testler

```bash
npx vitest run                    # Tüm testler
npx vitest run src/test/syncEngine.test.ts  # Belirli test
```

**Test dosyaları (41 dosya, 573+ test):**

| Test Dosyası | Kapsam |
|---|---|
| `quests.test.ts` | Görev mantığı |
| `syncEngine.test.ts` | Senkronizasyon motoru |
| `localStateV3.test.ts` | Yerel durum yönetimi |
| `cloudConflictModal.test.tsx` | Çakışma modalı |
| `reducerActions.test.ts` | Reducer aksiyonları |
| `integrationV3.test.ts` | V3 entegrasyon |
| `legacyArchive.test.ts` | Eski arşiv |
| `appStateContract.test.ts` | Durum sözleşmesi |
| `calibrationEngine.test.ts` | Kalibrasyon motoru |
| `dna.test.ts` | DNA sentezleyici |
| `shortcuts.test.ts` | Kısayollar |
| `xp*.test.ts` | XP mantığı |
| `contract*.test.ts` | Sözleşme mantığı |

---

## Lisans

Özel proje. Tüm hakları saklıdır.